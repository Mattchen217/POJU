# DI2 Main Path Integration Audit — Phase 1

- Repository: `Mattchen217/POJU`
- Branch: `feat/m1-r-fresh-session-main-loop`
- Audit date: 2026-11-19
- Machine: DESKTOP-KD64NVI (`b3537b32-10d8-49f4-b56f-2f2b4cbdfa4e`)
- Repo path: `D:\POJU\pojulife`
- Audit scope: production-code integration audit and existing-test preparation only. This phase did not run large-scale real OpenRouter / real-model E2E, did not create a PR, did not merge, did not deploy, did not rebase, did not force-push, and did not modify `main`.
- This document is not a DI2 final acceptance, not an M9 acceptance, and not a product-flow PASS.

## Git baseline (recorded after `git fetch origin feat/m1-r-fresh-session-main-loop`)

The last previously reviewed tip `51b62ab6df75b3db19a0a6cc619c8fb9754df7b5` was **not assumed**. After fetch, local HEAD and `origin/feat/m1-r-fresh-session-main-loop` were the same commit. That SHA is the audit baseline.

| Item | SHA / value |
| --- | --- |
| Audit baseline / local HEAD / origin HEAD | `51b62ab6df75b3db19a0a6cc619c8fb9754df7b5` |
| Parent of HEAD | `ca4aa3ab418fe8bdac228ad048950fc210685ca3` |
| HEAD subject | Record n_a already-understood display evidence |
| Parent subject (implementation) | Preserve n_a status in already-understood Understanding display |
| Working tree (tracked) | `public/sw.js` already dirty vs HEAD at audit start (pre-build SHA-256 `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980`, 139053 bytes). Untracked `.cursor/plans/*` and `temp/*` were present and were left untouched. |
| Production fixes in this phase | None |
| This evidence commit | recorded after this document was written; do not treat a placeholder SHA here as authoritative |

Recent implementation / evidence commits on the feature branch (newest first):

- `51b62ab6` evidence: Record n_a already-understood display evidence
- `ca4aa3ab` impl: Preserve n_a status in already-understood Understanding display
- `113603b7` evidence: Record already-understood confirmation filter evidence
- `3e501e33` impl: Filter already-understood labels to user-confirmed known or n_a items
- `630aa51c` evidence: Record DI2 Understanding composer-flow evidence
- `25099830` impl: Land DI2 Understanding composer-top box and confirm/supplement flow
- `830a46bd` evidence: Record DI2 feature-landing main-path evidence
- `c72b81a7` impl: Land DI2 intake protection, Q&A personal insight, and readiness progress

## Honest limitation of this phase

A connected production call chain in source, plus green local suites, `tsc`, and a completed production build, is a foundation for Phase 2. It is not evidence that a real user session can travel from a fresh session to a complete eight-page report against live OpenRouter, live Redis/Upstash, live queues, a real charge, or a real browser.

---

## A. Production entry for each complete-main-path node

HTTP / session entries:

- Fresh Session identity: `POST /api/poju/session` (`app/api/poju/session/route.ts`) → `initializeAuthoritativeSession` / `requireAuthoritativeSession` (`lib/poju/session-authority/lifecycle.ts`). This creates or restores the server Session record. It does **not** itself bootstrap Decision Context or the first adaptive question.
- Chat turn: `POST /api/poju/chat` (`app/api/poju/chat/route.ts`) and the stream entry `createPojuChatStreamResponse` → `executeAuthoritativeChatTurn` (`lib/poju/session-authority/chat.ts`) → `handleUserMessage` (`lib/poju/agent.ts`).
- Report: `POST /api/poju/decision-report` (`app/api/poju/decision-report/route.ts`) → `handleDecisionReportAction` (`lib/poju/decision-intake/decision-report-api.ts`).

| Node | Production file(s) and function entry |
| --- | --- |
| Fresh Session | `lib/poju/agent.ts` `handleUserMessage` → `lib/poju/collecting-dc-turn.ts` `runM1ProductionPreLlmTurn` → (no draft DC) `lib/poju/decision-intake/fresh-session-bootstrap.ts` `bootstrapFreshSessionMainLoop`. Session identity is established earlier by `initializeAuthoritativeSession`. |
| Initial Decision Understanding | After Blueprint init, `bootstrapFreshSessionMainLoop` calls `runAdaptiveQuestionTurn({ init_only: true })`. Understanding is built by `lib/poju/decision-intake/understanding-state.ts` `buildUnderstandingState` inside `runAdaptiveQuestionTurnInner`. |
| Blueprint Initialization | `fresh-session-bootstrap.ts` `applyBlueprintInit` → `lib/poju/decision-intake/blueprint.ts` `ensureDecisionBlueprint` / `buildCatalogBlueprintScope` / `classifyDecisionTopic` (`topic-classify.ts`, rule-based). Starter DIRs (`M1R_STARTER_DIRS`) are a controlled fallback only when Catalog scope yields no active dirs. `bindPersonalAnalysisProfile` runs at bootstrap and each adaptive turn. |
| Adaptive Question Loop | Later turns: `handleUserMessage` → `runM1ProductionPreLlmTurn` → `runCollectingDcTurn` → `lib/poju/decision-intake/adaptive-turn.ts` `runAdaptiveQuestionTurn` / `runAdaptiveQuestionTurnInner`. The authorized question is attached in `handleUserMessage` via `attachAuthorizedAssistantQuestion` / `assertQuestionMatchesPlan`. |
| Answer Interpretation | `runAdaptiveQuestionTurnInner` (non-`init_only`, ordinary answer) → `interpretAnswerWithModel` / `callAnswerInterpretationModel` (`answer-interpretation-model.ts`) → `eventFromInterpretation` / `answerEventFromModelDraft` (`answer-interpretation.ts`). Special turns branch to conflict clarification, pending answer resolution, or intake-control follow-up before this call. |
| Decision Context Update | `applyAnswerEventToSessionDc` (`apply-answer-to-dc.ts`) then `persistDcLifecycleChange` (C1). Model-proposed `confirmed` writes are downgraded to `unverified`. `user_confirmed` is not set true here. Dirs are reaggregated after writes. |
| Understanding Update | After persist / priority-band activation: `buildUnderstandingState`. Result is stored on `session.decision_understanding`. |
| Need to Understand | Same `buildUnderstandingState`: `need_to_understand.items` from Blueprint-scoped, unanswered, Catalog-linked DIRs. Answered-but-not-known DIRs go to `answered_pending_confirmation`, not open needs. |
| Personal Pattern Insight | `buildUnderstandingState` → `evaluatePersonalPatternInsight` (`understanding-state.ts`) → first `evaluateQaPersonalPatternInsight` (`personal-analysis-profile.ts`). Post-freeze path requires matching Freeze + profile receipts + validated analysis artifact. UI shows insights only when `status === "available"` and text is non-empty (`ui-projection.ts` `projectDecisionUnderstandingBox`). |
| Next Question Planning | `planFromState` (`adaptive-turn.ts`) → `buildIntakeCandidatesFromDc` (`production-intake-ask.ts`) → `buildAdaptiveQuestionPlan` / `generateQuestionText` (`question-generation.ts`). Question text is composed in-process; this step does not call OpenRouter. |
| Scope / Depth / Budget Validation | `validateScopeDepthBudget` / `bumpBudgetAfterAsk` (`scope-budget.ts`), invoked from `buildAdaptiveQuestionPlan` and budget updates after a sent question. `clarificationBlock` / `closeBlockedClarifications` also enforce hard budget and per-DIR depth for clarifications. |
| Readiness | Computed every `buildUnderstandingState` call (`readiness.verdict`, `readiness.can_ask`, `readiness_progress`). `planFromState` stops asking when `can_ask === false`. `handleUserMessage` then replaces free-form ask with the final-understanding confirm prompt and sets phase `awaiting_confirmation`. |
| User Confirmation | `handleUserMessage` (before the adaptive ask): `sessionEligibleForFinalConfirm` → `confirmUnderstandingAndFreeze` (`confirm-and-freeze.ts`). Non-confirm text at the gate is `isDi2FinalUnderstandingSupplementTurn`, which restores `collecting_context` and falls through to the Adaptive Question Engine without clearing confirmed facts. |
| Freeze | `confirmUnderstandingAndFreeze` persists promotions via C1, then `ensureSessionFrozenForDelivery` (`production-freeze-wire.ts`). For DI2 sessions (`isDcLedgerEnrolled`: Blueprint present or ledger head present) this is `ensureSessionFrozenViaAuthority` / `sealFreezeWithAuthority` — server ledger seal; the device adopts the returned snapshot + receipts through C1. |
| Personal Analysis | Report start / runner: `runPersonalAnalysisModel` (`personal-analysis.ts`) via `callLLM` (`lib/llm/router`) with `phase_name: "di2_personal_analysis"`, after Freeze + profile authorization. |
| 8-page Report | `handleDecisionReportAction` → `planDecisionReportStart` / `createOrReuseDecisionReportJob` (`decision-report-service.ts`) → worker / `decision-report-runner.ts` → `runDecisionReportPageModel` (`decision-report-pages.ts`, `phase_name: "di2_report_page_<id>"`). Completeness is asserted by `assertCompleteEightPageReport`. |
| Persistence | Mid-turn DC: `persistDcLifecycleChange` / `commitDecisionContextChange`. End of chat turn: `commitAuthoritativeSessionUpdate` (M9 CAS on the server Session record). Freeze/profile receipts and ledger head are server-authoritative. Report jobs, charge authorization, locks, and page checkpoints use the report/xhigh stores. The browser also `savePOJUSession` (IndexedDB) when adopting server state and report progress. |
| Recovery | Session: `POST /api/poju/session` `action=get` / `requireAuthoritativeSession`. Freeze/profile: `recoverFreeze` / M4 recovery (`test:m4-1-freeze-recovery` covers the production recovery helpers). Report: client `di2ReportShouldResume` / `runDi2Report("resume"|"continue")` → `handleDecisionReportAction` `action=status` / `continue`. Charge reuse uses a fixed `charge_ref`. |

UI (not a server node, but on the main path):

- `components/poju/POJUChatUI.tsx` places `DecisionUnderstandingPanel` in `composerTop`.
- `DecisionUnderstandingPanel` projects `session` through `projectDecisionUnderstandingBox` (`ui-projection.ts`).
- After Freeze (`decision_context.status === "final"` and Blueprint present), `di2ReportNeedsAutoStart` / `di2ReportShouldResume` auto-starts or resumes the DI2 report client (`decision-report-client.ts`).

---

## B. Call relationships and data flow for each node

### B1. Chat turn spine

```
POST /api/poju/chat
  → executeAuthoritativeChatTurn
      load requireAuthoritativeSession (server snapshot)
      bind incoming user turn
      handleUserMessage(server_invoke, authoritative session)
      commitAuthoritativeSessionUpdate (CAS)
  → client receives authoritative_session
```

`handleUserMessage` order that matters for DI2:

1. If `sessionEligibleForFinalConfirm`: `confirmUnderstandingAndFreeze`. Outcomes: `frozen` (return immediately with freeze notice), `add_more` (restore collecting and fall through), `not_sufficient_after_confirm` / persist / freeze failure (return fail-closed), `not_ready` / `not_confirm_text` (fall through).
2. If `isDi2FinalUnderstandingSupplementTurn`: restore `collecting_context`, keep confirmed Decision Context facts, fall through to Adaptive Question Engine.
3. If eligible collecting/opening turn: `runM1ProductionPreLlmTurn`.
   - No draft/final DC → `bootstrapFreshSessionMainLoop` (does not interpret the opening statement as an answer).
   - Else → `runCollectingDcTurn` → `runAdaptiveQuestionTurn`.
4. Persist / interpretation / planner failures are fail-closed (no free-form ask).
5. The general chat LLM (`callPOJULLMDirect` / `callLLMViaAPI`) still runs after a successful M1 plan.
6. Post-LLM: if a plan and `authorized_question` exist, `assertQuestionMatchesPlan` **replaces** assistant text with `plan.question_text`. If readiness `can_ask === false`, assistant text is replaced with the final-understanding confirm prompt.
7. `maybeRunDeliveryPipeline` remains in the function. In `lib/poju/state-machine.ts`, `triggerDelivery` is initialized to `false` and is never assigned `true` at this baseline, so this legacy path is not entered from the current state machine. That is a source observation, not a live-browser proof.

### B2. Fresh session + Blueprint + first question

`bootstrapFreshSessionMainLoop` input: `{ session, statement, source_turn_id, now }`.

Flow:

- `bindPersonalAnalysisProfile` + collecting agent
- `seedOpeningDraftDcOnSession`
- `applyBlueprintInit` → `ensureDecisionBlueprint` (Catalog + topic classification; starter fallback only if needed)
- `seedDecisionQuestionFact` / `withDecisionQuestion` writes the decision question onto DC definition and `original_question`
- C1 persist (`dc_seed:m1r:<session_id>:<source_turn_id>`)
- Re-apply Blueprint after C1 restore
- `runAdaptiveQuestionTurn({ init_only: true, statement: "" })` so the opening statement is not treated as an answer
- Output: `AdaptiveTurnResult` plus `bootstrapped`, `blueprint_scope_source`

Persisted: draft Decision Context, Blueprint, then Understanding + first `adaptive_ask_plan` on the Session after the init-only turn.

### B3. Adaptive Question Engine (each ordinary answer turn)

Documented production order in `runAdaptiveQuestionTurnInner` (non-init, no pending clarification/control):

```
User Answer
  → applyIntakeProtection / classifyIntakeInput
  → interpretAnswerWithModel (OpenRouter in production; testHook in tests)
  → AnswerEvent (eventFromInterpretation)
  → applyAnswerEventToSessionDc
  → persistDcLifecycleChange (C1)
  → ensureDecisionBlueprint
  → activateNextBlueprintPriorityBand
  → buildUnderstandingState
        current_understanding
        understood (DIR state known | n_a; user_confirmed_any derived from facts)
        need_to_understand
        personal_pattern_insight
        readiness / readiness_progress
  → planFromState
        if !readiness.can_ask → no next question (ready_no_question / confirm)
        else candidates filtered (no answered DIRs, Blueprint/DDR scoped, depth cap)
        → buildAdaptiveQuestionPlan
        → generateQuestionText
        → validateScopeDepthBudget
  → authorized question or final confirmation
```

Data structures (high level):

- Input statement + `source_turn_id` + Session (`decision_context`, `decision_blueprint`, `decision_understanding`, `adaptive_ask_plan`, pending clarification/control).
- `AnswerEvent`: classification, proposed writes, unresolved items, source grounding.
- Decision Context: `reality_facts`, `constraints`, `conflicts`, `dirs`, `definition.decision_question`, `version`, `content_hash`, `status`.
- `UnderstandingState`: bound to `context_id` / `context_version` / `blueprint_version`.
- `AdaptiveQuestionPlan`: `plan_id`, `direction_id`, `dir_ids`, `ddr_ids`, `fact_role_codes`, `question_text`, budget/depth fields.

### B4. Confirm → Freeze → Report

`confirmUnderstandingAndFreeze` input: `{ session, statement, confirmation_turn_id, now }`.

- Confirm text must pass `isFinalUnderstandingConfirmText` and `sessionReadyForFinalConfirm` (`can_ask === false` and verdict `ready_for_final_confirm` or `hard_budget_exhausted`).
- Confirmation events are appended first; `user_confirmed` is derived only from structure+provenance-valid events. `unknown` / `declined` / `not_applicable` never promote.
- `evaluateDecisionSufficiency` after reaggregation; if not sufficient, session returns to collecting (`not_sufficient_after_confirm`).
- If sufficient: `ensureSessionFrozenForDelivery({ trigger: "sufficiency_end_confirm" })`.
- Frozen session: DC `status: "final"`, freeze receipts on the session, Understanding readiness annotated `frozen_after_user_confirm`.

Report data flow:

- UI auto-start when `currentDi2FreezeId` can be formed (`Blueprint` + DC `status === "final"`).
- `planDecisionReportStart` → `authorizeReportSources`: server `loadVerifiedFreezeRecord`, receipt match, ledger head must be this Freeze, profile receipt required.
- Job identity: `freeze_id`, `context_hash`, `profile_hash`, report/analysis schema versions. `question` is taken from `frozen_dc.definition.decision_question` (fallback Blueprint decision question).
- `settleDecisionReportCharge`: first successful charge authorizes the session under a fixed `charge_ref`; later generations of the same authorization do not open a new charge; `continue` never opens a first charge.
- Worker generates Personal Analysis then eight pages against the frozen DC / profile projection. Checkpoints persist; `continue` resumes; regenerate creates a new generation without overwriting the old job's pages.

### B5. Persistence locations

| State | Where |
| --- | --- |
| Authoritative Session snapshot, revision, expiry, lifecycle | Server Session store via `initializeAuthoritativeSession` / `commitAuthoritativeSessionUpdate` (production: durable KV / Upstash; tests: MemoryKv-backed store with the same CAS surface) |
| Decision Context writes during intake | C1 `persistDcLifecycleChange` / `commitDecisionContextChange`; DI2 also commits DC to the authority ledger before the local mirror (M4) |
| Understanding / Blueprint / ask plan | Stored on the Session snapshot (server after CAS; client IndexedDB copy via `savePOJUSession`) |
| Freeze + profile receipts | Server Freeze/profile records + ledger head; receipts mirrored onto the Session |
| Report job, pages, analysis, locks | xhigh / decision-report stores; charge authorization record keyed by session; execution/delivery grants |
| Client recovery cache | IndexedDB `savePOJUSession` / `loadPOJUSession` |

---

## Adaptive Question Engine checklist (with citations)

| Requirement | Verdict from production source | Citation |
| --- | --- | --- |
| The model each turn uses the latest structured Understanding State | **Partial / precise.** Next-question planning is not a model call; `planFromState` uses the Understanding just built from the latest DC. The answer-interpretation OpenRouter call receives `buildModelInterpretationContext`: `decision_question`, `last_sent_question`, authorized DIR/DDR/roles from the sent plan, and related facts/constraints/conflicts — not the full `UnderstandingState` object. After planning, the general chat LLM still runs, then is overwritten by the authorized question text. | `adaptive-turn.ts` `runAdaptiveQuestionTurnInner` ~1190–1212; `answer-interpretation-model.ts` `buildModelInterpretationContext` ~280–367; `agent.ts` ~1478–1972 |
| UI Understanding is consistent with the state the model/planner reads | **Wired in source.** Both read `session.decision_understanding` (and DC/Blueprint/plan on the same Session). `projectDecisionUnderstandingBox` is a projection, not a second inference. The client must adopt `authoritative_session`. This is not a live-browser consistency proof. | `ui-projection.ts`; `POJUChatUI.tsx` composerTop ~3757–3786; `chat.ts` CAS commit |
| Confirmed facts are not re-asked as unknown | **Wired in source.** `planFromState` drops candidates whose DIRs are `isDirAnsweredForIntake`. `buildUnderstandingState` puts answered-but-not-known DIRs in `answered_pending_confirmation`, not `need_to_understand`. | `adaptive-turn.ts` ~1342–1345; `understanding-state.ts` ~249–260 |
| N/A and unknown are not confused | **Wired in source.** DIR `known` / `n_a` enter `understood` with that status. Unknown/partial/conflict/declined become needs or answered-pending. UI already-understood requires `user_confirmed_any === true` and status `known` or `n_a`; `n_a` is labeled “已确认不适用” / “Not applicable”, not rewritten as an ordinary fact. | `understanding-state.ts` ~236–247; `ui-projection.ts` `projectAlreadyUnderstoodItems`; `DecisionUnderstandingPanel.tsx` |
| Model inferences cannot automatically become user-confirmed facts | **Wired in source.** `applyAnswerEventToSessionDc` downgrades proposed `confirmed` to `unverified` and does not set `user_confirmed: true`. Promotion is only via confirmation events in `confirmUnderstandingAndFreeze`. | `apply-answer-to-dc.ts` ~285–308; `confirm-and-freeze.ts` ~712–753 |
| Completed investigation directions are not asked again without cause | **Wired in source.** Answered DIRs are filtered from candidates; generateQuestionText also dedupes against last sent / same-DIR history. | `adaptive-turn.ts` ~1342–1349; `question-generation.ts` ~291–297 |
| Questions correspond to a concrete DIR, DDR, or unresolved gap | **Wired in source.** Candidates without legal Catalog DDR ids (or synthetic `DDR_FOR_*`) are rejected. Plans carry `direction_id`, `dir_ids`, `ddr_ids`. Clarifications bind to pending items or conflicts. | `adaptive-turn.ts` ~1337–1338; `question-generation.ts` `buildAdaptiveQuestionPlan` |
| Readiness is checked every turn | **Wired in source.** `buildUnderstandingState` always computes readiness; `planFromState` honors `can_ask`. | `understanding-state.ts` ~394–419; `adaptive-turn.ts` ~1315–1328 |
| When information is sufficient, enter final confirmation rather than mechanical asking | **Wired in source.** Verdicts `ready_for_final_confirm` or `hard_budget_exhausted` set `can_ask: false`. Agent replaces the assistant turn with `【理解确认】…`. Confirm happens only after an explicit user confirm at the gate. | `understanding-state.ts` ~407–418; `agent.ts` ~1982–1992; `confirm-and-freeze.ts` `sessionEligibleForFinalConfirm` |
| Personal Pattern Insight has a real basis and is not forced every turn | **Wired in source.** QA insight requires an available profile and a decision-relevant question regex; identical fingerprints return `status: "none"` / `no_new_personal_pattern_insight`. Missing profile → unavailable, no fabricated insight. Post-freeze path requires validated evidence refs. UI hides the block unless `show_personal_pattern` (available + non-empty text). | `personal-analysis-profile.ts` ~127–191; `understanding-state.ts` `evaluatePersonalPatternInsight`; `ui-projection.ts` ~139–151 |

---

## Final delivery path checklist (with citations)

| Requirement | Verdict from production source | Citation |
| --- | --- | --- |
| Freeze uses server-authoritative state | **Wired for DI2.** `isDcLedgerEnrolled` is true when a Blueprint exists (all DI2 sessions after successful Blueprint init) or a ledger head exists. Those sessions go through `ensureSessionFrozenViaAuthority` / server `sealFreeze`. Legacy sessions without Blueprint do not touch the ledger. | `decision-authority/types.ts` `isDcLedgerEnrolled`; `production-freeze-wire.ts` `ensureSessionFrozenForDelivery` ~284–345 |
| Frozen Snapshot is fully bound to the actual Decision Context | **Wired in source.** Freeze id is `context_id@version`; receipts and ledger head carry `context_hash`. Report start refuses a non-current Freeze (`FREEZE_NOT_CURRENT`). | `freeze-bound-report.ts` `freezeIdFromBinding`, `loadAuthoritativeFreeze`; `decision-report-service.ts` `authorizeReportSources` |
| Snapshot identity, version, and hash checks are correct | **Wired in source.** `loadAuthoritativeFreeze` / `verifyFrozenSnapshot` refuse draft substitution and hash mismatch. Report job identity includes `freeze_id` + `context_hash` + `profile_hash` + schema versions. | `freeze-bound-report.ts` ~293–428; `decision-report-service.ts` `sameIdentity` / `planDecisionReportStart` |
| The report uses only the correct post-freeze data | **Wired in source.** Authorization loads the verified frozen DC from the server record, not a client draft. Page/analysis validators index that DC. | `authorizeReportSources`; `runPersonalAnalysisModel`; `runDecisionReportPageModel` |
| The report job can persist and recover | **Wired in source, covered by MemoryKv / fake-IndexedDB / fetch-stub tests, not live infra.** Jobs, checkpoints, status, continue, and client resume exist. | `decision-report-service.ts` `continueDecisionReportJob`; `POJUChatUI.tsx` auto-start/resume ~830–854; `test:m5-di2-main-path`, `test:m6-di2-full-lifecycle` |
| Interrupt, refresh, and retry do not double-charge | **Wired in source, tested with a stubbed charge (not a live pass ledger).** Fixed `charge_ref`; authorized state makes later generations free; `continue` does not open a first charge; refused abort owns the session until finished. | `decision-report-charge.ts` `settleDecisionReportCharge`; `test:m5-r1-authorization` |
| The report stays consistent with the user’s original decision question | **Wired in source.** Bootstrap writes the opening statement into `dc.definition.decision_question` / `original_question`. Report start copies `dc.definition.decision_question` from the frozen record. Phase 2 must still check a live model does not drift the rendered pages. | `fresh-session-bootstrap.ts` `withDecisionQuestion`; `decision-report-service.ts` `planDecisionReportStart` `question` |

---

## C. Tests that passed and their real nature

Commands were run sequentially on DESKTOP-KD64NVI via `docs/evidence/di2-main-path-integration-audit-2026-11-19/run-tests.cjs`. Started 12:12:03 AM America/Chicago on 2026-11-19; runner finished 12:16:44 AM America/Chicago. Full logs and a machine-readable table are in `logs/` and `EXIT-CODES.md`.

No tests were deleted, weakened, or redirected around production code for this audit. `smoke:m2-4-r2-openrouter` and `e2e:m2-4-r2-real` were **intentionally not run** (Phase 1 forbids large-scale real-model E2E). Existing `test:m9-r1-fu1-*` Redis/Lua parity suites were not re-executed in this session.

| Command | Exit | Reported result | Nature (not live unless stated) |
| --- | --- | --- | --- |
| `pnpm test:di2-understanding-composer-flow` | 0 | 19 checks | Direct calls to `projectDecisionUnderstandingBox` + `renderToStaticMarkup`. No OpenRouter, Redis, or browser. |
| `pnpm test:di2-feature-landing-main-path` | 0 | 22 passed | Production functions with `interpretAnswerModel` test hooks. No live model. |
| `pnpm test:m1-r-fresh-session-main-loop` | 0 | PASS=8 FAIL=0 | Production entries; persist hook `__setM1rPersistForTests` / fakes. No live Redis/OpenRouter. |
| `pnpm test:m1-production-adaptive-question-loop` | 0 | PASS=188 FAIL=0 | Production AQE with model interpretation hooks. No live OpenRouter. |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 | 19 passed | Production confirm/freeze path with test doubles for authority/persist as designed by that suite. |
| `pnpm test:m2-2-freeze-report-binding` | 0 | 43 passed | Freeze-bound report binding; model/network replaced by hooks/fakes. |
| `pnpm test:m2-3-decision-blueprint` | 0 | 18 passed | Catalog Blueprint + planner fail-closed cases; hooks. |
| `pnpm test:m3-decision-report` | 0 | 27 passed | Report job/client selectors; stubs for host/charge/model. |
| `pnpm test:m4-decision-authority` | 0 | 27 passed | In-process authority transport, not hosted Redis/signing as a live service. |
| `pnpm test:m4-1-freeze-recovery` | 0 | 10 passed | Recovery helpers with in-process authority fakes. |
| `pnpm test:m5-di2-main-path` | 0 | 29 passed | Header states: real route body / service / runner / dispatch / store / M4 freeze wire / fake-IndexedDB session CAS / browser report client. **Replaced:** model network (hooks), `after()` host, `inngest.send`, charge call. Storage faults use process-memory KV (MemoryKv), not live Redis. |
| `pnpm test:m6-di2-full-lifecycle` | 0 | 7 passed | One fresh session through intake, confirm, freeze, report, delivery, recovery in-process. **Deterministic interpretation / report model hooks replace network model calls.** fake-IndexedDB. Not live OpenRouter/Redis/browser. |
| `pnpm test:m8-di2-non-model-closure` | 0 | 6 PASS lines | Non-model closure; no live model. |
| `pnpm test:m8-r1-internal-turn-trust-boundary` | 0 | 42 PASS lines | Trust-boundary; stubs; no live OpenRouter. |
| `pnpm test:m9-server-authoritative-session` | 0 | 20 PASS lines | Production chat/session route entries + MemoryKv-backed `KvSessionAuthorityStore` (same CAS surface as durable KV / Upstash). Model stubbed. **No hosted Redis.** |
| `pnpm test:m9-r1-session-authority-remediation` | 0 | 17 PASS lines | Same MemoryKv / adapter-boundary nature. Live Upstash not used. |
| `pnpm test:m5-r1-authorization` | 0 | 49 passed | Charge authorization state machine through the route body; **charge call is stubbed**; MemoryKv-class storage faults. Not a live pass ledger. |
| `pnpm test:m2-4-r2-production-closure` | 0 | PASS=20 FAIL=0 | Production-path closure with hooks; not the real OpenRouter smoke/E2E scripts. |
| `pnpm exec tsc --noEmit --pretty false` | 0 | empty log body before EXIT_CODE | Typecheck only. |
| `pnpm build` | 0 | log contains `Compiled successfully in 36.1s`; runner wall time 113502 ms | Production build completed (wrapper exit 0 **and** the compile success line). This is not DI2 product acceptance. |

`public/sw.js` was rewritten by the build (hash changed to `2cf71a2e…`). It was restored byte-for-byte to pre-build SHA-256 `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980` (139053 bytes) from an existing local backup (`temp/_fu1_sw_js_backup.bin`) and left unstaged.

---

## D. Nodes not yet passed or not yet verified

All nodes above are **wired in production source** and have **local / hook / MemoryKv / fake-IndexedDB** coverage of varying depth. None of the following have been verified in this phase against the real dependency:

- Answer interpretation with a live OpenRouter model (`interpretAnswerWithModel` / `callAnswerInterpretationModel`).
- The post-plan general chat LLM call (`callPOJULLMDirect` / `callLLMViaAPI`) and its interaction with authorized-question overwrite, in a real browser.
- Topic/Blueprint quality on real decision questions (classifier is rule-based; Catalog fallback to `M1R_STARTER_DIRS` is a real branch).
- Server Freeze seal against live ledger, signing, and hosted storage.
- Personal analysis + eight report pages with live `callLLM` / OpenRouter (`runPersonalAnalysisModel`, `runDecisionReportPageModel`).
- Live charge / pass ledger (`settleDecisionReportCharge` + `chargeDeliveryPass`).
- Live Redis/Upstash Session CAS, report locks, charge records, job store.
- Live queue / `after()` / Inngest worker scheduling in production.
- Real browser E2E: composerTop Understanding box, confirm/supplement chips, refresh, resume, and report shelf.
- Lua/CAS parity suites (`test:m9-r1-fu1-*`) were not re-run here; even those are not hosted Redis.

Coverage gaps inside local tests (not automatically defects):

- `test:m6-di2-full-lifecycle` is the broadest single spine (7 cases) but uses model hooks, so it cannot speak to live interpretation or live page quality.
- Conflict-clarification, pending-answer-resolution, and intake-control branches have unit/integration coverage in M1/M2.4 suites, but not a full live multi-turn browser path.
- The remaining `maybeRunDeliveryPipeline` / `runConfirmationPipeline` legacy delivery function is idle at this baseline (`trigger_delivery` never set true) and was not live-tested as a DI2 interaction.
- Answer-interpretation context is narrower than the full Understanding State (see checklist). Phase 2 should confirm this is sufficient in practice, not assume it.

Failure-path recoverability (source + local tests, not live): DC persist failure, interpretation failure, planner blocked, confirm-not-sufficient, freeze failure, charge refusal abort, report continue from checkpoints, session CAS conflict, and refresh/resume are implemented and locally tested. Live mid-flight crash recovery (process kill, Redis failover, worker host crash) is not verified here.

---

## E. Concrete OpenRouter / model entry points and expected stages

Phase 2 should use these production entries, not a new parallel harness that bypasses them.

| Stage | Production entry | When it fires |
| --- | --- | --- |
| 1. Ordinary answer interpretation | `lib/poju/decision-intake/answer-interpretation-model.ts` `interpretAnswerWithModel` → `callAnswerInterpretationModel` → `openRouterChatCompletion` (`call_type: "decision_intake_answer_interpretation"`). Route sibling: `app/api/poju/answer-interpretation/route.ts`. | Every ordinary collecting answer turn after bootstrap. Not used for `init_only` first question. Conflict / pending / intake-control turns may take other branches first. Tests inject `test_hooks.interpretAnswerModel`. |
| 2. Post-plan chat phrasing (then overwritten by authorized question or confirm prompt) | `handleUserMessage` → `callPOJULLMDirect` or `callLLMViaAPI`. | After a successful M1 collecting turn, unless earlier fail-closed returns. This is a real additional model call on the production chat path. |
| 3. Personal Analysis | `lib/poju/decision-intake/personal-analysis.ts` `runPersonalAnalysisModel` → `callLLM` (`call_type: "main_delivery"`, `phase_name: "di2_personal_analysis"`). | After Freeze, during report job execution, once authorized. |
| 4. Eight report pages | `lib/poju/decision-intake/decision-report-pages.ts` `runDecisionReportPageModel` → `callLLM` (`phase_name: "di2_report_page_<pageId>"`). | After (or interleaved with) personal analysis, per page, with checkpoints. |

Not OpenRouter: `classifyDecisionTopic`, `generateQuestionText`, Readiness, confirm-event promotion, charge state machine, and UI projection.

Suggested Phase 2 call plan (scoped, not “final acceptance”):

1. One fresh session through at least two live interpretation turns + authorized questions (entries 1 and 2).
2. Drive to readiness and live confirm → server Freeze (no report pages yet if needed to isolate cost).
3. One authorized report job: live personal analysis + eight pages (entries 3 and 4), including a refresh/resume and a proof that `charge_ref` is not doubled.
4. Do not treat hook-green M6 as a substitute for those live steps.

---

## F. Concrete items that need real Redis, queue, database, and browser verification

**Redis / durable KV / Upstash**

- `initializeAuthoritativeSession` NX create and `requireAuthoritativeSession` read.
- `commitAuthoritativeSessionUpdate` CAS (revision, snapshot hash, no-create, expiry/terminate/freeze fences).
- DI2 DC ledger commits and Freeze seal / `loadVerifiedFreezeRecord` / ledger head currency.
- Report session lock, job store, charge authorization record, execution/delivery grants.
- Lua script behavior on the hosted store (local fu1 suites are parity/MemoryKv, not hosted Redis).

**Queue / background host**

- `after()` on `POST /api/poju/decision-report` actually running the worker to completion in the production host.
- Inngest / xhigh dispatch, lease, retry, and continue after a dropped worker (`test:m5` substitutes a test scheduler).

**Database / other durable stores**

- Whatever backs pass charging (`chargeDeliveryPass`) and any report/page blob store used in production.
- Profile/birth records used for `registerProfileForFreeze` / profile receipts.

**Browser**

- Composer-top Understanding box: progress, already-understood (including n_a marker), still-need, conflicts, optional insight, current question; chips stay in the input, not in the box.
- Confirm / supplement / add-more through the real UI, including official locale button labels.
- Refresh mid-intake restores the server session without double-mapping a turn.
- After Freeze, auto-start of `/api/poju/decision-report`, progress lines, shelf, refresh/resume, regenerate (new generation, no double charge), and interrupted continue.
- Fail-closed user-visible messages on persist / interpretation / planner block.

---

## G. Actual blockers of the complete main path and fix results

**No production-code blocker was confirmed in this phase, and no production fix was made.**

Issues examined and not treated as main-path blockers at this baseline:

- Answer-interpretation model context is a derived subset of Session state, not the full Understanding object. Planning still uses the latest Understanding in-process. This is a Phase 2 observation, not a demonstrated wiring break.
- A general chat LLM call still occurs after planning; the sent question is forced to `plan.question_text`. Residual cost and prompt-interaction risk; not a missing planner.
- `maybeRunDeliveryPipeline` still exists, but `trigger_delivery` is never set true in `advanceStateMachine` at this SHA, so the legacy `runConfirmationPipeline` is not entered from the current state machine.
- `public/sw.js` working-tree dirtiness vs HEAD is a pre-existing unstaged build artifact, restored after this audit’s build, and was not committed.

If a live Phase 2 run exposes a defect that actually breaks Fresh Session → Report, that defect should be fixed then, with a corresponding test and separate implementation/evidence commits.

---

## H. Readiness for Phase 2 real-model E2E

**Conditional yes, with gaps. This is not DI2 acceptance.**

The production spine from `POST /api/poju/session` + `POST /api/poju/chat` (`executeAuthoritativeChatTurn` → `handleUserMessage` → `runM1ProductionPreLlmTurn` / Adaptive Question Engine / `confirmUnderstandingAndFreeze` / server Freeze) through `POST /api/poju/decision-report` (authorized job, personal analysis, eight pages, persist/resume, charge authorization) is connected in source. Existing local suites on that spine, including `test:m6-di2-full-lifecycle`, exited 0 with hooks/MemoryKv/fake-IndexedDB. `tsc` exited 0. `pnpm build` exited 0 and logged `Compiled successfully in 36.1s`.

Phase 2 is warranted only as a **scoped live-dependency E2E**, and only if the environment actually has:

- a configured OpenRouter path for entries in section E,
- durable Session/ledger/report/charge storage (not MemoryKv),
- a working background worker host,
- a real browser session against this feature-branch build (not `main`, not a production deploy performed by this audit),
- and a charge path that can be observed without inventing a second billing mechanism.

Remaining gaps before anyone should call the product main path accepted:

- No live OpenRouter interpretation or report-page generation was executed in this phase.
- No hosted Redis/Upstash CAS, Lua, or ledger seal was executed in this phase.
- No real browser E2E was executed in this phase.
- No live charge was executed in this phase.
- Local green results must not be retold as “the complete main path already ran for real.”

Phase 2 recommendation: proceed with a small number of real-model sessions that enter through the production routes listed in A and E, record each external call, and stop at the first fail-closed or consistency break. Do not declare DI2 or M9 passing at the start or end of this audit.

---

## Appendix: methods and non-goals

- Audit method: fetch and record HEAD; read production callers rather than infer from file presence; run existing suites honestly; write this document and logs under `docs/evidence/di2-main-path-integration-audit-2026-11-19/`.
- Non-goals honored: no PR, merge, deploy, rebase, force-push, `main` change, `public/sw.js` commit, M1–M9 redesign, or new product feature.
