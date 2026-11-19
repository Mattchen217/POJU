# DI2 — Remove Profile ID Normalization Before Binding Comparison

Times below are America/Chicago (UTC-6).

Strict exact-string identity comparison for authoritative chat profile intake. Not a DI2 acceptance declaration; not live OpenRouter evidence.

## Baseline

- Branch: `feat/m1-r-fresh-session-main-loop`
- Parent SHA: `4594ad5da36dcdf73904b70c8a0d7cc1bccd1454`
- Implementation commit: `3e70f446b39b3b1b90a7a6194336ce490ea74086`
- No PR, merge to `main`, deploy, rebase, or force-push.

## What changed

`resolveAuthoritativeChatProfileInputs` no longer trims or rewrites IDs used for binding comparison:

- `claimed_stored_profile_id` is read as supplied (whitespace-only → reject)
- Authoritative Session bound id uses the stored string as-is (no `.trim()`)
- Required exact equality: `profile.id === claimed_stored_profile_id === boundId`

Whitespace-padded claimed or profile ids are rejected, not normalized.

## Trust boundary (explicit)

The browser still loads personal-analysis payloads from local storage and submits them. The server verifies **ID declaration consistency** with the authoritative Session binding. It does **not** cryptographically prove that the payload bytes originated from the corresponding local stored-profile record. That remains a local-data architecture trust boundary.

## Commands and exit codes

| Command | Exit | Result |
|---|---|---|
| `pnpm test:di2-browser-authoritative-chat-integration` | 0 | 15 passed, 0 failed |
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
- Does **not** claim server cryptographic proof of local profile-content provenance.
