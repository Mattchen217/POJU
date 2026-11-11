# M2.4-R2-FU9 — Close Source-Content Grounding and Insight-Mismatch Resolution

Production-code repair on `feat/m1-r-fresh-session-main-loop`. This is an evidence record, not a product PASS declaration.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Baseline / parent of the implementation: `ed987b11a4de7649706470292c7a0d07baf2ac12`
- Previous implementation (FU8): `a7fd728f0af1eb8f9da3200fd123d781f05c3a5f`
- Implementation SHA (official regressions ran on this implementation content): `b2c4c62409da6b244910301abef2d97a21d10c84`
- Evidence tip SHA: _(left empty / pending Max review)_
- Observed `origin/main` at the start of this work: `ee8c96e8a7a128fa8e059c2a9f81c9f0d2127688` (not merged, not rebased onto)

## Goal

Close two remaining Answer Interpretation defects, and tighten goal-change target extraction, without widening authority:

1. `groundSourceQuote()` only checked that `source_quote` occurs in the user statement. `answerEventFromModelDraft()` then persisted `item.text`, which could be a model paraphrase or inference unsupported by the quoted text.
2. `handlePendingIntakeControlTurn()` marked an `insight_mismatch` item clarified and resumed ordinary planning without interpreting or retaining the user's clarification.
3. `answerEventFromModelDraft()` assigned the entire original user statement to `proposed_decision_target` and returned early for `goal_change`, bypassing source validation of extracted items.

This task does not implement Question Generation modelization. It does not modify Freeze, Readiness authority, Blueprint scope authority, or DC confirmation authority. It does not create a second fact store, and it does not bypass `applyAnswerEventToSessionDc()` or `persistDcLifecycleChange()`.

## Files changed

### Implementation commit `b2c4c62409da6b244910301abef2d97a21d10c84`

- `lib/poju/decision-intake/types.ts`
  - Extended `SourceQuoteRejectionReason` with `extraction_text_not_source_equivalent`.
  - Added `IntakeControlResolutionRecord` / `IntakeControlResolutionStatus` and attached `resolution_records` to `PendingIntakeControl`. These are scheduling / audit metadata, not a second fact store.

- `lib/poju/decision-intake/answer-interpretation-model.ts`
  - SYSTEM_PROMPT now requires `text` to equal `source_quote` exactly, and requires a `goal_change` definition_patch to carry only the exact proposed target phrase. The prompt is guidance only; deterministic code remains authoritative.
  - The parser still rejects a missing non-string `source_quote` as invalid schema. Blank or oversized quotes are no longer silently dropped; they are kept so the grounding gate can record a structured rejection. The parser never manufactures a quote.

- `lib/poju/decision-intake/answer-interpretation.ts`
  - Added `groundExtractedItem()` and `persistedSourceStatement()`. After the existing normalized contiguous-substring check, the normalized `item.text` must equal the normalized `source_quote`. If they differ, the item is rejected with `extraction_text_not_source_equivalent`. Rejected items do not become `ProposedWrite`s and never receive `user_asserted` or `user_estimate`. Other independently valid items from the same answer are preserved.
  - The persisted statement is the original unnormalized `source_quote`, not the model `text`.
  - `extractGroundedProposedDecisionTarget()` selects the first grounded, source-equivalent `definition_patch` and stores that unnormalized quote as `proposed_decision_target`. The entire original sentence is no longer used as the target. If no valid phrase exists, the goal-change control item is retained with the target unresolved.

- `lib/poju/decision-intake/pending-intake-control.ts`
  - If a goal-change item has no resolved target, the follow-up asks the user to restate the proposed new decision target. It does not ask for confirmation.
  - Restatement and confirmation use distinct plan ids and `ask_now_reason` values so the confirmation question is built only after a valid target phrase is retained.

- `lib/poju/decision-intake/adaptive-turn.ts`
  - `insight_mismatch` clarification now runs `interpretAnswerWithModel()` against the current user statement and the existing actually-sent question authorization, then `answerEventFromModelDraft()` with the same source-content rule. Valid user-authored content is persisted only through `applyAnswerEventToSessionDc()` and `persistDcLifecycleChange()`.
  - A structured resolution record retains: original mismatch item ID, original mismatch source turn ID, clarification turn ID, original mismatch text, the user's exact clarification text, resulting AnswerEvent ID if one exists, and resolution status.
  - The mismatch item is marked clarified only after successful processing and retention. Model-call failure, invalid schema, or required DC persistence failure returns the original session and leaves the item pending. Ordinary planning resumes only after successful resolution. Understanding is rebuilt from the latest persisted DC at that point.
  - Added a test-only `intakeControlPersist` hook. When omitted, production uses `persistDcLifecycleChange`. It is not a production bypass.
  - Goal-change confirmation is unchanged once a valid target phrase exists: numbered `1` enters the controlled path without auto-applying a new target; `2` retains the original target and resumes investigation; uncertainty keeps the item pending. If the target is still unresolved, a restatement is interpreted the same conservative way; a paraphrase is not accepted as the proposed target.

- `lib/poju/types.ts`, `lib/poju/collecting-dc-turn.ts`, `lib/poju/agent.ts`
  - Minimal session-orchestration additions required so `handleUserMessage()` can carry typed records: `last_answer_event` is stamped from the production AnswerEvent and copied through the existing M1 session-adoption points. This makes `grounding_rejections` inspectable on the real path. It is not a second Decision Context or fact store.

- `scripts/test-m1-production-adaptive-question-loop.ts`
  - Added 28 production-path FU9 checks through `handleUserMessage()` and `__testOnlyM1Hooks.interpretAnswerModel`.
  - Preserved all previously accepted FU7 and FU8 cases. FU8-C4 through FU8-C7 were updated to supply an exact user-authored `definition_patch` text/quote pair (`要不要立刻出国读书`) so they still test the confirmation gate rather than the previous whole-sentence target defect. FU8-D2 now injects a model hook on clarification so the new interpretation path does not call OpenRouter and still writes no inferred facts.

Question Generation, Freeze, Readiness, Blueprint scope authority, and DC confirmation authority were not modified.

### Evidence commit

- `docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-M2-4-R2-FU9.md` only.

## Tested behavior

All tests below call the real `handleUserMessage()` path with the existing test-only model hook. They do not call live OpenRouter.

### Source-content grounding

- Exact user statement as both `text` and `source_quote` is accepted and persisted as the original unnormalized quote, for example `我目前月薪三万。`, with `user_asserted`.
- When `source_quote` exists but `text` changes the meaning, the item is rejected with `extraction_text_not_source_equivalent` and no DC write occurs.
- `我并不是怕风险` quoted in support of `用户其实是风险偏好型人格` is rejected and is not written as a RealityFact.
- `我不想离职` with model text `我想离职` is rejected under the equality rule, even if a shorter quote such as `想离职` occurs in the statement.
- A mixed answer with one exact item and one paraphrased inference persists only the exact item.
- Missing `source_quote` rejects the model draft as invalid schema and never writes. Blank quotes record `source_quote_empty`. Oversized quotes record `source_quote_too_long`. None of these write DC.
- Rejected content never receives `user_asserted` or `user_estimate`. Rejection reasons are inspectable on `session.last_answer_event.grounding_rejections`.
- Replay does not duplicate writes or rejection records.

### Insight mismatch

- The initial mismatch creates a pending control item and does not write inferred facts.
- A concrete clarification is passed through model interpretation.
- An exact user-authored clarification, such as `我只是还在比较时间窗口。`, can enter the legal DC / C1 path.
- A model-generated inference cannot enter DC.
- The clarification's exact text and source turn are retained in the resolution record.
- Model-call failure, invalid schema, and DC persistence failure leave the control item pending and do not write a resolution record.
- Successful clarification resolves only its own mismatch item. Ordinary planning resumes only after successful resolution.
- Replay does not duplicate DC writes or resolution records.

### Goal change

- From `我想换个方向，改成要不要立刻出国读书。`, the proposed target is the exact phrase `要不要立刻出国读书`, not the introductory wording.
- A paraphrased or ungrounded target is not accepted. Missing target phrase results in a restatement request, not a confirmation question.
- Explicit confirmation still does not mutate Blueprint or the confirmed DC definition. Explicit refusal retains the original target and resumes its investigation. Uncertainty keeps the control item pending. Replay does not repeat the target-change operation.

A confirmed goal change still does not auto-apply a new target in FU9. The complete controlled Blueprint-update authority path remains a separate subsequent implementation.

## Official regressions

All official regressions below ran on the implementation content that is SHA `b2c4c62409da6b244910301abef2d97a21d10c84`, before the evidence commit. They were not run on the evidence commit.

- `pnpm test:m1-production-adaptive-question-loop` — exit 0, PASS=167 FAIL=0 (previously 139; 28 new FU9 checks)
- `pnpm test:m1-r-fresh-session-main-loop` — exit 0, PASS=8 FAIL=0
- `pnpm test:m2-3-decision-blueprint` — exit 0, 18 passed, 0 failed
- `pnpm test:m2-1-readiness-confirm-freeze` — exit 0, 19 passed, 0 failed
- `pnpm test:m2-2-freeze-report-binding` — exit 0, 43 passed, 0 failed
- `pnpm test:decision-context-phase2` — exit 0, 9 passed
- `pnpm exec next typegen` — exit 0, types generated successfully
- `pnpm exec tsc --noEmit` — exit 0
- `pnpm build` — exit 0

A provider-backed OpenRouter smoke test was not performed. No test hook or mocked response proves a real provider call.

## Residual risks

- The grounding gate remains a normalized contiguous-substring check plus text/quote equality. It is not clause analysis. If the model sets both `text` and `source_quote` to a meaning-changing substring that still occurs in the user statement, such as quoting `想离职` from `不想离职`, the equality rule does not catch it.
- Conservative punctuation / whitespace normalization can fail-closed on unusual typography, dropping an otherwise legal item.
- `insight_mismatch` and `goal_change` classification turns still do not write extracted items as DC facts, even when a draft also contains a grounded quote. Writes happen only after a later authorized clarification or through other non-control classifications.
- A successful insight-mismatch clarification with no legal writes still resolves the control item and records `clarified_without_dc_write`. That is intentional: the clarification was processed and retained, but no inferred fact was invented.
- After explicit goal-change confirmation, the request only enters the controlled path. Blueprint and the confirmed DC definition stay on the original target until later authority work exists.
- No live OpenRouter call was made in this task, so prompt-compliance of a real model was not observed.
- `last_answer_event` is session/audit metadata for inspectability. Persistence of that field through every durable session store path was not independently exhaustively tested beyond the production-path assertions above.

## Confirmations

- No PR was opened.
- No merge was performed.
- No rebase onto `main` was performed.
- No deployment or promotion was performed.
- This record does not self-declare product PASS or acceptance of FU9 or M2.4-R2.
- The evidence tip SHA is left empty.
