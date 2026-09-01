import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import {
  DELIVERY_SEGMENT_KEYS,
  LEGACY_LETTER_TO_SEGMENT,
  LEGACY_SEGMENT_TO_CURRENT,
  resolveDeliverySegmentKey,
  validateDeliveryComputed,
  type DeliveryComputed,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { buildDeliveryFinalizePrompt } from "@/lib/llm/pro/delivery/finalize-prompt";
import {
  FINALIZE_GROUPS,
  type DeliveryTask,
  deliveryFinalizeEffort,
  deliveryFinalizeMaxTokens,
  deliveryFinalizeTimeoutMs,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import { warnDeliveryProsePollution } from "@/lib/llm/pro/delivery/delivery-body-purity";
import {
  deliveryAppMaxAttempts,
  deliveryFailFastEnabled,
  deliveryTransportMaxAttempts,
} from "@/lib/llm/pro/delivery/delivery-retry-policy";
import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import type { DeliveryMode } from "@/lib/poju/collection-progress";

export type FinalizeOutcome =
  | { ok: true; value: DeliveryComputed; attempts: number; tokens_used: number; model: string }
  | { ok: false; reason: string; attempts: number };

type FinalizeInput = {
  breakthrough_core: BreakthroughCore | null;
  covered_agenda: Array<{ label: string; answer?: string }>;
  agent_v2: POJUAgentState;
  locale: string;
  delivery_mode: DeliveryMode;
  session_id?: string;
  signal?: AbortSignal;
  /** Override client abort when invoke budget is tight (finalize fan-out). */
  timeout_ms?: number;
};

function groupMaxTokens(paths: readonly DeliverySegmentKey[]): number {
  return deliveryFinalizeMaxTokens(paths);
}

function groupEffort(paths: readonly DeliverySegmentKey[]): "high" | "xhigh" {
  return deliveryFinalizeEffort(paths);
}

function groupTimeoutMs(paths: readonly DeliverySegmentKey[]): number {
  return deliveryFinalizeTimeoutMs(paths);
}

function isDualKeyShape(x: unknown): x is {
  core_conclusion: string;
  bazi_basis?: unknown;
  chart_anchors?: unknown;
} {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  return typeof o.core_conclusion === "string" && o.core_conclusion.trim().length > 0;
}

/**
 * Normalize model JSON into `{ [segmentKey]: dual-key }`.
 * Single-path calls often return a bare dual-key (prompt shows that shape) or
 * legacy A–F / deliver_* aliases — without this, valid prose becomes group_empty.
 */
export function normalizeFinalizeGroupObject(
  raw: Record<string, unknown>,
  paths: readonly DeliverySegmentKey[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  if (paths.length === 1) {
    const k = paths[0]!;
    if (!isDualKeyShape(out[k]) && isDualKeyShape(out)) {
      return {
        [k]: {
          core_conclusion: out.core_conclusion,
          bazi_basis: out.bazi_basis,
          chart_anchors: out.chart_anchors,
        },
      };
    }
  }

  for (const k of paths) {
    if (isDualKeyShape(out[k])) continue;
    const legacyLetter = Object.entries(LEGACY_LETTER_TO_SEGMENT).find(([, v]) => v === k)?.[0];
    const legacyBookKey = Object.entries(LEGACY_SEGMENT_TO_CURRENT).find(([, v]) => v === k)?.[0];
    const alias =
      (legacyLetter && isDualKeyShape(out[legacyLetter]) ? out[legacyLetter] : null) ??
      (legacyBookKey && isDualKeyShape(out[legacyBookKey]) ? out[legacyBookKey] : null) ??
      (isDualKeyShape(out[`deliver_${k}`]) ? out[`deliver_${k}`] : null);
    if (alias) out[k] = alias;
  }

  // Remap any leftover legacy top-level keys onto current paths
  for (const [rawKey, val] of Object.entries(out)) {
    if (isDualKeyShape(out[rawKey as DeliverySegmentKey])) continue;
    const resolved = resolveDeliverySegmentKey(rawKey);
    if (resolved && paths.includes(resolved) && isDualKeyShape(val) && !isDualKeyShape(out[resolved])) {
      out[resolved] = val;
    }
  }
  return out;
}

/** One finalize group (typically a single segment key) — used by stage-KV task relay. */
export async function runFinalizeGroup(
  group: DeliveryTask,
  input: FinalizeInput,
): Promise<{
  ok: true;
  partial: Partial<DeliveryComputed>;
  attempts: number;
  tokens_used: number;
  model: string;
} | { ok: false; reason: string; attempts: number; tokens_used: number }> {
  const { system, user } = buildDeliveryFinalizePrompt({
    breakthrough_core: input.breakthrough_core,
    covered_agenda: input.covered_agenda,
    agent_v2: input.agent_v2,
    locale: input.locale,
    delivery_mode: input.delivery_mode,
    paths: group.paths,
  });

  let lastReason = "unknown";
  let tokens_used = 0;
  let model = "";
  const MAX_ATTEMPTS = deliveryAppMaxAttempts();
  const transportAttempts = deliveryTransportMaxAttempts();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (input.signal?.aborted) {
      return { ok: false, reason: "aborted", attempts: attempt, tokens_used };
    }
    try {
      const result = await callLLM({
        call_type: "main_delivery",
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: groupMaxTokens(group.paths),
        thinking_effort: groupEffort(group.paths),
        timeout_ms: input.timeout_ms ?? groupTimeoutMs(group.paths),
        response_format: "text",
        session_id: input.session_id,
        temperature: 0.4,
        max_attempts: transportAttempts,
        signal: input.signal,
      });
      tokens_used += result.meta.tokens_used;
      model = result.actual_model;
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
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        lastReason = "not_object";
        continue;
      }
      const o = normalizeFinalizeGroupObject(
        parsed as Record<string, unknown>,
        group.paths,
      );
      const partial: Partial<DeliveryComputed> = {};
      for (const k of group.paths) {
        const seg = o[k];
        if (isDualKeyShape(seg)) {
          const core = seg.core_conclusion.trim();
          if (!core) continue;
          warnDeliveryProsePollution(`finalize/${group.name}/core`, core, {
            attempt,
            key: k,
          });
          partial[k] = {
            core_conclusion: core,
            bazi_basis: Array.isArray(seg.bazi_basis)
              ? seg.bazi_basis.map((b) => String(b).trim()).filter(Boolean)
              : [],
            chart_anchors: Array.isArray(seg.chart_anchors)
              ? seg.chart_anchors.map((b) => String(b).trim()).filter(Boolean)
              : Array.isArray(seg.bazi_basis)
                ? seg.bazi_basis.map((b) => String(b).trim()).filter(Boolean)
                : [],
          };
        }
      }
      const missingPaths = group.paths.filter((k) => !partial[k]?.core_conclusion?.trim());
      if (missingPaths.length > 0) {
        lastReason =
          Object.keys(partial).length === 0
            ? "group_empty"
            : `group_incomplete:${missingPaths.join(",")}`;
        console.warn(`[delivery/finalize] ${group.name} ${lastReason}`, {
          attempt,
          got_keys: Object.keys(o).slice(0, 12),
          missing: missingPaths,
          fail_fast: deliveryFailFastEnabled(),
        });
        if (deliveryFailFastEnabled()) break;
        continue;
      }
      return { ok: true, partial, attempts: attempt, tokens_used, model };
    } catch (e) {
      // Sibling wave cancel — do not masquerade as a root finalize failure.
      if (
        input.signal?.aborted ||
        (e instanceof Error && (e.name === "AbortError" || /abort/i.test(e.message)))
      ) {
        return { ok: false, reason: "aborted", attempts: attempt, tokens_used };
      }
      lastReason = `call_error:${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { ok: false, reason: `${group.name}:${lastReason}`, attempts: MAX_ATTEMPTS, tokens_used };
}

/** Merge per-group finalize partials (after KV fan-out). */
export function assembleDeliveryFinalize(
  partials: Array<Partial<DeliveryComputed>>,
  opts?: { delivery_mode?: DeliveryMode },
): FinalizeOutcome {
  const merged: Partial<DeliveryComputed> = {};
  for (const p of partials) Object.assign(merged, p);

  for (const k of DELIVERY_SEGMENT_KEYS) {
    const core = merged[k]?.core_conclusion ?? "";
    if (!core) continue;
    warnDeliveryProsePollution("finalize/assemble/core", core, { key: k });
  }

  const validated = validateDeliveryComputed(merged, {
    mode: opts?.delivery_mode === "degraded" ? "degraded" : "full",
  });
  if (!validated.ok) {
    return {
      ok: false,
      reason: `finalize_incomplete:${validated.reason}`,
      attempts: deliveryAppMaxAttempts(),
    };
  }

  return {
    ok: true,
    value: validated.value,
    attempts: 1,
    tokens_used: 0,
    model: "",
  };
}

/**
 * Finalize — parallel groups (same split as DELIVERY_TASKS).
 * Prefer stage-KV per-group relay in production (avoids 9× xhigh in one 300s).
 */
export async function runDeliveryFinalize(input: FinalizeInput): Promise<FinalizeOutcome> {
  const results = await Promise.all(
    FINALIZE_GROUPS.map((g) => runFinalizeGroup(g, input)),
  );

  const tokens_used = results.reduce((s, r) => s + r.tokens_used, 0);
  const model =
    results.find((r): r is Extract<typeof r, { ok: true }> => r.ok)?.model ?? "";

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    return {
      ok: false,
      reason: failed.map((r) => (!r.ok ? r.reason : "")).join(";"),
      attempts: deliveryAppMaxAttempts(),
    };
  }

  const assembled = assembleDeliveryFinalize(
    results.filter((r) => r.ok).map((r) => (r.ok ? r.partial : {})),
    { delivery_mode: input.delivery_mode },
  );
  if (!assembled.ok) return assembled;
  return {
    ...assembled,
    tokens_used,
    model: model || assembled.model,
    attempts: Math.max(...results.map((r) => r.attempts), 1),
  };
}
