# Decision Intake 2.0 · Phase 1.1 Independent Contract Review

| Field | Value |
|---|---|
| **Review type** | Independent technical review (docs only; no product-rule changes) |
| **Reviewed PR** | [#33](https://github.com/Mattchen217/POJU/pull/33) |
| **Reviewed branch** | `docs/decision-intake-2.0-phase-1-data-contract` |
| **Reviewed commit** | `15b0752597b0a71f01a9d1b0821ec74708add0f4` |
| **Base SHA** | `297544134d7dcc8c942d5d314760bc3f4a75423f` (`main`) |
| **Review branch** | `docs/decision-intake-2.0-phase-1-1-review` |
| **Materials** | Phase 1 ×4 + Phase 0 baseline + product plans + cited production code |
| **Runtime changes** | **None** — this report file only |

---

## 5.1 Overall verdict

# **PASS WITH CONDITIONS**

The four Phase 1 documents establish a **coherent architecture** aligned with the product plan and Phase 0 baseline: DC as intended SoT, DDR≠DIR≠Agenda, Call A/B retired as Intake entry, PageFeedMatrix faces locked, Session≠Lockout, glossary reuse mandated.

They are **not yet sufficient for an implementer to code without guessing** on several Critical/High points (confirm→status, DIR SoT ownership, session-phase consistency, DDR satisfaction algorithm, progress weights, content_hash vs blueprint).

**Phase 2 (Blueprint Engine) may start only after Conditions C1–C5 below are resolved in a product-approved doc revision.** Lower items may ride later phases as listed in §5.5.

This is **not PASS**. This is **not FAIL** of the overall direction.

---

## 5.2 Issue inventory

### ISS-01 — Confirm event does not define `status` promotion (blocks DIR `known`)

| | |
|---|---|
| **Severity** | **Critical** |
| **Docs** | `PHASE-1-DATA-CONTRACT.md` §2.4 (OPEN “promote path”); §2.8 DIR; Acceptance AC-11 #1–2 |
| **Code** | `confirmation-event.ts` `applyFactConfirmToDc` L513–528 — updates **`user_confirmed` only**; `dir-aggregator.ts` `aggregateDirState` L131–157 — role satisfied for **`known` only when `fact.status === "confirmed"`**; collecting writes `unverified` via `production-dc-lifecycle.ts` `buildRealityFact` |
| **Actual code** | Confirm → `user_confirmed=true` possible; **`status` unchanged**; DIR stays `unknown`/`partial` if only `unverified` facts exist |
| **Doc expected** | Legal pairs include `confirmed`+`user_asserted`; DIR known from confirmed roles; promote path deferred as “Phase 3 OPEN” |
| **Gap** | Without a normative rule “when does `status` become `confirmed`?”, Intake cannot produce DIR=`known`, so Sufficiency/DDR satisfaction cannot work against reused aggregator |
| **Consequence** | Implementers either invent a promote rule or forever FAIL gate / never reach known DIRs |
| **Fix** | Product must decide: (A) confirm event also sets `status=confirmed` when verification allows; (B) aggregator treats `user_confirmed`+`unverified` as enough for some DIR tiers; (C) separate explicit “confirm & lock fact” user action. Then revise Data Contract + State Machines; keep Eng SoT consistency |
| **Product decision?** | **Yes** |

---

### ISS-02 — Session phase set inconsistent across docs / diagram bug

| | |
|---|---|
| **Severity** | **Critical** |
| **Docs** | State Machines §1 diagram uses `blueprint_building`; transition table jumps `intake_init`→`blueprint_ready`; Data Contract §9 omits `blueprint_building`. Diagram labels `understanding_review ──(user confirms)──► awaiting_user_confirm` while table says “Summary shown” for that edge and “User confirms” only on `awaiting_user_confirm`→`frozen` |
| **Code** | N/A (new machine) |
| **Gap** | Two mutually inconsistent normative descriptions of M1 |
| **Consequence** | Illegal/orphan states; UI and orchestrator disagree |
| **Fix** | Single canonical phase enum; fix diagram labels; add/remove `blueprint_building` explicitly |
| **Product decision?** | Enum naming can be eng; whether blueprint build is a user-visible phase = **product** |

---

### ISS-03 — DIR dual ownership (Blueprint `dir_index` vs `DC.dirs`)

| | |
|---|---|
| **Severity** | **Critical** |
| **Docs** | Data Contract §1 object map: Blueprint **defines** DIR[]; §4: “Prefer DC.dirs as SoT; blueprint holds seed”; Traceability §2: DIR aggregated in DC |
| **Code** | `types.ts` DIR lives on `DecisionContext`; Call B `dirsFromAgenda` writes DC (`production-dc-lifecycle.ts`) |
| **Gap** | Circular / dual SoT risk after seed |
| **Consequence** | Second fact-ish store of information needs; stale DIR copies |
| **Fix** | Normative rule: **DC.dirs is sole mutable DIR SoT**; Blueprint stores only `dir_id` references + immutable seed snapshot at blueprint_version; no parallel live DIR array |
| **Product decision?** | No (eng consistency); product OK needed if Blueprint must display frozen DIR text snapshots |

---

### ISS-04 — DDR `status` computation unspecified

| | |
|---|---|
| **Severity** | **High** |
| **Docs** | Data Contract §3 lists `pending\|partial\|satisfied\|blocked\|n_a` and “computed from DIR states + sources”; no algorithm; Sufficiency §8 item 6 requires DDR satisfied; Traceability maps families but not status rules |
| **Code** | No DDR type exists today |
| **Gap** | Cannot implement Gate or Understanding progress |
| **Consequence** | Guesswork / divergent eng implementations |
| **Fix** | Normative DDR status function (e.g. all required_dir_ids known|n_a → satisfied; any blocking conflict → blocked; else partial/pending); P2 DDR never alone blocks Gate |
| **Product decision?** | **Partial** — eng can draft algorithm; product confirms P0 vs P1 blocking matrix |

---

### ISS-05 — Progress % weights OPEN while AC-5.5 treats “stated” as pass

| | |
|---|---|
| **Severity** | **High** (for UI/readiness UX); Medium for Blueprint-only Phase 2 |
| **Docs** | Data Contract §6 “code-owned weights”; §14 T9 OPEN; Acceptance AC-5.5 Pass if “Stated” |
| **Code** | Legacy `formatAgendaProgressLabel` / agenda coverage — Phase 0 |
| **Gap** | AC over-accepts narrative presence vs implementable formula |
| **Consequence** | UI can still fake 100%; Gate FAIL while UI shows 100% |
| **Fix** | Publish weight table + invariant `progress==100 ⇒ Gate∈{PASS,WARN_bounded}`; revise AC-5.5 verify method |
| **Product decision?** | **Yes** (weights / what 100% means) |

---

### ISS-06 — `content_hash` vs product freeze metadata tension

| | |
|---|---|
| **Severity** | **High** |
| **Docs** | Data Contract §2.2 / §11: hash = business payload only; product plan §9.4 requires hash cover Blueprint/DDR versions; Freeze metadata lists `blueprint_version` |
| **Code** | `content-hash.ts` `extractBusinessPayload` L93–160 — **DC only**, no blueprint_version |
| **Gap** | Silent conflict: extend hash vs binding sidecar |
| **Consequence** | Report binding incomplete or hash churn on UI-irrelevant blueprint edits |
| **Fix** | Product pick: (A) binding triple + separate `blueprint_version`/`ddr_version` fields on freeze record **outside** DC content_hash; (B) include canonical blueprint/DDR snapshot in hash payload. Eng recommends **A** to avoid UI/scope-metadata polluting fact hash |
| **Product decision?** | **Yes** |

---

### ISS-07 — Sufficiency PASS/WARN/FAIL ≈ mapping underspecified vs DDR/Definition

| | |
|---|---|
| **Severity** | **High** |
| **Docs** | Data Contract §8 maps to `evaluateDecisionSufficiency` then “extends” with Definition/DDR/etc. without normative merge |
| **Code** | `stop-criteria.ts` `evaluateDecisionSufficiency` — DIR/conflict focused; **no DDR, no Definition clarity** |
| **Gap** | Reuse vs replace unclear |
| **Consequence** | Eng either ignores DDR in Gate or forks incompatible gates |
| **Fix** | Spec `evaluateIntakeSufficiency(dc, blueprint)` composition order + FAIL/WARN precedence |
| **Product decision?** | WARN freezable paths = **product**; composition = eng with product confirm |

---

### ISS-08 — Conflict / Constraint / Hypothesis lifecycles incomplete for writers

| | |
|---|---|
| **Severity** | **High** (known Phase 0; docs honest but not closed) |
| **Docs** | Data Contract §2.5–2.7 tech findings; State Machines §7 |
| **Code** | `openConflict`/`clarifyConflict` library; **no** `production-dc-lifecycle` conflict append; no collecting Constraint writer; Hypothesis via Call A only today |
| **Gap** | State Machines §2 says Answer Interpretation updates Conflict/Constraint but no triggers (when auto-open conflict? who classifies contradiction?) |
| **Consequence** | Silent overwrite risk if eng invents; or never open conflicts → Gate weak |
| **Fix** | Normative triggers: contradiction detector inputs; Constraint extraction from answers; Hypothesis only from analysis step — before Phase 3 coding |
| **Product decision?** | When to ask user to clarify conflict = **product**; detector thresholds = eng |

---

### ISS-09 — Agenda `covered` vs unknown/declined vs DIR mapping residual risk

| | |
|---|---|
| **Severity** | **High** (legacy) / Medium (docs correctly forbid; still must bar porting) |
| **Docs** | State Machines §2.2 forbids porting `shouldForceSatisfiedAfterSecondCantProvide` to DIR known; Data Contract §5 invariant |
| **Code** | `question-status.ts` L36–41, L151–154; `state-machine.ts` ~404–415; `collecting-phase-v6.ts` ~960 — force Agenda covered |
| **Actual** | 2× cant-provide → Agenda `covered` / satisfied |
| **Doc expected** | → Fact unknown/declined + depth stop; DIR stays unknown unless facts satisfy |
| **Gap** | Docs correct; Acceptance does not require a **regression test contract** against legacy helper |
| **Consequence** | Future PR may “reuse” clamp helpers and reintroduce false known |
| **Fix** | Add explicit “banned legacy helpers” list + AC test requirement in Phase 3/4 |
| **Product decision?** | No |

---

### ISS-10 — Adaptive Question Engine: selection algorithm still qualitative

| | |
|---|---|
| **Severity** | **Medium** (OK to refine in Phase 4; risky if Phase 2 invents planner early) |
| **Docs** | State Machines §2.3 priority list; Data Contract §5 plan fields; budget §12 |
| **Code** | Call B one-shot agenda — retired |
| **Gap** | No deterministic tie-break (equal P0 gaps); no formal “user expansion” acceptance criteria beyond scope-change proposal fields |
| **Consequence** | Non-reproducible question order across eng |
| **Fix** | Before Phase 4: stable sort key (priority, may_affect_p5, dependency depth, dir_id) |
| **Product decision?** | Tie-break preference optional product input |

---

### ISS-11 — Invalid input classifier + Lockout persistence locus undefined

| | |
|---|---|
| **Severity** | **High** for Phase 8; **Medium** for Phase 2 entry |
| **Docs** | Data Contract §10; State Machines §3; AC-10 |
| **Code** | Legacy `rules.ts` spam/jailbreak ≠ product invalid; `escalation_locked_at` ≠ 10m/24h/3-strike product SM |
| **Gap** | Who classifies invalid (code regex vs model)? Where is durable lockout stored (IndexedDB bypassable vs server)? |
| **Doc expected** | Server enforced; no model/DC/Agenda/PASS while locked |
| **Consequence** | Client-only lock = bypass; or over-classify short answers as invalid |
| **Fix** | Product: classifier ownership + examples goldenset; Eng: server session lock record schema |
| **Product decision?** | **Yes** (classifier boundary) |

---

### ISS-12 — `agent_v2` still operational authority in production UI

| | |
|---|---|
| **Severity** | **High** (migration debt; correctly listed T1) |
| **Docs** | Data Contract §1, §11, §14 T1; Phase 0 |
| **Code** | `POJUChatUI.tsx` gates on `session.agent_v2?.current_phase` (e.g. L853–856, L2074); Agenda panel from `agent_v2`; DC hydrate comment L558 |
| **Gap** | Contract states DC SoT aspirationally; no migration cutover acceptance |
| **Consequence** | Dual write during bridge phases |
| **Fix** | Phase 3+ cutover plan: UI reads Intake session phase + Understanding projection; `agent_v2` read-only façade or deleted |
| **Product decision?** | Cutover UX timing = product |

---

### ISS-13 — Call A/B retirement stated; SourceStage still contains call_a/call_b

| | |
|---|---|
| **Severity** | **Medium** |
| **Docs** | Data Contract §2.9 OPEN on enum extension |
| **Code** | `types.ts` `SourceStage` includes `call_a`\|`call_b` |
| **Gap** | Intake writers may accidentally stamp Call A/B |
| **Fix** | Ban write of call_a/call_b in Intake writers; optional deprecate later |
| **Product decision?** | Enum extend = eng/product light confirm (already OPEN T7) |

---

### ISS-14 — Ziwei delivery hydration gap acknowledged; chat closed-set only

| | |
|---|---|
| **Severity** | **Medium** (Phase 5/9) |
| **Docs** | Data Contract §7, T6; Phase 0; Traceability §9 |
| **Code** | `task-context.ts` omits `ziwei_fact_pack`; breakthrough closed-set in `breakthrough-core` |
| **Gap** | PersonalAnalysisProfile contract requires ZiWei; production report path incomplete |
| **Fix** | Phase 5/9 hydrate pack; do not block Phase 2 Blueprint |
| **Product decision?** | No |

---

### ISS-15 — V6 production vs product-plan “Shadow” doc drift

| | |
|---|---|
| **Severity** | **Low** (docs already call out T5) |
| **Docs** | Data Contract T5; Phase 0; product plan §10.2 stale |
| **Code** | `poju-v6-flag.ts` default true; `agent-phase-runner.ts` |
| **Fix** | Product plan errata; Intake prompts are new entry anyway |
| **Product decision?** | Doc hygiene |

---

### ISS-16 — Hypothesis `related_fact_ids` / Constraint `related_dir_ids` missing in code types

| | |
|---|---|
| **Severity** | **Low–Medium** |
| **Docs** | Data Contract §2.5–2.6 “recommended add” |
| **Code** | `types.ts` Constraint has no `related_dir_ids`; Hypothesis has `related_dir_ids` only |
| **Fix** | Additive optional fields in Phase 3 types ADAPT |
| **Product decision?** | No |

---

### ISS-17 — Traceability provenance record optional; no hard refuse rule wired to AC

| | |
|---|---|
| **Severity** | **Medium** (Phase 9) |
| **Docs** | Traceability §7–8; AC-8.5/8.6 |
| **Gap** | “Refuse or WARN” not tied to Gate FAIL |
| **Fix** | Phase 9 AC: required segments without ddr_ids → build fail |
| **Product decision?** | Strictness = product |

---

### ISS-18 — `independently_verified` + confirm event still forces `user_confirmed=false`

| | |
|---|---|
| **Severity** | **Medium** (correct per Eng SoT; must be product-visible) |
| **Docs** | Data Contract §2.4 |
| **Code** | `deriveUserConfirmed` L73–75 always false for independently_verified |
| **Gap** | Legal pair `confirmed`+`independently_verified` can never have `user_confirmed=true` — surprising but consistent |
| **Fix** | Call out in product FAQ; no silent change |
| **Product decision?** | Confirm understanding only |

---

## 5.3 Acceptance Criteria review (AC-1 … AC-12)

Legend: **PASS** = criterion met as *Phase 1 documentation quality*. **OPEN** = stated but not implementably closed. **FAIL** = internal contradiction or false confidence. Reviewer does **not** lower the bar.

| ID | Result | Basis |
|---|---|---|
| AC-1.1 | **PASS** | All named objects appear with duties in Data Contract |
| AC-1.2 | **PASS WITH NOTE** | Enums listed; Session omits `blueprint_building` used in SM diagram → see ISS-02 |
| AC-1.3 | **PASS** | Tables mark required |
| AC-1.4 | **OPEN** | Chain drawn but DIR ownership dual (ISS-03) |
| AC-1.5 | **PASS** | Invariants explicit |
| AC-2.1 | **FAIL** | Transition table vs diagram inconsistency (ISS-02) |
| AC-2.2 | **PASS** | M2 loop present |
| AC-2.3 | **PASS** | Session≠Lockout |
| AC-2.4 | **PASS** | Unknown vs invalid separated |
| AC-2.5 | **PASS** | Freeze after confirm; stall/CTA denied |
| AC-2.6 | **PASS** | §7 gap list honest |
| AC-3.1 | **PASS** | Stated |
| AC-3.2 | **PASS** | Stated |
| AC-3.3 | **PASS** | T1 listed |
| AC-3.4 | **PASS** | Invariant |
| AC-4.1 | **PASS** | Duties distinct |
| AC-4.2 | **PASS** | Faces `01`–`08` match `page-feed-matrix.ts` / PageFeedMatrix doc |
| AC-4.3 | **PASS** | Invariant + code cite; legacy risk ISS-09 |
| AC-4.4 | **PASS** | Stated |
| AC-5.1 | **PASS** | PASS/WARN/FAIL |
| AC-5.2 | **OPEN** | ≈ mapping only (ISS-07) |
| AC-5.3 | **PASS** | Aligned with freeze guards |
| AC-5.4 | **PASS** | Stated; depends on `may_affect_p5_ranking` discipline |
| AC-5.5 | **OPEN** | “Stated” ≠ weights defined (ISS-05); risk of UI 100% without Gate |
| AC-5.6 | **PASS** | Stated; blocked in practice by ISS-01 for “confirmed” scoring |
| AC-6.1–6.4 | **PASS** | Qualitative but present |
| AC-6.5 | **PASS** | Call A/B retired |
| AC-6.6 | **PASS** | Explicit; needs future test AC (ISS-09) |
| AC-7.1–7.5 | **PASS** | Isolation + glossary + paths |
| AC-7.6 | **PASS** | T6 listed |
| AC-8.1–8.4 | **PASS** | Trace + face map consistent with matrix |
| AC-8.5 | **PASS** | Failure modes listed |
| AC-8.6 | **OPEN** | Shape proposed; not binding (ISS-17) |
| AC-9.1–9.3 | **PASS** | Persist matrix + binding |
| AC-9.4 | **OPEN** | Server required but locus/schema missing (ISS-11) |
| AC-9.5 | **PASS** | Rebuild from DC |
| AC-10.1–10.4 | **PASS** as product rules documented |
| AC-10.5 | **PASS** | Unimplemented acknowledged |
| AC-11 #1 | **OPEN** | Legal pairs match `LEGAL_FACT_COMBINATIONS` **but** promote path missing (ISS-01) |
| AC-11 #2 | **PASS** | independently_verified ⇏ user_confirmed matches code |
| AC-11 #3–4 | **PASS** | Explicit |
| AC-11 #5 | **PASS** | Stated |
| AC-11 #6 | **PASS** | Stated |
| AC-11 #7 | **PASS** | Stated |
| AC-11 #8 | **PASS** | Budget table present |
| AC-11 #9 | **OPEN** | Rule yes; enforceability incomplete (ISS-11) |
| AC-11 #10 | **OPEN** | Rules stated; cutover incomplete (ISS-12) |
| AC-12.1 | **PASS** | Four docs present on reviewed commit |
| AC-12.2 | **PASS** | PR #33 docs-only (verified by file list) |
| AC-12.3 | **PASS** | `lib/decision-intake/` recommended not created |
| AC-12.4 | **PASS** | Risks listed; some still need product (this review expands) |
| AC-12.5 | **PASS** | T5 |
| AC-12.6 | **PASS** | PR stop statement |

**Summary counts (strict):** FAIL 1 (AC-2.1) · OPEN several · remainder PASS. Overall Phase 1 package → **PASS WITH CONDITIONS**, not unconditional PASS.

---

## 5.4 Product decision checklist

| PD-ID | Question | Blocking for |
|---|---|---|
| **PD-01** | After explicit user confirm of a fact, does `status` become `confirmed`, or only `user_confirmed`? If only flag, must DIR aggregator change? | Phase 3 / any DIR-known path |
| **PD-02** | Is `blueprint_building` a real session phase? Fix understanding_review diagram semantics | Phase 2 orchestration |
| **PD-03** | DDR status / Gate: which DDR priorities block FAIL vs WARN? | Phase 2–6 |
| **PD-04** | Progress weight table and invariant linking 100% to Gate | Phase 6–7 |
| **PD-05** | Freeze binding: blueprint/DDR versions inside `content_hash` or sidecar fields? | Phase 6 / 9 |
| **PD-06** | When WARN, may user freeze into conditional report without resolving P0? | Phase 6 |
| **PD-07** | Invalid-input goldenset / classifier owner (code vs model) | Phase 8 |
| **PD-08** | Conflict auto-open aggressiveness vs ask-user-first | Phase 3 |
| **PD-09** | SourceStage: extend enums vs reuse `collecting`/`opening` | Phase 3 writers |
| **PD-10** | Confirm understanding of `independently_verified` never yielding `user_confirmed` | Docs only |

**Engineering (not product) decisions** once PD answered: DIR sole SoT in DC; Intake sufficiency composer; banned legacy helpers list; server lockout schema; stable question sort key.

---

## 5.5 Phase 2 entry conditions

### Must resolve before Phase 2 starts (documentation revision + product sign-off)

| Condition | Maps to |
|---|---|
| **C1** Close PD-01 with written rule compatible with `dir-aggregator` **or** approved aggregator change spec | ISS-01 |
| **C2** Unify M1 phase enum + fix diagram (PD-02) | ISS-02 |
| **C3** Normative DIR ownership: DC.dirs sole live SoT | ISS-03 |
| **C4** Minimal DDR status + Gate composition rules (PD-03/PD-06 draft OK) | ISS-04, ISS-07 |
| **C5** Freeze hash vs sidecar decision (PD-05) | ISS-06 |

### May defer (track in later phase AC)

| Item | Earliest phase |
|---|---|
| Progress weights (PD-04) | Phase 6–7 |
| Lockout server schema / classifier (PD-07) | Phase 8 |
| Conflict auto-open policy detail (PD-08) | Phase 3 |
| Ziwei task-context hydration | Phase 5 / 9 |
| JudgmentProvenance hard refuse | Phase 9 |
| `agent_v2` UI cutover | Phase 3–7 bridge |
| Legacy cant-provide regression tests | Phase 3–4 |
| Hypothesis/Constraint additive fields | Phase 3 |

### Explicit non-goals until PASS of above

- Do not create `lib/decision-intake/` until C1–C5 closed.  
- Do not modify Call A/B, Agent, prompts, UI, schema, PASS.  
- Do not treat AC “Stated” rows as implementation-complete.

---

## Cross-check: ten mandated questions (A–C)

| # | Verdict | Notes |
|---|---|---|
| 1 DC sole authority? | **Aspirational PASS / runtime FAIL today** | Contract correct; `POJUChatUI` still phase-gates on `agent_v2` (ISS-12) |
| 2 DDR/DIR/Blueprint/Agenda overlap? | **Mostly clean; DIR dual-SoT risk** | ISS-03 |
| 3 Understanding derived only? | **PASS in contract** | Must not cache as SoT (§11) |
| 4 Personal analysis isolated? | **PASS in contract** | Glossary reuse hard; ZFP hydration gap deferred |
| 5 FactStatus×Verification×user_confirmed? | **Pairs PASS; confirm semantics OPEN** | ISS-01, ISS-18 |
| 6 Agenda covered vs unknown vs DIR? | **Docs PASS; legacy code dangerous** | ISS-09 |
| 7 Conflict/Constraint/Hypothesis lifecycle? | **Incomplete** | ISS-08 |
| 8 Gate/Progress/Freeze false PASS? | **Hard-push blocked PASS; Progress 100% risk OPEN** | ISS-05, ISS-07 |
| 9 Adaptive one-question + budgets? | **PASS qualitatively** | Tie-break Medium (ISS-10) |
| 10 Lockout server-enforceable? | **Rule PASS; mechanism OPEN** | ISS-11 |

---

## Traceability vs PageFeedMatrix

Reviewed Traceability §3–4 against `page-feed-matrix.ts` `PAGE_UNION_ALLOWLISTS` and `.cursor/docs/decision-report/PageFeedMatrix-2026-10-27.md`: face ids, main order, appendix `03`, and per-face User/CFP/ZFP families **match**. No invented pages. **PASS**.

---

## Declaration

- Only added: `docs/eastern-os/decision-intake-2.0/PHASE-1-1-REVIEW-REPORT.md`  
- Did **not** modify the four Phase 1 docs, Phase 0 text, runtime code, prompts, UI, schema, or PASS logic  
- Did **not** merge PR #33 or start Phase 2  

**Next:** Product reviews this report → approves PD-* answers → eng revises Phase 1 docs on a follow-up docs PR → then Phase 2.
