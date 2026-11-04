# Decision Intake 2.0 · Phase 2 Acceptance Criteria

| Field | Value |
|---|---|
| **Scope** | Phase 2 documentation package quality |
| **Baseline** | `main` @ `1f1c111e` (Phase 1 merged) |
| **Pass rule** | All **AC2-*** PASS or product-WAIVED with reason |
| **Not in scope** | Runtime implementation (Phase 3+) |

---

## AC2-1 Package completeness

| ID | Criterion | Pass if |
|---|---|---|
| AC2-1.1 | Six Phase 2 docs exist under `docs/eastern-os/decision-intake-2.0/` | Files present |
| AC2-1.2 | DDR catalog has stable ids, P0/P1/P2, page/section, DIR refs, completion, ranking flags | All DDR rows complete |
| AC2-1.3 | DIR catalog has need/why/roles/sources/confirm/N/A/ranking/sufficiency | All DIR rows complete |
| AC2-1.4 | Mapping matrix covers all DDRs | 13/13 |
| AC2-1.5 | Blueprint init distinguishes seed vs `DC.dirs` live state | Explicit bans present |
| AC2-1.6 | Topic applicability defines page_07 without fixed questionnaire | Present |
| AC2-1.7 | Docs-only PR; no runtime/UI/schema/prompt/PASS | `git diff` check |

---

## AC2-2 Referential integrity

| ID | Criterion | Pass if |
|---|---|---|
| AC2-2.1 | Every DDR `required_dir_ids` ∈ DIR catalog (except DDR-03 empty) | No dangling DIR refs |
| AC2-2.2 | Every DIR in mapping reverse index ∈ DIR catalog | No orphans required for Gate |
| AC2-2.3 | Every DDR has `report_page_id` in `01`–`08` | Locked faces only |
| AC2-2.4 | Page 03 / 07 rules match PageFeedMatrix (appendix / conditional) | Stated |
| AC2-2.5 | No PageFeedMatrix file modified in Phase 2 PR | Diff clean |

### Test cases

| Given | Then |
|---|---|
| DDR lists `DIR-NOT-REAL` | **FAIL** integrity |
| `DDR-03` with `required_dir_ids=[]` | **PASS** (source-only exception) |
| `DDR-07` not seeded, page_07_emit=false | **PASS** (not dangling) |
| `DDR-07` seeded but topic DIR missing from DC.dirs | Runtime dangling → pending/FAIL per Phase 1 (documented) |

---

## AC2-3 Phase 1 C1–C5 preservation

| ID | Criterion | Pass if |
|---|---|---|
| AC2-3.1 | E1/E2 and fact promotion not redefined incompatibly | Refs Phase 1 §2.4 |
| AC2-3.2 | `DC.dirs` sole live DIR SoT; Blueprint seed only | Blueprint doc bans |
| AC2-3.3 | DDR status not stored in catalog; computed per Phase 1 §3.2 | Stated |
| AC2-3.4 | P0/P1/P2 Gate semantics match Phase 1 §3.3 | Priority tables align |
| AC2-3.5 | P1 ranking-impact explicit on DDRs/DIRs | `affects_option_ranking` / `may_affect_p5_ranking` set |
| AC2-3.6 | N/A cannot bypass Gate via silence/Agenda/dangling | N/A rules + Phase 1 cite |
| AC2-3.7 | FreezeRecord binding unchanged | Blueprint cites C5 |
| AC2-3.8 | Deviations from Phase 1 constraints | **Must be zero** |

### Ranking / Gate tests

| Given | Then |
|---|---|
| P0 DDR unsatisfied | Gate FAIL |
| P1 DDR unsatisfied, `may_affect_p5_ranking=true` on linked DIR | FAIL |
| P1 DDR unsatisfied, all linked `may_affect_p5_ranking=false`, complete L, boundaries | WARN-eligible |
| Partial dangling on P1 | FAIL (Phase 1) |
| Only P2 unsatisfied | Must not alone block |
| Unknown/declined used as satisfied | **FAIL** AC |

---

## AC2-4 Chart / personal pattern

| ID | Criterion | Pass if |
|---|---|---|
| AC2-4.1 | CFP/ZFP field sources named from existing types/PageFeedMatrix | No invented packs |
| AC2-4.2 | Chart interpretation ≠ confirmed RealityFact | Explicit |
| AC2-4.3 | Incomplete BaZi/ZiWei handling defined | Blueprint §6 / Topic §5 |
| AC2-4.4 | No duplicate calc engine proposed | Stated |

| Given | Then |
|---|---|
| Missing birth data | DDR-03 N/A; P0 can still PASS |
| CFP yes, ZFP no | DDR-03 completable; ZFP omitted |
| Model writes chart claim as RealityFact confirmed | **Forbidden** |

---

## AC2-5 Architecture bans

| ID | Criterion | Pass if |
|---|---|---|
| AC2-5.1 | No Call A/B as Intake entry | Stated |
| AC2-5.2 | No legacy Stage 1–4 upgrade-as-Intake | Stated |
| AC2-5.3 | No Agenda as DIR SoT | Stated |
| AC2-5.4 | No fixed question list / task table as product design | Topic + Blueprint |
| AC2-5.5 | No runtime code in Phase 2 | Diff |
| AC2-5.6 | Independent Intake 2.0 engine | Stated |

---

## AC2-6 Author consistency self-check

> Not a substitute for independent product review.

| # | Check | Result |
|---|---|---|
| 1 | DDR→DIR refs resolve | **PASS** (manual: 12 DDRs + DDR-03 empty) |
| 2 | DIR catalog 20 ids; mapping uses 19 + support STAKEHOLDERS | **PASS** |
| 3 | Pages 01–08 covered; 03 appendix; 07 conditional | **PASS** |
| 4 | P0=6, P1=5, P2=2 | **PASS** |
| 5 | Blueprint bans live DIR dual SoT | **PASS** |
| 6 | Phase 1 C1–C5 deviations | **0** |
| 7 | PageFeedMatrix unmodified | **PASS** (Phase 2 does not edit it) |
| 8 | Honest gaps listed (classifier, DDR-03 source check) | **PASS** |

---

## Unresolved issues / trade-offs

1. **DDR-03 source-only Gate check** — Phase 1 DIR rollup insufficient alone; Phase 3 Gate composer must add CFP presence.  
2. **Topic classifier** — design outputs frozen; implementation later.  
3. **`DIR-STAKEHOLDERS`** — support-only in v1 mapping (not hard-required).  
4. Runtime confirmFact promotion / FreezeRecord sidecar — still Phase 1 deferred, not solved here.

---

## Phase 2 exit

When product PASSes this package:

- Phase 3 may design Adaptive Question Engine / writers against these catalogs.  
- **Do not** implement runtime until Phase 2 PR approved.  
- **Do not** merge Phase 2 without product owner.

---

## Declaration

Phase 2 acceptance docs only. **No runtime code changed.**
