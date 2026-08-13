# Pivot · 全站用户可见输出与五段设计规范（Canonical）

> **地位**：本文件**替换**原《pojulife-四产品统一输出规范》。  
> 任何改动提示词、LLM 调用链、本地算盘注入、交付报告、合规、渲染的工作，**必须先读并遵循本文件**。  
> 目标：全站（Pivot 为主；Glyph / Match / Syncro 共用底座与可见语纪律）在**怎么说话、怎么算、怎么喂数、怎么交付**上口径一致。

最后更新：2026-08-13

---

## 关联 SSOT（勿另起炉灶）

| 文档 / 代码 | 管什么 |
|---|---|
| **本文件** | Pivot 五段设计 + 全站用户可见输出总纲 + 底座/闭集/双层/渲染 |
| `.cursor/docs/全局用户可见表达契约-映射表-SSOT.md` | 行为/精力白话契约 + 受控映射行 |
| `lib/glossary/vernacular-mapping-ssot.ts` | 映射表代码孪生 |
| `lib/llm/prompts/user-facing-expression-contract.ts` | `buildUserFacingExpressionContractBlock` + phase presets |
| `.cursor/docs/提示词按阶段隔离-防再污染备忘.md` | 交付向规则禁止进身份层 |
| `.cursor/docs/prefix-cache-省钱工程-spec.md` | 静态 system / 动态 user / 供应商钉死 |
| `lib/glossary/term-closed-set.ts` | 闭集 slug / 神煞 24 / 十神等 |
| `lib/glossary/vernacular-leak-feedback.ts` + `vernacular-leak-staging.ts` | 泄漏 → staging 禁词 → 频发升映射（**人工落库**，非脚本自动写表） |

**铁律：映射表 / 表达契约 / 打标双层 → 只进对应阶段 taskBlock；禁止灌进 `POJU_IDENTITY*` / 无门控控制面。**

---

## 0. 一句话定位

**Pivot**：用三千年东方时空模型做**本地确定性真算**，用现代行为 / 精力 / 决策语言交付给用户听得懂、用得上的破局辅导——不是占卜摊，也不是医学 App。

| 层 | 名字 | 用户可见？ | 语言 |
|---|---|---|---|
| L0 引擎 | `structured` / dims / spine / fact-guard | ❌ | 可裸命理词（内部） |
| L1 表达契约 | 本文件 §1 + 表达契约 SSOT | ✅ 约束模型正文 | 行为 / 精力 / 决策白话 |
| L2 交付依据 | 「依据与推理」折叠 + `⟦t:⟧` | ✅ 折叠层可金字 | 闭集软译 + 语境白话 |

---

## 1. 全站用户可见输出规范（正文怎么说）

> 适用于：Pivot 对话正文、议程问句、交付 **main_body**、以及后续挂载同一契约的 Glyph / Match / Syncro 用户向文案。  
> **不**适用于：L0 真算腿、delivery evidence 槽内真词、纯内部 JSON 锚字段。

### 1.1 铁律（摘要）

1. **禁裸命理专名**进用户正文：十神原名、干支连写、十二时辰专名、生克四字格、神煞原名、大运/流年/命盘/八字等（审计底线仍以 `BANNED_TERMS_ZH` + purity / audit 为准）。  
2. **判断可追溯**：用「能量底座 / 能量结构 / 先天配置 / 底层结构」类依据感 + 可观察结论；必须锚 `structured` / 骨架，禁止套壳鸡汤。  
3. **科学词受控**：只能来自映射表；表外禁止临场发明皮质醇 / 交感神经检测故事。  
4. **非定命 / 非医疗**：禁止具体日期点位预测与伪化验口吻；框架性压力-恢复叙事可以。  
5. **拼音品牌调味允许**（`BAZI` / `QI` / `WUXING`…）且首次附英文 gloss ≠ 可以裸写命理专名。  
6. **对话阶段不做 `⟦t:⟧` 硬塞**；软译交后端 `autoMark`。八页交付打标只在交付层。

### 1.2 阶段挂载（表达契约 preset）

| Preset | 挂载点 | 映射表 |
|---|---|---|
| `opening` | `buildOpeningTaskBlockV6` | 摘要 only（`[]`） |
| `voice` | `buildBreakthroughCoreVoicePrompt` | stress / decision 子集 |
| `agenda` | `buildAgendaBridgePrompt` | 短子集 |
| `collecting` | `buildCollectingTaskBlockV6` | 摘要 only |
| `synthesis` | `buildSynthesisPrompt` | 短子集；约束 direction / why_fits / action_plan |
| `delivery` | finalize + narrative | 较宽子集；**不挂** evidence |
| — | L0 DIMS / SPINE / `POJU_IDENTITY` | **禁止挂** |

### 1.3 泄漏回流（人工）

```text
purity / audit 命中 → recordUserFacingLeakHit（日志 + ring）
  → 评审写入 STAGED_BAN_ZH
  → 同概念 ≥3 次 → 人工升格映射行（先改表达契约 SSOT §2.3 → TS → preset）
```

`pnpm test:leak-feedback` **只测机制**，不会自动改禁词表 / 映射表。

### 1.4 与闭集金字的分工

| 场景 | 做法 |
|---|---|
| 对话 / VOICE / agenda / collecting / opening | 白话契约；漏词靠 autoMark + audit |
| 交付 **正文** | 契约 + purity；**零** `⟦t:⟧` |
| 交付 **依据与推理** | 闭集真词 → `⟦w:⟧` → mark → `⟦t:slug|软译|语境⟧`；契约「禁裸词」**豁免**槽内 |

---

## 2. 产品与共用底座

| 名称 | 角色 | 交付形态 |
|---|---|---|
| **命主基础分析** | 共用中立底座（数字孪生） | `structured` + 中立叙事；喂全产品 |
| **Pivot (POJU)** | 破局顾问（一事一议） | 五段对话 + 八页双层报告 |
| **Glyph** | 签象原型反思 | 签象 + 解读 |
| **Match** | 双人合盘 | 关系报告 |
| **Syncro** | 时空方位策略 | 矩阵建议 |

**铁律：底座中立，场景化由下游做。** 底座只读能量结构硬件配置，**绝不**定性职业 / 关系 / 事件。

### 2.1 底座四维（绑 `structured`）

1. **核心底色（强项）** — `day_master / strength`  
2. **系统脆弱点** — `ji_shen` / 缺失五行（不谈吉凶）  
3. **能量平衡锚** — `yong_shen / xi_shen` + 调候（中立非场景）  
4. **高杠杆发力区** — `yong_shen` 得力状态（不指定行业、不预测事件）

**硬禁**：编造职业/婚育/资产；预测具体事件；医疗脏腑点名；逐柱罗列原始藏干/十神枚举。

### 2.2 本地算 vs 模型

| 本地确定性 | LLM |
|---|---|
| `build-profile-structured`（八字盘） | 各阶段对话 / VOICE |
| `relation-engine`（冲刑合害等） | Call A dims/spine/voice、Call B |
| `buildStructuredInstanceInventory` | synthesis 收敛 |
| `metaphysics_pack` / element scores | delivery finalize → narrative → evidence → mark |
| 状态机 / 门禁 / agenda 覆盖 | 底座叙事 `display_text`（**不进**产品事实源） |

**下游准确性靠 `structured`，不靠叙事长度。**  
注入：`formatBaseAnalysisForPrompt` — JSON 事实源 +（可选）去标记叙事仅作风气参考。

---

## 3. Pivot 五段设计（怎么做 · 数据怎么给）

> 内容五段与运行时 `AgentPhase` 并存；以本表为准。  
> **编号注意**：synthesis = 内容第4段；八页交付 = 汇总之后的异步 job（勿与旧注释「第4段交付」混淆）。

### 3.1 总览

```text
opening（理解门）
  → awaiting_understanding_confirm
  → segment2 Call A（多维真算 ∥ spine → VOICE）
  → segment2 Call B（议程 / 首问）
  → collecting_context（现实收集）
  → awaiting_confirmation
  → synthesis（一主一辅收敛）
  → final delivery（八页双层报告）
  → delivered / tracking
```

### 3.2 第1段 · opening（理解门）

| 项 | 要求 |
|---|---|
| **目标** | 只收齐：问题 / 情况 / 期望（三必填）；不做深度命理诊断、不产议程 |
| **用户可见** | `response`、`options` |
| **内部** | `core_dilemma`、`desired_direction`、`scope_signal`、`question_status` |
| **喂数** | **瘦盘** dataplane（日主/柱要点即可）；`includeBaseAnalysis: false` 类 slim |
| **契约** | `preset: "opening"`（摘要） |
| **期望够用线** | `wants` = 结果**方向/状态**即够；**不是**方案形态。方向一出口即可收口 |
| **手段边界** | 手段是命理**产出**，第1段**不向用户收集**；「了解想到哪」本分，「追怎么做到」越界 |
| **禁止** | 为方案具体化继续追；清空已填 wants；心理创伤式深挖；复读用户原话；灌映射全表 |

关键文件：`lib/llm/phases/opening-phase-v6.ts`

### 3.3 第2段 · segment2（真算 + 议程）

**Call A（并行）**

| 腿 | 职责 | 用户可见？ |
|---|---|---|
| A-dims | 多维命理判断 JSON | ❌ |
| A-spine | 破局骨架 / 假设路径 | ❌ |
| A-voice | 熔合叙述 `response` | ✅ |

- 喂数：完整 `formatBaseAnalysisForPrompt`（`includeInterpretive: false`）+ instance inventory + 第1段理解门摘要。  
- 契约：VOICE → `preset: "voice"`。  
- UI 只展示 VOICE；token 大的 JSON 是内部料，不是拼接 bug。

**Call B**

| 项 | 要求 |
|---|---|
| **目标** | 为「解用户的问题」对齐还需收集的现实；不是填报告页 |
| **用户可见** | `first_question` + `options` |
| **内部** | `investigation_agenda`（工程路由；勿当给用户的清单报幕） |
| **喂数** | segment1 理解 + Call A 多维 JSON（不重喂整盘） |
| **契约** | `preset: "agenda"` |

关键文件：`lib/llm/deepseek/segment2-a-parallel.ts`、`breakthrough-core.ts`、`lib/poju/phases/segment2/`

### 3.4 第3段 · collecting（现实收集）

| 项 | 要求 |
|---|---|
| **目标** | 按议程收现实证据；**不定**一主一辅 |
| **用户可见** | 每轮 `response` / `options`；收尾固定 CTA |
| **内部** | `covered_agenda`、context 增量；可演化 spine 字段但不宣布最终方向 |
| **喂数** | **全量** dataplane + fact-guard + directed relations + instance inventory |
| **契约** | `preset: "collecting"`（摘要） |
| **文风** | 少过度共情、不复读用户；锋利有用 |

关键文件：`lib/llm/phases/collecting-phase-v6.ts`

### 3.5 确认门 · awaiting_confirmation

| 项 | 要求 |
|---|---|
| **目标** | 向用户确认「料已齐、可以收敛」；**不写报告** |
| **喂数** | slim dataplane |
| **契约** | 可见句靠 autoMark 兜底；可不灌全表映射 |

### 3.6 第4段 · synthesis（汇总收敛）

| 项 | 要求 |
|---|---|
| **目标** | 读多维真算 + covered 现实 → **一主一辅** + action_plan |
| **用户可见（进交付）** | `direction` / `why_fits` / `action_plan` → 白话契约 |
| **内部锚** | `structural_basis` / `needs_validation` 可短引擎词 |
| **喂数** | `multi_dimension_reckoning` + `covered_agenda` + desired_outcome；**不重算盘** |
| **契约** | `preset: "synthesis"` |
| **禁止** | why_fits 写「十神格局X+大运Y」裸词模板 |

关键文件：`lib/llm/deepseek/synthesis-task.ts`

### 3.7 交付段 · final delivery（八页双层）

| 项 | 要求 |
|---|---|
| **目标** | 定稿 spine 切片 → 扩写正文 → 写依据 → 打标 → 组装报告 |
| **流水线** | finalize → narrative → evidence → mark →（译）→ assemble |
| **main_body** | 纯白话 + `preset: "delivery"`；零 `⟦t:⟧`；purity warn |
| **technical_spine** | `bazi_basis` / evidence；闭集真词；契约禁裸词**豁免** |
| **UI** | 正文铺开；「依据与推理」折叠；渲染走 `GlossaryText` → `RichReadingText` |
| **喂数** | breakthrough_core 切片 + covered_agenda + metaphysics_pack 真算料 |

关键文件：`lib/llm/pro/delivery/*`、`buildDualLayerDeliveryPromptBlock`

### 3.8 delivered / tracking

短聊承接；**不做**八页打标教学；软译 autoMark。禁止再塞交付向双层/金字契约进聊天共用层。

### 3.9 Prefix cache（喂数工程约束）

- **静态 system**：身份 + 跨轮恒定块（见省钱工程 INV）。  
- **动态**（日期 / 任务 / 议程 / 已收集）：只在 **user**。  
- `base_analysis` session 内字节稳定；勿在静态头混时间戳。  
- 表达契约挂在**阶段 taskBlock / Call system 尾部**，不进恒定身份头。

---

## 4. 闭集 · 标记 · 排版 · 合规（全站强制）

### 4.1 术语标记（交付依据层 / 需金字处）

```text
⟦t:<闭集slug>|<可见软译>|<该处语境白话>⟧
```

- id 必须来自 `CLOSED_SET_SLUG`；禁止自造。  
- keep_cn：`软译 (干支)`。  
- 极性：用神绿 / 忌神红 / 其余金（`term-polarity.ts`）。  
- 渲染：**必须** `GlossaryText` / `MarkedInline` → `RichReadingText`；禁止裸 markdown 展示报告。

### 4.2 闭集准确性

- 神煞闭集 **24**（`CLOSED_SHEN_SHA`）；十神 10 / 长生 12 / 干支五行见 `term-closed-set.ts`。  
- **只用本次 `structured` 实算项**；清单空则整篇不得出现神煞名。  
- 集外禁词（`OUT_OF_SET_FORBIDDEN_HAN`）落库前 `auditDeliveredText` **必须能阻断**。  
- 用神/喜忌/强弱/格局：只解释、不改判、不另算。

### 4.3 降维排版

| 要素 | 语法 |
|---|---|
| 子标题 | `###` |
| 要旨块 | `**真实要旨短语:** …`（禁字面 `Bold lead:`） |
| 金句 | `> …` |
| 列表 | 每条独占行 `- ` |
| 密度 | 每段 ≤80 词（中≤120字）；每段金字 ≤2；全文一个主比喻 |

### 4.4 合规红线

- 不算命、不预测具体事件/日期、不下吉凶命定、不替用户做决定。  
- 不制造恐惧；不给医疗/财务/法律诊断。  
- 时机用能量节律 / life phase；禁公历年/干支纪年作铁锚。  
- 禁 astrology / divination / psychic / horoscope 字样。  
- 详见 `output-policy.ts`、`compliance-terms.ts`。

### 4.5 动态关系（本地一套 · 全产品共用）

引擎：`lib/calculations/relation-engine.ts` → `RelationLabel`。  
本命关系 / 流年引动 / 十神张力 — **一次计算，多产品共用**；模型禁止自推刑冲合害。  
叙事只挑与场景相关 1–3 条；中性化包装，禁凶灾克死。  
本命随底座；流年/定向进 **user** 侧（护缓存）。

---

## 5. 交付报告怎么写（Pivot 专章）

1. **finalize**：每段 `core_conclusion`（白话）+ `bazi_basis`（真词清单）。  
2. **narrative**：结论 → 2–4 个独立论点 `body`（`###` 起头）+ `scan`；thirty_day 另产表。  
3. **evidence**：按论点写依据；槽外禁行话；槽内 `⟦w:真词⟧`。  
4. **mark**：只改槽外连接白话；保留全部字槽 → 代码编码 `⟦t:⟧`。  
5. **组装**：正文遵守表达契约；折叠层展示金字；footer 隐私/免责按 locale。

质感目标：**正文通俗可落地；展开有硬核系统依据。**

---

## 6. 改动前自检清单

### 可见语 / 契约

- [ ] 改的是 L0 还是用户可见层？L0 勿挂「禁裸词」。  
- [ ] 是否误灌 `POJU_IDENTITY`？禁止。  
- [ ] delivery 是否误伤依据层？正文契约 ≠ 证据禁术语。  
- [ ] 新映射是否可 trace？是否带 never（防伪医疗）？

### 五段 / 喂数

- [ ] collecting 是否又宣布一主一辅？禁止（归 synthesis）。  
- [ ] Call A 是否又喂 8 页蓝图？禁止。  
- [ ] slim / full dataplane 是否与阶段匹配？  
- [ ] 静态 system 是否仍跨轮 byte 稳定？

### 闭集 / 渲染 / 合规

- [ ] 金字是否闭集 slug？落库是否过 `auditDeliveredText`？  
- [ ] 展示是否走 GlossaryText / RichReadingText？  
- [ ] 排版是否无字墙 / 无 `Bold lead:`？  
- [ ] 关系是否只用来自 relation-engine 的实例？

### 回归（常用）

```bash
pnpm test:expression-contract
pnpm test:opening-synthesis-contract
pnpm test:delivery-lint-guard
pnpm test:delivery-body-purity
pnpm test:leak-feedback
```

---

## 7. 关键代码索引

| 关注点 | 路径 |
|---|---|
| 阶段类型 / 状态 | `lib/poju/agent-state.ts`、`state-machine.ts` |
| Chat 调度 | `lib/poju/agent-phase-runner.ts` |
| v6 相位提示 | `lib/llm/phases/*-phase-v6.ts`、`oriental-prompt-context-v6.ts` |
| Segment2 | `lib/llm/deepseek/breakthrough-core.ts`、`segment2-a-parallel.ts` |
| Synthesis | `lib/llm/deepseek/synthesis-task.ts` |
| Delivery | `lib/llm/pro/delivery/*` |
| 表达契约 | `lib/llm/prompts/user-facing-expression-contract.ts` |
| 底座注入 | `lib/llm/prompts/base-analysis-context.ts` |
| 术语 / 审计 | `lib/llm/sanitize/term-marking.ts`、`compliance-terms.ts` |
| 渲染 | `components/cross-product/GlossaryText.tsx`、`RichReadingText.tsx` |

---

## 8. 非目标

- 不改为订阅制 / 多档定价。  
- 不做医疗诊断或 Biohacking 硬件宣称。  
- 不要求用户学八字；也不假装没有东方内核。  
- 不把映射表 / 打标契约灌进全阶段身份层。
