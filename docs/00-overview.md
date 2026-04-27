# POJU Site Structure · 总览索引

> **这份文档是整个 `docs/pages/` 目录的导航入口**。
>
> 每个具体页面的详细规格在各自的 MD 文件中。Cursor 开发时，**每次只 @引用一个页面文件**，确保完整读取该页所有细节。

---

## 使用方式

### 开发某个页面时

```
@docs/pages/01-landing.md
按这份规格实现主落地页。
```

Cursor 会读取完整单页规格，不会漏任何细节。

### 查找某个功能属于哪个页面

用本文档的**路由地图**快速定位。

### 确认开发顺序

看本文档的**开发优先级表**。

---

## 路由地图

```
pojulife.com
│
├─ /                        01-landing.md              主落地页
│
├─ /poju                    02-poju.md                 POJU 产品页
│
├─ /syncro                  03-syncro.md               Syncro 产品页
│
├─ /oracle                  04-oracle.md               Oracle 产品页
│
├─ /chat                    05-chat.md                 POJU Chat 付费对话页
│
├─ /archive                 06-archive.md              The Archive 档案馆
│
├─ /disclaimer              07-disclaimer.md           免责声明
│
├─ /privacy                 08-privacy.md              隐私政策
│
├─ /terms                   09-terms.md                服务条款
│
├─ /contact                 10-contact.md              联系我们
│
├─ /unsubscribe?token=xxx   11-unsubscribe.md          取消邮件订阅
│
├─ /chat?token=xxx          12-payment-callback.md     支付成功回跳（临时）
│
├─ /?cancelled=true         13-payment-cancel.md       支付取消回跳（临时）
│
├─ (404 状态)                14-404.md                  页面未找到
│
└─ (500 状态)                15-500.md                  服务器错误
```

### 全局弹窗（不对应路由）

```
├─ 16-modal-disclaimer.md         首次访问免责确认弹窗
├─ 17-modal-pwa-install.md        iOS Safari PWA 添加主屏幕引导弹窗
└─ 18-modal-chat-welcome.md       付款后首次进入 Chat 的提示 Toast
```

---

## 开发优先级（对应 Cursor Tasks）

按 `@docs/tasks/` 下的 Task 分组：

### Task 1 · 项目初始化 + 静态内容页

- `01-landing.md` — 主落地页（9 屏 Hero → Footer）
- `02-poju.md` — POJU 产品页
- `03-syncro.md` — Syncro 产品页 **PC 端部分**（移动端留 Task 3）
- `04-oracle.md` — Oracle 产品页 **静态介绍部分**（交互留 Task 4）
- `06-archive.md` — The Archive **空状态版本**
- `07-disclaimer.md` — 免责声明
- `08-privacy.md` — 隐私政策
- `09-terms.md` — 服务条款
- `10-contact.md` — 联系我们
- `14-404.md` — 404 错误页
- `15-500.md` — 500 错误页
- `16-modal-disclaimer.md` — 免责协议首次确认弹窗

### Task 2 · POJU Chat 完整（Mock AI）

- `05-chat.md` — POJU Chat（用 Mock AI）
- `18-modal-chat-welcome.md` — 付款后首次进入 Chat 的提示 Toast
- `06-archive.md` 补完 — POJU Session 条目展示

### Task 3 · Syncro 移动端完整交互

- `03-syncro.md` 补完 — 移动端完整体验（粒子球、AR、精准拍照）
- `17-modal-pwa-install.md` — PWA 添加主屏幕引导弹窗
- `06-archive.md` 补完 — Syncro 条目展示

### Task 4 · Oracle 完整交互

- `04-oracle.md` 补完 — 完整 7 Stage 仪式流
- `06-archive.md` 补完 — Oracle 条目 + 3 签联动组合条目

### Task 5 · 支付 + 邮件 + 真实 AI

- `12-payment-callback.md` — 支付成功回跳
- `13-payment-cancel.md` — 支付取消回跳
- `11-unsubscribe.md` — 取消邮件订阅
- `05-chat.md` 补完 — 真实 Claude API 接入 + PDF 导出 + 回访邮件
- `06-archive.md` 补完 — Wipe Everything 等完整操作
- 其他收尾：所有页面的 `$9.99` CTA 接入 Stripe

---

## 全局组件说明

**以下组件出现在多个页面**，开发时做成共享组件放在 `components/ui/` 或 `components/layout/`，不在每个单页文档里重复：

### 顶部导航栏（Desktop ≥1024px）

**位置**：所有页面最顶部（固定或滚动时半透明玻璃化）

**左侧**：
- POJU Logo（字母版 + 紫色球图标）
- 点击 → 跳回 `/`

**中部水平菜单**：
- POJU（→ `/poju`）
- SYNCRO（→ `/syncro`）
- ORACLE（→ `/oracle`）
- THE ARCHIVE（→ `/archive`）

**右侧**：
- `Get Started` 按钮 → `/poju`（或直接触发 `$9.99` 支付）

### 顶部导航栏（Mobile <1024px）

**左侧**：
- POJU Logo

**右侧**：
- 汉堡按钮 `≡`

**点击汉堡** → 侧滑抽屉：
- POJU / SYNCRO / ORACLE / The Archive
- 分隔线
- Disclaimer / Privacy / Terms / Contact
- 关闭按钮 `×`

### PWA standalone 模式底部 Tab

**仅当用户以"已添加到主屏幕"状态打开时显示**：
- Home `⌂` → `/`
- POJU → `/poju` 或 `/chat`（若有活跃 Session）
- Syncro → `/syncro`
- Oracle → `/oracle`
- Archive `✦` → `/archive`

当前 Tab 下方紫色小圆点指示。

### Footer（页脚）

**所有公开页面底部都有**（Chat 页除外，Chat 是全屏对话界面不含 Footer）：

- POJU Logo（纯字母版）
- 副标题：`pojulife.com`
- 分隔线
- **Legal 链接组**：
  - Disclaimer
  - Privacy Policy
  - Terms of Service
- **Support 链接组**：
  - Contact
- 分隔线
- 版权声明：`© 2026 POJU. All rights reserved.`
- 免责声明短句：`Not medical, legal, or financial advice. Consult licensed professionals for those matters.`

**移动端**：Legal 和 Support 折叠为手风琴，默认关闭。

---

## 支付 CTA 追踪

所有 `$9.99` 支付按钮在 Stripe metadata 中要追踪来源，便于分析转化：

| 触发位置 | metadata.source |
|---|---|
| 落地页 Hero 按钮 | `landing_hero` |
| 落地页三产品卡片 POJU | `landing_products` |
| 落地页最终 CTA | `landing_final` |
| POJU 产品页顶部 | `poju_page_top` |
| POJU 产品页底部 | `poju_page_bottom` |
| Syncro 结果页钩子 | `syncro_hook` |
| Syncro 精准拍照钩子 | `syncro_precise_hook` |
| Oracle 卡片底部钩子 | `oracle_hook` |
| Oracle 3 签联动触发 | `oracle_3sign_trigger` |
| Chat 左侧栏 "New POJU" | `chat_new_poju` |
| Archive 空状态 CTA | `archive_new_question` |

所有支付成功后，metadata 会传给 Chat 页面作为 AI 起始上下文（例如从 Oracle 钩子进入时，AI 第一句话会引用刚抽的签）。

---

## 每份页面文档的标准结构

所有 `01-xxx.md` 到 `18-xxx.md` 都遵循以下结构：

1. **页面身份**：路由、标题、目标、优先级、所属 Task
2. **访问条件**：谁能访问、是否需要 token / 权限
3. **页面结构清单**：从上到下的区块列表
4. **每个区块的完整内容**：标题、副标题、文案、按钮、交互
5. **功能与交互**：按钮行为、表单验证、状态切换
6. **数据依赖**：API 调用、IndexedDB 读写、localStorage 使用
7. **响应式行为**：PC / 移动端差异
8. **空状态与错误状态**
9. **验收标准**：开发完成后如何测试
10. **关联资源**：视觉参考、相关文档

---

## 相关文档

- **完整产品规范**：`@docs/POJU_Development_Document_v3.0.1_Final.md`
- **视觉语言规范**：`.cursor/rules/05-visual-language.mdc`
- **视觉参考图**：`@docs/visual-reference/poju-visual-style-master.png`
- **五个 Cursor Tasks**：`docs/tasks/task-1-xxx.md` 到 `task-5-xxx.md`

---

## 文档更新原则

- 页面结构或内容调整 → 更新对应 `XX-xxx.md`
- 新增页面 → 新建 `XX-xxx.md` 并在本总览中登记
- 视觉调整 → 不动这些文件，只改 `05-visual-language.mdc`
- 所有改动保持文档之间不重复、不冲突

---

✦
