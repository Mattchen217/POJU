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
        ? "把你此刻最纠结、定不下来的决策问题写在下方对话框并发送——我们会结合本次会话的基础坐标，一步步拆开。"
        : "Tell me the decision question you're weighing — type it below and send. We'll work through it from this session's case structure."),
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
  // PART 2: template/stored is the intended path — never spin forever waiting for LLM.
  const showTemplateFallback =
    display.narrative_failed === true || src === "template" || src === "stored" || !src;
  const narrativeLoading = false;
  void isLlmNarrative;
  return { isLlmNarrative: false, showTemplateFallback, narrativeLoading };
}
