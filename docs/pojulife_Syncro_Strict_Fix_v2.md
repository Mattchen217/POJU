# Syncro 核心功能强制修复 v2

> ⛔ **上一次失败的原因**:
> Cursor 把【次要视觉调整】当成首要任务,
> 反而忽略了 P0 核心功能(罗盘权限、旋转、12 时辰真数据)。
> 
> 🚨 **本次必须严格按以下规则执行**:
> 1. Part 1-4 是 P0,必须完成才能继续
> 2. 每个 Part 完成后【必须真机测试】并贴日志
> 3. 不允许跳到视觉调整(Part 5+)
> 4. 不允许声称"已实现"而没测试

---

# ⛔ Cursor 必读 - 严重警告

```
上次你做的:
  ✗ 改了一堆 CSS 让界面"看起来不一样"
  ✗ 但罗盘还是不能转(没修)
  ✗ 12 时辰还是只看到几个(没修)
  ✗ 权限弹窗还是没出现(没修)
  ✗ 提示文字挤压布局(没修)

这次的强制要求:

第一原则:
  核心功能 > 视觉细节
  能转的丑罗盘 >>> 不能转的美罗盘

第二原则:
  每个 Part 完成后,必须:
  - 在【真实手机】上测试(不是浏览器)
  - 截图证明功能能用
  - 贴 console 日志
  - 否则视为未完成

第三原则:
  Part 1(罗盘权限)失败 → 整个 Syncro 失败
  Part 4(12 时辰真数据)失败 → 整个 Syncro 是空架子
  这两个不修好,后面别做
```

---

# 🚨 第 1 部分(P0):罗盘权限申请 + 整体旋转

## 问题诊断

```
你之前没修好的根因(我猜):

可能 1:权限弹出代码没在【user gesture 内】调用
  iOS 13+ 要求 DeviceOrientationEvent.requestPermission()
  必须在用户点击事件回调中调用,否则 Apple 直接拒绝

可能 2:监听了 deviceorientation 但没用 alpha 旋转 UI

可能 3:旋转应用错了对象
  ✗ 错:只旋转粒子文件(粒子文件本身不支持)
  ✓ 对:旋转包含"方位符 + 粒子"的【父容器】

可能 4:旋转方向反了(用了 alpha 而不是 -alpha)
```

## Step 1.1: 罗盘权限 Hook(用户点击触发)

文件:`lib/syncro/useCompassPermission.ts`(新建,如已有则替换)

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';

interface CompassState {
  granted: boolean;
  supported: boolean;
  alpha: number;  // 0-360,北方为 0
  beta: number;   // -180 to 180,平放约 0,竖立约 90
  gamma: number;  // -90 to 90
  needsUserGesture: boolean;  // iOS 需要点按钮才能弹权限
}

export function useCompassPermission() {
  const [state, setState] = useState<CompassState>({
    granted: false,
    supported: false,
    alpha: 0,
    beta: 0,
    gamma: 0,
    needsUserGesture: false
  });
  
  // 检测是否支持
  useEffect(() => {
    const supported = typeof DeviceOrientationEvent !== 'undefined';
    const needsGesture = 
      typeof (DeviceOrientationEvent as any).requestPermission === 'function';
    
    setState(s => ({
      ...s,
      supported,
      needsUserGesture: needsGesture
    }));
    
    // 检查 localStorage 是否之前授权过
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem('pj_compass_granted');
      if (cached === '1') {
        // 之前已经授权,直接监听(部分浏览器仍可工作)
        attachListener();
      }
    }
  }, []);
  
  // ⚠️ 必须在 user gesture 中调用
  const requestPermission = useCallback(async (): Promise<boolean> => {
    console.log('[Compass] requestPermission called');
    
    // iOS 13+
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const result = await (DeviceOrientationEvent as any).requestPermission();
        console.log('[Compass] iOS permission result:', result);
        
        if (result === 'granted') {
          setState(s => ({ ...s, granted: true }));
          localStorage.setItem('pj_compass_granted', '1');
          attachListener();
          return true;
        }
        return false;
      } catch (e) {
        console.error('[Compass] iOS permission error:', e);
        return false;
      }
    }
    
    // Android / 其他:直接监听
    setState(s => ({ ...s, granted: true }));
    localStorage.setItem('pj_compass_granted', '1');
    attachListener();
    return true;
  }, []);
  
  function attachListener() {
    const handler = (e: DeviceOrientationEvent) => {
      // iOS Safari 用 webkitCompassHeading(已校准过的真北角度)
      // 其他:用 alpha(需要自己处理)
      const alpha = (e as any).webkitCompassHeading !== undefined
        ? (e as any).webkitCompassHeading
        : (360 - (e.alpha || 0)) % 360;
      
      setState(s => ({
        ...s,
        alpha,
        beta: e.beta || 0,
        gamma: e.gamma || 0
      }));
    };
    
    window.addEventListener('deviceorientation', handler);
    
    // 返回清理函数(但因为我们在 hook 外调,简化处理)
    (window as any)._compassHandler = handler;
  }
  
  return { ...state, requestPermission };
}
```

## Step 1.2: Syncro 入口的权限请求 UI

文件:`components/syncro/SyncroPermissionGate.tsx`(新建)

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCompassPermission } from '@/lib/syncro/useCompassPermission';

interface Props {
  onGranted: () => void;
  onSkip?: () => void;  // 用户拒绝时也允许进入(但功能受限)
}

export function SyncroPermissionGate({ onGranted, onSkip }: Props) {
  const t = useTranslations('syncro.permission');
  const { requestPermission, granted, supported } = useCompassPermission();
  const [requesting, setRequesting] = useState(false);
  
  async function handleEnable() {
    setRequesting(true);
    const ok = await requestPermission();
    setRequesting(false);
    
    if (ok) {
      onGranted();
    } else {
      // 用户拒绝了,提示
      alert(t('denied_alert'));
    }
  }
  
  if (granted) {
    onGranted();
    return null;
  }
  
  return (
    <div className="permission-gate">
      <div className="permission-icon">
        <i className="ti ti-compass" />
      </div>
      
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      
      <button 
        className="permission-btn-primary"
        onClick={handleEnable}
        disabled={requesting}
      >
        {requesting ? t('requesting') : t('enable')}
      </button>
      
      {onSkip && (
        <button className="permission-btn-skip" onClick={onSkip}>
          {t('skip')}
        </button>
      )}
    </div>
  );
}
```

## Step 1.3: 集成到 Syncro 主页面

文件:`components/syncro/SyncroMainView.tsx`(修改)

```tsx
export function SyncroMainView({ data }: { data: any }) {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const { alpha, beta, granted } = useCompassPermission();
  const [mode, setMode] = useState<'compass' | 'ar' | 'map'>('compass');
  
  // 如果之前授权过,自动跳过权限页
  useEffect(() => {
    if (granted) setPermissionGranted(true);
  }, [granted]);
  
  // ⭐ 首次进入,显示权限请求
  if (!permissionGranted) {
    return (
      <SyncroPermissionGate 
        onGranted={() => setPermissionGranted(true)}
        onSkip={() => setPermissionGranted(true)}  // 允许跳过,但旋转功能不可用
      />
    );
  }
  
  return (
    <div className="syncro-main">
      <HourProgressBar ... />
      
      <div className="syncro-display">
        {mode === 'compass' && (
          <SyncroCompassMode
            matrix={data.matrix}
            activeHour={activeHour}
            alpha={alpha}   // ⭐ 传递实时方位
            beta={beta}     // ⭐ 传递姿态
          />
        )}
        {mode === 'ar' && <SyncroARMode alpha={alpha} beta={beta} ... />}
        {mode === 'map' && <SyncroMapMode ... />}
      </div>
      
      <ThreeModeToggle mode={mode} onChange={setMode} />
    </div>
  );
}
```

## Step 1.4: 整体旋转实施(关键!)

文件:`components/syncro/SyncroCompassMode.tsx`(修改 - 旋转父容器)

```tsx
export function SyncroCompassMode({ alpha, beta, matrix, activeHour }: Props) {
  return (
    <div className="compass-mode">
      {/* 姿态浮层(Part 2 会做) */}
      <PostureHintOverlay mode="compass" beta={beta} />
      
      {/* ⭐ 三层同心圆 + 整体旋转 */}
      <div className="concentric-system">
        
        {/* === 关键:这一层旋转 === */}
        <div 
          className="rotating-layer"
          style={{
            transform: `rotate(${-alpha}deg)`,
            transition: 'transform 200ms cubic-bezier(0.2, 0, 0.2, 1)'
          }}
        >
          {/* 粒子动效在旋转层内 */}
          <div className="particle-layer">
            <SyncroParticleCore />
          </div>
          
          {/* 方位符也在旋转层内 */}
          <DirectionRingLabels />
        </div>
        
        {/* === 中心层不旋转 === */}
        <div className="center-static-layer">
          <CurrentDisplay cell={...} />
        </div>
        
      </div>
      
      {/* Why this current 浮在最下方 */}
      <WhyThisCurrentButton />
    </div>
  );
}
```

## Step 1.5: 翻译

文件:`messages/en/syncro.json`(扩展)

```json
{
  "syncro": {
    "permission": {
      "title": "Enable Compass",
      "description": "Syncro needs your device's compass to show directions accurately as you move.",
      "enable": "Enable Compass",
      "requesting": "Requesting...",
      "skip": "Continue without compass",
      "denied_alert": "Compass permission was denied. The compass won't rotate, but other features still work."
    }
  }
}
```

文件:`messages/zh/syncro.json`

```json
{
  "syncro": {
    "permission": {
      "title": "开启罗盘",
      "description": "Syncro 需要使用设备罗盘,让方位显示能跟随你的移动准确变化。",
      "enable": "开启罗盘",
      "requesting": "请求中...",
      "skip": "暂不开启",
      "denied_alert": "罗盘权限被拒绝。罗盘不会旋转,但其他功能仍可使用。"
    }
  }
}
```

## ✅ Part 1 真机验证清单(必做)

```
不是在浏览器看,是在【真实手机】上!

iPhone (iOS Safari):
□ 进入 Syncro → 弹出"开启罗盘"页
□ 点击"开启罗盘" → iOS 弹出系统权限对话框
  (如果没弹 → requestPermission 没在 user gesture 内调用,要修)
□ 同意后 → 进入 Compass 模式
□ 转动身体(身体面向不同方向)
□ 方位符 N S E W 跟着转
□ 粒子动效跟着转(因为在同一旋转层)
□ 中心 Current 文字不转,保持水平
□ N 始终指向真北

Android Chrome:
□ 进入 Syncro → 自动开启(不需要权限弹窗)
□ 转动身体 → 同样跟着转

⛔ 如果方位符不跟随手机转,这步就没完成
   不要进入 Part 2!
   先把这个修好

🛑 等用户明确说"通过 Part 1" 才进入 Part 2
```

---

# 🚨 第 2 部分(P0):姿态浮层 - 不再挤压布局

## 问题描述

```
你上次做的:
  把"请将手机平放"提示放在【时辰条下方】
  占据了大量空间
  挤压了背景动效、方位符、内容
  导致所有元素被压成很小

正确做法(用户已经说清楚了):
  - 提示做成【浮层】(absolute / fixed)
  - 居中显示
  - 监测手机姿态(beta 角度)
  - 平放(Compass)/竖立(AR)→ 浮层自动淡出消失
  - 没满足姿态 → 浮层显示在中心最前方
```

## Step 2.1: PostureHintOverlay 组件

文件:`components/syncro/PostureHintOverlay.tsx`(新建)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  mode: 'compass' | 'ar';
  beta: number;  // 来自 useCompassPermission
}

export function PostureHintOverlay({ mode, beta }: Props) {
  const t = useTranslations('syncro.posture');
  
  // 判断姿态是否符合
  const isPostureCorrect = checkPosture(mode, beta);
  
  // 用 timeout 让浮层淡出有延迟,避免抖动
  const [showHint, setShowHint] = useState(true);
  
  useEffect(() => {
    if (isPostureCorrect) {
      // 姿态对了,500ms 后淡出
      const t = setTimeout(() => setShowHint(false), 500);
      return () => clearTimeout(t);
    } else {
      // 姿态不对,立即显示
      setShowHint(true);
    }
  }, [isPostureCorrect]);
  
  if (!showHint) return null;
  
  const iconRotation = mode === 'compass' ? 90 : 0;
  const iconName = mode === 'compass' ? 'ti-device-mobile' : 'ti-device-mobile';
  
  return (
    <div className={`posture-overlay ${isPostureCorrect ? 'fading-out' : 'showing'}`}>
      <div className="posture-content">
        <div className="posture-icon" style={{ transform: `rotate(${iconRotation}deg)` }}>
          <i className={`ti ${iconName}`} />
        </div>
        
        <h3 className="posture-title">
          {mode === 'compass' ? t('hold_flat_title') : t('hold_upright_title')}
        </h3>
        
        <p className="posture-desc">
          {mode === 'compass' ? t('hold_flat_desc') : t('hold_upright_desc')}
        </p>
      </div>
    </div>
  );
}

function checkPosture(mode: 'compass' | 'ar', beta: number): boolean {
  // beta 范围:-180 to 180
  // beta ≈ 0 → 屏幕水平朝上(平放,即 Compass 模式需要的)
  // beta ≈ 90 → 屏幕垂直面向用户(竖立,AR 模式需要)
  // beta ≈ ±180 → 屏幕朝下
  
  if (mode === 'compass') {
    // Compass:平放,容差 ±30 度
    return Math.abs(beta) < 30;
  } else {
    // AR:竖立(60-120 度,即倾斜 60-120 度)
    return beta > 50 && beta < 130;
  }
}
```

## Step 2.2: 浮层样式(覆盖中心,不挤压布局)

文件:`styles/syncro-posture.css`(新建)

```css
.posture-overlay {
  /* ⭐ 关键:绝对定位浮层,不占据 layout 空间 */
  position: absolute;
  inset: 0;
  z-index: 50;  /* 在所有内容之上 */
  
  display: flex;
  align-items: center;
  justify-content: center;
  
  /* 半透明遮罩 */
  background: rgba(7, 9, 26, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  
  /* 不阻挡下层交互(但内容部分会拦截) */
  pointer-events: auto;
  
  /* 默认显示动画 */
  opacity: 1;
  transition: opacity 400ms ease, backdrop-filter 400ms ease;
}

.posture-overlay.showing {
  opacity: 1;
}

.posture-overlay.fading-out {
  opacity: 0;
  pointer-events: none;
  /* 父组件会在淡出动画结束后 unmount */
}

.posture-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 32px 28px;
  text-align: center;
  max-width: 280px;
}

.posture-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(212, 165, 116, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--pj-gold);
  transition: transform 800ms cubic-bezier(0.2, 0, 0.2, 1);
  
  /* 微妙的呼吸动效 */
  animation: posture-breathe 2s infinite ease-in-out;
}

.posture-icon i {
  font-size: 30px;
}

@keyframes posture-breathe {
  0%, 100% { 
    transform: scale(1);
    background: rgba(212, 165, 116, 0.15);
  }
  50% { 
    transform: scale(1.08);
    background: rgba(212, 165, 116, 0.25);
  }
}

.posture-title {
  font-size: 17px;
  font-weight: var(--pj-weight-medium);
  color: var(--pj-text-primary);
  margin: 0;
  letter-spacing: -0.2px;
}

.posture-desc {
  font-size: 13px;
  color: var(--pj-text-tertiary);
  line-height: var(--pj-leading-relaxed);
  margin: 0;
}
```

## Step 2.3: 翻译

```json
// EN
{
  "syncro": {
    "posture": {
      "hold_flat_title": "Hold phone flat",
      "hold_flat_desc": "Place your phone face-up, parallel to the ground",
      "hold_upright_title": "Hold phone upright",
      "hold_upright_desc": "Hold your phone vertically, facing forward"
    }
  }
}

// ZH
{
  "syncro": {
    "posture": {
      "hold_flat_title": "请将手机平放",
      "hold_flat_desc": "手机屏幕朝上,与地面平行",
      "hold_upright_title": "请竖立手机",
      "hold_upright_desc": "手机垂直竖起,正面朝向你"
    }
  }
}
```

## ✅ Part 2 真机验证清单

```
iPhone:
□ 进入 Compass:浮层覆盖中心,显示"请将手机平放"
□ 手机平放后:浮层 0.5 秒淡出消失
□ 视图露出完整(粒子 + 方位符占满中心)
□ 手机倾斜起来:浮层重新出现

□ 切换到 AR:浮层"请竖立手机"
□ 手机竖起后:浮层淡出
□ 摄像头视窗可见

⛔ 关键验证:浮层【不挤压】layout
   即使浮层在显示,粒子动效和方位符的尺寸也不变
   只是被半透明蒙层盖住

🛑 等用户确认进入 Part 3
```

---

# 🚨 第 3 部分(P0):粒子 + 方位符占满屏幕

## 问题描述

```
当前:粒子动效太小(220px),方位符圈也小,内容挤在一起
应该:粒子 + 方位符整体【占满手机屏幕中心】
     其他元素(时辰条/Why按钮/模式切换)做小,让位置

用户原话:
"粒子效果和方位符必须要整体的最大显示
 其他的元素都可以小伙放到别的地方去"
```

## Step 3.1: 容器尺寸大幅提升

文件:`styles/syncro-compass.css`(修改)

```css
/* === 主容器:占满屏幕中心 === */
.compass-mode,
.ar-mode,
.map-mode {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* === 同心圆系统:大幅放大 === */
.concentric-system {
  position: relative;
  /* ⭐ 用 vmin 让容器铺满较短边 */
  width: min(85vmin, 500px);
  height: min(85vmin, 500px);
  /* 之前 320px,现在 85% 屏幕短边 */
}

/* === 粒子层:占容器的 75% === */
.particle-layer {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 75%;
  height: 75%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

/* === 方位符:在容器最外圈 === */
.direction-ring {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.direction-label {
  position: absolute;
  top: 50%;
  left: 50%;
  font-size: 14px;   /* ⭐ 稍大 */
  font-weight: var(--pj-weight-medium);
  letter-spacing: 1.5px;
  color: var(--pj-text-secondary);
  /* 位置由 JS 计算,见下 */
}

/* === 中心信息:固定中央 === */
.center-static-layer {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 35%;
  text-align: center;
  z-index: 5;
  pointer-events: none;
}
```

## Step 3.2: 方位符精准定位

```tsx
function DirectionRingLabels() {
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
    <div className="direction-ring">
      {directions.map(dir => {
        // 在容器外缘 95% 处放置
        // CSS rotate 中 0° 是右侧(东),需要 -90° 让 N 指上
        const rad = ((dir.angle - 90) * Math.PI) / 180;
        const radius = 47;  // 47% (容器半径 50% 内 3%)
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        
        return (
          <div
            key={dir.id}
            className="direction-label"
            style={{
              transform: `translate(calc(-50% + ${x}%), calc(-50% + ${y}%))`
            }}
          >
            {dir.id}
          </div>
        );
      })}
    </div>
  );
}
```

## Step 3.3: 其他元素让位置

```css
/* === 时辰条:顶部薄,不占主视觉 === */
.hour-progress-bar {
  position: absolute;
  top: env(safe-area-inset-top, 0);
  left: 0;
  right: 0;
  padding: 14px 16px 8px;
  z-index: 10;
  /* 透明背景,不挡视觉 */
  background: linear-gradient(to bottom, 
    rgba(7, 9, 26, 0.9), 
    rgba(7, 9, 26, 0)
  );
}

/* === Why this current 按钮:小药丸,贴近底部 === */
.compass-bottom-cta {
  position: absolute;
  bottom: 130px;  /* 留出模式切换 + 底部 nav 空间 */
  left: 50%;
  transform: translateX(-50%);
  z-index: 8;
}

.why-btn-prominent {
  padding: 8px 16px;  /* ⭐ 小一点 */
  font-size: 11px;
  /* ... 其他样式不变 */
}

/* === 模式切换:更小 === */
.three-mode-toggle {
  position: absolute;
  bottom: 78px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
  padding: 3px;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(20px);
  border-radius: 14px;
  z-index: 9;
}

.mode-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;       /* ⭐ 更小 */
  font-size: 10px;
  font-weight: var(--pj-weight-medium);
  letter-spacing: 0.3px;
  border-radius: 11px;
  color: var(--pj-text-muted);
  background: transparent;
  cursor: pointer;
  border: none;
  font-family: inherit;
}

.mode-tab i {
  font-size: 12px;
}

.mode-tab.active {
  background: rgba(212, 165, 116, 0.15);
  color: var(--pj-gold);
}
```

## ✅ Part 3 真机验证清单

```
iPhone:
□ 粒子动效尺寸:占屏幕 65-75% (大!)
□ 方位符 N S E W:在屏幕最外圈
  - 不被截断
  - 各方位字符之间距离均匀
□ 中心 Current 信息:在粒子中央,清晰可见
□ 时辰条:顶部薄,半透明背景
□ Why this current:底部小药丸
□ 三模式切换:底部小药丸(高度 < 28px)

⛔ 关键验证:粒子和方位符是【最大】的视觉元素
   占据屏幕中心 60% 以上
   其他元素都做小、做边缘

🛑 等用户确认进入 Part 4
```

---

# 🚨 第 4 部分(P0):12 时辰真实数据 + 顺序点亮

## 问题描述

```
用户报告:
  "12 时辰渲染像是随机出现,不是按顺序"
  "等了很久也没等到全部 12 个亮起"
  "只有几个绿灯亮,其他一直灰色"
  
两个问题:
  1. 渲染顺序乱(因为 6 个 batch 并行,完成时间不同)
  2. 有些 batch 可能根本没成功 → 永远是灰
```

## Step 4.1: 诊断 - 加日志

文件:`components/syncro/SyncroResultLoader.tsx`(加日志)

```typescript
async function loadAllBatches() {
  const HOUR_ORDER = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 
                      'wu', 'wei', 'shen', 'you', 'xu', 'hai'];
  
  console.log('[Syncro] 开始加载 12 时辰数据');
  console.log('[Syncro] 当前 matrix 总 cell 数:', Object.keys(initialData.matrix).length);
  
  // 按时辰分组 keys
  const keysByHour: Record<string, string[]> = {};
  for (const key of Object.keys(initialData.matrix)) {
    const [hour] = key.split('__');
    if (!keysByHour[hour]) keysByHour[hour] = [];
    keysByHour[hour].push(key);
  }
  
  console.log('[Syncro] 按时辰分组:');
  for (const hour of HOUR_ORDER) {
    console.log(`  ${hour}: ${(keysByHour[hour] || []).length} cells`);
  }
  
  // ⭐ 按【时辰索引】发起,每时辰一个 batch
  const promises = HOUR_ORDER.map((hourId, idx) => {
    const cells = keysByHour[hourId] || [];
    if (cells.length === 0) {
      console.warn(`[Syncro] ⚠️ ${hourId} 时辰没有 cells!`);
      return Promise.resolve();
    }
    return loadHourBatch(hourId, idx, cells);
  });
  
  await Promise.allSettled(promises);
  console.log('[Syncro] 所有 batch 完成');
}

async function loadHourBatch(hourId: string, hourIdx: number, cellKeys: string[]) {
  console.log(`[Syncro] [${hourIdx + 1}/12] ${hourId} 时辰开始 LLM 调用,cells:${cellKeys.length}`);
  
  const startTime = Date.now();
  
  try {
    const matrix_slice: Record<string, any> = {};
    for (const key of cellKeys) {
      matrix_slice[key] = initialData.matrix[key];
    }
    
    const response = await fetch('/api/syncro/llm_batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: initialData.session_id,
        batch_index: hourIdx,
        hour_id: hourId,  // ⭐ 加 hour_id,方便后端识别
        matrix_slice,
        profile_summary: initialData.profile_summary,
        task_description: initialData.task_description,
        locale
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Syncro] ❌ ${hourId} 时辰 batch 失败:`, response.status, errText);
      
      // ⭐ 重要:标记该时辰为失败状态(不是 pending)
      setMatrix((prev: any) => {
        const next = { ...prev };
        for (const key of cellKeys) {
          next[key] = { ...next[key], llm_failed: true };
        }
        return next;
      });
      return;
    }
    
    const data = await response.json();
    const elapsed = Date.now() - startTime;
    console.log(`[Syncro] ✅ ${hourId} 时辰完成,耗时 ${elapsed}ms,cells:${Object.keys(data.advice).length}`);
    
    // 合并到 matrix
    setMatrix((prev: any) => {
      const next = { ...prev };
      for (const key of Object.keys(data.advice)) {
        if (next[key]) {
          next[key] = {
            ...next[key],
            short_advice: data.advice[key].short_advice,
            detailed_advice: data.advice[key].detailed_advice,
            rationale: data.advice[key].rationale,
            llm_pending: false,
            llm_completed_at: Date.now()
          };
        }
      }
      return next;
    });
    
  } catch (e: any) {
    console.error(`[Syncro] ❌ ${hourId} 时辰异常:`, e);
    setMatrix((prev: any) => {
      const next = { ...prev };
      for (const key of cellKeys) {
        next[key] = { ...next[key], llm_failed: true, error: e.message };
      }
      return next;
    });
  }
}
```

## Step 4.2: 12 时辰按顺序点亮(关键!)

文件:`components/syncro/HourProgressBar.tsx`(修改)

```tsx
const HOUR_ORDER = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 
                    'wu', 'wei', 'shen', 'you', 'xu', 'hai'];

function getHourStatus(
  hourId: string, 
  hourIdxInOrder: number,
  currentHourId: string,
  matrix: any
): 'now' | 'done' | 'pending' | 'failed' {
  
  // 当前时辰永远是 now(无论 LLM 是否完成)
  if (hourId === currentHourId) return 'now';
  
  // 检查该时辰是否完成
  const cells = Object.keys(matrix).filter(k => k.startsWith(`${hourId}__`));
  if (cells.length === 0) return 'pending';
  
  const allFailed = cells.every(k => matrix[k]?.llm_failed);
  if (allFailed) return 'failed';
  
  const allDone = cells.every(k => 
    matrix[k] && !matrix[k].llm_pending && !matrix[k].llm_failed
  );
  if (!allDone) return 'pending';
  
  // ⭐ 关键:检查前面所有时辰是否都完成
  // 这样保证【顺序点亮】(即使后面的先完成,也要等前面的)
  const currentIdx = HOUR_ORDER.indexOf(currentHourId);
  const sortedOrder = [
    ...HOUR_ORDER.slice(currentIdx + 1),
    ...HOUR_ORDER.slice(0, currentIdx)
  ];
  
  const myPos = sortedOrder.indexOf(hourId);
  
  // 检查 myPos 之前所有时辰是否都已 done
  for (let i = 0; i < myPos; i++) {
    const prevHourId = sortedOrder[i];
    const prevCells = Object.keys(matrix).filter(k => k.startsWith(`${prevHourId}__`));
    if (prevCells.length === 0) continue;
    
    const prevAllDone = prevCells.every(k => 
      matrix[k] && !matrix[k].llm_pending
    );
    if (!prevAllDone) return 'pending';  // 前面有没完成的,本时辰也保持 pending
  }
  
  return 'done';
}

// 渲染
export function HourProgressBar({ matrix, currentHourId, selectedHourId, onSelect }: Props) {
  const currentIdx = HOUR_ORDER.indexOf(currentHourId);
  const sortedPeriods = [
    ...HOUR_ORDER.slice(currentIdx),
    ...HOUR_ORDER.slice(0, currentIdx)
  ].map((id, idx) => ({ id, idx, ...getHourMeta(id) }));
  
  // 滚动到当前时辰
  const currentRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        inline: 'center', 
        block: 'nearest' 
      });
    }
  }, [currentHourId]);
  
  return (
    <div className="hour-progress-bar">
      <div className="hour-track">
        <div className="hour-line" />
        {sortedPeriods.map(period => {
          const status = getHourStatus(period.id, period.idx, currentHourId, matrix);
          const isSelected = period.id === selectedHourId;
          const canClick = status === 'done' || status === 'now';
          
          return (
            <button
              key={period.id}
              ref={period.id === currentHourId ? currentRef : undefined}
              className={`hour-dot status-${status} ${isSelected ? 'selected' : ''}`}
              onClick={() => canClick && onSelect(period.id)}
              disabled={!canClick}
              aria-label={`${period.name} ${period.range}`}
            >
              {/* 显示时辰名(可选)*/}
              <span className="hour-dot-label">{period.name}</span>
            </button>
          );
        })}
      </div>
      
      {/* 显示当前选中时辰信息 */}
      <div className="hour-display">
        ...
      </div>
    </div>
  );
}
```

## Step 4.3: 时辰圆点【增大 + 单行横向滚动】

```css
.hour-progress-bar {
  padding: 14px 0 8px;
}

.hour-track {
  position: relative;
  display: flex;
  align-items: center;
  gap: 24px;        /* ⭐ 间距增大 */
  
  /* ⭐ 单行 + 横向滚动 */
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  
  /* 左右内 padding,让首尾能滚到中心 */
  padding: 0 calc(50vw - 12px);
  scrollbar-width: none;  /* 隐藏滚动条 */
}

.hour-track::-webkit-scrollbar {
  display: none;
}

.hour-line {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 0.5px;
  background: rgba(255, 255, 255, 0.06);
  z-index: 0;
}

.hour-dot {
  position: relative;
  z-index: 2;
  width: 14px;        /* ⭐ 增大,方便点击 */
  height: 14px;
  border-radius: 50%;
  background: var(--pj-text-disabled);
  cursor: pointer;
  flex-shrink: 0;
  scroll-snap-align: center;
  border: none;
  padding: 0;
  transition: all var(--pj-duration-fast);
}

/* 4 状态颜色 */
.hour-dot.status-now {
  width: 22px;        /* ⭐ 当前时辰特别大 */
  height: 22px;
  background: var(--pj-gold);
  box-shadow: 0 0 20px var(--pj-gold-glow);
}

.hour-dot.status-done {
  background: #4ECDC4;  /* 青绿 */
  box-shadow: 0 0 6px rgba(78, 205, 196, 0.4);
}

.hour-dot.status-pending {
  background: var(--pj-text-disabled);
  cursor: not-allowed;
  opacity: 0.5;
}

.hour-dot.status-failed {
  background: var(--pj-under);
  opacity: 0.6;
}

.hour-dot.selected:not(.status-now) {
  outline: 2px solid var(--pj-gold);
  outline-offset: 4px;
}

/* 时辰名标签(在 dot 下方,小字)*/
.hour-dot-label {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: var(--pj-text-tertiary);
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.hour-dot.status-now .hour-dot-label {
  top: 28px;  /* now 时辰更大,标签下移 */
  color: var(--pj-gold);
}
```

## ✅ Part 4 真机验证清单(最关键!)

```
□ 跑一次完整 Syncro 流程
□ 看 console.log:
  - "[Syncro] 开始加载 12 时辰数据"
  - "[Syncro] 按时辰分组:" 12 个时辰每个都有 8 cells
  - "[Syncro] [1/12] zi 时辰开始 LLM 调用"
  - "[Syncro] ✅ zi 时辰完成,耗时 XXXms,cells:8"
  - "[Syncro] [2/12] chou 时辰开始..."
  - ... 直到 12 个都完成 ✅ 或 ❌

□ UI 上观察:
  - 时辰圆点变大(14-22px,可点击)
  - 单行横向滚动
  - 当前时辰自动滚到中心
  - 绿色点【按顺序】从当前往后亮起
  - 即使后面时辰先完成,也要等前面亮了才亮
  
□ 验证真实性:
  - 至少要看到 8-10 个绿色亮起(80%+ 时辰成功)
  - 如果只有 1-3 个亮 → 后端有 bug,需要进一步排查

□ 点击绿色时辰 → 中心显示该时辰的真实数据
  - 不同时辰显示不同内容
  - 不是同一份数据

⛔ 如果 console 显示有 batch 失败:
   贴出失败的错误信息
   修复后再测
   不要进入 Part 5!
```

---

# 🟡 第 5 部分(P1):AR/MAP 同样占满屏幕

```
应用 Part 3 的规则到 AR 和 MAP 模式:

AR 模式:
  - 同心圆系统跟 Compass 一样大(85vmin)
  - 中心圆形摄像头视窗:占容器 35% (约 30vmin)
  - 光韵边框颜色随 Current 等级
  - 浮层"竖立手机"(姿态对了自动消失)

MAP 模式:
  - 同心圆系统更大(90vmin)
  - 中心点缩小到 12px(用户反馈太大)
  - 中心信息卡可见

不展开代码 - 用 Part 3 的样式套到 AR 和 MAP
关键:三模式共享 .concentric-system 类
区别只在中心层
```

```css
/* MAP 模式微调 */
.map-mode .concentric-system {
  width: min(90vmin, 540px);
  height: min(90vmin, 540px);
}

/* MAP 方位点缩小 */
.map-mode .map-point {
  width: 12px;      /* ⭐ 之前 18px,现在 12px */
  height: 12px;
}

.map-mode .map-point.active {
  width: 16px;
  height: 16px;
}
```

✅ Part 5 验证:
```
□ AR 模式:同心圆同样大,中心摄像头视窗清晰
□ MAP 模式:更大,8 个方位点缩小,但可点击
□ 三模式视觉一致
```

---

# 🟢 第 6 部分:Syncro 入口改造 + 任务输入文案

## 6.1: 历史记录位置改

```
当前:进入 Syncro 后看到历史记录
应该:在 Syncro 入口的【Begin 按钮下方】显示历史记录列表
     用户能直接点已有记录(不用先付费)
```

文件:`app/[locale]/syncro/page.tsx`(修改 Syncro 入口)

```tsx
export default function SyncroEntryPage() {
  return (
    <div className="syncro-entry">
      <Hero ... />  {/* 现有 Hero 区,复用 */}
      
      <BeginButton 
        productId="syncro"
        price="$4.99"
        freeFirstTime={true}
      />
      
      {/* ⭐ 在 Begin 按钮下方显示历史记录 */}
      <HistorySection productId="syncro" />
    </div>
  );
}
```

```tsx
function HistorySection({ productId }: { productId: string }) {
  const [sessions, setSessions] = useState([]);
  
  useEffect(() => {
    loadActiveSessions(productId).then(setSessions);
  }, [productId]);
  
  if (sessions.length === 0) return null;
  
  return (
    <div className="history-section">
      <div className="history-label">Recent readings</div>
      {sessions.map(session => (
        <HistoryCard 
          key={session.session_id}
          session={session}
          onClick={() => router.push(`/${locale}/syncro/result/${session.session_id}`)}
        />
      ))}
    </div>
  );
}
```

## 6.2: 任务输入提示文案

文件:`components/syncro/SyncroTaskInput.tsx`(修改)

```tsx
// ❌ 删除:
// "明天下午我要去见客户"
// "明天上午..."
// "这周要干嘛..."

// ✅ 改成:
const t = useTranslations('syncro.task');

return (
  <div className="task-input-section">
    <label>{t('label')}</label>
    
    <textarea 
      placeholder={t('placeholder')}
      ...
    />
    
    <p className="task-hint">{t('hint')}</p>
  </div>
);
```

翻译:
```json
// EN
{
  "syncro": {
    "task": {
      "label": "What do you want to do?",
      "placeholder": "Enter one thing you need to do (e.g., a meeting, a decision, an outreach)",
      "hint": "Syncro shows the best timing and direction within the next 24 hours."
    }
  }
}

// ZH
{
  "syncro": {
    "task": {
      "label": "你要做什么?",
      "placeholder": "输入一件你要做的事(如:会议、决定、对外接触)",
      "hint": "Syncro 会告诉你未来 24 小时内,做这件事的最佳时机和方位。"
    }
  }
}
```

✅ 验证:
```
□ 历史记录显示在 Begin 按钮下方,不需要付费就能看
□ 点击历史记录直接打开(不会再次扣费)
□ 任务输入提示改成"输入一件要做的事"
□ 不再提"明天/这周/几天后"
```

---

# 🟢 第 7 部分:PWA 登录页 Hero + What we built

## 7.1: PWA 中 Hero 顶满(PC 不变)

```css
/* PWA 模式下,marketing 页面顶到最上面 */

.pwa-mode .marketing-header,
.pwa-mode .marketing-footer {
  display: none !important;
}

.pwa-mode .marketing-page {
  padding-top: env(safe-area-inset-top, 0) !important;
  margin-top: 0 !important;
}

.pwa-mode .hero-section {
  padding-top: 0 !important;
  margin-top: 0 !important;
}

/* PC / 普通浏览器保持原样 */
/* (不加 .pwa-mode 前缀的样式不会受影响)*/
```

## 7.2: What we built 文字遮挡修复

```
让 Cursor 检查:

1. 该模块的 CSS 是否有 overflow: hidden
2. 是否有 fixed height
3. 是否有 text-overflow: ellipsis
4. 移动端 media query 字号是否过大

修复(可能):
.what-we-built-section {
  overflow: visible !important;
  height: auto !important;
}

.what-we-built-section .text-block {
  overflow: visible;
  text-overflow: unset;
  white-space: normal;
  font-size: 14px;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .what-we-built-section .text-block {
    font-size: 13px;
  }
}
```

✅ 验证:
```
□ PWA 中 Hero 区顶到屏幕最上(无空白)
□ PC 网页保持原样
□ What we built 模块文字完整显示,不被遮挡
```

---

# 总结

```
本任务必须按【严格优先级】执行:

🚨 P0 (必须先做,不修好不能继续):
  Part 1: 罗盘权限 + 整体旋转
  Part 2: 姿态浮层(不挤压布局)
  Part 3: 粒子+方位符占满屏幕
  Part 4: 12 时辰真数据 + 顺序点亮

🟡 P1 (P0 完成后):
  Part 5: AR/MAP 同样占满

🟢 P2 (最后):
  Part 6: Syncro 入口 + 任务文案
  Part 7: PWA Hero + What we built

Cursor 务必:
  1. 严格按 Part 顺序
  2. 每 Part 完成在【真机】测试
  3. 截图 + console 日志证明
  4. 不允许跳过 P0 去做 P2
  5. 不允许声称"已完成"但没测试
```

---

# ⛔ 最后的红线

```
如果你这次又:
  - 改了一堆 CSS 但罗盘还是不能转
  - 12 时辰还是只看到几个亮
  - 姿态提示还是挤压布局
  - 没有在真机测试

→ 视为完全失败
→ 用户会重置进度并重新让你做

成功的标志(必须同时达成):
  ✓ 用户拿起手机,转身,看到方位符跟着转
  ✓ 至少 80% 时辰(10+/12)有真实 LLM 内容
  ✓ 时辰按顺序点亮(不是随机)
  ✓ 姿态提示是浮层,姿态对了自动消失
  ✓ 粒子+方位符占据屏幕主要视觉

这些都达成 → 任务才算完成。
```
