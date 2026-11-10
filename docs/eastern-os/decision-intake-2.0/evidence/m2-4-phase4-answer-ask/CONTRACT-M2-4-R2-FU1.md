# M2.4-R2-FU1 — Answer Item Authorization & Certainty Boundary

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent (baseline / R2 evidence tip):** `646c521e2be24457b162cd74beda62f639dcdeb3`  
**Implementation commit:** `2f04035c00d0c7bad047104bbb9b4a8bb5a96bd6`  
**Official regression ran on:** the exact production and test files later committed as `2f04035c00d0c7bad047104bbb9b4a8bb5a96bd6` (working tree frozen before this evidence-only commit)  
**Evidence tip SHA:** *(empty / pending Max review — this file must not contain a self-referential tip SHA)*  
**Status:** Implementation + tests + this evidence file committed for independent review. **Does not self-declare product PASS.**  
**No PR, no merge, no deploy, no Vercel promote.** No new Vercel preview/tip URL was produced by this work.

## Goal

Fix authorization and certainty in the M2.4-R2 model-draft → formal AnswerEvent conversion.

- Role authorization uses the complete authorized role code `v1/dir/{dir_id}/role/{role}`, not a role name.
- A missing/null `role_code_hint` must not expand one extracted item onto every authorized role.
- `unclear` is not written as `user_estimate`. `estimated` stays `user_estimate`. `explicit` stays `user_asserted`.
- Constraints follow the same role and certainty checks. Companion RealityFacts use the same DIR/role and verification level.

Answer Interpretation was not redesigned. Question Generation was not modified. FU6 conflict-clarification regex was not extended. `applyAnswerEventToSessionDc()` fact-authority rules, including `verification_level: none` normalization, were not changed.

## Files changed

### Implementation commit `2f04035c00d0c7bad047104bbb9b4a8bb5a96bd6`

- `lib/poju/decision-intake/types.ts`
- `lib/poju/decision-intake/answer-interpretation-model.ts`
- `lib/poju/decision-intake/answer-interpretation.ts`
- `scripts/test-m1-production-adaptive-question-loop.ts`

`adaptive-turn.ts` was not modified. `scripts/fixtures/test-answer-interpretation-hook.ts` was not modified.

### Evidence commit

- `docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-M2-4-R2-FU1.md` (this file)

## Role authorization

`activeTargets()` now returns `fact_role_codes` taken only from the actually-sent Plan:

1. `last_sent_question.fact_role_codes` when last-sent has DIR/DDR targets.
2. Else, only when `next_question_plan.plan_id` exactly matches `last_sent_question.plan_id`, the matching plan's `fact_role_codes` (historical sessions).
3. Else the current actually-sent / next plan's `fact_role_codes`.

Codes are never invented as `role:{role}` and never expanded from `Blueprint.required_fact_roles`.

`buildModelInterpretationContext()` copies `activeTargets(session).fact_role_codes` into `context.authorized.fact_role_codes`. The production SYSTEM_PROMPT requires `role_code_hint` to be one complete string from that set, or null. The model must not construct codes, infer DIR/DDR, bind multiple roles on one item, or copy one fact into several role variants.

`role_hint` remains on the draft type and is still parsed, only for historical test data compatibility. It is **not** used as the production authorization basis in `answerEventFromModelDraft()`.

`role_code_hint` is optional on the TypeScript input type (`role_code_hint?: string | null`) so the out-of-scope fixture and historical drafts still typecheck. The parser always normalizes a missing or empty value to `null`.

Per extracted item, conversion follows the specified rules:

- unauthorized code → unresolved note only; no DC write
- null code when `authorizedRoleCodes.length !== 1` → unresolved note only; no DC write
- null code when exactly one authorized code → that unique code
- accepted code must match `^v1/dir/([^/]+)/role/([^/]+)$` or the item fail-closes
- ProposedWrite binds only `fact_roles: [authorizedRole]` and `related_dir_ids: [authorizedDirId]`

One fact is never auto-copied onto multiple roles. Multiple roles require multiple independent extracted items, each with a legal `role_code_hint`.

## Certainty boundary

The previous `notExplicit` path treated `unclear` as `user_estimate`. It is replaced by three branches:

| Model certainty | Formal DC behavior |
|---|---|
| explicit | unverified + user_asserted |
| estimated | unverified + user_estimate |
| unclear | no RealityFact / Constraint; keep `unresolved:unclear_certainty:...` |

If a turn has only unclear items, the AnswerEvent may remain but `proposed_writes` is empty.

`unknown` and `declined` classifications still use the existing DC state rules (`status=unknown|declined`, `verification_level=none`). Role-code authorization still applies to those items; null still does not expand to every authorized role.

`applyAnswerEventToSessionDc()` was not modified to work around this.

## Constraints

Constraints pass the same role-code and certainty checks first.

- explicit → `unverified + user_asserted` Constraint, plus a companion RealityFact with the same DIR/role and `user_asserted`.
- unclear → no Constraint and no companion.
- estimated → **not persisted**. `applyAnswerEventToSessionDc()` currently hardcodes `Constraint.verification_level = "user_asserted"` and was intentionally left unchanged. The Constraint type and other persist paths (opening seed, confirm-and-freeze) allow `user_estimate`, but this production answer-apply path would disguise an estimate as `user_asserted`. FU1 therefore fail-closes estimated constraints to unresolved (`estimated_constraint_not_persistable`) and does not write a companion RealityFact. Case M records this honestly.

## Tests

All new Cases G–M go through real `createPOJUSession()` → `handleUserMessage()`, injecting drafts via existing `__testOnlyM1Hooks.interpretAnswerModel`.

`answerEventFromModelDraft()` is used only as a supplementary notes probe so unresolved aspects can be logged; it is not the only test.

Existing R2 Cases A–F and prior M2.4-R1 suites remain. A–F injected drafts were updated in the adaptive test script to supply legal `role_code_hint` values, because the old `role_hint: null` path would otherwise fail under multi-role last-sent (especially Case A round 3, which merges the original fact's role code into last-sent) and because `role_hint` is no longer an authorization basis (Case B overreach used a role name only). Case E `"我需要再核实一下。"` (vague_answer + certainty=unclear) previously wrote `unverified:user_estimate`; after FU1 it writes nothing and keeps unclear unresolved. The Case E assertion was tightened accordingly. The deterministic hook fixture was not changed; typical first plans still have a single role code, so null uniquely binds there.

## Case G–M real handleUserMessage logs

Captured from `pnpm test:m1-production-adaptive-question-loop` after the G/I assertion fix, on the files committed as implementation SHA `2f04035c00d0c7bad047104bbb9b4a8bb5a96bd6`. Suite result: **83/83, exit 0**.

```
[m24r2g] codes=v1/dir/DIR-OPT-CONSTRAINTS/role/hard_constraint|v1/dir/DIR-OPT-ON-TABLE/role/option; facts=0->0; constraints=0->0; dc=1->1; asked=1->2; unresolved=rejected_null_role_code_multi_auth,unresolved:unlocated_role_code:我目前仍在职。; writes=0; next_q=关于「要不要离职去创业？」——有哪些真实可选方案（不要只重复决策目标）？（这样我才能判断：Needed for DIR-OPT-ON-TABLE）; next_dirs=DIR-OPT-ON-TABLE; last_sent=qp_cq_dir_DIR-OPT-ON-TABLE_2026-11-10T10:37:52.577Z
[m24r2h] codeA=v1/dir/DIR-OPT-CONSTRAINTS/role/hard_constraint; codeB=v1/dir/DIR-OPT-ON-TABLE/role/option; factA=fact_m1_4d5b2bcb-5d43-4c4e-8b01-14cf6581fc4b_0:hard_constraint:DIR-OPT-CONSTRAINTS; factB=fact_m1_4d5b2bcb-5d43-4c4e-8b01-14cf6581fc4b_1:option:DIR-OPT-ON-TABLE; dc=1->2
[m24r2i] legal=v1/dir/DIR-OPT-CONSTRAINTS/role/hard_constraint; forged=v1/dir/DIR-FORGED/role/forged_role; overreach=0; legal_facts=1; legal_bind=fact_m1_39ea3c1f-3279-459a-af53-cb85f27e394c_0:hard_constraint:DIR-OPT-CONSTRAINTS; dc=1->2; notes=rejected_unauthorized_role_code,unresolved:unauthorized_role_code:v1/dir/DIR-FORGED/role/forged_role:伪造角色不应写入。; plan=qp_cq_dir_DIR-OPT-ON-TABLE_2026-11-10T10:37:52.669Z
[m24r2j] code=v1/dir/DIR-OPT-CONSTRAINTS/role/hard_constraint; facts=0->0; constraints=0->0; dc=1->1; writes=0; unresolved=unresolved:unclear_certainty:用户可能有一定资金储备
[m24r2k] code=v1/dir/DIR-OPT-CONSTRAINTS/role/hard_constraint; fact=fact_m1_3bf2ef62-1c80-40b6-81b4-42f7d4e5f45b_0:unverified:user_estimate:hard_constraint:DIR-OPT-CONSTRAINTS; dc=1->2
[m24r2l] code=v1/dir/DIR-OPT-CONSTRAINTS/role/hard_constraint; fact=fact_m1_6fd3a81d-cb44-4e1c-a16f-1bba208359c3_0:unverified:user_asserted:confirmed=false:user_confirmed=false:hard_constraint:DIR-OPT-CONSTRAINTS; dc=1->2
[m24r2m] tag=m24r2m_explicit; certainty=explicit; code=v1/dir/DIR-OPT-CONSTRAINTS/role/hard_constraint; cst=cst_m1_390d8f57-ad87-4631-9adc-af77e00ef253_0:unverified:user_asserted:DIR-OPT-CONSTRAINTS; companion=fact_m1_390d8f57-ad87-4631-9adc-af77e00ef253_1:unverified:user_asserted:hard_constraint:DIR-OPT-CONSTRAINTS; same_level=true; same_dir=true; dc=1->2; notes=
[m24r2m] tag=m24r2m_estimated; certainty=estimated; code=v1/dir/DIR-OPT-CONSTRAINTS/role/hard_constraint; cst=none; companion=none; same_level=n/a; same_dir=n/a; dc=1->1; notes=estimated_constraint_unresolved,unresolved:estimated_constraint_not_persistable:估计必须保留社保。
[m24r2m] tag=m24r2m_unclear; certainty=unclear; code=v1/dir/DIR-OPT-CONSTRAINTS/role/hard_constraint; cst=none; companion=none; same_level=n/a; same_dir=n/a; dc=1->1; notes=unresolved:unclear_certainty:可能有必须保留社保的约束。
```

Per-item DIR/role and certainty results:

- **G:** two authorized codes; `role_code_hint: null`; no RealityFact; no Constraint; DC 1→1; unresolved `unlocated_role_code` kept; did not fill both roles; next question came from existing NeedItem (`DIR-OPT-ON-TABLE`). Asked count 1→2 because a new authorized question was still sent after the no-write turn (not an interpretation failure).
- **H:** fact A bound only `hard_constraint` / `DIR-OPT-CONSTRAINTS`; fact B bound only `option` / `DIR-OPT-ON-TABLE`; no cross-write; DC 1→2 once.
- **I:** forged `v1/dir/DIR-FORGED/role/forged_role` not written; legal item bound `hard_constraint` / `DIR-OPT-CONSTRAINTS`; forged code not absorbed into last_sent or the next Plan.
- **J:** unclear legal fact; facts/constraints unchanged; DC 1→1; no `user_estimate` or `user_asserted` write; `unclear_certainty` unresolved kept; `proposed_writes` empty.
- **K:** estimated fact `unverified` + `user_estimate`; not upgraded to `user_asserted`; bound only the specified DIR/role.
- **L:** explicit fact `unverified` + `user_asserted`; not confirmed (`user_confirmed=false`, no Confirmation Event); bound only the specified DIR/role.
- **M explicit:** Constraint and companion RealityFact both `unverified` + `user_asserted`, same DIR (`DIR-OPT-CONSTRAINTS`) and matching role binding; DC 1→2.
- **M estimated:** no Constraint and no companion; DC 1→1; unresolved `estimated_constraint_not_persistable` because the apply path would have disguised it as `user_asserted`.
- **M unclear:** no Constraint and no companion; DC 1→1; unresolved `unclear_certainty`.

## Existing R2 A–F logs (same run, after draft updates)

```
[m24r2a] round=1 input=我目前仍在职，月薪三万。另外家里有一个孩子。; facts=2; written=fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_0:unverified:user_asserted:hard_constraint|fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_1:unverified:user_asserted:hard_constraint; dc=1->2; ctx_ver=2; next_q=关于「要不要离职去创业？」——有哪些真实可选方案（不要只重复决策目标）？（这样我才能判断：Needed for DIR-OPT-ON-TABLE）; next_dirs=DIR-OPT-ON-TABLE; next_roles=v1/dir/DIR-OPT-ON-TABLE/role/option; asked=1->2
[m24r2a] round=2 input=大概还能撑 6 个月。硬约束是必须保留社保。; estimate=fact_m1_eac78bcf-6cdc-4570-9ee2-b795410666fd_0:unverified:user_estimate; constraint=cst_m1_eac78bcf-6cdc-4570-9ee2-b795410666fd_1:unverified; facts=4; constraints=1; dc=2->3; ctx_ver=3; next_q=关于「要不要离职去创业？」——可以接受的最差结果是什么？（这样我才能判断：Needed for DIR-RISK-TOLERANCE）; next_dirs=DIR-RISK-TOLERANCE; next_roles=v1/dir/DIR-RISK-TOLERANCE/role/risk; asked=2->3
[m24r2a] round=3 input=更正一下，我已经离职了，不是仍在职。另外还有一个备选是内部转岗。; kept_original=fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_0; correction=fact_m1_cc4694e0-82c1-4d46-87ce-d3454485ce41_0; supplement=fact_m1_cc4694e0-82c1-4d46-87ce-d3454485ce41_1; conflicts=cf_m1_cc4694e0-82c1-4d46-87ce-d3454485ce41_0:open:fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_0+fact_m1_cc4694e0-82c1-4d46-87ce-d3454485ce41_0; fact_ids_before=fact_m1_eac78bcf-6cdc-4570-9ee2-b795410666fd_0,fact_m1_eac78bcf-6cdc-4570-9ee2-b795410666fd_2,fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_0,fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_1; fact_ids_after=fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_0,fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_1,fact_m1_eac78bcf-6cdc-4570-9ee2-b795410666fd_0,fact_m1_eac78bcf-6cdc-4570-9ee2-b795410666fd_2,fact_m1_cc4694e0-82c1-4d46-87ce-d3454485ce41_0,fact_m1_cc4694e0-82c1-4d46-87ce-d3454485ce41_1; dc=3->4; ctx_ver=4; next_q=我发现这项信息存在两条不一致的记录：
1. 我目前仍在职，月薪三万。
2. 我已经离职了，不是仍在职。
请明确选择哪一条准确。也可以说明两条都不准确，我会继续核实，不会自行替你判断。; next_dirs=DIR-OPT-CONSTRAINTS; next_cf=cf_m1_cc4694e0-82c1-4d46-87ce-d3454485ce41_0
[m24r2b] auth_dirs=DIR-OPT-CONSTRAINTS; auth_roles=hard_constraint; overreach_facts=0; legal_facts=1; dc=1->2
[m24r2c] facts=fact_m1_a9e1577f-dce0-4085-84af-85d27d9e430e_0:unverified:user_asserted:confirm=undefined
[m24r2d_timeout] outcome=answer_interpretation_failed; dc=1->1; facts=0; constraints=0; asked=1; last_sent=qp_cq_dir_DIR-OPT-CONSTRAINTS_2026-11-08T12:00:00.000Z; asst=【系统】本轮回答未能完成语义理解，决策上下文未写入。请稍后重试，或换一种表述。(timeout:llm_timeout)
[m24r2d_json] outcome=answer_interpretation_invalid_schema; dc=1->1; facts=0; constraints=0; asked=1; last_sent=qp_cq_dir_DIR-OPT-CONSTRAINTS_2026-11-08T12:00:00.000Z; asst=【系统】本轮回答未能完成语义理解，决策上下文未写入。请稍后重试，或换一种表述。(invalid_json:Unexpected token 'h', "this is not json {" is not valid JSON)
[m24r2d_schema] outcome=answer_interpretation_invalid_schema; dc=1->1; facts=0; constraints=0; asked=1; last_sent=qp_cq_dir_DIR-OPT-CONSTRAINTS_2026-11-08T12:00:00.000Z; asst=【系统】本轮回答未能完成语义理解，决策上下文未写入。请稍后重试，或换一种表述。(invalid_schema:extracted_items_not_array)
[m24r2e] tag=m24r2e_estimate; input=这个数字只是估计。; writes=unverified:user_estimate
[m24r2e] tag=m24r2e_unknown; input=我现在还无法确定。; writes=unknown:none
[m24r2e] tag=m24r2e_declined; input=这部分我不想回答。; writes=declined:none
[m24r2e] tag=m24r2e_unverified; input=我需要再核实一下。; writes=none
[m24r2f] turn=44b59e9e-895f-41a4-afe1-99e7bf029933; facts=1; constraints=1; dc=2->2; asked=2; q_recovered=true
```

## Regression exit codes

All commands below were executed on the frozen implementation files that were then committed as `2f04035c00d0c7bad047104bbb9b4a8bb5a96bd6`. Times are America/Chicago local from the Windows checkout clock.

| Command | Exit code | Result |
|---|---|---|
| `pnpm test:m1-production-adaptive-question-loop` | 0 | 83/83 |
| `pnpm test:m1-r-fresh-session-main-loop` | 0 | 8/8 |
| `pnpm test:m2-3-decision-blueprint` | 0 | 18/18 |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | 19/19 |
| `pnpm test:m2-2-freeze-report-binding` | 0 | 43/43 |
| `pnpm test:decision-context-phase2` | 0 | 9 |
| `pnpm exec next typegen` | 0 | Types generated successfully |
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm build` | 0 | |

## Leftovers / deviations

- `role_code_hint` is optional on the TypeScript draft type so the out-of-scope fixture `scripts/fixtures/test-answer-interpretation-hook.ts` still compiles without modification. Missing values are treated as null.
- Estimated Constraint is not legally persistable through `applyAnswerEventToSessionDc()` without being rewritten as `user_asserted`. Case M fail-closes to unresolved rather than disguising the estimate. The apply mapper was not changed.
- `definition_patch` now follows the same certainty and role-code rules, but `applyAnswerEventToSessionDc()` still does not map definition patches into DC (unchanged).
- Case G's no-write turn still plans and sends the next NeedItem question, so `session_asked_count` advanced 1→2 and `last_sent_question` advanced to that new plan. This is not an interpretation-failure fail-closed path.
- Cases G and I use a supplementary `answerEventFromModelDraft()` call only to observe unresolved notes, which are not persisted on the Session returned by `handleUserMessage()`.
- Tests still inject ModelAnswerDraft via `__testOnlyM1Hooks`; they do not call live OpenRouter. No unscripted online LLM session.
- Question Generation is still deterministic / plan-authoritative. This task did not modelize question text.
- Case R still has one `runCollectingDcTurn` replay path; Case Y is still an official C1 test hook, not a real IndexedDB abort.
- 「两条都不准确」 still has no replace-then-formally-close Conflict path. No Phase 5.
- `conflict-clarification.ts` / `conflict-clarification-turn.ts` were not modified.
- `public/sw.js`, `.cursor/plans/*`, and `temp/*` were left unstaged.

This evidence does not declare product PASS. It is submitted for independent review.
