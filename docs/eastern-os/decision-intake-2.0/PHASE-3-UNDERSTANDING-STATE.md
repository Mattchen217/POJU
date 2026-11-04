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
| **Structure** | `{ items: UnderstoodItem[] }` where `UnderstoodItem = { dir_id; label; fact_ids; status: "known"\|"n_a"; user_confirmed_any: boolean }` |
| **Definition** | DIRs that are `known` or `n_a` with evidence |
| **Source** | `DC.dirs` + contributing RealityFacts/Constraints |
| **Update** | After DIR reaggregation |
| **Model inference** | **Forbidden** to mark understood without DC state |
| **vs confirmed** | `user_confirmed_any` reflects E1 on contributing facts (C1); independently_verified ⇒ `user_confirmed_any=false` |
| **Trace** | Each item → `dir_id` + `fact_ids` |

### 2.3 `need_to_understand`

| Aspect | Spec |
|---|---|
| **Structure** | `{ items: NeedItem[] }` where `NeedItem = { dir_id; ddr_ids; priority: "P0"\|"P1"\|"P2"; why; may_affect_p5_ranking; gap_type: "unknown"\|"partial"\|"conflict"\|"declined"\|"source_pending" }` |
| **Definition** | Open information gaps driving the next ask |
| **Source** | Active DIRs not known/n_a; required-source misses (Phase 2 §1.3); open conflicts |
| **Update** | After DDR compose + source check |
| **Model inference** | May reorder presentation; **cannot** invent new DIR ids outside Blueprint |
| **vs confirmed** | Gaps are absences/conflicts — never written as facts |
| **Trace** | `dir_id` → catalog + live `DC.dirs`; `ddr_ids` from Phase 2 mapping |

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
