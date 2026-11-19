# DI2 Phase 2 pre-verification — Understanding and Adaptive Question Engine model duties

Times below are America/Chicago (UTC-6).

This is not a re-audit of M1–M9, not a live OpenRouter E2E, and not a DI2 / M9 / product-flow PASS.

## Baseline

- Branch: `feat/m1-r-fresh-session-main-loop`
- Confirmed local and `origin` HEAD before this work: `36425cf04b88f7d097a08dfeddff103f65bc85c5` (“Record DI2 main-path integration audit evidence”)
- Phase 1 audit baseline (parent, unchanged): `51b62ab6df75b3db19a0a6cc619c8fb9754df7b5`
- No merge or rebase onto `main`. No force-push. No PR, merge, deploy, or `main` change.

## Authoritative sources used

Committed SoT (in-repo design docs):

- `docs/eastern-os/decision-intake-2.0/PHASE-3-ENGINE-ARCHITECTURE.md`
- `docs/eastern-os/decision-intake-2.0/PHASE-3-QUESTION-PLANNING.md`
- `docs/eastern-os/decision-intake-2.0/PHASE-3-MODEL-CONTRACT.md`
- `docs/eastern-os/decision-intake-2.0/PHASE-3-UNDERSTANDING-STATE.md`
- `docs/eastern-os/decision-intake-2.0/PHASE-3-ANSWER-INTERPRETATION.md`

Supplement chapter (identical text in the three untracked plan files under `.cursor/plans/`):

- “补充章节：Understanding-Driven Adaptive Question Engine”

Those plan files were not committed by this work.

## Production call chain (inspected, not prompt-only)

`POST /api/poju/chat` → `executeAuthoritativeChatTurn` → `handleUserMessage` → `runM1ProductionPreLlmTurn` → `runCollectingDcTurn` / `runAdaptiveQuestionTurn`.

Along that path:

1. **When latest Understanding is built.** After Answer Interpretation and the Decision Context write, `runAdaptiveQuestionTurn` / `planFromState` call `buildUnderstandingState({ session, blueprint, now })`. The builder derives Current Understanding, Understood, Need to Understand, Personal Pattern Insight, Readiness, and budget from DC + Blueprint. It is not a second fact database.

2. **What Answer Interpretation actually receives.** `interpretAnswerWithModel` → `buildModelInterpretationContext`. The model gets a derived subset: `decision_question`, `last_sent_question` (from `session.decision_understanding.last_sent_question`), authorized DIR/DDR/role codes from `activeTargets()` (the actually-sent Plan only), Blueprint directions filtered to those authorized DIRs, related DC facts/constraints/conflicts, correctable prior answers, `user_answer`, and `locale`. It does **not** receive the full Understanding object (`current_understanding`, `understood`, `need_to_understand`, `personal_pattern_insight`, Readiness).

3. **How Next Question Planning uses Understanding.** `planFromState` is in-process and deterministic. It reads `understanding.readiness.can_ask` (stop if false), open Need / Blueprint P0–P1 obligations, budget/depth, and `understanding.last_sent_question`. Candidates come from DC + Blueprint catalogs (`buildIntakeCandidatesFromDc` / `planNextAskFromCandidates`). There is no planning-model call.

4. **How `generateQuestionText` produces the question.** It is a deterministic template composer (`QUESTION_GENERATION_VERSION = "gap_driven_m2_4_r1"`). It uses unmet fact roles, known evidence, open conflicts, and last-sent / same-DIR history. No OpenRouter / Chat LLM call. `buildAdaptiveQuestionPlan` then runs `validateScopeDepthBudget`.

5. **Why a generic Chat LLM used to run and then be overwritten.** After a successful M1 plan or readiness stop, `handleUserMessage` previously still called `callPOJULLMDirect` / `callLLMViaAPI`. Later, `assertQuestionMatchesPlan` always returned `plan.question_text` as `matched.text`, and the readiness path replaced the assistant text with the confirm prompt. The generic call did not plan the next question, did not read structured Understanding as a planning model, and its text was discarded. That must not be treated as model-driven adaptive Q&A.

6. **Who decides the question sent to the user.** The server-validated `AdaptiveQuestionPlan.question_text` (or the readiness confirm prompt). `attachAuthorizedAssistantQuestion` writes `last_sent_question` from that plan. UI projection (`projectDecisionUnderstandingBox` / `projectAdaptiveQuestionForUi`) reads the same `session.decision_understanding`.

## A. Spec-to-code mapping

| Requirement | Source | Code |
|---|---|---|
| UI and planning use the same structured Decision Understanding State | Supplement §§1, 5 | `buildUnderstandingState` writes `session.decision_understanding`. UI reads that object. Planning reads the same object. |
| Current Understanding / Understood / Need to Understand / Personal Pattern Insight are built each turn before the next question | Supplement §2, §3; Phase 3 Understanding State | `buildUnderstandingState` plus `evaluatePersonalPatternInsight`. Pipeline order in `runAdaptiveQuestionTurn` matches Answer Interpretation → DC update → Understanding → Planning → Scope/Budget → question text. |
| Next Question Planning binds DIR, DDR, gap, value, why-now, expected info, depth, scope/budget | Supplement §2.5; Phase 3 Question Planning §1–§2 | `buildAdaptiveQuestionPlan` + `validateScopeDepthBudget`. Planning algorithm is a “deterministic outline”; “Model may propose scores / priority hints; **code** applies filters, `gate_class`, and **final** sort.” |
| A model must read the structured state before generating the next question | Supplement §5 | There is no question-generation model on the production path. NL is produced by `generateQuestionText`. The previous generic Chat LLM was not this model (it did not receive the four Understanding blocks, and its output was overwritten). |
| Answer Interpretation proposes only; it must not confirm facts, change confirmation, freeze, or expand scope | Phase 3 Answer Interpretation / Model Contract; M2.4-R2 comments | `interpretAnswerWithModel` / `parseAndValidateModelAnswerDraft`. Authority fields are stripped. Failures fail closed (`answer_interpretation_failed` / `invalid_schema` / timeout). |
| Readiness, fact confirmation, Scope, Budget, Freeze stay server-side deterministic | Supplement §3; Phase 3 Engine Architecture module map | `computeReadinessProgress` / `understanding.readiness`; `validateScopeDepthBudget`; `confirmUnderstandingAndFreeze`. The model must not declare PASS or Freeze. |
| Same Understanding for UI and server | Supplement §5, acceptance | `projectDecisionUnderstandingBox` uses `session.decision_understanding` only; no progress-from-question-count. |

## B. Model duties vs deterministic server duties — conclusion

**Next Question Planning is deterministic program logic.** The committed Phase 3 SoT is explicit. The supplement describes what a plan must bind; it does not require a planning model. This work did not add a planning-model call just to have one.

**Question Generation on the production path is also deterministic** (`generateQuestionText`). Phase 3 lists “Generates text” as a possible model role for Generation, but does not require replacing the in-process composer in this phase.

**The only model on the ordinary collecting main path is Answer Interpretation.** It interprets this turn’s user answer and proposes a `ModelAnswerDraft`. Formal AnswerEvent construction, DIR/DDR/role authorization, DC writes, confirmation, Readiness, Scope/Budget, and Freeze remain server-side.

### Mapping: complete Understanding State vs Answer Interpretation context

| Understanding / SoT field | In Answer Interpretation context? |
|---|---|
| `current_understanding.decision_question` | Indirectly, as `context.decision_question` from DC definition / `original_question` |
| `last_sent_question` (question text, plan_id, direction, DIR/DDR, role codes) | Yes — subset copied from `session.decision_understanding.last_sent_question` |
| `understood` / `need_to_understand` / `personal_pattern_insight` / Readiness / budget | No. Not required for Answer Interpretation’s duty (parse this turn’s answer). These blocks are used by the deterministic planner and by the UI from the same Understanding object. |
| Related facts / constraints / conflicts | Yes, but filtered from **DC** (the fact SoT behind Understanding) by authorized last-sent DIR/roles, not by copying the Understanding view |

This satisfies the supplement for a deterministic planner plus a separate interpretation model. It would not satisfy a claim that “the Chat LLM is a model-driven question planner reading full Understanding.” That claim is false, and the wasted generic Chat LLM call has been removed from the authorized-question / readiness-confirm path.

## C. Production change (implementation commit)

Minimal main-path change in `handleUserMessage`:

- After a successful M1 authorized question, or a readiness confirm (`can_ask === false`), return the validated `plan.question_text` or the confirm prompt directly.
- Do **not** call `callPOJULLMDirect` / `callLLMViaAPI` on that path.
- Still run `assertQuestionMatchesPlan` and `attachAuthorizedAssistantQuestion`.
- Fail-closed M1 outcomes (interpretation failure, persist failure, planner blocked, no authorized question when still asking) are unchanged.
- Non-M1 paths (opening without an M1 turn, later delivery, etc.) still use the generic Chat LLM.
- The post-LLM overwrite block remains in the file as defense in depth if a later path still reaches it; the authorized / readiness success path no longer reaches it.
- Message meta gained optional `m1_skipped_generic_chat_llm`, `m1_authorized_question`, and `m21_readiness_stop` in `lib/poju/types.ts`.
- Existing M1-02/03 assertion in `scripts/test-m1-production-adaptive-question-loop.ts` was updated to expect no generic Chat fetch on an authorized question (not a weakened DC/Understanding assertion).

## D. Evidence (this commit)

Targeted suite: `scripts/test-di2-understanding-adaptive-engine-alignment.ts`  
Command: `pnpm exec tsx scripts/test-di2-understanding-adaptive-engine-alignment.ts`  
Also added: `pnpm test:di2-understanding-adaptive-engine-alignment`

The suite calls production functions (`buildUnderstandingState`, `validateScopeDepthBudget`, `generateQuestionText`, `buildAdaptiveQuestionPlan`, `parseAndValidateModelAnswerDraft`, `interpretAnswerWithModel`, `runAdaptiveQuestionTurn`, `handleUserMessage`, `buildModelInterpretationContext`, `projectDecisionUnderstandingBox`). It uses deterministic Answer Interpretation hooks, in-memory KV, and fake-IndexedDB. **No live OpenRouter, hosted Redis, or browser.**

| Check | Result |
|---|---|
| Each turn, interpretation context comes from the latest Understanding / DC (`last_sent_question` + latest related facts) | PASS |
| Confirmed / `known` facts are not re-opened as unknown needs | PASS |
| `unknown`, `n_a`, `declined`, and `conflict` stay distinct | PASS |
| Out-of-scope proposed question rejected (`dir_out_of_blueprint_scope`) | PASS |
| Repeated question rejected (`generateQuestionText` → null; `no_remaining_info_need`) | PASS |
| Over-budget / hard-budget proposals rejected | PASS |
| Readiness sufficient → no new authorized question | PASS |
| Model timeout / invalid JSON / invalid schema fail closed | PASS |
| Final sent question equals the validated plan; generic `/api/poju/chat` is not fetched | PASS |
| UI and server read the same `session.decision_understanding` | PASS |

### Commands and exit codes (America/Chicago, UTC-6)

Successful regression run (hook / MemoryKv / fake-IndexedDB, not live OpenRouter / Redis / browser):

| Command | Start | End | Exit | Notes |
|---|---|---|---|---|
| `pnpm exec tsx scripts/test-di2-understanding-adaptive-engine-alignment.ts` | 2026-11-19 01:09:28 -0600 | 01:09:31 | 0 | 7 passed, 0 failed |
| `pnpm test:m1-r-fresh-session-main-loop` | 01:09:31 | 01:09:34 | 0 | PASS=8 FAIL=0 |
| `pnpm test:m1-production-adaptive-question-loop` | 01:09:34 | 01:09:44 | 0 | PASS=188 FAIL=0 |
| `pnpm test:di2-feature-landing-main-path` | 01:09:44 | 01:09:47 | 0 | hook / MemoryKv / fake-IndexedDB |
| `pnpm test:di2-understanding-composer-flow` | 01:09:47 | 01:09:49 | 0 | hook / MemoryKv / fake-IndexedDB |
| `pnpm test:m5-di2-main-path` | 01:09:49 | 01:10:38 | 0 | hook / MemoryKv / fake-IndexedDB |
| `pnpm test:m6-di2-full-lifecycle` | 01:10:38 | 01:10:48 | 0 | hook / MemoryKv / fake-IndexedDB |
| `pnpm test:m2-1-readiness-confirm-freeze` | 01:10:48 | 01:10:52 | 0 | hook / MemoryKv / fake-IndexedDB |
| `pnpm exec tsc --noEmit --pretty false` | 01:11:41 | 01:11:48 | 0 | |
| `pnpm build` | 01:11:48 | 01:13:47 | 0 | Log contains `Compiled successfully in 43s` (wrapper exit 0 is not the sole evidence) |

Raw logs are under `logs/` in this evidence directory.

`scripts/test-intake-r6-agent-collecting-failure.ts` was inspected and left unchanged. It already had pre-existing failures (including a stale single-line `runCollectingDcTurn` import regex) unrelated to this duty-alignment change.

### `public/sw.js`

`pnpm build` rewrote `public/sw.js` (139292 bytes, sha256 `b4190e2343b8e132459c81db812a8e222423dab7c8159f975c483ef1f0097019`). It was restored byte-for-byte to the pre-build working-tree contents (139053 bytes, sha256 `38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980`, git hash-object `f5ca585d6673221b490b841c115c2a4a889696b9`) and left unstaged. That pre-existing local modification was not introduced by this work.

## E. Are real OpenRouter E2E conditions in place?

**Not fully. This phase did not start that E2E.**

Now in better shape for an honest later Phase 2 live E2E:

- The production question sent to the user is the server-validated authorized question or confirm prompt, not generic Chat LLM text.
- The only model that should be observed on an ordinary collecting turn is Answer Interpretation (real OpenRouter), plus whatever non-M1 Chat LLM paths remain outside authorized ask / readiness confirm.
- Planning, generation, Readiness, Scope/Budget, confirmation, and Freeze remain deterministic and testable without pretending a discarded Chat completion planned the question.

Still missing before a complete live main-path E2E can be called done:

- Real OpenRouter credentials and a scoped, non-large-scale run along `POST /api/poju/chat` → `executeAuthoritativeChatTurn` → `handleUserMessage`
- Hosted Redis / CAS (this run used in-memory KV)
- Worker / queue path
- Browser evidence (this run used fake-IndexedDB and no browser)
- Observable billing / charge path
- Independent review of this alignment before declaring Phase 2 acceptance

Do not declare DI2, M9, product-flow, or Phase 2 PASS from this work.
