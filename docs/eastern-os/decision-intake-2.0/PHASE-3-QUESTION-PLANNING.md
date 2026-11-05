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
  kind: "dir_based" | "source_only";
  ddr_ids: string[];           // ≥1
  dir_ids: string[];           // ≥1 if dir_based; empty if source_only
  source_code?: string;        // required if source_only
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
  depth: number;               // 1..3 for dir_based; 0 for source_only
  budget_cost: number;         // usually 1 if shown
  direction_id: string;        // InvestigationDirection (or "source_supply")
  blueprint_version: number;
  skip_if?: string[];          // machine-checkable predicates
};
```

No candidate without DDR trace (and DIR for `dir_based`). Source-only must not invent DIRs. **No** zero-value filler asks.

---

## 2. Planning algorithm (deterministic outline)

```text
Inputs: UnderstandingState, DC, Blueprint, BudgetSnapshot, Soft Gate verdict, last AskOutcome
1. If USER_REQUEST_REVIEW OR (Soft Gate PASS|WARN with disclosures ready AND ready policy)
     → select none; set skip_reason=enter_review
     → Session may transition investigating → understanding_review (Phase 1 §1.3)
     → Soft Gate FAIL alone does NOT skip planning when gaps remain (R1-01)
2. Collect open NeedItems (DIR gaps + source-only gaps; see Understanding State)
3. Expand to CandidateQuestion[] via DIR/DDR catalogs (no invented DIRs)
4. Filter:
     - dir_based: dir_id not in Blueprint.dir_ids → drop
     - source_only: no user Q if product marks non-askable (e.g. wait for profile supply UX)
     - duplicate of answered-sufficient DIR → drop
     - depth > 3 on same dir_id → drop / escalate to boundary
     - chart-as-fact confirm asks → drop
5. Deterministic sort (§2.1); select top with budget_cost ≤ remaining_hard
6. If none and gaps remain → termination policy (§5.2)
```

Model may propose scores; **code** applies filters and **final** sort. Model scores never override hard P0>P1>P2.

### 2.1 Scoring & tie-break (R1-07)

**`information_gain_est` (default, code-owned):**

```text
gain = 0
+ 3 per unresolved required_fact_role on target DIR
+ 4 if gap_type=conflict
+ 2 if gap_type=partial
+ 5 if impact.decision_critical OR may_affect_p5_ranking
+ 2 if Soft Gate FAIL attributable to this ddr/dir
(source_only gaps: +6 if required source not source_ok on P0 DDR — still may be non-askable)
```

**Sort key (descending lexicographic; stable):**

1. `gate_class` rank: P0=3, P1=2, P2=1  
2. `may_affect_p5_ranking` / `decision_critical` (true first)  
3. `information_gain_est`  
4. Lower `depth` first  
5. Lower `repetition_count` first  
6. Tie-break: lexicographic `dir_id` then `ddr_ids[0]` then `candidate_id`

**Weights note:** numeric gain is a **default implementation basis**, not a trained model. Product may retune constants later without changing Gate semantics.

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

## 5. Budget & termination (R1-02)

Session path remains Phase 1 only:

`investigating → understanding_review → awaiting_user_confirm`  
(then E2 → `frozen` only if Freeze Gate ≠ FAIL).

### 5.1 BudgetSnapshot & counting

```ts
type BudgetSnapshot = {
  soft_limit: 12;
  hard_limit: 15;
  asked_count: number;       // see counting rules
  remaining_soft: number;
  remaining_hard: number;
  per_dir_depth: Record<string, number>;
};
```

**`asked_count` counting (normative):**

| Event | Counts toward asked_count? |
|---|---|
| Primary question **persisted and shown** to user | **Yes** (+1) |
| Allowed short follow-up clarifier on same DIR (depth+1), shown | **Yes** (+1) |
| Model generation retry / invalid schema / validation reject before show | **No** |
| Failed generation never shown | **No** |
| Soft Gate / Review / system status messages | **No** |
| Idempotent replay of same AskPayload | **No** (already counted) |

**`per_dir_depth`:** increments when a shown ask targets that `dir_id` (primary or clarifier). Cap soft **3** (Phase 1). Source-only gaps do not use dir depth; they use a separate `source_gap_attempts` counter (max 1 system prompt to supply birth data — **OPEN product** if more UX steps needed).

Allocation: P0 gaps first; P1 ranking-critical next; P2 last. Do not burn budget on P2 while P0 open.

### 5.2 Stop / transition (aligned Phase 1 §1.3 / §4.2)

| Condition | Session / ask behavior | Freeze |
|---|---|---|
| Soft Gate **PASS** or **WARN** (+ disclosures ready) | May emit `GATE_READY_FOR_REVIEW` → `understanding_review`; no further ask this path | Freeze later only if Freeze Gate ≠ FAIL; WARN → conditional/`degraded` OK |
| Soft Gate **FAIL** + investigable gaps | **Stay `investigating`**; continue Question Planning (**P0 first**) | E2 forbidden while FAIL |
| Soft Gate **FAIL** + user `USER_REQUEST_REVIEW` | May enter `understanding_review` to show honest summary; **must not** present as PASS | E2 still forbidden |
| Soft budget reached; P0 still open | **Default:** continue investigating on **P0-only** candidates until hard; UX discloses budget pressure | No PASS freeze |
| Soft budget reached; no P0 open | Default offer / auto `USER_REQUEST_REVIEW` path → `understanding_review` | Per Review/Freeze Gate |
| Hard budget exhausted; P0 open | **OPEN product decision:** remain `investigating` with “budget exhausted + critical gaps” UX **or** enter `understanding_review` with FAIL honesty — Phase 1 does **not** define a new Session state. Either way: **no fake completeness**; **no Freeze PASS** | FAIL / no E2 |
| Hard budget; only P2 open | May enter `understanding_review`; P2 alone must not block report (Phase 1) | Allowed if Gate else OK |
| P1 unsatisfied, non-ranking, complete L, boundaries | WARN path preserved (Phase 1 §3.3 / §4.2) | Conditional freeze OK if Freeze Gate WARN |
| Unknown / declined on DIR | Record as unknown/declined; **never** auto `known` or `n_a` | Gate uses real status |
| Marginal value (depth=3) | Stop that DIR thread; leave gap + boundary | — |
| Out-of-scope model ask | Reject | — |

**Forbidden:** extend budget ad hoc to fake completeness; lower Gate standards; Agenda covered ⇒ known; empty DIR ⇒ satisfied; inflate ask count for progress; invent Session phases beyond Phase 1.

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
