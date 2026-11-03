# Phase 3 S4 Writeup — Normalization / Fingerprint / Mapper / Opening Seed

**Date:** 2026-11-03 (America/Chicago)  
**Branch:** `feat/decision-context-phase1`  
**Baseline:** `a13716e6c25bea0e40a4815234fcaac5a4b263a1` (S3 PASS_WITH_GAPS)  
**Scope:** S4 only. Stopped before S5. No merge to prod/main.

## Authorities

- Contract HIGHEST: `PHASE3-FINAL-ENG-CONTRACT-2026-11-03.md` **§13–§14**
- Mapping: `PHASE3-FINAL-IMPLEMENTATION-MAPPING-2026-11-03.md` **§6**
- S3 acceptance carry-forwards (flag only): C1 extend two-phase, C5 vault rename plaintext, J4 shared xhigh store
- Hold: Product Stage4 / Lab / 04 / SoT16 / BookJudgment / Call A/B product UI / Freeze aggregation redesign
- Critical naming: Engineering S4 ≠ product Stage4

## Deliverables

| Area | Files |
|------|-------|
| Normalize primitives | `lib/poju/decision-context/normalize.ts` |
| Call A Normalized Object | `lib/poju/decision-context/normalize-call-a.ts` |
| Call B Normalized Object | `lib/poju/decision-context/normalize-call-b.ts` |
| Fingerprint | `lib/poju/decision-context/fingerprint.ts` |
| Call A Mapper | `lib/poju/decision-context/hypothesis-from-core.ts` |
| Call B Mapper | `lib/poju/decision-context/dir-from-agenda.ts` |
| Opening Seed | `lib/poju/decision-context/opening-seed.ts` |
| Shared canonical JSON | `lib/poju/decision-context/content-hash.ts` (imports `normalize.ts`) |
| Barrel | `lib/poju/decision-context/index.ts` |
| Tests | `scripts/test-normalize-s4.ts` → `pnpm test:normalize-s4` |
| Prior suite fixture | `scripts/test-decision-context-phase1.ts` (`source_turn_id` on Opening Facts/Constraints) |

## Pipeline (unique Normalized Object)

```text
Raw Call Input
  → Runtime Validation
  → Normalize
  → Normalized Object
       ├── Fingerprint  (SHA-256(version + canonical_json))
       └── Mapper
```

Ban enforced: dual normalize stacks; fingerprint-then-filter; mapper reordering/rewriting values; claiming semantic equality from two similar objects.

## Contract §13–§14 self-check

### §13 Fingerprint & Normalization

| Requirement | Status | Notes |
|-------------|--------|-------|
| Fingerprint + Mapper consume same Normalized Object | PASS | `prepareCallAGeneration` / `prepareCallBGeneration`; mappers take Normalized types |
| Ban raw FP / second clean stack / ignore Mapper fields / hidden Mapper fields / filter-renumber | PASS | Single normalize modules; Call A field list exact; sparse slots retained |
| String: NFC, CRLF→LF, trim, collapse ws, empty→null, no non-string coerce | PASS | `normalizeMapperString` |
| undefined/null→null; boolean keep; illegal type FAIL | PASS | |
| Arrays: order + indices + empty slots as null | PASS | `mapArrayPreservingSlots` |
| Objects: stable key sort for canonical JSON | PASS | `canonicalJson` / shared with content-hash |
| Deterministic number serialization | PASS | finite only; -0→0 |
| Call A FP fields §13.3 exact list | PASS | `NormalizedCallAInput` |
| Call B FP fields §13.4 exact list (not status/etc.) | PASS | `NormalizedAgendaItem`; status excluded from FP |
| FP = SHA-256(version + canonical_json) | PASS | `fingerprintNormalizedObject` |
| Version change ≠ same FP identity | PASS | `CALL_A_FINGERPRINT_VERSION` / `CALL_B_FINGERPRINT_VERSION` |
| Mapper output stability for same generation identity | PASS | stable hyp ids; source_ref replace |

### §14 Opening Seed / Call A / Call B

| Requirement | Status | Notes |
|-------------|--------|-------|
| Opening: Definition + Facts + Constraints only | PASS | |
| Ban Hypotheses / DIR / Agenda / model-inferred / breakthrough_core as fact source | PASS | hard-fail if passed on input |
| Facts need user statement + source_turn_id | PASS | `requireSourceTurnId` |
| user_estimate stays unverified; Gate does not auto-confirm all | PASS | status rule; no Gate batch (S3) |
| Fact/Constraint legal combo | PASS | `assertLegalFactCombination` / `buildRealityFact` |
| Call A: Hypotheses only; stable ids; needs_validation→pending_validation | PASS | |
| Call A: modern_action_frames original indices | PASS | `modern_action_${i+1}` from original index |
| Call A: same source_ref replace, no duplicate stack | PASS | |
| Call B: 1:1; `dir_${id}`; no auto merge/split | PASS | |
| Call B: duplicate Agenda ID HARD FAIL | PASS | `DUPLICATE_AGENDA_ID` |
| Call B: order preserved; initial `unknown`; covered ≠ known | PASS | |

## Carry-forwards (flag only — not implemented)

- C1 extend two-phase
- C5 vault rename plaintext
- J4 shared xhigh store
- Hold Product Stage4 / Lab / 04 / SoT16 / BookJudgment / Call A/B product UI / Freeze aggregation redesign
- S2 GAP: product pending→bind; no Path A completed TaskContext synthesis when missing
- S3 GAPs retained (P3-112 turn existence, deprecated `user_confirmed_event?` input alias, etc.)

## Ambiguities refused

1. Did not invent Call A/B product UI or wire Generation jobs to mappers in product control flow (S5).
2. Did not include response / rhythm_frame / status / reality_anchors / captured_answer in fingerprints without Mapper reads.
3. Did not silently Map-merge duplicate Agenda IDs.
4. Did not treat Agenda covered as DIR known.
5. Did not use breakthrough_core as Opening user-fact source.
6. Did not start S5 test matrix / CI aggregation delivery.
7. Did not touch product Stage4 / Lab / 04 / SoT16 / BookJudgment.
8. Did not merge to main/prod.
9. Did not invent new C1/C5/J4 policy.

## Test plan

```text
pnpm test:normalize-s4
pnpm test:control-plane-s3
pnpm test:generation-s2
pnpm test:session-cas-s1
pnpm test:decision-context
pnpm test:decision-context-phase2
pnpm test:decision-context-phase2-idb
pnpm exec tsc --noEmit
```

## Notes

- `hypothesesFromBreakthroughCore` / `dirsFromAgenda` remain as thin Validate→Normalize→Map wrappers for prior suites; Generation paths should call `prepareCallAGeneration` / `prepareCallBGeneration` then pass `normalized` to Mapper so FP and Mapper share one object explicitly.
- Adding any new Mapper-read field requires bumping `CALL_A_FINGERPRINT_VERSION` or `CALL_B_FINGERPRINT_VERSION` (GI-23 / P3-127).
- `temp/*.cjs` left untouched.


---

## S5 note (2026-11-03)

Max independently accepted **S4 PASS_WITH_GAPS** and authorized S5.  
S5 tests map S4 behaviors via P3-121鈥?30 (see `PHASE3-S5-P3-TEST-INDEX.md`).  
S4 gaps rem CLOSED: C1/C5/J4 (see PHASE3-FINAL-ACCEPTANCE.md). Product Call A/B UI Hold; Stage4/Page/Lab Holds remain.

