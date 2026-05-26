# Syncro 真太阳时 + 设备策略 + 三模式实施

> **目标**:Syncro 的最终成熟形态
>
> - 真太阳时计算(命理准确性核心)
> - PC 桌面端不允许使用(仅介绍页 + 引导手机)
> - 三模式:Compass(默认) + AR(姿势切换) + View(主动切换)
> - 时辰进度条流式显示
> - 位置获取 + 手动校正(城市搜索)
>
> **前提**:
> - Syncro v5.1 计算引擎已完成(Step 1-7)
> - Spline + 方向感应器已工作
> - 6 批并行 LLM 已实施
>
> **执行原则**:严格【一步一停】

---

# ⚠️ Cursor 必读

```
本任务是 Syncro 的【最终成熟版】

核心改进:
  ⭐ 真太阳时(影响所有 96 组合的时辰计算)
  ⭐ PC 桌面端【不能进入功能】,只显示介绍页
  ⭐ 三模式智能切换 + 用户主动选择
  ⭐ 时辰流式渲染 + 进度可视化

绝不允许:
  ✗ 让 PC 用户进入 /syncro/result(必须挡在介绍页)
  ✗ 跳过真太阳时计算(命理准确性根本)
  ✗ 跨 Step 实施

每个 Step 完成后:
  - 贴出代码 + 测试输出
  - 等用户明确"通过 Step X" 才进入下一步
```

---

# 第 1 部分:Step 1 - 设备能力检测

## Step 1.1: 创建设备检测工具

文件:`lib/syncro/device-capability.ts`(新建)

```typescript
// lib/syncro/device-capability.ts

export interface DeviceCapability {
  type: 'mobile' | 'tablet' | 'desktop';
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  hasOrientationSensor: boolean;
  hasCamera: boolean;
  hasGeolocation: boolean;
  os: 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'unknown';
}

export async function detectDeviceCapability(): Promise<DeviceCapability> {
  if (typeof window === 'undefined') {
    return {
      type: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      hasOrientationSensor: false,
      hasCamera: false,
      hasGeolocation: false,
      os: 'unknown'
    };
  }
  
  const ua = navigator.userAgent;
  
  // OS 检测
  let os: DeviceCapability['os'] = 'unknown';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'ios';
  else if (/Android/.test(ua)) os = 'android';
  else if (/Windows/.test(ua)) os = 'windows';
  else if (/Mac/.test(ua)) os = 'mac';
  else if (/Linux/.test(ua)) os = 'linux';
  
  // 设备类型(更严格的判断)
  const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTabletUA = /iPad|Tablet|PlayBook/i.test(ua) || 
                     (/Android/.test(ua) && !/Mobile/.test(ua));
  
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  let type: 'mobile' | 'tablet' | 'desktop';
  if (isTabletUA) {
    type = 'tablet';
  } else if (isMobileUA && hasTouch) {
    type = 'mobile';
  } else {
    type = 'desktop';
  }
  
  // 罗盘检测(仅当设备类型不是桌面时才尝试)
  const hasOrientationSensor = type !== 'desktop' && await checkOrientationSensor();
  
  // 摄像头检测
  const hasCamera = !!(navigator.mediaDevices?.getUserMedia);
  
  // 定位检测
  const hasGeolocation = 'geolocation' in navigator;
  
  return {
    type,
    isMobile: type === 'mobile',
    isTablet: type === 'tablet',
    isDesktop: type === 'desktop',
    hasOrientationSensor,
    hasCamera,
    hasGeolocation,
    os
  };
}

async function checkOrientationSensor(): Promise<boolean> {
  if (typeof DeviceOrientationEvent === 'undefined') return false;
  
  // iOS 13+ 需要权限,但能力是有的
  if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    return true;
  }
  
  // 其他设备:监听 500ms 看是否有数据
  return new Promise((resolve) => {
    let received = false;
    const handler = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && e.alpha !== undefined) {
        received = true;
      }
    };
    
    window.addEventListener('deviceorientation', handler);
    setTimeout(() => {
      window.removeEventListener('deviceorientation', handler);
      resolve(received);
    }, 500);
  });
}

/**
 * 简化判断:能否使用 Syncro 功能?
 * 桌面端永远不能(只显示介绍页)
 */
export function canUseSyncro(capability: DeviceCapability): boolean {
  return !capability.isDesktop;
}
```

## Step 1.2: 测试

写一个简单的 console 测试页面或在已有页面测试:

```typescript
// 在浏览器 console 跑:
import { detectDeviceCapability } from '@/lib/syncro/device-capability';
detectDeviceCapability().then(console.log);

// 预期:
// 手机 Chrome: { type: 'mobile', hasOrientationSensor: true, ... }
// iPad: { type: 'tablet', ... }
// PC: { type: 'desktop', hasOrientationSensor: false, ... }
```

## 验证清单

```
□ device-capability.ts 实现
□ 手机端 type === 'mobile'
□ iPad type === 'tablet'  
□ PC type === 'desktop'
□ 各种设备的 hasOrientationSensor 准确
□ canUseSyncro() 桌面返回 false

🛑 等用户确认进入 Step 2
```

---

# 第 2 部分:Step 2 - PC 桌面端拦截

## Step 2.1: 修改 Syncro 介绍页(保留宣传)

文件:`app/[locale]/(marketing)/syncro/page.tsx`

```
保留:
  ✓ Syncro 完整介绍(Tagline / Features / How / Pricing)
  ✓ 5 Currents 介绍
  ✓ FAQ

修改:
  ⚠️ 入口按钮"Try Syncro free"的行为:
    - 桌面用户点击 → 显示 QR 码 + "Open on your phone"
    - 手机用户点击 → 正常进入 /syncro/task
```

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { detectDeviceCapability, canUseSyncro, type DeviceCapability } from '@/lib/syncro/device-capability';
import { QRCodeCanvas } from 'qrcode.react';  // pnpm add qrcode.react

export default function SyncroHomePage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('syncro.home');
  
  const [capability, setCapability] = useState<DeviceCapability | null>(null);
  const [showQR, setShowQR] = useState(false);
  
  useEffect(() => {
    detectDeviceCapability().then(setCapability);
  }, []);
  
  function handleStart() {
    if (!capability) return;
    
    if (canUseSyncro(capability)) {
      // 手机/平板用户:正常进入
      router.push(`/${locale}/syncro/task`);
    } else {
      // PC 桌面:显示 QR 码
      setShowQR(true);
    }
  }
  
  return (
    <div className="syncro-home">
      {/* 完整介绍内容保留(Hero / Features / How / Pricing / FAQ)*/}
      
      {/* CTA 按钮 */}
      <button onClick={handleStart} className="primary-large">
        {t('cta_start')}
      </button>
      
      {/* 桌面用户专属:QR 引导 */}
      {showQR && (
        <DesktopQRModal 
          onClose={() => setShowQR(false)}
          url={typeof window !== 'undefined' ? window.location.origin + `/${locale}/syncro` : ''}
        />
      )}
    </div>
  );
}

function DesktopQRModal({ onClose, url }: { onClose: () => void; url: string }) {
  const t = useTranslations('syncro.home.desktop_modal');
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content desktop-qr-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>
        
        <h2>{t('title')}</h2>
        <p>{t('description')}</p>
        
        <div className="qr-container">
          <QRCodeCanvas 
            value={url}
            size={200}
            bgColor="#ffffff"
            fgColor="#1a0a2e"
            level="M"
          />
        </div>
        
        <div className="qr-instructions">
          <ol>
            <li>{t('step_1')}</li>
            <li>{t('step_2')}</li>
            <li>{t('step_3')}</li>
          </ol>
        </div>
        
        <p className="why">{t('why_mobile')}</p>
      </div>
    </div>
  );
}
```

## Step 2.2: 翻译

`messages/en/syncro.json` 补充:

```json
{
  "home": {
    "cta_start": "Try Syncro free",
    
    "desktop_modal": {
      "title": "Open Syncro on your phone",
      "description": "Syncro reads your phone's compass and orientation to align with real-world direction. This requires a mobile device.",
      "step_1": "Open the camera app on your phone",
      "step_2": "Scan this QR code",
      "step_3": "Tap the link to open Syncro on your phone",
      "why_mobile": "Why mobile only? Syncro needs your phone's compass, camera, and precise location — capabilities desktops don't have."
    }
  }
}
```

`messages/zh/syncro.json` 补充:

```json
{
  "home": {
    "cta_start": "免费试 Syncro",
    
    "desktop_modal": {
      "title": "请在手机上打开 Syncro",
      "description": "Syncro 需要你手机的罗盘和方向感应器来对接真实世界方位。这必须在移动设备上。",
      "step_1": "打开手机相机",
      "step_2": "扫描这个二维码",
      "step_3": "点击链接在手机上打开 Syncro",
      "why_mobile": "为什么仅限手机?Syncro 需要罗盘、摄像头和精准定位——这些桌面没有。"
    }
  }
}
```

## Step 2.3: 拦截 /syncro/task 等内页

为防止用户直接输入 URL 绕过,所有功能页都要检查:

```typescript
// 在 /syncro/task, /syncro/prepare, /syncro/location, 
// /syncro/computing, /syncro/result/[id] 顶部都加:

useEffect(() => {
  detectDeviceCapability().then(cap => {
    if (cap.isDesktop) {
      router.push(`/${locale}/syncro`);  // 强制回介绍页
    }
  });
}, []);
```

或者更优雅的,做一个 wrapper:

```typescript
// components/syncro/SyncroMobileGuard.tsx

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { detectDeviceCapability, canUseSyncro } from '@/lib/syncro/device-capability';

export function SyncroMobileGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const locale = useLocale();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  
  useEffect(() => {
    detectDeviceCapability().then(cap => {
      if (canUseSyncro(cap)) {
        setAllowed(true);
      } else {
        // 桌面用户:重定向到介绍页(会自动弹 QR 引导)
        router.replace(`/${locale}/syncro?desktop=true`);
      }
    });
  }, []);
  
  if (allowed === null) {
    return <div className="loading-fullscreen">Loading...</div>;
  }
  
  if (!allowed) return null;
  
  return <>{children}</>;
}
```

然后所有 Syncro 功能页用这个 wrapper:

```typescript
// /syncro/task/page.tsx
import { SyncroMobileGuard } from '@/components/syncro/SyncroMobileGuard';

export default function SyncroTaskPage() {
  return (
    <SyncroMobileGuard>
      {/* 原页面内容 */}
    </SyncroMobileGuard>
  );
}
```

## 验证清单

```
□ /syncro 介绍页桌面 + 手机都能看
□ 桌面点击"Try Syncro" → 弹 QR 码模态
□ 手机点击"Try Syncro" → 跳转 /syncro/task
□ 桌面直接访问 /syncro/task → 重定向回 /syncro
□ 桌面直接访问 /syncro/result/[id] → 重定向回 /syncro
□ iPad / 平板能正常进入(type === 'tablet')

🛑 等用户确认进入 Step 3
```

---

# 第 3 部分:Step 3 - 真太阳时计算引擎 ⭐⭐⭐

## Step 3.1: 创建真太阳时计算

文件:`lib/syncro/true-solar-time.ts`(新建)

```typescript
// lib/syncro/true-solar-time.ts

/**
 * 真太阳时计算
 * 
 * 命理排盘必须用真太阳时,而非时区平均时(如北京时间)
 * 
 * 原因:
 *   - 北京时间整个东 8 区共用
 *   - 但太阳实际过中天因经度不同
 *   - 误差可能达 2 小时,导致【时辰错算】
 * 
 * 公式:
 *   真太阳时 = 本地时间 + 经度时差 + 时差方程
 * 
 *   经度时差(分钟) = (本地经度 - 时区中央经度) × 4
 *   时差方程: 因地球椭圆轨道 + 黄赤交角,一年中差 -14 至 +16 分钟
 */

export interface TrueSolarTimeResult {
  trueSolarTime: Date;       // 真太阳时
  diffMinutes: number;        // 与本地时间的差值(分钟)
  longitudeDiffMinutes: number;
  eqOfTimeMinutes: number;
}

export function calculateTrueSolarTime(input: {
  localTime: Date;          // 用户本地时间(JS Date,带时区)
  longitude: number;         // 经度(东正西负,-180 ~ 180)
  timezone: string;          // 时区名,如 "Asia/Shanghai", "America/New_York"
}): TrueSolarTimeResult {
  
  const { localTime, longitude, timezone } = input;
  
  // 1. 计算时区中央经度
  // 通过时区偏移反推
  // 例:UTC+8 → 8 * 15 = 120° (东经)
  //    UTC-5 → -5 * 15 = -75° (西经)
  const tzOffsetMinutes = getTimezoneOffsetMinutes(timezone, localTime);
  const tzCenterLongitude = (tzOffsetMinutes / 60) * 15;
  
  // 2. 经度时差(分钟)
  // 每 1° 经度差 = 4 分钟时间差
  const longitudeDiffMinutes = (longitude - tzCenterLongitude) * 4;
  
  // 3. 时差方程(equation of time)
  const dayOfYear = getDayOfYear(localTime);
  const eqOfTimeMinutes = calculateEquationOfTime(dayOfYear);
  
  // 4. 真太阳时 = 本地时间 + 经度时差 + 时差方程
  const totalDiffMinutes = longitudeDiffMinutes + eqOfTimeMinutes;
  const trueSolarTime = new Date(localTime.getTime() + totalDiffMinutes * 60 * 1000);
  
  return {
    trueSolarTime,
    diffMinutes: Math.round(totalDiffMinutes * 100) / 100,
    longitudeDiffMinutes: Math.round(longitudeDiffMinutes * 100) / 100,
    eqOfTimeMinutes: Math.round(eqOfTimeMinutes * 100) / 100
  };
}

/**
 * 获取指定时区相对 UTC 的偏移(分钟)
 * 用 Intl.DateTimeFormat 精确计算(考虑夏令时)
 */
function getTimezoneOffsetMinutes(timezone: string, date: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const parts = dtf.formatToParts(date);
    const dateParts: any = {};
    for (const part of parts) {
      if (part.type !== 'literal') dateParts[part.type] = part.value;
    }
    
    const tzDate = new Date(
      `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}Z`
    );
    
    const offsetMs = tzDate.getTime() - date.getTime();
    return offsetMs / (1000 * 60);
  } catch (e) {
    // 默认 UTC
    return 0;
  }
}

/**
 * 时差方程(equation of time)
 * 单位:分钟
 * 简化公式,精度 ±1 分钟
 */
function calculateEquationOfTime(dayOfYear: number): number {
  const b = (2 * Math.PI * (dayOfYear - 81)) / 365;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
```

## Step 3.2: 测试用例

文件:`lib/syncro/__tests__/true-solar-time.test.ts`(新建)

```typescript
import { calculateTrueSolarTime } from '../true-solar-time';

describe('calculateTrueSolarTime', () => {
  it('Beijing time at Beijing should be close to local time', () => {
    // 北京经度 116.4°,时区中央 120°
    // 经度差 = (116.4 - 120) × 4 = -14.4 分钟
    const result = calculateTrueSolarTime({
      localTime: new Date('2024-06-15T12:00:00+08:00'),
      longitude: 116.4,
      timezone: 'Asia/Shanghai'
    });
    
    expect(result.longitudeDiffMinutes).toBeCloseTo(-14.4, 1);
    // 真太阳时大约 11:45-46(差 -14 ± 时差方程)
  });
  
  it('Urumqi (XJ) should be drastically different from Beijing time', () => {
    // 乌鲁木齐经度 87.6°,时区仍是东 8 区
    // 经度差 = (87.6 - 120) × 4 = -129.6 分钟 ≈ -2 小时
    const result = calculateTrueSolarTime({
      localTime: new Date('2024-06-15T12:00:00+08:00'),
      longitude: 87.6,
      timezone: 'Asia/Shanghai'
    });
    
    expect(result.longitudeDiffMinutes).toBeCloseTo(-129.6, 0);
    // 真太阳时应该接近 10:00
  });
  
  it('New York', () => {
    // 纽约经度 -74°,时区中央 -75°(东部时区)
    // 经度差 = (-74 - -75) × 4 = 4 分钟
    const result = calculateTrueSolarTime({
      localTime: new Date('2024-06-15T12:00:00-04:00'),  // EDT
      longitude: -74.0,
      timezone: 'America/New_York'
    });
    
    expect(Math.abs(result.longitudeDiffMinutes)).toBeLessThan(10);
  });
  
  it('San Francisco should differ by ~6-7 minutes', () => {
    // 旧金山经度 -122.4°,时区中央 -120°(太平洋时区)
    // 经度差 = (-122.4 - -120) × 4 = -9.6 分钟
    const result = calculateTrueSolarTime({
      localTime: new Date('2024-06-15T12:00:00-07:00'),  // PDT
      longitude: -122.4,
      timezone: 'America/Los_Angeles'
    });
    
    expect(result.longitudeDiffMinutes).toBeCloseTo(-9.6, 0);
  });
  
  it('Equation of time should vary across year', () => {
    // 2 月初 EoT 约 -14 分钟
    // 11 月初 EoT 约 +16 分钟
    
    const feb = calculateTrueSolarTime({
      localTime: new Date('2024-02-05T12:00:00+08:00'),
      longitude: 120.0,  // 时区中央,无经度差
      timezone: 'Asia/Shanghai'
    });
    
    const nov = calculateTrueSolarTime({
      localTime: new Date('2024-11-05T12:00:00+08:00'),
      longitude: 120.0,
      timezone: 'Asia/Shanghai'
    });
    
    expect(feb.eqOfTimeMinutes).toBeLessThan(-10);
    expect(nov.eqOfTimeMinutes).toBeGreaterThan(10);
  });
});
```

## 验证清单

```
□ true-solar-time.ts 实现
□ 5 个测试通过:
  - 北京(略偏)
  - 乌鲁木齐(差 2 小时)
  - 纽约(略偏)
  - 旧金山(略偏)
  - 时差方程(2 月负 / 11 月正)
□ tsc 通过

🛑 等用户确认进入 Step 4
```

---

# 第 4 部分:Step 4 - 集成真太阳时到计算引擎

## Step 4.1: 修改 calculate-matrix.ts

```typescript
// lib/syncro/calculate-matrix.ts

import { calculateTrueSolarTime } from './true-solar-time';

export function calculateSyncroMatrix(input: {
  profile: any;
  taskDescription: string;
  startTime: Date;
  userTimezone: string;
  userLongitude: number;    // ⭐ 新增必填
  userLatitude: number;     // ⭐ 新增必填
}): {
  matrix: Record<string, MatrixCell>;
  metadata: {
    localTime: string;
    trueSolarTime: string;
    diffMinutes: number;
    longitude: number;
    latitude: number;
  };
} {
  
  // ⭐⭐⭐ 关键:计算真太阳时
  const tstResult = calculateTrueSolarTime({
    localTime: input.startTime,
    longitude: input.userLongitude,
    timezone: input.userTimezone
  });
  
  console.log('[syncro] Local time:', input.startTime.toISOString());
  console.log('[syncro] True solar time:', tstResult.trueSolarTime.toISOString());
  console.log('[syncro] Diff (mins):', tstResult.diffMinutes);
  console.log('[syncro] Longitude diff:', tstResult.longitudeDiffMinutes);
  console.log('[syncro] Equation of time:', tstResult.eqOfTimeMinutes);
  
  // 用真太阳时计算 12 时辰
  const hourPeriods = generateNext12HourPeriods(tstResult.trueSolarTime);
  
  // 其他原有逻辑保持
  const yongShenWuXing = extractYongShenWuXing(input.profile);
  const dayMasterWuXing = extractDayMasterWuXing(input.profile);
  const taskKeywords = extractTaskKeywords(input.taskDescription);
  
  const matrix: Record<string, MatrixCell> = {};
  
  for (const period of hourPeriods) {
    for (const direction of Object.keys(DIRECTIONS) as DirectionId[]) {
      const factors = calculateCombinationScore({
        yongShenWuXing,
        dayMasterWuXing,
        hourPeriod: period.id,
        direction,
        combinationTime: period.start,  // 已是真太阳时
        taskKeywords
      });
      
      // ... 原有逻辑
    }
  }
  
  return {
    matrix,
    metadata: {
      localTime: input.startTime.toISOString(),
      trueSolarTime: tstResult.trueSolarTime.toISOString(),
      diffMinutes: tstResult.diffMinutes,
      longitude: input.userLongitude,
      latitude: input.userLatitude
    }
  };
}
```

## Step 4.2: 修改 LLM Prompt 注入真太阳时信息

```typescript
// lib/llm/prompts/syncro-deepseek-prompt.ts

// 在 system prompt 中加:

const trueSolarSection = `
# ⭐ 真太阳时背景

用户位置:经度 ${userLongitude}°, 纬度 ${userLatitude}°
用户本地时间:${localTime}
真太阳时:${trueSolarTime}
真太阳时与本地时间差:${diffMinutes} 分钟

矩阵中的【时辰】已经基于真太阳时计算,
不是本地时区平均时。

如果在 rationale 中需要解释时辰,可以提到:
"基于你所在位置的真太阳时(${diffMinutes > 0 ? '+' : ''}${diffMinutes} 分钟相对本地时间)..."

或简化为:
"本时辰基于你的真实地理位置计算..."
`;
```

## Step 4.3: 修改 API 路由

```typescript
// app/api/syncro/compute/route.ts

export async function POST(req: Request) {
  const body = await req.json();
  
  const {
    profile_id,
    task_description,
    user_location,  // ⭐ 必须包含 latitude + longitude + timezone
    locale
  } = body;
  
  // 校验
  if (!user_location?.latitude || !user_location?.longitude || !user_location?.timezone) {
    return NextResponse.json({
      error: 'invalid_location',
      message: 'Latitude, longitude, and timezone are required.'
    }, { status: 400 });
  }
  
  const result = await generateSyncroMatrix({
    profile_id,
    task_description,
    user_location,
    locale
  });
  
  return NextResponse.json({
    success: true,
    matrix: result.matrix,
    meta: {
      ...result.meta,
      true_solar_time_diff_minutes: result.metadata?.diffMinutes
    }
  });
}
```

## 验证清单

```
□ calculate-matrix.ts 集成真太阳时
□ Console.log 显示时间差
□ LLM prompt 含真太阳时信息
□ API 强制要求经纬度
□ 测试:乌鲁木齐用户结果跟北京用户【时辰边界不同】

🛑 等用户确认进入 Step 5
```

---

# 第 5 部分:Step 5 - 位置获取流程升级

## Step 5.1: 修改 /syncro/location 页面

```typescript
// app/[locale]/(marketing)/syncro/location/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { SyncroMobileGuard } from '@/components/syncro/SyncroMobileGuard';
import { CitySearchBox } from '@/components/syncro/CitySearchBox';

export default function SyncroLocationPage() {
  return (
    <SyncroMobileGuard>
      <LocationContent />
    </SyncroMobileGuard>
  );
}

function LocationContent() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('syncro.location');
  
  const [stage, setStage] = useState<'asking' | 'auto_got' | 'manual_search' | 'confirm' | 'denied'>('asking');
  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
    source: 'geolocation' | 'manual';
    city_name?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  function tryGeolocation() {
    if (!navigator.geolocation) {
      setStage('manual_search');
      return;
    }
    
    setStage('asking');
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'geolocation'
        });
        setStage('confirm');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStage('manual_search');  // 让用户手动选
        } else {
          setError(err.message);
          setStage('denied');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  }
  
  function handleManualSelect(city: { name: string; lat: number; lng: number }) {
    setLocation({
      lat: city.lat,
      lng: city.lng,
      source: 'manual',
      city_name: city.name
    });
    setStage('confirm');
  }
  
  function handleConfirm() {
    if (!location) return;
    
    sessionStorage.setItem('syncro_location', JSON.stringify({
      ...location,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }));
    
    router.push(`/${locale}/syncro/computing`);
  }
  
  useEffect(() => {
    if (stage === 'asking') {
      tryGeolocation();
    }
  }, []);
  
  return (
    <div className="syncro-location-page">
      {stage === 'asking' && (
        <AskingView />
      )}
      
      {stage === 'manual_search' && (
        <ManualSearchView 
          onSelect={handleManualSelect}
          onRetry={tryGeolocation}
        />
      )}
      
      {stage === 'confirm' && location && (
        <ConfirmView 
          location={location}
          onConfirm={handleConfirm}
          onChangeLocation={() => setStage('manual_search')}
        />
      )}
      
      {stage === 'denied' && (
        <DeniedView error={error} onRetry={tryGeolocation} onManual={() => setStage('manual_search')} />
      )}
    </div>
  );
}

function AskingView() {
  const t = useTranslations('syncro.location');
  return (
    <div className="location-asking">
      <div className="loading-spinner" />
      <h2>{t('asking_title')}</h2>
      <p>{t('asking_message')}</p>
      <p className="hint">{t('asking_privacy')}</p>
    </div>
  );
}

function ManualSearchView({ onSelect, onRetry }: any) {
  const t = useTranslations('syncro.location');
  return (
    <div className="location-manual">
      <h2>{t('manual_title')}</h2>
      <p>{t('manual_description')}</p>
      
      <CitySearchBox onSelect={onSelect} />
      
      <button onClick={onRetry} className="text-button">
        {t('retry_geolocation')}
      </button>
    </div>
  );
}

function ConfirmView({ location, onConfirm, onChangeLocation }: any) {
  const t = useTranslations('syncro.location');
  
  return (
    <div className="location-confirm">
      <div className="success-icon">📍</div>
      
      <h2>{t('confirm_title')}</h2>
      
      {location.city_name ? (
        <p className="city">{location.city_name}</p>
      ) : (
        <p className="coords">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
      )}
      
      {location.accuracy && location.accuracy > 1000 && (
        <p className="accuracy-warning">
          ⚠️ {t('accuracy_warning', { meters: Math.round(location.accuracy) })}
        </p>
      )}
      
      <p className="hint">{t('confirm_hint')}</p>
      
      <button onClick={onConfirm} className="primary-large">
        {t('confirm_use')}
      </button>
      
      <button onClick={onChangeLocation} className="text-button">
        {t('change_location')}
      </button>
    </div>
  );
}

function DeniedView({ error, onRetry, onManual }: any) {
  const t = useTranslations('syncro.location');
  return (
    <div className="location-denied">
      <div className="error-icon">⚠️</div>
      <h2>{t('denied_title')}</h2>
      <p>{t('denied_message')}</p>
      {error && <p className="error-detail">{error}</p>}
      
      <button onClick={onRetry} className="primary">{t('retry')}</button>
      <button onClick={onManual} className="text-button">{t('search_manually')}</button>
    </div>
  );
}
```

## Step 5.2: 城市搜索组件

文件:`components/syncro/CitySearchBox.tsx`(新建)

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';

interface CityResult {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

export function CitySearchBox({ onSelect }: { onSelect: (city: CityResult) => void }) {
  const t = useTranslations('syncro.location');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 防抖搜索
  const search = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      
      setLoading(true);
      try {
        const response = await fetch(`/api/syncro/search-city?q=${encodeURIComponent(q)}`);
        const data = await response.json();
        setResults(data.results || []);
      } catch (e) {
        console.error('[city-search] error', e);
      } finally {
        setLoading(false);
      }
    }, 400),
    []
  );
  
  return (
    <div className="city-search">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input 
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
          }}
          placeholder={t('city_search_placeholder')}
          autoFocus
        />
        {loading && <span className="search-spinner" />}
      </div>
      
      {results.length > 0 && (
        <ul className="city-results">
          {results.map(city => (
            <li key={city.id}>
              <button onClick={() => onSelect(city)}>
                <span className="city-name">{city.name}</span>
                <span className="city-coords">
                  {city.lat.toFixed(2)}, {city.lng.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      
      {query.length >= 2 && results.length === 0 && !loading && (
        <p className="no-results">{t('no_cities_found')}</p>
      )}
    </div>
  );
}

function debounce<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  }) as T;
}
```

## Step 5.3: 城市搜索 API

文件:`app/api/syncro/search-city/route.ts`(新建)

```typescript
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }
  
  try {
    // 调用 OpenStreetMap Nominatim(免费,但要遵守使用条款)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` + 
      new URLSearchParams({
        q: query,
        format: 'json',
        limit: '8',
        'accept-language': 'zh,en'
      }),
      {
        headers: {
          'User-Agent': 'pojulife/1.0 (https://pojulife.com)'
        }
      }
    );
    
    if (!response.ok) {
      return NextResponse.json({ error: 'search_failed' }, { status: 500 });
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      results: data.map((r: any) => ({
        id: r.place_id,
        name: r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        type: r.type
      }))
    });
  } catch (e) {
    console.error('[search-city] error', e);
    return NextResponse.json({ error: 'search_failed' }, { status: 500 });
  }
}
```

## Step 5.4: 翻译

```json
// messages/en/syncro.json - location 节

{
  "location": {
    "asking_title": "Detecting your location...",
    "asking_message": "Syncro uses your location for precise true solar time and direction.",
    "asking_privacy": "Used only for this session. Never stored.",
    
    "manual_title": "Choose your location",
    "manual_description": "Search and select your current city for accurate timing.",
    "city_search_placeholder": "Search city (e.g., New York, Beijing, Tokyo)",
    "no_cities_found": "No cities found. Try a different spelling.",
    "retry_geolocation": "Try detecting again",
    
    "confirm_title": "Use this location?",
    "confirm_hint": "Syncro will use this for accurate timing and direction.",
    "confirm_use": "Use this location",
    "change_location": "Choose a different location",
    "accuracy_warning": "Detected position is approximate (~{meters}m). Consider searching your city for accuracy.",
    
    "denied_title": "Location access denied",
    "denied_message": "Without your location, Syncro can't calculate precise timing. Please allow location access or search your city manually.",
    "retry": "Try again",
    "search_manually": "Search city manually"
  }
}
```

## 验证清单

```
□ /syncro/location 页面工作
□ Geolocation 自动获取
□ 用户拒绝 → 城市搜索备选
□ 城市搜索 API 工作(OpenStreetMap)
□ 精度警告显示(室内/IP 定位时)
□ 用户可以修改位置
□ 确认后存 sessionStorage(含 timezone)

🛑 等用户确认进入 Step 6
```

---

# 第 6 部分:Step 6 - 三模式 UI 实施

## 这部分内容较长,直接复用我们之前讨论的设计

```
任务:实施三模式 UI

参考:之前对话中的【双模式 + 智能切换】设计

主要文件:
  components/syncro/SyncroMainView.tsx (主控)
  components/syncro/SyncroCompassMode.tsx (罗盘)
  components/syncro/SyncroARMode.tsx (摄像头)
  components/syncro/SyncroViewMode.tsx (9 宫格)
  components/syncro/HourProgressBar.tsx (时辰进度)
  components/syncro/ModeSwitcher.tsx (模式切换)

核心逻辑:
  - 默认 Compass
  - 平放(beta > 60°) → Compass
  - 竖起(beta < 30°) → AR
  - 底部按钮切换 View
  - 时辰进度条显示生成状态

智能默认:
  根据 sessionStorage 的 syncro_task_time:
    'now' → Compass
    其他 → View

详细代码见上次对话讨论(优化 1-8)
完整实施约 800-1000 行代码
```

## 验证清单

```
□ 默认进入 Compass 模式
□ 平放手机 → Compass
□ 竖起手机 → AR(摄像头权限)
□ 底部切换 → View(9 宫格)
□ 时辰进度条 4 状态显示
□ 自动时辰切换有动画
□ 用户手动切换时辰
□ View 中央 YOU 显示推荐方位

🛑 等用户确认进入 Step 7
```

---

# 第 7 部分:Step 7 - 端到端测试

## 测试矩阵

```
设备类型:
  □ iPhone (mobile)
  □ Android (mobile)
  □ iPad (tablet)
  □ Mac Safari (desktop)
  □ Windows Chrome (desktop)

测试用例:

【场景 1: PC 桌面拦截】
  1. PC 访问 /syncro → 看到完整介绍
  2. 点击"Try Syncro free" → 弹 QR 码模态
  3. 直接输入 /syncro/task → 自动重定向回 /syncro
  4. 直接输入 /syncro/result/[id] → 自动重定向

【场景 2: 手机 - 北京用户】
  1. 手机访问 /syncro → 看到介绍
  2. 点击"Try Syncro free" → /syncro/task
  3. 输入任务 + 选 profile
  4. /syncro/location → 自动获取位置
  5. /syncro/computing → 看到 console.log:
     - Local time: 2024-XX
     - True solar time: 2024-XX (差 ~14 分钟)
  6. /syncro/result/[id] → 默认 Compass 模式
  7. 平放手机 → Compass + 方向感应
  8. 竖起手机 → AR + 摄像头
  9. 点击底部 View → 9 宫格
  10. 切换时辰 → 数据正确

【场景 3: 手机 - 乌鲁木齐用户(关键!)】
  1. 用浏览器 DevTools 模拟新疆位置(经度 87.6°)
  2. 同样流程
  3. console.log 应显示:
     - Local time: 北京时间
     - True solar time: 真太阳时(差 ~-130 分钟!)
  4. 矩阵中的时辰边界跟北京用户【完全不同】

【场景 4: 手机 - 地理位置拒绝】
  1. 拒绝 Geolocation 权限
  2. 自动进入城市搜索
  3. 输入"New York" → 选 NYC
  4. 确认后进入计算
  5. 用 NYC 经纬度计算真太阳时

【场景 5: 手机 - 桌面任务】
  1. /syncro/task 选"明天"
  2. 完成后 → /syncro/result
  3. 默认应为 View 模式(规划场景)
  4. 用户可切换 Compass

【场景 6: iPad】
  1. iPad 应该被识别为 tablet(不是 desktop)
  2. 可以正常使用 Syncro
  3. iPad 可能没罗盘 → 只显示 View?
  
【场景 7: 真太阳时验证】
  数据库 console.log 检查:
  - 乌鲁木齐(87°): diff ≈ -130 分钟
  - 北京(116°): diff ≈ -16 分钟
  - 纽约(-74°): diff ≈ +4 分钟
  - 旧金山(-122°): diff ≈ -10 分钟

【场景 8: LLM 引用真太阳时】
  打开任意结果,看 rationale 是否提到位置/时辰真实性
```

## 验证清单

```
□ 8 个场景全部通过
□ 真太阳时计算各位置都正确
□ PC 桌面完全拦截
□ 手机/平板正常使用
□ 三模式切换流畅
□ 城市搜索备选可用

🛑 等用户最终确认 Syncro 上线就绪
```

---

# 完整任务清单

```
✅ Step 1: 设备能力检测
✅ Step 2: PC 桌面端拦截 + QR 引导
✅ Step 3: 真太阳时计算引擎
✅ Step 4: 集成到 calculate-matrix
✅ Step 5: 位置获取升级 + 城市搜索
✅ Step 6: 三模式 UI(Compass/AR/View)
✅ Step 7: 端到端测试

核心收获:
  ⭐ 命理准确性根本解决(真太阳时)
  ⭐ PC 用户优雅引导(不能用但能看)
  ⭐ 三模式覆盖全场景(沉浸+规划)
  ⭐ 全球用户都准(跨时区跨经度)
```

---

**Cursor: 完成 Step 1-7 后,Syncro 最终形态上线。**
