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
import { DELIVERY_TASKS, type DeliveryTask } from "@/lib/llm/pro/delivery/delivery-tasks";
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

export type WriteOutcome =
  | { ok: true; value: DeliveryArgumentTree; attempts: number; tokens_used: number }
  | { ok: false; reason: string; attempts: number; tokens_used: number };

const HARD_MAX = 3;

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

async function runNarrativeTask(
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

async function runEvidenceTask(
  task: DeliveryTask,
  dc: DeliveryComputed,
  narrative: DeliveryArgumentTree,
  session_id?: string,
): Promise<WriteOutcome> {
  const paths = task.paths.filter((k) => !DELIVERY_TRANSITION_KEYS.has(k));
  if (paths.length === 0) {
    return { ok: true, value: {}, attempts: 1, tokens_used: 0 };
  }
  const { system, user } = buildDeliveryEvidencePrompt(
    pickDeliveryEvidenceInput(dc, narrative, paths),
    "zh",
  );

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
      const evTree = asArgumentTree(parsed, paths);
      // Normalize: model may put evidence text in `body` — prefer evidence field
      const normalized: DeliveryArgumentTree = {};
      for (const k of paths) {
        const args = evTree[k] ?? [];
        normalized[k] = args.map((a) => ({
          body: "",
          evidence: (a.evidence ?? a.body ?? "").trim(),
        }));
      }
      return { ok: true, value: normalized, attempts: attempt, tokens_used };
    } catch (e) {
      lastReason = `call_error:${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { ok: false, reason: lastReason, attempts: HARD_MAX, tokens_used };
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
  const merged = mergeDeliveryArgumentTrees(trees.map(treeToMergeRecords));
  const filled = fillNarrativeFromCompute(merged, dc);
  const pollution = findPollutedBodiesInTree(filled);
  if (pollution) {
    return {
      ok: false,
      reason: `body_mingli_pollution:${pollution.label}:${pollution.snippet}`,
      attempts: HARD_MAX,
      tokens_used,
    };
  }
  const missing = DELIVERY_SEGMENT_KEYS.filter((k) => !(filled[k]?.length));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `narrative_incomplete:${missing.join(",")}`,
      attempts: HARD_MAX,
      tokens_used,
    };
  }
  const polished = polishNarrativeTree(filled, locale);
  return {
    ok: true,
    value: polished,
    attempts: Math.max(...results.map((r) => r.attempts), 1),
    tokens_used,
  };
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
  const merged = mergeDeliveryArgumentTrees(trees.map(treeToMergeRecords));
  const filled = fillRawEvidenceFromCompute(narrative, merged, dc);
  // Keep raw — do NOT polishEvidenceSegment / forceRemarkAndFallback here
  return {
    ok: true,
    value: filled,
    attempts: Math.max(...results.map((r) => r.attempts), 1),
    tokens_used,
  };
}

export { zipArgumentEvidence };
