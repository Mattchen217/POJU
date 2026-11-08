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

### 2.7 N/A evidence provenance (R4-01 + R5-01…R5-03)

Align Phase 1 §2.4 / §3.2 / §10.2 and Phase 2 §1.5 / DDR-02 Rule A / DDR-03 §3.3.1. Understanding caches `na_evidence_ids` only — **not** authority.

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

/** system_basis kinds — scope locked in §A2 (R5-02). */
type NaSystemBasis =
  | { kind: "topic_not_applicable"; topic_code: string; rule_id: string }
  | { kind: "catalog_na_condition_met"; target_dir_id: string; condition_eval_id: string }
  | {
      kind: "empty_dir_source_absence";
      ddr_id: "DDR-03-CHART-APPENDIX"; // literal allowlist — only DDR-03
      source_code: string;             // must be DDR-03 required CFP source
      source_state: "source_absent_not_supplied"; // only this state
      eval_id: string;
    };

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
| No orphan / dual target | Neither or both ids → **REJECT** |
| `user_explicit_na` | `source_ref` **REQUIRED** + §A3 semantic checks |
| `system_na_marker` | `system_basis` **REQUIRED** + §A2 scope; `na_condition_code` alone **never** enough |
| `model_inferred` | Illegal type — reject |

| Store | Role |
|---|---|
| `DC.explicit_na_evidence[]` | Primary code-validated markers; ∈ `content_hash` |
| `DC.reality_facts[]` / `DC.constraints[]` | `source_ref` targets |
| Understanding `na_evidence_ids` | Derived only |

#### A1. DDR-level N/A allowlist (R5-01 · Phase 2 closed)

**Code MUST enforce allowlist + source-state — not only `na_condition_code`.**

| DDR | Empty-DIR + Source-Absence N/A path? | Allowed CFP/source state for DDR `n_a` | Forbidden |
|---|---|---|---|
| **`DDR-03-CHART-APPENDIX`** | **Yes — sole allowlist member (v1.1)** | CFP = `source_absent_not_supplied` **and** VALID ExplicitNaEvidence (`target=ddr`, ddr_id=DDR-03) | `source_calc_failed` → **never** N/A (stay `pending`); `source_provenance_missing` → **never** N/A |
| **`DDR-02-ATTRIBUTION`** | **No** | **None** — CFP non-waivable (Product Rule A) | Any CFP ≠ `source_ok` ⇒ DDR **`pending`** ⇒ Gate **P0 FAIL**; DIR N/A / DDR N/A / `system_na_marker` / `empty_dir_source_absence` **cannot** waive |
| Any other DDR | **No** | No empty-DIR source-absence N/A | Attempt → **REJECT** evidence; compose per Phase 2 without that path |

```text
DDR_EMPTY_DIR_SOURCE_ABSENCE_ALLOWLIST = { "DDR-03-CHART-APPENDIX" }

On target=ddr evidence OR system_basis.kind=empty_dir_source_absence:
  REJECT unless ddr_id ∈ allowlist
  REJECT if ddr_id = DDR-02-ATTRIBUTION (any N/A waiver path)
  For DDR-03: REJECT unless measured CFP state == source_absent_not_supplied
  REJECT if CFP ∈ {source_calc_failed, source_provenance_missing}
```

#### A2. `system_basis` scope (R5-02)

| `system_basis.kind` | Allowed targets | Validation (all required) |
|---|---|---|
| `topic_not_applicable` | `target=dir` whose DIR is topic-seeded per Phase 2 Topic Applicability; **not** DDR-02 Rule A waiver | `rule_id` ∈ Topic Applicability catalog; `topic_code` matches; re-run applicability → still not applicable; `na_condition_code` matches DIR `na_conditions` |
| `catalog_na_condition_met` | `target=dir` only (`target_dir_id` == evidence.`dir_id`) | Re-execute deterministic DIR `na_conditions` check for that DIR; `condition_eval_id` records proof; **forbidden** as substitute for DDR-03 source-absence or DDR-02 CFP |
| `empty_dir_source_absence` | **`target=ddr` AND `ddr_id=DDR-03-CHART-APPENDIX` only** | `source_code` is DDR-03 required CFP source; live state == `source_absent_not_supplied`; `system_basis.ddr_id` == evidence.`ddr_id` == DDR-03; **forbidden** for any DIR target, DDR-02, or non-allowlist DDR |

Any mismatch of target / rule / source / condition → **REJECT** (do not persist as Gate-affecting evidence).

#### A3. `user_explicit_na` / `source_ref` (R6-04 / R6-05)

Existence of an id is **not** enough. Fail-closed. **No new E1/E2 types.**

**Eligible source record (ALL required):**

| Check | Rule |
|---|---|
| Exists | Live Fact or Constraint in current DC |
| Not void | Not deleted / superseded / revoked |
| Status | `status === "confirmed"` only |
| Verification | `verification_level === "user_asserted"` |
| E1 | `user_confirmed === true` **and** a persisted FactConfirm (E1) event exists for that record |
| Provenance | Original source is user-originated statement (not model draft) |
| Association | `target=dir`: `related_dir_ids` contains exact `dir_id` (Fact or Constraint). Missing → **REJECT**. `target=ddr`: only DDR-03 path; source must prove **chart appendix not supplied** for the exact required source — unrelated confirmed records **REJECT** |
| Condition | `na_condition_code` exact-match catalog for target; deterministic classifier / persisted user-confirmation classification supports that condition |
| Live | Condition still true at validate time |

**REJECT (never Gate-affecting):** `independently_verified` as user_explicit_na source; `unknown` / `declined` / `unverified` / `user_estimate`; silence; omitted answers; model-only semantic judgment; embedding/keyword-only; Understanding cache claims; DDR-03 calc_failed or provenance_missing dressed as absence.

**Deterministic semantic proof (R6-05):**  
Code MUST use catalog condition + association + E1 + a **code-verifiable** classification (persisted user-confirmed N/A intent linked to the statement). Model may propose classification; it is **not** authoritative until user E1-confirm and persist. If schema cannot prove exact declaration + E1 → **REJECT**.

**DDR-03 user-explicit:** must identify exact required source_code and explicit non-supply; re-read live CFP registry — user statement cannot convert `source_calc_failed` / `source_provenance_missing` into absence.

#### B. Evidence types (summary)

| Type | Allowed if |
|---|---|
| `user_explicit_na` | §A3 + catalog condition |
| `system_na_marker` | §A2 + catalog condition |
| Model / silence / dangling / unknown / declined | **Never** |

#### C. Legality validation (code; all must pass)

```text
REJECT if any:
  - target orphan/dual (§A)
  - ddr path fails allowlist / source-state (§A1)
  - system_basis out of scope or inconsistent (§A2)
  - user_explicit_na fails source_ref semantic checks (§A3)
  - na_condition_code not in catalog for that target
  - revoked=true (audit-only; no satisfaction)
  - written_by ≠ "code" / model-authored

ACCEPT → may feed reaggregateDirs / DDR roll-up / Gate
```

#### D. Rebuild / revoke / hash (R6 lifecycle)

```text
create/revoke ExplicitNaEvidence OR invalidate source_ref OR change Constraint.related_dir_ids
  → DC.version++
  → content_hash via canonicalStringify(extractBusinessPayload)
  → resolveDirRoleEvidence (shared)
  → DIR reaggregate (facts + constraints + na evidence)
  → DDR compose → Gate → Understanding rebuild
```

1. Understanding from DC only; cache never keeps stale N/A.  
2. FreezeRecord.dc_content_hash at E2; prior freezes immutable.  
3. `explicit_na_evidence` + `constraints[].related_dir_ids` ∈ business payload (MC §6.1). Blueprint/DDR versions stay out of DC hash.  

#### E. Non-bypass (frozen)

- unknown/declined ↛ n_a  
- INVALID evidence → no Gate satisfaction via n_a  
- **DDR-02 CFP any non-`source_ok` → `pending` → P0 FAIL; no N/A waiver (Rule A)**  
- **Only DDR-03** may use empty-DIR + `source_absent_not_supplied` N/A  
- DDR-03 `source_calc_failed` / `source_provenance_missing` ≠ N/A

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
