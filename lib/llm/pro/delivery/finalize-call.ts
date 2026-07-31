import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import {
  DELIVERY_SEGMENT_KEYS,
  fillMissingDeliverySegments,
  validateDeliveryComputed,
  type DeliveryComputed,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { buildDeliveryFinalizePrompt } from "@/lib/llm/pro/delivery/finalize-prompt";
import { FINALIZE_GROUPS, type DeliveryTask } from "@/lib/llm/pro/delivery/delivery-tasks";
import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import type { DeliveryMode } from "@/lib/poju/collection-progress";

export type FinalizeOutcome =
  | { ok: true; value: DeliveryComputed; attempts: number; tokens_used: number; model: string }
  | { ok: false; reason: string; attempts: number };

const MAX_ATTEMPTS = 3;

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
  // Paid heart alone → roomier; multi-key groups stay smaller.
  if (paths.length === 1) return 4_500;
  if (paths.length === 2) return 5_500;
  return 6_500;
}

function groupEffort(paths: readonly DeliverySegmentKey[]): "high" | "xhigh" {
  // action / retune alone keep deepest effort; mixed groups use high.
  if (paths.length === 1 && (paths[0] === "action" || paths[0] === "retune")) {
    return "xhigh";
  }
  return "high";
}

async function finalizeOneGroup(
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
      for (const k of group.paths) {
        const seg = o[k];
        if (
          seg &&
          typeof seg === "object" &&
          !Array.isArray(seg) &&
          typeof (seg as { core_conclusion?: unknown }).core_conclusion === "string"
        ) {
          const s = seg as { core_conclusion: string; bazi_basis?: unknown };
          partial[k] = {
            core_conclusion: s.core_conclusion.trim(),
            bazi_basis: Array.isArray(s.bazi_basis)
              ? s.bazi_basis.map((b) => String(b).trim()).filter(Boolean)
              : [],
          };
        }
      }
      if (Object.keys(partial).length === 0) {
        lastReason = "group_empty";
        continue;
      }
      return { ok: true, partial, attempts: attempt, tokens_used, model };
    } catch (e) {
      lastReason = `call_error:${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { ok: false, reason: `${group.name}:${lastReason}`, attempts: MAX_ATTEMPTS, tokens_used };
}

/**
 * Finalize — parallel groups (same split as DELIVERY_TASKS).
 * Avoids one xhigh/10k-token call that alone can burn ~140s of the 300s budget.
 */
export async function runDeliveryFinalize(input: FinalizeInput): Promise<FinalizeOutcome> {
  const results = await Promise.all(
    FINALIZE_GROUPS.map((g) => finalizeOneGroup(g, input)),
  );

  const tokens_used = results.reduce((s, r) => s + r.tokens_used, 0);
  const model =
    results.find((r): r is Extract<typeof r, { ok: true }> => r.ok)?.model ?? "";

  if (results.every((r) => !r.ok)) {
    return {
      ok: false,
      reason: results.map((r) => (!r.ok ? r.reason : "")).join(";"),
      attempts: MAX_ATTEMPTS,
    };
  }

  const merged: Partial<DeliveryComputed> = {};
  for (const r of results) {
    if (r.ok) Object.assign(merged, r.partial);
  }

  const validated = validateDeliveryComputed(merged);
  if (validated.ok) {
    return {
      ok: true,
      value: validated.value,
      attempts: Math.max(...results.map((r) => r.attempts), 1),
      tokens_used,
      model,
    };
  }

  const filled = fillMissingDeliverySegments({
    ...validated.partial,
    ...merged,
  });
  // Ensure all keys present
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (!filled[k]) {
      filled[k] = { core_conclusion: "本段待补结论。", bazi_basis: [] };
    }
  }
  console.warn(
    `[delivery/finalize] parallel soft fill (${validated.ok ? "ok" : validated.reason})`,
    {
      groups_ok: results.filter((r) => r.ok).length,
      groups_fail: results.filter((r) => !r.ok).length,
    },
  );
  return {
    ok: true,
    value: filled,
    attempts: Math.max(...results.map((r) => r.attempts), 1),
    tokens_used,
    model,
  };
}
