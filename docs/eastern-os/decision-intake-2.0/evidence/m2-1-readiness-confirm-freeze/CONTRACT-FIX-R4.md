# M2.1 Contract Fix Round 4

Parent tip: `ebe98910`  
Scope: minimal Confirmation Event **structure validation** on reuse + authority-derive paths. No Answer/Qgen/Personal Pattern/S0–S9 expansion. No M2.2. Does not reopen R1–R3 semantics.

## Remaining blocker (after R3)

R3 called `assertConfirmationEventProvenance()` on reuse and `eventsForAuthority`, but those paths still skipped `validateConfirmationEvent()`.

`validateConfirmationEvent()` already enforces:
- `actor === "user"`
- `event_version === 1`
- `event_type` consistent with `target_type`
- required fields / mutual exclusion

`findMatchingUserConfirmEvent()` and `deriveUserConfirmedFromEvents()` match on target + source only (no actor / structure check).

So a pre-injected event with matching target + `source_turn_id` + real `confirmation_turn_id`, but `actor !== "user"` or `event_type`/`target_type` mismatch, could still be reused as confirmation authority.

## Fix

1. **Unified authority entry** `assertAuthoritativeConfirmationEvent(ctx, raw)` in `confirmation-event.ts`:
   - `validateConfirmationEvent(raw)` first
   - then `assertConfirmationEventProvenance(ctx, event)`
   - returns the validated event
2. **Reuse path (fact + constraint):** call `assertAuthoritativeConfirmationEvent(reuseProvenanceCtx, existingEvent)` before skip-append.
3. **Authority filter:** `eventsForAuthority` uses the same unified entry before derive / `user_confirmed`.
4. **New-event path:** `appendConfirmationEventWithProvenance` now goes through the same unified entry (then append).
5. Fail-closed on structure failure: `promote_failed`, no `user_confirmed=true`, no Freeze, session unchanged.
6. R3 provenance rules unchanged (existing events need real user `confirmation_turn_id`, not necessarily this turn).

## Tests

- C1–C13 retained.
- **C14:** inject target + source + legitimate prior `confirmation_turn_id`, but:
  - `actor: "system"`, **or**
  - `event_type: "confirm_constraint"` with `target_type: "fact"`
  → `promote_failed`, `user_confirmed` stays false, no Freeze, session unchanged.
- Static: module must wire `assertAuthoritativeConfirmationEvent` on reuse; helper must call validate then provenance.

## Commands

- `pnpm test:m2-1-readiness-confirm-freeze`
- `pnpm exec tsc --noEmit`

## Non-goals

- No self-PASS / 验收通过.
- No PR / merge / production deploy / tip.
- M2.2 not started.
