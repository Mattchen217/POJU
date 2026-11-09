# M2.4-R1 — Phase 4 Answer Interpretation + Adaptive Question Generation

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent (baseline):** `6ceb0d0c69fc8a9054c531f534dd67eef8f492ec`  
**Implementation commit:** `738b6d2d6a8258851241469f0c660653e33f52ea`  
**Status:** Implementation + tests committed for independent review. **Does not self-declare product PASS.**

## Goal

Advance the already-wired Decision Intake 2.0 production Q&A path from v1 simplified heuristics to usable Phase 4 core:
- user answers enter DC accurately (authorized target only)
- Understanding reflects formal DC state
- next question is generated from remaining fact-role gaps
- real Agent main path runs ≥3 consecutive turns

## Changed files

### Production
- `lib/poju/decision-intake/answer-interpretation.ts`
- `lib/poju/decision-intake/apply-answer-to-dc.ts`
- `lib/poju/decision-intake/question-generation.ts`
- `lib/poju/decision-intake/understanding-state.ts`
- `lib/poju/decision-intake/adaptive-turn.ts` (pass `last_sent_question_text` into plan builder)
- `lib/poju/decision-intake/types.ts` (header note only)

### Tests
- `scripts/test-m1-production-adaptive-question-loop.ts` (Cases A–H + interp target fix)
- `scripts/test-m1-r-fresh-session-main-loop.ts` (version marker strings only — required after Phase 4 version bump)

## Behavior summary

1. **Answer target authority:** `last_sent_question` → else current Plan. No Blueprint-first DIR guess; missing target → `invalid_input` / `missing_authorized_answer_target`.
2. **Classification order:** empty/invalid → off_topic → unknown → declined → correction → contradiction → estimate → constraint signal → clear/partial.
3. **ProposedWrites:** unknown/declined statuses preserved; estimate=`user_estimate`+unverified; constraint writes; multi-clause → multiple writes same `source_turn_id`; never `confirmed` at interpretation.
4. **Conflicts:** related by `related_dir_ids` + `fact_roles`; append-only; open Conflict only with clear content clash; never auto-clear open Conflicts; reaggregate receives updated conflicts.
5. **Understanding:** fact-id briefs; Understood only for `known`/`n_a`; Need lists unmet roles; summary stable unless fingerprint changes; hypotheses stay in analysis only.
6. **Question generation:** `resolveMissingRoleQuestions` + gap/conflict follow-ups; Plan fields unchanged; dedupe compares focus (strips decision-question prefix); no remaining need → validation `no_remaining_info_need`.
7. **Fail-closed:** prior M2.3 / FU `planner_blocked` / persist failures preserved.

## Case A–H verbatim excerpts

```text
[m24a] cls=clear_answer; writes=2; dirs=DIR-OPT-CONSTRAINTS
[m24a] applied facts=fact_m1_turn_m24a_0,fact_m1_turn_m24a_1; dc_version=2
  PASS  M2.4-R1 Case A: multi-fact answer → multiple ProposedWrites; no unrelated DIR
[m24b] verification_level=user_estimate; status=unverified
  PASS  M2.4-R1 Case B: estimate → user_estimate + unverified (not confirmed)
[m24c] unknown_status=unknown; declined_status=declined; askedBefore=1; asked2=1
  PASS  M2.4-R1 Case C: unknown/declined statuses; no effective ask-budget charge on answer
[m24d] old=fact_m1_turn_m24d_1_0; new=fact_m1_turn_m24d_2_0; open_conflicts=1; cls=correction
  PASS  M2.4-R1 Case D: correction keeps old fact; open Conflict on clear clash
[m24e] qA=关于「要不要离职去创业？」——资金、时间、责任方面有哪些具体硬限制？（这样我才能判断：Needed for DIR-OPT-CONSTRAINTS）; qB=关于「要不要搬去上海？」——资金、时间、责任方面有哪些具体硬限制？（这样我才能判断：Needed for DIR-OPT-CONSTRAINTS）; dirsA=DIR-OPT-CONSTRAINTS; dirsB=DIR-OPT-CONSTRAINTS
  PASS  M2.4-R1 Case E: dynamic question text differs across decision gaps
[m24f] targetDir=DIR-OPT-ON-TABLE; role0=option; need=missing_roles:status_quo; 有哪些真实可选方案; nextQ=关于「要不要换工作？」——资金、时间、责任方面有哪些具体硬限制？（这样我才能判断：Needed for DIR-OPT-CONSTRAINTS）
  PASS  M2.4-R1 Case F: satisfied role not re-asked; next role gap
[m24g] conflict_briefs=1; gap=conflict; nextQ=关于「Should I leave my job?」——当前记录存在冲突：只有一个选项：留任 vs 其实还有创业选项。请帮助澄清哪一项属实。（已知：只有一个选项：留任；请补充尚未说清的部分）
  PASS  M2.4-R1 Case G: open Conflict → Understanding conflict; DIR not known; ask resolves
[m24h-t1] phase=collecting_context; dc_v=1; q=关于「要不要接受新 offer？」——期望达成的结果？（这样我才能判断：用于比较选项与成立条件）; llmDelta=1
[m24h-t2] dc_v=2; phase=collecting_context; authQ=关于「要不要接受新 offer？」——目标优先级顺序？（这样我才能判断：驱动选项排序）; llmDelta=1; prevQ_same=false
[m24h-t3] dc_v=3; phase=collecting_context; authQ=关于「要不要接受新 offer？」——请把要做的决策问题说得更具体一点？（已知：要不要接受新 offer？；请补充尚未说清的部分）（这样我才能判断：没有明确问题; llmDelta=1
[m24h] path=handleUserMessage×3; versions=1->2->3; total_llm_fetches=3
  PASS  M2.4-R1 Case H: real Agent main path ≥3 turns; LLM does not override authorized Q
M1 done. PASS=24 FAIL=0
```

## Regressions (real exit codes)

| Command | exit | notes |
|---------|------|-------|
| `pnpm test:m1-production-adaptive-question-loop` | 0 | 24/24 |
| `pnpm test:m1-r-fresh-session-main-loop` | 0 | 8/8 |
| `pnpm test:m2-3-decision-blueprint` | 0 | 18/18 |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | 19/19 |
| `pnpm test:m2-2-freeze-report-binding` | 0 | 43/43 |
| `pnpm test:decision-context-phase2` | 0 | 9 |
| `pnpm exec next typegen` | 0 | — |
| `pnpm exec tsc --noEmit` | 0 | — |
| `pnpm build` | 0 | — |

## UNTESTED / honest limits

- No full multi-turn natural-language Understanding crash fixture beyond FU4 Hook path.
- Multi-fact splitting is deterministic clause split (。；另外/还有/以及), not full NLP coreference.
- Conflict “clear evidence” is normalized-statement inequality on related DIR+role facts; not semantic NLI.
- Case E both fixtures currently select `DIR-OPT-CONSTRAINTS` first; question texts still differ via decision_question prefix + Blueprint dirs differ.
- Personal Analysis Profile still unavailable (Phase 5 not wired).
- Evidence file intentionally omits self-referential tip SHA (written before evidence commit).

## Explicit non-actions

No PR · no merge · no deploy · no promote · no tip · **no product PASS self-declaration**.
