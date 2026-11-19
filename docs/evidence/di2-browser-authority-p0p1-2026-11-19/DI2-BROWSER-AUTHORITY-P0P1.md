# DI2 Browser Authority — Final Integration Corrections (P0 / P1)

Times below are America/Chicago (UTC-6).

This records two production integration corrections on the server-authoritative DI2 browser path. It is **not** a DI2 / M9 acceptance declaration and not live OpenRouter evidence.

## Baseline

- Branch: `feat/m1-r-fresh-session-main-loop`
- Parent SHA: `b84f2dcc2bf7ca8e8c960286bc5c03582d735237`
- Implementation commit: `06b541266860f002c64b250b07c4b138fabedb44`
- No PR, merge to `main`, deploy, rebase, or force-push.

## What changed

### P0 — Personal profile / base_analysis delivery

1. `POJUChatUI.runUserTurn` (and dyad continue) loads `loadSessionProfileBundle(baseSession)` and passes `profile`, `base_analysis`, and `claimed_stored_profile_id` to `submitAuthoritativeChatTurn`.
2. Server `executeAuthoritativeChatTurn` validates payloads via `resolveAuthoritativeChatProfileInputs` against the authoritative Session binding (`selected_stored_profile_id` / `profile_skipped` / permitted state).
3. Shape + size fail-closed; mismatched claimed ids rejected; no fabrication on no-profile / profile_skipped.
4. DI2 Answer Interpretation / adaptive planning remain server-side.

### P1 — No local-only `original_question` mutation

1. Removed post-response local rewrite of `original_question` in `POJUChatUI`.
2. Server applies `applyAuthoritativeFirstTurnDisplayTitle` before Session CAS commit.
3. Browser mirrors only the committed snapshot; session list uses committed `original_question`.

## Commands and exit codes

| Command | Exit | Result |
|---|---|---|
| `pnpm test:di2-browser-authoritative-chat-integration` | 0 | 11 passed, 0 failed |
| `pnpm test:di2-feature-landing-main-path` | 0 | 22 passed |
| `pnpm test:m1-production-adaptive-question-loop` | 0 | PASS=188 FAIL=0 |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | 19 passed |
| `pnpm test:m2-2-freeze-report-binding` | 0 | 43 passed |
| `pnpm test:m2-3-decision-blueprint` | 0 | 18 passed |
| `pnpm test:m2-4-r2-production-closure` | 0 | PASS=20 FAIL=0 |
| `pnpm test:m5-di2-main-path` | 0 | 29 passed |
| `pnpm test:m5-r1-authorization` | 0 | 49 passed |
| `pnpm test:m6-di2-full-lifecycle` | 0 | 7 passed |
| `pnpm test:m9-server-authoritative-session` | 0 | passed |
| `pnpm exec tsc --noEmit --pretty false` | 0 | no diagnostics |
| `pnpm build` | 0 | Compiled successfully |

Raw logs: `logs/`.

## `public/sw.js`

Restored with `git checkout HEAD -- public/sw.js` after build. Object hash matches `HEAD:public/sw.js` (`1b0612a50b3a569e38c61ffeff9626175448257b`).

## Untested / remaining

- Live OpenRouter with a real stored profile payload
- Hosted Redis multi-instance CAS
- Staging Playwright browser E2E

## Limits / non-claims

- Does **not** declare DI2 or M9 acceptance.
- Deterministic / hook-based suites only — not live OpenRouter proof.
