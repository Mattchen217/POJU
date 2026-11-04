# Decision Intake 2.0 · Phase 3 Model Contract & Persistence

| Field | Value |
|---|---|
| **Stage** | 3.1 Design only |
| **Baseline** | `main` @ `ee8c96e8` |
| **LLM** | Via existing `callLLM` / OpenRouter only when implemented later |

---

## 0. Purpose

Bound what the model may see and propose, what code alone may write, and how turns persist under concurrency and failure.

---

## 1. Model-readable context (allowlist)

| Allowed | Forbidden |
|---|---|
| Understanding State (derived) | Raw dual `agent_v2` as authority |
| DC slices needed for current dirs (facts/constraints/conflicts/definition) | Entire unrelated history dump without need |
| Blueprint scope: dir_ids, directions, ddr defs (no live DIR state from Blueprint) | Call A/B transcripts as Intake source |
| Personal Pattern Insight block (`pattern_not_fact`) | Instructing model that chart = user reality |
| BudgetSnapshot + last ask outcome | Lockout secrets / credentials |
| Catalog ids and why/need text | PageFeedMatrix mutation |

---

## 2. Model-writable proposals (suggestions only)

| Proposal type | Code must verify |
|---|---|
| AnswerEvent classification + proposed_writes | Legal pairs; no `inferred`; scope |
| CandidateQuestion ranking hints | Filters in Planning §2 |
| NL question text | Validation §4 |
| Understanding `summary_zh` draft | Provenance fact ids exist |
| Insight phrasing | `kind=pattern_not_fact` |

**Model must not** emit or be trusted for:

- DDR `satisfied` / Gate `PASS` / `WARN` / `FAIL` authoritative verdicts  
- Blueprint `scope_locked`  
- `user_confirmed=true` without E1 event  
- FreezeRecord writes  
- `DC.dirs.current_state` direct sets  

---

## 3. Deterministic code responsibilities

1. Schema validation (zod) of all model JSON.  
2. Fact combination legality + confirmation derivation (reuse `fact-combination` / confirmation-event semantics).  
3. `reaggregateDirs` + DDR compose + Gate (Phase 2 §1.4–§1.6).  
4. Blueprint version binding & FreezeRecord (C5) when freezing.  
5. Idempotency, optimistic concurrency, Lockout gates.  
6. Strip/reject out-of-scope DIR/DDR references.

---

## 4. Failure modes

| Failure | Handling |
|---|---|
| Invalid schema | Retry once with repair prompt; else no ask / keep prior Understanding; log |
| Out-of-scope / duplicate ask | Replan ≤2; then skip |
| Timeout / empty LLM | Provider escape policy (lab/prod per delivery iron — design: 1 escape); do not partial-write DC |
| Partial JSON | Discard; no DC write |
| Model loses prior confirms | Always re-feed Understanding + confirmed fact ids; DC is SoT — UI rebuild from DC |
| Persist fail after model success | Do not show question as committed; retry persist or error; **no** “shown but not written” |

---

## 5. Persistence & concurrency

### 5.1 Turn transaction

```text
BEGIN
  assert session not locked
  assert DC.version == expected_version
  assert idempotency_key unused OR return stored result
  apply AnswerEvent writes
  reaggregate + compose DDR
  rebuild Understanding
  plan + validate question (if any)
  persist: DC, Understanding cache, Agenda audit, TurnSnapshot
  bump DC.version / turn index
COMMIT
```

### 5.2 Records

| Record | Content |
|---|---|
| `TurnSnapshot` | client_turn_id, AnswerEvent id, before/after context_version, candidate_id, question_text?, gate_soft |
| `IdempotencyRecord` | key → result payload |
| Blueprint bind | blueprint_version + ddr_version on session |

### 5.3 Concurrency

- Stale `context_version` → `409 conflict`; client must reload.  
- Duplicate `client_turn_id` → return first commit result.  
- Mid-flight Blueprint bump → new version; planners use new seed merge rules without wiping DIR states.

### 5.4 Recovery

| Event | Recovery |
|---|---|
| Crash after commit | Resume from DC + last TurnSnapshot |
| Crash before commit | No user-visible ask commit; safe retry |
| LLM timeout after DC write | DC kept; planning may run without new model call using templates / re-invoke once |

---

## 6. Consistency invariants

1. Understanding.context_version === DC.version used to build.  
2. Every UnderstoodItem.fact_ids ⊆ DC.reality_facts.  
3. NeedItem.dir_id ∈ DC.dirs and Blueprint.dir_ids (active).  
4. Shown AskPayload.candidate_id persisted in same transaction.  
5. No RealityFact from chart insight channel.

---

## 7. Declaration

Docs only. Model advises; code decides and persists.
