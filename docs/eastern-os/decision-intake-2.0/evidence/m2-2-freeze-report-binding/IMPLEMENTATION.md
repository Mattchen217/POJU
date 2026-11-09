# M2.2 Implementation Evidence (updated R1)

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**See also:** `CONTRACT-FIX-R1.md`, `CONTRACT-FIX-R2.md`  
**Not self-PASS.** No PR / merge / deploy.

## Call chain (authoritative)

```
requestFreezeBoundEightPageReport / prepareFreezeBoundFinalDelivery[+Server]
  → loadAuthoritativeFreeze (prefer decision_context_versions[]; never draft)
  → createFrozenReportSnapshot (deepDetach + recursive deepFreeze)
  → cross-process claim (KV SET NX on server; injectable in tests)
  → createOrGetReportJob (persist ReportBinding BEFORE page/LLM)
  → existing final-delivery pipeline consumes same FrozenReportSnapshot fields
  → assertCompleteEightPageReport / completeFreezeBoundReportFromDeliveryPages
```

## Files

- `lib/poju/decision-intake/freeze-bound-report.ts` — orchestration + deep freeze + process-local claim default
- `lib/poju/decision-intake/freeze-report-claim.ts` — server-only Upstash/KV claim
- `lib/poju/decision-intake/freeze-bound-report-server.ts` — server entry injects KV claim
- `lib/poju/decision-context/production-freeze-wire.ts` — resolveDeliveryDcPayload → M2.2 Freeze
- `lib/llm/pro/final-delivery.ts` — persist Freeze-bound job before POST
- `app/api/poju/final-delivery/route.ts` — M2.2 snapshot + server prepare
- `scripts/test-m2-2-freeze-report-binding.ts` — 24 cases
