# Decision Intake 2.0 · Phase 2 DIR Definition Catalog

| Field | Value |
|---|---|
| **Document type** | Formal DIR **definition** catalog (not live state) |
| **Baseline** | `main` @ `1f1c111e` |
| **Live SoT** | **`DC.dirs` only** (Phase 1 C3) — this file never stores `current_state` |
| **Code alignment** | `lib/poju/decision-context/types.ts` `DIR` fields |
| **Catalog version** | `dir_catalog_version = 1` |

---

## 0. Purpose

Reusable **information requirement definitions** that DDRs reference by `dir_id`.  
Blueprint seeds copies of need/why/roles into `DC.dirs` (immutable seed snapshot on Blueprint; **live** state only on DC).

Agenda `covered` never proves DIR `known`.

---

## 1. Definition schema

| Field | Maps to live `DIR` | Notes |
|---|---|---|
| `dir_id` | `dir_id` | Stable |
| `need` | `need` | What info is needed |
| `why` | `why` | Why it matters for judgment |
| `category` | `category` | `definition` \| `options` \| `constraints` \| `timing` \| `risk` \| `validation` \| `topic` |
| `required_fact_roles` | `required_fact_roles` | Aggregation roles for `dir-aggregator.ts` |
| `permitted_sources` | (definition only) | `user_asserted` \| `user_estimate` \| `independently_verified` \| `constraint` \| never `inferred` |
| `confirmation_policy` | — | When E1 FactConfirm required for `known` |
| `na_conditions` | — | When DIR may become `n_a` with evidence |
| `may_affect_p5_ranking` | `may_affect_p5_ranking` | Explicit boolean |
| `sufficient_evidence` | — | What makes DIR `known` |
| `unresolved_when` | — | unknown / declined / conflict residual |
| `default_serves_face` | `serves_face` seed | Page id hint |
| `topic_tags` | — | Applicability filters |

**Forbidden in this catalog:** `current_state`, `agenda_item_ids`, `partial_satisfaction`, evidence links.

---

## 2. Fact role vocabulary (for `required_fact_roles`)

Stable role tags writers may put on `RealityFact.fact_roles` / constraints:

| Role | Meaning |
|---|---|
| `decision_question` | Formal decision question text |
| `desired_outcome` | Desired outcome |
| `stakes` | What is at stake |
| `goal_priority` | Ordered priorities |
| `unacceptable` | Unacceptable outcomes |
| `option` | An option on the table |
| `status_quo` | Current baseline |
| `hard_constraint` | Money/time/duty hard limit |
| `soft_constraint` | Preference constraint |
| `timing_window` | When decision must land |
| `irreversibility` | Switching cost / lock-in |
| `past_attempt` | Prior try / lesson |
| `risk_tolerance` | Absorbable downside |
| `exit_criterion` | Stop/pivot trigger |
| `validation_capacity` | What can be tested cheaply |
| `stakeholder` | Affected person/party |
| `rel_dynamic` | Relationship interaction fact |
| `job_offer` | Employment offer fact |
| `biz_model` | Venture/business fact |
| `locale_move` | Relocation fact |
| `edu_path` | Education/development fact |

---

## 3. Core DIR instances

### 3.1 Definition family

#### `DIR-DEF-QUESTION`

| Field | Value |
|---|---|
| need | Clear decision question in user language |
| why | Without it, page 01/02/08 cannot frame the case |
| category | definition |
| required_fact_roles | `decision_question` |
| permitted_sources | user_asserted (preferred); independently_verified rare |
| confirmation_policy | E1 required for `known` when user_asserted |
| na_conditions | Never N/A for paid decision Intake |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | Confirmed fact/definition field stating a single actionable question |
| unresolved_when | unknown/declined → report cannot PASS |
| default_serves_face | `01` |
| topic_tags | `*` |

#### `DIR-DEF-OUTCOME`

| Field | Value |
|---|---|
| need | Desired outcome |
| why | Ranks options and hold conditions |
| category | definition |
| required_fact_roles | `desired_outcome` |
| permitted_sources | user_asserted; user_estimate only with boundary (not hard ranking alone) |
| confirmation_policy | E1 for asserted; estimates stay unverified |
| na_conditions | Never for P0 DDRs referencing it |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | Confirmed desired outcome statement |
| unresolved_when | unknown → P0 DDRs pending |
| default_serves_face | `01` |
| topic_tags | `*` |

#### `DIR-DEF-STAKES`

| Field | Value |
|---|---|
| need | What is at stake if wrong |
| why | Hold conditions + risk pages |
| category | definition |
| required_fact_roles | `stakes` |
| permitted_sources | user_asserted; user_estimate with boundary |
| confirmation_policy | E1 preferred |
| na_conditions | Only if user explicitly states stakes unknowable + boundary (rare) |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | Confirmed stakes statement |
| unresolved_when | unknown → DDR-01-HOLD partial/pending |
| default_serves_face | `01` |
| topic_tags | `*` |

#### `DIR-DEF-PRIORITIES`

| Field | Value |
|---|---|
| need | Goal priority order |
| why | Page 05 ranking |
| category | definition |
| required_fact_roles | `goal_priority` |
| permitted_sources | user_asserted |
| confirmation_policy | E1 |
| na_conditions | Never when DDR-05-RANKING active |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | ≥1 confirmed priority or ordered list |
| unresolved_when | unknown → ranking DDR pending |
| default_serves_face | `05` |
| topic_tags | `*` |

#### `DIR-DEF-UNACCEPTABLE`

| Field | Value |
|---|---|
| need | Outcomes the user will not accept |
| why | Anti-path + page 08 red lights |
| category | definition |
| required_fact_roles | `unacceptable` |
| permitted_sources | user_asserted |
| confirmation_policy | E1 |
| na_conditions | Explicit “no hard red lines” with evidence → n_a |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | Confirmed list or confirmed empty-red-line N/A |
| unresolved_when | unknown → P0 DDR-08 / anti-path pending |
| default_serves_face | `08` |
| topic_tags | `*` |

---

### 3.2 Options / situation family

#### `DIR-OPT-ON-TABLE`

| Field | Value |
|---|---|
| need | Options currently under consideration |
| why | Primary, anti-path, ranking |
| category | options |
| required_fact_roles | `option` |
| permitted_sources | user_asserted; independently_verified |
| confirmation_policy | E1 per option fact |
| na_conditions | Never (at least status quo vs change) |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | ≥1 confirmed option; solo-option needs explicit solo evidence for ranking DDR |
| unresolved_when | unknown/declined → P0 FAIL path |
| default_serves_face | `05` |
| topic_tags | `*` |

#### `DIR-STATUS-QUO`

| Field | Value |
|---|---|
| need | Current baseline state |
| why | Attribution + primary path contrast |
| category | options |
| required_fact_roles | `status_quo` |
| permitted_sources | user_asserted |
| confirmation_policy | E1 |
| na_conditions | Rare; only if user has no current state (e.g. pure future) + evidence |
| may_affect_p5_ranking | **false** |
| sufficient_evidence | Confirmed baseline statement |
| unresolved_when | unknown → attribution partial |
| default_serves_face | `02` |
| topic_tags | `*` |

#### `DIR-OPT-CONSTRAINTS`

| Field | Value |
|---|---|
| need | Hard/soft constraints (money, time, duties, legal) |
| why | Hold conditions, blockers, ranking |
| category | constraints |
| required_fact_roles | `hard_constraint`, `soft_constraint` |
| permitted_sources | user_asserted; independently_verified |
| confirmation_policy | E1; Constraint.rigidity honored |
| na_conditions | Explicit “no material constraints” confirmed → n_a |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | ≥1 confirmed constraint **or** confirmed none |
| unresolved_when | unknown → P0/P1 DDRs pending |
| default_serves_face | `04` |
| topic_tags | `*` |

#### `DIR-OPT-IRREV`

| Field | Value |
|---|---|
| need | Irreversibility / switching cost |
| why | Validation design + force-through cost |
| category | risk |
| required_fact_roles | `irreversibility` |
| permitted_sources | user_asserted; user_estimate with boundary |
| confirmation_policy | E1 for hard claims |
| na_conditions | Explicit fully reversible + evidence → n_a |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | Confirmed irreversibility statement or N/A |
| unresolved_when | unknown → validation/blocker DDRs open |
| default_serves_face | `04` |
| topic_tags | `*` |

#### `DIR-PAST-ATTEMPTS`

| Field | Value |
|---|---|
| need | Prior attempts and lessons |
| why | Attribution honesty |
| category | options |
| required_fact_roles | `past_attempt` |
| permitted_sources | user_asserted |
| confirmation_policy | E1 |
| na_conditions | First-time decision with evidence → n_a |
| may_affect_p5_ranking | **false** |
| sufficient_evidence | Confirmed history or N/A |
| unresolved_when | unknown → boundary on 02 |
| default_serves_face | `02` |
| topic_tags | `*` |

#### `DIR-TIMING-WINDOW`

| Field | Value |
|---|---|
| need | Decision / action timing window |
| why | Hold conditions, switch/stop, rhythm |
| category | timing |
| required_fact_roles | `timing_window` |
| permitted_sources | user_asserted; user_estimate |
| confirmation_policy | E1 for hard deadlines |
| na_conditions | Explicit open-ended timing → n_a with evidence |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | Confirmed window or N/A open-ended |
| unresolved_when | unknown → P0 hold / P1 switch open |
| default_serves_face | `01` |
| topic_tags | `*` |

---

### 3.3 Risk / validation family

#### `DIR-RISK-TOLERANCE`

| Field | Value |
|---|---|
| need | Downside the user can absorb |
| why | Blockers, switch/stop, page 08 |
| category | risk |
| required_fact_roles | `risk_tolerance` |
| permitted_sources | user_asserted; user_estimate with boundary |
| confirmation_policy | E1 preferred |
| na_conditions | Not N/A by silence |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | Confirmed tolerance statement |
| unresolved_when | unknown/declined → P1/P0 paths open |
| default_serves_face | `08` |
| topic_tags | `*` |

#### `DIR-EXIT-CRITERIA`

| Field | Value |
|---|---|
| need | When to stop or pivot |
| why | Page 05-D and 08 |
| category | risk |
| required_fact_roles | `exit_criterion` |
| permitted_sources | user_asserted |
| confirmation_policy | E1 |
| na_conditions | Explicit “no exit, all-in” with evidence (still ranking-critical) |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | Confirmed exit triggers or confirmed all-in |
| unresolved_when | unknown → P0 DDR-08 / P1 switch pending |
| default_serves_face | `08` |
| topic_tags | `*` |

#### `DIR-VALIDATION-CAPACITY`

| Field | Value |
|---|---|
| need | What can be tested cheaply before lock-in |
| why | Page 06 validation |
| category | validation |
| required_fact_roles | `validation_capacity` |
| permitted_sources | user_asserted; user_estimate |
| confirmation_policy | E1 for capacity claims |
| na_conditions | Nothing testable + evidence → n_a |
| may_affect_p5_ranking | **false** |
| sufficient_evidence | Confirmed capacity or N/A |
| unresolved_when | unknown → WARN-eligible for DDR-06-VALIDATION |
| default_serves_face | `06` |
| topic_tags | `*` |

#### `DIR-STAKEHOLDERS`

| Field | Value |
|---|---|
| need | Key affected parties |
| why | Constraints, conflicts, sometimes 07 |
| category | options |
| required_fact_roles | `stakeholder` |
| permitted_sources | user_asserted |
| confirmation_policy | E1 |
| na_conditions | Solo decision with evidence → n_a |
| may_affect_p5_ranking | **false** (true if topic pack promotes) |
| sufficient_evidence | Confirmed list or N/A |
| unresolved_when | unknown → boundary |
| default_serves_face | `04` |
| topic_tags | `*` |

---

### 3.4 Topic pack DIRs (conditional seed)

#### `DIR-REL-DYNAMICS`

| Field | Value |
|---|---|
| need | Relationship / interaction facts material to the decision |
| why | Page 07 when relationship topic |
| category | topic |
| required_fact_roles | `rel_dynamic` |
| permitted_sources | user_asserted |
| confirmation_policy | E1; chart must not invent behavior |
| na_conditions | Topic not relationship → DIR not seeded |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | Confirmed interaction constraints/facts |
| unresolved_when | unknown → DDR-07 pending if seeded |
| default_serves_face | `07` |
| topic_tags | `relationship` |

#### `DIR-JOB-OFFER`

| Field | Value |
|---|---|
| need | Employment offer / role change facts |
| why | Career page 07 / ranking |
| category | topic |
| required_fact_roles | `job_offer` |
| permitted_sources | user_asserted; independently_verified |
| confirmation_policy | E1 |
| na_conditions | Not career topic → not seeded |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | Confirmed offer/role facts |
| unresolved_when | unknown → DDR-07 / ranking impact |
| default_serves_face | `07` |
| topic_tags | `career` |

#### `DIR-BIZ-MODEL`

| Field | Value |
|---|---|
| need | Venture model / capital / runway facts |
| why | Entrepreneurship depth |
| category | topic |
| required_fact_roles | `biz_model` |
| permitted_sources | user_asserted; user_estimate with boundary |
| confirmation_policy | E1 for hard numbers preferred |
| na_conditions | Not entrepreneurship → not seeded |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | Confirmed model/runway facts or bounded estimates |
| unresolved_when | unknown → DDR-07 pending |
| default_serves_face | `07` |
| topic_tags | `entrepreneurship` |

#### `DIR-LOCALE-MOVE`

| Field | Value |
|---|---|
| need | Relocation destination / visa / household facts |
| why | Relocation depth |
| category | topic |
| required_fact_roles | `locale_move` |
| permitted_sources | user_asserted |
| confirmation_policy | E1 |
| na_conditions | Not relocation → not seeded |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | Confirmed move facts |
| unresolved_when | unknown → DDR-07 pending |
| default_serves_face | `07` |
| topic_tags | `relocation` |

#### `DIR-EDU-PATH`

| Field | Value |
|---|---|
| need | Education/program facts |
| why | Education topic depth |
| category | topic |
| required_fact_roles | `edu_path` |
| permitted_sources | user_asserted |
| confirmation_policy | E1 |
| na_conditions | Not education → not seeded |
| may_affect_p5_ranking | **true** |
| sufficient_evidence | Confirmed program facts |
| unresolved_when | unknown → DDR-07 pending |
| default_serves_face | `07` |
| topic_tags | `education` |

---

## 4. Inventory

| Family | Count | IDs |
|---|---|---|
| Definition | 5 | DEF-QUESTION, OUTCOME, STAKES, PRIORITIES, UNACCEPTABLE |
| Options/situation | 6 | OPT-ON-TABLE, STATUS-QUO, OPT-CONSTRAINTS, OPT-IRREV, PAST-ATTEMPTS, TIMING-WINDOW |
| Risk/validation | 4 | RISK-TOLERANCE, EXIT-CRITERIA, VALIDATION-CAPACITY, STAKEHOLDERS |
| Topic pack | 5 | REL-DYNAMICS, JOB-OFFER, BIZ-MODEL, LOCALE-MOVE, EDU-PATH |
| **Total** | **20** | |

---

## 5. Chart inputs are not DIRs

BaZi (`ProfileStructured` / CFP) and ZiWei (`ZiweiFactPack`) are **calc inputs**, not RealityFact DIRs.  
They feed Personal Pattern / appendix (`DDR-03`) and PageFeedMatrix slices.  
**Never** write chart interpretation as `status=confirmed` RealityFact without user reality evidence (Phase 1 + P2-F).

---

## 6. Declaration

Docs only. Live DIR state remains exclusively `DC.dirs`. No fixed questionnaire.
