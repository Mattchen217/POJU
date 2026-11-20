const fs = require("fs");
const path = "lib/poju/decision-intake/confirm-and-freeze.ts";
let s = fs.readFileSync(path, "utf8");

const oldImport = `import {
  appendConfirmationEventWithProvenance,
  deriveUserConfirmedFromEvents,
  findMatchingUserConfirmEvent,
  hasUserConfirmEventForTarget,
  makeFactConfirmEventId,
  type ConfirmationEvent,
} from "@/lib/poju/decision-context/confirmation-event";`;

const newImport = `import {
  appendConfirmationEventWithProvenance,
  assertConfirmationEventProvenance,
  deriveUserConfirmedFromEvents,
  findMatchingUserConfirmEvent,
  hasUserConfirmEventForTarget,
  makeFactConfirmEventId,
  type ConfirmationEvent,
} from "@/lib/poju/decision-context/confirmation-event";`;

if (!s.includes(oldImport)) {
  console.error("IMPORT block not found");
  process.exit(1);
}
s = s.replace(oldImport, newImport);

const oldComment = ` * - Existing events must match target + source; stale target-only events do not skip`;
const newComment = ` * - Existing events must match target + source AND pass full provenance (real user
 *   confirmation_turn_id); forged/assistant confirm turns fail-closed (no skip-as-authority)
 * - Stale target-only events do not skip`;
if (!s.includes(oldComment)) {
  console.error("comment not found");
  process.exit(1);
}
s = s.replace(oldComment, newComment);

const oldCtx = `  const ctx = {
    session_id: input.session.session_id,
    expected_session_id: input.session.session_id,
    messages: input.session.messages,
    decision_context: input.before,
    expected_confirmation_turn_id: input.confirmationTurnId,
    require_confirmation_turn_id: true,
  };
  let newly_appended = 0;`;

const newCtx = `  const ctx = {
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
  let newly_appended = 0;`;

if (!s.includes(oldCtx)) {
  console.error("CTX block not found");
  process.exit(1);
}
s = s.replace(oldCtx, newCtx);

const oldFactReuse = `    if (plan.kind === "fact") {
      if (
        findMatchingUserConfirmEvent(
          events,
          { type: "fact", fact_id: plan.fact_id },
          { source_turn_id: plan.source_turn_id },
        )
      ) {
        continue;
      }`;

const newFactReuse = `    if (plan.kind === "fact") {
      const existingFactEvent = findMatchingUserConfirmEvent(
        events,
        { type: "fact", fact_id: plan.fact_id },
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
      }`;

if (!s.includes(oldFactReuse)) {
  console.error("FACT reuse block not found");
  process.exit(1);
}
s = s.replace(oldFactReuse, newFactReuse);

const oldConstraintReuse = `    if (
      findMatchingUserConfirmEvent(
        events,
        { type: "constraint", constraint_id: plan.constraint_id },
        { source_turn_id: plan.source_turn_id },
      )
    ) {
      continue;
    }`;

const newConstraintReuse = `    const existingConstraintEvent = findMatchingUserConfirmEvent(
      events,
      { type: "constraint", constraint_id: plan.constraint_id },
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
    }`;

if (!s.includes(oldConstraintReuse)) {
  console.error("CONSTRAINT reuse block not found");
  process.exit(1);
}
s = s.replace(oldConstraintReuse, newConstraintReuse);

const oldApplyCall = `  // 2) Derive status + user_confirmed from events only.
  const applied = applyLegalPromotionAfterEvents({
    before: dc,
    events: built.events,
    now,
  });`;

const newApplyCall = `  // 2) Derive status + user_confirmed only from provenance-valid events.
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
  });`;

if (!s.includes(oldApplyCall)) {
  console.error("APPLY call not found");
  process.exit(1);
}
s = s.replace(oldApplyCall, newApplyCall);

fs.writeFileSync(path, s);
console.log("confirm-and-freeze.ts patched OK");
