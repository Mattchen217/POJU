# DI2 P0 — Bind Profile Payload Identity to Authoritative Session

Times below are America/Chicago (UTC-6).

Closes the remaining profile-identity gap: client-supplied `profile` content must belong to the claimed / authoritative Session binding. Not a DI2 acceptance declaration; not live OpenRouter evidence.

## Baseline

- Branch: `feat/m1-r-fresh-session-main-loop`
- Parent SHA: `364ac9c8a782dabd9c5a5b527791ae5488d113f7`
- Implementation commit: `241440dcf25b536973cf2b0fe5c64ac601862973`
- No PR, merge to `main`, deploy, rebase, or force-push.

## What changed

1. `resolveAuthoritativeChatProfileInputs` now requires:
   - `profile.id === claimed_stored_profile_id === authoritativeBoundProfileId(serverSnapshot)`
   - Fail closed with `invalid_session_request` before `handleUserMessage` / model / CAS
2. Non-null `base_analysis` must be a plain JSON object (not string/number/boolean/array); size cap unchanged
3. `loadSessionProfileBundle` stamps the stored-profile row UUID onto `user_profile.id` so the browser payload identity matches the Session binding (chart engines mint a birth-derived id)

## Commands and exit codes

| Command | Exit | Result |
|---|---|---|
| `pnpm test:di2-browser-authoritative-chat-integration` | 0 | 14 passed, 0 failed |
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

- Live OpenRouter with a real stored profile
- Hosted Redis multi-instance CAS
- Staging Playwright browser E2E

## Limits / non-claims

- Does **not** declare DI2 acceptance or PASS.
- Deterministic / hook-based suites only.
