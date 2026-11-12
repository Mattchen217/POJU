# M6 Independent Review Fixes — Verification Record

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Review base:** `6a2bd676f6fd382fd8e26b0436f053852ec198f7`  
**Implementation commit:** `5769eb06`  
**Runtime:** Windows / PowerShell, Node.js 22.22.0, pnpm, Next.js 16.2.4.  
**Status:** test and build execution record for independent review. It does not declare M6 or DI2 passed.

## Changed files

- `scripts/test-m6-di2-full-lifecycle.ts` — retains the exact assistant question shown before each answer, verifies new plan question text changes (except an explicitly same-Conflict clarification), checks question/plan equality each turn, validates plan DIR/DDR provenance against the Blueprint, and checks each targeted deterministic answer wrote evidence to its active DIR and rebuilt Understanding. Role-specific responses replace the generic fallback. Freeze assertions now inspect the Session returned directly by `handleUserMessage("确认")`, its Freeze Receipt and Profile Receipt, and the actual selected `profile.profile_id`.
- `scripts/test-m1-production-adaptive-question-loop.ts` — the `makeFact` seed helper now uses `buildRealityFact` and legal `status × verification_level` pairs. Adds a matrix for unknown, declined, unverified/user-estimate, unverified/user-asserted, confirmed/user-asserted, and confirmed/independently-verified. M1-07 now asserts the `none` level for unknown/declined. The FU2 seed checks also require `user_confirmed=false`.
- `lib/deliverables/fill-html.ts` — replaces the non-greedy slot-body normalizer with a balanced nested-div scan, preserving the slot wrapper while blanking generated body content.
- `scripts/test-deliverable-skeleton.ts` — reproduces the old false drift, tests the new skeleton check with nested HTML, and asserts all eight report faces plus cover and one-to-one TOC order.
- `scripts/tsconfig.m6-tests.json` — strict type-check configuration for the M6 and deliverable structure test scripts.
- `package.json` — adds `test:deliverable-skeleton`.

No production change was needed in `client-sync.ts` or `apply-answer-to-dc.ts`: tracing showed they already reject illegal ledger pairs and map Answer Interpretation `unknown` / `declined` writes to `verification_level: "none"`. The `fact_ud_unknown` rejection came from the FU2 test helper constructing an invalid `unknown × user_asserted` record before the real Answer Interpretation transition ran. The test now creates legal seeds through the canonical fact builder; no ledger validation was relaxed.

## Final results on implementation commit `5769eb06`

- `pnpm test:m6-di2-full-lifecycle` — exit 0; `M6 result: 7 passed, 0 failed`.
  - Readiness output: `verdict=ready_for_final_confirm; can_ask=false; answered_targets=14`.
  - Confirmation output: server Freeze receipt `dc_8eacd9ab-ab87-4a3c-abda-a5521dea5c3e@v16`; Profile Receipt used the original selected Profile ID and the same Session and Freeze; `sufficiency=true`.
  - The report client completed eight bound page records. The generated HTML pane and TOC order matched the topic-selected template. No `skeleton assert` / `chrome/structure drift` warning appeared in the final M6 log.
  - The report fixture retains a `user_estimate`; final assertions verify it remains unconfirmed. The profile has `base_analysis=null` and still resolves via the formal Freeze profile loader.
- `pnpm test:m1-production-adaptive-question-loop` — exit 0; `M1 done. PASS=188 FAIL=0`.
  - `M1-07 estimate/unknown/declined not promoted to confirmed` — passed.
  - `M2.4-R1-FU2 fact status × verification state contract` — passed.
  - `M2.4-R1-FU2 unknown/declined old fact must not create Conflict` — passed.
- `pnpm test:deliverable-skeleton` — exit 0; `Deliverable structure result: 4 passed, 0 failed`.
  - Faces and TOC: `cover,01,02,04,05,06,07,08,03` (eight report faces plus cover), with nine nested content slots.
  - Old matcher reproduction: first divergence at offset 2306; expected snippet `section><sectionclass=""data-slo`; actual snippet `div></div></section><sectionclas`. The old non-greedy matcher stopped at the first nested child `</div>`, leaving the slot/child closing tags in the normalized actual structure. The balanced scanner consumes the complete nested slot body.
- `pnpm exec tsc --noEmit` — exit 0.
- `pnpm exec tsc --noEmit -p scripts/tsconfig.m6-tests.json` — exit 0.
- `pnpm build` — exit 0; production compilation, TypeScript, generation of 209 static pages, and build traces completed.

## Failures observed during repair

The first strengthened M6 attempt looked up the user turn through a nonexistent `message.id` instead of the stable `client_id`; the new target-write assertion failed. That was a test evidence lookup error and was corrected to `client_id`.

The next M6 attempt correctly reached confirmation but the sufficiency gate returned `not_sufficient_after_confirm`, because the deterministic risk answer was classified `user_estimate`. The returned Session stayed draft and no report job started. This was expected production fail-closed behavior. The role-targeted fixture now states a precise user-asserted risk bound; a separate status-quo answer remains an estimate and is verified not to promote during confirmation.

The initial FU2 failure was `DcLedgerSyncError: fact fact_ud_unknown: unknown×user_asserted`. Inspection showed the illegal pair was built by the test’s `makeFact` helper, which hard-coded `user_asserted` for unknown and declined seeds. The canonical builder and production answer application already enforce the correct state contract. The test helper was fixed rather than weakening the authority ledger.

## Build warnings and validation boundary

Build completed with existing warnings: deprecated Next.js `middleware` convention; named `version` import from the default-exporting `iztro` package; and the 3.35 MB `hana-ui` WASM asset omitted from service-worker precache. These are unrelated to the M6 patch.

Tests use MemoryKv, deterministic answer and report-model hooks, a charge stub, fake IndexedDB, in-process authority/report transports, and a controllable in-process worker queue. They do not validate Upstash persistence, Supabase charging, serverless multi-isolate recovery, Inngest/QStash scheduling, live OpenRouter/model quality, browser E2E, or production deployment. No PR, merge, rebase, deployment, or force-push was performed.
