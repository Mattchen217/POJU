/**
 * Client-side checks for obviously uninterpretable input.
 * Intentionally conservative: ambiguous text is allowed through for server/LLM to judge.
 */

function countGraphemes(s: string): number {
  return [...s].length;
}

function dominantCharRatio(s: string): number {
  if (s.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  let max = 0;
  for (const n of freq.values()) max = Math.max(max, n);
  return max / s.length;
}

function asciiAlphaWords(question: string): string[] {
  return question
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, ""))
    .filter((w) => w.length > 0);
}

function hasVowel(word: string): boolean {
  return /[aeiouy]/i.test(word);
}

function latinLetterCount(question: string): number {
  return (question.match(/[a-zA-Z]/g) ?? []).length;
}

function vowelRatioInLatinLetters(question: string): number {
  const letters = question.match(/[a-zA-Z]/g) ?? [];
  if (letters.length === 0) return 1;
  const vowels = letters.filter((c) => /[aeiouy]/i.test(c)).length;
  return vowels / letters.length;
}

function isMostlyNoiseNonLetters(question: string): boolean {
  const noSpace = question.replace(/\s/g, "");
  if (noSpace.length < 6) return false;
  const meaningful = noSpace.match(/[a-zA-Z0-9\u4e00-\u9fff]/g) ?? [];
  return meaningful.length / noSpace.length < 0.45;
}

/**
 * Returns false-positive-friendly result: only blocks when confidence is high.
 */
export function assessOracleQuestionHeuristic(
  question: string,
): { ok: true } | { ok: false; message: string } {
  const q = question.trim();
  const graphemes = countGraphemes(q);

  if (graphemes < 4) {
    return {
      ok: false,
      message:
        "That looks too short to be a real question. Add a few more words about your situation.",
    };
  }

  const noSpace = q.replace(/\s/g, "");
  if (noSpace.length >= 4 && dominantCharRatio(noSpace) >= 0.72) {
    return {
      ok: false,
      message:
        "This input looks like repeated characters rather than a question. Please describe what you are actually facing.",
    };
  }

  if (isMostlyNoiseNonLetters(q)) {
    return {
      ok: false,
      message:
        "Most of this text isn’t readable words or characters. Please re-type a clear question you could ask a friend.",
    };
  }

  const words = asciiAlphaWords(q);
  for (const w of words) {
    if (w.length >= 4 && !hasVowel(w)) {
      return {
        ok: false,
        message:
          "Some of the words look like random letters (not real words). Please rephrase with a genuine question.",
      };
    }
  }

  const latinCount = latinLetterCount(q);
  if (latinCount >= 10 && !q.includes(" ") && vowelRatioInLatinLetters(q) < 0.12) {
    return {
      ok: false,
      message:
        "This reads like keyboard noise. Take a breath, then type one real sentence about what you need clarity on.",
    };
  }

  return { ok: true };
}
