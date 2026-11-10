# M2.4-R1-FU5 — Conflict Choice Accuracy-Negation Boundary Repair

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent (baseline / FU4 evidence tip):** `0114d38a689f6b60321d01423f0c5c494f76407d`  
**Implementation commit (parser + Cases Z11–Z20):** `b9822ffce0c9afbeb3ce11a9eaa86a0e64665c43`  
**Final implementation HEAD (suite ran here):** `b9822ffce0c9afbeb3ce11a9eaa86a0e64665c43`  
**Evidence tip SHA:** *(empty / pending Max review — this file must not contain a self-referential tip SHA)*  
**Status:** Implementation + tests + this evidence file committed for independent review. **Does not self-declare product PASS.**

## Goal

Fix the FU4 review defect: `analyzeFragment()` and `AFFIRM_KW_RE` could still treat the word `准确` as affirmative evidence inside insufficient-accuracy or negatively qualified constructions, including:

- 第一条不够准确
- 第一条不算准确
- 第一条准确度不高
- 第一条准确性不高

This follow-up repairs polarity detection so negative or insufficient-accuracy constructions are recognized before any affirmative assignment. It does not keep patching by blindly adding isolated affirmative/negative keywords without scope. It does not rewrite Answer Interpretation, DC, Blueprint, Understanding, Readiness, Question Planning, or the C1 persistence lifecycle, and does not expand Phase 5. The only production file changed is `lib/poju/decision-intake/conflict-clarification.ts`.

## Changed files and key functions

### Production

- `lib/poju/decision-intake/conflict-clarification.ts`
  - Repaired `analyzeFragment()` to detect insufficient accuracy, uncertain accuracy, and explicit rejection **before** assigning affirmative polarity.
  - Added construction-level recognizers:
    - `INSUFFICIENT_ACCURACY_RE` (Family A)
    - `UNCERTAIN_ACCURACY_RE` (Family B)
    - `EXPLICIT_REJECTION_RE` (Family C)
  - Tightened `AFFIRM_KW_RE` so `准确度` / `准确性` / `准确程度` noun forms are not treated as affirmation, and so `准确` / `正确` inside `不准确` / `不正确` still do not count.
  - After detecting insufficiency or uncertainty, those constructions are stripped from the fragment residual before any leftover `准确` / `正确` is considered affirmative.
  - A negative or hedged reading bound to an option cannot be overridden by the presence of `准确` or `正确` in the same fragment.
  - Rejecting the first option does not infer confirmation of the second, and vice versa. A definite contrast selection still requires independent affirmative evidence for exactly one option that is never negated.
  - Tightened `restatementChoice()` so insufficient-accuracy, uncertain-accuracy, and explicit-rejection constructions also fail-closed. Restatement still cannot override a detected negation, hedge, contradiction, or uncertain scope from `parseExplicitChoice()`.
  - Standalone `1` / `2` behavior is unchanged.
  - `resolveConflictChoice()` still calls `parseExplicitChoice()` first; `Conflict.state = "clarified"` is never assigned directly; `clarifyConflict()` and the C1 persist path are unchanged.

### Tests

- `scripts/test-m1-production-adaptive-question-loop.ts`
  - Added Cases Z11–Z20 after FU4 Z1–Z10, all through the real `handleUserMessage()` production path and the existing `seedSameDirConflict()` / `answerSeededConflict()` fixture.
  - FU2 Cases N–T, FU3 Cases U–Y, and FU4 Cases Z1–Z10 remain in the same suite.

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

## Accuracy-insufficiency and negation polarity rules as implemented

`parseExplicitChoice(statement)` still compactifies the text and splits contrast clauses first (`而是` / `但是` / `不过` / `可是` / `但`). Bare `1` / `2` may select only when the entire compact statement is that token.

Each fragment is analyzed in this order:

1. Option mention detection for first/second forms (`第一条` / `第1条` / `第二条` / `第2条`, including `项`). A bare mention is not a choice.
2. **Insufficient-accuracy constructions (Family A)** are detected as units, not as a lone `准确` keyword:
   - 不够准确 / 不够正确
   - 不算准确 / 不算正确
   - 不太准确 / 不怎么准确 / 不完全准确
   - 谈不上准确 / 称不上准确
   - 准确度不高 / 准确性不高
   - 准确度不足 / 准确性不足
   - 准确程度有限
   An optional option mention may sit between the qualifier and `准确` / `正确`. These mark the mentioned option as **negated**.
3. **Uncertain-accuracy constructions (Family B)** mark the mentioned option as **hedged**:
   - 不见得准确 / 未必准确 / 不一定准确
   - 不能确定准确 / 无法确认准确 / 不敢确认准确
   - 不好判断是否准确
   An option mention may sit between the hedge and `准确` / `正确`.
4. **Explicit rejection (Family C)** marks the mentioned option as **negated**:
   - 不认可 / 不接受
   - 不成立 / 不符合实际 / 不是事实
   - 有误 / 存在错误
5. Prior FU4 negation and hedge cues remain in force (`不认为`, `不觉得`, `不能确认`, `未必`, etc.).
6. If a negative or insufficient-accuracy construction is present and mentions only one option, that option is negated. If it mentions both options, or mentions no option, the result is `unknown_negation_scope` / `ambiguous`. The parser does not infer that rejecting one option confirms the other.
7. Insufficient / uncertain constructions are then stripped from the fragment. Only residual text may supply affirmative evidence (`准确`, `是对的`, `是正确的`, `对的`, `正确`, `为准`, `我选`, `选择`). Affirmation cannot override negation or hedge of the same option in the same fragment.
8. Cross-fragment merge is unchanged:
   - same option affirmed and negated → `conflicting_choice` (e.g. `第一条准确，但我不认可第一条`)
   - any hedge → `hedged_choice`
   - both options independently affirmed → `both_selected` (e.g. `第一条准确，第二条也准确`)
   - a definite selection requires exactly one option with independent affirmative evidence that is never negated
   - therefore `不是第一条，而是第二条准确` still selects the second, and `不是第二条，而是第一条准确` still selects the first
   - `第一条不够准确，但第二条准确` selects the second only because the second fragment independently affirms the second option after the first is rejected
   - `第二条不算准确，而是第一条准确` selects the first only because the second fragment independently affirms the first option

These rules are deterministic heuristics, not semantic NLI. Uncovered wording fail-closes to `ambiguous`.

## Case results (real, against final implementation HEAD b9822ffc)

Recorded from `pnpm test:m1-production-adaptive-question-loop` on the tree that became SHA `b9822ffce0c9afbeb3ce11a9eaa86a0e64665c43` (UTF-8 log `temp/out_m24fu5_m1adaptive.txt`). Suite result: **PASS=62 FAIL=0**, exit 0. All cases ran through real `handleUserMessage()` and asserted against the persisted / returned session.

### FU5 Case Z11–Z20 (verbatim logs)

```
[m24z11] input=第一条不够准确; cf=conflict_fact_m24z11_a+fact_m24z11_b_f9aca140; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z11_a,fact_m24z11_b; dc=2->2; next_cf=conflict_fact_m24z11_a+fact_m24z11_b_f9aca140
  PASS  M2.4-R1-FU5 Case Z11: 不够准确 first must stay ambiguous
[m24z12] input=第二条不够准确; cf=conflict_fact_m24z12_a+fact_m24z12_b_d747a9e4; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z12_a,fact_m24z12_b; dc=2->2; next_cf=conflict_fact_m24z12_a+fact_m24z12_b_d747a9e4
  PASS  M2.4-R1-FU5 Case Z12: 不够准确 second must stay ambiguous
[m24z13] input=第一条不算准确; cf=conflict_fact_m24z13_a+fact_m24z13_b_1b1c0ce7; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z13_a,fact_m24z13_b; dc=2->2; next_cf=conflict_fact_m24z13_a+fact_m24z13_b_1b1c0ce7
  PASS  M2.4-R1-FU5 Case Z13: 不算准确 first must stay ambiguous
[m24z14] input=第一条准确度不高; cf=conflict_fact_m24z14_a+fact_m24z14_b_a4e027c5; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z14_a,fact_m24z14_b; dc=2->2; next_cf=conflict_fact_m24z14_a+fact_m24z14_b_a4e027c5
  PASS  M2.4-R1-FU5 Case Z14: 准确度不高 first must stay ambiguous
[m24z15] input=第二条准确性不足; cf=conflict_fact_m24z15_a+fact_m24z15_b_2eb12aaa; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z15_a,fact_m24z15_b; dc=2->2; next_cf=conflict_fact_m24z15_a+fact_m24z15_b_2eb12aaa
  PASS  M2.4-R1-FU5 Case Z15: 准确性不足 second must stay ambiguous
[m24z16] input=第一条不完全准确; cf=conflict_fact_m24z16_a+fact_m24z16_b_74adeef3; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z16_a,fact_m24z16_b; dc=2->2; next_cf=conflict_fact_m24z16_a+fact_m24z16_b_74adeef3
  PASS  M2.4-R1-FU5 Case Z16: 不完全准确 first must stay ambiguous
[m24z17] input=第一条不见得准确; cf=conflict_fact_m24z17_a+fact_m24z17_b_045139be; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z17_a,fact_m24z17_b; dc=2->2; next_cf=conflict_fact_m24z17_a+fact_m24z17_b_045139be
  PASS  M2.4-R1-FU5 Case Z17: 不见得准确 first must stay ambiguous
[m24z18] input=第一条不符合实际; cf=conflict_fact_m24z18_a+fact_m24z18_b_8e710ab3; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z18_a,fact_m24z18_b; dc=2->2; next_cf=conflict_fact_m24z18_a+fact_m24z18_b_8e710ab3
  PASS  M2.4-R1-FU5 Case Z18: 不符合实际 first must stay ambiguous
[m24z19] input=第一条不够准确，但第二条准确; cf=conflict_fact_m24z19_a+fact_m24z19_b_504ed8e0; state=clarified; confirm=true; resolution={"selected_fact_id":"fact_m24z19_b","source_turn_id":"8d573587-a0cb-4074-ba77-4a5e91eafa52","user_statement":"第一条不够准确，但第二条准确"}; selected=fact_m24z19_b; expected=fact_m24z19_b; facts=2; dc=2->3
  PASS  M2.4-R1-FU5 Case Z19: insufficient first and affirmed second selects the second fact
[m24z20] input=第二条不算准确，而是第一条准确; cf=conflict_fact_m24z20_a+fact_m24z20_b_55eae2ff; state=clarified; confirm=true; resolution={"selected_fact_id":"fact_m24z20_a","source_turn_id":"107a7b2f-6349-4e2f-97de-c0af7fef813f","user_statement":"第二条不算准确，而是第一条准确"}; selected=fact_m24z20_a; expected=fact_m24z20_a; facts=2; dc=2->3
  PASS  M2.4-R1-FU5 Case Z20: insufficient second and affirmed first selects the first fact
```

| Case | Input | Expected | Observed |
|------|-------|----------|----------|
| Z11 | 第一条不够准确 | ambiguous | open; confirm=false; resolution=null; selected=none; facts/IDs unchanged; DC 2→2; next question same conflict_id |
| Z12 | 第二条不够准确 | ambiguous | same as Z11 for second option |
| Z13 | 第一条不算准确 | ambiguous | same as Z11 |
| Z14 | 第一条准确度不高 | ambiguous | same as Z11 |
| Z15 | 第二条准确性不足 | ambiguous | same as Z11 for second option |
| Z16 | 第一条不完全准确 | ambiguous | same as Z11 |
| Z17 | 第一条不见得准确 | ambiguous | same as Z11 |
| Z18 | 第一条不符合实际 | ambiguous | same as Z11 |
| Z19 | 第一条不够准确，但第二条准确 | select second if independently affirmed | clarified; confirm=true; selected=fact_m24z19_b; facts=2; DC 2→3 once. Parser independently established first rejected and second affirmed; did not fail-closed. |
| Z20 | 第二条不算准确，而是第一条准确 | select first if independently affirmed | clarified; confirm=true; selected=fact_m24z20_a; facts=2; DC 2→3 once. Parser independently established second rejected and first affirmed; did not fail-closed. |

Z19 and Z20 did not incorrectly close to the rejected option.

### FU4 Case Z1–Z10 regression

```
[m24z1] input=我不认为第一条准确; cf=conflict_fact_m24z1_a+fact_m24z1_b_d89e69b9; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z1_a,fact_m24z1_b; dc=2->2; next_cf=conflict_fact_m24z1_a+fact_m24z1_b_d89e69b9
  PASS  M2.4-R1-FU4 Case Z1: scoped negate first must stay ambiguous
[m24z2] input=我不觉得第二条准确; cf=conflict_fact_m24z2_a+fact_m24z2_b_04c667f6; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z2_a,fact_m24z2_b; dc=2->2; next_cf=conflict_fact_m24z2_a+fact_m24z2_b_04c667f6
  PASS  M2.4-R1-FU4 Case Z2: scoped negate second must stay ambiguous
[m24z3] input=我并不认可第一条是正确的; cf=conflict_fact_m24z3_a+fact_m24z3_b_1e8ba102; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z3_a,fact_m24z3_b; dc=2->2; next_cf=conflict_fact_m24z3_a+fact_m24z3_b_1e8ba102
  PASS  M2.4-R1-FU4 Case Z3: 并不认可 first must stay ambiguous
[m24z4] input=第一条并不准确; cf=conflict_fact_m24z4_a+fact_m24z4_b_a3e915ec; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z4_a,fact_m24z4_b; dc=2->2; next_cf=conflict_fact_m24z4_a+fact_m24z4_b_a3e915ec
  PASS  M2.4-R1-FU4 Case Z4: 并不准确 must stay ambiguous
[m24z5] input=第一条未必准确; cf=conflict_fact_m24z5_a+fact_m24z5_b_d83d9921; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z5_a,fact_m24z5_b; dc=2->2; next_cf=conflict_fact_m24z5_a+fact_m24z5_b_d83d9921
  PASS  M2.4-R1-FU4 Case Z5: 未必准确 must stay ambiguous
[m24z6] input=我不能确认第一条准确; cf=conflict_fact_m24z6_a+fact_m24z6_b_f6a12818; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z6_a,fact_m24z6_b; dc=2->2; next_cf=conflict_fact_m24z6_a+fact_m24z6_b_f6a12818
  PASS  M2.4-R1-FU4 Case Z6: cannot confirm first must stay ambiguous
[m24z7] input=不是第一条，而是第二条准确; cf=conflict_fact_m24z7_a+fact_m24z7_b_5bb92936; state=clarified; confirm=true; resolution={"selected_fact_id":"fact_m24z7_b","source_turn_id":"5ee46f96-e197-4e78-a8e5-68659ba3e9bc","user_statement":"不是第一条，而是第二条准确"}; selected=fact_m24z7_b; expected=fact_m24z7_b; facts=2; dc=2->3
  PASS  M2.4-R1-FU4 Case Z7: contrast affirms the second fact
[m24z8] input=不是第二条，而是第一条准确; cf=conflict_fact_m24z8_a+fact_m24z8_b_ebf1fa78; state=clarified; confirm=true; resolution={"selected_fact_id":"fact_m24z8_a","source_turn_id":"d19fa93e-72f5-4870-9eab-c437f076cf04","user_statement":"不是第二条，而是第一条准确"}; selected=fact_m24z8_a; expected=fact_m24z8_a; facts=2; dc=2->3
  PASS  M2.4-R1-FU4 Case Z8: contrast affirms the first fact
[m24z9] input=第一条准确，但我不认可第一条; cf=conflict_fact_m24z9_a+fact_m24z9_b_e9a0be20; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z9_a,fact_m24z9_b; dc=2->2; next_cf=conflict_fact_m24z9_a+fact_m24z9_b_e9a0be20
  PASS  M2.4-R1-FU4 Case Z9: affirm then negate same option stays ambiguous
[m24z10] input=第一条准确，第二条也准确; cf=conflict_fact_m24z10_a+fact_m24z10_b_69041553; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z10_a,fact_m24z10_b; dc=2->2; next_cf=conflict_fact_m24z10_a+fact_m24z10_b_69041553
  PASS  M2.4-R1-FU4 Case Z10: affirming both options stays ambiguous
```

### FU2 Case N–T regression

```
[m24n] cf=conflict_fact_m24n_a+fact_m24n_b_90e8c11e; facts=fact_m24n_a,fact_m24n_b; state=clarified; confirm=true; selected=fact_m24n_a; turn=21a760de-dbb7-420a-bf3c-a4827f971ffe; dc=2->3; fact_count=2; briefs=0
  PASS  M2.4-R1-FU2 Case N: explicit choice of the first fact
[m24o] cf=conflict_fact_m24o_a+fact_m24o_b_a13d57f6; selected=fact_m24o_b; expected_second=fact_m24o_b; first=fact_m24o_a; confirm=true; dc=2->3
  PASS  M2.4-R1-FU2 Case O: explicit choice of the second fact
[m24p] cf=conflict_fact_m24p_a+fact_m24p_b_8117143f; state=open; confirm=false; resolution=null; facts=2; dc=2->2; next_cf=conflict_fact_m24p_a+fact_m24p_b_8117143f
  PASS  M2.4-R1-FU2 Case P: vague answer must not close Conflict
[m24q] cf=conflict_fact_m24q_a+fact_m24q_b_97d56154; state=open; confirm=false; resolution=null; facts=2; dc=2->2
  PASS  M2.4-R1-FU2 Case Q: both-inaccurate must not auto-select or close
[m24r] turn=1268eb5f-046c-44ef-99cd-2cb9dd575b77; outcome=not_applied; persist=idempotent_skip; dc=2->3->3; asked=3->3; clarified=1; key_skip=idempotent_skip
  PASS  M2.4-R1-FU2 Case R: replay same source_turn_id is idempotent
[m24s] cf=conflict_fact_m24s_a+fact_m24s_b_eee70eac; state=unresolved_in_final; confirm=false; resolution=null; dc=3->3; target=conflict_fact_m24s_a+fact_m24s_b_eee70eac; persist=stale_conflict_target
  PASS  M2.4-R1-FU2 Case S: stale non-open Conflict is a safe no-op
[m24t] bound=conflict_fact_t_opt_a+fact_t_opt_b_321de8e0; other=conflict_fact_t_sq_a+fact_t_sq_b_c70bb567; chosen=clarified; other_state=open; selected=fact_t_opt_a; dc=2->3; other_facts=fact_t_sq_a,fact_t_sq_b; other_refs=2
  PASS  M2.4-R1-FU2 Case T: other DIR Conflict is untouched
```

### FU3 Case U–Y regression

```
[m24u] input=第一条不准确; cf=conflict_fact_m24u_a+fact_m24u_b_423a148b; state=open; confirm=false; resolution=null; selected=none; facts=2; dc=2->2; next_cf=conflict_fact_m24u_a+fact_m24u_b_423a148b
  PASS  M2.4-R1-FU3 Case U: negate first fact must not close Conflict
[m24v] input=不是第二条; cf=conflict_fact_m24v_a+fact_m24v_b_f8fd9702; state=open; confirm=false; resolution=null; selected=none; facts=2; dc=2->2; next_cf=conflict_fact_m24v_a+fact_m24v_b_f8fd9702
  PASS  M2.4-R1-FU3 Case V: negate second fact must not close Conflict
[m24w] input=不是第一条，而是第二条准确; cf=conflict_fact_m24w_a+fact_m24w_b_c8e74e2b; state=clarified; confirm=true; selected=fact_m24w_b; expected_second=fact_m24w_b; facts=2; dc=2->3
  PASS  M2.4-R1-FU3 Case W: negate first and affirm second selects the second fact
[m24x] input=第一条准确，但我不认可第一条; cf=conflict_fact_m24x_a+fact_m24x_b_12c3b3e5; state=open; confirm=false; resolution=null; selected=none; facts=2; dc=2->2; next_cf=conflict_fact_m24x_a+fact_m24x_b_12c3b3e5
  PASS  M2.4-R1-FU3 Case X: conflicting affirm and negate must stay ambiguous
[m24y] input=第一条准确; returned_state=open; returned_confirm=false; returned_resolution=null; clarified_leaked=0; dc=2->2; persist_error=persist_failed; m1_outcome=persist_failed; fail_closed=true; durable_state=open; durable_dc=2; facts=2; asked=2->2
  PASS  M2.4-R1-FU3 Case Y: C1 persist failure returns original uncommitted session
```

## Regression commands (exit codes on implementation HEAD b9822ffc)

All of the following were executed on the implementation tree that became `b9822ffce0c9afbeb3ce11a9eaa86a0e64665c43` (no further production or test edits after the run; this evidence file is a later, documentation-only commit).

| Command | Exit | Result |
|---------|------|--------|
| `pnpm test:m1-production-adaptive-question-loop` | 0 | **62/62** (`M1 done. PASS=62 FAIL=0`) |
| `pnpm test:m1-r-fresh-session-main-loop` | 0 | **8/8** (`M1-R done. PASS=8 FAIL=0`) |
| `pnpm test:m2-3-decision-blueprint` | 0 | **18/18** (`M2.3 results: 18 passed, 0 failed`) |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | **19/19** (`M2.1 result: 19 passed, 0 failed`) |
| `pnpm test:m2-2-freeze-report-binding` | 0 | **43/43** (`M2.2 results: 43 passed, 0 failed`) |
| `pnpm test:decision-context-phase2` | 0 | **9** (`phase2: 9 passed`) |
| `pnpm exec next typegen` | 0 | Types generated successfully |
| `pnpm exec tsc --noEmit` | 0 | no errors |
| `pnpm build` | 0 | build completed |

Logs: `temp/out_m24fu5_m1adaptive.txt`, `temp/out_m24fu5_m1r.txt`, `temp/out_m24fu5_m23.txt`, `temp/out_m24fu5_m21.txt`, `temp/out_m24fu5_m22.txt`, `temp/out_m24fu5_phase2.txt`, `temp/out_m24fu5_typegen.txt`, `temp/out_m24fu5_tsc.txt`, `temp/out_m24fu5_build.txt`.

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
- Parsing remains deterministic rules, not semantic NLI; uncovered wording fail-closes.
- Case R still replays `runCollectingDcTurn` with the same `source_turn_id` (M1-12 pattern), not a second `handleUserMessage()`.
- Case Y still uses the official test hook to inject `{ committed: false, error: "persist_failed" }`, not a real IndexedDB transaction abort.
- Family A/B/C coverage is construction-based and scoped, but it is not an exhaustive natural-language grammar; nearby paraphrases not listed here may still fail-close.
- No Phase 5 Personal Analysis.
- No live non-script LLM session.
