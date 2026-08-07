/**
 * Legacy appendix — live collecting rules live in collecting-phase-v6.ts.
 * Re-export so stale imports cannot drift from the v6 control plane.
 */
export {
  POJU_V6_COLLECTING_PHASE_RULES as collectingPhaseSystemAppendixText,
} from "@/lib/llm/phases/collecting-phase-v6";
import { POJU_V6_COLLECTING_PHASE_RULES } from "@/lib/llm/phases/collecting-phase-v6";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

/** @deprecated Prefer POJU_V6_COLLECTING_PHASE_RULES via the collecting v6 phase module. */
export function collectingPhaseSystemAppendix(
  _session: POJUSessionState,
  _profile: UserProfile | null,
): string {
  return POJU_V6_COLLECTING_PHASE_RULES;
}

export function confirmationPhaseSystemAppendix(): string {
  return `
## CURRENT PHASE: awaiting_confirmation
- The UI shows a context summary for the user to confirm. You may answer small clarifications only.
- Do **not** output delivery blocks or a full verdict; Step 8–9 run after confirmation.
- Keep responses short; encourage reviewing the summary card and tapping Confirm.
- JSON only; \`contains_delivery\` must be false.
`.trim();
}
