# DI2 mainline consolidation — 2026-11-22

Base: `origin/main` @ `4f17ee229a2a53c11086b5594a5e65f735bcb1af`

## Ported onto main (directed; not whole-branch merge)

1. Understanding Response JSON harden (fence strip + brace-balanced extract) while keeping report-driven schema/validators.
2. `invalid_json` single retry (2 model calls max; per-call `max_attempts: 1`).
3. Model status audit: `model_success` / `model_retry_succeeded` / `model_failed`.
4. On model failure: keep DC + user answer; **do not** authorize code-ranked plan ask as model success.
5. Server-side IndexedDB vault sync guards in `createPOJUSession` + `runPOJUSessionPostCommitSideEffects`.
6. Agent fail bubbles: natural language only; codes stay in meta/logs.
7. User-facing Eastern OS branding (activity / chat / paywall locales).

## Branch audit (unique production code)

| Branch | Verdict |
|---|---|
| `feat/di2-report-driven-intake` | Already in main (ancestor). |
| `feat/m1-r-fresh-session-main-loop` | Already in main. |
| `feat/m1-production-adaptive-question-loop` | Already in main. |
| `feat/decision-context-phase1` | Already in main. |
| `feat/s0`–`s9` NA/freeze series | Production code already in main; remaining uniques are evidence/logs or superseded plans. |
| `feat/s3-freeze-wire-reason-code` | Unique = S3 evidence packs + S4 plan doc only — **not** re-merged as authority. |
| `docs/decision-intake-2.0-phase-*` | Historical design docs; S2/S3 plan files remain branch-only (not promoted as SSOT). |
| `feat/di2-production-interaction-r1` | CAS/UI tips largely already on main; Understanding model on that branch is **older** (pre report-driven) — only JSON retry/vault/agent UX/branding patterns ported. **Did not** take `planAsk` masquerade fallback. |
| `cursor/di2-production-interaction-merge-a59c` | Ancestor of main (no unique commits). |
| `cursor/di2-merge-ts-hotfix-a59c` | Ancestor of main. |

## Tests run on main before push

- `pnpm exec tsc --noEmit` → pass
- `scripts/test-di2-report-driven-intake-r1.ts` → pass
- `scripts/test-di2-personalized-understanding-path.ts` → pass
- `scripts/test-di2-personalized-understanding-adaptive-wire.ts` → pass
- `scripts/test-di2-understanding-json-retry.ts` → pass (invalid_json → retry succeeds; fenced JSON first-shot)
- Live OpenRouter: `test-di2-personalized-understanding-openrouter.ts` → LIVE_SMOKE_OK (StreamLake)
- Live OpenRouter startup-choice prompt → `openrouter-startup-choice-first-turn.json` (`model_success`, attempt=1)

## Not claimed

This pack consolidates the mainline. It does **not** declare full DI2 product acceptance.
