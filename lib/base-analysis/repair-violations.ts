/**
 * Surgical repair after delivery-gate failure.
 * Model returns ONLY JSON patches; code applies them so newlines / ## layout stay intact.
 */

import {
  buildViolationRepairInstruction,
} from "@/lib/llm/compliance/banned-terms";
import type { ComplianceViolation } from "@/lib/llm/sanitize/compliance-terms";
import {
  openRouterChatCompletion,
} from "@/lib/llm/openrouter-shared";

export type RepairPatch = { find: string; replace: string };

export type RepairViolationsInput = {
  text: string;
  violations: ComplianceViolation[];
  locale: string;
  session_id?: string;
  signal?: AbortSignal;
};

export type RepairViolationsResult =
  | { ok: true; text: string; patches: RepairPatch[] }
  | { ok: false; error: string };

function parsePatchesJson(raw: string): RepairPatch[] | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(trimmed.slice(start, end + 1)) as {
      patches?: unknown;
    };
    if (!Array.isArray(obj.patches)) return null;
    const patches: RepairPatch[] = [];
    for (const p of obj.patches) {
      if (!p || typeof p !== "object") return null;
      const find = (p as { find?: unknown }).find;
      const replace = (p as { replace?: unknown }).replace;
      if (typeof find !== "string" || typeof replace !== "string") return null;
      if (!find.length) return null;
      patches.push({ find, replace });
    }
    return patches;
  } catch {
    return null;
  }
}

/** Apply find→replace patches; throw if any find is missing (hallucinated patch). */
export function applyRepairPatches(text: string, patches: RepairPatch[]): string {
  let fixed = text;
  for (const p of patches) {
    if (!fixed.includes(p.find)) {
      throw new Error(`patch_find_missing:${p.find.slice(0, 48)}`);
    }
    fixed = fixed.split(p.find).join(p.replace);
  }
  return fixed;
}

/**
 * Ask model for minimal JSON patches only — never re-emit the full document.
 */
export async function repairViolationsOnly(
  input: RepairViolationsInput,
): Promise<RepairViolationsResult> {
  const critical = input.violations.filter((v) => v.label && v.snippet);
  if (!critical.length) {
    return { ok: true, text: input.text, patches: [] };
  }

  const instruction = buildViolationRepairInstruction(critical, input.locale);
  const system = input.locale.startsWith("zh")
    ? `你是合规补丁编辑。只输出 JSON：{"patches":[{"find":"原文精确子串","replace":"替换串"},...]}
规则：
1) find 必须是下方原文中【逐字存在】的最短违规子串（含标签里的黑名单词）
2) replace 为合规替代表达；保持标点与邻近字合理
3) 【禁止】输出整篇 Markdown / 解释 / 代码块包裹全文
4) 【禁止】改动未点名的句子；只有 patches 里声明的替换会被执行
5) 原文换行与 ## 标题由代码保留——你不得重排版`
    : `You are a compliance patch editor. Output ONLY JSON: {"patches":[{"find":"...","replace":"..."},...]}
Rules:
1) find must be an exact substring present in the original
2) replace is compliant vernacular
3) NEVER re-emit the full Markdown
4) Only declared patches are applied by code
5) Newlines / ## headings are preserved by code — do not reformat`;

  // Cap context: violations + short snippets; include full text so find can be exact
  // but ask for patches only (max_tokens small).
  try {
    const result = await openRouterChatCompletion({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `${instruction}\n\n---ORIGINAL (find must match exactly; do not rewrite)---\n${input.text}\n---END---`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1200,
      json_mode: true,
      reasoning_effort: "medium",
      session_id: input.session_id,
      call_type: "base_analysis_repair",
      phase_name: "base_analysis_repair_patches",
      signal: input.signal,
    });

    const patches = parsePatchesJson(result.text ?? "");
    if (!patches || patches.length === 0) {
      console.warn("[fallback] repairViolationsOnly: no patches parsed", {
        finish_reason: result.finish_reason,
        preview: (result.text ?? "").slice(0, 160),
      });
      return { ok: false, error: "repair_patches_empty" };
    }

    try {
      const fixed = applyRepairPatches(input.text, patches);
      return { ok: true, text: fixed, patches };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[fallback] repairViolationsOnly: patch apply failed", {
        reason: msg,
        patches: patches.slice(0, 4),
      });
      return { ok: false, error: msg };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[fallback] repairViolationsOnly failed", { reason: msg });
    return { ok: false, error: msg };
  }
}
