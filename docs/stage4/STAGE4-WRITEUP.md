# Product Stage 4 Writeup — Decision Report from Frozen Decision Context

**Date:** 2026-11-03 (America/Chicago)  
**Branch:** `feat/decision-context-phase1`  
**PR:** #32  
**Prerequisite:** Phase 3 Engineering Final PASS (`8addcc44`)  
**Scope:** Product Stage 4 (decision report / P5·P6·P8) — **not** Phase 3 engineering S4  

## Authorization

Max continuous-execution directive: Phase 3 PASS → Product Stage 4 implementation.  
**Not authorized:** PR merge, production deploy, irreversible migrations.

## What shipped

| Area | Change |
|---|---|
| Frozen DC resolve | `lib/poju/decision-context/read-bound.ts` |
| Page feed | `lib/poju/decision-context/dc-page-feed.ts` (faces 01/02/04/05/06/08) |
| P5/P6/P8 helpers + sample | `lib/poju/decision-context/stage4-report.ts` |
| Face schemas | Face05 conditions/trace; Face06 `verification_experiment`; Face08 shared metrics + review_decision |
| Face prompts | Stage4 rules in `face-prompt.ts` + `decision-pages.ts` duties |
| Job / Lab / book meta | `FinalDeliveryJobInput`, `LabSource`, `DeliveryBookMeta` binding fields |
| Delivery wiring | `production-run`, `run-step-v3`, `content-body`, `body-prompt`, cover TOC |
| API gate | `final-delivery/route.ts` binds DC when provided; hard-fails when `require_decision_context` |
| Tests | `scripts/test-decision-context-stage4.ts` → `pnpm test:decision-context-stage4` |

## Acceptance commands (executed)

```
pnpm test:decision-context-stage4
```

Local result: **PASS=13 FAIL=0**.

## Binding contract

Every Stage 4 report artifact must carry:

- `context_id`
- `context_version`
- `context_hash` (= SHA-256 of frozen business payload)

Report path is **read-only** vs frozen DC. User supplements open V2 draft; old reports keep V1 binding.

## P5 / P6 / P8 mapping

| Product | Face | Implementation |
|---|---|---|
| P5 Decision Options | 05 | Conditional ranking, flexible path shapes, `recommendation_conditions`, `evidence_trace` |
| P6 Verification plan | 06 | `verification_experiment` (7 fields); forbid primary 30-day checkbox plan |
| P8 Review | 08 | `shared_core_metrics` + `continue\|adjust\|stop\|rerun` aligned to P6 |

Legacy runtime keys `p5-risk-guard` / `p6-signals-close` remain face **08** ritual pages — not Product P5/P6.

## Eight value dimensions

Structural checklist via `stage4ValueDimensionChecklist()` on sample artifact — all eight `ok: true` in Stage4 tests. Live LLM books still need human/sample review under the same dimensions.

## Known limits (honest)

1. Chat UX Freeze → delivery trigger is not yet fully product-wired for every session; API accepts Stage4 when client/session supplies frozen DC (`require_decision_context` for hard gate).
2. Live LLM end-to-end book generation with DC feed is wired but not re-run as a paid OpenRouter job in this acceptance package; structural + sample path is covered.
3. Face06/08 Stage4 fields remain optional in zod for legacy Lab fills; Stage4 acceptance (`assertP5P6P8Consistency`) requires them.
4. No PR merge / no production deploy.

## Enter next stage?

Stage 4 **implementation + structural acceptance** is ready for Max review. Independent Stage 4 product acceptance (live report quality / eight dimensions on a real book) should be marked separately before treating Stage 4 as product PASS and advancing subsequent modules.
