# Decision Intake 2.0 · Phase 3 Question Planning & Generation

| Field | Value |
|---|---|
| **Stage** | 3.1 Design only |
| **Baseline** | `main` @ `ee8c96e8` |
| **Budget defaults** | Soft **12** / Hard **15** asks; depth soft cap **3** (Phase 1 §11) |

Covers **Question Planning**, **Question Generation**, **Blueprint/DIR lifecycle ops used by the Engine**, and **budget / termination**.

---

## 1. CandidateQuestion (plan unit)

Every candidate **must** carry:

```ts
type CandidateQuestion = {
  candidate_id: string;
  ddr_ids: string[];           // ≥1 unless source-only special (rare; prefer DIR)
  dir_ids: string[];           // ≥1 for user Q&A candidates
  missing_info: string;        // gap description
  decision_value: string;      // why it matters for the decision
  ask_now_reason: string;      // why this turn
  expected_info: string;       // what a good answer supplies (roles)
  impact: {
    affects_option_ranking: boolean;
    may_affect_p5_ranking: boolean;
    decision_critical: boolean;
    gate_class: "P0" | "P1" | "P2";
  };
  depth: number;               // 1..3 for this dir thread
  budget_cost: number;         // usually 1
  direction_id: string;        // InvestigationDirection
  blueprint_version: number;
  skip_if?: string[];          // machine-checkable predicates
};
```

No candidate without DDR/DIR trace (except pure system messages). **No** zero-value filler asks.

---

## 2. Planning algorithm (deterministic outline)

```text
Inputs: UnderstandingState, DC, Blueprint, BudgetSnapshot, last AskOutcome
1. If soft Gate says ready_for_review OR user requested review → select none; set skip_reason
2. Collect open NeedItems (need_to_understand)
3. Expand to CandidateQuestion[] via DIR catalog + DDR mapping
4. Filter:
     - dir_id not in Blueprint.dir_ids → drop (out of scope)
     - duplicate of answered-sufficient DIR → drop
     - depth > 3 on same dir_id → drop / escalate to boundary
     - chart-as-fact confirm asks → drop
5. Score (higher first):
     gate_class P0 > P1 > P2
     + may_affect_p5_ranking / decision_critical
     + information_gain_est (unresolved roles / conflict)
     − depth_penalty − repetition_penalty
6. Select top candidate with budget_cost ≤ remaining
7. If none and hard budget not exhausted → may ask meta “anything critical missing?” once (still traced to open P0 if any)
8. If none and gaps remain → termination policy (§5)
```

Model may propose scores; **code** applies filters and final selection.

---

## 3. Question Generation

| Rule | Spec |
|---|---|
| Default | **One** primary NL question per turn |
| Mapping | Must realize `expected_info` / `fact_roles` for `dir_ids` |
| No repeat | Validator rejects same `dir_id`+same role set if already `known` |
| Follow-up | Short clarifier allowed only if prior answer `partial`/`vague` and depth≤3; not a second independent DIR disguised as one sentence |
| Scope | Cannot introduce DIR/DDR outside Blueprint without approved version bump |
| Chart | May reference pattern insight as **optional context**, never “confirm this destiny fact” |
| Language | User-facing; no naked 命理专名 dump as question body (align output contract) |

---

## 4. Question Validation

Reject / replan if:

- Missing `ddr_ids`/`dir_ids`  
- Out-of-Blueprint scope  
- Duplicate of recent ask with no new gap  
- Multi-DIR smuggling (heuristic: >1 unrelated dir_id without explicit multi-target plan flag — default forbid)  
- Schema invalid  

Max replans per turn: **2**; then skip ask + surface soft error / boundary.

---

## 5. Budget & termination

### 5.1 BudgetSnapshot

```ts
type BudgetSnapshot = {
  soft_limit: 12;
  hard_limit: 15;
  asked_count: number;
  remaining_soft: number;
  remaining_hard: number;
  per_dir_depth: Record<string, number>;
};
```

Allocation principle: spend on **P0** gaps first; P1 ranking-critical next; P2 last. Do not burn budget on P2 while P0 open.

### 5.2 Stop / transition

| Condition | Action |
|---|---|
| Soft Gate PASS/WARN ready + disclosures | Enter `understanding_review` (no more ask) |
| Soft budget hit, P0 still open | Continue only on P0 until hard; disclose pressure |
| Hard budget hit, P0 open | **Cannot** freeze PASS; stay investigating or force review with FAIL/WARN honesty — **never** fake completeness |
| Hard budget, only P2 open | May proceed to review; P2 alone must not block (Phase 1) |
| User declines/unknown on P0 DIR | Record declined/unknown; do not mark known; Gate may FAIL |
| Marginal value (depth=3, vague repeats) | Stop that DIR thread; leave gap + boundary |
| Model wants out-of-scope | Reject; no silent Blueprint expand |

**Forbidden:** lower Gate standards, Agenda covered ⇒ known, empty DIR ⇒ satisfied, or inflate ask count for “progress.”

---

## 6. Blueprint & DIR lifecycle (Engine view)

| Op | Rule |
|---|---|
| Read Blueprint | `blueprint_version`, `ddr_version=1.1`, `dir_ids`, directions, `dir_seed_snapshot` |
| Live DIR | **Only** `DC.dirs` |
| Init | Per Phase 2 Blueprint Initialization |
| Rebuild Blueprint | Merge new seeds; **never** reset `current_state` / evidence on existing dirs |
| Deprecate DIR | `id_lifecycle`; dangling rules (Phase 1/2) |
| Agenda | Append ask/answer audit ids onto `agenda_item_ids`; **never** alone flips known |

---

## 7. Generation ↔ Planning outputs to UI

```ts
type AskPayload = {
  question_text: string;
  candidate_id: string;
  understanding_state_id: string;
  budget: BudgetSnapshot;
};
```

---

## 8. Declaration

Docs only. Adaptive planning; no fixed questionnaire product logic.
