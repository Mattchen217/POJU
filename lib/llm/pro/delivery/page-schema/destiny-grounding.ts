/**
 * Soft destiny-grounding heuristics for P4 (and P3 overlap).
 * Notes only — does not fail the page (Gate E).
 */

const P3_SCIENCE_STEMS =
  /邮件|话术|授权|日历|Slack|谈判|战绩夹|现金缓冲|buffer|calendar|email|script|ownership|副手|STAR|MVP/i;

/** Extract short tokens from eastern calc slice for grounding checks. */
export function extractCalcKeywords(easternCalcSlice: string | null | undefined): string[] {
  const text = (easternCalcSlice ?? "").trim();
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(
    /(?:color_anchors|preferred_dirs|用神|忌神|色锚|方位|时辰|大运)[^\n]{0,80}/gi,
  )) {
    const chunk = m[0] ?? "";
    for (const t of chunk.matchAll(/[\u4e00-\u9fff]{2,6}|[A-Za-z]{3,12}/g)) {
      const w = t[0];
      if (w && w.length >= 2) out.add(w);
    }
  }
  // Also harvest standalone chart-ish tokens
  for (const t of text.matchAll(
    /(?:正印|偏印|食神|伤官|比肩|劫财|正官|七杀|正财|偏财|身弱|身旺|需养|官杀|用神|忌神)/g,
  )) {
    out.add(t[0]!);
  }
  return [...out].slice(0, 40);
}

export function noteP4DestinyGrounding(input: {
  strategies: readonly string[];
  eastern_calc_slice?: string | null;
}): string[] {
  const notes: string[] = [];
  const keywords = extractCalcKeywords(input.eastern_calc_slice);
  if (keywords.length === 0 || input.strategies.length === 0) return notes;

  let ungrounded = 0;
  for (const s of input.strategies) {
    const hit = keywords.some((k) => k.length >= 2 && s.includes(k));
    if (!hit) ungrounded += 1;
  }
  const ratio = ungrounded / input.strategies.length;
  if (ratio >= 0.5) {
    notes.push(`p4_ungrounded_strategy:${ungrounded}/${input.strategies.length}`);
  }

  let overlap = 0;
  for (const s of input.strategies) {
    if (P3_SCIENCE_STEMS.test(s)) overlap += 1;
  }
  if (overlap >= 2) {
    notes.push(`p4_p3_overlap:${overlap}`);
  }
  return notes;
}
