# Decision Intake 2.0 · Phase 3 Answer Interpretation

| Field | Value |
|---|---|
| **Stage** | 3.1 Design only |
| **Baseline** | `main` @ `ee8c96e8` |
| **C1** | Fact promotion / E1≠E2 preserved |

---

## 0. Purpose

Specify how a user turn becomes validated Decision Context updates — without letting the model invent confirmed RealityFacts.

---

## 1. AnswerEvent (structured output of interpretation)

```ts
type AnswerEvent = {
  event_id: string;
  session_id: string;
  client_turn_id: string;
  raw_text: string;
  classification: AnswerClass;
  targets: { agenda_item_id?: string; dir_ids: string[]; ddr_ids: string[] };
  proposed_writes: ProposedWrite[];
  conflicts_detected: ProposedConflict[];
  scope_change?: ScopeChangeProposal;  // never auto-applied
  notes: string[];
};

type AnswerClass =
  | "clear_answer"
  | "partial_answer"
  | "vague_answer"
  | "unknown"
  | "declined"
  | "correction"
  | "supplement"
  | "contradiction"
  | "goal_change"
  | "insight_mismatch"
  | "off_topic"
  | "invalid_input";  // feeds Lockout SM; separate from cooperative unknown
```

`ProposedWrite` never includes authoritative `user_confirmed` or illegal status×verification pairs.

---

## 2. Classification → DC effects

| Class | Definition / Facts / Constraints | Hypotheses | Conflicts | DIR |
|---|---|---|---|---|
| **clear_answer** | Write RealityFact/Constraint as `unverified`+`user_asserted` (or legal pair); attach `fact_roles` for DIR | No | No | Reaggregate after write |
| **partial_answer** | Write what is clear; leave other roles open; may set `partial_satisfaction` via aggregator | Optional clarifying hypothesis | No | partial until roles filled |
| **vague_answer** | Prefer ask clarifying follow-up; if forced write → `user_estimate` + `unverified` only | May | No | stays unknown/partial |
| **unknown** | Fact `status=unknown`, `verification_level=none` | No | No | stays unknown; **not** n_a; **not** known |
| **declined** | Fact `status=declined`, `verification_level=none` | No | No | stays unknown for satisfaction; Gate treats as open gap unless DDR N/A path separate |
| **correction** | Supersede prior fact (new version / supersedes link); require E1 later for confirm; never silent rewrite of confirmed without event | No | May open conflict if overlapping claims | Reaggregate |
| **supplement** | New facts/constraints; same legality | No | Possible | Reaggregate |
| **contradiction** | Keep both statements; open Conflict; do not auto-pick | Optional | **Yes** `open` | DIRs → conflict until clarified |
| **goal_change** | Update Definition fields; may propose Blueprint scope bump (**user-visible**; version++) | No | May | Re-seed missing DIRs only; **never** reset known DIR states |
| **insight_mismatch** | User reality ≠ Personal Pattern Insight | May create Hypothesis “pattern vs stated” | Optional | Do **not** write chart as RealityFact; do not force user to “confirm chart” |
| **off_topic** | No DC fact write | No | No | No; count toward invalid/off-topic streak policy |
| **invalid_input** | No DC write; Lockout SM | No | No | No |

**E1 FactConfirm:** separate event path (C1). Interpretation of an answer that *is* a confirm gesture on a prior statement → emit FactConfirmEvent; DC Update applies §2.4A–C.

**E2 UnderstandingConfirm:** not handled here — Freeze path only.

---

## 3. Pipeline inside Interpretation

```text
1. Bind turn to current primary AgendaItem / dir_ids (if any)
2. Model (optional) proposes AnswerEvent draft under schema
3. Deterministic validators:
     - legal fact combinations
     - dir_ids ⊆ Blueprint.active dir_ids
     - no inferred verification_level
     - chart text cannot become RealityFact
4. Reject or strip illegal proposed_writes
5. Hand valid AnswerEvent to DC Update
```

---

## 4. Contradiction & correction detail

| Case | Rule |
|---|---|
| New statement conflicts existing `confirmed` fact | Open Conflict; preferred-path flag per Phase 1; do not demote confirmed without E1/clarify flow |
| User explicitly corrects | New fact supersedes; old marked superseded; reaggregate |
| Soft estimate vs hard constraint | Prefer Constraint rigidity; estimate stays unverified |

---

## 5. Personal Pattern Insight mismatch

1. Record insight id + user fact ids in Hypothesis or Conflict note.  
2. Prefer asking about **user reality** DIR, not “is your chart wrong?”.  
3. CFP/ZFP states still follow Phase 2 Rule A for DDR-02 (non-waivable CFP).

---

## 6. Unknown / declined ≠ N/A / satisfied

Align Phase 1 / Phase 2: decline/unknown never alone set DIR `known` or DDR `satisfied`/`n_a`. Agenda covered never proves known.

---

## 7. Declaration

Docs only. Model proposes; code writes DC under C1 legality.
