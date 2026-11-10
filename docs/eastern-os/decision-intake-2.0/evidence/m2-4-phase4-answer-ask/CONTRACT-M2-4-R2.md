# M2.4-R2 — Model-backed Answer Interpretation Main Path

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Parent (baseline / FU6 evidence tip):** `8b3f8488cac94289e550878f74e2b472fbbd9772`  
**Implementation commit:** `7aff7580336f8f5eb28e02542db91265a5083ecf`  
**Official regression ran on implementation HEAD:** `7aff7580336f8f5eb28e02542db91265a5083ecf`  
**Evidence tip SHA:** *(empty / pending Max review — this file must not contain a self-referential tip SHA)*  
**Status:** Implementation + tests + this evidence file committed for independent review. **Does not self-declare product PASS.**  
**No PR, no merge, no deploy, no Vercel promote.** No new Vercel preview/tip URL was produced by this work.

## Goal

Upgrade ordinary-answer understanding from the deterministic keyword classifier to model-assisted structured semantic parsing, then let existing code own DC writes, validation, DIR/DDR authorization, Conflict lifecycle, Readiness, budget, and next-question selection.

The model only interprets this turn's user utterance, extracts items, and suggests a classification. It does not mutate DC and its output is never treated as a confirmed fact. There is still one RealityFact / Understanding store.

FU6 is accepted. `conflict-clarification.ts` and `conflict-clarification-turn.ts` were not modified.

## Production call chain as implemented

```
handleUserMessage
  → runM1ProductionPreLlmTurn
  → runCollectingDcTurn
  → runAdaptiveQuestionTurn
  → (if last_sent_question / turn already targets Conflict clarification)
        handleConflictClarificationAnswer → return
  → else
        activeTargets(session)
        interpretAnswerWithModel()     // OpenRouter in production; __testOnlyM1Hooks.interpretAnswerModel in tests
        parseAndValidateModelAnswerDraft()
        answerEventFromModelDraft()    // formal AnswerEvent; interpreter = model_m2_4_r2
        applyAnswerEventToSessionDc()  // unchanged fact-authority rules
        persistDcLifecycleChange()     // existing C1
        activateNextBlueprintPriorityBand()
        buildUnderstandingState()
        planFromState()
        buildAdaptiveQuestionPlan()
        Agent outputs and attaches the authorized question
```

On model interpretation failure the chain stops before `applyAnswerEventToSessionDc()`. The Agent fail-closed branch returns a retry prompt, keeps the user message, does not write DC, does not spend question budget, does not change `last_sent_question`, and does not fall back to free-form questioning.

A later Question Planning failure still keeps a DC that C1 already committed.

## Timeout

`ANSWER_INTERPRETATION_MODEL_TIMEOUT_MS = 60_000`.

`openRouterChatCompletion` uses a shared wall and throws `llm_timeout` immediately if the remaining wall is below `OPENROUTER_RETRY_MIN_REMAINING_MS` (45s), including on the first attempt. 60s is therefore the shortest practical independent timeout that still allows one real call, and it stays far below the Agent default 285s wait. The call also sets `max_attempts: 1` and `reasoning_effort: "off"`, and passes through the existing `AbortSignal`.

## Hook / adapter (no production bypass switch)

Production default is always `interpretAnswerWithModel()` → `openRouterChatCompletion`. There is no env var or production-settable flag to skip the model.

Tests inject only through the existing `__testOnlyM1Hooks` channel, extended with:

```
AdaptiveTurnTestHooks.interpretAnswerModel?: AnswerInterpretationModelHook
```

`scripts/fixtures/test-answer-interpretation-hook.ts` builds a `ModelAnswerDraft` from the deterministic classifier (`classifyAnswer` / `writesFor` / `activeTargets`) and merges it into handleUserMessage / collecting / adaptive-turn calls in the regression suites. New Cases A–F pass crafted drafts or injected failures through the same hook. The conversion to a formal `AnswerEvent` and all DC writes still go through production code.

## Changed files

### Production

- `lib/poju/decision-intake/answer-interpretation-model.ts` *(new)*
  - Restricted context builder (`buildModelInterpretationContext`): decision_question, last_sent_question, authorized dir/ddr/roles from `activeTargets()`, those DIRs' Blueprint direction/need/scope_boundary, related RealityFacts / Constraints / Conflicts, current user answer, locale. No full session history dump.
  - Calls existing `openRouterChatCompletion` with `json_mode: true`, `route_path: "chat"`, `session_id`, `locked_provider`, `max_tokens: 1600`, `temperature: 0.1`, `timeout_ms: 60_000`, `call_type: "decision_intake_answer_interpretation"`, `phase_name: "Decision Intake Answer Interpretation"`.
  - Does not reimplement OpenRouter HTTP, retry, vendor routing, or auth.
  - Prompt forbids inventing unsaid information, marking confirmed, choosing DIR/DDR/roles, picking a contradiction side, turning speculation or mingli into RealityFacts, inferring unknown from shortness, or inferring not_applicable from omission.
  - Strict JSON/schema validation. Invalid JSON or schema is a hard fail (no partial write). Extra authority fields are stripped and are not copied into the formal AnswerEvent.
- `lib/poju/decision-intake/answer-interpretation.ts`
  - `activeTargets()` remains the sole answer-authorization source.
  - Exported `classifyAnswer()` and `writesFor()` as deterministic helpers (used by existing unit cases and the test adapter; not a silent production bypass).
  - `interpretUserAnswer()` remains the deterministic function for historical/unit tests and records `deterministic_m2_4_r1`.
  - New `answerEventFromModelDraft()`: formal AnswerEvent targets always come from `activeTargets()`. `role_hint` is accepted only if it is in the authorized set; otherwise the item becomes an unresolved aspect and is not written. Null `role_hint` binds to the authorized role set (not a guessed DIR). `certainty` only influences the code-generated verification level. Ordinary answers never become `confirmed` from model output. `explanation` is never written as a RealityFact.
- `lib/poju/decision-intake/adaptive-turn.ts`
  - Conflict clarification still runs before ordinary answer interpretation.
  - Replaces the production `interpretUserAnswer()` call with the model path.
  - New outcomes: `answer_interpretation_failed`, `answer_interpretation_invalid_schema`.
  - On `turn_already_mapped`, still checks `planner_blocked` first (M2.3-R2-FU2). If the planner is not blocked and the already-sent plan can be recovered, the same `plan_id` / question / budget are restored so a same-`source_turn_id` resubmit does not spend budget or mint a second logical question.
- `lib/poju/decision-intake/types.ts`
  - `AnswerInterpreterVersion` includes `model_m2_4_r2`.
  - Formal `AnswerEvent.interpreter` uses that union.
  - Added `ModelAnswerDraft`.
  - Added AdaptiveTurnResult failure outcomes for model call failure and invalid schema, distinct from `ready_no_question` / `idempotent_replay`.
- `lib/poju/collecting-dc-turn.ts`
  - Maps the new adaptive outcomes through to the Agent. Threads `locale` and `signal`.
- `lib/poju/agent.ts`
  - Passes `locale` and `signal` into `runM1ProductionPreLlmTurn`.
  - Fail-closed branch for Answer Interpretation failure, same position as DC persist failure: retry prompt, no free-form fallback, user transcript kept, no budget spend, `last_sent_question` unchanged.
- `lib/poju/types.ts`
  - Extended `m1_outcome` with the two interpretation-failure values.
- `lib/poju/decision-intake/index.ts`
  - Re-exports the new functions and version constants.

### Tests

- `scripts/fixtures/test-answer-interpretation-hook.ts` *(new)* — test-only deterministic draft adapter.
- `scripts/test-m1-production-adaptive-question-loop.ts` — wraps production entry points with the hook; adds Cases A–F and a static wiring check.
- `scripts/test-m1-r-fresh-session-main-loop.ts` — same hook wrap so ordinary later answers do not call OpenRouter.
- `scripts/test-m2-1-readiness-confirm-freeze.ts` — same hook wrap.
- `scripts/test-m2-3-decision-blueprint.ts` — wraps `handleUserMessage`, `runM1ProductionPreLlmTurn`, `runCollectingDcTurn`, and `runAdaptiveQuestionTurn`.

### Not modified

`conflict-clarification.ts`, `conflict-clarification-turn.ts`, `production-dc-lifecycle.ts`, `scope-budget.ts`, `blueprint.ts`, `question-generation.ts`, `understanding-state.ts`, M2.1 / M2.2 / M2.3 authority modules, and `applyAnswerEventToSessionDc()` fact-authority rules.

## Model input scope

`buildModelInterpretationContext()` allows only:

- current `decision_question`
- current `last_sent_question` (text, plan_id, direction_id, dir_ids, ddr_ids, fact_role_codes)
- authorized `dir_ids`, `ddr_ids`, `fact_roles` / `fact_role_codes` from `activeTargets(session)`
- Blueprint directions for those DIRs: direction_id, label, need (`needed_info`), scope_boundary
- related RealityFacts and Constraints (authorized DIR or role overlap)
- related Conflicts (conflicts whose fact_ids intersect related facts)
- current user answer
- locale (`locked_output_locale` or the Agent-passed locale)

The model is not given the raw message transcript and cannot choose DIR, DDR, or fact_roles. Unauthorized `role_hint` values are rejected by code.

## Model output validation

After JSON parse (optional markdown fence strip only; no partial field recovery):

1. Top-level object required.
2. `classification` must be one of the allowed AnswerClass values.
3. `extracted_items` must be an array; each item must have string `text`, allowed `semantic_kind`, `role_hint` string or null, allowed `certainty`.
4. Empty text and exact duplicates are dropped; text is capped at 500 characters; at most 8 items per turn.
5. Extra fields such as `user_confirmed`, `confirmed`, `verification_level`, DIR/DDR/role grants, readiness, freeze, or resolution are recorded as stripped and are not authoritative.
6. Invalid JSON or missing/illegal required fields fail the whole turn (`invalid_json` / `invalid_schema`).
7. `explanation` is kept on the draft for debugging only and is never written into RealityFacts.

Write-state rules (code):

| Model semantics | DC write rule |
|---|---|
| explicit fact | `unverified` + `user_asserted` |
| user estimate | `unverified` + `user_estimate` |
| unknown | `unknown` + `none` |
| declined | `declined` + `none` |
| constraint | legal Constraint (`unverified` + `user_asserted`) plus the existing companion RealityFact |
| contradiction / correction | classification preserved so existing `applyAnswerEventToSessionDc()` correction/conflict logic runs; old facts are not deleted |
| vague / unclear | not written as `user_asserted` explicit facts |
| off_topic / invalid_input / goal_change / insight_mismatch | no DC write |

## C1 commit results (Case A official run)

All three ordinary-answer rounds went through real `createPOJUSession` / `handleUserMessage` / persist / reload. DC versions: 1→2, 2→3, 3→4. Understanding.context_version matched DC.version each time (2, 3, 4). Facts stayed `unverified`. The estimate was `user_estimate`. The constraint was written. The original 仍在职 fact was kept, a correction fact was appended, and an open Conflict was created. The third next question bound that Conflict.

Case F: same `source_turn_id` resubmit through `handleUserMessage` did not duplicate RealityFacts or Constraints, did not bump DC version (2→2), did not spend budget (asked stayed 2), and recovered the existing authorized question.

## Official Case A three-round logs

Taken verbatim from `pnpm test:m1-production-adaptive-question-loop` on implementation HEAD `7aff7580336f8f5eb28e02542db91265a5083ecf`:

```
[m24r2a] round=1 input=我目前仍在职，月薪三万。另外家里有一个孩子。; facts=2; written=fact_m1_81ef54ae-ca76-41af-bb83-b5793f8b1659_0:unverified:user_asserted:hard_constraint|fact_m1_81ef54ae-ca76-41af-bb83-b5793f8b1659_1:unverified:user_asserted:hard_constraint; dc=1->2; ctx_ver=2; next_q=关于「要不要离职去创业？」——有哪些真实可选方案（不要只重复决策目标）？（这样我才能判断：Needed for DIR-OPT-ON-TABLE）; next_dirs=DIR-OPT-ON-TABLE; next_roles=v1/dir/DIR-OPT-ON-TABLE/role/option; asked=1->2

[m24r2a] round=2 input=大概还能撑 6 个月。硬约束是必须保留社保。; estimate=fact_m1_8a632aa9-6f6e-422c-9bf3-05ef239f8b92_0:unverified:user_estimate; constraint=cst_m1_8a632aa9-6f6e-422c-9bf3-05ef239f8b92_1:unverified; facts=4; constraints=1; dc=2->3; ctx_ver=3; next_q=关于「要不要离职去创业？」——可以接受的最差结果是什么？（这样我才能判断：Needed for DIR-RISK-TOLERANCE）; next_dirs=DIR-RISK-TOLERANCE; next_roles=v1/dir/DIR-RISK-TOLERANCE/role/risk; asked=2->3

[m24r2a] round=3 input=更正一下，我已经离职了，不是仍在职。另外还有一个备选是内部转岗。; kept_original=fact_m1_81ef54ae-ca76-41af-bb83-b5793f8b1659_0; correction=fact_m1_86f23489-5199-4321-8c9f-277e4ba85653_0; supplement=fact_m1_86f23489-5199-4321-8c9f-277e4ba85653_1; conflicts=cf_m1_86f23489-5199-4321-8c9f-277e4ba85653_0:open:fact_m1_81ef54ae-ca76-41af-bb83-b5793f8b1659_0+fact_m1_86f23489-5199-4321-8c9f-277e4ba85653_0; fact_ids_before=fact_m1_81ef54ae-ca76-41af-bb83-b5793f8b1659_0,fact_m1_81ef54ae-ca76-41af-bb83-b5793f8b1659_1,fact_m1_8a632aa9-6f6e-422c-9bf3-05ef239f8b92_0,fact_m1_8a632aa9-6f6e-422c-9bf3-05ef239f8b92_2; fact_ids_after=fact_m1_81ef54ae-ca76-41af-bb83-b5793f8b1659_0,fact_m1_81ef54ae-ca76-41af-bb83-b5793f8b1659_1,fact_m1_8a632aa9-6f6e-422c-9bf3-05ef239f8b92_0,fact_m1_8a632aa9-6f6e-422c-9bf3-05ef239f8b92_2,fact_m1_86f23489-5199-4321-8c9f-277e4ba85653_0,fact_m1_86f23489-5199-4321-8c9f-277e4ba85653_1; dc=3->4; ctx_ver=4; next_q=我发现这项信息存在两条不一致的记录：
1. 我目前仍在职，月薪三万。
2. 我已经离职了，不是仍在职。
请明确选择哪一条准确。也可以说明两条都不准确，我会继续核实，不会自行替你判断。; next_dirs=DIR-OPT-CONSTRAINTS; next_cf=cf_m1_86f23489-5199-4321-8c9f-277e4ba85653_0
```

## Cases B–F outcomes (same official run)

```
[m24r2b] auth_dirs=DIR-OPT-CONSTRAINTS; auth_roles=hard_constraint; overreach_facts=0; legal_facts=1; dc=1->2

[m24r2c] facts=fact_m1_85547a08-64e4-4809-bc88-37b3a28a5604_0:unverified:user_asserted:confirm=undefined
```

Timeout / invalid JSON / missing fields (Case D) each returned an explicit fail-closed state, left DC version at 1, wrote no facts or constraints, did not spend budget (`asked=1`), did not change `last_sent_question`, and did not call `/api/poju/chat`:

From the same official log:

- `[agent] M1 Answer Interpretation FAIL-CLOSED (no free-ask fallback) answer_interpretation_failed timeout:llm_timeout`
- `[m24r2d_timeout] outcome=answer_interpretation_failed; dc=1->1; facts=0; constraints=0; asked=1; last_sent=qp_cq_dir_DIR-OPT-CONSTRAINTS_2026-11-08T12:00:00.000Z`
- `[agent] M1 Answer Interpretation FAIL-CLOSED (no free-ask fallback) answer_interpretation_invalid_schema invalid_json:...`
- `[m24r2d_json] outcome=answer_interpretation_invalid_schema; dc=1->1; facts=0; constraints=0; asked=1`
- `[agent] M1 Answer Interpretation FAIL-CLOSED (no free-ask fallback) answer_interpretation_invalid_schema invalid_schema:extracted_items_not_array`
- `[m24r2d_schema] outcome=answer_interpretation_invalid_schema; dc=1->1; facts=0; constraints=0; asked=1`

Case E (same run):

- `这个数字只是估计。` → `unverified:user_estimate`
- `我现在还无法确定。` → `unknown:none`
- `这部分我不想回答。` → `declined:none`
- `我需要再核实一下。` → `unverified:user_estimate` (not `user_asserted`)

Case F (same run):

- `[m24r2f] turn=cfa1b8ba-6a6f-48c9-be15-35301780b9ee; facts=1; constraints=1; dc=2->2; asked=2; q_recovered=true`

## Prior cases and regression exit codes

All official commands below ran on implementation HEAD `7aff7580336f8f5eb28e02542db91265a5083ecf` after the final production/test tree was frozen (no later source edits).

| Command | Result | Exit code |
|---|---|---|
| `pnpm test:m1-production-adaptive-question-loop` | 76/76 PASS (prior M1 / M2.4-R1 Cases A–H, I–M, N–T, U–Y, Z1–Z25 plus new R2 A–F and a static wiring check) | 0 |
| `pnpm test:m1-r-fresh-session-main-loop` | 8/8 PASS | 0 |
| `pnpm test:m2-3-decision-blueprint` | 18/18 PASS | 0 |
| `pnpm test:m2-1-readiness-confirm-freeze` | 19/19 PASS | 0 |
| `pnpm test:m2-2-freeze-report-binding` | 43/43 PASS | 0 |
| `pnpm test:decision-context-phase2` | 9 PASS | 0 |
| `pnpm exec next typegen` | | 0 |
| `pnpm exec tsc --noEmit` | | 0 |
| `pnpm build` | | 0 |

## Uncovered boundaries / honest leftovers

- Tests do not call live OpenRouter. Production default is the real model module; regressions inject drafts through `__testOnlyM1Hooks` only. There is no online non-script LLM session in this evidence.
- Question Generation is still deterministic `AdaptiveQuestionPlan` text. This task did not modelize question wording.
- `definition_patch` can be proposed on the formal AnswerEvent, but `applyAnswerEventToSessionDc()` still only persists `reality_fact` and `constraint`. That mapper was intentionally not changed.
- Case A round 3 test setup merges the original fact's DIR/roles into `last_sent_question` before the correction turn. After rounds 1–2 the planner had moved authorization to another DIR/role, and conservative conflict evidence requires a shared role. This is test setup, not a production expansion of authorization.
- Idempotent same-`source_turn_id` recovery through `handleUserMessage` required a production change: after `turn_already_mapped`, `planner_blocked` is still honored first; if the planner is not blocked and the already-sent plan can be recovered, budget is not spent again.
- `goal_change` / `insight_mismatch` are validated and treated as no-DC-write, but they do not have dedicated `handleUserMessage` cases.
- Mid-path untested forms include live model variance, unauthorized DIR/DDR as model-chosen targets beyond extra fields + unauthorized `role_hint` (Case B), and mixed-language drafts at the schema boundary.
- Family A/B/C plus the model draft path are construction/schema coverage, not exhaustive natural language.
- Case R in the older suite still replays one conflict turn via `runCollectingDcTurn` in addition to `handleUserMessage` (pre-existing).
- Case Y is still an official test-hook C1 substitute (`conflictClarifyPersist` returns `committed: false`), not a real IndexedDB abort.
- There is still no path that replaces both inaccurate facts and then formally closes a Conflict.
- No Phase 5 work.

## Git

- Implementation parent is exactly the required baseline `8b3f8488cac94289e550878f74e2b472fbbd9772`.
- Implementation SHA `7aff7580336f8f5eb28e02542db91265a5083ecf`.
- Evidence is a later docs-only commit. The evidence tip SHA field above is left empty pending review.
