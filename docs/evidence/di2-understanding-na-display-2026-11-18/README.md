# DI2 n_a already-understood display evidence

Date: 2026-11-18 (America/Chicago)

This record is for a surgical independent-review fix. It is not a declaration that DI2, M9, or the product flow is accepted.

## Baseline

- Fetch was performed before edits.
- Local HEAD and `origin/feat/m1-r-fresh-session-main-loop` were both `113603b7459a7ec4d292a438cb3852470184d657`.
- Subject: `Record already-understood confirmation filter evidence`.
- This matched the stated evidence tip. Implementation did not start from a moved HEAD.

## Implementation

- Implementation SHA: `ca4aa3ab418fe8bdac228ad048950fc210685ca3`
- Parent SHA: `113603b7459a7ec4d292a438cb3852470184d657`
- Evidence SHA is intentionally omitted from this file.

## Files changed

- `lib/poju/decision-intake/ui-projection.ts`
- `components/poju/DecisionUnderstandingPanel.tsx`
- `scripts/test-di2-understanding-composer-flow.ts`

`already_understood` is now a structured list of `{ label, status }` items, where `status` is `"known"` or `"n_a"`. The confirmation filter is unchanged:

- `user_confirmed_any === true`
- `status` is `"known"` or `"n_a"`
- `userFacingText(label)` is non-empty

`understood_labels` remains a derived string list for existing Adaptive Question UI consumers and is not the 7.2 panel contract. The 7.2 panel reads the structured `already_understood` items from `projectDecisionUnderstandingBox()`.

Panel copy:

- `known`: original label only. No not-applicable marker.
- `n_a`: original label plus a status marker. Chinese UI uses `已确认不适用`. English UI uses `Not applicable`.
- Confirmed `n_a` labels are not rewritten into ordinary facts and are not written into RealityFacts. Underlying UnderstoodItem semantics are unchanged.

UnderstoodItem, Decision Context, Readiness, Freeze, Adaptive Question Engine, composerTop layout, the three quick replies, and confirm/supplement paths were not changed. No second confirmation-state system was added.

## New tests and `projectDecisionUnderstandingBox()` results

Added or updated in `scripts/test-di2-understanding-composer-flow.ts` and executed by direct calls to `projectDecisionUnderstandingBox()` (not source-regex-only proofs):

1. Confirmed `known` (`"Has a written offer"`) is included and keeps `status: "known"`.
2. Confirmed `n_a` (`"Visa requirement"`) is included and keeps `status: "n_a"`. The label is not replaced by a RealityFact such as `"Has a written offer"` or `"Might relocate"`.
3. Unconfirmed `known` (`"Model inferred the team is unstable"`) is excluded.
4. Unconfirmed `n_a` (`"Visa requirement"`) is excluded.
5. Illegal statuses (`"unknown"`, `""`, `"conflict"`), even with `user_confirmed_any: true`, are excluded.
6. Whitespace-only cleaned labels are excluded even when otherwise eligible.
7. Mixed lists keep one-to-one label and status correspondence: `[{ label: "Has a written offer", status: "known" }, { label: "Visa requirement", status: "n_a" }]`.
8. Panel render verification used `renderToStaticMarkup(DecisionUnderstandingPanel)` (not source-regex-only proof). In `zh`, `"Visa requirement"` is shown with `已确认不适用`, and `"Has a written offer"` has no such marker. In `en`, `"Visa requirement"` is shown with `Not applicable`, and the known item has no marker.
9. After the same structured filter, `still_need`, conflicts, progress (91%, not complete), Personal Pattern Insight (`"A helpful career pattern"`), and the current question were unchanged.

Full suite result: Passed 19 checks, exit 0.

## Command results

See `EXIT-CODES.tsv` and the log files in this folder.

- `pnpm test:di2-understanding-composer-flow`: exit 0, 2.7s, Passed 19 checks
- `pnpm test:di2-feature-landing-main-path`: exit 0, 3.7s, 22 passed
- `pnpm exec tsc --noEmit --pretty false`: exit 0, 7.2s, no compiler output
- `pnpm build`: exit 0, 133.7s. Next.js printed `Compiled successfully in 44s`, finished TypeScript, generated 210 static pages, and completed the production build. Existing `iztroVersion` named-export warnings appeared; they are pre-existing and were not introduced by this change. This completed build is recorded as success. It is not a substitute for live product-flow acceptance.

## public/sw.js

- Working-tree SHA-256 before the build: `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980`.
- Raw post-build SHA-256: `4f69cef5ab201ab948bd1c7d3b9c8e6214f17ec646f502c4f01972893953b00d`.
- Restored byte-for-byte to `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980`.
- Required pre-build hash: `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980`.
- Match: yes.
- Left unstaged.

## Still UNVERIFIED

- Real OpenRouter / live model paths were not run.
- Real browser E2E was not run.
- Real Redis / Lua was not run.
- Unit tests, `tsc`, and a local production compile are not product-flow or production-environment acceptance.

## Git delivery

- Implementation and evidence commits are separate.
- Only `feat/m1-r-fresh-session-main-loop` is to be pushed.
- No PR, no merge to main, no deploy, no rebase, no force-push.
- This record does not declare DI2 PASS or M9 PASS.
