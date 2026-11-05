# Stage 3.2 — DIR Catalog Vertical Slice Design

| Field | Value |
|---|---|
| **Status** | **DESIGN ONLY — NO PRODUCTION IMPLEMENTATION AUTHORIZED** |
| **Revision** | **1** (CONDITIONAL PASS follow-ups: version type, Freeze fail semantics, additive-only / DC-7, S0–S6 + test ownership) |
| **Baseline design commit** | `ce914225af5311866f0b3426eeada94aefdb0e5b` |
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

### 3.2 Catalog version type (unified — Revision 1)

**Normative source (Phase 2):**  
`docs/eastern-os/decision-intake-2.0/PHASE-2-DIR-CATALOG.md` header states:

> `dir_catalog_version = 1`

That is a **numeric integer** `1`, not the string `"1"`. Companion DDR catalog uses a separate field `ddr_catalog_version = 1.1` (decimal) — **out of this slice**; DIR N/A loader must not conflate DDR versions with DIR catalog versions.

| Layer | Type / value | Rule |
|---|---|---|
| **Phase 2 normative** | Integer major: `1` (then `2`, `3`, … on breaking/additive snapshot publish) | Documented as `dir_catalog_version = <integer>` |
| **Runtime SSOT type** | `type DirNaCatalogVersion = number` with invariant `Number.isInteger(v) && v >= 1` | Exported from loader/SSOT module |
| **Runtime constant** | `export const DIR_NA_CATALOG_VERSION: DirNaCatalogVersion = 1` | Must equal Phase 2 integer for the shipped snapshot file `dir-na-catalog.v1.ts` |
| **Active production** | `export const ACTIVE_DIR_NA_CATALOG_VERSION: DirNaCatalogVersion = DIR_NA_CATALOG_VERSION` | Write + Freeze both call `loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)` while unpinned |
| **Registry key** | `ReadonlyMap<DirNaCatalogVersion, DirNaCatalogSnapshot>` or `Record` keyed by integer | Snapshot `1` immutable once shipped |

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
        | "dir_catalog_version_missing"
        | "dir_catalog_version_unknown"
        | "dir_catalog_version_invalid"
        | "dir_catalog_load_failed";
    };

function loadDirNaCatalog(
  requested: DirNaCatalogVersion | null | undefined,
): DirNaCatalogLoadResult;
```

**Version comparison:** strict numeric equality (`requested === registeredKey`). No semver range, no string prefix match.

**Unknown / invalid handling:**

| Input | `reason_code` |
|---|---|
| `null` / `undefined` | `dir_catalog_version_missing` |
| Non-integer number (e.g. `1.1`), `NaN`, `≤ 0` | `dir_catalog_version_invalid` |
| Integer not in registry (e.g. `999`) | `dir_catalog_version_unknown` |
| Registry/IO failure | `dir_catalog_load_failed` |

**Compatibility with the Phase 2 numeric definition (required — do not “only use string `"1"`”):**

1. SSOT and loader APIs use **`number`**, matching `dir_catalog_version = 1`.  
2. Do **not** redefine the normative type as string.  
3. If a test or future API receives a string (e.g. `"1"`), it may only enter the loader via an **explicit** narrow helper such as `parseDirNaCatalogVersion(raw: unknown): DirNaCatalogVersion | null` that accepts integer decimals (`"1"` → `1`) and rejects `"1.0"` ambiguity policy (recommend: accept only `/^[1-9][0-9]*$/` → `Number`). That helper is not a second SoT.  
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

| Case | `loadDirNaCatalog` / membership | Write | Freeze (§5 — locked) |
|---|---|---|---|
| Unknown version | `dir_catalog_version_unknown` | Reject declare | **Freeze fails** (FreezeError); do not continue |
| Invalid version value | `dir_catalog_version_invalid` | Reject | **Freeze fails** |
| Loader throw / unavailable | `dir_catalog_load_failed` | Reject | **Freeze fails** — **no** `dirCatalog: []` PASS |
| Version missing (null/undefined) | `dir_catalog_version_missing` | Reject | **Freeze fails** |
| DIR not in snapshot | `dir_not_in_catalog` | Reject | Evidence not Gate-effective (`na_condition_not_in_catalog`); Freeze may complete if catalog **loaded** |
| Condition not on DIR | `na_condition_not_in_catalog` | Reject | Same — membership deny, not catalog-availability failure |

### 3.5 No Session pin — additive-only compatibility (Revision 1)

**Hard facts:**

- This slice **does not** modify Session / DC Schema or C5.  
- There is **no** persisted Session/DC `dir_catalog_version` pin today.  
- Therefore this design **must not claim** true historical version pin / per-declaration snapshot binding.

**Binding rule while unpinned:** Write and Freeze both resolve version solely as `ACTIVE_DIR_NA_CATALOG_VERSION` (integer, initially `1`).

**Additive-only Catalog evolution (mandatory until E-SCHEMA-1):**

| Rule | Requirement |
|---|---|
| Add only | New major snapshot `N+1` may **add** `dir_id` rows and/or **add** condition codes to existing rows |
| No delete | A condition code once allowed for a `dir_id` in shipped snapshot `K` **must remain** in every later active snapshot’s allowlist for that `dir_id` |
| No semantic change | An existing condition code’s product meaning must not be redefined (no “same code, new meaning”) |
| No reinterpretation of history | Persisted evidence/classification keep `dir_id` + `na_condition_code`; validators re-check membership under **current active** snapshot only — additive-only guarantees prior valid pairs still membership-true |
| Deploy compatibility | Old Session with prior valid N/A declarations must still Freeze-authorize those pairs after shipping additive `ACTIVE` bump |
| Breaking change ban | Remove/rename/shrink allowlist **forbidden** until Session/DC pin exists (**§9 E-SCHEMA-1**) |

**What we do *not* have without pin:** ability to Freeze a declaration against the exact catalog major that existed at write time if a breaking edit were shipped. Additive-only is the **only** compatibility mechanism in this slice.

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

**Hardening:** Production `buildFreezeNaValidationFromSession` ignores `dirCatalog` on `opts.authority`. Test-only seam (§10) must not be reachable from `applySufficiencyFreezeToSession` / `ensureSessionFrozenForDelivery`.

`applySufficiencyFreezeToSession` continues to omit `authority` (~L145–148).

### 5.2 Locked Freeze failure semantics (Revision 1)

**Single production rule — no competing “inert evidence and continue Freeze” path for catalog availability failures.**

| Catalog availability outcome | Production behavior |
|---|---|
| Catalog missing / SSOT unloadable | **This Freeze attempt fails** |
| Loader read failure / throw | **This Freeze attempt fails** |
| Version missing / invalid / unknown | **This Freeze attempt fails** |
| Future pin incompatible (E-SCHEMA-1 only) | **This Freeze attempt fails** |

**Required properties:**

1. Throw `FreezeError` whose message (and preferably a structured `code` field — see interface impact) carries a **distinguishable** reason:  
   `dir_catalog_load_failed` | `dir_catalog_version_missing` | `dir_catalog_version_invalid` | `dir_catalog_version_unknown` | (future) `dir_catalog_version_incompatible`.  
2. **Do not** silently continue Freeze when catalog cannot be loaded.  
3. **Do not** set `dirCatalog: []` / defaults to make N/A validation “pass” or to paper over missing T2.  
4. **Do not** change Sufficiency Gate business rules (`evaluateDecisionSufficiency` / `canFreezeSessionOnSufficiency`) — catalog failure is a **post-eligibility** Freeze compose failure, not a sufficiency verdict change.

**Propagation through `applySufficiencyFreezeToSession` (existing evidence):**  
`production-freeze-wire.ts` ~L145–172 already wraps `freezeDraftForDelivery` in `try/catch` and maps errors to:

```ts
{ ok: false, reason: e instanceof Error ? e.message : String(e), session }
```

Design: catalog `FreezeError` propagates unchanged into `FreezeWireResult.ok === false` with `reason` containing the reason_code (or `FreezeError.code` if added). Callers (`ensureSessionFrozenForDelivery`, `final-delivery.ts`, `segment2/control.ts`) already observe `ok: false` — **no Sufficiency Gate change**.

**Separate case (not a catalog-availability failure):**  
Loader succeeds, but a particular Explicit N/A Evidence’s condition is not registered → existing validate fail (`na_condition_not_in_catalog`); DIR not `n_a`; Freeze may still succeed if sufficiency and other gates pass. That is membership deny, not missing catalog.

**Interface impact if adding structured codes (design only — no code this revision):**

| Option | Impact |
|---|---|
| A. Encode reason_code in `FreezeError.message` only | No type change; `FreezeWireResult.reason` string carries code; callers parse or substring-match in tests |
| B. Add `FreezeError.code: string` (+ optional `FreezeWireResult.reason_code`) | Small public type widen in `freeze.ts` / `production-freeze-wire.ts`; prefer B at implement time for DC-4/5/6 assertions |

Either is acceptable; **B preferred**. Implement authorization required before editing those files.

**Forbidden:** empty allow-all catalog; default PASS; continuing Freeze without a successful `load.ok === true`.

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
| **DC-4** | Catalog unavailable / misconfig (missing source) | Missing source | Write reject + Freeze **`ok: false`** with `dir_catalog_load_failed` or `_missing` — **no silent Freeze success** | same **new** |
| **DC-5** | Loader returns/throws `dir_catalog_load_failed` | Read error | Distinct from DC-4/DC-6; Freeze `ok: false`; no `n_a` | same **new** |
| **DC-6** | Request version `999` (integer) not in registry | Unknown version | `dir_catalog_version_unknown`; write reject; Freeze `ok: false` | same **new** (also loader unit) |
| **DC-7a** | `loadDirNaCatalog(999)` / invalid `1.1` / `null` | Loader version rejection (**in-scope now**) | Distinct codes: `_unknown` / `_invalid` / `_missing` — **verifiable without Schema pin** | same **new** |
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

- DC-4 / DC-5 / DC-6 / DC-7a must assert **distinct reason_codes**.  
- DC-8 must hit production ignore rules, not a helper that still merges `authority.dirCatalog`.  
- R6 F1–F4: keep assertions; if fixtures need catalog data, use **test-only** seam/fixture module that production Freeze wire cannot import as an injection API.

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
| **E-SCHEMA-1** | Persist `dir_catalog_version` (number) on Session and/or N/A action / DC | Required for **DC-7b** and breaking catalog edits; not claimed without pin |
| **E-C5-1** | Include catalog version in C5 business payload | Deferred; hash surface |
| **E-COMPOSE-1** | Full `composeProductionNaValidation` for Ask/Versioning/Lifecycle | Out of vertical slice |
| **E-CFP / E-TOPIC** | Live CFP reader; topic rules/evals | Forbidden |
| **E-UI-1** | Production UI → `declareDirNotApplicable` | No lib caller today |
| **E-CI-DRIFT** | Markdown ↔ TS catalog drift check | Tooling |
| **E-FREEZE-CODE** | Optional `FreezeError.code` / `FreezeWireResult.reason_code` | Type widen only; Sufficiency Gate logic unchanged (§5.2 option B) |

---

## 10. Implementation steps, file allowlist, and acceptance (when authorized later)

**Reminder:** Executing these steps requires a **new** explicit implement authorization. This design revision does **not** authorize code changes.

### 10.1 Allowed production Diff (implement PR)

| Path | Allowed change |
|---|---|
| `lib/poju/decision-context/catalog/dir-na-catalog.v1.ts` | **New** — integer version `1` SSOT entries |
| `lib/poju/decision-context/catalog/load-dir-na-catalog.ts` | **New** — `loadDirNaCatalog`, parse helper, membership assert |
| `lib/poju/decision-context/catalog/**` (barrel if needed) | **New** only |
| `lib/poju/decision-context/na-declaration.ts` | Wire loader; ignore caller `dir_na_conditions` for authority |
| `lib/poju/decision-context/freeze-to-delivery.ts` | Load catalog into Freeze NaValidation; ignore `authority.dirCatalog`; throw FreezeError on load fail (§5.2) |
| `lib/poju/decision-context/freeze.ts` | **Only if** adding `FreezeError.code` (E-FREEZE-CODE); no Sufficiency Gate rule changes |
| `lib/poju/decision-context/production-freeze-wire.ts` | **Only if** mapping `reason_code` on `ok: false`; must keep catch→`ok: false` behavior; no sufficiency changes |
| `lib/poju/decision-context/index.ts` (or package exports) | Re-export loader symbols if required |

**Forbidden in implement Diff (unless new auth):** Ask / Versioning / Lifecycle / CFP / Topic modules; DB/Session/DC Schema; C5 hash; R6 event SoT strip logic changes; markdown-as-runtime catalog.

### 10.2 Allowed test Diff (implement PR)

| Path | Role |
|---|---|
| `scripts/test-intake-r6-dir-catalog.ts` | **New** — owns DC-1…DC-6, DC-7a, DC-8…DC-10 |
| `scripts/test-intake-r6-freeze-versioning.ts` | **Modify only as needed** for test seam / fixture catalog so F1–F4 keep **same assertions/semantics** (DC-11, DC-12) |
| `scripts/test-intake-r6-na-cas.ts` | **Optional modify** for DC-9 declare path against real loader |
| `package.json` | **Optional** add `test:intake-r6-dir-catalog` script |
| Test-only fixture e.g. `lib/poju/decision-context/catalog/dir-na-catalog.test-fixture.ts` or `scripts/fixtures/**` | Allowed **only** if production Freeze wire / `ACTIVE` loader **cannot** be pointed at it by callers (no production import of test fixture; seam behind `NODE_ENV`/`import.meta` test flag or separate export path unused by `applySufficiencyFreezeToSession`) |

**R6 F1–F4:** Must keep original semantics and assertions. Test fixture/seam may supply DIR catalog rows needed for Explicit N/A paths; production path must still load SSOT (or fail per §5.2), not accept forged `opts.authority.dirCatalog`.

### 10.3 Steps S0–S6

| Step | Work | Files | Acceptance |
|---|---|---|---|
| **S0** | Land numeric SSOT `1` + `loadDirNaCatalog` + membership assert | catalog/** new | DC-2/3/6/7a at unit level; no markdown IO; version type is `number` |
| **S1** | Wire declare write to loader; ignore caller lists | `na-declaration.ts` | DC-1 write, DC-2, DC-3, DC-9 |
| **S2** | Freeze compose loads SSOT; ignore `authority.dirCatalog`; load fail → FreezeError | `freeze-to-delivery.ts` (+ optional freeze/wire code field) | DC-1 Freeze, DC-8; R6 T0 strip unchanged |
| **S3** | Catalog availability → Freeze `ok: false` with distinct codes | freeze + wire | DC-4, DC-5, DC-6 via `applySufficiencyFreezeToSession` |
| **S4** | Consistency under ACTIVE | new test file | DC-10; **DC-7a only** (not DC-7b) |
| **S5** | R6 regress + seam if needed | freeze-versioning (± na-cas) | DC-11, DC-12; F1–F4 semantics unchanged; `tsc --noEmit` |
| **S6** | Stop | — | Diff ⊆ §10.1–10.2; no Ask/CFP/Topic/Schema/C5 |

**Exit criteria for a future implement PR (not this doc):** DC-1…DC-6, DC-7a, DC-8…DC-12 demonstrated; DC-7b explicitly deferred; production Freeze fails closed on catalog availability errors; forged authority/lists cannot authorize; additive-only + numeric version policy documented in code comments matching this revision.

### 10.4 Final Diff scope summary

| Bucket | Allow |
|---|---|
| Production | New `catalog/**` + edits to `na-declaration.ts` + `freeze-to-delivery.ts` (+ optional `freeze.ts` / `production-freeze-wire.ts` for reason_code + exports) |
| Tests | New `test-intake-r6-dir-catalog.ts` + minimal R6/na-cas/package.json adjustments for seam & scripts |
| Everything else | **No** |

---

## 11. Design-task completion statement

| Claim | Allowed? |
|---|---|
| DIR Catalog vertical slice **design delivered** (incl. Revision 1) | Yes (this document) |
| DIR Catalog **implemented** / N/A Authority **production-connected** | **No** |
| Stage 3.2 **complete** | **No** |
| Production / test / schema modified by this revision | **No** |

**DESIGN ONLY — NO PRODUCTION IMPLEMENTATION AUTHORIZED**

Revision 1 locks: numeric `dir_catalog_version`, Freeze fail-closed on catalog availability, additive-only without pin (no false pin claims), DC-7a vs DC-7b, S0–S6 file/test ownership.

Await independent design review and explicit implement authorization before any code change.
