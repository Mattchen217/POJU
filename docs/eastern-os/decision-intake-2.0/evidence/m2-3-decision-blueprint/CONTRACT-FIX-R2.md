# M2.3-R2 — Fix Production Priority Activation / Readiness Ordering

**Not self-PASS.** Awaiting independent review by Max Chen.

## Git

| Field | Value |
|-------|-------|
| Branch | `feat/m1-r-fresh-session-main-loop` |
| Parent | `768601783a9d92b4d8b090741e75aa06f7869af9` |
| HEAD | _(filled after commit)_ |
| PR / merge / deploy | none |
| Self-PASS | **no** |

## Problem

1. `planFromState()` called `activateNextBlueprintPriorityBand()` **after** Understanding/Readiness was already calculated, then reused the stale `can_ask`.
2. `buildUnderstandingState()` could early-stop via `sufficiency.canStop` or `criticalCovered && hasCollectingEvidence` while selected-Blueprint P0/P1 obligations remained open.

## Fix

### 1. Authoritative production sequence (`adaptive-turn.ts`)

Normative order now:

1. Persist answer to DC (unless `init_only`)
2. `ensureDecisionBlueprint`
3. `activateNextBlueprintPriorityBand()` against the **latest** DC
4. `buildUnderstandingState` (Readiness on activated DC + Blueprint)
5. If `can_ask`, build candidates → plan → authorize next Q
6. Persist Understanding + plan via `withUnderstanding`

- Removed band activation from `planFromState()` (no second competing scheduler after Readiness).
- Same activate-then-understand order applied to idempotent-replay and off-topic paths.

Note: `ensureDecisionBlueprint` already invokes band activation (R1). The explicit call in `runAdaptiveQuestionTurn` is idempotent and guarantees Understanding never runs before activation even if ensure short-circuits.

### 2. Premature Readiness termination (`understanding-state.ts`)

- Open selected-Blueprint P0/P1 needs (`priority === "P0" | "P1"`) force `verdict=continue`, `can_ask=true` while hard budget remains (`open_blueprint_p0_p1_obligations`).
- `sufficiency.canStop` and `criticalCovered && hasCollectingEvidence` no longer bypass unfinished P0/P1.
- Hard-budget exhaustion still ends asking; remaining DIRs stay in `need_to_understand`.
- Soft-budget P2 deferral unchanged; never auto-marked `known` / `n_a`.
- `must_continue` now includes P1 for consistency.
- M2.1 Confirmation Event / Freeze authority unchanged.

### 3. Production-path tests (`scripts/test-m2-3-decision-blueprint.ts`)

Exercise `runAdaptiveQuestionTurn()` (production orchestrator):

| Case | Result |
|------|--------|
| A — P0 partial | `can_ask=true`, next Q gate=P0, P1 not activated |
| B — P0 complete fixture → orchestrator | P1 activated as `unknown`, understanding.context_version == DC version, plan=P1, authorized Q == assistant message |
| C — unfinished P1 | P1 in `need_to_understand`, not `understood`, `can_ask=true` while budget remains |

Existing full-scope / seed / fact-safety / Catalog tests retained.

## Files changed

- `lib/poju/decision-intake/adaptive-turn.ts`
- `lib/poju/decision-intake/understanding-state.ts`
- `scripts/test-m2-3-decision-blueprint.ts`
- `docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2.md`

## Test results (actual exit codes)

| Command | Exit |
|---------|------|
| `pnpm test:m2-3-decision-blueprint` | **0** (10 passed) |
| `pnpm test:m1-r-fresh-session-main-loop` | **0** (8/8) |
| `pnpm test:m1-production-adaptive-question-loop` | **0** (16/16) |
| `pnpm test:m2-1-readiness-confirm-freeze` | **0** (19/19) |
| `pnpm test:m2-2-freeze-report-binding` | **0** (43/43) |
| `pnpm test:decision-context-phase2` | **0** (9) |
| `pnpm exec next typegen` | **0** |
| `pnpm exec tsc --noEmit` | **0** |
| `pnpm build` | **0** |

## Remaining untested / limitations

- Case B/C use P0-complete fixtures (direct `current_state: "known"`), not full natural-language multi-turn P0 completion — orchestrator after fixture is production `runAdaptiveQuestionTurn`.
- Case B assistant equality simulated via `attachAuthorizedAssistantQuestion` + pushed assistant message (same helper agent uses), not a live `handleUserMessage` after the fixture (fixture would be disturbed by answer interpretation).
- Band activation also remains inside `ensureDecisionBlueprint` (R1); turn path still builds Understanding only after activation.
- Soft-budget P2 early-confirm via `criticalCovered` when only P2 remains open is retained by design.

## Vercel

Tip deployment may appear for the pushed commit — **not promoted**.
