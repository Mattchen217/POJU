# M4 — Server-authoritative Decision Context ledger, Freeze seal and Profile provenance

This is an evidence record for the production change on `feat/m1-r-fresh-session-main-loop`. It does not declare the product PASS.

- Branch: `feat/m1-r-fresh-session-main-loop`
- Parent of the implementation (M3 evidence tip): `b6565dee3a977f7599436944e3a38da2284bd38c`
- Implementation SHA (all checks below ran on this commit): `103172a9a981c6c6acc696eb89adc66c005db733`
- Evidence tip SHA: _(this commit; left for independent review)_
- No PR opened. Not merged into `main`, not rebased. Nothing deployed or promoted. No force-push.

**What this evidence is not.** No real OpenRouter call, no real model output and no end-to-end run were executed for M4 (excluded by instruction). The M3 report-flow checks still use the M3 test hooks (`__setPersonalAnalysisModelForTests`, `__setDecisionReportPageModelForTests`) for model output. The M4 authority path itself (ledger, seal, signatures, profile recompute, start verification) runs for real in-process against the process-memory KV. It was **not** exercised against Upstash Redis or over a real HTTP hop.

## 1. DC Commit Ledger — write path

The ledger extends the existing Session write transactions; nothing new is created at report start.

Device (`lib/poju/session-mutation.ts`):

- `mutatePOJUSession` → retry loop → `apply` → no-op check → **`syncDcLedgerBeforeWrite({ base, candidate, idempotency_key: operation_id })`** → `casWritePOJUSession`.
- `casWritePOJUSessionFromCandidate` (used by `savePOJUSessionCore`, C1 `commitDecisionContextChange`) → blob read → **`syncDcLedgerBeforeWrite({ base: blobBase, candidate, idempotency_key })`** → `casWritePOJUSession`. C1 passes its own `idempotency_key`; other callers get a content-derived key (`dc_auto:{sid}:{snapshot32}:{blueprint16}`).
- Only DI2 sessions are enrolled (`isDcLedgerEnrolled`: Blueprint present or mirror present). Legacy sessions never touch the ledger.
- If the candidate's DC + Blueprint hashes equal the mirror head, no request is sent (non-DC writes cost nothing).
- The local blob is written **only after** the server accepted the commit. The returned head is stored as `session.dc_ledger` (mirror: `writer_token`, `head`, `synced_at`). An unreachable server or a refusal throws `DcLedgerSyncError`, and the local write does not happen (fail-closed).

Transport: `client-transport.ts` → `POST /api/poju/decision-authority {action:"append"}` (3 attempts on no-answer only; typed refusals are returned without retry) → `server/service.ts` `handleDecisionAuthority` → `server/ledger-store.ts` `appendDcLedgerCommit`.

Server `appendDcLedgerCommit` order:

1. Idempotency lookup by key. Same content → `duplicate` with the original head. Different content → `DC_LEDGER_IDEMPOTENCY_CONFLICT`, plus the effective commit (head, previous hash, snapshot, Blueprint).
2. If the session has a genesis, the writer token (HMAC over session id + genesis entry hash) is required → `DC_AUTHORITY_FORBIDDEN` otherwise.
3. Read the head; the caller's `expected_previous` must equal it. Otherwise `DC_LEDGER_HEAD_MISMATCH` (with the server head), unless the head is this same key and content (`duplicate`).
4. Same content as head → pin the key, outcome `unchanged` (no new entry).
5. `validateLedgerTransition` (`ledger-rules.ts`):
   - genesis must be a draft;
   - the context id never changes;
   - draft `dc_version` never decreases;
   - a frozen head may only be followed by `V(n+1)` with `parent_version = n` (`version_open`), otherwise `DC_LEDGER_FROZEN_IMMUTABLE`;
   - the device never writes `final` / `superseded` (`DC_LEDGER_STATUS_FORBIDDEN`);
   - the Blueprint must belong to this session/context and never regress;
   - illegal fact combinations are refused;
   - any fact/constraint that newly claims user confirmation needs a structurally valid user Confirmation Event in the same request, else `DC_LEDGER_UNBACKED_CONFIRMATION`. Model output therefore cannot count as user confirmation.

   Change type is server-classified: genesis / draft_update / user_confirm / version_open / blueprint_update / freeze.
6. Build the entry and write it with NX at `commit_version = head + 1`. If NX loses, the outcome is `duplicate` when the winner is the same key and content, else `DC_LEDGER_CONCURRENT_COMMIT`.

Entry fields (`DcLedgerEntry`):

- chain: `commit_version`, `previous_commit_version`, `previous_entry_hash`;
- DC version and status: `dc_version`, `previous_dc_version`, `dc_status`;
- hashes: `content_hash`, `previous_content_hash`, `snapshot_hash`;
- operation: `idempotency_key`, `change_type`, `committed_at` (server time), full `snapshot`;
- Blueprint: `blueprint`, `blueprint_version`, `blueprint_hash`;
- provenance: source op, backing user events, promoted ids, and freeze info;
- integrity: `entry_hash` over all of the above. `loadLedgerEntry` recomputes it (`DC_LEDGER_ENTRY_CORRUPT`).

Note on "continuous versions": the continuous, gap-free sequence is the ledger `commit_version` + hash chain. A draft's `dc_version` is a local edit counter (an answer, an N/A declaration and a conflict clarification each bump it), so one device write may carry several bumps. The ledger records `previous_dc_version` and refuses regressions but does not require +1 within a draft. Frozen versions and V2 opening are strict.

## 2. Freeze seal — receipt generation and verification

Device: `production-freeze-wire.ts` `ensureSessionFrozenForDelivery`. After the existing sufficiency/stall gates, DI2 sessions go to `ensureSessionFrozenViaAuthority`:

1. `sealFreezeWithAuthority` (`client-freeze.ts`):
   - catch-up sync so the mirror equals the local draft;
   - `POST {action:"freeze"}` with the expected head, context id/version/hash, the authority envelope (Confirmation Events, N/A declaration actions, topic evaluations, profile flags) and the birth input of the selected profile;
   - checks the response: frozen DC integrity; receipt fields vs DC and binding; head `change_type = freeze`; snapshot hash.
2. The server-frozen DC is adopted through C1 `commitDecisionContextChange` (same idempotency key as before). The receipts are stored in `session.dc_freeze_receipts` / `dc_profile_receipts`. The legacy (non-DI2) Freeze path is unchanged.

Server `sealFreeze` (`server/freeze-authority.ts`):

1. Writer token check; read the head.
2. If the head is already the freeze of the expected source, replay: re-materialize the record/receipt if missing (crash repair) and return the identical receipt.
3. Head must equal `expected` and be a draft with matching context/version/content hash (`FREEZE_TARGET_MISMATCH`, `FREEZE_ALREADY_FROZEN`). No record may exist for this `freeze_id` (`FREEZE_VERSION_ALREADY_SEALED`).
4. `frozen_at` = server clock. The server recomputes the profile from birth (section 3) to derive the CFP source state.
5. `buildServerFreezeNaValidationContext` (production builder + server CFP override) + `freezeDecisionContext`. Insufficient DC → refused, nothing appended.
6. Append the freeze ledger entry (NX).
7. The record and receipt are derived deterministically from that entry (`recordFromFreezeEntry`) and stored NX.
8. Register the profile.

Receipt (`FreezeReceipt`):

- identity: `session_id`, `freeze_id` (`{context_id}@v{version}`), `context_id`, `context_version`, `context_hash`, `blueprint_hash`;
- seal: `frozen_at`, `receipt_id`, `ledger_commit_version`;
- signature: `key_id`, `signature`, an HMAC-SHA256 with a domain prefix over the canonical receipt minus the signature.

Secret: `POJU_AUTHORITY_SIGNING_SECRET`, else `POJU_INTERNAL_STAGE_SECRET`, else `OPS_SESSION_SECRET`. In production (`NODE_ENV=production` / `VERCEL_ENV`) it **fails closed** (`DC_AUTHORITY_SIGNING_UNAVAILABLE`, 503). Outside production a fixed dev constant is used.

`loadVerifiedFreezeRecord` checks:

- the receipt signature;
- frozen DC integrity (content hash);
- that the binding and receipt fields agree;
- the ledger anchor: the entry at `ledger_commit_version` is `change_type freeze` with the same snapshot hash.

## 3. Profile trust chain — compute and register path

`server/profile-authority.ts`:

- `computeServerProfile(birth, calculation_timestamp)`:
  1. `coerceBirthInfo` (`PROFILE_BIRTH_INVALID`);
  2. `calculateProfileWithShunshi` (the source must be shunshi; no client fallback);
  3. `buildStreamLocalDataFromProfile().structured` (must have a day master);
  4. `buildZiweiFactPack(birth, {asOf: frozen_at})` → `formatZiweiClosedSetForPrompt` (a Ziwei failure is recorded as `ziwei_status`, not faked);
  5. `profile_hash = computeProfileHash({structured, ziwei_closed_set, calculation_schema_version, calculation_timestamp})`.
- Registry record (`ProfileRecord`, key `poju-auth:profile:{sid}:{freeze_id}`, NX):
  - identity: `profile_id`, `profile_hash`;
  - calculation: `calculation_schema_version` (`poju-profile-calc-v1:shunshi-bazi-core@0.1:iztro@2.6.3`), `calculation_timestamp = frozen_at`;
  - chart: `chart_structure`, `ziwei_closed_set`;
  - source: `{kind:"server_recompute_from_birth", birth_input_hash, bazi_engine, ziwei_engine, used_true_solar_time, ziwei_status}`;
  - signed `receipt`.

  Raw birth input is not stored, only its hash. A different hash for the same Freeze → `PROFILE_ALREADY_REGISTERED`.
- Profile at Freeze time: registered inside `sealFreeze`. If no birth was available then, `register_profile` can be called later with the Freeze receipt; the calculation time is still `frozen_at`. A new profile requires a new Freeze.
- `loadVerifiedProfileRecord` checks the requested hash, schema (`PROFILE_SCHEMA_STALE`), calculation time = `frozen_at`, the recomputed `profile_hash` over the stored chart (`PROFILE_HASH_MISMATCH`) and the receipt signature.

## 4. M3 start — authority verification and consumption

Client `decision-report-client.ts` `ensureReportAuthority`:

- needs `dc_ledger.writer_token` and the Freeze receipt for the current final DC (`FREEZE_NOT_SERVER_SEALED`);
- the receipt's `context_hash` must match the DC (`FREEZE_RECEIPT_MISMATCH`);
- if the profile receipt is missing, calls `register_profile` with the device's birth input (`PROFILE_REQUIRED` if none).

Start posts only `writer_token`, `freeze_receipt` and `profile_receipt`. No DC, Blueprint or chart is uploaded any more.

Server `decision-report-service.ts` `authorizeReportSources`:

1. Receipt present (`FREEZE_RECEIPT_REQUIRED`) and same session.
2. Writer token valid for the session.
3. `loadVerifiedFreezeRecord` + `assertFreezeReceiptMatches` → `FREEZE_RECEIPT_INVALID` on any field/signature drift.
4. The ledger head must still be this freeze commit (`FREEZE_NOT_CURRENT`); a superseded Freeze cannot start or regenerate.
5. Profile receipt required (`PROFILE_RECEIPT_REQUIRED`); `loadVerifiedProfileRecord` + `assertProfileReceiptMatches`.

Job input is built only from these records:

- Freeze identity: `freeze_id`, `context_hash`, `freeze_receipt_id`, `frozen_at`;
- Profile identity: `profile_hash`, `profile_receipt_id`, `profile_calculation_schema_version`.

The analysis idempotency key covers session, freeze, context hash, profile hash and analysis schema; `profile_hash` itself binds the calculation schema and time. The runner's `loadSources` re-loads both records with the receipt ids. The projection's `as_of` is the profile calculation time, not the wall clock.

Unchanged from M3: execution fence/generation, the 8 pages, per-page checkpoints, assemble integrity check, continue/recovery.

## 5. History, duplicates, concurrency, retry

| Situation | Behaviour | Test |
|---|---|---|
| Network retry of an append | same key + content → `duplicate`, same head, no second entry | M4 "duplicate request" |
| Same key, different content | `DC_LEDGER_IDEMPOTENCY_CONFLICT` + effective commit; device adopts it only if it is the direct successor of its anchor | M4 "same idempotency key…" |
| Two writers from one head | NX: exactly one commits; the other gets `DC_LEDGER_CONCURRENT_COMMIT` / `HEAD_MISMATCH` | M4 "concurrent commits" |
| Parallel identical requests | one `committed`, one `duplicate` | same |
| Server unreachable | local DC write refused (retryable); session revision unchanged; retry with the same op id commits once | M4 "authority unreachable" |
| Lost local write, same content re-sent under a new op id | device adopts the server head (no new commit) | M4 "lost local mirror write…" |
| Server head equals the local base (lost catch-up write) | device rebases once and commits | same |
| Server head ahead with different content | explicit `DC_LEDGER_HEAD_MISMATCH`; no silent overwrite | same |
| Repeated Freeze | identical receipt; no second seal entry | M4 "repeated Freeze request" |
| Concurrent Freeze | one seal; both callers get the same receipt | M4 "concurrent Freeze requests" |
| Crash between seal entry and record write | replay re-materializes the identical record + receipt from the ledger | M4 "crash after the seal commit" |
| Goal change after Freeze | V1 immutable; `version_open` V2; V1 record/receipt unchanged; V1 can no longer start | M4 "frozen version is immutable…", "historical Freeze cannot start…", M3 "superseded Freeze cannot start" |
| Tampered entry / record / receipt / chart | `DC_LEDGER_ENTRY_CORRUPT` / signature / integrity / `PROFILE_HASH_MISMATCH` | M4 tamper checks, M3 "server-side tamper" |

## 6. KV retention

| Data | Store | TTL |
|---|---|---|
| Ledger entries, idempotency pins, head hint, meta | `durableKv()` (Upstash in prod, process memory locally) | 60 days from write (`KV_TTL.DECISION_AUTHORITY_RETENTION`); meta/head refreshed on each append |
| Freeze record + receipt | `durableKv()` | 60 days; refreshed on every verified read |
| Profile record | `durableKv()` | 60 days; refreshed on every verified read |
| Completed report (result + analysis + 8 pages + receipt ids) | `durableKv()` `poju-di2:report:{sid}:{job_id}` | 60 days; status falls back to it when the job record has expired |
| Completed analysis / page records | job KV | 60 days once `completed` |
| In-flight analysis/pages, job records, leases | job KV | unchanged 2 h execution TTL |

Never Stored:

- No chat transcript is uploaded.
- The ledger stores DC snapshots (structured facts / constraints / definition the user confirmed or stated), the Blueprint and the user Confirmation Events backing promotions.
- The profile registry stores the computed chart and a hash of the birth input, not the birth input.
- Birth input is sent only in the freeze/register request for recomputation.

## 7. Not implemented / trust boundaries

1. **Client-asserted inputs.** The authority envelope (Confirmation Events, N/A actions, topic evaluations, profile flags) and the birth input come from the device. The server checks structure and consistency, not that a human typed them: there is no server-side transcript, by design. An `independently_verified` fact is accepted as a legal combination without external verification.
2. **Writer token.** The token is issued once at genesis and stored in the device Session. A device that loses it, for example after clearing local data, cannot continue that session's ledger (`DC_AUTHORITY_FORBIDDEN`). There is no recovery flow.
3. **Pre-M4 sessions.** A DI2 session frozen locally before M4 has no receipt and cannot start an M4 report (`FREEZE_NOT_SERVER_SEALED`). There is no migration.
4. **Offline.** DI2 DC writes require the authority endpoint (fail-closed). Legacy sessions are unaffected.
5. **Divergence.** If the server head is ahead with different content than the local state, the device fails explicitly; there is no automatic merge.
6. **Retention vs anchor.** Each ledger entry expires 60 days after its own write. Verifying a Freeze needs its freeze entry, so a Freeze is startable for at most 60 days after sealing, even though reading refreshes the record TTL.
7. **Signing secret.** A signing secret must be configured in production; without it, append still works but freeze/start return 503. The client cannot verify receipt signatures (symmetric HMAC); it checks field consistency only.
8. **Single store.** Atomicity relies on KV `SET NX` per key, not on multi-key transactions. Crash windows between the entry write and the idempotency pin / record write are repaired on replay (tested for the Freeze record). Upstash behaviour was not exercised.
9. **Profile per Freeze.** A profile is fixed per Freeze; changing the birth input requires a new DC version and a new Freeze.

## 8. Checks executed on `103172a9`

Captured to `temp/out_m4_final_*.txt` (not committed).

| Check | Result |
|---|---|
| `tsx scripts/test-m4-decision-authority.ts` (new) | 27 passed, 0 failed |
| `tsx scripts/test-m3-decision-report.ts` (reworked onto the authority path) | 27 passed, 0 failed |
| `test-m2-1-readiness-confirm-freeze` | 19 passed, 0 failed |
| `test-m2-2-freeze-report-binding` | 43 passed, 0 failed |
| `test-m2-3-decision-blueprint` | 18 passed, 0 failed |
| `test-m1-r-fresh-session-main-loop` | PASS=8 FAIL=0 |
| `test-intake-r6-freeze-versioning` | all checks passed |
| `test-intake-r6-freeze-authority-regression` | PASS=8 FAIL=0 |
| `test-intake-r6-freeze-wire-reason` | passed=25 failed=0 |
| `test-intake-r6-freeze-persist-disclose` | PASS=5 FAIL=0 |
| `test-s7-dc-lifecycle` | 5 passed, 3 failed (pre-existing: the same 3 fail identically on the M3 baseline `b6565dee`; not caused by M4) |
| `tsc --noEmit` | exit 0 |
| `pnpm build` | exit 0 |

Device-side checks use `fake-indexeddb` and an in-process transport (`scripts/fixtures/in-process-decision-authority.ts`) that JSON-round-trips into the same `handleDecisionAuthority` the route calls.

## 9. Tests not executed

- The full regression suite (deferred by instruction).
- Any real OpenRouter / model call, real model-quality validation, or end-to-end browser run.
- The `/api/poju/decision-authority` route over real HTTP (only the in-process transport and the build).
- Upstash Redis behaviour: NX races across instances, TTL expiry, latency.
- Production signing-secret configuration and the fail-closed 503 path in a deployed environment.
- Multi-device / multi-tab concurrent writers against one session in a browser.
- A UI run of the DI2 report auto-start with the new receipt flow (`POJUChatUI`).
