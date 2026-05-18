/** Fallback opening copy when the opening LLM call fails (Step G). */
export function getFallbackOpening(question: string, locale: string): string {
  const isZh = locale.startsWith("zh");
  const q = question.trim() || (isZh ? "你带来的问题" : "the question you brought");

  if (isZh) {
    return `我是 POJU，你的东方破局顾问。我已经看过你的命盘——你的能量结构、五行强弱、当前所处的大运阶段，这些都已经清楚了。\n\n现在我想听你说说，关于「${q}」——这件事是怎么发展到现在这一步的？`;
  }

  return `I am POJU, your Eastern breakthrough counselor. I've read your chart — your energy structure, elemental balance, and current life phase are clear to me.\n\nNow tell me about "${q}". How did this situation come to where it is today?`;
}
