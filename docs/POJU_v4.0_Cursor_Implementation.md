# POJU v4.0 实施指令(给 Cursor)

> **目的**: 在现有 pojulife.com 基础上,完成 v4.0 升级
>
> **范围**:
> - 完善 POJU 功能(深度对话 Agent)
> - 完善 Syncro 功能(双模式:浏览 + AR 任务)
> - 优化 Glyph 功能(从旧版升级到 v4.0)
>
> **基础文档**(必读):
> - POJU_v4.0_Batch1.md(架构 + 11 计算模块 + POJU Agent)
> - POJU_v4.0_Batch2.md(Glyph + Syncro + Prompts 基础)
> - POJU_v4.0_Batch2_Patch.md(Glyph 5 段 / Syncro 仪式 / 桌面引导)
> - POJU_v4.0_Batch3.md(数据 + API + UI + 错误 + 实施 + 合规)

---

# 第 0 部分:开始前必读

## 0.1 你的任务边界

```
你要做的:
  ✓ 在现有 pojulife.com 项目基础上实施 v4.0
  ✓ 完善 POJU 和 Syncro 功能(从现状到 v4.0)
  ✓ 优化 Glyph(从旧版到 v4.0,但保留现有 UI/卡片样式/抽签动画)
  ✓ 集成 shunshi-bazi-core 库作为计算引擎基础
  ✓ 写计算引擎的【包装层】(综合诊断 + 现代翻译)

你不要做的:
  ✗ 不要重写已有的 Header / Footer / 法律页面
  ✗ 不要修改 Glyph 现有 UI / 卡片样式 / 抽签动画 / 报告渲染样式
  ✗ 不要从零实现 bazi 推算算法(用 shunshi-bazi-core)
  ✗ 不要做命理师工作(patterns.json / spirits.json 等数据由我们提供)
  ✗ 不要擅自决定支付处理器(用 DodoPayments)
```

## 0.2 第一步:自查现状

```
开始任何代码工作之前,请先自查项目现状:

1. 列出当前项目结构(/app /components /lib 等)
2. 评估每个产品当前状态:
   - POJU: 当前是空页面?简单介绍?有什么功能已实现?
   - Glyph: 旧版有什么?5 段输出?Exploration?Sign 数据?
   - Syncro: 当前是空页面?有罗盘?
3. 检查已安装的依赖(package.json)
4. 检查支付集成现状(DodoPayments 集成了吗?)
5. 检查数据存储现状(IndexedDB?加密?)
6. 检查多语言现状(next-intl?哪些语言?)
7. 列出已有的 API 路由(/api/*)

把自查结果总结成一份【现状报告】发给我,然后我再告诉你具体下一步。

不要直接开始改代码。
```

## 0.3 计算引擎选型(已定)

```
基础算法: shunshi-bazi-core
  npm install shunshi-bazi-core
  
  使用场景:
  - M1 真太阳时
  - M2 八字排盘
  - M3 十神分析
  - M4 大运/流年
  - M8 神煞标记(部分)
  - M9 刑冲合害

自研包装层(/lib/calculations/):
  - M5 用神判断(简化版,基于 M2/M3 输出)
  - M6 风水方位(Syncro 用,完全自己写)
  - M7 格局识别(基于 M3/M5 + patterns.json)
  - M10 综合诊断 ⭐ 最关键(整合所有 → 给 LLM)
  - M11 时机判断(基于 M4 输出 + 规则)

数据文件:
  - 由我们提供 patterns.json / spirits.json / terminology_translations.json
  - 你的任务是【消费】这些文件,不是【创作】
```

---

# 第 1 部分:整体实施计划

## 1.1 实施批次顺序

```
按以下顺序实施(每批次完成 + 测试 + 通知我):

【批次 1】基础设施升级
  - 集成 shunshi-bazi-core
  - 创建计算引擎包装层框架
  - User Profile 数据流(IndexedDB 共享)
  - 加密层(AES-256-GCM)
  
【批次 2】Glyph v4.0 升级
  - 保留现有 UI / 卡片样式 / 抽签动画
  - 接入计算引擎(获取 user_profile)
  - 升级 LLM 调用(profile + 签文)
  - 输出改为 5 段(含 Exploration)
  - 每日 1 次免费 + $1.99 付费机制
  
【批次 3】Syncro 浏览模式(免费)
  - 移动端检测 + 桌面端引导页
  - 罗盘 UI(本机计算)
  - 8 方位评级(无 LLM 调用)
  - 2 小时自动刷新
  - 共享 user_profile
  
【批次 4】POJU 核心 Agent
  - Session 创建 + 数据收集表单
  - 5 Phase 状态机
  - 话题漂移检测 + 滥用检测
  - LLM 双重判断逻辑
  - 30 天活跃期 + 续期 + Archive
  
【批次 5】POJU 行动 + 追踪
  - Phase 4 行动建议生成
  - Phase 5 追踪机制
  - Action 状态管理
  - Resolution 流程
  
【批次 6】Syncro AR 模式(付费)
  - 任务选择 UI
  - DodoPayments 集成($1.99)
  - 11 步仪式流程(平放 → 矫正 → 竖起 → 摄像头)
  - 圆形摄像头视窗
  - LLM 一次性生成 40 解读
  - 5 时辰窗口期
  
【批次 7】多语言完善(P1)
  - 5 语言 UI 翻译
  - LLM Prompt 多语言注入
  - 机械拒绝词库
  
【批次 8】邮件 + 收尾(P1)
  - Resend 集成
  - 11 个邮件模板
  - 客服回复模板
  - 最终测试
```

## 1.2 总时间预估

```
基于 shunshi-bazi-core 加速:
  
  批次 1-3: 4-5 周(基础 + Glyph + Syncro 免费)
  批次 4-5: 4-5 周(POJU 核心)
  批次 6: 2 周(Syncro AR)
  批次 7-8: 1-2 周(多语言 + 邮件)
  
  总计: 11-14 周
  
  vs 原计划 14 周
  节省 2-3 周(因为 shunshi-bazi-core)
```

---

# 第 2 部分:批次 1 - 基础设施升级

## 2.1 目标

```
建立 v4.0 的【底层基础】:
- 计算引擎包装层
- User Profile 共享存储
- 数据加密
- 数据收集表单(三件套共用)
```

## 2.2 任务清单

### Task 2.1: 集成 shunshi-bazi-core

```bash
# 安装
npm install shunshi-bazi-core
npm install @fingerprintjs/fingerprintjs
npm install dexie
```

### Task 2.2: 创建计算引擎包装层

```
目录结构:
/lib/calculations/
├── index.ts                    # 主入口 calculateProfile()
├── shunshi-adapter.ts          # 适配 shunshi-bazi-core 输出
├── modules/
│   ├── m1-solar-time.ts        # 用 shunshi.solarTime
│   ├── m2-bazi.ts              # 用 shunshi.bazi
│   ├── m3-ten-gods.ts          # 用 shunshi.bazi.tenGods
│   ├── m4-da-yun.ts            # 用 shunshi.bazi.daYun
│   ├── m5-yong-shen.ts         # 自研(简化版)
│   ├── m6-directions.ts        # 自研(Syncro 用)
│   ├── m7-pattern.ts           # 自研 + patterns.json
│   ├── m8-spirits.ts           # 用 shunshi.shensha
│   ├── m9-relations.ts         # 用 shunshi.relations
│   ├── m10-diagnosis.ts        # ⭐ 自研(综合诊断)
│   └── m11-timing.ts           # 自研(时机判断)
├── data/                       # 数据文件
│   ├── patterns.json           # (我们提供)
│   ├── spirits-extra.json      # (我们提供,神煞补充)
│   ├── terminology.json        # (我们提供,术语翻译)
│   └── directions-rules.json   # (我们提供,方位规则)
└── types.ts                    # TypeScript 接口
```

### Task 2.3: 实现主入口

```typescript
// /lib/calculations/index.ts

import { calculateBazi, calculateSolarTime } from 'shunshi-bazi-core';
import { calculateYongShen } from './modules/m5-yong-shen';
import { calculateDirections } from './modules/m6-directions';
import { calculatePattern } from './modules/m7-pattern';
import { calculateDiagnosis } from './modules/m10-diagnosis';
import { calculateTiming } from './modules/m11-timing';

export async function calculateProfile(input: CalculateInput): Promise<UserProfile> {
  // Step 1: 真太阳时
  const solarTime = await calculateSolarTime({
    datetime: input.birth.datetime,
    timezone: input.birth.timezone,
    longitude: input.birth.longitude
  });
  
  // Step 2-4: 用 shunshi 算八字、十神、大运
  const bazi = await calculateBazi({
    solarTime,
    gender: input.gender
  });
  
  // Step 5: 自研用神判断
  const yongShen = await calculateYongShen(bazi);
  
  // Step 6: 自研格局识别
  const pattern = await calculatePattern(bazi, yongShen);
  
  // Step 7: shunshi 神煞 + 我们的现代化标签
  const spirits = mergeSpirits(bazi.shensha);
  
  // Step 8: shunshi 刑冲合害
  const relations = bazi.relations;
  
  // Step 9: ⭐ 综合诊断(关键!)
  const diagnosis = await calculateDiagnosis({
    bazi,
    yongShen,
    pattern,
    spirits,
    relations,
    userQuestion: input.userQuestion
  });
  
  // Step 10: Syncro 用 - 方位
  let directions;
  if (input.current?.location) {
    directions = await calculateDirections({
      yongShen,
      currentTime: input.current.timestamp,
      orientation: input.current.facing
    });
  }
  
  return {
    bazi,
    yongShen,
    pattern,
    spirits,
    relations,
    diagnosis,  // 给 LLM 用
    directions  // 给 Syncro 用
  };
}
```

### Task 2.4: 数据加密层

```typescript
// /lib/crypto.ts

完整实现详见 POJU_v4.0_Batch3.md 第 7.3 节
关键点:
- AES-256-GCM
- PBKDF2 派生密钥
- 设备指纹作为输入
- 100000 iterations
```

### Task 2.5: IndexedDB 结构

```typescript
// /lib/db.ts

完整实现详见 POJU_v4.0_Batch3.md 第 7.2 节
表结构:
- user_profiles
- device_info
- poju_sessions
- poju_archive
- glyph_history
- glyph_usage
- syncro_tasks
- syncro_cache
- app_settings
```

### Task 2.6: 共享数据收集表单

```
组件: <BirthInfoForm />
路径: /components/forms/BirthInfoForm.tsx

字段:
  - 出生年月日(年:1900-2030,月:1-12,日:1-31)
  - 出生时辰(0-23 时,0-59 分,允许"不知道时辰")
  - 出生城市(用 Google Places 或类似)
  - 性别(男/女)
  - 当前位置(自动检测 + 手动选)

行为:
  - 提交后调用 calculateProfile()
  - 加密保存到 IndexedDB
  - 三件套共用此 Profile
```

### Task 2.7: 设备指纹 + 加密初始化

```typescript
// /lib/init.ts

export async function initApp() {
  // 1. 获取设备指纹
  const deviceId = await getDeviceFingerprint();
  
  // 2. 检查 device_info
  let deviceInfo = await db.device_info.get(deviceId);
  if (!deviceInfo) {
    // 首次访问,创建
    deviceInfo = await createDeviceInfo(deviceId);
  }
  
  // 3. 初始化加密
  await cryptoService.deriveKey(deviceId, deviceInfo.salt);
  
  // 4. 检查并归档过期 Session
  await checkAndArchiveSessions();
}

// 在 _app.tsx 或 layout.tsx 中调用
```

## 2.3 批次 1 验证清单

```
完成后检查:

□ shunshi-bazi-core 安装成功
□ /lib/calculations 目录创建,主入口工作
□ 测试用例:1990-05-15 14:30 出生 → 正确输出八字
□ IndexedDB 9 个表创建成功
□ 加密层测试通过(加密/解密往返)
□ 设备指纹生成稳定(重启后同样指纹)
□ <BirthInfoForm /> 组件可用
□ initApp() 在应用启动时执行

完成后通知我:
"批次 1 完成,等待 review"

并提供:
- 测试样例的输出
- 任何遇到的问题
- patterns.json / terminology.json 等的占位需求
```

---

# 第 3 部分:批次 2 - Glyph v4.0 升级

## 3.1 目标

```
将 Glyph 从旧版升级到 v4.0:
- 保留: UI / 卡片样式 / 抽签动画 / 报告渲染
- 升级: 后端逻辑 + LLM 输入 + 输出结构
```

## 3.2 任务清单

### Task 3.1: 不要碰的部分

```
明确保留(不要改):
  ✓ Glyph 主界面 UI
  ✓ 100 签卡片样式
  ✓ 抽签动画(粒子球、3D 效果)
  ✓ 报告渲染样式
  ✓ 字体、配色、间距
  ✓ 5 风等级的视觉标识

如果发现现有 UI 和文档描述冲突,以现有 UI 为准。
```

### Task 3.2: 接入计算引擎

```typescript
// 修改 Glyph 抽签流程

// 旧版:
// 用户输入出生日期 → 直接传给 LLM

// v4.0:
async function generateGlyph(userInput, deviceId) {
  // 1. 获取或计算 user_profile
  let profile = await getCachedProfile(deviceId);
  
  if (!profile) {
    // 显示数据收集表单
    profile = await collectBirthInfoAndCalculate();
  }
  
  // 2. 随机抽签(保留现有抽签算法)
  const glyphNumber = drawGlyph();
  const glyphData = await loadGlyphData(glyphNumber);
  
  // 3. 调用 LLM(新的输入格式)
  const report = await callGlyphLLM({
    profile: profile.diagnosis,  // 注意:不是整个 profile,只是 diagnosis
    glyph: glyphData,
    userQuestion: userInput,
    language: getCurrentLanguage()
  });
  
  // 4. 显示报告(保留现有 UI)
  return report;
}
```

### Task 3.3: 升级 System Prompt

```typescript
// /lib/llm/glyph-prompt.ts

const GLYPH_SYSTEM_PROMPT_V4 = `
[完整 Prompt 见 POJU_v4.0_Batch2_Patch.md 第 4.7 节]

关键变化:
- 输入加入 user_profile.diagnosis
- 输出 5 段结构(加 Exploration)
- 严格禁用命理术语
- 强调与 POJU 区分
`;
```

### Task 3.4: 输出结构升级为 5 段

```typescript
interface GlyphReport {
  // 旧版 4 段
  wind_category_blurb: string;
  classical_voice: string;
  meaning_for_question: string;
  hidden_tension: string;
  your_moment: string;
  
  // ⭐ 新增第 4 段
  exploration: {
    text: string;              // 60-90 词内省练习
    timeframe: 'today' | 'tonight' | 'within_24h' | 'this_week';
    duration_estimate: string; // "5 minutes", "10 minutes"
    is_solo: boolean;          // 总是 true
  };
  
  reflection_question: string;
}
```

### Task 3.5: 每日免费 + $1.99 机制

```typescript
// /app/glyph/page.tsx 进入逻辑

async function GlyphPage() {
  const deviceId = await getDeviceId();
  
  // 检查每日免费额度
  const quota = await checkGlyphQuota(deviceId);
  
  if (quota.canUseFree) {
    // 显示主界面(免费版)
    return <GlyphMain isFree={true} />;
  } else {
    // 显示付费墙
    return <GlyphPaywall nextFreeAt={quota.nextFreeAt} />;
  }
}
```

```typescript
// 付费流程

async function handlePay() {
  // 1. 调用 DodoPayments
  const checkout = await createPayment({
    product: 'glyph',
    amount: 1.99,
    deviceId
  });
  
  // 2. 跳转到 checkout
  window.location.href = checkout.url;
  
  // 3. 付款成功返回 /glyph?paid=true&payment_id=xxx
}

// 检测返回
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('paid') === 'true') {
    // 验证支付
    verifyAndContinue(params.get('payment_id'));
  }
}, []);
```

### Task 3.6: 防薅羊毛

```typescript
// 服务器端验证

// /api/glyph/quota/route.ts

export async function GET(req: Request) {
  const deviceId = req.headers.get('x-device-id');
  
  // 检查 device_bindings 表
  const binding = await db.device_bindings.findFirst({
    where: { device_id_hash: deviceId }
  });
  
  const today = new Date().toISOString().split('T')[0];
  const lastFreeDate = binding?.last_glyph_free_at?.toISOString().split('T')[0];
  
  return NextResponse.json({
    can_use_free: lastFreeDate !== today,
    next_free_at: lastFreeDate === today ? getTomorrow() : null
  });
}
```

### Task 3.7: 历史记录(Archive 兼容)

```typescript
// 保存到 glyph_history 表

await db.glyph_history.add({
  id: uuid(),
  device_id: deviceId,
  drawn_at: new Date(),
  
  encrypted_data: encrypt({
    user_question: userQuestion,
    user_profile_snapshot: profile.diagnosis,
    glyph_drawn: glyphNumber,
    report: report
  }),
  
  is_paid: !isFree,
  payment_id: paymentId,
  language: getCurrentLanguage(),
  glyph_number: glyphNumber,
  wind_category: glyphData.wind_category
});
```

## 3.3 批次 2 验证清单

```
完成后检查:

□ Glyph UI 完全保持现有样式
□ 用户首次访问 → 数据收集表单 → 计算 Profile
□ 用户后续访问 → 直接复用 Profile
□ 抽签 + LLM 输出 5 段结构
□ Exploration 段落质量符合规范
□ 每日 1 次免费正常工作
□ 第 2 次使用 → 付费墙正常
□ $1.99 付费流程通畅
□ 服务器端防薅羊毛生效
□ 历史记录正确保存
□ Archive 页面能查看历史

完成后通知我并提供:
- 测试样本(首次免费 / 第二次付费)
- 任何遇到的 LLM 输出问题
```

---

# 第 4 部分:批次 3 - Syncro 浏览模式

## 4.1 目标

```
Syncro 双模式之【免费浏览模式】:
- 移动端检测 + 桌面端引导
- 罗盘 UI + 8 方位评级
- 本机计算,无 LLM 调用
- 2 小时自动刷新
```

## 4.2 任务清单

### Task 4.1: 设备检测路由

```typescript
// /app/syncro/page.tsx

'use client';

import { detectDevice } from '@/lib/device-detection';

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

### Task 4.2: 桌面端引导页

```typescript
// /components/syncro/SyncroDesktopGuide.tsx

import { QRCodeSVG } from 'qrcode.react';

export default function SyncroDesktopGuide() {
  const syncroLink = 'https://pojulife.com/syncro?ref=desktop_qr';
  
  return (
    <div className="syncro-desktop-guide">
      <h1>Syncro</h1>
      <p>See your natural rhythms.</p>
      
      <section>
        <h2>Syncro lives on your phone</h2>
        <p>
          Syncro is a directional compass — it needs a 
          real compass and your position. Your phone has both.
        </p>
      </section>
      
      <section>
        <h2>Open Syncro on your phone</h2>
        <QRCodeSVG value={syncroLink} size={200} />
        <p>Scan with your phone camera</p>
        
        {/* P1: 邮件/短信发送 */}
        <div>
          <input placeholder="your@email.com" />
          <button>Email me the link</button>
        </div>
      </section>
      
      <section>
        <h2>What Syncro does</h2>
        {/* 视频演示占位 */}
        <VideoDemo product="syncro_browse" />
        <VideoDemo product="syncro_ar" />
      </section>
    </div>
  );
}
```

### Task 4.3: 移动端浏览模式

```typescript
// /components/syncro/SyncroMobile.tsx

export default function SyncroMobile() {
  const [profile, setProfile] = useState(null);
  const [orientation, setOrientation] = useState(0);
  const [ratings, setRatings] = useState(null);
  
  // 检查 user_profile
  useEffect(() => {
    async function loadProfile() {
      let p = await getCachedProfile();
      if (!p) {
        // 显示数据收集表单
        p = await collectBirthInfo();
      }
      setProfile(p);
    }
    loadProfile();
  }, []);
  
  // 请求罗盘权限(iOS)
  useEffect(() => {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ 需要授权
      DeviceOrientationEvent.requestPermission().then(state => {
        if (state === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
        }
      });
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
    }
  }, []);
  
  // 计算 8 方位评级(本机)
  useEffect(() => {
    if (!profile) return;
    
    const directions = calculateDirections({
      yongShen: profile.yongShen,
      currentTime: new Date().toISOString(),
      orientation
    });
    
    setRatings(directions.ratings);
  }, [profile, orientation]);
  
  // 时辰切换刷新
  useEffect(() => {
    const interval = setInterval(() => {
      // 重新计算
      if (profile) {
        const directions = calculateDirections({
          yongShen: profile.yongShen,
          currentTime: new Date().toISOString(),
          orientation
        });
        setRatings(directions.ratings);
      }
    }, 60 * 1000); // 每分钟检查
    
    return () => clearInterval(interval);
  }, [profile, orientation]);
  
  return (
    <div className="syncro-mobile">
      <Header />
      
      <HourDisplay />
      
      <CompassUI 
        orientation={orientation}
        ratings={ratings}
      />
      
      <CurrentFacingInfo 
        direction={getDirection(orientation)}
        rating={ratings?.[getDirection(orientation)]}
      />
      
      <NextUpdateCountdown />
      
      <ARTaskCTA /> {/* 入口到 AR 模式 */}
    </div>
  );
}
```

### Task 4.4: 罗盘 UI 组件

```typescript
// /components/syncro/CompassUI.tsx

export function CompassUI({ orientation, ratings }) {
  return (
    <div className="compass-ui">
      <div 
        className="compass-rose"
        style={{ transform: `rotate(${-orientation}deg)` }}
      >
        {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map(dir => (
          <DirectionMarker
            key={dir}
            direction={dir}
            rating={ratings?.[dir]}
            isFacing={getDirection(orientation) === dir}
          />
        ))}
      </div>
    </div>
  );
}

function DirectionMarker({ direction, rating, isFacing }) {
  const ratingColors = {
    highly_favorable: '#D4AF37',  // 金
    supportive: '#87CEEB',         // 浅蓝
    neutral: '#A8A8A8',            // 灰
    challenging: '#6B5B7B',        // 暗紫
    oppressive: '#4A4A4A'          // 深灰
  };
  
  return (
    <div 
      className={`direction-marker ${isFacing ? 'facing' : ''}`}
      style={{ color: ratingColors[rating?.rating] }}
    >
      <span>{direction}</span>
      {rating?.rating === 'highly_favorable' && <span>⭐</span>}
    </div>
  );
}
```

### Task 4.5: 月历计算(Module 6)

```typescript
// /lib/calculations/modules/m6-directions.ts

import directionsRules from '../data/directions-rules.json';

interface DirectionInput {
  yongShen: YongShenOutput;
  currentTime: string;
  orientation?: number;
  task?: string;  // AR 模式用
}

export function calculateDirections(input: DirectionInput) {
  const currentHour = getHourBranch(input.currentTime);
  const hourElement = directionsRules.hour_elements[currentHour];
  
  const ratings = {};
  
  for (const direction of ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']) {
    const baseElement = directionsRules.base_elements[direction];
    
    // 评分公式
    let score = 0;
    
    // 基础五行 vs 用神
    if (baseElement === input.yongShen.primary) {
      score += 2;
    } else if (canGenerate(baseElement, input.yongShen.primary)) {
      score += 1.5;
    } else if (canGenerate(input.yongShen.primary, baseElement)) {
      score += 0;
    } else if (baseElement === input.yongShen.jiShen[0]) {
      score -= 1.5;
    } else if (canGenerate(input.yongShen.jiShen[0], baseElement)) {
      score -= 2;
    }
    
    // 时辰加成
    if (hourElement === baseElement) {
      score *= 1.2;
    } else if (canGenerate(hourElement, baseElement)) {
      score *= 1.1;
    } else if (canControl(hourElement, baseElement)) {
      score *= 0.8;
    }
    
    // 映射 5 级
    let rating;
    if (score >= 1.5) rating = 'highly_favorable';
    else if (score >= 0.5) rating = 'supportive';
    else if (score >= -0.5) rating = 'neutral';
    else if (score >= -1.5) rating = 'challenging';
    else rating = 'oppressive';
    
    ratings[direction] = {
      base_element: baseElement,
      combined_score: score,
      rating,
      brief_note: generateBriefNote(direction, rating, hourElement)
    };
  }
  
  return {
    current_hour: {
      branch: currentHour,
      element: hourElement,
      period: getHourPeriod(currentHour)
    },
    ratings,
    current_facing: input.orientation 
      ? getDirectionFromHeading(input.orientation) 
      : null,
    validity: {
      valid_until: getNextHourBoundary(input.currentTime),
      is_current_zhi_shi: currentHour === '子'
    }
  };
}
```

### Task 4.6: 数据文件 directions-rules.json

```json
{
  "base_elements": {
    "N": "water",
    "NE": "earth",
    "E": "wood",
    "SE": "wood",
    "S": "fire",
    "SW": "earth",
    "W": "metal",
    "NW": "metal"
  },
  "hour_elements": {
    "子": "water",
    "丑": "earth",
    "寅": "wood",
    "卯": "wood",
    "辰": "earth",
    "巳": "fire",
    "午": "fire",
    "未": "earth",
    "申": "metal",
    "酉": "metal",
    "戌": "earth",
    "亥": "water"
  },
  "hour_periods": {
    "子": "23:00-01:00",
    "丑": "01:00-03:00",
    "寅": "03:00-05:00",
    "卯": "05:00-07:00",
    "辰": "07:00-09:00",
    "巳": "09:00-11:00",
    "午": "11:00-13:00",
    "未": "13:00-15:00",
    "申": "15:00-17:00",
    "酉": "17:00-19:00",
    "戌": "19:00-21:00",
    "亥": "21:00-23:00"
  }
}
```

### Task 4.7: 可选校准

```typescript
// /components/syncro/CalibrateButton.tsx

export function CalibrateButton() {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <button 
        className="calibrate-icon"
        onClick={() => setOpen(true)}
        title="Calibrate compass"
      >
        ⚙
      </button>
      
      {open && (
        <CalibrateModal onClose={() => setOpen(false)}>
          <h3>Calibration</h3>
          <p>
            Move your phone in a figure-8 pattern until 
            calibration completes.
          </p>
          <FigureEightAnimation />
          <button onClick={() => setOpen(false)}>Skip</button>
        </CalibrateModal>
      )}
    </>
  );
}
```

## 4.3 批次 3 验证清单

```
完成后检查:

□ 桌面端 → 引导页正常显示 + QR 码可扫
□ 移动端 → 直接进入浏览模式
□ 罗盘权限请求(iOS)正常
□ 转动手机 → 方位实时切换
□ 8 方位评级显示(5 种颜色)
□ 当前方位高亮
□ 时辰自动切换(每小时检查)
□ 校准按钮可选,不影响默认体验
□ 共享 user_profile(从 IndexedDB 读)
□ 无 LLM 调用(本机计算)

完成后通知我:
"批次 3 完成,等待 review"
```

---

# 第 5 部分:批次 4 - POJU 核心 Agent

## 5.1 目标

```
POJU 的核心:
- 数据收集 + Profile 生成
- 5 Phase 状态机
- LLM 决策逻辑
- 30 天 + 续期
```

## 5.2 任务清单

### Task 5.1: Session 创建流程

```typescript
// /app/poju/page.tsx

export default function POJUEntry() {
  return (
    <div>
      <h1>POJU</h1>
      <p>Deep conversation for hard questions.</p>
      
      <PricingCard 
        price="$9.99"
        description="One session, until breakthrough"
      />
      
      <ActiveSessionsList />
      
      <button onClick={startNewSession}>
        Begin a session →
      </button>
    </div>
  );
}

async function startNewSession() {
  // 1. 检查并发(同设备只能 1 个 active)
  const existing = await getActivePOJUSession();
  if (existing) {
    return showConfirm({
      title: 'Active session exists',
      message: 'End it first or continue?',
      actions: ['End existing', 'Continue existing']
    });
  }
  
  // 2. 创建支付意向
  const checkout = await createPayment({
    product: 'poju',
    amount: 9.99
  });
  
  // 3. 跳转到 DodoPayments
  window.location.href = checkout.url;
}
```

### Task 5.2: 付款成功 + Session 创建

```typescript
// /app/poju/session/[id]/page.tsx

export default function POJUSession({ params }) {
  const sessionId = params.id;
  
  // 验证 session_id
  // 加载或创建 session
  
  return <POJUSessionUI sessionId={sessionId} />;
}
```

### Task 5.3: Phase 状态机

```typescript
// /lib/poju/agent.ts

export class POJUAgent {
  private session: SessionState;
  
  async handleUserInput(input: string) {
    // 1. 规则层检查
    const ruleCheck = this.runRuleChecks(input);
    if (ruleCheck.isRejected) {
      return ruleCheck.response;
    }
    
    // 2. Phase 路由
    switch (this.session.current_phase) {
      case 1:
        return this.handlePhase1(input);
      case 2:
        return this.handlePhase2(input);
      case 3:
        return this.handlePhase3(input);
      case 4:
        return this.handlePhase4(input);
      case 5:
        return this.handlePhase5(input);
    }
  }
  
  private async handlePhase1(input: string) {
    // 锁定话题
    this.session.original_question = input;
    this.session.original_topic_keywords = extractKeywords(input);
    this.session.question_locked_at = new Date();
    
    // 检查 Profile
    const profile = await getCachedProfile();
    if (!profile) {
      // 进入 Phase 2(数据收集)
      this.session.current_phase = 2;
      return {
        response: "Before we go deeper, I need some basics about you.",
        show_data_form: true
      };
    } else {
      // 已有 Profile,直接进入 Phase 3
      this.session.user_profile = profile;
      this.session.current_phase = 3;
      return await this.handlePhase3(input);
    }
  }
  
  // ... 其他 Phase 实现见 POJU_v4.0_Batch1.md 第 3 章
}
```

### Task 5.4: 话题漂移检测

```typescript
// /lib/poju/drift-detection.ts

完整实现见 POJU_v4.0_Batch1.md 第 3.5 节
关键:
- 关键词重叠度
- 强信号词检测
- 双层规则 + LLM 判断
```

### Task 5.5: LLM 调用层

```typescript
// /lib/llm/poju-llm.ts

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function callPOJULLM({
  session,
  userInput,
  language
}) {
  const phase = session.current_phase;
  const systemPrompt = buildPOJUPrompt(phase, session, language);
  
  const messages = session.messages
    .filter(m => !m.is_rejected)
    .map(m => ({ role: m.role, content: m.content }));
  
  messages.push({ role: 'user', content: userInput });
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: systemPrompt,
    messages
  });
  
  return parseStructuredOutput(response);
}
```

### Task 5.6: 30 天 + 续期

```typescript
// /lib/poju/lifecycle.ts

export async function checkSessionExpiry(sessionId: string) {
  const session = await loadSession(sessionId);
  const now = new Date();
  
  // 即将过期(7 天内)
  if (session.expires_at - now < 7 * 24 * 60 * 60 * 1000) {
    showExtensionPrompt();
  }
  
  // 已过期
  if (session.expires_at < now && session.status === 'active') {
    await archiveSession(sessionId);
  }
}

export async function extendSession(sessionId: string) {
  const session = await loadSession(sessionId);
  
  session.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  session.renewals.push({
    extended_at: new Date(),
    reason: 'user_request'
  });
  
  await saveSession(session);
}
```

## 5.3 批次 4 验证清单

```
完成后检查:

□ POJU 主入口页正常
□ 支付流程通畅($9.99)
□ Session 创建 + URL 正确
□ Phase 1 → 2 → 3 转换正确
□ 数据收集表单调用 Profile 计算
□ Phase 3 LLM 对话正常
□ 话题漂移检测有效
□ 滥用检测有效
□ 30 天倒数正常
□ 续期机制工作
□ Archive 归档自动
□ Session 数据加密存储

完成后通知我:
"批次 4 完成"
```

---

# 第 6 部分:批次 5 - POJU 行动 + 追踪

## 6.1 任务清单

### Task 6.1: Phase 4 行动建议

```typescript
// LLM 输出 → 提取 actions
// 显示行动 UI
// 用户标记状态(完成/修改/跳过)
```

### Task 6.2: Phase 5 追踪

```typescript
// 用户回访
// 评估进展
// 调整建议
// 循环 Phase 4 ↔ 5
```

### Task 6.3: Resolution 流程

```typescript
// 用户标记 resolved
// 生成总结
// 满意度评分
// 标记 session 完成
```

完整实现见 POJU_v4.0_Batch1.md 第 3.6-3.7 节

## 6.2 验证清单

```
□ Phase 4 生成 1-3 个行动
□ 行动 UI 显示 + 可标记
□ 用户回访能正常进入 Phase 5
□ 用户说"解决了" → Resolution 流程
□ 总结生成
□ Archive 显示完整历史
```

---

# 第 7 部分:批次 6 - Syncro AR 模式

## 7.1 任务清单

详细规范见 POJU_v4.0_Batch2_Patch.md 第 5.3 节

```
关键任务:
- Task 选择 UI(预设 + 自定义)
- DodoPayments $1.99 集成
- 11 步仪式流程
  * 平放检测
  * 3 秒矫正
  * 记录基准
  * 检测竖起
  * 摄像头自动开
  * AR 视图加载
- 圆形摄像头视窗
- LLM 一次生成 40 解读
- 5 时辰窗口期
- 时辰自动切换显示
```

## 7.2 验证清单

```
□ 任务选择 UI 完整(8 预设 + 自定义)
□ 付款 $1.99 流程通畅
□ 平放检测正确(β ≈ 0°)
□ 3 秒矫正倒数
□ 竖起检测触发摄像头(β ≈ 80-90°)
□ 摄像头权限请求 + 降级方案
□ 圆形视窗 UI 居中,70% 屏幕宽
□ 边缘色随吉凶变化
□ 转动手机 → 实时切换方位
□ 切换平滑(300ms 淡出淡入)
□ 时辰切换自动更新
□ 5 时辰窗口结束 → 提示重新付费
```

---

# 第 8 部分:批次 7-8

## 8.1 批次 7:多语言完善

```
基于现有 next-intl 配置:
- 5 语言 UI 翻译(en/zh/es/fr/de)
- LLM Prompt 多语言注入
- 机械拒绝词库(5 语言)
- 3 级语言判断逻辑
```

## 8.2 批次 8:邮件 + 收尾

```
- Resend 集成
- 11 个邮件模板(见 v3.0.1 文档)
- 客服回复模板
- 最终整合测试
- 性能优化
- 上线准备
```

---

# 第 9 部分:Cursor 工作规范

## 9.1 每批次工作流

```
1. 开始批次前:
   - 通读对应文档章节
   - 自查现状
   - 列出预期变更
   - 询问任何不清楚的点

2. 实施中:
   - 小步提交(每个 task 一次 commit)
   - 不要破坏现有功能
   - 写测试用例
   - 文档更新

3. 完成后:
   - 通知用户"批次 X 完成"
   - 提供测试样例
   - 列出遇到的问题
   - 等待 review

4. 不要做的:
   - 不要擅自决定关键设计
   - 不要修改文档明确"保留"的部分
   - 不要跳过验证清单
   - 不要一次完成多个批次
```

## 9.2 提交规范

```
每个 commit 描述应包含:
  feat(poju): implement phase 1 welcome flow
  fix(glyph): correct daily quota check
  refactor(calculations): extract diagnosis layer

每批次完成后,合并到 main 之前:
  - 测试覆盖所有变更
  - 手动验证关键流程
  - 截图证明 UI 正确
```

## 9.3 异常情况处理

```
遇到不确定的情况:
  - 暂停实施
  - 向用户说明问题
  - 提出 2-3 个方案
  - 等待用户决策

不要擅自决定:
  - 价格变更
  - 数据结构变更
  - 第三方服务选择
  - 法律条款修改
```

---

# 第 10 部分:启动指令

## 现在开始

```
第一件事:
  自查现状(见 0.2 节)
  把现状报告发给用户
  等待用户确认后再进入批次 1

不要直接开始改代码。
不要跳过自查。
```

## 当前批次提示

```
当前状态: 自查阶段
下一批次: 批次 1(基础设施)
完成自查后通知用户。
```

---

**用户:这份文档你直接复制给 Cursor 即可。**

**Cursor 会先做现状自查,然后等你确认进入批次 1。**

**每个批次完成后,Cursor 会通知你 review,你可以让我帮你审视代码或决策。**
