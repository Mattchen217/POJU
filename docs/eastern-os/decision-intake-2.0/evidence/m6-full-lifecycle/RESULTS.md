# M6 — DI2 Full Lifecycle Integration Evidence

**Repository:** `Mattchen217/POJU`  
**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Implementation base:** `f36a3f06a8059b7cb8895e54bd799e156a16136a`  
**Implementation commit:** `5c193959`  
**Environment:** Windows / PowerShell, Node.js 22.22.0, pnpm, Next.js 16.2.4.  
**Evidence status:** execution record for independent review; this document does not declare M6 or DI2 passed.

## Scope and implementation

Added `scripts/test-m6-di2-full-lifecycle.ts` and `pnpm test:m6-di2-full-lifecycle`. The integration test enters through `createPOJUSession` and `handleUserMessage`, uses deterministic answer and report model hooks, the production adaptive question loop, confirmation/Freeze entry and authority wire, M3 report runner, M5 report API/client, fake IndexedDB, in-process transports, MemoryKv, and a controllable background queue.

The lifecycle test also exposed a production profile loading gap: a selected stored profile was dropped when it had no `base_analysis`, even though its birth profile was present. `loadSessionProfileBundle` now preserves the profile and returns a nullable `base_analysis`. This lets the report path resolve the selected profile without fabricating or requiring a base analysis.

## Full lifecycle run

Command: `pnpm test:m6-di2-full-lifecycle` on implementation commit `5c193959`  
Result: **7 checks passed, 0 failed**.

The same new Session was used for the main lifecycle. It began without a Decision Context. The test verified Fresh Session bootstrap, DC and question Blueprint creation, and that the first displayed question exactly matched the authorized AdaptiveQuestionPlan. It then answered through `handleUserMessage`, verified DC and Understanding updates and changing plan IDs/question text, and reached `awaiting_confirmation` only after readiness stopped asking questions.

The user confirmation was submitted through `handleUserMessage`. Confirmation events were produced, DIR was reaggregated, sufficiency was evaluated, and the production authority wire returned a Freeze receipt. The report path validated the frozen context and selected profile, generated Personal Analysis plus all eight pages, and checked report integrity and binding to one job, generation, Freeze, context hash, and analysis ID. The evidence also checked epistemic/evidence references and that Personal Analysis was not written into RealityFacts.

Recovery checks interrupted the client while the job was pending, drained the same queued worker job, and resumed it without another charge or repeat analysis/page generation. A forced IndexedDB final Session write failure did not mark the report delivered; a subsequent retry delivered it. Refresh/status recovered the completed report, and an already delivered Session did not auto-start another report.

Additional checks in the script cover distinct decision topics producing different Blueprint directions and DC persistence failure failing closed. They are auxiliary sessions; the full report lifecycle remains on the one main Session.

## Authorization and recovery observations

- Ledger stub charge calls: 1 for the report job across client interruption, worker completion, failed local commit, and successful retry.
- Personal Analysis hook calls: 1.
- Page model calls: no page was generated twice; eight complete page records were persisted.
- Delivery authorization: verified for the completed job before report status delivery.
- Client local persistence: failed write left the Session undelivered and retained a retryable job; successful retry updated delivery state.
- Production Job store: MemoryKv in this test process; this does not validate Upstash durability or cross-serverless-isolate behavior.

## Required regressions

The following suites completed with exit code 0:

- M1-R fresh-session main loop — 8 passed, 0 failed.
- M2.1 readiness/confirm/freeze — 19 passed, 0 failed.
- M2.2 freeze/report binding — 43 passed, 0 failed.
- M2.3 decision blueprint — 18 passed, 0 failed.
- M2.4-R2 production closure — 20 passed, 0 failed.
- M3 decision report — 27 passed, 0 failed.
- M4 decision authority — 27 passed, 0 failed.
- M4.1 freeze recovery — 10 passed, 0 failed.
- M5 DI2 main path — 29 passed, 0 failed.
- M5-R1 authorization — 49 passed, 0 failed.
- M5-R1 FU1 — 5 passed, 0 failed.
- M5-R1 FU2 — 10 passed, 0 failed.
- M5-R1 FU3 — 13 passed, 0 failed.
- M5-R1 FU4 — 8 passed, 0 failed.

The broader `test:m1-production-adaptive-question-loop` suite completed with **186 passed, 1 failed**. The failure was `M2.4-R1-FU2 unknown/declined old fact must not create Conflict`; it stopped at `DcLedgerSyncError: fact fact_ud_unknown: unknown×user_asserted` from `syncDcLedgerBeforeWrite` in `lib/poju/decision-authority/client-sync.ts`. This is retained as an existing regression failure; no assertion was changed to hide it.

## TypeScript and production build

- `pnpm exec tsc --noEmit` — exit code 0.
- `pnpm exec tsc --noEmit -p temp/tsconfig.m6-scripts.json` — exit code 0. The temporary config extends the project config and includes the otherwise excluded M6 script.
- `pnpm build` — exit code 0. Next.js completed type checking, static generation (209 routes), and build tracing.

Build emitted existing warnings: deprecated `middleware` convention, `iztroVersion` named export from a default-exporting module, and a 3.35 MB WASM asset excluded from service-worker precache. During client delivery, the existing HTML skeleton assertion also logged `chrome/structure drift`; the M5 client still completed and delivered eight bound page records. This warning needs independent review before being treated as acceptable for release.

## Validation limits

This run used MemoryKv, a charge ledger stub, deterministic answer interpretation and Personal Analysis/page model hooks, fake IndexedDB, in-process API/authority transport, and an in-process background scheduler. It did **not** validate Upstash Redis persistence, Supabase charging, serverless isolate recovery, real Inngest/QStash scheduling, real OpenRouter/model output, browser E2E, or production deployment. Those remain outside the authorized M6 test boundary.

No PR, merge, rebase, deployment, or force-push was performed. Implementation and evidence are intended as separate commits; independent review remains pending.
