# M2.2-R4 Contract Fix — Close remaining production lifecycle defects

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent:** `5adb7b17d749a6e462c81c2772587b155f987618`  
**Not self-PASS.** No PR / merge / deploy / tip.

## Scope (three gaps only)

1. Real cancel / supersede for old Final Delivery workers  
2. Write-back fail-closed when `m22_report_job_id` present but binding/snapshot missing  
3. Production-path tests (real xhigh persistence + shared KV + Stage Runner success contract)

No redesign of M2.1 / Decision Context / Freeze / adaptive intake / eight-page prompts.

## 1 — Real cancel / supersede

**New:** `lib/poju/final-delivery-execution-authority.ts`

- `supersedeFinalDeliveryJobForRegenerate(job_id)` — marks job `failed` with `failure_reason: superseded_by_regenerate`, force-releases continue lease + session lock.
- `isDeliveryExecutionRevoked` / `assertDeliveryExecutionAuthority` / `tryCommitUnderDeliveryAuthority` — workers must re-check before advancing.
- `PojuXhighJobFailureReason` adds `superseded_by_regenerate`.
- `updateXhighJobStatus` refuses revive of `superseded_by_regenerate` / `superseded_by_deploy` / `user_cancelled`.

**Stage runner (`final-delivery-stage-runner.ts`)**

- Heartbeat aborts in-flight LLM when job is revoked (not only `user_cancelled`).
- Checkpoint saves and `/continue` scheduling gated by authority (`saveDeliveryStageCheckpointIfAuthorized`, `scheduleDeliveryStageContinueIfAuthorized`).
- Assemble success path: authority → M2.2 write-back → authority again → `completeXhighJob`. Revoked workers stop without overwriting.

**API (`final-delivery/route.ts`)**

- Regenerate calls `supersedeFinalDeliveryJobForRegenerate` (not status-flip alone + lease release ad hoc).
- Owner-token CAS claim release unchanged from R3.

## 2 — Write-back fail-closed

Removed silent skip:

```ts
if (!input.decision_context_binding || !input.decision_context_snapshot) return;
```

When `m22_report_job_id` is set, missing binding/snapshot throws `m22_writeback_missing_binding_or_snapshot` and blocks formal completion.

## 3 — Production-path tests

| Test | Coverage |
|---|---|
| R3-C3 | CAS unavailable fails closed (kept) |
| R4-C1 | Real xhigh: supersede → authority revoked; revive refused; claim steal fail-closed |
| R4-C2 | Two independent contexts, shared MemoryKv: exactly one generator claim |
| R4-C3 | Pre-handoff helper used by route (≥4 call sites) releases claim; re-acquire works |
| R4-C4 | `finalizeFormalDeliverySuccessForTests` + `getXhighJob()` completed only after 8-page write-back |
| R4-C5 | Write-back failure → formal `getXhighJob().status === failed`; M2.2 remains failed |
| R4-C6 | Missing binding/snapshot with `m22_report_job_id` throws |
| R4-C7 | Tampered client snapshot ≠ server hash; retry preserves Freeze binding |

## Tests

| Command | Result |
|---|---|
| `pnpm test:m2-2-freeze-report-binding` | **37/37 PASS** |
| `pnpm test:m2-1-readiness-confirm-freeze` | **19/19 PASS** |
| `pnpm exec tsc --noEmit` | **PASS** |
| `pnpm build` | **PASS** |

## Limitations

- Full Next.js HTTP POST of `/api/poju/final-delivery` is not spun up in this suite; Regenerate takeover is exercised via the same `supersedeFinalDeliveryJobForRegenerate` + claim CAS helpers the route calls, against real ephemeral xhigh persistence.
- In-flight LLM abort relies on heartbeat + AbortSignal + authority gates before commit; a worker blocked inside a provider call still finishes that single call but cannot commit checkpoints, schedule next stages, write-back, or complete.
- No redesign of M2.1 / DC / Freeze / prompts.

## Awaiting

Independent Max review. Do not treat CI/Vercel Combined success as M2.2 acceptance.
