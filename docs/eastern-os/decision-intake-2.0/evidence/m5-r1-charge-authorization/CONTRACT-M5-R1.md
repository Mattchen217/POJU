# M5-R1 — report charge authorization & client job binding

This is an evidence record for the production change on `feat/m1-r-fresh-session-main-loop`. It does not declare M5-R1 or Decision Intake 2.0 PASS; it is handed to independent review.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Parent / baseline (M5 evidence tip, local == origin before M5-R1, re-checked with `git fetch` before the commit): `b34c01eaf1552dbf4eb58926c3a47f40150ec2f9`
- Implementation SHA (all checks in §7 ran on this commit): `07b29553bb16002c6290a3bb96511fa8cebbb1e4`
- Evidence tip SHA: _(this commit; left for independent review)_
- No PR opened. Not merged into `main`, not rebased. Nothing deployed or promoted. No force-push.
- The implementation commit was amended once **before** it was pushed (the M3 harness update in §6 was folded in); the pushed history is a fast-forward of `b34c01ea`.

**What this evidence is not.**
- No real OpenRouter call and no real model output.
- No real Supabase / pass RPC: the charge is a ledger stub that imitates the consume RPC (see §6).
- No Upstash Redis. All KV is process-memory `MemoryKv`: `durableKv()` without Upstash env, plus the request-scoped ephemeral `MemoryKv`. The Upstash branch of the CAS (Lua `eval`) was not executed.
- No real HTTP. The route body was called in-process through a `fetch` stub with a JSON round-trip.
- No real `after()`, Inngest or QStash.
- No browser. Device storage is `fake-indexeddb`.

## 0. Review findings addressed

1. **A worker could be dispatched before the charge was confirmed.** On `b34c01ea`, a reused pending or running job got a worker without any check (`ensureDecisionReportWorker` in the reused-start branch). So request B could dispatch a job whose charge (request A) was still in flight or later refused. Neither the dispatcher nor the worker checked payment.
2. **`had_prior_job` was treated as proof of payment.** `(regenerate && started.had_prior_job) || hasDecisionReportCharge(...)` made any Regenerate after any prior job free, including one whose first charge failed.
3. **The client did not bind the completed payload to the polled job.** The client built `expected.job_id` from `payload.job_id`, so a completed payload of another job was accepted.

## 1. PASS charge idempotency (verified in code, not executed)

- `chargeDeliveryPass` → `consumePassSmart` → either `consume_household_pass` or `consume_user_pass`, with `refId = jointPassRef || sessionId`.
- `supabase/migrations/20260728_pass_usage_and_subscription.sql`:
  - unique index `pass_usage_dedup_idx (user_id, product, ref_id)`.
- `20260809_pass_carryover_plan_switch.sql` `consume_user_pass` and `20261025_duo_household_joint.sql` `consume_household_pass`:
  - an existing `(user, product, ref_id)` row returns `ok=TRUE, reason='already_consumed'` **before** the balance check, with no debit;
  - the debit and the `pass_usage` insert happen in one function transaction.
- A concurrent duplicate (both calls pass the `EXISTS` check) hits the unique index. Its transaction aborts, including the decrement, and surfaces as `rpc_error`.
- **Consequence.** Re-running the same ref can never debit twice. An `rpc_error` does not prove "not charged". M5-R1 therefore:
  - fixes the ref at the first claim (`charge_ref`);
  - reuses that ref for every reconcile;
  - marks `rpc_error` as `uncertain` in `chargeDeliveryPass` (`{ ok:false, uncertain:true }`). The legacy final-delivery callers only read `ok` and `response`, so they are unaffected.

## 2. Authorization state machine

New module `lib/poju/decision-intake/decision-report-charge.ts`.

**Record.** `ChargeAuthorization`, one per session, in `durableKv`, key `poju-di2:charge-auth:{session}`, with the product retention TTL. It holds:
- `state`: `pending` | `authorized` | `refused` | `uncertain`;
- `charge_ref`, fixed at the first claim, and `joint_pass_ref`;
- `question` (the ledger label);
- `attempt_id`, `claimed_at`, `attempts`;
- `reason`, `updated_at`, `authorized_at`.

```
(none) ──claim (NX)──▶ pending ──charge ok──────────▶ authorized   (terminal)
                         │    ──charge refused─────▶ refused      (a start re-claims)
                         │    ──rpc_error / throw──▶ uncertain    (re-claim reconciles)
                         └── claimed_at older than 60 s: abandoned → re-claimable
```

**Transitions.**
- Every transition is a compare-and-set on the exact JSON of the record:
  - absent → `set NX`;
  - otherwise `compareAndSetExact` on MemoryKv, or a Lua `GET == expected → SET EX` on Upstash.
- Only the claimant (the request whose CAS won) calls the charge, so two requests can never both charge.

**`settleDecisionReportCharge({ allowNewCharge })`:**

| Current record | `start` (`allowNewCharge`) | `continue` |
|---|---|---|
| `authorized` | free, no charge call | free |
| `pending`, live claim | `pending`: follow the job, do not run, do not charge | `CHARGE_PENDING` |
| none | claim + charge | `required`: no first charge from Continue |
| `refused` | re-claim + charge (same ref) | `CHARGE_REFUSED` |
| `uncertain` / abandoned `pending` | re-claim + reconcile (same ref) | re-claim + reconcile |

**After the charge call:**
- `ok` → `authorized`.
- `uncertain` flag, or a throw → `uncertain`.
- Any other refusal → `refused`, and the pass response is returned (402 `pass_required` / 401 `pass_login_required`).

**If writing the outcome fails** (CAS false or a throw):
- if the record already reads `authorized`, the request continues;
- otherwise it answers `uncertain` (`authorization_write_unconfirmed`) and nothing runs. The claim stays `pending`. After 60 s it is re-claimable, and the reconcile charges the same ref, which returns `already_consumed`.
- A paid session is therefore never treated as unpaid with a new ref, and never debited twice.

**Where authorization lives.** It is server-side only, in `durableKv`. The client holds nothing that grants execution.

## 3. Job ↔ authorization binding, all execution entries

**Execution grant.**
- Record `DecisionReportExecutionGrant` in `kv` with the job TTL, key `poju-di2:exec-grant:{job}`. It holds the job id, session id, execution generation and `charge_ref`.
- `grantDecisionReportExecution(job)` writes it only when:
  - the job is pending or running;
  - the job has a generation;
  - the session record is `authorized`.
- `verifyDecisionReportExecution(job)` requires:
  - the grant names this job, session and generation;
  - the session record is `authorized` with the same `charge_ref`.
- Read failures refuse.

**Entries into `dispatchDecisionReportStage` / `runDecisionReportStage`, and the gate on each:**

| Entry (production) | Gate |
|---|---|
| route `start`, new job | settle → `authorized` → grant → `dispatchDecisionReportStage` |
| route `start`, reused live job | settle → `authorized` → `ensureDecisionReportWorker`, which grants and then dispatches. `pending` → `200 worker:"awaiting_charge"`, no dispatch. `uncertain` → `503 CHARGE_UNCONFIRMED`. `refused` → abort + pass response |
| route `continue` | settle (reconcile only) → `ensureDecisionReportWorker` / revive → grant → dispatch |
| `ensureDecisionReportWorker` | `grantDecisionReportExecution`, else `402 CHARGE_NOT_AUTHORIZED`, before any lease, ACK or claim |
| `dispatchDecisionReportStage` | `verifyDecisionReportExecution`, else throws `DecisionReportNotAuthorizedError` before marking or dispatching |
| `runDecisionReportStage`: background `after()`, Inngest/relay → `/api/poju/final-delivery/continue` → `runFinalDeliveryStage` → `runDecisionReportStage`, inline `scheduleNext` hand-off | `verifyDecisionReportExecution` at entry, before the lease. On refusal it releases a passed-in lease and returns |
| every `fenceTouch` in the runner (before every checkpoint write; every model call follows one) | `verifyDecisionReportExecution`, else stop |

**`abortDecisionReportJob`** (charge refused), in order:
1. revoke the grant;
2. `failXhighJob(retryable:false, failure_reason:"charge_refused")`;
3. clear the dispatch marker;
4. release the session lock.

`charge_refused` is not revivable: the M5 `isRevivable` and `updateXhighJobStatus` rules need `interrupted` or `retryable`. A start for the same Freeze therefore creates a new job and settles its charge again.

**A refusal does not abort a job the session has meanwhile paid for.** Before aborting, the start re-reads the record and aborts only if it is not `authorized`.

**`had_prior_job` was removed** from `startDecisionReportJob`. The only proof of payment is an `authorized` record. The M5 marker (`poju-di2:charged:*`, `hasDecisionReportCharge` / `markDecisionReportCharged`) was removed. A session still carrying it is charged through the same ref, so the ledger answers `already_consumed`.

**Client handling:**
- `charge_refused` surfaces as `pass_required`.
- `CHARGE_PENDING` from an automatic Continue keeps polling.
- `awaiting_charge` is followed like any job without a worker.

## 4. Client job identity (`decision-report-client.ts`)

- `pollUntilDone` passes the job id it polled into `commitCompletedReportToSession(session, polled_job_id, …)`, which passes it on to `verifyCompletedReport`. Nothing in `expected` comes from the payload.
- New checks, in addition to the M5 ones (result, `report_job_id`, generation, Freeze, context hash, profile, analysis, eight pages):
  - `payload.job_id === polled_job_id`;
  - `payload.session_id === session.session_id`;
  - `result.report_job_id === di2ReportJobId(session, Freeze, device profile receipt, generation)`. A swapped `report_job_id` is caught even when the payload's and the result's are swapped together.
- On any mismatch, `REPORT_BINDING_MISMATCH` is thrown before the local write:
  - the pending job id stays;
  - `main_delivery_done` is not set;
  - no row is marked completed.

## 5. Tests — `pnpm test:m5-r1-authorization` (`scripts/test-m5-r1-authorization.ts`, new)

**What is real:**
- route body, service, runner, dispatcher, store;
- authorization state machine and grants;
- fence, lease, dispatch marker;
- legacy stage router (`runFinalDeliveryStage`);
- M4 Freeze authority;
- production Freeze wire;
- session CAS on fake-indexeddb;
- browser client.

**What is replaced:**
- the model network call (hooks feed the production validators);
- the background host (run / drop / queue);
- the charge, replaced by a ledger stub:
  - `already_consumed` is answered before the balance check, as the RPC does;
  - one debit per new ref, and a refusal on an empty balance;
  - per call it can be paused, can lose its answer after debiting (`uncertain`), or can throw before the ledger.

| Case | Requirement | What it shows |
|---|---|---|
| R1-01 | A4 failed-charge race | A's charge is paused. B's start on the same Freeze reuses the job and gets `200 awaiting_charge`, with no hosted worker, no dispatch marker and no second charge call. B's Continue gets `CHARGE_PENDING`. A worker that reaches the job before settlement is refused at entry. A's charge is refused: 402 `pass_required`, the job is `failed / charge_refused / retryable:false`, the grant is invalid and the record is `refused`. Workers for all three stages afterwards → nothing. Continue → `402 CHARGE_REFUSED`. Zero debits, zero PA calls, no analysis, no page, no completed record |
| R1-02 | A4 success race | A is paused and B reuses (`awaiting_charge`). A confirms (`authorized`); B's Continue keeps the live worker. Exactly one hosted worker, one PA call, no page twice, the report completes, one debit, one charge call |
| R1-03 | A3 Regenerate after a failed first charge | First start refused. Regenerate → 402: a prior job is not a prior charge, and the charge was called. Both jobs `charge_refused`, nothing ran. With balance, Regenerate is charged once and completes; a further Regenerate makes no charge call; one debit total |
| R1-04 | A3 Regenerate with an existing authorization | No charge call; the new generation completes; one debit |
| R1-05 | A2 charge succeeded, record write failed | The CAS to `authorized` throws once. Start → `503 CHARGE_UNCONFIRMED`, the pass was debited, the record is still `pending`, no worker, worker entry refused. A start inside the claim window gets `awaiting_charge` with no charge call. After the claim ages, a start reconciles with the same ref: a second ledger call, no second debit, `authorized`, report completes |
| R1-06 | A2 `uncertain` recovery | (a) RPC error after the debit → `uncertain`, nothing runs. A later start with a different `joint_pass_ref` still reconciles the stored ref: one debit. (b) Charge throws before the ledger → `uncertain`. Continue reconciles (the first real debit, once) and dispatches; the report completes |
| R1-07 | A4 two concurrent starts | Both starts are in flight while the first charge is paused. One charge call, one debit, one job; the other start gets `awaiting_charge` or `REPORT_JOB_BUSY`; one hosted worker; completes |
| R1-08 | A2 CAS single claimant | Five concurrent `settleDecisionReportCharge` → one charge call, one `authorized`, four `pending`. A later settle is `authorized` without a call. With `allowNewCharge:false` and no record → `required`, no call |
| R1-09 | A1 all entries | While the charge is pending: `dispatchDecisionReportStage` throws `DecisionReportNotAuthorizedError` without a marker; `ensureDecisionReportWorker` → `CHARGE_NOT_AUTHORIZED`; `runDecisionReportStage` and `runFinalDeliveryStage` for finalize, segments and assemble → nothing. No hosted worker, nothing ran |
| R1-10 | A1 abort before the queued worker | Authorized job, worker queued and not yet started. `abortDecisionReportJob` → the queued task and a direct run do nothing. Grant deleted, marker cleared, job failed, nothing ran |
| R1-11 | A1 defense in depth | Grant revoked while the worker is inside the PA model call. The next `fenceTouch` refuses: analysis not committed, no page, no record, job failed |
| R1-12 | B correct job | The real client driver completes and stores the report; pending id cleared |
| R1-13 | B tampering + refetch | Two completed generations J1 and J2; the device follows J2. Rejected with `REPORT_BINDING_MISMATCH`: (1) J1's whole completed payload; (2) J1's `report_job_id` in payload **and** result; (3) only `result.report_job_id` from J1; (4) one page with J1's `job_id`; (5) J1's generation in payload and result. After each: pending id kept, not delivered, no completed row. Then an untampered refetch completes with J2 |

**Mutation checks** (run on the working tree before the commit, then reverted; output in `temp/`, not committed):
- Client `expected.job_id` taken from `payload.job_id` again → R1-13 fails ("Missing expected rejection: another job's completed payload").
- Reused start dispatching without settling → R1-01, 02, 05 and 06 fail. In those runs the dispatcher grant still refused the job (402 `CHARGE_NOT_AUTHORIZED`), so the inner gates hold even when the route gate is bypassed.

## 6. Existing tests adjusted

These are test-harness changes for the new invariant. No business assertion was relaxed.
- `scripts/test-m5-di2-main-path.ts`:
  - **A6** creates its second generation by calling `service.startDecisionReportJob` directly, below the route. It now grants that job explicitly before running it.
  - **B5** asserts `loadChargeAuthorization(...).state === "authorized"` instead of the removed marker.
- `scripts/test-m3-decision-report.ts`: the M3 suite drives the service and runner directly. Its `start()` helper now settles the session's charge with an always-ok stub and grants the job, which is the route's step after a confirmed charge. Before this change, 10 M3 cases failed with "not authorized — worker refused" on the R1 code.

## 7. Commands (all on `07b29553bb16002c6290a3bb96511fa8cebbb1e4`)

Runner: `temp/_m5r1_run_final.ps1` (suites in parallel, then both `tsc`), followed by `pnpm build`.

| Command | Exit | Result |
|---|---|---|
| `npx tsx scripts/test-m5-r1-authorization.ts` (`pnpm test:m5-r1-authorization`) | 0 | 13 passed, 0 failed |
| `npx tsx scripts/test-m5-di2-main-path.ts` | 0 | 29 passed, 0 failed |
| `npx tsx scripts/test-m4-1-freeze-recovery.ts` | 0 | 10 passed, 0 failed |
| `npx tsx scripts/test-m4-decision-authority.ts` | 0 | 27 passed, 0 failed |
| `npx tsx scripts/test-m3-decision-report.ts` | 0 | 27 passed, 0 failed |
| `npx tsx scripts/test-m2-1-readiness-confirm-freeze.ts` | 0 | 19 passed, 0 failed |
| `npx tsx scripts/test-m2-2-freeze-report-binding.ts` | 0 | 43 passed, 0 failed |
| `npx tsx scripts/test-m2-3-decision-blueprint.ts` | 0 | 18 passed, 0 failed |
| `npx tsx scripts/test-m2-4-r2-production-closure.ts` (test hooks, not a real model) | 0 | PASS=20 FAIL=0 |
| `npx tsx scripts/test-m1-r-fresh-session-main-loop.ts` | 0 | PASS=8 FAIL=0 |
| `npx tsx scripts/test-intake-r6-freeze-versioning.ts` | 0 | all checks passed |
| `npx tsx scripts/test-intake-r6-freeze-authority-regression.ts` | 0 | PASS=8 FAIL=0 |
| `npx tsx scripts/test-intake-r6-freeze-wire-reason.ts` | 0 | passed=25 failed=0 untested=0 |
| `npx tsx scripts/test-intake-r6-freeze-persist-disclose.ts` | 0 | PASS=5 FAIL=0 |
| `npx tsx scripts/test-s7-dc-lifecycle.ts` | 1 | 5 passed, 3 failed. The same three failures as the M5 run on `7b113268` (compared line by line); pre-existing |
| `npx tsc --noEmit -p .` | 0 | |
| `npx tsc --noEmit -p temp/tsconfig.m5r1-scripts.json` (M5 + M5-R1 test files) | 0 | |
| `pnpm build` | 0 | |

**Not run:**
- ESLint: v10 has no flat config in this repo.
- Real OpenRouter.
- Full E2E.
- Browser.

## 8. Not verified (real-environment boundaries)

- **Upstash.** The Lua CAS path for the authorization record: atomicity under real concurrency, and the string form Upstash returns compared with `JSON.stringify` of the read value. The design is the same as the existing M2.2-R5 fence CAS. Grant reads and writes on Upstash were not exercised either.
- **Supabase.** `consume_user_pass` / `consume_household_pass` idempotency and the unique-index behaviour under real concurrent calls (§1 is a code reading). The household path for a joint ref. `getServerUser` cookie availability during a Continue-triggered reconcile.
- **Serverless timing:**
  - a charge call that outlives the 60 s claim window (a second claimant would re-call the same ref, which the ledger deduplicates, but this was not run);
  - Vercel `after()` and the Inngest / QStash relay delivering a worker for an unauthorized job;
  - the deploy kill-switch interacting with grants.
- **TTLs.** Grant TTL (2 h, written at grant time) against a long-lived revivable job. A Continue re-grants a missing grant, and the job wall budget is shorter, but expiry was not simulated.
- **UI.** How the UI shows `CHARGE_UNCONFIRMED` / `CHARGE_PENDING` / `pass_required` for DI2 reports. No component was changed or checked in a browser.
- **Upstash Lua for the job CAS.** It does not refuse `failed → running` the way `MemoryKv.compareAndSetJobGeneration` does (pre-existing). The grant check in `fenceTouch` and at worker entry covers the abort race in this change; the Lua itself was not changed.
- **Client crash recovery.** Server functions replayed in-process are not proof of client crash recovery.
