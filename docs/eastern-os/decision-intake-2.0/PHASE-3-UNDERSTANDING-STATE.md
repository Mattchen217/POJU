# Decision Intake 2.0 · Phase 3 Understanding State

| Field | Value |
|---|---|
| **Stage** | 3.1 Design only |
| **Baseline** | `main` @ `ee8c96e8` |
| **Nature** | **Derived view** — not a RealityFact database |

---

## 0. Purpose

Define the per-turn **Understanding State** shown to the user and fed to Question Planning. It synthesizes Decision Context without becoming a second fact SoT.

---

## 1. Top-level shape

```ts
type UnderstandingState = {
  understanding_id: string;
  session_id: string;
  context_id: string;
  context_version: number;       // must match DC.version used to build
  blueprint_version: number;
  built_at: string;              // ISO
  current_understanding: CurrentUnderstanding;
  understood: UnderstoodBlock;
  need_to_understand: NeedBlock;
  personal_pattern_insight: PersonalPatternInsightBlock;
  next_question_planning: NextQuestionPlanningBlock;
  provenance: UnderstandingProvenance;
};
```

---

## 2. Field specifications

### 2.1 `current_understanding`

| Aspect | Spec |
|---|---|
| **Structure** | `{ summary_zh: string; decision_question: string \| null; stakes_brief: string \| null; options_brief: string[]; open_risks_brief: string[]; confidence: "low"\|"medium"\|"high" }` |
| **Definition** | Plain-language snapshot of “what we think the decision is right now” |
| **Source** | DC.Definition + confirmed RealityFacts/Constraints; optional model **draft** of `summary_zh` validated against schema |
| **Update** | After every successful DC Update |
| **Model inference** | Allowed for `summary_zh` phrasing only |
| **vs confirmed facts** | Summary must cite `fact_ids` / `constraint_ids` in provenance; must not invent options |
| **Trace** | `provenance.summary_fact_ids[]`, `summary_constraint_ids[]` |

### 2.2 `understood`

| Aspect | Spec |
|---|---|
| **Structure** | `{ items: UnderstoodItem[] }` where `UnderstoodItem = { dir_id; label; fact_ids; status: "known"\|"n_a"; user_confirmed_any: boolean; na_evidence_ids?: string[] }` |
| **Definition** | DIRs that are `known` or `n_a` with evidence |
| **Source** | `DC.dirs` + contributing RealityFacts/Constraints |
| **Update** | After DIR reaggregation |
| **Model inference** | **Forbidden** to mark understood without DC state |
| **vs confirmed** | `user_confirmed_any` reflects E1 on contributing facts (C1); independently_verified ⇒ `user_confirmed_any=false` |
| **Trace** | Each item → `dir_id` + `fact_ids`; for `n_a` see §2.7 |

### 2.3 `need_to_understand` (R1-05)

Phase 2 allows some DDRs with **no required DIR** but with required sources. NeedItems therefore have two shapes — **never invent a DIR** to fill a source-only gap.

```ts
type NeedItem =
  | {
      kind: "dir_based";
      dir_id: string;                 // required
      ddr_ids: string[];
      priority: "P0" | "P1" | "P2";
      why: string;
      may_affect_p5_ranking: boolean;
      gap_type: "unknown" | "partial" | "conflict" | "declined";
    }
  | {
      kind: "source_only";
      dir_id?: never;                 // must be absent
      ddr_id: string;                 // DDR that requires the source
      source_code: string;            // e.g. cfp.birth_datetime
      source_state: "missing" | "pending" | "calc_failed" | "not_ok";
      priority: "P0" | "P1" | "P2";
      why: string;
      may_affect_p5_ranking: boolean;
      gap_type: "source_pending";
      user_askable: boolean;          // product: usually false for pure pack wait; true if UX can request profile/birth data
    };
```

| Aspect | Spec |
|---|---|
| **DIR-based gap** | Live `DC.dirs[dir_id]` not known/n_a (or conflict/declined); maps to Blueprint DIRs only |
| **Required-source gap** | Phase 2 §1.3 Required Source Check failed for a DDR; may attach to DIR-based NeedItem when that DDR also has DIRs, **or** stand alone as `source_only` when DDR has empty required DIR set |
| **Source-only → user question?** | Only if `user_askable=true` (e.g. “请补充出生时间以便计算”). If false, planner skips NL ask and surfaces supply UX / soft FAIL attribution — **no fictional DIR** |
| **Trace** | `dir_based`: `dir_id` → catalog + `DC.dirs`; `source_only`: `ddr_id` + `source_code` + `source_state` → Phase 2 source matrix |
| **Model** | May reorder; **cannot** invent DIR ids; cannot convert source_only → dir_based |

### 2.7 N/A evidence provenance (R2-04)

Align Phase 1 §3.2 and Phase 2 §1.5. Understanding caches `na_evidence_ids` for display only — **not** the authority store.

#### A. Authority store

Authority lives on **Decision Context**, aligned with Phase 1 `explicit_na_evidence` (Data Contract DDR/DIR N/A rules). Understanding only caches ids.

| Store | Role |
|---|---|
| `DC.reality_facts[]` | User-asserted facts whose payload/status encodes applicability absence for a DIR |
| `DC.constraints[]` | Explicit “no X / not applicable” constraints with stable ids |
| DC-side `ExplicitNaEvidence` records | Code-written markers `{ evidence_id, dir_id?, ddr_id?, na_condition_code, source_ref, written_by: "code" }` persisted with DC (Phase 3.2 chooses concrete field bag **without** reopening Phase 1 C1–C5 enums). Not model-authored. |
| Understanding `na_evidence_ids` | Derived pointers into the above — rebuildable; **never** sole proof |

Model output alone is **never** written into these stores as N/A proof. Do not treat a cache-only `current_state=n_a` as evidence.

#### B. Evidence types

| Type | Code | May support DIR `n_a`? |
|---|---|---|
| User-explicit fact/constraint stating N/A applicability | `user_explicit_na` | Yes, if matches `na_conditions` |
| System N/A marker written by deterministic code after validated user evidence / catalog rule | `system_na_marker` | Yes, if marker cites legal `na_condition_code` |
| Model inference / free-form judgment | `model_inferred` | **No** — reject as N/A evidence |
| Silent absence / empty field | — | **No** |
| `unknown` / `declined` fact status | — | **No** — must not convert to `n_a` |

#### C. DIR Catalog `na_conditions` validation

```text
For candidate DIR n_a:
  1. Resolve na_evidence_ids → authoritative records in DC
  2. Each evidence must reference this dir_id (or mapped constraint link)
  3. Match evidence.na_condition_code / semantics against DIR Catalog.na_conditions
  4. If any evidence missing, wrong dir, wrong condition, revoked, or conflicting
       → n_a INVALID
  5. reaggregateDirs: invalid n_a → do not emit current_state=n_a for Gate satisfaction
       (typically pending/unknown/partial per Phase 1/2 aggregator rules)
```

Presence of an evidence id **alone** is insufficient without `na_conditions` match.

#### D. Rebuild / revoke

1. Understanding rebuild reads DC evidence + `reaggregateDirs` output only.  
2. If evidence revoked/superseded/conflicted → reaggregate clears illegal `n_a`; Understanding drops that UnderstoodItem or marks gap.  
3. Cache mismatch with DC → discard Understanding cache; rebuild.

#### E. Non-bypass rules (frozen)

- `unknown` ↛ `n_a`; `declined` ↛ `n_a`  
- Evidence-less `n_a` **excluded** from Gate satisfaction  
- DDR-02 CFP Required Source miss **cannot** be waived by DIR/DDR N/A (Phase 2 Rule A)

### 2.4 `personal_pattern_insight`

| Aspect | Spec |
|---|---|
| **Structure** | `{ available: boolean; cfp_state; zfp_state; insights: Insight[]; disclaimer: string }` where `Insight = { insight_id; text; cfp_fields?; zfp_fields?; kind: "pattern_not_fact" }` |
| **Definition** | Chart-derived **pattern** language for planner/UI |
| **Source** | Local CFP/ZFP only (`ProfileStructured` / `ZiweiFactPack`) |
| **Update** | When profile_binding changes or each turn if packs present |
| **Model inference** | May phrase `text`; must keep `kind=pattern_not_fact` |
| **vs confirmed** | **Never** copied into RealityFacts; never asked as “please confirm your chart says X as real behavior” |
| **Trace** | `cfp_fields` / `zfp_fields` PageFeedMatrix codes + pack hashes |

### 2.5 `next_question_planning`

| Aspect | Spec |
|---|---|
| **Structure** | `{ candidates: CandidateQuestionRef[]; selected_id: string \| null; skip_reason: string \| null; budget: BudgetSnapshot }` |
| **Definition** | Output of Question Planning for this turn |
| **Source** | Planner module (see `PHASE-3-QUESTION-PLANNING.md`) |
| **Update** | After Understanding rebuild, before Generation |
| **Model inference** | May propose candidate order; code selects |
| **vs confirmed** | Plans cite DIRs, not new facts |
| **Trace** | Each candidate → `ddr_ids`, `dir_ids`, `plan_rationale_code` |

### 2.6 `provenance`

```ts
type UnderstandingProvenance = {
  context_hash_draft: string | null; // optional mid-draft hash for audit
  dir_states_digest: string;         // hash of dir_id→current_state map
  insight_pack_hashes: { cfp?: string; zfp?: string };
  builder_version: string;           // design/impl version tag later
};
```

---

## 3. Rebuild rules

1. Always rebuild from DC + Blueprint + packs after DC Update.  
2. Cache allowed; on version mismatch, discard cache.  
3. If rebuild fails, do **not** ask next question; surface error / retry.  
4. Progress UI must **not** use Agenda covered % as primary metric (Phase 1).

---

## 4. UI contract (no Stage labels)

Users see unified Decision Understanding + current question. Internal phase (`investigating`, etc.) stays hidden (C2).

---

## 5. Declaration

Docs only. Understanding State is derived; DC remains sole fact SoT.
