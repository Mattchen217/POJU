# Source Review Notes (S6)

Baseline: `76fa70bd5577ae4cc5b793e205518c38c5baf2b5`

## S0 Catalog

- SSOT: `lib/poju/decision-context/catalog/dir-na-catalog.v1.ts` (`DIR_NA_CATALOG_VERSION = 1`, 20 DIRs).
- Loader: `load-dir-na-catalog.ts` — module-private `productionDirNaRegistry`; `ACTIVE_DIR_NA_CATALOG_VERSION`; fail-closed reason codes.
- Registry not exported from production barrel (dir-catalog test asserts).
- Legal pair used by S4/S5: `DIR-DEF-UNACCEPTABLE` / `explicit_no_hard_red_lines`.
- Empty-condition DIRs (e.g. `DIR-DEF-QUESTION`) remain `na_conditions: []`.
- `git log 9411c83f..76fa70bd -- catalog/` empty → Catalog untouched after S2.

## S1 Write / Revoke (post-S4 gates)

File: `lib/poju/decision-context/na-declaration.ts`

- `applyDeclareDirNaToSession`: missing DC → `NA_DECLARATION_CONTEXT_INVALID` “missing”; `status !== "draft"` → “not writable”; membership via `loadDirNaCatalog(ACTIVE)` before append.
- `input.dir_na_conditions` ignored for authorization.
- `revokeDirNaDeclaration`: checks DC present + draft **before** mutating actions/classifications/evidence (C21b fix).
- Persist via `mutatePOJUSession` / CAS.
- Evidence id convention at create: `na_ev_${declaration_action_id}`.

## S2 Freeze authority

File: `lib/poju/decision-context/freeze-to-delivery.ts`

- `assertSessionDraftBusinessSnapshotBound` — both draft; context/version/business hash match.
- `buildFreezeNaValidationFromSession` strips Session-owned + `dirCatalog`; reinjects Session events/actions/topic evals/version; `dirCatalog: loadDirNaCatalog(ACTIVE).entries`.
- `freezeDraftForDelivery` never uses `emptyNaValidation()`.
- Binding via `bindingFromDecisionContext` + `assertSnapshotMatchesBinding`.

## S3 FreezeWire

File: `lib/poju/decision-context/production-freeze-wire.ts`

- `FreezeError.code` → allowlisted `reason_code`; unknown → generic fail.
- Persist fail → `persistFailWireResult` / `dc_freeze_persist_failed`.
- No commits to this file after `0e09531c` through S5.
- Persist-fail **production-path** remains UNTESTED (harness).

## S4 validate binds

File: `lib/poju/decision-context/explicit-na-validate.ts`

- C09e: `row.expires_at !== action.expires_at` → skip match.
- C10a: after classification match, `evidence.evidence_id !== na_ev_${classification.declaration_action_id}` → `evidence_id_action_mismatch`.

## S4 C25

File: `scripts/test-intake-r6-write-freeze-consistency.ts` (unchanged since `b1a1f024`)

- Success path: concurrent real `casWritePOJUSession` then stale `casWritePOJUSession(args)`; requires `SessionCasError(SESSION_CAS_CONFLICT)` + no durable N/A.
- Early-throw hook only if production path not proven; labeled not PASS.

## S5 F1–F4

- Isolated file; ACTIVE fixtures; no shared mutable triad across cases.
- `package.json` chains freeze-versioning → authority-regression.
- Production `lib/` untouched by S5 (`git diff b1a1f024 76fa70bd -- lib/` empty).

## Protection summary

| Artifact | Last production-touching commit | Later stages |
|---|---|---|
| catalog/* | S0 (+S0 fix) | none through S5 |
| freeze-to-delivery / freeze.ts | S2 | none |
| production-freeze-wire | S3 | none |
| na-declaration + explicit-na-validate | S4-impl | S4-c25 tests only; S5 tests only |
