# 总纲维度 ← TopicCalcSupplement 模块映射

> **用途**：总纲 feed 接线前的硬契约——哪个总纲维度吃二算哪几块，禁止「整包塞进 prompt 让模型自选」。  
> **前置**：方案 B（二算无冲守裁决）；独立验二算见 `scripts/inspect-topic-calc-supplement.ts`。  
> **状态**：映射已定；**feed 已按维接线**（`build-thesis-calc-feed.ts` · 2026-09-09）。

最后更新：2026-09-09（接线完成）

---

## 1. 权威提醒（接线时不许破）

| 结论类型 | 唯一权威 | 二算角色 |
|----------|----------|----------|
| 该冲 / 该守 | 总纲 `cycle_rhythm.conclusion_zh` | 只供事实：`cycles` / `cycle_relations` / `rhythm_signals` / 元素扶抑 |
| 主辅路径 | 题向收敛 | 可读总纲 + 二算事实；不读「二算冲守」（不存在） |

`rhythm_signals.summary_zh` 必须中性（禁 有利/不利/宜/不宜/该/不该…）；生成侧有 `coerceNeutralRhythmSummary`。

---

## 2. 维度 → 模块映射表（接线必遵）

| 总纲维度 `dimension_id` | **主吃**二算模块 | **可辅吃** | **明确不吃** | 说明 |
|-------------------------|------------------|------------|--------------|------|
| `day_master_strength` | （仍以**本命** structured 为主） | — | `rhythm_signals`、题类 `topic_slice` | 旺衰/格局是本命恒定判断；议题与岁运不改此维事实内容 |
| `favor_avoid_tuning` | 本命用喜忌 + **`yongshen_activation`** | `cycles`（标当前步干支） | `topic_slice`、冲守散文 | 本命定喜忌；二算只补「当前大运/流年对用神的**元素**扶抑」是否激活/冲突 |
| `interpersonal_pattern` | 本命十神 | `topic_slice`（仅当 category 为 relationship/interpersonal/family 时，作**菜单加权提示**，不改 classical_basis 事实） | `rhythm_signals` 作为人际结论 | 人际结构以本命为主；岁运引动若写入，须挂在 cycle 相关维或另扩维，勿偷塞结论 |
| `cycle_rhythm` | **`cycles` + `cycle_relations` + `rhythm_signals`** | `yongshen_activation.element_stances_conflict`（布尔信号） | `topic_slice`、任何 push/hold 字段 | **唯一**产出「纪元与岁环节奏 / 该冲该守」批断的维度 |
| `resource_pattern` | 本命财星/食伤 | `topic_slice`（wealth/career 加权）+ 流年十神若在 `cycles.current_liunian.ten_god` 且为财类 | `rhythm_signals` 当财运吉凶句 | 流年财引动用干支/十神事实，不用评价词 |
| `expression_creativity` | 本命食伤 | `topic_slice`（career 等加权） | `rhythm_signals` | 同 resource：菜单可调详略，不改本命有无食伤 |

### 一览（给实现者）

```text
day_master_strength  ← 本命 only
favor_avoid_tuning   ← 本命用喜忌 + yongshen_activation (+ cycles 标注)
interpersonal_pattern← 本命十神 （topic_slice 仅详略/菜单）
cycle_rhythm         ← cycles + cycle_relations + rhythm_signals （+ conflict 布尔）
resource_pattern     ← 本命财/食伤 (+ liunian ten_god 事实 + topic_slice 详略)
expression_creativity← 本命食伤 (+ topic_slice 详略)
```

---

## 3. 接线反模式（禁止）

| 反模式 | 为什么禁 |
|--------|----------|
| 把整个 `TopicCalcSupplement` JSON 丢进总纲 system/user，让模型自己挑 | 维度职责变黑盒；易用错 `topic_slice` 污染恒定维 |
| 用 `topic_slice` 改写 `day_master_strength` / 用喜忌结论 | 议题污染真算判断 |
| 在 `favor_avoid` 或其它维写「宜守/宜进」抢 `cycle_rhythm` | 双源裁决回潮 |
| 把旧 `dayun-polarity` 的「宜守、可推进」note 拼进 feed | 评价文案冒充事实 |
| 接线前未跑 `inspect-topic-calc-supplement` | 分不清二算错还是总纲错 |

---

## 4. 接线状态

已实现于 `lib/llm/pro/delivery/thesis/build-thesis-calc-feed.ts`：

1. ~~人工过完三盘 inspect~~  
2. ~~`cycle_rhythm` 接 cycles + rhythm_signals + stack~~  
3. ~~`favor_avoid_tuning` 接 yongshen_activation 元素姿态~~  
4. ~~其它维：本命为主；`topic_slice` 只进 hints~~  
5. 单测：`pnpm test:thesis-calc-feed` · `pnpm test:topic-calc-supplement`

---

## 5. 自检

- [x] 每个维度的主吃模块是否唯一写清？  
- [x] `cycle_rhythm` 是否是唯一冲守批断出口？（feed 只供事实，不做 push/hold）  
- [x] feed builder 是否按维取字段，而非整包 dump？  
- [x] `summary_zh` / checklist 是否过中性词检查？（signals 来自 coerceNeutral）