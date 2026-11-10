# M2.4-R1-FU4 — Clause-based Conflict choice parser (negation-scope fix)

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent (baseline / FU3 evidence tip):** `4199e7d2b1619978199cf2fa3eeb38c2d2fb0363`  
**Implementation commit (parser + Cases Z1–Z10):** `7fbbdd9af24d6d01c91e9b27de9ea4c1c1ad2298`  
**Final implementation HEAD (suite ran here):** `7fbbdd9af24d6d01c91e9b27de9ea4c1c1ad2298`  
**Evidence tip SHA:** *(empty / pending Max review — this file must not contain a self-referential tip SHA)*  
**Status:** Implementation + tests + this evidence file committed for independent review. **Does not self-declare product PASS.**

## Goal

Fix the FU3 review defect: `AFFIRM_FIRST_RE` / `AFFIRM_SECOND_RE` were unanchored, so a sentence that contained an affirmative phrase such as `第一条准确` could still be treated as a confirmation even when that phrase was under a scoped negation (`我不认为第一条准确`, `我不能确认第一条准确`, `第一条未必准确`, etc.).

This follow-up rewrites `parseExplicitChoice()` as a conservative, clause-based, option-semantics parser. It does not keep patching by adding a few more negation regexes. It does not rewrite Answer Interpretation, DC, Blueprint, Understanding, Readiness, or Question Planning, and does not expand Phase 5. The only production file changed is `lib/poju/decision-intake/conflict-clarification.ts`.

## Changed files and key functions

### Production

- `lib/poju/decision-intake/conflict-clarification.ts`
  - Rewrote `parseExplicitChoice()` to split contrast clauses first, then analyze first/second option polarity (affirmed / negated / hedged) independently in each fragment.
  - New helpers: `splitContrastFragments()`, `analyzeFragment()`, `mergePolarity()`.
  - Tightened `restatementChoice()`: exact restatement of one complete RealityFact only; no substring-inclusion inference; no treating “准确” inside fact text as the user’s affirmation; negation / hedge / contrast still fail-closed.
  - `resolveConflictChoice()` still calls `parseExplicitChoice()` first. If that result already encodes negation, hedge, conflict, both-selected, both-inaccurate, or unknown negation scope, restatement is not allowed to override it into a selection. Restatement may run only when the parser found no option semantics (`user_choice_not_explicit`).

### Tests

- `scripts/test-m1-production-adaptive-question-loop.ts`
  - Added Cases Z1–Z10 after FU3 U–Y, all through the real `handleUserMessage()` production path and the existing `seedSameDirConflict()` fixture.
  - FU2 Cases N–T and FU3 Cases U–Y remain in the same suite.

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

## Clause-based parsing rules as implemented

`parseExplicitChoice(statement)` compactifies the text (whitespace, punctuation, and symbols removed; Unicode-aware). Bare `1` / `2` (and compact equivalents such as `我选1`) may select only when the entire compact statement is that token.

Otherwise the compact statement is split on contrast markers, longest-first:

- `而是` / `但是` / `不过` / `可是` / `但`

Each fragment is analyzed independently:

1. Mention detection for first/second option forms (`第一条` / `第1条` / `第二条` / `第2条`, including `项`). A bare mention is not a choice.
2. Negation cues (need not be immediately adjacent to the option). Minimum coverage includes: `不认为`, `不觉得`, `不认可`, `不选`, `不准确`, `不对`, `不正确`, `并不`, `并非`, `不是`, `未必`, `没有`, `不能确认`, `无法确认`, `不确定`, `不一定`, plus the prior FU3 forms `错误` / `排除` / `否定` / `是错的` / `错了` / `没选`. A bare `非` is not treated as negation (would false-hit `非常`).
3. Hedge cues include: `可能`, `也许`, `大概`, `好像`, `似乎`, `不一定`, `不好说`, `不清楚`, `都不确定`, `不太确定`, `不确定`, `不太`.
4. If a fragment has negation and mentions only one option, that option is negated, regardless of word order (`我不认为第一条准确` and `第一条并不准确` both negate the first).
5. If a fragment has negation and mentions both options, or has negation with no option mention, the scope is unknown and the whole statement is `ambiguous`.
6. Affirmation keywords (`准确`, `是对的`, `是正确的`, `对的`, `正确`, `为准`, `我选`, `选择`) are considered only after negation/hedge assignment. They cannot override negation or hedge of the same option in the same fragment. `准确` inside `不准确` does not count as affirmation.
7. Both-inaccurate language (`两条都不准确`, `都不准确`, etc.) is `ambiguous`.

Fragment polarities are then merged across the statement:

- The same option affirmed in one fragment and negated in another becomes `conflicting_choice` (e.g. `第一条准确，但我不认可第一条`).
- Any hedge on either option becomes `hedged_choice` (fail-closed).
- Both options independently affirmed becomes `both_selected` (e.g. `第一条准确，第二条也准确`).
- A definite selection is allowed only when exactly one option has independent affirmative evidence and that same option is never negated. Contrast such as `不是第一条，而是第二条准确` therefore selects the second; `不是第二条，而是第一条准确` selects the first.
- `不是第一条，而是第二条也不准确` has no independent affirmation and stays `ambiguous`.
- `第一条不准确，第二条可能准确` is a single fragment after punctuation is stripped, with negation and two options, so the result is `unknown_negation_scope` / `ambiguous`. The parser does not recombine one fragment’s affirmation with another fragment’s negation into a definite choice except for the explicit contrast rule above.

These rules are deterministic heuristics, not semantic NLI. Uncovered wording fail-closes to `ambiguous`.

## Case results (real, against final implementation HEAD 7fbbdd9a)

Recorded from `pnpm test:m1-production-adaptive-question-loop` on the tree that became SHA `7fbbdd9af24d6d01c91e9b27de9ea4c1c1ad2298` (UTF-8 log `temp/out_m24fu4_m1adaptive.txt`). Suite result: **PASS=52 FAIL=0**, exit 0. All cases ran through real `handleUserMessage()` and asserted against the persisted / returned session.

### FU4 Case Z1–Z10 (verbatim logs)

```
[m24z1] input=我不认为第一条准确; cf=conflict_fact_m24z1_a+fact_m24z1_b_2c19aa5e; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z1_a,fact_m24z1_b; dc=2->2; next_cf=conflict_fact_m24z1_a+fact_m24z1_b_2c19aa5e
  PASS  M2.4-R1-FU4 Case Z1: scoped negate first must stay ambiguous
[m24z2] input=我不觉得第二条准确; cf=conflict_fact_m24z2_a+fact_m24z2_b_ab2c5859; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z2_a,fact_m24z2_b; dc=2->2; next_cf=conflict_fact_m24z2_a+fact_m24z2_b_ab2c5859
  PASS  M2.4-R1-FU4 Case Z2: scoped negate second must stay ambiguous
[m24z3] input=我并不认可第一条是正确的; cf=conflict_fact_m24z3_a+fact_m24z3_b_20a2ff5c; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z3_a,fact_m24z3_b; dc=2->2; next_cf=conflict_fact_m24z3_a+fact_m24z3_b_20a2ff5c
  PASS  M2.4-R1-FU4 Case Z3: 并不认可 first must stay ambiguous
[m24z4] input=第一条并不准确; cf=conflict_fact_m24z4_a+fact_m24z4_b_932d94fb; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z4_a,fact_m24z4_b; dc=2->2; next_cf=conflict_fact_m24z4_a+fact_m24z4_b_932d94fb
  PASS  M2.4-R1-FU4 Case Z4: 并不准确 must stay ambiguous
[m24z5] input=第一条未必准确; cf=conflict_fact_m24z5_a+fact_m24z5_b_d1ca1dee; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z5_a,fact_m24z5_b; dc=2->2; next_cf=conflict_fact_m24z5_a+fact_m24z5_b_d1ca1dee
  PASS  M2.4-R1-FU4 Case Z5: 未必准确 must stay ambiguous
[m24z6] input=我不能确认第一条准确; cf=conflict_fact_m24z6_a+fact_m24z6_b_6cc16ebd; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z6_a,fact_m24z6_b; dc=2->2; next_cf=conflict_fact_m24z6_a+fact_m24z6_b_6cc16ebd
  PASS  M2.4-R1-FU4 Case Z6: cannot confirm first must stay ambiguous
[m24z7] input=不是第一条，而是第二条准确; cf=conflict_fact_m24z7_a+fact_m24z7_b_dee996c8; state=clarified; confirm=true; resolution={"selected_fact_id":"fact_m24z7_b","source_turn_id":"881317ae-618b-48e3-9fb9-1150e157c6af","user_statement":"不是第一条，而是第二条准确"}; selected=fact_m24z7_b; expected=fact_m24z7_b; facts=2; dc=2->3
  PASS  M2.4-R1-FU4 Case Z7: contrast affirms the second fact
[m24z8] input=不是第二条，而是第一条准确; cf=conflict_fact_m24z8_a+fact_m24z8_b_1ccc0289; state=clarified; confirm=true; resolution={"selected_fact_id":"fact_m24z8_a","source_turn_id":"0096ec3c-9460-43fd-b735-05e83905c6f5","user_statement":"不是第二条，而是第一条准确"}; selected=fact_m24z8_a; expected=fact_m24z8_a; facts=2; dc=2->3
  PASS  M2.4-R1-FU4 Case Z8: contrast affirms the first fact
[m24z9] input=第一条准确，但我不认可第一条; cf=conflict_fact_m24z9_a+fact_m24z9_b_fe1790fb; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z9_a,fact_m24z9_b; dc=2->2; next_cf=conflict_fact_m24z9_a+fact_m24z9_b_fe1790fb
  PASS  M2.4-R1-FU4 Case Z9: affirm then negate same option stays ambiguous
[m24z10] input=第一条准确，第二条也准确; cf=conflict_fact_m24z10_a+fact_m24z10_b_acbce16c; state=open; confirm=false; resolution=null; selected=none; facts=2; ids=fact_m24z10_a,fact_m24z10_b; dc=2->2; next_cf=conflict_fact_m24z10_a+fact_m24z10_b_acbce16c
  PASS  M2.4-R1-FU4 Case Z10: affirming both options stays ambiguous
```

| Case | Input | Expected | Observed |
|------|-------|----------|----------|
| Z1 | 我不认为第一条准确 | ambiguous | open; confirm=false; resolution=null; selected=none; facts/IDs unchanged; DC 2→2; next question same conflict_id |
| Z2 | 我不觉得第二条准确 | ambiguous | same as Z1 for second option |
| Z3 | 我并不认可第一条是正确的 | ambiguous | same as Z1 |
| Z4 | 第一条并不准确 | ambiguous | same as Z1 |
| Z5 | 第一条未必准确 | ambiguous | same as Z1 |
| Z6 | 我不能确认第一条准确 | ambiguous | same as Z1 |
| Z7 | 不是第一条，而是第二条准确 | select second | clarified; confirm=true; selected=fact_m24z7_b; facts=2; DC 2→3 once |
| Z8 | 不是第二条，而是第一条准确 | select first | clarified; confirm=true; selected=fact_m24z8_a; facts=2; DC 2→3 once |
| Z9 | 第一条准确，但我不认可第一条 | ambiguous | open; DC 2→2; next question same conflict_id |
| Z10 | 第一条准确，第二条也准确 | ambiguous | open; DC 2→2; next question same conflict_id |

### FU2 Case N–T regression

```
[m24n] cf=conflict_fact_m24n_a+fact_m24n_b_66b41953; facts=fact_m24n_a,fact_m24n_b; state=clarified; confirm=true; selected=fact_m24n_a; turn=faf266af-e6fb-47a1-9dd2-794d408ed378; dc=2->3; fact_count=2; briefs=0
  PASS  M2.4-R1-FU2 Case N: explicit choice of the first fact
[m24o] cf=conflict_fact_m24o_a+fact_m24o_b_dc55a52c; selected=fact_m24o_b; expected_second=fact_m24o_b; first=fact_m24o_a; confirm=true; dc=2->3
  PASS  M2.4-R1-FU2 Case O: explicit choice of the second fact
[m24p] cf=conflict_fact_m24p_a+fact_m24p_b_0566a94a; state=open; confirm=false; resolution=null; facts=2; dc=2->2; next_cf=conflict_fact_m24p_a+fact_m24p_b_0566a94a
  PASS  M2.4-R1-FU2 Case P: vague answer must not close Conflict
[m24q] cf=conflict_fact_m24q_a+fact_m24q_b_5e70bdc0; state=open; confirm=false; resolution=null; facts=2; dc=2->2
  PASS  M2.4-R1-FU2 Case Q: both-inaccurate must not auto-select or close
[m24r] turn=e1bfdf02-c5ce-478d-9446-90e3bb276306; outcome=not_applied; persist=idempotent_skip; dc=2->3->3; asked=3->3; clarified=1; key_skip=idempotent_skip
  PASS  M2.4-R1-FU2 Case R: replay same source_turn_id is idempotent
[m24s] cf=conflict_fact_m24s_a+fact_m24s_b_bc98722a; state=unresolved_in_final; confirm=false; resolution=null; dc=3->3; target=conflict_fact_m24s_a+fact_m24s_b_bc98722a; persist=stale_conflict_target
  PASS  M2.4-R1-FU2 Case S: stale non-open Conflict is a safe no-op
[m24t] bound=conflict_fact_t_opt_a+fact_t_opt_b_1b1c94eb; other=conflict_fact_t_sq_a+fact_t_sq_b_8e200584; chosen=clarified; other_state=open; selected=fact_t_opt_a; dc=2->3; other_facts=fact_t_sq_a,fact_t_sq_b; other_refs=2
  PASS  M2.4-R1-FU2 Case T: other DIR Conflict is untouched
```

### FU3 Case U–Y regression

```
[m24u] input=第一条不准确; cf=conflict_fact_m24u_a+fact_m24u_b_6fc59c68; state=open; confirm=false; resolution=null; selected=none; facts=2; dc=2->2; next_cf=conflict_fact_m24u_a+fact_m24u_b_6fc59c68
  PASS  M2.4-R1-FU3 Case U: negate first fact must not close Conflict
[m24v] input=不是第二条; cf=conflict_fact_m24v_a+fact_m24v_b_19957082; state=open; confirm=false; resolution=null; selected=none; facts=2; dc=2->2; next_cf=conflict_fact_m24v_a+fact_m24v_b_19957082
  PASS  M2.4-R1-FU3 Case V: negate second fact must not close Conflict
[m24w] input=不是第一条，而是第二条准确; cf=conflict_fact_m24w_a+fact_m24w_b_07e2d0cb; state=clarified; confirm=true; selected=fact_m24w_b; expected_second=fact_m24w_b; facts=2; dc=2->3
  PASS  M2.4-R1-FU3 Case W: negate first and affirm second selects the second fact
[m24x] input=第一条准确，但我不认可第一条; cf=conflict_fact_m24x_a+fact_m24x_b_1ecc2eb7; state=open; confirm=false; resolution=null; selected=none; facts=2; dc=2->2; next_cf=conflict_fact_m24x_a+fact_m24x_b_1ecc2eb7
  PASS  M2.4-R1-FU3 Case X: conflicting affirm and negate must stay ambiguous
[m24y] input=第一条准确; returned_state=open; returned_confirm=false; returned_resolution=null; clarified_leaked=0; dc=2->2; persist_error=persist_failed; m1_outcome=persist_failed; fail_closed=true; durable_state=open; durable_dc=2; facts=2; asked=2->2
  PASS  M2.4-R1-FU3 Case Y: C1 persist failure returns original uncommitted session
```

## Regression commands (exit codes on implementation HEAD 7fbbdd9a)

All of the following were executed on the implementation tree that became `7fbbdd9af24d6d01c91e9b27de9ea4c1c1ad2298` (no further production or test edits after the run).

| Command | Exit | Result |
|---------|------|--------|
| `pnpm test:m1-production-adaptive-question-loop` | 0 | **52/52** (`M1 done. PASS=52 FAIL=0`) |
| `pnpm test:m1-r-fresh-session-main-loop` | 0 | **8/8** (`M1-R done. PASS=8 FAIL=0`) |
| `pnpm test:m2-3-decision-blueprint` | 0 | **18/18** (`M2.3 results: 18 passed, 0 failed`) |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | **19/19** (`M2.1 result: 19 passed, 0 failed`) |
| `pnpm test:m2-2-freeze-report-binding` | 0 | **43/43** (`M2.2 results: 43 passed, 0 failed`) |
| `pnpm test:decision-context-phase2` | 0 | **9** (`phase2: 9 passed`) |
| `pnpm exec next typegen` | 0 | Types generated successfully |
| `pnpm exec tsc --noEmit` | 0 | no errors |
| `pnpm build` | 0 | build completed |

Logs: `temp/out_m24fu4_m1adaptive.txt`, `temp/out_m24fu4_m1r.txt`, `temp/out_m24fu4_m23.txt`, `temp/out_m24fu4_m21.txt`, `temp/out_m24fu4_m22.txt`, `temp/out_m24fu4_phase2.txt`, `temp/out_m24fu4_typegen.txt`, `temp/out_m24fu4_tsc.txt`, `temp/out_m24fu4_build.txt`.

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
- No Phase 5 Personal Analysis.
- No live non-script LLM session.
