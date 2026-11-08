# S9 — Production N/A Authority Sources (implementation evidence)

Parent: `9254ffddca90c214d1f46fdb5537ca360cd25bfa`
Branch: `feat/s9-production-na-authority-sources`
Git state: unmerged / undeployed (push only)

## Authority matrix

| Source | Status | Notes |
|---|---|---|
| topicRules | wired | ACTIVE TypeScript SSOT + Session eval writer + composer |
| cfpSourceState | wired (browser live reader) | `readLiveCfpSourceState`; Session identity; fail-closed on read error; no client injection |
| catalogConditionEvals | still fail-closed | ACTIVE DIR Catalog conditions are mostly `explicit_*` user declarations; no clear deterministic machine rules in code SSOT — intentional gap, not forged |

## Production call paths (unified composer)

All four paths call `buildProductionNaValidationContextFromSession` (async):

1. Freeze — `buildFreezeNaValidationFromSession` / `freeze-to-delivery` / `production-freeze-wire`
2. Versioning / V2 — `production-versioning`
3. Lifecycle / Collecting — `production-dc-lifecycle` / `collecting-dc-turn`
4. Ask / Question Planner — `production-intake-ask` / `selectNextIntakeAskForSession`

## Known gaps

1. `catalogConditionEvals` remain fail-closed (no invented evaluators).
2. Live CFP reader is Session/browser-bound (IndexedDB Never Stored). Server composers do not forge server-verified CFP.
3. S9 does not claim Stage 3.2 Adaptive Question Engine complete.
4. No merge / deploy authorized.

## Local verification (America/Chicago)

Raw logs under `raw/`. Suites exercised include S7 PAB, S8 (barrel/agent/delivery/freeze-persist/versioning-idb), S9 20 checks, dir-catalog, freeze-authority, freeze-versioning, production-agg, write-freeze-consistency, Stage4, PageFeed, S5–S6, `test:decision-context`, `tsc --noEmit`, `typecheck:intake-r6-tests`, `verify:terms`.

CI: GitHub Actions on push of this branch (phase3-decision-context.yml includes S9 step + branch trigger).

## S9-R1..R5 REQUEST CHANGES follow-up (same branch)

Fixes (do not self-ACCEPTED):

1. **S9-R1 Topic writer** — confirmation_turn_id must bind a real Session *user* message with meta.topic_applicability_confirm (session_id/rule_id/control_id/target_dir_id). Production UI entry: confirmTopicApplicabilityEvalFromUiClick wired from POJUChatUI topic offer chips. Decline/skip/ordinary chat cannot mint N/A. Tests cover missing/assistant/cross-session/forged turns + full CAS entry via injected load/casWrite.
2. **S9-R2 Topic catalog version** — currentTopicCatalogVersion always ACTIVE Loader. Session version is verified object only. Session=v0+Eval=v0 against ACTIVE=v1 fail-closed.
3. **S9-R3 CFP provenance** — getStoredProfileWithRecord returns outer IndexedDB Record + decrypted data; recompute irth_info_hash and compare. Missing/mismatch → source_provenance_missing (never degrade to source_ok). Tests use real Record/Data shapes.
4. **S9-R4 CFP eval bind** — Composer attaches cfpLiveEvaluation (eval_id/source_code/profile_id/session_id). DDR-03 validator requires equality to live read; forged/stale/cross-session eval ids rejected.
5. **S9-R5 Four-path test** — S9-16 drives Freeze / 
eaggregateDirsOnSession / selectNextIntakeAskForSession / pplyV2FromFinalToSession and asserts DIR 
_a + NA reason agreement.

Authority matrix honesty after R-fixes: topicRules wired (with real confirm+CAS); cfpSourceState wired (browser Record provenance + live eval bind); catalogConditionEvals still fail-closed.
