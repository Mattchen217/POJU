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

/** Private gloss markup — UI parses `⟦g|display|plain⟧`. */
export const GLOSS_TOKEN_PATTERN = /⟦g\|((?:\\.|[^|\\])*)\|((?:\\.|[^|]|\\[^⟧])*?)⟧/g;

function escapeGlossPart(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/⟧/g, "\\⟧");
}

export function unescapeGlossPart(s: string): string {
  return s.replace(/\\(.)/g, "$1");
}

export function encodeGlossToken(display: string, plain: string): string {
  return `⟦g|${escapeGlossPart(display)}|${escapeGlossPart(plain)}⟧`;
}

/** Compact display-only form for LLM history (no plain text — cache-stable). */
export function stripGlossTokensForPrompt(text: string): string {
  return text.replace(GLOSS_TOKEN_PATTERN, (_, display: string) => unescapeGlossPart(display));
}

export type ParsedGlossToken = { display: string; plain: string; raw: string };

export function parseGlossTokens(text: string): ParsedGlossToken[] {
  const out: ParsedGlossToken[] = [];
  GLOSS_TOKEN_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GLOSS_TOKEN_PATTERN.exec(text)) !== null) {
    out.push({
      display: unescapeGlossPart(m[1]),
      plain: unescapeGlossPart(m[2]),
      raw: m[0],
    });
  }
  return out;
}

function findReplaceConcept(term: string): GlossaryConcept | undefined {
  const t = term.trim();
  const tl = t.toLowerCase();
  return TERM_GLOSSARY.find(
    (c) =>
      c.surface === "replace" &&
      c.forbidden_variants.some((v) => v === t || v.toLowerCase() === tl),
  );
}

function conceptToGlossToken(c: GlossaryConcept, locale: string): string {
  const loc = toGlossaryLocale(locale);
  const display = c.soft[loc] || c.soft.zh || c.soft.en;
  const plain = c.gloss[loc] || c.gloss.en;
  return encodeGlossToken(display, plain);
}

function sortedReplaceEntries(locale: string): Array<{ term: string; concept: GlossaryConcept }> {
  const loc = toGlossaryLocale(locale);
  const isZh = loc === "zh";
  const entries: Array<{ term: string; concept: GlossaryConcept }> = [];
  for (const c of TERM_GLOSSARY) {
    if (c.surface !== "replace") continue;
    for (const v of c.forbidden_variants) {
      const zh = isChineseVariant(v);
      if (isZh && !zh) continue;
      if (!isZh && zh) continue;
      entries.push({ term: v, concept: c });
    }
  }
  entries.sort((a, b) => b.term.length - a.term.length);
  return entries;
}

function applySortedTermReplacements(text: string, locale: string): string {
  let result = text;
  for (const { term, concept } of sortedReplaceEntries(locale)) {
    const token = conceptToGlossToken(concept, locale);
    if (isChineseVariant(term)) {
      if (!result.includes(term)) continue;
      result = result.split(term).join(token);
    } else {
      const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
      result = result.replace(re, token);
    }
  }
  return result;
}

function applyZhRegexReplacements(text: string, locale: string): string {
  let result = text;
  const loc = toGlossaryLocale(locale);

  const guiren = TERM_GLOSSARY.find((c) => c.id === "贵人");
  const dayMaster = TERM_GLOSSARY.find((c) => c.id === "日主");
  const yong = TERM_GLOSSARY.find((c) => c.id === "用神");

  const repl = (regex: RegExp, concept: GlossaryConcept | undefined, displayFn: (m: string) => string) => {
    if (!concept) return;
    regex.lastIndex = 0;
    result = result.replace(regex, (match) => {
      const display = displayFn(match);
      const plain = concept.gloss[loc] || concept.gloss.en;
      return encodeGlossToken(display, plain);
    });
  };

  repl(ZH_STEM_ELEMENT_REGEX, dayMaster, (m) => `核心特质（${m}）`);
  repl(ZH_STEM_BRANCH_REGEX, TERM_GLOSSARY.find((c) => c.id === "大运流年"), (m) => `人生阶段（${m}）`);
  repl(ZH_WUXING_YONGXI_REGEX, yong, (m) => `关键平衡（${m}）`);
  repl(ZH_GUIRen_REGEX, guiren, (m) => guiren!.soft[loc] || m);
  repl(ZH_WUXING_ELEMENT_CONTEXT_REGEX, yong, (m) => `能量特质（${m}）`);

  return result;
}

function applyEnRegexReplacements(text: string, locale: string): string {
  let result = text;
  const loc = toGlossaryLocale(locale);
  const yong = TERM_GLOSSARY.find((c) => c.id === "用神");

  const repl = (regex: RegExp, concept: GlossaryConcept | undefined) => {
    if (!concept) return;
    const token = conceptToGlossToken(concept, locale);
    regex.lastIndex = 0;
    result = result.replace(regex, token);
  };

  repl(EN_FAVORABLE_ELEMENT_REGEX, yong);
  repl(EN_UNFAVORABLE_ELEMENT_REGEX, TERM_GLOSSARY.find((c) => c.id === "忌神"));
  repl(EN_WUXING_ELEMENT_COMBO_REGEX, yong);

  return result;
}

function applyTermGlossReplacements(text: string, locale: string): string {
  if (!text?.trim()) return text;
  let result = filterDeletedTerms(text);
  result = applySortedTermReplacements(result, locale);
  const loc = toGlossaryLocale(locale);
  if (loc === "zh") {
    result = applyZhRegexReplacements(result, locale);
  } else {
    result = applyEnRegexReplacements(result, locale);
    result = applyZhRegexReplacements(result, locale);
  }
  return result;
}

/** Sanitize all string values in a JSON-like tree (user-visible fields only). */
export function sanitizeDeepStringFields(value: unknown, locale: string): unknown {
  if (typeof value === "string") {
    return applyComplianceSanitize(value, locale).text;
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeDeepStringFields(v, locale));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeDeepStringFields(v, locale);
    }
    return out;
  }
  return value;
}

const DELIVERY_MARKER_RE =
  /(═══\s*(?:ANALYSIS|CONCLUSION|WHAT\s+(?:TO\s+DO|YOU\s+CAN\s+DO)|COMING\s+BACK)\s*═══)/gi;

/** Sanitize POJU final delivery — preserve ═══ marker lines. */
export function sanitizeDeliveryText(fullText: string, locale: string): string {
  const parts = fullText.split(DELIVERY_MARKER_RE);
  return parts
    .map((part, i) => (i % 2 === 1 ? part : applyComplianceSanitize(part, locale).text))
    .join("");
}

/** @deprecated Prompt no longer carries term tables — output-side sanitize handles terms. */
export function buildComplianceTranslationPromptBlock(_locale: Locale = "en"): string {
  return `# 术语输出说明

可自然使用命理术语（日主/丙火/用神/大运等）与中文；**输出端会自动软翻译并附白话解释**。
你只需遵守六条语义红线（不预测/不算命/不占卜/不决吉凶/不恐吓/不超自然承诺）。`;
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
 * Output-side sanitize: term fingerprint → gloss tokens; red-line semantics → audit only.
 */
export function applyComplianceSanitize(text: string, locale: string): ComplianceSanitizeResult {
  if (!text?.trim()) {
    return { text: text ?? "", violationsBefore: [], violationsAfter: [] };
  }

  const violationsBefore = detectComplianceViolations(text, locale);
  const replaced = applyTermGlossReplacements(text, locale);
  const violationsAfter = detectComplianceViolations(replaced, locale);

  const redLineAfter = detectOutputPolicyViolations(replaced, locale);
  if (redLineAfter.length > 0) {
    console.error(
      `[compliance-audit] Red-line hits after sanitize (${redLineAfter.length}, locale=${locale}):`,
      redLineAfter.slice(0, 5),
    );
  }

  if (violationsBefore.length > 0) {
    const termHits = violationsBefore.filter((v) => v.label.startsWith("term:"));
    if (termHits.length > 0) {
      console.log(
        `[compliance-sanitize] terms replaced: ${termHits.length} → gloss tokens (locale=${locale})`,
      );
    }
  }

  return { text: replaced, violationsBefore, violationsAfter };
}

export { auditOutputPolicyText, detectOutputPolicyViolations, toGlossaryLocale };
export type { GlossaryConcept, Locale };
