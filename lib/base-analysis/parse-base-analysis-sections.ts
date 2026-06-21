export type BaseAnalysisSection = {
  title: string;
  body: string;
};

/** Split markdown display text on ## headings into delivery sections. */
export function parseBaseAnalysisSections(displayText: string): BaseAnalysisSection[] {
  const text = displayText.trim();
  if (!text) return [];

  const parts = text.split(/^##\s+/m).filter(Boolean);
  if (parts.length <= 1 && !text.startsWith("##")) {
    return [{ title: "", body: text }];
  }

  return parts.map((chunk) => {
    const nl = chunk.indexOf("\n");
    if (nl === -1) return { title: chunk.trim(), body: "" };
    return {
      title: chunk.slice(0, nl).trim(),
      body: chunk.slice(nl + 1).trim(),
    };
  });
}
