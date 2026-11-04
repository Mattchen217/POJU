# Decision Intake 2.0 · Phase 1 Acceptance Criteria

| Field | Value |
|---|---|
| **Scope** | Data contract documentation completeness & consistency |
| **Not in scope** | Runtime implementation (Phases 2+) |
| **Pass rule** | All **AC-*** items PASS or explicitly **WAIVED** by product with written reason |

This checklist accepts **Phase 1 documents**, not production engines. Each criterion is verifiable by reading the four Phase 1 docs + Phase 0 baseline + cited code — without running new features.

---

## AC-1 Data model completeness

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-1.1 | DC, DDR, DIR, Blueprint, AdaptiveQuestionPlan, DecisionUnderstanding, PersonalPatternInsight, SufficiencyGate, SessionLifecycle, Lockout, Persistence all defined | `PHASE-1-DATA-CONTRACT.md` TOC/sections | Each has duty + fields |
| AC-1.2 | Enums listed for FactStatus, VerificationLevel, DirCurrentState, ConflictState, DDR priority, Gate verdict, Session phases | Data contract §§2–10 | No bare “string status” for these |
| AC-1.3 | Required vs optional fields marked | Field tables | Required column present |
| AC-1.4 | Relationships DDR→DIR→Facts / Blueprint→Directions drawn | Data contract §1 + Traceability §1 | Single chain diagram |
| AC-1.5 | Invariants stated (Agenda≠DIR known; calc≠Fact; DC sole SoT) | Data contract + Traceability | Explicit invariants |

---

## AC-2 State transition legality

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-2.1 | Session lifecycle transitions tabulated with guards | State Machines §1 | No orphan phase |
| AC-2.2 | Per-turn loop defined (ask→classify→write→reaggregate→ready) | State Machines §2 | Present |
| AC-2.3 | Session ≠ Lockout machines separated | State Machines §0 | Explicit separation |
| AC-2.4 | Unknown/declined vs invalid paths distinct | State Machines §§2.5, 3 | No conflation |
| AC-2.5 | Freeze only after understanding confirm; not CTA/stall alone | State Machines §4 | Matches product §9 |
| AC-2.6 | Critical missing transitions listed as unimplemented | State Machines §7 | Honest gap list |

---

## AC-3 DC as sole fact source

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-3.1 | Contract forbids second fact DB / Understanding as SoT | Data contract §§1, 6 | Stated |
| AC-3.2 | Persistence says DC wins over agent buffers | Data contract §11 | Stated |
| AC-3.3 | Tech risk T1 dual-authority acknowledged | Data contract §14 | Listed |
| AC-3.4 | Hypotheses cannot write RealityFacts | Data contract §2.6 | Invariant |

**Code evidence (baseline):** `types.ts` header + `restoreDecisionContextAuthority`; Phase 0 notes `agent_v2` still UI-primary — accepted as **risk**, not Phase 1 fail.

---

## AC-4 DDR vs DIR boundary

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-4.1 | DDR = report obligations; DIR = information needs | Data contract §§3–4 | Distinct duties |
| AC-4.2 | DDR carries `report_page_id` in `01`–`08` only | Data contract §3 + Traceability §3 | Locked to PageFeedMatrix |
| AC-4.3 | DIR state from fact aggregation not Agenda | Data contract §2.8; Traceability §6 | Invariant + `agendaCoveredImpliesDirKnown` cite |
| AC-4.4 | P2 cannot alone block completion | Data contract §§3–4 | Stated |

---

## AC-5 Information sufficiency

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-5.1 | Gate verdicts PASS/WARN/FAIL defined | Data contract §8 | Present |
| AC-5.2 | Mapping to existing `evaluateDecisionSufficiency` documented | Data contract §8 | Present |
| AC-5.3 | Hard-push/stall/MAX cannot alone PASS | State Machines §4; Data contract §8 | Stated |
| AC-5.4 | Critical unknown affecting ranking blocks or forces explicit conditional path | Data contract §8; product §9.1 | Stated |
| AC-5.5 | Progress 100% requires Gate + P0 DIR + required DDR | Data contract §6; product §7.4 | Stated |
| AC-5.6 | unknown/declined/unverified not scored as confirmed | Data contract §6 | Stated |

---

## AC-6 Dynamic question planning

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-6.1 | One primary question per turn default | State Machines §2.3 | Stated |
| AC-6.2 | Priority order documented | State Machines §2.3 | Matches product §4.2 |
| AC-6.3 | Scope lock + new-direction proposal fields | Data contract §4 | Present |
| AC-6.4 | Depth soft cap 3 + budget table | Data contract §12; State Machines §2.4 | Present |
| AC-6.5 | Call A/B not Intake question factory | Data contract / State Machines mapping | Explicit retire |
| AC-6.6 | Legacy second-cant-provide→covered not reused for DIR known | State Machines §2.2 | Explicit |

---

## AC-7 Personal analysis isolation

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-7.1 | PersonalAnalysisProfile maps BaZi + ZiWei separately | Data contract §7 | Present |
| AC-7.2 | Calc ≠ RealityFact invariant | Data contract §7; Traceability §5 | Stated |
| AC-7.3 | Pattern Insight fields + optional user validation path | Data contract §7 | Present |
| AC-7.4 | Glossary reuse mandated (no rewrite) | Data contract principles / Phase 0 | Stated in contract intro or §7 |
| AC-7.5 | Code SoT paths cited (`ProfileStructured`, `ZiweiFactPack`) | Data contract §7 | Paths present |
| AC-7.6 | Production ZFP hydration gap listed as risk | Data contract §14 T6 | Listed |

---

## AC-8 Report traceability

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-8.1 | Full chain diagram Report←DDR←DIR←Agenda←Answer←DC←Report | Traceability §1 | Present |
| AC-8.2 | Eight faces locked; no structure change | Traceability §3 | Matches page-feed-matrix |
| AC-8.3 | DDR family → face mapping table | Traceability §4.2 | Present |
| AC-8.4 | Q&A vs calc split table | Traceability §5 | Present |
| AC-8.5 | Failure modes list | Traceability §8 | ≥5 modes |
| AC-8.6 | Provenance record shape proposed for later phases | Traceability §7 | Present |

---

## AC-9 Persistence & concurrency

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-9.1 | Persist matrix for DC, Blueprint, Lockout, Agenda audit | Data contract §11 | Present |
| AC-9.2 | Idempotency + freeze versioning rules | Data contract §11 | Present |
| AC-9.3 | Report binding triple required | Data contract §11; Traceability | Present |
| AC-9.4 | Lockout server-side + no PASS spend while locked | State Machines §3; Data contract §10 | Present |
| AC-9.5 | Understanding cache must rebuild from DC | Data contract §11 | Present |

---

## AC-10 Invalid input & lockout

| ID | Criterion | Verify by | Pass if |
|---|---|---|---|
| AC-10.1 | Invalid vs cooperative unknown distinguished | State Machines §§2.5, 3 | Present |
| AC-10.2 | Streak / lockout_count / 10m / 24h / 3rd terminate | Data contract §10; State Machines §3 | Present |
| AC-10.3 | Locked: no model, no Agenda, no DC mutate, no PASS | Same | Present |
| AC-10.4 | Expiry ≠ third lockout | State Machines §1 & §3 | Present |
| AC-10.5 | Listed as unimplemented in current repo | State Machines §7 | Present |

---

## AC-11 Special design questions (must be answered)

| # | Question | Where answered | Pass if unambiguous |
|---|---|---|---|
| 1 | status × verification legal pairs | Data contract §2.4 | Table matches `LEGAL_FACT_COMBINATIONS` |
| 2 | user_confirmed vs verification_level | Data contract §2.4 | independently_verified ⇏ user_confirmed |
| 3 | Agenda complete ≠ DIR known | Data contract §2.8; Traceability §6 | Explicit |
| 4 | No force-complete unknowns for progress | State Machines §2.2; AC-5.6 | Explicit |
| 5 | Critical unknown blocks or conditional report | Data contract §8 | Explicit |
| 6 | Understanding shared UI+planner | Data contract §6; State Machines §5 | Explicit |
| 7 | Pattern Insight from local calc, isolated | Data contract §7 | Explicit |
| 8 | Budget/depth/stop config | Data contract §12 | Explicit |
| 9 | Lockout server-enforced | Data contract §10 | Explicit |
| 10 | DC vs agent vs persist consistency | Data contract §11 | Explicit |

---

## AC-12 Engineering hygiene (Phase 1 delivery)

| ID | Criterion | Pass if |
|---|---|---|
| AC-12.1 | Four docs exist under `docs/eastern-os/decision-intake-2.0/` | Files present |
| AC-12.2 | No runtime code / prompt / schema / UI changes in PR | `git diff` only docs (+ optional Phase 0 doc bring-up) |
| AC-12.3 | Directory recommendation given without creating `lib/decision-intake/` | Data contract §13 |
| AC-12.4 | OPEN/tech risks listed; no silent product redesign | Data contract §14 |
| AC-12.5 | Product plan v6-shadow vs Phase 0 production-v6 called out | Data contract T5 |
| AC-12.6 | Phase 1 stops; no Phase 2 implementation | PR description states stop |

---

## Suggested reviewer checklist procedure

1. Open PR file list → confirm only documentation.  
2. Walk AC-1 → AC-12 tables; mark PASS/FAIL/WAIVE.  
3. Spot-check three code cites (`types.ts` FactStatus, `fact-combination.ts` legal pairs, `page-feed-matrix.ts` face ids).  
4. Confirm eight-page mapping does not invent faces.  
5. Confirm Call A/B explicitly retired as Intake entry.  
6. Sign PASS only if all non-waived AC pass.

---

## Phase 1 exit statement (for PR)

When this checklist passes product review:

- Data contracts are approved for Phase 2 Blueprint Engine design/implementation kickoff.  
- **No** Adaptive Question Engine coding until Phase 1 PASS.  
- **No** runtime Agent/Call A/B edits under the guise of Phase 1.

---

## Declaration

Phase 1 acceptance criteria document only. No runtime code modified.
