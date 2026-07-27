# Phase 5 改动对照清单 · 账户区 + 登出 + Checkout Cookie 收敛

## 新增文件
- `lib/auth/use-auth-user.ts` — 浏览器 Cookie 会话读 user / logout
- `scripts/test-auth-phase5-account-checkout.ts`
- `docs/auth-phase5-account-checkout.md` — 本清单

## 修改文件
- `components/workspace/WorkspaceSidebar.tsx` — chip 显示邮箱；未登录跳 `/login`
- `components/workspace/panels/ProfilePanel.tsx` — 登录态邮箱 / 登出 / 改密；未登录 CTA
- `app/api/checkout/create/route.ts` — **`getServerUser()` 取身份**；有 session 时忽略 body 的 user_id/email
- `messages/en.json` / `messages/zh.json` — `workspace.profile.*` 文案
- `public/v2-landing.html`、`docs/visual-reference/v2-workspace-landing.html`、`d:/POJU/v2落地页.html` — checkout 只传 intent + `credentials: 'same-origin'`

## 行为摘要
| 场景 | 行为 |
|------|------|
| 已登录 | 侧栏 chip 显示邮箱；点开 Profile → 登出 / 改密 |
| 未登录 | chip 显示「Log in」→ `/login`；Profile 有登录/注册 CTA |
| Checkout | Cookie user；未登录且 Supabase 已配 → `401 unauthorized`；未配 Supabase → 本地 mock |

## 冒烟结果
```bash
pnpm exec tsx scripts/test-auth-phase5-account-checkout.ts
# → test-auth-phase5-account-checkout: ok
```

## 人工浏览器清单
1. 登录后打开 `/app` → 侧栏显示真实邮箱
2. Profile → Log out → chip 回到 Log in
3. V2 定价购买 → OTP 验证后 checkout 不再传 `user_id`/`access_token`，仍能进 Stripe/mock
4. 未登录直接打 `POST /api/checkout/create`（已配 Supabase）→ 401

## 已知风险 / 未完成
- Phase 6：中间件路由守卫 → 见 `docs/auth-phase6-route-guard.md`
- es/de/fr 顶层尚无完整 `workspace.*`（既有问题）；本阶段只补 en/zh profile 文案
- webhook → `increment_user_passes` 仍依赖 Stripe metadata `user_id`（现由服务端 session 写入）
