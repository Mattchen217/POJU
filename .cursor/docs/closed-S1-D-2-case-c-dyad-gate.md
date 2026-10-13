# Closed: Case C / S1-D-2 dyad gate skipped on rich opening

**Date:** 2026-10-13  
**Lab:** lab_mv73xyd0_6a1968ae  
**Symptom:** EN partnership + named co-founder + NL “skip chart” → no dyad chips; `path` unset; jumped to `awaiting_understanding`.

**Root cause:** Stage-1 dyad gate in `lib/poju/agent.ts` required `understanding_sufficient !== true`. Rich Case C prompts often complete the three understanding fields in one turn, so the gate never offered and path never locked.

**Fix:** `shouldPresentDyadGate` (no understanding_sufficient veto); hold phase at `opening` while chips are offered; broaden co-founder heuristic; tests in `scripts/test-dyad-compat-summary.ts`.

**Verify:** Case C → fixed dyad copy + two chips → Skip → `path=solo` → then understanding confirm. Residual: model `dyad_specific_other=false` still vetoes heuristic (by design).
