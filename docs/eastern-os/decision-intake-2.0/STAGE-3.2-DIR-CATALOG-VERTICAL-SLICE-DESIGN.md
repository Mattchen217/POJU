# Stage 3.2 — DIR Catalog Vertical Slice Design

| Field | Value |
|---|---|
| **Status** | **DESIGN ONLY — NO PRODUCTION IMPLEMENTATION AUTHORIZED** |
| **Baseline branch HEAD (at authoring)** | `eb0698e635ee00127f8dcf3f20a16ac739a56be4` |
| **Depends on** | N/A Authority audit + Supplement 1 (`STAGE-3.2-NA-AUTHORITY-PRODUCTION-SOURCES-AUDIT.md`); R6 freeze `5012e114…` |
| **In scope** | `DIR Catalog SSOT → declareDirNotApplicable write check → Freeze production read → N/A Validation` |
| **Out of scope** | CFP Live Reader; Topic Eval writer/recompute; Ask / Versioning / Lifecycle authority rewires; Schema / C5 / Gate changes; production or test code edits in this task |

This document is an implementation **plan**. It does **not** mean DIR Catalog is implemented, N/A Authority is production-wired, or Stage 3.2 is complete.

---

## 1. Current production call chains (code evidence)

### 1.1 Write path — `declareDirNotApplicable`

```
UI/control (intended; no lib/ caller found in TS at baseline)
  → declareDirNotApplicable(sessionId, input)          // na-declaration.ts ~L696
    → mutatePOJUSession(... apply: applyDeclareDirNaToSession)  // ~L704–714
      → applyDeclareDirNaToSession(latest, sessionId, input, now)  // ~L444
        → createExplicitNaClassificationFromUserDeclaration({
             dirNaConditions: input.dir_na_conditions   // ~L650–655  ← caller array is authority today
           })
             → input.dirNaConditions.includes(action.na_condition_code)  // ~L316–318
        → append classification + user_explicit_na evidence on DC
        → append UserNaDeclarationAction on Session
```

| Symbol | File | Evidence |
|---|---|---|
| `DeclareDirNaInput.dir_na_conditions` | `lib/poju/decision-context/na-declaration.ts` ~L406–421 | Comment claims “Server-resolved…Never trust model…” but field is still **required caller input** |
| `applyDeclareDirNaToSession` | same ~L444–689 | Passes `input.dir_na_conditions` unchanged into create |
| `createExplicitNaClassificationFromUserDeclaration` | same ~L276–318 | Membership check only against supplied array |
| `declareDirNotApplicable` | same ~L696+ | CAS persist entry |
| TS callers | `scripts/test-intake-r6-na-cas.ts`, `scripts/test-intake-r6-role-resolver.ts` | **No** `lib/**` production UI/API caller in workspace `*.{ts,tsx}` grep at baseline |

**Observed gap:** Write-time “catalog” membership is **not** joined to a code SSOT; it trusts `dir_na_conditions`.

### 1.2 Freeze path — production sufficiency wire

```
final-delivery.ts ~L931 / segment2/control.ts ~L1449
  → ensureSessionFrozenForDelivery(session, …)     // production-freeze-wire.ts ~L180
    → applySufficiencyFreezeToSession(session, { now })  // ~L113
         // opts has only `now` — no authority  (~L115–116, ~L145–148)
      → freezeDraftForDelivery(gate.draft!, { session, now })  // ~L145–148
        → assertSessionDraftBusinessSnapshotBound          // freeze-to-delivery.ts ~L58–115
        → buildFreezeNaValidationFromSession(session, dc, { now, authority })  // ~L173–177
             // Production call: authority undefined
             // If authority present: Session event keys stripped (~L129–137);
             // remaining catalogOrCfpAuthority STILL spread (~L145–147) including dirCatalog
        → freezeDecisionContext(..., { naValidation, expectedSessionId })  // ~L179–186
          → naValidationForDcSnapshot → reaggregateDirsIntake(..., na)  // freeze.ts ~L113–120
            → validateExplicitNaEvidence / conditionInDirCatalog     // explicit-na-validate.ts
```

| Symbol | File | Evidence |
|---|---|---|
| `applySufficiencyFreezeToSession` | `production-freeze-wire.ts` ~L113–148 | Does **not** pass `authority` |
| `buildFreezeNaValidationFromSession` | `freeze-to-delivery.ts` ~L122–157 | T0 Session hard-bind; **T2 `dirCatalog` still overridable** via `catalogOrCfpAuthority` |
| `buildNaValidationContextFromSession` | `na-validation-from-session.ts` ~L174 | `dirCatalog: overrides.dirCatalog` only (default `undefined`) |
| `PRODUCTION_NA_VALIDATION_SOURCE_GAPS` | same ~L32–37 | Documents missing DIR catalog loader |
| `conditionInDirCatalog` | `explicit-na-validate.ts` ~L136–144 | Missing entry → `false` → `na_condition_not_in_catalog` (~L236–238) |
| `DirNaCatalogEntry` | same ~L59–62 | `{ dir_id, na_conditions }` — type only; no registry module |

**Observed gap:** Production Freeze leaves `dirCatalog` undefined → Explicit N/A Evidence cannot validate → DIR stays non-`n_a` (fail-closed for false N/A, but **valid** declarations also inert).

### 1.3 Shared validation consume point

| Symbol | File | Role |
|---|---|---|
| `validateUserSource` | `explicit-na-validate.ts` ~L231–238 | Requires `conditionInDirCatalog` for `user_explicit_na` |
| `findValidatedDirLevelNa` / Intake agg | `explicit-na-validate.ts` / `dir-aggregator-intake.ts` | Gate-effective N/A only after validate OK |

Write and Freeze **do not** share one catalog membership helper today: write uses `dirNaConditions.includes`; Freeze uses `conditionInDirCatalog(ctx)`.

---

## 2. Current Catalog data sources and gaps

| Source | What it is | Production authority? |
|---|---|---|
| `docs/eastern-os/decision-intake-2.0/PHASE-2-DIR-CATALOG.md` | Human normative catalog; `dir_catalog_version = 1`; prose `na_conditions` per DIR | **Documentation only** — must **not** be runtime-parsed |
| `DirNaCatalogEntry` type | Shape for NaValidation | No data |
| Test fixtures | e.g. `{ dir_id: "DIR-A", na_conditions: [NA_CODE] }` in `scripts/test-intake-r6-*.ts` | Harness only |
| Caller `dir_na_conditions` | Write input | **Not** trusted T2 (Supplement 1) |
| `opts.authority.dirCatalog` | Freeze/adapter override | Forbidden as production T2; currently still pass-through on Freeze helper |

**Gaps to close in this vertical slice (design):**

1. Code SSOT registry + version string.  
2. Machine-stable `na_condition_code` tokens (Phase 2 currently uses prose).  
3. Shared membership API for write + Freeze.  
4. Production Freeze compose fills `dirCatalog` from loader only.  
5. Write ignores caller condition lists.  
6. Fail-closed taxonomy for missing / load fail / unknown version / incompatible version.

**Not in this slice:** Topic rules, catalogConditionEvals, CFP reader, Ask/Versioning/Lifecycle full T2 compose (may later call same loader; **must not** be rewired here).

---

## 3. Proposed SSOT and version mechanism

### 3.1 Formal definition location (unique, traceable)

| Artifact | Proposed path | Role |
|---|---|---|
| Versioned entries | `lib/poju/decision-context/catalog/dir-na-catalog.v1.ts` | **Runtime SSOT** — exported const table |
| Loader API | `lib/poju/decision-context/catalog/load-dir-na-catalog.ts` | `loadDirNaCatalog`, membership helpers |
| Shared assert | same module or `dir-na-catalog-membership.ts` | Used by write + Freeze |
| Human doc | `PHASE-2-DIR-CATALOG.md` | Spec narrative; optional future CI drift check (**separate auth**) |

**Forbidden:** `fs.readFile` / fetch / markdown parse of Phase 2 doc at runtime.

### 3.2 Version generation and recognition

| Rule | Design |
|---|---|
| Version id | Opaque string matching Phase 2: `"1"` initially (`DIR_NA_CATALOG_VERSION = "1"`) |
| Registry | `Record<DirNaCatalogVersion, DirNaCatalogSnapshot>` allowing **immutable** historical snapshots (`"1"`, later `"2"`, …) |
| Active production version | `ACTIVE_DIR_NA_CATALOG_VERSION` constant in loader module (code bump when releasing a new snapshot) |
| Recognition | `loadDirNaCatalog(requested)` succeeds iff `requested` ∈ registry keys |
| Unknown | `{ ok: false, reason_code: "dir_catalog_version_unknown" }` |

### 3.3 DIR and N/A condition registration rules

Each SSOT row:

```ts
{
  dir_id: string;                 // must match DC.dirs[].dir_id vocabulary
  na_conditions: readonly string[]; // stable codes, e.g. "explicit_no_hard_red_lines"
  // optional: notes_ref for humans — not used in validate
}
```

**Registration rules:**

1. Every `dir_id` that may receive Explicit N/A **must** appear in the active snapshot (even if `na_conditions: []` = “never N/A”).  
2. Condition codes are **closed tokens**; prose from Phase 2 is mapped once into tokens at SSOT authoring (examples below — final token set fixed at implement auth).  
3. Unlisted `dir_id` → not registered.  
4. Listed DIR but code ∉ `na_conditions` → condition not registered.  
5. Empty `na_conditions` → all declare attempts for that DIR fail membership (intentional “Never N/A”).

**Illustrative token mapping (design seed; implementer locks table):**

| Phase 2 prose (doc) | Proposed code |
|---|---|
| Never N/A… | `[]` |
| Explicit “no hard red lines”… | `explicit_no_hard_red_lines` |
| Explicit “no material constraints”… | `explicit_no_material_constraints` |
| Topic not relationship → not seeded | (seed/applicability — often empty N/A list; topic path out of slice) |

Test DIRs like `DIR-A` used in R6 harness are **not** Phase 2 catalog ids; production SSOT should use real Phase 2 ids. Harness isolation: tests use a **test-only** snapshot module or inject via non-production builder — not by forging production `opts.authority` on `applySufficiencyFreezeToSession`.

### 3.4 Fail-closed: unregistered DIR / condition / unknown version

| Case | `loadDirNaCatalog` / membership | Write | Freeze validate |
|---|---|---|---|
| Unknown version | `ok: false` / `dir_catalog_version_unknown` | Reject declare | Do not set productive `dirCatalog`; evidence fails `na_condition_not_in_catalog` or Freeze surfaces catalog error (see §5) |
| Loader throw / unavailable | `dir_catalog_load_failed` | Reject | Fail-closed — **no** `dirCatalog: []` PASS |
| Version missing (null) with no pin policy | `dir_catalog_version_missing` | Reject | Fail-closed |
| DIR not in snapshot | membership false / `dir_not_in_catalog` | Reject | Validate fail |
| Condition not on DIR | `na_condition_not_in_catalog` | Reject | Validate fail |

### 3.5 Historical Session N/A semantics after catalog updates

**Constraint this slice:** no Session/DC Schema change → **cannot** persist `dir_catalog_version` on declaration without separate authorization (§9).

**v1 policy (authorized without schema):**

1. Ship immutable snapshot `"1"`.  
2. **Additive-only evolution while unpinned:** new catalog version `"2"` may **add** DIRs/conditions but must **not remove or reinterpret** codes that `"1"` already allowed — so historical evidence `(dir_id, na_condition_code)` that validated under `"1"` still membership-true under `"2"` if Freeze uses active `"2"`.  
3. **Breaking changes** (rename/remove condition, shrink allowlist) **require** Session/DC pin of `dir_catalog_version` at write time (**§9 E-SCHEMA-1**) before they may ship.  
4. Until pin exists, Freeze and write both use `ACTIVE_DIR_NA_CATALOG_VERSION` only; “incompatible version” tests use a **multi-version registry harness** (request `"9"` unknown, or simulate pin mismatch API once schema authorized).

**Evidence identity (unchanged):** persisted `ExplicitNaEvidence` / classification keep `dir_id` + `na_condition_code`; historical meaning = those tokens under the snapshot policy above — not re-prose from markdown.

### 3.6 Write ↔ Freeze compatible version

| Without schema pin | With future pin (separate auth) |
|---|---|
| Both call `loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)` | Write stores pin; Freeze loads **pinned** version; if pin ∉ registry → fail-closed |
| Compatibility = same active constant + additive-only rule | Compatibility = pin ∈ registry ∧ membership under that snapshot |

Shared helper:

```ts
assertNaConditionInDirCatalog(load, dirId, code): 
  { ok: true } | { ok: false; reason_code: ... }
```

Write and Freeze **must** call this (or Freeze fills `dirCatalog` from the **same** `load.entries` then existing `conditionInDirCatalog`).

---

## 4. Write-side validation design

### 4.1 Target flow

```
declareDirNotApplicable
  → applyDeclareDirNaToSession
    → load = loadDirNaCatalog(resolveWriteCatalogVersion(session))  // active "1" for v1
    → if !load.ok → throw NaDeclarationError(reason_code)  // distinguish codes
    → assertNaConditionInDirCatalog(load, input.dir_id, input.na_condition_code)
    → createExplicitNaClassificationFromUserDeclaration({
         dirNaConditions: load.entries for dir  // server-derived ONLY
         // OR replace dirNaConditions param with catalog assert upstream
       })
```

### 4.2 Rules

| Requirement | Design |
|---|---|
| Caller `dir_na_conditions` not authority | **Ignore** for membership (deprecate field in types in implement PR; until removed, must not be read for allow/deny) |
| Server validates DIR + condition | Via loader + `assertNaConditionInDirCatalog` |
| Unregistered / missing / incompatible | Reject with distinct `reason_code` (§7) |
| No forgeable provenance | No `authority` / `trusted` / `provenance` on `DeclareDirNaInput` elevates lists |
| Preserve valid N/A business semantics | Still require: allowlisted `control_id`, live source on DC, Session-bound action, E1 at **validate** time, classification linkage (existing R6 create/validate). Catalog join only replaces the membership source |

### 4.3 Interface impact (compat)

- `DeclareDirNaInput.dir_na_conditions`: mark obsolete; tests currently pass it — update tests only when **implementation** is authorized (this design task forbids test edits now).  
- `CreateNaClassificationInput.dirNaConditions`: keep as **server-filled** array from loader for minimal churn, or replace with catalog load result — implementer’s choice if assert is upstream.

---

## 5. Freeze production read design

### 5.1 Target flow (production wire only)

```
applySufficiencyFreezeToSession
  → freezeDraftForDelivery({ session, now })  // still no client authority
    → buildFreezeNaValidationFromSession
         1. Strip T0 overrides (R6 — keep exactly)
         2. load = loadDirNaCatalog(resolveFreezeCatalogVersion(session))
         3. if !load.ok → fail closed (throw FreezeError with reason_code OR
              build naValidation without dirCatalog and let N/A inert —
              prefer explicit FreezeError when any ExplicitNaEvidence present
              that requires catalog; always prefer distinct reason in logs)
         4. Set dirCatalog = load.entries  // OVERWRITE; never merge opts.authority.dirCatalog
         5. Do NOT spread catalogOrCfpAuthority.dirCatalog from opts on production path
```

**Recommended hardening (this slice):**  
`buildFreezeNaValidationFromSession` stops accepting `dirCatalog` from `opts.authority` entirely (ignore key). Test harnesses that need fixtures call a **test-only** helper (e.g. `buildFreezeNaValidationFromSessionForTests`) or pass entries through a loader test double registered only in test — **not** via forgeable production `authority` on `applySufficiencyFreezeToSession`.

`applySufficiencyFreezeToSession` continues to omit `authority` (already true ~L145–148).

### 5.2 Fail-closed (no empty PASS)

| Failure | Behavior |
|---|---|
| Loader missing / throw | FreezeError `dir_catalog_load_failed` — do not freeze with invented catalog |
| Unknown / missing version | FreezeError `dir_catalog_version_unknown` / `_missing` |
| Incompatible pin (future) | FreezeError `dir_catalog_version_incompatible` |
| Load OK but evidence condition not registered | Evidence inert; DIR not `n_a` (existing validate) — **not** a false PASS of N/A |

**Forbidden:** `dirCatalog: []` meaning “loaded empty allow-all”; empty snapshot is only valid if SSOT explicitly lists DIRs with empty condition lists (membership still false).

### 5.3 Write / Freeze semantic consistency

Same `ACTIVE` (or same pin) → same `entries` →  
`assertNaConditionInDirCatalog` at write ≡ `conditionInDirCatalog` at Freeze for that pair.

### 5.4 Preserve R6 Session event authority

**Do not change:**

- Strip of `confirmationEvents` / `naDeclarationActions` / `topicEvalAuthority` / `currentTopicCatalogVersion` from `opts.authority` (`freeze-to-delivery.ts` ~L129–156).  
- Session/DC business snapshot bind (`assertSessionDraftBusinessSnapshotBound`).  
- F1–F4 expectations: Session events authorize; forged event stores do not.

**Only change in this slice:** how `dirCatalog` is populated (loader overwrite, ignore forged catalog authority).

---

## 6. Authority trust boundary (this slice)

| Tier | Fields in slice | Production rule |
|---|---|---|
| T0 Session | confirmation, N/A actions, topic evals (unchanged) | Session SoT; Freeze strip forgeries |
| T1 DC | evidence, classifications, facts | Snapshot bind |
| T2 Catalog | `dirCatalog` / version | **Only** `loadDirNaCatalog` |
| T3 `opts.authority` | previously could set `dirCatalog` | **Must not** override T2 on Freeze production helpers |
| T4 Client | `dir_id`, `na_condition_code`, `dir_na_conditions` | Propose ids only; lists ignored |

Shared membership logic: one module (§3.6). Write and Freeze both T2-sourced.

**Not rewired here:** Ask / Versioning / Lifecycle may still omit `dirCatalog` until a later authorized compose slice; this vertical slice only guarantees **declare + Freeze production wire** agree when both use the loader. Document residual risk: lifecycle reagg before Freeze may still show non-`n_a` until Freeze — acceptable if product accepts Freeze as authoritative Gate moment; optional follow-up to call loader in lifecycle (**separate auth**, out of scope).

---

## 7. Test matrix (design — expected results)

Distinguish **rejection classes**. Implementation will add tests under authorized implement task; R6 suite must remain green.

| ID | Scenario | Class | Expected |
|---|---|---|---|
| **DC-1** | DIR+condition in active SSOT; valid Session/DC/E1/action | Normal allow | `declareDirNotApplicable` appends; Freeze → DIR `n_a` |
| **DC-2** | `dir_id` not in SSOT | Normal reject (unregistered DIR) | Write throws/returns `dir_not_in_catalog` (or equiv.); no Session action |
| **DC-3** | DIR registered; condition not in that DIR’s list | Normal reject (unregistered condition) | Write `na_condition_not_in_catalog` |
| **DC-4** | Catalog SSOT module absent / empty registry misconfig | Missing source | Write + Freeze fail-closed (`dir_catalog_load_failed` or version missing) — **not** silent skip |
| **DC-5** | Loader throws / returns `dir_catalog_load_failed` | Read error | Same fail-closed; no `n_a` |
| **DC-6** | Request version `"999"` not in registry | Unknown version | `dir_catalog_version_unknown`; no write; Freeze fail-closed |
| **DC-7** | Write under snapshot `"1"`; Freeze forced to incompatible version (harness pin or dual-version stub) | Version incompatible | Freeze fail-closed / evidence not Gate-effective; **no** false `n_a` |
| **DC-8** | `freezeDraftForDelivery(..., { authority: { dirCatalog: forgedAllow } })` while SSOT denies | Authority forge | Production compose **ignores** forge; stays non-`n_a` (or FreezeError if policy requires load-only). Must **not** PASS N/A via forge |
| **DC-9** | Caller `dir_na_conditions: [code]` but SSOT denies code | Caller forge list | Write **rejected** despite forged list |
| **DC-10** | Same active snapshot; membership(write) === membership(freeze) for sample pairs | Consistency | Assert helper / integration: identical allow/deny |
| **DC-11** | `pnpm test:intake-r6-freeze-versioning` | Regression | F1–F4 + A–E all PASS (update harness only in implement task if loader hard-bind breaks fixture injection — via test seam, not production forge) |
| **DC-12** | R6 Session event isolation (F1–F4 semantics) | Isolation non-regress | Forged confirmation/actions/topic evals still cannot authorize; Session events still can |

**Notes for implementers:**

- DC-4 vs DC-5 vs DC-6 must assert **distinct reason_codes**, not a single boolean.  
- DC-8 must exercise the **production** compose path rules (ignore authority catalog), not only a unit that still merges overrides.  
- DC-11 may require a test-only loader seam so F1–F4 can supply Phase-test DIRs without using production authority forge.

---

## 8. Interfaces and compatibility risks

| Surface | Risk | Mitigation |
|---|---|---|
| `DeclareDirNaInput.dir_na_conditions` | Callers/tests break if required field removed abruptly | Ignore first; deprecate; remove in follow-up |
| `CreateNaClassificationInput.dirNaConditions` | Still looks like injectable authority | Only pass server-derived list from loader |
| `NaValidationAuthorityOverrides.dirCatalog` | Freeze helper still spreads today | Stop spreading on production Freeze builder; test seam |
| `freezeDraftForDelivery` opts.authority | External callers might rely on injecting catalog | Document breaking change; production wire never passed it |
| R6 tests using `DIR-A` + fixture catalog | Conflict with Phase 2 ids / hard loader | Test catalog snapshot or seam |
| Lifecycle/Ask without loader | DIR state may differ pre-Freeze | Accept for slice; later unify compose |
| Prose→token mapping wrong | User-facing N/A chips mismatch product | Lock token table in implement review against Phase 2 |

---

## 9. Items needing separate authorization

| ID | Change | Why not in this slice alone |
|---|---|---|
| **E-SCHEMA-1** | Persist `dir_catalog_version` on Session and/or N/A action / DC | Session/DC Schema; needed for breaking catalog edits & DC-7 in production |
| **E-C5-1** | Include catalog version in C5 business payload | Explicitly deferred by audit; changes hash surface |
| **E-COMPOSE-1** | Full `composeProductionNaValidation` for Ask/Versioning/Lifecycle | Out of vertical slice scope |
| **E-CFP / E-TOPIC** | Live CFP reader; topic rules/evals | Forbidden in this task |
| **E-UI-1** | Production UI calling `declareDirNotApplicable` | No lib caller today; product wiring |
| **E-CI-DRIFT** | Markdown ↔ TS catalog drift check | Tooling auth |
| **E-GATE** | FreezeError vs inert-evidence policy when catalog load fails mid-sufficiency | May touch Freeze error taxonomy expectations — keep Gate/Sufficiency **logic** unchanged; only catalog availability errors |

---

## 10. Implementation steps and acceptance (when authorized later)

**Reminder:** Executing these steps requires a **new** explicit implement authorization. This design commit does not authorize them.

| Step | Work | Acceptance |
|---|---|---|
| **S0** | Land `dir-na-catalog.v1.ts` + `loadDirNaCatalog` + `assertNaConditionInDirCatalog` | Unit: DC-2, DC-3, DC-6 on pure loader; no markdown IO |
| **S1** | Wire `applyDeclareDirNaToSession` to loader; ignore caller lists | DC-1 write half, DC-2, DC-3, DC-9; existing source/control checks still pass |
| **S2** | Wire `buildFreezeNaValidationFromSession` to loader overwrite; ignore `authority.dirCatalog` | DC-1 Freeze half, DC-8; R6 T0 strip unchanged |
| **S3** | Fail-closed load errors on write + Freeze | DC-4, DC-5 distinct codes |
| **S4** | Consistency + version harness | DC-7 (harness), DC-10 |
| **S5** | Regress R6 freeze-versioning + na-cas as needed via **test seam** | DC-11, DC-12; `tsc --noEmit` |
| **S6** | Stop — no Ask/CFP/Topic/Schema unless newly authorized | Diff limited to catalog module + declare + Freeze compose |

**Exit criteria for the future implement PR (not this doc):** DC-1…DC-12 designed behaviors demonstrated; production Freeze path authorizes real catalog-backed Explicit N/A; forged authority/lists cannot; R6 Session isolation intact.

---

## 11. Design-task completion statement

| Claim | Allowed? |
|---|---|
| DIR Catalog vertical slice **design delivered** | Yes (this document) |
| DIR Catalog **implemented** / N/A Authority **production-connected** | **No** |
| Stage 3.2 **complete** | **No** |
| Production / test / schema modified by this task | **No** |

**DESIGN ONLY — NO PRODUCTION IMPLEMENTATION AUTHORIZED**

Await independent design review and explicit implement authorization before any code change.
