/**
 * Shared JSON parse + one-shot repair retry for paid delivery LLM calls.
 */

import { callLLM, type CallLLMInput, type CallLLMResult } from "@/lib/llm/router";

export function parseJsonLoose(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/g, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("json_not_object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("json_not_object");
      }
      return parsed as Record<string, unknown>;
    }
    throw new Error("invalid_json");
  }
}

export type JsonValidateResult<T> =
  | { ok: true; value: T }
  | { ok: false; missing: string[]; message: string; parsed: Record<string, unknown> };

export async function requestJsonWithRepair<T>(input: {
  llm: CallLLMInput;
  validate: (parsed: Record<string, unknown>) => JsonValidateResult<T>;
  repairHint: (missing: string[]) => string;
}): Promise<{ value: T; result: CallLLMResult; parsed: Record<string, unknown> }> {
  let result = await callLLM(input.llm);
  let parsed: Record<string, unknown>;

  try {
    parsed = parseJsonLoose(result.content);
  } catch (e) {
    console.warn("[delivery-resilience] JSON parse failed, repair retry:", e);
    result = await callLLM({
      ...input.llm,
      temperature: 0.3,
      messages: [
        ...input.llm.messages,
        { role: "assistant", content: result.content },
        { role: "user", content: input.repairHint(["valid JSON object"]) },
      ],
    });
    parsed = parseJsonLoose(result.content);
  }

  let validation = input.validate(parsed);
  if (validation.ok) {
    return { value: validation.value, result, parsed };
  }

  console.warn("[delivery-resilience] Validation failed, repair retry:", validation.message);
  const repairResult = await callLLM({
    ...input.llm,
    temperature: 0.3,
    messages: [
      ...input.llm.messages,
      { role: "assistant", content: result.content },
      { role: "user", content: input.repairHint(validation.missing) },
    ],
  });

  parsed = parseJsonLoose(repairResult.content);
  validation = input.validate(parsed);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return { value: validation.value, result: repairResult, parsed };
}
