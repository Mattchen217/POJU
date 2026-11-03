# PHASE3-J4-JOB-STORE-ISOLATION

> Phase 3 Remediation ITEM 9 / Max §9 — shared Job Store business isolation.
> HEAD at rem commit. Authority: Final Engineering Contract §6 / Mapping §2.4. No Contract invention.

## Acceptance

Shared storage ≠ shared business identity. Strict isolation across businesses, sessions, phases, and generation_type.

## Inventory — callers of `lib/poju/xhigh-job-store`

| Caller | Phase(s) | Uses `client_task_id`? | Uses `generation_type`? | Notes |
|--------|----------|-------------------------|--------------------------|-------|
| `app/api/poju/breakthrough-core/route.ts` | `segment2_breakthrough_core` | optional (Generation path) | optional (`call_a_hypothesis`) | Resume now phase-guarded (J4) |
| `app/api/poju/breakthrough-core/agenda/route.ts` | `segment2_agenda_bridge` | optional | optional (`call_b_dir`) | Resume phase-guarded |
| `app/api/poju/breakthrough-core/status/route.ts` | (by job_id) | — | — | Status/fail/complete |
| `app/api/poju/synthesis/route.ts` + status | `synthesis` | optional | no | Resume phase-guarded |
| `app/api/poju/final-delivery/*` + Inngest + runners | `final_delivery` | optional | no | Already checked `job.phase === final_delivery` |
| `lib/llm/pro/delivery/lab/pipeline-jobs.ts` | segment2_a/b + synthesis | **no** | **no** | Lab-style create; latest/lock per phase+session |
| `lib/poju/generation/*` | via create + bind | **yes** | **yes** | Registry/TaskContext identity; does not create Lab jobs |
| Tests (phase3 job/e2e/s2, block91, …) | mixed | mixed | mixed | |

Re-export: `lib/poju/shared/xhigh-job/index.ts`.

## Identity rules

KV keys already partition by **phase + session_id**:

- job: `poju-xhigh:job:{job_id}` (job_id prefix encodes phase: s2a/s2b/syn/fd)
- latest: `poju-xhigh:latest:{phase}:{session_id}`
- client_task index: `poju-xhigh:client_task:{phase}:{session_id}:{client_task_id}`
- lock: `poju-xhigh:lock:{phase}:{session_id}`

`getXhighJobByClientTaskId` / create NX recovery use `jobMatchesIdentity`:

1. `job.phase === input.phase`
2. `job.session_id === input.session_id`
3. `job.client_task_id === input.client_task_id`
4. **J4:** if caller supplies `generation_type`, require `job.generation_type === input.generation_type` (Lab/legacy jobs missing the field do **not** match)

## Semantics preserved

- Lab / Synthesis / Final Delivery creates without Phase 3 fields still work (create, get by job_id, findLatest, locks).
- Phase 3 `client_task_id` + recovery is additive; absent fields keep pre-ITEM6 behavior.
- POJU Generation cannot recover into a Lab job: Lab omits `client_task_id`/`generation_type`; latest-candidate consult still requires identity match.

## Tests

P3-133–135 (ITEM6 / J4-lite), P3-144–147 (J4 rem).

## Gaps (honest)

- `getXhighJob(job_id)` itself is unscoped; callers must check phase (resume routes now do for Call A/B/synthesis; FD already did).
- Lab shares phase namespace with product segment2/synthesis when using the same `session_id` — isolation is via optional Generation fields + latest identity verify, not a separate Lab KV namespace (no Contract text for a fifth phase).
