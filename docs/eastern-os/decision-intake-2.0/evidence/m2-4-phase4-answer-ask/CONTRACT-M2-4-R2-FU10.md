# M2.4-R2-FU10 — Deterministic Clause-Boundary Grounding

Production-code repair on `feat/m1-r-fresh-session-main-loop`. This is an evidence record, not a product PASS declaration.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Baseline / parent of the implementation (FU9 evidence tip, equal to remote branch HEAD at start): `1f9309d47e3bf0d4df303deb8bdfe02203b18356`
- Previous implementation (FU9): `b2c4c62409da6b244910301abef2d97a21d10c84`
- Implementation SHA (official regressions ran on this commit): `e5e21457cc5c4f89a2c7e6d65378d2eb7566c59a`
- Evidence tip SHA: _(left empty / pending independent review)_
- Observed `origin/main` at the start of this work: `ee8c96e8a7a128fa8e059c2a9f81c9f0d2127688` (not merged, not rebased onto)

## Goal

Close the FU9 residual: `groundExtractedItem()` accepted any `source_quote` that was a normalized contiguous substring of the user statement, as long as `item.text` equalled it. A model could therefore cut a meaning-changing fragment out of a clause, for example `想离职` from `我不想离职。`, and have it persisted as `user_asserted`.

FU10 replaces substring grounding with deterministic clause-boundary grounding. It adds no negation-word detector on the quote, no second LLM, and no change to DC authority.

## Files changed

### Implementation commit `e5e21457cc5c4f89a2c7e6d65378d2eb7566c59a`

- `lib/poju/decision-intake/answer-interpretation.ts`
  - Removed `groundSourceQuote()` (the contiguous-substring rule). There is no fallback to it.
  - Split the existing folding into `foldGroundingChars()`; `normalizeAnswerGroundingText()` keeps the same output.
  - Added `resolveGroundedClauseSpan(sourceQuote, statement, offsets?)`:
    - Clause structure is computed on the original trimmed statement, never on the normalized text. Hard boundaries are `。｡！？!?；;` and newlines. An ASCII `.` counts only as a sentence end: not decimals, not ellipses, not single-letter or common abbreviations, and only when followed by whitespace, CJK, a closer, or the end. Soft boundaries are `，,﹐`; an ASCII `,` between digits is not a boundary. Boundaries inside brackets or quotes are ignored.
    - Adjacent pieces are merged into one unit unless they can be proven independent. Any one of these closed-class structural signals forces a merge:
      - the following piece starts with a conjunction, subordinator, or predicate-initial adverb or modal (a shared elided subject);
      - the previous piece opens with a subordinator (`如果/虽然/因为/…`, `if/although/…`);
      - the previous piece ends in a connective or a clause-taking verb (`但是/所以/…`, `说过/觉得/决定了/…`, `…之前/…的话`);
      - the following piece is a very short trailing qualifier;
      - the following piece starts lowercase after an ASCII period.
      Over-merging fails closed: the model then has to quote the larger complete span.
    - Meaning-neutral discourse or correction markers (`另外/此外`, `更正一下：`, a marker-only piece such as `另外，`) explicitly open a new statement. The clause may begin at the marker or right after it. A dangling or subordinate previous clause still absorbs it.
    - Unbalanced brackets or quotes make the structure undeterminable. Only the whole statement may then be quoted; any other quote is rejected with `clause_boundary_undeterminable`.
    - Normalization only locates candidates. Each normalized code unit maps back to its original character cluster (base character plus combining marks, joiners, and variation selectors). A match must start and end on original cluster boundaries, otherwise it is rejected with `source_quote_unicode_boundary_mismatch`.
    - The located original region, after trimming edge whitespace and separator punctuation, must start at a unit start and end at a unit end. A quote may span one or more consecutive whole units. Otherwise the reason is `source_quote_not_clause_span`.
    - Model offsets, when present, are only a candidate location in the trimmed statement (UTF-16, end exclusive). They must be integers with exactly one of each, `0 <= start < end <= length`, on cluster boundaries. The normalized slice must equal the normalized quote, and the region must pass the same clause check. Any failure rejects the item with `source_offset_invalid`, `source_offset_out_of_range`, `source_quote_unicode_boundary_mismatch`, or `source_offset_quote_mismatch`. There is no fallback to text search.
  - `groundExtractedItem()` is the single entry for every model-derived write and goal-change target. It checks, in order: quote length, non-empty quote, `text`/`source_quote` equivalence (FU9 rule, unchanged), then `resolveGroundedClauseSpan()`. On success it returns the original user slice (`span.text`), and that slice is what gets persisted.
  - `answerEventFromModelDraft()` persists `grounding.span.text` for `reality_fact`, `constraint`, and the companion `reality_fact`. Role-authorization unresolved items also carry the grounded original text. Rejections use the shared `groundingRejection()` builder, which records model offsets for audit. Rejected items create no `ProposedWrite` and never get `user_asserted` or `user_estimate`; other independent valid items from the same turn continue.
  - `extractGroundedProposedDecisionTarget()` uses the same entry. The target comes from the grounded clause through `goalChangeTargetFromClause()`. When the grounded clause itself starts with a closed introducer grammar (`(我/我们)(想/要/希望/打算/准备)(把)(这个/我的)(决策目标/目标/问题/方向/…)改成/换成/改为/变为/…`), the introducer is dropped. Any other wording, for example a negated `我不想把决策目标改成…`, keeps the full original clause as the target. A phrase cut from inside a clause is rejected and the target stays unresolved, which leads to a restatement request.
  - The insight_mismatch path still only records grounding rejections through the same entry. Its handling rights and the clarification DC / C1 path are unchanged.

- `lib/poju/decision-intake/types.ts`
  - `ModelAnswerDraft.extracted_items[]` gains optional `source_start` / `source_end` (`number | null`). They are documented as a locating hint, not authorization.
  - `SourceQuoteRejectionReason` gains `source_quote_not_clause_span`, `clause_boundary_undeterminable`, `source_quote_unicode_boundary_mismatch`, `source_offset_invalid`, `source_offset_out_of_range`, and `source_offset_quote_mismatch`.
  - `SourceQuoteRejection` gains optional audit fields `source_start` / `source_end`.

- `lib/poju/decision-intake/answer-interpretation-model.ts`
  - The parser accepts `source_start` / `source_end` as number, null, or absent. Any other type is `invalid_schema`, so the whole draft fails closed. Numbers are passed through verbatim for deterministic verification and are never clamped or repaired.
  - SYSTEM_PROMPT source-grounding rules now require verbatim complete sentences or clauses. They forbid cutting inside a clause or dropping limiting words (stated as categories: negation, hedging, conditions, time limits, amounts, attached "but/unless/if/only" clauses). Offsets are described as optional and default null. goal_change asks for the complete clause stating the new target. The prompt is guidance only; deterministic code remains authoritative.

- `scripts/fixtures/test-answer-interpretation-hook.ts` (test-only, never imported by production)
  - The deterministic test hook builds drafts from the legacy `writesFor()` splitter, which can cut inside a sentence (for example at `同时`). When that clause is not a complete clause span, the hook now quotes the containing sentence, or failing that the whole statement, like a prompt-compliant model. Without this, `M21-03` failed because the fixture's cut `不破坏家庭稳定。` (from `期望结果是…收入，同时不破坏家庭稳定。`) was correctly rejected and sufficiency was not reached. The production rule was not relaxed to make it pass.

- `scripts/test-m1-production-adaptive-question-loop.ts`
  - Added 21 FU10 checks (`M2.4-R2-FU10-*`) through `handleUserMessage()`.
  - Fixture-only updates to previously accepted goal_change cases, because FU10 requires the target quote to be a complete clause:
    - FU8-C1, C4, C5, C6, C7: the `definition_patch` text/quote changed from `要不要立刻出国读书` to the complete clause `我想把决策目标改成要不要立刻出国读书`.
    - FU9 `seedFu9GoalChange` default: changed to the complete comma clause `改成要不要立刻出国读书`.
    - Assertions are unchanged. The proposed target is still exactly `要不要立刻出国读书`, derived through the introducer grammar. FU9-C3 (paraphrase rejected with `extraction_text_not_source_equivalent`) is unchanged.

Not modified: `applyAnswerEventToSessionDc()`, `persistDcLifecycleChange()`, Blueprint scope authority, Readiness authority, Freeze authority, DC confirmation authority, Question Generation, pending-control permission scope. No second fact store was added.

### Evidence commit

- `docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-M2-4-R2-FU10.md` only.

## Tested behavior

### How behavior was exercised

- **Real production call path:** every FU10 check calls the real `handleUserMessage()`, which runs adaptive-turn → `interpretAnswerWithModel()` → `parseAndValidateModelAnswerDraft()` → `answerEventFromModelDraft()` → `applyAnswerEventToSessionDc()` / `persistDcLifecycleChange()`.
- **Test hook:** the model output is injected with `__testOnlyM1Hooks.interpretAnswerModel`, which replaces only the OpenRouter call. The hook output still goes through the production parser and every gate.
- **Real OpenRouter call:** none. No live provider call was made in FU10. Nothing in this record is evidence of real-model prompt compliance.

### FU10 checks (all PASS)

- **A. Negation semantics**
  - A1: `我不想离职。` → `想离职` is rejected with `source_quote_not_clause_span`. No write, no ProposedWrite, no user_asserted/user_estimate.
  - A2: `我并不打算创业。` → `打算创业` is rejected.
  - A3: `我没有决定是否搬家。` → `决定搬家` is rejected as `source_quote_not_grounded` (not a substring), and `决定是否搬家` as `source_quote_not_clause_span`.
  - A4: the complete clause `我不想离职` passes grounding, goes through role authorization, and is written as `user_asserted`.
- **B. Qualifiers**
  - B1: `我想离职，但还没有决定时间。` → `我想离职` is rejected. The whole sentence is written verbatim.
  - B2: `我可以接受降薪，但不能超过百分之十。` → both halves are rejected and no constraint or companion is written. The whole sentence writes the constraint plus a companion with the original full text.
  - B3: `我可能会搬家，但目前没有决定。` → `我可能会搬家` is rejected. The whole sentence is written as `user_estimate`.
- **C. Normal multi-fact**
  - C1: `我目前月薪三万，预算上限五万。` → `我目前月薪三万` (fact) and `预算上限五万。` (constraint plus companion) are written separately with the authorized role/DIR. Result: facts +2, constraints +1.
  - C2: in a mixed turn, the rejected cut `月薪三万` (index 0) does not drop the legal `预算上限五万` constraint.
- **D. Safe failure**
  - D1: `我目前月薪三万（税前，预算上限五万。` (unbalanced bracket) → `clause_boundary_undeterminable`, no write.
  - D2: offsets `8..999` → `source_offset_out_of_range`, with the offsets recorded on the rejection.
  - D3: offsets `0..7` with quote `预算上限五万` → `source_offset_quote_mismatch`, with no search fallback. In the same turn, an item with verified offsets `0..7` and quote `我目前月薪三万` writes.
  - D4: in-clause substring `上限五万` → `source_quote_not_clause_span`.
  - D5: `我每年发⑫个月工资。` → `2个月工资` matches only inside the NFKC expansion of `⑫` and is rejected with `source_quote_unicode_boundary_mismatch`. `我目前月薪三万﹒预算上限五万` → `预算上限五万`: `﹒` folds to `.` under NFKC but is not a boundary in the original, so the quote is rejected with `source_quote_not_clause_span`.
  - D6: a half-width-comma quote of two complete clauses is accepted. The persisted text is the original full-width `我目前月薪三万，预算上限五万`, not the model's string.
  - D7: non-numeric offsets → the draft fails closed with `answer_interpretation_invalid_schema` and no DC change.
  - D8 (English): `I don't want to quit.` → `want to quit` is rejected. `I want to quit, but I haven't decided when.` → `I want to quit` is rejected.
- **E. Goal change / mismatch / replay**
  - E1: `我想换个方向，改成要不要立刻出国读书。` → the cut `要不要立刻出国读书` is rejected. The target stays unresolved, a restatement is requested (not a confirmation), and Blueprint, DC definition, and DC version are unchanged.
  - E2: `我不想把决策目标改成要不要立刻出国读书。` → the cut target is rejected. When the whole clause is quoted, the target is the full original negated clause (outside the introducer grammar), never the bare phrase.
  - E3: an insight_mismatch clarification fragment `还在比较时间窗口` cut from `我并不是怕风险，我只是还在比较时间窗口。` cannot enter DC.
  - E4: replaying a mixed grounded/rejected turn duplicates neither facts nor rejection records.

### Regression (E)

All previously accepted FU7, FU8, and FU9 checks still pass. Only the goal_change fixtures listed above changed; their assertions did not. FU8-A5, FU9-A5, and FU10-C2 cover mixed turns: a legal item is not lost because another item is rejected.

## Official regressions

All commands ran on the implementation commit `e5e21457cc5c4f89a2c7e6d65378d2eb7566c59a`, before the evidence commit.

- `pnpm test:m1-production-adaptive-question-loop` — exit 0, PASS=188 FAIL=0 (FU9 baseline 167; 21 new FU10 checks)
- `pnpm test:m1-r-fresh-session-main-loop` — exit 0, PASS=8 FAIL=0
- `pnpm test:m2-3-decision-blueprint` — exit 0, 18 passed, 0 failed
- `pnpm test:m2-1-readiness-confirm-freeze` — exit 0, 19 passed, 0 failed
- `pnpm test:m2-2-freeze-report-binding` — exit 0, 43 passed, 0 failed
- `pnpm test:decision-context-phase2` — exit 0, 9 passed
- `pnpm exec next typegen` — exit 0, types generated successfully
- `pnpm exec tsc --noEmit` — exit 0
- `pnpm build` — exit 0. The warnings are pre-existing and identical to FU9: the `middleware` → `proxy` deprecation and the `lib/ziwei/fact-pack.ts` `iztro` named-export warning.

Before the fixture update, `pnpm test:m2-1-readiness-confirm-freeze` failed `M21-03` with this implementation, and passed 19/0 on the FU9 baseline. The cause and the test-only fix are described under `scripts/fixtures/test-answer-interpretation-hook.ts` above.

## Residual risks

- Comma-level independence relies on closed-class structural markers (conjunctions, subordinators, predicate-initial adverbs/modals including negation adverbs, clause-taking verbs, short trailing qualifiers). This is lexical, not a parser. Unusual punctuation can still split dependent material that no marker catches, for example a comma between a clause-taking verb outside the set and its object clause, or a post-positioned qualifier longer than three characters such as `我月薪三万，税前计算`.
- The negation adverbs `不/没/未/别/无/非` appear only as clause-head markers in the dependency class, which decides whether a comma piece can stand alone. They are not a detector applied to the quote or its prefix. The in-clause attack (`想离职` from `我不想离职`) is blocked by the boundary rule alone.
- Over-merging is fail-closed but can drop legitimate facts when the model quotes one clause of a merged unit. Examples: `我有两个孩子，都在上小学` (merged by `都`), or a turn that opens with a dependent-head adverb. The prompt now asks for complete sentences, but real-model compliance is unobserved.
- English handling is limited to `. ! ? ; ,`, newline, and small closed marker lists. Abbreviation detection is a short list; mis-split periods merge or fail closed rather than widening acceptance.
- Unbalanced brackets or quotes, including some IME quote styles, restrict a turn to whole-statement quotes.
- The goal-change target drops only a clause-initial closed introducer grammar. Every other phrasing keeps the full grounded clause as the target, which can make the confirmation question wordier. Goal-change confirmation authority is unchanged.
- Model offsets are UTF-16 indices of the trimmed `user_answer`. Models miscount often, so the prompt defaults them to null, and a wrong non-null offset rejects an otherwise valid item.
- No live OpenRouter call was made, so real-model adherence to the new grounding prompt was not observed.

## Confirmations

- No PR was opened.
- No merge was performed. No rebase onto `main` was performed.
- No deployment or promotion was performed.
- This record does not self-declare product PASS or acceptance of FU10 or M2.4-R2.
- The evidence tip SHA is left empty.
