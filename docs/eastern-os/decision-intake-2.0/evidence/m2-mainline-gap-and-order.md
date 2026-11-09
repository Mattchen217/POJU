# Mainline M2 — Code gap + implementation order

**Baseline:** `ef36c772a94a993feca2b8ad85688e42d47ae8ee` (`feat/m1-r-fresh-session-main-loop`)
**Date:** 2026-11-08 (America/Chicago)
**Method:** Phase 0–10 SoT checklist vs real call paths (not filename-only).
**Scope:** continuous product lifecycle fresh user → formal report. No specialty S0–S9 expansion.

## A. Phase checklist (code-backed)

| Phase | Present at baseline? | Wired in production call chain? | Gap |
|---|---|---|---|
| P0 baseline audit | Yes — `docs/.../PHASE-0-CODEBASE-BASELINE.md` | N/A (docs) | Keep as reference only |
| P1 contracts | Yes — `lib/poju/decision-intake/types.ts` + DC types | Partial — session fields exist | Formal schema suite not full SoT |
| P2 Blueprint/DDR | Partial — `decision-intake/blueprint.ts` + `ensureDecisionBlueprint` | Yes on M1-R bootstrap | **Starter DIRs only** (`M1R_STARTER_DIRS`); no decision-question→DDR engine; placeholder `DDR_FOR_${dir}` |
| P3 DC state engine | Yes — DC modules + `apply-answer-to-dc.ts` | Yes via `runM1ProductionPreLlmTurn` | Answer→DIR `known` blocked: writes stay `unverified` (never `confirmed`) so Intake aggregator stays partial/unknown |
| P4 Adaptive Q | Yes — `adaptive-turn.ts` + scope/budget/qgen | Yes pre-LLM in `agent.ts` | v1 deterministic interpretation + template qgen (allowed floor) |
| P5 Personal analysis | Stub — `evaluatePersonalPatternInsight` → `unavailable` | Called but non-blocking | Not wired to bazi/ziwei feeds |
| P6 Readiness/confirm/Freeze | Library yes — `stop-criteria`, `production-freeze-wire`, `freeze-to-delivery` | **BROKEN chain** | Readiness stop shows confirm text but (1) phase often stays collecting; (2) user confirm does not promote facts / reaggregate / call `ensureSessionFrozenForDelivery`; Freeze only from old delivery/segment2 paths |
| P7 Understanding UI | Partial — `ui-projection` + DecisionUnderstandingPanel (M1) | Partial | Not full SoT UI; not blocking mainline Freeze |
| P8 Input lockout | Old rules exist; Intake 2.0 lockout incomplete | Partial | Later — must not weaken existing safety |
| P9 Eight-page report | PageFeedMatrix + `dc-page-feed` + delivery pipeline exist | **Not on Intake 2.0 path** | Needs frozen DC bind after M2.1 Freeze |
| P10 E2E matrix | M1 / M1-R suites only | Partial | Expand per milestone |

## B. Not-yet-connected (fresh user → formal report)

1. User decision question → **real Blueprint/DDR from question** (today: opening seed DC + fixed starter DIRs).
2. Answers update DC facts, but **DIR rarely reaches `known`** (unverified-only writes).
3. Understanding readiness can stop asking (budget / no candidate / sufficiency), and UI can show confirm text.
4. **User confirm → fact Confirmation Events + status promotion → DIR reaggregate → `evaluateDecisionSufficiency.canStop` → `ensureSessionFrozenForDelivery`** — **not connected** on Intake/M1 path.
5. Frozen DC → **formal eight-page report provenance bind** on new lifecycle — not connected.
6. Personal analysis (bazi+ziwei) in Understanding / report — unavailable stub.
7. Full Phase 8 lockout / Phase 10 matrix — later.

## C. Implementation order (mainline milestones)

### M2.1 — Readiness → user confirm → Freeze (THIS RUN)
- Why first: largest break in the continuous chain after M1-R Q&A.
- Work: coverage-based `ready_for_final_confirm` (partial evidence on critical DIRs, no fake known); on confirm promote collecting facts/constraints legally + Confirmation Events; reaggregate; Freeze via existing wire; fail-closed if still not sufficient.
- E2E: real `createPOJUSession` + `handleUserMessage`; answers covering starter DIR roles; confirm; assert `decision_context.status==='final'` + binding hash; no DIR state forgery.

### M2.2 — Report bind from frozen DC
- Wire formal delivery / PageFeed from Freeze package binding only; reject unfrozen.
- E2E: after M2.1 freeze, report path reads bound context_id/version/hash.

### M2.3 — Decision-question Blueprint/DDR v1 (replace starter-only)
- Generate directions/DDR/DIR set from decision question using catalogs; keep starter as fallback floor only.
- E2E: two different questions → different Blueprint dir sets; first Q still plan-gated.

### M2.4 — Personal analysis non-blocking integration
- Read bazi/ziwei when present; keep `unavailable` otherwise; never as RealityFact.
- E2E: missing profile does not block Freeze; present profile appears in Understanding/report feed.

### M2.5 — Input protection + fuller E2E matrix
- Phase 8 lockout on Intake path; expand Phase 10 scenarios without bypassing gates.

## D. Explicit non-goals this run
- No main merge/deploy; no self-PASS; no S0–S9 specialty expansion; no fake DIR known; no Freeze without sufficiency; no fixed question script as completion proof.
