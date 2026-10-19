import type { PojuV4StateHint } from "@/lib/poju/types";

/** How+Get five stages (1–5). `current === 6` means all complete (static lit). */
export type SessionJourneyStage = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Map persisted list hint → How+Get stage index for history timeline.
 * Product phases → landing titles (immutable).
 */
export function journeyStageFromHint(
  hint: PojuV4StateHint | string | null | undefined,
  mainDeliveryDone = false,
): SessionJourneyStage {
  if (mainDeliveryDone || hint === "tracking") return 6;
  switch (hint) {
    case "delivered":
      return 4;
    case "collecting_context":
    case "awaiting_profile":
      return 3;
    case "analyzing":
    case "awaiting_confirmation":
      return 2;
    case "opening":
    case "greeting":
    case "awaiting_understanding_confirm":
    default:
      return 1;
  }
}
