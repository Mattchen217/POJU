# M5-R1-FU3 — serialized report start, refusal abort & lock ownership

This is an evidence record for the production change on `feat/m1-r-fresh-session-main-loop`. It does not declare M5-R1-FU3, M5-R1 or Decision Intake 2.0 PASS; it is handed to independent review.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Baseline (FU2 evidence tip): `4f29075f0acbf58ec0fdb4c6fede4183d450edda`. Between the baseline and this work sits one unrelated build fix, `04f3509cdf555a7ee046362ad242f00852b576c7` (`next.config.mjs`: webpack build worker re-enabled after a Vercel OOM; no runtime code). Remote tip before the push: `04f3509c` (re-checked with `git fetch`).
- Implementation SHA (all checks in §7 and the mutations in §6 ran on this commit; pushed as a fast-forward): `ff70447117dc92309f9462421e616940674da0a2`
- Evidence tip SHA: _(this commit; left for independent review)_
- No PR opened. Not merged into `main`, not rebased. Nothing deployed or promoted. No force-push.

**What this evidence is not.**
- No real OpenRouter call and no real model output (test hooks only).
- No real Supabase / pass RPC: the charge is the M5-R1 ledger stub, not Supabase validation.
- No Upstash Redis. All KV is process-memory `MemoryKv`; the Lua CAS / compare-and-delete branch of the new lock module was never executed. These results are not Upstash validation.
- No real HTTP, `after()`, Inngest or QStash; no browser; no full E2E. The route body runs in-process behind a `fetch` stub with a JSON round-trip.
- Interleavings are produced by deferred gates at hook points inside the production start path (§5); "process death" is a hook that throws; time windows are crossed by shifting `Date.now`, never by waiting.

## 0. Findings closed

FU2 (§5 "Residual interleavings") disclosed two gaps:

1. **Pre-check before the lock.** `start` read the authorization record (no unfinished abort) and only then entered `startDecisionReportJob`, which took the session lock and created a job. A start that passed the pre-check, then waited, could create a job after another request had claimed the refusal abort → orphan pending job.
2. **Ownerless lock.** The session lock value was a bare timestamp and `releaseXhighSessionLock` deleted it unconditionally. A delayed cleanup (abort `release_lock` step, runner end, relay stop, stale status) could delete a lock a later start or job had taken, reopening the create window for a third request.

## 1. Lock record (`lib/poju/decision-intake/decision-report-lock.ts`, new)

Same key as before (`poju-xhigh:lock:decision_report:<session_id>`), new value:

```
{ version: 1, session_id, lock_token, owner_attempt_id,
  holder: "start" | "job", job_id | null, created_at, touched_at }
```

| Operation | Rule |
|---|---|
| create | `SET NX` with the existing lock TTL |
| touch / bind job / hand off | read, verify `session_id + lock_token + owner_attempt_id`, CAS on the exact value read (refreshes `touched_at`); not owned → `null` |
| `releaseOwnedReportLock(owner)` | read, verify owner, compare-and-delete on the exact value; otherwise `not_owner` / `absent` |
| `releaseReportJobLock(session, job)` | deletes only `holder === "job" && job_id === job`; any start lock (even one bound to that job before hand-off) and any later lock → `not_owner` |
| takeover | CAS on the exact value read; two takers are exclusive |
| read failure | throws (callers fail closed) |
| unrecognised value | `invalid` → never overwritten or deleted; start answers 503 `REPORT_LOCK_UNCONFIRMED` |

Atomic primitives: `MemoryKv.compareAndSetExact` / new `MemoryKv.compareAndDeleteExact`; on Redis the module falls back to two Lua scripts (`GET` + compare raw string + `SET … EX` / `DEL`). With neither available it throws `ReportLockUnavailableError` — no plain delete fallback exists.

**When a lock may be taken over** (`acquireDecisionReportStartLock`):
- `holder: "start"` untouched for `REPORT_START_LOCK_IDLE_MS` (60 s, the same window as an abandoned charge claim) → its request is presumed dead. Inside the window a second start only **observes** (read-only reply: `awaiting_charge` for a live job of the same Freeze, the abort reply if an abort owns the session, else 409 `REPORT_JOB_BUSY`). No request waits 60 s.
- `holder: "job"`: a live job of the same Freeze that is the session's latest → **follow** (no charge, no new job); Regenerate / another Freeze → takeover (the generation fence then supersedes the old job, as before FU3); job terminal or missing → takeover.
- Legacy bare-timestamp value (written before FU3): live latest job → treated as that job's lock; otherwise busy for `LEGACY_REPORT_LOCK_ORPHAN_MS` (2 min), then takeover.

The generic `acquireXhighSessionLock` / `releaseXhighSessionLock` API is unchanged and still used by `final_delivery`; no report path calls it any more. `reclaimStaleXhighSessionLock` (report-only) was removed.

## 2. Start ordering (`decision-report-api.ts` `startAction` → `lockedStart`)

```
plan (read-only receipt / Freeze verification)
→ acquire lock ─ unconfirmed → 503 REPORT_LOCK_UNCONFIRMED (no job, no charge)
                busy → 409 · observe → read-only · follow → authorized live job
→ [under the lock] authorization pre-check: unfinished abort → held (409) / resumed (402);
                unreadable → 503; release own lock
→ create / reuse job: owner touch-verified before the generation bump; job bound to the lock
                after creation; lost lock → the new job is failed, 409 REPORT_JOB_BUSY
→ settle charge
   refused → owner touch-verify (lost → 503 CHARGE_UNCONFIRMED "lock_owner_unconfirmed",
                touch nothing) → abort claim binds lock_token + owner_attempt_id
                → claimed: the abort owns the lock and its release_lock step frees it
                → in_progress / completed / abort_in_progress: abandon own new job
                  (grant revoked, failed charge_refused, marker cleared), release own lock
   pending / stale → release own lock, 200 awaiting_charge
   authorized → hand the lock to the job (holder "job", CAS) → grant → dispatch
                hand-off lost → 200 worker "none": no grant, no dispatch, lock not deleted
→ any exception: release own lock unless already handed off
```

The pre-check that FU2 ran before `startDecisionReportJob` is gone from that position; it now runs only after the lock is held (FU3-03 records the hook order). While a record is `abort_claimed`, no start or Regenerate gets past the pre-check, so none creates, reuses, advances, charges or dispatches.

`startDecisionReportJob` (service) composes the same plan → lock → pre-check → create/reuse sequence. It is not called by the API any more; it remains for the M3 / M4 / M4.1 / M5 suites, and it hands the lock to a live job without a charge (those suites authorize separately).

## 3. Abort ownership and recovery (`decision-report-charge.ts`, `decision-report-service.ts`)

New record fields: `abort_lock_token`, `abort_lock_owner_attempt_id` (the claimant's lock identity), `abort_resumer_id`, `abort_resumed_at`; all reset on a new charge claim.

- **Claimant.** Claims only while it still owns the start lock (touch-verified just before the CAS). The termination steps run for `abort_job_id` only: `revoke_grant` → `fail_job` → `clear_dispatch` → `release_lock` → completion CAS (`mark_completed`). `release_lock` is `releaseOwnedReportLock(abort lock identity)`; a pre-FU3 abort record (no lock identity) releases nothing.
- **Within 60 s** of `max(abort_claimed_at, abort_resumed_at)` only the claimant (or the current resumer) acts; everyone else gets `held` and touches nothing.
- **After 60 s** a resumer must first win the **resume right**: CAS on the exact `abort_claimed` record writing a fresh `abort_resumer_id` / `abort_resumed_at`. Lost → re-read: still claimed → `held`; completed for the same `abort_attempt_id` + `abort_job_id` → `completed`; otherwise `none`. CAS or re-read failure → `unreadable` (503 on start, no step run). Only the winner runs the steps.
- A resumer's `release_lock` deletes only the abort's own lock (it inherits that identity from the record); a lock taken by any later start or job is `not_owner` and stays.
- `abort_completed` is written only by the completion CAS after all four steps; the first failing step stops the sequence (no step error is swallowed), so every boundary is resumable.
- `abortDecisionReportJob` (stale / superseded job cleanup) releases only the lock bound to its own job.

Job-lifetime release sites now all use `releaseReportJobLock(session_id, job_id)`: runner relay end, dispatch background catch, FD stage runner (decision-report deploy-supersede branch), Inngest continue function and the continue route (`decision_report` branch; `final_delivery` keeps the generic release), stale status. **Continue** acquires the lock as `holder: "job"` and takes over only its own leftover lock, an idle start lock, a terminal / missing job's lock or an aged legacy lock; on a failed revive it releases only its own lock.

## 4. Residual interleavings (not closed; analysed, partly tested)

1. **A start that stalls longer than 60 s inside its window** (for example a charge RPC that hangs) can have its lock taken over. It then fails closed at its next owner check: a refusal is not claimed (503 `CHARGE_UNCONFIRMED`, `lock_owner_unconfirmed`), an authorization is not dispatched (200 `worker: "none"`). The pending / paid job is carried on by the next start that reuses it (FU3-07 b2 and c). The user-visible cost is one retry; no double charge, no orphan that can run.
2. **A stalls longer than 60 s between its owner touch and its abort CAS.** A second start can take the lock and settle the same `refused` record. Both write by CAS against the same exact value, so exactly one wins (the FU2-02 CAS race, still covered). If A wins, the second start sees `abort_in_progress`, abandons its own new job and releases its own lock; A's `release_lock` step then finds `not_owner` and deletes nothing. If the second start wins, A's claim reads `stale` and follows. Not closed by the lock alone; closed by the record CAS.
3. **60 s abort window.** After a claimant dies mid-abort the session answers 409 `CHARGE_ABORT_IN_PROGRESS` until a later request (start / status / continue) takes the resume right after the window.
4. **Lock TTL.** The lock keeps the existing `POJU_XHIGH_LOCK` TTL (not lengthened). A lock that expires while its holder is alive behaves like case 1 (the holder's next owner check fails closed).
5. **Job writes are not CAS** (unchanged from FU2): `failXhighJob` is read-modify-write; the aborted or abandoned job never had a valid grant, so no worker writes to it concurrently.

## 5. Tests — `pnpm test:m5-r1-fu3` (`scripts/test-m5-r1-authorization.ts --only=FU3`)

**Gates.** `__setReportStartHookForTests` is called by the production start path at `before_lock`, `after_lock`, `precheck`, `before_create`, `after_create`, `before_settle`, `before_handoff` and `before_resume_claim`. The test registers a deferred gate per point; the next request reaching it records its `owner_attempt_id` and waits until released. Abort steps are paused / crashed with the FU2 step hook; charges are held with ledger gates; KV faults are injected per key.

**Every case asserts:** final authorization state; `abort_job_id` / `abort_attempt_id`; current lock owner (`readReportSessionLock`); every job of the session (count, status, `failure_reason`, grant present, dispatch marker present); ledger calls and actual debits; hosted workers (`bg.hosted`); worker execution (`analysisCalls`); no `pending` / `running` job left at the end.

| Case | Interleaving | Asserted | Result on `ff704471` |
|---|---|---|---|
| FU3-01 (a) | B planned and gated at `before_lock`; A runs to a refusal and its abort completes (402, `abort_completed` for JA); balance 1; B released | lock free after A; B → 200, new JB, re-charged with the same `charge_ref`; JA `failed / charge_refused`, no grant, no marker; JB `completed`; record `authorized`, abort fields reset; ledger `[sid, sid]`, debits `[sid]`; one worker; lock released; no live job | PASS |
| FU3-01 (b) | B gated at `before_lock`; A refused, claimed, paused before `clear_dispatch`; B released | record `abort_claimed` bound to A's `lock_token` / `owner_attempt_id`; B → 409 `CHARGE_ABORT_IN_PROGRESS`, A's lock unchanged, no B job, no charge. A finishes → `abort_completed` (same job, same `abort_attempt_id`); one job, terminated; lock free; no debit; nothing hosted or run | PASS |
| FU3-02 (a) | abort crashed before `release_lock` (A0's lock left); after 60 s B takes over and is gated at `after_lock`; status resumes the abort | B owns the lock (`holder: start`); recovery hook saw only J0; B's lock byte-identical afterwards; `abort_completed` with original `abort_job_id` / `abort_attempt_id`; no job created, no charge by recovery. B released → completes; debits `[sid]`; one worker | PASS |
| FU3-02 (b) | abort crashed before `fail_job`; after 60 s, late resumer A gated at `before_resume_claim`; C (status) takes the resume right and completes; B gated at `before_create`; A released | A ran no termination step; B's lock intact; one job; record bound to the original abort; B completes, one debit | PASS |
| FU3-03 | A inside its charge (record `pending`); B (Regenerate) gated at `before_lock` — the point where the FU2 pre-check had already passed; A refused, abort paused before `mark_completed` (lock already released); B released | B → 409 `CHARGE_ABORT_IN_PROGRESS`; B's trace: `after_lock` before `precheck`, never `before_create`; B released its own lock; only JA, terminated; `abort_completed` for JA; ledger `[sid]`, no debit; nothing hosted or run | PASS |
| FU3-04 | A's J1 completes and its job lock is released; B (Regenerate) holds a new lock at `before_create`; A's delayed cleanups run | `releaseOwnedReportLock(A)` → `not_owner`; `releaseReportJobLock(J1)` → `not_owner`; runner on J1, `abortDecisionReportJob(J1)`, status on J1 → B's lock byte-identical. B completes; J1 / J2 `completed`; ledger `[sid]` (Regenerate free), one debit; two workers | PASS |
| FU3-05 | two starts gated at `before_lock`, released together; for start×start and Regenerate×Regenerate | loser → 409 `REPORT_JOB_BUSY` or `awaiting_charge`; the lock owner is one of the two; one job while charging; one distinct `job_id`; one completed job; one charge call, one debit, one worker | PASS |
| FU3-06 ×6 | abort dies before `revoke_grant` / `fail_job` / `clear_dispatch` / `release_lock` / `mark_completed`, or the completion CAS throws; after 60 s B takes over (gated at `after_lock`); status recovers | lock present at the crash iff the crash precedes `release_lock`; recovery touched only J0; B's lock byte-identical; `abort_completed`, original `abort_job_id` / `abort_attempt_id` / `abort_lock_token`; no job created by recovery; B completes; J0 failed, no grant, no marker; ledger `[sid, sid]`, debits `[sid]` | 6 × PASS |
| FU3-07 | (a1) lock NX write throws; (a2) lock read throws; (b1) idle start lock but takeover CAS always lost; (b2) authorized, hand-off CAS lost; (c) A's lock replaced during its charge, then refused; direct releases with a foreign owner / job; (d) resume-right CAS throws and the re-read throws | (a1) 503 `REPORT_LOCK_UNCONFIRMED`, no job, no record, no charge call. (a2) 503, unreadable lock left as is, no job, no charge. (b1) 409, lock value unchanged, no job, no charge. (b2) 200 `worker: none`, job pending without grant or marker, nothing hosted or run, lock not deleted; a later start (after 60 s) carries the same job on without a second debit. (c) 503 `CHARGE_UNCONFIRMED`; foreign lock intact; record `refused`, no abort fields; job pending without grant / marker; nothing hosted; foreign-owner and foreign-job releases → `not_owner`; next start reuses the job and claims the refusal (402), no live job left. (d) status and continue (503): no termination step, the abort's lock untouched, record unchanged, one job, one charge call, nothing run | PASS |
| FU3-08 | after `abort_completed`, start then Regenerate | start: lock handed to J1 (`holder: job`), grant present, released by J1's end; Regenerate: lock handed to J2, released by J2's end; J0 `charge_refused`, J1 / J2 `completed`; record `authorized`, same `charge_ref`, abort fields reset; ledger `[sid, sid]` (refused once, charged once, Regenerate free), debits `[sid]`; two workers; analysis reused (one call); fence authorizes only J2; lock free; no live job | PASS |

Run output: `13 passed, 0 failed` (`pnpm test:m5-r1-fu3`); full suite `41 passed, 0 failed` (R1-01..13, FU1-01..05, FU2-01..06 with FU2-03 ×5, FU3-01..08 with FU3-06 ×6).

**Existing tests changed (deliberate semantic changes, not hidden failures).**
- **FU2-02** (re-claim wins the abort CAS). Under FU2, C's start re-claimed the `refused` record while A sat at its abort CAS inside its own start. FU3 makes that impossible inside A's lock window, and the original test failed on its wait ("C re-claimed …") on the uncommitted FU3 code. The test now first asserts the new behaviour (a start C0 inside A's window gets 200 `awaiting_charge`, no second charge call), then crosses the 60 s idle window with `advanceClock` so C takes the lock over and re-claims — the residual race of §4.2. All original FU2-02 assertions after that point are unchanged.
- **FU2-05** calls `claimDecisionReportRefusalAbort` directly; the function now requires the claimant's lock identity as a third argument, so both calls pass `newReportLockOwner(session_id)`. Assertions unchanged.

## 6. Mutation checks (on `ff704471`, sequential)

Each mutation was applied to the committed sources by exact-string replacement (`temp/_fu3_mutate.cjs`, aborts unless the target matches exactly once), the full M5-R1 suite was run, and the files were restored with `git checkout`; after the last run `git status` showed the three source files clean. Mutations ran one at a time, never alongside another test run. Outputs `temp/out_m5r1fu3_mut_*.txt` (not committed).

| Mutation | Full suite | Killed by |
|---|---|---|
| M1 FU2 timing: abort pre-check before the lock, none under it | 33 / 8 | FU3-03 (B created a job after the abort claim), FU3-02, FU3-06 ×6 |
| M2 owner-unchecked release (`releaseOwnedReportLock` deletes any owned lock) | 29 / 12 | FU3-02, FU3-04, FU3-06 ×6, FU3-07, plus FU1-01, FU1-03, FU2-02 |
| M3 resume without the resume-right CAS | 39 / 2 | FU3-02 (late resumer ran steps), FU3-07 (steps ran with the right unconfirmed) |
| M4 `releaseReportJobLock` ignores `holder` / `job_id` | 39 / 2 | FU3-04 (A's job cleanup deleted B's lock), FU3-07 |
| M5 dispatch although the hand-off CAS was lost | 39 / 2 | FU3-07 (`worker` was not `none`). The FU3-08 failure in this run is a knock-on: FU3-07 aborted mid-check with a mutated background worker still in flight, which added an analysis call during FU3-08; it is not counted as an independent kill |
| M6 refusal claims the abort without the owner touch-verify | 40 / 1 | FU3-07 (c) |

## 7. Commands (all on `ff70447117dc92309f9462421e616940674da0a2`)

Runner `temp/_m5r1fu3_run_final.ps1` (suites and the fu1 / fu2 / fu3 subsets in parallel, then both `tsc`), followed by `pnpm build`. Outputs `temp/out_m5r1fu3_final_*` (not committed).

| Command | Exit | Result |
|---|---|---|
| `pnpm test:m5-r1-fu3` | 0 | 13 passed, 0 failed |
| `pnpm test:m5-r1-fu2` | 0 | 10 passed, 0 failed |
| `pnpm test:m5-r1-fu1` | 0 | 5 passed, 0 failed |
| `npx tsx scripts/test-m5-r1-authorization.ts` (R1 + FU1 + FU2 + FU3) | 0 | 41 passed, 0 failed |
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
| `npx tsx scripts/test-s7-dc-lifecycle.ts` | 1 | 5 passed, 3 failed — the same three cases as the FU2 run on `1ca49e5e`, compared by name: "Call B maps Agenda → DIR and keeps fingerprint", "Collecting appends unverified fact and never auto-confirms", "Freeze still blocked without Stage3 sufficiency (S5 invariant)". Pre-existing; no assertion touched |
| `npx tsc --noEmit -p .` | 0 | |
| `npx tsc --noEmit -p temp/tsconfig.m5r1-scripts.json` (M5 + M5-R1 test files) | 0 | |
| `pnpm build` | 0 | |

**Not run:** ESLint (v10, no flat config in this repo); real OpenRouter; full E2E; browser.

## 8. Validation boundaries

- **MemoryKv (what was run).** Every lock and record transition above ran against process-memory `MemoryKv` (`compareAndSetExact`, `compareAndDeleteExact`, `SET NX`), single Node process, real `async` interleavings via gates.
- **Upstash (not verified).** The lock module's Redis branch (`CAS_SET_LUA`, `CAS_DEL_LUA` through `eval`) and `SET NX` return values were never executed. Unverified in particular: that the raw string Upstash stores equals `JSON.stringify` of the value the client returned on read (the CAS compares strings); atomicity under real concurrent invocations; behaviour on Upstash timeouts (the code throws and the caller fails closed, but the real error shapes were not exercised).
- **Supabase (not verified).** Same-ref re-charge after `abort_completed` and "no double debit" rest on the ledger stub's consume semantics, not on the real pass RPC.
- **Serverless (not verified).** Real invokes killed mid-window or mid-abort; the 60 s idle / abort windows against real request durations and the lock TTL; relay- or Inngest-delivered workers releasing via `releaseReportJobLock`; legacy bare-timestamp locks left by a deployment that predates FU3.
- **UI / client.** No component changed. How the client surfaces the new 503 `REPORT_LOCK_UNCONFIRMED` (and `CHARGE_UNCONFIRMED` with `lock_owner_unconfirmed`) was not checked in a browser; server functions replayed in-process are not evidence of client crash recovery.
