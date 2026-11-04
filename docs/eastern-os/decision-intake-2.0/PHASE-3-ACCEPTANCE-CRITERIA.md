# Decision Intake 2.0 · Phase 3 Design Acceptance Criteria

| Field | Value |
|---|---|
| **Stage** | 3.1 Design package quality (not runtime) |
| **Baseline** | `main` @ `ee8c96e8` |
| **Pass rule** | All **AC3-*** / **MX-*** PASS or product-WAIVED |

---

## AC3-1 Package & architecture

| ID | Criterion | Pass if |
|---|---|---|
| AC3-1.1 | Six Phase 3 docs present under `docs/eastern-os/decision-intake-2.0/` | Files exist |
| AC3-1.2 | Engine modules + write authority defined | Architecture §2–§4 |
| AC3-1.3 | Understanding is derived; not second fact DB | Understanding State §0 |
| AC3-1.4 | Answer classes cover required cases | Answer Interpretation §2 |
| AC3-1.5 | CandidateQuestion traces DDR/DIR/value/budget | Question Planning §1 |
| AC3-1.6 | Model cannot declare Gate PASS / DDR satisfied | Model Contract §2 |
| AC3-1.7 | Docs-only; no runtime/UI/schema/PageFeedMatrix edits | `git diff` |
| AC3-1.8 | Phase 1 C1–C5 + Phase 2 catalogs cited; no silent reopen | Cross refs |
| AC3-1.9 | Budget soft 12 / hard 15 / depth 3 | Planning §5 |
| AC3-1.10 | Blueprint seed vs DC.dirs SoT preserved | Planning §6 |

---

## AC3-2 Red-line self-check

| Ban | Result |
|---|---|
| Call A/B Intake entry | **PASS** (forbidden in Architecture) |
| Stage 1–4 as Intake | **PASS** |
| Fixed questionnaire as product logic | **PASS** |
| Agenda as DIR SoT | **PASS** |
| Second fact DB | **PASS** |
| Model writes unverified confirmed facts | **PASS** |
| Chart as confirmed reality | **PASS** |
| Bypass P0/P1/P2 Gate | **PASS** |
| Progress via ask count | **PASS** |
| Runtime / PageFeedMatrix change in this PR | **PASS** (docs only) |

---

## AC3-3 Design matrix (MX-01 … MX-24)

Each case is a **design** acceptance test: docs must mandate the Then.

| ID | Given | When | Then | DDR/DIR basis |
|---|---|---|---|---|
| MX-01 | First simple decision message | Init + first plan | Blueprint seeds core DIRs; one primary Q to open P0 DIR (e.g. DEF-QUESTION) | DDR-01-*; DIR-DEF-* |
| MX-02 | Complex multi-constraint decision | Plan | Prioritize P0 constraint/options DIRs; multiple candidates ranked, one ask | DDR-01-HOLD, DDR-05-RANKING; OPT-CONSTRAINTS |
| MX-03 | User changes goal mid-session | goal_change class | Definition updates; Blueprint version bump if scope expands; **DIR states not wiped** | DEF-OUTCOME; Blueprint § rebuild |
| MX-04 | User supplements important fact | supplement | New RealityFact unverified→E1 path; reaggregate | Related open DIR |
| MX-05 | User corrects confirmed fact | correction | Supersede + reaggregate; no silent overwrite | Prior fact_id |
| MX-06 | Contradictory statements | contradiction | Conflict open; DIRs may → conflict; no auto-pick | Conflict + linked DIRs |
| MX-07 | User says unknown | unknown | status=unknown, vl=none; DIR not known; not n_a | Targeted dir_id |
| MX-08 | User declines | declined | status=declined; gap remains for Gate | Targeted dir_id |
| MX-09 | Repeated off-topic | off_topic / invalid | No fact write; streak toward Lockout; no fake progress | — |
| MX-10 | DIR already known | Plan | No re-ask same roles; candidate filtered | That dir_id |
| MX-11 | Multiple DDRs with gaps | Plan | Candidates for each gap; select by P0>P1>P2 | Multiple ddr_ids |
| MX-12 | P0 and P1/P2 gaps together | Plan | Ask P0 first | P0 ddr_ids |
| MX-13 | P1 gap may_affect_p5_ranking true | Plan / Gate soft | Treat ranking-critical; cannot soft-pass Freeze later if open | Phase 1 §3.3 / Phase 2 |
| MX-14 | P1 gap ranking false + boundaries | Plan / Gate | WARN-eligible path preserved; still may ask if budget | Phase 1 P1 WARN |
| MX-15 | Hard budget exhausted; P0 open | Terminate | No fake complete; cannot PASS freeze | Budget §5.2 |
| MX-16 | Model repeats prior ask | Validation | Reject; replan | Candidate filter |
| MX-17 | Model asks out of Blueprint | Validation | Reject; no silent scope expand | Blueprint.dir_ids |
| MX-18 | Model invalid schema | Contract | Retry/repair once; no DC write on fail | Model Contract §4 |
| MX-19 | Duplicate client_turn_id | Persist | Idempotent replay | Model Contract §5 |
| MX-20 | Persist fails after LLM | Persist | No committed ask shown; retry/error | Consistency §5.4 |
| MX-21 | Blueprint version changes | Lifecycle | Merge seeds; keep live DIR states | Phase 2 Blueprint |
| MX-22 | User reality ≠ pattern insight | insight_mismatch | Hypothesis/note; ask reality DIR; no chart-as-fact | Personal Pattern block |
| MX-23 | Profile missing / CFP calc fail | Source check | DDR-03 N/A or pending per Phase 2; DDR-02 CFP miss → pending → P0 FAIL (Rule A) | DDR-02 / DDR-03 |
| MX-24 | All P0/P1 satisfied or n_a per Gate | Soft Gate | Enter understanding_review; no more ask | Gate Phase 1/2 |

---

## AC3-4 Author consistency self-check

| # | Check | Result |
|---|---|---|
| 1 | Understanding derived only | **PASS** |
| 2 | Write authority matrix present | **PASS** |
| 3 | Answer classes ≥ required list | **PASS** |
| 4 | CandidateQuestion fields complete | **PASS** |
| 5 | MX-01…24 present with G/W/T | **PASS** |
| 6 | Phase 2 Rule A referenced for MX-23 | **PASS** |
| 7 | Deviations from Phase 1/2 | **0 intended** |
| 8 | Runtime code changed | **No** |

---

## Unresolved / risks

1. Exact LLM prompt text — Phase 3.2+ implementation.  
2. Information-gain numeric scoring weights — tunable; defaults TBD in impl without changing Gate.  
3. Lockout classifier owner — still Phase 8.  
4. Runtime confirmFact status promotion — still Phase 3+ code (Phase 1 deferred).  
5. Multi-DIR single utterance edge cases — validator heuristics need goldenset later.

---

## Phase 3.1 exit

When product PASSes this design PR:

- Stage 3.2 may implement Engine against these contracts.  
- **Do not** merge without product approval.  
- **Do not** start runtime work until approved.

---

## Declaration

Stage 3.1 design docs only. **No runtime code, schema, UI, prompt, or PageFeedMatrix changes.**
