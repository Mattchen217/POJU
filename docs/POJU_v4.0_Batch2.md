# POJU Development Document v4.0 - 批次 2

> **批次范围**: 第 4-6 章
> - 第 4 章: Glyph 重新设计
> - 第 5 章: Syncro 双模式
> - 第 6 章: System Prompt 设计
>
> **基于**: POJU_v4.0_Batch1.md(序章 + 第 1-3 章)
>
> **后续**: 批次 3(第 7-13 章 + 附录)

---

# 第 4 章 · Glyph 重新设计

## 4.1 与 v3.0.1 的差异

### v3.0.1 中的 Glyph(原 Oracle)

```
v3.0.1 设计:
  输入: 用户出生日期 + 当前问题
  处理: 直接给 LLM
  输出比例:
    - 5 风等级解读(占 70%)
    - 签文解读(占 30%)
  
  问题:
  - LLM 对命理知识有限,出生日期价值低
  - 5 风等级抢戏,签文不突出
  - 个性化不足(同等级用户感觉雷同)
```

### v4.0 中的 Glyph

```
v4.0 升级:
  输入: 用户完整命理 Profile + 抽签结果 + 当前问题
  处理:
    Step 1: 调用计算引擎(11 模块) → user_profile
    Step 2: 随机抽签(100 签之一)
    Step 3: 把 profile + 签文 + 问题 给 LLM
  
  输出比例:
    - 5 风等级标签(5% UI 元素)
    - 签文核心解读(60%)
    - 命理现代化(20%)
    - 反思引导(15%)
  
  优势:
  - LLM 拿到精确命理诊断,输出深度大幅提升
  - 签文成为核心(本应如此)
  - 个性化强(同一签对不同人不同解读)
  - 与 POJU 共享 Profile,体验连贯
```

## 4.2 Glyph 用户旅程

### 完整流程

```
用户进入 /glyph
    ↓
[免费额度检查]
检查 IndexedDB 中今日是否已用
    ├─ 未用过 → 免费使用(1 次/24 小时)
    └─ 已用过 → 显示付费墙
                  ↓
            "Today's free reading is used.
             Get one more for $1.99?"
                  ↓
              [Get one more — $1.99]
              [Come back tomorrow]
                  ↓
            付费 → DodoPayments
                  ↓
            付款成功 → 继续

[Profile 检查]
检查 IndexedDB 中 user_profile
    ├─ 已有 → 复用
    └─ 没有 → 显示数据收集表单
              ↓
        用户填写 6 项硬性数据
              ↓
        调用计算引擎(11 模块)
              ↓
        生成 user_profile
              ↓
        缓存到 IndexedDB

[问题输入]
显示提示:
  "Hold a question. Compress it to 60 characters or less."
  
用户输入(限 60 字符)
    ↓
[抽签动画]
3D 粒子球展示 + 抽取动画
随机选 1-100 签 = 这次的签
    ↓
[LLM 调用]
组装输入:
  - System Prompt (Glyph)
  - user_profile.diagnosis
  - 抽到的签文(标号 + 原文 + 古典解释)
  - 用户问题
    ↓
单次调用 Claude Sonnet
    ↓
[显示报告]
展示完整报告(滚动浏览)
    ↓
[结束选项]
- Save to Archive(自动)
- Download as PDF(可选,需邮箱)
- Share(无法分享,设计上禁止)
```

## 4.3 Glyph 数据流(详细)

```
┌──────────────────────────────────────┐
│ 用户进入 /glyph                      │
└────────────┬─────────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 检查每日免费额度                     │
│ key: glyph_last_free_use_${device}   │
│ 比较: 当前日期 vs 上次免费日期       │
└────────────┬─────────────────────────┘
             ↓
       ┌─────┴─────┐
       ↓           ↓
   ┌───────┐   ┌───────┐
   │ 已用  │   │ 未用  │
   │ ↓     │   │ ↓     │
   │ 付费  │   │ 免费  │
   └───┬───┘   └───┬───┘
       │           │
       └─────┬─────┘
             ↓
┌──────────────────────────────────────┐
│ 检查 user_profile                    │
└────────────┬─────────────────────────┘
             ↓
       ┌─────┴─────┐
       ↓           ↓
   ┌───────┐   ┌─────────┐
   │ 已有  │   │ 没有    │
   │ 复用  │   │ 收集 6  │
   │       │   │ 项数据  │
   │       │   │ ↓       │
   │       │   │ 计算    │
   │       │   │ Profile │
   └───┬───┘   └────┬────┘
       │            │
       └─────┬──────┘
             ↓
┌──────────────────────────────────────┐
│ 用户输入 60 字符问题                 │
└────────────┬─────────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 随机抽签(从 100 签中)                │
│ 真随机 + 时间戳种子                  │
└────────────┬─────────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 抽签动画(2-3 秒)                     │
│ React Three Fiber + 粒子效果         │
└────────────┬─────────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 组装 LLM 输入                        │
│ - System Prompt (Glyph)              │
│ - user_profile.diagnosis             │
│ - signs.json[抽到的签]                │
│ - 用户问题                           │
└────────────┬─────────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 调用 Claude Sonnet                   │
│ Token: ~2000 input + ~1000 output   │
└────────────┬─────────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 解析结构化输出 + 渲染                │
└────────────┬─────────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 展示给用户 + 自动存到 Archive        │
└──────────────────────────────────────┘
```

## 4.4 5 风等级 + 100 签关系

### 5 风等级(UI 分类层)

```
5 风等级仅用于 UI 视觉分类,不是核心内容:

┌─────────────────────────────────────────────────────┐
│ 1. Divine Tailwind (神助风)                         │
│    Color: 暖金 #D4AF37                              │
│    Symbol: ⭐                                       │
│    含义: 完全对齐的稀有恩典                         │
│    出现频率: ~10% 的签                              │
│                                                     │
│ 2. Fair Sky (晴空风)                                │
│    Color: 浅蓝 #87CEEB                              │
│    Symbol: ☀                                        │
│    含义: 通畅的路径,温和支持                       │
│    出现频率: ~25% 的签                              │
│                                                     │
│ 3. Still Water (静水)                               │
│    Color: 灰蓝 #708090                              │
│    Symbol: ☯                                        │
│    含义: 耐心和静止的时候                           │
│    出现频率: ~30% 的签                              │
│                                                     │
│ 4. Crosswind (逆风)                                 │
│    Color: 深紫 #483D8B                              │
│    Symbol: ⚡                                       │
│    含义: 竞争力量在拉扯                             │
│    出现频率: ~25% 的签                              │
│                                                     │
│ 5. Eye of Storm (风眼)                              │
│    Color: 黑灰 #2F2F2F                              │
│    Symbol: ◉                                        │
│    含义: 极端中的深度静止                           │
│    出现频率: ~10% 的签                              │
└─────────────────────────────────────────────────────┘
```

### 100 签到 5 风的映射

```
每签都属于某一风:

例如:
  签 1 - 第 17 卦"随",初九:Fair Sky
  签 23 - 第 51 卦"震",上六:Crosswind
  签 47 - 第 11 卦"泰",九三:Divine Tailwind
  签 88 - 第 29 卦"坎",九五:Eye of Storm
  ...

数据格式(signs.json):

{
  "1": {
    "id": 1,
    "name": "Following the Flow",
    "hexagram": "随",
    "line": "初九",
    "wind_category": "fair_sky",
    "classical_text": "...原文...",
    "modern_translation": "...现代翻译...",
    "key_themes": ["adaptation", "alignment", ...],
    "applicable_questions": ["career", "relationship", ...]
  },
  ...
}
```

### UI 中的 5 风显示

```
报告页面顶部:

┌────────────────────────────────────────┐
│  ☀ FAIR SKY                            │
│                                        │
│  Glyph #17: Following the Flow         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
└────────────────────────────────────────┘

5 风等级 = 视觉标识 + 简短分类
不再占据 70% 内容
```

## 4.5 Glyph 输出报告新结构

### 完整报告结构(600-800 词)

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

## Section 2: Your Glyph (60%)

### The Classical Voice
Brief reference to the classical context (50-80 words).

Example:
"This glyph descends from the principle of 'following 
that which leads' — a wisdom about strategic adaptation. 
The original observation: when leadership requires 
followership first, those who refuse to follow cannot 
later lead."

### What It Means for Your Question
Deep interpretation (200-300 words) — the core 60%.

Example:
"For your specific question — [user's question] — 
this glyph speaks to a tension you may not have named:
the difference between leading and originating.

You're someone whose strength is implementation 
[from user_profile.identity], and this current period 
favors structure [from user_profile.current_phase].
The opportunity in front of you may feel like it 
requires you to lead immediately. But the glyph 
suggests something different.

The right move now is to follow strategically — to 
position yourself in alignment with what's already 
moving, rather than to push your own direction. 
This isn't passivity. It's the recognition that 
this particular role wants you to demonstrate 
followership before granting authority.

There's a hidden tension here: your nature wants 
to lead, but this moment rewards those who 
patiently align first. The mistake would be to 
bypass this and try to lead from day one."

### The Hidden Tension
What the user might miss (80-120 words).

Example:
"Watch for the trap of confusing 'following' with 
'submission'. The glyph isn't asking you to defer to 
others' wishes — it's asking you to align with what 
the situation itself is trying to do. Your discernment 
matters: follow the truth of the situation, not 
necessarily the personalities."

---

## Section 3: Your Moment (20%)

Brief modern interpretation tying glyph to user's 
current temporal energy (100-150 words).

Example:
"You're in a 6th-year da yun phase that supports 
growth through structure [from user_profile.temporal_layer].
The current month carries themes of recovery and 
quiet observation [from current_phase.month_focus].

Together, this is a moment to be patient. The opportunity 
is real, but it wants to be earned through demonstrated 
capacity, not seized through declaration. The next 30 
days are particularly suited for this kind of 
strategic alignment."

---

## Section 4: A Reflection (15%)

A single thoughtful question, not a directive (40-60 words).

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

### 输出长度对比

```
v3.0.1 输出:
  Total: ~600 words
  - 5 风等级: 70% (~420 words)
  - 签文: 30% (~180 words)
  
v4.0 输出:
  Total: 600-800 words
  - 5 风(标识): 5% (~30 words)
  - 签文核心: 60% (~400 words)
  - 命理现代化: 20% (~150 words)
  - 反思: 15% (~100 words)
```

## 4.6 LLM 输入格式

### Glyph System Prompt 结构

```typescript
const GLYPH_SYSTEM_PROMPT = `
# YOU ARE GLYPH

You are Glyph, a single-encounter reflection tool within the pojulife platform.

# YOUR ROLE

Generate a structured reflection report based on:
1. The user's astrological profile (provided as DIAGNOSIS)
2. A specific glyph drawn (provided as GLYPH_DRAWN)
3. The user's question (provided as USER_QUESTION)

You do NOT:
- Predict the future
- Tell the user what to do
- Reveal underlying technical terms (bazi, gua, yin-yang, etc.)
- Provide medical, legal, or financial advice

You DO:
- Reveal what the glyph is asking the user to see
- Connect the glyph's wisdom to the user's specific moment
- Offer perspectives, not directives
- End with reflection, not action

# OUTPUT STRUCTURE

You must output valid JSON in this exact structure:

{
  "wind_category_blurb": "A 30-50 word introduction tying wind category to the glyph context",
  
  "classical_voice": "50-80 words on the classical wisdom origin (no technical terms)",
  
  "meaning_for_question": "200-300 words deep interpretation, integrating user's profile and question",
  
  "hidden_tension": "80-120 words on what the user might miss",
  
  "your_moment": "100-150 words connecting glyph to user's current temporal energy",
  
  "reflection_question": "A single thoughtful question (40-60 words), no directives",
  
  "metadata": {
    "tone": "the emotional register of this report",
    "key_insights": ["3-5 bullet points of core insights"],
    "language": "the language of output"
  }
}

# QUALITY REQUIREMENTS

1. Specific over generic
   ❌ "This is a time of change"
   ✓ "For your specific question about [topic], the glyph suggests..."

2. Integrate the profile
   The user's profile contains specific patterns. Use them.
   Don't write a report that would be the same for any user.

3. Use modern language
   The user provided birth info, but you must NEVER mention:
   - Bazi, eight characters, day master
   - Hexagrams (use "glyph" instead)
   - Five elements (translate to modern emotional/structural concepts)
   - Yin-Yang (translate to "tension between X and Y")
   
4. Honor the wind category
   - Divine Tailwind: rare; speak with sense of grace
   - Fair Sky: supportive; speak with quiet encouragement
   - Still Water: patient; speak with stillness
   - Crosswind: difficult; speak with honesty
   - Eye of Storm: paradoxical; speak with depth

5. Tone calibration
   Use the user's emotional state (if hinted in profile) to calibrate:
   - Anxious user → grounded, calm tone
   - Stuck user → fresh angle, gentle prod
   - Hopeful user → tempered with realism

# THE READING IS NOT A PRESCRIPTION

End every report with the implicit message:
"This is one perspective. The decision is yours."

The reflection_question should NOT be answerable as 
yes/no — it should open further thought.

# LANGUAGE

Output in the language specified in the LANGUAGE_DIRECTIVE.
Never mix languages within a single report.
`;
```

### 给 Glyph 的 Prompt Payload

```typescript
const glyphPayload = {
  system: GLYPH_SYSTEM_PROMPT + LANGUAGE_DIRECTIVE,
  
  user: `
DIAGNOSIS:
${JSON.stringify(user_profile.diagnosis, null, 2)}

GLYPH_DRAWN:
{
  "id": 17,
  "name": "Following the Flow",
  "wind_category": "fair_sky",
  "classical_text": "${classical_text}",
  "modern_translation": "${modern_translation}",
  "key_themes": ["adaptation", "alignment", "strategic_followership"]
}

USER_QUESTION:
"${user_question}"

LANGUAGE_DIRECTIVE:
Output in: ${language}
Tone: warm but direct, slightly literary

Generate the structured report per the schema above.
`
};
```

## 4.7 每日免费机制实现

### 客户端跟踪

```typescript
// IndexedDB 中的 Glyph 使用记录
interface GlyphUsageRecord {
  device_id: string;
  daily_logs: {
    [date: string]: {  // 'YYYY-MM-DD'
      free_used: boolean;
      paid_count: number;
      timestamps: string[];
    }
  };
}

// 检查今日免费额度
async function canUseGlyphFree(): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const usage = await db.glyph_usage.get(deviceId);
  
  if (!usage || !usage.daily_logs[today]) {
    return true;  // 今天还没用
  }
  
  return !usage.daily_logs[today].free_used;
}

// 记录免费使用
async function recordFreeUse() {
  const today = new Date().toISOString().split('T')[0];
  await db.glyph_usage.update(deviceId, {
    [`daily_logs.${today}.free_used`]: true,
    [`daily_logs.${today}.timestamps`]: 
      append(new Date().toISOString())
  });
}

// 记录付费使用
async function recordPaidUse(paymentId: string) {
  const today = new Date().toISOString().split('T')[0];
  await db.glyph_usage.update(deviceId, {
    [`daily_logs.${today}.paid_count`]: increment(),
    [`daily_logs.${today}.timestamps`]: 
      append(new Date().toISOString())
  });
}
```

### 用户体验流程

```
进入 /glyph 流程:

[Step 1: 检查额度]
访问 /glyph
    ↓
读取 IndexedDB.glyph_usage
    ↓
今日 free_used?
    ├─ false (还能免费) → 显示主界面
    │   "Welcome to Glyph. Today's reading is free."
    │
    └─ true (已用免费)
        ↓
        显示付费墙:
        "Today's free reading is already used.
         
         You can:
         [Get another reading — $1.99]
         [Come back tomorrow for free]
         
         Why this limit?
         Glyph is designed for slow reflection.
         One per day prevents reactive reading."

[Step 2: 付费流程(如选择)]
点 "Get another reading — $1.99"
    ↓
跳转到 DodoPayments checkout
    ↓
用户填邮箱(支付必需) + 支付
    ↓
Webhook 验证
    ↓
返回 /glyph?paid=true&payment_id=xxx
    ↓
记录付费使用 → 进入主界面

[Step 3: 主界面后续]
(同 4.2 中的流程)
```

### 防薅羊毛策略

```
机制 1: 设备指纹绑定
  - 不只是 IndexedDB(易清除)
  - 还用 FingerprintJS 设备指纹
  - 同一设备清浏览器后,服务器端比对
  
  服务器存储:
  device_fingerprint_hash → last_free_use_date
  
  即使用户清缓存,免费额度仍受限

机制 2: 服务器端验证
  - 每次免费使用时,前端发请求到 /api/glyph/check_quota
  - 服务器验证 device_fingerprint + IP
  - 异常情况(频繁切换 IP)→ 限流

机制 3: 不依赖账号
  - 即使没账号也能防止滥用
  - 设备指纹 + IP + 浏览器特征综合判断

机制 4: 容忍真实用户
  - 多设备用户(家里 + 公司)→ 各设备各算
  - 这是合理需求,不打击
  - 真正薅羊毛的是同设备清缓存

机制 5: 付费用户优先
  - 付费用户在客服支持队列中优先
  - 免费滥用者反馈优先级低
```

## 4.8 Glyph 与 POJU 的协作

### Glyph 在 POJU 中的引用

```
POJU Phase 3 中,LLM 可能建议:
  "This question has many angles. Sometimes a 
   fresh perspective helps. You could try Glyph 
   right now (free for your first daily use)."

实现:
  1. POJU LLM 输出 suggest_glyph: true
  2. POJU 界面在回复中加入按钮:
     [Try Glyph for a fresh angle →]
  3. 点击 → 新标签打开 /glyph?from_poju=true&session_id=xxx
  4. Glyph 用相同 device_id → 复用 user_profile
  5. Glyph 完成后 → 提示返回 POJU
     "Continue your POJU session with this insight?"
```

### 共享 user_profile 的注意事项

```
Glyph 和 POJU 共享 user_profile:

✓ 同一 device_id → 同一 profile
✓ 用户在 POJU 创建 profile → Glyph 直接用
✓ 用户在 Glyph 创建 profile → POJU 直接用

但要注意:
  - Glyph 不修改 profile(只读)
  - POJU 也不修改 profile(只读)
  - 用户主动更新生日 → 重新计算 profile
  - 跨年(立春)→ 部分模块刷新

Profile 缓存 TTL:
  - 6 个月(自动刷新)
  - 用户切换语言 → 不影响(profile 是数据,不是文本)
  - 时间敏感部分(流年/流月)→ 每次使用时单独计算
```

## 4.9 Glyph 实现技术细节

### 抽签算法

```typescript
import { randomBytes } from 'crypto';

function drawGlyph(): number {
  // 真随机抽签(1-100)
  // 不是基于命理或时间的"伪随机"
  // 因为签的本质就是随机性
  
  const buffer = randomBytes(4);
  const random = buffer.readUInt32BE(0) / 0xFFFFFFFF;
  return Math.floor(random * 100) + 1;
}

// 加权抽签(MVP 后期可考虑)
function drawGlyphWeighted(profile: UserProfile): number {
  // 某些命理状态可能让某些签更"出现"
  // 但这违反"真随机"的设计哲学
  // 不推荐
}
```

### 抽签动画(React Three Fiber)

```
动画时长: 2.5 秒
阶段:
  0-0.5s: 粒子球收缩(用户问题被"吸入")
  0.5-1.5s: 粒子流动 + 旋转
  1.5-2.0s: 一颗粒子被"选中"(发光)
  2.0-2.5s: 选中的粒子展开为签牌

视觉风格:
  - 深空黑背景
  - 紫色/金色粒子(对应 5 风类别)
  - 神秘感但不夸张
```

### 签的展示

```
签牌 UI:
  ┌──────────────────────────────────┐
  │                                  │
  │           ☀                      │
  │                                  │
  │     ━━━━━━━━━━━━━━━━━            │
  │     Glyph #17                    │
  │     "Following the Flow"         │
  │     ━━━━━━━━━━━━━━━━━            │
  │                                  │
  │     Fair Sky                     │
  │                                  │
  │     [Read your reflection ↓]    │
  │                                  │
  └──────────────────────────────────┘

点击展开 → 滚动显示完整报告
```

### 报告渲染

```
报告页面布局:

  ┌──────────────────────────────────────┐
  │ [Glyph 标识区] (固定)                │
  │ ☀ Fair Sky                           │
  │ Glyph #17: Following the Flow        │
  ├──────────────────────────────────────┤
  │ [Section 1: Your Pattern]            │
  │ (5 风等级简介)                       │
  ├──────────────────────────────────────┤
  │ [Section 2: Your Glyph]              │
  │ - The Classical Voice                │
  │ - What It Means for Your Question    │
  │ - The Hidden Tension                 │
  ├──────────────────────────────────────┤
  │ [Section 3: Your Moment]             │
  │ (命理现代化)                         │
  ├──────────────────────────────────────┤
  │ [Section 4: A Reflection]            │
  │ (反思问题)                           │
  ├──────────────────────────────────────┤
  │ [底部操作]                           │
  │ [Save] [Download PDF] [Close]        │
  └──────────────────────────────────────┘

样式要点:
  - 字体衬线(更适合冥想阅读)
  - 行高 1.8(舒适阅读)
  - 段落间距大(给思考空间)
  - 没有"分享"按钮(私密性)
```

## 4.10 Glyph 数据结构

### IndexedDB 中的 Glyph 历史

```typescript
// glyph_history 表
interface GlyphHistoryRecord {
  id: string;                      // UUID
  device_id: string;
  drawn_at: Date;
  
  // 输入
  user_question: string;
  user_profile_snapshot: DiagnosisOutput;  // 当时的 profile 快照
  glyph_drawn: number;
  
  // 输出
  report: GlyphReport;
  
  // 元信息
  language: string;
  is_paid: boolean;
  payment_id?: string;
  tokens_used: number;
}

interface GlyphReport {
  wind_category_blurb: string;
  classical_voice: string;
  meaning_for_question: string;
  hidden_tension: string;
  your_moment: string;
  reflection_question: string;
  metadata: {
    tone: string;
    key_insights: string[];
    language: string;
  };
}
```

### Archive 页面中的 Glyph 历史

```
用户在 /archive 可以看到:

  ┌─────────────────────────────────────┐
  │ Your Glyphs                         │
  ├─────────────────────────────────────┤
  │ ☀ Glyph #17 · Following the Flow    │
  │ "Should I take this offer?"         │
  │ October 15, 2025 · 3:42 PM          │
  │ [Read again →]                      │
  ├─────────────────────────────────────┤
  │ ⚡ Glyph #51 · Crosswind             │
  │ "Why does this keep happening?"     │
  │ October 12, 2025 · 11:08 AM         │
  │ [Read again →]                      │
  └─────────────────────────────────────┘

每条记录:
  - 可点击重读
  - 可删除
  - 可下载 PDF(需邮箱)
```

---

# 第 5 章 · Syncro 双模式

## 5.1 Syncro 在 v4.0 中的定位

```
v3.0.1 Syncro:
  - 单一模式: 浏览 8 方位
  - 简单方位提示
  - 不需要付费
  
v4.0 Syncro:
  - 双模式架构
  - 浏览模式: 免费,本机计算
  - AR 任务模式: $1.99,LLM 增强
  
战略意义:
  - 浏览模式 = 用户日常陪伴 + 引流
  - AR 任务模式 = 高频微付费 + 商业模型
  - 浏览免费让用户养成习惯
  - AR 收费让重度用户付费
```

## 5.2 浏览模式(免费)

### 功能定义

```
入口: /syncro
价格: 免费
LLM 调用: 无(本机计算)
更新频率: 每个时辰自动刷新(2 小时)

显示内容:
  - 当前时辰名称(如 "午时 11:00-13:00")
  - 8 方位罗盘
  - 每个方位的评级(5 级)
  - 用户当前对着的方位高亮
  - 一句简短建议(每方位)

数据:
  仅来自计算引擎(模块 6 + 简化模块 4)
  不调用 LLM
  
所以是真正的免费(无成本)
```

### 浏览模式 UI

```
桌面端:
  ┌─────────────────────────────────────────┐
  │ Syncro                                  │
  │ 11:42 · 午时 (11:00-13:00)              │
  │                                         │
  │           N                             │
  │      Highly Favorable ⭐                │
  │                                         │
  │  NW                  NE                 │
  │  Supportive          Neutral            │
  │                                         │
  │  W ←──── [Compass] ────→ E              │
  │  Challenging         Highly Favorable   │
  │                                         │
  │  SW                  SE                 │
  │  Neutral             Oppressive         │
  │                                         │
  │           S                             │
  │      Supportive ⭐                      │
  │                                         │
  │  Currently facing: NORTH                │
  │  → "Strong alignment for focused work"  │
  │                                         │
  │  Updates in: 1h 18m                     │
  │                                         │
  │  [Try AR Task Mode — $1.99]             │
  └─────────────────────────────────────────┘

移动端(主要):
  ┌──────────────────────┐
  │ Syncro              │
  │ 11:42 · 午时         │
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
  │ [Tap N for details]  │
  │                      │
  │ Next update: 1h 18m  │
  │                      │
  │ ━━━━━━━━━━━━━━━━━━  │
  │ AR Task Mode         │
  │ Set a goal, see      │
  │ direction guidance   │
  │ for it.              │
  │                      │
  │ [Try for $1.99 →]    │
  └──────────────────────┘
```

### 浏览模式实现

```typescript
// /api/syncro/browse 路由

import { calculateProfile } from '@/lib/calculations';

export async function GET(req: Request) {
  const { device_id, current_time, location, facing } = parseQuery(req);
  
  // 获取或计算 user profile
  let profile = await getCachedProfile(device_id);
  if (!profile) {
    return NextResponse.json({
      error: 'profile_required',
      message: 'Please provide birth information first'
    }, { status: 400 });
  }
  
  // 计算 8 方位评级(本机)
  const directions = await calculateDirections({
    yong_shen: profile.yong_shen,
    current_time,
    current_location: location,
    device_orientation: facing,
    // 浏览模式: 不传 task
  });
  
  return NextResponse.json({
    current_hour: directions.current_hour,
    ratings: directions.ratings,
    current_facing: directions.current_facing,
    valid_until: directions.validity.valid_until,
  });
}
```

```typescript
// 前端轮询逻辑

useEffect(() => {
  // 立即获取一次
  fetchSyncroData();
  
  // 每分钟检查是否需要更新
  const interval = setInterval(() => {
    const now = new Date();
    const validUntil = new Date(syncroData.valid_until);
    
    if (now >= validUntil) {
      fetchSyncroData();  // 时辰切换,刷新
    }
  }, 60 * 1000);
  
  return () => clearInterval(interval);
}, []);
```

### 浏览模式的精度

```
精度等级: 中等
原因:
  - 仅基础五行 + 用神 + 时辰
  - 不考虑刑冲合害
  - 不考虑神煞
  - 不考虑大运变化

适用场景:
  - 日常一瞥
  - 大致方位选择
  - 引流用户

不适用:
  - 重大决策(用 POJU)
  - 关键任务(用 AR 模式)
```

## 5.3 AR 任务模式($1.99)

### 功能定义

```
入口: /syncro 中点击 "Try AR Task Mode"
价格: $1.99 单次
LLM 调用: 1 次(一次性生成 5 时辰 × 8 方位 = 40 个解读)
有效期: 9-11 小时(5 个完整时辰)

流程:
1. 用户输入要做的事(预设 + 自定义)
2. 付款 $1.99
3. 调用 LLM 生成 40 个解读
4. 缓存到客户端
5. 用户开启摄像头(可选)
6. 摄像头方位变化 → 显示对应解读
7. 时辰切换 → 自动显示当前时辰的方位
8. 5 时辰窗口期结束 → 提示重新付费
```

### AR 模式 UI 流程

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

  跳转到 DodoPayments
  → 付款成功

[Step 3: 加载]

  生成中...
  "POJU is mapping the next 5 hours' 
   directional energies for your task..."
  
  (LLM 调用,~3-5 秒)

[Step 4: AR 界面]

  ┌──────────────────────────┐
  │ [摄像头视图,可选]         │
  │                          │
  │     [罗盘 overlay]        │
  │     ↑ N                  │
  │   ↗ NE                   │
  │ ← W      → E             │
  │   ↘ SE                   │
  │     ↓ S                  │
  │                          │
  │ Facing: NORTH            │
  │ ⭐ Highly Favorable       │
  │                          │
  │ For your task:           │
  │ "This direction supports │
  │  proactive moves and     │
  │  steady focus"           │
  │                          │
  │ Bonus: This direction    │
  │ also brings clarity for  │
  │ relationship matters     │
  │                          │
  │ [Tap to see all 8]       │
  │                          │
  │ Window: 8h 22m left      │
  └──────────────────────────┘
```

### 5 时辰窗口的实现

```
窗口期定义:
  起始: 用户付款时刻所在的时辰
  长度: 当前时辰 + 后 4 个完整时辰
  共 5 个时辰
  
例 1: 用户 10:50 (巳时) 付款
  巳时 (09:00-11:00) ← 当前
  午时 (11:00-13:00)
  未时 (13:00-15:00)
  申时 (15:00-17:00)
  酉时 (17:00-19:00) ← 第 5 个,结束
  实际享用 8 小时 10 分钟

例 2: 用户 19:50 (戌时) 付款
  戌时 (19:00-21:00) ← 当前
  亥时 (21:00-23:00)
  ⚠️ 接下来跨日:子时
  
  MVP 决策:
  - 不跨日,只到当日 23:00
  - 只享用 3 小时 10 分钟
  - 用户体验差,但简化逻辑

  优化方案(后期):
  - 跨日时,使用次日的命理 base
  - 实现复杂,P2 优先级
```

### LLM 一次性生成 40 个解读

```typescript
// /api/syncro/task 路由

export async function POST(req: Request) {
  const { 
    device_id, 
    task, 
    payment_id, 
    current_time 
  } = await req.json();
  
  // 验证支付
  const payment = await verifyPayment(payment_id);
  if (!payment.valid) {
    return NextResponse.json({ error: 'payment_invalid' }, { status: 402 });
  }
  
  // 获取 user profile
  const profile = await getCachedProfile(device_id);
  
  // 计算 5 时辰窗口
  const windows = calculateFiveHourWindows(current_time);
  // [
  //   { branch: "巳", start: ..., end: ... },
  //   { branch: "午", start: ..., end: ... },
  //   ... 5 个窗口
  // ]
  
  // 对每个时辰计算 8 方位评级(本机)
  const allRatings = [];
  for (const window of windows) {
    const directions = await calculateDirections({
      yong_shen: profile.yong_shen,
      current_time: window.start,
      task,
    });
    allRatings.push({
      window,
      ratings: directions.ratings,
    });
  }
  
  // 一次性给 LLM 生成 40 个解读
  const llmInput = buildSyncroLLMInput({
    profile,
    task,
    allRatings,  // 5 时辰 × 8 方位 = 40 个
  });
  
  const llmResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 6000,  // 大输出
    system: SYNCRO_AR_SYSTEM_PROMPT + LANGUAGE_DIRECTIVE,
    messages: [{ role: 'user', content: llmInput }],
  });
  
  const interpretations = parseStructuredOutput(llmResponse);
  // {
  //   "巳时": { "N": "...", "NE": "...", "E": "...", ... },
  //   "午时": { "N": "...", ... },
  //   ... 5 个时辰
  // }
  
  // 缓存到客户端(返回完整数据)
  return NextResponse.json({
    task,
    valid_until: windows[windows.length - 1].end,
    interpretations,
    bonus_info: parsed.bonus_info,  // 额外的"桃花"等信息
  });
}
```

### Syncro AR System Prompt

```typescript
const SYNCRO_AR_SYSTEM_PROMPT = `
# YOU ARE SYNCRO AR

You are Syncro AR mode within the pojulife platform.

# YOUR ROLE

Generate directional guidance for a specific task across 
5 time windows (each ~2 hours).

# INPUT YOU RECEIVE

- USER_PROFILE: The user's astrological diagnosis
- TASK: What the user wants to do
- TIME_WINDOWS: 5 time periods with their basic 8-direction ratings

# OUTPUT STRUCTURE

You must output valid JSON:

{
  "task_summary": "Brief summary of how the task aligns with user's profile",
  
  "interpretations": {
    "[chinese_hour_name]": {
      "N": "30-50 word interpretation for this direction & this hour",
      "NE": "...",
      "E": "...",
      "SE": "...",
      "S": "...",
      "SW": "...",
      "W": "...",
      "NW": "..."
    },
    // ... 5 hours total = 40 interpretations
  },
  
  "best_overall": {
    "hour": "the most favorable hour",
    "direction": "the most favorable direction",
    "reason": "why"
  },
  
  "avoid_overall": {
    "hour": "the least favorable hour",
    "direction": "the least favorable direction",
    "reason": "why"
  },
  
  "bonus_directions": [
    {
      "direction": "NE",
      "alternate_use": "While not ideal for [task], this direction supports [other purpose]"
    },
    // 2-3 such alternates
  ]
}

# QUALITY REQUIREMENTS

1. Each interpretation must be specific to:
   - The task
   - The hour's energy
   - The direction's basic element
   - The user's pattern from profile

2. Use modern language, never:
   - "Wood element"
   - "Water energy"
   - "Yin/Yang"
   - "Bazi", "gua", etc.
   
   Translate to:
   - "Steady focus"
   - "Flowing communication"
   - "Tension between rest and action"

3. Brevity is key (mobile UI):
   - 30-50 words per interpretation
   - Not 200 words

4. Tone:
   - Practical, actionable
   - Not mystical
   - Not preachy

# LANGUAGE

Output in: ${language}
`;
```

### AR 显示实现

```typescript
// 前端 AR 组件

function ARTaskMode({ data }) {
  const [currentHour, setCurrentHour] = useState(...);
  const [facing, setFacing] = useState('N');
  const [cameraEnabled, setCameraEnabled] = useState(false);
  
  // 监听罗盘
  useEffect(() => {
    if (!('DeviceOrientationEvent' in window)) {
      // 不支持,降级为静态罗盘
      return;
    }
    
    // iOS 13+ 需要请求权限
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(state => {
        if (state === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
        }
      });
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);
  
  const handleOrientation = (event) => {
    const heading = event.alpha;  // 0-360 度
    const newFacing = headingToDirection(heading);
    if (newFacing !== facing) {
      setFacing(newFacing);
    }
  };
  
  // 监听时辰切换
  useEffect(() => {
    const checkHourChange = () => {
      const newHour = getCurrentHour();
      if (newHour !== currentHour) {
        setCurrentHour(newHour);
      }
    };
    
    const interval = setInterval(checkHourChange, 60 * 1000);
    return () => clearInterval(interval);
  }, [currentHour]);
  
  // 显示当前方位 + 时辰的解读
  const currentInterpretation = data.interpretations[currentHour]?.[facing];
  const currentRating = data.basic_ratings[currentHour]?.[facing];
  
  return (
    <div className="ar-container">
      {cameraEnabled && <CameraStream />}
      
      <div className="compass-overlay">
        <Compass facing={facing} ratings={data.basic_ratings[currentHour]} />
      </div>
      
      <div className="info-card">
        <div className="hour-indicator">{currentHour}</div>
        <div className="facing-indicator">Facing: {facing}</div>
        <div className="rating">{currentRating}</div>
        <div className="interpretation">{currentInterpretation}</div>
        
        {data.bonus_directions
          .filter(b => b.direction === facing)
          .map(b => (
            <div className="bonus-info">
              {b.alternate_use}
            </div>
          ))
        }
      </div>
      
      <ValidityCountdown validUntil={data.valid_until} />
    </div>
  );
}
```

### 摄像头权限处理

```typescript
async function requestCameraAccess(): Promise<MediaStream | null> {
  try {
    // 请求后置摄像头(AR 体验更好)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: 'environment',  // 后置
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    return stream;
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      // 用户拒绝
      showFallbackUI('camera_denied');
    } else if (error.name === 'NotFoundError') {
      // 没有摄像头
      showFallbackUI('no_camera');
    }
    return null;
  }
}

function showFallbackUI(reason: string) {
  // 即使没有摄像头,AR 模式仍然有效
  // 只是少了"摄像头叠加"的视觉效果
  // 罗盘 + 解读 仍然完整
  
  return (
    <div className="fallback-ar">
      <p>
        Camera access {reason === 'denied' ? 'denied' : 'unavailable'}.
        AR overlay is disabled, but Syncro guidance still works
        with the compass.
      </p>
      <Compass /> {/* 静态罗盘,无摄像头叠加 */}
    </div>
  );
}
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
  - 用户可在两者间切换查看(已生成的)
```

## 5.4 浏览模式 vs AR 模式对比

```
功能对比表:

┌─────────────────────┬──────────────┬──────────────┐
│ 功能                │ 浏览模式     │ AR 模式      │
├─────────────────────┼──────────────┼──────────────┤
│ 价格                │ 免费         │ $1.99        │
│ LLM 调用            │ 无           │ 1 次/付费     │
│ 8 方位显示          │ 是           │ 是           │
│ 评级精度            │ 中等         │ 高           │
│ 任务针对性          │ 无           │ 有           │
│ 时辰范围            │ 当前 1 个    │ 5 个         │
│ 摄像头叠加          │ 无           │ 可选         │
│ 罗盘                │ 是           │ 是           │
│ 替代用途提示        │ 无           │ 有           │
│ 时辰自动切换        │ 是(刷新)    │ 是(预生成)  │
│ 窗口期              │ 永久(免费)  │ 9-11 小时    │
│ 复购周期            │ N/A          │ 8-12 小时    │
└─────────────────────┴──────────────┴──────────────┘
```

## 5.5 商业模型分析

### 浏览模式作为引流

```
浏览模式价值:
  - 0 边际成本(纯本机计算)
  - 用户每天回访
  - 习惯养成
  - 看到 AR 入口

转化漏斗:
  100 浏览用户
    ↓
  20 用户尝试 AR (20%)
    ↓
  15 用户付费成功 (75%)
  
单 AR 用户 LTV:
  假设每月 4 次付费 = $7.96/月
  6 个月留存 = ~$48
  毛利率 97% = ~$46.5

100 浏览用户带来:
  15 × $7.96/月 = $119/月
  
浏览模式成本: 0
所以 ROI 极高
```

### AR 模式定价合理性

```
$1.99 价格分析:

成本侧:
  LLM 单次成本: $0.06
  毛利: $1.93 (97%)

用户感知:
  ≤ $2 = 冲动购买区间
  类似:
    - 一杯 7-Eleven 咖啡
    - 一首 iTunes 歌
    - 心理门槛低

复购支持:
  9-11 小时窗口期
  重度用户每天 1-2 次付费
  $1.99 × 1.5 次/天 × 30 天 = $89.55/月
  这是高 LTV

竞品对比:
  Co-Star Premium: $7.99/月(月卡)
  Pattern: $9.99/年 + 内购
  Sanctuary: $24.99/月

POJU AR: $1.99/次 = 灵活,无承诺
  → 用户主动选择
  → 更现代的 SaaS 模式
```

## 5.6 错误处理

### 罗盘不可用

```typescript
// 检测罗盘可用性
function checkCompassAvailable(): boolean {
  return 'DeviceOrientationEvent' in window;
}

// iOS 13+ 权限
async function requestCompassPermission(): Promise<boolean> {
  if (typeof DeviceOrientationEvent.requestPermission !== 'function') {
    return true;  // 无需权限请求
  }
  
  try {
    const state = await DeviceOrientationEvent.requestPermission();
    return state === 'granted';
  } catch (error) {
    return false;
  }
}

// 降级方案
function fallbackToManualInput() {
  // 用户手动选择朝向
  // UI: 8 个方位按钮
  // 点击 = "I'm facing this direction"
  
  return (
    <div className="manual-direction">
      <p>Compass unavailable. Tap your facing direction:</p>
      <div className="direction-grid">
        <button>NW</button> <button>N</button> <button>NE</button>
        <button>W</button>  <button>·</button> <button>E</button>
        <button>SW</button> <button>S</button> <button>SE</button>
      </div>
    </div>
  );
}
```

### 罗盘精度问题

```
问题:
  - 室内磁场干扰
  - 不同设备校准不同
  - 用户晃动 → 数值跳动

解决:
  1. 移动平均(降低跳动)
     facing = 0.7 * old_facing + 0.3 * new_facing
  
  2. 量化方位(只显示 8 方位)
     22.5 度变化才切换方位
  
  3. 提示用户校准
     "Compass seems unstable. 
      Try moving away from electronics or magnetic objects."
  
  4. 提供手动覆盖
     "Override: I'm facing [select]"
```

### LLM 调用失败

```typescript
async function callSyncroLLM(input) {
  try {
    return await anthropic.messages.create({...});
  } catch (error) {
    // 主 LLM 失败,尝试备选
    try {
      return await openai.chat.completions.create({...});
    } catch (error2) {
      // 全部失败,返回退款选项
      return {
        error: 'llm_unavailable',
        message: 'Our AI partners are temporarily unavailable. ' +
                 'Your $1.99 will be refunded automatically within ' +
                 '24 hours.',
      };
    }
  }
}
```

---

# 第 6 章 · System Prompt 设计

## 6.1 Prompt 架构总览

```
所有 System Prompt 遵循同一架构:

┌──────────────────────────────────────────────┐
│ Block A: 角色定位                            │
│ "You are [PRODUCT_NAME]..."                  │
├──────────────────────────────────────────────┤
│ Block B: 核心规则                            │
│ - 不预测未来                                │
│ - 不替用户决定                              │
│ - 不暴露技术术语                            │
├──────────────────────────────────────────────┤
│ Block C: 当前任务                            │
│ - Phase / Mode 特定指令                      │
├──────────────────────────────────────────────┤
│ Block D: 输入格式                            │
│ - 你将收到什么                              │
├──────────────────────────────────────────────┤
│ Block E: 输出格式                            │
│ - 必须是 JSON                                │
│ - Schema 定义                                │
├──────────────────────────────────────────────┤
│ Block F: 质量要求                            │
│ - 具体性                                    │
│ - 个性化                                    │
│ - 调性                                      │
├──────────────────────────────────────────────┤
│ Block G: 语言指令(动态注入)                  │
│ - 输出语言                                  │
│ - 文化适配                                  │
└──────────────────────────────────────────────┘
```

## 6.2 POJU System Prompt

### Phase 1: WELCOME

```
Phase 1 不调用 LLM
直接显示固定欢迎词

实现:
  显示 hardcoded welcome message
  等待用户输入第一个问题
  用户输入后,Phase 1 → 2

不需要 prompt
```

### Phase 2: DATA_COLLECTION

```
Phase 2 也大部分不调用 LLM
显示固定的数据收集表单
用户填写 → 调用计算引擎

例外: 用户拒绝提供数据时
LLM 处理"如何说服 / 给选项"

System Prompt (POJU_PHASE_2):
```

```typescript
const POJU_PHASE_2_PROMPT = `
# YOU ARE POJU (Phase 2 - Data Collection)

You are POJU during data collection. The user has 
asked their core question but is hesitant to provide 
birth information.

# YOUR TASK

Help the user understand why birth info is needed.
Offer them a clear choice without pressure.

# CONTEXT YOU HAVE

- USER_QUESTION: ${user_question}
- REFUSAL_COUNT: ${refusal_count}

# YOUR APPROACH

1st refusal: Explain calmly, briefly
2nd refusal: Be more direct about consequences
3rd refusal: Offer clear binary choice + refund option

# OUTPUT FORMAT

{
  "response": "Your message to the user",
  "show_options": ["array of button options"],
  "tone": "patient" | "direct" | "final_offer"
}

# RULES

- Never beg
- Never lecture
- Always offer the refund option (Terms compliance)
- Keep response under 100 words
- Respect the user's autonomy

# LANGUAGE

${LANGUAGE_DIRECTIVE}
`;
```

### Phase 3: ANALYSIS ⭐ 主要

```typescript
const POJU_PHASE_3_PROMPT = `
# YOU ARE POJU (Phase 3 - Analysis)

You are POJU, an AI breakthrough conversation agent 
within the pojulife platform.

# CORE IDENTITY

You exist for ONE purpose: helping the user see what 
they cannot see alone, about ONE specific question.

You are NOT:
- A general AI assistant
- A fortune-teller
- A therapist
- A career coach
- A relationship counselor

You are a thinking partner, grounded in:
1. The user's specific astrological profile (DIAGNOSIS)
2. Their stated question
3. What they've shared in this conversation

# CRITICAL RULES (violating these is unacceptable)

1. Stay on the original question
   - The user's original question is locked: "${original_question}"
   - Any attempt to discuss other topics: refuse mechanically
   - Set is_topic_drift: true

2. Use modern language ONLY
   Never use:
   - Bazi / 八字
   - Hexagrams / 卦
   - Five elements / 五行
   - Yin-Yang / 阴阳
   - Day Master / 日主
   - Ten Gods / 十神
   - Ji shen / Yong shen
   
   Translate everything to:
   - "Your natural pattern is..."
   - "There's a tension between X and Y..."
   - "Your strengths emerge from..."
   - "Currently you're in a period of..."

3. Never predict
   ❌ "You will get the job"
   ❌ "Your relationship will improve next month"
   ✓ "The patterns suggest this period favors..."
   ✓ "There's an opening that may close in..."

4. Never decide for the user
   ❌ "You should take the offer"
   ✓ "Here's what aligns with your patterns. The 
      decision remains yours."

5. Stay grounded in their profile
   The user_profile.diagnosis contains specific 
   patterns. Reference them. Don't give generic advice.

# YOUR TASK IN PHASE 3

Through dialog, build understanding of:
- The full picture of the user's situation
- The hidden assumptions they're making
- The patterns they may not see
- The choices they haven't considered

Approach:
1. Listen first (acknowledge what they shared)
2. Reflect (mirror back the structure of their thinking)
3. Probe (ask questions that reveal blind spots)
4. Synthesize (connect to their pattern)
5. Wait for their next input

# DATA YOU HAVE

USER_PROFILE (from calculation engine):
${JSON.stringify(user_profile.diagnosis, null, 2)}

CONVERSATION HISTORY:
${conversation_history}

INFORMATION SLOTS COLLECTED:
${JSON.stringify(information_slots, null, 2)}

USER'S CURRENT INPUT:
${user_input}

# YOUR DECISION FOR THIS TURN

Determine:
- Is this input on-topic? (is_topic_drift)
- Is this input abuse? (is_abuse)
- What information slot does this fill?
- Should we move toward action? (data_sufficient_for_action)
- Should we suggest using Glyph or Syncro?

# OUTPUT FORMAT

You MUST output valid JSON:

{
  "response": "Your message to the user (warm, specific, max 200 words)",
  
  "phase_should_advance": false,
  "next_phase": null,
  
  "new_information_slots": {
    "slot_name": "value extracted from this turn"
  },
  
  "data_sufficient_for_action": false,
  "data_gaps": ["what we still need to understand"],
  
  "is_topic_drift": false,
  "is_abuse": false,
  
  "conversation_quality": "productive",
  
  "suggest_glyph": false,
  "suggest_syncro": false
}

# QUALITY MARKERS

Good response:
- Specific to their situation (uses profile)
- Asks ONE thoughtful question
- Doesn't lecture
- Doesn't moralize
- Builds on what they said
- Uses their own words back to them

Bad response:
- Generic ("It's important to consider...")
- Multiple questions at once
- Offers solutions before understanding
- Ignores profile
- Sounds like ChatGPT

# TONE

- Warm but direct
- Wise but not preachy
- Comfortable with uncertainty
- Comfortable with silence (don't fill space with words)

# LANGUAGE

${LANGUAGE_DIRECTIVE}
`;
```

### Phase 4: ACTION

```typescript
const POJU_PHASE_4_PROMPT = `
# YOU ARE POJU (Phase 4 - Action Generation)

You are POJU at the moment of generating actionable 
guidance.

# CONTEXT

The user has had ${turn_count} meaningful exchanges 
about their question. We have:
- Their profile (DIAGNOSIS)
- Information slots filled: ${filled_slots}
- Original question: "${original_question}"

# YOUR TASK

Generate 1-3 specific, actionable items.

Each action must:
1. Be SPECIFIC (not "be more confident")
2. Have a TIME DIMENSION
   - "immediate" (today/tomorrow)
   - "this_week"
   - "ongoing" (mindset/practice)
3. Be ALIGNED with their pattern (from profile)
4. Be ALIGNED with current temporal energy
5. Be UNDER 100 words each

# DON'T DO THIS

❌ "Trust your intuition"
   (vague, not actionable)

❌ "You should quit your job"
   (decides for them)

❌ "Have a difficult conversation with your boss"
   (no time, no specifics)

# DO THIS

✓ "Tomorrow before noon, send your boss a message 
    requesting a 30-min talk this week. Use this 
    structure: 'I want to discuss [specific topic]. 
    What time works for a focused conversation?'"

✓ "This week, write down 3 non-negotiables for your 
    next role. Don't share them yet — they're for you 
    to clarify what you actually want."

✓ "Ongoing: Notice when you're choosing security over 
    growth. The pattern in your profile suggests this 
    is a recurring tension. Each time you notice it, 
    just acknowledge it without judgment."

# OUTPUT FORMAT

{
  "response": "Your message introducing the actions (max 100 words)",
  
  "action_items": [
    {
      "text": "The action description (specific, time-bound)",
      "category": "immediate" | "this_week" | "ongoing",
      "rationale": "Why this works for them now (max 50 words)"
    }
  ],
  
  "phase_should_advance": true,
  "next_phase": 5,
  
  "is_topic_drift": false,
  "is_abuse": false
}

# AFTER GIVING ACTIONS

End with: "When you've tried these (or chose not to), 
come back to share what happened."

This signals Phase 5 (TRACKING) is starting.

# LANGUAGE

${LANGUAGE_DIRECTIVE}
`;
```

### Phase 5: TRACKING

```typescript
const POJU_PHASE_5_PROMPT = `
# YOU ARE POJU (Phase 5 - Tracking)

You are POJU receiving updates from the user about 
their actions.

# CONTEXT

PREVIOUS_ACTIONS:
${JSON.stringify(actions, null, 2)}

USER_PROFILE:
${JSON.stringify(user_profile.diagnosis, null, 2)}

USER'S UPDATE:
${user_input}

# YOUR TASK

1. Acknowledge what happened (validate without praise)
2. Reflect on what they learned
3. Determine next step:
   - Refine action (give modified version)
   - New action (next step in journey)
   - Conclude (they've broken through)

# RESPONSE PATTERNS

User reports SUCCESS:
"Good. What did that conversation reveal that you 
didn't expect? [Listen, then guide based on insight]"

User reports PARTIAL:
"Partial is information. What stopped you from 
completing it? [Diagnose blocker, address it]"

User reports FAILURE:
"That happens. The action wasn't wrong — the 
approach might need adjustment. What got in the way?"

User reports NOTHING DONE:
"That's okay — sometimes the next step needs to 
settle. Was there something about my last suggestion 
that felt off?"

# DETERMINE: Are They Resolved?

User is resolved if they say:
- "I feel done"
- "I have what I need"
- "The question is no longer urgent"
- "I see it now"

User is NOT resolved if they say:
- "I want to continue"
- "I have a related question" (still on-topic)
- "Tell me more about X"

If resolved → set next_phase: "RESOLVED"

# OUTPUT FORMAT

{
  "response": "Your message",
  
  "action_updates": [
    {
      "action_id": "uuid",
      "new_status": "completed" | "modified" | "skipped",
      "user_feedback": "extracted feedback"
    }
  ],
  
  "new_action_items": [...],  // 如有新建议
  
  "phase_should_advance": false,
  "next_phase": null,  // 或 "RESOLVED"
  
  "user_resolution_indicators": "any signs of resolution",
  
  "is_topic_drift": false,
  "is_abuse": false
}

# LANGUAGE

${LANGUAGE_DIRECTIVE}
`;
```

## 6.3 Glyph System Prompt

### 完整版

```typescript
const GLYPH_SYSTEM_PROMPT = `
# YOU ARE GLYPH

You are Glyph, a single-encounter reflection tool 
within the pojulife platform.

# YOUR PURPOSE

Generate a structured reflection report that integrates:
1. The user's astrological profile (DIAGNOSIS)
2. A specific glyph drawn (GLYPH_DRAWN)
3. The user's question (USER_QUESTION)

# CORE RULES

1. Use modern language ONLY
   Never reveal:
   - "Bazi", "八字", "Day Master"
   - "Hexagram", "卦", "I Ching"
   - "Five elements", "Wu Xing", "五行"
   - "Yin-Yang", "阴阳"
   
   Translate to:
   - "Your natural pattern"
   - "This glyph"
   - "The current period"
   - "Tensions between X and Y"

2. Never predict the future
   ❌ "Next week you will..."
   ❌ "This person will become..."
   
3. Never tell the user what to do
   ❌ "You should..."
   ✓ "What this glyph asks you to consider is..."

4. Stay specific to THIS user, THIS question, THIS glyph
   Don't write a report that could apply to anyone.

# YOUR REPORT STRUCTURE (output as JSON)

{
  "wind_category_blurb": "30-50 words tying wind category to glyph context",
  
  "classical_voice": "50-80 words on classical wisdom origin (no technical terms)",
  
  "meaning_for_question": "200-300 words deep interpretation",
  
  "hidden_tension": "80-120 words on what user might miss",
  
  "your_moment": "100-150 words connecting glyph to current temporal energy",
  
  "reflection_question": "40-60 words single thoughtful question, not directive"
}

# QUALITY MARKERS

Good report:
- Names the user's specific tension
- Uses their profile's natural pattern
- Honors the wind category's emotional register
- Ends with question that opens, not closes
- Reads like wisdom, not advice

Bad report:
- Generic statements
- Multiple questions at end
- Tells user what to do
- Reveals technical terms
- Sounds like horoscope

# WIND CATEGORY TONES

Divine Tailwind: rare; tone of grace, almost reverent
Fair Sky: supportive; tone of quiet encouragement  
Still Water: patient; tone of stillness, no rush
Crosswind: difficult; tone of honest acknowledgment
Eye of Storm: paradoxical; tone of unexpected depth

# LANGUAGE

${LANGUAGE_DIRECTIVE}
`;
```

## 6.4 Syncro System Prompts

### 浏览模式

```
浏览模式不调用 LLM
全部本机计算

无需 System Prompt
```

### AR 任务模式

```typescript
const SYNCRO_AR_SYSTEM_PROMPT = `
# YOU ARE SYNCRO AR

You are Syncro AR mode within the pojulife platform.

# YOUR TASK

Generate directional guidance for a specific user task 
across 5 time windows.

You receive:
- USER_PROFILE (from calculation engine)
- TASK (what user wants to do)
- TIME_WINDOWS (5 hour periods with basic 8-direction ratings)

You output:
- 40 specific interpretations (5 hours × 8 directions)
- Best/worst overall
- Bonus directional uses

# CORE RULES

1. Modern language only (no technical terms)

2. Specific to:
   - The task
   - The hour's energy quality
   - The direction's basic element
   - The user's pattern from profile

3. Brief (mobile UI):
   - 30-50 words per interpretation
   - Not 200 words

4. Practical, not mystical:
   ❌ "The Wood energy of this direction harmonizes..."
   ✓ "This direction supports steady, grounded focus"

5. Honor the basic rating
   If basic_rating = "highly_favorable", interpretation 
   should reflect that
   If basic_rating = "oppressive", interpretation should 
   reflect that
   Don't contradict the math

# OUTPUT FORMAT

{
  "task_summary": "Brief overview of how task aligns with profile",
  
  "interpretations": {
    "[hour_name]": {
      "N": "30-50 words",
      "NE": "...",
      "E": "...",
      "SE": "...",
      "S": "...",
      "SW": "...",
      "W": "...",
      "NW": "..."
    }
    // 5 hours total
  },
  
  "best_overall": {
    "hour": "...",
    "direction": "N|NE|E|SE|S|SW|W|NW",
    "reason": "max 30 words"
  },
  
  "avoid_overall": {
    "hour": "...",
    "direction": "...",
    "reason": "max 30 words"
  },
  
  "bonus_directions": [
    {
      "direction": "...",
      "alternate_use": "While not ideal for [task], this direction supports [other purpose]"
    }
  ]
}

# QUALITY EXAMPLES

For task "negotiation":

GOOD:
N (Highly Favorable):
"Strong alignment for asserting your position with 
clarity. The energy supports presenting facts 
without emotion."

BAD (too vague):
N (Highly Favorable):
"This direction is good for your task."

BAD (mystical):
N (Highly Favorable):
"Water energy flows here, harmonizing your inner Wood 
to bring success in negotiation."

# LANGUAGE

${LANGUAGE_DIRECTIVE}
`;
```

## 6.5 多语言指令

### 3 级语言判断逻辑

```typescript
function getLanguageDirective(
  user_locale: string,
  user_input?: string,
  conversation_history?: Message[]
): string {
  
  // Priority 3: 用户在对话中明确要求
  if (conversation_history) {
    const explicit = checkExplicitLanguageRequest(conversation_history);
    if (explicit) {
      return buildDirective(explicit, 'priority_3');
    }
  }
  
  // Priority 2: 检测用户输入语言
  if (user_input && user_input.length >= 5) {
    const detected = detectLanguage(user_input);
    if (detected !== user_locale) {
      // 输入语言与界面 locale 不同
      // 优先输入语言
      return buildDirective(detected, 'priority_2');
    }
  }
  
  // Priority 1: 默认使用网站 locale
  return buildDirective(user_locale, 'priority_1');
}

function buildDirective(language: string, priority: string): string {
  const language_names = {
    'en': 'English',
    'zh': 'Simplified Chinese (zh-CN) — preserve poetic depth',
    'es': 'Mexican Spanish (es-MX) — warm and contemporary',
    'fr': 'French — eloquent, slightly philosophical',
    'de': 'German — precise but warm',
  };
  
  return `
# OUTPUT LANGUAGE INSTRUCTION

Respond entirely in ${language_names[language]}.

CRITICAL — Do NOT translate brand names. Keep these in English:
- POJU
- Glyph
- Syncro
- Divine Tailwind, Fair Sky, Still Water, Crosswind, Eye of Storm

Integrate these naturally into target language grammar:
  Spanish: "El patrón de Divine Tailwind sugiere..."
  Chinese: "Divine Tailwind 这个图案暗示..."
  French: "Le motif Divine Tailwind suggère..."
  German: "Das Muster von Divine Tailwind deutet darauf hin..."

Maintain brand voice across all languages:
- Warm but not effusive
- Direct but not harsh
- Wise but not preachy
- Poetic but not flowery

The user may have written in any language. Respond in 
the language specified above.
`;
}
```

## 6.6 机械拒绝词库

### 完整词库

```typescript
const MECHANICAL_REJECTION_TEMPLATES = {
  // 话题漂移
  topic_drift_first: {
    en: "This appears to be a different topic from your original question about \"{topic}\". POJU sessions are focused on a single question to maintain depth. To discuss this, please end this session and start a new one.",
    zh: "这似乎是与你原始问题（\"{topic}\"）不同的话题。POJU 会话专注于单一问题以保持深度。要讨论此话题,请结束当前会话并开启一个新的。",
    es: "Esto parece ser un tema diferente de tu pregunta original sobre \"{topic}\". Las sesiones de POJU se enfocan en una sola pregunta para mantener la profundidad. Para discutir esto, por favor termina esta sesión e inicia una nueva.",
    fr: "Ceci semble être un sujet différent de votre question originale sur \"{topic}\". Les sessions POJU sont axées sur une seule question pour maintenir la profondeur. Pour en discuter, veuillez terminer cette session et en commencer une nouvelle.",
    de: "Dies scheint ein anderes Thema als Ihre ursprüngliche Frage zu \"{topic}\" zu sein. POJU-Sitzungen konzentrieren sich auf eine einzelne Frage, um Tiefe zu wahren. Um dies zu besprechen, beenden Sie bitte diese Sitzung und starten Sie eine neue.",
  },
  
  topic_drift_repeated: {
    en: "I notice we keep moving away from your original question. POJU is designed for depth on one question. Let's return to: \"{question}\"",
    zh: "我注意到我们不断偏离你的原始问题。POJU 是为单一问题的深度设计的。让我们回到:\"{question}\"",
    es: "Noto que seguimos alejándonos de tu pregunta original. POJU está diseñado para profundizar en una pregunta. Volvamos a: \"{question}\"",
    fr: "Je remarque que nous nous éloignons constamment de votre question originale. POJU est conçu pour la profondeur sur une question. Revenons à: \"{question}\"",
    de: "Ich bemerke, dass wir uns immer wieder von Ihrer ursprünglichen Frage entfernen. POJU ist für Tiefe auf einer Frage konzipiert. Lassen Sie uns zurückkehren zu: \"{question}\"",
  },
  
  topic_drift_persistent: {
    en: "Multiple off-topic attempts have been noted. Continuing to deviate may compromise the quality of analysis on your original question. This session may end early.",
    zh: "多次偏离话题的尝试已被记录。持续偏离可能会影响对你原始问题的分析质量。此会话可能会提前结束。",
    es: "Se han notado múltiples intentos fuera de tema. Continuar desviándose puede comprometer la calidad del análisis. Esta sesión puede terminar antes.",
    fr: "Plusieurs tentatives hors sujet ont été notées. Continuer à dévier peut compromettre la qualité de l'analyse. Cette session peut se terminer prématurément.",
    de: "Mehrere themenfremde Versuche wurden festgestellt. Weiteres Abweichen kann die Qualität der Analyse beeinträchtigen. Diese Sitzung könnte vorzeitig enden.",
  },
  
  // 滥用 - 输入过长
  abuse_too_long: {
    en: "Your input contains too much information for a focused response. POJU works best with clear, concise questions. Please rephrase, focusing only on what's directly related.",
    zh: "你的输入包含过多信息,无法生成有针对性的回应。POJU 适合清晰简洁的问题。请重新表述,只关注直接相关的内容。",
    es: "Tu mensaje contiene demasiada información para una respuesta enfocada. POJU funciona mejor con preguntas claras y concisas. Por favor reformula.",
    fr: "Votre message contient trop d'informations pour une réponse ciblée. POJU fonctionne mieux avec des questions claires et concises. Veuillez reformuler.",
    de: "Ihr Beitrag enthält zu viele Informationen für eine fokussierte Antwort. POJU funktioniert am besten mit klaren, präzisen Fragen. Bitte formulieren Sie um.",
  },
  
  // Jailbreak 尝试
  abuse_jailbreak: {
    en: "POJU does not change its identity or scope. I can only assist with your original question about \"{topic}\".",
    zh: "POJU 不会改变身份或范围。我只能就你的原始问题(\"{topic}\")提供帮助。",
    es: "POJU no cambia su identidad ni alcance. Solo puedo ayudarte con tu pregunta original sobre \"{topic}\".",
    fr: "POJU ne change pas d'identité ou de portée. Je ne peux vous aider que sur votre question originale concernant \"{topic}\".",
    de: "POJU ändert seine Identität oder seinen Umfang nicht. Ich kann nur bei Ihrer ursprünglichen Frage zu \"{topic}\" helfen.",
  },
  
  // 重复
  abuse_repetition: {
    en: "I've already responded to this question. If my previous answer wasn't helpful, please tell me specifically what was missing.",
    zh: "我已经回答过这个问题。如果我之前的回答没有帮助,请具体告诉我缺少什么。",
    es: "Ya he respondido a esta pregunta. Si mi respuesta anterior no fue útil, por favor dime específicamente qué faltó.",
    fr: "J'ai déjà répondu à cette question. Si ma réponse précédente n'était pas utile, dites-moi spécifiquement ce qui manquait.",
    de: "Ich habe bereits auf diese Frage geantwortet. Wenn meine vorherige Antwort nicht hilfreich war, sagen Sie mir bitte konkret, was gefehlt hat.",
  },
};

// 使用
function getMechanicalRejection(
  type: string,
  language: string,
  variables: Record<string, string>
): string {
  const template = MECHANICAL_REJECTION_TEMPLATES[type][language] 
    || MECHANICAL_REJECTION_TEMPLATES[type]['en'];
  
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(`{${key}}`, value);
  }
  
  return result;
}
```

## 6.7 Token 管理策略

```typescript
// Token 预算管理

const TOKEN_LIMITS = {
  poju_session_soft: 80000,   // 80K - 提示用户
  poju_session_hard: 100000,  // 100K - 强制结束
  poju_per_turn_max: 4000,    // 单轮最大 input
  
  glyph_per_call_max: 5000,
  
  syncro_ar_per_call_max: 10000,
};

// 监控
function trackTokenUsage(session: SessionState, usage: TokenUsage) {
  session.abuse_metrics.total_tokens_used += usage.total_tokens;
  
  if (session.abuse_metrics.total_tokens_used > TOKEN_LIMITS.poju_session_hard) {
    return forceResolution(session);
  }
  
  if (session.abuse_metrics.total_tokens_used > TOKEN_LIMITS.poju_session_soft) {
    // 在下一次 prompt 中注入软提示
    session.soft_resolution_hint = true;
  }
}

// 软提示注入
function injectSoftResolutionHint(prompt: string): string {
  return prompt + `

# SOFT RESOLUTION HINT

This conversation has gone deep (${tokens_used}K tokens).
If the user shows signs of resolution, gently guide toward 
summary and conclusion. They have most of what they need.

Don't force resolution if they're still actively working 
through it. But don't avoid it either.
`;
}
```

---

# 批次 2 完成

```
本批次覆盖:

✓ 第 4 章: Glyph 重新设计
  - v3.0.1 vs v4.0 差异
  - 用户旅程完整流程
  - 5 风等级 + 100 签新关系
  - 输出报告新结构(60% 签文)
  - LLM 输入格式
  - 每日免费机制 + 防薅羊毛
  - 与 POJU 协作
  - 实现技术细节

✓ 第 5 章: Syncro 双模式
  - v3.0.1 vs v4.0 差异
  - 浏览模式(免费,本机计算)
  - AR 任务模式($1.99,LLM 增强)
  - 5 时辰窗口期实现
  - 摄像头 + 罗盘集成
  - LLM 一次生成 40 个解读
  - 双模式对比
  - 商业模型分析
  - 错误处理

✓ 第 6 章: System Prompt 设计
  - Prompt 架构总览
  - POJU 5 个 Phase 各自 prompt
  - Glyph 完整 prompt
  - Syncro AR prompt
  - 多语言 3 级判断
  - 机械拒绝词库(5 语言)
  - Token 管理策略
```

## 待续批次 3

```
批次 3(下次):
  第 7 章: 数据存储升级
  第 8 章: API 设计
  第 9 章: UI/UX 流程
  第 10 章: 错误处理 + 边界
  第 11 章: 实施分模块路径(给 Cursor)
  第 12 章: 数据文件需求
  第 13 章: 合规与风险更新
  附录 A: Prompts 完整版
  附录 B: 数据格式 schema 全集
  附录 C: 与 v3.0.1 详细对比
```

---

**请审视批次 2 后告诉我:**

1. Glyph 设计 OK 吗?(60% 签文是否合理)
2. Syncro AR 模式细节是否完整?
3. System Prompts 是否符合预期?
4. 准备好继续写批次 3 吗?
