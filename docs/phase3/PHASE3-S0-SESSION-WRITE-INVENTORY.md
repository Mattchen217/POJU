# PHASE3-S0-SESSION-WRITE-INVENTORY

> Phase 3 S0 — read-only inventory. No business code. No S1.
>
> Authority: Final Engineering Contract (23 sections, highest) + Locked Final Implementation Mapping §2 (`/workspace/eos-w0-sot/PHASE3-FINAL-IMPLEMENTATION-MAPPING-2026-11-03.md`). Superseded: canvas 5b14cc07 v2, `PHASE3-FINAL-ENG-CONTRACT-IMPL-MAPPING-*`, v1.x design, old IMPL-DESIGN.

## Baseline verification

| Field | Value |
|-------|-------|
| Repo checkout | `D:\POJU\pojulife` (machineId `b3537b32-10d8-49f4-b56f-2f2b4cbdfa4e`) |
| Branch | `feat/decision-context-phase1` |
| HEAD SHA | `96cf819d26bbbb7a1eb174848fb0366c1eebfe9f` |
| Required baseline | `96cf819d26bbbb7a1eb174848fb0366c1eebfe9f` |
| HEAD == baseline? | **YES** |
| Ahead / behind vs baseline | `0 / 0` (`git rev-list --left-right --count baseline...HEAD`) |
| Tracking | `origin/feat/decision-context-phase1` (clean vs origin for tracked files; untracked `temp/*.cjs` present, ignored for inventory) |
| Tip subject | `fix(decision-context): scope persist idempotency by session_id` |
| Inventory tree | Working tree HEAD == baseline; inventory describes that tree |
| Mapping SoT used | Box `/workspace/eos-w0-sot/PHASE3-FINAL-IMPLEMENTATION-MAPPING-2026-11-03.md` §2 |
| Windows SoT folder note | `D:\POJU\eos-w0-sot\` has only `IMPL-DESIGN-STAGE1-3-DC-2026-11-02.md` (superseded); locked mapping lives on box |

Search method @ baseline: `git grep` over `*.ts`/`*.tsx`/`*.js`/`*.jsx`/`*.mjs`/`*.cjs` for `encrypted_data`, `pojuSessionRecords.(put|update|add)`, `savePOJUSession`, `savePOJUSessionCore`, `createPOJUSession`, `commitDecisionContextChange`, `confirmSessionAfterCorePersist`, `extendPOJUV4Session`, plus call-chain reads of `session-manager.ts`, `v4-lifecycle.ts`, `poju-session-vault.ts`, phase2 IDB test.

---

## 0. Write primitive map (Mapping §2.2 W1–W6)

Target table field: **`pojuSessionRecords.encrypted_data`**.

| ID | Entry | Path | Mutates `encrypted_data`? | Final DB write | Tx boundary today | Proposed S1 mode (per Mapping) | Tests |
|----|-------|------|---------------------------|----------------|-------------------|--------------------------------|-------|
| **W1** | `createPOJUSession` | `lib/poju/session-manager.ts` (~L118) | **YES** (initial put) | `db.pojuSessionRecords.put({… encrypted_data, iv, …})` | **No** Dexie multi-table tx around put; then `syncSessionCyclesToDb` outside; vault archive post-create try/catch | **create-if-absent** exception; init dual revision `0`; keep sole create path | Needed: create-absent / create-conflict; existing indirect via payment-success / hydrate / finalize / POJUChatUI |
| **W2** | `savePOJUSessionCore` | `lib/poju/session-manager.ts` (~L238) | **YES** (sole production update of blob) | `db.pojuSessionRecords.update(session_id, { encrypted_data, iv, original_question, …index fields })` then `syncSessionCyclesToDbWithDb` | Prefer `db.transaction("rw", POJU_SESSION_CORE_TABLES, run)` where `POJU_SESSION_CORE_TABLES = ["pojuSessionRecords","poju_cycles","poju_tool_suggestions"]`; else sequential. **No CAS / revision check today** | **Migrate to unified `casWrite`**; business must not call raw update | `scripts/test-decision-context-phase2-idb.ts` (uses Core); unit inject `writeCore` in phase2 tests; **need** CAS conflict / mirror tests in S1 |
| **W3** | `extendPOJUV4Session` | `lib/poju/session-manager.ts` (~L465) | **YES** (indirect) | (1) `pojuSessionRecords.update` **metadata only**: `expires_at`, `last_interaction_at`, `renewals` — **does NOT set `encrypted_data`**; (2) then `savePOJUSession(next)` → W2 blob write with new `expires_at` in state | Two separate writes: metadata update **outside** Core tx; blob via W2 tx. Not one atomic unit today | Metadata vs blob must keep **correct separate atomicity boundaries**; blob half must go through CAS; do not fold renewals into blob-less bypass | Needed: extend dual-write / CAS failure after metadata; caller: `payment-success/page.tsx` |
| **W4** | `commitDecisionContextChange` | `lib/poju/session-manager.ts` (~L344) | **YES** (indirect via `writeCore`) | Defaults `writeCore = savePOJUSessionCore` (W2) inside `commitPersistTransaction` | DC persist tx (in-memory) then Core Dexie tx; post-commit side effects non-rolling-back | Final path through **unified CAS** / mutate API | `scripts/test-decision-context-phase2.ts` (many); `phase2-idb.ts` |
| **W5** | `savePOJUSession` + wrappers | `session-manager.ts` `savePOJUSession` (~L302); `confirmSessionAfterCorePersist` (~L430) | **YES** (always → W2) | `savePOJUSession` = Core then `runPOJUSessionPostCommitSideEffects`; `confirmSessionAfterCorePersist` = Core → adopt memory → side effects | Same as W2 for blob; side effects (archive vault / profile sync) **after** commit | All migrate to **`mutatePOJUSession` / casWrite**; ban direct Core from product UI except create | Covered indirectly by product flows + phase2 confirm test; need S1 mutate API tests |
| **W6** | Other direct `put`/`update` on `pojuSessionRecords` | See §2 / §3 | Mix — see rows | Direct Dexie | Varies | **Forbid bypass** of unified write for blob; non-blob column updates stay out of Session CAS | Test fixture W6a must obey CAS semantics |

### W6 direct Dexie sites on `pojuSessionRecords` (full-repo)

| ID | Path + function | Mutates blob? | What it writes | Callers | Proposed S1 | Tests |
|----|-----------------|---------------|----------------|---------|-------------|-------|
| W6a | `scripts/test-decision-context-phase2-idb.ts` seed `put` (~L142) | **YES** (test fixture) | Full row incl. `encrypted_data` | Test harness only | Test fixture may init, but **must obey CAS semantics** for subsequent writes; cannot prove atomicity by bypassing formal tx | This file itself |
| W6b | `lib/poju/v4-lifecycle.ts` `runPOJUV4SessionMaintenance` | **NO** | `update({ status: "archived" })` | Maintenance | **Must NOT write blob**; leave status-only | Existing lifecycle usage; need assert no encrypted_data |
| W6c | `lib/poju/v4-lifecycle.ts` `restorePOJUV4ArchivedSession` | **Partial** | First `update({ status, expires_at, last_interaction_at, renewals })` **no blob**; then may `savePOJUSession` → W2 | Restore UX | Status/renewals non-CAS metadata; blob path → CAS | Needed |
| W6d | `lib/poju/v4-lifecycle.ts` `setPOJUV4SessionStatus` | **NO** | `update({ status })` | Status UI | **Must NOT write blob** | Needed assert |
| W6e | `lib/poju/v4-lifecycle.ts` `markPOJUV4SessionResolved` | **NO** (live row) | Copies ciphertext to `pojuSessionArchive` (other table), then `update({ status: "resolved" })` | Resolve UX | Archive copy out of Session CAS; status-only on live row | Needed |
| W6f | `lib/archive/poju-session-vault.ts` `renamePojuSessionHistory` fallback | **NO** | When `loadPOJUSession` fails: `update({ original_question })` only | Rename when decrypt/load fails | **Must NOT write blob**; happy path uses `savePOJUSession` → W2 | Needed |
| W6g | `lib/poju/session-manager.ts` `extendPOJUV4Session` metadata `update` | **NO** (that statement) | renewals / expires / last_interaction | Same as W3 | Counted under W3; keep non-blob | — |
| W6h | `lib/poju/session-manager.ts` `deletePOJUSession` | N/A (delete) | `delete(sessionId)` | vault `deletePojuSessionHistory` | Out of CAS write scope (delete policy not invent here) | — |

No other production `pojuSessionRecords.put` / `update` of `encrypted_data` found beyond W1, W2, and W6a test put.

---

## 1. Indirect blob writers (all terminate at W2 unless noted)

Convention for each entry:
- **Reads?** — loads session before mutate
- **Mutates blob?** — yes if final path writes `encrypted_data`
- **Final DB write** — always `savePOJUSessionCore` → `pojuSessionRecords.update` unless create (W1)
- **Tx** — W2 Core tables tx (when Dexie available)
- **S1 mode** — migrate call site to `mutatePOJUSession` / casWrite (Mapping: business禁止直写 encrypted_data)

### 1.1 Mapping seed call chains (required checklist)

| # | Path | Function / sites | Callers | Reads? | Mutates blob? | Final write | Tx | S1 mode | Tests |
|---|------|------------------|---------|--------|---------------|-------------|-----|---------|-------|
| A1 | `components/poju/POJUChatUI.tsx` | ~55× `savePOJUSession`; **1× direct `savePOJUSessionCore`** (~L2058 rename via `confirmSessionAfterCorePersist` path / Core); `createPOJUSession` (~L2122) | Chat UI root | Y | Y | W2 / W1 create | W2 / W1 | Migrate all saves to mutate/CAS; keep create exception; remove/replace direct Core with mutate | Manual + segment2 pending tests; **need** CAS UI tests |
| A2 | `components/poju/JointSessionOpenHost.tsx` | `savePOJUSession` ×2 (~L452, L522) | Joint open host | Y | Y | W2 | W2 | mutate/CAS | Needed |
| A3 | `components/poju/DeliveryShelfView.tsx` | `savePOJUSession` ×2 (~L155, L233) | Delivery shelf | Y | Y | W2 | W2 | mutate/CAS | Needed |
| A4 | `components/poju/PreviewMatrixPreparing.tsx` | `savePOJUSession` ×1 (~L52) | Preview preparing | Y | Y | W2 | W2 | mutate/CAS | Needed |
| A5 | `components/poju/UnlockBaziPreparing.tsx` | `savePOJUSession` ×1 (~L90) | Unlock preparing | Y | Y | W2 | W2 | mutate/CAS | Needed |
| A6 | `components/workspace/WorkspaceUnlockRitual.tsx` | `savePOJUSession` ×3 (~L119, L148, L268) | Unlock ritual | Y | Y | W2 | W2 | mutate/CAS | Needed |
| A7 | `components/workspace/WorkspaceRailBaseAnalysis.tsx` | `savePOJUSession` ×1 (~L138) | Rail base analysis | Y | Y | W2 | W2 | mutate/CAS | Needed |
| A8 | `components/workspace/WorkspacePojuChatStage.tsx` | Comment only — persist owned by POJUChatUI | — | N | **N** (no write) | — | — | Keep no-write | Comment contract |
| A9 | `app/.../poju/payment-success/page.tsx` | `savePOJUSession` ×2; `createPOJUSession` ×1; `extendPOJUV4Session` import/use | Payment success | Y | Y | W1/W2/W3 | per W | mutate + create exception + extend boundaries | Needed |
| A10 | `app/.../poju/session/[sessionId]/page.tsx` | `savePOJUSession` ×4 (~L67,80,92,107) | Session page | Y | Y | W2 | W2 | mutate/CAS | Needed |
| A11 | `app/.../poju/session/[sessionId]/prepare/page.tsx` | `savePOJUSession` ×1 (~L81) | Prepare page | Y | Y | W2 | W2 | mutate/CAS | Needed |
| A12 | `app/.../poju/session/[sessionId]/preparing/page.tsx` | `savePOJUSession` ×3 (~L87,155,167) | Preparing page | Y | Y | W2 | W2 | mutate/CAS | Needed |
| A13 | `lib/poju/hydrate-joint-session.ts` | `savePOJUSession` ×2; `createPOJUSession` ×1 | Joint hydrate | Y | Y | W1/W2 | per W | mutate + create | Needed |
| A14 | `lib/poju/finalize-workspace-prepare.ts` | `createPOJUSession` ×1; `savePOJUSession` ×1 | Workspace finalize | Y | Y | W1/W2 | per W | mutate + create | Needed |
| A15 | `lib/poju/inject-tool-result.ts` | `savePOJUSession` ×1 (~L20) | Tool inject | Y | Y | W2 | W2 | mutate/CAS | Needed |
| A16 | `lib/poju/phases/delivery/control.ts` | `savePOJUSession` ×1 (~L204) | Delivery control | Y | Y | W2 | W2 | mutate/CAS | Needed |
| A17 | `lib/companion/drip-advance.ts` | `savePOJUSession` ×1 (~L207) | Drip advance | Y | Y | W2 | W2 | mutate/CAS | Needed |
| A18 | `lib/llm/pro/final-delivery.ts` | `savePOJUSession` ×9 sites | Final delivery flows | Y | Y | W2 | W2 | mutate/CAS | Existing delivery scripts; need CAS |
| A19 | `lib/poju/v4-lifecycle.ts` | `restore…` → `savePOJUSession` (blob); other status updates **no blob** | Lifecycle | Y on restore | Restore: Y; status helpers: N | W2 / W6b–e | Mixed | Blob→CAS; status **must NOT write blob** | Needed |
| A20 | `lib/archive/poju-session-vault.ts` | Happy rename → `savePOJUSession`; fallback column update **no blob**; `syncPojuSessionVaultArchive` writes **`archive` table** not session blob | Vault | Y | Happy: Y; fallback: N; sync: other table | W2 / W6f / out-of-scope | Mixed | Happy→CAS; fallback no blob; archive out of Session CAS | Needed |

### 1.2 DC / confirm wrappers (W4 / W5)

| Path | Function | Callers | Reads? | Mutates blob? | Final | Tx | S1 | Tests |
|------|----------|---------|--------|---------------|-------|-----|-----|-------|
| `lib/poju/session-manager.ts` | `commitDecisionContextChange` | **Only** `scripts/test-decision-context-phase2.ts` today (product Opening/Gate/CallA/CallB **not** wired yet — comment in source) | Uses in-memory session snapshot | Y via writeCore | W2 | DC then Core | Unified CAS | phase2 unit + idb |
| `lib/poju/session-manager.ts` | `confirmSessionAfterCorePersist` | `POJUChatUI` rename path; phase2 test | Caller supplies state | Y | W2 | W2 | mutate/CAS adopt pattern | phase2 test |
| `lib/poju/decision-context/persist.ts` | `commitPersistTransaction` | Via W4 | Working slice | Indirect (callback writeCore) | Injected | In-memory + callback | Keep; writer must be CAS | phase2 |

### 1.3 Explicit non–Session-CAS `encrypted_data` (do not fold into Session CAS)

Per Mapping §2.2: index fields, Archive, Profile, other tables are **out of Session CAS**.

| Path | Table | Note |
|------|-------|------|
| `lib/archive/archive-service.ts` | `archive` | Own vault cipher |
| `lib/archive/poju-session-vault.ts` `syncPojuSessionVaultArchive` | `archive` | Post-commit side effect from W5 |
| `lib/profile/stored-profiles-service.ts` | `stored_profiles` | Profile blob |
| `lib/poju/v4-lifecycle.ts` `copyRowToArchive` | `pojuSessionArchive` | Copies existing ciphertext bytes; not a live-session CAS write |
| `legacy/match`, `legacy/syncro` | legacy tables | Out of Phase3 Session CAS |
| `lib/db/poju-db.ts` | schema only | Type defs |

---

## 2. Counts vs Mapping seed

| Bucket | Count |
|--------|------:|
| Mapping W1–W6 primitives | **6** (W1–W5 + W6 class) |
| W6 concrete Dexie sites (a–h) | **8** |
| Mapping-required call-chain modules (A1–A20) | **20** (A8 is documented no-write) |
| Production files that invoke `savePOJUSession` / Core / create (excl. tests/comments) | **18** files |
| Approximate invoke sites (`await`/`void` save\|Core\|create\|commit\|confirm\|extend\|direct put/update) | **~100+** across UI/lib (POJUChatUI alone ~55+ saves) |
| Seed coverage | Seed list **found and traced**; full-repo search added W6a test put + status/column non-blob updates + confirmSessionAfterCorePersist + delete |
| Extra beyond seed names | `confirmSessionAfterCorePersist`, `WorkspaceRailBaseAnalysis`, `WorkspacePojuChatStage` (no-write), `deletePOJUSession`, phase2 IDB fixture put, synthesis/final-delivery **not** session writers (job-only — see Job inventory) |

---

## 3. Contract / Mapping technical conflicts (location + options only; no new policy)

| # | Location | Observation | Minimal options (not deciding policy) |
|---|----------|-------------|----------------------------------------|
| C1 | W3 `extendPOJUV4Session` | **CLOSED (rem)**: renewals + blob expires share one Dexie CAS `update` via `append_renewal` (not a second write authority). Pre-rem: metadata then separate save. | Rem chose fold into existing CAS write (same row). Tests P3-136 (encrypt fail → no renewals advance), P3-137 (mid-txn fail → both roll back), P3-138 (legacy renewals-missing recovery). |
| C2 | W1 `createPOJUSession` | `put` then cycle sync then vault — not create-if-absent / dual-revision yet | Implement Mapping create-if-absent + rev init in S1 |
| C3 | W2 | `update` returns count≠1 throws, but **no revision CAS** | S1 casWrite |
| C4 | POJUChatUI direct Core | Product path calls `savePOJUSessionCore` for rename | Route through mutate/CAS only |
| C5 | Vault rename fallback | Writes `original_question` column without blob when load fails → plaintext index can diverge from undecryptable blob | Keep as non-blob; or fail closed — **Contract/Mapping do not specify**; flag for Max/Grok |
| C6 | `commitDecisionContextChange` unused by product | Phase2 C1 entry exists; Opening/CallA/CallB not wired | Expected for S0; S3/S4 wiring later — not a conflict |
| C7 | Dual revision fields | Absent on `POJUSessionRecord` / session state today | S1 schema add per Mapping §3 — inventory only notes absence |

---

## 4. S0 Session-write gate checklist

- [x] Baseline HEAD == `96cf819d…`
- [x] Full-repo search beyond `savePOJUSessionCore`
- [x] W1–W6 + seed call chains recorded with required fields
- [x] Non-blob updates explicitly excluded from Session CAS
- [ ] **Awaiting Max/Grok S0 验收** before S1

---

*Generated 2026-11-03 America/Chicago · S0 inventory only*
