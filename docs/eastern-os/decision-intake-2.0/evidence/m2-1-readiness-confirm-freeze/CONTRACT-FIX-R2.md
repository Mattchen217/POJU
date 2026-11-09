# M2.1 Contract Fix Round 2

Parent tip: `d3d808d8`  
Scope: minimal Confirmation Event authority fixes only. No Answer/Qgen/Personal Pattern/S0–S9 expansion.

## Blockers addressed

### 1. user_estimate confirm semantics
- `isEligibleForConfirmEvent` includes `user_estimate` + `unverified`.
- Plan creates a Confirmation Event for estimates.
- `applyLegalPromotionAfterEvents` keeps `status=unverified` + `verification_level=user_estimate`.
- `user_confirmed` is derived from a matching event (`deriveUserConfirmed` already allows estimate+event → true).
- Confirming an estimate ≠ promoting it to `confirmed` / `user_asserted`.

### 2. Existing events must match source
- Added `findMatchingUserConfirmEvent` / opts on `hasUserConfirmEventForTarget`.
- Skip-append and `user_confirmed` derivation require **target + current `source_turn_id`**.
- Stale target-only / wrong-source events do not confirm a fact whose source changed.
- Action ids include source (`…__${source_turn_id}`) so a new source can append a new event.

### 3. confirmation_turn_id provenance
- `assertConfirmationEventProvenance` validates non-null `confirmation_turn_id` against a real Session user message.
- Optional `require_confirmation_turn_id` + `expected_confirmation_turn_id` on provenance context.
- M2.1 plan path sets both (`require_confirmation_turn_id: true`).

## Tests
- C1 updated (no longer locks `user_confirmed=false` for estimates).
- C9 stale source cannot confirm alone / new matching event required.
- C10 fake `confirmation_turn_id` → `promote_failed`, no partial state.
- C11 first event would succeed, later provenance fails → discard all tentative events.
- Prior C2–C8 / E2E retained with estimate-aware assertions.

## Non-goals
- No M2.2 report binding.
- No merge / deploy / self-PASS.
