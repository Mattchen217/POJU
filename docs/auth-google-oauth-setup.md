# Google OAuth（Supabase Auth · 非 NextAuth）

本项目 **不用** NextAuth，也 **不需要** 在 Vercel 配 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`。

Google 凭证填进 **Supabase Dashboard**；应用只配 Supabase + Site URL。

## 回调 URL 对齐（重要）

| 用途 | 正确地址 | 错误（NextAuth 风格，不要用） |
|------|----------|------------------------------|
| 应用回跳（本仓代码） | `https://easternos.com/api/auth/callback` | `…/api/auth/callback/google` |
| 本地回跳 | `http://localhost:3000/api/auth/callback` | 同上带 `/google` |
| Google Cloud「已获授权的重定向 URI」 | `https://<PROJECT_REF>.supabase.co/auth/v1/callback` | 不要填 easternos.com 的 `/callback/google` |

代码里 `redirectTo` = `{NEXT_PUBLIC_SITE_URL}/api/auth/callback?next=…`（见 `OAuthButtons.tsx`）。

## 你要做的 3 处配置

### 1) Google Cloud Console
- OAuth 客户端类型：Web 应用
- **已获授权的 JavaScript 来源**：
  - `http://localhost:3000`
  - `https://easternos.com`
- **已获授权的重定向 URI**（只填 Supabase，不是本站 `/api/auth/callback/google`）：
  - `https://<你的-supabase-project-ref>.supabase.co/auth/v1/callback`
  - 在 Supabase → Authentication → Providers → Google 页可复制准确 URI

### 2) Supabase Dashboard → Authentication → Providers → Google
- Enable Google
- Client ID / Client Secret：贴你从 Google 拿到的值
- （可选）Skip nonce check 等保持默认即可

### 3) Supabase → Authentication → URL Configuration
**Site URL**
- 本地测：可临时 `http://localhost:3000`，或保持生产 URL 但务必把本地加进 Redirect URLs
**Redirect URLs** 白名单必须包含：
- `http://localhost:3000/api/auth/callback`
- `https://easternos.com/api/auth/callback`

### 4) 应用环境变量（本地 `.env.local` + Vercel）

**不需要** Google Client ID/Secret。需要（且通常已有）：

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Vercel Production 把 `NEXT_PUBLIC_SITE_URL` 设为 `https://easternos.com`。

本地测 Google 登录时，`.env.local` 里 `NEXT_PUBLIC_SITE_URL` 必须是 `http://localhost:3000`，否则 `redirectTo` 会指到线上域名。

## 安全提醒
若 Client Secret 曾发在聊天/工单里，建议在 Google Cloud **轮换（Reset secret）**，再更新 Supabase Provider 里的 Secret。
