# Authority Gaps & Production Sources (S6)

**Code constant:** `PRODUCTION_NA_VALIDATION_SOURCE_GAPS` in  
`lib/poju/decision-context/na-validation-from-session.ts`

```ts
export const PRODUCTION_NA_VALIDATION_SOURCE_GAPS = [
  "dirCatalog — no Session/DC DIR N/A catalog store or loader",
  "catalogConditionEvals — no production catalog-condition eval store",
  "topicRules — no production TopicApplicabilityRule store (Session only has topic_applicability_evals + topic_catalog_version)",
  "cfpSourceState — no production CFP live source-state reader wired into aggregation",
] as const;
```

## Freeze path vs general adapter

| Field | Freeze (`buildFreezeNaValidationFromSession`) | General `buildNaValidationContextFromSession` | Severity |
|---|---|---|---|
| Confirmation Events | Session only (caller stripped) | Session default; override possible if caller uses this helper directly | Freeze: closed |
| N/A Declaration Actions | Session only | Session default; overrideable on helper | Freeze: closed |
| Topic Eval Authority | Session `topic_applicability_evals` | Session default; overrideable on helper | Freeze: closed |
| Topic Catalog Version | Session `topic_catalog_version` | Session / override | Freeze: closed |
| Reality Facts / Constraints / Classifications | Authoritative Session DC draft | DC / override | Freeze: closed |
| **DIR N/A Catalog** | **ACTIVE `loadDirNaCatalog` only** (caller dirCatalog stripped) | Gap unless caller supplies `dirCatalog` | Freeze: **production ACTIVE closed**; constant text still notes no Session/DC catalog **store** |
| **topicRules** | May pass through after strip (`catalogOrCfpAuthority`) — **not Session SoT** | Caller-supplied only | **AUTHORITY_GAP** |
| **catalogConditionEvals** | May pass through | Caller-supplied only | **AUTHORITY_GAP** |
| **cfpSourceState** | May pass through | Caller-supplied only | **AUTHORITY_GAP** |

## Answers required by S6 §6

1. **Production-grade Freeze authorities:** Confirmation Events, N/A Actions, Topic Eval rows, Topic Catalog Version, Reality Facts, Constraints, Explicit N/A Classifications, DIR N/A Catalog (ACTIVE loader).
2. **Still caller-providable on Freeze (gaps):** `topicRules`, `catalogConditionEvals`, `cfpSourceState` (and other non-stripped gap fields in `...catalogOrCfpAuthority`).
3. **Fail-closed when missing (for user_explicit_na / topic paths that need them):** missing classification/action/E1/catalog membership → no N/A; missing topic authority row → topic N/A rejected; ACTIVE catalog load fail → FreezeError.
4. **Reliability impact:** For Stage 3.2 DIR user N/A + Freeze ACTIVE compose + Session event SoT, core path is closed. Topic N/A still depends on test/caller-supplied **topicRules** structure even when Session eval wins (F3/F4 scope).
5. **Deferred to later stages:** Topic Rules Session SoT; Catalog Condition Eval store; CFP live source-state reader; DC-7b schema pin; S3 ensure persist-fail production-path Tier B.

## Classification

| Item | Class |
|---|---|
| topicRules Session SoT absent | **AUTHORITY_GAP** · NON_BLOCKING_DISCLOSED for Stage 3.2 user-N/A slice (F3/F4 still valid for Session eval priority) |
| catalogConditionEvals store absent | **AUTHORITY_GAP** · NON_BLOCKING_DISCLOSED for this slice (system catalog-condition N/A not Stage 3.2 vertical claim) |
| cfpSourceState reader absent | **AUTHORITY_GAP** · NON_BLOCKING_DISCLOSED (DDR-03 paths covered by other suites with explicit cfp injection) |
| Gap list still saying “dirCatalog — no loader” | **Documentation nuance**: Freeze has ACTIVE loader; no Session-persisted catalog version pin (related to deferred DC-7b) |
