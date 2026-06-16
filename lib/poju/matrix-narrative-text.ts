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
        ? "把你反复掂量、又迟迟定不下来的那个问题告诉我——发在下面，我会结合你的命盘，和你一步步拆开。"
        : "Tell me the question or dilemma you keep weighing and cannot settle — share it below, and I'll walk through it with you, grounded in your chart."),
  ].filter(Boolean);
  return parts.join("\n\n");
}

export function matrixSynopsisNarrativeState(display: MatrixSynopsisDisplay): {
  isLlmNarrative: boolean;
  showTemplateFallback: boolean;
  narrativeLoading: boolean;
} {
  const isLlmNarrative = display.narrative_source === "llm";
  const showTemplateFallback = display.narrative_failed === true;
  const narrativeLoading = !isLlmNarrative && !showTemplateFallback;
  return { isLlmNarrative, showTemplateFallback, narrativeLoading };
}
