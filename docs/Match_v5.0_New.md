# Match v5.0 新功能指令 · Cursor 完整任务

> **目标**:Match 八字匹配功能(全新产品)
>
> - 复用 POJU 八字采集系统
> - 选 A 八字 + 选 B 八字 + 自由文本输入关系
> - DeepSeek V4 Pro 生成 5 段分析报告
> - 卡片式可展开 UI
> - $4.99 / 次,首次免费,device_id 监控
> - 输出语言跟随用户输入关系描述的语言
>
> **前提**:
> - POJU v5.0 已完成
> - Glyph v5.0 已完成
> - Syncro v5.0 已完成
> - stored_profiles + ProfileSelector + ORIENTAL_COUNSELOR_BASE + Archive + device_usage 已就绪
>
> **执行原则**:严格【一步一停】

---

# ⚠️ Cursor 必读

```
Match 是【全新功能】,不需要重构旧代码。

技术栈:
  ✓ 复用 POJU 的 stored_profiles 系统
  ✓ 复用 POJU 的 ProfileSelector 组件
  ✓ 复用 POJU 的 ORIENTAL_COUNSELOR_BASE
  ✓ 复用 Glyph/Syncro 的 device_usage 表
  ✓ 复用 Archive 系统
  ✓ 全用 DeepSeek V4 Pro thinking high

产品定位:
  Match = 八字合盘工具
  
  适用场景:
  - 夫妻 / 情侣 / 未婚妻
  - 合伙人 / 生意伙伴
  - 上下级 / 同事
  - 父母 / 子女 / 兄弟姐妹
  - 朋友
  - 任何两人关系或即将发生的关系
  
  ⭐ 关系类型【不限定】,自由文本输入
  ⭐ B 八字【自动保存】到 stored_profiles
     (用户不想保留的可以去 Archive 删)
  ⭐ 输出语言【跟随用户输入语言】(关键!)

绝不允许:
  ✗ 预设关系类型按钮(必须自由文本)
  ✗ 让用户选保存或临时(B 八字一律保存)
  ✗ 让 A 和 B 都付费(只 A 付)
  ✗ 跨 Step 实施

每个 Step 完成后:
  - 贴出代码 + 测试输出
  - 等用户明确"通过 Step X,进入 Step X+1"
```

---

# 第 1 部分:Step 1 - 项目结构 + 数据类型

## Step 1.1: 创建文件结构

```
任务:

创建以下空文件:

  app/[locale]/(marketing)/match/page.tsx
  app/[locale]/(marketing)/match/select-a/page.tsx
  app/[locale]/(marketing)/match/select-b/page.tsx
  app/[locale]/(marketing)/match/relationship/page.tsx
  app/[locale]/(marketing)/match/analyzing/page.tsx
  app/[locale]/(marketing)/match/result/[id]/page.tsx
  app/api/match/analyze/route.ts
  
  components/match/MatchProfileSelector.tsx
  components/match/RelationshipInput.tsx
  components/match/MatchAnalyzingLoader.tsx
  components/match/MatchReport.tsx
  components/match/MatchReportCard.tsx
  
  lib/match/types.ts
  lib/match/match-session.ts
  lib/llm/prompts/match-deepseek-prompt.ts
  lib/llm/services/match-analysis-service.ts
  
  messages/en/match.json
  messages/zh/match.json
  messages/es/match.json
  messages/fr/match.json
  messages/de/match.json
  
  styles/match.css

提交 git:
  git add .
  git commit -m "chore: scaffold Match v5.0 files"
```

## Step 1.2: Match 数据类型

文件:`lib/match/types.ts`

```typescript
// lib/match/types.ts

export type MatchSection = 
  | 'analysis_a'        // A 的命理分析(突出此关系相关)
  | 'analysis_b'        // B 的命理分析(突出此关系相关)
  | 'combined'          // A + B 合盘分析
  | 'conclusion'        // 结论:适合度 + 注意点
  | 'recommendations';  // 建议:如何相处 / 如何取舍

export interface MatchReport {
  // 5 段结构化报告
  analysis_a: {
    title: string;        // 例 "About A"
    summary: string;      // 30-60 字快览
    detail: string;       // 200-400 字详细
    key_traits: string[]; // 3-5 条关键特质
  };
  
  analysis_b: {
    title: string;
    summary: string;
    detail: string;
    key_traits: string[];
  };
  
  combined: {
    title: string;        // 例 "Together"
    summary: string;
    detail: string;       // 400-600 字 A+B 互动分析
    
    // 五行/十神互动
    five_elements_interaction: string;  // 200-300 字
    
    // 时机协同 / 冲突
    timing_dynamic: string;  // 100-200 字
  };
  
  conclusion: {
    title: string;
    
    // 总体评级(用 Current 5 等级或自定义)
    compatibility_level: 'highly_compatible' | 'compatible_with_effort' | 'neutral' | 'challenging' | 'highly_challenging';
    
    summary: string;       // 简短结论 50-100 字
    detail: string;        // 200-400 字详细
    
    // 关键点
    strengths: string[];   // 3-5 条优势
    challenges: string[];  // 3-5 条挑战
  };
  
  recommendations: {
    title: string;
    summary: string;
    
    // 具体建议(类似 POJU 的 actions)
    actions: Array<{
      category: 'communication' | 'timing' | 'boundary' | 'growth' | 'fengshui';
      title: string;       // 短标题
      detail: string;      // 详细 80-150 字
      timing?: string;     // 时机建议
    }>;
  };
  
  _meta: {
    a_profile_id: string;
    b_profile_id: string;
    relationship_description: string;
    detected_language: string;
    generated_at: string;
    model: string;
    tokens_used: number;
  };
}

export interface MatchSession {
  match_id: string;
  device_id: string;
  
  a_profile_id: string;
  b_profile_id: string;
  
  relationship_description: string;
  
  report: MatchReport;
  
  created_at: Date;
  
  is_free: boolean;
  cost_usd: number;
  locale: string;
}

// Compatibility Level 元数据
export interface CompatibilityLevelInfo {
  level: string;
  name_en: string;
  name_zh: string;
  color_hex: string;
  score: number;  // 1-5
}

export const COMPATIBILITY_LEVELS: Record<string, CompatibilityLevelInfo> = {
  highly_compatible: {
    level: 'highly_compatible',
    name_en: 'Highly Compatible',
    name_zh: '高度契合',
    color_hex: '#0D7377',  // Deep Teal
    score: 5
  },
  compatible_with_effort: {
    level: 'compatible_with_effort',
    name_en: 'Compatible with Effort',
    name_zh: '相辅相成',
    color_hex: '#26A69A',  // Teal
    score: 4
  },
  neutral: {
    level: 'neutral',
    name_en: 'Neutral',
    name_zh: '中和并存',
    color_hex: '#90A4AE',  // Blue Grey
    score: 3
  },
  challenging: {
    level: 'challenging',
    name_en: 'Challenging',
    name_zh: '相互磨合',
    color_hex: '#F57C00',  // Amber
    score: 2
  },
  highly_challenging: {
    level: 'highly_challenging',
    name_en: 'Highly Challenging',
    name_zh: '困难重重',
    color_hex: '#C62828',  // Deep Red
    score: 1
  }
};
```

## Step 1.3: Match Session 数据库操作

修改 `lib/db/poju-db.ts`,在 v4 版本中加入 match_sessions 表:

```typescript
// 在已有的 PojulifeDB 中

export interface MatchSessionRecord {
  match_id: string;
  device_id: string;
  a_profile_id: string;
  b_profile_id: string;
  encrypted_data: string;
  iv: string;
  created_at: Date;
}

class PojulifeDB extends Dexie {
  match_sessions!: Table<MatchSessionRecord, string>;
  
  constructor() {
    super('pojulife_v4');
    
    this.version(5).stores({
      // 升级到 v5
      match_sessions: 'match_id, device_id, a_profile_id, b_profile_id, created_at'
    });
  }
}
```

文件:`lib/match/match-session.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db/poju-db';
import { encrypt, decrypt } from '@/lib/crypto';
import { getDeviceId } from '@/lib/init';
import type { MatchSession, MatchReport } from './types';

export async function createMatchSession(input: {
  a_profile_id: string;
  b_profile_id: string;
  relationship_description: string;
  report: MatchReport;
  is_free: boolean;
  cost_usd: number;
  locale: string;
}): Promise<string> {
  const deviceId = getDeviceId();
  if (!deviceId) throw new Error('App not initialized');
  
  const matchId = uuidv4();
  const now = new Date();
  
  const session: MatchSession = {
    match_id: matchId,
    device_id: deviceId,
    a_profile_id: input.a_profile_id,
    b_profile_id: input.b_profile_id,
    relationship_description: input.relationship_description,
    report: input.report,
    created_at: now,
    is_free: input.is_free,
    cost_usd: input.cost_usd,
    locale: input.locale
  };
  
  const { ciphertext, iv } = await encrypt(session);
  
  await (db as any).match_sessions.put({
    match_id: matchId,
    device_id: deviceId,
    a_profile_id: input.a_profile_id,
    b_profile_id: input.b_profile_id,
    encrypted_data: ciphertext,
    iv,
    created_at: now
  });
  
  return matchId;
}

export async function loadMatchSession(matchId: string): Promise<MatchSession | null> {
  const record = await (db as any).match_sessions.get(matchId);
  if (!record) return null;
  
  try {
    return await decrypt(record.encrypted_data, record.iv);
  } catch (e) {
    console.error('[match-session] Decrypt failed:', e);
    return null;
  }
}

export async function listUserMatchSessions(): Promise<any[]> {
  const deviceId = getDeviceId();
  if (!deviceId) return [];
  
  const records = await (db as any).match_sessions
    .where('device_id').equals(deviceId)
    .reverse()
    .sortBy('created_at');
  
  return records.map((r: any) => ({
    match_id: r.match_id,
    a_profile_id: r.a_profile_id,
    b_profile_id: r.b_profile_id,
    created_at: r.created_at
  }));
}

export async function deleteMatchSession(matchId: string): Promise<void> {
  await (db as any).match_sessions.delete(matchId);
}
```

## 验证清单

```
□ 16 个空文件创建完成
□ types.ts 实现
□ match-session.ts 实现
□ IndexedDB v5 表添加
□ COMPATIBILITY_LEVELS 5 等级定义
□ tsc 通过

🛑 等用户确认进入 Step 2
```

---

# 第 2 部分:Step 2 - Match 入口主页

## Step 2.1: /match 主页

文件:`app/[locale]/(marketing)/match/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { isFirstTimeFree } from '@/lib/syncro/device-usage';

export default function MatchHomePage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('match');
  
  const [canFree, setCanFree] = useState<boolean | null>(null);
  
  useEffect(() => {
    checkAccess();
  }, []);
  
  async function checkAccess() {
    const free = await isFirstTimeFree('match');
    setCanFree(free);
  }
  
  function handleStart() {
    if (canFree === null) return;
    
    if (canFree) {
      sessionStorage.setItem('match_session_type', 'free');
      router.push(`/${locale}/match/select-a`);
    } else {
      sessionStorage.setItem('match_session_type', 'paid');
      router.push(`/${locale}/match/payment`);
    }
  }
  
  if (canFree === null) {
    return <div className="loading-fullscreen">Loading...</div>;
  }
  
  return (
    <div className="match-home">
      <div className="match-hero">
        <h1 className="match-title">MATCH</h1>
        <p className="match-subtitle">{t('subtitle')}</p>
        <p className="match-description">{t('description')}</p>
      </div>
      
      <div className="match-features">
        <FeatureRow icon="👥" titleKey="feature_two_charts" descKey="feature_two_charts_desc" />
        <FeatureRow icon="🔮" titleKey="feature_relationship" descKey="feature_relationship_desc" />
        <FeatureRow icon="📊" titleKey="feature_report" descKey="feature_report_desc" />
      </div>
      
      <div className="match-use-cases">
        <h3>{t('use_cases_title')}</h3>
        <ul>
          <li>{t('use_case_1')}</li>
          <li>{t('use_case_2')}</li>
          <li>{t('use_case_3')}</li>
          <li>{t('use_case_4')}</li>
        </ul>
      </div>
      
      <button onClick={handleStart} className="primary-large">
        {canFree ? t('start_free') : t('start_paid')}
      </button>
      
      <p className="cta-note">
        {canFree ? t('free_note') : t('paid_note')}
      </p>
    </div>
  );
}

function FeatureRow({ icon, titleKey, descKey }: any) {
  const t = useTranslations('match');
  return (
    <div className="feature-row">
      <span className="feature-icon">{icon}</span>
      <div className="feature-text">
        <h4>{t(titleKey)}</h4>
        <p>{t(descKey)}</p>
      </div>
    </div>
  );
}
```

## Step 2.2: 翻译文件

`messages/en/match.json`:

```json
{
  "subtitle": "Two charts. One relationship. Real clarity.",
  "description": "Match weaves both bazi charts together — yours and theirs — to reveal how your energies align, where you support each other, where you collide, and what to do about it.",
  
  "feature_two_charts": "Two-Chart Analysis",
  "feature_two_charts_desc": "Deep individual readings of both people, then how they meet.",
  
  "feature_relationship": "Any Relationship",
  "feature_relationship_desc": "Marriage, partnership, friendship, family — you describe it, we read it.",
  
  "feature_report": "Full Report",
  "feature_report_desc": "5 sections: each person, together, conclusion, actionable recommendations.",
  
  "use_cases_title": "What Match is for",
  "use_case_1": "Considering marriage or a serious commitment",
  "use_case_2": "Evaluating a potential business partnership",
  "use_case_3": "Understanding a difficult family dynamic",
  "use_case_4": "Hiring decisions or team formation",
  
  "start_free": "Run a free Match",
  "start_paid": "Start a Match — $4.99",
  
  "free_note": "Your first Match is on us.",
  "paid_note": "$4.99 for a complete two-chart reading."
}
```

`messages/zh/match.json`:

```json
{
  "subtitle": "两个命盘,一段关系,真正看清。",
  "description": "Match 将两个八字编织在一起——你的和对方的——揭示你们能量如何对接、何处相互成就、何处碰撞,以及该怎么做。",
  
  "feature_two_charts": "双盘解读",
  "feature_two_charts_desc": "深度解读两个人的命盘,再看他们如何相遇。",
  
  "feature_relationship": "任何关系",
  "feature_relationship_desc": "婚姻、合伙、朋友、家庭——你描述,我们解读。",
  
  "feature_report": "完整报告",
  "feature_report_desc": "5 段结构:各自分析,合盘解读,结论,可落地的建议。",
  
  "use_cases_title": "Match 适合的场景",
  "use_case_1": "考虑结婚或重大承诺",
  "use_case_2": "评估潜在的合伙关系",
  "use_case_3": "理解一段困难的家庭关系",
  "use_case_4": "招聘决策或团队组合",
  
  "start_free": "免费体验 Match",
  "start_paid": "开始一次 Match — $4.99",
  
  "free_note": "首次 Match 由我们赠送。",
  "paid_note": "$4.99 = 完整双盘解读。"
}
```

## 验证清单

```
□ /match 主页可访问
□ 首次显示"免费体验"按钮
□ 已用过显示 $4.99 按钮
□ 5 语言翻译完成
□ 移动端响应式

🛑 等用户确认进入 Step 3
```

---

# 第 3 部分:Step 3 - 选择 A 八字

## Step 3.1: /match/select-a 页面

文件:`app/[locale]/(marketing)/match/select-a/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { 
  listStoredProfiles, 
  type StoredProfileSummary 
} from '@/lib/profile/stored-profiles-service';
import { SessionPreparation } from '@/components/poju/SessionPreparation';

export default function MatchSelectAPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('match');
  
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
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
  
  function handleSelectA(profileId: string) {
    sessionStorage.setItem('match_a_profile_id', profileId);
    router.push(`/${locale}/match/select-b`);
  }
  
  function handleCancel() {
    router.push(`/${locale}/match`);
  }
  
  if (loading) {
    return <div className="loading-fullscreen">Loading...</div>;
  }
  
  return (
    <div className="match-select-page">
      <div className="select-header">
        <span className="step-indicator">{t('step_indicator', { step: 1, total: 3 })}</span>
        <h1>{t('select_a_title')}</h1>
        <p>{t('select_a_subtitle')}</p>
      </div>
      
      <SessionPreparation
        sessionId="match-a-temp"
        originalQuestion=""
        existingProfiles={profiles}
        onProfileSelected={handleSelectA}
        onRefund={handleCancel}
        locale={locale}
        productType="match"
        customLabel={t('select_a_label')}
      />
    </div>
  );
}
```

## Step 3.2: 修改 SessionPreparation 支持 Match

文件:`components/poju/SessionPreparation.tsx`(扩展)

在 Props 中加 `customLabel?: string`,在 WelcomeSection 中使用:

```typescript
interface Props {
  // ... 已有
  productType?: 'poju' | 'glyph' | 'syncro' | 'match';
  customLabel?: string;
}

// 在 getWelcomeText 中加 match 分支:

function getWelcomeText(locale: string, productType: string): string {
  const isZh = locale.startsWith('zh');
  
  if (productType === 'match') {
    return isZh
      ? `选择第一个命主的八字信息。`
      : `Select the first person's bazi.`;
  }
  
  // ... 已有 poju/glyph/syncro 分支
}
```

## Step 3.3: 翻译补充

`messages/en/match.json` 补充:

```json
{
  "step_indicator": "Step {step} of {total}",
  "select_a_title": "Person A",
  "select_a_subtitle": "Choose or add the first person's bazi information.",
  "select_a_label": "Person A"
}
```

`messages/zh/match.json` 补充:

```json
{
  "step_indicator": "第 {step} / {total} 步",
  "select_a_title": "命主 A",
  "select_a_subtitle": "选择或添加第一个人的八字信息。",
  "select_a_label": "命主 A"
}
```

## 验证清单

```
□ /match/select-a 页面工作
□ 显示已有 profile 或滚轮表单
□ 显示"Person A"标识
□ 选择后跳转 select-b
□ A profile_id 存 sessionStorage

🛑 等用户确认进入 Step 4
```

---

# 第 4 部分:Step 4 - 选择 B 八字

## Step 4.1: /match/select-b 页面

文件:`app/[locale]/(marketing)/match/select-b/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { 
  listStoredProfiles, 
  type StoredProfileSummary 
} from '@/lib/profile/stored-profiles-service';
import { SessionPreparation } from '@/components/poju/SessionPreparation';

export default function MatchSelectBPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('match');
  
  const [aProfileId, setAProfileId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    init();
  }, []);
  
  async function init() {
    const aId = sessionStorage.getItem('match_a_profile_id');
    if (!aId) {
      router.push(`/${locale}/match/select-a`);
      return;
    }
    
    setAProfileId(aId);
    
    try {
      const list = await listStoredProfiles();
      // 过滤掉 A,B 不能等于 A
      setProfiles(list.filter(p => p.profile_id !== aId));
    } finally {
      setLoading(false);
    }
  }
  
  function handleSelectB(profileId: string) {
    if (profileId === aProfileId) {
      alert(t('cannot_match_self'));
      return;
    }
    
    sessionStorage.setItem('match_b_profile_id', profileId);
    router.push(`/${locale}/match/relationship`);
  }
  
  function handleCancel() {
    router.push(`/${locale}/match/select-a`);
  }
  
  if (loading) {
    return <div className="loading-fullscreen">Loading...</div>;
  }
  
  return (
    <div className="match-select-page">
      <div className="select-header">
        <span className="step-indicator">{t('step_indicator', { step: 2, total: 3 })}</span>
        <h1>{t('select_b_title')}</h1>
        <p>{t('select_b_subtitle')}</p>
      </div>
      
      <SessionPreparation
        sessionId="match-b-temp"
        originalQuestion=""
        existingProfiles={profiles}
        onProfileSelected={handleSelectB}
        onRefund={handleCancel}
        locale={locale}
        productType="match"
        customLabel={t('select_b_label')}
      />
    </div>
  );
}
```

## Step 4.2: 翻译补充

`messages/en/match.json` 补充:

```json
{
  "select_b_title": "Person B",
  "select_b_subtitle": "Choose or add the second person's bazi information. This will be saved to your profile library.",
  "select_b_label": "Person B",
  "cannot_match_self": "Person B must be different from Person A."
}
```

`messages/zh/match.json` 补充:

```json
{
  "select_b_title": "命主 B",
  "select_b_subtitle": "选择或添加第二个人的八字信息。会自动保存到你的命主库。",
  "select_b_label": "命主 B",
  "cannot_match_self": "命主 B 不能与命主 A 相同。"
}
```

## 验证清单

```
□ /match/select-b 页面工作
□ 过滤掉 A 自己(不能选自己)
□ B profile_id 存 sessionStorage
□ B 八字自动保存到 stored_profiles
□ 跳转 relationship

🛑 等用户确认进入 Step 5
```

---

# 第 5 部分:Step 5 - 关系描述输入

## Step 5.1: /match/relationship 页面

文件:`app/[locale]/(marketing)/match/relationship/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { getStoredProfile } from '@/lib/profile/stored-profiles-service';

export default function MatchRelationshipPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('match.relationship');
  
  const [aProfile, setAProfile] = useState<any>(null);
  const [bProfile, setBProfile] = useState<any>(null);
  const [relationship, setRelationship] = useState('');
  const [loading, setLoading] = useState(true);
  
  const minLen = 10;
  const maxLen = 200;
  
  useEffect(() => {
    init();
  }, []);
  
  async function init() {
    const aId = sessionStorage.getItem('match_a_profile_id');
    const bId = sessionStorage.getItem('match_b_profile_id');
    
    if (!aId || !bId) {
      router.push(`/${locale}/match/select-a`);
      return;
    }
    
    try {
      const [a, b] = await Promise.all([
        getStoredProfile(aId),
        getStoredProfile(bId)
      ]);
      setAProfile(a);
      setBProfile(b);
    } finally {
      setLoading(false);
    }
  }
  
  function handleContinue() {
    if (relationship.trim().length < minLen) return;
    
    sessionStorage.setItem('match_relationship', relationship.trim());
    router.push(`/${locale}/match/analyzing`);
  }
  
  if (loading) {
    return <div className="loading-fullscreen">Loading...</div>;
  }
  
  return (
    <div className="match-relationship-page">
      <div className="relationship-content">
        <span className="step-indicator">{t('step_indicator', { step: 3, total: 3 })}</span>
        <h1>{t('title')}</h1>
        
        <div className="ab-display">
          <div className="person-mini">
            <span className="label">A</span>
            <span className="name">{formatBirthShort(aProfile)}</span>
          </div>
          <span className="vs">×</span>
          <div className="person-mini">
            <span className="label">B</span>
            <span className="name">{formatBirthShort(bProfile)}</span>
          </div>
        </div>
        
        <p className="hint">{t('hint')}</p>
        
        <textarea
          value={relationship}
          onChange={e => setRelationship(e.target.value.slice(0, maxLen))}
          placeholder={t('placeholder')}
          rows={5}
          autoFocus
        />
        
        <div className="char-count">
          {relationship.length} / {maxLen}
          {relationship.length < minLen && (
            <span className="hint-small"> · {t('min_chars', { min: minLen })}</span>
          )}
        </div>
        
        <div className="examples">
          <h4>{t('examples_title')}</h4>
          <ul>
            <li>"{t('example_1')}"</li>
            <li>"{t('example_2')}"</li>
            <li>"{t('example_3')}"</li>
            <li>"{t('example_4')}"</li>
          </ul>
        </div>
        
        <button
          onClick={handleContinue}
          disabled={relationship.trim().length < minLen}
          className="primary-large"
        >
          {t('analyze_button')}
        </button>
        
        <p className="language-hint">
          {t('language_hint')}
        </p>
      </div>
    </div>
  );
}

function formatBirthShort(profile: any): string {
  if (!profile?.user_profile?.birth_info) return 'Profile';
  const b = profile.user_profile.birth_info;
  return `${b.year}.${String(b.month).padStart(2, '0')}.${String(b.day).padStart(2, '0')}`;
}
```

## Step 5.2: 翻译补充

`messages/en/match.json` 补充:

```json
{
  "relationship": {
    "step_indicator": "Step {step} of {total}",
    "title": "How are they connected?",
    "hint": "Describe the relationship — current, intended, or in question. Be specific.",
    "placeholder": "e.g., 'My business partner of 3 years. We're considering scaling but tension has built between us.'",
    "min_chars": "at least {min} characters",
    "examples_title": "Good examples:",
    "example_1": "My fiancé. We've dated 2 years and plan to marry next year.",
    "example_2": "A potential co-founder. We met 3 months ago.",
    "example_3": "My adult son. We don't talk easily anymore.",
    "example_4": "A candidate I'm considering hiring as my second-in-command.",
    "analyze_button": "Run the Match",
    "language_hint": "Write in your own language — your report will come back in the same language."
  }
}
```

`messages/zh/match.json` 补充:

```json
{
  "relationship": {
    "step_indicator": "第 {step} / {total} 步",
    "title": "他们是什么关系?",
    "hint": "描述这段关系——现有的、即将发生的、或正在考虑的。请具体。",
    "placeholder": "例如:'合作 3 年的生意伙伴。我们考虑扩大规模,但彼此之间有了张力。'",
    "min_chars": "至少 {min} 字",
    "examples_title": "好的例子:",
    "example_1": "未婚妻。我们交往 2 年,打算明年结婚。",
    "example_2": "一个潜在的联合创始人。我们 3 个月前认识。",
    "example_3": "我成年的儿子。我们已经没法好好说话了。",
    "example_4": "一个我正在考虑录用为副手的候选人。",
    "analyze_button": "开始 Match",
    "language_hint": "请用你自己的语言书写——报告会用同样的语言返回。"
  }
}
```

## 验证清单

```
□ /match/relationship 页面工作
□ 显示 A vs B 简略信息
□ 自由文本输入(10-200 字)
□ 字数计数器
□ 示例引导
□ 语言提示(报告会用输入语言)
□ 提交后存 sessionStorage 跳转 analyzing

🛑 等用户确认进入 Step 6
```

---

# 第 6 部分:Step 6 - Match DeepSeek Prompt

## Step 6.1: Match Prompt 设计

文件:`lib/llm/prompts/match-deepseek-prompt.ts`

```typescript
import {
  ORIENTAL_COUNSELOR_BASE,
  buildCurrentDateContext,
  buildProfileContextSection
} from './oriental-counselor-base';

export function buildMatchPrompt(input: {
  a_profile: any;
  b_profile: any;
  relationship_description: string;
  locale: string;
}): { system: string; user: string; detected_language: string } {
  
  const { a_profile, b_profile, relationship_description, locale } = input;
  
  // 关键:检测用户输入的语言
  const detectedLanguage = detectLanguage(relationship_description);
  
  const aBaseAnalysis = a_profile?.base_analysis?.content;
  const bBaseAnalysis = b_profile?.base_analysis?.content;
  
  const system = `${ORIENTAL_COUNSELOR_BASE}

${buildCurrentDateContext()}

# 当前任务:Match 八字合盘解读

你要为两个命主做完整的合盘分析。

# 命主 A 的命盘
${buildProfileContextSection(a_profile, aBaseAnalysis)}

---

# 命主 B 的命盘
${buildProfileContextSection(b_profile, bBaseAnalysis)}

---

# 用户描述的关系

"${relationship_description}"

# 你的工作

生成一份完整的【合盘分析报告】,5 段结构。

## 1. 命主 A 分析(analysis_a)
- 突出与此关系相关的命局特质
- 这个人在感情/合作/家庭中【天然倾向】
- 200-400 字详细 + 3-5 条关键特质

## 2. 命主 B 分析(analysis_b)
- 同上,针对 B
- 不只是命盘介绍,而是【在此关系中 B 会怎样】

## 3. 合盘分析(combined)
- 五行互动(谁生谁,谁克谁)
- 十神关系(配偶星 / 财星 / 官星 / 食伤等如何互动)
- 时机协同(大运是否同频,流年是否冲合)
- 用户描述的具体情况如何在命局中映射
- 400-600 字详细

## 4. 结论(conclusion)
- 总体契合度等级(从以下 5 选 1):
  * highly_compatible (高度契合)
  * compatible_with_effort (相辅相成,但需努力)
  * neutral (中和并存)
  * challenging (相互磨合,有阻力)
  * highly_challenging (困难重重)
- 简短结论 + 详细说明
- 优势 3-5 条
- 挑战 3-5 条

## 5. 建议(recommendations)
- 4-6 条具体可执行的建议
- 每条:title (短标题) + detail (80-150 字) + 类别 + 时机
- 类别:
  * communication (沟通)
  * timing (时机)
  * boundary (边界)
  * growth (成长)
  * fengshui (风水/环境)

# 输出语言(关键!)

⚠️ **极其重要**:全部输出用【${detectedLanguage}】

检测依据:用户的关系描述"${relationship_description}"
检测结果:${detectedLanguage}

不管系统 locale 是什么,都用上述语言。

# 输出格式(严格 JSON)

\`\`\`json
{
  "analysis_a": {
    "title": "About A (用户语言)",
    "summary": "30-60 字快览",
    "detail": "200-400 字详细",
    "key_traits": ["特质1", "特质2", "特质3", "特质4", "特质5"]
  },
  
  "analysis_b": {
    "title": "About B",
    "summary": "...",
    "detail": "...",
    "key_traits": ["...", "...", "...", "...", "..."]
  },
  
  "combined": {
    "title": "Together",
    "summary": "30-60 字总体感觉",
    "detail": "400-600 字 A+B 互动详细",
    "five_elements_interaction": "200-300 字五行十神互动",
    "timing_dynamic": "100-200 字大运流年协同"
  },
  
  "conclusion": {
    "title": "Conclusion",
    "compatibility_level": "highly_compatible | compatible_with_effort | neutral | challenging | highly_challenging",
    "summary": "50-100 字简短结论",
    "detail": "200-400 字详细说明",
    "strengths": ["优势1", "优势2", "优势3"],
    "challenges": ["挑战1", "挑战2", "挑战3"]
  },
  
  "recommendations": {
    "title": "What to Do",
    "summary": "50-100 字总体建议",
    "actions": [
      {
        "category": "communication",
        "title": "短标题(20-30 字)",
        "detail": "80-150 字具体建议",
        "timing": "时机(可选)"
      },
      // 4-6 条
    ]
  }
}
\`\`\`

# 风格要求

- 你是【东方破局顾问】,用命理术语 + 解释
- 命局推演要【具体引用】两个人的命盘元素
  ✓ "A 的日主乙木,生于寅月,天干壬水透出,本身性格..."
  ✓ "B 的庚金日主,与 A 的乙木形成乙庚相合,这是..."
- 建议必须【可执行】
  ✓ "本月内,A 主动选一个晴天的下午,在 B 不工作的时候..."
  ✗ "多沟通"(太空)
- 不预测具体未来事件
- 不下定论"你们一定...不...."

总字数:1500-2500 字(用户输入语言)

只输出 JSON,无 markdown,无解释。
`;
  
  const user = `请基于两个命主的命盘 + 关系描述,生成完整的合盘分析 JSON。`;
  
  return { 
    system, 
    user,
    detected_language: detectedLanguage
  };
}

function detectLanguage(text: string): string {
  if (!text) return 'English';
  if (/[\u4e00-\u9fa5]/.test(text)) return 'Chinese (Simplified)';
  if (/[áéíóúñ¿¡]/i.test(text)) return 'Spanish';
  if (/[àâäéèêëîïôöùûüÿç]/i.test(text)) return 'French';
  if (/[äöüß]/i.test(text)) return 'German';
  if (/[а-яА-Я]/i.test(text)) return 'Russian';
  if (/[ぁ-んァ-ヶ]/.test(text)) return 'Japanese';
  if (/[가-힣]/.test(text)) return 'Korean';
  return 'English';
}
```

## Step 6.2: Match 分析服务

文件:`lib/llm/services/match-analysis-service.ts`

```typescript
import { callLLM } from '@/lib/llm/router';
import { buildMatchPrompt } from '@/lib/llm/prompts/match-deepseek-prompt';
import { 
  getStoredProfile, 
  recordProfileUsage 
} from '@/lib/profile/stored-profiles-service';
import { generateBaseAnalysis } from '@/lib/llm/deepseek/base-analysis';
import type { MatchReport } from '@/lib/match/types';

export async function generateMatchAnalysis(input: {
  a_profile_id: string;
  b_profile_id: string;
  relationship_description: string;
  locale: string;
}): Promise<{
  report: MatchReport;
  meta: any;
}> {
  // 1. 加载两个 profile
  let [aProfile, bProfile] = await Promise.all([
    getStoredProfile(input.a_profile_id),
    getStoredProfile(input.b_profile_id)
  ]);
  
  if (!aProfile || !bProfile) {
    throw new Error('Profile not found');
  }
  
  // 2. 确保两个都有 base_analysis(如未生成)
  if (!aProfile.base_analysis?.content) {
    console.log('[match] Generating A base_analysis...');
    await generateBaseAnalysis(input.a_profile_id);
    aProfile = await getStoredProfile(input.a_profile_id);
  }
  
  if (!bProfile.base_analysis?.content) {
    console.log('[match] Generating B base_analysis...');
    await generateBaseAnalysis(input.b_profile_id);
    bProfile = await getStoredProfile(input.b_profile_id);
  }
  
  // 3. 构建 prompt
  const { system, user, detected_language } = buildMatchPrompt({
    a_profile: aProfile,
    b_profile: bProfile,
    relationship_description: input.relationship_description,
    locale: input.locale
  });
  
  console.log(`[match] Calling DeepSeek V4 Pro... Output language: ${detected_language}`);
  const startTime = Date.now();
  
  // 4. 调用 DeepSeek(high thinking)
  const result = await callLLM({
    call_type: 'deep_analysis',
    system,
    messages: [{ role: 'user', content: user }],
    max_tokens: 15000,  // 5 段报告 + 4-6 个 actions
    thinking_effort: 'high',
    response_format: 'json'
  });
  
  // 5. 解析 JSON
  let parsed: any;
  try {
    const cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (e: any) {
    console.error('[match] JSON parse failed:', e.message);
    throw new Error('Match analysis output is not valid JSON');
  }
  
  // 6. 校验必需字段
  const requiredKeys = ['analysis_a', 'analysis_b', 'combined', 'conclusion', 'recommendations'];
  for (const key of requiredKeys) {
    if (!parsed[key]) {
      throw new Error(`Missing required section: ${key}`);
    }
  }
  
  // 7. 校验 compatibility_level
  const validLevels = [
    'highly_compatible', 'compatible_with_effort', 
    'neutral', 'challenging', 'highly_challenging'
  ];
  if (!validLevels.includes(parsed.conclusion?.compatibility_level)) {
    console.warn('[match] Invalid compatibility_level, defaulting to neutral');
    parsed.conclusion.compatibility_level = 'neutral';
  }
  
  // 8. 注入 _meta
  parsed._meta = {
    a_profile_id: input.a_profile_id,
    b_profile_id: input.b_profile_id,
    relationship_description: input.relationship_description,
    detected_language,
    generated_at: new Date().toISOString(),
    model: result.actual_model,
    tokens_used: result.meta.tokens_used
  };
  
  // 9. 记录使用
  await Promise.all([
    recordProfileUsage(input.a_profile_id, 'match'),
    recordProfileUsage(input.b_profile_id, 'match')
  ]);
  
  const elapsedMs = Date.now() - startTime;
  console.log(`[match] Done in ${elapsedMs}ms`);
  
  return {
    report: parsed as MatchReport,
    meta: {
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      cost_usd: result.meta.cost_usd || 0,
      latency_ms: elapsedMs,
      detected_language
    }
  };
}
```

## Step 6.3: API 路由

文件:`app/api/match/analyze/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { generateMatchAnalysis } from '@/lib/llm/services/match-analysis-service';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { a_profile_id, b_profile_id, relationship_description, locale } = body;
    
    if (!a_profile_id || !b_profile_id || !relationship_description) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    
    if (a_profile_id === b_profile_id) {
      return NextResponse.json({ error: 'same_profile' }, { status: 400 });
    }
    
    const result = await generateMatchAnalysis({
      a_profile_id,
      b_profile_id,
      relationship_description,
      locale: locale || 'en'
    });
    
    return NextResponse.json({
      success: true,
      report: result.report,
      meta: result.meta
    });
  } catch (e: any) {
    console.error('[api/match/analyze] error:', e);
    return NextResponse.json({
      error: 'analysis_failed',
      message: e.message
    }, { status: 500 });
  }
}
```

## 验证清单

```
□ match-deepseek-prompt.ts 实现
□ 语言检测(中/英/西/法/德)
□ 命主 A + B 完整注入
□ 5 段 JSON 结构
□ compatibility_level 5 等级
□ match-analysis-service.ts 实现
□ 自动生成缺失的 base_analysis
□ /api/match/analyze API 工作

🛑 等用户确认进入 Step 7
```

---

# 第 7 部分:Step 7 - 分析中页面

## Step 7.1: /match/analyzing 页面

文件:`app/[locale]/(marketing)/match/analyzing/page.tsx`

```typescript
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { createMatchSession } from '@/lib/match/match-session';
import { recordUsage } from '@/lib/syncro/device-usage';

export default function MatchAnalyzingPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('match.analyzing');
  
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  
  const steps = [
    t('step_1'),
    t('step_2'),
    t('step_3'),
    t('step_4'),
    t('step_5'),
    t('step_6'),
    t('step_7')
  ];
  
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    
    analyze();
    
    // 流式步骤动画
    const interval = setInterval(() => {
      setStep(s => (s + 1) % steps.length);
    }, 3500);
    
    return () => clearInterval(interval);
  }, []);
  
  async function analyze() {
    try {
      const aId = sessionStorage.getItem('match_a_profile_id');
      const bId = sessionStorage.getItem('match_b_profile_id');
      const relationship = sessionStorage.getItem('match_relationship');
      const sessionType = sessionStorage.getItem('match_session_type') || 'paid';
      
      if (!aId || !bId || !relationship) {
        throw new Error('Missing required data');
      }
      
      // 调用分析 API
      const response = await fetch('/api/match/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          a_profile_id: aId,
          b_profile_id: bId,
          relationship_description: relationship,
          locale
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Analysis failed');
      }
      
      const data = await response.json();
      
      // 创建 Match session
      const matchId = await createMatchSession({
        a_profile_id: aId,
        b_profile_id: bId,
        relationship_description: relationship,
        report: data.report,
        is_free: sessionType === 'free',
        cost_usd: data.meta.cost_usd,
        locale
      });
      
      // 记录使用
      await recordUsage('match', sessionType === 'free', data.meta.cost_usd);
      
      // 自动保存到 Archive
      const { saveMatchToArchive } = await import('@/lib/archive/archive-service');
      await saveMatchToArchive({
        match_id: matchId,
        a_profile_id: aId,
        b_profile_id: bId,
        relationship_description: relationship,
        report: data.report
      });
      
      // 清理 sessionStorage
      sessionStorage.removeItem('match_a_profile_id');
      sessionStorage.removeItem('match_b_profile_id');
      sessionStorage.removeItem('match_relationship');
      sessionStorage.removeItem('match_session_type');
      
      // 跳转到结果
      router.push(`/${locale}/match/result/${matchId}`);
    } catch (e: any) {
      setError(e.message);
    }
  }
  
  if (error) {
    return (
      <div className="match-analyzing error">
        <div className="error-icon">✕</div>
        <h2>{t('error_title')}</h2>
        <p>{error}</p>
        <button onClick={() => router.push(`/${locale}/match`)}>
          {t('go_back')}
        </button>
      </div>
    );
  }
  
  return (
    <div className="match-analyzing">
      <div className="analyzing-icons">
        <div className="dual-circles">
          <div className="circle circle-a"></div>
          <div className="circle circle-b"></div>
        </div>
      </div>
      
      <p key={step} className="analyzing-step">
        {steps[step]}
      </p>
      
      <p className="analyzing-hint">{t('hint')}</p>
    </div>
  );
}
```

## Step 7.2: 翻译

`messages/en/match.json` 补充:

```json
{
  "analyzing": {
    "step_1": "Reading Person A's chart...",
    "step_2": "Reading Person B's chart...",
    "step_3": "Mapping five-element dynamics...",
    "step_4": "Analyzing ten-god interactions...",
    "step_5": "Examining timing alignment...",
    "step_6": "Weaving the relationship pattern...",
    "step_7": "Almost ready...",
    "hint": "Generating your full compatibility report. About 60-90 seconds.",
    "error_title": "Analysis failed",
    "go_back": "Try again"
  }
}
```

`messages/zh/match.json` 补充:

```json
{
  "analyzing": {
    "step_1": "正在解读命主 A 的命盘...",
    "step_2": "正在解读命主 B 的命盘...",
    "step_3": "推演五行生克互动...",
    "step_4": "分析十神关系...",
    "step_5": "考察大运流年协同...",
    "step_6": "编织你们的关系结构...",
    "step_7": "即将完成...",
    "hint": "生成完整合盘报告中,约 60-90 秒。",
    "error_title": "分析失败",
    "go_back": "重试"
  }
}
```

## 验证清单

```
□ /match/analyzing 页面工作
□ 流式动画显示 7 个步骤
□ DeepSeek 调用成功
□ 创建 match session
□ 记录 device_usage
□ 自动保存到 Archive
□ 错误显示重试
□ 跳转 result 页

🛑 等用户确认进入 Step 8
```

---

# 第 8 部分:Step 8 - 报告渲染(卡片式)

## Step 8.1: /match/result/[id] 页面

文件:`app/[locale]/(marketing)/match/result/[id]/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { loadMatchSession } from '@/lib/match/match-session';
import { MatchReport } from '@/components/match/MatchReport';

export default function MatchResultPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  
  const matchId = params.id as string;
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadMatchSession(matchId).then(s => {
      setSession(s);
      setLoading(false);
    });
  }, [matchId]);
  
  if (loading) {
    return <div className="loading-fullscreen">Loading...</div>;
  }
  
  if (!session) {
    return (
      <div className="match-error">
        <p>Match not found</p>
        <button onClick={() => router.push(`/${locale}/match`)}>
          Back to Match
        </button>
      </div>
    );
  }
  
  return (
    <MatchReport
      session={session}
      locale={locale}
    />
  );
}
```

## Step 8.2: MatchReport 主组件

文件:`components/match/MatchReport.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { MatchSession } from '@/lib/match/types';
import { COMPATIBILITY_LEVELS } from '@/lib/match/types';
import { MatchReportCard } from './MatchReportCard';

interface Props {
  session: MatchSession;
  locale: string;
}

export function MatchReport({ session, locale }: Props) {
  const t = useTranslations('match.report');
  const router = useRouter();
  
  const { report } = session;
  const isZh = locale.startsWith('zh');
  
  const compatibilityInfo = COMPATIBILITY_LEVELS[report.conclusion.compatibility_level];
  
  return (
    <div className="match-report">
      {/* Header */}
      <div className="report-header">
        <h1>{t('title')}</h1>
        <p className="relationship-line">
          "{session.relationship_description}"
        </p>
      </div>
      
      {/* Compatibility Badge */}
      <div className="compatibility-badge-wrapper">
        <div 
          className="compatibility-badge"
          style={{
            borderColor: compatibilityInfo.color_hex,
            color: compatibilityInfo.color_hex
          }}
        >
          <span className="badge-label">{t('compatibility_label')}</span>
          <span className="badge-level">
            {isZh ? compatibilityInfo.name_zh : compatibilityInfo.name_en}
          </span>
          <div className="badge-bars">
            {[1, 2, 3, 4, 5].map(i => (
              <span 
                key={i}
                className={`bar ${i <= compatibilityInfo.score ? 'filled' : ''}`}
                style={i <= compatibilityInfo.score ? { background: compatibilityInfo.color_hex } : {}}
              ></span>
            ))}
          </div>
        </div>
      </div>
      
      {/* 5 Cards */}
      <div className="match-cards">
        <MatchReportCard
          icon="A"
          title={report.analysis_a.title}
          summary={report.analysis_a.summary}
          color="#D4AF37"
        >
          <div className="card-content">
            <p>{report.analysis_a.detail}</p>
            
            <h4>{t('key_traits')}</h4>
            <ul className="traits-list">
              {report.analysis_a.key_traits.map((trait, i) => (
                <li key={i}>{trait}</li>
              ))}
            </ul>
          </div>
        </MatchReportCard>
        
        <MatchReportCard
          icon="B"
          title={report.analysis_b.title}
          summary={report.analysis_b.summary}
          color="#87CEEB"
        >
          <div className="card-content">
            <p>{report.analysis_b.detail}</p>
            
            <h4>{t('key_traits')}</h4>
            <ul className="traits-list">
              {report.analysis_b.key_traits.map((trait, i) => (
                <li key={i}>{trait}</li>
              ))}
            </ul>
          </div>
        </MatchReportCard>
        
        <MatchReportCard
          icon="×"
          title={report.combined.title}
          summary={report.combined.summary}
          color="#E91E63"
        >
          <div className="card-content">
            <p>{report.combined.detail}</p>
            
            <h4>{t('five_elements')}</h4>
            <p>{report.combined.five_elements_interaction}</p>
            
            <h4>{t('timing_dynamic')}</h4>
            <p>{report.combined.timing_dynamic}</p>
          </div>
        </MatchReportCard>
        
        <MatchReportCard
          icon="🎯"
          title={report.conclusion.title}
          summary={report.conclusion.summary}
          color={compatibilityInfo.color_hex}
        >
          <div className="card-content">
            <p>{report.conclusion.detail}</p>
            
            <h4>{t('strengths')}</h4>
            <ul className="strengths-list">
              {report.conclusion.strengths.map((s, i) => (
                <li key={i}>✓ {s}</li>
              ))}
            </ul>
            
            <h4>{t('challenges')}</h4>
            <ul className="challenges-list">
              {report.conclusion.challenges.map((c, i) => (
                <li key={i}>⚠ {c}</li>
              ))}
            </ul>
          </div>
        </MatchReportCard>
        
        <MatchReportCard
          icon="📋"
          title={report.recommendations.title}
          summary={report.recommendations.summary}
          color="#4CAF50"
        >
          <div className="card-content">
            <div className="actions-list">
              {report.recommendations.actions.map((action, i) => (
                <ActionItem 
                  key={i} 
                  action={action} 
                  index={i + 1}
                  locale={locale}
                />
              ))}
            </div>
          </div>
        </MatchReportCard>
      </div>
      
      {/* Footer */}
      <div className="report-footer">
        <p>{t('saved_to_archive')}</p>
        <button 
          onClick={() => router.push(`/${locale}/archive`)}
          className="secondary"
        >
          {t('view_archive')}
        </button>
        <button 
          onClick={() => router.push(`/${locale}/match`)}
          className="primary"
        >
          {t('new_match')}
        </button>
      </div>
    </div>
  );
}

function ActionItem({ action, index, locale }: any) {
  const t = useTranslations('match.report');
  
  const categoryIcons: Record<string, string> = {
    communication: '💬',
    timing: '⏰',
    boundary: '⊞',
    growth: '🌱',
    fengshui: '🏯'
  };
  
  return (
    <div className="action-item">
      <div className="action-number">{index}</div>
      <div className="action-body">
        <div className="action-header">
          <span className="action-icon">{categoryIcons[action.category]}</span>
          <h4>{action.title}</h4>
        </div>
        <p className="action-detail">{action.detail}</p>
        {action.timing && (
          <p className="action-timing">
            <span className="timing-label">{t('timing')}:</span> {action.timing}
          </p>
        )}
      </div>
    </div>
  );
}
```

## Step 8.3: MatchReportCard 单卡片组件

文件:`components/match/MatchReportCard.tsx`

```typescript
'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  icon: string;
  title: string;
  summary: string;
  color: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

export function MatchReportCard({ 
  icon, 
  title, 
  summary, 
  color,
  defaultExpanded = false,
  children 
}: Props) {
  const t = useTranslations('match.report');
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  return (
    <div 
      className={`match-report-card ${expanded ? 'expanded' : ''}`}
      style={{ borderLeftColor: color }}
    >
      <button 
        className="card-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="card-icon" style={{ background: color }}>
          {icon}
        </div>
        <div className="card-header-text">
          <h3>{title}</h3>
          <p className="card-summary">{summary}</p>
        </div>
        <div className="card-toggle">
          {expanded ? '−' : '+'}
        </div>
      </button>
      
      {expanded && (
        <div className="card-body">
          {children}
        </div>
      )}
    </div>
  );
}
```

## Step 8.4: 翻译

`messages/en/match.json` 补充:

```json
{
  "report": {
    "title": "Match Report",
    "compatibility_label": "Overall Compatibility",
    "key_traits": "Key Traits",
    "five_elements": "Five-Element Dynamic",
    "timing_dynamic": "Timing Alignment",
    "strengths": "Strengths",
    "challenges": "Challenges",
    "timing": "When",
    "saved_to_archive": "Saved to your Archive.",
    "view_archive": "View in Archive",
    "new_match": "Run another Match"
  }
}
```

`messages/zh/match.json` 补充:

```json
{
  "report": {
    "title": "合盘报告",
    "compatibility_label": "整体契合度",
    "key_traits": "关键特质",
    "five_elements": "五行互动",
    "timing_dynamic": "大运流年协同",
    "strengths": "优势",
    "challenges": "挑战",
    "timing": "时机",
    "saved_to_archive": "已保存到你的 Archive。",
    "view_archive": "在 Archive 中查看",
    "new_match": "再做一次 Match"
  }
}
```

## Step 8.5: 关键 CSS

文件:`styles/match.css`

```css
/* ============= Match 主报告 ============= */

.match-report {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px;
  color: #e5e5e5;
}

.report-header {
  text-align: center;
  margin-bottom: 32px;
}

.report-header h1 {
  color: #D4AF37;
  font-size: 28px;
  margin-bottom: 8px;
  letter-spacing: 4px;
}

.relationship-line {
  color: #888;
  font-style: italic;
  font-size: 14px;
  max-width: 500px;
  margin: 0 auto;
  line-height: 1.5;
}

/* Compatibility Badge */
.compatibility-badge-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
}

.compatibility-badge {
  background: rgba(0, 0, 0, 0.3);
  border: 2px solid;
  border-radius: 16px;
  padding: 20px 32px;
  text-align: center;
  min-width: 280px;
}

.badge-label {
  display: block;
  color: #888;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 6px;
}

.badge-level {
  display: block;
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 12px;
}

.badge-bars {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.bar {
  width: 36px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

/* ============= 5 个卡片 ============= */

.match-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
}

.match-report-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-left: 4px solid #D4AF37;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s;
}

.match-report-card.expanded {
  background: rgba(255, 255, 255, 0.05);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  color: inherit;
}

.card-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.card-header-text {
  flex: 1;
}

.card-header-text h3 {
  color: #e5e5e5;
  font-size: 16px;
  margin-bottom: 4px;
}

.card-summary {
  color: #888;
  font-size: 13px;
  line-height: 1.5;
}

.card-toggle {
  color: #888;
  font-size: 24px;
  font-weight: 300;
  width: 24px;
  text-align: center;
}

.card-body {
  padding: 0 20px 20px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 16px;
  margin: 0 16px;
}

.card-content p {
  color: #ccc;
  line-height: 1.7;
  margin-bottom: 12px;
}

.card-content h4 {
  color: #D4AF37;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 16px 0 8px 0;
}

.traits-list, .strengths-list, .challenges-list {
  list-style: none;
  padding: 0;
}

.traits-list li, .strengths-list li, .challenges-list li {
  color: #ccc;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 14px;
}

.strengths-list li {
  color: #4CAF50;
}

.challenges-list li {
  color: #F57C00;
}

/* ============= Action Items ============= */

.actions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: rgba(76, 175, 80, 0.05);
  border-radius: 8px;
}

.action-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #4CAF50;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.action-body {
  flex: 1;
}

.action-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.action-icon {
  font-size: 16px;
}

.action-header h4 {
  color: #4CAF50 !important;
  font-size: 14px !important;
  margin: 0 !important;
  text-transform: none !important;
  letter-spacing: 0 !important;
}

.action-detail {
  color: #ccc;
  font-size: 13px;
  line-height: 1.6;
}

.action-timing {
  margin-top: 6px;
  font-size: 12px;
  color: #888;
}

.timing-label {
  color: #4CAF50;
}

/* ============= Footer ============= */

.report-footer {
  text-align: center;
  padding: 24px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.report-footer p {
  color: #888;
  margin-bottom: 12px;
  font-size: 13px;
}

.report-footer .primary,
.report-footer .secondary {
  margin: 0 6px;
}

/* ============= 分析中页面 ============= */

.match-analyzing {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: radial-gradient(circle at center, #0a0a1a 0%, #000 100%);
}

.dual-circles {
  position: relative;
  width: 120px;
  height: 80px;
  margin-bottom: 32px;
}

.dual-circles .circle {
  position: absolute;
  top: 0;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid;
  animation: pulse-circle 2s ease-in-out infinite;
}

.dual-circles .circle-a {
  left: 0;
  border-color: #D4AF37;
  background: radial-gradient(circle, rgba(212, 175, 55, 0.2) 0%, transparent 70%);
}

.dual-circles .circle-b {
  right: 0;
  border-color: #87CEEB;
  background: radial-gradient(circle, rgba(135, 206, 235, 0.2) 0%, transparent 70%);
  animation-delay: 1s;
}

@keyframes pulse-circle {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
}

.analyzing-step {
  font-size: 16px;
  color: #D4AF37;
  margin-bottom: 12px;
  animation: fadeIn 0.5s ease-in;
}

.analyzing-hint {
  font-size: 12px;
  color: #666;
  font-style: italic;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## 验证清单

```
□ MatchReport 主组件渲染
□ Compatibility Badge 显示等级 + 5 格条
□ 5 张卡片可展开/折叠
□ 每张卡片图标 + 颜色区分
□ Recommendations 显示编号 + 类别图标
□ 输出语言匹配用户输入语言
□ 移动响应式
□ Footer 跳转到 Archive 或新 Match

🛑 等用户确认进入 Step 9
```

---

# 第 9 部分:Step 9 - Archive 集成

## Step 9.1: 扩展 archive-service.ts

修改 `lib/archive/archive-service.ts` 添加 Match 支持:

```typescript
// 在已有 archive-service.ts 中添加

export interface MatchArchiveData {
  match_session_id: string;
  a_profile_id: string;
  b_profile_id: string;
  relationship_description: string;
  compatibility_level: string;
  created_at: string;
  // 不存完整 report(大),存关键信息
  summary: {
    overall_summary: string;     // conclusion.summary
    a_summary: string;           // analysis_a.summary
    b_summary: string;
    top_actions: string[];       // 前 3 个 action 的 title
  };
}

export async function saveMatchToArchive(input: {
  match_id: string;
  a_profile_id: string;
  b_profile_id: string;
  relationship_description: string;
  report: any;
}): Promise<string> {
  const deviceId = getDeviceId();
  if (!deviceId) throw new Error('App not initialized');
  
  const archiveId = uuidv4();
  const now = new Date();
  
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  // 截取关系描述前 30 字作为标题
  const relSnippet = input.relationship_description.slice(0, 30) + 
    (input.relationship_description.length > 30 ? '...' : '');
  const title = `Match: ${relSnippet} - ${dateStr}`;
  
  const data: MatchArchiveData = {
    match_session_id: input.match_id,
    a_profile_id: input.a_profile_id,
    b_profile_id: input.b_profile_id,
    relationship_description: input.relationship_description,
    compatibility_level: input.report.conclusion?.compatibility_level || 'neutral',
    created_at: now.toISOString(),
    summary: {
      overall_summary: input.report.conclusion?.summary || '',
      a_summary: input.report.analysis_a?.summary || '',
      b_summary: input.report.analysis_b?.summary || '',
      top_actions: (input.report.recommendations?.actions || [])
        .slice(0, 3)
        .map((a: any) => a.title)
    }
  };
  
  const { ciphertext, iv } = await encrypt(data);
  
  await db.archive.put({
    archive_id: archiveId,
    device_id: deviceId,
    type: 'match_session',
    profile_id: input.a_profile_id,  // 用 A 作为关联
    title,
    encrypted_data: ciphertext,
    iv,
    created_at: now,
    product: 'match'
  });
  
  return archiveId;
}
```

## Step 9.2: Archive 主页 + 详情页支持 Match

修改 `app/[locale]/(marketing)/archive/page.tsx`:

在 filter 按钮加上 Match:

```typescript
// 已有的 filter buttons:
<button onClick={() => setFilter('match')} className={filter === 'match' ? 'active' : ''}>
  Match
</button>
```

修改 ArchiveCard 组件,加 Match 图标:

```typescript
const getIcon = () => {
  switch (item.product) {
    case 'poju': return '⭐';
    case 'glyph': return '🌿';
    case 'syncro': return '🧭';
    case 'match': return '👥';  // ⭐ 新增
    default: return '📄';
  }
};
```

修改 Archive 详情页 `app/[locale]/(marketing)/archive/[id]/page.tsx`:

```typescript
// 加载时根据 type 渲染不同视图

const { loadArchiveItem } = await import('@/lib/archive/archive-service');

// 加载 record 判断类型
if (record.type === 'match_session') {
  // 渲染 Match summary
  return <MatchArchiveDetail data={parsedData} />;
}
```

## Step 9.3: Match Archive 详情卡

新增 component `components/match/MatchArchiveDetail.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { COMPATIBILITY_LEVELS } from '@/lib/match/types';

export function MatchArchiveDetail({ data }: any) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('match.archive');
  
  const compatibility = COMPATIBILITY_LEVELS[data.compatibility_level] || COMPATIBILITY_LEVELS.neutral;
  const isZh = locale.startsWith('zh');
  
  return (
    <div className="match-archive-detail">
      <h2>{t('detail_title')}</h2>
      
      <div className="relationship-display">
        <span className="label">{t('relationship_label')}</span>
        <p>"{data.relationship_description}"</p>
      </div>
      
      <div 
        className="compatibility-line"
        style={{ borderColor: compatibility.color_hex, color: compatibility.color_hex }}
      >
        {isZh ? compatibility.name_zh : compatibility.name_en}
      </div>
      
      <div className="summary-section">
        <h3>{t('overall')}</h3>
        <p>{data.summary.overall_summary}</p>
      </div>
      
      <div className="summary-section">
        <h3>A</h3>
        <p>{data.summary.a_summary}</p>
      </div>
      
      <div className="summary-section">
        <h3>B</h3>
        <p>{data.summary.b_summary}</p>
      </div>
      
      <div className="summary-section">
        <h3>{t('top_actions')}</h3>
        <ul>
          {data.summary.top_actions.map((action: string, i: number) => (
            <li key={i}>{i + 1}. {action}</li>
          ))}
        </ul>
      </div>
      
      <div className="archive-detail-footer">
        <button 
          onClick={() => router.push(`/${locale}/match/result/${data.match_session_id}`)}
          className="primary"
        >
          {t('view_full_report')}
        </button>
      </div>
    </div>
  );
}
```

## Step 9.4: 翻译

`messages/en/match.json` 补充:

```json
{
  "archive": {
    "detail_title": "Match Reading",
    "relationship_label": "Relationship described:",
    "overall": "Overall",
    "top_actions": "Top Actions",
    "view_full_report": "View full report"
  }
}
```

`messages/zh/match.json` 补充:

```json
{
  "archive": {
    "detail_title": "合盘解读",
    "relationship_label": "关系描述:",
    "overall": "总体",
    "top_actions": "重点行动",
    "view_full_report": "查看完整报告"
  }
}
```

## 验证清单

```
□ saveMatchToArchive 实现
□ Archive 主页支持 Match 过滤
□ Match 图标显示(👥)
□ Match 详细页渲染
□ "View full report" 按钮跳转回完整 result

🛑 等用户确认进入 Step 10
```

---

# 第 10 部分:Step 10 - 端到端测试

## Step 10:完整 Match 流程测试

```
任务:

清空浏览器数据 → 启动 dev server → 完整测试

【准备测试数据】

需要 stored_profiles 中至少有 2 个 profile:
  A: 1977-02-17 03:00 男(乙木日主)
  B: 1985-08-15 14:00 女(自定义,要不同八字)

如果没有 B,在 Step 4 中创建 B 的滚轮表单测试。

【场景 A:首次免费 Match】

1. 访问 /match
   ✓ 看到 Match 介绍 + 功能 + 用例
   ✓ 按钮显示 "Run a free Match"

2. 点击 → 跳转 /match/select-a
   ✓ 看到"Step 1 of 3"
   ✓ "Person A" 标题
   ✓ 显示已有 profiles 列表
   ✓ 选择 A → 跳转 /match/select-b

3. /match/select-b
   ✓ "Step 2 of 3"
   ✓ "Person B" 标题
   ✓ 列表中过滤掉 A
   ✓ 添加新 B 八字(滚轮表单)
   ✓ 自动保存到 stored_profiles
   ✓ 跳转 /match/relationship

4. /match/relationship
   ✓ "Step 3 of 3"
   ✓ 显示 A vs B 简略信息
   ✓ 输入框(10-200 字)
   ✓ 示例引导显示
   ✓ 语言提示
   ✓ 输入:"My business partner of 3 years. We're considering scaling but tension has built up."
   ✓ 点击 "Run the Match" → 跳转 analyzing

5. /match/analyzing
   ✓ 双圆动画(A 和 B 交替闪)
   ✓ 流式步骤显示(7 个)
   ✓ DeepSeek 调用约 60-90 秒
   ✓ 检测语言为 English
   ✓ 创建 match session
   ✓ 记录 device_usage(free_used = true)
   ✓ 保存到 Archive
   ✓ 跳转 /match/result/[id]

6. /match/result/[id] 报告渲染
   ✓ Header 显示关系描述
   ✓ Compatibility Badge 显示等级 + 5 格条
   ✓ 5 张卡片:
     - About A(展开/折叠)
     - About B(展开/折叠)
     - Together(五行 + 时机互动)
     - Conclusion(优势 + 挑战)
     - What to Do(4-6 个 action)
   ✓ 每张卡片有颜色区分
   ✓ 全英文输出(因为输入是英文)
   ✓ Footer 有 "View Archive" 和 "Run another Match"

【场景 B:中文输入测试语言适配】

7. 重新走流程,关系描述用中文:
   "我和未婚妻交往 3 年了,准备明年结婚,但我家里反对。"

8. 验证:
   ✓ 报告全中文输出
   ✓ 命理术语用中文(日主、用神、十神等)
   ✓ Compatibility Level 显示中文(如"高度契合")
   ✓ Actions 类别 + 标题 + 详细都中文

【场景 C:已用免费,要付费】

9. device_usage 中 match.free_used = true
10. 访问 /match
    ✓ 按钮显示 "Start a Match — $4.99"

【场景 D:Archive 验证】

11. 访问 /archive
    ✓ 看到 Match 条目(图标 👥)
    ✓ 标题:"Match: My business partner... - 2026-05-22"
    
12. 点击 Match 条目
    ✓ 显示 MatchArchiveDetail
    ✓ Compatibility Level + 颜色
    ✓ Overall / A / B / Top Actions
    ✓ "View full report" → 跳回 /match/result/[id]

【场景 E:B 八字保存验证】

13. 完成 Match 后,B 应该被保存到 stored_profiles
14. 访问 /poju 主页 → ProfileSelector
    ✓ 列表中能看到 B 的 profile
    ✓ B 可以用于其他产品(POJU/Glyph/Syncro)
15. 如果用户想删除 B → 去 Archive 操作(P2 实现)

【场景 F:错误处理】

16. 测试 LLM 失败:
    - 临时把 OpenRouter key 改错
    - 分析页面应显示错误 + 重试按钮
    
17. 测试 same profile:
    - sessionStorage 中 A 和 B 设为同一 ID
    - API 应返回 400 same_profile

【验证清单】

□ 场景 A-F 全部通过
□ 5 段报告完整
□ 语言自动适配
□ Compatibility 5 等级正常
□ Archive 集成正常
□ B 八字保存到 stored_profiles
□ device_usage 跟踪正确
□ 错误优雅处理

【提交报告】

完成后向用户提交:
1. 6 个场景的测试日志
2. DeepSeek 调用统计(tokens / cost)
3. 报告 JSON 完整示例
4. 中英文输出对比截图描述
5. Archive 集成截图描述
6. 总成本(单次 $1.5-2.5)
7. 任何 bug 或体验问题
```

## 验证清单

```
□ 全部 6 个场景通过
□ 5 段报告渲染正确
□ 语言自动适配工作
□ B 八字保存到 stored_profiles
□ Archive 集成
□ device_usage 跟踪
□ 错误处理优雅
□ 总成本可控($1.5-2.5/次)

🛑 等用户最终确认 Match v5.0 上线就绪
```

---

# Match v5.0 完整新功能清单

```
✅ Step 1: 项目结构 + 数据类型
✅ Step 2: Match 入口主页
✅ Step 3: 选择 A 八字
✅ Step 4: 选择 B 八字(自动保存)
✅ Step 5: 关系描述输入(自由文本)
✅ Step 6: Match DeepSeek Prompt + Service
✅ Step 7: 分析中页面
✅ Step 8: 报告渲染(卡片式)
✅ Step 9: Archive 集成
✅ Step 10: 端到端 6 场景测试

核心成就:
  ⭐ 复用 POJU 八字采集系统
  ⭐ 复用 device_usage(首次免费,后续 $4.99)
  ⭐ 自由文本关系输入(不限定关系类型)
  ⭐ B 八字自动保存到 stored_profiles
  ⭐ 输出语言跟随用户输入语言
  ⭐ 5 段卡片式报告(可展开)
  ⭐ Compatibility 5 等级评级
  ⭐ 4-6 个可执行 actions
  ⭐ 共享 Archive 系统
  ⭐ 跨产品命主一致性
```

---

# 给 Cursor 的最终提醒

```
本任务包含 Step 1-10。

实施顺序(严格按序):
1. Step 1: 结构 + 数据类型
2. Step 2: 入口主页
3. Step 3: 选 A
4. Step 4: 选 B
5. Step 5: 关系输入
6. Step 6: Prompt + Service + API
7. Step 7: 分析中页面
8. Step 8: 报告渲染
9. Step 9: Archive 集成
10. Step 10: 端到端测试

绝不允许:
  ✗ 跨 Step 实施
  ✗ 预设关系类型按钮
  ✗ 让用户选保存还是临时
  ✗ 让 B 也付费
  ✗ 输出语言固定(必须跟随输入)

完成后:
  ✓ Match v5.0 上线就绪
  ✓ POJU + Glyph + Syncro + Match 四件套完整
  ✓ 共享底层:stored_profiles + ProfileSelector + ORIENTAL_COUNSELOR_BASE + Archive + device_usage
  ✓ 可以软上线 100-500 个 beta 用户
```

---

**Cursor: 完成 Step 1-10 后,Match v5.0 完整上线。**

**用户:四件套全部就绪,可以进入软上线阶段。**
