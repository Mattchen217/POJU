/**
 * Shared sentence splitting + post-sanitize polish for Glyph output.
 */

/** Split on sentence terminators; keeps punctuation with each segment. */
export function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const parts: string[] = [];
  const re = /([.!?。！？]+(?:\s+|$)|…(?:\s+|$))/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(trimmed)) !== null) {
    const chunk = trimmed.slice(last, match.index + match[0].length);
    if (chunk.trim()) parts.push(chunk);
    last = match.index + match[0].length;
  }

  const tail = trimmed.slice(last);
  if (tail.trim()) parts.push(tail);

  return parts.length > 0 ? parts : [trimmed];
}

/** Remove orphan quotes, duplicate words, and spacing glitches after sanitize. */
export function polishSanitizedText(text: string): string {
  let result = text;

  // Orphan quote tail after period: ". ' is met..." → drop headless tail sentence
  result = result.replace(/\.\s*['"]\s+(?=[a-z])/gi, ". ");
  result = result.replace(/(?:^|[.!?]\s+)['"]\s+(?=[a-z])/gi, (m) =>
    m.startsWith(".") || m.startsWith("!") || m.startsWith("?") ? `${m[0]} ` : " ",
  );

  // Headless tail sentence after sanitize (e.g. ". is met here not with...")
  result = result.replace(
    /([.!?])\s+(?:is|was|are|were)\s+met\b[^.!?]*(?=[.!?]|$)/gi,
    "$1",
  );

  // Stranded quote pairs with only whitespace inside
  result = result.replace(/'\s*'/g, "");
  result = result.replace(/"\s*"/g, "");

  // Lone opening quote before a word (maxim fragment leftover)
  result = result.replace(/(\s)['"](?=[A-Za-z])/g, "$1");

  // Duplicate consecutive words
  result = result.replace(/\b(\w+)\s+\1\b/gi, "$1");

  // Spacing / punctuation hygiene
  result = result.replace(/\s{2,}/g, " ");
  result = result.replace(/\s+([,.;:!?])/g, "$1");
  result = result.replace(/([.!?])\s*([.!?])+/g, "$1");
  result = result.replace(/\.\s*—\s*/g, ". ");

  return result.trim();
}
