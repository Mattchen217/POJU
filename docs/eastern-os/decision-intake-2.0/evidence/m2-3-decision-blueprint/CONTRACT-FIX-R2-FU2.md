# M2.3-R2-FU2 — Preserve planner_blocked Across Replay and Exception Paths

**Not self-PASS.** Awaiting independent review by Max Chen.

## Git

| Field | Value |
|-------|-------|
| Branch | `feat/m1-r-fresh-session-main-loop` |
| Parent | `91a37517dda05a8868af8ba0c3b75088154d0c88` |
| Impl | `a56043aecd9d28003573521fe0062e518e0e5637` |
| HEAD / tip | `9f8001b89ac052400037d5de2e953eb48a7179a2` |
| PR / merge / deploy | none |
| Self-PASS | **no** |
| Note | Branch tip advanced by M2.3-R2-FU3; table tip aligned to final HEAD. FU2 impl remains `a56043aecd9d28003573521fe0062e518e0e5637`. |

## Problem

FU1 introduced nonterminal `planner_blocked` for open Blueprint P0/P1 + remaining hard budget when the Planner has no selectable candidate or every candidate fails validation. Two exits still dropped that protection:

1. Idempotent replay (`turn_already_mapped`) always returned `idempotent_replay` after `planFromState()`, even when `planned.planner_block` was set.
2. The final `planFromState()` / `buildUnderstandingState()` catch in `runAdaptiveQuestionTurn()` always converted exceptions to `ready_no_question`, which could let the Agent free-generate questions or treat the turn as investigation-complete.

`mapAdaptiveOutcome()` also treated `understanding != null` alone as `ask_planned=true` on genuine `idempotent_replay`.

## Fix

### 1. Idempotent replay (`adaptive-turn.ts`)

After `planFromState()` on `turn_already_mapped`:

- If `planned.planner_block` exists → return `planner_blocked` with `ask_error` from `reason_code:detail`.
- Keep planned session / understanding / plan / authorized_question.
- Only return `idempotent_replay` when Planner is not blocked.
- `persist_error` remains `turn_already_mapped`.

### 2. Collecting-turn mapping (`collecting-dc-turn.ts`)

- Evaluate `planner_blocked` before `idempotent_replay`.
- `planner_blocked` → `ask_planned=false`, `authorized_question=null`, `plan=null`, preserve `ask_error`.
- Genuine `idempotent_replay`: `ask_planned` only from an actual `plan` or an explicit readiness-stop (`can_ask=false` and verdict `ready_for_final_confirm` / `hard_budget_exhausted`), not from `understanding != null` alone.

### 3. Planner exception catch (`adaptive-turn.ts`)

On exception after band activation:

- Prefer already-built Understanding; else best-effort rebuild for protection check.
- If open Blueprint P0/P1 needs remain and hard budget remains → `planner_blocked`, `verdict=continue`, `can_ask=true`, obligations preserved, `authorized_question=null`, `ask_error=planner_exception:<message>`.
- Otherwise keep prior `ready_no_question` semantics (with Understanding when available).
- Never disguise the exception as investigation complete while P0/P1 remain open.

### 4. Tests (`scripts/test-m2-3-decision-blueprint.ts`)

| Case | Path coverage | Result |
|------|---------------|--------|
| A — idempotent replay + blocked | `runAdaptiveQuestionTurn` + `runCollectingDcTurn` + `handleUserMessage` | stays `planner_blocked`; `ask_planned=false`; no confirm; no free-form; `collecting_context` |
| B — planner exception + open P1 | controlled `depth_per_direction` throw + Agent | `planner_blocked` not `ready_no_question`; P1 in needs; no awaiting_confirmation |
| C — genuine idempotent replay | answer then same `source_turn_id` | stays `idempotent_replay` (not rewritten to blocked) |
| D — P0/P1 complete | readiness / Agent | terminal readiness unchanged; not `planner_blocked` |

Existing M2.3 / R1 / R2 / FU1 cases retained (17 total).

## Files changed

- `lib/poju/decision-intake/adaptive-turn.ts`
- `lib/poju/collecting-dc-turn.ts`
- `scripts/test-m2-3-decision-blueprint.ts`
- `docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2-FU.md` (HEAD corrected to actual tip `91a37517…`; evidence commit noted separately)
- `docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2-FU2.md`

## Test results (actual exit codes)

| Command | Exit |
|---------|------|
| `pnpm test:m2-3-decision-blueprint` | **0** (17 passed) |
| `pnpm test:m1-r-fresh-session-main-loop` | **0** (8/8) |
| `pnpm test:m1-production-adaptive-question-loop` | **0** (16/16) |
| `pnpm test:m2-1-readiness-confirm-freeze` | **0** (19/19) |
| `pnpm test:m2-2-freeze-report-binding` | **0** (43/43) |
| `pnpm test:decision-context-phase2` | **0** (9) |
| `pnpm exec next typegen` | **0** |
| `pnpm exec tsc --noEmit` | **0** |
| `pnpm build` | **0** |

## Remaining untested / limitations

- Case A forces `turn_already_mapped` via a planted prior `reality_fact` with the same `source_turn_id` plus P0 depth exhaustion (not a full natural-language multi-turn that first applies then replays under blocked conditions).
- Case B uses a controlled throwing getter on `question_budget.depth_per_direction` to exercise the catch; Agent assertion then uses a non-throwing `depth_soft_cap=0` fixture so the Agent path also stays blocked without relying on the same getter.
- Case C / D Agent follow-up may remain `collecting_context` depending on answer re-opening needs; terminal confirmation is asserted at orchestrator Readiness for Case D.
- Catalog fallback "successfully selects a compliant question" on the replay path is implemented by FU1/`planFromState` but has no dedicated FU2 success fixture.

## Explicit

No PR. No merge. No deploy/promote. No self-PASS.
