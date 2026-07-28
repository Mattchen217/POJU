# Social OAuth（Supabase Auth · 非 NextAuth）

本项目 **不用** NextAuth。各平台 Client ID/Secret 填进 **Supabase Dashboard → Authentication → Providers**。

## 本地能登录、正式站不行（www）

正式站打开后地址栏若是 **`https://www.easternos.com`**，而 Google / Supabase 只配了 **`https://easternos.com`**（无 www），OAuth 会挂：

- `redirectTo` 变成 `https://www.easternos.com/api/auth/callback…`
- 白名单里没有 www → 被拒或回落到错误 Site URL
- PKCE cookie 写在 www，回调却到非 www → 换 code 失败 → `Sign-in with provider failed`

**立刻可做（不发版）：**

Google → Authorized JavaScript origins 再加一行：

```text
https://www.easternos.com
```

Supabase → Redirect URLs 再加：

```text
https://www.easternos.com/**
https://www.easternos.com/api/auth/callback**
```

**长期：** 代码已把 `www.easternos.com` 301 到 `easternos.com`，与 Site URL / 品牌域名对齐。部署后请用无 www 地址测登录。

Vercel 生产环境变量必须是：

```text
NEXT_PUBLIC_SITE_URL=https://easternos.com
```

（不要带 www，也不要 localhost。）

---

## Google Cloud 控制台（两栏别搞混）

OAuth 客户端里有两栏，作用完全不同：

### 1）Authorized JavaScript origins（浏览器来源）

这里填**你的网站域名**（用户点「Continue with Google」时所在的站）。

本地 + 正式站都要测，就 **都留着**（含 www，在重定向上线前需要）：

```text
https://easternos.com
https://www.easternos.com
http://localhost:3000
```

- 在 **easternos.com** 登录 → 需要第一行  
- 在 **本机** 登录 → 需要第二行  
- 两行互不影响；正式站不会因为多了 localhost 就跳到本地

### 2）Authorized redirect URIs（Google 授权后跳到哪里）

这里 **不要** 填 easternos.com / localhost。  
Google 先回到 **Supabase**，再由 Supabase 送回你的站。

只填（把 `<PROJECT_REF>` 换成你的项目 ID）：

```text
https://<PROJECT_REF>.supabase.co/auth/v1/callback
```

在 Supabase → Project Settings → API 能看到 Project URL，把后面的路径改成 `/auth/v1/callback` 即可。

若把 `http://localhost:3000/...` 或 `https://easternos.com/api/auth/callback` 填进这一栏当「唯一回调」，容易和 Supabase 流程打架；**Google 这一栏以 Supabase 回调为准**。

---

## 关键：不要跳到 localhost

登录后浏览器跑到 `http://localhost:3000`，看的是 **Supabase Site URL**，不是 Google 的 JavaScript origins。

**Supabase → Authentication → URL Configuration：**

| 项 | 生产必须写成 |
|----|----------------|
| **Site URL** | `https://easternos.com`（只能填 **一个**；不要写成 localhost） |
| Redirect URLs | 见下方列表（本地 + 生产都要） |

Site URL = OAuth 缺省/失败时的兜底地址。写成 localhost 时，即使用户在 easternos.com 点 Google，也可能被送回本机。

本机照样能测：靠下面 Redirect URLs 白名单 + 代码里的 `redirectTo`（`window.location.origin`），**不必**把 Site URL 改成本地。

## 应用侧回调（Supabase Redirect URLs）

| 用途 | 正确地址 |
|------|----------|
| 应用回跳 | `https://easternos.com/api/auth/callback`（本地：`http://localhost:3000/api/auth/callback`） |
| Google 控制台 Redirect URI | `https://<PROJECT_REF>.supabase.co/auth/v1/callback` |

不要用 NextAuth 风格的 `/api/auth/callback/google`。

登录使用**同窗口全页跳转**。成功后回到发起登录时的 `?next=`（落地页默认 `/`，工作台入口传 `/app`）。

**Supabase → Redirect URLs** 必须包含：

- `https://easternos.com/**`
- `https://easternos.com/api/auth/callback**`
- `https://www.easternos.com/**`
- `https://www.easternos.com/api/auth/callback**`
- `http://localhost:3000/**`
- `http://localhost:3000/api/auth/callback**`

## 登录页出现 “Sign-in with provider failed”

表示 OAuth 整圈失败（常见：Google 回调拒掉、Supabase 换 code 失败、或回跳丢了）。请按顺序核对：

1. Google **Redirect URIs** = 只有 Supabase `/auth/v1/callback`
2. Google **JavaScript origins** = `https://easternos.com` +（本机测则）`http://localhost:3000`
3. Supabase **Site URL** = `https://easternos.com`
4. Supabase **Redirect URLs** 含正式站 + 本地 callback
5. Vercel：`NEXT_PUBLIC_SITE_URL=https://easternos.com`

## Vercel / 服务器环境变量

生产：

```
NEXT_PUBLIC_SITE_URL=https://easternos.com
```

本地 `.env.local` 可用 `http://localhost:3000`。

## Providers（本仓按钮）

| 按钮 | Supabase Provider 名 |
|------|----------------------|
| Google | Google |
| Facebook | Facebook |
| X | Twitter |
| Discord | Discord |

## 应用环境变量

```
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

不需要 `GOOGLE_CLIENT_ID` 等 Next 环境变量（那些填在 Supabase Providers 里）。
