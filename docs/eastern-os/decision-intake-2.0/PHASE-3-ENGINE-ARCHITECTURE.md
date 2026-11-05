# Decision Intake 2.0 · Phase 3 Engine Architecture

| Field | Value |
|---|---|
| **Stage** | 3.1 Design specification only |
| **Baseline** | `main` @ `ee8c96e8a7a128fa8e059c2a9f81c9f0d2127688` |
| **Authority** | Phase 1 Data Contract / State Machines / C1–C5; Phase 2 DDR/DIR catalogs `1.1` / `1` |
| **Runtime** | **Not implemented in this phase** |

---

## 0. Purpose

Define the **Adaptive Question Engine** module boundaries, turn loop, write authority, and dependencies so a later implementation phase can build without inventing business rules.

**Product intent:** each turn updates Decision Understanding first, then decides whether to ask, what to ask, and when to stop — **not** a fixed questionnaire.

---

## 1. System context

```text
User message
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ Adaptive Question Engine (Intake 2.0)                     │
│  Answer Interpretation → DC Update → Understanding       │
│  → Personal Pattern Insight (read calc)                  │
│  → Question Planning → Generation → Validation           │
│  → Soft Gate → (plan ask | enter review)                 │
│  Review Gate / Freeze Gate at lifecycle points           │
└─────────────────────────────────────────────────────────┘
    │ writes (code only)          │ reads
    ▼                             ▼
 DecisionContext (sole fact SoT)   Blueprint seed (immutable live DIR forbidden)
 DC.dirs (sole live DIR SoT)       PageFeedMatrix / CFP / ZFP (calc)
 FreezeRecord / Gate (later)       SessionLifecycle phase
```

**Hard bans:** Call A/B Intake entry; Stage 1–4 as Intake; Agenda as DIR SoT; second fact DB; model writes unverified RealityFacts; chart-as-confirmed-fact; bypass P0/P1/P2 Gate; inflate progress via question count.

---

## 2. Module map

| Module | Duty | May write DC? | Model role |
|---|---|---|---|
| **Answer Interpretation** | Classify user turn; emit structured deltas (candidates) | No — proposes only | Suggests parse/classify |
| **Decision Context Update** | Apply validated deltas; reaggregate DIRs; refresh DDR status | **Yes** (deterministic) | None |
| **Understanding State Builder** | Derive UI/planner view from DC + Blueprint | Cache only (rebuildable) | May draft prose summaries under code schema |
| **Personal Pattern Insight** | Read CFP/ZFP; produce **insight** objects (not RealityFacts) | No RealityFacts | May phrase insights |
| **Question Planning** | Rank candidate asks from open DIRs/DDRs + budget | No | May propose ranking; code decides |
| **Question Generation** | NL question from selected plan | No | Generates text |
| **Question Validation** | Schema, scope, duplicate, Blueprint bound | No | None |
| **Sufficiency / Gate Evaluation** | Soft per-turn + hard on review/freeze | May set delivery_mode / boundaries only via code | Advise only; **never** declare PASS |

---

## 3. Normative turn pipeline (R1-01)

Aligns Phase 1 State Machines §1.3 / §1.5 / §4.2. **No new Session phases.**

### 3.1 Three Gate moments (must not conflate)

| Gate moment | When | Role |
|---|---|---|
| **Soft Gate** | Each investigating turn after DC write | Advisory UX + planner input; **FAIL does not exit `investigating`** |
| **Review Gate** | On enter `understanding_review` (and before leaving to await confirm) | Formal evaluate; disclosures for WARN; **FAIL blocks E2**, not investigating itself |
| **Freeze Gate** | Before FreezeRecord on E2 | Re-check; **FAIL aborts freeze**; never fake PASS |

### 3.2 Turn steps while `investigating`

```text
0. Load Session + Blueprint@version + DC@version + Lockout check
1. Answer Interpretation (user text → AnswerEvent)
2. Decision Context Update (Answer Commit — see Model Contract two-phase persist)
     → write Definition / Facts / Constraints / Hypotheses / Conflicts
     → reaggregateDirs(DC.dirs)
     → compose DDR statuses (Phase 2 §1.4–§1.5)
3. Rebuild Understanding State (derived)
4. Refresh Personal Pattern Insight (read-only calc)
5. Soft Gate evaluate (advisory; record soft_verdict)
6. Branch (Phase 1 §1.3 / §1.5) — evaluate in order:
     a. Soft Gate PASS or WARN(+disclosures ready) AND (ready signal OR policy)
          → emit GATE_READY_FOR_REVIEW → understanding_review
     b. Soft budget reached for **current review_cycle** OR explicit user review request
          → emit USER_REQUEST_REVIEW → understanding_review
            (Soft cycle budget ALWAYS enters review — even if P0 still open.
             Do NOT auto-extend this cycle to hard. Keep real Gate FAIL.
             Review MUST show unresolved P0 gaps + true Gate verdict.
             Budget fields: Planning §5.1 / Arch §3.4.)
     c. Else if investigable gaps remain (open NeedItems / P0 first)
          AND soft budget for current cycle NOT reached
          AND remaining_hard_budget > 0
          → Question Planning → select ≤1 primary CandidateQuestion
             Soft Gate FAIL with gaps ⇒ CONTINUE planning (do NOT terminate investigating)
     d. Else if hard_budget_reached OR (no candidate + termination policy)
          → Planning §5.2 (no new Session state; no fake PASS; no more ordinary asks)
7. Question Generation → NL (only if 6c selected a candidate)
8. Question Validation → accept or replan (cap N; kind-aware — Planning §4)
9. Question Delivery persist (Commit B) → ShowReceipt protocol → only counted ask after shown (Model Contract §5.3–§5.5)
```

Understanding updates **before** deciding the next question (steps 3–4 before 6c).

### 3.3 After enter `understanding_review`

1. Run **Review Gate** (formal).  
2. Present summary including unresolved NeedItems / P0 gaps and true Gate verdict (`SUMMARY_PRESENTED` → `awaiting_user_confirm`).  
3. E2 allowed only if Freeze Gate ≠ FAIL and disclosures OK (Phase 1 §1.3).  
4. Soft Gate FAIL earlier **never** implies Session left `investigating` solely for that reason.  
5. `USER_REVISE` → `investigating` (Phase 1 §1.3): keep DC draft; bump DC.version; **open a new `review_cycle`** (Arch §3.4) so soft budget is not permanently stuck; **never** reset `session_asked_count` / hard ceiling.

### 3.4 Budget model (R3-01) — session fields

```ts
type SessionBudget = {
  soft_budget_limit: 12;                 // per review_cycle window
  hard_budget_limit: 15;                 // entire Session cumulative ceiling
  session_asked_count: number;           // shown asks only; never decreases; never reset by USER_REVISE
  review_cycle: number;                  // starts 1; +1 on each USER_REVISE return to investigating
  cycle_base_asked: number;              // session_asked_count when current cycle began
  cycle_soft_cap: number;                // min(soft_budget_limit, hard_budget_limit - cycle_base_asked)
  review_entry_reason: null | "gate_ready" | "soft_budget" | "user_request" | "hard_exhausted_ux";
  remaining_hard_budget: number;         // hard_budget_limit - session_asked_count
};
```

| Rule | Spec |
|---|---|
| Hard ceiling | Whole Session; USER_REVISE **cannot** reset or bypass |
| Count | Only AskPayload with durable ShowReceipt (§ MC 5.3); restore same id → no double count |
| Soft reached | `(session_asked_count - cycle_base_asked) >= cycle_soft_cap` |
| On USER_REVISE | `review_cycle++`; `cycle_base_asked = session_asked_count`; recompute `cycle_soft_cap`; clear sticky soft flag for prior cycle |
| Re-trigger review | Soft reached again in new cycle, OR Gate ready, OR explicit user request |
| Hard reached + P0 | Keep FAIL; forbid E2; **no** ordinary asks; no new Session phase; UX OPEN |

---

## 4. Write authority matrix

| Data | Who writes | Notes |
|---|---|---|
| `RealityFact` / `Constraint` | DC Update only after Interpretation + legality (`LEGAL_FACT_COMBINATIONS`) + E1 rules (C1) | Model cannot stamp `confirmed` / `user_confirmed` |
| `Hypothesis` | DC Update from explicit model **hypothesis** channel | Never into `reality_facts` |
| `Conflict` | DC Update when contradiction detected | Clarify needs user confirmation |
| `DC.dirs.*.current_state` | **Only** `reaggregateDirs` | Values ∈ {known, unknown, conflict, n_a} only |
| `DC.explicit_na_evidence` | DC Update (code) after validation | In content_hash; model cannot write |
| Blueprint seed / version | Blueprint builder (init / scoped bump) | No live state |
| Understanding State | Builder (derived) | Not SoT |
| Agenda / AdaptiveQuestionPlan | Planner (execution audit) | covered ≠ DIR known |
| Gate verdict | Code Gate composer | Model may not announce PASS |
| AskPayload / ShowReceipt / AskCountLedger | Persist layer (MC §5) | Count only on ShowReceipt |

---

## 5. Dependencies

| Dependency | Use |
|---|---|
| Phase 1 enums / FreezeRecord / Session phases | Lifecycle |
| Phase 2 DDR/DIR catalogs + Topic Applicability | What can be asked |
| Phase 2 Blueprint Initialization | Seed + version rules |
| `types.ts` DC shapes | Field names |
| `dir-aggregator.ts` / content-hash / confirmation-event | Reuse semantics in implementation |
| PageFeedMatrix | Report faces only — **do not modify**; Engine does not reimplement report |

---

## 6. Persistence & concurrency (summary)

Full rules: `PHASE-3-MODEL-CONTRACT.md` §5 and `PHASE-3-QUESTION-PLANNING.md` §5.

- Phase A / Phase B short TXs; **no LLM inside TX**.  
- AskPayload stable `ask_payload_id`; Commit B ≠ shown.  
- ShowReceipt → exactly-once `session_asked_count` (MC §5.3).  
- `delivery_generation` CAS lifecycle on drift (MC §5.5).  
- Never bind stale AskPayload / old generation NL to new DC.

---

## 7. Out of scope (Stage 3.1)

Runtime code, schema migrations, UI, prompts in production, Phase 4 report fill, Lockout classifier implementation (Phase 8 per Phase 1.1).

---

## 8. Declaration

Docs only. Preserves Phase 1 C1–C5 and Phase 2 catalogs. No Call A/B; no fixed questionnaire as product logic.
