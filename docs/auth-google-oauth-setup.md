# Social OAuth（Supabase Auth · 非 NextAuth）

本项目 **不用** NextAuth。各平台 Client ID/Secret 填进 **Supabase Dashboard → Authentication → Providers**。

## 回调 URL

| 用途 | 正确地址 |
|------|----------|
| 应用回跳 | `https://easternos.com/api/auth/callback`（本地：`http://localhost:3000/api/auth/callback`） |
| 各平台 Authorized redirect URI | `https://<PROJECT_REF>.supabase.co/auth/v1/callback` |

不要用 NextAuth 风格的 `/api/auth/callback/google`。

**Supabase → Authentication → URL Configuration → Redirect URLs** 必须包含上述「应用回跳」地址（可带 `*` 通配查询串）。若只配了 Site URL 根路径，Google 会把 `?code=` 丢回首页，弹窗里就会整页打开落地页而不是关闭。

## Providers（本仓按钮）

| 按钮 | Supabase Provider 名 |
|------|----------------------|
| Google | Google |
| Facebook | Facebook |
| X | Twitter |
| Discord | Discord |

每个都要在对应开发者后台创建应用，并把重定向 URI 指到 **Supabase** 的 `/auth/v1/callback`，再在 Supabase 填 Client ID/Secret。

## 应用环境变量

只需：

```
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

不需要 `GOOGLE_CLIENT_ID` / `FACEBOOK_CLIENT_ID` 等 Next 环境变量。
