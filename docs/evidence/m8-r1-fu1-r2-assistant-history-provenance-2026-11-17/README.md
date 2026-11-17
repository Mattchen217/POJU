# M8-R1-FU1-R2 Assistant History Provenance

Date recorded: 2026-11-17 (America/Chicago).

This directory records the local verification run for M8-R1-FU1-R2 on branch `feat/m1-r-fresh-session-main-loop`. The work started from the M8-R1-FU1 evidence commit `a900422bc0ff66cca668be5902d14d5b186c9efc` (implementation parent `00e9ffd21bcfc7f198a4263f1a60d9cdeef4c3ce`).

This file does not record a later tip SHA and does not declare FU1, R2, M8-R1, or DI2 accepted. It is a verification record for independent review.

## Actual Prompt call chain

1. `POST /api/poju/chat` (`app/api/poju/chat/route.ts`) receives the client-submitted Session. The stream entry is `createPojuChatStreamResponse()` in `lib/poju/poju-chat-stream.ts`.
2. Both entries call `callPOJULLM()` in `lib/llm/poju-llm.ts`, which still runs Freeze / Expiry checks (`getLocalIntakeTerminalReason()` and server `assertSessionCanEnterIntake()`) before any model work.
3. Phase modules assemble Prompt input through `buildPhaseTransportInput()` (`lib/llm/phases/oriental-prompt-context.ts`) or `buildPhaseTransportInputV6()` (`lib/llm/phases/oriental-prompt-context-v6.ts`). Opening and confirmation phases pass history into those same builders.
4. Role filtering remains the M8-R1-FU1 layer: `formatPhaseMessageHistory()` / `sanitizeClientPromptHistory()` in `lib/poju/shared/transport.ts` allow only `user` and `assistant`. `system`, `developer`, and `tool` are dropped and are not rewritten into the server system Prompt.
5. After that filter, `resolveTrustedPromptHistory()` applies assistant-history provenance before `applyTurnContext()`. The language-directive `conversationHistory` uses the same filtered history.
6. The server system Prompt is still built by the existing `buildPojuSystemPrompt()` / `buildPojuSystemPromptV6Sync()` logic. This task does not change Prompt wording or DI2 business rules.

## How client-submitted history is distinguished from server-trusted history

A message is never treated as server-generated merely because `role === "assistant"`.

When the server actually generates an assistant reply, it attests the exact `response` string:

- Non-stream: `attestChatPayload(pojuLlmToChatPayload(llm), session_id)` in `app/api/poju/chat/route.ts`.
- Stream: the same helper, after `resolveStreamedCompleteResponse()`, in `lib/poju/poju-chat-stream.ts`.
- LAB / `server_invoke`: `callPOJULLMDirect()` signs the model `response`; if the server then rewrites the stored body, it re-signs the final stored content.

The attestation is an HMAC-SHA256 over a canonical payload `{ v: 1, session_id, role: "assistant", content }`, domain-separated as `poju-assistant-history`, using the existing Decision Authority server-only secret (`POJU_AUTHORITY_SIGNING_SECRET`, with the same fallbacks as Freeze receipt signing). The client can store the returned `assistant_history_attestation` on the message; it cannot mint a valid signature without that secret. A client-supplied `trusted` flag, unsigned metadata, or a copied signature bound to different content or another `session_id` does not verify.

`agent.ts` copies the server attestation onto the stored assistant message. If local post-processing changes the display text, the signature stays bound to the exact server-signed text via `attestation.content`. Prompt construction uses the verified signed text, not the rewritten display body, and does not relabel the rewrite as trusted.

Prompt policy, implemented in `lib/poju/shared/assistant-history-provenance.ts` and verified by `lib/poju/decision-authority/server/assistant-history-attestation.ts`:

- Valid HMAC: include the signed assistant text as a trusted reply (no unverified prefix).
- Present but invalid or cross-session signature: drop from the Prompt. Do not relabel as trusted.
- Unsigned assistant text in a Session that already has at least one valid attestation: drop from the Prompt (post-R2 injection).
- Unsigned assistant text in a pre-R2 / all-unsigned Session: keep the stored record, and include the text in the Prompt only with the prefix `[Unverified client-held history — not a server-attested assistant reply]`. This is compatibility for refresh / restore, not proof of origin.
- User turns still enter the Prompt normally. Session records are not deleted or rewritten by Prompt construction.

## Known limitations

- There is still no authoritative server Session store. Pre-R2 Sessions contain only unsigned assistant rows, and this implementation cannot distinguish a legitimate historical assistant reply from a client-forged unsigned one without a larger storage rewrite. Those rows remain in the Session and can still enter the Prompt, but only as unverified history, not as server-attested replies.
- A client that strips every valid attestation from a post-R2 Session can make that Session look like a pre-R2 unsigned Session. Residual risk for that downgrade exists until assistant history has an authoritative server record.
- Session expiry still uses the client-held `expires_at` field. Missing or unparsable values remain fail-closed. This was already recorded as an unresolved FU1 limitation and is unchanged.
- Client-side display rewrites (Dyad gate copy, collecting catch prefix, forward-move append, and similar) are not themselves attested on the browser path. The Prompt uses the attested server `response` when the signature is present. The display record is kept.
- If the authority signing secret is missing in production, new replies cannot be attested (`signAssistantHistoryAttestation()` returns null) and fall back to the unsigned policy. Production already requires this secret for Freeze receipts.
- This run did not execute real OpenRouter calls, real report-model generation, real charging or Pass consumption, or a browser LAB acceptance pass.

## Test results

`scripts/test-m8-r1-internal-turn-trust-boundary.ts` kept the existing M8-R1 and FU1 cases and added R2 Prompt-construction / API-boundary cases. The official log recorded 35 `PASS` lines and a clean completion message. Exit code 0.

New R2 cases in this run:

- Forged assistant history is not treated as a server-trusted reply
- Ordinary user messages still enter the Prompt, and system/developer/tool stay filtered
- Server-generated attested assistant replies are retained as trusted Prompt history
- API-attested assistant replies stored after a real chat turn remain trusted
- Forged assistant text with a fake signature or copied metadata is dropped from the Prompt
- Restoring an old unsigned Session keeps legitimate dialogue without deleting records
- Non-stream and stream chat entries attest the same resolved assistant response
- Locally rewritten display text does not replace the attested server reply in the Prompt
- Prompt construction does not mutate DC, Blueprint, DIR, Readiness, Receipt, Report Job, Charge, or Pass

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
