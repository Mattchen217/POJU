# M2.4-R2-FU4 — Clarification Semantic Safety & Terminal Pending Lifecycle

Production-code repair on `feat/m1-r-fresh-session-main-loop`. This is an evidence record, not a product PASS declaration.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Baseline / parent of the implementation: `15ab21e2d3b1c08b7b742f87f4f773742ededc2e`
- Implementation SHA (all official regressions ran on this commit): `e2b0a84ff26dec5305a1a79be24a75940faccd6f`
- Evidence tip SHA: _(left empty / pending Max review)_
- Observed `origin/main` at authorization / start of this work: `ee8c96e8a7a128fa8e059c2a9f81c9f0d2127688` (not merged, not rebased onto)

## Goal

1. Fix clarification parsers so negation and uncertainty are recognized before affirmation. A phrase that merely contains an affirmative keyword must not be classified as explicit, confirmed, or role-bound.
2. Fix the last-item refusal lifecycle. After the last pending item is refused, do not restore or resend the old `clarification_plan`. Enter an explicit terminal rejected state, keep an auditable rejection record that is not a DC fact, and allow formal investigation to plan the next legal NeedItem only after that terminal processing completes.
3. Add dedicated `definition_patch` production-path cases FU4-A through FU4-E, plus negation and terminal-resume cases, all through real `handleUserMessage()`.

## Files changed

### Implementation commit `e2b0a84ff26dec5305a1a79be24a75940faccd6f`

- `lib/poju/decision-intake/types.ts`  
  Documented that `status: "pending"` is the active orchestration state (nonempty `unresolved_items`) and `status: "rejected"` is a terminal audit record. The terminal state must not keep a resendable `clarification_plan`, is not an unanswered clarification task, and is not a DC fact.

- `lib/poju/decision-intake/pending-answer-resolution.ts`  
  Negation-first parsers; explicit active vs terminal helpers; work-role alias; terminal plan clearing.

- `lib/poju/decision-intake/adaptive-turn.ts`  
  Only an active pending resolution enters the pending handler. After the last item is refused (or the last remaining bind leaves only rejected items), `continueInvestigationAfterTerminalRefusal()` plans the next legal NeedItem. Original-source replay of a terminal/inactive pending uses `replayInactivePendingResolution()` and does not recount budget or restore the old clarification.

- `scripts/test-m1-production-adaptive-question-loop.ts`  
  FU4-A through FU4-E, FU4-N1/N2/N3 (required phrases on the production path), FU4-T (terminal resume + original-turn replay). Honest FU3-E update described below.

Honest extras beyond the brief file list: none in production besides the type comment in `types.ts` (the brief already allowed `types.ts` if needed). `agent.ts` was not modified; existing persist / field-merge already keeps `pending_answer_resolution`, including a terminal `rejected` record. `conflict-clarification.ts` was not modified; parsers only reused conservative clause/polarity ideas. Constraint mapper, Question Generation, Freeze / Readiness / Confirmation authority, Conflict Clarification rules, and Blueprint / DIR / DDR scope were not changed.

### Evidence commit

This file. Tip SHA left empty / pending Max review. The implementation SHA recorded above is the SHA the tests actually ran on.

## Call chain

`handleUserMessage()` → `runAdaptiveQuestionTurn()`:

1. Conflict clarification remains the highest-priority branch (unchanged rules).
2. If `isActivePendingAnswerResolution()` is true (`status === "pending"` and `unresolved_items` is nonempty), the turn is handled by `handlePendingAnswerResolutionTurn()`. That path parses the user reply with:
   - `parseClarificationRoleChoice()`
   - `parseCertaintyChoice()`
   - `parseConstraintConfirmChoice()`
   - `parseDefinitionPatchChoice()`
   All four recognize negation and uncertainty before affirmation. Binding is limited to the current item's `authorized_role_codes`.
3. A successful bind converts only the current resolving item (stable `item_id`) through `answerEventFromPendingBind()`, then the existing DC C1 write path. The item is removed from pending only after C1 persist succeeds. Sibling unresolved items are kept as-is.
4. A refusal first writes the current item into `rejected_items`. If siblings remain, a clarification plan is built for the next item. If `unresolved_items` is empty, `asTerminalRejectedPending()` sets `status: "rejected"` and clears `clarification_plan`. `continueInvestigationAfterTerminalRefusal()` then calls `planFromState()` so a new legal NeedItem may be sent. The terminal rejection record is re-applied onto the resulting session so it is not dropped. Rejected items are not written as RealityFacts or Constraints, and are not interpreted as user confirmation, `unknown`, or `not_applicable`. This path does not specially trigger Readiness or Freeze.
5. If a pending record exists but is not active (terminal `rejected`, or empty unresolved), it is no longer treated as an unanswered ordinary clarification task. On original-source-turn replay, `replayInactivePendingResolution()` restores the already-sent non-clarification NeedItem, does not resend the old clarification, and does not recount budget.
6. `definition_patch_not_persistable` items already enter structured pending from the FU3 continuable-unresolved path. The user can then explicitly choose to record the text as a `reality_fact` (full role-code authorization, write only the authorized DIR/role, clear the item only after C1 persist), refuse (rejected audit, no DC write, no old-plan resend), or remain uncertain (active pending kept; no ordinary `planFromState()`).

Active pending vs terminal rejected state is distinguished by `status` plus nonempty `unresolved_items`. The old clarification is not restored merely because `unresolved_items.length === 0`.

## Parser behavior (production path)

Negation and uncertainty outrank affirmative keywords. Classification does not use a naive "includes affirmative keyword" test.

`parseCertaintyChoice` (exercised by FU4-N1 via `handleUserMessage()`):

- `明确事实` → explicit (writes `user_asserted`)
- `这是明确事实` → explicit
- `个人估计` → estimated (writes `user_estimate`)
- `仍然只是估计` → estimated
- `不确定` → unclear (no DC write, pending kept)
- `不明确` → must not be explicit (pending kept)
- `我不认为这是明确事实` → must not be explicit (pending kept)
- `不是明确事实` → must not be explicit (pending kept)

`parseConstraintConfirmChoice` (FU4-N2):

- `确认这是明确约束` → confirmed (Constraint written as `user_asserted`)
- `1` → confirmed
- `仍然只是估计` → not confirmed (pending kept, no write)
- `目前无法确定` → still uncertain (pending kept, no write)
- `我不确认这是明确约束` → must not be confirmed
- `不是明确约束` → must not be confirmed
- `不可以写入` → must not be confirmed

`parseClarificationRoleChoice` (FU4-N3; bind only the current item's authorized role codes):

- `工作角色` → binds the unique work-role option (`DIR-STATUS-QUO` / `status_quo`, aliased as `工作角色`)
- `不是工作角色` → unclear; no DC write
- `不是A，是B` → binds B only when B is uniquely parsed and uniquely belongs to the authorized options
- `我不确定是不是A` → unclear; no DC write
- Mentions two authorized roles at once → unclear; no DC write

If parsing is not reliable, pending is kept and nothing is written to DC.

## Terminal refusal lifecycle

- Each refusal writes the current item into `rejected_items` first.
- Remaining unresolved siblings keep an active pending clarification for the next item.
- When unresolved items are empty, the record becomes terminal (`status: "rejected"`, `clarification_plan: null`).
- Formal investigation may then plan and send the next legal NeedItem.
- The rejection record remains on the session across persist/reload and is not a DC fact.
- Original pending replay does not deduct budget again and does not restore the refused clarification.

## FU3-E honest assertion update

FU3-E previously asserted that `nextDirs` stayed equal to the original last-sent DIRs, and treated an assistant turn containing `要不要离职` without `待澄清` as a failure. That implicitly required the session to remain stuck on rejected pending and never resume ordinary investigation.

This task authorizes the opposite terminal behavior. FU3-E was updated honestly:

- Still asserts: no RealityFact or Constraint write, DC version unchanged, auditable `rejected` record with the refused item, record survives reload, `clarification_plan` is cleared, the old clarification / `待澄清信息` is not resent, refusal does not trigger `【理解确认】`.
- After terminal processing, a new legal NeedItem may be sent.

Other FU3-A through FU3-H assertions were not deleted or lowered.

## FU4 and retained suite results

All of the following were executed through real `handleUserMessage()` on implementation SHA `e2b0a84ff26dec5305a1a79be24a75940faccd6f`. Model drafts were injected only through existing `__testOnlyM1Hooks.interpretAnswerModel`. Persist failure used `__testOnlyM1Hooks.pendingBindPersist`. No production bypass switch and no live OpenRouter.

- FU4-A: `definition_patch` creates `definition_patch_not_persistable` pending; no DC write; DC version unchanged. PASS
- FU4-B: user explicitly chooses to record it as a fact; converts to `reality_fact`; full role-code authorization; writes only the authorized DIR/role; pending cleared only after C1 persist succeeds. PASS
- FU4-C: user refuses; no RealityFact or Constraint; rejected item recorded; old clarification plan not resent; readiness confirm not triggered. PASS
- FU4-D: user remains uncertain; pending kept; DC unchanged; does not enter ordinary NeedItem planning. PASS
- FU4-E: C1 persist failure leaves no half-committed DC, keeps pending, and retry writes the fact once. PASS
- FU4-N1 / N2 / N3: required certainty, constraint-confirm, and role phrases as listed above. PASS
- FU4-T: last-item refusal completes terminal processing, can resume ordinary investigation, rejection record survives reload, original-turn replay does not write DC or recount budget, old clarification is not restored. PASS
- FU3-A through FU3-H: PASS (with the honest FU3-E terminal-resume adjustment above)
- Prior A–F, G–M, N–T, U–Y, Z1–Z25, FU2-A–H, and the static production-path check: PASS

`scripts/test-m1-production-adaptive-question-loop.ts`: PASS=108 FAIL=0.

## Official regressions

All commands were run on implementation SHA `e2b0a84ff26dec5305a1a79be24a75940faccd6f` after the implementation commit and before this evidence commit.

| Command | Exit code | Result |
| --- | ---: | --- |
| `pnpm test:m1-production-adaptive-question-loop` | 0 | PASS=108 FAIL=0 |
| `pnpm test:m1-r-fresh-session-main-loop` | 0 | PASS=8 FAIL=0 |
| `pnpm test:m2-3-decision-blueprint` | 0 | 18 passed, 0 failed |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | 19 passed, 0 failed |
| `pnpm test:m2-2-freeze-report-binding` | 0 | 43 passed, 0 failed |
| `pnpm test:decision-context-phase2` | 0 | 9 passed |
| `pnpm exec next typegen` | 0 | Types generated successfully |
| `pnpm exec tsc --noEmit` | 0 | clean |
| `pnpm build` | 0 | Next.js build completed |

## Uncovered items / residual risks

- The parsers are conservative clause/polarity heuristics, not a full Chinese NLP parser. Unseen double-negation or highly colloquial forms may remain unclear. In those cases the system fail-closes: pending is kept and DC is not written.
- FU4-N3 seeds a unique work role (`v1/dir/DIR-STATUS-QUO/role/status_quo`) plus a second authorized role so `工作角色` has a unique authorized match. The default first `last_sent_question` codes from the job fixture were not themselves work-related; the test constructs the authorized set rather than widening production role matching or Blueprint scope.
- `definition_patch` is covered for pending creation, fact conversion, refusal, uncertainty, and persist failure. Other writer-limited `semantic_kind` values were not given additional dedicated FU4 cases beyond the FU3 continuable-unresolved path.
- A mixed pending batch that is partly refused and partly still-unclear in the same later turn is covered by the general lifecycle (active pending continues while unresolved items remain) but does not have a separate extra named case.
- `agent.ts` was inspected and left unchanged. Existing persist already keeps the terminal rejected record and does not treat it as a DC fact.

## Git boundary

- Production implementation and evidence are separate commits.
- No pull request was opened.
- `main` was not merged or rebased onto.
- No deploy and no Vercel promote.
- This document does not declare product PASS. Delivery waits for independent review.

Implementation SHA: `e2b0a84ff26dec5305a1a79be24a75940faccd6f`  
Parent SHA: `15ab21e2d3b1c08b7b742f87f4f773742ededc2e`  
Evidence tip SHA: _(pending Max review)_
