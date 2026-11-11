# M3 — Phase 5 Personal Analysis + Freeze-bound eight-page report (production wiring)

This is an evidence record for the production change on `feat/m1-r-fresh-session-main-loop`. It does not declare the product PASS.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Parent of the implementation (M2.4-R2 final evidence tip): `b59959ada7af6d81eac0ee59ffe358c07f740f08`
- Implementation SHA (all checks below ran on this commit): `dce6fd19fa275b175737920601b222dd68f45774`
- Evidence tip SHA: _(this commit; left for independent review)_
- No PR opened. Not merged into `main`, not rebased. Nothing deployed or promoted. No force-push.

**What this evidence is not.** No real OpenRouter call, no real model output, and no end-to-end run was executed for M3 (paused by instruction). Every model-dependent result below comes from test hooks (`__setPersonalAnalysisModelForTests`, `__setDecisionReportPageModelForTests`) returning fixture JSON. They prove control flow, persistence, binding and validation. They do **not** prove model output quality.

## Production call chain (Decision Intake 2.0)

Client (Freeze already done by the M2 chain):

`POJUChatUI` auto-start effect (`di2ReportNeedsAutoStart`: DI2 session, final DC, no pending job, no DI2 row for this Freeze) → `runDi2Report("start")` → `runDecisionReportForSession` → loads the local profile bundle (`PROFILE_REQUIRED` if missing) → `POST /api/poju/decision-report {action:"start", decision_context, blueprint, profile_id, base_analysis, birth_info}` → poll `{action:"status"}` every 4 s → mirror analysis + page progress into the session (`persist` → `savePOJUSession`) → on `completed`: `verifyCompletedReport` (binding + all 8 pages + `assertCompleteEightPageReport`) → row `completed` → `applyFinalDeliveryResultToSession` → clear `pending_decision_report_job_id`.

Server:

`app/api/poju/decision-report/route.ts` → `startDecisionReportJob`
1. `registerFrozenDecisionContext` — refuses drafts, hash mismatch, and a different DC under the same `freeze_id` (write-once).
2. `tryStructuredFromBaseAnalysis` — real computed chart; `null` → 422 `PROFILE_STRUCTURE_UNAVAILABLE` (no faked chart).
3. Ziwei closed set from birth info, `registerProfile` (profile hash).
4. Reuse / supersede / new job: same identity and not regenerate → reuse; regenerate → `supersedeFinalDeliveryJobForRegenerate` + new execution generation + new job id.
5. `createXhighJob(phase:"decision_report")` → fence authorize.

Route then charges the pass (first generation only; regenerate of an existing report is not charged again) and schedules `finalize` (Inngest publish → fallback `after()`).

Runner (`decision-report-runner.ts`, one stage per invoke, lease + fence + heartbeat):

- `finalize` = Personal Analysis: load registered Freeze + profile → reuse completed analysis by idempotency key, else one model call (`runPersonalAnalysisModel` → `callLLM`) → `validatePersonalAnalysisOutput` → fenced save → next stage.
- `segments` = pages, one model wave per invoke: `["02","04","05","07"]` → `["01","06"]` → `["08"]` → `["03"]`. Each page: `formatPageDcFeed` (frozen DC slice per page) + analysis + upstream pages → `runDecisionReportPageModel` → `validateDecisionReportPage` → write-once page record. 07 not applicable → deterministic note; 03 → deterministic appendix from the chart lines the completed pages cited.
- `assemble` = integrity check of all 8 records (completed, same job / generation / freeze / context hash / schema / analysis id, non-empty) → `assertCompleteEightPageReport` → `renderDi2BookMarkdown` → fenced commit `completed`.

Relay: the shared final-delivery continue route and Inngest function now accept phase `decision_report` and delegate to `runDecisionReportStage`; lock release is per phase (`relayLockPhaseForJob`).

## Requirement mapping

| Requirement | Where |
|---|---|
| Personal Analysis, 10 output sections | `personal-analysis.ts`, `PERSONAL_ANALYSIS_SECTIONS` |
| Inputs: real chart, Blueprint, frozen DC + binding, facts / constraints, unverified / estimate / unknown, conflicts, DIRs | `formatAnalysisInputBlock` |
| Epistemic classes never upgraded | `classConsistent`: validator rejects an item whose `basis_class` is stronger than its cited evidence status |
| DC never changed | analysis and pages only read the registered Freeze; no DC write API is called |
| Traditional first, science auxiliary | chart-anchored sections must cite a chart / ziwei line and carry a non-thin `traditional_basis`; `science_note` is optional |
| Unresolved items carried through | every required open DC item must be cited in `unresolved_conditions` (analysis) and on page 05 |
| Persistence fields + idempotency key `session+freeze+context_hash+profile_hash+schema` | `decision-report-store.ts`, `personalAnalysisIdempotencyKey` |
| No cross-Freeze reuse; rerun on profile change; old never overwrites new | key includes freeze + hashes; write-once records; tests "new Freeze version", "profile change" |
| Explicit failure + retry, 1+1 cap | `DI2_MAX_UNIT_ATTEMPTS = 2`; `continueDecisionReportJob` resets budgets for unfinished units only |
| Frozen DC into legacy report generation | `finalizeDecisionContextSlice` in `final-delivery-stage-runner.ts` → `executeFanoutTask` → `runFinalizeGroup` → `finalize-prompt` `decision_context_slice`; also into segments `reality_constraints` |
| P5 paths with conditions / cost / risk / reversibility / exit / ranking basis | `validateDecisionReportPage` for 05: 2–4 paths, sequential ranks, every field present, each path grounded in a DC ref |
| P6 one low-cost verifiable experiment, no 30-day list | validator for 06: one `experiment` object with hypothesis / action / observe / window / success / if_fail; ≥3 distinct day/week schedule marks → `checklist_schedule` |
| P8 continue / adjust / stop / rerun | validator for 08: `review` with core metrics + all four conditions |
| DC JSON never the report body | visible fields are rejected on raw structure (code fences, leading `{`/`[`, `"key":` pairs) and, for zh, on bare metaphysics terms |
| Per-page checkpoint + resume, no Freeze mixing | page records keyed by job id; assemble cross-checks freeze / context hash / generation |
| Complete only after integrity check | `assemble` stage + client `verifyCompletedReport` |
| writeBack fix; legacy vs DI2 distinguished | `freeze-bound-report.ts` rejects legacy write-back onto DI2 rows (`SOURCE_MISMATCH`); DI2 rows are completed only by the `decision_report` pipeline |
| No legacy Stage 2 / Call A/B dependency | `DecisionReportJobInput` + `isDecisionReportJobInput`; runner never reads `agent_v2`, `breakthrough_core` or `covered_agenda` |
| `applyFinalDeliveryResultToSession` without `agent_v2` | question falls back to DC question, then `original_question` |
| UI: Freeze → analysis status → page progress → report; refresh recovers; regenerate keeps old | `POJUChatUI` DI2 state + `di2ReportShouldResume`; completed rows immutable on the session |

## DI2 vs legacy boundary

- **DI2 session** = session has `decision_blueprint`. Report goes only through `decision_report`. The legacy final-delivery auto-resume only probes a DI2 session when a legacy pending id exists.
- **Legacy session** = unchanged path (`/api/poju/final-delivery`, `final_delivery` phase). The only legacy-visible changes: frozen DC slice is fed to finalize / segments when `decision_context_snapshot` exists; pass charging moved to the shared `lib/passes/charge-delivery-pass.ts` (same behavior); relay accepts both phases.
- The execution fence is per session and shared by both phases, so a DI2 job and a legacy job cannot both commit for the same session.

## Changed files (implementation commit)

New: `app/api/poju/decision-report/route.ts`, `lib/passes/charge-delivery-pass.ts`, `lib/poju/decision-intake/decision-report-{client,pages,render,runner,service,store,types}.ts`, `lib/poju/decision-intake/personal-analysis.ts`, `scripts/test-m3-decision-report.ts`.

Edited: `app/api/poju/final-delivery/route.ts`, `app/api/poju/final-delivery/continue/route.ts`, `lib/inngest/functions/poju-final-delivery-continue.ts`, `components/poju/POJUChatUI.tsx`, `lib/llm/pro/delivery/finalize-call.ts`, `lib/llm/pro/delivery/finalize-prompt.ts`, `lib/llm/pro/final-delivery.ts`, `lib/poju/decision-intake/freeze-bound-report.ts`, `lib/poju/final-delivery-stage-runner.ts`, `lib/poju/types.ts`, `lib/poju/xhigh-job-types.ts`, `package.json`.

23 files, +5297 / −100. `DELIVERY_LLM_MAX_TOKENS` untouched.

## Checks executed on `dce6fd19` (local, Windows, in-memory KV)

| Check | Result |
|---|---|
| `pnpm exec tsc --noEmit` | exit 0 |
| `pnpm exec next typegen` | exit 0 |
| `pnpm build` | exit 0 |
| `scripts/test-m3-decision-report.ts` (new) | 27 passed, 0 failed |
| `test-m2-2-freeze-report-binding` | 43 / 0 |
| `test-m2-1-readiness-confirm-freeze` | 19 / 0 |
| `test-m2-3-decision-blueprint` | 18 / 0 |
| `test-m2-4-r2-production-closure` | 20 / 0 |
| `test-decision-context-stage4` | 13 / 0 |
| `test-decision-context-phase3-job-idempotency` | 10 / 0 |
| `test-breakthrough-core-kv-plan-limit` | all checks passed |
| `test-user-facing-delivery-lint-guard` | ok |
| `test-final-delivery-degraded` | **fails** ("P4 finalize duty is eastern action") |
| `test-delivery-page-plan` | **fails** (`完整原始命盘闭集` assertion) |

The two failures are pre-existing: both fail identically on the parent `b59959ad` (checked in a temporary worktree, since removed). M3 did not touch the asserted prompts. ESLint is not applicable (no `eslint.config` in the repo).

The M3 suite covers: analysis validator (class upgrade, missing sections, unknown evidence refs), P5 / P6 / P8 / raw-JSON page validators, full inline run through all three stages, status endpoint, idempotent start, regenerate (analysis reused, old pages intact), profile change → new analysis, new Freeze version → new analysis, write-once Freeze conflict, draft / broken hash refusal, missing chart structure refusal, 07 topic applicability, analysis 1+1 exhaustion, page failure → Continue keeping completed checkpoints, fence supersede, stale job detection, legacy write-back `SOURCE_MISMATCH`, client selectors. All model outputs in this suite are test-hook fixtures.

## Not executed

- Real OpenRouter calls for Personal Analysis or any report page.
- Real model output quality review (body free of bare metaphysics terms, P4 eastern-strategy duty, P5 / P6 / P8 substance) — validators exist, but were only exercised against fixtures.
- Full E2E: fresh user → dynamic Q&A → Confirm → Freeze → analysis → eight pages, on a real deployment.
- Browser / UI test of the DI2 progress, refresh-recovery and regenerate controls.
- Inngest / QStash relay on Vercel and real Upstash KV (only `MemoryKv` + inline ephemeral relay were exercised).
- Pass charging against the real pass store.

## Known residuals

- Legacy server-side write-back still reads `loadPOJUSession`, which is not available server-side under Never Stored; the client mirror is the durable copy.
- The Freeze / profile registry verifies DC integrity (hash) but cannot verify authenticity: the client is the only holder of the session.
- KV TTL is 2 h. After expiry, Continue falls back to regenerate (new generation); the session mirror keeps the old completed report.
- Continue resets unit attempt budgets but not the relay hop counter.
- No Stop control for DI2 jobs.
- The legacy delivery-confirm chip on a DI2 session was not re-verified.
