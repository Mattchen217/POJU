# POJU/Match/Glyph 真太阳时自查 + 修复指令

> **背景**:
> - Syncro 修复了真太阳时(经度时差 + 时差方程)
> - 但 POJU、Match、Glyph 也基于八字命盘
> - 命盘生成必须用真太阳时,否则【时辰可能错】
> - 这是命理准确性的【根本问题】
>
> **目标**:
> 1. 自查现有 bazi 库是否处理真太阳时
> 2. 测试现有命盘的准确性
> 3. 给出修复方案
> 4. 处理旧 profiles 数据迁移
>
> **影响范围**:
> - POJU 八字采集(影响所有用户)
> - Glyph(依赖 stored_profiles)
> - Match(依赖 stored_profiles)
> - 所有 stored_profiles
>
> **执行原则**:严格【一步一停】

---

# ⚠️ Cursor 必读

```
本任务的【严重性】:

如果命盘没用真太阳时:
  ✗ 乌鲁木齐用户(经度 87°)的命盘【时辰可能错】
  ✗ 误差可能达 2 小时
  ✗ 错的时辰 → 错的时柱 → 错的命局 → 全错!
  ✗ 这影响 POJU/Match/Glyph 三个核心产品

修复优先级:P0(最高)

修复策略:
  ⭐ 优先级 1:阻断错误源(新 profile 必须用真太阳时)
  ⭐ 优先级 2:温和迁移(旧 profile 用户可重新生成)
  ✗ 不强制覆盖旧 profile(用户体验)

每个 Step 完成后:
  - 贴出代码 + 测试输出
  - 等用户明确"通过 Step X" 才进入下一步
```

---

# 第 1 部分:Step 1 - 排查现有 bazi 库

## Step 1.1: 找到现有 bazi 库

```
任务:

1. 在项目中搜索 bazi 库的导入:
   grep -r "shunshi" --include="*.ts" --include="*.tsx"
   grep -r "bazi" --include="*.ts" --include="*.tsx"
   grep -r "lunar-typescript" --include="*.ts" --include="*.tsx"
   grep -r "@aaronicsubstances" --include="*.ts" --include="*.tsx"
   
2. 列出实际使用的库:
   □ 哪个 npm 包名?
   □ 哪些文件在用?
   □ 主要 API 是什么?
   
3. 找到调用 bazi 库的核心文件:
   通常在 lib/llm/deepseek/base-analysis.ts
   或 lib/bazi/calculate.ts
   或 lib/profile/calculate-bazi.ts
   
   列出该文件如何调用 bazi 库,
   包括传入的参数。

4. 找到 bazi 库的 README 或文档:
   pnpm view <package-name>
   或 cat node_modules/<package-name>/README.md
   
   重点查:
   □ API 是否接受 longitude / latitude 参数?
   □ API 是否提到 "true solar time" / "real solar time" / "真太阳时"?
   □ API 是否提到 "equation of time" / "时差方程"?

5. 报告给用户:
   "找到了 X 库,在 Y 文件中调用,
    API 是 [示例代码],
    [是否支持真太阳时]"
```

## Step 1.2: 验证库的实际行为

```typescript
// 写一个测试脚本 scripts/test-bazi-library.ts

import { /* 库的 API */ } from '/* 实际使用的库 */';

async function testBaziLibrary() {
  console.log('=== Test 1: Beijing time, no longitude ===');
  // 用现在的方式生成命盘(不传位置)
  const beijing12pm = generateBazi({
    year: 2024, month: 6, day: 15,
    hour: 12, minute: 0,
    // 不传 longitude
  });
  console.log('Beijing 12:00 →', beijing12pm);
  
  console.log('=== Test 2: Same time at Urumqi (87°E) ===');
  // 如果库支持 longitude,传它
  // 如果不支持,我们手动转真太阳时
  
  const urumqi12pm = generateBazi({
    year: 2024, month: 6, day: 15,
    hour: 12, minute: 0,
    // 传 longitude: 87.6 ?(看库是否支持)
  });
  console.log('Urumqi 12:00 →', urumqi12pm);
  
  console.log('=== Test 3: Difference? ===');
  // 如果两个结果【时柱不同】→ 库支持真太阳时(或我们正确传了)
  // 如果两个结果【时柱相同】→ 库没用真太阳时!
  
  // 乌鲁木齐 12:00 北京时间 → 真太阳时约 10:00
  // 时柱应该是【巳时】(9-11)
  // 而非北京 12:00 的【午时】(11-13)
}

testBaziLibrary();
```

## Step 1.3: 三种可能结果

```
分类 A:库支持真太阳时,但我们没传位置
  现象:库的 API 有 longitude 参数,但我们调用时没传
  影响:命盘按时区平均时算,跨经度用户结果错
  修复:简单,加传 longitude 即可
  
分类 B:库支持真太阳时,我们传了位置但传错了
  现象:库的 API 有 longitude 参数,我们传了但参数名错或值错
  修复:修正参数传递
  
分类 C:库【不支持】真太阳时
  现象:库的 API 没有 longitude/latitude 参数
  影响:必须在调用库之前自己转换
  修复:加一层转换层
```

## 验证清单

```
□ 找到现有 bazi 库的具体包名 + 版本
□ 找到所有调用点
□ 测试现有行为(同时间不同经度的结果)
□ 判断属于哪种分类(A/B/C)
□ 报告给用户决定下一步

🛑 等用户确认进入 Step 2
```

---

# 第 2 部分:Step 2 - 根据分类制定修复方案

## 如果是分类 A:库支持但没传

```
任务:

1. 修改所有调用点,传入经纬度
   
   找到所有调用 generateBazi / generateBaseAnalysis 等函数
   加入 longitude / latitude 参数
   
   例:
   await generateBaseAnalysis({
     birth_date, birth_time, gender,
     longitude,      // ⭐ 加入
     latitude,       // ⭐ 加入(可选,有些库不需要)
     timezone        // ⭐ 加入
   });

2. 修改 API 签名
   POST /api/profile/generate-base-analysis
   要求 longitude/latitude 在请求体中
   
3. 修改前端八字采集页面
   增加位置选择步骤
   见 Step 3
```

## 如果是分类 C:库不支持真太阳时

```
任务:

1. 创建真太阳时转换层
   
   新建 lib/profile/true-solar-time-converter.ts:
   
   import { calculateTrueSolarTime } from '@/lib/syncro/true-solar-time';
   
   export interface TrueSolarTimeInput {
     birth_date: string;      // 'YYYY-MM-DD'
     birth_time: string;      // 'HH:mm'
     longitude: number;
     timezone: string;
   }
   
   export function convertToTrueSolarTime(input: TrueSolarTimeInput): {
     trueSolarDate: string;   // YYYY-MM-DD
     trueSolarTime: string;   // HH:mm
     diffMinutes: number;
   } {
     // 组合本地时间为 Date 对象
     const [y, m, d] = input.birth_date.split('-').map(Number);
     const [h, min] = input.birth_time.split(':').map(Number);
     
     // 用时区信息构造 Date
     // (这里需要小心处理时区,因为出生年份可能没有夏令时等历史信息)
     const localDate = new Date(Date.UTC(y, m - 1, d, h, min));
     
     // 调整到指定时区
     const tzOffset = getTimezoneOffsetMinutes(input.timezone, localDate);
     localDate.setMinutes(localDate.getMinutes() - tzOffset);
     
     // 计算真太阳时
     const tstResult = calculateTrueSolarTime({
       localTime: localDate,
       longitude: input.longitude,
       timezone: input.timezone
     });
     
     // 格式化输出
     const tst = tstResult.trueSolarTime;
     // 转回该时区表示
     const tstInTz = adjustToTimezone(tst, input.timezone);
     
     return {
       trueSolarDate: formatDate(tstInTz),
       trueSolarTime: formatTime(tstInTz),
       diffMinutes: tstResult.diffMinutes
     };
   }

2. 在调用 bazi 库前,先转换:
   
   // lib/llm/deepseek/base-analysis.ts(或类似)
   
   export async function generateBaseAnalysis(input: {
     birth_date: string;
     birth_time: string;
     gender: 'M' | 'F';
     longitude: number;     // ⭐ 新增
     timezone: string;       // ⭐ 新增
   }) {
     // ⭐ 关键:转换为真太阳时
     const tst = convertToTrueSolarTime({
       birth_date: input.birth_date,
       birth_time: input.birth_time,
       longitude: input.longitude,
       timezone: input.timezone
     });
     
     console.log('[bazi] Original:', input.birth_date, input.birth_time);
     console.log('[bazi] True Solar:', tst.trueSolarDate, tst.trueSolarTime);
     console.log('[bazi] Diff:', tst.diffMinutes, 'minutes');
     
     // 用真太阳时调用 bazi 库
     const bazi = await callBaziLibrary({
       date: tst.trueSolarDate,
       time: tst.trueSolarTime,
       gender: input.gender
     });
     
     // 在返回的数据中记录真太阳时信息
     return {
       ...bazi,
       _tst_meta: {
         original_date: input.birth_date,
         original_time: input.birth_time,
         true_solar_date: tst.trueSolarDate,
         true_solar_time: tst.trueSolarTime,
         diff_minutes: tst.diffMinutes,
         longitude: input.longitude,
         timezone: input.timezone
       }
     };
   }
```

## 验证清单

```
□ 修复方案明确(A、B 或 C 路径)
□ 转换函数实现(如分类 C)
□ 单元测试:
  - 北京出生(几乎无差异)
  - 乌鲁木齐出生(差 2 小时)
  - 纽约出生(差几分钟)
  - 跨日界情况(00:30 出生 + 大经度差 → 可能跨日)
□ tsc 通过

🛑 等用户确认进入 Step 3
```

---

# 第 3 部分:Step 3 - 八字采集 UI 升级

## Step 3.1: 加位置选择步骤

```
现状:八字采集只问 年月日时 + 性别

需要改为:年月日时 + 性别 + 出生地

为什么需要出生地:
  - 命理排盘需要【真太阳时】
  - 真太阳时需要【出生地经度】
  - 没有出生地 → 用默认值 → 可能错

改造范围:
  /poju/session/[id]/prepare 滚轮表单
  ↓
  在性别选择后,加一个【出生地】步骤
```

## Step 3.2: 出生地 UI

```typescript
// 新建 components/profile/BirthLocationStep.tsx

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CitySearchBox } from '@/components/syncro/CitySearchBox';

interface Props {
  onSelect: (location: { 
    name: string; 
    longitude: number; 
    latitude: number; 
    timezone: string;
  }) => void;
  onSkip: () => void;
}

export function BirthLocationStep({ onSelect, onSkip }: Props) {
  const t = useTranslations('profile.birth_location');
  const [showHelp, setShowHelp] = useState(false);
  
  return (
    <div className="birth-location-step">
      <h2>{t('title')}</h2>
      <p className="subtitle">{t('subtitle')}</p>
      
      <button 
        className="why-link"
        onClick={() => setShowHelp(!showHelp)}
      >
        {t('why_link')}
      </button>
      
      {showHelp && (
        <div className="explanation">
          <p>{t('explanation_1')}</p>
          <p>{t('explanation_2')}</p>
          <p className="example">{t('explanation_example')}</p>
        </div>
      )}
      
      <CitySearchBox 
        onSelect={(city) => {
          // 从城市获取时区
          const timezone = inferTimezoneFromCity(city);
          onSelect({
            name: city.name,
            longitude: city.lng,
            latitude: city.lat,
            timezone
          });
        }}
      />
      
      <button onClick={onSkip} className="skip-button">
        {t('skip_use_default')}
      </button>
      
      {/* 默认值提示 */}
      <p className="default-note">
        {t('default_note')}
      </p>
    </div>
  );
}

function inferTimezoneFromCity(city: { lat: number; lng: number }): string {
  // 简化:用经度推算时区,精度足够
  // 更精确:用 geo-tz 库
  
  const offset = Math.round(city.lng / 15);
  const ianaMap: Record<number, string> = {
    8: 'Asia/Shanghai',
    9: 'Asia/Tokyo',
    -5: 'America/New_York',
    -8: 'America/Los_Angeles',
    0: 'Europe/London',
    1: 'Europe/Paris',
    // ... 更多映射
  };
  
  return ianaMap[offset] || 'UTC';
}
```

## Step 3.3: 翻译

```json
{
  "profile": {
    "birth_location": {
      "title": "出生地?",
      "subtitle": "为了精确的命盘计算,请告诉我们你的出生城市",
      "why_link": "为什么需要出生地?",
      "explanation_1": "命理排盘必须用【真太阳时】,而非时区平均时。",
      "explanation_2": "真太阳时取决于出生地经度。",
      "explanation_example": "例如,乌鲁木齐(新疆)使用北京时间,但真太阳时差 2 小时。如果不修正,时辰可能算错。",
      "skip_use_default": "我不确定 — 用默认值",
      "default_note": "默认会按时区中央经度计算,适用于大多数情况。"
    }
  }
}
```

```json
{
  "profile": {
    "birth_location": {
      "title": "Birth location?",
      "subtitle": "For precise chart calculation, tell us your birth city",
      "why_link": "Why birth location matters?",
      "explanation_1": "Astrological charts must use true solar time, not timezone average.",
      "explanation_2": "True solar time depends on the longitude of birth location.",
      "explanation_example": "Example: Urumqi (Xinjiang) uses Beijing time, but true solar time differs by 2 hours. Without correction, the hour pillar may be wrong.",
      "skip_use_default": "I'm not sure — use defaults",
      "default_note": "Defaults use timezone center longitude, accurate for most cases."
    }
  }
}
```

## 验证清单

```
□ BirthLocationStep 组件
□ 集成到 /prepare 流程(性别后)
□ 城市搜索工作
□ "不确定"选项 → 用默认值
□ "为什么"展开说明
□ 时区推断准确(主要城市)

🛑 等用户确认进入 Step 4
```

---

# 第 4 部分:Step 4 - 修改 API 接收位置

## Step 4.1: 修改 generate-base-analysis API

```typescript
// app/api/profile/generate-base-analysis/route.ts

export async function POST(req: Request) {
  const body = await req.json();
  
  const {
    profile_id,
    birth_date,
    birth_time,
    gender,
    longitude,      // ⭐ 新增,可选(用默认值时为 null)
    latitude,       // ⭐ 新增,可选
    timezone,       // ⭐ 新增,可选
    location_name,  // ⭐ 新增,显示用
    use_defaults    // ⭐ 是否使用默认值
  } = body;
  
  // 如果不使用默认值,但又没传位置 → 错误
  if (!use_defaults && (!longitude || !timezone)) {
    return NextResponse.json({
      error: 'invalid_location'
    }, { status: 400 });
  }
  
  // 如果使用默认值,推断
  let actualLongitude = longitude;
  let actualTimezone = timezone;
  
  if (use_defaults) {
    actualTimezone = body.user_timezone || 'UTC';
    actualLongitude = guessLongitudeFromTimezone(actualTimezone);
  }
  
  // 调用真太阳时转换 + base_analysis 生成
  const result = await generateBaseAnalysisWithTST({
    profile_id,
    birth_date,
    birth_time,
    gender,
    longitude: actualLongitude,
    timezone: actualTimezone,
    location_name: location_name || 'Default'
  });
  
  return NextResponse.json({
    success: true,
    base_analysis: result.base_analysis,
    tst_meta: result.tst_meta  // 在用户界面展示真太阳时差(可选)
  });
}

function guessLongitudeFromTimezone(tz: string): number {
  // 用时区推算"中央经度"
  // 不完美但比没有好
  const guesses: Record<string, number> = {
    'Asia/Shanghai': 120,
    'Asia/Beijing': 120,
    'Asia/Tokyo': 135,
    'Asia/Seoul': 127,
    'Asia/Singapore': 105,
    'America/New_York': -75,
    'America/Chicago': -90,
    'America/Denver': -105,
    'America/Los_Angeles': -120,
    'Europe/London': 0,
    'Europe/Paris': 15,
    'Europe/Berlin': 15,
    'Australia/Sydney': 150,
    'UTC': 0
  };
  
  return guesses[tz] ?? 0;
}
```

## Step 4.2: 修改 stored_profiles 结构

```typescript
// lib/profile/types.ts

export interface StoredProfile {
  profile_id: string;
  
  user_profile: {
    birth_date: string;
    birth_time: string;
    gender: 'M' | 'F';
    
    // ⭐ 新增字段
    birth_location?: {
      name: string;          // "Beijing, China" or "Default"
      longitude: number;
      latitude?: number;
      timezone: string;
    };
    
    // ⭐ 新增字段:真太阳时元数据
    tst_meta?: {
      original_date: string;
      original_time: string;
      true_solar_date: string;
      true_solar_time: string;
      diff_minutes: number;
      computation_version: 'v1' | 'v2_with_tst';  // 标记版本
    };
  };
  
  base_analysis: {
    content: any;
    generated_at: Date;
    
    // ⭐ 新增:标记是否用了真太阳时
    used_true_solar_time: boolean;
  };
  
  created_at: Date;
}
```

## 验证清单

```
□ API 接收 longitude/latitude/timezone
□ use_defaults 选项
□ stored_profiles 结构升级
□ 真太阳时元数据保存
□ 新生成的 profile 标记 v2_with_tst

🛑 等用户确认进入 Step 5
```

---

# 第 5 部分:Step 5 - 旧 profile 数据迁移策略

## 关键决策:旧 profile 怎么办?

```
现状:可能已经有用户生成了 profile(没用真太阳时)
风险:这些 profile 的命盘可能不准

选项分析:

选项 A:不动旧 profile
  ✓ 不破坏现有体验
  ✗ 旧用户继续用错的命盘
  
选项 B:强制重新生成
  ✗ 用户体验糟糕
  ✗ 用户可能不记得出生地
  ✗ 增加 LLM 成本
  
选项 C:温和提示
  ✓ 提示用户"升级"
  ✓ 用户主动决定
  ✓ 不强制
  ✓ 我推荐这个

具体:
  - 旧 profile 显示一个 banner:
    "🔄 We've improved chart accuracy. 
     Update with birth location for precise calculations."
  - 用户点击 → 弹出位置选择
  - 用户填了 → 重新生成 base_analysis
  - 用户忽略 → 保持原样使用
```

## Step 5.1: profile 列表显示版本标记

```typescript
// components/profile/ProfileCard.tsx(或类似)

{profile.base_analysis.used_true_solar_time ? (
  <span className="badge badge-precise">
    ✓ Precise chart
  </span>
) : (
  <button 
    className="badge badge-upgradeable"
    onClick={() => openUpgradeModal(profile)}
  >
    🔄 Upgrade for accuracy
  </button>
)}
```

## Step 5.2: 升级流程

```typescript
async function upgradeProfile(profileId: string, location: any) {
  // 1. 加载旧 profile
  const oldProfile = await getStoredProfile(profileId);
  
  // 2. 用新参数重新生成 base_analysis
  const newBaseAnalysis = await fetch('/api/profile/generate-base-analysis', {
    method: 'POST',
    body: JSON.stringify({
      profile_id: profileId,
      birth_date: oldProfile.user_profile.birth_date,
      birth_time: oldProfile.user_profile.birth_time,
      gender: oldProfile.user_profile.gender,
      longitude: location.longitude,
      latitude: location.latitude,
      timezone: location.timezone,
      location_name: location.name,
      use_defaults: false
    })
  });
  
  // 3. 更新 profile
  await updateStoredProfile(profileId, {
    user_profile: {
      ...oldProfile.user_profile,
      birth_location: location,
      tst_meta: newBaseAnalysis.tst_meta
    },
    base_analysis: {
      content: newBaseAnalysis.base_analysis,
      generated_at: new Date(),
      used_true_solar_time: true
    }
  });
  
  // 4. 提示成功 + 显示新旧对比(可选)
  showSuccessMessage({
    diff_minutes: newBaseAnalysis.tst_meta.diff_minutes,
    if_time_changed: oldProfile.bazi.hour_pillar !== newBaseAnalysis.bazi.hour_pillar
  });
}
```

## Step 5.3: 升级提示弹层

```typescript
function UpgradeModal({ profile, onClose }: { profile: any; onClose: () => void }) {
  const t = useTranslations('profile.upgrade');
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  
  return (
    <Modal onClose={onClose}>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      
      <div className="info-box">
        <strong>{t('current_chart')}</strong>
        <p>{profile.user_profile.birth_date} {profile.user_profile.birth_time}</p>
        <p className="warning">{t('using_default_warning')}</p>
      </div>
      
      <CitySearchBox 
        onSelect={setSelectedLocation}
        placeholder={t('search_birth_city')}
      />
      
      {selectedLocation && (
        <button onClick={() => upgradeProfile(profile.profile_id, selectedLocation)}>
          {t('upgrade_chart')}
        </button>
      )}
      
      <button onClick={onClose} className="text-button">
        {t('keep_old_for_now')}
      </button>
    </Modal>
  );
}
```

## Step 5.4: 翻译

```json
{
  "profile": {
    "upgrade": {
      "title": "Update for precise calculations",
      "description": "Your chart was generated without birth location, using default timezone center. Update with your actual birth city for accurate true solar time.",
      "current_chart": "Current chart",
      "using_default_warning": "Used default longitude — may have hour pillar inaccuracy",
      "search_birth_city": "Search your birth city",
      "upgrade_chart": "Update chart with this location",
      "keep_old_for_now": "Keep current chart for now"
    }
  }
}
```

## 验证清单

```
□ ProfileCard 显示版本标记
□ "Upgrade for accuracy" 按钮
□ 升级弹层工作
□ 升级后 base_analysis 重新生成
□ 显示新旧时柱对比(可选)
□ 用户可以保持旧 profile

🛑 等用户确认进入 Step 6
```

---

# 第 6 部分:Step 6 - 端到端验证

## 测试矩阵

```
【测试 1: 新建 profile - 完整流程】
  
  1. POJU /session/[id]/prepare
  2. 输入 1985-06-15 12:00 北京时间
  3. 选男
  4. 出现【出生地选择】步骤
  5. 选"Beijing"
  6. 点击继续 → 生成 base_analysis
  7. console.log 应显示:
     [bazi] Original: 1985-06-15 12:00
     [bazi] True Solar: 1985-06-15 11:46
     [bazi] Diff: -14 minutes
  8. profile 标记为 used_true_solar_time: true

【测试 2: 跨经度对比】
  
  同样出生信息(2024-06-15 12:00),不同出生地:
  
  - Beijing: 时柱应该是【午时】(差 -14 分钟,11:46 仍在午时)
  - Urumqi: 时柱应该是【巳时】(差 -2 小时,真太阳时 10:00 是巳时)
  - New York: 时柱应该是【午时】(差几分钟)
  
  生成 3 个 profile,对比时柱:
  ✓ Beijing 和 NYC 时柱相同(午)
  ✓ Urumqi 时柱不同(巳)
  ✗ 如果三个都相同 → 真太阳时没起作用!

【测试 3: 旧 profile 升级】
  
  1. 找一个标记 used_true_solar_time: false 的 profile
  2. 看到 "Upgrade for accuracy" 按钮
  3. 点击 → 弹出升级 modal
  4. 输入出生地
  5. 点击升级
  6. 旧的 base_analysis 替换为新的
  7. 标记变成 used_true_solar_time: true

【测试 4: 跨产品一致性】
  
  用同一个升级后的 profile:
  - 在 POJU 中使用 → 命盘正确
  - 在 Match 中作为 A → 命盘正确
  - 在 Match 中作为 B → 命盘正确
  - 在 Glyph 中使用 → 命盘正确
  - 在 Syncro 中使用 → 命盘正确
  
  全部产品应该看到 hour_pillar 一致

【测试 5: 默认值降级】
  
  用户没选出生地 → 用 timezone 推断
  1. 时区 Asia/Shanghai → longitude 120
  2. 时区 America/New_York → longitude -75
  3. profile 仍然能生成,只是【可能不精确】
  4. 标记 used_true_solar_time: false (或 partial?)

【测试 6: 边缘情况】
  
  - 00:30 出生 + 大经度差 → 真太阳时跨日?
    例如:乌鲁木齐 2024-06-15 00:30 北京时间
    真太阳时:2024-06-14 22:30(跨回前一天!)
    → 日柱应该是前一天
    → 测试这种情况是否正确处理
  
  - 经度边界(180°/-180°)
  - 北极圈/南极圈
  - 极少用户场景,但要确保不崩
```

## 验证清单

```
□ 6 个测试用例全部通过
□ 跨经度对比清晰
□ 升级流程顺畅
□ 跨产品一致性
□ 边缘情况不崩

🛑 等用户最终确认上线
```

---

# 第 7 部分:Step 7 - 上线策略

## 上线分阶段

```
阶段 1:代码部署但不强推(Day 1)
  - 新功能上线
  - 旧用户继续用旧 profile
  - 新用户必须选出生地(或用默认)
  - 监控错误率

阶段 2:温和引导旧用户(Day 7)
  - 已有 profile 显示 "Upgrade for accuracy"
  - 不强制
  - 用户自然发现 + 升级

阶段 3:数据观察(Day 14)
  - 多少用户升级了?
  - 升级后用户反馈?
  - 是否需要更主动的引导?

阶段 4:可选的强制(P2,谨慎)
  - 如果数据表明只有少数用户升级
  - 在关键操作(Match/Syncro)时
  - 提示"建议升级以获得更准确结果"
  - 但不强制
```

## 监控指标

```
关键指标:
  □ 新建 profile 中,有多少选了出生地 vs 用默认?
  □ 旧 profile 升级率?
  □ 升级后用户的退款率变化?
  □ 跨经度用户(乌鲁木齐等)的满意度?
  
错误监控:
  □ 真太阳时计算异常?
  □ 时区推断失败?
  □ 城市搜索 API 限流?
```

## 验证清单

```
□ 阶段 1-4 计划清晰
□ 监控指标设定
□ 错误处理完善
□ 上线就绪
```

---

# 完整任务清单

```
✅ Step 1: 排查现有 bazi 库(分类 A/B/C)
✅ Step 2: 根据分类制定修复方案
✅ Step 3: 八字采集 UI 升级(出生地)
✅ Step 4: API 接收位置 + stored_profiles 升级
✅ Step 5: 旧 profile 数据迁移(温和)
✅ Step 6: 端到端验证(6 测试)
✅ Step 7: 上线策略(分阶段)

修复结果:
  ⭐ POJU/Match/Glyph/Syncro 命盘准确性根本解决
  ⭐ 跨经度跨时区用户都准确
  ⭐ 真太阳时元数据可追溯
  ⭐ 旧 profile 温和迁移(不强制)
  ⭐ 这是【pojulife 全球化】的命理根基
```

---

# 给 Cursor 的最终提醒

```
本任务的【严重性】不容低估:

如果不修复,命理产品的【准确性根基】是坏的。
所有面向懂行用户(命理师、长辈)的宣传都站不住脚。

如果修复,pojulife 才真正是【全球可用】的:
  - 不只是【北京时间区域】的用户
  - 不只是【时区中央】的用户
  - 跨经度、跨时区都准确

实施顺序:
  Step 1: 自查(必须)→ 知道现状
  Step 2: 修复方案(必须)→ 根据分类
  Step 3-5: 实施(必须)→ 完整改造
  Step 6: 验证(必须)→ 跨经度测试
  Step 7: 上线(分阶段)→ 温和推进

完成后:
  ✓ 全球用户都能拿到精确命盘
  ✓ pojulife 命理准确性达到【专业水准】
  ✓ 跟 Syncro 真太阳时修复一起,完整闭环
```

**Cursor: 完成 Step 1-7 后,pojulife 全局命理准确性达到专业水准。**

---

# 附:与 Syncro 真太阳时修复的【关系】

```
Syncro 修复:
  ✓ Syncro 内部用真太阳时算 96 矩阵
  ✓ 见 Syncro_TrueSolarTime_Final.md

本任务:
  ✓ POJU/Match/Glyph 的命盘生成也用真太阳时
  ✓ stored_profiles 升级
  ✓ 跨产品数据一致

两者关系:
  - 共享同一个 calculateTrueSolarTime() 函数
    (在 lib/syncro/true-solar-time.ts)
  - 不需要重复实现
  - 只需在 base_analysis 生成时也调用
  - 在 Syncro 矩阵生成时已经在调用

代码复用图:
  lib/syncro/true-solar-time.ts
    ↓ used by ↓
  lib/syncro/calculate-matrix.ts (Syncro)
  lib/profile/true-solar-time-converter.ts (POJU/Match/Glyph)
```
