# Match v5.0 · Step 10 报告

## 自动化验证（本机可跑）

```bash
cd pojulife
pnpm exec tsc --noEmit
pnpm exec tsx scripts/test-match-v5-step1.ts
pnpm exec tsx scripts/test-match-v5-step2.ts
pnpm exec tsx scripts/test-match-v5-step3.ts
pnpm exec tsx scripts/test-match-v5-step4.ts
pnpm exec tsx scripts/test-match-v5-step5.ts
pnpm exec tsx scripts/test-match-v5-step6.ts
pnpm exec tsx scripts/test-match-v5-step7.ts
pnpm exec tsx scripts/test-match-v5-step8.ts
pnpm exec tsx scripts/test-match-v5-step9.ts
pnpm exec tsx scripts/test-match-v5-step10.ts
```

`test-match-v5-step10.ts` 汇总 Steps 1–9 的**静态连线审计**（路由、sessionStorage、API 错误码、语言检测、Archive、device_usage）。

**说明**：Step 10 不要求在无 API Key 环境跑 live DeepSeek；实机 E2E 见下表。

---

## 手动 E2E 清单（6 场景）

### 准备

| 项 | 说明 |
|----|------|
| 环境 | `pnpm dev`，浏览器无痕或清空 IndexedDB `pojulife_v4` |
| API | `OPENROUTER_API_KEY` 已配置 |
| Profiles | 至少 2 个 `stored_profiles`，且均有 **base_analysis**（准备页等待生成完成） |
| 建议 A | 1977-02-17 丑时 男 |
| 建议 B | 1985-08-15 未时 女（与 A 不同八字） |

### 场景 A — 首次免费 Match（英文关系描述）

| # | 步骤 | 预期 |
|---|------|------|
| 1 | `/match` | 介绍 + 功能卡 + 用例；CTA **免费体验 / Run a free Match** |
| 2 | 开始 → `/match/select-a` | Step 1/3、Person A；选 A |
| 3 | `/match/select-b` | Step 2/3；列表**无 A**；选或新建 B |
| 4 | `/match/relationship` | A×B 日期；≥10 字；英文示例关系描述 |
| 5 | `/match/analyzing` | 双圆动画 + 7 步文案；约 60–90s |
| 6 | `/match/result/[id]` | 契合度徽章 + 5 张可展开卡片；**全文英文** |
| 7 | Footer | View Archive / Run another Match |

**关系描述示例（英文）**  
`My business partner of 3 years. We're considering scaling but tension has built up.`

**检查 IndexedDB**  
- `device_usage` → `*_match` 行 `free_used: true`  
- `match_sessions` → 新 session  
- `archive` → `type: match_session`, `product: match`

### 场景 B — 中文输入 → 中文报告

| # | 步骤 | 预期 |
|---|------|------|
| 1 | 新无痕或新 device | 避免复用场景 A 的 session |
| 2 | 关系描述用中文 | 例：`我和未婚妻交往 3 年了,准备明年结婚,但我家里反对。` |
| 3 | 报告 | 标题/正文/契合度中文名；命理术语中文 |

### 场景 C — 已用免费 → 付费 CTA

| # | 步骤 | 预期 |
|---|------|------|
| 1 | 将 `device_usage` 中 `free_used` 设为 `true` | DevTools → Application → IndexedDB |
| 2 | 刷新 `/match` | CTA **$4.99**；点击 → `/match/payment` 占位页 |

### 场景 D — Archive

| # | 步骤 | 预期 |
|---|------|------|
| 1 | `/archive` | 筛选 **Match**；条目图标 👥 |
| 2 | 点进条目 | 关系摘要、契合度色条、Overall / A / B / Top Actions |
| 3 | View full report | 回到 `/match/result/[match_session_id]` 完整 5 段 |

### 场景 E — B 八字已保存

| # | 步骤 | 预期 |
|---|------|------|
| 1 | 场景 A 中新建的 B | 出现在 `stored_profiles` |
| 2 | POJU/Glyph/Syncro 准备页 | 列表中可选 B |

### 场景 F — 错误处理

| # | 步骤 | 预期 |
|---|------|------|
| 1 | 错误 API Key | `/match/analyzing` 显示错误 + 回 Match 重试 |
| 2 | A=B（仅调 API） | `POST /api/match/analyze` 同 profile → `400 same_profile` |
| 3 | 缺 base_analysis | `400 profile_not_ready` |

---

## DeepSeek / 成本（实机填写）

| 指标 | 参考值 |
|------|--------|
| `call_type` | `deep_analysis`, thinking high |
| `max_tokens` | 15000 |
| 单次耗时 | 约 60–90s |
| 单次成本 | 约 $1.5–2.5（视 tokens） |

在 analyzing 完成后的 Network 响应或服务器日志中记录 `meta.tokens_used`、`meta.cost_usd`。

---

## 报告 JSON 结构（校验用）

必须包含 5 个顶层段 + `_meta`：

- `analysis_a`, `analysis_b`, `combined`, `conclusion`, `recommendations`
- `conclusion.compatibility_level` ∈ 5 档
- `recommendations.actions[]` 4–6 条，含 `category` / `title` / `detail`

---

## 已知限制 / 后续

| 项 | 状态 |
|----|------|
| `/match/payment` | 占位，无真实 $4.99 结账 |
| 营销站导航 | 可能尚无 `/match` 入口（需从 URL 或首页链入） |
| 删除 B profile | 文档 P2；Archive 删条目可用 |
| Live E2E | 需人工 + API Key，本 Step 以清单 + 静态脚本为主 |

---

## Match v5.0 完成状态（Steps 1–10）

| Step | 内容 |
|------|------|
| 1 | 结构 + `match_sessions` + types |
| 2 | `/match` 入口 + device_usage |
| 3 | 选 A |
| 4 | 选 B（过滤 A、自动保存） |
| 5 | 关系自由文本 10–200 字 |
| 6 | Prompt + Service + API |
| 7 | Analyzing + session + archive 写入 |
| 8 | 卡片式报告 |
| 9 | Archive 列表/详情 |
| 10 | E2E 清单 + `test-match-v5-step10.ts` |

🛑 **用户确认 Step 10 后：Match v5.0 可软上线。**
