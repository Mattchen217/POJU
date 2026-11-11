# M2.4-R2-FU8 — Close Answer Interpretation Grounding and Control-Flow Gaps

Production-code repair on `feat/m1-r-fresh-session-main-loop`. This is an evidence record, not a product PASS declaration.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Baseline / parent of the implementation: `e47420cdadbf0c1cc2d3351594290dd09f9f2fcd`
- Implementation SHA (all official regressions ran on this commit): `a7fd728f0af1eb8f9da3200fd123d781f05c3a5f`
- Evidence tip SHA: _(left empty / pending Max review)_
- Observed `origin/main` at the start of this work: `ee8c96e8a7a128fa8e059c2a9f81c9f0d2127688` (not merged, not rebased onto)

## Goal

Complete the production Answer Interpretation path by closing three gaps:

1. Model-extracted facts were not programmatically grounded in the user's actual answer. A model could invent or paraphrase a fact and still receive `user_asserted` / `user_estimate`.
2. Model `unresolved_aspects` were copied only into AnswerEvent notes and never entered follow-up scheduling, so ordinary Blueprint NeedItem planning could continue as if the aspect had been handled.
3. Classifications `goal_change` and `insight_mismatch` wrote nothing, then fell through to ordinary old-Blueprint planning. The proposed target change or mismatch statement was discarded.

This task does not implement Question Generation modelization. It does not modify Freeze, Readiness authority, Blueprint scope authority, or DC confirmation authority. It does not add isolated polarity/negation example patches; that cycle closed in FU7.

## Files changed

### Implementation commit `a7fd728f0af1eb8f9da3200fd123d781f05c3a5f`

- `lib/poju/decision-intake/types.ts`
  - Required `source_quote: string` on every `ModelAnswerDraft.extracted_items[]` item.
  - Added `UnresolvedModelAspect`, `SourceQuoteRejection`, `IntakeControlItem`, and `PendingIntakeControl`.
  - Extended `AnswerEvent` with structured `unresolved_aspects`, `grounding_rejections`, and `control_items`. These are scheduling / audit fields, not a second fact store.

- `lib/poju/decision-intake/answer-interpretation-model.ts`
  - SYSTEM_PROMPT now requires an exact user-answer substring as `source_quote`. A paraphrase is not allowed. One item has one quote. Context facts, model inference, and likely implications are not source evidence. If no exact quote exists, the model must not emit a persistable extracted item.
  - `parseAndValidateModelAnswerDraft()` requires `source_quote` to be a string. Empty quotes are dropped; quotes longer than 2000 characters are dropped rather than truncated. The parser never manufactures a quote.

- `lib/poju/decision-intake/answer-interpretation.ts`
  - Added `normalizeAnswerGroundingText()` and `groundSourceQuote()`. Normalization is conservative only: Unicode NFKC, whitespace collapse, and safe punctuation unification. The normalized quote must be a contiguous substring of the normalized user statement. There is no semantic-similarity or second-LLM check.
  - `answerEventFromModelDraft()` grounds each item before role authorization. An ungrounded item does not become a `ProposedWrite` and does not receive `user_asserted` or `user_estimate`. The rejection is recorded as a structured `grounding_rejections` entry and as an AnswerEvent note. Other independently grounded items from the same turn are preserved. If no grounded writes remain, the turn continues only through the existing safe no-write path, or through intake-control scheduling when aspects / control items are present.
  - Non-empty `unresolved_aspects` are preserved on the AnswerEvent as structured `UnresolvedModelAspect` records, not only in notes. `goal_change` and `insight_mismatch` are captured as `control_items` and still do not write DC.

- `lib/poju/decision-intake/pending-intake-control.ts` (new)
  - Typed session scheduling for unresolved aspects, goal-change confirmation, and insight-mismatch clarification.
  - Follow-up plans copy `fact_role_codes` / DIR authorization from the originally sent question. They do not expand Blueprint scope or authorized DIRs.
  - Goal-change confirmation uses numbered choices `1` / `2` as the unambiguous path, then conservative confirm / decline / uncertain parsing. Explicit confirmation sets `entered_controlled_blueprint_update` and does not mutate Blueprint or the confirmed DC definition. Explicit refusal keeps the original target and resumes its investigation. Uncertain responses keep the control item pending and do not recount budget.

- `lib/poju/decision-intake/adaptive-turn.ts`
  - `runAdaptiveQuestionTurn()` consumes `pending_intake_control` after conflict clarification and `pending_answer_resolution`, and before ordinary `planFromState()`.
  - Origin-turn replay restores the already-sent follow-up without rewriting DC or recounting budget. Follow-up-turn replay is idempotent via `last_resolved_turn_id`.

- `lib/poju/decision-intake/pending-answer-resolution.ts`
  - Pending-bind drafts now include `source_quote: item.text` so the bind path remains grounded against the item text already authorized for that pending item. No change to role / certainty / polarity logic.

- `lib/poju/types.ts`
  - Added `pending_intake_control` as session scheduling metadata only.

- `lib/poju/agent.ts`
  - Minimal merge of `pending_intake_control` next to the existing `pending_answer_resolution` copies, so the field survives the real `handleUserMessage()` production path.

- `scripts/fixtures/test-answer-interpretation-hook.ts`
  - Deterministic test hook now supplies `source_quote` from the classifier clause, which is a substring of the user statement.

- `scripts/test-m1-production-adaptive-question-loop.ts`
  - Existing model drafts received a `source_quote` so prior FU7–FU2 assertions still run on the production path.
  - New `handleUserMessage()` cases FU8-A1–A7, B1–B5, C1 / C4–C7, and D1–D2. Existing FU7, FU6, FU5, FU4, FU3, FU2, and earlier regression assertions were not deleted or weakened.

Question Generation, Freeze, Readiness authority, Blueprint scope authority, and DC confirmation authority were not modified. `blueprint.ts`, `confirm-and-freeze.ts`, and `question-generation.ts` were not changed.

### Evidence commit

This file. Tip SHA left empty / pending Max review. The implementation SHA recorded above is the SHA the tests actually ran on. This evidence commit itself was not used as the test SHA.

## Design

### Fix A — source-grounded extractions

`groundSourceQuote(source_quote, statement)` is the only persistence gate for model facts. After conservative normalization, the quote must be a contiguous substring of the user statement. Example: user `我目前月薪三万。` with `source_quote` `我目前月薪三万。` may write a legal RealityFact. A model-invented `家里有一套房子。` does not write. A meaning-changing splice such as `月薪三万，想现在离职` against `我目前月薪三万，但不想现在离职。` is not a contiguous substring and does not write. One grounded item plus one ungrounded item writes only the grounded item. A missing `source_quote` is `invalid_schema` and never writes.

### Fix B — unresolved_aspects

Each non-empty aspect becomes an `UnresolvedModelAspect` / `IntakeControlItem` on the AnswerEvent and on `session.pending_intake_control`. These are scheduling signals, not RealityFacts or Constraints. `runAdaptiveQuestionTurn()` asks a controlled follow-up tied to the original `last_sent_question` authorization before ordinary `planFromState()`. Multiple aspects are asked one at a time. A clarification response may write only independently grounded, authorized items and resolves only its intended aspect. Replay of the original turn restores the same follow-up and does not duplicate writes or items.

### Fix C — goal_change and insight_mismatch

These classifications no longer fall through to ordinary old-Blueprint planning.

For `goal_change`, the user's stated proposal (for example `我想把决策目标改成要不要立刻出国读书。`) is stored as a control-plane clarification item. It is not written as a confirmed DC definition, and Blueprint is not mutated. While confirmation is pending, no ordinary old-target NeedItem is emitted. Numbered `1` confirms; `2` declines; `我不确定` keeps the item pending.

A complete controlled Blueprint-update path does not already exist in this codebase. There is no existing function that legally revises Blueprint scope or the confirmed decision target after user confirmation. This change implements the confirmation gate only: explicit confirmation sets `entered_controlled_blueprint_update` and records entry into that path, while the original target is retained. Auto-applying a new target would have invented new Blueprint scope authority and was not done. Later authority work is still required before a confirmed target change can actually be applied.

For `insight_mismatch`, the user's mismatch statement is preserved as a control item. Model interpretation or psychological inference is not written as a RealityFact. A targeted clarification is asked before ordinary investigation resumes. Clarification and replay are idempotent and do not modify Blueprint or DIR authority.

## Official regressions

All official regressions below ran on implementation SHA `a7fd728f0af1eb8f9da3200fd123d781f05c3a5f`, before the evidence commit.

- `pnpm test:m1-production-adaptive-question-loop` — exit 0, PASS=139 FAIL=0 (previously 120; 19 new FU8 checks)
- `pnpm test:m1-r-fresh-session-main-loop` — exit 0, PASS=8 FAIL=0
- `pnpm test:m2-3-decision-blueprint` — exit 0, 18 passed, 0 failed
- `pnpm test:m2-1-readiness-confirm-freeze` — exit 0, 19 passed, 0 failed
- `pnpm test:m2-2-freeze-report-binding` — exit 0, 43 passed, 0 failed
- `pnpm test:decision-context-phase2` — exit 0, 9 passed
- `pnpm exec next typegen` — exit 0, types generated successfully
- `pnpm exec tsc --noEmit` — exit 0
- `pnpm build` — exit 0

A provider-backed OpenRouter smoke test was not performed. The existing model test hook does not prove a real OpenRouter call.

## Residual risks

- The grounding gate is a normalized contiguous-substring check, not clause analysis. A meaning-changing quote that is still a substring, such as quoting `想离职` from `不想离职`, can still pass the gate. This was not widened into a second semantic checker.
- Conservative punctuation / whitespace normalization can fail-closed on unusual typography, dropping an otherwise legal item.
- After explicit goal-change confirmation, the request only enters the controlled path. Blueprint and the confirmed DC definition stay on the original target until later authority work exists.
- `goal_change` / `insight_mismatch` still suppress extracted-item writes for that classification, even if a draft also contains a grounded quote. That is intentional: those turns are control-plane events, not fact writes.
- Pure English negation is not part of the goal-change confirmation fail-closed marker set beyond a small uncertainty list; numbered `1` / `2` remain the unambiguous path.
- No live OpenRouter call was made in this task, so prompt-compliance of a real model was not observed.

## Confirmations

- No PR was opened.
- No merge was performed.
- No rebase onto `main` was performed.
- No deployment or promotion was performed.
- This record does not self-declare product PASS.
- The evidence tip SHA is left empty.
