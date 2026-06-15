import type { MatrixNarrativeResponse } from "@/lib/llm/prompts/matrix-narrative-prompt";
import type { MatrixDisplayData } from "@/lib/poju/build-matrix-display";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";

export function applyMatrixNarrativeToDisplay(
  display: MatrixDisplayData,
  narrative: MatrixNarrativeResponse,
): MatrixDisplayData {
  return {
    ...display,
    structural_dynamics: narrative.structural_dynamics,
    annual_transit: {
      ...display.annual_transit,
      stem_en: narrative.annual_transit_2026.title.split("/")[0]?.trim() || display.annual_transit.stem_en,
      narrative: narrative.annual_transit_2026.description,
    },
    synopsis: {
      archetype: narrative.poju_onboarding.archetype_intro,
      friction: narrative.poju_onboarding.core_conflict,
      prompt: narrative.poju_onboarding.call_to_action,
    },
    narrative_source: "llm",
  };
}

export function applyMatrixNarrativeToPayload(
  payload: PojuMatrixPayload,
  narrative: MatrixNarrativeResponse,
): PojuMatrixPayload {
  const display = payload.display;
  if (!display) return payload;
  return {
    ...payload,
    display: applyMatrixNarrativeToDisplay(display, narrative),
  };
}
