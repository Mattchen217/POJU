# Phase 1 改动对照清单 · Cookie 会话骨架

## 新增文件
- `lib/auth/supabase-server.ts` — `createSupabaseServerClient()` / `getServerUser()`（`await cookies()`）
- `lib/auth/supabase-browser.ts` — `createSupabaseBrowserClient()`
- `lib/auth/middleware-session.ts` — `updateSupabaseSession(request, response)`
- `scripts/test-auth-session-skeleton.ts` — Phase 1 冒烟
- `docs/auth-phase1-session-skeleton.md` — 本清单

## 修改文件
- `middleware.ts` — 由纯 `createMiddleware(routing)` 改为：先 intl，再 `updateSupabaseSession`；**matcher 未改**
- `package.json` / lockfile — 新增 `@supabase/ssr`

## 新增依赖
- `@supabase/ssr`

## Supabase 控制台改动
- 无（Phase 1 仅代码骨架）

## 环境变量
- 无新增；复用已有 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 冒烟结果
```bash
pnpm exec tsx scripts/test-auth-session-skeleton.ts
# → test-auth-session-skeleton: ok
```
- `getServerUser()` 在未配置 Supabase 时返回 `null`（不抛错）

## 回归自查（§8）
1. checkout — ✅ 未改 `app/api/checkout/create`
2. 旧 OTP — ✅ 未改 `otp/send` / `otp/verify`
3. i18n — ✅ intl middleware 仍先执行；matcher 不变
4. build — 以本地 `pnpm build` 为准（Phase 1 未引入新页面）

## 已知风险 / 未完成
- Phase 2+：密码 / OAuth / 找回密码 API 与页面尚未做
- OTP 仍是 client-token 模型；Phase 2 再收敛到 Cookie
- 中间件在 Supabase 未配置时 noop（安全降级）
- `/api/*` 不在 matcher 内，API 路由依赖各自 `createSupabaseServerClient` 读 Cookie
