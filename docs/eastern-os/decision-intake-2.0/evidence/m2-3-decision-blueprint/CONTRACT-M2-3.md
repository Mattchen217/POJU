# M2.3 — Production Decision-Specific Blueprint (implementation evidence)

**Not a design proposal. Not self-PASS. Awaiting independent Max review.**

| Field | Value |
|---|---|
| Branch | `feat/m1-r-fresh-session-main-loop` |
| Parent SHA | `9036a944bfc4c84da0397548864ee5bab0582905` |
| HEAD SHA | 5e27e94883e436bfdec8a40d8dacd952f08f45d5 |
| Mode | Production implementation on same branch |
| Tip / promote | Vercel tip only — **no promote / no PR / no merge / no deploy** |

---

## 1. Files changed (production)

### Catalog SSOT (new)
- `lib/poju/decision-context/catalog/dir-definition-catalog.v1.ts`
- `lib/poju/decision-context/catalog/ddr-catalog.v1.ts`
- `lib/poju/decision-context/catalog/load-dir-definition-catalog.ts`
- `lib/poju/decision-context/catalog/load-ddr-catalog.ts`
- `lib/poju/decision-context/catalog/index.ts` (exports)

### Blueprint / bootstrap / AQE
- `lib/poju/decision-intake/topic-classify.ts` _(new)_
- `lib/poju/decision-intake/blueprint.ts` — Catalog-validated scope; real DDR↔DIR; P0/P1/P2 from DDR Catalog
- `lib/poju/decision-intake/fresh-session-bootstrap.ts` — Starter DIRs = controlled fallback only; seed decision_question fact
- `lib/poju/decision-intake/understanding-state.ts` — real Catalog `ddr_ids`; no `DDR_FOR_*`
- `lib/poju/decision-intake/adaptive-turn.ts` — Blueprint scope filter; reject placeholder DDRs
- `lib/poju/decision-intake/answer-interpretation.ts` — `resolveDdrIdsForDir`
- `lib/poju/decision-intake/types.ts` — Blueprint `ddr_ids` / `topic_tags` / `page_07_emit` / `scope_source`
- `lib/poju/decision-intake/index.ts` — exports
- `lib/poju/decision-context/production-intake-ask.ts` — Catalog DDR + gate from DDR priority; topic pack P0 when `page_07_emit`

### Tests / scripts
- `scripts/test-m2-3-decision-blueprint.ts` _(new)_ — M2.3-01…06 via real `createPOJUSession` + `handleUserMessage`
- `package.json` — `test:m2-3-decision-blueprint`
- `scripts/test-m1-production-adaptive-question-loop.ts` — M1-05 Blueprint-scope assert; no `DDR_FOR_*` fixtures
- `scripts/test-m2-1-readiness-confirm-freeze.ts` — longer Catalog answer loop; freeze assert `【已冻结】`

---

## 2. Production call-chain delta

**Unchanged entry (still sole main loop):**
```
createPOJUSession
→ handleUserMessage
→ runM1ProductionPreLlmTurn
→ bootstrapFreshSessionMainLoop
→ ensureDecisionBlueprint(recompute_scope=true)   // NEW: Catalog + Topic Applicability
→ runAdaptiveQuestionTurn(init_only)
→ authorized question delivery
```

**Follow-up unchanged order:**
```
handleUserMessage
→ Answer Interpretation
→ DC Update + C1 persist
→ Understanding rebuild (Catalog ddr_ids)
→ Adaptive Question Planning (Blueprint-scoped candidates)
→ authorized next question
```

**Delta vs pre-M2.3:**
1. Unconditional `attachStarterDirs(M1R_STARTER_DIRS)` removed as default full scope.
2. Formal scope = P0 DDR required DIRs ∪ primary topic pack DIR (Catalog-validated).
3. `M1R_STARTER_DIRS` only if Catalog scope empty / load failure (`scope_source: "starter_fallback"`).
4. NeedItem / CandidateQuestion use real Catalog DDR IDs via `DIR_TO_DDR_INDEX` — `DDR_FOR_${dir_id}` eliminated from production paths.
5. Gate class from consuming DDR priorities (not DIR-id string guessing / not solely `may_affect_p5_ranking`).

---

## 3. Two different decision questions — Blueprint / DDR / DIR run evidence

From `pnpm test:m2-3-decision-blueprint` (M2.3-01), real `createPOJUSession` + `handleUserMessage`:

### Q1 — Career / offer
> 我拿到一个新 offer，要不要离职跳槽去新公司？家里还有房贷。

| Field | Observed |
|---|---|
| `scope_source` | `catalog` |
| Topic | `career` → `DIR-JOB-OFFER` |
| `page_07_emit` | `true` |
| Includes | `DIR-JOB-OFFER`, core P0 DIRs (`DIR-OPT-ON-TABLE`, `DIR-OPT-CONSTRAINTS`, …) |
| Excludes | `DIR-REL-DYNAMICS` (not relationship) |
| DDR | includes `DDR-01-PRIMARY`, `DDR-07-TOPIC-DEPTH`, … |
| First Q | equals `adaptive_ask_plan.question_text` (not LLM freeform) |

### Q2 — Relationship
> 我和伴侣关系很紧张，要不要分手还是继续沟通结婚？

| Field | Observed |
|---|---|
| `scope_source` | `catalog` |
| Topic | `relationship` → `DIR-REL-DYNAMICS` |
| `page_07_emit` | `true` |
| Includes | `DIR-REL-DYNAMICS` + core P0 DIRs |
| Excludes | `DIR-JOB-OFFER` |
| DDR | includes `DDR-01-PRIMARY`, `DDR-07-TOPIC-DEPTH`, … |

**Not** the old fixed quartet-only starter injection as the full investigation scope (`dir_ids.length > 4`).

---

## 4. DC version / next-Q after answer (M2.3-04)

Career session after first adaptive Q, then answer:

> 目前可选方案是：留任、接受新 offer、或者先内部转岗再观望。

| Metric | Before → After |
|---|---|
| DC `version` | `1 → 2` |
| Understanding `context_version` | bound to latest DC version |
| Plan | recomputed (`plan_id` changed) |
| Facts | `reality_facts.length >= 1` |
| User-visible Q | equals new `adaptive_ask_plan.question_text` |

---

## 5. Test commands + real exit codes

| Command | Exit |
|---|---|
| `pnpm test:m2-3-decision-blueprint` | **0** (6/6) |
| `pnpm test:m1-r-fresh-session-main-loop` | **0** (8/8) |
| `pnpm test:m1-production-adaptive-question-loop` | **0** (16/16) |
| `pnpm test:m2-1-readiness-confirm-freeze` | **0** (19/19) |
| `pnpm test:m2-2-freeze-report-binding` | **0** (43/43) |
| `pnpm test:decision-context-phase2` | **0** (9 passed) |
| `pnpm exec next typegen` | **0** |
| `pnpm exec tsc --noEmit` | **0** |
| `pnpm build` | **0** |

---

## 6. Limitations / UNTESTED

1. Topic classifier is **deterministic heuristics** (`deterministic_m23_v1`), not a generative model classifier. Model may refine later; formal IDs still Catalog-gated.
2. Initial DC seed is **P0 DDR DIRs + primary topic pack** (not every P1/P2-only DIR). Full always-on DDR set remains on `Blueprint.ddr_ids` for report obligations; P1/P2-only DIRs (e.g. `DIR-OPT-IRREV`, `DIR-VALIDATION-CAPACITY`) are deferred from the first investigation wave.
3. Multi-tag questions seed a **single primary** topic pack (specificity order) to avoid Freeze blockers; all matched tags retained in `topic_tags` / notes.
4. Opening `decision_question` is seeded as **unverified user_asserted** RealityFact (not confirmed) so Confirm→Freeze can promote it — never auto-confirmed.
5. No live LLM topic classifier A/B. No PR / merge / production promote.
6. Vercel deployment tip status recorded after push (pending/ready) — not promoted.

---

## 7. Declaration

**Not self-PASS.** Implementation complete for Max independent review.
