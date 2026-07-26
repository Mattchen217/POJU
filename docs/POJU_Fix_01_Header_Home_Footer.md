# POJU 修复文档 #1 · 全站导航 + 首页文本 + Footer

> **本文档是 4 份修复文档的第 1 份**
>
> **范围**:全站导航栏、首页文本、全站 Footer
> **不动的**:首页所有 UI 设计(布局、配色、图标、卡片样式等)
> **只改**:文本内容
>
> **使用方式**:把本文档发给 Cursor,它会逐项执行修改。

---

## 任务清单

```
□ Task 1: 修改全站导航栏(所有页面共用的 Header 组件)
□ Task 2: 修改 Hero 区域文本
□ Task 3: 修改 "Three pillars" 区域(ANCIENT / MODERN / AI AGENT / YOU)
□ Task 4: 修改 "What Eastern traditions observed..." 区域
□ Task 5: 修改 "QI · XUAN · BAZI · YUAN" 这一行
□ Task 6: 修改 "Three promises" 区域文本
□ Task 7: 修改全站 Footer 文本
□ Task 8: 修改语言切换器
```

**严格要求**:
- ✅ 只改文本,不改 UI 布局、间距、配色、图标
- ✅ 保持原有的视觉层次和动效
- ✅ 每处改动都按下方 diff 格式精确执行

---

## Task 1: 修改全站导航栏

### 当前导航
```
POJU 破局  |  POJU SYNCRO  |  POJU GLYPH  |  THE ARCHIVE
```

### 修改后导航
```
POJU  |  Glyph  |  Syncro  |  Archive
```

### 具体修改

找到导航组件(可能位于 `components/layout/Header.tsx` 或类似文件):

```diff
- <Link href="/poju">POJU 破局</Link>
+ <Link href="/poju">POJU</Link>

- <Link href="/syncro">POJU SYNCRO</Link>
+ <Link href="/syncro">Syncro</Link>

- <Link href="/glyph">POJU GLYPH</Link>
+ <Link href="/glyph">Glyph</Link>

- <Link href="/archive">THE ARCHIVE</Link>
+ <Link href="/archive">Archive</Link>
```

### 重要说明
- ❌ **不要在英文用户的导航中保留任何中文**(包括"破局")
- ✅ 标题大小写规范:首字母大写,其余小写(不要全大写)
- ✅ 每个名字前**不重复 POJU 前缀**(因为左侧已有 POJU Logo)
- ✅ 顺序按重要性:**POJU(主) → Glyph(免费引流) → Syncro(辅助) → Archive(用户中心)**

---

## Task 2: 修改 Hero 区域文本

### 区域位置
首页第一屏,标题"POJU"下方。

### 当前文本

```
# POJU
Where AI meets a thousand years of wisdom.

When one question keeps circling back, POJU sits with you 
through it. Backed by AI. Grounded in millennia of human 
reflection.

[Start a POJU session · $9.99]  [Try Glyph · Free]

No account · No subscription · Decisions are yours alone
```

### 评估
✅ 这部分文本基本完美,**不需要修改**。
- "Where AI meets a thousand years of wisdom" = 完美的双锚定
- "Decisions are yours alone" = 合规免责
- 整体调性符合 Co-Star 风格

### 唯一可能的微调(可选)

```diff
- No account · No subscription · Decisions are yours alone
+ No account · No subscription · Yours to decide
```

理由:"Yours to decide" 比 "Decisions are yours alone" 更简短、更有力。

**如果你已满意现版本,跳过此 diff,保持原样。**

---

## Task 3: 修改 "ANCIENT / MODERN / AI AGENT / YOU" 区域

### 区域位置
Hero 下方,标题"Where two truths meet"那一段。

### 当前文本

```
Where two truths meet.

✦ ANCIENT
Two thousand years of Eastern observation: 
Daoism · Feng Shui · Bazi · Yi Jing

✦ MODERN
Reinforced by science: magnetic fields · spatial cognition · 
circadian rhythms · environmental psych

✦ AI AGENT
Translated by an intelligence trained on both — 
into what you can do, today.

✦ YOU
Your birth chart. Your direction. Your question. 
Your this exact moment.
```

### 修改后文本

```
Where two truths meet.

✦ ANCIENT
Two thousand years of human reflection on patterns, 
timing, and direction.

✦ MODERN
Reinforced by research: cognitive science · spatial 
psychology · circadian biology · decision research.

✦ AI AGENT
Translated by an intelligence trained on both — into 
what you can do, today.

✦ YOU
Your birth context. Your moment. Your question. 
Your next step.
```

### 修改要点(给 Cursor)

**ANCIENT 段**:
```diff
- Two thousand years of Eastern observation: 
- Daoism · Feng Shui · Bazi · Yi Jing
+ Two thousand years of human reflection on patterns, 
+ timing, and direction.
```

**为什么这样改**:
- ❌ "Feng Shui" 是 DodoPayments 高风险词
- ❌ "Bazi" 是高风险词
- ❌ 直接列出 4 个具体术语 = 用户/审核员立即归类为"占卜"
- ✅ 改为抽象的"patterns, timing, direction" = 保留东方智慧的气质,但去除占卜暗示
- ✅ "human reflection" 比 "Eastern observation" 更普世

**MODERN 段**:
```diff
- Reinforced by science: magnetic fields · spatial cognition · 
- circadian rhythms · environmental psych
+ Reinforced by research: cognitive science · spatial 
+ psychology · circadian biology · decision research.
```

**为什么这样改**:
- "magnetic fields"听起来神秘 → 改为"cognitive science"更学术
- "environmental psych"是缩写 → 改为"decision research"更直接、更与产品相关

**YOU 段**:
```diff
- Your birth chart. Your direction. Your question. 
- Your this exact moment.
+ Your birth context. Your moment. Your question. 
+ Your next step.
```

**为什么这样改**:
- ❌ "Birth chart" 是占星术语 → 改为 "birth context" 中性
- ❌ "Your this exact moment" 语法别扭 → 改为简洁的 "Your moment"
- ✅ "Your next step" 强化产品价值(可执行的下一步)

---

## Task 4: 修改 "What Eastern traditions observed..." 区域

### 区域位置
"Where two truths meet" 下方的科学引用区。

### 当前文本

```
## What Eastern traditions observed, 
   science is beginning to measure.

### Magnetic fields affect cognition
Geomagnetic cues subtly shape spatial judgement and neural 
processing—effects Eastern traditions long linked to 
polarity, direction, and auspicious alignment.
[COGNITIVE NEUROSCIENCE / 2024]

### Spatial orientation shapes decisions
Layout, openness, and sightlines change what we notice and 
how we weigh risk—echoing classical ideas of form, flow, 
and supportive environments.
[ENVIRONMENTAL PSYCHOLOGY / 2019]

### Circadian cycles drive biology
Light–dark timing steadies hormones, mood, and focus—
mirroring traditional emphasis on seasons, cycles, and 
choosing the right moment to act.
[CHRONOBIOLOGY REVIEW / 2022]

### Visual direction influences focus
Where the gaze rests and what frames the view can steady 
or fragment attention—parallel to ideas of clear sightlines 
and unobstructed qi.
[VISUAL COGNITION / 2021]
```

### 修改后文本

```
## What ancient observation noticed, 
   modern research is beginning to measure.

### Magnetic fields affect cognition
Geomagnetic cues subtly shape spatial judgment and neural 
processing — effects ancient traditions long linked to 
direction and alignment.

### Spatial orientation shapes decisions
Layout, openness, and sightlines change what we notice and 
how we weigh risk — echoing classical ideas of form, flow, 
and supportive environments.

### Circadian cycles drive biology
Light–dark timing steadies hormones, mood, and focus — 
mirroring traditional emphasis on seasons, cycles, and 
choosing the right moment to act.

### Visual direction influences focus
Where the gaze rests and what frames the view can steady 
or fragment attention — parallel to ideas of clear 
sightlines and unobstructed flow.
```

### 修改要点(给 Cursor)

**主标题**:
```diff
- ## What Eastern traditions observed, 
-    science is beginning to measure.
+ ## What ancient observation noticed, 
+    modern research is beginning to measure.
```

**为什么**:
- ❌ "Eastern traditions" 太具体 → 改为 "ancient observation" 更普世
- ❌ "science" 听起来宏大 → 改为 "modern research" 更克制

**第 1 段**:
```diff
- effects Eastern traditions long linked to 
- polarity, direction, and auspicious alignment.
+ effects ancient traditions long linked to 
+ direction and alignment.
```

**为什么**:
- ❌ "auspicious"(吉祥的)是占卜暗示词 → 删除
- ❌ "polarity" 太玄学 → 删除

**第 4 段**:
```diff
- parallel to ideas of clear sightlines 
- and unobstructed qi.
+ parallel to ideas of clear sightlines 
+ and unobstructed flow.
```

**为什么**:
- ❌ "qi"(气)是中文术语,在英文界面=占卜暗示 → 改为 "flow"
- ✅ "flow" 在英文里是合规的(类似 "flow state" 心理学概念)

**关于 4 个引用标签的处理**:
```diff
- [COGNITIVE NEUROSCIENCE / 2024]
- [ENVIRONMENTAL PSYCHOLOGY / 2019]
- [CHRONOBIOLOGY REVIEW / 2022]
- [VISUAL COGNITION / 2021]
+ [完全删除这 4 个伪引用标签]
```

**为什么必须删除**:
- ❌ 这些"研究引用"没有作者、没有 DOI、没有真实链接
- ❌ 看起来像权威背书,但用户搜不到 = 失信
- ❌ 是营销造假风险,Co-Star 引用 NASA 是因为 NASA 真实可验证
- ✅ 直接用文字描述就行,不需要假装有"权威研究背书"

---

## Task 5: 修改 "QI · XUAN · BAZI · YUAN" 这一行

### 区域位置
"What Eastern traditions observed..." 区域底部。

### 当前文本

```
Eastern traditions named these forces two thousand years ago.

QI · XUAN · BAZI · YUAN

POJU uses AI to translate both languages into something 
you can act on — today.
```

### 修改后文本

```
Ancient traditions named these patterns long before science 
could measure them.

RHYTHM · DIRECTION · TIMING · CONNECTION

POJU uses AI to translate both languages into something 
you can act on — today.
```

### 修改要点(给 Cursor)

```diff
- Eastern traditions named these forces two thousand years ago.
- 
- QI · XUAN · BAZI · YUAN
+ Ancient traditions named these patterns long before science 
+ could measure them.
+ 
+ RHYTHM · DIRECTION · TIMING · CONNECTION
```

**为什么这样改**:
- ❌ **"QI · XUAN · BAZI · YUAN" 是 4 个直白的占卜术语暴露**
  - QI(气) - 气功/中医/玄学术语
  - XUAN(玄) - 玄学
  - BAZI(八字) - 命理学
  - YUAN(缘) - 缘分,玄学
- ❌ 任何一个支付审核员看到这行,就会立即把网站归类为"fortune-telling"
- ✅ "RHYTHM · DIRECTION · TIMING · CONNECTION" 是抽象的概念词
  - 完全没有占卜暗示
  - 同时保留了"古老智慧 + 现代科学"双锚定
  - 用户读起来仍然有质感

**关于"forces"vs"patterns"**:
- "forces" 听起来玄学 → 改为 "patterns" 更中性、更工具化

---

## Task 6: 修改 "Three promises" 区域

### 区域位置
首页 "Three promises we don't break" 区域。

### 当前文本(基本合规,只做小调整)

```
## Three promises we don't break.

Never stored
Your conversations live only on your device. We encrypt 
them locally. We cannot read them. No one can.

Never required
No account. No login. No password. No email, unless you 
want your reading as a PDF.

Never manipulative
No dark patterns. No fake urgency. No "limited time." 
No upsells. One price: $9.99 when you need it.
```

### 评估

✅ **这部分基本完美,只需小调整**:

```diff
- Never stored
+ Never stored

- No account. No login. No password. No email, unless you 
- want your reading as a PDF.
+ No account. No login. No password. No email, unless you 
+ want your session as a PDF.
```

**为什么改这一处**:
- "reading" 在英文里可以指占卜师的"看牌"
- "session" 更中性、更专业
- 保持网站对"session"这个词的统一使用

---

## Task 7: 修改全站 Footer 文本

### 区域位置
所有页面的页脚。

### 当前 Footer

```
POJU
easternos.com

[Home] [Disclaimer] [Privacy Policy] [Terms of Service] [Contact]

© 2026 POJU. All rights reserved.

For reflection and entertainment. POJU does not predict 
outcomes or replace professional advice.
```

### 修改后 Footer

```
POJU
easternos.com

[Home] [Disclaimer] [Privacy Policy] [Terms of Service] [Contact]

© 2026 POJU. All rights reserved.

For self-reflection and entertainment. POJU offers 
perspectives, not predictions. All decisions are yours alone.
```

### 修改要点

```diff
- For reflection and entertainment. POJU does not predict 
- outcomes or replace professional advice.
+ For self-reflection and entertainment. POJU offers 
+ perspectives, not predictions. All decisions are yours alone.
```

**为什么这样改**:
- ✅ 增加 "self-" 前缀让"reflection"更明确(避免歧义为"占卜性反映")
- ✅ "offers perspectives, not predictions" 是 Co-Star 验证过的合规公式
- ✅ "All decisions are yours alone" 强化用户责任声明
- ✅ 整体读起来更优雅、更有品质感

### 关于不同页面 Footer 的差异化

我注意到不同页面 Footer 已经有差异化(对应不同产品)。**保留这种差异化**,但每个版本都按上述风格优化:

**首页 Footer 末句**:
```
For self-reflection and entertainment. POJU offers 
perspectives, not predictions. All decisions are yours alone.
```

**POJU 页 Footer 末句**:
```
POJU is a thinking partner. It offers perspectives, 
not prophecies. All decisions are yours alone.
```
✅ 这个版本已经合规,**不需要改**。

**Glyph 页 Footer 末句**:
```
For reflection and entertainment. POJU does not predict 
outcomes or replace professional advice.
```
改为:
```
Read with a wink. The patterns mirror, they don't predict. 
All decisions are yours alone.
```

**Syncro 页 Footer 末句**:
```
Syncro is a self-awareness tool. Take what resonates. 
Decisions are yours alone.
```
✅ 这个版本已经合规,**不需要改**。

---

## Task 8: 修改语言切换器

### 当前

```
LangEN▾
```

### 评估

⚠️ **如果你目前只支持英文**,**直接删除整个语言切换器**:

```diff
- <LanguageSwitcher /> 或 <Lang>EN▾</Lang>
+ [完全删除]
```

**为什么**:
- 用户看到 "LangEN▾" 会以为有其他语言可选
- 点击后如果只显示一个 EN 选项 = 体验差
- **早期阶段只做英文,删除这个组件最干净**

如果你确定要保留中文版本,告诉我,我会写一份中文版的合规文案。

---

## 给 Cursor 的执行指令(最终)

把以下指令发给 Cursor:

```markdown
# 任务: 实施 POJU 修复文档 #1

## 阅读
@docs/POJU_Fix_01_Header_Home_Footer.md

## 实施顺序

1. **Task 1: 全站导航栏**
   - 修改 Header 组件
   - "POJU 破局" → "POJU"
   - "POJU SYNCRO" → "Syncro"
   - "POJU GLYPH" → "Glyph"
   - "THE ARCHIVE" → "Archive"

2. **Task 2: Hero 文本**
   - 评估后建议保持原样(已合规)

3. **Task 3: ANCIENT / MODERN / AI AGENT / YOU 区域**
   - 按文档的 diff 修改 4 个段落

4. **Task 4: "What Eastern traditions observed..." 区域**
   - 主标题改为"ancient observation"
   - 第 1 段删除"polarity"、"auspicious"
   - 第 4 段"qi" → "flow"
   - 删除 4 个伪研究引用标签

5. **Task 5: "QI · XUAN · BAZI · YUAN" 这行**
   - 整行改为 "RHYTHM · DIRECTION · TIMING · CONNECTION"
   - 上面那行 "forces" → "patterns"

6. **Task 6: Three promises**
   - "reading" → "session" (一处)

7. **Task 7: Footer**
   - 首页 Footer 末句更新
   - Glyph 页 Footer 末句更新
   - POJU 页 Footer 已合规,不动
   - Syncro 页 Footer 已合规,不动

8. **Task 8: 语言切换器**
   - 删除(如果当前只支持英文)

## 严格要求

🚫 不要修改任何 UI 布局、间距、配色
🚫 不要修改任何动效、过渡、hover 效果
🚫 不要重新组织区域顺序
🚫 不要改 Tailwind class

✅ 只改纯文本内容
✅ 严格按 diff 执行
✅ 完成后给我截图验证

## 验证

完成后必须验证:
- [ ] 导航栏只有"POJU | Glyph | Syncro | Archive"
- [ ] 首页搜索 "Feng Shui / Bazi / QI / XUAN / YUAN" 应为 0 结果
- [ ] 首页搜索 "qi" / "auspicious" / "polarity" 应为 0 结果
- [ ] 4 个伪引用标签已删除
- [ ] Footer 4 个变体都已合规
- [ ] 语言切换器已处理
```

---

## 完成后的影响评估

```
P0 风险词清除情况:
  ✓ 导航栏中文 "破局" 已删除
  ✓ Hero 区 "Feng Shui" 已删除
  ✓ Hero 区 "Bazi" 已删除
  ✓ "QI · XUAN · BAZI · YUAN" 已替换
  ✓ "qi" 已替换为 "flow"
  ✓ "auspicious" 已删除
  ✓ "polarity" 已删除

支付审核风险评估:
  原状态: ❌ 高风险(直接占卜术语暴露)
  修改后: ✅ 低风险(可通过 DodoPayments 审核)

视觉品牌风险评估:
  ✓ UI 完全保持原样
  ✓ 设计感不变
  ✓ Co-Star 双锚定调性强化
  ✓ 神秘感保留
```

---

## 下一份文档预告

```
#2 - POJU 主产品页文本修改
   - "Glyph vs POJU" 区域文本
   - "When to come to POJU" 区域文本
   - "Why POJU is different" 表格优化
   - 不动 "How POJU works" UI(你要保留的)

#3 - Glyph 介绍页 + Syncro 介绍页文本修改
   - Glyph 页除 "Five Winds" UI 外的所有文本
   - Syncro 页"Eastern side"对照表必须改
   - Syncro 的 "GANZHI · BAGUA · WUXING · KANYU" 必须改

#4 - 法律页面填充
   - Disclaimer 完整内容
   - Terms of Service 完整内容
   - Privacy Policy 修复占位符
   - Contact 页面建立
```

---

**第 1 份完成。等你确认 Cursor 执行后,告诉我可以开始第 2 份。**
