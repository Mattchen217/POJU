# M7 DI2 Production Main Path and LAB Readiness Evidence

## Execution baseline

- Repository: `Mattchen217/POJU`
- Branch: `feat/m1-r-fresh-session-main-loop`
- Starting feature HEAD: `851132d736e80c534a6f74a7e2154435ed399bc7`
- Starting `origin/main`: `ee8c96e8a7a128fa8e059c2a9f81c9f0d2127688`
- Implementation commit: `cf686f94` (`feat(lab): add DI2 lifecycle acceptance surface`)
- Fresh fetch at task start: feature was up to date; `main...feature` was `0 159` (0 behind, 159 ahead).
- Scope reviewed: all 159 commits from `origin/main..origin/feat/m1-r-fresh-session-main-loop`, 364 changed files, approximately 87,728 insertions and 430 deletions.

## M7-A: production path and change risk review

### Main production call path

1. A POJU Session is created by `createPOJUSession` in `lib/poju/session-manager.ts`; the normal product route begins after payment success and profile preparation.
2. The customer chat UI and M1 pre-LLM turn call `handleUserMessage` in `lib/poju/agent.ts`.
3. M1 Fresh Session Bootstrap initializes Decision Context and the decision Blueprint. The adaptive loop interprets the answer through the answer-interpretation endpoint, persists the DC through the C1 Session writer, rebuilds Understanding and Readiness, then only displays the question from the authorized Adaptive Question Plan.
4. Explicit final confirmation inside `handleUserMessage` invokes `confirmUnderstandingAndFreeze`; `ensureSessionFrozenForDelivery` and the decision-authority endpoint provide server authority, Freeze receipt, ledger binding and Profile receipt.
5. `runDecisionReportForSession` in `lib/poju/decision-intake/decision-report-client.ts` starts or resumes the M5 report job through `/api/poju/decision-report`. The server verifies the Freeze/Profile bindings, runs Personal Analysis and the eight-page runner, commits the durable report, then returns status through M5 delivery authorization.
6. The client mirrors returned checkpoints and report records into the encrypted Session in IndexedDB. Refresh recovery uses the stored pending Job ID and does not need a second charge or generation for a completed job.

### Implemented areas in the 159-commit range

- Intake R6 and S7–S9 production N/A authority, canonical resolver/catalog binding, Freeze validation, Session/DC versioning, and fail-closed persistence.
- M1 adaptive question planning and Fresh Session bootstrap; M2.1 confirm/freeze; M2.2 freeze-bound report jobs and execution fencing; M2.3 decision-specific Blueprint; M2.4 answer interpretation and conservative clarification handling.
- M3 Personal Analysis and eight-page report runner; M4 server authority and receipts; M4.1 Freeze recovery; M5 durable jobs/client recovery; M5-R1 job-bound charge/delivery authorization including refusal abort closure.
- M6 full deterministic Session-to-report lifecycle coverage and review corrections.
- The branch contains extensive test and evidence commits as well as production code; presence of evidence or deterministic hooks does not establish validation against hosted infrastructure or live model quality.

### Risk classification

- **High: authority, billing, and persistence.** DC writes, N/A declarations, Freeze, Profile receipt, pass charge/refusal abort and report delivery span client storage and server authority. These require continued review of failure handling, idempotency, stale execution generations and provider-backed persistence.
- **High: model-backed state transitions.** M1 answer interpretation and report generation use real model interfaces in production. Deterministic hooks verify contracts and state transitions, not model accuracy, latency, refusal behavior or prompt quality.
- **Medium: job orchestration and recovery.** M5 retries, checkpoints, worker scheduling and client resume are covered in-process, but hosting queue and multi-instance behavior need staging verification.
- **Medium: mainline integration / legacy coexistence.** The existing `/ops/delivery-lab` full pipeline calls `handleUserMessage` in a synthetic `lab-chat-*` Session, with `server_invoke` and `skip_delivery_pipeline`, then continues into legacy Segment2/Synthesis. It is not an M6 DI2 end-to-end test surface. The new `/ops/delivery-lab/di2` route is explicitly separate from that legacy path and imports production Session, agent, Freeze and report client functions.
- **Low to medium: operator page.** The new page is an Ops-authenticated UI over existing production client functions. It does not add or alter authority endpoints, synthesize final DC/receipt/report state, or auto-start a model/report run on load.

### LAB limitations and behavior

- The new route is `/ops/delivery-lab/di2`, linked from `/ops/delivery-lab`.
- It creates a new local Session through `createPOJUSession`, requires a selected stored profile, exposes the real question/answer loop through `handleUserMessage`, reveals the current plan, AnswerEvent, DC, Blueprint and Readiness state, and exposes explicit confirmation only when the production Readiness state allows it.
- It shows returned Freeze/Profile receipts, Personal Analysis records, report Job identity/status, and page content/status. It supports reopening a Session from the same browser's IndexedDB using the Session ID or query string. Report resume is a user action; page load itself performs no model request, charge, report generation or worker dispatch.
- A new Ops Session is tagged with an `ops-lab:` local payment reference. This is an isolated QA Session marker, not evidence of customer payment. The LAB does not mark it unlocked, fabricate an authorized pass, or bypass the production M5 charge/delivery endpoint. If the account has no eligible pass, the normal endpoint may return `pass_required`.
- The normal user payment-success and POJU routes remain the actual customer entry. Manual evaluation of billing/pass entitlement must use the real staging payment/test configuration.
- There is no UI control to inject deterministic model output. Product-owner clicks enter the actual production model interfaces. No click was made during this task.

## Deterministic verification performed

Environment: Windows PowerShell, local Node 22 / pnpm workspace. Tests use in-process adapters, local IndexedDB fakes and MemoryKv where their scripts configure them. These are not Upstash, Supabase, Inngest/QStash, serverless, real billing, or live-model tests.

- `pnpm test:m6-di2-full-lifecycle` — exit 0; `M6 result: 7 passed, 0 failed`. Output explicitly logged Fresh Session, multi-turn adaptive Q&A, Readiness, user confirmation, Freeze/Profile binding, Personal Analysis, eight-page report completion and same-Job refresh recovery. This suite uses deterministic hooks; it is not real OpenRouter evidence.
- `pnpm test:m1-production-adaptive-question-loop` — exit 0; `PASS=188 FAIL=0`. Covers the production M1 adaptive loop with deterministic interpretation hooks, including fact-state and clarification cases; it is not a live model run.
- `pnpm test:m1-r-fresh-session-main-loop` — exit 0.
- `pnpm test:m2-1-readiness-confirm-freeze` — exit 0.
- `pnpm test:m2-2-freeze-report-binding` — exit 0.
- `pnpm test:m2-3-decision-blueprint` — exit 0.
- `pnpm test:m3-decision-report` — exit 0.
- `pnpm test:m4-decision-authority` — exit 0.
- `pnpm test:m4-1-freeze-recovery` — exit 0.
- `pnpm test:m5-di2-main-path` — exit 0.
- `pnpm test:m5-r1-authorization` — exit 0.
- `pnpm test:intake-r6-production-agg` — exit 0.
- `pnpm test:intake-r6-freeze-authority-regression` — exit 0.
- `pnpm test:intake-r6-freeze-versioning` — exit 0.
- `pnpm test:intake-r6-freeze-persist-disclose` — exit 0.
- `pnpm test:intake-r6-s9-production-authority-sources` — exit 0.
- `pnpm exec tsc --noEmit` — exit 0.
- `pnpm build` — production build completed and emitted route `/ops/delivery-lab/di2` as a static page. Build printed existing warnings: deprecated `middleware` convention; named `version` import from `iztro` default-exporting module; stale `caniuse-lite`; and the 3.35 MB Hana wasm asset exceeding Serwist's precache size. The first build attempt failed because `useSearchParams()` lacked the Next 16 Suspense boundary; the route was changed to read `window.location.search` after mount, and the subsequent build completed.

## Not verified in this task

- No real OpenRouter request, Personal Analysis model request, page-generation model request, live-model quality evaluation, or LAB/browser E2E was run.
- No real Supabase charge, no charge RPC test-mode result, and no real Upstash Redis, Inngest/QStash, serverless or multi-instance validation was run. This environment's local M6 run reported missing Upstash variables and used MemoryKv.
- Build and TypeScript checks do not establish hosted runtime behavior. The product owner must open the LAB in the intended staging origin, sign in to Ops, select a profile, create a fresh QA Session, and manually perform the model-backed lifecycle; the report action follows production pass requirements.
- Branch review did not re-run the entire historical 159-commit test matrix or re-review every line of all 364 changed files independently. Scope classification used the complete commit list, aggregate diff stats, runtime call paths and subsystem/evidence clusters.

## Workspace preservation

At task start, `public/sw.js` was already modified and the worktree contained numerous untracked user artifacts. They were not staged intentionally. `pnpm build` regenerated `public/sw.js`; it remains excluded from this task's implementation commit. No unrelated untracked files are included.

## Review status

This is an evidence record for independent review, not a claim that M7 or DI2 has passed overall acceptance.
