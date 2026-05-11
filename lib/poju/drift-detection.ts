const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "to",
  "of",
  "and",
  "in",
  "for",
  "is",
  "are",
  "我",
  "你",
  "的",
  "了",
  "是",
  "在",
]);

export function tokenize(v: string): string[] {
  return v
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
    .filter((x) => x.length > 1 && !STOP_WORDS.has(x));
}

export function detectTopicDrift(rootTopic: string, incoming: string): { drift: boolean; score: number } {
  const base = new Set(tokenize(rootTopic));
  const now = tokenize(incoming);
  if (!base.size || !now.length) return { drift: false, score: 0 };
  let overlap = 0;
  now.forEach((t) => {
    if (base.has(t)) overlap += 1;
  });
  const score = overlap / Math.max(1, now.length);
  return { drift: score < 0.15, score };
}
