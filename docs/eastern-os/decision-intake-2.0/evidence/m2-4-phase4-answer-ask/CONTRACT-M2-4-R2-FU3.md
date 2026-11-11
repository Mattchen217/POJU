# M2.4-R2-FU3 — Unresolved Item Lifecycle Completion

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent (baseline / R2-FU2 evidence tip):** `528960e196edd32c31e5e9dd8aca7f4444a64405`  
**Implementation commit:** `1ee64f13f3bf8dad8f1aac297d0167edffe9bf1a`  
**Official regression ran on:** `1ee64f13f3bf8dad8f1aac297d0167edffe9bf1a` (implementation commit; before this evidence-only commit)  
**Evidence tip SHA:** *(empty / pending Max review — this file must not contain a self-referential tip SHA)*  
**Status:** Implementation + tests + this evidence file committed for independent review. **Does not self-declare product PASS.**  
**No PR, no merge, no deploy, no Vercel promote.** No new Vercel preview/tip URL was produced by this work.

## Goal

Complete the unresolved-item lifecycle so any user information the system extracted but cannot legally write to Decision Context is explicitly handled, continuously clarified, or retained as pending — never silently discarded.

This closes two FU2 leftovers:

1. `handlePendingAnswerResolutionTurn()` bound only the first item, then computed remaining items only from this turn's `answer_event.unresolved_items`, so other original pending items could be dropped.
2. Pending only received the three role-binding reasons. `unclear_certainty` and `estimated_constraint_not_persistable` were structured unresolved items but could still fall through to ordinary `planFromState()` and skip to an unrelated NeedItem.

FU1 complete role-code matching and certainty rules were kept. Conflict Clarification / FU6 was not extended. Question Generation was not modelized. Phase 5 was not introduced. Blueprint scope / DIR / DDR were not enlarged. Freeze, Readiness, and Confirmation authority were not changed. The Constraint mapper's hardcoded `verification_level: "user_asserted"` was not changed; an estimated Constraint is still not written until the user explicitly confirms it as an assertion. Pending remains session orchestration state only — not a second fact database, and never written directly into DC.

## Files changed

### Implementation commit `1ee64f13f3bf8dad8f1aac297d0167edffe9bf1a`

Production (brief list):

- `lib/poju/decision-intake/types.ts` — stable `item_id` on `UnresolvedAnswerItem`; `definition_patch_not_persistable`; `PendingAnswerResolutionStatus` includes `rejected`; `rejected_items`, `authorized_dir_ids`, `resolving_item_id`
- `lib/poju/decision-intake/answer-interpretation.ts` — assign `item_id` as `${source_turn_id}#${extracted_index}`; keep bound role on certainty / estimated-constraint / definition-patch unresolved items; definition patches no longer go only to unmapped `proposed_writes`
- `lib/poju/decision-intake/pending-answer-resolution.ts` — one-item bind by `item_id`; continuable reasons beyond role binding; deterministic certainty / constraint-confirm / definition-patch questions; refusal recording; persist key per item
- `lib/poju/decision-intake/adaptive-turn.ts` — pending branch after Conflict clarification and before ordinary `planFromState()`; remaining siblings preserved; C1 persist hook `pendingBindPersist`; fail-closed when a clarification plan cannot be generated
- `lib/poju/decision-intake/apply-answer-to-dc.ts` — `writeAlreadyPresent()` includes DIR / role; incremental same-turn writes require pending source / item / authorization checks; ordinary replay still `turn_already_mapped`

Honest extras beyond the brief file list:

- `lib/poju/decision-intake/answer-interpretation-model.ts` — stopped dropping a second extracted item that shares `semantic_kind` + text with a prior item. That text-only dedupe made FU3-B impossible on the real `handleUserMessage` path (`interpretAnswerWithModel` validates the draft before `answerEventFromModelDraft`). Identity is no longer text alone.
- `lib/poju/agent.ts` — honor an explicit `pending_answer_resolution: null` when merging the collecting session (do not revive a cleared pending with `??`); copy pending onto the planner_blocked early return so FU3-H fail-closed keeps the state

`lib/poju/collecting-dc-turn.ts` and `lib/poju/types.ts` were not modified. The pending field already exists on `POJUSessionState` and already flows through `handleUserMessage` persist/return. Constraint mapper code was not modified.

Tests:

- `scripts/test-m1-production-adaptive-question-loop.ts` — FU3-A through FU3-H, all through `handleUserMessage()` with `__testOnlyM1Hooks.interpretAnswerModel` (and `pendingBindPersist` for FU3-F). Prior A–F, G–M, N–T, U–Y, Z1–Z25, and FU2-A–H kept and passed. No assertion was deleted to make a case pass. Case G / I already used the FU2 pending/clarification assertions; they were not weakened here.

### Evidence commit

- `docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-M2-4-R2-FU3.md` (this file)

## Call chain

Production path used by `handleUserMessage` → `runM1ProductionPreLlmTurn` → `runCollectingDcTurn` → `runAdaptiveQuestionTurn`:

1. Conflict clarification remains the highest-priority branch (`findClarifiedConflictForTurn` / `handleConflictClarificationAnswer`). Role or certainty clarification does not auto-close a Conflict.
2. If `session.pending_answer_resolution` exists (status `pending` or `rejected`): `handlePendingAnswerResolutionTurn` (no new LLM call).
   - Replay of the original `source_turn_id`: restore the already-sent clarification plan; no DC write; no extra budget; no new parallel clarification task.
   - Identify exactly one `resolving_item` by stable `item_id`.
   - Parse the user reply against that item's reason (role / certainty / constraint confirm / definition-as-fact, or refusal / still-unclear).
   - Refusal: record an auditable `rejected_items` entry; do not write a fact; keep pending (`status: "rejected"` when nothing remains to resolve); do not call ordinary `planFromState()`.
   - Still unclear / still estimated: keep the item pending, restore or refresh the current-reason clarification, do not jump to another NeedItem.
   - Legal bind: `answerEventFromPendingBind` converts **only that item**, then re-enters `answerEventFromModelDraft` (full role-code and certainty checks). Follow-up unresolved reasons on the same `item_id` (for example role bound then certainty still illegal) stay pending with the updated reason.
   - `applyAnswerEventToSessionDc(..., allow_incremental_same_turn: true, incremental: { pending_source_turn_id, authorized role/DIR set, resolving_item_id })`. The item is removed from pending only after bind success **and** C1 persist success.
   - Persist key: `dc_collect:{session}:{source_turn_id}:resolve:{item_id}` (unique per item; retry of a failed persist uses the same key). Test hook: `__testOnlyM1Hooks.pendingBindPersist`. On persist failure the caller session is the original uncommitted session; pending is kept; no half-committed DC.
   - Remaining siblings are kept unchanged (text, certainty, reason, sent_question_id, authorized role codes, `item_id`). A new clarification plan is generated for the next `item_id` (`plan_id` includes that id so replay does not recount the previous question).
   - Clear pending only when every item has a legal write or an auditable refusal. Ordinary `planFromState()` runs only after pending is fully cleared with no rejected remainder.
3. Else ordinary path: `interpretAnswerWithModel` → `answerEventFromModelDraft` (each extracted item gets a stable `item_id`; legal items only in `proposed_writes`; continuable failures go to `unresolved_items`).
4. Unresolved continuation branch **between** `answerEventFromModelDraft()` and ordinary `planFromState()`:
   - Legal `proposed_writes` still go through `applyAnswerEventToSessionDc` + C1 persist.
   - Continuable unresolved items (`unlocated_role_code` / `unauthorized_role_code` / `illegal_role_code` / `unclear_certainty` / `estimated_constraint_not_persistable` / `definition_patch_not_persistable`) create or merge `pending_answer_resolution`.
   - Clarification text is deterministic from the current authorized roles / DIR needs or from the certainty / constraint / definition-patch prompts. Blueprint scope / DIR / DDR are not enlarged. `conflict_clarification` is forced null. The model cannot invent roles.
   - If a clarification question cannot be generated: keep pending, return `planner_blocked` with `ask_error=pending_clarification_plan_failed` (non-terminal; do not claim investigation complete; do not call ordinary `planFromState()`).
5. Agent `attachAuthorizedAssistantQuestion` marks the clarification plan as `last_sent_question` and charges budget only when `plan_id` is new. An explicit `pending_answer_resolution: null` is preserved when pending is cleared.

Pure model-call failure or invalid schema still fail closed on the existing `answer_interpretation_failed` / `answer_interpretation_invalid_schema` path and is not treated as role-binding unresolved.

## FU3-A through FU3-H

All eight cases went through real `handleUserMessage()`. Official run on implementation SHA `1ee64f13f3bf8dad8f1aac297d0167edffe9bf1a`:

| Case | Result | What was asserted |
| --- | --- | --- |
| FU3-A | PASS | One answer yields three unresolved items. User binds a role one at a time. Each turn writes exactly one fact; pending shrinks by one; pending clears only after the last item. |
| FU3-B | PASS | Same `source_turn_id`, identical text, different `item_id`, different authorized roles. Both write to their own DIR/role after separate clarifications; `writeAlreadyPresent()` does not drop the second. |
| FU3-C | PASS | Unclear item: no RealityFact/Constraint write, no DC version bump, pending created, certainty clarification asked. User replies「不确定」: pending remains, no NeedItem jump. |
| FU3-D | PASS | Estimated Constraint: no write and no disguise as `user_asserted`; pending created. 「仍然只是估计」 keeps pending. 「确认这是明确约束」 writes Constraint as `user_asserted` and clears pending. |
| FU3-E | PASS | 「拒绝澄清」 does not write a fact, does not jump to another NeedItem, records `status: "rejected"` + `rejected_items`, and survives `savePOJUSession` / reload. |
| FU3-F | PASS | `pendingBindPersist` returns `committed: false`: original DC unchanged, no half-committed fact, pending kept, fail-closed assistant. Retry without the hook writes the fact once. |
| FU3-G | PASS | After each item bind, persist and reload. Remaining `item_id`s, authorized role codes, clarification plan, and budget accounting stay correct. |
| FU3-H | PASS | Pending with no generable clarification plan: pending kept, `planner_blocked` / `pending_clarification_plan_failed`, no ordinary NeedItem question, no DC write. |

Prior suite in the same file (A–F, G–M, N–T, U–Y, Z1–Z25, FU2-A–H) also passed on that SHA. Adaptive loop official total: **PASS=99 FAIL=0**.

## Official regressions

All commands below ran on implementation SHA `1ee64f13f3bf8dad8f1aac297d0167edffe9bf1a`.

| Command | SHA | Exit code | Notes |
| --- | --- | --- | --- |
| `pnpm test:m1-production-adaptive-question-loop` | `1ee64f13f3bf8dad8f1aac297d0167edffe9bf1a` | 0 | PASS=99 FAIL=0, including FU3-A–H |
| `pnpm test:m1-r-fresh-session-main-loop` | `1ee64f13f3bf8dad8f1aac297d0167edffe9bf1a` | 0 | PASS=8 FAIL=0 |
| `pnpm test:m2-3-decision-blueprint` | `1ee64f13f3bf8dad8f1aac297d0167edffe9bf1a` | 0 | 18 passed, 0 failed |
| `pnpm test:m2-1-readiness-confirm-freeze` | `1ee64f13f3bf8dad8f1aac297d0167edffe9bf1a` | 0 | 19 passed, 0 failed |
| `pnpm test:m2-2-freeze-report-binding` | `1ee64f13f3bf8dad8f1aac297d0167edffe9bf1a` | 0 | 43 passed, 0 failed |
| `pnpm test:decision-context-phase2` | `1ee64f13f3bf8dad8f1aac297d0167edffe9bf1a` | 0 | 9 passed |
| `pnpm exec next typegen` | `1ee64f13f3bf8dad8f1aac297d0167edffe9bf1a` | 0 | Types generated successfully |
| `pnpm exec tsc --noEmit` | `1ee64f13f3bf8dad8f1aac297d0167edffe9bf1a` | 0 | no diagnostics |
| `pnpm build` | `1ee64f13f3bf8dad8f1aac297d0167edffe9bf1a` | 0 | `next build --webpack` completed |

## Uncovered items / residual risks

- `definition_patch_not_persistable` now enters pending with a deterministic “record as a fact or skip” question. That production path is implemented but is **not** covered by a dedicated FU3-A–H case.
- Whole-turn authorization failures (`missing_authorized_answer_target` / `missing_authorized_fact_roles`) still fail closed as `invalid_input` with no per-item pending. That is intentional: there is no authorized target to clarify against.
- Mixing an open Conflict-clarification turn with `pending_answer_resolution` on the same session was not newly tested. Conflict clarification remains first and was not rule-changed.
- After every remaining item is refused, the session stays on rejected pending and does not auto-advance to another NeedItem. That is the required fail-closed behavior; there is not yet a separate “dismiss pending and resume ordinary investigation” action.
- The deterministic (non-model) `interpretUserAnswer()` helper still emits empty `unresolved_items`. The production collecting path uses `interpretAnswerWithModel`.
- Removing text-only draft dedupe means a sloppy model can emit two fully identical rows; they become two pending items instead of one being silently dropped. That is the safer tradeoff for FU3-B.
- Unsent / generation-failed / invalid-input / same-`plan_id` replay still must not recount budget; a **new** remaining-item clarification uses a new `plan_id` and is charged when actually sent.

At the close of this work, the FU2 leftovers named above (dropped sibling pending items; non-role unresolved falling through to `planFromState`; same-text false dedupe; half-committed DC on pending-bind persist failure; unsent-plan authorization) were not observed in the official FU3-A–H + regression run. This file does not declare product PASS.

## Git boundary

- Implementation and evidence are separate commits.
- No pull request was opened.
- `main` was not merged.
- No deploy and no Vercel promote were performed.
- Product PASS is not self-declared.
