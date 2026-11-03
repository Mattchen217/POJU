# S7 — System Integration Progress

**Status:** Engineering in progress (Draft DC production init + Chat full_pipeline observation wired).  
**Not:** Product Stage 4 quality PASS · Not merge/deploy authorized · S8/S9 held.

## Scope (ratified)

1. **Draft DC production init** — Opening → Call A → Call B → Collecting via DC API / ControlPlane / C1  
2. **LAB Chat full_pipeline observation** — parity with v3 nine-layer observation from real execution  
3. **Full-chain integration checks** (engineering)  
4. **Remote** Actions / Vercel / PR #32 body update  

## What landed

### Draft DC lifecycle (`production-dc-lifecycle.ts`)

| Stage | Behavior |
| --- | --- |
| Opening | `ensureOpeningDraftDcPersisted` at understanding-gate confirm (`startSegment2AfterGateConfirm`). Seeds Definition + unverified user Facts. Gate confirm is **not** a Fact Confirmation Event. |
| Call A | `applyCallAToSessionDc` in `finalizeSegment2ReportSuccess` — Hypotheses only. C1 persist from UI/LAB after finalize. |
| Call B | `applyCallBToSessionDc` in `finalizeSegment2AgendaBridgeSuccess` — DIR from Agenda + fingerprints. Covered ≠ known. |
| Collecting | `persistCollectingUserTurnDc` in `handleUserMessage` — unverified RealityFact + DIR reaggregation. Never auto-confirm. |
| Freeze | Unchanged S5 rule: **only** Stage 3 sufficiency (not stall / CTA / purchase / MAX turns). |

`agent_v2` remains a non-authoritative buffer. Formal SoT is `session.decision_context`.

### LAB Chat full_pipeline observation

- `LabPipelineAttempt.observation` via `buildLabObservation`  
- Wired in `pipeline-chat.ts` (chat + rerun) and `pipeline-jobs.ts` (segment2 A/B + synthesis)  
- Ops UI: `LabPipelinePanel` renders `LabObservationPanel`  
- Data comes from real `call_trace` / job traces / session DC snapshot — not display-only stubs  

### Tests

```bash
pnpm test:s7-dc-lifecycle
pnpm test:s5-freeze-s6-observation
pnpm exec tsc --noEmit
```

## Compatibility

- Soft `POJU_REQUIRE_DECISION_CONTEXT`: legacy sessions without DC still deliver  
- Frozen sessions always require binding  
- No global force-DC that breaks existing delivery  

## Explicit non-claims

- S8 live OpenRouter E2E **not started**  
- S9 eight-dimension quality **not started**  
- Stage 4 remains **产品质量验收未通过**  
- PR merge / prod deploy / irreversible migrations **not authorized**  

## Entry to S8

S7 pass requires: production Draft DC init end-to-end, Opening/A/B/Collecting boundaries correct, Freeze sufficiency-only, Delivery binding, LAB Chat observation complete, legacy compat, tests + remote CI green.
