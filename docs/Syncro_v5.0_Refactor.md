# Syncro v5.0 重构指令 · Cursor 完整任务

> **目标**:Syncro 重构为实时方位测算工具
>
> - 复用 POJU 八字采集系统
> - Spline 3D 粒子圆动效(fangwei.splinecode)
> - 手机方向感应器实时旋转
> - VR 模式(摄像头视框)
> - 全新 Current 5 等级体系(替代"吉凶")
> - 24 小时窗口 + 12 时辰自动刷新
> - $4.99 / 次,首次免费
>
> **前提**:
> - POJU v5.0 已完成
> - Glyph v5.0 已完成
> - stored_profiles + ProfileSelector + ORIENTAL_COUNSELOR_BASE + Archive 已就绪
>
> **执行原则**:严格【一步一停】

---

# ⚠️ Cursor 必读

```
Syncro 是三件套中【最复杂的产品】:

技术栈:
  ✓ Spline 3D (@splinetool/react-spline)
  ✓ DeviceOrientation API (方向感应器)
  ✓ Geolocation API (定位)
  ✓ getUserMedia API (摄像头,VR 模式)
  ✓ HTTPS 必需(所有手机 API)
  
产品哲学(关键!):
  Syncro 不是"24 小时方位预测",
  是【实时陪伴】用户穿越每一个时辰。
  
  ✓ 后台一次性算完 12 时辰 × 8 方位 = 96 组合
  ✓ 前端【只显示当前时辰】(永远不显示未来时辰)
  ✓ 每 2 小时自动刷新
  ✓ 用户回来 12 次 / 24 小时 = 强复访
  ✓ $4.99 = 这 24 小时的实时陪伴

绝不允许:
  ✗ 一次性显示 24 小时全部建议
  ✗ 用"吉凶"中文术语(用 Current 5 等级)
  ✗ 降级到桌面(老手机直接不支持)
  ✗ 跨 Step 实施
  ✗ 重写 POJU 八字采集(必须复用)

每个 Step 完成后:
  - 贴出代码 + 测试输出
  - 等用户明确"通过 Step X,进入 Step X+1"
```

---

# 第 1 部分:Step 1 - 现状自查 + 清理

## Step 1:Syncro 当前状态

```
任务:

1. 列出以下文件状态:

   Syncro 路由:
   □ app/[locale]/(marketing)/syncro/page.tsx
   □ app/[locale]/(marketing)/syncro/* (所有)
   □ app/api/syncro/* (所有)
   
   Syncro 组件:
   □ components/syncro/* (所有)
   
   Syncro 数据/逻辑:
   □ lib/syncro/* (所有)
   □ lib/llm/syncro-prompts.ts (如有)

2. 列出当前实现概况:
   - 是否已有付费流程?
   - 是否已用 stored_profiles?
   - LLM 当前是谁?
   - UI 当前是什么样子?

3. 检查依赖:
   - 是否已安装 @splinetool/react-spline?
     grep "@splinetool" package.json
   - 如未安装,等 Step 2 安装

4. 检查上传的 Spline 文件:
   ls -la public/fangwei.splinecode (如已上传)
   或检查 user uploads 中是否有此文件

5. 报告:
   - 哪些可保留
   - 哪些必须删除
   - 哪些重写
   - 当前阻塞问题

6. ⚠️ 不立即改代码,只做诊断报告

完成后贴报告等用户确认。
```

## 验证清单

```
□ Syncro 文件清单完整
□ 报告 LLM 当前状态
□ 报告 Spline 安装状态
□ 报告 fangwei.splinecode 位置
□ 列出待清理 / 待重写 / 待保留

🛑 等用户确认进入 Step 2
```

---

# 第 2 部分:Step 2 - 清理 + 准备依赖

## Step 2.1: 删除旧实现

```
任务:

1. 删除冲突的旧文件:
   git rm lib/llm/syncro-prompts.ts (如有)
   git rm components/syncro/SyncroChatUI.tsx (如有)
   git rm components/syncro/SyncroAR.tsx (如有)
   
   ⚠️ 只删旧的 / 冲突的,不动 stored_profiles 等共享文件

2. 创建空文件占位:
   touch lib/llm/prompts/syncro-deepseek-prompt.ts
   touch lib/llm/services/syncro-reading-service.ts
   touch lib/syncro/types.ts
   touch lib/syncro/current-system.ts
   touch lib/syncro/device-usage.ts
   touch lib/syncro/syncro-session.ts
   touch components/syncro/SyncroMainView.tsx
   touch components/syncro/SyncroSplineCanvas.tsx
   touch components/syncro/SyncroOrientationProvider.tsx
   touch components/syncro/SyncroVRMode.tsx
   touch components/syncro/SyncroTimerBar.tsx
```

## Step 2.2: 安装依赖

```bash
pnpm add @splinetool/react-spline @splinetool/runtime
```

## Step 2.3: 上传 Spline 动效文件

```
任务:

1. 将 fangwei.splinecode 放到 public/spline/fangwei.splinecode
2. 确认可访问:
   curl http://localhost:3000/spline/fangwei.splinecode 应返回 9.4KB 二进制数据
```

## Step 2.4: 创建 device_usage 表

文件:`lib/db/poju-db.ts`(在已有 db 文件中扩展)

```typescript
// 在 PojulifeDB 中新增 device_usage 表

export interface DeviceUsageRecord {
  // 复合主键: device_id + product
  id: string;  // `${device_id}__${product}`
  
  device_id: string;
  product: 'glyph' | 'syncro' | 'match';
  
  free_used: boolean;
  free_used_at?: Date;
  paid_count: number;
  
  last_used_at: Date;
  total_cost_usd: number;
}

class PojulifeDB extends Dexie {
  // ... 已有表
  device_usage!: Table<DeviceUsageRecord, string>;
  
  constructor() {
    super('pojulife_v4');
    
    // 升级到 v4
    this.version(4).stores({
      // 已有表保留
      device_usage: 'id, device_id, product, last_used_at'
    });
  }
}
```

## Step 2.5: 提交 git

```bash
git add .
git commit -m "chore: prepare Syncro v5.0 - cleanup + Spline dependency"
```

## 验证清单

```
□ 旧文件已删除
□ 新空文件已创建(11 个)
□ @splinetool/react-spline 已安装
□ fangwei.splinecode 已放入 public/spline/
□ device_usage 表加入 IndexedDB(v4)
□ git commit 完成

🛑 等用户确认进入 Step 3
```

---

# 第 3 部分:Step 3 - Current 5 等级系统

## Step 3:lib/syncro/current-system.ts

```typescript
// lib/syncro/current-system.ts

export type CurrentLevel = 
  | 'open_current'        // 顺势 - 大吉
  | 'following_current'   // 应时 - 吉
  | 'stillwater'          // 守静 - 平
  | 'crosscurrent'        // 横阻 - 凶
  | 'undertow';           // 险滞 - 大凶

export interface CurrentLevelInfo {
  level: CurrentLevel;
  
  // 命名
  name_en: string;
  name_zh: string;
  
  // 主色调
  color_hex: string;
  
  // 默认行动建议(英文 / 中文)
  default_advice_en: string;
  default_advice_zh: string;
  
  // 数值(用于内部排序)
  score: number;  // 5=最好, 1=最差
}

export const CURRENT_LEVELS: Record<CurrentLevel, CurrentLevelInfo> = {
  open_current: {
    level: 'open_current',
    name_en: 'Open Current',
    name_zh: '顺势',
    color_hex: '#0D7377',  // Deep Teal
    default_advice_en: 'Move with confidence — the current is fully with you.',
    default_advice_zh: '水势全顺,放胆而行。',
    score: 5
  },
  following_current: {
    level: 'following_current',
    name_en: 'Following Current',
    name_zh: '应时',
    color_hex: '#26A69A',  // Teal
    default_advice_en: 'The current supports you, with effort.',
    default_advice_zh: '水势相助,稍加用力。',
    score: 4
  },
  stillwater: {
    level: 'stillwater',
    name_en: 'Stillwater',
    name_zh: '守静',
    color_hex: '#90A4AE',  // Blue Grey
    default_advice_en: 'The water is still. Pause and observe.',
    default_advice_zh: '水静无波,静观待时。',
    score: 3
  },
  crosscurrent: {
    level: 'crosscurrent',
    name_en: 'Crosscurrent',
    name_zh: '横阻',
    color_hex: '#F57C00',  // Amber
    default_advice_en: 'Crosscurrent. Reconsider this direction or moment.',
    default_advice_zh: '逆水横流,慎择此时此位。',
    score: 2
  },
  undertow: {
    level: 'undertow',
    name_en: 'Undertow',
    name_zh: '险滞',
    color_hex: '#C62828',  // Deep Red
    default_advice_en: 'Strong undertow. Hold back and choose another path.',
    default_advice_zh: '暗流险滞,且退守,另谋时位。',
    score: 1
  }
};

export function getCurrentLevelInfo(level: CurrentLevel): CurrentLevelInfo {
  return CURRENT_LEVELS[level];
}

// 8 方位定义
export type DirectionId = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface DirectionInfo {
  id: DirectionId;
  
  name_en: string;
  name_zh: string;
  
  // 角度范围(罗盘方向,0-360°,0=北)
  center_degree: number;  // 中心角度
  
  // 八卦对应(用于传统命理)
  bagua: string;
  bagua_meaning: string;
}

export const DIRECTIONS: Record<DirectionId, DirectionInfo> = {
  N:  { id: 'N',  name_en: 'North',     name_zh: '正北', center_degree: 0,   bagua: '坎', bagua_meaning: '水' },
  NE: { id: 'NE', name_en: 'Northeast', name_zh: '东北', center_degree: 45,  bagua: '艮', bagua_meaning: '山' },
  E:  { id: 'E',  name_en: 'East',      name_zh: '正东', center_degree: 90,  bagua: '震', bagua_meaning: '雷' },
  SE: { id: 'SE', name_en: 'Southeast', name_zh: '东南', center_degree: 135, bagua: '巽', bagua_meaning: '风' },
  S:  { id: 'S',  name_en: 'South',     name_zh: '正南', center_degree: 180, bagua: '离', bagua_meaning: '火' },
  SW: { id: 'SW', name_en: 'Southwest', name_zh: '西南', center_degree: 225, bagua: '坤', bagua_meaning: '地' },
  W:  { id: 'W',  name_en: 'West',      name_zh: '正西', center_degree: 270, bagua: '兑', bagua_meaning: '泽' },
  NW: { id: 'NW', name_en: 'Northwest', name_zh: '西北', center_degree: 315, bagua: '乾', bagua_meaning: '天' }
};

/**
 * 根据罗盘角度,返回当前指向的方位
 * 使用自适应过渡(在边界处有平滑混合)
 */
export function compassToDirection(degree: number): {
  primary: DirectionId;
  primary_weight: number;  // 0-1,如果在中心是 1
  secondary?: DirectionId;
  secondary_weight?: number;
} {
  // 归一化到 0-360
  const normalized = ((degree % 360) + 360) % 360;
  
  // 8 方位,每个 45°
  // N 中心 = 0° (覆盖 -22.5° 到 22.5°)
  // NE 中心 = 45° (覆盖 22.5° 到 67.5°)
  // ...
  
  const sectorIndex = Math.floor(((normalized + 22.5) % 360) / 45);
  const directionIds: DirectionId[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  
  const primary = directionIds[sectorIndex];
  const primaryCenter = sectorIndex * 45;
  
  // 计算偏离中心的程度
  let offset = normalized - primaryCenter;
  if (offset > 180) offset -= 360;
  if (offset < -180) offset += 360;
  
  // primary_weight 在中心是 1,在边界(±22.5°)是 0.5
  const primary_weight = 1 - (Math.abs(offset) / 45);
  
  // 如果偏离 > 11.25°(中心区外),返回 secondary
  let secondary: DirectionId | undefined;
  let secondary_weight: number | undefined;
  
  if (Math.abs(offset) > 11.25) {
    if (offset > 0) {
      // 偏向下一个方位
      const nextIdx = (sectorIndex + 1) % 8;
      secondary = directionIds[nextIdx];
      secondary_weight = 1 - primary_weight;
    } else {
      // 偏向上一个方位
      const prevIdx = (sectorIndex - 1 + 8) % 8;
      secondary = directionIds[prevIdx];
      secondary_weight = 1 - primary_weight;
    }
  }
  
  return {
    primary,
    primary_weight,
    secondary,
    secondary_weight
  };
}
```

## 验证清单

```
□ current-system.ts 实现
□ 5 个 Current Level 定义完整
□ 8 个方位定义完整(8 卦对应)
□ compassToDirection 函数实现
□ tsc --noEmit 通过

测试:
  console.log(compassToDirection(0));    // 应返回 N
  console.log(compassToDirection(45));   // 应返回 NE
  console.log(compassToDirection(67));   // 应返回 NE (主) + E (副)
  console.log(compassToDirection(360));  // 应返回 N
  console.log(compassToDirection(-30));  // 归一化处理

🛑 等用户确认进入 Step 4
```

---

# 第 4 部分:Step 4 - Syncro Session 数据结构

## Step 4.1: lib/syncro/types.ts

```typescript
// lib/syncro/types.ts

import type { CurrentLevel, DirectionId } from './current-system';

// 12 时辰
export type HourPeriod = 
  | 'zi' | 'chou' | 'yin' | 'mao' | 'chen' | 'si'
  | 'wu' | 'wei' | 'shen' | 'you' | 'xu' | 'hai';

export interface SyncroSession {
  session_id: string;
  device_id: string;
  profile_id: string;
  
  // 用户输入
  task_description: string;  // 30-100 字
  user_location: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  
  // 时间窗口(24 小时)
  created_at: Date;
  expires_at: Date;
  
  // 96 组合(12 时辰 × 8 方位)
  matrix: SyncroMatrix;
  
  // 元数据
  locale: string;
  is_free: boolean;
  cost_usd: number;
  llm_meta: {
    model: string;
    tokens_used: number;
    latency_ms: number;
  };
}

export type SyncroMatrix = {
  // 12 时辰 × 8 方位 = 96 个组合
  // key: `${hour_period}__${direction_id}`
  // value: 组合的完整分析
  [key: string]: SyncroCombination;
};

export interface SyncroCombination {
  hour_period: HourPeriod;
  direction_id: DirectionId;
  
  // 时辰起止(用于显示倒计时)
  hour_start_iso: string;  // ISO 时间
  hour_end_iso: string;
  
  // 等级
  current_level: CurrentLevel;
  
  // 行动建议(用户语言)
  short_advice: string;     // 30-50 字,默认显示
  detailed_advice: string;  // 100-200 字,展开显示
  
  // 命理依据
  rationale: string;  // 100-200 字,说明为什么是这个等级
}

// 12 时辰元数据
export interface HourPeriodInfo {
  id: HourPeriod;
  name_zh: string;
  name_en: string;
  start_hour: number;  // 0-23
  end_hour: number;
}

export const HOUR_PERIODS: Record<HourPeriod, HourPeriodInfo> = {
  zi:   { id: 'zi',   name_zh: '子时', name_en: 'Zi',   start_hour: 23, end_hour: 1 },
  chou: { id: 'chou', name_zh: '丑时', name_en: 'Chou', start_hour: 1,  end_hour: 3 },
  yin:  { id: 'yin',  name_zh: '寅时', name_en: 'Yin',  start_hour: 3,  end_hour: 5 },
  mao:  { id: 'mao',  name_zh: '卯时', name_en: 'Mao',  start_hour: 5,  end_hour: 7 },
  chen: { id: 'chen', name_zh: '辰时', name_en: 'Chen', start_hour: 7,  end_hour: 9 },
  si:   { id: 'si',   name_zh: '巳时', name_en: 'Si',   start_hour: 9,  end_hour: 11 },
  wu:   { id: 'wu',   name_zh: '午时', name_en: 'Wu',   start_hour: 11, end_hour: 13 },
  wei:  { id: 'wei',  name_zh: '未时', name_en: 'Wei',  start_hour: 13, end_hour: 15 },
  shen: { id: 'shen', name_zh: '申时', name_en: 'Shen', start_hour: 15, end_hour: 17 },
  you:  { id: 'you',  name_zh: '酉时', name_en: 'You',  start_hour: 17, end_hour: 19 },
  xu:   { id: 'xu',   name_zh: '戌时', name_en: 'Xu',   start_hour: 19, end_hour: 21 },
  hai:  { id: 'hai',  name_zh: '亥时', name_en: 'Hai',  start_hour: 21, end_hour: 23 }
};

/**
 * 根据时间(用户时区)返回当前时辰
 */
export function getCurrentHourPeriod(date: Date = new Date()): HourPeriod {
  const hour = date.getHours();
  
  if (hour >= 23 || hour < 1) return 'zi';
  if (hour >= 1 && hour < 3) return 'chou';
  if (hour >= 3 && hour < 5) return 'yin';
  if (hour >= 5 && hour < 7) return 'mao';
  if (hour >= 7 && hour < 9) return 'chen';
  if (hour >= 9 && hour < 11) return 'si';
  if (hour >= 11 && hour < 13) return 'wu';
  if (hour >= 13 && hour < 15) return 'wei';
  if (hour >= 15 && hour < 17) return 'shen';
  if (hour >= 17 && hour < 19) return 'you';
  if (hour >= 19 && hour < 21) return 'xu';
  return 'hai';
}

/**
 * 计算距离当前时辰结束还有多少秒
 */
export function secondsToNextHourPeriod(date: Date = new Date()): number {
  const now = date.getTime();
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  
  // 当前时辰的结束小时
  let endHour: number;
  if (hour >= 23 || hour < 1) endHour = 1;
  else if (hour < 3) endHour = 3;
  else if (hour < 5) endHour = 5;
  else if (hour < 7) endHour = 7;
  else if (hour < 9) endHour = 9;
  else if (hour < 11) endHour = 11;
  else if (hour < 13) endHour = 13;
  else if (hour < 15) endHour = 15;
  else if (hour < 17) endHour = 17;
  else if (hour < 19) endHour = 19;
  else if (hour < 21) endHour = 21;
  else endHour = 23;
  
  // 计算到 endHour:00:00 的秒数
  const targetDate = new Date(date);
  if (endHour <= hour) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  targetDate.setHours(endHour, 0, 0, 0);
  
  return Math.floor((targetDate.getTime() - now) / 1000);
}
```

## Step 4.2: lib/syncro/syncro-session.ts(数据库操作)

```typescript
// lib/syncro/syncro-session.ts

import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db/poju-db';
import { encrypt, decrypt } from '@/lib/crypto';
import { getDeviceId } from '@/lib/init';
import type { SyncroSession } from './types';

// 在 PojulifeDB 中新增 syncro_sessions 表
// 在 lib/db/poju-db.ts 中:
//   syncro_sessions: 'session_id, device_id, profile_id, created_at, expires_at'

export interface SyncroSessionRecord {
  session_id: string;
  device_id: string;
  profile_id: string;
  encrypted_data: string;
  iv: string;
  created_at: Date;
  expires_at: Date;
}

export async function createSyncroSession(input: {
  profile_id: string;
  task_description: string;
  user_location: any;
  matrix: any;
  locale: string;
  is_free: boolean;
  cost_usd: number;
  llm_meta: any;
}): Promise<string> {
  const deviceId = getDeviceId();
  if (!deviceId) throw new Error('App not initialized');
  
  const sessionId = uuidv4();
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);  // 24 小时后
  
  const session: SyncroSession = {
    session_id: sessionId,
    device_id: deviceId,
    profile_id: input.profile_id,
    task_description: input.task_description,
    user_location: input.user_location,
    created_at: now,
    expires_at: expires,
    matrix: input.matrix,
    locale: input.locale,
    is_free: input.is_free,
    cost_usd: input.cost_usd,
    llm_meta: input.llm_meta
  };
  
  const { ciphertext, iv } = await encrypt(session);
  
  await (db as any).syncro_sessions.put({
    session_id: sessionId,
    device_id: deviceId,
    profile_id: input.profile_id,
    encrypted_data: ciphertext,
    iv,
    created_at: now,
    expires_at: expires
  });
  
  return sessionId;
}

export async function loadSyncroSession(sessionId: string): Promise<SyncroSession | null> {
  const record = await (db as any).syncro_sessions.get(sessionId);
  if (!record) return null;
  
  // 检查是否过期
  if (new Date(record.expires_at) < new Date()) {
    return null;  // 过期
  }
  
  try {
    return await decrypt(record.encrypted_data, record.iv);
  } catch (e) {
    console.error('[syncro-session] Decrypt failed:', e);
    return null;
  }
}

export async function isSyncroSessionExpired(sessionId: string): Promise<boolean> {
  const record = await (db as any).syncro_sessions.get(sessionId);
  if (!record) return true;
  return new Date(record.expires_at) < new Date();
}

export async function listUserSyncroSessions(): Promise<any[]> {
  const deviceId = getDeviceId();
  if (!deviceId) return [];
  
  const records = await (db as any).syncro_sessions
    .where('device_id').equals(deviceId)
    .reverse()
    .sortBy('created_at');
  
  return records.map((r: any) => ({
    session_id: r.session_id,
    created_at: r.created_at,
    expires_at: r.expires_at,
    is_expired: new Date(r.expires_at) < new Date()
  }));
}
```

## Step 4.3: 把 syncro_sessions 表加入 IndexedDB

修改 `lib/db/poju-db.ts`:

```typescript
this.version(4).stores({
  // 已有表
  syncro_sessions: 'session_id, device_id, profile_id, created_at, expires_at',
  device_usage: 'id, device_id, product, last_used_at'
});
```

## Step 4.4: device-usage 服务

```typescript
// lib/syncro/device-usage.ts

import { db } from '@/lib/db/poju-db';
import { getDeviceId } from '@/lib/init';

export async function isFirstTimeFree(product: 'glyph' | 'syncro' | 'match'): Promise<boolean> {
  const deviceId = getDeviceId();
  if (!deviceId) return false;
  
  const id = `${deviceId}__${product}`;
  const record = await db.device_usage.get(id);
  
  return !record || !record.free_used;
}

export async function recordUsage(
  product: 'glyph' | 'syncro' | 'match',
  isFree: boolean,
  costUsd: number
): Promise<void> {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  
  const id = `${deviceId}__${product}`;
  const existing = await db.device_usage.get(id);
  
  await db.device_usage.put({
    id,
    device_id: deviceId,
    product,
    free_used: existing?.free_used || isFree,
    free_used_at: isFree && !existing?.free_used_at ? new Date() : existing?.free_used_at,
    paid_count: (existing?.paid_count || 0) + (isFree ? 0 : 1),
    last_used_at: new Date(),
    total_cost_usd: (existing?.total_cost_usd || 0) + costUsd
  });
}

export async function getProductUsage(product: 'glyph' | 'syncro' | 'match') {
  const deviceId = getDeviceId();
  if (!deviceId) return null;
  
  const id = `${deviceId}__${product}`;
  return await db.device_usage.get(id);
}
```

## 验证清单

```
□ types.ts 完整
□ syncro-session.ts 完整
□ device-usage.ts 完整
□ IndexedDB v4 表新增
□ tsc 通过

🛑 等用户确认进入 Step 5
```

---

# 第 5 部分:Step 5 - Syncro 入口流程

## Step 5.1: Syncro 主页

文件:`app/[locale]/(marketing)/syncro/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { isFirstTimeFree } from '@/lib/syncro/device-usage';
import { isMobileDevice, hasOrientationSensor } from '@/lib/syncro/device-check';

export default function SyncroHomePage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('syncro');
  
  const [canUse, setCanUse] = useState<{
    isFreeAvailable: boolean;
    isSupportedDevice: boolean;
    checking: boolean;
  }>({
    isFreeAvailable: false,
    isSupportedDevice: false,
    checking: true
  });
  
  useEffect(() => {
    checkAccess();
  }, []);
  
  async function checkAccess() {
    const free = await isFirstTimeFree('syncro');
    const mobile = isMobileDevice();
    const orientation = await hasOrientationSensor();
    
    setCanUse({
      isFreeAvailable: free,
      isSupportedDevice: mobile && orientation,
      checking: false
    });
  }
  
  if (canUse.checking) {
    return <div className="loading-fullscreen">Loading...</div>;
  }
  
  // 桌面/老手机:只看介绍,不能用
  if (!canUse.isSupportedDevice) {
    return <DesktopOnlyView locale={locale} />;
  }
  
  return (
    <div className="syncro-home">
      <div className="syncro-hero">
        <h1 className="syncro-title">SYNCRO</h1>
        <p className="syncro-subtitle">{t('subtitle')}</p>
        <p className="syncro-description">{t('description')}</p>
      </div>
      
      <div className="syncro-features">
        <FeatureCard icon="🧭" titleKey="feature_realtime" descKey="feature_realtime_desc" />
        <FeatureCard icon="⚡" titleKey="feature_directional" descKey="feature_directional_desc" />
        <FeatureCard icon="📹" titleKey="feature_vr" descKey="feature_vr_desc" />
      </div>
      
      <div className="syncro-cta">
        <button 
          onClick={() => {
            if (canUse.isFreeAvailable) {
              router.push(`/${locale}/syncro/task?type=free`);
            } else {
              router.push(`/${locale}/syncro/payment`);
            }
          }}
          className="primary-large"
        >
          {canUse.isFreeAvailable ? t('start_free') : t('start_paid')}
        </button>
        
        <p className="cta-note">
          {canUse.isFreeAvailable 
            ? t('free_note') 
            : t('paid_note')}
        </p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, titleKey, descKey }: any) {
  const t = useTranslations('syncro');
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{t(titleKey)}</h3>
      <p>{t(descKey)}</p>
    </div>
  );
}

function DesktopOnlyView({ locale }: any) {
  const t = useTranslations('syncro');
  return (
    <div className="desktop-only-view">
      <div className="content">
        <h1>SYNCRO</h1>
        <p>{t('desktop_message_1')}</p>
        <p>{t('desktop_message_2')}</p>
        <div className="features-list">
          <p>{t('feature_realtime_desc')}</p>
          <p>{t('feature_directional_desc')}</p>
          <p>{t('feature_vr_desc')}</p>
        </div>
        <p className="mobile-link">{t('open_on_mobile_hint')}</p>
      </div>
    </div>
  );
}
```

## Step 5.2: 设备检测

文件:`lib/syncro/device-check.ts`

```typescript
// lib/syncro/device-check.ts

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  // User agent 检测
  const ua = navigator.userAgent;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  
  // Touch 能力检测
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return isMobileUA && hasTouch;
}

export async function hasOrientationSensor(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  // 检查 DeviceOrientationEvent
  if (typeof DeviceOrientationEvent === 'undefined') return false;
  
  // iOS 13+ 需要 requestPermission
  // 但这里只检查能力,不请求权限
  if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    // iOS 设备,有能力但需要权限
    return true;
  }
  
  // 其他设备:监听一次事件确认有数据
  return new Promise((resolve) => {
    let hasData = false;
    const handler = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && e.alpha !== undefined) {
        hasData = true;
      }
    };
    
    window.addEventListener('deviceorientation', handler);
    
    setTimeout(() => {
      window.removeEventListener('deviceorientation', handler);
      resolve(hasData);
    }, 500);
  });
}

export async function requestOrientationPermission(): Promise<boolean> {
  if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    try {
      const result = await (DeviceOrientationEvent as any).requestPermission();
      return result === 'granted';
    } catch (e) {
      return false;
    }
  }
  // 非 iOS,默认允许
  return true;
}
```

## Step 5.3: Syncro 翻译

`messages/en/syncro.json`:

```json
{
  "subtitle": "Live direction & timing guidance",
  "description": "Syncro is your real-time companion for the next 24 hours. Hold your phone like a compass — find the direction and moment that's open for what you're about to do.",
  
  "feature_realtime": "Live, every hour",
  "feature_realtime_desc": "Your energy field shifts every 2 hours. Syncro recalibrates with you.",
  
  "feature_directional": "8 directions, fully scanned",
  "feature_directional_desc": "Every direction analyzed for the moment you're in.",
  
  "feature_vr": "VR mode",
  "feature_vr_desc": "Open camera mode for a hands-on, real-world directional reading.",
  
  "start_free": "Start free (first time)",
  "start_paid": "Start a session — $4.99",
  "free_note": "Your first Syncro is on us.",
  "paid_note": "$4.99 covers a 24-hour live window of guidance for one task.",
  
  "desktop_message_1": "Syncro needs your phone.",
  "desktop_message_2": "Its core is reading directions through your device — that requires a mobile compass.",
  "open_on_mobile_hint": "Open easternos.com on your phone to use Syncro."
}
```

`messages/zh/syncro.json`:

```json
{
  "subtitle": "实时方位与时机指引",
  "description": "Syncro 是你未来 24 小时的实时陪伴。把手机当作罗盘——找到当下最适合你这件事的方位与时机。",
  
  "feature_realtime": "每个时辰实时更新",
  "feature_realtime_desc": "能量场每 2 小时一变,Syncro 与你同步重新测算。",
  
  "feature_directional": "八方位全方位扫描",
  "feature_directional_desc": "为当下时辰扫描所有方位的能量状态。",
  
  "feature_vr": "VR 实景模式",
  "feature_vr_desc": "开启摄像头,在真实世界中接收方位指引。",
  
  "start_free": "免费体验(首次)",
  "start_paid": "开始一次会话 — $4.99",
  "free_note": "首次 Syncro 由我们赠送。",
  "paid_note": "$4.99 = 一件事 24 小时实时方位指引。",
  
  "desktop_message_1": "Syncro 需要你的手机。",
  "desktop_message_2": "它的核心是通过设备读取方位——这需要移动罗盘。",
  "open_on_mobile_hint": "请在手机上打开 easternos.com 使用 Syncro。"
}
```

## 验证清单

```
□ Syncro 主页可访问
□ 桌面打开 → 显示桌面引导
□ 手机打开 → 显示功能介绍 + 按钮
□ device_usage 检查正常
□ 首次用户显示"免费"按钮
□ 已用过显示 $4.99 按钮

🛑 等用户确认进入 Step 6
```

---

# 第 6 部分:Step 6 - 任务输入页

## Step 6.1: /syncro/task 页面

文件:`app/[locale]/(marketing)/syncro/task/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

export default function SyncroTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('syncro.task');
  
  const sessionType = searchParams.get('type') || 'paid';
  
  const [task, setTask] = useState('');
  const minLen = 30;
  const maxLen = 100;
  
  function handleContinue() {
    if (task.trim().length < minLen) return;
    
    // 存到 sessionStorage(因为还没付费/选 profile)
    sessionStorage.setItem('syncro_task_pending', task.trim());
    sessionStorage.setItem('syncro_session_type', sessionType);
    
    // 跳转到 prepare(选 profile)
    router.push(`/${locale}/syncro/prepare`);
  }
  
  return (
    <div className="syncro-task-page">
      <div className="task-content">
        <h1>{t('title')}</h1>
        <p className="subtitle">{t('subtitle')}</p>
        
        <textarea
          value={task}
          onChange={e => setTask(e.target.value.slice(0, maxLen))}
          placeholder={t('placeholder')}
          rows={6}
          autoFocus
        />
        
        <div className="char-count">
          {task.length} / {maxLen}
          {task.length < minLen && (
            <span className="hint"> · {t('min_chars', { min: minLen })}</span>
          )}
        </div>
        
        <div className="examples">
          <h4>{t('examples_title')}</h4>
          <ul>
            <li>{t('example_1')}</li>
            <li>{t('example_2')}</li>
            <li>{t('example_3')}</li>
          </ul>
        </div>
        
        <button
          onClick={handleContinue}
          disabled={task.trim().length < minLen}
          className="primary-large"
        >
          {t('continue')}
        </button>
      </div>
    </div>
  );
}
```

## Step 6.2: 翻译

`messages/en/syncro.json` 补充:

```json
{
  "task": {
    "title": "What's the moment you need to find?",
    "subtitle": "Tell me what you're about to do. I'll find the best direction and time within the next 24 hours.",
    "placeholder": "e.g., 'I'm meeting a client to close a deal tomorrow afternoon.'",
    "min_chars": "at least {min} characters",
    "examples_title": "Good examples:",
    "example_1": "I'm going to a job interview tomorrow at 10 AM.",
    "example_2": "I need to have a difficult conversation with my partner today.",
    "example_3": "I'm signing a business contract this week.",
    "continue": "Continue"
  }
}
```

`messages/zh/syncro.json` 补充:

```json
{
  "task": {
    "title": "你要找的是哪一刻?",
    "subtitle": "告诉我你即将要做的事。我会在未来 24 小时内找到最适合你的方位和时机。",
    "placeholder": "例如:'明天下午我要见客户谈一笔生意'",
    "min_chars": "至少 {min} 字",
    "examples_title": "好的例子:",
    "example_1": "明天上午 10 点要去面试",
    "example_2": "今天我得跟伴侣进行一次困难的对话",
    "example_3": "这周要签一份商业合同",
    "continue": "继续"
  }
}
```

## 验证清单

```
□ /syncro/task 页面可访问
□ 30-100 字限制工作
□ 示例显示
□ 字数不够禁用按钮
□ 输入后存 sessionStorage
□ 跳转到 prepare

🛑 等用户确认进入 Step 7
```

---

# 第 7 部分:Step 7 - Profile 选择 + 位置授权

## Step 7.1: /syncro/prepare 页面

文件:`app/[locale]/(marketing)/syncro/prepare/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { 
  listStoredProfiles, 
  type StoredProfileSummary 
} from '@/lib/profile/stored-profiles-service';
import { SessionPreparation } from '@/components/poju/SessionPreparation';

export default function SyncroPreparePage() {
  const router = useRouter();
  const locale = useLocale();
  
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState('');
  const [sessionType, setSessionType] = useState('paid');
  
  useEffect(() => {
    // 从 sessionStorage 读取任务
    const pendingTask = sessionStorage.getItem('syncro_task_pending');
    const type = sessionStorage.getItem('syncro_session_type') || 'paid';
    
    if (!pendingTask) {
      router.push(`/${locale}/syncro/task`);
      return;
    }
    
    setTask(pendingTask);
    setSessionType(type);
    
    loadProfiles();
  }, []);
  
  async function loadProfiles() {
    try {
      const list = await listStoredProfiles();
      setProfiles(list);
    } finally {
      setLoading(false);
    }
  }
  
  function handleProfileSelected(profileId: string) {
    sessionStorage.setItem('syncro_profile_id', profileId);
    router.push(`/${locale}/syncro/location`);
  }
  
  function handleCancel() {
    router.push(`/${locale}/syncro`);
  }
  
  if (loading) {
    return <div className="loading-fullscreen">Loading...</div>;
  }
  
  return (
    <SessionPreparation
      sessionId="syncro-temp"
      originalQuestion={task}
      existingProfiles={profiles}
      onProfileSelected={handleProfileSelected}
      onRefund={handleCancel}  // Syncro 没有退款,改为取消
      locale={locale}
      productType="syncro"
    />
  );
}
```

## Step 7.2: /syncro/location 位置授权页

文件:`app/[locale]/(marketing)/syncro/location/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

export default function SyncroLocationPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('syncro.location');
  
  const [stage, setStage] = useState<'asking' | 'granted' | 'denied'>('asking');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // 检查是否已有 profile
    const profileId = sessionStorage.getItem('syncro_profile_id');
    if (!profileId) {
      router.push(`/${locale}/syncro/prepare`);
    }
  }, []);
  
  function requestLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation not supported on this device');
      setStage('denied');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        setStage('granted');
        
        // 存 sessionStorage
        sessionStorage.setItem('syncro_location', JSON.stringify({ lat, lng }));
        
        // 自动跳转到 computing
        setTimeout(() => {
          router.push(`/${locale}/syncro/computing`);
        }, 1500);
      },
      (err) => {
        setError(err.message);
        setStage('denied');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  }
  
  function handleRetry() {
    setStage('asking');
    setError(null);
    requestLocation();
  }
  
  return (
    <div className="syncro-location-page">
      {stage === 'asking' && (
        <AskingView 
          onAllow={requestLocation}
          onSkip={handleRetry}
        />
      )}
      
      {stage === 'granted' && coords && (
        <GrantedView coords={coords} />
      )}
      
      {stage === 'denied' && (
        <DeniedView error={error} onRetry={handleRetry} />
      )}
    </div>
  );
}

function AskingView({ onAllow }: any) {
  const t = useTranslations('syncro.location');
  return (
    <div className="location-asking">
      <div className="location-icon">📍</div>
      <h2>{t('asking_title')}</h2>
      <p>{t('asking_message')}</p>
      <p className="hint">{t('asking_privacy')}</p>
      <button onClick={onAllow} className="primary-large">
        {t('allow_location')}
      </button>
    </div>
  );
}

function GrantedView({ coords }: any) {
  const t = useTranslations('syncro.location');
  return (
    <div className="location-granted">
      <div className="success-icon">✓</div>
      <p>{t('granted_message')}</p>
      <p className="coords">
        {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
      </p>
      <div className="loading-spinner-small"></div>
    </div>
  );
}

function DeniedView({ error, onRetry }: any) {
  const t = useTranslations('syncro.location');
  return (
    <div className="location-denied">
      <div className="error-icon">✕</div>
      <h2>{t('denied_title')}</h2>
      <p>{t('denied_message')}</p>
      {error && <p className="error-detail">{error}</p>}
      <button onClick={onRetry} className="primary">
        {t('retry')}
      </button>
    </div>
  );
}
```

## Step 7.3: 翻译

`messages/en/syncro.json` 补充:

```json
{
  "location": {
    "asking_title": "Allow location?",
    "asking_message": "Syncro needs your current location to align your directions with the real-world compass.",
    "asking_privacy": "Used only for this session. Never stored on our servers.",
    "allow_location": "Allow location access",
    "granted_message": "Location received. Casting your field...",
    "denied_title": "Location is required",
    "denied_message": "Without your location, Syncro can't tell direction. Please allow location access in your browser settings and retry.",
    "retry": "Retry"
  }
}
```

`messages/zh/syncro.json` 补充:

```json
{
  "location": {
    "asking_title": "允许定位?",
    "asking_message": "Syncro 需要你的当前位置,才能将方位与真实世界的罗盘对齐。",
    "asking_privacy": "仅本次使用,从不上传到我们的服务器。",
    "allow_location": "允许定位",
    "granted_message": "已获取位置,正在为你测算...",
    "denied_title": "需要定位",
    "denied_message": "没有位置信息,Syncro 无法判断方位。请在浏览器设置中允许定位后重试。",
    "retry": "重试"
  }
}
```

## 验证清单

```
□ /syncro/prepare 页面工作
□ 复用 ProfileSelector(显示 SYNCRO 文案)
□ /syncro/location 请求授权
□ 用户授权 → 跳转 computing
□ 用户拒绝 → 显示错误 + 重试
□ 位置保存到 sessionStorage

🛑 等用户确认进入 Step 8
```

---

# 第 8 部分:Step 8 - DeepSeek 96 组合计算

## Step 8.1: Syncro Prompt 设计

文件:`lib/llm/prompts/syncro-deepseek-prompt.ts`

```typescript
import { 
  ORIENTAL_COUNSELOR_BASE,
  buildCurrentDateContext,
  buildProfileContextSection 
} from './oriental-counselor-base';
import { HOUR_PERIODS } from '@/lib/syncro/types';
import { DIRECTIONS } from '@/lib/syncro/current-system';

export function buildSyncroPrompt(input: {
  profile: any;
  task_description: string;
  user_location: { latitude: number; longitude: number; timezone: string };
  locale: string;
  current_time: Date;
}): { system: string; user: string } {
  
  const { profile, task_description, user_location, locale, current_time } = input;
  const baseAnalysis = profile?.base_analysis?.content;
  
  // 生成 12 时辰的具体时间(基于用户时区)
  const hourPeriodsList = generateNext24HoursPeriods(current_time);
  
  const isZh = locale.startsWith('zh');
  
  const system = `${ORIENTAL_COUNSELOR_BASE}

${buildCurrentDateContext()}

${buildProfileContextSection(profile, baseAnalysis)}

# 当前任务:Syncro 方位时辰测算

用户即将要做的事情:
"${task_description}"

用户当前位置:
经度 ${user_location.longitude.toFixed(4)}, 纬度 ${user_location.latitude.toFixed(4)}
时区:${user_location.timezone}

# 接下来 12 个时辰(用户本地时间)

${hourPeriodsList.map((p, i) => 
  `${i + 1}. ${p.hour_period_name} (${p.start_time} - ${p.end_time})`
).join('\n')}

# 你的工作

为这 12 个时辰 × 8 个方位 = 96 个组合,每个都给出:

1. **Current 等级**(选 1):
   - open_current (顺势,最佳)
   - following_current (应时,推荐)
   - stillwater (守静,中性)
   - crosscurrent (横阻,不利)
   - undertow (险滞,危险)

2. **短建议**(30-50 字${isZh ? '中文' : '英文'})
   - 直接的行动指引
   - 不重复"open_current"等级名,而是说【为什么这是这样】

3. **详细建议**(100-200 字)
   - 展开命理依据 + 具体行动
   - 引用用户的命局元素(日主/用神/大运)
   - 说明此方位 × 此时辰的能量组合

4. **命理依据**(100-200 字)
   - 此方位在用户命局中代表什么(用神/财位/官位等)
   - 此时辰的天干地支 vs 用户日主
   - 八卦方位的引申意

# 输出格式(严格 JSON)

\`\`\`json
{
  "matrix": {
    "${hourPeriodsList[0]?.hour_period}__N": {
      "current_level": "open_current",
      "short_advice": "30-50 字短建议",
      "detailed_advice": "100-200 字详细",
      "rationale": "100-200 字命理"
    },
    "${hourPeriodsList[0]?.hour_period}__NE": { ... },
    "${hourPeriodsList[0]?.hour_period}__E": { ... },
    // ... 共 96 个 key
  }
}
\`\`\`

# 关键规则

1. **8 方位 ID** 严格用这 8 个:
   N, NE, E, SE, S, SW, W, NW

2. **12 时辰 ID** 严格用这 12 个:
   ${Object.keys(HOUR_PERIODS).join(', ')}

3. **key 格式**: \`${hour_period_id}__${direction_id}\`
   例: "mao__SE", "wu__N"

4. **不均匀分布**(关键!)
   不是每个时辰都有 1-2 个 open_current
   有的时辰可能 4 个 crosscurrent + 4 个 stillwater
   有的时辰可能 2 个 open_current + 1 个 undertow
   按真实命理推算,不要刻意平均

5. **命局关联**
   用户日主、当前大运、用神 必须在推理中起作用
   不同时辰的天干地支跟用户日主交互不同

6. **语言**: ${isZh ? '中文' : 'English'}

# 严格的 JSON

只输出 JSON,无 markdown 包裹,无解释文字。
96 个 key 必须全部输出,缺一不可。
`;
  
  const user = `请生成完整的 96 组合 JSON。`;
  
  return { system, user };
}

function generateNext24HoursPeriods(startTime: Date) {
  const periods: any[] = [];
  let currentHour = startTime.getHours();
  
  // 找到当前时辰的开始时间
  const hourPeriodsOrder = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'];
  
  // 简化:从当前时间开始,每 2 小时一个时辰,共 12 个
  for (let i = 0; i < 12; i++) {
    const periodStart = new Date(startTime);
    periodStart.setHours(currentHour - (currentHour % 2) + i * 2, 0, 0, 0);
    
    const periodEnd = new Date(periodStart);
    periodEnd.setHours(periodStart.getHours() + 2);
    
    const hourIdx = Math.floor(((periodStart.getHours() + 1) % 24) / 2);
    
    periods.push({
      hour_period: hourPeriodsOrder[hourIdx],
      hour_period_name: hourPeriodsOrder[hourIdx],
      start_time: periodStart.toISOString(),
      end_time: periodEnd.toISOString()
    });
  }
  
  return periods;
}
```

## Step 8.2: Syncro 服务

文件:`lib/llm/services/syncro-reading-service.ts`

```typescript
import { callLLM } from '@/lib/llm/router';
import { buildSyncroPrompt } from '@/lib/llm/prompts/syncro-deepseek-prompt';
import { getStoredProfile, recordProfileUsage } from '@/lib/profile/stored-profiles-service';

export async function generateSyncroMatrix(input: {
  profile_id: string;
  task_description: string;
  user_location: any;
  locale: string;
}) {
  // 1. 加载 profile
  const profile = await getStoredProfile(input.profile_id);
  if (!profile) throw new Error('Profile not found');
  
  if (!profile.base_analysis?.content) {
    throw new Error('Profile has no base_analysis');
  }
  
  // 2. 构建 prompt
  const { system, user } = buildSyncroPrompt({
    profile,
    task_description: input.task_description,
    user_location: input.user_location,
    locale: input.locale,
    current_time: new Date()
  });
  
  console.log('[syncro] Calling DeepSeek V4 Pro for 96 combinations...');
  const startTime = Date.now();
  
  // 3. 调用 DeepSeek(high thinking)
  const result = await callLLM({
    call_type: 'deep_analysis',
    system,
    messages: [{ role: 'user', content: user }],
    max_tokens: 20000,  // 96 个组合需要大空间
    thinking_effort: 'high',
    response_format: 'json'
  });
  
  // 4. 解析 JSON
  let parsed: any;
  try {
    const cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('[syncro] JSON parse failed');
    throw new Error('Syncro matrix output is not valid JSON');
  }
  
  // 5. 校验 96 个 key
  if (!parsed.matrix || Object.keys(parsed.matrix).length < 90) {
    throw new Error(`Matrix incomplete: only ${Object.keys(parsed.matrix || {}).length} combinations`);
  }
  
  // 6. 记录使用
  await recordProfileUsage(input.profile_id, 'syncro');
  
  const elapsedMs = Date.now() - startTime;
  
  return {
    matrix: parsed.matrix,
    meta: {
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      cost_usd: result.meta.cost_usd || 0,
      latency_ms: elapsedMs
    }
  };
}
```

## Step 8.3: /api/syncro/compute API

文件:`app/api/syncro/compute/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { generateSyncroMatrix } from '@/lib/llm/services/syncro-reading-service';

export const runtime = 'nodejs';
export const maxDuration = 180;  // DeepSeek 96 组合可能需要 60-90 秒

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { profile_id, task_description, user_location, locale } = body;
    
    if (!profile_id || !task_description || !user_location) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    
    const result = await generateSyncroMatrix({
      profile_id,
      task_description,
      user_location,
      locale: locale || 'en'
    });
    
    return NextResponse.json({
      success: true,
      matrix: result.matrix,
      meta: result.meta
    });
  } catch (e: any) {
    console.error('[api/syncro/compute] error:', e);
    return NextResponse.json({
      error: 'compute_failed',
      message: e.message
    }, { status: 500 });
  }
}
```

## Step 8.4: /syncro/computing 页面

文件:`app/[locale]/(marketing)/syncro/computing/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { createSyncroSession } from '@/lib/syncro/syncro-session';
import { recordUsage } from '@/lib/syncro/device-usage';

export default function SyncroComputingPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('syncro.computing');
  
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const steps = [
    t('step_1'),
    t('step_2'),
    t('step_3'),
    t('step_4'),
    t('step_5'),
    t('step_6')
  ];
  
  useEffect(() => {
    compute();
    
    // 流式步骤切换
    const interval = setInterval(() => {
      setStep(s => (s + 1) % steps.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  async function compute() {
    try {
      const profileId = sessionStorage.getItem('syncro_profile_id');
      const task = sessionStorage.getItem('syncro_task_pending');
      const locationStr = sessionStorage.getItem('syncro_location');
      const sessionType = sessionStorage.getItem('syncro_session_type') || 'paid';
      
      if (!profileId || !task || !locationStr) {
        throw new Error('Missing required data');
      }
      
      const location = JSON.parse(locationStr);
      
      // 调用 compute API
      const response = await fetch('/api/syncro/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: profileId,
          task_description: task,
          user_location: {
            latitude: location.lat,
            longitude: location.lng,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          locale
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Compute failed');
      }
      
      const data = await response.json();
      
      // 创建 Syncro session
      const sessionId = await createSyncroSession({
        profile_id: profileId,
        task_description: task,
        user_location: {
          latitude: location.lat,
          longitude: location.lng,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        matrix: data.matrix,
        locale,
        is_free: sessionType === 'free',
        cost_usd: data.meta.cost_usd,
        llm_meta: data.meta
      });
      
      // 记录使用
      await recordUsage('syncro', sessionType === 'free', data.meta.cost_usd);
      
      // 清理 sessionStorage
      sessionStorage.removeItem('syncro_task_pending');
      sessionStorage.removeItem('syncro_session_type');
      sessionStorage.removeItem('syncro_profile_id');
      sessionStorage.removeItem('syncro_location');
      
      // 跳转到结果页
      router.push(`/${locale}/syncro/result/${sessionId}`);
    } catch (e: any) {
      setError(e.message);
    }
  }
  
  if (error) {
    return (
      <div className="syncro-computing error">
        <div className="error-icon">✕</div>
        <h2>{t('error_title')}</h2>
        <p>{error}</p>
        <button onClick={() => router.push(`/${locale}/syncro`)}>
          {t('go_back')}
        </button>
      </div>
    );
  }
  
  return (
    <div className="syncro-computing">
      <div className="computing-spinner-large"></div>
      
      <p key={step} className="computing-step">
        {steps[step]}
      </p>
      
      <p className="computing-hint">{t('hint')}</p>
    </div>
  );
}
```

## Step 8.5: 翻译

`messages/en/syncro.json` 补充:

```json
{
  "computing": {
    "step_1": "Casting your chart...",
    "step_2": "Aligning with your current position...",
    "step_3": "Scanning all 8 directions...",
    "step_4": "Reading the next 12 hour-periods...",
    "step_5": "Mapping 96 time-space combinations...",
    "step_6": "Almost ready...",
    "hint": "Computing the field for the next 24 hours. About 60-90 seconds.",
    "error_title": "Computation failed",
    "go_back": "Try again"
  }
}
```

## 验证清单

```
□ syncro-deepseek-prompt.ts 实现
□ syncro-reading-service.ts 实现
□ /api/syncro/compute API 工作
□ /syncro/computing 页面显示流式动画
□ 计算成功后创建 session + 记录 usage
□ 跳转到 /syncro/result/[id]
□ DeepSeek 实际输出 96 组合(测试时贴 console.log)

🛑 等用户确认进入 Step 9
```

---

# 第 9 部分:Step 9 - Spline 3D 粒子圆主界面

## Step 9.1: SyncroSplineCanvas 组件

文件:`components/syncro/SyncroSplineCanvas.tsx`

```typescript
'use client';

import { useEffect, useRef } from 'react';
import Spline from '@splinetool/react-spline';

interface Props {
  /** 罗盘方向 0-360°,0=北 */
  compassDegree: number;
  
  /** 是否启用 VR 模式 */
  vrMode?: boolean;
  
  /** 加载完成回调 */
  onLoad?: () => void;
}

export function SyncroSplineCanvas({ compassDegree, vrMode, onLoad }: Props) {
  const splineRef = useRef<any>(null);
  
  // 同步方向到 Spline
  useEffect(() => {
    if (!splineRef.current) return;
    
    try {
      // ⚠️ 假设 Spline 中有一个名为 "Compass" 的对象
      // Cursor 需要实际打开 fangwei.splinecode 看对象名称
      const compass = splineRef.current.findObjectByName('Compass');
      if (compass) {
        // 反向旋转,让世界北方对准用户朝北
        compass.rotation.y = -compassDegree * (Math.PI / 180);
      }
    } catch (e) {
      console.warn('[spline] Cannot update compass rotation:', e);
    }
  }, [compassDegree]);
  
  function handleLoad(spline: any) {
    splineRef.current = spline;
    if (onLoad) onLoad();
  }
  
  return (
    <div className={`syncro-spline-canvas ${vrMode ? 'vr-mode' : ''}`}>
      <Spline 
        scene="/spline/fangwei.splinecode"
        onLoad={handleLoad}
      />
    </div>
  );
}
```

## Step 9.2: SyncroOrientationProvider 组件

文件:`components/syncro/SyncroOrientationProvider.tsx`

```typescript
'use client';

import { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  useRef,
  type ReactNode 
} from 'react';
import { requestOrientationPermission } from '@/lib/syncro/device-check';

interface OrientationContextValue {
  compassDegree: number;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  isSupported: boolean;
}

const OrientationContext = createContext<OrientationContextValue | null>(null);

export function useOrientation() {
  const ctx = useContext(OrientationContext);
  if (!ctx) throw new Error('useOrientation must be used within OrientationProvider');
  return ctx;
}

export function SyncroOrientationProvider({ children }: { children: ReactNode }) {
  const [compassDegree, setCompassDegree] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  
  // 平滑过渡用的最近值
  const smoothedRef = useRef(0);
  const rawValueRef = useRef(0);
  
  useEffect(() => {
    setIsSupported(typeof DeviceOrientationEvent !== 'undefined');
    
    // iOS 不需要立即请求,等用户主动触发
    if (typeof (DeviceOrientationEvent as any).requestPermission !== 'function') {
      // 非 iOS,直接监听
      setHasPermission(true);
    }
  }, []);
  
  useEffect(() => {
    if (!hasPermission) return;
    
    let alpha = 0;
    
    function handler(e: DeviceOrientationEvent) {
      // alpha: 0-360,设备 z 轴旋转
      // iOS 是相对,Android 是绝对
      // 这里用 webkitCompassHeading (iOS 专属) 优先
      const ios = (e as any).webkitCompassHeading;
      
      if (typeof ios === 'number') {
        // iOS,直接是罗盘
        alpha = ios;
      } else if (e.alpha !== null) {
        // Android,需要修正
        // alpha 是逆时针,罗盘是顺时针
        alpha = (360 - e.alpha) % 360;
      } else {
        return;
      }
      
      rawValueRef.current = alpha;
    }
    
    window.addEventListener('deviceorientationabsolute', handler);
    window.addEventListener('deviceorientation', handler);
    
    // 60fps 平滑更新
    const interval = setInterval(() => {
      const target = rawValueRef.current;
      const current = smoothedRef.current;
      
      // 处理 360→0 的边界跳跃
      let diff = target - current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      
      // 平滑 (lerp 系数 0.15,可调)
      const smoothed = (current + diff * 0.15 + 360) % 360;
      smoothedRef.current = smoothed;
      
      setCompassDegree(smoothed);
    }, 16);
    
    return () => {
      window.removeEventListener('deviceorientationabsolute', handler);
      window.removeEventListener('deviceorientation', handler);
      clearInterval(interval);
    };
  }, [hasPermission]);
  
  async function requestPermission() {
    const granted = await requestOrientationPermission();
    setHasPermission(granted);
    return granted;
  }
  
  return (
    <OrientationContext.Provider value={{
      compassDegree,
      hasPermission,
      requestPermission,
      isSupported
    }}>
      {children}
    </OrientationContext.Provider>
  );
}
```

## Step 9.3: SyncroMainView 主组件

文件:`components/syncro/SyncroMainView.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useOrientation } from './SyncroOrientationProvider';
import { SyncroSplineCanvas } from './SyncroSplineCanvas';
import { SyncroTimerBar } from './SyncroTimerBar';
import { SyncroVRMode } from './SyncroVRMode';
import { compassToDirection, CURRENT_LEVELS, DIRECTIONS } from '@/lib/syncro/current-system';
import { getCurrentHourPeriod } from '@/lib/syncro/types';
import type { SyncroSession } from '@/lib/syncro/types';

interface Props {
  session: SyncroSession;
  locale: string;
}

export function SyncroMainView({ session, locale }: Props) {
  const t = useTranslations('syncro.main');
  const { compassDegree, hasPermission, requestPermission, isSupported } = useOrientation();
  
  const [showDetail, setShowDetail] = useState(false);
  const [vrMode, setVrMode] = useState(false);
  const [currentHourPeriod, setCurrentHourPeriod] = useState(getCurrentHourPeriod());
  
  // 每分钟检查是否换时辰
  useEffect(() => {
    const interval = setInterval(() => {
      const newPeriod = getCurrentHourPeriod();
      if (newPeriod !== currentHourPeriod) {
        setCurrentHourPeriod(newPeriod);
        // 自动刷新建议
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, [currentHourPeriod]);
  
  // 计算当前指向的方位
  const { primary: currentDirection } = compassToDirection(compassDegree);
  
  // 从 matrix 取出当前时辰 × 当前方位的建议
  const combinationKey = `${currentHourPeriod}__${currentDirection}`;
  const combination = session.matrix[combinationKey];
  
  if (!combination) {
    return (
      <div className="syncro-error">
        <p>{t('combination_not_found')}</p>
      </div>
    );
  }
  
  const levelInfo = CURRENT_LEVELS[combination.current_level];
  const directionInfo = DIRECTIONS[currentDirection];
  
  return (
    <div className={`syncro-main-view ${vrMode ? 'vr-mode' : ''}`}>
      {/* 顶部状态条 */}
      <SyncroTimerBar 
        currentHourPeriod={currentHourPeriod}
        locale={locale}
      />
      
      {/* 8 方位符号(HTML 叠加在 Spline 上)*/}
      <DirectionLabels 
        compassDegree={compassDegree}
        activeDirection={currentDirection}
        locale={locale}
      />
      
      {/* Spline 3D 粒子圆 */}
      <SyncroSplineCanvas
        compassDegree={compassDegree}
        vrMode={vrMode}
      />
      
      {/* VR 模式摄像头视框(若启用)*/}
      {vrMode && <SyncroVRMode />}
      
      {/* 中央信息显示 */}
      <CenterInfo
        combination={combination}
        levelInfo={levelInfo}
        directionInfo={directionInfo}
        showDetail={showDetail}
        onToggleDetail={() => setShowDetail(!showDetail)}
        vrMode={vrMode}
        locale={locale}
      />
      
      {/* 底部控制 */}
      <BottomControls
        vrMode={vrMode}
        onToggleVR={() => setVrMode(!vrMode)}
        hasPermission={hasPermission}
        onRequestPermission={requestPermission}
        isSupported={isSupported}
        locale={locale}
      />
    </div>
  );
}

// ============= 8 方位符号 =============

function DirectionLabels({ compassDegree, activeDirection, locale }: any) {
  const isZh = locale.startsWith('zh');
  
  // 8 个方位的位置(以圆心为中心,半径 45vmin)
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  
  return (
    <div 
      className="direction-labels-container"
      style={{ transform: `rotate(${-compassDegree}deg)` }}
    >
      {directions.map((dir, idx) => {
        const angle = idx * 45 - 90;  // 北方在顶部
        const isActive = dir === activeDirection;
        
        const info = DIRECTIONS[dir as keyof typeof DIRECTIONS];
        
        return (
          <div
            key={dir}
            className={`direction-label ${isActive ? 'active' : ''}`}
            style={{
              transform: `
                rotate(${angle}deg) 
                translateX(45vmin) 
                rotate(${-angle + compassDegree}deg)
              `
            }}
          >
            <span className="dir-symbol">
              {isZh ? info.name_zh : info.name_en}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============= 中央信息显示 =============

function CenterInfo({ 
  combination, 
  levelInfo, 
  directionInfo,
  showDetail, 
  onToggleDetail,
  vrMode,
  locale 
}: any) {
  const t = useTranslations('syncro.main');
  
  const isZh = locale.startsWith('zh');
  
  return (
    <div className={`center-info ${vrMode ? 'in-vr-frame' : ''}`}>
      {/* Current Level 标签 */}
      <div 
        className="current-level-badge"
        style={{ color: levelInfo.color_hex }}
      >
        {isZh ? levelInfo.name_zh : levelInfo.name_en}
        <span className="dot" style={{ background: levelInfo.color_hex }}></span>
      </div>
      
      {/* 方位 + 时辰 */}
      <div className="dir-hour">
        {isZh ? directionInfo.name_zh : directionInfo.name_en}
        <span className="separator">·</span>
        {t('current_hour')}
      </div>
      
      {/* 短建议 */}
      <p className="short-advice">{combination.short_advice}</p>
      
      {/* 展开按钮 */}
      {!showDetail && (
        <button onClick={onToggleDetail} className="why-button">
          {t('why_this')} ↓
        </button>
      )}
      
      {/* 详细建议(展开后) */}
      {showDetail && (
        <div className="detail-section">
          <h4>{t('detailed_label')}</h4>
          <p>{combination.detailed_advice}</p>
          
          <h4>{t('rationale_label')}</h4>
          <p>{combination.rationale}</p>
          
          <button onClick={onToggleDetail} className="collapse-button">
            {t('collapse')} ↑
          </button>
        </div>
      )}
    </div>
  );
}

// ============= 底部控制 =============

function BottomControls({ 
  vrMode, 
  onToggleVR, 
  hasPermission, 
  onRequestPermission,
  isSupported,
  locale 
}: any) {
  const t = useTranslations('syncro.main');
  
  if (!isSupported) {
    return (
      <div className="bottom-controls error">
        <p>{t('not_supported')}</p>
      </div>
    );
  }
  
  if (!hasPermission) {
    return (
      <div className="bottom-controls">
        <button onClick={onRequestPermission} className="permission-button">
          {t('enable_compass')}
        </button>
      </div>
    );
  }
  
  return (
    <div className="bottom-controls">
      <button 
        onClick={onToggleVR}
        className={`vr-toggle ${vrMode ? 'active' : ''}`}
      >
        {vrMode ? t('exit_vr') : t('enable_vr')}
      </button>
    </div>
  );
}
```

## Step 9.4: 顶部状态条

文件:`components/syncro/SyncroTimerBar.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { HOUR_PERIODS, secondsToNextHourPeriod } from '@/lib/syncro/types';

interface Props {
  currentHourPeriod: string;
  locale: string;
}

export function SyncroTimerBar({ currentHourPeriod, locale }: Props) {
  const t = useTranslations('syncro.timer');
  const [secondsLeft, setSecondsLeft] = useState(secondsToNextHourPeriod());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(secondsToNextHourPeriod());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const periodInfo = HOUR_PERIODS[currentHourPeriod as keyof typeof HOUR_PERIODS];
  const isZh = locale.startsWith('zh');
  
  const hours = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  
  return (
    <div className="syncro-timer-bar">
      <div className="timer-line-1">
        <span className="dot-live"></span>
        {t('live_label')} · {t('current_window_only')}
      </div>
      
      <div className="timer-line-2">
        <span className="period-name">
          {isZh ? periodInfo.name_zh : periodInfo.name_en}
        </span>
        <span className="period-time">
          ({periodInfo.start_hour}:00 - {periodInfo.end_hour}:00)
        </span>
      </div>
      
      <div className="timer-line-3">
        {t('next_update_in')} {hours > 0 ? `${hours}h ` : ''}{mins}min
      </div>
      
      <p className="timer-philosophy">
        {t('philosophy_line')}
      </p>
    </div>
  );
}
```

## Step 9.5: 翻译

`messages/en/syncro.json` 补充:

```json
{
  "main": {
    "current_hour": "this hour",
    "why_this": "Why this current",
    "detailed_label": "Read deeper",
    "rationale_label": "The reasoning",
    "collapse": "Collapse",
    "enable_compass": "Enable compass",
    "enable_vr": "Open VR mode",
    "exit_vr": "Exit VR mode",
    "not_supported": "Your device doesn't support orientation",
    "combination_not_found": "No reading available for this combination"
  },
  "timer": {
    "live_label": "Live",
    "current_window_only": "This window only",
    "next_update_in": "Next update in",
    "philosophy_line": "The current shifts every 2 hours. Come back when the next hour opens."
  }
}
```

`messages/zh/syncro.json` 补充:

```json
{
  "main": {
    "current_hour": "本时辰",
    "why_this": "为什么是这个流",
    "detailed_label": "深读",
    "rationale_label": "命理依据",
    "collapse": "收起",
    "enable_compass": "开启罗盘",
    "enable_vr": "开启 VR 模式",
    "exit_vr": "退出 VR 模式",
    "not_supported": "你的设备不支持方向感应",
    "combination_not_found": "此组合无指引"
  },
  "timer": {
    "live_label": "实时",
    "current_window_only": "仅限本时辰",
    "next_update_in": "距下次更新",
    "philosophy_line": "能量场每两个时辰一变,下一时辰开始时再来。"
  }
}
```

## 验证清单

```
□ SyncroSplineCanvas 加载 Spline 文件
□ SyncroOrientationProvider 获取方向
□ DirectionLabels 8 方位符号显示
□ 方位符号随手机方向反向旋转
□ 当前方位高亮
□ CenterInfo 显示行动建议
□ "Why?" 按钮展开详细
□ TimerBar 显示倒计时
□ 时辰切换自动刷新

🛑 等用户确认进入 Step 10
```

---

# 第 10 部分:Step 10 - VR 模式 + 结果页

## Step 10.1: SyncroVRMode 组件

文件:`components/syncro/SyncroVRMode.tsx`

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';

export function SyncroVRMode() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment'  // 后置摄像头
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e: any) {
        setError(e.message);
      }
    }
    
    startCamera();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);
  
  if (error) {
    return (
      <div className="vr-error">
        <p>Camera access denied. {error}</p>
      </div>
    );
  }
  
  return (
    <div className="syncro-vr-frame">
      <video 
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="vr-video"
      />
    </div>
  );
}
```

## Step 10.2: /syncro/result/[id] 页面

文件:`app/[locale]/(marketing)/syncro/result/[id]/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { loadSyncroSession, isSyncroSessionExpired } from '@/lib/syncro/syncro-session';
import { SyncroOrientationProvider } from '@/components/syncro/SyncroOrientationProvider';
import { SyncroMainView } from '@/components/syncro/SyncroMainView';
import type { SyncroSession } from '@/lib/syncro/types';

export default function SyncroResultPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  
  const sessionId = params.id as string;
  
  const [session, setSession] = useState<SyncroSession | null>(null);
  const [stage, setStage] = useState<'loading' | 'ready' | 'expired' | 'error'>('loading');
  
  useEffect(() => {
    loadSession();
  }, [sessionId]);
  
  async function loadSession() {
    try {
      const expired = await isSyncroSessionExpired(sessionId);
      if (expired) {
        setStage('expired');
        return;
      }
      
      const s = await loadSyncroSession(sessionId);
      if (!s) {
        setStage('error');
        return;
      }
      
      setSession(s);
      setStage('ready');
    } catch (e) {
      setStage('error');
    }
  }
  
  if (stage === 'loading') {
    return <div className="loading-fullscreen">Loading...</div>;
  }
  
  if (stage === 'expired') {
    return (
      <div className="syncro-expired">
        <h2>This Syncro window has closed.</h2>
        <p>$4.99 covers 24 hours. Yours has ended.</p>
        <button onClick={() => router.push(`/${locale}/syncro`)} className="primary">
          Start a new Syncro
        </button>
      </div>
    );
  }
  
  if (stage === 'error' || !session) {
    return (
      <div className="syncro-error">
        <p>Session not found.</p>
        <button onClick={() => router.push(`/${locale}/syncro`)}>Back to Syncro</button>
      </div>
    );
  }
  
  return (
    <SyncroOrientationProvider>
      <SyncroMainView session={session} locale={locale} />
    </SyncroOrientationProvider>
  );
}
```

## Step 10.3: 关键 CSS

文件:`styles/syncro.css`

```css
/* ============= 主视图 ============= */

.syncro-main-view {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at center, #0a0a1a 0%, #000 100%);
  overflow: hidden;
  color: #e5e5e5;
}

/* Spline 全屏 */
.syncro-spline-canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
}

/* 8 方位符号叠加 */
.direction-labels-container {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s linear;
}

.direction-label {
  position: absolute;
  color: rgba(255, 255, 255, 0.5);
  font-size: 18px;
  font-weight: 600;
  transition: all 0.2s;
}

.direction-label.active {
  color: #D4AF37;
  font-size: 22px;
  text-shadow: 0 0 12px #D4AF37;
}

/* 中央信息 */
.center-info {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  text-align: center;
  padding: 20px;
  max-width: 300px;
}

.center-info.in-vr-frame {
  max-width: 60vmin;  /* VR 视框内 */
  font-size: 13px;
}

.current-level-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
  margin-bottom: 8px;
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dir-hour {
  font-size: 13px;
  color: #888;
  margin-bottom: 16px;
}

.short-advice {
  font-size: 15px;
  line-height: 1.6;
  color: #e5e5e5;
  margin-bottom: 16px;
}

.why-button {
  background: transparent;
  border: 1px solid rgba(212, 175, 55, 0.4);
  color: #D4AF37;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
}

.detail-section {
  text-align: left;
  margin-top: 16px;
}

.detail-section h4 {
  color: #D4AF37;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
  margin-top: 12px;
}

.detail-section p {
  font-size: 13px;
  line-height: 1.6;
  color: #ccc;
}

/* 顶部状态条 */
.syncro-timer-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  padding: 16px 20px;
  text-align: center;
}

.timer-line-1 {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.dot-live {
  width: 6px;
  height: 6px;
  background: #C62828;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.timer-line-2 {
  font-size: 16px;
  color: #D4AF37;
  margin-bottom: 4px;
}

.period-time {
  color: #888;
  font-size: 13px;
  margin-left: 8px;
}

.timer-line-3 {
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
}

.timer-philosophy {
  font-size: 11px;
  color: #666;
  font-style: italic;
  max-width: 280px;
  margin: 0 auto;
}

/* 底部控制 */
.bottom-controls {
  position: absolute;
  bottom: 32px;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
}

.vr-toggle, .permission-button {
  background: rgba(212, 175, 55, 0.2);
  border: 1px solid #D4AF37;
  color: #D4AF37;
  padding: 12px 28px;
  border-radius: 30px;
  cursor: pointer;
  font-weight: 600;
}

.vr-toggle.active {
  background: #D4AF37;
  color: #0a0a0f;
}

/* VR 模式 */
.syncro-vr-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 70vmin;
  height: 70vmin;
  border-radius: 50%;
  overflow: hidden;
  z-index: 3;
  border: 3px solid rgba(212, 175, 55, 0.6);
  box-shadow: 0 0 60px rgba(212, 175, 55, 0.3);
}

.vr-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.syncro-main-view.vr-mode .syncro-spline-canvas {
  opacity: 0.3;  /* VR 模式下 Spline 半透明 */
}

.syncro-main-view.vr-mode .center-info {
  z-index: 11;
  max-width: 60vmin;
}
```

## 验证清单

```
□ /syncro/result/[id] 页面加载
□ 24 小时窗口检查正常
□ 过期显示引导付费
□ Spline 加载且可旋转
□ 8 方位符号正确显示
□ 当前方位高亮
□ 中央显示行动建议
□ "Why?" 展开/收起
□ VR 模式启用摄像头
□ VR 视框圆形 + 文字适配
□ 顶部状态条 + 倒计时
□ 时辰自动切换刷新

🛑 等用户确认进入 Step 11
```

---

# 第 11 部分:Step 11 - Archive 集成 + 端到端测试

## Step 11.1: Archive 集成

修改 `lib/archive/archive-service.ts` 添加 Syncro 类型:

```typescript
// 在已有的 archive-service.ts 中添加

export interface SyncroTaskArchiveData {
  syncro_session_id: string;
  profile_id: string;
  task_description: string;
  created_at: string;
  expires_at: string;
  // 不存完整 matrix(太大),只存关键信息
  best_combination?: {
    hour_period: string;
    direction: string;
    current_level: string;
    short_advice: string;
  };
}

export async function saveSyncroToArchive(input: {
  syncro_session_id: string;
  profile_id: string;
  task_description: string;
  matrix: any;
  expires_at: Date;
}): Promise<string> {
  const deviceId = getDeviceId();
  if (!deviceId) throw new Error('App not initialized');
  
  const archiveId = uuidv4();
  const now = new Date();
  
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const title = `Syncro: ${input.task_description.slice(0, 30)}... - ${dateStr}`;
  
  // 找最佳组合(用 score 排序)
  const bestCombo = Object.entries(input.matrix)
    .map(([key, combo]: any) => {
      const [hour, dir] = key.split('__');
      return { hour, dir, combo, score: scoreFor(combo.current_level) };
    })
    .sort((a, b) => b.score - a.score)[0];
  
  const data: SyncroTaskArchiveData = {
    syncro_session_id: input.syncro_session_id,
    profile_id: input.profile_id,
    task_description: input.task_description,
    created_at: now.toISOString(),
    expires_at: input.expires_at.toISOString(),
    best_combination: bestCombo ? {
      hour_period: bestCombo.hour,
      direction: bestCombo.dir,
      current_level: bestCombo.combo.current_level,
      short_advice: bestCombo.combo.short_advice
    } : undefined
  };
  
  const { ciphertext, iv } = await encrypt(data);
  
  await db.archive.put({
    archive_id: archiveId,
    device_id: deviceId,
    type: 'syncro_task',
    profile_id: input.profile_id,
    title,
    encrypted_data: ciphertext,
    iv,
    created_at: now,
    product: 'syncro'
  });
  
  return archiveId;
}

function scoreFor(level: string): number {
  const map: any = {
    open_current: 5,
    following_current: 4,
    stillwater: 3,
    crosscurrent: 2,
    undertow: 1
  };
  return map[level] || 0;
}
```

## Step 11.2: 在创建 syncro session 时自动存 Archive

修改 `app/[locale]/(marketing)/syncro/computing/page.tsx` 的 compute() 函数:

```typescript
// 在创建 syncro_session 后:

await saveSyncroToArchive({
  syncro_session_id: sessionId,
  profile_id: profileId,
  task_description: task,
  matrix: data.matrix,
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
});
```

## Step 11.3: 端到端测试

```
任务:

清空浏览器数据,无痕模式,启动 dev server

测试用例:
  Profile: 1977-02-17 03:00 男 (POJU 已生成 base_analysis)
  Task: "Tomorrow I have a job interview at 10 AM"

【场景 A:桌面打开】

1. 访问 /syncro
   ✓ 检测到桌面
   ✓ 显示"Open on mobile" 引导
   ✓ 不显示开始按钮

【场景 B:手机首次使用】

2. 手机访问 /syncro
   ✓ 看到 SYNCRO 介绍 + 功能卡
   ✓ 按钮显示 "Start free (first time)"

3. 点击 → 跳转 /syncro/task
   ✓ 输入任务描述(30 字以上)
   ✓ 字数计数器显示

4. 继续 → 跳转 /syncro/prepare
   ✓ 看到 SYNCRO 欢迎词(不是 POJU)
   ✓ 显示已有 profile(若有)或滚轮表单
   ✓ 选择 profile

5. 继续 → 跳转 /syncro/location
   ✓ 弹出定位请求
   ✓ 允许 → 获取坐标
   ✓ 自动跳转 computing

6. /syncro/computing
   ✓ 流式动画(6 个步骤循环)
   ✓ DeepSeek 调用约 60-90 秒
   ✓ 成功后创建 session
   ✓ 跳转 /syncro/result/[id]

7. /syncro/result/[id] 主界面
   ✓ Spline 3D 粒子圆加载
   ✓ 8 方位符号显示(N/NE/E/SE/S/SW/W/NW)
   ✓ 旋转手机 → 粒子圆反向旋转(保持北朝北)
   ✓ 当前指向方位高亮
   ✓ 中央显示:
     - Current Level (例 "Open Current")
     - 方位 + 时辰
     - 30-50 字短建议
     - "Why this current?" 按钮
   ✓ 点击 "Why?" 展开详细
   ✓ 顶部状态条:
     - "Live · This window only"
     - 当前时辰名 + 时间范围
     - 倒计时
     - 哲学引导

8. 点击 "Open VR mode"
   ✓ 请求摄像头权限
   ✓ 中央出现圆形视框
   ✓ 视频流显示
   ✓ Spline 变半透明
   ✓ 中央信息显示在视框内(适配大小)
   ✓ 移动手机 → 视框中的画面跟着变(因为摄像头朝向变了)
   ✓ 8 方位符号随手机方向反向旋转

9. 退出 VR → 返回普通模式

10. 旋转手机到不同方位 → 中央建议实时切换

11. 等到时辰切换点(或修改系统时间测试)
    ✓ 自动重新渲染
    ✓ 倒计时重置
    ✓ 8 方位的建议可能变化

【场景 C:已用过免费,要付费】

12. device_usage 中 syncro.free_used = true
13. 访问 /syncro
    ✓ 按钮显示 "Start a session — $4.99"

【场景 D:24 小时窗口过期】

14. 修改 expires_at 到过去
15. 访问 /syncro/result/[id]
    ✓ 显示 "This Syncro window has closed"
    ✓ 引导付费新 session

【场景 E:Archive 集成】

16. 访问 /archive
    ✓ 看到 Syncro 条目
    ✓ 标题: "Syncro: Tomorrow I have a job ... - 2026-05-22"
    ✓ 点击进入详细页 → 显示 best_combination

【验证清单】

□ 场景 A-E 全部通过
□ Spline 3D 加载正常(贴 console 截图)
□ 方向感应器实时跟随
□ VR 模式工作
□ 时辰自动切换
□ 24 小时窗口检查
□ device_usage 正确记录
□ Archive 正确保存
□ 与 POJU profile 共享一致

【报告】

完成后向用户提交:
1. 5 个场景的测试截图描述
2. DeepSeek 调用的 latency / tokens / cost
3. 96 组合 matrix 的 JSON 样本(至少 5 个 combination)
4. Spline 是否正常加载
5. iOS / Android 测试情况
6. 任何 bug 或体验问题
```

## 验证清单

```
□ 全部 5 场景通过
□ Spline 3D + 方向感应器 + VR 全部工作
□ DeepSeek 96 组合正确
□ 时辰自动切换
□ 24 小时窗口管理
□ Archive 共享
□ 跟 POJU profile 一致

🛑 等用户最终确认 Syncro v5.0 上线就绪
```

---

# Syncro v5.0 完整重构清单

```
✅ Step 1: 现状自查
✅ Step 2: 清理 + Spline 依赖 + device_usage 表
✅ Step 3: Current 5 等级系统
✅ Step 4: Syncro session 数据结构
✅ Step 5: 入口流程 + 桌面引导
✅ Step 6: 任务输入页
✅ Step 7: Profile 选择 + 位置授权
✅ Step 8: DeepSeek 96 组合计算
✅ Step 9: Spline 3D 主界面 + 方向感应器
✅ Step 10: VR 模式 + 结果页
✅ Step 11: Archive 集成 + 端到端测试

核心成就:
  ⭐ 复用 POJU 八字采集
  ⭐ Spline 3D 粒子圆动效
  ⭐ 手机方向感应器实时
  ⭐ VR 模式(摄像头视框)
  ⭐ Current 5 等级体系(替代"吉凶")
  ⭐ 12 时辰自动切换
  ⭐ 24 小时窗口管理
  ⭐ 桌面/老手机优雅拒绝
  ⭐ 共享 Archive 系统
```

---

# 给 Cursor 的最终提醒

```
本任务包含 Step 1-11。

实施顺序(严格按序):
1. Step 1: 自查报告
2. Step 2: 清理 + 装 Spline
3. Step 3: Current 系统
4. Step 4: 数据结构
5. Step 5: 入口
6. Step 6: 任务输入
7. Step 7: Profile + 位置
8. Step 8: DeepSeek 计算
9. Step 9: Spline 主界面(最复杂!)
10. Step 10: VR + 结果页
11. Step 11: Archive + 端到端测试

⚠️ 特殊注意:
- Step 9 涉及 3 个技术(Spline + Orientation + 8 方位 HTML 叠加)
  建议先单独测试每个,再整合
  
- Step 10 VR 需要 HTTPS,本地 dev 用 localhost 也可
  生产必须 HTTPS

- Spline 文件名 "Compass" 假设:
  Cursor 需要打开 fangwei.splinecode 确认实际对象名
  如果不是 "Compass",调整代码

- iOS 必须用户主动点击触发权限请求
  不能在页面加载时自动请求

完成后:
  ✓ Syncro v5.0 可以软上线
  ✓ POJU + Glyph + Syncro 共享底层完整
  ✓ Match 是最后一个产品
```

---

**Cursor: 完成 Step 1-11 后,Syncro v5.0 重构完成。**

**用户:Syncro 完成后,我会发 Match 的完整 Cursor 指令。**
