# Phase 3 改动对照清单 · 前端 Auth UI

## 新增文件
- `app/[locale]/(auth)/layout.tsx` — 独立 auth shell（无营销 chrome）
- `app/[locale]/(auth)/login/page.tsx`
- `app/[locale]/(auth)/signup/page.tsx`
- `app/[locale]/(auth)/verify/page.tsx` — signup OTP / email OTP
- `app/[locale]/(auth)/forgot-password/page.tsx`
- `app/[locale]/(auth)/reset-password/page.tsx`
- `components/auth/AuthCard.tsx`
- `components/auth/AuthErrorText.tsx`
- `components/auth/EmailPasswordForm.tsx`
- `components/auth/OAuthButtons.tsx` — 仅 Google
- `components/auth/OtpCodeInput.tsx`
- `components/auth/PasswordStrengthHint.tsx`
- `components/auth/auth.css`
- `lib/auth/post-auth-json.ts`
- `app/api/auth/resend-signup/route.ts` — signup OTP 重发
- `messages/en/auth.json`
- `scripts/test-auth-phase3-ui.ts`
- `docs/auth-phase3-ui.md` — 本清单

## 修改文件
- `lib/i18n/pathname-without-locale.ts` — `isAuthRoute`
- `components/marketing/site-chrome.tsx` — auth 路由跳过营销壳
- `lib/i18n/load-locale-messages.ts` — 加载 `auth` 模块（缺语种回退 EN）

## 新增依赖
- 无（沿用 `react-hook-form` / `@hookform/resolvers` / `zod`）

## 页面 → API 接线
| 页面 | API |
|------|-----|
| `/login` | `POST /api/auth/login`；OAuth → `/api/auth/callback` |
| `/signup` | `POST /api/auth/signup` → `/verify?mode=signup` |
| `/verify` | signup: `verify-signup` + `resend-signup`；email OTP: `otp/send` + `otp/verify` |
| `/forgot-password` | `POST /api/auth/forgot-password` |
| `/reset-password` | `POST /api/auth/update-password`（需 confirm 邮件会话 Cookie） |

## 冒烟结果
```bash
pnpm exec tsx scripts/test-auth-phase3-ui.ts
# → test-auth-phase3-ui: ok
```

## 人工浏览器清单
1. `/login` — 密码登录成功后跳 `/app`，Cookie 存在
2. `/signup` → 收到 6 位码 → `/verify` 验证后进 `/app`
3. `/login` → “Log in with email code” → `/verify` 发码并验证
4. Google OAuth（需 Dashboard Provider）→ callback → `/app`
5. `/forgot-password` → 邮件链接 → `/api/auth/confirm` → `/reset-password` → 更新密码
6. Auth 页无顶部营销导航；文案无算命措辞
7. `?next=/app` 开放重定向被拒绝（只允许相对路径）

## 已知风险 / 未完成
- Phase 4：es/de/fr/zh `auth.json` → 见 `docs/auth-phase4-i18n.md`
- Phase 5：账户 chip / logout / checkout `getServerUser()`
- Phase 6：可选 middleware 路由守卫
- V2 落地页内嵌 Auth Modal 尚未迁到 `/login`（可选）
