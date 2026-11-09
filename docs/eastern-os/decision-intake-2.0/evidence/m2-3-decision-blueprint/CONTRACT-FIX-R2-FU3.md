# M2.3-R2-FU3 — Fail-Closed When Understanding Cannot Be Built

**Not self-PASS.** Awaiting independent review by Max Chen.

## Git

| Field | Value |
|-------|-------|
| Branch | `feat/m1-r-fresh-session-main-loop` |
| Parent (expected starting HEAD) | `0b75716da447d608af392a816e2b23c270ddfc38` |
| Parent implementation (FU2) | `a56043aecd9d28003573521fe0062e518e0e5637` |
| Implementation commit | `a8b115803a55df4a644d8d469cd92b0a73c38b89` |
| Evidence commit | `96221e0b9ebed221509e94faf8eaf29ff91839b4` |
| Final branch HEAD / tip | `7f1e5b2907dab06fbe4730675aab57dee6ad4ec4` |
| PR / merge / deploy | none |
| Self-PASS | **no** |

## Problem

FU2 preserved `planner_blocked` when Understanding could be rebuilt after a Planner exception. Gap remained when Understanding rebuild also failed (`u=null`): the catch still returned `ready_no_question`, which could let the Agent continue ordinary LLM free-form questioning. Case C also had a false-pass path that skipped genuine replay assertions when the first turn was unexpectedly `planner_blocked`.

## Fix

### 1. `adaptive-turn.ts` — `u==null` fail-closed

Keep existing `u != null` P0/P1 + hard-budget protection. When rebuild fails (`u=null`) and a Blueprint exists:

- Attempt to read remaining hard budget; if that read also throws, treat budget as remaining.
- If hard budget may remain → return `planner_blocked` with `ask_error=understanding_exception:<message>`, `understanding=null`, `plan=null`, `authorized_question=null`.
- Do not fabricate Understanding / DIR `known` / `n_a` / investigation-complete.
- Do not expand `ready_for_final_confirm`.

### 2. `agent.ts` — Understanding / exception fail-closed

In `handleUserMessage` pre-LLM path:

- Fail-closed when `outcome===planner_blocked` **or** when there is no authorized question and `ask_error` carries `understanding_exception` / `planner_exception`, or Understanding is null while a Blueprint exists.
- Early return: system error, `collecting_context`, no confirm, no free-form LLM, no Freeze.
- Belt-and-suspenders phase / readiness-stop gates use the same blocked-or-understanding-fail predicate.

### 3. Tests

| Case | Coverage | Result |
|------|----------|--------|
| A (FU2) | idempotent replay + blocked | still `planner_blocked` |
| B (FU2) | planner exception + open P1; Agent same throwing fixture | orchestrator/collecting → `planner_blocked`; Agent fail-closes (same fixture may hit `persist_threw` before planner catch on non-empty statement — documented) |
| C (FU2) | genuine idempotent replay | **no early return**; first turn must not be `planner_blocked`; replay=`idempotent_replay`; `\|\| true` removed |
| D (FU2) | P0/P1 complete | readiness unchanged |
| E (FU3) | Understanding build+rebuild fail via throwing `question_budget.hard` | `planner_blocked` + `understanding_exception`; Agent fail-closed; session `collecting_context` |

## Files changed

- `lib/poju/decision-intake/adaptive-turn.ts`
- `lib/poju/agent.ts`
- `scripts/test-m2-3-decision-blueprint.ts`
- `docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2-FU2.md` (HEAD/tip aligned to final branch tip)
- `docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2-FU3.md`

## Test results (actual exit codes)

| Command | Exit |
|---------|------|
| `pnpm test:m2-3-decision-blueprint` | **0** (18 passed) |
| `pnpm test:m1-r-fresh-session-main-loop` | **0** (8/8) |
| `pnpm test:m1-production-adaptive-question-loop` | **0** (16/16) |
| `pnpm test:m2-1-readiness-confirm-freeze` | **0** (19/19) |
| `pnpm test:m2-2-freeze-report-binding` | **0** (43/43) |
| `pnpm test:decision-context-phase2` | **0** (9) |
| `pnpm exec next typegen` | **0** |
| `pnpm exec tsc --noEmit` | **0** |
| `pnpm build` | **0** |

## Untested

- Case B/E Agent path with the **same** in-memory throwing getter and a non-empty user statement hits DC persist before the planner/Understanding catch (`persist_threw`). Agent still fail-closes (`m1_fail_closed`, no free-form, stays `collecting_context`). Orchestrator + `runCollectingDcTurn` with `init_only` prove `planner_blocked` / `understanding_exception` for the Understanding-build failure itself.
- No full natural-language multi-turn fixture for Understanding failure (controlled getter only).
- Vercel tip preview may appear from push; not promoted.

## Explicit

No PR. No merge. No deploy/promote. No self-PASS. No tip to Max.
