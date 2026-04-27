# 01 · 主落地页 `/`

## 页面身份

| 项 | 值 |
|---|---|
| 路由 | `/` |
| 文件位置 | `app/(marketing)/page.tsx` |
| 页面标题（浏览器 tab） | `POJU — Ancient Wisdom, AI-Powered. Made for You.` |
| 目标用户 | 所有访问者（从搜索 / 广告 / 朋友推荐进入） |
| 核心目标 | 10 秒内让用户理解产品 + 识别自己是否是目标用户 |
| 优先级 | **最高**（上线前必须完成） |
| 所属 Task | Task 1 |

---

## 访问条件

- 所有人可访问
- 无需登录 / 无需 Session Token
- **首次访问**会触发全站免责协议弹窗（见 `@docs/pages/16-modal-disclaimer.md`）

---

## 页面结构清单

落地页共 **9 屏**（Hero → Footer）：

1. Hero 主视觉
2. 三产品入口卡片
3. 品牌承诺条（No Sign Up / Privacy First / Yours Only）
4. 品牌叙事区 · Four Elements
5. 科学锚点区
6. Three Nevers 承诺
7. **How We Protect You** 技术实现（隐私机制透明化）
8. 最终 CTA
9. Footer

---

## 区块详细内容

### Screen 1 · Hero 主视觉

**布局**：左右分栏（Desktop）/ 垂直堆叠（Mobile）

**左侧（Desktop）或上方（Mobile）· 文字内容**：

- **主标题**（3 行，最后一个词有紫色强调）：
  ```
  Ancient Wisdom,
  AI-Powered.
  Made for You.
  ```
  （"You" 用紫色 `--text-accent` 强调色）

- **副标题**：
  ```
  POJU is an AI Agent that combines timeless Eastern wisdom 
  with modern science to help you break through life's challenges.
  ```

- **主 CTA 按钮**：`Start with POJU`
  - 样式：Primary 紫色 pill
  - 点击行为：触发 `$9.99` Stripe Checkout
  - Stripe metadata: `source: "landing_hero"`

- **副 CTA 按钮**：`Explore Tools`
  - 样式：Secondary 玻璃 pill
  - 点击行为：平滑滚动到 Screen 2（三产品入口）

**右侧（Desktop）或下方（Mobile）· 星云粒子光圈**：

- 紫色粒子星云动画（React Three Fiber）
- 缓慢旋转（20-30 秒一圈）
- 中心有"暗色黑洞"效果
- 边缘粒子光晕扩散
- 具体视觉参考 `@docs/visual-reference/poju-visual-style-master.png` 的 01 区块第一屏

---

### Screen 2 · 三产品入口

**标题**：`Three ways in. One way through.`

**三张卡片横向排列（Desktop）或纵向堆叠（Mobile）**，顺序：**Syncro · POJU · Oracle**（POJU 放中间最显眼）

#### POJU 卡片（中间，视觉略大）

- 图标：紫色圆形（渐变 `--purple-primary` → `--purple-pink`）
- 标题：`POJU`
- 副标题：`Breakthrough Q&A`
- 描述：`Deep analysis, actionable plans, real results.`
- 标签：`$9.99`（紫色强调）
- 按钮：`Learn more →`
- 按钮点击：跳转 `/poju`

#### Syncro 卡片（左侧）

- 图标：青色菱形罗盘
- 标题：`SYNCRO`
- 副标题：`Energy Field`
- 描述：`Analyze spatial energy using Bazi, location and time.`
- 标签：`Free`
- 按钮：`Open Syncro →`
- 按钮点击：跳转 `/syncro`

#### Oracle 卡片（右侧）

- 图标：粉紫色菱形卡片
- 标题：`ORACLE`
- 副标题：`Ancient Guidance`
- 描述：`Draw cards for timeless insights and inspiration.`
- 标签：`Free`
- 按钮：`Open Oracle →`
- 按钮点击：跳转 `/oracle`

**卡片 hover 效果**：
- 轻微上浮（`translateY(-2px)`）
- 紫色光晕加深
- 300ms 过渡

---

### Screen 3 · 品牌承诺条

**作用**：隐私叙事的"**标签层**"——快速扫过能记住。

**三列横向排列（Desktop）或纵向（Mobile）**：

#### No Sign Up

- 图标：用户+禁止符号
- 标题：`No Sign Up`
- 说明：`We don't require an account or personal info.`

#### Privacy First

- 图标：锁
- 标题：`Privacy First`
- 说明：`All data stays only on your device.`

#### Yours Only

- 图标：手
- 标题：`Yours Only`
- 说明：`Your sessions, your answers, your control.`

---

### Screen 4 · 品牌叙事区 · Four Elements

**标题**：`Where two truths meet.`

**四段文字垂直排列，每段之间有细分隔线**：

#### ✦ ANCIENT

```
Two thousand years of Eastern observation:
Daoism · Feng Shui · Bazi · Yi Jing
```

#### ✦ MODERN

```
Reinforced by science:
magnetic fields · spatial cognition · circadian rhythms · 
environmental psychology
```

#### ✦ AI AGENT

```
Translated by an intelligence trained on both — 
into what you can do, today.
```

#### ✦ YOU

```
Your birth chart. Your direction. 
Your question. Your this exact moment.
```

**动画**：每段在滚动进入视口时触发 fadeIn + slideUp 8px（300ms）

---

### Screen 5 · 科学锚点区

**标题**：`What Eastern traditions observed, science is beginning to measure.`

**四条研究引用**（上线前需律师审核真实研究，现在用占位）：

```
✦ Magnetic fields affect cognition
  [期刊名 / 年份]

✦ Spatial orientation shapes decisions
  [期刊名 / 年份]

✦ Circadian cycles drive biology
  [期刊名 / 年份]

✦ Visual direction influences focus
  [期刊名 / 年份]
```

**分隔线**

**桥梁段**：

```
Eastern traditions named these forces two thousand years ago.

        QI · XUAN · BAZI · YUAN

POJU uses AI to translate both languages into something 
you can act on — today.
```

（`QI · XUAN · BAZI · YUAN` 用紫色强调色，大写，字距拉开）

---

### Screen 6 · Three Nevers 承诺

**作用**：隐私叙事的"**承诺层**"——情感记忆（我们不做什么）。

**标题**：`Three promises we don't break.`

**三段内容，每段独立卡片**：

#### ✦ Never stored

```
Your conversations live only on your device. 
We encrypt them locally. 
We cannot read them. 
No one can.
```

#### ✦ Never required

```
No account. No login. No password. 
No email, unless you want your reading as a PDF.
```

#### ✦ Never manipulative

```
No dark patterns. No fake urgency. No "limited time." 
No upsells. One price: $9.99 when you need it.
```

---

### Screen 7 · How We Protect You 技术实现

**作用**：隐私叙事的"**实现层**"——技术透明化（我们如何做到）。

**标题**：`How we actually keep our word.`
（"actually" 这个词承认用户的怀疑合理，反而增加可信度）

**副标题**：`Privacy isn't a checkbox. It's our architecture.`

**四组内容**（每组结构：✦ 粗体标题 + 技术描述段落 + "Verify it yourself" 斜体小字验证说明）：

#### ✦ Your conversations are encrypted on your device.

```
Not "secured on our servers." Encrypted with AES-256-GCM 
right in your browser, using a key we never see. Even if 
our servers were breached, there is nothing to steal.

Verify it yourself: open DevTools → Application → IndexedDB.
You'll see encrypted gibberish, not your words.
```

#### ✦ We have no account system.

```
No email at signup. No password. No phone number. 
No Google/Apple login. Your device fingerprint is your 
only ID — a one-way hash we use to restore your paid 
session, nothing else.

Verify it yourself: nothing to sign up for. 
Try the free tools right now.
```

#### ✦ Your email is forbidden from living on our servers.

```
If you export your reading as PDF, we ask for your email. 
We send the PDF. Then we delete your address within 24 hours 
— physically erased from the database. 
Even we can't reach you after that.

Your control: one-click unsubscribe. Auto-delete everywhere.
```

#### ✦ Anthropic's Zero Data Retention is enabled.

```
Your conversations go through Claude, but Anthropic doesn't 
save them, doesn't train on them, and doesn't let humans 
review them. We pay extra specifically for this guarantee.

Verify it yourself: Anthropic's Zero Data Retention policy 
is public.
```

**底部补充段落**（整屏最下方，独立卡片）：

```
We're not a company that sells data because we don't 
collect data. We're a company that sells one thing: 
a $9.99 conversation that helps you move through what's 
stuck. That's the whole business model.

If you ever doubt us: every claim on this page can be 
verified in a minute with your browser's DevTools or 
Anthropic's public documentation.
```

**可选链接**（底部对齐或右对齐）：
- `Read our full Privacy Policy →`（跳 `/privacy`）

---

### Screen 8 · 最终 CTA

**标题**：`Ready to break through?`

**副标题**：`One question. $9.99. Delivered in one conversation.`

**主按钮**：`Ask Your Question →`
- 样式：Primary 紫色 pill，尺寸比 Hero 的 CTA 更大
- 点击行为：触发 `$9.99` Stripe Checkout
- Stripe metadata: `source: "landing_final"`

**按钮下方小字**：
```
One question · Unlimited depth · PDF by email · 
Deletes when you close.
```

---

### Screen 9 · Footer

见 `@docs/pages/00-overview.md` 的"全局组件 · Footer"部分。

---

## 功能与交互

### 主要交互点

1. **Hero CTA `Start with POJU`** → Stripe Checkout（metadata: `landing_hero`）
2. **Hero 副 CTA `Explore Tools`** → 平滑滚动到 Screen 2
3. **三产品卡片点击** → 跳转对应产品页
4. **`Read our full Privacy Policy →`** → 跳转 `/privacy`
5. **最终 CTA `Ask Your Question →`** → Stripe Checkout（metadata: `landing_final`）
6. **导航栏 `Get Started`** → Stripe Checkout（metadata: `landing_nav`）

### 滚动行为

- 长页面滚动必须平滑
- 每个 Screen 进入视口时触发 fadeIn + slideUp 8px 动画（300ms，只触发一次）
- 使用 Framer Motion 的 `useInView` + `once: true`

### 星云粒子动画

- 使用 React Three Fiber
- 粒子数按设备分级：旗舰 3000 / 中端 1500 / 低端 500
- Curl Noise 驱动流动
- 缓慢旋转（20-30 秒一圈）
- 检测 `prefers-reduced-motion: reduce` → 静态图片替代

---

## 数据依赖

### 需要的数据

- 无（完全静态页面）

### 需要读写的存储

- **localStorage**：
  - 读 `pojulife_disclaimer_v1`（若无则触发免责弹窗）
  - 读 `pojulife_theme_mute`（音效静音状态）

### 需要调用的 API

- **无**（所有 CTA 在点击时才调用 `/api/payment/checkout`）

---

## 响应式行为

### Desktop (≥1024px)

- Hero 左右分栏（文字 40% / 星云 60%）
- 三产品卡片横向三列
- 品牌承诺条横向三列
- Four Elements 垂直排列但宽度限制在 800px 居中
- 科学锚点区两列
- Three Nevers 三列卡片
- How We Protect You 两列网格（2x2）

### Tablet (768px – 1023px)

- Hero 垂直堆叠（星云在上，文字在下）
- 三产品卡片：两行排列（POJU 单独一行居中）
- 其他区块横向减为两列

### Mobile (<768px)

- 所有区块单列堆叠
- 三产品卡片：POJU 在中间，上下 Syncro 和 Oracle
- How We Protect You 四组内容垂直堆叠
- 主标题字号降一档

---

## 空状态与错误状态

本页面无空状态。

**错误状态**：
- 星云粒子加载失败 → 降级为静态紫色渐变背景
- 图片加载失败 → 显示灰底占位 + `alt` 文字

---

## 验收标准

完成后测试：

- [ ] 访问 `/` 看到完整 9 屏
- [ ] 滚动流畅，每屏进入视口时有淡入动画
- [ ] Hero 星云粒子在旗舰机上 60fps 旋转
- [ ] 首次访问弹出免责协议（见 16-modal-disclaimer.md）
- [ ] 勾选确认后刷新不再弹
- [ ] 主 CTA `Start with POJU` 点击 → 跳 Stripe Checkout
- [ ] 副 CTA `Explore Tools` 点击 → 平滑滚动到 Screen 2
- [ ] 三产品卡片 hover 效果流畅（-2px 上浮 + 光晕加深）
- [ ] 三产品卡片点击跳转正确页面
- [ ] 点击 `Read our full Privacy Policy →` 跳转 `/privacy`
- [ ] 最终 CTA 点击触发 Stripe Checkout，metadata 含 `landing_final`
- [ ] 导航栏在 Desktop / Mobile / PWA standalone 模式下表现正确
- [ ] Footer 所有链接可点击
- [ ] Mobile 下所有区块单列堆叠，文字不溢出
- [ ] `prefers-reduced-motion` 时动画降级
- [ ] Lighthouse 分数：Performance > 90, Accessibility > 95, PWA installable
- [ ] 页面在 iPhone SE (375px) 到 4K 桌面都良好响应

---

## 关联资源

### 视觉参考

- `@docs/visual-reference/poju-visual-style-master.png`（参考 01 区块第 1 屏）

### 相关文档

- `@.cursor/rules/05-visual-language.mdc` — 视觉系统
- `@docs/pages/02-poju.md` — POJU 产品页（Hero CTA 跳转目标）
- `@docs/pages/16-modal-disclaimer.md` — 免责协议弹窗（首次访问触发）
- `@docs/POJU_Development_Document_v3.0.1_Final.md` — 完整文档第 07 章

### 关键文案来源

- 所有英文文案已锁定，严禁"优化" / "改写"
- 如需调整，需修改本文档后再实现

---

✦
