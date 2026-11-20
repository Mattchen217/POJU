# DI2 Report-Driven Intake R1 — Evidence

**Branch:** `feat/di2-report-driven-intake`  
**Parent SHA:** `6427903331a00d2a613f06cba87a14d6552b5bc8`  
**Not a product self-PASS.** Known risks listed below.

## What landed (production path)

1. **Three-layer intake focus** (`problem_understanding` → `desired_outcome` → `report_details` → `final_understanding_review`) derived in `buildUnderstandingState` from code gates + report coverage.
2. **Problem / Desired gates** in `intake-layer-gates.ts` — code authority; model assessments are proposals only.
3. **Report section coverage** from DDR catalog (`report-section-coverage.ts`); Page 03 = local profile (no ask); Page 07 topic-gated.
4. **Investigation report map** with page/section/DDR linkage (`investigation-report-map.ts`).
5. **Model-autonomous candidate selection** among layer-filtered legal candidates; formal plan rebuilt via `buildAdaptiveQuestionPlan` + scope/budget revalidation. Illegal picks fail closed (no silent code#1 authorize).
6. **Understanding model contract** adds assessments + layer + enriched legal candidates; `code_selected_plan` replaced by `previous_plan` + `code_rank_hint`.
7. **UI** projects intake layer + asserted opening facts.

## Test commands + exit codes

| Command | Exit |
|---|---|
| `pnpm exec tsx scripts/test-di2-report-driven-intake-r1.ts` | **0** |
| `pnpm exec tsx scripts/test-m1-r-fresh-session-main-loop.ts` | **0** (PASS=8 FAIL=0) |
| `pnpm exec tsx scripts/test-di2-personalized-understanding-adaptive-wire.ts` | **0** |
| `pnpm exec tsx scripts/test-di2-report-driven-intake-r1-openrouter.ts` | **0** (SKIP: no `OPENROUTER_API_KEY` in this agent env) |

Pre-existing on baseline (unchanged by this work): `test-di2-understanding-composer-flow.ts` H/render asserts current question text inside panel markup that does not render `current_question`.

## Model autonomy (unit evidence)

`test-di2-report-driven-intake-r1.ts` D1/D2:

- Legal candidates filtered by intake layer + report purpose.
- Hook selects a non-code-rank legal candidate when available → plan rebuilt to that candidate.
- Illegal candidate id → `understanding_model_failed` and `authorized_question=null` (no silent code fallback).

## OpenRouter multi-case

Live OpenRouter pack **not executed here** — agent environment has no `OPENROUTER_API_KEY`. Script ready: `scripts/test-di2-report-driven-intake-r1-openrouter.ts` (3 cases). Re-run in an env with the key to fill `openrouter-multi-case.json`.

## Known risks / gaps

1. Live OpenRouter three-case pack pending key availability (not a design skip).
2. Browser Fresh Session smoke against easternos.com still required after production deploy.
3. Composer-flow H/render assertion pre-existing fail on baseline when panel omits current question string.
4. Soft expectation DIRs (priorities/unacceptable/stakes) do not hard-fail desired gate once outcome is grounded — intentional to avoid questionnaire fill; may under-ask on some decision types until coverage feedback.
5. `report_details` layer still allows residual desired_outcome DIRs so soft gaps can close; watch for preference drift vs hard layer isolation.
6. No force-push; Freeze / Billing / DC sole fact authority / report content SoT untouched.

## Files (implementation)

- `lib/poju/decision-intake/investigation-report-map.ts` (new)
- `lib/poju/decision-intake/intake-layer-gates.ts` (new)
- `lib/poju/decision-intake/report-section-coverage.ts` (new)
- `lib/poju/decision-intake/opening-asserted-facts.ts` (new)
- `lib/poju/decision-intake/adaptive-turn.ts`
- `lib/poju/decision-intake/understanding-response-model.ts`
- `lib/poju/decision-intake/understanding-state.ts`
- `lib/poju/decision-intake/types.ts`
- `lib/poju/decision-intake/ui-projection.ts`
- `lib/poju/decision-intake/fresh-session-bootstrap.ts`
- `lib/poju/decision-intake/index.ts`
- `components/poju/DecisionUnderstandingPanel.tsx`
- `scripts/fixtures/test-answer-interpretation-hook.ts`
- `scripts/test-di2-report-driven-intake-r1.ts`
- `scripts/test-di2-report-driven-intake-r1-openrouter.ts`
