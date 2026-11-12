# M4.1 — Freeze commit recovery and strict Freeze ledger anchor

This is an evidence record for the production change on `feat/m1-r-fresh-session-main-loop`. It does not declare the product PASS.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Baseline (GitHub branch HEAD before M4.1, M4 evidence tip): `785f7be296bab02c14573d018912e83ef9ba833a`
- Implementation SHA (all checks below ran on this commit): `f1be9ec1723db8935eae3d0fc268aa12a599deb0`
- Evidence tip SHA: _(this commit; left for independent review)_
- No PR opened. Not merged into `main`, not rebased. Nothing deployed or promoted. No force-push.

**What this evidence is not.** No real OpenRouter call, no model output and no browser run were executed. The `/api/poju/decision-authority` route was not called over real HTTP, and Upstash Redis was not used. Every device-side check below runs in one Node process: the device code runs against `fake-indexeddb`, and the server runs in-process against the process-memory KV.

## 0. Problem and reproduction on the baseline

Scenario: the server accepted the Freeze (ledger head = `freeze`, Freeze record and receipt written, profile possibly registered), but the device's C1 `commitDecisionContextChange` write failed. The device still holds the V1 draft, the old ledger mirror and no receipts.

Reproduced on `785f7be2` with a one-off probe. The probe runs the production `ensureSessionFrozenForDelivery` with the C1 IndexedDB write aborted, then retries the wire. The probe was not committed.

- **The basic retry already worked on the baseline.** The device mirror was still the draft commit, so the retry re-sent `freeze` with the same `expected` anchor. The M4 seal path then answered `duplicate` from the existing Freeze record. M4.1 does not claim to fix this case. It makes the path explicit, token-checked and strictly verified.
- **Gaps that were real on the baseline:**
  1. Any other DC write on the device (e.g. a late answer through `mutatePOJUSession`) hit the frozen server head and failed as a generic `DC_LEDGER_HEAD_MISMATCH`. That looked like an ordinary draft conflict, and the device could not tell that a Freeze was waiting to be adopted.
  2. There was no recovery action that checks the device's draft anchor against the Freeze source. Recovery depended entirely on the seal replay.
  3. Suppose the head had moved on (V2 opened or committed elsewhere). The old draft then got a generic head mismatch, not an explicit non-current refusal.
  4. `loadVerifiedFreezeRecord` verified the record and its receipt signature, but not the ledger entry at `freeze_commit_version`. A deleted or altered freeze entry was not detected there.
  5. `loadVerifiedProfileRecord` checked the profile against a hash and a time passed by the caller. It did not take the Freeze record, so binding the profile to the Freeze relied on each caller.

## 1. Server: `recover_freeze`

Route: `POST /api/poju/decision-authority {action:"recover_freeze"}` → `server/service.ts` `handleDecisionAuthority` → `server/freeze-authority.ts` `recoverFreeze`.

Request (`FreezeRecoverRequest`): `session_id`, `writer_token`, and `expected` = the device's draft anchor (`commit_version`, `entry_hash`, `context_id`, `dc_version`, `content_hash`). The device sends no DC, no frozen DC and no receipt.

Server order (everything is re-read from the server's own ledger and registry):

1. Writer token is checked (`DC_AUTHORITY_FORBIDDEN`). If the session has no ledger, the result is `DC_LEDGER_NOT_FOUND`. A malformed `expected` gives `DC_AUTHORITY_BAD_REQUEST`.
2. Source = ledger entry at `expected.commit_version`. It must exist with the same `entry_hash`, be a `draft`, and have the same context id, `dc_version` and `content_hash`. Otherwise → `FREEZE_RECOVERY_SOURCE_MISMATCH`.
3. Sealed = entry at `source + 1`. It must be a `freeze` entry whose `previous_entry_hash` and `provenance.freeze.source_commit_version` / `source_entry_hash` equal the source. Otherwise → `FREEZE_RECOVERY_NOT_FOUND` (HTTP 404).
4. The sealed entry's context id, `dc_version`, `previous_content_hash` and `freeze_id` must agree with the source. Otherwise → `FREEZE_ANCHOR_MISMATCH`.
5. The sealed entry must still be the ledger head. Otherwise → `FREEZE_NOT_CURRENT`, with the current head. A V1 Freeze followed by a V2 open, V2 draft or V2 Freeze is never handed back.
6. Freeze record: `verifiedRecordForFreezeEntry`. If the record is missing, it is rebuilt deterministically from the freeze entry (crash window between entry and record). It then goes through the strict verifier (§3) and must point at this entry (`freeze_commit_version`).
7. Profile receipt: `registeredProfileReceipt`. This is the registered, verified receipt, or `null` when no profile was registered (`PROFILE_NOT_REGISTERED`). Recovery never registers or invents a profile.

Response: `{ ok: true, outcome: "recovered", frozen_dc, receipt, head, profile_receipt }`. Recovery writes no ledger entry and no record (except the deterministic record rebuild in step 6), so repeated calls return identical results.

`DcLedgerHeadRef` for freeze commits now carries `freeze_source` (source commit version + entry hash). This field is additive; older heads simply lack it.

The M4 seal replay (`sealFreeze` → `duplicateResponse`) is kept for compatibility. It now goes through the same strict record verification and the same profile lookup. It re-registers a profile only when the Freeze sealed a `profile_hash`, no receipt exists yet, and the re-sent birth input reproduces that sealed hash.

## 2. Device: call chain and adoption

Device order (all production code):

1. `production-freeze-wire.ts` `ensureSessionFrozenForDelivery` → `ensureSessionFrozenViaAuthority` → `client-freeze.ts` `sealFreezeWithAuthority`.
2. `sealFreezeWithAuthority`:
   - Catch-up sync of the local DC (`syncDcLedgerBeforeWrite`). If that sync answers `DC_LEDGER_REMOTE_FROZEN`, go to recovery with the anchor from the stored mirror.
   - `mirror = draftAnchor(...)`. The mirror head must be a draft whose snapshot hash, context id and version equal the local DC. Otherwise → `DC_LEDGER_NOT_CURRENT`.
   - `transport.head()`. If the server head is not this exact draft commit (version + entry hash), call `transport.recoverFreeze` with the draft anchor.
   - Otherwise send `freeze` as in M4.
3. Recovery result checks (`assertServerFreezeFor`, shared with the normal seal):
   - frozen DC integrity, `status: final`, same context and version;
   - receipt session, `freeze_id` and `context_hash`;
   - `receipt.ledger_commit_version == head.commit_version`;
   - head is a `freeze` with this session, `freeze_id` and snapshot hash;
   - `head.freeze_source` equals the device's anchor;
   - a profile receipt, if present, names this Freeze, session and time.

   The device does not create or edit receipts. If the device has no usable draft anchor, the result is `FREEZE_RECOVERY_ANCHOR_UNKNOWN` and nothing is sent.
4. Adoption: the result (`frozen_dc`, server head as the new mirror, Freeze receipt, profile receipt or none) is written through the existing C1 `commitDecisionContextChange` path in `production-freeze-wire.ts`, with `withFreezeReceipts`. Sealed, duplicate and recovered Freezes use the same commit.
5. Refusals end as `{ ok: false, reason_code: "dc_freeze_authority_failed", reason: "<CODE>: <message>" }`, and the local Session is not written. The server `FREEZE_RECOVERY_NOT_FOUND` is reported on the device as `DC_LEDGER_HEAD_MISMATCH`, which is a real divergence and not a Freeze from this draft. `FREEZE_NOT_CURRENT` and the anchor codes pass through unchanged.
6. Any other DC write that meets the unadopted Freeze (`client-sync.ts`) now fails as `DC_LEDGER_REMOTE_FROZEN`. The `DcLedgerSyncError` carries the server head, so it is no longer reported as a draft head conflict. The local blob write does not happen.
7. M3 start after adoption is unchanged. `decision-report-client` `runDecisionReportForSession` posts `start` with the writer token and the stored Freeze and profile receipts.

## 3. Strict Freeze ledger anchor

`loadVerifiedFreezeRecord(session_id, freeze_id)` order:

1. Record schema, session and `freeze_id` must match the key (`FREEZE_RECORD_MISMATCH`). Frozen DC integrity and receipt signature are checked as in M4.
2. The receipt's `ledger_commit_version` must equal the record's `freeze_commit_version`.
3. Load the ledger entry at `freeze_commit_version`.
   - No entry, or an entry of another session or commit number → `FREEZE_ANCHOR_MISSING`.
   - `entry_hash` does not recompute → `FREEZE_ANCHOR_CORRUPT`.
4. The entry must match the record and receipt. Any difference → `FREEZE_ANCHOR_MISMATCH`:
   - `change_type: freeze`, `dc_status: final`;
   - recomputed snapshot hash = stored `snapshot_hash` = record frozen DC hash;
   - `content_hash` = record `context_hash`;
   - context id and version;
   - Blueprint hash;
   - `committed_at` = `frozen_at`;
   - previous commit and entry hash = record source;
   - provenance `freeze_id`, source commit and hash, `frozen_at`, `receipt_id` and `profile_hash`.

Ledger entry hashes are unsigned (`canonicalHash`). A forged entry that is re-hashed consistently is therefore caught by comparing it with the signed record, not by the entry hash alone (tested below).

`loadVerifiedProfileRecord({ session_id, freeze, profile_hash? })` now takes the verified Freeze record:

- The Freeze must belong to this session.
- The profile record's schema, session and `freeze_id` must be this Freeze.
- The record hash must equal the `profile_hash` sealed in the Freeze. Otherwise → `PROFILE_FREEZE_MISMATCH`.
- After that, as in M4:
  - an optional requested hash;
  - record schema;
  - `calculation_timestamp == freeze.frozen_at` (`PROFILE_TIME_MISMATCH`);
  - recomputed profile hash;
  - receipt signature, schema, session, Freeze, `profile_id`, hash and time.

Callers updated: `decision-report-service.ts` (start), `decision-report-store.ts` `loadRegisteredProfile` (now loads the verified Freeze first) and the M4 test.

## 4. Failure injection

`scripts/fixtures/idb-storage-fault.ts` `withIdbWriteFault("pojuSessionRecords", fn)` aborts the real IndexedDB transaction of the first Session-store write inside `fn` (fake-indexeddb). No production function is stubbed. In each case `sealButLoseLocalCommit` does the following:

- runs the production wire;
- asserts the fault hit exactly one write, which is the C1 commit after the server returned;
- asserts the wire returned `dc_freeze_persist_failed`;
- asserts the server head is `freeze`;
- asserts the device still has the V1 draft, the genesis mirror and no receipts.

The "C1 failure" in this evidence is that injected abort. A process crash, tab close or browser storage loss was not simulated.

## 5. Tests (`scripts/test-m4-1-freeze-recovery.ts`, `pnpm test:m4-1-freeze-recovery`)

Transport: a counting wrapper over `scripts/fixtures/in-process-decision-authority.ts`. It JSON-round-trips each call into the same `handleDecisionAuthority` the route uses. KV: process-memory `durableKv()` (no Upstash env).

| # | What runs | Asserted |
|---|---|---|
| 1 | Device: production wire seals, the C1 write is aborted, then the production wire is retried with the reloaded Session | 1 `recover_freeze` call and 0 `freeze` calls. Local DC is `final` with the server `context_hash`. Freeze receipt = server record receipt. Profile receipt = the registered one. Mirror = server Freeze head, writer token kept. No ledger entry after the Freeze. |
| 1b | Device: same failure, then a late DC write through `mutatePOJUSession` | Error `DC_LEDGER_REMOTE_FROZEN` with the Freeze head. Local Session byte-identical. The wire retry then adopts the Freeze. |
| 2 | Device: `sealFreezeWithAuthority` twice on the same stale draft; server: `recoverFreeze` twice | Both `recovered`. Receipts, profile receipts, frozen DC and head are deep-equal. 2 recover calls, 0 freeze calls. Ledger head unchanged; no new entry. |
| 3 | Server: `recoverFreeze` with a wrong commit (2 = the Freeze itself, 9 = absent), entry hash, context id, `dc_version`, content hash, token or session | `FREEZE_RECOVERY_SOURCE_MISMATCH`, `DC_AUTHORITY_FORBIDDEN` or `DC_LEDGER_NOT_FOUND`. |
| 3 | Device: production wire with the mirror's entry hash, commit version, writer token, context id or `dc_version` altered | Refused. 0 `freeze` calls. Local Session byte-identical. Server head is still the Freeze. |
| 4 | V1 sealed and its C1 aborted, then V2 opened on the server (`appendDcLedgerCommit`, another writer) | Server `FREEZE_NOT_CURRENT`. Wire reason contains `FREEZE_NOT_CURRENT`. Local Session unchanged. Server V2 head kept. |
| 4 | Then V2 sealed on the server | The old V1 draft is still `FREEZE_NOT_CURRENT` (server and wire); local state unchanged. |
| 5 | Server KV edits: delete the freeze entry; edit the snapshot without re-hash; edit the snapshot with re-hash; forge a self-consistent snapshot + snapshot hash; edit provenance; edit `change_type`; set a foreign `session_id`; record `freeze_commit_version − 1`; edit the record's source hash | `FREEZE_ANCHOR_MISSING`, `FREEZE_ANCHOR_CORRUPT`, `FREEZE_ANCHOR_MISMATCH` (×4), `FREEZE_ANCHOR_MISSING`, `FREEZE_ANCHOR_MISMATCH` (×2). |
| 5 | Device: freeze entry deleted, then the production wire is retried | Refused; local Session unchanged. |
| 6a | Sealed without birth input, C1 aborted, wire retry | Local `final` with 1 Freeze receipt and no profile receipt (null is not replaced by anything). |
| 6b | Sealed without birth, profile registered on the server afterwards (never stored on the device), wire retry | The device stores exactly the registered receipt. |
| 6c | Profile verifier: another Freeze's profile record copied under this key; Freeze with a different sealed `profile_hash`; foreign session; Freeze `frozen_at` changed | `PROFILE_FREEZE_MISMATCH` (×3), `PROFILE_TIME_MISMATCH`. |
| 7 | The recovered Session from case 1 → `runDecisionReportForSession` (production M3 client) under `runWithEphemeralXhighKv`; `fetch` for `/api/poju/decision-report` is replaced by a direct call to `service.startDecisionReportJob`, then answers 409 `TEST_HALT_AFTER_START` | Start body: `action: start`, the recovered Freeze and profile receipts, the writer token; no DC or chart uploaded. Server start accepted; job input `freeze_receipt_id`, `profile_receipt_id` and `context_hash` match the recovered Session. The client is halted after start, so no analysis or page stage and no model call runs. |

Which layer each case uses:

- **Device path (in-process transport + process-memory KV):** 1, 1b, 2 (first half), 3 (device variants), 4 (wire calls), 5 (last step), 6a, 6b, 7.
- **Server functions called directly (process-memory KV, no transport):** 2 (second half), 3 (server list), 4 (`recoverFreeze` / `appendDcLedgerCommit` / `sealFreeze` setup), 5 (KV edits), 6b (registration setup), 6c.

The server-only checks show the server classification. They are not evidence of client crash recovery. The device checks run the device order described in §2 in one process, with the C1 write aborted by IndexedDB. They are not a browser crash or reload.

## 6. Checks executed on `f1be9ec1`

Captured to `temp/out_m41_final_*.txt` (not committed).

| Check | Result |
|---|---|
| `tsx scripts/test-m4-1-freeze-recovery.ts` (new) | 10 passed, 0 failed |
| `tsx scripts/test-m4-decision-authority.ts` (profile verifier call updated) | 27 passed, 0 failed |
| `tsx scripts/test-m3-decision-report.ts` | 27 passed, 0 failed |
| `test-m2-1-readiness-confirm-freeze` | 19 passed, 0 failed |
| `test-m2-2-freeze-report-binding` | 43 passed, 0 failed |
| `test-m2-3-decision-blueprint` | 18 passed, 0 failed |
| `test-m1-r-fresh-session-main-loop` | PASS=8 FAIL=0 |
| `test-intake-r6-freeze-versioning` | all checks passed |
| `test-intake-r6-freeze-authority-regression` | PASS=8 FAIL=0 |
| `test-intake-r6-freeze-wire-reason` | passed=25 failed=0 |
| `test-intake-r6-freeze-persist-disclose` | PASS=5 FAIL=0 |
| `tsc --noEmit` | exit 0 |
| `pnpm build` | exit 0 |

`test-s7-dc-lifecycle` was not re-run. It has 3 failures that already occur identically on the M3 baseline (see the M4 evidence).

## 7. Not executed

- `/api/poju/decision-authority` `recover_freeze` over real HTTP (only the in-process transport and the build's route compile).
- Upstash Redis: NX races, TTL expiry, latency, and record and entry expiry during recovery.
- Multiple devices or tabs racing on the same session (case 4 simulates the other writer with a direct server append, not a second device).
- A real browser: IndexedDB quota or eviction, process crash or reload between the server seal and C1, and the `POJUChatUI` auto-start after recovery.
- Real OpenRouter / model calls, model-quality validation, and an end-to-end report run.
- The full regression suite.

## 8. Trust boundaries and known limits

1. **Device anchor must be exact.** Recovery needs the device mirror to still name the exact draft commit the Freeze was sealed from (version + entry hash). Suppose the mirror is older than the DC that was frozen, e.g. an earlier write reached the server but its local write also failed with a different idempotency key. Then the device fails closed (`FREEZE_RECOVERY_ANCHOR_UNKNOWN`, `DC_LEDGER_NOT_CURRENT` or `DC_LEDGER_HEAD_MISMATCH`). There is no automatic merge. A same-key retry is covered by ledger idempotency.
2. **Extra round trip.** Each Freeze attempt now queries the ledger head once before sending `freeze`.
3. **Symmetric signatures.** The device cannot verify receipt signatures (HMAC); it checks field consistency against its own anchor and DC. The server verifies the signatures at recovery and at start.
4. **Unsigned ledger hashes.** Entry hashes detect accidental corruption only. Deliberate edits are detected by matching the entry against the signed Freeze record (§3). Someone who can rewrite both KV values and holds the signing secret is outside this model.
5. **Retention.** Recovery needs the source draft entry, the freeze entry and the record; start needs the freeze entry and the record. Each has a 60-day TTL (from M4). After expiry both fail closed: recovery with `FREEZE_RECOVERY_SOURCE_MISMATCH` / `FREEZE_RECOVERY_NOT_FOUND`, start with `FREEZE_ANCHOR_MISSING`. Expiry was not exercised.
6. **Writer token.** A device that lost its writer token (local data cleared) cannot recover. That data loss also loses the local draft, so there is nothing to recover into.
7. **Never Stored.** Recovery adds no stored data. The request carries only hashes and ids. The response carries data the server already held (frozen DC snapshot, receipts, head). No chat transcript is uploaded.
