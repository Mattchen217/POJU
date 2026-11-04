# Decision Intake 2.0 · Phase 1 Acceptance Criteria

| Field | Value |
|---|---|
| **Scope** | Data contract documentation completeness & consistency |
| **Not in scope** | Runtime implementation (Phases 2+) |
| **Phase 1.2** | Adds **AC-C1–AC-C12** to close product decisions C1–C5 |
| **Pass rule** | All **AC-*** / **AC-C*** items PASS or explicitly **WAIVED** by product with written reason |

This checklist accepts **Phase 1 documents**, not production engines. Each criterion is verifiable by reading the four Phase 1 docs + Phase 0 baseline + cited code — without running new features.

---

## AC-1 Data model completeness

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-1.1 | DC, DDR, DIR, Blueprint, AdaptiveQuestionPlan, DecisionUnderstanding, PersonalPatternInsight, SufficiencyGate, SessionLifecycle, Lockout, Persistence, FreezeRecord all defined | `PHASE-1-DATA-CONTRACT.md` | Each has duty + fields |
| AC-1.2 | Enums listed for FactStatus, VerificationLevel, DirCurrentState, ConflictState, DDR status/priority, Gate verdict, Session phases | Data contract §§2–3, §8 | No bare “string status” for these |
| AC-1.3 | Required vs optional fields marked | Field tables | Required column present |
| AC-1.4 | Relationships DDR→DIR→Facts / Blueprint→dir_ids drawn; live DIR = DC.dirs | Data contract §1; Traceability §1 | Single chain; no dual live DIR |
| AC-1.5 | Invariants stated (Agenda≠DIR known; calc≠Fact; DC sole fact SoT; E1≠E2) | Data contract + Traceability | Explicit invariants |

---

## AC-2 State transition legality

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-2.1 | Session lifecycle transitions tabulated with guards | State Machines §1.3 | No orphan phase; enum ≡ Contract §8 |
| AC-2.2 | Per-turn loop defined (ask→classify→write→reaggregate→ready) | State Machines §1.5 | Present |
| AC-2.3 | Session ≠ Lockout machines separated | State Machines §0, §6 | Explicit separation |
| AC-2.4 | Unknown/declined vs invalid paths distinct | State Machines §1.5, §6 | No conflation |
| AC-2.5 | Freeze only after E2 UnderstandingConfirm; not CTA/stall alone | State Machines §1.3, §7 | Matches product |
| AC-2.6 | Summary shown ≠ summary confirmed | State Machines §1 (`understanding_review`→`awaiting_user_confirm`) | Distinct events |
| AC-2.7 | Critical missing runtime pieces listed as deferred | Data contract §13; Phase 1.1 remaining | Honest gap list |

---

## AC-3 DC as sole fact source

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-3.1 | Contract forbids second fact DB / Understanding as SoT | Data contract §§1, 6 | Stated |
| AC-3.2 | Persistence says DC wins over agent buffers | Data contract §10 | Stated |
| AC-3.3 | Tech risk T1 dual-authority acknowledged | Data contract §13 | Listed |
| AC-3.4 | Hypotheses cannot write RealityFacts | Data contract §2.6 | Invariant |

**Code evidence (baseline):** `types.ts` header + `restoreDecisionContextAuthority`; Phase 0 notes `agent_v2` still UI-primary — accepted as **risk**, not Phase 1 fail.

---

## AC-4 DDR vs DIR boundary

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-4.1 | DDR = report obligations; DIR = information needs | Data contract §§2.8, 3 | Distinct duties |
| AC-4.2 | DDR carries `report_page_id` in `01`–`08` only | Data contract §3; Traceability §4 | Locked to PageFeedMatrix |
| AC-4.3 | DIR state from fact aggregation not Agenda; live SoT = DC.dirs | Data contract §2.8; Traceability §1–2 | Invariant |
| AC-4.4 | P2 cannot alone block completion | Data contract §3.3 | Stated |

---

## AC-5 Information sufficiency

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-5.1 | Gate verdicts PASS/WARN/FAIL defined | Data contract §3.3 | Present |
| AC-5.2 | Mapping to existing `evaluateDecisionSufficiency` documented | Data contract §3.3 | Present |
| AC-5.3 | Hard-push/stall/MAX cannot alone PASS | State Machines §4; Data contract §3.3 | Stated |
| AC-5.4 | P1 WARN vs FAIL deterministic rule present | Data contract §3.3 | Stated |
| AC-5.5 | Progress weights deferred (not silently invented) | Data contract §6; Phase 1.1 | Stated deferred |
| AC-5.6 | unknown/declined/unverified not scored as confirmed | Data contract §2.4, §3.2 | Stated |

---

## AC-6 Dynamic question planning

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-6.1 | One primary question per turn default | State Machines §1.5; Data contract §5 | Stated |
| AC-6.2 | Priority / direction discipline documented | Data contract §§4–5 | Present |
| AC-6.3 | Scope lock + Blueprint fields | Data contract §4 | Present |
| AC-6.4 | Depth soft cap 3 + budget | Data contract §11 | Present |
| AC-6.5 | Call A/B not Intake question factory | Data contract §2.9; Traceability §9 | Explicit retire |
| AC-6.6 | Agenda covered not reused for DIR known | Data contract §2.8; Traceability §2 | Explicit |

---

## AC-7 Personal analysis isolation

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-7.1 | PersonalAnalysisProfile maps BaZi + ZiWei separately | Data contract §7 | Present |
| AC-7.2 | Calc ≠ RealityFact invariant | Data contract §7; Traceability §1 | Stated |
| AC-7.3 | Pattern Insight / glossary reuse | Data contract §7 | Present |
| AC-7.4 | Glossary rewrite forbidden | Data contract §7 | Stated |
| AC-7.5 | Code SoT paths cited | Data contract §7 | Paths present |
| AC-7.6 | Production ZFP hydration gap listed | Data contract §13 T6 | Listed |

---

## AC-8 Report traceability

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-8.1 | Full chain Report←DDR←DIR(DC.dirs)←Evidence←FreezeRecord | Traceability §0–2 | Present |
| AC-8.2 | Eight faces locked; no structure change | Traceability §4 | Matches page-feed-matrix |
| AC-8.3 | DDR family → face mapping table | Traceability §4 | Present |
| AC-8.4 | Gate disclosure rules | Traceability §5 | Present |
| AC-8.5 | Failure modes list | Traceability §8 | ≥5 modes |
| AC-8.6 | Provenance record shape proposed | Traceability §7 | Present |

---

## AC-9 Persistence & concurrency

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-9.1 | Persist matrix for DC, Blueprint, Lockout, Agenda, FreezeRecord | Data contract §10 | Present |
| AC-9.2 | Idempotency + freeze versioning / FreezeRecord | Data contract §10.3 | Present |
| AC-9.3 | Report binding requires dc hash + blueprint_version + ddr_version | Data contract §10.3; Traceability §6 | Present |
| AC-9.4 | Lockout server-side + no PASS spend while locked | State Machines §6; Data contract §9 | Present |
| AC-9.5 | Understanding cache must rebuild from DC | Data contract §10 | Present |

---

## AC-10 Invalid input & lockout

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-10.1 | Invalid vs cooperative unknown distinguished | State Machines §§1.5, 6 | Present |
| AC-10.2 | Lockout product rules retained / deferred Phase 8 | Data contract §9; State Machines §6 | Present |
| AC-10.3 | Locked: no model, no Agenda, no DC mutate, no PASS | Same | Present |
| AC-10.4 | Expiry ≠ third lockout | State Machines §1 & §6 | Present |
| AC-10.5 | Listed as unimplemented in current repo | Data contract §13 T11 | Present |

---

## AC-11 Special design questions (must be answered)

| # | Question | Where answered | Pass if unambiguous |
|---|---|---|---|
| 1 | status × verification legal pairs | Data contract §2.4 | Table matches `LEGAL_FACT_COMBINATIONS` |
| 2 | user_confirmed vs verification_level | Data contract §2.4 | independently_verified ⇏ user_confirmed |
| 3 | Agenda complete ≠ DIR known | Data contract §2.8; Traceability §2 | Explicit |
| 4 | No force-complete unknowns for progress | AC-5.6; Data contract §3.2 | Explicit |
| 5 | Critical unknown blocks or conditional report | Data contract §3.3 | Explicit |
| 6 | Understanding shared UI+planner | Data contract §6; State Machines §5 | Explicit |
| 7 | Pattern Insight from local calc, isolated | Data contract §7 | Explicit |
| 8 | Budget/depth/stop config | Data contract §11 | Explicit |
| 9 | Lockout server-enforced | Data contract §9 | Explicit |
| 10 | DC vs agent vs persist consistency | Data contract §10 | Explicit |
| 11 | E1 FactConfirm ≠ E2 UnderstandingConfirm | Data contract §2.4; State Machines §2 | Explicit |
| 12 | DC.dirs sole live DIR SoT | Data contract §2.8 | Explicit |

---

## AC-12 Engineering hygiene (Phase 1 delivery)

| ID | Criterion | Pass if |
|---|---|---|
| AC-12.1 | Four docs exist under `docs/eastern-os/decision-intake-2.0/` | Files present |
| AC-12.2 | No runtime code / prompt / schema / UI changes in PR | `git diff` only docs (+ review report if on branch) |
| AC-12.3 | Directory recommendation given without creating `lib/decision-intake/` | Data contract §12 |
| AC-12.4 | Remaining tech risks listed; C1–C5 closed | Data contract §§13–14 |
| AC-12.5 | Product plan v6-shadow vs Phase 0 production-v6 called out | Data contract T5 |
| AC-12.6 | Phase 1.2 stops; no Phase 2 implementation; no PR merge | PR description states stop |

---

## AC-C — Phase 1.2 product decision closure (C1–C5)

Each item is a documentation acceptance test with Given / When / Then. Implementation unit tests belong to later phases; here “Then” means the normative docs mandate the outcome.

### AC-C1 — user_asserted → confirmed + user_confirmed

| | |
|---|---|
| **Given** | A RealityFact with `verification_level=user_asserted` and `status=unverified` (or pre-confirm) |
| **When** | E1 FactConfirm fires for that fact |
| **Then** | Docs require `status=confirmed`, `user_confirmed=true`, original source + verification_level retained; requires explicit confirm event |
| **Verify** | Data contract §2.4A; State Machines §2.2 |

### AC-C2 — independently_verified ≠ user_confirmed

| | |
|---|---|
| **Given** | A RealityFact with `verification_level=independently_verified`, `status=confirmed` |
| **When** | Fact is used in DIR aggregation / UI |
| **Then** | Docs require `user_confirmed=false`; independent verification must not imply user confirmation |
| **Verify** | Data contract §2.4B; AC-11 Q2; code cite `fact-combination.ts` |

### AC-C3 — user_estimate not upgraded by summary confirm

| | |
|---|---|
| **Given** | A RealityFact with `verification_level=user_estimate`, `status=unverified` |
| **When** | E1 FactConfirm **or** E2 UnderstandingConfirm occurs |
| **Then** | Docs forbid upgrade to `confirmed`; only new qualifying evidence may change verification |
| **Verify** | Data contract §2.4C; State Machines §2.2 |

### AC-C4 — DIR aggregation recognizes normative confirmed facts

| | |
|---|---|
| **Given** | Required DIR roles and a matching fact after §2.4A promotion (`status=confirmed`) |
| **When** | `reaggregateDirs` / `aggregateDirState` runs |
| **Then** | Docs require DIR may become `known` only via `status===confirmed` facts; writers must promote user_asserted on E1 so aggregator can fire; Agenda covered alone insufficient |
| **Verify** | Data contract §2.4 / §2.8; Traceability §2; code cite `dir-aggregator.ts` |

### AC-C5 — Session Phase Enum identical across docs

| | |
|---|---|
| **Given** | Data Contract §8 and State Machines §1.1 |
| **When** | Enumerating `IntakeSessionPhase` |
| **Then** | Exact same closed set including internal `blueprint_building`; diagram + transition table cover every phase; no Stage 1/2/3 UX labels |
| **Verify** | Diff enum lists; SM §1.2–1.3 |

### AC-C6 — No dual live DIR authority

| | |
|---|---|
| **Given** | Blueprint and DecisionContext both exist |
| **When** | Reading or updating DIR `current_state` / evidence links |
| **Then** | Docs mandate sole mutable SoT = `DC.dirs`; Blueprint holds `dir_id` refs + immutable seed snapshot only; Blueprint bump must not reset live DIR states |
| **Verify** | Data contract §§1, 2.8, 4; Traceability §1 |

### AC-C7 — DDR status calculation normative

| | |
|---|---|
| **Given** | Required DIR states + related blockers for a DDR |
| **When** | DDR status is computed |
| **Then** | Result ∈ {`satisfied`,`partial`,`pending`,`blocked`,`n_a`} per Data contract §3.2; statuses mutually exclusive via first-match order; not set by Agenda covered; `n_a` needs explicit evidence |
| **Verify** | Data contract §3.2; State Machines §4.1 |

**Boundary cases (must hold):**

| Given | When | Then |
|---|---|---|
| R = {A,B,C}; all three DIR `n_a` + explicit N/A evidence | compute DDR status | `n_a` — **not** `satisfied` |
| R non-empty; all `known`\|`n_a`; ≥1 `known` | compute | `satisfied` |
| R empty + explicit N/A evidence on DDR | compute | `n_a` — **not** `satisfied` |
| R empty **without** N/A evidence | compute | `pending` — **not** `satisfied` / not automatic `n_a` |
| Related blocking conflict | compute | `blocked` (wins before satisfied/n_a) |

### AC-C8 — P0/P1/P2 × PASS/WARN/FAIL

| | |
|---|---|
| **Given** | Mix of DDR priorities and statuses |
| **When** | Sufficiency Gate evaluates |
| **Then** | P0 with status ∉ {`satisfied`,`n_a`} ⇒ FAIL (not PASS); P0/`n_a` is Gate-acceptable terminal; P1 uses deterministic WARN/FAIL rule on unsatisfied; P2 alone must not block report; WARN allows conditional report with disclosures; FAIL forbids normal freeze |
| **Verify** | Data contract §3.3; State Machines §4.2; Traceability §5 |

| Given | When | Then |
|---|---|---|
| P0 DDR all required DIRs `n_a` → DDR `n_a` | Gate | May PASS on this DDR (terminal OK); must not FAIL solely because status is `n_a` rather than `satisfied` |
| P0 DDR `partial` / `pending` / `blocked` | Gate | FAIL |
| Only P2 DDR unsatisfied | Gate | Must not alone prevent report |

### AC-C9 — unknown / declined / not_applicable ≠ satisfied

| | |
|---|---|
| **Given** | Facts in `unknown` / `declined` / `not_applicable` or user refusal |
| **When** | DIR/DDR/Gate evaluated |
| **Then** | Must not mark DIR `known` or DDR `satisfied` / automatic `n_a` solely from refuse/unknown; verification_level=`none` for those fact statuses; DDR `n_a` only via explicit applicability evidence (Contract §3.2) |
| **Verify** | Data contract §§2.4D, 3.2; AC-5.6 |

### AC-C10 — DC.content_hash excludes Blueprint/DDR versions

| | |
|---|---|
| **Given** | `extractBusinessPayload` / Contract §10.2 |
| **When** | Computing `DC.content_hash` |
| **Then** | Payload includes DC business fields only; Blueprint/DDR versions absent; matches `content-hash.ts` |
| **Verify** | Data contract §10.2; `lib/poju/decision-context/content-hash.ts` |

### AC-C11 — FreezeRecord binds hash + blueprint_version + ddr_version

| | |
|---|---|
| **Given** | E2 UnderstandingConfirm and Gate ≠ FAIL |
| **When** | Session enters `frozen` |
| **Then** | FreezeRecord stores `dc_content_hash`, `blueprint_version`, `ddr_version`, session/context ids, `frozen_at`; report start must verify all three |
| **Verify** | Data contract §10.3; State Machines §7; Traceability §6 |

### AC-C12 — Historical freeze/report bindings not silently overwritten

| | |
|---|---|
| **Given** | An existing FreezeRecord + report bound to versions (vN) |
| **When** | Blueprint or DDR catalog advances to vN+1 |
| **Then** | Docs forbid silent overwrite of old FreezeRecord/report bindings; new freeze only via new E2 cycle |
| **Verify** | Data contract §10.3; State Machines §7; Traceability §6 |

---

## Cross-document consistency check (Phase 1.2)

> **Note:** This table is the **authoring self-check** after the C4 DDR boundary fix. It is **not** an independent product acceptance verdict. External review must re-verify, especially C4.

| # | Check | Result (author self-check) |
|---|---|---|
| 1 | Objects/fields/enums in Data Contract ≡ State Machines | **PASS** (Phase enum, Fact rules, DIR/DDR/Gate, FreezeRecord) |
| 2 | Every SM state defined in Data Contract | **PASS** (`IntakeSessionPhase` closed set) |
| 3 | Traceability SoT = DC.dirs for DIR status | **PASS** |
| 4 | AC / AC-C verify normative rules | **PASS** (AC-C1–C12; AC-C7/C8/C9 updated for all-`n_a` / empty-`R`) |
| 5 | C1–C5 closed in docs; C4 satisfied/`n_a` mutually exclusive | **PASS** (Contract §3.2 revised) |
| 6 | No new dual data authority introduced | **PASS** (Blueprint seed vs DC.dirs split) |
| 7 | PageFeedMatrix 01–08 order unchanged | **PASS** |
| 8 | Call A/B not Intake entry | **PASS** |
| 9 | Agenda covered ≠ DIR known / DDR satisfied | **PASS** |
| 10 | Decision Understanding remains derived | **PASS** |
| 11 | All required DIRs `n_a` → DDR `n_a` (not `satisfied`) | **PASS** (Contract §3.2; SM §4.1; Trace §2; AC-C7) |
| 12 | Empty `R` → `n_a` only with explicit evidence; else `pending`; never `satisfied` | **PASS** |

---

## Remaining OPEN / deferred (not C1–C5)

Per Phase 1.1 review — **do not silently close**:

| Item | Phase |
|---|---|
| Progress weight table | 6–7 |
| Lockout server implementation | 8 |
| Conflict auto-detection details | 3+ |
| Zi Wei task-context hydration | 5/9 |
| agent_v2 UI cutover / dual authority T1 | Bridge / 3–7 |
| SourceStage enum extension | light eng |
| `confirmFact` runtime status promotion (§2.4A) | Phase 3 code |
| FreezeRecord runtime sidecar | Phase 3+ |
| DDR instance catalog | Phase 2 |

Phase 1.1 report file itself is **unchanged** in this Phase 1.2 work.

---

## Suggested reviewer checklist procedure

1. Open PR file list → confirm only documentation (four Phase 1 docs).  
2. Walk AC-1 → AC-12 and **AC-C1 → AC-C12**; mark PASS/FAIL/WAIVE.  
3. Spot-check code cites: `fact-combination.ts`, `dir-aggregator.ts`, `content-hash.ts`, `page-feed-matrix.ts`.  
4. Confirm eight-page mapping unchanged; Call A/B retired as Intake entry.  
5. Confirm C1–C5 closed; other Phase 1.1 items still deferred.  
6. Sign PASS only if all non-waived AC pass — **do not merge** until product approves.

---

## Phase 1.2 exit statement (for PR)

When AC-C1–AC-C12 and updated AC-1–12 pass **independent** product review:

- C1–C5 are closed in normative docs (including C4 all-DIR-`n_a` / empty-`R` fix).  
- Phase 2 Blueprint Engine may start **only after** explicit product PASS of this PR.  
- **No** runtime / Agent / Call A/B / schema / UI / PASS changes in this PR.  
- **Do not merge** until product review completes.

### PR file-list note

Compared to base `docs/decision-intake-2.0-phase-1-data-contract`, the branch may also show **`PHASE-1-1-REVIEW-REPORT.md` as added**. That file is the Phase 1.1 independent review record brought along because Phase 1.2 branched from the review commit — **not** a Phase 1.2 edit of the review report. Phase 1.2 normative edits are only the four Phase 1 contract documents.

---

## Declaration

Phase 1 / 1.2 acceptance criteria document only. **No runtime code, schema, UI, prompt, or PASS modified.**
