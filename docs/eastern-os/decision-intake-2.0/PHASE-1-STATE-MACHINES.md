# Decision Intake 2.0 · Phase 1 State Machines

| Field | Value |
|---|---|
| **Document type** | Formal state machines (docs only) |
| **Companion** | `PHASE-1-DATA-CONTRACT.md` (Phase 1.2 C1–C5) |
| **Phase 1.1 review** | `PHASE-1-1-REVIEW-REPORT.md` @ `17aec05c` |
| **Base SHA** | `297544134d7dcc8c942d5d314760bc3f4a75423f` |

**C1–C5 status:** **CLOSED** (aligned with Data Contract).

---

## 0. Rules

1. Every state listed here **must** appear in Data Contract enums.  
2. Diagram arrows **must** match transition tables.  
3. No undefined, orphan, or unreachable states.  
4. Session ≠ Lockout.  
5. Users never see Stage 1/2/3 labels; `blueprint_building` is internal only.

---

## 1. Session Lifecycle (C2)

### 1.1 Canonical enum (`IntakeSessionPhase`)

Identical to Data Contract §8:

`intake_init` · `blueprint_building` · `blueprint_ready` · `investigating` · `understanding_review` · `awaiting_user_confirm` · `frozen` · `reporting` · `closed` · `expired`

### 1.2 Diagram

```text
                    ┌──────────────┐
                    │ intake_init  │
                    └──────┬───────┘
                           │ first usable message / birth data OK
                           ▼
                 ┌─────────────────────┐
                 │ blueprint_building  │  (INTERNAL — no UI stage label)
                 └──────────┬──────────┘
                            │ Blueprint + DDR defs + DC.dirs seeds ready
                            │ blueprint_version persisted
                            ▼
                   ┌──────────────────┐
                   │ blueprint_ready  │
                   └────────┬─────────┘
                            │ scope_locked; first AgendaItem issued
                            ▼
                    ┌───────────────┐
              ┌────►│ investigating │◄──── revise / reopen from review
              │     └───────┬───────┘
              │             │ Gate ready OR soft budget / user request review
              │             ▼
              │   ┌──────────────────────┐
              │   │ understanding_review │  ← summary SHOWN (E2 not yet)
              │   └──────────┬───────────┘
              │              │ auto-enter wait for confirm UX
              │              ▼
              │   ┌─────────────────────────┐
              └───│ awaiting_user_confirm   │
                  └──────────┬──────────────┘
                     confirm │        │ revise / reopen
                     (E2)    │        └──► investigating
                             ▼
                       ┌─────────┐
                       │ frozen  │  ← FreezeRecord written
                       └────┬────┘
                            │ start report
                            ▼
                      ┌───────────┐
                      │ reporting │
                      └─────┬─────┘
                            │ success / terminal fail policy
                            ▼
                       ┌─────────┐
                       │ closed  │
                       └─────────┘

Any active (non-frozen/reporting) ──retain elapsed──► expired
frozen / reporting ──policy──► closed (not silent expire overwrite)
```

### 1.3 Transition table

| From | Event | Guard | To | Effects |
|---|---|---|---|---|
| `intake_init` | `FIRST_USABLE_INPUT` | Not locked out; birth/profile loadable | `blueprint_building` | Seed Definition draft; load PersonalAnalysisProfile |
| `blueprint_building` | `BLUEPRINT_BUILT` | DDR defs + `dir_ids` + `DC.dirs` seeds present; `blueprint_version` set | `blueprint_ready` | Persist Blueprint; **do not** reset later live DIR states |
| `blueprint_ready` | `SCOPE_LOCKED` | `scope_locked=true`; Agenda primary ready | `investigating` | Issue first question |
| `investigating` | `FACT_WRITTEN` / `CONFLICT_*` | — | `investigating` | Update DC; `reaggregateDirs`; refresh DDR statuses |
| `investigating` | `FACT_CONFIRM` (E1) | FactConfirmEvent valid | `investigating` | Apply §2.4A–C promotion; reaggregate |
| `investigating` | `GATE_READY_FOR_REVIEW` | Gate PASS or WARN with disclosures ready | `understanding_review` | Build DecisionUnderstanding |
| `investigating` | `USER_REQUEST_REVIEW` | Soft budget or explicit | `understanding_review` | Same |
| `understanding_review` | `SUMMARY_PRESENTED` | Summary rendered | `awaiting_user_confirm` | **Show ≠ confirm** |
| `awaiting_user_confirm` | `USER_CONFIRM_UNDERSTANDING` (E2) | Gate ≠ FAIL; disclosures OK | `frozen` | DC→final; write **FreezeRecord** (hash+bp+ddr versions) |
| `awaiting_user_confirm` | `USER_REVISE` | — | `investigating` | Keep DC draft; bump version |
| `frozen` | `START_REPORT` | Binding verify OK | `reporting` | Read-only DC |
| `reporting` | `REPORT_DONE` / `REPORT_FAIL_TERMINAL` | — | `closed` | Persist report ↔ FreezeRecord |
| `*` (pre-freeze) | `RETAIN_ELAPSED` | 24h | `expired` | Soft clear; no silent Freeze overwrite |
| any | `HARD_TERMINATE` | Policy | `closed` | Audit |

### 1.4 Forbidden

- Skipping `blueprint_building` without a recorded Blueprint version.  
- `understanding_review` → `frozen` without E2.  
- Treating E2 as E1 bulk fact promotion.  
- Stage labels in UI.  
- Mutating DC after `frozen` except supersede+new context.

### 1.5 Investigating turn loop (within `investigating`)

```text
select Agenda primary
  → present question (no Stage label)
  → classify answer (cooperative / unknown / declined / invalid)
  → write Fact|Constraint|Hypothesis|Conflict (never Call A/B stamp)
  → apply E1 if FactConfirm
  → reaggregateDirs(DC.dirs)
  → refresh DDR statuses (§4)
  → soft Gate evaluate
  → next ask OR GATE_READY_FOR_REVIEW / USER_REQUEST_REVIEW
```

Invalid-input streak feeds Lockout SM (§6), not Session phase change (except terminate/expire).

---

## 2. Fact confirmation & status promotion (C1)

### 2.1 Events

| Event | Code / name | Scope |
|---|---|---|
| E1 | `FACT_CONFIRM` / FactConfirmEvent | Single fact |
| E2 | `USER_CONFIRM_UNDERSTANDING` | Whole summary → Freeze |

### 2.2 Fact status after E1

| Prior `verification_level` | After E1 |
|---|---|
| `user_asserted` | `status=confirmed`, `user_confirmed=true`; keep source & verification_level |
| `independently_verified` | keep `status=confirmed`; **`user_confirmed` stays false** |
| `user_estimate` | **no status upgrade**; remains `unverified` + `user_estimate` |
| `none` (unknown/declined/n_a) | no promotion to confirmed |

E2: **no** automatic fact status changes.

After any E1 that yields `status=confirmed`, call `reaggregateDirs` so DIR `known` can fire (`status===confirmed` required).

### 2.3 Writes that never confirm

Model inference, hypothesis, Agenda covered → never set `confirmed` / `user_confirmed=true`.

---

## 3. DIR state machine (live on `DC.dirs` only — C3)

```text
                    ┌─────────┐
          seed ───► │ unknown │
                    └────┬────┘
           evidence│     │ conflict on contributors
                   ▼     ▼
              ┌───────┐ ┌──────────┐
              │ known │ │ conflict │──clarify──► unknown|known
              └───┬───┘ └──────────┘
                  │ N/A evidence
                  ▼
               ┌─────┐
               │ n_a │
               └─────┘
```

| Event | Effect |
|---|---|
| `DIR_SEEDED_FROM_BLUEPRINT` | Insert/update **requirement** fields into `DC.dirs` once; never wipe later evidence states on blueprint bump |
| `FACTS_CHANGED` | `reaggregateDirs` |
| `CONFLICT_OPEN` / `CLARIFIED` | Reaggregate |
| Agenda covered | **No** DIR transition alone |

Blueprint must **not** host a parallel live `current_state` store.

---

## 4. DDR status & Gate timing (C4)

### 4.1 When to refresh DDR status

After: Fact write, E1, Conflict change, DIR reaggregate, Blueprint seed (initial only).

Function: Data Contract §3.2 → `satisfied` \| `partial` \| `pending` \| `blocked` \| `n_a`.

**Roll-up (must match Contract §3.2; first match wins):**

Defs: `ids = required_dir_ids`; `R` = active DIRs found in `DC.dirs` for those ids; `dangling` = `ids.length > 0` but missing/deprecated refs; `truly_unrequired` = `ids.length === 0`.

| Condition | DDR status |
|---|---|
| Related blocking conflict | `blocked` |
| `dangling` (ids declared but no complete active set in DC.dirs) | `pending` (+ integrity error) — **never** `n_a` |
| All DIRs in `R` are `known`\|`n_a`, **≥1 `known`** | `satisfied` |
| All DIRs in `R` are `n_a` + explicit N/A evidence | `n_a` |
| `truly_unrequired` (`ids.length === 0`) + explicit N/A evidence | `n_a` |
| Mix of resolved (`known`/`n_a`) and unresolved (`unknown`/`conflict`) in `R` | `partial` |
| Otherwise (incl. `truly_unrequired` without N/A evidence) | `pending` |

Forbidden:

- treat all-DIR-`n_a` as `satisfied`  
- treat `R` empty alone as proof of “no required DIRs”  
- treat `dangling` as `n_a` / `satisfied`

### 4.2 When to evaluate Gate

| Moment | Action |
|---|---|
| Each investigating turn after DC write | Soft evaluate (advisory UX) |
| Enter `understanding_review` | Hard evaluate; block E2 if FAIL |
| Before FreezeRecord | Re-check; FAIL aborts freeze |
| Report start | Verify FreezeRecord bindings |

Gate composition: Data Contract §3.3.

| Priority | Unsatisfied means `status ∉ {satisfied, n_a}` | Gate effect |
|---|---|---|
| P0 | any (incl. full/partial dangling → pending) | **FAIL** (not PASS) |
| P1 | yes + (`dangling` **or** `|L|=0` **or** decision-critical / ranking impact) | **FAIL** |
| P1 | yes + `dangling === false` + `|L|≥1` + `|L| === ids.length` + every L `may_affect_p5_ranking === false` + boundaries | **WARN** |
| P2 | yes alone | must **not** alone block report |

`L` = linked **active** DIRs. `dangling` = any declared required id missing/deprecated (full **or** partial).

Forbidden WARN paths: empty `L`; **partial dangling** (e.g. ids=`[A,B]`, only A active, B missing) even if A is non-ranking and boundaries exist.

P0/P1 DDR in `n_a` counts as Gate-acceptable terminal (same bucket as `satisfied` for PASS/FAIL tests only).

---

## 5. Decision Understanding (derived)

```text
DC change → rebuild Understanding → UI
E2 confirm → Freeze (not a second SoT write)
```

No independent fact writes from Understanding.

---

## 6. Invalid Input / Lockout

Unchanged product machine (Phase 8). Orthogonal to Session. While locked: block Agent/DC/Agenda/PASS; do not advance Session except expire/terminate policies.

---

## 7. Freeze / report binding (C5)

```text
E2 ──► DC.status=final
    ──► content_hash = hash(DC business payload ONLY)
    ──► FreezeRecord{ dc_content_hash, blueprint_version, ddr_version, ... }
    ──► session → frozen

Report start:
  assert FreezeRecord.dc_content_hash == DC.content_hash
  assert FreezeRecord.blueprint_version == Blueprint.blueprint_version used
  assert FreezeRecord.ddr_version == catalog version used
  mismatch → refuse / FAIL (no silent remap)

New Blueprint/DDR version later:
  new freeze only on new E2 cycle
  prior FreezeRecords + report bindings immutable
```

---

## 8. Cross-check vs Data Contract

| Topic | Contract § | SM § |
|---|---|---|
| Phase enum | §8 | §1 |
| Fact promotion | §2.4 | §2 |
| DIR SoT | §2.8 | §3 |
| DDR/Gate | §3 | §4 |
| FreezeRecord | §10 | §7 |

---

## 9. Declaration

Docs only. No runtime changes. C1–C5 closed in SM form.
