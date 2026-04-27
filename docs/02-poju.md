# 02 · POJU 产品页 `/poju`

## 页面身份

| 项 | 值 |
|---|---|
| 路由 | `/poju` |
| 文件位置 | `app/(marketing)/poju/page.tsx` |
| 页面标题 | `POJU — Break your deadlock` |
| 目标用户 | 从落地页三产品卡片点击进来、或直接搜索 POJU 产品的深度意向用户 |
| 核心目标 | 让用户深度理解 POJU 的独特价值，完成付费决策 |
| 优先级 | 高（Task 1） |
| 所属 Task | Task 1 |

---

## 访问条件

- 所有人可访问
- 无需登录
- 所有页面点击 CTA 之前，必须先通过全站免责协议（`pojulife_disclaimer_v1` 存在）

---

## 页面结构清单

共 7 个区块（从上到下）：

1. 顶部 Hero
2. "When to come to POJU" 典型场景
3. "How POJU works" 6 阶段工作流
4. 差异化对比表
5. 付款前承诺条（Before You Pay）
6. 最终 CTA
7. Footer

---

## 区块详细内容

### 1. 顶部 Hero

**大标题**：`Break your deadlock.`

**副标题**：
```
Guided by 2,000 years of Eastern wisdom, 
reinforced by modern science, 
delivered by an AI Agent that walks with you.
```

**主 CTA 按钮**：`Ask your question — $9.99`
- 样式：Primary 紫色 pill（尺寸较大）
- 点击：触发 Stripe Checkout
- Stripe metadata: `source: "poju_page_top"`

**副 CTA 按钮**：`See how it works ↓`
- 样式：Tertiary（纯文字 + 紫色）
- 点击：平滑滚动到下方 "How POJU works" 区块

**背景视觉**：紫色星云粒子，比落地页 Hero 更克制（降密度）

---

### 2. "When to come to POJU" 典型场景

**标题**：`When to come to POJU`

**副标题**：`Five kinds of knots we untie.`

**5 个场景列表**（每个带 ✦ 符号 + 标题 + 副描述）：

#### ✦ You're stuck between two paths

```
Career change, relationship decision, relocation.
```

#### ✦ You've done your research and you're more confused

```
Conflicting advice, family pressure, ticking clock.
```

#### ✦ Something keeps repeating and you don't know why

```
Same kind of relationship, same setbacks, same blocks.
```

#### ✦ You need depth that friends can't give

```
No one around you has the distance to see clearly.
```

#### ✦ You want direction, not prediction

```
"Will X happen" is astrology. 
"What should I do" is POJU.
```

**布局**：垂直列表，每条左对齐，图标和文字共水平基线。

---

### 3. "How POJU works" 6 阶段工作流

**标题**：`How POJU works`

**副标题**：`Not a single answer — a continuous breakthrough loop.`

**6 步流程**（可用编号卡片或流程图呈现）：

1. **Issue Identification**
   - 描述：What's the real knot beneath your question?

2. **Information Collection**
   - 描述：Bazi, people, timeline, what you've tried, what you fear.

3. **Auxiliary Tools Judgment**
   - 描述：Do we need Syncro (space) or Oracle (sign)?

4. **Core Analysis**
   - 描述：Ming-li layer · Shi-li layer · Wisdom framework.

5. **Action Generation**
   - 描述：Today's action · This week's · Ongoing practice.

6. **Implementation Tracking**
   - 描述：You try. You come back. The path adjusts.

**底部强调句**（单独一行，斜体或紫色）：
```
You act. You come back. The path adjusts. 
Until you move through.
```

**视觉建议**：6 步之间用细金线或紫色点连接，表示循环关系（5 → 6 → 4 的回环）。

---

### 4. 差异化对比表

**标题**：`Why POJU is different`

**副标题**：`Depth of a master. Price of a chat.`

**表格**（横向滚动支持 Mobile）：

|  | Co-Star | ChatGPT | Real Master | **POJU** |
|---|---|---|---|---|
| Depth | ● | ● ● | ● ● ● ● | **● ● ●** |
| Actionable | ● | ● ● | ● ● ● ● | **● ● ● ●** |
| Eastern Base | ● ● | ● | ● ● ● ● | **● ● ● ●** |
| Privacy | ● | ● | ● | **● ● ● ●** |
| Price | $8/yr | $20/mo | $150-500 | **$9.99 single** |

**POJU 列**用紫色背景突出。

**表格下方小字**：
```
We don't bash competitors. Each tool has its place. 
POJU is the one you want when the question has weight, 
and you want both depth and action in one session.
```

---

### 5. 付款前承诺条（Before You Pay）

**作用**：在最终 CTA 前再给一次隐私安心感，降低付费犹豫。

**内容**（一个玻璃卡片容器）：

```
Before you pay — what happens to your words:

✦ Encrypted on your device only.
✦ Never stored on our servers.
✦ Deleted when you close — even from us.

[ How we actually keep our word → ]
```

**链接 `How we actually keep our word →`**：
- 跳转 `/#how-we-protect-you`（落地页 Screen 7）
- 或跳转 `/privacy`（完整隐私政策）

---

### 6. 最终 CTA

**标题**：`Ready to break through?`

**主 CTA 按钮**：`Ask your question — $9.99`
- 样式：Primary 紫色 pill（最大尺寸）
- 点击：触发 Stripe Checkout
- Stripe metadata: `source: "poju_page_bottom"`

**按钮下方小字**：
```
One question · Unlimited depth · PDF by email · 
Deletes when you close.
```

---

### 7. Footer

见 `@docs/pages/00-overview.md` 的"全局组件 · Footer"部分。

---

## 功能与交互

### 主要交互点

1. **Hero `Ask your question — $9.99`** → Stripe Checkout（metadata: `poju_page_top`）
2. **Hero `See how it works ↓`** → 平滑滚动到 "How POJU works"
3. **Before You Pay 的链接** → 跳转 `/#how-we-protect-you` 或 `/privacy`
4. **最终 CTA `Ask your question — $9.99`** → Stripe Checkout（metadata: `poju_page_bottom`）

### 滚动行为

- 每个区块进入视口时触发 fadeIn + slideUp（300ms）
- "How POJU works" 的 6 步流程可以做渐进显现（每步延迟 100ms）

### 表格响应式

- Desktop：完整展示
- Mobile：横向滚动（不折叠成卡片，保持对比感）

---

## 数据依赖

### 需要的数据

- 无（完全静态）

### 需要读写的存储

- **localStorage** 读 `pojulife_disclaimer_v1`（首次访问若无则触发弹窗）

### 需要调用的 API

- **无**（CTA 点击时才调用 `/api/payment/checkout`）

---

## 响应式行为

### Desktop (≥1024px)

- Hero 中央对齐，最大宽度 960px
- "When to come to POJU" 垂直列表，最大宽度 720px 居中
- "How POJU works" 6 步水平流程图（2 行 3 列）
- 对比表完整展示
- Before You Pay 卡片居中

### Tablet (768px – 1023px)

- Hero 文字稍紧
- 6 步流程 2 列排列

### Mobile (<768px)

- Hero 单列
- 6 步流程单列纵向排列
- 对比表横向滚动
- 主标题字号降一档

---

## 空状态与错误状态

本页面无空状态。

**错误状态**：
- Stripe Checkout 创建失败 → Toast 提示 `Something went wrong. Try again or contact support@pojulife.com.`

---

## 验收标准

完成后测试：

- [ ] 访问 `/poju` 看到完整 7 区块
- [ ] Hero 区 `Ask your question — $9.99` 点击 → Stripe Checkout（metadata: `poju_page_top`）
- [ ] Hero `See how it works ↓` → 平滑滚动到 "How POJU works"
- [ ] "When to come to POJU" 5 个场景清晰展示
- [ ] "How POJU works" 6 步流程展示
- [ ] 对比表在 Desktop 完整显示，Mobile 横向滚动
- [ ] Before You Pay 卡片显示三条隐私承诺 + 链接
- [ ] 链接跳转 `/#how-we-protect-you` 或 `/privacy`
- [ ] 最终 CTA 点击 → Stripe Checkout（metadata: `poju_page_bottom`）
- [ ] 所有文案与规格完全一致，无改写
- [ ] Footer 显示完整
- [ ] Mobile 布局单列堆叠，对比表可横滑
- [ ] 滚动进入视口动画流畅
- [ ] 首次访问触发免责弹窗

---

## 关联资源

### 视觉参考

- `@docs/visual-reference/poju-visual-style-master.png`

### 相关文档

- `@.cursor/rules/05-visual-language.mdc`
- `@docs/pages/01-landing.md`（Hero CTA 的替代跳转目标，Screen 7 被引用）
- `@docs/pages/05-chat.md`（支付成功后进入）
- `@docs/POJU_Development_Document_v3.0.1_Final.md` 第 07.4 节

### 关键文案来源

- 文案已锁定
- 对比表的 POJU 列绝不能贬低其他产品（保持专业）

---

✦
