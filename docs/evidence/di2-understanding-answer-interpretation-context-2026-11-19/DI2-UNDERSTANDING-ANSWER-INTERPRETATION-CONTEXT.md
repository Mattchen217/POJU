# DI2 Phase 2 pre-verification — Answer Interpretation receives full Understanding State

Times below are America/Chicago (UTC-6).

This records the production change that closes the remaining Understanding context contract gap before controlled live OpenRouter testing. It is **not** a DI2 / M9 / Phase 2 acceptance declaration, not a live OpenRouter E2E, and not a re-open of M1–M9.

## Baseline

- Branch: `feat/m1-r-fresh-session-main-loop`
- Pre-change HEAD: `83cc1ecfc6b57e7381c015d7626769135b98b760` (“Record Understanding and Adaptive Question Engine duty-alignment evidence”)
- Implementation commit for this change: `1630d5e5a49b763c5afe2090a945f811af110b1c`
- Prior implementation on this branch: `a086c0c0ab38e3e40e1f2fe4826b83bae3d2dbc2` (skip generic Chat LLM)
- No PR, merge to `main`, deploy, rebase, or force-push.

## What changed (implementation commit)

Production call chain only:

1. `refreshDecisionUnderstanding(session)` rebuilds `session.decision_understanding` from the latest in-process DC + Blueprint immediately before Answer Interpretation (`adaptive-turn.ts`).
2. `buildModelInterpretationContext` now includes a structured copy of the full Understanding State as `context.understanding`, plus version stamps:
   - `understanding_id`
   - `context_id`
   - `context_version`
   - `blueprint_version`
3. Existing question-scoped DC fact context is retained (`last_sent_question`, authorized DIR/DDR/role codes, related RealityFacts / Constraints / Conflicts, user answer, locale).
4. After the model returns, `interpretationContextMatchesSession` fail-closes on version mismatch — no DC write.
5. Model draft authority fields are still stripped; the model may only propose `ModelAnswerDraft`. Readiness / Scope / Budget / Freeze / next question remain server-side. No Next Question Planning LLM and no restored generic Chat LLM.

Touched production files:

- `lib/poju/decision-intake/understanding-state.ts`
- `lib/poju/decision-intake/answer-interpretation-model.ts`
- `lib/poju/decision-intake/adaptive-turn.ts`
- `lib/poju/decision-intake/index.ts`

`lib/poju/agent.ts` was inspected; no additional change was required for this contract (it already consumes adaptive-turn output and skips generic Chat LLM after authorized question / readiness confirm).

## Commands and exit codes

| Command | Exit | Result |
|---|---|---|
| `pnpm test:di2-understanding-answer-interpretation-context` | 0 | 10 passed, 0 failed |
| `pnpm test:di2-understanding-adaptive-engine-alignment` | 0 | 7 passed, 0 failed |
| `pnpm test:m1-production-adaptive-question-loop` | 0 | PASS=188 FAIL=0 |
| `pnpm test:di2-feature-landing-main-path` | 0 | 22 passed |
| `pnpm test:m5-di2-main-path` | 0 | 29 passed, 0 failed |
| `pnpm test:m6-di2-full-lifecycle` | 0 | 7 passed, 0 failed |
| `pnpm exec tsc --noEmit --pretty false` | 0 | no diagnostics |
| `pnpm build` | 0 | succeeded |

Raw logs: `logs/`.

## `public/sw.js`

`pnpm build` dirtied `public/sw.js`. It was restored with `git checkout HEAD -- public/sw.js` before commits. Working-tree object hash matches `HEAD:public/sw.js` (`1b0612a50b3a569e38c61ffeff9626175448257b`).

## Limits / non-claims

- No live OpenRouter Answer Interpretation call in this evidence pack.
- No hosted Redis/CAS, Worker/Queue, browser, or payment-path E2E.
- Does **not** declare DI2, M9, or Phase 2 acceptance.
- Independent review should verify the model now receives the same `session.decision_understanding` the UI projects, while remaining read-only for interpretation only.
