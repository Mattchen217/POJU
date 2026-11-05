# DC-1–DC-12 Traceability Matrix (S6)

**SSOT definition source:** `STAGE-3.2-DIR-CATALOG-VERTICAL-SLICE-DESIGN.md` Rev 1.3 §9 table.  
**Baseline HEAD:** `76fa70bd5577ae4cc5b793e205518c38c5baf2b5`  
**Regression evidence:** `test-results.txt` (S6 re-run, all listed commands exit 0)

| Control | Formal requirement (from design §9) | Implementation | Tests / cases | Evidence | Conclusion |
|---|---|---|---|---|---|
| **DC-1** | DIR+condition in ACTIVE SSOT; valid Session/DC; Declare appends; Freeze → DIR `n_a` | `loadDirNaCatalog(ACTIVE)`; `applyDeclareDirNaToSession` / `declareDirNotApplicable`; `buildFreezeNaValidationFromSession` + `freezeDraftForDelivery` | `test-intake-r6-dir-catalog.ts` DC-1 write + DC-1 Freeze; S4 C01–C04 | dir-catalog PASS; write-freeze C01–C04 PASS | **PASS** |
| **DC-2** | `dir_id` not in SSOT → write `dir_not_in_catalog`; no action | `resolveDeclareDirNaCatalogMembership` / `membershipFromCatalogLoad` | dir-catalog DC-2; S4 C08 | PASS lines in test-results | **PASS** |
| **DC-3** | DIR registered; condition not listed → `na_condition_not_in_catalog` | same membership path | dir-catalog DC-3 | PASS | **PASS** |
| **DC-4** | Registry available but ACTIVE absent → `dir_catalog_ssot_unavailable`; FreezeWire maps code | `resolveDirNaCatalog`; S3 `mapCaughtFreezeFailure` / `freezeFailWireResult` | dir-catalog ACTIVE∉registry; freeze-wire-reason Tier A/B | PASS (wire mapping unit + production apply catch) | **PASS** (mapping proven; live Registry inject into Freeze wire **not** claimed — per design) |
| **DC-4-missing** | `loadDirNaCatalog(null\|undefined)` → `dir_catalog_version_missing` (loader-only; not Freeze everyday path) | `resolveDirNaCatalog` / `loadDirNaCatalog` | dir-catalog undefined/null | PASS | **PASS** (loader-only scope) |
| **DC-5** | Unexpected throw after valid version → `dir_catalog_load_failed` | loader try/catch → `load_failed`; Wire allowlist | dir-catalog load_failed stubs; freeze-wire Tier A | PASS | **PASS** |
| **DC-6** | Non-ACTIVE absent major (e.g. 999) → `dir_catalog_version_unknown` | `resolveDirNaCatalog` | dir-catalog 999 | PASS | **PASS** (loader; Freeze uses ACTIVE only) |
| **DC-7a** | Loader rejects bad/unknown/missing numeric versions (distinct codes) | same loader | dir-catalog invalid / missing / unknown | PASS | **PASS** |
| **DC-7b** | Write pin vs Freeze pin incompatibility | Requires Schema pin (E-SCHEMA-1) | — | Design marks out of scope | **SPECIFICATION / DEFERRED** (not Stage 3.2 claim) |
| **DC-8** | Forged `authority.dirCatalog` while SSOT denies → no false `n_a` | `buildFreezeNaValidationFromSession` strips `dirCatalog`; loads ACTIVE | dir-catalog DC-8; S4 C23; S5 F1 forged dirCatalog | PASS | **PASS** |
| **DC-9** | Caller forged `dir_na_conditions` list cannot authorize | Write ignores `input.dir_na_conditions`; uses loader membership | dir-catalog DC-9a/9b; S4 C07 | PASS | **PASS** |
| **DC-10** | Same ACTIVE snapshot; write membership ≡ Freeze membership | Write + Freeze both `loadDirNaCatalog(ACTIVE)` / same ACTIVE constant | dir-catalog consistency; S4 C01–C04 / C07 | PASS under ACTIVE | **PASS** |
| **DC-11** | Full freeze-versioning suite incl. F1–F4 | A–E in `freeze-versioning.ts`; F1–F4 isolated + chained | `test:intake-r6-freeze-versioning` exit 0 | test-results combo PASS | **PASS** |
| **DC-12** | R6 Session event isolation; F1–F4 semantics preserved | Freeze strips caller Session-owned authority; F1–F4 fixtures | `test-intake-r6-freeze-authority-regression.ts` F1–F4 | PASS=4 | **PASS** |

**Notes**

- DC-7b is explicitly **not** an implement/claim item for this vertical slice.
- DC-4 production Freeze “Registry inject” is intentionally **not** a runtime test path; design requires pure resolver + wire mapper evidence instead.
