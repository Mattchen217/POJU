# Phase 6 改动对照清单 · 中间件路由保护

## 新增文件
- `lib/auth/middleware-guard.ts` — `isAuthProtectedPath` / `applyAuthRouteGuard`
- `scripts/test-auth-phase6-route-guard.ts`
- `docs/auth-phase6-route-guard.md` — 本清单

## 修改文件
- `middleware.ts` — intl → session refresh → **auth guard**
- `lib/auth/middleware-session.ts` — 返回 `{ response, user }`（供门禁用）
- `.env.example` — `AUTH_ROUTE_GUARD`（设为 `0` 可关闭门禁）

## 受保护路由（窄口径）
| 路径（去 locale） | 未登录 |
|-------------------|--------|
| `/app`、`/app/*` | 302 → `/login?next=/app…`（带 locale 前缀时为 `/zh/login?next=…`） |
| `/poju/session/*` | 同上 |

**公开**：`/`、营销页、`/login`/`/signup`、法务/contact、`/v2-landing` 等。

## 降级 / 开关
- Supabase **未配置** → 门禁 noop（本地无 env 可进 `/app`）
- `AUTH_ROUTE_GUARD=0` → 强制关闭门禁（紧急逃生）

## 冒烟结果
```bash
pnpm exec tsx scripts/test-auth-phase6-route-guard.ts
# → test-auth-phase6-route-guard: ok
```

## 人工浏览器清单
1. 未登录打开 `/app` → 跳到 `/login?next=/app`（已配 Supabase 时）
2. 登录后应回到 `/app`
3. `/`、`/poju`、`/contact` 仍可匿名访问
4. `AUTH_ROUTE_GUARD=0` 时 `/app` 可匿名进

## 回归自查（§8）
1. checkout — 未改 API 逻辑（仍 Phase 5 Cookie user）
2. 旧 OTP — 未改
3. i18n — intl 仍最先执行；matcher 未改
4. build — 以本地 `pnpm build` 为准

## 已知风险 / 未完成
- 工作区现为「登录后可进」；若需游客浏览 `/app`，设 `AUTH_ROUTE_GUARD=0` 或从 `isAuthProtectedPath` 去掉 `/app`
- Cookie 复制到 redirect 时未重传全部 cookie options（name/value）；若遇会话丢失再收紧
- Auth 全套 Phase 1–6 已齐；后续可做 V2 内嵌 modal → `/login` 收敛（可选）
