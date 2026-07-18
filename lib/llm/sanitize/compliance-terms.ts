/**
 * Shared blacklist → whitelist term maps for LLM output compliance.
 * Delivery sanitize mutates payment-audit leaks; chat sanitize may stay audit-only.
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
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  auditOutputPolicyText,
  detectOutputPolicyViolations,
  logBaziTermObservations,
} from "@/lib/llm/compliance/audit-output";
import {
  BARE_SIGN_POEM_PATTERN,
  auditBareGanzhi,
  auditMarkerCompleteness,
  auditMarkerPlainBanned,
  auditOutOfSetTerms,
  auditRelationsAgainstInstance,
  auditShenShaAgainstInstance,
  auditTermMarkerDensity,
  autoMarkBareTerms,
  buildTermMarkingPromptBlock,
  buildTermMarkingFewShot,
  detectBrokenMarkers,
  degradeMarkersToPlain,
  encodeTermMarker,
  fillMissingMarkerPlain,
  stripLeakedMarkerPlainFromBody,
  replaceZhMingliStacks,
  collapseChainedSoftReplaceArtifacts,
  collapseDuplicatedSoftPrefix,
  hasChainedSoftReplaceArtifacts,
  maskMarkersForAudit,
  parseTermMarkers,
  plainByTermId,
  normalizeTermMarkerIds,
  prepareTextForGlossaryRender,
  protectQuotedSingleHanChars,
  repairChatTermMarkers,
  repairShenshaMarkerSoftLabels,
  stripBareTermMarkers,
  stripBrokenMarkers,
  stripForbiddenShenSha,
  stripOutOfSetFactTerms,
  stripMarkersForPrompt,
  TERM_ENTRIES,
  TERM_MARKER_PATTERN,
  type MarkLayer,
  type ParsedTermMarker,
  type TermEntry,
  uiTermById,
  unescapeMarkerPart,
  wrapBareKeepCnSoftTerms,
  wrapBareStemElements,
  wrapBareTenGods,
  wrapBareWuxingInMingliContext,
} from "@/lib/llm/sanitize/term-marking";
import { auditEmptyKeepCnBrackets } from "@/lib/llm/sanitize/keep-cn-brackets";
import {
  BARE_GANZHI_MARKER,
  KEEP_CN_VISIBLE_SOFT,
  isValidSexagenaryGanzhi,
} from "@/lib/glossary/term-closed-set";
import {
  BANNED_TERMS_ZH,
  bannedTermSoftReplacePairsZh,
  collectCanonicalSoftLabelsZh,
  maskKnownSoftLabelsZh,
  metaphorBlacklistForLocale,
  scrubBannedMetaphorInLeadLabels,
} from "@/lib/llm/compliance/banned-terms";
import { allShenshaHanSurfaces, resolveShenshaSoftLabels } from "@/lib/poju/shensha";

export {
  auditBareGanzhi,
  auditMarkerCompleteness,
  auditMarkerPlainBanned,
  auditOutOfSetTerms,
  auditRelationsAgainstInstance,
  auditShenShaAgainstInstance,
  auditTermMarkerDensity,
  autoMarkBareTerms,
  BARE_SIGN_POEM_PATTERN,
  buildTermMarkingPromptBlock,
  buildTermMarkingFewShot,
  encodeTermMarker,
  fillMissingMarkerPlain,
  stripLeakedMarkerPlainFromBody,
  replaceZhMingliStacks,
  collapseChainedSoftReplaceArtifacts,
  collapseDuplicatedSoftPrefix,
  hasChainedSoftReplaceArtifacts,
  parseTermMarkers,
  plainByTermId,
  normalizeTermMarkerIds,
  prepareTextForGlossaryRender,
  protectQuotedSingleHanChars,
  repairChatTermMarkers,
  repairShenshaMarkerSoftLabels,
  stripBrokenMarkers,
  stripForbiddenShenSha,
  stripOutOfSetFactTerms,
  stripMarkersForPrompt,
  degradeMarkersToPlain,
  TERM_ENTRIES,
  TERM_MARKER_PATTERN,
  type MarkLayer,
  type ParsedTermMarker,
  type TermEntry,
  uiTermById,
  unescapeMarkerPart,
  wrapBareKeepCnSoftTerms,
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

/** EN hidden-stem English dump — e.g. "Hidden stems (Wu earth, Xin metal, …)" */
export const EN_HIDDEN_STEM_DUMP_REGEX =
  /\bhidden stems?\s*\([A-Za-z\s,·]+(?:earth|metal|wood|fire|water)[^)]*\)/gi;

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
  // Everyday Chinese — strength soft is 「随境调整型」; bare 「平衡」 false-fires lead labels.
  if (term === "平衡") return true;
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
  // ⚠️ 绝不能用 /\s{2,}/ —— \s 含 \n，会把 \n\n 段落分隔吃成一个空格、整篇拍成一行。
  // 后果(2026-07-17 生产):repair-violations 是行级编辑器，换行没了 → 整篇当"一行"截断 → 残篇覆盖完整报告。
  // [^\S\r\n] = 只并横向空白(空格/制表)，换行原样保留。
  return result
    .replace(/[^\S\r\n]{2,}/g, " ")
    .replace(/[^\S\r\n]+([,.;:!?])/g, "$1")
    .trim();
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

/** Intact markers — id may include unicode (e.g. shensha.孤鸾煞) before Fix C normalize. */
const INTACT_MARKER_CHUNK_RE =
  /⟦t:[^|⟦⟧]+\|(?:\\.|[^|\\])*?(?:\|(?:\\.|[^|\\])*?)?⟧|⟦g\|(?:\\.|[^|\\])*?\|(?:\\.|[^|]|\\[^⟧])*?⟧/g;

const EN_PAYMENT_REDLINE_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\bhoroscope\b/gi, "energy rhythm"],
  [/\bastrology\b/gi, "pattern reading"],
  [/\bpsychic\b/gi, ""],
  [/\bfortune[- ]?telling\b/gi, ""],
  [/\bdivination\b/gi, ""],
  [/\bdestiny\b/gi, "life trajectory"],
  [/\bfate\b/gi, "life trajectory"],
];

const BARE_GANZHI_STANDALONE_RE =
  /(?<![\u4e00-\u9fff])[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥](?![\u4e00-\u9fff])/g;

function replaceStandaloneZhWord(text: string, word: string, replacement: string): string {
  const re = new RegExp(`(?<![\\u4e00-\\u9fff])${escapeRegExp(word)}(?![\\u4e00-\\u9fff])`, "g");
  return text.replace(re, replacement);
}

/** Stripe redline han words — global replace safe (not substrings of common non-term words). */
const ZH_STRIPE_GLOBAL_REPLACE: ReadonlyArray<[string, string]> = [
  ["占卜", ""],
  ["宿命", "人生轨迹"],
  ["命运", "人生轨迹"],
  ["星象", "能量节律"],
  ["吉凶", ""],
];

/**
 * Whole-phrase first — never chew "不是你的命运判决书" into
 * "不是你的人生轨迹判决书" via per-token 命运→人生轨迹.
 * Replacement MUST NOT re-introduce banned 判决 / 命运.
 */
const ZH_PHRASE_WHOLESALE_REPLACE: ReadonlyArray<[string, string]> = [
  ["不是你的命运判决书", "这是配置读数，不是定论"],
  ["不是命运判决书", "这是配置读数，不是定论"],
  ["命运判决书", "配置读数"],
  ["人生轨迹判决书", "配置读数"],
  ["不是命运定论", "这是配置读数"],
  ["不是你的命运定论", "这是配置读数"],
  ["命运定论", "配置读数"],
  ["不是命定", "怎么用，取决于你自己"],
  ["这不是命定", "怎么用，取决于你自己"],
];

const UNREADABLE_SOFT_COMBOS = [
  "人生轨迹判决书",
  "人生轨迹定论",
  "靠'滋养培育'出来的",
  "靠“滋养培育”出来的",
  "靠「滋养培育」出来的",
] as const;

/** Protect `"养"` / 「冲」 style rhetorical single chars — never soft-replace them. */
export function protectQuotedSingleChars(text: string): {
  text: string;
  restore: (s: string) => string;
} {
  return protectQuotedSingleHanChars(text);
}

/** Soft-visible façade bans after GlossaryText strip — reads single source BANNED_TERMS_ZH. */
export function auditUserFacingBannedLeaks(
  softVisible: string,
  locale: string,
): ComplianceViolation[] {
  if (!softVisible?.trim() || !locale.startsWith("zh")) return [];
  const violations: ComplianceViolation[] = [];
  // Longer first so 身弱 matches before 弱, etc.
  for (const term of [...BANNED_TERMS_ZH].sort((a, b) => b.length - a.length)) {
    const idx = softVisible.indexOf(term);
    if (idx >= 0) {
      violations.push({
        label: `term:${term}`,
        snippet: snippetAround(softVisible, idx, term.length),
      });
    }
  }
  return violations;
}

/** Blacklisted stock metaphors — single source METAPHOR_BLACKLIST_*. */
export function auditMetaphorBlacklist(
  softVisible: string,
  locale: string,
): ComplianceViolation[] {
  if (!softVisible?.trim()) return [];
  const violations: ComplianceViolation[] = [];
  const list = metaphorBlacklistForLocale(locale);
  const lower = locale.startsWith("zh") ? softVisible : softVisible.toLowerCase();
  for (const phrase of list) {
    const needle = locale.startsWith("zh") ? phrase : phrase.toLowerCase();
    const idx = lower.indexOf(needle);
    if (idx >= 0) {
      violations.push({
        label: "metaphor_blacklist",
        snippet: snippetAround(softVisible, idx, phrase.length),
      });
      break;
    }
  }
  return violations;
}

/** Post-replace readability: unreadable combos or abutting soft gloss chains → reject+regen. */
export function auditSoftReplaceReadability(
  softVisible: string,
  locale: string,
): ComplianceViolation[] {
  if (!softVisible?.trim() || !locale.startsWith("zh")) return [];
  const violations: ComplianceViolation[] = [];
  for (const combo of UNREADABLE_SOFT_COMBOS) {
    const idx = softVisible.indexOf(combo);
    if (idx >= 0) {
      violations.push({
        label: "soft_replace_unreadable",
        snippet: snippetAround(softVisible, idx, combo.length),
      });
    }
  }
  if (hasChainedSoftReplaceArtifacts(softVisible)) {
    violations.push({
      label: "soft_replace_unreadable",
      snippet: snippetAround(softVisible, 0, Math.min(48, softVisible.length)),
    });
  }
  return violations;
}

/** Bare pillar / chart structure words → SaaS soft gloss (from banned-terms single source). */
const ZH_STRUCTURE_SOFT_REPLACE: ReadonlyArray<[string, string]> = [
  ...bannedTermSoftReplacePairsZh().filter(([word]) =>
    [
      "日主",
      "大运",
      "流年",
      "日柱",
      "月柱",
      "时柱",
      "年柱",
      "命盘",
      "命局",
      "八字",
      "四柱",
      "用神",
      "喜神",
      "忌神",
      "天干",
      "地支",
      "藏干",
      "身弱",
      "身强",
      "身旺",
      "判决",
      "命定",
      "命理",
      "天注定",
    ].includes(word),
  ),
];

const EN_STRUCTURE_SOFT_REPLACE: ReadonlyArray<[RegExp, string]> = [
  [/\bDa\s*Yun\b/gi, "current life phase"],
  [/\bMajor\s*Luck\b/gi, "current life phase"],
  [/\bLuck\s*(?:Cycle|Pillar)\b/gi, "current life phase"],
  [/\bLiu\s*Nian\b/gi, "current temporal window"],
  [/\b(?:Day|Month|Year|Hour)\s+Pillar\b/gi, "your energy structure"],
  [/\bFour\s*Pillars\b/gi, "your energy structure"],
  [/\bBa\s*Zi\b/gi, "your energy structure"],
  [/\bBazi\b/gi, "your energy structure"],
  [/\bnatal\s+chart\b/gi, "your energy structure"],
];

/** Model-invented wuxing clash phrases — replace with vernacular tension. */
const ZH_WUXING_CLASH_RES: ReadonlyArray<RegExp> = [
  /相生相克/g,
  /[金木水火土]\s*[金木水火土]?\s*相[克战生冲合刑害]/g,
  /[金木水火土][金木水火土]交战/g,
  /[金木水火土]旺[金木水火土][焚烁泄克战]/g,
  /[金木水火土][燥湿冷热焚泻][金木水火土][克泄生战冲]/g,
];

/** Payment-audit tokens may abut other Han (大运火金相克 / 叠孤鸾煞) — no Char-boundary. */
function replaceZhTokenGlobal(text: string, word: string, replacement: string): string {
  if (!word || !text.includes(word)) return text;
  return text.split(word).join(replacement);
}

function replaceWuxingClashPhrases(text: string): string {
  let result = text;
  for (const re of ZH_WUXING_CLASH_RES) {
    re.lastIndex = 0;
    result = result.replace(re, "两股力量相互较劲");
  }
  return result;
}

function replaceBareShenshaWithSoft(text: string, locale: string): string {
  let result = text;
  for (const han of allShenshaHanSurfaces()) {
    if (!result.includes(han)) continue;
    const labels = resolveShenshaSoftLabels(han, locale);
    if (!labels?.soft || labels.soft === han) continue;
    result = replaceZhTokenGlobal(result, han, labels.soft);
  }
  return result;
}

function replaceStandaloneRedlines(text: string, locale: string): string {
  let result = text;
  if (locale.startsWith("zh")) {
    const { text: protectedText, restore } = protectQuotedSingleChars(result);
    result = protectedText;
    // Phrase-first — never chew "月柱正印壬水" / "命运判决书" into adjacent soft tokens.
    for (const [phrase, replacement] of ZH_PHRASE_WHOLESALE_REPLACE) {
      result = result.split(phrase).join(replacement);
    }
    result = replaceZhMingliStacks(result);
    for (const [word, replacement] of ZH_STRIPE_GLOBAL_REPLACE) {
      if (word === "命运") {
        result = replaceStandaloneZhWord(result, word, replacement);
        continue;
      }
      result = result.split(word).join(replacement);
    }
    for (const [word, replacement] of ZH_STRUCTURE_SOFT_REPLACE) {
      result = replaceZhTokenGlobal(result, word, replacement);
    }
    // Fold "你的能量结构正印壬水" left by bare-pillar soft replace.
    result = replaceZhMingliStacks(result);
    result = collapseChainedSoftReplaceArtifacts(result);
    result = replaceWuxingClashPhrases(result);
    result = replaceBareShenshaWithSoft(result, locale);
    result = restore(result);
  } else {
    for (const [regex, replacement] of EN_PAYMENT_REDLINE_PATTERNS) {
      regex.lastIndex = 0;
      result = result.replace(regex, replacement);
    }
    for (const [regex, replacement] of EN_STRUCTURE_SOFT_REPLACE) {
      regex.lastIndex = 0;
      result = result.replace(regex, replacement);
    }
  }
  // ⚠️ 绝不能用 /\s{2,}/ —— \s 含 \n（见 filterDeletedTerms 同款注释）。
  return result
    .replace(/[^\S\r\n]{2,}/g, " ")
    .replace(/[^\S\r\n]+([,.;:!?])/g, "$1");
}

function filterDeletedTermsBounded(text: string): string {
  if (!text?.trim()) return text;
  let result = text;
  for (const c of TERM_GLOSSARY) {
    if (c.surface !== "delete") continue;
    for (const term of c.forbidden_variants) {
      if (isChineseVariant(term)) {
        result = replaceStandaloneZhWord(result, term, "");
      } else {
        const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
        result = result.replace(re, "");
      }
    }
  }
  // ⚠️ 绝不能用 /\s{2,}/ —— \s 含 \n（见 filterDeletedTerms 同款注释）。
  return result
    .replace(/[^\S\r\n]{2,}/g, " ")
    .replace(/[^\S\r\n]+([,.;:!?])/g, "$1");
}

function removeStandaloneBareGanzhi(text: string, locale: string): string {
  const locKey = locale.startsWith("zh")
    ? "zh"
    : locale.startsWith("es")
      ? "es"
      : locale.startsWith("de")
        ? "de"
        : locale.startsWith("fr")
          ? "fr"
          : "en";
  const loc = BARE_GANZHI_MARKER.soft[locKey] || BARE_GANZHI_MARKER.soft.en;
  BARE_GANZHI_STANDALONE_RE.lastIndex = 0;
  return text.replace(BARE_GANZHI_STANDALONE_RE, (match) =>
    isValidSexagenaryGanzhi(match) ? loc : match,
  );
}

function transformNonMarkerRegions(text: string, transform: (segment: string) => string): string {
  INTACT_MARKER_CHUNK_RE.lastIndex = 0;
  const out: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INTACT_MARKER_CHUNK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(transform(text.slice(lastIndex, match.index)));
    }
    out.push(match[0]);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    out.push(transform(text.slice(lastIndex)));
  }
  return out.join("");
}

function sanitizeNonMarkerSegment(
  segment: string,
  locale: string,
  opts?: { wrapStems?: boolean },
): string {
  let s = stripBareTermMarkers(segment);
  s = s.replace(/⟦(?:(?!⟧).)*$/gm, "");
  s = s.replace(/⟦(?:(?!⟧).)*?(?=⟦)/g, "");
  s = s.replace(/⟧/g, "");
  s = s.replace(/⟦/g, "");
  s = replaceStandaloneRedlines(s, locale);
  s = filterDeletedTermsBounded(s);
  s = removeStandaloneBareGanzhi(s, locale);
  // 必须放最后 —— 上面几行会剥掉 ⟦⟧，先打标会被自己吃掉。
  // 四类确定性打标器（天干/五行/十神），把"门禁拦得住、清洗器修不掉"的裸词全部收口。
  if (opts?.wrapStems) {
    s = wrapBareStemElements(s, locale);
    s = wrapBareWuxingInMingliContext(s, locale);
    s = wrapBareTenGods(s, locale);
  }
  return s;
}

/** Final scrub for copy/TTS/share — replaces (not deletes) any leaked bare 干支/高危词. */
export function scrubLeakedComplianceTerms(text: string, locale: string): string {
  return sanitizeNonMarkerSegment(text, locale);
}

function sanitizeDeliveryBodyPart(text: string, locale: string): string {
  return transformNonMarkerRegions(text, (segment) =>
    sanitizeNonMarkerSegment(segment, locale, { wrapStems: true }),
  );
}

/**
 * 正文层渲染准备（双层制）：零金字。
 * 1) id 归一（拦自造 slug）
 * 2) 标记 → 贴题白话（不镀金、不加 [···]）
 * 3) 裸命理词仍然拦 —— 但**替换成白话**，不是替换成金字（合规网不撤，只换出口）
 * 正文里出现标记 = 模型违反「正文零标记」，必须响亮，不许静默降级。
 */
export function prepareBodyTextForGlossaryRender(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  const normalized = normalizeTermMarkerIds(text, locale);
  if (normalized.includes("⟦t:")) {
    console.warn(
      "[glossary] BODY MARKER LEAK — 正文层出现标记，已降级为白话。金字只该进「依据与推理」。",
      { sample: normalized.match(/⟦t:[^⟧]+⟧/g)?.slice(0, 3) },
    );
  }
  return sanitizeNonMarkerSegment(degradeMarkersToPlain(normalized, locale), locale);
}

/**
 * Payment-audit mutation pass: repair 神煞 marker soft slots, then replace bare
 * 大运/流年/日柱… / 生克短语 / 煞名 in non-marker regions.
 */
export function sanitizePaymentAuditLeaks(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  // Pre-gate: scrub metaphor blacklist only in **lead labels:** (never full-doc replace).
  const labelScrubbed = scrubBannedMetaphorInLeadLabels(text, locale);
  const normalized = normalizeTermMarkerIds(labelScrubbed, locale);
  const repaired = repairShenshaMarkerSoftLabels(normalized, locale);
  const filled = fillMissingMarkerPlain(repaired, locale);
  const noPlainLeak = stripLeakedMarkerPlainFromBody(filled);
  // Deterministic strip of engine-out-of-set 神煞 (阴阳差错/大耗/白虎…) — never burn LLM repair on inventable names.
  const noOutOfSet = stripForbiddenShenSha(noPlainLeak);
  return sanitizeDeliveryBodyPart(noOutOfSet, locale);
}

/** POJU final delivery — deterministic scrub (redlines, bare terms, gloss wrap). Preserves ═══ marker lines. */
export function sanitizeDeliveryText(fullText: string, locale: string): string {
  const parts = fullText.split(DELIVERY_MARKER_RE);
  const cleaned = parts.map((part, i) =>
    i % 2 === 0 ? sanitizePaymentAuditLeaks(part, locale) : part,
  );
  const text = cleaned.join("");
  logBaziTermObservations(text, locale, "final-delivery-sanitize");
  return text;
}

/**
 * User-visible plain text — auto-mark + soft labels + belt-and-suspenders leak scrub.
 * Use for copy, TTS, share exports (never raw marked or bare 命理/高危词).
 * @see lib/glossary/to-compliant-plain-text.ts — canonical export entry
 */
export function toSoftTranslatedPlainText(text: string, locale: string): string {
  // Lazy import avoided — inline same pipeline as toCompliantPlainText to prevent circular deps.
  if (!text?.trim()) return text ?? "";
  const prepared = prepareTextForGlossaryRender(text, locale);
  let plain = stripMarkersForPrompt(prepared);
  plain = stripBrokenMarkers(plain);
  return scrubLeakedComplianceTerms(plain, locale).trim();
}

/** @deprecated Use buildTermMarkingPromptBlock — LLM marks terms at generation time. */
export function buildComplianceTranslationPromptBlock(_locale: Locale = "en"): string {
  return buildTermMarkingPromptBlock(_locale);
}

/**
 * Chat `response` pass-through — audit only (no destructive repair).
 * Term binding is enforced at generation time via buildTermMarkingPromptBlock + closed-set.
 */
export function sanitizeChatResponse(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  auditDeliveredText(text, locale);
  return text;
}

/** Residual payment-audit leaks in user-visible text (after stripMarkers = what UI shows). */
export function auditPaymentLeakResiduals(
  text: string,
  locale: string,
): ComplianceViolation[] {
  if (!text?.trim()) return [];
  const visible = stripMarkersForPrompt(text);
  const violations: ComplianceViolation[] = [];

  if (locale.startsWith("zh")) {
    for (const [word] of ZH_STRUCTURE_SOFT_REPLACE) {
      const idx = visible.indexOf(word);
      if (idx >= 0) {
        violations.push({
          label: `payment_leak:${word}`,
          snippet: snippetAround(visible, idx, word.length),
        });
      }
    }
    if (hasChainedSoftReplaceArtifacts(visible)) {
      violations.push({
        label: "payment_leak:chained_soft_replace",
        snippet: snippetAround(visible, 0, Math.min(48, visible.length)),
      });
    }
    for (const re of ZH_WUXING_CLASH_RES) {
      re.lastIndex = 0;
      const m = re.exec(visible);
      if (m) {
        violations.push({
          label: "payment_leak:wuxing_clash",
          snippet: snippetAround(visible, m.index, m[0].length),
        });
        break;
      }
    }
    for (const han of allShenshaHanSurfaces()) {
      if (!/[煞刃]/.test(han) && han !== "寡宿") continue;
      const idx = visible.indexOf(han);
      if (idx >= 0) {
        violations.push({
          label: `payment_leak:shensha:${han}`,
          snippet: snippetAround(visible, idx, han.length),
        });
      }
    }
  } else {
    for (const [regex, _rep] of EN_STRUCTURE_SOFT_REPLACE) {
      regex.lastIndex = 0;
      const m = regex.exec(visible);
      if (m) {
        violations.push({
          label: `payment_leak:${m[0]}`,
          snippet: snippetAround(visible, m.index, m[0].length),
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

/** Read-only delivery audit: bare forbidden terms, bare sign poems, broken markers, red lines. */
export function auditDeliveredText(
  text: string,
  locale: string,
  structured?: ProfileStructured | null,
  opts?: { relations?: import("@/lib/calculations/relation-engine").RelationLabel[] },
): ComplianceViolation[] {
  if (!text?.trim()) return [];
  const violations = detectComplianceViolations(maskMarkersForAudit(text), locale);

  if (detectBrokenMarkers(text)) {
    violations.push({ label: "broken_marker", snippet: snippetAround(text, text.indexOf("⟦"), 12) });
  }

  for (const hit of auditBareGanzhi(text)) {
    violations.push(hit);
  }

  for (const hit of auditEmptyKeepCnBrackets(text)) {
    violations.push(hit);
  }

  for (const hit of auditTermMarkerDensity(text)) {
    violations.push(hit);
  }

  for (const hit of auditPaymentLeakResiduals(text, locale)) {
    violations.push(hit);
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
    // Mask approved soft labels first — e.g. 「平衡」 must not fire inside 「关键平衡能量」.
    const softExtras = Object.values(KEEP_CN_VISIBLE_SOFT).map((x) => x.zh);
    softExtras.push("随境调整型", "关键平衡能量");
    const auditBody = maskKnownSoftLabelsZh(
      text,
      collectCanonicalSoftLabelsZh(softExtras),
    );
    for (const term of FORBIDDEN_VARIANTS_ALL) {
      if (!isChineseVariant(term) || term.length < 2) continue;
      if (shouldSkipAuditTerm(term)) continue;
      if (auditBody.includes(term)) {
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
    pushRegex(EN_HIDDEN_STEM_DUMP_REGEX, "hidden_stem_dump");
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
 * Output-side payment-audit mutate + re-audit.
 * Soft-replaces bare structure/生克/煞名; repairs 神煞 marker soft slots.
 */
export function applyComplianceSanitize(text: string, locale: string): ComplianceSanitizeResult {
  if (!text?.trim()) {
    return { text: text ?? "", violationsBefore: [], violationsAfter: [] };
  }

  const violationsBefore = auditDeliveredText(text, locale);
  const next = sanitizePaymentAuditLeaks(text, locale);
  const violationsAfter = auditDeliveredText(next, locale);
  return { text: next, violationsBefore, violationsAfter };
}

export { auditOutputPolicyText, detectOutputPolicyViolations, toGlossaryLocale };
export type { GlossaryConcept, Locale };
