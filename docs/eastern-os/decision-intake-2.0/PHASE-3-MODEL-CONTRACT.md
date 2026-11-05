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
4. N/A evidence validation against DIR `na_conditions` (Understanding §2.7); never trust Understanding cache alone.  
5. Blueprint version binding & FreezeRecord (C5) when freezing.  
6. Idempotency, optimistic concurrency, Lockout gates; Commit B unique slot (§5.4).  
7. Strip/reject out-of-scope DIR/DDR references; kind-aware CandidateQuestion validation.

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
IF soft_budget / Soft Gate ready / USER_REQUEST_REVIEW → understanding_review (no ask):
  persist ReviewTransition; return (no AskPayload)
ELSE:
  IF AskPayload already exists for (session_id, client_turn_id) AND status=valid:
    return existing AskPayload (idempotent); do NOT regenerate; do NOT bump asked_count
  plan candidates (code; model hints optional, outside TX)
  LLM Question Generation (outside TX) → NL
  validate Question (kind-aware)
  BEGIN short TX  // Commit B
    assert delivery_slot free OR same payload fingerprint
    assert DC.version == planned_context_version          // else abort → §5.5
    assert blueprint_version == planned_blueprint_version // else abort → §5.6
    UPSERT AskPayload with UNIQUE(session_id, client_turn_id)
    set status=valid; bind context_version + blueprint_version
    TurnSnapshot(phase=question_delivery)
  COMMIT
  ONLY THEN show AskPayload to user
```

If Commit B fails after LLM success → **retry persist** or surface error; never display unpersisted ask. If planning decides “no ask” → persist skip_reason; show review CTA per Architecture §3.

### 5.3 Records

| Record | Content |
|---|---|
| `AnswerCommitResult` | client_turn_id, AnswerEvent id, before/after context_version, soft_verdict |
| `AskPayload` | candidate_id, question_text, kind, dir_ids?, source_code?, ddr_ids, context_version, blueprint_version, status=`valid`\|`superseded`\|`invalidated` |
| `TurnSnapshot` | phases A/B markers, gate_soft, skip_reason? |
| `IdempotencyRecord` | key=`(session_id, client_turn_id)` → AnswerCommitResult + optional AskPayload id |
| Blueprint bind | blueprint_version + ddr_version + dir_catalog_version on session |

### 5.4 Commit B uniqueness, concurrency, recovery (R2-03)

**Uniqueness / idempotency (normative)**

1. At most **one valid** AskPayload per `(session_id, client_turn_id)`.  
2. Unique constraint (or equivalent) on that key for `status=valid`.  
3. Re-entry of phase B for the same turn: if valid AskPayload exists → **return it**; do not generate a second question; do not increment `asked_count`.  
4. Persist **before** UI show. Shown payload must equal persisted valid payload.  
5. LLM timeout + late response race: Commit B uses **atomic compare-and-set** on the delivery slot (`delivery_generation` / empty→occupied). Loser discards NL; winner’s payload is authoritative.  
6. Persisted-but-unshown AskPayload on resume → **load and show**; never regenerate over it.

**Concurrency / duplicate submit**

- Stale `expected_context_version` on Commit A → `409`; client reloads DC.  
- Duplicate `client_turn_id` → return first AnswerCommitResult (+ existing AskPayload if B done).  
- Concurrent Commit A → one wins version bump; loser 409.  
- Concurrent Commit B for same turn → CAS / unique constraint; one persist; others return that row.

### 5.5 Version-drift safety protocol (R2-03)

Safety protocol is **closed** (not OPEN). UX choice after safe abort may be OPEN.

```text
On Commit B:
  IF DC.version != planned_context_version
     OR Understanding.context_version != planned_context_version:
    → do NOT persist AskPayload
    → mark in-memory NL as invalidated
    → must NOT bind old AskPayload to new DC
    → discard/stale-mark any draft tied to old version
    → MUST re-check Soft Gate + rebuild Understanding on latest DC
    → MUST re-run candidate planning against latest DC + Blueprint
    → OPEN product: auto-replan once vs force client refresh
       (either UX OK only if this protocol held)
```

### 5.6 Blueprint upgrade between A and B (R2-03)

1. New Blueprint version merges **initialization seeds only** (Phase 2).  
2. **Must not** overwrite existing live DIR `current_state` or user evidence.  
3. After bump: reconcile affected `DC.dirs` per Phase 2; rebuild Understanding; re-evaluate Soft Gate.  
4. Validate CandidateQuestion still in **latest** Blueprint scope (and kind rules).  
5. NL generated under old Blueprint and not yet Commit B → **discard**; never persist as valid AskPayload.  
6. FreezeRecord (later) still binds DC + Blueprint + DDR versions (C5).

### 5.7 Recovery matrix

| Event | Recovery |
|---|---|
| Crash before Commit A | No DC change; safe retry Answer Interpretation |
| Crash after Commit A, before B | DC durable; `need_planning=true`; resume B without re-interpreting answer |
| LLM timeout during B | DC kept; CAS on Commit B; asked_count unchanged until AskPayload shown |
| Late LLM after CAS lost | Discard; return winner AskPayload |
| Crash after Commit B persist, before UI paint | Load valid AskPayload; idempotent show; no regenerate |
| UI showed ask without Commit B | **Forbidden**; treat as bug |
| Partial Commit A TX fail | Rollback; no half-written dirs |
| Blueprint bump mid-B | §5.6; discard stale NL |

---

## 6. Consistency invariants

1. Understanding.context_version === DC.version used to build.  
2. Every UnderstoodItem.fact_ids ⊆ DC.reality_facts.  
3. DIR-based NeedItem.dir_id ∈ DC.dirs and Blueprint.dir_ids (active). Source-only NeedItems use `source_code` + `ddr_id` (no invented DIR).  
4. Shown AskPayload must equal last **valid** persisted AskPayload for that turn (Commit B before show).  
5. ≤1 valid AskPayload per `(session_id, client_turn_id)`.  
6. No RealityFact from chart insight channel.  
7. No long-running TX enclosing LLM.  
8. N/A satisfaction only via authoritative DC evidence (§ Understanding 2.7); Understanding cache is not SoT.

---

## 7. Declaration

Docs only. Model advises; code decides and persists.
