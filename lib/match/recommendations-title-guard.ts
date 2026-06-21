const EN_WORD_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const ZH_DIGIT: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function parseZhNumeral(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (s.length === 1 && ZH_DIGIT[s] != null) return ZH_DIGIT[s];
  if (s === "十") return 10;
  if (s.startsWith("十") && ZH_DIGIT[s[1]] != null) return 10 + ZH_DIGIT[s[1]];
  if (s.endsWith("十") && ZH_DIGIT[s[0]] != null) return ZH_DIGIT[s[0]] * 10;
  if (s.includes("十")) {
    const [a, b] = s.split("十");
    const tens = a ? (ZH_DIGIT[a] ?? null) : 1;
    const ones = b ? (ZH_DIGIT[b] ?? null) : 0;
    if (tens == null || ones == null) return null;
    return tens * 10 + ones;
  }
  return null;
}

/** Returns a step/action count explicitly mentioned in title, or null if none. */
export function extractMentionedActionCount(title: string): number | null {
  const t = title.trim();
  if (!t) return null;

  const zhHan = t.match(/([一二三四五六七八九十两\d]+)\s*[步条点项策]/);
  if (zhHan) return parseZhNumeral(zhHan[1]);

  const enDigit = t.match(/\b(\d+)\s+(steps?|ways?|actions?|tips?|strategies?)\b/i);
  if (enDigit) return parseInt(enDigit[1], 10);

  const enWord = t.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(steps?|ways?|actions?|tips?|strategies?)\b/i,
  );
  if (enWord) return EN_WORD_NUM[enWord[1].toLowerCase()] ?? null;

  return null;
}

export function recommendationsTitleHasHardcodedCount(title: string): boolean {
  return extractMentionedActionCount(title) !== null;
}

export function recommendationsTitleCountMismatch(title: string, actionCount: number): boolean {
  const mentioned = extractMentionedActionCount(title);
  return mentioned !== null && mentioned !== actionCount;
}
