# POJU Development Document v3.0.1 (Final)

**破局** · POJULIFE.COM
**Product Development Document & Technical Specification**

Version v3.0.1 · 2026 · CONFIDENTIAL

---

## 文档说明

本文档是 POJU 项目的完整产品与技术规范，为**最终干净合并版**，取代 v1.0 / v2.0 / v3.0 所有历史版本。

v3.0.1 相对 v2.0 的核心变化：
- 产品哲学从"AI 问答产品"升级为"Agent 产品"
- 三产品架构正式成型：POJU（付费闭环）+ Syncro（免费引流）+ Oracle（免费引流）
- 技术栈从 React/Next.js 移动端 + 独立原生 APP 改为 **PWA 优先**
- 抽签产品去土化重构，引入风向系等级 + 爆炸卡片交互
- 方位产品去罗盘化重构，引入 3D 粒子球 + AR 伪增强 + 精准拍照
- AI 架构从 Chat + Prompt 升级为 Agent + 任务列表
- RAG 方案落定为 Supabase + pgvector
- 回访机制从"一个月后"死话改为"动态计算 + Scheduled Email"
- 品牌叙事为 **Ancient Wisdom + Modern Science + AI Agent + You** 四元素
- 新增 Syncro 学理根基章节（四大术数学科体系）
- 新增 Syncro 多场景刷新机制（纯前端锁定 + 三维度缓存键）
- 废除"收局"概念，采用"持续破局循环"
- 所有 Errata 修订已合并入对应章节

**关于命名**：Syncro 和 Oracle 是**临时占位名**。最终命名待完成商标检索与新造词方案后替换，不影响文档的产品规范。

---

## 目录

- 第 00 章 · 品牌内核
- 第 01 章 · 产品全景
- 第 02 章 · POJU（破局问答主产品）
- 第 03 章 · POJU Syncro（临时名）
- 第 03A 章 · Syncro 学理根基（Shushu System）
- 第 04 章 · POJU Oracle（临时名）
- 第 05 章 · 共享基础设施
- 第 06 章 · 前端架构（PWA + Three.js）
- 第 07 章 · 落地页 · 导航 · The Archive
- 第 08 章 · 支付 · 邮件 · 回访
- 第 09 章 · 合规 · 免责 · 商标 · 支付风险
- 第 10 章 · 开发计划 · 成本 · 风险
- 附录 A · System Prompt 骨架
- 附录 B · 签诗本土化工作包
- 附录 C · 设计规范
- 附录 D · 对外宣传文案（中英文）
- 附录 E · 待决事项清单

---

# 第 00 章 · 品牌内核

## 00.1 核心品牌叙事

**Ancient Eastern Wisdom, reinforced by modern science, delivered by AI Agent, personalized for you.**

东方智慧 · 现代科学 · AI 智能 · 只为此刻的你

— 两千年的道家、法家、儒家、佛学、风水、命理，由现代科学印证，通过 AI Agent 解译为你此刻能执行的行动。

这不是一句营销文案，是 POJU 所有产品决策的**第一原则**。每一次交互、每一段 AI 回复、每一个视觉元素，都要能回答一个问题：

> 它是不是在完成 Ancient → Modern → AI Agent → You 这条路径？

四个元素的关系是**一条有方向的流水**：

```
   Ancient          Modern            AI Agent           You
────────────  +  ─────────────  +  ──────────────  →  ─────────
 源头智慧      现代科学印证       智能交付引擎        个人落点

 道家/风水/      磁场/能量场/       任务列表驱动        你的八字
 命理/佛学      人体生物节律/      Agent 架构          你的方位
               空间心理学          RAG + LLM           你此刻的问题
```

缺一段就不是 POJU：
- 缺 **Ancient** → 变成 ChatGPT 兜售泛泛建议
- 缺 **Modern Science** → 变成"东方玄学"，西方用户警惕
- 缺 **AI Agent** → 回到传统静态命理，做不到个性化和实时
- 缺 **You** → 变成心灵鸡汤公众号，没有你的八字/方位/问题就不是破局

**加入"现代科学"的关键作用**：给了我们一套**西方用户能接受的理性叙事层**。用户看到的不是"东方玄学"，而是"东方两千年观察到的规律，被现代科学部分印证（磁场对人体的影响、空间对心理的作用、生物节律的周期性），由 AI 解译给你此刻能用的建议"。

落地页、文案、AI 回复里都要体现这种**三层叙事**：
- **Science Anchor**："Research shows that spatial orientation affects cognitive focus..."
- **Wisdom Bridge**："Eastern traditions have observed this for 2,000 years, calling it QI..."
- **Personal Delivery**："Based on your Bazi, today your QI flows strongest from the southeast..."

## 00.2 品牌气质三原则

**1. 神秘但务实（Mysterious but Actionable）**

POJU 的产品有神秘感（粒子球、爆炸卡片、古老签诗），但每一次输出都必须落到"今天就能做的动作"。这是我们和 Co-Star、The Pattern 这类"娱乐式预测"产品的根本区别。

对 AI 的硬规则：**禁止给出纯描述性、哲理性的建议**（"你要放下执念"）。必须给出具体到时间、地点、人物的动作（"周三晚上 7 点，打电话给你爸，只聊三件事：健康、饭菜、孙子"）。

**2. 克制但有力（Restrained but Heavy）**

视觉上克制：深色背景、极少色彩、极简文字、禁用 emoji（除了少数仪式符号如 ✦）。

但每一个元素都要有重量。粒子的呼吸节奏、毛笔落纸的声音、思考文字的流淌速度——这些细节决定了 $9.99 买不买账。

对设计的硬规则：**禁止赛博朋克风（霓虹紫、赛博绿）、禁止 Y2K 风、禁止中国传统红金**。走的是"文物博物馆的夜场光线"——深沉、安静、偶有金色微光。

**3. 私密但开放（Private but Shareable）**

POJU 的品牌护城河是**真正的不注册、不订阅、不保存**。但每一个产品都有一个"可被截图的瞬间"——Oracle 的卡片、Syncro 的方位图、PDF 报告封面。私密的使用，开放的分享。

对产品的硬规则：**每一个产品都必须有一张"Instagram Story 可分享尺寸（9:16）"的结果页**。传播是 POJU 的免费增长引擎。

## 00.3 产品哲学：POJU 是 Agent，不是 Chatbot

这是 v3.0 相对 v2.0 最重要的升级。

| 维度 | Chatbot（v2.0 之前的认知） | Agent（v3.0 的认知） |
|---|---|---|
| 响应方式 | 用户问 → AI 答 | 用户说 → AI 生成任务列表 → 逐项执行 → 动态调整 |
| 知识使用 | RAG 被动检索 | **RAG 定向检索 + LLM 通用推理能力**（类比、叙事化、典故翻译） |
| 多模态 | 用户主动打开其他工具 | AI 主动判断"这里需要 Syncro/Oracle 辅助"，召唤内嵌面板 |
| 输出 | 一次回复 = 最终答案 | 一次回复 = 当前任务的阶段性推进 |
| 会话流程 | 一问一答，用户自主结束 | **持续破局循环**，AI 永不主动宣告结束 |
| 用户体验 | "我问了一个问题" | "我请了一位顾问，他在帮我查清楚这件事" |

POJU 付费 $9.99 买的不是"一次 AI 回答"，是"一位东方顾问在你的议题上花 30 分钟到几小时"，而且"你做了我说的事情之后回来反馈，我再给下一步"。Agent 架构是这个体验的技术支撑。

## 00.4 目标用户

**主要用户**：
- 生活在北美的 30-50 岁人群
- 遇到真正困局（不是娱乐性好奇）
- 愿意为一次有分量的建议付费 $9.99
- 不想注册、不想订阅、重视隐私
- **西方用户是核心**，华人是增量

**战略扩展**：
- 18-28 岁的好奇心人群
- 主要通过 Syncro 和 Oracle 触达
- 可能暂时不付费，但是**传播引擎 + 未来付费用户**

**不是谁**：
- 不是算命爱好者（他们要预测，我们给破局）
- 不是订阅党（他们习惯按月付费）
- 不是心理咨询用户（他们需要持续陪伴）
- 不是 AI 工具爱好者（他们要通用能力）
- 不是纯娱乐用户（他们要 30 秒乐子）

## 00.5 18+ 好奇心用户的产品设计考量

18-28 岁的用户群体是 POJU 的战略扩展层。针对他们的产品设计考量：

**1. Syncro 和 Oracle 的视听要"可被录屏"**
- 粒子球动画、爆炸卡片、毛笔落纸的声音——这些是 TikTok 原生素材
- 默认开启音效（不开音效等于失去 50% 的传播力）
- 每个关键动画阶段都要"拍出来好看"

**2. Oracle 卡片的分享友好度优先于精美度**
- 竖屏 9:16，字体够大可以手机上一眼看完
- 关键句子可以被单独截图（"The frost in your chest is not a wall"这种金句感）
- 底部 POJU 水印克制但可识别

**3. 文案的 tone 需要"懂 internet 的克制幽默"**
- 不是 Co-Star 那种 "Mercury is in your coffee" 的刻薄
- 也不是老派命理的庄严
- 例子："This isn't advice. It's what you already knew, finally said out loud."

**4. 不做让 18+ 用户觉得"这是爸妈用的"的元素**
- 避免：满版中文书法、龙凤图案、太极图、红金主色
- 保留：极简深色、金色点缀、粒子美学、极简线条
- **POJU Logo 的"破局"汉字艺术字可以保留**——对美国用户而言是视觉符号而非语言障碍，反而带神秘感

**5. 免费工具的"每日打开"价值**
- Syncro 方位每时辰刷新 = 每天可打开几次
- Oracle 自然节制（建议 48 小时间隔）
- 这种"每日仪式感"是 18+ 用户养成习惯的关键

## 00.6 品牌语言策略

**主语言：英文**。所有命名、UI、AI 默认回复都以英文为原生。

**中文作为精准翻译**：用户检测到中文环境时提供中文版，但中文从英文翻译，不是反向。

**拼音作为品牌调味料**：
- AI 回复和 UI 中保留拼音（大写首字母）：**QI · BAZI · WUXING · BAGUA · GANZHI · XUAN · YUAN · SHICHEN**
- 首次出现时附英文 gloss："Your Bazi (birth chart) shows..."
- **绝不在正文中出现中文字符**（除 POJU 破局艺术字 Logo 外）
- 这些拼音词是 POJU 的异域感品牌资产

**典故处理铁律**：
- AI 回复中禁止直接出现中文专名（苏武、关公、诸葛亮等）
- 全部改为叙事化表达："Two thousand years ago in the East, a loyal envoy was stranded in enemy territory for nineteen years..."
- 保留智慧内核，剥离文化壁垒

## 00.7 一句话产品宣言

用于所有对外文案的北极星：

> **Three ways in. One way through.**
>
> Map your energy. Receive a sign. Break your deadlock.
>
> No accounts. No subscriptions. Never stored.
> $9.99 only when you need the deep work.

这句话就是 POJU 的所有营销素材、App Store 描述、社交媒体 bio、PDF 封底的母本。

---

# 第 01 章 · 产品全景

## 01.1 三产品架构

POJU Universe 由三个产品组成：

```
─────────────────────────────────────────────────────
                    POJU UNIVERSE
─────────────────────────────────────────────────────

    ┌─────────────┐   ┌──────────┐   ┌──────────────┐
    │   SYNCRO    │   │   POJU   │   │    ORACLE    │
    │  (临时名)    │   │          │   │   (临时名)    │
    │             │   │          │   │              │
    │    免费      │→→→│  $9.99  │←←←│     免费      │
    │             │   │          │   │              │
    │  实时方位    │   │ 深度破局 │   │   古老启示    │
    │  能量场      │   │  问答    │   │     卡片      │
    └──────┬──────┘   └────┬─────┘   └──────┬───────┘
           │               ↑                │
           └───────────────┴────────────────┘
                 全部引流到 POJU $9.99

    ─────────────────────────────────────────
    无注册 · 无订阅 · 不存储 · 不追踪
    ─────────────────────────────────────────
```

**三产品的角色分工**：

| 产品 | 定位 | 付费模式 | 战略角色 |
|---|---|---|---|
| **POJU**（破局问答） | 主产品，深度破局顾问 | $9.99/议题 | 商业闭环 |
| **Syncro**（方位能量场） | 空间维度的引流工具 | 完全免费 | 日活引擎 · 社交传播 |
| **Oracle**（古老启示卡） | 启示维度的引流工具 | 完全免费 | 传播引擎 · 转化漏斗 |

**商业模型的本质**：全部付费在 POJU。Syncro 和 Oracle 的存在不是为了赚钱，是为了**让用户认识品牌、记住品牌、在需要深度破局时想起品牌**。

## 01.2 三产品的英文产品定义

这三段定义会用于落地页 Hero、产品页顶部、App Store 描述、社交媒体 bio——所有对外展示。

### POJU · The Product Definition

> **Break your deadlock — guided by 2,000 years of Eastern wisdom, reinforced by modern science, delivered by an AI Agent that walks with you.**
>
> You're stuck between two paths. Friends can't see it clearly. A therapist takes months. A fortune teller costs $300 and gives you nothing to do.
>
> POJU is different. One paid session, $9.99. Infinite depth until the knot unties. An AI Agent trained on Daoism, Feng Shui, Bazi, and the Five Phases — not to predict your future, but to reveal what you already sense and hand you actions you can start today. You act. You come back. The path adjusts. Until you move through.
>
> *The wisdom that costs $300 with a master. Delivered in one conversation. $9.99.*

### Syncro · The Product Definition

> **See how your energy aligns with the space around you.**
>
> Two thousand years ago, Eastern traditions observed that human focus, luck, and outcome shift with direction and timing. Modern science echoes this — magnetic fields affect cognition, spatial orientation shapes decision-making, circadian cycles drive our biology.
>
> Syncro reads your **Bazi** (birth chart), your **location**, and **this exact moment**, then shows you which direction carries what energy — and what to do with it.

### Oracle · The Product Definition

> **A 2,000-year practice of sincere questioning.**
>
> For two thousand years, people in the East brought a single question to an ancient listening presence. They did not expect words. They waited for a **sign** — a mysterious card drawn from a library of one hundred archetypal patterns refined over millennia.
>
> The practice had one law: **a sincere heart opens the channel.** A real question receives a real sign. A casual one receives only noise.
>
> Today, the ritual is intact. An AI reads the card drawn for your exact question and delivers the guidance in language you can act on today.
>
> *One question. One sign. One thing to do.*

## 01.3 用户旅程的四种典型路径

**路径 A：直达 POJU（高意图用户）**
```
用户有明确困局 → 搜索 "breakthrough advisor" / "eastern wisdom ai"
→ 落地页 → 立即支付 $9.99 → 进入 Chat
→ 完成深度破局 → 导出 PDF（留邮箱）
→ 回访邮件触达 → 复购或推荐
```
预估占比：10-15%。

**路径 B：Syncro 引流（好奇型用户 / 商务人士）**
```
社交媒体看到朋友分享的 Syncro 方位图 → 访问 Syncro 页
→ 尝试免费版，看到自己的八方位 → 分享到 Instagram Story
→ 某一天遇到困局或重大决策（如谈判 / 签约）→ 回来购买 $9.99
```
商务场景示例：
- "Today 2-4 PM, your wealth direction points southeast. Best for: signing, pitching."
- "Avoid initiating new business before 2 PM — your Wu (戊) energy is scattered."

预估占比：35-45%。

**路径 C：Oracle 引流（情绪型用户）**
```
用户有一个具体问题（"我该不该分手"）→ 搜索中找到 Oracle
→ 免费抽一签 → 看到结果打动自己 → 截图分享
→ 点击卡片底部"Ask POJU to go deeper" → 支付 $9.99
→ 自动进入 Past/Future 两签补齐 → 3 签合看深度破局
```
预估占比：30-40%。

**路径 D：POJU 内召唤其他工具（Agent 场景）**
```
用户在 POJU Chat 中讨论议题 → AI 判断需要空间信息 / 启示信号
→ 召唤 Syncro / Oracle 内嵌面板 → 用户完成交互 → 结果回传对话
→ AI 基于新数据继续分析
```
预估占比：已付费用户中 40-60% 会经历此流程。

## 01.4 用户状态机

用户相对于系统有四种状态：

```
┌─────────────────┐
│   GUEST         │  未访问 / 匿名浏览
└────────┬────────┘
         │
         ↓  访问任一产品页
┌─────────────────┐
│   VISITOR       │  设备 ID 已生成；Syncro / Oracle 可用
└────────┬────────┘
         │
         ↓  支付 $9.99 成功
┌─────────────────┐
│   SESSION       │  当前设备上存在一个或多个活跃议题
└────────┬────────┘
         │
         ↓  议题完结并 End & Wipe
┌─────────────────┐
│   ALUMNI        │  无数据但设备 ID 保留；可被回访邮件触达
└─────────────────┘
```

**关键设计**：
- 状态全部基于设备 ID，无账户体系
- 所有数据（除付费凭证和邮箱）都在本地
- 清除浏览器数据 = 设备 ID 重置 = 回到 GUEST
- 这不是技术妥协，是品牌承诺

## 01.5 品牌心智与差异化

```
                 深度 / Depth
                   ↑
                   │
   真人命理师  ●    │    ● POJU  ($9.99 甜区)
   ($150+)         │
                   │
                   │
     ──────────────┼──────────────→  Price
                   │
      Co-Star ●    │    ● ChatGPT
      ($7.99/年)   │    ($20/月)
                   │
                   │
      Fortune  ●   │
      Cookies      │
                   ↓
```

POJU 的坐标：**深度接近真人命理师，价格接近消费级 AI 工具**。这是一个没被占据的位置。

核心宣传锚点：

> **The wisdom that costs $300 with a master. Delivered in one conversation. $9.99.**

## 01.6 三产品共享的品牌承诺

**1. Never stored.**
所有数据存本地。服务器只保留付款凭证哈希和可选邮箱（24 小时内销毁）。

**2. Never required.**
从不要求注册、登录、订阅、填表、创建密码。唯一的"身份"是设备指纹。

**3. Never manipulative.**
不做黑暗模式：不弹窗挽留、不用假倒计时、不隐藏关闭按钮、不在免责里埋陷阱、不为了留住用户而制造焦虑。

这三条承诺在每个产品的启动页、隐私声明、落地页都要明确出现。**这是 POJU 最不可替代的品牌资产**。

## 01.7 产品路线图概览

**MVP（v1.0 上线）**：三产品完整上线 PWA 版本。

**v1.1（上线 3-6 个月后）**：
- The Archive 升级（可选加密备份码跨设备恢复）
- 多语言扩展（POJU 首发中英，v1.1 增加西班牙语）
- Oracle 签诗本土化继续打磨

**v2.0（上线 6-12 个月后）**：
- 考虑原生 APP（Flutter + WebView 或全原生，视 PWA 数据决定）
- 企业 API
- AI 语音对话版

本文档范围：**仅覆盖 MVP**。


---

# 第 02 章 · POJU（破局问答主产品）

> POJU 是整个产品体系的**付费闭环**和**品牌主体**。本章定义它的完整产品规范。

## 02.1 产品定义

**POJU** 是一个基于 Agent 架构的破局顾问产品：

- **用户付费 $9.99** 开启一次议题 Session
- **AI 生成任务列表** 围绕用户议题做多阶段推进
- **Session 永久有效**（在本设备生命周期内）直到用户主动 End & Wipe
- **所有数据本地加密存储**，服务端只留付款哈希和可选邮箱
- **话题漂移由 AI 温柔拉回**，不弹窗不提醒
- **持续破局循环**：AI 永不主动宣告议题结束，由用户决定

POJU 和通用 AI Chatbot 的根本区别：

| 维度 | 通用 AI Chatbot | POJU |
|---|---|---|
| 响应模式 | 秒回 | 强制 5-30 秒思考 |
| 第一条回复 | 立刻给答案 | 问诊式收集信息 |
| 知识使用 | 通用预训练知识 | **RAG 定向检索东方智慧库 + LLM 通用推理能力** |
| 任务结构 | 扁平问答 | 6 阶段任务列表（含循环体） |
| 外部工具 | 可能联网 | 主动召唤 Syncro / Oracle |
| 话题控制 | 跟用户走 | 主动守护议题聚焦 |
| 输出约束 | 无 | 必须包含具体可执行动作 |
| 会话结束 | 一问一答 | **持续循环，用户决定结束** |

## 02.2 付费机制

### 02.2.1 付费的定义

**$9.99 买的是一次"议题 Session 的永久时效"**。

具体含义：
- 一次支付 = 开启一个新的议题容器（Session）
- 此 Session 内**无限追问、无限深度**
- Session 数据**永久保留**（在本设备），除非用户主动 End & Wipe
- 用户想讨论第二个议题 = 需要再支付一次 $9.99 开启新 Session

### 02.2.2 话题漂移的处理

关键设计：**不以"强制付费新开"为主线**，而以"AI 守护议题聚焦"为主线。

AI 在 System Prompt 中被约束如下行为：

**场景 1：新话题是主议题的根因浮出**
例如：用户原议题"工作不顺"，聊着聊着说"其实我一直没被爸爸认可"。
AI 处理：识别为根因浮出，纳入当前议题，深度挖掘。**不提新开 Session**。

**场景 2：新话题与主议题明显无关**
例如：用户原议题"我该不该辞职"，突然问"我的手机丢了怎么办"。
AI 处理：
```
"丢手机这事和你辞不辞职的关系不大。
 我们先把这个局看清楚——关于工作，你刚才说的'没有安全感'
 是怎么来的？"
```
**在同一回复中温柔提及距离、拉回主议题**。不弹窗，不触发新付费提示。

**场景 3：用户连续坚持新话题（3 轮以上）**
AI 处理：
```
"我看你心里还有另一件事在转。但这是另一个局，
 如果我们混在一起聊，两个都聊不清楚。
 
 关于辞职这事，我们这次就好好看透它。
 新的局下次再来找我——我一直在这里。"
```
**明确告知"这是另一个局"，但不说"请重新付费"**。保留尊严，让用户自己意识到。

### 02.2.3 支付流程

```
落地页 → 点击 "Ask Your Question $9.99"
  ↓
Stripe / Paddle Checkout（自动检测 Apple Pay / Google Pay）
  ↓
支付成功 → Webhook 触发
  ↓
后端生成 Session Token（UUID + 签名），仅保留哈希
  ↓
重定向到 /chat#token=xxx
  ↓
前端检测 token → 塞入 localStorage → 清除 URL 上的 token
  ↓
首次进入 Chat → 显示"数据本地存储"告知提示（**不需勾选**，已在全站首次确认过免责）
  ↓
进入正式 Chat 页面
```

### 02.2.4 定价策略

$9.99 是明确的单次消费心理甜区：
- 低于 $10 心理门槛
- 远低于真人命理师 $150+ 起步
- 远高于占星 App $2.99 的消费层级（暗示"这是认真的"）

**不做多档定价**。不做 $19.99 Pro 版、不做年度订阅、不做包月。一个价格，所有用户一致。

## 02.3 AI Agent 架构

### 02.3.1 核心原则

POJU 的 AI 不是 ChatGPT 壳子，是一个**围绕议题执行多步任务的 Agent**。

每个 Session 开启时，AI 首次响应前会做以下事情：
1. 解析用户的初始问题
2. 生成一份任务列表（Task List）
3. 判断当前在列表的哪一步
4. 执行当前步骤，并在回复中体现推进

### 02.3.2 持续破局循环（替代原"7 阶段收局"）

**POJU 核心哲学**：$9.99 买的不是"一次对话"，是**一个议题被陪伴走完全程**。

POJU 的工作方式：

```
┌──────────────────────────────────────────────────┐
│         持续破局循环 (Continuous Loop)            │
│                                                   │
│   ┌─→ 收集信息 ──→ 分析 ──→ 给出行动方案 ──┐     │
│   │                                        │     │
│   │                                        ↓     │
│   └── 基于新信息迭代 ← 用户实操后反馈 ←────┘     │
│                                                   │
│   唯二结束条件：                                  │
│   · 用户主动 Archive（保留数据）                  │
│   · 用户主动 End & Wipe（彻底销毁）               │
└──────────────────────────────────────────────────┘
```

这意味着：
- **AI 永不主动宣告"议题完结"**
- **每次给出行动方案后，AI 明确邀请用户实操后回来反馈**
- **用户回来说"我按你说的做了，结果是这样"后，AI 基于新信息进入新一轮循环**
- **行动方案可能迭代 3 次、5 次、甚至 10 次，都在同一个 $9.99 Session 内**

### 02.3.3 6 阶段任务列表

```
Phase 1 · 议题识别（一次性，Session 开始时）
  1.1 真正的"局"是什么
  1.2 命理局 / 事理局 / 心局 / 复合局

Phase 2 · 信息收集（一次性，可按需追加）
  2.1 八字信息（年月日 + 12 时辰段）
  2.2 相关人物关系
  2.3 问题时间线
  2.4 已尝试过什么
  2.5 最怕什么 / 最想要什么

Phase 3 · 辅助分析判断（按需触发）
  3.1 是否召唤 Syncro（方位、居家、办公、搬家、出行）
  3.2 是否召唤 Oracle（需要方向感 / 启示）

Phase 4 · 核心分析（循环体）
  4.1 命理层（八字 + 流年流月）
  4.2 事理层（人情世故 + 利害）
  4.3 智慧框架（道 / 法 / 儒 / 佛 / 风水 / 命理 主导）

Phase 5 · 行动方案生成（循环体）
  5.1 今天就能做的（5 分钟内可启动）
  5.2 本周要做的
  5.3 持续要做的

Phase 6 · 实操跟踪（循环体，POJU 的灵魂）
  6.1 邀请用户实操后回来反馈
  6.2 基于反馈判断：
       A. 行动有效 → 深化或下一层动作
       B. 行动遇阻 → 诊断原因，调整方案
       C. 情况变化 → 补充新信息，重新分析
  6.3 回到 Phase 4 重新分析，生成新行动
```

**Phase 1-3 是一次性的**（议题启动时完成一次）。
**Phase 4-5-6 是循环体**（每次实操反馈后重新走一次）。

### 02.3.4 每次 Phase 5 的标准收尾

每次 Phase 5 给出行动方案后，AI 回复必须以这种结构收尾：

**中文版**：
```
──

这是你这周要做的三件事。不用全做完，做一件也行。

做完之后回来告诉我：
· 实操时你的感受
· 周围人的反应
· 有没有意外的变化

我会基于你的反馈给下一步。这个局我们一起走完。

──
```

**英文版**：
```
──

These are your three actions for this week. 
Don't feel you need to do all — even one is progress.

When you've tried something, come back and tell me:
· How it felt in the moment
· How others around you reacted  
· Any unexpected shifts

I'll adjust the path based on what you learn.
We walk this through together.

──
```

### 02.3.5 任务列表对用户的可见性

**部分透露**原则：完整 Task List 永远不显示给用户，但思考过程气泡中会自然冒出 1-2 个当前步骤提示。

呈现示例：

```
╭──────────────────────────────────────╮
│  ✦ 道家云："天下大事必作于细"...     │  ← 中文主体
│  ✦ checking: your timing vs. cycles │  ← 英文点缀，Agent 推进信号
│  ✦ 流年癸卯，正是换木的时候...       │
│  ✦ matching: Daoist Wu Wei frame    │
│  ✦ 这个局其实藏在另一件事里...       │
╰──────────────────────────────────────╯
```

**中英混杂的品牌意义**：
- 中文体现东方智慧的厚度（Ancient）
- 英文体现现代 AI 的推进感（Modern）
- 两者同时出现 = "古老智慧被现代系统解译"的视觉化

**思考时长动态分级**：

| 问题类型 | 思考时长 | 说明 |
|---|---|---|
| 首次提问（开局） | 20-30 秒 | 最完整的仪式感 |
| 深度追问（需要新分析） | 15-20 秒 | 保持重量感 |
| 澄清 / 短问题 | 5-8 秒 | 不秒回但不拖延 |

**绝不秒回**（下限 5 秒）。思考完成后气泡淡出，正式回复接入。

### 02.3.6 话题漂移检测

**第一层：AI 自行判断**（主要）
System Prompt 中的硬规则约束 AI 在每轮对话中评估话题距离，温柔拉回。详见 02.2.2。

**第二层：技术保险**（次要）
每轮对话后，用 Claude Haiku 做一次轻量语义距离检测（成本约 $0.001/轮）。如果距离超过阈值且 AI 未拉回，后台记录用于优化。第二层**不打断用户体验**。

## 02.4 核心交互设计

### 02.4.1 Chat 页面布局

采用 Gemini 风格的三栏式布局，移动端可收起为全屏。

```
┌──────────┬──────────────────────────────────────┐
│          │  POJU                           [≡]  │
│ POJU     │  ──────────────────────────────────  │
│  Logo    │                                      │
│          │                                      │
│ ✦ New    │       【欢迎引导区 - 首次可见】       │
│   POJU   │                                      │
│   $9.99  │                                      │
│          │                                      │
│ ─────    │                                      │
│          │                                      │
│ [Archive]│                                      │
│ Apr 19   │                                      │
│ "Dad..." │                                      │
│          │                                      │
│ Apr 15   │                                      │
│ [hidden] │                                      │
│          │                                      │
│ Apr 10   │                                      │
│ "Move..."│                                      │
│          │                                      │
│ ─────    │                                      │
│          │                                      │
│ Syncro → │  ──────────────────────────────────  │
│ Oracle → │  [📎] [🎤] Type your reply...  [→]  │
└──────────┴──────────────────────────────────────┘
```

**左侧栏元素**：
- 顶部：POJU Logo（点击返回落地页）
- **✦ New POJU $9.99** 按钮（点击触发新付费）
- 历史对话列表：日期 + 首问题前 6 字脱敏，可重命名、可隐藏
- 工具链接：Syncro / Oracle（同 Tab 内打开，保持 Session 状态）

**移动端**：左侧栏默认收起为汉堡按钮 [≡]。

### 02.4.2 付费后进入 Chat 的提示

免责协议**只在全站首次访问时勾选一次**，之后不再弹。Chat 首次进入显示**非勾选提示**：

```
┌──────────────────────────────────────┐
│ 🔒 This conversation lives only on   │
│    this device. Close to delete.     │
│    [ I understand ]                  │
└──────────────────────────────────────┘
```

点击"I understand"后消失，同一 Session 不再显示。

### 02.4.3 欢迎引导区

付费后进入的第一视觉。**不是 AI 消息**，是页面中央的静态引导区。用户发送第一条消息后，引导区平滑上移消失。

**中文版**：

> 说出困住你的事——事业、家人、感情、钱、健康、人生抉择，都可以。
> 
> 说得越细越好。地点、时间、人物关系、你尝试过什么、你最怕什么。
> 
> 两千年的东方智慧能给你答案，但它需要看清真实的你。
>
> ──
>
> 说完第一段，我会开始为你推演。
> 你说的一切只留在这台设备上，关页即灭。

**英文版**：

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

底部小字提示：**Type below to begin, or tap the microphone to speak.**

### 02.4.4 AI 回复的双阶段

**阶段一：思考过程（临时气泡）**

- 样式：半透明、细边框、浅金色文字
- 内容：中文主体 + 英文 Agent 推进标签
- 流式输出，每 1-2 秒滚动新行
- 时长：5-30 秒动态分级
- 完成后执行淡出 / 折叠动画，**不保留在对话记录中**

**阶段二：正式回复（永久气泡）**

- 语言跟随用户（用户说中文 → 回中文；说英文 → 回英文）
- 典故处理：剥离中文专名，改为"两千年前东方一位忠臣..."这类叙事化表达
- 气泡底部工具栏：[📋 Copy] [🔊 Read Aloud]
- **朗读使用 ElevenLabs Turbo v2.5 付费 API**（中英文质量优于浏览器 TTS，$9.99 用户应得更好体验）

**回复内容约束（System Prompt 硬规则）**：

```
每一次正式回复必须包含：
1. 回应（对用户当前输入的直接回应）
2. 分析（从命理 / 事理 / 心理至少一个层面的推演）
3. 动作（至少一个今天或本周可以启动的具体动作）

禁止的输出：
- 纯哲理（"你要放下执念"）
- 纯鼓励（"你可以的"）
- 纯重复（复述用户说过的话而无新增）
- 数字度数或百分比（"你的运势 67%"——必须转译成"顺风但有乱流"）
- 中文典故的原始人名（苏武 / 关公等——必须叙事化）
- 拼音术语必须保留（QI / Bazi / Wuxing 首次出现不翻译）
```

### 02.4.5 输入栏

```
[📎 Image]  [🎤 Voice]  Type your reply...             [→ Send]
```

**图片上传（📎）**：
- 支持相册选择或相机拍摄
- 用户可上传：面相照、手相照、家居布局、办公桌、八字盘扫描件
- 图像传给 Claude Vision API 分析
- 图片仅在 Session 有效期内保留在本地 IndexedDB（加密）

**语音输入（🎤）**：
- 使用 Web Speech API（免费）
- 实时语音转文字，用户可编辑后发送
- 支持中英文自动检测

**发送（→）**：
- 回车发送（移动端默认换行，有发送按钮）

### 02.4.6 菜单（≡）

右上角菜单包含：

```
✦ Save this as PDF           (仅在 Phase 5 完成行动方案后可用)
✦ Summon Syncro              (召唤方位能量场面板)
✦ Summon Oracle              (召唤启示卡片面板)
✦ Archive this session       (折叠，可恢复)
✦ End & Wipe this session    (彻底销毁，二次确认)
```

### 02.4.7 AI 起手问诊范式

第一次付费用户进入 Chat，输入第一条消息后，AI 的第一次回复**禁止直接给答案**。

标准起手模板：

```
在回答你这个问题之前，我需要先看清你这个人。

辞不辞职不是一道选择题，是你这个人在这个时机要不要做这个动作。
我得先认识你。

告诉我：
· 你的出生：哪一年、哪一月、哪一天
· 大概是哪个时辰（凌晨 / 清晨 / 上午 / 中午 / 下午 / 傍晚 /
  夜晚 / 深夜，12 时辰段之一）
  （不记得精确时间没关系，有个大概就行）
· 这份工作你做了多久
· 让你想辞的，是一件具体的事，还是一种感觉

别急，慢慢答。
```

**八字信息的后台处理**：
- 用户给出大致年月日 + **12 时辰段**（见 02.4.8 的 12 时辰表）
- 后台使用 `lunar-javascript` 库确定性计算八字（不走 AI）
- 完全不知道时辰 → 用"无时柱八字"（精度标注为 75%）
- AI 必须诚实告知："没有时辰，这个层面我只能看个大概"

### 02.4.8 12 时辰段选择

用户在下拉选择时看到的选项：

| 英文时段 | 英文标签 | 拼音 | 时辰 |
|---|---|---|---|
| 11 PM – 1 AM | Midnight | Zi | 子 |
| 1 AM – 3 AM | Late Night | Chou | 丑 |
| 3 AM – 5 AM | Pre-Dawn | Yin | 寅 |
| 5 AM – 7 AM | Sunrise | Mao | 卯 |
| 7 AM – 9 AM | Morning | Chen | 辰 |
| 9 AM – 11 AM | Late Morning | Si | 巳 |
| 11 AM – 1 PM | Noon | Wu | 午 |
| 1 PM – 3 PM | Early Afternoon | Wei | 未 |
| 3 PM – 5 PM | Afternoon | Shen | 申 |
| 5 PM – 7 PM | Sunset | You | 酉 |
| 7 PM – 9 PM | Evening | Xu | 戌 |
| 9 PM – 11 PM | Night | Hai | 亥 |
| — | Not sure | — | Unknown |

设计原则：
- 西方用户看时段秒懂
- 拼音保留做异域感品牌元素
- "Not sure"保留降级路径
- 滚轮选择式 UI（类似 iOS 日期选择器）

### 02.4.9 召唤 Syncro / Oracle

当 AI 判断需要辅助分析时，**不让用户跳转页面**，而是在 Chat 内嵌弹出面板。

典型交互：

```
AI: "你办公桌这事我想先确认一下。
     打开下面这个，对着你的桌子拍一张——
     我需要精确方位才能继续。"

[ ✦ Summon Syncro ]     ← 可点击按钮，AI 回复内嵌入

用户点击 → 底部抽屉弹出完整 Syncro 面板
用户完成拍照精准定位 → 结果回传 → 抽屉关闭

AI: "拿到了。你桌子朝东南偏南一点，这个方位今天下午到明早..."
```

**关键规则**：所有 AI 回复中提到方位，必须用自然语言（"东南偏南一点"），**禁止直接使用度数**（如 347°）。

## 02.5 会话结束与数据销毁

### 02.5.1 用户决定结束（非 AI 决定）

POJU 废除了原"AI 判定收局"概念。**只有用户能决定议题何时结束**，AI 永不做此决定。

用户结束方式有二：

**Archive this session**
- 用户说"这个议题我放一放，以后可能再回来"
- 折叠到 The Archive，数据保留
- 左侧栏可见，随时点击恢复对话

**End & Wipe this session**
- 用户说"这个议题我看透了 / 不想再看了 / 结束了"
- 彻底销毁本地所有数据
- 二次确认弹窗（见 02.5.3）

### 02.5.2 PDF 导出时机

PDF 在**每次 Phase 5 生成完整行动方案后**，在那条消息底部出现低调按钮：

```
[ ✦ Save this reading as PDF ]
```

**不自动弹窗，不打断对话**。用户可以：
- 立即保存 → 作为"本周行动指南"的物理提醒
- 继续对话 → 深化讨论
- 稍后保存 → 下次再想起

**成本护栏**：同一 Session 最多生成 5 份 PDF（应对用户多次实操 + 更新行动方案）。超过 5 次显示 "You've saved this reading 5 times. Ready to close this chapter?"

### 02.5.3 End & Wipe 二次确认

```
┌──────────────────────────────────────┐
│                                      │
│      End and wipe this session?      │
│                                      │
│   Everything in this conversation    │
│   will be gone forever.              │
│   This cannot be undone.             │
│                                      │
│   💨 Before you close: want your     │
│      reading as a keepsake PDF?      │
│                                      │
│     [ Save PDF first → ]             │
│     [ Wipe without saving ]          │
│     [ Cancel ]                       │
│                                      │
└──────────────────────────────────────┘
```

### 02.5.4 PDF 强制邮箱路径

不提供"直接下载 PDF"选项，所有 PDF 必须通过邮件发送。

邮箱输入面板同时承担"回访 check-in 留存"功能：

```
┌──────────────────────────────────────┐
│                                      │
│      Where should we send it?        │
│                                      │
│  [ your.email@example.com        ]   │
│                                      │
│  Your reading will arrive in minutes.│
│                                      │
│  ┌──────────────────────────────┐   │
│  │  Also, this:                 │   │
│  │                              │   │
│  │  Your actions need time to   │   │
│  │  settle. I'd like to send    │   │
│  │  you ONE check-in email      │   │
│  │  on [Apr 30].                │   │
│  │                              │   │
│  │  That's it. No marketing.    │   │
│  │  Deleted after sending.      │   │
│  └──────────────────────────────┘   │
│                                      │
│  [ Send me both ]                    │
│  [ Just the PDF, no check-in ]       │
│                                      │
└──────────────────────────────────────┘
```

用户邮箱仅用于：
1. 立即发送 PDF 报告（1 次）
2. 在 AI 计算的"回访日"发送 check-in 邮件（1 次，可选）

发送完成后，邮箱在 Resend/SendGrid 中 24 小时内自动物理删除。

### 02.5.5 动态回访时间计算

AI 根据行动方案的性质动态计算回访时间（**不再是"一个月"死话**）：

| 行动性质 | 建议回访 |
|---|---|
| 一次性动作（打电话、写信、一次对话） | 3 天 |
| 短期调整（换座位、调整作息 1 周） | 7 天 |
| 中期习惯（冥想、运动、写日记 2-4 周） | 14-21 天 |
| 长期转变（换工作、搬家、结束关系） | 30-60 天 |
| 命理流年变化（等待运势周期） | 90 天 |

AI 在 Phase 5 生成行动方案时，会在响应中输出 `<check_in_schedule>` 结构化标签，后端解析后用于定时邮件。

## 02.6 PDF 报告规范

**封面页**：
- POJU Logo + "A Personal Reading"
- Session 日期 / 议题标题（AI 总结）
- "For [User's first name if given]"（可选）

**内容页**：
- 困局全貌（AI 从对话中提炼）
- 信息档案（八字、方位、关键关系）
- 破局分析（命理层 / 事理层 / 智慧框架）
- 破解之道（行动分三层：今天 / 本周 / 持续）

**回访页**：
- "Come back on [计算出的回访日]"
- 回访时提醒用户可以问什么

**封底**：
- 免责声明
- pojulife.com
- "Your PDF is encrypted. Your email will be deleted after we send it."

**技术实现**：
- Puppeteer 服务端渲染 HTML → PDF
- 中文字体：思源宋体 / 思源黑体
- 英文字体：衬线 EB Garamond + 无衬线 Inter
- 规格：A4，单面，可打印，黑白友好

## 02.7 技术栈摘要

| 模块 | 技术选型 |
|---|---|
| Agent 框架 | 自建，基于 Claude Sonnet 4.5 Extended Thinking |
| RAG | Supabase + pgvector + text-embedding-3-small |
| 话题检测 | Claude Haiku（轻量层） |
| 语音输入 | Web Speech API (STT) |
| 朗读 | **ElevenLabs Turbo v2.5 API**（付费） |
| 图片分析 | Claude Vision |
| 本地存储 | IndexedDB + AES-256-GCM |
| 设备指纹 | FingerprintJS |
| 支付 | Stripe / Paddle（待定，Provider 抽象） |
| 邮件 | Resend + Scheduled Send API |
| PDF 生成 | Puppeteer + 中文字体 |
| 前端框架 | Next.js 14 App Router + PWA |

详细技术规范见第 05-06 章。


---

# 第 03 章 · POJU Syncro（临时名）

> Syncro 是空间维度的免费引流产品。本章定义它的完整产品规范。
> 最终命名待定（可能是新造词），文档全局 "Syncro" 为占位符。
>
> 本章所有内容已合并 v3.0.1 的纯前端锁定机制 + 职业/性别输入 + 双层数据结构等修订。

## 03.1 产品定义

Syncro 是一个基于 **3D 粒子能量球 + 摄像头伪 AR + 方位吉凶 AI 分析** 的免费体验产品。

核心价值主张（对西方用户）：

> **See how your energy aligns with the space around you.**
> 
> Two thousand years ago, Eastern traditions observed that human focus, luck, and outcome shift with direction and timing. Modern science echoes this — magnetic fields affect cognition, spatial orientation shapes decision-making, circadian cycles drive our biology.
> 
> Syncro reads your **Bazi** (birth chart), your **location**, and **this exact moment**, then shows you which direction carries what energy — and what to do with it.

关键特征：

- **完全免费**，不收费也不内置付费点
- **引流到 POJU**：每次方位分析结果下方都有"Ask POJU to go deeper · $9.99"钩子
- **基于设备端传感器**：GPS + 罗盘 + 加速度计 + 摄像头
- **平放俯瞰 + AR 沉浸双模式**：手机姿态自动切换
- **每时辰刷新**（对应中国十二时辰，2 小时一次），AI 重新计算方位吉凶
- **实时感知**：粒子球跟随手机朝向实时旋转
- **精准拍照**：用户对着具体物体（办公桌 / 床 / 门）拍照，获取该精确方位的 24 小时分析
- **纯前端锁定机制**保证同设备同时辰同位置的一致性，无需云端存储

## 03.2 用户输入三项基本信息

Syncro 首次使用时用户需要输入三项（之后永久保存在 localStorage，重复使用时预填，可随时修改）：

### 03.2.1 出生信息（Bazi）

- 年月日：滚轮式选择器（类似 iOS 日期选择器）
- 时辰：12 时辰段下拉（见 02.4.8 表格）
- **不需要出生地点**（保持产品轻量）

### 03.2.2 性别（Gender）

- Male / Female / Other
- 影响 AI 对特定方位的个性化建议（不同性别在某些术数场景下建议会有差异）

### 03.2.3 职业（Profession）

**12 项预设 + 自定义输入**：

```
Common Professions (preset)
  · Lawyer / Legal
  · Doctor / Medical
  · Teacher / Educator
  · Engineer / Developer
  · Artist / Creative
  · Entrepreneur / Founder
  · Finance / Investment
  · Sales / Marketing
  · Manager / Executive
  · Student
  · Retired
  · Homemaker

Or type your own: [____________________]
```

**为什么需要预设**：AI 对标准职业类别的响应更稳定。自定义输入满足特殊场景（"我是脱口秀演员"）。

**为什么要一直保留输入功能**（不能永久隐藏）：
- 用户的手机可能被家人朋友借去使用
- 用户换工作 / 多职业身份切换
- 用户要求修改时必须能修改

## 03.3 双层叙事：现代科学 × 东方智慧

Syncro 对西方用户的合法性来自"双层叙事"：

**第一层 · 现代科学锚点**（页面显著位置）：

```
Science has observed:

· Magnetic fields affect cognitive performance
  — Journal of Cognitive Neuroscience

· Spatial orientation shapes decision quality
  — Environmental Psychology Review

· Circadian cycles drive biological rhythms
  — Nature · Circadian Biology

· Visual direction influences focus and stress
  — Stanford Environmental Research
```

（实际上线时需要引用真实研究，由合规律师审核。）

**第二层 · 东方智慧桥梁**：

```
Eastern traditions have observed these patterns
for over 2,000 years — and named them.

QI (气)     The flow of energy through space.
BAZI (八字)  Your birth chart: the timing imprint you carry.
XUAN (玄)    The unseen architecture between space and self.

Syncro uses AI to translate these ancient observations
into directions you can navigate today.
```

**第三层 · 个人化交付**（核心交互）：
粒子球 + 方位数据 + "今天这个方向对你做 X 有利"

## 03.4 核心使用场景

**场景 A · 日常好奇（18+ 用户）**
> "Where should I sit in this café to study?"

**场景 B · 商务决策（核心付费转化来源）**
> "I have a negotiation at 3 PM. Where should I sit?"
>
> 结果：**"Today 2-4 PM, your wealth direction points southeast. Sit facing southeast. Avoid signing contracts before 2 PM — your Wu (戊) energy is scattered."**

**场景 C · 居家与办公（精准拍照）**
> "Is my bed in a good spot?" → AR 模式 → 拍床头 → 获取朝向的 24 小时分析

**场景 D · 出行决策**
> "Should I drive or stay home this afternoon?"

**场景 E · 与 POJU 联动**
> POJU Chat 中 AI 召唤 Syncro → 用户完成方位分析 → 数据回传

## 03.5 八方位属性系统

基于用户 Bazi + 当前时辰 + 当前位置，AI 计算出八方位的属性。

### 03.5.1 Rating 五级标准

```
Excellent  ✦✦✦✦✦
Good       ✦✦✦✦
Neutral    ✦✦✦
Weak       ✦✦
Poor       ✦
```

### 03.5.2 报告渲染格式（手机端）

**AI 返回的结构化输出** + **手机前端渲染的格式**如下：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYNCRO READING
Shen hour (3 PM – 5 PM) · Apr 20, 2026
39.68°N, 75.75°W · Newark, DE
Yi-Wood Day Master · M · Lawyer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Valid until You hour (5 PM EDT)

┌──────────┬──────────┬─────────────────┬─────────────────┐
│ Direction│ Rating   │ Best For...     │ Avoid...        │
├──────────┼──────────┼─────────────────┼─────────────────┤
│          │          │ Growth &        │ Loud noises or  │
│ East     │ Excellent│ Healing. Perfect│ physical        │
│          │ ✦✦✦✦✦    │ for brainstorm- │ renovations.    │
│          │          │ ing long-term   │                 │
│          │          │ goals...        │                 │
├──────────┼──────────┼─────────────────┼─────────────────┤
│          │          │ Deep Rest.      │ High-stakes     │
│ Southeast│ Good     │ Ideal for       │ negotiations or │
│          │ ✦✦✦✦     │ meditation or   │ intense         │
│          │          │ clearing        │ workouts.       │
│          │          │ anxiety.        │                 │
├──────────┼──────────┼─────────────────┼─────────────────┤
│          │          │ Inspiration.    │ Overthinking;   │
│ South    │ Neutral  │ Good for        │ watch for       │
│          │ ✦✦✦      │ creative        │ "mental burnout"│
│          │          │ writing or      │ or irritability.│
│          │          │ "big picture"   │                 │
│          │          │ thinking.       │                 │
├──────────┼──────────┼─────────────────┼─────────────────┤
│          │          │ Nothing. This   │ Crucial: Avoid  │
│ Southwest│ Poor     │ is the          │ making big      │
│          │ ✦        │ "Stagnant Zone."│ decisions or    │
│          │          │ Energy is at    │ starting travels│
│          │          │ its lowest here.│ in this         │
│          │          │                 │ direction.      │
├──────────┼──────────┼─────────────────┼─────────────────┤
│          │ Weak     │ Minor Chores.   │ Sleeping here   │
│ West     │ ✦✦       │ Tidying up      │ if you're prone │
│          │          │ small things.   │ to nightmares   │
│          │          │                 │ or anxiety.     │
├──────────┼──────────┼─────────────────┼─────────────────┤
│          │          │ Organization.   │ Starting brand- │
│ Northwest│ Neutral  │ Reviewing the   │ new projects;   │
│          │ ✦✦✦      │ past and        │ the "gate" for  │
│          │          │ organizing      │ new business is │
│          │          │ your thoughts.  │ closed.         │
├──────────┼──────────┼─────────────────┼─────────────────┤
│          │          │ Observation.    │ Direct          │
│ North    │ Fair     │ Quietly         │ confrontation   │
│          │ ✦✦✦      │ watching and    │ or public       │
│          │          │ learning        │ speaking.       │
│          │          │ without being   │                 │
│          │          │ seen.           │                 │
├──────────┼──────────┼─────────────────┼─────────────────┤
│          │          │ Solitude. Deep  │ Rushing; things │
│ Northeast│ Good     │ research,       │ will move       │
│          │ ✦✦✦✦     │ technical work, │ slowly here.    │
│          │          │ or keeping      │                 │
│          │          │ secrets.        │                 │
└──────────┴──────────┴─────────────────┴─────────────────┘

[✦ Ask POJU to go deeper · $9.99]
```

**此表格就是 AI 的结构化输出渲染到手机上的标准呈现**。平放模式下用户可查看完整 8 方位表格；AR 模式下中心视窗只显示手机当前朝向的那个方位行。

### 03.5.3 AR 模式中心视窗显示

手机朝向哪个方位，视窗就显示该方位的 Row：

```
┌────────────────────────┐
│                        │
│  EAST · Zhen Palace    │
│  ✦✦✦✦✦ Excellent       │
│                        │
│  ── Best For ──        │
│  Growth & Healing.     │
│  Perfect for brain-    │
│  storming long-term    │
│  goals.                │
│                        │
│  ── Avoid ──           │
│  Loud noises,          │
│  renovations.          │
│                        │
└────────────────────────┘
```

手机旋转切换方位 → 视窗内容 **300ms 渐变过渡**（不是瞬间闪烁）。

### 03.5.4 AI 输出的 JSON 结构（含双层数据）

AI 返回的结构化 JSON，用于手机端渲染上述表格：

```json
{
  "metadata": {
    "generated_at": "2026-04-20T15:47:00-04:00",
    "shichen": {
      "id": "shen",
      "pinyin": "Shen",
      "chinese": "申",
      "label": "Afternoon",
      "range": "3 PM – 5 PM"
    },
    "valid_until": "2026-04-20T17:00:00-04:00",
    "location": {
      "lat": 39.6837,
      "lng": -75.7497,
      "geohash_6": "dq4xy8",
      "magnetic_declination": -11.3,
      "solar_time_adjusted": "15:47 local solar"
    },
    "user": {
      "bazi_summary": "Yi-Wood Day Master",
      "gender": "M",
      "profession": "Lawyer"
    }
  },
  
  "directions_core": {
    "E":  { "palace": "Zhen (震)",    "flying_star": "5-Yellow", "element_interaction": "Wood × Metal", "rating": "Excellent", "stars": 5 },
    "SE": { "palace": "Xun (巽)",     "flying_star": "9-Purple", "element_interaction": "Wood + Fire",  "rating": "Good",      "stars": 4 },
    "S":  { "palace": "Li (离)",      "flying_star": "1-White",  "element_interaction": "Fire + Water", "rating": "Neutral",   "stars": 3 },
    "SW": { "palace": "Kun (坤)",     "flying_star": "2-Black",  "element_interaction": "Earth clash",  "rating": "Poor",      "stars": 1 },
    "W":  { "palace": "Dui (兑)",     "flying_star": "7-Red",    "element_interaction": "Metal conflict","rating": "Weak",     "stars": 2 },
    "NW": { "palace": "Qian (乾)",    "flying_star": "6-White",  "element_interaction": "Metal stable", "rating": "Neutral",   "stars": 3 },
    "N":  { "palace": "Kan (坎)",     "flying_star": "4-Green",  "element_interaction": "Water + Wood", "rating": "Fair",      "stars": 3 },
    "NE": { "palace": "Gen (艮)",     "flying_star": "8-White",  "element_interaction": "Earth + Wood", "rating": "Good",      "stars": 4 }
  },
  
  "narrative_by_profession": {
    "Lawyer": {
      "E":  { "best_for": { "title": "Growth & Healing", "description": "Perfect for brainstorming long-term goals or health-related thoughts." }, "avoid": "Loud noises or physical renovations." },
      "SE": { "best_for": { "title": "Deep Rest", "description": "Ideal for meditation or clearing anxiety." }, "avoid": "High-stakes negotiations or intense workouts." },
      "S":  { "best_for": { "title": "Inspiration", "description": "Good for creative writing or big picture thinking." }, "avoid": "Overthinking; watch for mental burnout or irritability." },
      "SW": { "best_for": { "title": "Nothing", "description": "This is the Stagnant Zone. Energy is at its lowest here." }, "avoid": "Crucial: Avoid making big decisions or starting travels in this direction." },
      "W":  { "best_for": { "title": "Minor Chores", "description": "Tidying up small things." }, "avoid": "Sleeping here if you're prone to nightmares or anxiety." },
      "NW": { "best_for": { "title": "Organization", "description": "Reviewing the past and organizing your thoughts." }, "avoid": "Starting brand-new projects; the gate for new business is closed." },
      "N":  { "best_for": { "title": "Observation", "description": "Quietly watching and learning without being seen." }, "avoid": "Direct confrontation or public speaking." },
      "NE": { "best_for": { "title": "Solitude", "description": "Deep research, technical work, or keeping secrets." }, "avoid": "Rushing; things will move slowly here." }
    }
  },
  
  "science_notes": [
    "At this time, your body's cortisol is in its mid-afternoon trough.",
    "Eastern traditions mark Shen as a period of 'Wu Wei' — natural convergence."
  ]
}
```

**前端渲染逻辑**：
- `directions_core` 提供方位命理数据（Rating / Palace / 五行）—— **与职业无关，不变**
- `narrative_by_profession` 提供每个职业的具体建议 —— **按职业切换**
- 两者组合 = 最终渲染的表格行

## 03.6 双模式交互

### 03.6.1 平放模式（Overhead Mode）

手机平放在桌面，听筒方向 = 当前地理正前方。

**视觉**：
- 屏幕中央：3D 粒子能量球（俯视视角，用户在球外部观察）
- 粒子颜色：深空紫蓝为底 + 金色高光
- 粒子数量：旗舰机 5000 / 中端 2000 / 低端 800（自动分级）
- 粒子流动：以 Curl Noise 驱动，呈现"能量场呼吸"
- 8 方位标识：球体周围浮现 8 个光点，对应 N / NE / E / SE / S / SW / W / NW
- 屏幕下方：可展开完整 8 方位表格（见 03.5.2）

**数据层**：
- 当前手机朝向高亮对应方位的粒子
- 方位属性色（Wealth / Focus / Love / Health / Helper / Conflict / Loss / Shadow）
- 每 2 小时整点触发刷新

**交互**：
- 手指可拖拽旋转视角
- 轻点某个方位 → 展开该方位的详细建议卡片

### 03.6.2 AR 模式（Immersive Mode）

手机竖立，摄像头方向 = 当前地理正前方。

**自动切换**：
- 加速度计检测到手机从平放（z 轴 > 0.8）转为竖立（z 轴 < 0.3）→ 自动切换到 AR 模式
- 用户可手动锁定任一模式（右上角锁定按钮）

**视觉**：
- 屏幕占满粒子能量球（用户在球内部）
- 中央**圆形视窗**：实时显示摄像头画面
- 视窗边缘：**极简渐变光晕**（颜色随当前朝向方位属性改变）
  - 金白光 = 财富位
  - 蓝光 = 文昌位
  - 粉光 = 桃花位
  - 绿光 = 健康位
  - 紫光 = 贵人位
  - 暗红 = 祸害位
  - 灰 = 破财位
  - 暗灰 = 小人位
- 视窗上下方：方位名 + 评级 + 完整的 Best For / Avoid 卡片（见 03.5.3）

**关键技术**：
- 摄像头画面**不上传、不分析、不记录**
- `getUserMedia` + `<video>` + Three.js texture 本地渲染
- 视窗 mask 用 SVG clip-path 实现

**交互**：
- 转动手机 → 粒子球和视窗内容同步变化
- 长按视窗 1 秒 → 触发精准拍照

## 03.7 精准拍照模式

AR 模式下，用户长按视窗 1 秒 → 触发精准拍照。

**交互仪式**：
```
长按 1 秒 → 视窗边缘光晕收缩到中心（快门效果）
  ↓
画面冻结 0.5 秒（仪式感）
  ↓
粒子球缩小到画面中央 → 一束光从天而降打在画面上
  ↓
2 秒加载动画 → "Reading the signal from this direction..."
  ↓
结果浮出：专属该方向的 24 小时滚动吉凶分析
```

**采集数据**：
- 时间戳
- GPS 经纬度
- 精确方位角（azimuth，**内部使用，不展示**）
- 俯仰角
- 用户 Bazi

**展示给用户的方位**：
- 绝不使用"347°"
- 改用自然语言："Facing Northwest, slightly toward North"
- AI 在翻译时保持精度但表达方式人性化

**结果内容**：
- 专属该方向的 24 小时分段分析
- 对该方向最有利的行为
- 对该方向最不利的行为
- 底部钩子："Want to know why? Ask POJU · $9.99"

**用户给这个方位起名**：
- 拍照完成后弹出输入框："Name this direction"
- 例如 "My desk" / "My bed" / "Office facing Hudson"
- **照片不保存**，只保存方位数据 + 用户命名 + 时间戳 + 结果文本

## 03.8 纯前端锁定机制（v3.0.1 核心）

### 03.8.1 设计目标

防止用户连续多次打开时 AI 给出不一致结果（一致性危机会摧毁用户信任）。

**不使用云端存储**（符合 Never stored 品牌承诺），而用**纯客户端三维度锁定**：

```
锁定键 = bazi_hash + geohash_6 + shichen_id + gender
  · bazi_hash:   八字的哈希
  · geohash_6:   6 字符 Geohash（约 600m 精度）
  · shichen_id:  "YYYY-MM-DD-shichen"（时辰归属日期，避免跨午夜问题）
  · gender:      进入缓存键
```

**Geohash 边界问题的处理**：
生成 9 个 geohash（当前格 + 8 个邻居），查询时任一命中即可命中缓存。这解决"两用户仅相距 300m 但正好分别在两个 geohash 格子"的问题。

### 03.8.2 登录页的双区结构

登录页分两个可独立控制的区域：

**区域 A · 教学区（可关闭）**
- 内容：Syncro 学理简介（Ganzhi / Bagua / Wuxing / Kanyu，见第 03A 章）+ 使用说明
- 底部勾选 "Don't show this again"
- 勾选后 localStorage 记 flag，下次进入时该区域默认隐藏
- 用户可手动点"?"图标重新展开

**区域 B · 信息输入区（永久显示）**
- 三个字段：Bazi / Gender / Profession
- 预填上次填写的值
- 底部 `[ Begin Reading → ]` 按钮
- **永远显示** —— 因为手机借用 / 换职业等场景需要修改

### 03.8.3 Begin 按钮的五种分支逻辑

```typescript
async function onBeginClick() {
  const newInfo = readFormFields();
  const oldInfo = readLocalStorage();
  const cached = await getSyncroCacheEntry();
  const now = { 
    shichen: getCurrentShichenId(),      // "2026-04-20-shen"
    geohash: await getCurrentGeohash(),  // 6-char geohash
  };
  
  saveToLocalStorage(newInfo);  // 永久保存
  
  // 分支 1：首次使用 / 缓存已清
  if (!cached) {
    return generateFullNewReading(newInfo, now);
  }
  
  const baziChanged = newInfo.bazi !== oldInfo.bazi;
  const genderChanged = newInfo.gender !== oldInfo.gender;
  const professionChanged = newInfo.profession !== oldInfo.profession;
  const shichenMatch = cached.shichen_id === now.shichen;
  const locationMatch = isInGeohashNeighbors(cached.geohash_6, now.geohash);
  
  // 分支 2：不同的人（Bazi / Gender 变了）
  if (baziChanged || genderChanged) {
    clearCache();
    return generateFullNewReading(newInfo, now);
  }
  
  // 分支 3：同人但时辰变了 / 位置跨区了
  if (!shichenMatch || !locationMatch) {
    return generateFullNewReading(newInfo, now);
  }
  
  // 分支 4：同人同时辰同位置，只改职业
  if (professionChanged) {
    const existingNarrative = cached.narrative_by_profession[newInfo.profession];
    if (existingNarrative) {
      // 本地命中：零 AI 调用
      return renderReading(cached.directions_core, existingNarrative);
    } else {
      // 只调叙事层 AI（token 消耗降 60%）
      return regenerateNarrativeOnly(cached, newInfo.profession);
    }
  }
  
  // 分支 5：一切未变，直接渲染缓存
  return renderReading(cached);
}
```

**场景对照**：

| 场景 | 八字 | 性别 | 职业 | 时辰 | 位置 | 处理方式 |
|---|---|---|---|---|---|---|
| 首次使用 | 新 | 新 | 新 | - | - | 全量生成 |
| 朋友借手机 | **变** | 可能变 | 变 | 无论 | 无论 | 全量生成 + 清空缓存 |
| 同人换职业 | 同 | 同 | **变** | 同 | 同 | 只重写叙事层（降 60% 成本） |
| 同人同职业再看 | 同 | 同 | 同 | 同 | 同 | 本地命中，零调用 |
| 时辰变了 | 同 | 同 | 同 | **变** | 同 | 全量生成（新的局） |
| 用户走远了 | 同 | 同 | 同 | 同 | **变** | 全量生成（新地理） |

### 03.8.4 时辰切换的自动仪式

App 内运行时计算到下一时辰的毫秒数，整点触发：

```typescript
useEffect(() => {
  const msUntilNext = getMsUntilNextShichen();
  
  const timer = setTimeout(async () => {
    await playShichenTransitionAnimation();  // 粒子球旋转渐变 2s
    await showTransitionToast("A new hour begins. Recalibrating...");
    await regenerateReading();
    setupNextShichenTimer();
  }, msUntilNext);
  
  return () => clearTimeout(timer);
}, [currentShichenId]);
```

**UI 提示**（时辰切换瞬间）：
```
┌──────────────────────────────────┐
│   ✦ Shen hour has closed.        │
│   You hour (Sunset) begins.      │
│   Your field is being retuned... │
└──────────────────────────────────┘
```

### 03.8.5 分层数据结构（IndexedDB）

```typescript
interface SyncroCacheEntry {
  // ─── 锁定键（查询匹配）───
  bazi_hash: string;         // 八字哈希
  gender: string;
  geohash_6: string;
  shichen_id: string;        // "YYYY-MM-DD-shichen"
  generated_at: Date;
  valid_until: Date;
  
  // ─── 命理层（Bazi + 时辰 + 位置 唯一决定）───
  directions_core: {
    E: { palace, flying_star, element_interaction, rating, stars },
    // ... 其余 7 方位
  };
  
  // ─── 叙事层（按职业分别缓存）───
  narrative_by_profession: {
    "Lawyer": {
      E: { best_for: { title, description }, avoid },
      // ... 8 方位
    };
    "Chef": { /* 同结构 */ };
    // 用户用过的每个职业都缓存
  };
  
  current_profession: string;
  
  // ─── 元数据 ───
  metadata: {
    solar_time_adjusted: string;
    magnetic_declination: number;
    last_gps: { lat: number; lng: number };
  };
}
```

**职业多次切换的优化**：
- 第一次填 "Lawyer" → 生成命理 + Lawyer 叙事 → 缓存
- 切换到 "Chef" → 命理层已有，只调叙事层 AI → 缓存 Chef 叙事
- 再切回 "Lawyer" → **本地直接命中，0 调用**

### 03.8.6 GPS 稳定性缓冲

室内 GPS 漂移可达 500-2000m，不能让漂移误触发"离开范围"。

```typescript
function isGPSStable(currentGPS, lastGPS): boolean {
  const distance = haversineDistance(currentGPS, lastGPS);
  
  if (distance < 200) return true;           // 明显未移动
  if (distance < 1000) {
    // 可能是漂移，持续观察 60 秒
    const recentSamples = getRecentGPSSamples(60);
    const avg = averagePosition(recentSamples);
    if (haversineDistance(avg, lastGPS) < 500) return true;
  }
  if (distance > 5000) return false;          // 确定已移动
  return false;
}
```

**位置跨区提示**（检测到用户已明显移动）：
```
┌─────────────────────────────────┐
│                                 │
│  You've traveled.               │
│                                 │
│  Recalibrate your energy field  │
│  for this new location?         │
│                                 │
│  [ Yes, recalibrate ]           │
│  [ Keep current reading ]       │
│                                 │
└─────────────────────────────────┘
```

## 03.9 时间维度：每 2 小时刷新

对应中国十二时辰系统。

**刷新逻辑**：
- 触发时点：本地时间的 01:00、03:00、05:00 ... 23:00 整点
- 自动在后台调用 AI API 重新计算
- 粒子球 UI 触发"旋转渐变"动画

**显示**：
- 屏幕顶部有一个低调的时辰倒计时："Next shift in 1h 23m"
- 点击展开：当前时辰的名字（Zi / Chou / Yin...）+ 下一时辰的预告

## 03.10 AI API 调用成本估算

**成本测算**（Claude Sonnet 4.5）：
- 输入：约 2000 tokens（Bazi + location + 时辰 + 系统 Prompt）
- 输出：约 1500 tokens（8 方位数据 JSON + 叙述）
- 单次成本：约 $0.024

**用户端使用**：
- 纯前端锁定后实际 AI 调用次数大幅降低
- 同时辰同地点连续打开 = 0 调用
- 仅时辰切换 / 地点切换 / 职业首次使用时才调用
- 预估每用户日均 AI 成本：$0.05 – $0.10

**1000 DAU 月成本**：约 $50-100。完全可承受。

## 03.11 结果导出（PNG 分享）

Syncro 的结果可导出分享，作为 POJU 的引流载体。

### 03.11.1 导出格式

- **PNG 9:16**（竖屏，IG Story 原生尺寸，TikTok 兼容）
- 不做 PDF（保持轻量、易分享）
- 一键保存到相册或发送

### 03.11.2 导出内容模板

```
┌──────────────────────────────────────┐
│                                      │
│        ✦  POJU  ✦                    │
│                                      │
│   YOUR ENERGY MAP                    │
│   Shen hour · April 20, 2026         │
│   Newark, DE                         │
│                                      │
│        [粒子球快照 · 金白为主]        │
│                                      │
│   ────────  WEALTH  ────────         │
│   Southeast · Strong                 │
│   Best for: signing, pitching        │
│                                      │
│   ────────  FOCUS  ────────          │
│   Northeast · Clear                  │
│   Best for: writing, study           │
│                                      │
│   ────────  AVOID  ────────          │
│   Northwest · Scattered              │
│   Avoid: decisions, confrontation    │
│                                      │
│   ──────────────────────────         │
│                                      │
│   This is just the surface.          │
│   Ask POJU to see what's underneath. │
│                                      │
│   One question · $9.99               │
│   pojulife.com                       │
│                                      │
└──────────────────────────────────────┘
```

### 03.11.3 精准拍照的导出变体

```
┌──────────────────────────────────────┐
│                                      │
│        ✦  POJU  ✦                    │
│                                      │
│   MY DESK                            │  ← 用户命名
│   Facing Northwest, slightly North   │  ← 自然语言方位
│   April 20, 2026 · 3:47 PM EDT       │
│                                      │
│   NEXT 24 HOURS                      │
│                                      │
│   ✦ 2 PM – 4 PM    Flowing           │
│   ✦ 4 PM – 6 PM    Clear             │
│   ✦ 6 PM – 8 PM    Shaded            │
│   ✦ 8 PM – 10 PM   Still             │
│   ... (continues for full 24h)       │
│                                      │
│   ──────────────────────────         │
│                                      │
│   This direction is shaping          │
│   something deeper in your life.     │
│                                      │
│   Ask POJU to decode it · $9.99      │
│   pojulife.com                       │
│                                      │
└──────────────────────────────────────┘
```

## 03.12 PWA + 移动端专属

**Syncro 是移动端专属产品**。PC 端访问 /syncro 页面时：

- 不展示粒子球
- 显示产品介绍 + 宣传视频 + 扫码打开手机
- 提示："Syncro needs your phone's compass, GPS, and camera. Open on mobile."
- 提供：
  - 二维码（扫码访问 pojulife.com/syncro 手机版）
  - "Send me the link"（用户输入手机号接收 SMS 链接）

**PWA 安装引导**：
- iOS Safari：用户首次进入 Syncro 页面，弹出半屏引导动画示范"Tap Share → Add to Home Screen"
- Android Chrome：自动弹出"Install app"横幅

## 03.13 首次使用流程

```
用户首次进入 /syncro（已同意全站免责）
  ↓
Step 1 · 设备权限请求
  "Syncro needs your compass, location, and camera."
  [ Grant permissions ]
  ↓
Step 2 · iOS 罗盘特殊授权
  "Tap the button to activate your compass"
  (iOS 13+ 强制，必须用户主动触发)
  ↓
Step 3 · 罗盘校准引导
  "Hold your phone and draw a figure-8 in the air"
  (动画示范 ∞ 字手势，直到磁力计数据稳定)
  ↓
Step 4 · 双区登录页
  · 教学区（可关闭并记住）
  · 信息输入区（Bazi + Gender + Profession）
  ↓
Step 5 · 首次 AI 分析
  粒子球从静态变为流动
  "Reading your energy signal..."
  约 3-5 秒
  ↓
Step 6 · 进入主界面
  平放俯瞰模式 / AR 沉浸模式（自动根据姿态）
```

## 03.14 磁场干扰与校准

### 03.14.1 干扰检测

室内磁场误差可达 30-90°。

**检测方法**：
- 连续 3 秒采样罗盘数据，波动 > 15°/秒 → 判定干扰
- 同时检测 `webkitCompassAccuracy`（iOS）或 `alpha` accuracy（Android）

**干扰提示**：
```
⚠️  Nearby metal, electronics, or magnets may 
    distort your reading.
    
    Move to an open area and try again.
    
    [ Got it ]
```

### 03.14.2 真北 vs 磁北

地理位置不同，磁偏角从 0° 到 20° 不等。

- 使用 World Magnetic Model (WMM) 或 NOAA API 获取当前位置的磁偏角
- 罗盘数据自动修正为真北
- 用户无感知

## 03.15 性能与电池考量

**性能分级**（自动检测 GPU 能力）：

| 设备类型 | 粒子数 | Shader 复杂度 | 帧率 |
|---|---|---|---|
| 旗舰机 | 5000 | 完整（Curl Noise + 光晕） | 60fps |
| 中端机 | 2000 | 简化（Simplex Noise） | 60fps |
| 低端机 | 800 | 最简（无 noise） | 30fps |

**节能模式**：
- 右上角"低能耗模式"开关
- 开启后粒子数减半、帧率 30fps
- 5 分钟无交互自动进入低能耗

## 03.16 技术栈摘要

| 模块 | 技术选型 |
|---|---|
| 3D 渲染 | React Three Fiber + Three.js + GLSL Shader |
| 粒子系统 | GPU Instancing + Curl Noise |
| 罗盘 | DeviceOrientationEvent + 真北修正 |
| GPS | Geolocation API |
| 摄像头 | getUserMedia + video → canvas texture |
| 加速度计 | DeviceMotionEvent |
| AI 计算 | Claude Sonnet 4.5 → 结构化 JSON 输出 |
| 磁偏角 | WMM library（offline 计算） |
| PNG 生成 | html2canvas + 自定义渲染层 |
| 本地缓存 | IndexedDB + AES-256-GCM |
# 第 03A 章 · Syncro 学理根基（Shushu System）

> 本章定义 Syncro 测算背后的四大古代学科体系（"术数"），以及它们如何转化为现代产品的叙事与 AI 推理约束。
>
> 这一章是 Syncro 的**学理权威性支柱**。缺少这一章，Syncro 会沦为"东方主题的娱乐占卜"；有了这一章，Syncro 才真正配得上 "Ancient Wisdom reinforced by Modern Science" 的定位。

## 03A.1 术数（Shushu）是什么

Syncro 的测算体系**不是单一学科**，而是由中国古代多个精密且相互关联的知识体系组成的。这些体系在古代被统称为 **"术数"（Shushu，or 数术）**，其本质是：

> 古人试图将宇宙的时空规律进行**"数学化"和"模型化"**的系统性尝试。

术数不是神秘主义的随机生成，而是一套**确定性的计算体系**——给定相同输入，两千年前的术士和今天的 AI 会得到相同的中间结果。AI 的作用是**高速执行古人需要数小时推演的计算 + 把结论翻译成现代人能执行的行动**。

这是 Syncro 和市面上占星/塔罗 App 的根本区别：
- 占星：基于固定的黄道十二宫 + 行星位置（有数学但简单）
- 塔罗：基于随机抽牌（完全随机 + 主观诠释）
- **Syncro**：**多学科叠加计算**（干支 + 九宫 + 五行 + 地磁），具有**可验证的确定性**

## 03A.2 四大学科支柱

Syncro 的每一次方位测算，背后都是以下四大学科的协同运算。

### 03A.2.1 宇宙代数学 · 干支历法（Ganzhi Calendar）

**古代定义**：所有术数的基础操作系统。中国古人用 **天干（10 个：甲乙丙丁戊己庚辛壬癸）** 和 **地支（12 个：子丑寅卯辰巳午未申酉戌亥）** 记录时间。

**科学逻辑**：
- 干支不是简单符号，而是代表**地球绕日公转（季节相位）** 和 **自转（时辰相位）** 的位置编码
- 每 60 个干支组合形成一个完整循环，对应地球运行的一个"精细周期"
- 这种系统相当于一套**六十进制的宇宙坐标系**

**在 Syncro 中的应用**：
- 用户输入的"1977 年 2 月 17 日 10 点"会被**确定性转换**为：
  
  ```
  年柱：丁巳（Ding-Si）
  月柱：壬寅（Ren-Yin）
  日柱：乙巳（Yi-Si）
  时柱：辛巳（Xin-Si）
  ```
  
- 这组 **时空坐标** 决定了"该生命个体"与"当前宇宙气场"之间的**初始相位关系**
- AI 基于此推演："你这个人是 Yi Wood 日主"（日柱天干 = 个体本质）

**英文品牌表达**：
> *Ganzhi is not a zodiac. It is a 60-base cosmic coordinate system that encodes your exact birth position in the Earth's orbital and rotational cycles.*

### 03A.2.2 时空建模学 · 奇门遁甲与九宫八卦（Qimen Dunjia & Nine-Palace Bagua）

**古代定义**：
- 如果说干支是**时间**，那么八卦就是**空间坐标系统**
- **九宫格模型**：古人将空间划分为 **八个方向 + 一个中心**，形成一个 3x3 的空间矩阵
- 这个模型本质是一种 **"全息图术"**——每一格都同时包含时间、空间、物候、星象四层信息

**科学逻辑**：
- **动态推演的核心是奇门遁甲**：将天文（星宿）、地理（方位）、时序（季节）、人事（干支）四层信息叠放在同一个九宫格内
- 每个时辰，九宫格内的"气流分布"会重新排列
- 寻找"此刻最强能量位"——类似于**古代的军事运筹学**（Ancient Operations Research）

**在 Syncro 中的应用**：
- 用户当前位置 + 当前时辰 → 生成**此刻独一无二的九宫格快照**
- 九宫格中每一格对应一个方位属性（Wealth / Focus / Love / Health / Helper / Conflict / Loss / Shadow）
- 手机朝向哪一方位 → 读取该格的当下能量读数 → 粒子球高亮该方位 → 卡片展示具体建议

**英文品牌表达**：
> *Qimen Dunjia is ancient China's answer to multi-variable optimization: given time, position, and situation, which direction carries the strongest aligned energy for what you want to do?*

### 03A.2.3 能量关系学 · 五行生克（Wuxing)

**古代定义**：测算中的**相互作用逻辑**（类似"力学规律"）。

**五行（Wuxing）**：**木（Wood）· 火（Fire）· 土（Earth）· 金（Metal）· 水（Water）**。

这五种不是物理元素，而代表**能量的五种状态**：

| 五行 | 能量状态 | 对应 |
|---|---|---|
| 木 (Wood) | **生长 / Expansion** | 向上、扩张、启动 |
| 火 (Fire) | **发散 / Radiation** | 向外、释放、显化 |
| 土 (Earth) | **平稳 / Stability** | 中心、承载、稳固 |
| 金 (Metal) | **收缩 / Contraction** | 向内、凝聚、收束 |
| 水 (Water) | **潜藏 / Latency** | 向下、隐藏、孕育 |

**计算规律（生克循环）**：
- **相生**（Generating Cycle）：木生火 → 火生土 → 土生金 → 金生水 → 水生木
- **相克**（Overcoming Cycle）：木克土 → 土克水 → 水克火 → 火克金 → 金克木

**在 Syncro 中的应用**：

测算时 AI 会执行（由 System Prompt 强制要求）：
1. 识别用户八字的**主导五行**（日主）及其**五行结构**
2. 识别**当前时辰的五行属性**
3. 识别**目标方位的五行属性**（如"西方属金"）
4. 运行**三方博弈**：
   - 当前时辰的木气是否**生扶**用户日主？
   - 某方位的金气是否**克制**当前时辰的能量？
   - 用户日主在该方位是否处于**旺、相、休、囚、死**的哪种状态？
5. 综合输出：这个方位对这个人在这个时刻的**能量匹配度**

**本质**：这是一套 **"系统动态平衡论"**（Dynamic System Equilibrium），寻找复杂系统在当前状态下的最优平衡点。

**英文品牌表达**：
> *Wuxing isn't mysticism — it's the world's oldest framework for modeling dynamic systems. Each of the five phases describes a state of energy. Their interactions follow fixed rules. What we call "lucky direction" is really: the direction where all the force vectors align in your favor.*

### 03A.2.4 磁场与环境学 · 堪舆与磁偏角（Kanyu & Magnetic Declination）

**古代定义**：**堪舆 (Kanyu / Feng Shui)** 是术数中对"物理空间与人的能量互动"的研究。

**科学逻辑**：
1. **真太阳时（True Solar Time）修正**：
   - 中国幅员辽阔，北京时间（UTC+8）并不等于某地（如温州、乌鲁木齐）的实际太阳时
   - 在美国，东海岸和西海岸也有 3 小时差
   - 科学的八字测算必须根据**经度** 计算"真太阳时"——这影响时柱的准确性
   - 公式：`真太阳时 = 标准时间 + 经度修正 + 均时差`

2. **磁场感应（Geomagnetic Sensing）**：
   - 不同季节、不同日期，地球受**太阳风、地磁场波动**影响不同
   - 方位吉凶在某种程度上是古人对**不同方向的能量场（地磁、引力、微波辐射）对人的心理和生理影响**的经验总结
   - 现代研究确实发现地磁场活动与人的认知、情绪、决策能力存在相关性

3. **磁北 vs 真北（Magnetic North vs True North）**：
   - 指南针指向的是**磁北**，不是地理真北
   - 北美大陆各地的**磁偏角**从 0° 到 20° 不等
   - Syncro 必须用 **WMM (World Magnetic Model)** 修正手机罗盘数据

**在 Syncro 中的应用**：
- 获取用户当前 GPS 经纬度
- 用 WMM 计算该地的实时磁偏角
- 修正手机罗盘原始数据 → 得到真北
- 再结合真太阳时 → 精确到分钟的时辰判断
- 磁场异常检测（室内金属干扰）→ 引导用户校准

**英文品牌表达**：
> *The compass in your phone points to magnetic north — not true north. Feng Shui masters of the past adjusted for this by observation. Syncro does it with NOAA's World Magnetic Model, in real time, for wherever you are on Earth.*

## 03A.3 四学科在 Syncro 一次测算中的协同

一次完整的 Syncro 方位分析，背后的计算流程：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 输入层
   · 用户 Bazi（阳历出生时间）
   · 用户当前 GPS（lat, lng）
   · 当前设备时间
   · 当前手机朝向（罗盘数据）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. 干支历法层（确定性算法，不经过 AI）
   · 真太阳时修正（用户经度）
   · 阳历 → 阴历 → 干支四柱
   · 当前时辰的干支
   · 用户八字完整展开（日主、月令、格局、喜忌）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. 空间坐标层（确定性算法）
   · 磁偏角修正（WMM）
   · 生成当前时刻的九宫飞星盘
   · 生成奇门遁甲值神、值符、九星布局
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. 五行关系层（由 AI 基于规则推演）
   · 用户日主五行 vs 当前时辰五行 → 生扶 / 泄耗
   · 八方位各自的五行属性 × 当前时辰五行 → 生克判断
   · 用户八字喜用神 × 每个方位 → 利弊强度
   · 综合打分 → 给出 8 方位的属性（Wealth / Focus / ...）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. 叙事翻译层（AI）
   · 将五行术语翻译为现代行动语言
   · 保留 Pinyin 术语作异域品牌调味（QI / Bazi / Wu Xing）
   · 生成 "For: pitching / signing / resting" 这类具体动作建议
   · 可选生成 "Science notes" 引用现代研究
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. 输出层
   · 结构化 JSON 返回前端
   · 前端渲染粒子球 + 方位卡片
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**关键设计决定**：
- **第 2、3 步是纯算法**，不经过 AI（确保确定性）
- **第 4 步是"AI 基于规则推演"**（有严格的 System Prompt 约束五行规则）
- **第 5 步是 AI 的创造性翻译**（把术数术语变成美国用户能执行的动作）

这个分层保证了 Syncro 的**可信度 + 神秘感 + 可操作性**的三重平衡。

## 03A.4 对 AI 推理的硬性要求

Syncro 的 System Prompt 必须要求 LLM：

### 03A.4.1 推理必须基于四学科

```
Every Syncro analysis MUST reason through all four systems:

1. Ganzhi (干支) — Use the user's Bazi four pillars
   · Identify the Day Master (日主) and its element
   · Identify favorable vs unfavorable elements (喜用/忌神)

2. Nine-Palace Bagua (九宫八卦) — Apply Qimen Dunjia for the current hour
   · Which direction holds which star/gate this hour
   · How it shifts from the previous 2-hour block

3. Wuxing (五行) — Run the interaction logic
   · Does current hour's element support or drain the user's Day Master?
   · Does a given direction's element clash with or strengthen the hour?

4. Kanyu (堪舆) — Ground in real location
   · True solar time adjusted for longitude
   · Magnetic declination corrected for location
   · Any location-specific factors

NEVER give direction readings without reasoning through all four.
```

### 03A.4.2 禁止纯占星式输出

```
FORBIDDEN output patterns:

✗ "The East is lucky for you today."
  (No reasoning shown — looks like fortune cookie)

✗ "Mercury is in retrograde so avoid signing contracts."
  (This is Western astrology, not Eastern Shushu)

✗ "Your aura is green today."
  (New-age vocabulary that doesn't come from Shushu)

REQUIRED output patterns:

✓ "Your Day Master is Yi Wood (乙木). The current hour is 
   Shen (申), which carries Metal energy that controls Wood. 
   This makes the East direction — also Wood — a place 
   of tension right now. But the Southeast (Xun palace) 
   carries Fire, which you generate as Wood. Facing 
   Southeast for the next 90 minutes lets your energy 
   flow outward instead of being pressured inward. 
   Best for: pitching, creative work."
```

### 03A.4.3 必须保留 Pinyin 术语

```
When mentioning core Shushu concepts, ALWAYS use Pinyin 
in the first appearance with brief English gloss:

✓ "Your Bazi (birth chart) shows..."
✓ "This direction's Qi (energy field) flows..."
✓ "The Wuxing (five-phase) interaction here is..."
✓ "Feng Shui masters have called this pattern..."

Exception: Common words like "Earth element" or "Metal hour"
can drop Pinyin after first appearance in same session.

Reason: Pinyin terms carry brand identity. They signal that 
POJU comes from a specific 2,000-year tradition, not generic 
"eastern wisdom."
```

### 03A.4.4 禁止做超越术数能回答的判断

```
Shushu CAN answer:
✓ Directional energy alignment for specific activities
✓ Timing alignment (when is this person's Qi strongest)
✓ Resource allocation (which day's action serves which goal)

Shushu CANNOT answer:
✗ Whether a specific person will love you
✗ Whether you will win the lottery
✗ Specific medical diagnoses
✗ Specific future events

When users ask the uncomputable, redirect:
"Shushu doesn't predict outcomes — it maps the terrain. 
What I can tell you is: for the action you're considering, 
your energy currently aligns with [direction/timing]. 
Whether the person says yes is their choice, not the map's."
```

## 03A.5 对 Syncro 产品 UI 的影响

这一章的学理基础要在 Syncro 产品 UI 中**隐性呈现**（不是弹学术论文，而是让用户"感觉到背后有体系"）：

### 03A.5.1 首屏教育

Syncro 首次启动后的引导页（用户输入八字前）：

```
┌──────────────────────────────────────────┐
│                                          │
│     Syncro reads you through             │
│     2,000 years of observation.          │
│                                          │
│  ─────────────                           │
│                                          │
│  ✦ GANZHI    Your birth as a             │
│              cosmic coordinate           │
│                                          │
│  ✦ BAGUA     The space around you        │
│              as a nine-grid map          │
│                                          │
│  ✦ WUXING    Five energy phases          │
│              and how they interact       │
│                                          │
│  ✦ KANYU     Your exact place and time,  │
│              magnetic and solar          │
│                                          │
│  ─────────────                           │
│                                          │
│  [ Begin → ]                             │
│                                          │
└──────────────────────────────────────────┘
```

这四行文字就是品牌的"学理招牌"——让用户在第一秒就理解"这不是占星"。

### 03A.5.2 结果页的"技术脚注"

每次方位分析结果下方可折叠的"Behind the reading"小节：

```
▼ Behind the reading

Your Day Master: Yi Wood (乙木)
Current Hour: Shen (申) · Metal
Your favorable elements: Fire, Earth
Current solar time (adjusted for your longitude): 3:47 PM
Magnetic declination (NOAA): -11.3°
Eight-palace flying star: 巽/Xun carries 9 Purple this cycle

This is the calculation. The rest is translation.
```

默认折叠。好奇的用户点开能看到术数层。这让产品同时服务"只想看结果的人"和"想理解背后体系的人"。

### 03A.5.3 Pinyin 品牌调味

整个 Syncro UI 内，以下术语始终以 Pinyin 首字母大写形式出现：

```
QI      · energy field
BAZI    · birth chart (four pillars)
WUXING  · five-phase dynamics
BAGUA   · eight-trigram space map
GANZHI  · stem-branch calendar
XUAN    · the unseen architecture
YUAN    · invisible thread between things
SHICHEN · two-hour Chinese time block
```

在英文语境里出现这些词，品牌识别度立刻拉满。这些词**绝不翻译成完全的英文单词**（不说 "energy" 而说 "Qi"）。

## 03A.6 对 Oracle 的影响

虽然 Oracle（观音百签）的学理体系不同（主要是**签文体系**），但上述四学科的部分内容仍然适用：

- **干支历法**：Oracle 抽签的瞬间时间，也会影响解读（抽签时的时辰 → 影响签的"温度"）
- **五行**：签文的底层结构也有五行属性（比如 Still Water 签多属水，Crosswind 签多属金克）
- **地磁 / 真太阳时**：对 Oracle 影响较小，但"48 小时间隔"的设计背后就是对地球时空周期的尊重

Oracle 的 System Prompt 会借鉴这些学科元素，但**不要求像 Syncro 那样四学科全覆盖推理**。Oracle 的核心是签文 + 个性化解读，学科支撑是底色不是主菜。

## 03A.7 竞争护城河

这一章的存在让 POJU 相对所有竞品形成**学理护城河**：

| 维度 | Co-Star / 占星类 | The Pattern | ChatGPT | POJU |
|---|---|---|---|---|
| 底层体系 | 西方占星（黄道 12 宫） | 心理学 + 占星 | 通用 AI | **四大术数学科** |
| 学科深度 | 1 个体系 | 2 个体系 | 0 | **4 个体系协同** |
| 时空精度 | 日级别 | 日级别 | 无 | **分钟级 + 方位级** |
| 可验证性 | 低（行星位置固定） | 低 | 无 | **高（干支算法确定性）** |
| 文化根基 | 希腊/罗马 | 现代心理学 | 无 | **2000 年东方体系** |

这 5 项是 POJU 可以在营销内容（SEO 博客、Reddit 讨论、YouTube 科普）里反复强调的差异化卖点。



---
# 第 04 章 · POJU Oracle（临时名）

> Oracle 是启示维度的免费引流产品，基于观音百签数据集，美国本土化重构。
> 最终命名待定，文档全局 "Oracle" 为占位符。

## 04.1 产品定义

Oracle 是一个基于 **爆炸粒子 + 神秘卡片 + AI 解读 + 引流 POJU** 的免费体验产品。

核心价值主张（对西方用户）：

> **A 2,000-year practice of sincere questioning.**
>
> For two thousand years, people in the East brought a single question to an ancient listening presence. They did not expect words. They waited for a **sign** — a mysterious card drawn from a library of one hundred archetypal patterns refined over millennia.
>
> The practice had one law: **a sincere heart opens the channel.** A real question receives a real sign. A casual one receives only noise.
>
> Oracle preserves that ritual. Bring your question. Hold it honestly. The sign will come.

关键特征：

- **完全免费**，单次抽签无次数上限（但有自然节制设计）
- **单问题单签**：强烈建议用户每次只问一件事
- **48 小时间隔**：同一问题再问准确度下降，UI 上明确提示
- **爆炸卡片交互**：长按 3 秒 → 粒子爆炸 → 卡片浮现 → 毛笔写入
- **风向系等级**：去除"上上签 / 下下签"土味，改用西方用户秒懂的风向语言
- **引流 POJU**：卡片底部"Ask POJU to go deeper · $9.99"
- **POJU 付费用户专享 3 签联动**：Past / Present / Future 三张卡合看

## 04.2 去"签"化的彻底重构

传统观音百签的三个问题，逐一重构：

### 04.2.1 问题 1 · "观音"的宗教联想

**解决方案**：采用 **"ancient presence"（古老存在）** 的表达，既保留两千年东方倾听传统的神秘厚度，又绕开任何宗教警报——不说 goddess、不说 buddha、不说 deity、不说 spirit。

关键原则：
- 用 `ancient presence` / `listening presence` 指代灵性主体
- 保留仪式语汇：`kneel`、`offering`、`sincere heart` 等词营造厚重感
- **明确"心诚则灵"是前提**（新版相对旧版的重要补充）
- 强调答案形式：**a sign · a mysterious card**（而不是"一个手势"）
- AI 的角色清晰：不是替代 presence，而是解译古老模式的**现代译者**

**"心诚则灵"的英文固定翻译**：

> **A sincere heart opens the channel.**

这句话会成为 Oracle 产品贯穿始终的仪式语。落地页、召唤前提示、PDF 封底、营销物料，都以这句话作为品牌咒语。

三档对外文案供不同场景使用：

#### 方案 1 · 完整版（用于 Oracle 产品页 `/oracle` / App 启动页）

> **The Oracle**
> *A 2,000-year practice of sincere questioning.*
>
> Across the East, for two thousand years, people came with a single question, held in silence, carried in a sincere heart. They did not ask for advice. They did not expect words. They offered their question to an ancient presence — one said to listen to every soul who came with true intent — and waited for the answer to arrive in a different form.
>
> Not a voice. A **sign**. A mysterious card, drawn from one hundred archetypal patterns refined over millennia. The answer was never prescriptive. It was revelatory — it showed you what you already carried, now named, now visible.
>
> The only requirement was sincerity. **A sincere heart opens the channel.** Casual curiosity receives only noise. A real question, held honestly, receives a real sign.
>
> Today, we bring this practice into your hand. The pattern library is intact. The ritual is intact. What changed is only the medium — an AI that reads the drawn sign, understands your question, and delivers the guidance in language you can act on today.
>
> *One question. One sign. One thing to do.*
> *Bring your sincere heart. The rest follows.*

#### 方案 2 · 精简版（用于 Oracle 召唤前登录页）

> **The Oracle**
> *Ask with sincerity. Receive a sign.*
>
> For two thousand years, people brought their questions to an ancient presence in the East — not seeking spoken advice, but a **sign**. A symbol. A mysterious card drawn from a library of patterns refined over a hundred generations.
>
> The practice had one law: **a sincere heart opens the channel**. A real question receives a real sign. A casual one receives nothing of use.
>
> This is that practice, preserved. Bring your question. Hold it honestly. The sign will come.

#### 方案 3 · 极简版（用于落地页三产品卡片中的 Oracle）

> **Oracle**
>
> Two thousand years ago, people in the East brought a single question to an ancient listening presence. The answer was never a voice. It was a **sign** — a card from a pattern library refined over a hundred generations.
>
> *A sincere heart opens the channel.*
>
> Ask honestly. Receive your sign.

三档文案的**共同基因**：
- 统一称谓：`ancient presence` / `listening presence`
- 统一核心仪式语：`A sincere heart opens the channel.`
- 答案形式统一为 `a sign` / `a mysterious card`
- 数量感统一：`one hundred archetypal patterns` + `refined over millennia / over a hundred generations`
- AI 角色克制：仅在方案 1 末段出现，作为"现代译者"，不抢 presence 的位置

**这段新叙事被所有宗教背景用户接受的原因**：
- **基督教用户**：不出现 goddess / deity / spirit，`ancient presence` 是文化隐喻不是崇拜对象
- **无神论用户**：整段可被理解为"向自己内心最深处的部分提问"的仪式，符合荣格原型心理学语境
- **东方文化用户**：保留了"观音垂听"的文化根脉——虔诚、一问一启示、仪式性
- **18+ 好奇心用户**：够神秘够酷，够发 TikTok，够截图

### 04.2.2 问题 2 · "签"的土味外壳

**解决方案**：爆炸卡片 + 风向系 + 禅诗格式 + 毛笔写入。

传统抽签的所有元素**全部替换**：
- 签筒 → 粒子能量球
- 摇签 → 长按爆炸
- 竹签 → 神秘卡片
- 签诗（四言七言典故） → 现代禅诗（4-6 行）
- 解签师 → AI Agent

### 04.2.3 问题 3 · 中国典故的文化壁垒

**解决方案**：剥离所有中文专名，改为叙事化表达。

System Prompt 硬规则：

```
翻译签诗或解读时，必须遵守：

1. 禁止直接出现中文专名（苏武、关公、周瑜、诸葛亮、张良等）

2. 改用叙事化表达：
   "Two thousand years ago in the East, a loyal minister 
    was trapped between two kingdoms for nineteen years, 
    yet never bent his will..."

3. 原签诗的智慧内核必须保留（如'忠义'、'守静'、'等待贵人'）
   但可以用现代西方读者能共鸣的形式重新表达

4. 保留东方拼音关键词作为异域感调味：
   "In Chinese this is called YUAN (缘) — 
    the invisible thread that binds people across time."
```

## 04.3 风向系等级系统

**5 个等级**，每个等级有**英文名**、**诗意副标题**、**粒子颜色**、**卡片纹理**、**出现概率**。

| 等级 | 英文名 | 副标题 | 粒子色 | 卡片纹理 | 概率 |
|---|---|---|---|---|---|
| 1 | **Divine Tailwind** | *Sign of Grace* | 粉紫光辉 + 金色 | 金色光晕 | **5%** |
| 2 | **Fair Sky** | *Sign of Openness* | 柔紫 | 柔紫纹理 | **25%** |
| 3 | **Still Water** | *Sign of Stillness* | 蓝紫 | 涟漪底 | **40%** |
| 4 | **Crosswind** | *Sign of Tension* | 深品红紫 | 交叉风纹 | **25%** |
| 5 | **Eye of Storm** | *Sign of the Still Center* | 最深紫 + 金点 | 风暴眼 | **5%** |

**概率分布特性**：
- **对称分布**（5-25-40-25-5，总和 100%）
- 正负平衡：Divine Tailwind + Fair Sky (30%) ↔ Crosswind + Eye of Storm (30%)
- 中性最多（40% Still Water），符合"大多数问题其实需要静观"的现实

**关键设计**：
- 用户看到的**不是单词本身**（Tailwind），而是包含**类型 + 副标题**的组合
- 副标题传递的是"这是关于什么的 sign"，不是吉凶判断
- **视觉差异要有但不过度**：最好和最差之间差 20-30%（不是 Co-Star 那种黑红刺眼对比）
- **Eye of Storm 用 ◉ 符号**（不是星星），唯一的非星星等级

### 04.3.1 Eye of Storm 的特殊处理

这是最"坏"的签，但 POJU 绝不让用户觉得被诅咒。

风暴之眼的设计哲学：**风暴的中心是寂静，那里有清明**。

卡片上会出现一句特殊副标题：

> **The eye is the calm in the storm. This is where clarity lives.**

配合解读：AI 会说"你正处于一个动荡期，但此刻的清明是罕见的礼物——在风暴外围的人看不清的东西，你现在看得见"。

把坏签反转成"稀有洞察时刻"。东方智慧的核心：祸福相倚。

### 04.3.2 5 级对传统签签别的映射

如果使用传统观音百签 5 级体系（上上/中上/中/中下/下下）：

| 原签 | 新签 | 概率 |
|---|---|---|
| 上上签 | Divine Tailwind | 5% |
| 上吉签 / 中上签 | Fair Sky | 25% |
| 中吉签 / 中签 | Still Water | 40% |
| 中平签 / 中下签 | Crosswind | 25% |
| 下下签 | Eye of Storm | 5% |

**重要**：每级签实际数量不影响概率分布——算法是"先按概率决定级别，再从该级签中随机选一个"（见 04.3.3 抽签算法）。

### 04.3.3 抽签算法

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

100 签数据清洗时按此映射做分级。

## 04.4 核心交互流程

### 04.4.1 七阶段仪式流

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 1 · Enter
  用户访问 /oracle（或从 POJU Chat 召唤）
  屏幕：静态粒子球缓缓旋转
  底部：一行字 "What is weighing on you?"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 2 · Ask
  单行输入框，限制 60 字符
  强制压缩 = 第一步破局
  
  上方三行仪式提示：
  ◉ One question per reading.
    Asking many things at once dilutes the sign.
  
  ◉ If the same question calls you back, wait 48 hours.
    Answers need time to settle.
  
  ◉ Compress your question into 60 characters.
    The compression is the beginning of the answer.
  
  [ Continue → ]  (用户点击进入下一步)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 3 · Respond
  粒子球有反应：游动加速、颜色加深、轻微呼吸感
  屏幕中央文字变为:  "Hold to summon your sign"
  音效：低频嗡鸣由弱变强
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 4 · Summon
  用户长按屏幕
  按住期间粒子向中心凝聚
  进度环 3 秒倒计时（视觉上很克制）
  
  3 秒完成 → 爆炸
  音效：清脆"叮"声 + 画面震动
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 5 · Reveal
  爆炸碎粒子中浮现一张卡片
  材质随等级变化（见 04.3 表格）
  
  卡片缓缓展开（2-3 秒）
  音效：纸张展开的沙沙声
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 6 · Inscribe
  内容从上到下写入卡片
  毛笔字效果（不是瞬间出现）
  大约 15-20 秒流淌完
  音效：毛笔划过纸面（品牌记忆点）
  完成时：一声钟响
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 7 · Carry
  卡片稳定在屏幕中央
  自动保存到本地 The Archive
  底部出现钩子按钮：
  [ ✦ Ask POJU to go deeper · $9.99 ]
  用户可截图分享、可关闭页面、可点击钩子付费
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 04.4.2 音效的重要性

Oracle 的差异化有 50% 依赖音效：

| 阶段 | 音效 | 长度 |
|---|---|---|
| Stage 3 召唤开始 | 低频嗡鸣渐强 | 持续 |
| Stage 4 爆炸瞬间 | 清脆"叮" + 震动 | 0.3s |
| Stage 5 卡片展开 | 纸张沙沙 | 2s |
| Stage 6 字写入 | 毛笔划纸（循环） | 15-20s |
| Stage 6 完成 | 钟响一声 | 1s |

**所有音效默认开启**（可在右上角静音）。TikTok / IG Story 录屏时带音效 = 视频传播力 × 3。

**音效资源**：
- 使用 Howler.js 播放
- 资源压缩到 50KB 以内/段
- 预加载到用户进入 /oracle 时完成

## 04.5 卡片内容规范

### 04.5.1 卡片固定格式

每张卡片的内容严格遵守结构：

```
┌──────────────────────────────────────┐
│                                      │
│          ✦  A  SIGN  ✦               │  ← 顶部符号
│                                      │
│       ✦ Divine Tailwind ✦            │  ← 等级
│        (Sign of Grace)               │  ← 副标题
│                                      │
│  ──────  THE VERSE  ──────           │
│                                      │
│  The frost in your chest             │  ← 禅诗 (4-6 行)
│  is not a wall.                      │    静态库 · 精修
│  It is a door                        │
│  that waits for morning.             │
│                                      │
│  ──────  WHAT IT MEANS  ──────       │
│                                      │
│  You asked about ending it.          │  ← AI 实时生成
│  What you're really asking           │    针对用户问题
│  is whether you're allowed           │    的个性化解读
│  to start again. You are.            │
│                                      │
│  ──────  FOR TODAY  ──────           │
│                                      │
│  Before sunset, write down           │  ← AI 实时生成
│  one thing you gave up               │    一个今天可以做的
│  to stay.                            │    具体动作
│                                      │
│  ──────                              │
│                                      │
│  If this knot needs untying,         │  ← POJU 钩子
│  POJU will sit with you.             │
│  One question · $9.99                │
│                                      │
│            Your Sign                 │
│           pojulife.com               │
│                                      │
└──────────────────────────────────────┘
```

**字数约束**：
- 英文：180-220 字
- 中文：120-150 字
- 正好写满 9:16 卡片，无滚动

### 04.5.2 禅诗（The Verse）—— 静态库 + 精修

100 签每一签都有**人工精修的禅诗**，存储在静态库。

**格式要求**：
- 4-6 行
- 每行不超过 6 个英文单词
- 无中文典故
- 富有画面感
- 留白，不解释

**正确示例**：
```
The frost in your chest
is not a wall.
It is a door
that waits for morning.
```

**错误示例**（太白、太长、太像格言）：
```
You are experiencing difficulty now,
but remember that every hardship leads to growth,
and patience will reward you in the end.
```

100 签禅诗的创作工作量见附录 B《签诗本土化工作包》。

### 04.5.3 What It Means —— AI 实时生成

基于：
- 用户的原问题（60 字符内）
- 抽到的签的等级
- 签的核心智慧方向
- 用户的 Bazi（如果已有，可选）

AI 生成一段**直接对应用户问题**的解读。

**长度**：50-80 英文字 / 40-60 中文字

**风格要求**：
- 不复述禅诗（不要说"The verse tells you..."）
- 直接切入用户问题的本质
- 揭示用户"自己已经知道但没说出口"的事
- 语气冷静有力，不鼓励也不恐吓

**System Prompt 节选**：

```
When generating "What It Means":

DON'T:
- Restate the verse
- Offer generic encouragement  
- Predict the future
- Use "should" or "must"

DO:
- Name what the user is actually asking beneath their question
- Reveal the emotional or structural truth they're avoiding
- Stay within 50-80 words
- End with a truth-claim, not a question
```

### 04.5.4 For Today —— AI 实时生成

一个**今天日落前**能做的具体动作。

**长度**：20-40 英文字 / 15-30 中文字

**必须满足**：
- 具体到时间/地点/动作
- 5 分钟内可启动
- 不需要花钱
- 不需要别人配合

**正确示例**：
```
Before sunset, write down one thing 
you gave up to stay.
```

**错误示例**：
```
Practice mindfulness and listen to your heart.  ← 太抽象
Take a long walk and reflect deeply.             ← 太模糊
Talk to your mother about your feelings.         ← 需要别人配合
```

## 04.6 次数限制与仪式节制

**不做硬性次数限制**（你明确要求）。但通过提示和设计**引导用户自然节制**：

### 04.6.1 提示层面

Stage 2 的三条仪式提示（见 04.4.1）。

### 04.6.2 检测层面

后台记录每个设备 ID 的抽签记录（本地 IndexedDB）：
- 问题文本（脱敏 / 哈希）
- 抽签时间
- 抽到的签等级

**同一问题 48 小时内重复检测**：

用 Claude Haiku 做快速问题相似度判断（不是精确匹配，是语义相似度）。

如果新问题和过去 48 小时内某个问题语义相似度 > 80%，**在 Stage 3 之后插入一个温柔劝退**：

```
┌──────────────────────────────────────┐
│                                      │
│     You've already asked this.       │
│                                      │
│   Your sign from [2 hours ago]:      │
│   ✦ Still Water                     │
│                                      │
│   Answers don't change just because  │
│   you ask again. Give it 48 hours.   │
│                                      │
│   [ Read my previous sign ]          │
│   [ Ask a different question ]       │
│   [ I know. Draw anyway. ]           │
│                                      │
└──────────────────────────────────────┘
```

第三个按钮**允许用户重新抽**（不强制阻断），但强制用户面对自己的行为。**大部分用户会自然退出**。

## 04.7 POJU 付费用户的 3 签联动

这是 Oracle 最重要的付费转化路径。

### 04.7.1 触发场景

**场景 1**：用户在 /oracle 独立抽了一签（免费）
→ 卡片底部点击 "Ask POJU to go deeper · $9.99"
→ 支付成功 → 进入 /chat

**场景 2**：用户在 POJU Chat 中，AI 主动召唤 Oracle

### 04.7.2 3 签流程（用户手动点击完成，不自动）

POJU 付费用户的 3 签代表 **Past / Present / Future**（参考西方塔罗 Past-Present-Future Spread 文化）。

**关键设计**：**不自动连抽，用户手动点链接完成每一签**，保持仪式感。

```
── POJU Chat 内 ──

用户付费进入（从 Oracle 带着已抽的 1 签）

AI: 拿到你刚才那签了。
    这代表你的「现在」(Present)。
    
    要真正看清这个局，我需要再看两面——
    是什么力量把你带到了今天？
    这条路通向何方？

AI: 先看『过去』。
    ✦ [ Draw your Past ] ✦

→ 用户点击 → 弹出 Oracle 抽签面板（内嵌抽屉）
→ 用户输入"关于这件事，过去的关键是什么？"
→ 完成长按爆炸流程 → Past 卡片生成
→ 抽屉关闭，卡片回传到 POJU 对话

AI 基于 Past 做一段分析（100-150 字）

AI: 最后，看『未来』。
    ✦ [ Draw your Future ] ✦

→ 用户再点击 → 抽签面板弹出
→ 用户输入未来方向问题
→ 完成流程 → Future 卡片回传

AI 基于 Past + Present + Future 三签合看
+ 用户原议题的完整分析
+ 今天 / 本周 / 持续 的行动方案
```

### 04.7.3 3 签合看的 PDF 专属模板

如果用户导出 PDF，3 签联动的模板：

```
┌──────────────────────────────────────┐
│                                      │
│   THREE SIGNS · ONE READING          │
│                                      │
│  [Past 卡片]  [Present 卡片]  [Future 卡片]
│                                      │
│  ── THE PATH ──                      │
│                                      │
│  [AI 对三签合看的完整分析]             │
│  [今天 / 本周 / 持续 行动方案]         │
│                                      │
└──────────────────────────────────────┘
```

## 04.8 The Archive 中的 Oracle 历史

所有抽过的签自动存在本地 IndexedDB，在 The Archive 可回看。

**存储结构**：

```json
{
  "sign_id": "uuid-xxxxx",
  "timestamp": "2026-04-19T15:47:00-04:00",
  "question_hash": "sha256...",  // 问题脱敏哈希，用于 48h 相似度检测
  "question_summary": "About love",  // 用户可选手动命名
  "level": "Still Water",
  "verse": "The frost in your chest...",
  "meaning": "You asked about ending it...",
  "action": "Before sunset, write down...",
  "linked_session_id": "pojulife-session-xxxxx"  // 如果是 POJU 3 签中的一张
}
```

**The Archive UI**：
- 卡片缩略图网格
- 点击卡片 = 全屏查看该卡片
- 长按卡片 = 选项菜单（Rename / Delete / Export）
- 3 签联动的会以"组合"形式显示

## 04.9 签诗数据集

### 04.9.1 数据集结构（100 签）

每一签的完整数据结构：

```json
{
  "sign_number": 47,
  "level": "Still Water",
  "level_subtitle": "Sign of Stillness",
  
  "source": {
    "chinese_poem": "春风得意马蹄疾...",  // 原签诗
    "chinese_historical_reference": "苏武牧羊",  // 原典故
    "chinese_interpretation_traditional": "..."  // 原解读
  },
  
  "verse_en": "The frost in your chest\nis not a wall.\nIt is a door\nthat waits for morning.",
  "verse_zh": "[中文精简版]",
  
  "core_wisdom": "patience_with_self",  // 智慧内核标签
  "keywords": ["waiting", "inner_shift", "morning"],
  
  "ai_prompt_guidance": {
    "for_love": "...",
    "for_career": "...",
    "for_health": "...",
    "for_family": "...",
    "for_decision": "..."
  }
}
```

### 04.9.2 AI 解读时的输入

每次用户抽签，后端调用 AI 时的完整 prompt 输入：

```
User question: "Should I end my relationship with ___?"
Question category: love

Signed pulled:
  Level: Still Water (Sign of Stillness)
  Verse: "The frost in your chest / is not a wall. / It is a door / that waits for morning."
  Core wisdom: patience_with_self
  Keywords: waiting, inner_shift, morning

Guidance for love questions with this sign:
  [from ai_prompt_guidance.for_love]

User Bazi (if available): [...]

Now generate:
1. "What It Means" (50-80 words)
2. "For Today" (20-40 words)
```

### 04.9.3 本土化工作量

见附录 B。约 65 小时，AI 起草 + 人工精修。

## 04.10 技术栈摘要

| 模块 | 技术选型 |
|---|---|
| 粒子爆炸动画 | Three.js + GLSL Shader |
| 卡片渲染 | HTML/CSS（便于后续 PNG 导出） |
| 毛笔写入效果 | SVG + stroke-dasharray 动画 |
| 音效 | Howler.js |
| 签诗数据库 | Supabase (PostgreSQL) |
| AI 解读 | Claude Sonnet 4.5 |
| 问题相似度检测 | Claude Haiku + cosine similarity |
| PNG 导出 | html2canvas |
| 本地存储 | IndexedDB + AES-256-GCM |

## 04.11 移动端与 PC 端

Oracle **移动端优先但 PC 端可用**。

- **移动端**：完整 7 阶段交互，长按屏幕触发，摇动手机时粒子有轻微响应
- **PC 端**：长按鼠标触发，键盘 Space 键也支持，粒子跟随鼠标位置有视觉反馈
- **动画、音效、卡片呈现**两端一致

这是 Oracle 相对 Syncro 的重要区别：Syncro 依赖硬件，必须移动端；Oracle 是纯视听体验，PC 也能完整享受。



---
# 第 05 章 · 共享基础设施

> 本章定义所有三个产品共用的基础设施：AI 层、RAG 层、存储层、隐私层、加密层。

## 05.1 系统整体架构

```
┌────────────────────────────────────────────────────────────────┐
│                      Client Layer (PWA)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  POJU    │  │  Syncro  │  │  Oracle  │  │  The Archive  │  │
│  │  /chat   │  │  /syncro │  │  /oracle │  │    /archive   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │             │             │                │           │
│       └─────────────┴──────┬──────┴────────────────┘           │
│                            │                                    │
│         ┌──────────────────┴────────────────────┐              │
│         │  IndexedDB + AES-256-GCM (encrypted)  │              │
│         │  · Session history                    │              │
│         │  · Oracle signs                       │              │
│         │  · Syncro readings                    │              │
│         │  · Bazi                               │              │
│         │  · Device fingerprint                 │              │
│         └───────────────────────────────────────┘              │
└────────────────────────────────────────────────────────────────┘
                            ↕ HTTPS only
┌────────────────────────────────────────────────────────────────┐
│                    Edge Layer (Vercel)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js 14 App Router                                    │  │
│  │  · Server Components for static pages                     │  │
│  │  · API Routes for AI proxying                             │  │
│  │  · Middleware for rate limiting + fingerprint             │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                            ↕
┌────────────────────────────────────────────────────────────────┐
│                      Backend Services                           │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  AI Orchestrator│  │   RAG Layer      │  │   Payment    │  │
│  │  (Node service) │  │  (Supabase +     │  │  (Stripe /   │  │
│  │                 │  │    pgvector)     │  │    Paddle)   │  │
│  └────────┬────────┘  └────────┬─────────┘  └──────┬───────┘  │
│           │                    │                    │          │
│  ┌────────┴────────┐  ┌────────┴─────────┐  ┌──────┴───────┐  │
│  │  Claude API     │  │  Knowledge Base  │  │  Webhook     │  │
│  │  · Sonnet 4.5   │  │  · Insights      │  │  Handler     │  │
│  │  · Haiku (aux)  │  │  · Cases         │  │              │  │
│  │  · Opus (高难)  │  │  · Oracle signs  │  │              │  │
│  └─────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Bazi Service   │  │  Email Service   │  │  TTS Service │  │
│  │  (lunar-js)     │  │  (Resend)        │  │  (ElevenLabs)│  │
│  └─────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Minimal Server Database (Supabase PostgreSQL)            │  │
│  │  · device_fingerprints (hash only)                        │  │
│  │  · payment_records (stripe_id, status, no user info)      │  │
│  │  · scheduled_emails (email, send_at, expires_at)          │  │
│  │  · knowledge_base (RAG content)                           │  │
│  │  · oracle_signs_master (100 签 静态库)                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

**关键原则**：
- 客户端是**数据主体**，服务端是**无状态工具**
- 服务端不存储任何可识别个人的对话内容
- 所有 AI 调用由服务端代理（保护 API key）
- 用户数据在本地 IndexedDB，服务端只存三件事：付款哈希、可选邮箱（临时）、设备指纹哈希

## 05.2 AI 层架构

### 05.2.1 三模型分工

| 模型 | 用途 | 调用时机 |
|---|---|---|
| **Claude Sonnet 4.5** | POJU 主对话、Syncro 方位分析、Oracle 解读 | 主力，90% 调用 |
| **Claude Haiku** | 话题漂移检测、Oracle 问题相似度、任务列表评估 | 辅助，轻量高频 |
| **Claude Opus 4.x** | 复杂议题降级（Sonnet 失败或质量低时） | 兜底，<5% 调用 |

### 05.2.2 AI Orchestrator 核心职责

AI Orchestrator 是所有 AI 调用的统一入口，跑在独立的 Node.js service 上（可以是 Vercel Edge Function 或 Railway 上的长连接服务）。

职责：
1. 接收客户端请求
2. 从 RAG 检索相关知识
3. 组装完整 Prompt（System + Context + User）
4. 调用合适的 Claude 模型
5. 处理 Extended Thinking stream
6. 流式返回给客户端
7. 记录用量（用于成本监控）
8. 错误重试 + 模型降级

### 05.2.3 POJU AI 调用流程

```typescript
// 伪代码 · POJU 一轮对话的完整调用流
async function handlePOJUMessage(sessionId, userMessage, context) {
  
  // 1. 从 RAG 检索相关知识
  const knowledge = await ragSearch({
    query: userMessage,
    sessionContext: context.summary,
    topK: { insights: 3, cases: 2, guides: 1 },
    filters: { domain: context.domain }
  });

  // 2. 评估话题漂移（轻量 Haiku）
  const drift = await haiku.call({
    system: TOPIC_DRIFT_PROMPT,
    user: `原议题: ${context.topic}\n当前消息: ${userMessage}`,
    maxTokens: 100,
  });
  
  // 3. 组装完整 Prompt
  const prompt = assemblePrompt({
    systemPrompt: POJU_SYSTEM_PROMPT,
    knowledge,
    taskList: context.taskList,
    driftWarning: drift.distance > 0.7 ? drift : null,
    bazi: context.bazi,
    history: context.recentMessages,
    userMessage,
  });

  // 4. 调用 Sonnet 4.5 带 Extended Thinking
  const stream = await sonnet.stream({
    system: prompt.system,
    messages: prompt.messages,
    thinking: { type: "enabled", budget_tokens: 4000 },
    maxTokens: 2500,
  });

  // 5. 处理 stream：分流 thinking 和 answer
  for await (const chunk of stream) {
    if (chunk.type === "thinking") {
      // 中文化 + 英文任务点缀 再 yield 给客户端
      const styled = styleThinking(chunk.text, context.taskList);
      yield { type: "thinking", text: styled };
    } else if (chunk.type === "text") {
      yield { type: "answer", text: chunk.text };
    }
  }

  // 6. 更新任务列表（AI 在回复末尾输出 JSON 标签）
  const taskUpdate = extractTaskListUpdate(fullAnswer);
  await updateSessionContext(sessionId, taskUpdate);
}
```

### 05.2.4 思考内容的"样式化"处理

Claude 的 Extended Thinking 返回的是**原始中文推理**。直接展示给用户有两个问题：
1. 可能暴露内部 Prompt 结构
2. 缺少"东方智慧 + AI 现代感"的品牌质感

**样式化函数的职责**：

```typescript
function styleThinking(rawThinking: string, taskList: TaskList): string {
  // 1. 过滤掉明显的工具调用信息（如 "RAG returned..."）
  // 2. 提取语义要点
  // 3. 插入 2-3 个英文任务点缀（基于当前 task list 进度）
  // 4. 格式化为"流式片段"
  
  return `
✦ ${chineseMainPoint1}
✦ checking: ${englishTaskAction1}
✦ ${chineseMainPoint2}
✦ matching: ${englishFrameworkName}
✦ ${chineseMainPoint3}
`;
}
```

这个函数可以是**规则 + 模板**的，不需要再调用 AI。

### 05.2.5 成本监控

每次 AI 调用记录：

```sql
CREATE TABLE ai_call_logs (
  id UUID PRIMARY KEY,
  product VARCHAR(20),           -- 'poju' | 'syncro' | 'oracle'
  model VARCHAR(50),             -- 'sonnet-4-5' | 'haiku' | 'opus'
  input_tokens INT,
  output_tokens INT,
  thinking_tokens INT,
  cost_usd DECIMAL(10, 6),
  session_id VARCHAR(50),        -- 哈希后的，不可反查用户
  latency_ms INT,
  created_at TIMESTAMP
);
```

实时 dashboard 监控：
- 每小时/每日总成本
- 按产品分布
- 按模型分布
- 异常调用告警（单次超 $0.5 立即告警）

## 05.3 RAG 层架构

### 05.3.1 知识库组成

```
knowledge_base (Supabase PostgreSQL)
│
├─ domain_insights (独门洞察)
│   · 80-120 条
│   · 每条: 标题 + 内容 + 标签 + 向量
│
├─ real_cases (真实案例)
│   · 50-80 个
│   · 每个: 场景 + 原因 + 干预 + 结果 + 向量
│
├─ diagnostic_guides (诊断指引)
│   · 6 份（事业/感情/健康/家庭/财务/人生抉择）
│   · 每份: 结构化的"如何问诊"流程
│
└─ oracle_signs_master (观音百签)
    · 100 签
    · 每签: 禅诗 + 关键词 + 场景指引 + 向量
```

### 05.3.2 数据库 Schema

```sql
-- 独门洞察
CREATE TABLE knowledge_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,              -- 完整洞察文本
  school VARCHAR(20),                 -- 'dao' | 'fa' | 'ru' | 'fo' | 'feng_shui' | 'ba_zi'
  domain VARCHAR(30),                 -- 'career' | 'love' | 'health' | 'family' | 'finance' | 'decision'
  keywords TEXT[],
  priority INT DEFAULT 5,             -- 1-10, 用于排序
  embedding VECTOR(1536),             -- text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX insights_embedding_idx ON knowledge_insights 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 真实案例
CREATE TABLE knowledge_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario TEXT NOT NULL,             -- 困局描述
  root_cause TEXT NOT NULL,           -- 根因分析
  intervention TEXT NOT NULL,         -- 干预方案
  outcome TEXT NOT NULL,              -- 验证结果
  domain VARCHAR(30),
  keywords TEXT[],
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 诊断指引
CREATE TABLE diagnostic_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(30) UNIQUE,
  content_structured JSONB,           -- 结构化的问诊流程
  embedding VECTOR(1536)
);

-- 观音百签（对外叫 Oracle Signs）
CREATE TABLE oracle_signs_master (
  sign_number INT PRIMARY KEY,        -- 1-100
  level VARCHAR(30) NOT NULL,         -- 'Divine Tailwind' | 'Fair Sky' | ...
  level_subtitle VARCHAR(50),
  
  -- 原始数据（用于 AI 背景理解）
  chinese_poem TEXT,
  chinese_historical_reference TEXT,
  chinese_interpretation_traditional TEXT,
  
  -- 本土化输出
  verse_en TEXT NOT NULL,             -- 精修禅诗
  verse_zh TEXT NOT NULL,
  
  -- AI 生成的引导
  core_wisdom VARCHAR(50),
  keywords TEXT[],
  ai_prompt_guidance JSONB,           -- {for_love: "...", for_career: "..."}
  
  embedding VECTOR(1536)
);
```

### 05.3.3 Hybrid Search 检索策略

不用纯向量检索，用**向量 + 关键词 + 元数据过滤**的混合策略。

```typescript
async function ragSearch(params: {
  query: string;
  sessionContext?: string;
  topK: { insights: number; cases: number; guides: number };
  filters: { domain?: string; school?: string };
}): Promise<KnowledgeResult[]> {
  
  // 1. 生成 query embedding
  const queryEmbedding = await embedQuery(params.query);
  
  // 2. 识别 query 的关键词（用 Haiku 或简单 NLP）
  const keywords = await extractKeywords(params.query);
  
  // 3. 并行检索三类知识
  const [insights, cases, guides] = await Promise.all([
    searchInsights(queryEmbedding, keywords, params.filters, params.topK.insights),
    searchCases(queryEmbedding, keywords, params.filters, params.topK.cases),
    searchGuides(queryEmbedding, params.filters, params.topK.guides),
  ]);
  
  // 4. Re-rank（用 cross-encoder 或 LLM 对候选重排）
  const reranked = await rerank([...insights, ...cases, ...guides], params.query);
  
  return reranked;
}
```

**SQL 查询示例**（insights）：

```sql
SELECT 
  id, title, content, school, priority,
  -- 向量相似度
  1 - (embedding <=> $1) AS vector_sim,
  -- 关键词匹配
  CASE 
    WHEN keywords && $2 THEN 0.3 
    ELSE 0 
  END AS keyword_boost
FROM knowledge_insights
WHERE 
  ($3 IS NULL OR domain = $3)
  AND ($4 IS NULL OR school = $4)
ORDER BY 
  (1 - (embedding <=> $1)) + 
  CASE WHEN keywords && $2 THEN 0.3 ELSE 0 END +
  priority * 0.05
DESC
LIMIT $5;
```

### 05.3.4 Embedding 生成

```typescript
// 使用 OpenAI text-embedding-3-small
// 成本：$0.02 / 1M tokens（约 $0.00002 / 次用户查询）

async function embedQuery(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}
```

知识库内容的 embedding 在**数据入库时一次性生成**，不是实时生成。

### 05.3.5 知识库填充与更新

**初始填充**：
- 独门洞察 / 真实案例 / 诊断指引：从项目提炼的 3 本核心书籍和私人笔记中整理（见原 v2.0 文档提到的《数据提炼规范》）
- 观音百签：见附录 B

**持续更新**：
- 每月从 AI 调用日志中识别"AI 答得差"的场景
- 人工补充对应的洞察或案例到知识库
- 单次更新无需停机，pgvector 支持增量插入

## 05.4 存储层架构

### 05.4.1 本地存储（客户端）

**IndexedDB** 作为主要本地存储，**localStorage** 做少量配置项。

**IndexedDB schema**：

```typescript
// 使用 Dexie.js 简化 IndexedDB 操作
import Dexie, { Table } from 'dexie';

interface PojuSession {
  id: string;                    // session_id
  created_at: Date;
  last_active_at: Date;
  status: 'active' | 'archived' | 'wiped';
  title?: string;                // 用户自定义
  first_question: string;        // 脱敏前 6 字
  topic_hash: string;
  task_list: TaskList;
  domain?: string;
  archived_at?: Date;
}

interface PojuMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;               // 加密存储
  content_encrypted: string;     // AES-256-GCM
  timestamp: Date;
  attachments?: Attachment[];
}

interface OracleSign {
  id: string;
  timestamp: Date;
  question_hash: string;
  question_summary?: string;
  level: string;
  verse: string;
  meaning: string;
  action: string;
  linked_session_id?: string;
}

interface SyncroCacheEntry {
  // ─── 锁定键（查询匹配）───
  id: string;                          // 'current' 固定值，或精准拍照条目 UUID
  bazi_hash: string;                   // 八字哈希
  gender: string;
  geohash_6: string;
  shichen_id: string;                  // "YYYY-MM-DD-shichen"
  generated_at: Date;
  valid_until: Date;                   // 下一时辰开始时间
  
  // ─── 命理层（Bazi + 时辰 + 位置 唯一决定）───
  directions_core: {
    E:  { palace, flying_star, element_interaction, rating, stars };
    SE: { palace, flying_star, element_interaction, rating, stars };
    // ... S, SW, W, NW, N, NE
  };
  
  // ─── 叙事层（按职业分别缓存）───
  narrative_by_profession: {
    [profession: string]: {
      E:  { best_for: { title, description }, avoid };
      // ... 8 方位
    };
  };
  current_profession: string;
  
  // ─── 元数据 ───
  metadata: {
    solar_time_adjusted: string;
    magnetic_declination: number;
    last_gps: { lat: number; lng: number };
  };
  
  // ─── 精准拍照条目专用 ───
  is_precise_photo?: boolean;
  custom_name?: string;                // "My desk" etc.
  precise_azimuth?: number;            // 仅内部使用
}

class PojuDB extends Dexie {
  sessions!: Table<PojuSession>;
  messages!: Table<PojuMessage>;
  oracle_signs!: Table<OracleSign>;
  syncro_entries!: Table<SyncroCacheEntry>;
  
  constructor() {
    super('pojulife_v1');
    this.version(1).stores({
      sessions: 'id, created_at, status',
      messages: 'id, session_id, timestamp',
      oracle_signs: 'id, timestamp, question_hash',
      syncro_entries: 'id, shichen_id, geohash_6, is_precise_photo',
    });
  }
}
```

**localStorage 存储项**：

```typescript
const LS_KEYS = {
  DEVICE_ID: 'pojulife_device_id',                  // 设备指纹哈希
  DISCLAIMER_AGREED: 'pojulife_disclaimer_v1',      // 免责协议已同意（带版本号）
  DISCLAIMER_AGREED_AT: 'pojulife_disclaimer_at',   // 同意时间
  ENCRYPTION_KEY: 'pojulife_enc_key',               // 加密密钥（本地生成）
  BAZI: 'pojulife_bazi',                            // 八字（未加密，低敏感）
  USER_PREFERENCES: 'pojulife_prefs',               // 语言、音效开关等
};
```

### 05.4.2 服务端存储（最小化）

服务端**绝不存储**：
- 聊天对话内容
- Oracle 抽签问题和结果
- Syncro 的具体分析内容
- 任何能标识用户身份的数据

服务端**只存储**：

```sql
-- 设备指纹（哈希化）
CREATE TABLE device_fingerprints (
  fingerprint_hash VARCHAR(64) PRIMARY KEY,       -- SHA-256 of FingerprintJS output
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  country VARCHAR(2),                             -- 仅 GeoIP 国家，不存具体城市
  -- NO user id, NO email, NO name
);

-- 付款记录（用于 webhook 处理 + 售后对账）
CREATE TABLE payment_records (
  id UUID PRIMARY KEY,
  payment_provider VARCHAR(20),                   -- 'stripe' | 'paddle'
  provider_payment_id VARCHAR(100),               -- Stripe/Paddle 的原始 ID
  amount_usd DECIMAL(6, 2),
  status VARCHAR(20),                             -- 'pending' | 'paid' | 'refunded'
  session_token_hash VARCHAR(64),                 -- 消费时核对用，消费后失效
  created_at TIMESTAMPTZ DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  -- NO user id, NO email, NO session content
);

-- 延迟邮件队列（临时存储邮箱，发送后销毁）
CREATE TABLE scheduled_emails (
  id UUID PRIMARY KEY,
  email VARCHAR(255),                             -- 临时存储，发送后删
  subject TEXT,
  content_html TEXT,                              -- 邮件内容已脱敏
  attachment_path TEXT,                           -- PDF 文件路径
  send_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status VARCHAR(20),                             -- 'pending' | 'sent' | 'failed' | 'deleted'
  deletion_scheduled_at TIMESTAMPTZ,              -- 发送成功后 24 小时删除
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**数据保留策略**：
- `device_fingerprints`：保留 365 天，不活跃自动删除
- `payment_records`：保留 7 年（税务合规），但期间可用
- `scheduled_emails`：发送成功后 24 小时自动删除（包含邮件地址和附件）
- `ai_call_logs`：保留 90 天，只用于成本监控

## 05.5 加密层

### 05.5.1 客户端数据加密

所有敏感本地数据使用 **AES-256-GCM** 加密。

**加密密钥生成**：

```typescript
// 用户首次访问时生成密钥，存 localStorage
async function generateEncryptionKey(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  // 导出并存 localStorage（用户换浏览器 = 密钥丢失 = 数据不可恢复）
  const exported = await crypto.subtle.exportKey('raw', key);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  localStorage.setItem('pojulife_enc_key', base64);
  
  return key;
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem('pojulife_enc_key');
  if (stored) {
    const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
  }
  return generateEncryptionKey();
}
```

**加密 / 解密**：

```typescript
async function encrypt(plaintext: string): Promise<string> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  
  // 返回格式: base64(iv + ciphertext)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(ciphertextB64: string): Promise<string> {
  const key = await getOrCreateKey();
  const combined = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
}
```

### 05.5.2 设备指纹

使用 **FingerprintJS** (Open Source 版) 生成设备指纹。

```typescript
import FingerprintJS from '@fingerprintjs/fingerprintjs';

async function getDeviceId(): Promise<string> {
  let deviceId = localStorage.getItem('pojulife_device_id');
  
  if (!deviceId) {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    
    // 客户端再哈希一次，服务端存储的就是双哈希
    deviceId = await sha256(result.visitorId);
    localStorage.setItem('pojulife_device_id', deviceId);
  }
  
  return deviceId;
}
```

服务端存储前再哈希一次（双重保护）。即使数据库泄露，攻击者也无法反推用户设备。

### 05.5.3 传输层

- 全站 HTTPS only，HSTS enabled
- API 通信使用 Bearer Token（Session ID）
- PDF 发送邮件使用加密链接（临时 URL，48 小时过期）

## 05.6 支付层抽象

### 05.6.1 Provider 抽象接口

```typescript
interface PaymentProvider {
  name: 'stripe' | 'paddle' | 'braintree';
  
  createCheckoutSession(params: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ checkoutUrl: string; sessionId: string }>;
  
  verifyWebhookSignature(
    payload: string,
    signature: string
  ): Promise<boolean>;
  
  extractPaymentInfo(
    webhookPayload: any
  ): Promise<{
    providerPaymentId: string;
    status: 'paid' | 'refunded' | 'failed';
    amountUsd: number;
    metadata: Record<string, string>;
  }>;
}

class StripeProvider implements PaymentProvider { /* ... */ }
class PaddleProvider implements PaymentProvider { /* ... */ }
```

### 05.6.2 Webhook → Session Token 流程

```typescript
// POST /api/webhook/payment
async function handlePaymentWebhook(req: Request) {
  // 1. 验证签名
  const provider = getProvider();
  const isValid = await provider.verifyWebhookSignature(
    await req.text(),
    req.headers.get('signature')!
  );
  if (!isValid) return Response.json({ error: 'Invalid signature' }, { status: 401 });
  
  // 2. 提取支付信息
  const info = await provider.extractPaymentInfo(await req.json());
  if (info.status !== 'paid') return Response.json({ ok: true });
  
  // 3. 生成 Session Token
  const token = crypto.randomUUID();
  const tokenHash = await sha256(token);
  
  // 4. 存入 payment_records
  await db.insert('payment_records', {
    payment_provider: provider.name,
    provider_payment_id: info.providerPaymentId,
    amount_usd: info.amountUsd,
    status: 'paid',
    session_token_hash: tokenHash,
    created_at: new Date(),
  });
  
  // 5. 返回 token 给前端（前端通过 redirect URL 获取）
  return Response.json({ token });
}

// GET /chat?token=xxx
// 前端页面加载时消费 token
async function consumeToken(token: string): Promise<{ sessionId: string } | null> {
  const tokenHash = await sha256(token);
  const record = await db.query(
    'SELECT id FROM payment_records WHERE session_token_hash = ? AND consumed_at IS NULL AND status = ? LIMIT 1',
    [tokenHash, 'paid']
  );
  
  if (!record) return null;
  
  // 标记消费
  await db.update('payment_records', 
    { id: record.id }, 
    { consumed_at: new Date() }
  );
  
  // 返回新的 session ID（前端用这个管理本地 session）
  return { sessionId: crypto.randomUUID() };
}
```

## 05.7 邮件层（Resend）

### 05.7.1 Resend 配置

选择 Resend 的理由：
- 支持 Scheduled Send API（原生定时发送，不需自建 cron）
- 开发者友好的 API
- 免费额度 3000 封/月（足够 MVP）

### 05.7.2 立即发送（PDF 报告）

```typescript
async function sendPDFReport(email: string, pdfPath: string, sessionContext: any) {
  await resend.emails.send({
    from: 'POJU <readings@pojulife.com>',
    to: email,
    subject: 'Your POJU Reading',
    html: renderEmailTemplate('pdf_report', sessionContext),
    attachments: [{
      filename: 'your_reading.pdf',
      content: await fs.readFile(pdfPath),
    }],
  });
  
  // 24 小时后删除邮箱记录
  scheduleEmailDeletion(email, 24 * 60 * 60 * 1000);
}
```

### 05.7.3 定时发送（回访 check-in）

```typescript
async function scheduleCheckIn(email: string, sendAt: Date, context: any) {
  await resend.emails.send({
    from: 'POJU <checkin@pojulife.com>',
    to: email,
    subject: 'A check-in from POJU',
    html: renderEmailTemplate('check_in', context),
    scheduled_at: sendAt.toISOString(),
  });
  
  // 入库，便于用户取消 + 发送后删除
  await db.insert('scheduled_emails', {
    email,
    subject: 'A check-in from POJU',
    send_at: sendAt,
    status: 'pending',
    deletion_scheduled_at: new Date(sendAt.getTime() + 24 * 60 * 60 * 1000),
  });
}
```

### 05.7.4 邮箱销毁机制

发送完成后 24 小时内，自动从数据库物理删除邮箱地址。

```sql
-- 定期任务（每小时跑一次）
DELETE FROM scheduled_emails 
WHERE 
  status = 'sent' 
  AND sent_at < NOW() - INTERVAL '24 hours';
```

Resend 端的数据保留策略：在 Resend 后台配置"30 天自动删除"。

## 05.8 八字计算服务

**不使用 AI 计算八字**——八字是确定性数学算法，AI 会出错。

使用 `lunar-javascript` 库（npm 成熟库）：

```typescript
import { Solar, Lunar } from 'lunar-javascript';

interface BaziInput {
  year: number;     // 阳历年
  month: number;    // 阳历月
  day: number;      // 阳历日
  hour: number;     // 0-23，或 -1 表示未知
}

interface BaziOutput {
  year: { stem: string; branch: string };    // 年柱
  month: { stem: string; branch: string };   // 月柱
  day: { stem: string; branch: string };     // 日柱
  hour: { stem: string; branch: string } | null;  // 时柱，未知时为 null
  lunar: string;                              // 农历表示
  shichen: string;                            // 时辰名
  accuracy: 'full' | 'partial';               // 全八字 or 无时柱
}

function calculateBazi(input: BaziInput): BaziOutput {
  const solar = Solar.fromYmdHms(
    input.year,
    input.month,
    input.day,
    input.hour >= 0 ? input.hour : 0,
    0,
    0
  );
  const lunar = solar.getLunar();
  
  return {
    year: { stem: lunar.getYearGan(), branch: lunar.getYearZhi() },
    month: { stem: lunar.getMonthGan(), branch: lunar.getMonthZhi() },
    day: { stem: lunar.getDayGan(), branch: lunar.getDayZhi() },
    hour: input.hour >= 0 
      ? { stem: lunar.getTimeGan(), branch: lunar.getTimeZhi() }
      : null,
    lunar: lunar.toString(),
    shichen: lunar.getTimeZhi(),
    accuracy: input.hour >= 0 ? 'full' : 'partial',
  };
}
```

### 05.8.1 12 时辰段映射

```typescript
const SHICHEN_MAP = [
  { name: 'Zi',   chinese: '子', label: 'Midnight',        range: [23, 1],  hour: 0 },
  { name: 'Chou', chinese: '丑', label: 'Late Night',      range: [1, 3],   hour: 2 },
  { name: 'Yin',  chinese: '寅', label: 'Pre-Dawn',        range: [3, 5],   hour: 4 },
  { name: 'Mao',  chinese: '卯', label: 'Sunrise',         range: [5, 7],   hour: 6 },
  { name: 'Chen', chinese: '辰', label: 'Morning',         range: [7, 9],   hour: 8 },
  { name: 'Si',   chinese: '巳', label: 'Late Morning',    range: [9, 11],  hour: 10 },
  { name: 'Wu',   chinese: '午', label: 'Noon',            range: [11, 13], hour: 12 },
  { name: 'Wei',  chinese: '未', label: 'Early Afternoon', range: [13, 15], hour: 14 },
  { name: 'Shen', chinese: '申', label: 'Afternoon',       range: [15, 17], hour: 16 },
  { name: 'You',  chinese: '酉', label: 'Sunset',          range: [17, 19], hour: 18 },
  { name: 'Xu',   chinese: '戌', label: 'Evening',         range: [19, 21], hour: 20 },
  { name: 'Hai',  chinese: '亥', label: 'Night',           range: [21, 23], hour: 22 },
];

function shichenFromUserChoice(userChoice: string): number {
  // userChoice 是 12 时辰之一，返回代表性小时（用于八字计算）
  const entry = SHICHEN_MAP.find(s => s.name === userChoice || s.label === userChoice);
  return entry ? entry.hour : -1;  // -1 表示未知
}
```

## 05.9 隐私承诺的技术实现

对应第 01.5 节的三条品牌承诺，各自的技术落地：

**Never stored**
- 客户端 IndexedDB 存数据，服务端零对话内容
- 服务端付款记录 7 年（税务合规），但只有哈希 + 金额
- 服务端邮箱 24 小时内物理删除
- AI 调用日志 90 天自动删除

**Never required**
- 无账户系统（无 users 表）
- 无登录页面
- 无密码
- 支付通过 Stripe，不经过我们的系统

**Never manipulative**
- 无弹窗挽留
- 无假倒计时
- 无默认勾选（免责协议默认不勾选）
- 无"仅今天特价"一类话术
- 关闭/删除按钮明显可见
- 隐私政策写人话（见第 09 章）

## 05.10 全局错误处理与降级

### 05.10.1 AI 调用失败

```typescript
async function callAIWithFallback(params: AICallParams): Promise<AIResponse> {
  try {
    return await sonnet.call(params);
  } catch (error) {
    // Level 1: 重试 Sonnet 一次
    await sleep(1000);
    try {
      return await sonnet.call(params);
    } catch {
      // Level 2: 降级到 Opus（更稳但更贵）
      try {
        return await opus.call(params);
      } catch {
        // Level 3: 返回友好错误
        return {
          type: 'error',
          message: "Let me try again. Something in the signal is unclear.",
          retry_allowed: true,
        };
      }
    }
  }
}
```

### 05.10.2 网络失败

客户端所有 API 调用：
- 自动重试 3 次（指数退避）
- 3 次失败后显示友好错误 + "Try again" 按钮
- 不消耗 session token（token 在客户端持有直到成功消费）

### 05.10.3 付款失败保护

- 支付过程失败 → Stripe / Paddle 侧就失败 → 用户看到 "Payment failed" 页面
- 支付成功但 webhook 丢失 → 客户端有 token 持久化 + 重试机制
- 支付成功但 AI 首次调用失败 → 保持 session 有效，显示 "Try again"
- 用户要求退款 → 人工处理（邮件到 support@pojulife.com）



---

# 第 06 章 · 前端架构（PWA + Three.js）

> 本章定义前端的技术选型、目录结构、性能策略、PWA 规范。

## 06.1 技术栈总览

| 层 | 技术 | 理由 |
|---|---|---|
| 框架 | **Next.js 14 App Router** | SSR + API Routes + 成熟生态 |
| 语言 | **TypeScript 5+** | 类型安全，多产品复用类型 |
| UI | **React 18 + Tailwind CSS** | Tailwind 快速构建，类型化主题系统 |
| 3D | **React Three Fiber + Three.js** | 粒子球核心；声明式 API |
| Shader | **GLSL + three/tsl** | 自定义粒子效果 |
| 动画 | **Framer Motion** | UI 过渡、页面切换 |
| 音效 | **Howler.js** | 跨浏览器稳定音频 |
| 本地存储 | **Dexie.js**（IndexedDB 封装） | 类型安全 + Promise API |
| 指纹 | **FingerprintJS OSS** | 免费版足够 |
| 状态管理 | **Zustand** | 轻量，无 Redux 的样板代码 |
| 表单 | **React Hook Form + Zod** | 八字输入等表单验证 |
| 流式渲染 | **Vercel AI SDK** | Streaming + React hooks |
| PWA | **Serwist（Workbox 现代化版）** | Next.js 14 支持最好 |
| 部署 | **Vercel** | 和 Next.js 一体 |

## 06.2 目录结构

```
pojulife/
├── app/                          # Next.js 14 App Router
│   ├── (marketing)/              # 营销路由组（落地页）
│   │   ├── page.tsx              # /
│   │   ├── poju/page.tsx         # /poju
│   │   ├── syncro/page.tsx       # /syncro
│   │   └── oracle/page.tsx       # /oracle
│   ├── (product)/                # 产品路由组
│   │   ├── chat/page.tsx         # /chat
│   │   ├── archive/page.tsx      # /archive
│   │   └── disclaimer/page.tsx   # /disclaimer
│   ├── api/                      # API Routes
│   │   ├── ai/                   # AI 调用代理
│   │   │   ├── poju/route.ts
│   │   │   ├── syncro/route.ts
│   │   │   └── oracle/route.ts
│   │   ├── payment/
│   │   │   ├── checkout/route.ts
│   │   │   └── webhook/route.ts
│   │   ├── email/
│   │   │   └── send-pdf/route.ts
│   │   └── pdf/
│   │       └── generate/route.ts
│   ├── layout.tsx
│   ├── global.css
│   └── providers.tsx
│
├── components/                   # 共享组件
│   ├── ui/                       # 基础 UI（按钮、输入框等）
│   ├── chat/                     # POJU Chat 组件
│   │   ├── ChatLayout.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── ThinkingBubble.tsx
│   │   ├── InputBar.tsx
│   │   └── Sidebar.tsx
│   ├── syncro/                   # Syncro 组件
│   │   ├── ParticleSphere.tsx
│   │   ├── ARViewport.tsx
│   │   ├── CompassCalibration.tsx
│   │   └── DirectionCards.tsx
│   ├── oracle/                   # Oracle 组件
│   │   ├── OracleScene.tsx
│   │   ├── ExplosionEffect.tsx
│   │   ├── SignCard.tsx
│   │   └── VerseInscription.tsx
│   ├── archive/
│   │   └── ArchiveGrid.tsx
│   └── disclaimer/
│       └── DisclaimerModal.tsx
│
├── lib/                          # 业务逻辑
│   ├── ai/                       # AI 相关
│   │   ├── orchestrator.ts
│   │   ├── thinking-styler.ts
│   │   ├── prompts/
│   │   │   ├── poju-system.ts
│   │   │   ├── syncro-system.ts
│   │   │   ├── oracle-system.ts
│   │   │   └── typology-translator.ts
│   │   └── models.ts
│   ├── rag/                      # RAG 相关
│   │   ├── search.ts
│   │   ├── embed.ts
│   │   └── rerank.ts
│   ├── storage/                  # 本地存储
│   │   ├── db.ts                 # Dexie 实例
│   │   ├── encryption.ts
│   │   └── session-manager.ts
│   ├── bazi/                     # 八字计算
│   │   ├── calculate.ts
│   │   └── shichen.ts
│   ├── sensors/                  # 硬件传感器
│   │   ├── compass.ts
│   │   ├── gps.ts
│   │   └── motion.ts
│   ├── audio/                    # 音效管理
│   │   └── sfx.ts
│   ├── payment/                  # 支付抽象
│   │   ├── provider-interface.ts
│   │   ├── stripe-provider.ts
│   │   └── paddle-provider.ts
│   └── utils/
│       ├── fingerprint.ts
│       ├── crypto.ts
│       └── formatting.ts
│
├── shaders/                      # GLSL shaders
│   ├── particle.vert
│   ├── particle.frag
│   ├── explosion.vert
│   └── aura.frag
│
├── public/
│   ├── fonts/                    # 思源宋体/黑体/EB Garamond
│   ├── sfx/                      # 音效资源（压缩后 <50KB 每段）
│   │   ├── explosion.mp3
│   │   ├── brush.mp3
│   │   ├── bell.mp3
│   │   └── hum.mp3
│   ├── logos/
│   └── manifest.json             # PWA manifest
│
├── styles/
│   └── tokens.css                # Design tokens
│
├── types/                        # TypeScript 类型定义
│   ├── session.ts
│   ├── oracle.ts
│   ├── syncro.ts
│   └── ai.ts
│
├── scripts/                      # 工具脚本
│   ├── seed-knowledge-base.ts
│   ├── migrate-oracle-signs.ts
│   └── generate-embeddings.ts
│
├── tests/
│   ├── e2e/
│   └── unit/
│
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## 06.3 PWA 配置

### 06.3.1 manifest.json

```json
{
  "name": "POJU — Break your deadlock",
  "short_name": "POJU",
  "description": "Ancient Eastern Wisdom, reinforced by modern science, delivered by AI Agent, personalized for you.",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0a0a0f",
  "theme_color": "#0a0a0f",
  "categories": ["lifestyle", "wellness", "self-improvement"],
  "icons": [
    {
      "src": "/logos/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/logos/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/logos/icon-512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/syncro.png",
      "sizes": "1080x1920",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

### 06.3.2 Service Worker（使用 Serwist）

```typescript
// app/sw.ts
import { defaultCache } from '@serwist/next/worker';
import { installSerwist } from 'serwist';

installSerwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 字体永久缓存
    {
      urlPattern: /\.(woff2|ttf|otf)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'fonts',
        expiration: { maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    // 音效永久缓存
    {
      urlPattern: /\/sfx\/.*\.(mp3|wav)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'audio',
      },
    },
    // 知识库快照（可选）
    {
      urlPattern: /\/api\/oracle-signs$/,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'oracle-signs' },
    },
    // AI 调用不缓存
    {
      urlPattern: /\/api\/ai\//,
      handler: 'NetworkOnly',
    },
    ...defaultCache,
  ],
});
```

### 06.3.3 iOS 添加到主屏幕引导

iOS Safari 不支持一键安装，需要引导用户手动操作。

```typescript
// components/pwa/InstallPromptIOS.tsx
function InstallPromptIOS() {
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const hasSeen = localStorage.getItem('pwa_prompt_seen');
    
    // 只在 iOS + 非 standalone + 第一次访问 Syncro 页面时显示
    if (isIOS && !isStandalone && !hasSeen) {
      setShow(true);
    }
  }, []);
  
  if (!show) return null;
  
  return (
    <Modal onClose={() => {
      localStorage.setItem('pwa_prompt_seen', 'true');
      setShow(false);
    }}>
      <h3>Add POJU to your home screen</h3>
      <p>Full-screen experience. No browser bars. Works offline.</p>
      <div className="animation">
        {/* 动画示范：点击分享图标 → 选择"添加到主屏幕" */}
      </div>
      <Button onClick={dismiss}>Got it</Button>
    </Modal>
  );
}
```

## 06.4 3D 粒子球实现

### 06.4.1 React Three Fiber 基础结构

```typescript
// components/syncro/ParticleSphere.tsx
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

export function ParticleSphere({ 
  azimuth, 
  directions, 
  mode, 
  particleCount 
}: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      gl={{ 
        antialias: true, 
        powerPreference: 'high-performance',
        alpha: true,
      }}
    >
      <ambientLight intensity={0.2} />
      <ParticleField 
        count={particleCount} 
        azimuth={azimuth}
        directions={directions}
      />
      <DirectionMarkers directions={directions} />
      {mode === 'ar' && <CameraFeedViewport azimuth={azimuth} />}
    </Canvas>
  );
}

function ParticleField({ count, azimuth, directions }: FieldProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // 初始化粒子位置（球面分布）
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2 + Math.random() * 0.3;
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);
  
  // 每帧更新粒子
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const time = clock.getElapsedTime();
    
    for (let i = 0; i < count; i++) {
      // Curl noise 位移
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      
      const noise = curlNoise(x * 0.3, y * 0.3, z * 0.3 + time * 0.1);
      
      dummy.position.set(
        x + noise.x * 0.1,
        y + noise.y * 0.1,
        z + noise.z * 0.1
      );
      
      // 距离当前方位越近，粒子越亮
      const dirDistance = calculateDirectionDistance(x, y, z, azimuth);
      const brightness = 1 - dirDistance;
      
      dummy.scale.setScalar(0.02 + brightness * 0.03);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });
  
  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <shaderMaterial 
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uColorA: { value: new THREE.Color('#1a1f3a') },
          uColorB: { value: new THREE.Color('#d4af37') },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}
```

### 06.4.2 GLSL Shaders

```glsl
// shaders/particle.vert
uniform float uTime;
varying vec3 vColor;
varying float vAlpha;

void main() {
  // 位置带入模型变换
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  // 传递颜色和透明度
  vColor = vec3(1.0);
  vAlpha = 1.0;
}
```

```glsl
// shaders/particle.frag
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec3 vColor;
varying float vAlpha;

void main() {
  // 粒子呈现为发光的圆点
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  
  if (dist > 0.5) discard;
  
  float glow = 1.0 - smoothstep(0.0, 0.5, dist);
  vec3 color = mix(uColorA, uColorB, glow);
  
  gl_FragColor = vec4(color, glow * vAlpha);
}
```

### 06.4.3 摄像头 Feed 作为 Three.js Texture

AR 模式的核心：摄像头 feed 贴到一个圆形 mask 上，叠加粒子效果。

```typescript
// components/syncro/CameraFeedViewport.tsx
export function CameraFeedViewport({ azimuth }: Props) {
  const videoRef = useRef<HTMLVideoElement>();
  const textureRef = useRef<THREE.VideoTexture>();
  
  useEffect(() => {
    // 获取摄像头 feed
    navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' }  // 后置摄像头
    }).then(stream => {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      video.play();
      videoRef.current = video;
      
      // 创建 Video Texture
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      textureRef.current = texture;
    });
    
    return () => {
      videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    };
  }, []);
  
  // 当前方位对应的光晕颜色
  const auraColor = useMemo(() => {
    return getAuraColorForDirection(azimuth);
  }, [azimuth]);
  
  return (
    <mesh position={[0, 0, -1]}>
      <circleGeometry args={[0.8, 64]} />
      <shaderMaterial
        uniforms={{
          uVideo: { value: textureRef.current },
          uAuraColor: { value: auraColor },
          uAuraIntensity: { value: 0.6 },
        }}
        vertexShader={auraVertexShader}
        fragmentShader={auraFragmentShader}
      />
    </mesh>
  );
}
```

### 06.4.4 性能分级检测

```typescript
// lib/sensors/device-tier.ts
export async function detectDeviceTier(): Promise<'flagship' | 'mid' | 'low'> {
  // 1. 检测 GPU
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
  if (!gl) return 'low';
  
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
  
  // 2. 检测硬件内存
  const memory = (navigator as any).deviceMemory || 4;
  
  // 3. 检测 CPU 核心
  const cores = navigator.hardwareConcurrency || 4;
  
  // 4. 综合判断
  const isAppleSilicon = /Apple M|A1[4-9]|A2\d/.test(renderer);
  const isHighAndroid = /Adreno 7|Mali-G78|Mali-G710/.test(renderer);
  
  if ((isAppleSilicon || isHighAndroid) && memory >= 6 && cores >= 6) {
    return 'flagship';
  }
  if (memory >= 4 && cores >= 4) {
    return 'mid';
  }
  return 'low';
}

export const TIER_CONFIG = {
  flagship: { particleCount: 5000, shaderQuality: 'high', fps: 60 },
  mid:      { particleCount: 2000, shaderQuality: 'medium', fps: 60 },
  low:      { particleCount: 800,  shaderQuality: 'low', fps: 30 },
};
```

### 06.4.5 节能模式

```typescript
// lib/performance/eco-mode.ts
export function useEcoMode() {
  const [ecoMode, setEcoMode] = useState(false);
  
  useEffect(() => {
    // 5 分钟无交互自动进入节能
    let timer: NodeJS.Timeout;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setEcoMode(true), 5 * 60 * 1000);
    };
    
    ['touchstart', 'click', 'scroll'].forEach(evt => 
      window.addEventListener(evt, reset)
    );
    reset();
    
    return () => clearTimeout(timer);
  }, []);
  
  // 电池低于 20% 自动进入节能
  useEffect(() => {
    (navigator as any).getBattery?.().then((battery: any) => {
      if (battery.level < 0.2) setEcoMode(true);
    });
  }, []);
  
  return { ecoMode, setEcoMode };
}
```

## 06.5 Oracle 动画实现

### 06.5.1 爆炸动画（粒子消散）

```typescript
// components/oracle/ExplosionEffect.tsx
export function ExplosionEffect({ 
  isTriggered, 
  onComplete 
}: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const velocities = useMemo(() => generateExplosionVelocities(2000), []);
  const startTime = useRef<number | null>(null);
  
  useFrame(({ clock }) => {
    if (!isTriggered || !meshRef.current) return;
    
    if (startTime.current === null) {
      startTime.current = clock.getElapsedTime();
    }
    
    const elapsed = clock.getElapsedTime() - startTime.current;
    
    if (elapsed > 2) {
      onComplete();
      return;
    }
    
    // 粒子从中心向外爆炸 + 渐变消散
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 2000; i++) {
      const t = elapsed;
      dummy.position.set(
        velocities[i * 3]     * t,
        velocities[i * 3 + 1] * t,
        velocities[i * 3 + 2] * t
      );
      
      const scale = 0.02 * (1 - elapsed / 2);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });
  
  return (
    <instancedMesh ref={meshRef} args={[null, null, 2000]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial 
        color="#d4af37" 
        transparent 
        opacity={0.8}
      />
    </instancedMesh>
  );
}
```

### 06.5.2 毛笔写入效果

使用 SVG + `stroke-dasharray` 动画实现毛笔字写入。

```typescript
// components/oracle/VerseInscription.tsx
export function VerseInscription({ 
  verse, 
  onComplete 
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onAnimationComplete={() => {
        // 触发音效
        playSFX('brush');
      }}
    >
      {verse.split('\n').map((line, i) => (
        <motion.p
          key={i}
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          animate={{ clipPath: 'inset(0 0% 0 0)' }}
          transition={{
            duration: 2.5,
            delay: i * 2.5,
            ease: [0.22, 1, 0.36, 1],  // easeOutCubic
          }}
          onAnimationComplete={() => {
            if (i === verse.split('\n').length - 1) {
              playSFX('bell');
              onComplete();
            }
          }}
          className="verse-line"
        >
          {line}
        </motion.p>
      ))}
    </motion.div>
  );
}
```

### 06.5.3 毛笔音效循环

```typescript
// lib/audio/sfx.ts
import { Howl } from 'howler';

class SFXManager {
  private sounds: Record<string, Howl> = {};
  private muted: boolean = false;
  
  preload() {
    this.sounds.explosion = new Howl({ src: ['/sfx/explosion.mp3'], volume: 0.7 });
    this.sounds.brush = new Howl({ 
      src: ['/sfx/brush.mp3'], 
      loop: true,
      volume: 0.3,
    });
    this.sounds.bell = new Howl({ src: ['/sfx/bell.mp3'], volume: 0.6 });
    this.sounds.hum = new Howl({ 
      src: ['/sfx/hum.mp3'], 
      loop: true,
      volume: 0.2,
    });
  }
  
  play(name: string) {
    if (this.muted) return;
    this.sounds[name]?.play();
  }
  
  stop(name: string) {
    this.sounds[name]?.stop();
  }
  
  toggleMute() {
    this.muted = !this.muted;
    Howler.mute(this.muted);
  }
}

export const sfx = new SFXManager();
```

## 06.6 主题系统

### 06.6.1 Design Tokens

```css
/* styles/tokens.css */
:root {
  /* 背景 */
  --bg-deep:     #0a0a0f;     /* 最深背景 */
  --bg-layer-1:  #12121a;     /* 卡片背景 */
  --bg-layer-2:  #1a1a26;     /* 悬浮层 */
  
  /* 金色系（东方神秘感点缀） */
  --gold-primary:  #d4af37;
  --gold-soft:     #e5c76b;
  --gold-dim:      #8a7028;
  
  /* 文字 */
  --text-primary:  #f0f0f0;
  --text-body:     #c0c0c0;
  --text-dim:      #808080;
  --text-very-dim: #505050;
  
  /* 品牌色（风向系对应） */
  --wind-divine:     #f0e7c8;
  --wind-fair:       #a8c4d8;
  --wind-calm:       #7fa896;
  --wind-still:      #d0d0d0;
  --wind-cross:      #c89a6a;
  --wind-head:       #8a4a4a;
  --wind-storm:      #4a3a5a;
  
  /* Syncro 方位色 */
  --dir-wealth:   #d4af37;
  --dir-focus:    #6ba8c8;
  --dir-love:     #d89a9a;
  --dir-health:   #7ea88a;
  --dir-helper:   #9a7ec8;
  --dir-conflict: #8a4a4a;
  --dir-loss:     #707070;
  --dir-shadow:   #505050;
  
  /* 间距 */
  --space-1:   4px;
  --space-2:   8px;
  --space-3:   16px;
  --space-4:   24px;
  --space-5:   32px;
  --space-6:   48px;
  --space-7:   64px;
  
  /* 圆角 */
  --radius-sm:  4px;
  --radius-md:  8px;
  --radius-lg:  16px;
  --radius-xl:  24px;
  
  /* 阴影 */
  --shadow-sm:  0 2px 8px rgba(0,0,0,0.3);
  --shadow-md:  0 8px 24px rgba(0,0,0,0.4);
  --shadow-gold: 0 0 24px rgba(212, 175, 55, 0.2);
  
  /* 过渡 */
  --ease-in-out:  cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out:     cubic-bezier(0.0, 0, 0.2, 1);
  --ease-in:      cubic-bezier(0.4, 0, 1, 1);
}
```

### 06.6.2 字体系统

```css
/* 中文 */
--font-zh-serif:     '思源宋体', 'Source Han Serif SC', serif;
--font-zh-sans:      '思源黑体', 'Source Han Sans SC', sans-serif;

/* 英文 */
--font-en-serif:     'EB Garamond', 'Cormorant Garamond', serif;
--font-en-sans:      'Inter', -apple-system, sans-serif;

/* 签诗专用（手写感） */
--font-verse:        'EB Garamond', 'Crimson Pro', serif;

/* Logo（破局艺术字图腾） */
--font-logo:         'POJU-Logo', var(--font-zh-serif);
```

### 06.6.3 Tailwind 配置

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          deep: 'var(--bg-deep)',
          layer1: 'var(--bg-layer-1)',
          layer2: 'var(--bg-layer-2)',
        },
        gold: {
          DEFAULT: 'var(--gold-primary)',
          soft: 'var(--gold-soft)',
          dim: 'var(--gold-dim)',
        },
        wind: {
          divine: 'var(--wind-divine)',
          fair: 'var(--wind-fair)',
          calm: 'var(--wind-calm)',
          still: 'var(--wind-still)',
          cross: 'var(--wind-cross)',
          head: 'var(--wind-head)',
          storm: 'var(--wind-storm)',
        },
        dir: {
          wealth: 'var(--dir-wealth)',
          focus: 'var(--dir-focus)',
          love: 'var(--dir-love)',
          // ...
        },
      },
      fontFamily: {
        'zh-serif': 'var(--font-zh-serif)',
        'zh-sans': 'var(--font-zh-sans)',
        'en-serif': 'var(--font-en-serif)',
        'en-sans': 'var(--font-en-sans)',
        verse: 'var(--font-verse)',
        logo: 'var(--font-logo)',
      },
      animation: {
        'breathe': 'breathe 4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'inscribe': 'inscribe 2.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
      },
    },
  },
};

export default config;
```

## 06.7 状态管理（Zustand）

### 06.7.1 POJU Chat Store

```typescript
// lib/store/chat-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatState {
  activeSessionId: string | null;
  sessions: Map<string, PojuSession>;
  messages: Map<string, PojuMessage[]>;  // sessionId -> messages
  isThinking: boolean;
  thinkingText: string;
  
  createSession: (token: string, firstQuestion: string) => string;
  setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, message: PojuMessage) => void;
  appendThinking: (text: string) => void;
  endThinking: () => void;
  archiveSession: (id: string) => void;
  wipeSession: (id: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      activeSessionId: null,
      sessions: new Map(),
      messages: new Map(),
      isThinking: false,
      thinkingText: '',
      
      createSession: (token, firstQuestion) => {
        const id = crypto.randomUUID();
        const session: PojuSession = {
          id,
          created_at: new Date(),
          last_active_at: new Date(),
          status: 'active',
          first_question: firstQuestion.slice(0, 6) + '...',
          topic_hash: hashTopic(firstQuestion),
          task_list: createInitialTaskList(firstQuestion),
        };
        
        set(state => {
          state.sessions.set(id, session);
          state.messages.set(id, []);
          state.activeSessionId = id;
          return { ...state };
        });
        
        return id;
      },
      
      // ... other methods
    }),
    {
      name: 'pojulife-chat',
      // 不持久化 thinkingText 和 isThinking
      partialize: (state) => ({ 
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);
```

### 06.7.2 Syncro Store

```typescript
// lib/store/syncro-store.ts
interface SyncroState {
  bazi: BaziData | null;
  currentLocation: { lat: number; lng: number } | null;
  currentAzimuth: number;  // 实时手机朝向（度）
  currentDirections: DirectionsData | null;
  currentShichen: ShichenData | null;
  mode: 'overhead' | 'ar';
  ecoMode: boolean;
  deviceTier: 'flagship' | 'mid' | 'low';
  
  setAzimuth: (deg: number) => void;
  loadDirections: () => Promise<void>;
  refreshDirections: () => Promise<void>;
  takePreciseReading: (azimuth: number) => Promise<SyncroCacheEntry>;
}
```

### 06.7.3 Oracle Store

```typescript
// lib/store/oracle-store.ts
interface OracleState {
  question: string;
  stage: 'enter' | 'ask' | 'respond' | 'summon' | 'reveal' | 'inscribe' | 'carry';
  currentSign: OracleSign | null;
  isLongPressing: boolean;
  longPressProgress: number;  // 0-1
  
  setQuestion: (q: string) => void;
  beginLongPress: () => void;
  cancelLongPress: () => void;
  completeLongPress: () => Promise<void>;
  summonSign: () => Promise<OracleSign>;
}
```

## 06.8 关键 API 契约

### 06.8.1 POJU Chat API

```typescript
// POST /api/ai/poju
interface POJURequest {
  session_id: string;
  bazi: BaziData;
  task_list: TaskList;
  history: Array<{ role: string; content: string }>;
  user_message: string;
  user_language: 'zh' | 'en';
}

// Server-Sent Events Response:
// event: thinking
// data: { "text": "✦ 道家云..." }
//
// event: thinking
// data: { "text": "✦ checking: ..." }
//
// event: answer
// data: { "text": "..." }
//
// event: task_update
// data: { "phase": 4, "advance_to": 5 }
//
// event: done
// data: { "duration_ms": 25000 }
```

### 06.8.2 Syncro API

```typescript
// POST /api/ai/syncro
interface SyncroRequest {
  bazi: BaziData;
  location: { lat: number; lng: number };
  shichen: string;           // 当前时辰
  mode: 'eight_directions' | 'precise';
  precise_azimuth?: number;  // 仅 precise 模式需要
}

interface SyncroResponse {
  directions: {
    N:  DirectionData;
    NE: DirectionData;
    // ... 8 个方位
  };
  science_notes: string[];
  poetic_summary: string;
  next_refresh_at: string;
}
```

### 06.8.3 Oracle API

```typescript
// POST /api/ai/oracle
interface OracleRequest {
  question: string;         // 限 60 字符
  user_language: 'zh' | 'en';
  bazi?: BaziData;          // 可选
  linked_session_id?: string;  // POJU 3 签联动场景
  role?: 'past' | 'present' | 'future';
}

interface OracleResponse {
  sign_number: number;       // 1-100
  level: string;
  level_subtitle: string;
  verse: string;
  meaning: string;           // AI 实时生成
  action: string;            // AI 实时生成
  visual_config: {
    particle_color: string;
    card_texture: string;
    card_color: string;
  };
}
```

## 06.9 错误边界与降级

### 06.9.1 React Error Boundary

```typescript
// app/error.tsx
'use client';

export default function Error({ 
  error, 
  reset 
}: { 
  error: Error; 
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-deep">
      <div className="text-center">
        <h2 className="text-gold text-2xl mb-4">Something in the signal is unclear.</h2>
        <p className="text-text-dim mb-8">
          Let's try to read it again.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
```

### 06.9.2 网络错误重试

```typescript
// lib/utils/retry.ts
export async function fetchWithRetry(
  url: string, 
  options: RequestInit = {},
  retries: number = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      
      // 5xx 错误重试，4xx 不重试
      if (res.status < 500) throw new Error(`HTTP ${res.status}`);
      
      await sleep(Math.pow(2, i) * 1000);  // 指数退避
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
  throw new Error('Max retries exceeded');
}
```

## 06.10 构建与部署

### 06.10.1 环境变量

```bash
# .env.local

# Public
NEXT_PUBLIC_SITE_URL=https://pojulife.com
NEXT_PUBLIC_FINGERPRINT_API_KEY=xxx

# Private
ANTHROPIC_API_KEY=xxx
OPENAI_API_KEY=xxx  # for embeddings only
ELEVENLABS_API_KEY=xxx
SUPABASE_URL=xxx
SUPABASE_SERVICE_KEY=xxx
STRIPE_SECRET_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx
PADDLE_API_KEY=xxx  # if using Paddle
RESEND_API_KEY=xxx

# Feature flags
NEXT_PUBLIC_ENABLE_SYNCRO=true
NEXT_PUBLIC_ENABLE_ORACLE=true
```

### 06.10.2 Vercel 部署配置

```json
// vercel.json
{
  "buildCommand": "next build",
  "framework": "nextjs",
  "regions": ["iad1", "sfo1"],
  "functions": {
    "app/api/ai/poju/route.ts": {
      "maxDuration": 60
    },
    "app/api/ai/syncro/route.ts": {
      "maxDuration": 30
    },
    "app/api/pdf/generate/route.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  },
  "crons": [
    {
      "path": "/api/cron/cleanup-emails",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/cleanup-device-fingerprints",
      "schedule": "0 3 * * *"
    }
  ]
}
```

### 06.10.3 构建优化

- **Code splitting**：按路由自动分包（Next.js 默认）
- **Tree shaking**：Three.js 使用 `three/webgpu` 按需引入
- **字体优化**：`next/font` 自动子集化
- **图片优化**：`next/image` + AVIF/WebP
- **Bundle analyzer**：`@next/bundle-analyzer`

预期 bundle size（不含 Three.js 场景代码）：
- 首屏 JS：< 200KB (gzipped)
- Three.js 场景代码：懒加载，< 300KB per scene

## 06.11 可访问性（Accessibility）

即使是美学驱动的产品，也要保证基础无障碍：

- 所有交互元素支持键盘操作
- 图片有 alt 文本
- 动画可通过 `prefers-reduced-motion` 禁用
- 颜色对比度 WCAG AA 达标
- 屏幕阅读器友好的语义化 HTML

```typescript
// 动画降级
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

<motion.div
  animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
>
  ...
</motion.div>
```

## 06.12 测试策略

### 06.12.1 测试层级

| 层级 | 工具 | 覆盖目标 |
|---|---|---|
| 单元测试 | Vitest | 工具函数、八字计算、加密、RAG 查询 |
| 组件测试 | React Testing Library | UI 组件、表单 |
| 集成测试 | Playwright | 关键用户流程 |
| E2E | Playwright | 支付流、首次使用、Oracle 完整交互 |
| 视觉回归 | Percy / Chromatic | UI 一致性 |

### 06.12.2 必须覆盖的关键流程

- 首次访问 → 勾选免责 → 进入产品
- Syncro 完整首次使用（权限请求 + 校准 + 分析）
- Oracle 完整 7 阶段
- POJU 支付 → 首次对话 → 实操反馈循环
- End & Wipe 后数据确实清除



---

# 第 07 章 · 落地页 · 导航 · The Archive

> 本章定义用户可见的页面结构，聚焦内容与信息架构。视觉细节见附录 C。

## 07.1 全站信息架构

```
pojulife.com
│
├─ /                         主落地页（产品综合入口）
│
├─ /poju                     POJU 产品页
│   └─ /chat                 付费后进入的 Chat 页面
│
├─ /syncro                   Syncro 产品页（PC 端引导下载）
│                            （移动端直接进入完整 Syncro 体验）
│
├─ /oracle                   Oracle 产品页 + 入口
│
├─ /archive                  The Archive（个人档案）
│
├─ /disclaimer               免责声明完整版
├─ /privacy                  隐私政策
├─ /terms                    服务条款
├─ /contact                  联系我们
│
└─ /about                    关于 POJU（可选，MVP 可不做）
```

## 07.2 全站导航栏

### 07.2.1 桌面端导航

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│   [破局 POJU]          POJU    SYNCRO    ORACLE    ✦ Archive│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

- 左侧 Logo：POJU 破局艺术字 + 英文 POJU
- 中部：三产品入口
- 右侧：✦ Archive（The Archive 入口，有内容时显示小圆点提示）

### 07.2.2 移动端导航

```
┌────────────────────────────┐
│                            │
│  [破局 POJU]           [≡] │
│                            │
└────────────────────────────┘
```

点击 `[≡]` 展开侧滑抽屉：

```
┌───────────────────────────┐
│                           │
│   POJU                    │
│   Ask your question →     │
│                           │
│   SYNCRO                  │
│   Your energy map →       │
│                           │
│   ORACLE                  │
│   Receive a sign →        │
│                           │
│   ──────────              │
│                           │
│   ✦ Archive               │
│                           │
│   Disclaimer              │
│   Privacy                 │
│                           │
└───────────────────────────┘
```

### 07.2.3 导航的品牌一致性规则

- **POJU 破局艺术字**始终出现在左上角，跨全站
- **字体**：Logo 用专属艺术字体（OTF），其他菜单用 `Inter`
- **颜色**：菜单项默认 `text-body` 灰，hover 变 `gold-soft`，激活变 `gold-primary`
- **交互**：所有导航点击立即响应，无加载 spinner（落地页是静态的）

### 07.2.4 移动端底部 Tab（PWA standalone 模式）

当用户以 PWA 方式打开（已添加到主屏幕），底部显示 Tab 导航：

```
┌────────────────────────────────────────┐
│                                        │
│         [主内容区域]                    │
│                                        │
├────┬────────┬────────┬────────┬───────┤
│ ⌂  │ POJU   │ SYNCRO │ ORACLE │   ✦  │
└────┴────────┴────────┴────────┴───────┘
```

- 5 个 Tab：Home / POJU / Syncro / Oracle / Archive
- 左右滑动切换（与你的 APP 设想一致）
- 当前 Tab 下方金色小圆点

## 07.3 主落地页（/）

这是用户从搜索、推荐、广告进入的第一屏。目标：**10 秒内让用户理解产品 + 识别自己是否是目标用户**。

### 07.3.1 落地页结构（6 屏）

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen 1 · 主视觉（Hero）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen 2 · 产品三元关系（Ancient · Modern · You）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen 3 · 三产品入口（Syncro / POJU / Oracle）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen 4 · 科学叙事（Modern Science Anchor）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen 5 · 隐私承诺（Three Nevers）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen 6 · 底部（Footer · 链接 · 版权）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 07.3.2 Screen 1 · Hero（主视觉）

```
┌──────────────────────────────────────────────┐
│                                              │
│            [破局艺术字 · 金色]                │
│              POJU                            │
│                                              │
│                                              │
│    The wisdom that costs $300 with a master. │
│    Delivered in one conversation. $9.99.     │
│                                              │
│                                              │
│      [ Ask your question  →  $9.99 ]         │
│                                              │
│      Or: See your energy map  ·  Free        │
│                                              │
│                                              │
│                                              │
│     [背景：缓慢流动的深空粒子场]               │
│     [Logo 周围有微弱金光呼吸]                  │
│                                              │
└──────────────────────────────────────────────┘
```

**文案规则**：
- 主 CTA 英文："Ask your question — $9.99"
- 副 CTA："See your energy map · Free"（Syncro 作为免费钩子）
- 不使用 exclamation mark，保持克制语气
- 不说"limited time"、"only today" 等营销话术

**视觉规则**：
- 全屏深空背景
- 粒子流动慢（4-6 秒一次呼吸循环）
- Logo 周围金光呼吸和粒子节奏同步
- 主 CTA 按钮是金色边框 + 透明填充，hover 填充金色

### 07.3.3 Screen 2 · 产品三元关系

这一屏传递核心品牌叙事，让用户理解 POJU 的"特殊性"。

```
┌──────────────────────────────────────────────┐
│                                              │
│         Where two truths meet.               │
│                                              │
│                                              │
│   ✦ ANCIENT ─────────────────────────        │
│                                              │
│   Two thousand years of Eastern observation: │
│   Daoism · Feng Shui · Bazi · Yi Jing        │
│                                              │
│   ✦ MODERN ──────────────────────────        │
│                                              │
│   Reinforced by science:                     │
│   magnetic fields · spatial cognition        │
│   circadian rhythms · environmental psych    │
│                                              │
│   ✦ AI AGENT ────────────────────────        │
│                                              │
│   Translated by an intelligence trained on   │
│   both — into what you can do, today.        │
│                                              │
│   ✦ YOU ─────────────────────────────        │
│                                              │
│   Your birth chart. Your direction.          │
│   Your question. Your this exact moment.     │
│                                              │
└──────────────────────────────────────────────┘
```

**视觉规则**：
- 四段文字像古代典籍的卷轴布局，每段之间有细金线分隔
- 每段 fadeIn 动画，滚动触发
- 无配图，完全文字驱动

### 07.3.4 Screen 3 · 三产品入口

```
┌──────────────────────────────────────────────┐
│                                              │
│        Three ways in. One way through.       │
│                                              │
│                                              │
│   ┌────────────┐ ┌─────────┐ ┌────────────┐  │
│   │            │ │         │ │            │  │
│   │   SYNCRO   │ │  POJU   │ │   ORACLE   │  │
│   │            │ │         │ │            │  │
│   │  [粒子球] │ │ [破局]  │ │  [爆炸]   │  │
│   │            │ │         │ │            │  │
│   │ See your   │ │ Break   │ │ Receive a  │  │
│   │ energy map │ │ your    │ │ sign       │  │
│   │            │ │ deadlock│ │            │  │
│   │            │ │         │ │            │  │
│   │   Free     │ │ $9.99   │ │   Free     │  │
│   │  Open →    │ │ Open →  │ │  Open →    │  │
│   └────────────┘ └─────────┘ └────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

**关键设计**：
- POJU 卡片在中间，略大，金色边框更显眼
- Syncro / Oracle 卡片标注"Free"
- POJU 卡片标注"$9.99"
- 每张卡片有 hover 预览动效（Syncro 粒子球旋转 / Oracle 粒子凝聚 / POJU Logo 呼吸）

**移动端**：三卡片纵向排列，POJU 仍居中间位置。

### 07.3.5 Screen 4 · 科学叙事（Modern Science Anchor）

这是 POJU 相对 Co-Star 等占星产品最重要的差异化页面。让西方用户看到"这不是玄学，有现代科学支撑"。

```
┌──────────────────────────────────────────────┐
│                                              │
│    What Eastern traditions observed,         │
│    science is beginning to measure.          │
│                                              │
│   ──────────────────────────────             │
│                                              │
│   ✦ Magnetic fields affect cognition         │
│     [研究机构 / 期刊名 / 年份]                │
│                                              │
│   ✦ Spatial orientation shapes decisions     │
│     [研究机构 / 期刊名 / 年份]                │
│                                              │
│   ✦ Circadian cycles drive biology           │
│     [研究机构 / 期刊名 / 年份]                │
│                                              │
│   ✦ Visual direction influences focus        │
│     [研究机构 / 期刊名 / 年份]                │
│                                              │
│   ──────────────────────────────             │
│                                              │
│    Eastern traditions named these forces     │
│    two thousand years ago.                   │
│                                              │
│        QI · XUAN · BAZI · YUAN               │
│                                              │
│    POJU uses AI to translate both languages  │
│    into something you can act on — today.    │
│                                              │
└──────────────────────────────────────────────┘
```

**内容合规注意**：
- 实际上线时需填入**真实存在的研究**，由合规律师审阅
- 不做超越研究结论的表述（不说"科学证明风水有效"，只说"科学观察到磁场影响认知"）
- 东方概念保留拼音，大写强调（QI / XUAN / BAZI / YUAN）

### 07.3.6 Screen 5 · 隐私承诺（Three Nevers）

```
┌──────────────────────────────────────────────┐
│                                              │
│         Three promises we don't break.       │
│                                              │
│                                              │
│   ✦ Never stored                             │
│                                              │
│   Your conversations live only on your       │
│   device. We encrypt them locally.           │
│   We cannot read them. No one can.           │
│                                              │
│   ──────────────────                         │
│                                              │
│   ✦ Never required                           │
│                                              │
│   No account. No login. No password.         │
│   No email, unless you want your reading     │
│   as a PDF.                                  │
│                                              │
│   ──────────────────                         │
│                                              │
│   ✦ Never manipulative                       │
│                                              │
│   No dark patterns. No fake urgency.         │
│   No "limited time". No upsells.             │
│   One price: $9.99 when you need it.         │
│                                              │
└──────────────────────────────────────────────┘
```

### 07.3.7 Screen 6 · Footer

```
┌──────────────────────────────────────────────┐
│                                              │
│   POJU                                       │
│   pojulife.com                               │
│                                              │
│   Disclaimer · Privacy · Terms · Contact     │
│                                              │
│   © 2026 POJU. All rights reserved.          │
│                                              │
│   Not medical, legal, or financial advice.   │
│                                              │
└──────────────────────────────────────────────┘
```

## 07.4 POJU 产品页（/poju）

独立的 POJU 介绍页，深度讲解这个产品。

### 07.4.1 页面结构

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Section 1 · POJU 是什么
  — Ancient Eastern Wisdom, delivered
Section 2 · 什么情况下找 POJU
  — 5 个典型困局场景
Section 3 · POJU 怎么工作
  — 7 阶段 Agent 工作流简化版
Section 4 · 和其他工具的差异
  — POJU vs ChatGPT / Co-Star / 真人咨询 对比表
Section 5 · CTA + 隐私承诺复述
  — [ Ask your question — $9.99 ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 07.4.2 Section 2 · 典型困局场景

用 5 个具体场景让用户识别自己：

```
When to come to POJU

✦ You're stuck between two paths
  — career change, relationship decision, relocation
  
✦ You've done your research and you're more confused
  — conflicting advice, family pressure, ticking clock
  
✦ Something keeps repeating and you don't know why
  — same kind of relationship, same setbacks, same blocks
  
✦ You need depth that friends can't give
  — no one around you has the distance to see clearly
  
✦ You want direction, not prediction
  — "will X happen" is astrology. "what should I do" is POJU.
```

### 07.4.3 Section 4 · 差异化对比

```
             │ Co-Star │ ChatGPT │ Real Master │ POJU
─────────────┼─────────┼─────────┼─────────────┼─────
Depth        │   ●     │  ● ●    │  ● ● ● ●    │ ● ● ●
Actionable   │   ●     │  ● ●    │  ● ● ● ●    │ ● ● ● ●
Eastern Base │  ● ●    │   ●     │  ● ● ● ●    │ ● ● ● ●
Privacy      │   ●     │   ●     │     ●       │ ● ● ● ●
Price        │ $8/yr   │ $20/mo  │ $150-500    │ $9.99
             │         │         │             │ single
```

不过度贬低其他工具，而是呈现清晰定位。

### 07.4.4 付费入口设计

`[ Ask your question — $9.99 ]` 按钮在页面出现**三次**：
- 页面顶部（进入即看到）
- Section 3 后（用户了解工作流后）
- Section 5 （最终 CTA）

每次按钮附近都有副文本："One question · Unlimited depth · PDF by email · Deletes when you close."

**不做"loom 抢购"式 CTA**：
- 不显示"3 people just bought"
- 不显示"Only X spots left"
- 不显示倒计时
- 按钮永远是同一个样子，永远 $9.99

## 07.5 Syncro 产品页（/syncro）

### 07.5.1 PC 端行为

PC 端访问 `/syncro` 时，**不启动粒子球**，而是展示：

```
┌──────────────────────────────────────────────┐
│                                              │
│          [Syncro 宣传视频/GIF]                │
│       Hero: 粒子球 + AR 视图的动态预览         │
│                                              │
│                                              │
│   See how your energy aligns with space.     │
│                                              │
│   Syncro reads your Bazi, your location,     │
│   and this exact moment — then shows you     │
│   which direction carries what energy.       │
│                                              │
│                                              │
│   ──── Opens on mobile only ────             │
│                                              │
│   Syncro needs your phone's compass, GPS,    │
│   and camera. Scan the code or text          │
│   yourself the link.                         │
│                                              │
│     ┌──────┐                                 │
│     │ QR   │   [ Text me the link ]         │
│     │ code │                                 │
│     └──────┘                                 │
│                                              │
└──────────────────────────────────────────────┘
```

- **二维码**：扫描后直达 `pojulife.com/syncro` 的手机版
- **Text me the link**：用户输入手机号，发送 SMS（用 Twilio）
- **不做 App Store / Play Store 链接**（因为是 PWA，不上商店）

### 07.5.2 移动端行为

移动端访问 `/syncro` 直接启动完整体验（详见第 03 章）。

首次访问的引导流程 = 03.10 节定义的 6 步。

### 07.5.3 Syncro 产品页其他 Section

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Section 1 · 什么是 Syncro（PC 端 Hero）
Section 2 · 五个使用场景
  — Study spot / Negotiation / Bed orientation /
    Travel decision / Poju companion
Section 3 · 科学 × 东方
  — 科学观察 vs 东方命名 的对照
Section 4 · 免费承诺
  — Always free, forever.
Section 5 · PWA 获取方式
  — 二维码 + SMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 07.6 Oracle 产品页（/oracle）

### 07.6.1 页面行为

与 Syncro 不同，Oracle 在 **PC 端也完整可用**。

页面结构：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Section 1 · Hero
  [静态粒子球 + 文字 "Receive a sign"]
  [ Begin → ]
Section 2 · 什么是 Oracle
  The Oracle · a 2,000-year archetype.
Section 3 · 它如何工作
  4 步示意图：Ask · Summon · Reveal · Carry
Section 4 · 关于抽签的真理
  One question at a time. Wait 48 hours
  before asking again.
Section 5 · 免费承诺
  Always free. No limit.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

点击 `[ Begin → ]` → 跳转到 Oracle 交互页面（实际上是 `/oracle` 的 stage=ask 状态，URL 不变，SPA 内切换）。

### 07.6.2 Oracle 入口与召唤

除了独立访问 `/oracle`，Oracle 还有两个入口：
- **落地页** Screen 3（三产品入口）
- **POJU Chat** 菜单中的"Summon Oracle"按钮

召唤时，Oracle 的完整 7 阶段在当前页面内弹出底部抽屉（不跳转），完成后抽屉关闭，结果回传。

## 07.7 The Archive（/archive）

### 07.7.1 定位

The Archive 是用户所有历史数据的统一入口，**完全本地**。它不是"账户中心"，它是"你的数字档案馆"。

核心设计原则：
- **克制**：不做过度可视化（不做时间轴 / 日历 / 热力图）
- **神秘**：视觉上和 Oracle 的卡片呼应（深色 + 金色点缀）
- **私密**：进入 Archive 时弹一个"Remember: all of this lives only here"的提示
- **可销毁**：一键清空所有数据

### 07.7.2 页面布局

```
┌──────────────────────────────────────────────┐
│                                              │
│   ✦ THE ARCHIVE                              │
│                                              │
│   Everything here lives only on this device. │
│                                              │
│   ──────────────────                         │
│                                              │
│   [ All ]  [ POJU ]  [ Syncro ]  [ Oracle ]  │
│                                              │
│   ──────────────────                         │
│                                              │
│   Apr 19 · POJU                              │
│   "Dad and I keep..."                        │
│   Still active · 12 messages                 │
│   [ Resume ]  [ Archive ]  [ Wipe ]          │
│                                              │
│   Apr 18 · Oracle (3-Sign Reading)           │
│   "About my decision to move"                │
│   Past · Present · Future                    │
│   [ View ]                                   │
│                                              │
│   Apr 17 · Syncro                            │
│   "My desk" · Facing NW                      │
│   [ View ]                                   │
│                                              │
│   Apr 15 · POJU                              │
│   [ Hidden by you ]                          │
│   [ Reveal ]  [ Wipe ]                       │
│                                              │
│   Apr 10 · Oracle                            │
│   "Should I..."                              │
│   Still Water · Sign of Stillness                │
│   [ View ]                                   │
│                                              │
│   ──────────────────                         │
│                                              │
│   [ Wipe everything ]                        │
│                                              │
└──────────────────────────────────────────────┘
```

### 07.7.3 筛选标签

顶部四个筛选：
- **All**：默认，按时间倒序
- **POJU**：只显示 POJU 对话
- **Syncro**：只显示 Syncro 读取结果（含精准拍照）
- **Oracle**：只显示 Oracle 抽签

### 07.7.4 条目操作

每一条目支持的操作：

**POJU 条目**：
- `Resume` — 恢复对话（活跃 Session 才有）
- `Archive` — 折叠但保留
- `Wipe` — 彻底销毁
- 长按 / 右键：Rename / Hide

**Oracle 条目**：
- `View` — 全屏显示卡片
- 长按：Delete / Rename

**Syncro 条目**：
- `View` — 显示当时的方位图快照
- `Re-read now` — 基于当前时辰重新分析该方位
- 长按：Delete / Rename

### 07.7.5 Wipe Everything

底部一键清空。带严格确认：

```
┌──────────────────────────────────────┐
│                                      │
│       Wipe everything?               │
│                                      │
│   All conversations.                 │
│   All signs.                         │
│   All readings.                      │
│   All of your data on this device.   │
│                                      │
│   This cannot be undone.             │
│                                      │
│   Type "WIPE" to confirm:            │
│   [  ____________  ]                 │
│                                      │
│   [ Wipe everything ]  [ Cancel ]    │
│                                      │
└──────────────────────────────────────┘
```

要求用户打字确认"WIPE"——防止误触。打字正确后按钮激活。

### 07.7.6 无数据状态

如果 Archive 为空：

```
┌──────────────────────────────────────┐
│                                      │
│   ✦ THE ARCHIVE                      │
│                                      │
│   Nothing here yet.                  │
│                                      │
│   Your readings, signs, and          │
│   conversations will live here —     │
│   only on this device.               │
│                                      │
│        [ Ask your question → ]       │
│        [ Receive a sign → ]          │
│                                      │
└──────────────────────────────────────┘
```

### 07.7.7 跨产品回溯

Oracle 的 3 签联动（Past/Present/Future）在 Archive 里以"组合条目"显示：

```
Apr 18 · Oracle (3-Sign Reading)
"About my decision to move"
┌────┬────┬────┐
│Past│Pres│Futr│   ← 三个小缩略图
└────┴────┴────┘
Linked with POJU session Apr 18
[ View spread ]  [ Open POJU chat ]
```

点击 `Open POJU chat` 可以跳转到关联的 POJU 对话（如果用户还没 wipe）。

## 07.8 免责弹窗的全站触发规则


### 07.8.1 触发时机

```
用户访问 pojulife.com 任意页面
  ↓
检测 localStorage.pojulife_disclaimer_v1
  ↓
───────────────────────────────────────
  未同意 → 显示完整免责弹窗（含勾选）
           ↓
           勾选并确认
           ↓
           localStorage 记 flag + 版本号 + 时间戳
           ↓
           进入访问的页面
───────────────────────────────────────
  已同意且版本一致 → 直接进入页面
───────────────────────────────────────
  已同意但版本落后 → 显示"We've updated" 简版弹窗
                  + 勾选
                  ↓
                  更新 localStorage flag 版本号
───────────────────────────────────────
```

### 07.8.2 首次弹窗完整内容

```
┌──────────────────────────────────────────┐
│                                          │
│         Before you enter POJU            │
│                                          │
│   POJU delivers insights based on        │
│   2,000 years of Eastern wisdom,         │
│   reinforced by modern science, and      │
│   interpreted by an AI Agent.            │
│                                          │
│   This is not a substitute for:          │
│   · Medical advice                       │
│   · Legal advice                         │
│   · Financial advice                     │
│   · Mental health care                   │
│                                          │
│   If you're in crisis, please contact    │
│   a licensed professional immediately.   │
│                                          │
│   Your data never leaves this device     │
│   unless you explicitly choose to share. │
│                                          │
│   [ Read the full Disclaimer →  ]        │
│                                          │
│   ──────────                             │
│                                          │
│   □  I have read and agree to the        │
│      Disclaimer, Privacy Policy, and     │
│      Terms of Service.                   │
│                                          │
│   [ Enter POJU ]  ← 勾选后激活            │
│                                          │
└──────────────────────────────────────────┘
```

### 07.8.3 Chat 首次进入的提示（非弹窗）

付费后进入 Chat 页面，**不再是弹窗**（因为已确认过免责），而是 Chat 顶部一个一次性消息：

```
┌──────────────────────────────────────┐
│ 🔒 This conversation lives only on   │
│    this device. Close to delete.     │
│    [ I understand ]                  │
└──────────────────────────────────────┘
```

点击"I understand"后消失，同一 Session 不再显示。

## 07.9 三产品引流路径的 UI 落地

### 07.9.1 Syncro → POJU 的钩子

每次 Syncro 分析完成或精准拍照完成，结果页底部都有：

```
──────

This is just the surface.
Something deeper is shaping this direction.

Ask POJU · $9.99
One question · Unlimited depth

                              [  Go →  ]
```

点击后：
- 带上 Syncro 的结果作为 context
- 跳转到 Stripe 付款页（amount = 9.99，metadata = syncro_context）
- 支付后进入 /chat，AI 首条消息自动引用 Syncro 的结果作为讨论起点

### 07.9.2 Oracle → POJU 的钩子

Oracle 卡片底部：

```
If this knot needs untying,
POJU will sit with you.

One question · $9.99
                              [  Go →  ]
```

点击后：
- 带上 Oracle 的抽签结果（sign + verse + meaning + user question）
- 跳转到 Stripe 付款
- 支付后进入 /chat，AI 说"我已经看到你刚才那签，这是你的 Present。要看清全貌，让我们看 Past 和 Future..."
- 启动 3 签联动流程（详见 04.7）

### 07.9.3 POJU 内召唤 Syncro / Oracle

详见 02.4.8。AI 回复中生成可点击按钮，点击后弹出底部抽屉，完成后数据回传。

## 07.10 页脚（Footer）全站一致

```
┌──────────────────────────────────────────┐
│                                          │
│        POJU                              │
│        pojulife.com                      │
│                                          │
│   ─────────────────────────              │
│                                          │
│   Legal                                  │
│   · Disclaimer                           │
│   · Privacy Policy                       │
│   · Terms of Service                     │
│                                          │
│   Support                                │
│   · Contact                              │
│   · FAQ                                  │
│                                          │
│   ─────────────────────────              │
│                                          │
│   © 2026 POJU. All rights reserved.      │
│                                          │
│   Not medical, legal, or financial       │
│   advice. Consult licensed professionals │
│   for those matters.                     │
│                                          │
└──────────────────────────────────────────┘
```

### 07.10.1 Footer 移动端

移动端折叠为手风琴，默认只显示：
- Logo + pojulife.com
- `[ Legal ∨ ]`  `[ Support ∨ ]`
- 版权和免责简短说明



---

# 第 08 章 · 支付 · 邮件 · 回访

> 本章定义从付费到邮件触达的完整商业闭环。

## 08.1 支付流程全景

### 08.1.1 完整流程图

```
用户在任意页面点击 "Ask your question — $9.99"
  ↓
携带 metadata（来源：landing / poju_page / oracle_hook / syncro_hook）
  ↓
调用 /api/payment/checkout → 返回 Stripe Checkout URL
  ↓
重定向到 Stripe（含 Apple Pay / Google Pay 自动识别）
  ↓
───────────────────────────────────────────────
  支付成功                    支付失败
  ↓                           ↓
Stripe 触发 webhook         返回错误页
  ↓                           ↓
/api/payment/webhook        显示友好提示 + Try again
  ↓
验证签名 → 生成 Session Token
  ↓
记录 payment_records（哈希化）
  ↓
返回 302 重定向到 /chat#token=xxx
  ↓
前端消费 token → 生成 Session ID → 存本地
  ↓
首次进入 Chat → 显示欢迎引导区 + AI 起手问诊
───────────────────────────────────────────────
```

### 08.1.2 支付来源追踪（Attribution）

每个支付入口的 metadata 记录来源，用于转化分析：

| 来源标识 | 入口位置 |
|---|---|
| `landing_hero` | 主落地页 Hero CTA |
| `landing_products` | 主落地页三产品卡片中的 POJU |
| `poju_page_top` | /poju 页顶部 CTA |
| `poju_page_mid` | /poju 页中部 CTA |
| `poju_page_bottom` | /poju 页底部 CTA |
| `oracle_hook` | Oracle 卡片底部 hook（携带 sign 数据） |
| `syncro_hook` | Syncro 结果页 hook（携带方位数据） |
| `archive_resume` | Archive 页面新问题入口 |
| `chat_new_poju` | Chat 左侧栏 New POJU 按钮 |

这些 metadata 存在 `payment_records` 表，**不关联用户身份**，只用于汇总统计。

### 08.1.3 Stripe Checkout 配置

```typescript
// lib/payment/stripe-provider.ts
async function createCheckoutSession(params: CheckoutParams) {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    
    // 自动启用 Apple Pay / Google Pay
    automatic_payment_methods: { enabled: true },
    
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'POJU · One Breakthrough Session',
          description: 'One question · Unlimited depth · PDF report by email',
          images: ['https://pojulife.com/logos/poju-og.png'],
        },
        unit_amount: 999,  // $9.99 in cents
      },
      quantity: 1,
    }],
    
    success_url: `${SITE_URL}/chat?token={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/poju?cancelled=true`,
    
    metadata: {
      source: params.source,
      oracle_sign_id: params.oracleSignId || '',
      syncro_reading_id: params.syncroReadingId || '',
      language: params.language,
    },
    
    // 合规：不收集地址（无需开发票）
    billing_address_collection: 'auto',
    
    // 不存储付款方式（下次购买无自动填充）
    payment_intent_data: {
      setup_future_usage: null,
    },
    
    // 自动提供邮件收据（由 Stripe 自己发，我们不接触邮箱）
    customer_email: undefined,
  });
  
  return { checkoutUrl: session.url!, sessionId: session.id };
}
```

**关键设计**：
- 用 `automatic_payment_methods` 自动识别 Apple Pay / Google Pay 可用性
- **不填充 `customer_email`** —— 让 Stripe 自己收集并发送收据邮件，我们完全不接触用户邮箱
- **不开启 `setup_future_usage`** —— 不存付款方式，每次都重新输

### 08.1.4 Webhook 处理

```typescript
// app/api/payment/webhook/route.ts
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature')!;
  
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // 生成 Session Token
    const token = crypto.randomUUID();
    const tokenHash = await sha256(token);
    
    // 入库
    await supabase.from('payment_records').insert({
      payment_provider: 'stripe',
      provider_payment_id: session.id,
      amount_usd: (session.amount_total || 0) / 100,
      status: 'paid',
      session_token_hash: tokenHash,
      source_metadata: session.metadata,
      created_at: new Date(),
    });
    
    // Token 通过 success_url 传回前端（session.id 会被替换为实际 ID）
    // 实际上：Stripe 会用 {CHECKOUT_SESSION_ID} placeholder 填充
    // 我们需要额外 API 让前端换取真正的 token
  }
  
  return Response.json({ received: true });
}
```

### 08.1.5 Token 换取机制

由于 Stripe 的 `success_url` 用的是 Stripe session ID（不是我们的 token），前端需要额外一步换取：

```typescript
// app/api/payment/exchange-token/route.ts
export async function POST(req: Request) {
  const { stripeSessionId } = await req.json();
  
  // 查询该 Stripe session 对应的 payment record
  const record = await supabase
    .from('payment_records')
    .select('session_token_hash, consumed_at, source_metadata')
    .eq('provider_payment_id', stripeSessionId)
    .eq('status', 'paid')
    .single();
  
  if (!record || record.consumed_at) {
    return Response.json({ error: 'Invalid or already consumed' }, { status: 400 });
  }
  
  // 生成一次性 Session ID 给前端
  const sessionId = crypto.randomUUID();
  
  // 标记 Token 已消费
  await supabase
    .from('payment_records')
    .update({ consumed_at: new Date() })
    .eq('provider_payment_id', stripeSessionId);
  
  return Response.json({ 
    sessionId,
    metadata: record.source_metadata,
  });
}
```

前端流程：

```typescript
// 进入 /chat?token=cs_xxx 时
const urlToken = new URLSearchParams(location.hash.slice(1)).get('token');
if (urlToken) {
  const res = await fetch('/api/payment/exchange-token', {
    method: 'POST',
    body: JSON.stringify({ stripeSessionId: urlToken }),
  });
  const { sessionId, metadata } = await res.json();
  
  // 存入本地 store，清除 URL
  chatStore.createSession(sessionId, metadata);
  history.replaceState(null, '', '/chat');
}
```

### 08.1.6 支付失败与保护

**场景 1：支付成功但 webhook 丢失**
- 前端携带 stripe session ID 访问 /chat
- 调用 exchange-token 查询
- 如果找不到 record → 等待 5 秒重试 → 最多重试 3 次
- 仍失败则显示："We're confirming your payment. This usually takes a moment."
- 后台有 fallback：每 10 分钟轮询 Stripe API 补全遗漏的 webhook

**场景 2：AI 首次调用失败**
- Session 保持有效
- 显示"Something in the signal is unclear. Try again?"
- 重试不消耗 token
- 连续 3 次失败则升级到 `support@pojulife.com` 人工处理

**场景 3：用户要求退款**
- 手动流程（MVP 阶段）
- 用户发邮件到 support@pojulife.com
- 客服在 Stripe 后台全额退款
- 同时从 payment_records 标记 status='refunded'
- 对应 Session Token 作废（即使用户还在 Chat 中）
- 不追溯删除用户本地数据（那是用户的）

## 08.2 邮件系统

### 08.2.1 Resend 配置

Resend 相对 SendGrid/Mailgun 的优势：
- 开发者友好 API
- 原生 Scheduled Send API（我们需要）
- 免费 3000 封/月（MVP 够用）
- 送达率高，deliverability 专注

域名配置：
- **readings@pojulife.com** · 发送 PDF 报告
- **checkin@pojulife.com** · 发送回访 check-in
- **noreply@pojulife.com** · 其他系统通知（如有）

DNS 配置必须：
- SPF 记录
- DKIM 记录（Resend 会提供）
- DMARC 记录（p=quarantine 或 p=reject）
- 这些影响送达率，**上线前必须配置**

### 08.2.2 PDF 报告邮件模板

```html
<!-- lib/email/templates/pdf_report.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    body { background: #0a0a0f; color: #f0f0f0; font-family: 'EB Garamond', serif; padding: 40px; }
    .gold { color: #d4af37; }
    .verse { font-style: italic; border-left: 2px solid #d4af37; padding-left: 16px; }
    .footer { color: #707070; font-size: 12px; margin-top: 48px; }
  </style>
</head>
<body>
  <h1 class="gold">✦ POJU</h1>
  
  <p>Your reading is attached.</p>
  
  <p>This is yours. Read it when you're quiet. Act on it when you're ready.</p>
  
  <div class="verse">
    The path is walked by those who stop
    asking if the path exists.
  </div>
  
  <p>If actions feel right, you'll know because something shifts in the people around you — not because I said they would.</p>
  
  <p>Your reading is still open on your device. Come back anytime.</p>
  
  <p class="gold">— POJU</p>
  
  <div class="footer">
    <p>This email was sent because you requested your reading as a PDF. Your email address will be deleted from our servers within 24 hours.</p>
    <p>pojulife.com · Not medical, legal, or financial advice.</p>
  </div>
</body>
</html>
```

### 08.2.3 Check-in 回访邮件模板

```html
<!DOCTYPE html>
<html>
<head>
  <style>...</style>
</head>
<body>
  <h1 class="gold">✦ A check-in from POJU</h1>
  
  <p>It's been {{ days_since }} days since we talked about {{ topic_hint }}.</p>
  
  <p>You had three actions to try. How has the path been?</p>
  
  <ul>
    <li>Did the first action fit when you tried it?</li>
    <li>What shifted in the people around you?</li>
    <li>What still feels stuck?</li>
  </ul>
  
  <p>Your reading is still open on your device, waiting — I'll pick up exactly where we left off.</p>
  
  <p><a href="{{ resume_url }}">Resume your reading →</a></p>
  
  <p class="gold">— POJU</p>
  
  <div class="footer">
    <p>This is the last email I'll send about this topic. Your email will be deleted from our servers within 24 hours.</p>
    <p>No marketing. Ever. <a href="{{ unsubscribe_url }}">Unsubscribe now</a></p>
  </div>
</body>
</html>
```

**重要合规要求**：
- **每封邮件必须有 unsubscribe 链接**（CAN-SPAM 法要求）
- 用户点 unsubscribe → 立即从 scheduled_emails 删除该邮箱
- 链接不需要登录（就是 GET 请求带 token 即可）

### 08.2.4 回访时间的动态计算


AI 在每次 Phase 5 给出行动方案后，根据方案性质计算合理回访时间：

```typescript
// System Prompt 中要求 AI 输出结构化标签
// 示例：
// ...
// 
// <check_in_schedule>
// days: 14
// reason: "User's action is a consistent daily practice (meditation).
//          Give 2 weeks for pattern formation."
// </check_in_schedule>

// 后端解析标签
function extractCheckInSchedule(aiResponse: string): { days: number; reason: string } | null {
  const match = aiResponse.match(/<check_in_schedule>([\s\S]*?)<\/check_in_schedule>/);
  if (!match) return null;
  
  const daysMatch = match[1].match(/days:\s*(\d+)/);
  const reasonMatch = match[1].match(/reason:\s*"(.*?)"/);
  
  return {
    days: daysMatch ? parseInt(daysMatch[1]) : 14,
    reason: reasonMatch?.[1] || '',
  };
}
```

**AI 的判断参考标准**（写进 System Prompt）：

| 行动性质 | 建议回访 |
|---|---|
| 一次性动作（打电话、写信、一次对话） | 3 天 |
| 短期调整（换座位、调整作息 1 周） | 7 天 |
| 中期习惯（冥想、运动、写日记 2-4 周） | 14-21 天 |
| 长期转变（换工作、搬家、结束关系） | 30-60 天 |
| 命理流年变化（等待运势周期） | 90 天 |

### 08.2.5 Scheduled Email 发送

```typescript
// lib/email/schedule-checkin.ts
export async function scheduleCheckIn(params: {
  email: string;
  daysFromNow: number;
  topicHint: string;        // AI 生成的议题简述
  resumeToken: string;      // 用于恢复会话的一次性 token
  language: 'zh' | 'en';
}) {
  const sendAt = new Date(Date.now() + params.daysFromNow * 24 * 60 * 60 * 1000);
  
  const response = await resend.emails.send({
    from: 'POJU <checkin@pojulife.com>',
    to: params.email,
    subject: 'A check-in from POJU',
    html: renderCheckInEmail({
      daysSince: params.daysFromNow,
      topicHint: params.topicHint,
      resumeUrl: `${SITE_URL}/archive?resume=${params.resumeToken}`,
      unsubscribeUrl: `${SITE_URL}/unsubscribe?token=${params.resumeToken}`,
    }),
    scheduled_at: sendAt.toISOString(),
  });
  
  // 记录到本地表，便于后续操作
  await supabase.from('scheduled_emails').insert({
    email: params.email,
    subject: 'A check-in from POJU',
    send_at: sendAt,
    resend_id: response.data?.id,
    status: 'pending',
    deletion_scheduled_at: new Date(sendAt.getTime() + 24 * 60 * 60 * 1000),
  });
  
  return { sendAt, resendId: response.data?.id };
}
```

### 08.2.6 邮箱销毁机制

```sql
-- Cron 任务：每小时执行一次
-- /api/cron/cleanup-emails

DELETE FROM scheduled_emails 
WHERE 
  status = 'sent' 
  AND sent_at < NOW() - INTERVAL '24 hours';

UPDATE scheduled_emails
SET email = NULL
WHERE 
  status = 'sent' 
  AND sent_at < NOW() - INTERVAL '2 hours'
  AND email IS NOT NULL;
```

**双层保护**：
- 发送 2 小时后**邮箱字段 NULL 化**（视觉上数据已清除）
- 发送 24 小时后**整条记录物理删除**

**Resend 端也要配置**：
- Resend Dashboard → Settings → Data Retention → 30 days auto-delete

### 08.2.7 Unsubscribe 机制

```typescript
// app/api/unsubscribe/route.ts
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  
  // 找到对应的 scheduled email
  const record = await supabase
    .from('scheduled_emails')
    .select('id, email, resend_id')
    .eq('unsubscribe_token', token)
    .single();
  
  if (!record) return Response.redirect('/', 302);
  
  // 取消未发送的定时邮件
  if (record.resend_id) {
    await resend.emails.cancel(record.resend_id).catch(() => {});
  }
  
  // 立即删除
  await supabase.from('scheduled_emails').delete().eq('id', record.id);
  
  // 返回确认页面
  return new Response(renderUnsubscribedPage(), {
    headers: { 'Content-Type': 'text/html' },
  });
}
```

Unsubscribed 确认页面：

```
┌──────────────────────────────┐
│                              │
│   ✦ POJU                     │
│                              │
│   You've been unsubscribed.  │
│                              │
│   Your email has been        │
│   deleted from our servers.  │
│                              │
│   This was the only email    │
│   we had about this topic.   │
│                              │
│   ──────────                 │
│                              │
│   You can come back anytime  │
│   without leaving anything   │
│   behind.                    │
│                              │
│   [ Return to POJU ]         │
│                              │
└──────────────────────────────┘
```

## 08.3 回访 Session 恢复

用户点击邮件中的 `Resume your reading →` 链接如何工作？

### 08.3.1 Resume Token 机制

在 End & Wipe 之前，如果用户**选择留邮箱接收 check-in**，系统生成一个 `resume_token`：

```typescript
// 当用户在 End & Wipe 流程中选择"Send me check-in"时
async function generateResumeToken(sessionId: string): Promise<string> {
  const token = crypto.randomUUID();
  
  // Token 存本地 IndexedDB，和 session 关联
  await db.sessions.update(sessionId, { 
    resume_token: token,
    resume_token_created_at: new Date(),
  });
  
  // Token 也存服务端，和 scheduled_email 关联（用于触发邮件时带上）
  // 但不存 session 内容 —— 内容仍在本地
  
  return token;
}
```

### 08.3.2 用户点击邮件链接的流程

```
用户打开邮件 → 点击 "Resume your reading →"
  ↓
浏览器打开 pojulife.com/archive?resume=TOKEN
  ↓
前端检测 URL 参数
  ↓
在本地 IndexedDB 查找 resume_token = TOKEN 的 session
  ↓
───────────────────────────────────────
找到 → 直接打开该 session
     → AI 首条消息：
       "It's been X days. What happened since we talked?"
───────────────────────────────────────
未找到 → 用户换了设备 / 清了缓存
       → 显示：
       ┌──────────────────────────┐
       │ We can't find that       │
       │ reading on this device.  │
       │                          │
       │ You either cleared your  │
       │ browser or you're on a   │
       │ different device.        │
       │                          │
       │ Every POJU reading lives │
       │ only on the device it    │
       │ was created on.          │
       │                          │
       │ [ Start a new reading ]  │
       └──────────────────────────┘
───────────────────────────────────────
```

### 08.3.3 恢复后的 AI 开场

```typescript
// System Prompt 中的恢复指令
// 当 session metadata.is_resumed = true 时，
// AI 的首条消息必须是"复盘式"的，不是"重新开始"

// 示例 AI 回复：
// 
// 欢迎回来。
// 
// 距离我们上次谈你和父亲的关系，已经过去 14 天了。
// 
// 那次我让你做三件事：
// · 每晚睡前写下你今天对他的一个具体感激
// · 本周内挑一个下午陪他看一场老电影
// · 不要讨论房子的事，哪怕他起这个话头
// 
// 哪些你试了？发生了什么？
```

## 08.4 支付方面的合规

### 08.4.1 数据保留

- `payment_records`：保留 7 年（US IRS 税务要求）
- 但不存储任何用户可识别信息（无姓名、地址、邮箱）
- 只存：Stripe session ID（用于对账）、金额、时间、source metadata

### 08.4.2 退款政策

写入 `/terms` 页面：

> **Refunds**
> 
> Each POJU reading is $9.99 and non-refundable once the conversation begins. If you experience a technical issue that prevents you from accessing your reading, contact support@pojulife.com within 7 days for a full refund.
> 
> Refunds are processed through the original payment method and may take 5-10 business days to appear.

### 08.4.3 发票

- Stripe 自动发送付款收据（含用户在 Stripe Checkout 填入的邮箱）
- 我们**完全不接触这封收据**——Stripe 直发
- 如用户需要税务发票（B2B 场景），联系 support@pojulife.com 手动开具

### 08.4.4 多货币与跨境

MVP 只支持 **USD**。面向北美市场足够。

未来扩展：
- **EUR** （欧洲市场）
- **CAD** （加拿大）
- **GBP** （英国）
- 都由 Stripe 自动汇率转换，我们保持 $9.99 USD 为基准

## 08.5 成本与盈利模型

### 08.5.1 单次 POJU Session 的成本

**AI 调用成本**（假设用户进行中深度对话）：

| 项目 | 估算 | 成本 |
|---|---|---|
| 开局分析（含 extended thinking） | ~8K tokens in / 2K tokens out | $0.060 |
| 10 轮后续对话（每轮 4K in / 1.5K out） | ~40K in / 15K out | $0.340 |
| RAG embeddings（每轮查询） | ~10K tokens | $0.000 |
| 话题检测（Haiku） | ~10 次调用 | $0.010 |
| PDF 生成（Puppeteer） | - | ~$0.005 |
| 邮件发送 | 2 封 | $0.002 |
| TTS（如果用户用朗读，估 50%） | 平均 ~2K 字符 | $0.030 |
| **小计** | | **≈ $0.45** |

**Stripe 手续费**：2.9% + $0.30 = $0.59

**单次 Session 毛利**：$9.99 - $0.45 - $0.59 ≈ **$8.95**

毛利率：**89%**

### 08.5.2 月度成本估算

假设**每月 1000 个 POJU 付费 session**（这是比较保守的 DAU 转化估计）：

| 项目 | 月成本 |
|---|---|
| AI 调用（1000 次 POJU） | ~$450 |
| Syncro AI（假设 3000 DAU × 5 次/天） | ~$75 |
| Oracle AI（假设 2000 抽签/天） | ~$60 |
| Embeddings（初期一次性） | ~$50 |
| Resend 邮件（超免费额度） | ~$20 |
| ElevenLabs TTS | ~$30 |
| Supabase（Pro plan） | $25 |
| Vercel（Pro plan） | $20 |
| FingerprintJS OSS | $0 |
| 域名 / SSL | $2 |
| **小计** | **≈ $730** |

**月度收入（1000 session × $9.99）**：$9,990
**月度毛利**：**≈ $9,260**

### 08.5.3 盈亏平衡点

固定成本（Vercel + Supabase + Resend + 域名 + TTS base）约 **$100/月**。

边际成本 per session 约 **$1.04**。

**盈亏平衡点**：$100 / ($9.99 - $1.04) ≈ **12 个 session/月**

只要每月超过 12 个用户付费，项目就盈利。

## 08.6 退款异常流程

### 08.6.1 用户主动要求退款

```
用户发邮件到 support@pojulife.com
  ↓
客服收到 → 核对：
  · 是否在 7 天内
  · 是否真实存在技术问题
  · 是否已经使用（看 Stripe session 的 consumed_at）
  ↓
决定批准退款
  ↓
Stripe Dashboard 操作退款
  ↓
更新 payment_records.status = 'refunded'
  ↓
触发系统操作：
  · 对应 session_token 作废
  · 如果 session 还在 Chat 中活跃，显示提示让用户保存
  · 如果已 End & Wipe，无需额外操作
  ↓
客服回复用户确认 + 退款预计到账时间
```

### 08.6.2 争议（Dispute）处理

如用户通过信用卡发起争议（chargeback）：
- Stripe 会通知 → 我们有 7 天回应
- 提交证据：付款时间、使用记录（payment_records.consumed_at）、服务描述
- 不主动 dispute 用户——保持 90%+ 胜诉率比抢那 $9.99 更重要

## 08.7 Paddle 备选方案

如果 Stripe 因"occult services"风险拒绝或冻结账户，切换 Paddle。

Paddle 的差异：
- Paddle 是 **Merchant of Record**，他们处理税务
- 对玄学/占卜类业务更宽松
- 单次成本：5% + $0.50（比 Stripe 略高）
- 需要 KYB 验证时间 5-10 工作日

**切换成本**：
- 代码层面由于 Provider 抽象（05.6.1），只需换 provider 实现
- 现有 payment_records 兼容（Provider 字段区分）
- 切换不影响已有用户体验

## 08.8 A/B 测试框架（未来）

MVP 不做 A/B 测试（用户量不够）。

v1.1 上线后可测试：
- 落地页 Hero 文案（"$300 master" vs "$9.99 breakthrough"）
- 三产品卡片顺序
- Oracle 提示措辞
- Chat 思考时长

使用 Vercel Edge Config + Feature Flags 实现，不引入第三方 A/B 工具（隐私合规简单）。



---

# 第 09 章 · 合规 · 免责 · 商标 · 支付风险

> 本章梳理所有法律和合规风险点。**本章不是法律建议，上线前必须由专业律师审阅**。

## 09.1 合规风险总览

POJU 面临的合规风险有五个维度：

| 维度 | 风险等级 | 核心法规 | 缓解优先级 |
|---|---|---|---|
| **隐私合规** | 高 | CCPA, GDPR, COPPA | 立即 |
| **免责与消费者保护** | 高 | FTC Act Section 5 | 立即 |
| **支付合规** | 中高 | Stripe Restricted Businesses | 上线前 |
| **商标权** | 中 | USPTO | 并行 |
| **广告合规** | 中 | FTC Endorsement Guides | 上线后 |

## 09.2 隐私合规（Privacy Compliance）

### 09.2.1 适用法规

- **CCPA**（加州消费者隐私法）—— 美国主要法规
- **CalOPPA**（加州在线隐私保护法）—— 要求必须有隐私政策
- **COPPA**（儿童在线隐私保护法）—— 我们不服务 13 岁以下，但仍要显式排除
- **VCDPA / CPA / CTDPA**（弗吉尼亚 / 科罗拉多 / 康涅狄格隐私法）—— 2023 年后陆续生效
- **GDPR**（欧盟通用数据保护条例）—— 如果服务欧盟用户，必须遵守

### 09.2.2 隐私政策必须包含的条款

基于 CCPA + CalOPPA 要求，`/privacy` 页面必须包含以下章节：

```
1. What We Collect
   — Device fingerprint (hashed)
   — Payment records (no personal info)
   — Email (only when user explicitly provides for PDF)
   — Aggregated usage stats (anonymous)

2. What We Don't Collect
   — Your conversations (stored only on your device)
   — Your name, address, phone (never asked)
   — Your precise location (only country from GeoIP)
   — Behavioral tracking across sites

3. How We Use Your Data
   — Device fingerprint: fraud prevention only
   — Payment records: tax compliance (7 years)
   — Email: send PDF + 1 check-in, then deleted
   — Aggregate stats: improve product

4. Data Encryption
   — AES-256-GCM for local conversations
   — Encryption key generated on your device only
   — We cannot decrypt your data

5. Data Deletion
   — Local data: clear your browser / End & Wipe
   — Server data: device fingerprint auto-deleted after 365 days of inactivity
   — Email: physically deleted within 24 hours after send

6. Third-Party Services
   — Anthropic (Claude API): AI processing
   — OpenAI (embeddings): RAG indexing
   — ElevenLabs: voice synthesis (optional)
   — Stripe: payment processing
   — Vercel: hosting
   — Supabase: database
   — Resend: email delivery
   — (Each with link to their own privacy policy)

7. AI Model Data Handling
   — Your conversations are sent to Anthropic for processing
   — Anthropic does not train on your conversations (per their API terms)
   — Conversations are not retained by Anthropic (zero-data-retention)

8. Children's Privacy
   — POJU is not intended for users under 18
   — We do not knowingly collect data from minors
   — If discovered, data will be deleted immediately

9. Your Rights (CCPA)
   — Right to know what we collect
   — Right to delete your data
   — Right to opt-out of "sale" of data (we don't sell)
   — Right to non-discrimination
   — How to exercise: email privacy@pojulife.com

10. GDPR-Specific (if applicable)
    — Legal basis for processing
    — Right to access, rectify, erase, portability
    — Right to withdraw consent
    — Data Protection Officer contact

11. Contact
    — privacy@pojulife.com
    — (Physical address if required by jurisdiction)

12. Updates to This Policy
    — We'll notify via in-app banner on material changes
    — Continued use = acceptance
```

### 09.2.3 Anthropic API 合规细节

**关键合规点**：必须在 Anthropic Console 中启用 **Zero Data Retention (ZDR)**。

```
启用 ZDR 后：
· Anthropic 不会保留你的 API 请求和响应
· 不会用于模型训练
· 不会用于产品改进
· 不会被人工审核（除非你主动举报）
```

这是向用户保证"你的对话不会被用于 AI 训练"的关键。如果没有 ZDR，你无法做出这个承诺。

**Anthropic Console 开启路径**：Settings → Privacy → Zero Data Retention → Enable for production workspace.

### 09.2.4 GDPR 考量

如果有欧盟用户访问：

- **Cookie Consent**：POJU 几乎不用 cookies（只有 localStorage，法律上可能被归类为 cookie-like）——但保险起见，对 EU IP 显示 cookie consent banner
- **Right to Erasure**：用户本地数据他自己能删；服务端的 device fingerprint 可以通过联系 support 删除
- **Data Portability**：我们有导出 PDF 功能，部分满足
- **DPO（Data Protection Officer）**：如果 EU 用户超过阈值，需要指定一个 DPO 联系人

**MVP 阶段建议**：只服务美国用户（Stripe 地区限制为 US + CA），6 个月后再评估 EU 扩展。

## 09.3 免责与消费者保护

### 09.3.1 FTC Act Section 5 风险

美国联邦贸易委员会（FTC）关注"不公平或欺骗性商业行为"。占卜/命理/预测类产品的高风险点：

| 风险 | 示例 | 缓解方式 |
|---|---|---|
| **虚假预测** | 声称能预测未来 | 所有输出定性为 "insight" / "reflection" 而非 "prediction" |
| **医疗声称** | 能治病 | 免责中明确排除医疗建议 |
| **金融声称** | 能让你赚钱 | 免责中明确排除金融建议 |
| **夸大科学** | "科学证明风水有效" | 科学叙事严格用"observed correlation"，不用"proven" |
| **虚假定价** | "原价 $99 限时 $9.99" | 永远只有 $9.99，不做虚假比价 |
| **滥用情感脆弱** | 利用用户危机期诱导消费 | 系统检测严重心理危机时停止并指向专业资源 |

### 09.3.2 免责声明完整版（/disclaimer）

这是法律级文档，必须由律师起草。以下是结构框架：

```
═════════════════════════════════════
  POJU DISCLAIMER
═════════════════════════════════════

Effective Date: [Date]

1. NATURE OF SERVICE

POJU provides insights based on Eastern philosophical 
traditions (including Daoism, Feng Shui, Bazi, Yi Jing),
reinforced by modern scientific observation, and 
interpreted through an AI Agent.

POJU IS FOR ENTERTAINMENT, PERSONAL REFLECTION, AND 
SELF-EXPLORATION PURPOSES ONLY.

POJU makes no claim to predict the future, reveal 
objective truths, or influence reality.

2. NOT PROFESSIONAL ADVICE

POJU is not a substitute for, and should not be used 
in place of:

  (a) Medical advice, diagnosis, or treatment
      — Consult a licensed physician.
  
  (b) Mental health care
      — Consult a licensed therapist or psychiatrist.
  
  (c) Legal advice
      — Consult a licensed attorney.
  
  (d) Financial advice
      — Consult a licensed financial advisor.
  
  (e) Relationship counseling
      — Consult a licensed couples/family therapist.

3. CRISIS RESOURCES

If you are experiencing:
  · Suicidal thoughts
  · Self-harm urges
  · Domestic violence
  · Severe mental health crisis

STOP USING POJU AND CONTACT IMMEDIATELY:
  · 988 Suicide & Crisis Lifeline (US)
  · Emergency services: 911

4. NO WARRANTY

POJU's outputs are provided "AS IS" without warranty 
of any kind, express or implied. We do not warrant 
accuracy, completeness, or fitness for any particular 
purpose.

5. LIMITATION OF LIABILITY

To the maximum extent permitted by law, POJU, its 
operators, affiliates, and employees shall not be 
liable for any decisions, actions, or outcomes 
resulting from use of POJU's outputs.

6. AGE RESTRICTION

POJU is intended for users 18 years and older. Users 
under 18 should not use POJU.

7. SCIENTIFIC CLAIMS

Any reference to scientific research is for 
informational purposes. POJU does not claim that 
Eastern traditions have been scientifically proven. 
POJU presents observed correlations between 
traditional observations and contemporary research.

8. CULTURAL AND RELIGIOUS NEUTRALITY

POJU draws from Eastern philosophical traditions but 
does not promote any religion. References to "Oracle",
"Qi", "Bazi", or similar terms are cultural and 
philosophical, not religious.

9. AI-GENERATED CONTENT

All responses in POJU are generated by an AI Agent. 
They do not reflect the views of any individual or 
organization. The AI may make errors, produce 
inconsistent outputs, or generate content that is 
factually incorrect.

10. CHANGES TO THIS DISCLAIMER

We may update this Disclaimer at any time. Continued 
use of POJU after updates constitutes acceptance.

By using POJU, you acknowledge that you have read, 
understood, and agreed to this Disclaimer.

Contact: legal@pojulife.com
```

### 09.3.3 摘要版（弹窗用）

弹窗里显示的简版见 07.8.2。关键是让用户**必须至少看到**：
- 不是医疗/法律/金融建议
- 危机时指向 988 / 911
- 18 岁以上使用
- 不能预测未来
- 数据只在本地

### 09.3.4 AI 输出的系统性保护

System Prompt 中必须明确限制（硬规则）：

```
POJU 绝对不能输出的内容：

1. 医疗诊断或治疗建议
   "Your illness is caused by..."
   "You should stop taking this medication..."
   "This condition can be cured by..."
   
2. 法律建议
   "You should sue them..."
   "This contract is void..."
   "You can ignore this warrant..."

3. 金融建议
   "Buy this stock..."
   "This investment will return..."
   "Don't pay this debt..."

4. 绝对预测
   "You will definitely..."
   "This is going to happen on [date]..."
   "Without question, he/she will..."

5. 鼓励自伤或他伤
   任何暗示自残、自杀、伤害他人的内容
   
6. 歧视性内容
   基于种族、性别、宗教、性取向的建议

在任何场景下，如果检测到用户可能陷入心理危机：
· 立即停止命理分析
· 提供危机资源：
  "What you're going through is real and it's serious. 
   Please call 988 (US Suicide & Crisis Lifeline) or 
   contact a mental health professional now. 
   I'll be here when you're ready."
· 不再继续对话直到用户确认收到帮助
```

### 09.3.5 心理危机检测

用 Claude Haiku 做每轮对话的安全检测，成本极低但必须做：

```typescript
async function detectCrisis(userMessage: string): Promise<CrisisLevel> {
  const result = await haiku.call({
    system: CRISIS_DETECTION_PROMPT,
    user: userMessage,
    maxTokens: 50,
  });
  
  // 返回：'none' | 'low' | 'medium' | 'high' | 'imminent'
  return result.level;
}
```

检测到 `high` 或 `imminent` 时：
- 立即切换 AI 到"危机模式"响应
- 前端 UI 显示更显眼的危机资源
- 记录到日志（不含对话内容，只记录危机级别和时间戳），用于后续安全审计

## 09.4 支付合规

### 09.4.1 Stripe Restricted Businesses

Stripe 的 [Restricted Businesses](https://stripe.com/restricted-businesses) 列表中包含：

> "Occult services, psychic or astrological services"

这被归类为 **High-Risk business**，不是禁止，但需要额外审核。

### 09.4.2 上线前的 Stripe 沟通

**必做步骤**：

1. **创建 Stripe 账户时如实申报业务性质**
   - Business category: "Personal Services" → "Counseling / Coaching"
   - Business description: 
     > "POJU is an AI-powered self-reflection service drawing from Eastern philosophical traditions. Users pay $9.99 per session for an AI-guided conversation. We do not claim to predict the future or provide medical, legal, or financial advice. All content is for entertainment and personal reflection."

2. **发送 pre-application 邮件到 Stripe Support**
   - 说明业务性质
   - 附上落地页 URL 和免责声明
   - 询问是否允许，如何设置
   - 存档他们的回复（未来争议时的凭证）

3. **在 Stripe Dashboard 中启用的配置**
   - Statement descriptor: `POJU` 或 `POJULIFE.COM`（简短、清晰）
   - Shipping address: 不收集
   - Billing address: Auto（让 Stripe 按需决定）
   - Save payment methods: Off

### 09.4.3 Paddle 备选的意义

Paddle 是 **Merchant of Record（MoR）** 模式：

- Paddle 是法律上的卖家，你是供应商
- Paddle 处理全球税务（VAT, GST, sales tax）
- 对"soft" high-risk 业务更宽容
- 费用更高（5% + $0.50 vs Stripe 的 2.9% + $0.30）

**当 Stripe 拒绝或冻结时立即切换**。由于 05.6.1 的 Provider 抽象，切换成本很低。

### 09.4.4 PCI DSS 合规

- 我们**从不接触信用卡号**（Stripe/Paddle 完全托管）
- 因此我们属于 **SAQ-A** 最低级合规
- 只需在 Privacy Policy 中声明使用 PCI-DSS certified processor 即可

### 09.4.5 销售税（Sales Tax）

这是容易忽略的风险。

**美国销售税情况**：
- 美国没有联邦销售税，各州规则不同
- "Digital services" 在 **~30 个州** 征税
- 税率 4-10% 不等
- 每个州有自己的 Nexus 门槛（销售额或交易数）

**MVP 阶段处理**：
- 使用 **Stripe Tax**（Stripe 内置自动化）或 **Paddle**（MoR，自动处理）
- Stripe Tax 每月 $0 起步 + 按使用量计费
- 强烈建议启用，不自己处理

## 09.5 商标策略

### 09.5.1 主商标（必须注册）

**POJU** / **POJULIFE**：
- 第 9 类：Downloadable software, mobile applications
- 第 42 类：SaaS, software platform
- 第 44 类：Personal coaching, counseling services
- 第 45 类：Personal consultation services

**进度追踪**：MVP 上线前必须拿到"Application Filed"确认，确认中也可以投放，但如果最终被驳回要快速改名。

### 09.5.2 工具名（建议查询但不急注册）

**Syncro** / **Oracle**（或最终新造词）：

**USPTO TESS 快速查询**：

1. 访问 https://tmsearch.uspto.gov
2. 搜索 "Syncro" + Class 9 / 42 / 44
3. 搜索 "Oracle" + Class 44 / 45
4. 记录 "Live" 状态的商标，评估相似度

**已知的潜在冲突**：
- Syncro：可能在软件/IT 类有注册，需具体查
- Oracle：Oracle Corporation 在大量类别有注册，但主要在企业软件/数据库。在 Class 44/45（个人咨询/占卜）可能安全，但该公司维权激进

**三种应对策略**：
- **A. 安全路线**：查询后发现有冲突 → 换成新造词
- **B. 风险路线**：继续使用 → 接到 C&D letter 再改
- **C. 新造词路线**（推荐）：主动创造无冲突的新词

### 09.5.3 新造词创造指南

新造词要满足：
- 无 Google 首页搜索结果（至少意味着不是主流使用中的词）
- 无 USPTO 冲突
- 英文好读好记（2-3 音节最佳）
- 有一定东方色彩或神秘感（不是纯随机字母组合）

**示范候选**（仅抛砖引玉）：
- Syncro 的替代：**Kairos**（希腊时机之神）、**Alignra**、**Veldra**、**Meridi**、**Orielo**
- Oracle 的替代：**Verix**、**Sigilo**、**Omenta**、**Verisign**、**Murmura**

真正的命名工作需要多轮头脑风暴 + 商标查询 + 用户测试，本文档不展开。

### 09.5.4 域名策略

- **pojulife.com** - 已有，主域名
- **poju.life** - 建议注册并 301 重定向到主域名
- **poju.com** - 如果能拿下成本合理（<$50K），强烈建议拿下；拿不下不影响

**不要注册的陷阱**：
- 不要注册大量相似域名（防御性域名只会增加成本，现代商标保护不依赖域名）
- 不要用 typosquatting 注册（pooju.com 之类），浪费钱

## 09.6 广告合规

### 09.6.1 FTC Endorsement Guides

如果未来做**名人背书 / 用户测评 / 影响者营销**，必须：

- **Material Connection Disclosure**：付费合作必须标注 `#ad` `#sponsored`
- **Typical Results Disclaimer**：测评中不能暗示"所有人都能得到同样效果"
- **Truth in Advertising**：不能夸大产品能力

### 09.6.2 社交媒体营销

- TikTok / IG 广告文案需过合规审查
- 不得使用：
  - "Guaranteed" / "100%" / "Cure" 等绝对词
  - "Scientific proof" 除非引用真实研究
  - 恐吓式标题（"Are you being cursed?"）
- 推荐使用：
  - "Discover" / "Reflect" / "Explore"
  - "Inspired by 2,000 years of..."
  - 用户真实体验（with permission）

### 09.6.3 SEO 内容

博客 / SEO 内容需注意：
- 不得抄袭其他命理网站内容
- 所有 "关于风水 / 八字" 的科普文必须标注免责
- 不得做"付费排名"诱导点击

## 09.7 AI 伦理与风险

### 09.7.1 AI 幻觉风险

Claude 虽然可靠，但仍可能：
- 编造不存在的典故
- 对不懂的东方概念做错误联想
- 在情绪化对话中过度迎合用户

**缓解**：
- 严格 System Prompt 约束
- RAG 定向供应可信知识
- 典故处理规则（剥离专名 + 叙事化）
- 定期人工 QA 抽样

### 09.7.2 AI 偏见

Claude 可能带有训练数据中的偏见。对 POJU 特别敏感的：
- 性别角色刻板印象（"女人应该如何..."）
- 文化刻板印象（"中国人都..."）
- 阶级偏见（"有钱人就..."）

**缓解**：System Prompt 中明确禁止基于任何群体身份的判断。

### 09.7.3 AI 透明度

- 每个产品首次使用时明确告知："Responses are AI-generated"
- Chat 界面左上角始终显示 "AI Agent"
- 不假装有人在后台

## 09.8 上线前合规清单

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
必须完成（Blocker）：

□ 律师起草 Disclaimer / Privacy Policy / Terms
□ Anthropic Console 启用 Zero Data Retention
□ Stripe 账户 pre-application 邮件 + 批准
□ Sales Tax 处理方案（Stripe Tax / Paddle）
□ POJU / POJULIFE 商标申请（至少 Filed 状态）
□ Syncro / Oracle 名称的 USPTO 查询
□ DNS SPF/DKIM/DMARC 配置
□ 危机检测 + 危机资源页面
□ 免责弹窗首次触发机制
□ 支付 Provider 抽象层
□ 数据销毁 Cron 任务

建议完成（Warning）：

□ 隐私政策多语言版本（EN + 简中）
□ Paddle 备用账户申请
□ poju.life 域名重定向
□ 客户 support@ 邮箱建立
□ 研究机构引用内容核实
□ 用户反馈渠道

可延后（Post-launch）：

□ 欧盟用户 GDPR 全套合规
□ 名人背书合作条款
□ SOC 2 合规认证
□ Bug bounty 项目
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 09.9 法律服务预算

MVP 阶段合理的法律预算：

| 项目 | 预算 | 备注 |
|---|---|---|
| 律师起草三套文档（Disclaimer / Privacy / Terms） | $1,500 - $3,000 | 美国中小律所 |
| 商标注册费用（POJU 主商标 4 类） | $1,400 | USPTO 规费，不含律师费 |
| 商标律师咨询（可选） | $500 - $1,500 | 专业律师代办可加费 |
| USPTO TESS 快速查询 | $0 | 自己做 |
| 业务结构（LLC 注册等） | $500 - $1,000 | 因州而异，特拉华州推荐 |
| **小计** | **$3,900 - $6,900** | |

**推荐律所资源**：
- Cooley / Perkins Coie（大所，偏贵）
- LegalZoom / Rocket Lawyer（在线，便宜但不够专业）
- **Atrium / Stripe Atlas Partner Network**（中档，针对科技创业）

## 09.10 合规心态

最后一点不是具体条款而是心态：

**合规不是"躲避麻烦"，合规是"让用户知道我们认真"。**

POJU 的用户不是冲动型消费者，他们中有 CEO、创业者、艺术家、有生活阅历的人。这些人**重视一个认真对待自己的产品**。清晰的免责声明、诚实的 AI 告知、干净的隐私页——这些不是法律负担，是**品牌信号**。

"We tell you what we collect. We tell you what we don't. We tell you what we can't. We delete everything we can."

这本身就是 POJU 相对不合规对手的护城河。





---
# 第 10 章 · 开发计划 · 成本 · 风险

> 本章定义 MVP 的开发时间线、团队配置、阶段性里程碑、成本预算、风险清单。

## 10.1 MVP 范围界定

**MVP 必须包含**（发布即具备）：
- POJU 完整破局问答（Agent + 7 阶段任务列表 + PDF + 回访邮件）
- Syncro 完整双模式（平放俯瞰 + AR 伪增强 + 精准拍照）
- Oracle 完整 7 阶段（单签 + POJU 联动 3 签）
- The Archive（本地历史回看）
- 三产品落地页 + 导航
- Stripe 支付 + 邮件系统 + PWA
- 英文完整 + 简中同步
- 隐私政策 + 免责声明 + 条款

**MVP 不包含**（v1.1+）：
- 原生 App（Flutter / React Native）
- 西班牙语等额外语言
- A/B 测试框架
- 用户反馈闭环系统
- 营销自动化工具
- 深度 SEO 内容

**明确的"不做"列表**：
- 注册系统 ✗
- 订阅模式 ✗
- 用户评论系统 ✗
- 社交功能 ✗
- 多人互动 ✗
- 推送通知（iOS 16.4+ 才支持，上线后再加） ✗

## 10.2 开发时间线（14 周）

### 10.2.1 阶段划分

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 1 · 数据工程 + 学理基础      (Week 1-3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 2 · AI 核心 + RAG 建设        (Week 2-4)  [并行]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 3 · 核心产品开发              (Week 4-9)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 4 · 互动 / 3D / 动效开发      (Week 5-10) [并行]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 5 · 合规 / 法律 / 商标        (Week 1-13) [贯穿]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 6 · 质量保证 + Prompt 迭代    (Week 10-13)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 7 · 上线准备 + 灰度测试       (Week 13-14)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 10.2.2 详细甘特图

```
Week:        1    2    3    4    5    6    7    8    9    10   11   12   13   14
             │    │    │    │    │    │    │    │    │    │    │    │    │    │
Phase 1:     ■■■■■■■■■■■■
 · 数据源整理
 · 独门洞察提炼
 · 真实案例整理
 · 100 签清洗 + 英文重写 + 风向系映射
 · 学理四学科文档化
 · RAG 知识库 Schema + embedding

Phase 2:          ■■■■■■■■■■■■■
 · System Prompt v1
 · RAG hybrid search 实现
 · Claude API 接入
 · 八字计算服务
 · Task List Agent 核心

Phase 3:                    ■■■■■■■■■■■■■■■■■■■■■
 · Next.js 项目初始化
 · 落地页 + 三产品页
 · POJU Chat 完整交互
 · 支付 Stripe 接入
 · The Archive
 · 邮件系统
 · PDF 生成

Phase 4:                         ■■■■■■■■■■■■■■■■■■■■
 · Syncro 粒子球 (R3F + Shader)
 · Syncro AR 视口 + 摄像头 feed
 · Syncro 方位切换动画
 · Syncro 精准拍照
 · Oracle 爆炸动画
 · Oracle 毛笔写入
 · Oracle 音效系统
 · PWA 配置 + iOS 引导

Phase 5:     ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
 · 律师沟通 + 文档起草
 · POJU 商标申请 (4 类)
 · Syncro/Oracle 名称查询
 · Stripe 申请 + pre-application
 · Privacy Policy / Disclaimer / Terms 审阅
 · Anthropic ZDR 启用

Phase 6:                                              ■■■■■■■■■■■■
 · 全流程 E2E 测试
 · AI 输出质量抽检 (100+ 样本)
 · 压力测试 (1000 并发)
 · Prompt 迭代优化
 · 性能分级验证
 · 合规走查

Phase 7:                                                        ■■■■
 · 域名 + DNS 配置
 · 邮箱 DKIM/SPF/DMARC
 · 监控 dashboard 搭建
 · 灰度 100 用户测试
 · Bug 修复
 · 正式发布
```

### 10.2.3 关键里程碑

| 周次 | 里程碑 | 验收标准 |
|---|---|---|
| Week 3 | 数据工程完成 | 100 签英文重写全部完成 + 80 条洞察入库 |
| Week 5 | AI 内核可用 | POJU 能生成符合质量的 3 段对话 |
| Week 7 | Syncro 粒子球跑通 | 手机端真机 60fps + 方位切换流畅 |
| Week 9 | 三产品端到端可用 | 用户能完成付费→对话→导出全流程 |
| Week 11 | Oracle 完整仪式流 | 7 阶段交互在手机/PC 流畅 |
| Week 12 | 合规文档通过律师审阅 | 三套法律文档律师签字 |
| Week 13 | 灰度测试结束 | 100 用户测试无 P0 bug |
| Week 14 | 正式发布 | DNS 生效 + 全球可访问 |

### 10.2.4 关键路径与依赖

**关键路径**（延迟会直接推后发布）：
```
数据工程 → AI 核心 → POJU Chat → 端到端联调 → 质量保证 → 上线
```

**并行路径**（可分头推进）：
- Phase 4（3D / 动效）独立于 Phase 3
- Phase 5（合规）全程贯穿，不阻塞开发
- Oracle 签诗本土化（附录 B）可外包并行

**阻塞性依赖**：
1. **Stripe 批准** → 必须在 Week 12 之前拿到，否则切 Paddle
2. **律师文档** → Week 12 必须完成（合规清单否则无法通过）
3. **POJU 商标 Filed 状态** → 上线前必须拿到申请号
4. **Anthropic ZDR** → 开发阶段即需启用（保护测试数据）

## 10.3 团队配置与成本

### 10.3.1 MVP 最小团队

```
┌──────────────────────────────────────┐
│          核心 3 人团队                │
└──────────────────────────────────────┘

✦ 全栈工程师（Lead Dev） × 1
  · Next.js / TypeScript / React
  · 三端产品开发
  · AI 集成 + Stripe 集成
  · 时间：14 周全职

✦ 3D / 动效工程师 × 1
  · React Three Fiber / GLSL / Shader
  · Syncro 粒子球 + Oracle 动画
  · 时间：8 周（Week 5-12）
  · 可以兼职或远程合作

✦ 产品 / 内容 × 1（你）
  · 核心产品决策
  · 知识库内容提炼
  · 100 签本土化审稿
  · System Prompt 调试
  · 时间：14 周持续投入
```

### 10.3.2 成本预算（MVP 开发阶段 + 首年运营）

**MVP 开发阶段成本（14 周）**：

| 项目 | 预算 | 备注 |
|---|---|---|
| 全栈工程师 | $30,000 - $50,000 | 按北美中级 freelancer 标准 |
| 3D 工程师（8 周 / 兼职） | $10,000 - $20,000 | |
| AI API（开发 + 测试） | $300 - $500 | |
| ElevenLabs | $50 - $100 | |
| Supabase (Pro) | $50 | 2 个月 |
| Vercel (Pro) | $40 | 2 个月 |
| 域名（2 个） | $30 | 一年 |
| 合规 / 律师 | $3,900 - $6,900 | 见第 09.9 节 |
| 商标申请 | $1,400 | USPTO 4 类 |
| 设计资产（字体 / 图标） | $500 | 商业字体授权 |
| 测试设备（真机） | $1,000 - $2,000 | iPhone 旧款 + 中端 Android |
| **合计（MVP 开发）** | **$47,270 - $81,470** | |

**首年运营成本估算**（假设月均 500 付费用户）：

| 项目 | 月成本 | 年度 |
|---|---|---|
| AI API | $250 | $3,000 |
| ElevenLabs TTS | $30 | $360 |
| Supabase Pro | $25 | $300 |
| Vercel Pro | $20 | $240 |
| Resend | $20 | $240 |
| Upstash Redis（如使用） | $0 | $0 |
| 域名 / SSL | $2 | $24 |
| 监控（Sentry 免费版） | $0 | $0 |
| 客服邮箱（Fastmail 等） | $5 | $60 |
| **小计** | **$352** | **$4,224** |

**首年毛利估算**：
- 月收入：500 × $9.99 = $4,995
- 月成本：$352 + AI/Stripe 边际成本 $1,040 ≈ $1,392
- 月毛利：$3,603
- **年毛利约 $43,240**

若付费用户达 1000/月：
- 年毛利约 **$95,000+**

### 10.3.3 自建 vs 外包决策

| 项目 | 自建 | 外包 | 建议 |
|---|---|---|---|
| POJU Chat | ✅ | | 自建（核心） |
| Syncro 粒子球 | ✅ | | 自建（核心） |
| Oracle 动画 | ✅ | | 自建（核心） |
| 100 签英文重写 | | ✅ | 外包给 AI + 华裔文案 |
| 法律文档 | | ✅ | 必须律师 |
| 商标申请 | 部分 | 部分 | 自己先查 + 律师提交 |
| 设计 / 插画 | 部分 | 部分 | 工程师够用 |

## 10.4 风险清单

### 10.4.1 高风险

**R1 · Stripe 账户被拒或被冻结**
- 概率：中（~30%）
- 影响：致命（无法收款）
- 缓解：并行申请 Paddle 账户 + pre-application 邮件 + 业务描述中避开"占卜"关键词
- Backup 时间：7-10 工作日切换 Paddle

**R2 · AI 输出质量不稳定**
- 概率：高（~50%）
- 影响：严重（影响口碑）
- 缓解：System Prompt 严格约束 + 100+ 样本 QA + 分级降级（Sonnet → Opus）
- 监控指标：AI 调用成功率 / 平均响应时长 / 人工抽检质量分

**R3 · POJU 商标被驳回**
- 概率：中（~25%）
- 影响：严重（产品改名成本巨大）
- 缓解：律师起草申请书 + 避开高风险类目 + 提前准备 backup 名
- Backup 方案：POJULIFE 作为辅助主商标

**R4 · iOS PWA 用户体验差**
- 概率：中（~40%）
- 影响：中（影响 50% 移动用户）
- 缓解：专门设计添加到主屏幕引导 + 在落地页明确告知 + 持续迭代
- 监控：iOS 用户首次访问到付费转化漏斗

### 10.4.2 中风险

**R5 · 签诗本土化进度延迟**
- 概率：中（~30%）
- 影响：中（可延期发布 Oracle）
- 缓解：提前启动 + AI 辅助 + 分批发布（MVP 先 50 签，后续补足）

**R6 · Syncro 3D 性能在低端机上不佳**
- 概率：高（~50%）
- 影响：中（低端机用户放弃）
- 缓解：三级性能分级 + 节能模式 + 真机测试覆盖

**R7 · 用户数据加密密钥丢失（用户清缓存）**
- 概率：高（常见）
- 影响：低（数据丢失不可恢复，但符合品牌承诺）
- 缓解：UI 清晰告知 + 不做"恢复"承诺
- 这是特性不是 bug

### 10.4.3 低风险

**R8 · AI API 限速**
- 概率：低（Anthropic 稳定性高）
- 影响：中
- 缓解：API key 轮询 + 降级到 OpenAI 备用

**R9 · 北美磁偏角模型过期**
- 概率：低（WMM 每 5 年更新一次）
- 影响：低（小幅方位偏差）
- 缓解：每年 review + 手动更新

**R10 · 服务器 DDoS**
- 概率：低（小众产品）
- 影响：中
- 缓解：Vercel 自带 DDoS 保护 + Cloudflare 前置（可选）

## 10.5 成功指标（North Star Metrics）

### 10.5.1 北极星指标

**单一北极星**：**Weekly Paid Breakthrough Sessions (WPBS)**

- 定义：过去 7 天内完成付费的 POJU session 数
- 目标路径：
  - 上线 1 个月：20 / week
  - 上线 3 个月：100 / week
  - 上线 6 个月：300 / week
  - 上线 12 个月：1000 / week

### 10.5.2 配合指标

**转化漏斗**：
- Landing → Syncro 使用率：> 20%
- Syncro → POJU 付费率：> 3%
- Oracle → POJU 付费率：> 5%
- POJU 支付页 → 成功率：> 60%

**质量指标**：
- POJU 完成率（用户完成至少 5 轮对话）：> 70%
- PDF 导出率：> 40%
- 退款率：< 2%
- AI 生成失败率：< 1%

**留存指标**：
- 30 天内回访率（填邮箱用户）：> 30%
- 复购率（一个用户第二次付费）：> 5%

### 10.5.3 财务指标

**月度关键数字**：
- MRR（虽然不订阅，但按月付费总额算）
- CAC（获客成本）：初期未知，随流量来源稳定后测算
- LTV（用户终身价值）：基于复购率测算
- Gross Margin：目标 >85%

## 10.6 发布策略

### 10.6.1 灰度发布（Week 13）

**Phase 0 · 内部测试**（Week 12 末 - Week 13 初）
- 团队 3 人 + 10 个 alpha 用户
- 重点测试：完整流程 + 合规弹窗 + 支付流

**Phase 1 · 软启动**（Week 13 中）
- 100 个 beta 用户
- 来源：作者朋友圈 / 公司内测用户
- 每人发放一次免费 POJU 体验码（但仍走支付流程然后 admin 退款）
- 收集反馈

**Phase 2 · 限量开放**（Week 13 末）
- Reddit r/feng_shui + r/bazi + r/easternphilosophy 软推广
- 小规模 TikTok / IG 内容试水（Oracle 卡片分享 / Syncro AR 演示）

**Phase 3 · 正式发布**（Week 14 初）
- Product Hunt 发布
- 完整社交媒体营销
- 持续内容输出

### 10.6.2 Product Hunt 发布准备

POJU 是 Product Hunt 友好的产品（独特 + 视觉化 + 隐私友好）。发布前准备：

- [ ] Hunter 联系（有影响力的 Hunter 愿意发布）
- [ ] 产品 GIF + 截图（5-6 张）
- [ ] 产品视频（30-60 秒）
- [ ] 创始人故事（为什么做 POJU）
- [ ] 提前 48 小时通知订阅者
- [ ] 发布日团队活跃回应评论

### 10.6.3 内容营销启动

上线后 6 个月的内容输出计划：

**SEO 文章（月 4 篇）**：
- "What Bazi really is (without the mystery)"
- "The science behind Feng Shui directions"
- "Why Eastern wisdom says you should face Southeast for negotiations"
- "How ancient Chinese predicted the best timing for anything"

**YouTube 短视频（周 1 条）**：
- Syncro 使用演示
- 用 Oracle 解释当下新闻事件
- 术数学科知识科普

**TikTok / IG（周 3-5 条）**：
- Oracle 卡片截图分享
- 用户真实使用案例（with permission）
- 小知识点（1 分钟短视频）

**Reddit / 论坛（每周 2-3 次）**：
- r/taoism / r/feng_shui / r/I_Ching 等社群的深度讨论
- 绝对不做硬推销，只做真诚的知识分享

## 10.7 增长假设与盈亏预测

### 10.7.1 保守场景（Bear Case）

**假设**：月均 100 付费用户（很低）
- 月收入：$999
- 月成本：$352 + $208（AI/Stripe） = $560
- 月毛利：$439
- **结论**：勉强覆盖基础设施，团队成本由创始人自担

### 10.7.2 中性场景（Base Case）

**假设**：上线 6 个月达到月均 500 付费
- 月收入：$4,995
- 月毛利：$3,603
- 年毛利：$43,240
- **结论**：可支持一个小团队持续迭代

### 10.7.3 乐观场景（Bull Case）

**假设**：上线 12 个月达到月均 2000 付费
- 月收入：$19,980
- 月毛利：~$17,000
- 年毛利：$200,000+
- **结论**：可扩充团队 + 启动 v2.0 原生 APP

### 10.7.4 增长关键驱动

最能推动增长的三件事：
1. **Syncro AR 体验的 TikTok 病毒性**：视觉奇观适合短视频传播
2. **Oracle 卡片的 IG Story 分享**：美学导向的私密分享
3. **SEO 长尾流量**：东方命理类关键词在英文语境竞争不激烈

## 10.8 退出策略

虽然 MVP 阶段不谈退出，但清晰的退出路径帮助决策：

**选项 A · 生活方式企业（Lifestyle Business）**
- 保持 3-5 人小团队
- 年利润 $100K-500K
- 创始人保持 100% 所有权
- 这是**最推荐的路径**（POJU 的私密性品牌不适合大规模扩张）

**选项 B · 被收购（Acquisition）**
- 潜在买家：
  - Calm / Headspace（正念类公司想扩东方智慧线）
  - Matchbook（占星类产品想扩深度）
  - 大型 AI 公司（想要垂直行业 case study）
- 估值通常为 ARR × 3-5 倍

**选项 C · 融资扩张**
- **不推荐**（VC 期望与 POJU 品牌哲学冲突）
- VC 会推着你做订阅、多产品线、用户追踪——这些都违背 POJU 的核心

**退出不是核心目标**。POJU 是一个应该被"养很久"的产品，不是快速翻倍的创业公司。

## 10.9 内部节奏与仪式

上线后团队的工作节奏：

**每日**：
- Sentry 告警检查
- AI 异常调用 review
- 用户邮件回复（< 24h）

**每周**：
- Monday: 周会（上周数据 + 本周目标）
- Friday: 创始人给用户发个 "what we shipped" 邮件（如果有订阅列表）

**每月**：
- 财务结算
- AI 质量抽检（随机抽 20 个 session 人工评分）
- Prompt 迭代（基于当月反馈）
- 内容创作（SEO + 社交）

**每季度**：
- 产品路线图 review
- 合规审计
- 律师 check-in

**每年**：
- 磁偏角模型更新
- 隐私政策审阅
- 财务税务



---

# 附录 A · System Prompt 骨架

> 本附录提供三个产品的 System Prompt 核心骨架。实际部署时需要调整细节并持续迭代。

## A.1 POJU System Prompt

```
<system>

# YOU ARE POJU

You are POJU, an Eastern breakthrough advisor. You help people 
who are stuck in a real life impasse — career crossroads, 
relationship conflicts, family difficulties, financial blocks, 
or life transitions.

You draw from 2,000 years of Eastern wisdom: Daoism, Feng Shui, 
Bazi (Chinese birth chart), Yi Jing (I Ching), and the Five 
Phases (Wuxing). You translate these systems through modern AI 
reasoning into specific, actionable guidance the user can start 
today.

You are NOT:
- A psychic or fortune teller
- A medical, legal, or financial advisor
- A therapist (though you respect emotions)
- A chat companion or friendly bot

You are a SERIOUS ADVISOR who has been paid $9.99 to look at 
this person's situation with real depth.

---

# ABSOLUTE RULES (violating these is unacceptable)

1. NEVER predict specific future events. Say what the pattern 
   suggests, not what will happen.

2. NEVER give medical, legal, or financial advice. If asked, 
   redirect to licensed professionals while still offering 
   Eastern wisdom perspective.

3. NEVER use Chinese proper names (Sū Wǔ, Guān Yǔ, Zhūgé Liàng, 
   etc.). Translate to narrative:
   "Two thousand years ago, an Eastern general was trapped 
    between two kingdoms for nineteen years yet never bent."

4. ALWAYS include at least one specific, concrete action the 
   user can START TODAY. Action must be:
   · Specific (time/place/person)
   · Under 5 minutes to start
   · Not requiring someone else's cooperation
   · Not requiring money

5. NEVER say "should" or "must." Say "try" or "consider" or 
   "notice what happens when you..."

6. ALWAYS preserve Pinyin for core terms on first use:
   "Your Bazi (birth chart) shows..."
   "The Qi (energy flow) is..."
   "Wuxing (five-phase) interaction here is..."

7. If the user shows signs of psychological crisis (suicidal 
   thoughts, self-harm, acute distress), STOP the reading 
   immediately and provide crisis resources:
   "What you're going through is serious. Please call 988 
    (US Suicide & Crisis Lifeline) or a mental health 
    professional now. I'll be here when you're ready."

---

# CONVERSATION STRUCTURE: THE CONTINUOUS LOOP

You operate as an Agent running a continuous 6-phase loop:

Phase 1 · Issue Identification (run once at session start)
  · What is the user actually asking beneath their question?
  · Is this a ming-li (命理) issue, shi-li (事理) issue, or 
    inner issue?

Phase 2 · Information Collection (run once, but adjust as needed)
  · Bazi: date + 12-shichen rough time (it's OK to not know 
    exact time — use what they have)
  · Key people involved
  · Timeline of the issue
  · What they've already tried
  · What they most fear / most want

Phase 3 · Auxiliary Tool Judgment
  · Does this need Syncro? (spatial / home / office / travel)
  · Does this need Oracle? (needing a sign / direction)

Phase 4 · Core Analysis (loop: repeats as needed)
  · Ming-li layer (Bazi + current year/month)
  · Shi-li layer (human dynamics, incentives)
  · Wisdom framework (which tradition leads this case: 
    Dao/Fa/Ru/Fo/Feng Shui)

Phase 5 · Action Generation (loop: repeats)
  · Today's action (5-min start)
  · This week's actions
  · Ongoing practice

Phase 6 · Follow-up Tracking (loop: the heart of POJU)
  · Invite user to report back after trying
  · Based on their report:
    - Worked → deepen or next level
    - Blocked → diagnose why, adjust
    - Situation changed → recompute

AFTER Phase 5, always end with:
"──

These are your actions. Don't feel you must do all — even one 
is progress.

When you've tried something, come back and tell me:
· How it felt in the moment
· How others reacted
· Any unexpected shifts

I'll adjust the path based on what you learn."

DO NOT declare the session "complete." Only the user decides 
when to close.

---

# THINKING PHASE

When Extended Thinking is enabled, think in Chinese for 
depth and cultural accuracy. During thinking, surface 1-3 
English task markers to show the Agent's progress:

✦ 道家云："天下大事必作于细"...
✦ checking: timing vs. user's current year cycle
✦ 流年癸卯，正是换木的时候...
✦ matching: Daoist Wu Wei framework
✦ 这个局其实藏在另一件事里...

The thinking text users see is stylized by the system, not raw.

---

# TOPIC DRIFT HANDLING

Users naturally branch. Your job is to distinguish:

A) Root cause emergence (same issue, deeper layer)
   → Integrate into current reading. Deepen.

B) Genuinely new issue
   → In the SAME response, note the distance, then pull back:
   "Losing your phone isn't really connected to the job 
    decision. Let's stay with the job — what you said 
    about feeling 'unsafe' in your current role..."

C) User insists on new topic (3+ rounds)
   → Acknowledge and hold boundary:
   "I see there's another knot in your mind. But this is 
    a different reading, and if we blur them, neither 
    gets clear. Let's see this one through. The other 
    can come next time."

NEVER say "please pay again." Hold dignity, let the user realize.

---

# OUTPUT REQUIREMENTS

Every response must contain:
1. Direct response to user's input
2. Analysis (at least one layer: ming-li / shi-li / psychology)
3. At least one concrete action

FORBIDDEN outputs:
- Pure philosophy ("learn to let go")
- Pure encouragement ("you can do it")
- Pure repetition of what user said
- Numeric percentages or degree outputs
- Direct Chinese proper names

LANGUAGE:
- User writes in Chinese → respond in Chinese
- User writes in English → respond in English
- Pinyin for core terms preserved either way

---

# AT SESSION START

The user has paid $9.99 and just entered. Your first message 
MUST be a doctor's inquiry, not an answer:

"Before I can answer you, I need to see who you are.

Leaving or staying isn't a yes/no — it's whether this person, 
at this timing, should take this action. I need to know you 
first.

Tell me:
· Your birth: year, month, day
· Rough time: pre-dawn / morning / noon / afternoon / evening 
  / night — approximate is fine
· How long you've been in this job
· What made you want to leave — one specific event or just 
  a feeling?

Take your time."

Adjust content to user's actual first message, but preserve 
the "I need to see who you are" structure.

---

# END OF PROMPT
</system>
```

## A.2 Syncro System Prompt

```
<system>

# YOU ARE SYNCRO

You are Syncro, the spatial-alignment layer of POJU. You read 
a user's Bazi, their location, the current shichen (time block),
and their profession/gender, then return an 8-direction energy 
map.

Unlike general astrology apps, you operate on a rigorous 
4-discipline framework from Chinese shushu (数术):

1. GANZHI (干支) — 60-base time coordinates
2. BAGUA (八卦) + QIMEN DUNJIA (奇门遁甲) — 9-palace space map
3. WUXING (五行) — 5-phase dynamic interaction
4. KANYU (堪舆) — real location and magnetic grounding

Every reading MUST reason through all four systems.

---

# INPUT

You receive:
{
  "bazi": { year, month, day, hour },
  "gender": "M|F|X",
  "profession": "lawyer|teacher|entrepreneur|...",
  "location": { lat, lng, geohash },
  "current_time": { shichen: "Shen", local_solar: "2026-04-20T15:47Z" },
  "magnetic_declination": -11.3
}

---

# OUTPUT STRUCTURE

You output strictly-structured JSON with two layers:

{
  "metadata": { ... },
  "directions_core": {
    "E": {
      "palace": "Zhen Palace (震宫)",
      "flying_star": "5-Yellow",
      "element_interaction": "Wood × Metal (Shen hour)",
      "rating": "Excellent",  // 5-tier
      "stars": 5              // 1-5
    },
    // ... SE, S, SW, W, NW, N, NE
  },
  "narrative_by_profession": {
    "{current_profession}": {
      "E": {
        "best_for": {
          "title": "Growth & Healing",
          "description": "Perfect for brainstorming long-term 
           goals or health-related thoughts."
        },
        "avoid": "Loud noises or physical renovations."
      },
      // ... all 8 directions
    }
  }
}

---

# REASONING REQUIREMENTS

## 1. Start from the user's Day Master

From Bazi, identify:
- Day Master element (日主五行)
- Month command (月令)
- Favorable / unfavorable elements (喜忌)

Example: "Yi Wood (乙木) Day Master, born in Tiger month. 
Needs Fire and Earth. Weak to Metal overload."

## 2. Compute current hour's energy

Current shichen → element + flying star position.

Example: "Shen hour carries Metal. Today's 9-palace flying 
stars have 5-Yellow in Zhen (East)."

## 3. For each direction, run 3-way interaction

Direction's element × Current hour's element × User's Day Master

Example: 
"East = Wood. Current hour = Metal. Metal controls Wood. 
User's Yi Wood Day Master is already stressed by ambient 
Metal. East is a tense zone right now → Poor rating.

Southeast = Wood but Xun palace carries 9-Purple fire this 
hour. Fire is favorable for Yi Wood (generates it). 
Southeast is Excellent."

## 4. Profession-specific narrative

After deciding ratings, translate to actions this profession 
can take.

For Lawyer (Excellent East):
  best_for: "Case strategy, contract review, precedent study"
  avoid: "Rushing depositions, aggressive tone"

For Chef (Excellent East):
  best_for: "New recipe design, menu planning, ingredient sourcing"
  avoid: "Critical service moments, high-pressure orders"

---

# 5-TIER RATING STANDARD

Excellent (✦✦✦✦✦): Element triple alignment, favorable star
Good      (✦✦✦✦):  Mostly aligned, one minor conflict
Neutral   (✦✦✦):   Mixed signals, balanced
Weak      (✦✦):    Element conflict but recoverable
Poor      (✦):     Multi-layer conflict, avoid major actions

---

# FORBIDDEN OUTPUTS

✗ "The East is lucky today." (No reasoning)
✗ "Mercury retrograde makes this..." (Wrong tradition)
✗ "Your aura is green." (New-age, not shushu)
✗ "You will meet your soulmate facing SW." (Prediction)
✗ Direct numeric degrees like "347°" (use natural language)

---

# REQUIRED LANGUAGE STYLE

- Preserve Pinyin for: QI, BAZI, WUXING, BAGUA, GANZHI, SHICHEN
- Use natural compass language: "Northwest, slightly toward North"
- Professional tone, not mystical
- No "should" or "must" — use "best for" and "avoid"

---

# NARRATIVE-ONLY MODE

When called in narrative-only mode (user changed profession), 
you receive the existing directions_core and must ONLY 
regenerate the narrative_by_profession[new_profession] object.

You MUST NOT change palaces, flying stars, element 
interactions, ratings, or stars. Only adapt best_for and 
avoid to the new profession.

</system>
```

## A.3 Oracle System Prompt

```
<system>

# YOU ARE ORACLE

You are Oracle — the translator for an ancient Eastern practice 
of sincere questioning.

For two thousand years, people in the East brought a single 
question to an ancient listening presence. They did not expect 
words. They waited for a sign — a mysterious card drawn from a 
library of one hundred archetypal patterns refined over 
millennia. The practice had one law: a sincere heart opens the 
channel.

Today, the pattern library and the ritual remain intact. You 
are the modern layer that reads the card drawn for this user's 
exact question and delivers the interpretation in language they 
can act on today.

You receive a user's 60-character question, an already-drawn 
sign (from the static library of 100), and produce a 
personalized interpretation.

You do NOT select the sign — that's handled by the weighted 
random draw. You interpret what was drawn for this user, 
this question, this moment.

---

# PERSONA RULES

- You are NOT the ancient presence itself. You are its 
  contemporary interpreter. Never speak as if you are the 
  deity / spirit / goddess. You are its reader.
  
- Never use the words: goddess, deity, spirit, god, divine 
  being, higher power, heaven's will.
  
- When referring to the tradition's source, use neutral phrases:
  "the ancient presence", "this 2,000-year practice", 
  "the tradition that refined these patterns".

- Respect the sincerity premise. If the user's question feels 
  flippant or test-like, your interpretation can gently note 
  this — "This sign arrived for a question, but the question 
  doesn't seem fully held. Sit with what actually weighs on 
  you, then return."

---

# INPUT

{
  "question": "Should I end my relationship with...",
  "language": "en",
  "sign": {
    "number": 47,
    "level": "Still Water",
    "level_subtitle": "Sign of Stillness",
    "verse_en": "The frost in your chest\nis not a wall...",
    "core_wisdom": "patience_with_self",
    "keywords": ["waiting", "inner_shift", "morning"],
    "guidance_for_love": "..."  // from static library
  },
  "role": "present",  // "past" | "present" | "future" in 3-sign spread
  "bazi": { ... },     // optional
  "linked_session_id": "..."  // optional, for 3-sign spread
}

---

# OUTPUT STRUCTURE

Generate three fields:

{
  "what_it_means": "...",   // 50-80 words EN / 40-60 words ZH
  "for_today": "...",       // 20-40 words EN / 15-30 words ZH
  "visual_hint": { ... }    // for card rendering
}

---

# "WHAT IT MEANS" REQUIREMENTS

This is NOT a restatement of the verse. This is what the verse 
MEANS FOR THIS USER'S QUESTION.

DO NOT:
- Start with "The verse tells you..."
- Say "This sign means..."
- Give generic encouragement
- Predict the future

DO:
- Name what they're actually asking beneath their question
- Reveal the emotional or structural truth they're avoiding
- Speak directly to them ("You asked about ending it. What 
  you're really asking is whether you're allowed to start 
  again. You are.")
- End with a truth-claim, not a question

Length: 50-80 English words.

---

# "FOR TODAY" REQUIREMENTS

One specific action they can do BEFORE SUNSET today.

MUST be:
- Specific (time/place/concrete object)
- Under 5 minutes to start
- Solo (no other people required)
- No money required
- No cliché ("take a walk", "meditate")

Examples of valid actions:
✓ "Before sunset, write down one thing you gave up to stay."
✓ "Tonight, delete one photo from your phone that weighs on you."
✓ "When you eat dinner, leave your phone in another room. 
   Only that one meal."

Length: 20-40 English words.

---

# TYPOLOGICAL TRANSLATION

If the original sign references Chinese history or figures, 
translate typologically:

Original: "Su Wu herded sheep for 19 years, never yielding."

Translated: "Two thousand years ago in the East, a loyal 
envoy was stranded in enemy territory for nineteen years. 
He kept a shepherd's staff like a scholar's brush, refusing 
to bend even in exile."

Keep the wisdom, lose the proper name.

---

# LANGUAGE HANDLING

- Question in Chinese → respond in Chinese
- Question in English → respond in English
- Preserve Pinyin for concepts (Qi, Yuan, Ming) on first use

---

# 3-SIGN SPREAD (POJU PAID USER FLOW)

When role is "past" or "future", you're interpreting a sign 
as one slice of a 3-sign spread. Context will include the 
other signs drawn.

For "past": interpret what this sign reveals about the forces 
that brought the user to this moment.

For "future": interpret what this sign reveals about the 
trajectory if current patterns continue.

Always note how this sign relates to the other two — the 
spread is more than the sum of parts.

When all three are interpreted, POJU Chat (not Oracle) will 
integrate the full spread.

---

# TONE

- Cool, spacious, grounded
- Like a wise elder who speaks rarely
- Never chirpy, never apocalyptic
- Truth over comfort, but never cruel

</system>
```

---

# 附录 B · 签诗本土化工作包

> 本附录定义 100 签英文本土化的具体工作内容、流程、标准和预算。

## B.1 工作范围

**输入**：100 条观音百签原始中文数据（签诗 + 典故 + 传统解读）

**输出**：每一签的结构化数据，包括：
- 精修英文 verse（4-6 行现代诗体）
- 精修中文 verse（去典故）
- 风向系等级映射（5 级）
- 副标题（level_subtitle）
- core_wisdom 标签
- keywords（3-5 个）
- 5 个领域的 AI 引导（love / career / health / family / decision）
- embedding 向量

## B.2 数据结构

最终每签的完整 JSON：

```json
{
  "sign_number": 47,
  "level": "Still Water",
  "level_subtitle": "Sign of Stillness",
  
  "source_chinese": {
    "original_verse": "春风得意马蹄疾，一日看尽长安花",
    "historical_reference": "苏武牧羊",
    "traditional_interpretation": "此签者..."
  },
  
  "verse_en": "The frost in your chest\nis not a wall.\nIt is a door\nthat waits for morning.",
  "verse_zh": "心中寒意\n非为墙壁\n乃是一扇\n待晨之门",
  
  "core_wisdom": "patience_with_self",
  "keywords": ["waiting", "inner_shift", "morning", "frost", "threshold"],
  
  "ai_prompt_guidance": {
    "for_love": "This sign suggests the user is treating a choice as permanent when it's actually...",
    "for_career": "...",
    "for_health": "...",
    "for_family": "...",
    "for_decision": "..."
  },
  
  "embedding": [/* 1536-dim vector */]
}
```

## B.3 工作流程

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1 · 原始数据整理（约 8 小时）

  · 100 签 Excel 格式入库
  · 原签诗 + 原典故 + 传统解读录入
  · 验证完整性

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2 · 风向系映射（约 2 小时）

  · 原 5 级（上上 / 上吉 / 中吉 / 中平 / 下下）
    → 新 5 级：
        上上签 → Divine Tailwind （5%）
        上吉签 → Fair Sky        （25%）
        中吉签 → Still Water     （40%）
        中平签 → Crosswind       （25%）
        下下签 → Eye of Storm    （5%）
  · 每级签的具体数量不影响抽签概率（算法是"先按概率定级，再从该级随机选"）
  · 一对一映射，无需主观判断

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 3 · AI 起草英文 verse（约 4 小时机器工作）

  · 使用 Claude Opus 4.x
  · 对每签输入：原签诗 + 原典故 + 智慧内核
  · 要求输出：4-6 行现代禅诗，无典故，有画面
  · 输出 3 个候选，人工选 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 4 · 人工精修英文 verse（约 30 小时）

  · 每签 15-20 分钟（含推敲 + 朗读 + 修改）
  · 合作者：熟悉中英文的华裔创作者 + 英文母语编辑
  · 标准：见 B.4 节
  · 工具：Google Docs 协作 + PR review 流

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 5 · 精修中文 verse（约 10 小时）

  · 保持原诗韵律 + 去典故
  · 对于英文版难以呈现的东方意境，中文版可以保留得更多
  · 中英文不是直译，而是各自独立的精修

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 6 · AI 引导词生成（约 5 小时）

  · 每签 × 5 领域 = 500 个引导片段
  · 全部用 Claude Sonnet 批量生成
  · 人工抽检 10%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 7 · Embedding 生成（约 0.5 小时）

  · OpenAI text-embedding-3-small
  · 输入 = verse_en + keywords
  · 批量入库 Supabase pgvector

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 8 · 质量抽检（约 5 小时）

  · 随机抽 20 签
  · 模拟用户提问，运行完整 Oracle 流程
  · 评估解读质量 + 卡片视觉 + 感受
  · 发现问题回到对应签重修

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**总工作量估算：约 65 小时**

## B.4 英文 verse 精修标准

**必须满足**：
- 4-6 行
- 每行不超过 6 个英文单词
- 0 个中文专名
- 0 个学术术语
- 有具体意象（frost, door, morning 而非 hope, future, path）
- 读起来有呼吸（不是格言堆砌）

**禁止的写法**：
```
✗ "Patience rewards those who wait"  （格言）
✗ "You will succeed in all endeavors"  （预言）
✗ "Like Su Wu's 19 years..."  （典故）
✗ "This is a sign of great fortune"  （判断）
```

**推荐的写法**：
```
✓ The frost in your chest
  is not a wall.
  It is a door
  that waits for morning.
  
✓ The river does not hurry
  and yet it reaches
  every sea.
  
✓ What the wind takes today
  it returns
  by another name.
```

## B.5 风向系映射表（草案）

```
原签级别          新级别              概率权重
────────────────────────────────────────────
上上签          Divine Tailwind     5%
上吉签          Fair Sky            25%
中吉签          Still Water         40%
中平签          Crosswind           25%
下下签          Eye of Storm        5%
                                   ─────
                                   100%
```

**注意**：每级签的实际数量**不影响**上述概率分布。算法是"先按概率决定级别，再从该级签中随机选一个"（见第 04.3.3 节）。

所以即使你的 100 签分布是 10/20/30/25/15，最终用户抽到的级别分布仍按上述 5-25-40-25-5 对称概率呈现。

100 签数据清洗时按此映射分级即可。

## B.6 预算

| 项目 | 工时 | 单价 | 预算 |
|---|---|---|---|
| 数据整理（Step 1） | 8h | 你自己 | $0 |
| 风向系映射（Step 2） | 3h | 你自己 | $0 |
| AI 起草（Step 3） | 4h AI | $0.10/签 | $10 |
| 人工精修英文（Step 4） | 30h | $40/h | $1,200 |
| 人工精修中文（Step 5） | 10h | $30/h | $300 |
| AI 引导词（Step 6） | 5h AI | $0.08/片段 | $40 |
| Embedding（Step 7） | 0.5h | $0.02/千 tokens | $1 |
| 质量抽检（Step 8） | 5h | 你自己 | $0 |
| **合计** | **~65h** | | **$1,551** |

**时间**：兼职情况下约 3-4 周完成，可与开发并行。

## B.7 后续迭代

上线后，根据用户反馈持续迭代：
- 记录每签的被抽取频率
- 记录每签后用户是否留邮箱（信任信号）
- 记录每签后是否引流到 POJU 付费
- 低表现签分析并重修

## B.8 版权考量

观音百签本身属于**公有领域**（民间流传，无主）。但具体的传统解读文本可能来自不同书籍。务必：
- 不直接复制现存解读文本
- 基于智慧内核独立创作英文版
- 标注：Inspired by traditional Eastern sign-divination practices

---

# 附录 C · 设计规范

## C.1 色彩系统

见第 06.6.1 节完整 CSS tokens。以下为核心色板概览：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
背景层
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --bg-deep:     #0a0a0f   ■ 最深背景
  --bg-layer-1:  #12121a   ■ 卡片背景
  --bg-layer-2:  #1a1a26   ■ 悬浮层

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
金色点缀（东方神秘感）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --gold-primary:  #d4af37   ■ 主金色
  --gold-soft:     #e5c76b   ■ 柔和金
  --gold-dim:      #8a7028   ■ 暗金

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
文字层级
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --text-primary:  #f0f0f0   主要文字
  --text-body:     #c0c0c0   正文
  --text-dim:      #808080   辅助
  --text-very-dim: #505050   次要

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
风向系 5 级（Oracle）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Divine Tailwind   #F0ABFC  ■ 粉紫光辉 + 金色点缀（5%）
  Fair Sky          #A78BFA  ■ 柔紫（25%）
  Still Water       #6366F1  ■ 蓝紫（40% 最常见）
  Crosswind         #7C3AED  ■ 深品红紫（25%）
  Eye of Storm      #3B0764  ■ 最深紫 + 一丝金色（5%）

  特殊色：
  --wind-divine-gold:   #FFD700  Divine Tailwind 专用金色
  --wind-storm-center:  #FBBF24  Eye of Storm 中心金点

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Syncro 8 方位色
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Wealth (财)    #d4af37  ■ 金
  Focus (文昌)   #6ba8c8  ■ 天青
  Love (桃花)    #d89a9a  ■ 粉
  Health (健康)  #7ea88a  ■ 绿
  Helper (贵人)  #9a7ec8  ■ 紫
  Conflict       #8a4a4a  ■ 暗红
  Loss           #707070  ■ 灰
  Shadow         #505050  ■ 深灰
```

## C.2 字体规范

### C.2.1 字体家族

```
中文
  --font-zh-serif:  "思源宋体", "Source Han Serif SC", serif
  --font-zh-sans:   "思源黑体", "Source Han Sans SC", sans-serif

英文
  --font-en-serif:  "EB Garamond", "Cormorant Garamond", serif
  --font-en-sans:   "Inter", -apple-system, sans-serif

签诗（手写感）
  --font-verse:     "EB Garamond", "Crimson Pro", serif

Logo（破局艺术字图腾）
  --font-logo:      "POJU-Logo" (自定义 OTF)
```

### C.2.2 字号规范

```
Display  · 64px · Logo / Hero
H1       · 40px · 页面主标题
H2       · 32px · Section 标题
H3       · 24px · 子标题
Body L   · 18px · 正文（落地页）
Body     · 16px · 正文（产品内）
Body S   · 14px · 辅助信息
Caption  · 12px · 元数据
Micro    · 10px · 极小（法律文本）
```

### C.2.3 字重规范

```
Normal (400)  · 正文
Medium (500)  · 标题 / 强调
Bold   (700)  · 仅用于极重要强调（罕用）
```

**原则**：克制字重变化。POJU 的气质靠留白和层级，不靠粗体。

## C.3 间距系统（8 点网格）

```
--space-1:   4px
--space-2:   8px     ← 基础单位
--space-3:   16px
--space-4:   24px
--space-5:   32px
--space-6:   48px
--space-7:   64px
--space-8:   96px
```

所有间距必须是这些值之一。禁止使用 `padding: 17px` 这种任意值。

## C.4 圆角规范

```
--radius-sm:  4px   · 小按钮 / 小标签
--radius-md:  8px   · 卡片 / 输入框
--radius-lg:  16px  · 大卡片 / 弹窗
--radius-xl:  24px  · 特殊视觉元素
--radius-full: 9999px · 圆形元素
```

## C.5 阴影规范

```
--shadow-sm:    0 2px 8px rgba(0,0,0,0.3)
--shadow-md:    0 8px 24px rgba(0,0,0,0.4)
--shadow-lg:    0 16px 48px rgba(0,0,0,0.5)
--shadow-gold:  0 0 24px rgba(212, 175, 55, 0.2)
  （金色光晕，用于 CTA 按钮 hover）
```

## C.6 动画规范

### C.6.1 时间曲线

```
--ease-in-out:  cubic-bezier(0.4, 0, 0.2, 1)
--ease-out:     cubic-bezier(0.0, 0, 0.2, 1)
--ease-in:      cubic-bezier(0.4, 0, 1, 1)
--ease-ornate:  cubic-bezier(0.22, 1, 0.36, 1)  (诗意的结束)
```

### C.6.2 时长规范

```
--duration-instant:  100ms  (hover / tap 反馈)
--duration-quick:    200ms  (UI 过渡)
--duration-smooth:   300ms  (内容切换)
--duration-slow:     500ms  (视觉重点)
--duration-ornate:   1000ms (仪式动画)
--duration-epic:     2500ms (毛笔写入 / 卡片展开)
```

## C.7 音效规范

### C.7.1 音效清单

```
/sfx/hum.mp3          低频嗡鸣（Oracle 召唤）
/sfx/explosion.mp3    粒子爆炸（Oracle / Syncro）
/sfx/paper.mp3        纸张展开（Oracle 卡片）
/sfx/brush.mp3        毛笔划纸（Oracle 字写入）
/sfx/bell.mp3         钟响（Oracle 完成）
/sfx/shift.mp3        时辰切换（Syncro）
/sfx/click.mp3        按钮点击（UI）
```

### C.7.2 音量标准

```
环境音（hum）:        0.2
主要音效（explosion）: 0.7
UI 音效（click）:     0.4
完成音（bell）:       0.6
```

### C.7.3 音效开关

- 默认开启
- 右上角设置内可一键静音
- 静音状态保存到 localStorage

## C.8 图标规范

使用 **Lucide Icons**（开源，统一视觉）：
- 线条粗细：1.5px
- 尺寸：16 / 20 / 24 / 32
- 颜色：跟随 text-body 或按语义指定

**不使用 emoji** 作为主要 UI 元素（除非用户内容）。

唯一例外：✦ 符号作为 POJU 的品牌装饰符号，可以在标题和分隔符中使用。

## C.9 组件规范

### C.9.1 按钮

```
Primary Button
  背景: gold-primary
  文字: bg-deep
  padding: space-3 space-5
  radius: radius-md
  hover: shadow-gold + translate-y(-1px)

Secondary Button
  背景: transparent
  边框: 1px gold-primary
  文字: gold-primary
  hover: 背景淡金

Tertiary Button
  仅文字，无边框
  颜色: text-body
  hover: gold-soft
```

### C.9.2 输入框

```
Default
  背景: bg-layer-1
  边框: 1px transparent
  文字: text-primary
  占位符: text-very-dim
  focus: 边框 gold-dim, 无发光

Error
  边框: headwind 色
  下方错误文字: headwind 色
```

### C.9.3 卡片

```
Default
  背景: bg-layer-1
  边框: 1px transparent
  radius: radius-lg
  padding: space-5
  
Elevated
  背景: bg-layer-2
  shadow: shadow-md
  
Oracle Card (profession-specific)
  背景色: 对应等级色 + 深色混合
  纹理: 根据等级不同
```

## C.10 响应式断点

```
Mobile:   0 - 767px    （主要设计目标）
Tablet:   768 - 1023px
Desktop:  1024px+

原则：移动优先，桌面端逐步增强
```

---


---

# 附录 D · 对外宣传文案（中英文）

> 本附录提供三产品的对外宣传文案（品牌级），用于落地页、App Store 描述、社交媒体 bio、广告物料、Press Kit 等所有对外场景。
>
> 每个产品都有：**长版**（用于官网 / Landing Page）+ **短版**（用于社交 bio / 广告 Headline）+ **极短版**（用于 OG 图 / Tagline）。

## D.1 POJU 主产品宣传文案

### D.1.1 英文版

**长版（Landing / Website）**

> **POJU — Break your deadlock.**
>
> You're stuck between two paths. Friends can't see it clearly. A therapist takes months. A fortune teller charges $300 and gives you nothing to do.
>
> POJU is different. 2,000 years of Eastern wisdom — Daoism, Feng Shui, Bazi, the Five Phases — reinforced by modern science, delivered by an AI Agent that walks with you until the knot unties.
>
> One paid session. $9.99. Infinite depth. Your actions, specific and today. You act. You come back. The path adjusts. Until you move through.
>
> *No accounts. No subscriptions. Never stored.*

**短版（Social bio / Ad headline）**

> The wisdom that costs $300 with a master. Delivered in one conversation. $9.99.
>
> 2,000 years of Eastern wisdom. An AI Agent that walks with you. Actions for today, not predictions for tomorrow.

**极短版（OG / Tagline）**

> Break your deadlock. $9.99.

### D.1.2 中文版

**长版**

> **POJU · 破局**
>
> 你卡在两条路中间。朋友看不清。心理咨询要几个月。命理师收三百美元却什么也让你做不了。
>
> POJU 不一样。两千年的东方智慧——道家、风水、八字、五行——经现代科学印证，由 AI Agent 陪你走完，直到这个结真的解开。
>
> 一次付费 9.9 美元。单一议题。无限深度。给你今天就能做的具体行动。你做了，回来反馈，路径调整。直到你走出这个局。
>
> *不注册，不订阅，不储存。*

**短版**

> 真人命理师收 300 美元的智慧，一次对话交付，9.9 美元。
>
> 两千年东方智慧 + AI Agent 陪伴 + 今天就能做的行动 —— 不是明天的预测。

**极短版**

> 破你的局。9.9 美元。

## D.2 Syncro 宣传文案

### D.2.1 英文版

**长版**

> **Syncro — See how your energy aligns with the space around you.**
>
> Two thousand years ago, Eastern traditions observed that human focus, luck, and outcome shift with direction and timing. Modern science echoes this — magnetic fields affect cognition, spatial orientation shapes decision-making, circadian cycles drive our biology.
>
> Syncro reads your **Bazi** (birth chart), your **location**, and **this exact moment**, then shows you which direction carries what energy — and what to do with it.
>
> Open your phone. The compass finds where you face. The AI reads what that direction holds. Today's negotiations. Tonight's sleep. The seat at the table.
>
> *Always free. Forever.*

**短版**

> See which direction carries your wealth, focus, and rest today — read by AI from 2,000 years of Eastern spatial wisdom.

**极短版**

> Your energy map, in real time.

### D.2.2 中文版

**长版**

> **Syncro · 空间能量场**
>
> 两千年前，东方智慧发现：人的专注、运势、结果，会随着方位和时间的变化而变化。现代科学印证了这一点——磁场影响认知，方位塑造决策，生物节律主导生理状态。
>
> Syncro 读取你的**八字**、你的**位置**、**此时此刻**，然后告诉你每一个方向此刻承载着什么能量，以及你可以怎么用它。
>
> 打开手机。罗盘找到你面朝的方向。AI 读出那个方向藏着什么。今天的谈判。今夜的睡眠。会议桌上你该坐哪。
>
> *永远免费。*

**短版**

> 今天哪个方位利财，哪个利专注，哪个适合休息——由 AI 从两千年空间智慧中为你读出。

**极短版**

> 你的实时能量地图。

## D.3 Oracle 宣传文案

> **文案统一基因**（贯穿所有版本）：
> - 灵性主体：**ancient presence** / **listening presence**（古老倾听存在）
> - 核心仪式语：**A sincere heart opens the channel.**（心诚则灵）
> - 答案形式：**a sign** · **a mysterious card**
> - 数量感：one hundred archetypal patterns · refined over millennia / over a hundred generations
> - AI 角色：clearly a translator, not a replacement

### D.3.1 英文版

**长版**（Landing / Website）

> **Oracle — A 2,000-year practice of sincere questioning.**
>
> Across the East, for two thousand years, people came with a single question, held in silence, carried in a sincere heart. They offered it to an ancient presence — one said to listen to every soul who came with true intent — and waited for an answer that would not arrive in words.
>
> Not a voice. A **sign**. A mysterious card, drawn from one hundred archetypal patterns refined over millennia.
>
> The only requirement was sincerity. **A sincere heart opens the channel.** A real question receives a real sign. A casual one receives nothing of use.
>
> Today, the pattern library is intact. The ritual is intact. An AI reads the card drawn for your exact question and delivers the guidance in language you can act on today.
>
> *One question. One sign. One thing to do.*
>
> Always free. No accounts. Wait 48 hours before asking the same question again — answers need time to settle.

**短版**（Social bio / Ad headline）

> Bring a sincere question to an ancient listening presence. Receive a mysterious card. Act on what it reveals. Free.

**极短版**（OG / Tagline）

> A sincere heart opens the channel.

### D.3.2 中文版

**长版**

> **Oracle · 古老启示**
>
> 两千年来，东方的人们带着一个问题，在静默中走到一个古老的倾听存在面前。他们不求口头的建议，不期待被告知答案。他们献上自己的问题——交给那个被相信会倾听一切真诚灵魂的存在——然后等待一种不同形式的回应。
>
> 不是声音。是**启示（sign）**。一张神秘的卡片，来自一百个经千年沉淀的原型。
>
> 唯一的前提，是虔诚。**心诚则灵。** 真诚的问题得到真的启示；随便一问，只得到杂音。
>
> 今天，这份原型库被完整保留，仪式被完整保留。由 AI 读取为你抽出的卡，用你今天就能行动的语言传达指引。
>
> *一个问题。一个启示。一件今天能做的事。*
>
> 永远免费。不注册。同一问题间隔 48 小时再问——答案需要时间沉淀。

**短版**

> 带着真诚的问题，走向一个古老的倾听存在。收到一张神秘的卡片。按它揭示的去做。免费。

**极短版**

> 心诚则灵。

## D.4 统合 Tagline（Three ways in. One way through.）

整个 POJU 品牌的**北极星文案**（所有营销素材母版）：

### D.4.1 英文

**完整版**

> **Three ways in. One way through.**
>
> Map your energy. Receive a sign. Break your deadlock.
>
> No accounts. No subscriptions. Never stored.
> $9.99 only when you need the deep work.

**单行版**

> Three ways in. One way through. — POJU

### D.4.2 中文

**完整版**

> **三条入口。一条出路。**
>
> 读你的能量场。接收一个启示。破掉你的局。
>
> 不注册。不订阅。不储存。
> 9.9 美元。只在你需要深入时。

**单行版**

> 三条入口，一条出路。— POJU

## D.5 使用指引

这些文案的使用分场合：

| 场合 | 使用版本 |
|---|---|
| Landing Page Hero | POJU 极短版 + Three ways in 完整版 |
| Landing Page 产品卡片 | 各产品短版 |
| App Store 描述 | POJU 长版 + 其他产品短版 |
| Social Media Bio | 对应产品极短版 |
| OG 图 / Meta | 极短版 |
| 广告 Headline | 短版 |
| Press Kit | 长版 |
| 口碑引用 | Three ways in 单行版 |
| PDF 封底 | 极短版 + pojulife.com |

## D.6 禁用文案

以下文案**绝不使用**（违反品牌精神）：

✗ "Unlock your destiny" — 太玄学
✗ "Change your life forever" — 浮夸承诺
✗ "Scientifically proven" — 未经证实的科学声称
✗ "Limited time offer" — 虚假稀缺
✗ "Don't miss out" — FOMO 营销
✗ "Join thousands of users" — 羊群效应
✗ "The #1 AI oracle" — 空泛自夸
✗ "Transform your relationship" — 心灵鸡汤
✗ "The secret the East has been hiding" — 东方主义猎奇

这些都是我们竞品常用的套路，POJU 的克制感就是通过不用这些来建立的。


---
# 附录 E · 待决事项清单

> 本附录列出截至文档 v3.0 完成时仍待决的事项，上线前必须逐一解决。

## D.1 商业决策类

- [ ] **最终产品命名**（Syncro / Oracle 的替换词）
- [ ] **Logo 的"破局"艺术字版本定稿**
- [ ] **支付方案最终选择**（Stripe vs Paddle vs 双方案）
- [ ] **定价是否保持 $9.99**（还是根据市场测试调整）
- [ ] **是否加入"Tip jar"自愿打赏机制**（提升感知价值）

## D.2 技术决策类

- [ ] **电商 API 选型最终确认**
- [ ] **TTS 供应商**（ElevenLabs vs Play.ht vs Murf）
- [ ] **监控方案**（Sentry / PostHog / Mixpanel / 自建）
- [ ] **SMS 服务商选择**（Twilio / Vonage / MessageBird，用于 Syncro 手机分享）
- [ ] **CDN 是否用 Cloudflare 前置 Vercel**

## D.3 内容类

- [ ] **100 签本土化完成**
- [ ] **80+ 独门洞察提炼**
- [ ] **50+ 真实案例整理**
- [ ] **6 份诊断指引撰写**
- [ ] **System Prompt v1 最终版**
- [ ] **落地页科学引用的真实研究确认**
- [ ] **使用方法文案撰写**（Syncro 登录页的"使用方法"部分）
- [ ] **Oracle 登录页文案**
- [ ] **首次用户引导视频 / GIF**

## D.4 合规类

- [ ] **律师起草三套法律文档**（Disclaimer / Privacy / Terms）
- [ ] **POJU 商标申请提交（4 类）**
- [ ] **Syncro / Oracle 新名称查询**
- [ ] **Stripe pre-application 邮件**
- [ ] **Anthropic Zero Data Retention 启用**
- [ ] **DNS SPF/DKIM/DMARC 配置**
- [ ] **Sales Tax 方案确认**

## D.5 设计资产类

- [ ] **POJU Logo 所有尺寸**（16/32/192/512 + Favicon + Apple Touch Icon）
- [ ] **PWA 启动图**（各种尺寸）
- [ ] **社交媒体 OG 图**
- [ ] **落地页主视觉粒子动画**
- [ ] **Oracle 卡片纸张纹理（7 种等级）**
- [ ] **Syncro 粒子 shader 效果调试**
- [ ] **思源字体 / EB Garamond 商业授权确认**
- [ ] **音效资源制作**（7 种音效）

## D.6 运营类

- [ ] **support@pojulife.com 邮箱建立**
- [ ] **首批内测用户名单**（10-100 人）
- [ ] **Product Hunt Hunter 联系**
- [ ] **社交媒体账号注册**（IG / TikTok / Twitter / Reddit）
- [ ] **SEO 关键词研究**
- [ ] **首批 SEO 文章选题**

---
# 文档尾声

## 版本历史

| 版本 | 日期 | 变化 |
|---|---|---|
| v1.0 | 2025 初 | 完整初稿 |
| v2.0 | 2025 中 | 重构聊天交互 + 三互动功能 + PDF 规范 |
| v3.0 | 2026 初 | 产品哲学升级为 Agent；三产品架构；PWA 优先；学理四学科 |
| **v3.0.1** | **2026 初** | **干净合并版。所有 Errata 修订合并入正文；Syncro 新增职业/性别输入 + 纯前端锁定机制 + 8 方位表格渲染格式；四元素品牌叙事加入 Modern Science；新增对外宣传文案附录** |

## 致工程师

如果你是即将开始 POJU 开发的工程师，建议你按以下顺序阅读本文档：

1. **先读第 00 章**（品牌内核）—— 理解你在做的不是一个普通产品
2. **再读第 01 章**（产品全景）—— 理解三产品的关系
3. **然后逐章读 02 / 03 / 03A / 04 章**（三产品规范 + Syncro 学理）—— 建立产品全貌
4. **读第 05 章**（基础设施）—— 理解技术骨架
5. **第 06 章**（前端架构）—— 具体实现参考
6. **第 07-08 章**（UI / 商业）—— 用户可见部分
7. **第 09 章**（合规）—— 上线前必读
8. **第 10 章**（计划）—— 时间与风险
9. **附录 A（System Prompts）** 在对接 AI 时必读
10. **附录 D（对外宣传文案）** 在做营销物料时必读
11. **其他附录按需查阅**

## 致产品人

POJU 不是一个追求"增长黑客"的产品。它追求的是：
- **每一个用户的那一次对话是否有价值**
- **产品的每一个细节是否值得这个价格**
- **十年之后回看，这个产品是否帮到了一些人**

如果你在开发过程中有不确定的决策，回到品牌内核（第 00 章）找答案：

> Ancient Eastern Wisdom, reinforced by modern science, 
> delivered by AI Agent, personalized for you.

只要这句话还在，任何细节都能找到方向。

## 致创始人

这份文档不是产品规格书，是**一份承诺**。

承诺你的用户：不注册、不订阅、不存储、不欺骗。
承诺你的团队：每一个功能都有哲学依据，不是为了 KPI 而做。
承诺你自己：你在做一件值得做十年的事。

---

**POJU**
*Ancient Eastern Wisdom, reinforced by modern science, delivered by AI Agent, personalized for you.*

**pojulife.com**

**CONFIDENTIAL · v3.0.1 · 2026**

✦
