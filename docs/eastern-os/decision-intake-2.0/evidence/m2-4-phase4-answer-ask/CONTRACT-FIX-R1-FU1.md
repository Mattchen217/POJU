# M2.4-R1-FU1 — Answer Role Authorization + Conservative Conflict Evidence

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent (baseline):** `f9ee9f97fb036384d0d33a154cb8849ef3314aec`  
**Implementation commit:** `5d4d5e0bc00c094bfcebb10001a4bbffe4177c63`  
**Status:** Implementation + tests committed for independent review. **Does not self-declare product PASS.**

## Goal

Fix three Phase 4 main-path defects found in independent review of M2.4-R1:

1. Answer role authorization must come from the actually-sent Plan `fact_role_codes`, never inferred from `DIR.required_fact_roles`.
2. Conflict evidence must be conservative; different text on the same DIR/role is not automatically a conflict.
3. Case G / Case H must exercise real continuous flows (clarification ask + Understanding advancement), without forging Conflict resolution.

## Changed files

### Production
- `lib/poju/decision-intake/types.ts` — `last_sent_question.fact_role_codes?`; `AnswerEvent.interpreter` union includes `deterministic_m2_4_r1`
- `lib/poju/decision-intake/adaptive-turn.ts` — `attachAuthorizedAssistantQuestion` writes `fact_role_codes` from sent Plan
- `lib/poju/decision-intake/answer-interpretation.ts` — `activeTargets()` uses last_sent roles only; historical missing roles restore only on matching `next_question_plan.plan_id`; else `invalid_input` / `missing_authorized_fact_roles`; interpreter version aligned
- `lib/poju/decision-intake/apply-answer-to-dc.ts` — correction vs contradiction separated; conservative mutual-exclusion + explicit-contradiction language; never auto-close open Conflicts

### Tests
- `scripts/test-m1-production-adaptive-question-loop.ts` — Cases I–M; Case G continuous clarify ask + honest blocker; Case H progression asserts

## Behavior summary

1. **Role authorization:** `last_sent_question.fact_role_codes` from actually-sent Plan. No `factRolesFromDirs()` expansion. Historical sessions missing codes restore only when `next_question_plan.plan_id` matches; otherwise `missing_authorized_fact_roles`.
2. **Conflicts:** correction defaults to append-only; Conflict only on clear same-dimension mutual exclusion. Contradiction may open Conflict with explicit contradiction language or mutual exclusion on same DIR/role. Time-scoped statements and supplements do not create Conflicts. Open Conflicts are never auto-cleared.
3. **Case G:** conflict Understanding + clarification question + `last_sent_question.fact_role_codes` verified; clarification answer appends fact via `handleUserMessage`. Formal resolution is **not** forged.
4. **Case H:** three real Agent turns; targets/roles checked; DC version increments on legal writes; Understanding aligned; t3 must not fall back to decision_question template when DQ already established.

## Production main-path blocker (honest)

Formal user-triggered Conflict Resolution is **not wired** into the answer path:

- Existing function: `clarifyConflict` in `lib/poju/decision-context/conflict-lifecycle.ts`
- Missing call sites: `applyAnswerEventToSessionDc`, `runAdaptiveQuestionTurn`, `runCollectingDcTurn`, `handleUserMessage`
- Current production behavior after clarification answers: append RealityFact; open Conflict remains open
- Case G documents `blocker=clarifyConflict_not_wired_into_answer_path` and does not manually set `Conflict.state`

## Case results (real)

| Case | Result | Notes |
|------|--------|-------|
| A–F | PASS | Preserved from M2.4-R1 |
| G | PASS | clarify Q + last_sent roles; clarification fact appended; open Conflict remains (blocker documented) |
| H | PASS | versions advance; t3 asks DIR-STATUS-QUO / status_quo (not decision_question template) |
| I | PASS | write_roles=option only; need keeps status_quo,risk |
| J | PASS | invalid_input + missing_authorized_fact_roles; dc_v unchanged |
| K | PASS | supplement correction → open=0 |
| L | PASS | explicit contradiction → open Conflict with both fact_ids |
| M | PASS | time change → open=0 |

### Verbatim key lines

```
[m24g] ... last_roles=v1/dir/DIR-OPT-ON-TABLE/role/option; added=1; open_after=1; blocker=clarifyConflict_not_wired_into_answer_path
[m24h-t3] ... dirs=DIR-STATUS-QUO; roles=v1/dir/DIR-STATUS-QUO/role/status_quo
[m24i] dirs=DIR-OPT-ON-TABLE; write_roles=option; need=missing_roles:status_quo,risk; ...
[m24j] cls=invalid_input; notes=missing_authorized_fact_roles; writes=0; dc_v=1
[m24k] ... open=0; cls=correction
[m24l] ... open=1; source_refs=2; cls=contradiction
[m24m] ... open=0; cls=correction
M1 done. PASS=29 FAIL=0
```

## Regressions (against implementation HEAD)

| Command | exit | counts |
|---------|------|--------|
| `pnpm test:m1-production-adaptive-question-loop` | 0 | 29/29 |
| `pnpm test:m1-r-fresh-session-main-loop` | 0 | 8/8 |
| `pnpm test:m2-3-decision-blueprint` | 0 | 18/18 |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | 19/19 |
| `pnpm test:m2-2-freeze-report-binding` | 0 | 43/43 |
| `pnpm test:decision-context-phase2` | 0 | 9 |
| `pnpm exec next typegen` | 0 | — |
| `pnpm exec tsc --noEmit` | 0 | — |
| `pnpm build` | 0 | — |

## UNTESTED / honest boundaries

- Formal Conflict Resolution via user clarification is not production-wired (`clarifyConflict` unused on answer path).
- Mutual-exclusion rules are deterministic regex/heuristics, not semantic NLI.
- Multi-fact clause splitting remains soft separators, not full NLP.
- No Phase 5 Personal Analysis work in this follow-up.

## Explicit non-actions

No PR, no merge to main, no deploy, no Vercel promote, no self-declared product PASS, no history rewrite, no self-referential tip SHA in this evidence file.
