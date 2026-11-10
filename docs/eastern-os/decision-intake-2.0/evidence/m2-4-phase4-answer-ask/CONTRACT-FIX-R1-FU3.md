# M2.4-R1-FU3 — Negation-safe Conflict choice parsing and C1 persist-failure rollback

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent (baseline / FU2 evidence tip):** `a76c6a3181d3ccdcd3f13e5e2e258cd733a89f0c`  
**Implementation commit (parser + hook + Cases U–Y):** `4468347e58f55151ecad2cc47871534b86c937b5`  
**Final implementation HEAD (suite ran here):** `4468347e58f55151ecad2cc47871534b86c937b5`  
**Evidence tip SHA:** *(empty / pending Max review — this file must not contain a self-referential tip SHA)*  
**Status:** Implementation + tests + this evidence file committed for independent review. **Does not self-declare product PASS.**

## Goal

Fix the FU2 review defect in `resolveConflictChoice()`: mentioning “第一条” / “第二条” is not enough to treat the answer as a confirmation. Negated, vague, or self-contradictory wording must stay `ambiguous` and must not call `clarifyConflict()`. Only an explicit affirmative choice may formally close a Conflict.

Also prove, on the real `handleUserMessage()` path, that a Conflict-clarification C1 persist failure returns the original uncommitted session and does not leak an in-memory `clarified` state.

This follow-up does not rewrite Answer Interpretation, does not expand Phase 5, and does not change Blueprint / DIR / DDR or other Q&A flows beyond the specified parser, restatement tightening, and the test-only persist hook needed for Case Y.

## Changed files and key functions

### Production

- `lib/poju/decision-intake/conflict-clarification.ts`
  - New `ExplicitChoice` type and `parseExplicitChoice()`.
  - `resolveConflictChoice()` now calls `parseExplicitChoice()` first, then a tightened `restatementChoice()`.
  - A bare ordinal mention is no longer a selection.
- `lib/poju/decision-intake/adaptive-turn.ts`
  - `AdaptiveTurnTestHooks` gains optional `conflictClarifyPersist`.
  - `runAdaptiveQuestionTurn()` passes it to `handleConflictClarificationAnswer` as `persistOverride`.
  - Production callers omit the hook, so the official `persistDcLifecycleChange` path is unchanged.
- `lib/poju/decision-intake/conflict-clarification-turn.ts`
  - Optional `persistOverride` on `handleConflictClarificationAnswer`.
  - C1 commit uses `input.persistOverride ?? persistDcLifecycleChange`.
  - Official lifecycle is unchanged: only an explicit `selected` result calls `clarifyConflict()`; persist failure still returns `input.original` with `outcome: "dc_persist_failed"`.

Hook threading (same official path as prior FUs):

```
handleUserMessage.__testOnlyM1Hooks
  → runM1ProductionPreLlmTurn(test_hooks)
  → runCollectingDcTurn(test_hooks)
  → runAdaptiveQuestionTurn(test_hooks)
  → handleConflictClarificationAnswer({ persistOverride: test_hooks?.conflictClarifyPersist })
```

The hook cannot enable itself in production: it exists only on the test-only input field and defaults to the official persist function when omitted.

### Tests

- `scripts/test-m1-production-adaptive-question-loop.ts` — Cases U–Y added after N–T, all through real `handleUserMessage()` (Case Y injects C1 failure only via `__testOnlyM1Hooks.conflictClarifyPersist`). FU2 Cases N–T are still executed in the same suite.

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

## Negation / affirmative parsing rules as implemented

`parseExplicitChoice(statement)` compactifies the text (whitespace, punctuation, and symbols removed; Unicode-aware) and then applies this mandatory order:

1. Empty or hedge / both-inaccurate language (`可能`, `不太确定`, `不确定`, `两条都不准确`, `都不准确`, `unknown`, `declined`, etc.) → `ambiguous`.
2. Detect negation and affirmation of first and second independently:
   - Negation (minimum coverage, also `第1条` / `第2条` / `项` / `是错的` / `错了`):
     - `(?:不是|不选|不认可|不准确|不对|错误|排除|否定)(?:第)?(?:一|1)(?:条|项)`
     - `第(?:一|1)(?:条|项)(?:不准确|不对|错误|不认可|不选|是错的|错了|不是)`
     - and the corresponding second-fact forms.
   - Affirmation (examples): `第一条准确`, `第一条是对的`, `我选第一条`, `选择第一条`, `以第一条为准`, and the second-fact forms.
3. Affirm and negate the same option, or affirm both options → `ambiguous` (Case X).
4. Contrast with a clear remaining affirmation is allowed:
   - `不是第一条，而是第二条准确` → select index 1 only if second is affirmed and first is not also affirmed / second is not also negated (Case W).
   - The symmetric “negate second, affirm first” contrast is also allowed.
5. Any remaining negation without a clean contrast affirmation → `ambiguous` (Cases U, V, and “我不选第一条”).
6. Otherwise a lone explicit affirmative pattern selects that index.
7. Bare `1` / `2` (and compact equivalents such as `我选1`) may select only when the entire compact statement is that token and no hedge/negation/conflict was already detected.

Restatement matching is used only if `parseExplicitChoice` is already `ambiguous`:

- Negation, contrast (`但` / `但是` / `而是` / `不过` / `可是`), or hedges in the restatement → `ambiguous`.
- The full compact fact statement of exactly one fact must appear.
- After stripping a small affirmative wrapper (`我觉得` / `我选` / `准确` / `是对的` / `为准`, etc.), the remainder must equal that fact’s compact statement exactly.
- `hay.includes(needle)` is not used. Multi-fact content → `ambiguous`. Uncertain → fail-closed.

These rules are deterministic heuristics, not semantic NLI.

## Case results (real, against final implementation HEAD `4468347e`)

Recorded from `pnpm test:m1-production-adaptive-question-loop` on SHA `4468347e58f55151ecad2cc47871534b86c937b5` (UTF-8 log `temp/out_m24fu3_final_m1adaptive.txt`). Suite result: **PASS=42 FAIL=0**, exit 0.

### FU2 Case N–T regression

| Case | Input / action | Result | DC version | Conflict state | user_confirmation | resolution / selected | Facts / notes |
|------|----------------|--------|------------|----------------|-------------------|-----------------------|---------------|
| N first fact | `第一条准确` | PASS | 2→3 | `clarified` | `true` | `selected=fact_m24n_a` | both retained (`fact_count=2`); Understanding `briefs=0` |
| O second fact | `第二条准确` | PASS | 2→3 | `clarified` | `true` | `selected=fact_m24o_b` (not first `fact_m24o_a`) | both retained |
| P vague | `不太确定` | PASS | 2→2 | `open` | `false` | `resolution=null` | facts=2; next question same `conflict_id` |
| Q both inaccurate | `两条都不准确` | PASS | 2→2 | `open` | `false` | `resolution=null` | facts=2; no auto-select, no delete |
| R same `source_turn_id` replay | replay after N-style confirm | PASS | 2→3→3 | one `clarified` | (unchanged) | `outcome=not_applied`; `persist=idempotent_skip`; asked 3→3 | no second lifecycle transition |
| S stale non-open target | `第一条准确` after close | PASS | 3→3 | remains `unresolved_in_final` | `false` | `resolution=null`; `persist=stale_conflict_target` | no overwrite of the closed Conflict |
| T other DIR Conflict | `第一条准确` | PASS | 2→3 | chosen `clarified`; other remains `open` | chosen confirm true | `selected=fact_t_opt_a` | other facts + `source_refs` unchanged |

### FU3 Case U–Y

| Case | Input | Result | DC version | Conflict state | user_confirmation | resolution / selected | Notes |
|------|-------|--------|------------|----------------|-------------------|-----------------------|-------|
| U negate first | `第一条不准确` | PASS | 2→2 | `open` | `false` | `resolution=null`; `selected=none` | both facts retained; next question same `conflict_id` |
| V negate second | `不是第二条` | PASS | 2→2 | `open` | `false` | `resolution=null`; `selected=none` | both facts retained; next question same `conflict_id` |
| W negate first, affirm second | `不是第一条，而是第二条准确` | PASS | 2→3 | `clarified` | `true` | `selected=fact_m24w_b` (second fact) | both facts retained; DC version incremented once |
| X affirm + negate same fact | `第一条准确，但我不认可第一条` | PASS | 2→2 | `open` | `false` | `resolution=null`; `selected=none` | DC not mutated; next question same `conflict_id` |
| Y C1 persist failure | `第一条准确` + test hook returns `{ committed: false, error: "persist_failed" }` | PASS | 2→2 | `open` on returned and durable session | `false` | `returned_resolution=null`; `clarified_leaked=0` | see verbatim evidence below |

Case W was able to distinguish the contrast and selected the second fact. It did not wrongly close onto the first fact. The implementation therefore did not need to fall back to fail-closed ambiguous for this input.

### Verbatim key lines

```
[m24n] cf=conflict_fact_m24n_a+fact_m24n_b_0d3ba5d6; facts=fact_m24n_a,fact_m24n_b; state=clarified; confirm=true; selected=fact_m24n_a; turn=8fa28960-5abb-49c7-92b7-f6299721a3c9; dc=2->3; fact_count=2; briefs=0
  PASS  M2.4-R1-FU2 Case N: explicit choice of the first fact
[m24o] cf=conflict_fact_m24o_a+fact_m24o_b_a6695a83; selected=fact_m24o_b; expected_second=fact_m24o_b; first=fact_m24o_a; confirm=true; dc=2->3
  PASS  M2.4-R1-FU2 Case O: explicit choice of the second fact
[m24p] cf=conflict_fact_m24p_a+fact_m24p_b_839b6f37; state=open; confirm=false; resolution=null; facts=2; dc=2->2; next_cf=conflict_fact_m24p_a+fact_m24p_b_839b6f37
  PASS  M2.4-R1-FU2 Case P: vague answer must not close Conflict
[m24q] cf=conflict_fact_m24q_a+fact_m24q_b_934fc199; state=open; confirm=false; resolution=null; facts=2; dc=2->2
  PASS  M2.4-R1-FU2 Case Q: both-inaccurate must not auto-select or close
[m24r] turn=b863d7b0-cb4d-408a-9201-0ecd14956c4f; outcome=not_applied; persist=idempotent_skip; dc=2->3->3; asked=3->3; clarified=1; key_skip=idempotent_skip
  PASS  M2.4-R1-FU2 Case R: replay same source_turn_id is idempotent
[m24s] cf=conflict_fact_m24s_a+fact_m24s_b_74505b12; state=unresolved_in_final; confirm=false; resolution=null; dc=3->3; target=conflict_fact_m24s_a+fact_m24s_b_74505b12; persist=stale_conflict_target
  PASS  M2.4-R1-FU2 Case S: stale non-open Conflict is a safe no-op
[m24t] bound=conflict_fact_t_opt_a+fact_t_opt_b_6415f1a9; other=conflict_fact_t_sq_a+fact_t_sq_b_69b73b63; chosen=clarified; other_state=open; selected=fact_t_opt_a; dc=2->3; other_facts=fact_t_sq_a,fact_t_sq_b; other_refs=2
  PASS  M2.4-R1-FU2 Case T: other DIR Conflict is untouched
[m24u] input=第一条不准确; cf=conflict_fact_m24u_a+fact_m24u_b_3d481ade; state=open; confirm=false; resolution=null; selected=none; facts=2; dc=2->2; next_cf=conflict_fact_m24u_a+fact_m24u_b_3d481ade
  PASS  M2.4-R1-FU3 Case U: negate first fact must not close Conflict
[m24v] input=不是第二条; cf=conflict_fact_m24v_a+fact_m24v_b_e3a79221; state=open; confirm=false; resolution=null; selected=none; facts=2; dc=2->2; next_cf=conflict_fact_m24v_a+fact_m24v_b_e3a79221
  PASS  M2.4-R1-FU3 Case V: negate second fact must not close Conflict
[m24w] input=不是第一条，而是第二条准确; cf=conflict_fact_m24w_a+fact_m24w_b_db8548ba; state=clarified; confirm=true; selected=fact_m24w_b; expected_second=fact_m24w_b; facts=2; dc=2->3
  PASS  M2.4-R1-FU3 Case W: negate first and affirm second selects the second fact
[m24x] input=第一条准确，但我不认可第一条; cf=conflict_fact_m24x_a+fact_m24x_b_bf70587d; state=open; confirm=false; resolution=null; selected=none; facts=2; dc=2->2; next_cf=conflict_fact_m24x_a+fact_m24x_b_bf70587d
  PASS  M2.4-R1-FU3 Case X: conflicting affirm and negate must stay ambiguous
[m24y] input=第一条准确; returned_state=open; returned_confirm=false; returned_resolution=null; clarified_leaked=0; dc=2->2; persist_error=persist_failed; m1_outcome=persist_failed; fail_closed=true; durable_state=open; durable_dc=2; facts=2; asked=2->2
  PASS  M2.4-R1-FU3 Case Y: C1 persist failure returns original uncommitted session
M1 done. PASS=42 FAIL=0
```

## Case Y — evidence that C1 failure did not pollute the original session

The test injected only through `__testOnlyM1Hooks.conflictClarifyPersist`, returning `{ committed: false, error: "persist_failed" }`. Production default persist is unused in this case and remains the official C1 function when the hook is omitted.

Observed on the session **returned by** `handleUserMessage()` and on the durable session after `savePOJUSession`:

- Persist-failure status: `m1_outcome=persist_failed`, `persist_error=persist_failed`, `fail_closed=true` (Agent fail-closed assistant; no free-ask fallback).
- Returned Conflict stayed `open`; `user_confirmation=false`; `resolution=null`.
- `clarified_leaked=0` — no in-memory `clarified` state was present on the caller session.
- DC version stayed `2->2` on the returned session; durable DC version also stayed `2`.
- Both original RealityFacts retained (`facts=2`).
- Next-question planning did not continue: question budget `asked=2->2`.
- The failure was not disguised as success or `idempotent_replay`.

Verbatim:

```
[agent] M1 DC persist FAIL-CLOSED (no free-ask fallback) persist_failed persist_failed
[m24y] input=第一条准确; returned_state=open; returned_confirm=false; returned_resolution=null; clarified_leaked=0; dc=2->2; persist_error=persist_failed; m1_outcome=persist_failed; fail_closed=true; durable_state=open; durable_dc=2; facts=2; asked=2->2
```

## Regressions (against final implementation HEAD `4468347e`)

All commands were re-run on `4468347e58f55151ecad2cc47871534b86c937b5` after the implementation commit. Logs written as UTF-8 under `temp/out_m24fu3_final_*.txt`.

| Command | exit | counts / notes | elapsed |
|---------|------|----------------|---------|
| `pnpm test:m1-production-adaptive-question-loop` | 0 | 42/42 (`PASS=42 FAIL=0`) | 3.9s |
| `pnpm test:m1-r-fresh-session-main-loop` | 0 | 8/8 (`PASS=8 FAIL=0`) | 3.0s |
| `pnpm test:m2-3-decision-blueprint` | 0 | 18/18 | 3.3s |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | 19/19 | 3.3s |
| `pnpm test:m2-2-freeze-report-binding` | 0 | 43/43 | 5.4s |
| `pnpm test:decision-context-phase2` | 0 | 9 passed | 1.9s |
| `pnpm exec next typegen` | 0 | Types generated successfully | 1.5s |
| `pnpm exec tsc --noEmit` | 0 | no diagnostics | 5.9s |
| `pnpm build` | 0 | Next.js production build completed | 97.0s |

## Leftovers / UNTESTED / honest boundaries

- “两条都不准确” / hedges / unknown / declined / sole negation still keep the Conflict `open` by design. There is still no production path that records a *replacement* fact and then formally resolves after the user rejects both existing statements.
- Choice parsing is deterministic (explicit affirmation, negation, contrast, unique restatement). It is not semantic NLI. Unusual phrasing outside the implemented patterns fails closed (`ambiguous`).
- Case R replay is still exercised through `runCollectingDcTurn` with the same `source_turn_id` (M1-12 pattern), not a second `handleUserMessage()` that would mint a new turn id.
- Case Y injects C1 failure through the official test hook; it does not abort a live IndexedDB transaction. The production fail-closed branch (`!persisted.committed` → return original session, Agent `m1_fail_closed`) is the path that ran.
- No live (non-script) LLM session was used as evidence. No Phase 5 Personal Analysis, Freeze, or report-generation work in this follow-up.
- `public/sw.js`, `.cursor/plans/*`, and `temp/*` were left unstaged.

## Explicit non-actions

No PR, no merge to main, no deploy, no Vercel promote, no self-declared product PASS, no history rewrite, no self-referential tip SHA in this evidence file.
