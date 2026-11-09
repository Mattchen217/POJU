# M2.1 — Readiness → user confirm → Freeze

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Baseline parent:** `ef36c772`  
**Date:** 2026-11-08 (America/Chicago)

## What landed

1. Gap/order SoT: `docs/.../evidence/m2-mainline-gap-and-order.md`
2. Production confirm→Freeze path:
   - `lib/poju/decision-intake/confirm-and-freeze.ts`
   - Wired in `lib/poju/agent.ts` before adaptive/LLM when Understanding `can_ask===false`
   - Readiness stop forces `awaiting_confirmation` (`m21_readiness_stop`)
3. Coverage readiness (no forged DIR known):
   - `understanding-state.ts` — critical DIR partial coverage → `ready_for_final_confirm`
4. Minimal answer fix: constraint answers also write a reality_fact for Intake partial evidence
5. E2E: `pnpm test:m2-1-readiness-confirm-freeze` (5/5)

## Honest gaps remaining

- Starter DIRs / placeholder DDR still in use (M2.3)
- Personal Pattern unavailable (M2.4)
- Formal eight-page report bind from Freeze not yet on Intake path (M2.2)
- Answer Interpretation / Qgen still v1 simplified
- S0–S9 specialty HOLD; S9 not accepted by inheritance

## Forbidden checks honored

- No fake DIR `known` before confirm
- No Freeze when sufficiency.canStop is false
- No main merge/deploy; no self-PASS
