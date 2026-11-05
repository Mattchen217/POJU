# STAGE-3.2 S2 Implementation Plan

**S2 Implementation Plan — Plan Only — Not Authorized for Implementation**

| Field | Value |
|---|---|
| **Document status** | PLAN ONLY — no production/test implementation authorized by this document |
| **Authoritative design** | [`STAGE-3.2-DIR-CATALOG-VERTICAL-SLICE-DESIGN.md`](./STAGE-3.2-DIR-CATALOG-VERTICAL-SLICE-DESIGN.md) **Revision 1.3** |
| **Design sections used** | §1.2 (Freeze gap), §3.2–3.6 (loader / ACTIVE / membership), §5 (Freeze production read · full), §6 (trust boundary), §7 (DC-1 Freeze, DC-8; adjacent DC-4/5 for S3), §8 (compat), §9 (deferred), §10.1–10.3 (**S2 row**), §10.2 structural isolation |
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

1. Add structured `FreezeError.code` for catalog-availability failure throws ([`freeze.ts`](../../../lib/poju/decision-context/freeze.ts)).
2. In [`buildFreezeNaValidationFromSession`](../../../lib/poju/decision-context/freeze-to-delivery.ts):
   - Call `loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)`.
   - On `!load.ok` for Freeze-reachable faults → throw `FreezeError` with `.code` = loader `reason_code` (design §5.2: primarily `dir_catalog_ssot_unavailable` \| `dir_catalog_load_failed`; do not invent a silent continue path).
   - On success → set `dirCatalog = load.entries` (**overwrite**).
   - **Ignore** `opts.authority.dirCatalog` (never merge / never fall back to caller list).
3. Preserve existing T0 Session strip (confirmation / N/A actions / topic eval / related Session SoT hard-bind) exactly.
4. Tests for **DC-1 Freeze** and **DC-8** (and load→`FreezeError.code` pure/compose mapping without injecting production Registry), owned primarily by [`scripts/test-intake-r6-dir-catalog.ts`](../../../scripts/test-intake-r6-dir-catalog.ts).

### A.5 Explicit out-of-scope (do not implement under S2 auth)

| Item | Owner / note |
|---|---|
| `production-freeze-wire.ts` `FreezeWireResult.reason_code` mapping | **S3** (design §10.3) |
| DC-4(2) wire propagation / DC-5 / DC-6 as FreezeWire assertions | **S3** |
| DC-10 write≡Freeze consistency suite | **S4** |
| Full R6 freeze-versioning fixture migration (F1–F4 DIR-A → SSOT) | **S5** (see §I risk) |
| Ask / Versioning / Lifecycle / CFP / Topic rewires | Deferred (design §9) |
| Schema pin / C5 / E-SCHEMA-1 / DC-7b | Deferred |
| `na-declaration.ts` / S0 catalog Registry export / env injection | Forbidden |
| Sufficiency Gate rule changes | Forbidden (§5.2) |

### A.6 Dependencies and assumptions

- S0 `loadDirNaCatalog` / `ACTIVE_DIR_NA_CATALOG_VERSION` / private Registry / `assertNaConditionInDirCatalog` remain the only T2 authority.
- S1 write path already joins the same ACTIVE loader; S2 makes Freeze compose use the same T2 source (§5.3).
- Production `applySufficiencyFreezeToSession` already omits `authority` (§1.2) — S2 still must harden `buildFreezeNaValidationFromSession` because `freezeDraftForDelivery` accepts `opts.authority` (used by R6 tests and any non-wire caller).
- **Assumption (flagged):** Until S5, existing F1–F4 fixtures that inject `dirCatalog: [{ dir_id: "DIR-A", …}]` will **not** authorize N/A under production SSOT once `dirCatalog` is ignored. See §I.

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
| Production wire catch maps **message** only | `production-freeze-wire.ts` L167–172 (`reason: e.message`) — **S3** to fix |
| `buildFreezeNaValidationFromSession` does **not** call `loadDirNaCatalog` | L122–157 |
| `dirCatalog` still overridable via remaining authority spread | L145–147 `...catalogOrCfpAuthority` |
| Wire omits authority (good) but helper still forgeable | `applySufficiencyFreezeToSession` L145–148 vs `freezeDraftForDelivery` opts |
| Membership at validate uses `conditionInDirCatalog(ctx)` | `explicit-na-validate.ts` — empty/missing catalog → fail-closed (no false N/A; also blocks valid N/A) |

### B.4 S2 requirements still unimplemented

1. Production Freeze compose T2 fill from loader.
2. Ignore forged `authority.dirCatalog`.
3. Fail-closed `FreezeError` **with `code`** on catalog availability failure.
4. DC-1 Freeze (declare SSOT pair → Freeze → DIR `n_a`) and DC-8 (forged catalog cannot force `n_a`) tests.

### B.5 Must remain unchanged in S2

- T0 strip list and Session hard-bind in `buildFreezeNaValidationFromSession`.
- `assertSessionDraftBusinessSnapshotBound` / content hash binding.
- Sufficiency Gate / CTA / stall bans in `freezeDecisionContext`.
- S0/S1 catalog and declare behavior.
- F1–F4 **semantic meaning** (Session events authorize; forged event stores do not) — catalog source changes; fixture migration is S5 unless amended.

---

## C. Production Change Inventory

**Only these production files** (design §10.3 S2 row):

### C.1 `lib/poju/decision-context/freeze.ts`

| Change | Detail |
|---|---|
| **Modify** `FreezeError` | Add `readonly code?: string` (or required `code: string` with optional empty for legacy throws). **Catalog failure throws must set `code` to the loader `reason_code`.** |
| **Do not** change Sufficiency Gate logic, CTA/stall checks, or reaggregation rules |

**Behavioral:** Callers/tests can assert `error.code` without message parsing for catalog faults. Existing non-catalog `throw new FreezeError("…")` may omit `code` until a later cleanup (out of S2 unless trivial).

### C.2 `lib/poju/decision-context/freeze-to-delivery.ts`

| Change | Detail |
|---|---|
| **Import** | `loadDirNaCatalog`, `ACTIVE_DIR_NA_CATALOG_VERSION` from `./catalog`; `FreezeError` from `./freeze` |
| **Modify** `buildFreezeNaValidationFromSession` | After T0 strip, **omit** `dirCatalog` from spread; `const load = loadDirNaCatalog(ACTIVE)`; if `!load.ok` → `throw new FreezeError(load.reason_code, { code: load.reason_code })` (exact ctor shape TBD to match C.1); else pass `dirCatalog: load.entries` into `buildNaValidationContextFromSession` |
| **Keep** | CFP / `catalogConditionEvals` / `topicRules` authority pass-through if present (design: ignore **dirCatalog** specifically as T2; do not invent emptying CFP) |
| **Do not** | Import test fixtures; accept Registry injection; set `dirCatalog: []` on failure |

**I/O contract:**

- Input: `session`, authoritative DC, optional `authority` (dirCatalog ignored).
- Output: `NaValidationContext` with T2 `dirCatalog` = production ACTIVE entries.
- Errors: throw `FreezeError` with structured catalog `code` — **no** mutate Session/DC inside this helper.

**Persistence / auth / downstream:** No direct persist. Affects all Freeze reaggregation consumers of this helper (`freezeDraftForDelivery` → DIR `n_a` eligibility for Explicit N/A). Authorization: T2 only from loader.

### C.3 Files not modified in S2

`production-freeze-wire.ts` (S3), `na-declaration.ts`, `catalog/**`, Schema, Ask/CFP/Topic/Lifecycle/Versioning, C5, design docs (except this plan on docs branch).

---

## D. Execution Order and Invariants

### D.1 `buildFreezeNaValidationFromSession` locked sequence

1. Read `opts.authority` (default `{}`).
2. **T0 strip** (unchanged): remove `confirmationEvents`, `naDeclarationActions`, `topicEvalAuthority`, `currentTopicCatalogVersion`, `realityFacts`, `constraints`, `explicitNaClassifications`.
3. From remainder, **drop `dirCatalog`** (do not spread into overrides).
4. Resolve topic version from Session (unchanged).
5. `load = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)`.
6. If `!load.ok` → throw `FreezeError` with `.code === load.reason_code` (**fail-closed**; no empty catalog; no continue).
7. Build context with Session SoT fields + `dirCatalog: load.entries` (+ remaining non-dirCatalog authority gaps if any).

### D.2 Invariants

| Invariant | Rule |
|---|---|
| T2 source | Only `loadDirNaCatalog(ACTIVE)` |
| Forge | `authority.dirCatalog` never authorizes |
| Fail-closed | Catalog availability failure → throw; no `dirCatalog: []` paper-over |
| Snapshot | Single successful `load.entries` identity used for context (no second load for membership) |
| Idempotency | Freeze wire idempotency unchanged; catalog check runs whenever compose builds NaValidation |
| Write consistency | Same ACTIVE as S1 write (§5.3) — DC-10 deferred to S4 |
| Error propagation (S2) | `FreezeError.code` set; **wire `reason_code` is S3** — S2 tests assert on thrown `FreezeError` / direct compose, not necessarily `FreezeWireResult.reason_code` |

### D.3 Suggested pure helper (optional, same file or tiny local function)

Mirror S1 discipline without Registry injection:

```ts
// Pseudocode — plan only
export function dirCatalogEntriesOrThrow(load: DirNaCatalogLoadResult): readonly DirNaCatalogEntry[]
// !ok → throw FreezeError(code=reason_code); ok → return load.entries
```

Allows unit-testing mapping of synthetic `{ ok:false, reason_code }` → `FreezeError.code` without claiming production Registry fault integration (label: **pure mapping coverage**).

---

## E. Test Plan

### E.1 Primary owner: `scripts/test-intake-r6-dir-catalog.ts`

| ID | Behavior | Setup | Expected |
|---|---|---|---|
| **DC-1 Freeze** | Production SSOT pair declared on Session; Freeze compose without forged dirCatalog | `declare`/`applyDeclare` with `DIR-DEF-UNACCEPTABLE` + `explicit_no_hard_red_lines`; sufficient draft; `freezeDraftForDelivery` **without** trusting caller dirCatalog (omit or forge-irrelevant) | Frozen DIR `current_state === "n_a"`; classifications/evidence remain |
| **DC-8** | `authority.dirCatalog` forged to allow a pair SSOT denies (or forged allow-all) while Session lacks valid membership path / evidence not in SSOT | Forge rich `dirCatalog`; keep T0 Session correct or incorrect per case | **No false `n_a`** from forge; production SSOT governs |
| **Load→FreezeError map** | Synthetic `!load.ok` via helper `dirCatalogEntriesOrThrow` / equivalent | At least `dir_catalog_ssot_unavailable` + `dir_catalog_load_failed` (Freeze-reachable per §5.2); optionally all five codes for mapper parity with S1 | `FreezeError.code === reason_code`; **label pure mapping**, not production Registry integration |
| **T0 strip smoke** | Forged `naDeclarationActions` / confirmation on authority still stripped | Minimal | Existing Session SoT wins (may reuse slimmed F2-style assertion without depending on injected DIR-A catalog) |

**Negative asserts:** On DC-8 reject-of-forge, DIR not `n_a` solely due to forged catalog; on load fail helper, no returned context with empty catalog.

### E.2 Pure vs integration

| Kind | What |
|---|---|
| Pure helper | `dirCatalogEntriesOrThrow` / load-result→`FreezeError` mapping |
| Production compose integration | `buildFreezeNaValidationFromSession` / `freezeDraftForDelivery` with real `loadDirNaCatalog(ACTIVE)` |
| Failure-path | Catalog load fail → throw with code (pure + document Freeze-reachable codes) |
| Regression | S0/S1 dir-catalog cases remain green; S1 write DC cases unchanged |

### E.3 Existing suites

| Suite | S2 expectation |
|---|---|
| `pnpm test:intake-r6-dir-catalog` | Must PASS with new DC-1 Freeze / DC-8 |
| `pnpm test:intake-r6-na-cas` / `resolver` | Must PASS (no intentional S2 edits) |
| `pnpm test:intake-r6-freeze-versioning` | **Likely RED** after S2 until S5 migrates DIR-A/`explicit_not_applicable` fixtures off injected `authority.dirCatalog` — see §I. Do **not** silently weaken F1–F4 semantics. |
| `tsc --noEmit` | Must PASS |

### E.4 What not to claim in S2

- Full DC-4/5/6 via `FreezeWireResult.reason_code` (S3).
- DC-10 (S4).
- DC-11/12 F1–F4 green under production SSOT (S5) unless plan amended.

---

## F. Compatibility and Regression Analysis

| Area | Assessment |
|---|---|
| S0 | Compatible — Freeze becomes a consumer of existing loader |
| S1 | Compatible — same ACTIVE; write/Freeze T2 alignment improves |
| Public interfaces | `FreezeError` gains `code`; `buildFreezeNaValidationFromSession` behavior change for `dirCatalog` |
| Persisted data | No schema change; existing Session N/A rows with non-SSOT DIR/condition remain non-authorizing at Freeze (fail-closed) |
| Callers passing `authority.dirCatalog` | **Breaks** forged-catalog success paths (intentional); R6 freeze-versioning affected |
| Error codes | New structured `FreezeError.code`; wire surface still message-only until S3 |
| Idempotency / replay | Declare path unchanged; Freeze compose always reloads ACTIVE |
| Downstream | Delivery Freeze may start marking SSOT-valid N/A DIRs as `n_a`; Ask/Lifecycle still may omit loader (residual risk §6 — accepted) |
| Migration | None for DB. **Test migration** required in S5 for F1–F4 fixture IDs/tokens |

---

## G. Exact Change Boundary

### G.1 Allowlist (S2 implement, when authorized)

| Path | Allowed |
|---|---|
| `lib/poju/decision-context/freeze.ts` | `FreezeError.code` |
| `lib/poju/decision-context/freeze-to-delivery.ts` | Loader join; ignore `dirCatalog`; throw on load fail |
| `scripts/test-intake-r6-dir-catalog.ts` | DC-1 Freeze, DC-8, FreezeError mapping tests |
| `scripts/fixtures/**` | Only if a new **test-only** helper is required and not imported by production |
| `package.json` | Only if a new script is required (prefer existing `test:intake-r6-dir-catalog`) |

### G.2 Denylist

- `production-freeze-wire.ts` (S3)
- `na-declaration.ts`, `catalog/**` production Registry export changes
- Ask / CFP / Topic / Versioning / Lifecycle / Schema / C5
- `scripts/test-intake-r6-freeze-versioning.ts` **unless** a separately approved plan amendment pulls S5 fixture work forward
- Design docs other than authorized plan docs
- Env-flag / production Registry injection seams

---

## H. Verification Commands

After authorized S2 implementation:

```bash
pnpm test:intake-r6-dir-catalog
pnpm test:intake-r6-na-cas
pnpm test:intake-r6-resolver
pnpm exec tsc --noEmit
```

**Also run (report status honestly):**

```bash
pnpm test:intake-r6-freeze-versioning
```

- If red solely due to injected `DIR-A`/`explicit_not_applicable` + ignored `authority.dirCatalog`, document as **known S5 dependency**, do not “fix” by re-enabling authority catalog on production compose.
- Local vs CI: same pnpm scripts; no special CI-only gate required beyond existing project CI.

---

## I. Risks and Unresolved Questions

### I.1 Risks

| Risk | Mitigation |
|---|---|
| F1–F4 break when `dirCatalog` ignored | Design assigns fixture work to **S5**; S2 must not restore forgeable T2 |
| Collapsing load failures into message-only | Require `FreezeError.code`; S3 later maps to wire `reason_code` |
| Setting `dirCatalog: []` on failure | Forbidden — throw instead |
| Expanding S2 into wire/S3 | Keep denylist |
| Double-load inconsistency | Single load per compose call; reuse `load.entries` |

### I.2 Unresolved questions (need approval before implement)

1. **Freeze-versioning during S2:** Accept temporary RED on `test:intake-r6-freeze-versioning` until S5, **or** amend S2 allowlist to include minimal F1–F4 SSOT fixture migration (preserve Session SoT semantics)? **Default in this plan:** S2 does **not** edit freeze-versioning; implement report must disclose suite status.
2. **`FreezeError` ctor shape:** Prefer `new FreezeError(message, { code })` vs `new FreezeError(code, message)` with `.code` always set for catalog faults — choose one consistent with existing `NaDeclarationError(code, message)` style for catalog codes?
3. **Non-Freeze-reachable loader codes on compose:** If `loadDirNaCatalog(ACTIVE)` somehow returned `_missing`/`_invalid`/`_unknown`, throw with that `code` anyway (fail-closed) even though §5.2 says they are not everyday Freeze inputs?
4. **CFP/`catalogConditionEvals` authority:** Confirm S2 only strips/overwrites **`dirCatalog`**, leaving other gap fields pass-through (this plan’s default).

### I.3 Ambiguities in design (not invented away)

- Vertical-slice exit criteria want DC-1…DC-12, but **staged** S2/S3/S4/S5 split delivery; S2 alone is **not** full vertical-slice PASS.
- §5.2 requires wire `reason_code` while §10.3 places wire work in **S3** — this plan follows **§10.3 stage table** for file scope.

---

## J. Acceptance Criteria (objective)

S2 may be independently accepted only when **all** hold:

1. **Production:** `buildFreezeNaValidationFromSession` loads `loadDirNaCatalog(ACTIVE)`, sets `dirCatalog` from `load.entries`, ignores `authority.dirCatalog`.
2. **Failure:** Catalog availability failure throws `FreezeError` with `.code` equal to loader `reason_code`; no empty-catalog continue.
3. **T0:** Session event strip / hard-bind unchanged in meaning.
4. **Tests:** DC-1 Freeze and DC-8 demonstrated in `test-intake-r6-dir-catalog` (or approved owner) with negative forge asserts; pure mapping labeled correctly.
5. **Compatibility:** S0/S1 write/loader tests still PASS; no production Registry injection API.
6. **Git scope:** Diff ⊆ §G allowlist; baseline parent = `7eda9bd44791562c0f4c151231df898fe6319c6a` (or agreed merge of that tip).
7. **Verification:** Commands in §H executed; freeze-versioning status disclosed per §I.1.
8. **Not claimed:** S3 wire `reason_code`, S4 DC-10, S5 F1–F4 SSOT migration, Stage 3.2 complete.

---

## Stop Condition

This document is **plan-only**.

- No production or test implementation is authorized by submitting or merging this plan.
- Wait for independent plan review and **explicit written S2 implementation authorization**.
- Do not start S3/S4/S5 under this plan.

**PLAN ONLY — NOT AUTHORIZED FOR IMPLEMENTATION**
