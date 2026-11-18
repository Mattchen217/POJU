# M9-R1-FU1-FU2 Ledger Integrity Atomic Binding

Date recorded: 2026-11-18 (America/Chicago). Local verification completed at 2026-11-18 04:57:29 -0600 (America/Chicago).

This directory records the local verification run for the M9-R1-FU1-FU2 Decision Authority Ledger integrity and Redis atomic Intake binding remediation on branch `feat/m1-r-fresh-session-main-loop`.

Git baseline:

- Review baseline / parent SHA: `e2a0c22415e03bfd110cf75b196cf6f38d6a9a21` (M9-R1-FU1 evidence; implementation parent `b4081335892005d30f8818eae957f324d12f64ba`)
- Implementation SHA: `a9ae8294e2b51efc3ec3f99c4195f7f7d1e521e6`

The evidence SHA is not written in this file, to avoid a self-referential tip SHA. It is the commit that adds this directory.

This file does not declare M9 or Decision Intake 2.0 accepted. It is a verification record for independent review.

## Changed files (implementation commit)

Modified:

- `lib/poju/session-authority/store.ts`
- `lib/poju/session-authority/lifecycle.ts`
- `lib/poju/session-authority/types.ts`
- `package.json` (adds `test:m9-r1-fu1-fu2-ledger-integrity-atomic-binding`)
- `scripts/test-m9-r1-fu1-redis-lua-integrity-parity.ts` (ledger fixtures now include canonical `entry_hash` and valid chain fields; harness gained `getRaw`)
- `scripts/test-m9-r1-session-authority-remediation.ts` (Freeze fixture now includes canonical `entry_hash` and valid chain fields; harness gained `getRaw`)

Added:

- `scripts/test-m9-r1-fu1-fu2-ledger-integrity-atomic-binding.ts`

`public/sw.js` was rewritten by `pnpm build` and then restored to its pre-build bytes. It was left unstaged and is not in either commit.

- Pre-build SHA-256: `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980` (139053 bytes)
- Post-build SHA-256: `c76b9c03326bef54501a07596e1768bee3f6418fc1d7570a24c4e78e414ab183` (rewritten file was not retained after restore)
- Working tree restored to the pre-build bytes after the successful build.

## Exact integrity and race mechanism

The production intake CAS must not accept a Ledger Entry solely because `session_id` and `commit_version` match.

1. TypeScript reads the authoritative Ledger snapshot needed for the bounded Freeze probe (`collectLedgerBindingSnapshot()` in `lib/poju/session-authority/store.ts`). The snapshot includes the head hint and every entry from genesis (commit 1) through the effective head, not only the hint entry. The head hint remains a hint.

2. TypeScript validates each consumed entry with the existing `canonicalHash` implementation from `lib/poju/decision-authority/hash.ts`. Required checks include valid JSON, required schema fields and types, session identity, `commit_version`, `previous_commit_version`, `previous_entry_hash`, `change_type`, `dc_status`, and `entry_hash`. The chain is walked so integrity is not claimed merely because the last entry's hash matches.

3. On the production Redis / `kv.eval` path, `runLuaSessionCas()` passes those exact raw validated Ledger values and probe metadata into `SESSION_AUTHORITY_CAS_LUA`.

4. Lua compares the current Redis raw `GET` bytes against those exact validated raw values inside the atomic script. Lua does not recompute JavaScript `canonicalHash` or `entry_hash`.

5. If any validated raw value changed between validation and EVAL, the commit is rejected with `ledger_snapshot_changed` (Lua code 10). The changed entry is not treated as a valid non-Freeze head.

6. If a new Ledger entry appeared after the validation snapshot (`endVersion + 1` is now occupied, or the hint raw changed), the commit is rejected with `ledger_snapshot_changed`. The script never proceeds on an incomplete validated snapshot. A later retry re-reads, re-validates, and will see a new Freeze as frozen.

7. Session revision CAS and all existing lifecycle checks are preserved and still run in the same Lua script before the ledger binding decision.

8. MemoryKv uses the same hash and chain checks inside its synchronous CAS section (`probeSameKvLedger()`). There is no pre-validation-to-commit window on that path.

Missing entries, malformed entries, invalid hashes, invalid chains, inconsistent or concealing hints, and probe-limit exhaustion fail closed (`ledger_integrity` or `ledger_probe_incomplete`). A ledger integrity failure is never mapped to an ordinary revision conflict, a missing ledger, "not frozen," or a successful Intake. `commitAuthoritativeSessionUpdate()` maps `ledger_snapshot_changed` to an explicit recoverable Session Authority error.

NX-write semantics and the ledger schema are unchanged. This change does not rewrite append-only ledger history.

## Real Redis / Lua execution

Real Redis/Lua was not executed. This machine had no `redis-cli`, no `redis-server`, no `REDIS_URL`, and the Docker daemon was not running. No Upstash / KV credentials were present, and none were added. `SESSION_AUTHORITY_CAS_LUA` remains unexecuted in a real Redis server.

This record does not claim that production Redis or production Lua passed.

The Redis eval contract harness asserts that `createKvSessionAuthorityStore()` calls `kv.eval` with the exact production Lua source and the validated raw snapshot, then applies the shared TypeScript raw-binding predicate. That harness is not a Redis server and is not a Lua VM. Static Lua source assertions are not execution evidence.

## Regression cases (A-R)

Unless noted, cases ran on both the MemoryKv production adapter (TypeScript/MemoryKv atomic path) and the Redis eval contract harness (not Lua execution).

- A. Valid Freeze entry: Intake rejected.
- B. Valid non-Freeze entry: Intake eligible.
- C. Freeze entry with corrupted `change_type` but original `entry_hash`: rejected as `ledger_integrity`.
- D. Freeze entry with corrupted `dc_status` but original `entry_hash`: rejected as `ledger_integrity`.
- E. Corrupted `entry_hash`: rejected as `ledger_integrity`.
- F. Incorrect `previous_entry_hash` (own hash still valid): rejected as `ledger_integrity`.
- G. Missing intermediate Ledger entry: fail closed as `ledger_integrity`.
- H. Invalid `commit_version` sequence: fail closed as `ledger_integrity`.
- I. Invalid head hint that conceals an entry: fail closed as `ledger_integrity`.
- J. Validated raw entry changes between pre-validation and EVAL: CAS rejects with `ledger_snapshot_changed` (harness only; MemoryKv has no such window).
- K. New entry appears between pre-validation and EVAL: CAS rejects with `ledger_snapshot_changed` (harness only).
- L. New Freeze entry races Intake commit: Intake is not accepted (harness returned `ledger_snapshot_changed`; Freeze is not silently missed).
- M. Probe limit exhaustion: fail closed as `ledger_probe_incomplete`.
- N. No Ledger genuinely exists: Intake remains eligible, consistent with existing policy.
- O. Existing Session integrity failures remain rejected (`malformed`).
- P. Existing Session lifecycle and revision conflicts remain correct (`cas_conflict`, `expired`, `frozen`, `terminated`).
- Q. Same-content idempotency remains successful without rerunning the model.
- R. Different-content idempotency still returns `session_turn_conflict`.
- S. Existing M9, M9-R1, and FU1 regressions passed in this run (`pnpm test:m9-server-authoritative-session`, `pnpm test:m9-r1-session-authority-remediation`, `pnpm test:m9-r1-fu1-redis-lua-integrity-parity`, all exit 0).

## Remaining limitations

- `SESSION_AUTHORITY_CAS_LUA` was not executed against a real Redis server or Lua VM.
- Lua still does not recompute JavaScript `canonicalHash`. Integrity of ledger hashes is established in TypeScript and bound atomically by exact raw-value comparison.
- If Session store and Decision Authority ledger are not the same KV, the same-KV probe cannot see Freeze. The production path `createKvSessionAuthorityStore(durableKv())` still shares `durableKv()` with the ledger.
- Real OpenRouter, paid report generation, billing / Pass consumption, deployment, and browser LAB were not run.

## Command results

All required commands exited 0. See `command-exit-codes.json` for exact commands, exit codes, durations, log paths, and the implementation SHA. Each log file in this directory is the raw captured output of that command.
