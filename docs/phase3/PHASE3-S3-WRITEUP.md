# Phase 3 S3 Writeup — ControlPlane + Confirmation Event + Opening Anchor

**Date:** 2026-11-03 (America/Chicago)  
**Branch:** `feat/decision-context-phase1`  
**Baseline:** `ebeaeeb45cab030323507722c7ac1e399d1d5e54` (S2 PASS_WITH_GAPS)  
**Scope:** S3 only. Stopped before S4. No merge to prod/main.

## Authorities

- Contract HIGHEST: `PHASE3-FINAL-ENG-CONTRACT-2026-11-03.md` **§10–§12**
- Mapping: `PHASE3-FINAL-IMPLEMENTATION-MAPPING-2026-11-03.md` **§5**
- S2 acceptance carry-forwards (flag only): C1 extend two-phase, C5 vault rename plaintext, J4 shared xhigh store
- Hold: Stage4 / Lab / 04 / SoT16 / BookJudgment / Call A/B product UI / Freeze aggregation redesign
- S2 GAP: product must use pending→bind; do not rely on Path A synthesizing completed TaskContext when missing

## Deliverables

| Area | Files |
|------|-------|
| Formal ControlPlane | `lib/poju/decision-context/control-plane.ts` |
| Confirmation Event | `lib/poju/decision-context/confirmation-event.ts` |
| Opening Anchor | `lib/poju/decision-context/opening-anchor.ts` |
| Persist slice | `lib/poju/decision-context/persist.ts` (`ControlPlaneSlice` = `Phase3ControlPlane`) |
| Opening seed | `lib/poju/decision-context/opening-seed.ts` (stop formal `user_confirmed_event`) |
| Barrel | `lib/poju/decision-context/index.ts` |
| Session fields | `lib/poju/types.ts` |
| Merge / hydrate | `lib/poju/session-manager.ts` |
| Path A CP write | `lib/poju/generation/commit-paths.ts` |
| Tests | `scripts/test-control-plane-s3.ts` → `pnpm test:control-plane-s3` |

## Contract §10–§12 self-check

### §10 ControlPlane

| Requirement | Status | Notes |
|-------------|--------|-------|
| `session.control_plane` sole formal authority | PASS | Fields on `POJUSessionState`; hydrate clones formal CP |
| Ban `Record<string, unknown>` as formal structure | PASS | `ControlPlaneSlice` typedef → `Phase3ControlPlane` |
| `Phase3ControlPlane` fields per §10.2 | PASS | phase, agenda, active id, opening anchor/gate, call A/B fp+version |
| AgentPhase literal union (not `typeof === "string"` alone) | PASS | `AGENT_PHASE_LITERALS` runtime check |
| AgendaItem runtime validation (unique id, label, critical, status, optional whitelist) | PASS | `validateAgendaItemForControlPlane` |
| Unknown fields must NOT spread into formal CP | PASS | Rebuild from whitelist only |
| Input + output runtime validators + whitelist | PASS | `validateControlPlaneInput/Output` |
| Unknown field → `UNKNOWN_CONTROL_PLANE_FIELD` | PASS | |
| Wrong type → hard fail (no empty-default coerce) | PASS | |
| agent_v2 mirror FROM CP only; never overwrite CP from agent_v2 | PASS | `assertAgentV2CannotOverwriteControlPlane`; extract ignores agent_v2 |
| Never restore formal DC/CP from agent_v2 | PASS | `resolveFormalControlPlaneFromSession` |
| extract/merge cover full CP fields | PASS | extract validates full plane; merge writes `session.control_plane` + UI mirror |
| Path A C1 writes formal CP when provided | PASS | `commit-paths.ts` uses `mergeControlPlanePatch` |

### §11 Confirmation Event

| Requirement | Status | Notes |
|-------------|--------|-------|
| Discriminated union Fact \| Constraint with mutual exclusion | PASS | `ConfirmationEvent` type + validator |
| Persist `confirmation_events` on session | PASS | `POJUSessionState.confirmation_events` |
| event_id unique; confirmation_action_id unique | PASS | `appendConfirmationEvent` |
| Same action+target+content → idempotent skip | PASS | |
| Same action different target/type → hard fail | PASS | `CONFIRMATION_ACTION_REUSED` |
| actor user only; event_type matches target_type | PASS | |
| `user_confirmed` derived, never writable authority | PASS | `deriveUserConfirmed` / `deriveUserConfirmedFromEvents` |
| independently_verified does NOT imply user_confirmed | PASS | explicit false even with event flag |
| user_estimate stays unverified after confirm | PASS | opening-seed status rule + §11.5 |
| unknown/declined/not_applicable never user_confirmed via events | PASS | |
| Delete formal `user_confirmed_event?: boolean` source | PASS | removed as authority; deprecated input alias only for prior suites |
| Gate confirm MUST NOT batch-create Fact/Constraint events | PASS | `assertGateConfirmDoesNotCreateFactEvents`; confirmOpeningAnchor preserves events |
| Optional `UserConfirmationAction` evidence | PASS | typed + validator |

### §12 Opening Anchor

| Requirement | Status | Notes |
|-------------|--------|-------|
| Dedicated `OpeningAnchor` + `OpeningConfirmHistoryEntry` | PASS | |
| `anchor_id` ≠ message `client_id` | PASS | validated on create |
| Persist store + append-only history; CP holds current id/gate | PASS | |
| create/confirm/reset via S1 CAS mutate | PASS | `createOpeningAnchor` / `confirmOpeningAnchor` / `resetOpeningAnchor` |
| create same C1 as understanding-card first persist (mark + anchor + history + CP) | PASS | mark message meta + slice in one mutate apply |
| Reset: pending→cleared history, new anchor, new pending history, CP; never delete history; never reuse cleared as pending | PASS | |
| Confirm: pending only; update anchor+history+CP; no Fact events | PASS | |
| Reload restores current effective Anchor | PASS | `resolveCurrentOpeningAnchor` after `loadPOJUSession` |
| Isolate `opening_confirm_event_id` vs `fact_confirm_event_id` vs `source_turn_id` | PASS | id helpers in confirmation-event module |

## Carry-forwards (flag only — not implemented)

- C1 extend two-phase
- C5 vault rename plaintext
- J4 shared xhigh store
- Hold Stage4 / Lab / 04 / SoT16 / BookJudgment / Call A/B product UI / Freeze aggregation redesign
- S2 GAP: product pending→bind; no Path A completed TaskContext synthesis when missing

## Ambiguities refused

1. Did not invent Call A/B product UI or Gate product batch-confirm of Facts.
2. Did not promote agent_v2 agenda/phase into formal CP on reload.
3. Did not keep opaque `Record<string, unknown>` ControlPlaneSlice as formal persist type.
4. Did not start S4 normalization / fingerprint / mapper work.
5. Did not merge to main/prod.

## Test plan

```text
pnpm test:control-plane-s3
pnpm test:generation-s2
pnpm test:session-cas-s1
pnpm test:decision-context
pnpm test:decision-context-phase2
pnpm test:decision-context-phase2-idb
pnpm exec tsc --noEmit
```

## Notes

- `applyControlPlaneToWorking` / `mergeDcPersistSliceIntoSession` accept a **full** formal plane or a **whitelist patch** merged onto existing/defaults, then validate. Unknown keys still hard-fail. This preserves Phase 2 call sites that only patch `current_phase` without reintroducing opaque Record authority.
- Opening-seed accepts deprecated `user_confirmed_event?` as input alias → `has_user_confirm_event` so prior suites stay green; it is not formal Confirmation Event authority.
