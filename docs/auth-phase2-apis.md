# Phase 2 改动对照清单 · 后端 API + OTP Cookie 收敛

## 新增文件
- `lib/auth/auth-helpers.ts` — email/password schema、`safeNextPath`、`siteOrigin`、错误码映射
- `lib/auth/auth-rate-limit.ts` — 登录撞库限流
- `app/api/auth/signup/route.ts`
- `app/api/auth/verify-signup/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`（POST JSON + GET redirect）
- `app/api/auth/forgot-password/route.ts`（防枚举：统一成功文案）
- `app/api/auth/update-password/route.ts`
- `app/api/auth/callback/route.ts`（OAuth `code` → Cookie → redirect）
- `app/api/auth/confirm/route.ts`（`token_hash` 邮件确认 / 重设密码）
- `scripts/test-auth-phase2-apis.ts`
- `docs/auth-phase2-apis.md` — 本清单

## 修改文件
- `app/api/auth/otp/verify/route.ts` — 改用 `createSupabaseServerClient()` 写 Cookie；仍返回 `access_token` 作过渡兼容
- `app/api/auth/otp/send/route.ts` — **未改**（仍可用）

## 新增依赖
- 无（沿用 Phase 1 的 `@supabase/ssr`）

## Supabase 控制台改动（需人工，非代码）
- Redirect URLs 加入：`/api/auth/callback`、`/api/auth/confirm`
- Confirm signup 模板用 `{{ .Token }}`（6 位码）
- Reset Password 模板指向 confirm 回跳
- Google/Apple Provider（UI 在 Phase 3）

## 环境变量
- 无新增；确认 `NEXT_PUBLIC_SITE_URL` 已填（拼 OAuth/重设 `redirectTo`）

## 冒烟结果
```bash
pnpm exec tsx scripts/test-auth-phase2-apis.ts
# → test-auth-phase2-apis: ok
```

## 回归自查（§8）
1. checkout — ✅ 未改（Phase 5 再收敛）
2. 旧 OTP — ✅ `otp/send` 保留；`otp/verify` 仍可用，已写 Cookie
3. i18n — ✅ 回跳在 `/api/auth/*`，不受 locale 重写
4. build — 以本地 `pnpm build` 为准；新路由无新增 lint 问题

## 已知风险 / 未完成
- Phase 3：登录/注册/找回密码页面与 OAuth 按钮尚未做
- 真机 OAuth / 邮件需 Dashboard §4 配好后才能端到端验证
- `forgot-password` 复用 OTP 邮箱冷却（60s）；与发 OTP 共用额度，属有意限流
- Cookie 写入依赖 Route Handler 内 `cookies().set`；需在真实浏览器里再验一次 Set-Cookie
