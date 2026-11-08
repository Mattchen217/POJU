# S8 · Production path review (A–F)

Code HEAD for all runs: `5da7e2bbe2c52c47d7f1102a2f27475848b54751` (parent chain back to S7 `ed608c90`).

Labels used below:
- **Executed** means a test ran production code and the check passed; raw logs are in `raw/`.
- **Code reading** means the conclusion comes from reading source only. It is never counted as executed or E2E.
- No check below is a browser E2E.

---

## A · Barrel export boundary

**Defect (executed RED at S7).** `lib/poju/decision-context/index.ts` had `export * from "./na-validation-from-session"`. That made the test-only `naValidationBoundToDc` and `NaValidationFixtureOverrides` importable from the production barrel. S7's textual scan did not catch `export *`. Log: `raw/a-barrel-detector-on-s7-baseline.log`, exit 1, with P1, P2, P3 and R1 failing.

**Change.** The module is now re-exported by an explicit named list of production exports only. Test files that used the fixture builder import it straight from the module (import-only changes in 4 non-intake-r6 tests, all re-run and green).

**Verification (executed).** `test-intake-r6-barrel-export-boundary`, 19/19:
- **Detector.** The TypeScript checker resolves each barrel's real export table through `getAliasedSymbol`, so it isn't a text grep.
- **Negative controls.** Virtual probe modules are compiled through an in-memory CompilerHost. They cover `export *`, named re-export, alias re-export, type alias re-export, `export * as ns`, namespace import-then-export, and wrapper functions. Every probe must be detected, and a clean control must not be.
- **P1.** No `lib/` or `app/` module exports or references the fixture.
- **P2.** All 25 production barrels are fixture-free.
- **P3.** The decision-context barrel names the NA module's exports explicitly.
- **R1/R2.** At runtime the barrel has the production NA exports and no fixture builder.

---

## B · Strict typecheck for Intake R6 tests

**Change.** Added `tsconfig.intake-r6-tests.json`, which extends the main tsconfig with strict unchanged, plus the `typecheck:intake-r6-tests` script.

**Verification (executed).**
- At the S7 baseline: 44 errors, exit 2 (`raw/b-typecheck-s7-baseline.log`).
- At HEAD: 0 errors, exit 0.
- All 44 errors are baseline; S8 introduced none.
- Details and the no-bypass rules are in `typecheck-results.txt`.

---

## C · Agent collecting turn: failure handling

**Production path (code reading, confirmed by tests).** `handleUserMessage` (collecting) calls `persistCollectingUserTurnDc`, which goes through C1 `commitDecisionContextChange` and Dexie `pojuSessionRecords`. Then `selectNextIntakeAskForSession` runs. Afterwards `POJUChatUI` calls `savePOJUSession(finalSession)`.

**Defect (executed RED with the S7 `agent.ts`).**
- On a C1 rollback, `persistCollectingUserTurnDc` returns `applied: true` together with the uncommitted session.
- The old agent adopted that session and planned the next Ask on it.
- The UI's whole-session save then wrote the uncommitted DC with no C1 key.
- Log: `raw/c-agent-collecting-on-pre-s8-agent.log`, exit 1. P2 fails because the UI save persisted the uncommitted DC. S1 fails because the agent was not wired through the helper.

**Change.** New `lib/poju/collecting-dc-turn.ts` with `runCollectingDcTurn`, and `agent.ts` now calls it.

| Scenario | Returned Session | Ask | IndexedDB |
|---|---|---|---|
| Persist OK + Ask OK | committed DC + fresh plan | planned | committed DC (key present) |
| Persist fails (C1 rollback) | input Session, unchanged | not run | unchanged; retry commits (not `idempotent_skip`) |
| Persist throws | input Session, unchanged | not run | unchanged, no key |
| Ask throws after commit | committed DC, previous plan untouched | `ask_error` set | committed DC |

Production transaction semantics are unchanged: C1, keys and rollback were not touched. Only which result the agent adopts has changed.

**Verification (executed).** `test-intake-r6-agent-collecting-failure`, 9/9:
- **H1–H5** test the helper against real IndexedDB faults: a transaction abort on the C1 write, a thrown mapper, and an ACTIVE catalog lookup fault armed at the C1 write so the Ask fails after the commit.
- **P1–P3** go through the real `handleUserMessage`. Only `/api/poju/chat` is stubbed. P2 also performs the UI's follow-up `savePOJUSession` and proves no uncommitted DC reaches IndexedDB.
- **S1** statically checks that `agent.ts` reaches persist and Ask only through the helper.

---

## D · Versioning V1 → V2 under storage failure

**Production path.** `persistV2FromFinalOnSession` runs `applyV2FromFinalToSession` (production NaValidation, then `startV2FromFinal`), then C1 `commitDecisionContextChange`, then `applyDcToWorking`.

**Result: no defect, no production change.**

**Verification (executed).** `test-intake-r6-versioning-idb-fault`, 3/3. V1 is frozen through production. The C1 blob write's IndexedDB transaction is really aborted; no return value is mocked.
- **D1 (wire).**
  - Returns `ok:false` with an Abort reason, not `idempotent_skip`, and the caller Session object is unchanged.
  - After reload, V1's content and hash are intact.
  - No half-built V2 exists, V1 is not marked superseded, and no V2 idempotency key was committed.
  - A retry commits, with V1 superseded and its hash preserved.
- **D2 (direct C1).** Returns `committed:false, rolled_back:true`, memory equals the snapshot, and no process-local key is left. The retry is not skipped.

---

## E · Freeze persist failure, plus the S4 F1 disclosure

### E1: freeze persist failure

**Production path.** `ensureSessionFrozenForDelivery` runs `applySufficiencyFreezeToSession` (`freezeDraftForDelivery`) in memory, then C1 commit. On commit failure it returns `persistFailWireResult`.

**Result: no defect, no production change.**

**Verification (executed).**
- **E1, `test-intake-r6-freeze-persist-disclose`.**
  - Preconditions: the draft is sufficient, production NaValidation accepts it, and the in-memory freeze succeeds.
  - With a real transaction abort, the wire returns `ok:false`, `reason_code=dc_freeze_persist_failed`, and no `pack`. The returned Session is the same object as the input, unmutated.
  - `resolveDeliveryDcPayload` gives null binding and snapshot, both in memory and after reload. `prepareFrozenDcForDelivery` throws.
  - IndexedDB is unchanged: still draft, no freeze key. A retry freezes, and its binding hash equals the frozen DC hash.
- **E1b.** `runFinalDeliveryForSession` under the same fault rejects with `DC_FREEZE_FAILED:` before any fetch or pending-job save. IndexedDB stays draft.
- **`test-intake-r6-freeze-wire-reason`.** The S7 UNTESTED check, "[production-path] ensureSessionFrozenForDelivery persist-fail branch", is now an executed real-IndexedDB fault check. Result: 25 passed, 0 untested.

### E2: S4 `[disclose] freeze-versioning F1`

**Meaning.** The S4 placeholder (C25 era) pointed to R6 F1, "Session N/A + forged caller authority → DIR n_a", in the S5 authority-regression suite. S6 and S7 evidence list it only as a disclosure line, and S7 recorded it as UNTESTED. The business definition was not changed.

**Verification (executed).**
- **In `write-freeze-consistency`.** The placeholder is replaced by an executed check. The Session triad is written by `declareDirNotApplicable`, a production reaggregation is persisted, then the production freeze runs with a forged caller `authority` payload. Result: frozen DIR n_a and facts unchanged. Suite: 33 passed, 0 untested.
- **In `freeze-persist-disclose`, three checks:**
  - **E2-F1.** The same flow through the durable wire.
  - **Authority source.** The freeze's NaValidation takes Session actions and E1 events from the Session, and its catalog is the same object as `DIR_NA_CATALOG_V1_ENTRIES`.
  - **E1 required.** Removing the Session E1 means the DIR is no longer n_a.

---

## F · Delivery / Report compatibility with n_a

**Production chain exercised (executed):**
1. Seed through production writers.
2. `ensureSessionFrozenForDelivery` (C1/IndexedDB).
3. `resolveDeliveryDcPayload` (client POST payload).
4. JSON wire copy.
5. Both route binding branches: `assertSnapshotMatchesBinding`, and `resolveDecisionContextForReport` with the binding triple.
6. `buildDecisionContextPageFeed` and `formatDecisionContextSliceForPage` for all six DC-fed pages (01/02/04/05/06/08). These are the functions BookJudgment and run-step-v3 call.
7. `buildStage4SampleFromFrozenDc` and `assertP5P6P8Consistency`.

**F0.** The real `runFinalDeliveryForSession` freezes via C1 and POSTs exactly one create-job body. That body's snapshot and binding equal the payload builder's output. `assertSnapshotMatchesBinding` accepts the posted body, and the DIR is n_a in it.

| # | Requirement | Check (executed) | Result |
|---|---|---|---|
| F1 | n_a not treated as unknown | Feed state n_a on all 6 pages; boundary lines say `[n_a`, never `[unknown`. Stage 4: no P5 condition for the DIR, `review_decision=continue`, conditions not required. Control: the same artifact with the DIR set to unknown throws `STAGE4_P5_CONDITIONS_REQUIRED` | PASS (gap 3) |
| F2 | n_a not treated as known | Same DIR and fact: the N/A session gives n_a and the no-N/A session gives known, in snapshot and feeds, with different hashes. The fact's projection is not upgraded | PASS |
| F3 | Invalid evidence doesn't reach the report | DC-only forged `user_explicit_na` + classification (no Session action), plus a `system_na_marker`: DIR stays known in the frozen snapshot, feeds and report; no slice or face contains the forged ids; production validation returns null. A declaration with a code outside the ACTIVE pair is rejected at write and IndexedDB is unchanged | PASS (gap 4) |
| F4 | Revoked evidence not consumed | `revokeDirNaDeclaration` then reaggregation gives known; the frozen rows are revoked and inert; feeds show known; replaying the declaration is rejected | PASS |
| F5 | Traceable to DIR and source | A validated evidence row leads to the DIR, the source fact and its E1, the Session action (same context) and the classification. Tampering with the evidence gives `DC_REPORT_HASH_MISMATCH` against the binding | PASS (gap 5) |
| F6 | V1 → V2 keeps n_a and linkage | `persistV2FromFinalOnSession`: the V2 draft is n_a with identical evidence and classifications; V2 freezes, binds and shows n_a in feeds; V1 is still resolvable by version as superseded n_a with the same hash | PASS |
| F7 | Conflict outranks n_a | A preferred-path conflict on the N/A DIR gives `conflict` even though the N/A triad still validates; freeze is refused (`not_sufficient`) and the payload binding is null. A non-preferred conflict follows the existing §2.4 semantics: the DIR stays n_a and the conflict becomes `unresolved_in_final` in report conditions | PASS (gap 6) |
| F8 | Normal DIRs unaffected | The normal DIR's feed entry, boundary lines and fact projection are identical with and without N/A on the other DIR; no N/A row targets it | PASS |

**Consumer fixes: none.** No Delivery or Report defect caused directly by S7 was found, so no Delivery or Report production file changed. Gaps 3–6 are pre-existing behaviors, disclosed in `known-gaps.md`; none was changed.

---

## Not done (by instruction)

- No PR, merge to main, or deploy.
- No self-declared acceptance.
- No change to: Topic Rules, Catalog Condition Evals, CFP reader, DIR Catalog content, Session/DC schema, C1–C5 semantics, Question Budget / Review Cycle, Gate / Sufficiency / DDR Composer, Prompt / LLM / UI, or client authority injection.
- No fixture moved into production.
