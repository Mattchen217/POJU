# Stage 3.2 — N/A Authority Production Sources Audit

| Field | Value |
|---|---|
| **Status** | Audit / design only — **no production code change** |
| **Baseline (R6 frozen)** | `5012e114e3109afbdf93d234224e167b6ad6e995` |
| **Scope** | Production authority for `dirCatalog`, `catalogConditionEvals` / `topicRules`, `cfpSourceState` |
| **Out of scope** | Freeze Gate / Sufficiency Gate / Session–DC snapshot bind / C5 hash / Versioning / DB schema; R6-accepted Session event SoT |
| **Normative refs** | Phase 2 DIR Catalog · Topic Applicability · DDR Catalog §1.3; R6 Understanding §2.7; Final Binding §1 / §3; `PRODUCTION_NA_VALIDATION_SOURCE_GAPS` |

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
