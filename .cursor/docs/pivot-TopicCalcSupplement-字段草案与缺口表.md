# Pivot · TopicCalcSupplement 字段草案与缺口表

> **用途**：第二次本地算（题时补充）的目标字段契约 +「本命已有 vs 题时需派生」缺口清单。  
> **范围**：先文档 + TypeScript 类型草案；**不**改交付派工 / 总纲生成大改。  
> **关联**：白话全链路 §8；类型孪生 `lib/calculations/topic-calc-supplement/types.ts`；  
> **总纲接线映射**：`.cursor/docs/pivot-总纲维度-TopicCalcSupplement-映射.md`（feed 接线必遵）；  
> **独立验盘**：`pnpm exec tsx scripts/inspect-topic-calc-supplement.ts`。  
> **红线**：确定性代码算事实；模型只组织白话。禁止用 LLM 填真算判断。开源只对照规则，不当第二套排盘 SSOT。

最后更新：2026-09-09（方案 B：去掉 near_term_bias；落地 buildTopicCalcSupplement）

---

## 0. 定位（一句话）

`TopicCalcSupplement` = 开交付后、总纲前的**独立本地步骤**产出：在**不变本命**上，按 `as_of` + 题类，切出「这一题当下要用的岁运 / 关系 / 十神 / 宫位」菜单。  
**不重算本命**；**不定主辅**（主辅是题向收敛）；**不写用户正文**。

---

## 1. 输入 / 输出总览

### 1.1 输入

| 字段 | 说明 |
|------|------|
| `structured` | 第一次本地算 · `ProfileStructured` |
| `question_category` | `career` / `relationship` / `wealth` / `decision` / 生活节奏≈`health` 或 `other` 等 |
| `original_question` / `desired_outcome` | 第1段锁定（仅影响切片权重与菜单优先级，**不改**本命字段） |
| `agenda_anchors` | 第3段 covered 里抽出的短锚（可选；无则仍可跑二算） |
| `as_of` | ISO 日期/时间；默认「现在」——决定流年/大运步 |

### 1.2 输出（顶层）

见类型：`TopicCalcSupplement`（`version: 1`）。

| 块 | 职责 |
|----|------|
| `meta` | fingerprint、题类、as_of、引擎版本 |
| `cycles` | 当前大运步、流年、流月（v1 **不含流日**）、干支与十神相对日主 |
| `cycle_relations` | 大运/流年/流月 × 本命；刑冲合害等闭集标签 |
| `yongshen_activation` | 当前岁运对用/喜/忌的元素扶抑（查表） |
| `topic_slice` | 按题类筛选后的十神/宫位/关系菜单 + 权重（含因人而异的 `natal_fields`） |
| `rhythm_signals` | 与 `cycle_relations` **1:1** 的中性信号（禁止静默丢条） |
| `absent_notes` | 本盘/本题**如实未见**的项（禁止编造填满） |
| `thesis_feed_hooks` | 对齐总纲 calc feed 的 key（含 `cycle_tension_signals`） |

### 权威分权（方案 B · 已敲死）

| 问题 | 唯一权威 | 二算角色 |
|------|----------|----------|
| 该冲还是该守？ | **总纲 `cycle_rhythm`** | 只提供 `cycles` / `cycle_relations` / `rhythm_signals` / 元素扶抑表 |
| 这题主辅怎么走？ | **题向收敛** | 可读二算事实与总纲批断；**不得**把二算信号当成第二套冲守结论 |

**禁止：** 二算产出 `near_term_bias` / push / hold / retreat / 「宜冲」「宜守」打包裁决。  
**禁止：** 题向收敛并列比较「二算冲守」与「总纲冲守」（前者根本不应存在）。

---

## 2. 字段草案（按块）

### 2.1 `meta`

```ts
{
  version: 1;
  structured_fingerprint: string;  // 与本命一致
  question_category: QuestionCategory;
  as_of: string;                   // ISO
  engine_versions: {
    relation_engine: string;
    liunian: string;
    topic_typed: string;
    yongshen_heuristic?: string;
  };
}
```

### 2.2 `cycles`（岁运时钟）

| 字段 | 含义 | 现网 |
|------|------|------|
| `current_dayun` | 当前大运干支、起止岁、十神相对日主 | 本命有 `da_yun[]`；「当前步」可 resolve |
| `current_liunian` | 流年干支（立春界）、十神相对日主 | **有** `liunian.ts`；总纲 feed **未接** |
| `current_liuyue?` | 流月 | 有模块 |
| `dayun_index` | 当前步索引 | 有 |
| ~~流日~~ | **v1 不做** | Atmos 有；本包明确排除 |

读摘要：「流月引动·**日支**」= 引动本命日柱地支；**≠** 流日运限。

### 2.3 `cycle_relations`（叠层关系）

| 字段 | 含义 | 现网 |
|------|------|------|
| `dayun_x_natal[]` | 大运支干 vs 本命柱关系标签 | `relation-engine` 有 |
| `liunian_x_natal[]` | 流年 vs 本命 | 有 |
| `liunian_x_dayun[]` | 流年 vs 大运（可选） | 部分有 |
| `ten_god_tensions[]` | 身弱等条件下的十神张力 | 有 |

每条关系：`kind`（chong/xing/he…）+ `positions` + `summary_zh`（机器短句，非用户正文）。

### 2.4 `yongshen_activation`（元素表，非攻守文案）

| 字段 | 含义 | 缺口类型 |
|------|------|----------|
| `yong` / `xi` / `ji` | 复用本命用喜忌 | 已有 |
| `dayun_element_stance` | 大运干 vs 用神：support/drain/control/neutral | **规则**（五行生克表） |
| `liunian_element_stance` | 流年干 vs 用神同上 | **规则** |
| `element_stances_conflict` | 大运与流年元素姿态是否冲突（布尔） | **规则** |

**不是** `dayun-polarity` 里带「宜守/可推进」的文案；那些旧 inventory 话术**不得**复制进本包当冲守裁决。

### 2.5 `topic_slice`（题类菜单）

```ts
{
  primary_palaces: Palace[];       // 本题优先宫位
  focus_ten_gods: string[];        // 本题优先十神
  natal_fields: TopicTypedField[]; // 已有 topic-typed 过滤结果
  relation_focus: RelationLabel[]; // 过滤后的关系
  priority_weights: Record<string, number>; // 仅排序，不改事实
}
```

题类默认宫位 / 十神（规则表，可测）：

| 题类 | 优先宫位 | 优先十神（示意） |
|------|----------|------------------|
| `career` | career, result, self | 官杀、印、食伤 |
| `relationship` | spouse, self | 日支、财（男）、官杀（女）等按既有单盘规则 |
| `wealth` | career, self | 财、食伤生财链路 |
| `decision` | self + 题锚宫 | 官杀/财/印中**与议程锚相交**者；无相交则 `absent` |
| 生活节奏（`health`/`other`） | self | 调候、燥湿、大运冷热；**禁止**脏腑医疗断 |

### 2.6 `rhythm_signals`（中性信号 · 替代旧 timing_windows）

| 字段 | 含义 | 缺口类型 |
|------|------|----------|
| `id` / `kind` / `layers` | 哪一层、何种关系 | 规则（接 relation-engine） |
| `involved_ten_gods` | 相关十神（可空） | 规则 |
| `summary_zh` | 事实句，如「流年午与日支子相冲」 | 规则 |

**已删除：** `near_term_bias`（push/hold/retreat）。冲守散文**只**在总纲 `cycle_rhythm` 生成。

**中性用词保险：** `summary_zh` 禁止 有利/不利/宜/不宜/该/不该 等倾向词；实现见 `rhythm-summary-neutral.ts`（命中则降级为 `kind·positions` 结构句）。

**决策题 A/B：** 二算不给「选 A/B」；无结构区分 → `absent_notes`，交给第3段现实 + 题向收敛。

### 2.7 `thesis_feed_hooks`（对接总纲）

维度←模块映射见：`.cursor/docs/pivot-总纲维度-TopicCalcSupplement-映射.md`。  
**禁止**整包塞进总纲 prompt。

---

## 3. 题型覆盖矩阵（要什么 → 从哪来）

| 题型 | 二算必须给出 | 本命已够 | 须题时派生 | 不做 |
|------|--------------|----------|------------|------|
| **事业 career** | 官杀/印/食伤焦点 + 大运流年叠本命 + 用神极性 | 十神、格局粗标、本命关系 | 流年叠层、题向宫位过滤、岁运用神极性 | 岗位/行业命名 |
| **感情 relationship** | 夫妻宫/日支关系 + 流年引动配偶相关星 | 配偶宫关系、型人提示（单盘） | 流年×日支/配偶星、关系过滤 | **合盘**（Match only） |
| **财运 wealth** | 财星根气线索 + 食伤生财 + 流年财引动 | 财星、身财粗平衡、resource 维 checklist | 流年财星十神、财星被冲合 | 资产类别预测 |
| **决策 decision** | 与议程锚相交的约束星 + timing bias；无则 absent | 财官同现等 topic 字段 | 锚相交过滤、timing 启发式 | 编造「盘面必选 A」 |
| **生活节奏** | 调候/燥湿/大运冷热负荷 | 用神调候粗、pack dashboard | 岁运对调候的加减 | 医疗脏腑、疾病名 |

---

## 4. 缺口表（本命已有 vs 题时需派生）

图例：

- **已有**：本地已算且可引用  
- **规则缺口**：传统有明确查表/公式 → **写确定性代码**  
- **经验边界**：流派易分歧 → **人工评审 + 版本号启发式**（可测可复现，非现场问模型）  
- **产品不做**：政策或另产品

### 4.1 跨题通用

| ID | 需要的数据 | 本命 | 题时 | 标注 | 备注 |
|----|------------|------|------|------|------|
| G1 | 当前流年干支 | — | 派生 | **规则缺口** | 引擎有，接进 Supplement + 总纲 feed |
| G2 | 当前大运步 + 干支十神 | `da_yun[]` | resolve | **规则缺口**（接线） | `resolve-luck-cycles` 已有，统一进包 |
| G3 | 大运×本命关系列表 | 本命关系有 | 派生 | **规则缺口**（接线） | `relation-engine` 已有，写入 `cycle_relations` |
| G4 | 流年×本命关系列表 | — | 派生 | **规则缺口**（接线） | 同上；总纲现标 absent |
| G5 | 大运+流年叠层**事实**（双柱 + 关系列表） | — | 派生 | **规则缺口**（接线） | 合成「该冲该守」**不做**在二算 |
| G6 | 流年对用神**元素**扶抑 | 用喜忌有 | 派生 | **规则缺口** | 生克表；非宜守文案 |
| G7 | 流月（可选） | — | 派生 | **规则缺口** | 默认可附带；冲守仍归总纲 |
| G8 | 统一 `TopicCalcSupplement` 对象 | — | — | **规则缺口** | 首版 builder 已出类型+实现骨架 |
| G9 | 总纲 feed 接流年/张力信号 | feed 故意空 | — | **规则缺口** | 交付接线另步；hooks 已预留 |

### 4.2 事业 career

| ID | 需要的数据 | 本命 | 题时 | 标注 |
|----|------------|------|------|------|
| C1 | 官杀/印/食伤焦点列表 | 十神有 | 过滤 | **规则缺口**（宫位/十神表已有雏形，收成题表） |
| C2 | 「权责 vs 产出」张力标记 | topic-typed 部分有 | 复用+岁运是否引动 | **规则缺口** |
| C3 | 流年是否引动官杀/印 | — | 派生 | **规则缺口** |
| C4 | 事业向「该冲该守」 | — | — | **归总纲 cycle_rhythm** | 二算只给元素姿态 + rhythm_signals |
| C5 | 具体职业/行业 | — | — | **产品不做** |

### 4.3 感情 relationship

| ID | 需要的数据 | 本命 | 题时 | 标注 |
|----|------------|------|------|------|
| R1 | 日支/夫妻宫刑冲合 | 本命关系有 | 过滤 spouse | **规则缺口**（接线+过滤） |
| R2 | 流年冲合日支/配偶星 | — | 派生 | **规则缺口** |
| R3 | 单盘「对象型」提示 | `partner-archetype` 有 | 可附带 | 已有；仅单盘 |
| R4 | 婚姻应期细窗 | — | — | **经验边界**（若做：版本化粗窗；不做日吉凶） |
| R5 | 双人合盘 | Match 另有 | — | **产品不做**（POJU 交付） |

### 4.4 财运 wealth

| ID | 需要的数据 | 本命 | 题时 | 标注 |
|----|------------|------|------|------|
| W1 | 财星显隐与身财粗平衡 | topic-typed / thesis resource | 复用 | 已有（偏本命） |
| W2 | 食伤生财链路是否成立 | thesis checklist 向 | 复用 | 已有/启发式 |
| W3 | 流年财星十神 + 冲合财星柱 | — | 派生 | **规则缺口** |
| W4 | 现金流 vs 资产类别 | — | — | **产品不做** |

### 4.5 决策 decision

| ID | 需要的数据 | 本命 | 题时 | 标注 |
|----|------------|------|------|------|
| D1 | 与议程锚相交的十神/宫位 | topic 字段有 | 锚过滤 | **规则缺口** |
| D2 | A/B 两岔各自盘面成本 | — | — | 多数无确定性依据 → **absent**；不硬凑 |
| D3 | near_term_bias / 宜冲宜守 | — | — | **不做**（方案 B）；归总纲 |
| D4 | 「盘面唯一正确答案」 | — | — | **产品不做**；转交现实细节 |

### 4.6 生活节奏（非医疗）

| ID | 需要的数据 | 本命 | 题时 | 标注 |
|----|------------|------|------|------|
| L1 | 调候/燥湿粗标 | 用神启发式部分 | 复用 | **经验边界**（调候流派） |
| L2 | 大运冷热对调候加减 | — | 派生 | **经验边界** |
| L3 | pack dashboard 负荷 | metaphysics_pack 有 | 可附带 | 已有；非题条件 |
| L4 | 脏腑/疾病推断 | — | — | **产品不做** |

---

## 5. 实现原则（与拍板一致）

1. **接线优先**：G1–G4、G6、G8–G9；多数「能力不足」是未接线。  
2. **方案 B**：二算不产出冲守裁决；总纲 `cycle_rhythm` 唯一权威。  
3. **开源**：只对照规则表；不接第二 SSOT；不给模型学话术。  
4. **规则缺口** → 确定性函数 + 单测。  
5. **经验边界** → 必须先落 `heuristics/reviews/*.md`（见同目录 README），再合代码；当前首版无方向性经验启发式。  
6. **无依据** → `absent_notes`；交给收集现实与题向收敛。  
7. **禁止**用模型深度测算填本包任何真算判断字段。

---

## 6. 落地顺序

1. ~~类型草案~~ · ~~`buildTopicCalcSupplement` 骨架~~ · ~~中性词保险~~ · ~~跨 category 事实层不变冒烟~~  
2. ~~独立验盘脚本（三盘 fixtures）~~ — `inspect-topic-calc-supplement.ts`（**接线前人工过一眼**）  
3. ~~维度←模块映射文档~~ — `pivot-总纲维度-TopicCalcSupplement-映射.md`  
4. **下一步**：按映射改 `build-thesis-calc-feed`（仍非整包 dump）  
5. Lab 暴露独立「二算」步（另开）

---

## 7. 自检

- [ ] 二算输出是否可在 Lab **单独**点跑？（接线后）  
- [ ] 是否零 LLM 写判断字段？  
- [ ] 同一 `structured` + 同一 `as_of`，不同 `question_category` 是否只改变 `topic_slice`，不改变 `cycles` 干支？  
- [ ] 是否**没有** `near_term_bias` / push-hold-retreat 字段？  
- [ ] 题向收敛文档是否写明：冲守只信总纲 `cycle_rhythm`？  
- [ ] 经验边界若新增，是否已有 `heuristics/reviews/` 评审页？  
- [ ] 合盘/医疗/行业命名是否仍排除？