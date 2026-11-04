# Decision Intake 2.0 · Phase 1 Data Contract

| Field | Value |
|---|---|
| **Document type** | Formal data contract (docs only; no runtime code) |
| **Base SHA** | `297544134d7dcc8c942d5d314760bc3f4a75423f` (`main`) |
| **Phase 0 baseline** | `docs/eastern-os/decision-intake-2.0/PHASE-0-CODEBASE-BASELINE.md` @ `cc00be4a` |
| **Product SSOT** | `.cursor/plans/全新统一决策问答系统：架构设计与开发实施规范.MD` |
| **Engineering role** | Review, validate, document — **do not change product semantics** |

---

## 0. Purpose and authority

This document freezes the **data model contract** for Decision Intake 2.0 so later phases can implement without re-negotiating meaning.

| Authority | Scope |
|---|---|
| Product design plan | Business meaning, object duties, rules |
| This document | Typed fields, enums, invariants, reuse vs new types, tech risks |
| Existing code | Evidence of what already exists / is wired |

**Non-goals (Phase 1):** implement engines, change Agent/Call A/B, migrate DB, change UI/prompts.

---

## 1. Object map (duties)

```text
InvestigationBlueprint  ──defines──►  DDR[] + InvestigationDirection[] + DIR[]
        │
        ▼
AdaptiveQuestionPlan    ──queues──►  AgendaItem[] (execution only; NOT facts)
        │
        ▼
User Answer / Evidence  ──writes──►  DecisionContext (ONLY fact SoT)
        │
        ├── RealityFacts / Constraints / Hypotheses / Conflicts / DIR.current_state
        │
        ▼
DecisionUnderstanding   ──derives──►  UI + model planner (read-only projection)
        │
PersonalAnalysisProfile ──feeds──►  Pattern Insight + report CFP/ZFP (NOT RealityFacts)
        │
SufficiencyGate         ──reads──►  DC + DDR + DIR  (code gate; model may advise only)
        │
Freeze                  ──immutabilizes──►  DC final + binding triple
        │
Report (01–08)          ──reads──►  frozen DC + PageFeedMatrix slices
```

| Object | Duty | Must NOT |
|---|---|---|
| **DecisionContext (DC)** | Sole authoritative store of definition, facts, constraints, hypotheses, conflicts, DIR states | Be duplicated into `agent_v2` as authority |
| **DDR** | What the **report** must deliver (per face/section) | Hold user facts; substitute for DC |
| **DIR** | What **information** a judgment needs; aggregated from facts | Flip to `known` because Agenda covered |
| **InvestigationBlueprint** | Locked investigation scope + directions + links to DDR/DIR | Be a static question list |
| **AdaptiveQuestionPlan / Agenda** | Execution queue of asks | Be fact SoT or sufficiency proxy |
| **DecisionUnderstanding** | Derived view for UI + planner | Become a second fact DB |
| **PersonalPatternInsight** | Derived from local BaZi/ZiWei calc relevance | Be written as RealityFact |
| **SufficiencyGate** | Code verdict PASS/WARN/FAIL | Auto-PASS on user hard-push / stall alone |
| **SessionLifecycle** | Intake session phases | Be merged with Lockout SM |
| **InvalidInput / Lockout** | Abuse protection (server-enforced) | Call model / mutate DC / spend PASS while locked |

---

## 2. Decision Context (DC)

### 2.1 Reuse vs adapt

| Item | Code today | Intake 2.0 |
|---|---|---|
| Core types | `lib/poju/decision-context/types.ts` | **REUSE** types; keep SoT path |
| Legal status×verification | `fact-combination.ts` `LEGAL_FACT_COMBINATIONS` | **REUSE** |
| DIR aggregate | `dir-aggregator.ts` | **REUSE** |
| Freeze / hash / version | `freeze.ts`, `content-hash.ts`, `versioning.ts` | **REUSE** with Blueprint/DDR version fields added to freeze metadata (new wrapper fields, not silent hash pollution) |
| Production lifecycle | `production-dc-lifecycle.ts` (Call A/B coupled) | **REBUILD** writers; keep pure helpers |

### 2.2 Status and fields

`DecisionContext` (existing):

| Field | Type | Required | Notes |
|---|---|---|---|
| `context_id` | string | yes | Stable id |
| `version` | number | yes | Monotonic within `context_id` |
| `status` | `draft` \| `final` \| `superseded` | yes | |
| `definition` | `Definition` | yes | See §2.3 |
| `reality_facts` | `RealityFact[]` | yes (may be empty draft) | |
| `constraints` | `Constraint[]` | yes | |
| `hypotheses` | `Hypothesis[]` | yes | Never RealityFacts |
| `dirs` | `DIR[]` | yes | States from aggregation |
| `conflicts` | `Conflict[]` | yes | |
| `content_hash` | string \| null | null in draft; required in final | Business payload only |
| `created_at` / `updated_at` | ISO string | yes | |
| `information_boundaries` | string[]? | optional | Explicit unknowns for WARN |
| `delivery_mode` | `normal` \| `degraded` \| null | optional | After freeze |

### 2.3 Definition

| Field | Type | Notes |
|---|---|---|
| `concrete_event` | string \| null | |
| `stakes` | string \| null | |
| `desired_outcome` | string \| null | |
| `decision_question` | string \| null | |
| `goal_priorities` | string[] | |
| `unacceptable_outcomes` | string[] | |

**Invariant:** Model speculation must not be written as user-confirmed goals without user evidence / confirm event.

### 2.4 RealityFact — status × verification (product + code aligned)

| status | Allowed `verification_level` |
|---|---|
| `confirmed` | `user_asserted`, `independently_verified` |
| `unverified` | `user_estimate`, `user_asserted` |
| `unknown` | `none` |
| `declined` | `none` |
| `not_applicable` | `none` |

**Forbidden:** `inferred` as verification_level on RealityFacts.

**`user_confirmed`:**

- Derived only from an **explicit user-confirm event** + legal status (`deriveUserConfirmed`).
- `independently_verified` **must not** imply `user_confirmed` (even if other signals exist).
- `unknown` / `declined` / `not_applicable` → always `user_confirmed = false`.

**Tech finding (Phase 0):** production `confirmFact` today updates confirm flags but does **not** flip `status` to `confirmed`. Intake writers must define an explicit promote path (product: confirmed requires assert + confirm event) — **open implementation detail for Phase 3**, not a product rule change.

### 2.5 Constraint

Existing fields + product additions to plan in implementation:

| Field | Required | Notes |
|---|---|---|
| `constraint_id`, `statement`, `category`, `status`, `verification_level`, `source_stage`, `source_turn_id`, `rigidity`, `user_confirmed` | yes | Match `types.ts` |
| `related_dir_ids` | recommended (product) | **New optional field** on Constraint if missing in code — ADAPT |

`rigidity`: `hard` \| `soft`. Hard constraints must not be silently ignored by models.

**Tech finding:** collecting Constraint writer missing in production lifecycle — Intake must add writers (Phase 3).

### 2.6 Hypothesis

Existing `Hypothesis` + product `related_fact_ids` (recommended add).

**Invariant:** Hypotheses never written into `reality_facts`.

### 2.7 Conflict

| Field | Notes |
|---|---|
| `state` | `open` \| `clarified` \| `unresolved_in_final` |
| `user_confirmation` | Required true to clarify |
| `affects_preferred_path` | undefined → conservative true (blocks) |

**Tech finding:** no production writer into `dc.conflicts` today — library only.

### 2.8 DIR (inside DC)

Existing `DIR` type. Product aliases:

| Product term | Code field |
|---|---|
| related_agenda_ids | `agenda_item_ids` |
| lifecycle | `id_lifecycle` |
| serves_face / judgment | `serves_face`, `serves_judgment` |

`current_state`: `known` \| `unknown` \| `conflict` \| `n_a`.

**Invariant (hard):** Agenda `covered` **never** alone sets DIR `known` (`agendaCoveredImpliesDirKnown() === false` today — keep).

`may_affect_p5_ranking`: critical unknown/conflict blocking flag for sufficiency.

### 2.9 SourceStage adaptation

Existing includes `call_a` / `call_b`. Intake 2.0 **must not** use Call A/B as product stages. Contract for new writers:

| New semantic | Mapping |
|---|---|
| Intake opening / blueprint | Prefer `opening` or add `intake_init` in later phase (**OPEN**: product OK with extending enum without changing meaning of existing values) |
| Adaptive Q&A turns | `collecting` or new `intake_turn` |
| User supplement after freeze | `user_supplement` |

Do **not** invent Call A/B facts in Intake writers.

---

## 3. Decision Deliverable Requirements (DDR)

**New type family** (not present as first-class types today). Product fields:

| Field | Type | Required |
|---|---|---|
| `ddr_id` | string | yes |
| `deliverable` | string | yes |
| `report_page_id` | `DecisionPageId` (`01`–`08`) | yes |
| `report_section_id` | string (segment A–E or schema segment id) | yes |
| `required_dir_ids` | string[] | yes |
| `required_sources` | enum[] (e.g. `user_fact`, `constraint`, `hypothesis`, `bazi`, `ziwei`, `sci`) | yes |
| `priority` | `P0` \| `P1` \| `P2` | yes |
| `completion_criteria` | string | yes |
| `status` | `pending` \| `partial` \| `satisfied` \| `blocked` \| `n_a` | yes |

**Invariants:**

1. DDR ≠ DC. DDR is report obligation; DC is known information.
2. `report_page_id` must be in PageFeedMatrix face set; **do not invent pages**.
3. P2 DDR must not block sufficiency alone (product).
4. DDR status is computed from DIR states + sources — not from Agenda coverage %.

**Suggested example DDR families (product list → faces):**

| Deliverable family | Typical `report_page_id` |
|---|---|
| Structured dilemma / cause | `02` |
| Personal pattern ↔ decision | `02` / `04` (+ CFP/ZFP sources) |
| Reality constraints | `01` / `05` |
| Path comparison / ranking | `05` |
| Costs, risks, premises | `05` / `04` |
| Primary + backup recommendation | `01` / `05` |
| Low-cost validation path | `06` |
| P6 experiment | `06` |
| Continue/Adjust/Stop/Rerun | `08` |
| Chart appendix | `03` |

Exact DDR catalog is **Blueprint Engine output** (Phase 2), not frozen instance list here.

---

## 4. Investigation Blueprint

Container (product: Decision Blueprint):

| Field | Type | Notes |
|---|---|---|
| `blueprint_id` | string | |
| `blueprint_version` | number | Immutable history; no silent overwrite |
| `session_id` | string | |
| `context_id` | string | Links to DC |
| `directions` | `InvestigationDirection[]` | |
| `ddr` | `DDR[]` | |
| `dir_index` | `DIR[]` or ids referencing DC.dirs | Prefer **DC.dirs as SoT**; blueprint holds seed + scope metadata |
| `scope_locked` | boolean | After init |
| `change_log` | `BlueprintChangeRecord[]` | Required for scope changes |

### InvestigationDirection

| Field | Type | Notes |
|---|---|---|
| `direction_id` | string | |
| `name` | string | |
| `objective` | string | |
| `decision_relevance` | string | |
| `required_information` | string[] | |
| `optional_information` | string[] | |
| `priority` | `P0` \| `P1` \| `P2` | P2 must not block completion |
| `completion_criteria` | string | |
| `dependencies` | string[] | other direction_ids |
| `scope_boundary` | string | |
| `status` | `open` \| `in_progress` \| `satisfied` \| `unknown_bounded` \| `closed` | |
| `related_dir_ids` | string[] | |
| `max_followup_depth` | number | default soft 3 (product §4.4) |
| `followup_depth_used` | number | |

**Scope change proposal** (product §3.3) required fields before adding a new top-level direction:

`proposed_direction`, `originating_fact_id`, `related_decision_question`, `decision_impact`, `why_existing_directions_are_insufficient`, `priority`, `estimated_information_value`.

---

## 5. Adaptive Question Plan & Agenda

### AdaptiveQuestionPlan (planner output per turn)

| Field | Type | Notes |
|---|---|---|
| `plan_id` / `turn_index` | string / number | |
| `selected_direction_id` | string | Must be in Blueprint |
| `selected_dir_ids` | string[] | Must link DDR/DIR |
| `selected_ddr_ids` | string[] | |
| `question_text` | string | One primary question (product §4.3) |
| `why_ask` | string | |
| `expected_information_gain` | string | |
| `depth_level` | 1..N | Within direction soft cap |
| `reply_options` | string[]? | 0–3 chips; optional |
| `out_of_scope_rejected` | string[] | Planner self-check |

### AgendaItem (execution queue)

**ADAPT** from `lib/poju/investigation-agenda.ts` `AgendaItem`, but:

| Keep | Drop / do not use as SoT |
|---|---|
| `id`, `label`, `status`, `captured_answer`, `critical`, `collection_goal` | Treating `covered` as DIR known |
| Link fields → `direction_id`, `dir_ids`, `ddr_ids` (**new**) | Legacy `serves_path` |
| | Call B one-shot factory as Intake entry |

**Invariant:** Agenda completion ≠ sufficiency; ≠ DIR known.

---

## 6. Decision Understanding (derived view)

Read-only projection shared by **UI** and **Adaptive Question Engine**.

| Block | Source |
|---|---|
| Current understanding summary | DC.definition + confirmed/unverified facts |
| Understood items | DIR known / facts confirmed |
| Need to understand | DIR unknown (P0/P1), open conflicts |
| Progress % | Weighted DDR + P0/P1 DIR + sufficiency (product §7.4) — **code-owned weights** |
| Personal Pattern Insight | PersonalAnalysisProfile relevance slice |
| Gate / lockout badges | SufficiencyGate + LockoutState |

**Invariant:** Same structured snapshot fed to model planner and UI. No parallel “understanding JSON” SoT.

Progress must **not** use Agenda covered ratio as primary metric (legacy `AgendaProgressPanel` does — **RETIRE** that formula).

---

## 7. Personal Analysis Profile & Pattern Insight

### PersonalAnalysisProfile (new adapter interface)

| Branch | Code SoT to map |
|---|---|
| BaZi | `ProfileStructured` (`build-profile-structured.ts`) + ChartFactPack |
| ZiWei | `ZiweiFactPack` (`fact-pack.ts`) + display projection |
| Metadata | calc module, version, asOf, clock, data_availability |

**Invariants:**

1. Local calc ≠ RealityFact.
2. BaZi and ZiWei remain separately traceable (not mashed into one prose blob).
3. Pattern Insight disclosure may prompt user validation → user answers become Facts; calc remains calc.

### PersonalPatternInsight

| Field | Type |
|---|---|
| `insight_id` | string |
| `statement_user_facing` | string (glossary-safe vernacular) |
| `bazi_anchors` | structured refs |
| `ziwei_anchors` | structured refs |
| `related_dir_ids` / `related_ddr_ids` | string[] |
| `requires_user_validation` | boolean |
| `shown_at_turn` | number \| null |

**Tech:** no shipped UI today; chat phases do not inject full ZFP (Call A/B closed-set only). Contract still requires both systems as inputs.

### Terminology (hard)

Existing POJU glossary / soft-label pipeline is **mandatory reuse**:

- `lib/glossary/**` (`termOf`, namespaces including `ziwei`)
- `lib/llm/sanitize/term-marking.ts` (`autoMarkBareTerms`, `prepareTextForGlossaryRender`)
- UI: `RichReadingText` / `GlossaryText`

**Forbidden:** redesign or replace the POJU term conversion system in Intake 2.0.

---

## 8. Sufficiency Gate

Product verdicts: `PASS` \| `WARN` \| `FAIL`.

| Existing code | Mapping |
|---|---|
| `evaluateDecisionSufficiency` → `sufficient` | ≈ PASS |
| `sufficient_with_boundaries` | ≈ WARN |
| `continue_collecting` / hard block | ≈ FAIL |

**Intake contract extends checks** (product §9.1) beyond DIR-only:

1. Definition clarity  
2. P0 DIR satisfied  
3. P1 enough for option compare  
4. Critical constraints known  
5. Blocking conflicts resolved or bounded  
6. **DDR** obligations satisfied for required faces  
7. Important unknowns disclosed  
8. Hash/version integrity  

**Hard rules:**

- User hard-push / stall / MAX turns **must not** alone force PASS (aligns with existing freeze guards).
- Critical unknown that may change path ranking → FAIL (or conditional WARN only if product marks `may_affect_p5_ranking === false` and boundaries recorded).

---

## 9. Session Lifecycle (separate from Lockout)

Suggested Intake session phases (product workflow; **not** legacy AgentPhase names as SoT):

| Phase | Meaning |
|---|---|
| `intake_init` | First message / seed definition |
| `blueprint_ready` | InvestigationBlueprint frozen for scope |
| `investigating` | Adaptive Q&A loop |
| `understanding_review` | Final understanding summary shown |
| `awaiting_user_confirm` | User confirm / revise summary |
| `frozen` | DC final; ready for report |
| `reporting` | Report generation (read-only DC) |
| `closed` | Session ended normally |
| `expired` | 24h retention elapsed (not a lockout strike) |

Legacy `opening` / `collecting_context` / Call A/B are **out of Intake SoT** (adapter may bridge during migration).

---

## 10. Invalid Input / Lockout (separate state machine)

| Field | Type | Rule |
|---|---|---|
| `invalid_streak` | number | Reset to 0 on valid answer |
| `lockout_count` | number | +1 per lockout event |
| `lockout_until` | ISO \| null | Cool-down 10 minutes |
| `session_retain_until` | ISO | 24h retention |
| `terminated` | boolean | After 3rd lockout event |
| `last_invalid_at` | ISO \| null | |

**Invalid input** (product): off-topic to current ask, garbage, repeated unrelated — **not** short answers, unknown, declined.

**On lockout:** no model call, no Agenda update, no DC formal mutate, no PASS spend, no client-only bypass. Server idempotent counters.

**Normal unknown/declined:** write Fact `unknown`/`declined`; may deepen once then bound — **not** invalid streak.

---

## 11. Persistence Contract

| Data | Persist? | Notes |
|---|---|---|
| DC draft/final + versions + idempotency keys | yes | Reuse C1 pattern (`persist.ts`, `commitDecisionContextChange`) |
| Blueprint versions + change_log | yes | New |
| DDR/DIR seeds (if not only inside DC) | yes | Prefer DIR inside DC |
| Agenda / AdaptiveQuestionPlan history | yes (execution audit) | Not fact SoT |
| DecisionUnderstanding snapshot | optional cache | Must rebuild from DC |
| Lockout counters | **server durable** | Required |
| PersonalAnalysisProfile version refs | yes | Not full recompute dump every turn |
| UI-only progress animation | no | |

**Consistency rules:**

1. DC is authority over `agent_v2` buffers (`restoreDecisionContextAuthority` spirit).  
2. Concurrent writes: idempotency keys + transactional commit; lockout updates atomic.  
3. Freeze: append version snapshot; never overwrite final.  
4. Report binds `DecisionContextBinding` (`context_id`, `context_version`, `content_hash`).

---

## 12. Question budget (config contract)

Product initial params (tunable; not sacred constants):

| Complexity | Effective answer turns |
|---|---:|
| Simple | 5–7 |
| Medium | 8–10 |
| High | 10–12 |
| Soft cap | 12 |
| Hard cap | 15 |

Per-direction follow-up soft depth: **3** (extend only via rule-layer approval).

Only **valid** answers consume budget. Invalid / infra errors do not.

Hard cap reached → evaluate conditional report / disclose unknowns — **not** fabricate questions.

---

## 13. Suggested code directory (review only; do not create in Phase 1)

| Option | Verdict |
|---|---|
| **`lib/decision-intake/`** | **Recommended** — independent lifecycle; imports `lib/poju/decision-context/*` as library |
| `lib/poju/decision-intake/` | Rejected as primary — too easy to re-couple into `agent.ts` / Call A/B |

Keep glossary, ziwei, calculations, page-feed where they are.

---

## 14. Technical risks & OPEN items

| ID | Risk / OPEN | Severity |
|---|---|---|
| T1 | Legacy dual authority `agent_v2` vs DC | High |
| T2 | Call A/B persist helpers unused; Intake must not inherit | High |
| T3 | No production Conflict/Constraint collecting writers | High |
| T4 | Fact confirm ≠ status confirmed | Medium |
| T5 | Product plan text still calls v6 “Shadow”; Phase 0 shows v6 is production default | Doc drift |
| T6 | Ziwei full pack not in production delivery `task-context` | Medium |
| T7 | Whether to extend `SourceStage` enum vs reuse `collecting` | OPEN (product) |
| T8 | Exact DDR catalog instances | Deferred to Phase 2 Blueprint |
| T9 | Weight table for Understanding progress % | OPEN (product+eng constants) |
| T10 | PASS policy legal copy vs engineering enforcement surface | OPEN (product/legal) |

**Declaration:** This Phase 1 document does not modify runtime code.
