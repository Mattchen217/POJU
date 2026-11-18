# M9-R1-FU1 Redis Lua Integrity Parity

Date recorded: 2026-11-18 (America/Chicago). Local verification completed at 2026-11-18 04:26:05 -0600 (America/Chicago).

This directory records the local verification run for the M9-R1-FU1 Redis Lua / shared-predicate integrity parity remediation on branch `feat/m1-r-fresh-session-main-loop`.

Git baseline:

- Review baseline / parent SHA: `2ce92f5c6ab9ce1748401a16f42abe386a7d00b2` (M9-R1 evidence; implementation parent `d9c6434e630573014f82803a395ea45a8adacbc3`)
- Implementation SHA: `b4081335892005d30f8818eae957f324d12f64ba`

The evidence SHA is not written in this file, to avoid a self-referential tip SHA. It is the commit that adds this directory.

This file does not declare M9 or Decision Intake 2.0 accepted. It is a verification record for independent review.

## Changed files (implementation commit)

Modified:

- `lib/poju/session-authority/store.ts`
- `lib/poju/session-authority/lifecycle.ts`
- `lib/poju/session-authority/types.ts`
- `package.json` (adds `test:m9-r1-fu1-redis-lua-integrity-parity`)

Added:

- `scripts/test-m9-r1-fu1-redis-lua-integrity-parity.ts`

`public/sw.js` was rewritten by `pnpm build` and then restored to its pre-build bytes. It was left unstaged and is not in either commit.

- Pre-build SHA-256: `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980` (139053 bytes)
- Post-build SHA-256: `c9c24c510d7d5b02631b36dc1b30424525dbf2dee416f8393bf7b43894fab209` (139220 bytes)
- Working tree restored to the pre-build bytes after the successful build.

## Finding 1 — Redis Lua Record Integrity

`SESSION_AUTHORITY_CAS_LUA` now inspects both the stored current Record and the proposed next Record before accepting CAS. The Lua inspect checks:

- supported Record version
- required fields and types
- stored `session_id` equals the requested Session ID
- `session_snapshot` exists and is a table
- `session_snapshot.session_id` equals Record `session_id`
- `session_snapshot.session_revision` equals Record `revision`
- proposed Record identity, generation, revision increment (no decrease or skip), and `expires_at` not extended
- missing records still return code 5 and are not created
- malformed current records return code 6 and are not overwritten
- invalid proposed records return code 7

These failures are not collapsed into ordinary revision conflicts.

## Finding 2 — Canonical hash parity / architecture

Exact `canonicalHash` parity cannot be implemented safely in Redis Lua. The existing hash is `sha256(canonicalStringify(normalizeJson(snapshot)))`, where `canonicalStringify` is `JSON.stringify(sortKeysDeep(...))`. Redis Lua cjson cannot faithfully distinguish `[]` from `{}`, and JavaScript `JSON.stringify` number and unicode encoding cannot be reproduced safely in Lua 5.1. A second hashing format was not introduced.

Lua therefore does not recompute SHA-256 and does not treat a precomputed client-controlled hash as proof of integrity. The production Redis adapter (`runLuaSessionCas`) runs `inspectStoredSessionRecord()` — the existing TypeScript `canonicalHash` contract — on the proposed next Record and on the live current Record before `EVAL`. A hash-mismatched or otherwise corrupt current Record fails closed as `malformed` and is not overwritten; `EVAL` is not invoked in that case. Lua still fail-closes atomically on structural integrity failures (including snapshot id and snapshot revision mismatches), lifecycle, revision CAS, and ledger probe failures.

The Lua source contains an explicit comment stating this hash policy. Do not read a static source mention of `canonicalHash`, or a TypeScript simulation, as proof that Redis executed a hash check inside Lua.

## Finding 3 — Ledger probe fail-closed

The same-KV ledger Freeze probe now distinguishes:

- genuinely missing ledger entry / missing hint (scan from 0; no ledger means not frozen)
- valid non-Freeze ledger entry (Intake remains eligible)
- valid Freeze or `dc_status=final` ledger entry (Intake rejected as frozen)
- malformed JSON (fail closed: `ledger_integrity`)
- structurally invalid entry, including `session_id` or `commit_version` mismatch (fail closed: `ledger_integrity`)
- invalid or unusable head hint, including a hint that points at a missing entry (fail closed: `ledger_integrity`)
- probe-limit exhaustion while a later entry is still visible (fail closed: `ledger_probe_incomplete`)

Malformed or structurally invalid ledger data no longer silently means "not frozen." TypeScript also verifies a present `entry_hash` with the existing `canonicalHash` contract. Lua does not recompute ledger entry hashes. NX-write semantics and the ledger schema are unchanged. Freeze becomes effective when the NX-written ledger entry itself is visible; a head hint that has not been written yet can still be discovered by the forward scan.

## Finding 4 — One explicit result contract

TypeScript and Lua use one explicit result contract:

- 1 accepted
- 0 revision conflict
- 2 expired
- 3 frozen
- 4 terminated
- 5 missing
- 6 malformed Record
- 7 invalid identity/contract
- 8 ledger integrity failure
- 9 ledger probe incomplete

`commitAuthoritativeSessionUpdate()` maps ledger integrity and incomplete probe results to explicit Authority errors (`ledger_integrity_failure`, `ledger_probe_incomplete`) rather than a generic `session_cas_conflict`. Identity/contract failures map to `invalid_session_record`.

## Tests

New script: `pnpm test:m9-r1-fu1-redis-lua-integrity-parity`.

Cases A–O were run against:

- the MemoryKv production adapter (`createKvSessionAuthorityStore(new MemoryKv())`), which uses the in-process atomic TypeScript predicate, including `canonicalHash`
- a Redis eval contract harness that asserts `eval()` receives the exact production `SESSION_AUTHORITY_CAS_LUA` source, then executes the shared TypeScript predicate

The harness is labeled in the script and in the raw log: it is not a Redis server and it does not execute Lua. Static Lua source assertions in the same script are labeled as source contract checks, not as proof of Redis Lua execution.

Existing `pnpm test:m9-server-authoritative-session` (20 cases) and `pnpm test:m9-r1-session-authority-remediation` (17 cases) were kept and still passed. M1–M8 required regressions, `tsc`, and `pnpm build` also exited 0.

## Real Redis / Lua execution

Real Redis/Lua was **not** executed.

- `redis-server` and `redis-cli` are not installed
- `REDIS_URL`, `UPSTASH_REDIS_REST_URL`, and `KV_REST_API_URL` are unset
- Docker is installed but the Docker daemon is not running
- No infrastructure, credentials, or production configuration were added to run this task

`SESSION_AUTHORITY_CAS_LUA` therefore remains unexecuted in a real Redis server. This evidence does not claim that production Redis passed.

## Command results

All required commands were run after implementation commit `b4081335892005d30f8818eae957f324d12f64ba`. Raw logs are in this directory. `15-tsc-noemit.log` is 0 bytes because `tsc` succeeded with empty stdout and stderr.

See `command-exit-codes.json` for the exact command, exit code, log path, duration, log size, and implementation SHA of each run.

## Remaining limitations

- Lua was not executed on a real Redis server or Lua VM.
- Lua does not recompute `canonicalHash`. A hash-only corruption that appears after the TypeScript pre-EVAL inspect, and that does not also fail Lua structural checks, is outside what Lua itself can prove. The production adapter fail-closes on hash mismatch before EVAL, and `commitAuthoritativeSessionUpdate()` also re-reads with `inspectStoredSessionRecord` before CAS.
- Lua does not recompute ledger `entry_hash`. A ledger entry that is structurally valid but has a wrong hash is rejected by the TypeScript probe and would not be detected by Lua alone.
- No real OpenRouter, paid report, billing, or Pass consumption was exercised.
- No browser LAB was run.
- This record does not declare M9 PASS or Decision Intake 2.0 complete.
