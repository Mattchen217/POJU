# Delivery Lab · 逐步生成查验台

Ops-only 工具：在 easternos.com（或本地）**点按钮才调模型**，逐步验收八页交付中间产物。质量由人工关卡兜住后再把 prompt/gate 改动合回正式自动链路。

## 原则

1. **不另开生成分叉**：每步调用现有 `deep-evidence-assign` / `write` / `fill` / `mark` / thesis / prealloc。
2. **人工「通过」≠ 跳过自动 gate**：gate 未过不能点通过，只能重跑（无默认强制通过）。
3. **不进用户交付书 UI**；v1 **不**把 Lab approved 写入付费用户 shelf。
4. 正式用户自动交付链路行为不变。
5. **分步验收（活文档）**：每步 F/P 标准、踩坑与回归见 [delivery-lab-分步验收标准.md](./delivery-lab-分步验收标准.md) — 签字前过对应步卡片；新问题当日写入。

## 路径

| 面 | 路径 |
|----|------|
| 创建 | `/ops/delivery-lab` |
| 主台 | `/ops/delivery-lab/[lab_id]` |
| API | `POST /api/ops/delivery-lab/create` |
| | `GET /api/ops/delivery-lab/[lab_id]` |
| | `POST …/run` `{ stage_id }` |
| | `POST …/approve` `{ stage_id }` |
| | `POST …/rerun` `{ stage_id }`（下游标 stale） |

鉴权：Ops cookie（`OPS_USER` / `OPS_PASSWORD` / `OPS_SESSION_SECRET`）。`run` 的 `maxDuration=300`。

**P2 write（Lab）分发（2026-09-10）：** 与正式 DAG 同构——**每次「运行」只分发 1 个 write chunk**，独占 `PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS`（270s）+ 本 invoke 的 300s。前端在 `write_dispatch_continue` 时自动再 POST 下一块（仍是多次独立请求，不是一个 300s 里并行多卡）。「准备重跑」清空该页 `write_units`。禁止「并发砍超时」冒充分发。

**Mark 分发：** 同页多 arg-chunk 时每次 run 只打 1 块；`mark_dispatch_continue` 自动续跑。铁律见规则 **12**（`.cursor/rules/12-delivery-dispatch-one-call.mdc`）。

## 步骤游标（固定顺序）

`bootstrap` → `thesis.gen` → `prealloc` → Wave A（foundation / science_action / metaphysics_action 各 assign→write→write_merge→fill→mark）→ `direct_answer.fill` → Wave B（risk_guard / signals_close 同上）→ `book.assemble`。

未通过上一步时下一步按钮禁用。重跑某步会把下游 approved 标为 stale。

## 代码

- `lib/llm/pro/delivery/lab/` — types / store(KV 48h) / build-context / run-step / public-view
- `app/ops/delivery-lab/` — UI
- `app/api/ops/delivery-lab/` — API

## 怎么测（人工）

1. 配 `OPS_*`，部署含 Lab 的 build（或本地 `pnpm dev` + 内存 KV）。
2. `/ops` 登录 → `/ops/delivery-lab`
3. **推荐**：同一浏览器域名下用「从本机导入」选本地会话 → 自动填问题 / 期望 / agenda / core / base_analysis → 再点 **创建 Lab**。也可只选本地盘，或手贴 JSON。（Never Stored：服务端按 session_id 拉不到八字。）
4. 点 `Bootstrap` → 看详情 → **本步通过**。
5. 依次 `Thesis` / `Prealloc` / P2 assign…；LLM 步会等较久。
6. 故意用坏 case 跑到 P4 fill：确认 gate 失败时「通过」灰掉，只能改代码后「准备重跑」再跑。
7. 确认：未点「通过」时下一步不可点；未点「运行」时 OpenRouter 无该步请求。

## 自动化 smoke

```bash
pnpm exec tsx scripts/test-delivery-lab.ts
```

覆盖：游标锁定、bootstrap/thesis/prealloc 无 LLM 路径、gate 未过不可 approve、rerun 标 stale。不调用 OpenRouter。

## 导入清洗（只留交付真链路）

导入 / `POST …/create` 会 `sanitizeLabDeliverySource`：

- **base_analysis**：只保留 `structured`（及若有 `metaphysics_pack`）；剔除 `display_text` / `content` 等旧个人能量长文。
- **breakthrough_core**：保留交付 feed 用的脊柱字段；剔除仅对话用的 `response` / `first_question`。
- **covered_agenda**：收集期 covered 问答（进交付）。

`breakthrough_core` 来自 Segment2 Call A（第2段破局核），**会进**正式交付 P2–P6。
