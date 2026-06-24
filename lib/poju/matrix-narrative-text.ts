import { buildMatrixDisplayData } from "@/lib/poju/build-matrix-display";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";

export type MatrixSynopsisDisplay = ReturnType<typeof buildMatrixDisplayData>;

export function resolveMatrixDisplay(
  payload: PojuMatrixPayload,
  locale: string,
): MatrixSynopsisDisplay {
  return (
    payload.display ??
    buildMatrixDisplayData({
      profile: payload.user_profile,
      structured: payload.structured,
      strength: payload.strength,
      wuxing_scores: payload.wuxing_scores,
      locale,
    })
  );
}

export function getMatrixSynopsisPlainText(
  display: MatrixSynopsisDisplay,
  locale: string,
): string {
  const zh = locale.startsWith("zh");
  const parts = [
    display.synopsis.archetype,
    display.synopsis.friction,
    display.synopsis.prompt ||
      (zh
        ? "请把你此刻最纠结、迟迟定不下来的问题或困境写在下方对话框并发送——我会结合你的能量结构，陪你一步步拆开。"
        : "Tell me the question or dilemma you're weighing right now — type it in the box below and send, and we'll work through it together from your matrix."),
  ].filter(Boolean);
  return parts.join("\n\n");
}

export function matrixSynopsisNarrativeState(display: MatrixSynopsisDisplay): {
  isLlmNarrative: boolean;
  showTemplateFallback: boolean;
  narrativeLoading: boolean;
} {
  const src = display.narrative_source;
  const isLlmNarrative = src === "llm";
  const showTemplateFallback =
    display.narrative_failed === true || src === "template" || src === "stored";
  const narrativeLoading = !isLlmNarrative && !showTemplateFallback;
  return { isLlmNarrative, showTemplateFallback, narrativeLoading };
}
