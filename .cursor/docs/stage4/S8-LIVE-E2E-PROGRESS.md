# S8 · LAB live E2E progress

**Status:** engineering complete (chat→unlock→thesis) · **not** Stage 4 product quality PASS  
**Lab:** `lab_mw0zic7l_f3aa32ec` · `/ops/delivery-lab/lab_mw0zic7l_f3aa32ec`  
**Dumps:** `temp/s8-live/*.json`  
**Hold:** S9 until quality pass criteria clear · no merge / prod deploy

## Drivers

```bash
pnpm exec tsx scripts/s8-lab-live-e2e.ts
pnpm exec tsx scripts/s8-lab-resume-collect.ts <lab_id>
pnpm exec tsx scripts/s8-inspect-lab.ts <lab_id>
pnpm exec tsx scripts/s8-freeze-and-thesis.ts <lab_id>
```

Requires `.env.local` loaded **before** `@/lib/kv` import (`OPENROUTER_API_KEY` + `KV_REST_API_*`).

## Path exercised

| Stage | Result |
|---|---|
| Opening → understanding confirm | PASS (3 chat turns) |
| Call A → Call B | PASS · draft DC `hypotheses=6` `dirs=6` `facts≥4` |
| Collecting → awaiting_confirmation | PASS (agenda 6/6 covered) |
| Synthesis → delivery unlock | PASS · `cursor=ready_for_delivery` |
| Observation layer on pipeline turns | PASS · stages opening / segment2_a·b / collecting / synthesis |
| Freeze (sufficiency-only) | **SKIPPED** `not_sufficient` (DIRs still `unknown` / may_affect_p5) |
| bootstrap → thesis.gen approve | PASS · thesis approved · soft DC require allows proceed without freeze |

## Incidents / fixes

1. **Env after KV import** → in-memory KV. Fixed: `loadEnvLocal()` then dynamic imports in S8 scripts.
2. **`Sail Research` → lock `sail research`** → turn2 404 queue. Fixed: `providerMatchesOrderEntry` compact space/hyphen (`lib/llm/openrouter-provider-routing.ts`).
3. **Collecting loop too short** → resume driver; main E2E now 12 collecting turns.
4. **LAB synthesis lacked Freeze wire** → wired `applySufficiencyFreezeToSession` + seed binding/snapshot in `seedLabSourceFromChat` (`pipeline-jobs.ts`). This lab still skipped Freeze because sufficiency failed (correct behavior).

## Observation / DC notes

- Chat / Call A·B / synthesis observations present; `has_formal_dc=false` on chat turns (expected under soft require).
- After Call A/B: draft DC populated (facts/hypotheses/dirs).
- After collecting: agenda all `covered`, but DIR `current_state` remained `unknown` → `evaluateDecisionSufficiency.canStop=false` → Freeze correctly refused.
- Soft require: delivery unlocked + thesis ran with `binding=null` / `dc=draft`.

## Open (not S8 blockers)

- DIR status not advanced to `known` when agenda item covered (sufficiency never trips on this path).
- Full face body generation (01–08) not run in this session — unlock + thesis + observation dumps are the S8 bar here.
- S9 held until product quality PASS criteria are explicit.

## Soft rules still in force

Soft DC require · Freeze sufficiency-only · no merge · no prod deploy · Stage 4 quality unaccepted.
