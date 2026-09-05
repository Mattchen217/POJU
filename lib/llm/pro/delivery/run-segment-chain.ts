/**
 * P3 — one segment's full chain (Batch 3 order):
 *   start → deep evidence → evidence_done
 *        → narrative compress fill → narrative_done
 *        → mark → mark_done → [body translate] → done
 * Legacy checkpoints (fill before evidence) are migrated in-place.
 * Progress is checkpointed between phases so soft-wall hops can resume mid-chain.
 */

import {
  DELIVERY_TRANSITION_KEYS,
  type DeliveryArgumentTree,
  type DeliveryComputed,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliveryTask } from "@/lib/llm/pro/delivery/delivery-tasks";
import { DELIVERY_FINALIZE_TIMEOUT_XHIGH_MS } from "@/lib/llm/pro/delivery/delivery-tasks";
import {
  deliveryEvidenceLeadLabel,
  deliveryEvidencePendingDetectRe,
  deliveryEvidencePendingPlaceholder,
  deliverySectionHeading,
} from "@/lib/llm/pro/delivery/delivery-locale";
import { runNarrativeTask, runEvidenceTask } from "@/lib/llm/pro/delivery/narrative-evidence-call";
import { runMarkDeliveryTask } from "@/lib/llm/pro/delivery/mark-evidence-call";
import { translateDeliverySegments } from "@/lib/llm/pro/delivery/translate-delivery-segment";
import { encodeConnectiveEvidenceToTerms } from "@/lib/llm/pro/delivery/polish-marked-evidence";
import { countEvidenceCoverage } from "@/lib/llm/pro/delivery/expand-arguments-by-h3";
import {
  buildSegmentStructureMarkdown,
  encodePageScanMarkdown,
  encodeThirtyDayGanttMarkdown,
  localizePageScanCardLabels,
  localizeThirtyDayGanttLabels,
  type PageScanCardStruct,
  type ThirtyDayGanttStruct,
} from "@/lib/llm/pro/delivery/poju-struct-blocks";
import type { BreakthroughCore } from "@/lib/poju/agent-state";
import {
  translatePageScanCard,
  translateThirtyDayGantt,
} from "@/lib/llm/pro/delivery/translate-delivery-segment";
import { runPageSchemaFill } from "@/lib/llm/pro/delivery/page-schema/fill-call";
import {
  alignDeepEvidenceToPage,
  evidenceTreeFromAligned,
  runDeepEvidenceCall,
  type DeepEvidencePlan,
} from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import { logEffortDowngrade } from "@/lib/llm/pro/delivery/effort-downgrade-log";
import { formatP5ActionBriefForPrompt } from "@/lib/llm/pro/delivery/page-schema/action-extractor";
import {
  encodePageSchemaFence,
  pageSchemaToArgumentTree,
} from "@/lib/llm/pro/delivery/page-schema/render";
import type {
  DeliveryPageData,
  P5ActionBrief,
  P5WeekSummary,
} from "@/lib/llm/pro/delivery/page-schema/types";

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
  /** Structured page slots (page_schema_v1) — primary path. */
  page_schema?: DeliveryPageData;
  /** Batch 3: locked deep-evidence plan (anchors + professional evidence). */
  deep_evidence_plan?: DeepEvidencePlan;
  /** Model scan from narrative JSON (may be translated later). */
  scan?: PageScanCardStruct | null;
  /** Model thirty-day table from narrative JSON (may be translated later). */
  gantt?: ThirtyDayGanttStruct | null;
  tokens_used: number;
  /**
   * Transport/timeout failures for this segment (mark/evidence/…).
   * Soft-retried until DELIVERY_SEGMENT_TRANSPORT_MAX_ATTEMPTS, then job interrupts.
   */
  transport_fail_count?: number;
  /**
   * Times we soft-walled after page_schema fill failed while still on phase "start".
   * After FILL_YIELD_BEFORE_NARRATIVE, force narrative fallback instead of infinite /continue.
   */
  fill_yield_count?: number;
};

/** Soft-wall fill failures at phase=start before forcing narrative fallback. */
export const FILL_YIELD_BEFORE_NARRATIVE = 2;

/** Keys that need a longer admit window before starting fill (heavy context). */
export const SEGMENT_HEAVY_FILL_KEYS = new Set<DeliverySegmentKey>([
  "metaphysics_action",
  "risk_guard",
]);

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
  /** Structured slots for UI (optional; prose fallback if absent). */
  page_schema?: DeliveryPageData;
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

/**
 * Minimum invoke budget (ms) to start another LLM phase in-process.
 * Below this → soft-wall yield to /continue (fresh 300s).
 *
 * Default 55s; override with DELIVERY_SEGMENT_MIN_INVOKE_MS for production calibration.
 * Heavy pages use SEGMENT_HEAVY_MIN_INVOKE_MS so they do not start with a starved timeout.
 */
export const SEGMENT_MIN_INVOKE_MS = (() => {
  const raw = Number.parseInt(process.env.DELIVERY_SEGMENT_MIN_INVOKE_MS ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 55_000;
})();

/**
 * Admit window for metaphysics_action / risk_guard fills (thinking + fat context).
 * Must stay well above fill client ceiling after the 12s handoff reserve.
 * 180s: xhigh deep-evidence + headroom (was 120s; short admits starved xhigh).
 */
export const SEGMENT_HEAVY_MIN_INVOKE_MS = 180_000;

/**
 * Admit for any non-bootstrap page: deep-evidence is xhigh for all content pages.
 * Same window as heavy — avoid starting xhigh with a 55s starved budget.
 */
export const SEGMENT_DEEP_EVIDENCE_MIN_INVOKE_MS = SEGMENT_HEAVY_MIN_INVOKE_MS;

/**
 * Bootstrap (P1) may finish translate / last hop with a tighter floor so the
 * shelf unlocks instead of soft-walling with empty `require_preface` markdown.
 */
export const SEGMENT_BOOTSTRAP_MIN_INVOKE_MS = 40_000;

/** Remaining hard-deadline budget to pack another schema DAG wave in the same invoke. */
export const SCHEMA_WAVE_PACK_MIN_REMAINING_MS = 130_000;

/** @deprecated Light/medium fill tier removed — all fills are high. Kept empty for grep guards. */
export const SEGMENT_LIGHT_FILL_KEYS = new Set<DeliverySegmentKey>([]);

/** Compress / page fill — never below high (no medium). */
export function segmentFillThinkingEffort(
  _key: DeliverySegmentKey,
): "high" {
  return "high";
}

/** Admit threshold for the next segment phase (bootstrap / deep-evidence / heavy). */
export function segmentAdmitMinMs(key: DeliverySegmentKey): number {
  if (key === "direct_answer") return SEGMENT_BOOTSTRAP_MIN_INVOKE_MS;
  return SEGMENT_DEEP_EVIDENCE_MIN_INVOKE_MS;
}

/** Cap LLM client abort to remaining invoke budget (never below 30s). */
export function segmentPhaseTimeoutMs(
  ceilingMs: number,
  invokeHardDeadlineMs: number,
  invocationStartedAt: number,
): number {
  const remaining = invokeHardDeadlineMs - (Date.now() - invocationStartedAt);
  // Keep 12s for checkpoint + handoff after the LLM returns/aborts.
  return Math.min(ceilingMs, Math.max(30_000, remaining - 12_000));
}

/** @deprecated Soft-wall uses SEGMENT_MIN_INVOKE_MS; kept for reserveMsForFullSegmentChain. */
export function reserveMsForSegmentPhaseKey(
  phase: SegmentChainPhase,
  key: DeliverySegmentKey,
  locale: string,
): number {
  if (phase === "start") {
    // Deep evidence (or transition skip → fill soon)
    return SEGMENT_HEAVY_FILL_KEYS.has(key) ? SEGMENT_HEAVY_MIN_INVOKE_MS : SEGMENT_MIN_INVOKE_MS;
  }
  if (phase === "evidence_done") {
    // Narrative compress fill next
    return SEGMENT_HEAVY_FILL_KEYS.has(key) ? SEGMENT_HEAVY_MIN_INVOKE_MS : SEGMENT_MIN_INVOKE_MS;
  }
  if (phase === "narrative_done") {
    return DELIVERY_TRANSITION_KEYS.has(key) ? 0 : 120_000;
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
  return SEGMENT_MIN_INVOKE_MS + 200_000 + 200_000 + translate;
}

function sectionHeading(key: DeliverySegmentKey, locale: string): string {
  return deliverySectionHeading(key, locale);
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

/** Match mergeDeliveryToMarkdown per-argument layout (+ Layer3 code structures). */
function interleavedSectionMarkdown(
  key: DeliverySegmentKey,
  locale: string,
  narrative: DeliveryArgumentTree,
  marked: DeliveryArgumentTree,
  breakthrough_core?: BreakthroughCore | null,
  scan?: PageScanCardStruct | null,
  gantt?: ThirtyDayGanttStruct | null,
  page_schema?: DeliveryPageData | null,
): string {
  const isTransition = DELIVERY_TRANSITION_KEYS.has(key);
  const lead = deliveryEvidenceLeadLabel(locale);
  const pendingRe = deliveryEvidencePendingDetectRe();
  const pendingPlaceholder = deliveryEvidencePendingPlaceholder(locale);
  const bodyArgs = narrative[key] ?? [];
  const evArgs = marked[key] ?? [];
  const parts: string[] = [];
  if (page_schema) {
    parts.push(encodePageSchemaFence(page_schema));
  }
  if (scan && scan.items.length >= 2) {
    const scanMd = encodePageScanMarkdown(scan, locale);
    if (scanMd) parts.push(scanMd);
  }
  if (key === "thirty_day" && gantt && gantt.weeks.length >= 4) {
    const ganttMd = encodeThirtyDayGanttMarkdown(gantt, locale);
    if (ganttMd) parts.push(ganttMd);
  }
  const structureMd = buildSegmentStructureMarkdown(key, locale, breakthrough_core);
  if (structureMd) parts.push(structureMd);
  for (let i = 0; i < bodyArgs.length; i++) {
    const body = (bodyArgs[i]?.body ?? "").trim().replace(/\n{2,}/g, "\n");
    if (!body) continue;
    parts.push(body);
    if (isTransition) continue;
    const evRaw = (evArgs[i]?.evidence ?? evArgs[i]?.body ?? "")
      .trim()
      .replace(/\s*\n+\s*/g, " ");
    const pending = !evRaw || pendingRe.test(evRaw);
    if (pending) {
      console.error("[delivery/interleave] content evidence missing", { key, index: i });
    }
    const ev = pending ? pendingPlaceholder : evRaw;
    parts.push(`${lead}\n${ev}`);
  }
  return parts.join("\n\n");
}

function buildReady(
  key: DeliverySegmentKey,
  locale: string,
  narrative: DeliveryArgumentTree,
  marked: DeliveryArgumentTree,
  breakthrough_core?: BreakthroughCore | null,
  scan?: PageScanCardStruct | null,
  gantt?: ThirtyDayGanttStruct | null,
  page_schema?: DeliveryPageData | null,
): DeliverySegmentReady {
  const isTransition = DELIVERY_TRANSITION_KEYS.has(key);
  return {
    key,
    heading: sectionHeading(key, locale),
    body_markdown: bodiesToMarkdown(narrative[key]),
    evidence_markdown: isTransition ? "" : evidenceToMarkdown(marked[key]),
    interleaved_markdown: interleavedSectionMarkdown(
      key,
      locale,
      narrative,
      marked,
      breakthrough_core,
      scan,
      gantt,
      page_schema,
    ),
    page_schema: page_schema ?? undefined,
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
  /** Return true when invoke budget is too tight to start another LLM call. */
  shouldYield: () => boolean;
  invokeHardDeadlineMs: number;
  invocationStartedAt: number;
  breakthrough_core?: BreakthroughCore | null;
  /** Wave C+: Action Extractor brief (code-only). */
  action_brief?: P5ActionBrief | null;
  week_summary?: P5WeekSummary | null;
  primary_backup_hint?: string;
  dashboard_score_hints?: string;
  /** P4: question + desired outcome (not dual-track). */
  question_expectation?: string;
  /** P4: local pack / retune / multi-dim dump. */
  eastern_calc_slice?: string;
  /** P5: risk-polarity local calc dump. */
  risk_calc_slice?: string;
  /** Per-page must_use slice (P1/P2/P3/P6 — P4/P5 use eastern/risk slices). */
  page_plan_slice?: string;
  /** Collecting hard facts for all page fills. */
  reality_constraints?: string;
  /** Layer A: anchors from ready upstream pages (user prompt + soft sanitize). */
  prior_chart_anchors?: readonly string[];
  category_token_sets?: import("./page-schema/anchor-category-tally").CategoryTokenSets | null;
  /** Full structured inventory text for fill (complements sliced multi_dim). */
  structured_inventory?: string;
}): Promise<SegmentChainRunResult> {
  const key = input.task.paths[0];
  if (!key) {
    return {
      ok: false,
      reason: "segment_missing_key",
      tokens_used: 0,
      progress: { key: "direct_answer", phase: "start", tokens_used: 0 },
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

  const phaseTimeout = (ceilingMs: number) =>
    segmentPhaseTimeoutMs(ceilingMs, input.invokeHardDeadlineMs, input.invocationStartedAt);

  // --- Batch 3: start → deep evidence → evidence_done ---
  if (progress.phase === "start") {
    if (input.shouldYield()) {
      return {
        ok: true,
        done: false,
        progress,
        tokens_used: progress.tokens_used,
        yield_for_soft_wall: true,
      };
    }

    if (isTransition) {
      // Transition pages: no deep-evidence / mark; fill runs at evidence_done.
      progress = {
        ...progress,
        phase: "evidence_done",
        evidence: {},
      };
    } else {
      const deepTimeoutMs = phaseTimeout(DELIVERY_FINALIZE_TIMEOUT_XHIGH_MS);
      const seg = input.finalize[key];
      const deep = await runDeepEvidenceCall({
        key,
        locale: input.locale,
        core_conclusion: seg?.core_conclusion ?? "",
        bazi_basis: seg?.bazi_basis,
        session_id: input.session_id,
        signal: input.signal,
        timeout_ms: deepTimeoutMs,
        page_plan_slice: input.page_plan_slice,
        eastern_calc_slice: input.eastern_calc_slice,
        risk_calc_slice: input.risk_calc_slice,
        question_expectation: input.question_expectation,
        primary_backup_hint: input.primary_backup_hint,
        reality_constraints: input.reality_constraints,
        structured_inventory: input.structured_inventory,
        prior_chart_anchors: input.prior_chart_anchors,
        category_token_sets: input.category_token_sets,
        action_brief_block: input.action_brief
          ? formatP5ActionBriefForPrompt(input.action_brief)
          : undefined,
      });
      if (!deep.ok) {
        const priorYields = progress.fill_yield_count ?? 0;
        const remainingMs =
          input.invokeHardDeadlineMs - (Date.now() - input.invocationStartedAt);
        if (input.shouldYield() && priorYields < FILL_YIELD_BEFORE_NARRATIVE) {
          const nextYield = priorYields + 1;
          console.warn("[delivery/segment] deep evidence failed — yield", {
            key,
            reason: deep.reason,
            fill_yield_count: nextYield,
            remaining_ms: remainingMs,
          });
          return {
            ok: true,
            done: false,
            progress: {
              ...progress,
              fill_yield_count: nextYield,
              tokens_used: progress.tokens_used + deep.tokens_used,
            },
            tokens_used: progress.tokens_used + deep.tokens_used,
            yield_for_soft_wall: true,
          };
        }
        // Fall through to evidence_done without plan → compress becomes full fill
        const deepFailReason = deep.reason.startsWith("deep_evidence:")
          ? deep.reason.slice("deep_evidence:".length)
          : deep.reason;
        logEffortDowngrade({
          session_id: input.session_id,
          call_site: "deep_evidence_to_full_fill",
          key,
          from_effort: "xhigh",
          to_effort: "full_fill_fallback",
          reason: deepFailReason,
          attempt: (progress.fill_yield_count ?? 0) + 1,
          elapsed_ms: Date.now() - input.invocationStartedAt,
          timeout_ms_used: deepTimeoutMs,
        });
        console.warn("[delivery/segment] deep evidence failed — continue without plan", {
          key,
          reason: deep.reason,
        });
        progress = {
          ...progress,
          phase: "evidence_done",
          fill_yield_count: 0,
          tokens_used: progress.tokens_used + deep.tokens_used,
        };
      } else {
        progress = {
          ...progress,
          phase: "evidence_done",
          deep_evidence_plan: deep.plan,
          fill_yield_count: 0,
          tokens_used: progress.tokens_used + deep.tokens_used,
        };
      }
    }
  }

  // Legacy migrate: old checkpoints stopped at narrative_done before evidence existed.
  if (
    progress.phase === "narrative_done" &&
    !isTransition &&
    !(progress.evidence?.[key]?.some((a) => (a.evidence ?? "").trim())) &&
    !progress.deep_evidence_plan &&
    (progress.page_schema || progress.narrative)
  ) {
    console.info("[delivery/segment] legacy checkpoint: narrative_done without evidence — runEvidenceTask", {
      key,
    });
    if (input.shouldYield()) {
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
      phaseTimeout(200_000),
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
      evidence: ev.value,
      tokens_used: progress.tokens_used + ev.tokens_used,
    };
    // stay narrative_done → mark below
  }

  // Legacy migrate: old evidence_done meant "ready for mark" (fill already done).
  if (
    progress.phase === "evidence_done" &&
    (progress.page_schema || progress.narrative) &&
    progress.evidence &&
    !progress.deep_evidence_plan
  ) {
    console.info("[delivery/segment] legacy checkpoint: evidence_done with narrative — skip to mark", {
      key,
    });
    progress = { ...progress, phase: "narrative_done" };
  }

  // --- evidence_done → narrative compress fill → narrative_done ---
  if (progress.phase === "evidence_done") {
    if (input.shouldYield()) {
      return {
        ok: true,
        done: false,
        progress,
        tokens_used: progress.tokens_used,
        yield_for_soft_wall: true,
      };
    }
    const fillTimeoutMs = phaseTimeout(120_000);
    const hasPlan = Boolean(progress.deep_evidence_plan) && !isTransition;
    const filled = await runPageSchemaFill({
      key,
      finalize: input.finalize,
      locale: input.locale,
      session_id: input.session_id,
      signal: input.signal,
      timeout_ms: fillTimeoutMs,
      thinking_effort: segmentFillThinkingEffort(key),
      action_brief: input.action_brief,
      week_summary: input.week_summary,
      primary_backup_hint: input.primary_backup_hint,
      dashboard_score_hints: input.dashboard_score_hints,
      question_expectation: input.question_expectation,
      eastern_calc_slice: input.eastern_calc_slice,
      risk_calc_slice: input.risk_calc_slice,
      page_plan_slice: input.page_plan_slice,
      reality_constraints: input.reality_constraints,
      prior_chart_anchors: input.prior_chart_anchors,
      category_token_sets: input.category_token_sets,
      structured_inventory: input.structured_inventory,
      fill_mode: hasPlan ? "compress" : "full",
      deep_evidence_plan: progress.deep_evidence_plan ?? null,
    });
    if (!filled.ok) {
      const priorYields = progress.fill_yield_count ?? 0;
      const remainingMs =
        input.invokeHardDeadlineMs - (Date.now() - input.invocationStartedAt);
      if (input.shouldYield() && priorYields < FILL_YIELD_BEFORE_NARRATIVE) {
        const nextYield = priorYields + 1;
        console.warn("[delivery/segment] page_schema fill failed — yield before narrative fallback", {
          key,
          reason: filled.reason,
          fill_yield_count: nextYield,
          timeout_ms: fillTimeoutMs,
          remaining_ms: remainingMs,
        });
        return {
          ok: true,
          done: false,
          progress: {
            ...progress,
            fill_yield_count: nextYield,
            tokens_used: progress.tokens_used + filled.tokens_used,
          },
          tokens_used: progress.tokens_used + filled.tokens_used,
          yield_for_soft_wall: true,
        };
      }
      console.warn("[delivery/segment] page_schema fill failed — narrative fallback", {
        key,
        reason: filled.reason,
        fill_yield_count: priorYields,
        forced_after_yields: priorYields >= FILL_YIELD_BEFORE_NARRATIVE,
        timeout_ms: fillTimeoutMs,
        remaining_ms: remainingMs,
      });
      // Architecture downgrade (compress/full fill → narrative), not effort step-down.
      logEffortDowngrade({
        session_id: input.session_id,
        call_site: "compress_fill_to_narrative_fallback",
        key,
        from_effort: "high",
        to_effort: "high",
        reason: filled.reason,
        attempt: priorYields + 1,
        elapsed_ms: Date.now() - input.invocationStartedAt,
        timeout_ms_used: fillTimeoutMs,
      });
      const narr = await runNarrativeTask(
        input.task,
        input.finalize,
        input.session_id,
        input.signal,
        input.breakthrough_core,
      );
      if (!narr.ok) {
        return {
          ok: false,
          reason: `page_schema:${filled.reason}|narrative:${narr.reason}`,
          tokens_used: progress.tokens_used + filled.tokens_used + narr.tokens_used,
          progress,
        };
      }
      // Fallback path still needs evidence — use deep plan if any, else runEvidenceTask later via legacy
      progress = {
        ...progress,
        phase: "narrative_done",
        narrative: narr.value,
        scan: narr.scan ?? null,
        gantt: narr.gantt ?? null,
        fill_yield_count: 0,
        tokens_used: progress.tokens_used + filled.tokens_used + narr.tokens_used,
      };
      if (progress.deep_evidence_plan) {
        progress = {
          ...progress,
          evidence: evidenceTreeFromAligned(
            key,
            progress.deep_evidence_plan.units.map((u: { evidence: string }) => u.evidence),
          ),
        };
      }
    } else {
      let page = filled.page;
      let evidenceTree: DeliveryArgumentTree = progress.evidence ?? {};
      if (progress.deep_evidence_plan) {
        const aligned = alignDeepEvidenceToPage(key, page, progress.deep_evidence_plan);
        page = aligned.page;
        evidenceTree = evidenceTreeFromAligned(key, aligned.evidenceByBodyIndex);
        const coverage = countEvidenceCoverage(
          pageSchemaToArgumentTree(key, page),
          evidenceTree,
          key,
        );
        if (coverage.missingIndexes.length > 0) {
          console.warn("[delivery/deep-evidence] coverage gaps after align", {
            key,
            missingIndexes: coverage.missingIndexes,
          });
        }
      }
      const tree = pageSchemaToArgumentTree(key, page);
      progress = {
        ...progress,
        phase: "narrative_done",
        narrative: tree,
        page_schema: page,
        evidence: evidenceTree,
        scan: null,
        gantt: null,
        fill_yield_count: 0,
        tokens_used: progress.tokens_used + filled.tokens_used,
      };
    }
  }

  // --- narrative_done → mark (Batch 3; was evidence_done → mark) ---
  if (progress.phase === "narrative_done") {
    // If still no evidence (fallback narrative without plan), run classic evidence once.
    if (
      !isTransition &&
      !(progress.evidence?.[key]?.some((a) => (a.evidence ?? "").trim()))
    ) {
      if (input.shouldYield()) {
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
        phaseTimeout(200_000),
      );
      if (!ev.ok) {
        return {
          ok: false,
          reason: `evidence:${ev.reason}`,
          tokens_used: progress.tokens_used + ev.tokens_used,
          progress,
        };
      }
      const coverage = countEvidenceCoverage(
        progress.narrative ?? {},
        ev.value,
        key,
      );
      if (coverage.missingIndexes.length > 0) {
        return {
          ok: false,
          reason: `evidence_coverage:${key}:missing=${coverage.missingIndexes.join(",")}`,
          tokens_used: progress.tokens_used + ev.tokens_used,
          progress,
        };
      }
      progress = {
        ...progress,
        evidence: ev.value,
        tokens_used: progress.tokens_used + ev.tokens_used,
      };
    }

    if (isTransition) {
      progress = {
        ...progress,
        phase: "mark_done",
        marked: {},
      };
    } else {
      if (input.shouldYield()) {
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
          timeout_ms: phaseTimeout(200_000),
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
      const marked: DeliveryArgumentTree = {};
      for (const [k, args] of Object.entries(mark.value)) {
        marked[k as DeliverySegmentKey] = (args ?? []).map((a) => ({
          body: a.body,
          evidence: a.evidence
            ? (() => {
                try {
                  return encodeConnectiveEvidenceToTerms(a.evidence, input.locale);
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
    const needsTranslate = !input.locale.startsWith("zh");
    if (needsTranslate && input.shouldYield()) {
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
    let scan = progress.scan ? localizePageScanCardLabels(progress.scan, "zh") : null;
    let gantt = progress.gantt ? localizeThirtyDayGanttLabels(progress.gantt, "zh") : null;
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
      let scanTokens = 0;
      if (scan) {
        const scanTr = await translatePageScanCard(scan, input.locale, {
          session_id: input.session_id,
          signal: input.signal,
        });
        scan = scanTr.scan;
        scanTokens = scanTr.tokens_used;
      }
      let ganttTokens = 0;
      if (gantt) {
        const ganttTr = await translateThirtyDayGantt(gantt, input.locale, {
          session_id: input.session_id,
          signal: input.signal,
        });
        gantt = ganttTr.gantt;
        ganttTokens = ganttTr.tokens_used;
      }
      progress = {
        ...progress,
        narrative,
        marked,
        scan,
        gantt,
        tokens_used: progress.tokens_used + tr.tokens_used + scanTokens + ganttTokens,
      };
    } else {
      if (scan) scan = localizePageScanCardLabels(scan, input.locale);
      if (gantt) gantt = localizeThirtyDayGanttLabels(gantt, input.locale);
    }

    const ready = buildReady(
      key,
      input.locale,
      narrative,
      marked,
      input.breakthrough_core,
      scan,
      gantt,
      progress.page_schema,
    );
    progress = {
      ...progress,
      phase: "done",
      narrative,
      marked,
      scan,
      gantt,
      page_schema: progress.page_schema,
    };
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
