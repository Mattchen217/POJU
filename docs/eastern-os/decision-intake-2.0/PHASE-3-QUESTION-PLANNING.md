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
type FactRoleCode = string; // namespaced, versioned — see §2.2 (NOT free-text)

type CandidateQuestion = {
  candidate_id: string;        // code-generated deterministic — §2.3; never model/random/time
  kind: "dir_based" | "source_only";
  ddr_ids: string[];           // ≥1; sort uses normalized form
  dir_ids: string[];           // dir_based: ≥1; source_only: MUST be []
  source_code?: string;        // required if source_only
  source_state?: "missing" | "pending" | "calc_failed" | "not_ok";
  user_askable?: boolean;
  fact_role_codes: FactRoleCode[]; // structured authority for repetition / identity
  missing_info: string;        // NL explanation only
  decision_value: string;      // NL only
  ask_now_reason: string;      // NL only
  expected_info: string;       // NL only — NOT used as repetition key
  impact: {
    affects_option_ranking: boolean;   // from DDR/DIR catalog flags (code)
    may_affect_p5_ranking: boolean;    // from DDR catalog (code)
    decision_critical: boolean;        // from DDR catalog (code)
    gate_class: "P0" | "P1" | "P2";    // code from DDR priorities — §2.4; model hint ignored
  };
  depth: number;
  repetition_count: number;    // §2.1 algorithm; code-owned
  budget_cost: number;
  direction_id: string;
  blueprint_version: number;
  id_schema_version: 1;        // bumped only when candidate_id canon changes
  skip_if?: string[];
};
```

No candidate without DDR trace. `dir_based` requires DIR(s); `source_only` forbids inventing DIRs and forbids non-empty `dir_ids`. **No** zero-value filler asks. R2-02 kind-aware validation (§4) unchanged in intent.

---

## 2. Planning algorithm (deterministic outline)

```text
Inputs: UnderstandingState, DC, Blueprint, BudgetSnapshot, Soft Gate verdict, last AskOutcome
1. If Soft Gate PASS|WARN(+disclosures ready AND ready policy)
     OR soft_budget_reached for current review_cycle (§5.1)
     OR explicit USER_REQUEST_REVIEW
     → select none; set skip_reason=enter_review; set review_entry_reason
     → investigating → understanding_review (Phase 1 §1.3)
     → Soft cycle budget ALWAYS enters review even if P0 open; keep real FAIL
     → Soft Gate FAIL alone (cycle soft not reached) does NOT skip planning when gaps remain
2. Collect open NeedItems (DIR gaps + source-only gaps; see Understanding State)
3. Expand to CandidateQuestion[] via DIR/DDR catalogs (no invented DIRs)
   → assign gate_class (§2.4), fact_role_codes (§2.2), candidate_id (§2.3)
4. Filter + validate by kind (§4) — R2-02 unchanged:
     - dir_based: dir_id not in Blueprint.dir_ids → drop
     - source_only: user_askable=false → do NOT emit NL CandidateQuestion;
         keep NeedItem for Gate/UX supply path (gap not discarded)
     - source_only: user_askable=true → allow supply-style candidate (empty dir_ids)
     - duplicate of answered-sufficient DIR → drop
     - depth > 3 on same dir_id → drop / escalate to boundary
     - chart-as-fact confirm asks → drop
5. Deterministic sort (§2.1); select top with budget_cost ≤ remaining_hard_budget
6. If none and gaps remain → termination policy (§5.2)
```

Model may propose scores / priority hints; **code** applies filters, `gate_class`, and **final** sort. Model never overrides P0>P1>P2.

### 2.1 Scoring, repetition_count, sort (R3-04)

**`information_gain_est` (code-owned; model hints ignored for final rank):**

```text
gain = 0
+ 3 per unresolved fact_role_code on target DIR (dir_based)
+ 4 if gap_type=conflict
+ 2 if gap_type=partial
+ 5 if impact.decision_critical OR may_affect_p5_ranking
+ 2 if Soft Gate FAIL attributable to this ddr/dir/source
+ 6 if source_only AND required source not source_ok on P0 DDR
```

**`repetition_count` algorithm (deterministic; never model similarity):**

```text
Inputs:
  H = all AskPayload in session where delivery_status=shown
      (exclude: unshown, stale, discarded, invalidated, superseded)
  C = current candidate
  Match key K(x):
    if x.kind=dir_based:
      (kind, sort(unique(dir_ids)).join("|"), sort(unique(fact_role_codes)).join("|"))
      // ddr_ids NOT required in key (multi-DDR same roles still count as repeat)
    if x.kind=source_only:
      (kind, source_code, sort(unique(ddr_ids)).join("|"))
  Cross-kind: never match (dir_based ≠ source_only)
  Blueprint version: historical shown asks still count after Blueprint bump
    (identity is role/source based, not blueprint_version)
  review_cycle: does NOT reset repetition_count (session-scoped)

repetition_count(C) = |{ h ∈ H | K(h) == K(C) }|
```

Unshown / stale / discarded → **not** in H. Same AskPayload resume → already in H once.

**Normalize before sort:**

```text
normalized_ddr_ids = unique(ddr_ids).sort(lexicographic)
normalized_roles   = unique(fact_role_codes).sort(lexicographic)
primary_dir_id     = min(dir_ids) if kind=dir_based else ""
primary_source     = source_code if kind=source_only else ""
kind_rank          = dir_based=0, source_only=1
gate_rank          = P0=3, P1=2, P2=1
```

**Final sort key (no undefined tie-break):**

| # | Field | Order |
|---|---|---|
| 1 | `gate_rank` | DESC (P0 first) — **hard; model cannot override** |
| 2 | `may_affect_p5_ranking` | true before false |
| 3 | `decision_critical` | true before false |
| 4 | `information_gain_est` | DESC |
| 5 | `depth` | ASC |
| 6 | `repetition_count` | ASC |
| 7 | `kind_rank` | ASC |
| 8 | `primary_dir_id` | ASC lex |
| 9 | `primary_source` | ASC lex |
| 10 | `normalized_ddr_ids.join(",")` | ASC lex |
| 11 | `candidate_id` | ASC lex |

Same DC + Blueprint + shown-ask set ⇒ identical order.

### 2.2 `fact_role_codes` (structured; R3-04)

| Rule | Spec |
|---|---|
| Namespace | `v1/dir/{dir_id}/role/{role_code}` or `v1/source/{source_code}` |
| Authority | DIR Catalog `required_fact_roles` / Phase 2 Required Source codes — **not** NL |
| Version | Prefix `v1/`; new roles use new codes; **must not** rename old codes silently |
| NL fields | `expected_info` / `missing_info` are display only; **forbidden** as repetition keys |
| Compare | Always via sorted unique `fact_role_codes` |

### 2.3 `candidate_id` (deterministic; R3-04)

```text
canon = JSON canonical object (keys sorted) {
  id_schema_version: 1,
  kind, blueprint_version,
  dir_ids: sort(unique(dir_ids)),
  source_code: source_code ?? "",
  fact_role_codes: sort(unique(fact_role_codes)),
  ddr_ids: sort(unique(ddr_ids)),
  direction_id
}
candidate_id = "cq_" + hex(sha256(utf8(canon)))[0:32]
```

- No random, no clock, no model id.  
- Same inputs ⇒ same id.  
- Distinct logical gaps must differ in at least one canon field (do not over-collapse).  
- Changing `id_schema_version` is an intentional break; bump only with migration note.

### 2.4 `gate_class` authority (R3-04)

```text
For candidate C with ddr_ids D:
  priorities = map each d ∈ D → DDR Catalog.priority ∈ {P0,P1,P2}
  gate_class(C) = strongest(priorities) where P0 > P1 > P2
```

- Computed by **code** from DDR Catalog only.  
- Model priority hint / confidence / NL **ignored**.  
- Multi-DDR → strongest wins (P0 dominates).  
- Same D ⇒ same `gate_class`.

---

## 3. Question Generation

| Rule | Spec |
|---|---|
| Default | **One** primary NL question per turn |
| Mapping | `dir_based`: realize `expected_info` / `fact_roles` for `dir_ids`. `source_only`: request supply of `source_code` only |
| No repeat | Validator rejects same dir/role set or same source_code if already resolved |
| Follow-up | Short clarifier allowed only if prior answer `partial`/`vague` and depth≤3; not a second independent DIR disguised as one sentence |
| Scope | Cannot introduce DIR/DDR outside Blueprint without approved version bump |
| Chart | May reference pattern insight as **optional context**, never “confirm this destiny fact” |
| Language | User-facing; no naked 命理专名 dump as question body (align output contract) |
| Non-askable source | `user_askable=false` → **no** NL Generation; route to supply UX / soft FAIL attribution |

---

## 4. Question Validation (R2-02 · kind-aware)

Validation **branches on `kind`**. Do **not** apply a blanket “missing dir_ids → reject” to `source_only`.

### 4.1 Common

- Schema valid; `kind` present; `ddr_ids.length ≥ 1`  
- Every `ddr_id` ∈ Phase 2 DDR Catalog  
- `blueprint_version` matches session bind  
- Duplicate of recent ask with no new gap → reject  
- Chart-as-fact confirm → reject  
- Max replans per turn: **2**; then skip ask + soft error / boundary  

### 4.2 `kind = dir_based`

| Check | Rule |
|---|---|
| `dir_ids` | **Must be non-empty** |
| Scope | Every `dir_id` ∈ Blueprint.active `dir_ids` and DIR Catalog |
| Trace | Each DIR maps to at least one listed `ddr_id` via Phase 2 mapping |
| Invented DIR | Forbidden |
| Multi-DIR | >1 unrelated `dir_id` without explicit multi-target flag → reject (default) |
| `source_code` / `source_state` / `user_askable` | Must be absent |

### 4.3 `kind = source_only`

| Check | Rule |
|---|---|
| `dir_ids` | **Must be empty** — must **not** require non-empty |
| `source_code` | Required; must match Phase 2 Required Source definition for the DDR |
| `ddr_ids` | Non-empty; each id is a real DDR that declares that required source |
| `source_state` | One of `missing` \| `pending` \| `calc_failed` \| `not_ok` |
| `user_askable` | Required boolean |
| Convert to dir_based | **Forbidden** (no fictional DIR) |
| `user_askable=true` | May generate supply-style NL question |
| `user_askable=false` | Must **not** generate ordinary NL; keep NeedItem; supply UX or explicit non-supply handling — **do not drop** Required Source gap |

---

## 5. Budget & termination (R3-01)

Session path remains Phase 1 only:

`investigating → understanding_review → awaiting_user_confirm`  
(`USER_REVISE` → `investigating`; E2 → `frozen` only if Freeze Gate ≠ FAIL).

### 5.1 BudgetSnapshot (aligned Arch §3.4)

```ts
type BudgetSnapshot = {
  soft_budget_limit: 12;
  hard_budget_limit: 15;
  session_asked_count: number;     // ShowReceipt counted; session cumulative
  remaining_hard_budget: number;   // hard_budget_limit - session_asked_count
  review_cycle: number;
  cycle_base_asked: number;
  cycle_soft_cap: number;          // min(soft_budget_limit, hard_budget_limit - cycle_base_asked)
  cycle_asked: number;             // session_asked_count - cycle_base_asked
  remaining_soft_in_cycle: number; // max(0, cycle_soft_cap - cycle_asked)
  soft_budget_reached: boolean;    // cycle_asked >= cycle_soft_cap
  hard_budget_reached: boolean;    // session_asked_count >= hard_budget_limit
  review_entry_reason: null | "gate_ready" | "soft_budget" | "user_request" | "hard_exhausted_ux";
  per_dir_depth: Record<string, number>;
};
```

**Counting (exactly-once; see Model Contract §5.3):**

| Event | `session_asked_count` |
|---|---|
| Commit B persist only | **No** |
| First durable ShowReceipt for `ask_payload_id` | **Yes** (+1) |
| Duplicate ShowReceipt / UI retry / re-render | **No** |
| Restore + show same `ask_payload_id` | **No** |
| Generation fail / unshown / stale / discarded | **No** |

**USER_REVISE soft recovery (normative):**

```text
On USER_REVISE → investigating:
  review_cycle += 1
  cycle_base_asked = session_asked_count   // soft window resets HERE
  cycle_soft_cap = min(soft_budget_limit, hard_budget_limit - cycle_base_asked)
  soft_budget_reached = false              // prior cycle soft flag cleared
  // session_asked_count UNCHANGED — hard ceiling intact
```

Example: soft 12 / hard 15; after 12 shown → review; USER_REVISE → new cycle with `cycle_soft_cap=3`; after 3 more shown → soft review again; total cannot exceed 15.

**`per_dir_depth`:** +1 per shown ask targeting that `dir_id`. Cap 3. Source-only uses `source_gap_attempts` (**OPEN** UX depth).

### 5.2 Stop / transition (Phase 1 §1.3 / §4.2)

| Condition | Session / ask behavior | Freeze |
|---|---|---|
| Soft Gate **PASS**/**WARN** (+ disclosures) | `GATE_READY_FOR_REVIEW` → `understanding_review` | Freeze later if Freeze Gate ≠ FAIL |
| Soft Gate **FAIL** + gaps + cycle soft **not** reached + remaining_hard > 0 | Stay `investigating`; Plan P0 first | E2 forbidden while FAIL |
| Explicit `USER_REQUEST_REVIEW` | → `understanding_review`; honest Gate; show P0 gaps | E2 forbidden if FAIL |
| **Cycle soft budget reached** (P0 open or not) | `USER_REQUEST_REVIEW` → `understanding_review`; keep FAIL if P0 open; **do not** keep asking in this cycle | No PASS while FAIL |
| `USER_REVISE` | → `investigating`; new `review_cycle` (§5.1); may ask while remaining_hard > 0 | — |
| **Hard budget reached**; P0 open | Keep FAIL; forbid E2; **stop ordinary asks**; no new Session phase; UX OPEN | FAIL / no E2 |
| Hard reached; only P2 open | May review; P2 alone must not block report | Per Gate |
| Multiple USER_REVISE | Allowed; **cannot** raise hard ceiling or reset `session_asked_count` | — |
| P1 WARN path | Preserved (Phase 1 §3.3 / §4.2) | Conditional OK |
| Unknown / declined | Never auto `known`/`n_a` | Real status |
| Marginal depth=3 | Stop DIR thread; leave gap | — |

**Forbidden:** sticky soft flag blocking post-REVISE investigates; reset hard via REVISE; fake PASS; invent Session phases; count unshown asks.

---

## 6. Blueprint & DIR lifecycle (Engine view)

| Op | Rule |
|---|---|
| Read Blueprint | `blueprint_version`, `ddr_version=1.1`, `dir_ids`, directions, `dir_seed_snapshot` |
| Live DIR | **Only** `DC.dirs` |
| Init | Per Phase 2 Blueprint Initialization |
| Rebuild Blueprint | Merge **new seed only**; **never** overwrite live `current_state` / user evidence on existing dirs |
| After bump | Reconcile affected `DC.dirs` per Phase 2; rebuild Understanding; re-run Soft Gate; re-validate candidates vs **new** Blueprint scope |
| Stale NL | NL generated under old Blueprint and not yet Commit B → **discard**; never persist as AskPayload |
| Deprecate DIR | `id_lifecycle`; dangling rules (Phase 1/2) |
| Agenda | Append ask/answer audit ids onto `agenda_item_ids`; **never** alone flips known |

---

## 7. Generation ↔ Planning outputs to UI

UI consumes AskPayload per Model Contract §5.3 (`ask_payload_id`, `delivery_status`, ShowReceipt). Planning attaches:

```ts
type AskPayloadView = {
  ask_payload_id: string;
  candidate_id: string;
  question_text: string;
  understanding_state_id: string;
  budget: BudgetSnapshot;
  delivery_status: "persisted_unshown" | "shown";
};
```

---

## 8. Declaration

Docs only. Adaptive planning; no fixed questionnaire product logic.
