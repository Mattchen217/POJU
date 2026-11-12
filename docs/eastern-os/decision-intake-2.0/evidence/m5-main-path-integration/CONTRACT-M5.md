# M5 — DI2 main-path integration closure (report persistence, worker recovery, client recovery)

This is an evidence record for the production change on `feat/m1-r-fresh-session-main-loop`. It does not declare Decision Intake 2.0 or this task PASS; it is handed to independent review.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Parent / baseline (M4.1 evidence tip, local == origin before M5): `d62b78b8bd440fd1eed110e61c15f989dfb1f91e`
- Implementation SHA (all checks in §6 ran on this commit): `7b113268c3424542fe5ace31870c0e6016aaedd0`
- Evidence tip SHA: _(this commit; left for independent review)_
- No PR opened. Not merged into `main`, not rebased. Nothing deployed or promoted. No force-push.

**What this evidence is not.** No real OpenRouter call and no real model output. No browser run. `/api/poju/decision-report` was not called over real HTTP; the route body (`handleDecisionReportAction`) was called in-process through a `fetch` stub with a JSON round-trip. No Upstash Redis: every KV check uses the process-memory `MemoryKv` (`durableKv()` without Upstash env) and the request-scoped ephemeral `MemoryKv` (`runWithEphemeralXhighKv`). No real Inngest or QStash: `inngest.send` was replaced. Device storage is `fake-indexeddb` in Node.

## 0. Gaps on the baseline (`d62b78b8`)

Identified by reading the baseline code; no separate baseline probe was committed.

1. `runAssembleStage` marked the job `completed` under the fence first, then called a best-effort `saveCompletedReport` whose error was only logged. A job could therefore be reported completed with no durable report record, and a failed write was invisible.
2. The completed record had no record hash, no read-back, and no idempotency or conflict rule. An old generation's write was not withdrawn when it lost the fence.
3. `start` reused a pending or running job for the same Freeze without checking that any worker existed. A lost first dispatch (create succeeded, `after()` / relay never ran) left the job pending until the 6-minute stale rule, and then only a user Continue helped.
4. `continue` on a pending or running job returned `JOB_RUNNING` without checking the lease, so a killed worker could not be replaced before it went stale.
5. Client: one generic failure path. Every retryable failure looked the same (interruption vs. quality 1+1 spent), there was no automatic recovery, no guard against duplicate recovery from several mounts or tabs, and a `missing` job cleared the pending id. The final local write updated React state before IndexedDB, and a write failure surfaced as a raw error with the report treated as shown.
6. Completion check on the device: pages were checked for Freeze and context hash only, not for job, generation or analysis identity. The Personal Analysis record and profile hash were not checked.

## 1. Server: final report commit

`lib/poju/decision-intake/decision-report-runner.ts` `runAssembleStage` → `commitFinalReport` → `decision-report-store.ts` `commitCompletedReport`.

Order:

1. `fenceTouch(assemble, "final_commit")`. If this generation no longer owns the execution fence, nothing is written and the lease is released.
2. Durable record (`durableKv`, key `poju-di2:report:{session}:{job}`):
   - `CompletedReportRecord` v1 contents:
     - job id, session id, execution generation, report row id;
     - Freeze identity: `freeze_id`, `context_id`, `context_version`, `context_hash`;
     - `profile_id`, `profile_hash`, Freeze receipt id and Profile receipt id;
     - report and analysis schema versions, `analysis_id`;
     - the job result, the completed Personal Analysis record and all eight page records;
     - `committed_at` and `record_hash` (canonical hash of every other field).
   - `verifyCompletedReportRecord` runs before the write and on every read. It checks:
     - the record hash;
     - that the result is bound to the record;
     - that the analysis is completed and has the same identity;
     - exactly 8 pages, each completed and non-empty with the same job, generation, Freeze, context hash, analysis id and schema;
     - that `page_ids` match.
   - On a failure it raises `REPORT_RECORD_INVALID`.
   - The write is `SET NX` with retention TTL, then read back. A missing read-back raises `REPORT_PERSIST_UNCONFIRMED`.
   - If a record already exists, it is reused when it is the same report: same identity plus the same canonical hash of the analysis result and the page contents. A divergent existing record raises `REPORT_RECORD_CONFLICT`. Losing the NX race also reuses the record.
3. The job becomes `completed` only through the fence CAS, with `result = record.result`.
4. If that CAS fails, the job is reloaded. When the job is not completed by this generation and the fence is now owned by another generation or job, the record is withdrawn: `withdrawCompletedReport` deletes it only if its generation matches. Then the lease is released.

Failure kinds (`failDecisionReportJob`; `PojuXhighJobFailureReason` gains two values):

| Kind | `failure_reason` | `retryable` | Used for |
|---|---|---|---|
| `interrupted` | `interrupted` | true | hop / wall budget, schedule failure, inline stop, missing page or analysis at assemble, stage crash, page attempts burned without a `failed` page |
| `report_persist_failed` | `report_persist_failed` | true | durable write or read-back failure |
| `quality_exhausted` | `quality_exhausted` | true | analysis or a page spent its production 1+1 on output quality |
| `fatal` | `parse_failed` | false | source unavailable, page / report integrity, record conflict or invalid |

`buildDecisionReportStatus` (service):

- **Completed job:** completed only from `ensureCompletedReportRecord`, which loads the record or rebuilds it from the completed job, its analysis and its pages through the same `commitCompletedReport`.
  - If that fails, status is `failed` with `failure_reason: report_persist_failed`. It is retryable unless the code is `CONFLICT` or `INVALID`.
- **Job missing:** status falls back to the record for that job id (execution TTL expiry), otherwise `missing`.
- **Not completed:** `result` is always `null`. Running / pending payloads carry `worker: "live" | "dispatching" | "none"`.
- Internal states (assemble in progress, record written but CAS not done) are reported as `running`, never `completed`.

## 2. Server: scheduling recovery

New `decision-report-dispatch.ts` and `decision-report-api.ts`. The route `app/api/poju/decision-report/route.ts` is now a thin wrapper: it supplies `after()` as the background host and `chargeDeliveryPass` as the charge.

Worker liveness (`decisionReportWorkerState`):

- **live:** the continue lease is held. The lease lasts 330 s and the heartbeat refreshes it every 12 s.
- **dispatching:** a hand-off ACK exists (120 s), or a dispatch marker exists (`poju-di2:dispatch:{job}`, 45 s grace). The marker is set before a stage is handed off; the runner sets it before releasing its lease.
- **none:** neither applies.

`dispatchDecisionReportStage(job, session, stage, deps)`:

1. Mark the dispatch.
2. Set the job to `pending` with `queued:{stage}`.
3. If Inngest is configured: publish. If a worker attaches within `attachWaitMs` (default 30 s), the relay owns the stage.
4. Otherwise this invoke hosts `runDecisionReportStage` in the background. On a crash it releases the session lock.

`ensureDecisionReportWorker(job, session)`:

1. Refusals:
   - missing → `JOB_MISSING` 404;
   - completed → nothing to do;
   - failed → `JOB_NOT_RUNNING`;
   - other deploy → `SUPERSEDED_BY_DEPLOY`;
   - fence not on this job → `SUPERSEDED`;
   - wall budget spent → `JOB_BUDGET_EXHAUSTED`.
2. No second worker:
   - live lease → `worker_live`;
   - ACK → `dispatch_in_flight`.
3. Otherwise:
   - The stage comes from persisted checkpoints (`firstIncompleteDecisionReportStage`: analysis → pages → assemble).
   - An NX claim on the dispatch marker lets exactly one caller dispatch; the others get `dispatch_in_flight`.
   - The same job and execution generation are kept, completed analysis and pages are reused, and there is no charge.
   - A dispatch that throws clears its marker and returns `DISPATCH_FAILED` (503, retryable).

Route actions (`handleDecisionReportAction`):

- **`status`:** as in §1.
- **`start`:**
  - A reused pending or running job for the same Freeze goes through `ensureDecisionReportWorker`.
  - A reused completed or failed job returns its status.
  - A new job is charged only if the session has no prior charge and it is not a Regenerate with a prior job. After a successful charge, a durable marker `poju-di2:charged:{session}` is set; the DB idempotency of `consumePassSmart` per session is kept.
  - Charge refusal aborts the job.
  - A failed first dispatch is logged and its marker is cleared. The answer is still 200 `pending`, and the next start, continue or status poll recovers the worker.
- **`continue`:**
  - Pending or running jobs go through `ensureDecisionReportWorker`.
  - A missing job whose record exists answers `ALREADY_COMPLETED`.
  - A failed job is revived by `continueDecisionReportJob` (fresh 1+1 for failed units, same generation) and then dispatched.
  - A completed job answers `ALREADY_COMPLETED` only after its record is confirmed, otherwise 503 `REPORT_PERSIST_FAILED`.

Orphan session lock (`reclaimStaleXhighSessionLock` in `xhigh-job-store.ts`). Normally the lock TTL (90 min) is shorter than the job TTL (2 h), so an expired job leaves no lock. If a job record is lost earlier, its lock would block Regenerate. `startDecisionReportJob` takes the lock over only when all of these hold:

- no job is live for the session;
- the lock is older than 2 min (longer than any create window);
- an atomic compare-and-set on the exact lock value succeeds. This uses the existing `compareAndSetExact` / Lua path.

## 3. Client recovery state machine

`lib/poju/decision-intake/decision-report-client.ts`.

`classifyDecisionReportStatus`:

| Server status | Class | Client action |
|---|---|---|
| `pending` / `running` | pending / running | keep polling; no new job. After 2 consecutive polls with `worker: "none"` the driver posts `continue` (ensure worker); at most 6 per run, then `WORKER_UNAVAILABLE` (retryable) |
| `completed` | completed | verify (below), then one local commit |
| `failed`, retryable, reason ≠ `quality_exhausted` | retryable_failed | driver posts `continue` on the same job (at most 2 per run). `JOB_RUNNING` / `REPORT_JOB_BUSY` / `ALREADY_COMPLETED` / `DISPATCH_FAILED` → keep polling. `JOB_MISSING` / `JOB_BUDGET_EXHAUSTED` / `SUPERSEDED*` / `NOT_REVIVABLE` → one Regenerate for the same Freeze |
| `failed`, `quality_exhausted` | needs_user_continue | stop with `REPORT_QUALITY_EXHAUSTED` (retryable). No automatic retry; the UI retry button maps to Continue |
| `failed`, not retryable | permanent_failed | stop with `REPORT_FAILED` (not retryable). No automatic retry; the UI offers Regenerate |
| `missing` | missing | The server already answers from the committed record when one exists. Only a genuinely missing job gets one Regenerate (same Freeze, new generation, no charge) |

- **Driver deduplication.** Only one driver per session may Continue, ensure or Regenerate. The driver lock uses `navigator.locks.request(..., { ifAvailable: true })` across tabs when the Web Locks API exists, otherwise a per-realm set. Other runs (another tab, another mount) only poll, and take over if the lock becomes free. `POJUChatUI` additionally keeps its `di2BusyRef`, its `di2AutoKeyRef` per session / Freeze / mode / job id, and its rule that auto-start / resume does not run while a failure is shown.
- **Failure handling.**
  - The row keeps `xhigh_job_id`, `execution_generation`, `analysis_id`, `profile_hash` and the Freeze binding, and the pending job id stays.
  - Progress mirrors are best-effort writes, because the server holds every checkpoint.
  - A pending job id that was created but could not be saved raises `LOCAL_SAVE_FAILED`. The next start for the same Freeze reuses the job, with no new charge.

Completion check (`verifyCompletedReport`):

- **Job and result:**
  - the payload job equals the polled job;
  - one execution generation across payload, result and pages;
  - the result's report row and analysis id;
  - the payload and result `freeze_id` / `context_hash` equal the device's Freeze, else `REPORT_BINDING_MISMATCH`.
- **Profile:** the profile hash equals the device's profile receipt when it has one.
- **Personal Analysis:** it must be `completed` with `analysis_result`, and match `analysis_id`, Freeze, context hash and profile hash. Otherwise → `REPORT_ANALYSIS_INCOMPLETE`.
- **Pages:**
  - all eight pages are present and completed, else `REPORT_INCOMPLETE`;
  - every page carries this Freeze, context hash, job, generation and analysis id, else `REPORT_BINDING_MISMATCH`;
  - `assertCompleteEightPageReport` must pass.

One local write (`commitCompletedReportToSession`):

1. The completed analysis record, and the DI2 row set to `completed` with the eight pages.
2. `last_delivery_context_binding`.
3. `applyFinalDeliveryResultToSession`, which is the existing delivery display and archive path.
4. `pending_decision_report_job_id = null`.

All of this goes in one `persist`.

- If the write fails, the result is `LOCAL_SAVE_FAILED` (retryable) and nothing counts as delivered. The stored Session keeps the pending id, so the next open, or the retry button (Continue → `ALREADY_COMPLETED` → poll), fetches the report again.
- If the write loses a Session revision race (`SessionCasError`, another tab or a chat turn wrote meanwhile), the latest stored Session is reloaded. If it already holds this delivered report it is returned; otherwise the same commit is re-applied onto it and written once more.

`components/poju/POJUChatUI.tsx`: report `persist` writes IndexedDB first and updates `sessionRef` / UI state only after the write succeeded. A Session with a completed report has no pending id and a completed row, so `di2ReportNeedsAutoStart` and `di2ReportShouldResume` are both false and nothing auto-starts.

Never Stored: nothing new is uploaded from the device. The server already held the report record, analysis and pages; M5 only makes their commit durable and verified. No chat transcript or Session is sent to the server.

## 4. Injection and simulation methods

| Simulated condition | Method (test-only) |
|---|---|
| durable write failure | `durableKv().set` patched to throw for `poju-di2:report:` keys |
| process killed after the record write | `durableKv().set` patched to arm after a successful report-record write; `MemoryKv.prototype.compareAndSetJobGeneration` then throws, so neither the completion nor the fail stamp lands; the lease stays held (heartbeat stopped) |
| dead worker's lease expiry | lease value rewritten with `expires_at` in the past (TTL semantics of `loadDeliveryContinueLease`) |
| dispatch grace elapsed | dispatch marker key deleted (TTL expiry) |
| first dispatch failed | background host throws |
| worker never ran / host died | background host drops or queues the task |
| Inngest published, no worker | `INNGEST_EVENT_KEY` set, `inngest.send` replaced (records events), `attachWaitMs` = 50 ms |
| old generation races a Regenerate | `durableKv().set` patched to call `service.startDecisionReportJob({regenerate:true})` right after the old generation's record write |
| execution job expired | job key deleted from the ephemeral KV |
| orphan session lock | lock key value set to an old timestamp |
| stale interrupted job | job `updated_at` set 10 min back with no lease (production stale rule) |
| local save failure | `armIdbWriteFault("pojuSessionRecords")`: real fake-indexeddb transaction abort on the final Session write |
| revision race | another `savePOJUSession` between the client's load and its final write |
| tampered server payload | `fetch` stub rewrites the status JSON (page removed, foreign Freeze / context hash / generation, analysis not completed / foreign id) |

The model network call is replaced by test hooks (`__setPersonalAnalysisModelForTests`, `__setDecisionReportPageModelForTests`) that feed raw JSON into the production validators. The page hook can also return invalid JSON to spend a page's 1+1.

## 5. Tests (`scripts/test-m5-di2-main-path.ts`, `pnpm test:m5-di2-main-path`)

The device Session is created with `sm.createPOJUSession` and `savePOJUSessionCore`. The draft is frozen through the production `ensureSessionFrozenForDelivery`, which uses the in-process authority transport, so every report starts from real server-sealed Freeze and profile receipts. Client calls go through the production report client and its default `persist` (`savePOJUSession` on fake-indexeddb).

| # | Layer | Asserted |
|---|---|---|
| A1 | route body + runner | Job completed only with a verified record. The record holds the Freeze / context / profile identity, both receipt ids, the generation, the completed analysis and 8 pages. Job result equals the record result. Status is served from the record. 1 analysis call, 1 charge |
| A2 | route body + runner, durable write rejected | Job `failed`, `report_persist_failed`, retryable. Status not completed, `result: null`, no record. Continue → stage `assemble` → completed with the record, 0 model calls |
| A3 | store / runner | A repeated commit returns `existing` with the same `record_hash`. Divergent page content is refused. An `assemble` replay on a completed job is a no-op |
| A4 | runner, killed after the record write | Job stays `running` at `assemble`. Record exists. Status `running`, `result: null`, `worker: live` |
| A5 | route body | Execution job deleted: status `completed` from the record (8 pages, analysis). Continue → 409 `ALREADY_COMPLETED` |
| A5b | route body | Record deleted for a completed job: status rebuilds and re-verifies it, 0 model calls |
| A6 | runner, Regenerate between the old generation's record write and its CAS | Old job not completed and its record withdrawn, so its status is not completed. The new generation completes with a higher generation and reuses the analysis |
| B1 | route body | First dispatch throws: 200 pending, marker cleared, `worker: none`. Second start reuses the job → `dispatched` → completed. 1 charge, 1 analysis call |
| B2 | route body + `inngest.send` stub | Published without attach: the invoke hosts the worker and the job completes (1 publish). Published while the host died: `dispatching`, and continue inside the grace window does not re-dispatch. After the grace: `none` → continue → `dispatched` (stage `finalize`) → completed. 1 charge |
| B3 | route body + lease | Live lease: status `live`; continue and start answer `worker_live`; nothing hosted. An overlapping stage invoke skips (0 model calls) |
| B4 | route body (A4 job) | Lease still live → `worker_live`, no steal. Lease expired and marker gone: `none` → continue → `dispatched` at `assemble` → completed with the same generation and the same `record_hash`, 0 model calls |
| B5 | route body | Regenerate after completion: no charge. Every session in the run charged exactly once. Charge marker present |
| B6 | route body + runner | 5 concurrent continues on a worker-less job: exactly 1 `dispatched`, 1 hosted task. That task plus 2 extra concurrent stage invokes: 1 analysis call, no page generated twice, one record |
| B7 | route body | Job missing and lock 10 s old → `REPORT_JOB_BUSY`. Lock 3 min old → reclaimed, a new job starts, no new charge |
| C1 | client + route body | Tab closed after start: pending id stored, no completed row, resume selector true. Reopen while the earlier worker runs: no `start`, delivered and persisted (§D4 checks), 1 charge, 1 analysis call |
| C2 | client + route body | Worker killed after the record write, lease expired: reopen → idle polls → `continue` (ensure) → completed. No `start`, 0 model calls |
| C3 | client + route body | Stale job → status `failed` / `interrupted` → exactly 1 automatic `continue` on the same job → delivered. No `start`, 1 charge |
| C4 | client + route body | Permanent failure: `REPORT_FAILED`, not retryable. No `continue` or `start`. Pending id, row job id and generation kept, not delivered |
| C4b | client + route body | Page 05 spends its 1+1: `REPORT_QUALITY_EXHAUSTED`, no automatic `continue`. A user Continue regenerates only unfinished pages, none of the pages completed before; delivered |
| C5 | client + route body | Job completed but never received, execution job expired: reopen → only `status` → delivered, 0 model calls |
| C5b | client + route body | Job lost early with an old lock: `missing` → exactly 1 Regenerate `start` → new job delivered. 1 charge for the session |
| C6 | client selectors on the stored Session | A delivered Session neither auto-starts nor resumes; no request, no model call |
| C7 | client ×2 concurrently + route body | Two runs on the same interrupted job: exactly 1 `continue`, no `start`, both runs resolve delivered, 1 analysis call. In Node there is no `navigator.locks`, so this exercised the per-realm driver set, not cross-tab Web Locks |
| D1 | client, tampered payload | Page missing → `REPORT_INCOMPLETE`. Stored Session not delivered, pending kept. An untampered refetch delivers with 0 model calls |
| D2 | client, tampered payload | Foreign page Freeze, foreign payload context hash, foreign page generation → `REPORT_BINDING_MISMATCH` (×3). Each is then delivered by refetch |
| D3 | client, tampered payload | Analysis not completed, or a foreign analysis id → `REPORT_ANALYSIS_INCOMPLETE` (×2). Each is then delivered by refetch |
| D4 | client + reload | After delivery, reload from IndexedDB shows:<br>• row completed with 8 non-empty pages;<br>• job id, generation, analysis id, profile hash and Freeze hash from the record;<br>• the completed analysis record;<br>• `main_delivery_done`, pending `null`, binding set;<br>• a delivery message present;<br>• no auto-start or resume |
| D5 | client + fake-indexeddb abort | Final write aborted (1 hit) → `LOCAL_SAVE_FAILED`, retryable. Stored Session not delivered, pending kept, resume selector true. Reopen → only `status` → delivered, 0 model calls |
| D6 | client + revision race | Another writer saved after the client loaded. Final write → re-applied onto the latest Session → delivered, and the other writer's field kept |

Layer split:

- **Route body in-process:** every A, B and C case runs `handleDecisionReportAction` with a JSON round-trip, plus the real service, runner, dispatch, store, fence and lease, on process-memory and ephemeral `MemoryKv`. This is not real HTTP and not Upstash.
- **Device code:** the C and D cases run the production report client and session-manager on fake-indexeddb in the same Node process. "Tab closed", "reopen" and "two tabs" are simulated with aborted and concurrent client runs and reloads from IndexedDB. No browser, no React mount, no real tab.
- **A3, A4 and A6** call runner or store functions directly to place the fault. They show server classification and recovery, not client crash recovery.

## 6. Checks executed on `7b113268`

Captured to `temp/out_m5_final_*.txt` (not committed).

| Check | Exit | Result |
|---|---|---|
| `tsx scripts/test-m5-di2-main-path.ts` (new) | 0 | 29 passed, 0 failed |
| `tsx scripts/test-m4-1-freeze-recovery.ts` | 0 | 10 passed, 0 failed |
| `tsx scripts/test-m4-decision-authority.ts` | 0 | 27 passed, 0 failed |
| `tsx scripts/test-m3-decision-report.ts` | 0 | 27 passed, 0 failed |
| `test-m2-1-readiness-confirm-freeze` | 0 | 19 passed, 0 failed |
| `test-m2-2-freeze-report-binding` | 0 | 43 passed, 0 failed |
| `test-m2-3-decision-blueprint` | 0 | 18 passed, 0 failed |
| `test-m2-4-r2-production-closure` (hook-based, no OpenRouter) | 0 | PASS=20 FAIL=0 |
| `test-m1-r-fresh-session-main-loop` | 0 | PASS=8 FAIL=0 |
| `test-intake-r6-freeze-versioning` | 0 | all checks passed |
| `test-intake-r6-freeze-authority-regression` | 0 | PASS=8 FAIL=0 |
| `test-intake-r6-freeze-wire-reason` | 0 | passed=25 failed=0 |
| `test-intake-r6-freeze-persist-disclose` | 0 | PASS=5 FAIL=0 |
| `test-s7-dc-lifecycle` | 1 | 5 passed, 3 failed. The same three failures as the M4 baseline run (`Call B maps Agenda → DIR…`, `Collecting appends unverified fact…`, `Freeze still blocked without Stage3 sufficiency…`); not touched by M5 |
| `tsc --noEmit -p .` (excludes `scripts/`) | 0 | — |
| `tsc --noEmit` on the M5 test + fixture (temporary config extending the root config) | 0 | — |
| `pnpm build` | 0 | — |

Lint: not run. ESLint 10 is installed but the repository has only `.eslintrc.json` and no flat config, so `eslint` refuses to start. This is unchanged from M3 / M4.

## 7. Not executed

- `/api/poju/decision-report` over real HTTP, and Next.js `after()` in a real invoke. The route wrapper is covered by the build only.
- Upstash Redis: NX / TTL / Lua compare-and-set behaviour, latency, eviction. The orphan-lock reclaim takes the Lua path on Upstash; only the `MemoryKv` `compareAndSetExact` path ran.
- Real Inngest / QStash relay, attach timing and `/continue` ACK under load.
- Real lease expiry after 330 s and real marker expiry after 45 s. Both were simulated as described in §4.
- A real browser: React mount and unmount, `POJUChatUI` auto-start / resume and the retry button, IndexedDB quota or eviction, cross-tab Web Locks, and process or tab crashes.
- Multiple devices on one session.
- Real OpenRouter / model calls, model-quality validation, and a full end-to-end report.

## 8. Trust boundaries and known limits

1. **Crash between record write and withdraw.** A generation that loses the fence after writing its record withdraws it. If the process dies between that write and the withdraw, a record stays under the old job id. Records are keyed per job id, so it never overwrites or replaces the new generation's record. While the old execution job exists its status stays `failed` (superseded). Once that job has expired, status for the old job id would answer `completed` from the leftover record, for its own Freeze and generation only. A device asks for that job id only if it still holds it as pending, and it verifies the Freeze and generation.
2. **Dead-worker detection is lease-bound.** A worker that dies while holding its lease is replaced only after the lease expires (up to 330 s), plus the 45 s marker grace if it was mid-hand-off. Recovery never steals a live lease.
3. **Automatic recovery is bounded per client run.** The limits are 2 Continues, 6 worker ensures and 1 Regenerate. After that the run stops with a retryable error and the user retries. The server hop and wall budgets still apply.
4. **Quality failures are not retried automatically.** This follows the iron rule that production quality failures get at most 1+1 and are then reported; only infrastructure interruptions auto-Continue.
5. **Charge rule.** One charge per session: a durable per-session marker plus the existing per-session pass idempotency. The marker shares the retention TTL of other DI2 records. A marker write failure after a successful charge is logged, and the pass-level idempotency still prevents a second debit for the same session.
6. **Driver lock scope.** Without the Web Locks API (old browsers, Node), deduplication is per JS realm only. Separate tabs could then each drive recovery. They still cannot create a second worker or charge (server lease, NX marker and charge rules), but they could both post Continue.
7. **Server-side retention.** The completed report record, analysis and pages were already server-side in M3. M5 keeps the same data and retention, adds the record hash and receipt ids, and adds no chat or Session data.
