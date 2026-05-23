# pojulife 全站 UI 重设计 + 文案对齐 + Match 介绍

> **本指令包含 3 个独立任务**:
> 1. 全站文案自查 + 对齐
> 2. 全站 UI 统一(Spatial Glass 设计语言)
> 3. Match 页面功能介绍设计
>
> **执行原则**:严格【一步一停】,每个任务完成后等用户确认

---

# ⚠️ Cursor 必读

```
本次重构【纯前端 UI 层】,不涉及业务逻辑

设计目标:
  把 pojulife 从"功能可用"升级为"视觉精致"
  
设计语言:
  Spatial Glass(空间毛玻璃)
  灵感:Apple Vision Pro + macOS Big Sur + iOS 17
  
关键技术:
  - backdrop-filter: blur()
  - rgba 半透明背景
  - 大圆角(20-28px)
  - 细微边框
  - 内发光阴影

绝不允许:
  ✗ 改业务逻辑
  ✗ 改 API 调用
  ✗ 改数据库
  ✗ 跨任务实施

每个任务完成后:
  - 贴出截图描述 + 代码片段
  - 等用户明确确认才进入下一任务
```

---

# 任务 1: 全站文案自查 + 对齐

## Step 1.1: 文案现状盘点

```
任务:

遍历所有页面,生成【文案盘点表】:

页面清单:
  ## 营销页(Marketing)
  □ /(首页 Hero)
  □ /poju (POJU 介绍页)
  □ /glyph (Glyph 介绍页)
  □ /syncro (Syncro 介绍页)
  □ /match (Match 介绍页)
  
  ## 法律页(Legal)
  □ /privacy
  □ /terms
  □ /refund-policy
  □ /cookie-policy
  □ /disclaimer
  
  ## 关于(About)
  □ /about (如有)
  □ /contact (如有)
  □ /faq (如有)
  
  ## 操作流程页(Operational)
  □ /poju/session/[id]/prepare
  □ /poju/session/[id]/preparing
  □ /poju/session/[id]/refund
  □ /glyph/prepare
  □ /glyph/draw
  □ /glyph/reading/[id]
  □ /syncro/task
  □ /syncro/location
  □ /syncro/computing
  □ /syncro/result/[id]
  □ /match/select-a
  □ /match/select-b
  □ /match/relationship
  □ /match/analyzing
  □ /match/result/[id]
  
  ## 系统页
  □ /archive
  □ /archive/[id]
  □ /404
  □ /500

对每个页面,列出:
  - 标题 / 副标题
  - 主要文案段落
  - CTA 按钮文字
  - 是否有【未翻译】的 key(显示成 `marketing.subtitle` 等)
  - 是否有【硬编码英文】在中文 messages 中
  - 是否有【明显错别字 / 语法错误】
  - 5 语言(en/zh/es/fr/de)完整度

# 注意

只做【自查报告】,不要立即改。
报告完成后等用户审视。

输出格式:
  Markdown 表格,清晰列出每个页面的问题清单。
```

## Step 1.2: 文案对齐原则(待用户审视报告后实施)

```
共享文案规则:

1. 品牌名规范:
   ✓ POJU(全大写,产品名)
   ✓ Glyph / Syncro / Match(首字母大写)
   ✓ pojulife(平台名,全小写,作为统一品牌伞)
   
   错误示例:
   ✗ poju / Poju / POJULife
   ✗ glyph / GLYPH / GLyph

2. 价格规范:
   ✓ POJU $9.99 per session
   ✓ Glyph $4.99 each (first free)
   ✓ Syncro $4.99 each (first free)
   ✓ Match $4.99 each (first free)

3. 时间表述统一:
   ✓ 30-day window(POJU session)
   ✓ 24-hour live(Syncro)
   ✓ Single reading(Glyph / Match)

4. 语调统一(全站):
   ✓ 玄学专业 + 现代实操
   ✓ 不用"算命"等术语
   ✓ 用"东方智慧"、"传统命理"、"古典推演"
   ✓ 强调【行动可落地】

5. 共享术语翻译表:
   东方破局顾问 = Eastern Breakthrough Counselor
   命主 = Native Chart / Bazi Foundation
   日主 = Day Master
   用神 = Favorable Element
   大运 = Life Phase / 10-Year Cycle
   流年 = Annual Influence
   八卦 = Eight Trigrams
   五行 = Five Elements
   十神 = Ten Gods / Ten Stars

6. CTA 按钮规范:
   ✓ 动词开头:"Start", "Begin", "Continue", "Run", "Try"
   ✗ 不要"Click here", "Press to start"

7. 错误信息规范:
   ✓ 温度 + 解决路径
   "Connection slipped. Try again in a moment."
   ✗ 不要冷冰冰
   "Error 500"

8. 删除 / 修正所有发现的:
   - 翻译 key 未替换(显示成 dot.notation)
   - 语法错误
   - 错别字
   - 大小写不一致
   - 标点不一致(全角 vs 半角)
```

## Step 1.3: 实施(等用户审视报告后)

```
拿到用户认可的【修改清单】后:

1. 按页面顺序修改 messages/*.json
2. 修改后 grep 检查:
   - grep -r "TODO" messages/
   - grep -r "未翻译" messages/
   - grep -r "translate" messages/

3. 每个文件改完 git commit 一次:
   git commit -m "i18n: fix copy for [page name]"

4. 全部完成后,运行:
   pnpm exec tsc --noEmit
   pnpm lint
```

## 验证清单

```
□ 26+ 页面文案盘点完成
□ 5 语言完整度报告
□ 共享术语翻译表对齐
□ 全部 fix 通过编译

🛑 等用户最终确认任务 1 完成
```

---

# 任务 2: 全站 UI 统一(Spatial Glass 设计语言)

## Step 2.1: 设计 Token 系统

文件:`styles/design-tokens.css`(新建)

```css
/* ============= pojulife Spatial Glass Design Tokens ============= */

:root {
  /* ============= 背景层(全站底色)============= */
  --bg-primary: linear-gradient(
    180deg,
    #1a0a2e 0%,           /* 深紫色顶部 */
    #14081f 40%,          /* 中间过渡 */
    #0a0510 100%          /* 几乎纯黑底部 */
  );
  
  /* 备用纯色(用于不支持 gradient 的地方) */
  --bg-primary-solid: #14081f;
  
  /* ============= 卡片层(Glass)============= */
  
  /* 标准毛玻璃卡片(主要内容卡)*/
  --glass-card-bg: rgba(50, 35, 80, 0.4);
  --glass-card-blur: blur(24px);
  --glass-card-border: 1px solid rgba(255, 255, 255, 0.08);
  --glass-card-radius: 24px;
  --glass-card-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  
  /* 强调卡片(用于关键内容,如 Hero 副卡)*/
  --glass-card-bg-elevated: rgba(60, 45, 95, 0.5);
  
  /* 内嵌文本框(像 Notes 那种)*/
  --glass-input-bg: rgba(0, 0, 0, 0.25);
  --glass-input-border: 1px solid rgba(255, 255, 255, 0.06);
  --glass-input-radius: 14px;
  
  /* ============= 导航(胶囊形)============= */
  --glass-nav-bg: rgba(40, 30, 60, 0.5);
  --glass-nav-blur: blur(20px);
  --glass-nav-border: 1px solid rgba(255, 255, 255, 0.08);
  --glass-nav-radius: 999px;
  
  /* ============= 文字 ============= */
  --text-primary: #f5f0ff;          /* 主文字(略带紫调白)*/
  --text-secondary: #b8b0c8;        /* 次要文字 */
  --text-tertiary: #7a7290;         /* 提示文字 */
  --text-muted: #5a5470;            /* 静默文字 */
  
  /* ============= 品牌色 ============= */
  --gold-primary: #D4AF37;          /* POJU 金 */
  --gold-light: #E8C56F;            /* 亮金(hover)*/
  --gold-glow: rgba(212, 175, 55, 0.3);  /* 金色光晕 */
  
  /* ============= 产品色(每个产品有自己的强调色)============= */
  --color-poju: #D4AF37;            /* 金色 - 破局顾问 */
  --color-glyph: #7B68EE;           /* 紫罗兰 - 神秘签文 */
  --color-syncro: #00CED1;          /* 暗青色 - 时空 */
  --color-match: #FF6B9D;           /* 樱粉色 - 关系 */
  
  /* ============= Current 系统(Syncro 用)============= */
  --current-open: #0D7377;
  --current-following: #26A69A;
  --current-still: #90A4AE;
  --current-cross: #F57C00;
  --current-undertow: #C62828;
  
  /* ============= 状态颜色 ============= */
  --color-success: #4caf50;
  --color-warning: #ff9800;
  --color-error: #f44336;
  --color-info: #87CEEB;
  
  /* ============= Spacing(8px 基准)============= */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;
  --space-10: 64px;
  --space-12: 80px;
  
  /* ============= Typography ============= */
  --font-display: 'Inter', 'Noto Sans SC', system-ui, sans-serif;
  --font-body: 'Inter', 'Noto Sans SC', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
  --font-serif: 'Noto Serif SC', 'Cormorant Garamond', serif;  /* 古典签文 */
  
  /* ============= 动效曲线 ============= */
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  
  --duration-fast: 0.15s;
  --duration-base: 0.3s;
  --duration-slow: 0.5s;
}

/* ============= 全局 reset ============= */

* {
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  background: var(--bg-primary);
  background-attachment: fixed;
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.6;
  min-height: 100vh;
}

/* 确保整个 app 都有这个背景 */
html, body, #__next, [data-nextjs-root-layout] {
  min-height: 100vh;
}
```

## Step 2.2: Glass Components(可复用组件)

文件:`components/ui/GlassCard.tsx`(新建)

```typescript
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  variant?: 'standard' | 'elevated' | 'subtle';
  padding?: 'sm' | 'md' | 'lg' | 'none';
  className?: string;
  onClick?: () => void;
}

export function GlassCard({ 
  children, 
  variant = 'standard',
  padding = 'md',
  className,
  onClick
}: GlassCardProps) {
  const variantClass = {
    standard: 'glass-card',
    elevated: 'glass-card-elevated',
    subtle: 'glass-card-subtle'
  }[variant];
  
  const paddingClass = {
    none: '',
    sm: 'glass-padding-sm',
    md: 'glass-padding-md',
    lg: 'glass-padding-lg'
  }[padding];
  
  return (
    <div 
      className={cn('glass-base', variantClass, paddingClass, className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </div>
  );
}
```

文件:`styles/glass.css`(新建)

```css
/* ============= Glass Base ============= */

.glass-base {
  position: relative;
  border-radius: var(--glass-card-radius);
  overflow: hidden;
}

.glass-card {
  background: var(--glass-card-bg);
  backdrop-filter: var(--glass-card-blur);
  -webkit-backdrop-filter: var(--glass-card-blur);
  border: var(--glass-card-border);
  box-shadow: var(--glass-card-shadow);
}

.glass-card-elevated {
  background: var(--glass-card-bg-elevated);
  backdrop-filter: var(--glass-card-blur);
  -webkit-backdrop-filter: var(--glass-card-blur);
  border: var(--glass-card-border);
  box-shadow: 
    0 16px 48px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.glass-card-subtle {
  background: rgba(40, 30, 60, 0.25);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

/* Hover 效果 */
.glass-card[role="button"]:hover,
.glass-card-elevated[role="button"]:hover {
  background: rgba(60, 45, 95, 0.5);
  transform: translateY(-1px);
  transition: all var(--duration-base) var(--ease-smooth);
}

/* Padding */
.glass-padding-sm { padding: var(--space-4); }
.glass-padding-md { padding: var(--space-5); }
.glass-padding-lg { padding: var(--space-6); }

/* ============= Glass Input(像 Notes 那种)============= */

.glass-input {
  width: 100%;
  background: var(--glass-input-bg);
  border: var(--glass-input-border);
  border-radius: var(--glass-input-radius);
  padding: var(--space-3) var(--space-4);
  color: var(--text-primary);
  font: inherit;
  outline: none;
  transition: all var(--duration-fast) var(--ease-smooth);
}

.glass-input:focus {
  background: rgba(0, 0, 0, 0.35);
  border-color: rgba(212, 175, 55, 0.4);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
}

.glass-input::placeholder {
  color: var(--text-muted);
}

/* ============= Glass Nav(胶囊形)============= */

.glass-nav {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--glass-nav-bg);
  backdrop-filter: var(--glass-nav-blur);
  -webkit-backdrop-filter: var(--glass-nav-blur);
  border: var(--glass-nav-border);
  border-radius: var(--glass-nav-radius);
}

.glass-nav-item {
  padding: var(--space-2) var(--space-4);
  border-radius: 999px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-smooth);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: transparent;
  border: none;
}

.glass-nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.glass-nav-item.active {
  background: rgba(212, 175, 55, 0.15);
  color: var(--gold-primary);
}

/* ============= Glass Button ============= */

.glass-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  color: var(--text-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-smooth);
  backdrop-filter: blur(10px);
}

.glass-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-1px);
}

.glass-btn-primary {
  background: linear-gradient(
    135deg,
    rgba(212, 175, 55, 0.9) 0%,
    rgba(232, 197, 111, 0.9) 100%
  );
  color: #0a0510;
  border: none;
  box-shadow: 
    0 4px 16px rgba(212, 175, 55, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.glass-btn-primary:hover {
  background: linear-gradient(
    135deg,
    rgba(232, 197, 111, 1) 0%,
    rgba(212, 175, 55, 1) 100%
  );
  box-shadow: 
    0 6px 24px rgba(212, 175, 55, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.glass-btn-large {
  padding: var(--space-4) var(--space-6);
  font-size: 16px;
  border-radius: 16px;
}

.glass-btn-pill {
  border-radius: 999px;
}

/* ============= Glass Text Section(Notes 那种)============= */

.glass-text-section {
  background: var(--glass-card-bg);
  backdrop-filter: var(--glass-card-blur);
  border: var(--glass-card-border);
  border-radius: var(--glass-card-radius);
  padding: var(--space-6);
}

.glass-text-section .section-title {
  color: var(--text-muted);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: var(--space-2);
}

.glass-text-section .section-headline {
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 700;
  margin-bottom: var(--space-5);
}

.glass-text-section .section-body {
  /* 内嵌深色文本框样式 */
  background: var(--glass-input-bg);
  border-radius: var(--glass-input-radius);
  padding: var(--space-4);
  color: var(--text-secondary);
  line-height: 1.7;
}

.glass-text-section .section-body p {
  margin-bottom: var(--space-3);
}

.glass-text-section .section-body p:last-child {
  margin-bottom: 0;
}
```

## Step 2.3: 全局导航栏重设计

文件:`components/layout/MainNav.tsx`(替换现有导航)

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

export function MainNav() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('nav');
  
  const items = [
    { href: '/poju', label: t('poju'), icon: PojuIcon },
    { href: '/glyph', label: t('glyph'), icon: GlyphIcon },
    { href: '/syncro', label: t('syncro'), icon: SyncroIcon },
    { href: '/match', label: t('match'), icon: MatchIcon },
    { href: '/archive', label: t('archive'), icon: ArchiveIcon }
  ];
  
  return (
    <nav className="main-nav-wrapper">
      <div className="glass-nav main-nav">
        <Link href={`/${locale}`} className="nav-logo">
          <span className="logo-text">pojulife</span>
        </Link>
        
        <div className="nav-items">
          {items.map(item => {
            const isActive = pathname.includes(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={`/${locale}${item.href}`}
                className={`glass-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// ============= 图标(线条风格,统一)=============

function PojuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4v8M4 8h8" />
    </svg>
  );
}

function GlyphIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2L14 14H2L8 2z" />
    </svg>
  );
}

function SyncroIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2v4l3 3" />
    </svg>
  );
}

function MatchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="5" cy="8" r="3" />
      <circle cx="11" cy="8" r="3" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="12" height="3" />
      <rect x="3" y="6" width="10" height="8" />
      <path d="M6 9h4" />
    </svg>
  );
}
```

样式:`styles/main-nav.css`

```css
.main-nav-wrapper {
  position: fixed;
  top: var(--space-4);
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 100;
  padding: 0 var(--space-4);
}

.main-nav {
  max-width: 800px;
  width: 100%;
  justify-content: space-between;
}

.nav-logo {
  display: flex;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  text-decoration: none;
  color: var(--gold-primary);
  font-weight: 700;
  letter-spacing: 2px;
  font-size: 14px;
}

.logo-text {
  background: linear-gradient(135deg, #D4AF37 0%, #E8C56F 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.nav-items {
  display: flex;
  gap: var(--space-1);
}

/* 移动端 */
@media (max-width: 640px) {
  .nav-items {
    gap: 0;
  }
  
  .glass-nav-item span {
    display: none;  /* 只显示图标 */
  }
}
```

## Step 2.4: 全站布局更新

文件:`app/[locale]/layout.tsx`(已有,确保引入新样式)

```typescript
import '@/styles/design-tokens.css';
import '@/styles/glass.css';
import '@/styles/main-nav.css';
import '@/styles/syncro.css';
// ... 已有其他样式

import { MainNav } from '@/components/layout/MainNav';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <MainNav />
        <main style={{ paddingTop: '80px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
```

## Step 2.5: 各页面应用 Glass 设计

### POJU 介绍页改造

文件:`app/[locale]/(marketing)/poju/page.tsx`

```typescript
'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { useTranslations } from 'next-intl';

export default function POJUPage() {
  const t = useTranslations('poju');
  
  return (
    <div className="page-container">
      {/* Hero - 不用 glass(让背景渐变更纯粹)*/}
      <section className="hero-section">
        <h1 className="hero-title">
          POJU
        </h1>
        <p className="hero-tagline">{t('tagline')}</p>
        <p className="hero-description">{t('description')}</p>
        
        <button className="glass-btn glass-btn-primary glass-btn-large">
          {t('cta_start')}
        </button>
      </section>
      
      {/* 功能介绍 - 用 glass card */}
      <section className="features-section">
        <GlassCard variant="standard" padding="lg">
          <h3 className="feature-title">{t('feature_1_title')}</h3>
          <p className="feature-desc">{t('feature_1_desc')}</p>
        </GlassCard>
        
        <GlassCard variant="standard" padding="lg">
          <h3 className="feature-title">{t('feature_2_title')}</h3>
          <p className="feature-desc">{t('feature_2_desc')}</p>
        </GlassCard>
        
        <GlassCard variant="standard" padding="lg">
          <h3 className="feature-title">{t('feature_3_title')}</h3>
          <p className="feature-desc">{t('feature_3_desc')}</p>
        </GlassCard>
      </section>
      
      {/* How it works - 像 Notes 那种风格 */}
      <section className="how-section">
        <div className="glass-text-section">
          <div className="section-title">{t('how_label')}</div>
          <div className="section-headline">{t('how_title')}</div>
          <div className="section-body">
            <p>{t('how_step_1')}</p>
            <p>{t('how_step_2')}</p>
            <p>{t('how_step_3')}</p>
            <p>{t('how_step_4')}</p>
          </div>
        </div>
      </section>
      
      {/* Pricing */}
      <section className="pricing-section">
        <GlassCard variant="elevated" padding="lg">
          <div className="price-tag">$9.99</div>
          <div className="price-unit">{t('per_session')}</div>
          <ul className="price-includes">
            <li>{t('includes_1')}</li>
            <li>{t('includes_2')}</li>
            <li>{t('includes_3')}</li>
            <li>{t('includes_4')}</li>
          </ul>
        </GlassCard>
      </section>
    </div>
  );
}
```

样式:`styles/marketing-pages.css`

```css
.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-12) var(--space-4);
}

/* Hero(不用 glass)*/
.hero-section {
  text-align: center;
  padding: var(--space-12) 0;
}

.hero-title {
  font-size: 80px;
  font-weight: 700;
  letter-spacing: 12px;
  margin-bottom: var(--space-4);
  background: linear-gradient(135deg, #D4AF37 0%, #E8C56F 50%, #D4AF37 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-tagline {
  font-size: 20px;
  color: var(--text-secondary);
  margin-bottom: var(--space-3);
}

.hero-description {
  font-size: 16px;
  color: var(--text-tertiary);
  max-width: 600px;
  margin: 0 auto var(--space-6);
  line-height: 1.7;
}

/* Features Grid */
.features-section {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-10);
}

.feature-title {
  color: var(--text-primary);
  font-size: 18px;
  margin-bottom: var(--space-2);
}

.feature-desc {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

/* How section */
.how-section {
  max-width: 800px;
  margin: 0 auto var(--space-10);
}

/* Pricing */
.pricing-section {
  max-width: 400px;
  margin: 0 auto;
}

.price-tag {
  font-size: 56px;
  font-weight: 700;
  color: var(--gold-primary);
  text-align: center;
  margin-bottom: var(--space-1);
}

.price-unit {
  text-align: center;
  color: var(--text-tertiary);
  margin-bottom: var(--space-5);
}

.price-includes {
  list-style: none;
  padding: 0;
}

.price-includes li {
  padding: var(--space-2) 0;
  color: var(--text-secondary);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.price-includes li::before {
  content: "✓";
  color: var(--gold-primary);
  margin-right: var(--space-2);
}

/* Responsive */
@media (max-width: 768px) {
  .hero-title { font-size: 56px; letter-spacing: 8px; }
  .features-section { grid-template-columns: 1fr; }
}
```

### Glyph / Syncro / Match 同样套路

```
为 Glyph / Syncro / Match 三个产品介绍页应用相同结构:

每页有:
  1. Hero 区(不用 glass,纯背景)
     - 大标题(产品专属色)
     - Tagline
     - Description
     - CTA 按钮
     
  2. Features 区(3 张 glass card 横排)
  
  3. How it works(glass text section,Notes 风格)
  
  4. Pricing(glass elevated card)
  
  5. (可选)Use cases / FAQ

产品专属色:
  POJU:    gold     (#D4AF37)
  Glyph:   violet   (#7B68EE)
  Syncro:  cyan     (#00CED1)
  Match:   pink     (#FF6B9D)

各产品标题用各自的渐变色:
  .hero-title.poju    → 金色渐变
  .hero-title.glyph   → 紫罗兰渐变
  .hero-title.syncro  → 青色渐变
  .hero-title.match   → 粉色渐变
```

### 各功能页(操作流程)的 glass 化

```
所有操作流程页(prepare/draw/computing/result 等)
都已有自己的 CSS,只需要:

1. 把卡片背景改为 var(--glass-card-bg)
2. 加 backdrop-filter
3. 圆角统一为 var(--glass-card-radius)
4. 边框统一
5. body 背景改为 var(--bg-primary)

实施方法:
  - 找到所有 .container / .card / .panel 类
  - 替换为 .glass-card
  - 或在原 CSS 上添加 var(--glass-card-bg) 等变量

Cursor:逐个文件检查,统一应用。
```

## Step 2.6: 法律页 / Archive / 404 等次要页

```
法律页(/privacy, /terms 等):
  - 主体用 glass-text-section(Notes 风格)
  - 标题用 section-headline
  - 正文用 section-body
  - 长文阅读友好

Archive 页:
  - 卡片列表用 glass-card variant="subtle"(微妙感)
  - 产品图标用各自颜色
  
404 / 500:
  - 一个居中的 glass-card-elevated
  - 显示错误信息 + 回主页按钮
```

## 验证清单

```
□ design-tokens.css 实施
□ glass.css 实施
□ MainNav 重设计完成
□ 4 个产品介绍页应用新设计
□ 法律页应用 Notes 风格
□ Archive 页应用
□ 各功能页 glass 化
□ 移动端响应式
□ 截图描述贴出 5-7 个关键页面

🛑 等用户审视新设计后确认
```

---

# 任务 3: Match 页面功能介绍设计

## Step 3.1: Match 介绍页内容设计

文件:`app/[locale]/(marketing)/match/page.tsx`(替换现有)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { GlassCard } from '@/components/ui/GlassCard';
import { isFirstTimeFree } from '@/lib/syncro/device-usage';

export default function MatchHomePage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('match.home');
  
  const [canFree, setCanFree] = useState<boolean | null>(null);
  
  useEffect(() => {
    isFirstTimeFree('match').then(setCanFree);
  }, []);
  
  function handleStart() {
    if (canFree === null) return;
    sessionStorage.setItem('match_session_type', canFree ? 'free' : 'paid');
    router.push(canFree ? `/${locale}/match/select-a` : `/${locale}/match/payment`);
  }
  
  return (
    <div className="page-container match-home">
      {/* ============= Hero ============= */}
      <section className="hero-section">
        <h1 className="hero-title match-title">MATCH</h1>
        <p className="hero-tagline">{t('tagline')}</p>
        <p className="hero-description">{t('description')}</p>
        
        <button 
          onClick={handleStart}
          className="glass-btn glass-btn-primary glass-btn-large"
          disabled={canFree === null}
        >
          {canFree ? t('cta_free') : t('cta_paid')}
        </button>
        
        <p className="hero-note">
          {canFree ? t('free_note') : t('paid_note')}
        </p>
      </section>
      
      {/* ============= What is Match ============= */}
      <section className="features-section">
        <GlassCard padding="lg">
          <div className="feature-icon">👥</div>
          <h3 className="feature-title">{t('feature_two_charts_title')}</h3>
          <p className="feature-desc">{t('feature_two_charts_desc')}</p>
        </GlassCard>
        
        <GlassCard padding="lg">
          <div className="feature-icon">🔮</div>
          <h3 className="feature-title">{t('feature_any_relationship_title')}</h3>
          <p className="feature-desc">{t('feature_any_relationship_desc')}</p>
        </GlassCard>
        
        <GlassCard padding="lg">
          <div className="feature-icon">📋</div>
          <h3 className="feature-title">{t('feature_5_sections_title')}</h3>
          <p className="feature-desc">{t('feature_5_sections_desc')}</p>
        </GlassCard>
      </section>
      
      {/* ============= How it works(Notes 风格)============= */}
      <section className="how-section">
        <div className="glass-text-section">
          <div className="section-title">{t('how_label')}</div>
          <div className="section-headline">{t('how_title')}</div>
          <div className="section-body">
            <p>
              <strong>1. {t('how_step_1_title')}</strong><br/>
              {t('how_step_1_desc')}
            </p>
            <p>
              <strong>2. {t('how_step_2_title')}</strong><br/>
              {t('how_step_2_desc')}
            </p>
            <p>
              <strong>3. {t('how_step_3_title')}</strong><br/>
              {t('how_step_3_desc')}
            </p>
            <p>
              <strong>4. {t('how_step_4_title')}</strong><br/>
              {t('how_step_4_desc')}
            </p>
          </div>
        </div>
      </section>
      
      {/* ============= Use Cases ============= */}
      <section className="use-cases-section">
        <h2 className="section-h2">{t('use_cases_title')}</h2>
        
        <div className="use-cases-grid">
          <GlassCard padding="md" variant="subtle">
            <div className="use-case-icon">💍</div>
            <h4>{t('use_case_marriage_title')}</h4>
            <p>{t('use_case_marriage_desc')}</p>
          </GlassCard>
          
          <GlassCard padding="md" variant="subtle">
            <div className="use-case-icon">🤝</div>
            <h4>{t('use_case_partnership_title')}</h4>
            <p>{t('use_case_partnership_desc')}</p>
          </GlassCard>
          
          <GlassCard padding="md" variant="subtle">
            <div className="use-case-icon">👨‍👩‍👧</div>
            <h4>{t('use_case_family_title')}</h4>
            <p>{t('use_case_family_desc')}</p>
          </GlassCard>
          
          <GlassCard padding="md" variant="subtle">
            <div className="use-case-icon">💼</div>
            <h4>{t('use_case_hiring_title')}</h4>
            <p>{t('use_case_hiring_desc')}</p>
          </GlassCard>
          
          <GlassCard padding="md" variant="subtle">
            <div className="use-case-icon">💔</div>
            <h4>{t('use_case_relationship_title')}</h4>
            <p>{t('use_case_relationship_desc')}</p>
          </GlassCard>
          
          <GlassCard padding="md" variant="subtle">
            <div className="use-case-icon">🌱</div>
            <h4>{t('use_case_friendship_title')}</h4>
            <p>{t('use_case_friendship_desc')}</p>
          </GlassCard>
        </div>
      </section>
      
      {/* ============= What you get ============= */}
      <section className="what-you-get-section">
        <h2 className="section-h2">{t('whatyouget_title')}</h2>
        
        <GlassCard padding="lg" variant="elevated">
          <div className="report-preview">
            <div className="preview-item">
              <span className="preview-badge a">A</span>
              <div className="preview-content">
                <h4>{t('preview_a_title')}</h4>
                <p>{t('preview_a_desc')}</p>
              </div>
            </div>
            
            <div className="preview-item">
              <span className="preview-badge b">B</span>
              <div className="preview-content">
                <h4>{t('preview_b_title')}</h4>
                <p>{t('preview_b_desc')}</p>
              </div>
            </div>
            
            <div className="preview-item">
              <span className="preview-badge x">×</span>
              <div className="preview-content">
                <h4>{t('preview_combined_title')}</h4>
                <p>{t('preview_combined_desc')}</p>
              </div>
            </div>
            
            <div className="preview-item">
              <span className="preview-badge c">🎯</span>
              <div className="preview-content">
                <h4>{t('preview_conclusion_title')}</h4>
                <p>{t('preview_conclusion_desc')}</p>
              </div>
            </div>
            
            <div className="preview-item">
              <span className="preview-badge r">📋</span>
              <div className="preview-content">
                <h4>{t('preview_actions_title')}</h4>
                <p>{t('preview_actions_desc')}</p>
              </div>
            </div>
          </div>
        </GlassCard>
      </section>
      
      {/* ============= Pricing ============= */}
      <section className="pricing-section">
        <GlassCard padding="lg" variant="elevated">
          <div className="price-tag" style={{ color: 'var(--color-match)' }}>
            $4.99
          </div>
          <div className="price-unit">{t('per_reading')}</div>
          
          <div className="price-divider"></div>
          
          <ul className="price-includes">
            <li>{t('include_1')}</li>
            <li>{t('include_2')}</li>
            <li>{t('include_3')}</li>
            <li>{t('include_4')}</li>
            <li>{t('include_5')}</li>
          </ul>
          
          <button 
            onClick={handleStart}
            className="glass-btn glass-btn-primary glass-btn-large"
            style={{ width: '100%', marginTop: 'var(--space-5)' }}
          >
            {canFree ? t('cta_free') : t('cta_paid')}
          </button>
          
          {canFree && (
            <p className="first-free-note">{t('first_free_emphasized')}</p>
          )}
        </GlassCard>
      </section>
      
      {/* ============= FAQ(简短)============= */}
      <section className="faq-section">
        <h2 className="section-h2">{t('faq_title')}</h2>
        
        <div className="faq-list">
          <details className="faq-item">
            <summary>{t('faq_q1')}</summary>
            <p>{t('faq_a1')}</p>
          </details>
          
          <details className="faq-item">
            <summary>{t('faq_q2')}</summary>
            <p>{t('faq_a2')}</p>
          </details>
          
          <details className="faq-item">
            <summary>{t('faq_q3')}</summary>
            <p>{t('faq_a3')}</p>
          </details>
          
          <details className="faq-item">
            <summary>{t('faq_q4')}</summary>
            <p>{t('faq_a4')}</p>
          </details>
        </div>
      </section>
    </div>
  );
}
```

## Step 3.2: Match 介绍页文案(en + zh)

文件:`messages/en/match.json`

```json
{
  "home": {
    "tagline": "Two charts. One relationship. Real clarity.",
    "description": "Match weaves both bazi foundations together — yours and theirs — to reveal how your energies align, where you support each other, where you collide, and what to do about it.",
    
    "cta_free": "Run a free Match",
    "cta_paid": "Start a Match — $4.99",
    "free_note": "First Match is on us. No card required to see how it works.",
    "paid_note": "One reading. Complete report. 5 sections.",
    
    "feature_two_charts_title": "Two-Chart Analysis",
    "feature_two_charts_desc": "Deep individual readings of both people, then a layered analysis of how you meet.",
    
    "feature_any_relationship_title": "Any Relationship Type",
    "feature_any_relationship_desc": "Marriage, partnership, family, friendship, work — describe it in your own words and we read it.",
    
    "feature_5_sections_title": "Structured Report",
    "feature_5_sections_desc": "5 sections: each of you, together, conclusion, and clear actionable recommendations.",
    
    "how_label": "How Match works",
    "how_title": "From two charts to one clear path — in 4 steps.",
    "how_step_1_title": "Pick Person A's chart",
    "how_step_1_desc": "Choose a bazi from your library or add a new one. Just date, time, and gender.",
    "how_step_2_title": "Pick Person B's chart",
    "how_step_2_desc": "Same flow. B's chart is saved to your library so you can run more matches later.",
    "how_step_3_title": "Describe the relationship",
    "how_step_3_desc": "In your own words — current, intended, or in question. The more specific, the deeper the reading.",
    "how_step_4_title": "Read your full report",
    "how_step_4_desc": "5 expandable cards. Saved to your Archive so you can return anytime within your access.",
    
    "use_cases_title": "What Match is for",
    
    "use_case_marriage_title": "Marriage decisions",
    "use_case_marriage_desc": "Considering commitment? See what the charts say about long-term alignment.",
    
    "use_case_partnership_title": "Business partnerships",
    "use_case_partnership_desc": "Evaluate co-founders, business partners, or key collaborators before you sign.",
    
    "use_case_family_title": "Family dynamics",
    "use_case_family_desc": "Understand difficult family relationships — parent, child, sibling, in-law.",
    
    "use_case_hiring_title": "Hiring & teams",
    "use_case_hiring_desc": "Read the energetic fit between you and a key hire or new team member.",
    
    "use_case_relationship_title": "Existing relationships",
    "use_case_relationship_desc": "Stuck in tension with someone? See what's structural and what's surface.",
    
    "use_case_friendship_title": "Close friendships",
    "use_case_friendship_desc": "Why some friendships flow and others fade — the charts often have the answer.",
    
    "whatyouget_title": "What's in your report",
    
    "preview_a_title": "About A",
    "preview_a_desc": "Their natural traits, tendencies, and what they bring to this relationship.",
    
    "preview_b_title": "About B",
    "preview_b_desc": "Same depth for the other person — their patterns in this kind of connection.",
    
    "preview_combined_title": "Together",
    "preview_combined_desc": "Five-element interactions, ten-god dynamics, timing alignment — the full layered analysis.",
    
    "preview_conclusion_title": "Conclusion",
    "preview_conclusion_desc": "Overall compatibility level (1 of 5 tiers), plus your strengths and challenges together.",
    
    "preview_actions_title": "What to do",
    "preview_actions_desc": "4-6 specific, actionable recommendations — communication, timing, boundaries, growth.",
    
    "per_reading": "per complete reading",
    "include_1": "Full bazi analysis of both people",
    "include_2": "Five-element & ten-god interaction map",
    "include_3": "Compatibility tier with reasoning",
    "include_4": "4-6 actionable recommendations",
    "include_5": "Saved to Archive — return anytime",
    "first_free_emphasized": "Your first Match is free. No card required.",
    
    "faq_title": "Common questions",
    "faq_q1": "What if I don't know the other person's birth time?",
    "faq_a1": "You can still run a Match with approximate time — accuracy is slightly reduced but the core analysis remains valuable. We use 2-hour windows (Chinese hour periods), so even a rough estimate works.",
    
    "faq_q2": "Does the other person need to consent or know?",
    "faq_a2": "Match is for your understanding. The other person doesn't need to be involved. We never contact them, share their data, or reveal that you ran the reading. Their chart stays on your device only.",
    
    "faq_q3": "Can I do more than two people at once?",
    "faq_a3": "Currently Match focuses on two-person dynamics — this keeps the reading deep and clear. For complex situations (e.g., you + spouse + parent), we suggest running separate Matches to map each relationship cleanly.",
    
    "faq_q4": "How is this different from POJU?",
    "faq_a4": "POJU is a 30-day deep conversation about your situation. Match is a one-time, focused two-chart reading about a specific relationship. Different tools for different needs — many users use both."
  }
}
```

文件:`messages/zh/match.json`

```json
{
  "home": {
    "tagline": "两个命盘,一段关系,真正看清。",
    "description": "Match 将两个八字命盘编织在一起——你的与对方的——揭示你们能量如何对接,何处相互成就,何处碰撞,以及该怎么做。",
    
    "cta_free": "免费体验 Match",
    "cta_paid": "开始 Match — $4.99",
    "free_note": "首次 Match 由我们赠送。不需信用卡也能看效果。",
    "paid_note": "一次解读。完整报告。5 大模块。",
    
    "feature_two_charts_title": "双盘深度解读",
    "feature_two_charts_desc": "深度解读两个人各自的命盘,再分层分析你们如何相遇。",
    
    "feature_any_relationship_title": "任何关系类型",
    "feature_any_relationship_desc": "婚姻、合伙、家庭、朋友、职场——用你自己的话描述,我们来读懂。",
    
    "feature_5_sections_title": "结构化报告",
    "feature_5_sections_desc": "5 大模块:各自分析、合盘解读、结论判断、清晰可落地的行动建议。",
    
    "how_label": "Match 工作方式",
    "how_title": "从两个命盘到一条清晰路径——只需 4 步。",
    "how_step_1_title": "选择命主 A",
    "how_step_1_desc": "从你的命主库中选择,或添加一个新八字。只需年月日时辰性别。",
    "how_step_2_title": "选择命主 B",
    "how_step_2_desc": "同样流程。B 的八字会保存在你的命主库,方便后续再做匹配。",
    "how_step_3_title": "描述这段关系",
    "how_step_3_desc": "用你自己的话——现有的、即将发生的、或正在考虑的。越具体,解读越深。",
    "how_step_4_title": "阅读完整报告",
    "how_step_4_desc": "5 张可展开卡片。自动保存到 Archive,在你的访问期内随时回看。",
    
    "use_cases_title": "Match 适合的场景",
    
    "use_case_marriage_title": "婚姻决策",
    "use_case_marriage_desc": "考虑长久承诺?看看命盘对长期契合的判断。",
    
    "use_case_partnership_title": "生意合伙",
    "use_case_partnership_desc": "评估联合创始人、生意伙伴或关键合作者,签约前先看清。",
    
    "use_case_family_title": "家庭动力",
    "use_case_family_desc": "理解困难的家庭关系——父母、子女、兄弟姐妹、姻亲。",
    
    "use_case_hiring_title": "招聘与团队",
    "use_case_hiring_desc": "看清你与关键员工或新团队成员之间的能量适配。",
    
    "use_case_relationship_title": "现有关系",
    "use_case_relationship_desc": "和某人陷入张力?看哪些是结构性的、哪些只是表面。",
    
    "use_case_friendship_title": "深厚友谊",
    "use_case_friendship_desc": "为什么有些友谊顺畅、有些渐行渐远——命盘常常给出答案。",
    
    "whatyouget_title": "报告里有什么",
    
    "preview_a_title": "关于 A",
    "preview_a_desc": "TA 的天性特质、倾向,以及在这段关系中能带来什么。",
    
    "preview_b_title": "关于 B",
    "preview_b_desc": "对另一方同等深度——TA 在这类关系中的特有模式。",
    
    "preview_combined_title": "合盘",
    "preview_combined_desc": "五行互动、十神关系、大运同频——完整分层分析。",
    
    "preview_conclusion_title": "结论",
    "preview_conclusion_desc": "整体契合度等级(5 级中的 1 级),你们一起的优势与挑战。",
    
    "preview_actions_title": "该怎么做",
    "preview_actions_desc": "4-6 条具体可落地的建议——沟通、时机、边界、成长。",
    
    "per_reading": "/ 一次完整解读",
    "include_1": "两人完整八字分析",
    "include_2": "五行与十神互动图谱",
    "include_3": "带推演依据的契合度等级",
    "include_4": "4-6 条可执行行动建议",
    "include_5": "自动存入 Archive,随时回看",
    "first_free_emphasized": "首次 Match 免费。无需绑定信用卡。",
    
    "faq_title": "常见问题",
    "faq_q1": "如果不知道对方的出生时辰怎么办?",
    "faq_a1": "可以使用大致时辰运行 Match——精度略降但核心分析依然有价值。我们使用 2 小时为一个时辰(中国传统时辰段),即使估算也能用。",
    
    "faq_q2": "需要对方知道或同意吗?",
    "faq_a2": "Match 是为了你自己看清。对方不需要参与。我们不会联系 TA、不会分享 TA 的数据、也不会暴露你做过这次解读。TA 的命盘只保存在你的设备上。",
    
    "faq_q3": "可以一次匹配两人以上吗?",
    "faq_a3": "目前 Match 专注双人动力——这样解读才能保持深度和清晰。对于复杂情境(如你+配偶+父母),建议分别运行多次 Match,清晰地映射每段关系。",
    
    "faq_q4": "Match 跟 POJU 有什么区别?",
    "faq_a4": "POJU 是关于你处境的 30 天深度对话。Match 是关于特定关系的一次性双盘解读。不同工具,不同需求——很多用户两个都用。"
  }
}
```

es / fr / de 同样结构,Cursor 翻译。

## Step 3.3: Match 介绍页样式

文件:`styles/match-home.css`(新建)

```css
/* ============= Match Home 特定样式 ============= */

.match-home .hero-title.match-title {
  background: linear-gradient(
    135deg,
    #FF6B9D 0%,        /* 樱粉 */
    #FFB3C7 50%,       /* 浅粉 */
    #FF6B9D 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.match-home .hero-note {
  color: var(--text-tertiary);
  font-size: 13px;
  margin-top: var(--space-3);
}

/* Feature icons */
.feature-icon {
  font-size: 32px;
  margin-bottom: var(--space-3);
}

/* Section h2 */
.section-h2 {
  font-size: 28px;
  font-weight: 700;
  text-align: center;
  margin-bottom: var(--space-6);
  color: var(--text-primary);
}

/* Use cases grid */
.use-cases-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-10);
}

.use-case-icon {
  font-size: 24px;
  margin-bottom: var(--space-2);
}

.use-cases-grid h4 {
  color: var(--text-primary);
  font-size: 14px;
  margin-bottom: var(--space-1);
}

.use-cases-grid p {
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.5;
}

/* Report preview */
.report-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.preview-item {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}

.preview-badge {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  color: #fff;
  flex-shrink: 0;
}

.preview-badge.a { background: #D4AF37; }
.preview-badge.b { background: #87CEEB; }
.preview-badge.x { background: #FF6B9D; }
.preview-badge.c { background: #4CAF50; }
.preview-badge.r { background: #9C27B0; }

.preview-content h4 {
  color: var(--text-primary);
  font-size: 16px;
  margin-bottom: var(--space-1);
}

.preview-content p {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
}

/* Pricing */
.price-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: var(--space-5) 0;
}

.first-free-note {
  text-align: center;
  color: var(--gold-primary);
  font-size: 13px;
  margin-top: var(--space-3);
  font-style: italic;
}

/* FAQ */
.faq-section {
  max-width: 700px;
  margin: 0 auto var(--space-10);
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.faq-item {
  background: var(--glass-card-bg);
  backdrop-filter: var(--glass-card-blur);
  border: var(--glass-card-border);
  border-radius: 14px;
  padding: var(--space-4) var(--space-5);
}

.faq-item summary {
  color: var(--text-primary);
  font-weight: 600;
  cursor: pointer;
  list-style: none;
  position: relative;
  padding-right: var(--space-5);
}

.faq-item summary::after {
  content: "+";
  position: absolute;
  right: 0;
  top: 0;
  font-size: 20px;
  color: var(--text-tertiary);
  transition: transform var(--duration-base);
}

.faq-item[open] summary::after {
  transform: rotate(45deg);
}

.faq-item p {
  color: var(--text-secondary);
  margin-top: var(--space-3);
  line-height: 1.7;
}

/* Mobile */
@media (max-width: 768px) {
  .use-cases-grid {
    grid-template-columns: 1fr;
  }
  
  .section-h2 {
    font-size: 22px;
  }
}
```

## 验证清单

```
□ /match 主页完整重设计
□ 6 个 use case 展示
□ 5 段报告预览
□ Pricing 卡片
□ 4 个 FAQ
□ 中英文文案完整
□ 移动端响应式
□ 跟其他 3 个产品介绍页结构一致(但风格用 Match 粉色)

🛑 等用户审视后确认 Match 介绍页完成
```

---

# 三大任务完整清单

```
✅ 任务 1: 文案自查 + 对齐
   Step 1.1: 文案现状盘点
   Step 1.2: 对齐原则
   Step 1.3: 实施修改

✅ 任务 2: UI 统一(Spatial Glass)
   Step 2.1: 设计 Token 系统
   Step 2.2: Glass 组件
   Step 2.3: 导航栏重设计
   Step 2.4: 全局布局
   Step 2.5: 各页面应用
   Step 2.6: 次要页面

✅ 任务 3: Match 介绍页
   Step 3.1: 内容结构
   Step 3.2: 中英文文案
   Step 3.3: 样式实现
```

---

# 给 Cursor 的最终提醒

```
本任务包含 3 个独立任务。

实施顺序(严格按序):

1. 任务 1: 文案自查 + 对齐
   先做【自查报告】,等用户确认后再修改
   
2. 任务 2: UI 统一
   先实施 design tokens + glass 组件
   再逐页改造(4 个产品介绍页优先)
   最后才是法律页 / Archive / 错误页
   
3. 任务 3: Match 介绍页
   按完整代码 + 文案实施
   做完后让用户对比 POJU/Glyph/Syncro 介绍页
   确认风格一致但产品色不同

绝不允许:
  ✗ 跨任务交叉(任务 1 没做完不能开始任务 2)
  ✗ 改业务逻辑
  ✗ 改 API
  ✗ 修改 v5.0 已确认的功能流程

完成每个任务后:
  - 贴出 5-7 个关键页面的截图描述
  - 贴出修改的文件列表
  - 等用户确认才继续
```

---

**Cursor: 严格按 3 任务顺序实施。**

**用户: 这是完整指令,可直接复制给 Cursor。**
