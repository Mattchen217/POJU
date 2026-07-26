# 📦 Task 5 · The Archive + 支付 + 邮件 + AI 真实对接

> 预计耗时：AI 输出 2-3 次，你验证 2-4 天

## 目标

收尾所有剩余功能：个人档案馆、Stripe 支付、Resend 邮件、Puppeteer PDF 生成、Claude API 真实对接（替换所有 mock）。

## 交付范围

### 1. The Archive 页面（`/archive`）

按主文档 07.7 完整实现：

- 顶部提示：`Everything here lives only on this device.`
- 四个筛选标签：`[All] [POJU] [Syncro] [Oracle]`
- 条目列表（按时间倒序，日期 + 首问题前 6 字脱敏）
- 每个条目操作：
  - POJU：Resume / Archive / Wipe / Rename / Hide
  - Oracle：View 全屏卡片 / Delete / Rename
  - Syncro：View 历史快照 / Re-read now（重新调 AI）/ Delete
- 3 签联动以"组合条目"形式展示
- 底部：`[ Wipe everything ]` 按钮（打字确认 "WIPE"）
- 空状态：`Nothing here yet. [Ask your question →] [Receive a sign →]`

### 2. Stripe 支付集成

按主文档 08.1 实现：

**前端**：
- 所有 `$9.99` CTA 按钮 → Stripe Checkout
- metadata 追踪来源（landing_hero / landing_products / poju_page_top / oracle_hook / syncro_hook 等）
- 自动启用 Apple Pay / Google Pay

**后端 API Routes**：
- `app/api/payment/checkout/route.ts` · 创建 Checkout Session
- `app/api/payment/webhook/route.ts` · 处理 Stripe webhook 签名验证
- `app/api/payment/exchange-token/route.ts` · 前端换取 Session Token

**Provider 抽象**（按主文档 05.6.1）：
- `lib/payment/provider-interface.ts`
- `lib/payment/stripe-provider.ts`
- `lib/payment/paddle-provider.ts`（占位，便于切换）

**数据库**：
- `payment_records` 表（只存哈希化 token + Stripe session ID + 金额）
- 不存任何用户可识别信息

**保护机制**：
- Token 首次消费后转为 Session ID
- 支付成功但 webhook 丢失的 fallback 轮询
- AI 首次调用失败时 Session 保持有效

### 3. Resend 邮件系统

按主文档 08.2：

- `lib/email/send-pdf.ts` · 立即发送 PDF 报告
- `lib/email/schedule-checkin.ts` · 调用 Resend Scheduled Send API
- `app/api/unsubscribe/route.ts` · 一键退订
- `app/api/cron/cleanup-emails/route.ts` · 每小时清理（发送后 24h 物理删除邮箱字段）

邮件模板（`lib/email/templates/`）：
- `pdf_report.html`
- `check_in.html`
- `unsubscribed.html`（退订确认页）

### 4. PDF 生成

按主文档 02.6：

- `app/api/pdf/generate/route.ts` · Puppeteer 服务端渲染
- POJU 破局报告模板（封面 / 困局全貌 / 信息档案 / 破局分析 / 破解之道 / 回访页 / 封底）
- 嵌入思源宋体 + EB Garamond 字体
- 生成后保存临时 URL，通过邮件附件发送

### 5. PDF 导出触发点（Chat 页面）

Task 2 占位的 `Save this reading as PDF` 按钮在本 Task 接入：

按主文档 02.5.4 的邮箱输入面板：

```
Where should we send it?

[ your.email@example.com ]

Also, this:
Your actions need time to settle. I'd like to send you
ONE check-in email on [Apr 30]. That's it. No marketing.
Deleted after sending.

[ Send me both ]
[ Just the PDF, no check-in ]
```

Session 最多导出 5 次 PDF，超过提示"You've saved this 5 times. Ready to close this chapter?"

### 6. Claude API 真实对接（替换所有 Mock）

**替换**：
- `lib/ai/mock-poju.ts` → `lib/ai/orchestrator.ts`（按主文档 05.2.2 的 Agent Orchestrator）
- `lib/ai/mock-syncro.ts` → 真实 Claude Sonnet 4.5 调用
- `lib/ai/mock-oracle.ts` → 真实 Claude Sonnet 4.5 调用

**实现**：
- System Prompts 三套（主文档附录 A）
- 流式输出（Vercel AI SDK）
- Extended Thinking → 思考内容样式化（`lib/ai/thinking-styler.ts`）
- 话题漂移轻量检测（Haiku）
- 错误降级链（Sonnet → 重试 → Opus 兜底 → 友好错误）

**RAG 检索**（按主文档 05.3）：
- Supabase + pgvector 连接
- `lib/rag/search.ts` hybrid search
- `lib/rag/embed.ts` 用 OpenAI embedding
- 知识库 Schema 初始化 migration
- **本 Task 只接入空知识库**（内容填充由独立内容工作包完成）

### 7. 八字计算服务

按主文档 05.8：
- `lib/bazi/calculate.ts` 使用 `lunar-javascript` 库
- 12 时辰段映射表
- 真太阳时修正（简化版，用经度近似）

### 8. 监控 Dashboard（简单版）

- `app/api/admin/stats/route.ts` · 基础统计
- 每日 AI 调用数、成功率、付费数、每 session 平均时长
- 只开放给一个受密码保护的 `/admin` 页面（简单 HTTP Basic Auth）

### 9. SMS 服务（可选）

用 Twilio 实现 Syncro PC 端的 "Text me the link" 功能：
- `app/api/sms/send-link/route.ts`
- 仅发送一次，不存手机号

### 10. Sentry 错误监控

- 接入 Sentry SDK
- 过滤掉所有包含用户对话内容的错误数据
- 设置合理的采样率

### 11. Cron 定时任务

Vercel Cron 配置：
- 每小时：清理过期邮箱（`/api/cron/cleanup-emails`）
- 每天凌晨 3 点：清理 365 天无活动的 device_fingerprints（`/api/cron/cleanup-fingerprints`）

### 12. 环境变量与生产部署

创建 `.env.example` 列出所有需要的环境变量。
创建 `vercel.json` 配置 functions 超时、regions、crons。

## 验证标准

- [ ] 落地页 `$9.99` CTA → Stripe Checkout 正常弹出
- [ ] 测试支付成功 → 正确跳转 `/chat` 且 token 换取正常
- [ ] Chat 真实 Claude API 调用成功，思考 + 回复都符合主文档规范
- [ ] Syncro 真实 API 调用返回符合主文档 03.5.4 的 JSON 结构
- [ ] Oracle 真实 API 调用返回签解读
- [ ] 话题漂移时 AI 在回复中温柔拉回（观察多轮对话）
- [ ] End & Wipe 时弹出邮箱填写 → 填邮箱 → PDF 收到 → 24 小时后 Supabase 里邮箱字段确实被清空
- [ ] 定时回访邮件在计算日发送
- [ ] 退订链接有效
- [ ] Archive 所有筛选、操作、Wipe Everything 都工作
- [ ] Admin dashboard 能看到基础数据
- [ ] Sentry 能收到错误但不含对话内容
- [ ] Lighthouse PWA 检查全绿
- [ ] 生产环境（Vercel preview）E2E 流程通过

## 本 Task 不做的

- 知识库内容填充（独立工作包，见主文档附录 B）
- 100 签英文本土化（独立工作包）
- 律师法律文档起草（独立工作包）
- 商标注册跟进（独立工作包）

---

# 🏁 MVP 完成标准

全部 5 个 Task 验证通过后：

1. 一个完整的 PWA 在 `easternos.com` 运行
2. 访问者首次弹出免责协议，勾选后可进入
3. 落地页展示完整品牌叙事
4. 用户可 $9.99 付费进入 POJU Chat，与真实 AI 完成深度破局对话
5. 用户可在移动端体验完整 Syncro 粒子球 + AR + 精准拍照
6. 用户可在 PC/移动端完成 Oracle 抽签 + 得到神秘卡片
7. 付费用户可在 POJU Chat 中召唤 Syncro / Oracle 内嵌面板
8. 用户可导出 PDF 报告并在计算日收到 check-in 邮件
9. 所有用户数据本地加密存储，服务端零对话内容
10. 三条 Non-Negotiables 全部坚守

**然后**你可以开始面向 Product Hunt / Reddit / TikTok 的软启动。