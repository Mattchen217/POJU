import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_TRANSITION_KEYS,
  coerceDeliveryArguments,
  mergeDeliveryArgumentTrees,
  zipArgumentEvidence,
  type DeliveryArgumentTree,
  type DeliveryComputed,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  chunkDeliveryArgPayload,
  DELIVERY_TASKS,
  DELIVERY_WRITE_MAX_TOKENS,
  type DeliveryTask,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import {
  buildDeliveryNarrativePrompt,
  pickDeliveryConclusions,
} from "@/lib/llm/pro/delivery/narrative-prompt";
import {
  buildDeliveryEvidencePrompt,
  pickDeliveryEvidenceInput,
} from "@/lib/llm/pro/delivery/evidence-prompt";
import {
  degradeMarkersToPlain,
  prepareBodyTextForGlossaryRender,
} from "@/lib/llm/sanitize/compliance-terms";
import {
  findDeliveryProsePollution,
  findPollutedBodiesInTree,
} from "@/lib/llm/pro/delivery/delivery-body-purity";
import {
  deliveryAppMaxAttempts,
  deliveryTransportMaxAttempts,
} from "@/lib/llm/pro/delivery/delivery-retry-policy";

export type WriteOutcome =
  | { ok: true; value: DeliveryArgumentTree; attempts: number; tokens_used: number }
  | { ok: false; reason: string; attempts: number; tokens_used: number };

const HARD_MAX = deliveryAppMaxAttempts();

function asArgumentTree(parsed: unknown, paths: readonly DeliverySegmentKey[]): DeliveryArgumentTree {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const o = parsed as Record<string, unknown>;
  const out: DeliveryArgumentTree = {};
  for (const k of paths) {
    const args = coerceDeliveryArguments(o[k]);
    if (args.length > 0) out[k] = args;
  }
  return out;
}

function treeToMergeRecords(tree: DeliveryArgumentTree): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (tree[k]?.length) o[k] = { arguments: tree[k] };
  }
  return o;
}

/** One narrative task — used by stage-KV task relay (one continue per task). */
export async function runNarrativeTask(
  task: DeliveryTask,
  dc: DeliveryComputed,
  session_id?: string,
): Promise<WriteOutcome> {
  const paths = task.paths;
  const { system, user } = buildDeliveryNarrativePrompt(pickDeliveryConclusions(dc, paths), "zh");

  let lastReason = "unknown";
  let tokens_used = 0;

  for (let attempt = 1; attempt <= HARD_MAX; attempt++) {
    try {
      const result = await callLLM({
        call_type: "main_delivery",
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: DELIVERY_WRITE_MAX_TOKENS,
        thinking_effort: "high",
        timeout_ms: 120_000,
        response_format: "text",
        session_id,
        temperature: 0.5,
        max_attempts: deliveryTransportMaxAttempts(),
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
      const tree = asArgumentTree(parsed, paths);
      if (paths.some((k) => !(tree[k]?.length))) {
        lastReason = "narrative_incomplete_keys";
        continue;
      }
      const pollution = findPollutedBodiesInTree(tree);
      if (pollution) {
        lastReason = `body_mingli_pollution:${pollution.label}:${pollution.snippet}`;
        console.warn(`[delivery/narrative] ${task.name} reject polluted body`, {
          attempt,
          ...pollution,
        });
        continue;
      }
      return { ok: true, value: tree, attempts: attempt, tokens_used };
    } catch (e) {
      lastReason = `call_error:${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { ok: false, reason: lastReason, attempts: HARD_MAX, tokens_used };
}

/** One evidence task — used by stage-KV task relay (one continue per task). */
export async function runEvidenceTask(
  task: DeliveryTask,
  dc: DeliveryComputed,
  narrative: DeliveryArgumentTree,
  session_id?: string,
): Promise<WriteOutcome> {
  const paths = task.paths.filter((k) => !DELIVERY_TRANSITION_KEYS.has(k));
  if (paths.length === 0) {
    return { ok: true, value: {}, attempts: 1, tokens_used: 0 };
  }
  const fullInput = pickDeliveryEvidenceInput(dc, narrative, paths);
  if (Object.keys(fullInput).length === 0) {
    return { ok: true, value: {}, attempts: 1, tokens_used: 0 };
  }
  const chunks = chunkDeliveryArgPayload(fullInput);
  const chunkResults = await Promise.all(
    chunks.map((chunk) => runEvidenceChunk(chunk, paths, session_id)),
  );
  const tokens_used = chunkResults.reduce((s, r) => s + r.tokens_used, 0);
  const failed = chunkResults.filter((r) => !r.ok);
  if (failed.length > 0) {
    return {
      ok: false,
      reason: failed.map((r) => (!r.ok ? r.reason : "")).join(";"),
      attempts: HARD_MAX,
      tokens_used,
    };
  }
  const merged = mergeChunkArgumentTrees(
    chunkResults.map((r) => (r.ok ? r.value : {})),
  );
  return { ok: true, value: merged, attempts: 1, tokens_used };
}

async function runEvidenceChunk(
  chunk: Record<string, { bazi_basis: readonly string[]; arguments: Array<{ body: string }> }>,
  paths: readonly DeliverySegmentKey[],
  session_id?: string,
): Promise<WriteOutcome> {
  const { system, user } = buildDeliveryEvidencePrompt(chunk, "zh");
  let lastReason = "unknown";
  let tokens_used = 0;

  for (let attempt = 1; attempt <= HARD_MAX; attempt++) {
    try {
      const result = await callLLM({
        call_type: "main_delivery",
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: DELIVERY_WRITE_MAX_TOKENS,
        thinking_effort: "high",
        timeout_ms: 120_000,
        response_format: "text",
        session_id,
        temperature: 0.5,
        max_attempts: deliveryTransportMaxAttempts(),
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
      const evTree = asArgumentTree(parsed, paths);
      const normalized: DeliveryArgumentTree = {};
      let incomplete: string | null = null;
      for (const k of Object.keys(chunk) as DeliverySegmentKey[]) {
        const args = evTree[k] ?? [];
        const expected = chunk[k]?.arguments.length ?? 0;
        if (args.length < expected) {
          incomplete = `evidence_incomplete:${k}:${args.length}/${expected}`;
          break;
        }
        normalized[k] = args.slice(0, expected).map((a) => ({
          body: "",
          evidence: (a.evidence ?? a.body ?? "").trim(),
        }));
      }
      if (incomplete) {
        lastReason = incomplete;
        continue;
      }
      return { ok: true, value: normalized, attempts: attempt, tokens_used };
    } catch (e) {
      lastReason = `call_error:${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { ok: false, reason: lastReason, attempts: HARD_MAX, tokens_used };
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
 * Fill missing narrative segments from clean finalize conclusions only.
 * Polluted core_conclusion is skipped (caller must fail if still incomplete).
 */
function fillNarrativeFromCompute(
  tree: DeliveryArgumentTree,
  dc: DeliveryComputed,
): DeliveryArgumentTree {
  const out: DeliveryArgumentTree = { ...tree };
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (out[k]?.length) continue;
    const core = dc[k]?.core_conclusion?.trim() ?? "";
    if (!core || findDeliveryProsePollution(core)) continue;
    out[k] = [{ body: core }];
  }
  return out;
}

/**
 * Raw-evidence fill when a segment has basis but no evidence strings yet.
 * Full prose sentence — no semicolon skeleton; marking happens in mark step.
 */
function fillRawEvidenceFromCompute(
  narrative: DeliveryArgumentTree,
  evidence: DeliveryArgumentTree,
  dc: DeliveryComputed,
): DeliveryArgumentTree {
  const out: DeliveryArgumentTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (DELIVERY_TRANSITION_KEYS.has(k)) continue;
    const bodies = narrative[k] ?? [{ body: dc[k].core_conclusion }];
    const evArgs = evidence[k] ?? [];
    const basis = dc[k].bazi_basis;
    out[k] = bodies.map((b, i) => {
      const existing = (evArgs[i]?.evidence ?? evArgs[i]?.body ?? "").trim();
      if (existing) return { body: b.body, evidence: existing };
      if (basis.length === 0) return { body: b.body, evidence: undefined };
      const terms = basis.slice(0, 3).join("、");
      return {
        body: b.body,
        evidence: `本论点的命理承重点在于${terms}，其结构直接支撑上述判断。`,
      };
    });
  }
  return out;
}

function polishNarrativeTree(tree: DeliveryArgumentTree, locale: string): DeliveryArgumentTree {
  const out: DeliveryArgumentTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const args = tree[k];
    if (!args?.length) continue;
    out[k] = args.map((a) => {
      const t = a.body ?? "";
      const plain = /⟦t:/.test(t) ? degradeMarkersToPlain(t, locale) : t;
      return { body: prepareBodyTextForGlossaryRender(plain, locale), evidence: a.evidence };
    });
  }
  return out;
}

/** Merge per-task narrative trees (after KV fan-out) into a polished book tree. */
export function assembleDeliveryNarrative(
  trees: DeliveryArgumentTree[],
  dc: DeliveryComputed,
  locale: string,
): WriteOutcome {
  const merged = mergeDeliveryArgumentTrees(trees.map(treeToMergeRecords));
  const filled = fillNarrativeFromCompute(merged, dc);
  const pollution = findPollutedBodiesInTree(filled);
  if (pollution) {
    return {
      ok: false,
      reason: `body_mingli_pollution:${pollution.label}:${pollution.snippet}`,
      attempts: 1,
      tokens_used: 0,
    };
  }
  const missing = DELIVERY_SEGMENT_KEYS.filter((k) => !(filled[k]?.length));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `narrative_incomplete:${missing.join(",")}`,
      attempts: 1,
      tokens_used: 0,
    };
  }
  return {
    ok: true,
    value: polishNarrativeTree(filled, locale),
    attempts: 1,
    tokens_used: 0,
  };
}

export async function runDeliveryNarrative(
  dc: DeliveryComputed,
  locale: string,
  opts?: { session_id?: string },
): Promise<WriteOutcome> {
  const results = await Promise.all(
    DELIVERY_TASKS.map((t) => runNarrativeTask(t, dc, opts?.session_id)),
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
  const trees = results.filter((r) => r.ok).map((r) => (r.ok ? r.value : {}));
  const assembled = assembleDeliveryNarrative(trees, dc, locale);
  if (!assembled.ok) return { ...assembled, tokens_used };
  return { ...assembled, tokens_used, attempts: Math.max(...results.map((r) => r.attempts), 1) };
}

/** Merge per-task raw-evidence trees (after KV fan-out). */
export function assembleDeliveryEvidence(
  trees: DeliveryArgumentTree[],
  narrative: DeliveryArgumentTree,
  dc: DeliveryComputed,
): DeliveryArgumentTree {
  const merged = mergeDeliveryArgumentTrees(trees.map(treeToMergeRecords));
  return fillRawEvidenceFromCompute(narrative, merged, dc);
}

/**
 * Raw 命理 evidence per argument — no marking.
 * Requires narrative argument tree so each evidence targets one body.
 */
export async function runDeliveryEvidence(
  dc: DeliveryComputed,
  narrative: DeliveryArgumentTree,
  opts?: { session_id?: string },
): Promise<WriteOutcome> {
  const results = await Promise.all(
    DELIVERY_TASKS.map((t) => runEvidenceTask(t, dc, narrative, opts?.session_id)),
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
  return {
    ok: true,
    value: assembleDeliveryEvidence(trees, narrative, dc),
    attempts: Math.max(...results.map((r) => r.attempts), 1),
    tokens_used,
  };
}

export { zipArgumentEvidence };
