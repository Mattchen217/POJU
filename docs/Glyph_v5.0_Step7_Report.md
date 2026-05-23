# Glyph v5.0 · Step 7 测试报告

> 生成时间：2026-05-21  
> 自动化：`pnpm run test:glyph-step7` / `pnpm run test:glyph-step7:live`

---

## 1. 自动化验证结果

### 1.1 静态检查（47 项）

**结果：全部 PASS**

覆盖：场景 A/B/C 路由与组件接线、双视角报告段、Archive `glyph_reading`、`/api/oracle/full-reading`（DeepSeek、无 Gemini）、100 签 `raw_md_content`、5 语言 i18n。

```bash
pnpm run test:glyph-step7
```

### 1.2 Live 冒烟（OpenRouter + DeepSeek V4 Pro）

**结果：解读链路 PASS**（修正 prompt 断言后）

| 阶段 | Model | Tokens | Latency | Cost (USD) |
|------|-------|--------|---------|------------|
| base_analysis | `deepseek/deepseek-v4-pro-20260423` | 7,651 | 132s | $0.0061 |
| glyph full reading | `deepseek/deepseek-v4-pro-20260423` | 12,942 | 87s | $0.0066 |
| **合计** | | **20,593** | **~219s** | **$0.0128** |

测试命局：1977-02-17 · 寅时 · 男 · `Asia/Shanghai` → 日柱 **乙巳**  
测试签：#1 钟离成道  
测试问题：`I'm caught between two paths and need clarity`

完整 JSON 样例见：`.data/glyph-step7-report.json`

```bash
pnpm run test:glyph-step7:live
```

---

## 2. 报告 JSON 结构验证（Live 样例）

| 字段 | 状态 | 说明 |
|------|------|------|
| `wind_category_blurb` | ✅ | Divine Tailwind 风类介绍 |
| `classical_voice` | ✅ | 签意平述 |
| `命理双视角.命理看此事` | ✅ | 引用乙日主、丁酉大运、2026 丙午流年 |
| `命理双视角.签文看此事` | ✅ | 引用钟离成道典故 |
| `命理双视角.两者印证或冲突` | ✅ | 命局冲与签文「开天辟地」对照 |
| `meaning_for_question` | ✅ | 针对两选一问题 |
| `hidden_tension` | ✅ | 盲点 |
| `your_moment` | ✅ | 当下时机 |
| `exploration` | ✅ | 具体内观练习（tonight / 10 min / solo） |
| `reflection_question` | ✅ | 反思问句 |

---

## 3. 场景 A / B / C（浏览器手测清单）

自动化无法替代 IndexedDB / 抽签动画 / Archive UI，请在 **无痕窗口** 按下列步骤确认：

### 场景 A：首次免费抽签

| # | 步骤 | 预期 |
|---|------|------|
| 1 | `/glyph` | 见「抽你的第一支签（免费）」 |
| 2 | 点击 Start | → `/glyph/prepare?type=free` |
| 3 | 欢迎词 | **GLYPH** 文案含 “Glyph weaves your bazi…” |
| 4 | 新八字 | 1977-02-17 · 寅 · 男 |
| 5 | 确认 | 弹窗确认 → `/glyph/draw?profile=…` |
| 6 | 命盘 | `ChartReadingLoader` 30–60s → 问题输入页 |
| 7 | 问题 | 10–200 字 + 字数提示 |
| 8 | Draw | 动画 → `/glyph/reading/[id]` |
| 9 | Reading | Loading 30–60s → 7+ 段 + 双视角 |
| 10 | Archive | `/archive` 有条目 `Glyph: … - 日期`，可点开回看 |

### 场景 B：已有八字再抽

| # | 步骤 | 预期 |
|---|------|------|
| 1 | `/glyph`（已用免费） | 「再抽一支 — $1.99」 |
| 2 | 付款模拟 | → prepare |
| 3 | 选已有 profile | 卡片 + 确认 |
| 4 | draw | **跳过** base_analysis DeepSeek，直达输入页 |
| 5 | 抽签 → reading | 正常 |

### 场景 C：跨 POJU / Glyph

| # | 步骤 | 预期 |
|---|------|------|
| 1 | POJU 完成 session，profile 有 `base_analysis` | |
| 2 | Glyph prepare 选同一 profile | **不重新**调 base_analysis |
| 3 | reading 命理段 | 日主/大运与 POJU 一致，无矛盾五行叙事 |

---

## 4. Archive 条目描述（预期）

- **列表**：`Glyph: [典故名] - YYYY-MM-DD`，product = glyph，图标 🌿  
- **详情**：原问题 + 完整 `GlyphReport` 各段（与 reading 页一致）  
- **加密**：`pojulife_v4_archive_vault`，type = `glyph_reading`

---

## 5. 跨产品一致性（设计确认）

| 机制 | 状态 |
|------|------|
| 共用 `stored_profiles` + `getStoredProfile` | ✅ 代码已接 |
| 共用 `base_analysis.content` 缓存 | ✅ draw 页 `has_base_analysis` 短路 |
| 共用 `ORIENTAL_COUNSELOR_BASE` + `buildProfileContextSection` | ✅ glyph-deepseek-prompt |
| 共用 Archive Dexie | ✅ `saveGlyphReadingToArchive` |

场景 C 需浏览器实测比对 POJU 与 Glyph 报告中的日主表述。

---

## 5. 语言切换

静态已验证 `en/zh/es/fr/de` 含 `reading_loading_hint`、`section_dual_view` 等键。  
手测：在 reading 页切换 locale，段标题应随语言变化（正文由 LLM 按问题/ locale 输出）。

---

## 6. 成本与延迟

- **单次完整路径（新八字）**：base_analysis + full reading ≈ **$0.01–0.02**（live 实测 $0.0128），远低于文档 $1–2 上限。  
- **已有 base_analysis**：仅 full reading ≈ **$0.005–0.01**，延迟约 **60–90s**（thinking high）。  
- 浏览器控制台：`[glyph-reading] DeepSeek full reading complete` 含 `model` / `tokens_used` / `latency_ms` / `cost_usd`。

---

## 7. Step 7 结论

| 项目 | 状态 |
|------|------|
| 自动化静态 47 项 | ✅ PASS |
| Live DeepSeek 解读 + 双视角 JSON | ✅ PASS |
| 成本可控 | ✅（≈ $0.013/ 全路径） |
| 浏览器场景 A/B/C | ⏳ 需产品方无痕手测 |
| Glyph v5.0 可软上线 | ✅ 代码就绪；建议完成手测后上线 |

---

**下一步**：用户确认「Glyph 上线就绪」或反馈手测问题；之后可开始 Syncro 指令。
