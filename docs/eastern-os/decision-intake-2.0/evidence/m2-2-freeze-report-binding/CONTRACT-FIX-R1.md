# M2.2-R1 Contract Fix — Cross-process claim + Final-delivery Freeze binding

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent:** `aa5f512c36c6518538890d09219b36a23ac47622`  
**Not self-PASS.** No PR / merge / deploy / tip.

## Blocker 1 — Cross-process claim

- Module: `lib/poju/decision-intake/freeze-report-claim.ts` (`import "server-only"`)
- Store: existing project KV (`@/lib/kv/client` → Upstash Redis `SET NX`, or MemoryKv locally)
- Same pattern as `acquireXhighSessionLock` / `tryAcquireDispatchTaskLease`
- Key: `poju-m22:freeze-report-claim:{sessionId}:{freezeId}:{reportSchemaVersion}`
- TTL: `KV_TTL.POJU_XHIGH_LOCK` (90m) so crash does not permanent-lock
- Acquire **before** job create + generation; only claim winner runs `runGenerationOnJob`
- Loser returns `GENERATION_IN_PROGRESS` (or completed reuse) — **does not** call `generatePage`
- Release on complete / fail / abnormal exit (`finally`)
- Expired claim → NX succeeds → continue from **original Freeze + original binding** only
- Client-safe default in `freeze-bound-report.ts`: process-local TTL map (does not import KV)
- Production server entry: `freeze-bound-report-server.ts` injects `defaultFreezeReportClaimOps`
- Tests: injectable shared `MemoryKv` + separate `inFlightMap`s (R1-C5)

## Blocker 2 — Formal final-delivery path

Call chain:

```
User confirm → M2.1 Freeze
  → resolveDeliveryDcPayload (loadAuthoritativeFreeze → FrozenReportSnapshot)
  → prepareFreezeBoundFinalDelivery[+Server] (persist Freeze-bound job)
  → FinalDeliveryJobInput.decision_context_snapshot + binding
  → Existing createXhighJob → runFinalDeliveryJob → eight-page LLM
       (pages already consume job.input.decision_context_snapshot via production-run / lab)
  → completeFreezeBoundReportFromDeliveryPages (bind-back helper)
  → Existing retrieval / freeze_bound_report_jobs / UI
```

Wired at:
- `lib/poju/decision-context/production-freeze-wire.ts` (`resolveDeliveryDcPayload`)
- `lib/llm/pro/final-delivery.ts` (persist Freeze-bound job before POST)
- `app/api/poju/final-delivery/route.ts` (M2.2 snapshot resolve + server prepare)

No second report pipeline; existing prompts/LLM unchanged. Draft DC after Freeze cannot become analytical input.

## Deep freeze

`createFrozenReportSnapshot` recursively deep-freezes snapshot + nested DC + binding (R1-C6).

## Tests

| Command | Result |
|---|---|
| `pnpm test:m2-2-freeze-report-binding` | 24/24 PASS, exit 0 |
| `pnpm test:m2-1-readiness-confirm-freeze` | 19/19 PASS, exit 0 |
| `pnpm exec tsc --noEmit` | PASS, exit 0 |
| `pnpm build` | PASS, exit 0 |

New: R1-C5 cross-process claim uniqueness; R1-C6 deep-freeze isolation; R1-C7 final-delivery bridge ignores draft.

## Limitations

- Browser-side `requestFreezeBoundEightPageReport` default claim is process-local; cross-process KV claim is on server-only wrapper / injected `claimOps`.
- Formal LLM page bodies still produced by existing final-delivery pipeline; `defaultGeneratePage` remains feed-dump for unit orchestration tests.
