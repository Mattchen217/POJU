/**
 * Surgical repair after delivery-gate failure — keep good prose, fix only hits.
 * Cheap medium-effort call; full regen is last resort.
 */

import {
  buildViolationRepairInstruction,
} from "@/lib/llm/compliance/banned-terms";
import type { ComplianceViolation } from "@/lib/llm/sanitize/compliance-terms";
import {
  openRouterChatCompletion,
} from "@/lib/llm/openrouter-shared";

export type RepairViolationsInput = {
  text: string;
  violations: ComplianceViolation[];
  locale: string;
  session_id?: string;
  signal?: AbortSignal;
};

export type RepairViolationsResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

/**
 * Ask the model to patch only the flagged spots and return the full document.
 * Does not stream — caller replaces the prior draft atomically.
 */
export async function repairViolationsOnly(
  input: RepairViolationsInput,
): Promise<RepairViolationsResult> {
  const critical = input.violations.filter((v) => v.label && v.snippet);
  if (!critical.length) {
    return { ok: true, text: input.text };
  }

  const instruction = buildViolationRepairInstruction(critical, input.locale);
  const system = input.locale.startsWith("zh")
    ? "你是合规修补编辑。只改用户指出的违规处，其余原文原样保留。只输出完整 Markdown，不要解释。"
    : "You are a compliance patch editor. Fix only the flagged violations; keep all other prose identical. Output full Markdown only.";

  try {
    const result = await openRouterChatCompletion({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `${instruction}\n\n---ORIGINAL---\n${input.text}\n---END---`,
        },
      ],
      temperature: 0.2,
      max_tokens: Math.min(12_000, Math.max(2_000, Math.ceil(input.text.length / 2) + 800)),
      reasoning_effort: "medium",
      session_id: input.session_id,
      call_type: "base_analysis_repair",
      phase_name: "base_analysis_repair",
      signal: input.signal,
    });

    const repaired = (result.text ?? "").trim();
    if (!repaired || repaired.length < Math.min(200, input.text.length * 0.4)) {
      console.warn("[fallback] repairViolationsOnly: empty or truncated repair", {
        finish_reason: result.finish_reason,
        in_len: input.text.length,
        out_len: repaired.length,
      });
      return { ok: false, error: "repair_empty_or_truncated" };
    }

    return { ok: true, text: repaired };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[fallback] repairViolationsOnly failed", { reason: msg });
    return { ok: false, error: msg };
  }
}
