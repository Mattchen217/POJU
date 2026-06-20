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
import {
  BARE_SIGN_POEM_PATTERN,
  buildTermMarkingPromptBlock,
  buildTermMarkingFewShot,
  detectBrokenMarkers,
  encodeTermMarker,
  maskMarkersForAudit,
  parseTermMarkers,
  plainByTermId,
  stripBrokenMarkers,
  stripMarkersForPrompt,
  TERM_ENTRIES,
  TERM_MARKER_PATTERN,
  type ParsedTermMarker,
  type TermEntry,
  uiTermById,
  unescapeMarkerPart,
} from "@/lib/llm/sanitize/term-marking";

export {
  BARE_SIGN_POEM_PATTERN,
  buildTermMarkingPromptBlock,
  buildTermMarkingFewShot,
  encodeTermMarker,
  parseTermMarkers,
  plainByTermId,
  stripBrokenMarkers,
  stripMarkersForPrompt,
  TERM_ENTRIES,
  TERM_MARKER_PATTERN,
  type ParsedTermMarker,
  type TermEntry,
  uiTermById,
  unescapeMarkerPart,
};

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

/** Compact display-only form for LLM history (legacy gloss + term markers). */
export function stripGlossTokensForPrompt(text: string): string {
  const noLegacy = text.replace(GLOSS_TOKEN_PATTERN, (_, display: string) =>
    unescapeGlossPart(display),
  );
  return stripMarkersForPrompt(noLegacy);
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

function primarySoftLabel(c: GlossaryConcept, locale: string): string {
  const loc = toGlossaryLocale(locale);
  const soft = c.soft[loc] || c.soft.en;
  return soft.split(/\s*\/\s*/)[0]!.trim();
}

function buildLocalizedGlossDisplay(
  concept: GlossaryConcept,
  locale: string,
  termHanzi?: string,
): string {
  const label = primarySoftLabel(concept, locale);
  const term = termHanzi?.trim();
  if (!term) return label;
  const loc = toGlossaryLocale(locale);
  if (loc === "zh") return `${label}（${term}）`;
  return `${label} (${term})`;
}

function conceptToGlossToken(c: GlossaryConcept, locale: string, termHanzi?: string): string {
  const loc = toGlossaryLocale(locale);
  const display = buildLocalizedGlossDisplay(c, locale, termHanzi);
  const plain = c.gloss[loc] || c.gloss.en;
  return encodeGlossToken(display, plain);
}

const EUPHEMISM_BEFORE_GLOSS_RE =
  /\b(?:(?:represented by|as a|your)\s+)?(?:life phase theme|life cycle\s*\/?\s*life phase|profile\s*\/?\s*personality profile|personality profile|core trait theme)\s+\(\s*(⟦g\|(?:\\.|[^|\\])*?\|(?:\\.|[^|]|\\[^⟧])*?⟧)\s*\)/gi;

/** Remove model-stacked Chinese label wrappers before gloss (EN locale bleed). */
function stripNestedChineseLabelWrappers(text: string, locale: string): string {
  if (toGlossaryLocale(locale) === "zh") return text;
  return text
    .replace(/核心特质[（(]([甲乙丙丁戊己庚辛壬癸][金木水火土])[）)]/g, "$1")
    .replace(/人生阶段[（(]([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[）)]/g, "$1")
    .replace(/流年能量[（(]([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[）)]/g, "$1");
}

/** Strip leftover model euphemisms once gloss tokens exist. */
function collapseDoubleTranslation(text: string): string {
  let result = text;
  result = result.replace(EUPHEMISM_BEFORE_GLOSS_RE, "$1");
  result = result.replace(
    /\b([A-Za-z][A-Za-z\s/]{2,48}?)\s+\(\s*(⟦g\|(?:\\.|[^|\\])*?\|(?:\\.|[^|]|\\[^⟧])*?⟧)\s*\)/g,
    "$2",
  );
  result = result.replace(/\b(?:represented by|as a|your)\s+/gi, "");
  result = result.replace(/\blife phase theme\b/gi, "");
  result = result.replace(/\bprofile\s*\/?\s*personality profile\b/gi, "personality profile");
  return result;
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

function maskGlossTokens(text: string): { masked: string; slots: string[] } {
  const slots: string[] = [];
  const masked = text.replace(GLOSS_TOKEN_PATTERN, (m) => {
    slots.push(m);
    return `\uE000${slots.length - 1}\uE001`;
  });
  return { masked, slots };
}

function unmaskGlossTokens(text: string, slots: string[]): string {
  return text.replace(/\uE000(\d+)\uE001/g, (_, i) => slots[Number(i)] ?? "");
}

function replaceOnUnmaskedSegments(text: string, replacer: (segment: string) => string): string {
  const { masked, slots } = maskGlossTokens(text);
  return unmaskGlossTokens(replacer(masked), slots);
}
function applySortedTermReplacements(text: string, locale: string): string {
  return replaceOnUnmaskedSegments(text, (segment) => {
    let result = segment;
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
  });
}

function applyZhRegexReplacements(text: string, locale: string): string {
  let result = text;
  const loc = toGlossaryLocale(locale);

  const guiren = TERM_GLOSSARY.find((c) => c.id === "贵人");
  const dayMaster = TERM_GLOSSARY.find((c) => c.id === "日主");
  const dayun = TERM_GLOSSARY.find((c) => c.id === "大运");
  const liunian = TERM_GLOSSARY.find((c) => c.id === "流年");
  const yong = TERM_GLOSSARY.find((c) => c.id === "用神");

  const replToken = (
    regex: RegExp,
    concept: GlossaryConcept | undefined,
    displayFn: (m: string) => string,
  ) => {
    if (!concept) return;
    result = replaceOnUnmaskedSegments(result, (segment) => {
      regex.lastIndex = 0;
      return segment.replace(regex, (...args) => {
        const match = args[0] as string;
        const captures = args.slice(1, args.length - 2) as string[];
        const termRef = captures.find((c) => typeof c === "string" && c.length > 0) ?? match;
        const display = displayFn(termRef);
        const plain = concept.gloss[loc] || concept.gloss.en;
        return encodeGlossToken(display, plain);
      });
    });
  };

  replToken(/大运([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/g, dayun, (m) =>
    buildLocalizedGlossDisplay(dayun!, locale, m),
  );
  replToken(/流年([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/g, liunian, (m) =>
    buildLocalizedGlossDisplay(liunian!, locale, m),
  );
  replToken(/大运[：:\s]+([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/g, dayun, (m) =>
    buildLocalizedGlossDisplay(dayun!, locale, m),
  );
  replToken(/流年[：:\s]+([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/g, liunian, (m) =>
    buildLocalizedGlossDisplay(liunian!, locale, m),
  );
  replToken(ZH_STEM_ELEMENT_REGEX, dayMaster, (m) =>
    buildLocalizedGlossDisplay(dayMaster!, locale, m),
  );
  replToken(ZH_STEM_BRANCH_REGEX, liunian, (m) =>
    buildLocalizedGlossDisplay(liunian!, locale, m),
  );
  replToken(ZH_WUXING_YONGXI_REGEX, yong, (m) =>
    buildLocalizedGlossDisplay(yong!, locale, m.replace(/^[喜忌用]+/, "").trim() || m),
  );
  replToken(ZH_GUIRen_REGEX, guiren, () => primarySoftLabel(guiren!, locale));
  replToken(ZH_WUXING_ELEMENT_CONTEXT_REGEX, yong, (m) =>
    buildLocalizedGlossDisplay(yong!, locale, m),
  );

  return result;
}

function applyEnRegexReplacements(text: string, locale: string): string {
  return replaceOnUnmaskedSegments(text, (segment) => {
    let result = segment;
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
  });
}

function applyTermGlossReplacements(text: string, _locale: string): string {
  return text;
}

/** Walk JSON tree and audit string fields (no mutation). */
export function sanitizeDeepStringFields(value: unknown, locale: string): unknown {
  if (typeof value === "string") {
    auditDeliveredText(value, locale);
    return value;
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

/** Audit POJU final delivery — preserve ═══ marker lines; no mutation. */
export function sanitizeDeliveryText(fullText: string, locale: string): string {
  const parts = fullText.split(DELIVERY_MARKER_RE);
  parts.forEach((part, i) => {
    if (i % 2 === 0) auditDeliveredText(part, locale);
  });
  return fullText;
}

/** @deprecated Use buildTermMarkingPromptBlock — LLM marks terms at generation time. */
export function buildComplianceTranslationPromptBlock(_locale: Locale = "en"): string {
  return buildTermMarkingPromptBlock(_locale);
}

/** Read-only delivery audit: bare forbidden terms, bare sign poems, broken markers, red lines. */
export function auditDeliveredText(text: string, locale: string): ComplianceViolation[] {
  if (!text?.trim()) return [];
  const violations = detectComplianceViolations(maskMarkersForAudit(text), locale);

  if (detectBrokenMarkers(text)) {
    violations.push({ label: "broken_marker", snippet: snippetAround(text, text.indexOf("⟦"), 12) });
  }

  if (!locale.startsWith("zh")) {
    BARE_SIGN_POEM_PATTERN.lastIndex = 0;
    let m: RegExpExecArray | null;
    const masked = maskMarkersForAudit(text);
    while ((m = BARE_SIGN_POEM_PATTERN.exec(masked)) !== null) {
      violations.push({
        label: "bare_sign_poem",
        snippet: snippetAround(masked, m.index, m[0].length),
      });
    }
  }

  if (violations.length > 0) {
    console.warn(
      `[compliance-audit] delivery audit (${violations.length}, locale=${locale}):`,
      violations.slice(0, 5),
    );
  }

  const seen = new Set<string>();
  return violations.filter((v) => {
    const key = `${v.label}:${v.snippet}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
 * Output-side pass-through + audit only. LLM marks terms; UI renders markers.
 */
export function applyComplianceSanitize(text: string, locale: string): ComplianceSanitizeResult {
  if (!text?.trim()) {
    return { text: text ?? "", violationsBefore: [], violationsAfter: [] };
  }

  const violationsBefore = auditDeliveredText(text, locale);
  return { text, violationsBefore, violationsAfter: violationsBefore };
}

export { auditOutputPolicyText, detectOutputPolicyViolations, toGlossaryLocale };
export type { GlossaryConcept, Locale };
