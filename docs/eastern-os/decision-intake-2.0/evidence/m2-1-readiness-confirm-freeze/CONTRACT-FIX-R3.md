# M2.1 Contract Fix Round 3

Parent tip: `5a53d3aa`  
Scope: minimal Confirmation Event **reuse-path** provenance fix only. No Answer/Qgen/Personal Pattern/S0–S9 expansion. No M2.2.

## Remaining blocker (after R2)

R2 validated `confirmation_turn_id` on **new** Confirmation Events.  
`planAndAppendConfirmationEvents()` still did:

```ts
if (findMatchingUserConfirmEvent(...)) {
  continue; // skip-append without provenance on the EXISTING event
}
```

So a pre-injected event with matching target + `source_turn_id` but forged / missing / assistant `confirmation_turn_id` could be reused as authority; `applyLegalPromotionAfterEvents()` then derived `user_confirmed=true` from target+source alone.

## Fix

1. **Reuse path (fact + constraint):** before skip-append, call `assertConfirmationEventProvenance(reuseProvenanceCtx, existingEvent)`.
2. **`reuseProvenanceCtx` checks:**
   - session match
   - target exists and matches
   - `source_turn_id` → real **user** message in Session
   - `source_turn_id` matches current fact/constraint
   - `confirmation_turn_id` required and → real **user** message in Session
3. **Does NOT** require `confirmation_turn_id ===` this turn’s expected confirm turn (prior legitimate confirms OK).
4. Fail-closed on provenance failure: `promote_failed`, no partial promotions, no Freeze.
5. **New-event path** unchanged: still uses `ctx` with `require_confirmation_turn_id` + `expected_confirmation_turn_id`.
6. **Promotion authority filter:** `eventsForAuthority` drops events that fail the same reuse-style provenance before derive/`user_confirmed`.

## Tests

- C1–C11 retained (estimate / source match / new-event confirm turn / atomicity).
- **C12:** inject target+source match with `confirmation_turn_id` → missing message **or** assistant message → `promote_failed`, `user_confirmed` stays false, no Freeze, session unchanged.
- **C13:** prior legitimate `confirmation_turn_id` (different from this turn) may be reused.

## Commands

- `pnpm test:m2-1-readiness-confirm-freeze`
- `pnpm exec tsc --noEmit` (or project typecheck)

## Non-goals

- No self-PASS / 验收通过.
- No PR / merge / production deploy / tip.
- M2.2 not started.