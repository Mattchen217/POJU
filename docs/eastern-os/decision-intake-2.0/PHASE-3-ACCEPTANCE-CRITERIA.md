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
| AC3-1.9 | Budget soft 12 / hard 15 / depth 3; soft budget → review (Phase 1) | Planning §5; Arch §3 |
| AC3-1.10 | Blueprint seed vs DC.dirs SoT preserved | Planning §6 |
| AC3-1.11 | Kind-aware validation (dir_based / source_only) | Planning §4 |
| AC3-1.12 | Commit B uniqueness + version-drift safety | Model Contract §5.4–§5.6 |
| AC3-1.13 | N/A authority + na_conditions protocol | Understanding §2.7 |
| AC3-1.14 | Deterministic sort + repetition_count + normalized ddr_ids | Planning §2.1 |

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
| Soft budget auto-extends investigating past Phase 1 | **PASS** (forbidden; R2-01) |
| New Session states | **PASS** (none) |
| Runtime / PageFeedMatrix change in this PR | **PASS** (docs only) |

---

## AC3-3 Design matrix (MX-01 … MX-48)

Each case is a **design** acceptance test: docs must mandate the Then.

| ID | Given | When | Then | Phase 1/2 · Phase 3 |
|---|---|---|---|---|
| MX-01 | First simple decision message | Init + first plan | Blueprint seeds core DIRs; one primary Q to open P0 DIR | P2 Blueprint · Plan §1–2 |
| MX-02 | Complex multi-constraint decision | Plan | Prioritize P0; one ask | P2 DDR-01/05 · Plan §2 |
| MX-03 | User changes goal mid-session | goal_change | Blueprint bump if needed; **DIR states not wiped** | P2 Blueprint · Plan §6 |
| MX-04 | User supplements important fact | supplement | New RealityFact unverified→E1 path; reaggregate | P1 C1 · Answer Interp |
| MX-05 | User corrects confirmed fact | correction | Supersede + reaggregate; no silent overwrite | P1 C1 |
| MX-06 | Contradictory statements | contradiction | Conflict open; no auto-pick | P1 Conflict |
| MX-07 | User says unknown | unknown | status=unknown; not n_a; not known | P1 §3.2 · US §2.7 |
| MX-08 | User declines | declined | gap remains; not auto n_a | P1 §3.2 · US §2.7 |
| MX-09 | Repeated off-topic | off_topic | No fact write; Lockout streak | P1 Lockout |
| MX-10 | DIR already known | Plan | No re-ask same roles | Plan §2 filter |
| MX-11 | Multiple DDRs with gaps | Plan | Candidates ranked P0>P1>P2 | Plan §2.1 |
| MX-12 | P0 and P1/P2 gaps together | Plan | Ask P0 first | Plan §2.1 |
| MX-13 | P1 may_affect_p5_ranking true | Plan / Gate | Ranking-critical; cannot soft-pass Freeze if open | P1 §3.3 |
| MX-14 | P1 ranking false + boundaries | Plan / Gate | WARN-eligible path preserved | P1 §3.3 / §4.2 |
| MX-15 | Hard budget exhausted; P0 open | Hard stop boundary | Keep **FAIL**; forbid E2; no fake complete; no new Session state; UX path **OPEN** only | P1 phases · Plan §5.2 |
| MX-16 | Model repeats prior ask | Validation | Reject; replan | Plan §4 |
| MX-17 | Model asks out of Blueprint | Validation | Reject; no silent scope expand | Plan §4.2 |
| MX-18 | Model invalid schema | Contract | Retry/repair once; no Answer Commit on fail | MC §4 |
| MX-19 | Duplicate client_turn_id (A) | Persist | Idempotent AnswerCommitResult replay | MC §5.1 |
| MX-20 | Persist fails after LLM (B) | Persist | No AskPayload shown; A kept; retry B | MC §5.2 |
| MX-21 | Blueprint version changes | Lifecycle | Merge seeds only; keep live DIR states; rebuild Understanding; Soft Gate; revalidate candidates | P2 Blueprint · Plan §6 · MC §5.6 |
| MX-22 | User reality ≠ pattern insight | insight_mismatch | Hypothesis/note; ask reality DIR; no chart-as-fact | US §2.4 |
| MX-23 | Profile missing / CFP calc fail | Source check | DDR-03 per P2; DDR-02 CFP miss → pending → P0 FAIL (Rule A) | P2 Rule A |
| MX-24 | Soft/Review Gate **PASS** | Soft→Review | Enter `understanding_review`; E2 after Freeze PASS | P1 §4.2 · Arch §3 |
| MX-25 | Soft/Review Gate **WARN** | Soft→Review | Enter review with disclosures; not disguised PASS | P1 §3.3 / §4.2 |
| MX-26 | Soft Gate **FAIL** + P0 gaps + soft budget **not** reached | Soft Gate | Stay `investigating`; continue Plan (P0 first) | P1 §1.3 · Arch §3 |
| MX-27 | Soft Gate **FAIL** + explicit user review | USER_REQUEST_REVIEW | Enter review with honest FAIL; E2 forbidden | P1 §1.3 |
| MX-28 | Soft budget reached; P0 still open | Soft budget | Emit `USER_REQUEST_REVIEW` → `understanding_review`; keep real FAIL; show P0 gaps; **do not** keep asking until hard | P1 §1.3 · Plan §5.2 · Arch §3 |
| MX-29 | DDR required source, no required DIR; `user_askable=true` | Plan + Validate | `source_only` NeedItem + CandidateQuestion with empty `dir_ids`, required `source_code`/`source_state`; §4.3 accepts (not reject for missing dir_ids) | US §2.3 · Plan §4.3 |
| MX-30 | DIR marked n_a without DC evidence | Understood / Gate | Invalid; exclude from satisfaction | US §2.7 · P1 §3.2 |
| MX-31 | Commit A done; LLM timeout in B | Persist | DC kept; CAS B; asked_count unchanged until shown | MC §5.4 / §5.7 |
| MX-32 | Two P1 candidates equal gain/depth/repetition | Plan sort | Stable tie-break: kind → dir/source → normalized ddr_ids → candidate_id | Plan §2.1 |
| MX-33 | Only P2 gaps after hard budget | Review | May enter review; P2 alone must not block report | P1 · Plan §5.2 |
| MX-34 | Soft budget hit; user later `USER_REVISE` | Lifecycle | Return `investigating`; DC kept; may ask under remaining hard | P1 §1.3 · Plan §5.2 |
| MX-35 | `source_only` + `user_askable=false` | Plan | No NL CandidateQuestion; NeedItem retained; supply UX / soft FAIL attribution | Plan §2 / §4.3 · US §2.3 |
| MX-36 | Validator mistakenly requires dir_ids on source_only | Validate | Spec forbids; §4.3 must accept empty dir_ids | Plan §4.3 |
| MX-37 | Duplicate Commit B same turn | Persist | Return same AskPayload; asked_count unchanged | MC §5.4 |
| MX-38 | Two late LLM results race on B | Persist | Atomic CAS; one valid AskPayload; loser discarded | MC §5.4 |
| MX-39 | AskPayload persisted, UI crash before show | Recovery | Resume loads same AskPayload; no regenerate | MC §5.4 / §5.7 |
| MX-40 | DC.version drifts before Commit B | Drift | Do not persist/show old NL; invalidate draft; re-Gate + replan on latest DC | MC §5.5 |
| MX-41 | Blueprint bumps between A and B | Blueprint | Seed merge only; no wipe live DIR; rebuild Understanding; Soft Gate; discard old NL | MC §5.6 · Plan §6 |
| MX-42 | n_a evidence wrong DIR / fails na_conditions | N/A validate | Reject n_a; exclude Gate satisfaction; reaggregate | US §2.7C |
| MX-43 | Invalid / model-inferred N/A marker | N/A validate | Reject; model_inferred cannot support n_a | US §2.7B |
| MX-44 | Legal N/A evidence later revoked | Rebuild | reaggregate clears illegal n_a; Understanding rebuild drops it | US §2.7D |
| MX-45 | Legal N/A in DC; Understanding cache cleared | Rebuild | Rebuild restores n_a UnderstoodItem from DC evidence | US §2.7D |
| MX-46 | dir_based vs source_only equal P1 gain | Plan sort | Deterministic via kind_rank then dir/source keys (no require dir_id on source_only) | Plan §2.1 |
| MX-47 | Same ddr set, different input order | Plan sort | Identical normalized_ddr_ids → identical order | Plan §2.1 |
| MX-48 | P0 low gain vs P1 high gain; P2 high gain vs P1 | Plan sort | P0 before P1; P1 before P2 regardless of gain | Plan §2.1 |

---

## AC3-4 Detailed R2 case cards

### MX-15 — Hard budget + P0 open

| | |
|---|---|
| **Given** | `asked_count ≥ hard_limit`; ≥1 P0 unsatisfied / pending |
| **When** | Engine evaluates termination |
| **Then** | Gate remains FAIL; E2 forbidden; no fake PASS/complete; Session ∈ Phase 1 states only; UX choice OPEN |
| **P1/2** | SM phases; Data Contract §11 |
| **P3** | Plan §5.2; Arch §3.2 step 6d |

### MX-28 — Soft budget + P0 open

| | |
|---|---|
| **Given** | Soft budget reached; P0 still open; Soft Gate FAIL |
| **When** | Post Soft Gate branch |
| **Then** | `USER_REQUEST_REVIEW` → `understanding_review`; review shows P0 gaps + FAIL; **no** further P0-only asks this path |
| **P1/2** | SM §1.3 `USER_REQUEST_REVIEW` |
| **P3** | Arch §3.2 6b; Plan §5.2 |

### MX-29 — source_only askable

| | |
|---|---|
| **Given** | DDR with required source, empty required DIRs; source not ok; `user_askable=true` |
| **When** | Expand + Validate |
| **Then** | NeedItem `source_only`; CandidateQuestion `kind=source_only`, `dir_ids=[]`, `source_code` set; §4.3 **accepts** |
| **P1/2** | P2 Required Source / empty DIR DDR |
| **P3** | US §2.3; Plan §1 / §4.3 |

### MX-34 — USER_REVISE after soft-budget review

| | |
|---|---|
| **Given** | Session in `awaiting_user_confirm` after soft-budget review; P0 still open |
| **When** | `USER_REVISE` |
| **Then** | → `investigating`; DC draft kept; version bump; may plan asks under remaining hard |
| **P1/2** | SM §1.3 |
| **P3** | Arch §3.3; Plan §5.2 |

### MX-37 / MX-38 / MX-39 — Commit B idempotency

| | |
|---|---|
| **Given** | Same `(session_id, client_turn_id)` |
| **When** | Duplicate B / dual LLM / crash after persist |
| **Then** | ≤1 valid AskPayload; CAS winner; resume shows persisted; asked_count not double-counted |
| **P3** | MC §5.4 / §5.7 |

### MX-40 / MX-41 — Drift & Blueprint

| | |
|---|---|
| **Given** | Version or Blueprint changes between plan and Commit B |
| **When** | Commit B |
| **Then** | Old NL not persisted; no bind to new DC; re-Gate + replan; Blueprint seed-merge only |
| **P3** | MC §5.5–§5.6; Plan §6 |

### MX-42–MX-45 — N/A protocol

| | |
|---|---|
| **Given** | Various evidence validity / revoke / rebuild |
| **When** | reaggregate + Understanding rebuild |
| **Then** | Only authority+na_conditions evidence yields Gate-countable n_a; model inference never; rebuild from DC |
| **P1/2** | P1 §3.2; P2 §1.5; Rule A |
| **P3** | US §2.7 |

### MX-32 / MX-46–MX-48 — Sort determinism

| | |
|---|---|
| **Given** | Equal or cross-class candidates |
| **When** | Sort §2.1 |
| **Then** | P0>P1>P2 hard; normalized ddr_ids; unified tie-break without requiring dir_id on source_only |
| **P3** | Plan §2.1 |

---

## AC3-5 Author consistency self-check

| # | Check | Result |
|---|---|---|
| 1 | Understanding derived only | **PASS** |
| 2 | Write authority matrix present | **PASS** |
| 3 | Answer classes ≥ required list | **PASS** |
| 4 | CandidateQuestion fields + kind validation | **PASS** |
| 5 | MX-01…48 present with G/W/T | **PASS** |
| 6 | Phase 2 Rule A referenced for MX-23 | **PASS** |
| 7 | Soft ≠ Review ≠ Freeze Gate | **PASS** |
| 8 | Two-phase persist; no LLM-in-TX; Commit B unique | **PASS** |
| 9 | Soft budget → review (Phase 1); not extend to hard | **PASS** |
| 10 | Deviations from Phase 1/2 | **0 intended** (OPEN = UX only) |
| 11 | Runtime code changed | **No** |

---

## Cross-doc consistency (R2 full pass)

| Topic | Arch | Plan | MC | US | AC | Consistent? |
|---|---|---|---|---|---|---|
| Soft budget → review | §3.2 6b | §5.2 | §5.2 | — | MX-28 | Yes |
| Soft FAIL + gaps (budget not hit) → keep investigating | §3.2 6c | §5.2 | — | — | MX-26 | Yes |
| Hard budget + P0 | §3.2 6d | §5.2 | — | — | MX-15 | Yes |
| source_only empty dir_ids | — | §1 / §4.3 | — | §2.3 | MX-29/35/36 | Yes |
| Commit B unique + CAS | §6 | — | §5.4 | — | MX-37–39 | Yes |
| Version drift safety closed | §6 | — | §5.5 | — | MX-40 | Yes |
| Blueprint seed-only merge | — | §6 | §5.6 | — | MX-21/41 | Yes |
| N/A authority + na_conditions | — | — | §3 / §6.8 | §2.7 | MX-30/42–45 | Yes |
| Sort + repetition_count | — | §2.1 | — | — | MX-32/46–48 | Yes |

---

## Unresolved / risks (OPEN product only)

1. Exact LLM prompt text — Phase 3.2+.  
2. Information-gain numeric constants — retunable; Gate unchanged.  
3. Lockout classifier owner — Phase 8.  
4. Runtime confirmFact promotion — Phase 3+ code.  
5. Multi-DIR single utterance goldenset — later.  
6. **OPEN:** hard-budget + P0 — investigating screen vs review CTA (Gate FAIL / no E2 fixed).  
7. **OPEN:** after version-drift safe abort — auto-replan once vs force client refresh.  
8. **OPEN:** non-askable source_only UX step count.  
9. **OPEN:** finer `repetition_count` reset mid-session beyond USER_REVISE supersede.

**Not OPEN:** soft budget lifecycle; Commit B uniqueness; drift safety protocol; N/A evidence rules; P0>P1>P2 sort.

---

## Phase 3.1 exit

When product PASSes this design PR:

- Stage 3.2 may implement Engine against these contracts.  
- **Do not** merge without product approval.  
- **Do not** start runtime work until approved.  
- **Do not** self-declare independent product PASS.

---

## Declaration

Stage 3.1-R2 design docs only. **No runtime code, schema, UI, prompt, or PageFeedMatrix changes.** Phase 1/2 frozen docs untouched.
