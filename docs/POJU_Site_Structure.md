# POJU 网站信息架构与页面内容清单

> **目的**：本文档列出 POJU 所有页面、每页包含的内容区块、按钮、交互行为。
>
> **不包含**：视觉风格、颜色、字体、动画细节（这些在 `05-visual-language.mdc` 和视觉参考图里）。
>
> **读者**：Cursor（开发时对照）+ 产品复盘。

---

## 目录

- [网站路由地图](#1-网站路由地图)
- [全局组件](#2-全局组件)
- [页面 · 主落地页 /](#3-页面--主落地页-)
- [页面 · POJU 产品页 /poju](#4-页面--poju-产品页-poju)
- [页面 · Syncro 产品页 /syncro](#5-页面--syncro-产品页-syncro)
- [页面 · Oracle 产品页 /oracle](#6-页面--oracle-产品页-oracle)
- [页面 · POJU Chat /chat](#7-页面--poju-chat-chat)
- [页面 · The Archive /archive](#8-页面--the-archive-archive)
- [页面 · 免责声明 /disclaimer](#9-页面--免责声明-disclaimer)
- [页面 · 隐私政策 /privacy](#10-页面--隐私政策-privacy)
- [页面 · 服务条款 /terms](#11-页面--服务条款-terms)
- [页面 · 联系我们 /contact](#12-页面--联系我们-contact)
- [页面 · 取消订阅 /unsubscribe](#13-页面--取消订阅-unsubscribe)
- [页面 · 支付成功回跳 /chat?token=](#14-页面--支付成功回跳-chattoken)
- [页面 · 支付失败回跳 /?cancelled=true](#15-页面--支付失败回跳-cancelledtrue)
- [状态 · 404 错误页](#16-状态--404-错误页)
- [状态 · 500 错误页](#17-状态--500-错误页)
- [弹窗 · 免责协议首次确认](#18-弹窗--免责协议首次确认)
- [弹窗 · PWA 添加到主屏幕引导](#19-弹窗--pwa-添加到主屏幕引导)
- [弹窗 · 付款后首次进入 Chat 提示](#20-弹窗--付款后首次进入-chat-提示)

---

## 1. 网站路由地图

```
pojulife.com
│
├─ /                           主落地页（Hero + 三产品 + 科学 + 隐私）
│
├─ /poju                       POJU 产品深度介绍页
│   └─ /chat                   付费后的对话页面（需要 Session Token）
│
├─ /syncro                     Syncro 产品页
│                              · PC 端：介绍 + 扫码引导
│                              · 移动端：完整 Syncro 体验
│
├─ /oracle                     Oracle 产品页
│                              · PC + 移动端都完整可用
│
├─ /archive                    The Archive（个人档案馆，本地数据）
│
├─ /disclaimer                 免责声明完整版
├─ /privacy                    隐私政策
├─ /terms                      服务条款
├─ /contact                    联系我们
├─ /unsubscribe                取消邮件订阅（带 token）
│
└─ （状态页）
    ├─ /404                    页面未找到
    └─ /500                    服务器错误
```

---

## 2. 全局组件

这些组件出现在**所有页面**（除了支付成功/失败回跳等临时状态页）。

### 2.1 顶部导航栏（Desktop ≥1024px）

左侧：
- POJU Logo（字母 + 紫色球图标）
- 点击 → 跳回 `/`

中部（水平排列）：
- POJU（链接到 `/poju`）
- SYNCRO（链接到 `/syncro`）
- ORACLE（链接到 `/oracle`）
- THE ARCHIVE（链接到 `/archive`）

右侧：
- `Get Started` 按钮（主 CTA，链接到 `/poju` 或直接触发 `$9.99` 支付流）

### 2.2 顶部导航栏（Mobile <1024px）

左侧：
- POJU Logo

右侧：
- 汉堡菜单按钮 `≡`

点击汉堡 → 侧滑抽屉出现，包含：
- POJU
- SYNCRO
- ORACLE
- The Archive
- 分隔线
- Disclaimer
- Privacy
- Terms
- Contact
- 关闭按钮 `×`

### 2.3 PWA standalone 模式（用户已"添加到主屏幕"）

底部 Tab 导航（替代顶部菜单）：
- Home（`⌂`）→ `/`
- POJU → `/poju` 或 `/chat`（如有进行中的 Session）
- Syncro → `/syncro`
- Oracle → `/oracle`
- Archive（`✦`）→ `/archive`

当前 Tab 下方有紫色小圆点指示。

### 2.4 页脚（Footer）

所有公开页面底部都有，包含：

- POJU Logo（纯字母版）
- 副标题：`pojulife.com`
- 分隔线
- Legal 链接组：
  - Disclaimer
  - Privacy Policy
  - Terms of Service
- Support 链接组：
  - Contact
- 分隔线
- 版权声明：`© 2026 POJU. All rights reserved.`
- 免责声明短句：`Not medical, legal, or financial advice. Consult licensed professionals for those matters.`

移动端：Legal 和 Support 折叠为手风琴，默认关闭。

---

## 3. 页面 · 主落地页 `/`

这是用户从搜索/推荐/广告进入的第一屏。目标：10 秒内让用户理解产品 + 识别自己是否是目标用户。

### 3.1 Hero 区（Screen 1）

- POJU Logo（大尺寸居中或左对齐，视布局）
- 主标题：`Ancient Wisdom, AI-Powered. Made for You.`
- 副标题（一段描述）：`POJU is an AI Agent that combines timeless Eastern wisdom with modern science to help you break through life's challenges.`
- **主 CTA 按钮**：`Start with POJU`（点击 → 跳转 `/poju` 或触发 `$9.99` 支付）
- **副 CTA 按钮**：`Explore Tools`（点击 → 滚动到 Screen 3 三产品入口）
- 右侧（Desktop）或下方（Mobile）：星云粒子光圈动画

### 3.2 三产品入口（Screen 2 或并在 Screen 3）

标题：`Three ways in. One way through.`

三张卡片横向排列（Desktop）或纵向堆叠（Mobile），顺序：**Syncro · POJU · Oracle**（POJU 在中间最显眼）

**POJU 卡片**：
- 图标：紫色圆形
- 标题：`POJU`
- 副标题：`Breakthrough Q&A`
- 描述：`Deep analysis, actionable plans, real results.`
- 标价：`$9.99`
- 按钮：`Learn more →`（跳 `/poju`）

**Syncro 卡片**：
- 图标：青色菱形罗盘
- 标题：`SYNCRO`
- 副标题：`Energy Field`
- 描述：`Analyze spatial energy using Bazi, location and time.`
- 标签：`Free`
- 按钮：`Open Syncro →`（跳 `/syncro`）

**Oracle 卡片**：
- 图标：粉紫色菱形卡
- 标题：`ORACLE`
- 副标题：`Ancient Guidance`
- 描述：`Draw cards for timeless insights and inspiration.`
- 标签：`Free`
- 按钮：`Open Oracle →`（跳 `/oracle`）

### 3.3 品牌承诺条（Screen 3）

三列横向排列（Desktop）或纵向（Mobile）：

- 图标 + `No Sign Up` + 说明：`We don't require an account or personal info.`
- 图标 + `Privacy First` + 说明：`All data stays only on your device.`
- 图标 + `Yours Only` + 说明：`Your sessions, your answers, your control.`

### 3.4 品牌叙事区（Screen 4 · Four Elements）

标题：`Where two truths meet.`

四段文字，每段有分隔线：

**✦ ANCIENT**
Two thousand years of Eastern observation: Daoism · Feng Shui · Bazi · Yi Jing

**✦ MODERN**
Reinforced by science: magnetic fields · spatial cognition · circadian rhythms · environmental psych

**✦ AI AGENT**
Translated by an intelligence trained on both — into what you can do, today.

**✦ YOU**
Your birth chart. Your direction. Your question. Your this exact moment.

### 3.5 科学锚点区（Screen 5）

标题：`What Eastern traditions observed, science is beginning to measure.`

四条研究引用（占位 - 上线前需律师审核真实研究）：

- ✦ Magnetic fields affect cognition — [Journal / Year]
- ✦ Spatial orientation shapes decisions — [Journal / Year]
- ✦ Circadian cycles drive biology — [Journal / Year]
- ✦ Visual direction influences focus — [Journal / Year]

下方桥梁段：
```
Eastern traditions named these forces two thousand years ago.

        QI · XUAN · BAZI · YUAN

POJU uses AI to translate both languages into something 
you can act on — today.
```

### 3.6 Three Nevers 区（Screen 6）

标题：`Three promises we don't break.`

三段内容：

**✦ Never stored**
Your conversations live only on your device. We encrypt them locally. We cannot read them. No one can.

**✦ Never required**
No account. No login. No password. No email, unless you want your reading as a PDF.

**✦ Never manipulative**
No dark patterns. No fake urgency. No "limited time." No upsells. One price: $9.99 when you need it.

### 3.7 How We Protect You 区（Screen 7）

这一屏是 **Three Nevers 的"技术实现证明"**。Three Nevers 讲承诺（我们不做什么），本屏讲机制（我们如何做到）。

标题：`How we actually keep our word.`

副标题：`Privacy isn't a checkbox. It's our architecture.`

**四组内容**（每组结构：✦ 图标 + 粗体标题 + 技术描述段落 + "Verify it yourself" 小字验证说明）：

---

**✦ Your conversations are encrypted on your device.**

Not "secured on our servers." Encrypted with AES-256-GCM right in your browser, using a key we never see. Even if our servers were breached, there is nothing to steal.

*Verify it yourself: open DevTools → Application → IndexedDB. You'll see encrypted gibberish, not your words.*

---

**✦ We have no account system.**

No email at signup. No password. No phone number. No Google/Apple login. Your device fingerprint is your only ID — a one-way hash we use to restore your paid session, nothing else.

*Verify it yourself: nothing to sign up for. Try the free tools right now.*

---

**✦ Your email is forbidden from living on our servers.**

If you export your reading as PDF, we ask for your email. We send the PDF. Then we delete your address within 24 hours — physically erased from the database. Even we can't reach you after that.

*Your control: one-click unsubscribe. Auto-delete everywhere.*

---

**✦ Anthropic's Zero Data Retention is enabled.**

Your conversations go through Claude, but Anthropic doesn't save them, doesn't train on them, and doesn't let humans review them. We pay extra specifically for this guarantee.

*Verify it yourself: Anthropic's Zero Data Retention policy is public.*

---

**底部补充段落**：

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

### 3.8 最终 CTA（Screen 8）

标题：`Ready to break through?`

副标题：`One question. $9.99. Delivered in one conversation.`

按钮：`Ask Your Question →`（触发 `$9.99` 支付）

### 3.9 Footer（见 2.4）

---

### 落地页三层隐私叙事结构

落地页中隐私相关内容形成三层递进结构，不要合并：

| 位置 | 层次 | 目的 |
|---|---|---|
| Screen 3 · 品牌承诺条 | **标签层** | 快速扫过时能记住（No Sign Up / Privacy First / Yours Only） |
| Screen 6 · Three Nevers | **承诺层** | 情感记忆（不做什么） |
| Screen 7 · How We Protect You | **实现层** | 技术说服（如何做到） |

三层合起来形成：**扫一眼记住 → 细读被打动 → 深读愿意相信**。

---

## 4. 页面 · POJU 产品页 `/poju`

独立的 POJU 深度介绍页。

### 4.1 顶部 Hero

- 大标题：`Break your deadlock.`
- 副标题：`Guided by 2,000 years of Eastern wisdom, reinforced by modern science, delivered by an AI Agent that walks with you.`
- 按钮：`Ask your question — $9.99`
- 副按钮：`See how it works ↓`（滚动到下一区）

### 4.2 "When to come to POJU"（典型场景）

标题：`When to come to POJU`

5 个场景列表（每个带 ✦ 符号 + 标题 + 副描述）：

- **✦ You're stuck between two paths**
  career change, relationship decision, relocation

- **✦ You've done your research and you're more confused**
  conflicting advice, family pressure, ticking clock

- **✦ Something keeps repeating and you don't know why**
  same kind of relationship, same setbacks, same blocks

- **✦ You need depth that friends can't give**
  no one around you has the distance to see clearly

- **✦ You want direction, not prediction**
  "will X happen" is astrology. "what should I do" is POJU.

### 4.3 "How POJU works"（6 阶段简化展示）

标题：`How POJU works`

副标题：`Not a single answer — a continuous breakthrough loop.`

6 步流程图：
1. Issue Identification
2. Information Collection
3. Auxiliary Tools Judgment
4. Core Analysis
5. Action Generation
6. Implementation Tracking

底部一句：`You act. You come back. The path adjusts. Until you move through.`

### 4.4 差异化对比表

标题：`Why POJU is different`

表格：

|  | Co-Star | ChatGPT | Real Master | POJU |
|---|---|---|---|---|
| Depth | ● | ● ● | ● ● ● ● | ● ● ● |
| Actionable | ● | ● ● | ● ● ● ● | ● ● ● ● |
| Eastern Base | ● ● | ● | ● ● ● ● | ● ● ● ● |
| Privacy | ● | ● | ● | ● ● ● ● |
| Price | $8/yr | $20/mo | $150-500 | **$9.99 single** |

### 4.5 付款前的承诺条（Before You Pay）

在最终 CTA 按钮上方，放置一个简短的隐私安心条（不重复落地页的完整技术说明，只给关键一句 + 跳转）：

```
Before you pay — what happens to your words:

✦ Encrypted on your device only.
✦ Never stored on our servers.
✦ Deleted when you close — even from us.

[ How we actually keep our word → ]
   (链接到落地页 Screen 7 "How We Protect You")
```

**目的**：用户看完产品介绍到达 CTA 前，再给一次 1 秒能扫完的隐私提示，降低付款犹豫。

### 4.6 最终 CTA

标题：`Ready to break through?`

按钮：`Ask your question — $9.99`

下方小字：`One question · Unlimited depth · PDF by email · Deletes when you close.`

### 4.7 Footer

---

## 5. 页面 · Syncro 产品页 `/syncro`

**此页面在 PC 和移动端行为不同**。

### 5.1 PC 端行为

**不启动粒子球**，展示静态介绍 + 二维码。

内容：
- 大标题：`See how your energy aligns with the space around you.`
- 副标题：`Syncro reads your Bazi, your location, and this exact moment — then shows you which direction carries what energy.`
- 宣传视频或 GIF（循环展示粒子球 + AR 视口）
- 提示框：`Opens on mobile only`
- 说明：`Syncro needs your phone's compass, GPS, and camera. Scan the code or text yourself the link.`
- 二维码（链接到 `pojulife.com/syncro` 的手机版）
- 输入框 + 按钮：`[phone number]` `Text me the link`（发送 SMS）

**下方**（所有设备都有）：
- 5 个使用场景简述：Study spot / Negotiation / Bed orientation / Travel decision / POJU companion
- 科学 × 东方对照区（简化版的 Screen 4 + Screen 5）
- 永久免费承诺：`Always free. Forever.`
- Footer

### 5.2 移动端行为

访问 `/syncro` 直接启动完整体验。

**Step 1 · 设备权限请求**
- 弹窗：`Syncro needs your compass, location, and camera.`
- 按钮：`Grant permissions`

**Step 2 · iOS 罗盘特殊授权**（仅 iOS 13+）
- 提示：`Tap the button to activate your compass`
- 按钮：`Activate compass`（必须用户点按，浏览器才给权限）

**Step 3 · 罗盘校准引导**
- 动画示范 ∞ 字手势
- 提示：`Hold your phone and draw a figure-8 in the air`
- 自动检测稳定后进入下一步

**Step 4 · 双区登录页**

*区域 A · 教学区（可关闭）*：
- 标题：`How Syncro reads you`
- 副标题：`2,000 years of Eastern Shushu, reinforced by modern science`
- 四条学理简介：
  - ✦ GANZHI — 60-base time coord
  - ✦ BAGUA — 9-palace space map
  - ✦ WUXING — 5-phase dynamics
  - ✦ KANYU — magnetic + solar time
- 使用方法说明（具体文案待补充，见 v3.0.1 附录 E）
- 勾选框：`Don't show this again`
- 按钮：`Got it, continue ↓`

*区域 B · 信息输入区（永久显示）*：
- Date of Birth（滚轮式选择器：年/月/日）
- Time of Birth（12 时辰段下拉）：
  - 11 PM – 1 AM (Midnight / Zi)
  - 1 AM – 3 AM (Late Night / Chou)
  - ...（共 12 项 + "Not sure"）
- Gender（单选）：Male / Female / Other
- Profession（下拉 + 自定义输入）：
  - Lawyer / Legal
  - Doctor / Medical
  - Teacher / Educator
  - Engineer / Developer
  - Artist / Creative
  - Entrepreneur / Founder
  - Finance / Investment
  - Sales / Marketing
  - Manager / Executive
  - Student
  - Retired
  - Homemaker
  - Or type your own: [input]
- 按钮：`Begin Reading →`
- 小字提示：`Your info stays on this device.`

**Step 5 · 首次 AI 分析**
- 加载动画：`Reading your energy signal...`
- 约 3-5 秒

**Step 6 · 进入主界面**

有两种模式自动切换（基于手机姿态）：

*平放模式（Overhead）*：
- 3D 粒子能量球居中
- 球体周围 8 方位光点
- 当前手机朝向方位高亮
- 下方按钮切换：`View energy map ↕`
- 点击按钮 → 展开 8 方位完整表格（见 5.3）

*AR 模式（Immersive）*：
- 全屏粒子球
- 中心圆形视窗显示摄像头画面
- 视窗边缘光晕跟随方位变化
- 视窗上下方：当前方位卡片（见 5.4）
- 视窗可长按 1 秒触发**精准拍照**（见 5.5）

顶部元数据条（始终可见）：
- `Shen hour · 3 PM – 5 PM` + 下一时辰倒计时
- 模式切换锁定按钮（右上角）

**模式切换**：
- 平放 z>0.8 → 自动切 Overhead
- 竖立 z<0.3 → 自动切 AR
- 用户可手动锁定任一模式

### 5.3 8 方位表格视图

标题：`SYNCRO READING`

元数据行：
```
Shen hour (3 PM – 5 PM) · Apr 20, 2026
39.68°N, 75.75°W · Newark, DE
Yi-Wood Day Master · M · Lawyer
Valid until You hour (5 PM EDT)
```

表格 8 行（Direction / Rating / Best For / Avoid），每行数据由 AI 生成。表格末尾：
- 按钮：`Ask POJU to go deeper · $9.99`

### 5.4 AR 模式中心视窗卡片

当前朝向方位的卡片：
```
EAST · Zhen Palace
✦✦✦✦✦ Excellent

── Best For ──
Growth & Healing.
Perfect for brainstorming long-term goals.

── Avoid ──
Loud noises, renovations.
```

手机旋转 → 内容 300ms 渐变过渡到新方位的卡片。

### 5.5 精准拍照模式

AR 模式下长按视窗 1 秒触发：

- 光晕收缩 + 画面冻结 + 仪式动画
- 加载提示：`Reading the signal from this direction...`
- 2 秒后出结果

结果页：
- 方位（自然语言）：`Facing Northwest, slightly toward North`
- 时间：`April 20, 2026 · 3:47 PM EDT`
- 24 小时分段分析（分段按 2 小时或根据需要）
- 底部输入框：`Name this direction`（用户自定义，如 "My desk"）
- 按钮：`Save to Archive`
- 按钮：`Ask POJU about this spot · $9.99`
- 按钮：`Share as image`（导出 9:16 PNG）

### 5.6 时辰切换自动仪式

每 2 小时整点触发：
- Toast 提示：`Shen hour has closed. You hour (Sunset) begins. Your field is being retuned...`
- 粒子球重新渲染
- 报告重新生成（自动调 AI）

### 5.7 PNG 导出

任意结果页可分享为 9:16 图片，含：
- POJU Logo + 分隔线
- 标题（`Your Energy Map` 或用户命名）
- 粒子球快照
- 核心方位信息（Wealth / Focus / Avoid 三组）
- 底部钩子：`Ask POJU to see what's underneath · $9.99`
- `pojulife.com`

---

## 6. 页面 · Oracle 产品页 `/oracle`

**PC 和移动端都完整可用**。

### 6.1 Stage 1 · 登录页（Enter）

- 顶部 POJU Logo
- 标题：`Oracle`
- 副标题：`Ancient Guidance · Ask sincerely. Receive a sign.`
- 一段叙事（精简版，见 v3.0.1 文档 D.3.1 极简版）：
  > Two thousand years ago, people in the East brought a single question to an ancient listening presence. The answer was never a voice. It was a sign — a card from a pattern library refined over a hundred generations.
  > 
  > *A sincere heart opens the channel.*
  > 
  > Ask honestly. Receive your sign.

- 三条仪式提示：
  - ◉ One question per reading. Asking many things at once dilutes the sign.
  - ◉ If the same question calls you back, wait 48 hours. Answers need time to settle.
  - ◉ Compress your question into 60 characters. The compression is the beginning of the answer.

- 按钮：`Continue →`

### 6.2 Stage 2 · 问题输入（Ask）

- 标题：`What do you bring today?`
- 单行输入框（**强制 60 字符限制**，右下显示字数）
- 占位符：`e.g. Should I end my relationship...`
- 按钮：`Continue →`（输入不为空时激活）

**48 小时相似度检测**：
- 提交前后台检查近 48 小时内类似问题
- 若相似度 >80% 弹窗：
  ```
  You've already asked this.
  
  Your sign from [2 hours ago]:
  ✦ Calm Current
  
  Answers don't change just because you ask again.
  Give it 48 hours.
  
  [ Read my previous sign ]
  [ Ask a different question ]
  [ I know. Draw anyway. ]
  ```

### 6.3 Stage 3 · 响应（Respond）

- 粒子加速流动
- 屏幕中央文字：`Hold to summon your sign`
- 背景嗡鸣音效渐强

### 6.4 Stage 4 · 召唤（Summon）

- 用户长按屏幕
- 进度光环 3 秒倒计时
- 粒子向中心凝聚
- 3 秒完成 → 爆炸
- 音效：叮 + 轻微震动

### 6.5 Stage 5 · 显现（Reveal）

- 爆炸碎粒子中浮现卡片
- 卡片缓缓展开（2-3 秒）
- 音效：纸张展开

### 6.6 Stage 6 · 铭刻（Inscribe）

- 卡片内容从上到下毛笔写入
- 每行完成后 1.5 秒写下一行
- 最后一行完成 → 钟响

卡片固定内容结构：
```
✦ A SIGN ✦

✦ [风向系等级名] ✦
  [副标题]

── THE VERSE ──
[禅诗 4-6 行]

── WHAT IT MEANS ──
[AI 生成 · 50-80 英文字]

── FOR TODAY ──
[AI 生成 · 20-40 英文字]

──

If this knot needs untying,
POJU will sit with you.
One question · $9.99

[ Ask POJU →  ]

pojulife.com
```

### 6.7 Stage 7 · 携带（Carry）

卡片下方操作按钮：
- `Save as image`（保存为 9:16 PNG 到相册）
- `Save to Archive`（自动保存到 IndexedDB）
- `Share`（系统分享面板）
- `Ask POJU to go deeper · $9.99`（触发支付 → 进入 POJU 3 签联动流程）

### 6.8 Oracle 3 签联动（POJU 付费用户专享）

从 POJU Chat 召唤 Oracle 时的流程：

1. POJU Chat 中 AI 说："Let me show you your Present. Draw a sign."
2. 点击 → Oracle 面板底部抽屉弹出
3. 完成 Stage 1-7 得到**Present 卡**
4. 抽屉关闭，数据回传 POJU
5. POJU AI 说："Now let's see your Past. Draw again."
6. 再次抽签 → **Past 卡**
7. POJU AI 说："And finally your Future..."
8. 再次抽签 → **Future 卡**
9. 三签在 POJU Chat 中合看，AI 给整体解读

---

## 7. 页面 · POJU Chat `/chat`

**需要 Session Token 才能访问**。没有 token → 跳回 `/poju`。

### 7.1 三栏布局（Desktop）

```
┌──────────┬──────────────────────────────────────┐
│ POJU     │  [元数据条]                     [≡] │
│  Logo    │  ──────────────────────────────────  │
│          │                                      │
│ ✦ New    │       【对话主区域】                 │
│   POJU   │                                      │
│   $9.99  │                                      │
│          │                                      │
│ ─────    │                                      │
│ Today    │                                      │
│ Apr 19   │                                      │
│ "Dad..." │                                      │
│          │                                      │
│ This Week│                                      │
│ Apr 15   │                                      │
│ "Move..."│                                      │
│          │                                      │
│ Apr 10   │                                      │
│ [Hidden] │                                      │
│          │                                      │
│ ─────    │                                      │
│ Archive  │                                      │
│          │                                      │
│ Syncro → │  ──────────────────────────────────  │
│ Oracle → │  [📎] [🎤] Type your reply...  [→]  │
└──────────┴──────────────────────────────────────┘
```

### 7.2 左侧栏内容

- 顶部：POJU Logo
- 按钮：`✦ New POJU $9.99`（触发新付费开新 Session）
- 分隔线
- 历史 Session 列表（按时间分组：Today / This Week / Earlier）
  - 每项：`Apr 19 · "Dad and I..."` 格式
  - 右键/长按：Rename / Hide / Wipe
  - 隐藏项显示 `[Hidden by you] [Reveal]`
- 分隔线
- Archive 入口（跳 `/archive`）
- 分隔线
- 工具链接：
  - Syncro → （底部抽屉弹出 Syncro 面板）
  - Oracle → （底部抽屉弹出 Oracle 面板）

### 7.3 移动端

左侧栏默认收起为汉堡按钮 `≡`，点击展开侧滑抽屉。

### 7.4 顶部元数据条

- Session 标识：`POJU Session · Started Apr 19`
- 右侧：菜单按钮 `≡`

### 7.5 欢迎引导区（首次进入可见）

付费成功后首次进入 Chat 看到的**静态文字**（不是 AI 消息）：

> Tell me what's holding you back — career, family, love, money, health, any crossroads.
>
> The more specific, the better. Places, timing, people, what you've tried, what you fear.
>
> Two thousand years of Eastern wisdom can answer you, but it needs to see the real you first.
>
> ──
>
> Once you finish, I'll begin the reading.
> Everything you say stays on this device only. Close the page and it's gone.

下方小字：`Type below to begin, or tap the microphone to speak.`

用户发送第一条消息后，引导区平滑上移消失。

### 7.6 对话气泡

**用户气泡**：
- 右对齐
- 内容：文字或图片附件

**AI 思考气泡（临时）**：
- 左对齐
- 显示流式输出的思考文字（中文主体 + 英文任务点缀）
- 例如：
  ```
  ✦ 道家云："天下大事必作于细"...
  ✦ checking: your timing vs. career cycles
  ✦ 流年癸卯，正是换木的时候...
  ```
- 持续 5-30 秒
- 完成后淡出消失（**不保留在对话中**）

**AI 正式气泡**：
- 左对齐
- 内容：AI 的正式回复（跟随用户语言）
- 底部工具栏：
  - `📋 Copy`（复制文字）
  - `🔊 Read Aloud`（ElevenLabs 朗读）

**Phase 5 完成后的特殊气泡**：
- 底部额外按钮：`✦ Save this reading as PDF`

### 7.7 输入栏（底部固定）

从左到右：
- `📎 Image`（图片上传按钮）
- `🎤 Voice`（语音输入按钮，Web Speech API）
- 输入框：`Type your reply...`
- `→ Send`（发送按钮）

**交互**：
- Enter 键桌面端发送，Shift+Enter 换行
- 移动端 Enter 换行，按按钮发送
- 语音按钮按住说话，松开停止，文字自动填入输入框

### 7.8 右上角菜单（≡）展开

```
✦ Save this reading as PDF       (仅 Phase 5 完成后激活)
✦ Summon Syncro                  (底部抽屉弹出 Syncro)
✦ Summon Oracle                  (底部抽屉弹出 Oracle)
✦ Rename this session            (重命名)
✦ Archive this session           (折叠，可恢复)
✦ End & Wipe this session        (彻底销毁，二次确认)
─────
Settings                         (音效开关等)
```

### 7.9 "Save as PDF" 流程

点击 `Save this reading as PDF` →

弹窗：`Where should we send it?`
- 邮箱输入框
- 说明：`Your reading will arrive in minutes.`
- 折叠提示框：
  ```
  Also, this:
  Your actions need time to settle. I'd like to send you
  ONE check-in email on [Apr 30]. That's it. No marketing.
  Deleted after sending.
  ```
- 按钮：`Send me both`
- 按钮：`Just the PDF, no check-in`
- 按钮：`Cancel`

**Session 最多导出 5 次 PDF**，超过显示：`You've saved this 5 times. Ready to close this chapter?`

### 7.10 End & Wipe 流程

点击 `End & Wipe this session` → 二次确认弹窗：

```
End and wipe this session?

Everything in this conversation will be gone forever.
This cannot be undone.

💨 Before you close: want your reading as a keepsake PDF?

[ Save PDF first → ]
[ Wipe without saving ]
[ Cancel ]
```

- `Save PDF first →` → 先走 7.9 PDF 流程，完成后再销毁
- `Wipe without saving` → 立即清除当前 Session 所有 IndexedDB 数据 → 跳回 `/`
- `Cancel` → 关闭弹窗继续对话

### 7.11 Summon Syncro / Oracle（内嵌面板）

点击菜单中的 `Summon Syncro` 或 `Summon Oracle`：

- 底部抽屉从屏幕底部滑出（约 90% 屏幕高度）
- 抽屉内嵌完整的 Syncro 或 Oracle 功能
- 用户完成交互后：
  - 点击抽屉顶部 `×` 关闭
  - 或点击抽屉内的 `Send to POJU` 按钮
- 数据回传 POJU 对话，AI 基于新数据继续分析

---

## 8. 页面 · The Archive `/archive`

### 8.1 顶部

- 标题：`✦ THE ARCHIVE`
- 副标题：`Everything here lives only on this device.`

### 8.2 筛选标签（四选一）

```
[ All ]  [ POJU ]  [ Syncro ]  [ Oracle ]
```

点击切换显示不同类型的历史条目。

### 8.3 搜索框（可选）

- 右上角搜索图标
- 点击展开为输入框：`Search`

### 8.4 历史条目列表（按时间倒序，分组：Today / Yesterday / This Week / Earlier）

**POJU Session 条目**：
```
[日期] · POJU · [首问题前 6 字]
[状态：Still active · 12 messages] 或 [Archived]
[ Resume ]  [ Archive ]  [ Wipe ]
```

**Oracle 条目**：
```
[日期] · Oracle · "[问题摘要]"
[等级 · 副标题，如 Calm Current · Sign of Flow]
[ View ]
```

**Oracle 3 签联动条目**：
```
[日期] · Oracle (3-Sign Reading)
"[问题摘要]"
[三张小缩略图：Past · Present · Future]
Linked with POJU session [日期]
[ View spread ]  [ Open POJU chat ]
```

**Syncro 条目**：
```
[日期] · Syncro · "[用户自定义名或方位]"
Facing [方位]
[ View ]  [ Re-read now ]
```

**隐藏条目**：
```
[日期] · [产品类型]
[ Hidden by you ]
[ Reveal ]  [ Wipe ]
```

### 8.5 空状态

若 Archive 为空：

```
✦ THE ARCHIVE

Nothing here yet.

Your readings, signs, and conversations will live here — 
only on this device.

[ Ask your question → ]
[ Receive a sign → ]
```

### 8.6 底部操作

按钮：`Wipe everything`

点击弹出二次确认：

```
Wipe everything?

All conversations.
All signs.
All readings.
All of your data on this device.

This cannot be undone.

Type "WIPE" to confirm:
[ _______________ ]

[ Wipe everything ] (打字正确后激活)
[ Cancel ]
```

### 8.7 单条目操作详解

**POJU 条目**：
- `Resume` - 恢复对话（仅 Still active 的显示此按钮）
- `Archive` - 折叠但保留
- `Wipe` - 彻底销毁（二次确认）
- 长按 / 右键：Rename / Hide

**Oracle 条目**：
- `View` - 全屏显示卡片
- 长按：Delete / Rename

**Syncro 条目**：
- `View` - 显示当时的方位图快照
- `Re-read now` - 基于当前时辰重新分析
- 长按：Delete / Rename

---

## 9. 页面 · 免责声明 `/disclaimer`

### 9.1 顶部

- 标题：`Disclaimer`
- 最后更新日期：`Last updated: [日期]`

### 9.2 正文内容

按 v3.0.1 开发文档 09.3.2 节的 10 节框架（律师起草前用占位）：

1. **NATURE OF SERVICE** - 服务性质
2. **NOT PROFESSIONAL ADVICE** - 非专业建议（医疗/心理/法律/金融/感情咨询 5 类排除）
3. **CRISIS RESOURCES** - 危机资源（988 Suicide & Crisis Lifeline / 911）
4. **NO WARRANTY** - 无担保声明
5. **LIMITATION OF LIABILITY** - 责任限制
6. **AGE RESTRICTION** - 年龄限制（18+）
7. **SCIENTIFIC CLAIMS** - 科学声明
8. **CULTURAL AND RELIGIOUS NEUTRALITY** - 文化宗教中立
9. **AI-GENERATED CONTENT** - AI 生成内容声明
10. **CHANGES TO THIS DISCLAIMER** - 条款变更

底部：`Contact: legal@pojulife.com`

---

## 10. 页面 · 隐私政策 `/privacy`

### 10.1 顶部

- 标题：`Privacy Policy`
- 最后更新日期

### 10.2 正文内容

按 v3.0.1 开发文档 09.2.2 节的 12 节框架（律师起草前用占位）：

1. **What We Collect** - 我们收集什么
2. **What We Don't Collect** - 我们不收集什么
3. **How We Use Your Data** - 如何使用数据
4. **Data Encryption** - 数据加密
5. **Data Deletion** - 数据删除
6. **Third-Party Services** - 第三方服务
7. **AI Model Data Handling** - AI 模型数据处理
8. **Children's Privacy** - 儿童隐私
9. **Your Rights (CCPA)** - 用户权利
10. **GDPR-Specific** - GDPR 专项（如适用）
11. **Contact** - 联系方式
12. **Updates to This Policy** - 政策更新

---

## 11. 页面 · 服务条款 `/terms`

### 11.1 顶部

- 标题：`Terms of Service`
- 最后更新日期

### 11.2 正文内容

律师起草前用占位内容。关键章节：

1. **Use of Services** - 服务使用规则
2. **No Guarantees** - 无保证声明
3. **Payments** - 付款条款
4. **Refunds** - 退款政策（7 天非技术原因不退款）
5. **Changes** - 条款变更
6. **Contact** - 联系方式

---

## 12. 页面 · 联系我们 `/contact`

简单页面，无复杂交互。

- 标题：`Contact`
- 副标题：`We read every email.`
- 三个邮箱分类：
  - **Support**: `support@pojulife.com`
    For payments, refunds, technical issues
  - **Privacy**: `privacy@pojulife.com`
    For data questions, CCPA/GDPR requests
  - **Legal**: `legal@pojulife.com`
    For legal matters, press inquiries
- 响应时间说明：`We aim to reply within 24 hours on business days.`

---

## 13. 页面 · 取消订阅 `/unsubscribe`

带 token 参数的一次性页面：`/unsubscribe?token=xxx`

### 13.1 Token 有效时

页面自动处理：
- 调 API 取消该 token 对应的所有 scheduled emails
- 立即删除数据库中的邮箱字段

然后显示：

```
✦ POJU

You've been unsubscribed.

Your email has been deleted from our servers.

This was the only email we had about this topic.

──

You can come back anytime without leaving anything behind.

[ Return to POJU ]
```

### 13.2 Token 无效时

```
This unsubscribe link has expired or is invalid.

If you're still receiving emails, please contact 
support@pojulife.com and we'll remove you immediately.

[ Return to POJU ]
```

---

## 14. 页面 · 支付成功回跳 `/chat?token=`

Stripe 支付成功后重定向到此 URL，带 Stripe session ID。

### 14.1 行为

前端检测到 `token` 参数 → 调用 `/api/payment/exchange-token` API → 换取真实 Session ID → 存入 IndexedDB → 清除 URL 参数 → 加载正常 Chat 页面。

### 14.2 过渡 UI

在 token 换取期间显示：

- POJU Logo
- 提示：`Preparing your session...`
- 加载动画

### 14.3 错误处理

如果 token 换取失败（罕见）：

- 提示：`We're confirming your payment. This usually takes a moment.`
- 5 秒后自动重试 3 次
- 仍失败 → 提示：`Something went wrong. Please contact support@pojulife.com — your payment is safe.`
- 按钮：`Contact support`
- 按钮：`Try again`

---

## 15. 页面 · 支付失败回跳 `/?cancelled=true`

用户在 Stripe Checkout 中取消支付后回跳到 `/` 根页面，带 `?cancelled=true` 参数。

### 15.1 行为

显示短暂 Toast 提示：

```
Payment cancelled. No charge was made.

[ Try again ]  [ Dismiss ]
```

- `Try again` → 重新触发 Stripe Checkout
- `Dismiss` → 关闭 Toast，保留在 `/` 页面

---

## 16. 状态 · 404 错误页

### 16.1 内容

- POJU Logo
- 大标题：`404 · This path doesn't exist.`
- 副标题：`Sometimes the way forward is going back.`
- 按钮：`Return home`（跳 `/`）
- 三个快捷链接：
  - `Start with POJU →`
  - `Open Syncro →`
  - `Open Oracle →`
- 页脚（完整版）

---

## 17. 状态 · 500 错误页

### 17.1 内容

- POJU Logo
- 大标题：`Something in the signal is unclear.`
- 副标题：`The system hit a bump. This is not your fault.`
- 按钮：`Try again`（刷新当前页）
- 按钮：`Return home`
- 底部小字：`If this keeps happening, email support@pojulife.com`

---

## 18. 弹窗 · 免责协议首次确认

**触发**：全站首次访问（任意页面），localStorage 无 `pojulife_disclaimer_v1` flag。

### 18.1 内容

- 标题：`Before you enter POJU`
- 正文：
  ```
  POJU delivers insights based on 2,000 years of Eastern wisdom,
  reinforced by modern science, and interpreted by an AI Agent.
  
  This is not a substitute for:
  · Medical advice
  · Legal advice
  · Financial advice
  · Mental health care
  
  If you're in crisis, please contact a licensed professional 
  immediately.
  
  Your data never leaves this device unless you explicitly 
  choose to share.
  ```
- 链接：`[ Read the full Disclaimer → ]`（跳 `/disclaimer`）
- 分隔线
- **勾选框**（默认不勾）：`I have read and agree to the Disclaimer, Privacy Policy, and Terms of Service.`
- 按钮：`Enter POJU`（勾选后激活）

### 18.2 确认后行为

- localStorage 设置：`pojulife_disclaimer_v1 = { agreed: true, at: [timestamp], version: "1.0" }`
- 弹窗关闭
- 用户继续访问原页面

### 18.3 版本更新

如果 Disclaimer 更新了版本（`version: "1.1"`），用户下次访问显示简版弹窗：

```
We've updated our Disclaimer.

[ View changes → ]

☐ I have read and agree to the updated terms.
[ Continue ]
```

---

## 19. 弹窗 · PWA 添加到主屏幕引导

### 19.1 触发条件

- iOS Safari + 非 standalone 模式
- 用户首次访问 Syncro 页面（其他页面不触发，避免骚扰）
- localStorage 无 `pwa_prompt_seen` flag

### 19.2 内容

- 标题：`Add POJU to your home screen`
- 副标题：`Full-screen experience. No browser bars. Works offline.`
- 动画示范（示意动作）：点击分享图标 → 选择 "Add to Home Screen"
- 按钮：`Got it`（关闭 + 记录 flag）
- 按钮：`Later`（关闭但不记录 flag）

### 19.3 Android Chrome

使用浏览器原生 `beforeinstallprompt` 事件，不需自建弹窗。

---

## 20. 弹窗 · 付款后首次进入 Chat 提示

**触发**：用户首次成功付费进入 `/chat`。

### 20.1 内容

非阻塞式 Toast（顶部横条）：

```
🔒 This conversation lives only on this device. Close to delete.

[ I understand ]
```

点击 `I understand` → Toast 消失，当前 Session 内不再显示。

---

## 附录 A · 所有 `$9.99` 按钮的触发点追踪

以下位置有支付 CTA，需要在 Stripe metadata 中追踪来源：

| 位置 | metadata source |
|---|---|
| 落地页 Hero `Start with POJU` | `landing_hero` |
| 落地页三产品卡片的 POJU `Learn more` | `landing_products` |
| 落地页最终 CTA | `landing_final` |
| POJU 产品页顶部 CTA | `poju_page_top` |
| POJU 产品页底部 CTA | `poju_page_bottom` |
| Syncro 结果页钩子 | `syncro_hook` |
| Syncro 精准拍照钩子 | `syncro_precise_hook` |
| Oracle 卡片底部钩子 | `oracle_hook` |
| Oracle 3 签联动触发 | `oracle_3sign_trigger` |
| Chat 左侧栏 `New POJU $9.99` | `chat_new_poju` |
| Archive 页"开始新问题"钩子 | `archive_new_question` |

所有支付成功后，metadata 会传给 Chat 页面作为 AI 的起始上下文（例如从 Oracle 钩子进入时，AI 第一句话会引用刚抽的签）。

---

## 附录 B · 页面优先级（按开发顺序）

按 Cursor Tasks 1-5 的拆分：

**Task 1** · 静态内容页
- `/`
- `/poju`
- `/syncro`（PC 端静态介绍）
- `/oracle`（静态介绍部分）
- `/archive`（空状态）
- `/disclaimer`
- `/privacy`
- `/terms`
- `/contact`
- 404 / 500
- 全局导航 + Footer
- 免责协议弹窗

**Task 2** · POJU Chat
- `/chat`（完整，用 Mock AI）
- 欢迎引导区
- 付款后首次提示
- 消息气泡双阶段
- 输入栏
- 左侧栏（Session 管理）
- 右上角菜单
- End & Wipe 流程

**Task 3** · Syncro 功能
- `/syncro` 移动端完整（Step 1-6）
- 粒子球 Overhead 模式
- AR Immersive 模式
- 8 方位表格
- 精准拍照
- 时辰切换仪式
- PNG 导出

**Task 4** · Oracle 功能
- `/oracle` 完整 7 Stage 仪式
- 48h 相似度检测
- 卡片生成和保存
- 3 签联动（需要 Task 2 的 Chat 已就绪）
- PNG 分享

**Task 5** · 支付 + 邮件 + AI
- Stripe 支付全流程
- `/chat?token=` 回跳处理
- `/?cancelled=true` 处理
- PDF 导出 + 邮件
- 回访邮件
- `/unsubscribe`
- 替换所有 Mock AI 为真实 Claude API
- PWA 添加主屏幕弹窗

---

## 文档尾声

本文档是 POJU **全站信息架构的权威来源**。当开发中遇到"这个页面应该有什么"的疑问时，回到这里查。

**更新原则**：
- 页面结构调整 → 同步更新此文档
- 新增弹窗 / 状态 → 同步更新此文档
- 纯视觉调整 → 不涉及此文档，只改 `05-visual-language.mdc`

**相关文档**：
- 产品功能细节：`docs/POJU_Development_Document_v3.0.1_Final.md`
- 视觉规范：`.cursor/rules/05-visual-language.mdc`
- 视觉参考图：`docs/visual-reference/poju-visual-style-master.png`

---

✦
