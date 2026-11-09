# First-question proof

From `pnpm test:m1-r-fresh-session-main-loop` M1R-01:

- Session created with `createPOJUSession` only (no `seedSession` DC injection)
- After first `handleUserMessage`, `adaptive_ask_plan.question_text` equals last assistant content
- Stub LLM freeform (`MODEL FREEFORM...`) does **not** appear as the user-visible question

See raw log for the exact first_q line.
