/**
 * Full-enum locale maps for delivery evidence (zh).
 * Covers FiveElement + TopicTypedPolarity + DayunStance — not sample-only patches.
 * Boundaries include Han glue (`锚元water`) and post-marker leftovers (`⟧water`).
 */

export const FIVE_ELEMENT_EN_TO_ZH = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
} as const;

export type FiveElementEn = keyof typeof FIVE_ELEMENT_EN_TO_ZH;

export const TOPIC_POLARITY_EN_TO_ZH = {
  favor: "补给",
  tension: "承压",
  drain: "耗损",
  neutral: "中性",
} as const;

export type TopicPolarityEn = keyof typeof TOPIC_POLARITY_EN_TO_ZH;

/** DayunStance (+ mixed used in some inventory strings). */
export const DAYUN_STANCE_EN_TO_ZH = {
  favor: "偏顺",
  caution: "慎行",
  mixed: "交织",
  unknown: "未知",
} as const;

export type DayunStanceEn = keyof typeof DAYUN_STANCE_EN_TO_ZH;

/** All polarity/stance tokens that may appear in 〔…〕 brackets. */
export const BRACKET_POLARITY_EN_TO_ZH: Record<string, string> = {
  ...TOPIC_POLARITY_EN_TO_ZH,
  caution: DAYUN_STANCE_EN_TO_ZH.caution,
  mixed: DAYUN_STANCE_EN_TO_ZH.mixed,
  unknown: DAYUN_STANCE_EN_TO_ZH.unknown,
};

export function fiveElementToZh(el: string): string {
  const k = el.trim().toLowerCase() as FiveElementEn;
  return FIVE_ELEMENT_EN_TO_ZH[k] ?? el.trim();
}

export function polarityBracketToZh(polarity: string): string {
  const k = polarity.trim().toLowerCase();
  return BRACKET_POLARITY_EN_TO_ZH[k] ?? polarity.trim();
}

/**
 * Localize composite / glued tokens:
 * - `用神·water〔favor〕` → `用神·水〔补给〕`
 * - `锚元water` / `耗元fire` (Han + EN glue)
 * - `⟧water` leftover after soft encode
 * Idempotent on already-zh forms.
 */
export function localizeChartTokenForZh(token: string): string {
  let s = token.trim();
  if (!s) return s;
  // Left boundary: start, mid-dot, punct, space, CJK, or closing term marker.
  // Right boundary: end, mid-dot, punct, space, bracket, CJK, or opening marker.
  for (const [en, zh] of Object.entries(FIVE_ELEMENT_EN_TO_ZH)) {
    s = s.replace(
      new RegExp(
        `(^|[·.\\s\\u4e00-\\u9fff⟧〕】\\)])${en}(?=$|[·.\\s〔\\[\\u4e00-\\u9fff⟦])`,
        "gi",
      ),
      `$1${zh}`,
    );
  }
  s = s.replace(/〔\s*([a-zA-Z]+)\s*〕/g, (_m, p: string) => {
    return `〔${polarityBracketToZh(p)}〕`;
  });
  s = s.replace(/\[\s*([a-zA-Z]+)\s*\]/g, (_m, p: string) => {
    return `〔${polarityBracketToZh(p)}〕`;
  });
  return s;
}

/** Scan user-visible zh evidence for forbidden English tokens (whitelist brands). */
export const ZH_EVIDENCE_EN_WHITELIST = [
  "POJU",
  "Bazi",
  "BAZI",
  "Qi",
  "QI",
  "Wuxing",
  "WUXING",
] as const;

export function findForbiddenEnglishTokensInZhEvidence(
  text: string,
  whitelist: readonly string[] = ZH_EVIDENCE_EN_WHITELIST,
): string[] {
  // Ignore closed-set marker guts (⟦t:slug|…⟧ / ⟦w:…⟧) — slugs are internal.
  // Keep 【】 visible so unresolved word-slots still fail the scan if they leak EN.
  const visible = text
    .replace(/⟦t:[^⟧]*⟧/g, "")
    .replace(/⟦w:[^⟧]*⟧/g, "");
  const wl = new Set(whitelist.map((w) => w.toLowerCase()));
  const hits: string[] = [];
  const re = /[A-Za-z]{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(visible)) !== null) {
    const tok = m[0]!;
    if (wl.has(tok.toLowerCase())) continue;
    hits.push(tok);
  }
  return hits;
}
