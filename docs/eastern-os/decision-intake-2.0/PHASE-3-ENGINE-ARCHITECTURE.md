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
│  → Soft Gate / readiness                                 │
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

## 3. Normative turn pipeline

```text
0. Load Session + Blueprint@version + DC@version + Lockout check
1. Answer Interpretation (user text → AnswerEvent)
2. Decision Context Update (atomic transaction)
     → write Definition / Facts / Constraints / Hypotheses / Conflicts
     → reaggregateDirs(DC.dirs)
     → compose DDR statuses (Phase 2 §1.4–§1.5)
3. Rebuild Understanding State (derived)
4. Refresh Personal Pattern Insight (read-only calc)
5. Soft Gate evaluate (advisory)
6. If Gate FAIL hard-stop path OR ready for review → skip ask / enter understanding_review
7. Else Question Planning → select ≤1 primary CandidateQuestion
8. Question Generation → NL
9. Question Validation → accept or replan (cap N)
10. Persist turn snapshot + emit UI payload
```

Understanding updates **before** deciding the next question (steps 3–4 before 7).

---

## 4. Write authority matrix

| Data | Who writes | Notes |
|---|---|---|
| `RealityFact` / `Constraint` | DC Update only after Interpretation + legality (`LEGAL_FACT_COMBINATIONS`) + E1 rules (C1) | Model cannot stamp `confirmed` / `user_confirmed` |
| `Hypothesis` | DC Update from explicit model **hypothesis** channel | Never into `reality_facts` |
| `Conflict` | DC Update when contradiction detected | Clarify needs user confirmation |
| `DC.dirs.*.current_state` | **Only** `reaggregateDirs` / lifecycle ops | Blueprint never |
| Blueprint seed / version | Blueprint builder (init / scoped bump) | No live state |
| Understanding State | Builder (derived) | Not SoT |
| Agenda / AdaptiveQuestionPlan | Planner (execution audit) | covered ≠ DIR known |
| Gate verdict | Code Gate composer | Model may not announce PASS |

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

Full rules: see `PHASE-3-MODEL-CONTRACT.md` § persistence and `PHASE-3-QUESTION-PLANNING.md` § budget.

Per turn: one **transaction** with `context_version` optimistic check; idempotency key = `(session_id, client_turn_id)`. Duplicate submit → replay prior result. Concurrent writes → reject stale version.

---

## 7. Out of scope (Stage 3.1)

Runtime code, schema migrations, UI, prompts in production, Phase 4 report fill, Lockout classifier implementation (Phase 8 per Phase 1.1).

---

## 8. Declaration

Docs only. Preserves Phase 1 C1–C5 and Phase 2 catalogs. No Call A/B; no fixed questionnaire as product logic.
