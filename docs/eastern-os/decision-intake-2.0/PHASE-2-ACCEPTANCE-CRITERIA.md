# Decision Intake 2.0 · Phase 2 Acceptance Criteria

| Field | Value |
|---|---|
| **Scope** | Phase 2 documentation package quality |
| **Baseline** | `main` @ `1f1c111e` (Phase 1 merged) |
| **Canonical versions** | `ddr_catalog_version = 1.1` · `map_version = 1.1` · Blueprint `ddr_version = 1.1` · `dir_catalog_version = 1` |
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
| AC2-1.8 | Version declarations consistent across Phase 2 package | `ddr_catalog_version`/`ddr_version`/`map_version` = **1.1**; `dir_catalog_version` = **1**; no conflicting literals |

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

## AC2-4 Chart / personal pattern / source-backed DDRs

| ID | Criterion | Pass if |
|---|---|---|
| AC2-4.1 | CFP/ZFP field sources named from existing types/PageFeedMatrix | No invented packs |
| AC2-4.2 | Chart interpretation ≠ confirmed RealityFact | Explicit |
| AC2-4.3 | Incomplete BaZi/ZiWei handling defined | Blueprint §6; DDR §1.3 / §3.3.1 |
| AC2-4.4 | No duplicate calc engine proposed | Stated |
| AC2-4.5 | Empty DIR list never auto-satisfied | DDR §1.1 |
| AC2-4.6 | DDR-02 uses Product Rule A (CFP mandatory) | DDR-02-ATTRIBUTION row |
| AC2-4.7 | Gate order formalized | DDR §1.4 |

---

## AC2-5 Source & Gate acceptance tests (required)

All expected outcomes are **documentation-normative** (what the Gate composer must implement). Author self-check vs catalog text.

| # | Given | DDR focus | Expected DDR status | Expected Gate effect |
|---|---|---|---|---|
| 1 | CFP `source_ok`; ZFP absent; DDR-03 DIRs empty; explicit no N/A needed | DDR-03 | **`satisfied`** | P2 OK; ZFP absence alone does not block |
| 2 | CFP `source_absent_not_supplied` + **explicit** N/A evidence | DDR-03 | **`n_a`** | P2 terminal OK; other P0/P1 independent |
| 3 | Birth/profile expected; CFP `source_calc_failed` | DDR-03 | **`pending`** | Never silent N/A; P2 alone must not block report |
| 4 | CFP blob present but provenance/hash missing when Blueprint expected hash | DDR-03 | **`pending`** | Unresolved; not `satisfied` / not auto `n_a` |
| 5 | DDR-02 ordinary DIRs all `known`/`n_a` (≥1 known); CFP missing/failed | DDR-02-ATTRIBUTION | **`pending`** (not satisfied) | **P0 FAIL** (Rule A) |
| 6 | Any P0 DDR required source missing/unresolved (e.g. DDR-02 CFP) | that P0 | unsatisfied | **FAIL** |
| 7 | P1 DDR required source missing; ranking impact true (`affects_option_ranking` or DIR ranking or decision_critical) | that P1 | unsatisfied | **FAIL** |
| 8 | P1 DDR required source missing; no ranking impact; dangling false; complete L; boundaries recorded | that P1 | unsatisfied | **WARN**-eligible |
| 9 | P2 optional source missing (ZFP) while required CFP `source_ok` | DDR-03 / DDR-02 | may **`satisfied`** | Optional miss alone does not FAIL |
| 10 | `required_dir_ids=[]` and no explicit N/A evidence and required source not `source_ok` | DDR-03 | **`pending`** | Empty DIR list ≠ satisfied ≠ auto N/A |
| 11 | `required_dir_ids=[]` + all required sources `source_ok` + no blocking conflict | DDR-03 | **`satisfied`** | Empty DIR alone insufficient; sources+no-block required |
| 12 | Profile not supplied; DDR-03 has explicit N/A evidence; DDR-02 CFP absent | DDR-03 / DDR-02 | DDR-03 **`n_a`**; DDR-02 **`pending`** | DDR-02 cannot N/A via absent CFP → **P0 FAIL** |
| 13 | DDR-02 DIRs satisfied; CFP `source_absent_not_supplied` (no N/A attempted or attempted) | DDR-02-ATTRIBUTION | **`pending`** | CFP non-waivable; never `n_a` → **P0 FAIL** |

Additional regression (Phase 1 preserved):

| Given | Then |
|---|---|
| Partial dangling on P1 | FAIL (not WARN) |
| Model writes chart claim as RealityFact confirmed | **Forbidden** |
| Empty `required_dir_ids` with zero source check | Illegal / not `satisfied` |

---

## AC2-6 Architecture bans

| ID | Criterion | Pass if |
|---|---|---|
| AC2-6.1 | No Call A/B as Intake entry | Stated |
| AC2-6.2 | No legacy Stage 1–4 upgrade-as-Intake | Stated |
| AC2-6.3 | No Agenda as DIR SoT | Stated |
| AC2-6.4 | No fixed question list / task table as product design | Topic + Blueprint |
| AC2-6.5 | No runtime code in Phase 2 | Diff |
| AC2-6.6 | Independent Intake 2.0 engine | Stated |

---

## AC2-7 Author consistency self-check

> Not a substitute for independent product review.

| # | Check | Result |
|---|---|---|
| 1 | DDR→DIR refs resolve | **PASS** |
| 2 | DIR catalog 20 ids | **PASS** |
| 3 | Pages 01–08; 03 appendix; 07 conditional | **PASS** |
| 4 | P0=6, P1=5, P2=2 | **PASS** |
| 5 | Blueprint bans live DIR dual SoT | **PASS** |
| 6 | Phase 1 C1–C5 deviations | **0** |
| 7 | PageFeedMatrix unmodified | **PASS** |
| 8 | Source check + Gate order documented | **PASS** (DDR §1.3–§1.7) |
| 9 | AC2-5 tests 1–13 unambiguous in catalog | **PASS** (author) |
| 10 | Version literals: ddr/map/ddr_version=1.1; dir=1 | **PASS** |

---

## Unresolved issues / trade-offs

1. **Runtime** Gate composer implementing §1.4 — Phase 3+ (spec closed).  
2. **Topic classifier** — design outputs frozen; implementation later.  
3. **`DIR-STAKEHOLDERS`** — support-only in v1 mapping.  
4. Runtime confirmFact promotion / FreezeRecord sidecar — Phase 1 deferred, unchanged.

---

## Phase 2 exit

When product PASSes this package:

- Phase 3 may design Adaptive Question Engine / writers against these catalogs.  
- **Do not** implement runtime until Phase 2 PR approved.  
- **Do not** merge Phase 2 without product owner.

---

## Declaration

Phase 2 acceptance docs only. **No runtime code changed.**
