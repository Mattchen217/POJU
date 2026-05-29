/** Extract JSON metadata after the `---META---` separator in streamed markdown. */
export function extractMetaFromStreamContent(fullContent: string): Record<string, unknown> {
  const idx = fullContent.lastIndexOf("---META---");
  if (idx === -1) return {};

  const after = fullContent.slice(idx + "---META---".length).trim();

  let jsonStr = after;
  const codeBlockMatch = after.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) {
    jsonStr = codeBlockMatch[1];
  }

  try {
    return JSON.parse(jsonStr.trim()) as Record<string, unknown>;
  } catch (e) {
    console.warn("[base-analysis] meta parse failed:", e);
    return {};
  }
}
