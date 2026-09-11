import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_TRANSITION_KEYS,
  LEGACY_SEGMENT_TO_CURRENT,
  coerceDeliveryArguments,
  mergeDeliveryArgumentTrees,
  zipArgumentEvidence,
  type DeliveryArgumentTree,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  chunkDeliveryArgPayload,
  DELIVERY_MARK_ARGS_PER_CALL,
  DELIVERY_MARK_TIMEOUT_MS,
  DELIVERY_WRITE_MAX_TOKENS,
  resolveDeliveryMarkEffort,
  type DeliveryTask,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import {
  findMingliChengyuOutsideSlots,
  findConnectiveShortJargonOutsideSlots,
  hasAdjacentWordSlotsWithoutVernacular,
  hasExcessTermStackInClause,
  pickMarkEvidenceInput,
  resolveDeliveryMarkMode,
  repairExcessTermStacks,
  repairMarkConnectivePlainJargon,
  type DeliveryMarkMode,
  type MarkEvidenceArgInput,
  type MarkEvidenceContext,
  buildMarkEvidencePrompt,
} from "@/lib/llm/pro/delivery/mark-evidence-prompt";
import {
  countEvidenceWordSlots,
  encodeConnectiveEvidenceToTerms,
  polishMarkedEvidenceText,
  previewSoftEvidenceForMark,
  repairAdjacentWordSlotGaps,
  reinjectDroppedWordSlots,
  stripTemplateLeakPhrases,
  findTemplateLeakPhrase,
  findToxicPadPhrase,
} from "@/lib/llm/pro/delivery/polish-marked-evidence";
import { assertEvidenceRemnantClean } from "@/lib/llm/pro/delivery/evidence-remnant-gate";
import {
  deliveryAppMaxAttempts,
  deliveryTransportMaxAttempts,
  DELIVERY_GEN_ATTEMPTS_MAX,
} from "@/lib/llm/pro/delivery/delivery-retry-policy";

export type MarkOutcome =
  | { ok: true; value: DeliveryArgumentTree; attempts: number; tokens_used: number; mode: DeliveryMarkMode }
  | { ok: false; reason: string; attempts: number; tokens_used: number; mode: DeliveryMarkMode };

const HARD_MAX = deliveryAppMaxAttempts();
/** Slot-drop / pure-vernacular: fixed 1+1 — never Math.max(..., 3). */
const MARK_SLOT_MAX_ATTEMPTS = DELIVERY_GEN_ATTEMPTS_MAX;

export {
  countEvidenceWordSlots,
  encodeConnectiveEvidenceToTerms,
  polishMarkedEvidenceText,
  resolveDeliveryMarkMode,
};
export type { DeliveryMarkMode, MarkEvidenceContext };

type ChunkOutcome =
  | {
      ok: true;
      value: DeliveryArgumentTree;
      attempts: number;
      tokens_used: number;
    }
  | {
      ok: true;
      needs_more_mark_chunks: true;
      /** Connective-stage partials (not yet zipped/encoded). */
      partial: DeliveryArgumentTree;
      next_chunk_index: number;
      chunks_total: number;
      attempts: number;
      tokens_used: number;
    }
  | { ok: false; reason: string; attempts: number; tokens_used: number };

/**
 * Parse mark/translate JSON per prompt contract:
 *   `{ "arguments": [ { "evidence": "..." }, ... ] }`
 * Segment key is known from the task (`paths`); do not require it in the JSON.
 * Keyed `{ energy: { arguments: [...] } }` is accepted only as a defensive fallback.
 */
export function asMarkArgumentTree(
  parsed: unknown,
  paths: readonly DeliverySegmentKey[],
): DeliveryArgumentTree {
  if (!parsed || typeof parsed !== "object") return {};
  const out: DeliveryArgumentTree = {};

  // Primary: prompt format — bare { arguments: [...] } (or a raw array).
  if (paths.length === 1) {
    const k = paths[0]!;
    const o = Array.isArray(parsed) ? null : (parsed as Record<string, unknown>);
    const bare = coerceDeliveryArguments(
      Array.isArray(parsed) ? parsed : Array.isArray(o?.arguments) ? o!.arguments : null,
    );
    if (bare.length > 0) {
      out[k] = bare.map((a) => ({
        body: a.body,
        // Never treat narrative body as marked evidence.
        evidence: (a.evidence ?? "").trim() || undefined,
      }));
      return out;
    }
  }

  // Fallback: model wrapped with segment key (or legacy alias) anyway.
  if (!Array.isArray(parsed)) {
    const o = parsed as Record<string, unknown>;
    for (const k of paths) {
      let args = coerceDeliveryArguments(o[k]);
      if (args.length === 0) {
        for (const [legacy, cur] of Object.entries(LEGACY_SEGMENT_TO_CURRENT)) {
          if (cur === k) {
            args = coerceDeliveryArguments(o[legacy]);
            if (args.length > 0) break;
          }
        }
      }
      if (args.length > 0) {
        out[k] = args.map((a) => ({
          body: a.body,
          evidence: (a.evidence ?? "").trim() || undefined,
        }));
      }
    }
  }
  return out;
}

function asArgumentTree(
  parsed: unknown,
  paths: readonly DeliverySegmentKey[],
): DeliveryArgumentTree {
  return asMarkArgumentTree(parsed, paths);
}

function scopeZipped(
  rawEvidence: DeliveryArgumentTree,
  markedDense: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
): DeliveryArgumentTree {
  // markedDense only has non-empty-evidence slots (pickMarkEvidenceInput filtered).
  // Scatter back onto raw length so seal slots stay empty.
  const scoped: DeliveryArgumentTree = {};
  for (const k of paths) {
    const rawArgs = rawEvidence[k] ?? [];
    if (rawArgs.length === 0) continue;
    const dense = markedDense[k] ?? [];
    let mi = 0;
    scoped[k] = rawArgs.map((b) => {
      const had = (b.evidence ?? "").trim();
      if (!had) {
        return {
          body: b.body,
          evidence: "",
          ...(b.chart_anchors?.length ? { chart_anchors: b.chart_anchors } : {}),
        };
      }
      const m = dense[mi++];
      return {
        body: b.body,
        evidence: (m?.evidence ?? m?.body ?? "").trim() || undefined,
        ...(b.chart_anchors?.length ? { chart_anchors: b.chart_anchors } : {}),
      };
    });
  }
  return scoped;
}

function mergeChunkArgumentTrees(trees: DeliveryArgumentTree[]): DeliveryArgumentTree {
  const out: DeliveryArgumentTree = {};
  for (const t of trees) {
    for (const k of DELIVERY_SEGMENT_KEYS) {
      if (!t[k]?.length) continue;
      out[k] = [...(out[k] ?? []), ...t[k]!];
    }
  }
  return out;
}

/**
 * Gate: non-empty connective evidence must keep ≥2 `⟦w:…⟧` slots (and not drop
 * below the input slot count). Pure vernacular with markers deleted = reject.
 * Also reject 命理四字格 / short jargon / adjacent golds without Han connective.
 *
 * Known short jargon (plain-fallback map) is repaired locally before fail —
 * avoids a full LLM mark retry for 忌神/用神/十神等已覆盖词.
 */
export function validateConnectiveWordSlots(
  inputEvidence: string,
  outputEvidence: string,
  locale = "zh",
):
  | { ok: true; evidence: string; auto_repaired?: string[] }
  | { ok: false; reason: string; evidence: string } {
  const input = inputEvidence.trim();
  const rawOut = outputEvidence.trim();
  // Toxic L383 pads are failure signals — never strip-repair into "success".
  const toxic = findToxicPadPhrase(rawOut);
  if (toxic) {
    return { ok: false, reason: `mark_template_leak:${toxic}`, evidence: rawOut };
  }
  // Auto-strip known legacy template pads before gates.
  let output = stripTemplateLeakPhrases(rawOut);
  // Strip may leave thin gaps between ⟦w:⟧ — pad locally before hard-fail.
  output = repairAdjacentWordSlotGaps(output);
  // Model often drops 1–2 of N slots (P6 mark_slots_dropped:2/4…) — reinject
  // missing ⟦w:⟧ from input instead of burning another 60–90s LLM retry.
  const reinjected = reinjectDroppedWordSlots(input, output);
  if (reinjected.reinjected.length > 0) {
    output = reinjected.text;
    console.info("[delivery/mark] reinjected dropped word-slots", {
      count: reinjected.reinjected.length,
      sample: reinjected.reinjected.slice(0, 6),
    });
  }
  if (!input) {
    return output
      ? { ok: false, reason: "mark_filled_empty_input", evidence: output }
      : { ok: true, evidence: output };
  }
  if (!output) return { ok: false, reason: "mark_empty_output", evidence: "" };

  // Residual leak after strip (should be rare) → hard fail for LLM rewrite.
  const leakEarly = findTemplateLeakPhrase(output);
  if (leakEarly) {
    return { ok: false, reason: `mark_template_leak:${leakEarly}`, evidence: output };
  }

  const inSlots = countEvidenceWordSlots(input);
  const outSlots = countEvidenceWordSlots(output);
  const minRequired = Math.min(2, Math.max(inSlots, 0));
  // User rule: fewer than 2 slots → regenerate (when input had material to keep).
  if (inSlots >= 2 && outSlots < 2) {
    return { ok: false, reason: `mark_slots_lt2:${outSlots}`, evidence: output };
  }
  if (inSlots > 0 && outSlots < minRequired) {
    return { ok: false, reason: `mark_slots_lt_input:${outSlots}/${inSlots}`, evidence: output };
  }
  if (inSlots >= 2 && outSlots < inSlots) {
    return { ok: false, reason: `mark_slots_dropped:${outSlots}/${inSlots}`, evidence: output };
  }

  if (outSlots >= 2 && hasAdjacentWordSlotsWithoutVernacular(output)) {
    return { ok: false, reason: "mark_adjacent_gold", evidence: output };
  }
  if (hasExcessTermStackInClause(output)) {
    const destacked = repairExcessTermStacks(output);
    if (!hasExcessTermStackInClause(destacked)) {
      console.info("[delivery/mark] repaired excess term stacks locally");
      output = destacked;
    } else {
      return { ok: false, reason: "mark_term_stack", evidence: output };
    }
  }

  const chengyu = findMingliChengyuOutsideSlots(output);
  if (chengyu) {
    return { ok: false, reason: `mark_mingli_chengyu:${chengyu}`, evidence: output };
  }

  const local = repairMarkConnectivePlainJargon(output);
  let text = local.text;
  if (local.repaired_terms.length > 0) {
    // Re-check structural gates after local rewrite (slots must still hold).
    if (countEvidenceWordSlots(text) < outSlots) {
      return {
        ok: false,
        reason: `mark_plain_jargon_repair_ate_slots:${local.repaired_terms.join(",")}`,
        evidence: output,
      };
    }
    if (outSlots >= 2 && hasAdjacentWordSlotsWithoutVernacular(text)) {
      return { ok: false, reason: "mark_adjacent_gold", evidence: text };
    }
    if (hasExcessTermStackInClause(text)) {
      const destacked = repairExcessTermStacks(text);
      if (!hasExcessTermStackInClause(destacked)) {
        console.info("[delivery/mark] repaired excess term stacks after jargon");
        text = destacked;
      } else {
        return { ok: false, reason: "mark_term_stack", evidence: text };
      }
    }
    const chengyuAfter = findMingliChengyuOutsideSlots(text);
    if (chengyuAfter) {
      return { ok: false, reason: `mark_mingli_chengyu:${chengyuAfter}`, evidence: text };
    }
  }

  const shortJargon = findConnectiveShortJargonOutsideSlots(text);
  if (shortJargon) {
    return { ok: false, reason: `mark_plain_jargon:${shortJargon}`, evidence: text };
  }

  // Batch1 D: soft-preview readability (encode → soft adjacency / glue / leak)
  const preview = previewSoftEvidenceForMark(text, locale);
  if (!preview.ok) {
    return { ok: false, reason: preview.reason, evidence: text };
  }

  // §3.3 remnant gate on connective text (【】 / toxic pad×2) — before encode.
  const remnant = assertEvidenceRemnantClean(text);
  if (!remnant.ok) {
    return { ok: false, reason: remnant.reason, evidence: text };
  }
  const remnantEncoded = assertEvidenceRemnantClean(preview.text, {
    ban_word_slots: true,
  });
  if (!remnantEncoded.ok) {
    return { ok: false, reason: remnantEncoded.reason, evidence: text };
  }

  return local.repaired_terms.length > 0
    ? { ok: true, evidence: text, auto_repaired: local.repaired_terms }
    : { ok: true, evidence: text };
}

async function callEvidenceTransform(input: {
  system: string;
  user: string;
  session_id?: string;
  signal?: AbortSignal;
  timeout_ms?: number;
}): Promise<{ ok: true; parsed: unknown; tokens_used: number } | { ok: false; reason: string; tokens_used: number }> {
  let lastReason = "unknown";
  let tokens_used = 0;
  // Single app attempt here — slot-drop retries live in runMarkChunksCombined.
  const maxAttempts = Math.max(HARD_MAX, 1);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (input.signal?.aborted) {
      return { ok: false, reason: "aborted", tokens_used };
    }
    try {
      const result = await callLLM({
        call_type: "main_delivery",
        system: input.system,
        messages: [{ role: "user", content: input.user }],
        max_tokens: DELIVERY_WRITE_MAX_TOKENS,
        thinking_effort: resolveDeliveryMarkEffort(),
        timeout_ms: input.timeout_ms ?? DELIVERY_MARK_TIMEOUT_MS,
        response_format: "text",
        session_id: input.session_id,
        temperature: 0.3,
        max_attempts: deliveryTransportMaxAttempts(),
        signal: input.signal,
      });
      tokens_used += result.meta.tokens_used;
      const finish = result.meta.finish_reason ?? null;
      if (finish === "cancelled") {
        lastReason = "finish_cancelled";
        console.warn("[delivery/mark] finish_reason=cancelled — discard partial", {
          attempt,
          completion_tokens: result.meta.completion_tokens ?? null,
          generation_id: result.meta.generation_id ?? null,
          timeout_ms: input.timeout_ms ?? DELIVERY_MARK_TIMEOUT_MS,
        });
        continue;
      }
      const text = result.content?.trim() ?? "";
      if (!text) {
        lastReason = "empty_response";
        continue;
      }
      try {
        return { ok: true, parsed: extractJson(text), tokens_used };
      } catch {
        lastReason = "json_parse_failed";
        console.warn("[delivery/mark] json_parse_failed", {
          chars: text.length,
          head: text.slice(0, 160),
          attempt,
        });
      }
    } catch (e) {
      if (input.signal?.aborted || (e instanceof Error && e.name === "AbortError")) {
        return { ok: false, reason: "aborted", tokens_used };
      }
      lastReason = `call_error:${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { ok: false, reason: lastReason, tokens_used };
}

/**
 * One mark LLM call for a single arg-chunk. Caller soft-walls between chunks.
 */
async function runOneMarkArgChunk(
  chunk: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  locale: string,
  ctx: MarkEvidenceContext | undefined,
  session_id?: string,
  signal?: AbortSignal,
  timeout_ms?: number,
): Promise<
  | { ok: true; value: DeliveryArgumentTree; attempts: number; tokens_used: number }
  | { ok: false; reason: string; attempts: number; tokens_used: number }
> {
  const chunkPaths = Object.keys(chunk) as DeliverySegmentKey[];
  const { system, user } = buildMarkEvidencePrompt(chunk, locale, ctx);

  let lastReason = "unknown";
  let tokens_used = 0;
  let chunkAttempts = 0;

  for (let attempt = 1; attempt <= MARK_SLOT_MAX_ATTEMPTS; attempt++) {
    chunkAttempts = attempt;
    if (signal?.aborted) {
      return { ok: false, reason: "aborted", attempts: chunkAttempts, tokens_used };
    }
    const called = await callEvidenceTransform({ system, user, session_id, signal, timeout_ms });
    tokens_used += called.tokens_used;
    if (!called.ok) {
      lastReason = called.reason;
      continue;
    }
    const marked = asMarkArgumentTree(called.parsed, chunkPaths);
    const trimmed: DeliveryArgumentTree = {};
    let gateFail: string | null = null;

    for (const k of chunkPaths) {
      const n = chunk[k]?.arguments.length ?? 0;
      const args = marked[k] ?? [];
      if (args.length < n) {
        gateFail = `mark_incomplete:${k}:${args.length}/${n}`;
        break;
      }
      const sliced = args.slice(0, n);
      for (let i = 0; i < n; i++) {
        const inputEv = chunk[k]!.arguments[i]?.evidence ?? "";
        let outputEv = sliced[i]?.evidence ?? "";
        outputEv = repairAdjacentWordSlotGaps(outputEv);
        outputEv = stripTemplateLeakPhrases(outputEv);
        const gate = validateConnectiveWordSlots(inputEv, outputEv, locale);
        if (!gate.ok) {
          gateFail = `${gate.reason}:${k}:${i}`;
          break;
        }
        if (gate.auto_repaired?.length) {
          console.info("[delivery/mark] connective plain-jargon auto-repaired", {
            key: k,
            index: i,
            terms: gate.auto_repaired,
          });
        }
        sliced[i] = { ...sliced[i]!, evidence: gate.evidence };
      }
      if (gateFail) break;
      trimmed[k] = sliced;
    }

    if (gateFail) {
      lastReason = gateFail;
      console.warn("[delivery/mark] connective slot gate — retry", {
        reason: gateFail,
        attempt,
        max: MARK_SLOT_MAX_ATTEMPTS,
      });
      continue;
    }
    return { ok: true, value: trimmed, attempts: chunkAttempts, tokens_used };
  }
  return { ok: false, reason: lastReason, attempts: chunkAttempts, tokens_used };
}

async function runMarkChunksCombined(
  chunks: Array<Record<string, { arguments: MarkEvidenceArgInput[] }>>,
  rawEvidence: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
  locale: string,
  ctx: MarkEvidenceContext | undefined,
  session_id?: string,
  signal?: AbortSignal,
  timeout_ms?: number,
  opts?: {
    chunk_index?: number;
    prior_partial?: DeliveryArgumentTree;
  },
): Promise<ChunkOutcome> {
  if (chunks.length === 0) {
    return { ok: true, value: {}, attempts: 1, tokens_used: 0 };
  }
  const chunkIndex = Math.max(0, opts?.chunk_index ?? 0);
  if (chunkIndex >= chunks.length) {
    return { ok: false, reason: `mark_chunk_oob:${chunkIndex}/${chunks.length}`, attempts: 1, tokens_used: 0 };
  }

  const chunk = chunks[chunkIndex]!;
  console.info("[delivery/mark] dispatch one arg-chunk", {
    chunk: chunkIndex,
    chunks_total: chunks.length,
    paths: Object.keys(chunk),
  });

  const one = await runOneMarkArgChunk(chunk, locale, ctx, session_id, signal, timeout_ms);
  if (!one.ok) {
    return {
      ok: false,
      reason: one.reason,
      attempts: one.attempts,
      tokens_used: one.tokens_used,
    };
  }

  const mergedMarked = mergeChunkArgumentTrees([opts?.prior_partial ?? {}, one.value]);
  const next = chunkIndex + 1;
  if (next < chunks.length) {
    return {
      ok: true,
      needs_more_mark_chunks: true,
      partial: mergedMarked,
      next_chunk_index: next,
      chunks_total: chunks.length,
      attempts: one.attempts,
      tokens_used: one.tokens_used,
    };
  }

  const zipped = scopeZipped(rawEvidence, mergedMarked, paths);
  return {
    ok: true,
    value: encodeConnectiveTree(zipped, locale),
    attempts: one.attempts,
    tokens_used: one.tokens_used,
  };
}

/** `⟦w:真词⟧` connective → `⟦t:slug|…⟧` (no autoMark of vernacular). */
function encodeConnectiveTree(tree: DeliveryArgumentTree, locale: string): DeliveryArgumentTree {
  const out: DeliveryArgumentTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (DELIVERY_TRANSITION_KEYS.has(k)) continue;
    const args = tree[k];
    if (!args?.length) continue;
    out[k] = args.map((a) => {
      if (!a.evidence?.trim()) return { body: a.body, evidence: a.evidence };
      try {
        return {
          body: a.body,
          evidence: encodeConnectiveEvidenceToTerms(a.evidence, locale),
        };
      } catch {
        return { body: a.body, evidence: a.evidence };
      }
    });
  }
  return out;
}

/**
 * Connective on raw `⟦w:⟧` evidence → encode to `⟦t:⟧`.
 * (Previously code-marked to t: BEFORE mark — that polluted the connective model.)
 */
async function runMarkTaskCombined(
  task: DeliveryTask,
  rawEvidence: DeliveryArgumentTree,
  locale: string,
  ctx: MarkEvidenceContext | undefined,
  session_id?: string,
  signal?: AbortSignal,
  timeout_ms?: number,
  dispatch?: {
    chunk_index?: number;
    prior_partial?: DeliveryArgumentTree;
  },
): Promise<ChunkOutcome> {
  const paths = task.paths.filter((k) => !DELIVERY_TRANSITION_KEYS.has(k));
  const input = pickMarkEvidenceInput(rawEvidence, paths);
  if (Object.keys(input).length === 0) {
    return { ok: true, value: {}, attempts: 1, tokens_used: 0 };
  }
  const chunks = chunkDeliveryArgPayload(input, DELIVERY_MARK_ARGS_PER_CALL);
  return runMarkChunksCombined(
    chunks,
    rawEvidence,
    paths,
    locale,
    ctx,
    session_id,
    signal,
    timeout_ms,
    dispatch,
  );
}

/** @deprecated split ≡ combined under P2 (translate is separate). */
async function runMarkTaskSplit(
  task: DeliveryTask,
  rawEvidence: DeliveryArgumentTree,
  locale: string,
  ctx: MarkEvidenceContext | undefined,
  session_id?: string,
  signal?: AbortSignal,
  timeout_ms?: number,
  dispatch?: {
    chunk_index?: number;
    prior_partial?: DeliveryArgumentTree;
  },
): Promise<ChunkOutcome> {
  return runMarkTaskCombined(
    task,
    rawEvidence,
    locale,
    ctx,
    session_id,
    signal,
    timeout_ms,
    dispatch,
  );
}

/** Encode connective `⟦w:⟧` → `⟦t:⟧` after mark (no autoMark of vernacular). */
function polishMarkedTree(tree: DeliveryArgumentTree, locale: string): DeliveryArgumentTree {
  return encodeConnectiveTree(tree, locale);
}

/** Merge per-task marked trees (after KV fan-out) + polish. */
export function assembleDeliveryMark(
  trees: DeliveryArgumentTree[],
  rawEvidence: DeliveryArgumentTree,
  locale: string,
): DeliveryArgumentTree {
  const merged = mergeDeliveryArgumentTrees(
    trees.map((t) => {
      const o: Record<string, unknown> = {};
      for (const k of DELIVERY_SEGMENT_KEYS) {
        if (t[k]) o[k] = { arguments: t[k] };
      }
      return o;
    }),
  );
  const zipped = zipArgumentEvidence(rawEvidence, merged);
  const polished = polishMarkedTree(zipped, locale);

  let markerCount = 0;
  let contextualCount = 0;
  for (const k of DELIVERY_SEGMENT_KEYS) {
    for (const a of polished[k] ?? []) {
      const ev = a.evidence ?? "";
      const marks = ev.match(/⟦t:[^⟧]+⟧/g) ?? [];
      markerCount += marks.length;
      for (const m of marks) {
        const pipes = (m.match(/\|/g) || []).length;
        if (pipes >= 2) {
          const third = m.split("|").slice(2).join("|").replace(/⟧$/, "").trim();
          if (third.length > 6) contextualCount += 1;
        }
      }
    }
  }
  console.info("[delivery/mark] polish stats", { markerCount, contextualCount });
  return polished;
}

/**
 * How many mark LLM invokes a page needs (after pickMarkEvidenceInput filter).
 */
export function countMarkArgChunksForPaths(
  rawEvidence: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
): number {
  const filtered = paths.filter((k) => !DELIVERY_TRANSITION_KEYS.has(k));
  const input = pickMarkEvidenceInput(rawEvidence, filtered);
  if (Object.keys(input).length === 0) return 0;
  return chunkDeliveryArgPayload(input, DELIVERY_MARK_ARGS_PER_CALL).length;
}

/**
 * One mark arg-chunk only — connective partial, no encode.
 * DAG fans these out in parallel (stagger); mark_merge encodes.
 */
export async function runMarkDeliveryArgChunk(
  task: DeliveryTask,
  rawEvidence: DeliveryArgumentTree,
  locale: string,
  chunk_index: number,
  opts?: {
    session_id?: string;
    mode?: DeliveryMarkMode;
    original_question?: string | null;
    signal?: AbortSignal;
    timeout_ms?: number;
  },
): Promise<
  | {
      ok: true;
      partial: DeliveryArgumentTree;
      chunk_index: number;
      chunks_total: number;
      attempts: number;
      tokens_used: number;
      mode: DeliveryMarkMode;
    }
  | {
      ok: false;
      reason: string;
      attempts: number;
      tokens_used: number;
      mode: DeliveryMarkMode;
    }
> {
  const mode = opts?.mode ?? resolveDeliveryMarkMode();
  const ctx: MarkEvidenceContext = { original_question: opts?.original_question ?? null };
  const paths = task.paths.filter((k) => !DELIVERY_TRANSITION_KEYS.has(k));
  const input = pickMarkEvidenceInput(rawEvidence, paths);
  if (Object.keys(input).length === 0) {
    return {
      ok: true,
      partial: {},
      chunk_index: 0,
      chunks_total: 0,
      attempts: 1,
      tokens_used: 0,
      mode,
    };
  }
  const chunks = chunkDeliveryArgPayload(input, DELIVERY_MARK_ARGS_PER_CALL);
  if (chunk_index < 0 || chunk_index >= chunks.length) {
    return {
      ok: false,
      reason: `mark_chunk_oob:${chunk_index}/${chunks.length}`,
      attempts: 1,
      tokens_used: 0,
      mode,
    };
  }
  const chunk = chunks[chunk_index]!;
  console.info("[delivery/mark] dispatch one arg-chunk (fan-out)", {
    chunk: chunk_index,
    chunks_total: chunks.length,
    paths: Object.keys(chunk),
  });
  const one = await runOneMarkArgChunk(
    chunk,
    locale,
    ctx,
    opts?.session_id,
    opts?.signal,
    opts?.timeout_ms,
  );
  if (!one.ok) {
    return {
      ok: false,
      reason: one.reason,
      attempts: one.attempts,
      tokens_used: one.tokens_used,
      mode,
    };
  }
  return {
    ok: true,
    partial: one.value,
    chunk_index,
    chunks_total: chunks.length,
    attempts: one.attempts,
    tokens_used: one.tokens_used,
    mode,
  };
}

/**
 * Merge parallel mark chunk partials → zip onto narrative → encode ⟦t:⟧.
 */
export function mergeEncodeMarkArgPartials(
  rawEvidence: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
  partials: DeliveryArgumentTree[],
  locale: string,
): DeliveryArgumentTree {
  const filtered = paths.filter((k) => !DELIVERY_TRANSITION_KEYS.has(k));
  const mergedMarked = mergeChunkArgumentTrees(partials);
  const zipped = scopeZipped(rawEvidence, mergedMarked, filtered);
  return encodeConnectiveTree(zipped, locale);
}

/**
 * One mark task (打标 + 情景白话 + 连接) — stage-KV task relay runs this alone
 * so each continue gets a fresh 300s budget.
 * Multi arg-chunk pages: prefer DAG `mark_chunk` fan-out; this helper still
 * supports soft-wall `mark_chunk_index` + `mark_partial` for Lab.
 */
export async function runMarkDeliveryTask(
  task: DeliveryTask,
  rawEvidence: DeliveryArgumentTree,
  locale: string,
  opts?: {
    session_id?: string;
    mode?: DeliveryMarkMode;
    original_question?: string | null;
    signal?: AbortSignal;
    timeout_ms?: number;
    mark_chunk_index?: number;
    mark_partial?: DeliveryArgumentTree;
  },
): Promise<(ChunkOutcome & { mode: DeliveryMarkMode })> {
  const mode = opts?.mode ?? resolveDeliveryMarkMode();
  const ctx: MarkEvidenceContext = { original_question: opts?.original_question ?? null };
  const runner = mode === "split" ? runMarkTaskSplit : runMarkTaskCombined;
  const result = await runner(
    task,
    rawEvidence,
    locale,
    ctx,
    opts?.session_id,
    opts?.signal,
    opts?.timeout_ms,
    {
      chunk_index: opts?.mark_chunk_index,
      prior_partial: opts?.mark_partial,
    },
  );
  return { ...result, mode };
}

/**
 * Legacy packed mark across all pages — forbidden (xhigh × N in one 300s).
 * Production uses per-page `runMarkDeliveryTask` via stage-KV / DAG.
 */
export async function runMarkDeliveryEvidence(
  rawEvidence: DeliveryArgumentTree,
  locale: string,
  opts?: { session_id?: string; mode?: DeliveryMarkMode; original_question?: string | null },
): Promise<MarkOutcome> {
  const mode = opts?.mode ?? resolveDeliveryMarkMode();
  console.warn("[delivery/mark] packed all-pages mark refused — use dispatch", {
    mode,
    locale: locale.slice(0, 8),
    pages: Object.keys(rawEvidence).length,
  });
  return {
    ok: false,
    reason: "mark:packed_all_pages_forbidden_use_dispatch",
    attempts: 0,
    tokens_used: 0,
    mode,
  };
}
