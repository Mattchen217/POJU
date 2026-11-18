# DI2 Understanding composer-flow evidence

Date: 2026-11-18 (America/Chicago)

This record documents product-flow wiring work on `feat/m1-r-fresh-session-main-loop`. It is not a declaration that DI2, M9, or M9-R1 is accepted, and it is not proof that the full live product path has been end-to-end accepted.

## Baseline

- Required re-fetch was performed before edits.
- Local and `origin/feat/m1-r-fresh-session-main-loop` HEAD were both `830a46bd1292875833e18553a1e9bff86d81172b`.
- Subject: `Record DI2 feature-landing main-path evidence`.
- Implementation parent of the previous landing remained `c72b81a7121ef2d18568ea86cfc310a4912c57b0`.
- The branch had not moved past the already-confirmed baseline.

## Implementation

- Implementation SHA: `2509983008b8474b3edd8ed8c39e5ce071be43d8`
- Parent SHA: `830a46bd1292875833e18553a1e9bff86d81172b`
- Evidence SHA is intentionally omitted from this file.

## What landed in production code

### Unified Decision Understanding box (section 7.2)

- Layout: `PojuChat` now has a `composerTop` slot inside `.pchat__inputbar`, above `.pchat__composer-unit`.
- The box is not an ordinary chat message. It is not placed in `inlineNotice`, and it is not hidden by `centerSlot`.
- Message-list scroll does not take the box with it, because it lives in the fixed bottom composer dock.
- Mobile and desktop share the same slot; CSS caps height and allows the box itself to scroll.
- `DecisionUnderstandingPanel` is rendered only through `composerTopNode`. `inlineNotice` keeps OffTopic and Segment2 preparing only, so there are not two Understanding boxes.

7.2 regions, in order:

1. Title: `决策理解` / `DECISION UNDERSTANDING`
2. DDR / DIR / Sufficiency Gate progress bar and percentage from existing Understanding State (`projectDecisionUnderstandingBox`). Not computed from question count. Not shown as 100% unless completion conditions are met.
3. Current understanding
4. Already understood (confirmed facts only)
5. Still need to understand (unsatisfied needs, plus open-conflict statements without IDs)
6. Personal Pattern Insight, only when a substantive new insight exists; labeled as traditional interpretation or an unverified hypothesis; never written into RealityFacts
7. Current question

Internal field names, DIR IDs, DDR IDs, direction IDs, raw readiness verdicts, and budget debug fields are not shown to ordinary users.

### Quick replies

- The three authorized quick replies remain inside the input box, in `.pchat__composer-options` / `PojuReplyOptions`.
- They are still driven by `activeComposerOptions` and `handleComposerOptionPick`.
- Options still come from the current valid assistant message and are capped at three. Consumed or stale options are not reused.
- The Understanding box does not render a second set of reply buttons or `UnderstandingGateActions`.

### Confirm / supplement

- When a DI2 session is in `awaiting_confirmation`, the official confirm chip (`确认并继续` and locale equivalents) is sent through `handlePojuSend` into the existing `confirmUnderstandingAndFreeze` path.
- It is no longer routed to `startSynthesisAfterGateConfirm` for DI2 sessions. Legacy sessions without a Blueprint keep the previous synthesis confirm path.
- Official confirm labels are recognized as final-confirm text, which previously failed for Chinese/Spanish/French chip labels such as `确认并继续`.
- A non-confirm user turn at the readiness gate is treated as a supplement: phase returns to `collecting_context` and the existing Adaptive Question Engine continues. Confirmed Decision Context facts are not dropped.
- Confirm still requires the existing Readiness / Confirm / Freeze authority path. The client does not Freeze on its own before user confirm.

### Report delivery chain checked in production code

Existing wiring was reused, not redesigned:

1. User confirm in `handleUserMessage` can enter `confirmUnderstandingAndFreeze`.
2. After Freeze, `currentDi2FreezeId()` plus `di2ReportNeedsAutoStart()` / `di2ReportShouldResume()` auto-start or resume `runDecisionReportForSession`.
3. The report job binds the Freeze `context_id` / version / hash through the existing decision-report client and routes.
4. Personal Analysis and the eight-page report continue to use the same report job and Freeze snapshot / PageFeedMatrix.
5. Formal delivery still depends on completed report state (`main_delivery_done` / completed job), not an in-flight job.
6. Refresh resumes via `pending_decision_report_job_id` and the existing persist/reload path.
7. Existing M5 start/reuse semantics remain the no-double-charge / no-duplicate-job contract; this round did not add a second billing path.
8. Q&A Understanding is hidden when `di2ReportSurfaceActive` (pending DI2 report job, in-flight report, completed delivery, or current Freeze id).

### Old UI vs DI2 UI

- DI2 sessions with `decision_understanding` show the unified box, not `AgendaProgressPanel`.
- Legacy sessions without Understanding State still use `AgendaProgressPanel` in the same composer-top dock.
- Internal stage names are not added to the user-facing box.
- During report generation, the Q&A box is hidden; report progress continues to use the existing thinking line / report client progress path.
- Intake lockout / resume / terminate / expiry banners were moved to composer-top and now use `intakeProtectionBannerMessage()` so the previously corrupted UI placeholders are no longer shown.

## Reused modules vs files changed

Reused: Decision Context, Blueprint, Understanding State, Adaptive Question Engine, confirm-and-freeze, decision-report-client / routes, M5 persist and recovery, PageFeedMatrix, PojuReplyOptions, existing Readiness / Freeze / report authority.

Changed:

- `components/poju/PojuChat.tsx`
- `components/poju/poju-chat.css`
- `components/poju/POJUChatUI.tsx`
- `components/poju/DecisionUnderstandingPanel.tsx`
- `lib/poju/decision-intake/ui-projection.ts`
- `lib/poju/decision-intake/confirm-and-freeze.ts`
- `lib/poju/decision-intake/intake-protection.ts`
- `lib/poju/agent.ts`
- `package.json`
- `scripts/test-di2-understanding-composer-flow.ts` (new)

## Still not landed / UNVERIFIED

- Real OpenRouter Initial Understanding, Blueprint, Adaptive Question, Personal Analysis, and eight-page report were not run in this round.
- Real browser E2E was not run.
- Real Redis / Lua was not executed (`REAL_REDIS_LUA_EXECUTED=no` on the M9-R1 SUITE logs).
- No credentials were added and nothing was deployed.
- Test harness / MemoryKv results are not live production evidence.
- M9-R1 as a whole remains previously unaccepted pending independent review.

## public/sw.js

- SHA-256 before `pnpm build`: `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980`
- SHA-256 after `pnpm build` rewrote the file: `413df24aafd65a0bd654a3bebd0731c902db9662fa2efe60b3b701d4ce2fb54e`
- Restored byte-for-byte to `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980` and left unstaged. `MATCH`

## Git delivery

- Implementation and evidence commits are separate.
- Only `feat/m1-r-fresh-session-main-loop` is to be pushed.
- No PR, no merge to main, no deploy, no rebase, no force-push.
- This record does not declare product-flow PASS or DI2 PASS.
