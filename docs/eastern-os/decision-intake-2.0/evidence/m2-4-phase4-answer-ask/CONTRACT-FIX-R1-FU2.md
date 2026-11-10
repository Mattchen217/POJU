# M2.4-R1-FU2 — Wire formal Conflict Resolution into the production answer path

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent (baseline):** `9e6d64d498ec75bb7681fa6cf164c634e936a83a`  
**Implementation commit (wiring + tests):** `4e900f912ac158e8b932694ceeb44d529f881c66`  
**Implementation follow-up (typings only):** `0146df4f52b4f8ac774d8effadbf616374d64979`  
**Final implementation HEAD (suite ran here):** `0146df4f52b4f8ac774d8effadbf616374d64979`  
**Evidence tip SHA:** *(empty / pending Max review — this file must not contain a self-referential tip SHA)*  
**Status:** Implementation + typings + tests + this evidence file committed for independent review. **Does not self-declare product PASS.**

## Goal

Close the honest FU1 blocker `clarifyConflict_not_wired_into_answer_path` by wiring the official Conflict lifecycle into the real Adaptive Turn answer path, reachable through `handleUserMessage()`.

This follow-up does not rewrite Answer Interpretation (except the specified `findRelatedOldFacts` filter), does not redo Blueprint / DDR / DC data models, does not introduce a second Conflict store, and does not assign `Conflict.state = "clarified"` by hand.

## Changed files and key functions

### Production

- `lib/poju/decision-intake/types.ts` — `ConflictClarificationTarget`; optional `conflict_clarification` on `AdaptiveQuestionPlan` and on `UnderstandingState.last_sent_question`.
- `lib/poju/decision-intake/apply-answer-to-dc.ts` — `findRelatedOldFacts()` now excludes `unknown` / `declined` / `not_applicable` and requires a shared non-empty `fact_roles` overlap. Other write rules unchanged.
- `lib/poju/decision-intake/conflict-clarification.ts` (new) — `bindConflictClarificationToPlan()`, `resolveConflictChoice()`, `planForSameConflictClarification()`. Binds at most one open Conflict whose facts share a DIR with the current Plan. Deterministic choice parsing only; hedges / “both inaccurate” / non-unique restatements return `ambiguous`.
- `lib/poju/decision-intake/conflict-clarification-turn.ts` (new) — `handleConflictClarificationAnswer()`, `findClarifiedConflictForTurn()`. Official `clarifyConflict()` call site; C1 persist via `persistDcLifecycleChange()` with key `dc_conflict_clarify:${session_id}:${source_turn_id}`; fail-closed on persist error; ambiguous answers re-ask the same `conflict_id` / `fact_ids`.
- `lib/poju/decision-intake/adaptive-turn.ts` — `planFromState()` runs `bindConflictClarificationToPlan()` on primary, alternate, and catalog-fallback plans; `attachAuthorizedAssistantQuestion()` copies `conflict_clarification` from the actually-sent Plan (or `null`); `runAdaptiveQuestionTurn()` enters the conflict branch before `interpretUserAnswer()` / `applyAnswerEventToSessionDc()` when last_sent has a target, or when this `source_turn_id` already clarified / already has the persist key (replay after last_sent advanced). Follow-up commit widened `withUnderstanding` `askSnap` to `IntakeAskPlanSnapshot | null | undefined` so the callback is assignable to `handleConflictClarificationAnswer` (no runtime change).

### Audited, not modified

- `lib/poju/decision-intake/understanding-state.ts` — `buildUnderstandingState()` already treats only `Conflict.state === "open"` as conflict gaps / `conflict_briefs`. After official `clarified`, the Conflict is no longer an open gap. DIR `current_state` still comes from existing DC aggregation (`conflict > n_a > known > unknown`); a clarified Conflict alone does not force the DIR to `known`.
- `lib/poju/decision-context/conflict-lifecycle.ts` — existing `clarifyConflict()` used unchanged.
- `lib/poju/agent.ts`, `lib/poju/collecting-dc-turn.ts` — existing production routing unchanged; conflict work is reached through the existing Adaptive Turn call.

### Tests

- `scripts/test-m1-production-adaptive-question-loop.ts` — unknown/declined non-conflict regression; Cases N–T via real `handleUserMessage()` (Case R replay uses `runCollectingDcTurn` with the same `source_turn_id`, same pattern as M1-12); Case G updated to the wired-but-ambiguous path (no longer documents `blocker=clarifyConflict_not_wired_into_answer_path`).

## Exact `clarifyConflict()` production call site

File: `lib/poju/decision-intake/conflict-clarification-turn.ts`  
Function: `handleConflictClarificationAnswer`  
Lines: 198–209

```ts
const clarified = clarifyConflict(
  conflict,
  JSON.stringify({
    selected_fact_id: result.fact_id,
    source_turn_id,
    user_statement: statement.slice(0, 1000),
  }),
  {
    user_confirmation: true,
    now,
  },
);
```

Only the matching entry in `DecisionContext.conflicts` is replaced. All RealityFacts are retained. DIRs are reaggregated with `reaggregateDirsOnSession()`. DC `version` / `updated_at` are bumped, then committed with `persistDcLifecycleChange()`. Persist failure returns the original session; memory-only `clarified` is not given back to the Agent.

## Full production call chain from `handleUserMessage()`

1. `handleUserMessage()` — `lib/poju/agent.ts` (~L797)
2. `runM1ProductionPreLlmTurn()` — `lib/poju/collecting-dc-turn.ts` (~L194), called from `agent.ts` (~L1102)
3. `runCollectingDcTurn()` — `lib/poju/collecting-dc-turn.ts` (~L163)
4. `runAdaptiveQuestionTurn()` — `lib/poju/decision-intake/adaptive-turn.ts` (~L184)
5. If `last_sent_question.conflict_clarification` is present, or `findClarifiedConflictForTurn()` / persist key shows this `source_turn_id` already clarified: `handleConflictClarificationAnswer()` — `lib/poju/decision-intake/conflict-clarification-turn.ts` (~L74)
6. `resolveConflictChoice()` — `lib/poju/decision-intake/conflict-clarification.ts` (~L159)
7. On `kind === "selected"` and Conflict still `open`: official `clarifyConflict()` at the call site above
8. `reaggregateDirsOnSession()` → `persistDcLifecycleChange()` (C1, key `dc_conflict_clarify:${session_id}:${source_turn_id}`)
9. Rebuild Understanding + Readiness + next Plan (`bindConflictClarificationToPlan`); later `attachAuthorizedAssistantQuestion()` writes the actually-sent Plan’s `conflict_clarification` onto `last_sent_question`

If last_sent has no conflict target (and this turn did not already clarify), the ordinary `interpretUserAnswer()` → `applyAnswerEventToSessionDc()` path is unchanged.

## Case results (real, against final implementation HEAD `0146df4f`)

Recorded from `pnpm test:m1-production-adaptive-question-loop` (UTF-8 log). Suite result: **PASS=37 FAIL=0**, exit 0.

### DC version / Conflict state / user_confirmation / resolution / fact retention

| Case | Result | DC version | Conflict state | user_confirmation | resolution / selected | Facts |
|------|--------|------------|----------------|-------------------|-----------------------|-------|
| unknown/declined regression | PASS | (no new Conflict) | open=0 | n/a | n/a | both old facts retained; contradiction language did not open a Conflict |
| N first fact | PASS | 2→3 | `clarified` | `true` | `selected=fact_m24n_a`; resolution includes selected_fact_id + source_turn_id | both retained (`fact_count=2`); Understanding `briefs=0` |
| O second fact | PASS | 2→3 | `clarified` | `true` | `selected=fact_m24o_b` (not first `fact_m24o_a`) | both retained |
| P vague “不太确定” | PASS | 2→2 | `open` | `false` | `resolution=null` | facts=2; next question same `conflict_id` |
| Q “两条都不准确” | PASS | 2→2 | `open` | `false` | `resolution=null` | facts=2; no auto-select, no delete |
| R same `source_turn_id` replay | PASS | 2→3→3 | one `clarified` | (unchanged) | `outcome=not_applied`; `persist=idempotent_skip`; asked 3→3 | no second lifecycle transition |
| S stale non-open target | PASS | 3→3 | remains `unresolved_in_final` | `false` | `resolution=null`; `persist=stale_conflict_target` | no overwrite of the closed Conflict |
| T other DIR Conflict | PASS | 2→3 | chosen `clarified`; other remains `open` | chosen confirm true | `selected=fact_t_opt_a` | other facts + `source_refs` unchanged |
| G (honest re-assert) | PASS | (no clarify) | remains open (`open_after=1`) | n/a | `path=wired_ambiguous`; `next_cf=cf_g_open` | `added=0`; formal clarify question issued |

### Verbatim key lines

```
[m24ud] status=unknown; cls=contradiction; open=0; facts=2
[m24ud] status=declined; cls=contradiction; open=0; facts=2
  PASS  M2.4-R1-FU2 unknown/declined old fact must not create Conflict
[m24n] cf=conflict_fact_m24n_a+fact_m24n_b_3ed33132; facts=fact_m24n_a,fact_m24n_b; state=clarified; confirm=true; selected=fact_m24n_a; turn=06a458f5-d420-4690-a62a-2d62da40a8a5; dc=2->3; fact_count=2; briefs=0
  PASS  M2.4-R1-FU2 Case N: explicit choice of the first fact
[m24o] cf=conflict_fact_m24o_a+fact_m24o_b_b5402d70; selected=fact_m24o_b; expected_second=fact_m24o_b; first=fact_m24o_a; confirm=true; dc=2->3
  PASS  M2.4-R1-FU2 Case O: explicit choice of the second fact
[m24p] cf=conflict_fact_m24p_a+fact_m24p_b_9e6ea89c; state=open; confirm=false; resolution=null; facts=2; dc=2->2; next_cf=conflict_fact_m24p_a+fact_m24p_b_9e6ea89c
  PASS  M2.4-R1-FU2 Case P: vague answer must not close Conflict
[m24q] cf=conflict_fact_m24q_a+fact_m24q_b_208faa14; state=open; confirm=false; resolution=null; facts=2; dc=2->2
  PASS  M2.4-R1-FU2 Case Q: both-inaccurate must not auto-select or close
[m24r] turn=8dbe37cc-02ad-4eaf-b69a-1370569266ba; outcome=not_applied; persist=idempotent_skip; dc=2->3->3; asked=3->3; clarified=1; key_skip=idempotent_skip
  PASS  M2.4-R1-FU2 Case R: replay same source_turn_id is idempotent
[m24s] cf=conflict_fact_m24s_a+fact_m24s_b_b04c5b4c; state=unresolved_in_final; confirm=false; resolution=null; dc=3->3; target=conflict_fact_m24s_a+fact_m24s_b_b04c5b4c; persist=stale_conflict_target
  PASS  M2.4-R1-FU2 Case S: stale non-open Conflict is a safe no-op
[m24t] bound=conflict_fact_t_opt_a+fact_t_opt_b_646a298f; other=conflict_fact_t_sq_a+fact_t_sq_b_9d897a34; chosen=clarified; other_state=open; selected=fact_t_opt_a; dc=2->3; other_facts=fact_t_sq_a,fact_t_sq_b; other_refs=2
  PASS  M2.4-R1-FU2 Case T: other DIR Conflict is untouched
[m24g] conflict_briefs=1; gap=conflict; clarifyQ=我发现这项信息存在两条不一致的记录：
请明确选择哪一条准确。也可以说明两条都不准确，我会继续核实，不会自行替你; last_roles=v1/dir/DIR-OPT-ON-TABLE/role/option; added=0; open_after=1; path=wired_ambiguous; next_cf=cf_g_open
  PASS  M2.4-R1 Case G: open Conflict → Understanding conflict; DIR not known; ask resolves
M1 done. PASS=37 FAIL=0
```

## Regressions (against final implementation HEAD `0146df4f`)

All commands used `C:\Users\13306\AppData\Roaming\npm\pnpm.cmd`. Logs written as UTF-8. These results replace the earlier batch on `4e900f91` (that batch had `tsc --noEmit` exit 2 and `pnpm build` exit 1 from the `askSnap` typings error).

| Command | exit | counts / notes | elapsed |
|---------|------|----------------|---------|
| `pnpm test:m1-production-adaptive-question-loop` | 0 | 37/37 (`PASS=37 FAIL=0`) | 3.7s |
| `pnpm test:m1-r-fresh-session-main-loop` | 0 | 8/8 (`PASS=8 FAIL=0`) | 3.0s |
| `pnpm test:m2-3-decision-blueprint` | 0 | 18/18 | 3.3s |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | 19/19 | 3.3s |
| `pnpm test:m2-2-freeze-report-binding` | 0 | 43/43 | 5.4s |
| `pnpm test:decision-context-phase2` | 0 | 9 passed | 1.9s |
| `pnpm exec next typegen` | 0 | Types generated successfully | 1.5s |
| `pnpm exec tsc --noEmit` | 0 | no diagnostics | 6.2s |
| `pnpm build` | 0 | Next.js production build completed | 99.2s |

## Leftovers / UNTESTED / honest boundaries

- “两条都不准确” / hedges / unknown / declined keep the Conflict `open` by design in this round. There is still no production path that records a *replacement* fact and then formally resolves after the user rejects both existing statements.
- Choice parsing is deterministic (ordinals, explicit “第N条/项”, unique restatement). It is not semantic NLI.
- Conflict-clarify C1 persist failure is fail-closed in code (original session is returned) but this suite has no dedicated end-to-end Case for that failure mode.
- Case R replay is exercised through `runCollectingDcTurn` with the same `source_turn_id` (M1-12 pattern), not a second `handleUserMessage()` that would mint a new turn id.
- Multiple open Conflicts are bound one Plan at a time in stable Conflict-list order; Case T covers a different-DIR neighbor, not two open Conflicts on the same DIR in one question.
- No live (non-script) LLM session was used as evidence. No Phase 5 Personal Analysis, Freeze, or report-generation work in this follow-up.
- `public/sw.js`, `.cursor/plans/*`, and `temp/*` were left unstaged.

## Explicit non-actions

No PR, no merge to main, no deploy, no Vercel promote, no self-declared product PASS, no history rewrite, no self-referential tip SHA in this evidence file.
