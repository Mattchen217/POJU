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

### 2.7 N/A evidence provenance (R4-01)

Align Phase 1 §2.4 / §3.2 / §10.2 and Phase 2 §1.5. Understanding caches `na_evidence_ids` only — **not** authority.

#### A0. DIR vs DDR state types (frozen; never mix)

| Layer | Field | Allowed values ONLY |
|---|---|---|
| DIR | `DC.dirs.*.current_state` | `known` \| `unknown` \| `conflict` \| `n_a` |
| DDR | composed `status` | `satisfied` \| `partial` \| `pending` \| `blocked` \| `n_a` |

**Forbidden:** writing `pending` / `partial` / `blocked` / `satisfied` into DIR `current_state`.

**Invalid N/A processing order (no cross-layer assign):**

```text
1. Validate ExplicitNaEvidence (target + source + condition + not revoked) — §A/C
2. If INVALID → target must NOT become n_a
3. reaggregateDirs → legal DIR current_state ∈ {known, unknown, conflict, n_a}
4. DDR roll-up (Phase 1/2) → DDR status
5. Gate composer → PASS | WARN | FAIL
```

Only evidence that passes §C may influence steps 3–5.

#### A. Authority store — discriminated target (R4-01)

```ts
type NaSourceRef =
  | { kind: "reality_fact"; fact_id: string }
  | { kind: "constraint"; constraint_id: string };

type NaSystemBasis =
  | { kind: "topic_not_applicable"; topic_code: string; rule_id: string }
  | { kind: "catalog_na_condition_met"; condition_eval_id: string }
  | { kind: "empty_dir_source_absence"; ddr_id: string; source_code: string; eval_id: string };
  // rule_id / condition_eval_id / eval_id = durable id of the deterministic check run that proved the condition

type ExplicitNaEvidence =
  | {
      evidence_id: string;
      target: "dir";
      dir_id: string;                 // REQUIRED — exactly one DIR
      ddr_id?: never;                 // MUST be absent
      na_condition_code: string;      // ∈ DIR Catalog.na_conditions for dir_id
      evidence_type: "user_explicit_na";
      source_ref: NaSourceRef;        // REQUIRED — user fact/constraint
      system_basis?: never;
      written_by: "code";
      revoked: boolean;
    }
  | {
      evidence_id: string;
      target: "dir";
      dir_id: string;
      ddr_id?: never;
      na_condition_code: string;
      evidence_type: "system_na_marker";
      source_ref?: never;             // system markers do not use user source_ref
      system_basis: NaSystemBasis;    // REQUIRED — proven code evaluation
      written_by: "code";
      revoked: boolean;
    }
  | {
      evidence_id: string;
      target: "ddr";
      ddr_id: string;                 // REQUIRED — empty-DIR / applicability DDR n_a (e.g. DDR-03)
      dir_id?: never;                 // MUST be absent
      na_condition_code: string;      // ∈ DDR applicability / Phase 2 empty-DIR N/A rules
      evidence_type: "user_explicit_na";
      source_ref: NaSourceRef;        // REQUIRED
      system_basis?: never;
      written_by: "code";
      revoked: boolean;
    }
  | {
      evidence_id: string;
      target: "ddr";
      ddr_id: string;
      dir_id?: never;
      na_condition_code: string;
      evidence_type: "system_na_marker";
      source_ref?: never;
      system_basis: NaSystemBasis;    // REQUIRED
      written_by: "code";
      revoked: boolean;
    };
// DC.explicit_na_evidence: ExplicitNaEvidence[]
```

| Hard constraint | Rule |
|---|---|
| Exactly one target | `target=dir` ⇒ `dir_id` present, `ddr_id` absent; `target=ddr` ⇒ `ddr_id` present, `dir_id` absent |
| No orphan evidence | Both ids absent → **REJECT** (never persist) |
| No dual target | Both ids present → **REJECT** (one evidence, one target) |
| `user_explicit_na` | `source_ref` **REQUIRED**; resolve to live non-revoked RealityFact/Constraint; payload must support the claimed N/A semantics |
| `system_na_marker` | `system_basis` **REQUIRED**; code must re-verify basis still true at write time; `na_condition_code` alone is **insufficient** |
| `model_inferred` | Not a legal `evidence_type` — reject |

| Store | Role |
|---|---|
| `DC.explicit_na_evidence[]` | Primary code-validated markers; DC business data ∈ `content_hash` |
| `DC.reality_facts[]` / `DC.constraints[]` | Targets of `source_ref` |
| Understanding `na_evidence_ids` | Derived pointers only |

#### B. Evidence types (summary)

| Type | Allowed if |
|---|---|
| `user_explicit_na` | Valid target + required `source_ref` + `na_conditions` match |
| `system_na_marker` | Valid target + required `system_basis` proven + condition match |
| Model / silence / dangling / unknown / declined | **Never** |

#### C. Legality validation (code; all must pass)

```text
REJECT if any:
  - target missing / both dir_id and ddr_id set / neither set
  - evidence_type=user_explicit_na AND source_ref missing or dangling
  - evidence_type=system_na_marker AND system_basis missing or re-eval false
  - na_condition_code not in catalog for that target
  - revoked=true (ignored for satisfaction; may remain for audit)
  - written_by ≠ "code" / model-authored payload

ACCEPT → may feed reaggregateDirs / DDR roll-up / Gate
```

#### D. Rebuild / revoke / hash

1. Add/revoke → DC Update → `DC.version++` → recompute `content_hash` (includes `explicit_na_evidence`) → reaggregate → DDR → Gate.  
2. Understanding rebuild from DC only.  
3. FreezeRecord.dc_content_hash at E2; prior freezes immutable.  

#### E. Non-bypass (frozen)

- unknown/declined ↛ n_a  
- Evidence-less / INVALID evidence → no Gate satisfaction via n_a  
- DDR-02 CFP miss → pending → P0 FAIL; **N/A cannot waive Rule A**  
- Dangling / missing profile ≠ automatic n_a

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
