/**
 * Typed Session / Confirmation Event builders for Intake R6 tests — scripts/** only.
 * Must never be imported from lib/ or app/ production modules.
 *
 * Fills every required POJUSessionState field so tests do not cast partial
 * objects to the Session type; the filler values carry no N/A authority.
 */

import type { ConfirmationEvent } from "@/lib/poju/decision-context/confirmation-event";
import type { POJUSessionState } from "@/lib/poju/types";

export function testSessionState(
  sessionId: string,
  at: string,
  patch: Partial<POJUSessionState> = {},
): POJUSessionState {
  return {
    session_id: sessionId,
    device_id: "dev_intake_r6_test",
    original_question: "intake r6 test",
    messages: [],
    context_collected: {},
    has_profile: false,
    profile_skipped: false,
    actions: [],
    main_delivery_done: false,
    main_delivery: null,
    tokens_used: 0,
    abuse_metrics: { long_input_count: 0, jailbreak_attempts: 0, duplicate_attempts: 0 },
    created_at: at,
    last_interaction_at: at,
    expires_at: at,
    ...patch,
  };
}

/** E1 confirm_fact event for `factId`. */
export function confirmFactEvent(args: {
  factId: string;
  sourceTurnId: string;
  confirmationTurnId: string | null;
  confirmedAt: string;
  eventId?: string;
  confirmationActionId?: string;
}): ConfirmationEvent {
  return {
    event_id: args.eventId ?? `e1_${args.factId}`,
    target_type: "fact",
    fact_id: args.factId,
    source_turn_id: args.sourceTurnId,
    confirmation_turn_id: args.confirmationTurnId,
    confirmation_action_id: args.confirmationActionId ?? `ca_${args.factId}`,
    event_type: "confirm_fact",
    actor: "user",
    confirmed_at: args.confirmedAt,
    event_version: 1,
  };
}
