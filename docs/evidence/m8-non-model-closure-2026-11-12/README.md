# M8 Non-Model Completion Evidence

## Repository state

- Branch: `feat/m1-r-fresh-session-main-loop`
- Baseline HEAD (local and remote at start): `a93c71bb8d8f22559b2e75df7a643b0d2c16d7bd`
- Implementation HEAD: `fc4a71466aab93507c4b8ee6717f82f8c7f2f9f7`
- Implementation and evidence are separate commits. This file records the implementation HEAD; the evidence commit is its direct child.
- The pre-existing `public/sw.js` modification was preserved and excluded from both commits.

## Requirement → production code → deterministic evidence

| Requirement | Production changes | Test evidence | Result |
|---|---|---|---|
| LAB confirm matches production Readiness, Agent phase, and accepted text | `confirm-and-freeze.ts`, DI2 LAB page, `agent.ts` | Focused helper contract; M2.1 19/19; M6 full lifecycle 7/7 | Passed |
| Personal Pattern Insight only uses a current, completed, chart-anchored PA artifact | `understanding-state.ts`, DI2 types | Focused cases: absent, pending, failed, wrong Freeze, wrong hash/version, invalid refs, empty pattern, valid binding | Passed |
| Understanding UI uses Session/DC/Blueprint SoT and avoids duplicate Agenda progress | UI projection, `DecisionUnderstandingPanel.tsx`, `POJUChatUI.tsx`; LAB snapshot includes same projection | Focused state projection; M1 188/188 | Passed |
| Reject invalid, injected system, expired, and post-Freeze intake without DC mutation | `agent.ts`, message metadata | Focused production-entry tests; POJU rule suite 10/10 plus duplicate-message case; CAS 17/17; M1/M6 lifecycle regressions | Passed for covered cases |
| Report conclusions and material sources have bidirectional coverage; reject fabricated or mismatched evidence | `decision-report-pages.ts`, runner, report result type; M3/M6 deterministic page hooks cite actual fixture sources | Focused adversarial matrix cases; M3 27/27; M6 7/7 | Passed for deterministic fixtures |
| Eight-page delivered HTML retains expected page/TOC structure | Existing deliverable validator; M6 fixture path | Deliverable structure 4/4; pages and TOC: cover, 01, 02, 04, 05, 06, 07, 08, 03 | Passed |

The report coverage matrix is attached to the durable report result before completion is committed. It records source ID/type/status, related direction, expected/actual sections, evidence reference, coverage outcome, and missing/applicability reason. Page Job/generation/Freeze/context/analysis binding is checked before the report commit.

## Commands and exit codes

| Command | Exit | Result |
|---|---:|---|
| `pnpm test:m1-production-adaptive-question-loop` | 0 | PASS=188, FAIL=0 |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | 19 passed, 0 failed |
| `pnpm test:m3-decision-report` | 0 | 27 passed, 0 failed |
| `pnpm test:m6-di2-full-lifecycle` | 0 | 7 passed, 0 failed |
| `pnpm test:m8-di2-non-model-closure` | 0 | Focused M8 contract, insight, projection, evidence, and input tests passed |
| `pnpm test:poju-rules` | 0 | 10/10 rules plus duplicate-message detection |
| `pnpm test:session-cas-s1` | 0 | 17 passed |
| `pnpm test:deliverable-skeleton` | 0 | 4 passed; canonical eight-page panes and TOC verified |
| `pnpm exec tsc --noEmit --pretty false` | 0 | No diagnostics |
| `pnpm build` | 0 | Production build and Next TypeScript phase succeeded |

The build emitted existing webpack dependency-analysis warnings for a dynamic import in `next-intl`, plus the existing service-worker precache-size warning for a 3.35 MB WASM asset. The build output reported successful compilation and routes. Before and after SHA-256 checks confirmed that `public/sw.js` and the generated landing CSS were restored byte-for-byte; the runtime asset directory was also backed up/restored.

Raw, unmodified test/build logs are in this directory. They were scanned for common token/bearer patterns before copying; no matches were found. The TypeScript command produced an empty stdout log with exit code 0.

## Runtime and infrastructure boundary

- M1/M2/M3/M6 automated runs are deterministic local tests. Their KV logs show the in-memory fallback; this does not prove Upstash behavior.
- M3/M6 replace Personal Analysis and page model calls with validated deterministic test hooks. They do not prove real model quality.
- No OpenRouter call, real report generation, real payment/pass consumption, browser E2E, deployment, or hosted infrastructure write was performed.
- The current shell had no Upstash, Supabase, Inngest, or QStash environment values. `.env.local` contains relevant key names, but there is no explicit staging marker or isolated DI2 test namespace. Credential values were not read or printed, and no external connectivity/write was attempted.
- Upstash atomic operations/expiry, Supabase schemas/RPC/refusal, queue callback auth/retry, multi-instance fencing, and hosted Freeze/Profile persistence remain **unverified**.

## Not established by this evidence

- Full rendered LAB/browser interaction, concurrent-tab behavior, every malformed attachment/payload case, and the complete pause/resume/expiry matrix were not exhaustively exercised.
- Real Personal Analysis and eight-page model output remain for the product owner’s manual LAB acceptance.
- Safe staging infrastructure was not identified, so M8-F hosted verification remains unverified.
- This evidence does not declare M8 or DI2 overall accepted.
