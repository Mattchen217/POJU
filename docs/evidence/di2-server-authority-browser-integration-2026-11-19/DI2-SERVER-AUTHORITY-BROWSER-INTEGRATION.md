# DI2 Production Main Path — Server Authority Integration Repair

Times below are America/Chicago (UTC-6).

This records wiring the real POJU browser turn path onto the existing server-authoritative DI2 chat / Session CAS / DC ledger architecture. It is **not** a DI2 / M9 acceptance declaration, not a live OpenRouter E2E, and not a re-open of completed M1–M9 product work.

## Baseline

- Branch: `feat/m1-r-fresh-session-main-loop`
- Parent SHA (pre-implementation HEAD): `ecdbb3bb260dcbd4ae9ccee4687603dab03e827a`
- Implementation commit: `10c47a57cb2a98f19e55d69f1be3d92c56871b8b`
- No PR, merge to `main`, deploy, rebase, or force-push.

## What changed (implementation commit)

1. **Browser → `/api/poju/chat`**
   - `components/poju/POJUChatUI.tsx` submits turns via `submitAuthoritativeChatTurn` (`lib/poju/session-authority/chat-client.ts`).
   - Production UI no longer runs local `handleUserMessage()` for DI2 turns.
   - Client adopts returned `authoritative_session` + `session_authority`; mirrors into IndexedDB only from the committed server snapshot (`mirrorAuthoritativeSessionLocally` / `writeLocalAuthorityMirror`).

2. **In-process Decision Authority on server persist**
   - `lib/poju/decision-authority/server/in-process-transport.ts` calls `handleDecisionAuthority` under AsyncLocalStorage.
   - `executeAuthoritativeChatTurn` wraps Session persist with `runWithInProcessDecisionAuthority`.
   - Browser HTTP transport to `/api/poju/decision-authority` remains for device-side operations.
   - DC ledger commit still precedes Session CAS; no local-only ledger bypass.

3. **Retired public Answer Interpretation proxy**
   - `POST /api/poju/answer-interpretation` returns **410** `endpoint_retired`.
   - `callAnswerInterpretationModel` is server-only (OpenRouter); browser path fail-closes without fetching the proxy.
   - M2.4 R2C-11 / R2C-12 updated to the retired-proxy contract.

4. **Authority controls preserved**
   - `requireAuthoritativeSession`, Intake Protection, revision/CAS, ledger integrity, Freeze receipts, report binding remain on the authoritative path.

## Commands and exit codes

| Command | Exit | Result |
|---|---|---|
| `pnpm test:di2-browser-authoritative-chat-integration` | 0 | 8 passed, 0 failed (A–G wire) |
| `pnpm test:di2-feature-landing-main-path` | 0 | 22 passed |
| `pnpm test:m1-production-adaptive-question-loop` | 0 | PASS=188 FAIL=0 |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | 19 passed, 0 failed |
| `pnpm test:m2-2-freeze-report-binding` | 0 | 43 passed, 0 failed |
| `pnpm test:m2-3-decision-blueprint` | 0 | 18 passed, 0 failed |
| `pnpm test:m2-4-r2-production-closure` | 0 | PASS=20 FAIL=0 |
| `pnpm test:m5-di2-main-path` | 0 | 29 passed, 0 failed |
| `pnpm test:m5-r1-authorization` | 0 | 49 passed, 0 failed |
| `pnpm test:m6-di2-full-lifecycle` | 0 | 7 passed, 0 failed |
| `pnpm test:m9-server-authoritative-session` | 0 | all listed M9 cases passed |
| `pnpm exec tsc --noEmit --pretty false` | 0 | no diagnostics |
| `pnpm build` | 0 | Compiled successfully |

Raw logs: `logs/`.

Deterministic integration / hook-based suites only. **Not** live OpenRouter evidence.

## `public/sw.js`

`pnpm build` rewrote `public/sw.js`. Restored with `git checkout HEAD -- public/sw.js` before commits. Working-tree object hash matches `HEAD:public/sw.js` (`1b0612a50b3a569e38c61ffeff9626175448257b`).

## Untested / remaining

- Live OpenRouter Answer Interpretation inside authoritative chat (Staging).
- Hosted Redis/CAS multi-instance concurrency under real traffic.
- Full browser Playwright against a deployed Staging host.
- `scripts/m2-4-r2-openrouter-smoke.ts` / `m2-4-r2-real-e2e.ts` still describe the retired proxy transport and were not re-run as live model evidence.

## Limits / non-claims

- Does **not** declare DI2, M9, or production acceptance.
- Does **not** claim a real OpenRouter run.
- Independent review should verify the browser adopts only CAS-committed envelopes and that DC ledger sync uses the in-process transport on the server path.
