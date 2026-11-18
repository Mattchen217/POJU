# M9-R1 Session Authority Remediation

Date recorded: 2026-11-18 (America/Chicago). Local verification completed at 2026-11-18 03:22:46 -06:00.

This directory records the local verification run for the M9-R1 Session Authority remediation on branch `feat/m1-r-fresh-session-main-loop`.

Git baseline:

- Review baseline / parent SHA: `565380ae19e6f48505102bd0dccdc14d9e9e3cec` (M9 evidence; implementation parent `ca3a68a3fb3c06789997678208d40b24ef7177e6`)
- Implementation SHA: `d9c6434e630573014f82803a395ea45a8adacbc3`

The evidence SHA is not written in this file, to avoid a self-referential tip SHA. It is the commit that adds this directory.

This file does not declare M9 or Decision Intake 2.0 accepted. It is a verification record for independent review.

## Changed files (implementation commit)

Modified:

- `lib/kv/memory-kv.ts` (adds synchronous get/set for in-process atomic CAS)
- `lib/poju/decision-authority/server/ledger-store.ts` (exports production ledger key helpers; no ledger or Freeze behavior change)
- `lib/poju/session-authority/chat.ts`
- `lib/poju/session-authority/lifecycle.ts`
- `lib/poju/session-authority/store.ts`
- `lib/poju/session-authority/types.ts`
- `package.json` (adds `test:m9-r1-session-authority-remediation`)
- `scripts/test-m9-server-authoritative-session.ts` (keeps existing cases; fixes fixture records so snapshot hash and revision stay consistent)

Added:

- `scripts/test-m9-r1-session-authority-remediation.ts`

`public/sw.js` was rewritten by `pnpm build` and then restored to its pre-build bytes. It was left unstaged and is not in either commit.

- Pre-build SHA-256: `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980` (139053 bytes)
- Post-build SHA-256: `d2160279291e3ce6e9a8c3ba12d20d196601c39b4a8dbee5861d434bb8b44042` (139220 bytes)
- Working tree restored to the pre-build bytes after the successful build.

## Finding 1 ? Terminal lifecycle commit race

`commitAuthoritativeSessionUpdate()` now re-reads the authoritative Session, validates Session ID, revision, and generation, and re-derives lifecycle status before writing. A Session that became `expired`, `frozen`, or `terminated` during model execution is rejected with an explicit Authority error. The model-generated turn is not saved, and the post-commit record is not marked terminal in order to sneak the turn in.

Because Freeze / Decision Authority state can change independently of Session revision, the intake-commit path also performs a same-KV atomic probe of the production ledger keys (`dcLedgerHeadKey` / `dcLedgerEntryKey`, same forward scan as `readLedgerHead`) inside the Session CAS primitive:

- MemoryKv: `getSync` / `setSync` run the shared production predicate `applySessionAuthorityCas()` with no await between read, ledger probe, and write.
- Redis / Upstash: `SESSION_AUTHORITY_CAS_LUA` is sent to `kv.eval` and performs the same compare, identity, expiry, lifecycle, and ledger probe before `SET`.

Two independent KV operations are not treated as atomic. If the Session store and the ledger are not the same KV instance, the Lua / in-process atomic probe cannot see ledger keys; a pre-CAS `readLedgerHead()` still runs, but that second read is not an atomic guarantee. Production `createKvSessionAuthorityStore(durableKv())` uses the same `durableKv()` as the ledger.

## Finding 2 ? Idempotency integrity

`extractIncomingUserTurn()` binds idempotency to the original user message content, not just `client_turn_id`. Same turn ID + same content returns the original result and does not re-run the model, even if message meta, timestamp, or Session revision were edited. Same turn ID + different content returns `session_turn_conflict` and does not return the old response as if the new message succeeded. The `last_committed_turn_id`-only short-circuit in `executeAuthoritativeChatTurn()` was removed so content binding is required.

## Finding 3 ? Server record integrity

`store.get()` / `inspectStoredSessionRecord()` fail closed when:

- `Record.session_id` does not match the requested storage key
- `session_snapshot.session_id` does not equal `Record.session_id`
- Record revision does not equal `snapshot.session_revision`
- Recomputed snapshot hash does not equal stored `snapshot_hash`
- Version is unsupported, required fields are missing, or the snapshot is damaged

A missing key still returns `null` and surfaces as `session_not_found`. A corrupt record throws `invalid_session_record` and is never treated as missing or re-initialized (`createNx` remains NX). The normal Session Record data contract and version (`v = 1`) were not changed.

## Finding 4 ? CAS contract

`createKvSessionAuthorityStore` remains the production adapter. CAS:

- Atomically compares and writes (MemoryKv sync section, or Redis Lua `EVAL`)
- Refuses revision going backwards or skipping ahead by more than one
- Refuses a client-controlled generation change
- Refuses a Session ID change
- Refuses to create a record when the key is missing or malformed
- Refuses to extend `expires_at`; KV TTL is always `SERVER_SESSION_TTL_SECONDS`
- On conflict, commit returns the current authoritative revision
- The in-memory adapter and the Redis eval path share `evaluateSessionAuthorityCas` / `applySessionAuthorityCas`

Live Upstash / Redis was not configured in this environment (`isRemoteKvConfigured() === false`) and was not exercised. The production `createKvSessionAuthorityStore` eval branch was driven by a contract harness that asserts it received `SESSION_AUTHORITY_CAS_LUA` and then executes the shared production CAS predicate. The Lua source was not executed by a Redis server or a Lua VM. This run does not claim that live Redis passed.

## New M9-R1 tests

Script: `pnpm test:m9-r1-session-authority-remediation` -> `tsx --require ./scripts/fixtures/register-server-only.cjs scripts/test-m9-r1-session-authority-remediation.ts`.

The suite calls the real production entries (`POST` from `app/api/poju/chat/route.ts` and `app/api/poju/session/route.ts`) and the persistence / production CAS adapter boundary. It is 17 PASS lines covering:

- A. Session is Frozen during model execution; commit after the model returns is rejected
- B. Session is Terminated during model execution; commit is rejected
- C. Session expires during model execution; commit is rejected
- D. Freeze and Session CAS run concurrently; a Frozen Session cannot successfully commit an Intake turn
- E. Same turn ID + same content is idempotent
- F. Same turn ID + different content is a conflict
- G. Replaying the same turn does not call the model more than once
- H. Record session_id vs storage key mismatch fails closed
- I. Snapshot session_id vs Record mismatch fails closed
- J. Snapshot hash mismatch fails closed
- K. Revision vs snapshot revision mismatch fails closed
- L. CAS revision race: loser does not overwrite winner (MemoryKv and eval harness)
- M. CAS does not recreate a Session that no longer exists
- N. After Expiry / Freeze / Terminate, no new turn can be committed
- Extra: CAS contract (generation, session id, expires_at extension, backward revision) on MemoryKv and the eval harness; production Lua source includes atomic compare, no-create, and ledger probe; idempotency extractor binds content and ignores meta/timestamp/revision edits

O. Existing M1-M8 regressions, and the original M9 suite, were run separately and all passed. Existing Freeze, Readiness, Fact Verification, and CAS tests were not deleted or weakened.

## Required command results

All of the following exited 0 on implementation SHA `d9c6434e630573014f82803a395ea45a8adacbc3`. Raw logs are in this directory. See `command-exit-codes.json` for exit codes, elapsed time, and log sizes.

1. `pnpm test:m9-server-authoritative-session` ? 20 PASS lines; checks complete ? `01-test-m9-server-authoritative-session.log`
2. `pnpm test:m9-r1-session-authority-remediation` ? 17 PASS lines; checks complete ? `02-test-m9-r1-session-authority-remediation.log`
3. `pnpm test:m8-r1-internal-turn-trust-boundary` ? 42 PASS lines; checks complete ? `03-test-m8-r1-internal-turn-trust-boundary.log`
4. `pnpm test:m6-di2-full-lifecycle` ? 7 passed, 0 failed ? `04-test-m6-di2-full-lifecycle.log`
5. `pnpm test:m5-r1-authorization` ? 49 passed, 0 failed ? `05-test-m5-r1-authorization.log`
6. `pnpm test:m1-production-adaptive-question-loop` ? 188 PASS lines; exit 0 ? `06-test-m1-production-adaptive-question-loop.log`
7. `pnpm test:m2-1-readiness-confirm-freeze` ? 19 passed, 0 failed ? `07-test-m2-1-readiness-confirm-freeze.log`
8. `pnpm test:m2-2-freeze-report-binding` ? 43 passed, 0 failed ? `08-test-m2-2-freeze-report-binding.log`
9. `pnpm test:m3-decision-report` ? 27 passed, 0 failed ? `09-test-m3-decision-report.log`
10. `pnpm test:m4-decision-authority` ? 27 passed, 0 failed ? `10-test-m4-decision-authority.log`
11. `pnpm test:m4-1-freeze-recovery` ? 10 passed, 0 failed ? `11-test-m4-1-freeze-recovery.log`
12. `pnpm test:m5-di2-main-path` ? 29 passed, 0 failed ? `12-test-m5-di2-main-path.log`
13. `pnpm test:m8-di2-non-model-closure` ? 6 PASS lines; checks complete ? `13-test-m8-di2-non-model-closure.log`
14. `pnpm exec tsc --noEmit --pretty false` ? exit 0, empty log ? `14-tsc-noemit.log`
15. `pnpm build` ? Compiled successfully in 46s; exit 0 ? `15-pnpm-build.log`

## Still unverified

- No real OpenRouter call was made.
- No real Personal Analysis or eight-page report model run was made. Report-path tests used the existing test doubles / fixtures.
- No real billing or Pass consumption was triggered.
- Live Upstash / Redis was not configured and was not exercised. Production Redis Lua was covered by the eval-branch contract harness described above, not by a Redis server or Lua VM.
- No browser DI2 Lifecycle Lab session was driven.

## Residual limitations and remaining races

- Server `expires_at` remains authoritative. `handleUserMessage` may still compute a local rolling expiry, but commit overwrites `expires_at` from the server record, so a client cannot extend life.
- A client can still edit its local IndexedDB mirror. Those local edits cannot change the server snapshot or reopen Intake, but an offline UI may show the stale cache until refresh.
- Cross-Ledger / Session atomicity is provable only when both documents live in the same KV and the intake-commit CAS path is used (MemoryKv sync section or Redis Lua). If the Session store is injected separately from `durableKv()`, the atomic ledger probe cannot see Freeze entries in the other store. A pre-CAS `readLedgerHead()` still runs in that case, but a second read is not an atomic guarantee. This run does not claim that two independent KV operations are naturally atomic.
- There is a brief window inside `writeLedgerEntryNx` between the NX write of a freeze entry and the head-hint update; the CAS probe walks forward from the hint, so a freeze entry that has already been written is still visible. A freeze that has not yet won its NX slot is not yet effective.
- No PR, merge, rebase, force-push, deploy, or main-branch change is part of this record.
