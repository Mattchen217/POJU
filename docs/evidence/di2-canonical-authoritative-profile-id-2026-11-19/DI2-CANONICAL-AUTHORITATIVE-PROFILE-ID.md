# DI2 P0 — Reject Non-canonical Authoritative Profile IDs

Times below are America/Chicago (UTC-6).

Closes the remaining Session-binding canonicity gap: a non-canonical authoritative profile ID fails closed and must not be repaired or bypassed via `agent_v2.selected_profile_id`. Not a DI2 acceptance declaration; not live OpenRouter evidence.

## Baseline

- Branch: `feat/m1-r-fresh-session-main-loop`
- Parent SHA: `ab39bed9d989048d5d0d8ecb386bbaf682e99936`
- Implementation commit: `a0a17fafe7d15b44a303dc2dad12db7ba30bd103`
- No PR, merge to `main`, deploy, rebase, or force-push.

## What changed

`authoritativeBoundProfileId()` now:

- Rejects leading/trailing whitespace and whitespace-only Session binding IDs without trimming/rewriting them into canonical form
- Does **not** fall back from a malformed non-empty `selected_stored_profile_id` to `agent_v2.selected_profile_id`
- Preserves null/absent binding behavior
- Keeps exact equality: `profile.id === claimed_stored_profile_id === boundId`

## Trust boundary (explicit)

The server verifies ID declaration consistency with the authoritative Session binding. It does **not** cryptographically prove local stored-profile content provenance.

## Commands and exit codes

| Command | Exit | Result |
|---|---|---|
| `pnpm test:di2-browser-authoritative-chat-integration` | 0 | 16 passed, 0 failed |
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

- Live OpenRouter + real stored profile
- Hosted Redis multi-instance CAS
- Staging Playwright browser E2E

## Limits / non-claims

- Does **not** declare DI2 acceptance or PASS.
- Does **not** claim cryptographic proof of local profile-content provenance.
