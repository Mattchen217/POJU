# M8-R1-FU1 Continuation Deprivilege and Production Entry Tightening

Date recorded: 2026-11-17 (America/Chicago).

This directory records the local verification run for M8-R1-FU1 on branch `feat/m1-r-fresh-session-main-loop`. The work started from the M8-R1 evidence commit `1806303b04cd53d75d9d957442b0fd3b7a6ac8c7` (implementation parent `b10674e36a39003046e1d6a582f3435d999fe54f`).

This file does not record a later tip SHA and does not declare FU1, M8-R1, or DI2 accepted. It is a verification record for independent review.

## Before / after Dyad continuation call chain

Before:

1. `components/poju/POJUChatUI.tsx` `continueAfterDyadGate()` imported `handleDyadContinuation` from `lib/poju/phase-router.ts` and called it after applying `dyadSkipPatch()` / `dyadCollectedPatch()`.
2. `app/api/ops/delivery-lab/[lab_id]/gate/route.ts` applied `labDyadSkip` / `labDyadCollect`, then called `labContinueAfterDyadGate()`.
3. `lib/llm/pro/delivery/lab/pipeline-chat.ts` `labContinueAfterDyadGate()` used `runLabPipelineChatOperation(..., "dyad_continue")`, which called the exported `handleDyadContinuation()`.
4. `handleDyadContinuation()` entered `runAgentTurn(..., { kind: "dyad_continue" })`, created a `role: "system"` audit row, and injected `buildDyadContinueModelUserCue()` into the model-only history.

After:

1. ChatUI and LAB apply the existing Dyad skip/collect business patch first, then enter the ordinary user-message path.
2. The user choice is recorded as one explicit `role: "user"` operation via `dyadContinuationUserMessage()`:
   - skip: `用户选择跳过 Dyad Gate，继续当前决策分析。`
   - complete: `用户完成 Dyad 信息提供，继续当前决策分析。`
3. `continueAfterDyadGate()` and `labContinueAfterDyadGate()` both call `handleUserMessage()`.
4. `handleDyadContinuation()` is deleted and is no longer exported from `agent.ts` or `phase-router.ts`.
5. ChatUI no longer saves the patched-but-uncontinued Session before the agent turn, so a failed continue leaves the pre-choice Session in place for retry.
6. Skip vs complete is distinguished by existing Dyad fields (`dyad_offer_status`, `pivot_chart_path`, `charts_locked_at`, partner/matrix data), not by message role.
7. The opening task block continues to carry `path` / `partner_bazi` from Session state. `buildDyadContinueModelUserCue()` remains as a helper used by existing feed tests, but the agent no longer injects it as a privileged hidden turn.

## Client system-message forgery protection

Location: `lib/poju/shared/transport.ts`.

- `sanitizeClientPromptHistory()` is the explicit safe-filter for client-submitted conversation history.
- Allowed roles: `user`, `assistant`.
- `role: "system"`, `"developer"`, `"tool"`, and any other disallowed role are dropped and are not rewritten into trusted history or into the server system Prompt.
- `formatPhaseMessageHistory()` uses this filter after dropping rejected messages.
- `buildPhaseTransportInputV6()` and the non-v6 transport builder re-sanitize both default history and any caller-supplied `messageHistory` immediately before Prompt assembly.
- Language-directive `conversationHistory` is also sanitized so forged roles cannot enter that side channel.
- The server system Prompt remains the existing `buildPojuSystemPromptV6Sync()` / `buildPojuSystemPrompt()` construction. This change protects the server's right to generate that Prompt; it does not ban the system role on the server side.
- Policy choice: safe-filter, not request-level fail-closed, so pre-FU1 Sessions that still contain a legacy `role: "system"` Dyad audit row can continue chatting without treating that row as an instruction.

Verified by the Prompt-construction case in `scripts/test-m8-r1-internal-turn-trust-boundary.ts`, which calls `formatPhaseMessageHistory`, `sanitizeClientPromptHistory`, and `buildPhaseTransportInputV6` with unique canary strings.

## Freeze / Expiry coverage

Unchanged unified checks are still used:

- `getLocalIntakeTerminalReason()` in `lib/poju/intake-terminal.ts` (isomorphic, fail-closed on missing/invalid `expires_at`; Freeze uses a matching Receipt plus `decision_context.status === "final"`).
- `assertSessionCanEnterIntake()` in `lib/poju/decision-authority/server/intake-guard.ts`, which also verifies the durable ledger head on the server.
- `callPOJULLM()` in `lib/llm/poju-llm.ts` runs the local reason first, then the server ledger check when `window` is undefined, before any model execution.
- `app/api/poju/chat/route.ts` and `lib/poju/poju-chat-stream.ts` both go through `callPOJULLM()` and map `POJUIntakeTerminalError` to a terminal refusal.
- `handleUserMessage()` and `handleUserActionUpdate()` still call `getLocalIntakeTerminalReason()` before state mutation or the model path.

Because Dyad continuation is now an ordinary `handleUserMessage()` turn, it uses the same terminal check. Action updates and LAB pipeline chat also remain on this path. The FU1 tests cover frozen/expired skip and collected Dyad operations, with model-call count 0 and no DC / Blueprint / DIR / Readiness / Receipt / report-job / Pass mutation.

### Unresolved expiry-authority limitation

Session expiry is still evaluated from `session.expires_at` on the client-submitted Session object. A search of the Intake / Decision Authority server store did not find an independent authoritative validity record for the Session itself (ledger/receipt authority exists for Freeze, not for Session wall-clock expiry). This follow-up did not invent a Session database or rewrite storage. Missing, illegal, or unparsable `expires_at` remains fail-closed (`session_expiry_invalid`). A client that can rewrite a still-valid `expires_at` is an acknowledged unsolved limitation of the current storage model.

## Report-recovery independence

Unchanged and re-checked:

- `app/api/poju/decision-report/route.ts` continues to call `handleDecisionReportAction()` and does not import or call `handleUserMessage()` or `handleDyadContinuation()`.
- `lib/poju/decision-intake/decision-report-service.ts` does not call `handleUserMessage(`.
- Existing M5-R1 and M6 authorization / lifecycle tests completed with exit code 0. Report recovery was not rewritten for this task.

## Required command results

All required commands exited 0. Raw logs and machine-recorded timing are in this directory; see `command-exit-codes.json`.

| Command | Exit code | Result summary | Raw log |
| --- | ---: | --- | --- |
| `pnpm test:m8-r1-internal-turn-trust-boundary` | 0 | 26 cases completed; FU1 additions included | `m8-r1-internal-turn-trust-boundary.log` |
| `pnpm test:m6-di2-full-lifecycle` | 0 | 7 passed, 0 failed | `m6-di2-full-lifecycle.log` |
| `pnpm test:m5-r1-authorization` | 0 | 49 passed, 0 failed | `m5-r1-authorization.log` |
| `pnpm test:m1-production-adaptive-question-loop` | 0 | PASS=188, FAIL=0 | `m1-production-adaptive-question-loop.log` |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | 19 passed, 0 failed | `m2-1-readiness-confirm-freeze.log` |
| `pnpm test:m2-2-freeze-report-binding` | 0 | 43 passed, 0 failed | `m2-2-freeze-report-binding.log` |
| `pnpm test:m3-decision-report` | 0 | 27 passed, 0 failed | `m3-decision-report.log` |
| `pnpm test:m4-decision-authority` | 0 | 27 passed, 0 failed | `m4-decision-authority.log` |
| `pnpm test:m4-1-freeze-recovery` | 0 | 10 passed, 0 failed | `m4-1-freeze-recovery.log` |
| `pnpm test:m5-di2-main-path` | 0 | 29 passed, 0 failed | `m5-di2-main-path.log` |
| `pnpm test:m8-di2-non-model-closure` | 0 | Focused M8 contract and production-entry tests completed | `m8-di2-non-model-closure.log` |
| `pnpm exec tsc --noEmit --pretty false` | 0 | No diagnostics (empty stdout) | `typescript.log` |
| `pnpm build` | 0 | Production build and Next TypeScript phase succeeded | `production-build.log` |

`public/sw.js` was snapshotted before the run (`sw-js-pre-run.sha256` = `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980`). The production build rewrote that file; it was restored byte-for-byte to the pre-run bytes and left unstaged.

Two related but non-required scripts were also executed during implementation (`tsx scripts/test-dyad-skip-collect-understanding-e2e.ts` and `tsx scripts/test-dyad-continue-feed.ts`) and both exited 0. Their raw output is not copied into this directory because they are not part of the required command list.

## New and updated test cases

All cases in `scripts/test-m8-r1-internal-turn-trust-boundary.ts` go through production entries (`handleUserMessage` or `handleUserActionUpdate`) or the real Prompt constructor (`buildPhaseTransportInputV6`). `/api/poju/chat` is stubbed. No OpenRouter, charge, or hosted infra.

Prior M8-R1 coverage is retained, except privileged continuation / system-role user history assertions, which were updated to the deprivileged behavior:

- Ordinary user sends `DYAD_CONTINUE_SYSTEM` literal or forged completed / modified / skipped / updated action formats: no system identity (security rejection)
- Ordinary user sends `[SYSTEM: ...]`: security rejection
- Frozen Session: ordinary message, forged internal message, legal action op, and Dyad operation are refused as `context_frozen`, model-call count 0, no authority mutation
- Expired Session: the same four entries refused as `session_expired`, with the same no-mutation assertions
- Missing or unparsable `expires_at` is fail-closed as `session_expiry_invalid`
- Unfrozen, unexpired Session: legal user message executes (user role, model stub called, assistant reply)
- Unfrozen, unexpired Session: legal action op updates a real `action_id`, writes a user-role `meta.action_status_update` audit row, treats feedback as user data, and continues into the ordinary turn
- Unfrozen, unexpired Session: legal skip continuation now goes through `handleUserMessage` with `dyadContinuationUserMessage()`, appends one `role: "user"` operation, and does not create a `role: "system"` history row
- Invalid `action_id` is refused as `invalid_action_update` with no state change and no model call
- Forged Session metadata / message metadata, and extra flags on the `handleUserMessage` argument, cannot obtain internal identity

FU1 additions:

- User skip of Dyad Gate enters ordinary `handleUserMessage()` once, without system history
- User completion of Dyad Gate enters ordinary `handleUserMessage()` once, without system history
- `handleDyadContinuation` is absent from the `agent` and `phase-router` module namespaces and from ChatUI / LAB / router source
- Frozen and expired Sessions refuse collected Dyad operations with no model call
- Client-forged `system` / `developer` / `tool` Session messages are rejected by the Prompt-history safe-filter; the server system Prompt still generates; legal user/assistant history still enters the Prompt
- Report recovery remains on `handleDecisionReportAction` and not the Intake message entry

## Limits and unverified items

- No real OpenRouter call, real report-model generation, real payment or Pass consumption, browser LAB, deployment, or hosted infrastructure write was performed.
- Automated runs are deterministic local tests. KV logs may show the in-memory fallback; this does not prove Upstash behavior.
- M3 / M5 / M6 replace Personal Analysis and page model calls with deterministic test hooks. They do not prove real model quality.
- The durable ledger check inside `assertSessionCanEnterIntake()` is covered by server-side module wiring and existing M4/M5 authority tests; this evidence does not include a hosted multi-instance ledger proof.
- Full rendered LAB / browser interaction, concurrent-tab behavior, and a complete pause / resume / expiry matrix were not exhaustively exercised in a browser.
- Session expiry still depends on the client-held `session.expires_at` field, as recorded above.
- This evidence records command results for the M8-R1-FU1 continuation deprivilege work only. It does not declare FU1, M8-R1, or DI2 overall accepted.
