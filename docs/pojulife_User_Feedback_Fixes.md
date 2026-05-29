# pojulife 用户使用反馈修复指令

> **背景**:基于用户真实使用过程中发现的 15 个问题
> 
> **优先级**:
> - 🚨 P0:影响核心功能(4 个)
> - 🟡 P1:影响体验(10 个)
> - 🟢 P2:清理调试信息(1 个)
>
> **执行原则**:严格【一步一停】,每个 Part 完成后等用户确认

---

# ⚠️ Cursor 必读

```
本任务的特点:

1. 这是【基于真实用户使用反馈】的修复
   不是新功能,是已有功能的 bug 和体验问题

2. 修复要【精准】,不要顺手重构
   只改用户反馈的部分,其他不动

3. 每个 Part 完成后,贴出:
   - 修改前 vs 修改后(截图或代码 diff)
   - 测试验证结果

4. 不要跨 Part 修复
   按顺序 Part 1 → Part 2 → ... 

5. 涉及 LLM prompt 修改时:
   保留原有结构,只调整 output rules
   不要重写整个 prompt
```

---

# 🚨 第 1 部分(P0):安卓 PWA "假安装"修复

## 问题描述

```
用户在华为安卓手机浏览器打开 pojulife.com,
点击我们的 "Install" 按钮,
结果:
  - 主屏上只创建了【网页快捷方式】
  - 不是真正的 PWA 应用
  - 点击图标进入 → 仍是网页提示页,不是 PWA 应用

根因:
  - 不同安卓品牌浏览器对 PWA 支持不同
  - Chrome / Samsung Internet → 支持 beforeinstallprompt → 真 PWA 安装
  - 华为浏览器 / UC / QQ 浏览器 → 不支持 beforeinstallprompt
    它们的"添加到桌面"只是创建快捷方式
```

## 修复方案

```
不能强求所有安卓浏览器都支持真 PWA。
但可以【精准识别 + 引导用户用 Chrome】:

1. 检测浏览器是否支持 beforeinstallprompt
2. 支持 → 显示"一键安装"按钮(现有逻辑)
3. 不支持(华为/UC 等)→ 显示【引导用 Chrome 打开】

不要让用户在不支持的浏览器里点击 install 然后失败。
```

## Step 1.1: 检测 PWA 安装能力

文件:`lib/pwa/install-capability.ts`(新建)

```typescript
export type InstallCapability = 
  | 'native_chrome'        // Chrome / Edge:支持 beforeinstallprompt
  | 'native_samsung'       // Samsung Internet:支持
  | 'manual_ios_safari'    // iOS Safari:手动添加到主屏幕
  | 'unsupported_android'  // 华为/UC/QQ 等:不支持真 PWA
  | 'unknown';

interface CapabilityResult {
  capability: InstallCapability;
  browser_name: string;
  os: string;
  can_real_install: boolean;
  recommend_chrome: boolean;
}

export function detectInstallCapability(): CapabilityResult {
  const ua = navigator.userAgent.toLowerCase();
  
  // 检测 OS
  let os = 'unknown';
  if (/iphone|ipad|ipod/.test(ua)) os = 'ios';
  else if (/android/.test(ua)) os = 'android';
  else if (/windows/.test(ua)) os = 'windows';
  else if (/mac/.test(ua)) os = 'mac';
  
  // 检测浏览器
  let browser_name = 'unknown';
  let capability: InstallCapability = 'unknown';
  let can_real_install = false;
  let recommend_chrome = false;
  
  if (os === 'ios') {
    // iOS:只有 Safari 支持手动添加(其他 iOS 浏览器都是 WebKit,但行为类似)
    if (/safari/.test(ua) && !/crios|fxios|edgios/.test(ua)) {
      browser_name = 'safari';
      capability = 'manual_ios_safari';
      can_real_install = true;  // 通过 Share 菜单可以
    } else {
      browser_name = 'ios_other';
      capability = 'manual_ios_safari';  // 同样的引导
      can_real_install = true;
    }
  } else if (os === 'android') {
    // 安卓:区分浏览器
    if (/huawei|hbpc|hwebpro/.test(ua)) {
      browser_name = 'huawei';
      capability = 'unsupported_android';
      can_real_install = false;
      recommend_chrome = true;
    } else if (/ucbrowser/.test(ua)) {
      browser_name = 'uc';
      capability = 'unsupported_android';
      can_real_install = false;
      recommend_chrome = true;
    } else if (/qqbrowser/.test(ua)) {
      browser_name = 'qq';
      capability = 'unsupported_android';
      can_real_install = false;
      recommend_chrome = true;
    } else if (/miuibrowser/.test(ua)) {
      browser_name = 'miui';
      // MIUI 浏览器较新版本支持 PWA,但旧版不支持
      capability = 'unsupported_android';
      can_real_install = false;
      recommend_chrome = true;
    } else if (/samsungbrowser/.test(ua)) {
      browser_name = 'samsung';
      capability = 'native_samsung';
      can_real_install = true;
    } else if (/chrome/.test(ua) && !/edg/.test(ua)) {
      browser_name = 'chrome';
      capability = 'native_chrome';
      can_real_install = true;
    } else if (/edg/.test(ua)) {
      browser_name = 'edge';
      capability = 'native_chrome';
      can_real_install = true;
    } else {
      browser_name = 'android_other';
      capability = 'unsupported_android';
      can_real_install = false;
      recommend_chrome = true;
    }
  }
  
  return { capability, browser_name, os, can_real_install, recommend_chrome };
}

/**
 * 是否真的能"一键安装"(收到了 beforeinstallprompt 事件)
 */
export function canPromptInstall(): boolean {
  return typeof window !== 'undefined' && 
         (window as any)._deferredInstallPrompt !== undefined;
}
```

## Step 1.2: 引导组件升级

文件:`components/pwa/PWAInstallScreen.tsx`(修改)

```tsx
import { detectInstallCapability } from '@/lib/pwa/install-capability';

export function PWAInstallScreen() {
  const t = useTranslations('pwa.install');
  const [capability, setCapability] = useState<any>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  useEffect(() => {
    setCapability(detectInstallCapability());
    
    // 捕获 beforeinstallprompt
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      (window as any)._deferredInstallPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  
  if (!capability) return null;
  
  // ⚠️ 关键:不支持真 PWA 的安卓浏览器,显示 Chrome 引导
  if (capability.capability === 'unsupported_android') {
    return <ChromeRedirectGuide browserName={capability.browser_name} />;
  }
  
  // iOS Safari → 显示 Share + Add to Home Screen 步骤
  if (capability.capability === 'manual_ios_safari') {
    return <IOSInstallSteps />;
  }
  
  // Chrome / Edge / Samsung → 一键安装
  if (capability.can_real_install && installPrompt) {
    return (
      <AndroidOneTapInstall 
        prompt={installPrompt} 
        browserName={capability.browser_name}
      />
    );
  }
  
  // 没收到 prompt(用户已经 dismiss 过 / 浏览器还没触发)
  if (capability.can_real_install && !installPrompt) {
    return <ChromeMenuInstallSteps />;
  }
  
  return <ChromeRedirectGuide browserName={capability.browser_name} />;
}

/**
 * 关键新组件:引导用户用 Chrome 打开
 */
function ChromeRedirectGuide({ browserName }: { browserName: string }) {
  const t = useTranslations('pwa.install.chrome_required');
  
  function copyUrl() {
    navigator.clipboard.writeText('https://pojulife.com');
  }
  
  return (
    <div className="install-content">
      <div className="logo-mark-large">◇</div>
      
      <h1 className="install-title">{t('title')}</h1>
      <p className="install-subtitle">
        {t('subtitle_huawei', { browser: getBrowserDisplay(browserName) })}
      </p>
      
      <div className="chrome-steps">
        <div className="step-item">
          <div className="step-icon"><i className="ti ti-brand-chrome" /></div>
          <div className="step-text">
            <strong>{t('step_1_title')}</strong>
            <p>{t('step_1_desc')}</p>
          </div>
        </div>
        
        <div className="step-item">
          <div className="step-icon"><i className="ti ti-copy" /></div>
          <div className="step-text">
            <strong>{t('step_2_title')}</strong>
            <p>{t('step_2_desc')}</p>
            <button className="copy-url-btn" onClick={copyUrl}>
              pojulife.com <i className="ti ti-copy" />
            </button>
          </div>
        </div>
        
        <div className="step-item">
          <div className="step-icon"><i className="ti ti-download" /></div>
          <div className="step-text">
            <strong>{t('step_3_title')}</strong>
            <p>{t('step_3_desc')}</p>
          </div>
        </div>
      </div>
      
      <div className="install-note">
        <i className="ti ti-info-circle" />
        <p>{t('why_chrome')}</p>
      </div>
    </div>
  );
}

function getBrowserDisplay(name: string): string {
  const map: Record<string, string> = {
    huawei: 'Huawei Browser',
    uc: 'UC Browser',
    qq: 'QQ Browser',
    miui: 'Mi Browser',
    android_other: 'this browser'
  };
  return map[name] || 'this browser';
}
```

## Step 1.3: 翻译

文件:`messages/en/pwa.json`(扩展)

```json
{
  "pwa": {
    "install": {
      "chrome_required": {
        "title": "Use Chrome to install",
        "subtitle_huawei": "{browser} doesn't support pojulife's full app installation. Please open this page in Chrome to install.",
        "step_1_title": "Install Chrome",
        "step_1_desc": "Get it from your app store if you don't have it",
        "step_2_title": "Open pojulife.com in Chrome",
        "step_2_desc": "Copy the link below, then paste it into Chrome's address bar",
        "step_3_title": "Tap 'Install'",
        "step_3_desc": "Chrome will show an install button — tap to add pojulife to your home screen",
        "why_chrome": "Chrome supports proper Progressive Web App installation. Other browsers may only create a shortcut, which won't give you the full pojulife experience."
      }
    }
  }
}
```

文件:`messages/zh/pwa.json`

```json
{
  "pwa": {
    "install": {
      "chrome_required": {
        "title": "请使用 Chrome 安装",
        "subtitle_huawei": "{browser} 不支持 pojulife 的完整应用安装,请用 Chrome 打开此页面安装。",
        "step_1_title": "安装 Chrome",
        "step_1_desc": "如果还没有,从应用商店下载",
        "step_2_title": "在 Chrome 中打开 pojulife.com",
        "step_2_desc": "复制下方链接,粘贴到 Chrome 地址栏",
        "step_3_title": "点击 '安装'",
        "step_3_desc": "Chrome 会显示安装按钮,点击即可将 pojulife 添加到桌面",
        "why_chrome": "Chrome 完整支持 PWA 应用安装。其他浏览器可能只会创建快捷方式,无法提供完整的 pojulife 体验。"
      }
    }
  }
}
```

## 验证清单 - Part 1

```
□ 在 Chrome (Android) 测试:看到"一键安装"按钮 + 真 PWA 安装
□ 在华为浏览器测试:看到 Chrome 引导页(不再是假 install 按钮)
□ 在 UC 浏览器测试:同上
□ 在 Safari (iOS) 测试:看到 Share + Add to Home Screen 步骤(不变)
□ 复制链接按钮可用
□ 翻译完整

🛑 等用户确认进入 Part 2
```

---

# 🚨 第 2 部分(P0):出生地保存丢失修复

## 问题描述

```
用户填写出生地"Wenzhou, Zhejiang, China",
生成分析后保存。
但打开已保存的记录,出生地显示"默认(时区中央经度)"
而不是用户填的 Wenzhou。

根因(需要 Cursor 排查):
  最可能是以下之一:
  1. saveBaseAnalysis 时,birth_location 没完整传递
  2. stored_profile 写入时,只保存了 city 字段,没保存 longitude/latitude
  3. UI 读取时,读了 source: 'auto_detected' 显示"默认"
  4. localStorage 缓存的 default location 覆盖了用户输入
```

## Step 2.1: 排查日志

```
任务:让 Cursor 添加日志,定位 bug

在 3 个关键节点加 console.log:

1. BirthLocationField 提交时:
   console.log('[BirthLocation] submit:', birthLocation);

2. generateBaseAnalysis API 接收时:
   console.log('[base-analysis] received birth_location:', body.birth_location);

3. saveStoredProfile 写入时:
   console.log('[saveStoredProfile] writing birth_location:', profile.user_profile.birth_location);

4. 读取时(profile 卡片):
   console.log('[profile-card] read birth_location:', profile.user_profile.birth_location);

让 Cursor 跑一次完整流程:
  - 填 Wenzhou
  - 提交
  - 完成分析
  - 查看 profile

把 4 个日志贴出来给用户看,确认在哪一步丢了。
```

## Step 2.2: 修复保存逻辑

文件:`lib/profile/stored-profiles-service.ts`(检查 + 修复)

```typescript
export async function saveBaseAnalysisFromStream(input: {
  profile_id: string;
  content: string;
  meta: any;
  locale: string;
  generated_at: string;
}): Promise<void> {
  const profile = await getStoredProfile(input.profile_id);
  if (!profile) throw new Error('profile not found');
  
  // ⚠️ 关键:不要重写 birth_location,只更新 base_analysis
  const updated = {
    ...profile,
    // user_profile 不动!
    base_analysis: {
      content: stripMetaSection(input.content),
      meta: input.meta,
      locale: input.locale,
      generated_at: input.generated_at,
      used_true_solar_time: true,
      computation_version: 'v3_streaming'
    }
  };
  
  console.log('[saveBaseAnalysisFromStream] preserving birth_location:', 
    updated.user_profile?.birth_location);
  
  await saveStoredProfile(updated);
}
```

## Step 2.3: 修复 UI 读取

文件:`components/profile/ProfileCard.tsx`(或类似)

```tsx
function formatBirthLocation(loc: any): string {
  if (!loc) return '—';
  
  // ⚠️ 不要根据 source 显示不同文字
  // 用户填的就是用户填的,无论 source 是 auto_detected 还是 manual_search
  // 都应该显示城市名
  
  const parts = [loc.city];
  if (loc.state) parts.push(loc.state);
  if (loc.country) parts.push(loc.country);
  return parts.join(', ');
}

// ❌ 错误的旧逻辑(如果有):
// if (loc.source === 'fallback') return '默认(时区中央经度)';

// ✅ 正确:始终显示城市名
```

## Step 2.4: 数据迁移(如果旧数据已损坏)

```typescript
// 让 Cursor 写一个修复脚本(只跑一次):
// lib/db/migrations/fix-birth-location.ts

export async function fixOrphanedBirthLocations() {
  const profiles = await getAllStoredProfiles();
  let fixed = 0;
  
  for (const profile of profiles) {
    const loc = profile.user_profile?.birth_location;
    
    // 检查:有 longitude 但 city 是空 / "默认"
    if (loc?.longitude && (!loc.city || loc.city === '默认' || loc.city.includes('default'))) {
      console.log('[fix] orphaned location:', loc);
      // 不知道原始 city,只能用 longitude 反查
      // 或者标记为需要用户重新填写
    }
  }
  
  return fixed;
}
```

## 验证清单 - Part 2

```
□ 添加 4 个日志,跑一次完整流程
□ 用户看到哪一步丢失,反馈
□ 修复对应代码
□ 重新跑流程,验证 Wenzhou 完整保留
□ profile 卡片显示 "Wenzhou, Zhejiang, China"
□ 不再显示"默认(时区中央经度)"

🛑 等用户确认进入 Part 3
```

---

# 🚨 第 3 部分(P0):Match B 命主未分析就失败

## 问题描述

```
Match 流程:
  - 命主 A:用已有记录(有 base_analysis)
  - 命主 B:新建八字信息(没有 base_analysis)
  - 用户点击"开始 Match"
  - 报错:"命主 B 的八字还没进行分析,所以失败"

正确流程应该:
  - 检测 B 有没有 base_analysis
  - 如果没有 → 先帮 B 生成 base_analysis(用流式架构)
  - B 完成后,再开始 Match 合盘
```

## Step 3.1: Match 开始前检测 B 的 base_analysis

文件:`components/match/MatchStartButton.tsx`(或类似)

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredProfile } from '@/lib/profile/stored-profiles-service';

interface Props {
  profile_a_id: string;
  profile_b_id: string;
}

export function MatchStartButton({ profile_a_id, profile_b_id }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'checking' | 'preparing_b' | 'ready'>('idle');
  
  async function handleStart() {
    setStatus('checking');
    
    // 检查 A 和 B 是否都有 base_analysis
    const [profile_a, profile_b] = await Promise.all([
      getStoredProfile(profile_a_id),
      getStoredProfile(profile_b_id)
    ]);
    
    const a_has_analysis = !!profile_a?.base_analysis?.content;
    const b_has_analysis = !!profile_b?.base_analysis?.content;
    
    if (!a_has_analysis) {
      // A 也没有(罕见,因为通常 A 是已有记录)
      router.push(`/${locale}/match/prepare/${profile_a_id}?next=match&partner=${profile_b_id}`);
      return;
    }
    
    if (!b_has_analysis) {
      // ⭐ 关键修复:B 没有 → 先去生成 B 的 base_analysis
      setStatus('preparing_b');
      router.push(`/${locale}/match/prepare/${profile_b_id}?next=match&partner=${profile_a_id}`);
      return;
    }
    
    // 都有了 → 进入 Match
    setStatus('ready');
    router.push(`/${locale}/match/compute?a=${profile_a_id}&b=${profile_b_id}`);
  }
  
  return (
    <button 
      className="match-start-btn"
      onClick={handleStart}
      disabled={status === 'checking' || status === 'preparing_b'}
    >
      {status === 'idle' && 'Begin Match'}
      {status === 'checking' && 'Checking...'}
      {status === 'preparing_b' && 'Preparing Partner B...'}
      {status === 'ready' && 'Starting Match...'}
    </button>
  );
}
```

## Step 3.2: prepare 页面支持 ?next=match 参数

文件:`app/[locale]/match/prepare/[profile_id]/page.tsx`(修改)

```tsx
'use client';

import { useSearchParams } from 'next/navigation';

export default function MatchPreparePage({ params }: { params: { profile_id: string } }) {
  const searchParams = useSearchParams();
  const next = searchParams.get('next');           // 'match'
  const partner = searchParams.get('partner');     // 另一个 profile_id
  
  // 完成 base_analysis 后的回调
  function handleAnalysisComplete() {
    if (next === 'match' && partner) {
      // 跳到 match 计算
      router.push(`/${locale}/match/compute?a=${partner}&b=${params.profile_id}`);
    } else {
      // 正常返回
      router.push(`/${locale}/match`);
    }
  }
  
  return (
    <SyncroPreparingPage
      profileId={params.profile_id}
      onComplete={handleAnalysisComplete}
    />
  );
}
```

## 验证清单 - Part 3

```
□ Match 选 A(已有)+ B(新建)
□ 点击 Begin Match
□ 应该自动进入 B 的准备页(不再报错)
□ B 完成 base_analysis 后,自动跳转 Match 计算
□ Match 报告正常生成

🛑 等用户确认进入 Part 4
```

---

# 🚨 第 4 部分(P0):Glyph "签" 违禁词漏网

## 问题描述

```
用户在 Glyph 最终交付的报告中看到"签""签文"等描述。

这违反全站文案纪律:
  - "签" / "签文" 是禁用词
  - 应该用 "Glyph" / "Glyph reading" / "意象"

可能原因:
  - LLM prompt 没有强制约束
  - 或者历史 prompt 还在用旧文案
```

## Step 4.1: 加强 Glyph prompt 的语言规则

文件:`lib/llm/prompts/glyph-prompt.ts`(或类似)

```typescript
// 在 prompt 末尾追加(或加强)语言规则:

export const GLYPH_LANGUAGE_RULES = `

# 语言规则(严格)

⛔ 严格禁止以下词汇:

中文:
- "签" / "签文" / "抽签" / "卜签" / "求签" / "解签"
- "占卜" / "算命" / "命理学"
- "卦" / "卜卦" / "算卦"

英文:
- "fortune slip" / "divine slip" / "lot drawing"
- "divination" / "oracle bone" / "casting lots"

✓ 必须使用:
- "Glyph" / "意象"
- "Glyph reading" / "意象解读"
- "Glyph pattern" / "意象图案"
- "reflection" / "reflective image" / "反思"

⭐ Glyph 的定位:
Glyph 是 pocket-sized mirror — 持一个问题,画一个图案,读一段反思。
不是占卜工具,是反思镜。

例:
  ❌ "你抽到的签是..."
  ✅ "你画出的 Glyph 是..."
  
  ❌ "这支签的含义是..."
  ✅ "这个意象映出的是..."
  
  ❌ "签文告诉我们..."
  ✅ "这个 Glyph 反射出..."
`;

// 把这个常量追加到所有 Glyph 相关 prompt
```

## Step 4.2: 显示层兜底过滤

文件:`lib/glyph/sanitize-output.ts`(新建)

```typescript
/**
 * 即使 LLM 漏出违禁词,显示层兜底替换
 */
const REPLACEMENT_MAP_ZH: Array<[RegExp, string]> = [
  [/抽到的签/g, '画出的 Glyph'],
  [/这支签/g, '这个 Glyph'],
  [/这张签/g, '这个 Glyph'],
  [/这只签/g, '这个 Glyph'],
  [/签文/g, 'Glyph 文'],
  [/签的含义/g, 'Glyph 的含义'],
  [/求签/g, '画 Glyph'],
  [/抽签/g, '画 Glyph'],
  [/解签/g, '读 Glyph'],
  [/上签/g, 'open Glyph'],
  [/中签/g, 'flowing Glyph'],
  [/下签/g, 'still Glyph'],
  // 单字 "签" 不替换(可能误伤,如 "签字")
  // 只替换组合词
];

const REPLACEMENT_MAP_EN: Array<[RegExp, string]> = [
  [/\bfortune slip\b/gi, 'Glyph'],
  [/\bdivine slip\b/gi, 'Glyph'],
  [/\blot drawing\b/gi, 'Glyph reading'],
  [/\bdrawing lots\b/gi, 'drawing a Glyph'],
  [/\bdivination\b/gi, 'reading'],
  [/\boracle\b/gi, 'Glyph'],
];

export function sanitizeGlyphOutput(text: string, locale: string): string {
  let result = text;
  const map = locale === 'zh' ? REPLACEMENT_MAP_ZH : REPLACEMENT_MAP_EN;
  
  for (const [pattern, replacement] of map) {
    result = result.replace(pattern, replacement);
  }
  
  return result;
}
```

## Step 4.3: 应用兜底过滤

文件:`components/glyph/GlyphReportView.tsx`(修改)

```tsx
import { sanitizeGlyphOutput } from '@/lib/glyph/sanitize-output';

export function GlyphReportView({ report, locale }: Props) {
  const sanitizedContent = sanitizeGlyphOutput(report.content, locale);
  
  return (
    <article className="glyph-report">
      <ReactMarkdown>{sanitizedContent}</ReactMarkdown>
    </article>
  );
}
```

## Step 4.4: 字体一致性

```css
/* styles/glyph-report.css */

.glyph-report {
  font-family: var(--pj-font-sans);
}

.glyph-report,
.glyph-report p,
.glyph-report h1,
.glyph-report h2,
.glyph-report h3,
.glyph-report li,
.glyph-report blockquote {
  font-family: var(--pj-font-sans) !important;  /* 强制统一字体族 */
}

/* 字号梯度统一 */
.glyph-report h1 { font-size: 22px; font-weight: 500; }
.glyph-report h2 { font-size: 18px; font-weight: 500; }
.glyph-report h3 { font-size: 15px; font-weight: 500; }
.glyph-report p,
.glyph-report li { 
  font-size: 14px;
  line-height: 1.7;
  color: var(--pj-text-primary);
}

/* 不要混用 serif 和 sans-serif */
```

## 验证清单 - Part 4

```
□ 跑 5 次 Glyph,检查输出
  - grep "签" / "卦" / "占卜" → 应该 0 命中
□ 字体一致(所有段落同字体族)
□ 字号清晰梯度(h1 > h2 > h3 > p)
□ ReactMarkdown 渲染正常

🛑 等用户确认进入 Part 5
```

---

# 🟡 第 5 部分(P1):准备页文案修改

## 问题描述

```
现在:"确认后,准备过程约 2-5 分钟"
用户不喜欢这个文案

改成:
"你的数据只会加密后保存在本地设备,pojulife 不会也无法获取,请放心使用..."

理由:用户更关心隐私,不需要被告知耗时
```

## 修复

文件:`messages/en/birth_form.json` / `messages/zh/birth_form.json`(扩展)

```json
// EN
{
  "birth_form": {
    "confirm_privacy_note": "Your data is encrypted and stored only on your device. pojulife cannot access it."
  }
}

// ZH
{
  "birth_form": {
    "confirm_privacy_note": "你的数据只会加密后保存在本地设备,pojulife 不会也无法获取,请放心使用。"
  }
}
```

文件:`components/forms/BirthInfoForm.tsx`(修改)

```tsx
// 找到"准备过程约 2-5 分钟"的地方,删除或替换:

// ❌ 删除:
// <p>{t('preparation_time_estimate')}</p>

// ✅ 替换为:
<p className="privacy-note">
  <i className="ti ti-lock" />
  {t('confirm_privacy_note')}
</p>
```

```css
.privacy-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: var(--pj-text-xs);
  color: var(--pj-text-tertiary);
  line-height: var(--pj-leading-normal);
  margin-top: 16px;
}

.privacy-note i {
  color: var(--pj-following);
  font-size: 14px;
  margin-top: 2px;
}
```

## 验证

```
□ 准备页显示新文案(隐私承诺)
□ 不再显示"2-5 分钟"
□ EN + ZH 都正确

🛑 等用户确认进入 Part 6
```

---

# 🟡 第 6 部分(P1):流式动效优化

## 问题描述

```
现在:
  - 流式显示范围太大
  - 提示词颜色看不清
  - LLM 思考阶段(流式还没开始)没有任何提示,显得"卡住"

改成:
  1. 流式显示框范围缩小一半,放在下方导航栏上方
  2. 流式输出框下方的提示词颜色改成白色
  3. LLM 思考阶段(从发请求到第一个 chunk 之间)
     显示滚动文本动效:
     "正在创建..."
     "正在分析..."
     "请耐心等待..."
     直到流式开始输出
```

## Step 6.1: 调整 StreamingAnalysisView 尺寸 + 位置

文件:`components/poju/StreamingAnalysisView.tsx`(修改)

```tsx
import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  content: string;
  status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'failed';
  bytes_received: number;
}

const THINKING_PHRASES_ZH = [
  '正在创建...',
  '正在分析...',
  '正在解读你的能量结构...',
  '正在思考...',
  '请耐心等待...'
];

const THINKING_PHRASES_EN = [
  'Creating...',
  'Analyzing...',
  'Reading your energy structure...',
  'Thinking...',
  'Please wait...'
];

export function StreamingAnalysisView({ content, status, bytes_received }: Props) {
  const t = useTranslations('analysis_loader');
  const locale = useLocale();  // 拿到当前 locale
  const contentRef = useRef<HTMLDivElement>(null);
  
  // 思考阶段的滚动文本
  const [thinkingPhraseIdx, setThinkingPhraseIdx] = useState(0);
  const phrases = locale === 'zh' ? THINKING_PHRASES_ZH : THINKING_PHRASES_EN;
  
  // 第一个 chunk 到达前,滚动 phrases
  const isThinking = (status === 'connecting' || status === 'streaming') && bytes_received === 0;
  
  useEffect(() => {
    if (!isThinking) return;
    
    const timer = setInterval(() => {
      setThinkingPhraseIdx(idx => (idx + 1) % phrases.length);
    }, 2000);
    
    return () => clearInterval(timer);
  }, [isThinking, phrases.length]);
  
  // 自动滚动到底部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);
  
  const visibleContent = stripMetaSection(content);
  
  return (
    <div className="streaming-analysis-bottom">  {/* ⭐ 改了 class */}
      <div className="streaming-container">
        {/* 思考阶段:滚动文本 */}
        {isThinking && (
          <div className="thinking-phase">
            <span className="thinking-dot" />
            <span className="thinking-text" key={thinkingPhraseIdx}>
              {phrases[thinkingPhraseIdx]}
            </span>
          </div>
        )}
        
        {/* 流式内容(开始输出后)*/}
        {!isThinking && visibleContent && (
          <div ref={contentRef} className="streaming-content-compact">
            <pre className="content-text">{visibleContent}</pre>
            {status === 'streaming' && <span className="cursor">▊</span>}
          </div>
        )}
      </div>
      
      {/* 底部提示(白色)*/}
      {status === 'streaming' && (
        <div className="bottom-hint-white">
          {t('keep_screen_on')}
        </div>
      )}
    </div>
  );
}
```

## Step 6.2: 样式(缩小一半 + 放底部 + 白色提示)

文件:`styles/streaming-analysis.css`(修改)

```css
/* ⭐ 新位置:放在底部 nav 上方 */
.streaming-analysis-bottom {
  position: fixed;
  bottom: 80px;  /* 底部 nav 高度 */
  left: 16px;
  right: 16px;
  z-index: 50;
  
  /* 不再是全屏,缩小一半 */
  max-height: 35vh;
}

.streaming-container {
  background: rgba(7, 9, 26, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 16px 14px;
  max-height: 30vh;
  overflow: hidden;
}

/* === 思考阶段 === */
.thinking-phase {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 8px;
}

.thinking-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pj-gold);
  box-shadow: 0 0 8px var(--pj-gold-glow);
  animation: pulse 1.2s infinite ease-in-out;
  flex-shrink: 0;
}

.thinking-text {
  font-size: var(--pj-text-sm);
  color: var(--pj-text-primary);  /* 白色 */
  letter-spacing: 0.3px;
  animation: fade-in 0.4s ease;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* === 流式内容(紧凑版)=== */
.streaming-content-compact {
  max-height: 25vh;
  overflow-y: auto;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

.streaming-content-compact .content-text {
  font-family: var(--pj-font-sans);
  font-size: 13px;
  line-height: 1.6;
  color: var(--pj-text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
}

.cursor {
  display: inline-block;
  color: var(--pj-gold);
  margin-left: 2px;
  animation: blink 1s infinite step-end;
}

/* === 底部提示(白色)=== */
.bottom-hint-white {
  margin-top: 8px;
  text-align: center;
  font-size: 11px;
  color: var(--pj-text-primary);  /* ⭐ 改成白色 */
  letter-spacing: 0.3px;
  padding: 0 12px;
}

/* 删除原来的全屏样式 */
/* 删除 .streaming-analysis(旧 class) */
```

## Step 6.3: 上方留出空间(背景动效完整显示)

```css
/* preparing 页面主容器:不再被流式框占满,只在底部占小块 */

.preparing-page {
  position: relative;
  height: 100vh;
  overflow: hidden;
  /* 背景动效完整展示 */
}

.preparing-bg {
  position: absolute;
  inset: 0;
  /* 占满整个屏幕 */
}

/* 流式框只占底部 35vh */
```

## 验证清单 - Part 6

```
□ 流式框只在底部(不占满屏幕)
□ 背景动效完整可见
□ 思考阶段显示滚动文本("正在分析..." 等)
□ 流式开始后,显示真实输出
□ 底部提示文字是白色,看得清
□ 不会卡住(思考阶段也有动态反馈)

🛑 等用户确认进入 Part 7
```

---

# 🟡 第 7 部分(P1):Syncro 三模式手动切换(回到 3 按钮)

## 问题描述

```
之前文档:
  AR = Compass 的姿势子模式(竖起手机自动切换)
  底部 tabs:Compass | Map(2 个)

用户实测后:
  "手机竖起和平放是非常频繁的操作,很容易随便一动就来回切换"
  
新决策:
  做成 3 种模式的【手动切换】
  底部 tabs:Compass | AR | Map(3 个)
  不自动切换
```

## 修复

文件:`components/syncro/SyncroMainView.tsx`(修改)

```tsx
export function SyncroMainView({ data }: { data: any }) {
  const [mode, setMode] = useState<'compass' | 'ar' | 'map'>('compass');
  
  // ⛔ 删除:自动姿势切换逻辑
  // useEffect 中的 beta < 30 自动切换 AR 的代码删掉
  
  // ✅ 完全手动:用户点 tab 切换
  
  return (
    <div className="syncro-main">
      <HourProgressBar ... />
      
      <div className="syncro-display">
        {mode === 'compass' && <SyncroCompassMode ... />}
        {mode === 'ar' && <SyncroARMode ... />}
        {mode === 'map' && <SyncroMapMode ... />}
      </div>
      
      {/* 底部 3 个 tab */}
      <ThreeModeToggle mode={mode} onChange={setMode} />
    </div>
  );
}
```

文件:`components/syncro/ThreeModeToggle.tsx`(新建,替代 ModeToggle)

```tsx
'use client';

import { useTranslations } from 'next-intl';

interface Props {
  mode: 'compass' | 'ar' | 'map';
  onChange: (mode: 'compass' | 'ar' | 'map') => void;
}

export function ThreeModeToggle({ mode, onChange }: Props) {
  const t = useTranslations('syncro.modes');
  
  return (
    <div className="three-mode-toggle">
      <button 
        className={`mode-tab ${mode === 'compass' ? 'active' : ''}`}
        onClick={() => onChange('compass')}
      >
        <i className="ti ti-compass" />
        <span>{t('compass')}</span>
      </button>
      
      <button 
        className={`mode-tab ${mode === 'ar' ? 'active' : ''}`}
        onClick={() => onChange('ar')}
      >
        <i className="ti ti-camera" />
        <span>{t('ar')}</span>
      </button>
      
      <button 
        className={`mode-tab ${mode === 'map' ? 'active' : ''}`}
        onClick={() => onChange('map')}
      >
        <i className="ti ti-grid-dots" />
        <span>{t('map')}</span>
      </button>
    </div>
  );
}
```

```css
.three-mode-toggle {
  position: absolute;
  bottom: 70px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-radius: 20px;
}

.mode-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 18px;
  background: transparent;
  color: var(--pj-text-muted);
  font-family: inherit;
  font-size: 10px;
  border-radius: 16px;
  cursor: pointer;
  transition: all var(--pj-duration-fast);
}

.mode-tab i {
  font-size: 16px;
}

.mode-tab.active {
  background: rgba(212, 165, 116, 0.18);
  color: var(--pj-gold);
}
```

## 验证清单 - Part 7

```
□ 底部显示 3 个 tab(Compass / AR / Map)
□ 切换时不再依赖手机姿势
□ 平放/竖起手机时不会自动切换
□ AR 模式手动激活摄像头
□ 用户体验稳定,不会"乱跳"

🛑 等用户确认进入 Part 8
```

---

# 🟡 第 8 部分(P1):Syncro 24h Session 复用

## 问题描述

```
当前:
  生成 Syncro 后,切换到其他功能(POJU/Glyph)再回 Syncro
  → 要重新生成
  
应该:
  Syncro 是 24h 数据,
  24h 内回来应该直接显示之前生成的
```

## Step 8.1: Syncro Session 持久化结构

文件:`lib/syncro/syncro-session-store.ts`(新建或修改)

```typescript
import { db } from '@/lib/db/poju-db';

interface SyncroSession {
  session_id: string;
  profile_id: string;
  
  task_description: string;
  user_location: any;
  
  // 完整 96 矩阵
  matrix: Record<string, any>;
  
  // 时间窗口
  created_at: number;
  expires_at: number;       // created_at + 24h
  
  // 元数据
  start_hour_period: string;  // 创建时所在的时辰
  computation_version: string;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * 创建新 session(24h 有效期)
 */
export async function createSyncroSession(input: {
  profile_id: string;
  task_description: string;
  user_location: any;
  matrix: any;
  start_hour_period: string;
}): Promise<SyncroSession> {
  const now = Date.now();
  const session: SyncroSession = {
    session_id: `syncro_${input.profile_id}_${now}`,
    profile_id: input.profile_id,
    task_description: input.task_description,
    user_location: input.user_location,
    matrix: input.matrix,
    created_at: now,
    expires_at: now + TWENTY_FOUR_HOURS_MS,
    start_hour_period: input.start_hour_period,
    computation_version: 'v5.1'
  };
  
  await db.syncro_sessions.put(session);
  return session;
}

/**
 * 查找 profile 的有效 session(24h 内)
 */
export async function findActiveSyncroSession(profile_id: string): Promise<SyncroSession | null> {
  const now = Date.now();
  
  // 按时间降序找最近的
  const sessions = await db.syncro_sessions
    .where('profile_id')
    .equals(profile_id)
    .reverse()
    .sortBy('created_at');
  
  // 找第一个未过期的
  for (const s of sessions) {
    if (s.expires_at > now) {
      return s;
    }
  }
  
  return null;
}

/**
 * 清理过期 sessions(可选,后台任务)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const now = Date.now();
  const expired = await db.syncro_sessions
    .where('expires_at')
    .below(now)
    .toArray();
  
  for (const s of expired) {
    await db.syncro_sessions.delete(s.session_id);
  }
  
  return expired.length;
}
```

## Step 8.2: IndexedDB schema 升级

文件:`lib/db/poju-db.ts`(扩展)

```typescript
const SCHEMA_VERSION = 9;  // 升级版本

db.version(SCHEMA_VERSION).stores({
  // ... 现有表
  
  // ⭐ 新增 syncro session 表
  syncro_sessions: 'session_id, profile_id, created_at, expires_at'
});
```

## Step 8.3: Syncro 入口检测已有 session

文件:`app/[locale]/syncro/page.tsx`(或 syncro/start)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { findActiveSyncroSession } from '@/lib/syncro/syncro-session-store';

export default function SyncroEntryPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [activeSession, setActiveSession] = useState<any>(null);
  
  useEffect(() => {
    checkExistingSession();
  }, []);
  
  async function checkExistingSession() {
    const profileId = await getSelectedProfileId();
    if (!profileId) {
      setChecking(false);
      return;
    }
    
    const session = await findActiveSyncroSession(profileId);
    if (session) {
      setActiveSession(session);
    }
    setChecking(false);
  }
  
  if (checking) return <Loading />;
  
  // ⭐ 关键:有未过期 session → 显示选项
  if (activeSession) {
    return <ExistingSessionPrompt session={activeSession} />;
  }
  
  return <SyncroNewTaskFlow />;
}

function ExistingSessionPrompt({ session }: { session: any }) {
  const router = useRouter();
  const remainingHours = Math.floor((session.expires_at - Date.now()) / 3600_000);
  
  return (
    <div className="existing-session-prompt">
      <div className="logo-mark">◇</div>
      
      <h1>Continue your reading?</h1>
      <p className="task-preview">
        "{session.task_description}"
      </p>
      
      <div className="session-meta">
        <i className="ti ti-clock" />
        <span>Valid for {remainingHours} more hours</span>
      </div>
      
      <button 
        className="continue-btn"
        onClick={() => router.push(`/${locale}/syncro/result/${session.session_id}`)}
      >
        Continue this reading
      </button>
      
      <button 
        className="new-task-btn"
        onClick={() => router.push(`/${locale}/syncro/new`)}
      >
        Start a new reading instead
      </button>
    </div>
  );
}
```

## 验证清单 - Part 8

```
□ 创建 Syncro session,记录 expires_at = now + 24h
□ 完成后切换到 POJU,再回 Syncro
□ 应该显示"Continue your reading? 还剩 X 小时"
□ 点击 Continue → 直接显示原数据,不重新生成
□ 24h 后过期,自动清理
□ 用户主动"Start a new reading"覆盖旧 session

🛑 等用户确认进入 Part 9
```

---

# 🟡 第 9 部分(P1):Syncro 时辰进度条 4 状态(含绿色)

## 问题描述

```
当前状态颜色:
  - 金色高亮 = 当前时辰
  - 金色圈 = 被选定的时辰
  - 其他都是灰色(让人以为"未生成")

用户困惑:不知道其他时辰是否已生成

新状态规范:
  - 金色高亮(大点)= 当前时辰 = NOW
  - 绿色 = 已生成可点击查看 = DONE
  - 灰色 = 未生成不可点击 = PENDING
  - 金色外圈 = 当前用户选择查看的 = SELECTED(可叠加在任何上)
```

## 修复

文件:`components/syncro/HourProgressBar.tsx`(修改)

```tsx
function getHourStatus(hour: any, currentHourId: string, matrixData: any): 
  'now' | 'done' | 'pending' {
  
  if (hour.id === currentHourId) return 'now';
  
  // 检查该时辰的所有 8 个 cell 是否都有 LLM 输出
  const cells = Object.keys(matrixData).filter(k => k.startsWith(`${hour.id}__`));
  if (cells.length === 0) return 'pending';
  
  const allDone = cells.every(k => 
    matrixData[k] && !matrixData[k].llm_pending
  );
  
  return allDone ? 'done' : 'pending';
}

// 渲染
{periods.map((period, idx) => {
  const status = getHourStatus(period, currentHourId, matrix);
  const isSelected = period.id === selectedHourId;
  
  return (
    <button
      key={period.id}
      className={`hour-dot status-${status} ${isSelected ? 'selected' : ''}`}
      onClick={() => status !== 'pending' && setSelectedHourId(period.id)}
      disabled={status === 'pending'}
      aria-label={`${period.name} · ${period.range}`}
    />
  );
})}
```

```css
/* === 4 状态颜色 === */

/* 当前时辰(金色大点)*/
.hour-dot.status-now {
  width: 10px;
  height: 10px;
  background: var(--pj-gold);
  box-shadow: 0 0 12px var(--pj-gold-glow);
}

/* ⭐ 已生成可点击(绿色)*/
.hour-dot.status-done {
  width: 6px;
  height: 6px;
  background: var(--pj-following);  /* #4ECDC4 青绿 */
  cursor: pointer;
}

.hour-dot.status-done:active {
  transform: scale(1.3);
}

/* 未生成(灰色不可点)*/
.hour-dot.status-pending {
  width: 5px;
  height: 5px;
  background: var(--pj-text-disabled);
  cursor: not-allowed;
  opacity: 0.6;
}

/* ⭐ 当前选择(金色外圈,叠加)*/
.hour-dot.selected:not(.status-now) {
  outline: 2px solid var(--pj-gold);
  outline-offset: 3px;
}

.hour-dot.selected.status-done {
  /* 选中的"已生成"点:绿色 + 金色圈 */
  outline: 2px solid var(--pj-gold);
  outline-offset: 3px;
}
```

## 图例说明(可选)

```tsx
// 在时辰进度条下方加一行小图例

<div className="hour-legend">
  <span className="legend-item">
    <span className="dot status-now" />
    {t('legend.now')}
  </span>
  <span className="legend-item">
    <span className="dot status-done" />
    {t('legend.done')}
  </span>
  <span className="legend-item">
    <span className="dot status-pending" />
    {t('legend.pending')}
  </span>
</div>
```

## 验证清单 - Part 9

```
□ 当前时辰显示金色大点
□ 已生成时辰显示绿色(可点击)
□ 未生成时辰显示灰色(不可点)
□ 点击绿色点 → 中心显示该时辰信息
□ 选中点(无论金/绿/灰)有金色外圈
□ 颜色语义清晰,用户一眼看懂

🛑 等用户确认进入 Part 10
```

---

# 🟡 第 10 部分(P1):Syncro 背景动效完整展示

## 问题描述

```
当前:背景动效被限制在某个框内,方位符圆没完整显示
应该:背景动效占满屏幕,方位符圆完整可见
```

## 修复

文件:`components/syncro/SyncroCompassMode.tsx`(或主容器)

```tsx
return (
  <div className="syncro-immersive">
    {/* 背景动效:占满整个屏幕(不被限制)*/}
    <div className="syncro-bg-full">
      <SplineParticles />
    </div>
    
    {/* 内容层:在背景之上,但不限制背景大小 */}
    <div className="syncro-content-overlay">
      <HourProgressBar ... />
      
      <div className="compass-particle-area">
        <SyncroParticleCircle ... />
        {/* 8 方位字标:完整圆形,可见 */}
        <DirectionLabels />
      </div>
      
      <div className="syncro-info-bottom">
        ...
      </div>
    </div>
  </div>
);
```

```css
.syncro-immersive {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.syncro-bg-full {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* ⭐ 关键:不要设 max-width 或 padding 限制 */
}

.syncro-bg-full canvas {
  width: 100% !important;
  height: 100% !important;
}

.syncro-content-overlay {
  position: relative;
  z-index: 10;
  height: 100%;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.syncro-content-overlay > * {
  pointer-events: auto;
}

/* ⭐ 粒子圆 + 方位字:确保完整圆形可见 */
.compass-particle-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 留出足够边距,8 个方位字不被截断 */
  padding: 40px 30px;
  position: relative;
}

.particle-circle {
  width: min(260px, 70vw);
  height: min(260px, 70vw);
  position: relative;
}

.direction-labels {
  /* 方位字在粒子圆外侧,确保不被屏幕边缘截断 */
  position: absolute;
  inset: -20px;  /* 比粒子圆大一圈 */
  pointer-events: none;
}
```

## 验证清单 - Part 10

```
□ 背景动效占满整个屏幕(无白边/黑框)
□ 粒子圆居中,8 个方位字标都可见
□ 不会被时辰条/底部 nav 遮挡到内容
□ 旋转手机时,方位字标随转,不消失

🛑 等用户确认进入 Part 11
```

---

# 🟡 第 11 部分(P1):Why-This-Current 不暴露代码

## 问题描述

```
当前 modal 显示:
  "主要因素:qimen, yong_shen_direction, ..."
  
这是内部 LLM 计算的 raw key,
不应该展示给用户。

正确做法:
  根据用户的【具体问题】,生成针对性解释
  
  例:用户问"明天 14:00 会议谈判"
  应该说:"会议谈判这种需要影响力的场景,东南方位
         的 Open Current 能放大你的气场..."
  
  而不是:"主要因素:qimen, yong_shen_direction"
```

## 修复

### Step 11.1: 重写 cell 的 rationale 字段

文件:`lib/llm/prompts/syncro-batch-prompt.ts`(修改 prompt)

```typescript
export function buildSyncroBatchPrompt(input: {
  matrix_slice: any;
  profile_summary: any;
  task_description: string;
  locale: string;
}) {
  const langInstruction = input.locale === 'zh' 
    ? '请用简体中文输出。' 
    : 'Output in English.';
  
  const system = `You are a Syncro analyzer for pojulife. 
Generate practical advice for each (hour × direction) cell.

# User's task
"${input.task_description}"

# Output format

For each cell, generate 3 fields:

1. **short_advice** (50-80 chars):
   一句话,直接告诉用户【该不该这么做】
   例:"东南方位的会议室,你的气场最舒展。"
   
2. **detailed_advice** (150-200 chars):
   2-3 句话,展开行动建议
   例:"东南方,巳时,你的用神水得木生。建议把谈判
       安排在 14:00-16:00 之间,选择东南朝向的座位,
       谈到具体数字时尽量在 14:30 之后。"
   
3. **rationale** (100-150 chars):
   ⚠️ 关键:针对【用户具体任务】解释为什么
   不要暴露内部字段名(qimen / yong_shen_direction / dayMaster 等)
   
   ❌ 错误示例:
   "主要因素:qimen, yong_shen_direction"
   "yong_shen_direction 对当前 hour pillar 有 sheng 关系"
   
   ✅ 正确示例(用户问会议谈判):
   "会议谈判需要你的气场稳定且能影响对方。这个时辰
    和方位的组合让你既有底气,又不咄咄逼人。"
   
   ✅ 正确示例(用户问签合同):
   "签合同需要清醒判断。这个组合让你头脑清晰,
    避开了情绪化决策的时段。"

# Language rules
${langInstruction}
${POJULIFE_LANGUAGE_RULES}

# Critical
- rationale 必须针对用户的具体任务,不是通用解释
- 绝不暴露内部计算字段名
- 用大白话,不用术语
`;
  
  return { system, user: buildUserMessage(input) };
}
```

### Step 11.2: 兜底:UI 层过滤内部 key 泄露

文件:`components/syncro/WhyThisCurrentModal.tsx`(增加过滤)

```tsx
const INTERNAL_KEYS_BLACKLIST = [
  'qimen',
  'yong_shen_direction',
  'yongShen',
  'dayMaster',
  'day_master',
  'hour_pillar',
  'birth_chart',
  'four_pillars',
  'tianGan',
  'diZhi'
];

function sanitizeRationale(text: string, locale: string): string {
  let result = text;
  
  // 删除"主要因素:" 这种格式
  result = result.replace(/^主要因素[::]\s*[^\n]+\n?/gm, '');
  result = result.replace(/^Key factors[::]\s*[^\n]+\n?/gim, '');
  
  // 把内部 key 替换为通用描述
  for (const key of INTERNAL_KEYS_BLACKLIST) {
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    result = result.replace(regex, locale === 'zh' ? '能量' : 'energy');
  }
  
  return result.trim();
}

// 渲染
<div className="why-rationale">
  {sanitizeRationale(cell.rationale, locale)}
</div>
```

## 验证清单 - Part 11

```
□ 跑 5 个不同任务的 Syncro
  - 会议谈判
  - 签合同  
  - 面试
  - 约会
  - 出差
□ 每个任务的 Why this current 都【针对该任务】解释
□ grep modal 内容:无 qimen / yong_shen / day_master 等内部 key
□ 不再有"主要因素:xxx"这种暴露格式

🛑 等用户确认进入 Part 12-14
```

---

# 🟡 第 12 部分(P1):Match UI 重复 + 按钮改毛玻璃

## 问题 12.1:删除重复文案

```
当前 Match A/B 选择页:
  - "命主 A" 标题
  - 然后下面有"选择或添加第一个人的八字信息"
  
这两段重复,删除其中一段(保留有信息量的)
```

文件:`components/match/MatchProfileSelector.tsx`(修改)

```tsx
// ❌ 删除:
// <h3>命主 A</h3>
// <p>选择或添加第一个人的八字信息</p>

// ✅ 改为(只保留一段):
<h3>{t('person_a.title')}</h3>
{/* 或者用更简洁的:*/}
<div className="selector-label">
  <span className="label-letter">A</span>
  <span className="label-text">{t('select_first_person')}</span>
</div>

// 命主 B 同理
```

## 问题 12.2:"开始 Match" 按钮改毛玻璃大按钮

文件:`components/match/MatchStartButton.tsx`

```tsx
return (
  <button 
    className="match-start-btn-glass"
    onClick={handleStart}
  >
    <span className="btn-icon">
      <i className="ti ti-heart-handshake" />
    </span>
    <span className="btn-text">{t('begin_match')}</span>
  </button>
);
```

```css
.match-start-btn-glass {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  max-width: 320px;
  padding: 20px 32px;
  margin: 32px auto;
  
  /* 毛玻璃效果 */
  background: rgba(212, 165, 116, 0.15);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  
  color: var(--pj-gold);
  font-family: inherit;
  font-size: 18px;  /* ⭐ 大字号 */
  font-weight: var(--pj-weight-medium);
  letter-spacing: 0.3px;
  border-radius: 20px;
  
  /* 微妙的发光 */
  box-shadow: 
    0 0 32px rgba(212, 165, 116, 0.2),
    inset 0 0 0 0.5px rgba(212, 165, 116, 0.4);
  
  cursor: pointer;
  transition: all var(--pj-duration-fast) var(--pj-ease);
}

.match-start-btn-glass:active {
  transform: scale(0.98);
  background: rgba(212, 165, 116, 0.22);
}

.btn-icon {
  font-size: 22px;
}
```

## 验证清单 - Part 12

```
□ Match A/B 选择页无重复文案
□ "开始 Match" 按钮大、清晰、毛玻璃质感
□ 按钮按下有反馈
□ 易点(整个区域响应)

🛑 等用户确认进入 Part 13
```

---

# 🟢 第 13 部分(P2):POJU 隐藏调试信息

## 问题描述

```
用户进入 POJU 聊天页面,看到:
  - "Agent 阶段"
  - "高级"
  - "Step 7"(为什么不是 Step 1?)

这些是【内部调试信息】,不应该展示给用户。
```

## 修复方案

```
两个层面:

1. 立刻隐藏(UI 层):
   生产环境不渲染这些调试 UI

2. 长期(架构层):
   把这些调试信息只在 NODE_ENV=development 显示
```

文件:`components/poju/POJUDebugPanel.tsx`(如果存在,改造)

```tsx
'use client';

// ⛔ 不要给用户看的字段

export function POJUDebugPanel({ ... }) {
  // ⭐ 只在开发环境显示
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <div className="debug-panel" style={{ opacity: 0.5 }}>
      <div>Agent Phase: {phase}</div>
      <div>Step: {stepNumber}</div>
      {/* ... 其他调试信息 */}
    </div>
  );
}
```

如果调试信息散落在主 UI 中,找出并移除:

```bash
# 让 Cursor 全站搜索:
grep -rn "Agent 阶段\|Agent Phase\|高级\|Advanced.*Mode" \
  components/poju/ --include="*.tsx"

grep -rn "Step [0-9]\|step_[0-9]" components/poju/ --include="*.tsx"
```

对所有匹配:
- 如果是调试用 → 删除或 wrap 在 `{NODE_ENV === 'development' && ...}`
- 如果是产品逻辑 → 但用了"Step"字眼 → 改成产品语言

## 关于"Step 7"的特殊处理

```
最可能原因:
  内部 phase 系统:opening(1) → collecting(2) → ... → delivery(7) → tracking(8)
  某处把 phase 索引当成 "Step N" 显示给用户了

修复:
  - 把 phase 名称的显示完全隐藏
  - 用户应该看到的是【内容】,不是【步骤号】
  - 或者用户友好的进度提示("Understanding your situation" 等),
    不是数字
```

## 验证清单 - Part 13

```
□ 生产环境(NODE_ENV=production):
  - 不显示 "Agent 阶段"
  - 不显示 "高级"
  - 不显示 "Step 7"
  - 不显示任何 phase 名称
□ 开发环境(NODE_ENV=development):
  - 调试信息仍可见(便于排查)
□ 用户看到的只有【对话内容】

🛑 等用户确认全部完成
```

---

# 总结

```
本任务完成后,解决用户反馈的 13 个具体问题:

P0(影响核心功能):
  ✅ Part 1: 安卓 PWA 假安装 → Chrome 引导
  ✅ Part 2: 出生地保存丢失 → 排查 + 修复
  ✅ Part 3: Match B 未分析就失败 → 自动先生成 B
  ✅ Part 4: Glyph "签" 违禁词 → prompt 加强 + 兜底过滤

P1(影响体验):
  ✅ Part 5: 准备页文案改成隐私承诺
  ✅ Part 6: 流式动效缩小 + 底部 + 思考阶段滚动文本
  ✅ Part 7: Syncro 三模式手动切换(取消姿势自动)
  ✅ Part 8: Syncro 24h Session 复用
  ✅ Part 9: 时辰进度条 4 状态(含绿色 done)
  ✅ Part 10: Syncro 背景动效完整展示
  ✅ Part 11: Why-this-current 不暴露内部 key
  ✅ Part 12: Match UI 重复 + 按钮毛玻璃

P2(清理):
  ✅ Part 13: POJU 隐藏 Agent 阶段 / Step 7 等调试信息
```

---

**Cursor:严格按 Part 1 → Part 13 顺序实施。每个 Part 完成后贴出修改 + 测试,等用户确认才进入下一步。**
