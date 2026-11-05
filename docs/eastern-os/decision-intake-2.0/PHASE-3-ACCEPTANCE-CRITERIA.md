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

## AC3-3 Design matrix (MX-01 … MX-33)

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
| MX-15 | Hard budget exhausted; P0 open | Terminate | No fake complete; cannot PASS freeze; Session stays Phase-1 states only | Budget §5.2 |
| MX-16 | Model repeats prior ask | Validation | Reject; replan | Candidate filter |
| MX-17 | Model asks out of Blueprint | Validation | Reject; no silent scope expand | Blueprint.dir_ids |
| MX-18 | Model invalid schema | Contract | Retry/repair once; no Answer Commit on fail | Model Contract §4 |
| MX-19 | Duplicate client_turn_id | Persist | Idempotent AnswerCommitResult replay | Model Contract §5 |
| MX-20 | Persist fails after LLM (phase B) | Persist | No AskPayload shown; answer Commit A kept; retry B | Model Contract §5.2–§5.4 |
| MX-21 | Blueprint version changes | Lifecycle | Merge seeds; keep live DIR states | Phase 2 Blueprint |
| MX-22 | User reality ≠ pattern insight | insight_mismatch | Hypothesis/note; ask reality DIR; no chart-as-fact | Personal Pattern block |
| MX-23 | Profile missing / CFP calc fail | Source check | DDR-03 N/A or pending per Phase 2; DDR-02 CFP miss → pending → P0 FAIL (Rule A) | DDR-02 / DDR-03 |
| MX-24 | Soft/Review Gate **PASS** (all P0/P1 OK) | Soft→Review | May enter `understanding_review`; no further ask on this path; E2 allowed after Freeze Gate PASS | Phase 1 §4.2 |
| MX-25 | Soft/Review Gate **WARN** (P1 non-ranking + complete L + boundaries) | Soft→Review | May enter `understanding_review` with disclosures; Freeze may be conditional/`degraded`; not disguised as PASS | Phase 1 §3.3 / §4.2 |
| MX-26 | Soft Gate **FAIL** + open P0 gaps | Soft Gate | **Stay `investigating`**; continue Question Planning (P0 first); investigating **not** terminated by FAIL alone | Phase 1 §1.3 / §1.5; Arch §3 |
| MX-27 | Soft Gate **FAIL** + user requests review | USER_REQUEST_REVIEW | May enter `understanding_review` with honest FAIL summary; **must not** present PASS; **E2 Freeze forbidden** | Phase 1 §1.3 |
| MX-28 | Soft budget hit; P0 still open | Budget | Continue P0-only asks until hard; disclose pressure; no fake PASS | Planning §5.2 |
| MX-29 | DDR with required source, no required DIR | NeedItem | Emit `source_only` NeedItem; no invented DIR; ask only if `user_askable` | Understanding §2.3; Phase 2 |
| MX-30 | DIR marked n_a without na evidence | Understood / Gate | Invalid; exclude from satisfaction; unknown/declined not auto-n_a | Understanding §2.7; Phase 1 §3.2 |
| MX-31 | Commit A done; LLM timeout in B | Persist | DC kept; resume B; asked_count unchanged until Ask shown | Model Contract §5.4 |
| MX-32 | Equal scores on two P1 candidates | Plan sort | Stable tie-break by dir_id / ddr_ids / candidate_id; P0>P1>P2 never overridden | Planning §2.1 |
| MX-33 | Only P2 gaps after hard budget | Review | May enter review; P2 alone must not block report | Phase 1; Planning §5.2 |

---

## AC3-4 Author consistency self-check

| # | Check | Result |
|---|---|---|
| 1 | Understanding derived only | **PASS** |
| 2 | Write authority matrix present | **PASS** |
| 3 | Answer classes ≥ required list | **PASS** |
| 4 | CandidateQuestion fields complete | **PASS** |
| 5 | MX-01…33 present with G/W/T | **PASS** |
| 6 | Phase 2 Rule A referenced for MX-23 | **PASS** |
| 7 | Soft ≠ Review ≠ Freeze Gate (R1-01) | **PASS** |
| 8 | Two-phase persist; no LLM-in-TX (R1-03) | **PASS** |
| 9 | Deviations from Phase 1/2 | **0 intended** (OPEN product notes only) |
| 10 | Runtime code changed | **No** |

---

## Unresolved / risks

1. Exact LLM prompt text — Phase 3.2+ implementation.  
2. Information-gain numeric constants — defaults in Planning §2.1; retunable without changing Gate.  
3. Lockout classifier owner — still Phase 8.  
4. Runtime confirmFact status promotion — still Phase 3+ code (Phase 1 deferred).  
5. Multi-DIR single utterance edge cases — validator heuristics need goldenset later.  
6. **OPEN product:** hard-budget + P0 open → stay investigating vs review-with-FAIL (no new Session state).  
7. **OPEN product:** Commit B version drift → auto-replan once vs force client refresh.  
8. **OPEN product:** how many UX steps for non-askable source_only gaps.

---

## Phase 3.1 exit

When product PASSes this design PR:

- Stage 3.2 may implement Engine against these contracts.  
- **Do not** merge without product approval.  
- **Do not** start runtime work until approved.

---

## Declaration

Stage 3.1 design docs only. **No runtime code, schema, UI, prompt, or PageFeedMatrix changes.**
