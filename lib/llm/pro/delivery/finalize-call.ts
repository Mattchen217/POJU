import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import {
  DELIVERY_SEGMENT_KEYS,
  validateDeliveryComputed,
  type DeliveryComputed,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { buildDeliveryFinalizePrompt } from "@/lib/llm/pro/delivery/finalize-prompt";
import { FINALIZE_GROUPS, type DeliveryTask } from "@/lib/llm/pro/delivery/delivery-tasks";
import { findDeliveryProsePollution } from "@/lib/llm/pro/delivery/delivery-body-purity";
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
  base_analysis?: unknown | null;
  session_id?: string;
  signal?: AbortSignal;
};

function groupMaxTokens(paths: readonly DeliverySegmentKey[]): number {
  // One-key groups (default): room for full dual-key JSON without length truncate.
  if (paths.length === 1) return 8_000;
  if (paths.length === 2) return 10_000;
  return 12_000;
}

function groupEffort(paths: readonly DeliverySegmentKey[]): "high" | "xhigh" {
  // action / retune alone keep deepest effort; mixed groups use high.
  if (paths.length === 1 && (paths[0] === "action" || paths[0] === "retune")) {
    return "xhigh";
  }
  return "high";
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
    base_analysis: input.base_analysis,
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
        timeout_ms: 120_000,
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
      const o = parsed as Record<string, unknown>;
      const partial: Partial<DeliveryComputed> = {};
      let pollutionReason: string | null = null;
      for (const k of group.paths) {
        const seg = o[k];
        if (
          seg &&
          typeof seg === "object" &&
          !Array.isArray(seg) &&
          typeof (seg as { core_conclusion?: unknown }).core_conclusion === "string"
        ) {
          const s = seg as { core_conclusion: string; bazi_basis?: unknown };
          const core = s.core_conclusion.trim();
          const pollution = findDeliveryProsePollution(core);
          if (pollution) {
            pollutionReason = `core_mingli_pollution:${k}:${pollution.label}:${pollution.snippet}`;
            break;
          }
          partial[k] = {
            core_conclusion: core,
            bazi_basis: Array.isArray(s.bazi_basis)
              ? s.bazi_basis.map((b) => String(b).trim()).filter(Boolean)
              : [],
          };
        }
      }
      if (pollutionReason) {
        lastReason = pollutionReason;
        console.warn(`[delivery/finalize] ${group.name} reject polluted core_conclusion`, {
          attempt,
          reason: pollutionReason,
          fail_fast: deliveryFailFastEnabled(),
        });
        if (deliveryFailFastEnabled()) break;
        continue;
      }
      const missingPaths = group.paths.filter((k) => !partial[k]?.core_conclusion?.trim());
      if (missingPaths.length > 0) {
        lastReason =
          Object.keys(partial).length === 0
            ? "group_empty"
            : `group_incomplete:${missingPaths.join(",")}`;
        continue;
      }
      return { ok: true, partial, attempts: attempt, tokens_used, model };
    } catch (e) {
      lastReason = `call_error:${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { ok: false, reason: `${group.name}:${lastReason}`, attempts: MAX_ATTEMPTS, tokens_used };
}

/** Merge per-group finalize partials (after KV fan-out). */
export function assembleDeliveryFinalize(
  partials: Array<Partial<DeliveryComputed>>,
): FinalizeOutcome {
  const merged: Partial<DeliveryComputed> = {};
  for (const p of partials) Object.assign(merged, p);

  for (const k of DELIVERY_SEGMENT_KEYS) {
    const core = merged[k]?.core_conclusion ?? "";
    if (!core) continue;
    const pollution = findDeliveryProsePollution(core);
    if (pollution) {
      console.warn("[delivery/finalize] polluted core after merge — fail", {
        key: k,
        ...pollution,
      });
      return {
        ok: false,
        reason: `core_mingli_pollution:${k}:${pollution.label}:${pollution.snippet}`,
        attempts: deliveryAppMaxAttempts(),
      };
    }
  }

  const validated = validateDeliveryComputed(merged);
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
  );
  if (!assembled.ok) return assembled;
  return {
    ...assembled,
    tokens_used,
    model: model || assembled.model,
    attempts: Math.max(...results.map((r) => r.attempts), 1),
  };
}
