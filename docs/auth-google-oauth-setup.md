# Social OAuth（Supabase Auth · 非 NextAuth）

本项目 **不用** NextAuth。各平台 Client ID/Secret 填进 **Supabase Dashboard → Authentication → Providers**。

## ERR_TOO_MANY_REDIRECTS（www 死循环）

若出现 `www.easternos.com 将您重定向的次数过多`，通常是 **两边互跳**：

- Vercel Domains：无 www → **www**（Primary）
- 代码里又写了：www → 无 www

两者对打就会死循环。OAuth 成功回到站点后也会卡在这里。

**处理：**

1. 代码里 **不要** 再加 `www → easternos.com` 的 Next/vercel redirect（已撤掉）
2. Vercel → Settings → Domains：看清 **Primary** 是哪一个
3. 全链路只用这一个主域名（含 `NEXT_PUBLIC_SITE_URL`、Supabase Site URL）
4. 清掉 `easternos.com` / `www.easternos.com` 的 Cookie，或无痕窗口再试

当前线上若打开后总是落在 **www**，就把生产统一成 www：

| 位置 | 值 |
|------|-----|
| Vercel Primary | `www.easternos.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://www.easternos.com` |
| Supabase Site URL | `https://www.easternos.com` |

Redirect URLs / Google JS origins **两个都保留**（白名单可以多，主域名只能一个）：

```text
https://easternos.com
https://www.easternos.com
http://localhost:3000
```

```text
https://easternos.com/**
https://easternos.com/api/auth/callback**
https://www.easternos.com/**
https://www.easternos.com/api/auth/callback**
http://localhost:3000/**
http://localhost:3000/api/auth/callback**
```

OAuth 的 `redirectTo` 使用 **当前页的 `window.location.origin`**（与 PKCE cookie 同主机），不要在代码里强行改成另一个主机。

`/api/auth/callback` 已在 middleware `matcher` 里排除（`api` 前缀），不会被登录守卫拦。

---

## Google Cloud 控制台（两栏别搞混）

### 1）Authorized JavaScript origins（浏览器来源）

```text
https://easternos.com
https://www.easternos.com
http://localhost:3000
```

### 2）Authorized redirect URIs（Google → Supabase）

只填 Supabase，不要填网站域名：

```text
https://vkqgdzgooxfchphowigm.supabase.co/auth/v1/callback
```

（以 Dashboard → Google Provider 里显示的 Callback URL 为准。）

---

## 不要跳到 localhost

**Supabase Site URL** 只能填 **一个**，生产用正式主域名（与 Vercel Primary 一致），不要填 localhost。

本地测试靠 Redirect URLs 白名单里的 `http://localhost:3000/**`。

## Vercel 环境变量

与 Primary 一致，例如：

```
NEXT_PUBLIC_SITE_URL=https://www.easternos.com
```

本地 `.env.local` 继续用 `http://localhost:3000`。

## Providers

| 按钮 | Supabase Provider |
|------|-------------------|
| Google | Google |
| Facebook | Facebook |
| X | Twitter / x |
| Discord | Discord |

## 应用环境变量

```
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
