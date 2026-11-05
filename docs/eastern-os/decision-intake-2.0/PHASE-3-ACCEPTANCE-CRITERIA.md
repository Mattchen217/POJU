# Decision Intake 2.0 · Phase 3 Design Acceptance Criteria

| Field | Value |
|---|---|
| **Stage** | 3.1 Design package quality (not runtime) |
| **Baseline** | `main` @ `ee8c96e8` |
| **Pass rule** | All **AC3-*** / **MX-*** PASS or product-WAIVED |

---

## AC3-1 Package & architecture

| ID | Criterion | Pass if |
|---|---|---|
| AC3-1.1 | Six Phase 3 docs present | Files exist |
| AC3-1.2 | Engine modules + write authority | Architecture §2–§4 |
| AC3-1.3 | Understanding derived | US §0 |
| AC3-1.4 | Answer classes | Answer Interpretation §2 |
| AC3-1.5 | CandidateQuestion + fact_role_codes + candidate_id | Plan §1 / §2.2–§2.3 |
| AC3-1.6 | Model cannot declare Gate PASS | MC §2 |
| AC3-1.7 | Docs-only | `git diff` |
| AC3-1.8 | Phase 1 C1–C5 + Phase 2 intact | Cross refs |
| AC3-1.9 | Soft/hard + review_cycle budget model | Arch §3.4; Plan §5.1 |
| AC3-1.10 | Blueprint seed vs DC.dirs SoT | Plan §6 |
| AC3-1.11 | Kind-aware validation (R2-02 retained) | Plan §4 |
| AC3-1.12 | ShowReceipt + delivery_generation | MC §5.3–§5.5 |
| AC3-1.13 | ExplicitNaEvidence on DC + content_hash | US §2.7; MC §6.1 |
| AC3-1.14 | Deterministic sort / gate_class from DDR | Plan §2.1 / §2.4 |
| AC3-1.15 | DIR vs DDR state types never mixed | US §2.7 A0 |

---

## AC3-2 Red-line self-check

| Ban | Result |
|---|---|
| Call A/B Intake entry | **PASS** |
| Stage 1–4 as Intake | **PASS** |
| Fixed questionnaire as product logic | **PASS** |
| Agenda as DIR SoT | **PASS** |
| Second fact DB | **PASS** |
| Model writes unverified confirmed facts | **PASS** |
| Chart as confirmed reality | **PASS** |
| Bypass P0/P1/P2 Gate | **PASS** |
| Progress via ask count without ShowReceipt | **PASS** (forbidden) |
| Soft sticky forever after USER_REVISE | **PASS** (forbidden; review_cycle) |
| Hard reset via USER_REVISE | **PASS** (forbidden) |
| DIR current_state ← DDR statuses | **PASS** (forbidden) |
| N/A store outside DC affecting Gate | **PASS** (forbidden) |
| New Session states | **PASS** (none) |
| Runtime / PageFeedMatrix change | **PASS** (docs only) |

---

## AC3-3 Design matrix (MX-01 … MX-82)

| ID | Given | When | Then | Spec |
|---|---|---|---|---|
| MX-01 | First simple decision | Init + plan | Seed DIRs; one P0 ask | Plan §1–2 |
| MX-02 | Complex multi-constraint | Plan | P0 first; one ask | Plan §2 |
| MX-03 | Goal change | goal_change | BP bump OK; DIR states kept | Plan §6 |
| MX-04 | Supplement fact | supplement | E1 path; reaggregate | P1 C1 |
| MX-05 | Correct confirmed | correction | Supersede; no silent overwrite | P1 C1 |
| MX-06 | Contradiction | contradiction | Conflict open | P1 |
| MX-07 | Unknown | unknown | Not n_a / known | US §2.7 |
| MX-08 | Declined | declined | Not auto n_a | US §2.7 |
| MX-09 | Off-topic streak | off_topic | Lockout path | P1 |
| MX-10 | DIR known | Plan | No re-ask same roles | Plan §2 |
| MX-11 | Multi DDR gaps | Plan | P0>P1>P2 | Plan §2.1 |
| MX-12 | P0+P1/P2 | Plan | Ask P0 first | Plan §2.1/§2.4 |
| MX-13 | P1 ranking-critical | Gate | Cannot soft-pass Freeze if open | P1 §3.3 |
| MX-14 | P1 WARN-eligible | Gate | WARN path preserved | P1 §3.3 |
| MX-15 | `session_asked_count ≥ hard`; P0 open | Hard boundary | FAIL; forbid E2; **stop ordinary asks**; no new phase; UX OPEN | Arch §3.4; Plan §5.2 |
| MX-16 | Model repeats ask | Validate | Reject; replan | Plan §4 |
| MX-17 | Out of Blueprint | Validate | Reject | Plan §4.2 |
| MX-18 | Invalid schema | Contract | No Answer Commit | MC §4 |
| MX-19 | Dup client_turn_id A | Persist | Replay AnswerCommitResult | MC §5.1 |
| MX-20 | Persist fail B | Persist | No show; A kept | MC §5.2 |
| MX-21 | Blueprint bump | Lifecycle | Seed merge; live DIR kept; gen rules | Plan §6; MC §5.6 |
| MX-22 | Reality ≠ insight | insight_mismatch | No chart-as-fact | US §2.4 |
| MX-23 | CFP miss / calc fail | Source | DDR-02 Rule A → pending → P0 FAIL | P2 Rule A |
| MX-24 | Gate PASS | Soft→Review | Enter review; E2 after Freeze PASS | Arch §3 |
| MX-25 | Gate WARN | Soft→Review | Disclosures; not fake PASS | P1 §4.2 |
| MX-26 | FAIL + gaps + cycle soft not hit | Soft | Stay investigating; Plan | Arch §3.2 |
| MX-27 | FAIL + explicit review | USER_REQUEST_REVIEW | Honest FAIL; no E2 | P1 §1.3 |
| MX-28 | Cycle soft reached; P0 open | Soft budget | → `understanding_review`; keep FAIL; show P0; **no** keep-asking in cycle | Arch §3.4; Plan §5.2 |
| MX-29 | source_only askable | Plan+Validate | Empty dir_ids; §4.3 accepts | Plan §4.3 |
| MX-30 | n_a without DC evidence | Gate | Invalid; exclude satisfaction; DIR not n_a | US §2.7 |
| MX-31 | A done; LLM timeout B | Persist | Count unchanged until ShowReceipt | MC §5.3 |
| MX-32 | Two P1 equal gain/depth/rep | Sort | Full key §2.1 through candidate_id | Plan §2.1 |
| MX-33 | Hard; only P2 | Review | P2 alone must not block | Plan §5.2 |
| MX-34 | Soft review then USER_REVISE | Lifecycle | New `review_cycle`; `cycle_base_asked=session_asked`; may ask while remaining_hard>0; hard not reset | Arch §3.4; Plan §5.1 |
| MX-35 | source_only not askable | Plan | No NL; NeedItem kept | Plan §4.3 |
| MX-36 | Require dir_ids on source_only | Validate | Forbidden; §4.3 accepts empty | Plan §4.3 |
| MX-37 | Dup Commit B | Persist | Same `ask_payload_id`; no count | MC §5.3–§5.4 |
| MX-38 | Dual LLM race B | CAS | One payload; loser discard | MC §5.4 |
| MX-39 | B ok; UI crash before show | Recovery | Load `persisted_unshown`; same id; ShowReceipt once | MC §5.3 / §5.7 |
| MX-40 | DC drift before B | Drift | Gen bump; stale old; replan | MC §5.5 |
| MX-41 | BP bump A→B | Blueprint | Seed only; discard old NL | MC §5.6 |
| MX-42 | Evidence wrong DIR / na_conditions | N/A | Reject; DIR not n_a; reaggregate | US §2.7C |
| MX-43 | model_inferred N/A | N/A | Reject | US §2.7B |
| MX-44 | Revoke legal N/A | Rebuild | Clear DIR n_a; version+hash change | US §2.7D; MC §6.1 |
| MX-45 | Cache cleared; DC has N/A | Rebuild | Restore from DC.explicit_na_evidence | US §2.7D |
| MX-46 | dir_based vs source_only equal P1 | Sort | kind_rank then dir/source keys | Plan §2.1 |
| MX-47 | Same ddr set, input order differs | Sort | Same normalized_ddr_ids / order | Plan §2.1 |
| MX-48 | P0 low gain vs P1 high; P2 vs P1 | Sort | P0>P1>P2 hard | Plan §2.4 |
| MX-49 | Soft→Review→REVISE→use remaining hard→soft again | Budget cycle | Second cycle soft_cap=remaining; second review; session_asked≤hard | Plan §5.1; Arch §3.4 |
| MX-50 | Many USER_REVISE | Hard ceiling | Cannot exceed hard; cannot reset session_asked_count | Plan §5.1 |
| MX-51 | Duplicate ShowReceipt | Count | Exactly-once +1 | MC §5.3 |
| MX-52 | Persist ok; show fails; resume | Count | First ShowReceipt +1; restore no double | MC §5.3 / §5.7 |
| MX-53 | Old generation invalidated | Gen lifecycle | New generation plans/shows; old slot not blocking | MC §5.5 |
| MX-54 | Late result of old generation | Gen | Reject; cannot overwrite new gen AskPayload | MC §5.5 / §5.7 |
| MX-55 | Add ExplicitNaEvidence | Hash | DC.version++; content_hash changes | MC §6.1 |
| MX-56 | E2 after N/A change | Freeze | FreezeRecord.dc_content_hash = new hash; prior freezes immutable | P1 §10.3; MC §6.1 |
| MX-57 | DDR-02 CFP missing + DIR n_a attempt | Rule A | DDR pending; P0 FAIL; N/A cannot waive | P2 Rule A; US §2.7E |
| MX-58 | Code tries DIR.current_state=pending | Types | Forbidden; only known\|unknown\|conflict\|n_a | US §2.7 A0 |
| MX-59 | Same inputs twice | candidate_id | Identical cq_ hash | Plan §2.3 |
| MX-60 | Distinct role sets | candidate_id | Different ids; no false collision | Plan §2.3 |
| MX-61 | Model priority hint says P2 on P0 DDR | gate_class | Code still P0; hint ignored | Plan §2.4 |
| MX-62 | Same shown-ask set | repetition_count | Identical counts; stale/discarded/invalidated excluded (no superseded enum) | Plan §2.1 |
| MX-63 | ExplicitNaEvidence missing target / both dir+ddr | N/A validate | REJECT; never persist; no Gate effect | US §2.7A/C |
| MX-64 | user_explicit_na without source_ref | N/A validate | REJECT | US §2.7A |
| MX-65 | system_na_marker with only na_condition_code, no system_basis | N/A validate | REJECT | US §2.7A |
| MX-66 | Same unresolved roles listed twice / multi-DIR union | gain | Deduped unresolved_count; attributable_fail boolean once | Plan §2.1.2–§2.1.4 |
| MX-67 | candidate_id via canonicalStringify | Identity | Must use `normalize.ts` canonicalStringify; same obj ⇒ same id | Plan §2.3 |
| MX-68 | Concurrent ShowReceipt UNIQUE conflict | Count | Loser re-reads; returns idempotent success; no double count; no client error | MC §5.3 |
| MX-69 | DDR-03; CFP=`source_absent_not_supplied` + VALID ExplicitNaEvidence target=ddr | DDR N/A | DDR-03 may be `n_a` | US §2.7 A1; P2 §3.3.1 |
| MX-70 | DDR-03; CFP=`source_calc_failed`; N/A evidence attempted | DDR N/A | **REJECT** N/A; DDR stays `pending` | US §2.7 A1 |
| MX-71 | DDR-02; CFP not source_ok; all DIRs n_a | Rule A | DDR-02 `pending`; Gate P0 FAIL; N/A cannot waive | US §2.7 A1/E; P2 Rule A |
| MX-72 | DDR-02 evidence with `empty_dir_source_absence` | system_basis | **REJECT** | US §2.7 A1/A2 |
| MX-73 | Non-DDR-03 empty-DIR source-absence N/A | Allowlist | **REJECT** | US §2.7 A1 |
| MX-74 | DIR system_na_marker uses `empty_dir_source_absence` | system_basis | **REJECT** (basis only for DDR-03 target=ddr) | US §2.7 A2 |
| MX-75 | source_ref Fact related_dir_ids misses target DIR | user_explicit_na | **REJECT** | US §2.7 A3 |
| MX-76 | source_ref points to revoked/superseded Fact | user_explicit_na | **REJECT** | US §2.7 A3 |
| MX-77 | source_ref is model-inferred / silence / unknown-as-N/A | user_explicit_na | **REJECT** | US §2.7 A3 |
| MX-78 | Constraint.rigidity=hard; related_dir_ids has D; status=confirmed; role hard_constraint | gain resolve | Role resolved | Plan §2.1.2 |
| MX-79 | Constraint.rigidity=soft; same association; role soft_constraint | gain resolve | Role resolved | Plan §2.1.2 |
| MX-80 | Constraint related_dir_ids misses candidate DIR (or absent) | gain resolve | **Not** resolved | Plan §2.1.2 |
| MX-81 | Same fact_role_code listed twice on candidate | unresolved_count | Count once | Plan §2.1.2 |
| MX-82 | Fact related only to D1; role namespaced to D2 | gain resolve | Must **not** resolve D2 role | Plan §2.1.2 |

---

## AC3-4 Detailed case cards (R3–R5)

### MX-15 — Hard + P0

| | |
|---|---|
| **Given** | `session_asked_count ≥ hard_budget_limit`; P0 open |
| **Expected Then** | FAIL; no E2; no ordinary asks; Phase-1 states only; UX OPEN |
| **Spec** | Arch §3.4; Plan §5.2 |
| **Doc check** | **PASS** |

### MX-28 — Soft cycle + P0

| | |
|---|---|
| **Given** | `soft_budget_reached` for current cycle; P0 open |
| **Expected Then** | → understanding_review; FAIL honest; no more asks **this cycle** |
| **Spec** | Arch §3.2 6b / §3.4; Plan §5.2 |
| **Doc check** | **PASS** |

### MX-34 / MX-49 / MX-50 — REVISE + cycles

| | |
|---|---|
| **Given** | Soft review; USER_REVISE; remaining hard > 0 (MX-49 continues until cycle soft again; MX-50 many revises) |
| **Expected Then** | New review_cycle; soft window resets via cycle_base; hard cumulative; cannot bypass 15 |
| **Spec** | Plan §5.1; Arch §3.4 |
| **Doc check** | **PASS** |

### MX-37–39 / MX-51–54 — Delivery & count

| | |
|---|---|
| **Given** | Dup B / CAS / crash / ShowReceipt / gen bump / late old gen |
| **Expected Then** | Stable ask_payload_id; count only on first ShowReceipt; old gen rejected; new gen free |
| **Spec** | MC §5.3–§5.5 / §5.7 |
| **Doc check** | **PASS** |

### MX-30 / MX-42–45 / MX-55–58 — N/A + types + hash

| | |
|---|---|
| **Given** | Missing/wrong/model/revoked evidence; hash; Rule A; DIR=pending attempt |
| **Expected Then** | Order validate→DIR aggregate→DDR→Gate; DC field+hash; Rule A; type ban |
| **Spec** | US §2.7; MC §6.1 |
| **Doc check** | **PASS** |

### MX-32 / MX-46–48 / MX-59–62 — Identity & sort

| | |
|---|---|
| **Given** | Equal scores / cross-kind / ddr order / id regen / hint / rep set |
| **Expected Then** | Full sort key; deterministic id; DDR gate_class; shown-only rep |
| **Spec** | Plan §2.1–§2.4 |
| **Doc check** | Spec present — **pending independent review** |

### MX-69–77 — DDR allowlist / system_basis / source_ref (R5)

| | |
|---|---|
| **Given** | See AC3-3 rows MX-69…77 |
| **When** | ExplicitNaEvidence validate (§2.7 A1–A3) |
| **Then** | Only DDR-03 + source_absent_not_supplied N/A; Rule A intact; bad basis/ref REJECT |
| **Spec** | US §2.7 A1–A3; P2 Rule A / §3.3.1 |
| **Doc check** | Spec present — **pending independent review** |

### MX-78–82 — Constraint/Fact role mapping (R5-04)

| | |
|---|---|
| **Given** | See AC3-3 rows MX-78…82 |
| **When** | unresolved_count / resolved(role) (§2.1.2) |
| **Then** | rigidity map; association required; no cross-DIR bleed; dedupe roles |
| **Spec** | Plan §2.1.2 |
| **Doc check** | Spec present — **pending independent review** |

---

## AC3-5 Cross-doc consistency (with section cites)

| Topic | Docs & sections | Consistent? |
|---|---|---|
| Soft/Hard + review_cycle | Arch §3.4 ↔ Plan §5.1–§5.2 ↔ AC MX-15/28/34/49/50 | Aligned — **pending independent review** |
| USER_REVISE | Arch §3.3/§3.4 ↔ Plan §5.1 ↔ AC MX-34/49 | Aligned — **pending independent review** |
| ShowReceipt / count | MC §5.3 ↔ Arch §6 ↔ Plan §5.1 ↔ AC MX-51/52/68 | Aligned — **pending independent review** |
| ExplicitNaEvidence + DDR allowlist | US §2.7 A1–A3 ↔ MC §3 / §6.1 ↔ AC MX-69–77 | Aligned — **pending independent review** |
| Constraint/Fact → fact_role_code | Plan §2.1.2 ↔ AC MX-78–82 | Aligned — **pending independent review** |
| gain / candidate_id / gate_class | Plan §2.1–§2.4 ↔ AC MX-32/46–48/59–67 | Aligned — **pending independent review** |
| R2-02 source_only | Plan §4 ↔ MX-29/35/36 | Unchanged intent — **pending independent review** |
| Phase 2 Rule A | US §2.7 A1/E ↔ P2 DDR-02 ↔ MX-71/72 | No semantic reopen claimed — **pending independent review** |

OPEN product UX items below are **not** marked PASS.

---

## AC3-6 Author consistency self-check

| # | Check | Author note | Independent review |
|---|---|---|---|
| 1 | Understanding derived | Claimed | **Pending** |
| 2 | R2-02 kind validation retained | Claimed | **Pending** |
| 3 | MX-01…82 G/W/T present; numbering continuous | Claimed | **Pending** |
| 4 | R5-01 DDR-03-only empty-DIR N/A; Rule A | Claimed | **Pending** |
| 5 | R5-02 system_basis scopes | Claimed | **Pending** |
| 6 | R5-03 source_ref semantic checks | Claimed | **Pending** |
| 7 | R5-04 Constraint/Fact role mapping; no new Phase 1 fields | Claimed | **Pending** |
| 8 | Budget / ShowReceipt / Gate not redesigned | Claimed | **Pending** |
| 9 | Runtime / Schema / UI / Prompt / PageFeedMatrix / Phase 1–2 docs | **No changes** | **Pending** |

---

## Frozen rules check (semantic · R5)

| Rule | Semantic change in R5? |
|---|---|
| C1 FactStatus×VL / E1 | **No** — source_ref uses existing Fact/Constraint only |
| C2 no Stage labels | **No** |
| C3 DC sole fact SoT | **No** |
| C4 DDR compose / Gate | **No** — restates Phase 2 allowlist/Rule A in Phase 3 validate |
| C5 FreezeRecord hash bind | **No** |
| DC.dirs live SoT | **No** |
| Blueprint seed-only | **No** |
| P0/P1/P2 + WARN | **No** |
| Required Source order + Rule A | **No** — DDR-02 still non-waivable |
| DDR-03-only empty-DIR N/A | **No** — Phase 2 v1.1 restated |
| E1 ≠ E2 | **No** |
| No new Session phase | **No** |
| Agenda ≠ known | **No** |
| unknown/declined ↛ n_a | **No** |
| No new Phase 1 Constraint fields | **No** — map via rigidity/category/status + recommended related_dir_ids |

---

## OPEN (must not fake PASS)

1. Hard-exhausted UX copy / screen (investigating vs review CTA) — Gate FAIL / no E2 / no asks **closed**.  
2. After generation bump: auto-replan once vs force client refresh.  
3. non-askable source_only UX step count.  
4. Phase 3.2: wire `DC.explicit_na_evidence` + hash extractor; optional Constraint.`related_dir_ids` per Phase 1 recommendation (absent ⇒ role unresolved).  
5. ShowReceipt client ack transport (websocket vs HTTP) — semantics closed.

---

## Phase 3.1 exit

Product independent re-review required. **Do not** merge, create PR unless asked, start Stage 3.2, or self-declare PASS.

---

## Declaration

Stage 3.1-R5 design docs only. **No** runtime / schema / UI / prompt / PageFeedMatrix / Phase 1–2 frozen doc changes. Budget / ShowReceipt core / source_only / Gate not redesigned. Author self-check ≠ independent PASS.
