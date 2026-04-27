# 04 · Oracle 产品页 `/oracle`

## 页面身份

| 项 | 值 |
|---|---|
| 路由 | `/oracle` |
| 文件位置 | `app/(marketing)/oracle/page.tsx`（主介绍）+ `app/(product)/oracle/page.tsx`（功能流程） |
| 页面标题 | `Oracle — A 2,000-year practice of sincere questioning` |
| 目标用户 | 带着真诚问题来的用户 + POJU 付费流中被 AI 召唤的用户 |
| 核心目标 | 提供完整抽签仪式 + 精美卡片设计，引流 POJU 付费 |
| 优先级 | 中高（Task 1 静态 + Task 4 交互） |
| 所属 Task | Task 1（主介绍页）+ **Task 4（完整仪式流程 + 5 级卡片系统）** |

---

## 访问条件

- 所有人可访问
- **PC 和移动端都完整可用**
- 无需注册
- 同一问题 48 小时内再问会有温柔劝退（相似度检测）

---

## 整体架构

`/oracle` 路由由**两个逻辑视图**组成，通过 React 状态切换（不独立路由）：

```
访问 /oracle
    ↓
【主介绍视图】（默认呈现）
    ↓ 用户点击 "Start Your Oracle"
【功能视图 · Stage 1】
    ↓ Stage 2 → 3 → 4 → 5 → 6 → 7 → 8
    ↓
显示完整卡片 + 三按钮（Full Reading / Save / Share）
    ↓
完整解读报告自动保存到 Archive
```

刷新页面 / 从书签访问 → 始终回到主介绍视图（不保留中途状态）。

---

## 第一部分 · 主介绍视图

### 页面结构清单

1. Hero 区
2. Oracle 是什么（完整叙事）
3. Oracle 何时适用（4 个场景）
4. Oracle vs POJU（简单对比表）
5. 5 级风向系预告
6. 三条使用须知
7. 最终 CTA
8. Footer

---

### 1. Hero 区

**大标题**：`Oracle`

**副标题**：`A 2,000-year practice of sincere questioning.`

**抓人的开场白**（1-2 句）：
```
Ask one question. Hold it in silence.
Receive a sign — drawn from one hundred archetypal
patterns refined over a hundred generations.
```

**主 CTA 按钮**：`Start Your Oracle`
- 样式：Primary 紫色 pill
- 点击行为：切换到功能视图 Stage 1

**副 CTA 按钮**：`Learn more ↓`
- 样式：Tertiary 文字按钮
- 点击：平滑滚动到下方介绍区

**背景视觉**：紫色星云粒子（比落地页 Hero 更克制）

---

### 2. Oracle 是什么（完整叙事）

**标题**：`The practice, preserved`

**核心叙事段**：

```
Across the East, for two thousand years, people came with
a single question, held in silence, carried in a sincere
heart. They offered it to an ancient listening presence
— one said to listen to every soul who came with true
intent — and waited for the answer to arrive in a
different form.

Not a voice. A sign. A mysterious card, drawn from one
hundred archetypal patterns refined over millennia. The
answer was never prescriptive. It was revelatory — it
showed you what you already carried, now named, now
visible.

The only requirement was sincerity. A sincere heart
opens the channel. Casual curiosity receives only noise.
A real question, held honestly, receives a real sign.

Today, we bring this practice into your hand. The pattern
library is intact. The ritual is intact. What changed is
only the medium — an AI that reads the drawn sign,
understands your question, and delivers the guidance in
language you can act on today.
```

**关键文字强调**（紫色 accent）：
- `sign`
- `a sincere heart opens the channel`
- `an AI that reads the drawn sign`

---

### 3. Oracle 何时适用（4 个场景）

**标题**：`When Oracle is right for you`

**4 个场景卡片**（每个带 ✦ 符号 + 标题 + 副描述）：

#### ✦ You're holding one question that keeps circling back
```
It returns at night. In the shower. Between meetings.
The question has weight, but you don't know why yet.
```

#### ✦ You don't need an answer — you need a sign
```
You've read the pros and cons. You've talked to everyone.
What you need now is something from outside all of that.
```

#### ✦ You want to listen before you speak
```
Before taking the action, before sending the message —
you want to check your intuition against something deeper.
```

#### ✦ You're at a threshold and unsure which side you're on
```
A job offer. A relationship. A move. You sense a turn
coming, but you can't tell if you're before it or after it.
```

---

### 4. Oracle vs POJU（简单对比）

**标题**：`Oracle or POJU?`

**副标题**：`Two tools. One intention: to help you see clearly.`

**简单表格**：

|  | Oracle | POJU |
|---|---|---|
| Length | 2 minutes | 30 min – several hours |
| Depth | One revealing sign | Full breakthrough session |
| Price | Free | $9.99 per session |
| Best for | When you need direction | When you need a plan |

**下方一段**：
```
Many users start with Oracle. The sign often reveals a
deeper question beneath the one they asked. When that
happens, POJU is where they go.
```

---

### 5. 5 级风向系预告

**标题**：`The five kinds of signs`

**副标题**：`Five archetypal patterns. One hundred signs in total. Which one arrives depends on your question and the sincerity you hold.`

**5 级列表**（每个用 ✦ 标识，不展示概率，保留神秘感）：

```
✦ Divine Tailwind
  The rare grace of full alignment.
  Everything needed is already moving toward you.

✦ Fair Sky
  Clear paths with gentle support.
  The way is open, but you must still walk it.

✦ Still Water
  The time for patience and stillness.
  Neither forward nor backward. Sit with what is.

✦ Crosswind
  Competing forces pulling at you.
  Not a sign to push harder — a sign to listen more carefully.

✦ Eye of Storm
  The deep stillness found at the center of a storm.
  When everything external is turbulent, clarity lives in
  the one place nothing can reach.
```

**关键视觉说明**：每一级用对应的**小型粒子动画预览**（缩小版卡片背面动效），让用户对"自己会看到什么"有视觉预期。

---

### 6. 三条使用须知

**标题**：`Before you ask`

**副标题**：`The ritual has three rules. They protect what you receive.`

**三条规则**：

```
◉ One question per reading.
  Asking many things at once dilutes the sign.

◉ If the same question calls you back, wait 48 hours.
  Answers don't change just because you ask again.
  Give them time to settle.

◉ Compress your question into 60 characters.
  The compression is the beginning of the answer.
```

---

### 7. 最终 CTA

**主按钮**：`Start Your Oracle`

**副按钮**：`Try POJU instead · $9.99 →`（跳转 `/poju`）

**底部小字**：
```
Always free. No account.
Your question is never stored. Your sign is yours alone.
```

---

### 8. Footer

见 `@docs/pages/00-overview.md`

---

## 第二部分 · 功能视图（Stage 1-8）

用户在主介绍页点击 `Start Your Oracle` 后，进入完整仪式流程。

---

### Stage 1 · Threshold（入口提示）

**作用**：用户已经决定开始，但在"动手问"之前做一个仪式性的停顿。

**视觉**：全屏，极简，无干扰

**内容**：

```
You're about to ask.

Remember the three rules:
◉ One question.
◉ Honest question.
◉ 60 characters.

A sincere heart opens the channel.

[ Continue → ]
```

**关键设计**：
- 文字简短（比主介绍页的使用须知更简化）
- 不重复讲 Oracle 是什么（已在主介绍页讲过）
- 用户点击 Continue 进入 Stage 2

---

### Stage 2 · Ask（问题输入）

**页面布局**：全屏，深色背景，中央聚焦输入框

**内容**：

**标题**：`What do you bring today?`

**单行输入框**：
- 最大字符：**60**
- 右下角实时显示字符数 `0 / 60`
- 占位符：`e.g. Should I end my relationship...`
- 字号：较大（Body-L 18px）
- 无装饰边框，仅底部紫色线（focus 时加深）

**按钮**：
- `Continue →`（输入不为空时激活）

**小字提示**：
```
Think of one thing. One real thing.
If it's many, choose the one that weighs most.
```

### 48 小时相似度检测

**触发**：用户点击 `Continue →` 后，提交前检测。

**技术实现**：
- 查询 IndexedDB `oracle_entries` 表
- 取最近 48 小时的问题
- 用 Claude Haiku 做语义相似度检测（或 Mock 阶段用字符串相似度）
- 相似度 > 80% 触发劝退

**劝退弹窗**：

```
┌──────────────────────────────────┐
│   You've already asked this.     │
│                                  │
│   Your sign from [2 hours ago]:  │
│   ✦ Still Water                  │
│                                  │
│   Answers don't change just      │
│   because you ask again.         │
│   Give it 48 hours.              │
│                                  │
│   [ Read my previous sign ]      │
│   [ Ask a different question ]   │
│   [ I know. Draw anyway. ]       │
└──────────────────────────────────┘
```

**三个按钮行为**：
- `Read my previous sign` → 直接加载之前抽到的卡片
- `Ask a different question` → 返回 Stage 2 清空输入
- `I know. Draw anyway.` → 继续进入 Stage 3（强抽）

---

### Stage 3 · Respond（响应）

**过渡屏**，约 2-3 秒。

**动画流程**：
1. Stage 2 输入框淡出（300ms）
2. 背景粒子从静态 → 加速流动
3. 背景音效 `hum.mp3` 渐入
4. 屏幕中央浮现文字：`Hold to summon your sign`
5. 进入 Stage 4

---

### Stage 4 · Summon（召唤）

**用户长按屏幕 3 秒**。

- 桌面端：鼠标按住
- 移动端：手指触摸保持

**取消条件**：
- 手指松开 / 鼠标抬起 → 计时重置
- 屏幕划出 → 计时重置

**视觉反馈 0-3 秒**：
1. 触摸点出现进度光环
2. 粒子向中心凝聚
3. `hum.mp3` 继续
4. 屏幕亮度略降

**3 秒完成瞬间**：
1. 光环最后一圈合拢 → **爆炸动画**
2. 音效：`explosion.mp3` + 手机震动（`navigator.vibrate(100)`）
3. 屏幕闪白 100ms
4. 进入 Stage 5

---

### Stage 5 · Card Reveal（卡片背面浮现）

**关键新设计**：爆炸后卡片**背面朝上**升起。

**动画流程**：
1. 爆炸粒子逐渐聚合 → 形成卡片轮廓（背面朝上）
2. 卡片从中心升起（opacity 0 → 1, scale 0.8 → 1），持续 2 秒
3. 音效：`paper.mp3`（纸张展开 2 秒）
4. 卡片完全呈现后，**用户可自由欣赏背面艺术**

**等待期**（3-5 秒自动停留）：
- 卡片背面粒子图案流动
- 屏幕底部淡入提示：`Tap to reveal`
- 等待用户点击

**用户点击** → 进入 Stage 6

---

### Stage 6 · Flip（3D 翻转）

**动画**：
- X 轴 3D 翻转 180°
- 持续 800ms
- 缓动：`ease-ornate`
- 翻转中间闪光（`rgba(255,255,255,0.3)` 覆盖 100ms）
- 音效：`paper.mp3` 二次响起（翻页感）

翻转完成 → 进入 Stage 7

---

### Stage 7 · Front Content（正面即时呈现）

**完全去掉毛笔写入**。翻转完成后内容**整体淡入**。

**动画**：
- 卡片正面内容整体 fadeIn + slideUp 8px
- 持续 500ms
- 音效：`bell.mp3`（钟响一下，表示内容就位）

**用户立即看到**完整卡片正面内容，无需等待。

---

### 卡片正面内容结构（固定，由数据驱动）

```
┌──────────────────────────────────┐
│                                  │
│       ✦ ✦ ✦ ✦ ✦                 │  ← 顶部等级符号
│                                  │
│      Sign No. 47                 │  ← 签号（小字）
│                                  │
│      ✦ Fair Sky ✦                │  ← 等级名
│      Sign of Openness            │  ← 副标题
│                                  │
│  ── THE VERSE ──                 │
│  [禅诗 · 4-6 行]                 │
│  [EB Garamond Italic]            │
│  [紫色强调色]                    │
│                                  │
│  ── WHAT IT MEANS ──             │
│  [AI 生成 · 50-80 英文字精华]    │
│  [Inter Regular]                 │
│                                  │
│  ── FOR TODAY ──                 │
│  [AI 生成 · 20-40 英文字]        │
│                                  │
│  ──────                          │
│                                  │
│          pojulife.com            │
│                                  │
└──────────────────────────────────┘
```

**内容生成时机**：
- **抽签瞬间 AI 已生成全部**（包括正面精华 + 完整报告）
- 用户点击 Full Reading 立即展开（无需再等 AI）
- 体验顺滑

---

### Stage 8 · Three Actions（三独立按钮）

卡片正面呈现完成后，下方浮现**三个独立按钮**：

```
┌────────────────────────────────┐
│                                │
│         [卡片正面]              │
│                                │
└────────────────────────────────┘

 [📖 Full Reading]  [💾 Save]  [⎋ Share]
```

#### 按钮 1 · `📖 Full Reading`

**样式**：Primary 紫色 pill（主操作，视觉最显眼）

**点击行为**：
- 卡片向上滑动并缩小到屏幕顶部 30%
- 下方展开完整解读报告
- 完整报告在抽签时已由 AI 生成，立即展示
- URL 不变，页面状态切换

#### 按钮 2 · `💾 Save`

**样式**：Secondary 玻璃 pill

**功能**：保存**卡片背面**到本地

**点击行为**：

**移动端**：
- 检测 Web Share API `canShare({ files })`
- 支持 → 调用系统"保存到相册"
- 不支持 → 触发下载到相册
- Toast：`Saved to your Photos`

**桌面端**：
- 直接触发浏览器下载
- 文件名：`poju-oracle-sign-[签号]-[等级名].png`
- Toast：`Card saved to your Downloads folder.`

**关键**：**只保存卡片背面**（艺术图案 + 等级视觉 + POJU 品牌标识），**不保存正面内容**。

#### 按钮 3 · `⎋ Share`

**样式**：Secondary 玻璃 pill

**功能**：分享**卡片背面**到其他 App

**点击行为**：

**移动端**：
```js
navigator.share({
  title: 'A sign from POJU',
  text: 'A sincere heart opens the channel. pojulife.com',
  files: [cardBackImageBlob],
});
```
- 系统原生分享菜单弹出
- 用户可选：Instagram / TikTok / Messages / AirDrop / X / 微信

**桌面端**：
- fallback：复制图片到剪贴板
- Toast：`Card copied to clipboard. Paste anywhere.`

**关键**：分享内容和 Save 一致——**只有卡片背面 + POJU 品牌水印**。不含用户问题、完整内容或解读。

---

## 完整解读报告（点击 Full Reading 后）

### 页面布局

```
┌────────────────────────────────────┐
│  [缩小的卡片正面]                  │  ← 顶部 30% 保留卡片展示
├────────────────────────────────────┤
│                                    │
│  Your Full Reading                 │  ← 标题
│                                    │
│  ── THE SITUATION ──               │
│  [AI 根据问题 + 签意生成]          │
│                                    │
│  ── WHAT THIS SIGN REVEALS ──      │
│  [深层含义 · 2-3 段落]             │
│                                    │
│  ── THE WISDOM ──                  │
│  [典故叙事化 · 无中文专名]         │
│                                    │
│  ── TODAY'S ACTIONS ──             │
│  1. [具体行动 1]                   │
│  2. [具体行动 2]                   │
│  3. [具体行动 3]                   │
│                                    │
│  ── REFLECTION QUESTIONS ──        │
│  • [问自己的问题 1]                │
│  • [问自己的问题 2]                │
│                                    │
│  ── WHEN TO REVISIT ──             │
│  [建议回访时机]                    │
│                                    │
│  ──────                            │
│                                    │
│  If this sign calls for deeper     │
│  work, POJU will sit with you.     │
│  One question · $9.99              │
│                                    │
│  [ Ask POJU to go deeper ]          │
│                                    │
│  ─────                             │
│                                    │
│  ✓ This reading is saved to your   │
│    Archive. Return anytime.        │
│                                    │
└────────────────────────────────────┘
```

**关键设计**：
- 报告**只在此页面展示**，**不提供分享按钮**（保持私密）
- **自动保存到 Archive**（用户无需操作）
- 底部有明确保存提示

**底部 POJU 引流按钮**：
- `Ask POJU to go deeper · $9.99`
- 点击 → Stripe Checkout（metadata: `source: "oracle_hook"`, `oracle_sign_id: [签ID]`）

---

## 5 级签卡视觉系统

**5 套模板 + 动态填充**（不做 100 张独立图）。

### 统一规格

- **尺寸**：9:16 竖屏（1080 × 1920 px，适合分享）
- **结构**：背面 + 正面两面
- **翻转**：X 轴 3D 翻转，800ms ease-ornate
- **材质**：玻璃 + 粒子混合质感
- **边缘**：1.5px 动态粒子环

### 签号种子微变化

同等级的所有签，模板相同但**基于签号有微妙差异**：

```typescript
function renderCardBack(signNumber, level) {
  const seed = hashSignNumber(signNumber);
  
  const particleCount = 800 + (seed % 400);           // 800-1200
  const flowDirection = (seed % 360) * Math.PI / 180;
  const rotationSpeed = 0.5 + (seed % 100) / 100;
  const centerOffset = { x: (seed % 20) - 10, y: (seed % 30) - 15 };
  
  return <CardBack {...} />;
}
```

这样"第 1 签"和"第 47 签"即使都是 Fair Sky 级别，粒子流动方向、速度、数量都会不同。

---

### 5 级卡片规范

#### 1. Divine Tailwind（神风相送）· 5%

**卡片背面**：
- 主色：`#F0ABFC`（粉紫光辉）+ `#FFD700` 稀有金色
- 中心图案：**一朵正在绽放的莲花**（抽象粒子构成），外围环绕旋转金光圈
- 背景粒子：金白粒子从中心向外辐射
- 边缘：双层粒子环（金色 + 紫色交织）
- 动效：中心莲花每 4 秒微微绽放（0.95 ↔ 1.05 scale）

**卡片正面**：
- 背景：深紫底 + 金色光晕从顶部倾洒
- 顶部符号：**✦ ✦ ✦ ✦ ✦**（五颗金星）
- 等级名：`Divine Tailwind`
- 副标题：`Sign of Grace`

**音效**：最明亮 bell（多一层谐波）

---

#### 2. Fair Sky（晴空可行）· 25%

**卡片背面**：
- 主色：`#A78BFA`（柔紫）
- 中心图案：**一片云下的飞鸟**（抽象粒子，姿态舒展）
- 背景粒子：柔紫粒子从左上向右下缓慢飘动（顺风感）
- 边缘：单层紫色粒子环
- 动效：飞鸟每 6 秒微微挥翼

**卡片正面**：
- 背景：深紫底 + 柔紫光晕从左上
- 顶部符号：**✦ ✦ ✦ ✦**（四颗紫星）
- 等级名：`Fair Sky`
- 副标题：`Sign of Openness`

**音效**：标准 bell

---

#### 3. Still Water（止水沉深）· 40%

**卡片背面**：
- 主色：`#6366F1`（蓝紫）
- 中心图案：**涟漪从中心向外扩散的同心圆**
- 背景粒子：极少量，缓慢上升（如水底气泡）
- 边缘：最淡的粒子环
- 动效：涟漪每 8 秒扩散一次（最静的一张）

**卡片正面**：
- 背景：深紫底 + 蓝紫淡光晕居中
- 顶部符号：**✦ ✦ ✦**（三颗淡紫星）
- 等级名：`Still Water`
- 副标题：`Sign of Stillness`

**音效**：低沉 bell（沉降感）

---

#### 4. Crosswind（逆风有意）· 25%

**卡片背面**：
- 主色：`#7C3AED`（深品红紫）
- 中心图案：**两条交叉的曲线**（粒子构成，像交叉的风）
- 背景粒子：从两个相反方向流动
- 边缘：粒子环不完整（有间隙感），暗示"有阻力"
- 动效：两条曲线每 5 秒强化一次对冲

**卡片正面**：
- 背景：深紫底 + 深品红侧光
- 顶部符号：**✦ ✦**（两颗深紫星）
- 等级名：`Crosswind`
- 副标题：`Sign of Tension`

**音效**：略带紧张的 bell（频率略低）

---

#### 5. Eye of Storm（风暴中心）· 5%

**卡片背面**：
- 主色：`#3B0764`（最深紫）+ 一丝金色装饰
- 中心图案：**风暴眼**——外围粒子狂乱旋转，最中心一个极小极亮的金点
- 背景粒子：外围密集旋转，内圈完全静止
- 边缘：最暗紫粒子环 + 一丝金色点缀
- 动效：外围粒子每 3 秒加速一次，中心始终不动

**卡片正面**：
- 背景：最深紫底 + 中心一束金光
- 顶部符号：**◉**（单个风暴眼符号，唯一使用非星星的等级）
- 等级名：`Eye of Storm`
- 副标题：`Sign of the Still Center`
- **额外副文字**（只有此级有）：
  ```
  The eye is the calm in the storm.
  This is where clarity lives.
  ```

**音效**：深沉而平静的 bell

---

## 概率分布与抽签逻辑

### 分布

```
Divine Tailwind   5%   ■
Fair Sky         25%   ■■■■■
Still Water      40%   ■■■■■■■■
Crosswind        25%   ■■■■■
Eye of Storm      5%   ■
```

### 抽签算法

**两层结构**：

```typescript
function drawSign(userQuestion: string): SignResult {
  // 第 1 层：按概率决定级别
  const rand = Math.random();
  let level: Level;
  if (rand < 0.05) level = 'divine_tailwind';
  else if (rand < 0.30) level = 'fair_sky';
  else if (rand < 0.70) level = 'still_water';
  else if (rand < 0.95) level = 'crosswind';
  else level = 'eye_of_storm';
  
  // 第 2 层：从该级别的签中随机选一个
  const signsOfLevel = ALL_100_SIGNS.filter(s => s.level === level);
  const chosenSign = signsOfLevel[Math.floor(Math.random() * signsOfLevel.length)];
  
  return chosenSign;
}
```

### 数据结构（签诗库）

`data/oracle-signs.json`：

```json
[
  {
    "sign_number": 1,
    "level": "divine_tailwind",
    "verse_en": ["...", "...", "...", "..."],
    "verse_zh": ["...", "...", "...", "..."],
    "keywords": ["grace", "alignment", "flow"],
    "traditional_source": "钟离成道"
  }
]
```

### 签诗本土化

每签的英文禅诗由人工精修（见附录 B 工作包），去中文典故专名，保留智慧内核。

---

## POJU 付费用户专享：3 签联动

从 POJU Chat 召唤 Oracle 的流程：

```
POJU Chat 页面中
  ↓
AI: "Let me show you your Present. Draw a sign."
AI: [显示 "✦ Draw your Present" 按钮]
  ↓
用户点击 → 底部抽屉弹出 Oracle 完整面板（跳过主介绍视图，直接 Stage 1）
  ↓
用户完成 Stage 1-7 → 得到 Present 卡
  ↓
抽屉自动关闭，数据回传 POJU Chat
  ↓
AI: "Now let's see your Past. Draw again."
  ↓
再次抽签 → Past 卡
  ↓
AI: "And finally your Future..."
  ↓
第三次抽签 → Future 卡
  ↓
POJU Chat 中显示 3 签合看视图 + AI 整体解读
```

### 3 签组合视图

```
┌─────────────────────────────────────┐
│   Your 3-Sign Reading               │
│                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │      │ │      │ │      │        │
│  │ Past │ │Presen│ │Future│        │
│  │ 🎴   │ │ 🎴   │ │ 🎴   │        │
│  └──────┘ └──────┘ └──────┘        │
│                                     │
│  Tap a card to read it full-screen  │
│                                     │
│  [ AI 整体解读文本 ]                │
└─────────────────────────────────────┘
```

---

## 数据依赖

### 需要读写的存储

**IndexedDB** (encrypted):
- Table: `oracle_entries`
- 字段：
  ```
  id,
  question_hash,
  question_text_encrypted,
  question_timestamp,
  sign_number,
  level,
  verse,
  what_it_means,
  for_today,
  full_reading,
  card_back_image_seed,
  language,
  linked_chat_session?
  ```

### 需要调用的 API

- `POST /api/ai/oracle`（生成签解释）
  - 请求体：`question + sign_number + level + language + linked_chat_session?`
  - **响应同时包含**：
    - `verse` (signed)
    - `what_it_means` (50-80 words)
    - `for_today` (20-40 words)
    - `full_reading` (完整 6 段报告)
  - **一次生成全部内容**，避免用户点 Full Reading 再等

### 静态资源

- `data/oracle-signs.json`（100 签静态库）
- `/public/sfx/hum.mp3`
- `/public/sfx/explosion.mp3`
- `/public/sfx/paper.mp3`
- `/public/sfx/bell.mp3`

**✗ 移除**：`brush.mp3`（去掉毛笔写入后不再需要）

---

## 响应式行为

### Desktop (≥1024px)

- 主介绍视图居中，最大宽度 800px
- 功能视图全屏沉浸
- 长按用鼠标按住
- Share 按钮 fallback 为复制到剪贴板

### Mobile (<1024px)

- 全屏沉浸体验
- 长按用手指触摸
- 震动反馈（`navigator.vibrate`）
- Web Share API 调用原生分享菜单
- 横屏时提示 `Turn your phone upright for the full ritual.`

---

## 空状态与错误状态

### 错误状态

- 问题输入为空 → 按钮禁用
- 字符超过 60 → 自动截断 + 红色字符计数
- AI 调用失败 → `Something in the signal is unclear. Try summoning again.`
- IndexedDB 保存失败 → Toast 提示但不阻塞用户看卡
- Web Share API 失败 → fallback 为下载

### 长按中途松开

- Toast：`You let go. Try again when you're ready.`
- 回到 Stage 3

### 卡片图片生成失败（用于 Save/Share）

- Toast：`Couldn't prepare the card image. Try again.`
- 重试按钮

---

## 验收标准

### 主介绍视图

- [ ] 访问 `/oracle` 显示主介绍视图（不是立即进入 Stage 1）
- [ ] Hero + 完整叙事 + 4 场景 + 对比表 + 5 级预告 + 三条须知 + 最终 CTA 完整显示
- [ ] `Start Your Oracle` 点击 → 切换到功能视图 Stage 1
- [ ] 5 级预告有小型粒子动画

### 功能视图 · Stage 1-4

- [ ] Stage 1 极简入口提示，3 条规则简化版
- [ ] Stage 2 输入框 60 字符限制，字符数实时显示
- [ ] 48 小时内相似问题触发劝退弹窗
- [ ] Stage 3 粒子加速 + hum 音效渐入
- [ ] Stage 4 长按 3 秒 → 爆炸
- [ ] 中途松开 → 计时重置

### 功能视图 · Stage 5-8（核心新设计）

- [ ] Stage 5 卡片**背面朝上**从爆炸中升起
- [ ] 卡片背面对应 5 级视觉独特（莲花/飞鸟/涟漪/交叉风/风暴眼）
- [ ] 同等级不同签号卡片有微妙差异（基于 seed）
- [ ] 3-5 秒后显示 `Tap to reveal` 提示
- [ ] 用户点击 → Stage 6 翻转（800ms，X 轴）
- [ ] 翻转中间有闪光效果
- [ ] Stage 7 正面内容**直接整体淡入**（无毛笔写入）
- [ ] 淡入时间 500ms + bell.mp3 钟响
- [ ] Stage 8 **三个独立按钮**：Full Reading / Save / Share
- [ ] 按钮图标清晰（📖 / 💾 / ⎋）

### 三按钮功能

- [ ] Full Reading → 卡片缩小到顶部 + 下方展开详细报告
- [ ] 完整报告含 6 段结构
- [ ] 完整报告**自动保存到 IndexedDB**（用户无需操作）
- [ ] 保存提示 `✓ This reading is saved to your Archive` 可见
- [ ] 完整报告底部 `Ask POJU to go deeper · $9.99` 跳 Stripe
- [ ] Save 按钮**只保存卡片背面**
  - 移动端：保存到相册
  - PC：下载到 Downloads 文件夹
- [ ] Share 按钮**只分享卡片背面**
  - 移动端：调用系统原生分享菜单
  - PC：复制图片到剪贴板
- [ ] 保存/分享图片尺寸 1080×1920 PNG
- [ ] 图片含 POJU 水印 + `pojulife.com`

### 5 级卡片视觉

- [ ] 5 套模板视觉差异清晰但克制（都在紫色家族）
- [ ] 每套卡片背面有独特中心图案
- [ ] 粒子边缘环动态流动
- [ ] Eye of Storm 使用 ◉ 符号（非星星）
- [ ] Eye of Storm 正面有额外副文字
- [ ] Divine Tailwind 有金色稀有装饰
- [ ] 签号种子引入同级微变化

### 概率分布

- [ ] 抽 100 次，5 级分布接近 5/25/40/25/5
- [ ] 代码层级分布可单元测试验证

### POJU 3 签联动

- [ ] 从 POJU Chat 召唤 Oracle 作为底部抽屉弹出
- [ ] **跳过主介绍视图**直接进入 Stage 1
- [ ] 3 签联动完整流程（Present → Past → Future → 合看）
- [ ] 每次抽签都有完整的 8 Stage 体验

### 其他

- [ ] 音效开关可静音整个流程
- [ ] 手机震动反馈工作
- [ ] PC 端鼠标长按也工作
- [ ] `prefers-reduced-motion` 时简化动画

---

## 关联资源

### 视觉参考

- `@docs/visual-reference/poju-visual-style-master.png`（参考 04 区块第 2 行 ORACLE）

### 相关文档

- `@.cursor/rules/05-visual-language.mdc` — Oracle 卡片视觉规范（5 级色系）
- `@docs/POJU_Development_Document_v3.0.1_Final.md` — 第 04 章 Oracle
- `@docs/pages/05-chat.md` — 从 POJU Chat 召唤的底部抽屉集成
- `@docs/pages/06-archive.md` — Oracle 条目展示

### 签诗静态库

- `/data/oracle-signs.json`（100 签，5 级分布）
- 签诗本土化为独立工作包（见主文档附录 B）

### 关键约束

- Oracle 的灵性主体称呼：**always** `ancient presence` / `listening presence`
- 禁用：goddess / deity / spirit / god / divine being
- 核心咒语：`A sincere heart opens the channel.`
- 答案形式：`a sign · a mysterious card`
- AI 角色：现代译者，不是 presence 本身
- **卡片背面可分享可保存，正面内容和解读报告必须私密**
- **完整报告自动保存**，用户无需手动操作
- **不做毛笔写入**，翻转后内容整体淡入
- **三按钮独立**：Full Reading / Save / Share 各司其职

---

✦
