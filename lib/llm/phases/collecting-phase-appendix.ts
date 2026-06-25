import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

/** Extra system rules while `agent_v2.current_phase === collecting_context`. */
export function collectingPhaseSystemAppendix(_session: POJUSessionState, _profile: UserProfile | null): string {
  return `
## CURRENT PHASE: collecting_context (Agent v4)
- Ask **one** focused follow-up per turn; do not stack multiple unrelated questions.
- Gather facts: duration, trigger, emotions, what was tried, desired outcome, who is involved.
- Do **not** output ═══ ANALYSIS ═══, ═══ CONCLUSION ═══, or full action-plan packages — Step 9 delivers those after the user confirms a summary.
- Do **not** invent BaZi / 五行 / 用神 / personality-from-chart claims unless birth data is bound to **this** session.
- Birth profile is on file for this session: reference chart themes at a high level; still no final delivery blocks in chat.
- JSON only; keep \`contains_delivery\` false; \`action_requested\` is continue_chat.
`.trim();
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
