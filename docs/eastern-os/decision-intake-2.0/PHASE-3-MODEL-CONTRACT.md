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
| Timeout / empty LLM (Answer Interpretation) | No Answer Commit; provider escape 1×; user may resubmit |
| Timeout / empty LLM (Question Generation) | Answer Commit already durable; phase B retry / template fallback; **do not roll back answer** |
| Partial JSON | Discard that phase output; no write for that phase |
| Model loses prior confirms | Always re-feed Understanding + confirmed fact ids; DC is SoT — UI rebuild from DC |
| Persist fail after LLM success (phase B) | Do not show AskPayload; retry persist or error; **no** “shown but not written” |

---

## 5. Persistence & concurrency (R1-03 · two-phase)

**Hard ban:** one DB transaction that spans external LLM wall-clock. LLM calls happen **outside** short DB transactions.

### 5.1 Phase A — Answer Commit (short TX, no LLM inside TX)

```text
Preconditions (outside TX OK):
  - Optional LLM Answer Interpretation → AnswerEvent (validated in memory)
  - If interpretation LLM fails → abort; no DC write

BEGIN short TX
  assert session not locked / not frozen
  assert DC.version == expected_context_version
  assert idempotency_key unused OR return stored AnswerCommitResult
  apply AnswerEvent writes to DC
  reaggregateDirs + compose DDR statuses
  rebuild Understanding (derived cache)
  Soft Gate evaluate (code)
  persist: DC, Understanding cache, TurnSnapshot(phase=answer_commit),
           soft_verdict, bump context_version
COMMIT
→ return AnswerCommitResult { context_version', soft_verdict, need_planning: bool }
```

After Commit A succeeds, the **answer is durable** even if Question Planning later fails.

### 5.2 Phase B — Question Planning / Delivery (LLM outside TX)

```text
Load DC @ context_version' from Commit A
IF Soft Gate / user path → understanding_review (no ask):
  persist ReviewTransition; return (no AskPayload)
ELSE:
  plan candidates (code; model hints optional, outside TX)
  LLM Question Generation (outside TX) → NL
  validate Question
  BEGIN short TX
    assert DC.version still == context_version'   // or allow only if no concurrent write
    assert blueprint_version bind matches session
    assert no newer AskPayload for this turn already shown
    persist AskPayload + TurnSnapshot(phase=question_delivery)
  COMMIT
  ONLY THEN show AskPayload to user
```

If Commit B fails after LLM success → **retry persist** or surface error; never display unpersisted ask. If planning decides “no ask” → persist skip_reason; show review CTA per Architecture §3.

### 5.3 Records

| Record | Content |
|---|---|
| `AnswerCommitResult` | client_turn_id, AnswerEvent id, before/after context_version, soft_verdict |
| `AskPayload` | candidate_id, question_text, dir_id?, ddr_ids, context_version, blueprint_version |
| `TurnSnapshot` | phases A/B markers, gate_soft, skip_reason? |
| `IdempotencyRecord` | key → AnswerCommitResult (and optional AskPayload id) |
| Blueprint bind | blueprint_version + ddr_version + dir_catalog_version on session |

### 5.4 Concurrency, Blueprint upgrade, recovery

**Concurrency / duplicate submit**

- Stale `expected_context_version` on Commit A → `409`; client reloads DC.  
- Duplicate `client_turn_id` / idempotency key → return first **AnswerCommitResult** (and existing AskPayload if B already done).  
- Concurrent Commit A → one wins version bump; loser 409.  
- Commit B sees version drift (another answer landed) → **do not** attach AskPayload to obsolete understanding; re-run Soft Gate / planning on latest DC (**OPEN product:** auto-replan once vs force client refresh).

**Blueprint mid-flight upgrade**

- Session binds `blueprint_version` at start of turn.  
- If Blueprint bumps between A and B: B uses **new seed merge** (Phase 2) without wiping live `DC.dirs`.  
- In-flight model call that referenced old Blueprint scope: discard NL if out-of-scope vs **current** bind; replan. Do not write AskPayload with obsolete scope.  
- FreezeRecord (later) binds DC version + Blueprint + DDR catalog versions (C5) — unchanged.

**Recovery matrix**

| Event | Recovery |
|---|---|
| Crash before Commit A | No DC change; safe retry Answer Interpretation |
| Crash after Commit A, before B | DC durable; `need_planning=true`; resume B without re-interpreting answer |
| LLM timeout during B | DC kept; B retry / template; asked_count unchanged until AskPayload shown |
| Crash after Commit B persist, before UI paint | AskPayload exists → UI may load pending ask (idempotent show) |
| UI showed ask without Commit B | **Forbidden by protocol**; treat as bug |
| Partial Commit A TX fail | Rollback; no half-written dirs |

---

## 6. Consistency invariants

1. Understanding.context_version === DC.version used to build.  
2. Every UnderstoodItem.fact_ids ⊆ DC.reality_facts.  
3. DIR-based NeedItem.dir_id ∈ DC.dirs and Blueprint.dir_ids (active). Source-only NeedItems use `source_code` + `ddr_id` (no invented DIR).  
4. Shown AskPayload must equal last persisted AskPayload for that turn (Commit B before show).  
5. No RealityFact from chart insight channel.  
6. No long-running TX enclosing LLM.

---

## 7. Declaration

Docs only. Model advises; code decides and persists.
