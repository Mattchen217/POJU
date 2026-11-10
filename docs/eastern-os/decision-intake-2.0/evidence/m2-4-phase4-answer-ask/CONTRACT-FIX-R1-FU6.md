# M2.4-R1-FU6 — Accuracy-Rate Polarity Boundary

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent (baseline / FU5 evidence tip):** `ee1f601a40a2302cff909aba6500a3ce566dffbb`  
**Implementation commit (parser + Cases Z21–Z25):** `d382f2e48ed03398c6b4c19ea04ecc2ac84cefff`  
**Final implementation HEAD (suite ran here):** `d382f2e48ed03398c6b4c19ea04ecc2ac84cefff`  
**Evidence tip SHA:** *(empty / pending Max review — this file must not contain a self-referential tip SHA)*  
**Status:** Implementation + tests + this evidence file committed for independent review. **Does not self-declare product PASS.**

## Goal

Close the FU5 review gap on accuracy-rate wording. After FU5, `analyzeFragment()` and `AFFIRM_KW_RE` still did not treat constructions such as `准确率不高` / `正确率不足` as negative polarity, and the noun forms `准确率` / `正确率` could be read as affirmative evidence.

This follow-up adds construction-level recognition of accuracy-rate insufficiency, folds it into negation before any affirmative assignment, tightens `AFFIRM_KW_RE` so rate nouns cannot confirm a RealityFact, and fail-closes `restatementChoice()` on the same constructions. It does not rewrite Answer Interpretation, DC, Blueprint, Understanding, Readiness, Question Planning, or the C1 persistence lifecycle, and does not expand Phase 5. The only production file changed is `lib/poju/decision-intake/conflict-clarification.ts`.

## Changed files and key functions

### Production

- `lib/poju/decision-intake/conflict-clarification.ts`
  - Added `ACCURACY_RATE_INSUFFICIENCY_RE` next to Family A, allowing an optional option mention between the rate noun and the evaluator so both `第一条准确率不高` and `准确率第一条不高` (and the `正确率` equivalents) are recognized as a unit:
    - `/(?:准确率|正确率)(?:第?(?:一|1|二|2)(?:条|项))?(?:不高|偏低|较低|低|不足|有限|不够|不理想)/`
  - Wired `accuracyRateInsufficient` into `analyzeFragment()` immediately after `insufficientAccuracy`, and folded it into `hasNeg` so accuracy-rate insufficiency is treated as negative polarity, not affirmation and not a plain fact description.
  - Stripped `ACCURACY_RATE_INSUFFICIENCY_RE` from the fragment residual, same pattern as Family A insufficient / uncertain stripping, so leftover `准确` / `正确` cannot override a negative reading.
  - Tightened `AFFIRM_KW_RE` to:
    - `/是对的|是正确的|(?<!不)准确(?![度性率]|程度)|(?<!不)正确(?![性率])|(?<!不)对的|为准/`
    - `准确率` and `正确率` alone are not confirmation of a RealityFact.
  - Added `ACCURACY_RATE_INSUFFICIENCY_RE` to the `restatementChoice()` fail-closed construction checks, so accuracy-rate insufficiency cannot bypass `parseExplicitChoice()` and get selected via restatement.
  - Existing choice rules are unchanged:
    - only one option explicitly negated → do not auto-confirm the other
    - one negated and the other independently, explicitly affirmed → may select the affirmed one
    - both affirmed → ambiguous
    - same option affirmed and negated → ambiguous
    - negation scope cannot be determined → ambiguous
    - uncovered wording must not be misread as affirmation via ordinary keyword matching
  - Standalone `1` / `2` behavior is unchanged. Valid contrast is unchanged (`不是第一条，而是第二条准确` → second; inverse → first).
  - `resolveConflictChoice()` still calls `parseExplicitChoice()` first; `Conflict.state = "clarified"` is never assigned directly; `clarifyConflict()` and the C1 persist path are unchanged.

### Tests

- `scripts/test-m1-production-adaptive-question-loop.ts`
  - Added Cases Z21–Z25 after FU5 Z11–Z20, all through the real `handleUserMessage()` production path and the existing `seedSameDirConflict()` / `answerSeededConflict()` fixture, using `assertAmbiguousClarification` / `assertSelectedClarification`.
  - FU2 Cases N–T, FU3 Cases U–Y, FU4 Cases Z1–Z10, and FU5 Cases Z11–Z20 remain in the same suite.

No other Phase 4 production modules were modified.

## Official lifecycle (unchanged)

```
user answer
  → last_sent_question.conflict_clarification
  → resolveConflictChoice
  → only explicit select
  → clarifyConflict(user_confirmation=true)
  → reaggregateDirsOnSession
  → persistDcLifecycleChange(C1, key dc_conflict_clarify:${session_id}:${source_turn_id})
  → rebuild Understanding / Readiness / next plan
```

`Conflict.state = "clarified"` is never assigned directly. Ambiguous answers do not mutate Conflict, do not add/delete/overwrite RealityFacts, and do not bump DC version.

## Accuracy-rate polarity rules as implemented

`parseExplicitChoice(statement)` still compactifies the text and splits contrast clauses first (`而是` / `但是` / `不过` / `可是` / `但`). Bare `1` / `2` may select only when the entire compact statement is that token.

Each fragment is analyzed in this order:

1. Option mention detection for first/second forms (`第一条` / `第1条` / `第二条` / `第2条`, including `项`). A bare mention is not a choice.
2. **Insufficient-accuracy constructions (Family A)** remain as in FU5 and still mark the mentioned option as **negated**.
3. **Accuracy-rate insufficiency** is now detected as a unit, not as a lone `准确` / `正确` keyword:
   - 准确率不高 / 准确率偏低 / 准确率较低 / 准确率低
   - 准确率不足 / 准确率有限 / 准确率不够 / 准确率不理想
   - 正确率 + the same evaluators
   - An optional option mention may sit between the rate noun and the evaluator (`准确率第一条不高`, `正确率第二条不足`).
   These mark the mentioned option as **negated**. If the construction is present and mentions no option, or mentions both options in the same fragment, the result is `unknown_negation_scope` / `ambiguous`.
4. **Uncertain-accuracy constructions (Family B)** and **explicit rejection (Family C)** remain as in FU5.
5. Prior FU4 negation and hedge cues remain in force.
6. Rejecting the first option does not infer confirmation of the second, and vice versa.
7. Insufficient / uncertain / accuracy-rate constructions are then stripped from the fragment. Only residual text may supply affirmative evidence (`准确`, `是对的`, `是正确的`, `对的`, `正确`, `为准`, `我选`, `选择`). Affirmation cannot override negation or hedge of the same option in the same fragment. `准确率` / `正确率` in residual text do not match `AFFIRM_KW_RE`.
8. Cross-fragment merge is unchanged:
   - same option affirmed and negated → `conflicting_choice`
   - any hedge → `hedged_choice`
   - both options independently affirmed → `both_selected`
   - a definite selection requires exactly one option with independent affirmative evidence that is never negated
   - therefore `第一条准确率不高，但第二条准确` selects the second only because the second fragment independently affirms the second option after the first is rejected

These rules are deterministic heuristics, not semantic NLI. Uncovered wording fail-closes to `ambiguous`.

## Case results (real, against final implementation HEAD d382f2e4)

Recorded from `pnpm test:m1-production-adaptive-question-loop` on the tree that became SHA `d382f2e48ed03398c6b4c19ea04ecc2ac84cefff` (UTF-8 log `temp/out_m24fu6_m1adaptive.txt`). Suite result: **PASS=67 FAIL=0**, exit 0. All cases ran through real `handleUserMessage()` and asserted against the persisted / returned session. No further production or test edits were made after this run; this evidence file is a later, documentation-only commit.

### FU6 Case Z21–Z25 (verbatim logs)

```
[m24z21] input=第一条准确率不高; cf=conflict_fact_m24z21_a+fact_m24z21_b_dfd37493; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z21_a,fact_m24z21_b; dc=2->2; next_cf=conflict_fact_m24z21_a+fact_m24z21_b_dfd37493
  PASS  M2.4-R1-FU6 Case Z21: 准确率不高 first must stay ambiguous
[m24z22] input=第二条准确率偏低; cf=conflict_fact_m24z22_a+fact_m24z22_b_08ebe8b9; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z22_a,fact_m24z22_b; dc=2->2; next_cf=conflict_fact_m24z22_a+fact_m24z22_b_08ebe8b9
  PASS  M2.4-R1-FU6 Case Z22: 准确率偏低 second must stay ambiguous
[m24z23] input=第一条正确率不高; cf=conflict_fact_m24z23_a+fact_m24z23_b_f0bff2ee; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z23_a,fact_m24z23_b; dc=2->2; next_cf=conflict_fact_m24z23_a+fact_m24z23_b_f0bff2ee
  PASS  M2.4-R1-FU6 Case Z23: 正确率不高 first must stay ambiguous
[m24z24] input=第二条正确率不足; cf=conflict_fact_m24z24_a+fact_m24z24_b_05813025; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z24_a,fact_m24z24_b; dc=2->2; next_cf=conflict_fact_m24z24_a+fact_m24z24_b_05813025
  PASS  M2.4-R1-FU6 Case Z24: 正确率不足 second must stay ambiguous
[m24z25] input=第一条准确率不高，但第二条准确; cf=conflict_fact_m24z25_a+fact_m24z25_b_48c30944; state=clarified; confirm=true; resolution={"selected_fact_id":"fact_m24z25_b","source_turn_id":"66a09000-ebba-4744-b849-e5a5a50404b5","user_statement":"第一条准确率不高，但第二条准确"}; selected=fact_m24z25_b; expected=fact_m24z25_b; facts=2; dc=2->3
  PASS  M2.4-R1-FU6 Case Z25: accuracy-rate insufficient first and affirmed second selects the second fact
```

| Case | Input | Expected | Observed |
|------|-------|----------|----------|
| Z21 | 第一条准确率不高 | ambiguous | open; confirm=false; resolution=null; selected=none; facts/IDs unchanged; DC 2→2; next question same conflict_id |
| Z22 | 第二条准确率偏低 | ambiguous | same as Z21 for second option |
| Z23 | 第一条正确率不高 | ambiguous | same as Z21 |
| Z24 | 第二条正确率不足 | ambiguous | same as Z21 for second option |
| Z25 | 第一条准确率不高，但第二条准确 | select second if independently affirmed | clarified; confirm=true; selected=fact_m24z25_b; facts=2; DC 2→3 once. Parser independently established first rejected and second affirmed; did not fail-closed. |

Z25 did not incorrectly close to the rejected first option. Both original RealityFacts were preserved.

### FU5 Case Z11–Z20 regression

```
[m24z11] input=第一条不够准确; cf=conflict_fact_m24z11_a+fact_m24z11_b_ab97b6a4; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z11_a,fact_m24z11_b; dc=2->2; next_cf=conflict_fact_m24z11_a+fact_m24z11_b_ab97b6a4
  PASS  M2.4-R1-FU5 Case Z11: 不够准确 first must stay ambiguous
[m24z12] input=第二条不够准确; cf=conflict_fact_m24z12_a+fact_m24z12_b_d2e731e4; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z12_a,fact_m24z12_b; dc=2->2; next_cf=conflict_fact_m24z12_a+fact_m24z12_b_d2e731e4
  PASS  M2.4-R1-FU5 Case Z12: 不够准确 second must stay ambiguous
[m24z13] input=第一条不算准确; cf=conflict_fact_m24z13_a+fact_m24z13_b_45217470; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z13_a,fact_m24z13_b; dc=2->2; next_cf=conflict_fact_m24z13_a+fact_m24z13_b_45217470
  PASS  M2.4-R1-FU5 Case Z13: 不算准确 first must stay ambiguous
[m24z14] input=第一条准确度不高; cf=conflict_fact_m24z14_a+fact_m24z14_b_30f6181c; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z14_a,fact_m24z14_b; dc=2->2; next_cf=conflict_fact_m24z14_a+fact_m24z14_b_30f6181c
  PASS  M2.4-R1-FU5 Case Z14: 准确度不高 first must stay ambiguous
[m24z15] input=第二条准确性不足; cf=conflict_fact_m24z15_a+fact_m24z15_b_a335a1d6; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z15_a,fact_m24z15_b; dc=2->2; next_cf=conflict_fact_m24z15_a+fact_m24z15_b_a335a1d6
  PASS  M2.4-R1-FU5 Case Z15: 准确性不足 second must stay ambiguous
[m24z16] input=第一条不完全准确; cf=conflict_fact_m24z16_a+fact_m24z16_b_469cd727; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z16_a,fact_m24z16_b; dc=2->2; next_cf=conflict_fact_m24z16_a+fact_m24z16_b_469cd727
  PASS  M2.4-R1-FU5 Case Z16: 不完全准确 first must stay ambiguous
[m24z17] input=第一条不见得准确; cf=conflict_fact_m24z17_a+fact_m24z17_b_7b952880; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z17_a,fact_m24z17_b; dc=2->2; next_cf=conflict_fact_m24z17_a+fact_m24z17_b_7b952880
  PASS  M2.4-R1-FU5 Case Z17: 不见得准确 first must stay ambiguous
[m24z18] input=第一条不符合实际; cf=conflict_fact_m24z18_a+fact_m24z18_b_b5bd98ea; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z18_a,fact_m24z18_b; dc=2->2; next_cf=conflict_fact_m24z18_a+fact_m24z18_b_b5bd98ea
  PASS  M2.4-R1-FU5 Case Z18: 不符合实际 first must stay ambiguous
[m24z19] input=第一条不够准确，但第二条准确; cf=conflict_fact_m24z19_a+fact_m24z19_b_9c4733eb; state=clarified; confirm=true; resolution={"selected_fact_id":"fact_m24z19_b","source_turn_id":"d8c2270c-ccd7-4d7d-a974-dad3e4c239c5","user_statement":"第一条不够准确，但第二条准确"}; selected=fact_m24z19_b; expected=fact_m24z19_b; facts=2; dc=2->3
  PASS  M2.4-R1-FU5 Case Z19: insufficient first and affirmed second selects the second fact
[m24z20] input=第二条不算准确，而是第一条准确; cf=conflict_fact_m24z20_a+fact_m24z20_b_1d0063b4; state=clarified; confirm=true; resolution={"selected_fact_id":"fact_m24z20_a","source_turn_id":"5d79218d-0528-4aab-93f7-b1c8dbd925df","user_statement":"第二条不算准确，而是第一条准确"}; selected=fact_m24z20_a; expected=fact_m24z20_a; facts=2; dc=2->3
  PASS  M2.4-R1-FU5 Case Z20: insufficient second and affirmed first selects the first fact
```

### FU4 Case Z1–Z10 regression

```
[m24z1] input=我不认为第一条准确; cf=conflict_fact_m24z1_a+fact_m24z1_b_5f0b7a54; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z1_a,fact_m24z1_b; dc=2->2; next_cf=conflict_fact_m24z1_a+fact_m24z1_b_5f0b7a54
  PASS  M2.4-R1-FU4 Case Z1: scoped negate first must stay ambiguous
[m24z2] input=我不觉得第二条准确; cf=conflict_fact_m24z2_a+fact_m24z2_b_14b3d823; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z2_a,fact_m24z2_b; dc=2->2; next_cf=conflict_fact_m24z2_a+fact_m24z2_b_14b3d823
  PASS  M2.4-R1-FU4 Case Z2: scoped negate second must stay ambiguous
[m24z3] input=我并不认可第一条是正确的; cf=conflict_fact_m24z3_a+fact_m24z3_b_b1458a6c; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z3_a,fact_m24z3_b; dc=2->2; next_cf=conflict_fact_m24z3_a+fact_m24z3_b_b1458a6c
  PASS  M2.4-R1-FU4 Case Z3: 并不认可 first must stay ambiguous
[m24z4] input=第一条并不准确; cf=conflict_fact_m24z4_a+fact_m24z4_b_ef80cd96; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z4_a,fact_m24z4_b; dc=2->2; next_cf=conflict_fact_m24z4_a+fact_m24z4_b_ef80cd96
  PASS  M2.4-R1-FU4 Case Z4: 并不准确 must stay ambiguous
[m24z5] input=第一条未必准确; cf=conflict_fact_m24z5_a+fact_m24z5_b_01f6514c; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z5_a,fact_m24z5_b; dc=2->2; next_cf=conflict_fact_m24z5_a+fact_m24z5_b_01f6514c
  PASS  M2.4-R1-FU4 Case Z5: 未必准确 must stay ambiguous
[m24z6] input=我不能确认第一条准确; cf=conflict_fact_m24z6_a+fact_m24z6_b_7dee7a81; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z6_a,fact_m24z6_b; dc=2->2; next_cf=conflict_fact_m24z6_a+fact_m24z6_b_7dee7a81
  PASS  M2.4-R1-FU4 Case Z6: cannot confirm first must stay ambiguous
[m24z7] input=不是第一条，而是第二条准确; cf=conflict_fact_m24z7_a+fact_m24z7_b_f6c0d118; state=clarified; confirm=true; resolution={"selected_fact_id":"fact_m24z7_b","source_turn_id":"9c4dd144-7658-4e17-b886-2bed8ed3a2f8","user_statement":"不是第一条，而是第二条准确"}; selected=fact_m24z7_b; expected=fact_m24z7_b; facts=2; dc=2->3
  PASS  M2.4-R1-FU4 Case Z7: contrast affirms the second fact
[m24z8] input=不是第二条，而是第一条准确; cf=conflict_fact_m24z8_a+fact_m24z8_b_85c28ead; state=clarified; confirm=true; resolution={"selected_fact_id":"fact_m24z8_a","source_turn_id":"f81cd2a1-280b-44ce-92a2-4ad6e0945716","user_statement":"不是第二条，而是第一条准确"}; selected=fact_m24z8_a; expected=fact_m24z8_a; facts=2; dc=2->3
  PASS  M2.4-R1-FU4 Case Z8: contrast affirms the first fact
[m24z9] input=第一条准确，但我不认可第一条; cf=conflict_fact_m24z9_a+fact_m24z9_b_c9ee81b3; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z9_a,fact_m24z9_b; dc=2->2; next_cf=conflict_fact_m24z9_a+fact_m24z9_b_c9ee81b3
  PASS  M2.4-R1-FU4 Case Z9: affirm then negate same option stays ambiguous
[m24z10] input=第一条准确，第二条也准确; cf=conflict_fact_m24z10_a+fact_m24z10_b_6be05023; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z10_a,fact_m24z10_b; dc=2->2; next_cf=conflict_fact_m24z10_a+fact_m24z10_b_6be05023
  PASS  M2.4-R1-FU4 Case Z10: affirming both options stays ambiguous
```

### FU2 Case N–T regression

```
[m24n] cf=conflict_fact_m24n_a+fact_m24n_b_b7493bb2; facts=fact_m24n_a,fact_m24n_b; state=clarified; confirm=true; selected=fact_m24n_a; turn=eead8aa3-1d27-47b5-b978-bfefffea6961; dc=2->3; fact_count=2; briefs=0
  PASS  M2.4-R1-FU2 Case N: explicit choice of the first fact
[m24o] cf=conflict_fact_m24o_a+fact_m24o_b_8a67fd2e; selected=fact_m24o_b; expected_second=fact_m24o_b; first=fact_m24o_a; confirm=true; dc=2->3
  PASS  M2.4-R1-FU2 Case O: explicit choice of the second fact
[m24p] cf=conflict_fact_m24p_a+fact_m24p_b_2aa8e5e1; state=open; confirm=false; resolution=null; facts=2; dc=2->2; next_cf=conflict_fact_m24p_a+fact_m24p_b_2aa8e5e1
  PASS  M2.4-R1-FU2 Case P: vague answer must not close Conflict
[m24q] cf=conflict_fact_m24q_a+fact_m24q_b_3907160c; state=open; confirm=false; resolution=null; facts=2; dc=2->2
  PASS  M2.4-R1-FU2 Case Q: both-inaccurate must not auto-select or close
[m24r] turn=644f6177-287b-4e89-ad4a-ce029d23ade0; outcome=not_applied; persist=idempotent_skip; dc=2->3->3; asked=3->3; clarified=1; key_skip=idempotent_skip
  PASS  M2.4-R1-FU2 Case R: replay same source_turn_id is idempotent
[m24s] cf=conflict_fact_m24s_a+fact_m24s_b_522d2c03; state=unresolved_in_final; confirm=false; resolution=null; dc=3->3; target=conflict_fact_m24s_a+fact_m24s_b_522d2c03; persist=stale_conflict_target
  PASS  M2.4-R1-FU2 Case S: stale non-open Conflict is a safe no-op
[m24t] bound=conflict_fact_t_opt_a+fact_t_opt_b_8672f396; other=conflict_fact_t_sq_a+fact_t_sq_b_d12d09a1; chosen=clarified; other_state=open; selected=fact_t_opt_a; dc=2->3; other_facts=fact_t_sq_a,fact_t_sq_b; other_refs=2
  PASS  M2.4-R1-FU2 Case T: other DIR Conflict is untouched
```

### FU3 Case U–Y regression

```
[m24u] input=第一条不准确; cf=conflict_fact_m24u_a+fact_m24u_b_1ff08e38; state=open; confirm=false; resolution=null; selected=none; facts=2; dc=2->2; next_cf=conflict_fact_m24u_a+fact_m24u_b_1ff08e38
  PASS  M2.4-R1-FU3 Case U: negate first fact must not close Conflict
[m24v] input=不是第二条; cf=conflict_fact_m24v_a+fact_m24v_b_b00106db; state=open; confirm=false; resolution=null; selected=none; facts=2; dc=2->2; next_cf=conflict_fact_m24v_a+fact_m24v_b_b00106db
  PASS  M2.4-R1-FU3 Case V: negate second fact must not close Conflict
[m24w] input=不是第一条，而是第二条准确; cf=conflict_fact_m24w_a+fact_m24w_b_6e26effa; state=clarified; confirm=true; selected=fact_m24w_b; expected_second=fact_m24w_b; facts=2; dc=2->3
  PASS  M2.4-R1-FU3 Case W: negate first and affirm second selects the second fact
[m24x] input=第一条准确，但我不认可第一条; cf=conflict_fact_m24x_a+fact_m24x_b_fa4e84d7; state=open; confirm=false; resolution=null; selected=none; facts=2; dc=2->2; next_cf=conflict_fact_m24x_a+fact_m24x_b_fa4e84d7
  PASS  M2.4-R1-FU3 Case X: conflicting affirm and negate must stay ambiguous
[m24y] input=第一条准确; returned_state=open; returned_confirm=false; returned_resolution=null; clarified_leaked=0; dc=2->2; persist_error=persist_failed; m1_outcome=persist_failed; fail_closed=true; durable_state=open; durable_dc=2; facts=2; asked=2->2
  PASS  M2.4-R1-FU3 Case Y: C1 persist failure returns original uncommitted session
```

## Regression commands (exit codes on implementation HEAD d382f2e4)

All of the following were executed on the implementation tree that became `d382f2e48ed03398c6b4c19ea04ecc2ac84cefff` (no further production or test edits after the run; this evidence file is a later, documentation-only commit). Commands were invoked via `C:\Users\13306\AppData\Roaming\npm\pnpm.cmd`.

| Command | Exit | Result |
|---------|------|--------|
| `pnpm test:m1-production-adaptive-question-loop` | 0 | **67/67** (`M1 done. PASS=67 FAIL=0`) |
| `pnpm test:m1-r-fresh-session-main-loop` | 0 | **8/8** (`M1-R done. PASS=8 FAIL=0`) |
| `pnpm test:m2-3-decision-blueprint` | 0 | **18/18** (`M2.3 results: 18 passed, 0 failed`) |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | **19/19** (`M2.1 result: 19 passed, 0 failed`) |
| `pnpm test:m2-2-freeze-report-binding` | 0 | **43/43** (`M2.2 results: 43 passed, 0 failed`) |
| `pnpm test:decision-context-phase2` | 0 | **9** (`phase2: 9 passed`) |
| `pnpm exec next typegen` | 0 | Types generated successfully |
| `pnpm exec tsc --noEmit` | 0 | no errors |
| `pnpm build` | 0 | build completed |

Logs: `temp/out_m24fu6_m1adaptive.txt`, `temp/out_m24fu6_m1r.txt`, `temp/out_m24fu6_m23.txt`, `temp/out_m24fu6_m21.txt`, `temp/out_m24fu6_m22.txt`, `temp/out_m24fu6_phase2.txt`, `temp/out_m24fu6_typegen.txt`, `temp/out_m24fu6_tsc.txt`, `temp/out_m24fu6_build.txt`.

## Delivery constraints observed

- No PR opened.
- No merge to `main`.
- No deploy.
- No Vercel promote.
- No product PASS declared.
- Evidence file does not write a self-referential tip SHA.
- Only the allowed production file, the allowed test file, and this evidence document were committed. `public/sw.js`, `.cursor/plans/*`, and `temp/*` were left unstaged.

## UNTESTED / leftovers

- “两条都不准确” still only keeps the Conflict `open`; there is still no replacement-fact path that formally closes it.
- Parsing remains deterministic heuristics, not semantic NLI; uncovered wording fail-closes.
- Case R still replays `runCollectingDcTurn` with the same `source_turn_id` (M1-12 pattern), not a second `handleUserMessage()`.
- Case Y still uses the official test hook to inject `{ committed: false, error: "persist_failed" }`, not a real IndexedDB transaction abort.
- Family A/B/C plus this accuracy-rate family are construction-level coverage, not an exhaustive natural-language grammar; nearby paraphrases not listed here may still fail-close.
- No Phase 5 Personal Analysis.
- No live non-script LLM session.
