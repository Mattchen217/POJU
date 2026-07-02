# 指令 8 · base_analysis 本命关系锚定对照

> 付费后完整中立元报告（`base_analysis`）把「系统脆弱点 / 核心底色」锚到**本命结构关系**；流年/动态留给下游。验收：`pnpm exec tsx scripts/test-base-analysis-natal-relations.ts`

---

## 改动对照

| 文件 | 改动 |
|---|---|
| `lib/calculations/relation-engine.ts` | 新增 `computeNatalChartRelations()` — 过滤 `source==="natal"` |
| `lib/base-analysis/build-structured-instance-inventory.ts` | `forBaseAnalysis: true` → 清单行改为【本命结构关系】+ 忽略流年提示 |
| `lib/llm/prompts/base-analysis-stream-prompt.ts` | 四维（核心底色/系统脆弱点）追加锚定纪律 + binding §14 + few-shot 范例 |
| `lib/base-analysis/delivery-gate.ts` | 落库审计 allowlist = `computeNatalChartRelations`（禁流年 marker） |

**未动：** 付费前八字 teaser 列表、下游 POJU/Glyph/Syncro/Match 的流年注入。

---

## 纪律摘要

- **只本命**：实例清单 + 审计 allowlist 均 `source=natal`
- **最多一处**：织进「核心底色」或「系统脆弱点」，禁枚举
- **软翻译 + 中性**：`⟦t:<relation_slug>|软译|白话⟧`
- **无关系不硬塞**：清单为空则四维照旧，不写关系词

---

## 样例对比

### 盘 A · 有本命关系（年子 × 月午 · 子午相冲）

**系统脆弱点（片段 · 合规）**

> **结构张力:** 配置里有一处 ⟦t:chong_午_子|两股力的正面顶撞|年月两支在结构上互相顶撞，决策口径容易变窄⟧——把它理解为散热缺口，需要外部节律补位，而不是「注定冲突」。

- ✓ 锚到引擎算出的本命关系
- ✓ 一处、中性、金字
- ✗ 不写「你有子午相冲、还有……」

---

### 盘 B · 无本命关系（酉金齐局类 · 引擎未算出刑冲合害）

**系统脆弱点（片段 · 合规）**

> **结构短板:** 金元素规则网格偏强，而水元素冷却模块偏弱 → 决策窗口缩短，易在信息未齐时提前锁定。

- ✓ 不硬塞关系词
- ✓ 仍用五行/用神/忌神机制描述
- ✗ 禁止编造「寅巳相刑」等集外词

---

## 验收清单

- [ ] `test-base-analysis-natal-relations.ts`
- [ ] 有关系的盘：脆弱点/底色能锚结构张力
- [ ] 无关系的盘：不硬塞
- [ ] 正文无流年/动态关系 marker
- [ ] 同 profile 两次 `buildBaseAnalysisStreamPrompt` → system SHA256 一致
- [ ] 集外关系词仍被 `relation_*` 拦截
