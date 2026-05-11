# POJU v4.0 批次 2 · 补丁文档

> **目的**: 修订批次 2 中的部分章节
>
> **修订原因**:
> - Glyph 现有 UI / 卡片样式 / 签诗内容 / 抽签过程已定稿,本补丁标记"保留现有"
> - Glyph 输出加入"Exploration"(探索动作),改为 5 段结构
> - Syncro 双模式仪式感升级(平放矫正 → 竖起摄像头开)
> - Syncro 新增桌面端引导页设计
>
> **使用方式**:
> - 本文档与 POJU_v4.0_Batch2.md 配合阅读
> - 标记 [REVISE] 的章节用本补丁的内容
> - 标记 [PRESERVE] 的章节保留现有定稿
> - 其他章节保留批次 2 原内容

---

# 第 4 章 · Glyph 修订

## 4.1-4.4 [PRESERVE]

```
保留批次 2 中的:
- 4.1 与 v3.0.1 的差异
- 4.2 Glyph 用户旅程
- 4.3 Glyph 数据流
- 4.4 5 风等级 + 100 签关系

但要注意:
  ✓ UI 元素 / 卡片样式 / 抽签动画 / 报告渲染
    全部保留【现有定稿】
  ✓ 仅【后端流程】和【数据接入】按批次 2 描述
```

## 4.5 UI 显示 [PRESERVE]

```
完全保留现有定稿:
- 5 风等级的视觉显示
- 100 签卡片样式
- 抽签动画(粒子球、3D 效果)
- 报告页面布局
- 字体、配色、间距

本文档不涉及 UI 修改,仅涉及【内容生成逻辑】。
```

## 4.6 [REVISE] Glyph 输出报告新结构(5 段)

### 修订要点

```
原批次 2 设计: 4 段结构
  Section 1: Your Pattern (5%)
  Section 2: Your Glyph (60%)
  Section 3: Your Moment (20%)
  Section 4: A Reflection (15%)

v4.0 最终设计: 5 段结构
  Section 1: Your Pattern (5%)
  Section 2: Your Glyph (55%)        ← 调整
  Section 3: Your Moment (15%)       ← 调整
  Section 4: An Exploration (10%)    ← 新增
  Section 5: A Reflection (15%)

新增 Section 4 的理由:
  - 用户读完报告,需要【做点什么】
  - 但不是"行动建议"(避免与 POJU 抢戏)
  - 是【内省练习】,延伸反思
  - 与 POJU 的"行动追踪"明确区分
```

### 完整 5 段结构

```markdown
# Glyph #17: Following the Flow
**☀ Fair Sky**

---

## Section 1: Your Pattern (5%)

A short paragraph (30-50 words) introducing the wind 
category in the context of this glyph.

Example:
"This is a Fair Sky moment — the path is clear and 
supportive, but you must walk it. Conditions favor 
movement, but movement requires choice."

---

## Section 2: Your Glyph (55%)

### The Classical Voice
Brief reference to the classical context (50-80 words).

Example:
"This glyph descends from the principle of 'following 
that which leads' — a wisdom about strategic adaptation. 
The original observation: when leadership requires 
followership first, those who refuse to follow cannot 
later lead."

### What It Means for Your Question
Deep interpretation (180-280 words) — the core content.

Example:
"For your specific question — [user's question] — this 
glyph speaks to a tension you may not have named: the 
difference between leading and originating.

You're someone whose strength is implementation 
[from user_profile.identity], and this current period 
favors structure [from user_profile.current_phase].
The opportunity in front of you may feel like it 
requires you to lead immediately. But the glyph 
suggests something different.

The right move now is to follow strategically — to 
position yourself in alignment with what's already 
moving, rather than to push your own direction. This 
isn't passivity. It's the recognition that this 
particular role wants you to demonstrate followership 
before granting authority."

### The Hidden Tension
What the user might miss (60-100 words).

Example:
"Watch for the trap of confusing 'following' with 
'submission'. The glyph isn't asking you to defer to 
others' wishes — it's asking you to align with what 
the situation itself is trying to do. Your discernment 
matters: follow the truth of the situation, not 
necessarily the personalities."

---

## Section 3: Your Moment (15%)

Brief modern interpretation tying glyph to user's 
current temporal energy (80-120 words).

Example:
"You're in a 6th-year da yun phase that supports 
growth through structure [from user_profile.temporal_layer].
The current month carries themes of recovery and 
quiet observation [from current_phase.month_focus].

Together, this is a moment to be patient. The 
opportunity is real, but it wants to be earned through 
demonstrated capacity, not seized through declaration."

---

## Section 4: An Exploration (10%) ⭐ 新增

A small internal practice (60-90 words) — NOT an action 
recommendation, but a way to explore the question further.

Important: This is NOT prescribing a decision or action.
It's an inner exercise to deepen reflection.

Examples:

For a career question:
"Try this evening:

Sit with your question for 5 minutes — not to solve it, 
just to notice. What physical sensation does it create? 
Where in your body does it sit? You don't need to share 
what you find."

For a relationship question:
"Today, write down — for yourself only — the one specific 
moment in the past month when this question started 
feeling urgent. 10 minutes. Don't share it. Just notice 
what made that moment different."

For a direction question:
"Before you sleep tonight, ask yourself: if I had to 
choose by tomorrow morning, what would my gut say? Don't 
analyze the answer. Just notice it. Then sleep on it."

Characteristics of good Exploration:
✓ Internal (not external action)
✓ Small (5-15 minutes)
✓ Specific (not vague)
✓ Time-bound (today/tonight/within 24 hours)
✓ Solo (no other people involved)
✓ Non-deciding (doesn't push toward a decision)

What it is NOT:
✗ "Talk to your boss" (that's POJU territory)
✗ "Make a decision" (that's the user's job)
✗ "Trust your intuition" (too vague)

---

## Section 5: A Reflection (15%)

A single thoughtful question (40-60 words), not a directive.

Example:
"Question to sit with:

If this opportunity required you to be a follower for 
six months before becoming a leader, would you take it? 
And what does your honest answer reveal about what 
you're really seeking?"

---

*Take what resonates. Leave what doesn't. The decision 
remains entirely yours.*
```

### Glyph 输出长度新分布

```
Total: 600-800 words

旧分布(批次 2):
  - Wind category: 30 words (5%)
  - Glyph core: 400 words (60%)
  - Your moment: 150 words (20%)
  - Reflection: 100 words (15%)

新分布(v4.0 最终):
  - Wind category: 30 words (5%)
  - Glyph core: 380 words (55%) ← 减少 20
  - Your moment: 100 words (15%) ← 减少 50
  - Exploration: 70 words (10%) ← 新增
  - Reflection: 100 words (15%)
```

### Glyph vs POJU 的明确区分

```
┌──────────────────┬──────────────────┬──────────────────┐
│                  │ Glyph            │ POJU             │
├──────────────────┼──────────────────┼──────────────────┤
│ 输出形式         │ 单次报告         │ 多轮对话         │
│ 时长             │ 几分钟阅读       │ 长期追踪         │
│ 价格             │ 免费 1 次 / $1.99│ $9.99            │
│ 行动维度         │ 内省练习         │ 具体可执行行动   │
│ 行动数量         │ 1 条             │ 1-3 条           │
│ 行动类型         │ Self-only        │ External / Self  │
│ 时间感           │ 今晚 / 24 小时   │ Immediate/Week/Ongoing│
│ 是否替用户决定   │ 否               │ 否               │
│ 是否追踪进展     │ 否               │ 是               │
│ 与他人互动       │ 不涉及           │ 可能涉及         │
└──────────────────┴──────────────────┴──────────────────┘

简单说:
  Glyph = "向内看"(反思 + 探索)
  POJU = "做什么"(分析 + 行动 + 追踪)

定位清晰:
  ✓ 不冲突
  ✓ 互补
  ✓ Glyph 用户可能升级到 POJU
  ✓ POJU 用户可能用 Glyph 取一个角度
```

## 4.7 [REVISE] Glyph LLM 输出 Schema

### 修订后的 Schema

```typescript
interface GlyphReport {
  wind_category_blurb: string;    // 30-50 words
  
  classical_voice: string;        // 50-80 words
  meaning_for_question: string;   // 180-280 words
  hidden_tension: string;         // 60-100 words
  
  your_moment: string;            // 80-120 words
  
  // ⭐ 新增字段
  exploration: {
    text: string;                 // 60-90 words
    timeframe: 'today' | 'tonight' | 'within_24h' | 'this_week';
    duration_estimate: string;    // "5 minutes", "10 minutes", etc.
    is_solo: boolean;             // 应该总是 true
  };
  
  reflection_question: string;    // 40-60 words
  
  metadata: {
    tone: string;
    key_insights: string[];
    language: string;
    word_count: number;
  };
}
```

### 修订后的 System Prompt(第 6 章 Glyph 部分)

```typescript
const GLYPH_SYSTEM_PROMPT_V4 = `
# YOU ARE GLYPH

You are Glyph, a single-encounter reflection tool 
within the pojulife platform.

# YOUR PURPOSE

Generate a 5-section reflection report based on:
1. The user's astrological profile (DIAGNOSIS)
2. A specific glyph drawn (GLYPH_DRAWN)
3. The user's question (USER_QUESTION)

# CORE RULES

(... 同原 Prompt 的 Core Rules,保持 ...)

# 5-SECTION OUTPUT STRUCTURE

You MUST output valid JSON with these 5 sections:

{
  "wind_category_blurb": "30-50 words",
  
  "classical_voice": "50-80 words",
  "meaning_for_question": "180-280 words",
  "hidden_tension": "60-100 words",
  
  "your_moment": "80-120 words",
  
  "exploration": {
    "text": "60-90 words describing a small internal practice",
    "timeframe": "today" | "tonight" | "within_24h" | "this_week",
    "duration_estimate": "X minutes",
    "is_solo": true
  },
  
  "reflection_question": "40-60 words single thoughtful question"
}

# ⭐ CRITICAL: EXPLORATION SECTION (NEW)

The Exploration section is unique to Glyph (NOT in POJU).

Purpose:
- Help the user explore the question further
- NOT to give them an action plan
- NOT to make a decision for them
- A small internal practice they can do alone

Format requirements:
✓ Internal practice (not external action)
✓ 5-15 minutes duration
✓ Specific instructions (not vague)
✓ Time-bound (today/tonight/within 24h)
✓ Solo activity (no other people involved)
✓ Non-deciding (doesn't push toward a conclusion)

Good examples:
"Sit with your question for 5 minutes — not to solve 
it, just to notice. What physical sensation does it 
create?"

"Write down — for yourself only — the one specific 
moment in the past month when this question started 
feeling urgent."

"Before you sleep tonight, ask yourself: if I had to 
choose by tomorrow morning, what would my gut say? 
Don't analyze the answer."

Bad examples (these are POJU territory):
✗ "Talk to your boss about this"
✗ "Make a decision by Friday"
✗ "Send an email saying..."
✗ "Schedule a meeting with..."

# WHY EXPLORATION (NOT ACTION)?

Glyph is a 60-character question + single drawn glyph.
There isn't enough context to give specific external actions.

But the user wants to "do something" after reading.

Exploration gives that "doing" feeling without:
- Pretending to know enough for specific advice
- Competing with POJU (which is for real decisions)
- Pushing the user toward a conclusion

# RELATIONSHIP TO POJU

If the user wants specific actionable guidance:
- They should use POJU ($9.99 deep conversation)
- Don't try to do POJU's job in Glyph

If the user wants reflection + small practice:
- Glyph is enough
- Stop there

In your output, you may optionally end the 
exploration with:
"If you want to go deeper into this, POJU offers a 
multi-session conversation. But first — sit with 
what this glyph showed you."

(But don't do this in every report — only when the 
question genuinely benefits from deeper exploration)

# LANGUAGE

${LANGUAGE_DIRECTIVE}
`;
```

## 4.8 Glyph 与 POJU 协作 [PRESERVE]

```
保留批次 2 原内容:
- Agent 调用其他工具
- 数据共享(user_profile)
- Profile 缓存策略

注: Exploration 章节不改变协作机制
   只是 Glyph 输出多一段内容
```

## 4.9-4.10 实现技术细节 [PRESERVE]

```
保留现有定稿:
- 抽签算法
- 抽签动画(React Three Fiber)
- 签的展示 UI
- 报告渲染样式

本补丁不涉及任何 UI/动画/卡片样式修改。
```

## 4.11 Glyph 数据结构更新 [REVISE]

### 修订后的 GlyphHistoryRecord

```typescript
interface GlyphHistoryRecord {
  id: string;
  device_id: string;
  drawn_at: Date;
  
  user_question: string;
  user_profile_snapshot: DiagnosisOutput;
  glyph_drawn: number;
  
  // ⭐ 报告结构更新为 5 段
  report: GlyphReport;  // 见上面 4.7 的 Schema
  
  language: string;
  is_paid: boolean;
  payment_id?: string;
  tokens_used: number;
}
```

---

# 第 5 章 · Syncro 修订

## 5.1 Syncro 在 v4.0 中的定位 [PRESERVE]

```
保留批次 2 原内容。
```

## 5.2 [REVISE] 浏览模式(免费)- 升级为"平放罗盘"

### 修订要点

```
原批次 2 设计:
  - 用户进入 → 直接显示 8 方位
  - 用手机自带传感器

v4.0 最终设计:
  - 用户进入 → 提示"平放手机查看"(零摩擦)
  - 不强制矫正
  - 默认相信手机自带传感器
  - 提供【可选】校准按钮(角落小图标)
  - 校准是用户主动行为,不打断默认体验
```

### 详细流程

```
[用户进入 /syncro on mobile]

Step 1: 检测设备类型
  if (desktop) {
    redirect to /syncro/desktop  // 引导页
  }

Step 2: 检测罗盘权限
  if (iOS 13+ && permission not granted) {
    show permission request UI
    "Syncro needs compass access to show 
     direction-based guidance."
    [Grant access] [Why?]
  }

Step 3: 检测 Profile
  if (no user_profile) {
    show data collection form
    (同批次 2 描述)
  }

Step 4: 进入浏览模式 UI

  ┌──────────────────────┐
  │ Syncro              │
  │ 11:42 · 午时         │
  │                      │
  │   [📱 Hold flat]    │
  │                      │
  │      [罗盘 UI]       │
  │     N                │
  │  NW    NE            │
  │ W   ●   E            │
  │  SW    SE            │
  │     S                │
  │                      │
  │ Facing N             │
  │ → "Strong focus"     │
  │                      │
  │ Next update: 1h 18m  │
  │                      │
  │ [⚙ Calibrate]       │ ← 角落小图标
  │                      │
  │ ━━━━━━━━━━━━━━━━━━  │
  │ AR Task Mode         │
  │ For specific goals.  │
  │ [Try for $1.99 →]    │
  └──────────────────────┘

Step 5: 检测手机姿态
  
  if (phone is upright || not horizontal) {
    show subtle hint at top:
    "📱 Place phone flat for accurate compass"
  }
  
  if (phone is horizontal) {
    hide hint
    use compass reading
  }

Step 6: 可选校准
  
  user taps [⚙ Calibrate]
  
  ┌──────────────────────┐
  │ Calibration          │
  │                      │
  │ Move your phone in   │
  │ a figure-8 pattern   │
  │ until calibration    │
  │ completes.           │
  │                      │
  │ [8 字图标动画]       │
  │                      │
  │ Progress: ●●●○○      │
  │                      │
  │ [Skip]               │
  └──────────────────────┘
  
  注: 这是 iOS/Android 系统自带的磁力计校准
     不是 Syncro 的命理校准
```

### 浏览模式的"零摩擦"原则

```
设计理念:
  - 99% 用户应该【无需任何配置】就能用
  - 1% 用户(感觉不准)可以主动校准
  - 不打断默认体验

具体实现:
  ✓ 没有初始引导(Onboarding skip)
  ✓ 没有强制权限请求(iOS 例外)
  ✓ 没有"先做什么"的步骤
  ✓ 直接进入 → 看到 8 方位
  ✓ 检测姿态不对 → 轻微提示(不强制)

校准只在以下情况显示:
  - 用户主动点击 [⚙ Calibrate]
  - 检测到磁场严重异常(可选,P2)
```

## 5.3 [REVISE] AR 任务模式($1.99)- 完整仪式流程

### 修订要点

```
原批次 2 设计:
  - 用户付款 → LLM 生成 40 解读 → 显示 AR

v4.0 最终设计:
  - 付款 → 平放 → 矫正 → 记录基准 → 提示竖起
  - 竖起 → 摄像头自动开 → 进入 AR 视图
  - 圆形摄像头视窗
  - 仪式感强,与免费版完全区分
```

### 完整 AR 任务流程(11 个步骤)

```
[Step 1: 任务选择]

  ┌──────────────────────────┐
  │ AR Task Mode · $1.99    │
  │                          │
  │ What are you focused on? │
  │                          │
  │ Quick select:            │
  │ [Negotiation]            │
  │ [Job interview]          │
  │ [Important decision]     │
  │ [Wealth / Money]         │
  │ [Health / Recovery]      │
  │ [Difficult conversation] │
  │ [Custom...]              │
  │                          │
  │ Or write your own:       │
  │ [Text input field]       │
  │                          │
  │ [Continue → $1.99]       │
  └──────────────────────────┘

[Step 2: 付款]

  跳转到 DodoPayments checkout
  用户填邮箱 + 支付 $1.99
  Webhook 验证
  
[Step 3: 加载]

  "Mapping the next 5 hours' 
   directional energies for your task..."
  
  调用 LLM,生成 40 个解读
  (后台进行,3-5 秒)

[Step 4: 仪式开始 - 平放手机]

  ┌──────────────────────────┐
  │                          │
  │     📱                   │
  │  [手机平放图示]          │
  │  (动画引导)              │
  │                          │
  │  Place your phone flat   │
  │  to calibrate.           │
  │                          │
  │  This grounds your       │
  │  reading in this moment, │
  │  this place.             │
  │                          │
  │  [自动检测进度]          │
  │                          │
  └──────────────────────────┘

  技术: 检测 DeviceOrientationEvent
        β (pitch) 接近 0° → 平放
        持续 1 秒稳定 → 进入下一步

[Step 5: 矫正]

  ┌──────────────────────────┐
  │                          │
  │     [罗盘动画]           │
  │                          │
  │  Calibrating...          │
  │                          │
  │  3...                    │
  │  2...                    │
  │  1...                    │
  │                          │
  └──────────────────────────┘
  
  检测稳定后,3 秒倒数
  记录当前 alpha 作为 baseline_heading

[Step 6: 校准完成]

  ┌──────────────────────────┐
  │                          │
  │       ✓                  │
  │                          │
  │  Calibration complete.   │
  │                          │
  │  Now lift your phone     │
  │  vertically to begin.    │
  │                          │
  │     📱 →                 │
  │  [手机从平到竖动画]      │
  │                          │
  └──────────────────────────┘

[Step 7: 检测姿态变化]

  技术: 持续监听 DeviceOrientationEvent
        β 从 ~0° 变化到 ~80-90° → 竖起
        持续 0.5 秒稳定 → 触发摄像头

[Step 8: 摄像头自动开启]

  请求摄像头权限(后置)
  
  if (granted) {
    proceed to AR view
  } else {
    show fallback:
    "Camera access denied. AR overlay disabled.
     Syncro still works with the compass."
    proceed to AR view (without camera background)
  }

[Step 9: AR 视图加载]

  圆形视窗淡入(500ms)
  摄像头流开始
  罗盘数据已就绪
  
[Step 10: AR 视图主界面]

  ┌────────────────────────────────────┐
  │ Negotiation Task                   │ ← 顶部任务名
  │                                    │
  │                                    │
  │         ━━━━━━━━━━━━               │
  │        ╱            ╲              │
  │       │   [摄像头   │ ← 圆形视窗
  │       │    实时画面]│   直径约 70%
  │        ╲            ╱   屏幕宽度
  │         ━━━━━━━━━━━                │
  │                                    │
  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━       │
  │                                    │
  │  Facing: NORTH                     │
  │  ⭐ Highly Favorable                │
  │                                    │
  │  "Strong alignment for asserting   │
  │   your position with clarity..."   │
  │                                    │
  │  Bonus: Also brings clarity        │
  │  for relationships                 │
  │                                    │
  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━       │
  │                                    │
  │  📍 巳时 · Window: 8h 22m left     │ ← 时辰 + 倒数
  └────────────────────────────────────┘

[Step 11: 用户转动手机]

  实时切换方位
  圆圈边缘色变(对应吉凶)
  信息卡片淡出 → 淡入(300ms)
  时辰切换时自动更新(预生成的下一时辰解读)
```

### 圆形摄像头视窗 UI 详细

```
视觉规格:

外形:
  - 完美圆形(border-radius: 50%)
  - 直径: 约 70% 屏幕宽度
  - 位置: 屏幕上方居中(约屏幕高度 30%)

边缘效果:
  - 描边: 2px solid
  - 边缘色根据当前方位吉凶变化:
    * highly_favorable: 金色 #D4AF37
    * supportive: 浅金 #E8C56F
    * neutral: 银灰 #A8A8A8
    * challenging: 暗紫 #6B5B7B
    * oppressive: 深灰 #4A4A4A
  - 颜色变化用 transition: 500ms ease-in-out

发光效果(可选):
  - highly_favorable 时: box-shadow 金色微光
  - oppressive 时: 边缘略暗,无光

摄像头流:
  - object-fit: cover
  - 用 transform: scaleX(-1) 镜像(可选,看测试)
  - 圆形 mask 裁剪

视窗外背景:
  - 深空黑 #0a0a0f
  - 微妙星光粒子(与首页 Hero 一致)
  - 不抢戏

信息卡片(视窗下方):
  - 半透明背景: rgba(20, 20, 30, 0.8)
  - 背景模糊: backdrop-filter: blur(10px)
  - 字体: 衬线字(优雅)
  - 行高: 1.6
```

### 切换方位的动画

```
方位边界(8 方位均等):
  N:   337.5° - 22.5°
  NE:  22.5°  - 67.5°
  E:   67.5°  - 112.5°
  SE:  112.5° - 157.5°
  S:   157.5° - 202.5°
  SW:  202.5° - 247.5°
  W:   247.5° - 292.5°
  NW:  292.5° - 337.5°

防抖:
  - 进入新方位需要稳定 500ms
  - 否则在边界来回 → 不切换

切换动画:
  1. 旧信息卡片淡出(150ms)
  2. 同时圆圈边缘色过渡(300ms)
  3. 新信息卡片淡入(150ms)
  
  总耗时: ~300ms(看起来很流畅)

视觉反馈:
  - 进入 highly_favorable: 圆圈边缘金色发光
  - 进入 oppressive: 圆圈边缘暗淡
  - 用户【看着画面】就感受到吉凶
```

### 任务切换的处理

```
用户在窗口期内想切换任务:

UI:
  "Want to analyze a different task?
   That's a separate analysis ($1.99).
   
   Your current task: [task description]
   Window expires in: [time]
   
   [Switch task — $1.99]
   [Keep current task]"

实现:
  - 不允许在同一窗口期内切换任务
  - 切换 = 创建新订单
  - 旧任务的解读仍然有效到窗口期结束
  - 但 UI 上只显示新任务
```

## 5.4 浏览模式 vs AR 模式对比 [PRESERVE]

```
保留批次 2 的对比表,但更新【姿态要求】这一行:

┌─────────────────────┬──────────────┬──────────────┐
│ 功能                │ 浏览模式     │ AR 模式      │
├─────────────────────┼──────────────┼──────────────┤
│ 价格                │ 免费         │ $1.99        │
│ 姿态要求            │ 平放(zero) │ 平放→竖起    │ ⭐ 新
│ 矫正流程            │ 无(可选)   │ 强制         │ ⭐ 新
│ 摄像头              │ 无           │ 圆形视窗     │ ⭐ 新
│ LLM 调用            │ 无           │ 1 次/付费     │
│ 8 方位显示          │ 是           │ 是           │
│ 评级精度            │ 中等         │ 高           │
│ 任务针对性          │ 无           │ 有           │
│ 时辰范围            │ 当前 1 个    │ 5 个         │
│ 窗口期              │ 永久(免费)  │ 9-11 小时    │
└─────────────────────┴──────────────┴──────────────┘
```

## 5.5 商业模型分析 [PRESERVE]

```
保留批次 2 原内容。
```

## 5.6 错误处理 [REVISE] 增加新场景

### 仪式流程的错误处理

```
错误场景 1: 用户跳过仪式
  
  用户付款后,跳过平放/竖起步骤
  例如直接按"Skip"或返回
  
  处理:
  - 仪式步骤都是【可跳过的】
  - 跳过 = 进入【降级版 AR 模式】
  - 没有摄像头,没有矫正
  - 但 40 个解读仍然有效
  - 用户可以手动切换方位
  
  UI:
  "AR Mode Lite (no camera)
   Tap to view each direction:
   [N] [NE] [E] [SE] [S] [SW] [W] [NW]"

错误场景 2: 摄像头权限拒绝
  
  Step 8 中,用户拒绝摄像头权限
  
  处理:
  - 不强制重新请求
  - 进入【AR 模式 - 无摄像头版】
  - 圆形视窗显示为【深空背景 + 罗盘动画】
  - 罗盘 + 信息卡片都正常工作
  - 用户体验降级,但功能完整
  
  Fallback UI:
  ┌──────────────────────────┐
  │     [星空粒子背景]       │
  │     [3D 罗盘动画]        │
  │                          │
  │      (圆圈视窗)          │
  └──────────────────────────┘

错误场景 3: 罗盘不稳定
  
  室内磁场干扰严重
  方位读数跳动
  
  处理:
  - 检测到 5 秒内方位变化 > 5 次
  - 显示提示:
    "Your compass seems unstable.
     Try moving away from electronics
     or using outdoors."
  - 继续工作,但准确度下降提示

错误场景 4: 设备不支持
  
  DeviceOrientationEvent 不存在
  (旧设备或某些浏览器)
  
  处理:
  - Step 4 之前检测
  - 显示提示:
    "Your device doesn't support compass.
     Get a refund or use Browse Mode."
  - 直接给退款选项
```

## 5.7 [REVISE] 桌面端引导页(新增章节)

### 设计理念

```
Syncro 本质上是移动端产品:
  - 需要罗盘(手机才有)
  - 需要摄像头(手机才有)
  - 需要定位(手机更精确)

桌面端用户怎么办?
  - 不是说"你不能用"(负面)
  - 是说"手机才能给你完整体验"(正面)
  - 提供清晰路径:扫码 → 手机上打开

```

### 桌面端 UI

```
访问 /syncro on desktop:

  ┌────────────────────────────────────────┐
  │ Syncro                                 │
  │                                        │
  │ See your natural rhythms.              │
  │                                        │
  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         │
  │                                        │
  │  📱 Syncro lives on your phone        │
  │                                        │
  │  Syncro is a directional compass —     │
  │  it needs a real compass and your      │
  │  position. Your phone has both.        │
  │                                        │
  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━        │
  │                                        │
  │  Open Syncro on your phone:            │
  │                                        │
  │  ┌──────────┐                          │
  │  │  [QR码]  │  Scan with your phone    │
  │  │          │  camera                  │
  │  └──────────┘                          │
  │                                        │
  │  Or send the link:                     │
  │  [Email me] [Text me] (optional)       │
  │                                        │
  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         │
  │                                        │
  │  What Syncro does                      │
  │                                        │
  │  Browse Mode (free):                   │
  │  Lay your phone flat. See 8 directions │
  │  and which work best for the moment.   │
  │                                        │
  │  [Video demo of browse mode]           │
  │                                        │
  │  AR Task Mode ($1.99):                 │
  │  Hold your phone up. Camera opens.     │
  │  See task-specific guidance for any    │
  │  direction you point to.               │
  │                                        │
  │  [Video demo of AR mode]               │
  │                                        │
  └────────────────────────────────────────┘
```

### 文案细节

```
Why phone heading (引导):

不要写:
  ❌ "Syncro doesn't work on desktop"(负面)
  ❌ "You can't use this here"(挫败感)

要写:
  ✓ "Syncro lives on your phone"(正面)
  ✓ "Your phone has the tools needed"(肯定)

为什么需要手机:
  解释【真实原因】:
  - 罗盘传感器
  - 精确定位
  - 摄像头(AR)
  
  用户理解后接受,不会觉得"产品有缺陷"
```

### QR 码实现

```typescript
import { QRCodeSVG } from 'qrcode.react';

function SyncroDesktopGuide() {
  // 生成短链接(带 UTM)
  const syncroLink = 'https://pojulife.com/syncro?ref=desktop_qr';
  
  return (
    <div>
      <QRCodeSVG
        value={syncroLink}
        size={200}
        bgColor="#ffffff"
        fgColor="#000000"
        level="M"
        includeMargin={true}
      />
    </div>
  );
}
```

### 短信/邮件发送(P1,MVP 可暂缓)

```typescript
// /api/syncro/send-link

export async function POST(req) {
  const { method, contact } = await req.json();
  
  if (method === 'email') {
    // 用 Resend 发送
    await resend.emails.send({
      from: 'hello@pojulife.com',
      to: contact,
      subject: 'Open Syncro on your phone',
      html: `Open this link on your phone: 
             https://pojulife.com/syncro`
    });
  } else if (method === 'sms') {
    // MVP 阶段可暂缓
    // 后期用 Twilio 实现
  }
  
  return NextResponse.json({ success: true });
}
```

## 5.8 [REVISE] 设备自动检测(新增章节)

### 检测逻辑

```typescript
// /lib/device-detection.ts

export function detectDevice(): {
  type: 'mobile' | 'tablet' | 'desktop';
  hasCompass: boolean;
  hasCamera: boolean;
  hasTouch: boolean;
  os: 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'unknown';
} {
  
  const ua = navigator.userAgent.toLowerCase();
  
  // OS 检测
  let os: any = 'unknown';
  if (/iphone|ipad|ipod/.test(ua)) os = 'ios';
  else if (/android/.test(ua)) os = 'android';
  else if (/win/.test(ua)) os = 'windows';
  else if (/mac/.test(ua)) os = 'mac';
  else if (/linux/.test(ua)) os = 'linux';
  
  // 设备类型检测
  const screenWidth = window.innerWidth;
  const hasTouch = 'ontouchstart' in window;
  const isMobileUA = /iphone|android|mobile/.test(ua);
  const isTabletUA = /ipad|tablet/.test(ua);
  
  let type: any;
  if (isTabletUA || (screenWidth >= 768 && screenWidth < 1024 && hasTouch)) {
    type = 'tablet';
  } else if (isMobileUA || (screenWidth < 768 && hasTouch)) {
    type = 'mobile';
  } else {
    type = 'desktop';
  }
  
  // 能力检测
  const hasCompass = 'DeviceOrientationEvent' in window;
  const hasCamera = 'mediaDevices' in navigator;
  
  return { type, hasCompass, hasCamera, hasTouch, os };
}
```

### 路由层处理

```typescript
// /app/syncro/page.tsx

export default function SyncroRouter() {
  const [device, setDevice] = useState(null);
  
  useEffect(() => {
    setDevice(detectDevice());
  }, []);
  
  if (!device) return <Loading />;
  
  if (device.type === 'desktop') {
    return <SyncroDesktopGuide />;
  }
  
  if (!device.hasCompass) {
    return <SyncroIncompatible reason="no_compass" />;
  }
  
  return <SyncroMobile />;
}
```

---

# 第 6 章 · System Prompts 修订

## 6.3 [REVISE] Glyph System Prompt(5 段输出)

```
保留批次 2 中的 Glyph Prompt 主体结构
但更新输出 Schema 为 5 段(包含 Exploration)
具体见上面 4.7 的 GLYPH_SYSTEM_PROMPT_V4

不需要重写整个 Prompt
只更新【输出格式】+ 【Exploration 章节说明】
```

## 6.1-6.2, 6.4-6.7 [PRESERVE]

```
保留批次 2 原内容:
- 6.1 Prompt 架构总览
- 6.2 POJU System Prompt (Phase 1-5)
- 6.4 Syncro AR System Prompt
- 6.5 多语言指令
- 6.6 机械拒绝词库
- 6.7 Token 管理策略
```

---

# 补丁文档总结

## 修改清单

```
【Glyph】
✓ 4.6 输出报告新结构:4 段 → 5 段
✓ 4.7 LLM 输出 Schema:增加 exploration 字段
✓ 4.11 数据结构:更新 GlyphReport
✓ 6.3 System Prompt:增加 Exploration 章节说明

【Syncro】
✓ 5.2 浏览模式:零摩擦原则 + 可选校准
✓ 5.3 AR 任务模式:11 步仪式流程
✓ 5.3 圆形摄像头视窗 UI 详细
✓ 5.3 切换方位动画
✓ 5.4 对比表:增加姿态/矫正/摄像头行
✓ 5.6 错误处理:增加仪式流程错误
✓ 5.7 桌面端引导页(新增章节)
✓ 5.8 设备自动检测(新增章节)

【保留现有】
- Glyph 所有 UI / 卡片样式 / 抽签动画 / 报告渲染
- Syncro 罗盘 UI 视觉
- 其他章节按批次 2
```

## 文档阅读顺序

```
完整阅读 v4.0 设计:

1. POJU_v4.0_Batch1.md
   序章 + 第 1-3 章
   (架构总览 + 计算引擎 + POJU Agent)

2. POJU_v4.0_Batch2.md
   第 4-6 章基础
   
3. POJU_v4.0_Batch2_Patch.md ← 本文档
   覆盖批次 2 的【修订内容】

4. POJU_v4.0_Batch3.md(待写)
   第 7-13 章 + 附录
   (数据 + API + UI + 实施 + 合规)
```
