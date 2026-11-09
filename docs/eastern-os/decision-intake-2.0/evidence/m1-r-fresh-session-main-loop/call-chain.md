# M1-R Call chain (fresh session main loop)

## Brand-new session (no draft DC)

`createPOJUSession({ original_question })`
→ `handleUserMessage` (user decision statement)
→ **pre-LLM** `runM1ProductionPreLlmTurn`
→ `bootstrapFreshSessionMainLoop`
  → ensure `collecting_context` agent
  → `seedOpeningDraftDcOnSession` (Definition + opening Facts)
  → attach `M1R_STARTER_DIRS` (v1 minimal; formal catalog ids)
  → C1 `persistDcLifecycleChange` (**fail-closed** if not committed)
  → `ensureDecisionBlueprint`
  → `runAdaptiveQuestionTurn({ init_only: true })` → first `AdaptiveQuestionPlan`
→ LLM may phrase freely
→ **post-LLM** `assertQuestionMatchesPlan` + `attachAuthorizedAssistantQuestion`
→ **sent assistant text = `plan.question_text`** (not freeform)

## Later answer turns (draft DC present)

`handleUserMessage`
→ `runM1ProductionPreLlmTurn` → `runCollectingDcTurn` / `runAdaptiveQuestionTurn`
→ Answer Interpretation **v1 simplified** → DC CAS update → Understanding → next plan
→ post-LLM enforce sent Q = plan
→ when `readiness.can_ask === false` → understanding-confirm stop (no further investigate Q)

## Fail-closed

If bootstrap/answer DC persist returns `persist_failed` / `persist_threw`:
→ agent returns explicit system error assistant (`m1_fail_closed`)
→ **does not** continue into old free-form ask path
