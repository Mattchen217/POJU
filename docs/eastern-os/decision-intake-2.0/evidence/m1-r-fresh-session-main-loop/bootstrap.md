# M1-R Fresh-session bootstrap

## Gap vs prior M1

Prior `handleUserMessage` ran M1 only when:
- `current_phase === collecting_context` AND
- `decision_context.status === draft`

Brand-new `createPOJUSession` starts with **no DC** and phase effectively **opening**, so the first question stayed on the old Agent free-ask path. `seedSession()` tests that inject DC are **not** complete start proof.

## Fix

`lib/poju/decision-intake/fresh-session-bootstrap.ts`
- `bootstrapFreshSessionMainLoop` creates draft DC + starter DIRs + Blueprint + first adaptive plan
- Wired through `runM1ProductionPreLlmTurn` from `handleUserMessage` when no draft DC

## Starter DIRs (v1 simplified)

Formal catalog ids (not Call-B agenda authority):
- DIR-OPT-ON-TABLE
- DIR-STATUS-QUO
- DIR-OPT-CONSTRAINTS
- DIR-RISK-TOLERANCE

## Explicit non-claims

- Full Opening gate / Call A / Call B still exist for the long path; M1-R adds a **minimal runnable** entry
- Answer Interpretation + Question Generation remain **v1 simplified**
- Personal Pattern may stay `unavailable`
- S9 is **not** accepted merely because this branch inherits S9 commits
- Do not treat this branch as ready to merge to `main` (wait for PR #36 / Max)
