/** Format situation-analysis JSON as chat opening text. */
export function formatSituationOpeningText(analysis: unknown, locale: string): string {
  if (!analysis || typeof analysis !== "object") {
    return locale.startsWith("zh")
      ? "你的命局已与这个问题对齐。我们可以继续深入对话。"
      : "Your chart is aligned with this question. We can continue the dialogue.";
  }

  const root = analysis as Record<string, unknown>;
  const parts: string[] = [];

  const essence = root["困境本质"];
  if (essence && typeof essence === "object") {
    const e = essence as Record<string, unknown>;
    for (const key of ["命理视角的本质", "为什么会发生"]) {
      if (typeof e[key] === "string" && e[key].trim()) parts.push(e[key].trim());
    }
  }

  const path = root["破局之路"];
  if (path && typeof path === "object") {
    const p = path as Record<string, unknown>;
    if (typeof p["核心破局方向"] === "string" && p["核心破局方向"].trim()) {
      parts.push(p["核心破局方向"].trim());
    }
  }

  if (parts.length === 0) {
    return locale.startsWith("zh")
      ? "基于你的基础分析与问题语境，我已准备好陪你把这件事拆到底。你想先从哪一面开始？"
      : "Based on your base analysis and question, I'm ready to work through this with you. Where would you like to start?";
  }

  return parts.join("\n\n");
}
