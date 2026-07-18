/**
 * Surgical repair after delivery-gate failure.
 * Code locates the violation LINE; model only rewrites that one line;
 * code replaces by line index — never ask the model to construct `find`.
 */

import {
  BANNED_TERM_SOFT_ZH,
  METAPHOR_BLACKLIST_ZH,
} from "@/lib/llm/compliance/banned-terms";
import type { ComplianceViolation } from "@/lib/llm/sanitize/compliance-terms";
import {
  openRouterChatCompletion,
} from "@/lib/llm/openrouter-shared";

export type LineRepair = {
  lineIdx: number;
  original: string;
  rewritten: string;
  label: string;
};

export type RepairViolationsInput = {
  text: string;
  violations: ComplianceViolation[];
  locale: string;
  session_id?: string;
  signal?: AbortSignal;
  profile_id?: string;
};

export type RepairViolationsResult =
  | { ok: true; text: string; line_repairs: LineRepair[] }
  | { ok: false; error: string; detail?: string };

/** Compact for cross-matching softVisible snippets vs markdown source lines. */
export function compactForLineMatch(s: string): string {
  return s
    .replace(/\*+/g, "")
    .replace(/^[>|]+\s*/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/** Needle from violation label (term:引擎 / metaphor → 引擎 / stem_element → snippet). */
export function violationNeedle(v: ComplianceViolation): string {
  if (v.label === "metaphor_blacklist") {
    for (const phrase of METAPHOR_BLACKLIST_ZH) {
      if (v.snippet.includes(phrase)) return phrase;
    }
    return "引擎";
  }
  if (v.label.startsWith("term:")) {
    return v.label.slice("term:".length);
  }
  if (v.label.startsWith("out_of_set_marker_id:")) {
    return v.label.slice("out_of_set_marker_id:".length);
  }
  if (v.label === "marker_visible_ganzhi" || v.label === "stem_element") {
    const m = v.snippet.match(/[甲乙丙丁戊己庚辛壬癸][木火土金水]?/);
    if (m) return m[0]!;
  }
  // First substantial Han / latin run from snippet
  const run = v.snippet.match(/[\u4e00-\u9fff]{2,12}|[A-Za-z_]{3,24}/);
  return run?.[0] ?? v.snippet.slice(0, 12);
}

/**
 * Deterministic line index from audit snippet / needle.
 * Soft-visible snippets often lack `**` / `>` — match after stripping markdown noise.
 */
export function locateViolationLine(
  text: string,
  violation: ComplianceViolation,
): number {
  const lines = text.split("\n");
  const snippetCompact = compactForLineMatch(violation.snippet);
  const needle = violationNeedle(violation);

  if (snippetCompact.length >= 4) {
    const probe = snippetCompact.slice(0, Math.min(32, snippetCompact.length));
    for (let i = 0; i < lines.length; i++) {
      const lc = compactForLineMatch(lines[i]!);
      if (lc.includes(probe) || (probe.length >= 8 && probe.includes(lc) && lc.length >= 8)) {
        return i;
      }
    }
  }

  if (needle.length >= 2) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.includes(needle)) return i;
    }
  }

  return -1;
}

/** @deprecated find/replace patches — kept for unit tests of string apply only. */
export type RepairPatch = { find: string; replace: string };

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

export function applyLineRepairs(
  text: string,
  repairs: ReadonlyArray<{ lineIdx: number; rewritten: string }>,
): string {
  const lines = text.split("\n");
  for (const r of repairs) {
    if (r.lineIdx < 0 || r.lineIdx >= lines.length) {
      throw new Error(`repair_line_oob:${r.lineIdx}`);
    }
    lines[r.lineIdx] = r.rewritten;
  }
  return lines.join("\n");
}

function bannedHintsForViolation(v: ComplianceViolation, locale: string): string {
  if (!locale.startsWith("zh")) return v.label;
  if (v.label === "metaphor_blacklist") {
    return `黑名单词（字面禁，含否定式）：${METAPHOR_BLACKLIST_ZH.join(" / ")}`;
  }
  if (v.label.startsWith("term:")) {
    const term = v.label.slice("term:".length);
    const soft = BANNED_TERM_SOFT_ZH[term];
    return soft ? `禁词「${term}」→ 可改为「${soft}」或同义白话` : `禁词「${term}」`;
  }
  if (v.label === "stem_element" || v.label === "marker_visible_ganzhi") {
    return "禁裸干支 /「乙木丙火」类合称；软译用纯白话";
  }
  if (v.label.startsWith("marker_plain_banned")) {
    return "标记贴题白话格禁裸干支/十神原词/命字族/黑名单比喻——改成纯机制白话（术语由系统填）";
  }
  if (v.label.startsWith("out_of_set_marker_id:")) {
    return "自造或不在闭集的标记 id → 拆掉标记，改成纯白话（不要再打 ⟦t:…⟧）";
  }
  return `违规：${v.label}`;
}

function stripWrappingQuotes(raw: string): string {
  let t = raw.trim();
  // Drop accidental fences / labels
  t = t.replace(/^```[\s\S]*?\n/, "").replace(/\n```$/, "").trim();
  t = t.replace(/^改写后[：:]\s*/i, "").trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'")) ||
    (t.startsWith("「") && t.endsWith("」")) ||
    (t.startsWith("“") && t.endsWith("”"))
  ) {
    t = t.slice(1, -1).trim();
  }
  // Model sometimes returns multi-line; keep first non-empty line only
  const first = t.split(/\r?\n/).map((l) => l.trimEnd()).find((l) => l.length > 0);
  return first ?? "";
}

/**
 * Ask model for ONE rewritten line — never the full doc, never a find string.
 */
export async function rewriteViolationLine(input: {
  originalLine: string;
  violation: ComplianceViolation;
  locale: string;
  session_id?: string;
  signal?: AbortSignal;
}): Promise<string | null> {
  const hints = bannedHintsForViolation(input.violation, input.locale);
  const zh = input.locale.startsWith("zh");
  const system = zh
    ? `你是合规单行编辑。只输出【改写后的这一行】本身，不要解释、不要 JSON、不要引号包裹、不要重吐全文。
规则：
1) 完整保留原有格式标记与前缀（如行首的 > 、缩进、**加粗**、: 、⟦t:…⟧ 的结构若仍合规可留）
2) 去掉/改写违规内容，使该行自然通顺且不含任何禁词（含否定式提及也不行）
3) 不要新增其它段落或换行`
    : `You are a single-line compliance editor. Output ONLY the rewritten line — no explanation, no JSON, no wrapping quotes, no full document.
Rules:
1) Preserve markdown prefixes (>, indentation, **bold**, :)
2) Remove/rewrite the violation so the line is natural and ban-word-free (including negated mentions)
3) Do not add other paragraphs or newlines`;

  const user = zh
    ? `原行：
${input.originalLine}

违规标签：${input.violation.label}
上下文片段：${input.violation.snippet.slice(0, 80)}
${hints}

请只返回改写后的这一行：`
    : `Original line:
${input.originalLine}

Violation: ${input.violation.label}
Snippet: ${input.violation.snippet.slice(0, 80)}
${hints}

Return only the rewritten line:`;

  const result = await openRouterChatCompletion({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.1,
    max_tokens: 1400,
    json_mode: false,
    reasoning_effort: "off",
    session_id: input.session_id,
    call_type: "base_analysis_repair",
    phase_name: "base_analysis_repair_line",
    signal: input.signal,
  });

  // 截断 = 残篇。这个函数的返回值会【覆盖原文】—— 残篇覆盖完整报告 = 用户看到半句话。
  // 2026-07-17 生产:1,957 tok 输入 / max_tokens 1,400 → length → 页面停在「…找到一个」。
  // 确定性失败,重发无用(铁律 #8),必须丢弃并让上游走整篇重生成。
  if (result.finish_reason === "length") {
    console.error(
      "[repair] 输出被 max_tokens 截断 —— 丢弃，绝不用残篇覆盖原文。",
      {
        max_tokens: 1400,
        input_chars: input.originalLine.length,
        violation: input.violation.label,
        tail: (result.text ?? "").slice(-40),
      },
    );
    return null;
  }

  const line = stripWrappingQuotes(result.text ?? "");
  if (!line) return null;
  return line;
}

/**
 * Locate violation lines → rewrite each once → replace by line index.
 */
export async function repairViolationsOnly(
  input: RepairViolationsInput,
): Promise<RepairViolationsResult> {
  const critical = input.violations.filter((v) => v.label && v.snippet);
  if (!critical.length) {
    return { ok: true, text: input.text, line_repairs: [] };
  }

  // 金字不够 = 锚点不够 —— 单行 repair 只会硬塞标记，必须整篇重生成。
  if (
    critical.some(
      (v) =>
        v.label.startsWith("evidence_marks_thin") || v.label === "evidence_block_missing",
    )
  ) {
    console.error("[repair] evidence density / missing block — refuse surgical repair, need full regen", {
      labels: critical.map((v) => v.label),
    });
    return {
      ok: false,
      error: "repair_unrepaireable_evidence_density",
      detail: critical
        .filter(
          (v) =>
            v.label.startsWith("evidence_marks_thin") || v.label === "evidence_block_missing",
        )
        .map((v) => v.label)
        .join(","),
    };
  }

  const lines = input.text.split("\n");

  // 这是【行级】编辑器:按行号定位、按行号打补丁。
  // 如果整篇只有 1-2 行,说明上游把换行洗掉了 —— 此时 lines[idx] = 整篇,
  // 会被当成"一行"塞进 max_tokens:1400 → 必然截断 → 残篇覆盖原文。
  // 宁可整篇重生成,也不能在这种输入上动刀。
  if (lines.length <= 2 && input.text.length > 400) {
    console.error(
      "[repair] 输入不是行级的 —— 拒绝改写。换行在上游清洗链里就没了(查 compliance-terms 的 /\\s{2,}/ 系列)。",
      { lines: lines.length, chars: input.text.length, head: input.text.slice(0, 120) },
    );
    return {
      ok: false,
      error: "repair_input_not_line_split",
      detail: `lines=${lines.length} chars=${input.text.length}`,
    };
  }

  const lineRepairs: LineRepair[] = [];
  const doneLines = new Set<number>();

  try {
    for (const v of critical.slice(0, 8)) {
      const lineIdx = locateViolationLine(input.text, v);
      if (lineIdx < 0) {
        const detail = `label=${v.label}; snippet=${v.snippet.slice(0, 60)}`;
        console.error("[repair] patch application FAILED — line not found", {
          profile_id: input.profile_id,
          violation: v.label,
          snippet_preview: v.snippet.slice(0, 80),
        });
        return { ok: false, error: "repair_line_not_found", detail };
      }
      if (doneLines.has(lineIdx)) continue;
      doneLines.add(lineIdx);

      const originalLine = lines[lineIdx]!;
      const rewritten = await rewriteViolationLine({
        originalLine,
        violation: v,
        locale: input.locale,
        session_id: input.session_id,
        signal: input.signal,
      });

      if (!rewritten) {
        console.error("[repair] patch application FAILED — empty rewrite", {
          profile_id: input.profile_id,
          violation: v.label,
          lineIdx,
          original_preview: originalLine.slice(0, 80),
        });
        return { ok: false, error: "repair_line_empty", detail: originalLine.slice(0, 80) };
      }

      // Must still be a single line
      if (rewritten.includes("\n")) {
        console.error("[repair] patch application FAILED — multi-line rewrite", {
          profile_id: input.profile_id,
          violation: v.label,
          lineIdx,
        });
        return { ok: false, error: "repair_line_multiline", detail: rewritten.slice(0, 80) };
      }

      lines[lineIdx] = rewritten;
      lineRepairs.push({
        lineIdx,
        original: originalLine,
        rewritten,
        label: v.label,
      });
    }

    return { ok: true, text: lines.join("\n"), line_repairs: lineRepairs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[repair] patch application FAILED — falling back to full regeneration", {
      profile_id: input.profile_id,
      reason: msg,
    });
    return { ok: false, error: msg };
  }
}
