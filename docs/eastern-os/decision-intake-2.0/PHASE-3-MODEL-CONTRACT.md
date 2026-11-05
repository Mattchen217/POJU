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
4. N/A evidence validation: Understanding §2.7 A1 allowlist / A2 system_basis / A3 source_ref / `na_conditions`; never trust Understanding cache alone; never waive DDR-02 Rule A.  
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
IF soft_budget(cycle) / Soft Gate ready / USER_REQUEST_REVIEW → understanding_review (no ask):
  persist ReviewTransition; return (no AskPayload)
ELSE:
  IF AskPayload exists for (session_id, client_turn_id) AND delivery_status ∈ {persisted_unshown, shown}
     AND delivery_generation == session.current_delivery_generation:
    return existing AskPayload (idempotent); do NOT regenerate
  plan candidates (code) → deterministic candidate_id
  LLM Question Generation (outside TX) → NL
  validate Question (kind-aware; R2-02)
  BEGIN short TX  // Commit B
    assert planned delivery_generation == session.current_delivery_generation  // else §5.5
    assert DC.version == planned_context_version
    assert blueprint_version == planned_blueprint_version
    CAS delivery_slot(generation): empty|same ask_payload_id → occupy
    UPSERT AskPayload {
      ask_payload_id,   // stable unique id for this logical delivery
      candidate_id, question_text, kind, ...,
      context_version, blueprint_version,
      delivery_generation,
      delivery_status: persisted_unshown,
      shown_at: null
    }
    UNIQUE(session_id, client_turn_id) where status not discarded
    TurnSnapshot(phase=question_delivery)
  COMMIT
  // Persist ≠ shown. Client must obtain ShowReceipt (§5.3) after paint.
```

Never display an AskPayload that is not persisted. Never count `session_asked_count` at Commit B.

### 5.3 AskPayload identity, ShowReceipt, exactly-once count (R3-02)

**A. Stable id**

```ts
type AskPayload = {
  ask_payload_id: string;       // unique; minted at first successful Commit B; never regenerated on UI retry
  candidate_id: string;         // Planning §2.3
  client_turn_id: string;
  delivery_generation: number;
  delivery_status: "persisted_unshown" | "shown" | "stale" | "discarded" | "invalidated";
  // no "superseded" — use stale|discarded|invalidated (R4-04)
  shown_at: string | null;
  delivery_receipt_id: string | null;
  // ... question fields, context_version, blueprint_version
};
```

Same logical turn retry / resume **reuses** `ask_payload_id`. New logical question ⇒ new Commit B path ⇒ new `ask_payload_id`.

**B. ShowReceipt (user-visible show ≠ Commit B)**

| Aspect | Rule |
|---|---|
| What counts as shown | Client confirms first successful paint of this `ask_payload_id` in Intake UI |
| Writer | Server handler `confirmAskShown(ask_payload_id, delivery_receipt_id)` after client ack |
| Atomicity | Single short TX: if AskPayload.delivery_status=`persisted_unshown` → set `shown` + `shown_at` + `delivery_receipt_id` AND insert `AskCountLedger(ask_payload_id)` UNIQUE AND `session_asked_count += 1` |
| Idempotent confirm | If already `shown` / ledger row exists → return success; **no** second +1 |
| Concurrent confirm race | UNIQUE(`ask_payload_id`) conflict on loser → **must** re-read AskPayload + ledger; if winner committed `shown` → return **idempotent success** to client (same payload). **Must not** surface duplicate-confirm race as client error |
| Crash after Commit B before show | Resume loads `persisted_unshown`; show again; first ShowReceipt counts once |
| UI retry / re-render | Re-sends same `ask_payload_id` → idempotent |

**C. Exactly-once**

- One `ask_payload_id` ⇒ at most +1 `session_asked_count`.  
- Unshown ⇒ 0.  
- Network/concurrency retries cannot double-count (UNIQUE ledger).  
- New question needs new `ask_payload_id`.

**D. Other records**

| Record | Content |
|---|---|
| `AnswerCommitResult` | client_turn_id, AnswerEvent id, before/after context_version, soft_verdict |
| `AskCountLedger` | ask_payload_id UNIQUE → counted_at |
| `TurnSnapshot` | A/B markers, gate_soft, skip_reason?, delivery_generation |
| `IdempotencyRecord` | `(session_id, client_turn_id)` → AnswerCommitResult + ask_payload_id? |
| Session slot | `current_delivery_generation: number` |

### 5.4 Commit B uniqueness & concurrency

1. ≤1 non-discarded AskPayload per `(session_id, client_turn_id)` for current generation.  
2. Re-entry with existing `persisted_unshown`/`shown` → return same row; no regenerate; no count bump.  
3. Concurrent Commit B → CAS on `(session_id, delivery_generation)` slot; one winner.  
4. Stale Commit A version → 409.  
5. Late LLM after CAS lost → discard NL; return winner payload.

### 5.5 Version-drift + delivery_generation lifecycle (R3-02)

Closed safety protocol:

```text
Session maintains current_delivery_generation (starts 1).

On Commit B mismatch (DC.version / blueprint / Understanding drift)
  OR explicit invalidate:
  1. Mark in-flight NL invalidated
  2. Mark AskPayload drafts for OLD generation: delivery_status=stale|discarded
     (shown payloads stay shown for audit/count; do not uncount)
  3. current_delivery_generation += 1     // frees new delivery slot
  4. Reject any Commit B / ShowReceipt still carrying old generation
  5. MUST rebuild Understanding + Soft Gate on latest DC
  6. MUST replan candidates; new Commit B uses NEW generation + NEW ask_payload_id if new ask
  7. NEVER bind old-generation NL / AskPayload to new DC.version
  8. Old slot MUST NOT permanently block new planning (generation bump releases slot)

OPEN product only: auto-replan once vs force client refresh after step 5–6.
```

### 5.6 Blueprint upgrade between A and B

1. New Blueprint merges **seeds only** (Phase 2).  
2. Never overwrite live DIR `current_state` / user evidence / `explicit_na_evidence`.  
3. Reconcile `DC.dirs`; rebuild Understanding; Soft Gate; bump delivery_generation if in-flight ask invalidated.  
4. Discard old-Blueprint NL not yet Commit B.  
5. FreezeRecord binds DC hash + Blueprint + DDR versions (C5).

### 5.7 Recovery matrix

| Event | Recovery |
|---|---|
| Crash before Commit A | Retry interpretation; no DC write |
| Crash after A, before B | Resume B; same generation if still current |
| LLM timeout B | CAS; count unchanged until ShowReceipt |
| Late LLM after gen bump | Reject; cannot overwrite new generation |
| Crash after B, before show | Load `persisted_unshown`; show; ShowReceipt once |
| Duplicate ShowReceipt | Idempotent; no +1 |
| UI show without Commit B | Forbidden |
| Blueprint bump mid-B | §5.6 + generation bump |

---

## 6. Consistency invariants

1. Understanding.context_version === DC.version used to build.  
2. Every UnderstoodItem.fact_ids ⊆ DC.reality_facts.  
3. DIR-based NeedItem.dir_id ∈ DC.dirs and Blueprint.dir_ids (active). Source-only NeedItems use `source_code` + `ddr_id` (no invented DIR).  
4. Show only after Commit B; count only after ShowReceipt.  
5. ≤1 non-discarded AskPayload per `(session_id, client_turn_id)` per current generation.  
6. No RealityFact from chart insight channel.  
7. No long-running TX enclosing LLM.  
8. N/A only via DC `explicit_na_evidence` / facts / constraints (US §2.7); Understanding not SoT.  
9. DIR `current_state` ∈ {known, unknown, conflict, n_a} only — never DDR statuses.  
10. `DC.explicit_na_evidence` is DC business payload and **must** enter `DC.content_hash` (Phase 1 §10.2 / C5).

### 6.1 ExplicitNaEvidence ↔ C5 hash (R3-03)

| Rule | Spec |
|---|---|
| Field | `DC.explicit_na_evidence: ExplicitNaEvidence[]` (DC-owned; not sidecar outside DC) |
| Hash | Included in `extractBusinessPayload` alongside Definition/Facts/Constraints/DIRS/Conflicts/boundaries (Phase 3.2 must extend extractor; **does not** put Blueprint/DDR catalog versions into hash — C5 unchanged) |
| Add/revoke evidence | DC Update TX → bump `DC.version` → recompute `content_hash` → reaggregateDirs → DDR compose → Gate |
| Freeze | FreezeRecord.dc_content_hash = hash at E2; history immutable; new freeze = new record |
| Gate influence | Only through DC states after reaggregate; no external N/A store |

---

## 7. Declaration

Docs only. Model advises; code decides and persists.
