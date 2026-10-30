# Phase 9 · 紫微术语完整性盘点

**状态**：盘点 + A 类草案 + 完整性测试（**不**写入正式 `POJU_TERMS`）  
**引擎**：`iztro@2.6.3`（`package.json`）· 结构包 `lib/ziwei/fact-pack.ts` · 格局 `ziwei-doushu@ff9a147`  
**机器快照**：`terms-phase9-ziwei-inventory.json`（`scripts/phase9-ziwei-term-inventory.ts`）  
**验收口径**：当前 14 条 ziwei SSOT = **结构抽象层**；宫名/星曜/五行局值/格局名 **尚未**构成完整用户可见术语体系。

---

## 0. 结论摘要

| 层 | 数量（12 盘抽样） | SSOT | Disposition | 用户可见路径 |
|---|---|---|---|---|
| 结构标签（命宫/对宫/十二宫/四化·禄权科忌/大限/流年/命主/身主/身宫/五行局） | 14 | ✅ 已映射 | public via resolve | Baseline 镜片 / 闭集 prompt / 陪伴锚 |
| 十二宫具体名 | 12（含 **仆役**，非交友） | 仅 命宫 | 余 11 = `internal_only` | 镜片尝试展示 → 现为 `—` |
| 十四主星（`palaces.majorStars`） | 14 | ❌ | `internal_only` | 镜片尝试展示 → `—` |
| 命主/身主实际星（含辅星） | 12 种观测值（含 **火星/禄存/文昌/文曲**） | ❌ | `internal_only`（Phase 9 补登记 火星） | 镜片 value 槽 |
| 四化落点星 | 15（主星 + 文昌/文曲/左辅/右弼） | 仅 mutagen 禄权科忌 | 星 = `internal_only` | 镜片四向行（星空则省略） |
| 五行局具体配置 | 5（水二…火六） | 仅标签「五行局」 | 值 = `internal_only` | 镜片 value → `—` |
| patternHits 名 | 23（本批）/ 规则库更多 | ❌ | 未进 disposition 表 → display 只出 **count** | 用户层禁名；**LLM judgment / pageSliceAnchor 仍灌原名** |
| iztro 辅星·杂曜·长生等 | minor 14 + adjective 38 + 十二长生/博士等 | ❌ | 多数 **不进 FactPack 投影** | 默认 B |

**产品必要范围（非机械全造）**：先保证 **Baseline 镜片 + 陪伴锚 + 闭集软标签** 上「已尝试展示」的槽有自造词；杂曜/格局名/博士十二等 **不**在本阶段公开造词。

---

## 1. 引擎与 FactPack 字段（真源）

### 1.1 iztro 盘面（未全部投影）

Chart 级：`soul` `body` `fiveElementsClass` `earthlyBranchOfSoulPalace` `earthlyBranchOfBodyPalace` `palaces` `horoscope` `decadalList` `yearlyList` `monthlyList` …  
Palace 级：`name` `heavenlyStem` `earthlyBranch` `majorStars` `minorStars` `adjectiveStars` `boshi12` `changsheng12` `jiangqian12` `suiqian12` `decadal` `ages` …

### 1.2 `buildZiweiFactPack` 实际写入

| ZFP / 字段 | 内容 | 进 slice？ |
|---|---|---|
| `topicPalace` | 命宫名、干支、主星、对宫名与主星 | 按页 allowlist |
| `sihua` | 本命四化：mutagen×star×palace（扫 major+**minor** mutagen） | 是 |
| `daxian` | 大限宫、干支、年龄窗、主星、大限四化；嵌 `liunian` | 是 |
| `mingShen` | soul/body、命/身支、身宫名、`fiveElementsClass` | 部分页 |
| `patternHits` | doushu 闭集名/level/palaces… **无 description** | 是 |
| `palaces[]` | 十二宫索引（主星 only，无 minor/adjective） | **不进** page slice |
| `otherChart` | 恒 `null` | 键保留 |
| `source` | iztro 版本 / clock / asOf… | 不进 slice |

---

## 2. 分类整理（八类）

### 2.1 十二宫具体名称

`命宫 兄弟 夫妻 子女 财帛 疾厄 迁移 仆役 官禄 田宅 福德 父母`  
Runtime 锁 **仆役**（禁止静默改成交友）。

### 2.2 十四主星

`紫微 天机 太阳 武曲 天同 廉贞 天府 太阴 贪狼 巨门 天相 天梁 七杀 破军`  
全部进入 `majorStars` 投影。

### 2.3 辅助星（进入 FactPack 值槽）

经 soul/body 或四化观测：`文昌 文曲 左辅 右弼 禄存 火星`（及规则依赖的魁钺/羊陀等仅在格局/引擎层）。

### 2.4 杂曜及其他星曜（引擎有、FactPack 宫索引不投影）

- `minorStars` 抽样：天马、火星、铃星、地空、地劫、擎羊、陀罗、天钺、天魁…  
- `adjectiveStars` 抽样约 38：解神、三台、天寿、天巫、天厨…  
- `boshi12` / `changsheng12` / `jiangqian12` / `suiqian12`：博士十二、长生十二等。

### 2.5 四化及落点

- 标签：四化 / 化禄·权·科·忌（及别名 禄权科忌）→ **已 SSOT**  
- 落点：`{ mutagen, star, palace }` × 本命 / 大限 / 流年  
- 流年/大限四化星序来自 `horoscope.*.mutagen`

### 2.6 大限、流年及相关周期

- FactPack：`daxian.{palace,stem,branch,startAge,endAge,majorStars,sihua,liunian}`  
- 标签大限/流年 → **已 SSOT**  
- iztro 另有月/日/时限、`agePalace` — **未进** FactPack

### 2.7 五行局及配置

- 标签「五行局」→ SSOT  
- 值：`水二局 木三局 金四局 土五局 火六局` → disposition `internal_only`

### 2.8 其他进入链路字段

| 字段 | FactPack | Prompt | 报告/PDF/提醒 | 说明 |
|---|---|---|---|---|
| 干支（宫/限） | ✅ | 常以字面进闭集/切片 | 日历码，走既有干支闭集 | 非 ziwei 自造词义务 |
| `patternHits[].name` | ✅ | **judgment / slice 锚原名** | 用户 display 仅 count；若 LLM 写入 `ziwei_slice` 须靠出口 sanitize | 已知张力 |
| `formatZiweiClosedSetForPrompt` | display 投影 | ✅ | 间接 | 软标签 only |
| `ziweiCompanionTriggerAnchors` | display | — | 提醒侧锚 | 周期软标 + 年 + count |
| `baselineZiweiLensLines` | display | — | **UI 第二镜片** | 用户可见主路径 |
| `pageSliceAnchorLines` ZFP | display 软标 | fill 锚 | 软标 + `结构格局×N` | Phase 9 已去掉宫星格原名 |

---

## 3. 字段矩阵（摘要）

完整机器表见 JSON `matrix[]`。列含义：

- **原始内部名称** · **ns=`ziwei`**（干支另 ns 日历）  
- **进 FactPack** / **进 Prompt** / **进报告·PDF·提醒**  
- **disposition**：`public_glossary` | `internal_only:*` | `unknown_blocked`  
- **正式 SSOT**：仅 14 结构条  
- **未映射处理**：display `blocked` → 标签空/`—`；**禁止** traditional fallback

| 类别 | 代表 token | FactPack | Prompt | 用户出口 | disposition | SSOT | 需自造？ | 未映射处理 |
|---|---|---|---|---|---|---|---|---|
| 结构标签 | 命宫/四化/大限… | 键语义 | 软标 | 软标 | resolve | ✅ | 否（已有） | — |
| 宫名 | 迁移/仆役… | ✅ | 软或空 | 镜片 — | internal_only | 命宫除外 | **A1** | block |
| 主星 | 紫微… | ✅ | 软或空 | 镜片 — | internal_only | ❌ | **A2 条件** | block |
| 辅星值 | 文昌/火星… | soul/sihua | 软或空 | 镜片 — | internal_only | ❌ | **A2 条件** | block |
| 四化方向 | 禄权科忌 | ✅ | 软标 | 软标 | resolve | ✅ | 否 | — |
| 五行局值 | 木三局… | ✅ | 软或空 | 镜片 — | internal_only | ❌ | **A1** | block |
| 格局名 | 杀破狼… | ✅ | **原名灌模型** | 禁直接展示 | 无表（count only） | ❌ | 否公开；**C/B** | 禁用户层 |
| 杂曜引擎 | 解神… | ❌（宫索引） | 默认不 | 不 | — | ❌ | 否 | 不投影 |
| 长生/博士等 | 长生… | ❌ | 不 | 不 | — | ❌ | 否 | 不投影 |

---

## 4. A / B / C 三分

### A · 必须有用户可见自造词（按真实路径收窄）

**A1 — 立即必要（镜片已挂行，值现为 —）**

1. 十一宫具体名（除已映射命宫）  
2. 五行局五值：水二局…火六局  

**A2 — 条件必要（仅当产品继续在 Baseline 展示「星曜值」；否则改 UI 隐藏值槽并降为 B）**

1. 十四主星  
2. 已观测进入 soul/body/sihua 的辅星：文昌、文曲、左辅、右弼、禄存、火星  

**不做 A（本阶段）**：全部 adjective 杂曜、博士/长生/将前/岁前、月日时限、格局正式名公开表。

### B · 只保留内部计算

- `palaces[]` 全量索引、`source.*`、`patternHits` 结构字段（level/palaces/required…）  
- iztro minor/adjective/boshi/changsheng/jiangqian/suiqian  
- horoscope monthly/daily/hourly、decadalList 全文  
- Lab 指纹 / hash / 未过 display 的 raw ZFP  

用户层：`patternHitCount` 数字即可；名称留内部。

### C · 禁止公开或需特殊合规

| 项 | 原因 | 处理 |
|---|---|---|
| `patternHits[].name` 古典格名 | 强命理专名；易进报告正文 | 用户禁出；prompt 侧逐步改为 id/软类；`pageSliceAnchorLines` 禁止拼原名 |
| 双 ns 撞车（如 **七杀** bazi vs ziwei；**流年**；**文昌** 神煞 vs 星） | 错 ns soft-map / 误删 | 出口必须 `namespace: "ziwei"`；禁止无 ns 传统 fallback |
| 恐吓/定命表述 | 红线 | 既有 scare / forbidden 管线 |
| iztro `copyright` 等字符串 | 许可展示非术语 | 永不进用户文案 |

---

## 5. A 类五语草案

见独立草案：`terms-phase9-ziwei-coined-draft.md`（**非正式 SSOT**）。

---

## 6. 完整性测试

脚本：`scripts/test-ziwei-term-completeness-phase9.ts`  
命令：`pnpm test:ziwei-term-completeness`

断言：

1. 抽样盘 `collectZiweiTraditionalSuspects` 中每个 Han token：要么 ziwei SSOT resolve，要么 disposition ∈ `{internal_only, public_glossary}` — **禁止**裸 `unknown_blocked` 漏登。  
2. `buildZiweiDisplayFactPack` → `ziweiDisplayContainsTraditionalLeak` 为空。  
3. `baselineZiweiLensLines` / `formatZiweiClosedSetForPrompt` / `ziweiCompanionTriggerAnchors` 文本 **不含** 未映射传统宫星格名整词（允许已 SSOT 软标签与干支）。  
4. `pageSliceAnchorLines` 不得含 `patternHits.name` / 宫星原名（Phase 9 已改为 soft / count）。  
5. **仍属内部债务**：`book-judgment` 等仍可能把格局原名灌入 **LLM prompt**（非用户出口）；升 A2 / 格局软类前保持 C/B，勿当用户文案。

---

## 7. 非本阶段

- 不向 `POJU_TERMS` merge A 草案  
- 不改 Phase 8 soft-name hold 策略  
- 格局公开软名 / 杂曜百科 → 另立 Phase（产品确认 A2 后再开）

---

## 8. 下一步建议（Phase 10 候选）

1. 合并 **A1** 草案入 SSOT + disposition → `public_glossary`  
2. 产品二选一：**展示星值（上 A2）** 或 **镜片隐藏星值槽（A2→B）**  
3. judgment feed：格局改 `hit_id` 或软类（用户锚已净；模型侧仍待）  
4. 双 ns 七杀/文昌：ziwei 星名上架后做 ns 回归（承接 P1 出口逻辑）
