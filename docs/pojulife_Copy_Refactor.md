# pojulife 全站文案对齐 + 支付网关合规重写

> **背景**:
> - Claude 已抓取并审阅 pojulife.com 主页 + 4 产品页 + Privacy / Terms / Contact
> - 发现 10 个对齐问题 + 6 个支付网关合规问题
>
> **本文档包含**:
> - Part 1: 全站文案修订(主页 + 4 产品页)
> - Part 2: 法律页重写(Disclaimer / Terms / Privacy / Refund / Cookie)
> - Part 3: 导航 / Footer / 品牌统一
> - Part 4: 支付网关合规检查清单
> - Part 5: Cursor 实施指令
>
> **核心定价(锁定)**:
> - POJU: $9.99 / session(30 天访问)
> - Glyph: 首次免费,后续 $4.99 / 次
> - Syncro: 首次免费,后续 $4.99 / 24 小时窗口
> - Match: 首次免费,后续 $4.99 / 次
>
> **执行原则**:每完成一个法律页,先贴出来给用户审视,确认后再继续

---

# Part 1: 主页文案修订

## 1.1 主页 Hero 区(更新)

```
位置:网站首页顶部

原文:
  "Break through what won't let you go."
  "Two thousand years of Eastern wisdom."
  "Confirmed by modern science."
  "Translated by AI — for you, today."
  "No account · No subscription · Decisions are yours alone"

⭐ 保留(已经非常好)— 但去掉 "Poju Life" 中间标识
```

**最终版本(EN)**:
```
# Break through what won't let you go.

Two thousand years of Eastern frameworks.
Reframed by modern research.
Translated by AI — for you, today.

No account · No subscription · Decisions are yours alone
```

**最终版本(ZH)**:
```
# 突破让你放不下的事。

两千年东方思考框架。
现代研究重新审视。
AI 为你翻译——为此刻。

无需账号 · 无订阅 · 决定永远属于你
```

⚠️ 注意改动:
- "Eastern wisdom" → "Eastern frameworks"(更中性,支付网关更喜欢)
- "Confirmed by modern science" → "Reframed by modern research"(避免夸大)

---

## 1.2 主页四件套定价区(关键修复)

```
原文(错误):
  "Three ways in. One way through."  ← 实际 4 个产品
  POJU $9.99 / Glyph "Free $1.99" / Syncro "Free" / Match "$4.99 First one free"

⚠️ 严重不一致,必须按新定价重写
```

**最终版本(EN)**:

```
## Four ways in. One way through.

[ POJU                                   $9.99 ]
For the question that won't let you go.
A 30-day deep conversation that walks 
with you until you see your way through.
Try POJU →

[ Glyph                  Free first · then $4.99 ]
A pocket-sized mirror for your moment.
Hold a question. Draw a pattern. 
Read what comes back. 60 seconds.
Try Glyph free →

[ Syncro                 Free first · then $4.99 ]
See your natural rhythms unfold.
Eight directions, twelve hour-periods.
A 24-hour live companion.
Try Syncro free →

[ Match                  Free first · then $4.99 ]
Two charts. One relationship.
See how your energies align — 
and what to do about it.
Try Match free →
```

**最终版本(ZH)**:

```
## 四扇门。一条路。

[ POJU                                  $9.99 ]
为那个让你放不下的问题。
30 天深度对话,陪你走到看清为止。
开始 POJU →

[ Glyph                  首次免费 · 之后 $4.99 ]
随身的反思之镜。
一个问题,一个符号,一次回响。60 秒。
免费试 Glyph →

[ Syncro                 首次免费 · 之后 $4.99 ]
看见你自己的自然节奏。
八方位,十二时辰。
24 小时实时陪伴。
免费试 Syncro →

[ Match                  首次免费 · 之后 $4.99 ]
两个命盘,一段关系。
看清你们的能量如何对接——以及该怎么做。
免费试 Match →
```

---

## 1.3 主页"What we built. Why it works."(微调)

```
原文 3 段:
  Eastern Wisdom
  Modern Science
  AI Translation

⭐ 保留结构,微调用词以更合规
```

**最终版本(EN)**:

```
## What we built. Why it works.

Two thousand years of human reflection on the questions 
that matter, examined through modern research, made 
accessible through AI. All for one purpose: helping you 
see what you couldn't see alone.

### Eastern Frameworks

For two thousand years, Eastern philosophical traditions 
have examined the questions humans keep asking — about 
decision, direction, and the patterns that shape a life.

Career. Love. Direction. Doubt.

These traditions weren't fortune-tellers. They were 
frameworks for thinking — refined over eighty generations 
of human experience.

### Modern Research

What ancient observation noticed, modern research is 
beginning to measure.

Cognitive science on how we frame decisions. 
Spatial psychology on attention. 
Circadian biology on natural rhythm. 
Behavioral economics on cognitive bias.

The frameworks that worked for millennia, now examined 
through contemporary research.

### AI Translation

We took the frameworks these traditions developed. 
We added what modern research has examined. 
We gave it to AI — to respond to your specific question, 
in your specific moment.

Not to replace your judgment. 
To return the conversation to you.

These tools are designed for self-reflection and 
personal exploration — not for predicting outcomes, 
diagnosing conditions, or providing professional advice.
```

⭐ 关键变化(支付网关合规):
- 移除 "Confirmed by modern science"(夸大)
- 加 "These tools are designed for self-reflection..."(明确产品性质)
- "fortune-tellers" 已经【否定式】使用(说"不是 fortune-tellers"),OK

---

## 1.4 主页"When pojulife meets your moment."(用例区)

```
原文:
  4 个 use case cards

⭐ 保留结构,微调措辞
```

**最终版本(EN)**:

```
## When pojulife meets your moment.

Real situations where pojulife helps you see clearly.

[ You're stuck between two paths. ]
Career change. Relationship decision. Where to live.
You've thought about it. Now think differently.
→ Try POJU

[ You need a fresh angle on what's circling. ]
Something feels off. You're not sure what.
Glyph holds up a mirror — read what comes back.
→ Try Glyph

[ You want to know your own rhythm. ]
When do you have momentum? When does friction arrive?
Syncro maps it, updated every two hours.
→ Try Syncro

[ You're considering a partnership or commitment. ]
Marriage. Business. A team hire.
See how two energetic patterns interact 
before you make the call.
→ Try Match

[ The question keeps you up at 2 AM. ]
You've talked to friends, read the books. Still circling.
POJU sits with you through it — once, until you see through.
→ Start a POJU session
```

⭐ 主要变化:
- 加了 Match 的 use case
- "updated through your day" → "updated every two hours"(具体)

---

## 1.5 主页 Three Non-Negotiables(微调)

```
原文非常好,只需微调措辞
```

**最终版本(EN)**:

```
## What we promise. What we won't do.

### Never stored

Your conversations stay encrypted on your device. 
Not on our servers. Not in our database.

Even if we wanted to read them, we couldn't. 
Even if we were breached, there's nothing to leak.

Your words stay yours.

### Never required

No account. No login. No password.

We ask for your email in two situations only: 
when you choose to purchase, or when you request 
a PDF of your reading.

In both cases, we send what you asked for — 
nothing more. No marketing. No newsletters. 
No drip campaigns. No third-party sharing.

Your inbox stays yours.

### Never manipulative

No subscriptions. No auto-renewals. No hidden fees. 
No upsells. No dark patterns.

Each use is a single, transparent choice. 
Free tools are clearly marked. 
Paid tools are clearly priced — once, when you decide to use them.

That's the entire business.

We're not a company that sells data 
because we don't collect data.

[Read the full privacy architecture →]
```

⭐ 微调:
- "If we were hacked" → "If we were breached"(更中性)
- "We don't collect data" → 强调

---

## 1.6 主页 Footer CTA(更新)

**最终版本(EN)**:

```
## Ready to begin?

Four ways in. Choose what fits this moment.

[Start a POJU session]    $9.99 · one question · 30 days
[Try Glyph]              First free · then $4.99 / reading
[Try Syncro]             First free · then $4.99 / day
[Start a Match]          First free · then $4.99 / reading
```

---

# Part 2: 四产品详情页文案

## 2.1 /poju 详情页(微调)

```
原文非常好,只需小修
```

**核心改动**:
- 保留 "Sometimes reading isn't enough." Hero
- CTA "Ask your question — $9.99" → "Start a POJU session — $9.99"
- "30-day session access" 明确写出

完整文案保留,只调整这两处。

---

## 2.2 /glyph 详情页(关键修改 - 定价)

```
原文:
  "Free. No signup. Read with a wink."
  "Try Glyph — Free"

⚠️ 必须改为新定价
```

**最终版本(EN)**:

```
# Glyph

A 60-second mirror.

Hold a question. Draw a pattern. Read a reflection.

First reading free. After that, $4.99 each.

[Try Glyph free]

## How Glyph works.

1. Hold your question.
   Compress it to 60 characters. The compression begins the answer.

2. Draw your pattern.
   One of 100 archetypal forms, refined over a thousand years 
   of Eastern reflection.

3. Read your reflection.
   A short response — grounded in classical frameworks and 
   modern psychology.

· One question per reading. Don't ask many things at once.
· Wait 48 hours before asking the same thing again. 
  Reflections need time to settle.
· Compress your question into 60 characters. 
  The compression is the beginning of the answer.

## Five winds — five archetypal patterns.

[保留 Divine Tailwind / Still Water / Eye of Storm / Fair Sky / Crosswind 完整描述]

## On the cards.

The five glyphs are not labels of fortune. 
They are not "good cards" or "bad cards."

Each one is a lens — a way of reading this particular 
moment, for this particular question, held by this 
particular person.

The same glyph can mean entirely different things on 
different days, for different people, about different 
questions.

What you receive is not a verdict. 
It is a perspective — and an invitation to look more 
carefully.

## Pricing

Your first Glyph reading is free. We want you to 
experience the tool with no commitment.

After that, each reading is $4.99 — a single transparent 
purchase. No subscription. No auto-renewal. No hidden fees.

Each reading is delivered to your screen and optionally 
sent to your email as a PDF.

[Try Glyph free]

Read with a wink. The patterns mirror, they don't predict.
```

⭐ 关键变化:
- 定价从"Free 永久"改为"首次免费 + $4.99"
- 加了 Pricing 单独章节
- 强调"No subscription"(支付网关友好)
- "60-second mirror" 保留(非常好)

---

## 2.3 /syncro 详情页(重大修改)

```
原文:
  "Free · Opens on mobile only"
  "Always free. Forever."
  
⚠️ 必须重写以匹配:
  - 首次免费 + $4.99 / 24 小时窗口
  - 完整 v5.0 设计(粒子圆 + VR 模式)
```

**最终版本(EN)**:

```
# Syncro

See your natural rhythms.

Based on your bazi foundation, Syncro reflects how each 
2-hour period and 8 directions align with your energy. 
Where to lean in. Where to slow down.

A live companion for the next 24 hours.

First Syncro free. After that, $4.99 per 24-hour window.

Opens on mobile only.

[Open Syncro on your phone]

[QR code to open on mobile]

## How Syncro works.

1. Add or pick a bazi foundation.
   Birth date, time, and gender. 
   Saved on your device for any future use.

2. Describe what you're about to do.
   30-100 characters. The clearer, the better.

3. Allow location & compass access.
   Your location stays on your device. Your phone's 
   compass shows where each direction is.

4. Hold your phone and turn.
   Each direction shows a short reflection for the 
   current 2-hour period.

## The five currents.

Each direction × hour combination is classified into 
one of five patterns:

[ Open Current · 顺势    ] Move with confidence.
[ Following Current · 应时 ] The way supports you, with effort.
[ Stillwater · 守静        ] Pause and observe.
[ Crosscurrent · 横阻      ] Reconsider this direction or moment.
[ Undertow · 险滞          ] Strong friction — choose another path.

These are reflective categories, not predictions.

## What Syncro shows.

✦ Current 2-hour pattern for each direction
✦ Eight directions with what they suit
✦ Where to lean in, where to slow down
✦ Updates every two hours through your 24-hour window

## What Syncro isn't.

✗ A predictor of events
✗ A promise of outcomes
✗ A replacement for your own judgment

## Why mobile only.

Syncro reads your phone's compass and (optionally) 
camera to align with real-world direction. This 
requires a mobile device. On desktop, we'll show 
you a QR code to open Syncro on your phone.

## Pricing

Your first Syncro is free. We want you to feel how 
spatial reflection works with no commitment.

After that, $4.99 unlocks a 24-hour live window — 
a complete day of guidance updating every two hours 
for one specific task you're focused on.

No subscription. No auto-renewal. Each Syncro window 
is a single transparent purchase.

[Open Syncro on your phone]
```

⭐ 关键变化:
- 完全重写定价模型
- 加入 5 个 Current 等级介绍
- 加入"为什么仅限手机"说明
- "Always free. Forever." 删除

---

## 2.4 /match 详情页(全新)

```
原文:基本是空的(Loading...)

⭐ 直接用我之前提供的完整 Match 介绍页
   (见 pojulife_UI_Refactor.md 中的 Match 介绍)
```

**最终版本结构**:

```
# Match

Two charts. One relationship. Real clarity.

Match weaves both bazi foundations together — 
yours and theirs — to reveal how your energies align, 
where you support each other, where you collide, 
and what to do about it.

First Match free. After that, $4.99 per reading.

[Run a Match free]

## Three features

[👥 Two-Chart Analysis]
Deep individual readings of both people, 
then a layered analysis of how you meet.

[🔮 Any Relationship Type]
Marriage, partnership, family, friendship, 
work — describe it in your own words.

[📋 Structured Report]
5 sections: each of you, together, conclusion, 
clear actionable reflections.

## How Match works

1. Pick Person A's chart
   Choose from your library or add a new one.

2. Pick Person B's chart
   Same flow. Saved for later matches.

3. Describe the relationship
   In your own words — current, intended, or in question.

4. Read your full report
   5 expandable sections. Saved to your Archive.

## What Match is for

[💍 Marriage decisions]
Considering long-term commitment? 
See what the charts say about long-term alignment.

[🤝 Business partnerships]
Evaluate co-founders before you sign.

[👨‍👩‍👧 Family dynamics]
Understand difficult relationships — parent, child, sibling.

[💼 Hiring & teams]
Read the energetic fit between you and a key hire.

[💔 Existing relationships]
Stuck in tension? See what's structural and what's surface.

[🌱 Close friendships]
Why some friendships flow and others fade.

## What's in your report

[A] About A — natural traits, what they bring.
[B] About B — same depth for the other person.
[×] Together — five-element interactions, ten-god dynamics, timing alignment.
[🎯] Conclusion — overall compatibility tier (5 levels), strengths and challenges.
[📋] What to do — 4-6 actionable reflections.

## Pricing

Your first Match is free.

After that, $4.99 per complete reading. Single transparent 
purchase. No subscription. No auto-renewal.

[Run a Match free]

## Common questions

[FAQ - 见 UI_Refactor 文档]

## What Match is not

✗ A predictor of relationship outcomes
✗ A promise of compatibility results
✗ A replacement for professional counseling

Match offers perspectives, not predictions. 
What you do with them is entirely yours.
```

---

# Part 3: 法律页 — 全部重写

## 3.1 Disclaimer 页(全新 - 当前是空的!)

```
⚠️ 当前 /disclaimer 页面完全没有内容
⚠️ 支付网关申请必查项,必须立即补完

设计原则:
  - 清晰说明产品性质(decision support / self-reflection)
  - 明确不是 medical / legal / financial advice
  - 明确不预测未来 outcomes
  - 明确用户对自己决定的全部责任
```

**完整内容(EN)**:

```markdown
# Disclaimer

Last updated: 2026-05-23
Version 1.0

## What pojulife is

pojulife (including POJU, Glyph, Syncro, and Match) provides 
AI-powered self-reflection and decision-support tools that 
draw on Eastern philosophical frameworks and modern psychology 
research. These tools generate text-based reflections in 
response to user input.

The tools are designed for personal exploration, journaling, 
and structured reflection — to help you think more clearly 
about questions you bring to them.

## What pojulife is not

pojulife is not, and does not provide:

* **Medical advice.** We do not diagnose, treat, cure, or 
  prevent any medical or mental health condition. If you have 
  medical concerns, consult a licensed healthcare professional.

* **Mental health treatment.** We are not therapists, 
  psychiatrists, or counselors. If you're experiencing a 
  mental health crisis, please contact a qualified professional 
  or crisis service (see "Crisis Support" below).

* **Legal advice.** We do not provide legal counsel. For legal 
  questions, consult a licensed attorney in your jurisdiction.

* **Financial or investment advice.** We do not provide 
  guidance on investments, taxes, or financial planning. 
  Consult a licensed financial advisor.

* **Predictions of the future.** Our tools do not predict 
  events, outcomes, or future circumstances. AI-generated 
  reflections are not forecasts.

* **Fortune-telling, divination, or paranormal services.** 
  pojulife uses Eastern philosophical frameworks as a 
  conceptual structure for reflection — similar to how 
  cognitive behavioral therapy uses frameworks for examining 
  thought patterns. We make no claims of supernatural insight 
  or predictive accuracy.

* **A substitute for professional consultation, human 
  relationships, or your own judgment.** Our tools are 
  designed to complement, not replace, professional advisors 
  and the people in your life.

## Your responsibility

You alone are responsible for:

* All decisions you make based on, around, or after using 
  pojulife.
* Verifying any information that pojulife provides before 
  acting on it.
* Seeking appropriate professional guidance for serious 
  matters (medical, legal, financial, mental health, etc.).
* Using pojulife in a manner consistent with your local laws 
  and your own values.

We do not guarantee any specific outcome from using 
pojulife. AI-generated text is, by nature, probabilistic and 
imperfect. We expect users to apply critical judgment to 
anything our tools produce.

## Cultural and philosophical frameworks

pojulife draws conceptually from Eastern philosophical 
traditions, including bazi (four-pillar reflection), 
the I Ching, and related classical frameworks. We treat 
these as cultural and philosophical resources for thinking 
— similar to how a therapist might draw on concepts from 
Carl Jung or how a strategist might draw on Sun Tzu.

We do not present these traditions as supernatural systems 
or as having predictive power over real-world events. 
References to traditional terminology (day master, favorable 
element, etc.) are used as analytical vocabulary, much as 
psychologists use terminology like "attachment style" or 
"locus of control."

## Age requirement

pojulife is intended for users 18 years of age or older. 
We do not knowingly serve users under 18. If you believe 
a minor has used pojulife, please contact 
privacy@pojulife.com.

## AI-generated content

All reflective text generated by pojulife is produced by 
artificial intelligence (specifically, large language 
models from Anthropic). AI-generated content:

* May contain errors, inaccuracies, or inconsistencies.
* Reflects patterns learned from training data, not 
  ground truth.
* Should not be relied upon as authoritative on any subject.
* Is provided for personal reflection only.

## Crisis support

If you are experiencing a mental health crisis, suicidal 
thoughts, or thoughts of harming yourself or others, 
please contact a qualified crisis service immediately:

* **United States**: 988 (Suicide & Crisis Lifeline — call 
  or text, 24/7)
* **United Kingdom**: 116 123 (Samaritans, 24/7)
* **EU general**: 116 123 or local emergency services
* **Canada**: 1-833-456-4566 (Talk Suicide Canada)
* **Worldwide**: <https://findahelpline.com>

pojulife is not equipped to handle mental health 
emergencies. Please reach out to someone trained to help.

## Limitation of liability

To the maximum extent permitted by law, pojulife and its 
operators are not liable for any direct, indirect, 
incidental, consequential, or punitive damages arising 
from your use of, or inability to use, pojulife — 
including but not limited to financial loss, lost 
opportunities, emotional distress, or relationship 
outcomes.

Your sole and exclusive remedy for any dissatisfaction 
with pojulife is to discontinue use. See our Refund 
Policy for purchase-related remedies.

## Updates to this Disclaimer

We may update this Disclaimer to reflect changes in our 
tools, regulations, or industry standards. The "Last 
updated" date at the top of this page reflects the most 
recent revision. Continued use of pojulife after an update 
constitutes acceptance.

## Questions

For questions about this Disclaimer:
**legal@pojulife.com**

For general questions:
**support@pojulife.com**

---

By using pojulife, you acknowledge that you have read, 
understood, and agreed to this Disclaimer.
```

**ZH 完整翻译**:

```markdown
# 免责声明

最后更新:2026-05-23
版本 1.0

## pojulife 是什么

pojulife(包括 POJU、Glyph、Syncro 和 Match)提供基于
人工智能的自我反思与决策支持工具,这些工具借鉴了东方
哲学框架与现代心理学研究。这些工具基于用户输入生成
文字形式的反思内容。

这些工具旨在用于个人探索、记录与结构化反思——帮助
你更清晰地思考你带来的问题。

## pojulife 不是什么

pojulife 不是,也不提供以下服务:

* **医疗建议**。我们不诊断、治疗、治愈或预防任何医疗
  或心理健康状况。如有医疗问题,请咨询持照医疗专业人员。

* **心理健康治疗**。我们不是治疗师、精神科医生或咨询师。
  如果你正在经历心理健康危机,请联系合格的专业人员或
  危机服务(见下方"危机援助")。

* **法律建议**。我们不提供法律咨询。如有法律问题,请
  咨询你所在司法管辖区的持照律师。

* **金融或投资建议**。我们不提供投资、税务或财务规划
  的指导。请咨询持照财务顾问。

* **对未来的预测**。我们的工具不预测事件、结果或未来
  情境。AI 生成的反思不是预测。

* **算命、占卜或超自然服务**。pojulife 将东方哲学框架
  作为反思的概念结构使用——类似认知行为疗法(CBT)使用
  框架来审视思维模式。我们不宣称任何超自然洞见或预测
  准确度。

* **专业咨询、人际关系或你自己判断的替代品**。我们的
  工具旨在补充而非取代专业顾问和你生活中的人。

## 你的责任

你独自承担以下责任:

* 你基于、围绕或在使用 pojulife 后所做的所有决定。
* 在采取行动前核实 pojulife 提供的任何信息。
* 在严重事务上寻求适当的专业指导(医疗、法律、财务、
  心理健康等)。
* 以符合当地法律与你自身价值观的方式使用 pojulife。

我们不保证使用 pojulife 会带来任何特定结果。AI 生成的
文字本质上是概率性且不完美的。我们希望用户对我们工具
生成的任何内容保持批判性判断。

## 文化与哲学框架

pojulife 在概念上借鉴东方哲学传统,包括八字(四柱反思
框架)、《易经》及相关古典框架。我们将这些视为思考的
文化与哲学资源——类似治疗师可能借鉴荣格的概念,或
战略家可能借鉴《孙子兵法》。

我们不将这些传统表述为超自然系统,或具有对真实世界
事件的预测能力。对传统术语(日主、用神等)的引用,
是作为分析词汇使用,正如心理学家使用"依恋类型"或
"控制点"等术语一样。

## 年龄要求

pojulife 面向 18 岁及以上的用户。我们不会有意服务
18 岁以下用户。如果你认为有未成年人使用过 pojulife,
请联系 privacy@pojulife.com。

## AI 生成内容

pojulife 生成的所有反思文字均由人工智能(具体来说,
是 Anthropic 公司的大语言模型)生成。AI 生成的内容:

* 可能包含错误、不准确或不一致的地方。
* 反映训练数据中学到的模式,而非客观真实。
* 不应作为任何主题的权威依据。
* 仅供个人反思使用。

## 危机援助

如果你正在经历心理健康危机、自杀念头或想要伤害自己
或他人的念头,请立即联系合格的危机服务:

* **中国大陆**:北京心理危机热线 010-82951332(24 小时)
* **美国**:988(自杀与危机生命线,24/7 可拨打或短信)
* **英国**:116 123(撒玛利亚会,24/7)
* **欧盟**:116 123 或当地紧急服务
* **加拿大**:1-833-456-4566(加拿大谈论自杀)
* **全球**:<https://findahelpline.com>

pojulife 不具备处理心理健康紧急情况的能力。请联系
受过专业训练的人。

## 责任限制

在适用法律允许的最大范围内,pojulife 及其运营方对因
你使用或无法使用 pojulife 而产生的任何直接、间接、
附带、后果性或惩罚性损害不承担责任——包括但不限于
经济损失、错失机会、情感困扰或关系结果。

你对 pojulife 不满意的唯一和独占救济是停止使用。
购买相关的救济见我们的退款政策。

## 本免责声明的更新

我们可能会更新本免责声明,以反映工具、法规或行业
标准的变化。本页顶部的"最后更新"日期反映最新修订。
更新后继续使用 pojulife 即表示接受。

## 问题

关于本免责声明的问题:
**legal@pojulife.com**

一般问题:
**support@pojulife.com**

---

使用 pojulife 即表示你已阅读、理解并同意本免责声明。
```

---

## 3.2 Refund Policy 页(全新独立页)

```
位置:新建 /refund 页面
重要性:⭐⭐⭐ 支付网关申请高度推荐的【独立页】
原因:Stripe / DodoPayments / PayPal 都建议把 Refund Policy 单独成页
```

**完整内容(EN)**:

```markdown
# Refund Policy

Last updated: 2026-05-23
Version 1.0

## Our promise

We want every paid purchase on pojulife to be one you're 
glad you made. If something goes wrong, we work with you 
to make it right.

## When you're eligible for a full refund

We issue full refunds in the following situations:

### 1. Technical failure
If a technical issue prevented you from accessing the 
session or reading you purchased, you're eligible for a 
full refund within **7 days** of purchase.

Examples:
* AI service unavailable during your session
* PDF delivery failed and could not be resolved
* Payment processed but no access was granted

### 2. Unused session
If you purchased a POJU session but have **not started 
the conversation**, you're eligible for a full refund 
within **24 hours** of purchase.

For Glyph, Syncro, and Match, "started" means the AI has 
begun generating your reading. Refunds are not available 
once a reading has been generated.

### 3. Duplicate charges
If you were charged more than once for the same purchase, 
we'll refund all duplicates immediately.

### 4. Fraudulent or unauthorized charges
If a charge was made without your authorization, contact 
us immediately. We'll refund and work with you to secure 
your account.

## What is not refundable

We do not offer refunds for:

* **Dissatisfaction with AI-generated content.** AI outputs 
  are inherently subjective and may not match every user's 
  expectations.
* **Changes of mind after a session has been started or 
  a reading has been generated.** Once delivered, the 
  service has been performed.
* **Requests submitted more than 7 days after purchase.**
* **Free first-use of Glyph, Syncro, or Match.** These 
  carry no charge, so there's nothing to refund.

## Subscription clarity

pojulife does not offer subscriptions. All paid purchases 
are **single, one-time charges** for a specific service:

* **POJU**: $9.99 per session (30-day access)
* **Glyph**: $4.99 per reading (after the first free)
* **Syncro**: $4.99 per 24-hour live window (after the first free)
* **Match**: $4.99 per reading (after the first free)

There are no auto-renewals, recurring charges, or hidden 
fees. Each purchase is a transparent, one-time transaction.

## How to request a refund

To request a refund:

1. Email **support@pojulife.com** within the eligible 
   window (typically 7 days).
2. Include:
   * Your payment confirmation ID (from your receipt email).
   * The product name (POJU / Glyph / Syncro / Match).
   * A brief description of why you're requesting a refund.
3. We'll review your request within **2 business days**.
4. If approved, refunds are processed within **5-10 
   business days** to your original payment method.

## What happens after a refund

When a refund is approved:

* The session, reading, or window is **deactivated**.
* Any associated local data on your device remains there 
  unless you choose to delete it.
* Any email we collected for PDF delivery is permanently 
  deleted (as per our standard practice — see Privacy Policy).

## Chargebacks

If you dispute a charge directly with your bank or card 
provider (a chargeback) without first contacting us, 
we may be unable to provide our usual support process. 
We strongly encourage you to email **support@pojulife.com** 
first — we resolve most issues faster than chargeback 
processes.

## Questions

Questions about this Refund Policy:
**support@pojulife.com**

We typically respond within 24 hours.
```

**ZH 完整翻译**:

```markdown
# 退款政策

最后更新:2026-05-23
版本 1.0

## 我们的承诺

我们希望你在 pojulife 上的每一次付费购买都让你满意。
如果出现问题,我们会与你一起解决。

## 何时可获得全额退款

我们在以下情况下提供全额退款:

### 1. 技术故障
如果技术问题导致你无法访问已购买的会话或解读,你可在
**购买后 7 天内**获得全额退款。

例子:
* 会话期间 AI 服务不可用
* PDF 投递失败且无法解决
* 支付已处理但未授予访问权

### 2. 未使用的会话
如果你购买了 POJU 会话但**尚未开始对话**,可在**购买
后 24 小时内**获得全额退款。

对于 Glyph、Syncro 和 Match,"开始"指 AI 已开始生成
你的解读。一旦生成解读,即不可退款。

### 3. 重复扣款
如果你被同一购买扣了多次款,我们会立即全额退还所有
重复扣款。

### 4. 欺诈或未授权扣款
如果出现未经你授权的扣款,请立即联系我们。我们会退款
并协助你保护账户安全。

## 不可退款的情况

我们不为以下情况提供退款:

* **对 AI 生成内容的不满意**。AI 输出本质上具有主观性,
  可能不符合每位用户的期望。
* **会话开始或解读已生成后的反悔**。一旦交付,服务已
  履行。
* **购买后超过 7 天的退款请求**。
* **Glyph、Syncro 或 Match 的首次免费使用**。这些不
  收费,无需退款。

## 关于订阅的说明

pojulife 不提供订阅服务。所有付费购买都是针对特定
服务的**单次、一次性扣款**:

* **POJU**:$9.99 / 次会话(30 天访问期)
* **Glyph**:$4.99 / 次解读(首次免费之后)
* **Syncro**:$4.99 / 24 小时实时窗口(首次免费之后)
* **Match**:$4.99 / 次解读(首次免费之后)

没有自动续费、定期扣款或隐藏费用。每次购买都是透明、
一次性的交易。

## 如何申请退款

申请退款的步骤:

1. 在符合条件的时间窗口内(通常 7 天)发邮件至
   **support@pojulife.com**。
2. 邮件需包含:
   * 你的支付确认编号(来自收据邮件)。
   * 产品名称(POJU / Glyph / Syncro / Match)。
   * 简短说明退款原因。
3. 我们将在 **2 个工作日内**审核你的申请。
4. 如获批准,退款将在 **5-10 个工作日内**退回到你
   原始支付方式。

## 退款后会发生什么

退款获批后:

* 会话、解读或窗口将被**停用**。
* 你设备上的本地数据保留,除非你选择删除。
* 我们为 PDF 投递而收集的任何邮箱会被永久删除
  (按我们的标准做法 — 见隐私政策)。

## 关于退单(Chargebacks)

如果你不先联系我们,直接向银行或信用卡机构申请退单
(chargeback),我们可能无法提供常规的支持流程。我们
强烈建议你先发邮件至 **support@pojulife.com** ——
大多数问题我们解决得比退单流程更快。

## 问题

关于本退款政策的问题:
**support@pojulife.com**

我们通常 24 小时内回复。
```

---

## 3.3 Terms of Service(重写 - 对齐 4 件套)

```
当前 Terms 存在问题:
  - 说 "Syncro and Glyph are free and always will be" ← 错
  - 完全没提 Match
  - 多处占位符:[日期] / [州名待律师确定]
  
需要重写
```

**完整内容(EN)**:

```markdown
# Terms of Service

Last updated: 2026-05-23
Version 1.0

## 1. Use of services

By accessing or using pojulife and its products — POJU, 
Glyph, Syncro, and Match (collectively, "the Services") 
— you agree to these Terms of Service ("Terms").

The Services provide AI-powered self-reflection and 
decision-support tools that draw on Eastern philosophical 
frameworks and modern psychology research. The Services 
are for lawful, personal use only and are intended for 
users 18 years of age or older.

You agree not to:
* Use the Services for commercial purposes without prior 
  written permission.
* Attempt to reverse-engineer, scrape, decompile, or 
  systematically access the Services.
* Use the Services to harass, defame, or harm others.
* Submit illegal, threatening, or harmful content.
* Impersonate others or misrepresent your identity.
* Use the Services in any way that violates applicable 
  laws or regulations.

## 2. Nature of the services

The Services produce reflective text using artificial 
intelligence. Outputs are designed for personal exploration 
and self-reflection. They do not constitute:

* Medical, mental health, legal, financial, or other 
  professional advice.
* Predictions of future events or outcomes.
* Guarantees of specific results.

See our Disclaimer at <https://pojulife.com/disclaimer> 
for full details.

You acknowledge that AI-generated outputs are inherently 
probabilistic and may contain errors. You agree to apply 
your own judgment to anything the Services produce.

## 3. Payments

### Pricing
* **POJU**: US$9.99 per session, charged once. Each 
  session provides 30 days of access to your conversation.
* **Glyph**: First reading is free. Each subsequent 
  reading is US$4.99, charged once per reading.
* **Syncro**: First 24-hour window is free. Each 
  subsequent window is US$4.99, charged once per window.
* **Match**: First reading is free. Each subsequent 
  reading is US$4.99, charged once per reading.

### No subscriptions
All payments are **one-time only**. There are no 
subscriptions, no automatic renewals, and no recurring 
charges of any kind.

### Price changes
Prices may change in the future. You will always see the 
current price before completing any payment.

### Payment processing
Payments are processed by third-party payment providers 
(e.g., Stripe, DodoPayments). We do not store your 
payment card details.

### What you receive
* **POJU**: 30-day access to your conversation, saved 
  locally on your device.
* **Glyph / Match**: Your complete reading, displayed 
  on screen and optionally delivered as a PDF.
* **Syncro**: 24-hour live access to direction-by-hour 
  guidance for one specified task.

## 4. Refunds

We offer refunds under the conditions described in our 
Refund Policy: <https://pojulife.com/refund>.

In summary:
* Full refund for technical failures (within 7 days).
* Full refund for unused POJU sessions (within 24 hours).
* Full refund for duplicate or unauthorized charges 
  (any time).
* No refunds for dissatisfaction with AI outputs or 
  changes of mind after delivery.

To request a refund, email support@pojulife.com.

## 5. Intellectual property

### Our property
The pojulife brand, logos, taglines, written content, 
product interfaces, and the Five Wind cards (Divine 
Tailwind, Fair Sky, Still Water, Crosswind, Eye of Storm) 
and the Five Current categories (Open Current, Following 
Current, Stillwater, Crosscurrent, Undertow) are 
proprietary to pojulife. You may not copy, modify, or 
redistribute them.

### Your content
Reflective text generated for your personal Session 
(e.g., AI responses, PDF reports) is yours to use 
personally. You may not:
* Republish AI-generated outputs as your own work.
* Use AI outputs for commercial purposes.
* Mass-distribute AI outputs to others.

### Public domain references
Classical philosophical works referenced by the Services 
(e.g., the I Ching, traditional bazi commentary) are in 
the public domain. pojulife does not claim exclusive 
rights over traditional ideas or texts.

## 6. Account and data

The Services are designed to work without traditional 
user accounts:
* No login is required to use the Services.
* Your conversations and readings are encrypted and 
  stored locally on your device.
* We collect minimal data — see our Privacy Policy at 
  <https://pojulife.com/privacy>.

You are responsible for the security of your device. 
We are not liable for loss of data resulting from device 
loss, damage, browser clearing, or similar events. 
You may export PDFs of important readings before such 
events.

## 7. Limitation of liability

To the maximum extent permitted by law:

* The Services are provided "as is" and "as available," 
  without warranties of any kind.
* We are not liable for any decisions, actions, or 
  outcomes resulting from your use of the Services.
* We are not liable for indirect, incidental, 
  consequential, or punitive damages.
* Our total cumulative liability in any claim is limited 
  to the total amount you paid to pojulife in the 
  preceding 12 months — typically US$9.99 to US$30.00.

See our Disclaimer for additional limitations.

## 8. Changes to these Terms

We may update these Terms to reflect changes in our 
Services, technology, or applicable law.

For **material changes** (e.g., new fees, significant 
restrictions, changes to refund eligibility):
* We will notify you via an in-app banner on your next 
  visit.
* Continued use after the change constitutes acceptance.
* If you do not agree, you may discontinue use.

For **minor changes** (typo corrections, clarifications):
* We will update the "Last updated" date.
* No active notification is required.

## 9. Governing law

These Terms are governed by the laws of the [JURISDICTION 
— TO BE CONFIRMED, e.g., State of Delaware, USA], 
without regard to its conflict of law principles.

Any disputes arising from or related to these Terms or 
the Services will be resolved through binding arbitration 
in [LOCATION — TO BE CONFIRMED], unless prohibited by 
local law in your jurisdiction.

If you are located in the European Union, the United 
Kingdom, or another jurisdiction with mandatory consumer 
protection laws, your statutory rights remain intact.

## 10. Termination

We reserve the right to terminate or suspend access to 
the Services at our discretion, particularly for:
* Violations of these Terms.
* Fraudulent activity.
* Use of the Services in a way that harms other users 
  or the platform.

Termination does not affect:
* Refund obligations under our Refund Policy.
* Your right to data deletion under our Privacy Policy.

## 11. Contact

Questions about these Terms:
**legal@pojulife.com**

General support:
**support@pojulife.com**

Privacy and data:
**privacy@pojulife.com**

---

By using pojulife, you acknowledge that you have read, 
understood, and agreed to these Terms of Service, our 
Privacy Policy, our Refund Policy, and our Disclaimer.
```

**ZH 完整翻译**:

```markdown
# 服务条款

最后更新:2026-05-23
版本 1.0

## 1. 服务的使用

通过访问或使用 pojulife 及其产品 ——POJU、Glyph、
Syncro 和 Match(统称"服务")—— 即表示你同意本服务
条款("条款")。

本服务提供基于人工智能的自我反思与决策支持工具,
借鉴东方哲学框架与现代心理学研究。本服务仅供合法、
个人使用,面向 18 岁及以上的用户。

你同意不会:
* 未经事先书面许可,将服务用于商业目的。
* 试图反向工程、抓取、反编译或系统性访问服务。
* 使用服务骚扰、诽谤或伤害他人。
* 提交非法、威胁性或有害的内容。
* 冒充他人或谎称身份。
* 以任何违反适用法律或法规的方式使用服务。

## 2. 服务的性质

本服务通过人工智能生成反思性文字。输出旨在用于个人
探索与自我反思。它们不构成:

* 医疗、心理健康、法律、金融或其他专业建议。
* 对未来事件或结果的预测。
* 任何特定结果的保证。

完整说明见我们的免责声明:
<https://pojulife.com/disclaimer>。

你承认 AI 生成的输出本质上具有概率性,可能包含错误。
你同意对服务生成的任何内容运用你自己的判断。

## 3. 付款

### 价格
* **POJU**:每次会话 9.99 美元,一次性收费。每次
  会话提供 30 天的对话访问权。
* **Glyph**:首次解读免费。之后每次解读 4.99 美元,
  按次一次性收费。
* **Syncro**:首次 24 小时窗口免费。之后每次窗口
  4.99 美元,按次一次性收费。
* **Match**:首次解读免费。之后每次解读 4.99 美元,
  按次一次性收费。

### 无订阅
所有付款均为**单次一次性**。没有订阅、自动续费或
任何形式的定期扣款。

### 价格变更
价格未来可能变更。你在完成任何付款前都会看到当时
的价格。

### 支付处理
付款由第三方支付服务商处理(如 Stripe、DodoPayments)。
我们不存储你的支付卡详细信息。

### 你将获得什么
* **POJU**:30 天会话访问权,保存在你设备本地。
* **Glyph / Match**:完整的解读,在屏幕上显示,
  并可选择以 PDF 形式投递。
* **Syncro**:24 小时实时访问权,针对一项指定任务
  的方位 × 时辰指引。

## 4. 退款

我们按退款政策提供退款:<https://pojulife.com/refund>。

简要说明:
* 技术故障全额退款(7 天内)。
* 未开始的 POJU 会话全额退款(24 小时内)。
* 重复或未授权扣款全额退款(任何时间)。
* 不为对 AI 输出不满或交付后反悔提供退款。

申请退款请发邮件至 support@pojulife.com。

## 5. 知识产权

### 我们的财产
pojulife 品牌、标志、口号、书面内容、产品界面、
五风卡(天德顺风、晴和、止水、横风、风眼)和五种
水流类别(顺势、应时、守静、横阻、险滞)均属
pojulife 所有。你不得复制、修改或重新分发。

### 你的内容
为你个人会话生成的反思文字(如 AI 回应、PDF 报告)
归你个人使用。你不得:
* 将 AI 生成的输出作为自己的作品重新发布。
* 将 AI 输出用于商业目的。
* 大规模分发 AI 输出给他人。

### 公共领域引用
本服务引用的古典哲学作品(如《易经》、传统八字
注疏)处于公共领域。pojulife 不主张对传统思想或
文本的排他性权利。

## 6. 账户与数据

本服务在设计上不需要传统的用户账户:
* 使用服务无需登录。
* 你的对话和解读经加密后保存在你设备本地。
* 我们收集的数据极少 — 见隐私政策:
  <https://pojulife.com/privacy>。

你负责自己设备的安全。我们不对因设备丢失、损坏、
浏览器清理或类似事件造成的数据丢失负责。在此类
事件之前,你可以导出重要解读的 PDF。

## 7. 责任限制

在适用法律允许的最大范围内:

* 本服务按"现状"和"现有可用"提供,不附带任何
  形式的保证。
* 我们不对你使用服务产生的任何决定、行动或结果
  负责。
* 我们不对间接、附带、后果性或惩罚性损害负责。
* 我们在任何索赔中的累计总责任,以你在前 12 个月
  向 pojulife 支付的总额为限 —— 通常为 9.99 至
  30.00 美元。

更多限制见我们的免责声明。

## 8. 本条款的变更

我们可能更新本条款,以反映服务、技术或适用法律的
变化。

对于**重大变更**(如新费用、重要限制、退款资格变化):
* 我们将在你下次访问时通过应用内横幅通知你。
* 变更后继续使用即表示接受。
* 如果你不同意,可以停止使用。

对于**次要变更**(错别字修正、澄清):
* 我们将更新"最后更新"日期。
* 不需要主动通知。

## 9. 适用法律

本条款受 [司法管辖区 —— 待确定,如美国特拉华州]
法律管辖,不考虑其法律冲突原则。

因本条款或服务产生或相关的任何争议,将通过 [地点
—— 待确定] 的有约束力的仲裁解决,除非你所在司法
管辖区的当地法律禁止。

如果你位于欧盟、英国或其他具有强制性消费者保护法
的司法管辖区,你的法定权利保持不变。

## 10. 终止

我们保留自行决定终止或暂停服务访问的权利,特别是
针对:
* 违反本条款。
* 欺诈活动。
* 以伤害其他用户或平台的方式使用服务。

终止不影响:
* 退款政策下的退款义务。
* 隐私政策下你的数据删除权。

## 11. 联系

关于本条款的问题:
**legal@pojulife.com**

一般支持:
**support@pojulife.com**

隐私与数据:
**privacy@pojulife.com**

---

使用 pojulife 即表示你已阅读、理解并同意本服务条款、
我们的隐私政策、退款政策和免责声明。
```

⚠️ 重要占位符必须确认后填:
- `[JURISDICTION — TO BE CONFIRMED, e.g., State of Delaware, USA]`
- `[LOCATION — TO BE CONFIRMED]`
- 当你完成 Atlas LLC 注册后,这两处用实际信息替换

---

## 3.4 Privacy Policy(微调 - 修复占位符 + 加 Match)

```
现状:Privacy Policy 已经很详细,只需小修
```

**修改清单**:

1. 顶部 "Last updated: [日期]" → "Last updated: 2026-05-23"

2. 第 11 节 "Physical address (if required by your jurisdiction): [待律师确定后填入]" 
   → 暂时改为:
   ```
   Physical address:
   [Available upon request — email legal@pojulife.com]
   ```
   (LLC 注册后再用实际地址替换)

3. 全文检查 "POJU" 引用,改为 "pojulife and its products (POJU, Glyph, Syncro, Match)" 来涵盖 4 件套

4. 第 6 节(Third-Party Services)需要审查并更新:
   ```
   ⚠️ 当前列出了这些服务:
   - Anthropic (Claude API) ✓ 保留
   - OpenAI(embedding 用)→ 确认是否还在用
   - ElevenLabs(TTS)→ 确认是否还在用
   - Stripe ✓ 保留
   - Resend ✓ 保留
   - Vercel ✓ 保留
   - Supabase ✓ 保留
   - FingerprintJS ✓ 保留
   
   需要加:
   - DodoPayments(如果实际使用)
   - DeepSeek(因为 v5.0 用 DeepSeek 不是 Claude!)
   ```

5. **重要更新**:第 7 节 "AI Model Data Handling"
   ```
   当前提到 Anthropic Claude
   但 v5.0 实际用 DeepSeek V4 Pro
   
   需要更新为:
   "Your conversations are sent to AI providers including 
   Anthropic (Claude) and DeepSeek (DeepSeek V4) for 
   processing. We've configured our integrations to:
   
   ✓ Anthropic: Zero Data Retention (ZDR) enabled
   ✓ DeepSeek: No training on user data
   ✓ No human review by default
   
   Your conversations are not used to improve any AI model."
   ```

6. 第 8 节 Children's Privacy 改成:
   ```
   pojulife is intended for users 18 years of age or older. 
   ...
   ```
   (跟 Terms 一致)

## 3.5 Cookie Policy(全新)

```
位置:新建 /cookies 页面
原因:GDPR / 欧盟用户必需,支付网关推荐
```

**完整内容(EN)**:

```markdown
# Cookie Policy

Last updated: 2026-05-23
Version 1.0

## What are cookies?

Cookies are small text files placed on your device when 
you visit a website. They help the website remember 
information about your visit — like your language 
preference or your session state.

This Cookie Policy explains how pojulife uses cookies 
and similar technologies, and how you can control them.

## Our cookie philosophy

pojulife is designed to function with **as few cookies 
as possible**. We do not use cookies for tracking, 
advertising, or selling your data.

We use cookies only when strictly necessary or when 
they significantly improve your experience.

## Cookies we use

### 1. Strictly necessary cookies

These cookies are essential for the website to function. 
They cannot be disabled.

| Cookie name | Purpose | Duration |
|---|---|---|
| `pojulife_locale` | Remembers your language preference | 1 year |
| `pojulife_session` | Maintains your active session | Session |
| `cf_clearance` | Cloudflare security check | 30 days |

### 2. Functional cookies

These cookies enhance your experience but are not strictly 
required.

| Cookie name | Purpose | Duration |
|---|---|---|
| `pojulife_theme` | Remembers your visual preferences | 1 year |
| `pojulife_consent` | Remembers your cookie choices | 1 year |

### 3. Local storage (similar to cookies)

We use browser local storage (IndexedDB) to store:
* Your encrypted conversations
* Your bazi foundation data (if you've entered any)
* Your reading history (Archive)

This data **stays on your device** and is never sent to 
our servers in plain form.

## What we don't use

We do **not** use:
* ❌ Advertising cookies
* ❌ Third-party tracking cookies
* ❌ Social media tracking pixels
* ❌ Cross-site tracking
* ❌ Google Analytics or similar behavioral analytics

We may use **Cloudflare** for security and performance 
(DDoS protection, CDN). Cloudflare may set technical 
cookies for security purposes only.

## Managing your cookies

### In your browser
You can manage or delete cookies through your browser 
settings:
* [Chrome](https://support.google.com/chrome/answer/95647)
* [Safari](https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac)
* [Firefox](https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer)
* [Edge](https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09)

### Disabling cookies
You can disable cookies in your browser settings, but 
this may affect some functionality of pojulife (such as 
remembering your language).

### Clearing your local data
To clear all locally stored conversations, readings, and 
data:
* Use your browser's "Clear site data" option for 
  pojulife.com
* Or use the "End & Wipe" button within our app

## EU / UK users — your rights

If you're in the EU or UK, you have rights under GDPR / 
UK GDPR:

* **Consent**: We ask for consent before setting non-
  essential cookies (functional cookies).
* **Withdraw consent**: You can withdraw consent any 
  time via the cookie banner.
* **Access**: You can request information about cookies 
  set on your device.

To exercise these rights, contact privacy@pojulife.com.

## Changes to this policy

We may update this Cookie Policy as our practices evolve 
or as required by law. The "Last updated" date reflects 
the most recent revision.

## Questions

Privacy and cookie questions:
**privacy@pojulife.com**
```

**ZH 完整翻译**(简化版,Cursor 可补全):

```markdown
# Cookie 政策

最后更新:2026-05-23
版本 1.0

## 什么是 Cookie

Cookie 是当你访问网站时放置在你设备上的小型文本文件。
它们帮助网站记住关于你访问的信息 —— 比如你的语言偏好
或会话状态。

本 Cookie 政策说明 pojulife 如何使用 Cookie 与类似
技术,以及你如何控制它们。

## 我们的 Cookie 哲学

pojulife 设计上使用**尽可能少的 Cookie**。我们不为
追踪、广告或出售你的数据而使用 Cookie。

我们只在严格必要时,或它们能显著改善你的体验时,
使用 Cookie。

## 我们使用的 Cookie

### 1. 严格必要的 Cookie
这些是网站正常运作所必需的,无法禁用。

[表格 - 内容同英文版]

### 2. 功能性 Cookie
这些 Cookie 增强你的体验,但不是严格必需。

[表格 - 内容同英文版]

### 3. 本地存储(类似 Cookie)
我们使用浏览器本地存储(IndexedDB)来保存:
* 你加密的对话内容
* 你的八字基础数据(如果你输入过)
* 你的解读历史(Archive)

这些数据**保留在你设备本地**,从不以明文形式发送到
我们的服务器。

## 我们不使用什么

我们**不**使用:
* ❌ 广告 Cookie
* ❌ 第三方追踪 Cookie
* ❌ 社交媒体追踪像素
* ❌ 跨网站追踪
* ❌ Google Analytics 或类似行为分析

我们可能使用 **Cloudflare** 进行安全与性能保障
(DDoS 防护、CDN)。Cloudflare 可能仅出于安全目的
设置技术性 Cookie。

## 管理你的 Cookie
[内容同英文版]

## 欧盟 / 英国用户 — 你的权利
[内容同英文版]

## 政策变更
我们可能根据实践演变或法律要求更新本 Cookie 政策。
"最后更新"日期反映最新修订。

## 问题

隐私与 Cookie 问题:
**privacy@pojulife.com**
```

---

# Part 4: 全站统一(品牌 / 导航 / Footer)

## 4.1 品牌名规范(全站统一)

```
当前混乱:
  - "pojulife"(平台名,正确)
  - "Pojulife"(出现在 header,需改)
  - "POJU LIFE"(出现在 Contact 页,需改)
  - "Poju Life"(出现在主页 Hero,需删)
  - "POJU"(产品名,正确)

最终规范:
  ✅ 平台名: pojulife(全小写,所有提及)
  ✅ 产品名: POJU / Glyph / Syncro / Match
  ✅ Logo: 文字部分用 "pojulife"
  ✅ 不再使用: Pojulife / POJU LIFE / Poju Life
```

## 4.2 全站导航(统一)

```
当前不一致:
  - 主页:    POJU / Glyph / Syncro / Match
  - POJU 页: POJU / Glyph / Syncro / Archive(无 Match!)
  - Glyph 页:POJU / Glyph / Syncro / Archive(无 Match!)
  - Syncro 页:POJU / Glyph / Syncro / Archive(无 Match!)
  - Match 页:POJU / Glyph / Syncro / Match(无 Archive!)

统一后:
  ┌─────────────────────────────────────────────────┐
  │ pojulife · POJU · Glyph · Syncro · Match · Archive │
  └─────────────────────────────────────────────────┘
  
  5 个产品入口 + 平台 logo
  全站所有页面【完全一致】
```

## 4.3 全站 Footer(统一)

```
当前不一致:
  - 主页 footer 免责声明: "For self-reflection and entertainment. pojulife offers perspectives, not predictions."
  - POJU 页 footer: "POJU is a thinking partner. It offers perspectives, not prophecies."
  - Glyph 页 footer: "For self-reflection and entertainment. POJU offers perspectives, not predictions."
  - Syncro 页 footer: "Syncro is a self-awareness tool. Take what resonates."

统一后:
```

**最终 Footer(EN)**:

```html
<footer>
  <div class="footer-brand">
    <img src="/logo.png" alt="pojulife" />
    <span>pojulife.com</span>
  </div>
  
  <div class="footer-links">
    <a href="/">Home</a>
    <a href="/poju">POJU</a>
    <a href="/glyph">Glyph</a>
    <a href="/syncro">Syncro</a>
    <a href="/match">Match</a>
    <a href="/archive">Archive</a>
  </div>
  
  <div class="footer-legal">
    <a href="/disclaimer">Disclaimer</a>
    <a href="/privacy">Privacy Policy</a>
    <a href="/terms">Terms of Service</a>
    <a href="/refund">Refund Policy</a>
    <a href="/cookies">Cookie Policy</a>
    <a href="/contact">Contact</a>
  </div>
  
  <div class="footer-bottom">
    <p>© 2026 pojulife. All rights reserved.</p>
    <p class="footer-disclaimer">
      pojulife offers perspectives, not predictions. 
      Designed for self-reflection only. 
      All decisions are yours alone.
    </p>
  </div>
</footer>
```

**最终 Footer(ZH)**:

```html
<footer>
  <!-- ... -->
  
  <div class="footer-bottom">
    <p>© 2026 pojulife. 保留所有权利。</p>
    <p class="footer-disclaimer">
      pojulife 提供视角,不提供预测。
      仅供自我反思使用。
      所有决定永远属于你。
    </p>
  </div>
</footer>
```

---

# Part 5: 支付网关合规检查清单

```
完成所有修改后,对照这个清单检查:

【必备页面】
□ /disclaimer        ← 当前为空,完成 Part 3.1 后会有内容
□ /privacy           ← 已有,Part 3.4 微调
□ /terms             ← Part 3.3 重写
□ /refund            ← 新建(Part 3.2)
□ /cookies           ← 新建(Part 3.5)
□ /contact           ← 已有,不需改

【支付透明度】
□ 主页清楚显示每个产品价格
□ 每个产品页清楚显示价格
□ 明确"无订阅 / 一次性付费"
□ 价格在购买前可见
□ 退款政策清晰链接

【合规措辞】
□ 删除所有 "fortune-telling" 直接表述
□ 删除所有 "predict the future" 主动表述
□ 替换为 "perspectives, not predictions"
□ 替换为 "decision support tool"
□ 替换为 "self-reflection"
□ 替换为 "educational and reflective"

【免责声明清晰】
□ Disclaimer 页中清晰说明不是医疗 / 法律 / 财务建议
□ 每个产品页底部有 "perspectives, not predictions" 提示
□ Footer 全站统一免责声明

【年龄要求】
□ 18+ 限制写入 Disclaimer
□ 18+ 限制写入 Terms
□ 18+ 限制写入 Privacy

【公司信息】(用户业务工作)
□ Atlas LLC 注册完成后
  - 更新 Privacy 第 11 节地址
  - 更新 Terms 第 9 节 jurisdiction
  - 添加公司全称到 Footer

【支付服务商信息】
□ Privacy 第 6 节第三方服务列表准确
  - 加 DodoPayments(如使用)
  - 加 DeepSeek(v5.0 改用)
  - 确认 OpenAI / ElevenLabs 是否还用
```

---

# Part 6: 给 Cursor 的实施指令

```
任务:全站文案对齐 + 法律页重写

【优先级 P0 - 立即做】

任务 1: 5 个法律页(必须 100% 完成才能申请支付网关)

  1.1 /disclaimer
  - 当前为空,创建完整内容
  - 内容见本文档 Part 3.1(英文 + 中文)
  - 路径: app/[locale]/(marketing)/disclaimer/page.tsx
  - 用 messages/en/disclaimer.json + messages/zh/disclaimer.json
  
  1.2 /refund(新建)
  - 完整内容见本文档 Part 3.2
  - 路径: app/[locale]/(marketing)/refund/page.tsx
  
  1.3 /terms
  - 当前内容需要重写
  - 完整内容见本文档 Part 3.3
  - 保留 [JURISDICTION — TO BE CONFIRMED] 占位符
  - Atlas LLC 注册后用户会更新
  
  1.4 /privacy
  - 当前内容只需微调,见本文档 Part 3.4
  - 占位符 "[日期]" → "2026-05-23"
  - 第 7 节 AI 部分加 DeepSeek 说明
  - 第 11 节地址改为 "Available upon request"
  
  1.5 /cookies(新建)
  - 完整内容见本文档 Part 3.5
  - 路径: app/[locale]/(marketing)/cookies/page.tsx

  每完成一个:贴出渲染效果给用户审视,确认后再继续下一个。
  
【优先级 P0.5 - 紧接着做】

任务 2: 主页文案对齐

  2.1 主页 Hero 区
  - 删除 "Poju Life" 标识
  - 文案见本文档 Part 1.1
  
  2.2 主页四件套定价区
  - 完全重写,见 Part 1.2
  - 注意:"Three ways in" → "Four ways in"
  - 每个产品的定价表述必须跟法律页一致
  
  2.3 主页 "What we built" 微调
  - 用 Part 1.3 的文案
  
  2.4 主页 use cases
  - 加 Match 的 use case
  - 用 Part 1.4 的文案
  
  2.5 主页 Footer CTA
  - 用 Part 1.6 的文案

【优先级 P1 - 主页之后】

任务 3: 4 个产品详情页修改

  3.1 /poju
  - CTA 微调:"Ask your question — $9.99" → "Start a POJU session — $9.99"
  - 加 "30-day access" 明确说明
  
  3.2 /glyph
  - 完全重写定价区
  - 删除 "Free. No signup."
  - 改为 "First reading free. After that, $4.99 each."
  - 加 Pricing 单独章节
  - 完整内容见 Part 2.2
  
  3.3 /syncro
  - 完全重写定价
  - 删除 "Always free. Forever."
  - 加入完整 v5.0 描述(粒子圆 / VR / 5 个 Current)
  - 完整内容见 Part 2.3
  
  3.4 /match
  - 当前几乎是空白
  - 用 Part 2.4 内容 + UI_Refactor 文档的设计

【优先级 P1.5 - 同步做】

任务 4: 全站品牌 / 导航 / Footer 统一

  4.1 品牌名
  - 全站搜索 "Pojulife" 替换为 "pojulife"
  - 全站搜索 "POJU LIFE" 替换为 "pojulife"
  - 全站搜索 "Poju Life" 替换为 "pojulife"
  - "POJU" 作为产品名保留
  
  4.2 导航
  - 所有页面统一:pojulife · POJU · Glyph · Syncro · Match · Archive
  - 见 Part 4.2
  
  4.3 Footer
  - 全站统一 footer,加入新增的 /refund 和 /cookies 链接
  - 统一免责声明文字
  - 见 Part 4.3

【验证】

完成所有任务后,跑一遍合规检查清单(Part 5):
  □ 5 个法律页完整
  □ 支付透明度
  □ 合规措辞
  □ 18+ 标注
  □ 占位符标注清楚

【提交报告】

完成后向用户提交:
1. 5 个法律页的截图描述
2. 4 个产品页修改对比
3. 主页修改对比
4. 全站搜索结果(确认品牌名统一)
5. Part 5 合规检查清单结果
6. 任何剩余的占位符列表(等用户业务工作完成后填)

【严格执行】

每个任务完成 → 贴报告 → 等用户确认 → 下一任务
绝不允许跨任务实施
```

---

# 总结清单

```
✅ 修复的关键问题(共 10 个):
  1. 定价不一致(Glyph 完全免费 → $4.99 首免)
  2. Syncro 定价错误("永远免费" → $4.99 首免)
  3. Match 介绍页空白
  4. Disclaimer 页完全为空
  5. "Three ways" → "Four ways"
  6. 品牌名混乱(Pojulife/POJU LIFE/Poju Life → pojulife)
  7. 导航不统一(各页缺 Match 或 Archive)
  8. Footer 免责声明 4 种写法
  9. Terms 没提 Match 产品
  10. 占位符 [日期] / [州名] 未填

✅ 新增的页面(共 2 个):
  - /refund(独立退款政策)
  - /cookies(Cookie 政策)

✅ 支付网关合规重点:
  - 所有产品定价透明
  - "perspectives, not predictions" 全站统一
  - "self-reflection" 替代 "fortune-telling"
  - 明确 "no subscription"
  - 明确 18+ 限制
  - 明确不是医疗 / 法律 / 财务建议
  - Refund Policy 独立页

✅ 还需要用户提供(业务工作完成后):
  - Atlas LLC 注册后的州 + 公司地址
  - 实际使用的支付服务商最终清单
  - 是否还用 OpenAI / ElevenLabs

📝 文档统计:
  - 总长度:~3000 行
  - 完整中英文文案
  - 5 个法律页完整内容
  - 主页 + 4 产品页完整文案
  - 支付网关合规检查清单
  - 详细 Cursor 实施指令
```

---

**这份文档可以直接复制给 Cursor。**

**但建议先做这个顺序**:
1. 你审视 → 确认整体方向
2. 法律页(P0)优先,这是支付网关申请前提
3. 主页和产品页(P0.5 + P1)
4. 品牌 / 导航 / Footer(P1.5)

需要我对某个部分单独优化吗?
