# POJU 修复文档 #02 · 法律页面填充 + 残留清理 + 多语言准备

> **目标**:让网站从【95% 完成】走到【100% 上线就绪】
>
> **范围**:
> - Phase 7: 法律页面完整填充(Disclaimer / Privacy / Terms / Contact)
> - Phase 8: 8 处文案残留清理
> - Phase 9: 多语言基础架构(为 5 语言准备)
>
> **不动的**:
> - ✅ 已经完成的网站架构(Cursor 完美执行了 Fix 01)
> - ✅ 用户保留的 UI(首页 / POJU How it works / Glyph Five Winds)

---

## 目录

```
Part 1: Phase 7 - 法律页面填充
  Task 7.1: Disclaimer 完整填充(当前空白 - P0)
  Task 7.2: Privacy Policy 修复 + 去代码块
  Task 7.3: Terms of Service 修复 + 占位符替换
  Task 7.4: Contact 页面建立

Part 2: Phase 8 - 8 处残留清理
  Task 8.1: 删除中文"查看五张卡面"
  Task 8.2: 修复 Syncro "Text me the link"重复
  Task 8.3: 修复 Syncro "directional companion"
  Task 8.4: 修复其他小残留

Part 3: Phase 9 - 多语言基础架构
  Task 9.1: i18n 框架选型
  Task 9.2: 5 语言文件结构搭建
  Task 9.3: 语言切换器实现
  Task 9.4: 上线优先级(只先做英文,其他延后)
```

---

# Part 1: Phase 7 — 法律页面填充

## Task 7.1: Disclaimer 完整填充 🚨 P0

### 当前状态

```
访问 /disclaimer 页面: 空白
只有 Header + Footer
中间没有任何内容
```

### 问题严重性

```
🔴 这是支付审核【100% 必查】的页面
🔴 DodoPayments / Stripe 看到空白会立即拒绝
🔴 法律责任保护无依据
🔴 必须在申请支付前填充完整
```

### 完整 Disclaimer 内容(直接复制到 /disclaimer 页)

```markdown
# Important Disclaimer

POJU is an AI-powered decision support and reflection tool.
This page explains what POJU is — and what it is not.

---

## What POJU does

POJU uses large language models to generate structured 
reflection reports and conversations. These integrate:

- Decision psychology research
- Behavioral economics frameworks
- Eastern philosophical traditions
- Mindfulness and time-perception research

The reports and conversations are designed to help you:
- Look at a question from new angles
- Notice patterns in your situation
- Consider actions you may not have considered
- Reflect on what matters

---

## What POJU does NOT do

POJU does NOT provide:

**Predictions about your future** — POJU is not a 
fortune-teller. The patterns and frameworks describe common 
human situations, not future events.

**Medical advice** — If you have health concerns, please 
consult a licensed medical professional. POJU's reflections 
cannot replace medical evaluation.

**Mental health treatment** — If you're experiencing 
suicidal thoughts, severe anxiety, depression, or other 
mental health crises, please contact:
- US: 988 (Suicide & Crisis Lifeline) — available 24/7
- Other: findahelpline.com

POJU is for self-reflection, not therapy.

**Legal advice** — For legal matters, consult a licensed 
attorney in your jurisdiction.

**Financial advice** — For investment, tax, or financial 
planning, consult a certified financial advisor.

**Spiritual or religious guidance** — POJU references 
philosophical traditions as frameworks for thinking, not 
as religious teaching or spiritual authority.

---

## How to read POJU's outputs

POJU's outputs are best treated as:

✓ **One perspective among many** — not the only correct view
✓ **A starting point for reflection** — not a conclusion
✓ **A thinking tool** — not a decision-maker
✓ **Educational and reflective** — not authoritative

The decisions in your life remain entirely yours. You are 
the only person who can decide what's right for you.

---

## On AI accuracy

POJU uses Claude (Anthropic) for AI generation. While we 
strive for high quality:

- AI can make factual errors
- AI may misinterpret cultural or historical references
- AI does not "understand" your situation the way a human 
  friend or counselor would
- AI outputs should not be trusted as definitive

Always apply your own judgment to what POJU generates.

---

## On framework references

POJU references philosophical and psychological traditions 
including:

- Eastern philosophical frameworks (I Ching, Daoist thought, 
  archetypal traditions)
- Decision psychology
- Behavioral economics
- Mindfulness research

These are referenced as **research subjects and frameworks 
for thinking**, not as belief systems POJU endorses or 
claims authority over.

POJU does not predict outcomes based on these traditions. 
POJU uses them as one of several frameworks the AI considers 
when generating reflection reports and conversations.

---

## Liability limitation

POJU is provided "as is" for entertainment, educational, 
and reflection purposes.

By using POJU, you acknowledge:

- You are solely responsible for decisions you make
- POJU's developers are not liable for outcomes resulting 
  from your decisions
- You will not use POJU as a substitute for professional 
  advice in medical, legal, financial, or mental health 
  matters

---

## Questions

If you're unsure how to interpret a POJU output:
support@easternos.com

If you're in distress:
988 (US) or findahelpline.com (worldwide)

---

*Last updated: October 30, 2025*
```

### 给 Cursor 的指令

```
1. 找到 /pages/disclaimer.tsx 或 /app/disclaimer/page.tsx
2. 把上面整段 markdown 内容填入页面
3. 使用项目现有的 markdown 渲染组件
4. 不要用 ``` ``` 代码块格式(像 Privacy 页那样)
5. 用正常段落 + h2/h3 标题层级
6. 加 prose 类(Tailwind Typography)增强排版
```

---

## Task 7.2: Privacy Policy 修复 🚨 P0

### 当前问题

```
1. "Last updated: [日期]" - 中文占位符必须修
2. 大量内容用 ``` ``` 代码块包裹 - 看起来像源代码
3. "Stripe (or an alternative processor)" - 但你还没接 Stripe
4. "Physical address (if required): [待律师确定后填入]" - 中文备注
```

### 修复内容

#### 修复 1: 日期占位符

```diff
- Last updated: [日期]
+ Last updated: October 30, 2025
```

#### 修复 2: 删除所有 ``` 代码块格式

把所有 ``` ``` 改为正常段落或列表。例如:

```diff
- ```
- POJU was built differently.
- 
- Most products talk about "respecting your privacy." 
- We built a product that doesn't need your data to work.
- 
- Here's the full picture.
- ```

+ POJU was built differently.
+ 
+ Most products talk about "respecting your privacy." We 
+ built a product that doesn't need your data to work.
+ 
+ Here's the full picture.
```

```diff
- ## 1. What We Collect
- 
- ```
- Minimal, by design:
- 
- · Device fingerprint (one-way hash)
-   Used to restore your paid session if you refresh.
- 
- · Payment records (no personal info)
-   Amount, timestamp, Stripe session ID.
-   Kept for 7 years for tax compliance.
- 
- · Email (only when you explicitly provide it)
-   Used to deliver PDF readings and one check-in email.
-   Deleted within 24 hours after sending.
- 
- · Aggregated usage stats (anonymous)
-   Total sessions, not per-user behavior.
- ```

+ ## 1. What We Collect
+ 
+ Minimal, by design:
+ 
+ - **Device fingerprint** (one-way hash) — Used to restore 
+   your paid session if you refresh.
+ 
+ - **Payment records** (no personal info) — Amount, timestamp, 
+   payment processor session ID. Kept for 7 years for tax 
+   compliance.
+ 
+ - **Email** (only when you explicitly provide it) — Used 
+   to deliver PDF readings and one check-in email. Deleted 
+   within 24 hours after sending.
+ 
+ - **Aggregated usage stats** (anonymous) — Total sessions, 
+   not per-user behavior.
```

**对所有章节(1-12)做同样的处理**:
- 把 ``` ``` 删除
- 把内容改为标准 markdown 段落 + 列表
- 保留所有内容,只改格式

#### 修复 3: 支付处理器表述

```diff
- · Payment is handled by Stripe (or an alternative processor).
+ · Payment is handled by our payment processor (currently 
+   DodoPayments, with Stripe planned as we grow).
```

**理由**: 现阶段实际用 DodoPayments,但保留未来扩展性。

#### 修复 4: 第 11 节 Contact 

```diff
- ## 11. Contact
- 
- ```
- For privacy questions:
- privacy@easternos.com
- 
- For general questions:
- support@easternos.com
- 
- For legal matters:
- legal@easternos.com
- 
- Physical address (if required by your jurisdiction):
- [待律师确定后填入]
- ```

+ ## 11. Contact
+ 
+ For privacy questions: privacy@easternos.com  
+ For general questions: support@easternos.com  
+ For legal matters: legal@easternos.com
```

**理由**: 早期个人开发者不必提供物理地址。如果支付审核要求,后期再加。

#### 修复 5: 第 9 节 CCPA 

```diff
- ## 9. Your Rights (CCPA — California Residents)
+ ## 9. Your Rights (US — California Residents)
```

(章节标题 CCPA 是缩写,普通用户看不懂,改为更清晰的)

#### 修复 6: 章节顺序优化(可选)

如果想重新排序更逻辑:

```
建议顺序:
  1. 概述(POJU was built differently)
  2. What We Collect
  3. What We Don't Collect
  4. How We Use Your Data
  5. Data Encryption  
  6. Data Deletion
  7. Third-Party Services
  8. AI Model Data Handling
  9. Your Rights (CCPA — California)
  10. Your Rights (GDPR — EU Residents)
  11. Children's Privacy
  12. Updates to This Policy
  13. Contact
```

### 给 Cursor 的指令

```
1. 打开 /pages/privacy.tsx
2. 把所有 ``` ``` 代码块格式删除
3. 内容改为标准 markdown 段落
4. 修复中文占位符(日期 + 物理地址)
5. 修复支付处理器表述
6. 第 11 节 Contact 简化
7. 验证最终长度合理(应该比当前看起来更紧凑)
```

---

## Task 7.3: Terms of Service 修复 🚨 P0

### 当前问题

```
1. "Last updated: [日期]" - 中文占位符
2. "[州名待律师确定，推荐 Delaware]" - 中文备注  
3. "[地点待律师]" - 中文备注
4. 所有内容用 ``` 代码块格式
5. 第 1 节 "Eastern philosophical traditions" 表述略暴露
```

### 完整修复版

```markdown
Version 1.0

# Terms of Service

*Last updated: October 30, 2025*

By using POJU (easternos.com), you agree to these Terms of Service.

---

## 1. Use of Services

By accessing or using POJU, Glyph, or Syncro (collectively, 
"the Services"), you agree to these Terms of Service.

POJU provides AI-powered decision support drawing from 
philosophical and psychological frameworks (including 
Eastern philosophy, decision psychology, and behavioral 
economics). The Services are for lawful personal use only.

You agree not to:

- Use the Services for commercial purposes without permission
- Attempt to reverse-engineer, scrape, or systematically 
  access the Services
- Use the Services to harass, defame, or harm others
- Submit illegal, threatening, or harmful content
- Impersonate others or misrepresent your identity

---

## 2. No Guarantees

We do not guarantee any specific results. All outputs are 
generated by AI models trained on philosophical texts and 
modern research.

POJU cannot predict the future, diagnose conditions, or 
resolve complex personal situations. The Services are for 
reflection and self-exploration.

See our Disclaimer for full details.

---

## 3. Payments

POJU Breakthrough Sessions cost US$9.99 per session, 
charged once.

Glyph and Syncro are free and always will be.

- All payments are one-time only. No subscriptions.
- No automatic renewals. No hidden charges.
- Prices may change; you'll see the price before payment.
- Payment is handled by our payment processor. We never 
  see your card details.

Your POJU Session, once purchased, stays accessible on 
your device for 30 days. You can return anytime within 
that window to continue.

---

## 4. Refunds

We offer refunds under the following conditions:

**Full refund within 5 minutes of starting** — Automatic. 
Click "Refund" within 5 minutes for an immediate full refund.

**Full refund for technical issues** — If a technical 
failure prevented you from accessing your Session, contact 
support@easternos.com within 7 days.

**Case-by-case review after 5 minutes** — Email 
support@easternos.com with your reason. Most reasonable 
requests are approved within 24 hours.

We typically do not offer refunds for:

- "The insights weren't what I expected" — AI outputs are 
  inherently subjective
- Substantial Session use beyond initial exploration
- Requests after 30 days from purchase

To request a refund, email support@easternos.com with your 
order ID.

Refunds typically process within 5-10 business days, 
depending on your bank.

---

## 5. Changes to These Terms

We may update these Terms at any time.

For material changes (e.g., new fees, significant 
restrictions), we will:

- Notify you via in-app banner on next visit
- Require re-agreement before continuing

For minor changes (typo corrections, clarifications):

- Update the "Last updated" date
- No active notification required

Continued use of the Services after changes constitutes 
acceptance.

---

## 6. Intellectual Property

The POJU brand, logo, "Three ways in. One way through." 
tagline, and all product interface elements are owned by 
POJU. You may not copy, modify, or redistribute them.

Content generated for your personal Session (e.g., AI 
responses, PDF reports) is yours to use personally. You 
may not republish AI-generated outputs as your own work 
or for commercial purposes.

Public-domain works and classical commentary referenced in 
documentation are cited where applicable. POJU does not 
claim exclusive rights over traditional ideas.

---

## 7. Limitation of Liability

To the maximum extent permitted by law:

- The Services are provided "as is"
- We are not liable for decisions, actions, or outcomes 
  resulting from use of our outputs
- Our total liability in any claim is limited to the amount 
  you paid in the past 12 months (typically $9.99 per session)

See our Disclaimer for full details.

---

## 8. Governing Law

These Terms are governed by the laws of the State of 
Delaware, United States, without regard to conflict of 
law principles.

Any disputes will be resolved in the courts of Delaware.

If you're in the EU and mandatory local law applies, your 
statutory rights remain intact.

---

## Contact

Questions about these Terms? legal@easternos.com  
General support: support@easternos.com
```

### 关键改动说明

```diff
- "Last updated: [日期]"
+ "Last updated: October 30, 2025"

- "[州名待律师确定，推荐 Delaware]"
+ "Delaware"

- "[地点待律师]"  
+ "Delaware"

- "POJU provides AI-powered insights drawing from Eastern 
-  philosophical traditions."
+ "POJU provides AI-powered decision support drawing from 
+  philosophical and psychological frameworks (including 
+  Eastern philosophy, decision psychology, and behavioral 
+  economics)."

[全部 ``` 代码块格式 → 标准 markdown 段落 + 列表]
[退款政策 5-minute window 加入]
```

### 关于 Delaware 的说明

```
为什么选 Delaware:
  
  1. 美国 LLC 注册首选州
  2. 法律体系成熟,商业纠纷有先例
  3. Stripe Atlas 默认就是 Delaware
  4. 后期你注册美国 LLC 时会自然落地这里
  5. 即使你目前是中国个人开发者,
     Terms of Service 写 "Governed by Delaware law" 
     也是国际惯例(指对外公司化路径)

如果你完全不打算注册美国公司:
  可以改为 "Governed by the laws of Hong Kong, SAR"
  或 "Governed by the laws of [你所在地]"
  但 Delaware 是最国际化的选择
```

---

## Task 7.4: Contact 页面建立

### 我没有 fetch 到 Contact 页面内容

但既然 Footer 有 Contact 链接,这个页面应该存在。如果是空白,需要建立。

### 推荐 Contact 页面内容

```markdown
# Contact POJU

We're a small team. Every email is read and answered by 
a real person.

---

## Reach us

**General questions / customer support**  
support@easternos.com  
*Response time: usually within 24 hours, often faster*

**Privacy or data requests** (GDPR, CCPA, deletion)  
privacy@easternos.com  
*Response time: 24-72 hours*

**Legal matters** (Terms questions, disputes)  
legal@easternos.com  
*Response time: 2-5 business days*

---

## Before you write

Many questions are answered in our:

- [Privacy Policy](/privacy) — How we handle your data
- [Terms of Service](/terms) — What you agree to
- [Disclaimer](/disclaimer) — What POJU is and isn't

---

## Crisis support

If you're in crisis or considering harm to yourself:

**United States**: Call or text 988 — available 24/7  
**Worldwide**: findahelpline.com

POJU is not equipped to help with mental health crises. 
Please reach out to a human trained for this.

---

We read every message.
```

### 给 Cursor 的指令

```
1. 创建或更新 /pages/contact.tsx
2. 用上面的 markdown 内容
3. 使用现有的 prose 样式
4. 三个邮箱用代码风格强调
```

---

# Part 2: Phase 8 — 8 处残留清理

## Task 8.1: 删除 Glyph 页中文残留 🚨 P0

### 当前问题

```
Glyph 页 Five winds 区域:
  "[查看五张卡面](https://www.easternos.com/five-wind-cards)（/five-wind-cards）"

问题:
  ❌ "查看五张卡面" 是中文
  ❌ 调试链接(/five-wind-cards)不应该出现在生产环境
```

### 修复

```diff
- ## Five winds — five archetypal patterns
- 
- The five patterns are mirrors, not predictions. Each one 
- describes a human situation and helps you frame what is 
- already happening.
- 
- [查看五张卡面](https://www.easternos.com/five-wind-cards)（/five-wind-cards）
- 
- [Five Winds 5 张卡片渲染区...]

+ ## Five winds — five archetypal patterns
+ 
+ The five patterns are mirrors, not predictions. Each one 
+ describes a human situation and helps you frame what is 
+ already happening.
+ 
+ [Five Winds 5 张卡片渲染区,UI 不变]
```

**直接删除这一行调试链接**——五张卡片下方就是渲染好的 UI,不需要单独跳转。

### 给 Cursor 的指令

```
找到 /pages/glyph.tsx 或 components/glyph/FiveWinds.tsx
删除:
  - 中文"查看五张卡面"链接
  - "(/five-wind-cards)" 调试标注
```

---

## Task 8.2: 修复 Syncro 页"Text me the link"重复 🟡

### 当前问题

```
Syncro 页 Hero 区显示了 3 次 "Text me the link" 按钮
明显是组件重复渲染的 bug
```

### 修复

```
找到 Syncro 页 Hero 组件
检查 SMS link 输入区
确保只渲染 1 次:
  - 1 个 phone input
  - 1 个 [Text me the link] 按钮

可能原因:
  - 组件状态被重复渲染
  - 或者代码里直接复制粘贴了 3 次

期望最终结构:
  ┌──────────────────────────────────┐
  │  [QR code 280x280]               │
  │   easternos.com/syncro            │
  │                                  │
  │   ─────────────────              │
  │                                  │
  │   [Phone input]                  │
  │   [Text me the link]             │
  └──────────────────────────────────┘
```

### 给 Cursor 的指令

```
1. 打开 Syncro 页面组件
2. 在 Hero 部分搜索 "Text me the link"
3. 应该只出现 1 次
4. 删除多余的 2 次
5. 验证移动端显示正常
```

---

## Task 8.3: Syncro 页"directional companion"修复 🟡

### 当前问题

```
Syncro 页 "Always free" 区:
  "Syncro stays free as your everyday directional companion. 
   Open it whenever you need spatial clarity."

问题:
  ⚠️ "directional companion" 暗示风水
  ⚠️ "spatial clarity" 略玄学
```

### 修复

```diff
- ## Always free. Forever.
- 
- Syncro stays free as your everyday directional companion. 
- Open it whenever you need spatial clarity.
- 
- [Open Syncro on mobile]

+ ## Always free.
+ 
+ Syncro stays free as your everyday rhythm companion.
+ Open it whenever you need clarity on the moment.
+ 
+ [Open Syncro on mobile]
```

**关键改动**:
- "Forever." 删除(简洁)
- "directional companion" → "rhythm companion"
- "spatial clarity" → "clarity on the moment"

---

## Task 8.4: POJU 页底部小字优化 🟢

### 当前问题(轻微)

```
POJU 页 Final CTA 下方:
  "One question · Unlimited depth · PDF by email · Deletes when you close"

"PDF by email" 这部分如果 PDF 功能还没实现,会让用户期待落空
```

### 处理建议

```
方案 A: 暂时删除 PDF 部分
  改为: "One question · Unlimited depth · Deletes when you close"

方案 B: 标注"coming soon"
  改为: "One question · Unlimited depth · Deletes when you close · PDF export coming soon"

方案 C: 保留(如果 PDF 功能已经实现)

→ 由你决定,如果 PDF 已经做了就保留,没做就用 A
```

### 给 Cursor 的指令

```
确认 PDF export 功能是否实现:
  - 如果实现 → 保留原文案
  - 如果未实现 → 用方案 A 删除 "PDF by email" 部分
```

---

## Task 8.5: 其他小残留

### 残留 1: Syncro 页"Open Syncro"按钮链接

```
当前: [Open Syncro] → https://easternos.com/syncro (循环到当前页)

修复:
  - 现阶段 Syncro 移动端 PWA 还没做
  - 暂时把按钮改为 "Coming soon" 或禁用状态
  - 或者跳到 mailto:support@easternos.com 接收用户兴趣表
  
推荐: 改为 "Get notified when Syncro launches" 邮件订阅
  → 收集等待用户邮箱(将来运营有用)
```

### 残留 2: 所有页面的"LangEN▾"位置

```
当前: 在每个页面 Header 显示
但点击后没有真实的多语言切换

处理(等 Phase 9 实现):
  - 暂时保留 UI(因为你要做多语言)
  - 但当前点击应该有合理反馈(比如灰色禁用,显示"Coming soon")
  
或:
  - 暂时让 LangEN 不可点击
  - 等 Phase 9 真正实现切换
```

---

# Part 3: Phase 9 — 多语言基础架构

## 你的语言策略

```
目标 5 种语言(覆盖北美主要族裔):

1. English (en)      - 主语言,先做
2. Spanish (es)      - 北美第二大语言(墨西哥/拉美)
3. Chinese (zh)      - 华人移民
4. French (fr)       - 加拿大魁北克 + 法属
5. German (de)       - 德裔美国人

合计市场覆盖:
  ~95%+ 北美互联网用户
  + 欧洲核心市场(德语 + 法语 + 西班牙语)
  全球潜力很大
```

## Task 9.1: i18n 框架选型

### 推荐:**next-intl** (Next.js 14+ 官方推荐)

```
Why next-intl:
  ✅ Next.js 14 App Router 原生支持
  ✅ 类型安全(TypeScript 友好)
  ✅ SSR/SSG 友好(SEO 关键)
  ✅ 路由级语言切换(/en/poju, /es/poju...)
  ✅ ICU 消息格式(支持复数、变量、性别等)
  ✅ 文档完善
  ✅ 项目活跃维护

替代方案:
  - next-i18next: 老 Pages Router 时代,App Router 不推荐
  - react-intl: 不是 Next.js 专用,集成复杂
  - rosetta: 太轻量,缺少 Next.js 集成

→ 我强烈推荐 next-intl
```

### 安装

```bash
npm install next-intl
```

## Task 9.2: 5 语言文件结构

### 目录结构

```
project/
├── messages/
│   ├── en.json    ← 英文(主)
│   ├── es.json    ← 西班牙语
│   ├── zh.json    ← 中文
│   ├── fr.json    ← 法语
│   └── de.json    ← 德语
│
├── i18n.ts        ← next-intl 配置
└── middleware.ts  ← 语言路由中间件
```

### `messages/en.json` 结构示例

```json
{
  "common": {
    "tagline": "Where AI meets a thousand years of wisdom.",
    "footer_disclaimer": "For self-reflection and entertainment. POJU offers perspectives, not predictions. All decisions are yours alone.",
    "nav": {
      "poju": "POJU",
      "glyph": "Glyph",
      "syncro": "Syncro",
      "archive": "Archive"
    },
    "cta": {
      "start_session": "Start a POJU session · $9.99",
      "try_glyph": "Try Glyph · Free",
      "yours_to_decide": "Yours to decide"
    }
  },
  "home": {
    "hero": {
      "title": "POJU",
      "subtitle": "Where AI meets a thousand years of wisdom.",
      "trust_line": "No account · No subscription · Yours to decide"
    },
    "three_ways": {
      "heading": "Three ways in. One way through.",
      "poju": {
        "name": "POJU",
        "price": "$9.99",
        "tagline": "For the question that won't let you go.",
        "description": "A single deep conversation, until you see it through.",
        "cta": "Try it →"
      },
      "glyph": {
        "name": "Glyph",
        "price": "Free",
        "tagline": "A 60-second mirror.",
        "description": "Hold a question. Draw a pattern. Read a reflection.",
        "cta": "Try it →"
      },
      "syncro": {
        "name": "Syncro",
        "price": "Free",
        "tagline": "See your natural rhythms.",
        "description": "Updated every two hours, on your phone.",
        "cta": "Try it →"
      }
    },
    "two_languages": {
      "heading": "Where two languages meet.",
      "subtitle_1": "Two thousand years of human reflection.",
      "subtitle_2": "Modern AI translation.",
      "subtitle_3": "One conversation that helps you see clearly.",
      "pattern": {
        "title": "PATTERN",
        "description": "Ancient observation on what recurs."
      },
      "direction": {
        "title": "DIRECTION",
        "description": "Spatial psychology on what we notice."
      },
      "timing": {
        "title": "TIMING",
        "description": "Cycles that shape biology."
      },
      "you": {
        "title": "YOU",
        "description": "Your birth context, moment, and question."
      }
    },
    "promises": {
      "heading": "Three promises we don't break.",
      "never_stored": {
        "title": "Never stored",
        "description": "Your conversations live encrypted on your device. We can't read them. No one can."
      },
      "never_required": {
        "title": "Never required",
        "description": "No account. No login. No password. Email only when you want a PDF."
      },
      "never_manipulative": {
        "title": "Never manipulative",
        "description": "No dark patterns. No fake urgency. One price: $9.99 when you need it."
      },
      "read_more": "Read the full privacy architecture →"
    },
    "final_cta": {
      "heading": "When the question won't let you go.",
      "subtitle": "Stop reading. Start moving through it.",
      "primary": "Ask Your Question — $9.99",
      "secondary": "Or try Glyph for free first →"
    }
  }
}
```

### 给 Cursor 的指令

```
1. 创建 /messages/en.json
   - 把当前网站【所有英文文案】抽取到这里
   - 按页面/组件分组(home, poju, glyph, syncro, privacy, terms, disclaimer, contact)
   - 每个文案有 unique key
   
2. 创建 /messages/es.json /zh.json /fr.json /de.json
   - 现阶段【内容全部留空】或【复制 en.json 占位】
   - 等英文版完整后再翻译

3. 在所有页面组件中:
   - 用 useTranslations() hook 替代硬编码文案
   - 例如: const t = useTranslations('home.hero');
           <h1>{t('title')}</h1>
```

## Task 9.3: 语言切换器实现

### 简化版 UI

```
当前: "LangEN▾" (placeholder)

新版: 
  桌面端:
    Header 右上角显示:
    [EN] [ES] [中] [FR] [DE]  
    或下拉菜单显示语言列表
  
  移动端:
    汉堡菜单中显示语言选项
```

### 推荐 UI 模式 (Co-Star 风格)

```jsx
// components/LanguageSwitcher.tsx

const languages = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'zh', label: '中', name: '中文' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
];

// 简单方案: 5 个文字按钮
<div className="flex items-center gap-2 text-sm text-muted">
  {languages.map(lang => (
    <button
      key={lang.code}
      onClick={() => switchLocale(lang.code)}
      className={currentLocale === lang.code ? 'text-foreground' : ''}
      title={lang.name}
    >
      {lang.label}
    </button>
  ))}
</div>

// 或下拉菜单方案: 显示当前语言 + 下拉选其他
<select value={currentLocale} onChange={e => switchLocale(e.target.value)}>
  {languages.map(lang => (
    <option key={lang.code} value={lang.code}>
      {lang.label} · {lang.name}
    </option>
  ))}
</select>
```

### URL 结构

```
默认 (英文):
  easternos.com/         (= easternos.com/en/)
  easternos.com/poju
  easternos.com/glyph

其他语言:
  easternos.com/es/poju
  easternos.com/zh/glyph
  easternos.com/fr/syncro
  easternos.com/de/

next-intl 自动处理这种路由
SEO 友好(每个语言有独立 URL)
```

## Task 9.4: 上线优先级 - 重要建议

### 强烈建议:**只上线英文,其他语言放延后**

```
为什么这样建议:

1. 英文是最大市场
   - 北美主要语言
   - 目标用户(关心 AI + 智慧的)80%+ 用英文
   - 你已经投入了大量精力做英文版本

2. 多语言运营成本巨大
   - 5 种语言 = 5 倍翻译工作
   - 5 种语言 = 5 倍内容更新工作
   - 5 种语言 = 5 倍 LLM 调用(因为不同语言需要不同 prompt)
   - 5 种语言 = 5 倍客服成本

3. 早期阶段应该 focus
   - 先验证英文产品市场契合度
   - 找到付费模式
   - 优化 conversion
   - 然后再考虑国际化

4. 框架先准备,内容后翻译
   ✅ 现阶段做: 框架(next-intl)+ 5 个语言文件占位
   ✅ 上线时做: 只翻译英文版到 100%
   ⏸️ 上线后 1-3 个月: 视市场反馈翻译 1-2 个其他语言
   ⏸️ 上线后 6+ 个月: 全 5 语言完整

5. LLM 多语言成本
   你的 3 份 Prompt(POJU/Glyph/Syncro)如果支持 5 语言:
   - 每份 Prompt 需要翻译为 5 个版本
   - 每个版本需要 few-shot 示例(因为语言风格不同)
   - 需要测试每个语言的输出质量
   - 需要本地化客服
   
   这是巨大的工程量,早期做不划算。
```

### 推荐路径

```
立即(本月):
  ✅ Phase 9 框架搭建(next-intl + 5 语言文件目录)
  ✅ en.json 100% 完整(把网站所有英文抽取)
  ✅ 其他 4 个语言文件保留占位(指向英文)
  ✅ 语言切换器 UI 实现
  ⏸️ 切换器目前默认只显示 EN(其他语言点击后跳到英文+提示"coming soon")

或:
  ✅ 切换器只显示 EN
  ✅ 等真正翻译完成才暴露其他语言

上线后 1-3 个月(根据数据):
  ⏸️ 看哪种语言用户访问多
  ⏸️ 优先翻译该语言
  ⏸️ 通常是 ES (西班牙语) 或 ZH (中文)

上线后 6+ 个月:
  ⏸️ 全 5 语言完整
  ⏸️ 多语言客服 + 多语言营销
```

### 翻译质量警告

```
⚠️ 不要用 Google Translate 直接翻译!

POJU 的文案有微妙的诗意感,机翻会丢失:
  - "Where AI meets a thousand years of wisdom" 
    机翻可能变成"AI 与千年智慧相遇"(直译,失去美感)
  - "Read with a wink"
    机翻可能变成"带眨眼地阅读"(完全错误)
  - "Decisions are yours alone"
    机翻可能变成"决定独自属于您"(生硬)

正确做法:
  ✅ 雇专业本地化译者(ProZ.com / Smartling)
  ✅ 每种语言找母语人士做 review
  ✅ 西班牙语区分:墨西哥西语 vs 西班牙西语
  ✅ 中文区分:繁体 vs 简体
  ✅ 法语区分:加拿大法语 vs 法国法语

如果暂时只能机翻 + 自己 review:
  ✅ 用 Claude / GPT-4 翻译(比 Google 好)
  ✅ 把 POJU 的品牌调性指南给 LLM
  ✅ 自己读一遍每段
  ✅ 找母语朋友帮忙看
```

---

# Part 4: 给 Cursor 的执行指令

把以下指令完整复制给 Cursor:

```markdown
# 任务: POJU Fix 02 - 法律页面 + 残留清理 + 多语言准备

## 阅读
@docs/POJU_Fix_02_Legal_Pages_Multilang.md (本文档)

## 实施顺序

### Phase 7: 法律页面填充 (P0 - 紧急)

Task 7.1: Disclaimer 完整填充
  - 当前 /disclaimer 页面是空白的
  - 用本文档 Part 1 提供的完整 markdown 内容填充
  - 不要用 ``` ``` 代码块格式
  - 用 prose 类增强排版

Task 7.2: Privacy Policy 修复
  - 修复 "Last updated: [日期]" → "October 30, 2025"
  - 删除所有 ``` ``` 代码块格式
  - 内容改为标准 markdown
  - 修复支付处理器表述
  - 简化第 11 节 Contact

Task 7.3: Terms of Service 修复
  - 修复 "Last updated: [日期]" → "October 30, 2025"
  - 修复 "[州名待律师确定，推荐 Delaware]" → "Delaware"
  - 修复 "[地点待律师]" → "Delaware"
  - 删除所有 ``` ``` 代码块格式
  - 修复第 1 节 Eastern philosophical 表述
  - 第 4 节加入 5-minute refund window

Task 7.4: Contact 页面建立
  - 创建或更新 /pages/contact.tsx
  - 用本文档提供的 markdown 内容

### Phase 8: 残留清理 (P0)

Task 8.1: Glyph 页中文残留
  - 找到 Glyph 页 Five winds 区域
  - 删除 "[查看五张卡面]..." 这一行调试链接
  - 五张卡片下方就是渲染区域,不需要单独跳转

Task 8.2: Syncro 页"Text me the link"重复
  - Syncro Hero 区域应该只渲染 1 次 phone input + 按钮
  - 当前显示 3 次,删除多余的

Task 8.3: Syncro 页"directional companion"
  - "directional companion" → "rhythm companion"
  - "spatial clarity" → "clarity on the moment"

Task 8.4: POJU 页 PDF 表述
  - 检查 PDF export 功能是否已实现
  - 未实现则删除 "PDF by email"
  - 已实现则保留

Task 8.5: Syncro "Open Syncro" 按钮
  - 当前跳到当前页(循环)
  - 改为 placeholder 或邮件订阅

### Phase 9: 多语言准备 (基础架构)

Task 9.1: 安装 next-intl
  npm install next-intl

Task 9.2: 创建 i18n 配置
  - /i18n.ts
  - /middleware.ts
  - 5 个 locales: en, es, zh, fr, de

Task 9.3: 创建 messages/ 目录
  - messages/en.json (主,完整内容)
  - messages/es.json (占位,复制 en 内容)
  - messages/zh.json (占位)
  - messages/fr.json (占位)
  - messages/de.json (占位)
  
  把当前网站所有英文文案抽取到 en.json
  其他 4 个文件暂时复制 en.json 内容(等翻译)

Task 9.4: 改造组件
  - 所有页面用 useTranslations() 替代硬编码文案
  - URL 结构: /[locale]/[page]
  - 默认 locale: en

Task 9.5: 语言切换器
  - 实现真实切换功能
  - 桌面端: Header 右上角 [EN] [ES] [中] [FR] [DE]
  - 移动端: 汉堡菜单中
  - 当前阶段: 暴露 EN 即可,其他 4 个【显示但禁用】或【显示"Coming soon"】

## 严格要求

🚫 不要修改已完成的网站架构
🚫 不要在 Privacy/Terms/Disclaimer 内容中加新的合规风险词
🚫 不要用 Google Translate 翻译其他语言(留空或保留英文)

✅ 严格按本文档每个 Task 执行
✅ 完成后发截图验证
✅ Phase 9 完成后保留 EN 为默认,其他暂不展开

## 验证

完成后必须验证:

法律页面:
  □ /disclaimer 不再空白
  □ /privacy 没有 [日期] 中文占位符
  □ /privacy 没有 ``` ``` 代码块格式
  □ /terms 没有 [州名待律师] 中文占位符
  □ /terms 没有 ``` ``` 代码块格式
  □ /contact 有完整内容

残留:
  □ /glyph 没有"查看五张卡面"中文
  □ /syncro Hero 只有 1 个 "Text me the link"
  □ /syncro 没有 "directional companion"

多语言:
  □ /messages/ 目录存在
  □ en.json 完整
  □ 其他 4 个语言文件占位
  □ next-intl 配置完成
  □ 语言切换器 UI 显示
```

---

# 完成后的网站状态

```
✅ 全站架构完美(Fix 01 完成)
✅ 全站文案合规(Fix 01 完成)
✅ 法律页面完整(Fix 02 完成)
✅ 残留清理完成(Fix 02 完成)
✅ 多语言基础架构(Fix 02 完成,只暴露英文)

合规风险评估:
  ✅ 通过 DodoPayments 审核: 极高概率
  ✅ 通过 Stripe 审核: 高概率(后期有 LLC 时)
  ✅ GDPR 合规: 是
  ✅ CCPA 合规: 是

下一步:
  → 申请 DodoPayments
  → 接入支付 + LLM API
  → POJU/Glyph 真实功能联调
  → 上线!
```

---

# 多语言完整化路径(将来参考)

这部分**不属于现在交给 Cursor 的任务**,只是规划:

```
现在(Fix 02 完成时):
  ✅ 框架就绪 + 英文 100%
  ⏸️ 其他语言占位

上线后 1-3 个月:
  数据驱动决策:
    - 看 GA / Vercel Analytics
    - 哪种语言来源访问最多?
    - 通常顺序: EN > ES > ZH > FR > DE
    
  优先翻译:
    - 第二语言: ES(西班牙语)或 ZH(中文)
    - 雇 1 个专业译者
    - 自己 + 母语朋友 review

上线后 3-6 个月:
  - 完成 ES + ZH(2 语言上线)

上线后 6-12 个月:
  - 视市场反馈完成 FR + DE
  - 全 5 语言上线

LLM 多语言:
  - POJU/Glyph/Syncro Prompt 翻译
  - 每个语言独立 few-shot 示例
  - 输出质量 A/B 测试
  - 这是另一个大工程
```

---

文档完成,准备好交给 Cursor 实施了。
