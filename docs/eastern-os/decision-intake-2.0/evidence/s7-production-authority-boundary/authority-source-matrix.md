# S7 · Production NaValidation authority-source matrix

Code HEAD: `8048aaaee9df1de1b48782c577a70aec8041f5c5` (parent `13e51159…`).
Test file abbreviations: **PAB** = `test-intake-r6-production-authority-boundary.ts`,
**S5** = `test-intake-r6-freeze-authority-regression.ts`, **FV** = `test-intake-r6-freeze-versioning.ts`,
**PA** = `test-intake-r6-production-agg.ts`, **WFC** = `test-intake-r6-write-freeze-consistency.ts`,
**DCAT** = `test-intake-r6-dir-catalog.ts`.

This matrix covers the four production paths only. It does **not** claim that N/A
authority is complete: three sources are still AUTHORITY_GAP (see §3 and `known-gaps.md`).

## 1. Per-path sources (after S7)

All four paths obtain `NaValidationContext` from `buildProductionNaValidationContextFromSession(session, { nowIso })`.

| Source | Freeze `freezeDraftForDelivery` | Versioning `applyV2FromFinalToSession` | Lifecycle `reaggregateDirsOnSession` (Call B / collecting) | Ask `selectNextIntakeAskForSession` |
|---|---|---|---|---|
| Session SoT: `confirmation_events`, `na_declaration_actions`, `topic_applicability_evals`, `topic_catalog_version` | Session only | Session only | Session only | Session only |
| DC SoT: `reality_facts`, `constraints`, `explicit_na_classifications` | Session DC (= business-bound draft) | final DC; V2 draft rebinding via `naValidationForDcSnapshot` inside `startV2FromFinal` | Session DC; in-flight facts/constraints of the DC being mutated rebound via `naValidationForDcSnapshot` (DC-owned fields only) | Session DC |
| DIR Catalog | `loadDirNaCatalog(ACTIVE)` | `loadDirNaCatalog(ACTIVE)` | `loadDirNaCatalog(ACTIVE)` | `loadDirNaCatalog(ACTIVE)` |
| `topicRules` | unset → AUTHORITY_GAP, fail-closed | unset | unset | unset |
| `catalogConditionEvals` | unset → AUTHORITY_GAP, fail-closed | unset | unset | unset |
| `cfpSourceState` | unset → AUTHORITY_GAP, fail-closed | unset | unset | unset |
| ACTIVE load failure | `FreezeError(reason_code, {code})`; wire `reason_code` preserved | throws `ProductionNaAuthorityError`; `persistV2…` → `ok:false, reason=<code>` | throws; Call B → `dir_map_error`; collecting persist rejects before C1 | throws; no plan |
| Caller override entry? | **No** (`authority` removed from opts type; runtime extra keys ignored) | **No** (`authority` removed; runtime `naValidation` overwritten) | **No** (`opts.authority` removed; runtime extra keys ignored) | **No** (`input.naValidation` removed; runtime key ignored) |
| Low-level injection kept (fixture/pure) | `freezeDecisionContext({naValidation})` | `startV2FromFinal({naValidation})` | `reaggregateDirsIntake(…, na)` | `planNextAskFromCandidates({naValidation})` |

## 2. Before → after (semantic change, in acceptance scope)

| Path | Before S7 | After S7 |
|---|---|---|
| Freeze | Session authority + ACTIVE catalog already enforced (S1/S5); `topicRules` / `catalogConditionEvals` / `cfpSourceState` passed through from `opts.authority` | Same Session + ACTIVE; the three gap fields can no longer be supplied by callers → topic / catalog-condition N/A cannot be authorized in production Freeze |
| Versioning | `opts.authority` spread over Session fields (overrides possible); **no** DIR catalog → user N/A never validated on V2 reaggregation (V1 `n_a` DIR fell back to facts) | Session + ACTIVE; valid user N/A survives into V2 draft (PAB C0) |
| Lifecycle (Call B / collecting) | `opts.authority` spread; production callers passed none → **no** DIR catalog → user N/A never effective in collecting | Valid Session action + DC classification/evidence (ACTIVE pair) becomes `n_a` during collecting (PAB D0) |
| Ask | `input.naValidation ?? build(...)` (caller could replace ctx); default ctx had **no** DIR catalog | Always production ctx; DIR made `n_a` in collecting is no longer an ask candidate (PAB E2) |
| Catalog load failure | Freeze: FreezeError. Others: no catalog was loaded | All four: fail-closed as in §1; never empty/default catalog |

## 3. AUTHORITY_GAP (unchanged by S7, still open)

`PRODUCTION_NA_VALIDATION_SOURCE_GAPS` = `catalogConditionEvals`, `topicRules`, `cfpSourceState`.
`dirCatalog` removed from the gap list (`PRODUCTION_NA_VALIDATION_DIR_CATALOG_SOURCE = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)`).
Consequence: production topic-based, catalog-condition-based and DDR-03 CFP-absence N/A are always rejected
(`topic_rule_missing` / `catalog_eval_missing` / `ddr03_cfp_not_absent`). This is fail-closed, not a completed capability.

## 4. Test map

### 4.1 PAB (new, 37 checks)

| ID | Path | What it proves | Positive precondition → direct cause |
|---|---|---|---|
| A1–A3 | builder | Session fields by reference; DC fields by reference; `dirCatalog === loadDirNaCatalog(ACTIVE).entries` | — |
| A4 | builder | gap fields not own keys (no `[]`); gap constant contents | — |
| A5 | builder | forged keys on non-literal opts ignored (`deepEqual` clean ctx) | — |
| A6 | builder | missing / superseded DC, blank `session_id` → throw | — |
| B0 | Freeze | Session triad + ACTIVE pair → `n_a` | positive |
| B1 | Freeze | forged `dirCatalog` + forged `naValidation` | fixture w/ forged catalog → `n_a` · prod `na_condition_not_in_catalog` |
| B2 | Freeze | forged `topicRules` | prod ctx + rule → `ok`/`n_a` · prod `topic_rule_missing` |
| B3 | Freeze | forged `catalogConditionEvals` | prod ctx + eval → `ok`/`n_a` · prod `catalog_eval_missing` |
| B4 | Freeze | forged `cfpSourceState` | Freeze ctx + absent → `ok` · Freeze ctx `ddr03_cfp_not_absent`; forged freeze `deepEqual` clean freeze |
| B5 | Freeze | forged `confirmationEvents` | prod ctx + E1 → `ok` · prod `e1_missing` |
| B6 | Freeze | forged `naDeclarationActions` | prod ctx + action → `ok` · prod `explicit_na_classification_missing` |
| B7 | Freeze | forged topic evals/version | Freeze ctx authority `===` Session (`[]`); + rule + forged row → `ok`; + rule only → `topic_eval_id_unknown` |
| B8 | Freeze | C23 / DC-8 mirror (DIR-A + `explicit_not_applicable`) | fixture w/ forged catalog → `n_a` · prod `na_condition_not_in_catalog` |
| C0 | Versioning | V1 `n_a` → V2 `n_a`; V1 hash stable | positive |
| C1 | Versioning | Session action removed + forged action / `naValidation` | forged ctx → `ok` · prod `explicit_na_classification_missing` |
| C2 | Versioning | forged `dirCatalog` | prod ctx + forged catalog → `ok` · prod `na_condition_not_in_catalog` |
| D0 | Lifecycle | collecting applies valid N/A → `n_a` | positive (S7 semantic) |
| D1 | Lifecycle | forged authority / `naValidation` on reaggregate opts | fixture → `ok`/`n_a` · prod `explicit_na_classification_missing` |
| D2 | Lifecycle | in-flight fact (not in Session DC) used | without in-flight → `source_missing`; with → `n_a` |
| D3 | Lifecycle | in-flight snapshot cannot override Session authority | `naValidationForDcSnapshot` keeps Session/ACTIVE refs; rebound + action → `ok`; rebound → `explicit_na_classification_missing` |
| E0 | Ask | production plan `deepEqual` `planNextAskFromCandidates(prod ctx)` incl. budget | — |
| E1 | Ask | forged `input.naValidation` ignored | low-level forged ctx changes `unresolved_count` (injection still works) · production plan == prod-ctx plan |
| E2 | Ask | `n_a` from collecting removes DIR from candidates | before: candidate present |
| F0 | fault | injector reaches real module-private registry; restored | `loadDirNaCatalog` → `dir_catalog_load_failed` |
| F1 | Freeze | FreezeError code/message; `ensure…` `reason_code`; IDB DC stays draft | twin w/o fault → final |
| F2 | Versioning | apply throws; persistV2 `ok:false` | — |
| F3 | Lifecycle | reaggregate throws; Call B `dir_map_error`, DC unchanged; IDB DC + control plane unchanged | w/o fault Call B applies |
| F4 | Lifecycle | collecting persist rejects; IDB DC/messages unchanged | twin w/o fault commits fact |
| F5 | Ask | throws, no plan | — |
| F6 | all | gap sources missing → `topic_rule_missing` / `catalog_eval_missing` | (positives in B2/B3) |
| S1–S5 | static | no lib/app consumer of fixture builder/types (any alias/re-export); removed names gone; builder/reaggregate/snapshot bodies free of fixture/overrides/env; entry types expose no authority/naValidation; every path calls production builder | — |

### 4.2 Migrated existing tests (no assertion deleted or weakened)

| Old assertion | Now |
|---|---|
| S5 F1 Session N/A wins over forged authority | unchanged (production) |
| S5 F2 forged action → not `n_a` | unchanged + added: prod `explicit_na_classification_missing`, prod + action → `ok` |
| S5 F3 Session topic eval + rules → `n_a` | **F3-Pure** (rule + eval → `n_a`; version mismatch → `topic_catalog_version_stale`) + **F3-Production** (forged rules/eval via Freeze → `known`, `topic_rule_missing`; prod + rule → `ok`) + **F3-Production-Source** (builder & Freeze ctx topic authority/version `===` Session). F3-Pure ≠ Session-priority evidence. |
| S5 F4 Session missing eval + forged eval → not `n_a` | **F4-Pure** (authority row → `n_a`; no row → `topic_eval_id_unknown`) + **F4-Production** (Freeze → `known`; ctx authority `===` Session `[]`; + rule → `topic_eval_id_unknown`) |
| FV A "fail-closed w/o catalog; valid+catalog → `n_a`" | **A-Pure** same assertions w/ explicit fixture catalog + `na_condition_not_in_catalog`; **A-Prod** ACTIVE pair → `n_a`, forged catalog for DIR-A → `na_condition_not_in_catalog` |
| FV A "revoked / cross-context ineffective" | A-Pure and A-Prod each: precondition `n_a`, then `revoked` / `explicit_na_classification_missing` |
| FV A conflict-blocks-Freeze (`dirCatalog` override) | fixture ctx with same catalog (N/A valid; conflict still blocks) |
| PA C missing catalog / valid+catalog / revoked / cross-ctx / conflict | **C-Pure** (original DIR-A assertions + direct causes) + **C-Prod** (ACTIVE pair; forged catalog; revoked; cross-ctx; conflict) |
| PA C DDR-03 CFP calc_failed / absent | C-Pure via fixture + **new** C-Prod: production `cfpSourceState` unset → `ddr03_cfp_not_absent` |
| DCAT L119, PA L803, FV builder call-sites | production builder (nowIso only) |
| WFC C23, DCAT DC-8 | unchanged; forged `authority` literal still reaches the real Freeze call at runtime against a complete Session triad for a non-ACTIVE pair; explicit precondition mirrored in PAB B8 |
