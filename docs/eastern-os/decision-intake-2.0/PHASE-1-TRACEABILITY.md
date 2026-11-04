# Decision Intake 2.0 · Phase 1 Traceability

| Field | Value |
|---|---|
| **Document type** | Formal traceability (docs only) |
| **Companion** | Data Contract + State Machines (Phase 1.2 C1–C5) |
| **PageFeedMatrix** | `.cursor/docs/decision-report/PageFeedMatrix-2026-10-27.md` |
| **Phase 1.1 review** | @ `17aec05c` |

**C1–C5 status:** **CLOSED**. Page structure `01–08` (07 conditional, `03` appendix) **unchanged**.

---

## 0. Purpose

Guarantee every report judgment can be traced:

```text
Report claim
  → DDR (obligation)
  → DIR (info need)   [state from DC.dirs ONLY]
  → Evidence (Fact / Constraint / Conflict / Hypothesis boundary)
  → optional CFP/ZFP / PersonalInsight
  → FreezeRecord (dc_content_hash + blueprint_version + ddr_version)
```

---

## 1. Source of Truth map (C3)

| Concern | SoT | Not SoT |
|---|---|---|
| Live facts / constraints / hypotheses / conflicts | **DC** | Understanding, Agenda, Blueprint |
| Live DIR `current_state` + evidence links | **`DC.dirs`** | Blueprint live copy, Agenda |
| DIR/DDR **definitions** / seed requirements | Blueprint @ version | — |
| Ask execution | Agenda | — |
| UI summary | DecisionUnderstanding (derived) | — |
| Chart structure | CFP / ZFP | RealityFacts |
| Freeze binding | **FreezeRecord** | Mutating old DC in place |

**Rule:** Blueprint updates never overwrite live `DC.dirs` states. Trace readers always resolve DIR status via `context.dirs.find(dir_id)`.

---

## 2. Canonical chain

```text
DDR.required_dir_ids[]
        │
        ▼
DC.dirs[dir_id].current_state   ← sole status read
        │
        ├── known  ← RealityFacts with status=confirmed matching required_roles
        ├── conflict ← open Conflict on contributors
        ├── n_a ← explicit N/A evidence
        └── unknown ← otherwise

DDR.status = f(DIR states, blockers)   ← Data Contract §3.2
  · all known|n_a with ≥1 known → satisfied
  · all n_a (+ explicit N/A evidence) → n_a   (NOT satisfied)
  · R empty + explicit N/A → n_a
  · R empty without N/A evidence → pending
Gate = g(DDR statuses by priority)     ← §3.3
  · Gate accepts {satisfied, n_a} as terminal OK for P0/P1 tests
Report segment cites ddr_ids + fact_ids + FreezeRecord
```

Agenda may appear only as audit: “asked via AgendaItem_y” — never as sufficiency proof.

---

## 3. Fact confirmation provenance (C1)

| Claim in report | Must be able to show |
|---|---|
| Fact treated as confirmed user assertion | E1 FactConfirmEvent id + `status=confirmed` + `user_confirmed=true` + `verification_level=user_asserted` |
| Independently verified fact | `verification_level=independently_verified`, `user_confirmed=false` |
| Estimate | `user_estimate` + `unverified`; must not appear as hard premise without boundary |
| Understanding freeze | E2 event + FreezeRecord; E2 must not invent fact confirms |

---

## 4. DDR → PageFeedMatrix faces

| DDR family (examples) | Face | Primary evidence |
|---|---|---|
| Decision frame / conclusion | `01` | Definition + confirmed facts |
| Mechanism / attribution | `02` | Facts + CFP/ZFP |
| Chart appendix | `03` | CFP+ZFP only |
| Costs / risks | `04`/`05` | Constraints, Conflicts |
| Alternatives / ranking | `05` | DIR known + may_affect_p5_ranking |
| Validation / experiment | `06` | Facts + DIR |
| Question-tied deep dive | `07` | Topic DIRs (emit only if relevant) |
| Continue/Adjust/Stop | `08` | Gate boundaries + open unknowns |

Exact instance catalog = Phase 2. Mapping **rules** frozen; face order locked by PageFeedMatrix.

`STAGE4_DC_FEED_PAGES = 01,02,04,05,06,08` remains compatible.

---

## 5. Gate & delivery disclosure (C4)

| Gate | Trace requirement |
|---|---|
| PASS | All P0 DDR ∈ {`satisfied`,`n_a`}; P1 OK per §3.3; FreezeRecord present |
| WARN | Conditional report lists unsatisfied DDRs/DIRs + boundaries; `delivery_mode=degraded` |
| FAIL | No normal freeze; provenance of failing P0/P1 DDR retained in audit |

Decline/unknown facts must appear as open DIRs or boundaries — never as `satisfied` or automatic `n_a` DDR evidence.  
All-DIR-`n_a` DDR must trace as status `n_a` (explicit applicability), not as a delivered/satisfied claim.

---

## 6. Version binding (C5)

Report artifact metadata must store:

- `freeze_id`
- `dc_content_hash`
- `blueprint_version`
- `ddr_version`
- `context_id` / `context_version`

Regeneration / audit: load FreezeRecord → verify hashes/versions → load matching Blueprint/DDR catalog snapshot → load DC version. **Silent remap forbidden.**

---

## 7. JudgmentProvenance (future attach)

Same shape as prior Phase 1 draft; `dir_ids` resolve status only through `DC.dirs`. `context_binding` must align with FreezeRecord when frozen.

---

## 8. Failure modes (detect)

| Failure | Detection |
|---|---|
| Dual DIR status (Blueprint vs DC) | Audit: Blueprint has no live status fields; readers use DC.dirs |
| Agenda ⇒ DIR known | Gate/aggregator unit tests |
| E2 ⇒ estimate confirmed | AC-C3 |
| independently_verified + user_confirmed | AC-C2 |
| Orphan claim / DDR without DIR | Provenance empty checks |
| Binding mismatch | Report start verify |
| Conflict blocks all DDRs | Related-only linker tests |
| Page order drift | PageFeedMatrix lock |

---

## 9. Deferred (not C1–C5)

Progress weights, Lockout, Ziwei hydration, agent_v2 cutover — remain later phases per Phase 1.1 report. Do not alter PageFeedMatrix or reintroduce Call A/B as Intake entry.

---

## 10. Declaration

Docs only. Traceability aligned with C1–C5 SoT rules.
