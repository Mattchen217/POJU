# Delivery Lab · P4 批断 / 正文 deferred

**状态**：P0 派工对齐 + P1 菜单完整草稿已落地。**请先重跑 P4 派工** →（claim 变了再批断）→ 再 fill  
**盘**：己土合伙续跑

## 铁律留痕

铁律 15：主修 prompt/菜单/派工契约；闸门 #9 拦对，本轮未加句式闸门。

## 已修

1. **P0**：`applyPreferBindingLocks` 在 P4（有 `moat_class`）**一律**用 hint 覆盖 `means_candidate_ref`；`unit_claim` 半截句软修/fail。  
2. **P1**：`metaphysics-moat-feed` 候选改为完整 means×2（独处降噪/破窗加码/借势站位…），无「择一」空槽；`claim_seed` 与动作草稿分离。  
3. fill duty：选择+贴案轻改菜单草稿。

## Lab 派工 #4（修后仍错的原因）

- `chart_fact_pack` 模式曾**清空** `prefer_claim` → 半截句无法软修；已改为 P4 保留 claim_seed。  
- 错型 ref：**根因**不是「没 stamp」，而是 feed 派工表 path→ref 与 `planDeepEvidenceSlots` 的 `moat_class` 分布不一致（slice eligible ≠ feed core eligible / unitCount）。stamp 错型 hint 仍错。已加 `realignP4PreferBindingsToMoat`：ref/claim 一律跟 slot.moat_class。  
- 悬挂扩展：`此时` / `需以食神`；fact_pack 下亦 soft-fill。

## Lab 顺序

1. 重跑 **P4 派工** — 验每维 `means_candidate_ref` 与 `moat_class` 同型、claim 完整句。  
2. 若 claim 变了 → 重跑批断。  
3. 再重跑 **P4 正文 fill**。
