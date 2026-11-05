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
  ddr_ids: string[];           // ≥1 always; sort uses normalized form (§2.1)
  dir_ids: string[];           // dir_based: ≥1; source_only: MUST be []
  source_code?: string;        // required if source_only
  source_state?: "missing" | "pending" | "calc_failed" | "not_ok"; // required if source_only
  user_askable?: boolean;      // required if source_only
  missing_info: string;
  decision_value: string;
  ask_now_reason: string;
  expected_info: string;
  impact: {
    affects_option_ranking: boolean;
    may_affect_p5_ranking: boolean;
    decision_critical: boolean;
    gate_class: "P0" | "P1" | "P2";
  };
  depth: number;               // 1..3 dir_based; 0 source_only
  repetition_count: number;    // code-owned (§2.1); never from model
  budget_cost: number;         // usually 1 if shown
  direction_id: string;
  blueprint_version: number;
  skip_if?: string[];
};
```

No candidate without DDR trace. `dir_based` requires DIR(s); `source_only` forbids inventing DIRs and forbids non-empty `dir_ids`. **No** zero-value filler asks.

---

## 2. Planning algorithm (deterministic outline)

```text
Inputs: UnderstandingState, DC, Blueprint, BudgetSnapshot, Soft Gate verdict, last AskOutcome
1. If Soft Gate PASS|WARN(+disclosures ready AND ready policy)
     OR soft_budget_reached
     OR explicit USER_REQUEST_REVIEW
     → select none; set skip_reason=enter_review
     → investigating → understanding_review (Phase 1 §1.3)
     → Soft budget ALWAYS enters review even if P0 open (R2-01); keep real FAIL
     → Soft Gate FAIL alone (budget not reached) does NOT skip planning when gaps remain
2. Collect open NeedItems (DIR gaps + source-only gaps; see Understanding State)
3. Expand to CandidateQuestion[] via DIR/DDR catalogs (no invented DIRs)
4. Filter + validate by kind (§4):
     - dir_based: dir_id not in Blueprint.dir_ids → drop
     - source_only: user_askable=false → do NOT emit NL CandidateQuestion;
         keep NeedItem for Gate/UX supply path (gap not discarded)
     - source_only: user_askable=true → allow supply-style candidate (empty dir_ids)
     - duplicate of answered-sufficient DIR → drop
     - depth > 3 on same dir_id → drop / escalate to boundary
     - chart-as-fact confirm asks → drop
5. Deterministic sort (§2.1); select top with budget_cost ≤ remaining_hard
6. If none and gaps remain → termination policy (§5.2)
```

Model may propose scores; **code** applies filters and **final** sort. Model scores never override hard P0>P1>P2.

### 2.1 Scoring & tie-break (R2-05)

**`information_gain_est` (default, code-owned; model hints ignored for final rank):**

```text
gain = 0
+ 3 per unresolved required_fact_role on target DIR (dir_based only)
+ 4 if gap_type=conflict
+ 2 if gap_type=partial
+ 5 if impact.decision_critical OR may_affect_p5_ranking
+ 2 if Soft Gate FAIL attributable to this ddr/dir/source
+ 6 if source_only AND required source not source_ok on P0 DDR
```

**`repetition_count` (code-owned; never from model):**

| Aspect | Rule |
|---|---|
| Source | Session ask audit / Agenda ask records for this session |
| Scope | Shown AskPayloads only (persisted + delivered) |
| dir_based | Count of shown asks whose primary `dir_ids` intersect this candidate’s `dir_ids` AND overlapping `expected_info` / fact_role set |
| source_only | Count of shown asks with same `source_code` (+ same `ddr_ids` normalized) |
| Generation retry / validation reject / unshown NL | **Does not** increment |
| Idempotent replay of same AskPayload | **Does not** increment |
| Reset | New session; or after ask thread superseded on `USER_REVISE` (**OPEN product** for finer mid-session reset — default: no reset except supersede) |

**Normalize before sort:**

```text
normalized_ddr_ids = unique(ddr_ids).sort(lexicographic)
primary_dir_id     = min(dir_ids) if kind=dir_based else ""
primary_source     = source_code if kind=source_only else ""
kind_rank          = dir_based=0, source_only=1   // tie-break only; NOT over P0/P1/P2
```

Same DDR set with different input order ⇒ same `normalized_ddr_ids` ⇒ same sort outcome.

**Sort key (descending on ranks/gain; ascending on penalties; then stable tie-break):**

1. `gate_class` rank: P0=3 > P1=2 > P2=1 (**hard; model gain cannot override**)  
2. `may_affect_p5_ranking` then `decision_critical` (true first)  
3. `information_gain_est` (higher first)  
4. Lower `depth` first  
5. Lower `repetition_count` first  
6. Stable tie-break (lexicographic ascending):  
   `kind_rank` → `primary_dir_id` → `primary_source` → `normalized_ddr_ids.join(",")` → `candidate_id`

Same DC version + same Blueprint version + same ask audit ⇒ **deterministic** order.

**Weights note:** gain constants are a default implementation basis, not a trained model. Retunable without changing Gate / P0>P1>P2.

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

## 5. Budget & termination (R2-01)

Session path remains Phase 1 only:

`investigating → understanding_review → awaiting_user_confirm`  
(`USER_REVISE` → `investigating`; E2 → `frozen` only if Freeze Gate ≠ FAIL).

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

Allocation while still investigating (soft budget **not** reached): P0 first; P1 ranking-critical next; P2 last.

### 5.2 Stop / transition (aligned Phase 1 §1.3 / §4.2)

| Condition | Session / ask behavior | Freeze |
|---|---|---|
| Soft Gate **PASS** or **WARN** (+ disclosures ready) | Emit `GATE_READY_FOR_REVIEW` → `understanding_review`; no further ask this path | Freeze later only if Freeze Gate ≠ FAIL; WARN → conditional/`degraded` OK |
| Soft Gate **FAIL** + investigable gaps + soft budget **not** reached | **Stay `investigating`**; continue Question Planning (**P0 first**) | E2 forbidden while FAIL |
| Soft Gate **FAIL** + explicit `USER_REQUEST_REVIEW` | Enter `understanding_review` with honest FAIL + open P0 list; **must not** present as PASS | E2 forbidden |
| **Soft budget reached** (P0 open or not) | Emit `USER_REQUEST_REVIEW` → `understanding_review` (**Phase 1 frozen**). Do **not** auto-extend investigating to hard. Keep real Gate FAIL if P0 open. Review shows unresolved gaps. | No PASS freeze while FAIL |
| After review, `USER_REVISE` | Return `investigating` (Phase 1); keep DC; bump version; may ask under remaining hard budget | — |
| Hard budget exhausted; P0 open | **Must** keep FAIL; **forbid** E2; **no** fake completeness; **no** new Session state. **OPEN product:** UX copy / whether to surface review CTA vs stay on investigating screen — underlying Gate/Freeze rules fixed | FAIL / no E2 |
| Hard budget; only P2 open | May enter `understanding_review`; P2 alone must not block report (Phase 1) | Allowed if Gate else OK |
| P1 unsatisfied, non-ranking, complete L, boundaries | WARN path preserved (Phase 1 §3.3 / §4.2) | Conditional freeze OK if Freeze Gate WARN |
| Unknown / declined on DIR | Record as unknown/declined; **never** auto `known` or `n_a` | Gate uses real status |
| Marginal value (depth=3) | Stop that DIR thread; leave gap + boundary | — |
| Out-of-scope model ask | Reject | — |

**Forbidden:** treat soft budget as license to keep asking; extend budget ad hoc to fake completeness; lower Gate standards; Agenda covered ⇒ known; empty DIR ⇒ satisfied; inflate ask count; invent Session phases; conflate explicit user review request with “system extends soft→hard investigating.”

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
