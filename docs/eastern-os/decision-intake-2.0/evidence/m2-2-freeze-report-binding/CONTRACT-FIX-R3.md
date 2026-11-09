# M2.2-R3 Contract Fix — Remaining production lifecycle defects

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent:** `220b5c76d800eb2b78e8c86f90e7b004cf5d74fb`  
**Not self-PASS.** No PR / merge / deploy / tip.

## 1 — Remove unsafe Regenerate force-release

- Removed unconditional `forceRelease(key)` from `POST /api/poju/final-delivery` Regenerate path.
- Regenerate now: stop/resolve prior xhigh job → `tryReleaseClaimForRegenerate` with **original owner token** (from prior `FinalDeliveryJobInput.m22_claim_token`) via atomic CAS.
- Missing/wrong token while claim held → **fail closed** (`CLAIM_OWNED_BY_OTHER` / 409). Never deletes another execution context's claim.
- Regression: R3-C1.

## 2 — Claim cleanup on every pre-handoff exit

- After `prepareFreezeBoundFinalDeliveryServer()` acquires a claim, early returns that do **not** hand ownership to a running Final Delivery job CAS-release via `releaseClaimBeforePreHandoffReturn`:
  - existing running / completed xhigh job resume returns
  - superseded_by_deploy create-probe return
  - session-lock contention (`delivery_job_busy`)
  - job create failure / pass failure (existing)
  - outer catch when `!m22_handed_off` (also fails created job if any)
- After `scheduleFinalDeliveryJob` → `m22_handed_off = true`; job owns success/failure cleanup.
- Regression: R3-C2 (release then re-acquire).

## 3 — M2.2 write-back part of real success contract

- `final-delivery-stage-runner` assemble path: when `m22_report_job_id` is bound, **write-back runs before** `completeXhighJob`.
- Write-back failure → `failXhighJob` (retryable) + CAS-release claim; formal job **not** reported completed.
- Freeze binding + report job id preserved for retry; retrieval via `getCompletedFreezeBoundReport` unchanged.
- Regression: R3-C4 / R3-C5.

## 4 — CAS fail closed

- `compareAndDeleteClaim`: removed GET+DEL fallback.
- Requires `store.compareAndDelete` **or** Redis `eval` Lua CAS; otherwise throws `ClaimCasUnavailableError`.
- `__createClaimOpsForTests.release` likewise refuses non-atomic deletion.
- Regression: R3-C3.

## Tests

| Command | Result |
|---|---|
| `pnpm test:m2-2-freeze-report-binding` | **34/34 PASS** |
| `pnpm test:m2-1-readiness-confirm-freeze` | **19/19 PASS** |
| `pnpm exec tsc --noEmit` | **PASS** |
| `pnpm build` | **PASS** |

New: R3-C1 regenerate no-steal; R3-C2 pre-handoff cleanup; R3-C3 CAS unavailable; R3-C4 write-back failure vs formal complete; R3-C5 retrieval + retry Freeze identity.

## Limitations

- Regenerate without a prior job that stored `m22_claim_token` cannot force-clear an active foreign claim (by design — wait for TTL).
- Legacy deliveries without `m22_report_job_id` still complete without M2.2 write-back.
- No redesign of M2.1 / DC / Freeze / adaptive intake / eight-page prompts.
