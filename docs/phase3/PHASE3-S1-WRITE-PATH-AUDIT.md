# PHASE3-S1-WRITE-PATH-AUDIT

> Phase 3 S1 — Session CAS Foundation write-path audit vs S0 W1–W6.
> Authority: Final Engineering Contract §3 + §7. Stage confirmation: Grok. Merge/Prod: Max-only.

## HEAD

See git log at acceptance time.

## W1–W6

| ID | Entry | S1 status | Notes |
|----|-------|-----------|-------|
| **W1** | `createPOJUSession` | **Migrated** | `createPOJUSessionRecordIfAbsent`; dual rev init `0`; refuses overwrite (`SESSION_CREATE_EXISTS`). |
| **W2** | `savePOJUSessionCore` | **Migrated** | Thin wrapper → `casWritePOJUSessionFromCandidate` → `casWritePOJUSession` (§7.5 encrypt-outside-tx). |
| **W3** | `extendPOJUV4Session` | **Closed C1 (rem)** | Renewals folded into the **same Dexie CAS update** as `encrypted_data` / expires mirrors via `mutatePOJUSession.append_renewal` → `casWritePOJUSession`. No second Session write authority. Honest claim: **row-atomic** (one `update()`), not a cross-store distributed txn. |
| **W4** | `commitDecisionContextChange` | **Migrated** | Still uses `writeCore` defaulting to Core → CAS; `bump_dc: auto` bumps `dc_write_revision` only when formal DC content changes. |
| **W5** | `savePOJUSession` / `confirmSessionAfterCorePersist` | **Migrated** | No second write impl; both terminate at W2 CAS. |
| **W6a** | phase2-idb fixture put | **Migrated** | Seed via `createPOJUSessionRecordIfAbsent`; subsequent writes through Core/CAS. |
| **W6b–e** | v4-lifecycle status/archive | **Deferred (non-blob)** | Status/renewals/archive-copy do not write `encrypted_data`; restore blob path already → `savePOJUSession` → CAS. |
| **W6f** | vault rename fallback | **Deferred (open C5)** | Non-blob `original_question` column update when load fails — Contract/Mapping unspecified; flagged, not invented. |
| **W6g** | extend metadata | Counted under W3 | |
| **W6h** | `deletePOJUSession` | Out of CAS write scope | |

## Call-site note (A1 POJUChatUI)

Direct `savePOJUSessionCore` / post-commit pair on rename non-active branch replaced with `savePOJUSession` (CAS). Active branch keeps `confirmSessionAfterCorePersist` → CAS.

Bulk `savePOJUSession(~55)` call sites remain API-compatible; they now hit unified CAS via W2 wrapper. Prefer gradual `mutatePOJUSession` adoption for concurrent patches (Contract §7.7); not blocking S1 gate while Core is CAS.

## Ambiguities refused (for Grok)

1. **C1** extend metadata vs blob — **closed (rem)**: unified CAS `append_renewal` (same Dexie update). Tests P3-136/137/138.
2. **C5** vault rename plaintext fallback divergence — flagged only.
3. **J4 / Generation** — out of S1 scope (S2).
4. Whole-UI migrate to `mutatePOJUSession` for every chat save — Core CAS bridge accepted for S1; full mutate migration can continue without new write primitives.
