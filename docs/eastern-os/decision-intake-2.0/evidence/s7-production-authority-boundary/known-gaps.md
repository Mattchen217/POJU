# S7 · Known gaps, UNTESTED and disclosures

Code HEAD `8048aaaee9df1de1b48782c577a70aec8041f5c5`. Status of S7 itself is for independent review;
nothing here declares S7 PASS / ACCEPTED.

## AUTHORITY_GAP (open, fail-closed)

| Field | Production source | Effect in production |
|---|---|---|
| `topicRules` | none | topic-based DIR N/A always rejected (`topic_rule_missing`) on all four paths |
| `catalogConditionEvals` | none | catalog-condition DIR N/A always rejected (`catalog_eval_missing`) |
| `cfpSourceState` | none | DDR-03 system N/A always rejected (`ddr03_cfp_not_absent`) |

`topic_applicability_evals` / `topic_catalog_version` are Session-sourced, but without `topicRules`
they cannot authorize anything in production. Topic Rules / catalog-condition / CFP readers were
explicitly out of scope (not added).

## UNTESTED

- **agent.ts collecting catch** — `lib/poju/agent.ts` (~L1348–1373) wraps
  `persistCollectingUserTurnDc` + `selectNextIntakeAskForSession` in try/catch and only reassigns
  `sessionOut` after a successful await. Not exercised end-to-end (requires the LLM turn pipeline).
  Covered one level down: PAB F4 proves the persist call rejects before C1 and IndexedDB keeps the
  prior DC/messages; PAB F5 proves Ask throws without a plan. agent.ts-level = code inspection only.
- **S3** `[production-path] ensureSessionFrozenForDelivery persist-fail branch` — baseline UNTESTED, unchanged.
- **S4** `[disclose] freeze-versioning F1` — baseline disclosure line, unchanged.
- **Versioning loader fault with IndexedDB** — PAB F2 is in-memory: `persistV2FromFinalOnSession`
  returns `ok:false` before importing/calling C1. No IDB-backed V2 fault run.

## Disclosures

1. **Fault-injection method.** ACTIVE loader failure is produced by a test-local patch of
   `Map.prototype.has` that throws only when the receiver is the module-private production registry
   (identified by `entries === DIR_NA_CATALOG_V1_ENTRIES`), restored in `finally`. It exercises the
   real `loadDirNaCatalog` → `resolveDirNaCatalog` exception boundary (`dir_catalog_load_failed`).
   No production seam, exported registry, env var or `as any` is used. Other loader reason codes
   (`missing` / `invalid` / `unknown` / `ssot_unavailable`) are not reachable through production with
   the hard-coded ACTIVE version; their mapping stays covered by DCAT pure tests.
2. **Barrel exposure.** `lib/poju/decision-context/index.ts` (`export *`, not in S7 allowlist, untouched)
   still re-exports `naValidationBoundToDc` / `NaValidationFixtureOverrides`. PAB S1 asserts that no
   `lib/` or `app/` module other than the defining file references these names (covers aliases and
   named re-exports); it cannot stop a future import, it detects it.
3. **`scripts/` is excluded from `tsc`.** Old tests that still pass an `authority:` literal to
   `freezeDraftForDelivery` (S5 F1, WFC C23, DCAT DC-8) are not type-checked; at runtime the extra key
   reaches the production call and is ignored. PAB proves the same via non-literal opts objects.
4. **New guard in Freeze helper.** `buildFreezeNaValidationFromSession` now throws if
   `authoritative !== session.decision_context`. Both callers (Freeze, WFC helper) already pass that exact
   object; no production caller can hit it today.
5. **Behaviour change (intended, §2 of matrix).** Versioning, lifecycle reaggregation and Ask now use the
   ACTIVE catalog, so valid user N/A takes effect during collecting and survives V2. Prior to S7 these paths
   had no DIR catalog. Delivery/report consumers were not re-verified for the higher `n_a` frequency beyond
   the listed regression suite.
6. **Not changed:** C1–C5, DIR/DDR catalog content, explicit_na_evidence schema, Constraint.related_dir_ids,
   Session schema, topic eval lifecycle, Gate / Sufficiency / DDR composer, Question Budget / Review Cycle /
   ShowReceipt / AskPayload, FreezeRecord, PageFeedMatrix / report / delivery, UI / Prompt / LLM, DB.
