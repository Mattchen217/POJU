from pathlib import Path

path = Path(r"lib/poju/decision-intake/confirm-and-freeze.ts")
s = path.read_text(encoding="utf-8")

def must_replace(label, old, new):
    global s
    if old not in s:
        raise SystemExit(f"{label} not found")
    s = s.replace(old, new, 1)
    print("replaced:", label)

must_replace(
    "IMPORT",
    """import {
  appendConfirmationEventWithProvenance,
  deriveUserConfirmedFromEvents,
  findMatchingUserConfirmEvent,
  hasUserConfirmEventForTarget,
  makeFactConfirmEventId,
  type ConfirmationEvent,
} from \"@/lib/poju/decision-context/confirmation-event\";""",
    """import {
  appendConfirmationEventWithProvenance,
  assertConfirmationEventProvenance,
  deriveUserConfirmedFromEvents,
  findMatchingUserConfirmEvent,
  hasUserConfirmEventForTarget,
  makeFactConfirmEventId,
  type ConfirmationEvent,
} from \"@/lib/poju/decision-context/confirmation-event\";""",
)

must_replace(
    "COMMENT",
    """ * - Existing events must match target + source; stale target-only events do not skip""",
    """ * - Existing events must match target + source AND pass full provenance (real user
 *   confirmation_turn_id); forged/assistant confirm turns fail-closed (no skip-as-authority)
 * - Stale target-only events do not skip""",
)

must_replace(
    "CTX",
    """  const ctx = {
    session_id: input.session.session_id,
    expected_session_id: input.session.session_id,
    messages: input.session.messages,
    decision_context: input.before,
    expected_confirmation_turn_id: input.confirmationTurnId,
    require_confirmation_turn_id: true,
  };
  let newly_appended = 0;""",
    """  const ctx = {
    session_id: input.session.session_id,
    expected_session_id: input.session.session_id,
    messages: input.session.messages,
    decision_context: input.before,
    expected_confirmation_turn_id: input.confirmationTurnId,
    require_confirmation_turn_id: true,
  };
  // Existing-event reuse: same provenance rules, but confirmation_turn_id may be a
  // prior legitimate user confirm turn (not necessarily this turn).
  const reuseProvenanceCtx = {
    session_id: input.session.session_id,
    expected_session_id: input.session.session_id,
    messages: input.session.messages,
    decision_context: input.before,
    require_confirmation_turn_id: true,
  };
  let newly_appended = 0;""",
)

must_replace(
    "FACT_REUSE",
    """    if (plan.kind === \"fact\") {
      if (
        findMatchingUserConfirmEvent(
          events,
          { type: \"fact\", fact_id: plan.fact_id },
          { source_turn_id: plan.source_turn_id },
        )
      ) {
        continue;
      }""",
    """    if (plan.kind === \"fact\") {
      const existingFactEvent = findMatchingUserConfirmEvent(
        events,
        { type: \"fact\", fact_id: plan.fact_id },
        { source_turn_id: plan.source_turn_id },
      );
      if (existingFactEvent) {
        // Reuse path: full provenance on the EXISTING event (session/target/source/
        // confirmation_turn must be real user turns). Do NOT require confirmation_turn_id
        // to equal this turn — prior legitimate confirms are allowed.
        try {
          assertConfirmationEventProvenance(reuseProvenanceCtx, existingFactEvent);
        } catch (e) {
          return {
            events: [...(input.session.confirmation_events ?? [])],
            plans: [],
            newly_appended: 0,
            error: e instanceof Error ? e.message : String(e),
          };
        }
        continue;
      }""",
)

must_replace(
    "CONSTRAINT_REUSE",
    """    if (
      findMatchingUserConfirmEvent(
        events,
        { type: \"constraint\", constraint_id: plan.constraint_id },
        { source_turn_id: plan.source_turn_id },
      )
    ) {
      continue;
    }""",
    """    const existingConstraintEvent = findMatchingUserConfirmEvent(
      events,
      { type: \"constraint\", constraint_id: plan.constraint_id },
      { source_turn_id: plan.source_turn_id },
    );
    if (existingConstraintEvent) {
      try {
        assertConfirmationEventProvenance(reuseProvenanceCtx, existingConstraintEvent);
      } catch (e) {
        return {
          events: [...(input.session.confirmation_events ?? [])],
          plans: [],
          newly_appended: 0,
          error: e instanceof Error ? e.message : String(e),
        };
      }
      continue;
    }""",
)

must_replace(
    "APPLY",
    """  // 2) Derive status + user_confirmed from events only.
  const applied = applyLegalPromotionAfterEvents({
    before: dc,
    events: built.events,
    now,
  });""",
    """  // 2) Derive status + user_confirmed only from provenance-valid events.
  // Invalid injected events (forged/assistant confirmation_turn_id) must not confer authority.
  const eventsForAuthority = built.events.filter((event) => {
    try {
      assertConfirmationEventProvenance(
        {
          session_id: input.session.session_id,
          expected_session_id: input.session.session_id,
          messages: input.session.messages,
          decision_context: dc,
          require_confirmation_turn_id: true,
        },
        event,
      );
      return true;
    } catch {
      return false;
    }
  });
  const applied = applyLegalPromotionAfterEvents({
    before: dc,
    events: eventsForAuthority,
    now,
  });""",
)

path.write_text(s, encoding="utf-8", newline="")
print("OK", path, "len", len(s))