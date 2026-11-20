from pathlib import Path
excerpts = Path(r"temp/m24/case_excerpts_utf8.txt").read_text(encoding="utf-8")
md = f'''# M2.4-R1 — Phase 4 Answer Interpretation + Adaptive Question Generation

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent (baseline):** `6ceb0d0c69fc8a9054c531f534dd67eef8f492ec`  
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
{excerpts.rstrip()}
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
'''
Path(r"docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-M2-4-R1.md").write_text(md, encoding="utf-8")
print("evidence written", len(md))
