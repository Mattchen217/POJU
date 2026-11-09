# M2.2-R5 Contract Fix — Execution Fencing + Real Stage Runner Verification

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent:** `12ef9ac028b87db5f571859fb0e7c37183c8f49c`  
**Not self-PASS.** No PR / merge / deploy / tip.

## Scope (R4 remaining blockers only)

1. Atomic execution fencing (monotonic generation / fencing token)
2. Supersede failure handling (no swallowed persistence failures)
3. Real `runFinalDeliveryStage()` assemble-path tests + dual-context / route-shaped regenerate

No redesign of M2.1 / Decision Context / Freeze / adaptive intake / eight-page prompts.

## 1 — Atomic execution fencing

- Session fence key `poju-xhigh:fd-exec-fence:{session_id}` stores `{ generation, authorized_job_id, updated_at }`.
- Jobs stamp `execution_generation` at create; Regenerate `bumpFdExecutionFence` atomically increments generation and clears `authorized_job_id`.
- Replacement jobs are authorized only via `authorizeFdExecutionFence` after successful revoke.
- Commit path: `commitXhighJobUnderExecutionFence` / `commitUnderDeliveryExecutionFence` — CAS on job `execution_generation` at the write boundary (`MemoryKv.compareAndSetJobGeneration` or Upstash Lua). Read-check then independent write is not used for formal commits.
- Wired into: checkpoint gate, continue schedule, M2.2 write-back authority, assemble formal complete / write-back-fail stamp.

## 2 — Supersede failure handling

- Removed `.catch(() => undefined)` on critical supersede persist.
- `persistSupersededFinalDeliveryJob` confirms persisted `failure_reason`; otherwise throws.
- `SupersedePersistenceError` propagates to the route; Regenerate returns 409 and does **not** create a replacement job.
- Idempotent when already `superseded_by_regenerate` (avoids double fence bump).
- Test hook `__setSupersedePersistFailForTests` proves failed persist prevents replacement.

## 3 — Real Stage Runner tests

- R5-C2/C3 call actual `runFinalDeliveryStage(..., "assemble")` with seeded finalize/segments checkpoints and `__setAssembleReadyOverrideForTests` (mock pages only; real assemble/write-back/complete control flow).
- Assertions via persisted `getXhighJob()` + M2.2 session state.
- R5-C4: regenerate mid-flight → stale fence rejects complete; replacement untouched.
- R5-C5: dual logical contexts, shared ephemeral store, one authorized generation.
- R5-C6: route-shaped regenerate control flow — supersede fail → no create.

## Files

- `lib/kv/memory-kv.ts`
- `lib/poju/xhigh-job-types.ts`
- `lib/poju/xhigh-job-store.ts`
- `lib/poju/final-delivery-execution-authority.ts`
- `lib/poju/final-delivery-stage-runner.ts`
- `app/api/poju/final-delivery/route.ts`
- `scripts/test-m2-2-freeze-report-binding.ts`
- `docs/.../CONTRACT-FIX-R5.md`

## Tests

| Command | Result |
|---|---|
| `pnpm test:m2-2-freeze-report-binding` | **43/43 PASS** |
| `pnpm test:m2-1-readiness-confirm-freeze` | **19/19 PASS** |
| `pnpm exec tsc --noEmit` | **PASS** |
| `pnpm build` | **PASS** |

## Limitations

- Full Next.js HTTP POST of `/api/poju/final-delivery` is not spun up; Regenerate is exercised via the same supersede/allocate/authorize control flow the route calls, against real ephemeral xhigh persistence.
- Assemble LLM is not run; pages are injected via a test-only ready override so the real assemble → write-back → fenced complete path executes.
- Upstash CAS uses Lua when `eval` is present; local/ephemeral MemoryKv uses in-process compare-and-set (no await between check and write).
- In-flight provider calls may finish one LLM round-trip after revoke but cannot CAS-commit checkpoints, continue, write-back, or complete.

## Awaiting

Independent Max review. Do not treat CI/Vercel Combined success as M2.2 acceptance.
