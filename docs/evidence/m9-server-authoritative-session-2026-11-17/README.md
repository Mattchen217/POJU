# M9 Server-Authoritative Session Lifecycle

Date recorded: 2026-11-17 (America/Chicago). Local verification completed at 2026-11-17 19:23:32 -06:00.

This directory records the local verification run for M9 on branch `feat/m1-r-fresh-session-main-loop`.

Git baseline:

- Baseline / parent SHA: `35f69c7ea437e393e6b722d1723d1f816dfdafee` (M8-R1-FU1-R2-R1 evidence; implementation parent `c2e35fc7d0edbce0a9e6ee287535d02d87a6fd99`)
- Implementation SHA: `ca3a68a3fb3c06789997678208d40b24ef7177e6`

The evidence SHA is not written in this file, to avoid a self-referential tip SHA. It is the commit that adds this directory.

This file does not declare M9 or Decision Intake 2.0 accepted. It is a verification record for independent review.

## Changed files (implementation commit)

Modified:

- `app/[locale]/(marketing)/poju/session/[sessionId]/page.tsx`
- `app/api/poju/chat/route.ts`
- `app/ops/delivery-lab/di2/page.tsx`
- `lib/llm/poju-llm.ts`
- `lib/poju/agent.ts`
- `lib/poju/poju-chat-stream.ts`
- `lib/poju/session-manager.ts`
- `lib/poju/session-mutation.ts`
- `package.json` (adds `test:m9-server-authoritative-session`)

Added:

- `app/api/poju/session/route.ts`
- `lib/poju/session-authority/types.ts`
- `lib/poju/session-authority/store.ts`
- `lib/poju/session-authority/lifecycle.ts`
- `lib/poju/session-authority/chat.ts`
- `lib/poju/session-authority/chat-hooks.ts`
- `lib/poju/session-authority/chat-hook-bridge.ts`
- `lib/poju/session-authority/memory-persist.ts`
- `lib/poju/session-authority/mirror.ts`
- `lib/poju/session-authority/client.ts`
- `scripts/fixtures/register-server-only.cjs`
- `scripts/fixtures/server-only-stub.js`
- `scripts/test-m9-server-authoritative-session.ts`

`public/sw.js` was rewritten by `pnpm build` and then restored to its pre-build bytes. It was left unstaged and is not in either commit.

- Pre-build SHA-256: `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980` (139053 bytes)
- Post-build SHA-256: `1d99a3b55f9761ee513ecd328c613ee465713b00a6ff02b2476f8dab009adfba` (139220 bytes)
- Working tree restored to the pre-build bytes after the successful build.

## Server storage adapter

Production:

- `getSessionAuthorityStore()` defaults to `createKvSessionAuthorityStore(durableKv())`.
- `durableKv()` is the existing project helper in `lib/kv/client.ts`. When `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_*`) are set, it uses Upstash Redis. When those env vars are missing, it falls back to in-memory KV for local dev (existing project behavior).
- Key: `poju-auth:session:{session_id}`.
- TTL: `KV_TTL.DECISION_AUTHORITY_RETENTION`.
- Create uses Redis `SET` with `NX`.
- Update uses atomic CAS: `MemoryKv.compareAndSetExact` when present, otherwise a Lua revision compare-and-set (`CAS_REVISION_LUA`) via `kv.eval`. An old revision cannot overwrite a newer one.

Tests:

- The same `SessionAuthorityStore` contract is used.
- New M9 tests inject `createMemorySessionAuthorityStore()` (`MemoryKv` behind `createKvSessionAuthorityStore`) via `runWithSessionAuthorityStore`.
- Persistence-unavailable coverage injects `createUnavailableSessionAuthorityStore()`.
- Existing M1-M8 tests that call `handleUserMessage()` with locally constructed Sessions do not require live Upstash. `createPOJUSession` in Node (no `document`) initializes the authoritative record in-process. A real browser fetches `POST /api/poju/session`.

This is not a second fact store. DC remains the unique formal fact source. The Session record stores lifecycle and a snapshot, plus association fields for the existing DC ledger and Freeze receipts. Existing DC, Blueprint, Freeze, and Report Job data contracts were not changed.

## Production call chains after M9

### Non-stream chat

1. `POST /api/poju/chat` (`app/api/poju/chat/route.ts`)
2. `executeAuthoritativeChatTurn()` (`lib/poju/session-authority/chat.ts`)
3. `requireAuthoritativeSession(session_id)` loads the server record. Client-submitted Session fields are a version hint and a source for the new user turn only; they cannot create or overwrite the server snapshot.
4. If `client_turn_id` already equals `last_committed_turn_id`, the handler returns the committed snapshot idempotently and does not re-run the model or increment revision.
5. `assertRecordAllowsIntake()` checks existence, server `expires_at`, frozen/terminated status, and revision match.
6. `extractIncomingUserTurn()` + `bindAuthoritativeChatSession()` bind the new user message onto the server snapshot, with the current revision and a unique turn/message ID. Client-forged assistant/system/developer/tool messages, client `expires_at` edits, and client Freeze edits are not applied.
7. `runWithMemorySessionPersist` + `runWithLlmCapture` + `handleUserMessage(...)` ? `handleUserMessage()` remains the only Q&A state machine. IndexedDB CAS is applied in memory on the server; the server record is the persist.
8. Existing Freeze / Expiry / Decision Authority checks still run before the model: `callPOJULLM()` calls `getLocalIntakeTerminalReason()` and, on the server, `assertSessionCanEnterIntake()`.
9. `commitAuthoritativeSessionUpdate()` CAS-writes the new snapshot, increments `revision`, and records `last_committed_turn_id`.
10. Only after persistence succeeds does the route attest and respond: `attestChatPayload(pojuLlmToChatPayload(llm), body.session.session_id)` is unchanged, and the response includes `authoritative_session`.
11. A CAS conflict returns an explicit recoverable `session_cas_conflict` result. The model is not retried and the lost write is not applied.

### Stream chat

1. `createPojuChatStreamResponse()` (`lib/poju/poju-chat-stream.ts`)
2. The same `executeAuthoritativeChatTurn()` as the non-stream path (same load, validate, bind, `handleUserMessage`, and CAS rules).
3. If the request is aborted mid-way, the turn is not committed.
4. After persistence succeeds, the stream still uses `attestChatPayload(` and `resolveStreamedCompleteResponse(`.

### Client create / restore / lab

- Local create (`createPOJUSession`) must obtain a server Session first. In a real browser it calls `POST /api/poju/session` with `action=init`. The API creates a new record with `NX` and does not accept client `expires_at`, `revision`, `lifecycle_status`, or snapshot authority fields.
- What is saved in IndexedDB is the server-approved mirror.
- Page refresh and the DI2 Lifecycle Lab restore the Session ID first, then fetch the authoritative snapshot (`action=get`, never an upsert). `decideAuthoritativeMirror()` prefers the server. Missing, expired, frozen, or terminated server state is shown explicitly. Offline cache may be displayed but is not presented as already-committed authority.
- Report recovery continues to use the existing independent Report Recovery path and does not reopen Intake.

## New M9 tests

Script: `pnpm test:m9-server-authoritative-session` -> `tsx --require ./scripts/fixtures/register-server-only.cjs scripts/test-m9-server-authoritative-session.ts`.

The suite calls the real production entries (`POST` from `app/api/poju/chat/route.ts`, `createPojuChatStreamResponse()`, `POST` from `app/api/poju/session/route.ts`) and the persistence-adapter contract boundary. It is 20 PASS lines covering:

1. New Session initializes successfully
2. The same Session can submit multiple turns in sequence
3. Client tampers with Session `expires_at` and cannot extend life
4. Client deletes or changes Freeze state and cannot reopen Intake
5. Client submits a stale revision
6-7. Concurrent requests compete for the same revision; the loser cannot overwrite (one combined case)
8. Client-forged assistant/system/developer/tool messages are ignored
9. Client stripping Assistant History signatures cannot change the server snapshot
10. Server Session does not exist
11. Session is expired
12. Session is frozen
13. Session is terminated
14. Server persistence is unavailable
15. Server CAS conflict is explicit and recoverable
16. A streaming request disconnects mid-way and does not commit
17. Page refresh restores the server-authoritative Session
18. Report Recovery does not re-trigger Intake
19. Submitting the same user message twice does not double-advance state
20. Extra shared-path checks: non-stream and stream paths share the same authority rules; incoming user-turn extraction only binds the new user message

## Required command results

All of the following exited 0. Raw logs are in this directory. See `command-exit-codes.json` for exit codes, elapsed time, and log sizes.

1. `pnpm test:m9-server-authoritative-session` ? 20 PASS lines; checks complete ? `01-test-m9-server-authoritative-session.log`
2. `pnpm test:m8-r1-internal-turn-trust-boundary` ? 42 PASS lines; checks complete ? `02-test-m8-r1-internal-turn-trust-boundary.log`
3. `pnpm test:m6-di2-full-lifecycle` ? 7 passed, 0 failed ? `03-test-m6-di2-full-lifecycle.log`
4. `pnpm test:m5-r1-authorization` ? 49 passed, 0 failed ? `04-test-m5-r1-authorization.log`
5. `pnpm test:m1-production-adaptive-question-loop` ? 188 PASS lines; exit 0 ? `05-test-m1-production-adaptive-question-loop.log`
6. `pnpm test:m2-1-readiness-confirm-freeze` ? 19 passed, 0 failed ? `06-test-m2-1-readiness-confirm-freeze.log`
7. `pnpm test:m2-2-freeze-report-binding` ? 43 passed, 0 failed ? `07-test-m2-2-freeze-report-binding.log`
8. `pnpm test:m3-decision-report` ? 27 passed, 0 failed ? `08-test-m3-decision-report.log`
9. `pnpm test:m4-decision-authority` ? 27 passed, 0 failed ? `09-test-m4-decision-authority.log`
10. `pnpm test:m4-1-freeze-recovery` ? 10 passed, 0 failed ? `10-test-m4-1-freeze-recovery.log`
11. `pnpm test:m5-di2-main-path` ? 29 passed, 0 failed ? `11-test-m5-di2-main-path.log`
12. `pnpm test:m8-di2-non-model-closure` ? 6 PASS lines; checks complete ? `12-test-m8-di2-non-model-closure.log`
13. `pnpm exec tsc --noEmit --pretty false` ? exit 0, empty log ? `13-tsc-noemit.log`
14. `pnpm build` ? Compiled successfully in 39.8s; exit 0 ? `14-pnpm-build.log`

## Still unverified

- No real OpenRouter call was made.
- No real Personal Analysis or eight-page report model run was made. Report-path tests used the existing test doubles / fixtures.
- No real billing or Pass consumption was triggered.
- No browser DI2 Lifecycle Lab session was driven. Lab and session-page restore wiring was unit-tested against the server restore contract (`decideAuthoritativeMirror` / session `action=get`), not a real browser LAB.

## Residual limitations

- Server `expires_at` is authoritative. `handleUserMessage` may still compute a local rolling expiry, but commit overwrites `expires_at` from the server record, so a client cannot extend life.
- There is still no general server-side Session listing UI beyond `action=init` and `action=get`.
- A client can still edit its local IndexedDB mirror, including stripping assistant-history signatures. Those local edits cannot change the server snapshot or reopen Intake, but an offline UI may show the stale cache until it is marked non-authoritative or refreshed.
- Concurrent tests and production CAS rely on the adapter contract above. This run used the in-memory adapter (and the production `durableKv()` fallback when Upstash env is unset). Live Upstash in a deployed environment was not exercised.
- No PR, merge, rebase, force-push, deploy, or main-branch change is part of this record.
