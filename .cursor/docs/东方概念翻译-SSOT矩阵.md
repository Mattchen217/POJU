# 东方概念翻译 SSOT 矩阵

> 代码孪生：`lib/glossary/wuxing-semantic-ssot.ts`（已完成）· `shensha-semantic-ssot.ts` · `tengod-semantic-ssot.ts` · `dayun-semantic-ssot.ts`  
> 与真算同级的**静态语义层**：人人相同；prompt **按盘切片**；validator **读全表**。不对用户直出全文。

## 目的

- 统一「真算实体 → 现代心理/行为底纸」的翻译口径  
- 防火墙：恐吓宿命、吉凶套话、年份事件铁口、五行物化  

**不**替代闭集（`term-closed-set.ts`）与 glossary 软译展示。

---

## 真算不止「五行+十神+神煞+大运」

引擎本地真算（L0）比对话里常提的四族更宽。SSOT 矩阵**不**等于「给每个真算字段写百科」，但规划时必须认清全貌。

### A. 盘面核心（`ProfileStructured` / shunshi）

| 族 | 来源 | 闭集/形态 | 语义 SSOT 优先级 |
|---|---|---|---|
| 日主 / 干支四柱 | structured | 天干地支闭集 | 低（禁报幕即可，不做人格百科） |
| 藏干 | pillars_detail | 干支 | 低 |
| 五行强弱分值 | 五行分值 / element_scores | 五行 5 | **已做** wuxing-semantic-ssot |
| 身强弱 | strength | 身强/弱/平衡 | 可并入十神/用忌表达，暂不单开 |
| 十神（每柱） | pillars_detail.ten_god | 10 | **Phase3** tengod-semantic-ssot |
| 十二长生 | life_stage | 12 | 低（无同等翻车证据前不做） |
| 神煞 24 | pillars_detail.shen_sha | CLOSED_SHEN_SHA | **Phase1** shensha-semantic-ssot |
| 用神/喜神/忌神 | yongshen-heuristic | 结构性概念 | 与五行/十神联动；不单开「用神百科」 |
| 格局（启发式） | pattern-heuristic | 格局字 | 低；禁格局恐吓套话可并入十神黑名单 |
| 大运序列 | da_yun | 大运 | **Phase2** dayun-semantic-ssot（含流年政策） |

### B. 关系与时间引动（relation-engine）

| 族 | 说明 | SSOT |
|---|---|---|
| 本命冲刑合害 / 六合三合半合 / 天干合 | 只许引擎实例 | **Follow-up**：关系机制短表（张力≠灾难），非本期 |
| 大运/流年/流月/流日引动 | source 分 natal/dayun/liunian… | 并入大运节奏+禁预言 |
| 十神张力（如伤官见官） | 闭集张力 slug | 并入十神 SSOT 黑名单/转译 |

### C. 实操包（`metaphysics_pack`）

方位拟合、有利时辰、色彩锚、贵人方向、行业属性、dashboard 分 — **真算派生**，用户手段层已由五行 SSOT + P4 闸约束；不必再为「北/色」单独建本体 SSOT。

### D. 明确不算 / 禁喂

`OUT_OF_SET_FORBIDDEN_HAN`（空亡、丧门、五鬼等恐吓神煞）— **永不进真算喂数**；神煞 SSOT 红线可引用同类恐吓句作黑名单，但不「定义」这些集外神煞。

### E. 模型骨架 ≠ 真算

`BreakthroughCore` / multi_dimension_reckoning 是 **LLM 解释层**，下游应锚 structured，本身不是第二套真算。

**本期 SSOT 只开三期：神煞 → 大运(+流年政策) → 十神。** 关系引擎、长生、格局列为 follow-up，有翻车证据再开。

---

## 原则（相对五行）

五行 SSOT 解决的是 **补泻物化 → 行动落点**。  
本矩阵解决的是 **恐吓/吉凶/事件预言 → 现代心理·行为底纸**。形态必须不同。

| 族 | SSOT 形态 | 不做 |
|---|---|---|
| 神煞 | **安全红线 + 张力/特质转译** | 纯正面鸡汤；另造闭集 |
| 十神 | **动力/负荷词典** | 固定人格星盘；吉凶判词 |
| 大运 | **阶段节奏政策** | 年份发财/结婚铁口 |
| 五行 | 已完成：能量调谐+行动 | — |
| 关系/长生等 | 暂缓 | 无证据前不造百科 |

**共用纪律**：方向短语非范文；按盘切片；Validator 读全表；不进身份层；不替代 `term-closed-set.ts`。

---

## 各族字段规范

### 神煞（`shensha-semantic-ssot.ts`）

| 字段 | 含义 |
|---|---|
| `id` | = `CLOSED_SHEN_SHA` |
| `frame` | 机制含张力/代价 |
| `user_facing_direction` | 用户向方向语（非鸡汤） |
| `load_or_edge` | 边界/负荷 |
| `forbidden_claims[]` | 恐吓/宿命句 |
| `never` | 一句话红线 |

接线：`shen-sha-guard.ts` → `formatShenshaSemanticForPrompt(本盘实例)`；校验 → `textHitsShenshaHorror` → delivery purity。

### 十神（`tengod-semantic-ssot.ts`）

| 字段 | 含义 |
|---|---|
| `drive` | 动力 |
| `load` | 负荷 |
| `forbidden_ji_xiong[]` | 吉凶套话 |
| `whitelist_anchors[]` | 可落白话锚 |

接线：表达契约 synthesis/delivery 政策切片；交付 spine 按盘抽取十神名 → `formatTenGodSemanticForPrompt`；校验 → `textHitsTenGodJiXiong`。

### 大运（`dayun-semantic-ssot.ts`）

| 字段 | 含义 |
|---|---|
| 阶段 `theme` / `pace` | 冲/藏/守节奏 |
| `polarity_hints` | 用忌/十神极性提示（选相） |
| `DAYUN_FORBIDDEN_PROPHECY` | 年份事件铁口黑名单 |

接线：P4 fill / metaphysics_action / thirty_day spine → `formatDayunSemanticForPrompt`；表达契约 synthesis/delivery；校验 → `textHitsDayunProphecy`。

---

## 双消费

| 侧 | API |
|---|---|
| 生成 | `format*ForPrompt(本盘相关 id / hint)` |
| 校验 | `textHits*` → `delivery-body-purity` |

## 明确不做

长生/纳音全套；神煞纯鸡汤；身份层灌矩阵；关系 SSOT（直至有翻车证据）。
