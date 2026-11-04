# Decision Intake 2.0 · Phase 2 Blueprint Initialization

| Field | Value |
|---|---|
| **Baseline** | `main` @ `1f1c111e` |
| **Phase 1** | Data Contract §4 · State Machines `blueprint_building` → `blueprint_ready` |
| **Catalogs** | DDR/DIR catalog version 1 |
| **Code reuse** | `Definition`, `DIR` shape from `types.ts`; CFP via ProfileStructured; ZFP via `lib/ziwei/fact-pack` |

---

## 0. Purpose

Define how the **initial InvestigationBlueprint** is constructed as a **versioned seed snapshot**, and how it seeds `DC.dirs` **once** without becoming a second live DIR store.

---

## 1. Inputs to Blueprint builder

| Input | Source | Use |
|---|---|---|
| Definition draft | Opening message / early DC.definition | Topic classify; which core DIRs mandatory |
| Decision type / topic tags | Classifier (later phase) over Definition + user text | Topic Applicability → page_07 + topic DIRs |
| Stakes / outcome / constraints hints | Definition + early facts | InvestigationDirection priority |
| PersonalAnalysisProfile / BaZi | Local calc → `ProfileStructured` / ChartFactPack | Directions for pattern; **not** RealityFacts; feeds DDR-03 |
| ZiweiFactPack | `lib/ziwei/fact-pack` when birth hour/data allows | Optional ZFP; omit if unavailable |
| DDR/DIR catalogs | This Phase 2 package | Instance selection |

**Forbidden inputs as Intake entry:** Call A, Call B, legacy Stage 1–4 sequential factory.

---

## 2. Blueprint record (seed)

| Field | Content |
|---|---|
| `blueprint_id` | New id |
| `blueprint_version` | Start at 1; bump on scope change |
| `ddr_version` | `ddr_catalog_version` used (1) |
| `dir_catalog_version` | 1 |
| `session_id` / `context_id` | Bind to session + DC |
| `topic_tags` | From applicability |
| `page_07_emit` | boolean |
| `ddr` | Selected DDR **definitions** (copy of catalog rows applicable) |
| `dir_ids` | All DIR ids referenced by selected DDRs (+ topic pack if emit) |
| `dir_seed_snapshot` | Immutable array of `{dir_id, need, why, required_fact_roles, may_affect_p5_ranking, serves_face, serves_judgment}` — **no** `current_state` |
| `directions` | `InvestigationDirection[]` (see §4) |
| `scope_locked` | false until `blueprint_ready` transition |
| `change_log` | Append-only |
| `profile_binding` | `{ has_cfp, has_zfp, cfp_hash?, zfp_hash? }` calc provenance only |

---

## 3. Initialization algorithm (deterministic outline)

```text
1. Load Definition draft from DC (may be partial).
2. Resolve topic_tags via Topic Applicability (PHASE-2-TOPIC-APPLICABILITY.md).
3. Select always-on DDRs: all except DDR-07 unless page_07_emit.
4. Select DIR set = union(required_dir_ids of selected DDRs)
     + topic pack DIRs if page_07_emit
     + DIR-STAKEHOLDERS optional if stakes imply multi-party.
5. Build dir_seed_snapshot from DIR catalog definitions (no live state).
6. Write DC.dirs:
     For each dir_id in dir_ids:
       if missing in DC.dirs → insert with current_state=unknown,
         id_lifecycle=active, fields from seed, agenda_item_ids=[].
       if present → do NOT reset current_state / evidence on blueprint rebuild.
7. Attach DDR definitions to Blueprint.ddr (status not stored; computed later).
8. Build InvestigationDirections (§4).
9. Persist blueprint_version, ddr_version; enter blueprint_ready when scope_locked.
```

### 3.1 Hard bans

| Ban | Why |
|---|---|
| Blueprint holds live `current_state` | C3 |
| Blueprint update wipes `DC.dirs` states | C3 |
| Mark DIR known because Agenda asked | C3 / Traceability |
| Mark unknown complete | C1/C4 |
| Auto-expand scope without validation | Topic Applicability |
| Chart interpretation → confirmed RealityFact | P2-F / Phase 1 |
| Call A/B as seed factory | Architecture |

---

## 4. InvestigationDirection seeding

Each direction groups DIRs for adaptive questioning (execution only).

Suggested initial directions (not a fixed question list):

| direction_id | Priority | dir_ids (typical) | depth_soft_cap |
|---|---|---|---|
| `DIRN-DEFINITION` | P0 | DEF-* | 3 |
| `DIRN-OPTIONS` | P0 | OPT-ON-TABLE, STATUS-QUO, PAST-ATTEMPTS | 3 |
| `DIRN-CONSTRAINTS` | P0 | OPT-CONSTRAINTS, OPT-IRREV, TIMING-WINDOW | 3 |
| `DIRN-RISK-EXIT` | P1 | RISK-TOLERANCE, EXIT-CRITERIA, VALIDATION-CAPACITY | 3 |
| `DIRN-TOPIC` | P1 | Topic pack DIRs if emit | 3 |

`scope_boundary`: directions may not invent new DDR outside catalog without Blueprint version bump + product rules.

Questions (later Adaptive Engine) must cite `direction_id` + `dir_ids` / `ddr_ids`. One primary question per turn default (Phase 1).

---

## 5. Versioning

| Event | Action |
|---|---|
| First successful build | `blueprint_version=1`, FreezeRecord later binds it |
| Topic reclassify / add DDR-07 | New version; **merge** new DIR seeds into DC.dirs without resetting known states |
| Catalog upgrade mid-session | Prefer freeze-then-new-session; if mid-flight, bump versions and re-seed missing ids only |
| Supersede DIR | `id_lifecycle` on DC.dirs; Blueprint change_log; do not dangling-delete required ids without DDR update |

FreezeRecord binds `blueprint_version` + `ddr_version` + `dc_content_hash` (Phase 1 C5).

---

## 6. Incomplete profile handling (aligned DDR catalog §1.3 / §3.3.1)

| Case | `profile_binding` | DDR-03 | DDR-02-ATTRIBUTION |
|---|---|---|---|
| Birth/profile **not supplied** | `has_cfp=false`, reason=`not_supplied` | `n_a` **only** with explicit N/A evidence; else `pending` | CFP required → composed unsatisfied → Gate **P0 FAIL** (paid Intake expects profile for attribution) |
| Birth supplied, **calc/load failed** | `has_cfp=false`, reason=`calc_failed` | `pending` — **never** silent N/A | `pending` → P0 **FAIL** |
| CFP present, **hash/provenance missing** when expected | `cfp_hash` null unexpectedly | `pending` | `pending` → P0 **FAIL** |
| CFP `source_ok`, ZFP absent | `has_zfp=false` | **`satisfied`** (ZFP optional) | **`satisfied`** if DIRs OK (ZFP optional) |
| Packs present + hashes | `has_cfp/has_zfp` + hashes | May `satisfied` | May `satisfied` if DIRs OK |

Calc packs never become RealityFacts. Blueprint does not store live DIR state.

Gate evaluation order (normative):  
`DIR Rollup → Required Source Check → Conflict Check → DDR Status → Sufficiency Gate`  
(see `PHASE-2-DDR-CATALOG.md` §1.4).

---

## 7. Session phase hook

State Machines: `intake_init` → `blueprint_building` (this algorithm) → `BLUEPRINT_BUILT` → `blueprint_ready` → investigating.

Users never see Stage labels; Unified Decision Understanding UI only.

---

## 8. Gaps

1. Topic classifier implementation = later phase (rules in Topic Applicability are design-time).  
2. Hash functions for CFP/ZFP reuse existing delivery hash helpers when wired — not reimplemented here.  
3. Runtime Gate composer for Required Source Check = Phase 3+ (spec closed in DDR catalog §1.3–§1.6).  
4. No runtime Blueprint engine in Phase 2.

---

## 9. Declaration

Docs only. Blueprint = seed snapshot. `DC.dirs` = sole live DIR SoT.
