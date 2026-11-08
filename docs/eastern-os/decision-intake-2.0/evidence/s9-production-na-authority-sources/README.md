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