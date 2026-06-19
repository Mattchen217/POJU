/**
 * Shared blacklist → whitelist term maps for LLM output compliance.
 * Prompt translation suggestions + audit detection (audit-only, no mutation).
 * Single glossary source: lib/glossary/term-glossary.ts
 * @see lib/llm/compliance/output-policy.ts — prompt defense blocks
 * @see lib/llm/compliance/audit-output.ts — detection rules
 */

import {
  AUDIT_ALLOW_LABELS,
  EN_TERM_MAP,
  FORBIDDEN_VARIANTS_ALL,
  TERM_GLOSSARY,
  ZH_TERM_MAP,
  type GlossaryConcept,
  type Locale,
  toGlossaryLocale,
} from "@/lib/glossary/term-glossary";
import {
  auditOutputPolicyText,
  detectOutputPolicyViolations,
} from "@/lib/llm/compliance/audit-output";

export { EN_TERM_MAP, ZH_TERM_MAP };

export const COMPLIANCE_MASK = "…";

const ZH_STEMS = "甲乙丙丁戊己庚辛壬癸";
const ZH_BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const ZH_WUXING = "金木水火土";

/** 喜/忌/喜用 + 五行 — only bazi combos, not daily 木桌 */
export const ZH_WUXING_YONGXI_REGEX = new RegExp(
  `(?:喜用|喜|忌|用)[用]?[${ZH_WUXING}]{1,4}`,
  "g",
);

export const ZH_STEM_ELEMENT_REGEX = new RegExp(`[${ZH_STEMS}][${ZH_WUXING}]`, "g");
export const ZH_STEM_BRANCH_REGEX = new RegExp(`[${ZH_STEMS}][${ZH_BRANCHES}]`, "g");

/** 五行 as element context only — not bare 金/木 in daily speech */
export const ZH_WUXING_ELEMENT_CONTEXT_REGEX = new RegExp(
  `[${ZH_WUXING}](?:元素|行|气|旺|弱|重|轻|偏多|偏少|不足|过重)`,
  "g",
);

export const ZH_GUIRen_REGEX = /贵人(?:运|星|显|扶持|相助|助力|出现|临门|照命|帮身)?/g;

/** EN: favorable/your + Wood/Fire — bazi context only */
export const EN_WUXING_ELEMENT_COMBO_REGEX =
  /\b(?:favorable|unfavorable|beneficial|your|as\s+(?:a\s+)?)\s*(?:Wood|Fire|Earth|Metal|Water)\b/gi;

export const EN_FAVORABLE_ELEMENT_REGEX =
  /\bF(?:avorable|avourable)\s+(?:Wood|Fire|Earth|Metal|Water|Element|Elements)\b/gi;

export const EN_UNFAVORABLE_ELEMENT_REGEX =
  /\bUnfavorable\s+(?:Wood|Fire|Earth|Metal|Water|Element|Elements)\b/gi;

/** EN Defense 2 — quoted maxims after wisdom prefix (audit). */
export const EN_QUOTED_MAXIM_PREFIX_REGEX =
  /(?:ancient wisdom|the saying|classical verse|old maxim|quoted maxim|the verse|sign poem|the line reads)[:\s,—-]+['"]/gi;

/** @deprecated Too many false positives on English possessives — use EN_QUOTED_MAXIM_PREFIX_REGEX only. */
export const EN_QUOTED_STRING_REGEX = /['"][^'"]{10,}['"]/g;

/** EN Defense 2 — warrior/figure story sequence (audit). */
export const EN_WARRIOR_WHO_REGEX =
  /\b(?:a|the)\s+(?:warrior|figure|hero|general|soldier|scholar|monk|sage|emperor|minister|lord)\s+who\b/gi;

export const EN_STORY_SEQUENCE_VERB_REGEX =
  /\bwho\s+(?:was|were|had been)\s+(?:defeated|captured|imprisoned|exiled|recalled|rescued|escaped|banished)/gi;

export const EN_STORY_SEQUENCE_NARRATIVE_REGEX =
  /\b(?:defeat(?:ed)?|capture(?:d)?|escape(?:d)?|recall(?:ed)?|exile(?:d)?).{0,80}(?:defeat|capture|escape|recall|exile|return)/gi;

export type ComplianceViolation = {
  label: string;
  snippet: string;
};

function snippetAround(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + len + 20);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isChineseVariant(v: string): boolean {
  return /[\u4e00-\u9fff]/.test(v);
}

function shouldSkipAuditTerm(term: string): boolean {
  if (AUDIT_ALLOW_LABELS.has(term)) return true;
  for (const label of AUDIT_ALLOW_LABELS) {
    if (term.toLowerCase() === label.toLowerCase()) return true;
  }
  return false;
}

/** Hard-filter delete-class terms (religious/deity) — the only allowed post-hoc rewrite. */
export function filterDeletedTerms(text: string): string {
  if (!text?.trim()) return text;
  let result = text;
  for (const c of TERM_GLOSSARY) {
    if (c.surface !== "delete") continue;
    for (const term of c.forbidden_variants) {
      if (isChineseVariant(term)) {
        result = result.split(term).join("");
      } else {
        const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
        result = result.replace(re, "");
      }
    }
  }
  return result.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

/** Inject full replace + delete + allow tables for prompt rendering. */
export function buildComplianceTranslationPromptBlock(locale: Locale = "en"): string {
  const replaceRows = TERM_GLOSSARY.filter((c) => c.surface === "replace")
    .map((c) => `· ${c.forbidden_variants.join(" / ")} → ${c.soft[locale]}`)
    .join("\n");
  const deleteRows = TERM_GLOSSARY.filter((c) => c.surface === "delete")
    .map((c) => c.forbidden_variants.join(" / "))
    .join(" / ");
  const allowRows = TERM_GLOSSARY.filter((c) => c.surface === "allow")
    .map((c) => c.soft[locale] + (c.hanzi ? `(${c.hanzi})` : ""))
    .join(" / ");

  return `# 术语渲染规则（自由思考，按表输出 · 最高优先级）

你可以**在内部用任何专业术语自由推演**（八字/奇门/用神/六合…不受限）。
但**最终面向用户的每一个字符串**，必须按下表把"违禁词"渲染成"软词"——**绝不让违禁词原形出现在输出里**。

## 替换表（违禁词 → 软词，本次输出语言）
${replaceRows}

## 直接删除（绝不上屏，含同义/外文变体；如底层签文含神祇名，过滤为空）
${deleteRows}

## 允许直接输出（不替换，文化灵魂）
${allowRows}

规则：
- 软词后**就近一句大白话**可选——但不必堆砌；白话主要由 UI 负责，你只需输出软词本身。
- 时机/结果相邻处（大运/流年/奇门窗口）措辞为"决策支持/能量节律"，**不报具体日期、不下吉凶**。
- 自检：输出前扫一遍，任何违禁词原形 = 必须换成软词或删除。`;
}

/** Detect policy + glossary forbidden terms (audit-only). Does NOT flag allow-list labels. */
export function detectComplianceViolations(text: string, locale: string): ComplianceViolation[] {
  if (!text?.trim()) return [];
  const violations: ComplianceViolation[] = [];
  const isZh = locale.startsWith("zh");

  for (const v of detectOutputPolicyViolations(text, locale)) {
    violations.push({ label: `${v.category}:${v.label}`, snippet: v.snippet });
  }

  const pushRegex = (regex: RegExp, label: string) => {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      violations.push({
        label,
        snippet: snippetAround(text, m.index, m[0].length),
      });
    }
  };

  if (isZh) {
    pushRegex(ZH_STEM_ELEMENT_REGEX, "stem_element");
    pushRegex(ZH_WUXING_YONGXI_REGEX, "wuxing_yongxi");
    pushRegex(ZH_GUIRen_REGEX, "guiren");
    for (const term of FORBIDDEN_VARIANTS_ALL) {
      if (!isChineseVariant(term) || term.length < 2) continue;
      if (shouldSkipAuditTerm(term)) continue;
      if (text.includes(term)) {
        violations.push({
          label: `term:${term}`,
          snippet: snippetAround(text, text.indexOf(term), term.length),
        });
      }
    }
  } else {
    pushRegex(EN_QUOTED_MAXIM_PREFIX_REGEX, "quoted_maxim_prefix");
    pushRegex(EN_WARRIOR_WHO_REGEX, "warrior_who_narrative");
    pushRegex(EN_STORY_SEQUENCE_VERB_REGEX, "story_sequence_verb");
    pushRegex(EN_STORY_SEQUENCE_NARRATIVE_REGEX, "story_sequence_narrative");
    for (const term of FORBIDDEN_VARIANTS_ALL) {
      if (isChineseVariant(term)) continue;
      if (shouldSkipAuditTerm(term)) continue;
      const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
      const m = re.exec(text);
      if (m) {
        violations.push({
          label: `term:${term}`,
          snippet: snippetAround(text, m.index, m[0].length),
        });
      }
    }
  }

  const seen = new Set<string>();
  return violations.filter((v) => {
    const key = `${v.label}:${v.snippet}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type ComplianceSanitizeResult = {
  text: string;
  violationsBefore: ComplianceViolation[];
  violationsAfter: ComplianceViolation[];
};

/**
 * Audit-only — detects black-word hits, applies delete-class hard filter, returns filtered text.
 */
export function applyComplianceSanitize(text: string, locale: string): ComplianceSanitizeResult {
  const violationsBefore = detectComplianceViolations(text, locale);
  const filtered = filterDeletedTerms(text);
  const violationsAfter = detectComplianceViolations(filtered, locale);

  if (violationsBefore.length > 0) {
    console.error(
      `[compliance-audit] Black-word hits (${violationsBefore.length}, locale=${locale}):`,
      violationsBefore,
    );
  }

  return { text: filtered, violationsBefore, violationsAfter };
}

export { auditOutputPolicyText, detectOutputPolicyViolations, toGlossaryLocale };
export type { GlossaryConcept, Locale };
