# M8-R1-FU1-R2-R1 Server Verifier Fail-Closed

Date recorded: 2026-11-17 (America/Chicago).

This directory records the local verification run for M8-R1-FU1-R2-R1 on branch `feat/m1-r-fresh-session-main-loop`.

Git baseline:

- Baseline / parent SHA: `786b470bcf2816dfdef966c43460872e45840495` (M8-R1-FU1-R2 evidence; implementation parent `6611f7f605f1c28dbdf3dbc2117e9915e294ba46`)
- Implementation SHA: `c2e35fc7d0edbce0a9e6ee287535d02d87a6fd99`

The evidence SHA is not written in this file, to avoid a self-referential tip SHA. It is the commit that adds this directory.

This file does not declare FU1, R2, R2-R1, M8-R1, or DI2 accepted. It is a verification record for independent review.

## Changed files and key code locations

Implementation commit files:

- `lib/poju/shared/assistant-history-provenance.ts`
  - `detectAssistantHistoryPromptEnvironment()` distinguishes server (Node) from browser. A test hook may override the detected environment; a server import failure cannot be reinterpreted as a browser environment.
  - `resolveTrustedPromptHistoryWithProvenance()` is the Prompt-history policy entry used by `resolveTrustedPromptHistory()`.
  - Browser path only: `applyAssistantHistoryProvenance(..., { available: false })`, status `browser_compatibility`.
  - Server path: dynamic-import the existing attestation module (still `webpackIgnore` so the client bundle does not pull in Node crypto). After a successful load, HMAC verification is used.
  - If module load fails, `applyTrustedPromptHistory` is missing, or the signing key is unavailable, the result is `status: "server_verification_unavailable"` with an explicit reason (`module_load_failed`, `verifier_unavailable`, or `signing_key_unavailable`). Messages are produced by `applyServerVerifierFailClosed()`: legitimate user turns are kept, and every assistant turn is dropped. The old-Session compatibility prefix is not applied.
- `lib/poju/decision-authority/server/assistant-history-attestation.ts`
  - `isAssistantHistorySigningAvailable()` probes the existing Decision Authority signing secret without changing HMAC format, key material, or the `poju-assistant-history` domain.
  - `applyTrustedPromptHistory()` fail-closes through `applyServerVerifierFailClosed()` when the signing key is unavailable, instead of calling the provenance helper with a verifier that would return false and reopen unsigned compatibility.
- `scripts/test-m8-r1-internal-turn-trust-boundary.ts`
  - Keeps prior M8-R1 / FU1 / R2 cases and adds R2-R1 cases that go through `buildPhaseTransportInput()` and `buildPhaseTransportInputV6()`.

## Server vs browser call paths

Production Prompt construction remains on the server LLM path:

1. `POST /api/poju/chat` (`app/api/poju/chat/route.ts`) and `createPojuChatStreamResponse()` (`lib/poju/poju-chat-stream.ts`) receive the client-submitted Session.
2. Both entries call `callPOJULLM()` in `lib/llm/poju-llm.ts`. Freeze / Expiry checks (`getLocalIntakeTerminalReason()` and server `assertSessionCanEnterIntake()`) still run before any model work.
3. Phase modules assemble Prompt input through `buildPhaseTransportInput()` (`lib/llm/phases/oriental-prompt-context.ts`) or `buildPhaseTransportInputV6()` (`lib/llm/phases/oriental-prompt-context-v6.ts`).
4. Role filtering is unchanged from FU1: `sanitizeClientPromptHistory()` allows only `user` and `assistant`. `system`, `developer`, and `tool` are dropped and are not rewritten into the server system Prompt.
5. `resolveTrustedPromptHistory()` then applies assistant-history provenance. On the server, that function must load the server verifier. A load/key failure fail-closes; it does not use `available: false`.
6. The server system Prompt is still built by the existing `buildPojuSystemPrompt()` / `buildPojuSystemPromptV6Sync()` logic.

Browser compatibility:

- `assistant-history-provenance.ts` is still a client-safe module and does not statically import Node crypto.
- If Prompt construction actually runs in a non-Node / browser environment, unsigned old-Session history may still enter the Prompt with the existing unverified prefix. That policy is gated on `detectAssistantHistoryPromptEnvironment() === "browser"` and is not entered by a server dynamic-import exception.

## Test results

`scripts/test-m8-r1-internal-turn-trust-boundary.ts` recorded 42 `PASS` lines and a clean completion message. Exit code 0. Prior M8-R1 / FU1 / R2 cases were kept.

New R2-R1 cases in this run, all exercised through the real v5/v6 Prompt builders unless noted as a source-path check:

- R2-R1: server verifier loads normally and a valid attested assistant reply enters the Prompt
- R2-R1: server verifier dynamic import failure drops all assistant turns and keeps user turns
- R2-R1: server verifier unavailable does not apply old-Session compatibility to unsigned history
- R2-R1: server signing key unavailable fail-closes instead of compatibility fallback
- R2-R1: browser compatibility mode still restores an old Session with the unverified prefix
- R2-R1: Freeze and Expiry refusals still happen before any model call
- R2-R1: production server catch path no longer falls back to available: false

These cases also re-checked that `system` / `developer` / `tool` stay filtered, that v5 and v6 Prompt histories stay consistent, that Prompt construction does not mutate stored Session messages, and that a server verifier failure does not place unverified assistant history (or the compatibility prefix) into the model Prompt.

## Required command exit codes

All required commands exited 0. Raw logs are in this directory; the machine-readable map is `command-exit-codes.json`.

| Command | Exit code | Log |
| --- | ---: | --- |
| `pnpm test:m8-r1-internal-turn-trust-boundary` | 0 | `01-test-m8-r1-internal-turn-trust-boundary.log` |
| `pnpm test:m6-di2-full-lifecycle` | 0 | `02-test-m6-di2-full-lifecycle.log` |
| `pnpm test:m5-r1-authorization` | 0 | `03-test-m5-r1-authorization.log` |
| `pnpm test:m1-production-adaptive-question-loop` | 0 | `04-test-m1-production-adaptive-question-loop.log` |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | `05-test-m2-1-readiness-confirm-freeze.log` |
| `pnpm test:m2-2-freeze-report-binding` | 0 | `06-test-m2-2-freeze-report-binding.log` |
| `pnpm test:m3-decision-report` | 0 | `07-test-m3-decision-report.log` |
| `pnpm test:m4-decision-authority` | 0 | `08-test-m4-decision-authority.log` |
| `pnpm test:m4-1-freeze-recovery` | 0 | `09-test-m4-1-freeze-recovery.log` |
| `pnpm test:m5-di2-main-path` | 0 | `10-test-m5-di2-main-path.log` |
| `pnpm test:m8-di2-non-model-closure` | 0 | `11-test-m8-di2-non-model-closure.log` |
| `pnpm exec tsc --noEmit --pretty false` | 0 | `12-tsc-noemit.log` |
| `pnpm build` | 0 | `13-production-build.log` |

`public/sw.js` was rewritten by the production build and was restored byte-for-byte to the pre-build working-tree content. It was left unstaged. The restored SHA-256 is recorded in `sw-js-restored-after-build.sha256`.

## Remaining unresolved limits

- There is still no authoritative server Session store. A client that strips every valid attestation can still make a post-R2 Session look like a pre-R2 unsigned Session. In browser compatibility mode, those unsigned assistant rows may still enter the Prompt with the unverified prefix. On the server, a working verifier still uses the existing R2 unsigned-session compatibility rule; a failed verifier now fail-closes and drops those assistant rows.
- Session expiry still uses the client-held `expires_at` field. Missing or unparsable values remain fail-closed. This was already recorded as an unresolved FU1 limitation and is unchanged.
- This run did not execute real OpenRouter calls, real report-model generation, real charging or Pass consumption, or a browser LAB acceptance pass.
