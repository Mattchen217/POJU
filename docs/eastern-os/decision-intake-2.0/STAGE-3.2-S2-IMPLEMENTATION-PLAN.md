# STAGE-3.2 S2 Implementation Plan

**S2 Implementation Plan — Plan Only — Not Authorized for Implementation**

| Field | Value |
|---|---|
| **Document status** | PLAN ONLY — no production/test implementation authorized by this document |
| **Plan revision** | **1.2** (mapping coverage clarification — production fail-closed is code-reviewed, not runtime-tested via scripts twin; DC-1/DC-8 remain compose integration) |
| **Prior plan commits** | Rev 1.0 `dc76468c…` → Rev 1.1 `ed8caa24…` |
| **Authoritative design** | [`STAGE-3.2-DIR-CATALOG-VERTICAL-SLICE-DESIGN.md`](./STAGE-3.2-DIR-CATALOG-VERTICAL-SLICE-DESIGN.md) **Revision 1.3** |
| **Design sections used** | §1.2 (Freeze gap), §3.2.2 / §3.4 (taxonomy), §3.2–3.6 (loader / ACTIVE / membership), §5 (Freeze production read · full), §6 (trust boundary), §7 (DC-1 Freeze, DC-8), §8 (compat), §9 (deferred), §10.1–10.3 (**S2 row**), §10.2 structural isolation |
| **Depends on** | S0 + S1 accepted on `feat/s1-dir-na-write-catalog` |
| **S2 implement** | **NOT AUTHORIZED** until independent plan review PASS + separate written implement auth |

---

## A. Baseline and Scope

### A.1 Exact baseline SHAs (verified)

| Role | Full SHA |
|---|---|
| S0 accepted tip (inside S1 history) | `118088564830c039d3eddf4821cc30e087f7885d` |
| S1 implementation | `202e6d4422113fb601cd9f488f66dfa6551c3862` |
| **S1 HEAD / S2 implementation baseline** | `7eda9bd44791562c0f4c151231df898fe6319c6a` |
| Repository | `Mattchen217/POJU` |
| Baseline branch | `feat/s1-dir-na-write-catalog` @ `7eda9bd4…` |

**Rule:** S2 implementation (when authorized) must branch from **`7eda9bd44791562c0f4c151231df898fe6319c6a`**. Do not treat later unrelated commits as authorized.

### A.2 Proposed S2 implementation branch (future)

`feat/s2-dir-na-freeze-catalog`

(Docs-only planning branch for this plan: `docs/decision-intake-2.0-phase-3-s2-plan`.)

### A.3 S2 objective (design §10.3)

**Freeze compose loads production SSOT; ignore `authority.dirCatalog`; catalog load failure → `FreezeError` with structured `code`.**

Acceptance slice for S2 (design table): **DC-1 Freeze**, **DC-8**; **R6 T0 Session strip unchanged**.

### A.4 Explicit in-scope

1. Extend `FreezeError` with optional `.code` per locked ctor (§C.1); catalog failure throws set `.code` to loader `reason_code`.
2. In `buildFreezeNaValidationFromSession` (`freeze-to-delivery.ts`):
   - Call `loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)` only.
   - On `!load.ok` → fail-closed `FreezeError` with original `reason_code` as `.code` (see taxonomy §D.2).
   - On success → set `dirCatalog = load.entries` (**overwrite**).
   - **Remove caller authority over `dirCatalog`** (never merge / never fall back).
3. Preserve existing T0 Session strip exactly.
4. Tests for **DC-1 Freeze** and **strengthened DC-8** via real ACTIVE loader + production compose, in `scripts/test-intake-r6-dir-catalog.ts`. Production `!load.ok` → `FreezeError.code` mapping is **code-reviewed, not runtime-tested** (§C.3 / §E.2).

### A.5 Explicit out-of-scope (do not implement under S2 auth)

| Item | Owner / note |
|---|---|
| `production-freeze-wire.ts` `FreezeWireResult.reason_code` mapping | **S3** (design §10.3) |
| DC-4(2) wire propagation / DC-5 / DC-6 as FreezeWire assertions | **S3** |
| DC-10 write≡Freeze consistency suite | **S4** |
| Full R6 freeze-versioning fixture migration (F1–F4 DIR-A → SSOT) | **S5 — mandatory** (see §E.3 / §I.1) |
| Ask / Versioning / Lifecycle / CFP Live Reader / Topic rewires | Deferred (design §9) |
| Schema pin / C5 / E-SCHEMA-1 / DC-7b | Deferred |
| `na-declaration.ts` / S0 catalog Registry export / env injection | Forbidden |
| Sufficiency Gate rule changes | Forbidden (§5.2) |
| Re-enabling `authority.dirCatalog` to green F1–F4 | Forbidden |
| Deleting / skipping / weakening / rewriting F1–F4 assertions | Forbidden |

### A.6 Dependencies and assumptions

- S0 `loadDirNaCatalog` / `ACTIVE_DIR_NA_CATALOG_VERSION` / private Registry remain the only T2 authority.
- S1 write path already joins the same ACTIVE loader; S2 makes Freeze compose use the same T2 source (§5.3).
- Production `applySufficiencyFreezeToSession` already omits `authority` — S2 still hardens `buildFreezeNaValidationFromSession` because `freezeDraftForDelivery` accepts `opts.authority`.
- Temporary known RED on specific freeze-versioning cases until S5 is an accepted staged dependency (§E.3), **not** a passing regression claim.

---

## B. Current-State Analysis

### B.1 What S0 provides (inspected)

| Symbol | Path | Role |
|---|---|---|
| `DIR_NA_CATALOG_V1_ENTRIES` / deep freeze | `lib/poju/decision-context/catalog/dir-na-catalog.v1.ts` | Phase-2 20 DIR SSOT |
| `loadDirNaCatalog` / `resolveDirNaCatalog` / `assertNaConditionInDirCatalog` / `ACTIVE_DIR_NA_CATALOG_VERSION` | `lib/poju/decision-context/catalog/load-dir-na-catalog.ts` | T2 loader; private Registry |
| Barrel | `catalog/index.ts` | No Registry export |

### B.2 What S1 changed (inspected @ `202e6d44` + tests @ `7eda9bd4`)

| Symbol | Path | Role |
|---|---|---|
| `membershipFromCatalogLoad` / `resolveDeclareDirNaCatalogMembership` | `na-declaration.ts` | Write-side join |
| `applyDeclareDirNaToSession` | same | Catalog **before** idempotent; ignore `dir_na_conditions` |
| DC-1/2/3/9a/9b + 5-code mapper asserts | `scripts/test-intake-r6-dir-catalog.ts` | Write acceptance |

### B.3 Freeze path today (gap — design §1.2 / code)

```
applySufficiencyFreezeToSession(session)          // production-freeze-wire.ts ~L113
  → freezeDraftForDelivery(draft, { session, now })  // no authority
    → buildFreezeNaValidationFromSession(...)        // freeze-to-delivery.ts ~L122
         strips T0 keys from opts.authority
         spreads remainder as catalogOrCfpAuthority   // STILL includes dirCatalog if present
         → buildNaValidationContextFromSession(... dirCatalog: overrides.dirCatalog)
```

| Finding | Evidence |
|---|---|
| `FreezeError` has **message only** — no `code` | `freeze.ts` L27–31 |
| Production wire catch maps **message** only | `production-freeze-wire.ts` L167–172 — **S3** |
| `buildFreezeNaValidationFromSession` does **not** call `loadDirNaCatalog` | L122–157 |
| `dirCatalog` still overridable via remaining authority spread | L145–147 |
| Wire omits authority (good) but helper still forgeable | wire L145–148 vs `freezeDraftForDelivery` opts |
| Membership at validate uses `conditionInDirCatalog(ctx)` | `explicit-na-validate.ts` |

### B.4 S2 requirements still unimplemented

1. Production Freeze compose T2 fill from loader.
2. Ignore forged `authority.dirCatalog`.
3. Fail-closed `FreezeError` **with `code`** on catalog availability failure.
4. DC-1 Freeze + strengthened DC-8 tests.

### B.5 Must remain unchanged in S2

- T0 strip list and Session hard-bind.
- `assertSessionDraftBusinessSnapshotBound` / content hash binding.
- Sufficiency Gate / CTA / stall bans.
- S0/S1 catalog and declare behavior.
- F1–F4 **assertion text and Session SoT semantics** (no weaken/skip); fixture SSOT migration is **S5**.

---

## C. Production Change Inventory

**Only these production files** (design §10.3 S2 row):

### C.1 `lib/poju/decision-context/freeze.ts` — locked ctor

```ts
export class FreezeError extends Error {
  readonly code?: string;

  constructor(message: string, options?: { code?: string }) {
    super(message);
    this.name = "FreezeError";
    this.code = options?.code;
  }
}
```

| Rule | Detail |
|---|---|
| Backward compat | Existing `new FreezeError(message)` callers unchanged — do **not** refactor unrelated throw sites |
| Catalog failures | `throw new FreezeError(<reason_code>, { code: <reason_code> })` (message may equal the token) |
| Sufficiency Gate | Unchanged |

### C.2 `lib/poju/decision-context/freeze-to-delivery.ts`

| Change | Detail |
|---|---|
| **Import** | `loadDirNaCatalog`, `ACTIVE_DIR_NA_CATALOG_VERSION` from `./catalog`; `FreezeError` from `./freeze` |
| **Modify** `buildFreezeNaValidationFromSession` | After T0 strip, **destructure out `dirCatalog`** from remaining authority; never spread it. `load = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)`. If `!load.ok` → `throw new FreezeError(load.reason_code, { code: load.reason_code })`. Else `dirCatalog: load.entries`. |
| **CFP / `catalogConditionEvals` / `topicRules`** | **Retain existing pass-through** on non-T0 remainder (§D.3). They must **not** restore caller control over DIR Catalog membership (membership is solely `load.entries` → `conditionInDirCatalog`). |
| **Do not** | Import test fixtures; export Registry injection; set `dirCatalog: []` on failure; export test-only helpers from production barrels |

**I/O:** Input session + authoritative DC + optional authority (`dirCatalog` ignored). Output NaValidation with T2 from ACTIVE load. Errors: throw only — no Session/DC mutation in this helper.

### C.3 Fail-closed mapping — inline in compose (no test API)

**Locked production shape:** Inside `buildFreezeNaValidationFromSession`, after `load = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)`:

```ts
if (!load.ok) {
  throw new FreezeError(load.reason_code, { code: load.reason_code });
}
// use load.entries as dirCatalog
```

A private local helper that performs exactly this throw is optional and **must remain unexported**. Prefer the inline form.

| Rule | Locked |
|---|---|
| No test-only production API | Do **not** export helpers, Registry injection, or seams for inducing `!load.ok` |
| No scripts twin as production coverage | Do **not** duplicate this mapping in `scripts/**` and call that “production mapping coverage” — a scripts copy cannot detect production omitting `.code` |
| How mapping is verified in S2 | **Independent code review** of the compose throw site. Implement / acceptance reports must label it: **`code-reviewed, not runtime-tested`** |
| Runtime tests in S2 | **DC-1 Freeze** and **DC-8** only — real ACTIVE loader + production compose path |
| Production Registry failure integration | **Not claimed** — cannot induce without forbidden injection |
| Wire `reason_code` | **Not S2** — setting `FreezeError.code` ≠ `FreezeWireResult.reason_code` available (S3) |

### C.4 Files not modified in S2

`production-freeze-wire.ts` (S3), `na-declaration.ts`, `catalog/**`, Schema, Ask/CFP/Topic/Lifecycle/Versioning, C5, `test-intake-r6-freeze-versioning.ts` (S5).

---

## D. Execution Order and Invariants

### D.1 `buildFreezeNaValidationFromSession` locked sequence

1. Read `opts.authority` (default `{}`).
2. **T0 strip** (unchanged): `confirmationEvents`, `naDeclarationActions`, `topicEvalAuthority`, `currentTopicCatalogVersion`, `realityFacts`, `constraints`, `explicitNaClassifications`.
3. From remainder, **remove `dirCatalog`** (explicit omit — never spread into overrides).
4. Resolve topic version from Session (unchanged).
5. `load = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)`.
6. If `!load.ok` → `throw new FreezeError(load.reason_code, { code: load.reason_code })`.
7. Build context with Session SoT + `dirCatalog: load.entries` + remaining **non-dirCatalog** authority gaps (`cfpSourceState`, `catalogConditionEvals`, `topicRules`, …) if present.

### D.2 Loader failure taxonomy (design Rev 1.3 §3.2.2 / §3.4 / §5.2) — locked

Freeze **always** requests `ACTIVE_DIR_NA_CATALOG_VERSION`.

| Class | Codes | Production Freeze claim |
|---|---|---|
| **Freeze-reachable** | `dir_catalog_ssot_unavailable`, `dir_catalog_load_failed` | Normal mis-ship / corrupt materialize paths; must fail with `.code` |
| **Loader-only** | `dir_catalog_version_missing`, `dir_catalog_version_invalid`, `dir_catalog_version_unknown` | **Not** claimed as everyday Freeze scenarios (Freeze does not pass null/invalid/999). If somehow returned on ACTIVE load → **still fail-closed** preserving original `reason_code` — do not remap |

**Forbidden:** Registry injection; test-only production seams; empty catalog continue; remapping loader codes to membership denials.

### D.3 CFP / `catalogConditionEvals` authority — locked

| Field | S2 rule |
|---|---|
| `authority.dirCatalog` | **Removed** — overwritten exclusively by loader `entries` |
| `cfpSourceState`, `catalogConditionEvals`, `topicRules` | **Existing pass-through retained** (non-T2 gap fields) |
| T0 Session stores | Still stripped / hard-bound — pass-through **cannot** override them |
| DIR Catalog membership | Solely `conditionInDirCatalog` against loader `entries` — CFP/evals **cannot** add DIR/condition membership |

### D.4 Other invariants

| Invariant | Rule |
|---|---|
| Snapshot | Single successful `load.entries` per compose call |
| Wire `reason_code` | **S3** — S2 asserts `FreezeError.code` on throw / compose |
| Write consistency | Same ACTIVE as S1 — DC-10 is S4 |

---

## E. Test Plan

### E.1 Primary owner: `scripts/test-intake-r6-dir-catalog.ts`

| ID | Behavior | Setup | Expected |
|---|---|---|---|
| **DC-1 Freeze** | SSOT-authorized Session N/A → Freeze → DIR `n_a` | Declare/apply `DIR-DEF-UNACCEPTABLE` + `explicit_no_hard_red_lines`; sufficient draft; call **production** `freezeDraftForDelivery` / compose **without** relying on caller `dirCatalog` | `frozen.dirs[…].current_state === "n_a"` |
| **DC-8 (strengthened)** | Prove **caller catalog authority is ignored** | Session owns classification + `user_explicit_na` evidence + declaration action for a DIR/condition pair that **production SSOT does not authorize** (e.g. `DIR-A` + `explicit_not_applicable`, or any non-SSOT pair). Supply forged `authority.dirCatalog` that **does** list that pair. Call actual production Freeze compose (`freezeDraftForDelivery` → `buildFreezeNaValidationFromSession`) | DIR must **not** become `n_a`. Failure mode = membership deny under production SSOT despite forge — **not** merely “missing evidence” |
| **T0 strip smoke** | Forged Session event stores on authority still stripped | Minimal SSOT-safe fixture | Session SoT wins |

**Not a runtime test in S2:** `!load.ok` → `FreezeError.code` mapping. Verify by **code review** of the inline throw in `buildFreezeNaValidationFromSession`; report as **`code-reviewed, not runtime-tested`**. Do not add scripts twins, production exports, or Registry injection to runtime-test that path.

**DC-8 negative proof checklist:**

1. Session has live action + classification + evidence for the **non-SSOT** pair.
2. Forged `dirCatalog` contains that pair (would have authorized pre-S2).
3. Production compose path invoked.
4. Assert DIR state ≠ `n_a` (typically remains `known` / non-`n_a` per fixture).
5. Do not pass the test solely by omitting evidence/classification.

### E.2 Coverage classes (must not conflate)

| Class | S2 |
|---|---|
| Production compose integration (runtime) | DC-1 Freeze, DC-8 via real `loadDirNaCatalog(ACTIVE)` + production compose |
| Fail-closed `.code` mapping on `!load.ok` | **Code-reviewed, not runtime-tested** — no scripts twin claimed as production coverage |
| Production Registry failure integration | **Not claimed** |
| Wire `FreezeWireResult.reason_code` | **S3 only** — S2 must not equate `FreezeError.code` with wire `reason_code` |

### E.3 Existing suites / temporary freeze-versioning RED — locked

| Suite | S2 expectation |
|---|---|
| `pnpm test:intake-r6-dir-catalog` | **Must PASS** (incl. DC-1 Freeze / DC-8) |
| `pnpm test:intake-r6-na-cas` / `resolver` | **Must PASS** |
| `pnpm exec tsc --noEmit` | **Must PASS** |
| `pnpm test:intake-r6-freeze-versioning` | **Known staged RED** until S5 — report as dependency, **not** as passing regress |

**Exact cases attributed to removing caller Catalog authority** (script: `scripts/test-intake-r6-freeze-versioning.ts`, section **F. Freeze Explicit N/A Gate via freezeDraftForDelivery**):

| Case | Log label | Why RED / at risk under S2 |
|---|---|---|
| **F1** | `F1 Session N/A + forged authority → Freeze DIR n_a (Gate used Session)` | Asserts DIR `n_a` while membership depends on injected `dirCatalog: [{ dir_id: "DIR-A", na_conditions: [explicit_not_applicable] }]`. After ignore+SSOT, pair unauthorized → **expected assert failure** (primary suite breaker). |
| **F2** | `F2 reverse: … → still known (no N/A)` | Asserts `known` with Session missing action; likely **still PASS** if suite reaches it (forge T0 stripped). Not a greenwash of catalog forge. |
| **F3** | `F3 Topic: Session eval + forged topic authority → Freeze DIR n_a` | Same DIR-A / injected catalog dependency for topic N/A path → **expected assert failure** if reached. |
| **F4** | `F4 Topic reverse: … → still known` | Asserts `known`; likely **still PASS** if reached. |

**Not claimed as S2-induced RED** (they inject `dirCatalog` via `reaggregateDirsOnSession` / direct `buildNaValidationContextFromSession`, **not** via `buildFreezeNaValidationFromSession`): e.g. section A `N/A fail-closed without catalog; valid+catalog → n_a`, revoked/cross-context, conflict gate with inline `dirCatalog`. Those paths are **out of S2 compose change**; leave for S5/product follow-ups if later unified.

**S2 implement report must:**

- State freeze-versioning is **not** a passing regression for S2 acceptance.
- Name F1 (and F3 if executed) as the catalog-authority-removal failures.
- Keep F1–F4 assertions intact for S5.
- Treat **S5 fixture migration** as **mandatory** vertical-slice acceptance item.

### E.4 What not to claim in S2

- Wire `reason_code` (S3), DC-10 (S4), F1–F4 green under SSOT (S5), Stage 3.2 complete.

---

## F. Compatibility and Regression Analysis

| Area | Assessment |
|---|---|
| S0 / S1 | Compatible consumers of same ACTIVE loader |
| `FreezeError` | Additive optional `code`; legacy message-only throws remain valid |
| Callers of `authority.dirCatalog` on Freeze compose | Intentionally ineffective for T2 |
| freeze-versioning F1/F3 | Temporary RED until S5 (staged) |
| Persisted data | No schema migration |
| Downstream Ask/Lifecycle | May still omit loader (accepted residual §6) |

---

## G. Exact Change Boundary

### G.1 Allowlist (when implement authorized)

| Path | Allowed |
|---|---|
| `lib/poju/decision-context/freeze.ts` | Locked `FreezeError` ctor + optional `code` |
| `lib/poju/decision-context/freeze-to-delivery.ts` | Loader join; omit `dirCatalog`; throw on `!load.ok`; private helper optional |
| `scripts/test-intake-r6-dir-catalog.ts` | DC-1 Freeze, strengthened DC-8 (compose integration only) |
| `scripts/fixtures/**` | Only if needed for DC-1/DC-8 fixtures; never imported by production; **no** mapping-twin “coverage” |
| `package.json` | Only if new script required (prefer existing) |

### G.2 Denylist

- `production-freeze-wire.ts` (S3)
- `na-declaration.ts`, production Registry exports, env seams
- Ask / CFP Live / Topic / Versioning / Lifecycle / Schema / C5
- `scripts/test-intake-r6-freeze-versioning.ts` (S5 — do not edit to force green)
- Exporting test/Registry helpers from production barrels

---

## H. Verification Commands

**Required green for S2 acceptance:**

```bash
pnpm test:intake-r6-dir-catalog
pnpm test:intake-r6-na-cas
pnpm test:intake-r6-resolver
pnpm exec tsc --noEmit
```

**Must run and disclose (not required green for S2):**

```bash
pnpm test:intake-r6-freeze-versioning
```

Report as **known staged regression dependency** pending mandatory S5 — not as suite PASS.

---

## I. Risks and Resolved Decisions

### I.1 Risks

| Risk | Mitigation |
|---|---|
| F1/F3 RED | Accepted until S5; do not re-enable `authority.dirCatalog`; do not weaken F1–F4 |
| Message-only catalog faults | Locked `.code` on catalog throws |
| Empty catalog paper-over | Forbidden |
| Fake mapping coverage via scripts twin | Forbidden — mapping is code-reviewed only (§C.3 / §E.2) |
| Equating `FreezeError.code` with wire `reason_code` | Forbidden until S3 |
| CFP pass-through confused with T2 | Membership only from loader entries (§D.3) |

### I.2 Former unresolved questions — **RESOLVED (plan Rev 1.1)**

| # | Decision |
|---|---|
| 1. Freeze-versioning during S2 | **Accept temporary known RED** until S5. Do not edit freeze-versioning in S2. Do not re-enable caller `dirCatalog`. Do not delete/skip/weaken/rewrite F1–F4. Identify F1/F3 as primary catalog-authority failures. **S5 fixture migration remains mandatory.** |
| 2. `FreezeError` ctor | **Locked:** `constructor(message: string, options?: { code?: string })` with `readonly code?: string`. Catalog throws set `{ code: reason_code }`. No drive-by refactor of other throw sites. |
| 3. Loader-only codes on compose | **Fail-closed preserve original `reason_code`.** Do **not** claim `_missing` / `_invalid` / `_unknown` as normal production Freeze scenarios. Freeze-reachable claims remain `ssot_unavailable` + `load_failed` only. |
| 4. CFP / `catalogConditionEvals` | **Retain pass-through** for non-`dirCatalog` gap fields. **Cannot** override T0 Session authority. **Cannot** grant DIR Catalog membership (T2 = loader entries only). |

### I.3 Remaining design staging notes (not blockers)

- Full vertical-slice PASS needs S2→S5; S2 alone is not Stage 3.2 complete.
- Wire `reason_code` remains **S3** per §10.3 despite §5.2 end-state language.

---

## J. Acceptance Criteria (objective)

S2 may be independently accepted only when **all** hold:

1. **Production:** `buildFreezeNaValidationFromSession` loads `loadDirNaCatalog(ACTIVE)`, sets `dirCatalog` from `load.entries`, ignores `authority.dirCatalog`.
2. **Failure:** Compose contains inline `!load.ok` → `FreezeError(..., { code: load.reason_code })`; no empty-catalog continue; Freeze-reachable taxonomy claims limited to `ssot_unavailable` + `load_failed`. Mapping verified by **code review** (`code-reviewed, not runtime-tested`).
3. **Ctor:** `FreezeError` matches locked signature; legacy message-only call sites untouched.
4. **T0:** Session strip / hard-bind unchanged; CFP/evals pass-through cannot restore T2 forge.
5. **Runtime tests:** DC-1 Freeze + strengthened DC-8 (Session-owned non-SSOT pair + forged catalog → no `n_a`) PASS via real ACTIVE loader + production compose. No scripts mapping twin; no Registry injection; no production test export.
6. **API boundary:** No test/Registry helpers exported from production modules.
7. **Compatibility:** S0/S1 suites in §H required-green list PASS; `tsc` PASS.
8. **Git scope:** Diff ⊆ §G allowlist; implement branch from `7eda9bd44791562c0f4c151231df898fe6319c6a`.
9. **freeze-versioning:** Run disclosed as known staged RED / S5 dependency — **not** claimed PASS; F1–F4 assertions preserved for S5.
10. **Not claimed:** Runtime proof of `!load.ok` mapping; S3 wire `reason_code`; S4 DC-10; S5 F1–F4 SSOT migration; Stage 3.2 complete.

---

## Stop Condition

This document is **plan-only** (Rev 1.2 — mapping coverage clarification).

- No production or test implementation is authorized by this revision.
- Wait for independent plan review and **explicit written S2 implementation authorization**.
- Do not start S3/S4/S5 under this plan.

**PLAN ONLY — NOT AUTHORIZED FOR IMPLEMENTATION**
