# pojulife Syncro 三模式统一重构

> **背景**:基于真实测试反馈,Syncro 三模式(Compass / AR / MAP)需要系统重构
>
> **核心问题**:
> 1. 🚨 P0:12 时辰 LLM 数据可能没真正生成(只看到当前时辰)
> 2. 🚨 P0:Compass 布局错误(方位符未围绕粒子,未跟手机转)
> 3. 🟡 P1:AR 模式重新设计(圆形视窗 + 光韵边框)
> 4. 🟡 P1:MAP 视图放大,风格统一
> 5. 🟡 P1:按钮缩小、被挡修复、平放/竖立提示
>
> **执行原则**:严格【一步一停】

---

# ⚠️ Cursor 必读

```
本任务的核心理解:

1. 三模式【统一视觉骨架】(关键)
   ┌─────────────────────────────────┐
   │     外圈:8 方位符 (N S E W ...)  │  ← 同心圆 #1
   │   ┌──────────────────────────┐  │
   │   │   中圈:粒子效果(缩小)   │  │  ← 同心圆 #2
   │   │   ┌──────────────────┐    │  │
   │   │   │  中心:信息层      │    │  │  ← 同心圆 #3
   │   │   │   - Compass:文字 │    │  │
   │   │   │   - AR:摄像头视窗│    │  │
   │   │   │   - MAP:8 个点  │    │  │
   │   │   └──────────────────┘    │  │
   │   └──────────────────────────┘  │
   └─────────────────────────────────┘
   
   三模式共用这个骨架,只是【中心层】不同

2. 整体旋转机制
   - 父容器 = "方位符 + 粒子效果"
   - 父容器整体 rotate(-alpha)(跟手机方位)
   - 中心信息 = 独立定位,不旋转

3. 12 时辰数据是大坑
   - 用户怀疑是模拟数据
   - 必须排查 + 验证真实 LLM 输出
   - 这是 P0,优先修

每个 Part 完成后:
  - 贴出代码 + 截图 + 测试输出
  - 等用户明确"通过 Part X" 才进入下一步
```

---

# 🚨 第 1 部分(P0):验证 12 时辰 LLM 数据真实性

## 问题描述

```
用户反馈:
  "现在只能看到当前时辰的信息,看不到其他时辰的信息
   所以现在提供的信息应该是模拟的,还不是真的测算后的"

诊断方向:
  - 是否真的调用了 LLM 为 12 时辰 × 8 方位 = 96 个 cell 生成内容?
  - 还是只生成了当前时辰的 8 个 cell?
  - 时辰点击切换时,前端是否真的读取了对应时辰的数据?
  - fallback 模拟数据是否在掩盖真实问题?
```

## Step 1.1: 添加全链路日志

文件:`app/api/syncro/compute_local/route.ts`(添加日志)

```typescript
// 在生成 matrix 后:
console.log('[compute_local] matrix generated:', {
  total_cells: Object.keys(matrix).length,
  expected: 96,  // 12 时辰 × 8 方位
  sample_keys: Object.keys(matrix).slice(0, 5),
  all_hour_periods: [...new Set(Object.keys(matrix).map(k => k.split('__')[0]))],
});

// 应该看到:
// total_cells: 96
// all_hour_periods: ['zi','chou','yin','mao','chen','si','wu','wei','shen','you','xu','hai']
```

文件:`app/api/syncro/llm_batch/route.ts`(添加日志)

```typescript
// 在收到 matrix_slice 时:
console.log('[llm_batch] received:', {
  batch_index,
  slice_size: Object.keys(matrix_slice).length,
  slice_hour_periods: [...new Set(Object.keys(matrix_slice).map(k => k.split('__')[0]))],
});

// 在 LLM 返回后:
console.log('[llm_batch] LLM returned:', {
  batch_index,
  cells_with_advice: Object.keys(parsed.advice).length,
  sample_advice: Object.values(parsed.advice)[0]
});
```

文件:`components/syncro/SyncroResultLoader.tsx`(客户端追踪)

```typescript
async function loadBatch(batchIndex: number, batchKeys: string[]) {
  console.log(`[batch ${batchIndex}] starting, keys:`, batchKeys);
  
  // ... 调用 API
  
  console.log(`[batch ${batchIndex}] received:`, {
    advice_keys: Object.keys(data.advice),
    has_short: !!Object.values(data.advice)[0]?.short_advice,
    has_detailed: !!Object.values(data.advice)[0]?.detailed_advice,
    has_rationale: !!Object.values(data.advice)[0]?.rationale
  });
  
  // 合并后再打印一次完整 matrix 状态
  console.log(`[batch ${batchIndex}] after merge, matrix stats:`, {
    total: Object.keys(matrix).length,
    with_llm: Object.values(matrix).filter((c: any) => !c.llm_pending).length,
    pending: Object.values(matrix).filter((c: any) => c.llm_pending).length
  });
}
```

## Step 1.2: 时辰切换时的数据验证

文件:`components/syncro/SyncroCompassMode.tsx`(在 cell 读取时加日志)

```typescript
const cellKey = `${activeHour}__${currentDirection}`;
const cell = matrix[cellKey];

useEffect(() => {
  console.log('[Compass] cell lookup:', {
    activeHour,
    currentDirection,
    cellKey,
    found: !!cell,
    has_llm_advice: !!cell?.short_advice,
    is_fallback: cell?.llm_pending,
    cell_data: cell
  });
}, [activeHour, currentDirection, cell]);
```

## Step 1.3: Fallback 数据要明确标识

文件:`lib/syncro/fallback-advice.ts`(修改)

```typescript
export function generateFallbackAdvice(cell: any, locale: string, type: string): string {
  const fallbackText = /* 现有的简单文案 */;
  
  // ⚠️ 加调试标记(开发环境可见)
  if (process.env.NODE_ENV === 'development') {
    return `[FALLBACK] ${fallbackText}`;
  }
  
  return fallbackText;
}
```

这样开发时一眼能看出哪些是 LLM 真生成的,哪些是 fallback。

## Step 1.4: 验证后报告

让 Cursor 运行一次完整 Syncro 流程,贴出日志报告:

```
报告格式:

[compute_local] matrix generated:
  - total_cells: ?
  - all_hour_periods: [?]

[batch 0-5] 6 个批次的 LLM 调用结果:
  - batch 0: cells_with_advice: ?
  - batch 1: cells_with_advice: ?
  ...

[Compass] 切换不同时辰时的数据状态:
  - 时辰 1: has_llm_advice: true/false
  - 时辰 2: has_llm_advice: true/false
  ...

预期结果:
  - total_cells: 96
  - 6 batch 都 200 OK,每批 16 cells
  - 所有 12 时辰都有 has_llm_advice: true

如果实际值与预期不符:
  → Cursor 报告问题,等用户决策修复方案
```

## Step 1.5: 如果确实有 cell 没生成

```
可能场景 A:LLM batch 部分失败
  → fallback 文案掩盖了失败
  → 修复:让失败的 batch 标记 llm_failed: true
  → UI 显示"该时辰分析失败,点击重试"按钮

可能场景 B:matrix 只生成了当前时辰
  → compute_local 有 bug
  → 检查 calculateSyncroMatrix 是否真的循环 12 时辰

可能场景 C:前端时辰切换读错了 key
  → activeHour 是否正确切换
  → matrix[`${activeHour}__${direction}`] 是否能找到

让 Cursor 根据日志结果,精准定位修复
```

## 验证清单 - Part 1

```
□ 所有日志加好
□ 跑一次完整 Syncro 流程
□ 贴出 console.log 输出
□ 用户审视:
  - 96 cells 都生成了?
  - 每个时辰都有真 LLM 内容?
  - 切换时辰能看到不同内容?
□ 如果发现 bug,修复后再测一次

🛑 等用户确认进入 Part 2
```

---

# 🚨 第 2 部分(P0):Compass 三层同心圆 + 整体旋转

## 设计目标

```
关键视觉:三层同心圆(从外到内)

  Layer 1(最外):8 个方位符 N NE E SE S SW W NW
  Layer 2(中间):粒子动效(缩小,在方位符内)
  Layer 3(中心):Current 信息(文字 / 摄像头视窗 / 8点)

旋转机制:
  - Layer 1 + Layer 2 = 一个父容器
  - 父容器 transform: rotate(-alpha deg)
  - Layer 3(中心信息)= 独立定位,不旋转

用户体验:
  - 用户平放手机
  - 旋转身体 → 看到方位符和粒子动效一起转
  - 中心 N 始终对真北
  - 文字信息始终保持水平易读
```

## Step 2.1: 三层同心圆容器结构

文件:`components/syncro/SyncroCompassMode.tsx`(重写关键部分)

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { compassDegreeToDirection } from '@/lib/syncro/current-system';
import { WhyThisCurrentModal } from './WhyThisCurrentModal';
import { SyncroParticleCore } from './SyncroParticleCore';

interface Props {
  matrix: Record<string, any>;
  activeHour: string;
  compassDegree: number;
  orientationGranted: boolean;
  onRequestPermission: () => void;
}

export function SyncroCompassMode({
  matrix,
  activeHour,
  compassDegree,
  orientationGranted,
  onRequestPermission
}: Props) {
  const t = useTranslations('syncro');
  const [whyModalOpen, setWhyModalOpen] = useState(false);
  
  // 当前指向的方位(根据手机方位 + 北方校准)
  const currentDirection = compassDegreeToDirection(compassDegree);
  const cellKey = `${activeHour}__${currentDirection}`;
  const cell = matrix[cellKey];
  
  if (!orientationGranted) {
    return <CompassPermissionPrompt onRequest={onRequestPermission} />;
  }
  
  return (
    <div className="compass-mode">
      {/* === 平放手机提示 === */}
      <FlatPhoneHint />
      
      {/* === 三层同心圆 === */}
      <div className="concentric-system">
        
        {/* Layer 1 + 2:旋转父容器(跟手机转)*/}
        <div 
          className="rotating-layer"
          style={{
            transform: `rotate(${-compassDegree}deg)`,
            transition: 'transform 200ms ease-out'
          }}
        >
          {/* Layer 2:粒子动效(在内,缩小)*/}
          <div className="particle-layer">
            <SyncroParticleCore />
          </div>
          
          {/* Layer 1:8 方位符(在外圈)*/}
          <DirectionRingLabels />
        </div>
        
        {/* Layer 3:中心信息(独立,不旋转)*/}
        <div className="center-info-layer">
          {cell ? (
            <CurrentDisplay cell={cell} hourId={activeHour} />
          ) : (
            <NoDataPlaceholder />
          )}
        </div>
        
      </div>
      
      {/* === 下方:Why this current 按钮 === */}
      <div className="compass-bottom-cta">
        <button 
          className="why-btn-prominent"
          onClick={() => setWhyModalOpen(true)}
        >
          {t('why_this_current')}
        </button>
      </div>
      
      {/* Modal */}
      {whyModalOpen && cell && (
        <WhyThisCurrentModal 
          cell={cell}
          direction={currentDirection}
          hourId={activeHour}
          onClose={() => setWhyModalOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * 8 方位符(外圈)
 */
function DirectionRingLabels() {
  // 8 方位 + 角度
  const directions = [
    { id: 'N',  angle: 0,   label: 'N' },
    { id: 'NE', angle: 45,  label: 'NE' },
    { id: 'E',  angle: 90,  label: 'E' },
    { id: 'SE', angle: 135, label: 'SE' },
    { id: 'S',  angle: 180, label: 'S' },
    { id: 'SW', angle: 225, label: 'SW' },
    { id: 'W',  angle: 270, label: 'W' },
    { id: 'NW', angle: 315, label: 'NW' }
  ];
  
  return (
    <div className="direction-ring">
      {directions.map(dir => (
        <div 
          key={dir.id}
          className="direction-label"
          style={{
            transform: `rotate(${dir.angle}deg) translateY(-130px) rotate(${-dir.angle}deg)`
            // 三步:旋转到角度位置 → 平移到圆周上 → 反向旋转保持字朝上
          }}
        >
          {dir.label}
        </div>
      ))}
    </div>
  );
}

/**
 * 中心信息显示(不旋转)
 */
function CurrentDisplay({ cell, hourId }: { cell: any; hourId: string }) {
  const levelLabel = getCurrentLevelLabel(cell.current_level);
  const levelClass = `current-${cell.current_level.replace('_current', '').replace('_', '-')}`;
  
  return (
    <div className="current-display">
      <div className={`current-level ${levelClass}`}>
        {levelLabel}
      </div>
      <div className="current-meta">
        {getHourMetaText(hourId)}
      </div>
    </div>
  );
}

/**
 * 平放手机提示(顶部)
 */
function FlatPhoneHint() {
  const t = useTranslations('syncro.compass');
  return (
    <div className="phone-position-hint">
      <i className="ti ti-device-mobile" style={{ transform: 'rotate(90deg)' }} />
      <span>{t('hold_phone_flat')}</span>
    </div>
  );
}

function NoDataPlaceholder() {
  const t = useTranslations('syncro');
  return (
    <div className="no-data">
      <i className="ti ti-loader-2 spin" />
      <span>{t('generating')}</span>
    </div>
  );
}
```

## Step 2.2: 关键样式

文件:`styles/syncro-compass.css`(替换或新建)

```css
.compass-mode {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* === 平放手机提示(顶部小字)=== */
.phone-position-hint {
  position: absolute;
  top: 60px;  /* 时辰条下方 */
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(212, 165, 116, 0.08);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  font-size: 11px;
  color: var(--pj-gold);
  letter-spacing: 0.5px;
  z-index: 5;
}

.phone-position-hint i {
  font-size: 13px;
}

/* === 三层同心圆系统 === */
.concentric-system {
  position: relative;
  width: 320px;
  height: 320px;
  /* 让方位符有空间显示在外圈 */
  margin: 0 auto;
}

/* Layer 1+2:旋转容器 */
.rotating-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Layer 1: 方位符外圈 */
.direction-ring {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.direction-label {
  position: absolute;
  top: 50%;
  left: 50%;
  font-size: 12px;
  font-weight: var(--pj-weight-medium);
  letter-spacing: 1.5px;
  color: var(--pj-text-secondary);
  transform-origin: center;
  /* 重要:每个方位字本身要保持垂直可读
     translate 让它定位到圆周上 */
}

/* Layer 2: 粒子动效(缩小,在方位符内)*/
.particle-layer {
  width: 220px;  /* ⭐ 比 concentric 容器小,留出方位符空间 */
  height: 220px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.particle-layer canvas {
  width: 100% !important;
  height: 100% !important;
}

/* Layer 3: 中心信息(独立,不旋转)*/
.center-info-layer {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 140px;
  text-align: center;
  z-index: 5;
  pointer-events: none;
}

.current-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.current-level {
  font-size: 18px;
  font-weight: var(--pj-weight-medium);
  line-height: var(--pj-leading-tight);
  letter-spacing: 0.2px;
}

.current-level.current-open      { color: var(--pj-open); }
.current-level.current-following { color: var(--pj-following); }
.current-level.current-still     { color: var(--pj-still); }
.current-level.current-cross     { color: var(--pj-cross); }
.current-level.current-under     { color: var(--pj-under); }

.current-meta {
  font-size: 10px;
  color: var(--pj-text-tertiary);
  letter-spacing: 0.3px;
  margin-top: 4px;
}

/* === Why this current 按钮(避免被挡)=== */
.compass-bottom-cta {
  position: absolute;
  bottom: 130px;  /* ⭐ 留出模式切换条 + 底部 nav 空间 */
  left: 50%;
  transform: translateX(-50%);
  z-index: 8;
}

.why-btn-prominent {
  padding: 10px 20px;
  background: rgba(212, 165, 116, 0.12);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: var(--pj-gold);
  font-family: inherit;
  font-size: 11px;
  font-weight: var(--pj-weight-medium);
  letter-spacing: 0.3px;
  border-radius: 20px;
  cursor: pointer;
  box-shadow: 
    0 0 24px rgba(212, 165, 116, 0.15),
    inset 0 0 0 0.5px rgba(212, 165, 116, 0.3);
  transition: all var(--pj-duration-fast);
}

.why-btn-prominent:active {
  transform: scale(0.96);
  background: rgba(212, 165, 116, 0.2);
}

/* === 数据加载占位 === */
.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--pj-text-tertiary);
  font-size: 11px;
}

.no-data i.spin {
  animation: spin 1s linear infinite;
  font-size: 20px;
  color: var(--pj-gold);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

## Step 2.3: 关键技术 - 方位符定位算法

```typescript
// 方位符在外圈的位置计算

const RING_RADIUS = 130;  // 方位符距中心的距离

function getDirectionLabelPosition(angle: number) {
  // angle: 0=N, 45=NE, 90=E, 135=SE, 180=S, 225=SW, 270=W, 315=NW
  // 注意:CSS 旋转中,0° 通常指向右侧(东),需要 -90° 校准让 N 指上
  
  const radians = ((angle - 90) * Math.PI) / 180;  // -90 让 N 指上
  const x = Math.cos(radians) * RING_RADIUS;
  const y = Math.sin(radians) * RING_RADIUS;
  
  return { x, y };
}

// 在组件中:
{directions.map(dir => {
  const { x, y } = getDirectionLabelPosition(dir.angle);
  return (
    <div
      key={dir.id}
      className="direction-label"
      style={{
        transform: `translate(${x}px, ${y}px)`,
        // 因为父容器在旋转,字会跟着转,所以这里不再单独反转
        // 整个字会跟手机转,这正是我们想要的
      }}
    >
      {dir.label}
    </div>
  );
})}
```

## Step 2.4: 翻译

文件:`messages/en/syncro.json`(扩展)

```json
{
  "syncro": {
    "compass": {
      "hold_phone_flat": "Hold your phone flat, facing up"
    },
    "ar": {
      "hold_phone_upright": "Hold your phone upright, facing forward"
    },
    "generating": "Generating reading...",
    "no_data": "No data for this period yet"
  }
}
```

文件:`messages/zh/syncro.json`

```json
{
  "syncro": {
    "compass": {
      "hold_phone_flat": "请将手机平放,屏幕朝上"
    },
    "ar": {
      "hold_phone_upright": "请将手机竖立,正对前方"
    },
    "generating": "正在生成解读...",
    "no_data": "该时段暂无数据"
  }
}
```

## 验证清单 - Part 2

```
□ 三层同心圆视觉清晰
  - 外圈:8 个方位符 N NE E SE S SW W NW
  - 中圈:粒子动效(缩小,在方位符内)
  - 中心:Current 信息(文字)

□ 整体旋转
  - 用户转身 → 方位符跟着转
  - 粒子动效跟着转(因为在同一旋转父容器内)
  - 中心文字保持不动(独立层)

□ N 始终指向真北
  - 旋转手机时,N 标始终对应北方
  
□ "Hold phone flat" 提示显示在顶部

□ Why this current 按钮可见,不被挡

🛑 等用户确认进入 Part 3
```

---

# 🟡 第 3 部分(P1):AR 模式 - 圆形视窗 + 光韵边框

## 设计目标

```
AR 模式 = Compass 模式 + 中心多一个摄像头视窗

布局(跟 Compass 一样):
  Layer 1:8 方位符外圈(同 Compass)
  Layer 2:粒子动效(同 Compass)
  Layer 3:中心 → 圆形摄像头视窗
           - 视窗边框 = 光韵效果
           - 光韵颜色根据当前方位的 Current 等级
           - 视窗中心叠加 Current 信息文字

光韵颜色规则:
  - Open Current    → 亮青色光韵 #00D9B8
  - Following       → 柔青色光韵 #4ECDC4
  - Stillwater      → 灰色光韵   #8A8AA0
  - Crosscurrent    → 橙色光韵   #E89F4D
  - Undertow        → 红色光韵   #C85A5A

手势:用户竖立手机(需提示)
```

## Step 3.1: SyncroARMode 重写

文件:`components/syncro/SyncroARMode.tsx`(完全重写)

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { compassDegreeToDirection } from '@/lib/syncro/current-system';
import { WhyThisCurrentModal } from './WhyThisCurrentModal';
import { SyncroParticleCore } from './SyncroParticleCore';

interface Props {
  matrix: Record<string, any>;
  activeHour: string;
  compassDegree: number;
  cameraGranted: boolean;
  onRequestCamera: () => void;
}

export function SyncroARMode({
  matrix,
  activeHour,
  compassDegree,
  cameraGranted,
  onRequestCamera
}: Props) {
  const t = useTranslations('syncro');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [whyModalOpen, setWhyModalOpen] = useState(false);
  
  const currentDirection = compassDegreeToDirection(compassDegree);
  const cell = matrix[`${activeHour}__${currentDirection}`];
  
  // 摄像头管理
  useEffect(() => {
    if (cameraGranted) startCamera();
    return () => stopCamera();
  }, [cameraGranted]);
  
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      console.error('camera failed', e);
    }
  }
  
  function stopCamera() {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  }
  
  if (!cameraGranted) {
    return <ARPermissionPrompt onRequest={onRequestCamera} />;
  }
  
  // 当前方位的光韵颜色
  const haloColor = getHaloColor(cell?.current_level);
  
  return (
    <div className="ar-mode">
      {/* === 竖立手机提示 === */}
      <UprightPhoneHint />
      
      {/* === 三层同心圆(跟 Compass 一样)=== */}
      <div className="concentric-system">
        
        {/* Layer 1+2:旋转容器 */}
        <div 
          className="rotating-layer"
          style={{ transform: `rotate(${-compassDegree}deg)` }}
        >
          <div className="particle-layer">
            <SyncroParticleCore />
          </div>
          <DirectionRingLabels />
        </div>
        
        {/* Layer 3:中心 = 圆形摄像头视窗(独立,不旋转)*/}
        <div className="ar-window-layer">
          <div 
            className="ar-camera-window"
            style={{
              boxShadow: `
                0 0 32px ${haloColor.glow1},
                0 0 64px ${haloColor.glow2},
                inset 0 0 0 2px ${haloColor.border}
              `
            }}
          >
            <video 
              ref={videoRef}
              className="ar-video"
              playsInline
              muted
              autoPlay
            />
            
            {/* 视窗内的 Current 信息 */}
            {cell && (
              <div className="ar-info-overlay">
                <div className={`ar-level current-${cell.current_level.replace('_current', '').replace('_', '-')}`}>
                  {getCurrentLevelLabel(cell.current_level)}
                </div>
                <div className="ar-meta">
                  {currentDirection} · {getHourMetaText(activeHour)}
                </div>
              </div>
            )}
          </div>
        </div>
        
      </div>
      
      {/* === Why this current 按钮 === */}
      <div className="compass-bottom-cta">
        <button 
          className="why-btn-prominent"
          onClick={() => setWhyModalOpen(true)}
        >
          {t('why_this_current')}
        </button>
      </div>
      
      {whyModalOpen && cell && (
        <WhyThisCurrentModal 
          cell={cell}
          direction={currentDirection}
          hourId={activeHour}
          onClose={() => setWhyModalOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * 根据 Current 等级返回光韵颜色
 */
function getHaloColor(level?: string): {
  border: string;
  glow1: string;
  glow2: string;
} {
  switch (level) {
    case 'open_current':
      return {
        border: 'rgba(0, 217, 184, 0.7)',
        glow1: 'rgba(0, 217, 184, 0.6)',
        glow2: 'rgba(0, 217, 184, 0.3)'
      };
    case 'following_current':
      return {
        border: 'rgba(78, 205, 196, 0.6)',
        glow1: 'rgba(78, 205, 196, 0.5)',
        glow2: 'rgba(78, 205, 196, 0.25)'
      };
    case 'stillwater':
      return {
        border: 'rgba(138, 138, 160, 0.5)',
        glow1: 'rgba(138, 138, 160, 0.3)',
        glow2: 'rgba(138, 138, 160, 0.15)'
      };
    case 'crosscurrent':
      return {
        border: 'rgba(232, 159, 77, 0.6)',
        glow1: 'rgba(232, 159, 77, 0.5)',
        glow2: 'rgba(232, 159, 77, 0.25)'
      };
    case 'undertow':
      return {
        border: 'rgba(200, 90, 90, 0.6)',
        glow1: 'rgba(200, 90, 90, 0.5)',
        glow2: 'rgba(200, 90, 90, 0.25)'
      };
    default:
      return {
        border: 'rgba(255, 255, 255, 0.15)',
        glow1: 'rgba(255, 255, 255, 0.1)',
        glow2: 'transparent'
      };
  }
}

function UprightPhoneHint() {
  const t = useTranslations('syncro.ar');
  return (
    <div className="phone-position-hint">
      <i className="ti ti-device-mobile" />
      <span>{t('hold_phone_upright')}</span>
    </div>
  );
}
```

## Step 3.2: AR 样式

文件:`styles/syncro-ar.css`(新建)

```css
.ar-mode {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 跟 Compass 共用 .concentric-system / .rotating-layer / .particle-layer / .direction-ring */

/* === AR 视窗(中心)=== */
.ar-window-layer {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 160px;   /* 圆形视窗,比中心信息层稍大 */
  height: 160px;
  z-index: 5;
  pointer-events: none;
}

.ar-camera-window {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  
  /* 光韵 box-shadow 通过 inline style 动态设置(根据 Current 等级)*/
  
  transition: box-shadow 600ms ease;
}

.ar-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* === 视窗内的信息叠加 === */
.ar-info-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    circle at center,
    rgba(7, 9, 26, 0.5) 0%,
    rgba(7, 9, 26, 0.2) 60%,
    transparent 100%
  );
  pointer-events: none;
}

.ar-level {
  font-size: 14px;
  font-weight: var(--pj-weight-medium);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  line-height: 1.2;
}

.ar-meta {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.3px;
  margin-top: 4px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}

/* === 光韵动态颜色应用 === */
.ar-level.current-open      { color: var(--pj-open); }
.ar-level.current-following { color: var(--pj-following); }
.ar-level.current-still     { color: var(--pj-still); }
.ar-level.current-cross     { color: var(--pj-cross); }
.ar-level.current-under     { color: var(--pj-under); }

/* === 光韵微动效 === */
@keyframes halo-breathe {
  0%, 100% { opacity: 0.85; }
  50%      { opacity: 1; }
}

.ar-camera-window {
  animation: halo-breathe 3s ease-in-out infinite;
}
```

## 验证清单 - Part 3

```
□ AR 模式布局跟 Compass 一致(三层同心圆)
□ 中心:圆形摄像头视窗
□ 视窗边框光韵随当前方位的 Current 等级变色:
  - Open → 亮青色
  - Following → 柔青色
  - Stillwater → 灰色
  - Crosscurrent → 橙色
  - Undertow → 红色
□ 光韵有微妙的呼吸动效
□ 视窗内叠加 Current 等级文字 + 方位 + 时辰
□ "Hold phone upright" 提示显示
□ 旋转手机时,方位符和粒子转,视窗不动(始终中心)
□ 切换方位时,光韵颜色平滑过渡

🛑 等用户确认进入 Part 4
```

---

# 🟡 第 4 部分(P1):MAP 模式放大 + 风格统一

## 设计目标

```
当前:MAP 圆形视图偏小
应该:
  - 适当放大圆形视图
  - 跟 Compass / AR 共用同一套同心圆骨架
  - 区别仅在:中心层不是文字/视窗,而是【8 个方位点 + 中心信息】
```

## Step 4.1: SyncroMapMode 调整

文件:`components/syncro/SyncroMapMode.tsx`(修改)

```tsx
export function SyncroMapMode({ matrix, activeHour, activeDirection, onSelectDirection }: Props) {
  const t = useTranslations('syncro');
  const [whyModalOpen, setWhyModalOpen] = useState(false);
  
  const activeCell = matrix[`${activeHour}__${activeDirection}`];
  
  return (
    <div className="map-mode">
      {/* === 跟 Compass / AR 同样的容器(放大版)=== */}
      <div className="concentric-system map-larger">
        
        {/* MAP 不旋转,所以不需要 rotating-layer */}
        
        {/* 粒子动效(背景层,缩小)*/}
        <div className="particle-layer">
          <SyncroParticleCore />
        </div>
        
        {/* 8 方位符外圈(固定,不转)*/}
        <DirectionRingLabels />
        
        {/* 中心:8 个点 + 信息 */}
        <div className="map-center-layer">
          
          {/* 8 个方位点(在 ring 上)*/}
          <MapDirectionPoints 
            matrix={matrix}
            activeHour={activeHour}
            activeDirection={activeDirection}
            onSelectDirection={onSelectDirection}
          />
          
          {/* 中心信息卡 */}
          <div className="map-center-card">
            {activeCell ? (
              <>
                <div className="map-center-dir">{activeDirection}</div>
                <div className={`map-center-level current-${activeCell.current_level.replace('_current', '').replace('_', '-')}`}>
                  {getCurrentLevelLabel(activeCell.current_level)}
                </div>
                <div className="map-center-meta">
                  {getHourMetaText(activeHour)}
                </div>
              </>
            ) : (
              <NoDataPlaceholder />
            )}
          </div>
        </div>
        
      </div>
      
      {/* === 提示文字 === */}
      <div className="map-hint">
        {t('map.tap_hint')}
      </div>
      
      {/* === Why this current === */}
      <div className="compass-bottom-cta">
        <button 
          className="why-btn-prominent"
          onClick={() => setWhyModalOpen(true)}
        >
          {t('why_this_current')}
        </button>
      </div>
      
      {whyModalOpen && activeCell && (
        <WhyThisCurrentModal 
          cell={activeCell}
          direction={activeDirection}
          hourId={activeHour}
          onClose={() => setWhyModalOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * 8 个方位点(可点击)
 */
function MapDirectionPoints({ matrix, activeHour, activeDirection, onSelectDirection }: any) {
  const POINT_RADIUS = 145;  // 比方位符稍内一点
  
  const directions = [
    { id: 'N',  angle: 0 },
    { id: 'NE', angle: 45 },
    { id: 'E',  angle: 90 },
    { id: 'SE', angle: 135 },
    { id: 'S',  angle: 180 },
    { id: 'SW', angle: 225 },
    { id: 'W',  angle: 270 },
    { id: 'NW', angle: 315 }
  ];
  
  return (
    <>
      {directions.map(dir => {
        const cell = matrix[`${activeHour}__${dir.id}`];
        const level = cell?.current_level || 'stillwater';
        const isActive = dir.id === activeDirection;
        
        const rad = ((dir.angle - 90) * Math.PI) / 180;
        const x = Math.cos(rad) * POINT_RADIUS;
        const y = Math.sin(rad) * POINT_RADIUS;
        
        return (
          <button
            key={dir.id}
            className={`map-point status-${level.replace('_current', '').replace('_', '-')} ${isActive ? 'active' : ''}`}
            style={{
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
            }}
            onClick={() => onSelectDirection(dir.id)}
            aria-label={dir.id}
          />
        );
      })}
    </>
  );
}
```

## Step 4.2: MAP 样式(放大版)

```css
.map-mode {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* ⭐ 放大版同心圆系统(MAP 专用)*/
.concentric-system.map-larger {
  width: 360px;
  height: 360px;
  /* 比 Compass 的 320px 稍大 */
}

.map-larger .particle-layer {
  width: 260px;
  height: 260px;
  opacity: 0.6;  /* 减弱,作为背景 */
}

.map-larger .direction-label {
  font-size: 13px;
  /* 在更大的圈上 */
}

/* === MAP 中心层 === */
.map-center-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* === 8 个方位点 === */
.map-point {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--pj-text-disabled);
  cursor: pointer;
  pointer-events: auto;
  transition: all var(--pj-duration-fast);
  padding: 0;
  z-index: 4;
}

.map-point.status-open {
  background: var(--pj-open);
  box-shadow: 0 0 16px rgba(0, 217, 184, 0.5);
}

.map-point.status-following {
  background: var(--pj-following);
  opacity: 0.85;
}

.map-point.status-still {
  background: var(--pj-still);
  opacity: 0.6;
}

.map-point.status-cross {
  background: var(--pj-cross);
  box-shadow: 0 0 12px rgba(232, 159, 77, 0.45);
}

.map-point.status-under {
  background: var(--pj-under);
  box-shadow: 0 0 12px rgba(200, 90, 90, 0.45);
}

.map-point.active {
  width: 18px;
  height: 18px;
  background: var(--pj-gold);
  box-shadow: 
    0 0 24px var(--pj-gold-glow),
    0 0 0 2px rgba(212, 165, 116, 0.3);
  z-index: 5;
}

.map-point:active {
  transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) scale(1.2);
}

/* === 中心信息卡 === */
.map-center-card {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  width: 130px;
  pointer-events: none;
}

.map-center-dir {
  font-size: 10px;
  color: var(--pj-gold);
  letter-spacing: 2px;
  font-weight: var(--pj-weight-medium);
  margin-bottom: 6px;
}

.map-center-level {
  font-size: 18px;
  font-weight: var(--pj-weight-medium);
  line-height: var(--pj-leading-tight);
}

.map-center-meta {
  font-size: 10px;
  color: var(--pj-text-tertiary);
  margin-top: 6px;
}

/* === 底部提示 === */
.map-hint {
  position: absolute;
  bottom: 180px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: var(--pj-text-muted);
  letter-spacing: 0.5px;
}
```

## 验证清单 - Part 4

```
□ MAP 视图放大(360px,比 Compass 的 320 大)
□ 8 个方位符在外圈(跟 Compass / AR 一致)
□ 8 个方位点在方位符内圈(可点击)
□ 中心:方位名 + Current 等级 + 时辰
□ 点击点 → 中心切换
□ 风格跟 Compass / AR 统一(同心圆骨架)
□ 粒子动效作为背景(opacity 0.6)
□ "Tap any direction to view" 提示在底部

🛑 等用户确认进入 Part 5
```

---

# 🟡 第 5 部分(P1):底部三模式切换按钮缩小

## 问题描述

```
当前:Compass / AR / MAP 三个切换按键太大
应该:缩小整体比例,看起来更精致
```

## 修复

文件:`components/syncro/ThreeModeToggle.tsx`(调整尺寸)

```tsx
// 组件结构不变,只改 CSS
```

```css
/* === 缩小版三模式切换 === */
.three-mode-toggle {
  position: absolute;
  bottom: 75px;   /* 底部 nav 上方 */
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
  padding: 3px;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.06);
  z-index: 9;
}

.mode-tab {
  display: flex;
  align-items: center;       /* ⭐ 改成横向布局 */
  gap: 5px;
  padding: 6px 14px;         /* ⭐ 缩小 padding */
  background: transparent;
  color: var(--pj-text-muted);
  font-family: inherit;
  font-size: 10px;           /* ⭐ 更小字号 */
  font-weight: var(--pj-weight-medium);
  letter-spacing: 0.3px;
  border-radius: 13px;
  cursor: pointer;
  transition: all var(--pj-duration-fast) var(--pj-ease);
}

.mode-tab i {
  font-size: 13px;            /* ⭐ 更小图标 */
}

.mode-tab.active {
  background: rgba(212, 165, 116, 0.15);
  color: var(--pj-gold);
}

.mode-tab:not(.active):active {
  color: var(--pj-text-secondary);
}
```

## 验证清单 - Part 5

```
□ 三个 tab 整体高度 < 32px(比之前小)
□ 字号 10px(更小,精致)
□ 图标 13px(更小)
□ 横向布局(图标 + 文字一行)
□ 不会挡住上方内容
□ Why this current 按钮跟模式切换栏不重叠

🛑 等用户确认全部完成
```

---

# 🟡 第 6 部分(P1):布局空间总规划

为了避免按钮被遮挡,Cursor 必须遵守这个【从下到上】的 z-index 和位置规划:

```
屏幕底部 → 顶部:

[0px - 60px]      底部 nav (PWA: EN POJU Glyph Syncro Match A)
                   z-index: 100
                   position: fixed

[60px - 110px]    Mode switcher (Compass | AR | Map)
                   bottom: 75px
                   z-index: 9

[110px - 160px]   Why this current 按钮
                   bottom: 130px
                   z-index: 8

[160px - 屏幕中]   同心圆系统(320-360px)
                   居中
                   z-index: 1

[屏幕顶部 - 60px] 时辰流式进度条
                   top: 跟随状态栏

[顶部 - 100px]    手机姿势提示("Hold flat" / "Hold upright")
                   top: 100px(时辰条下方)
                   z-index: 5
```

按这个布局,所有元素都不会重叠。

---

# 总结

```
本任务完成后:

✅ Part 1 (P0): 12 时辰 LLM 数据验证 + 修复(去除假数据)
✅ Part 2 (P0): Compass 三层同心圆 + 整体旋转
✅ Part 3 (P1): AR 圆形视窗 + 光韵边框(随 Current 变色)
✅ Part 4 (P1): MAP 放大 + 风格统一
✅ Part 5 (P1): 模式切换按钮缩小
✅ Part 6 (P1): 布局空间规划(避免遮挡)

新设计的核心:
  - 三模式【共享同心圆骨架】
  - 区别仅在【中心层】
    Compass:文字
    AR:圆形摄像头视窗 + 光韵
    MAP:8 点 + 文字
  - 视觉体验高度一致,切换流畅
  - 整体随手机旋转(Compass / AR),MAP 静态

技术要点:
  - 父容器 rotate(-alpha) 实现整体旋转
  - 中心信息独立层,不参与旋转
  - 光韵用 box-shadow(border + glow)
  - 切换 Current 等级时光韵平滑过渡
```

---

**Cursor 务必:严格按 Part 1 → Part 6 顺序实施。
Part 1(12 时辰数据验证)是 P0,必须先做!
不修复这个,后面的视觉再美也是空中楼阁。**
