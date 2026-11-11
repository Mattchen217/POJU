# M2.4-R2-FU5 — Clarification Negation Safety Closure

Production-code repair on `feat/m1-r-fresh-session-main-loop`. This is an evidence record, not a product PASS declaration.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Baseline / parent of the implementation: `b7e6c9b92261b059f9b8b0a3077ff6d4e64bf9b1`
- Implementation SHA (all official regressions ran on this commit): `8baca929f1f5b3107d3776386650f3dda334efb9`
- Evidence tip SHA: _(left empty / pending Max review)_
- Observed `origin/main` at the start of this work / re-checked after official regressions: `ee8c96e8a7a128fa8e059c2a9f81c9f0d2127688` (not merged, not rebased onto)

## Goal

Close remaining negative-polarity false-positive paths in `parseDefinitionPatchChoice()` and `parseConstraintConfirmChoice()`.

Production rule: a clarification response containing a meaningful negation of the proposed action or assertion must never be interpreted as affirmative merely because it also contains an affirmative keyword. If polarity cannot be determined safely, return unclear and keep the item pending. Never write DC from an ambiguous response.

## Files changed

### Implementation commit `8baca929f1f5b3107d3776386650f3dda334efb9`

- `lib/poju/decision-intake/pending-answer-resolution.ts`
  - `parseDefinitionPatchChoice()` now uses an explicit polarity classification. Refusal, uncertainty, and `hasDefinitionPatchNegativeAction()` are evaluated before `hasDefinitionPatchAffirmativeAction()`. The negative-action check allows intervening words between a negation cue and the record/convert-as-fact action. A negated response never returns `{ ok: true, as_fact: true }`; it returns unclear and stays pending. Numbered choices are unchanged: `1` records as fact, `2` refuses.
  - `parseConstraintConfirmChoice()` keeps uncertainty, then negation, then estimate, then affirmation. `confirmNegated()` was extended so later affirmative substrings such as `可以写入` cannot override an earlier governing negation.

- `scripts/test-m1-production-adaptive-question-loop.ts`
  - New real `handleUserMessage()` cases FU5-DP-N, FU5-DP-P, FU5-CC-N, and FU5-CC-P. Existing FU4-A–E, FU4-N1–N3, FU4-T, FU3-A–H, and earlier A–F, G–M, N–T, U–Y, Z1–Z25, FU2-A–H assertions were not deleted or weakened.

No other production files were changed. Question Generation, Blueprint / DIR / DDR authorization, Conflict Clarification, Readiness / Confirmation / Freeze authority, Phase 5, report generation, session architecture, and Model Answer Interpretation were not modified.

### Evidence commit

This file. Tip SHA left empty / pending Max review. The implementation SHA recorded above is the SHA the tests actually ran on.

## Parser classification

### `parseDefinitionPatchChoice()`

Order is explicit: empty / numbered-choice / uncertainty / negative action / affirmative action / unclear.

Negative-action phrases must not return `{ ok: true, as_fact: true }`. On the production path they keep the `definition_patch_not_persistable` item pending, do not write RealityFacts or Constraints, do not bump DC version, do not enter ordinary NeedItem planning, and are not replaced by a free-form model response:

- 我不想把它作为明确事实记录
- 不要将它作为明确事实
- 我不认为应该把它作为明确事实
- 我不愿意把它改为事实
- 不应该记录为事实
- 不是要作为事实记录

Explicit affirmatives continue through the existing authorized DC C1 path and write a RealityFact only to the authorized DIR/role:

- 改为作为明确事实记录
- 作为明确事实
- 记录为事实
- 作为事实
- numbered `1`

Numbered `2` remains a refusal.

### `parseConstraintConfirmChoice()`

Order is explicit: empty / numbered-choice / uncertainty / `confirmNegated()` / estimate / affirmation / unclear.

These phrases never return `confirmed: true`. On the production path they write no Constraint and no RealityFact, do not bump DC version, keep the pending item, do not mark it confirmed, and do not enter ordinary NeedItem planning:

- 我不认为可以写入
- 我不觉得可以写入
- 并非可以写入
- 我认为不能写入
- 我不同意将它作为明确约束
- 我不接受这个约束作为明确约束

Existing protections are preserved:

- 我不确认这是明确约束
- 不是明确约束
- 不可以写入
- 目前无法确定
- 仍然只是估计

Explicit confirmation still writes a `user_asserted` Constraint through the existing authorized DC C1 path:

- 确认这是明确约束
- numbered `1`

## Production-path test cases

All new cases go through `handleUserMessage()`. Model drafts are injected only via existing `__testOnlyM1Hooks.interpretAnswerModel`.

| Case | Seed | Phrases | Result on implementation SHA |
| --- | --- | --- | --- |
| FU5-DP-N | `definition_patch_not_persistable` pending | 我不想把它作为明确事实记录; 不要将它作为明确事实; 我不认为应该把它作为明确事实; 我不愿意把它改为事实; 不应该记录为事实; 不是要作为事实记录 | no RealityFact, no Constraint, DC version unchanged, pending item remains active and is not removed, no ordinary NeedItem planning, no free-form model reply |
| FU5-DP-P | same seed | 改为作为明确事实记录; 作为明确事实 | converted RealityFact written to the authorized DIR/role through DC C1; pending cleared |
| FU5-CC-N | `estimated_constraint_not_persistable` pending | 我不认为可以写入; 我不觉得可以写入; 并非可以写入; 我认为不能写入; 我不同意将它作为明确约束; 我不接受这个约束作为明确约束 | no Constraint, no RealityFact, DC version unchanged, item remains pending and is not marked confirmed, no ordinary NeedItem planning |
| FU5-CC-P | same seed | 确认这是明确约束; `1` | Constraint written as `user_asserted` through DC C1; pending cleared |

FU5-CC-P was aligned with existing FU4-N2 confirmation assertions: it requires the authorized Constraint write, `user_asserted` verification, a DC version bump, and pending clear. It does not add a stricter "no RealityFact" prohibition than FU4-N2, because the existing C1 confirmation path may also increment `reality_facts` when a confirmed constraint is persisted.

## Official regressions

All commands were run on implementation SHA `8baca929f1f5b3107d3776386650f3dda334efb9` after the implementation commit and before this evidence commit.

| Command | Exit code | Result |
| --- | ---: | --- |
| `pnpm test:m1-production-adaptive-question-loop` | 0 | PASS=112 FAIL=0 |
| `pnpm test:m1-r-fresh-session-main-loop` | 0 | PASS=8 FAIL=0 |
| `pnpm test:m2-3-decision-blueprint` | 0 | 18 passed, 0 failed |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | 19 passed, 0 failed |
| `pnpm test:m2-2-freeze-report-binding` | 0 | 43 passed, 0 failed |
| `pnpm test:decision-context-phase2` | 0 | 9 passed |
| `pnpm exec next typegen` | 0 | Types generated successfully |
| `pnpm exec tsc --noEmit` | 0 | clean |
| `pnpm build` | 0 | Next.js build completed |

## Uncovered items / residual risks

- The parsers are conservative polarity heuristics, not a full Chinese NLP parser. Unseen double-negation, mixed contrast, or highly colloquial forms may remain unclear. In those cases the system fail-closes: pending is kept and DC is not written.
- Conflicting polarity that contains both a governing negation and a later separate affirmative clause is fail-closed as unclear for definition-patch (negative check wins) and as not-confirmed for constraint confirmation (negation is evaluated before affirmation). There is no dedicated extra named case for mixed contrast in a single sentence beyond the required phrases.
- The existing C1 path for a confirmed estimated constraint may also increment `reality_facts`. That behavior was not changed in this task and is outside the parser-only scope. FU5-CC-P follows FU4-N2 and does not treat it as a new FU5 failure.
- Estimated constraints still cannot be persisted as `user_estimate`; the Constraint mapper was not modified. Unconfirmed estimates remain pending.

## Git boundary

- Production implementation and evidence are separate commits.
- No pull request was opened.
- `main` was not merged or rebased onto.
- No deploy and no Vercel promote.
- This document does not declare product PASS. Delivery waits for independent review.

Implementation SHA: `8baca929f1f5b3107d3776386650f3dda334efb9`  
Parent SHA: `b7e6c9b92261b059f9b8b0a3077ff6d4e64bf9b1`  
Evidence tip SHA: _(pending Max review)_
