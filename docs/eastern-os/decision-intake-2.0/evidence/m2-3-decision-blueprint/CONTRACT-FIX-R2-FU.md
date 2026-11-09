# M2.3-R2-FU — Prevent Planner from Bypassing Open P0/P1 Obligations

**Not self-PASS.** Awaiting independent review by Max Chen.

## Git

| Field | Value |
|-------|-------|
| Branch | `feat/m1-r-fresh-session-main-loop` |
| Parent | `adcda6574f13c505aea3cacf59ce5fd852767e61` |
| Impl | `b7c7b98c989dc7b5240665c92cd7b2345658330b` |
| HEAD | 8db221cd06720a0f32f3bb1ebd2732274cf44751 |
| PR / merge / deploy | none |
| Self-PASS | **no** |

## Problem

After R2, Readiness correctly keeps `can_ask` while Blueprint P0/P1 obligations remain open, but `planFromState()` still had two planner-failure paths that silently set `ready_for_final_confirm` / `can_ask=false`:

1. `planResult.selected === null` (no selectable candidate)
2. Selected + every alternative candidate fails `buildAdaptiveQuestionPlan()` validation

Agent then entered `awaiting_confirmation` and showed the final understanding-confirmation prompt (or could fall through to free-form model text).

## Fix

### 1. `planFromState()` (`adaptive-turn.ts`)

When open Blueprint P0/P1 needs remain **and** hard budget remains:

- Prefer a deterministic Catalog-scoped fallback question for an unfinished P0/P1 DIR (DDR association + Blueprint scope/depth/budget via `buildAdaptiveQuestionPlan`).
- If no valid question can be generated, return explicit nonterminal `planner_blocked` with `verdict=continue`, `can_ask=true`, preserve exact reject reason, keep obligations in `need_to_understand`.
- Never convert planner failure into successful investigation completion while P0/P1 remain open.
- Without open P0/P1 (or hard budget exhausted), prior ready/exhausted behavior unchanged.

### 2. Outcome plumbing

- `AdaptiveTurnResult.outcome` adds `planner_blocked`
- `CollectingDcTurnOutcome` adds `planner_blocked` (mapped from adaptive turn; `ask_planned=false`)

### 3. Agent (`agent.ts`)

- Explicit early handling for `planner_blocked` (same fail-closed shape as persist failure): keep `collecting_context`, no final-confirm prompt, no unauthorized free-form investigation question, retryable system reply + `m1_planner_blocked` meta.
- Post-LLM confirm / `awaiting_confirmation` paths explicitly exclude `planner_blocked`.

### 4. Tests (`scripts/test-m2-3-decision-blueprint.ts`)

| Case | Result |
|------|--------|
| A — open P0 + budget + no selectable | `planner_blocked`; P0 in needs; Agent nonterminal + blocked reply |
| B — open P1 + budget + all candidates rejected | `planner_blocked`; validation reason preserved; no unauthorized Q |
| C — P0/P1 genuinely complete | `ready_for_final_confirm` / `can_ask=false`; not `planner_blocked` |

Existing full-scope / seed / fact-safety / Catalog / R1 / R2 Case A/B/C retained.

## Files changed

- `lib/poju/decision-intake/adaptive-turn.ts`
- `lib/poju/decision-intake/types.ts`
- `lib/poju/collecting-dc-turn.ts`
- `lib/poju/agent.ts`
- `lib/poju/types.ts`
- `scripts/test-m2-3-decision-blueprint.ts`
- `docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2-FU.md`

## Test results (actual exit codes)

| Command | Exit |
|---------|------|
| `pnpm test:m2-3-decision-blueprint` | **0** (13 passed) |
| `pnpm test:m1-r-fresh-session-main-loop` | **0** (8/8) |
| `pnpm test:m1-production-adaptive-question-loop` | **0** (16/16) |
| `pnpm test:m2-1-readiness-confirm-freeze` | **0** (19/19) |
| `pnpm test:m2-2-freeze-report-binding` | **0** (43/43) |
| `pnpm test:decision-context-phase2` | **0** (9) |
| `pnpm exec next typegen` | **0** |
| `pnpm exec tsc --noEmit` | **0** |
| `pnpm build` | **0** |

## Remaining untested / limitations

- Case A/B use depth-exhaustion / `depth_soft_cap=0` fixtures to force planner failure (not full natural multi-turn language).
- Case C Agent path may stay in collecting if the follow-up user message re-opens planning; orchestrator readiness/final-confirm behavior is what is asserted as unchanged.
- Catalog fallback success path (valid fallback when primary selected is null but an alternate DIR still validates) is implemented but not separately fixture-covered beyond rejection→blocked.
- M2.1 Confirm/Freeze authority not re-litigated here (m2-1 suite green).
