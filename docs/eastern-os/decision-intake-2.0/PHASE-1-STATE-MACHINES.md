# Decision Intake 2.0 · Phase 1 State Machines & Lifecycles

| Field | Value |
|---|---|
| **Companion** | `PHASE-1-DATA-CONTRACT.md` |
| **Base SHA** | `297544134d7dcc8c942d5d314760bc3f4a75423f` |
| **Product SSOT** | Architecture plan §§3–4, §8–9 |
| **Rule** | **Session lifecycle ≠ Lockout state machine** |

---

## 0. Separation of machines

| Machine | Owns | Must not own |
|---|---|---|
| **M1 Session / Intake lifecycle** | Blueprint → investigate → confirm → freeze → report | Abuse lockout counters |
| **M2 Per-turn investigation loop** | Ask → interpret → update DC → replan | PASS spend policy text |
| **M3 Lockout / invalid input** | invalid_streak, lockout_count, cool-down, terminate | Formal DC fact writes |
| **M4 Sufficiency & Freeze** | Gate verdict → understanding review → freeze | Agenda covered % as PASS |

Legacy `advanceStateMachine` / AgentPhase is **not** M1 SoT. It may be referenced only as migration debt.

---

## 1. M1 — Session / Intake lifecycle

```text
[start]
   │
   ▼
intake_init ──(definition seed + profile load)──► blueprint_building
   │
   ▼
blueprint_ready ──(scope locked)──► investigating
   │
   │◄──────────── (revise after user correction) ──┐
   ▼                                                 │
understanding_review ──(user confirms)──► awaiting_user_confirm
   │                         │                      │
   │                         ├── modify/supplement ─┘
   │                         ▼
   │                      frozen
   │                         │
   │                         ▼
   │                      reporting ──► closed
   │
   ├── budget hard-cap with FAIL critical ──► understanding_review (bounded/conditional)
   ├── user abandons ──► closed
   └── retain 24h elapsed ──► expired  (≠ lockout strike)
```

### Transitions (normative)

| From | Event | To | Guards |
|---|---|---|---|
| `intake_init` | Initial understanding + blueprint draft OK | `blueprint_ready` | Definition minimum fields present (product: event/question/outcome progressively) |
| `blueprint_ready` | Scope lock recorded | `investigating` | Blueprint version persisted |
| `investigating` | Sufficiency PASS or WARN+user path / hard-cap policy | `understanding_review` | Gate evaluated by **code**; model advisory only |
| `understanding_review` | Summary shown | `awaiting_user_confirm` | Summary includes unknowns/conflicts |
| `awaiting_user_confirm` | User confirms | `frozen` | Freeze eligibility (M4) |
| `awaiting_user_confirm` | User modifies | `investigating` or re-`understanding_review` | Re-evaluate DIR/DDR/Gate |
| `frozen` | Report job start | `reporting` | Binding triple present |
| `reporting` | Report complete | `closed` | |
| any active | 24h retain without resume | `expired` | Does **not** increment `lockout_count` |
| any | 3rd lockout terminate | `closed` (terminated) | Via M3 |

**Forbidden:** Jump from `investigating` to `frozen` without understanding confirm (product §9.2–9.3).  
**Forbidden:** Enter report while DC `status !== final` when Stage-4 require-DC path is on.

---

## 2. M2 — Per-turn investigation loop

Executed only while Session ∈ `investigating` **and** Lockout ∉ locked/terminated.

```text
load DecisionUnderstanding snapshot (same struct for UI + model)
        │
        ▼
Adaptive Question Engine
  - read Blueprint, DC, DDR/DIR
  - pick one gap (priority P0→P1→P2; dependency-aware)
  - enforce scope_boundary + budget + depth
  - emit AdaptiveQuestionPlan (+ optional Agenda enqueue)
        │
        ▼
present question (+ ≤3 options)
        │
        ▼
user input
        │
        ├── classify: valid_answer | unknown/declined | invalid_input
        │
        ▼
Answer Interpretation (model propose → **code validate** → write DC)
        │
        ├── RealityFact / Constraint / Hypothesis / Conflict updates
        ├── reaggregateDirs
        ├── update direction/DDR derived status
        ├── reset invalid_streak if valid
        │
        ▼
Decision Readiness evaluation (code)
        │
        ├── continue → next turn
        └── stop candidate → understanding_review
```

### 2.1 Investigation direction initialization

| Step | Action |
|---|---|
| 1 | Initial Decision Understanding model call (product §10.1 A) |
| 2 | Blueprint Initialization (§10.1 B) — directions + DDR + DIR seeds — **not** full question list |
| 3 | Persist Blueprint v1; set `scope_locked` |
| 4 | Seed DC draft Definition + opening Facts (reuse `seedDecisionContextFromOpening` patterns; **new** Intake writer) |
| 5 | Load PersonalAnalysisProfile (read-only) |

**Must not:** Call B agenda factory as Intake blueprint initializer.

### 2.2 After each answer — DC update rules

| User signal | DC write |
|---|---|
| Clear fact | `unverified`+`user_asserted` (or estimate) Fact; roles linked to DIR |
| Explicit confirm of prior statement | confirm event → may promote toward `confirmed` per legal pairs |
| “不知道 / 说不上来” (cooperative) | Fact `unknown`+`none` **or** DIR remains unknown; **do not** mark Agenda covered as known |
| Decline to provide | Fact `declined`+`none` |
| Contradicts prior fact | `openConflict`; do not overwrite silently |
| Model insight | Hypothesis only |

**Never:** Force `satisfied`/`covered`/`known` solely to increase progress (product §4.4 / §5.7 / §7.4).

**Tech debt note:** Legacy `shouldForceSatisfiedAfterSecondCantProvide` marks Agenda covered — **must not** be ported as DIR/sufficiency rule. Intake maps 2× cant-provide → `unknown`/`declined` + depth stop.

### 2.3 Dynamic next question selection

Priority (product §4.2):

1. Affects final conclusion (P0)  
2. Affects ranking  
3. Affects recommendation preconditions  
4. Open blocking conflicts  
5. Prerequisites available  
6. High information gain / low ask cost  

Rules:

- Default **one** primary question per turn.  
- Must cite `direction_id` + `dir_ids` / `ddr_ids`.  
- Out-of-blueprint questions rejected by code.  
- New top-level direction only via scope-change record.

### 2.4 Depth & budget controls

| Control | Default (product) | On exhaust |
|---|---|---|
| Per-direction follow-up depth | soft max 3 | Record unknown/partial; disclose; no infinite ask |
| Soft session budget | 12 valid turns | Prefer readiness eval |
| Hard session budget | 15 valid turns | Conditional report path or user choose continue; **no** fake questions |

Valid turns only consume budget. Invalid / infra do not.

### 2.5 Unknown / refuse / cannot provide

| Class | Machine effect |
|---|---|
| Cooperative unknown | Valid turn; Fact/DIR unknown; depth may +1 then bound |
| Decline | Valid turn; `declined`; show in final summary |
| Invalid (M3) | No DC write; streak++ |

---

## 3. M3 — Invalid input & Lockout

```text
investigating + unlocked
        │
   invalid input
        │
   invalid_streak = 1 → warn + restate same question
        │
   invalid again (streak = 2)
        │
        ▼
   LOCKED
     - lockout_count += 1
     - lockout_until = now + 10 min
     - session_retain_until = now + 24 h (if not set)
     - forbid: model, agenda update, DC formal mutate, PASS spend
        │
   after 10 min → show Continue
        │
   user resumes → investigating, streak = 0
        │
   if lockout_count reaches 3 → TERMINATED (permanent for session)
```

| Event | `invalid_streak` | `lockout_count` |
|---|---|---|
| Valid answer | → 0 | unchanged |
| Invalid | +1 | unchanged until lock |
| Enter lock | reset after lock handling | +1 |
| Expire 24h | n/a | **unchanged** (not strike 3) |
| Platform error | no +streak | no |

**Server enforcement required** (product §8.5). Client disable is insufficient.

**PASS:** Abuse termination follows disclosed PASS policy; not a blanket “no refunds for all failures.”

---

## 4. M4 — Sufficiency, confirmation, Freeze

```text
Readiness eval each turn (and on demand)
        │
        ├── FAIL → stay investigating (unless hard-cap policy → bounded review)
        ├── WARN → may offer understanding_review with boundaries
        └── PASS → understanding_review
                │
                ▼
        Final Understanding Summary (user-facing)
                │
                ├── confirm → freezeDecisionContext(stage3_sufficiency_end)
                ├── modify → patch DC + re-gate
                └── supplement → investigating
                │
                ▼
        DC status=final, content_hash set, version snapshot appended
                │
                ▼
        Report reads binding only (read-only)
```

### Freeze guards (align code + product)

| Allow | Deny |
|---|---|
| User confirmed understanding after Gate PASS/WARN-bounded | Purchase/CTA alone |
| `stage3_sufficiency_end` path | Stall / MAX turns claiming sufficiency |
| Legal fact combinations | Open preferred-path conflicts without boundary policy |

Open conflicts at freeze → `unresolved_in_final` (existing `markOpenConflictsUnresolvedInFinal`).

Supplement after freeze → `startV2FromFinal` pattern: old final `superseded`, new draft, re-investigate, re-freeze.

---

## 5. DecisionUnderstanding refresh cadence

| Trigger | Action |
|---|---|
| After every successful DC commit | Recompute projection |
| Blueprint version change | Recompute |
| Pattern insight eligibility | Optional block update |
| Lockout | Show locked state; freeze projection content |

Planner and UI **must** read the same computed snapshot id/version.

---

## 6. Mapping from legacy (informative only)

| Legacy | Intake |
|---|---|
| `opening` → `awaiting_understanding_confirm` | `intake_init` → `blueprint_ready` (no Call A gate) |
| Call A / Call B | **Retired** as Intake entry |
| `collecting_context` + Agenda covered gate | `investigating` + DIR/DDR sufficiency |
| `awaiting_confirmation` delivery confirm | Split: understanding confirm (Intake) vs delivery/report confirm (downstream) |
| `shouldForceSatisfiedAfterSecondCantProvide` | Replace with unknown/declined + depth stop |
| `MAX_COLLECTING_TURNS=12` stop-loss stall | Budget soft/hard + Gate; stall ≠ PASS |

---

## 7. Unimplemented today (must exist in later phases)

| Transition / behavior | Status in repo @ baseline |
|---|---|
| Blueprint scope lock + change_log | Missing |
| Adaptive single-gap planner bound to DDR/DIR | Missing (Call B one-shot agenda instead) |
| Server lockout SM (10m / 24h / 3 strikes) | Missing as product M3 (legacy has different abuse/escalation) |
| Understanding panel derived from DDR/DIR | Missing (AgendaProgressPanel = agenda %) |
| Freeze after Intake understanding confirm (not delivery CTA) | Partial DC freeze wire; coupled to delivery/segment2 |
| Conflict auto-open on contradicting facts | Library only; no production writer |

---

## 8. Declaration

No runtime code modified in Phase 1. This document defines required machines for Phase 2+ implementation acceptance.
