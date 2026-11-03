# PHASE3-S2-WRITEUP — Generation Infrastructure

> Branch: `feat/decision-context-phase1` · Scope: **S2 only** · Stop before S3 · No merge/prod
> Authority: `PHASE3-FINAL-ENG-CONTRACT-2026-11-03.md` §4–§6, §8–§9, §22 · Mapping §4 · S0 Job inventory · S1 acceptance

## Delivered

### A. Session state fields (encrypted blob via S1 CAS)

Added to `POJUSessionState` (+ create/load hydrate defaults):

| Field | Contract |
|-------|----------|
| `generation_task_contexts: GenerationTaskContext[]` | §3.2 / §6 |
| `generation_registry: GenerationRegistryEntry[]` | §3.2 / §5.1 |
| `generation_operation_bindings: GenerationOperationBinding[]` | §3.2 / §5.2 |

Interfaces live in `lib/poju/generation/types.ts` — **Contract field names verbatim**. Mapping `base_revision` ≡ Contract `generation_base_revision` — **Contract name only** (dual fields banned).

`GenerationTaskContext.status` machine exactly: `pending_create | running | result_received | committing | completed | failed_retryable | failed_terminal | recovery_required | abandoned`.

### B. Modules (`lib/poju/generation/`)

| Module | Role |
|--------|------|
| `types.ts` | Verbatim interfaces + legal transitions + error codes |
| `session-id.ts` | §4.2 production session_id validation |
| `registry.ts` | Append-only completed Registry; identity hard-fail |
| `binding.ts` | Operation Binding append; identity hard-fail |
| `collision.ts` | §5.3 steps 1–9 **exact order** before any idempotent skip |
| `task-context.ts` | pending_create CAS (session+1, dc unchanged, §6.3 step 8 base recheck); bind job → running; transitions; Reload restore (never regenerate identity) |
| `task-context-load.ts` | Default IndexedDB load for Generation CAS helpers |
| `commit-paths.ts` | `commitGenerationGuarded` Path A/B/C |
| `index.ts` | Barrel |

**Path A:** first formal DC write; dual check Session CAS + `dc === generation_base_revision`; same C1: DC + Registry + Binding + TaskContext completed + idempotency key + revs (session+1, dc+1). `GENERATION_BASE_STALE` if dc moved. `EMPTY_GENERATION_RESULT` must not fake completed. ControlPlane product type deferred to S3 — opaque slice accepted in mutation API only.

**Path B:** same idempotency_key already bound + Registry completed → `GenerationReplayResult` (§9.2); no DC rewrite; no rev bump. Mapping diagnostics additive only.

**Path C:** same generation identity, new key → new Binding + idempotency; session+1, dc unchanged; no DC rewrite; no duplicate Registry.

**§9.4 hard-fails** (different `client_task_id` same `generation_id`, etc.) never degrade to Path C.

**generation_guarded vs Phase2 `idempotent_first`:** `beginPersistTransaction` / `commitPersistTransaction` accept `mode: "generation_guarded"` so key-only early returns are skipped (Mapping §4.6 — both begin and commit). Phase2 default path unchanged. Generation commits use `commitGenerationGuarded` (independent path).

`SessionMutation.generation_base_revision` passthrough → `casWritePOJUSession` (S1 already reserved `GENERATION_BASE_STALE`).

### C. Job store recovery (S0 proved reverse-lookup ABSENT)

Per Mapping §2.4 / Contract §22 / S0 notes — **no invented policy beyond Contract**:

1. `PojuXhighJob.client_task_id` (+ optional `generation_type` / `fingerprint` / `fingerprint_version`) persisted **inside** job record on create before ack.
2. Rebuildable KV index: `poju-xhigh:client_task:{phase}:{session_id}:{client_task_id} → job_id`.
3. `getXhighJobByClientTaskId(...)` — index → verify job record authority → repair index when possible; ambiguity → `recovery_required` (no blind second create).
4. `createXhighJob` checks existing identity **before** `generateXhighJobId`; same identity returns existing job.
5. **J4 flagged:** shared store with lab/synthesis/final_delivery — same fields/API; no separate Lab policy invented.
6. **C1/C5 remain open** — not invented here.

### D. Tests

`pnpm test:generation-s2` → `scripts/test-generation-s2.ts`

Also keep green: `test:session-cas-s1`, `test:decision-context`, `test:decision-context-phase2`, `test:decision-context-phase2-idb`, `tsc`.

### E. Out of S2 (stopped)

S3 ControlPlane/Confirmation/Opening Anchor product wiring; S4 Normalize/Fingerprint/Mapper full product; Collecting redesign; Freeze; Stage4; PageFeed; BookJudgment; Lab product; 04; SoT16; merge/prod; real LLM/payment.

## Contract §4–§6 / §9 self-check

| Clause | Status |
|--------|--------|
| §4.1 identity fields | **DONE** (types + TaskContext/Registry/Binding/Job) |
| §4.2 session_id validation | **DONE** (`session-id.ts` on Generation APIs) |
| §4.3 uniqueness key | **DONE** (collision + registry helpers) |
| §4.4 no identity degradation | **DONE** (hard-fail + Reload restore) |
| §5.1 Registry completed-only | **DONE** |
| §5.2 Operation Binding | **DONE** |
| §5.3 collision order before skip | **DONE** (`collision.ts` + tests) |
| §6.1 status machine exact | **DONE** (no invented states) |
| §6.2 legal transitions | **DONE** |
| §6.3 two-phase pending_create + bind | **DONE** (infra; product Call A/B UI deferred) |
| §6.4 Reload restore | **DONE** |
| §8 C1 generation commit contents | **DONE** for Registry/Binding/Task/DC/keys/revs; ControlPlane **product type deferred S3** (if-present opaque only) |
| §9.1 Path A | **DONE** |
| §9.2 Path B + GenerationReplayResult | **DONE** |
| §9.3 Path C | **DONE** |
| §9.4 hard-fail (no Path C degrade) | **DONE** |
| §9.5 path priority B→C→A | **DONE** |
| §22 Job recovery evidence | **DONE** equivalent recovery (field + index + getByClientTaskId); OpenRouter metadata query still **not assumed** |

## Ambiguities refused

- **C1** — full product C1 ControlPlane coupling left to S3; S2 only accepts optional opaque slice.
- **C5** — not invented.
- **J4** — rem CLOSED (see PHASE3-J4-JOB-STORE-ISOLATION.md / FINAL-ACCEPTANCE).

## Job recovery evidence vs S0

| S0 gap | S2 evidence |
|--------|-------------|
| `client_task_id` ABSENT on job | field on `PojuXhighJob` + create input |
| index ABSENT | `xhighClientTaskKey` / KV put on create |
| `getXhighJobByClientTaskId` ABSENT | implemented with authority verify + index repair + `recovery_required` |
| blind retry second job | create checks identity before `generateXhighJobId` |

*Generated America/Chicago · S2 writeup*
