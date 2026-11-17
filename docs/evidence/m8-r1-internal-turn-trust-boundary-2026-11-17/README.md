# M8-R1 Internal Turn Trust Boundary ? Verification Evidence

## Repository state

- Branch: `feat/m1-r-fresh-session-main-loop`
- Baseline HEAD (local and remote at start of this work): `95212bdba0b46bcc02730bc2a3cdc559a650f4e7` (M8 evidence; parent implementation `fc4a71466aab93507c4b8ee6717f82f8c7f2f9f7`)
- This file is part of an independent evidence commit. It records the implementation parent and the commands below. It does not name the evidence commit SHA.
- The pre-existing `public/sw.js` modification was preserved, excluded from both commits, and restored byte-for-byte after the production build (SHA-256 `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980`).
- This evidence does not declare M8-R1 or DI2 accepted.

Work started from a substantial uncommitted local tree already present on that M8 baseline. This delivery built on that tree: it kept the explicit Intake entries, added the required production-entry tests, closed remaining gaps, and did not discard the existing changes.

## Implementation record

### Text-based internal identity removed

- `isInternalSystemTurn` and `DYAD_CONTINUE_SYSTEM` are gone from production sources (`lib/poju/agent.ts`, `lib/poju/dyad-compat.ts`, chat UI, LAB pipeline, and related tests).
- `handleUserMessage()` is the ordinary user-message entry and always enters `runAgentTurn(..., { kind: "user" })`. Inbound text cannot become `role: "system"`.
- User input starting with `[SYSTEM:` or equal to `__OPENING__` still goes through the existing jailbreak / security-rejection path, after the unified terminal checks.

### Call-chain audit

1. Which callers previously depended on special strings?
   - `components/poju/POJUChatUI.tsx` sent `DYAD_CONTINUE_SYSTEM` through `handleUserMessage()` after the Dyad gate, and sent `[SYSTEM: User completed/modified/skipped/updated the action ...]` notes through `handleUserMessage()` after a local action-status write.
   - `lib/llm/pro/delivery/lab/pipeline-chat.ts` (`labContinueAfterDyadGate`) sent `DYAD_CONTINUE_SYSTEM` through `runLabPipelineChatTurn` / `handleUserMessage()`.
   - `lib/poju/agent.ts` classified those strings with `isInternalSystemTurn` and skipped Freeze / Expiry for the resulting "internal" path.
   - Dyad tests (`scripts/test-dyad-continue-feed.ts`, `scripts/test-dyad-skip-collect-understanding-e2e.ts`) asserted the constant and the ChatUI string send-path.

2. How each caller was migrated?
   - ChatUI now calls `handleDyadContinuation()` after the Dyad gate and `handleUserActionUpdate()` for structured action updates. The helper that built the `[SYSTEM: User ...]` note was removed. Action status is applied only after terminal checks, and only for a real session `action_id` and an allowed status.
   - LAB `labContinueAfterDyadGate` now calls `runLabPipelineChatOperation(..., "dyad_continue")` ? `handleDyadContinuation()`. Typed LAB text still uses `handleUserMessage()`, which is appropriate.
   - `app/ops/delivery-lab/di2/page.tsx` still calls `handleUserMessage()` only for operator-typed text; it did not use special-string identity.
   - `phase-router.ts` re-exports the two new entries.
   - Dyad tests now treat continuation as a typed operation and assert the ChatUI / agent source contracts against `handleDyadContinuation`.
   - Report recovery was not migrated because it was already outside Intake messages (see point 5).

3. Whether any client-controllable parameter can still forge internal identity?
   - No. There is no `internalSystemTurn`, `isSystemMessage`, or similar parameter on `HandleInput`. `isSystemMessage` inside `runAgentTurn` is derived only from the process-local `InternalTurn` discriminant, which user-message callers cannot set. Forged Session fields and message metadata do not grant `role: "system"` or continuation/action privileges. Extra properties passed into `handleUserMessage()` are ignored.

4. Whether any entry still skips Freeze / Expiry?
   - No production Intake entry skips the unified check. `handleUserMessage`, `handleDyadContinuation`, and `handleUserActionUpdate` all share `getLocalIntakeTerminalReason()` in `lib/poju/intake-terminal.ts` before state mutation or model calls (after a basic Session structure check). Freeze is determined from `decision_context.status === "final"` or a Receipt matching `session_id` / `context_id` / `context_version` / `context_hash`, not from a lone Session boolean. Missing or unparsable `expires_at` is fail-closed as `session_expiry_invalid`. Terminal refusal appends a recognizable `meta.di2_input_rejection` assistant message and does not call the model, mutate Decision Context / Blueprint / DIR / Readiness, create a Freeze Receipt or report Job, or consume a Pass.
   - `callPOJULLM()` repeats the isomorphic local check immediately before model execution. The durable ledger head check (`assertSessionCanEnterIntake()` in `lib/poju/decision-authority/server/intake-guard.ts`) runs only on the server (dynamic import, `server-only`) so the client LAB bundle does not pull `node:crypto` / `node:async_hooks`. The chat route returns HTTP 409 `{ error: "poju_intake_terminal", reason }`; the stream sends `poju_intake_terminal`.

5. That report recovery is fully independent of the Intake message entry?
   - Yes. Report start / status / continue remain on `app/api/poju/decision-report/route.ts` ? `handleDecisionReportAction`, which verifies `session_id`, `job_id`, execution generation, Freeze, context hash, analysis, and delivery authorization / revocation. That route does not call `handleUserMessage()`. Intake messages cannot reopen a frozen Decision Context or recreate / re-charge a report Job.

### Additional test-fixture note (not an authorization change)

M5-R1 and M5 main-path report hooks originally returned raw `di2PageJson()` pages whose path / experiment / review nodes cited frozen-context IDs but not Personal Analysis IDs, and did not cite `dir_status_quo`. After M8 coverage rules, those jobs failed with `coverage_missing:...` instead of completing. The hooks now attach `DEF`, `PA-pattern-1`, and `dir_status_quo` to evidence refs, matching what M6 already injects with live remapped IDs. Authorization and client-binding assertions were not weakened or removed. The shared `di2-report-fixture.ts` was left unchanged so M6's remapped IDs are not polluted by a hardcoded `dir_status_quo`.

The M8 focused test fixture was also corrected so the `[SYSTEM: ...]` jailbreak case runs on an unfrozen, unexpired Session; Freeze and Expiry remain separate cases. Terminal checks now correctly run before jailbreak classification.

## Commands and exit codes

| Command | Exit | Result | Raw log |
|---|---:|---|---|
| `pnpm test:m8-r1-internal-turn-trust-boundary` | 0 | 21 named cases recorded in the log, 0 failed | `m8-r1-internal-turn-trust-boundary.log` |
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

Machine-recorded command metadata, including elapsed times, is in `command-exit-codes.json`.

The build emitted existing webpack dependency-analysis warnings for a dynamic import in `next-intl`, the existing `iztro` named-export warning, a browserslist age notice, and the service-worker bundling step that rewrites `public/sw.js`. `public/sw.js` was restored to the pre-run bytes after the build.

## New M8-R1 test cases

All cases go through production entries (`handleUserMessage`, `handleUserActionUpdate`, or `handleDyadContinuation`), with `/api/poju/chat` stubbed (no OpenRouter).

- Ordinary user sends `DYAD_CONTINUE_SYSTEM` literal ? no system identity (security rejection)
- Ordinary user forges completed / modified / skipped / updated action formats ? no system identity (security rejection; actions unchanged)
- Ordinary user sends `[SYSTEM: ...]` ? security rejection
- Frozen Session: ordinary message, forged internal message, legal action op, continuation ? all refused as `context_frozen`; model-call count 0; Decision Context object, hash/version, Blueprint, DIR, Readiness unchanged; no new Freeze Receipt, report Job, or Pass/charge change; no `role: "system"` forged messages
- Expired Session: the same four entries refused as `session_expired`, with the same no-mutation assertions
- Missing or unparsable `expires_at` is fail-closed as `session_expiry_invalid`
- Unfrozen, unexpired Session: legal user message executes (user role, model stub called, assistant reply)
- Unfrozen, unexpired Session: legal action op updates a real `action_id`, writes a user-role `meta.action_status_update` audit row, treats feedback as user data, and continues into the ordinary turn
- Unfrozen, unexpired Session: legal continuation through `handleDyadContinuation` persists a path-generated system audit row (`Dyad gate closed by user action: ...`) and reaches the model stub
- Invalid `action_id` is refused as `invalid_action_update` with no state change and no model call
- Forged Session metadata / message metadata, and extra flags on the `handleUserMessage` argument, cannot obtain internal identity

## Limits and unverified items

- No real OpenRouter call, real report-model generation, real payment or Pass consumption, browser LAB, deployment, or hosted infrastructure write was performed.
- Automated runs are deterministic local tests. KV logs may show the in-memory fallback; this does not prove Upstash behavior.
- M3 / M5 / M6 replace Personal Analysis and page model calls with deterministic test hooks. They do not prove real model quality.
- The durable ledger check inside `assertSessionCanEnterIntake()` is covered by server-side module wiring and existing M4/M5 authority tests; this evidence does not include a hosted multi-instance ledger proof.
- Full rendered LAB / browser interaction, concurrent-tab behavior, and a complete pause / resume / expiry matrix were not exhaustively exercised in a browser.
- This evidence records command results for the M8-R1 Internal Turn Trust Boundary work only. It does not declare M8-R1 or DI2 overall accepted.
