# PHASE3-S0-GENERATION-JOB-INVENTORY

> Phase 3 S0 — read-only inventory. No business code. No S1.
>
> Authority: Final Engineering Contract (23 sections, highest) + Locked Final Implementation Mapping §2.3–2.4 (`/workspace/eos-w0-sot/PHASE3-FINAL-IMPLEMENTATION-MAPPING-2026-11-03.md`). Superseded sources not used.

## Baseline verification

| Field | Value |
|-------|-------|
| Branch | `feat/decision-context-phase1` |
| HEAD SHA | `96cf819d26bbbb7a1eb174848fb0366c1eebfe9f` |
| Required baseline | `96cf819d26bbbb7a1eb174848fb0366c1eebfe9f` |
| HEAD == baseline? | **YES** |
| Ahead / behind | `0 / 0` |
| Mapping SoT | Box `/workspace/eos-w0-sot/PHASE3-FINAL-IMPLEMENTATION-MAPPING-2026-11-03.md` |

---

## 1. Formal identity requirement (Mapping §2.4) vs code today

| Requirement | Status @ `96cf819d` |
|-------------|---------------------|
| Stable `client_task_id` on create | **ABSENT** |
| Identity `session_id + generation_type + client_task_id` | **Not implemented** as Job fields |
| Idempotent create by that identity | **Not implemented** |
| KV index `poju-xhigh:client_task:{phase}:{session_id}:{client_task_id} → job_id` | **ABSENT** |
| `getXhighJobByClientTaskId(...)` | **ABSENT** (no symbol/function in repo) |
| Job record stores verifiable create identity | Job stores `job_id`, `phase`, `session_id`, `locale`, `status`, `input`, … — **no `client_task_id`** |

Evidence:

- `lib/poju/xhigh-job-types.ts` `PojuXhighJob` interface: fields listed above; **no `client_task_id`**.
- `lib/poju/xhigh-job-store.ts` `createXhighJob` input: `{ phase, session_id, locale, job_input, deploy_generation? }` only.
- KV keys implemented: `poju-xhigh:job:{job_id}`, `poju-xhigh:latest:{phase}:{session_id}`, `poju-xhigh:lock:{phase}:{session_id}`.
- Full-repo `git grep client_task_id` / `getXhighJobByClientTaskId` / `clientTask` over `*.ts`/`*.tsx`/`*.md` in app+lib: **zero hits**.

### Explicit conclusion — reverse lookup

**Cannot reverse-lookup a Job by `client_task_id` today.** There is no field, no index, and no API. Lookup surfaces are only:

1. `getXhighJob(job_id)` — primary key KV get  
2. `findLatestXhighJobForSession(phase, session_id)` — latest pointer only (last writer wins; not create-identity)

---

## 2. Job entry inventory (Mapping §2.3 seed + full-repo)

### 2.1 Create path — Call A

| Role | Path | Function | Notes |
|------|------|----------|-------|
| Client create | `lib/poju/phases/segment2/control.ts` | `createSegment2XhighJob` | Browser-only; `POST /api/poju/breakthrough-core` with session/agent/base_analysis; **no client_task_id** in body |
| API | `app/api/poju/breakthrough-core/route.ts` | POST handler | May resume via `resume_job_id` / latest; calls `createXhighJob` |
| Store | `lib/poju/xhigh-job-store.ts` | `createXhighJob` | Writes job KV + latest index; generates `job_id` via `generateXhighJobId(phase, session_id)` (time+random — **not** client-stable) |

### 2.2 Create path — Call B

| Role | Path | Function | Notes |
|------|------|----------|-------|
| Client create | `lib/poju/phases/segment2/control.ts` | `createSegment2AgendaJob` | `POST …/breakthrough-core/agenda` |
| API | `app/api/poju/breakthrough-core/agenda/route.ts` | POST | `createXhighJob` + latest |

### 2.3 Other production Job creates (same store; out of Stage1–3 product wiring but same recovery gap)

| Path | Phase |
|------|-------|
| `app/api/poju/synthesis/route.ts` | `synthesis` |
| `app/api/poju/final-delivery/route.ts` | `final_delivery` |
| `lib/llm/pro/delivery/lab/pipeline-jobs.ts` | Lab pipeline creates (lab) |

### 2.4 Orchestration / pending

| Entry | Path | Behavior |
|-------|------|----------|
| `startSegment2AfterGateConfirm` | `segment2/control.ts` | Gate → create Call A job; returns session + job_id |
| Regenerate / agenda starters | `segment2/control.ts`, `POJUChatUI.tsx`, `phase-router.ts` re-exports | Re-enter create + pending |
| `withPendingSegment2Job` | `segment2/control.ts` | Stamps `pending_segment2_job_id` / stage on **session state** (local); persisted only when caller `savePOJUSession` |
| `clearPendingSegment2Job` | same | Clears pending fields |

### 2.5 Query / poll / terminal

| Type | Entry | Path |
|------|-------|------|
| Get by id | `getXhighJob` | `xhigh-job-store.ts`; used by status routes, runners, cancel/continue |
| Latest by session | `findLatestXhighJobForSession` | store; used on create races / resume |
| Status HTTP | `GET/POST` breakthrough-core/status, synthesis/status, final-delivery/status | poll + complete/fail side effects |
| Poll client | `pollBreakthroughCoreJobUntilDone` | `lib/poju/poll-segment2-xhigh-job.ts`; UI `Segment2AnalysisPreparing.tsx`; also deepseek breakthrough-core |
| Related polls | `poll-synthesis-xhigh-job.ts`, `poll-final-delivery-job.ts` | Same job_id model |
| Complete | `completeXhighJob` | store; runners `xhigh-job-runner.ts`, `final-delivery-stage-runner.ts`, status routes |
| Fail | `failXhighJob` | Widespread: status, cancel, continue, inngest, runners, ephemeral |
| Lock | `acquireXhighSessionLock` / `releaseXhighSessionLock` | Concurrent session lock (not client_task identity) |
| Ephemeral | `runWithEphemeralXhighKv` / `xhigh-ephemeral-run.ts` | In-memory KV when durable KV fails — terminal must return on same response |

### 2.6 Reload / resume paths observed today

| Mechanism | What it uses | Gap vs §2.4 |
|-----------|--------------|-------------|
| Client holds `job_id` / `pending_segment2_job_id` in session blob | Resume poll by `job_id` | Works only if local pending survived; **lost if bind failed before save** |
| `resume_job_id` on POST body | `getXhighJob` | Requires knowing job_id |
| `findLatestXhighJobForSession` | Overwrites latest on every create | Ambiguous if multiple jobs; **not** create-identity; concurrent create can orphan prior |
| HTTP response lost after `createXhighJob` succeeded | Latest may point to new job; client has no client_task to reclaim | **Blind retry creates another job** (new random job_id) — violates §2.4 must-not |

---

## 3. Job data / KV structure (today)

```
PojuXhighJob {
  job_id, phase, session_id, locale, status,
  accumulated_content, current_stage?, deploy_generation?,
  input, result?, llm_debug?, model?, tokens_used?, lab_call_traces?,
  error?, error_detail?, retryable?, failure_reason?,
  created_at, updated_at, completed_at?
}

KV:
  poju-xhigh:job:{job_id}           -> PojuXhighJob
  poju-xhigh:latest:{phase}:{sid}   -> job_id
  poju-xhigh:lock:{phase}:{sid}     -> timestamp (nx lock)
```

`job_id` format: `{prefix}_{sessionSlug}_{Date.now()}_{random}` — **not stable across retries**.

---

## 4. Verifiable equivalent recovery conclusion (Mapping §2.4 / M0-D style)

Because **`client_task_id` reverse-lookup does not exist**, S0 records the Mapping-required **equivalent recovery design** for S2 implementation (inventory only — not implementing):

1. **Job record is authority** for create identity: on create, **MUST** persist `client_task_id` (and generation identity fields) **inside** the `PojuXhighJob` value written to `poju-xhigh:job:{job_id}` before acknowledging success.
2. **KV index (non-authoritative, rebuildable):** `poju-xhigh:client_task:{phase}:{session_id}:{client_task_id} → job_id`. If index set fails after job write, rebuild by: (a) if caller still has `job_id`, re-put index from job record; (b) on retry with same identity, if index miss, **do not** blind-create — consult Mapping Reload order with durable pending + latest **only as candidate**, then **verify** job.metadata.client_task_id matches; if match, repair index; if multiple candidates / mismatch → `recovery_required`.
3. **Concurrent uniqueness:** create path must check index (and/or lock) for existing `(phase, session_id, client_task_id)` before `generateXhighJobId`; identical identity returns existing job; never second job for same identity. Session lock alone is insufficient (different client_tasks may coexist per Contract — uniqueness is per client_task identity).
4. **Reload order (Mapping):** read local GenerationTaskContext → keep original `client_task_id` / generation / base / fingerprint → `getXhighJobByClientTaskId` → bind if verified → ambiguity → `recovery_required` → **forbid** new generation identity / unconditional second Job.
5. **No durable pending ⇒ cannot submit remote job** (Mapping step). Today pending is only session fields + in-flight job_id; S2 must make pending durable under CAS before create.

**Do not assume the server already supports client_task lookup — verified absent.**

---

## 5. Tests touching Job surface (existing)

| Script / area | What it asserts |
|---------------|-----------------|
| `scripts/test-breakthrough-core-kv-plan-limit.ts` | create/get under ephemeral KV |
| `scripts/test-segment2-pending-resume.ts` | `withPendingSegment2Job` session fields |
| `scripts/test-poju-block91-segment2-xhigh-job.ts` et al. block tests | String/presence of create/poll/complete wiring |
| Status/route block tests | failXhighJob / createXhighJob presence |

**Needed for later S2 (not S0 code):** client_task idempotent create, index rebuild, Reload bind, concurrent uniqueness, recovery_required ambiguity.

---

## 6. Technical conflicts (no invented policy)

| # | Issue | Options |
|---|-------|---------|
| J1 | Latest-only index vs §2.4 identity | Add client_task index + field; keep latest as UX convenience only |
| J2 | Random `job_id` vs stable client identity | Keep server `job_id`; add client_task as create identity (Mapping) |
| J3 | Ephemeral KV path | Same identity rules must apply or Mapping-forbid submit without durable pending — S2 |
| J4 | Lab/synthesis/final_delivery share store | **CLOSED (rem)**: phase+session keys + strict `generation_type` match when supplied; resume phase guards; Lab omits Phase3 fields (semantics preserved). See `PHASE3-J4-JOB-STORE-ISOLATION.md`. Tests P3-144–147. |

---

## 7. S0 Job gate checklist

- [x] Baseline verified
- [x] Seed Job entries inventoried + extra create sites noted
- [x] **`client_task_id` reverse-lookup = NO** with evidence
- [x] Verifiable equivalent recovery (Job authority + KV rebuild + uniqueness) documented per §2.4
- [ ] **Awaiting Max/Grok S0 验收** before S1

---

*Generated 2026-11-03 America/Chicago · S0 inventory only*
