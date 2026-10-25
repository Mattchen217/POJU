> **SUPERSEDED / 归档**：产品口径见仓库 `.cursor/docs/v1-决策交付-产品边界.md`。本文仅历史对照，勿当 SSOT。
# Closed: Case C / S1-D-2 dyad gate skipped on rich opening

**Date:** 2026-10-13  
**Lab:** lab_mv73xyd0_6a1968ae  
**Symptom:** EN partnership + named co-founder + NL “skip chart” → no dyad chips; `path` unset; jumped to `awaiting_understanding`.

**Root cause:** Stage-1 dyad gate in `lib/poju/agent.ts` required `understanding_sufficient !== true`. Rich Case C prompts often complete the three understanding fields in one turn, so the gate never offered and path never locked.

**Fix:** `shouldPresentDyadGate` (no understanding_sufficient veto); hold phase at `opening` while chips are offered; broaden co-founder heuristic; tests in `scripts/test-dyad-compat-summary.ts`.

**Verify:** Case C → fixed dyad copy + two chips → Skip → `path=solo` → then understanding confirm.

**Follow-up (2026-10-13):** Model `dyad_specific_other=false` was still vetoing the heuristic, so Case C could skip chips again (`path=unset` → understanding). Fix: `resolveDyadSpecificOther` = model `true` OR heuristic (false no longer vetoes). Generic “what kind of partner” stays off via heuristic.

**Follow-up (2026-10-14, Stage1):** After Skip chips PASS (`path=solo`), session stayed `phase=opening` with stub “Understood.” — no Confirm/Add details. Root: hold rolled confirm→opening, but `[SYSTEM: dyad_continue]` is a system turn (`hasInput=""`), so state machine never re-entered `awaiting_understanding_confirm`. Fix: `understanding_confirm_held_for_dyad` flag on hold; `shouldResumeUnderstandingConfirmAfterDyad` after skip/collect restores confirm + gate summary/chips.

