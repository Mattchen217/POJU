# Glyph v5.0 重构指令 · Cursor 完整任务

> **目标**:Glyph 跟 POJU 共用八字采集系统 + 切换到 DeepSeek V4 Pro
>
> **前提**:POJU v5.0 已完成(stored_profiles + ProfileSelector + ORIENTAL_COUNSELOR_BASE)
>
> **执行原则**:严格【一步一停】,每个 Step 完成后贴出输出等用户确认

---

# ⚠️ Cursor 必读

```
Glyph 当前状态:
  ✗ 使用 Gemini 而非 DeepSeek
  ✗ 自己一套表单(不复用 POJU 的)
  ✗ 没有完整八字分析,只有简化数据
  ✗ Prompt 缺少玄学定位

本次重构:
  ✓ 复用 POJU 的 stored_profiles 系统
  ✓ 复用 POJU 的 ProfileSelector 组件
  ✓ 复用 POJU 的 base_analysis(永久缓存)
  ✓ 切换到 DeepSeek V4 Pro thinking high
  ✓ 输入 = 完整八字 JSON + 签文 + 用户问题
  ✓ 输出 = 5 段结构化解读(用户语言)
  ✓ 报告自动存入 Archive(glyph_reading 分类)

绝不允许:
  ✗ 重新设计八字采集(必须复用 POJU 的)
  ✗ 跨 Step 实施
  ✗ 保留任何 Gemini 调用代码
  ✗ 擅自简化签文数据传入

每个 Step 完成后:
  - 贴出代码 + 测试输出
  - 等用户明确"通过 Step X,进入 Step X+1"
```

---

# 第 1 部分:Step 1 - Glyph 当前状态自查

## Step 1:盘点现有 Glyph 实现

```
任务:

1. 列出以下文件是否存在 + 当前实现概况:

   Glyph 路由:
   □ app/[locale]/(marketing)/glyph/page.tsx
   □ app/[locale]/(marketing)/glyph/draw/page.tsx
   □ app/[locale]/(marketing)/glyph/reading/[id]/page.tsx
   □ app/api/oracle/draw/route.ts
   □ app/api/oracle/full-reading/route.ts
   □ app/api/oracle/free-snippet/route.ts (如有)
   
   Glyph 组件:
   □ components/glyph/GlyphCanvas.tsx (抽签动画)
   □ components/glyph/GlyphReport.tsx (5 段报告显示)
   □ components/glyph/QuestionInput.tsx
   □ components/glyph/* (其他)
   
   Glyph LLM 调用:
   □ lib/llm/glyph-prompts.ts (旧)
   □ lib/llm/glyph-service.ts (如有)
   
   Glyph 数据:
   □ data/glyphs.json (签文数据)
   □ lib/glyph/storage.ts (使用记录)
   □ lib/glyph/types.ts

2. 对每个文件贴出:
   - 行数
   - 核心导出函数
   - 当前 LLM 是谁(Gemini/Anthropic/其他)

3. 检查使用情况:
   - Glyph 是否还在依赖 @google/generative-ai?
   - Glyph 是否还有自己的 BirthInfoForm?
   - 当前是否调用了 stored_profiles?

4. 检查 IndexedDB:
   - glyph_history 表当前结构
   - 是否有跟 stored_profiles 关联?

5. 报告:
   - 哪些文件可以保留
   - 哪些需要重写
   - 哪些需要删除
   - 任何阻塞问题

6. ⚠️ 不要立即改代码,只做诊断报告

完成后,贴出报告等用户确认。
```

## 验证清单

```
□ 列出所有 Glyph 相关文件
□ 报告每个文件状态
□ 报告 LLM 当前是谁
□ 报告 stored_profiles 是否已集成

🛑 等用户确认进入 Step 2
```

---

# 第 2 部分:Step 2 - 清理旧 Gemini 调用

## Step 2:删除冲突代码

```
任务:

1. 删除/重命名以下文件(根据 Step 1 自查结果):

   要删除:
   □ lib/llm/glyph-prompts.ts (旧 Gemini prompts)
   □ Glyph 中所有 @google/generative-ai 的 import
   
   要保留:
   ✓ data/glyphs.json (签文库)
   ✓ components/glyph/GlyphCanvas.tsx (UI)
   ✓ components/glyph/GlyphReport.tsx (5 段渲染)

2. 检查并移除 @google/generative-ai 依赖(如果只用于 Glyph):
   
   先 grep:
   grep -r "@google/generative-ai" .
   grep -r "GoogleGenerativeAI" .
   
   如果只在 Glyph 中使用,可以 pnpm remove:
   pnpm remove @google/generative-ai
   
   但如果其他地方还在用,保留依赖,只移除 Glyph 中的 import

3. 创建空文件(等后续 Step 实施):

   新建空文件:
   □ lib/llm/prompts/glyph-deepseek-prompt.ts
   □ lib/llm/services/glyph-reading-service.ts
   □ components/glyph/GlyphProfileSelector.tsx (复用 POJU 的 ProfileSelector)

4. 检查 tsc:
   pnpm exec tsc --noEmit
   
   会有大量 import 错误,这是正常的(等 Step 3-6 修复)

5. git commit 一次:
   git add .
   git commit -m "chore: cleanup Glyph before v5.0 refactor"

完成后贴出 git status,等用户确认。
```

## 验证清单

```
□ 删除的文件已删除
□ @google/generative-ai 移除(或仅 Glyph 中)
□ 新建空文件已创建
□ git commit 完成
□ tsc 报错列表(待后续修复)

🛑 等用户确认进入 Step 3
```

---

# 第 3 部分:Step 3 - Glyph 入口集成 ProfileSelector

## Step 3:Glyph 入口页面改造

```
任务:

Glyph 用户流程:
  1. 用户进入 /glyph
  2. 看到欢迎词 + 抽签介绍
  3. 点击 "Start" → 检查是否有免费额度 / 付费
  4. 进入 /glyph/prepare → 选择八字(复用 POJU 的 ProfileSelector)
  5. 选择/创建八字 → 触发 base_analysis(如未生成)
  6. 跳转到 /glyph/draw → 输入问题 + 抽签
  7. 跳转到 /glyph/reading/[id] → 显示报告

本 Step:实现 1-5
```

### Step 3.1: 创建 /glyph/prepare 路由

文件:`app/[locale]/(marketing)/glyph/prepare/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { 
  listStoredProfiles,
  type StoredProfileSummary 
} from '@/lib/profile/stored-profiles-service';
import { SessionPreparation } from '@/components/poju/SessionPreparation';
import { GlyphWelcome } from '@/components/glyph/GlyphWelcome';

export default function GlyphPreparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  
  const sessionType = searchParams.get('type') || 'paid';  // 'free' | 'paid'
  
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadProfiles();
  }, []);
  
  async function loadProfiles() {
    try {
      const list = await listStoredProfiles();
      setProfiles(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }
  
  function handleProfileSelected(profileId: string) {
    // 跳转到 /glyph/draw,带上 profile_id
    router.push(`/${locale}/glyph/draw?profile=${profileId}&type=${sessionType}`);
  }
  
  function handleRefund() {
    // Glyph 没有退款流程(便宜),直接回主页
    router.push(`/${locale}/glyph`);
  }
  
  if (loading) {
    return <div className="loading-fullscreen">Loading...</div>;
  }
  
  return (
    <div className="glyph-prepare-page">
      {/* 复用 POJU 的 SessionPreparation 组件,但传不同的 product 类型 */}
      <SessionPreparation
        sessionId="glyph-temp"  // Glyph 没有 session 概念,临时占位
        originalQuestion=""      // Glyph 的问题在 /glyph/draw 输入
        existingProfiles={profiles}
        onProfileSelected={handleProfileSelected}
        onRefund={handleRefund}
        locale={locale}
        productType="glyph"      // ⭐ 新增 prop,改变文案
      />
    </div>
  );
}
```

### Step 3.2: 修改 SessionPreparation 支持 productType

文件:`components/poju/SessionPreparation.tsx`

```typescript
interface Props {
  sessionId: string;
  originalQuestion: string;
  existingProfiles: StoredProfileSummary[];
  onProfileSelected: (profileId: string) => void;
  onRefund: () => void;
  locale: string;
  productType?: 'poju' | 'glyph' | 'syncro';  // ⭐ 新增
}

// 修改 WelcomeSection,接受 productType:
function WelcomeSection({ 
  locale, 
  originalQuestion, 
  productType = 'poju' 
}: any) {
  
  const welcomeText = getWelcomeText(locale, productType);
  
  return (
    <div className="welcome-section">
      <div className="poju-logo">
        {productType === 'glyph' ? 'GLYPH' : 'POJU'}
      </div>
      <p className="welcome-text">{welcomeText}</p>
      
      {originalQuestion && (
        <div className="your-question">
          <span className="label">{getQuestionLabel(locale)}</span>
          <p className="question-text">"{originalQuestion}"</p>
        </div>
      )}
    </div>
  );
}

function getWelcomeText(locale: string, productType: string): string {
  const isZh = locale.startsWith('zh');
  
  if (productType === 'glyph') {
    return isZh
      ? `欢迎来到 Glyph。Glyph 结合你的八字命局与古典签文,
         为你抽出当下处境的指引。请提供你的基础能量数据。`
      : `Welcome to Glyph. Glyph weaves your bazi foundation with classical 
         oracle wisdom to illuminate your present moment. Please provide 
         your foundational energy data.`;
  }
  
  if (productType === 'syncro') {
    return isZh
      ? `欢迎来到 Syncro。Syncro 用你的命局测算最适合行动的时辰与方位。`
      : `Welcome to Syncro. Syncro uses your chart to find optimal timing 
         and direction for your actions.`;
  }
  
  // POJU 默认
  return isZh
    ? `欢迎来到 POJU。POJU 是你的东方破局顾问...`
    : `Welcome to POJU. POJU is your Eastern breakthrough counselor...`;
}
```

### Step 3.3: Glyph 主页改造

文件:`app/[locale]/(marketing)/glyph/page.tsx`

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { checkGlyphUsage } from '@/lib/glyph/storage';

export default function GlyphHomePage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('glyph');
  
  const [hasUsedFree, setHasUsedFree] = useState(false);
  const [checking, setChecking] = useState(true);
  
  useEffect(() => {
    checkUsage();
  }, []);
  
  async function checkUsage() {
    try {
      const usage = await checkGlyphUsage();
      setHasUsedFree(usage.has_used_free);
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }
  }
  
  function handleStartFree() {
    // 免费版,直接进入 prepare
    router.push(`/${locale}/glyph/prepare?type=free`);
  }
  
  function handleStartPaid() {
    // 付费版,先付款
    router.push(`/${locale}/glyph/payment?amount=1.99`);
  }
  
  if (checking) {
    return <div className="loading-fullscreen">Loading...</div>;
  }
  
  return (
    <div className="glyph-home">
      <div className="glyph-hero">
        <h1 className="glyph-title">GLYPH</h1>
        <p className="glyph-subtitle">{t('subtitle')}</p>
        <p className="glyph-description">{t('description')}</p>
      </div>
      
      <div className="glyph-actions">
        {!hasUsedFree ? (
          <button onClick={handleStartFree} className="primary">
            {t('start_free')}
          </button>
        ) : (
          <button onClick={handleStartPaid} className="primary">
            {t('start_paid')} - $1.99
          </button>
        )}
      </div>
    </div>
  );
}
```

### Step 3.4: 翻译补充

文件:`messages/en/glyph.json`

```json
{
  "subtitle": "60-second oracle reading",
  "description": "Draw a glyph for the moment you're in. Your chart + the classical wisdom = clarity in 60 seconds.",
  "start_free": "Draw your first glyph (free)",
  "start_paid": "Draw a new glyph"
}
```

文件:`messages/zh/glyph.json`

```json
{
  "subtitle": "60 秒签文指引",
  "description": "为你当下的处境抽一支签。命局 + 古典智慧 = 60 秒清明。",
  "start_free": "抽你的第一支签(免费)",
  "start_paid": "再抽一支"
}
```

## 验证清单

```
□ /glyph/prepare 路由可访问
□ ProfileSelector 显示 Glyph 文案(不是 POJU)
□ 已有八字 / 添加新八字 都能工作
□ 选择后跳转 /glyph/draw?profile=xxx
□ Glyph 主页根据使用情况显示不同按钮
□ 5 语言翻译完成

测试:
  1. 访问 /glyph → 看到主页
  2. 点击 "Start" → 跳转 /glyph/prepare
  3. 看到 GLYPH 欢迎词(不是 POJU)
  4. 选择已有八字 → 弹确认对话框 → 跳转 /glyph/draw

🛑 等用户确认进入 Step 4
```

---

# 第 4 部分:Step 4 - Glyph 抽签流程改造

## Step 4:/glyph/draw 页面

```
任务:

用户在 /glyph/draw?profile=xxx 页面:
1. 显示用户已选的八字(简短显示日期)
2. 输入框:What's on your mind?
3. 字数限制 60-200 字符
4. 点击 "Draw" → 触发抽签
5. 显示抽签动画
6. 完成后跳转 /glyph/reading/[id]
```

### Step 4.1: /glyph/draw 页面

文件:`app/[locale]/(marketing)/glyph/draw/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { getStoredProfile } from '@/lib/profile/stored-profiles-service';
import { generateBaseAnalysis } from '@/lib/llm/deepseek/base-analysis';
import { GlyphCanvas } from '@/components/glyph/GlyphCanvas';
import { ChartReadingLoader } from '@/components/poju/ChartReadingLoader';

export default function GlyphDrawPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('glyph');
  
  const profileId = searchParams.get('profile');
  const sessionType = searchParams.get('type') || 'free';
  
  const [profile, setProfile] = useState<any>(null);
  const [stage, setStage] = useState<'preparing' | 'input' | 'drawing' | 'done'>('preparing');
  const [question, setQuestion] = useState('');
  const [drawnGlyph, setDrawnGlyph] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!profileId) {
      router.push(`/${locale}/glyph`);
      return;
    }
    
    initializeProfile();
  }, [profileId]);
  
  async function initializeProfile() {
    try {
      const p = await getStoredProfile(profileId!);
      if (!p) {
        setError('Profile not found');
        return;
      }
      setProfile(p);
      
      // 如果没有 base_analysis,生成
      if (!p.base_analysis?.content) {
        // 进入 preparing 状态,生成 base
        await generateBaseAnalysis(profileId!);
        // 重新加载
        const updated = await getStoredProfile(profileId!);
        setProfile(updated);
      }
      
      setStage('input');
    } catch (e: any) {
      setError(e.message);
    }
  }
  
  async function handleDraw() {
    if (!question.trim() || question.length < 10) return;
    
    setStage('drawing');
    
    try {
      // 调用抽签 API
      const response = await fetch('/api/oracle/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: profileId,
          question: question.trim(),
          session_type: sessionType,
          locale
        })
      });
      
      if (!response.ok) {
        throw new Error('Draw failed');
      }
      
      const data = await response.json();
      setDrawnGlyph(data.glyph);
      
      // 等待抽签动画
      await new Promise(r => setTimeout(r, 3000));
      
      // 跳转到 reading 页面
      router.push(`/${locale}/glyph/reading/${data.reading_id}`);
    } catch (e: any) {
      setError(e.message);
      setStage('input');
    }
  }
  
  if (stage === 'preparing') {
    return (
      <ChartReadingLoader
        profile={profile}
        currentStep="analyzing"
        error={error}
        onRetry={() => initializeProfile()}
        onRefund={() => router.push(`/${locale}/glyph`)}
        locale={locale}
      />
    );
  }
  
  if (stage === 'input') {
    return (
      <div className="glyph-input-page">
        <div className="profile-mini-display">
          <span>{t('reading_for_label')}</span>
          <span className="profile-name">{profile?.user_profile?.birth_info ? formatBirthShort(profile) : ''}</span>
        </div>
        
        <h2 className="input-title">{t('input_title')}</h2>
        <p className="input-hint">{t('input_hint')}</p>
        
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value.slice(0, 200))}
          placeholder={t('input_placeholder')}
          rows={5}
          autoFocus
        />
        
        <div className="char-count">
          {question.length} / 200
        </div>
        
        <button
          onClick={handleDraw}
          disabled={question.trim().length < 10}
          className="draw-button"
        >
          {t('draw_button')}
        </button>
      </div>
    );
  }
  
  if (stage === 'drawing') {
    return (
      <div className="glyph-drawing-page">
        <GlyphCanvas glyph={drawnGlyph} animated={true} />
        <p className="drawing-text">{t('drawing_text')}</p>
      </div>
    );
  }
  
  return null;
}

function formatBirthShort(profile: any): string {
  if (!profile?.user_profile?.birth_info) return '';
  const b = profile.user_profile.birth_info;
  return `${b.year}.${String(b.month).padStart(2, '0')}.${String(b.day).padStart(2, '0')}`;
}
```

### Step 4.2: 修改抽签 API

文件:`app/api/oracle/draw/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { drawGlyphFromPool } from '@/lib/glyph/draw';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { profile_id, question, session_type, locale } = body;
    
    if (!profile_id || !question) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    
    // 抽签(从 glyphs.json 中)
    const glyph = await drawGlyphFromPool();
    
    // 生成 reading_id
    const readingId = uuidv4();
    
    return NextResponse.json({
      reading_id: readingId,
      glyph: {
        id: glyph.id,
        name: glyph.name,
        wind_category: glyph.wind_category,
        // 其他字段在 reading 页面再 fetch
      },
      profile_id,
      question,
      session_type,
      locale
    });
  } catch (e: any) {
    console.error('[draw] error:', e);
    return NextResponse.json({ error: 'draw_failed', message: e.message }, { status: 500 });
  }
}
```

### Step 4.3: 翻译补充

`messages/en/glyph.json` 补充:

```json
{
  "reading_for_label": "Reading for",
  "input_title": "What's on your mind?",
  "input_hint": "Describe the situation, dilemma, or question you're holding right now. 60-200 characters.",
  "input_placeholder": "e.g., I'm caught between two job offers and need to decide...",
  "draw_button": "Draw your glyph",
  "drawing_text": "Drawing your glyph..."
}
```

`messages/zh/glyph.json` 补充:

```json
{
  "reading_for_label": "为",
  "input_title": "你现在心里在想什么?",
  "input_hint": "描述你正面对的处境、困境或问题。60-200 字。",
  "input_placeholder": "例如:我现在在两个工作 offer 之间犹豫...",
  "draw_button": "抽出你的签",
  "drawing_text": "正在抽签..."
}
```

## 验证清单

```
□ /glyph/draw 页面可访问
□ Profile 加载成功
□ 如果无 base_analysis,自动生成
□ 输入框显示
□ 字数限制工作
□ 点击 "Draw" 调用 API 成功
□ 抽签动画显示
□ 自动跳转 reading 页面

🛑 等用户确认进入 Step 5
```

---

# 第 5 部分:Step 5 - Glyph DeepSeek Prompt 设计

## Step 5:Glyph 的 Prompt(玄学定位 + 双视角)

### Step 5.1: Glyph DeepSeek Prompt

文件:`lib/llm/prompts/glyph-deepseek-prompt.ts`

```typescript
import { 
  ORIENTAL_COUNSELOR_BASE,
  buildCurrentDateContext,
  buildProfileContextSection 
} from './oriental-counselor-base';

export function buildGlyphReadingPrompt(input: {
  profile: any;
  question: string;
  glyph: {
    id: number;
    name: string;
    wind_category: string;
    classical_text: string;
    modern_translation: string;
    key_themes: string[];
  };
  locale: string;
}): { system: string; user: string } {
  
  const { profile, question, glyph, locale } = input;
  const baseAnalysis = profile?.base_analysis?.content;
  
  // ============= System Prompt =============
  
  const system = `${ORIENTAL_COUNSELOR_BASE}

${buildCurrentDateContext()}

${buildProfileContextSection(profile, baseAnalysis)}

# 当前任务:Glyph 签文解读

用户抽到了一支签,你要结合用户的命局 + 签文,做一次【深度双视角解读】。

# 用户的问题
"${question}"

# 抽到的签

签号:${glyph.id}
签名:${glyph.name}
风类:${glyph.wind_category}
古典原文:${glyph.classical_text}
现代翻译:${glyph.modern_translation}
关键主题:${glyph.key_themes.join('、')}

# 你的解读原则

1. **双视角整合**(关键!)
   - 命理视角:从用户八字 + 当前大运 + 用神看此事
   - 签文视角:从抽到的卦象 / 签意看此事
   - 这两个视角【必须互相印证或互相冲突】
     ✓ 印证 → 这是天意明确的信号
     ✗ 冲突 → 用户在两种力量之间,需要选择

2. **玄学定位**(继承 POJU)
   - 你是【东方破局顾问】不是占卜师
   - 用命理术语 + 解释
   - 不预测具体未来
   - 给出可执行的反思方向 + 1 个具体内观练习

3. **签文等级感**
   不同 wind_category 有不同的语调:
   - Divine Tailwind / 天德顺风: 庆祝感,几乎敬畏
   - Fair Sky / 晴和: 平静鼓励
   - Still Water / 止水: 沉静,不急
   - Crosswind / 横风: 诚实正视
   - Eye of Storm / 风眼: 出人意料的深度

# 输出格式(严格 JSON,无 markdown)

\`\`\`json
{
  "wind_category_blurb": "30-50 字。介绍这个风类的整体氛围",
  
  "classical_voice": "50-80 字。把古典签意用平实的话讲清楚",
  
  "命理双视角": {
    "命理看此事": "200-400 字。从八字命局看此事的本质",
    "签文看此事": "200-400 字。从签文看此事的指引",
    "两者印证或冲突": "100-200 字。这两个视角是印证还是冲突,什么意思"
  },
  
  "meaning_for_question": "180-280 字。深度解读 = 签 × 命局 × 用户具体问题。要引用具体命理元素(日主/大运/用神),也要引用签文意象。",
  
  "hidden_tension": "60-100 字。用户可能看不到的张力或盲点",
  
  "your_moment": "80-120 字。当前的时间能量(基于当前流年干支)+ 它如何跟签互动",
  
  "exploration": {
    "text": "60-90 字。一个具体的内观练习。Solo。具体到时间/场地/做什么。",
    "timeframe": "today | tonight | within_24h | this_week",
    "duration_estimate": "X minutes",
    "is_solo": true
  },
  
  "reflection_question": "40-60 字。一个深思的问题(不是命令,是邀请)",
  
  "_meta": {
    "glyph_id": ${glyph.id},
    "glyph_name": "${glyph.name}",
    "wind_category": "${glyph.wind_category}"
  }
}
\`\`\`

# 严格要求

1. **全部字段填充**(JSON 不能缺字段)
2. **使用用户语言**(检测 question 的语言)
   - 检测到的语言: ${detectLanguage(question)}
   - 全部 JSON 字符串用此语言
3. **命理术语保留 + 解释**
   ✓ "你日主乙木,生于寅月,本是木得月令..."
4. **签文引用**
   ✓ "这签是 '夜雨敲窗'(夜里下雨打着窗户),象征..."
5. **总字数 1500-3000**(中文)/ 1200-2400(英文)
6. **严格 JSON**,无 markdown 包裹

# 不要做的事

- 不预测具体未来(几月几号会发生)
- 不下命运定论
- 不替用户做决定(给视角,选择权在用户)
- 不复述签文古文(已经在上面了)
- 不暴露你的内部思考给用户
`;
  
  const user = `请基于上述命局 + 签文,生成完整的解读 JSON。`;
  
  return { system, user };
}

function detectLanguage(text: string): string {
  if (/[\u4e00-\u9fa5]/.test(text)) return 'Chinese (Simplified)';
  if (/[áéíóúñ¿¡]/i.test(text)) return 'Spanish';
  if (/[àâäéèêëîïôöùûüÿç]/i.test(text)) return 'French';
  if (/[äöüß]/i.test(text)) return 'German';
  return 'English';
}
```

### Step 5.2: Glyph 服务

文件:`lib/llm/services/glyph-reading-service.ts`

```typescript
import { callLLM } from '@/lib/llm/router';
import { buildGlyphReadingPrompt } from '@/lib/llm/prompts/glyph-deepseek-prompt';
import { getStoredProfile, recordProfileUsage } from '@/lib/profile/stored-profiles-service';

export interface GlyphReadingResult {
  reading: {
    wind_category_blurb: string;
    classical_voice: string;
    命理双视角: {
      命理看此事: string;
      签文看此事: string;
      两者印证或冲突: string;
    };
    meaning_for_question: string;
    hidden_tension: string;
    your_moment: string;
    exploration: {
      text: string;
      timeframe: string;
      duration_estimate: string;
      is_solo: boolean;
    };
    reflection_question: string;
    _meta: any;
  };
  
  meta: {
    model: string;
    tokens_used: number;
    cost_usd: number;
    latency_ms: number;
  };
}

export async function generateGlyphReading(input: {
  profile_id: string;
  question: string;
  glyph: any;
  locale: string;
}): Promise<GlyphReadingResult> {
  // 1. 加载 profile
  const profile = await getStoredProfile(input.profile_id);
  if (!profile) throw new Error('Profile not found');
  
  // 2. 检查 base_analysis
  if (!profile.base_analysis?.content) {
    throw new Error('Profile has no base_analysis. Run prepare first.');
  }
  
  // 3. 构建 prompt
  const { system, user } = buildGlyphReadingPrompt({
    profile,
    question: input.question,
    glyph: input.glyph,
    locale: input.locale
  });
  
  console.log('[glyph-reading] Calling DeepSeek V4 Pro thinking...');
  
  // 4. 调用 DeepSeek V4 Pro(high thinking)
  const result = await callLLM({
    call_type: 'deep_analysis',  // ⭐ 这会触发 DeepSeek high thinking
    system,
    messages: [{ role: 'user', content: user }],
    max_tokens: 10000,
    thinking_effort: 'high',
    response_format: 'json'
  });
  
  // 5. 解析 JSON
  let reading: any;
  try {
    const cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    reading = JSON.parse(cleaned);
  } catch (e: any) {
    console.error('[glyph-reading] JSON parse failed:', e.message);
    console.error('Raw content (first 500):', result.content.slice(0, 500));
    throw new Error('Glyph reading output is not valid JSON');
  }
  
  // 6. 校验必需字段
  if (!reading.meaning_for_question || !reading.exploration) {
    throw new Error('Glyph reading missing required fields');
  }
  
  // 7. 记录使用
  await recordProfileUsage(input.profile_id, 'glyph');
  
  return {
    reading,
    meta: {
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      cost_usd: result.meta.cost_usd || 0,
      latency_ms: result.meta.latency_ms
    }
  };
}
```

## 验证清单

```
□ glyph-deepseek-prompt.ts 实现
□ glyph-reading-service.ts 实现
□ 包含玄学定位(ORIENTAL_COUNSELOR_BASE)
□ 包含日期 context
□ 包含 profile + base_analysis
□ 双视角(命理 + 签文)
□ DeepSeek V4 Pro high thinking
□ 输出严格 JSON

🛑 等用户确认进入 Step 6
```

---

# 第 6 部分:Step 6 - Glyph Full Reading API + 显示

## Step 6:/api/oracle/full-reading + reading 页面

### Step 6.1: Full Reading API

文件:`app/api/oracle/full-reading/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { generateGlyphReading } from '@/lib/llm/services/glyph-reading-service';
import { loadGlyphById } from '@/lib/glyph/load-glyph';
import { saveGlyphReadingToArchive } from '@/lib/archive/archive-service';

export const runtime = 'nodejs';
export const maxDuration = 120;  // DeepSeek thinking 需要时间

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      reading_id, 
      profile_id, 
      glyph_id, 
      question, 
      session_type,
      locale 
    } = body;
    
    if (!profile_id || !glyph_id || !question || !reading_id) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    
    // 1. 加载签文完整数据
    const glyph = await loadGlyphById(glyph_id);
    if (!glyph) {
      return NextResponse.json({ error: 'glyph_not_found' }, { status: 404 });
    }
    
    // 2. 生成 reading
    const result = await generateGlyphReading({
      profile_id,
      question,
      glyph,
      locale
    });
    
    // 3. 保存到 Archive(共用 POJU 的 Archive 系统)
    const archiveId = await saveGlyphReadingToArchive({
      reading_id,
      profile_id,
      question,
      glyph_id,
      glyph_name: glyph.name,
      wind_category: glyph.wind_category,
      reading: result.reading
    });
    
    return NextResponse.json({
      success: true,
      reading: result.reading,
      glyph,
      archive_id: archiveId,
      meta: {
        model: result.meta.model,
        latency_ms: result.meta.latency_ms,
        cost_usd: result.meta.cost_usd
      }
    });
  } catch (e: any) {
    console.error('[full-reading] error:', e);
    return NextResponse.json({
      error: 'reading_failed',
      message: e.message
    }, { status: 500 });
  }
}
```

### Step 6.2: 加载签文工具函数

文件:`lib/glyph/load-glyph.ts`

```typescript
import glyphsData from '@/data/glyphs.json';

export async function loadGlyphById(id: number): Promise<any | null> {
  // glyphsData 可能是数组,根据你的实际结构调整
  const glyph = (glyphsData as any[]).find(g => g.id === id);
  return glyph || null;
}
```

### Step 6.3: Archive 服务扩展(支持 Glyph)

文件:`lib/archive/archive-service.ts`(扩展)

```typescript
// 在已有的 archive-service.ts 中添加:

export interface GlyphReadingArchiveData {
  reading_id: string;
  profile_id: string;
  question: string;
  glyph_id: number;
  glyph_name: string;
  wind_category: string;
  delivered_at: string;
  reading: any;  // 完整 reading JSON
}

export async function saveGlyphReadingToArchive(input: {
  reading_id: string;
  profile_id: string;
  question: string;
  glyph_id: number;
  glyph_name: string;
  wind_category: string;
  reading: any;
}): Promise<string> {
  const deviceId = getDeviceId();
  if (!deviceId) throw new Error('App not initialized');
  
  const archiveId = uuidv4();
  const now = new Date();
  
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const title = `Glyph: ${input.glyph_name} - ${dateStr}`;
  
  const data: GlyphReadingArchiveData = {
    reading_id: input.reading_id,
    profile_id: input.profile_id,
    question: input.question,
    glyph_id: input.glyph_id,
    glyph_name: input.glyph_name,
    wind_category: input.wind_category,
    delivered_at: now.toISOString(),
    reading: input.reading
  };
  
  const { ciphertext, iv } = await encrypt(data);
  
  await db.archive.put({
    archive_id: archiveId,
    device_id: deviceId,
    type: 'glyph_reading',
    profile_id: input.profile_id,
    title,
    encrypted_data: ciphertext,
    iv,
    created_at: now,
    product: 'glyph'
  });
  
  return archiveId;
}

export async function loadGlyphReading(archiveId: string): Promise<GlyphReadingArchiveData | null> {
  const record = await db.archive.get(archiveId);
  if (!record || record.type !== 'glyph_reading') return null;
  
  try {
    return await decrypt(record.encrypted_data, record.iv);
  } catch (e) {
    return null;
  }
}
```

### Step 6.4: Reading 页面

文件:`app/[locale]/(marketing)/glyph/reading/[id]/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { GlyphCanvas } from '@/components/glyph/GlyphCanvas';
import { GlyphReport } from '@/components/glyph/GlyphReport';

export default function GlyphReadingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('glyph');
  
  const readingId = params.id as string;
  
  const [stage, setStage] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    generateReading();
  }, [readingId]);
  
  async function generateReading() {
    try {
      const profileId = searchParams.get('profile');
      const glyphId = searchParams.get('glyph_id');
      const question = searchParams.get('question');
      const sessionType = searchParams.get('type') || 'free';
      
      if (!profileId || !glyphId || !question) {
        // 尝试从 IndexedDB session 加载
        setError('Missing parameters');
        setStage('error');
        return;
      }
      
      const response = await fetch('/api/oracle/full-reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reading_id: readingId,
          profile_id: profileId,
          glyph_id: parseInt(glyphId),
          question,
          session_type: sessionType,
          locale
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Reading failed');
      }
      
      const result = await response.json();
      setData(result);
      setStage('ready');
    } catch (e: any) {
      setError(e.message);
      setStage('error');
    }
  }
  
  if (stage === 'loading') {
    return (
      <div className="glyph-loading-page">
        <div className="loading-glyph">
          <div className="spinner"></div>
          <p>{t('reading_loading')}</p>
          <p className="hint">{t('reading_loading_hint')}</p>
        </div>
      </div>
    );
  }
  
  if (stage === 'error') {
    return (
      <div className="glyph-error-page">
        <p>{t('reading_failed')}</p>
        <p className="error-detail">{error}</p>
        <button onClick={() => router.push(`/${locale}/glyph`)}>
          {t('back_to_glyph')}
        </button>
      </div>
    );
  }
  
  return (
    <div className="glyph-reading-page">
      <GlyphCanvas glyph={data.glyph} animated={false} />
      <GlyphReport 
        reading={data.reading}
        glyph={data.glyph}
        archiveId={data.archive_id}
        locale={locale}
      />
    </div>
  );
}
```

### Step 6.5: GlyphReport 组件

文件:`components/glyph/GlyphReport.tsx`(重写)

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

interface Props {
  reading: any;
  glyph: any;
  archiveId?: string;
  locale: string;
}

export function GlyphReport({ reading, glyph, archiveId, locale }: Props) {
  const t = useTranslations('glyph');
  const router = useRouter();
  
  return (
    <div className="glyph-report">
      {/* Wind Category */}
      <div className="report-section wind-category">
        <h3>{glyph.wind_category}</h3>
        <p>{reading.wind_category_blurb}</p>
      </div>
      
      {/* Classical Voice */}
      <div className="report-section classical">
        <div className="section-label">{t('section_classical')}</div>
        <p className="classical-text">{reading.classical_voice}</p>
      </div>
      
      {/* 双视角 */}
      <div className="report-section dual-view">
        <div className="section-label">{t('section_dual_view')}</div>
        
        <div className="dual-view-card view-bazi">
          <h4>{t('view_bazi_title')}</h4>
          <p>{reading.命理双视角?.命理看此事}</p>
        </div>
        
        <div className="dual-view-card view-glyph">
          <h4>{t('view_glyph_title')}</h4>
          <p>{reading.命理双视角?.签文看此事}</p>
        </div>
        
        <div className="dual-view-resonance">
          <p>{reading.命理双视角?.两者印证或冲突}</p>
        </div>
      </div>
      
      {/* Meaning */}
      <div className="report-section meaning">
        <div className="section-label">{t('section_meaning')}</div>
        <p>{reading.meaning_for_question}</p>
      </div>
      
      {/* Hidden Tension */}
      <div className="report-section tension">
        <div className="section-label">{t('section_hidden')}</div>
        <p>{reading.hidden_tension}</p>
      </div>
      
      {/* Your Moment */}
      <div className="report-section moment">
        <div className="section-label">{t('section_moment')}</div>
        <p>{reading.your_moment}</p>
      </div>
      
      {/* Exploration */}
      <div className="report-section exploration">
        <div className="section-label">{t('section_exploration')}</div>
        <div className="exploration-card">
          <p className="explore-text">{reading.exploration?.text}</p>
          <div className="explore-meta">
            <span>{reading.exploration?.timeframe}</span>
            <span>·</span>
            <span>{reading.exploration?.duration_estimate}</span>
            {reading.exploration?.is_solo && <span>· Solo</span>}
          </div>
        </div>
      </div>
      
      {/* Reflection Question */}
      <div className="report-section reflection">
        <div className="section-label">{t('section_reflection')}</div>
        <p className="reflection-question">{reading.reflection_question}</p>
      </div>
      
      {/* Archive Hint */}
      {archiveId && (
        <div className="archive-saved-hint">
          <p>{t('saved_to_archive')}</p>
          <button onClick={() => router.push(`/${locale}/archive/${archiveId}`)}>
            {t('view_in_archive')}
          </button>
        </div>
      )}
    </div>
  );
}
```

### Step 6.6: 翻译补充

`messages/en/glyph.json` 补充:

```json
{
  "reading_loading": "Casting your reading...",
  "reading_loading_hint": "Weaving your chart with the glyph. Takes 30-60 seconds.",
  "reading_failed": "Reading failed",
  "back_to_glyph": "Back to Glyph",
  "section_classical": "What this glyph says",
  "section_dual_view": "Two views",
  "view_bazi_title": "From your chart",
  "view_glyph_title": "From the glyph",
  "section_meaning": "For your question",
  "section_hidden": "What you may not see",
  "section_moment": "Your current moment",
  "section_exploration": "A small practice",
  "section_reflection": "A question to sit with",
  "saved_to_archive": "This reading is saved to your Archive",
  "view_in_archive": "View in Archive"
}
```

`messages/zh/glyph.json` 补充:

```json
{
  "reading_loading": "正在为你推演...",
  "reading_loading_hint": "结合你的命局与签文,大约 30-60 秒。",
  "reading_failed": "解读失败",
  "back_to_glyph": "返回 Glyph",
  "section_classical": "签的意思",
  "section_dual_view": "双视角",
  "view_bazi_title": "从你的命局看",
  "view_glyph_title": "从签的角度看",
  "section_meaning": "针对你的问题",
  "section_hidden": "你可能没看到的",
  "section_moment": "你当下的时机",
  "section_exploration": "一个小练习",
  "section_reflection": "一个值得深思的问题",
  "saved_to_archive": "本次解读已存入你的 Archive",
  "view_in_archive": "在 Archive 中查看"
}
```

## 验证清单

```
□ /api/oracle/full-reading 路由实现
□ Reading 页面渲染 7+ 段
□ 显示双视角(命理 + 签文)
□ 显示具体内观练习
□ 自动保存到 Archive
□ Archive 提示卡显示
□ 5 语言翻译

🛑 等用户确认进入 Step 7
```

---

# 第 7 部分:Step 7 - 端到端测试

## Step 7:完整 Glyph 流程测试

```
任务:

清空浏览器数据 → 启动 dev server → 完整测试

【场景 A:首次免费抽签】

1. 访问 /glyph
   验证:看到 "Draw your first glyph (free)" 按钮

2. 点击 "Start"
   验证:跳转 /glyph/prepare?type=free

3. 看到 GLYPH 欢迎词(不是 POJU 欢迎词!)
   验证:文案显示"Glyph weaves your bazi foundation..."

4. 由于没有保存的八字 → 直接显示滚轮表单
   填:1977-02-17, 寅时(3-5AM), 男

5. 点击"继续"
   验证:弹出确认对话框,显示信息

6. 确认 → 跳转 /glyph/draw
   验证:
   - 由于是新八字,自动触发 base_analysis 生成
   - 看到 ChartReadingLoader(命盘 + 流式动画)
   - 等待 30-60 秒
   - 跳转到输入页

7. 输入问题:"I'm caught between two paths and need clarity"
   验证:字数显示

8. 点击 "Draw"
   验证:
   - 显示抽签动画
   - 调用 /api/oracle/draw 成功
   - 3 秒后跳转 /glyph/reading/[id]

9. /reading 页面调用 /api/oracle/full-reading
   验证:
   - 看到 "Casting your reading..." loading 30-60 秒
   - DeepSeek V4 Pro 调用成功
   - 输出完整 JSON

10. 报告渲染:
    验证:
    □ Wind Category(风类介绍)
    □ Classical Voice(签意)
    □ 双视角:
      - 命理看此事(引用八字)
      - 签文看此事(引用签意)
      - 印证/冲突说明
    □ Meaning for question(深度解读)
    □ Hidden tension(盲点)
    □ Your moment(当下时机)
    □ Exploration(具体内观练习)
    □ Reflection question(深思问题)
    □ Archive 保存提示

11. 检查 Archive:
    访问 /archive
    验证:
    □ 看到一条 "Glyph: [签名] - 2026-05-19"
    □ 点击进入详细页 → 显示完整 reading

【场景 B:已有八字,再次抽签】

1. 访问 /glyph
   验证:看到 "Draw a new glyph - $1.99" 按钮

2. 点击 → 模拟付款 → 跳转 /glyph/prepare

3. 看到列表中已有的八字
   验证:卡片显示出生信息

4. 点击卡片 → 弹确认对话框 → 确认

5. 跳转 /glyph/draw
   验证:
   - 由于已有 base_analysis → 不再触发 DeepSeek base 调用
   - 立刻显示输入页

6. 输入问题 → 抽签 → reading
   验证:正常流程

【场景 C:跨产品复用】

1. 用户在 POJU 已经完成了一次 session
   stored_profiles 中有 base_analysis

2. 切换到 Glyph
   验证:
   - 在 ProfileSelector 中看到同一个 profile
   - 选择后【不重新调】base_analysis
   - 直接进入抽签

3. 完成抽签 → reading
   验证:
   - 报告中提到的命理(日主/大运)与 POJU 完全一致
   - 不会出现 POJU 说"乙木",Glyph 说"辛金"的冲突

【验证清单】

□ 场景 A 全程通过
□ 场景 B 全程通过
□ 场景 C 跨产品一致性通过
□ 报告 7+ 段完整
□ DeepSeek V4 Pro 调用成功
□ Archive 保存正常
□ 5 语言切换正常
□ 总成本可控(单次 $1-2)

【提交报告】

完成后向用户提交:
1. 3 个场景的完整测试日志
2. DeepSeek 调用的 latency / tokens / cost
3. 报告 JSON 的完整内容(至少 1 个示例)
4. Archive 中的 Glyph 条目截图描述
5. 跨产品 profile 一致性确认

完成所有验证后,Glyph v5.0 重构完成。
```

## 验证清单

```
□ 场景 A 通过
□ 场景 B 通过  
□ 场景 C 通过
□ 报告质量符合预期
□ 跟 POJU 共享 stored_profiles
□ 跟 POJU 共享 Archive 系统
□ 全 DeepSeek V4 Pro

🛑 等用户最终确认 Glyph 上线就绪
```

---

# Glyph v5.0 重构完成清单

```
✅ Step 1: Glyph 现状自查
✅ Step 2: 清理旧 Gemini 代码
✅ Step 3: /glyph/prepare 集成 ProfileSelector
✅ Step 4: /glyph/draw 抽签流程改造
✅ Step 5: DeepSeek V4 Pro Prompt 设计(双视角)
✅ Step 6: Full Reading API + 报告渲染 + Archive 集成
✅ Step 7: 端到端 3 场景测试

核心改进:
  ⭐ 完全复用 POJU 的八字采集系统(stored_profiles)
  ⭐ 完全复用 POJU 的 ProfileSelector 组件
  ⭐ 完全复用 POJU 的 base_analysis 缓存
  ⭐ 切换到 DeepSeek V4 Pro thinking high
  ⭐ 命理 + 签文双视角整合
  ⭐ 自动存入 Archive 共享系统
  ⭐ 玄学定位继承(东方破局顾问基础人设)
  ⭐ 跨产品命理一致性
```

---

# 给 Cursor 的最终提醒

```
本任务包含 Step 1-7。

实施顺序(严格按序):

1. Step 1: 自查报告 → 等用户确认
2. Step 2: 清理 → 贴 git status → 等确认
3. Step 3: prepare 页 → 测试 → 等确认
4. Step 4: draw 页 → 测试 → 等确认
5. Step 5: Prompt 设计 → 单测 → 等确认
6. Step 6: API + reading 页 → 完整测试 → 等确认
7. Step 7: 端到端 3 场景测试 → 提交报告

绝不允许:
  ✗ 跨 Step 实施
  ✗ "我觉得 X 和 Y 类似就一起做了"
  ✗ 保留任何 Gemini 调用代码
  ✗ 重新设计八字采集(必须复用 POJU)

完成后:
  ✓ Glyph v5.0 可以软上线
  ✓ POJU + Glyph 共享底层
  ✓ Syncro 可以开始(下一份指令)
```

---

**Cursor: 完成 Step 1-7 后,Glyph v5.0 重构完成。**

**用户: Glyph 完成后,我会发 Syncro 的完整 Cursor 指令。**
