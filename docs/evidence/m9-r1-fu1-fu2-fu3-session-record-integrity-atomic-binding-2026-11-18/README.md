# M9-R1-FU1-FU2-FU3 Session Record Integrity Atomic Binding

Date recorded: 2026-11-18 (America/Chicago). Local verification completed at 2026-11-18 05:44:25 -0600 (America/Chicago).

This directory records the local verification run for the M9-R1-FU1-FU2-FU3 Session Record integrity and Redis atomic binding remediation on branch `feat/m1-r-fresh-session-main-loop`.

Git baseline:

- Review baseline / parent SHA: `e20d187381e2e6a53b821e2e9cfa94f2ad3fdd2c` (M9-R1-FU1-FU2 evidence; implementation parent `a9ae8294e2b51efc3ec3f99c4195f7f7d1e521e6`)
- Implementation SHA: `c9a318a64f5f570df1f903fb3d128d5486b43c2f`

The evidence SHA is not written in this file, to avoid a self-referential tip SHA. It is the commit that adds this directory.

This file does not declare FU3, M9, M9-R1, or Decision Intake 2.0 accepted. It is a verification record for independent review.

## Changed files (implementation commit)

Modified:

- `lib/poju/session-authority/store.ts`
- `lib/poju/session-authority/lifecycle.ts`
- `lib/poju/session-authority/types.ts`
- `package.json` (adds `test:m9-r1-fu1-fu2-fu3-session-record-integrity-atomic-binding`)

Added:

- `scripts/test-m9-r1-fu1-fu2-fu3-session-record-integrity-atomic-binding.ts`

`public/sw.js` was rewritten by `pnpm build` and then restored to its pre-build bytes. It was left unstaged and is not in either commit.

- Pre-build SHA-256: `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980` (139053 bytes)
- Post-build SHA-256: `ace867afa06129915a7c47cc95d3555415b46139b0331ea8eb00913d5872bcfd` (139220 bytes; rewritten file was not retained after restore)
- Working tree restored to the pre-build bytes after the successful build.

## Exact Session Record raw-binding mechanism

FU2 already bound the TypeScript-validated Ledger raw snapshot to Redis Lua using exact raw-value comparison. FU3 applies the same atomic-binding principle to the current Session Record. The Session Record schema and `canonicalHash` algorithm are unchanged.

1. On the production Redis / `kv.eval` path, `runLuaSessionCas()` reads the current Session Record as its original raw Redis value through `readRawKvValues()` (`getRaw` when present, otherwise `SESSION_AUTHORITY_RAW_MGET_LUA`). It does not reconstruct the value with `JSON.stringify()` after parsing.

2. TypeScript validates that exact raw value with the existing `inspectStoredSessionRecord(sessionId, raw)`, which still uses `canonicalHash` for `snapshot_hash` / Snapshot integrity, plus schema, identity, and revision checks.

3. The exact original raw string is passed to `SESSION_AUTHORITY_CAS_LUA` as a fixed argument, always present for every Lua CAS (not only intake):

   - ARGV[1] expectedRevision
   - ARGV[2] nextJson
   - ARGV[3] ttlSeconds
   - ARGV[4] sessionId
   - ARGV[5] nowIso
   - ARGV[6] intakeCommit
   - ARGV[7] ledgerHeadKey
   - ARGV[8] ledgerEntryPrefix
   - ARGV[9] probeLimit
   - ARGV[10] validatedSessionRaw (exact TypeScript-validated raw, or empty string if the record was absent)
   - [intake] ARGV[11+] hintRaw, startVersion, endVersion, entryCount, entryRaw...

   The Ledger raw-snapshot arguments remain intact. Their positions shifted by one slot, and `decodeLedgerBindingArgs()` plus the Lua script were updated together.

4. Lua compares the live `GET KEYS[1]` bytes with ARGV[10] immediately after the read, in the same atomic script, before structural inspect, revision CAS, lifecycle checks, and Ledger binding.

   - If the validated value was absent (empty ARGV[10]) but the live record now exists, the script returns 11 (`session_snapshot_changed`) and does not create or overwrite.
   - If the validated value existed but the live record is absent or differs byte-for-byte, the script returns 11.
   - If both are absent, the script still returns 5 (`missing`) and never turns a missing record into a successful create.
   - A structurally valid but hash-corrupted Session Record that differs from the exact TypeScript-validated raw value is rejected with 11. Lua does not recompute JavaScript `canonicalHash`.

5. Existing FU1 Session Record structural checks, FU2 exact Ledger raw-value comparison, head-hint comparison, detection of newly visible Ledger entries, revision and generation CAS, terminal lifecycle checks, and idempotency remain in the same Lua CAS.

6. `commitAuthoritativeSessionUpdate()` maps `session_snapshot_changed` to an explicit recoverable Session Authority error, distinct from revision conflict, malformed, missing, or success. HTTP status is 409, matching the other snapshot-changed / probe-incomplete codes.

7. MemoryKv uses the same hash and identity checks inside its synchronous CAS section. There is no prevalidation-to-commit window on that path. Race cases B-H, I, and K are therefore harness / Redis-path cases.

Missing current records remain fail-closed. A Session Record binding mismatch is never mapped to an ordinary revision conflict, malformed, missing, or a successful commit.

## New Lua result code and error mapping

- Lua code 11 -> `session_snapshot_changed`
- Recoverable: yes
- Not mapped to `cas_conflict` (0), `malformed` (6), `missing` (5), or success (1)
- Existing codes 0-10 keep their previous mappings

## Real Redis / Lua execution

Real Redis/Lua was not executed. This machine had no `redis-cli`, no `redis-server`, no `REDIS_URL`, and the Docker daemon was not running. No Upstash / KV credentials were present, and none were added. `SESSION_AUTHORITY_CAS_LUA` remains unexecuted in a real Redis server.

This record does not claim that production Redis or production Lua passed.

The Redis eval contract harness asserts that `createKvSessionAuthorityStore()` calls `kv.eval` with the exact production Lua source, the exact validated Session Record raw string, and (for intake) the validated Ledger raw snapshot, then applies the shared TypeScript raw-binding predicates. That harness is not a Redis server and is not a Lua VM. Static Lua source assertions are not execution evidence.

## Regression cases (A-M)

Unless noted, non-race cases ran on both the MemoryKv production adapter (TypeScript/MemoryKv atomic path) and the Redis eval contract harness (not Lua execution). Race-window cases B-H, I, and K are harness-only because MemoryKv has no prevalidation-to-commit window.

- A. Valid Session Record, unchanged before EVAL: commit remains eligible (MemoryKv and harness).
- B. Session Record raw bytes changed between TypeScript validation and EVAL: rejected with `session_snapshot_changed`; stored record not overwritten (harness only).
- C. Session Snapshot changed while preserving the old `snapshot_hash`: rejected with `session_snapshot_changed`; stored record not overwritten (harness only).
- D. `snapshot_hash` changed while preserving the original Snapshot: rejected with `session_snapshot_changed`; stored record not overwritten (harness only).
- E. Session revision changed between validation and EVAL: rejected with `session_snapshot_changed` without overwriting the newer record (harness only).
- F. Session identity changed between validation and EVAL: rejected with `session_snapshot_changed`; stored record not overwritten (harness only).
- G. Session Record deleted between validation and EVAL: rejected with `session_snapshot_changed`; the key remains absent (harness only).
- H. Session Record absent during validation but created before EVAL: rejected with `session_snapshot_changed`; the newly created record is not replaced by the proposed record (harness only).
- I. Ledger raw value changes before EVAL: FU2 `ledger_snapshot_changed` behavior remains intact; Session Record not overwritten (harness only).
- J. New Freeze races Intake: Intake is not accepted (`frozen` on MemoryKv when Freeze is already visible; `ledger_snapshot_changed` or `frozen` on the harness race). Stored Session Record is not overwritten (MemoryKv and harness).
- K. Both Session Record and Ledger change before EVAL: rejected with `session_snapshot_changed` (Session raw comparison runs first) without writing the proposed Session Record (harness only).
- L. Existing idempotency behavior remains unchanged (MemoryKv chat path: same-content replay is idempotent without rerunning the model; different-content replay returns `session_turn_conflict`).
- M. Existing lifecycle and revision conflict behavior remains unchanged (MemoryKv and harness).

Additional contracts in the FU3 file: `commitAuthoritativeSessionUpdate()` maps `session_snapshot_changed` as a recoverable error, not a generic CAS conflict; a genuinely missing record remains `missing` and is never turned into a successful create.

The FU3 suite reported 23 PASS lines. Existing suites still passed: M9 20, M9-R1 17, FU1 31, FU2 35.

## Command exit codes

All required commands exited 0. Exact exit codes, durations, and log paths are in `command-exit-codes.json`.

## Remaining limitations

- `SESSION_AUTHORITY_CAS_LUA` was not executed on a real Redis server or Lua VM. Current evidence proves the TypeScript path, the eval-argument contract, and the shared raw-binding predicates, not production Redis atomic semantics.
- Lua still does not recompute JavaScript `canonicalHash`. Integrity is established in TypeScript and bound into Lua by exact raw-byte comparison.
- If collecting the current raw value or the Ledger snapshot tears between sequential reads, Lua rejects a changed snapshot rather than silently accepting it.
- OpenRouter, paid reports, Pass deduction, and browser LAB were not verified in this run.
- This record does not declare FU3, M9, M9-R1, or DI2 accepted.
