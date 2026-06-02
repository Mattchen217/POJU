# pojulife PWA + UI 视觉重构最终版

> **目标**:
> 1. 手机浏览器强制 PWA 引导(iOS Share / Android 一键安装)
> 2. PWA 内全局布局(去 marketing header,纯文字底部 nav)
> 3. 完整无边框玻璃态视觉系统
> 4. Syncro 三模式(Compass / AR / MAP)重构
> 5. 时辰流式进度条
> 6. Why-this-current Modal
> 7. LLM 性能修复(API 拆分 + 配置调整)
>
> **参考**:Claude 已提供 visual widget mockup(6 个关键屏幕)
>
> **执行原则**:严格【一步一停】

---

# ⚠️ Cursor 必读

```
本任务范围:
  - UI 视觉重构(无边框 + 玻璃态 + 渐变)
  - 设备策略(PWA 强制 + 浏览器引导)
  - Syncro 实施修复(三模式 + 时辰条 + Modal)
  - LLM 性能修复(API 拆分,base_analysis 加速)

不涉及:
  - 真太阳时(已在 Syncro_TrueSolarTime_Final.md)
  - 计算引擎(已在 Syncro_Calculation_Engine.md)
  - 真太阳时跨产品自查(已在 POJU_Match_Glyph_TrueSolarTime_Audit.md)

视觉方向已确认:
  ✓ Apple 极简 / 现代感
  ✓ 深空渐变背景
  ✓ 完全无 border
  ✓ 玻璃态(rgba + backdrop-filter)
  ✓ 金色品牌色 #D4A574
  ✓ 5 个状态色(open/foll/still/cross/under)

每个 Step 完成后:
  - 贴出代码 + 截图
  - 等用户明确"通过 Step X" 才进入下一步
  
绝不允许:
  ✗ 跨 Step 实施
  ✗ 在 widget 之外加 emoji
  ✗ 用 emoji 替代 Tabler icons
```

---

# 第 1 部分:Step 1 - 全局视觉系统 Token

## Step 1.1: CSS Variables(全站统一)

文件:`styles/pojulife-design-system.css`(新建)

```css
/* ============================================
   pojulife 设计系统 · v2 Apple Minimal
   ============================================ */

:root {
  /* === 背景色(深空渐变)=== */
  --pj-bg-deep:        #07091A;
  --pj-bg-mid:         #0F1428;
  --pj-bg-elevated:    #131736;
  --pj-bg-card:        rgba(255, 255, 255, 0.04);
  --pj-bg-card-hover:  rgba(255, 255, 255, 0.07);
  --pj-bg-overlay:     rgba(7, 9, 26, 0.85);
  
  /* === 文字色(柔和层次)=== */
  --pj-text-primary:   #E8E8F0;
  --pj-text-secondary: #A0A4B8;
  --pj-text-tertiary:  #8A8AA0;
  --pj-text-muted:     #5A5F75;
  --pj-text-disabled:  #3A3E50;
  
  /* === 品牌色(金 + 青)=== */
  --pj-gold:           #D4A574;
  --pj-gold-soft:      #F2C994;
  --pj-gold-glow:      rgba(212, 165, 116, 0.7);
  --pj-teal:           #4ECDC4;
  --pj-teal-soft:      #7FE0D9;
  
  /* === Current 5 等级色 === */
  --pj-open:           #00D9B8;
  --pj-following:      #4ECDC4;
  --pj-still:          #8A8AA0;
  --pj-cross:          #E89F4D;
  --pj-under:          #C85A5A;
  
  /* === 透明叠加(替代 border)=== */
  --pj-divider:        rgba(255, 255, 255, 0.08);
  --pj-divider-strong: rgba(255, 255, 255, 0.12);
  
  /* === 圆角 === */
  --pj-radius-sm:      8px;
  --pj-radius-md:      12px;
  --pj-radius-lg:      16px;
  --pj-radius-xl:      20px;
  --pj-radius-pill:    999px;
  
  /* === 阴影(替代 border 做层次)=== */
  --pj-shadow-card:    inset 0 0 0 0.5px rgba(255, 255, 255, 0.06);
  --pj-shadow-glow-gold: 0 0 32px rgba(212, 165, 116, 0.25);
  --pj-shadow-glow-teal: 0 0 32px rgba(78, 205, 196, 0.2);
  
  /* === 字体 === */
  --pj-font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 
                  'PingFang SC', 'Helvetica Neue', system-ui, sans-serif;
  --pj-font-mono: 'SF Mono', Menlo, Monaco, monospace;
  
  /* === 字号梯度 === */
  --pj-text-xs:        11px;
  --pj-text-sm:        13px;
  --pj-text-base:      15px;
  --pj-text-lg:        18px;
  --pj-text-xl:        22px;
  --pj-text-2xl:       28px;
  --pj-text-3xl:       36px;
  --pj-text-display:   48px;
  
  /* === 字重(只用 2 档)=== */
  --pj-weight-regular: 400;
  --pj-weight-medium:  500;
  
  /* === 行高 === */
  --pj-leading-tight:  1.2;
  --pj-leading-normal: 1.5;
  --pj-leading-relaxed: 1.7;
  
  /* === 字间距 === */
  --pj-track-tight:    -0.4px;
  --pj-track-normal:   0;
  --pj-track-wide:     0.5px;
  --pj-track-widest:   1.5px;
  
  /* === 间距(rem)=== */
  --pj-space-1: 4px;
  --pj-space-2: 8px;
  --pj-space-3: 12px;
  --pj-space-4: 16px;
  --pj-space-5: 20px;
  --pj-space-6: 24px;
  --pj-space-8: 32px;
  --pj-space-10: 40px;
  --pj-space-12: 48px;
  --pj-space-16: 64px;
  
  /* === 动画 === */
  --pj-duration-fast:   180ms;
  --pj-duration-normal: 300ms;
  --pj-duration-slow:   600ms;
  --pj-duration-slower: 1000ms;
  --pj-ease:            cubic-bezier(0.4, 0, 0.2, 1);
  --pj-ease-out:        cubic-bezier(0, 0, 0.2, 1);
  --pj-ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* === 重要:全站默认背景 === */
body {
  background: linear-gradient(180deg, var(--pj-bg-mid) 0%, var(--pj-bg-deep) 100%);
  color: var(--pj-text-primary);
  font-family: var(--pj-font-sans);
  font-weight: var(--pj-weight-regular);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* === 删除所有默认 border === */
* {
  border: none;
}

/* === 全局 utility class === */
.pj-glass {
  background: var(--pj-bg-card);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: var(--pj-radius-lg);
  box-shadow: var(--pj-shadow-card);
}

.pj-glass-strong {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  border-radius: var(--pj-radius-lg);
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.1);
}

.pj-divider {
  height: 0.5px;
  background: var(--pj-divider);
  width: 100%;
}

/* === 状态色 utility === */
.pj-text-open      { color: var(--pj-open); }
.pj-text-following { color: var(--pj-following); }
.pj-text-still     { color: var(--pj-still); }
.pj-text-cross     { color: var(--pj-cross); }
.pj-text-under     { color: var(--pj-under); }

.pj-bg-open      { background: linear-gradient(135deg, rgba(0,217,184,0.18), rgba(0,217,184,0.04)); }
.pj-bg-following { background: linear-gradient(135deg, rgba(78,205,196,0.12), rgba(78,205,196,0.03)); }
.pj-bg-still     { background: linear-gradient(135deg, rgba(138,138,160,0.10), rgba(138,138,160,0.02)); }
.pj-bg-cross     { background: linear-gradient(135deg, rgba(232,159,77,0.12), rgba(232,159,77,0.03)); }
.pj-bg-under     { background: linear-gradient(135deg, rgba(200,90,90,0.14), rgba(200,90,90,0.03)); }

/* === 移除 marketing 头/尾在 PWA 中 === */
.pwa-mode .marketing-header,
.pwa-mode .marketing-footer {
  display: none !important;
}
```

## Step 1.2: 字体引入

文件:`app/layout.tsx`

```typescript
// 在 head 中(或用 next/font):

import { JetBrains_Mono } from 'next/font/google';

// SF Pro Display 是系统字体,无需 import
// PingFang SC 也是系统字体

// 字号:用 CSS variable,字体:用 system stack

// app/[locale]/layout.tsx 顶部加
import '@/styles/pojulife-design-system.css';
```

## Step 1.3: 删除所有 border 样式

```
任务:全站搜索并删除 border 样式

grep -rn "border:" components/ app/ styles/ | grep -v "border-radius"
grep -rn "border-color:" components/ app/ styles/
grep -rn "border-width:" components/ app/ styles/
grep -rn "border-style:" components/ app/ styles/

对每个匹配:
  □ 评估是否真的需要 border
  □ 如果是装饰性的 → 删除
  □ 如果是结构性的(如 input 输入框边框)→ 改为玻璃态背景

替换原则:
  border: 1px solid X  →  box-shadow: inset 0 0 0 0.5px X
  或者
  border: 1px solid X  →  background: rgba(X with low alpha)
  
绝大多数情况:直接删除 border,用渐变背景或 glass 效果替代
```

## 验证清单

```
□ pojulife-design-system.css 创建
□ 全站 import 这个文件
□ 全站 grep 不再有 border:(除了 input/button 等必要)
□ body 背景渐变生效
□ Tabler icons 可用
□ 4 个 utility class 可用(glass / divider / text-* / bg-*)

🛑 等用户确认进入 Step 2
```

---

# 第 2 部分:Step 2 - 设备检测升级 + PWA 检测

## Step 2.1: 扩展设备检测

文件:`lib/syncro/device-capability.ts`(已存在,扩展)

```typescript
// lib/syncro/device-capability.ts

export interface DeviceCapability {
  // ... 现有字段
  type: 'mobile' | 'tablet' | 'desktop';
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  hasOrientationSensor: boolean;
  hasCamera: boolean;
  hasGeolocation: boolean;
  os: 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'unknown';
  
  // ⭐ 新增字段
  isPWA: boolean;
  isStandalone: boolean;
  canInstallPWA: boolean;
  browserName: 'safari' | 'chrome' | 'firefox' | 'edge' | 'other';
}

export async function detectDeviceCapability(): Promise<DeviceCapability> {
  // ... 原有代码
  
  // ⭐ 检测 PWA 模式
  const isStandalone = 
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.startsWith('android-app://');
  
  const isPWA = isStandalone;
  
  // 检测浏览器
  let browserName: DeviceCapability['browserName'] = 'other';
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) browserName = 'safari';
  else if (/Chrome|Chromium/.test(ua)) browserName = 'chrome';
  else if (/Firefox/.test(ua)) browserName = 'firefox';
  else if (/Edg/.test(ua)) browserName = 'edge';
  
  // 是否能安装 PWA
  const canInstallPWA = !isPWA && (
    (os === 'ios' && browserName === 'safari') ||
    (os === 'android' && browserName === 'chrome')
  );
  
  return {
    // ... 原有字段
    isPWA,
    isStandalone,
    canInstallPWA,
    browserName
  };
}

/**
 * 是否需要强制 PWA 引导
 * (手机浏览器,但不是 PWA 模式)
 */
export function shouldForcePWAInstall(capability: DeviceCapability): boolean {
  return (capability.isMobile || capability.isTablet) && !capability.isPWA;
}
```

## Step 2.2: PWA 模式 class 注入

文件:`app/[locale]/layout.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { detectDeviceCapability } from '@/lib/syncro/device-capability';

export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    detectDeviceCapability().then(cap => {
      // 全局 class 用于 CSS 区分
      if (cap.isPWA) {
        document.documentElement.classList.add('pwa-mode');
      } else {
        document.documentElement.classList.remove('pwa-mode');
      }
      
      // OS 也加 class(方便针对性样式)
      document.documentElement.dataset.os = cap.os;
    });
  }, []);
  
  return (
    <html>
      <body>
        {children}
      </body>
    </html>
  );
}
```

## Step 2.3: PWA Manifest 配置

文件:`public/manifest.json`(检查/更新)

```json
{
  "name": "pojulife",
  "short_name": "pojulife",
  "description": "Eastern wisdom, modern translation",
  "start_url": "/?source=pwa",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#07091A",
  "theme_color": "#07091A",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "categories": ["lifestyle", "productivity"]
}
```

文件:`app/layout.tsx`(确保 manifest link)

```tsx
<head>
  <link rel="manifest" href="/manifest.json" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="pojulife" />
  <link rel="apple-touch-icon" href="/icons/icon-192.png" />
  <meta name="theme-color" content="#07091A" />
</head>
```

## 验证清单

```
□ device-capability.ts 扩展完成
□ isPWA / canInstallPWA / browserName 检测准确
□ pwa-mode class 注入 html 标签
□ manifest.json 配置完整
□ apple-touch-icon 配置
□ 手机 Safari 能看到"添加到主屏幕"

🛑 等用户确认进入 Step 3
```

---

# 第 3 部分:Step 3 - 浏览器强制 PWA 引导页

## Step 3.1: 引导组件

文件:`components/pwa/PWAInstallGate.tsx`(新建)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { detectDeviceCapability, type DeviceCapability } from '@/lib/syncro/device-capability';

export function PWAInstallGate({ children }: { children: React.ReactNode }) {
  const [capability, setCapability] = useState<DeviceCapability | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  useEffect(() => {
    detectDeviceCapability().then(setCapability);
    
    // Android Chrome 的安装事件
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    
    // 检查是否之前已接受过提示
    if (typeof localStorage !== 'undefined') {
      const wasAccepted = localStorage.getItem('pojulife_gate_accepted');
      if (wasAccepted) setAccepted(true);
    }
    
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  
  if (!capability) {
    return <div className="loading-fullscreen" />;
  }
  
  // 桌面 / PWA / 平板大尺寸 → 不拦截
  if (capability.isDesktop || capability.isPWA) {
    return <>{children}</>;
  }
  
  // 手机浏览器 + 已接受 disclaimer → 显示安装引导
  if (capability.isMobile || capability.isTablet) {
    if (!accepted) {
      return <DisclaimerGate onAccept={() => {
        setAccepted(true);
        localStorage.setItem('pojulife_gate_accepted', '1');
      }} />;
    }
    
    return (
      <PWAInstallScreen 
        capability={capability}
        installPrompt={installPrompt}
      />
    );
  }
  
  return <>{children}</>;
}

function DisclaimerGate({ onAccept }: { onAccept: () => void }) {
  const t = useTranslations('pwa.disclaimer');
  const [checked, setChecked] = useState(false);
  
  return (
    <div className="pwa-disclaimer-gate">
      <div className="disclaimer-content">
        <div className="logo-mark">◇</div>
        
        <h1 className="disclaimer-title">{t('title')}</h1>
        
        <div className="disclaimer-body">
          <p>{t('para_1')}</p>
          <p>{t('para_2')}</p>
          <p className="muted">{t('para_3')}</p>
        </div>
        
        <label className="checkbox-line">
          <input 
            type="checkbox" 
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>{t('agree')}</span>
        </label>
        
        <button 
          className="primary-btn"
          disabled={!checked}
          onClick={onAccept}
        >
          {t('enter')}
        </button>
      </div>
    </div>
  );
}

function PWAInstallScreen({ capability, installPrompt }: {
  capability: DeviceCapability;
  installPrompt: any;
}) {
  const t = useTranslations('pwa.install');
  
  function handleAndroidInstall() {
    if (installPrompt) {
      installPrompt.prompt();
    }
  }
  
  return (
    <div className="pwa-install-screen">
      <div className="install-content">
        <div className="logo-mark-large">◇</div>
        
        <h1 className="install-title">{t('title')}</h1>
        <p className="install-subtitle">{t('subtitle')}</p>
        
        {capability.os === 'ios' && <IOSInstallSteps />}
        {capability.os === 'android' && (
          <AndroidInstallSteps 
            canDirectInstall={!!installPrompt}
            onInstall={handleAndroidInstall}
          />
        )}
        
        <div className="post-install-tip">
          <p>{t('after_install_tip')}</p>
        </div>
        
        <div className="desktop-fallback">
          <p className="muted">{t('want_explore')}</p>
          <a href="https://pojulife.com" className="desktop-link">
            pojulife.com
          </a>
        </div>
      </div>
    </div>
  );
}

function IOSInstallSteps() {
  const t = useTranslations('pwa.install.ios');
  
  return (
    <div className="install-steps">
      <div className="steps-label">{t('label')}</div>
      
      <div className="step-item">
        <div className="step-icon">
          <i className="ti ti-share-2" />
        </div>
        <div className="step-text">
          <span dangerouslySetInnerHTML={{__html: t.raw('step_1')}} />
        </div>
      </div>
      
      <div className="step-item">
        <div className="step-icon">
          <i className="ti ti-square-rounded-plus" />
        </div>
        <div className="step-text">
          <span dangerouslySetInnerHTML={{__html: t.raw('step_2')}} />
        </div>
      </div>
      
      <div className="step-item">
        <div className="step-icon">
          <i className="ti ti-check" />
        </div>
        <div className="step-text">
          <span dangerouslySetInnerHTML={{__html: t.raw('step_3')}} />
        </div>
      </div>
    </div>
  );
}

function AndroidInstallSteps({ 
  canDirectInstall, 
  onInstall 
}: { 
  canDirectInstall: boolean;
  onInstall: () => void;
}) {
  const t = useTranslations('pwa.install.android');
  
  if (canDirectInstall) {
    return (
      <div className="install-direct">
        <button className="install-btn-large" onClick={onInstall}>
          <i className="ti ti-download" />
          {t('install_button')}
        </button>
        <p className="install-direct-hint">{t('one_tap_hint')}</p>
      </div>
    );
  }
  
  // 备选:展示菜单安装步骤
  return (
    <div className="install-steps">
      <div className="steps-label">{t('label_manual')}</div>
      
      <div className="step-item">
        <div className="step-icon">
          <i className="ti ti-dots-vertical" />
        </div>
        <div className="step-text">{t('step_1')}</div>
      </div>
      
      <div className="step-item">
        <div className="step-icon">
          <i className="ti ti-square-rounded-plus" />
        </div>
        <div className="step-text">{t('step_2')}</div>
      </div>
      
      <div className="step-item">
        <div className="step-icon">
          <i className="ti ti-check" />
        </div>
        <div className="step-text">{t('step_3')}</div>
      </div>
    </div>
  );
}
```

## Step 3.2: 样式

文件:`styles/pwa-gate.css`(新建,引入到 PWAInstallGate 中)

```css
.pwa-disclaimer-gate,
.pwa-install-screen {
  position: fixed;
  inset: 0;
  background: linear-gradient(180deg, var(--pj-bg-mid) 0%, var(--pj-bg-deep) 100%);
  color: var(--pj-text-primary);
  font-family: var(--pj-font-sans);
  display: flex;
  flex-direction: column;
  z-index: 9999;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.disclaimer-content,
.install-content {
  padding: 48px 24px 32px;
  max-width: 420px;
  margin: 0 auto;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
}

.logo-mark,
.logo-mark-large {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--pj-gold) 0%, var(--pj-teal) 100%);
  margin: 32px auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--pj-bg-deep);
  font-size: 26px;
  font-weight: var(--pj-weight-medium);
}

.logo-mark-large {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  font-size: 30px;
}

.disclaimer-title,
.install-title {
  font-size: var(--pj-text-2xl);
  font-weight: var(--pj-weight-medium);
  letter-spacing: var(--pj-track-tight);
  line-height: var(--pj-leading-tight);
  margin: 0 0 12px;
}

.install-subtitle {
  font-size: var(--pj-text-sm);
  color: var(--pj-text-tertiary);
  line-height: var(--pj-leading-normal);
  margin: 0 0 32px;
  padding: 0 12px;
}

.disclaimer-body {
  font-size: var(--pj-text-sm);
  color: var(--pj-text-secondary);
  line-height: var(--pj-leading-relaxed);
  text-align: left;
  margin: 32px 0;
  padding: 20px;
  background: var(--pj-bg-card);
  border-radius: var(--pj-radius-lg);
  backdrop-filter: blur(20px);
}

.disclaimer-body p {
  margin: 0 0 12px;
}

.disclaimer-body p.muted {
  color: var(--pj-text-muted);
  font-size: var(--pj-text-xs);
  margin-top: 16px;
}

.checkbox-line {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: var(--pj-text-sm);
  color: var(--pj-text-secondary);
  margin: 20px 0;
  cursor: pointer;
  user-select: none;
}

.checkbox-line input {
  width: 20px;
  height: 20px;
  accent-color: var(--pj-gold);
}

.primary-btn {
  width: 100%;
  padding: 16px 24px;
  background: linear-gradient(135deg, var(--pj-gold) 0%, var(--pj-gold-soft) 100%);
  color: var(--pj-bg-deep);
  font-family: inherit;
  font-size: var(--pj-text-base);
  font-weight: var(--pj-weight-medium);
  border-radius: var(--pj-radius-lg);
  cursor: pointer;
  transition: transform var(--pj-duration-fast) var(--pj-ease);
}

.primary-btn:disabled {
  background: rgba(212, 165, 116, 0.2);
  color: var(--pj-text-muted);
  cursor: not-allowed;
}

.primary-btn:not(:disabled):active {
  transform: scale(0.98);
}

.install-steps {
  margin: 32px 0;
  padding: 20px 16px;
  background: var(--pj-bg-card);
  border-radius: var(--pj-radius-lg);
  backdrop-filter: blur(20px);
}

.steps-label {
  font-size: var(--pj-text-xs);
  color: var(--pj-text-tertiary);
  text-transform: uppercase;
  letter-spacing: var(--pj-track-widest);
  margin-bottom: 18px;
  text-align: center;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  text-align: left;
}

.step-item:last-child {
  margin-bottom: 0;
}

.step-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: rgba(78, 205, 196, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--pj-teal);
  flex-shrink: 0;
}

.step-icon i {
  font-size: 18px;
}

.step-text {
  font-size: var(--pj-text-sm);
  color: var(--pj-text-primary);
  line-height: var(--pj-leading-normal);
}

.step-text strong,
.step-text b {
  color: var(--pj-teal);
  font-weight: var(--pj-weight-medium);
}

.install-direct {
  margin: 32px 0;
  text-align: center;
}

.install-btn-large {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 16px 32px;
  background: linear-gradient(135deg, var(--pj-gold) 0%, var(--pj-gold-soft) 100%);
  color: var(--pj-bg-deep);
  font-family: inherit;
  font-size: var(--pj-text-base);
  font-weight: var(--pj-weight-medium);
  border-radius: var(--pj-radius-pill);
  cursor: pointer;
}

.install-btn-large i {
  font-size: 20px;
}

.install-direct-hint {
  font-size: var(--pj-text-xs);
  color: var(--pj-text-tertiary);
  margin-top: 12px;
}

.post-install-tip {
  margin-top: 32px;
  padding: 16px;
  background: rgba(212, 165, 116, 0.06);
  border-radius: var(--pj-radius-lg);
}

.post-install-tip p {
  margin: 0;
  font-size: var(--pj-text-xs);
  color: var(--pj-gold);
  line-height: var(--pj-leading-normal);
}

.desktop-fallback {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 0.5px solid var(--pj-divider);
}

.desktop-fallback p {
  font-size: var(--pj-text-xs);
  color: var(--pj-text-muted);
  margin: 0 0 4px;
}

.desktop-link {
  font-size: var(--pj-text-sm);
  color: var(--pj-gold);
  text-decoration: none;
  letter-spacing: 0.2px;
}
```

## Step 3.3: 翻译

文件:`messages/en/pwa.json`(新建或扩展)

```json
{
  "pwa": {
    "disclaimer": {
      "title": "Before you enter pojulife",
      "para_1": "pojulife is designed as an installable app, not a regular website.",
      "para_2": "This ensures reliable performance, your data stays on your device, and you get the full experience.",
      "para_3": "By continuing, you acknowledge this and agree to install pojulife on your device.",
      "agree": "I understand and agree",
      "enter": "Enter pojulife"
    },
    "install": {
      "title": "Install pojulife to begin",
      "subtitle": "Full features and reliable experience require installation on your home screen",
      "after_install_tip": "Once installed, open pojulife from your home screen — never through Safari again.",
      "want_explore": "Want to explore on desktop?",
      "ios": {
        "label": "On iPhone Safari",
        "step_1": "Tap <strong>Share</strong> button below",
        "step_2": "Select <strong>Add to Home Screen</strong>",
        "step_3": "Tap <strong>Add</strong> to confirm"
      },
      "android": {
        "label_manual": "On Android Chrome",
        "install_button": "Install pojulife",
        "one_tap_hint": "One tap to install — no app store needed",
        "step_1": "Tap menu (3 dots) at top right",
        "step_2": "Select Add to Home Screen",
        "step_3": "Tap Install to confirm"
      }
    }
  }
}
```

文件:`messages/zh/pwa.json`

```json
{
  "pwa": {
    "disclaimer": {
      "title": "进入 pojulife 之前",
      "para_1": "pojulife 设计为可安装应用,而非普通网站。",
      "para_2": "这确保了稳定的性能、数据保留在你的设备上,以及完整的体验。",
      "para_3": "继续即表示你已了解,并同意将 pojulife 安装到你的设备。",
      "agree": "我已了解并同意",
      "enter": "进入 pojulife"
    },
    "install": {
      "title": "安装 pojulife 后开始使用",
      "subtitle": "完整功能和稳定体验需要将应用安装到主屏幕",
      "after_install_tip": "安装后,从主屏幕的 pojulife 图标进入,不再通过浏览器。",
      "want_explore": "想在电脑上探索?",
      "ios": {
        "label": "iPhone Safari",
        "step_1": "点击底部的 <strong>分享</strong> 按钮",
        "step_2": "选择 <strong>添加到主屏幕</strong>",
        "step_3": "点击 <strong>添加</strong> 确认"
      },
      "android": {
        "label_manual": "Android Chrome",
        "install_button": "安装 pojulife",
        "one_tap_hint": "一键安装 — 无需应用商店",
        "step_1": "点击右上角菜单(3 个点)",
        "step_2": "选择 添加到主屏幕",
        "step_3": "点击 安装 确认"
      }
    }
  }
}
```

## Step 3.4: 集成到 layout

文件:`app/[locale]/layout.tsx`

```tsx
import { PWAInstallGate } from '@/components/pwa/PWAInstallGate';

export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <PWAInstallGate>
          {children}
        </PWAInstallGate>
      </body>
    </html>
  );
}
```

## 验证清单

```
□ PWAInstallGate 组件实现
□ DisclaimerGate 首次弹层
□ IOSInstallSteps 带图标
□ AndroidInstallSteps 一键安装(支持时) + 备选菜单步骤
□ 翻译完整(EN + ZH)
□ 桌面访问不拦截
□ 已安装 PWA 不拦截
□ 手机浏览器:首次显示 disclaimer → 接受后显示安装引导
□ 接受过的用户不重复显示 disclaimer

🛑 等用户确认进入 Step 4
```

---

# 第 4 部分:Step 4 - PWA 底部纯文字导航

## Step 4.1: 底部 Nav 组件

文件:`components/pwa/PWABottomNav.tsx`(新建)

```tsx
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

const PRODUCTS = [
  { id: 'poju', name: 'POJU', path: '/poju' },
  { id: 'glyph', name: 'Glyph', path: '/glyph' },
  { id: 'syncro', name: 'Syncro', path: '/syncro' },
  { id: 'match', name: 'Match', path: '/match' }
];

const LOCALES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'zh', label: 'ZH', name: '中文' },
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'de', label: 'DE', name: 'Deutsch' }
];

export function PWABottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [langOpen, setLangOpen] = useState(false);
  
  // 判断当前激活的产品
  const activeProduct = PRODUCTS.find(p => pathname.includes(p.path))?.id;
  
  const currentLocaleLabel = LOCALES.find(l => l.code === locale)?.label || 'EN';
  
  function navigateTo(productPath: string) {
    router.push(`/${locale}${productPath}`);
  }
  
  function handleLanguageSelect(newLocale: string) {
    setLangOpen(false);
    const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '');
    router.push(`/${newLocale}${pathWithoutLocale}`);
  }
  
  function goToArchive() {
    router.push(`/${locale}/archive`);
  }
  
  return (
    <>
      <nav className="pwa-bottom-nav">
        {/* 左侧:语言切换 */}
        <button 
          className="nav-aux" 
          onClick={() => setLangOpen(true)}
          aria-label="Language"
        >
          {currentLocaleLabel}
        </button>
        
        {/* 中间:4 个产品 */}
        <div className="nav-products">
          {PRODUCTS.map(product => (
            <button
              key={product.id}
              className={`nav-product ${activeProduct === product.id ? 'active' : ''}`}
              onClick={() => navigateTo(product.path)}
            >
              {product.name}
            </button>
          ))}
        </div>
        
        {/* 右侧:Archive */}
        <button 
          className="nav-aux" 
          onClick={goToArchive}
          aria-label="Archive"
        >
          A
        </button>
      </nav>
      
      {/* 语言选择 Modal */}
      {langOpen && (
        <LanguageModal 
          currentLocale={locale}
          onSelect={handleLanguageSelect}
          onClose={() => setLangOpen(false)}
        />
      )}
    </>
  );
}

function LanguageModal({ currentLocale, onSelect, onClose }: {
  currentLocale: string;
  onSelect: (locale: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('pwa.nav');
  
  return (
    <div className="lang-modal-overlay" onClick={onClose}>
      <div className="lang-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lang-modal-header">
          <span className="lang-modal-title">{t('language')}</span>
          <button className="lang-modal-close" onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>
        
        <div className="lang-options">
          {LOCALES.map(loc => (
            <button
              key={loc.code}
              className={`lang-option ${currentLocale === loc.code ? 'active' : ''}`}
              onClick={() => onSelect(loc.code)}
            >
              <span className="lang-code">{loc.label}</span>
              <span className="lang-name">{loc.name}</span>
              {currentLocale === loc.code && (
                <i className="ti ti-check" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Step 4.2: 样式

文件:`styles/pwa-nav.css`

```css
.pwa-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 14px 18px max(22px, env(safe-area-inset-bottom));
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
  
  /* 玻璃态背景,无 border */
  background: linear-gradient(to top, 
    rgba(7, 9, 26, 0.95) 0%, 
    rgba(7, 9, 26, 0.85) 50%, 
    rgba(7, 9, 26, 0.6) 100%);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  
  font-family: var(--pj-font-sans);
}

.nav-aux {
  font-size: 11px;
  color: var(--pj-text-muted);
  letter-spacing: var(--pj-track-widest);
  font-weight: var(--pj-weight-medium);
  background: transparent;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: var(--pj-radius-sm);
  transition: color var(--pj-duration-fast) var(--pj-ease);
  font-family: inherit;
  min-width: 36px;
}

.nav-aux:active {
  color: var(--pj-gold);
}

.nav-products {
  display: flex;
  gap: 16px;
  align-items: center;
}

.nav-product {
  font-size: 13px;
  font-weight: var(--pj-weight-medium);
  letter-spacing: 0.2px;
  color: var(--pj-text-muted);
  background: transparent;
  cursor: pointer;
  padding: 6px 4px;
  position: relative;
  transition: color var(--pj-duration-fast) var(--pj-ease);
  font-family: inherit;
}

.nav-product.active {
  color: var(--pj-gold);
}

.nav-product.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 2px;
  background: var(--pj-gold);
  border-radius: 1px;
}

.nav-product:not(.active):active {
  color: var(--pj-text-primary);
}

/* === 语言 Modal === */
.lang-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: pj-fade-in var(--pj-duration-fast);
}

.lang-modal {
  width: 100%;
  max-width: 480px;
  background: var(--pj-bg-elevated);
  border-radius: var(--pj-radius-xl) var(--pj-radius-xl) 0 0;
  padding: 24px 20px max(32px, env(safe-area-inset-bottom));
  animation: pj-slide-up var(--pj-duration-normal) var(--pj-ease);
}

.lang-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.lang-modal-title {
  font-size: var(--pj-text-base);
  font-weight: var(--pj-weight-medium);
  color: var(--pj-text-primary);
}

.lang-modal-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--pj-text-secondary);
  cursor: pointer;
}

.lang-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lang-option {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  background: transparent;
  cursor: pointer;
  border-radius: var(--pj-radius-md);
  font-family: inherit;
  transition: background var(--pj-duration-fast) var(--pj-ease);
}

.lang-option:active {
  background: var(--pj-bg-card);
}

.lang-option.active {
  background: rgba(212, 165, 116, 0.08);
}

.lang-code {
  font-size: var(--pj-text-sm);
  font-weight: var(--pj-weight-medium);
  color: var(--pj-gold);
  min-width: 32px;
  letter-spacing: 0.5px;
}

.lang-name {
  font-size: var(--pj-text-sm);
  color: var(--pj-text-primary);
  flex: 1;
  text-align: left;
}

.lang-option i {
  color: var(--pj-gold);
  font-size: 18px;
}

@keyframes pj-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pj-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* === 全屏页面给底部 nav 留出空间 === */
.pwa-mode .pwa-page {
  padding-bottom: 80px; /* nav 高度 + 安全区 */
}
```

## Step 4.3: PWA Layout(替换 marketing layout)

文件:`app/[locale]/pwa-layout.tsx`(新建)

实际上不需要单独 layout 文件,因为 marketing header/footer 已经通过 `.pwa-mode` class 隐藏。我们只需要在 PWA mode 下显示底部 nav。

文件:`app/[locale]/layout.tsx`(修改)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { PWAInstallGate } from '@/components/pwa/PWAInstallGate';
import { PWABottomNav } from '@/components/pwa/PWABottomNav';
import { detectDeviceCapability } from '@/lib/syncro/device-capability';

export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  const [isPWA, setIsPWA] = useState(false);
  
  useEffect(() => {
    detectDeviceCapability().then(cap => {
      setIsPWA(cap.isPWA);
    });
  }, []);
  
  return (
    <PWAInstallGate>
      {children}
      {isPWA && <PWABottomNav />}
    </PWAInstallGate>
  );
}
```

## 验证清单

```
□ PWABottomNav 组件实现
□ 5 种语言切换
□ Archive 跳转
□ 当前产品高亮(金色 + 下划线)
□ EN/A 字号小(11px),产品名 13px
□ 玻璃态背景
□ Safari 底部安全区适配(env safe-area-inset-bottom)
□ PWA 模式下显示,浏览器不显示
□ 桌面不显示

🛑 等用户确认进入 Step 5
```

---

# 第 5 部分:Step 5 - LLM 性能修复 + Syncro API 拆分

## Step 5.1: 排查 LLM 配置

```
任务:列出所有 callLLM 调用点的配置

grep -rn "thinking_effort\|max_tokens\|call_type" lib/llm/

期望配置:
  ┌──────────────────────┬─────────┬──────────┐
  │ 调用类型              │ thinking │ max_tokens │
  ├──────────────────────┼─────────┼──────────┤
  │ base_analysis        │ medium  │ 8000     │
  │ poju_reply           │ low     │ 2500     │
  │ syncro_batch (per)   │ low     │ 6000     │
  │ match_report         │ medium  │ 10000    │
  │ glyph_reading        │ low     │ 3000     │
  └──────────────────────┴─────────┴──────────┘

如果发现 high / 过大 max_tokens:
  → 调整为推荐值
  → 测试 base_analysis 单次耗时
  → 期望 30-60 秒

报告给用户:
  - 实际找到的配置
  - 调整后的耗时数据
```

## Step 5.2: 拆分 Syncro API

```
当前问题:
  /api/syncro/compute 一次性做完所有事
  本地 96 计算 + 6 批 LLM → 10+ 分钟 → Load failed

新架构:
  1. /api/syncro/compute_local (新)
     - 只做本地计算
     - 96 矩阵 + fallback 文案
     - 15 秒内返回
  
  2. /api/syncro/llm_batch (新)
     - 单批 LLM 调用
     - 16 个 cell 文案
     - 60 秒以内
  
  3. /api/syncro/compute (旧)
     - 废弃 OR 改为 compute_local 别名
```

文件:`app/api/syncro/compute_local/route.ts`(新建)

```typescript
import { NextResponse } from 'next/server';
import { calculateSyncroMatrix } from '@/lib/syncro/calculate-matrix';
import { getStoredProfile } from '@/lib/profile/stored-profiles-service';
import { createSyncroSessionId } from '@/lib/syncro/syncro-session';
import { generateFallbackAdvice } from '@/lib/syncro/fallback-advice';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { profile_id, task_description, user_location, locale } = body;
    
    // 校验
    if (!profile_id || !task_description) {
      return NextResponse.json({ 
        error: 'missing_required_fields' 
      }, { status: 400 });
    }
    
    if (!user_location?.latitude || !user_location?.longitude) {
      return NextResponse.json({ 
        error: 'invalid_location' 
      }, { status: 400 });
    }
    
    // 加载 profile
    const profile = await getStoredProfile(profile_id);
    if (!profile?.base_analysis?.content) {
      return NextResponse.json({ 
        error: 'no_base_analysis' 
      }, { status: 404 });
    }
    
    // 本地计算 96 矩阵(真太阳时)
    console.log('[compute_local] Computing 96 matrix locally...');
    const startTime = Date.now();
    
    const { matrix: localMatrix } = calculateSyncroMatrix({
      profile,
      taskDescription: task_description,
      startTime: new Date(),
      userTimezone: user_location.timezone,
      userLongitude: user_location.longitude,
      userLatitude: user_location.latitude
    });
    
    // 用 fallback 文案填充所有 cell
    const matrix: Record<string, any> = {};
    for (const key of Object.keys(localMatrix)) {
      const cell = localMatrix[key];
      matrix[key] = {
        ...cell,
        short_advice: generateFallbackAdvice(cell, locale, 'short'),
        detailed_advice: generateFallbackAdvice(cell, locale, 'detailed'),
        rationale: generateFallbackAdvice(cell, locale, 'rationale'),
        llm_pending: true  // 标记为待 LLM 增强
      };
    }
    
    const session_id = createSyncroSessionId();
    const elapsedMs = Date.now() - startTime;
    
    console.log(`[compute_local] Done in ${elapsedMs}ms`);
    
    return NextResponse.json({
      success: true,
      session_id,
      matrix,
      meta: {
        local_computation: true,
        llm_status: 'pending',
        total_batches: 6,
        completed_batches: 0,
        elapsed_ms: elapsedMs
      }
    });
  } catch (e: any) {
    console.error('[compute_local] error', e);
    return NextResponse.json({
      error: 'compute_failed',
      message: e.message
    }, { status: 500 });
  }
}
```

文件:`app/api/syncro/llm_batch/route.ts`(新建)

```typescript
import { NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm/router';
import { buildSyncroBatchPrompt } from '@/lib/llm/prompts/syncro-batch-prompt';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      session_id, 
      batch_index,
      matrix_slice,  // 这一批的 16 个 cell 数据
      profile_summary,
      task_description,
      locale 
    } = body;
    
    if (!session_id || batch_index === undefined || !matrix_slice) {
      return NextResponse.json({ 
        error: 'missing_required_fields' 
      }, { status: 400 });
    }
    
    if (Object.keys(matrix_slice).length === 0) {
      return NextResponse.json({ 
        error: 'empty_slice' 
      }, { status: 400 });
    }
    
    console.log(`[llm_batch] Batch ${batch_index + 1}/6, ${Object.keys(matrix_slice).length} cells`);
    const startTime = Date.now();
    
    // 构建 prompt(精简版,只为这 16 个 cell)
    const { system, user } = buildSyncroBatchPrompt({
      matrix_slice,
      profile_summary,
      task_description,
      locale
    });
    
    // 调用 LLM,带超时
    const result = await callLLM({
      call_type: 'syncro_batch',
      system,
      messages: [{ role: 'user', content: user }],
      max_tokens: 6000,
      thinking_effort: 'low',
      response_format: 'json',
      timeout_ms: 90_000
    });
    
    // 解析
    let parsed: any;
    try {
      const cleaned = result.content
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (e: any) {
      console.error('[llm_batch] parse fail', e.message);
      return NextResponse.json({
        error: 'parse_failed',
        message: e.message,
        batch_index
      }, { status: 500 });
    }
    
    const elapsedMs = Date.now() - startTime;
    console.log(`[llm_batch] Batch ${batch_index + 1} done in ${elapsedMs}ms`);
    
    return NextResponse.json({
      success: true,
      batch_index,
      advice: parsed.advice || parsed.matrix || parsed,
      meta: {
        model: result.actual_model,
        tokens_used: result.meta?.tokens_used,
        elapsed_ms: elapsedMs
      }
    });
  } catch (e: any) {
    console.error('[llm_batch] error', e);
    return NextResponse.json({
      error: 'batch_failed',
      message: e.message,
      batch_index: body?.batch_index
    }, { status: 500 });
  }
}
```

## Step 5.3: per-batch AbortSignal

文件:`lib/llm/openrouter-shared.ts`(修改)

```typescript
export async function openRouterChatCompletion(input: {
  // ... 现有参数
  timeout_ms?: number;
}) {
  const controller = new AbortController();
  const timeoutMs = input.timeout_ms || 90_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { /* ... */ },
      body: JSON.stringify({ /* ... */ }),
      signal: controller.signal  // ⭐ 加入超时
    });
    
    clearTimeout(timeoutId);
    
    // ... 原有逻辑
  } catch (e: any) {
    clearTimeout(timeoutId);
    
    if (e.name === 'AbortError') {
      throw new Error('llm_timeout');
    }
    throw e;
  }
}
```

## Step 5.4: 客户端流式调用

文件:`components/syncro/SyncroResultLoader.tsx`(新建,客户端流程)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { saveSyncroSession, updateSyncroBatch } from '@/lib/syncro/syncro-session';

export function SyncroResultLoader({ initialData }: { initialData: any }) {
  const router = useRouter();
  const locale = useLocale();
  const [matrix, setMatrix] = useState(initialData.matrix);
  const [progress, setProgress] = useState({
    completed_batches: 0,
    total_batches: 6,
    failed_batches: 0
  });
  
  useEffect(() => {
    // 进入页面后,后台异步调用 6 个 batch
    loadAllBatches();
  }, []);
  
  async function loadAllBatches() {
    const keys = Object.keys(initialData.matrix);
    const batchSize = Math.ceil(keys.length / 6);
    const batches: string[][] = [];
    for (let i = 0; i < 6; i++) {
      batches.push(keys.slice(i * batchSize, (i + 1) * batchSize));
    }
    
    // 并行调用 6 个 batch
    const promises = batches.map((batchKeys, batchIndex) => 
      loadBatch(batchIndex, batchKeys)
    );
    
    await Promise.allSettled(promises);
  }
  
  async function loadBatch(batchIndex: number, batchKeys: string[]) {
    try {
      const matrix_slice: Record<string, any> = {};
      for (const key of batchKeys) {
        matrix_slice[key] = initialData.matrix[key];
      }
      
      const response = await fetch('/api/syncro/llm_batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: initialData.session_id,
          batch_index: batchIndex,
          matrix_slice,
          profile_summary: initialData.profile_summary,
          task_description: initialData.task_description,
          locale
        })
      });
      
      if (!response.ok) {
        setProgress(p => ({ ...p, failed_batches: p.failed_batches + 1 }));
        return;
      }
      
      const data = await response.json();
      
      // 合并到 matrix
      setMatrix((prev: any) => {
        const next = { ...prev };
        for (const key of Object.keys(data.advice)) {
          if (next[key]) {
            next[key] = {
              ...next[key],
              short_advice: data.advice[key].short_advice || next[key].short_advice,
              detailed_advice: data.advice[key].detailed_advice || next[key].detailed_advice,
              rationale: data.advice[key].rationale || next[key].rationale,
              llm_pending: false
            };
          }
        }
        return next;
      });
      
      // 持久化
      await updateSyncroBatch(initialData.session_id, batchIndex, data.advice);
      
      setProgress(p => ({ ...p, completed_batches: p.completed_batches + 1 }));
    } catch (e) {
      console.error(`[batch ${batchIndex}] error`, e);
      setProgress(p => ({ ...p, failed_batches: p.failed_batches + 1 }));
    }
  }
  
  return (
    <SyncroResultView 
      matrix={matrix} 
      progress={progress}
      initialData={initialData}
    />
  );
}
```

## Step 5.5: formatComputeError 映射

文件:`components/syncro/SyncroComputingPage.tsx`(修改)

```typescript
function formatComputeError(error: any): { title: string; message: string } {
  const errorMsg = (error?.message || error?.toString() || '').toLowerCase();
  
  if (errorMsg.includes('load failed') || 
      errorMsg.includes('failed to fetch') ||
      errorMsg.includes('network')) {
    return {
      title: t('error.network_title'),
      message: t('error.network_message')
    };
  }
  
  if (errorMsg.includes('timeout') || errorMsg.includes('abort')) {
    return {
      title: t('error.timeout_title'),
      message: t('error.timeout_message')
    };
  }
  
  if (errorMsg.includes('invalid_location')) {
    return {
      title: t('error.location_title'),
      message: t('error.location_message')
    };
  }
  
  return {
    title: t('error.generic_title'),
    message: t('error.generic_message')
  };
}
```

## 验证清单

```
□ LLM 配置已调整(报告实际值)
□ base_analysis 耗时 30-60 秒(从 5-8 分钟降下来)
□ /api/syncro/compute_local 工作(15 秒内返回)
□ /api/syncro/llm_batch 工作(单批 60 秒内)
□ 客户端并行调用 6 batch
□ Fallback 文案在 LLM 完成前显示
□ AbortSignal 工作(单批超时不拖垮其他)
□ formatComputeError 4 种映射

🛑 等用户确认进入 Step 6
```

---

# 第 6 部分:Step 6 - Syncro 三模式重构

## Step 6.1: 全局 Syncro 容器

文件:`components/syncro/SyncroMainView.tsx`(重写)

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { SyncroCompassMode } from './SyncroCompassMode';
import { SyncroARMode } from './SyncroARMode';
import { SyncroMapMode } from './SyncroMapMode';
import { HourProgressBar } from './HourProgressBar';
import { ModeToggle } from './ModeToggle';
import { detectDeviceCapability } from '@/lib/syncro/device-capability';
import { saveSyncroPermission, loadSyncroPermission } from '@/lib/syncro/permissions';

export type SyncroViewMode = 'compass' | 'ar' | 'map';

export function SyncroMainView({ data }: { data: any }) {
  const [mode, setMode] = useState<SyncroViewMode>('compass');
  const [activeHour, setActiveHour] = useState(getCurrentHourPeriod(data.matrix));
  const [activeDirection, setActiveDirection] = useState<string>('E'); // for MAP
  const [compassDegree, setCompassDegree] = useState(0);
  const [orientationGranted, setOrientationGranted] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  
  // 检测设备 + 已有权限
  useEffect(() => {
    async function init() {
      const cap = await detectDeviceCapability();
      const perms = await loadSyncroPermission();
      
      setOrientationGranted(perms.orientation);
      setCameraGranted(perms.camera);
      
      if (perms.orientation && cap.hasOrientationSensor) {
        startOrientationListening();
      }
    }
    init();
  }, []);
  
  // 监听方位
  function startOrientationListening() {
    const handler = (e: DeviceOrientationEvent) => {
      // alpha:绕 Z 轴(罗盘方位)
      // beta:绕 X 轴(前后倾斜,90 = 平放)
      const alpha = (e as any).webkitCompassHeading ?? (360 - (e.alpha || 0));
      const beta = e.beta || 0;
      
      setCompassDegree(alpha);
      
      // ⭐ 姿势自动切换(只在 Compass/AR 间)
      if (mode === 'compass' && beta < 30 && cameraGranted) {
        setMode('ar');
      } else if (mode === 'ar' && beta > 60) {
        setMode('compass');
      }
    };
    
    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }
  
  // 请求方位权限
  async function requestOrientationPermission() {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const result = await (DeviceOrientationEvent as any).requestPermission();
        if (result === 'granted') {
          setOrientationGranted(true);
          await saveSyncroPermission('orientation', true);
          startOrientationListening();
        }
      } catch (e) {
        console.error('orientation permission denied');
      }
    } else {
      // Android 不需要权限
      setOrientationGranted(true);
      await saveSyncroPermission('orientation', true);
      startOrientationListening();
    }
  }
  
  // 请求摄像头权限
  async function requestCameraPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      stream.getTracks().forEach(t => t.stop()); // 立即停止,只为获取权限
      setCameraGranted(true);
      await saveSyncroPermission('camera', true);
    } catch (e) {
      console.error('camera permission denied');
    }
  }
  
  // 首次进入,请求方位权限
  useEffect(() => {
    if (!orientationGranted) {
      // 不自动请求(需要 user gesture),展示按钮
    }
  }, []);
  
  return (
    <div className="syncro-main">
      {/* 时辰流式进度条 */}
      <HourProgressBar 
        matrix={data.matrix}
        activeHour={activeHour}
        onSelect={setActiveHour}
        progress={data.progress}
      />
      
      {/* 主显示区(三模式) */}
      <div className="syncro-display">
        {mode === 'compass' && (
          <SyncroCompassMode 
            matrix={data.matrix}
            activeHour={activeHour}
            compassDegree={compassDegree}
            orientationGranted={orientationGranted}
            onRequestPermission={requestOrientationPermission}
          />
        )}
        
        {mode === 'ar' && (
          <SyncroARMode 
            matrix={data.matrix}
            activeHour={activeHour}
            compassDegree={compassDegree}
            cameraGranted={cameraGranted}
            onRequestCamera={requestCameraPermission}
          />
        )}
        
        {mode === 'map' && (
          <SyncroMapMode 
            matrix={data.matrix}
            activeHour={activeHour}
            activeDirection={activeDirection}
            onSelectDirection={setActiveDirection}
          />
        )}
      </div>
      
      {/* 底部 Compass | Map 切换(AR 不在 tab) */}
      <ModeToggle 
        mode={mode === 'ar' ? 'compass' : mode}  // AR 时仍显示 Compass 选中
        onChange={(newMode) => {
          if (newMode === 'compass' && mode === 'ar') {
            // 用户主动从 AR 切回 Compass,需要平放
            // 这里直接切,用户姿势会被自动检测
          }
          setMode(newMode);
        }}
      />
    </div>
  );
}
```

## Step 6.2: 权限持久化

文件:`lib/syncro/permissions.ts`(新建)

```typescript
const PERMISSION_KEY = 'pojulife_syncro_permissions';

export interface SyncroPermissions {
  orientation: boolean;
  camera: boolean;
  granted_at?: number;
}

export async function loadSyncroPermission(): Promise<SyncroPermissions> {
  if (typeof localStorage === 'undefined') {
    return { orientation: false, camera: false };
  }
  
  try {
    const raw = localStorage.getItem(PERMISSION_KEY);
    if (!raw) return { orientation: false, camera: false };
    
    const data = JSON.parse(raw);
    return {
      orientation: !!data.orientation,
      camera: !!data.camera,
      granted_at: data.granted_at
    };
  } catch {
    return { orientation: false, camera: false };
  }
}

export async function saveSyncroPermission(
  type: 'orientation' | 'camera',
  granted: boolean
): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  
  try {
    const current = await loadSyncroPermission();
    const next: SyncroPermissions = {
      ...current,
      [type]: granted,
      granted_at: Date.now()
    };
    localStorage.setItem(PERMISSION_KEY, JSON.stringify(next));
  } catch (e) {
    console.error('save permission failed', e);
  }
}
```

## Step 6.3: HourProgressBar 组件

文件:`components/syncro/HourProgressBar.tsx`(新建)

```tsx
'use client';

import { useTranslations } from 'next-intl';

interface Props {
  matrix: Record<string, any>;
  activeHour: string;
  onSelect: (hourId: string) => void;
  progress?: {
    completed_batches: number;
    total_batches: number;
  };
}

const HOUR_PERIODS = [
  { id: 'zi',   name_zh: '子', name_en: 'Zi',   range: '23:00–01:00' },
  { id: 'chou', name_zh: '丑', name_en: 'Chou', range: '01:00–03:00' },
  { id: 'yin',  name_zh: '寅', name_en: 'Yin',  range: '03:00–05:00' },
  { id: 'mao',  name_zh: '卯', name_en: 'Mao',  range: '05:00–07:00' },
  { id: 'chen', name_zh: '辰', name_en: 'Chen', range: '07:00–09:00' },
  { id: 'si',   name_zh: '巳', name_en: 'Si',   range: '09:00–11:00' },
  { id: 'wu',   name_zh: '午', name_en: 'Wu',   range: '11:00–13:00' },
  { id: 'wei',  name_zh: '未', name_en: 'Wei',  range: '13:00–15:00' },
  { id: 'shen', name_zh: '申', name_en: 'Shen', range: '15:00–17:00' },
  { id: 'you',  name_zh: '酉', name_en: 'You',  range: '17:00–19:00' },
  { id: 'xu',   name_zh: '戌', name_en: 'Xu',   range: '19:00–21:00' },
  { id: 'hai',  name_zh: '亥', name_en: 'Hai',  range: '21:00–23:00' }
];

export function HourProgressBar({ matrix, activeHour, onSelect, progress }: Props) {
  const t = useTranslations('syncro.hour');
  const now = new Date();
  const currentHourPeriod = getCurrentHourPeriodId(now);
  
  // 接下来 12 个时辰(从当前开始)
  const startIdx = HOUR_PERIODS.findIndex(p => p.id === currentHourPeriod);
  const sortedPeriods = [
    ...HOUR_PERIODS.slice(startIdx),
    ...HOUR_PERIODS.slice(0, startIdx)
  ];
  
  const activeIdx = sortedPeriods.findIndex(p => p.id === activeHour);
  const active = sortedPeriods[activeIdx] || sortedPeriods[0];
  
  // 计算每个时辰的状态
  function getStatus(hourIdx: number): 'now' | 'done' | 'generating' | 'pending' {
    if (hourIdx === 0) return 'now';
    
    // 判断该时辰的所有 8 方位 LLM 是否完成
    const period = sortedPeriods[hourIdx];
    const cells = Object.keys(matrix).filter(k => k.startsWith(`${period.id}__`));
    
    if (cells.length === 0) return 'pending';
    
    const allDone = cells.every(k => matrix[k] && !matrix[k].llm_pending);
    const someDone = cells.some(k => matrix[k] && !matrix[k].llm_pending);
    
    if (allDone) return 'done';
    if (someDone) return 'generating';
    return 'pending';
  }
  
  return (
    <div className="hour-progress-bar">
      <div className="hour-track">
        <div className="hour-line" />
        {sortedPeriods.map((period, idx) => {
          const status = getStatus(idx);
          const isActive = period.id === activeHour;
          
          return (
            <button
              key={period.id}
              className={`hour-dot status-${status} ${isActive ? 'selected' : ''}`}
              onClick={() => onSelect(period.id)}
              aria-label={`${period.name_zh} · ${period.range}`}
            />
          );
        })}
      </div>
      
      {/* 当前显示时辰名 */}
      <div className="hour-display">
        <span className={`hour-name ${activeIdx === 0 ? 'is-now' : ''}`}>
          {active.name_zh}
        </span>
        <span className="hour-divider">·</span>
        <span className={`hour-range ${activeIdx === 0 ? 'is-now' : ''}`}>
          {active.range}
        </span>
        {activeIdx === 0 && (
          <>
            <span className="hour-divider is-now">·</span>
            <span className="hour-now-tag">NOW</span>
          </>
        )}
      </div>
    </div>
  );
}

function getCurrentHourPeriodId(date: Date): string {
  const hour = date.getHours();
  if (hour >= 23 || hour < 1) return 'zi';
  if (hour < 3) return 'chou';
  if (hour < 5) return 'yin';
  if (hour < 7) return 'mao';
  if (hour < 9) return 'chen';
  if (hour < 11) return 'si';
  if (hour < 13) return 'wu';
  if (hour < 15) return 'wei';
  if (hour < 17) return 'shen';
  if (hour < 19) return 'you';
  if (hour < 21) return 'xu';
  return 'hai';
}
```

## Step 6.4: 进度条样式

```css
.hour-progress-bar {
  padding: 14px 18px 8px;
}

.hour-track {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 24px;
  padding: 0 6px;
}

.hour-line {
  position: absolute;
  top: 50%;
  left: 6px;
  right: 6px;
  height: 0.5px;
  background: var(--pj-divider);
}

.hour-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--pj-text-disabled);
  position: relative;
  z-index: 2;
  cursor: pointer;
  transition: all var(--pj-duration-fast) var(--pj-ease);
  padding: 0;
}

.hour-dot.status-done {
  background: var(--pj-teal);
  opacity: 0.7;
}

.hour-dot.status-generating {
  background: var(--pj-teal);
  opacity: 0.4;
  animation: pj-pulse 1.5s infinite ease-in-out;
}

.hour-dot.status-pending {
  background: var(--pj-text-disabled);
}

.hour-dot.status-now {
  width: 9px;
  height: 9px;
  background: var(--pj-gold);
  box-shadow: 0 0 16px var(--pj-gold-glow);
}

.hour-dot.selected:not(.status-now) {
  outline: 2px solid var(--pj-gold);
  outline-offset: 3px;
}

.hour-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 14px;
  font-size: var(--pj-text-xs);
  color: var(--pj-text-secondary);
  letter-spacing: 0.3px;
}

.hour-name,
.hour-range {
  color: var(--pj-text-secondary);
}

.hour-name.is-now,
.hour-range.is-now {
  color: var(--pj-gold);
  font-weight: var(--pj-weight-medium);
}

.hour-divider {
  color: var(--pj-text-muted);
}

.hour-divider.is-now {
  color: var(--pj-gold);
}

.hour-now-tag {
  font-size: 10px;
  color: var(--pj-gold);
  letter-spacing: 1.2px;
  font-weight: var(--pj-weight-medium);
}

@keyframes pj-pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.15); }
}
```

## 验证清单

```
□ SyncroMainView 三模式架构
□ 平放/竖起姿势自动切换 Compass ↔ AR
□ 底部只有 2 个 tab(Compass / Map)
□ HourProgressBar 4 状态(now/done/generating/pending)
□ NOW 只在时辰名时间段显示(金色),不在点上方
□ 用户点击时辰点切换
□ 权限持久化到 localStorage

🛑 等用户确认进入 Step 7
```

---

# 第 7 部分:Step 7 - Compass 模式(粒子上移 + 随动)

## Step 7.1: SyncroCompassMode

文件:`components/syncro/SyncroCompassMode.tsx`(重写)

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SyncroParticleCircle } from './SyncroParticleCircle';
import { WhyThisCurrentModal } from './WhyThisCurrentModal';
import { compassDegreeToDirection, type DirectionId } from '@/lib/syncro/current-system';

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
  
  // 根据当前方向决定显示哪个 cell
  const currentDirection: DirectionId = compassDegreeToDirection(compassDegree);
  const cellKey = `${activeHour}__${currentDirection}`;
  const cell = matrix[cellKey];
  
  if (!orientationGranted) {
    return (
      <div className="compass-permission-needed">
        <div className="permission-icon">
          <i className="ti ti-compass" />
        </div>
        <h3>{t('compass.permission_title')}</h3>
        <p>{t('compass.permission_description')}</p>
        <button className="permission-btn" onClick={onRequestPermission}>
          {t('compass.grant_access')}
        </button>
      </div>
    );
  }
  
  if (!cell) {
    return <div className="compass-loading"><i className="ti ti-loader-2" /></div>;
  }
  
  return (
    <div className="compass-mode">
      {/* 粒子圆(上移 + 旋转随动) */}
      <div className="particle-container">
        <SyncroParticleCircle 
          rotation={-compassDegree}  // 反向旋转,让方位字固定显示
          activeDirection={currentDirection}
        />
        
        {/* 中心信息 */}
        <div className="center-info">
          <div className={`current-level pj-text-${cell.current_level.replace('_current', '').replace('_', '-')}`}>
            <div className="level-line">{getLevelTitle(cell.current_level, t)}</div>
          </div>
          
          <div className="cell-meta">
            <span>{getDirectionName(currentDirection, t)}</span>
            <span className="meta-divider">·</span>
            <span>{getHourMetaText(activeHour, t)}</span>
          </div>
        </div>
      </div>
      
      {/* 下方文字 + Why 按钮 */}
      <div className="compass-footer">
        <p className="short-advice">{cell.short_advice}</p>
        
        <button 
          className="why-btn"
          onClick={() => setWhyModalOpen(true)}
        >
          {t('why_this_current')}
        </button>
      </div>
      
      {/* Why this current Modal */}
      {whyModalOpen && (
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

function getLevelTitle(level: string, t: any) {
  const map: Record<string, string> = {
    'open_current': t('levels.open'),
    'following_current': t('levels.following'),
    'stillwater': t('levels.still'),
    'crosscurrent': t('levels.cross'),
    'undertow': t('levels.under')
  };
  return map[level] || level;
}
```

## Step 7.2: SyncroParticleCircle(随动)

文件:`components/syncro/SyncroParticleCircle.tsx`(重写)

```tsx
'use client';

import { useEffect, useRef } from 'react';
import Spline from '@splinetool/react-spline';

interface Props {
  rotation: number;     // 度,负值表示反向旋转
  activeDirection: string;
}

export function SyncroParticleCircle({ rotation, activeDirection }: Props) {
  const splineRef = useRef<any>(null);
  
  // 当 rotation 变化时,旋转 Spline 模型
  useEffect(() => {
    if (!splineRef.current) return;
    
    const spline = splineRef.current;
    const compassGroup = spline.findObjectByName('CompassGroup') 
      || spline.findObjectByName('Particles')
      || spline.findObjectByName('Root');
    
    if (compassGroup) {
      // 平滑旋转(避免抖动)
      const targetRotation = (rotation * Math.PI) / 180;
      compassGroup.rotation.z = targetRotation;
    }
  }, [rotation]);
  
  function handleLoad(spline: any) {
    splineRef.current = spline;
  }
  
  return (
    <div className="particle-circle">
      <Spline 
        scene="/spline/syncro-compass.splinecode"
        onLoad={handleLoad}
      />
      
      {/* 方位字标(8 方位,固定屏幕显示) */}
      <DirectionLabels 
        rotation={rotation}
        activeDirection={activeDirection}
      />
    </div>
  );
}

function DirectionLabels({ rotation, activeDirection }: { 
  rotation: number; 
  activeDirection: string;
}) {
  const directions = [
    { id: 'N', label: 'N', angle: 0 },
    { id: 'NE', label: 'NE', angle: 45 },
    { id: 'E', label: 'E', angle: 90 },
    { id: 'SE', label: 'SE', angle: 135 },
    { id: 'S', label: 'S', angle: 180 },
    { id: 'SW', label: 'SW', angle: 225 },
    { id: 'W', label: 'W', angle: 270 },
    { id: 'NW', label: 'NW', angle: 315 }
  ];
  
  return (
    <div className="direction-labels">
      {directions.map(dir => {
        // 计算每个方位字在屏幕上的位置(根据 rotation)
        const angleOnScreen = dir.angle + rotation;
        const rad = (angleOnScreen * Math.PI) / 180;
        const radius = 130; // 距中心的距离
        const x = Math.sin(rad) * radius;
        const y = -Math.cos(rad) * radius;
        
        return (
          <span 
            key={dir.id}
            className={`dir-label ${dir.id === activeDirection ? 'active' : ''}`}
            style={{
              transform: `translate(${x}px, ${y}px)`
            }}
          >
            {dir.label}
          </span>
        );
      })}
    </div>
  );
}
```

## Step 7.3: Compass 样式

```css
.compass-mode {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: 8px;
}

.particle-container {
  position: relative;
  width: 100%;
  margin: 0 auto;
  /* ⭐ 上移:粒子圆位置 */
  margin-top: 20px;
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.particle-circle {
  width: 260px;
  height: 260px;
  position: relative;
}

.center-info {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
  width: 80%;
}

.current-level {
  font-size: var(--pj-text-lg);
  font-weight: var(--pj-weight-medium);
  letter-spacing: 0.2px;
  line-height: var(--pj-leading-tight);
}

.level-line {
  margin: 4px 0;
}

.cell-meta {
  font-size: 10px;
  color: var(--pj-text-tertiary);
  margin-top: 12px;
  letter-spacing: 0.3px;
  display: flex;
  justify-content: center;
  gap: 6px;
}

.meta-divider {
  color: var(--pj-text-muted);
}

.direction-labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.dir-label {
  position: absolute;
  top: 50%;
  left: 50%;
  font-size: var(--pj-text-xs);
  color: var(--pj-text-muted);
  letter-spacing: 1.5px;
  font-weight: var(--pj-weight-medium);
  transition: color var(--pj-duration-normal) var(--pj-ease);
}

.dir-label.active {
  color: var(--pj-gold);
  font-size: var(--pj-text-sm);
}

.compass-footer {
  margin-top: 24px;
  padding: 0 32px;
  text-align: center;
}

.short-advice {
  font-size: var(--pj-text-sm);
  color: var(--pj-text-primary);
  line-height: var(--pj-leading-relaxed);
  margin: 0 0 16px;
}

.why-btn {
  display: inline-block;
  padding: 8px 18px;
  background: rgba(212, 165, 116, 0.08);
  color: var(--pj-gold);
  font-family: inherit;
  font-size: 10px;
  letter-spacing: 0.3px;
  border-radius: var(--pj-radius-pill);
  cursor: pointer;
  transition: background var(--pj-duration-fast) var(--pj-ease);
}

.why-btn:active {
  background: rgba(212, 165, 116, 0.15);
}

/* 权限请求页 */
.compass-permission-needed {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 60px 32px;
  height: 100%;
}

.permission-icon {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: rgba(212, 165, 116, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.permission-icon i {
  font-size: 32px;
  color: var(--pj-gold);
}

.compass-permission-needed h3 {
  font-size: var(--pj-text-lg);
  font-weight: var(--pj-weight-medium);
  margin: 0 0 8px;
}

.compass-permission-needed p {
  font-size: var(--pj-text-sm);
  color: var(--pj-text-tertiary);
  line-height: var(--pj-leading-normal);
  margin: 0 0 24px;
}

.permission-btn {
  padding: 14px 32px;
  background: linear-gradient(135deg, var(--pj-gold), var(--pj-gold-soft));
  color: var(--pj-bg-deep);
  font-family: inherit;
  font-size: var(--pj-text-base);
  font-weight: var(--pj-weight-medium);
  border-radius: var(--pj-radius-pill);
  cursor: pointer;
}
```

## 验证清单

```
□ 粒子圆上移到屏幕上 1/3
□ 粒子圆随手机转动旋转(rotation 反向)
□ 方位字位置随转动
□ 当前指向方位高亮(金色)
□ 中心显示等级 + 方位 + 时辰
□ 无 border
□ Why this current 按钮

🛑 等用户确认进入 Step 8
```

---

# 第 8 部分:Step 8 - AR 模式(摄像头上半 + 文字下半)

## Step 8.1: SyncroARMode

文件:`components/syncro/SyncroARMode.tsx`(重写)

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { WhyThisCurrentModal } from './WhyThisCurrentModal';
import { compassDegreeToDirection } from '@/lib/syncro/current-system';

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
  const [streamReady, setStreamReady] = useState(false);
  const [whyModalOpen, setWhyModalOpen] = useState(false);
  
  const currentDirection = compassDegreeToDirection(compassDegree);
  const cell = matrix[`${activeHour}__${currentDirection}`];
  
  useEffect(() => {
    if (cameraGranted) {
      startCamera();
    }
    return () => stopCamera();
  }, [cameraGranted]);
  
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreamReady(true);
      }
    } catch (e) {
      console.error('camera start failed', e);
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
    return (
      <div className="ar-permission-needed">
        <div className="permission-icon">
          <i className="ti ti-camera" />
        </div>
        <h3>{t('ar.permission_title')}</h3>
        <p>{t('ar.permission_description')}</p>
        <button className="permission-btn" onClick={onRequestCamera}>
          {t('ar.grant_access')}
        </button>
      </div>
    );
  }
  
  if (!cell) {
    return <div className="ar-loading"><i className="ti ti-loader-2" /></div>;
  }
  
  return (
    <div className="ar-mode">
      {/* 上半:摄像头(占 45%)*/}
      <div className="ar-camera-section">
        <video 
          ref={videoRef}
          className="ar-video"
          playsInline
          muted
          autoPlay
        />
        
        {/* 粒子环绕摄像头(随动)*/}
        <div className="ar-particles">
          <div className="ar-particle-ring" style={{
            transform: `rotate(${-compassDegree}deg)`
          }} />
        </div>
        
        {/* 方位指示 */}
        <div className="ar-direction-badge">
          {currentDirection}
        </div>
      </div>
      
      {/* 下半:文字内容(黑底)*/}
      <div className="ar-content-section">
        <div className={`current-level pj-text-${cell.current_level.replace('_current', '').replace('_', '-')}`}>
          {getLevelTitle(cell.current_level, t)}
        </div>
        
        <div className="cell-meta">
          <span>{currentDirection}</span>
          <span className="meta-divider">·</span>
          <span>{getHourMetaText(activeHour, t)}</span>
        </div>
        
        <p className="short-advice">{cell.short_advice}</p>
        
        <button className="why-btn" onClick={() => setWhyModalOpen(true)}>
          {t('why_this_current')}
        </button>
      </div>
      
      {whyModalOpen && (
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
```

## Step 8.2: AR 样式

```css
.ar-mode {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ar-camera-section {
  position: relative;
  width: 100%;
  flex: 0 0 45%;
  overflow: hidden;
}

.ar-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ar-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ar-particle-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  transform-origin: center;
  background: radial-gradient(circle at center,
    transparent 35%,
    rgba(212, 165, 116, 0.15) 50%,
    transparent 70%);
  border-radius: 50%;
}

.ar-direction-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 6px 14px;
  background: rgba(7, 9, 26, 0.7);
  backdrop-filter: blur(20px);
  border-radius: var(--pj-radius-pill);
  color: var(--pj-gold);
  font-size: var(--pj-text-sm);
  font-weight: var(--pj-weight-medium);
  letter-spacing: 1px;
}

.ar-content-section {
  flex: 1;
  padding: 28px 24px 24px;
  display: flex;
  flex-direction: column;
  text-align: center;
  background: linear-gradient(180deg, 
    var(--pj-bg-deep) 0%, 
    var(--pj-bg-mid) 100%);
}

.ar-content-section .current-level {
  font-size: var(--pj-text-xl);
  font-weight: var(--pj-weight-medium);
  line-height: var(--pj-leading-tight);
}

.ar-content-section .cell-meta {
  margin-top: 10px;
  font-size: var(--pj-text-xs);
}

.ar-content-section .short-advice {
  margin-top: 20px;
  font-size: var(--pj-text-base);
  color: var(--pj-text-primary);
  line-height: var(--pj-leading-relaxed);
}

.ar-content-section .why-btn {
  margin-top: 20px;
  display: inline-block;
  align-self: center;
}
```

## 验证清单

```
□ 上半摄像头(45% 高度)
□ 下半文字(黑底渐变)
□ 摄像头权限请求
□ 摄像头停止/启动
□ 粒子环绕(随转)
□ 方位 badge(右上角)
□ 文字在下半清晰可读

🛑 等用户确认进入 Step 9
```

---

# 第 9 部分:Step 9 - MAP 模式(圆 + 8 方位点)

## Step 9.1: SyncroMapMode

文件:`components/syncro/SyncroMapMode.tsx`(全新)

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { WhyThisCurrentModal } from './WhyThisCurrentModal';
import type { DirectionId } from '@/lib/syncro/current-system';

interface Props {
  matrix: Record<string, any>;
  activeHour: string;
  activeDirection: DirectionId;
  onSelectDirection: (dir: DirectionId) => void;
}

const DIRECTIONS_ON_CIRCLE: Array<{ id: DirectionId; angle: number; name_en: string }> = [
  { id: 'N',  angle: 0,   name_en: 'N' },
  { id: 'NE', angle: 45,  name_en: 'NE' },
  { id: 'E',  angle: 90,  name_en: 'E' },
  { id: 'SE', angle: 135, name_en: 'SE' },
  { id: 'S',  angle: 180, name_en: 'S' },
  { id: 'SW', angle: 225, name_en: 'SW' },
  { id: 'W',  angle: 270, name_en: 'W' },
  { id: 'NW', angle: 315, name_en: 'NW' }
];

export function SyncroMapMode({ 
  matrix, 
  activeHour, 
  activeDirection, 
  onSelectDirection 
}: Props) {
  const t = useTranslations('syncro');
  const [whyModalOpen, setWhyModalOpen] = useState(false);
  
  const activeCell = matrix[`${activeHour}__${activeDirection}`];
  const RADIUS = 110;  // 点距中心的像素距离
  
  return (
    <div className="map-mode">
      <div className="map-container">
        <div className="map-circle">
          {/* 粒子线条圈(虚线圆)*/}
          <div className="map-ring" />
          
          {/* 8 个方位点 */}
          {DIRECTIONS_ON_CIRCLE.map(dir => {
            const cell = matrix[`${activeHour}__${dir.id}`];
            const rad = (dir.angle * Math.PI) / 180;
            const x = Math.sin(rad) * RADIUS;
            const y = -Math.cos(rad) * RADIUS;
            
            const isActive = dir.id === activeDirection;
            const level = cell?.current_level || 'stillwater';
            
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
          
          {/* 8 个方位字标(在点外侧)*/}
          {DIRECTIONS_ON_CIRCLE.map(dir => {
            const rad = (dir.angle * Math.PI) / 180;
            const labelRadius = RADIUS + 24;
            const x = Math.sin(rad) * labelRadius;
            const y = -Math.cos(rad) * labelRadius;
            
            const cell = matrix[`${activeHour}__${dir.id}`];
            const isActive = dir.id === activeDirection;
            
            return (
              <span
                key={`label-${dir.id}`}
                className={`map-dir-label ${isActive ? 'active' : ''}`}
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
                }}
              >
                {dir.name_en}
              </span>
            );
          })}
          
          {/* 中心信息卡 */}
          <div className="map-center-card">
            <div className="map-center-direction">{activeDirection}</div>
            {activeCell && (
              <>
                <div className={`map-center-level pj-text-${activeCell.current_level.replace('_current', '').replace('_', '-')}`}>
                  {getLevelTitle(activeCell.current_level, t)}
                </div>
                <div className="map-center-meta">
                  {getHourMetaText(activeHour, t)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* 下方文字 */}
      <div className="map-footer">
        {activeCell && (
          <>
            <p className="short-advice">{activeCell.short_advice}</p>
            <button className="why-btn" onClick={() => setWhyModalOpen(true)}>
              {t('why_this_current')}
            </button>
          </>
        )}
        <div className="map-hint">{t('map.tap_hint')}</div>
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
```

## Step 9.2: MAP 样式

```css
.map-mode {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: 8px;
}

.map-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
  /* ⭐ 上移 */
  margin-top: 10px;
}

.map-circle {
  position: relative;
  width: 260px;
  height: 260px;
}

.map-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle at center,
    transparent 50%,
    rgba(212, 165, 116, 0.08) 65%,
    transparent 80%);
}

.map-ring::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: 
    repeating-conic-gradient(
      from 0deg,
      rgba(212, 165, 116, 0.2) 0deg 2deg,
      transparent 2deg 22.5deg
    );
  -webkit-mask: radial-gradient(
    circle at center,
    transparent 105px,
    black 106px,
    black 110px,
    transparent 111px
  );
  mask: radial-gradient(
    circle at center,
    transparent 105px,
    black 106px,
    black 110px,
    transparent 111px
  );
}

.map-point {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--pj-text-disabled);
  cursor: pointer;
  transition: all var(--pj-duration-fast) var(--pj-ease);
  padding: 0;
  z-index: 3;
}

.map-point.status-open {
  background: var(--pj-open);
  box-shadow: 0 0 12px rgba(0, 217, 184, 0.5);
}

.map-point.status-following {
  background: var(--pj-following);
  opacity: 0.8;
}

.map-point.status-stillwater {
  background: var(--pj-still);
  opacity: 0.6;
}

.map-point.status-crosscurrent {
  background: var(--pj-cross);
  box-shadow: 0 0 8px rgba(232, 159, 77, 0.4);
}

.map-point.status-undertow {
  background: var(--pj-under);
  box-shadow: 0 0 8px rgba(200, 90, 90, 0.4);
}

.map-point.active {
  width: 14px;
  height: 14px;
  background: var(--pj-gold);
  box-shadow: 0 0 20px var(--pj-gold-glow);
  z-index: 4;
}

.map-dir-label {
  position: absolute;
  top: 50%;
  left: 50%;
  font-size: 10px;
  color: var(--pj-text-muted);
  letter-spacing: 1.5px;
  font-weight: var(--pj-weight-medium);
  transition: color var(--pj-duration-normal) var(--pj-ease);
  pointer-events: none;
}

.map-dir-label.active {
  color: var(--pj-gold);
  font-size: 11px;
}

.map-center-card {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  width: 80%;
  pointer-events: none;
}

.map-center-direction {
  font-size: 10px;
  color: var(--pj-gold);
  letter-spacing: 2px;
  font-weight: var(--pj-weight-medium);
  margin-bottom: 6px;
}

.map-center-level {
  font-size: var(--pj-text-lg);
  font-weight: var(--pj-weight-medium);
  line-height: var(--pj-leading-tight);
}

.map-center-meta {
  font-size: 10px;
  color: var(--pj-text-tertiary);
  margin-top: 10px;
}

.map-footer {
  margin-top: 30px;
  padding: 0 32px;
  text-align: center;
}

.map-hint {
  font-size: 10px;
  color: var(--pj-text-muted);
  margin-top: 14px;
  letter-spacing: 0.5px;
}
```

## 验证清单

```
□ 圆 + 8 方位点
□ 点颜色对应 5 等级
□ 当前选中点金色大号
□ 方位字标(N/NE/E/...)
□ 中心显示当前方位 + 等级 + 时辰
□ 点击点 → 中心切换
□ 不随手机转动(纯触屏)
□ 与 Compass 视觉一致

🛑 等用户确认进入 Step 10
```

---

# 第 10 部分:Step 10 - Why-This-Current Modal

文件:`components/syncro/WhyThisCurrentModal.tsx`(新建)

```tsx
'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  cell: any;
  direction: string;
  hourId: string;
  onClose: () => void;
}

export function WhyThisCurrentModal({ cell, direction, hourId, onClose }: Props) {
  const t = useTranslations('syncro');
  
  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  
  return (
    <div className="why-modal-overlay" onClick={onClose}>
      <div className="why-modal" onClick={(e) => e.stopPropagation()}>
        <button 
          className="why-modal-close" 
          onClick={onClose}
          aria-label="Close"
        >
          <i className="ti ti-x" />
        </button>
        
        {/* 顶部标签 */}
        <div className="why-modal-tag">
          {t('why_this_current')}
        </div>
        
        {/* 等级 */}
        <div className={`why-level pj-text-${cell.current_level.replace('_current', '').replace('_', '-')}`}>
          {getLevelTitle(cell.current_level, t)}
        </div>
        
        {/* 元信息 */}
        <div className="why-meta">
          <span>{getDirectionName(direction, t)}</span>
          <span className="meta-divider">·</span>
          <span>{getHourMetaText(hourId, t)}</span>
        </div>
        
        <div className="why-divider" />
        
        {/* Rationale */}
        <div className="why-rationale">
          {cell.rationale || cell.detailed_advice}
        </div>
        
        {/* 行动建议 */}
        {cell.detailed_advice && cell.rationale && (
          <div className="why-action-card">
            <i className="ti ti-bulb" />
            <span>{cell.detailed_advice}</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

样式:

```css
.why-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: pj-fade-in var(--pj-duration-fast);
}

.why-modal {
  position: relative;
  width: 100%;
  max-width: 380px;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--pj-bg-elevated);
  border-radius: var(--pj-radius-xl);
  padding: 32px 24px 24px;
  animation: pj-modal-pop var(--pj-duration-normal) var(--pj-ease-spring);
}

.why-modal-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--pj-text-secondary);
  cursor: pointer;
  transition: background var(--pj-duration-fast) var(--pj-ease);
}

.why-modal-close:active {
  background: rgba(255, 255, 255, 0.12);
}

.why-modal-close i {
  font-size: 14px;
}

.why-modal-tag {
  font-size: 10px;
  color: var(--pj-gold);
  letter-spacing: 1.5px;
  font-weight: var(--pj-weight-medium);
  text-transform: uppercase;
  margin-bottom: 12px;
}

.why-level {
  font-size: var(--pj-text-xl);
  font-weight: var(--pj-weight-medium);
  line-height: var(--pj-leading-tight);
  margin-bottom: 8px;
}

.why-meta {
  display: flex;
  gap: 8px;
  font-size: var(--pj-text-sm);
  color: var(--pj-text-tertiary);
}

.why-divider {
  height: 0.5px;
  background: var(--pj-divider);
  margin: 18px 0;
}

.why-rationale {
  font-size: var(--pj-text-sm);
  color: var(--pj-text-primary);
  line-height: var(--pj-leading-relaxed);
}

.why-action-card {
  margin-top: 18px;
  padding: 14px;
  background: rgba(212, 165, 116, 0.08);
  border-radius: var(--pj-radius-md);
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.why-action-card i {
  color: var(--pj-gold);
  font-size: 18px;
  margin-top: 2px;
}

.why-action-card span {
  font-size: var(--pj-text-sm);
  color: var(--pj-gold);
  line-height: var(--pj-leading-normal);
}

@keyframes pj-modal-pop {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

## 验证清单

```
□ 居中弹层
□ 背景模糊 + 黑色 overlay
□ X 关闭
□ 点击外部关闭
□ ESC 键关闭
□ 字号合理(12-18px)
□ 时辰 + 时间段完整显示
□ 命理依据展开
□ 行动建议(金色 left 卡片)

🛑 等用户确认进入 Step 11
```

---

# 第 11 部分:Step 11 - PWA 内产品 Hero 极简化

```
任务:让 4 个产品页(/poju, /glyph, /syncro, /match)在 PWA 内只显示 Hero + Begin

实施:

每个产品页(如 /syncro/page.tsx)的内容包裹一个 component:

<PWAOrMarketing>
  <Hero ... />  ← 现有 Hero 组件,完全复用,不改
  
  <NotPWAMarketingContent>  ← PWA 中不显示
    <Features />
    <HowItWorks />
    <FAQ />
    <Pricing />
  </NotPWAMarketingContent>
  
  <PWAOnlyCTA>  ← 只在 PWA 显示
    <BeginButton 
      productId="syncro"
      isFirstFree={firstFree}
      price="$4.99"
    />
  </PWAOnlyCTA>
</PWAOrMarketing>

逻辑:
  if (isPWA) {
    显示 Hero + Begin 按钮
    隐藏所有 Marketing 内容
  } else {
    显示完整页面
  }

### Syncro PWA：24 小时内解读的本地保存（实现说明）

Syncro **仅手机/PWA** 使用。离开 Syncro 再回来不应「从头开始」——数据不在服务端会话里，而在本机：

| 存储 | 内容 | 有效期 |
|------|------|--------|
| IndexedDB `syncro_sessions` | 加密完整 matrix + 任务文案 | 创建后 **24 小时** |
| `sessionStorage.syncro_last_session_id` | 最近一次 session id（列表兜底） | 浏览器标签会话 |
| Archive `type: syncro_task` | 摘要 + 跳转 `syncro_session_id` | 同 24h 窗口 |

**PWA `/syncro` 首页 UI（`SyncroPwaHomeFooter`）：**

1. **继续上次解读** — 大按钮，读 IndexedDB 最近未过期 session → `/syncro/result/{id}`
2. **24 小时内的解读** — 列表（多条时显示；单条时仅大按钮）
3. **Begin** — 明确 **新解读**（`/syncro/task?…&new=1`）
4. 文案提示：数据在本机，切换 POJU 等功能后可回来继续

**勿**把最近列表放在 `<NotPWA>` 内（PWA 下整块不渲染）。实现文件：`components/syncro/SyncroPwaHomeFooter.tsx`、`SyncroPwaContinuePrimary.tsx`、`lib/syncro/syncro-session-summary.ts`。

### Syncro 后台 LLM（离开页面仍继续）

- 进罗盘后 `POST /api/syncro/inngest_start` 按批次 **fan-out** 多条 `syncro/generate-batch` 事件（每批 1 次 LLM，**每次 Inngest 调用独立 ≤300s**，避免旧版 `generate-all` 单次跑满 300s）。
- 文案与进度写入 **Upstash KV**；客户端轮询 `/api/syncro/status` 合并进 IndexedDB。
- 用户锁屏/切 App 后云端仍跑；**2 小时后回来**打开 `/syncro/result/{id}` 或首页「继续上次」应看到 12/12（若队列未失败）。
- 依赖：`INNGEST_EVENT_KEY`、KV、Inngest 与 Vercel `/api/inngest` 已注册 `syncroGenerateBatch`。

代码:
```

```typescript
// components/pwa/PWAConditional.tsx

'use client';

import { useEffect, useState } from 'react';
import { detectDeviceCapability } from '@/lib/syncro/device-capability';

export function PWAOnly({ children }: { children: React.ReactNode }) {
  const [isPWA, setIsPWA] = useState<boolean | null>(null);
  
  useEffect(() => {
    detectDeviceCapability().then(cap => setIsPWA(cap.isPWA));
  }, []);
  
  if (isPWA === null) return null;
  return isPWA ? <>{children}</> : null;
}

export function NotPWA({ children }: { children: React.ReactNode }) {
  const [isPWA, setIsPWA] = useState<boolean | null>(null);
  
  useEffect(() => {
    detectDeviceCapability().then(cap => setIsPWA(cap.isPWA));
  }, []);
  
  if (isPWA === null) return null;
  return !isPWA ? <>{children}</> : null;
}
```

```typescript
// components/syncro/BeginButton.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

interface Props {
  productId: 'syncro' | 'glyph' | 'match';
  price: string;
  freeFirstTime: boolean;
}

export function BeginButton({ productId, price, freeFirstTime }: Props) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations(`${productId}.begin`);
  const [isFirstTime, setIsFirstTime] = useState(true);
  
  useEffect(() => {
    // 检查用户是否用过这个产品
    checkFirstTime();
  }, []);
  
  async function checkFirstTime() {
    // 从 IndexedDB 查询
    const used = await checkProductUsage(productId);
    setIsFirstTime(!used);
  }
  
  function handleClick() {
    router.push(`/${locale}/${productId}/start`);
  }
  
  const isFree = freeFirstTime && isFirstTime;
  
  return (
    <button className="begin-btn-large" onClick={handleClick}>
      <span className="begin-btn-main">{t('start')}</span>
      <span className="begin-btn-price">
        {isFree ? t('free_first_time') : price}
      </span>
    </button>
  );
}
```

```css
.begin-btn-large {
  width: 80%;
  max-width: 280px;
  padding: 18px 24px;
  background: linear-gradient(135deg, var(--pj-gold) 0%, var(--pj-gold-soft) 100%);
  color: var(--pj-bg-deep);
  font-family: inherit;
  border-radius: var(--pj-radius-lg);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transition: transform var(--pj-duration-fast) var(--pj-ease);
  margin: 32px auto 0;
}

.begin-btn-large:active {
  transform: scale(0.98);
}

.begin-btn-main {
  font-size: var(--pj-text-lg);
  font-weight: var(--pj-weight-medium);
  letter-spacing: 0.2px;
}

.begin-btn-price {
  font-size: var(--pj-text-xs);
  opacity: 0.75;
}
```

## 验证清单

```
□ /poju 在 PWA 中只显示 Hero + Begin
□ /glyph 同上
□ /syncro 同上
□ /match 同上
□ 浏览器/桌面访问仍显示完整页面
□ Begin 按钮显示价格或"Free first time"
□ 点击进入 /start 流程

🛑 等用户确认进入 Step 12
```

---

# 第 12 部分:Step 12 - 端到端测试

## 测试矩阵

```
设备测试:

□ iPhone Safari 浏览器
  ✓ 首次:看到 Before You Enter 提示
  ✓ 接受后:看到 iOS 安装步骤(带 Share / Plus / Check 图标)
  ✓ 安装到主屏幕
  ✓ 从主屏幕图标进入(PWA 模式)
  ✓ 看到底部 nav(EN/A 小,4 个产品)
  ✓ 进入 Syncro 看到 Hero + Begin
  ✓ 完整 Syncro 流程

□ Android Chrome 浏览器
  ✓ 首次:Before You Enter
  ✓ 接受后:看到一键安装按钮(beforeinstallprompt)
  ✓ 一键安装
  ✓ PWA 模式
  ✓ 完整流程

□ PC Mac/Windows
  ✓ 访问 pojulife.com 看到完整 Marketing
  ✓ POJU/Glyph/Match 可用
  ✓ Syncro 显示介绍 + QR 码(原有,不变)

□ iPad
  ✓ 也走 PWA 强制流程

视觉测试(所有设备):

□ 全站无 border 装饰线
□ 玻璃态背景
□ 字体一致(SF Pro / PingFang SC)
□ 渐变背景
□ 5 种状态色
□ NOW 标识只在时辰名(金色)

Syncro 三模式测试:

□ 默认进入 Compass
□ 粒子圆上移
□ 粒子圆随手机转动
□ 平放 → Compass
□ 竖起 → AR(摄像头授权后)
□ 摄像头上半,文字下半
□ 底部 Compass | Map 切换(无 AR tab)
□ MAP 模式:圆 + 8 点
□ 点击点切换中心
□ 时辰流式进度条(4 状态)
□ Why this current 居中 Modal
□ 模态字号大

权限测试:

□ 首次进入 → 请求方位权限
□ 同意后保存到 localStorage
□ 后续进入不再弹窗
□ 摄像头同理

性能测试:

□ base_analysis < 60 秒
□ Syncro compute_local < 15 秒
□ 进入 result 页立刻看到 96 等级
□ LLM 文案 1-2 分钟内全部到达
□ 无 Load failed

错误处理:

□ 网络断开 → 友好错误
□ 权限拒绝 → 友好降级
□ LLM 失败 → fallback 文案显示
```

---

# 总结

```
本任务完成后,pojulife 达到的状态:

✅ 设备策略清晰
   - PC 桌面:完整营销 + 功能(Syncro 除外)
   - 手机浏览器:强制 PWA 引导
   - PWA:纯产品,原生 APP 体验

✅ 视觉系统统一
   - Apple 极简
   - 完全无 border
   - 玻璃态 + 渐变
   - 现代感强

✅ Syncro 三模式
   - Compass(默认,粒子上移+随动)
   - AR(姿势自动,摄像头上半)
   - MAP(8 点圆,与 Compass 同视觉)

✅ 性能修复
   - base_analysis 30-60 秒
   - Syncro compute_local 15 秒可用
   - LLM 异步增强
   - 无 Load failed

✅ 时辰流式进度条
   - 4 状态可视化
   - NOW 金色标识

✅ Why-this-current
   - 居中 Modal
   - 字号大
   - 信息完整

✅ PWA 内极简
   - Hero + Begin
   - 介绍内容在 PC 网站
```

---

**Cursor: 完成 Step 1-12 后,pojulife 移动端达到原生 APP 级体验,Apple 极简视觉就绪。**
