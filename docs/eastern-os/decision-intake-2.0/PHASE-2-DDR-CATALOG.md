# Decision Intake 2.0 · Phase 2 DDR Instance Catalog

| Field | Value |
|---|---|
| **Document type** | Formal DDR definition catalog (docs only) |
| **Baseline** | `main` @ `1f1c111eb58d2aedfe6e79696131896c2f7f0264` (Phase 1 merged) |
| **PageFeedMatrix** | `.cursor/docs/decision-report/PageFeedMatrix-2026-10-27.md` (locked 2026-10-27) |
| **Phase 1 authority** | `PHASE-1-DATA-CONTRACT.md` §§3–4 (C3–C4) |
| **Catalog version** | `ddr_catalog_version = 1` |

---

## 0. Purpose

This catalog defines **concrete report obligations** (DDR instances) for the locked eight-page report.  
Live DDR **status** is never stored here; it is **computed** at runtime from `DC.dirs` + blockers per Phase 1 §3.2.

**Non-goals:** runtime engine, Call A/B entry, fixed question lists, Agenda-as-sufficiency.

---

## 1. Schema (definition record)

Each DDR definition record:

| Field | Type | Required |
|---|---|---|
| `ddr_id` | stable string | yes |
| `name` | string | yes |
| `purpose` | string | yes |
| `decision_question` | string (what this deliverable must answer) | yes |
| `priority` | `P0` \| `P1` \| `P2` | yes |
| `required_dir_ids` | string[] (refs into DIR catalog) | yes (may be `[]` only if §1.1) |
| `report_page_id` | `01`–`08` | yes |
| `report_section_id` | segment id (A/B/C/…) | yes |
| `completion_criteria` | string | yes |
| `affects_option_ranking` | boolean | yes (Page 05 / Gate P1 path) |
| `required_evidence_types` | enum[] | yes |
| `missing_info_handling` | string | yes |
| `applicability` | rule id / prose | yes |
| `decision_critical` | boolean | yes (P1 FAIL vs WARN input) |

### 1.1 Empty `required_dir_ids`

Allowed **only** when:

1. `required_evidence_types` includes calc/profile sources (`cfp` / `zfp`) **and** no user RealityFact is needed for that deliverable (e.g. appendix 03), **or**
2. Explicit N/A applicability with evidence (Phase 1 `truly_unrequired`).

Empty ids **without** N/A evidence → status `pending` (Phase 1). P0 must not rely on empty-ids pending.

### 1.2 Evidence type vocabulary

| Code | Meaning | Not |
|---|---|---|
| `definition` | DC.Definition fields | — |
| `reality_fact` | Confirmed / role-tagged RealityFacts | Hypotheses |
| `constraint` | Constraint records | Soft wishes as hard |
| `conflict` | Conflict state | Agenda covered |
| `hypothesis` | Explicit Hypothesis only | RealityFact |
| `cfp` | ChartFactPack / ProfileStructured BaZi slice | User biography invented from chart |
| `zfp` | `ZiweiFactPack` | Required when pack absent (omit/degrade per PageFeedMatrix) |
| `boundary` | `information_boundaries` disclosure | Fake completeness |

---

## 2. Priority policy (aligned Phase 1 Gate)

| Priority | Role | Gate if unsatisfied (`∉ {satisfied,n_a}`) |
|---|---|---|
| **P0** | Without this, report cannot honestly answer the core decision | **FAIL** |
| **P1** | Material to conclusion / ranking; WARN only if non-ranking + complete DIR resolve + boundaries | FAIL or WARN per Phase 1 §3.3 |
| **P2** | Enrichment / appendix / conditional depth | Must **not alone** block report |

---

## 3. Instance catalog (`ddr_catalog_version = 1`)

IDs are stable. Do not renumber; deprecate + supersede if needed later.

### 3.1 Page 01 — Direct answer / decision frame

#### `DDR-01-PRIMARY`

| Field | Value |
|---|---|
| name | Primary recommendation |
| purpose | State the preferred decision path for this user and situation |
| decision_question | What should the user primarily do / choose now? |
| priority | **P0** |
| required_dir_ids | `DIR-DEF-QUESTION`, `DIR-DEF-OUTCOME`, `DIR-OPT-ON-TABLE`, `DIR-STATUS-QUO` |
| report_page_id / section | `01` / `A` |
| completion_criteria | Definition.decision_question + desired_outcome known; ≥1 option-on-table fact confirmed; status-quo baseline confirmed or explicit N/A |
| affects_option_ranking | true |
| required_evidence_types | definition, reality_fact, cfp (support), zfp (optional) |
| missing_info_handling | Keep DDR pending/partial; do not invent preferred path; Gate FAIL if still open at freeze |
| applicability | Always for paid decision report |
| decision_critical | true |

#### `DDR-01-HOLD-CONDITIONS`

| Field | Value |
|---|---|
| name | Hold / validity conditions |
| purpose | State when the primary recommendation remains valid |
| decision_question | Under what conditions does the primary path still hold? |
| priority | **P0** |
| required_dir_ids | `DIR-DEF-STAKES`, `DIR-OPT-CONSTRAINTS`, `DIR-TIMING-WINDOW` |
| report_page_id / section | `01` / `B` |
| completion_criteria | Stakes + ≥1 hard/soft constraint confirmed or N/A; timing window known or explicit open-ended boundary |
| affects_option_ranking | true |
| required_evidence_types | definition, reality_fact, constraint |
| missing_info_handling | Boundary disclosure; P0 FAIL if missing at freeze without N/A |
| applicability | Always |
| decision_critical | true |

#### `DDR-01-ANTI-PATH`

| Field | Value |
|---|---|
| name | Anti-path / what not to choose |
| purpose | Name paths to avoid given this DC |
| decision_question | What should the user not choose as primary? |
| priority | **P0** |
| required_dir_ids | `DIR-OPT-ON-TABLE`, `DIR-DEF-UNACCEPTABLE` |
| report_page_id / section | `01` / `C` |
| completion_criteria | Unacceptable outcomes known; options set allows contrast (≥1 anti or explicit single-option N/A) |
| affects_option_ranking | true |
| required_evidence_types | definition, reality_fact, conflict (if present) |
| missing_info_handling | Pending until options/unacceptable known |
| applicability | Always |
| decision_critical | true |

---

### 3.2 Page 02 — Foundation / attribution

#### `DDR-02-ATTRIBUTION`

| Field | Value |
|---|---|
| name | Why this path (attribution) |
| purpose | Explain mechanism in user-facing terms grounded in confirmed facts + chart structure |
| decision_question | Why does this recommendation fit this person/situation? |
| priority | **P0** |
| required_dir_ids | `DIR-DEF-QUESTION`, `DIR-STATUS-QUO`, `DIR-PAST-ATTEMPTS` |
| report_page_id / section | `02` / `A`+`C` |
| completion_criteria | Question + status quo known; past attempts known or N/A with evidence; CFP available for structure anchors |
| affects_option_ranking | false |
| required_evidence_types | reality_fact, definition, cfp, zfp (optional) |
| missing_info_handling | Partial OK until freeze; P0 needs question+status quo |
| applicability | Always |
| decision_critical | false |

#### `DDR-02-SCIENCE-BRIDGE`

| Field | Value |
|---|---|
| name | Executable mechanism bridge |
| purpose | Bridge case facts to actionable scientific/process hooks (report face 02-B / feeds P3 language later) |
| decision_question | What case-specific mechanisms should action design respect? |
| priority | **P1** |
| required_dir_ids | `DIR-DEF-QUESTION`, `DIR-OPT-CONSTRAINTS`, `DIR-VALIDATION-CAPACITY` |
| report_page_id / section | `02` / `B` |
| completion_criteria | Question known; constraints or validation capacity known or bounded |
| affects_option_ranking | false |
| required_evidence_types | reality_fact, constraint, boundary |
| missing_info_handling | WARN-eligible if DIRs non-ranking + boundaries; else FAIL |
| applicability | Always |
| decision_critical | false |

---

### 3.3 Page 03 — Personal pattern appendix

#### `DDR-03-CHART-APPENDIX`

| Field | Value |
|---|---|
| name | Personal decision-pattern appendix |
| purpose | Present BaZi (+ ZiWei when available) structure appendix only |
| decision_question | What chart-structure pattern package accompanies this decision? |
| priority | **P2** |
| required_dir_ids | `[]` |
| report_page_id / section | `03` / `A`+`B`+`C` |
| completion_criteria | Valid birth profile → CFP (`ProfileStructured` / ChartFactPack fields used by PageFeedMatrix). ZFP omit-OK if unavailable. **No RealityFact required.** |
| affects_option_ranking | false |
| required_evidence_types | cfp, zfp (optional) |
| missing_info_handling | If no birth data: mark DDR `n_a` with explicit profile-missing evidence — never invent chart. Does not alone block Gate (P2). |
| applicability | Emit when birth data present; else explicit N/A |
| decision_critical | false |

**Phase 2 note:** Status for source-only DDR uses Phase 1 empty-ids rules: with birth data, treat as `truly_unrequired` for DIR purposes **and** completion via `required_evidence_types` check in Gate composer (implementation Phase 3+). Documented gap if engine only implements DIR rollup — must add source-presence check for this DDR.

---

### 3.4 Page 04 — Risks / blockers

#### `DDR-04-BLOCKERS`

| Field | Value |
|---|---|
| name | Named blockers and force-through cost |
| purpose | Name decision blockers and what happens if forced |
| decision_question | What blocks the preferred path, and what if the user pushes through? |
| priority | **P1** |
| required_dir_ids | `DIR-OPT-CONSTRAINTS`, `DIR-RISK-TOLERANCE`, `DIR-OPT-IRREV` |
| report_page_id / section | `04` / `A`+`B`+`C` |
| completion_criteria | ≥1 constraint or explicit no-hard-constraint N/A; irreversibility known or N/A; risk tolerance known or bounded |
| affects_option_ranking | true |
| required_evidence_types | constraint, reality_fact, conflict |
| missing_info_handling | Decision-critical → FAIL if open; boundaries if soft-only |
| applicability | Always |
| decision_critical | true |

---

### 3.5 Page 05 — Options / ranking

#### `DDR-05-RANKING`

| Field | Value |
|---|---|
| name | Preferred / alternate / caution ranking |
| purpose | Rank options with preferred, alternate, caution |
| decision_question | How should options be ranked for this user now? |
| priority | **P0** |
| required_dir_ids | `DIR-OPT-ON-TABLE`, `DIR-DEF-PRIORITIES`, `DIR-DEF-OUTCOME`, `DIR-OPT-CONSTRAINTS` |
| report_page_id / section | `05` / `A`+`B`+`C` |
| completion_criteria | ≥2 options **or** single-option with explicit solo evidence; priorities + outcome known; constraints known or N/A |
| affects_option_ranking | true |
| required_evidence_types | reality_fact, definition, constraint, cfp (pathTags support) |
| missing_info_handling | P0 FAIL if options/priorities missing |
| applicability | Always |
| decision_critical | true |

#### `DDR-05-SWITCH-STOP`

| Field | Value |
|---|---|
| name | Switch / stop criteria |
| purpose | When to change track or stop |
| decision_question | When should the user switch path or stop? |
| priority | **P1** |
| required_dir_ids | `DIR-EXIT-CRITERIA`, `DIR-TIMING-WINDOW`, `DIR-RISK-TOLERANCE` |
| report_page_id / section | `05` / `D` |
| completion_criteria | Exit criteria known or explicit open boundary; timing known or bounded |
| affects_option_ranking | true |
| required_evidence_types | reality_fact, constraint, boundary |
| missing_info_handling | Ranking-impact → FAIL unless complete non-ranking exception (not applicable here) |
| applicability | Always |
| decision_critical | true |

---

### 3.6 Page 06 — Validation / near steps

#### `DDR-06-VALIDATION`

| Field | Value |
|---|---|
| name | Near-term validation experiment |
| purpose | Define low-cost checks before irreversible commitment |
| decision_question | What can be validated soon at low cost? |
| priority | **P1** |
| required_dir_ids | `DIR-VALIDATION-CAPACITY`, `DIR-OPT-IRREV`, `DIR-DEF-OUTCOME` |
| report_page_id / section | `06` / `A`+`B` |
| completion_criteria | Validation capacity known or N/A (nothing testable) with evidence; irreversibility known |
| affects_option_ranking | false |
| required_evidence_types | reality_fact, constraint, boundary |
| missing_info_handling | WARN-eligible with boundaries when DIRs `may_affect_p5_ranking=false` |
| applicability | Always |
| decision_critical | false |

#### `DDR-06-RHYTHM`

| Field | Value |
|---|---|
| name | Rhythm / pacing reminder |
| purpose | Near-window pacing aligned to case + climate tags |
| decision_question | What pacing should the user respect in the near window? |
| priority | **P2** |
| required_dir_ids | `DIR-TIMING-WINDOW` |
| report_page_id / section | `06` / `C`+`D` |
| completion_criteria | Timing window known or N/A open-ended |
| affects_option_ranking | false |
| required_evidence_types | reality_fact, cfp, zfp (optional) |
| missing_info_handling | Soft degrade; P2 |
| applicability | Always when timing DIR active |
| decision_critical | false |

---

### 3.7 Page 07 — Topic deep dive (conditional)

#### `DDR-07-TOPIC-DEPTH`

| Field | Value |
|---|---|
| name | Topic-relevant deep dive |
| purpose | Extra depth only when topic applicability requires it |
| decision_question | What topic-specific field/relationship facts change the judgment? |
| priority | **P1** when seeded; **N/A** when not applicable |
| required_dir_ids | Topic pack (see Topic Applicability): at least one of `DIR-REL-DYNAMICS`, `DIR-JOB-OFFER`, `DIR-BIZ-MODEL`, `DIR-LOCALE-MOVE`, `DIR-EDU-PATH` |
| report_page_id / section | `07` / `A`+`B` |
| completion_criteria | If applicable: topic DIR known or bounded. If not applicable: DDR `n_a` with explicit topic-skip evidence |
| affects_option_ranking | true when relationship/career/biz stakes change ranking |
| required_evidence_types | reality_fact, constraint, zfp (otherChart optional) |
| missing_info_handling | If seeded and open → P1 Gate rules; if not seeded → do not emit page 07 |
| applicability | **Conditional** — only seed when Topic Applicability marks `page_07_emit=true` |
| decision_critical | true when `page_07_emit=true` |

---

### 3.8 Page 08 — Signals / close

#### `DDR-08-BOUNDARIES`

| Field | Value |
|---|---|
| name | Red lights, review questions, rerun triggers |
| purpose | Close with fail-safes and when to re-run Intake |
| decision_question | What are the red lights and when should the user re-decide? |
| priority | **P0** |
| required_dir_ids | `DIR-EXIT-CRITERIA`, `DIR-DEF-UNACCEPTABLE`, `DIR-RISK-TOLERANCE` |
| report_page_id / section | `08` / `A`+`B`+`C` |
| completion_criteria | Exit + unacceptable known or explicit boundaries listed for freeze |
| affects_option_ranking | false |
| required_evidence_types | reality_fact, constraint, boundary, conflict |
| missing_info_handling | P0 FAIL without exit/unacceptable or documented boundaries covering them |
| applicability | Always |
| decision_critical | true |

---

## 4. Catalog inventory

| Priority | Count | IDs |
|---|---|---|
| P0 | 6 | `DDR-01-PRIMARY`, `DDR-01-HOLD-CONDITIONS`, `DDR-01-ANTI-PATH`, `DDR-02-ATTRIBUTION`, `DDR-05-RANKING`, `DDR-08-BOUNDARIES` |
| P1 | 5 | `DDR-02-SCIENCE-BRIDGE`, `DDR-04-BLOCKERS`, `DDR-05-SWITCH-STOP`, `DDR-06-VALIDATION`, `DDR-07-TOPIC-DEPTH` (when seeded) |
| P2 | 2 | `DDR-03-CHART-APPENDIX`, `DDR-06-RHYTHM` |
| **Total** | **13** | |

Page coverage: `01,02,03,04,05,06,07,08` — order unchanged. Page 03 appendix; Page 07 conditional.

---

## 5. Gaps (honest)

1. **Source-only satisfaction** for `DDR-03-CHART-APPENDIX` needs Gate composer extension beyond pure DIR rollup (documented above).  
2. Exact FEED field codes remain in PageFeedMatrix; DDR does not duplicate CFP/ZFP schemas.  
3. No runtime `lib/decision-intake/` in this phase.

---

## 6. Declaration

Docs only. Preserves Phase 1 C1–C5. No PageFeedMatrix edits. No Call A/B Intake entry.
