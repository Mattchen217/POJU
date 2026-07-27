# Phase 4 改动对照清单 · Auth i18n（es / de / fr / zh）

## 新增文件
- `messages/es/auth.json`
- `messages/de/auth.json`
- `messages/fr/auth.json`
- `messages/zh/auth.json`
- `scripts/test-auth-phase4-i18n.ts`
- `docs/auth-phase4-i18n.md` — 本清单

## 修改文件
- 无代码改动（`load-locale-messages` 已在 Phase 3 加载 `auth` 模块并按 locale 优先、缺省回退 EN）

## 约定
- 品牌名保持 `Eastern OS`（不译）
- 中立 SaaS 文案（无算命措辞）
- `verify.subtitle` 必须保留 `{email}` 插值
- 错误码 key 与 EN 完全一致（`errors.*`）

## 冒烟结果
```bash
pnpm exec tsx scripts/test-auth-phase4-i18n.ts
# → test-auth-phase4-i18n: ok
```

## 人工抽查
1. `/es/login`、`/de/signup`、`/fr/forgot-password`、`/zh/verify` 标题与按钮为当地语言
2. 切换语言后错误码文案跟语言走（触发故意错误即可）
3. Verify 页 subtitle 仍显示真实邮箱（`{email}` 被替换）

## 已知风险 / 未完成
- Phase 5：账户 chip / logout / checkout → 见 `docs/auth-phase5-account-checkout.md`
- Phase 6：可选 middleware 路由守卫
- Auth 页 `document.title` 若尚未接 `auth.meta.*`，可后续接 metadata（非阻塞）
