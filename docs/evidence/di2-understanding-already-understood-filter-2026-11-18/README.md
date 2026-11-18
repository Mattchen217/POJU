# DI2 already-understood confirmation filter evidence

Date: 2026-11-18 (America/Chicago)

This record is for a surgical independent-review fix. It is not a declaration that DI2, M9, or the product flow is accepted.

## Baseline

- Fetch was performed before edits.
- Local HEAD and `origin/feat/m1-r-fresh-session-main-loop` were both `630aa51c65a1f2221b60671d221e2c27ce1d2003`.
- Subject: `Record DI2 Understanding composer-flow evidence`.
- This matched the stated evidence tip. Implementation did not start from a moved HEAD.

## Implementation

- Implementation SHA: `3e501e33d81614d0dc95255ffc9e2e070fbc7433`
- Parent SHA: `630aa51c65a1f2221b60671d221e2c27ce1d2003`
- Evidence SHA is intentionally omitted from this file.

## Files changed

- `lib/poju/decision-intake/ui-projection.ts`
- `scripts/test-di2-understanding-composer-flow.ts`

`understood_labels` now keeps an item only when all of the following are true:

- `user_confirmed_any === true`
- `status` is `"known"` or `"n_a"`
- `userFacingText(label)` is non-empty

`projectDecisionUnderstandingBox()` uses that filtered list for `already_understood`. The UnderstoodItem type, Readiness, Freeze, composerTop layout, quick replies, and confirm/supplement paths were not changed. Decision Context remains the unique formal fact source. No second confirmation-state system was added.

For `status: "n_a"` with `user_confirmed_any: true`, the existing string-list contract is kept: the cleaned label is allowed into `already_understood`. It is not rewritten into a confirmed RealityFact sentence, and unconfirmed items are not mixed in. No new UI region or dual box was added.

## New tests and `projectDecisionUnderstandingBox()` results

Added to `scripts/test-di2-understanding-composer-flow.ts` and executed by direct calls to `projectDecisionUnderstandingBox()` (not source-regex-only proofs):

1. `known` + `user_confirmed_any: true` → `already_understood == ["Has a written offer"]`
2. `known` + `user_confirmed_any: false` (`"Model inferred the team is unstable"`) → `already_understood == []`
3. `n_a` + `user_confirmed_any: true` (`"Visa requirement"`) → `already_understood == ["Visa requirement"]`; not replaced by `"Has a written offer"` or `"Might relocate"`
4. `n_a` + `user_confirmed_any: false` → `already_understood == []`
5. Mixed items, including a whitespace-only eligible label → `already_understood == ["Has a written offer", "Visa requirement"]`
6. After filtering out an unconfirmed known item, `still_need`, conflicts, progress (91%, not complete), Personal Pattern Insight (`"A helpful career pattern"`), and the current question were unchanged
7. Empty cleaned labels (`" \n  \t "`) are omitted even when otherwise eligible

Full suite result: Passed 17 checks, exit 0.

## Command results

See `EXIT-CODES.tsv` and the log files in this folder.

- `pnpm test:di2-understanding-composer-flow`: exit 0
- `pnpm test:di2-feature-landing-main-path`: exit 0, 22 passed
- `pnpm exec tsc --noEmit --pretty false`: exit 0
- `pnpm build`: not completed in this session. `next build --webpack` never reached `Compiled successfully`. Attempts ended after about 36 seconds with only the package-script header. This is recorded as UNCOMPLETED, not as a passing production build.

## public/sw.js

- SHA-256 remains `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980`.
- Required pre-build hash: `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980`.
- Match: yes.
- Left unstaged. A completed build did not rewrite the file in this session.

## Still UNVERIFIED

- Production `pnpm build` did not complete in this session.
- Real OpenRouter / live model paths were not run.
- Real browser E2E was not run.
- Real Redis / Lua was not run.
- Unit tests and `tsc` are not product-flow or production acceptance.

## Git delivery

- Implementation and evidence commits are separate.
- Only `feat/m1-r-fresh-session-main-loop` is to be pushed.
- No PR, no merge to main, no deploy, no rebase, no force-push.
- This record does not declare DI2 PASS or M9 PASS.
