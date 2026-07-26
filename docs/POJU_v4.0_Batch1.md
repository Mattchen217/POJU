# POJU Development Document v4.0

> **版本**: v4.0 (Major Architecture Upgrade)
>
> **基础**: 本文档基于 v3.0.1,但内容【独立完整】,不依赖阅读 v3.0.1
>
> **核心升级**:
> - 三件套从【独立产品】升级为【共享底层引擎的产品矩阵】
> - 引入 11 个本地计算模块(命理推算引擎)
> - POJU 升级为【动态 Agent】(5 Phase 状态机)
> - Glyph 重新设计(计算 + 签文整合)
> - Syncro 新增 AR 任务模式($1.99)
>
> **状态**: 批次 1(序章 + 第 1-3 章)
>
> **后续批次**:
> - 批次 2: 第 4-6 章(Glyph / Syncro / Prompts)
> - 批次 3: 第 7-13 章 + 附录

---

# 序章

## 0.1 v4.0 与 v3.0.1 的关系

```
v3.0.1: 三件套各自独立的 LLM 产品
  POJU = LLM 对话
  Glyph = 出生日期 → LLM
  Syncro = 用户问题 → LLM
  
  问题:
  - LLM 不擅长精确命理推算
  - 三件套数据不互通
  - 个性化深度有限

v4.0: 三件套共享【命理推算引擎】
  POJU = Agent + 计算引擎 + LLM
  Glyph = 计算引擎 + 签文 + LLM
  Syncro = 计算引擎 + 方位 + LLM(部分模式)
  
  优势:
  - LLM 拿到【已计算好的命理状态】
  - 输出质量大幅提升
  - 三件套数据共享
  - 个性化达到真正深度
```

## 0.2 v4.0 核心理念

```
理念 1: 计算与解读分离
  代码层做精确计算(命理推算)
  LLM 层做语义解读(翻译 + 应用)
  
理念 2: 一份数据,三处使用
  User Profile 一次计算
  POJU / Glyph / Syncro 共享
  
理念 3: Agent 不是 Chatbot
  动态判断、状态化、多步骤
  规则层保证一致性,LLM 层保证灵活性
  
理念 4: 透明的边界
  代码计算的结果【确定性输出】
  LLM 解读的内容【明确标注】
  用户始终知道在和什么交互
```

## 0.3 阅读指南

### 给工程师

```
阅读顺序:
  1. 序章(理解升级方向)
  2. 第 1 章(架构总览)
  3. 第 2 章(11 个计算模块接口) ⭐ 重点
  4. 第 3 章(POJU Agent 设计)
  5. 后续批次的具体产品章节
  
重点关注:
  - TypeScript 接口定义
  - 模块间调用关系
  - 数据流向
  - 错误处理
  
注: 命理算法【实现细节】不在本文档
   独立工程负责,本文档仅定义接口
```

### 给产品

```
阅读顺序:
  1. 序章
  2. 第 1 章(产品矩阵)
  3. 第 3 章 3.1-3.2(POJU Agent 哲学)
  4. 后续批次的 Glyph / Syncro 章节
  5. 第 11 章(实施路径)
  
重点关注:
  - 用户体验流程
  - 商业模型
  - 数据收集策略
  - 上线节奏
```

### 给创始人

```
阅读顺序:
  1. 序章 0.1-0.2(战略升级理由)
  2. 第 1 章 1.5(差异化护城河)
  3. 第 11 章(开发路径与时间)
  4. 第 13 章(合规与风险)
  
重点关注:
  - 资源投入规模
  - 关键决策点
  - 风险与机会
```

## 0.4 v4.0 与 v3.0.1 关键变化清单

```
【架构层】
+ 11 个本地计算模块(全新)
+ User Profile 共享存储
+ 三件套调用统一计算引擎

【POJU】
+ 5 Phase 动态 Agent(替代单纯对话)
+ 数据收集硬性 6 项(必需)
+ 规则层 + LLM 层双重判断
+ 话题漂移检测 + 机械拒绝
+ 行动建议生成 + 追踪
+ 30 天活跃期 + 续期 + Archive

【Glyph】
+ 计算结果 + 签文整合给 LLM
- 5 风等级降为 UI 分类(占 5%,从 70% 降)
+ 100 签解读为核心(占 60%)
+ 命理现代化解读(占 20%)
+ 反思引导(占 15%)
+ 每日 1 次免费 + 之后 $1.99

【Syncro】
+ 双模式架构
+ 浏览模式: 免费,本机计算 8 方位
+ AR 任务模式: $1.99,LLM 增强
+ 5 时辰窗口期(9-11 小时)
+ 摄像头 + 罗盘集成

【品牌】
+ 公司主体: pojulife (小写)
+ 产品名: POJU / Glyph / Syncro (保持)
+ Oracle 改名为 Glyph(从 v3.0.1 沿用)

【LLM 策略】
+ 多 LLM 备选(Claude / GPT / Gemini)
+ Transformer 架构叙事
+ Anthropic ZDR(Zero Data Retention)
+ 不绑定单一厂商

【支付】
+ DodoPayments(主,早期)
- Stripe(暂缓,LLC 注册后)

【法律 & 合规】
+ 主体称呼"pojulife"统一
+ AI 技术叙事升级
+ Session 30 天 + 续期机制
+ 5-minute refund window
```

---

# 第 1 章 · v4.0 架构升级总览

## 1.1 三件套关系(v4.0 视角)

```
                ┌────────────────────────────────┐
                │   pojulife (品牌平台)          │
                │   easternos.com                 │
                └──────────────┬─────────────────┘
                               │
                ┌──────────────┼──────────────┐
                ↓              ↓              ↓
          ┌─────────┐    ┌─────────┐    ┌─────────┐
          │  POJU   │    │  Glyph  │    │ Syncro  │
          │ $9.99   │    │ Daily 1 │    │ Free*   │
          │深度对话 │    │free→$1.99│    │ + $1.99 │
          │5-Phase  │    │一次报告 │    │浏览/AR  │
          │ Agent   │    │计算+签文│    │方位分析 │
          └────┬────┘    └────┬────┘    └────┬────┘
               │              │              │
               └──────────────┼──────────────┘
                              ↓
                ┌────────────────────────────────┐
                │ ⭐ 共享底层计算引擎 ⭐         │
                │ 11 个模块                      │
                │                                │
                │ M1: 真太阳时   M7: 格局识别   │
                │ M2: 八字排盘   M8: 神煞标记   │
                │ M3: 十神分析   M9: 刑冲合害   │
                │ M4: 大运/流年  M10: 综合诊断  │
                │ M5: 用神判断   M11: 时机判断  │
                │ M6: 风水方位                  │
                │                                │
                │ 输出: User Profile (诊断书)    │
                │ 给 LLM 用                      │
                └────────────────────────────────┘

核心区别于 v3.0.1:
  ✓ 三件套都【共享底层计算】
  ✓ 不再各自独立调用 LLM
  ✓ User Profile 一次生成,处处可用
```

## 1.2 v4.0 五层架构

```
┌──────────────────────────────────────────────────┐
│ Layer 5: UI 层 (Next.js + React)                │
│                                                  │
│ - 三件套各自的界面                              │
│ - PWA 支持(Syncro AR 必需)                      │
│ - 共享组件 + 多语言                             │
│ - 移动端优先                                    │
└──────────────────────────────────────────────────┘
                        ↑
┌──────────────────────────────────────────────────┐
│ Layer 4: Agent 决策层(产品逻辑)                │
│                                                  │
│ - POJU: 5 Phase 状态机                          │
│ - Glyph: 单次报告生成 + 抽签                    │
│ - Syncro: 浏览模式 / AR 任务模式                │
│ - 共享: 话题漂移检测、滥用检测                  │
│ - 关键: 决定何时调用计算层 / 何时调用 LLM       │
└──────────────────────────────────────────────────┘
                        ↑↓
                  ┌─────┴─────┐
                  ↓           ↓
┌──────────────────────────────────────────────────┐
│ Layer 3: LLM 集成层                             │
│                                                  │
│ - 主力: Anthropic Claude (with ZDR)             │
│ - 备选: OpenAI GPT / Google Gemini              │
│ - 多语言指令注入                                │
│ - Token 监控 + 成本控制                         │
│ - 输入: System Prompt + User Profile + 用户输入│
│ - 输出: 结构化 JSON                             │
└──────────────────────────────────────────────────┘
                        ↑
┌──────────────────────────────────────────────────┐
│ Layer 2: 计算引擎层 ⭐ v4.0 核心新增            │
│                                                  │
│ 11 个独立计算模块:                              │
│ - 输入: 用户基础数据                            │
│ - 输出: 结构化命理诊断                          │
│ - 数据依赖: 节气表、格局表等                    │
│ - 实现: 独立工程,本文档仅定义接口              │
└──────────────────────────────────────────────────┘
                        ↑
┌──────────────────────────────────────────────────┐
│ Layer 1: 数据存储层                             │
│                                                  │
│ - 客户端: IndexedDB(加密 AES-256-GCM)           │
│   - User Profile(共享)                          │
│   - Session 数据(POJU)                          │
│   - 历史记录(Glyph / Syncro)                    │
│ - 服务器: 仅订单凭证 + 设备绑定                 │
│ - LLM API: Anthropic ZDR(零数据保留)            │
└──────────────────────────────────────────────────┘
```

## 1.3 v4.0 数据流向

### 通用数据流(三件套共用前置)

```
[首次使用流程]

用户进入产品(任一)
    ↓
检查 IndexedDB 是否有 User Profile
    ├─ 有 → 复用
    └─ 无 → 收集基础数据 → 调用计算引擎 → 生成 Profile
                                  ↓
                            存到 IndexedDB(加密)

[Profile 共享]

用户在 POJU 创建 Profile
    ↓
切换到 Glyph
    ↓
Glyph 直接复用 Profile(免重复输入)
    ↓
切换到 Syncro
    ↓
Syncro 直接复用 Profile
```

### POJU 数据流

```
[Session 创建]
用户付款 ($9.99)
    ↓
Webhook 验证
    ↓
创建 session_id (UUID)
    ↓
绑定 device_id
    ↓
重定向到 /poju/session/[id]

[Phase 1: WELCOME]
显示欢迎词 + 警示
等待用户提问

[Phase 2: DATA_COLLECTION]
用户首次提问
    ↓
锁定 original_question
    ↓
检查是否已有 User Profile
    ├─ 有 → 进入 Phase 3
    └─ 无 → 显示数据收集表单
              ↓
        用户填写 6 项硬性数据
              ↓
        调用计算引擎(11 模块)
              ↓
        生成 User Profile
              ↓
        进入 Phase 3

[Phase 3: ANALYSIS]
每轮对话:
    用户输入
        ↓
    话题漂移检测(规则层)
        ↓
    滥用检测(规则层)
        ↓
    构建 LLM 输入:
        - System Prompt (Phase 3 指令)
        - User Profile (从 IndexedDB)
        - 对话历史
        - 用户最新输入
        ↓
    调用 Claude API (with ZDR)
        ↓
    解析结构化输出
        ↓
    更新信息槽位
        ↓
    判断是否进入 Phase 4(规则 + LLM 双确认)
        ↓
    返回回复给用户

[Phase 4: ACTION]
LLM 生成 1-3 个行动建议
    ↓
显示给用户
    ↓
等待用户回访

[Phase 5: TRACKING]
用户回访报告进展
    ↓
LLM 评估 + 调整建议
    ↓
循环 Phase 4 ↔ 5
    ↓
用户主动声明"已解决" → RESOLVED
```

### Glyph 数据流

```
用户进入 /glyph
    ↓
检查每日免费额度
    ├─ 剩余 → 免费使用
    └─ 已用 → 引导付费 $1.99
              ↓
        DodoPayments
              ↓
        付款成功 → 继续

[计算阶段]
检查 User Profile
    ├─ 有 → 复用
    └─ 无 → 收集 6 项数据 → 计算 Profile

用户输入当前问题
    ↓
随机抽签(从 100 签中)
    ↓
组装 LLM 输入:
    - System Prompt (Glyph)
    - User Profile (来自计算引擎)
    - 抽到的签文
    - 用户问题
    ↓
单次调用 Claude
    ↓
返回结构化报告:
    - your_pattern (5 风等级,5%)
    - your_glyph (签文核心解读,60%)
    - your_moment (命理现代化,20%)
    - reflection_question (15%)
    ↓
显示给用户 + 存档到 IndexedDB
```

### Syncro 数据流

```
[浏览模式 - 免费]

用户进入 /syncro
    ↓
申请罗盘权限
    ↓
读取设备朝向 + 时间
    ↓
检查 User Profile
    ├─ 有 → 复用
    └─ 无 → 收集 6 项数据 → 计算 Profile

调用计算引擎(模块 6 + 模块 4 简化版)
    ↓
本机计算 8 方位评级
    ↓
显示罗盘 UI
    ↓
2 小时后自动重新计算

(无 LLM 调用)

[AR 任务模式 - $1.99]

用户输入"任务"(预设/自定义)
    ↓
检查支付状态
    ├─ 已付费 → 继续
    └─ 未付费 → DodoPayments → 继续

[计算阶段]
计算未来 5 时辰 × 8 方位 = 40 个组合
    ↓
[LLM 阶段]
组装 LLM 输入:
    - System Prompt (Syncro AR)
    - User Profile
    - 任务描述
    - 40 个方位 × 时辰组合
    ↓
单次调用 Claude (大输出)
    ↓
返回 40 个解读 + 缓存到客户端

[AR 显示]
摄像头开启 + 罗盘
    ↓
当前方位 → 显示对应解读
    ↓
时辰切换 → 自动更新显示当前时辰的方位
    ↓
窗口期结束(5 时辰后)→ 失效
    → 任务切换需重新付费
```

## 1.4 LLM 调用策略

### LLM 厂商选择

```
主力(80% 调用): Anthropic Claude
  模型: claude-sonnet-4-5
  原因:
    ✓ ZDR (Zero Data Retention) 保护用户隐私
    ✓ 中文输出质量最佳
    ✓ 长上下文支持(POJU 多轮)
    ✓ 文学性强(品牌调性匹配)
  成本: ~$3 / 1M input, ~$15 / 1M output

备选(20% 调用): OpenAI / Google
  使用场景:
    - Claude API 故障切换
    - 非敏感任务
    - 后期 Embedding(如有 RAG 需要)
```

### 各产品 LLM 调用预估

```
POJU:
  单 session: 15-30 轮
  每轮: 1 次 Claude
  Token: ~3000 input + ~500 output / 轮
  单 session 成本: $0.30-0.50
  毛利: $9.99 - $0.50 = $9.49 (95%+)

Glyph:
  单次调用 Claude
  Token: ~2000 input + ~1000 output
  单次成本: ~$0.04
  
  毛利:
    免费用户(每日 1 次): -$0.04(成本)
    付费用户($1.99): $1.99 - $0.04 = $1.95 (98%)

Syncro 浏览模式:
  无 LLM 调用
  成本: 0

Syncro AR 模式:
  单次调用 Claude
  Token: ~3000 input + ~3000 output (40 个解读)
  单次成本: ~$0.06
  毛利: $1.99 - $0.06 = $1.93 (97%)
```

### Token 预算管理

```
POJU Session Token 预算:

  软上限: 80K tokens / session
    - 大约 30-50 轮对话
    - 到达 70K 时提示用户:
      "We've explored many angles. Based on what 
       you've shared, you have most of what you 
       need for this decision."

  硬上限: 100K tokens / session
    - 强制结束对话
    - 显示总结 + 行动清单
    - 标记 RESOLVED
    - 不退款(明示在 Terms)

Glyph 单次:
  上限: 5K tokens
  超出: 截断输出

Syncro AR 单次:
  上限: 10K tokens
  超出: 减少方位详细度
```

## 1.5 v4.0 与 v3.0.1 差异化护城河

```
v4.0 真正的竞争壁垒:

护城河 1: 命理计算引擎(代码层)
  - 11 个模块工程化
  - 数据文件需命理师创作
  - 不是 ChatGPT 套壳能复制的

护城河 2: User Profile 共享架构
  - 三件套数据互通
  - 用户体验连贯
  - 切换成本极高

护城河 3: Agent 不是 Chatbot
  - 5 Phase 状态机
  - 数据收集硬性要求
  - 话题约束 + 机械拒绝
  - 工程复杂度高

护城河 4: 隐私架构(本地优先)
  - User Profile 本地存储
  - 对话内容不上服务器
  - ZDR 保护
  - 用户信任

护城河 5: 多语言 + 多 LLM
  - 不绑定单一厂商
  - 5 语言原生支持
  - 全球可达

→ Co-Star 有护城河 1, 4
→ ChatGPT 套壳无任何护城河
→ pojulife 同时具备 5 大护城河
```

## 1.6 技术栈选型

```
前端:
  ✓ Next.js 14 (App Router)
  ✓ TypeScript
  ✓ Tailwind CSS
  ✓ Framer Motion
  ✓ React Three Fiber (Glyph 3D 抽签)
  ✓ Spline (3D 资源)

状态管理:
  ✓ Zustand (轻量适合本项目)

数据层:
  ✓ Dexie.js (IndexedDB 封装)
  ✓ AES-256-GCM (Web Crypto API)
  ✓ FingerprintJS Open Source(设备指纹)

计算引擎(独立工程):
  ✓ TypeScript / Node.js
  ✓ 推荐基础库: lunar-javascript / sxtwl
  ✓ 数据文件: JSON 格式

LLM 集成:
  ✓ Anthropic SDK (主)
  ✓ OpenAI SDK (备)
  ✓ Google Generative AI (备)

PWA(Syncro AR 必需):
  ✓ next-pwa
  ✓ DeviceOrientationEvent API
  ✓ MediaDevices.getUserMedia (摄像头)

支付:
  ✓ DodoPayments (主,早期)
  ✓ Stripe (后期 LLC 后)

i18n:
  ✓ next-intl
  ✓ 5 语言: en / zh / es / fr / de

部署:
  ✓ Vercel (主站 + API)
  ✓ Cloudflare R2 (静态资源,可选)

邮件(后期):
  ✓ Resend + React Email
  ✓ 仅用户主动请求 PDF 时
```

---

# 第 2 章 · 底层计算引擎(11 个模块)

> ⚠️ **重要说明**:
> 本章定义【接口规范】,不展开命理算法实现细节。
> 命理算法实现为【独立工程】,后续单独讨论。
> 本章为 Layer 4(Agent 决策层)和 Layer 3(LLM 层)提供接口契约。

## 2.1 11 个模块概览

```
┌─────────────────────────────────────────────────────┐
│ 输入: 用户基础数据                                  │
│   - birth: { year, month, day, hour, minute }       │
│   - birth_timezone: IANA timezone                   │
│   - birth_location: { lat, lng, city }              │
│   - gender: M / F                                   │
│   - current_location: { lat, lng } (可选)            │
│   - current_time: ISO timestamp                     │
│   - device_orientation?: number (Syncro 用)          │
│   - user_question?: string                          │
└─────────────────────────────────────────────────────┘
                        ↓

模块依赖图:

  [基础数据]
       ↓
   M1: 真太阳时
       ↓
   M2: 八字排盘 ──────┬──────┬──────┐
       ↓              ↓      ↓      ↓
   M3: 十神分析  M8: 神煞  M6: 方位 M11: 时机
       ↓              ↓      ↑      ↑
   M5: 用神判断       │      │      │
       ↓              │      │      │
   M7: 格局识别       │      │      │
       ↓              │      │      │
   M4: 大运/流年 ─────┤      │      │
       ↓              │      │      │
   M9: 刑冲合害 ──────┘      │      │
       ↓                     │      │
   M10: 综合诊断 ⭐ ←────────┘──────┘
       ↓
   [LLM 输入]
```

## 2.2 模块详细规范

### Module 1: 真太阳时校正

```typescript
interface SolarTimeInput {
  birth_datetime: string;        // ISO 8601: "1990-05-15T14:30:00"
  birth_timezone: string;        // IANA: "America/New_York"
  birth_longitude: number;       // 经度: -74.006(西经为负)
}

interface SolarTimeOutput {
  utc: string;                   // ISO: 转 UTC
  beijing_time: string;          // ISO: 转北京时间(UTC+8)
  solar_time_adjusted: string;   // ISO: 真太阳时
  adjustment_minutes: number;    // 调整了多少分钟
  notes: string[];               // 算法说明
}

// 算法核心
/*
  Step 1: birth_datetime + birth_timezone → UTC
  Step 2: UTC → 北京时间 (UTC+8)
  Step 3: 真太阳时调整
          adjustment = 4 × (longitude - 120) minutes
          (东经为正,西经为负)
  Step 4: 真太阳时 = 北京时间 + adjustment
  
  注: MVP 阶段用平太阳时近似
     不考虑时差方程(地球椭圆轨道修正)
     误差范围: ±15 分钟,通常不影响时辰
*/

// 数据依赖: 无(纯计算)

// 边界情况
const SOLAR_TIME_EDGE_CASES = {
  invalid_timezone: 'Throw error with hint to use IANA',
  missing_longitude: 'Use city default longitude from birth_location',
  longitude_out_of_range: 'Reject (-180 to 180)',
};
```

### Module 2: 八字排盘

```typescript
interface BaziInput {
  solar_time_adjusted: string;   // 模块 1 输出
}

interface BaziOutput {
  year: { stem: string; branch: string };   // 例: { stem: "庚", branch: "午" }
  month: { stem: string; branch: string };
  day: { stem: string; branch: string };
  hour: { stem: string; branch: string };
  
  day_master: string;            // 日主天干 = day.stem
  day_master_element: string;    // "wood" | "fire" | "earth" | "metal" | "water"
  
  notes: {
    li_chun_boundary?: boolean;  // 是否在立春边界(年柱)
    jie_qi_boundary?: boolean;   // 是否在节气边界(月柱)
    zi_shi_treatment: string;    // "traditional"(23-1点) | "new"(23+ 算次日)
    confidence: 'high' | 'medium' | 'low';
  };
}

// 算法关键
/*
  年柱: 以立春为界,立春前用上年干支
  月柱: 以节气(立春、惊蛰...)为月首
        地支固定(寅~丑)
        天干按"五虎遁"推算
  日柱: 用基准日(1900-01-01 甲戌)加天数模 60
  时柱: 时辰支按小时确定
        天干按"五鼠遁"推算
*/

// 数据依赖
const BAZI_DATA_DEPENDENCIES = {
  required: [
    'solar_terms.json',      // 节气精确时间表
    'sexagenary_cycle.json', // 60 甲子表
  ],
  optional: [
    'lunar_calendar.json',   // 阴阳历对照(辅助)
  ],
  recommended_libs: [
    'lunar-javascript (https://github.com/6tail/lunar-javascript)',
    'sxtwl (https://github.com/yuangu/sxtwl_cpp)',
  ],
};

// 关键决策点
const BAZI_DECISIONS = {
  zi_shi_rule: 'traditional', // 默认传统派(23-1 子时)
  li_chun_rule: 'precise',    // 精确到立春那一刻
  jie_qi_rule: 'precise',     // 精确到节气那一刻
};
```

### Module 3: 十神分析

```typescript
interface TenGodsInput {
  bazi: BaziOutput;
}

interface TenGodsOutput {
  by_pillar: {
    year: { stem_god: string; hidden_gods: HiddenGod[] };
    month: { stem_god: string; hidden_gods: HiddenGod[] };
    day: { stem_god: null; hidden_gods: HiddenGod[] };  // 日柱天干为日主
    hour: { stem_god: string; hidden_gods: HiddenGod[] };
  };
  
  god_count: {
    "正官": number;
    "七杀": number;
    "正财": number;
    "偏财": number;
    "正印": number;
    "偏印": number;
    "食神": number;
    "伤官": number;
    "比肩": number;
    "劫财": number;
  };
  
  dominant_god: string;          // 出现最多的十神
  god_distribution_balance: 'concentrated' | 'balanced' | 'scattered';
}

interface HiddenGod {
  stem: string;       // 藏干
  god: string;        // 十神
  weight: number;     // 主气(2)/中气(1)/余气(0.5)
}

// 算法核心
/*
  1. 确定日主(day.stem)
  2. 对照其他三柱天干 → 主气十神
  3. 对照地支藏干 → 藏气十神
  
  地支藏干表(主气/中气/余气):
  - 子: 癸(2)
  - 丑: 己(2), 癸(1), 辛(0.5)
  - 寅: 甲(2), 丙(1), 戊(0.5)
  - 卯: 乙(2)
  - 辰: 戊(2), 乙(1), 癸(0.5)
  - 巳: 丙(2), 戊(1), 庚(0.5)
  - 午: 丁(2), 己(1)
  - 未: 己(2), 丁(1), 乙(0.5)
  - 申: 庚(2), 壬(1), 戊(0.5)
  - 酉: 辛(2)
  - 戌: 戊(2), 辛(1), 丁(0.5)
  - 亥: 壬(2), 甲(1)
*/

// 数据依赖
const TEN_GODS_DATA = [
  'stem_branch_relations.json',  // 十神判断规则
  'hidden_stems_table.json',     // 地支藏干表
];
```

### Module 4: 大运 + 流年

```typescript
interface DaYunInput {
  bazi: BaziOutput;
  gender: 'M' | 'F';
  birth_datetime: string;
  current_time: string;
}

interface DaYunOutput {
  start_age: number;             // 起运年龄(浮点)
  start_year: number;            // 起运年份
  
  da_yun_list: DaYun[];          // 完整大运列表(8-10 个)
  
  current_da_yun: {              // 当前大运
    stem: string;
    branch: string;
    age_into: number;            // 已进入第几年(0-9)
    years_remaining: number;
    relation_to_chart: string;   // 简要关系描述
  };
  
  current_year: {                // 流年
    stem: string;
    branch: string;
    year: number;
    relation_to_chart: string;
  };
  
  current_month: {               // 流月
    stem: string;
    branch: string;
    relation_to_chart: string;
  };
  
  next_year: {                   // 下一年(预知用)
    stem: string;
    branch: string;
    year: number;
  };
  
  upcoming_shifts: Shift[];      // 接下来值得注意的转折
}

interface DaYun {
  age_range: [number, number];
  year_range: [number, number];
  stem: string;
  branch: string;
  is_current: boolean;
  is_past: boolean;
  is_future: boolean;
}

interface Shift {
  type: 'da_yun_change' | 'year_change' | 'season_change';
  approximate_date: string;
  description: string;
}

// 算法核心
/*
  起运计算:
  - 阳男阴女 → 顺数(从生日到下一节气)
  - 阴男阳女 → 逆数(从生日到上一节气)
  - 天数差 / 3 = 起运岁
  - 余数: 1 天 = 4 个月,1 时辰 = 10 天
  
  大运排列:
  - 阳男阴女顺,阴男阳女逆
  - 从月柱开始
  - 60 甲子循环
  - 每柱 10 年
  
  流年: 立春切换
  流月: 节气切换
*/

// 数据依赖
const DA_YUN_DATA = [
  'solar_terms.json',
  'sexagenary_cycle.json',
];
```

### Module 5: 用神判断

```typescript
interface YongShenInput {
  bazi: BaziOutput;
  ten_gods: TenGodsOutput;
}

interface YongShenOutput {
  day_master_strength: 
    | 'very_strong' 
    | 'strong' 
    | 'balanced' 
    | 'weak' 
    | 'very_weak';
  
  five_elements_score: {
    wood: number;
    fire: number;
    earth: number;
    metal: number;
    water: number;
  };
  
  primary_yong_shen: string;     // 主用神 (五行)
  secondary_yong_shen?: string;  // 次用神
  ji_shen: string[];             // 忌神(可多个)
  
  method: '扶抑' | '调候' | '通关' | '专旺' | '从格';
  confidence: 'high' | 'medium' | 'low';
  
  reasoning: string;             // 简短说明
  
  notes: {
    seasonal_adjustment: boolean; // 是否考虑了月令调候
    has_disputes: boolean;        // 不同流派可能分歧
    simplified: boolean;          // MVP 是否简化
  };
}

// 算法核心(MVP 简化版)
/*
  Step 1: 五行分值统计
    - 天干: 主气 3 分
    - 地支主气: 2 分
    - 地支中气: 1 分
    - 地支余气: 0.5 分
  
  Step 2: 月令权重加倍
    月支主气在五行中权重 ×2
  
  Step 3: 强弱判断
    - 日主五行得分 >= 总分 60% → 身强
    - 30%-60% → 中和
    - <30% → 身弱
  
  Step 4: 用神选取
    - 身强 → 抑制日主的五行(克我/我泄)
    - 身弱 → 帮助日主的五行(生我/同我)
    - 调候: 冬天日主寒 → 火;夏天日主旺 → 水
  
  注意:
  - MVP 阶段用扶抑+调候
  - 不处理从格、专旺等特殊格
  - 用 confidence 标注置信度
*/

// 数据依赖
const YONG_SHEN_DATA = [
  'yong_shen_rules.json',
];
```

### Module 6: 风水方位(Syncro 专用)

```typescript
interface DirectionsInput {
  yong_shen: YongShenOutput;
  current_time: string;
  current_location?: { lat: number; lng: number };
  device_orientation?: number;   // 0-360 度
  task?: string;                 // AR 模式下的任务
}

interface DirectionsOutput {
  current_hour: {
    branch: string;              // 例: "午"
    element: string;             // 主气五行
    period: string;              // 时段名,如 "11:00-13:00"
  };
  
  ratings: {
    N:  DirectionRating;
    NE: DirectionRating;
    E:  DirectionRating;
    SE: DirectionRating;
    S:  DirectionRating;
    SW: DirectionRating;
    W:  DirectionRating;
    NW: DirectionRating;
  };
  
  current_facing?: string;       // 用户当前对着哪个方位
  
  validity: {
    valid_until: string;         // 时辰结束时间(ISO)
    is_current_zhi_shi: boolean; // 当前是否在子时(跨日)
  };
}

interface DirectionRating {
  base_element: string;          // 该方位的固有五行
  combined_score: number;        // 综合评分(-2 到 +2)
  rating: 
    | 'highly_favorable' 
    | 'supportive' 
    | 'neutral' 
    | 'challenging' 
    | 'oppressive';
  brief_note: string;            // 一句简短说明(中性词汇)
  task_specific?: string;        // 针对 task 的说明(AR 模式)
}

// 算法核心
/*
  8 方位基础五行:
  - 北 (N):   水
  - 东北(NE): 土
  - 东 (E):   木
  - 东南(SE): 木
  - 南 (S):   火
  - 西南(SW): 土
  - 西 (W):   金
  - 西北(NW): 金
  
  评分公式:
  方位评分 = 基础五行 vs 用神(+2/+1/0/-1/-2)
            + 时辰五行加成(0.5-1.5)
            + 任务匹配加成(AR 模式,0-1)
  
  最终分映射 5 级:
  ≥ 1.5: highly_favorable
  ≥ 0.5: supportive
  ≥ -0.5: neutral
  ≥ -1.5: challenging
  < -1.5: oppressive
*/

// 数据依赖
const DIRECTIONS_DATA = [
  'directions_base_elements.json',
  'hour_branch_elements.json',
];
```

### Module 7: 格局识别

```typescript
interface PatternInput {
  bazi: BaziOutput;
  ten_gods: TenGodsOutput;
  yong_shen: YongShenOutput;
}

interface PatternOutput {
  primary_pattern: string;       // 主格,如 "正官格"
  secondary_pattern?: string;    // 辅格,如 "印格佐"
  
  pattern_quality: 'true' | 'broken' | 'mixed';
  
  is_strong: boolean;            // 身强(yong_shen 已有)
  
  characteristics: {
    natural_strengths: string[]; // 性格优势(中性词汇)
    blind_spots: string[];       // 盲点
    decision_tendencies: string[]; // 决策倾向
  };
  
  modern_archetype: string;      // 一句话现代描述
                                 // 例: "Strategic Builder"
  
  notes: {
    confidence: 'high' | 'medium' | 'low';
    has_disputes: boolean;
  };
}

// 数据依赖
const PATTERN_DATA = [
  'patterns.json',  // ⚠️ 30-60 种格局,需命理师创作
];

// patterns.json 文件结构示例
const PATTERNS_SCHEMA = `
{
  "正官格_身强": {
    "characteristics": {
      "natural_strengths": ["disciplined", "reliable", ...],
      "blind_spots": ["may suppress creativity", ...],
      "decision_tendencies": ["prefers structure", ...]
    },
    "modern_archetype": "Strategic Implementer",
    "trigger_conditions": [
      "正官在月令",
      "身强",
      "..."
    ]
  },
  ...
}
`;
```

### Module 8: 神煞标记

```typescript
interface SpiritsInput {
  bazi: BaziOutput;
}

interface SpiritsOutput {
  spirits_found: SpiritMarker[];
  
  by_issue: {                    // 按问题领域分组
    career: string[];
    relationship: string[];
    health: string[];
    wealth: string[];
    family: string[];
    travel: string[];
  };
  
  has_significant_spirits: boolean;
  
  notes: {
    total_count: number;
    relevant_to_question?: string[]; // 与用户当前问题相关的
  };
}

interface SpiritMarker {
  name: string;                  // 例: "桃花"
  modern_label?: string;         // 现代化描述(用于 LLM 翻译)
  location: string;              // 在哪一柱,例: "日支"
  significance: 'major' | 'minor';
  related_issues: string[];      // 涉及的问题领域
}

// 数据依赖
const SPIRITS_DATA = [
  'spirits.json',  // ⚠️ 20-30 种神煞,需命理师创作
];

// 常见神煞清单
const COMMON_SPIRITS = [
  '桃花(咸池)', '驿马', '华盖',
  '天乙贵人', '文昌', '羊刃',
  '孤辰', '寡宿', '红艳',
  '国印', '将星', '亡神',
  // ... 约 20-30 种
];
```

### Module 9: 刑冲合害判断

```typescript
interface RelationsInput {
  bazi: BaziOutput;
  da_yun: DaYunOutput;
  current_time: string;
}

interface RelationsOutput {
  inner_relations: Relation[];   // 命局内部关系
  da_yun_relations: Relation[];  // 大运对命局的影响
  yearly_relations: Relation[];  // 流年对命局/大运
  monthly_relations: Relation[]; // 流月简单分析
  
  overall_pattern: string;       // 综合一句话描述
  
  notes: {
    most_significant: Relation[]; // 最值得注意的 1-3 个
  };
}

interface Relation {
  type: '三合' | '六合' | '三会' | '六冲' | '三刑' | '相穿' | '自刑';
  modern_label?: string;         // 现代描述(LLM 用)
  pillars_involved: string[];    // 哪些柱
  description: string;
  impact_level: 'strong' | 'moderate' | 'weak';
  context: 'inner' | 'da_yun' | 'yearly' | 'monthly';
}

// 算法核心
/*
  地支关系矩阵:
  
  三合: 
    申子辰(水)、寅午戌(火)、亥卯未(木)、巳酉丑(金)
  
  六合: 
    子丑、寅亥、卯戌、辰酉、巳申、午未
  
  三会: 
    寅卯辰(春)、巳午未(夏)、申酉戌(秋)、亥子丑(冬)
  
  六冲: 
    子午、丑未、寅申、卯酉、辰戌、巳亥
  
  三刑: 
    寅巳申、丑戌未、子卯
  
  相穿: 
    子未、丑午、寅巳、卯辰、申亥、酉戌
  
  自刑: 
    辰辰、午午、酉酉、亥亥
  
  矩阵化判断,代码实现简单
*/

// 数据依赖
const RELATIONS_DATA = [
  'zhi_relations.json',
];
```

### Module 10: 综合诊断 ⭐ 最关键

```typescript
interface DiagnosisInput {
  // 上述所有模块的输出
  bazi: BaziOutput;
  ten_gods: TenGodsOutput;
  yong_shen: YongShenOutput;
  pattern: PatternOutput;
  da_yun: DaYunOutput;
  spirits: SpiritsOutput;
  relations: RelationsOutput;
  
  // 上下文
  current_time: string;
  user_question?: string;
  question_type?: string;        // career, relationship, health, etc.
}

interface DiagnosisOutput {
  // === 用户身份层 ===
  identity_summary: {
    archetype: string;           // 现代化原型描述
    natural_pattern: string;     // 一段话: "你是怎样的人"
    growth_direction: string;    // 一段话: "你需要什么"
  };
  
  // === 当前阶段层 ===
  current_phase: {
    overall_state: string;       // 一句话: "支持期但需注意"
    energy_status: {
      personal: 'abundant' | 'balanced' | 'depleted';
      external: 'supportive' | 'neutral' | 'challenging';
      dynamic: 'rising' | 'stable' | 'declining';
    };
    
    favorable_aspects: string[]; // 当前有利因素(3-5 条)
    challenging_aspects: string[]; // 当前压力因素(3-5 条)
    key_themes: string[];        // 当前主题(3-5 条)
  };
  
  // === 时间维度层 ===
  temporal_layer: {
    da_yun_phase: string;        // 大运阶段描述
    year_theme: string;          // 流年主题
    month_focus: string;         // 当月焦点
    upcoming_shifts: string[];   // 接下来的转折
  };
  
  // === 问题相关层(如有用户问题) ===
  question_relevance?: {
    question_type: string;
    relevant_patterns: string[];
    relevant_spirits: string[];
    blind_spots: string[];
    favorable_timings: string[];
    challenging_timings: string[];
    suggested_approach_themes: string[];
  };
  
  // === 给 LLM 的元信息 ===
  meta: {
    confidence: 'high' | 'medium' | 'low';
    simplification_notes: string[];
    suggested_depth: 'shallow' | 'moderate' | 'deep';
    locale_hint?: string;        // 多语言提示
  };
}

// 模块 10 的核心作用
/*
  这个模块是【纯整合层】,不做新的命理推算
  
  作用:
  1. 把 9 个模块的结果整合成一个【LLM 友好】的输出
  2. 用现代语言【翻译】所有命理术语
  3. 标注【哪些有把握、哪些是简化】
  4. 给 LLM 的【输入】,LLM 不需要看原始八字
  
  实现:
  - 模板化转换(不需要 AI)
  - 规则映射(干支 → 现代描述)
  - 简单的优先级判断
*/

// 数据依赖
const DIAGNOSIS_DATA = [
  'terminology_translations.json', // ⚠️ 命理术语 → 现代描述
];

// terminology_translations.json 示例
const TERMINOLOGY_SCHEMA = `
{
  "正官格": {
    "modern_archetype": "Strategic Implementer",
    "natural_pattern": "Someone who thrives within clear structures...",
    "growth_direction": "Learning to embrace what cannot be controlled..."
  },
  "身弱": {
    "energy_label": "depleted",
    "description": "Tends to draw energy from environment..."
  },
  "丙午年": {
    "year_theme": "External recognition and structural advancement",
    "energy_color": "rising"
  },
  ...
}
`;
```

### Module 11: 时机判断

```typescript
interface TimingInput {
  bazi: BaziOutput;
  da_yun: DaYunOutput;
  yong_shen: YongShenOutput;
  current_time: string;
  target_time_range?: {          // 用户问"什么时候"
    start: string;
    end: string;
  };
  task?: string;                 // 任务描述
}

interface TimingOutput {
  immediate_window: {            // 当前 24 小时
    best_hours: TimeWindow[];
    avoid_hours: TimeWindow[];
    overall_quality: 'favorable' | 'neutral' | 'challenging';
  };
  
  week_view: {                   // 未来 7 天
    favorable_days: DayWindow[];
    challenging_days: DayWindow[];
  };
  
  month_view: {                  // 未来 30 天
    key_periods: PeriodWindow[];
  };
  
  big_picture?: string;          // 如有 target_time_range
}

interface TimeWindow {
  start: string;
  end: string;
  branch: string;
  rating: number;
  reason: string;
}

interface DayWindow {
  date: string;
  rating: number;
  reason: string;
  best_hours?: string[];
}

interface PeriodWindow {
  start: string;
  end: string;
  theme: string;
  intensity: number;
}

// 算法核心
/*
  对每个时辰/天/周:
  1. 计算其干支
  2. 与命局计算关系(刑冲合害)
  3. 与用神计算匹配度
  4. 综合评分
  
  输出:
  - 评分高的 → 有利
  - 评分低的 → 不利
  - 中等 → 中性
*/
```

## 2.3 模块调用关系

### 通用调用顺序

```
[Step 1: 基础链]
  M1 (真太阳时)
    ↓
  M2 (八字)
    ↓
  M3 (十神)
    ↓
  M5 (用神)
    ↓
  M7 (格局)

[Step 2: 时间维度]
  M4 (大运 + 流年)

[Step 3: 深化分析]
  M8 (神煞)
  M9 (刑冲合害)

[Step 4: 综合]
  M10 (综合诊断) ← 输出给 LLM
```

### 各产品的调用模式

```
POJU 创建 Profile:
  M1 → M2 → M3 → M5 → M7 → M4 → M8 → M9 → M10
  
  + 用户问时间:
  M11 (时机判断)

Glyph 单次报告:
  M1 → M2 → M3 → M5 → M7 → M4 → M8 → M9 → M10
  
  (不需要 M6, M11)

Syncro 浏览模式:
  M1 → M2 → M3 → M5 → M4 (简化版)
    ↓
  M6 (方位) ← 主要

Syncro AR 任务模式:
  M1 → M2 → M3 → M5 → M4 (简化版)
    ↓
  M6 (方位) × 5 时辰
    ↓
  M11 (时机判断)
    ↓
  组合 40 个解读给 LLM
```

## 2.4 综合诊断输出示例

```json
{
  "identity_summary": {
    "archetype": "Strategic Builder",
    "natural_pattern": "You're someone who thrives when there are clear structures to work within. You have natural authority that comes from consistency rather than charisma. You're at your best when given a defined challenge with measurable outcomes, less so in ambiguous creative spaces.",
    "growth_direction": "Your growth comes from learning to embrace what you can't control. You tend to over-rely on planning and may benefit from periods of intentional non-action."
  },
  
  "current_phase": {
    "overall_state": "Supportive period with attention to inner reserves",
    "energy_status": {
      "personal": "depleted",
      "external": "supportive",
      "dynamic": "rising"
    },
    "favorable_aspects": [
      "External recognition opportunities are aligning",
      "Authority figures are likely to notice your work",
      "The structures you've built are starting to show results"
    ],
    "challenging_aspects": [
      "Your inner reserves feel stretched",
      "Easy to over-commit during this favorable window",
      "Subtle interpersonal friction may surface"
    ],
    "key_themes": [
      "Pace yourself during opportunity",
      "Choose visibility carefully",
      "Restore before pushing further"
    ]
  },
  
  "temporal_layer": {
    "da_yun_phase": "You're in the 6th year of a 10-year cycle that supports your growth but tests your discipline",
    "year_theme": "External recognition and structural advancement",
    "month_focus": "Recovery and quiet reflection",
    "upcoming_shifts": [
      "A turning point is approaching in 3-4 months",
      "Next year's energy supports decisive action"
    ]
  },
  
  "question_relevance": {
    "question_type": "career",
    "relevant_patterns": [
      "Your structural strength suggests roles where you implement rather than originate",
      "Current period favors accepting authority rather than creating new ventures"
    ],
    "blind_spots": [
      "You may underestimate how much this opportunity aligns with your natural pattern",
      "Watch for over-thinking when the answer is to act"
    ],
    "favorable_timings": [
      "Within next 30 days",
      "Especially mornings"
    ],
    "challenging_timings": [
      "Avoid major commitments during week of XX-XX"
    ],
    "suggested_approach_themes": [
      "Accept rather than negotiate aggressively",
      "Lead by following first",
      "Establish presence before establishing terms"
    ]
  },
  
  "meta": {
    "confidence": "medium",
    "simplification_notes": [
      "Yong shen analysis uses simplified extension method",
      "Spirit relationships limited to top 10 most relevant"
    ],
    "suggested_depth": "moderate",
    "locale_hint": "en"
  }
}
```

LLM 拿到这个 JSON,**不需要做任何命理推算**,只需要:
1. 用对应语言重新组织输出
2. 与用户问题结合
3. 生成自然对话内容

## 2.5 数据文件依赖清单

```
计算引擎需要的数据文件(独立工程提供):

📁 /data/calculations/

├── solar_terms.json
│   节气精确时间表(1900-2100)
│   每年 24 节气,精确到秒
│   无需命理师
│   
├── lunar_calendar.json
│   阴阳历对照表
│   无需命理师
│   
├── sexagenary_cycle.json
│   60 甲子表
│   无需命理师
│   
├── stem_branch_relations.json
│   - 天干地支基础属性
│   - 五行生克
│   无需命理师
│   
├── hidden_stems_table.json
│   地支藏干表(主气/中气/余气)
│   无需命理师
│   
├── ten_gods_rules.json
│   十神判断规则表
│   无需命理师
│   
├── zhi_relations.json
│   刑冲合害规则
│   无需命理师
│   
├── directions_base_elements.json
│   8 方位基础五行
│   无需命理师
│   
├── hour_branch_elements.json
│   时辰对应五行
│   无需命理师
│   
├── yong_shen_rules.json
│   用神判断规则(MVP 简化版)
│   建议命理师审核
│   
├── patterns.json ⚠️ 命理师创作
│   30-60 种格局解读
│   每个格局: characteristics + modern_archetype
│   工作量: 30-60 小时
│   
├── spirits.json ⚠️ 命理师创作
│   20-30 种神煞规则 + 解读
│   每个神煞: trigger + lookup + modern_meaning
│   工作量: 20-30 小时
│   
└── terminology_translations.json ⚠️ 关键
    命理术语 → 现代描述映射
    用于综合诊断输出
    工作量: 50-100 小时(命理师 + 翻译师)

⚠️ 标记: 需要命理师 + 翻译师配合创作
```

## 2.6 计算引擎 API

### 主入口 API

```typescript
import { calculateProfile } from '@/lib/calculations';

// 完整计算(创建 Profile 时用)
const profile = await calculateProfile({
  birth: {
    year: 1990,
    month: 5,
    day: 15,
    hour: 14,
    minute: 30,
    timezone: 'America/New_York',
    longitude: -74.006,
    latitude: 40.7128,
  },
  gender: 'M',
  current: {
    timestamp: new Date().toISOString(),
    location: { lat: 40.7128, lng: -74.006 },
    facing: 90, // 度,可选
  },
  user_context: {
    question: "Should I take this job offer?",
    question_type: "career",
  },
});

// profile 包含所有 11 个模块的结果
// 但 LLM 只用 profile.diagnosis(模块 10)
```

### 独立模块 API

```typescript
import {
  calculateBazi,
  calculateDaYun,
  calculateDirections,
  // ... 其他模块
} from '@/lib/calculations';

// 单独调用某个模块(高级用法)
const bazi = await calculateBazi({
  solar_time_adjusted: '1990-05-15T14:42:00+08:00',
});

const directions = await calculateDirections({
  yong_shen: yongShenResult,
  current_time: new Date().toISOString(),
  device_orientation: 90,
});
```

### 缓存策略

```typescript
import { getCachedProfile, refreshTimeProfile } from '@/lib/calculations';

// 缓存逻辑:
// - 出生信息固定 → 模块 1, 2, 3, 5, 7, 8 结果可永久缓存
// - 当前时间变化 → 模块 4, 9, 10, 11 需要重新计算
// - 方位变化 → 模块 6 需要重新计算

// 实现:
// IndexedDB 中存 birth_profile (永久,直到用户更新出生信息)
// 每次会话开始 + 时辰切换时重算 time_profile

// 缓存键
const CACHE_KEYS = {
  birth_profile: `birth_profile_${device_id}`,
  time_profile: `time_profile_${device_id}_${current_hour}`,
  direction_profile: `direction_profile_${device_id}_${current_hour}`,
};

// 使用示例
async function getProfileWithCache(input) {
  let birthProfile = await getCachedProfile('birth', device_id);
  
  if (!birthProfile) {
    birthProfile = await calculateBirthProfile(input);
    await saveCachedProfile('birth', device_id, birthProfile);
  }
  
  // 时间敏感部分总是重算
  const timeProfile = await calculateTimeProfile({
    bazi: birthProfile.bazi,
    current_time: input.current.timestamp,
  });
  
  // 综合诊断
  const diagnosis = await calculateDiagnosis({
    ...birthProfile,
    ...timeProfile,
    user_context: input.user_context,
  });
  
  return { ...birthProfile, ...timeProfile, diagnosis };
}
```

### 错误处理

```typescript
// 错误类型
class CalculationError extends Error {
  constructor(
    message: string,
    public module: string,
    public code: string,
    public severity: 'fatal' | 'warning' | 'info'
  ) {
    super(message);
  }
}

// 错误码
const ERROR_CODES = {
  M1_INVALID_TIMEZONE: 'Invalid IANA timezone',
  M2_LICHUN_BOUNDARY: 'Birth date too close to li chun boundary, year may be ambiguous',
  M2_ZISHI_BOUNDARY: 'Birth at exactly 23:00, zi shi rule applied',
  M5_INSUFFICIENT_DATA: 'Cannot determine yong shen with confidence',
  M6_NO_LOCATION: 'Location not provided, using IP-based fallback',
  M11_OUT_OF_RANGE: 'Target time range exceeds calculation horizon',
};

// 优雅降级
async function calculateProfileWithFallback(input) {
  try {
    return await calculateProfile(input);
  } catch (error) {
    if (error instanceof CalculationError && error.severity === 'warning') {
      // 警告级别:继续但标注
      const partial = await calculatePartialProfile(input);
      partial.diagnosis.meta.confidence = 'low';
      partial.diagnosis.meta.warnings = [error.message];
      return partial;
    }
    throw error; // Fatal 上抛
  }
}
```

---

# 第 3 章 · POJU 动态 Agent

## 3.1 Agent 设计哲学

### 核心原则

```
原则 1: 数据驱动决策
  Agent 不基于用户【说了什么】判断
  Agent 基于【已收集的数据】判断
  
  例:
  ❌ 用户说"给我建议" → 立即给建议
  ✓ 用户说"给我建议" → 检查数据是否完整 → 不完整则继续问

原则 2: 硬性规则 + LLM 灵活
  规则层(确定性):
  - 数据未完整 → 不能给建议
  - 话题漂移 → 拒绝
  - 滥用 → 机械拒绝
  
  LLM 层(灵活性):
  - 如何提问
  - 如何解读
  - 如何给建议
  
  分工明确:
  规则保证【一致性】
  LLM 保证【智能性】

原则 3: 透明的限制
  Agent 不【伪装智能】
  不知道就说不知道
  数据缺失就说缺失
  
  例:
  ❌ 用户拒绝提供生日 → AI 编造一个分析
  ✓ 用户拒绝提供生日 → AI 明确说"我无法做精准分析"

原则 4: 用户主权
  Agent 提供视角,不替代决策
  Agent 提供建议,不强制执行
  Agent 追踪进展,不催促
  
  最终决定永远是用户的
```

### Agent 与 Chatbot 的区别

```
Chatbot(传统):
  用户输入 → LLM 处理 → 输出
  
  特点:
  - 无状态
  - 无记忆
  - 无判断
  - 无目标导向

POJU Agent:
  用户输入
    ↓
  状态机判断 (Phase + Data)
    ↓
  规则层过滤 (话题/滥用)
    ↓
  数据层查询 (Profile + 历史)
    ↓
  LLM 调用 (注入完整上下文)
    ↓
  输出解析 (结构化 JSON)
    ↓
  状态更新 (Phase 推进、行动添加)
    ↓
  持久化 (IndexedDB)
    ↓
  返回用户
  
  特点:
  - 多状态、多步骤、多判断
  - 目标导向(Phase 1 → 5)
  - 记忆完整(对话 + 行动)
  - 主动判断(进度/异常)
```

## 3.2 5 Phase 状态机

### Phase 概览

```
Phase 1: WELCOME (欢迎)
  目标: 显示欢迎词,引导用户开始
  入: Session 创建
  出: 用户提交了第一个问题
  
Phase 2: DATA_COLLECTION (数据收集)
  目标: 收集用户必需的 6 项基础数据
  入: 用户首次提问
  出: 数据全部收集完成 + Profile 生成
  
Phase 3: ANALYSIS (分析对话)
  目标: 通过对话深入理解用户处境
  入: 数据收集完成
  出: 信息足够给出行动建议
  
Phase 4: ACTION (行动建议)
  目标: 给出具体可执行的行动建议
  入: 分析阶段告一段落
  出: 用户接受建议并开始执行
  
Phase 5: TRACKING (追踪 + 调整)
  目标: 用户行动后,接受反馈,调整方向
  入: 用户回来报告进展
  出: 多次循环 Phase 4↔5,直到 Resolved

特殊状态:
  RESOLVED: 用户主动声明问题已解决
  SUSPENDED: 用户暂停 session(后续可继续)
  ARCHIVED: 30 天活跃期结束,自动归档
```

### Phase 转换规则

```
Phase 1 → Phase 2:
  触发: 用户输入第一句话(任何内容)
  条件: 无
  动作:
    - 锁定 original_question(后续话题约束基础)
    - 提取话题关键词
    - 进入数据收集

Phase 2 → Phase 3:
  触发: 数据收集完成
  条件: 6 项硬性数据全部齐备
  动作:
    - 调用 11 个计算模块
    - 生成 user_profile(综合诊断)
    - 注入 LLM 上下文
    - 显示"基础信息已收集,开始深入分析"
  
  备选: 用户拒绝提供数据
    → 进入 SUSPENDED
    → 提示退款选项

Phase 3 → Phase 4:
  触发(规则层):
    - 对话轮次 >= 5
    - 信息槽位填满 ≥ 3 个关键槽
  触发(LLM 层):
    - LLM 输出 phase_should_advance: true
  条件: 规则 + LLM 双重确认
  动作:
    - 调用 LLM 生成行动建议
    - 创建 actions 列表
    - 显示"基于我们的对话,我建议..."

Phase 4 → Phase 5:
  触发: 用户接受建议(或修改后接受)
  条件: 至少 1 个 action 被标记为 active
  动作:
    - 进入追踪状态
    - Session 显示"等待你的反馈"

Phase 5 → Phase 4(循环):
  触发: 用户回来报告进展
  条件: 用户说"我做了 X / 我没做 X / 我修改成了 Y"
  动作:
    - 更新 actions 状态
    - LLM 评估进展
    - 生成新一轮行动建议

Phase 5 → RESOLVED:
  触发: 用户明确说"问题解决了" / "不需要再深入了"
  条件: LLM 确认是真的 resolution(而非放弃)
  动作:
    - 生成 session 总结
    - 询问用户满意度
    - 标记 session 为 resolved
```

### Phase 状态数据

```typescript
interface SessionState {
  session_id: string;
  device_id: string;
  payment_id: string;
  
  current_phase: 1 | 2 | 3 | 4 | 5 | 'RESOLVED' | 'SUSPENDED' | 'ARCHIVED';
  
  // Phase 1 -> 2 数据
  original_question: string;
  original_topic_keywords: string[];
  question_locked_at: Date;
  
  // Phase 2 数据收集状态
  data_collection: DataCollectionState;
  
  // Phase 3 信息槽位(LLM 填)
  information_slots: Record<string, any>;
  
  // 计算结果
  user_profile?: DiagnosisOutput;  // 来自计算引擎
  
  // Phase 4 行动列表
  actions: Action[];
  
  // 对话历史
  messages: Message[];
  
  // 监控
  abuse_metrics: AbuseMetrics;
  
  // 时间
  created_at: Date;
  last_interaction_at: Date;
  expires_at: Date;
}

interface DataCollectionState {
  required: {
    birth_year: number | null;
    birth_month: number | null;
    birth_day: number | null;
    birth_hour: number | null;
    birth_minute: number | null;
    birth_location: { city: string; lat: number; lng: number } | null;
    gender: 'M' | 'F' | null;
    current_location: { lat: number; lng: number } | null;
  };
  optional: {
    others_birth_year?: number;
    scenario_description?: string;
  };
  completed: boolean;
  refused: boolean;
  refusal_count: number;
}

interface Action {
  action_id: string;
  given_at: Date;
  text: string;
  category: 'immediate' | 'this_week' | 'ongoing';
  status: 'pending' | 'completed' | 'modified' | 'skipped';
  user_feedback?: string;
  rationale?: string;  // 为什么这个行动适合用户
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  phase: number;
  is_rejected: boolean;
  rejection_reason?: 'topic_drift' | 'abuse' | 'data_required';
  tokens_used?: number;
}

interface AbuseMetrics {
  drift_attempts: number;
  abuse_attempts: number;
  consecutive_drifts: number;
  total_tokens_used: number;
}
```

## 3.3 数据收集流程(Phase 2)

### 收集策略

```
用户首次提问后,Agent 进入 Phase 2

Step 1: 锁定话题
  从用户问题中提取关键词
  锁定为 original_topic
  后续严格围绕此话题

Step 2: 一次性请求所有硬性数据
  显示一个【结构化输入界面】
  不是对话式问答(避免多轮)
  
  界面示例:
  ┌────────────────────────────────────────┐
  │ Before we go deeper, I need some       │
  │ basics:                                │
  │                                        │
  │ 📅 Birth date: [Year] [Month] [Day]   │
  │ 🕐 Birth time: [Hour] [Minute]        │
  │ 📍 Birth city: [Search/Select]        │
  │ 👤 Gender: [Male / Female]            │
  │ 🌍 Current city: [Auto-detect/Manual] │
  │                                        │
  │ Why? POJU's analysis depends on your   │
  │ specific patterns, not generic         │
  │ frameworks. This information stays on  │
  │ your device only.                      │
  │                                        │
  │ [Continue]                             │
  └────────────────────────────────────────┘

Step 3: 数据验证
  提交后验证:
  - 日期合理(不在未来/不太古老)
  - 时辰合理(0-23)
  - 经纬度合理
  - 必填项不空
  
  失败 → 提示错误

Step 4: 计算 Profile
  调用计算引擎(11 个模块全部)
  生成 user_profile
  缓存到 IndexedDB

Step 5: 进入 Phase 3
  显示:"Got it. Let's dive into your question..."
  开始分析对话
```

### 用户拒绝提供数据的处理

```
场景 1: 用户跳过表单
触发: 表单上有"Skip" 按钮被点击

Agent 响应:
  "POJU's depth comes from understanding YOUR specific 
   patterns. Without your birth information, I can only 
   offer generic perspectives.
   
   Some users prefer this. Others want the personalized 
   analysis. Either is fine.
   
   How would you like to proceed?
   
   [Provide my info for personalized analysis]
   [Continue with generic perspectives]
   [End session and request refund]"

如果选 "generic":
  - Phase 跳到 3
  - System Prompt 加入 "User declined personal data"
  - LLM 输出会更通用
  - 不调用计算引擎
  - 用户体验下降但仍可用

如果选 "refund":
  - Session 标记为 refund_requested
  - 跳转到退款流程
```

```
场景 2: 用户在收集中途反复挑战

Agent 第 1 次解释:
  "These details enable specific analysis. Could you 
   provide them?"

Agent 第 2 次(用户继续追问):
  "POJU works by analyzing your specific patterns. 
   Without your data, my responses become generic — 
   essentially the same as what ChatGPT would give you. 
   You paid for personalization, so let's enable it."

Agent 第 3 次(仍拒绝):
  "I understand you have concerns. I'll respect your 
   choice.
   
   Continuing without your data:
   [Yes, generic analysis is fine]
   [No, end session for refund]"

→ 不超过 3 次解释
→ 给明确选择
→ 不勉强
```

### 可选数据的处理

```
某些问题类型需要可选数据:

问题类型 A: 涉及他人
触发: LLM 判断用户问题涉及具体某人
例: "我和老板的冲突如何化解"

Agent 响应(在 Phase 3 中):
  "To analyze the dynamic between you and your boss, 
   knowing your boss's birth year would help. It's 
   optional, but useful.
   
   Do you know it?
   
   [Yes, it's: ____]
   [I don't know]
   [Skip]"

→ 用户提供 → 调用模块 9 查刑冲合害
→ 用户跳过 → LLM 输出说"based on your patterns alone"

问题类型 B: 涉及具体场景
触发: 问题涉及空间/时间细节

Agent:
  "Could you describe the situation a bit more?
   - When did this start?
   - Where does it usually happen?"

→ 自然对话式收集
```

## 3.4 LLM 决策逻辑

### LLM 输出格式(强制结构化)

```typescript
// LLM 必须输出此格式的 JSON
interface LLMResponse {
  // 给用户看的回复(自然语言)
  response: string;
  
  // Phase 转换决策
  phase_should_advance: boolean;
  next_phase?: 3 | 4 | 5 | 'RESOLVED';
  
  // 信息槽位提取
  new_information_slots?: Record<string, any>;
  
  // 数据完整性判断
  data_sufficient_for_action?: boolean;
  data_gaps?: string[];  // 如不充分,缺什么
  
  // 行动建议(仅 Phase 4)
  action_items?: ActionItem[];
  
  // 边界检测(LLM 自检)
  is_topic_drift: boolean;
  is_abuse: boolean;
  
  // 元信息
  conversation_quality: 'productive' | 'circling' | 'stalled';
  user_emotional_state?: string;  // 内部参考,不显示
  
  // 是否建议调用其他工具
  suggest_glyph?: boolean;
  suggest_syncro?: boolean;
}

interface ActionItem {
  text: string;
  category: 'immediate' | 'this_week' | 'ongoing';
  rationale: string;  // 为什么这个行动适合
}
```

### 双重判断:规则 + LLM

```
对于关键决策,采用双重判断:

判断 1: 是否进入 Phase 3?
  规则层:
    if (data_collection.completed) → 允许
    else → 不允许
  
  LLM 层:
    输出 phase_should_advance
  
  最终决定:
    规则层是【硬约束】(优先)
    LLM 层是【软建议】(参考)

判断 2: 是否给行动建议?
  规则层:
    if (phase === 3 && messages.length >= 5) → 允许评估
  
  LLM 层:
    输出 data_sufficient_for_action
  
  最终决定:
    规则 AND LLM 都说 yes → 进入 Phase 4
    任一说 no → 继续 Phase 3

判断 3: 是否 Resolved?
  规则层:
    if (用户明确说"解决了") → 允许评估
  
  LLM 层:
    判断是真 resolution 还是放弃
  
  最终决定:
    LLM 判断为主(因为需要语义理解)
    但规则层做 fallback
```

### LLM 调用流程

```typescript
async function pojuAgent(
  session: SessionState,
  userInput: string
): Promise<AgentResponse> {
  
  // ============= Step 1: 规则层 (不调 LLM) =============
  
  // 1a. 输入长度检查
  if (userInput.length > 2000) {
    return mechanicalReject('TOO_LONG', session);
  }
  
  // 1b. 话题漂移检测(规则层)
  if (session.current_phase >= 2) {
    const driftResult = detectTopicDrift(userInput, session);
    
    if (driftResult.is_drift && driftResult.confidence > 0.7) {
      session.abuse_metrics.consecutive_drifts++;
      return mechanicalReject('TOPIC_DRIFT', session);
    }
  }
  
  // 1c. 滥用检测
  const abuseResult = detectAbuse(userInput, session);
  if (abuseResult.is_abuse) {
    session.abuse_metrics.abuse_attempts++;
    return mechanicalReject('ABUSE', session, abuseResult.type);
  }
  
  // 1d. Token 预算检查
  if (session.abuse_metrics.total_tokens_used > 100000) {
    return forceResolution(session);
  }
  
  // ============= Step 2: LLM 层 (调用 Claude) =============
  
  // 2a. 构建 System Prompt
  const systemPrompt = buildSystemPrompt({
    role: ROLE_DEFINITION,
    flowRules: FLOW_RULES,
    currentPhase: session.current_phase,
    phaseInstructions: PHASE_INSTRUCTIONS[session.current_phase],
    informationSlots: session.information_slots,
    originalQuestion: session.original_question,
    languageDirective: getLanguageDirective(session.locale),
    userProfile: session.user_profile,  // 命理诊断书
  });
  
  // 2b. 构建对话历史
  const messages = session.messages
    .filter(m => !m.is_rejected)  // 不传机械拒绝消息
    .map(m => ({ role: m.role, content: m.content }));
  
  messages.push({ role: 'user', content: userInput });
  
  // 2c. 调用 Claude
  const llmResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: systemPrompt,
    messages: messages,
  });
  
  // ============= Step 3: 解析 LLM 输出 =============
  
  const parsed = parseStructuredOutput(llmResponse);
  
  // ============= Step 4: 二次审查 =============
  
  if (parsed.is_topic_drift || parsed.is_abuse) {
    return mechanicalReject(
      parsed.is_topic_drift ? 'TOPIC_DRIFT' : 'ABUSE',
      session
    );
  }
  
  // ============= Step 5: 状态更新 =============
  
  // 更新信息槽位
  if (parsed.new_information_slots) {
    Object.assign(
      session.information_slots,
      parsed.new_information_slots
    );
  }
  
  // 推进 Phase(双重确认)
  if (parsed.phase_should_advance && canAdvancePhase(session, parsed.next_phase)) {
    session.current_phase = parsed.next_phase;
  }
  
  // 添加行动项
  if (parsed.action_items && session.current_phase === 4) {
    session.actions.push(...parsed.action_items.map(a => ({
      action_id: uuid(),
      given_at: new Date(),
      text: a.text,
      category: a.category,
      rationale: a.rationale,
      status: 'pending'
    })));
  }
  
  // 更新对话历史
  session.messages.push(
    { 
      role: 'user', 
      content: userInput, 
      timestamp: new Date(), 
      phase: session.current_phase, 
      is_rejected: false 
    },
    { 
      role: 'assistant', 
      content: parsed.response, 
      timestamp: new Date(), 
      phase: session.current_phase, 
      is_rejected: false 
    }
  );
  
  // 更新 Token 计数
  session.abuse_metrics.total_tokens_used += llmResponse.usage.total_tokens;
  
  // 持久化(加密到 IndexedDB)
  await saveSessionEncrypted(session);
  
  // ============= Step 6: 返回结果 =============
  
  return {
    response: parsed.response,
    phase: session.current_phase,
    actions: session.actions,
    suggestions: {
      try_glyph: parsed.suggest_glyph || false,
      try_syncro: parsed.suggest_syncro || false,
    },
  };
}
```

## 3.5 话题约束 + 拒绝机制

### 话题漂移检测(规则层)

```typescript
function detectTopicDrift(
  userInput: string,
  session: SessionState
): { is_drift: boolean; confidence: number } {
  
  // 第 1 层: 关键词重叠
  const inputKeywords = extractKeywords(userInput);
  const overlap = inputKeywords.filter(k =>
    session.original_topic_keywords.some(ok =>
      areSemanticallyRelated(k, ok)
    )
  ).length;
  
  const overlap_ratio = overlap / inputKeywords.length;
  
  // 第 2 层: 强信号词检测
  const strong_drift_signals = [
    "by the way",
    "another thing",
    "different question",
    "while we're at it",
    "顺便问",
    "另外",
    "换个话题",
  ];
  
  const has_strong_signal = strong_drift_signals.some(s =>
    userInput.toLowerCase().includes(s)
  );
  
  // 综合判断
  if (has_strong_signal && overlap_ratio < 0.3) {
    return { is_drift: true, confidence: 0.95 };
  }
  
  if (overlap_ratio < 0.15 && inputKeywords.length > 5) {
    return { is_drift: true, confidence: 0.7 };
  }
  
  if (overlap_ratio > 0.5) {
    return { is_drift: false, confidence: 0.9 };
  }
  
  // 边界情况 → 让 LLM 判断
  return { is_drift: false, confidence: 0.4 };
}
```

### 滥用检测(规则层)

```typescript
function detectAbuse(
  userInput: string,
  session: SessionState
): { is_abuse: boolean; type?: string } {
  
  // 类型 1: 输入过长
  if (userInput.length > 2000) {
    return { is_abuse: true, type: 'too_long' };
  }
  
  // 类型 2: Jailbreak 尝试
  const jailbreak_patterns = [
    "pretend you are",
    "ignore your instructions",
    "你不是 POJU",
    "假装你是",
    "forget the rules",
    "忽略前面的设定",
    "act as if",
    "system prompt",
  ];
  
  if (jailbreak_patterns.some(p =>
    userInput.toLowerCase().includes(p)
  )) {
    return { is_abuse: true, type: 'jailbreak' };
  }
  
  // 类型 3: 重复问题(疑似 spam)
  const lastUserMessages = session.messages
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => m.content);
  
  if (lastUserMessages.filter(m => m === userInput).length >= 2) {
    return { is_abuse: true, type: 'repetition' };
  }
  
  // 类型 4: 连续漂移
  if (session.abuse_metrics.consecutive_drifts >= 3) {
    return { is_abuse: true, type: 'persistent_drift' };
  }
  
  return { is_abuse: false };
}
```

### 机械拒绝词库

```typescript
const REJECTION_TEMPLATES = {
  topic_drift_first: 
    "This appears to be a different topic from your original "
    + "question about [{original_topic}]. POJU sessions are "
    + "focused on a single question to maintain depth. To "
    + "discuss this, please end this session and start a new one.",
  
  topic_drift_repeated:
    "I notice we keep moving away from your original question. "
    + "POJU is designed for depth on one question. Let's return "
    + "to: \"{original_question}\"",
  
  topic_drift_persistent:
    "Multiple off-topic attempts have been noted. Continuing to "
    + "deviate may compromise the quality of analysis on your "
    + "original question. This session may end early.",
  
  abuse_too_long:
    "Your input contains too much information for a focused "
    + "response. POJU works best with clear, concise questions. "
    + "Please rephrase, focusing only on what's directly related.",
  
  abuse_jailbreak:
    "POJU does not change its identity or scope. I can only "
    + "assist with your original question about [{original_topic}].",
  
  abuse_repetition:
    "I've already responded to this question. If my previous "
    + "answer wasn't helpful, please tell me specifically what "
    + "was missing.",
  
  data_insufficient:
    "I don't have enough information to give you a meaningful "
    + "answer yet. Let me ask: {next_question}",
};

// 拒绝时不调用 LLM
// 直接从模板返回
// 节省成本 + 保持机械化
```

### 拒绝的累计影响

```typescript
function handleRejection(
  type: string,
  session: SessionState
): RejectionResponse {
  
  // 更新计数
  if (type === 'TOPIC_DRIFT') {
    session.abuse_metrics.consecutive_drifts++;
  }
  if (type.startsWith('ABUSE_')) {
    session.abuse_metrics.abuse_attempts++;
  }
  
  // 选择模板
  let template;
  if (type === 'TOPIC_DRIFT') {
    if (session.abuse_metrics.consecutive_drifts === 1) {
      template = REJECTION_TEMPLATES.topic_drift_first;
    } else if (session.abuse_metrics.consecutive_drifts === 2) {
      template = REJECTION_TEMPLATES.topic_drift_repeated;
    } else {
      template = REJECTION_TEMPLATES.topic_drift_persistent;
    }
  }
  
  // 警示后是否升级措施?
  if (session.abuse_metrics.abuse_attempts >= 5) {
    // 极端情况: 终止 session,无退款
    return {
      response: "Multiple abuse attempts detected. This session " +
                "is being terminated. Please refer to our Terms " +
                "of Service.",
      action: 'terminate_session_no_refund',
    };
  }
  
  // 填模板变量
  const response = fillTemplate(template, {
    original_topic: session.original_question,
    original_question: session.original_question,
  });
  
  return { response, action: 'continue' };
}
```

## 3.6 行动建议生成

### Phase 4 触发流程

```
当 Phase 3 → Phase 4:
  
Step 1: LLM 生成行动建议
  System Prompt 注入:
  "Based on the user's profile and our conversation,
   generate 1-3 specific, actionable items.
   
   Each item must be:
   - Specific (not 'be more confident')
   - Time-bound (immediate / this week / ongoing)
   - Aligned with their pattern (from user_profile)
   - Aligned with current temporal energy
   
   Format: structured JSON"

Step 2: 验证生成的行动
  规则层检查:
  - 数量 1-3 个(不能太多)
  - 每个不超过 100 字
  - 必须包含具体时间维度
  - 不能含禁忌词("predict" / "guarantee" / "definitely")

Step 3: 显示给用户
  UI 格式:
  
  ┌──────────────────────────────────────────┐
  │ Today's actions                          │
  │                                          │
  │ ☐ [Immediate] Have a 30-minute talk     │
  │   with your direct supervisor before    │
  │   the end of the week.                  │
  │                                          │
  │   Why: Your current pattern shows you   │
  │   need clarity from authority figures.  │
  │   Today's energy supports this kind of  │
  │   structured conversation.              │
  │                                          │
  │ ☐ [This week] Write down the three      │
  │   non-negotiables for your next role.   │
  │                                          │
  │ When you've tried these (or chose not   │
  │ to), come back to share what happened.  │
  │                                          │
  │ [Mark complete] [I modified this]       │
  │ [I couldn't do it]                      │
  └──────────────────────────────────────────┘
```

### Phase 5 追踪机制

```
用户回访:
  
情况 A: 用户主动回报
  "I had the conversation. It was..."
  
  Agent:
    LLM 处理:
    - 评估进展(成功/部分/失败/调整)
    - 更新 action 状态
    - 生成下一轮建议
    
    可能的下一步:
    - 给新建议(继续 Phase 4)
    - 询问更多信息(回到 Phase 3)
    - 庆祝完成(进入 Phase 5 → RESOLVED)

情况 B: 用户回访但什么也没做
  "I haven't done anything yet, what should I do?"
  
  Agent:
    "That's okay — sometimes the next step needs to settle.
     
     Was there something about my last suggestions that 
     felt off?"
     
    [选项]
    [The timing wasn't right]
    [I'm not sure how to start]
    [I want to think more]
    [I want a different approach]

情况 C: 用户没回访(7+ 天)
  下次访问时,Agent 主动:
  "It's been [X] days since we last talked. How did 
   [last action] go?"
  
  注: 不发邮件主动联系
  仅在用户回访时显示
```

## 3.7 与 Glyph/Syncro 协作

### Agent 调用其他工具

```
某些情况下,LLM 可能建议用户使用 Glyph 或 Syncro:

场景 A: 用户需要快速反射
LLM 输出 suggest_glyph: true
  
  Agent 在回复中加入:
  "Sometimes a fresh angle helps. You could try Glyph 
   right now (your first daily use is free) — it draws 
   an archetypal pattern that might illuminate what 
   we've been discussing.
   
   [Open Glyph in new tab] (returns here automatically)"

场景 B: 用户需要时机判断
LLM 输出 suggest_syncro: true
  
  Agent:
  "For deciding the best timing for [specific action], 
   Syncro can show you how the next few hours align with 
   your patterns.
   
   [Open Syncro] (free browse mode)
   [Open Syncro AR for this task] ($1.99)"

实现:
  Agent 不【强制跳转】
  只是提供链接
  用户主动选择
  Glyph/Syncro 完成后可返回 POJU
```

### 数据共享

```
三件套共享 user_profile:

POJU 创建时 → 计算并保存 profile
Glyph 调用 → 复用相同 profile(免重复计算)
Syncro 调用 → 复用相同 profile

实现:
  IndexedDB 存储 user_profile
  Key: device_id_hash
  TTL: 6 个月(profile 6 个月内基本不变)
  
  例外:
  - 用户主动更新出生信息 → 重新计算
  - 跨年节(立春)→ 部分模块重算(流年)
  - 时辰切换 → 模块 4, 6 重算

3 个产品都从同一个 profile 读
但 LLM 输入和 prompt 不同
```

## 3.8 Session 生命周期(30 天 + 续期)

### 完整生命周期

```
[创建]
用户付款 ($9.99)
    ↓
DodoPayments webhook 触发
    ↓
创建 session_id (UUID)
    ↓
绑定 device_id
    ↓
存储到 IndexedDB
    ↓
重定向到 /session/[session_id]
    ↓
显示 Phase 1 (Welcome)

[活跃使用 - 30 天]
用户在 30 天内随时回访
每次回访 → last_interaction_at 更新
30 天计数器重置(从最后一次互动起算)

[即将过期提醒]
最后一次互动后 23 天 → 显示提示:
  "Your session is active for 7 more days. 
   Need to extend? It's free if you're still using it."
  [Extend 30 more days] [Let it archive]

[过期归档]
最后一次互动后 30 天 → 自动:
  - status 改为 ARCHIVED
  - 主页不显示
  - Archive 页可恢复
  - 数据加密保留在 IndexedDB

[手动操作]
用户可以随时:
  - End session (主动结束) → status: RESOLVED
  - Pause session (暂停) → status: SUSPENDED
  - Permanently delete → 真正删除

[恢复]
从 Archive 恢复:
  - status 改回 ACTIVE
  - 重置 30 天计数器
  - 用户继续

[多设备问题]
默认: session 绑定设备
用户在 Archive 页面可:
  - 导出 session JSON(加密)
  - 在新设备导入
  - 输入 device_id 解密
```

### Session 数据存储位置

```
存储位置:

服务器(Supabase 或类似):
  - 仅订单凭证
  - device_id_hash → payment_id 映射
  - 不存对话内容
  - 不存命理 profile

客户端(IndexedDB):
  - 完整 session 数据
  - 对话历史
  - user_profile
  - actions
  - 加密(AES-256-GCM)
  - Key 派生自 device fingerprint

LLM API(Anthropic):
  - ZDR 启用
  - 不保留请求 / 响应
  - 不用于训练
  - 不允许人工审查
```

---

# 批次 1 完成

```
本批次覆盖:

✓ 序章
  - v4.0 与 v3.0.1 关系
  - 核心理念
  - 阅读指南
  - 变化清单

✓ 第 1 章: 架构总览
  - 三件套关系(共享引擎)
  - 5 层架构
  - 数据流向
  - LLM 调用策略
  - 差异化护城河
  - 技术栈

✓ 第 2 章: 11 个计算模块
  - 详细接口规范(TypeScript)
  - 模块调用关系
  - 综合诊断输出格式
  - 数据文件依赖
  - 计算引擎 API

✓ 第 3 章: POJU 动态 Agent
  - Agent 设计哲学
  - 5 Phase 状态机
  - 数据收集流程
  - LLM 决策逻辑
  - 话题约束 + 拒绝
  - 行动建议生成
  - 与 Glyph/Syncro 协作
  - Session 生命周期
```

## 待续批次

```
批次 2(下次,待你审视后):
  第 4 章: Glyph 重新设计
    - 与 v3.0.1 的差异
    - 11 模块计算融入
    - 5 风 + 100 签新关系
    - LLM 输入格式
    - 输出报告新结构(60% 签文)
    - 每日免费 + $1.99 机制
  
  第 5 章: Syncro 双模式
    - 浏览模式实现
    - AR 任务模式实现
    - 5 时辰窗口期机制
    - 摄像头 + 罗盘集成
    - 8 方位 × 5 时辰生成
  
  第 6 章: System Prompt 设计
    - POJU 5 Phase prompts
    - Glyph 单次报告 prompt
    - Syncro 双模式 prompts
    - 多语言指令注入
    - 机械拒绝词库

批次 3(再下次):
  第 7-13 章 + 附录
  - 数据存储升级
  - API 设计
  - UI/UX 流程
  - 错误处理
  - 实施路径(给 Cursor)
  - 数据文件需求
  - 合规与风险
  - 附录(Prompts / Schema / 对比)
```

---

**请审视批次 1 后告诉我:**

1. 整体方向对吗?
2. 哪些部分需要调整?
3. 第 1-3 章的细节是否充分?
4. 准备好继续写批次 2 吗?
