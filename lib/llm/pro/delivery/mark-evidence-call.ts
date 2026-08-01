import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_TRANSITION_KEYS,
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
  type DeliveryTask,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import {
  buildMarkEvidencePrompt,
  buildMarkOnlyEvidencePrompt,
  buildTranslateEvidencePrompt,
  pickMarkEvidenceInput,
  pickMarkEvidenceOnly,
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
        evidence: a.evidence ?? a.body,
      }));
      return out;
    }
  }

  // Fallback: model wrapped with segment key anyway.
  if (!Array.isArray(parsed)) {
    const o = parsed as Record<string, unknown>;
    for (const k of paths) {
      const args = coerceDeliveryArguments(o[k]);
      if (args.length > 0) {
        out[k] = args.map((a) => ({
          body: a.body,
          evidence: a.evidence ?? a.body,
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
        thinking_effort: "high",
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

async function runMarkChunksCombined(
  chunks: Array<Record<string, { arguments: MarkEvidenceArgInput[] }>>,
  rawEvidence: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
  locale: string,
  ctx: MarkEvidenceContext | undefined,
  session_id?: string,
  signal?: AbortSignal,
): Promise<ChunkOutcome> {
  // Serial chunks — one LLM call at a time inside this task/continue (avoids 300s pile-up).
  const results: ChunkOutcome[] = [];
  for (const chunk of chunks) {
    if (signal?.aborted) {
      return { ok: false, reason: "aborted", attempts: 1, tokens_used: 0 };
    }
    const chunkPaths = Object.keys(chunk) as DeliverySegmentKey[];
    const { system, user } = buildMarkEvidencePrompt(chunk, locale, ctx);
    const called = await callEvidenceTransform({ system, user, session_id, signal });
    if (!called.ok) {
      results.push({
        ok: false,
        reason: called.reason,
        attempts: HARD_MAX,
        tokens_used: called.tokens_used,
      });
      break;
    }
    const marked = asMarkArgumentTree(called.parsed, chunkPaths);
    const trimmed: DeliveryArgumentTree = {};
    let incomplete: string | null = null;
    for (const k of chunkPaths) {
      const n = chunk[k]?.arguments.length ?? 0;
      const args = marked[k] ?? [];
      if (args.length < n) {
        incomplete = `mark_incomplete:${k}:${args.length}/${n}`;
        console.warn("[delivery/mark] incomplete after parse", {
          key: k,
          expected: n,
          got: args.length,
          parsed_keys:
            called.parsed && typeof called.parsed === "object" && !Array.isArray(called.parsed)
              ? Object.keys(called.parsed as object)
              : [],
        });
        break;
      }
      trimmed[k] = args.slice(0, n);
    }
    if (incomplete) {
      results.push({
        ok: false,
        reason: incomplete,
        attempts: HARD_MAX,
        tokens_used: called.tokens_used,
      });
      break;
    }
    results.push({
      ok: true,
      value: trimmed,
      attempts: 1,
      tokens_used: called.tokens_used,
    });
  }
  const tokens_used = results.reduce((s, r) => s + r.tokens_used, 0);
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0 || results.length < chunks.length) {
    return {
      ok: false,
      reason: failed.map((r) => (!r.ok ? r.reason : "")).join(";") || "mark_chunk_incomplete",
      attempts: HARD_MAX,
      tokens_used,
    };
  }
  const mergedMarked = mergeChunkArgumentTrees(results.map((r) => (r.ok ? r.value : {})));
  return {
    ok: true,
    value: scopeZipped(rawEvidence, mergedMarked, paths),
    attempts: 1,
    tokens_used,
  };
}

/** Combined: zh=mark+情景; foreign=意译+打标+情景 one call. */
async function runMarkTaskCombined(
  task: DeliveryTask,
  rawEvidence: DeliveryArgumentTree,
  locale: string,
  ctx: MarkEvidenceContext | undefined,
  session_id?: string,
  signal?: AbortSignal,
): Promise<ChunkOutcome> {
  const paths = task.paths.filter((k) => !DELIVERY_TRANSITION_KEYS.has(k));
  const input = pickMarkEvidenceInput(rawEvidence, paths);
  if (Object.keys(input).length === 0) {
    return { ok: true, value: {}, attempts: 1, tokens_used: 0 };
  }
  const chunks = chunkDeliveryArgPayload(input, DELIVERY_MARK_ARGS_PER_CALL);
  return runMarkChunksCombined(chunks, rawEvidence, paths, locale, ctx, session_id, signal);
}

/**
 * Split degradation (foreign): translate → mark-only+情景.
 * zh falls back to combined.
 */
async function runMarkTaskSplit(
  task: DeliveryTask,
  rawEvidence: DeliveryArgumentTree,
  locale: string,
  ctx: MarkEvidenceContext | undefined,
  session_id?: string,
  signal?: AbortSignal,
): Promise<ChunkOutcome> {
  if (locale.startsWith("zh")) {
    return runMarkTaskCombined(task, rawEvidence, locale, ctx, session_id, signal);
  }

  const paths = task.paths.filter((k) => !DELIVERY_TRANSITION_KEYS.has(k));
  const evidenceOnly = pickMarkEvidenceOnly(rawEvidence, paths);
  if (Object.keys(evidenceOnly).length === 0) {
    return { ok: true, value: {}, attempts: 1, tokens_used: 0 };
  }

  const chunks = chunkDeliveryArgPayload(evidenceOnly, DELIVERY_MARK_ARGS_PER_CALL);
  // Preserve arg offsets so parallel chunks zip against the correct raw rows.
  const cursor: Partial<Record<DeliverySegmentKey, number>> = {};
  const prepared = chunks.map((chunk) => {
    const chunkPaths = Object.keys(chunk) as DeliverySegmentKey[];
    const rawSlice: DeliveryArgumentTree = {};
    for (const k of chunkPaths) {
      const n = chunk[k]?.arguments.length ?? 0;
      const off = cursor[k] ?? 0;
      rawSlice[k] = (rawEvidence[k] ?? []).slice(off, off + n);
      cursor[k] = off + n;
    }
    return { chunk, chunkPaths, rawSlice };
  });

  const results = await Promise.all(
    prepared.map(async ({ chunk, chunkPaths, rawSlice }) => {
      const tr = buildTranslateEvidencePrompt(chunk, locale);
      const translated = await callEvidenceTransform({
        system: tr.system,
        user: tr.user,
        session_id,
        signal,
      });
      if (!translated.ok) {
        return {
          ok: false as const,
          reason: `translate:${translated.reason}`,
          attempts: HARD_MAX,
          tokens_used: translated.tokens_used,
        };
      }
      const midTree = scopeZipped(
        rawSlice,
        asArgumentTree(translated.parsed, chunkPaths),
        chunkPaths,
      );
      const markInput = pickMarkEvidenceInput(midTree, chunkPaths);
      const mk = buildMarkOnlyEvidencePrompt(markInput, locale, ctx);
      const marked = await callEvidenceTransform({
        system: mk.system,
        user: mk.user,
        session_id,
        signal,
      });
      if (!marked.ok) {
        return {
          ok: false as const,
          reason: `mark:${marked.reason}`,
          attempts: HARD_MAX,
          tokens_used: translated.tokens_used + marked.tokens_used,
        };
      }
      const markedTree = asArgumentTree(marked.parsed, chunkPaths);
      const trimmed: DeliveryArgumentTree = {};
      for (const k of chunkPaths) {
        const n = chunk[k]?.arguments.length ?? 0;
        const args = markedTree[k] ?? [];
        if (args.length < n) {
          return {
            ok: false as const,
            reason: `mark_incomplete:${k}:${args.length}/${n}`,
            attempts: HARD_MAX,
            tokens_used: translated.tokens_used + marked.tokens_used,
          };
        }
        trimmed[k] = args.slice(0, n);
      }
      return {
        ok: true as const,
        value: trimmed,
        attempts: 2,
        tokens_used: translated.tokens_used + marked.tokens_used,
      };
    }),
  );

  const tokens_used = results.reduce((s, r) => s + r.tokens_used, 0);
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    return {
      ok: false,
      reason: failed.map((r) => (!r.ok ? r.reason : "")).join(";"),
      attempts: HARD_MAX,
      tokens_used,
    };
  }
  const mergedMarked = mergeChunkArgumentTrees(results.map((r) => (r.ok ? r.value : {})));
  return {
    ok: true,
    value: scopeZipped(rawEvidence, mergedMarked, paths),
    attempts: 2,
    tokens_used,
  };
}

function polishMarkedTree(tree: DeliveryArgumentTree, locale: string): DeliveryArgumentTree {
  const out: DeliveryArgumentTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (DELIVERY_TRANSITION_KEYS.has(k)) continue;
    const args = tree[k];
    if (!args?.length) continue;
    out[k] = args.map((a) => ({
      body: a.body,
      evidence: a.evidence ? polishMarkedEvidenceText(a.evidence, locale) : undefined,
    }));
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
