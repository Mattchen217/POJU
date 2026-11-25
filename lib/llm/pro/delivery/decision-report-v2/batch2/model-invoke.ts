import { callLLM } from "@/lib/llm/router";
import {
  DELIVERY_SINGLE_CALL_TIMEOUT_MS,
  PAGE_SCHEMA_FILL_MAX_TOKENS,
} from "@/lib/llm/pro/delivery/delivery-tasks";

export type Batch2ModelInvoke = (input: {
  page_id: string;
  system: string;
  user: string;
  invocation_id: string;
  call_kind: "generate" | "repair";
}) => Promise<{ content: string; tokens_used: number; model_call_id: string }>;

let testInvoke: Batch2ModelInvoke | null = null;
let testDelayMs: number | null = null;

export function setBatch2ModelInvokeForTests(fn: Batch2ModelInvoke | null): void {
  testInvoke = fn;
}

export function setBatch2ModelDelayMsForTests(ms: number | null): void {
  testDelayMs = ms;
}

function phaseName(page_id: string, call_kind: "generate" | "repair"): string {
  return `report_batch2_face${page_id}_${call_kind}`;
}

export async function defaultBatch2ModelInvoke(
  input: Parameters<Batch2ModelInvoke>[0],
): Promise<{ content: string; tokens_used: number; model_call_id: string }> {
  const delayMs = testDelayMs;
  if (typeof delayMs === "number" && delayMs > 0) {
    await new Promise((r) => setTimeout(r, delayMs));
  }
  if (testInvoke) {
    return testInvoke(input);
  }
  const result = await callLLM({
    call_type: "main_delivery",
    system: input.system,
    messages: [{ role: "user", content: input.user }],
    max_tokens: PAGE_SCHEMA_FILL_MAX_TOKENS,
    thinking_effort: "high",
    timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
    response_format: "json",
    temperature: 0.4,
    phase_name: phaseName(input.page_id, input.call_kind),
  });
  const model_call_id =
    result.meta.generation_id?.trim() ||
    result.llm_debug.generation_id?.trim() ||
    input.invocation_id;
  return {
    content: result.content,
    tokens_used: result.meta.tokens_used,
    model_call_id,
  };
}

export function getBatch2ModelInvoke(): Batch2ModelInvoke {
  return defaultBatch2ModelInvoke;
}