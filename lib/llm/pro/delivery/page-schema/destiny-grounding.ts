/**
 * Soft destiny-grounding heuristics for P4 (and P3 overlap).
 * Notes only — does not fail the page (Gate E).
 *
 * Compress fill bans 命理专名 in strategy — so "grounded" must also accept
 * Eastern vernacular moat markers (局势/气口/结界…). Requiring calc keywords
 * alone falsely notes p4_ungrounded_strategy:6/6 on every once-pass page.
 */

const P3_SCIENCE_STEMS =
  /邮件|话术|授权|日历|Slack|谈判|战绩夹|现金缓冲|buffer|calendar|email|script|ownership|副手|STAR|MVP/i;

/** User-visible P4 moat vernacular that counts as grounded without 裸专名. */
const P4_VERNACULAR_GROUND =
  /局势|攻守|守成|藏隐|静默|意象|静润|借势|仪轨|结界|气口|催促场|出手位|近窗|未熟|主客|虚高|画饼|露锋|侧翼|调频|泄燥|立界/;

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
  if (input.strategies.length === 0) return notes;
  const keywords = extractCalcKeywords(input.eastern_calc_slice);

  let ungrounded = 0;
  for (const s of input.strategies) {
    const hitKeyword = keywords.some((k) => k.length >= 2 && s.includes(k));
    const hitVernacular = P4_VERNACULAR_GROUND.test(s);
    if (!hitKeyword && !hitVernacular) ungrounded += 1;
  }
  // Only note when calc keywords exist *and* vernacular also missing (real drift).
  if (keywords.length > 0) {
    const ratio = ungrounded / input.strategies.length;
    if (ratio >= 0.5) {
      notes.push(`p4_ungrounded_strategy:${ungrounded}/${input.strategies.length}`);
    }
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
