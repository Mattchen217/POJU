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
    ? `你是合规补丁编辑。只输出 JSON：{"patches":[{"find":"原文整句","replace":"改写后整句"},...]}
规则：
1) 找到【包含违规词的那一整句】（以句号/问号/感叹号/换行或 Markdown 行边界切），重写这一句，使其自然通顺且不含任何禁词/黑名单词
2) 【只改点名的句子】；未点名段落一字不动
3) 【不要】追求「最短片段」替换——只换单字常会语法不通（如「引擎」→「转化力」变成「一台燃烧的转化力」）
4) 【禁止】输出整篇 Markdown / 解释；只有 patches 会被代码执行
5) find 必须逐字存在于原文；原文换行与 ## 由代码保留`
    : `You are a compliance patch editor. Output ONLY JSON: {"patches":[{"find":"<exact full sentence>","replace":"<rewritten sentence>"},...]}
Rules:
1) Find the FULL sentence containing the violation; rewrite that sentence so it is natural and contains no banned/blacklist words
2) Change only named sentences; leave all other paragraphs untouched
3) Do NOT prefer shortest-token swaps — they often break grammar
4) NEVER re-emit the full Markdown
5) find must be an exact substring; newlines / ## are preserved by code`;

  try {
    const result = await openRouterChatCompletion({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `${instruction}\n\n---ORIGINAL (find must match exactly; do not rewrite the whole doc)---\n${input.text}\n---END---`,
        },
      ],
      temperature: 0.1,
      max_tokens: 3000,
      json_mode: true,
      // Mechanical patching — deep reasoning burns the budget and finish=length with empty JSON.
      reasoning_effort: "off",
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
