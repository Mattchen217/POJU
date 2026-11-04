# Decision Intake 2.0 · Phase 1 Data Contract

| Field | Value |
|---|---|
| **Document type** | Formal data contract (docs only; no runtime code) |
| **Base SHA** | `297544134d7dcc8c942d5d314760bc3f4a75423f` (`main`) |
| **Phase 0 baseline** | `docs/eastern-os/decision-intake-2.0/PHASE-0-CODEBASE-BASELINE.md` @ `cc00be4a` |
| **Phase 1.1 review** | `PHASE-1-1-REVIEW-REPORT.md` @ `17aec05c` |
| **Phase 1.2** | Closes product decisions **C1–C5** (this revision) |
| **Product SSOT** | `.cursor/plans/全新统一决策问答系统：架构设计与开发实施规范.MD` |
| **Engineering role** | Encode confirmed product rules — **do not invent new product semantics** |

---

## 0. Purpose and authority

This document freezes the **data model contract** for Decision Intake 2.0 so later phases can implement without re-negotiating meaning.

| Authority | Scope |
|---|---|
| Product design plan + Phase 1.2 decisions C1–C5 | Business meaning, object duties, rules |
| This document | Typed fields, enums, invariants, reuse vs new types, tech risks |
| Existing code | Evidence of what already exists / is wired |

**Non-goals (Phase 1 / 1.2):** implement engines, change Agent/Call A/B, migrate DB, change UI/prompts.

**C1–C5 status:** **CLOSED** in this document (see §15).

---

## 1. Object map (duties)

```text
InvestigationBlueprint  ──seeds──►  DDR[] + InvestigationDirection[] + dir_id refs
        │                           + immutable DIR seed snapshot @ blueprint_version
        ▼
AdaptiveQuestionPlan    ──queues──►  AgendaItem[] (execution only; NOT facts)
        │
        ▼
User Answer / Evidence  ──writes──►  DecisionContext
        │
        ├── RealityFacts / Constraints / Hypotheses / Conflicts
        └── DC.dirs  ◄── sole mutable DIR Source of Truth
        │
        ▼
DecisionUnderstanding   ──derives──►  UI + model planner (read-only)
        │
PersonalAnalysisProfile ──feeds──►  Pattern Insight + CFP/ZFP (NOT RealityFacts)
        │
SufficiencyGate         ──reads──►  DC + DDR status + DC.dirs
        │
FreezeRecord            ──binds──►  dc_content_hash + blueprint_version + ddr_version
        │
Report (01–08)          ──reads──►  frozen DC + FreezeRecord + PageFeedMatrix
```

| Object | Duty | Must NOT |
|---|---|---|
| **DecisionContext (DC)** | Sole store of definition, facts, constraints, hypotheses, conflicts, **live DIR (`DC.dirs`)** | Duplicate into `agent_v2` as authority |
| **DDR** | Report obligations; **status computed** from DIRs/evidence/blockers | Hold user facts; Agenda covered ⇒ satisfied |
| **DIR (`DC.dirs`)** | Information needs; state via `reaggregateDirs` | Agenda covered ⇒ known; live copy on Blueprint |
| **InvestigationBlueprint** | Scope, directions, DDR defs, `dir_id` refs, **immutable** DIR seed snapshot | Second live DIR status array; overwrite `DC.dirs` on blueprint edit |
| **Agenda / AdaptiveQuestionPlan** | Ask execution queue | Fact SoT / sufficiency proxy |
| **DecisionUnderstanding** | Derived UI+planner view | Second fact DB |
| **PersonalPatternInsight** | Local BaZi/ZiWei relevance | RealityFact |
| **SufficiencyGate** | PASS / WARN / FAIL | Hard-push/stall alone ⇒ PASS |
| **SessionLifecycle** | Phases incl. internal `blueprint_building` | Merge with Lockout; show Stage 1/2/3 labels |
| **InvalidInput / Lockout** | Server abuse protection | Model/DC/Agenda/PASS while locked |
| **FreezeRecord** | Bind DC hash + Blueprint/DDR versions | Put Blueprint/DDR versions inside `DC.content_hash` |

---

## 2. Decision Context (DC)

### 2.1 Reuse vs adapt

| Item | Code today | Intake 2.0 |
|---|---|---|
| Core types | `lib/poju/decision-context/types.ts` | **REUSE** |
| Legal status×verification | `fact-combination.ts` `LEGAL_FACT_COMBINATIONS` | **REUSE** pairs; writers must apply §2.4 promotion |
| DIR aggregate | `dir-aggregator.ts` | **REUSE** (`known` needs `status===confirmed`) |
| Content hash | `content-hash.ts` `extractBusinessPayload` | **REUSE** — DC business only (C5) |
| Freeze / version | `freeze.ts`, `versioning.ts` | **REUSE** DC freeze; **ADD** FreezeRecord sidecar (C5) |
| Production lifecycle | `production-dc-lifecycle.ts` | **REBUILD** writers; keep pure helpers |
| `confirmFact` today | Sets `user_confirmed` only | **FUTURE CODE** must also apply §2.4A status promotion (Phase 3) |

### 2.2 Status and fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `context_id` | string | yes | |
| `version` | number | yes | Monotonic within `context_id` |
| `status` | `draft` \| `final` \| `superseded` | yes | |
| `definition` | `Definition` | yes | |
| `reality_facts` | `RealityFact[]` | yes | |
| `constraints` | `Constraint[]` | yes | |
| `hypotheses` | `Hypothesis[]` | yes | Never RealityFacts |
| `dirs` | `DIR[]` | yes | **Sole live DIR SoT (C3)** |
| `conflicts` | `Conflict[]` | yes | |
| `content_hash` | string \| null | null draft; required final | **DC business payload only (C5)** |
| `created_at` / `updated_at` | ISO string | yes | |
| `information_boundaries` | string[]? | optional | |
| `delivery_mode` | `normal` \| `degraded` \| null | optional | |

### 2.3 Definition

| Field | Type |
|---|---|
| `concrete_event` | string \| null |
| `stakes` | string \| null |
| `desired_outcome` | string \| null |
| `decision_question` | string \| null |
| `goal_priorities` | string[] |
| `unacceptable_outcomes` | string[] |

**Invariant:** Model speculation ≠ user-confirmed goals without evidence / fact-confirm event.

### 2.4 RealityFact — status × verification + confirmation (C1 CLOSED)

#### Legal pairs (unchanged; matches `LEGAL_FACT_COMBINATIONS`)

| status | Allowed `verification_level` |
|---|---|
| `confirmed` | `user_asserted`, `independently_verified` |
| `unverified` | `user_estimate`, `user_asserted` |
| `unknown` | `none` |
| `declined` | `none` |
| `not_applicable` | `none` |

**Forbidden:** `inferred` as verification_level. Model must not write hypotheses as confirmed facts.

#### Two distinct confirmation events (must not conflate)

| Event | Purpose | Effects |
|---|---|---|
| **E1 FactConfirm** | User confirms a **specific fact** is accurate | May change that fact’s `status` / `user_confirmed` per rules below |
| **E2 UnderstandingConfirm** | User confirms **Decision Understanding summary** and authorizes Freeze | Does **not** bulk-upgrade estimates/facts to `confirmed`; triggers Freeze path only |

#### Promotion / confirmation rules (normative)

**A. `user_asserted`**

After **E1 FactConfirm** on a fact with `verification_level = user_asserted`:

- set `status = confirmed`
- set `user_confirmed = true`
- keep original `source_*` and `verification_level`
- require an explicit user-confirm event record; model may not infer confirm

Initial write of a clear user statement (before E1) may be `unverified` + `user_asserted` until E1.

**B. `independently_verified`**

- may use `status = confirmed`
- **`user_confirmed = false` always** (independent verification ≠ user confirmation)
- E1 must not set `user_confirmed = true` for this verification_level

**C. `user_estimate`**

- `status = unverified`, `verification_level = user_estimate`
- **E1 FactConfirm alone must not upgrade to `confirmed`**
- **E2 UnderstandingConfirm must not upgrade estimates to `confirmed`**
- Only new qualifying evidence (new verification path meeting legal pairs) may change verification/status

**D. Other statuses**

- `unknown` / `declined` / `not_applicable` ⇒ `verification_level = none`; `user_confirmed = false`
- Declined / unknown never become satisfied DDR/DIR via Agenda covered

#### Compatibility with `aggregateDirState`

`dir-aggregator.ts` treats a required role as fully satisfied for `known` only when a matching fact has **`status === "confirmed"`**.

Therefore Intake writers **must** apply §2.4A so user-asserted facts that receive E1 become `status=confirmed`; otherwise DIR cannot become `known`. This is intentional alignment, not a product change.

**Implementation note (not this phase):** today’s `confirmFact` / `applyFactConfirmToDc` only flips `user_confirmed` — Phase 3 must extend it to §2.4A. Document rule is closed; code change is deferred.

### 2.5 Constraint

Same fields as `types.ts` + recommended `related_dir_ids`. Hard/soft rigidity. Collecting Constraint writer missing today → Phase 3.

### 2.6 Hypothesis

Never written into `reality_facts`. Recommended `related_fact_ids` additive later.

### 2.7 Conflict

`open` \| `clarified` \| `unresolved_in_final`. Clarify requires `user_confirmation=true`.  
`affects_preferred_path` undefined ⇒ conservative true.  
Production writer missing → Phase 3. Conflicts block only **related** DDRs (see §3.2).

### 2.8 DIR — live SoT = `DC.dirs` (C3 CLOSED)

| Product term | Code field |
|---|---|
| related_agenda_ids | `agenda_item_ids` |
| lifecycle | `id_lifecycle` |
| serves_face / judgment | `serves_face`, `serves_judgment` |

`current_state`: `known` \| `unknown` \| `conflict` \| `n_a`.

**Invariants:**

1. **`DC.dirs` is the only mutable DIR Source of Truth.**  
2. Blueprint holds `dir_id[]` + **immutable seed snapshot** at `blueprint_version` — never a second live status array.  
3. Blueprint version bumps **must not** overwrite or reset live `DC.dirs` states/evidence links.  
4. Agenda `covered` **never alone** sets DIR `known`.  
5. After every Fact/Conflict write → `reaggregateDirs(DC.dirs, facts, conflicts)`.

### 2.9 SourceStage

Existing includes `call_a` / `call_b`. Intake writers **must not** stamp Call A/B. Prefer `opening` / `collecting` / `user_supplement` until enum extension (still deferred eng/product light item; not C1–C5).

---

## 3. Decision Deliverable Requirements (DDR) + Gate (C4 CLOSED)

### 3.1 Fields

| Field | Type | Required |
|---|---|---|
| `ddr_id` | string | yes |
| `deliverable` | string | yes |
| `report_page_id` | `DecisionPageId` (`01`–`08`) | yes |
| `report_section_id` | string | yes |
| `required_dir_ids` | string[] | yes |
| `required_sources` | enum[] | yes |
| `priority` | `P0` \| `P1` \| `P2` | yes |
| `completion_criteria` | string | yes |
| `status` | see §3.2 | yes (computed) |
| `blocking_conflict_ids` | string[] | optional derived |
| `ddr_version` | number | yes on catalog freeze |

DDR definitions live on Blueprint; **status is computed**, not manually set by model.

### 3.2 Normative DDR status function

**Definitions (do not conflate):**

| Symbol | Meaning |
|---|---|
| `ids` | `ddr.required_dir_ids` as declared on the Blueprint DDR definition |
| `R` | DIRs in **`DC.dirs`** with `id ∈ ids` **and** `id_lifecycle=active` |
| `dangling` | `ids.length > 0` **and** at least one id is missing from `DC.dirs` **or** present only as non-active / deprecated — Blueprint↔DC reference integrity failure |
| `truly_unrequired` | `ids.length === 0` (DDR declares no required DIRs) |
| `blocking` | open/unresolved conflicts on contributing facts of DIRs in `R`, or explicitly linked to this DDR (not global indiscriminate block) |
| `explicit_na_evidence` | documented applicability evidence that this DDR (or every DIR in `R`) is not applicable — never inferred from silence, decline, Agenda covered, or dangling refs |

**Important:** `R` empty is **not** proof that the DDR has no required DIRs. Only `truly_unrequired` (`ids.length === 0`) means that. `dangling` also yields empty or incomplete `R` and must **never** become `n_a`.

**Evaluation order (first match wins; statuses are mutually exclusive):**

1. If `blocking` is non-empty → `blocked`  
2. Else if `dangling` → `pending` (reference integrity; optional audit flag `ddr_dir_ref_integrity_error` — still not `n_a`)  
3. Else apply the table below.

| Condition | `ddr.status` |
|---|---|
| `R` non-empty; every DIR in R is `known` or `n_a`; **and ≥1 DIR is `known`** | `satisfied` |
| `R` non-empty; every DIR in R is `n_a`; **and** `explicit_na_evidence` | `n_a` |
| `truly_unrequired` (`ids.length === 0`); **and** `explicit_na_evidence` | `n_a` |
| `R` non-empty; some DIRs in R are `known` or `n_a`, and ≥1 remains `unknown` or `conflict` (without triggering `blocked`) | `partial` |
| Otherwise (incl. `truly_unrequired` **without** `explicit_na_evidence`) | `pending` |

**Boundary notes (normative):**

- **All DIRs `n_a` ≠ `satisfied`.** Example: DIR-A/B/C all `n_a` with evidence → DDR = `n_a`, never `satisfied`.  
- **`satisfied` and `n_a` are mutually exclusive.** `satisfied` always requires ≥1 `known` in non-empty `R`.  
- **`dangling` ≠ N/A.** Lost/deprecated DIR refs → `pending` (+ integrity error), never `n_a` / `satisfied`.  
- **`R` empty alone never decides `n_a`.** Only `truly_unrequired` + evidence → `n_a`; dangling or incomplete wiring → `pending`.  
- Aligns with `dir-aggregator.ts`: a single DIR may aggregate to `n_a` when all required roles are N/A; DDR then rolls up those DIR states per this table.

**Hard constraints:**

1. Status from DIR states + evidence + blockers — **not** Agenda covered %.  
2. User decline / unknown ≠ `satisfied` and ≠ automatic `n_a`.  
3. `n_a` requires explicit applicability evidence — must not mask unknown/declined/incomplete/**dangling**.  
4. Conflicts block only **related** DDRs.  
5. P2 unsatisfied alone must not block report generation.  
6. For Gate purposes, DDR `n_a` is an **acceptable terminal** like `satisfied` (see §3.3); it is **not** the same semantic as “delivered with known evidence.”

### 3.3 Sufficiency Gate composition

Verdicts: `PASS` \| `WARN` \| `FAIL`.

Compose after DDR status refresh + DIR reaggregation + Definition/conflict checks:

Let `L` = linked **active** DIRs for this DDR (`R` as resolved in §3.2).  
`dangling` is defined in §3.2 (`ids.length > 0` with any missing/deprecated required id) — including **partial** dangling where some ids resolve and others do not.

| Rule | Gate |
|---|---|
| Any **P0** DDR is `pending` / `partial` / `blocked` (not `satisfied`/`n_a`) | **FAIL** (not PASS) |
| **P1** DDR unsatisfied **and** (`dangling` **or** `|L|=0` **or** decision-critical / ranking impact) | **FAIL** |
| **P1** DDR unsatisfied **and** `dangling === false` **and** `|L|≥1` **and** `|L| === ids.length` **and** every DIR in `L` has `may_affect_p5_ranking === false` **and** boundaries recorded | **WARN** |
| Only **P2** DDRs unsatisfied | Must **not** alone prevent report; Gate may still PASS/WARN on other grounds |
| Open preferred-path conflicts without boundary policy | **FAIL** |
| Boundary-only unknowns / non-preferred conflicts disclosed | **WARN** |
| Definition unclear / hash integrity fail / **any** dangling DIR refs on P0/P1 (full or partial) | **FAIL** |
| User hard-push / stall / MAX turns alone | **Never PASS** |

**WARN:** may enter **conditional report** after E2 UnderstandingConfirm; must disclose unresolved info, premises, and conclusion limits (`delivery_mode=degraded` / information_boundaries).  
**FAIL:** must **not** freeze as normal deliverable report.

**P1 WARN vs FAIL decision basis (deterministic):**

```text
if P1 ddr.status ∉ {satisfied, n_a}:
  let ids = ddr.required_dir_ids
  let L = linked active DIRs for this DDR  # from DC.dirs; exclude missing/deprecated
  let dangling = ids.length > 0 AND |L| < ids.length  # any unresolved required id
  if dangling:
       → FAIL   # partial or full dangling: never WARN (overrides |L|≥1)
  if |L| === 0:
       → FAIL   # empty linked set: never vacuously WARN (conservative)
  if ddr.completion_criteria marks decision_critical=true
     OR any DIR in L has may_affect_p5_ranking !== false:
       → FAIL
  if dangling === false
     AND |L| ≥ 1
     AND |L| === ids.length
     AND every DIR in L has may_affect_p5_ranking === false
     AND information_boundaries includes this gap:
       → WARN
  else:
       → FAIL  # conservative default
```

**Forbidden:** treating vacuous `every([]) === true` as P1 WARN eligibility.  
**Forbidden:** treating partial dangling (`|L|≥1` but `|L| < ids.length`) as WARN-eligible.

Legacy `evaluateDecisionSufficiency` is DIR/conflict core to **reuse inside** this composer; Intake Gate is the outer function (future `evaluateIntakeSufficiency`).

### 3.4 Example DDR families → faces

Unchanged mapping to PageFeedMatrix faces `01`–`08` / appendix `03` (see Traceability). Catalog instances = Phase 2.

---

## 4. Investigation Blueprint (C3)

| Field | Type | Notes |
|---|---|---|
| `blueprint_id` | string | |
| `blueprint_version` | number | Immutable history |
| `ddr_version` | number | Catalog version bound at freeze |
| `session_id` / `context_id` | string | |
| `directions` | `InvestigationDirection[]` | |
| `ddr` | `DDR[]` | Definitions; live status computed against `DC.dirs` |
| `dir_ids` | string[] | References into `DC.dirs` only |
| `dir_seed_snapshot` | immutable copy of initial DIR **requirements** (need/why/roles) at seed time | **Not** live `current_state` |
| `scope_locked` | boolean | |
| `change_log` | `BlueprintChangeRecord[]` | |

**Forbidden:** Blueprint maintaining `current_state` / evidence links as a parallel mutable DIR store.  
**Forbidden:** Blueprint update resetting `DC.dirs` live aggregation.

InvestigationDirection fields unchanged (priority P0/P1/P2, depth caps, scope_boundary, etc.).

---

## 5. Adaptive Question Plan & Agenda

Unchanged duties: one primary question; must cite `direction_id` + `dir_ids` / `ddr_ids`; Agenda execution only; covered ≠ DIR known / DDR satisfied.

---

## 6. Decision Understanding (derived)

Same blocks as before. Progress weights remain **deferred** (not C1–C5). Progress must not use Agenda coverage as primary metric.

---

## 7. Personal Analysis & glossary

Unchanged: BaZi/ZiWei isolated from RealityFacts; glossary mandatory reuse; ZFP hydration gap deferred Phase 5/9.

---

## 8. Session Lifecycle enum (C2 CLOSED)

**Canonical `IntakeSessionPhase` (exact set — Data Contract ≡ State Machines):**

| Phase | User-visible? | Meaning |
|---|---|---|
| `intake_init` | no stage label | First message / definition seed / profile load |
| `blueprint_building` | **internal only** | Building InvestigationBlueprint + DDR/DIR seeds |
| `blueprint_ready` | no stage label | Scope locked; blueprint_version persisted |
| `investigating` | no stage label | Adaptive Q&A |
| `understanding_review` | no stage label | Final summary **shown** (E2 not yet done) |
| `awaiting_user_confirm` | no stage label | Waiting for E2 UnderstandingConfirm or revise |
| `frozen` | no stage label | DC final + FreezeRecord written |
| `reporting` | no stage label | Report generation read-only |
| `closed` | — | Ended normally or terminated |
| `expired` | — | 24h retain elapsed (≠ lockout strike) |

**UX rule:** Users always see unified Decision Understanding UI + current question. **No** Stage 1/2/3 labels. Internal phase changes must not alter that product UX.

---

## 9. Invalid Input / Lockout

Unchanged product SM (deferred implementation Phase 8). Separate from Session phases.

---

## 10. Persistence & FreezeRecord (C5 CLOSED)

### 10.1 Persist matrix

| Data | Persist |
|---|---|
| DC draft/final + versions + idempotency keys | yes |
| Blueprint versions + change_log + ddr_version | yes |
| Agenda / plan audit | yes (not fact SoT) |
| DecisionUnderstanding | optional cache; rebuild from DC |
| Lockout counters | server durable (Phase 8) |
| **FreezeRecord** | yes; immutable |

### 10.2 `DC.content_hash` scope

Matches `content-hash.ts` `extractBusinessPayload`:

- Includes: Definition, RealityFacts, Constraints, Hypotheses, **DIRS (live state)**, Conflicts, information_boundaries  
- **Excludes:** Blueprint version, DDR catalog version, UI progress, lockout, pure timestamps outside business fields as defined by existing extractor  

### 10.3 FreezeRecord (sidecar; Scheme A)

| Field | Type | Required |
|---|---|---|
| `freeze_id` | string | yes |
| `session_id` | string | yes |
| `context_id` | string | yes |
| `context_version` | number | yes |
| `dc_content_hash` | string | yes (= `DC.content_hash` at freeze) |
| `blueprint_version` | number | yes |
| `ddr_version` | number | yes |
| `frozen_at` | ISO string | yes |
| `gate_verdict` | `PASS` \| `WARN` | yes |
| `delivery_mode` | `normal` \| `degraded` | yes |

**Report generation must verify** all of: `dc_content_hash`, `blueprint_version`, `ddr_version` match the artifacts used.  
**History:** new Blueprint/DDR/DC versions create new FreezeRecords; **must not silently overwrite** prior FreezeRecords or prior report bindings.

Existing `DecisionContextBinding` remains the DC triple; FreezeRecord **extends** it with blueprint/ddr versions.

---

## 11. Question budget

Unchanged defaults (soft 12 / hard 15; depth 3). Not part of C1–C5 reopen.

---

## 12. Suggested code directory

Still recommend `lib/decision-intake/` later — **do not create in Phase 1.2**.

---

## 13. Technical risks (remaining after C1–C5)

| ID | Item | Phase |
|---|---|---|
| T1 | `agent_v2` dual authority in UI | Bridge / 3–7 |
| T2 | Call A/B must not be Intake entry | Always |
| T3 | Conflict/Constraint writers missing | 3 |
| T4 | **CLOSED by C1** (doc); code `confirmFact` promote still Phase 3 | 3 |
| T5 | Product plan v6=Shadow vs production v6 | Doc hygiene |
| T6 | Ziwei task-context hydration | 5/9 |
| T7 | SourceStage enum extend | light OPEN |
| T8 | DDR instance catalog | Phase 2 |
| T9 | Progress weight table | 6–7 |
| T10 | PASS legal copy | product/legal |
| T11 | Lockout server schema / classifier | 8 |

---

## 14. C1–C5 closure proof

| ID | Decision | Where encoded |
|---|---|---|
| C1 | Fact confirm promotion A–D + E1≠E2 | §2.4 |
| C2 | Phase enum + internal `blueprint_building` | §8 |
| C3 | `DC.dirs` sole live DIR SoT | §1, §2.8, §4 |
| C4 | DDR status table (satisfied/n_a mutually exclusive; all-DIR-n_a → n_a) + Gate P0/P1/P2 | §3.2–§3.3 |
| C5 | Hash = DC only; FreezeRecord sidecar | §10 |

---

## 15. Declaration

Phase 1.2 documentation revision only. **No runtime code, schema, UI, prompt, or PASS changes.**
