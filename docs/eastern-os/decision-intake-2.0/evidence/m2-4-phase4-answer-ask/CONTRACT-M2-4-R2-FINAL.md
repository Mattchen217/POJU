# M2.4-R2 — Final Production Closure (Phase 4 dynamic Q&A)

This is an evidence record for the production change on `feat/m1-r-fresh-session-main-loop`. It does not declare the product PASS.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Remote branch HEAD at start, equal to local HEAD and parent of the implementation (FU10 evidence tip): `b0e370c1d0f58af9f1af6787e31e78ce1cdba946`
- Implementation SHA (all regressions below ran on this commit): `a2be6096a8e32b683c92129945db4a685671399a`
- Evidence tip SHA: _(this commit; left for independent review)_
- `origin/main` observed: `ee8c96e8a7a128fa8e059c2a9f81c9f0d2127688`. Not merged, not rebased onto.
- No PR opened. Nothing deployed or promoted. No force-push.

## Production chain

Every ordinary intake answer takes one path. There is no free-form bypass:

`handleUserMessage` → `runM1ProductionPreLlmTurn` → `runCollectingDcTurn` → `runAdaptiveQuestionTurn` → `interpretAnswerWithModel`, a single real OpenRouter call made from the server route `POST /api/poju/answer-interpretation` → `parseAndValidateModelAnswerDraft` → deterministic authorization → `answerEventFromModelDraft` → pending / `ProposedWrite` → `applyAnswerEventToSessionDc` → `persistDcLifecycleChange` (C1) → rebuild Understanding → plan the next question → send exactly one authorized question.

The model only interprets. Authorization (DIR, DDR and role scope, grounding, certainty, write class) is deterministic code. The route returns raw model text only, and the API key never leaves the server.

## What changed (implementation commit `a2be6096`)

### Source authority
- `answer-source-record.ts` (new): one immutable raw answer record per turn. Every DC statement written from a turn is that raw answer, not model text.
- The interpretation audit is stored write-once on the record:
  - classification
  - writes
  - per-item locators
  - structured rejections
  - unresolved items

  An item that cannot be proven produces no write, no version bump and no charge. It only gets a structured rejection.

### Fail closed
- On a model or transport failure (timeout, abort, 4xx/5xx, invalid JSON or schema):
  - nothing is written, the version is not bumped and nothing is charged;
  - `last_sent_question` stays unchanged;
  - the user sees a recoverable message.
- Each turn makes exactly one model call. There is no second LLM judge.

### Answer classes
- **correction:** may bind only to a role the user answered earlier, under that turn's own authorized question. The new fact links to the corrected fact (before/after kept) and no Conflict is opened.
- **Prior-turn role codes:** other answer classes cannot use them, so there is no role widening.
- **contradiction:** opens a Conflict.
- **unknown / declined:** recorded and never a fact. The budget is refunded and the DIR is not re-asked.
- **estimate:** stays `user_estimate`.
- **unclear:** never becomes `user_asserted`.
- **off_topic / invalid input:** nothing is written and the same question is shown again without a new charge.
- **Pending certainty option "3 目前无法确定":** treated as a real answer. It produces an unknown record or an auditable close. Free-form hedges still get bounded retries.
- **Estimated constraint:** if the user says "still an estimate" twice, it resolves as a `user_estimate` reality fact, never a Constraint, and is not re-asked forever.

### Goal change (`goal-change-blueprint-update.ts`, new)
- The model only extracts a grounded candidate target.
- After the user explicitly confirms:
  1. One formal Blueprint update, vN → vN+1, with history and a change log.
  2. The DC definition is updated.
  3. Understanding is rebuilt on the new Blueprint.
  4. The next question is planned in the new scope.
- Nothing is confirmed automatically.
- Confirming a goal change is not charged to the question budget, because it confirms the user's intent and is not an investigation question.

### Pending and intake control
- Items have stable ids and provenance, and survive reloads.
- They are resolved one at a time and take priority over planning.
- A refusal is terminal.
- insight_mismatch goes through AnswerEvent and C1.
- Unresolved aspects are deduped by text across controls. A control follow-up never adds new aspects, and handled items are kept for audit.

### Dynamic loop, budget and dedupe
- The plan is recomputed every turn from the rebuilt Understanding. Each turn sends one question, bound to a DIR/DDR.
- "Covered" does not mean "known" (`intake-answer-coverage.ts`, new). An estimate-only role on a Freeze-blocking DIR gets exactly one deeper follow-up, because an estimate can never become `known`. A second estimate closes it with no third ask.
- Budget: soft limit 12, hard limit 15, depth 3 per direction. Clarifications are charged. Uncharged:
  - invalid, unknown and declined answers
  - replays
  - failed plans
  - unsent questions
  - goal-change confirmations
- A clarification that would be sent past the hard budget closes its item auditably as `closed_budget_exhausted`. An aspect or insight clarification that would go past the per-DIR depth closes as `closed_depth_exhausted`. Either way, the planner then decides the next step. Answer-resolution clarifications do not deepen a DIR.
- When remaining hard budget ≤ open Freeze-blocking DIRs, only blocking DIRs are planned.
- When no valid question is left, the session goes to readiness and then to 确认 → Freeze. Freeze still requires the unchanged sufficiency rule in `stop-criteria.ts`.

### Other files
- **Transport:** `app/api/poju/answer-interpretation/route.ts` (new).
  - The browser posts the context; server code calls OpenRouter directly.
  - Invalid input returns 400. A missing key or provider failure fails closed with 502/504.
- **Other production files touched:** `types.ts`, `decision-context/types.ts`, `content-hash.ts`, `apply-answer-to-dc.ts`, `pending-answer-resolution.ts`, `pending-intake-control.ts`, `scope-budget.ts`, `understanding-state.ts`, `blueprint.ts`, `confirm-and-freeze.ts`, `adaptive-turn.ts`, `agent.ts`.

## Regression results on implementation HEAD `a2be6096`

The commands ran on the committed tree. The only uncommitted changes were unrelated: `public/sw.js`, `.cursor/plans/*` and `temp/*`.

| Command | Result |
|---|---|
| `pnpm test:m1-production-adaptive-question-loop` | PASS=187 FAIL=0 |
| `pnpm test:m2-4-r2-production-closure` | PASS=20 FAIL=0 |
| `pnpm test:m1-r-fresh-session-main-loop` | PASS=8 FAIL=0 |
| `pnpm test:m2-3-decision-blueprint` | 18 passed, 0 failed |
| `pnpm test:m2-1-readiness-confirm-freeze` | 19 passed, 0 failed |
| `pnpm test:m2-2-freeze-report-binding` | 43 passed, 0 failed |
| `pnpm test:decision-context-phase2` | 9 passed |
| `pnpm exec next typegen` | exit 0 |
| `pnpm exec tsc --noEmit` | exit 0 |
| `pnpm build` | exit 0. Warnings are pre-existing and unrelated: the `middleware` → `proxy` deprecation and a `lib/ziwei/fact-pack.ts` named-export warning. |

### These suites are hook-based, not real-model validation

All seven suites above inject model output through `scripts/fixtures/test-answer-interpretation-hook.ts`, or a per-test hook. They verify orchestration, authorization, persistence, budget and Freeze binding only. **None of them is real-model evidence.** The real-model evidence is in the next section.

- `test:m2-4-r2-production-closure` adds R2C-01..R2C-19 plus R2C-09b. These cover:
  - raw records and locators;
  - fail closed;
  - a single model call;
  - correction scope and no role widening;
  - unknown and off_topic;
  - replay;
  - multi-item pending and "3 目前无法确定";
  - goal change → Blueprint;
  - browser transport and route validation;
  - aspect dedupe;
  - budget and depth closure;
  - scarcity planning;
  - one estimate follow-up and a second-estimate stop;
  - estimated constraints;
  - a full loop → readiness → 确认 → Freeze → bound job.

## Real OpenRouter evidence

Model: `deepseek/deepseek-v4-pro-0813`, provider Sail Research. Calls went through the real route handler.

- The only stub is the legacy `/api/poju/chat` phase chat. These scripts have no Next server, and on intake turns that reply is replaced by the authorized plan question.
- No request headers, keys or env values were recorded.
- User texts are synthetic.

### Smoke — `pnpm smoke:m2-4-r2-openrouter`
- Redacted extract: `R2-FINAL-real-openrouter-smoke.redacted.json`.
- Run 2026-11-11T14:33:55Z, before the implementation commit, on the working tree that became `a2be6096` minus the later fixes listed below.
- **55 of 60 expectations met across 12 cases.**

| Case | What | Met |
|---|---|---|
| C01 | plain fact: one route call, DC +1, raw statement, next question | 4/4 |
| C02 | negation stored verbatim | 3/3 |
| C03 | conditions and time limit kept | 2/2 |
| C04 | multiple facts, one locator each | 3/3 |
| C05 | uncertain answer → pending → estimate → aspect follow-up | **5/10** |
| C06 | correction keeps before/after, no Conflict | 4/4 |
| C07 | goal change → confirm → Blueprint v+1, rebuilt, next question in new scope | 11/11 |
| C08 | insight mismatch captured, follow-up via AnswerEvent + C1 | 4/4 |
| C09a | prompt-injection answer: no write, question unchanged | 3/3 |
| C09b | real non-JSON model text rejected by the production parser; fail closed | 5/5 |
| C10a | abort during a real call: fail closed, then one retry succeeds | 6/6 |
| C10b | provider rejects the credential (deliberately invalid key, real 401): single attempt, fail closed | 5/5 |

- **C09b caveat:** the parser probe is real, but the orchestrator turn replays that real text through a test hook. It is not a real-model validation of the orchestrator.
- **C05 misses:**
  - the pending queue did not fully drain;
  - the estimate choice was not stored as `user_estimate`;
  - the aspect follow-up was not committed;
  - the loop did not resume.

  The code was fixed afterwards: "3 目前无法确定" became an answer, the estimated-constraint resolution was added, aspect dedupe was added, and estimated constraints now bind as `user_estimate` facts. Hook tests R2C-09/09b/14/19 cover this. **It was not re-verified with the real model**; see the blockers below.

### Real E2E — `pnpm e2e:m2-4-r2-real`
- Redacted extract: `R2-FINAL-real-e2e-runs.redacted.json`. It holds all six runs, plus the full compact transcript of the run that froze.
- Phase 5 page generation is **not run** and not faked. The report job is only bound to the freeze.

| Run (ran_at) | Real calls (HTTP 200) | Outcome | Code change it motivated |
|---|---|---|---|
| 1794407923212 | 26 (25) | asked=41: clarifications were not charged, and RISK-TOLERANCE depth reached 30. No readiness. | Clarifications charged; budget/depth closure |
| 1794408418666 | 14 (13) | Readiness at hard cap 15. 确认 was refused correctly by sufficiency because critical DIRs held only estimates. Depth 4 seen. | Depth block for control clarifications; answer-resolution does not deepen |
| **1794408651641** | 17 (15) | **Full chain:** goal change → Blueprint v2 with history → readiness (`hard_budget_exhausted`, asked=15) → 确认 → `【已冻结】` → DC final v16→v17 → content hash recomputes → immutable final snapshot → authoritative freeze verifies → report job bound (id/version/hash match, persisted). Two OpenRouter 429 admission errors failed closed and were recovered. | — |
| 1794408748776 | 14 (14) | 确认 refused: an estimate on Freeze-blocking DIR-DEF-STAKES. Freeze correctly withheld. | One estimate follow-up on blocking DIRs; scarcity planning; persona follow-ups |
| 1794408986904 | 12 (11) | Stall: the estimated constraint was re-asked forever. | Bounded estimated-constraint resolution |
| 1794409118039 | 17 (12) | Turns 16–19 got OpenRouter **402** (credits exhausted). Each failed closed with no write and no charge. No Freeze. | — (external) |

The freeze run (1794408651641) used intermediate code. The fixes for the next three runs landed afterwards and are in `a2be6096`. Those fixes are covered only by the hook suites, not by a real run on `a2be6096`.

## Residual blockers and risks

1. **The real-model rerun on the final HEAD is blocked.** The OpenRouter account is out of credits: on 2026-11-11, `/api/v1/credits` reported `total_credits` 60 and `total_usage` 60.16 (the key was not printed). Every call returns 402 `in_flight_budget_exhausted`. So neither the smoke nor the E2E has run on `a2be6096`, and C05's fix is not real-model verified. After a top-up, rerun `pnpm smoke:m2-4-r2-openrouter` and `pnpm e2e:m2-4-r2-real` on this HEAD.
2. **Critical estimates still block Freeze by design.** The `stop-criteria.ts` sufficiency rule is unchanged: an estimate can never become `known`. If the one follow-up also gets an estimate, 确认 is refused and the user is asked for more. At the hard cap with a critical DIR never asked, the session cannot freeze. The scarcity rule makes this unlikely but does not prove it impossible.
3. **Supply-side failures (429 admission, 402 credits, 5xx) fail closed correctly, but the turn makes no progress until the user resends.** The answer-interpretation path adds no provider escape of its own.
4. **Merging estimates is conservative.** An answer mixing explicit and estimated parts for the same role is stored as one `user_estimate` fact.
5. **Legacy `/api/poju/chat` is stubbed in the real scripts.** On intake turns its reply is replaced by the authorized plan question, so it does not affect the measured chain.
