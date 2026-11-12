# M5-R1-FU2 — atomic refusal claim & job abort closure

This is an evidence record for the production change on `feat/m1-r-fresh-session-main-loop`. It does not declare M5-R1, M5-R1-FU2 or Decision Intake 2.0 PASS; it is handed to independent review.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Baseline (FU1 evidence tip; local == origin, re-checked with `git fetch` before the commit): `b29e73ba3cd019b883f05e54ccd3e7648539999e`. FU1 implementation: `2d74bafb70e3b7fb162d2896d1555bee22d72017`.
- Implementation SHA (all checks in §6 ran on this commit; pushed as a fast-forward of `b29e73ba`): `1ca49e5eb046e35d8ab3f2701a0b0053d356618b`
- Evidence tip SHA: _(this commit; left for independent review)_
- No PR opened. Not merged into `main`, not rebased. Nothing deployed or promoted. No force-push.

**What this evidence is not.**
- No real OpenRouter call and no real model output.
- No real Supabase / pass RPC: the charge is the M5-R1 ledger stub (consume RPC semantics), not Supabase validation.
- No Upstash Redis. All KV is process-memory `MemoryKv`; the Upstash Lua CAS branch was not executed. These results are not Upstash validation.
- No real HTTP (route body in-process through a `fetch` stub with a JSON round-trip), no real `after()` / Inngest / QStash, no browser, no full E2E.
- "Process death" is simulated by a test-only step hook that throws between termination steps; claim windows are crossed by shifting `Date.now`, not by waiting.

## 0. Finding closed

FU1 (§2 "Residual window") disclosed: `confirmCurrentChargeRefusal` was a read, followed by an unconditional abort. Between the two, another start could re-claim the `refused` record, charge and authorize; the abort then terminated the job of an `authorized` session.

## 1. State machine (`decision-report-charge.ts`)

```
(none) ─claim─▶ pending ─ok──────▶ authorized                      (terminal)
                   │    ─refused─▶ refused ─abort CAS─▶ abort_claimed ─completion CAS─▶ abort_completed
                   │    ─unknown─▶ uncertain                          (re-claim reconciles)
                   └── stale claim: re-claimable
refused          ─start re-claim (CAS)─▶ pending          (the refusal's abort is then lost)
abort_completed  ─start re-claim (CAS)─▶ pending          (same charge_ref)
abort_claimed    ─✗ no claim, no charge, no run (start / Regenerate / continue)
```

New record fields: `abort_job_id`, `abort_attempt_id` (fresh UUID per abort claim), `abort_claimed_at`, `abort_completed_at` (null until completed). A charge claim resets them to null. `charge_ref` is never changed by any FU2 transition.

| Record state | `settleDecisionReportCharge` start | continue | Job |
|---|---|---|---|
| `refused` (abort not claimed) | re-claim (CAS) + charge, same ref | `refused` → 402 `CHARGE_REFUSED` | not yet terminated |
| `abort_claimed` | **`abort_in_progress`**: no claim, no charge | **`abort_in_progress`** | being terminated (only `abort_job_id`) |
| `abort_completed` | re-claim (CAS) + charge, same ref | `refused` → 402 `CHARGE_REFUSED` | `failed / charge_refused / retryable:false` |

`ChargeSettlement` gained `{ state: "abort_in_progress"; record }`. `settleLostWrite` maps a same-attempt `abort_claimed` to `abort_in_progress` too.

## 2. Refusal → abort right, atomically (`claimDecisionReportRefusalAbort(settlement, job_id)`)

1. Only a `refused` settlement may try.
2. Read the record; it must be `refused`, with the settlement's `attempt_id`, `session_id` and `charge_ref`.
3. CAS on the exact current record → `abort_claimed` with `abort_job_id = job_id`, a new `abort_attempt_id`, `abort_claimed_at = now`, `abort_completed_at = null`.
4. CAS won → `claimed`: this request alone may terminate `job_id`.
5. CAS lost (or threw) → re-read:
   - unreadable → `uncertain` (no abort; the API answers 503 `CHARGE_UNCONFIRMED`, not a refusal);
   - `authorized` → `superseded` (no abort; the request follows the job);
   - another `attempt_id` / `charge_ref` → `stale` (no abort; follows the job);
   - `abort_claimed` → `in_progress`: only that record's `abort_job_id` may be resumed, never the caller's own job;
   - `abort_claimed` with this call's `abort_attempt_id` (write landed, ack lost) → `claimed`.

**Why the two CAS orders are exclusive.** The abort claim and a start's re-claim both CAS against the same exact `refused` JSON. Whichever lands first changes the value, so the other's CAS fails:
- abort claim first → the record is `abort_claimed`; the re-claimer's settle returns `abort_in_progress` (no charge) — FU2-01;
- re-claim first → the record is `pending` under a new `attempt_id`; the abort CAS fails and re-reads `stale` (no abort) — FU2-02.

There is no read-then-act step left between "refusal is current" and "this request owns the abort".

## 3. Abort: resumable and idempotent (`decision-report-service.ts`)

`finishDecisionReportRefusalAbort(claimed)` runs, for `claimed.abort_job_id` only:

| # | Step (hook name) | Idempotence |
|---|---|---|
| 1 | `revoke_grant` — delete the execution grant | delete of a missing key is a no-op |
| 2 | `fail_job` — `failXhighJob(retryable:false, failure_reason:"charge_refused")`, re-read to verify | skipped if already `charge_refused` (or completed / missing); a different session id throws |
| 3 | `clear_dispatch` — delete the dispatch marker | no-op if absent |
| 4 | `release_lock` — delete the session lock | no-op if absent |
| 5 | `mark_completed` — CAS `abort_claimed → abort_completed` on the exact claimed record | lost CAS → re-read: same `abort_attempt_id` + `abort_job_id` already completed counts as done |

The first failing step stops the sequence (no step error is swallowed), so the record stays `abort_claimed` until all four termination steps are done. Re-running from step 1 converges on the same end state.

**Who drives it.**
- The claimant, immediately after winning the CAS.
- While `now − abort_claimed_at < DI2_ABORT_CLAIM_MS` (60 s) the abort stays the claimant's (`held`): other requests answer `409 CHARGE_ABORT_IN_PROGRESS` and touch nothing (FU2-01, FU2-06).
- After that window (the claimant died mid-abort) any `start`, `status` or `continue` resumes the same abort (`resumed`): same `abort_job_id`, same `abort_attempt_id`, no new job, no charge, no dispatch (FU2-03).

**Entry points (`decision-report-api.ts`).**
- `start`: **before `startDecisionReportJob`** (so before any job is created, reused or revived, Regenerate included) the record is read: unreadable → 503; `abort_claimed` → held (409) or resumed (402 `CHARGE_REFUSED` once completed, else 409). Only `none` proceeds. After settlement, a `refused` result goes through the atomic claim; an `abort_in_progress` result (the race in §5) is held / resumed, never charged.
- `continue`: `abort_in_progress` → held / resumed; never re-claimed.
- `status`: resumes an abandoned abort before building the payload (best effort).
- Client: `CHARGE_ABORT_IN_PROGRESS` added to the Continue poll codes.

## 4. Tests — `pnpm test:m5-r1-fu2` (`scripts/test-m5-r1-authorization.ts --only=FU2`)

Harness additions: `__setRefusalAbortStepHookForTests` (pause with a deferred gate, or throw = process death between steps); durable-KV method patches for CAS / read faults and for holding a CAS at a gate; `advanceClock`.

| Case | Scenario | Asserted | Result on `1ca49e5e` |
|---|---|---|---|
| FU2-01 | refusal CAS first: A refused (balance 0), wins `refused → abort_claimed`, paused before step 1; balance set to 1 | record `abort_claimed`, `abort_job_id` = J, `abort_attempt_id` set, `abort_completed_at` null. C's start, C's Regenerate, C's Continue → 409 `CHARGE_ABORT_IN_PROGRESS` (job_id J); status does not take over; record byte-identical; 1 ledger call (no charge); latest job still J (no new job); nothing hosted; J not yet failed. A released → 402; J `failed / charge_refused / retryable:false`; grant, marker, lock gone; `abort_completed` (same `abort_attempt_id`, `abort_completed_at` set); nothing ran. A later start → new job, charged with the same ref, completes; one debit; J stays `charge_refused` | PASS |
| FU2-02 | re-claim CAS first: A refused, reads `refused`, is held at its abort CAS; C (balance 1) re-claims (`pending`, new attempt, same `charge_ref`) and pauses in the charge; A's CAS released | A's CAS returned **false**; A → 200 `awaiting_charge`; J not failed; record still C's. C released → `dispatched`; worker completes: J `completed`, not `charge_refused`; completed report; 8 pages; record `authorized` (C's attempt, no `abort_job_id`); one debit; 1 PA call | PASS |
| FU2-03.1 | crash before `revoke_grant`; resumed by **Regenerate start** | at crash: grant, marker, lock present; job not stamped. Inside window a start is held (record unchanged). After window: 402 `CHARGE_REFUSED` (job_id J); hook saw only J | PASS |
| FU2-03.2 | crash after revoke, before `fail_job`; resumed by **status** | at crash: grant gone; marker, lock present; job not stamped. Status → `failed / charge_refused` | PASS |
| FU2-03.3 | crash after fail, before `clear_dispatch`; resumed by **continue** | at crash: job stamped; marker, lock present. Continue → 402 `CHARGE_REFUSED` | PASS |
| FU2-03.4 | crash after clear, before `release_lock`; resumed by **start** | at crash: marker gone; lock present. Start → 402 | PASS |
| FU2-03.5 | crash after all four steps, before `abort_completed`; resumed by **status** | at crash: everything done, record still `abort_claimed`. Status completes the record | PASS |
| (all FU2-03) | after recovery | only J handled; J `failed / charge_refused / retryable:false`; no grant; no marker; no lock; `abort_completed` with the original `abort_job_id` and `abort_attempt_id`, `abort_completed_at` set; same `charge_ref`; no second job; nothing hosted; no debit; ledger calls `[sid]`; nothing ran | PASS |
| FU2-04 | (a) abort CAS fails + re-read throws; (b) abort claim's first read throws; (c) record unreadable before the start | (a) 503 `CHARGE_UNCONFIRMED` (not a refusal); J not failed; nothing hosted; no grant; record `refused` without `abort_job_id`; same `charge_ref`; ledger `[sid]`; nothing ran. (b) 503; J not failed; record `refused`, no abort. (c) 503 before any job: no job for the session, no charge call, no record | PASS |
| FU2-05 | two concurrent `claimDecisionReportRefusalAbort` on the same refusal with two real jobs of the session (J1, Regenerate J2), both held until both read `refused` and reach the CAS | both reached the CAS; kinds = `claimed` + `in_progress`; the loser sees the winner's `abort_job_id` / `abort_attempt_id`; both finishes concurrently → both ok; record `abort_completed` for the winner's job only; winner's job `charge_refused`; the other job's status and reason unchanged; a third claim → `completed` with the same job (no second abort) | PASS |
| FU2-06 | abandoned abort (crash before `fail_job`) vs new authorization (balance 1) | inside the window start / Regenerate / Continue → 409; status leaves J `pending`; record unchanged; no charge; no new job; nothing hosted. After the window a start resumes: 402, no charge, `abort_completed`. Next start → new job J2, charged once with the same ref, completes; record `authorized`; J stays `charge_refused` | PASS |

Run output: `10 passed, 0 failed` (`pnpm test:m5-r1-fu2`); full suite `28 passed, 0 failed` (R1-01..13, FU1-01..05, FU2-01..06 with FU2-03 ×5).

**Existing assertions changed** (the refusal's terminal state was renamed, the assertions were tightened, not relaxed): R1-01 and FU1-03 asserted `state === "refused"` after a confirmed refusal; they now assert `abort_completed` **and** `abort_job_id === job_id`. FU1-05's label says "abort claim" instead of "abort confirmation"; its assertions are unchanged.

**Mutation checks** (working tree, before the commit; production files backed up and restored byte-identical — hash-checked; outputs `temp/out_m5r1fu2_mut_*.txt`, not committed):

| Mutation | Caught by |
|---|---|
| M1b: abort claim ignores the CAS result (read-check, then abort) | FU2-02 (A terminated the job C was charging for), FU2-04, FU2-05 (`["claimed","claimed"]`) |
| M2: `settleDecisionReportCharge` treats `abort_claimed` as re-claimable | FU2-01 (Continue re-claimed and dispatched), FU2-03.3, FU2-06 (200 instead of 409) |
| M3: start skips the pre-check before `startDecisionReportJob` | FU2-01 ("C created no job" — Regenerate created one), FU2-03.1/.3/.4/.5, FU2-06 |
| M5: step errors swallowed, completion written anyway | FU2-03.1–.5 (402 at the crash instead of 409), FU2-06 |

An earlier M2 run was contaminated (an M1b edit was applied while it ran); it was discarded and both were re-run separately — the table shows the separate runs. A first M1 variant (no CAS at all) failed every case but FU2-02 only on its wait condition, so M1b was added to test the abort authority itself.

## 5. Residual interleavings (not closed; analysed, not tested)

1. **Start passes the pre-check, then the abort is claimed, then the start creates a job.** A Regenerate (or a different Freeze) start that read `refused` before A's abort CAS can still create a new job J2 before its own settlement. Its settlement then returns `abort_in_progress`: no charge, no grant, no dispatch, `409`. J2 stays `pending` without a grant (it cannot run; every run entry requires the grant). After `abort_completed`, a start for the same Freeze reuses J2 and charges it normally; otherwise status marks it `interrupted` after the stale-lease window. No double charge and no execution, but one orphan pending job is possible.
2. **The session lock has no owner.** `release_lock` deletes the session lock unconditionally (as before FU2). In interleaving 1 it can drop the lock J2's create took; only the create window is affected (a concurrent create could then also proceed), not execution or charging.
3. **Abort window.** For up to 60 s after a claimant dies mid-abort, the session answers `409 CHARGE_ABORT_IN_PROGRESS`; recovery needs a later request after that.
4. **Status as a recovery entry** is reachable with a session id and job id only; it can only finish an already-claimed abort for its bound job, never claim, charge or dispatch.
5. **Job writes are not CAS.** `failXhighJob` is read-modify-write; the aborted job never had a valid grant (a refused session was never authorized), so no worker writes to it concurrently.

## 6. Commands (all on `1ca49e5eb046e35d8ab3f2701a0b0053d356618b`)

Runner: `temp/_m5r1fu2_run_final.ps1` (suites and both subsets in parallel, then both `tsc`), followed by `pnpm build`. Outputs `temp/out_m5r1fu2_final_*` (not committed).

| Command | Exit | Result |
|---|---|---|
| `pnpm test:m5-r1-fu2` | 0 | 10 passed, 0 failed |
| `pnpm test:m5-r1-fu1` | 0 | 5 passed, 0 failed |
| `npx tsx scripts/test-m5-r1-authorization.ts` (R1 + FU1 + FU2) | 0 | 28 passed, 0 failed |
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
| `npx tsx scripts/test-s7-dc-lifecycle.ts` | 1 | 5 passed, 3 failed — the same three cases as the FU1 run on `2d74bafb` (compared by name: "Call B maps Agenda → DIR and keeps fingerprint", "Collecting appends unverified fact and never auto-confirms", "Freeze still blocked without Stage3 sufficiency (S5 invariant)"). Pre-existing; untouched |
| `npx tsc --noEmit -p .` | 0 | |
| `npx tsc --noEmit -p temp/tsconfig.m5r1-scripts.json` (M5 + M5-R1 test files) | 0 | |
| `pnpm build` | 0 | |

**Not run:** ESLint (v10, no flat config in this repo); real OpenRouter; full E2E; browser.

## 7. Not verified (real-environment boundaries)

- **Upstash.** `CAS_EXACT_LUA` for `refused → abort_claimed`, `abort_claimed → abort_completed` and the competing re-claim under real concurrency; the exactness of the JSON comparison against Upstash's stored string.
- **Supabase.** Same-ref re-charge after `abort_completed` (`already_consumed` semantics are the stub's, from a code reading).
- **Serverless.** A real invoke killed between termination steps; the 60 s abort window against real request timing; relay-delivered workers during an abort.
- **UI.** How the client surfaces `CHARGE_ABORT_IN_PROGRESS` on start (a retryable error) and on Continue (keeps polling); no component changed or checked in a browser.
- **Client crash recovery.** Server functions replayed in-process are not proof of client crash recovery.
