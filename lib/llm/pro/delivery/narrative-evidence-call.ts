import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import {
  DELIVERY_SEGMENT_KEYS,
  mergeDeliveryTextTrees,
  type DeliveryComputed,
  type DeliverySegmentKey,
  type DeliveryTextTree,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_TASKS, type DeliveryTask } from "@/lib/llm/pro/delivery/delivery-tasks";
import {
  buildDeliveryNarrativePrompt,
  pickDeliveryConclusions,
} from "@/lib/llm/pro/delivery/narrative-prompt";
import {
  buildDeliveryEvidencePrompt,
  pickDeliverySegments,
} from "@/lib/llm/pro/delivery/evidence-prompt";
import {
  degradeMarkersToPlain,
  prepareBodyTextForGlossaryRender,
} from "@/lib/llm/sanitize/compliance-terms";
import {
  backfillZeroAnchorSegment,
  forceRemarkAndFallback,
  polishEvidenceSegment,
} from "@/lib/base-analysis-v2/evidence/evidence-call";
import { DELIVERY_TRANSITION_KEYS } from "@/lib/llm/pro/delivery/sanitize-delivery-book";

export type WriteOutcome =
  | { ok: true; value: DeliveryTextTree; attempts: number; tokens_used: number }
  | { ok: false; reason: string; attempts: number; tokens_used: number };

const HARD_MAX = 3;

function asTextTree(parsed: unknown, paths: readonly DeliverySegmentKey[]): DeliveryTextTree {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const o = parsed as Record<string, unknown>;
  const out: DeliveryTextTree = {};
  for (const k of paths) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

async function runWriteTask(
  kind: "narrative" | "evidence",
  task: DeliveryTask,
  dc: DeliveryComputed,
  session_id?: string,
): Promise<{ ok: true; value: DeliveryTextTree; attempts: number; tokens_used: number } | { ok: false; reason: string; attempts: number; tokens_used: number }> {
  const paths =
    kind === "evidence"
      ? task.paths.filter((k) => !DELIVERY_TRANSITION_KEYS.has(k))
      : task.paths;
  if (paths.length === 0) {
    return { ok: true, value: {}, attempts: 1, tokens_used: 0 };
  }
  const { system, user } =
    kind === "narrative"
      ? buildDeliveryNarrativePrompt(pickDeliveryConclusions(dc, paths), "zh")
      : buildDeliveryEvidencePrompt(pickDeliverySegments(dc, paths), "zh");

  let lastReason = "unknown";
  let tokens_used = 0;

  for (let attempt = 1; attempt <= HARD_MAX; attempt++) {
    try {
      const result = await callLLM({
        call_type: "main_delivery",
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: 8_000,
        thinking_effort: "high",
        timeout_ms: 120_000,
        response_format: "text",
        session_id,
        temperature: 0.5,
      });
      tokens_used += result.meta.tokens_used;
      const text = result.content?.trim() ?? "";
      if (!text) {
        lastReason = "empty_response";
        continue;
      }
      let parsed: unknown;
      try {
        parsed = extractJson(text);
      } catch {
        lastReason = "json_parse_failed";
        continue;
      }
      return { ok: true, value: asTextTree(parsed, paths), attempts: attempt, tokens_used };
    } catch (e) {
      lastReason = `call_error:${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { ok: false, reason: lastReason, attempts: HARD_MAX, tokens_used };
}

function fillNarrativeFromCompute(
  tree: DeliveryTextTree,
  dc: DeliveryComputed,
): DeliveryTextTree {
  const out: DeliveryTextTree = { ...tree };
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (!out[k]?.trim()) {
      out[k] = dc[k].core_conclusion;
    }
  }
  return out;
}

function fillEvidenceFromCompute(
  tree: DeliveryTextTree,
  dc: DeliveryComputed,
  locale: string,
): DeliveryTextTree {
  const out: DeliveryTextTree = { ...tree };
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (DELIVERY_TRANSITION_KEYS.has(k)) {
      delete out[k];
      continue;
    }
    if (out[k]?.trim()) continue;
    const basis = dc[k].bazi_basis;
    if (basis.length === 0) continue;
    // Base v2 style: short prose + marked anchors — never "；" skeleton
    out[k] = backfillZeroAnchorSegment(
      locale.startsWith("zh") ? "本段判断的承重点：" : "Load-bearing anchors for this section:",
      [...basis],
      locale,
    );
  }
  return out;
}

/** Align evidence with base v2: mark-not-delete polish. */
function polishEvidenceTree(tree: DeliveryTextTree, dc: DeliveryComputed, locale: string): DeliveryTextTree {
  const out: DeliveryTextTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (DELIVERY_TRANSITION_KEYS.has(k)) continue;
    let t = tree[k]?.trim() ?? "";
    if (!t) continue;
    t = backfillZeroAnchorSegment(t, [...(dc[k]?.bazi_basis ?? [])], locale);
    t = polishEvidenceSegment(t, locale);
    if (!/⟦t:/.test(t) || /；\s*；/.test(t)) {
      t = forceRemarkAndFallback(t, locale);
    }
    out[k] = t;
  }
  return out;
}

/** Strip accidental markers from narrative bodies (zero gold in prose). */
function polishNarrativeTree(tree: DeliveryTextTree, locale: string): DeliveryTextTree {
  const out: DeliveryTextTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const t = tree[k];
    if (!t) continue;
    const plain = /⟦t:/.test(t) ? degradeMarkersToPlain(t, locale) : t;
    out[k] = prepareBodyTextForGlossaryRender(plain, locale);
  }
  return out;
}

export async function runDeliveryNarrative(
  dc: DeliveryComputed,
  locale: string,
  opts?: { session_id?: string },
): Promise<WriteOutcome> {
  const results = await Promise.all(
    DELIVERY_TASKS.map((t) => runWriteTask("narrative", t, dc, opts?.session_id)),
  );
  const tokens_used = results.reduce((s, r) => s + r.tokens_used, 0);
  if (results.every((r) => !r.ok)) {
    return {
      ok: false,
      reason: results.map((r) => (!r.ok ? r.reason : "")).join(";"),
      attempts: HARD_MAX,
      tokens_used,
    };
  }
  const trees = results.filter((r) => r.ok).map((r) => (r.ok ? r.value : {}));
  const merged = mergeDeliveryTextTrees(trees);
  const filled = fillNarrativeFromCompute(merged, dc);
  const polished = polishNarrativeTree(filled, locale);
  return {
    ok: true,
    value: polished,
    attempts: Math.max(...results.map((r) => r.attempts), 1),
    tokens_used,
  };
}

export async function runDeliveryEvidence(
  dc: DeliveryComputed,
  locale: string,
  opts?: { session_id?: string },
): Promise<WriteOutcome> {
  const results = await Promise.all(
    DELIVERY_TASKS.map((t) => runWriteTask("evidence", t, dc, opts?.session_id)),
  );
  const tokens_used = results.reduce((s, r) => s + r.tokens_used, 0);
  if (results.every((r) => !r.ok)) {
    return {
      ok: false,
      reason: results.map((r) => (!r.ok ? r.reason : "")).join(";"),
      attempts: HARD_MAX,
      tokens_used,
    };
  }
  const trees = results.filter((r) => r.ok).map((r) => (r.ok ? r.value : {}));
  const merged = mergeDeliveryTextTrees(trees);
  const filled = fillEvidenceFromCompute(merged, dc, locale);
  const polished = polishEvidenceTree(filled, dc, locale);
  return {
    ok: true,
    value: polished,
    attempts: Math.max(...results.map((r) => r.attempts), 1),
    tokens_used,
  };
}
