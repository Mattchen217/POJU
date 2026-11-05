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
6. Branch (Phase 1 §1.3 / §1.5):
     a. Soft Gate PASS or WARN(+disclosures ready) AND (ready signal OR policy)
          → emit GATE_READY_FOR_REVIEW → understanding_review
     b. USER_REQUEST_REVIEW (soft budget or explicit)
          → understanding_review
            NOTE: if Soft/Review Gate is FAIL, still may show review summary,
            but E2 Freeze remains forbidden (Phase 1: E2 requires Gate ≠ FAIL)
     c. Else if investigable gaps remain (open NeedItems / P0 first)
          → Question Planning → select ≤1 primary CandidateQuestion
             Soft Gate FAIL with gaps ⇒ CONTINUE planning (do NOT terminate investigating)
     d. Else if no candidate and hard-budget / termination policy
          → see Question Planning §5.2 (no new Session state)
7. Question Generation → NL (only if 6c selected a candidate)
8. Question Validation → accept or replan (cap N)
9. Question Delivery persist (phase B) → only then show AskPayload
```

Understanding updates **before** deciding the next question (steps 3–4 before 6c).

### 3.3 After enter `understanding_review`

1. Run **Review Gate** (formal).  
2. Present summary (`SUMMARY_PRESENTED` → `awaiting_user_confirm`).  
3. E2 allowed only if Freeze Gate ≠ FAIL and disclosures OK (Phase 1 §1.3).  
4. Soft Gate FAIL earlier **never** implies Session left `investigating` solely for that reason.

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

Full rules: `PHASE-3-MODEL-CONTRACT.md` §5 (two-phase) and `PHASE-3-QUESTION-PLANNING.md` §5.

- **Phase A Answer Commit** and **Phase B Ask Delivery** are separate short DB transactions.  
- **No LLM inside a DB transaction.**  
- Idempotency key = `(session_id, client_turn_id)`; duplicate → replay AnswerCommitResult (+ AskPayload if B done).  
- Stale `context_version` → reject; AskPayload shown only after Commit B.

---

## 7. Out of scope (Stage 3.1)

Runtime code, schema migrations, UI, prompts in production, Phase 4 report fill, Lockout classifier implementation (Phase 8 per Phase 1.1).

---

## 8. Declaration

Docs only. Preserves Phase 1 C1–C5 and Phase 2 catalogs. No Call A/B; no fixed questionnaire as product logic.
