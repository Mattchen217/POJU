# S8 · Known gaps, UNTESTED and disclosures

S8 is submitted for review only. It is **not** self-declared accepted, and S8 passing does **not** mean Stage 3.2 is complete.

## UNTESTED (stated, not marked PASS)

- **C · `idempotent_skip` adoption path.** When C1 reports `idempotent_skip`, `persistCollectingUserTurnDc` returns its recomputed `applied.session`, not a DC re-read from IndexedDB. `runCollectingDcTurn` keeps the pre-S8 behavior and adopts it. No test drives a real `idempotent_skip` through the collecting turn. H5 covers the mapper skip (`not_applied`), which is a different path.
- **HTTP route handler.** `app/api/poju/final-delivery/route.ts` is never executed (no Next server). The F checks call the same library functions the route calls (`assertSnapshotMatchesBinding`, `resolveDecisionContextForReport`) on a JSON round-tripped body.
- **Delivery past job creation.** F0 stops at the create-job POST, using a fetch stub that answers 503. Job polling, the server pipeline, and LLM page generation that reads the n_a page feed are not executed.
- **Real browser storage.** All IndexedDB checks use fake-indexeddb with Dexie. The storage fault is a transaction abort after the write call. Quota errors and browser-specific IndexedDB behavior are not covered.
- **`revokeDirNaDeclaration` without an explicit reaggregation.** F4 reaggregates after the revoke. Freezing straight after a revoke, with no reaggregation, relies on freeze's post-aggregation step. That is known from reading the code only and was not executed.

## Disclosures: behavior that is real but deliberately unchanged

1. **The failed collecting turn's DC update is dropped (S8-C, fail-closed).**
   - When the C1 write fails, the returned Session keeps the pre-turn DC and no new Ask is planned.
   - From code reading only: the next turn maps only its own statement, so the failed turn is not retried automatically.
   - Before S8, the uncommitted DC was kept in memory and then written outside C1 by `POJUChatUI`'s `savePOJUSession(finalSession)`. That bypass is the defect S8 closes.
2. **A failed Ask keeps the previous `intake_ask_plan` (S8-C).**
   - When Ask fails after a commit, the committed DC is kept, no new plan is written, and the older plan stays on the Session.
   - Nothing in `lib/` reads `intake_ask_plan`; it is only written. Not changed.
3. **The page feed lists any `may_affect_p5_ranking` DIR under `unknowns_and_boundaries`, whatever its state (F1).**
   - An n_a DIR appears as `DIR <id> [n_a; may_affect_p5]: …`, labelled with its real state. A known DIR with the flag appears the same way, as `[known; may_affect_p5]`.
   - This is the Stage 4 projection in `dc-page-feed.ts`, which predates S7. It is not an S7-caused defect, so it was not changed: S8 forbids report-quality and prompt changes.
   - Residual risk: a page-generating model could read an n_a DIR inside a list named "unknowns". The structural consumers do not: `assertP5P6P8Consistency` and `buildStage4SampleFromFrozenDc` count only `unknown` as P5-critical, which F1 proves with a control case.
4. **Forged or revoked N/A rows stay inside the frozen snapshot as inert data (F3/F4).**
   - The DC is snapshotted and hashed whole, so the rows remain in it. They do not change DIR state.
   - They do not appear in any page-feed slice or Stage 4 face; F3 asserts that by scanning for their ids.
   - No soft-strip was added, consistent with the "no C-type sanitize" rule.
5. **The page feed does not carry N/A evidence (F5).**
   - Traceability runs through the binding `context_id@version + content_hash`, which is printed in every slice.
   - From the binding: frozen snapshot, then evidence row, then source fact plus the Session E1, then the Session declaration action and the classification.
   - Evidence and classifications are covered by the content hash; F5 tampers with them and gets `DC_REPORT_HASH_MISMATCH`.
6. **Only preferred-path (blocking) conflicts outrank n_a (F7).**
   - `aggregateDirStateIntake` applies Final Binding §2.4 through `dirHasBlockingConflict`: an open or `unresolved_in_final` conflict outranks n_a only if it affects the preferred path.
   - A non-preferred conflict leaves the DIR n_a. Freeze marks the conflict `unresolved_in_final`, and the report puts it in `recommendation_conditions` with `review_decision=adjust`.
   - This is the existing business semantics and was not changed. Making every conflict outrank n_a would be a product decision.
7. **No frozen-DC requirement for draft-only sessions (S5 soft policy).** `shouldRequireFrozenDecisionContext` is false for them. The binding guard is `runFinalDeliveryForSession`, which throws `DC_FREEZE_FAILED:` before any save or fetch; E1b tests that. Not changed.
8. **`next-env.d.ts` is required by both typecheck projects.** The file is gitignored. A fresh checkout without it fails on image module typings in both `tsc --noEmit` and the intake-r6 project. This predates S8: the main tsconfig already includes it.

## Pre-existing test-code casts (not S8 lines)

S7-era `as` casts and non-null `!` that already compiled were left as they were. Examples: `"user_declared" as const` in the classification helpers, and many `decision_context!` in `test-intake-r6-production-agg.ts`. S8-B's no-assertion rule was applied to every line S8 added. A diff scan of added `.ts` lines finds no assertion, `any`, or `@ts-*`.

## Production defects found by S8

| Item | Defect? | Action |
|---|---|---|
| A barrel | Yes: `export *` exposed the fixture builder/type on the production barrel (S7 textual scan missed it) | Explicit named exports + semantic checker test |
| C agent | Yes: uncommitted DC adopted, then saved outside C1 by the UI | `runCollectingDcTurn` adopts only committed DCs |
| D versioning | No | Test only |
| E1 freeze persist | No | Test only |
| E2 S4 F1 | No (the disclosure placeholder was never executed) | Executed checks |
| F delivery/report | No S7-caused consumer defect | Test only; gaps 3–6 disclosed |
