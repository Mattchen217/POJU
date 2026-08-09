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
  DELIVERY_TASKS,
  DELIVERY_WRITE_MAX_TOKENS,
  resolveDeliveryMarkEffort,
  type DeliveryTask,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import {
  buildMarkEvidencePrompt,
  pickMarkEvidenceInput,
  resolveDeliveryMarkMode,
  type DeliveryMarkMode,
  type MarkEvidenceArgInput,
  type MarkEvidenceContext,
} from "@/lib/llm/pro/delivery/mark-evidence-prompt";
import { polishMarkedEvidenceText } from "@/lib/llm/pro/delivery/polish-marked-evidence";
import {
  deliveryAppMaxAttempts,
  deliveryTransportMaxAttempts,
} from "@/lib/llm/pro/delivery/delivery-retry-policy";

export type MarkOutcome =
  | { ok: true; value: DeliveryArgumentTree; attempts: number; tokens_used: number; mode: DeliveryMarkMode }
  | { ok: false; reason: string; attempts: number; tokens_used: number; mode: DeliveryMarkMode };

const HARD_MAX = deliveryAppMaxAttempts();

export { polishMarkedEvidenceText, resolveDeliveryMarkMode };
export type { DeliveryMarkMode, MarkEvidenceContext };

type ChunkOutcome =
  | { ok: true; value: DeliveryArgumentTree; attempts: number; tokens_used: number }
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
  marked: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
): DeliveryArgumentTree {
  const zipped = zipArgumentEvidence(rawEvidence, marked);
  const scoped: DeliveryArgumentTree = {};
  for (const k of paths) {
    if (zipped[k]) scoped[k] = zipped[k];
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

async function callEvidenceTransform(input: {
  system: string;
  user: string;
  session_id?: string;
  signal?: AbortSignal;
}): Promise<{ ok: true; parsed: unknown; tokens_used: number } | { ok: false; reason: string; tokens_used: number }> {
  let lastReason = "unknown";
  let tokens_used = 0;
  for (let attempt = 1; attempt <= HARD_MAX; attempt++) {
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
        timeout_ms: DELIVERY_MARK_TIMEOUT_MS,
        response_format: "text",
        session_id: input.session_id,
        temperature: 0.3,
        max_attempts: deliveryTransportMaxAttempts(),
        signal: input.signal,
      });
      tokens_used += result.meta.tokens_used;
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

/** Code-mark raw evidence before connective LLM (P1/P2). */
function codeMarkEvidenceTree(
  tree: DeliveryArgumentTree,
  locale: string,
): DeliveryArgumentTree {
  const out: DeliveryArgumentTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (DELIVERY_TRANSITION_KEYS.has(k)) continue;
    const args = tree[k];
    if (!args?.length) continue;
    out[k] = args.map((a) => ({
      body: a.body,
      evidence: a.evidence
        ? polishMarkedEvidenceText(a.evidence, locale)
        : a.evidence,
    }));
  }
  return out;
}

async function runMarkChunksCombined(
  chunks: Array<Record<string, { arguments: MarkEvidenceArgInput[] }>>,
  rawEvidence: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
  locale: string,
  ctx: MarkEvidenceContext | undefined,
  session_id?: string,
  signal?: AbortSignal,
): Promise<ChunkOutcome> {
  // Serial chunks inside a task — stage fan-out already runs ~5 segments concurrent.
  // Parallel chunks here would multiply in-flight LLM calls past DELIVERY_MARK_CONCURRENCY.
  const results: ChunkOutcome[] = [];
  let tokens_used = 0;
  for (const chunk of chunks) {
    if (signal?.aborted) {
      return { ok: false, reason: "aborted", attempts: 1, tokens_used };
    }
    const chunkPaths = Object.keys(chunk) as DeliverySegmentKey[];
    // Connective in delivery locale (zh or target language). Body translate is separate.
    const { system, user } = buildMarkEvidencePrompt(chunk, locale, ctx);
    const called = await callEvidenceTransform({ system, user, session_id, signal });
    tokens_used += called.tokens_used;
    if (!called.ok) {
      return {
        ok: false,
        reason: called.reason,
        attempts: HARD_MAX,
        tokens_used,
      };
    }
    const marked = asMarkArgumentTree(called.parsed, chunkPaths);
    const trimmed: DeliveryArgumentTree = {};
    for (const k of chunkPaths) {
      const n = chunk[k]?.arguments.length ?? 0;
      const args = marked[k] ?? [];
      if (args.length < n) {
        console.warn("[delivery/mark] incomplete after parse", {
          key: k,
          expected: n,
          got: args.length,
          parsed_keys:
            called.parsed && typeof called.parsed === "object" && !Array.isArray(called.parsed)
              ? Object.keys(called.parsed as object)
              : [],
        });
        return {
          ok: false,
          reason: `mark_incomplete:${k}:${args.length}/${n}`,
          attempts: HARD_MAX,
          tokens_used,
        };
      }
      trimmed[k] = args.slice(0, n);
    }
    results.push({
      ok: true,
      value: trimmed,
      attempts: 1,
      tokens_used: called.tokens_used,
    });
  }
  const mergedMarked = mergeChunkArgumentTrees(results.map((r) => (r.ok ? r.value : {})));
  return {
    ok: true,
    value: scopeZipped(rawEvidence, mergedMarked, paths),
    attempts: 1,
    tokens_used,
  };
}

/** Code-mark (locale soft) → connective LLM in delivery locale. Body translate is separate. */
async function runMarkTaskCombined(
  task: DeliveryTask,
  rawEvidence: DeliveryArgumentTree,
  locale: string,
  ctx: MarkEvidenceContext | undefined,
  session_id?: string,
  signal?: AbortSignal,
): Promise<ChunkOutcome> {
  const paths = task.paths.filter((k) => !DELIVERY_TRANSITION_KEYS.has(k));
  let coded: DeliveryArgumentTree;
  try {
    // Soft labels in markers must match delivery locale so mark can write native connective.
    coded = codeMarkEvidenceTree(rawEvidence, locale);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: msg, attempts: 1, tokens_used: 0 };
  }
  const input = pickMarkEvidenceInput(coded, paths);
  if (Object.keys(input).length === 0) {
    return { ok: true, value: {}, attempts: 1, tokens_used: 0 };
  }
  const chunks = chunkDeliveryArgPayload(input, DELIVERY_MARK_ARGS_PER_CALL);
  return runMarkChunksCombined(chunks, coded, paths, locale, ctx, session_id, signal);
}

/** @deprecated split ≡ combined under P2 (translate is separate). */
async function runMarkTaskSplit(
  task: DeliveryTask,
  rawEvidence: DeliveryArgumentTree,
  locale: string,
  ctx: MarkEvidenceContext | undefined,
  session_id?: string,
  signal?: AbortSignal,
): Promise<ChunkOutcome> {
  return runMarkTaskCombined(task, rawEvidence, locale, ctx, session_id, signal);
}

/** Safety-net polish after connective (slots should already be encoded). */
function polishMarkedTree(tree: DeliveryArgumentTree, locale: string): DeliveryArgumentTree {
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
          evidence: polishMarkedEvidenceText(a.evidence, locale),
        };
      } catch {
        // Connective output already marked — keep model text if re-encode fails.
        return { body: a.body, evidence: a.evidence };
      }
    });
  }
  return out;
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
 * One mark task (打标 + 情景白话 + 连接) — stage-KV task relay runs this alone
 * so each continue gets a fresh 300s budget.
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
  },
): Promise<ChunkOutcome & { mode: DeliveryMarkMode }> {
  const mode = opts?.mode ?? resolveDeliveryMarkMode();
  const ctx: MarkEvidenceContext = { original_question: opts?.original_question ?? null };
  const runner = mode === "split" ? runMarkTaskSplit : runMarkTaskCombined;
  const result = await runner(task, rawEvidence, locale, ctx, opts?.session_id, opts?.signal);
  return { ...result, mode };
}

/**
 * Mark + situational plain (+ foreign 意译) over raw 命理 evidence.
 * Default DELIVERY_MARK_MODE=combined; set `split` to degrade foreign into two calls.
 * Prefer stage-KV `runMarkDeliveryTask` in production (avoids 9× LLM in one 300s).
 */
export async function runMarkDeliveryEvidence(
  rawEvidence: DeliveryArgumentTree,
  locale: string,
  opts?: { session_id?: string; mode?: DeliveryMarkMode; original_question?: string | null },
): Promise<MarkOutcome> {
  const mode = opts?.mode ?? resolveDeliveryMarkMode();

  console.info("[delivery/mark]", {
    mode,
    locale: locale.slice(0, 8),
    has_question: Boolean(opts?.original_question?.trim()),
    max_tokens: DELIVERY_WRITE_MAX_TOKENS,
  });

  const results = await Promise.all(
    DELIVERY_TASKS.map((t) => runMarkDeliveryTask(t, rawEvidence, locale, opts)),
  );
  const tokens_used = results.reduce((s, r) => s + r.tokens_used, 0);
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    return {
      ok: false,
      reason: failed.map((r) => (!r.ok ? r.reason : "")).join(";"),
      attempts: HARD_MAX,
      tokens_used,
      mode,
    };
  }
  const trees = results.filter((r) => r.ok).map((r) => (r.ok ? r.value : {}));
  return {
    ok: true,
    value: assembleDeliveryMark(trees, rawEvidence, locale),
    attempts: Math.max(...results.map((r) => r.attempts), 1),
    tokens_used,
    mode,
  };
}
