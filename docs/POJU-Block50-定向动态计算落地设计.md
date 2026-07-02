# POJU Block 50 · 定向动态计算中台 · 落地设计（基于 V6）

> 落地《升级任务书》的"完善本地计算 + 状态1后先做定向动态计算 + 结构化喂模型 + 调整输出风格"。**分步、零回归、每步可单测。**

---

## 0. V6 体检结论（先确认地基）
- opening-v6 保留 Block 47 的 conversion envelope（understanding_sufficient=true 一次出 关系结论+方向+议程+question_category+首问）✓
- Block 45 理解门在（一句话只给话题→understanding_sufficient=false）✓
- 数据面：恒定 system + `buildStructuredInstanceInventory`（神煞/十神/长生/藏干/大运）+ 神煞守卫 ✓
- **关系标签就加进这个实例清单**，与神煞同一套闭集纪律。健康，可以往上接。

---

## 1. 大好消息：关系引擎 Match 已做 80%
`lib/match/data/branch-relations.ts` 已导出：`LIU_HE`(六合)/`LIU_CHONG`(相冲)/`SAN_XING`(相刑)/`LIU_HAI`(相害)/`SAN_HE`(三合) + `analyzeAllBranchInteractions()`。**直接复用。**

**净新增（4 块）：**
| 缺口 | 做法 |
|---|---|
| 半合局（如午戌半合火、巳酉半合金） | SAN_HE 三支取任意两支 + 是否含"旺支"判半合，补进引擎 |
| 天干五合（尤其**日主**被月/时/运/年干合，如乙庚合） | 新增 `STEM_WU_HE` 表 + `isDayMasterCombined()` |
| **流年干支**（2026=丙午，现在没算） | `getCurrentLiunian(date)` 用 lunar-typescript 取当年干支 |
| 伤官见官 / 枭神夺食 | 本地十神逻辑：日主偏弱 + 流年/大运强克用神 → 打标签 |

---

## 2. 新模块：`lib/calculations/relation-engine.ts`（P0b keystone）

```ts
export type RelationLabel = {
  id: string;                      // 闭集 slug：xing_yin_si / banhe_si_you_jin / rihe_yi_geng / shangguan_jianguan
  han: string;                     // "寅巳相刑" / "巳酉半合金局" / "日主乙庚相合" / "伤官见官"
  soft: string;                    // 软翻译词（金字可见词，如 "关系里的拉扯之力"）
  source: "natal" | "dayun" | "liunian";  // 本命 / 大运引动 / 流年引动
  palaces: string[];               // 涉及的宫位：spouse(日支)/career(月时支)/self(日主)…
};

export function computeChartRelations(structured: ProfileStructured): RelationLabel[];        // 本命：四柱互动（复用 Match）
export function computeLiunianRelations(structured, liunian): RelationLabel[];                 // 流年×命局
export function detectTenGodTensions(structured, liunian): RelationLabel[];                     // 伤官见官/枭神夺食（本地十神逻辑）
```
> **确定性 + 单测**：给定盘+流年，断言输出的 RelationLabel 集合（`scripts/test-relation-engine.ts`）。控制面的东西必须可测。

---

## 3. 闭集纪律（**最高优先，不做就是把天喜幻觉在关系上重演**）

关系标签**必须**和神煞走同一套三件套：

### 3a) 进实例清单（`buildStructuredInstanceInventory` 加一行）
```
- 本盘/岁运动态关系（仅可引用下列，禁止自己推别的关系）:
  寅巳相刑(本命)、巳酉半合金局(流年引动)、日主乙庚相合(大运)、伤官见官(流年)
  （若为空 → 禁止写任何刑冲合害/伤官见官等关系词）
```

### 3b) 进守卫（`buildChatShenShaGuardBlock` → 扩成 `buildChatFactGuardBlock`）
把"只能用本盘实算神煞"扩成"只能用本盘实算的**神煞 + 关系标签**；点破失败模式："你训练里会算刑冲合害，但**这个盘只有上面这几个**，其它一律不许写、写了被拦截。"

### 3c) 软翻译（进 `term-closed-set`）
每个关系 id 配软译词 + 极性：伤官见官/相冲/相刑 → 红（需注意）；三合/半合/六合 → 绿或金。用户看到的"寅巳相刑"走 `⟦t:xing_yin_si|关系里的拉扯之力|该处白话⟧`，不裸术语。落库前 `auditDeliveredText` 门禁覆盖关系集外词。

---

## 4. 定向（question_category）+ 时机诚实处理

**定向过滤规则：**
- `relationship` → 日支(配偶宫)受冲刑合 + 财星/官星损益；
- `career` → 月支/时支 + 官杀/食伤/伤官见官；
- `wealth` → 财星 + 比劫夺财；`health/family/...` 各有侧重。

**时机的诚实处理（chicken-and-egg）：** question_category 是 conversion 那一轮模型输出的，做不到"分析前就按类过滤"而不加一次调用。解法（不加模型调用）：
- **本命关系** = 盘级、与问题无关 → 在 base_analysis 就绪时**一次算好、缓存**，喂进**每一轮**数据面（含 conversion）。集合本就小（一盘通常 2-5 条），不算"堆砌"。
- **流年引动 + 定向过滤** = 依赖 question_category → 算好后喂进**下游 collecting / delivery**（破局主交付在这里，定向最该在这儿发力）。
- conversion 那轮：用本命关系（小集合）即可，模型靠 original_question 自然聚焦；**delivery 才是定向精算的主战场**。
- 可选加强：用 original_question 关键词做一次**本地粗分类**（career/relationship），让 conversion 也能预定向——纯本地、不加调用。

**注入点：** `oriental-prompt-context-v6.ts:111` 那段实例清单拼接处，把 `computeChartRelations()` 结果并进去；下游相位把 `computeLiunianRelations()+定向过滤` 的结果作为"本盘动态关系实例"追加。**动态部分下沉到 user 侧**（保前缀缓存：本命关系随 base_analysis 恒定进 system，流年定向进 user）。

---

## 5. 输出风格调整（数据变多，必须收紧，否则堆砌）

数据种类从"神煞/十神/长生"增加到"+关系+流年引动+伤官见官"。`POJU_OUTPUT_FORMAT` / poju-base-v6 增补：

```
【数据变多后的克制铁律】
- 你现在拿到神煞 + 干支关系 + 流年引动 + 十神张力等多类事实，但【交付不是罗列事实】。
- 只挑【与本次问题最相关的 1-3 条】织进破局逻辑（定向：感情看配偶宫/财官，事业看官杀食伤）；
  其余算出来了也【不必写】——它们是你判断的底料，不是要背给用户的清单。
- 每类事实最多点 1-2 处，且必须落到"所以对这件事意味着什么 + 第一步做什么"，不做名词展览。
- 关系词一律软翻译（金字），且中性化：伤官见官→"外部约束下的对抗张力"，相冲→"两股力的正面顶撞"，
  【禁】凶/灾/克死/破败等恐惧渲染。
- 降维不变：一个论点一段、每段金字≤2、全文一个主比喻。
```

---

## 6. 分步落地（零回归，每步单独可测/可上）

| 步 | 内容 | 验收 |
|---|---|---|
| **S1** | `relation-engine.ts`：复用 Match + 补半合/五合，`computeChartRelations` | 单测：给定盘断言关系集合 |
| **S2** | `getCurrentLiunian()` + `computeLiunianRelations` | 单测：2026→丙午，断言流年×命局关系 |
| **S3** | 闭集三件套：实例清单加行 + 守卫扩容 + term-closed-set 加关系 slug/软译/极性 | 落库门禁拦截集外关系词；关系词渲染成金字 |
| **S4** | 数据面注入：本命关系进 system 数据面；流年定向进下游 user | 前缀缓存不退化（跑 v6-prefix-cache-stability 测试） |
| **S5** | `detectTenGodTensions`（伤官见官）+ 定向过滤（按 question_category） | 感情类只出配偶宫/财官相关；事业类只出官杀食伤 |
| **S6** | 输出风格增补（第5节） | 交付里关系词≤3、中性、软翻译、不罗列 |

> **建议顺序 S1→S3 先跑通"本命关系闭集化"**（最小闭环、立刻能验零幻觉），再 S2/S5 上流年与定向，最后 S6 收风格。**S3 闭集纪律不能省**——否则关系就是新的幻觉源。

---

## 7. 风险
1. **闭集是命门**：关系标签不进闭集守卫 = 天喜幻觉在关系上重演。S3 必须先于"喂给模型用"。
2. **别堆砌**：算出来 ≠ 全喂全写。定向过滤（数据层）+ 克制铁律（输出层）双管。
3. **前缀缓存**：本命关系恒定→进 system；流年/定向每轮可能变→进 user。放错位置会砸缓存（跑 S4 测试守住）。
4. **question_category 依赖**：定向准不准取决于它。V6 已在 conversion 输出它，但要确保 collecting 阶段稳定可用。

---

## 一句话
关系引擎 Match 已备 80%，真正的活是**把关系标签纳入和神煞同一套闭集纪律（S3）+ 定向过滤（S5）+ 输出克制（S6）**。先跑 S1→S3 的"本命关系闭集化"最小闭环验证零幻觉，再逐步上流年、定向、风格。地基（V6 数据面 + Match 引擎 + 神煞闭集管线）全在，这是顺势的一步，不是另起炉灶。
