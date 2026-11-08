# Stage 3.2 — DIR Catalog Vertical Slice Design

| Field | Value |
|---|---|
| **Status** | **DESIGN ONLY — NO PRODUCTION IMPLEMENTATION AUTHORIZED** |
| **Revision** | **1.3** (static import boundary; pure resolver for DC-4; Freeze-reachable faults only) |
| **Parent design commit** | `e8c16f0cc3e9d8cc793c19c6c86046d129a835ec` |
| **Prior** | … → R1.1 `6efd0b1f…` → R1.2 `e8c16f0c…` |
| **Depends on** | N/A Authority audit + Supplement 1 (`STAGE-3.2-NA-AUTHORITY-PRODUCTION-SOURCES-AUDIT.md`); R6 freeze `5012e114…` |
| **In scope** | `DIR Catalog SSOT → declareDirNotApplicable write check → Freeze production read → N/A Validation` |
| **Out of scope** | CFP Live Reader; Topic Eval writer/recompute; Ask / Versioning / Lifecycle authority rewires; Schema / C5 / Gate changes; production or test code edits in **this design revision** |

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
| `docs/eastern-os/decision-intake-2.0/PHASE-2-DIR-CATALOG.md` | Human normative catalog; **`dir_catalog_version = 1` (integer)**; prose `na_conditions` per DIR | **Documentation only** — must **not** be runtime-parsed; runtime uses numeric SSOT (§3.2) |
| `DirNaCatalogEntry` type | Shape for NaValidation | No data |
| Test fixtures | e.g. `{ dir_id: "DIR-A", na_conditions: [NA_CODE] }` in `scripts/test-intake-r6-*.ts` | Harness only |
| Caller `dir_na_conditions` | Write input | **Not** trusted T2 (Supplement 1) |
| `opts.authority.dirCatalog` | Freeze/adapter override | Forbidden as production T2; currently still pass-through on Freeze helper |

**Gaps to close in this vertical slice (design):**

1. Code SSOT registry + **positive integer** `dir_catalog_version` (`number`).  
2. Machine-stable `na_condition_code` tokens (Phase 2 currently uses prose).  
3. Shared membership API for write + Freeze.  
4. Production Freeze compose fills `dirCatalog` from loader only.  
5. Write ignores caller condition lists.  
6. Fail-closed taxonomy for missing / load fail / unknown / invalid version (pin-incompatibility only after E-SCHEMA-1).

**Not in this slice:** Topic rules, catalogConditionEvals, CFP reader, Ask/Versioning/Lifecycle full T2 compose (may later call same loader; **must not** be rewired here).

---

## 3. Proposed SSOT and version mechanism

### 3.1 Formal definition location (unique, traceable)

| Artifact | Proposed path | Role |
|---|---|---|
| Versioned entries | `lib/poju/decision-context/catalog/dir-na-catalog.v1.ts` | **Runtime SSOT** — exported const table |
| Loader API | `lib/poju/decision-context/catalog/load-dir-na-catalog.ts` | `resolveDirNaCatalog` (pure) + `loadDirNaCatalog` (production wrapper), membership helpers |
| Shared assert | same module or `dir-na-catalog-membership.ts` | Used by write + Freeze |
| Human doc | `PHASE-2-DIR-CATALOG.md` | Spec narrative; optional future CI drift check (**separate auth**) |

**Forbidden:** `fs.readFile` / fetch / markdown parse of Phase 2 doc at runtime. **No dynamic `import()`** for DIR catalog SSOT unless separately justified and authorized — default is **static import** of the registry module.

### 3.2 Catalog version type (unified — Revision 1 / 1.1)

**Normative source (Phase 2):**  
`docs/eastern-os/decision-intake-2.0/PHASE-2-DIR-CATALOG.md` header states:

> `dir_catalog_version = 1`

That is a **positive integer** `number` value `1`. Companion DDR catalog uses a separate field `ddr_catalog_version = 1.1` (decimal) — **out of this slice**; DIR N/A loader must not conflate DDR versions with DIR catalog versions.

| Layer | Type / value | Rule |
|---|---|---|
| **Phase 2 normative** | Positive integer: `1`, then `2`, `3`, … only when a new snapshot is published under policy below | Documented as `dir_catalog_version = <positive integer>` |
| **Runtime SSOT type** | `type DirNaCatalogVersion = number` with invariant `Number.isInteger(v) && v >= 1` | Exported from loader/SSOT module — **never** `string` |
| **Runtime constant** | `export const DIR_NA_CATALOG_VERSION: DirNaCatalogVersion = 1` | Must equal Phase 2 integer for shipped snapshot `dir-na-catalog.v1.ts` |
| **Active production** | `export const ACTIVE_DIR_NA_CATALOG_VERSION: DirNaCatalogVersion = DIR_NA_CATALOG_VERSION` | Write + Freeze both call `loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)` while unpinned |
| **Registry key** | `ReadonlyMap<DirNaCatalogVersion, DirNaCatalogSnapshot>` keyed by positive integer | Snapshot `1` immutable once shipped |

**Publish policy while no Session Pin (Revision 1.1 — no conflicting “breaking publish” language):**

| Allowed now | Forbidden until E-SCHEMA-1 |
|---|---|
| **Additive-only** catalog publish: bump `ACTIVE` to next integer only if new snapshot **adds** DIRs and/or condition codes | Delete existing DIR rows or condition codes |
| Keep every previously allowed `(dir_id, condition)` membership-true | Change business semantics of an existing condition code |
| Keep historical valid declarations Freeze-authorizable under new `ACTIVE` | Ship a breaking catalog rewrite and claim pin/history safety |

Breaking catalog changes **require** separate E-SCHEMA-1 authorization and implementation. Until then, do not describe snapshot publish as “breaking/additive” interchangeably — **additive-only**.

**Loader I/O (design):**

```ts
type DirNaCatalogLoadResult =
  | {
      ok: true;
      dir_catalog_version: DirNaCatalogVersion; // number, e.g. 1
      entries: readonly DirNaCatalogEntry[];
    }
  | {
      ok: false;
      reason_code:
        | "dir_catalog_version_missing"      // request was null/undefined
        | "dir_catalog_version_invalid"      // not a positive integer
        | "dir_catalog_version_unknown"      // positive integer, not this caller's concern as "ACTIVE gap"
        | "dir_catalog_ssot_unavailable"    // Registry object available; no snapshot for ACTIVE (see §3.2.1)
        | "dir_catalog_load_failed";        // unexpected throw / corrupt materialize after version accepted
    };

/** Pure resolver — injectable registry for tests; no I/O. */
function resolveDirNaCatalog(
  requested: DirNaCatalogVersion | null | undefined,
  registry: ReadonlyMap<DirNaCatalogVersion, DirNaCatalogSnapshot>,
  activeVersion: DirNaCatalogVersion,
): DirNaCatalogLoadResult;

/** Production wrapper — static production registry + ACTIVE only. */
function loadDirNaCatalog(
  requested: DirNaCatalogVersion | null | undefined = ACTIVE_DIR_NA_CATALOG_VERSION,
): DirNaCatalogLoadResult;
// loadDirNaCatalog(requested) ≡ resolveDirNaCatalog(requested, PRODUCTION_REGISTRY, ACTIVE_DIR_NA_CATALOG_VERSION)
```

**Version comparison:** strict numeric equality (`requested === registeredKey`). No semver range. No string SoT.

#### 3.2.1 Static module loading boundary (Revision 1.3)

| Situation | Classification | Runtime FreezeError? |
|---|---|---|
| **Registry is loaded** (static import succeeded) but has **no snapshot** for `ACTIVE_DIR_NA_CATALOG_VERSION` | `dir_catalog_ssot_unavailable` | **Yes** — production Freeze maps this code |
| Statically imported SSOT / registry **module missing or unresolvable** at build/bundle time | **Build / deployment failure** | **No** — not a FreezeError; bundler/CI fails before runtime |
| Claim that `loadDirNaCatalog` can `try/catch` a failed **static** `import` of the SSOT module | **Invalid** | Static import resolution is not a catchable runtime catalog fault inside the loader |

Do **not** introduce dynamic imports for this slice unless separately justified and explicitly specified in a later authorized design.

#### 3.2.2 Fault taxonomy (preserve 1.2 splits; refine SSOT meaning)

| Fault | When | `reason_code` |
|---|---|---|
| **Request version absent** | `requested` is `null` / `undefined` | `dir_catalog_version_missing` |
| **Request version invalid** | Non-integer / `≤ 0` / `NaN` | `dir_catalog_version_invalid` |
| **Request version unknown** | Positive integer ≠ `activeVersion` and absent from `registry` (e.g. probe `999`) | `dir_catalog_version_unknown` |
| **Catalog SSOT unavailable** | `registry` **object is available**; `requested === activeVersion` (production: ACTIVE); **no snapshot** for that key | `dir_catalog_ssot_unavailable` |
| **Load failed** | Version accepted for lookup; then unexpected throw / corrupt snapshot materialization inside resolver | `dir_catalog_load_failed` |

**ACTIVE vs unknown (in `resolveDirNaCatalog`):**  
- `requested === activeVersion && !registry.has(requested)` → `dir_catalog_ssot_unavailable`  
- `requested` other positive integer absent → `dir_catalog_version_unknown`  

This keeps DC-4 distinct from DC-6.

**Compatibility with Phase 2 numeric definition:**

1. SSOT and loader APIs use **`number`** (`DirNaCatalogVersion`), matching `dir_catalog_version = 1`.  
2. Normative / runtime type is **not** string. Do not document or ship a string catalog version SoT.  
3. Optional `parseDirNaCatalogVersion(raw: unknown): DirNaCatalogVersion | null` may coerce integer-decimal text for **tests/ingress only** (e.g. text `"1"` → `1` via `/^[1-9][0-9]*$/`); it is **not** a second SoT and must not redefine production types as string.  
4. Topic `topic_catalog_version` (Session string) and DDR `1.1` remain **different namespaces** — never pass them into `loadDirNaCatalog`.

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

| Case | `loadDirNaCatalog` / membership | Write | Production Freeze (`loadDirNaCatalog(ACTIVE)`) |
|---|---|---|---|
| Request `null`/`undefined` | `dir_catalog_version_missing` | Reject if write called loader that way | **Not reachable** — Freeze always passes `ACTIVE` number (§5.2 / §7 DC-4) |
| Invalid version value | `dir_catalog_version_invalid` | Reject | **Not reachable** if `ACTIVE` constant is well-typed positive integer |
| ACTIVE not in registry (SSOT gap) | `dir_catalog_ssot_unavailable` | Reject | **Freeze fails** with that `code` — **reachable** under mis-ship |
| Other integer not in registry | `dir_catalog_version_unknown` | Reject | **Not** Freeze’s ACTIVE path (DC-6 probes loader / non-ACTIVE) |
| Unexpected throw after version OK | `dir_catalog_load_failed` | Reject | **Freeze fails** (DC-5) |
| DIR not in snapshot | `dir_not_in_catalog` | Reject | Membership deny; Freeze may complete if catalog **loaded** |
| Condition not on DIR | `na_condition_not_in_catalog` | Reject | Same |

### 3.5 No Session pin — additive-only compatibility (Revision 1.1)

**Hard facts:**

- This slice **does not** modify Session / DC Schema or C5.  
- There is **no** persisted Session/DC `dir_catalog_version` pin today.  
- Therefore this design **must not claim** true historical version pin / per-declaration snapshot binding.

**Binding rule while unpinned:** Write and Freeze both resolve version solely as `ACTIVE_DIR_NA_CATALOG_VERSION` (positive integer `number`, initially `1`).

**Additive-only Catalog evolution (mandatory until E-SCHEMA-1):**

| Rule | Requirement |
|---|---|
| Add only | New major snapshot `N+1` may **add** `dir_id` rows and/or **add** condition codes to existing rows |
| No delete | Must not delete previously shipped DIRs or remove a condition code once allowed for a `dir_id` |
| No semantic change | Must not change the business meaning of an existing condition code |
| No reinterpretation of history | Persisted evidence/classification keep `dir_id` + `na_condition_code`; validators re-check membership under **current active** snapshot — additive-only keeps prior valid pairs membership-true |
| Deploy compatibility | Old Session with prior valid N/A declarations must still Freeze-authorize those pairs after an additive `ACTIVE` bump |
| Breaking changes | **Forbidden** until E-SCHEMA-1 is separately authorized and implemented |

**What we do *not* have without pin:** Freeze against a historical catalog major after a breaking edit. Additive-only is the **only** compatibility mechanism in this slice.

### 3.6 Write ↔ Freeze compatible version (unpinned)

| Mode | Resolution |
|---|---|
| **This slice (no pin)** | Both ends: `loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)` + additive-only SSOT policy |
| **Future (E-SCHEMA-1)** | Write persists pin; Freeze loads pinned major; unknown/incompatible pin → Freeze fails |

Shared helper:

```ts
assertNaConditionInDirCatalog(load, dirId, code):
  { ok: true } | { ok: false; reason_code: ... }
```

Write and Freeze **must** use the same loader snapshot (Freeze sets `dirCatalog` from `load.entries`, then existing `conditionInDirCatalog`).

---

## 4. Write-side validation design

### 4.1 Target flow

```
declareDirNotApplicable
  → applyDeclareDirNaToSession
    → load = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)  // number 1 while unpinned
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
  → freezeDraftForDelivery({ session, now })  // no client authority
    → buildFreezeNaValidationFromSession
         1. Strip T0 overrides (R6 — keep exactly)
         2. load = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)
         3. if !load.ok → throw FreezeError(<distinct reason_code>)  // LOCKED — see §5.2
         4. Set dirCatalog = load.entries  // OVERWRITE
         5. Ignore opts.authority.dirCatalog (never merge)
```

**Hardening:** Production `buildFreezeNaValidationFromSession` ignores `dirCatalog` on `opts.authority`. Structural test isolation (§10.2) — production Freeze wire never imports test fixtures or test-only helpers.

`applySufficiencyFreezeToSession` continues to omit `authority` (~L145–148).

### 5.2 Locked Freeze failure semantics (Revision 1.3 — reachability corrected)

**Single production rule — no competing “inert evidence and continue Freeze” path for catalog availability failures.**

Production Freeze always uses the positive-integer `ACTIVE_DIR_NA_CATALOG_VERSION` via `loadDirNaCatalog(ACTIVE)` → `resolveDirNaCatalog(ACTIVE, PRODUCTION_REGISTRY, ACTIVE)`.

| Outcome | Layer | Production Freeze wire? |
|---|---|---|
| `dir_catalog_ssot_unavailable` (Registry loaded; ACTIVE key absent) | Resolver → FreezeError | **Yes — must fail** with structured `code` |
| `dir_catalog_load_failed` (unexpected throw / corrupt materialize after valid ACTIVE lookup path) | Resolver → FreezeError | **Yes — must fail** with structured `code` |
| `dir_catalog_version_missing` / `_invalid` / `_unknown` | **Loader-level** validation (`resolveDirNaCatalog` with bad/non-ACTIVE request) | **Not** normal production Freeze scenarios (Freeze does not pass null/invalid/999) |
| Static SSOT module unresolvable at build | Build/deploy | **Not** FreezeError (§3.2.1) |
| Future pin incompatible (E-SCHEMA-1) | Future | Freeze fails when authorized |

**Required properties (locked — not optional):**

1. On production Freeze-reachable catalog faults, throw `FreezeError` with structured `code`:  
   **`dir_catalog_ssot_unavailable` | `dir_catalog_load_failed`** (and future pin codes when authorized).  
   Loader-level codes (`_missing` / `_invalid` / `_unknown`) remain valid on `resolveDirNaCatalog` / write paths and DC-4-missing / DC-6 / DC-7a — they are simply **not** claimed as everyday Freeze-wire inputs.  
2. `FreezeWireResult` when `ok: false` **must** expose structured `reason_code` (or equivalent) from `FreezeError.code`. **No** message parsing.  
3. Production Freeze **always** calls `loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)`.  
4. **Do not** silently continue Freeze when ACTIVE catalog load fails.  
5. **Do not** set `dirCatalog: []` / defaults to paper over missing T2.  
6. **Do not** change Sufficiency Gate business rules.

**Propagation:** Map `FreezeError.code` → `FreezeWireResult.reason_code` in `production-freeze-wire.ts` (today only maps `message` — implement allowlist §10.1).

**DC-4 / DC-5 / DC-6** remain independent structured codes (`ssot_unavailable` vs `load_failed` vs `version_unknown`).

**Separate case (not a catalog-availability failure):**  
Loader succeeds, but a particular Explicit N/A Evidence’s condition is not registered → existing validate fail (`na_condition_not_in_catalog`); DIR not `n_a`; Freeze may still succeed if sufficiency and other gates pass. That is membership deny, not missing catalog.

**Interface impact (design only this revision — code later under §10 allowlist):**

| Change | Files |
|---|---|
| Add `FreezeError.code: string` (required on throw paths for catalog failures) | `lib/poju/decision-context/freeze.ts` |
| Add `reason_code?: string` (or equivalent) on `FreezeWireResult` `ok: false` branch; set from `FreezeError.code` | `lib/poju/decision-context/production-freeze-wire.ts` |
| Throw catalog failures with `code` set | `lib/poju/decision-context/freeze-to-delivery.ts` |

**Forbidden:** empty allow-all catalog; default PASS; continuing Freeze without `load.ok === true`; message-only failure classification.

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

Distinguish **rejection classes**. Implementation under later authorization; R6 suite must remain green with **unchanged F1–F4 semantics/assertions**.

| ID | Scenario | Class | Expected | Owning test file (implement phase) |
|---|---|---|---|---|
| **DC-1** | DIR+condition in active SSOT; valid Session/DC/E1/action | Normal allow | Declare appends; production Freeze path → DIR `n_a` | `scripts/test-intake-r6-dir-catalog.ts` (**new**) |
| **DC-2** | `dir_id` not in SSOT | Normal reject | Write `dir_not_in_catalog`; no action | same **new** |
| **DC-3** | DIR registered; condition not listed | Normal reject | Write `na_condition_not_in_catalog` | same **new** |
| **DC-4** | Registry **available** but **no snapshot for ACTIVE** → `dir_catalog_ssot_unavailable` | SSOT unavailable | **Two required checks (no production Registry injection):** (1) `resolveDirNaCatalog(ACTIVE, testLocalRegistryWithoutActive, ACTIVE)` → `dir_catalog_ssot_unavailable`; (2) FreezeError/`FreezeWireResult.reason_code` propagation for that code (compose/wire unit with the load-result→error mapper — **not** by injecting a test Registry into production Freeze wire). Fixtures under `scripts/**`. Do **not** use `_missing` here; do **not** claim catch of static import failure | same **new** |
| **DC-4-missing** | `loadDirNaCatalog(null\|undefined)` → `dir_catalog_version_missing` | Request version absent | **Loader/unit only** — **not** claimed as `applySufficiencyFreezeToSession` path (Freeze never passes null). May share file with DC-7a | same **new** |
| **DC-5** | After a **valid positive-integer** request that is present or being materialized, loader hits unexpected throw / corrupt materialization → `dir_catalog_load_failed` | Read error | Structured `reason_code === "dir_catalog_load_failed"` — **≠** DC-4 / DC-6. Verify with loader unit stubbing internal materialize throw; wire mapping same as other codes. Keep independent from SSOT-unavailable | same **new** |
| **DC-6** | `loadDirNaCatalog(999)` (integer ≠ ACTIVE or any non-ACTIVE absent major) → `dir_catalog_version_unknown` | Unknown version | Structured `reason_code === "dir_catalog_version_unknown"` — **≠** DC-4. Write reject if write used that version; Freeze production path uses ACTIVE only — DC-6 is **loader (+ optional write)**, not “ACTIVE missing” | same **new** |
| **DC-7a** | `loadDirNaCatalog(999)` / invalid `1.1` / `null` | Loader version rejection (**in-scope**) | Distinct codes: `_unknown` / `_invalid` / `_missing` — overlaps DC-4-missing & DC-6 at loader layer; keep assertions distinct | same **new** |
| **DC-7b** | Write pin `1` vs Freeze pin `2` incompatible | Production pin incompatibility | **Out of scope** until E-SCHEMA-1; document as future test; **do not** claim covered by this slice | (deferred — not in implement Diff) |
| **DC-8** | `authority.dirCatalog` forged allow while SSOT denies | Authority forge | Production compose ignores forge; **no** false `n_a`; if load fails → Freeze fails per §5.2 | same **new** (+ may call `freezeDraftForDelivery` / `applySufficiencyFreezeToSession`) |
| **DC-9** | Caller forged `dir_na_conditions` allowlist | Caller forge list | Write rejected | same **new** and/or extend `scripts/test-intake-r6-na-cas.ts` |
| **DC-10** | Same ACTIVE snapshot; write membership ≡ Freeze membership | Consistency | Identical allow/deny for sample pairs | same **new** |
| **DC-11** | Full `pnpm test:intake-r6-freeze-versioning` | Regression | All existing cases PASS including F1–F4 | `scripts/test-intake-r6-freeze-versioning.ts` (**modify only via test seam if needed**) |
| **DC-12** | R6 Session event isolation | Isolation non-regress | F1–F4 assertions unchanged in meaning | same freeze-versioning file |

**DC-7 redefinition (Revision 1):**

- **DC-7a** = what this slice can and must verify: loader rejects bad/unknown/missing **numeric** versions.  
- **DC-7b** = true write/Freeze **pinned-version incompatibility** — requires Schema pin; **not** implementable/claimable in this vertical slice.

**Notes:**

- DC-4 (`dir_catalog_ssot_unavailable`) / DC-5 (`dir_catalog_load_failed`) / DC-6 (`dir_catalog_version_unknown`) / DC-4-missing (`dir_catalog_version_missing`) must stay **distinct** — **not** `message` parsing.  
- DC-4 uses **test-local Registry** via `resolveDirNaCatalog` only; production Freeze wire never accepts external Registry.  
- Do **not** keep a DC-4 scenario that requires production Freeze to pass `null`, or that claims catching static import failures.  
- DC-8 must hit production ignore rules, not a helper that still merges `authority.dirCatalog`.  
- R6 F1–F4: keep original semantics and assertions; structural isolation (§10.2).

---

## 8. Interfaces and compatibility risks

| Surface | Risk | Mitigation |
|---|---|---|
| `DeclareDirNaInput.dir_na_conditions` | Callers/tests break if required field removed abruptly | Ignore first; deprecate; remove in follow-up |
| `CreateNaClassificationInput.dirNaConditions` | Still looks like injectable authority | Only pass server-derived list from loader |
| `NaValidationAuthorityOverrides.dirCatalog` | Freeze helper still spreads today | Production Freeze ignores; structural test fixtures separate (§10.2) |
| `freezeDraftForDelivery` opts.authority | External callers might rely on injecting catalog | Production path never treats caller catalog as T2; wire omits authority |
| R6 tests using `DIR-A` + fixture catalog | Conflict with Phase 2 ids / hard loader | Separate test SSOT/fixture module under `scripts/` — not imported by production Freeze wire |
| Lifecycle/Ask without loader | DIR state may differ pre-Freeze | Accept for slice; later unify compose |
| Prose→token mapping wrong | User-facing N/A chips mismatch product | Lock token table in implement review against Phase 2 |

---

## 9. Items needing separate authorization

| ID | Change | Why not in this slice alone |
|---|---|---|
| **E-SCHEMA-1** | Persist `dir_catalog_version` (number) on Session and/or N/A action / DC | Required for **DC-7b** and breaking catalog edits; not claimed without pin |
| **E-C5-1** | Include catalog version in C5 business payload | Deferred; hash surface |
| **E-COMPOSE-1** | Full `composeProductionNaValidation` for Ask/Versioning/Lifecycle | Out of vertical slice |
| **E-CFP / E-TOPIC** | Live CFP reader; topic rules/evals | Forbidden |
| **E-UI-1** | Production UI → `declareDirNotApplicable` | No lib caller today |
| **E-CI-DRIFT** | Markdown ↔ TS catalog drift check | Tooling |
| **E-FREEZE-CODE** | ~~Optional~~ **Required for this slice implement:** `FreezeError.code` + `FreezeWireResult.reason_code` (or equivalent) | In §10.1 allowlist; Sufficiency Gate logic unchanged (§5.2) |

---

## 10. Implementation steps, file allowlist, and acceptance (when authorized later)

**Reminder:** Executing these steps requires a **new** explicit implement authorization. This design revision does **not** authorize code changes.

### 10.1 Allowed production Diff (implement PR)

| Path | Allowed change |
|---|---|
| `lib/poju/decision-context/catalog/dir-na-catalog.v1.ts` | **New** — integer version `1` SSOT entries |
| `lib/poju/decision-context/catalog/load-dir-na-catalog.ts` | **New** — `resolveDirNaCatalog` (pure), `loadDirNaCatalog` (prod wrapper), parse helper, membership assert |
| `lib/poju/decision-context/catalog/**` (barrel if needed) | **New** only |
| `lib/poju/decision-context/na-declaration.ts` | Wire loader; ignore caller `dir_na_conditions` for authority |
| `lib/poju/decision-context/freeze-to-delivery.ts` | Load production SSOT via `loadDirNaCatalog`; ignore `authority.dirCatalog`; throw `FreezeError` with **`code`** on catalog availability failure (§5.2) |
| `lib/poju/decision-context/freeze.ts` | **Required:** add `FreezeError.code`; no Sufficiency Gate rule changes |
| `lib/poju/decision-context/production-freeze-wire.ts` | **Required:** map `FreezeError.code` → structured `reason_code` (or equivalent) on `ok: false`; keep catch→`ok: false`; no sufficiency changes |
| `lib/poju/decision-context/index.ts` (or package exports) | Re-export **production** loader symbols only — **must not** export test fixtures / test-only helpers |

**Forbidden in implement Diff (unless new auth):** Ask / Versioning / Lifecycle / CFP / Topic modules; DB/Session/DC Schema; C5 hash; R6 event SoT strip logic changes; markdown-as-runtime catalog; env-flag catalog injection.

### 10.2 Allowed test Diff + structural isolation (Revision 1.1)

| Path | Role |
|---|---|
| `scripts/test-intake-r6-dir-catalog.ts` | **New** — owns DC-1…DC-6, DC-7a, DC-8…DC-10 |
| `scripts/test-intake-r6-freeze-versioning.ts` | **Modify only as needed** so F1–F4 keep **same assertions/semantics** (DC-11, DC-12), using structural fixtures below |
| `scripts/test-intake-r6-na-cas.ts` | **Optional modify** for DC-9 against production loader |
| `package.json` | **Optional** add `test:intake-r6-dir-catalog` script |
| `scripts/fixtures/**` or `scripts/test-intake-r6-dir-catalog-*.ts` helpers | **Test-only** catalog fixtures / helpers |

**Structural isolation (required — no `NODE_ENV` / `import.meta` injection gates):**

1. **Production loader** (`load-dir-na-catalog.ts` + `dir-na-catalog.v1.ts`) is the **only** production Catalog authority entry.  
2. **Production Freeze wire** (`applySufficiencyFreezeToSession` / `ensureSessionFrozenForDelivery` / production `buildFreezeNaValidationFromSession`) does **not** accept external Catalog injection via `opts.authority`, public API knobs, env vars, or caller-supplied provenance.  
3. **Test fixtures** live under `scripts/**` (or other non-production trees) and are **separate** from production SSOT modules.  
4. **Test-only helpers** must **not** be imported or re-exported by production Freeze wire, `index.ts` production barrel used by Freeze, or `loadDirNaCatalog` production path.  
5. Ordinary `opts` / public APIs / env / caller authority **cannot** enter the production Catalog path.  
6. **R6 F1–F4** original semantics and assertions **must** be preserved.

**R6 catalog data needs:** Prefer extending production SSOT with real Phase-2-aligned rows when product-correct; if harness DIRs (e.g. `DIR-A`) remain, tests may call pure membership helpers / declare+Freeze **test scripts** that construct NaValidation only inside `scripts/**` without teaching production wire to load those fixtures.

### 10.3 Steps S0–S6

| Step | Work | Files | Acceptance |
|---|---|---|---|
| **S0** | Land positive-integer SSOT `1` + `resolveDirNaCatalog` + `loadDirNaCatalog` + membership assert | catalog/** new | DC-2/3/6/7a + DC-4(1) via pure resolver + test-local registry; static import only; version type `number` |
| **S1** | Wire declare write to loader; ignore caller lists | `na-declaration.ts` | DC-1 write, DC-2, DC-3, DC-9 |
| **S2** | Freeze compose loads production SSOT; ignore `authority.dirCatalog`; load fail → `FreezeError` **with `code`** | `freeze-to-delivery.ts` + `freeze.ts` | DC-1 Freeze, DC-8; R6 T0 strip unchanged |
| **S3** | Wire maps `code` → structured `reason_code`; Freeze `ok: false` | `production-freeze-wire.ts` | DC-4 (`ssot_unavailable` mapping), DC-5, DC-6 codes distinct; DC-4-missing loader-only |
| **S4** | Consistency under ACTIVE | new test file | DC-10; **DC-7a only** (not DC-7b) |
| **S5** | R6 regress; structural fixtures only | freeze-versioning (± na-cas) | DC-11, DC-12; F1–F4 unchanged; `tsc --noEmit` |
| **S6** | Stop | — | Diff ⊆ §10.1–10.2; no Ask/CFP/Topic/Schema/C5; no env-flag seams |

**Exit criteria for a future implement PR (not this doc):** DC-1…DC-6, DC-7a, DC-8…DC-12 demonstrated; DC-7b deferred; structured Freeze failure codes; forged authority/lists cannot authorize; additive-only + positive-integer version policy; structural test isolation.

### 10.4 Final Diff scope summary

| Bucket | Allow |
|---|---|
| Production | New `catalog/**` + `na-declaration.ts` + `freeze-to-delivery.ts` + **`freeze.ts`** + **`production-freeze-wire.ts`** (+ exports of production loader only) |
| Tests | New `test-intake-r6-dir-catalog.ts` + `scripts/fixtures/**` as needed + minimal R6/na-cas/package.json |
| Everything else | **No** |

---

## 11. Design-task completion statement

| Claim | Allowed? |
|---|---|
| DIR Catalog vertical slice **design delivered** (incl. Revision 1.3) | Yes (this document) |
| DIR Catalog **implemented** / N/A Authority **production-connected** | **No** |
| Stage 3.2 **complete** | **No** |
| Production / test / schema modified by this revision | **No** |

**DESIGN ONLY — NO PRODUCTION IMPLEMENTATION AUTHORIZED**

Revision 1.3 (minimal): `dir_catalog_ssot_unavailable` = Registry present, ACTIVE key absent; static import failure = build/deploy only; pure `resolveDirNaCatalog` for DC-4 testability; production Freeze-reachable codes = `ssot_unavailable` + `load_failed` only (missing/invalid/unknown stay loader-level). Preserves R1.1–1.2 decisions.

Await independent design review and explicit implement authorization before any code change.
