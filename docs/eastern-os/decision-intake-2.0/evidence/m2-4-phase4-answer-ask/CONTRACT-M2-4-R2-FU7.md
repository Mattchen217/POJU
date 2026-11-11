# M2.4-R2-FU7 — Conservative Action Polarity Gate

Production-code repair on `feat/m1-r-fresh-session-main-loop`. This is an evidence record, not a product PASS declaration.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Baseline / parent of the implementation: `f474973698a1f0cf4a0799656ed5fd5fafdf5f33`
- Implementation SHA (all official regressions ran on this commit): `a1c0f5363e372d4d507191c2b177ef28b1fd072f`
- Evidence tip SHA: _(left empty / pending Max review)_
- Observed `origin/main` at the start of this work / re-checked after official regressions: `ee8c96e8a7a128fa8e059c2a9f81c9f0d2127688` (not merged, not rebased onto)

## Goal

FU6 closed its named examples but still used a finite negative-verb whitelist. Unknown opposition verbs such as `不赞同`, and bare opposition verbs such as `反对` / `拒绝`, could still reach an affirmative substring (`作为明确事实`, `可以写入`, `确认这是明确约束`) and return a write decision.

This change replaces that whitelist-dependent write decision with a shared conservative polarity gate tied to the proposed write action.

Safety invariant: if the response contains a possible negation, refusal, opposition, or conflicting polarity that may govern the proposed write action, the parser must not return an affirmative write decision unless the response is unambiguously affirmative (numbered choices remain that path). If uncertain, keep pending. False negatives are acceptable. False-positive DC writes are not.

## Files changed

### Implementation commit `a1c0f5363e372d4d507191c2b177ef28b1fd072f`

- `lib/poju/decision-intake/pending-answer-resolution.ts`
  - Added a shared helper `writeActionPolarityBlocked()`. It inspects the complete user response, not a list of complete negative sentences. Broad markers include the particles `不` / `没` / `未` / `无` / `非`, the compounds `并非` / `并不` / `不能` / `不可` / `不要`, and the opposition verbs `拒绝` / `反对` / `否定` / `排除`. Unknown verbs such as `不赞同` are caught by the particle `不`; this is not a verb whitelist.
  - The gate is a whole-response scan in relation to the proposed write action. A later affirmative substring does not withdraw an earlier marker. Mixed or uncertain polarity fails closed.
  - `parseDefinitionPatchChoice()` and `parseConstraintConfirmChoice()` still evaluate numbered choices first, then the existing uncertainty (and, for constraints, estimate) handling. Before returning `as_fact: true` or `confirmed: true`, they run the shared gate. A blocked response returns `{ ok: false, reason: "unclear" }` and stays pending.
  - The previous whitelist helpers `hasDefinitionPatchNegativeAction()` and `confirmNegated()` were removed. Public parser interfaces are unchanged. Downstream DC write authorization, the Constraint mapper, and the existing C1 behavior that may also create a RealityFact when a Constraint is confirmed were not modified.

- `scripts/test-m1-production-adaptive-question-loop.ts`
  - New real `handleUserMessage()` cases FU7-DP-N, FU7-CC-N, FU7-DP-P, and FU7-CC-P. Existing FU6, FU5, FU4-A–E, FU4-N1–N3, FU4-T, FU3-A–H, and earlier regression assertions were not deleted or weakened.

No other production files were changed. Question Generation, Model Answer Interpretation, Blueprint, DIR/DDR authorization, Conflict, Readiness, Freeze, Phase 5, and report generation were not modified.

### Evidence commit

This file. Tip SHA left empty / pending Max review. The implementation SHA recorded above is the SHA the tests actually ran on. This evidence commit itself was not used as the test SHA.

## Parser classification

### Shared gate

`writeActionPolarityBlocked()` returns true when any configured polarity marker appears anywhere in the response. The two write parsers call it after numbered choices and after uncertainty / estimate handling, and they refuse to return an affirmative write when it is true. Numbered `1` / `2` / `3` remain authoritative and do not go through the gate.

### `parseDefinitionPatchChoice()`

The following must return `{ ok: false, reason: "unclear" }` rather than `as_fact: true`. On the production path they write no RealityFact and no Constraint, do not bump DC version, keep the original `definition_patch_not_persistable` item pending, do not enter ordinary NeedItem planning, and are not replaced by a free-form model response:

- 我不赞同把它作为明确事实
- 我反对把它作为明确事实
- 我拒绝把它作为明确事实
- 我不支持把它作为明确事实
- 我不希望把它作为明确事实，请作为明确事实记录
- 我不打算把它作为明确事实
- 我不认为应该把它作为明确事实

The last two phrases were already covered by FU6 / FU5 production-path tests and remain covered.

Existing clearly affirmative phrases still pass when the gate finds no negative or conflicting signal, and still persist through the authorized DC C1 path:

- 改为作为明确事实记录
- 作为明确事实
- 请把它作为明确事实记录
- numbered `1`

Numbered `2` remains a refusal. Existing uncertainty handling is unchanged.

### `parseConstraintConfirmChoice()`

The following never return `confirmed: true`. On the production path they write no Constraint and no RealityFact, do not bump DC version, keep the original pending item, do not mark it explicit/confirmed, do not enter ordinary NeedItem planning, and are not replaced by a free-form model response:

- 我不赞同可以写入
- 我反对可以写入
- 我拒绝确认这是明确约束
- 我不支持将它作为明确约束
- 我不赞成可以写入，确认这是明确约束
- 我不认为可以写入

The last phrase was already covered by FU5 production-path tests and remains covered.

Existing unambiguously affirmative confirmation still writes a `user_asserted` Constraint through the existing authorized DC C1 path:

- 确认这是明确约束
- 可以写入
- numbered `1`

Numbered `2` and `3` semantics, and existing uncertainty / estimate handling (`目前无法确定`, `仍然只是估计`), are preserved.

## Production-path test cases

All new cases go through `handleUserMessage()`. Parser-only tests were not used to satisfy this task. Model drafts are injected only via existing `__testOnlyM1Hooks.interpretAnswerModel`.

| Case | Seed | Phrases | Result on implementation SHA |
| --- | --- | --- | --- |
| FU7-DP-N | `definition_patch_not_persistable` pending | 我不赞同把它作为明确事实; 我反对把它作为明确事实; 我拒绝把它作为明确事实; 我不支持把它作为明确事实; 我不希望把它作为明确事实，请作为明确事实记录 | no RealityFact, no Constraint, DC version unchanged, original pending `item_id` remains active with reason `definition_patch_not_persistable`, no ordinary NeedItem planning, no free-form model reply |
| FU7-CC-N | `estimated_constraint_not_persistable` pending | 我不赞同可以写入; 我反对可以写入; 我拒绝确认这是明确约束; 我不支持将它作为明确约束; 我不赞成可以写入，确认这是明确约束 | no target Constraint write, no new RealityFact, DC version unchanged, original pending `item_id` remains active and is not marked explicit, no ordinary NeedItem planning, no free-form model reply |
| FU7-DP-P | same definition-patch seed | 请把它作为明确事实记录 | converted RealityFact written to the authorized DIR/role through DC C1; pending cleared |
| FU7-CC-P | same estimated-constraint seed | 可以写入 | Constraint written as `user_asserted` through DC C1; pending cleared |

FU5 / FU6 positive and negative cases, numbered choices, and earlier regression assertions were retained and passed on the same implementation SHA (adaptive suite 120/120, previously 116, plus four new FU7 checks).

FU7-CC-P follows FU5-CC-P / FU4-N2: it requires the authorized Constraint write, `user_asserted` verification, a DC version bump, and pending clear. It does not add a stricter "no RealityFact" prohibition than the existing C1 confirmation path, which may also increment `reality_facts` when a confirmed constraint is persisted.

## Official regressions

All commands were run on implementation SHA `a1c0f5363e372d4d507191c2b177ef28b1fd072f` after the implementation commit and before this evidence commit.

| Command | Exit code | Result |
| --- | ---: | --- |
| `pnpm test:m1-production-adaptive-question-loop` | 0 | PASS=120 FAIL=0 |
| `pnpm test:m1-r-fresh-session-main-loop` | 0 | PASS=8 FAIL=0 |
| `pnpm test:m2-3-decision-blueprint` | 0 | 18 passed, 0 failed |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | 19 passed, 0 failed |
| `pnpm test:m2-2-freeze-report-binding` | 0 | 43 passed, 0 failed |
| `pnpm test:decision-context-phase2` | 0 | 9 passed |
| `pnpm exec next typegen` | 0 | Types generated successfully |
| `pnpm exec tsc --noEmit` | 0 | clean (no output) |
| `pnpm build` | 0 | Next.js 16.2.4 webpack production build completed. Pre-existing warnings only (middleware-to-proxy deprecation, browserslist age, `iztro` named `version` import in `lib/ziwei/fact-pack.ts`). Not introduced by this change. |

## Uncovered items / residual risks

- The gate is a conservative whole-response marker scan, not a full Chinese clause parser. It will fail-close some legitimate but complicated positives that contain a listed particle or verb even when the user intended to confirm. Examples include a preface or discourse marker that happens to contain `不` / `非` / `没` / `无` (such as `不过还是作为明确事实记录`, `非常确定，作为明确事实`, or `没问题，可以写入`). Numbered clarification choices remain the unambiguous affirmative path.
- Markers that appear only in an unrelated aside, or double-negation that a speaker might intend as affirmation, are also fail-closed. That is accepted under this task.
- English-only negation (`no`, `not`, `cannot`) is not part of the marker set. Responses that use only those words and also contain a Chinese affirmative substring could still write, unless they are caught by existing English uncertainty / refusal regexes.
- The existing C1 path for a confirmed estimated constraint may also increment `reality_facts`. That mapper behavior was not changed and is outside this task.
- Estimated constraints still cannot be persisted as `user_estimate`; the Constraint mapper was not modified. Unconfirmed estimates remain pending.
- This is the final targeted polarity-safety closure for the current FU5/FU6 parser issue. Isolated extra negation examples were not added beyond the required FU7 cases.

## Git boundary

- Production implementation and evidence are separate commits.
- No pull request was opened.
- `main` was not merged or rebased onto.
- No deploy and no Vercel promote.
- This document does not declare product PASS. Delivery waits for independent review.

Implementation SHA: `a1c0f5363e372d4d507191c2b177ef28b1fd072f`  
Parent SHA: `f474973698a1f0cf4a0799656ed5fd5fafdf5f33`  
Evidence tip SHA: _(pending Max review)_
