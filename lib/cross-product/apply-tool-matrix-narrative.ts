import type { MatrixNarrativeResponse } from "@/lib/llm/prompts/matrix-narrative-prompt";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import type { ToolName } from "@/lib/poju/types";

import { applyMatrixNarrativeToPayload, markMatrixNarrativeFailed } from "@/lib/poju/apply-matrix-narrative";
import { getStaticToolPreviewGuide } from "@/lib/cross-product/tool-preview-guide";

/** Apply light LLM narrative to matrix payload(s) for tool preview. */
export function applyToolMatrixNarrative(
  payload: PojuMatrixPayload,
  narrative: MatrixNarrativeResponse | null,
  product: ToolName,
  locale: string,
): PojuMatrixPayload {
  if (!narrative) {
    return applyToolMatrixNarrativeFailed(payload, product, locale);
  }

  let updated = applyMatrixNarrativeToPayload(payload, narrative, locale);
  const display = updated.display;
  if (!display) return updated;

  const guide =
    narrative.guide?.trim() ||
    narrative.poju_onboarding.call_to_action?.trim() ||
    getStaticToolPreviewGuide(locale, product);

  if (product === "match") {
    updated = {
      ...updated,
      display: {
        ...display,
        synopsis: {
          archetype: narrative.narrative_a ?? display.synopsis.archetype,
          friction: narrative.narrative_b ?? display.synopsis.friction,
          prompt: guide,
        },
      },
    };
  } else {
    updated = {
      ...updated,
      display: {
        ...display,
        synopsis: {
          ...display.synopsis,
          prompt: guide,
        },
      },
    };
  }

  return updated;
}

export function applyToolMatrixNarrativeFailed(
  payload: PojuMatrixPayload,
  product: ToolName,
  locale: string,
): PojuMatrixPayload {
  const failed = markMatrixNarrativeFailed(payload);
  const display = failed.display;
  if (!display) return failed;

  const guide = getStaticToolPreviewGuide(locale, product);
  return {
    ...failed,
    display: {
      ...display,
      synopsis: {
        ...display.synopsis,
        prompt: guide,
      },
    },
  };
}
