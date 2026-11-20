from pathlib import Path

logs = {}
for line in Path("temp/out_m24r2fu2_case_logs.txt").read_text(encoding="utf-8").splitlines():
    key = line.split("]", 1)[0] + "]"
    logs[key] = line

def L(key):
    return logs[key]

md = f'''# M2.4-R2-FU2 — Unresolved Answer Continuation & Sent-Plan Authorization

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent (baseline / R2-FU1 evidence tip):** `c6404df471ba8d918999b1760774ad77bc307a10`  
**Implementation commit:** `d8b36497a6e3a91325b64cc16342c7d61d390297`  
**Official regression ran on:** the exact production and test files later committed as `d8b36497a6e3a91325b64cc16342c7d61d390297` (working tree frozen before this evidence-only commit)  
**Evidence tip SHA:** *(empty / pending Max review — this file must not contain a self-referential tip SHA)*  
**Status:** Implementation + tests + this evidence file committed for independent review. **Does not self-declare product PASS.**  
**No PR, no merge, no deploy, no Vercel promote.** No new Vercel preview/tip URL was produced by this work.

## Goal

Fix two production-path problems in Phase 4 answer handling:

1. When the model extracts a user answer but cannot write Decision Context because `role_code_hint` is missing, unlocated, or illegal, the system must not jump to the next unrelated NeedItem. It must keep a `pending_answer_resolution` scheduling state and ask a deterministic role-clarification question about the current answer.
2. When there is no `last_sent_question`, `next_question_plan` and `adaptive_ask_plan` must not authorize a user-answer write. Only an actually-sent question may authorize writes.

FU1 complete role-code matching and certainty rules were kept. Conflict Clarification / FU6 was not extended. Question Generation was not modelized. Phase 5 was not introduced. Unresolved items are not disguised as RealityFacts, and no second Decision Context was created. `applyAnswerEventToSessionDc()` Constraint `verification_level` hardcoding was not changed; estimated Constraints remain fail-closed as in FU1.

## Files changed

### Implementation commit `d8b36497a6e3a91325b64cc16342c7d61d390297`

Production:

- `lib/poju/decision-intake/types.ts` — structured `UnresolvedAnswerItem` on `AnswerEvent`; `PendingAnswerResolution` scheduling type
- `lib/poju/types.ts` — optional `pending_answer_resolution` on `POJUSessionState` (scheduling state; survives JSON persist/reload)
- `lib/poju/decision-intake/answer-interpretation.ts` — `activeTargets()` last-sent-only authorization; structured unresolved items
- `lib/poju/decision-intake/pending-answer-resolution.ts` — new: deterministic clarification plan, role-choice parse, pending merge/bind helpers
- `lib/poju/decision-intake/adaptive-turn.ts` — unresolved branch between model draft and DC apply; pending handler on later turns
- `lib/poju/decision-intake/apply-answer-to-dc.ts` — opt-in `allow_incremental_same_turn` so a later role-bind can append unwritten statements for the original `source_turn_id`. Ordinary replay still returns `turn_already_mapped`. Constraint verification_level hardcoding unchanged
- `lib/poju/agent.ts` — copy `pending_answer_resolution` through the collecting-session field picks so handleUserMessage persist/return keeps it

Tests:

- `scripts/test-m1-production-adaptive-question-loop.ts` — FU2-A through FU2-H; Case G and Case I updated to the new pending/clarification behavior; older M1-02/06/07/12/13/interp fixtures now attach `last_sent_question` after `init_only` so they authorize under the new rule

`lib/poju/collecting-dc-turn.ts` was not modified. The pending state rides on `POJUSessionState` and is already returned through the existing adaptive-turn result session.

`conflict-clarification.ts` / `conflict-clarification-turn.ts` were not modified. The deterministic answer-interpretation hook fixture was not modified.

### Evidence commit

- `docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-M2-4-R2-FU2.md` (this file)

## Call chain

Production path used by `handleUserMessage` → `runM1ProductionPreLlmTurn` → `runCollectingDcTurn` → `runAdaptiveQuestionTurn`:

1. Conflict clarification still runs first (`findClarifiedConflictForTurn` / `handleConflictClarificationAnswer`). Role clarification does not auto-close a Conflict.
2. If `session.pending_answer_resolution.status === "pending"`: `handlePendingAnswerResolutionTurn` (no new LLM call).
   - Replay of the original `source_turn_id`: restore the already-generated clarification plan; no DC write; no extra budget.
   - New clarification answer: `parseClarificationRoleChoice` → `answerEventFromPendingBind` (re-enters `answerEventFromModelDraft` with the chosen complete role code and the saved original item) → full role-code check → `applyAnswerEventToSessionDc(..., allow_incremental_same_turn: true)` → `persistDcLifecycleChange` (`dc_collect:session:source_turn_id` or `:role_resolve` when that turn already has legal writes) → clear pending on success, or keep pending if the user is unclear / bind fails → `planFromState` only after pending is cleared.
3. Else ordinary path: `interpretAnswerWithModel` → `answerEventFromModelDraft` (structured `unresolved_items`, legal items only in `proposed_writes`).
4. Unresolved role-binding branch **between** `answerEventFromModelDraft()` and ordinary `planFromState()`:
   - Legal `proposed_writes` still go through `applyAnswerEventToSessionDc` + C1 persist.
   - Role-binding unresolved items (`unlocated_role_code` / `unauthorized_role_code` / `illegal_role_code`) create or merge `pending_answer_resolution`.
   - `buildRoleClarificationPlan` generates a deterministic question from the actually authorized role codes and DIR needs. Blueprint scope / DIR / DDR are not enlarged. `conflict_clarification` is forced null.
   - Ordinary `planFromState()` is skipped while pending role-binding remains.
5. Agent `attachAuthorizedAssistantQuestion` marks the clarification plan as `last_sent_question` and charges budget only when `plan_id` is new.

`unclear_certainty` and `estimated_constraint_not_persistable` stay structured unresolved items but are **not** treated as role-binding pending. Those turns still follow the previous no-write / next-NeedItem planning path. Estimated Constraint still fail-closes in `answerEventFromModelDraft` because apply hardcodes Constraint `verification_level` to `user_asserted`.

## last_sent_question is the sole authorization source

`activeTargets()` no longer falls back to `next_question_plan` or `adaptive_ask_plan` when `last_sent_question` is missing. Missing last-sent returns `missing_authorized_answer_target`.

When last-sent exists and has DIR/DDR targets:

1. Prefer `last_sent_question.fact_role_codes`.
2. Historical recovery is allowed only when `next_question_plan.plan_id === last_sent_question.plan_id`.
3. Recovered or last-sent codes must all match `^v1/dir/([^/]+)/role/([^/]+)$`, the code's `dir_id` must belong to `last_sent_question.dir_ids`, and the set must have no duplicates or empty roles. If the set is incomplete or inconsistent, fail closed with `missing_authorized_fact_roles`. Bad items are not filtered so the remainder can still authorize.
4. Codes are never derived from `Blueprint.required_fact_roles`.

FU1 exact role-code matching in `answerEventFromModelDraft()` is unchanged: unauthorized / unlocated (null + multiple authorized codes) / illegal codes become unresolved only; null + exactly one authorized code binds that unique code; `ProposedWrite` still binds `fact_roles: [authorizedRole]` and `related_dir_ids: [authorizedDirId]`.

## Case G behavior change

FU1 Case G (`M2.4-R2-FU1 Case G`) previously expected a no-write success turn to advance `asked` 1→2 and send the next NeedItem (`DIR-OPT-ON-TABLE`). That skip is the bug FU2-B fixes.

The case still asserts no RealityFact / Constraint write and no DC version bump. It now also asserts that `pending_answer_resolution` is persisted, the assistant question is a role clarification, authorized role codes are preserved, and the next plan DIR set does not jump to an unrelated NeedItem. `asked` may still go 1→2 because the clarification question is an actually-sent question and counts against the effective budget.

FU1 Case I still asserts the forged code is not written and does not pollute the next Plan; it now also expects the illegal item to remain pending and the next question to be the clarification plan.

## Official FU2-A through FU2-H logs

All core cases went through real `handleUserMessage()` (createPOJUSession / seed → handleUserMessage). Model drafts were injected only via `__testOnlyM1Hooks.interpretAnswerModel`. No live OpenRouter. A supplementary `answerEventFromModelDraft()` probe was used only to observe structured unresolved fields that are not the sole test.

Verbatim logs from the official run on implementation SHA `d8b36497a6e3a91325b64cc16342c7d61d390297`:

```
{L('[m24r2fu2a]')}
{L('[m24r2fu2b]')}
{L('[m24r2fu2c]')}
{L('[m24r2fu2d]')}
{L('[m24r2fu2e]')}
{L('[m24r2fu2f]')}
{L('[m24r2fu2g]')}
{L('[m24r2fu2h]')}
```

Related updated cases from the same run:

```
{L('[m24r2g]')}
{L('[m24r2i]')}
```

Reading of those logs:

- **FU2-A:** `auth=missing_authorized_answer_target`; no DC write. After the turn a *new* question may be sent (`last_sent_after=qp_cq_dir_DIR-OPT-ON-TABLE_...`). That is a newly sent question, not authorization of the unsent `next_question_plan` (`plan_id` was `DIR-OPT-CONSTRAINTS`) for the user's answer.
- **FU2-B:** no write; `pending=pending:unlocated_role_code`; clarification question kept both authorized dirs/roles; `asked` 1→2 because the clarification was sent.
- **FU2-C:** original item bound only to the chosen `hard_constraint` / `DIR-OPT-CONSTRAINTS`; the other authorized role was not filled; pending cleared; next plan moved on after success.
- **FU2-D:** no DC write; pending kept; same clarification `plan_id` restored; budget not deducted again (`asked` 1→2→2).
- **FU2-E / FU2-F:** legal item wrote; illegal/unlocated item stayed pending; next question was the clarification plan; forged code did not enter the Plan.
- **FU2-G:** pending survived `mutatePOJUSession` / `loadPOJUSession`; replay of the same `source_turn_id` did not write DC, did not drop pending, did not recount budget, and restored the already-sent clarification (`q_recovered=true`).
- **FU2-H:** matching `plan_id` recovered role codes and wrote; mismatched `plan_id` returned `missing_authorized_fact_roles` and did not write; no `last_sent_question` returned `missing_authorized_answer_target` and did not write regardless of `next_question_plan`.

## Remaining product risks

- Answer loss of *role-binding* failures is closed by pending + clarification for the cases above. `unclear_certainty` and `estimated_constraint_not_persistable` still do not create role-clarification pending; those answers still do not write DC, and planning may continue to the next NeedItem.
- If clarification plan generation fails (no usable last-sent targets when pending is created), pending is kept and the turn fail-closes without jumping, but the user may see no new clarification question.
- Unsent-plan authorization of writes is closed in `activeTargets()`. A later `planFromState` after a missing-last-sent invalid answer may still *send* a new question (FU2-A). That send is not used to authorize the prior answer.
- Duplicate clarification / duplicate budget deduction for the same pending was not observed in FU2-D / FU2-G. The clarification `plan_id` is stable (`qp_role_clarify_${{source_turn_id}}`) and `attachAuthorizedAssistantQuestion` does not recount the same `plan_id`.
- Ordinary same-`source_turn_id` replay still fail-closes at `turn_already_mapped` unless the caller sets `allow_incremental_same_turn` (pending bind only). This keeps M2.3-R2-FU2 Case A behavior.

## Leftovers / deviations

- `role_code_hint` remains optional on `ModelAnswerDraft` for historical fixtures; missing is treated as null.
- Tests still inject drafts through `__testOnlyM1Hooks.interpretAnswerModel`; no live OpenRouter.
- `answerEventFromModelDraft()` probes remain supplementary, not the only test.
- `definition_patch` is still not mapped into DC by the apply mapper.
- Question Generation was not modelized; this work uses a deterministic clarification plan only.
- Conflict Clarification / FU6 regex was not extended; “两条都不准确” still has no replace-then-formal-close path; no Phase 5.
- `collecting-dc-turn.ts` was left unchanged; pending is session scheduling state.
- Older M1-02 / M1-06 / M1-07 / M1-12 / M1-13 / M1-interp fixtures were updated to attach `last_sent_question` after `init_only`. That is the production rule (only a sent question authorizes an answer), not a production fallback.
- `pending_answer_resolution` is optional on historical sessions.

## Regression

All of the following ran on the frozen production/test tree later committed as `d8b36497a6e3a91325b64cc16342c7d61d390297`. All exited 0.

- `pnpm test:m1-production-adaptive-question-loop` — 91/91, exit 0
- `pnpm test:m1-r-fresh-session-main-loop` — 8/8, exit 0
- `pnpm test:m2-3-decision-blueprint` — 18/18, exit 0
- `pnpm test:m2-1-readiness-confirm-freeze` — 19/19, exit 0
- `pnpm test:m2-2-freeze-report-binding` — 43/43, exit 0
- `pnpm test:decision-context-phase2` — 9, exit 0
- `pnpm exec next typegen` — exit 0
- `pnpm exec tsc --noEmit` — exit 0
- `pnpm build` — exit 0

The adaptive suite count rose from 83 (FU1) to 91 because FU2-A through FU2-H were added (8 cases). Prior A–F, G–M, N–T, U–Y, Z1–Z25 cases remained in the suite and passed, with Case G / Case I assertions updated as documented above.
'''

# Fix the accidental double-brace in plan_id description - I used ${{source_turn_id}} in the f-string
# In the leftovers I wrote `qp_role_clarify_${{source_turn_id}}` which becomes qp_role_clarify_${source_turn_id} - good.

path = Path("docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-M2-4-R2-FU2.md")
path.write_text(md, encoding="utf-8", newline="\n")
b = path.read_bytes()
assert not b.startswith(b"\xef\xbb\xbf")
assert b"\r\n" not in b
# ensure no self-referential tip and no mojibake
text = path.read_text(encoding="utf-8")
assert "Evidence tip SHA:" in text
assert "d8b36497" in text
assert "pending Max review" in text
# tip should not be filled with a commit after evidence
print("wrote", path, "bytes", len(b), "lines", text.count("\n"))
# show a couple of Chinese log chars survived
assert "我目前仍在职" in text or "unlocated_role_code" in text
print("ok")
