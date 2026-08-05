/**
 * P3 — one segment's full chain: narrative → evidence → code-mark+connective(locale) → [body translate].
 * Multilingual: mark writes target-language connective; translate covers narrative body only.
 * Progress is checkpointed between phases so soft-wall hops can resume mid-chain.
 */

import {
  DELIVERY_SECTION_HEADINGS,
  DELIVERY_TRANSITION_KEYS,
  type DeliveryArgumentTree,
  type DeliveryComputed,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliveryTask } from "@/lib/llm/pro/delivery/delivery-tasks";
import { runNarrativeTask, runEvidenceTask } from "@/lib/llm/pro/delivery/narrative-evidence-call";
import { runMarkDeliveryTask } from "@/lib/llm/pro/delivery/mark-evidence-call";
import { translateDeliverySegments } from "@/lib/llm/pro/delivery/translate-delivery-segment";
import { polishMarkedEvidenceText } from "@/lib/llm/pro/delivery/polish-marked-evidence";

export type SegmentChainPhase =
  | "start"
  | "narrative_done"
  | "evidence_done"
  | "mark_done"
  | "done";

export type SegmentChainProgress = {
  key: DeliverySegmentKey;
  phase: SegmentChainPhase;
  narrative?: DeliveryArgumentTree;
  evidence?: DeliveryArgumentTree;
  marked?: DeliveryArgumentTree;
  tokens_used: number;
  /**
   * Transport/timeout failures for this segment (mark/evidence/…).
   * Soft-retried until DELIVERY_SEGMENT_TRANSPORT_MAX_ATTEMPTS, then job interrupts.
   */
  transport_fail_count?: number;
};

export type DeliverySegmentReady = {
  key: DeliverySegmentKey;
  heading: string;
  body_markdown: string;
  evidence_markdown: string;
  /**
   * Per-argument interleaved markdown (body → **依据:** → evidence → …).
   * Prefer this for progressive UI so layout matches final merge.
   */
  interleaved_markdown?: string;
  evidence_ready: boolean;
  locale: string;
};

export type SegmentChainRunResult =
  | {
      ok: true;
      done: true;
      progress: SegmentChainProgress;
      ready: DeliverySegmentReady;
      tokens_used: number;
    }
  | {
      ok: true;
      done: false;
      progress: SegmentChainProgress;
      tokens_used: number;
      /** Soft-wall: caller should hop /continue before starting next phase. */
      yield_for_soft_wall: true;
    }
  | { ok: false; reason: string; tokens_used: number; progress: SegmentChainProgress };

/** Wall reserve before starting the phase that follows `phase` (ms). */
export function reserveMsForSegmentPhaseKey(
  phase: SegmentChainPhase,
  key: DeliverySegmentKey,
  locale: string,
): number {
  if (phase === "start") return 90_000;
  if (phase === "narrative_done") {
    return DELIVERY_TRANSITION_KEYS.has(key) ? 0 : 200_000;
  }
  if (phase === "evidence_done") {
    return DELIVERY_TRANSITION_KEYS.has(key) ? 0 : 200_000;
  }
  if (phase === "mark_done") {
    return locale.startsWith("zh") ? 0 : 90_000;
  }
  return 0;
}

/** Worst-case reserve for starting a brand-new segment chain in this invoke. */
export function reserveMsForFullSegmentChain(locale: string): number {
  // narrative + evidence + mark (+ body translate) — prefer hop over mid-chain kill
  const translate = locale.startsWith("zh") ? 0 : 90_000;
  return 90_000 + 200_000 + 200_000 + translate;
}

function sectionHeading(key: DeliverySegmentKey, locale: string): string {
  const h = DELIVERY_SECTION_HEADINGS[key];
  return locale.startsWith("zh") ? h.zh : h.en;
}

function bodiesToMarkdown(args: Array<{ body: string }> | undefined): string {
  return (args ?? [])
    .map((a) => (a.body ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function evidenceToMarkdown(args: Array<{ evidence?: string }> | undefined): string {
  return (args ?? [])
    .map((a) => (a.evidence ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function evidenceLeadLabel(locale: string): string {
  return locale.startsWith("zh") ? "**依据与推理:**" : "**Evidence & reasoning:**";
}

/** Match mergeDeliveryToMarkdown per-argument layout. */
function interleavedSectionMarkdown(
  key: DeliverySegmentKey,
  locale: string,
  narrative: DeliveryArgumentTree,
  marked: DeliveryArgumentTree,
): string {
  const isTransition = DELIVERY_TRANSITION_KEYS.has(key);
  const lead = evidenceLeadLabel(locale);
  const bodyArgs = narrative[key] ?? [];
  const evArgs = marked[key] ?? [];
  const parts: string[] = [];
  for (let i = 0; i < bodyArgs.length; i++) {
    const body = (bodyArgs[i]?.body ?? "").trim().replace(/\n{2,}/g, "\n");
    if (!body) continue;
    parts.push(body);
    if (isTransition) continue;
    const evRaw = (evArgs[i]?.evidence ?? evArgs[i]?.body ?? "")
      .trim()
      .replace(/\s*\n+\s*/g, " ");
    const pending =
      !evRaw || /^本段依据待补|^Evidence (for this section )?pending/i.test(evRaw);
    // 内容段严格三件套:每块【必挂】依据标签,绝不静默吞(否则破三件套 + 整段被前端误判成过渡段)。
    // 真失败也【响亮】——给可见占位 + console.error,提示重跑本段,而非悄悄少一块依据。
    if (pending) {
      console.error("[delivery/interleave] content evidence missing", { key, index: i });
    }
    const ev = pending
      ? locale.startsWith("zh")
        ? "（本段依据生成失败，请重新生成）"
        : "(Evidence generation failed for this block — please regenerate.)"
      : evRaw;
    parts.push(`${lead}\n${ev}`);
  }
  return parts.join("\n\n");
}

function buildReady(
  key: DeliverySegmentKey,
  locale: string,
  narrative: DeliveryArgumentTree,
  marked: DeliveryArgumentTree,
): DeliverySegmentReady {
  const isTransition = DELIVERY_TRANSITION_KEYS.has(key);
  return {
    key,
    heading: sectionHeading(key, locale),
    body_markdown: bodiesToMarkdown(narrative[key]),
    evidence_markdown: isTransition ? "" : evidenceToMarkdown(marked[key]),
    interleaved_markdown: interleavedSectionMarkdown(key, locale, narrative, marked),
    /** false = transition (no evidence layer); true = content segment with evidence. */
    evidence_ready: !isTransition,
    locale,
  };
}

/**
 * Advance one segment chain as far as soft-wall allows.
 * `shouldYield()` returns true when the invoke must hop before the next phase.
 */
export async function advanceSegmentChain(input: {
  task: DeliveryTask;
  finalize: DeliveryComputed;
  locale: string;
  original_question?: string | null;
  session_id?: string;
  signal?: AbortSignal;
  progress: SegmentChainProgress | null;
  shouldYield: (nextPhaseReserveMs: number) => boolean;
}): Promise<SegmentChainRunResult> {
  const key = input.task.paths[0];
  if (!key) {
    return {
      ok: false,
      reason: "segment_missing_key",
      tokens_used: 0,
      progress: { key: "energy", phase: "start", tokens_used: 0 },
    };
  }

  let progress: SegmentChainProgress = input.progress ?? {
    key,
    phase: "start",
    tokens_used: 0,
  };
  if (progress.key !== key) {
    progress = { key, phase: "start", tokens_used: 0 };
  }

  const isTransition = DELIVERY_TRANSITION_KEYS.has(key);

  // --- narrative ---
  if (progress.phase === "start") {
    const reserve = reserveMsForSegmentPhaseKey("start", key, input.locale);
    if (input.shouldYield(reserve)) {
      return {
        ok: true,
        done: false,
        progress,
        tokens_used: progress.tokens_used,
        yield_for_soft_wall: true,
      };
    }
    const narr = await runNarrativeTask(
      input.task,
      input.finalize,
      input.session_id,
      input.signal,
    );
    if (!narr.ok) {
      return {
        ok: false,
        reason: `narrative:${narr.reason}`,
        tokens_used: progress.tokens_used + narr.tokens_used,
        progress,
      };
    }
    progress = {
      ...progress,
      phase: "narrative_done",
      narrative: narr.value,
      tokens_used: progress.tokens_used + narr.tokens_used,
    };
  }

  // --- evidence (skip for transition) ---
  if (progress.phase === "narrative_done") {
    if (isTransition) {
      progress = {
        ...progress,
        phase: "evidence_done",
        evidence: {},
      };
    } else {
      const reserve = reserveMsForSegmentPhaseKey("narrative_done", key, input.locale);
      if (input.shouldYield(reserve)) {
        return {
          ok: true,
          done: false,
          progress,
          tokens_used: progress.tokens_used,
          yield_for_soft_wall: true,
        };
      }
      const ev = await runEvidenceTask(
        input.task,
        input.finalize,
        progress.narrative ?? {},
        input.session_id,
        input.signal,
      );
      if (!ev.ok) {
        return {
          ok: false,
          reason: `evidence:${ev.reason}`,
          tokens_used: progress.tokens_used + ev.tokens_used,
          progress,
        };
      }
      progress = {
        ...progress,
        phase: "evidence_done",
        evidence: ev.value,
        tokens_used: progress.tokens_used + ev.tokens_used,
      };
    }
  }

  // --- mark / connective (skip for transition) ---
  if (progress.phase === "evidence_done") {
    if (isTransition) {
      progress = {
        ...progress,
        phase: "mark_done",
        marked: {},
      };
    } else {
      const reserve = reserveMsForSegmentPhaseKey("evidence_done", key, input.locale);
      if (input.shouldYield(reserve)) {
        return {
          ok: true,
          done: false,
          progress,
          tokens_used: progress.tokens_used,
          yield_for_soft_wall: true,
        };
      }
      const mark = await runMarkDeliveryTask(
        input.task,
        progress.evidence ?? {},
        input.locale,
        {
          session_id: input.session_id,
          original_question: input.original_question,
          signal: input.signal,
        },
      );
      if (!mark.ok) {
        return {
          ok: false,
          reason: `mark:${mark.reason}`,
          tokens_used: progress.tokens_used + mark.tokens_used,
          progress,
        };
      }
      // Ensure code-mark polish even if mark returned early empty slots.
      const marked: DeliveryArgumentTree = {};
      for (const [k, args] of Object.entries(mark.value)) {
        marked[k as DeliverySegmentKey] = (args ?? []).map((a) => ({
          body: a.body,
          evidence: a.evidence
            ? (() => {
                try {
                  return polishMarkedEvidenceText(a.evidence, "zh");
                } catch {
                  return a.evidence;
                }
              })()
            : a.evidence,
        }));
      }
      progress = {
        ...progress,
        phase: "mark_done",
        marked,
        tokens_used: progress.tokens_used + mark.tokens_used,
      };
    }
  }

  // --- body translate (non-zh); evidence already locale-native from mark ---
  if (progress.phase === "mark_done") {
    const reserve = reserveMsForSegmentPhaseKey("mark_done", key, input.locale);
    if (reserve > 0 && input.shouldYield(reserve)) {
      return {
        ok: true,
        done: false,
        progress,
        tokens_used: progress.tokens_used,
        yield_for_soft_wall: true,
      };
    }

    let narrative = progress.narrative ?? {};
    let marked = progress.marked ?? {};
    if (!input.locale.startsWith("zh")) {
      const merged: DeliveryArgumentTree = {
        [key]: (narrative[key] ?? []).map((a, i) => ({
          body: a.body,
          evidence: marked[key]?.[i]?.evidence ?? a.evidence,
        })),
      };
      const tr = await translateDeliverySegments(merged, input.locale, {
        paths: [key],
        session_id: input.session_id,
        signal: input.signal,
      });
      narrative = {
        [key]: (tr.tree[key] ?? []).map((a) => ({ body: a.body })),
      };
      // Keep mark evidence as-is (locale connective). Only bodies change.
      if (!isTransition) {
        marked = {
          [key]: (tr.tree[key] ?? []).map((a, i) => ({
            body: a.body,
            evidence: marked[key]?.[i]?.evidence ?? a.evidence,
          })),
        };
      }
      progress = {
        ...progress,
        narrative,
        marked,
        tokens_used: progress.tokens_used + tr.tokens_used,
      };
    }

    const ready = buildReady(key, input.locale, narrative, marked);
    progress = { ...progress, phase: "done", narrative, marked };
    return {
      ok: true,
      done: true,
      progress,
      ready,
      tokens_used: progress.tokens_used,
    };
  }

  return {
    ok: false,
    reason: `unexpected_phase:${progress.phase}`,
    tokens_used: progress.tokens_used,
    progress,
  };
}
