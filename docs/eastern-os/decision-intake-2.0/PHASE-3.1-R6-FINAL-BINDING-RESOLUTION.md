# Stage 3.1-R6 — Final Binding Resolution for Stage 3.2

| Field | Value |
|---|---|
| Status | **Normative implementation addendum; supersedes only the conflicting R6 clauses identified below** |
| Base | `225aed712c1e24508ae4a9b1d779ce00ffee89a2` |
| Scope | Resolve the two remaining implementation ambiguities; no new design cycle |
| Applies to | Stage 3.2 implementation and MX-83…127 execution |

This addendum is the final binding interpretation of R6. It does not reopen Phase 1 C1–C5, Phase 2, Session lifecycle, budgets, Gate, ShowReceipt, or source_only. If an R6 sentence conflicts with this addendum on N/A granularity or partial-state semantics, this addendum controls. All other R6 requirements remain unchanged.

## 1. N/A granularity: DIR-level only

**Decision: ExplicitNaEvidence is DIR-level evidence, not role-level evidence.**

1. Keep the existing R6 `ExplicitNaEvidence.target="dir"` shape. Do not add `role_code`, role arrays, or role-specific N/A fields.
2. A valid DIR-targeted ExplicitNaEvidence applies to the DIR as a whole. It does not independently satisfy, waive, or mark any individual role as N/A.
3. The N/A validator must validate the evidence against the exact DIR's catalog `na_conditions`, target linkage, source/E1 requirements, or permitted system basis. Invalid, revoked, stale, orphaned, or mismatched evidence has no aggregation effect.
4. If a DIR has a valid, live DIR-level N/A marker and no blocking conflict, its aggregate state is `n_a`. The role-resolution view may report `n_a` for every required role solely as a derived consequence of the DIR-level marker; those are not separate role-level evidence records.
5. If there is no valid DIR-level N/A marker, every required role is evaluated only from Fact/Constraint evidence under §2. A missing role cannot be converted to N/A by an unrelated marker, model inference, silence, decline, or unknown.
6. Blocking conflict takes precedence over N/A. A DIR with a blocking conflict remains `conflict` until that conflict is clarified/resolved and aggregation is rerun.
7. A DIR with zero required roles is not automatically `n_a`. Preserve the Phase 1 behavior and require the applicable explicit catalog evidence path.
8. DDR-targeted evidence remains a separate path and is governed only by R6 Understanding §2.7 A1–A3 and Phase 2. In particular, the only empty-DIR source-absence DDR N/A path is DDR-03 with live CFP state `source_absent_not_supplied`. DDR-02 Rule A remains non-waivable.

This resolves the apparent role-level N/A language in R6 Planning §2.1.2: replace “valid ExplicitNaEvidence n_a for that DIR/role path” with “valid DIR-level ExplicitNaEvidence for the whole DIR; if valid, derive n_a for all its required roles.” MX-118 and MX-119 must be interpreted accordingly:
- MX-118: partial role evidence or an absent role does not create DIR N/A; without valid DIR-level evidence, DIR is not `n_a`.
- MX-119: a valid DIR-level N/A marker, with no blocking conflict, may make the DIR `n_a`; it is not a test of every role having separate N/A evidence.

## 2. Canonical role evidence states and deterministic precedence

The shared `resolveDirRoleEvidence` is the sole role evaluator used by Question Planning and DIR aggregation. It must be pure/deterministic over the supplied current DC snapshot, catalog requirements, valid conflicts, and validated N/A evidence. Both callers must receive the same result for the same inputs.

### 2.1 RealityFact association and state

A RealityFact is considered for role `r` on DIR `D` only when BOTH are true:
- `fact_roles` contains the exact role code `r` (or the exact canonical namespaced role string); and
- `related_dir_ids` contains exact `D`.

No OR fallback, inferred association, substring match, semantic similarity, or cross-DIR borrowing is permitted.

After that association gate, apply the existing Phase 1 legal `status × verification_level` combinations; do not create or reinterpret combinations:

| RealityFact pair | Role contribution |
|---|---|
| `confirmed + user_asserted` with derived `user_confirmed=true` | confirmed |
| `confirmed + independently_verified` with derived `user_confirmed=false` | confirmed for factual roles; never qualifies as user-explicit N/A source |
| `unverified + user_asserted` | partial |
| `unverified + user_estimate` | partial |
| `unknown + none` | unresolved |
| `declined + none` | unresolved; never N/A |
| `not_applicable + none` | unresolved for role satisfaction; it is not ExplicitNaEvidence |
| Any illegal pair | reject the write at DC validation; it must not reach the resolver |

A RealityFact with a legal partial pair contributes only to the exact role/DIR it is explicitly associated with. It never makes that role confirmed or makes the DIR known.

### 2.2 Constraint association and state

A Constraint is considered only for the two Scheme A roles:
- `hard_constraint` ⇔ `rigidity === "hard"`
- `soft_constraint` ⇔ `rigidity === "soft"`

It must also have exact `related_dir_ids` membership for the target DIR, be live, and have `status === "confirmed"`. Apply the existing Constraint validation contract; do not invent a new FactStatus/VerificationLevel pairing for Constraints.

A confirmed, valid Constraint contributes **confirmed**. A Constraint with missing association, mismatched rigidity, illegal data, non-confirmed status, or a blocking conflict contributes **unresolved** (or conflict under §2.3). Constraints do not create a partial role contribution in this version. Category restrictions may narrow eligibility when the catalog declares allowed categories; category alone never establishes role identity.

### 2.3 Role-level precedence

For each required role, apply this order:

1. If a blocking Conflict applies to the role/evidence, return `conflict`.
2. Else if at least one eligible RealityFact or Constraint confirms the role, return `confirmed`. Multiple records still count as one role.
3. Else if at least one eligible RealityFact has one of the two legal partial pairs in §2.1, return `partial`.
4. Else return `unresolved`.

A confirmed eligible record wins over partial records for the same role. A blocking conflict wins over confirmed/partial evidence until clarified. Unknown, declined, not_applicable, missing fields, stale records, and unassociated evidence never count as partial.

N/A is deliberately absent from this per-role evidence precedence. It is applied only by the DIR-level rule in §1.

### 2.4 DIR aggregation — preserve Phase 1 enum

The live SoT remains `DC.dirs[].current_state` with exactly the Phase 1 states: `known | unknown | conflict | n_a`. Do not add a DIR `partial` state.

For a DIR with at least one required role, after evaluating all roles:

1. Any blocking DIR conflict → `conflict`.
2. Else valid DIR-level ExplicitNaEvidence → `n_a`.
3. Else every required role is `confirmed` → `known`.
4. Else → `unknown`.

Partial role support may be exposed as derived diagnostic/planning information, but it does not change the DIR enum and does not satisfy a required role. DDR roll-up continues to use the Phase 2 status function; do not replace DDR `partial` with a new DIR state.

### 2.5 Planner semantics

For each unique canonical namespaced role:
- `confirmed` → resolved;
- `partial`, `unresolved`, or `conflict` → unresolved for gain/unresolved_count;
- `n_a` only when the DIR-level N/A marker is valid, in which case all required roles of that DIR are derived as N/A.

Deduplicate by full canonical role string. A role on one DIR cannot be resolved by evidence linked only to another DIR. `source_only` remains unchanged.

## 3. E1 and N/A source proof: implementation binding

R6 §2.7 A3 remains fail-closed. Reuse the existing ConfirmationEvent/E1 implementation. For `user_explicit_na`, code must prove all of the following from persisted records:
- source record is live and belongs to the current DC;
- source is a user-originated RealityFact or Constraint;
- legal confirmed/user_asserted state and derived `user_confirmed === true`;
- a persisted user ConfirmationEvent targets that exact record;
- exact DIR/DDR association and exact catalog condition are satisfied;
- the user's explicit N/A declaration is represented by a persisted, code-verifiable classification linked to that source record.

A model-proposed label, free-text keyword hit, embedding match, or the mere existence of an E1 event is not by itself proof that the user explicitly declared the catalog condition. If the existing persisted data cannot prove the declaration deterministically, reject the N/A evidence. Do not add a new E1/E2 event type. For DDR-03, always re-read live CFP state and exact required source code; a user statement cannot relabel calculation failure or missing provenance as source absence.

## 4. Required implementation and test mapping

Stage 3.2 must implement, in one vertical slice:

1. One shared `resolveDirRoleEvidence` module imported by Question Planning and DIR aggregation.
2. AND-only Fact association and Scheme A Constraint association.
3. Constraint `related_dir_ids` support and inclusion in the C5 business payload.
4. DIR-level-only ExplicitNaEvidence validation and aggregation; no role-level N/A schema.
5. The exact RealityFact partial rules and precedence in §2; no Constraint partial semantics.
6. C5 hash inclusion for `explicit_na_evidence` and `constraints[].related_dir_ids`, using the existing canonical serializer. Blueprint/DDR catalog versions remain excluded.
7. On create/revoke/source invalidation/association change: DC version + hash update, shared resolver, DIR reaggregation, DDR composition, Gate refresh, and Understanding rebuild from DC.
8. Existing Phase 1 enums, Fact combinations, E1/E2, DC.dirs SoT, FreezeRecord semantics, budgets, and Phase 2 DDR/Rule A behavior remain unchanged.

MX execution must include at minimum:
- Fact exact AND association: missing role, missing DIR link, wrong DIR, and valid exact pair.
- Fact confirmed vs partial vs unknown/declined/not_applicable and illegal-pair rejection.
- Constraint hard/soft exact association; wrong rigidity, absent link, and non-confirmed rejection.
- precedence: blocking conflict > confirmed > partial > unresolved.
- DIR-level N/A applies to the whole DIR only; invalid/revoked N/A does not; no role-level N/A field exists; one missing role cannot make a DIR N/A.
- DDR-03 source_absent_not_supplied accepted only with valid exact evidence; calc_failed/provenance_missing rejected; DDR-02 non-waivable.
- hash/version changes and full downstream recomputation; Blueprint/DDR catalog version changes alone do not alter DC hash.
- Planner and Aggregator produce identical role outcomes for the same input snapshot.

## 5. Exit rule — no more design-only R cycles

This addendum closes the two outstanding R6 ambiguities. The implementation team should proceed to Stage 3.2 directly using R6 plus this addendum. Do not open another design-only R7 for wording or preference changes.

Stage 3.2 may receive implementation patches and tests. Return to a design gate only if implementation reveals a direct contradiction with frozen Phase 1 C1–C5 or Phase 2 semantics, or an invariant that cannot be implemented without changing those frozen contracts. Ordinary coding defects, missing wiring, or failing MX cases are Stage 3.2 implementation fixes, not reasons to restart Phase 3.1.
