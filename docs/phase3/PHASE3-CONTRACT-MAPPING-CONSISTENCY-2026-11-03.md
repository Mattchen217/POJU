# Phase 3 Contract ↔ Locked Mapping Consistency Check

Date: 2026-11-03 (America/Chicago)  
Mode: read-only verification  
Authorities compared:

1. Contract (authority #1): `/workspace/eos-w0-sot/PHASE3-FINAL-ENG-CONTRACT-2026-11-03.md` (~1548 lines, sections 0–23)
2. Locked Mapping (authority #2): `/workspace/eos-w0-sot/PHASE3-FINAL-IMPLEMENTATION-MAPPING-2026-11-03.md`
3. Optional evidence only (not semantic authority): `PHASE3-S0-SESSION-WRITE-INVENTORY.md`, `PHASE3-S0-GENERATION-JOB-INVENTORY.md`

Rule applied: Mapping does **not** replace Contract. Mapping brief notes are not full Contract definitions. Conflicts are reported, not interpreted away. No Contract/Mapping edits.

---

## 1. Verdict

**GAPS**

Technical engineering substance (dual Revision/CAS, Generation identity, Path A/B/C, C1, ControlPlane, Confirmation/Anchor, Normalize→Fingerprint+Mapper, Agenda↔DIR 1:1, P3-61…130 / core block set, S0–S5 order, merge/prod separate authorize, scope holds) is **aligned or Mapping-thinner**, not contradictory. No hard MUST/MUST NOT semantic reversal found that would require stopping to rewrite either document’s engineering rules.

Process/authorization **framing** in Mapping can be mistaken as S1 go-ahead; flagged as NOTEs below. S1 remains blocked until Max explicit authorization after this check (per Max boundary: S0 accepted / S1 blocked).

---

## 2. Findings table

| id | severity | Contract cite | Mapping cite | issue | recommended action for Max |
|----|----------|---------------|--------------|-------|----------------------------|
| F-01 | NOTE | §0; §21.4 (not code auth; sequential approvals) | Header “LOCKED / execution-ready”; §11; 附注 “可以作为执行依据” | Mapping lock/readiness language can be read as authorizing Engineer to start S1 without Contract approval + Max S1 authorize. Mapping §0 still ranks Contract #1 and §11 forbids self-merge/deploy, but status phrasing is stronger than Contract “尚未批准实施”. | Treat Mapping as locked *plan*, not S1 authorization. Require explicit Max “enter S1” after this consistency PASS. Do not tip Engineer from Mapping header alone. |
| F-02 | NOTE | §1.2 Hold list includes “Gate、Freeze、Stage 4…” | §0 不得: Collecting / Freeze / Stage4 / PageFeed / BookJudgment / Lab / 04 / SoT16 (no bare “Gate”) | Contract §1.2 “Gate” could be misread as forbidding Opening Gate work; both docs still require Opening Anchor/Gate in Contract §11–12 / Mapping S3. Hold lists otherwise match (Collecting, Freeze, Stage4, PageFeed, BookJudgment, Lab, 04, SoT16). | Confirm “Gate” in Contract §1.2 means Stage/Freeze gates, not Opening Gate. No Mapping change needed if Max affirms. |
| F-03 | GAP | §3.3–3.4; §7 (full dual Revision + 14-step Dexie CAS + retry rules) | §3.1–3.3 (aligned but shorter) | Mapping states dual Revision + unified CAS + mutation replay correctly; omits full Contract Dexie step list, Path A dual-check narrative, and DC-generation retry “no rebase / no re-job” detail. | Engineer must implement from Contract §7, not Mapping brief. Max: remind that Mapping steps are pointers. |
| F-04 | GAP | §4.1 field `generation_base_revision` | §4.1 / §4.2 / §4.3 / §4.4 use `base_revision`; Path A uses `generation_base_revision` | Same concept, inconsistent field name in Mapping. Risk of inventing a second field or wrong TypeScript property. | Max: declare `base_revision` ≡ `generation_base_revision` (Contract name is authoritative). No silent dual fields. |
| F-05 | GAP | §5.1 Registry: committed_session_revision, committed_dc_write_revision, committed_context_id/version/hash, result_marker, status completed-only rules | §4.2 Registry “至少包含” list thinner; omits committed_* context credentials | Mapping defers (“依 Final Contract”) but list can be mistaken as complete schema. | Require Registry schema from Contract §5.1 verbatim at S2. |
| F-06 | GAP | §5.2 Operation Binding fields (incl. result_marker, committed_dc_write_revision, committed_at) | §4.3 Binding “必须能证明…” prose, no full interface | Thinner; not contradictory. | Implement Binding from Contract §5.2. |
| F-07 | GAP | §5.3 collision order: 10 steps (session → fields → Registry → gen collision → client_task → fp/version → base → Binding → Path → CAS); collision before idempotent skip | §4.6: 6 condensed steps | Mapping softens/abbreviates order; still says collision before skip. Missing explicit fingerprint/base checks as separate steps in Mapping list. | S2 collision checker must follow Contract §5.3 order exactly. |
| F-08 | GAP | §6.3 pending_create CAS step 8: re-check row.dc_write_revision still equals task base; §6.2 full state machine | §4.4 Task create steps omit explicit base re-check at pending_create commit; says use Contract states | Omits hard pending_create DC-base revalidation. | S2 must include Contract §6.3 step 8. |
| F-09 | GAP | §8.1 Path A C1 set (10 items incl. decision_context_versions, Phase 2 cycle index sync) | §4.5 Path A: “DC、ControlPlane、Registry、Binding、TaskContext、幂等记录和 Revision” | Omits explicit versions list + Phase 2 index sync when involved. | C1 Path A contents = Contract §8.1; Mapping list is incomplete checklist. |
| F-10 | GAP | §8.2 Path C set; §9.1–9.5 full Path conditions/priority/EMPTY_GENERATION_RESULT | §4.5 Path A/B/C (aligned substance, thinner Path A preconditions; Path B lists extra fields vs Contract `GenerationReplayResult`) | Path B Mapping adds generation_id/fingerprint/result_marker beyond Contract replay interface; Path A omits some Contract preconditions (Binding conflict, TaskContext consistency). Not a semantic reversal. | Path semantics from Contract §9; Mapping Path B extras allowed only as additive diagnostics, must not change Contract outcome fields. |
| F-11 | GAP | §6.3 / §15.5 / §22: do not assume remote metadata lookup exists; if unsupported, document limitation + verifiable equivalent recovery | §2.4 MUST support client_task_id identity + `getXhighJobByClientTaskId`; Reload step 3 “根据 client_task_id 查询原 Job”; KV index “建议” | Mapping specifies the intended build (aligned with Contract recovery goals) but does not restate Contract’s “不得假设能力已存在 / 等价恢复” contingency. S0 Job inventory (evidence): **cannot** lookup by client_task_id today; documents equivalent recovery (Job record authority + rebuildable index). | Max: affirm §2.4 is *to-build in S2*, not baseline fact. S0 equivalent-recovery conclusion stands until S2 implements. Do not invent new recovery policy beyond Contract §22 + S0 notes. Keep C1/C5/J4 as Max-owned open items. |
| F-12 | NOTE | §11 ConfirmationEvent = fact \| constraint only; Opening Gate separate (§11.6, §12); forbid boolean-only | §5.2 Fact/Constraint discriminated union; delete `user_confirmed_event?: boolean`; §5.3 Opening Anchor ≠ message client_id | Aligned. Neither treats `opening_confirm` as a ConfirmationEvent type; Opening uses Anchor/History. source_turn_id / confirmation_turn_id / confirmation_action_id present in both. | No action; confirm Engineer does not invent opening_confirm-as-ConfirmationEvent. |
| F-13 | NOTE | §12 Opening Anchor ≠ POJUMessage.client_id; dedicated anchor_id | §5.3 same | Aligned. | None. |
| F-14 | NOTE | §13 Normalize → same object → Fingerprint + Mapper; §14.3 Agenda↔DIR 1:1; dup Agenda ID HARD FAIL | §6.1–6.4 same | Aligned. | None. |
| F-15 | NOTE | §1.2 / GI-30 holds; no Collecting redesign / Freeze / Stage4 / PageFeed / BookJudgment / Lab / 04 / SoT16 | §0 不得 same holds | Aligned. | None. |
| F-16 | NOTE | §21.4 merge and prod separate user decisions | §11 不得自行合并 PR / 不得自行部署 Production; Phase3≠Merge≠Prod | Aligned. | None. |
| F-17 | GAP | §17 GI-01…GI-30; §15 error catalog; §16 API duties; §20 pre-impl materials | Mapping does not enumerate GIs/error codes/API surface; stages + “依 Final Contract” | Mapping omits / softens by reference only — thinner, not contradictory. | Acceptance still against full Contract GIs + §15–§16; Mapping S5 must not be treated as reduced MUST set. |
| F-18 | NOTE | §18 P3-61…130 + §18.8 core block list | §7.4 same ID range + identical core block set; L1/L2/L3 match §19.1 | Aligned. Mapping correctly says names/assertions from Contract §18, not invent. | S5 must execute full matrix + core block; no Mapping-only subset. |
| F-19 | NOTE | §20 impl plan before code auth; §22 two preconditions (Job recovery verify; full write-entry inventory) | S0 inventories + §2.4 Job requirements; S1+ code | S0 inventories address Contract §22 evidence asks. Mapping does not replace need for Max S1 authorize after Contract consistency. | S0 accepted ≠ S1 authorized (reaffirm). |
| F-20 | GAP | §7.4 all encrypted_data writers through unified CAS; §2.2 | §3.4 converge W1–W6 + audit | Aligned intent. Completeness depends on S0 write inventory (evidence). | Keep S0 write inventory as gate evidence; S1 audit must prove no bypass. |

**Severity legend used:** CONFLICT = opposing MUST/MUST NOT or incompatible semantics (stop). GAP = Mapping thinner / incomplete vs Contract without contradiction. NOTE = aligned or process risk / misread risk.

**CONFLICT count:** 0 hard engineering conflicts.  
**Process risk:** F-01 (NOTE) is the main S1 false-authorization hazard.

---

## 3. Baseline commit citation

| File | Cites `96cf819d26bbbb7a1eb174848fb0366c1eebfe9f`? |
|------|--------------------------------------------------|
| Contract | YES (header + §1.3) |
| Locked Mapping | YES (header + §2.1) |
| S0 Session Write Inventory (evidence) | YES (per prior S0 accept / inventory header) |
| S0 Generation Job Inventory (evidence) | YES |

---

## 4. Contract sections 0–23 present

| § | Title |
|---|-------|
| 0 | 文件效力与基本原则 |
| 1 | 范围、基准与禁止扩展 |
| 2 | 基准源码现状与设计边界 |
| 3 | 全局数据权威与数据结构契约 |
| 4 | Generation 身份体系 |
| 5 | Generation Registry 与 Operation Binding |
| 6 | Generation TaskContext 状态机 |
| 7 | 双 Revision 与统一 Session CAS |
| 8 | C1 原子提交边界 |
| 9 | Path A / Path B / Path C 精确定义 |
| 10 | ControlPlane 运行时契约 |
| 11 | Confirmation Event 契约 |
| 12 | Opening Anchor 与 Gate History |
| 13 | Fingerprint 与 Normalization |
| 14 | Opening Seed、Call A、Call B 的业务映射规则 |
| 15 | 异常、回滚与恢复契约 |
| 16 | API 与调用边界 |
| 17 | 全局不变量（Global Invariants） |
| 18 | 自动化验收测试矩阵 |
| 19 | 测试执行与验收证据 |
| 20 | 实施前必须交付的工程材料 |
| 21 | 最终验收标准与变更控制 |
| 22 | 本次定稿的明确限制 |
| 23 | 定稿结论 |

All sections 0 through 23 are present.

---

## 5. Mapping text that could be mistaken as S1 authorization (NOTE)

1. Header: `状态：LOCKED / execution-ready` + “Max 2026-11-03 定稿”.
2. 附注: “可以把这份文档作为执行依据，不需要再提交 v3、v4…”.
3. §1 table presenting S1 as next deliverable after S0 without restating “Max explicit S1 authorize” (Mapping does say S0 gate before S1, but not Contract+Max dual gate).

**Correct reading (per Max boundary + Contract §0 / §21.4):** Mapping locked ≠ Contract approved for code ≠ S1 authorized. S0 Inventory Accepted / **S1 BLOCKED** until Max explicit S1 authorization after Contract↔Mapping consistency.

---

## 6. Checklist A–M (summary)

| Check | Result |
|-------|--------|
| A. Scope / holds | ALIGNED (NOTE on Contract “Gate” wording) |
| B. Dual revision + unified CAS coverage | ALIGNED substance / GAP detail depth |
| C. Generation identity / Registry / Binding / TaskContext | ALIGNED substance / GAP naming (`base_revision`) + schema thinness |
| D. Path A/B/C | ALIGNED substance / GAP thinner preconditions |
| E. C1 atomic commit contents | GAP (Mapping incomplete list vs §8.1) |
| F. ControlPlane vs DC; whitelist/validators | ALIGNED |
| G. ConfirmationEvent (no boolean-only; fact vs constraint; Opening separate) | ALIGNED |
| H. Opening Anchor ≠ message client_id | ALIGNED |
| I. Normalize → same object → FP+Mapper; Agenda↔DIR 1:1 / dup fail | ALIGNED |
| J. Job recovery vs §22 / Mapping §2.4 / S0 inventory | GAP/NOTE (build vs assume; S0: no client_task_id lookup today + equivalent recovery documented) |
| K. S0–S5 order; merge/prod separate | ALIGNED |
| L. Tests Contract vs Mapping S5 | ALIGNED (same P3-61…130 + core block) |
| M. MUST omit/soften/contradict; Mapping invents policy | No hard contradict; GAPs where Mapping thinner; F-01/F-11 policy-framing NOTEs |

---

## 7. Stop condition

No engineering CONFLICT requiring edit of Contract or Mapping. Report-only GAPs/NOTEs for Max. **Do not enter S1** until Max explicit authorization.

Files touched by this check: **only** this report  
`/workspace/eos-w0-sot/PHASE3-CONTRACT-MAPPING-CONSISTENCY-2026-11-03.md`  
Contract and Mapping unchanged.
