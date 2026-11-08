# Stage 3.2 — N/A Authority Production Sources Audit

| Field | Value |
|---|---|
| **Status** | Audit / design only — **no production code change** |
| **Baseline (R6 frozen)** | `5012e114e3109afbdf93d234224e167b6ad6e995` |
| **This revision parent** | `cb7a807d764211869ac025ac3e3fb9baee384659` (initial audit) |
| **Scope** | Production authority for `dirCatalog`, `catalogConditionEvals` / `topicRules`, `cfpSourceState` |
| **Out of scope** | Freeze Gate / Sufficiency Gate / Session–DC snapshot bind / C5 hash / Versioning / DB schema; R6-accepted Session event SoT |
| **Normative refs** | Phase 2 DIR Catalog · Topic Applicability · DDR Catalog §1.3; R6 Understanding §2.7; Final Binding §1 / §3; `PRODUCTION_NA_VALIDATION_SOURCE_GAPS` |

**Read order:** §§0–F = inventory from initial audit (kept). **§G onwards = Supplement 1** (authority isolation, catalog version binding, CFP reader contract, search evidence, deliverables A–E). Where Supplement 1 conflicts with earlier “minimal plan” wording, **Supplement 1 wins**.

---

## 0. Verdict (one line)

All three authority families are **validator-ready but production-unwired**: Freeze/aggregation fail-closed when they are absent (no empty-array PASS), yet **no trusted server loader** feeds them; the only injection surface is optional `opts.authority` / test fixtures — which Freeze still **accepts for these gap fields** without provenance or catalog-version binding.

---

## A. Production call chains and source inventory

### A.0 Shared consumption spine

```
Session / draft DC
  → buildFreezeNaValidationFromSession | buildNaValidationContextFromSession
       → NaValidationContext
            → freezeDecisionContext / startV2FromFinal / reaggregateDirsIntake
                 → resolveDirRoleEvidence
                      → findValidatedDirLevelNa / validateExplicitNaEvidence
                           → conditionInDirCatalog | catalogConditionEvals | topicRules+topicEvalAuthority | cfpSourceState
```

**Primary files**

| Layer | Path | Symbols |
|---|---|---|
| Freeze wire (production) | `lib/poju/decision-context/production-freeze-wire.ts` | `applySufficiencyFreezeToSession` (~L145), `ensureSessionFrozenForDelivery` |
| Freeze package | `lib/poju/decision-context/freeze-to-delivery.ts` | `freezeDraftForDelivery`, `buildFreezeNaValidationFromSession` |
| Session → NaValidation | `lib/poju/decision-context/na-validation-from-session.ts` | `buildNaValidationContextFromSession`, `PRODUCTION_NA_VALIDATION_SOURCE_GAPS`, `reaggregateDirsOnSession` |
| Versioning wire | `lib/poju/decision-context/production-versioning.ts` | `applyV2FromFinalToSession` |
| Collecting / Call B reagg | `lib/poju/decision-context/production-dc-lifecycle.ts` | `reaggregateDirsOnSession` (~L210, ~L278) |
| Ask / planner | `lib/poju/decision-context/production-intake-ask.ts` | `selectNextIntakeAskForSession` → `buildNaValidationContextFromSession` |
| Validator | `lib/poju/decision-context/explicit-na-validate.ts` | `validateExplicitNaEvidence`, `conditionInDirCatalog`, `validateCatalogNaConditionMet`, `validateTopicNotApplicable` |
| Topic eval SoT helper | `lib/poju/decision-context/topic-eval-authority.ts` | `resolveAuthoritativeTopicEval` |
| User N/A write | `lib/poju/decision-context/na-declaration.ts` | `declareDirNotApplicable`, `applyDeclareDirNaToSession` (`dir_na_conditions` input) |
| Delivery callers | `lib/llm/pro/final-delivery.ts`, `lib/poju/phases/segment2/control.ts` | `ensureSessionFrozenForDelivery` |

**Production Freeze entry today**

`applySufficiencyFreezeToSession` → `freezeDraftForDelivery(draft, { session, now })` — **no `authority` argument**.  
Therefore production Freeze NaValidation has Session event SoT filled, and **gap fields left `undefined`**.

---

### A.1 `dirCatalog`

| Axis | Finding |
|---|---|
| **Meaning** | Per-`dir_id` allowlist of `na_conditions` codes; validator requires membership for DIR-target user N/A and system markers (`conditionInDirCatalog`). |
| **Type** | `DirNaCatalogEntry` in `explicit-na-validate.ts` (~L59–62) |
| **Normative definition source** | Docs: `docs/eastern-os/decision-intake-2.0/PHASE-2-DIR-CATALOG.md` (`dir_catalog_version = 1`, field `na_conditions`) |
| **Code module / loader** | **None.** No `lib/.../dir-catalog*.ts`, no import of Phase 2 markdown into runtime. |
| **Session / DC store** | **None.** Not on `POJUSessionState` or `DecisionContext`. |
| **Adapter fill** | `buildNaValidationContextFromSession`: `dirCatalog: overrides.dirCatalog` only (~L174). Default = `undefined`. |
| **Freeze path** | `buildFreezeNaValidationFromSession` strips Session-owned keys, then spreads remaining `catalogOrCfpAuthority` — **`dirCatalog` from `opts.authority` is still allowed** (~L127–146, freeze-to-delivery.ts). Production wire does not pass it → `undefined`. |
| **Consume** | `conditionInDirCatalog` (~L136–144); used by `validateUserSource`, `validateCatalogNaConditionMet`, `validateTopicNotApplicable`. Missing entry → `na_condition_not_in_catalog` (fail-closed). |
| **Related write-path gap** | `DeclareDirNaInput.dir_na_conditions` (`na-declaration.ts` ~L417–421, ~L654) is documented as “Server-resolved catalog conditions” but **`declareDirNotApplicable` trusts caller-supplied array** — no catalog join at write time. Write-time check ≠ Freeze-time `dirCatalog`. |
| **Trusted production?** | **No.** Only tests / explicit `authority` injection. |

**Call chain (production)**

```
ensureSessionFrozenForDelivery
  → applySufficiencyFreezeToSession
    → freezeDraftForDelivery({ session })          // no authority
      → buildFreezeNaValidationFromSession
        → buildNaValidationContextFromSession
          → dirCatalog = undefined
            → validateUserSource → na_condition_not_in_catalog
              → Explicit N/A Evidence on DC never becomes Gate-effective
```

Same undefined path for: `reaggregateDirsOnSession` (lifecycle), `selectNextIntakeAskForSession`, `applyV2FromFinalToSession` (unless caller passes `authority.dirCatalog`).

---

### A.2 `catalogConditionEvals` and `topicRules`

Treated as one audit item (system-marker proofs), with Session topic **evals** called out as a separate boundary.

#### A.2.1 `catalogConditionEvals`

| Axis | Finding |
|---|---|
| **Meaning** | Deterministic proof rows for `system_basis.kind === "catalog_na_condition_met"` (`CatalogNaConditionEval`, ~L28–35). |
| **Normative** | R6 Understanding §2.7 A2 — re-execute DIR `na_conditions`; `condition_eval_id` records proof. |
| **Session / DC / code store** | **None.** |
| **Adapter** | `overrides.catalogConditionEvals` only (`na-validation-from-session.ts` ~L175). |
| **Freeze** | Pass-through via `catalogOrCfpAuthority` if supplied; production = `undefined`. |
| **Consume** | `validateCatalogNaConditionMet` (~L297–325): missing → `catalog_eval_missing`. |
| **Trusted production?** | **No.** |

#### A.2.2 `topicRules`

| Axis | Finding |
|---|---|
| **Meaning** | Rule definitions (`rule_id`, `topic_code`, `target_dir_id`, embedded `evaluation` hint) required before Session topic authority lookup. |
| **Normative** | Phase 2 Topic Applicability strategy doc (seed rules) + Understanding §2.7 A2 (`rule_id` ∈ Topic Applicability catalog). |
| **Code catalog of rules** | **None.** Docs only (`PHASE-2-TOPIC-APPLICABILITY.md`) — strategy, not typed runtime rule registry. |
| **Adapter** | `overrides.topicRules` only (~L176). |
| **Freeze** | Pass-through via gap authority; production = `undefined`. |
| **Consume** | `validateTopicNotApplicable` (~L328–380): missing rule → `topic_rule_missing`; then `resolveAuthoritativeTopicEval`. |
| **Trusted production?** | **No.** |

#### A.2.3 Session-adjacent topic fields (not the gap, but coupled)

| Field | SoT | Freeze behavior |
|---|---|---|
| `session.topic_applicability_evals` | Session (optional array on `POJUSessionState`, `types.ts` ~L364) | **Hard Session SoT** in `buildFreezeNaValidationFromSession` (~L154); forged `opts.authority.topicEvalAuthority` stripped (R6). |
| `session.topic_catalog_version` | Session (~L368) | Forced as `currentTopicCatalogVersion` on Freeze (~L140–155). |
| Production writers of evals / version | **No production writer found** under `lib/poju` (only type slots + tests). | Rows can exist only if something external mutates Session — no Intake lifecycle writer today. |

**Implication:** Even if Session somehow held valid topic evals, Freeze still cannot authorize Topic N/A without a production `topicRules` (+ `dirCatalog`) source. R6 proved Session-vs-forge isolation **when tests inject rules/catalog**; production never injects them.

---

### A.3 `cfpSourceState`

| Axis | Finding |
|---|---|
| **Meaning** | Live ChartFactPack / profile source presence for DDR-03 N/A path (`source_ok` \| `source_absent_not_supplied` \| `source_calc_failed` \| `source_provenance_missing`). |
| **Normative** | Phase 2 DDR Catalog §1.3; Understanding §2.7 A1; Final Binding §3 (“always re-read live CFP state”). |
| **Delivery “CFP”** | ChartFactPack for page feeds (`lib/llm/pro/delivery/**`) — **orthogonal**; not wired as Intake `cfpSourceState`. |
| **Live reader for Intake** | **None** in `lib/poju/decision-context`. No function maps birth/profile → §1.3 enum into NaValidation. |
| **Adapter** | `overrides.cfpSourceState` only (~L177). |
| **Freeze** | Pass-through gap field; production = `undefined`. |
| **Consume** | `validateExplicitNaEvidence` DDR branch (~L428–440): if `cfpSourceState` ≠ `source_absent_not_supplied` → reject (`ddr03_cfp_not_absent` / calc_failed / provenance). `undefined` ⇒ reject (fail-closed). |
| **Trusted production?** | **No.** |

---

### A.4 Authority boundary matrix (current)

| Concern | Authoritative store (target) | Current production SoT | May `opts.authority` set it? |
|---|---|---|---|
| Confirmation / E1 | Session `confirmation_events` | Session | **Freeze: no** (stripped). Versioning/agg builders: yes if caller passes overrides |
| N/A declaration actions | Session `na_declaration_actions` | Session | **Freeze: no**. Else: yes |
| Explicit N/A Evidence / Classifications | DC | DC (+ Session bind) | Facts/classifications rebound from DC on Freeze |
| Topic eval **rows** | Session `topic_applicability_evals` | Session slot (unwritten) | **Freeze: no**. Else: yes |
| Topic catalog **version string** | Session `topic_catalog_version` (+ live catalog) | Session slot | **Freeze: Session only** |
| **DIR `na_conditions` catalog** | Phase 2 DIR Catalog (versioned code/registry) | **Missing** | **Yes (gap pass-through)** |
| **Catalog condition evals** | Deterministic eval registry / computed proof store | **Missing** | **Yes** |
| **Topic applicability rules** | Topic Rules catalog (versioned) | **Missing** | **Yes** |
| **CFP source state** | Live profile/CFP measurement | **Missing** | **Yes** |

---

## B. Gap vs target architecture

| ID | Gap | Risk if left as-is | Risk if naively “fixed” |
|---|---|---|---|
| G1 | No runtime DIR Catalog loader (`dir_catalog_version` + `na_conditions`) | Production Explicit N/A **never** Gate-effective at Freeze/agg (fail-closed). Valid user declarations cannot flip DIR → `n_a`. | Injecting client `dirCatalog` via Freeze `authority` without server join → **false N/A**. |
| G2 | Write path `dir_na_conditions` is caller-supplied | Classification can be minted against a forged allowlist even when Freeze later lacks matching `dirCatalog` (or conversely, if Freeze later trusts forged catalog). | Paper over with empty `[]` → write always fails / silent. |
| G3 | No `catalogConditionEvals` production store or recompute | `catalog_na_condition_met` markers never validate. | Default empty map treated as PASS would violate fail-closed. |
| G4 | No `topicRules` production registry; Session topic evals never written | Topic N/A path dead in production. | Trusting embedded `rule.evaluation` without Session authority already forbidden; adding empty rules array would still fail, but forging rules+evals via `authority` on Freeze could false-authorize (rules not Session-stripped). |
| G5 | No live CFP source-state reader for Intake/DDR-03 | DDR-03 N/A never authorizes; calc_failed cannot be distinguished from absent in aggregation context. | Caching a stale `cfpSourceState` on DC/Session as authority would violate “re-read live”. |
| G6 | Freeze still accepts gap fields from `opts.authority` with **no provenance / version pin** | Today unused by production wire; future chat/client callers can override catalogs/CFP without audit. | Closing override without adding loaders leaves production stuck fail-closed for all system/user catalog-gated N/A. |
| G7 | Versioning / lifecycle use `buildNaValidationContextFromSession` **without** Freeze’s Session-event strip | Session event forge possible on those paths if callers pass `authority` (R6 locked Freeze only). Catalog gaps same as Freeze. | Do not “fix” by inventing empty catalogs. |
| G8 | Documented `PRODUCTION_NA_VALIDATION_SOURCE_GAPS` (~L32–37) already names all four missing loaders | Honest fail-closed — good. Not yet tied to a loader roadmap or Freeze provenance check. | — |

**Fail-closed status (important):** Current code does **not** disguise missing sources as `[]` / default PASS in the Session adapter. Missing → `undefined` → validator reject. That invariant must be preserved.

---

## C. File / function / location index

| Item | Location |
|---|---|
| Gap constant list | `na-validation-from-session.ts` L32–37 `PRODUCTION_NA_VALIDATION_SOURCE_GAPS` |
| Adapter only-overrides for three families | same file L173–177 |
| Freeze Session strip + catalog pass-through | `freeze-to-delivery.ts` L117–156 `buildFreezeNaValidationFromSession` |
| Production Freeze without authority | `production-freeze-wire.ts` L145–148 |
| Versioning authority merge (no strip) | `production-versioning.ts` L66–72 |
| Lifecycle reagg without catalogs | `production-dc-lifecycle.ts` L210, L278 |
| Ask path without catalogs | `production-intake-ask.ts` L118–122 |
| `dirCatalog` map / membership | `explicit-na-validate.ts` L121–144, L236–238, L305–307, L333–335 |
| Catalog condition eval gate | same L297–325 |
| Topic rules + Session authority | same L328–380; `topic-eval-authority.ts` L38–112 |
| CFP state gate (DDR) | `explicit-na-validate.ts` L428–440 |
| Write-time `dir_na_conditions` | `na-declaration.ts` L417–421, L316–318, L650–655, L696+ |
| Normative DIR `na_conditions` | `docs/.../PHASE-2-DIR-CATALOG.md` |
| Normative CFP states | `docs/.../PHASE-2-DDR-CATALOG.md` §1.3 |
| Normative topic / system basis | `docs/.../PHASE-3-UNDERSTANDING-STATE.md` §2.7 A1–A2 |
| R6 runtime Gate tests (fixtures inject catalogs) | `scripts/test-intake-r6-freeze-versioning.ts` section F (frozen; do not regress) |

---

## D. Minimal modification plan (design only — not authorized to implement)

Principles: **do not change** Freeze Gate / Sufficiency / Session–DC bind / C5 / Versioning schema; **do not** invent empty PASS; **do not** reopen R6 Session event SoT.

### D.1 Add versioned production loaders (server-owned)

1. **`loadDirNaCatalog(dirCatalogVersion)`**  
   - Code SSOT derived from Phase 2 DIR Catalog (`dir_id` → `na_conditions[]`).  
   - Returns `readonly DirNaCatalogEntry[]` + version string.  
   - Used by: NaValidation builders **and** `declareDirNotApplicable` (replace trusting `input.dir_na_conditions`).

2. **`loadTopicApplicabilityRules(topicCatalogVersion)`**  
   - Typed rule registry (initially small closed set aligned with Phase 2 topic packs).  
   - Separate from Session `topic_applicability_evals` (evals remain Session SoT; rules remain catalog SoT).

3. **`loadOrComputeCatalogConditionEvals(...)`** (or pure recompute)  
   - Only when evidence claims `catalog_na_condition_met`.  
   - Prefer deterministic recompute from DIR catalog + DC facts over a mutable client store; if persisted, pin `condition_eval_id` + inputs hash.

4. **`readLiveCfpSourceState(session | profile binding)`**  
   - Maps birth/profile/calc outcome → §1.3 enum.  
   - **Never** persisted as N/A authority on DC; always re-read at validate/Freeze/Gate.

### D.2 Wire into builders without client forge

| Change | Intent |
|---|---|
| Extend `buildNaValidationContextFromSession` / `buildFreezeNaValidationFromSession` to **compose** gap fields from loaders when `authority` omits them | Production path gets real sources |
| On Freeze: treat gap fields like Session events — **reject or ignore client-supplied `dirCatalog` / `topicRules` / `catalogConditionEvals` / `cfpSourceState` unless marked as loader output with version pins** | Close G6 |
| Pin `dir_catalog_version` (and topic catalog version already on Session) into NaValidation or Freeze audit metadata **without** altering C5 business payload unless a later authorized schema task says so | Provenance for review; avoid silent version skew |
| `declareDirNotApplicable`: server resolves `dirNaConditions` via loader; drop caller authority for that list | Close G2 |

### D.3 Impact on existing links

| Link | Impact |
|---|---|
| R6 Freeze Session event SoT + F1–F4 tests | **Untouched** if loaders only fill gap keys; tests that inject `dirCatalog`/`topicRules` remain valid as explicit harness overrides **or** migrate to loader fixtures |
| Production Freeze wire | One-line composition: call Freeze with server authority **or** bake loaders into `buildFreezeNaValidationFromSession` |
| Lifecycle / Ask / V2 | Same loader composition so planner and Freeze agree |
| DDR / Understanding chain | Still out of Stage slice until Gate composer consumes live CFP; loader D.1.4 is the Intake-side prerequisite |
| DB schema | **No change required** if catalogs are code SSOT and CFP is live-read |

### D.4 Explicit non-goals for the first implementation slice

- Do not weaken fail-closed when loader returns miss for a claimed `dir_id` / rule_id.  
- Do not auto-PASS DDR-03 when profile empty without ExplicitNaEvidence.  
- Do not move topic **eval rows** into catalog (Session remains SoT for evals).  
- Do not modify R6-accepted tests’ Session-vs-forge semantics.

---

## E. Tests and acceptance criteria (to add after implementation authorization)

### E.1 Production-source presence (positive)

| ID | Scenario | Accept |
|---|---|---|
| PS-1 | Freeze with real Explicit user N/A Evidence + Session action/E1 + **loader** `dirCatalog` containing condition | DIR `current_state === "n_a"` |
| PS-2 | Same Evidence but loader catalog **omits** condition | DIR not `n_a`; reason path `na_condition_not_in_catalog` |
| PS-3 | Topic marker + Session topic eval + loader `topicRules` + matching catalog version | DIR `n_a` |
| PS-4 | Topic marker + Session eval but **no** loader rules | not `n_a` (`topic_rule_missing`) |
| PS-5 | DDR-03 evidence + live reader `source_absent_not_supplied` | evidence validates |
| PS-6 | DDR-03 evidence + live `source_calc_failed` | reject (`ddr03_calc_failed_no_na`) |

### E.2 Anti-forge / isolation (must not regress R6)

| ID | Scenario | Accept |
|---|---|---|
| PS-7 | Production Freeze entry **ignores** client `authority.dirCatalog` that would authorize N/A when loader would not | stays non-`n_a` |
| PS-8 | Client `authority.topicRules` / `cfpSourceState` cannot authorize when loader/live reader disagree | fail-closed to loader/live |
| PS-9 | R6 F1–F4 still PASS (Session events / topic evals) | no regress |
| PS-10 | `declareDirNotApplicable` with caller `dir_na_conditions` **disagreeing** with loader → write rejected | no forged classification |

### E.3 Fail-closed / no empty PASS

| ID | Scenario | Accept |
|---|---|---|
| PS-11 | Loader unavailable / throws → aggregation must **not** treat catalogs as empty allow-all; N/A not applied; error surfaced or evidence inert | no silent `n_a` |
| PS-12 | Adapter never materializes `dirCatalog: []` as “loaded empty catalog that PASS-skips membership” for unknown dirs | membership still false |

### E.4 Cross-path consistency

| ID | Scenario | Accept |
|---|---|---|
| PS-13 | Same Session snapshot: lifecycle `reaggregateDirsOnSession` vs `freezeDraftForDelivery` vs Ask planner NaValidation agree on whether a given ExplicitNaEvidence is Gate-valid | identical validate result |
| PS-14 | Catalog version skew (Session `topic_catalog_version` ≠ rule/eval version) | Topic N/A rejected (`topic_catalog_version_stale` / mismatch) |

---

## F. Recommended next authorization slice

1. Implement **DIR Catalog loader + declareDir write join + Freeze compose** (closes G1/G2/partial G6) — highest leverage for user Explicit N/A.  
2. Then Topic Rules registry + Session eval writer (G4).  
3. Then live CFP reader for DDR-03 (G5) before Gate/Understanding vertical.  
4. `catalogConditionEvals` after deterministic recompute design is fixed (G3).

**Stop condition for this audit:** no production code changed; R6 commit remains frozen; await independent review and explicit implement authorization.

---

# Supplement 1 — Authority Isolation, Catalog Version Binding, CFP Reader Contract

| Field | Value |
|---|---|
| **Status** | Design addendum to this audit — **still no production code** |
| **Parent audit commit** | `cb7a807d764211869ac025ac3e3fb9baee384659` |
| **Search date** | 2026-11-05 (workspace @ parent + local doc edit) |

---

## G. Search evidence (scoped claims)

### G.0 Claim discipline

| Phrase | Meaning |
|---|---|
| **Not found in checked production paths** | Grep/read across listed roots; no matching writer/reader in those trees. |
| **Not found in entire `*.{ts,tsx}` workspace hit set** | Pattern search returned only tests / type slots / validators — still not a formal proof against non-TS assets or future branches. |
| **Do not claim** | “Impossible in all deployments” or “never exists outside repo.” |

**Checked roots (all four evidence questions):**  
`lib/poju/**`, `lib/poju/decision-context/**`, `lib/llm/pro/final-delivery.ts`, `lib/poju/phases/**`, `scripts/test-intake-r6-*.ts`, plus workspace `*.{ts,tsx}` pattern greps named below.

### G.1 Topic Applicability Session evals — production writers?

**Patterns:** `topic_applicability_evals` / `topic_catalog_version` assignment or object literals.

| Hit class | Paths |
|---|---|
| Type slot | `lib/poju/types.ts` (~L364, ~L368) |
| Freeze / adapter **read** | `freeze-to-delivery.ts` (~L141–154); `na-validation-from-session.ts` (~L151–171) |
| Topic authority **consume** | `topic-eval-authority.ts` |
| **Write / seed** | **Only** `scripts/test-intake-r6-freeze-versioning.ts` (F3/F4 fixtures) |

**Conclusion:** In the checked `*.{ts,tsx}` workspace hit set, **no production writer** assigns `session.topic_applicability_evals` or `session.topic_catalog_version`. Session fields exist; production Intake lifecycle / CAS / Ask / Freeze do not populate them.  
**Not claimed:** absence in non-TS tooling, manual IndexedDB edits, or code outside this repo checkout.

### G.2 Catalog Condition Evals — production generate / recompute?

**Patterns:** `catalogConditionEvals`, `CatalogNaConditionEval`, `condition_eval_id`.

| Hit class | Paths |
|---|---|
| Type + validator | `explicit-na-validate.ts` (`CatalogNaConditionEval`, `validateCatalogNaConditionMet`) |
| Adapter pass-through | `na-validation-from-session.ts`, `role-resolver.ts` `emptyNaValidation` |
| Evidence shape | `types.ts` `system_basis.condition_eval_id` |
| **Populate** | **Only** `scripts/test-intake-r6-role-resolver.ts` fixtures |

**Conclusion:** **Not found** any production generate/recompute/persist path for `catalogConditionEvals` in checked TS. Validator expects rows when basis claims `catalog_na_condition_met`; nothing in `lib/poju` builds them.  
**Not claimed:** future pure-function designs outside current tree.

### G.3 `dir_na_conditions` — other server validation entries?

**Patterns:** `dir_na_conditions`, `dirNaConditions`.

| Hit class | Paths |
|---|---|
| Production API surface | `na-declaration.ts`: `DeclareDirNaInput.dir_na_conditions`; passed into `createExplicitNaClassificationFromUserDeclaration({ dirNaConditions })` (~L316 membership check, ~L654) |
| Production entry | `declareDirNotApplicable` → `applyDeclareDirNaToSession` — **does not** resolve conditions from a catalog loader |
| Freeze-time check | **Separate:** `conditionInDirCatalog` on `NaValidationContext.dirCatalog` (`explicit-na-validate.ts`) — different input channel |
| Callers of declare* | **Only** `scripts/test-intake-r6-na-cas.ts`, `scripts/test-intake-r6-role-resolver.ts` in TS hit set (comment claims “UI control → …” but **no** `lib/` UI/API caller found) |

**Conclusion:** In checked production lib, the **only** server-side membership check at write is `input.dirNaConditions.includes(code)` — authority of that array is **caller-supplied**. Freeze uses a **different** optional `dirCatalog` channel. No third catalog-join entry found under `lib/poju`.  
**Not claimed:** undocumented HTTP handlers outside this tree.

### G.4 `cfpSourceState` — other production readers?

**Patterns:** `cfpSourceState`, `source_absent_not_supplied`, `source_calc_failed`, `source_provenance_missing`, `source_ok` (TS).

| Hit class | Paths |
|---|---|
| NaValidation type + DDR validate | `explicit-na-validate.ts` (~L78–82, ~L428–440) |
| Adapter override | `na-validation-from-session.ts`, `role-resolver.ts` |
| Normative docs | Phase 2 DDR Catalog §1.3 (markdown) |
| Delivery ChartFactPack | `lib/llm/pro/delivery/page-schema/chart-fact-pack.ts` `buildChartFactPack` — **builds feed text**, does **not** emit Intake `cfpSourceState` enum |
| Tests | `test-intake-r6-production-agg.ts`, `test-intake-r6-role-resolver.ts` inject enum |

**Conclusion:** **Not found** any production function that maps Profile/CFP → `NaValidationContext.cfpSourceState`. Delivery CFP builder is a related artifact family, not an Intake live reader.  
**Related but not wired:** Session/profile identity hints (`has_profile`, `profile_skipped`, `selected_stored_profile_id` on POJU types; `getStoredProfile` / `createStoredProfile` under `lib/profile/**`; Lab `buildChartFactPack(structured)`). These are candidate **inputs** for a future reader, not current SoT for N/A validation.

---

## H. Deliverable A — Revised authority source & trust-boundary matrix

### H.1 Trust tiers (normative for future wiring)

| Tier | Name | Who may supply | May authorize N/A? |
|---|---|---|---|
| **T0** | Session event SoT | Persisted Session (`confirmation_events`, `na_declaration_actions`, `topic_applicability_evals`, `topic_catalog_version`) | Yes for event-bound proofs (R6 locked) |
| **T1** | DC business SoT | Persisted DC (facts, constraints, classifications, evidence, dirs, conflicts) | Evidence/payload only — not catalog/CFP authority |
| **T2** | Server catalog / live readers | Code SSOT loaders + live CFP reader invoked on server production paths | Yes for catalog membership, topic rules, catalog evals, CFP state |
| **T3** | `opts.authority` / `NaValidationAuthorityOverrides` | Callers (including tests) | **Must not override T2 on production paths**; must not forge T0 on Freeze (already stripped) |
| **T4** | Client / model / UI payload | Browser, LLM, free-form controls | **Never** Catalog / Topic Rules / CFP authority. May propose `dir_id` / `na_condition_code` / control ids only |

### H.2 Field × tier matrix (target)

| Field | Target tier | Production compose rule | `opts.authority` on production paths |
|---|---|---|---|
| `confirmationEvents` | T0 Session | Session only (Freeze already hard-binds) | **Ignored / stripped** |
| `naDeclarationActions` | T0 Session | Session only | **Ignored / stripped** |
| `topicEvalAuthority` | T0 Session | Session only | **Ignored / stripped** |
| `currentTopicCatalogVersion` | T0 Session (+ must match T2 topic catalog pin) | Session string; validate against loader version | **Ignored / stripped** |
| `realityFacts` / `constraints` / classifications | T1 DC | DC snapshot | Rebound from authoritative DC; not client catalogs |
| **`dirCatalog`** | **T2 loader** | `loadDirNaCatalog(version)` only | **Must not override loader result** |
| **`topicRules`** | **T2 loader** | `loadTopicApplicabilityRules(version)` only | **Must not override** |
| **`catalogConditionEvals`** | **T2 recompute/store** | Server recompute or server store only | **Must not override** |
| **`cfpSourceState`** | **T2 live reader** | `readLiveCfpSourceState(...)` at validate time | **Must not override** |

### H.3 Forbidden elevation patterns

1. Adding `authorityProvenance: "server"` / `trusted: true` on caller-supplied `opts.authority` and treating it as T2.  
2. Accepting client-built `DirNaCatalogEntry[]` because “tests also pass arrays.”  
3. Persisting a one-shot `cfpSourceState` on Session/DC and reusing it at Freeze instead of re-reading.  
4. Using empty `dirCatalog: []` to mean “catalog loaded, no conditions allowed” vs “loader failed” without distinct error channels — membership fail-closed is OK; **silent PASS is not**.

### H.4 Test fixture isolation (required design)

| Channel | Allowed | Isolation rule |
|---|---|---|
| `scripts/test-intake-r6-*.ts` | Inject T2-shaped fixtures via a **test-only** builder (e.g. `buildNaValidationContextForTests` / explicit `authority` only when calling **non-production** helpers) | Must **not** go through `applySufficiencyFreezeToSession` / `ensureSessionFrozenForDelivery` with injectable catalogs unless those production functions **refuse** overrides |
| Production wires listed in §I | Only T0+T1+T2 | No parameter that accepts raw catalog/CFP from outside loaders |
| R6 F1–F4 | Keep Session-vs-forge tests; catalog rows in those tests are harness data — when production hard-binds T2, F1–F4 either call Freeze helper with test loader seam **or** remain on `freezeDraftForDelivery` only if a documented test seam injects T2 **below** the production wire (never via forgeable client flag) | R6 semantics preserved |

---

## I. Deliverable B — Four production paths, one authority compose

### I.1 Paths

| Path | Entry | Today’s NaValidation builder |
|---|---|---|
| **Freeze** | `ensureSessionFrozenForDelivery` → `applySufficiencyFreezeToSession` → `freezeDraftForDelivery` | `buildFreezeNaValidationFromSession` |
| **Versioning** | `persistV2FromFinalOnSession` → `applyV2FromFinalToSession` | `buildNaValidationContextFromSession` (+ optional `opts.authority`) |
| **Lifecycle reagg** | Call B / collecting in `production-dc-lifecycle.ts` → `reaggregateDirsOnSession` | `buildNaValidationContextFromSession` |
| **Ask / planner** | `selectNextIntakeAskForSession` | `buildNaValidationContextFromSession` (or injected `naValidation` — **must be banned or re-validated on production**) |

### I.2 Single compose function (design)

Introduce one server-only composer used by all four paths (name illustrative):

```text
composeProductionNaValidation(session, dcSnapshot, opts?: { nowIso?: string }): NaValidationContext
```

**Body (order):**

1. Bind T0 from Session (events, N/A actions, topic evals, topic_catalog_version).  
2. Bind T1 from `dcSnapshot` (facts, constraints, classifications).  
3. Resolve catalog versions (see §J).  
4. `dirCatalog ← loadDirNaCatalog(dir_catalog_version)` — **overwrite**; never merge caller maps.  
5. `topicRules ← loadTopicApplicabilityRules(topic_catalog_version)` — overwrite.  
6. `catalogConditionEvals ← recomputeCatalogConditionEvals(...)` or load server store — overwrite.  
7. `cfpSourceState ← readLiveCfpSourceState(session identity binding)` — overwrite; never Session cache.  
8. Return context. **Do not accept** `NaValidationAuthorityOverrides` for T2 fields on this API.

**Wiring:**

| Path | Change intent |
|---|---|
| Freeze | `buildFreezeNaValidationFromSession` calls composer for T2; keeps R6 T0 strip; **delete** pass-through of `catalogOrCfpAuthority` on production |
| Versioning | Replace `...opts.authority` merge for T2 with composer; align T0 strip with Freeze |
| Lifecycle | `reaggregateDirsOnSession` production calls use composer (no `authority` from UI) |
| Ask | Ignore caller `input.naValidation` on production entry **or** assert it deep-equals composer output; prefer always compose |

### I.3 Consistency invariant

For the same `(session_id, context_id, version, content_hash business payload, catalog versions, live CFP measurement)`:

```text
validateExplicitNaEvidence(e, na_freeze)
  ≡ validateExplicitNaEvidence(e, na_versioning)
  ≡ validateExplicitNaEvidence(e, na_lifecycle)
  ≡ validateExplicitNaEvidence(e, na_ask)
```

Any divergence is a product defect. Tests PS-13 (initial audit) remain the acceptance hook.

### I.4 What stays path-specific

- Freeze still enforces Session↔draft business snapshot + sufficiency triggers.  
- Versioning still mutates V2 draft shape.  
- Lifecycle still seeds dirs from agenda.  
- Ask still ranks candidates.  
**Shared only:** NaValidation T0–T2 composition for N/A proofs.

---

## J. Deliverable C — `loadDirNaCatalog()` version binding

### J.1 Formal interface (design)

```ts
/** Code SSOT — not markdown parse. */
type DirNaCatalogVersion = string; // e.g. "1" matching Phase 2 dir_catalog_version

type DirNaCatalogLoadResult =
  | {
      ok: true;
      dir_catalog_version: DirNaCatalogVersion;
      entries: readonly DirNaCatalogEntry[]; // dir_id → na_conditions
    }
  | {
      ok: false;
      reason_code:
        | "dir_catalog_version_missing"
        | "dir_catalog_version_unknown"
        | "dir_catalog_load_failed";
    };

function loadDirNaCatalog(
  requestedVersion: DirNaCatalogVersion | null | undefined,
): DirNaCatalogLoadResult;
```

Optional helper:

```ts
function dirNaConditionsFor(
  load: Extract<DirNaCatalogLoadResult, { ok: true }>,
  dirId: string,
): readonly string[] | null; // null = DIR not registered
```

### J.2 Code SSOT (not markdown)

| Rule | Detail |
|---|---|
| Authority | TypeScript (or generated TS from a **checked-in** JSON/YAML committed beside code) under e.g. `lib/poju/decision-context/catalog/dir-na-catalog.v1.ts` |
| Docs | `PHASE-2-DIR-CATALOG.md` remains human normative; **runtime must not fetch/parse that markdown** as SoT |
| Drift | Process/CI may later diff doc ↔ code (separate authorization); until then code SSOT wins at runtime |
| Version constant | Export `DIR_NA_CATALOG_VERSION = "1"` (or semver string) with the entry table |

### J.3 Write-time vs Freeze-time version compatibility

| Moment | Behavior |
|---|---|
| **Write** (`declareDirNotApplicable`) | Server calls `loadDirNaCatalog(activeProductionVersion)` (or version pinned on Blueprint/Session **if** a future authorized field exists). Membership = loader `na_conditions` for `dir_id`. **Ignore** caller `dir_na_conditions` for authority (field deprecated or used only as client hint that must match loader). |
| **Freeze / reagg / Ask / V2** | Composer loads the **same** active production version **or** a Session-pinned version recorded at first catalog-dependent write — see open item E1. |
| **Compatibility** | If Session carries a pinned `dir_catalog_version` (future field) ≠ loader’s known set → fail-closed. If no pin yet, use singleton production version `"1"`. |
| **C5 / DB** | **Do not** put full catalog rows into C5 business payload. Version pin on Session/DC requires **independent schema authorization** (see §L). Until then, composer uses code default version only. |

### J.4 Fail-closed matrix

| Condition | Write (`declareDir*`) | Validate / Freeze |
|---|---|---|
| `requestedVersion` null/empty and no default policy | Reject write | N/A evidence inert (`dir_catalog_version_missing` or catalog missing → `na_condition_not_in_catalog`) |
| Unknown version string | Reject | Evidence inert / freeze may proceed for non-N/A dirs but must not apply catalog-gated N/A |
| Loader `ok: false` | Reject | Do **not** substitute `[]` as PASS; leave `dirCatalog` unset or mark validation unavailable |
| `dir_id` not in catalog | Reject declare for that DIR | `conditionInDirCatalog` false |
| Condition code not in DIR’s `na_conditions` | Reject (`na_condition_not_in_catalog`) | Same at validate |
| Caller supplies richer `dir_na_conditions` than loader | **Loader wins**; mismatch → reject write | Caller `opts.authority.dirCatalog` **ignored** on production |

---

## K. Deliverable D — `readLiveCfpSourceState()` contract

### K.1 Formal interface (design)

```ts
type CfpSourceState =
  | "source_ok"
  | "source_absent_not_supplied"
  | "source_calc_failed"
  | "source_provenance_missing";

type CfpLiveReadRequest = {
  session_id: string;
  /** Identity binding — which profile/birth the DDR-03 CFP obligation refers to */
  profile_ref: {
    kind: "stored_profile" | "session_inline_birth" | "none_declared";
    profile_id?: string;
    /** Optional expected provenance/hash from Blueprint profile_binding when present */
    expected_provenance?: { content_hash?: string; binding_id?: string };
  };
  nowIso: string;
};

type CfpLiveReadResult =
  | { ok: true; state: CfpSourceState; measured_at: string; profile_ref: CfpLiveReadRequest["profile_ref"] }
  | {
      ok: false;
      reason_code:
        | "cfp_identity_mismatch"
        | "cfp_reader_unavailable"
        | "cfp_session_mismatch"
        | "cfp_input_invalid";
    };

function readLiveCfpSourceState(req: CfpLiveReadRequest): CfpLiveReadResult;
```

### K.2 Real read sources & identity binding (candidate mapping — design)

| Input | Repo anchors (candidates, **not** currently wired to NaValidation) |
|---|---|
| Session identity | `POJUSessionState.session_id`; profile flags `has_profile`, `profile_skipped`, `selected_stored_profile_id` (`lib/poju/types.ts`) |
| Stored birth/profile | `getStoredProfile` / `createStoredProfile` (`lib/profile/stored-profiles-service.ts`); device IndexedDB AES (Never Stored cloud chat) |
| Chart artifact | `buildChartFactPack(structured, …)` (`lib/llm/pro/delivery/page-schema/chart-fact-pack.ts`) + `ProfileStructured` from calculations |
| Provenance expectation | Phase 2 Blueprint `profile_binding` (doc); Lab hashes `hashChartFactPackText` — Intake Gate must define which hash is obligatory |

**Binding rule:** Reader must resolve profile_ref from **Session-owned** ids, then load that profile’s birth/structured locally. Client-passed “CFP state” or “I have no birth” free text is **not** authority (may drive UX that sets Session flags via existing confirmed controls only).

### K.3 State decision criteria (align Phase 2 DDR §1.3)

| State | Criteria (design) |
|---|---|
| `source_absent_not_supplied` | Session/profile path shows required birth/profile inputs were **never supplied** (e.g. explicit skip / no stored profile / empty birth fields per product rules). Not “calc threw.” |
| `source_ok` | Required inputs present; structured/CFP build succeeds; when `expected_provenance` present, live hash/provenance **matches**. |
| `source_calc_failed` | Inputs present/expected but structured build or CFP construction **throws / invalid structure**. |
| `source_provenance_missing` | Artifact/build available but required provenance/hash **missing** when binding expected it. |

Priority when multiple apply: identity mismatch → reader `ok: false`; else calc_failed / provenance_missing outrank absent; absent only when inputs truly never supplied.

### K.4 When to re-read

| Moment | Re-read? |
|---|---|
| Each `composeProductionNaValidation` (Freeze, Versioning, Lifecycle reagg, Ask) | **Yes** |
| DDR / Sufficiency Gate evaluation that consumes CFP obligation | **Yes** (same reader; Gate wiring is separate authorization) |
| After Freeze snapshot persisted | Frozen DC may **record evidence ids**; must **not** treat a stored enum as live authority on later V2 open — V2 compose re-reads |
| Understanding cache | May cache `na_evidence_ids` only (Understanding §); **not** `cfpSourceState` |

### K.5 Ban on stale Session cache

- Forbidden: `session.cfp_source_state` (or agent_v2 buffer) as NaValidation authority.  
- Forbidden: DC field holding last CFP enum used to skip reader.  
- Allowed: Session flags that are **inputs** to the reader (`profile_skipped`, selected profile id) — reader still performs live load/measure.

### K.6 Fail-closed on read errors

| Reader result | N/A / DDR-03 effect |
|---|---|
| `ok: false` (identity mismatch, unavailable, invalid) | Treat as **not** `source_absent_not_supplied`; DDR-03 Explicit N/A **must not** authorize; prefer map to Gate unresolved / `source_calc_failed`-class denial without silent `n_a` |
| `ok: true` + `source_calc_failed` / `source_provenance_missing` | Validator rejects DDR-03 N/A (existing reason codes) |
| `ok: true` + `source_ok` | DDR-03 absence-N/A path closed |
| `ok: true` + `source_absent_not_supplied` | May authorize only with valid ExplicitNaEvidence (existing rules) |

Production compose: on reader `ok: false`, set `cfpSourceState` to a deny state **or** leave unset such that validate fails closed — **never** invent `source_absent_not_supplied`.

---

## L. Deliverable E — Open risks & items needing independent authorization

| ID | Item | Why separate auth |
|---|---|---|
| E1 | Persist `dir_catalog_version` (and/or topic catalog pin) on Session or DC | Touches Session/DC schema; audit forbids schema change without explicit grant |
| E2 | Ban/ignore `input.naValidation` on `selectNextIntakeAskForSession` production | Behavior change to Ask API; needs caller audit |
| E3 | Align Versioning T0 strip with Freeze | Small production change; must not break intentional test overrides — needs test-seam design |
| E4 | Remove `dir_na_conditions` from public `DeclareDirNaInput` or ignore it | API contract change for declare path |
| E5 | Topic eval **writer** production path | New CAS/lifecycle feature; Session field writes |
| E6 | Catalog condition **recompute** algorithm SSOT | Product rules beyond membership list |
| E7 | Wire Gate / Understanding / DDR composer to `readLiveCfpSourceState` | Out of Freeze-only slice; Phase 2 Gate surface |
| E8 | CI doc↔code catalog drift check | Tooling; not runtime SoT |
| E9 | Whether device-local profile read counts as “server” authority in Never Stored model | Product/security: loaders run in client runtime today for Session — “server-owned code SSOT” means **trusted module**, not necessarily cloud. Must clarify in implement brief that T2 = **product code SSOT + live local profile bind**, not client-forged arrays. |
| E10 | Changing C5 payload to include catalog version | Explicitly deferred; needs own RFC |

**Risks if implementers skip Supplement 1:**

- Re-introducing `opts.authority` catalog pass-through with a forgeable provenance flag.  
- Parsing markdown catalogs at runtime.  
- Caching CFP enum on Session.  
- Freeze/Ask/Lifecycle disagreeing on N/A validity.  
- Over-claiming “no writers exist anywhere” without re-running §G searches at implement time.

---

## M. Supplement 1 — summary checklist for reviewers

- [ ] A: T0–T4 matrix + forbidden elevation (§H)  
- [ ] B: Four paths → one `composeProductionNaValidation` (§I)  
- [ ] C: `loadDirNaCatalog` interface, code SSOT, write/Freeze version, fail-closed (§J)  
- [ ] D: `readLiveCfpSourceState` sources, criteria, re-read moments, no cache, fail-closed (§K)  
- [ ] E: Independent-auth list E1–E10 (§L)  
- [ ] Evidence §G uses scoped language (not absolute absence claims)  
- [ ] No production/test/schema/gate code changed in this revision  

**Stop:** await independent source review; do not self-declare Stage 3.2 complete; do not implement without explicit authorization.
