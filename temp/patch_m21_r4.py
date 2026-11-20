from pathlib import Path

# --- 1) confirmation-event.ts: add unified authority entry ---
ce = Path(r"lib/poju/decision-context/confirmation-event.ts")
s = ce.read_text(encoding="utf-8")

old_append_with = '''/**
 * Append with provenance against a live Session snapshot (P3-112 submit path helper).
 */
export function appendConfirmationEventWithProvenance(
  ctx: ConfirmationProvenanceContext,
  existing: ConfirmationEvent[] | null | undefined,
  raw: unknown,
): AppendConfirmationResult {
  const event = validateConfirmationEvent(raw);
  assertConfirmationEventProvenance(ctx, event);
  return appendConfirmationEvent(existing, event);
}'''

new_append_with = '''/**
 * Unified authority gate for Confirmation Events (M2.1 R4).
 * Structure first (actor / event_version / event_type↔target_type / required fields),
 * then Session provenance. Used by reuse + authority-derive paths so neither can omit
 * validateConfirmationEvent().
 */
export function assertAuthoritativeConfirmationEvent(
  ctx: ConfirmationProvenanceContext,
  raw: unknown,
): ConfirmationEvent {
  const event = validateConfirmationEvent(raw);
  assertConfirmationEventProvenance(ctx, event);
  return event;
}

/**
 * Append with provenance against a live Session snapshot (P3-112 submit path helper).
 */
export function appendConfirmationEventWithProvenance(
  ctx: ConfirmationProvenanceContext,
  existing: ConfirmationEvent[] | null | undefined,
  raw: unknown,
): AppendConfirmationResult {
  const event = assertAuthoritativeConfirmationEvent(ctx, raw);
  return appendConfirmationEvent(existing, event);
}'''

if old_append_with not in s:
    raise SystemExit("appendConfirmationEventWithProvenance block not found")
s = s.replace(old_append_with, new_append_with, 1)
ce.write_text(s, encoding="utf-8")
print("OK confirmation-event.ts unified entry")

# --- 2) confirm-and-freeze.ts ---
cf = Path(r"lib/poju/decision-intake/confirm-and-freeze.ts")
s = cf.read_text(encoding="utf-8")

old_import = '''import {
  appendConfirmationEventWithProvenance,
  assertConfirmationEventProvenance,
  deriveUserConfirmedFromEvents,
  findMatchingUserConfirmEvent,
  hasUserConfirmEventForTarget,
  makeFactConfirmEventId,
  type ConfirmationEvent,
} from "@/lib/poju/decision-context/confirmation-event";'''

new_import = '''import {
  appendConfirmationEventWithProvenance,
  assertAuthoritativeConfirmationEvent,
  deriveUserConfirmedFromEvents,
  findMatchingUserConfirmEvent,
  hasUserConfirmEventForTarget,
  makeFactConfirmEventId,
  type ConfirmationEvent,
} from "@/lib/poju/decision-context/confirmation-event";'''

if old_import not in s:
    raise SystemExit("import block not found")
s = s.replace(old_import, new_import, 1)

# Update comment about Existing events
old_comment = ''' * - Existing events must match target + source AND pass full provenance (real user
 *   confirmation_turn_id); forged/assistant confirm turns fail-closed (no skip-as-authority)'''
new_comment = ''' * - Existing events must match target + source AND pass full authority gate
 *   (validateConfirmationEvent structure + provenance); forged/assistant confirm turns
 *   or structurally illegal actors/event_types fail-closed (no skip-as-authority)'''
if old_comment not in s:
    raise SystemExit("existing-events comment not found")
s = s.replace(old_comment, new_comment, 1)

# Fact reuse: replace provenance-only with unified
old_fact_reuse = '''      if (existingFactEvent) {
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
      }'''

new_fact_reuse = '''      if (existingFactEvent) {
        // Reuse path: structure (validateConfirmationEvent) THEN provenance.
        // confirmation_turn_id must be a real user turn but need not equal this turn.
        try {
          assertAuthoritativeConfirmationEvent(reuseProvenanceCtx, existingFactEvent);
        } catch (e) {
          return {
            events: [...(input.session.confirmation_events ?? [])],
            plans: [],
            newly_appended: 0,
            error: e instanceof Error ? e.message : String(e),
          };
        }
        continue;
      }'''

if old_fact_reuse not in s:
    # try with different dash character
    raise SystemExit("fact reuse block not found — dump nearby")
s = s.replace(old_fact_reuse, new_fact_reuse, 1)

old_constraint_reuse = '''    if (existingConstraintEvent) {
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
    }'''

new_constraint_reuse = '''    if (existingConstraintEvent) {
      try {
        assertAuthoritativeConfirmationEvent(reuseProvenanceCtx, existingConstraintEvent);
      } catch (e) {
        return {
          events: [...(input.session.confirmation_events ?? [])],
          plans: [],
          newly_appended: 0,
          error: e instanceof Error ? e.message : String(e),
        };
      }
      continue;
    }'''

if old_constraint_reuse not in s:
    raise SystemExit("constraint reuse block not found")
s = s.replace(old_constraint_reuse, new_constraint_reuse, 1)

old_authority = '''  // 2) Derive status + user_confirmed only from provenance-valid events.
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
  });'''

new_authority = '''  // 2) Derive status + user_confirmed only from structure+provenance-valid events.
  // Structurally illegal (actor/event_type) or forged confirm turns must not confer authority.
  const eventsForAuthority = built.events.filter((event) => {
    try {
      assertAuthoritativeConfirmationEvent(
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
  });'''

if old_authority not in s:
    raise SystemExit("eventsForAuthority block not found")
s = s.replace(old_authority, new_authority, 1)

# Rename reuseProvenanceCtx comment slightly for clarity (optional keep name)
cf.write_text(s, encoding="utf-8")
print("OK confirm-and-freeze.ts")
print("assertAuthoritativeConfirmationEvent count:", s.count("assertAuthoritativeConfirmationEvent"))
print("assertConfirmationEventProvenance remaining:", s.count("assertConfirmationEventProvenance"))
