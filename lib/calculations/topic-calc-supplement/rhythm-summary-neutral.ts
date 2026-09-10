/**
 * Rhythm signal copy must stay factual — no 该冲该守 leakage via wording.
 */

/** Directional / evaluative tokens banned in rhythm_signals.summary_zh. */
export const RHYTHM_SUMMARY_BANNED_TOKENS: readonly string[] = [
  "有利",
  "不利",
  "宜冲",
  "宜守",
  "宜进",
  "宜退",
  "不宜",
  "该冲",
  "该守",
  "该进",
  "该退",
  "不该",
  "可推进",
  "宜守中",
  "攻守",
  "松紧",
  "择机推进",
  "偏顺",
  "偏耗",
] as const;

/**
 * Return banned tokens/snippets found in a rhythm summary line.
 * Multi-char tokens first; then lone 宜 / 该 as prescription markers.
 */
export function findDirectionalWordingInRhythmSummary(summary_zh: string): string[] {
  const hits: string[] = [];
  const text = summary_zh.trim();
  if (!text) return hits;

  for (const tok of RHYTHM_SUMMARY_BANNED_TOKENS) {
    if (text.includes(tok)) hits.push(tok);
  }
  if (/宜/.test(text) && !hits.some((h) => h.includes("宜"))) {
    hits.push("宜");
  }
  if (/该/.test(text) && !hits.some((h) => h.includes("该"))) {
    hits.push("该");
  }
  return [...new Set(hits)];
}

export function assertRhythmSummaryNeutral(summary_zh: string): void {
  const hits = findDirectionalWordingInRhythmSummary(summary_zh);
  if (hits.length > 0) {
    throw new Error(
      `rhythm_signals.summary_zh must be neutral; found [${hits.join(", ")}] in: ${summary_zh}`,
    );
  }
}

/**
 * If upstream han ever picks up evaluative copy, fall back to a structural line.
 */
export function coerceNeutralRhythmSummary(input: {
  han: string;
  kind: string;
  positions: string[];
}): string {
  const hits = findDirectionalWordingInRhythmSummary(input.han);
  if (hits.length === 0) return input.han;
  return `${input.kind}·${input.positions.join("+")}`;
}
