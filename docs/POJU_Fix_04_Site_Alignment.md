# POJU 修复文档 #04 · 全站对齐 + Syncro 重写

> **背景**: 登录页已重新设计完美,但其他页面有遗漏的对齐问题
>
> **范围**:
> - 登录页 2 处微调(Card 3 + Card 4)
> - Glyph 页 3 处修复
> - Syncro 页 5 处修复(含场景重写)
> - 全站 Footer 品牌名升级
>
> **不动的**:
> - 登录页主体设计(已完美)
> - POJU 页(已合规且对齐)
> - 三件套卡片图片设计

---

## Phase 1: 登录页 2 处微调

### Task 1.1: Card 3 (Syncro) - 节奏频率措辞优化

```diff
- Syncro maps it, every two hours.
+ Syncro maps it, updated through your day.
```

理由:
- "every two hours" 太具体,与登录页其他卡片的【模糊化】调性不一致
- 之前 Glyph 已删除"60 seconds"
- Syncro 也应该相应模糊化时间频率
- "through your day" 暗示日常陪伴,更优雅

### Task 1.2: Card 4 (POJU) - 价格描述对齐

```diff
- POJU sits with you through it. $9.99. Once.
+ POJU sits with you through it — once, until you see through.
```

理由:
- 与板块 5 隐私承诺的【不写死价格】原则一致
- 后期可能调整定价,文案灵活
- "until you see through" 呼应 Card 1 的"see clearly"
- 节奏感更强

---

## Phase 2: Glyph 页修复

### Task 2.1: Hero 文案对齐 ⭐ 关键

```diff
- # Glyph
- A 60-second mirror.

+ # Glyph
+ A pocket-sized mirror.
```

理由:
- 登录页三件套卡片已改为 "A pocket-sized mirror"
- Glyph 页 Hero 必须与登录页一致
- 删除"60-second"承诺(实际需要 5-7 分钟)

### Task 2.2: 删除中文调试链接 ⭐ 必须

```diff
- ## Five winds — five archetypal patterns
- 
- The five patterns are mirrors, not predictions. Each one 
- describes a human situation and helps you frame what is 
- already happening.
- 
- [查看五张卡面](https://www.pojulife.com/five-wind-cards)（/five-wind-cards）

+ ## Five winds — five archetypal patterns
+ 
+ The five patterns are mirrors, not predictions. Each one 
+ describes a human situation and helps you frame what is 
+ already happening.
```

理由:
- "查看五张卡面" 是中文残留
- "(/five-wind-cards)" 是调试标注
- 不应出现在生产环境
- Fix 02 已要求删除,但 Cursor 漏了,本次必须修复

### Task 2.3: Footer 末句保持

```
当前: "For self-reflection and entertainment. POJU offers 
       perspectives, not predictions. All decisions are 
       yours alone."

期望: 改为针对 Glyph 的:
      "Read with a wink. The patterns mirror, they don't 
       predict. All decisions are yours alone."

(这是登录页 Glyph 卡片的呼应)
```

---

## Phase 3: Syncro 页重写

### Task 3.1: 修复 "Text me the link" 重复 3 次的 bug ⭐ 必须

当前 Hero 区域显示:

```
Text yourself the link
[Text me the link]
Text yourself the link
Text yourself the link
[Text me the link]
```

期望:

```
Text yourself the link
[Text me the link]
```

(只显示 1 次)

### Task 3.2: 重写"Where people use Syncro"板块 ⭐⭐⭐ 重点

#### 原因

当前的 5 个场景过于具体,有合规风险:

```
❌ "desk orientation that supports focus" - 暗示方位影响认知
❌ "seating orientation that supports confidence" - 风水暗示
❌ "sleeping directions" - 风水暗示
❌ "directional tone before heading out" - 出行方位玄学
❌ "spatial clarity" - 玄学

→ 这些会让支付审核员怀疑 Syncro 是【风水工具】
→ 必须改为更笼统、合规的描述
```

#### 新版本(完整替换)

```markdown
## Where Syncro fits.

A reflection tool for the in-between moments — when you 
want to check in with yourself before acting.

──────────────────────────────────

[场景 1]
Before something matters

When you have a conversation, a decision, or a meeting 
ahead. A quick check-in before you step in.

[场景 2]
When the pace feels off

When you're pushing but nothing's moving, or things feel 
frictionless but unfocused. A moment to recalibrate.

[场景 3]
As a daily rhythm

Some people open Syncro the way others check the weather — 
a small ritual, a way to notice themselves.

[场景 4]
When you're traveling

New environments, new timing. A way to stay grounded in 
your own rhythm wherever you are.

[场景 5]
As a POJU companion

Use Syncro between POJU sessions to notice how your 
situation evolves between deeper conversations.
```

#### 关键改动

```
✗ 删除所有【物理方位】描述:
  - "desk orientation"
  - "seating orientation"
  - "sleeping directions"
  - "directional tone"

✓ 替换为【内在状态】描述:
  - "check in with yourself"
  - "recalibrate"
  - "notice themselves"
  - "stay grounded"
  - "rhythm"

效果:
  Syncro 从【方位选择器】
  → 转变为【内在状态参考工具】
  
合规风险:
  从【中度】降到【极低】
```

### Task 3.3: "Always free" 段落措辞修复

```diff
- Syncro stays free as your everyday directional companion. 
- Open it whenever you need spatial clarity.

+ Syncro stays free as your everyday rhythm companion. 
+ Open it whenever you need clarity on the moment.
```

理由:
- "directional companion" 暗示风水
- "spatial clarity" 玄学
- Fix 02 文档已要求改,但 Cursor 漏了
- 本次必须修复

### Task 3.4: 板块标题"Always free. Forever." 简化

```diff
- ## Always free. Forever.
+ ## Always free.
```

理由:
- "Forever" 暗示绝对承诺,过于绝对
- 简洁更优雅
- 与登录页"Free tools / Paid tools"灵活措辞一致

### Task 3.5: "What it is. What it isn't."优化

当前已经 OK,但建议小调整:

```diff
- ## What it is. What it isn't.
- 
- What it shows
- ✦ Current rhythm pattern for the next 2 hours
- ✦ Eight directions with what they suit
- ✦ Where to lean in, where to slow down
- 
- What it isn't
- ✗ A predictor of events
- ✗ A promiser of outcomes
- ✗ A replacement for your own judgment

+ ## What it is. What it isn't.
+ 
+ What it shows
+ ✦ The rhythm pattern of the moment
+ ✦ Eight directions with what they suit
+ ✦ Where to lean in, where to slow down
+ 
+ What it isn't
+ ✗ A predictor of events
+ ✗ A promiser of outcomes
+ ✗ A replacement for your own judgment
```

理由:
- "next 2 hours" 太具体,与登录页措辞调整一致
- "rhythm pattern of the moment" 更优雅

---

## Phase 4: 全站品牌升级

### Task 4.1: Footer 显示更新

所有页面的 Footer 需要修改:

```diff
- POJU
- pojulife.com
- 
- ...links...
- 
- © 2026 POJU. All rights reserved.

+ pojulife
+ pojulife.com
+ 
+ ...links...
+ 
+ © 2026 pojulife. All rights reserved.
```

注意:
- "POJU" → "pojulife" (品牌名升级)
- 全小写 (优雅的现代品牌命名风格)
- 不要写成"PojuLife" 或 "POJU LIFE"

### Task 4.2: Header Logo 更新

```diff
- ![POJU LIFE]  POJU LIFE  (大写)
+ ![pojulife]  pojulife  (小写,品牌字体)
```

参考登录页 Hero 的 "Poju Life" 显示风格。

注意:
- Logo 文字: "pojulife"(全小写)
- 旁边的图片 logo 不变

### Task 4.3: Metadata 更新

```diff
- title: POJU
- meta-description: Ancient Eastern Wisdom...

+ title: pojulife
+ meta-description: Where AI meets a thousand years of wisdom. 
+   Decision support for the questions that won't let you go.
```

理由:
- title 是浏览器标签显示的
- 应该是品牌名 "pojulife"
- description 也升级为更现代的合规版本

---

## Phase 5: Footer 末句各页面差异化

不同页面 Footer 末句应该有差异化(已在 Fix 02 提过,但仍有遗漏):

### 登录页 Footer

```
For self-reflection and entertainment. pojulife offers 
perspectives, not predictions. All decisions are yours alone.
```

### POJU 页 Footer

```
POJU is a thinking partner. It offers perspectives, not 
prophecies. All decisions are yours alone.
```

### Glyph 页 Footer

```
Read with a wink. The patterns mirror, they don't predict. 
All decisions are yours alone.
```

### Syncro 页 Footer (已对)

```
Syncro is a self-awareness tool. Take what resonates. 
Decisions are yours alone.
```

### 法律页面 Footer

```
For self-reflection and entertainment. pojulife offers 
perspectives, not predictions. All decisions are yours alone.
```

---

## 给 Cursor 的执行指令

```markdown
# 任务: POJU Fix 04 - 全站对齐 + Syncro 场景重写

## 阅读
@docs/POJU_Fix_04_Site_Alignment.md (本文档)

## 实施顺序

### Phase 1: 登录页微调 (10 分钟)

Task 1.1: Card 3 (Syncro)
  - "Syncro maps it, every two hours." 
  → "Syncro maps it, updated through your day."

Task 1.2: Card 4 (POJU)
  - "POJU sits with you through it. $9.99. Once."
  → "POJU sits with you through it — once, until you see through."

### Phase 2: Glyph 页修复 (15 分钟)

Task 2.1: Hero 文案
  - "A 60-second mirror" → "A pocket-sized mirror"

Task 2.2: 删除"查看五张卡面"中文调试链接

Task 2.3: Footer 末句改为 Glyph 版本

### Phase 3: Syncro 页重写 (1 小时)

Task 3.1: 修复 "Text me the link" 重复 3 次的 bug
Task 3.2: 重写"Where people use Syncro"板块(完整替换)
Task 3.3: "directional companion" → "rhythm companion"
        "spatial clarity" → "clarity on the moment"
Task 3.4: "Always free. Forever." → "Always free."
Task 3.5: "What it is" 中"next 2 hours" → "of the moment"

### Phase 4: 全站品牌升级 (30 分钟)

Task 4.1: 所有 Footer 中:
  - "POJU" → "pojulife"
  - "© 2026 POJU" → "© 2026 pojulife"

Task 4.2: 所有 Header Logo:
  - "POJU LIFE" → "pojulife"

Task 4.3: 所有页面 metadata:
  - title: "POJU" → "pojulife"
  - description 更新

### Phase 5: Footer 末句差异化

按本文档 Phase 5 内容,确保 5 类页面 Footer 末句正确。

## 严格要求

🚫 不要修改登录页主体设计(已完美)
🚫 不要修改 POJU 页"How POJU works"UI(用户保留)
🚫 不要修改 Glyph 页 Five Winds 5 张卡片 UI
🚫 不要在 Syncro 场景中保留"orientation/direction/spatial"等风水暗示词

✅ 严格按 diff 执行
✅ Syncro 场景【完整替换】(不要部分保留)
✅ 完成后截图验证

## 验证清单

完成后必须检查:

登录页:
  □ Card 3 不再是"every two hours"
  □ Card 4 不再是"$9.99. Once."

Glyph 页:
  □ Hero 是"A pocket-sized mirror"
  □ "查看五张卡面"已删除
  □ Footer 末句是 Glyph 版本

Syncro 页:
  □ "Text me the link" 只出现 1 次
  □ Where people use 板块完整替换
  □ 不再出现"directional companion"
  □ 不再出现"spatial clarity"
  □ "Always free. Forever." → "Always free."

全站:
  □ Footer 显示 "pojulife"(小写)
  □ Header Logo 显示 "pojulife"
  □ Metadata title 是 "pojulife"
```

---

## 完成后的网站状态

```
✅ 登录页:完美对齐
✅ POJU 页:无需大改(本来就好)
✅ Glyph 页:全部对齐
✅ Syncro 页:重大改进(场景合规化)
✅ Footer:全站品牌升级一致

合规风险:
  从【中度】(主要因 Syncro 场景)
  降到【极低】(场景重写后)

可以申请:
  ✓ DodoPayments
  ✓ Stripe(后期)
  ✓ 任何其他支付网关
```
