# STAGE-3.2 S4 Implementation Plan

**S4 Implementation Plan — Plan Only — Not Authorized for Implementation**

| Field | Value |
|---|---|
| **Document status** | PLAN ONLY — no production/test implementation authorized by this document |
| **Revision** | **1.0** |
| **Stage** | Decision Intake 2.0 · Stage 3.2 · **S4** Write / Freeze Consistency |
| **Authoritative design** | [`STAGE-3.2-DIR-CATALOG-VERTICAL-SLICE-DESIGN.md`](./STAGE-3.2-DIR-CATALOG-VERTICAL-SLICE-DESIGN.md) Rev 1.3 · DC-10 / consistency |
| **S4 start / required parent** | `0e09531c06840d373d8715426dec542c61130ebe` (S3 implement tip; evidence-only commits after this are **not** S4 parents) |
| **S3 parent** | `9411c83f475605945874f87bb969db3ac1329ee9` |
| **Working branch** | `feat/s3-freeze-wire-reason-code` |
| **Toolchain** | Node `22.22.0` · `corepack pnpm` `10.33.2` |
| **S4 implement** | **NOT AUTHORIZED** until independent plan review PASS + separate written implement auth |

---

## 1. Objective

Prove production Write → CAS persist → DIR reaggregation → Freeze authoritative compose → Frozen version/hash/binding consistency for DIR N/A Catalog.

Does **not**: expand Catalog SSOT content; rewrite S0–S3; perform S5 F1–F4 isolation; merge/deploy.

---

## 2. S4 start commit and parent (locked)

| Item | SHA |
|---|---|
| **S4 Parent (hard)** | `0e09531c06840d373d8715426dec542c61130ebe` |
| Branch tip may include later **docs-only** evidence commits (`a8feda48`, `7d56641d`, `fd8cfd9b`, …) | Not production; **S4 code commit must still have parent = `0e09531c`** |

**Implement procedure (when authorized):**

```text
git checkout 0e09531c06840d373d8715426dec542c61130ebe
# apply S4 Diff → commit  → parent is 0e09531c
# push to feat/s3-freeze-wire-reason-code (or update tip without rewriting S3)
```

Do **not** rebase/rewrite S3. Do **not** make S4 parent an evidence commit.

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
**Note:** `input.dir_na_conditions` is already **ignored** for authorization (comment @ L535–536).

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
| Membership | `assertNaConditionInDirCatalog` via `membershipFromCatalogLoad` | via `NaValidationContext.dirCatalog` + validate |
| Client list | ignored | N/A |
| `authority.dirCatalog` | N/A | stripped / overwritten (S2) |

**S4-1 verdict (pre-implement):** Membership **semantics already unified** by S0–S2. S4 primarily **proves** with C07/C08/C23 (+ regression). Production rewrite of Catalog join **not** planned unless audit finds a regression.

---

## 4. Confirmed inconsistency → required production fix

### 4.1 Final/superseded writable (S4-2) — **must change**

**Site:** `applyDeclareDirNaToSession` ~L527–533

```ts
if (!dc || (dc.status !== "draft" && dc.status !== "final")) {
  throw new NaDeclarationError(NA_DECLARATION_CONTEXT_INVALID, "Decision Context missing");
}
```

Allows `final` into the write path. Freeze snapshot bind requires `draft`.

**Target:**

```ts
if (!dc) {
  throw new NaDeclarationError(NA_DECLARATION_CONTEXT_INVALID, "Decision Context missing");
}
if (dc.status !== "draft") {
  throw new NaDeclarationError(
    /* see §4.2 */,
    "Decision Context is not writable",
  );
}
```

- Reject **before** any Action/Classification/Evidence mutation.
- Covers `final`, `superseded`, and unknown statuses.

### 4.2 Error code choice

Existing codes only:

- `NA_DECLARATION_INVALID`
- `NA_DECLARATION_SOURCE_INVALID`
- `NA_DECLARATION_CONTEXT_INVALID`

**Plan default:** reuse `NA_DECLARATION_CONTEXT_INVALID` with message `"Decision Context is not writable"` (minimal surface).  
**Optional:** add `NA_DECLARATION_CONTEXT_NOT_WRITABLE` only if implement review prefers a distinct machine token — document in Diff if chosen.

### 4.3 Revoke on frozen DC (S4-2) — **must change**

**Site:** `revokeDirNaDeclaration` ~L804–859 — **no** DC status gate; mutates classifications/evidence and bumps `dc.version` on whatever status.

**Target (fail-closed; no new version lifecycle):**

- If `!dc` → current behavior may still mark actions revoked (review: prefer reject if no DC, or only action-list revoke without DC bump — **lock at implement:** if `dc` present and `status !== "draft"`, throw same not-writable error **before** mutation).
- If `dc.status !== "draft"` → throw; **no** in-place Final revoke.
- Do **not** invent Final→new-Draft supersede flow in S4.

### 4.4 What S4 does **not** rewrite (retain + prove)

| Area | Status @ `0e09531c` | S4 action |
|---|---|---|
| ACTIVE catalog write join | Present | Prove C07/C08 |
| Freeze ACTIVE load / ignore `dirCatalog` | S2 | Prove C23 |
| Action/Classification/Evidence creation bindings | Present in apply | Prove C01–C06, C09–C18 |
| Source binding / E1 | Present in validate + write | Prove C15–C16 |
| Idempotency | Present | Prove C17–C18 |
| Conflict > N/A in aggregator | Present | Prove C22 |
| Wire `reason_code` (S3) | Present | Regression only |

---

## 5. Action / Classification / Evidence consistency strategy (S4-3)

### 5.1 Production functions under test

| Step | Function |
|---|---|
| Write append | `applyDeclareDirNaToSession` / `declareDirNotApplicable` |
| Classification factory | `createExplicitNaClassificationFromUserDeclaration` |
| Evidence id | `na_ev_${declaration_action_id}` (existing convention) |
| Freeze validate | `validateExplicitNaEvidence` → `findValidatedDirLevelNa` |
| Match helpers | `findMatchingNaClassification` (as used by validate) |

### 5.2 Assertions (C01 / C09–C14)

After successful write (and again after `loadPOJUSession`):

1. Action fields bound server-side: `session_id`, `context_id`, `actor === "user"`, dir/condition/turn/source/expires/revoked/control.
2. Classification: `authority === "user_declared"`, `written_by === "code"`, IDs/dir/condition/turn/expires match action; `source_ref` compared by **kind + id fields**, not object identity.
3. Evidence: `evidence_type === "user_explicit_na"`, `target === "dir"`, `evidence_id === na_ev_*`, dir/condition/source/`written_by` match.
4. Tamper fixtures (memory or post-load mutate before freeze): mismatched action↔classification, action↔evidence, revoked action/classification/evidence, expired action → `findValidatedDirLevelNa` null / DIR ≠ `n_a` after reaggregate/freeze compose.

### 5.3 Source binding (S4-4 → C15–C16)

Reuse existing write validators + Freeze `validateUserSource` path:

- Fact/Constraint present, confirmed, `user_asserted`, `user_confirmed`, E1 present, `related_dir_ids` contains target DIR.
- Forbid independently_verified-as-user-NA, missing E1, unrelated DIR.

---

## 6. Session CAS integration construction (S4-8)

**Reuse:** `scripts/test-intake-r6-na-cas.ts` / freeze-versioning patterns:

- `import "fake-indexeddb/auto"`
- localStorage / crypto polyfills
- `__resetPojuDbForTests` + `ensurePojuDbReady`
- `createPOJUSession` → seed draft DC + confirmation events via `mutatePOJUSession`
- `declareDirNotApplicable` (not pure apply alone for “persist PASS”)
- `loadPOJUSession` round-trip
- `reaggregateDirsIntake` / sufficiency session → `ensureSessionFrozenForDelivery` **or** `freezeDraftForDelivery` where CAS freeze not required by case
- Second `loadPOJUSession` for frozen state

**SSOT pair:** production ACTIVE pair already used in na-cas (`explicit_no_hard_red_lines` + registered DIR) — do not forge Catalog.

**C25 CAS persist fail:** Prefer existing CAS conflict / write-fail harness from na-cas / freeze-versioning. If cannot force `!committed` without new production inject APIs → mark **`UNTESTED [production-path] C25`** (same discipline as S3 persist).

**Hard rule:** Pure `applyDeclareDirNaToSession` alone ≠ C02/C24 persist PASS. Pure `freezeDraftForDelivery` alone ≠ C24 CAS Freeze PASS.

---

## 7. C01–C25 implementation matrix

New script: `scripts/test-intake-r6-write-freeze-consistency.ts`  
Package: `"test:intake-r6-write-freeze-consistency": "tsx scripts/test-intake-r6-write-freeze-consistency.ts"`

| ID | How | Primary production surface | Expected |
|---|---|---|---|
| C01 | `declareDirNotApplicable` SSOT pair | write apply | Action+Classification+Evidence |
| C02 | `loadPOJUSession` after C01 | CAS | Three records durable |
| C03 | `reaggregateDirsIntake` on loaded DC | aggregator + validate | DIR `n_a` |
| C04 | `freezeDraftForDelivery` / ensure on loaded | Freeze compose | Frozen DIR still `n_a` |
| C05 | Inspect pack `version_snapshot` | freeze | Matches frozen DC business |
| C06 | content_hash + binding | freeze / binding helpers | Match |
| C07 | Pass forged `dir_na_conditions` on input | write | Still only SSOT; illegal combo reject if attempted |
| C08 | Unregistered DIR/condition | write | Reject; no append |
| C09 | After write, mutate classification binding in memory then freeze validate | validate | Not N/A |
| C10 | Mutate evidence binding | validate | Not N/A |
| C11 | `revokeDirNaDeclaration` then freeze path | revoke + validate | Not N/A |
| C12 | Classification revoked flag | validate | Not N/A |
| C13 | Evidence revoked | validate | Not N/A |
| C14 | Expired action/`nowIso` past expires | validate | Not N/A |
| C15 | Source missing / wrong DIR | write or validate | Reject / not N/A |
| C16 | Unconfirmed / missing E1 | write or validate | Reject / not N/A |
| C17 | Replay identical action | write | `idempotent_skip`; no dup |
| C18 | Same action_id different binding | write | Reject |
| C19 | Seed `final` DC; declare | applyDeclare** after S4-2** | Reject; Final unchanged |
| C20 | Seed `superseded` | apply | Reject |
| C21 | Final + revoke | revoke after S4-2 | Reject; Final not mutated |
| C22 | Open blocking conflict + valid N/A | aggregator | DIR `conflict` |
| C23 | `freezeDraftForDelivery(..., { authority: { dirCatalog: forged } })` | S2 compose | Forged ignored; SSOT only |
| C24 | Full chain create→declare→load→reagg→ensure→load | CAS + wire | Final DC / versions / hash / binding |
| C25 | Force CAS persist failure if feasible | mutate/CAS | Fail-closed; else **UNTESTED** |

Labels: print `PASS` / `FAIL` / `UNTESTED` explicitly; never equate UNTESTED with PASS.

---

## 8. File allowlist / denylist

### 8.1 Expected change allowlist

| Path | Likely change |
|---|---|
| `lib/poju/decision-context/na-declaration.ts` | **Required:** draft-only write gate; revoke draft-only fail-closed |
| `scripts/test-intake-r6-write-freeze-consistency.ts` | **Required:** new |
| `package.json` | **Required:** new script |
| `lib/poju/decision-context/explicit-na-validate.ts` | Only if audit finds binding gap blocking C09–C16 (prefer test-first; change only if defect proven) |
| `lib/poju/decision-context/na-validation-from-session.ts` | Same — only if proven defect |
| `lib/poju/decision-context/freeze-to-delivery.ts` | Prefer **no** change (S2 locked); only if S4 finds blocking defect |

### 8.2 Denylist

Catalog SSOT content; S0 loader structure (unless blocking + planned); S1/S2/S3 rewrites; Resolver priority redesign; CFP/Topic/Ask/Versioning/Sufficiency/Schema/C5; UI/Prompt/Report; Registry inject APIs; S5 F1–F4 work; unrelated modules.

---

## 9. Compatibility risks

| Risk | Mitigation |
|---|---|
| Callers that declared N/A on `final` sessions | Will start failing — **intended**; document as contract tighten |
| Revoke-on-final clients | Fail-closed; no silent no-op that looks like success |
| Existing na-cas tests seed only draft | Expect stay green; if any case used final write, update **only if** that case was wrong-by-design (prefer keep tests green without weakening S4 gate) |
| S3 Wire consumers | Untouched |

---

## 10. Known / expected UNTESTED

| Item | Condition |
|---|---|
| **C25** true CAS persist-fail → no success / no fake Freeze | If cannot trigger without new production inject API (same IDB/`deleteDatabase` limits as S3) |
| Runtime ACTIVE catalog Registry fault through Write/Freeze | Out of S4 (S0/S2 policy) |
| S5 F1–F4 / freeze-versioning F1 RED | Disclose only; do not “fix” in S4 |

---

## 11. Verification commands (when implement authorized)

```bash
node --version          # v22.22.0
corepack pnpm --version # 10.33.2

corepack pnpm test:intake-r6-write-freeze-consistency
corepack pnpm test:intake-r6-dir-catalog
corepack pnpm test:intake-r6-freeze-wire-reason
corepack pnpm test:intake-r6-na-cas          # if na-declaration changed
corepack pnpm exec tsc --noEmit
# disclose only:
corepack pnpm test:intake-r6-freeze-versioning   # expect F1 RED until S5
```

---

## 12. Acceptance criteria (implement phase)

1. Parent of S4 production Diff commit = `0e09531c06840d373d8715426dec542c61130ebe`.
2. Draft-only N/A write + revoke fail-closed on non-draft (C19–C21).
3. C01–C24 PASS (or documented UNTESTED only where plan allows); C25 PASS or UNTESTED.
4. Catalog membership remains ACTIVE-only; C07/C08/C23 PASS.
5. Full CAS happy path C02/C24 PASS (not pure-function substitutes).
6. S0–S3 regression green; F1 RED disclosed.
7. Diff ⊆ allowlist; no S5/PR/deploy.
8. Stop after S4; wait for independent review.

---

## Stop Condition

This document is **plan-only** (Revision **1.0**).

No production or test implementation is authorized hereby.  
Do not start S5. Do not merge or deploy.  
Wait for independent plan review and **explicit written S4 implementation authorization**.

**PLAN ONLY — NOT AUTHORIZED FOR IMPLEMENTATION**
