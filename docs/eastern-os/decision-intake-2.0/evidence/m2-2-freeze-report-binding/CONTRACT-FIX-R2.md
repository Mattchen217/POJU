# M2.2-R2 Contract Fix — Production lifecycle gaps

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent:** `b80718c5cf4eb7c5a0eb0741e5ee94c93b67f49c`  
**Not self-PASS.** No PR / merge / deploy / tip.

## Blocker 1 — Atomic claim on production Final Delivery path

- Formal path: `POST /api/poju/final-delivery` → `prepareFreezeBoundFinalDeliveryServer({ acquireGenerationClaim: true })` → **KV claim acquire** → `createXhighJob` (only claim owner) → `runFinalDeliveryJob`
- Competing request: `GENERATION_IN_PROGRESS` → reuse latest xhigh job status / 409; **does not** start another generator
- Completed Freeze-bound job: `reusedCompleted` short-circuit (no new claim)
- Lease release: **token-checked compare-and-delete**
  - `MemoryKv.compareAndDelete`
  - Upstash: Lua `EVAL` CAS delete on token field
  - `FreezeReportClaimOps.release` returns boolean
- Stale owner cannot release a newer owner's claim (R2-C1)
- Original Freeze binding preserved across retry + lease recovery (R2-C5)
- Key / TTL unchanged: `poju-m22:freeze-report-claim:{sessionId}:{freezeId}:{reportSchemaVersion}` · `KV_TTL.POJU_XHIGH_LOCK` (90m)
- Claim token + key + `m22_report_job_id` stored on `FinalDeliveryJobInput` for completion/fail cleanup

## Blocker 2 — Production completion write-back

- Wired in `lib/poju/final-delivery-stage-runner.ts` assemble success path **after** `completeXhighJob`
- Calls `completeFreezeBoundReportFromDeliveryPages` with exactly eight pages from ready segments
- Verifies original job id, Freeze binding, content hash, report schema before completion
- `getCompletedFreezeBoundReport` / `freeze_bound_report_jobs` retrieval path unchanged
- On write-back failure: `failFreezeBoundReportJob` → status `failed` (never completed)
- Hard `failStage`: mark M2.2 job failed + CAS-release claim

## Blocker 3 — Server-authoritative Freeze

- `/api/poju/final-delivery` loads Freeze via `loadPOJUSession` + `loadAuthoritativeFreeze`
- Client snapshot/binding compared against server result only
- Tampered client content / binding / hash → fail closed (`DC_REPORT_HASH_MISMATCH` / bind codes)
- Client payload never replaces server Freeze as analytical authority

## Tests

| Command | Result |
|---|---|
| `pnpm test:m2-2-freeze-report-binding` | (run on commit) |
| `pnpm test:m2-1-readiness-confirm-freeze` | (run on commit) |
| `pnpm exec tsc --noEmit` | (run on commit) |
| `pnpm build` | (run on commit) |

New: R2-C1 CAS stale release; R2-C2 single production claim owner; R2-C3 write-back + retrieval; R2-C4 tampered client rejected; R2-C5 retry preserves binding.

## Limitations

- Interrupt (Continue) keeps claim held until hard-fail/success/TTL (same xhigh job resumes).
- Page body mapping uses ready-segment `interleaved_markdown` / `body_markdown` via `canonicalFaceId`.
- No second report pipeline; existing eight-page prompts unchanged.
