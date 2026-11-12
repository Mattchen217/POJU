# M5-R1-FU1 — stale charge claim race closure

This is an evidence record for the production change on `feat/m1-r-fresh-session-main-loop`. It does not declare M5-R1, M5-R1-FU1 or Decision Intake 2.0 PASS; it is handed to independent review.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Baseline (M5-R1 evidence tip; local == origin, re-checked with `git fetch` before the commit): `d637d1715c06ef26244e3639d4b61d10c7be6337`. M5-R1 implementation: `07b29553bb16002c6290a3bb96511fa8cebbb1e4`.
- Implementation SHA (all checks in §5 ran on this commit; pushed as a fast-forward of `d637d171`): `2d74bafb70e3b7fb162d2896d1555bee22d72017`
- Evidence tip SHA: _(this commit; left for independent review)_
- No PR opened. Not merged into `main`, not rebased. Nothing deployed or promoted. No force-push.

**What this evidence is not.**
- No real OpenRouter call and no real model output.
- No real Supabase / pass RPC: the charge is the M5-R1 ledger stub (consume RPC semantics), not Supabase validation.
- No Upstash Redis. All KV is process-memory `MemoryKv`; the Upstash Lua CAS branch was not executed. These results are not Upstash validation.
- No real HTTP (route body in-process through a `fetch` stub with a JSON round-trip), no real `after()` / Inngest / QStash, no browser, no full E2E.
- The 60 s claim window was crossed with a controlled clock (`Date.now` shifted), not by waiting; real serverless timing was not exercised.

## 0. Review finding addressed

On `d637d171`, a charge request A whose claim expired and was taken over by request B (same session, same `charge_ref`, new `attempt_id`) could still kill B's job:

1. A's charge call came back refused. Its CAS to `refused` failed (the record was now B's claim), but `chargeUnderClaim` still returned `{ state: "refused" }` for any lost write whose own outcome was a refusal.
2. The start handler aborted the job whenever the settlement was `refused` and the latest record was not `authorized` — B's `pending` qualified.
3. Result: grant revoked, job `failed / charge_refused / retryable:false`, dispatch marker cleared, session lock released, while B was still charging (or about to authorize). B's success then found a dead job.

## 1. How an old `attempt_id` is recognised as stale

- Every claim (first claim, re-claim of an abandoned `pending`, of `refused`, of `uncertain`) writes a new record with a fresh `attempt_id = crypto.randomUUID()` and a new `claimed_at`, by CAS on the exact JSON of the record it replaces. `charge_ref` is copied unchanged.
- A claimant writes its outcome by CAS **expecting the exact JSON of its own claim**. Once B has re-claimed, the stored JSON carries B's `attempt_id` / `claimed_at`, so A's CAS can only fail: A can never overwrite B's `pending`, B's `authorized`, or B's `refused`.
- When the write did not land (CAS false or a throw), `settleLostWrite` re-reads the record and decides only from it:

| Latest record | Settlement returned to this request |
|---|---|
| unreadable (throw) | `uncertain` (`authorization_unreadable`) — fail closed |
| missing | `uncertain` (`authorization_missing_after_charge`) |
| `authorized` (any attempt) | `authorized` — terminal, never downgraded |
| `attempt_id` ≠ this claim's | **`stale_claim`** — this request lost the claim; its own charge outcome decides nothing |
| same `attempt_id`, `refused`, own outcome refused | `refused` (the write landed but was not acknowledged) |
| same `attempt_id`, anything else | `uncertain` (`authorization_write_unconfirmed`) — reconciled later with the same ref |

- `ChargeSettlement` gained `{ state: "stale_claim"; record }`, and `refused` now always carries the record that recorded the refusal (never `null`).
- The start handler treats `stale_claim` like `pending`: `200 { worker: "awaiting_charge" }`, no dispatch, no charge. On Continue it falls into `409 CHARGE_PENDING` (already in the client's poll codes).

## 2. Why a stale request has no abort authority

- Abort authority is `confirmCurrentChargeRefusal(settlement)` (new, `decision-report-charge.ts`). It is true only when **all** of these hold, read fresh from the server record at abort time:
  - the settlement is `refused`;
  - the latest record is `refused`;
  - the latest record's `attempt_id` equals the attempt that recorded the settlement's refusal.
- A stale claimant never gets a `refused` settlement (it gets `stale_claim`, `authorized` or `uncertain`), and even a hand-built refused settlement for an old attempt fails the `attempt_id` comparison.
- A newer `pending` / `uncertain` / `authorized` record, or a record that cannot be read, never confirms a refusal.
- `decision-report-api.ts` start: only a confirmed refusal runs `abortDecisionReportJob` (revoke grant → `failXhighJob(charge_refused, retryable:false)` → clear dispatch marker → release lock) and answers the pass refusal (402). An unconfirmed refusal is downgraded to `uncertain` → `503 CHARGE_UNCONFIRMED` and leaves the job alone; a retry settles against whatever the record then says.
- The old HTTP 402 body and the old settlement object are never enough on their own: the decision is the record, re-read.
- Unchanged from M5-R1: `charge_ref` is fixed at the first claim and reused (no new ref), the ledger is idempotent on it, `authorized` is terminal, and every dispatch / run entry still requires the execution grant.

**Residual window (not closed by this change).** `confirmCurrentChargeRefusal` is a read followed by the abort, not one atomic step. A `refused` record is immediately re-claimable by a new start. If, between the confirmation read and the abort, a third request C re-claims and authorizes, the abort still lands on the job: the job ends `charge_refused` while the session record is `authorized`. Money is safe (C's charge uses the same `charge_ref`, so no second debit), and a new start for the session is free because the record is `authorized`, but the user sees one failed job. Closing it would need the abort conditioned atomically on the record (e.g. a CAS-guarded abort marker); not done here.

## 3. Tests — `pnpm test:m5-r1-fu1`

`scripts/test-m5-r1-authorization.ts` (same harness as M5-R1). Changes to the harness:
- the ledger stub takes each call's gate and mode **on entry**, so they belong to that call even when release order differs; new mode `refuse` (a definite refusal regardless of the ledger, e.g. an expired login);
- `advanceClock(ms)`: `Date.now` runs `DI2_CHARGE_CLAIM_MS + 1 s` ahead only while B's start reaches the charge, then is restored (B's claim stays live afterwards);
- `--only=FU1` label filter; `pnpm test:m5-r1-fu1` = `tsx scripts/test-m5-r1-authorization.ts --only=FU1`. The full suite (`pnpm test:m5-r1-authorization`) runs R1-01..13 plus FU1.

Shared setup (`staleTakeover`): A starts and pauses inside the charge; the clock passes the claim window; B starts on the same Freeze, reuses A's job, re-claims and enters the charge. Asserted every time: B's `attempt_id` ≠ A's, same `charge_ref`, ledger calls `[sid, sid]` (no new ref), same job.

| Case | Scenario | Asserted | Result on `2d74bafb` |
|---|---|---|---|
| FU1-01 | balance 0: A refused while B is still paused | A → `200 awaiting_charge`; record still `pending` with B's `attempt_id`; job not failed, not `charge_refused`; no hosted worker, no dispatch marker, no PA call. Then balance 1, B released → `200 dispatched`; record `authorized` with B's `attempt_id`; grant present; PA record completed; completed report; 8 page records; 1 PA call; no page twice; exactly one debit; one hosted worker | PASS |
| FU1-02 | balance 1, worker queue: B authorizes and dispatches first; A's late answer arrives — run twice, A = `refuse` and A = `ok` | A ≠ 402; record stays `authorized` with B's `attempt_id`; grant not revoked; job not `charge_refused`; the queued (already dispatched) worker then runs and completes the report; 1 PA call; one debit; two ledger calls | PASS (both variants) |
| FU1-03 | balance 0: A refused first, then B refused | After A: `awaiting_charge`, job not failed, record `pending`. B → 402 `pass_required`; record `refused` with B's `attempt_id`; job `failed / charge_refused / retryable:false`; grant gone; marker cleared; workers for finalize / segments / assemble do nothing; Continue → `402 CHARGE_REFUSED`; no hosted worker; zero debits; nothing ran | PASS |
| FU1-04 | A's outcome CAS fails and reading the record throws | A → `503 CHARGE_UNCONFIRMED`; job not failed; no hosted worker, no marker, no grant; worker entry does nothing; record identical to A's claim (same `charge_ref`); ledger calls `[sid]` (no new ref) | PASS |
| FU1-05 (extra) | A's own refusal is written, but the abort-confirmation read throws | `503 CHARGE_UNCONFIRMED`; job not aborted; record `refused`; nothing hosted. A later start re-claims (same ref), is refused, confirmation succeeds → 402, job `charge_refused`, grant gone, nothing ran | PASS |

Run output: `5 passed, 0 failed` (`pnpm test:m5-r1-fu1`); full suite `18 passed, 0 failed`.

**Mutation check** (on the working tree before the commit: production files `decision-report-charge.ts` and `decision-report-api.ts` stashed back to `d637d171`, tests kept; then restored; output `temp/out_m5r1fu1_mut_old.txt`, not committed):
- FU1-01 FAIL — A answered `402 pass_required` (expected 200 `awaiting_charge`), i.e. the old code aborted B's job.
- FU1-03 FAIL — A's stale refusal answered 402 instead of `awaiting_charge`.
- FU1-04 FAIL — 402 instead of 503 (old code turned a lost write + unreadable record into a refusal).
- FU1-05 FAIL — 402 instead of 503.
- FU1-02 PASS on old code too: the old path already re-read an `authorized` record before aborting. It is kept as a regression guard for the terminal state.

## 4. Files

- `lib/poju/decision-intake/decision-report-charge.ts`: `stale_claim` settlement; `refused` carries its record; `settleLostWrite`; `confirmCurrentChargeRefusal`.
- `lib/poju/decision-intake/decision-report-api.ts`: abort only on a confirmed current refusal; unconfirmed refusal → `uncertain`; `stale_claim` follows like `pending`.
- `scripts/test-m5-r1-authorization.ts`: harness changes and FU1-01..05.
- `package.json`: `test:m5-r1-fu1`.

## 5. Commands (all on `2d74bafb70e3b7fb162d2896d1555bee22d72017`)

Runner: `temp/_m5r1fu1_run_final.ps1` (suites in parallel, then both `tsc`), followed by `pnpm build`. Outputs `temp/out_m5r1fu1_final_*` (not committed).

| Command | Exit | Result |
|---|---|---|
| `pnpm test:m5-r1-fu1` | 0 | 5 passed, 0 failed |
| `npx tsx scripts/test-m5-r1-authorization.ts` (R1-01..13 + FU1) | 0 | 18 passed, 0 failed |
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
| `npx tsx scripts/test-s7-dc-lifecycle.ts` | 1 | 5 passed, 3 failed — the same three cases as the M5-R1 run on `07b29553` (compared by name: "Call B maps Agenda → DIR and keeps fingerprint", "Collecting appends unverified fact and never auto-confirms", "Freeze still blocked without Stage3 sufficiency (S5 invariant)"). Pre-existing; untouched, assertions not relaxed |
| `npx tsc --noEmit -p .` | 0 | |
| `npx tsc --noEmit -p temp/tsconfig.m5r1-scripts.json` (M5 + M5-R1 test files) | 0 | |
| `pnpm build` | 0 | |

**Not run:** ESLint (v10, no flat config in this repo); real OpenRouter; full E2E; browser.

## 6. Not verified (real-environment boundaries)

- **Upstash.** The Lua `CAS_EXACT_LUA` path for the stale claimant's failed write and for the re-claim under real concurrency; read-after-write visibility of the confirmation read.
- **Supabase.** Idempotency of the consume RPCs on the shared `charge_ref` when the stale and the current claimant call it concurrently (both charge calls overlap in FU1-01..03; the stub answers `already_consumed` as the RPC is designed to, which is a code reading, not an RPC run).
- **Serverless timing.** A real charge call outliving the 60 s claim window on Vercel; the invoke being killed mid-charge; relay-delivered workers arriving during the race.
- **Residual check-then-act window** in §2 (confirmation read → abort): analysed, not tested, not closed.
- **UI.** How the client surfaces `awaiting_charge` / `CHARGE_UNCONFIRMED` for the stale request; no component changed or checked in a browser.
- **Client crash recovery.** Server functions replayed in-process are not proof of client crash recovery.
