# M2.2 Implementation Evidence

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent (M2.1 accepted tip):** `2526c98e01528fe1966c5548ba261a8df2b0eb34`  
**Not self-PASS.** No PR / merge / deploy / tip.

## Call chain

```
requestFreezeBoundEightPageReport(session, freezeId)
  → loadAuthoritativeFreeze (prefer decision_context_versions[]; never draft)
  → verifyFrozenSnapshot (assertSnapshotMatchesBinding + computeContentHash)
  → createFrozenReportSnapshot (detached JSON clone + freeze)
  → createOrGetReportJob (persist ReportBinding BEFORE any page call)
  → generateEightPageReport / runGenerationOnJob
       for each DECISION_PAGE_IDS page: generatePage(same snapshot)
  → assertCompleteEightPageReport (exactly 8 non-empty unique pages)
  → persist status=completed
```

## Snapshot / hash

- Freeze authority = M2.1 binding triple.
- `freezeId = ${context_id}@v${context_version}`.
- Hash verifier is the existing M2.1 `computeContentHash` / `assertFrozenDcIntegrity` path — no second hash definition.
- Draft DC after Freeze is ignored; missing version / hash mismatch / invalid Freeze → fail-closed; no completed report.

## Eight pages

- All pages receive the identical `FrozenReportSnapshot` object.
- Default generator stamps freezeId/version/hash via `formatDecisionContextSliceForPage` (no LLM required for contract tests).
- Injectable `generatePage` for LLM mocks; page generators must not fetch mutable session DC.

## Persistence / idempotency / retry

- Jobs stored on `session.freeze_bound_report_jobs` (+ pin `last_delivery_context_binding`).
- Idempotency key: `sessionId:freezeId:reportSchemaVersion`.
- Concurrent duplicates coalesce via process-local in-flight gate registered before any await.
- Failed → retry under original binding; completed pages reused only when binding+pageId match.
- Retry re-verifies hash; never replaces freezeId/version/hash.

## Tests / commands

| Command | Result |
|---|---|
| `pnpm test:m2-2-freeze-report-binding` | 21/21 PASS, exit 0 |
| `pnpm test:m2-1-readiness-confirm-freeze` | 19/19 PASS, exit 0 |
| `pnpm exec tsc --noEmit` | PASS, exit 0 |
| `pnpm build` | PASS, exit 0 |

Coverage: A1–A5, B1–B4, C1–C4, D1–D3, E1–E3, E2E, unit helpers.

## Files

- `lib/poju/decision-intake/freeze-bound-report.ts` — orchestration
- `lib/poju/decision-intake/index.ts` — exports
- `lib/poju/types.ts` — `freeze_bound_report_jobs`
- `scripts/test-m2-2-freeze-report-binding.ts` — suite
- `package.json` — `test:m2-2-freeze-report-binding`
- evidence docs in this folder

## Known limitations

- Default page body is Freeze-bound feed dump, not a rewrite of production LLM face prompts; production LLM wiring can inject `generatePage` / feed `FinalDeliveryJobInput` from the same snapshot later without changing binding guarantees.
- In-flight coalescing is process-local; durable uniqueness is the session job key after persist.
- Does not open PR / merge / deploy; waiting Max independent review.
