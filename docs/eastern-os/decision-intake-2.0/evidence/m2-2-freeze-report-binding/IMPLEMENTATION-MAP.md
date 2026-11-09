# M2.2 Implementation Map (pre-code inspection)

| Concern | Existing implementation | Required change |
|---|---|---|
| Freeze creation | `lib/poju/decision-intake/confirm-and-freeze.ts` → `ensureSessionFrozenForDelivery` → `freezeDraftForDelivery` / `freezeDecisionContext` | Reuse |
| Freeze identity | `DecisionContextBinding` (`context_id` / `context_version` / `context_hash`); no separate Freeze table | Derive `freezeId = context_id@version` |
| Immutable DC version | `applyFreezeToSessionSlice` appends `version_snapshot` into `session.decision_context_versions[]` | Reuse; fail-closed if missing |
| Hash contract | `computeContentHash` + `assertFrozenDcIntegrity` / `assertSnapshotMatchesBinding` in `content-hash.ts` / `read-bound.ts` | Reuse same verifier on report path |
| Snapshot validation | `resolveDecisionContextForReport` / Stage4 helpers | Add `FrozenReportSnapshot` boundary + report-side re-hash |
| Eight-page IDs | `DECISION_PAGE_IDS` 01–08 in `page-feed-matrix.ts`; page feed via `formatDecisionContextSliceForPage` | Pass one snapshot into all pages |
| Existing delivery pipeline | `FinalDeliveryJobInput.decision_context_binding/snapshot`; lab/production-run | Do not rewrite prompts; M2.2 adds Freeze-bound orchestration entry |
| Report persistence | Session blob + `last_delivery_context_binding` | Extend with `freeze_bound_report_jobs[]` binding-before-LLM |
| Retry / idempotency | DC C1 keys; delivery job KV | Add `sessionId:freezeId:reportSchemaVersion` + in-flight coalesce |

**Blocker check:** immutable DC version IS persisted by M2.1 Freeze (`decision_context_versions`). Proceed.
