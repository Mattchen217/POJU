# Decision Intake 2.0 · Phase 1 Traceability Contract

| Field | Value |
|---|---|
| **Companion** | `PHASE-1-DATA-CONTRACT.md`, `PHASE-1-STATE-MACHINES.md` |
| **Report SoT** | `lib/llm/pro/delivery/page-feed-matrix.ts` + `.cursor/docs/decision-report/PageFeedMatrix-2026-10-27.md` |
| **Rule** | Do **not** change eight-page structure; map DDR/DIR onto existing faces |

---

## 1. End-to-end trace chain (normative)

```text
Report Deliverable (face 01–08 segment)
        ▲
        │ required by
        │
       DDR
        ▲
        │ satisfied via
        │
       DIR  ◄──── aggregated from RealityFacts / Constraints / Conflicts
        ▲
        │ investigated by
        │
InvestigationDirection ⊂ Blueprint
        ▲
        │ queued as
        │
AgendaItem / AdaptiveQuestionPlan
        ▲
        │ answered by
        │
User Answer / Evidence (+ optional PersonalAnalysis anchors)
        │
        ▼
DecisionContext (write SoT)
        │
        ▼ freeze
DecisionContextBinding (context_id, version, hash)
        │
        ▼
Final Report Judgment (read-only feeds + DC slice)
```

**Every critical judgment in the report must be able to answer:**

1. Which **DDR** required this deliverable?  
2. Which **DIR**(s) supplied the information need?  
3. Which **Fact / Constraint / Hypothesis / Conflict / calc anchor** supports it?  
4. Which **user turn** or **local calc metadata** is the provenance?  
5. If unknown — is it disclosed as boundary / WARN path?

If any link is missing, the judgment is **non-compliant** for Intake 2.0 Stage-4-style delivery.

---

## 2. Layer duties in the chain

| Layer | Writes? | Trace role |
|---|---|---|
| DDR | Blueprint init / versioned updates | Report obligation id |
| DIR | Seeded then `reaggregateDirs` | Information need + state |
| Agenda | Execution only | Proof a question was asked — **not** proof need met |
| User answer | → Facts/Constraints via validated writers | Evidence |
| Hypothesis | Analytical only | Must cite supporting/counter evidence ids |
| PersonalAnalysisProfile | Read-only calc | CFP/ZFP anchors; never masquerade as user reality |
| DecisionUnderstanding | Derived | Debug/UI; not provenance SoT |
| Frozen DC + binding | Immutable | Report attachment |

---

## 3. Eight-page structure (locked)

From `page-feed-matrix.ts`:

| pageId | Role | Main narrative |
|---|---|---|
| `01` | Direct answer / brief | yes |
| `02` | Foundation / attribution | yes |
| `03` | Appendix (pack tail) | appendix only |
| `04` | Eastern strategy / bottleneck | yes |
| `05` | Path ranking / risk-relevant compare | yes |
| `06` | Execution / validation signals | yes |
| `07` | Topic-conditional field/relationship | conditional |
| `08` | Self-check / continue-adjust-stop | yes |

Order: `MAIN_NARRATIVE_PAGE_ORDER = 01,02,04,05,06,07,08`; appendix `03`.

**Forbidden in Phase 1+ mapping:** invent page `09`, reorder faces, or treat legacy nine-module ids as face SoT without `page-id-remap`.

---

## 4. DDR → PageFeedMatrix mapping

DDR.`report_page_id` **must** be a `DecisionPageId`.  
DDR.`report_section_id` should align to segment allowlists A–E / schema segment ids.

### 4.1 Feed families per face (existing unions)

| Face | User | CFP (BaZi) | ZFP (ZiWei) | Sci |
|---|---|---|---|---|
| 01 | Q, expect | pathTags, yongJi, dayunNow, conflictAnchors | topicPalace, daxian | no |
| 02 | Q, expect, detail | dayMaster, yongJi, shishenHit, dayunNow | topicPalace, sihua, daxian, patternHits | yes |
| 04 | detail | yongJi, shishenHit, dayunNow | sihua, daxian, patternHits | fold |
| 05 | expect, detail | pathTags, yongJi, conflictAnchors, dayunNow | topicPalace, sihua, daxian | optional |
| 06 | Q, expect, detail | dayunNow | daxian | yes |
| 07 | detail | pathTags | topicPalace, daxian, otherChart | fold |
| 08 | Q, expect | shishenHit, dayunNow | sihua | no |
| 03 | — | dayMaster, yongJi, shishenHit, dayunNow | mingShen, topicPalace, sihua, daxian, patternHits | no |

### 4.2 DDR family → face (product deliverables → locked faces)

| DDR family (product) | Primary face | Typical sources |
|---|---|---|
| Structured dilemma / causes | `02` | User.detail, Facts, DIR |
| Personal traits ↔ decision | `02` / `04` | CFP+ZFP + Insight (not Facts) |
| Reality conditions & constraints | `01` B / `05` | Constraints, Facts |
| Path comparison | `05` | Facts, Constraints, DIR, Hypotheses |
| Costs / risks / premises | `04` / `05` | Constraints, Conflicts |
| Primary + alternative recommendation | `01` / `05` | Definition, DIR known |
| Low-cost / staged validation | `06` | Facts, DIR |
| P6 verification experiment | `06` | DDR+DIR |
| Continue / Adjust / Stop / Rerun | `08` | Gate boundaries, open unknowns |
| Chart appendix | `03` | CFP+ZFP only |

Exact DDR instance catalog = Phase 2 Blueprint Engine output; this table freezes **mapping rules**.

### 4.3 DC page feed (existing)

`STAGE4_DC_FEED_PAGES = 01,02,04,05,06,08` (`dc-page-feed.ts`).  
DDR mapping must remain compatible: faces that receive DC slices should list DC among `required_sources` when judgments depend on formal facts.

---

## 5. What Q&A must collect vs local calc

| Need | Source |
|---|---|
| Concrete event, stakes, desired outcome | Q&A → Definition / Facts |
| Hard constraints (money, time, duties) | Q&A → Constraints |
| Options on table, irreversibility | Q&A → Facts / Constraints |
| Conflict resolution between stories | Q&A → Conflicts clarified |
| Day master, 用喜忌, 大运, ten gods | Local BaZi → CFP |
| Palace / sihua / daxian / patternHits | Local ZiWei → ZFP |
| Eastern strategy parameters | Calc + Q&A premises (P4 dual-core elsewhere) |

**Rule:** Report sections that claim user reality must cite Fact/Constraint ids; sections that claim chart structure must cite CFP/ZFP field codes + calc metadata.

---

## 6. Agenda’s place in the chain

```text
DDR ← DIR ← Facts
         ↑
      Agenda only proves "asked / answered attempt"
```

| Allowed | Forbidden |
|---|---|
| Trace “DIR_x investigated via AgendaItem_y at turn_z” | `Agenda covered` ⇒ `DIR known` |
| Show unanswered Agenda for UX | Sufficiency PASS because Agenda 100% |
| Capture answer text into Fact writers | Treat `captured_answer` as frozen DC without validation |

---

## 7. Judgment provenance record (implementation shape for later phases)

Recommended attachable record (not implemented in Phase 1):

```ts
type JudgmentProvenance = {
  judgment_key: string;          // e.g. face:01:segment:A
  ddr_ids: string[];
  dir_ids: string[];
  fact_ids: string[];
  constraint_ids: string[];
  hypothesis_ids: string[];
  conflict_ids: string[];
  cfp_fields: string[];          // FEED.CFP.*
  zfp_fields: string[];          // FEED.ZFP.*
  personal_insight_ids: string[];
  context_binding: {
    context_id: string;
    context_version: number;
    context_hash: string;
  };
};
```

Report generation must refuse or WARN when `ddr_ids` empty for a critical segment marked `facts: "required"` in PageFeedMatrix.

---

## 8. Traceability failure modes (must detect)

| Failure | Detection |
|---|---|
| Orphan report claim | Segment has no DDR id |
| DDR without DIR | `required_dir_ids` empty for non-N/A DDR |
| DIR known without contributing facts | Aggregator + audit |
| Hypothesis cited as Fact in User.detail | Type check on feed builder |
| Calc cited as user constraint | Source tag check |
| Binding mismatch | `resolveDecisionContextForReport` hash fail |
| Agenda-only sufficiency | Gate unit tests |

---

## 9. Tech review notes

1. Existing `formatDecisionContextSliceForPage` is the right **DC→prompt** adapter to reuse.  
2. Existing `sliceForPage` / `formatPageSliceFeed` is the right **CFP/ZFP/User→prompt** adapter.  
3. Production gap: `task-context` may omit `ziwei_fact_pack` — trace chain for ZFP is incomplete until hydrated (Phase 5/9).  
4. Do not invent a second matrix; extend DDR metadata to point at FEED codes.

---

## 10. Declaration

No runtime code modified. Page structure unchanged. Trace rules ready for Phase 2 Blueprint DDR emission and Phase 9 report integration.
