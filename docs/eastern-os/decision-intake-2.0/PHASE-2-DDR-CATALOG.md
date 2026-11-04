# Decision Intake 2.0 · Phase 2 DDR Instance Catalog

| Field | Value |
|---|---|
| **Document type** | Formal DDR definition catalog (docs only) |
| **Baseline** | `main` @ `1f1c111eb58d2aedfe6e79696131896c2f7f0264` (Phase 1 merged) |
| **PageFeedMatrix** | `.cursor/docs/decision-report/PageFeedMatrix-2026-10-27.md` (locked 2026-10-27) |
| **Phase 1 authority** | `PHASE-1-DATA-CONTRACT.md` §§3–4 (C3–C4) |
| **Catalog version** | `ddr_catalog_version = 1.1` (remediation: source-backed Gate) |

---

## 0. Purpose

This catalog defines **concrete report obligations** (DDR instances) for the locked eight-page report.  
Live DDR **status** is never stored here; it is **computed** at runtime per §1.3–§1.5 (extends Phase 1 §3.2 DIR rollup with **required source checks**).

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
| `required_sources` | `{ code, obligation }`[] | yes (may be empty) |
| `report_page_id` | `01`–`08` | yes |
| `report_section_id` | segment id (A/B/C/…) | yes |
| `completion_criteria` | string | yes |
| `affects_option_ranking` | boolean | yes (Page 05 / Gate P1 path) |
| `required_evidence_types` | enum[] | yes (legacy alias of sources + fact classes; keep for readability) |
| `missing_info_handling` | string | yes |
| `applicability` | rule id / prose | yes |
| `decision_critical` | boolean | yes (P1 FAIL vs WARN input) |

`required_sources.obligation`:

| Value | Meaning |
|---|---|
| `required` | Must be present+valid for DDR to leave `pending` toward `satisfied` (unless DDR `n_a`) |
| `optional` | Absence → degrade per PageFeedMatrix / completion_criteria; **never alone** blocks DDR satisfaction |
| `supporting` | Same as optional for Gate; may color prose only |

### 1.1 Empty `required_dir_ids`

Allowed **only** when the DDR is **source-backed** (has ≥1 `required_sources` with `obligation=required` or an explicit N/A path), e.g. `DDR-03-CHART-APPENDIX`.

**Hard rule:** `required_dir_ids=[]` is **never** automatically `satisfied`.  
Evaluation still requires §1.4 Required Source Check and/or explicit N/A evidence (Phase 1 `truly_unrequired` + `explicit_na_evidence`).

Empty ids **without** required-source satisfaction **and** without N/A evidence → `pending`.

### 1.2 Evidence type vocabulary

| Code | Meaning | Not |
|---|---|---|
| `definition` | DC.Definition fields | — |
| `reality_fact` | Confirmed / role-tagged RealityFacts | Hypotheses |
| `constraint` | Constraint records | Soft wishes as hard |
| `conflict` | Conflict state | Agenda covered |
| `hypothesis` | Explicit Hypothesis only | RealityFact |
| `cfp` | ChartFactPack / ProfileStructured BaZi slice | User biography invented from chart |
| `zfp` | `ZiweiFactPack` | Treated **optional** unless a DDR marks it `required` (none in v1.1) |
| `boundary` | `information_boundaries` disclosure | Fake completeness |

### 1.3 Source presence states (normative)

| State | Definition |
|---|---|
| `source_ok` | Artifact loaded, structurally valid for PageFeedMatrix slice use, provenance/hash available when Blueprint recorded expectation |
| `source_absent_not_supplied` | Required birth/profile inputs were never supplied by user → applicability path may allow DDR `n_a` **only with explicit evidence** |
| `source_calc_failed` | Inputs were present / expected, but calculation or load **failed** → **unresolved**; **never** silent `n_a` |
| `source_provenance_missing` | Artifact present but required provenance/hash unavailable when Blueprint `profile_binding` expected it → treat as **unresolved** (same Gate class as calc failed) |
| `source_optional_absent` | Optional source (e.g. ZFP) missing → degrade; do not fail DDR solely for this |

### 1.4 Normative evaluation order (Gate composer)

```text
1. DIR Rollup          — Phase 1 §3.2 on required_dir_ids / DC.dirs
                         (dangling, truly_unrequired, blocked, partial, pending, satisfied, n_a)
2. Required Source Check — §1.3 for each required_sources where obligation=required
3. Conflict Check      — related blockers (Phase 1); may force blocked
4. DDR Status compose  — merge DIR rollup + source check + conflicts (§1.5)
5. Sufficiency Gate    — Phase 1 §3.3 on composed DDR statuses (P0/P1/P2; dangling; ranking)
```

Phase 1 C1–C5 unchanged. P1 partial-dangling and ranking-impact rules **fully preserved**.

### 1.5 Composing DDR status after source check

Let `dir_status` = Phase 1 §3.2 result.  
Let `src` = worst state among **required** sources (`source_ok` best; unresolved = calc_failed | provenance_missing).

| Condition | Composed `ddr.status` |
|---|---|
| `dir_status = blocked` OR related conflict blocks | `blocked` |
| Any required source = `source_calc_failed` OR `source_provenance_missing` | `pending` (unresolved; **not** `n_a`) |
| `dir_status = n_a` with explicit N/A **and** no required-source unresolved | `n_a` |
| Empty dirs + required source `source_absent_not_supplied` + **explicit** N/A evidence | `n_a` |
| Empty dirs + no N/A evidence + required source not `source_ok` | `pending` |
| `dir_status ∈ {pending, partial}` | keep `dir_status` (sources cannot upgrade) |
| `dir_status = satisfied` **and** all required sources `source_ok` (optional may be absent) | `satisfied` |
| `dir_status = satisfied` **but** a required source not `source_ok` | `pending` (or `partial` if some dirs known and product marks partial — default **`pending`**) |

**Forbidden:** treating empty `required_dir_ids` as `satisfied` solely because DIR rollup has nothing to fail.

### 1.6 Source miss → Gate consequences

| Case | DDR composed | Gate |
|---|---|---|
| P0 required source missing/unresolved | not `satisfied`/`n_a` | **FAIL** |
| P1 required source missing/unresolved + ranking impact (`affects_option_ranking` **or** any linked DIR `may_affect_p5_ranking !== false` **or** `decision_critical`) | unsatisfied | **FAIL** |
| P1 required source missing/unresolved + **no** ranking impact + complete DIR resolve (`dangling===false`) + boundaries | unsatisfied | **WARN**-eligible |
| P2 required source missing/unresolved | unsatisfied | Must **not alone** block |
| Optional source missing | no status penalty alone | PASS/WARN/FAIL from other DDRs only |
| Explicit N/A with evidence | `n_a` | Terminal OK like `satisfied` for Gate tests |

### 1.7 Ranking flag interaction

| Flag | Layer | Use |
|---|---|---|
| DDR `affects_option_ranking` | DDR definition | If true, P1 unsatisfied → prefer FAIL path |
| DIR `may_affect_p5_ranking` | Live/seed DIR | Phase 1 §3.3 P1 WARN requires **every** linked active DIR `=== false` |
| `decision_critical` | DDR definition | If true, P1 unsatisfied → FAIL |

WARN still requires Phase 1: `dangling===false`, `|L|≥1`, `|L|===ids.length`, boundaries recorded. Empty/partial dangling never WARN.

---

## 2. Priority policy (aligned Phase 1 Gate)

| Priority | Role | Gate if unsatisfied (`∉ {satisfied,n_a}`) |
|---|---|---|
| **P0** | Without this, report cannot honestly answer the core decision | **FAIL** |
| **P1** | Material to conclusion / ranking; WARN only if non-ranking + complete DIR resolve + boundaries | FAIL or WARN per Phase 1 §3.3 + §1.6 |
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
| required_sources | `cfp:required`, `zfp:optional` |
| report_page_id / section | `02` / `A`+`C` |
| completion_criteria | DIRs known/N/A per roles; **CFP `source_ok` mandatory (Product Rule A)**; ZFP optional degrade |
| affects_option_ranking | false |
| required_evidence_types | reality_fact, definition, cfp (required), zfp (optional) |
| missing_info_handling | DIRs open → pending/partial; CFP missing/failed → pending → **P0 FAIL** at Gate; ZFP absent OK |
| applicability | Always (paid report expects birth profile for attribution) |
| decision_critical | false |

**Product Rule A (closed):** CFP is **mandatory** for `DDR-02-ATTRIBUTION`. Gate composer **must** run Required Source Check; DIR rollup alone is insufficient. Missing CFP while ordinary DIRs are satisfied ⇒ composed status **not** `satisfied` ⇒ P0 **FAIL**.

#### `DDR-02-SCIENCE-BRIDGE`

| Field | Value |
|---|---|
| name | Executable mechanism bridge |
| purpose | Bridge case facts to actionable scientific/process hooks (report face 02-B / feeds P3 language later) |
| decision_question | What case-specific mechanisms should action design respect? |
| priority | **P1** |
| required_dir_ids | `DIR-DEF-QUESTION`, `DIR-OPT-CONSTRAINTS`, `DIR-VALIDATION-CAPACITY` |
| required_sources | _(none)_ — CFP/ZFP **not** required |
| report_page_id / section | `02` / `B` |
| completion_criteria | Question known; constraints or validation capacity known or bounded |
| affects_option_ranking | false |
| required_evidence_types | reality_fact, constraint, boundary |
| missing_info_handling | WARN-eligible if DIRs non-ranking + boundaries + no dangling; else FAIL |
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
| required_sources | `cfp:required`, `zfp:optional` |
| report_page_id / section | `03` / `A`+`B`+`C` |
| completion_criteria | See **§3.3.1** source evaluation table |
| affects_option_ranking | false |
| required_evidence_types | cfp (required), zfp (optional) |
| missing_info_handling | Per §3.3.1; P2 alone must not block Gate |
| applicability | Always considered; N/A only via explicit not-supplied evidence |
| decision_critical | false |

##### 3.3.1 `DDR-03` source evaluation (normative)

| CFP condition | ZFP condition | DDR-03 status | Notes |
|---|---|---|---|
| `source_ok` | `source_ok` or `source_optional_absent` | **`satisfied`** | ZFP absence alone **never** blocks completion |
| `source_absent_not_supplied` + **explicit** N/A evidence (no birth/profile supplied) | any | **`n_a`** | Not silence; evidence required |
| `source_absent_not_supplied` **without** N/A evidence | any | **`pending`** | Empty DIR list ≠ auto N/A / auto satisfied |
| `source_calc_failed` | any | **`pending`** | Never silent N/A |
| `source_provenance_missing` | any | **`pending`** | Unresolved |
| Empty `required_dir_ids` + no source check | — | **Illegal composition** | Must run §1.4 step 2 |

Representation without violating Phase 1 empty-DIR rules:

- DIR rollup sees `truly_unrequired` (`ids.length===0`) → does **not** yield `satisfied`.  
- Satisfaction comes **only** from Required Source Check (`cfp:required` → `source_ok`) **or** explicit N/A evidence path.  
- Live chart blobs stay on Blueprint `profile_binding` / calc packs — **not** as RealityFacts and **not** as a second DIR SoT.

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

**Required-source DDRs (v1.1):**

| DDR | Required sources | Optional |
|---|---|---|
| `DDR-02-ATTRIBUTION` | CFP | ZFP |
| `DDR-03-CHART-APPENDIX` | CFP | ZFP |

Other DDRs: no required calc sources in v1.1 (`cfp`/`zfp` in evidence lists are supporting/optional only unless listed above).

---

## 5. Gaps (honest)

1. Exact FEED field codes remain in PageFeedMatrix; DDR does not duplicate CFP/ZFP schemas.  
2. Runtime Gate composer implementing §1.4 = Phase 3+ (spec closed here).  
3. Topic classifier implementation still later.  
4. No runtime `lib/decision-intake/` in this phase.

---

## 6. Declaration

Docs only. Preserves Phase 1 C1–C5. No PageFeedMatrix edits. No Call A/B Intake entry.
