# M1 Baseline Audit (pre-implementation, live code)

## Git
- main HEAD: `ee8c96e8a7a128fa8e059c2a9f81c9f0d2127688` (no S0–S9)
- Work branch parent: `db4c6c7c867336adefd7dc708749c1d08ffa0b68` (S9-R HEAD; includes S0–S9)
- PR #36 Draft head `9254ffdd` base main — not merged; M1 does not merge it

## What existed vs design-only
- Phase 1–3 DC types, role resolver, planner scoring, stop-criteria, C1 CAS: **code present**
- Production Ask (`selectNextIntakeAskForSession`): **wired after assistant** (timing bug)
- Collecting DC write: whole-statement unverified RealityFact — **not** Answer Interpretation
- Understanding State / Blueprint (Intake 2.0) / Adaptive plan→sent Q: **design docs only / missing production loop**
- Report `report-blueprint.ts`: delivery face blueprint — **not** Investigation Blueprint

## Prior production call order (bug)
`handleUserMessage` → LLM → build assistant → `runCollectingDcTurn` → persist raw statement → `selectNextIntakeAskForSession`
⇒ plan did **not** drive the question the user saw.

## UI
- AgendaProgressPanel reads `agent_v2.investigation_agenda` (not DC Understanding)
- M1 adds DecisionUnderstandingPanel reading `decision_understanding` / `adaptive_ask_plan`
