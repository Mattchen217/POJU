# STAGE-3.2 S4 Implementation Plan

**S4 Implementation Plan — Plan Only — Not Authorized for Implementation**

| Field | Value |
|---|---|
| **Document status** | PLAN ONLY — no production/test implementation authorized by this document |
| **Revision** | **1.1** (locks revoke fail-closed, independent S4 branch, C09/C10/C19–C21/C24/C25) |
| **Rev 1.0 plan commit** | `6944307c03e42c89c3916fd4971693af558a7537` |
| **Stage** | Decision Intake 2.0 · Stage 3.2 · **S4** Write / Freeze Consistency |
| **Authoritative design** | [`STAGE-3.2-DIR-CATALOG-VERTICAL-SLICE-DESIGN.md`](./STAGE-3.2-DIR-CATALOG-VERTICAL-SLICE-DESIGN.md) Rev 1.3 · DC-10 / consistency |
| **S4 start / required parent** | `0e09531c06840d373d8715426dec542c61130ebe` |
| **S3 parent** | `9411c83f475605945874f87bb969db3ac1329ee9` |
| **Docs / plan history branch** | `feat/s3-freeze-wire-reason-code` (may hold plan/evidence commits **after** `0e09531c`) |
| **S4 implement branch (locked)** | **`feat/s4-dir-na-write-freeze-consistency`** — created from `0e09531c` only |
| **Toolchain** | Node `22.22.0` · `corepack pnpm` `10.33.2` |
| **S4 implement** | **NOT AUTHORIZED** until independent plan review PASS + separate written implement auth |

### Revision 1.1 — review resolutions

| Finding | Locked resolution |
|---|---|
| **1** Revoke fail-closed | Missing DC → reject; `status !== "draft"` → reject; reject **before** any Action/Classification/Evidence mutation; no implement-time choice left |
| **2** Git | Independent S4 branch from exact `0e09531c`; no force-push / rebase / rewrite of S3 or plan history |
| **3** C09/C10 | Full key binding field lists + tamper fixtures + DIR must not become `n_a` |
| **4** C19–C21 | Production `declareDirNotApplicable` / `revokeDirNaDeclaration` + reload + unchanged state |
| **5** C24 | Full CAS chain + post-freeze reload checklist for snapshot/hash/binding |
| **6** C25 | Real CAS persist-fail attempt; else UNTESTED; no production fault-inject API |

---

## 1. Objective

Prove production Write → CAS persist → DIR reaggregation → Freeze authoritative compose → Frozen version/hash/binding consistency for DIR N/A Catalog.

Does **not**: expand Catalog SSOT content; rewrite S0–S3; perform S5 F1–F4 isolation; merge/deploy.

---

## 2. Git branch strategy (locked · Rev 1.1)

| Item | Value |
|---|---|
| **S4 production commit Parent (hard)** | Exactly `0e09531c06840d373d8715426dec542c61130ebe` |
| **S4 implement branch** | `feat/s4-dir-na-write-freeze-consistency` |
| **How to start (when authorized)** | `git checkout -b feat/s4-dir-na-write-freeze-consistency 0e09531c06840d373d8715426dec542c61130ebe` then implement → first S4 code commit’s parent is `0e09531c` |
| **Docs/plan/evidence history** | Remains on `feat/s3-freeze-wire-reason-code` (commits after `0e09531c` such as evidence + this plan). **Do not** rebase, force-push, or rewrite that history, S3 history, or plan commits. |
| **Forbidden** | Force push; rebase S3 / plan tip onto S4; amend S3; make S4 parent an evidence or plan commit |

Plan-doc commits (including Rev 1.1) may continue on `feat/s3-freeze-wire-reason-code`. They are **not** S4 production parents.

---

## 3. Current Write / Freeze call chains (audited @ `0e09531c`)

### 3.1 Write (production)

```text
declareDirNotApplicable(sessionId, input, opts?)
  → mutatePOJUSession(…, apply)
       → applyDeclareDirNaToSession(latest, sessionId, input, now)
            → resolveDeclareDirNaCatalogMembership(dir, code)
                 → loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)
                 → membershipFromCatalogLoad(...)
            → (idempotent check | create action/classification/evidence)
            → return { session, action, classification, evidence, outcome }
  → DeclareDirNaResult (+ CAS write result)
```

**File:** `lib/poju/decision-context/na-declaration.ts`  
**Note:** `input.dir_na_conditions` is already **ignored** for authorization.

### 3.2 Freeze (production)

```text
ensureSessionFrozenForDelivery / applySufficiencyFreezeToSession
  → freezeDraftForDelivery
       → assertSessionDraftBusinessSnapshotBound  // requires both statuses === "draft"
       → buildFreezeNaValidationFromSession
            → loadDirNaCatalog(ACTIVE)            // T2; ignores authority.dirCatalog
            → buildNaValidationContextFromSession(..., dirCatalog: load.entries)
       → freezeDecisionContext
            → reaggregateDirsIntake
                 → findValidatedDirLevelNa → validateExplicitNaEvidence
```

**Files:** `freeze-to-delivery.ts`, `production-freeze-wire.ts`, `dir-aggregator-intake.ts`, `explicit-na-validate.ts`, `freeze.ts`

### 3.3 Catalog SSOT (shared)

| Concern | Write | Freeze |
|---|---|---|
| Version | `ACTIVE_DIR_NA_CATALOG_VERSION` | same |
| Loader | `loadDirNaCatalog(ACTIVE)` | same |
| Membership | `membershipFromCatalogLoad` | `dirCatalog` from ACTIVE load |
| Client list | ignored | N/A |
| `authority.dirCatalog` | N/A | stripped / overwritten (S2) |

**S4-1:** Membership already unified; prove via C07/C08/C23. No Catalog rewrite planned unless regression found.

---

## 4. Required production fixes (S4-2)

### 4.1 Write gate — `applyDeclareDirNaToSession`

Replace current `draft|final` allow with:

```ts
if (!dc) {
  throw new NaDeclarationError(NA_DECLARATION_CONTEXT_INVALID, "Decision Context missing");
}
if (dc.status !== "draft") {
  throw new NaDeclarationError(
    NA_DECLARATION_CONTEXT_INVALID, // or NA_DECLARATION_CONTEXT_NOT_WRITABLE if added
    "Decision Context is not writable",
  );
}
```

Reject **before** catalog membership side effects that write records, and **before** any Action/Classification/Evidence append. Covers `final`, `superseded`, unknown.

### 4.2 Revoke fail-closed — `revokeDirNaDeclaration` (**locked · no implement ambiguity**)

**Site today:** ~L804–859 — no DC status gate; can mutate Final.

**Locked contract (Rev 1.1):**

| Condition | Behavior |
|---|---|
| `latest.decision_context` **missing** (`null` / undefined) | **Reject** with `NaDeclarationError` (`NA_DECLARATION_CONTEXT_INVALID` or dedicated not-writable code) |
| `dc.status !== "draft"` (incl. `final`, `superseded`, unknown) | **Reject** with same family of error |
| Timing | Rejection occurs **before** any mutation of `na_declaration_actions`, `explicit_na_classifications`, `explicit_na_evidence`, or `dc.version` / `updated_at` |
| Success path | Only when `dc.status === "draft"` may revoke mark action/classification/evidence and bump draft version |

**Forbidden:**

- Revoking actions while leaving Final DC untouched as a “partial success.”
- Silent no-op that returns CAS success without error when DC is missing or non-draft.
- Inventing Final → new Draft supersede lifecycle in S4.
- Leaving “prefer reject vs action-only revoke” as an implement-time choice.

### 4.3 Error code

Existing: `NA_DECLARATION_INVALID` | `NA_DECLARATION_SOURCE_INVALID` | `NA_DECLARATION_CONTEXT_INVALID`.

**Default:** reuse `NA_DECLARATION_CONTEXT_INVALID` with distinct messages (`missing` vs `not writable`).  
**Optional:** add `NA_DECLARATION_CONTEXT_NOT_WRITABLE` — document in Diff if used. Same code family for write and revoke gates.

### 4.4 Retain + prove (no rewrite)

ACTIVE write join; Freeze ACTIVE ignore `dirCatalog`; existing create/idempotent/source/conflict>N/A; S3 Wire — prove via tests.

---

## 5. Key binding fields (S4-3) — closed lists for C01 / C09 / C10

Compare `source_ref` with `sourceRefEquals` (kind + fact_id / constraint_id), **never** object identity.

### 5.1 `UserNaDeclarationAction` (must hold)

`declaration_action_id`, `session_id`, `context_id`, `actor === "user"`, `control_id`, `source_ref`, `dir_id`, `na_condition_code`, `declaration_turn_id`, `occurred_at`, `revoked`, `expires_at`

### 5.2 `ExplicitNaClassification` ↔ Action

| Classification field | Must equal |
|---|---|
| `authority` | `"user_declared"` |
| `written_by` | `"code"` |
| `context_id` | `action.context_id` |
| `declaration_action_id` | `action.declaration_action_id` |
| `dir_id` | `action.dir_id` |
| `na_condition_code` | `action.na_condition_code` |
| `declaration_turn_id` | `action.declaration_turn_id` |
| `source_ref` | `sourceRefEquals(action.source_ref)` |
| `expires_at` | `action.expires_at` |
| `revoked` | consistent with live authorization (false when authorizing) |

### 5.3 `ExplicitNaEvidence` (user_explicit_na / dir) ↔ Action

| Evidence field | Must equal |
|---|---|
| `evidence_type` | `"user_explicit_na"` |
| `target` | `"dir"` |
| `evidence_id` | `` `na_ev_${action.declaration_action_id}` `` |
| `dir_id` | `action.dir_id` |
| `na_condition_code` | `action.na_condition_code` |
| `source_ref` | `sourceRefEquals(action.source_ref)` |
| `written_by` | `"code"` |
| `revoked` | `false` when authorizing |

Validate path: `validateExplicitNaEvidence` → `findMatchingNaClassification` → live Action; then `findValidatedDirLevelNa` / `reaggregateDirsIntake`.

---

## 6. C09 / C10 tamper fixtures (locked)

**Setup:** Complete legal write (C01) so DIR would otherwise be `n_a`. Then **tamper only** the named binding while keeping other records present. Run `buildFreezeNaValidationFromSession` / `reaggregateDirsIntake` (and/or `freezeDraftForDelivery` when draft snapshot still valid).

| Case | Tamper | Expected |
|---|---|---|
| **C09a** | Classification `declaration_action_id` ≠ Action id | `findValidatedDirLevelNa` → null; target DIR **`current_state !== "n_a"`** |
| **C09b** | Classification `dir_id` or `na_condition_code` ≠ Action | same |
| **C09c** | Classification `source_ref` ≠ Action (`sourceRefEquals` false) | same |
| **C09d** | Classification `context_id` or `declaration_turn_id` ≠ Action | same |
| **C09e** | Classification `expires_at` ≠ Action | same |
| **C10a** | Evidence `evidence_id` ≠ ``na_ev_${action_id}`` | same |
| **C10b** | Evidence `dir_id` / `na_condition_code` ≠ Action | same |
| **C10c** | Evidence `source_ref` ≠ Action | same |
| **C10d** | Evidence `target` ≠ `"dir"` or type ≠ `user_explicit_na` | same |

**Hard pass criterion:** mismatched triad **must not** authorize DIR `n_a`. Print explicit asserts on `current_state`.

---

## 7. C19 / C20 / C21 — production entry + reload (locked)

**Forbidden substitute:** calling only `applyDeclareDirNaToSession` / in-memory revoke apply without `declareDirNotApplicable` / `revokeDirNaDeclaration`.

### Shared method

1. `createPOJUSession` + CAS-seed DC in target status (`final` / `superseded`) with baseline snapshot of: `na_declaration_actions`, `explicit_na_classifications`, `explicit_na_evidence`, `dc.version`, `dc.status`, dir states, content_hash if present.
2. Invoke **production** entry (`declareDirNotApplicable` or `revokeDirNaDeclaration`).
3. Expect throw / fail-closed (not silent success).
4. `loadPOJUSession(sessionId)` again.
5. Assert **byte-stable business equality** (deep compare / field asserts): actions, classifications, evidence, `version`, `status`, and other business DC fields unchanged vs baseline.

| ID | Entry | Seed | Expected |
|---|---|---|---|
| **C19** | `declareDirNotApplicable` | `status: "final"` | Reject; reload unchanged |
| **C20** | `declareDirNotApplicable` | `status: "superseded"` | Reject; reload unchanged |
| **C21** | `revokeDirNaDeclaration` | `status: "final"` (+ optional pre-existing action ids from a prior draft-then-freeze fixture) | Reject **before** mutation; reload unchanged (actions not newly revoked; version not bumped) |

Also assert missing-DC revoke reject if constructible without inventing new lifecycle (C21 sibling or note in report).

---

## 8. C24 — full CAS + post-freeze reload checklist (locked)

### 8.1 Chain (must execute)

```text
__resetPojuDbForTests → ensurePojuDbReady
  → createPOJUSession
  → mutatePOJUSession seed draft + E1 + SSOT-capable fact/DIR
  → declareDirNotApplicable          // production write
  → loadPOJUSession                  // C02-class persist proof
  → verify Action/Classification/Evidence on loaded session
  → reaggregateDirsIntake → DIR n_a  // C03
  → ensureSessionFrozenForDelivery   // production CAS freeze (not freezeDraft alone)
  → loadPOJUSession again            // post-freeze durable state
```

### 8.2 Post-freeze reload asserts

On **reloaded** session after ensure:

| Check | Assert |
|---|---|
| DC status | `final` |
| Target DIR | `current_state === "n_a"` |
| `decision_context_versions` | Contains snapshot with same `context_id` + `version` as frozen DC’s version row |
| `version_snapshot` vs frozen | Business equality for facts/constraints/dirs/conflicts/N/A classifications/evidence (and hash payload fields) |
| `content_hash` | Frozen DC `content_hash` set; equals binding `context_hash` |
| Binding | `context_id` / `context_version` / `context_hash` match frozen DC (`bindingFromDecisionContext` / pack.binding / `last_delivery_context_binding` if wire sets it) |
| N/A triad | Still present and consistent on frozen DC |
| Round-trip | Second load equals first post-freeze load on these fields |

**Hard rule:** `freezeDraftForDelivery` alone without `ensureSessionFrozenForDelivery` + reload ≠ C24 PASS.

---

## 9. C25 — CAS persist failure (locked)

1. Attempt real failure using **existing** CAS/IDB harness (patterns from na-cas / freeze-versioning) **without** new production fault-inject APIs.
2. If `declareDirNotApplicable` / ensure persist fails: assert caller-visible failure; no success outcome; no durable false N/A / false Freeze on reload.
3. If infeasible in locked toolchain → `UNTESTED [production-path] C25` with reason; **not** PASS.

---

## 10. Session CAS construction notes

Reuse na-cas polyfills (`fake-indexeddb/auto`, localStorage, crypto), `__resetPojuDbForTests`, `ensurePojuDbReady`, SSOT ACTIVE pair (`explicit_no_hard_red_lines` + registered DIR).

Pure `applyDeclareDirNaToSession` alone ≠ C02/C19–C21/C24 persist PASS.

---

## 11. C01–C25 matrix (summary)

New: `scripts/test-intake-r6-write-freeze-consistency.ts` + package script.

| ID | Entry / method | Expected |
|---|---|---|
| C01 | `declareDirNotApplicable` | Triad created; key fields §5 |
| C02 | `loadPOJUSession` | Triad durable |
| C03 | reaggregate on loaded | DIR `n_a` |
| C04 | Freeze compose on loaded | Frozen DIR `n_a` |
| C05 | pack `version_snapshot` | Matches frozen business |
| C06 | hash + binding | Match frozen |
| C07 | forged `dir_na_conditions` | Ignored / no illegal auth |
| C08 | bad DIR/condition | Write reject |
| C09 | §6 classification tampers | Not `n_a` |
| C10 | §6 evidence tampers | Not `n_a` |
| C11–C14 | revoke / flags / expiry | Not `n_a` |
| C15–C16 | bad / unconfirmed source | Reject or not `n_a` |
| C17–C18 | idempotent / binding clash | skip / reject |
| C19–C21 | §7 production + reload | Reject; unchanged |
| C22 | conflict + N/A | DIR `conflict` |
| C23 | forged `authority.dirCatalog` | Ignored |
| C24 | §8 full CAS | Final + snapshot/hash/binding |
| C25 | §9 | Fail-closed or **UNTESTED** |

---

## 12. File allowlist / denylist

### Allowlist

| Path | Change |
|---|---|
| `lib/poju/decision-context/na-declaration.ts` | **Required:** draft-only write; revoke fail-closed per §4.2 |
| `scripts/test-intake-r6-write-freeze-consistency.ts` | **Required** |
| `package.json` | **Required** script |
| `explicit-na-validate.ts` / `na-validation-from-session.ts` / `freeze-to-delivery.ts` | Only if proven defect blocks C09–C16/C23 |

### Denylist

Unchanged from Rev 1.0: Catalog SSOT content; S0–S3 rewrites; Resolver/CFP/Topic/Ask/Versioning/Sufficiency/Schema/C5; UI; Registry inject; S5; unrelated modules; PR merge; deploy.

---

## 13. Compatibility / UNTESTED

| Risk | Mitigation |
|---|---|
| Final-session N/A write/revoke callers | Fail-closed — intended |
| na-cas suite | Expect green on draft-only seeds |

| UNTESTED | When |
|---|---|
| C25 | Cannot trigger real persist fail without new inject API |
| Registry catalog fault runtime | Out of S4 |
| freeze-versioning F1 | Disclose RED until S5 |

---

## 14. Verification (when implement authorized)

```bash
node --version          # v22.22.0
corepack pnpm --version # 10.33.2

corepack pnpm test:intake-r6-write-freeze-consistency
corepack pnpm test:intake-r6-dir-catalog
corepack pnpm test:intake-r6-freeze-wire-reason
corepack pnpm test:intake-r6-na-cas
corepack pnpm exec tsc --noEmit
corepack pnpm test:intake-r6-freeze-versioning   # disclose F1 RED
```

Confirm S4 code commit: `git rev-parse HEAD^` === `0e09531c06840d373d8715426dec542c61130ebe`.

---

## 15. Acceptance criteria

1. S4 code on `feat/s4-dir-na-write-freeze-consistency` with parent **exactly** `0e09531c…`.
2. Write + revoke fail-closed per §4.1–§4.2 (missing DC and non-draft).
3. C09/C10 prove mismatched triad ⇒ DIR ≠ `n_a`.
4. C19–C21 use production entries + reload unchanged.
5. C24 full CAS + post-freeze reload checklist.
6. C25 PASS or explicit UNTESTED.
7. C01–C24 otherwise PASS; regressions green; F1 disclosed.
8. Diff ⊆ allowlist; no S5/PR/deploy; stop after S4.

---

## Stop Condition

This document is **plan-only** (Revision **1.1**).

No production or test implementation is authorized hereby.  
Do not start S5. Do not merge or deploy.  
Wait for independent plan review and **explicit written S4 implementation authorization**.

**PLAN ONLY — NOT AUTHORIZED FOR IMPLEMENTATION**
