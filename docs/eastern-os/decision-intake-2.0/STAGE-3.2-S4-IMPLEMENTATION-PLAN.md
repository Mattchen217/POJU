# STAGE-3.2 S4 Implementation Plan

**S4 Implementation Plan — Plan Only — Not Authorized for Implementation**

| Field | Value |
|---|---|
| **Document status** | PLAN ONLY — no production/test implementation authorized by this document |
| **Revision** | **1.2** (C09e expires_at equality; C10a evidence_id binding; C21 missing-DC revoke mandatory) |
| **Rev 1.1 plan commit** | `484fdb2e628c0bc6056ff6999ccb4d20097705cc` |
| **Rev 1.0 plan commit** | `6944307c03e42c89c3916fd4971693af558a7537` |
| **Stage** | Decision Intake 2.0 · Stage 3.2 · **S4** Write / Freeze Consistency |
| **Authoritative design** | [`STAGE-3.2-DIR-CATALOG-VERTICAL-SLICE-DESIGN.md`](./STAGE-3.2-DIR-CATALOG-VERTICAL-SLICE-DESIGN.md) Rev 1.3 · DC-10 / consistency |
| **S4 start / required parent** | `0e09531c06840d373d8715426dec542c61130ebe` |
| **S3 parent** | `9411c83f475605945874f87bb969db3ac1329ee9` |
| **Docs / plan history branch** | `feat/s3-freeze-wire-reason-code` (may hold plan/evidence commits **after** `0e09531c`) |
| **S4 implement branch (locked)** | **`feat/s4-dir-na-write-freeze-consistency`** — created from `0e09531c` only |
| **Toolchain** | Node `22.22.0` · `corepack pnpm` `10.33.2` |
| **S4 implement** | **NOT AUTHORIZED** until independent plan review PASS + separate written implement auth |

### Revision history

| Rev | Against | Resolutions |
|---|---|---|
| **1.1** | `6944307c` | Revoke fail-closed; independent S4 branch; C09/C10/C19–C21/C24/C25 locks |
| **1.2** | `484fdb2e` | **C09e** production must equate `expires_at` (not only “both not expired”); **C10a** production must bind `evidence_id === na_ev_${action_id}`; **C21b** missing-DC revoke **mandatory** |

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

Plan-doc commits (including Rev 1.1 / 1.2) may continue on `feat/s3-freeze-wire-reason-code`. They are **not** S4 production parents.

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
| `expires_at` | **Must equal** `action.expires_at` (see §6.1 C09e — **production gap today**) |
| `revoked` | consistent with live authorization (false when authorizing) |

### 5.3 `ExplicitNaEvidence` (user_explicit_na / dir) ↔ Action

| Evidence field | Must equal |
|---|---|
| `evidence_type` | `"user_explicit_na"` |
| `target` | `"dir"` |
| `evidence_id` | **Must equal** `` `na_ev_${action.declaration_action_id}` `` (see §6.2 C10a — **production gap today**) |
| `dir_id` | `action.dir_id` |
| `na_condition_code` | `action.na_condition_code` |
| `source_ref` | `sourceRefEquals(action.source_ref)` |
| `written_by` | `"code"` |
| `revoked` | `false` when authorizing |

Validate path: `validateExplicitNaEvidence` → `findMatchingNaClassification` → live Action; then `findValidatedDirLevelNa` / `reaggregateDirsIntake`.

---

## 6. C09 / C10 tamper fixtures + production gaps (locked · Rev 1.2)

**Setup:** Complete legal write (C01) so DIR would otherwise be `n_a`. Then **tamper only** the named binding while keeping other records present. Run production validation path: `buildFreezeNaValidationFromSession` / `validateExplicitNaEvidence` → `findMatchingNaClassification` / `findValidatedDirLevelNa` → `reaggregateDirsIntake` (and/or freeze compose when snapshot still valid).

**Hard pass criterion:** mismatched triad ⇒ `findValidatedDirLevelNa` returns **null**; target DIR **`current_state !== "n_a"`**.

### 6.1 C09e — Classification / Action `expires_at` equality (**production gap**)

**Gap @ `0e09531c` (`findMatchingNaClassification` ~L175–194):**  
Classification and Action each run `checkExpiresAt(..., now)` independently. A row survives if **both are not expired** (and not invalid). There is **no** comparison requiring:

```ts
classification.expires_at === action.expires_at
// (null/null equal; otherwise exact ISO string equality as stored)
```

Therefore today a Classification with `expires_at = T1` and Action with `expires_at = T2` (both future) can still match and authorize N/A — **inconsistent with S4 triad binding**.

**Required production fix (S4):** In `findMatchingNaClassification` (or immediate helper used only from that path), after Action is resolved and before `return row`, fail-closed unless Classification `expires_at` equals Action `expires_at`. On mismatch: skip/continue (no match) ⇒ `findValidatedDirLevelNa` → null ⇒ DIR must not become `n_a`.

**Allowlist:** `lib/poju/decision-context/explicit-na-validate.ts` is **required** for this fix (not optional).

**C09e fixture (mandatory shape):**

| Constraint | Value |
|---|---|
| Action `expires_at` | Future ISO `T_action` (e.g. `NOW + 30d`) — **not expired** |
| Classification `expires_at` | Different future ISO `T_cls` (e.g. `NOW + 60d`) — **also not expired** |
| All other binding fields | Legal / matching |
| Forbidden | Using an already-expired Classification or Action as the sole C09e proof |

Expected: validate fails; `findValidatedDirLevelNa` null; DIR ≠ `n_a`.

### 6.2 C10a — Evidence ID ↔ Action ID (**production gap**)

**Gap @ `0e09531c`:**  
`validateUserSource` / `findMatchingNaClassification` / `findValidatedDirLevelNa` **never** assert:

```ts
evidence.evidence_id === `na_ev_${action.declaration_action_id}`
```

(write creates that id by convention, but validate does not enforce it.)

**Required production fix (S4):** After a matching Classification/Action is found (or as part of `validateUserSource` once Action is known), reject unless Evidence ID equals ``na_ev_${action.declaration_action_id}``. Preferred site: `validateUserSource` in `explicit-na-validate.ts` immediately after `findMatchingNaClassification` succeeds (Action id available via `classification.declaration_action_id`), or inside `findMatchingNaClassification` if evidence is in scope — **document exact function in Diff**. On mismatch: `{ ok: false, reason_code: ... }` / no validated evidence ⇒ DIR must not become `n_a`.

**Allowlist:** `lib/poju/decision-context/explicit-na-validate.ts` **required**.

**C10a fixture (mandatory shape):**

| Constraint | Value |
|---|---|
| Tamper | **Only** `evidence.evidence_id` changed (e.g. `na_ev_WRONG` or `na_ev_${other_id}`) |
| All other Evidence fields | Remain legal (`user_explicit_na`, `target: "dir"`, dir/condition/`source_ref`/`written_by`/`revoked` match Action) |
| Classification + Action | Untouched and consistent |
| Path | Production validate → reaggregate (not a pure unit stub of a helper alone as sole PASS) |

Expected: validation failure; DIR ≠ `n_a`.

### 6.3 Other C09 / C10 cases

| Case | Tamper | Expected |
|---|---|---|
| **C09a** | Classification `declaration_action_id` ≠ Action id | null / DIR ≠ `n_a` |
| **C09b** | Classification `dir_id` or `na_condition_code` ≠ Action | same |
| **C09c** | Classification `source_ref` ≠ Action (`sourceRefEquals` false) | same |
| **C09d** | Classification `context_id` or `declaration_turn_id` ≠ Action | same |
| **C09e** | §6.1 — both unexpired, `expires_at` unequal | same + production equality check |
| **C10a** | §6.2 — only `evidence_id` wrong | same + production id bind check |
| **C10b** | Evidence `dir_id` / `na_condition_code` ≠ Action | same |
| **C10c** | Evidence `source_ref` ≠ Action | same |
| **C10d** | Evidence `target` ≠ `"dir"` or type ≠ `user_explicit_na` | same |

---

## 7. C19 / C20 / C21 — production entry + reload (locked · Rev 1.2)

**Forbidden substitute:** calling only `applyDeclareDirNaToSession` / in-memory revoke apply without `declareDirNotApplicable` / `revokeDirNaDeclaration`.

### Shared method

1. `createPOJUSession` + CAS-seed with baseline snapshot of: `na_declaration_actions`, `explicit_na_classifications`, `explicit_na_evidence`, `dc` (if any: `version`, `status`, dirs, hash), and other business fields under test.
2. Invoke **production** entry (`declareDirNotApplicable` or `revokeDirNaDeclaration`).
3. Expect throw / fail-closed (not silent success).
4. `loadPOJUSession(sessionId)` again.
5. Assert **byte-stable business equality** vs baseline: actions, classifications, evidence, DC fields (when DC present), **no** Action newly marked `revoked`, **no** partial business mutation.

| ID | Entry | Seed | Expected |
|---|---|---|---|
| **C19** | `declareDirNotApplicable` | `status: "final"` | Reject; reload unchanged |
| **C20** | `declareDirNotApplicable` | `status: "superseded"` | Reject; reload unchanged |
| **C21a** | `revokeDirNaDeclaration` | `status: "final"` (may include prior action ids from draft-then-freeze fixture) | Reject **before** mutation; reload unchanged (actions not newly revoked; version not bumped) |
| **C21b** (**mandatory**) | `revokeDirNaDeclaration` | Session with **`decision_context == null`** (missing DC); may still have `na_declaration_actions` seeded for observation | Reject; **Action not marked revoked**; no partial business mutation; reload equals pre-op baseline |

**C21b construction:** CAS-seed session with null/absent DC via `mutatePOJUSession` (existing session manager patterns). Do **not** invent Final→Draft lifecycle. If seeding actions without DC, baseline must still prove actions unchanged after rejected revoke.

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
| C09a–d | §6.3 classification tampers | Not `n_a` |
| C09e | §6.1 unexpired unequal `expires_at` | Not `n_a` (prod equality) |
| C10a | §6.2 evidence_id only wrong | Not `n_a` (prod id bind) |
| C10b–d | §6.3 evidence tampers | Not `n_a` |
| C11–C14 | revoke / flags / expiry | Not `n_a` |
| C15–C16 | bad / unconfirmed source | Reject or not `n_a` |
| C17–C18 | idempotent / binding clash | skip / reject |
| C19–C21a | §7 final/superseded | Reject; unchanged |
| C21b | §7 missing DC revoke | Reject; actions not revoked; reload stable |
| C22 | conflict + N/A | DIR `conflict` |
| C23 | forged `authority.dirCatalog` | Ignored |
| C24 | §8 full CAS | Final + snapshot/hash/binding |
| C25 | §9 | Fail-closed or **UNTESTED** |

---

## 12. File allowlist / denylist

### Allowlist

| Path | Change |
|---|---|
| `lib/poju/decision-context/na-declaration.ts` | **Required:** draft-only write; revoke fail-closed per §4.2 (incl. missing DC) |
| `lib/poju/decision-context/explicit-na-validate.ts` | **Required (Rev 1.2):** C09e `expires_at` equality in `findMatchingNaClassification`; C10a `evidence_id === na_ev_${action_id}` in validate path |
| `scripts/test-intake-r6-write-freeze-consistency.ts` | **Required** |
| `package.json` | **Required** script |
| `na-validation-from-session.ts` / `freeze-to-delivery.ts` | Only if proven defect blocks C09–C16/C23 beyond §6.1–§6.2 |

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
3. Production validate enforces C09e `expires_at` equality and C10a evidence_id bind; tests prove DIR ≠ `n_a`.
4. C19 / C20 / C21a / **C21b (missing DC revoke)** use production entries + reload unchanged.
5. C24 full CAS + post-freeze reload checklist.
6. C25 PASS or explicit UNTESTED.
7. C01–C24 otherwise PASS; regressions green; F1 disclosed.
8. Diff ⊆ allowlist; no S5/PR/deploy; stop after S4.

---

## Stop Condition

This document is **plan-only** (Revision **1.2**).

No production or test implementation is authorized hereby.  
Do not start S5. Do not merge or deploy.  
Wait for independent plan review and **explicit written S4 implementation authorization**.

**PLAN ONLY — NOT AUTHORIZED FOR IMPLEMENTATION**
