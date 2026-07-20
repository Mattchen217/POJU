/**
 * Shared leak detectors for v2 compute / evidence (diagnose or strip — not for retry).
 */

/**
 * 时间锚：禁具体年份/岁数/干支大运；放行「大运逢印 / 流年引动 / 岁运相冲」。
 */
export const TIME_ANCHOR_RE = new RegExp(
  [
    "(19|20)\\d{2}\\s*年?",
    "[一二三四五六七八九〇零]{2,4}年",
    "[1-9]\\d?\\s*(岁|周岁|虚岁)",
    "(虚岁|周岁)\\s*[1-9]\\d?",
    "第[一二三四五六七八九十\\d]+步?大运",
    "[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]\\s*(大运|流年|年|运)",
    "交运|起运",
  ].join("|"),
);

/** Ten-God compound abbreviations. */
export const SIMP_RE = /(比劫|官杀|食伤|印枭|枭印|财官|杀印|财官杀)/;
