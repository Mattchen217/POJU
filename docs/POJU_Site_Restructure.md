# POJU 网站完整重构文档

> **本文档目的**:对 POJU 网站做架构层面的精简重构,而非逐字修改。
>
> **设计参考**:Co-Star (极简) + Stripe (清晰层级) + Headspace (温暖留白)
>
> **核心哲学**:
> - 当前网站的最大问题不是文案,是【信息过载】和【内容重复】
> - Co-Star 月活 2000 万的秘密:**Aesthetic-Usability Effect + Ockham's Razor + Pareto Principle**
> - 80% 的用户决策由 20% 的内容驱动 → 删除 80% 冗余,留 20% 精华
>
> **保留的 UI(用户已设计)**:
> - 首页整体视觉风格(配色、字体、动效)
> - POJU 页 "How POJU works" 6 步流程
> - Glyph 页 "Five Winds" 5 张卡片展示

---

## 目录

```
Part 1: 整体诊断 - 当前网站的 6 大问题
Part 2: 新架构总览 - 4 个页面的目标长度
Part 3: 首页重构 - 从 9 板块到 5 板块  
Part 4: POJU 页重构 - 从 8 板块到 4 板块
Part 5: Glyph 页重构 - 从 9 板块到 4 板块
Part 6: Syncro 页重构 - 从 11 板块到 5 板块(重大重构)
Part 7: 隐私 / Disclaimer / Terms 三页 - 单独文档处理
Part 8: 全站统一改动(导航、Footer、字体、间距)
Part 9: 给 Cursor 的执行指令
```

---

# Part 1: 整体诊断

## 当前网站的 6 大根本问题

### 问题 1:重复内容污染

```
"POJU 是什么" 在 4 个地方说:
  - 首页 Hero
  - 首页三件套卡片
  - POJU 页 Hero
  - POJU 页主介绍段
  
"隐私承诺" 在 3 个地方说:
  - 首页"Designed for Real Life"
  - 首页"Three promises"  
  - 首页"Privacy isn't a checkbox" 长篇说明

"Glyph vs POJU" 对比在 2 个地方有:
  - POJU 页
  - Glyph 页

→ 用户感觉网站在【自我重复】,而不是【层层递进】
```

### 问题 2:Hero 文案重复

```
首页 Hero:
  "Where AI meets a thousand years of wisdom.
   When one question keeps circling back, POJU sits with you 
   through it. Backed by AI. Grounded in millennia of human 
   reflection."

POJU 页 Hero:
  "Breakthrough sessions for the question that won't let you go.
   When you've read the books, talked to friends, and still 
   can't see clearly, POJU sits with you through it. An AI agent 
   grounded in millennia of human reflection."

→ 几乎一模一样的话讲两次
→ 用户从首页跳到 POJU 页,感觉"咦?这不是一样的吗"
```

### 问题 3:对比表都是满分

```
POJU 页 "Why POJU is different":
  
  Feature        Co-Star  ChatGPT  Real Master  POJU
  Depth          ●●●●     ●●●●     ●●●●         ●●●●
  Actionable     ●●●●     ●●●●     ●●●●         ●●●●
  Eastern Base   ●●●●     ●●●●     ●●●●         ●●●●
  Privacy        ●●●●     ●●●●     ●●●●         ●●●●

→ 全是满分!这显然是 placeholder 没填
→ 即使填了,对比 ChatGPT/Co-Star 显得【虚张声势】
→ Co-Star 自己从来不做这种对比表
```

### 问题 4:Syncro 页直接合规炸雷

```
出现的高危词:
  - GANZHI · BAGUA · WUXING · KANYU
  - "Eastern side" 对照表
  - "Directional Qi tendency"
  - "Bazi-aligned blueprint"
  
→ 任何一个支付审核员看到这些
→ 立即归类为"fortune-telling"
→ 拒绝商户申请
```

### 问题 5:伪权威研究引用

```
首页有 4 个研究引用:
  [COGNITIVE NEUROSCIENCE / 2024]
  [ENVIRONMENTAL PSYCHOLOGY / 2019]
  [CHRONOBIOLOGY REVIEW / 2022]
  [VISUAL COGNITION / 2021]

问题:
  - 没有作者
  - 没有 DOI
  - 没有具体论文标题
  - 用户搜不到 = 看起来像编的

→ Co-Star 引用 NASA 是真的可验证
→ 你的引用看起来像装饰文案
```

### 问题 6:CTA 太多但目标不清

```
首页有 4 个 CTA 按钮:
  - "Start a POJU session · $9.99"
  - "Try Glyph · Free"  
  - "Open Syncro" (在三件套卡片里)
  - "Read our full Privacy Policy"
  - "Ask Your Question →"(底部)

→ 用户不知道该点哪个
→ Co-Star 首页只有 1 个主 CTA: "Get the App"
→ 选择悖论:选择越多,转化越低
```

---

# Part 2: 新架构总览

## 4 个页面的新长度目标

```
当前 → 目标:

首页:    9 板块 / ~6 屏  →  5 板块 / ~3 屏  (减少 50%)
POJU:    8 板块 / ~5 屏  →  4 板块 / ~3 屏  (减少 40%)
Glyph:   9 板块 / ~5 屏  →  4 板块 / ~2 屏  (减少 60%)
Syncro:  11 板块 / ~6 屏  →  5 板块 / ~3 屏  (减少 50%, 重构)

总长度减少: 50%+
关键体验: 用户 3 屏内决定要不要付 $9.99
```

## 信息架构原则

```
1. 不重复
   每个事实只在最适合的一个地方讲
   
2. 不防御
   不需要对每个潜在质疑都回应
   过度解释 = 自损可信度
   
3. 让产品自己说话
   减少"为什么我们好"的论述
   增加"你能用我们做什么"的演示
   
4. 一个目标一个 CTA
   每屏只有一个最重要的 CTA
   其他链接走 Footer 或下方副位置
```

---

# Part 3: 首页重构

## 当前 → 新架构

```
当前 9 板块:
[1] Hero
[2] 三件套卡片
[3] Designed for Real Life (No Sign Up / Privacy First / Yours Only)
[4] Where two truths meet (ANCIENT/MODERN/AI/YOU)
[5] What Eastern traditions observed
[6] QI · XUAN · BAZI · YUAN
[7] Three promises
[8] Privacy isn't a checkbox
[9] Ready to break through CTA

新 5 板块:
[1] Hero (保留,优化文本)
[2] 三件套快速入口 (合并 [2]+[3])
[3] 双锚定 (压缩合并 [4]+[5]+[6])
[4] 隐私承诺 (压缩合并 [7]+[8])
[5] Final CTA + Footer
```

---

## 板块 1: Hero (保留 + 优化)

### UI 设计要求

```
✓ 保留:整体配色、字体、布局、动效
✓ 保留:主副 CTA 按钮设计
✓ 保留:"No account · No subscription · Decisions are yours alone" 信任标语

可选优化:
+ 加一个【微妙的背景动效】(参考 Co-Star 的星图)
  - 实现:Hero 背景加一层【缓慢漂浮的星光粒子】(canvas 或 CSS)
  - 不抢戏,只是增加深度感
  - 可以用 react-tsparticles,1-2 行配置
  
+ 主标题"POJU"右侧或下方加一个【极简符号】
  比如 ✦ 或 ◐ 作为视觉锚点
```

### 新文案

```
# POJU

Where AI meets a thousand years of wisdom.

When one question keeps circling back, POJU sits with you 
through it.

[ Start a POJU session · $9.99 ]    [ Try Glyph · Free ]

No account · No subscription · Yours to decide
```

### 对比当前(差异说明)

```diff
- Where AI meets a thousand years of wisdom.
- 
- When one question keeps circling back, POJU sits with you 
- through it. Backed by AI. Grounded in millennia of human 
- reflection.

+ Where AI meets a thousand years of wisdom.
+ 
+ When one question keeps circling back, POJU sits with you 
+ through it.
```

**为什么删除第二句**:
- "Backed by AI. Grounded in millennia of human reflection" 是 redundant
- 第一句 "Where AI meets a thousand years of wisdom" 已经包含这个意思
- **少即是多** - 用户读两遍同一意思 = 怀疑你重复 = 失去神秘感

```diff
- No account · No subscription · Decisions are yours alone
+ No account · No subscription · Yours to decide
```

**为什么这样改**:
- "Yours to decide" 比 "Decisions are yours alone" 更有力、更短
- 用 3 个并列短语,节奏感更好

---

## 板块 2: 三件套快速入口 (合并简化)

### UI 设计要求

```
当前: 3 个并列卡片 + 下面又有"Designed for Real Life" 3 个标语

新设计:
  3 个卡片即可,删除"Designed for Real Life"独立板块
  
  卡片样式:
  - 横向 3 列(桌面)
  - 纵向堆叠(移动)
  - 每个卡片:
    * 图标(16x16,简约线条风)
    * 产品名(大写,如 POJU)
    * 价格标签($9.99 或 Free,小字)
    * 一句话描述
    * "Try it →" 链接(纯文字链接,不是按钮)
  - hover: 卡片整体上移 4px,加微弱光晕
```

### 新文案

```
## Three ways in. One way through.

[Card 1: POJU]
✦ POJU
$9.99

For the question that won't let you go.
A single deep conversation, until you see it through.

Start a session →

[Card 2: Glyph]
◐ Glyph
Free

A 60-second mirror.
Hold a question. Draw a pattern. Read a reflection.

Try it →

[Card 3: Syncro]
◯ Syncro
Free

See your natural rhythms.
Updated every two hours, on your phone.

Open it →
```

### 对比当前(差异说明)

```diff
- ## POJU · Glyph · Syncro
- 
- AI breakthrough sessions, grounded in millennia of human reflection.  
- Three ways in. One way through.

+ ## Three ways in. One way through.
```

**为什么删除子标题**:
- 子标题"AI breakthrough sessions, grounded in millennia"是 Hero 信息的重复
- 一个标题"Three ways in. One way through."已经足够引导
- **每个区域只有一个核心信息**

```diff
- self_improvement
- POJU-破局
- Breakthrough sessions
- $9.99
- For the question that won't let you go.
- [Start a session →]
- 
- POJU-Syncro
- See your natural rhythms
- Free
- A weather forecast for your inner life, updated every two hours.
- [Open Syncro →]
- 
- POJU-Glyph
- A 60-second mirror
- Free
- Read with a wink. The patterns mirror, they don't predict.
- [Try Glyph →]

+ [3 个新卡片,顺序: POJU → Glyph → Syncro]
+ [文案精简,每个卡片 2 行描述]
+ [产品名前不再加 "POJU-" 前缀,因为左上角已有 POJU logo]
```

**为什么这样改**:
- ❌ "POJU-破局" 是中文 + 重复 POJU 前缀
- ❌ "self_improvement" 是 Material Icons 字段名误显示
- ❌ 顺序应该是 POJU → Glyph → Syncro (主→引流→辅助)
- ✅ 每个卡片 2 行文案最佳(实际看起来要点 + 1 句)

```diff
- ### Designed for Real Life
- 
- No Sign Up
- Instant access. No barriers between you and insight.
- 
- Privacy First
- Zero data retention. Your queries evaporate instantly.
- 
- Yours Only
- Personalized readings tailored uniquely to your context.

+ [整段删除]
```

**为什么删除整段**:
- "No Sign Up" 已在 Hero 信任标语中讲过("No account")
- "Privacy First" 在下方 Three Promises 完整讲过
- "Yours Only" 是占卜暗示词("readings"暗示占卜师)
- **三句话都是重复或风险,删除最干净**

---

## 板块 3: 双锚定 (压缩合并 3 个区)

### UI 设计要求

```
当前: 3 个独立区域(Where two truths meet / What Eastern observed / 
                   QI XUAN BAZI YUAN)
新设计: 合并为 1 个区,4 列特性卡片

布局:
  - 标题居中
  - 副标题居中(1 行)
  - 4 列等宽(桌面)/ 2x2 网格(平板)/ 纵向堆叠(移动)
  - 每列:
    * 一个简约图标(36x36,SVG,与配色协调)
    * 一个 1-2 词的标题(如 "PATTERN")
    * 一句话描述
  
  ❌ 不要伪研究引用 (如 [COGNITIVE NEUROSCIENCE / 2024])
  ❌ 不要 "QI · XUAN · BAZI · YUAN"
  ❌ 不要单独的 ANCIENT/MODERN/AI/YOU 区

参考 UI: 
  Stripe.com 的 features 网格
  Linear.app 的特性展示
```

### 新文案

```
## Where two languages meet.

Two thousand years of human reflection.
Modern AI translation.
One conversation that helps you see clearly.

  ┌────────────────────────────────────────────────┐
  │                                                │
  │    [icon]        [icon]      [icon]    [icon] │
  │  PATTERN        DIRECTION    TIMING   YOU      │
  │                                                │
  │  Ancient        Spatial      Cycles   Your     │
  │  observation    psychology   that     birth    │
  │  on what        on what      shape    context, │
  │  recurs.        we notice.   biology. moment,  │
  │                                       and      │
  │                                       question.│
  │                                                │
  └────────────────────────────────────────────────┘
```

### 对比当前(完整重构)

```diff
- ## Where two truths meet.
- 
- ✦ ANCIENT
- Two thousand years of Eastern observation: 
- Daoism · Feng Shui · Bazi · Yi Jing
- 
- ✦ MODERN
- Reinforced by science: magnetic fields · spatial cognition · 
- circadian rhythms · environmental psych
- 
- ✦ AI AGENT
- Translated by an intelligence trained on both — 
- into what you can do, today.
- 
- ✦ YOU
- Your birth chart. Your direction. Your question. 
- Your this exact moment.
- 
- ## What Eastern traditions observed,science is beginning to measure.
- 
- ### Magnetic fields affect cognition
- Geomagnetic cues subtly shape spatial judgement and neural processing—effects Eastern traditions long linked to polarity, direction, and auspicious alignment.
- [COGNITIVE NEUROSCIENCE / 2024]
- 
- ### Spatial orientation shapes decisions
- Layout, openness, and sightlines change what we notice and how we weigh risk—echoing classical ideas of form, flow, and supportive environments.
- [ENVIRONMENTAL PSYCHOLOGY / 2019]
- 
- ### Circadian cycles drive biology
- Light–dark timing steadies hormones, mood, and focus—mirroring traditional emphasis on seasons, cycles, and choosing the right moment to act.
- [CHRONOBIOLOGY REVIEW / 2022]
- 
- ### Visual direction influences focus
- Where the gaze rests and what frames the view can steady or fragment attention—parallel to ideas of clear sightlines and unobstructed qi.
- [VISUAL COGNITION / 2021]
- 
- Eastern traditions named these forces two thousand years ago.
- 
- QI · XUAN · BAZI · YUAN
- 
- POJU uses AI to translate both languages into something  
- you can act on — today.

+ ## Where two languages meet.
+ 
+ Two thousand years of human reflection.
+ Modern AI translation.
+ One conversation that helps you see clearly.
+ 
+ [4 列网格]
+ 
+ [icon-pattern] PATTERN
+ Ancient observation on what recurs.
+ 
+ [icon-direction] DIRECTION
+ Spatial psychology on what we notice.
+ 
+ [icon-timing] TIMING
+ Cycles that shape biology.
+ 
+ [icon-you] YOU
+ Your birth context, moment, and question.
```

**重大重构说明**:

1. **3 个板块合并为 1 个**:省 60% 篇幅
2. **删除占卜术语**:Feng Shui, Bazi, Yi Jing, Daoism, qi, polarity, auspicious 全部消除
3. **删除伪研究引用**:4 个 [XXX RESEARCH / YEAR] 全部消除
4. **删除"QI · XUAN · BAZI · YUAN"**:这是合规炸弹
5. **改用 4 列网格**:Stripe / Linear 风格,信息密度高、阅读快

### 给 Cursor 的图标建议

```
图标库: lucide-react (项目已用)

PATTERN:    waves  或  layers
DIRECTION:  compass  或  navigation
TIMING:     clock  或  hourglass
YOU:        user-circle  或  scan-line

每个图标:
  - 大小 36x36
  - 颜色 紫色(从 Tailwind purple-300/400)
  - 描边 1.5px
  - 对齐 居中

参考样式(Tailwind):
  className="w-9 h-9 text-purple-400 stroke-[1.5]"
```

---

## 板块 4: 隐私承诺 (压缩合并)

### UI 设计要求

```
当前: 
  - "Three promises" 3 个标语
  - "Privacy isn't a checkbox" 4 大详细架构

新设计:
  - 保留 "Three promises" 标题和 3 条短句
  - 删除 "Privacy isn't a checkbox" 详细板块
  - 加一个底部链接 "Read the full privacy architecture →" 链到 /privacy

布局:
  - 3 列等宽
  - 每列:
    * 一个图标(锁/盾/天平)
    * 标题(如 "Never stored")
    * 1-2 句描述
  - 底部居中链接"Read the full privacy architecture →"

参考 UI:
  Headspace 的"How we keep you safe"区
  极简 + 信任感
```

### 新文案

```
## Three promises we don't break.

[Column 1]
[lock icon]
Never stored
Your conversations live encrypted on your device. 
We can't read them. No one can.

[Column 2]
[user-x icon]
Never required
No account. No login. No password. 
Email only when you want a PDF.

[Column 3]
[scale icon]
Never manipulative
No dark patterns. No fake urgency. 
One price: $9.99 when you need it.

──────────────────────

Read the full privacy architecture →
```

### 对比当前(主要是删除)

```diff
- ## Three promises we don't break.
- 
- Never stored
- Your conversations live only on your device. We encrypt 
- them locally. We cannot read them. No one can.
- 
- Never required
- No account. No login. No password. No email, unless you 
- want your reading as a PDF.
- 
- Never manipulative
- No dark patterns. No fake urgency. No "limited time." 
- No upsells. One price: $9.99 when you need it.
- 
- How we actually keep our word.
- 
- ## Privacy isn't a checkbox. It's our architecture.
- 
- ✦ Your conversations are encrypted on your device.
- Not "secured on our servers." Encrypted with AES-256-GCM 
- right in your browser, using a key we never see. Even if 
- our servers were breached, there is nothing to steal.
- Verify it yourself: open DevTools -> Application -> IndexedDB. 
- You'll see encrypted gibberish, not your words.
- 
- ✦ We have no account system.
- No email at signup. No password. No phone number. 
- No Google/Apple login. Your device fingerprint is your only ID
- - a one-way hash we use to restore your paid session, nothing else.
- Verify it yourself: nothing to sign up for. Try the free tools right now.
- 
- ✦ Your email is forbidden from living on our servers.
- If you export your reading as PDF, we ask for your email. 
- We send the PDF. Then we delete your address within 24 hours
- - physically erased from the database. Even we can't reach 
- you after that.
- Your control: one-click unsubscribe. Auto-delete everywhere.
- 
- ✦ Anthropic's Zero Data Retention is enabled.
- Your conversations go through Claude, but Anthropic doesn't 
- save them, doesn't train on them, and doesn't let humans 
- review them. We pay extra specifically for this guarantee.
- Verify it yourself: Anthropic's Zero Data Retention policy is public.
- 
- We're not a company that sells data because we don't collect 
- data. We're a company that sells one thing: a $9.99 conversation 
- that helps you move through what's stuck. That's the whole 
- business model.
- 
- If you ever doubt us: every claim on this page can be 
- verified in a minute with your browser's DevTools or 
- public documentation.
- 
- [Read our full Privacy Policy →]

+ ## Three promises we don't break.
+ 
+ [3 列卡片,每列 1 图标 + 标题 + 1-2 句]
+ 
+ Never stored
+ Your conversations live encrypted on your device. 
+ We can't read them. No one can.
+ 
+ Never required
+ No account. No login. No password. 
+ Email only when you want a PDF.
+ 
+ Never manipulative
+ No dark patterns. No fake urgency. 
+ One price: $9.99 when you need it.
+ 
+ Read the full privacy architecture →
```

**为什么这样改**:

```
当前的问题:
  ✗ "Three promises" + "Privacy isn't a checkbox" = 两次讲同一件事
  ✗ 详细架构区 ~500 字,占满一屏
  ✗ "Verify it yourself: open DevTools..."这种话 = 像在防御
  ✗ "We're not a company that sells data..." = 自我辩护过头
  
原则:
  ✓ 让首页保持轻盈
  ✓ 详细内容放 /privacy 页面(感兴趣的人会去)
  ✓ Co-Star 整个网站没有这种长篇隐私防御
  ✓ 越自我辩护 = 越显得像在隐瞒什么

挪到 /privacy 页面:
  那里是合适的位置
  深度内容应该在深度页面
  首页保持引诱、简洁、不防御
```

---

## 板块 5: Final CTA (保留 + 优化)

### UI 设计要求

```
当前: 
  ## Ready to break through?
  One question. $9.99. Delivered in one conversation.
  [Ask Your Question →]

新设计:
  - 保留居中布局
  - 保留主 CTA 按钮(放大,作为整页最终行动)
  - 加一个【副 CTA】给犹豫的用户

布局:
  - 大空间留白(上下各 ~120px padding)
  - 居中:
    * 大标题
    * 小描述
    * 主 CTA(big, primary)
    * "Or try Glyph for free first" 链接
```

### 新文案

```
## When the question won't let you go.

Stop reading. Start moving through it.

[ Ask Your Question — $9.99 ]

Or try Glyph for free first →
```

### 对比当前(差异说明)

```diff
- ## Ready to break through?
- 
- One question. $9.99. Delivered in one conversation.
- 
- [Ask Your Question →]

+ ## When the question won't let you go.
+ 
+ Stop reading. Start moving through it.
+ 
+ [ Ask Your Question — $9.99 ]
+ 
+ Or try Glyph for free first →
```

**为什么这样改**:
- "Ready to break through?" 是 cliché → 改为引用 Hero 的核心 promise
- "One question. $9.99. Delivered..." 太营销话术 → "Stop reading. Start moving through it." 更有力
- 主 CTA 加价格 = 明确预期 = 减少 chargeback
- 加副 CTA "Try Glyph for free first" = 给犹豫用户一个台阶

---

## 首页删除清单

```
✗ 删除"Designed for Real Life"整个板块
✗ 删除"Where two truths meet" 4 列(并入新双锚定区)
✗ 删除"What Eastern traditions observed"长篇研究引用区
✗ 删除 4 个伪研究引用标签
✗ 删除"QI · XUAN · BAZI · YUAN"
✗ 删除"Privacy isn't a checkbox"详细架构区(~500 字)
✗ 删除 "self_improvement" Material Icons 误显示
✗ 删除三件套卡片中的"POJU-"前缀
✗ 删除中文"破局"

合计删除内容: 网站全文的 ~40%
```

---

# Part 4: POJU 页重构

## 当前 → 新架构

```
当前 8 板块:
[1] Hero
[2] POJU 介绍段(重复首页)
[3] Glyph vs POJU 简短指引
[4] When to come to POJU 5 场景
[5] How POJU works 6 步流程 (保留 UI)
[6] Why POJU is different 4 列对比表
[7] What's included / What POJU is NOT
[8] Ready to break through CTA

新 4 板块:
[1] Hero (优化)
[2] When to come to POJU (保留 + 简化)
[3] How POJU works (保留 UI - 你设计的)
[4] What's included / What POJU is NOT + Final CTA
```

---

## 板块 1: Hero (改 - 区别于首页)

### UI 设计要求

```
✓ 保留:整体布局、配色
✓ 改:文案要【区别于首页】,不能重复

策略:
  首页 Hero = 价值主张("AI + 千年智慧")
  POJU 页 Hero = 使用场景("when reading is not enough")
```

### 新文案

```
# Sometimes reading isn't enough.

You've already read the books, talked to the friends,
and weighed the pros and cons. The question still 
won't let you go.

POJU is what comes after thinking alone.

[ Ask your question — $9.99 ]    [ See how it works ↓ ]
```

### 对比当前

```diff
- # Breakthrough sessions for the question that won't let you go.
- 
- When you've read the books, talked to friends, and still can't 
- see clearly, POJU sits with you through it. An AI agent grounded 
- in millennia of human reflection.
- 
- [Ask your question — $9.99] [Add to Home Screen]

+ # Sometimes reading isn't enough.
+ 
+ You've already read the books, talked to the friends,
+ and weighed the pros and cons. The question still 
+ won't let you go.
+ 
+ POJU is what comes after thinking alone.
+ 
+ [Ask your question — $9.99]   [See how it works ↓]
```

**为什么这样改**:

1. **标题改变**:从"Breakthrough sessions..."(说明性)改为"Sometimes reading isn't enough."(场景性)
   - 用户读到这里能立刻自我代入
   - 区别于首页 Hero
   
2. **副文案改变**:从"When you've read..."(过去式)改为"You've already read..."(现在完成时)
   - 直接对话用户
   - 让用户感觉"啊,这就是我"
   
3. **新加"POJU is what comes after thinking alone"**:
   - 一句话定位
   - 对比"独自思考" vs "和 POJU 一起思考"
   - 不说"AI agent grounded in millennia"那种官话
   
4. **副 CTA 改为"See how it works ↓"**:
   - 引导用户向下滚动到第 3 板块"How POJU works"
   - "Add to Home Screen" 是 PWA 功能,但应该出现在用完产品后,不是 Hero
   - **删除"Add to Home Screen"**(可以挪到 Footer 或用户界面里)

---

## 板块 2: When to come to POJU (保留 + 简化)

### UI 设计要求

```
✓ 保留:整体布局
✓ 略微改:5 个场景的描述精简

布局参考:
  - 5 行卡片,每行:
    * 左侧 ✦ 符号
    * 主标题(场景)
    * 副描述(具体例子)
  - 适度留白
  - 序号或星号视觉标记
```

### 新文案(只精简,不重写)

```
## When to come to POJU.

✦ You're stuck between two paths
   Career change. Relationship decision. Where to live.

✦ You've done your research and you're more confused
   Conflicting advice. Family pressure. A ticking clock.

✦ Something keeps repeating and you don't know why
   Same kind of relationship. Same blocks. Same setbacks.

✦ You need depth that friends can't give
   No one around you has the distance to see clearly.

✦ You want direction, not prediction
   "Will X happen" is astrology. "What should I do" is POJU.
```

### 对比当前(只是文本格式微调)

```diff
- ## When to come to POJU
- 
- ✦ You're stuck between two paths
- career change, relationship decision, relocation
- 
- ✦ You've done your research and you're more confused
- conflicting advice, family pressure, ticking clock
- 
- ✦ Something keeps repeating and you don't know why
- same kind of relationship, same setbacks, same blocks
- 
- ✦ You need depth that friends can't give
- no one around you has the distance to see clearly
- 
- ✦ You want direction, not prediction
- "will X happen" is astrology. "what should I do" is POJU.

+ ## When to come to POJU.
+ 
+ ✦ You're stuck between two paths
+    Career change. Relationship decision. Where to live.
+ 
+ ✦ You've done your research and you're more confused
+    Conflicting advice. Family pressure. A ticking clock.
+ 
+ ✦ Something keeps repeating and you don't know why
+    Same kind of relationship. Same blocks. Same setbacks.
+ 
+ ✦ You need depth that friends can't give
+    No one around you has the distance to see clearly.
+ 
+ ✦ You want direction, not prediction
+    "Will X happen" is astrology. "What should I do" is POJU.
```

**改动小但重要**:
- "career change, relationship decision, relocation" → "Career change. Relationship decision. Where to live."
  - 句号代替逗号 = 节奏更慢、更有力
  - "Where to live" 比 "relocation" 更人话
- 首字母大写 = 视觉对齐
- 加缩进(每个 ✦ 后副描述缩进 4 个空格)

---

## 板块 3: How POJU works (UI 保留 - 你设计的)

### 给 Cursor 的指令

```
✓ 完全保留这个板块的 UI 设计
✓ 6 步流程图、动效、配色、布局都不动
✓ 只做一件事: 检查文案是否合规

文案审查:
  - "Issue Identification" ✓ 合规
  - "Information Collection" ✓ 合规
  - "Auxiliary Tools Judgment" ⚠️ "Auxiliary Tools" 有点神秘
    建议改为 "Framework Selection" 或 "Pattern Analysis"
  - "Core Analysis" ✓ 合规
  - "Action Generation" ✓ 合规
  - "Implementation Tracking" ✓ 合规

唯一文案改动:
  Step 3: "Auxiliary Tools Judgment" → "Pattern Analysis"

底部说明 (保留):
  "You act. You come back. The path adjusts. 
   Until you move through."
   ✓ 合规且有力,不动
```

---

## 板块 4: What's included / What POJU is NOT + Final CTA (合并)

### UI 设计要求

```
新设计: 把以下 3 部分合并为 1 屏

[A] What's included (4 项)
[B] What POJU is NOT (3 项)
[C] Final CTA

布局:
  - 上方左右两栏(What included | What NOT)
  - 下方居中 Final CTA
  - 一屏内全部完成

参考: Stripe.com 的 features-comparison 简洁布局
```

### 新文案

```
## Two columns, one promise.

[Left column]
WHAT'S INCLUDED

✦ Unlimited depth in a single session
✦ Action plan you can act on tomorrow
✦ Reflection prompts to sit with
✦ 30-day session access

[Right column]
WHAT IT'S NOT

✗ Does not predict your future
✗ Does not replace professional advice
✗ Does not make decisions for you

──────────────────────

POJU is a thinking partner. The decisions remain yours.

[ Ask your question — $9.99 ]

One question · Unlimited depth · PDF by email · Deletes when you close
```

### 删除内容

```diff
- ## POJU
- 
- Breakthrough sessions for the question that won't let you go.
- 
- When you've already read the books, talked to friends, weighed 
- the pros and cons - and still can't see clearly - POJU sits 
- with you through it.
- 
- It asks. It listens. It pulls threads you didn't know were 
- connected. It doesn't tell you what to do. It helps you see 
- what you couldn't see alone.
- 
- $9.99 per session · No subscription · Unlimited depth

+ [整段删除 - 这是 Hero 的重复]
```

```diff
- ## Glyph vs POJU
- 
- Glyph is free and fast — one sincere question, one sign in 
- about two minutes. POJU is a paid session that walks with you 
- for much longer when you need a full breakthrough, not only 
- a direction.
- 
- Full side-by-side lives on the Glyph page. Jump there if you 
- are still choosing.
- 
- [Open the Glyph comparison table →]

+ [整段删除 - Glyph vs POJU 应该只在 Glyph 页讲一次]
```

```diff
- ## Why POJU is different
- 
- | Feature | Co-Star | ChatGPT | Real Master | POJU |
- | Depth | ●●●● | ●●●● | ●●●● | ●●●● |
- | Actionable | ●●●● | ●●●● | ●●●● | ●●●● |
- | Eastern Base | ●●●● | ●●●● | ●●●● | ●●●● |
- | Privacy | ●●●● | ●●●● | ●●●● | ●●●● |
- | Price | $8/yr | $20/mo | $150–500 | $9.99 single |
- 
- Before you pay — what happens to your words:
- ✦ Encrypted on your device only.
- ✦ Never stored on our servers.
- ✦ Deleted when you close — even from us.
- 
- [How we actually keep our word →]

+ [整段删除]
+ 
+ 理由:
+ 1. 对比表全是 ●●●● 满分,看起来像 placeholder 没填
+ 2. 即使填上,对比 ChatGPT/Co-Star = 自吹自擂
+ 3. Co-Star 自己从来不做这种对比
+ 4. "Before you pay" 加密说明 = Three Promises 的重复
```

---

## POJU 页删除清单

```
✗ 删除 Hero 后的"POJU 介绍段"(重复 Hero)
✗ 删除"Glyph vs POJU"区(应只在 Glyph 页讲)
✗ 删除"Why POJU is different"对比表(自吹 + 假数据)
✗ 删除"Before you pay"加密说明(Three Promises 已讲)
✗ 删除"Add to Home Screen"按钮(挪到 Footer 或 PWA install prompt)

合计删除: POJU 页 ~50% 内容
```

---

# Part 5: Glyph 页重构

## 当前 → 新架构

```
当前 9 板块 (太多):
[1] Hero
[2] What Glyph is - 介绍段
[3] 长篇文化背景段 ("Across the East...")
[4] When Glyph is the right fit - 4 场景
[5] Glyph and POJU - how to choose 对比
[6] Five winds - 5 张卡片 (保留 UI)
[7] On the cards - "无好坏"理念
[8] Before you start - 三规则
[9] What we never store - 隐私
[10] Ready for your Glyph CTA

新 4 板块:
[1] Hero
[2] Five winds (保留 UI - 你设计的) + On the cards
[3] How it works (新 - 简短)
[4] Final CTA
```

---

## 板块 1: Hero (改 - 区别于首页)

### UI 设计要求

```
✓ 保留布局
✓ 改文案,要轻、要诗意
```

### 新文案

```
# Glyph

A 60-second mirror.

Hold a question. Draw a pattern. Read a reflection.

Free. No signup. Read with a wink.

[ Try Glyph — Free ]
```

### 对比当前

```diff
- # Glyph · A 60-second mirror.
- 
- Hold one question. Draw one of 100 archetypal patterns 
- refined over a thousand years of human reflection. Read 
- your reflection, not a prediction.
- 
- [Try Glyph · Free] [Add to Home Screen]

+ # Glyph
+ 
+ A 60-second mirror.
+ 
+ Hold a question. Draw a pattern. Read a reflection.
+ 
+ Free. No signup. Read with a wink.
+ 
+ [Try Glyph — Free]
```

**为什么这样改**:
- ❌ Hero 太长(2 行半)
- ✅ 改为 4 个层次:产品名 / 一句定位 / 三步用法 / 价格信息
- ✅ "Hold a question. Draw a pattern. Read a reflection." = 三步节奏感
- ✅ 删除"Add to Home Screen"(不属于 Hero)

---

## 板块 2: Five Winds (UI 保留 - 你设计的) + On the cards (合并)

### 给 Cursor 的指令

```
✓ Five winds 五张卡片 UI 完全保留(你设计的)
✓ 把"On the cards"理念区【合并到 Five Winds 区域底部】
   - 而不是单独一个板块
✓ 5 张卡片 UI 不动,只检查文案是否一致

文案审查:
  - "Divine Tailwind" ✓ 合规
  - "Still Water" ✓ 合规
  - "Eye of Storm" ✓ 合规
  - "Fair Sky" ✓ 合规
  - "Crosswind" ✓ 合规
  - 5 张卡片描述 ✓ 基本合规,可不动

合并后:
  五张卡片下方,加"On the cards"理念段
  作为整个 Five Winds 区域的【收尾哲学】
```

### 新合并文案

```
## Five winds — five archetypal patterns.

The five patterns are mirrors, not predictions. Each one 
describes a human situation and helps you frame what is 
already happening.

[Five Winds 卡片网格 - 保留你的 UI]

──────────────────

On the cards.

The five glyphs are not labels of fortune. They are not 
"good cards" or "bad cards."

Each one is a lens — a way of reading this particular 
moment, for this particular question, held by this 
particular person.

The same glyph can mean entirely different things on 
different days, for different people, about different 
questions.

What you receive is not a verdict. It is a perspective — 
and an invitation to look more carefully.
```

---

## 板块 3: How it works (新 - 替代被删除的多个区)

### UI 设计要求

```
新板块: 简洁 3 步流程

布局:
  - 横向 3 列(桌面)
  - 每列:
    * 大数字 (1, 2, 3) 紫色描边
    * 标题(2-3 词)
    * 一句话描述
  - 步骤之间用箭头或线条连接

参考 UI: 
  Headspace 的 onboarding 步骤
  Linear.app 的 "How it works"
```

### 新文案

```
## How Glyph works.

[Step 1]
1
Hold your question.
Compress it to 60 characters. The compression begins the answer.

[Step 2]
2
Draw your pattern.
One of 100 archetypal forms, refined over a thousand years.

[Step 3]
3
Read your reflection.
A short response — grounded in wisdom traditions and 
modern psychology.

──────────────────

One question per session. 
If the same question calls you back, wait 48 hours.
```

---

## 板块 4: Final CTA

### 新文案

```
## Hold one question.

What you receive is not a verdict.
It is an invitation to look more carefully.

[ Try Glyph — Free ]

Read with a wink. The patterns mirror, they don't predict.
```

---

## Glyph 页删除清单

```
✗ 删除"What Glyph is"独立介绍段(Hero 已说)
✗ 删除长篇文化背景段("Across the East, for two thousand years...")
   → 这段约 200 字,占满半屏,且有占卜暗示("ancient presence")
✗ 删除"When Glyph is the right fit" 4 场景
   → 不必要;Glyph 就是个 60 秒工具,不需要 5 个使用场景论证
✗ 删除"Glyph and POJU - how to choose"对比表
   → POJU 页不该提 vs,Glyph 页也不该提
   → 用户在三件套卡片中已经看到价格差异
✗ 删除"Before you start"三规则独立板块
   → 已合并到 How it works 底部
✗ 删除"What we never store"独立板块
   → 已在首页 Three Promises 中讲过

合计删除: Glyph 页 ~60% 内容
```

---

# Part 6: Syncro 页重构 (重大重构)

> **Syncro 是合规风险最高的页面,需要最深的重构。**

## 当前 → 新架构

```
当前 11 板块 (灾难性):
[1] Hero
[2] QR 码 (第一次)
[3] Syncro 介绍段
[4] Syncro Mobile Flow Task 3 (权限和校准)
[5] How Syncro reads you (GANZHI/BAGUA/WUXING/KANYU 灾难)
[6] Profile input 表单
[7] PC fallback (QR 码第二次)
[8] Where people use Syncro
[9] Science × Eastern Lens 对照表 (灾难)
[10] What you'll see / What Syncro is NOT
[11] Always free CTA

新 5 板块:
[1] Hero (合并 Hero + QR 码)
[2] What Syncro shows (新 - 视觉演示)
[3] Where people use Syncro (保留 - 实用化)
[4] What it is / what it isn't (合并)
[5] Always free CTA
```

---

## 板块 1: Hero + QR 码 (合并)

### UI 设计要求

```
当前: Hero 独立 + QR 码独立 = 用户滚两屏
新设计: Hero 和 QR 码合并到第一屏

布局:
  桌面端: 左右两栏
    左侧:
      * 大标题 "Syncro"
      * 一句定位
      * 介绍段(2-3 行)
      * 副信息(免费 + 移动端 only)
    右侧:
      * QR 码(280x280)
      * 短信链接输入框
      * "Text me the link" 按钮
      
  移动端: 纵向堆叠,隐藏 QR(直接给 [Open Syncro] 按钮)

参考 UI:
  Notion 的 "Get the App" 区
  Apple 的 download 页
```

### 新文案

```
# Syncro

See your natural rhythms.

Based on your birth context, Syncro reflects how the 
day's energy aligns with you. Where to lean in. Where 
to slow down.

A weather forecast for your inner life, updated every 
two hours.

Free · Opens on mobile only

[QR Code]
pojulife.com/syncro

[Phone Input]      [ Text me the link ]

(Mobile only - on phone, just tap [Open Syncro])
```

### 对比当前(合并 + 精简)

```diff
- # See your natural rhythms.
- 
- [Open Syncro on your phone] [Explore use cases ↓]
- 
- Based on your birth context, Syncro reflects how the day's 
- energy aligns with your personal patterns. Think of it as 
- a weather forecast for your inner life.
- 
- Opens on mobile only
- Syncro needs your phone's compass, GPS, and camera. 
- Scan the QR code or text yourself the link.
- 
- [QR code]
- pojulife.com/syncro
- 
- Text yourself the link
- [Text me the link]
- 
- ## Syncro
- 
- See your natural rhythms.
- 
- Based on your birth context, Syncro reflects how the day's 
- energy aligns with your personal patterns - where to lean 
- in, where to slow down, and where the windows are open.
- 
- Think of it as a weather forecast for your inner life, 
- updated every two hours.
- 
- Free · No signup · For self-awareness

+ # Syncro
+ 
+ See your natural rhythms.
+ 
+ Based on your birth context, Syncro reflects how the 
+ day's energy aligns with you. Where to lean in. Where 
+ to slow down.
+ 
+ A weather forecast for your inner life, updated every 
+ two hours.
+ 
+ Free · Opens on mobile only
+ 
+ [QR Code 280x280]   [Text me the link]
```

**重大改动**:
- 删除"## Syncro"独立介绍段(Hero 已说)
- Hero + QR 合并到一屏
- 删除"Syncro needs your phone's compass, GPS, and camera"(放到使用时再说)

---

## 板块 2: What Syncro shows (新 - 视觉演示)

### UI 设计要求

```
新板块: 用图片/截图说话,而不是文字

设计:
  - 居中显示一张【手机模拟图】
  - 屏幕里展示 Syncro 真实使用场景
  - 例如:用户对着 NE 方向时手机显示的内容
  - 旁边或下方:简短文字说明

需要的图片:
  📷 一张 iPhone 16 mockup
  📷 屏幕里是 Syncro 的实际界面截图
     - 显示当前方位:NE
     - 显示 8 方位简短建议
     - 显示当前 2 小时窗口的总体描述
  
如果你没有这张图,我可以告诉你具体怎么做:
  1. 用 mockuphone.com 等工具
  2. 或用 Figma 简单做一个
  3. 让 Cursor 写出 Syncro 实际页面截图

参考 UI:
  Headspace 的 product showcase
  Calm 的 phone mockup 区
```

### 新文案

```
## What Syncro shows.

[Phone mockup with Syncro screen]

Hold your phone toward a direction.
See what's available. See what isn't.

Each direction shows:
✦ A short description of the current pattern
✦ What this period suits (e.g., "good for slow conversations")
✦ What this period doesn't suit (e.g., "wait on big asks")

Updated every two hours, with your context.
```

### 对比当前(完全替换)

```diff
[Syncro Mobile Flow · Task 3 区域]
- ## Permissions and calibration setup
- 
- Grant permissions first, then complete the profile form. 
- Data stays on this device.
- 
- Grant permissions
- GPS: idle
- Compass: idle
- Camera: idle
- 
- ### How Syncro reads you
- 
- ✦ GANZHI — 60-base time coordination
- ✦ BAGUA — 9-palace spatial map
- ✦ WUXING — 5-phase dynamics
- ✦ KANYU — magnetic + solar timing context
- 
- Don't show this again Got it, continue ↓
- 
- ### Profile input
- [11 PM – 1 AM (Midnight / Zi)... 13 个时辰选项]
- [Male / Female / Other]
- [Select profession dropdown]
- [Begin Reading →]
- 
- Your info stays on this device.
- 
- ## PC fallback
- ## Open Syncro on mobile for full experience
- 
- Syncro needs compass, GPS, and camera. On desktop, scan the 
- QR code or send the link to your phone.
- 
- Text me the link
- [QR code]
- pojulife.com/syncro

+ [全部删除]
+ 
+ 取代为:
+ 
+ ## What Syncro shows.
+ 
+ [Phone mockup 图片]
+ 
+ Hold your phone toward a direction.
+ See what's available. See what isn't.
+ 
+ Each direction shows:
+ ✦ A short description of the current pattern
+ ✦ What this period suits
+ ✦ What this period doesn't suit
+ 
+ Updated every two hours, with your context.
```

**为什么这样改 - 这是网站最重要的改动**:

```
当前的灾难:
  
  ❌ "GANZHI · BAGUA · WUXING · KANYU"
     - GANZHI(干支) - 命理学术语
     - BAGUA(八卦) - 占卜术语!
     - WUXING(五行) - 算命基础
     - KANYU(堪舆) - 风水学
     - 这 4 个词出现在介绍页 = 直接告诉支付审核员"这是占卜网站"
  
  ❌ "Permissions and calibration"
     - 校准是用户开始使用时的步骤
     - 不应该出现在【介绍页】
     - 应该在【真正使用 Syncro 时】才出现
  
  ❌ "Profile input"表单
     - 这是用户使用前的输入步骤
     - 不应该出现在【介绍页】上
     - 用户访问介绍页是想了解产品,不是马上开始用
  
  ❌ "PC fallback" 重复 QR 码
     - QR 码已在 Hero 显示
     - 这里又显示一次 = 视觉重复
  
正确的产品逻辑:
  
  [介绍页] /syncro 
    用户进来了解 Syncro 是什么、能做什么
    看到 QR 码,扫码到手机
  
  [真正的应用] mobile.pojulife.com/syncro
    或 PWA 版本
    用户在手机上使用
    这里才需要权限请求、校准、表单输入

→ 把【应用功能】从【介绍页】中【完全剥离】
→ 介绍页只做【说服 + 引流到手机】
→ 校准/表单/权限都在【真实 App 内】
```

---

## 板块 3: Where people use Syncro (保留)

### 给 Cursor 的指令

```
✓ 这个板块完全保留
✓ 5 个使用场景:
   - Study spot
   - Negotiation
   - Bed orientation
   - Travel decision
   - POJU companion
✓ 文案合规,不动

唯一可考虑改动:
  + 给每个场景加一个小图标(可选)
  + 视觉化提升
```

---

## 板块 4: What it is / What it isn't (合并 + 简化)

### UI 设计要求

```
当前: 两个独立板块
  - Science × Eastern Lens 对照表 (高危,要删)
  - What you'll see + What Syncro is NOT
  
新设计: 合并为单一板块
  左右两栏:
    左: What Syncro shows
    右: What Syncro doesn't claim
```

### 新文案

```
## What it is. What it isn't.

[Left column]
WHAT IT SHOWS

✦ Current rhythm pattern for the next 2 hours
✦ 8 directions with what they suit
✦ Where to lean in, where to slow down

[Right column]
WHAT IT ISN'T

✗ A predictor of events
✗ A promiser of outcomes
✗ A replacement for your own judgment
```

### 删除的灾难板块

```diff
- ## Science × Eastern Lens
- 
- Syncro does not replace either worldview. It maps measurable 
- signals and classical directional logic into one practical view.
- 
- Science side                | Eastern side
- Compass heading + geomagnetic field | Directional Qi tendency
- GPS coordinates + local context | Place-based energetic pattern
- Timestamp + circadian timing | Moment-based rhythm pattern
- Personal data model and calibration | Bazi-aligned personal blueprint

+ [完全删除]

+ 删除原因:
+   ❌ "Directional Qi tendency" - 占卜
+   ❌ "Place-based energetic pattern" - 玄学
+   ❌ "Bazi-aligned personal blueprint" - 算命
+   ❌ "Eastern side" - 直接标签化
+   
+ 这是合规炸弹,任何审核员看到都会拒绝
+ 必须删除,没有商量余地
```

---

## 板块 5: Always free CTA (保留 + 优化)

### 新文案

```
## Always free.

Syncro stays free as your everyday rhythm companion.
Open it whenever you need clarity on the moment.

[ Open Syncro ]
```

### 对比当前

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
+ [Open Syncro]
```

**改动说明**:
- "Always free. Forever." → "Always free." (简洁)
- "directional companion" → "rhythm companion" (避免"directional"暗示风水)
- "spatial clarity" → "clarity on the moment" (中性化)

---

## Syncro 页删除清单

```
✗✗✗ 删除"How Syncro reads you" GANZHI/BAGUA/WUXING/KANYU
    【最重要 - 合规炸弹】
    
✗✗✗ 删除"Science × Eastern Lens" 对照表
    【最重要 - 合规炸弹】
    
✗ 删除"Permissions and calibration"权限设置
    (移到真实 App 中)
    
✗ 删除"Profile input"表单
    (移到真实 App 中)
    
✗ 删除"PC fallback"重复 QR 码板块
✗ 删除独立的 "Syncro" 介绍段(Hero 已说)
✗ 删除"What you'll see"和"What Syncro is NOT"独立板块(已合并)

合计删除: Syncro 页 ~70% 内容
```

---

# Part 7: 隐私 / Disclaimer / Terms 三页

```
本文档不展开这 3 页详细内容
将作为单独文档处理(POJU_Fix_03_Legal_Pages.md)

3 页大致方向:

/privacy - 重写
  - 改用正常段落格式(当前用 ``` 代码块,看起来像源码)
  - 修复"[日期]"中文占位符
  - 保留所有合规承诺,但用更清晰的层级
  - 加入"完整隐私架构"详细说明(从首页移过来的内容)

/disclaimer - 填充
  - 当前是空页面,必须填
  - 用我之前文档里的合规版本

/terms - 填充
  - 当前是空页面,必须填
  - 用我之前文档里的合规版本
```

---

# Part 8: 全站统一改动

## 8.1 导航栏

```
当前: POJU 破局 | POJU SYNCRO | POJU GLYPH | THE ARCHIVE
新版: POJU | Glyph | Syncro | Archive

改动:
  ✗ 删除中文"破局"
  ✗ 不重复"POJU"前缀
  ✗ 不全大写
  ✓ 标题大小写规范
```

## 8.2 Footer

```
所有页面 Footer 末句改为:

For self-reflection and entertainment. POJU offers 
perspectives, not predictions. All decisions are yours alone.

(适用于首页 + Glyph 页)

POJU 页保留:
"POJU is a thinking partner. It offers perspectives, 
not prophecies. All decisions are yours alone."

Syncro 页保留:
"Syncro is a self-awareness tool. Take what resonates. 
Decisions are yours alone."
```

## 8.3 字体和间距

```
建议:
  ✓ 主字体保持(应该是 Inter 或类似 sans-serif)
  ✓ Hero 标题和正文有清晰对比(60px / 18px)
  ✓ 板块之间留白增加(垂直 padding 至少 96px)
  ✓ 段落行高放大(line-height: 1.6 - 1.8)

参考 Co-Star: 大留白 + 清晰层级 + 高可读性
```

## 8.4 图片建议(网站急需的)

```
当前网站【没有真实产品截图】= 一大问题
Co-Star 网站到处是星图、屏幕截图、产品演示

建议添加的图片:

[图 1] Glyph 抽签效果截图
  位置: Glyph 页 Hero 下方
  内容: 一张抽到的 Glyph 卡片(例如 Divine Tailwind)
  目的: 让用户立刻看到产品长什么样
  
[图 2] POJU 对话截图
  位置: POJU 页 Hero 下方,或 How POJU works 上方
  内容: 一段模拟的 POJU 对话(2-3 轮)
  目的: 让用户感受 POJU 的【AI agent】气质,不是普通 chatbot

[图 3] Syncro phone mockup
  位置: Syncro 页 What Syncro shows 板块
  内容: 一张手机里 Syncro 界面的真实截图
  目的: 用户看图就知道产品如何使用
  
[图 4] 首页 Hero 背景动效
  位置: 首页 Hero
  内容: 缓慢漂浮的星光粒子 (canvas 或 CSS)
  目的: 增加首屏深度感和神秘感

工具建议:
  - mockuphone.com (免费 phone mockup)
  - Figma (做设计稿)
  - Excalidraw (快速绘制)
  - 让 Cursor 用 R3F 写一个简单的星光粒子背景
```

## 8.5 Archive 页

```
当前几乎是空的,内容:
  "Everything here lives only on this device."
  "Wipe everything"
  4 个 tab: Vault / Glyph / Sync / Archive
  
建议:
  ✓ 这个页面是【用户中心】,只有付过费的用户会来
  ✓ 早期可以保持简洁
  ✓ 真正实现 4 个 tab 的内容(用户的历史记录)
  ✓ 但这是【后端功能】,不是【文案】问题

本次重构: 
  Archive 页面【暂不改动】
  等真实数据接入后再优化
```

---

# Part 9: 给 Cursor 的执行指令

把以下指令完整复制给 Cursor:

```markdown
# 任务: POJU 网站完整重构

## 阅读
@docs/POJU_Site_Restructure.md (本文档)

## 实施顺序

### Phase 1: 全站统一改动 

Task 1.1: 修改导航栏
  - "POJU 破局" → "POJU"
  - "POJU SYNCRO" → "Syncro"
  - "POJU GLYPH" → "Glyph"
  - "THE ARCHIVE" → "Archive"

Task 1.2: 修改 Footer 末句
  - 首页 + Glyph 页用同一版本
  - POJU 页和 Syncro 页保持当前版本

### Phase 2: 首页重构 

Task 2.1: 删除以下板块
  - "Designed for Real Life"
  - "Where two truths meet" (4 列原版)
  - "What Eastern traditions observed" (含 4 个伪研究引用)
  - "QI · XUAN · BAZI · YUAN"
  - "Privacy isn't a checkbox" 详细架构区(挪到 /privacy)

Task 2.2: 新建一个合并的"双锚定"板块
  - 标题: "Where two languages meet."
  - 4 列网格: PATTERN / DIRECTION / TIMING / YOU
  - 每列一个 lucide-react 图标
  - 文案按文档 Part 3 板块 3

Task 2.3: 简化三件套卡片
  - 移除"POJU-"前缀
  - 移除"self_improvement"误显示
  - 顺序: POJU → Glyph → Syncro
  - 每个卡片 2 行描述 + "Try it →" 文字链接

Task 2.4: 简化 Three Promises
  - 删除详细架构展开
  - 加底部链接 "Read the full privacy architecture →"

Task 2.5: 优化 Hero
  - 删除副文案第二句
  - "Decisions are yours alone" → "Yours to decide"

Task 2.6: 优化 Final CTA
  - 改标题为"When the question won't let you go."
  - 加副 CTA "Or try Glyph for free first →"

### Phase 3: POJU 页重构 

Task 3.1: 删除以下板块
  - 重复的 POJU 介绍段
  - "Glyph vs POJU" 板块
  - "Why POJU is different" 对比表
  - "Before you pay" 加密说明
  - "Add to Home Screen" 按钮

Task 3.2: 改 Hero
  - 标题: "Sometimes reading isn't enough."
  - 文案按文档 Part 4

Task 3.3: 微调"When to come to POJU"
  - 副描述用句号代替逗号
  - 首字母大写
  - 见 Part 4 板块 2 diff

Task 3.4: How POJU works (UI 不动)
  - Step 3 文案: "Auxiliary Tools Judgment" → "Pattern Analysis"

Task 3.5: 合并 What's included / What POJU is NOT
  - 双栏布局
  - 加 Final CTA 在下方

### Phase 4: Glyph 页重构 

Task 4.1: 删除以下板块
  - "What Glyph is" 独立介绍段
  - 长篇文化背景段("Across the East...")
  - "When Glyph is the right fit" 4 场景
  - "Glyph and POJU" 对比表
  - "Before you start" 三规则独立板块
  - "What we never store" 独立板块

Task 4.2: 改 Hero
  - 4 个层次:产品名 / 一句定位 / 三步用法 / 价格信息
  - 见 Part 5 板块 1

Task 4.3: 合并 Five Winds + On the cards
  - Five Winds UI 完全保留(用户设计)
  - 把"On the cards"理念合并到 Five Winds 下方
  - 不再独立板块

Task 4.4: 新建 How it works
  - 3 步流程:Hold / Draw / Read
  - 大数字 + 简短描述
  - 底部加三规则

Task 4.5: 改 Final CTA
  - 见 Part 5 板块 4

### Phase 5: Syncro 页重构 - 最重要 

Task 5.1: 删除以下板块 (合规风险!)
  - !!! "How Syncro reads you" (GANZHI/BAGUA/WUXING/KANYU)
  - !!! "Science × Eastern Lens" 对照表
  - "Permissions and calibration"权限设置(挪到 App 内)
  - "Profile input"表单(挪到 App 内)
  - "PC fallback"重复 QR
  - 独立的 "Syncro" 介绍段(Hero 已说)
  - "What you'll see"独立板块(已合并)

Task 5.2: 重构 Hero
  - 左右两栏:文案 + QR 码
  - 见 Part 6 板块 1

Task 5.3: 新建 What Syncro shows
  - 居中 phone mockup
  - 简短文字说明
  - 见 Part 6 板块 2

Task 5.4: 保留 Where people use Syncro
  - 完全保留,可选加图标

Task 5.5: 合并 What it is / What it isn't
  - 双栏布局,简短
  - 见 Part 6 板块 4

Task 5.6: 优化 Always free CTA
  - 见 Part 6 板块 5

### Phase 6: 全站审计 (约 1 小时)

Task 6.1: 高危词扫描 - 必须为 0
  搜索整个项目:
  - "Feng Shui" (含大小写) → 应为 0
  - "Bazi" → 应为 0
  - "GANZHI" → 应为 0
  - "BAGUA" → 应为 0
  - "WUXING" → 应为 0
  - "KANYU" → 应为 0
  - "Qi" (作为占卜词) → 应为 0
  - "qi tendency" → 应为 0
  - "energetic" → 应为 0
  - "auspicious" → 应为 0
  - "Eastern side" → 应为 0
  - "破局" (中文) → 应为 0
  - "QI · XUAN · BAZI · YUAN" → 应为 0

Task 6.2: 验证 4 页删除完成
  按本文档每页"删除清单"逐项核对
  截图给用户确认

## 严格要求

🚫 不要修改用户保留的 UI:
   - 首页整体视觉风格
   - POJU 页 "How POJU works" 6 步流程 UI
   - Glyph 页 "Five Winds" 5 张卡片 UI

🚫 不要"优化"我没要求改的内容
🚫 不要保留任何 GANZHI/BAGUA/WUXING/KANYU 等术语
🚫 不要保留 4 个伪研究引用

✅ 严格按文档每个 Task 执行
✅ 每个 Phase 完成后截图给用户
✅ 高危词搜索结果必须为 0

## 完成标志

最终验证:
  □ 首页从 9 板块 → 5 板块
  □ POJU 页从 8 板块 → 4 板块
  □ Glyph 页从 9 板块 → 4 板块
  □ Syncro 页从 11 板块 → 5 板块
  □ 高危词搜索结果全部为 0
  □ 用户保留的 UI 完全没动
  □ 4 张关键图片(Glyph 截图 / POJU 对话 / Syncro mockup / Hero 动效)预留位置
```

---

## 完成

```
本文档涵盖:
  ✓ 全站架构重构 (Part 1-2)
  ✓ 4 个页面的板块级删减重构 (Part 3-6)
  ✓ 法律页面单独处理预告 (Part 7)
  ✓ 全站统一改动 (Part 8)
  ✓ Cursor 完整执行指令 (Part 9)

预计实施时间: 12-16 小时(Cursor + 你审核)
预计最终减少内容: 50%+
预计合规风险: 从【高】降到【低】
预计用户体验: 从【信息过载】到【清晰引导】
```
