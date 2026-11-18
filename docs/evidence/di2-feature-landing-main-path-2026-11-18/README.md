# DI2 feature landing ? main path evidence (2026-11-18)

This directory records the Decision Intake 2.0 feature-landing work on `feat/m1-r-fresh-session-main-loop`. It is evidence for independent review. It is not a DI2 PASS declaration.

## 1. Baseline HEAD

- Expected baseline: `ee9ef36617779f7c1d8a140d27f80772c6c009e0` (Record M9-R1-FU1-FU2-FU3 Session Record integrity atomic binding evidence)
- Actual remote and local HEAD before edits: `ee9ef36617779f7c1d8a140d27f80772c6c009e0`
- The baseline had not moved.

## 2. Implementation commit

- SHA: `c72b81a7121ef2d18568ea86cfc310a4912c57b0`
- Parent: `ee9ef36617779f7c1d8a140d27f80772c6c009e0`
- Subject: Land DI2 intake protection, Q&A personal insight, and readiness progress

## 3. Evidence commit

Recorded in the commit that adds this directory. This file does not contain a self-referential tip SHA.

## 4. Audit status before changes

Checked on the production code at `ee9ef366`, not from the early m2-mainline-gap-and-order.md list.

- M1-R Fresh Session main loop: IMPLEMENTED_AND_WIRED. fresh-session-bootstrap + authoritative chat turn.
- M2.1 Readiness, confirm, Freeze: IMPLEMENTED_AND_WIRED. Existing confirm/freeze path; not reimplemented.
- M2.2 Freeze-bound report: IMPLEMENTED_AND_WIRED. Existing job/generation binding.
- M2.3 Decision-specific Blueprint: IMPLEMENTED_AND_WIRED. Existing Blueprint engine.
- M2.4 Answer Interpretation + Adaptive Question: IMPLEMENTED_AND_WIRED / PARTIAL. Production turn existed; invalid input still reached the model hook; no lockout state.
- M3 Personal Analysis + eight-page report: IMPLEMENTED_AND_WIRED. Report-side; Q&A Personal Pattern Insight was not the same path.
- M4 Server Authority: IMPLEMENTED_AND_WIRED. Session Authority + CAS.
- M4.1 Freeze Recovery: IMPLEMENTED_AND_WIRED. Existing recovery receipts.
- M5 Report persistence / worker / client recovery: IMPLEMENTED_AND_WIRED. Existing M5 path.
- M6 Full lifecycle: IMPLEMENTED_AND_WIRED. Integration tests exist; live E2E unverified.
- M7 LAB Readiness: IMPLEMENTED_AND_WIRED. Unchanged this round.
- M8 / M8-R1: IMPLEMENTED_AND_WIRED. Deterministic closures; not reworked.
- M9 / M9-R1 FU1-FU3: IMPLEMENTED_AND_WIRED / UNVERIFIED. Code-reviewed binding; real Redis/Lua not executed.
- P0-A Input protection / lockout: NOT_WIRED. Fields and paid disclosure missing; short answers could be treated as invalid; invalid path could still call the model.
- P0-B Unified Understanding as pre-question mechanism: IMPLEMENTED_AND_WIRED / PARTIAL. Adaptive turn already rebuilt Understanding; UI projection existed; progress percent was not from DDR/DIR/Gate.
- P0-C Personal Pattern Insight in Q&A: PARTIAL / NOT_WIRED. evaluatePersonalPatternInsight was freeze-bound report analysis.
- P0-D Confirm + Freeze chain: IMPLEMENTED_AND_WIRED / UNVERIFIED. Reused; real Redis/Lua still unverified.
- P0-E Report delivery main path: IMPLEMENTED_AND_WIRED / UNVERIFIED. Reused; no live eight-page model run.
- P1 UI / traceability: PARTIAL. Panel and in-input quick replies existed; no browser interaction acceptance.
- Paid-start lockout disclosure: NOT_WIRED. question_briefing_dismissed existed; abuse/PASS policy text was missing.

## 5. Confirmed gaps and production call chain after the change

### P0-A Intake protection and session lockout

- Original gap: no invalid_streak / lockout_* / intake session_expires_at on the Session snapshot; too_thin could be invalid_input; invalid answers on the server could still reach expensive interpretation.
- After: lib/poju/decision-intake/intake-protection.ts classifies and applies lockout on the existing Session snapshot (POJUSessionState.intake_protection).
- lib/poju/decision-intake/adaptive-turn.ts applies protection after the empty-input check and before interpretAnswerWithModel.
- lib/poju/decision-intake/answer-interpretation.ts no longer treats short relevant answers as invalid; unknown / declined / skip / uncertainty are not abuse.
- Persistence: existing Session Authority snapshot + CAS (executeAuthoritativeChatTurn to handleUserMessage with server_invoke). No second Session database. No Lua redesign.
- Client: components/poju/POJUChatUI.tsx shows the lockout banner and Continue (__INTAKE_CONTINUE__). The client still POSTs /api/poju/chat; only server_invoke skips the expensive LLM. Cooldown end is server-authoritative.
- Paywall disclosure: lib/passes/pivot-paywall-copy.ts and components/poju/PojuPaywallInline.tsx (intakeAbuseDisclosure) before paid Q&A.
- Idempotency is by turn id; concurrent invalid uses the latest inspected state; the same turn is not double-counted.

### P0-B Unified Decision Understanding progress

- Original gap: Understanding was already the pre-question derived view, but progress was not computed from DDR / P0-P1 DIR / constraints / conflicts / Sufficiency Gate.
- After: computeReadinessProgress() in lib/poju/decision-intake/understanding-state.ts; ui-projection.ts and DecisionUnderstandingPanel.tsx read that percent. 100% is capped at 99 until the completion conditions are met. unknown / declined / unverified do not count as confirmed.
- Understanding remains a derived view of formal DC, Blueprint, DDR, DIR, and the bound Personal Analysis Profile. No second fact store.

### P0-C Q&A Personal Pattern Insight

- Original gap: report-side PPI required Freeze + profile receipt + completed personal analysis, so it was unavailable during Q&A.
- After: lib/poju/decision-intake/personal-analysis-profile.ts binds the profile once at Fresh Session bootstrap and at Adaptive turn start from matrix_payload. BaZi is not recomputed each turn. ZiWei is computed at most once at bind if birth data is present. Insights are traditional_interpretation / unverified hypotheses, never RealityFacts. Missing profile stays unavailable and does not fabricate results. Repeat fingerprint yields no new insight. Visible terms go through the existing POJU term pipeline.
- understanding-state.ts prefers the Q&A-available profile, then freeze-bound analysis, then none.

### P0-D / P0-E

- Not reimplemented. Existing M2.1 / M4 / M9 confirm-freeze and M2.2 / M3 / M5 report paths were regression-tested. Real Redis/Lua and live eight-page model generation remain unverified.

## 6. Status of brief items after this landing

Only the required labels are used.

- P0-A Input protection and lockout (code + non-mocked tests): IMPLEMENTED_BUT_UNVERIFIED
- P0-B Unified Understanding state and DDR/DIR/Gate progress: IMPLEMENTED_BUT_UNVERIFIED
- P0-C Personal Pattern Insight in the Q&A phase: IMPLEMENTED_BUT_UNVERIFIED
- P0-D Final understanding confirmation and Freeze (reused, not rewritten): IMPLEMENTED_BUT_UNVERIFIED
- P0-E Eight-page report delivery main path (reused, not rewritten): IMPLEMENTED_BUT_UNVERIFIED
- P1 UI / traceability against the architecture: PARTIAL
- Real OpenRouter full main-path model run: PARTIAL
- Real browser E2E against a deployed environment: NOT_IMPLEMENTED
- Real Redis Lua EVAL / production queue: NOT_IMPLEMENTED

IMPLEMENTED_BUT_UNVERIFIED means production code is landed and covered by non-mocked integration tests, but a real deployed browser run, real Redis Lua, or a complete live model main path was not demonstrated.

PARTIAL for OpenRouter: a real Answer Interpretation smoke ran against OpenRouter; later cases hit HTTP 402; Initial Understanding, Blueprint init, Adaptive Question, Personal Analysis, and eight-page generation were not run as live model jobs in this delivery.

PARTIAL for P1: the Decision Understanding Panel, in-input quick replies, and DDR/DIR/Gate progress are in the production UI path, but no real-browser interaction acceptance was performed.

NOT_IMPLEMENTED for real browser E2E and real Redis Lua means those verification activities were not executed, not that the underlying product code is absent.

## 7. Tests

See command-exit-codes.json and the numbered log files in this directory.

New suite pnpm test:di2-feature-landing-main-path: 22 passed (A classify/lockout/turn hooks, B progress, C PPI available and missing profile, D confirm eligibility unchanged).

## 8. Real OpenRouter

- Command: pnpm smoke:m2-4-r2-openrouter
- Process exit: 0
- Expectations met: 43 / 55
- Transport: handleUserMessage to interpretAnswerWithModel to POST /api/poju/answer-interpretation (real route handler) to OpenRouter
- Model: deepseek/deepseek-v4-pro-0813
- Provider on successful calls: Sail Research
- Successful cases C01-C06 (and C09a guard, C09b invalid JSON fail-closed, C10b 401 fail-closed) used the production interpretation route.
- C07, C08, and the C10a retry failed with OpenRouter HTTP 402 in_flight_budget_exhausted. Those are not successes and were not retried in this delivery.
- Recorded successful-call usage in the redacted summary: prompt_tokens 10430, completion_tokens 1914, cost 0.01157778 (OpenRouter-reported; no keys recorded).
- /api/poju/chat was stubbed in the smoke process. This is not a Next-server or browser run.
- C09b notes that the orchestrator replay after the real probe uses a test hook.
- Not run as live model jobs: Initial Decision Understanding, Blueprint initialization, Adaptive Question generation, Personal Analysis, and eight-page report generation.
- No secrets were written into this evidence directory.

## 9. Real browser E2E

UNVERIFIED / NOT_IMPLEMENTED as a verification activity.

No Vercel Preview or other already-available deployed environment was used. This delivery did not deploy. pnpm e2e:m2-4-r2-real is a Node script with fake-indexeddb and real OpenRouter; it is not a browser interaction acceptance against a deployment, it does not generate Phase 5 pages, and it was not run (OpenRouter already returned 402 mid-smoke).

## 10. Redis / Queue / Persistence

- M9 FU1-FU3 logs still record REAL_REDIS_LUA_EXECUTED=no.
- The OpenRouter smoke printed that UPSTASH/KV env was missing in that process and used in-memory KV. The presence of KV REST names in the local env file is not production Redis/Lua evidence.
- MemoryKv, in-memory KV, and Session Authority unit harnesses are not claimed as production Redis or production Lua passes.
- Inngest/QStash, browser IndexedDB, and worker recovery were not re-run as a live infra acceptance in this delivery. Existing M5/M6 tests exercise those paths with test stores.
- No credentials were added. No Redis/Upstash plugin was installed as a substitute.

## 11. Mock, fixture, MemoryKv, and test-hook boundaries

- New lockout / progress / PPI tests in scripts/test-di2-feature-landing-main-path.ts drive production functions with constructed Session/DC state. They do not call OpenRouter, Redis, or a browser.
- Existing M1-M9 suites keep their established fixtures and MemoryKv/harness paths. Those suites are regression evidence, not live infra evidence.
- smoke:m2-4-r2-openrouter uses real OpenRouter for Answer Interpretation, stubs /api/poju/chat, uses in-memory KV, and uses a test hook only for the C09b orchestrator replay (explicitly labeled in the report).
- DIR known, DDR satisfied, Readiness PASS, and Freeze success were not forged to pass new tests. Case D only asserts that existing confirm eligibility is unchanged.

## 12. Remaining real problems

- Real Redis/Lua EVAL has still not been executed.
- Real OpenRouter coverage stopped short of the full product main path; mid-suite calls hit in-flight credit limits.
- No deployed browser E2E was run, including refresh recovery, reopen-session report recovery, and in-input quick replies in a real UI.
- Session TTL remains the existing 30-day Session expiry; intake retention is a separate 24-hour session_expires_at on intake_protection.
- Lockout state is on the Session snapshot committed through existing CAS. That is the intended authority path, but it has not been proven on a real Redis server.
- P1 visual/interaction acceptance is still outstanding.
- This delivery does not declare FU3, M9, M9-R1, or DI2 accepted.

## 13. public/sw.js SHA-256

- Required pre-build / restored bytes: 38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980
- After the evidence-pass pnpm build: 377530ca9931d2d0c30da03775ff993e063559e36900a2b380c27bdef4934c5c
- After restore, unrestaged: 38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980
- The file was not staged or committed.

## 14. Git hygiene

- Branch: feat/m1-r-fresh-session-main-loop only
- main was not modified
- No PR was opened
- No merge
- No deploy
- No rebase
- No force-push
- DI2 is not self-declared PASS
