import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import {
  fillMissingDeliverySegments,
  validateDeliveryComputed,
  type DeliveryComputed,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { buildDeliveryFinalizePrompt } from "@/lib/llm/pro/delivery/finalize-prompt";
import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import type { DeliveryMode } from "@/lib/poju/collection-progress";

export type FinalizeOutcome =
  | { ok: true; value: DeliveryComputed; attempts: number; tokens_used: number; model: string }
  | { ok: false; reason: string; attempts: number };

const MAX_ATTEMPTS = 3;

export async function runDeliveryFinalize(input: {
  breakthrough_core: BreakthroughCore | null;
  covered_agenda: Array<{ label: string; answer?: string }>;
  agent_v2: POJUAgentState;
  locale: string;
  delivery_mode: DeliveryMode;
  base_analysis?: unknown | null;
  session_id?: string;
  signal?: AbortSignal;
}): Promise<FinalizeOutcome> {
  const { system, user } = buildDeliveryFinalizePrompt({
    breakthrough_core: input.breakthrough_core,
    covered_agenda: input.covered_agenda,
    agent_v2: input.agent_v2,
    locale: input.locale,
    delivery_mode: input.delivery_mode,
    base_analysis: input.base_analysis,
  });

  let lastReason = "unknown";
  let tokens_used = 0;
  let model = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (input.signal?.aborted) {
      return { ok: false, reason: "aborted", attempts: attempt };
    }
    try {
      const result = await callLLM({
        call_type: "main_delivery",
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: 10_000,
        thinking_effort: "xhigh",
        timeout_ms: 180_000,
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
      const v = validateDeliveryComputed(parsed);
      if (v.ok) {
        return { ok: true, value: v.value, attempts: attempt, tokens_used, model };
      }
      if (v.severity === "fatal") {
        lastReason = v.reason;
        continue;
      }
      // soft: fill missing
      const filled = fillMissingDeliverySegments({ ...v.partial, ...(parsed as object) });
      console.warn(`[delivery/finalize] soft missing — filled placeholders (${v.reason})`);
      return { ok: true, value: filled, attempts: attempt, tokens_used, model };
    } catch (e) {
      lastReason = `call_error:${e instanceof Error ? e.message : String(e)}`;
      continue;
    }
  }
  return { ok: false, reason: lastReason, attempts: MAX_ATTEMPTS };
}
