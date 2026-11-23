# Page02 · Program-Owned Unit Slot Plan 缺口（R5）

**状态**：实施停在缺口 · **未建立非空 Unit→DIR** · Page02 **未验收**  
**起点 HEAD**：`e27ae707704c82ad6b67261d71d2dea3a5db5252`  
**前提**：R4 已确认生产无 Unit→DIR；R5 目标为「槽位先于模型」，但 **不得伪造 slot→DIR 分配**。

---

## 结论（一句话）

现有 Decision Blueprint / DDR / DIR / InvestigationDirection / BookJudgment quota **只提供页级 / 节级 DIR 集合与 track·segment 配额**，**不提供**「每个 BookJudgment science unit 独占一个 `dir_id`」的程序权威表。  
因此 **不得** 实现看起来完整的 Slot Allocator；生产绑定继续为空。

---

## 已检查的「权威候选」与粒度

| 来源 | 实际粒度 | 能否合法得到 1 slot → 1 DIR？ |
|---|---|---|
| `DDR-02-ATTRIBUTION` | 1 DDR → **3** `required_dir_ids`（page 02 / section A） | **否**（多 DIR 义务，非 unit 独占） |
| `DDR-02-SCIENCE-BRIDGE` | 1 DDR → **3** DIRs（page 02 / section B） | **否** |
| DIR `default_serves_face === "02"` | 仅 `DIR-STATUS-QUO` / `DIR-PAST-ATTEMPTS` 提示 | **否**（页提示；且同页 DDR 还要求默认挂 01/04/06 的 DIR） |
| `InvestigationDirection` | category 桶合并多 DIR | **否** |
| `DecisionBlueprint.dir_ids` | session 范围列表 | **否** |
| BookJudgment quota `segment_slots` | `segmentId` + `preferred_track` + duty | **否**（无 `dir_id` / `ddr_id`） |
| DC Fact→DIR | Fact 结构化链 | **否**（R4：不是 Unit→DIR；禁止批量挂） |

DDR `report_section_id`（A/B）≠ BookJudgment face-02 body segment（A–E 职责段）。字母相同 **不是** slot→DIR 权威规则。

---

## 禁止的「假 Slot Plan」做法（本轮明确拒绝）

- 取 page-02 DIR 并集后按 unit/DIR ID **排序配对**
- 按数量均分 / 轮询
- `DDR-02-SCIENCE-BRIDGE` →「那个 science unit」却忽略其 3 个 DIR
- DDR section 字母对齐 BJ segment
- `serves_face` / `track` / 同页共现
- Fact→DIR 给所有 science unit 挂边
- 模型 `dir:` cite「ID 合法」升级为「语义关联已认证」

**预先开空 unit 壳 ≠ 发明关联。** 没有独占 `dir_id` 的 SSOT 行，就没有合法 Slot Plan。

---

## 要使 R5「YES」所需的最小 SSOT（尚未存在）

需要程序闭集表（catalog 或 Blueprint 派生），每行已写死独占所有权，例如：

```ts
{
  slot_id: string;       // 程序稳定
  unit_id: string;       // 程序预分配；模型只填 claim/anchors
  dir_id: string;        // 恰好一个；非 DDR 多 DIR 事后拆分
  requirement_id: string; // 更细的义务键，或「每 DIR 一行」的 DDR 展开表
  source_type / source_id / source_version / source_hash
}
```

硬约束：

1. **1:1** `slot_id`/`unit_id` → `dir_id` 写在 SSOT 里（或展开表每行已是单 DIR），禁止运行时从 3-DIR DDR 发明拆分顺序。  
2. 范围过滤可 **丢弃** 不在当前 Blueprint/DC 的 slot，禁止把剩余 DIR **改派** 给别的 slot。  
3. `runBookJudgmentPackGenerate` 注入 Slot Plan → 内部模块发 `ProgramUnitDirAuthorityEdge` → R3 证书闸；生产入口仍拒外部 edges。  
4. 模型不得改 `slot_id` / `unit_id` / `dir_id` / `source_ref`。

---

## 本轮代码行为

| 做 | 不做 |
|---|---|
| `tryBuildProgramOwnedUnitSlotPlan` 诚实返回 `missing_exclusive_slot_dir_ssot` | 不生成非空 Slot Plan |
| 生产仍省略 `authority_edges`；绑定为空 | 不接伪造分配器进 generate |
| R5 回归锁 + 指向本 SSOT | 不宣告 Page02 / R5 能力完成 |

代码入口：`lib/llm/pro/delivery/book-judgment/program-owned-unit-slots.ts`  
R4 调查：`Page02-Unit-DIR-provenance-缺口-R4.md`
