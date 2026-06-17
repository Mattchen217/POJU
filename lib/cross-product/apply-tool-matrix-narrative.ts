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
  matchPerson?: "a" | "b",
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
    const personLine =
      matchPerson === "b" ? narrative.narrative_b : narrative.narrative_a;
    updated = {
      ...updated,
      display: {
        ...display,
        synopsis: {
          ...display.synopsis,
          archetype: personLine ?? display.synopsis.archetype,
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
