# POJU v5.0 · 重构指令文档 · Part 2

> **前置**: Part 1 已完成(Step 0-E,共 6 步)
>
> **本部分覆盖**:
> - Step F: 数据准备页(DeepSeek base_analysis 调用 + 流式动效)
> - Step G: 对话页改造(AI 主动开场 + 流式思考 + 修复双重回复)
> - Step H: Agent 状态机简化(5 phase + 玄学 prompt 注入)
> - Step I: 全新 System Prompt 库(东方破局顾问定位)
> - Step J: API 路由统一改造(全 DeepSeek V4 Pro)
> - Step K: 端到端测试(验证 12 个问题全部修复)
>
> **核心战略提醒**(再次):
> - POJU 本质 = 东方破局顾问(算命 + 行动建议)
> - 对外营销弱化(过支付审核)
> - 对内 Prompt 回归玄学
> - 每个 Prompt 都要带玄学定位
> - 不再用 sanitizer 暴力清洗术语
>
> **执行原则**: 每个 Step 完成后【贴出输出 + 等用户确认】才能下一步

---

# 第 1 部分:Step F - 数据准备页

## Step F:DeepSeek base_analysis 调用 + 流式 loading

```
任务:

用户在 prepare 页确认信息后,进入 preparing 页:
1. 显示用户的八字命盘(年柱/月柱/日柱/时柱)
2. 启动 DeepSeek base_analysis 调用
3. 单行流式动画展示"工程步骤"
4. 完成后自动跳转到对话页

关键设计:
  - 显示八字 = 让用户【看到真实数据】(解决问题 6)
  - 流式动画 = 用户【看到 AI 在工作】(解决问题 2)
  - 不显示 LLM 内部思考 = 防止泄露(解决问题 7)
```

### F.1: 新路由 preparing/page.tsx

```typescript
// app/[locale]/(marketing)/poju/session/[id]/preparing/page.tsx

'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ChartReadingLoader } from '@/components/poju/ChartReadingLoader';
import { loadPOJUSession, savePOJUSession } from '@/lib/poju/session-manager';
import { getStoredProfile } from '@/lib/profile/stored-profiles-service';
import { generateBaseAnalysis } from '@/lib/llm/deepseek/base-analysis';
import type { POJUSessionState } from '@/lib/poju/types';

export default function PreparingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  
  const sessionId = params.id as string;
  const profileIdFromUrl = searchParams.get('profile');
  
  const [session, setSession] = useState<POJUSessionState | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<string>('loading');
  const [error, setError] = useState<string | null>(null);
  
  // 防止双重启动
  const hasStartedRef = useRef(false);
  
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    
    startPreparation();
  }, []);
  
  async function startPreparation() {
    try {
      // 1. 加载 session
      const s = await loadPOJUSession(sessionId);
      if (!s) {
        router.push('/poju');
        return;
      }
      setSession(s);
      
      // 2. 确认 profileId
      const profileId = profileIdFromUrl || s.selected_profile_id;
      if (!profileId) {
        // 没选 profile,回 prepare 页
        router.replace(`/${locale}/poju/session/${sessionId}/prepare`);
        return;
      }
      
      // 3. 加载 profile 数据
      const p = await getStoredProfile(profileId);
      if (!p) {
        throw new Error('Profile not found');
      }
      setProfile(p);
      
      // 4. 更新 session
      const updatedSession = {
        ...s,
        selected_profile_id: profileId
      };
      await savePOJUSession(updatedSession);
      
      // 5. 检查是否已有 base_analysis
      if (p.base_analysis?.content) {
        // 已有缓存,显示 1-2 秒动画后直接跳转
        setCurrentStep('using_cache');
        await sleep(2000);
        router.push(`/${locale}/poju/session/${sessionId}`);
        return;
      }
      
      // 6. 触发 base_analysis 生成
      setCurrentStep('analyzing');
      await generateBaseAnalysis(profileId);
      
      setCurrentStep('done');
      await sleep(1000);
      
      // 7. 跳转到对话页
      router.push(`/${locale}/poju/session/${sessionId}`);
      
    } catch (err: any) {
      console.error('[preparing] Failed:', err);
      setError(err.message);
      setCurrentStep('error');
    }
  }
  
  function handleRetry() {
    setError(null);
    setCurrentStep('loading');
    hasStartedRef.current = false;
    startPreparation();
  }
  
  function handleRefund() {
    router.push(`/${locale}/poju/session/${sessionId}/refund`);
  }
  
  if (!session || !profile) {
    return <div className="loading-fullscreen">Loading...</div>;
  }
  
  return (
    <ChartReadingLoader
      profile={profile}
      currentStep={currentStep}
      error={error}
      onRetry={handleRetry}
      onRefund={handleRefund}
      locale={locale}
    />
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### F.2: ChartReadingLoader 组件(显示八字 + 流式动画)

```typescript
// components/poju/ChartReadingLoader.tsx

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  profile: any;
  currentStep: string;
  error: string | null;
  onRetry: () => void;
  onRefund: () => void;
  locale: string;
}

export function ChartReadingLoader({
  profile,
  currentStep,
  error,
  onRetry,
  onRefund,
  locale
}: Props) {
  const t = useTranslations('chart_loader');
  
  // 流式动画的"当前显示步骤"
  const [animatedStep, setAnimatedStep] = useState(0);
  
  // 步骤列表(对应不同 Phase)
  const steps = getStepsList(locale);
  
  // 启动动画循环
  useEffect(() => {
    if (currentStep === 'error' || currentStep === 'done') return;
    
    const interval = setInterval(() => {
      setAnimatedStep(prev => {
        // 在 analyzing 阶段循环显示
        if (currentStep === 'analyzing') {
          return (prev + 1) % steps.length;
        }
        if (currentStep === 'using_cache') {
          return Math.min(prev + 1, steps.length - 1);
        }
        return prev;
      });
    }, 2500);
    
    return () => clearInterval(interval);
  }, [currentStep, steps.length]);
  
  return (
    <div className="chart-loader-page">
      <div className="chart-loader-content">
        {/* 八字命盘显示 */}
        <BaziChartDisplay profile={profile} locale={locale} />
        
        {/* 状态显示区 */}
        <div className="loader-status-section">
          {currentStep === 'error' && error ? (
            <ErrorView error={error} onRetry={onRetry} onRefund={onRefund} />
          ) : currentStep === 'done' ? (
            <DoneView />
          ) : (
            <StreamingView 
              currentText={steps[animatedStep]}
              isUsingCache={currentStep === 'using_cache'}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============= 八字命盘显示 =============

function BaziChartDisplay({ profile, locale }: any) {
  const t = useTranslations('chart_loader');
  
  const bazi = profile.user_profile?.bazi;
  if (!bazi) return null;
  
  const birth = profile.birth_info;
  const isZh = locale.startsWith('zh');
  
  return (
    <div className="bazi-chart-display">
      <div className="chart-header">
        <h3>{t('your_chart_title')}</h3>
        <p className="birth-info-line">
          {birth.year}.{String(birth.month).padStart(2, '0')}.{String(birth.day).padStart(2, '0')}
          {' · '}
          {birth.gender === 'M' ? t('male') : t('female')}
          {' · '}
          {birth.timezone}
        </p>
      </div>
      
      <div className="four-pillars">
        <PillarColumn 
          label={t('pillar_year')} 
          stem={bazi.year.stem} 
          branch={bazi.year.branch}
        />
        <PillarColumn 
          label={t('pillar_month')} 
          stem={bazi.month.stem} 
          branch={bazi.month.branch}
        />
        <PillarColumn 
          label={t('pillar_day')} 
          stem={bazi.day.stem} 
          branch={bazi.day.branch}
          isDayMaster
        />
        <PillarColumn 
          label={t('pillar_hour')} 
          stem={bazi.hour.stem} 
          branch={bazi.hour.branch}
        />
      </div>
      
      <div className="chart-meta">
        <div className="meta-row">
          <span className="meta-label">{t('day_master_label')}:</span>
          <span className="meta-value gold">
            {bazi.day_master} ({getElementLabel(bazi.day_master_element, locale)})
          </span>
        </div>
        <div className="meta-row">
          <span className="meta-label">{t('strength_label')}:</span>
          <span className="meta-value">
            {getStrengthLabel(profile.user_profile.five_elements.day_master_strength, locale)}
          </span>
        </div>
        <div className="meta-row">
          <span className="meta-label">{t('current_phase_label')}:</span>
          <span className="meta-value">
            {profile.user_profile.da_yun.current.stem}
            {profile.user_profile.da_yun.current.branch}
            {' '}
            ({profile.user_profile.da_yun.current.age_range[0]}-{profile.user_profile.da_yun.current.age_range[1]})
          </span>
        </div>
      </div>
    </div>
  );
}

function PillarColumn({ label, stem, branch, isDayMaster }: any) {
  return (
    <div className={`pillar-column ${isDayMaster ? 'day-master' : ''}`}>
      <div className="pillar-label">{label}</div>
      <div className="pillar-stem">{stem}</div>
      <div className="pillar-branch">{branch}</div>
    </div>
  );
}

// ============= 流式动画显示 =============

function StreamingView({ currentText, isUsingCache }: { 
  currentText: string;
  isUsingCache: boolean;
}) {
  const t = useTranslations('chart_loader');
  
  return (
    <div className="streaming-view">
      <div className="streaming-spinner-container">
        <div className="streaming-spinner"></div>
      </div>
      
      <div className="streaming-text-area">
        {/* 这个是关键:单行流式显示 */}
        <p className="streaming-current-line">{currentText}</p>
      </div>
      
      <p className="streaming-hint">
        {isUsingCache ? t('hint_using_cache') : t('hint_first_time')}
      </p>
    </div>
  );
}

function DoneView() {
  const t = useTranslations('chart_loader');
  
  return (
    <div className="done-view">
      <div className="done-icon">✓</div>
      <p>{t('done_message')}</p>
    </div>
  );
}

function ErrorView({ error, onRetry, onRefund }: any) {
  const t = useTranslations('chart_loader');
  
  return (
    <div className="error-view">
      <div className="error-icon">✕</div>
      <h3>{t('error_title')}</h3>
      <p>{t('error_message')}</p>
      <details className="error-details">
        <summary>{t('error_details')}</summary>
        <pre>{error}</pre>
      </details>
      <div className="error-actions">
        <button onClick={onRetry} className="primary">{t('retry')}</button>
        <button onClick={onRefund} className="secondary">{t('refund_instead')}</button>
      </div>
    </div>
  );
}

// ============= 辅助 =============

function getStepsList(locale: string): string[] {
  const isZh = locale.startsWith('zh');
  
  if (isZh) {
    return [
      '正在校准你的出生时刻...',
      '排定四柱八字命盘...',
      '解析日主与五行强弱...',
      '判断格局与用神...',
      '推算大运流年走势...',
      '梳理神煞与刑冲合害...',
      '考察当前能量阶段...',
      '整理命主基础画像...',
      '即将完成,请稍候...'
    ];
  }
  
  return [
    'Calibrating your birth moment...',
    'Casting your four pillars...',
    'Analyzing day master and five elements...',
    'Determining your pattern and favorable element...',
    'Mapping life phases and current cycle...',
    'Reading auspicious stars and dynamics...',
    'Understanding your current energy phase...',
    'Composing your foundational reading...',
    'Almost done, just a moment...'
  ];
}

function getElementLabel(element: string, locale: string): string {
  const map: Record<string, Record<string, string>> = {
    zh: { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' },
    en: { wood: 'Wood', fire: 'Fire', earth: 'Earth', metal: 'Metal', water: 'Water' }
  };
  return map[locale.startsWith('zh') ? 'zh' : 'en'][element] || element;
}

function getStrengthLabel(strength: string, locale: string): string {
  const map: Record<string, Record<string, string>> = {
    zh: { strong: '偏强', balanced: '中和', weak: '偏弱' },
    en: { strong: 'Strong', balanced: 'Balanced', weak: 'Weak' }
  };
  return map[locale.startsWith('zh') ? 'zh' : 'en'][strength] || strength;
}
```

### F.3: 翻译文件

```json
// messages/en/chart_loader.json
{
  "your_chart_title": "Your Four Pillars",
  "male": "Male",
  "female": "Female",
  "pillar_year": "Year",
  "pillar_month": "Month",
  "pillar_day": "Day (Self)",
  "pillar_hour": "Hour",
  "day_master_label": "Day Master",
  "strength_label": "Strength",
  "current_phase_label": "Current 10-Year Phase",
  "hint_first_time": "Casting your detailed reading. Takes 30-60 seconds. This happens once.",
  "hint_using_cache": "Loading your previously analyzed chart...",
  "done_message": "Ready. Entering your session...",
  "error_title": "Preparation Failed",
  "error_message": "Something went wrong while preparing your reading.",
  "error_details": "Technical details",
  "retry": "Try Again",
  "refund_instead": "Refund Instead"
}

// messages/zh/chart_loader.json
{
  "your_chart_title": "你的四柱八字",
  "male": "男",
  "female": "女",
  "pillar_year": "年柱",
  "pillar_month": "月柱",
  "pillar_day": "日柱(命主)",
  "pillar_hour": "时柱",
  "day_master_label": "日主",
  "strength_label": "强弱",
  "current_phase_label": "当前大运",
  "hint_first_time": "正在为你做完整命理推演,约 30-60 秒。仅本次需要等待。",
  "hint_using_cache": "正在加载已分析的命盘...",
  "done_message": "已就绪,即将进入对话...",
  "error_title": "准备失败",
  "error_message": "推演过程中出现了问题。",
  "error_details": "技术细节",
  "retry": "重试",
  "refund_instead": "退款返回"
}
```

```
(es / fr / de Cursor 翻译)
```

### F.4: 样式

```css
/* styles/chart-loader.css */

.chart-loader-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0a0f 0%, #1a1a25 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #e5e5e5;
}

.chart-loader-content {
  max-width: 600px;
  width: 100%;
}

/* ============= 八字命盘 ============= */

.bazi-chart-display {
  background: rgba(212, 175, 55, 0.05);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

.chart-header {
  text-align: center;
  margin-bottom: 20px;
}

.chart-header h3 {
  color: #D4AF37;
  font-size: 18px;
  margin-bottom: 8px;
}

.birth-info-line {
  color: #888;
  font-size: 13px;
  font-family: 'Inter', sans-serif;
}

.four-pillars {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 20px;
}

.pillar-column {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px 8px;
  text-align: center;
}

.pillar-column.day-master {
  background: rgba(212, 175, 55, 0.1);
  border-color: rgba(212, 175, 55, 0.4);
}

.pillar-label {
  color: #888;
  font-size: 11px;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.pillar-stem {
  color: #D4AF37;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
  font-family: 'Noto Serif SC', serif;
}

.pillar-branch {
  color: #e5e5e5;
  font-size: 20px;
  font-weight: 600;
  font-family: 'Noto Serif SC', serif;
}

.chart-meta {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 12px;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.meta-label {
  color: #888;
}

.meta-value {
  color: #e5e5e5;
  font-weight: 500;
}

.meta-value.gold {
  color: #D4AF37;
}

/* ============= 流式动画 ============= */

.loader-status-section {
  text-align: center;
  padding: 32px 16px;
}

.streaming-view {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.streaming-spinner-container {
  margin-bottom: 24px;
}

.streaming-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(212, 175, 55, 0.2);
  border-top-color: #D4AF37;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.streaming-text-area {
  min-height: 28px;
  margin-bottom: 16px;
}

/* ⭐ 单行流式文字 - 关键样式 */
.streaming-current-line {
  color: #e5e5e5;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  
  /* 文字渐变出现效果 */
  animation: fadeInLine 0.6s ease-in;
}

@keyframes fadeInLine {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 用 key 切换动画(在 React 中用 key={animatedStep}) */
.streaming-current-line {
  /* 关键:配合 React 的 key 实现单行平滑切换 */
}

.streaming-hint {
  color: #666;
  font-size: 12px;
  font-style: italic;
}

/* ============= Done / Error ============= */

.done-view, .error-view {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.done-icon {
  color: #4caf50;
  font-size: 48px;
  margin-bottom: 16px;
}

.error-icon {
  color: #f44336;
  font-size: 48px;
  margin-bottom: 16px;
}

.error-details {
  margin-top: 16px;
  background: rgba(0, 0, 0, 0.3);
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 11px;
  color: #aaa;
  max-width: 100%;
  overflow-x: auto;
}

.error-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.error-actions button {
  padding: 12px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 600;
}

.error-actions .primary {
  background: #D4AF37;
  color: #0a0a0f;
}

.error-actions .secondary {
  background: transparent;
  color: #888;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### F.5: 关键修复 - StreamingView 用 React key 实现真正的流式切换

```typescript
// 修改 ChartReadingLoader.tsx 中的 StreamingView

function StreamingView({ currentText, isUsingCache }: { 
  currentText: string;
  isUsingCache: boolean;
}) {
  const t = useTranslations('chart_loader');
  
  return (
    <div className="streaming-view">
      <div className="streaming-spinner-container">
        <div className="streaming-spinner"></div>
      </div>
      
      <div className="streaming-text-area">
        {/* ⭐ 关键:用 key={currentText} 强制 React 重新渲染,触发 fadeInLine 动画 */}
        <p key={currentText} className="streaming-current-line">
          {currentText}
        </p>
      </div>
      
      <p className="streaming-hint">
        {isUsingCache ? t('hint_using_cache') : t('hint_first_time')}
      </p>
    </div>
  );
}
```

## 验证清单

```
□ /poju/session/[id]/preparing 路由可访问
□ 八字命盘正确显示(4 柱)
□ 用户看到自己的【真实出生信息】
□ 用户看到【日主 / 强弱 / 大运】等关键数据
□ 流式动画单行显示
□ 每 2.5 秒切换一句
□ 切换有 fade-in 动画
□ DeepSeek base_analysis 调用成功
□ 完成后跳转对话页
□ 已有缓存时快速跳过
□ 错误状态有重试 / 退款选项

🛑 等用户确认进入 Step G
```

---

# 第 2 部分:Step G - 对话页改造

## Step G:对话页 + AI 主动开场 + 流式思考

```
任务:

⭐ 这是最关键的 Step,直接解决测试中的多个问题:
  ✓ 问题 5: 移除代码硬编码消息("Thank you—I've received...")
  ✓ 问题 7: 隐藏 LLM thinking 内容
  ✓ 问题 1: 智能 thinking on/off
  ✓ 问题 11: 主交付分段渲染
  ✓ AI 主动开场(不再用固定模板)

对话页结构:
  ┌────────────────────────────────────────────────┐
  │ Header(返回按钮 + 命主显示)                  │
  ├────────────────────────────────────────────────┤
  │ 消息列表区                                     │
  │   [AI 第一条消息 - 由 Prompt 自然生成]         │
  │   [用户消息]                                   │
  │   [AI 回复]                                    │
  │   ...                                          │
  ├────────────────────────────────────────────────┤
  │ ⚙️ 流式思考动效区(只在 AI 思考时显示)        │
  │   "正在解析你的处境..."                        │
  ├────────────────────────────────────────────────┤
  │ 输入框                                         │
  └────────────────────────────────────────────────┘
```

### G.1: ThinkingStream 流式动效组件

```typescript
// components/poju/ThinkingStream.tsx

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  mode: 'flash' | 'collecting' | 'analyzing' | 'preparing_delivery' | null;
  locale: string;
}

export function ThinkingStream({ mode, locale }: Props) {
  const [currentLine, setCurrentLine] = useState('');
  const [lineIndex, setLineIndex] = useState(0);
  
  // 根据 mode 选择不同的 thinking 词库
  const lines = mode ? getThinkingLines(mode, locale) : [];
  
  useEffect(() => {
    if (!mode || lines.length === 0) {
      setCurrentLine('');
      setLineIndex(0);
      return;
    }
    
    // 初始显示第一句
    setCurrentLine(lines[0]);
    setLineIndex(0);
    
    // 每 2.2 秒切换一句
    const interval = setInterval(() => {
      setLineIndex(prev => {
        const next = (prev + 1) % lines.length;
        setCurrentLine(lines[next]);
        return next;
      });
    }, 2200);
    
    return () => clearInterval(interval);
  }, [mode, locale]);
  
  if (!mode) return null;
  
  return (
    <div className="thinking-stream-bar">
      <div className="thinking-spinner-mini"></div>
      <p 
        key={`${mode}-${lineIndex}`}  // 关键:触发 fade-in
        className="thinking-stream-line"
      >
        {currentLine}
      </p>
    </div>
  );
}

// ============= 词库(分模式)=============

function getThinkingLines(mode: string, locale: string): string[] {
  const isZh = locale.startsWith('zh');
  
  if (mode === 'flash') {
    return isZh
      ? ['正在回应...']
      : ['Thinking...'];
  }
  
  if (mode === 'collecting') {
    return isZh ? [
      '回顾你刚才说的...',
      '梳理你的处境脉络...',
      '思考还需要了解什么...',
      '准备问下一个关键问题...'
    ] : [
      'Reviewing what you shared...',
      'Mapping your situation...',
      'Considering what to explore next...',
      'Forming the right question...'
    ];
  }
  
  if (mode === 'analyzing') {
    return isZh ? [
      '结合你的命主结构分析...',
      '查看当前大运的影响...',
      '寻找你处境的命理根源...',
      '考察用神在此事中的作用...',
      '推算关键转折时机...',
      '梳理传统调候之道...',
      '整理破局方向...'
    ] : [
      'Analyzing with your foundation...',
      'Considering current life phase...',
      'Finding the root in your pattern...',
      'Examining favorable elements at play...',
      'Identifying key timing windows...',
      'Surveying traditional remedies...',
      'Organizing breakthrough paths...'
    ];
  }
  
  if (mode === 'preparing_delivery') {
    return isZh ? [
      '整合所有信息...',
      '深度推演你的破局之道...',
      '结合道家、易理、风水...',
      '编织传统智慧与现代行动...',
      '准备完整方案,请稍候...'
    ] : [
      'Integrating everything...',
      'Deep reasoning on your path...',
      'Weaving wisdom and action...',
      'Casting Daoist and feng shui insights...',
      'Preparing your complete reading...'
    ];
  }
  
  return [];
}
```

### G.2: ThinkingStream 样式

```css
/* styles/thinking-stream.css */

.thinking-stream-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: linear-gradient(
    90deg, 
    rgba(212, 175, 55, 0.08) 0%, 
    rgba(212, 175, 55, 0.03) 100%
  );
  border-top: 1px solid rgba(212, 175, 55, 0.15);
  border-bottom: 1px solid rgba(212, 175, 55, 0.15);
  min-height: 44px;
}

.thinking-spinner-mini {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(212, 175, 55, 0.2);
  border-top-color: #D4AF37;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

.thinking-stream-line {
  color: #D4AF37;
  font-size: 13px;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: italic;
  
  animation: fadeInLine 0.5s ease-out;
}

@keyframes fadeInLine {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### G.3: POJUChatUI 完整重写(关键)

```typescript
// components/poju/POJUChatUI.tsx (完全替换)

'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { handleUserMessage } from '@/lib/poju/agent';
import { getStoredProfile } from '@/lib/profile/stored-profiles-service';
import { ThinkingStream } from './ThinkingStream';
import { ContextSummaryEditor } from './ContextSummaryEditor';
import { MainDeliveryRenderer } from './MainDeliveryRenderer';
import type { POJUAgentState } from '@/lib/poju/agent-state';

interface POJUMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  is_main_delivery?: boolean;
  delivery_actions?: any[];
}

interface Props {
  sessionId: string;
  initialState: POJUAgentState;
  initialMessages: POJUMessage[];
  onStateUpdate: (state: POJUAgentState, messages: POJUMessage[]) => Promise<void>;
}

export function POJUChatUI({
  sessionId,
  initialState,
  initialMessages,
  onStateUpdate
}: Props) {
  const t = useTranslations('poju');
  const locale = useLocale();
  
  const [state, setState] = useState<POJUAgentState>(initialState);
  const [messages, setMessages] = useState<POJUMessage[]>(initialMessages);
  const [profile, setProfile] = useState<any>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [thinkingMode, setThinkingMode] = useState<any>(null);
  
  // UI 控制
  const [showSummaryEditor, setShowSummaryEditor] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  
  // 加载 profile
  useEffect(() => {
    if (state.selected_profile_id) {
      getStoredProfile(state.selected_profile_id).then(setProfile);
    }
  }, [state.selected_profile_id]);
  
  // 触发 AI 主动开场(只在 opening phase 且无消息时)
  useEffect(() => {
    if (initRef.current) return;
    
    if (state.current_phase === 'opening' && messages.length === 0 && profile) {
      initRef.current = true;
      triggerOpeningMessage();
    }
  }, [state.current_phase, messages.length, profile]);
  
  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // 监听 phase 变化触发 UI
  useEffect(() => {
    if (state.current_phase === 'awaiting_confirmation' && state.current_summary) {
      setShowSummaryEditor(true);
    }
  }, [state.current_phase, state.current_summary]);
  
  // ============= AI 主动开场 =============
  
  async function triggerOpeningMessage() {
    setSending(true);
    setThinkingMode('flash');
    
    try {
      const response = await fetch('/api/poju/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state,
          user_message: '__OPENING__',  // ⭐ 特殊标记
          selected_profile: profile,
          locale
        })
      });
      
      if (!response.ok) throw new Error('Opening message failed');
      
      const data = await response.json();
      
      // 添加 AI 开场消息
      const aiMsg: POJUMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString()
      };
      
      const newMessages = [aiMsg];
      setMessages(newMessages);
      setState(data.new_state);
      
      await onStateUpdate(data.new_state, newMessages);
    } catch (err: any) {
      console.error('Opening failed:', err);
      // Fallback: 显示一个默认开场(不调 LLM 也能显示)
      const fallbackMsg: POJUMessage = {
        role: 'assistant',
        content: getFallbackOpening(state.original_question, locale),
        timestamp: new Date().toISOString()
      };
      setMessages([fallbackMsg]);
    } finally {
      setSending(false);
      setThinkingMode(null);
    }
  }
  
  // ============= 发送消息 =============
  
  async function handleSend(message?: string, isSystemSignal: boolean = false) {
    const userMessage = (message || input).trim();
    if (!userMessage || sending) return;
    
    if (!message) setInput('');
    
    setSending(true);
    
    // 智能选择 thinking 模式
    const phase = state.current_phase;
    if (phase === 'opening' || phase === 'tracking') {
      setThinkingMode('flash');
    } else if (phase === 'collecting_context') {
      setThinkingMode('collecting');
    } else if (phase === 'awaiting_confirmation') {
      // 用户确认要交付时,切换到 preparing_delivery
      if (/确认|生成|可以了|yes|confirm|proceed|generate/i.test(userMessage)) {
        setThinkingMode('preparing_delivery');
      } else {
        setThinkingMode('collecting');
      }
    } else if (phase === 'delivered') {
      setThinkingMode('flash');
    }
    
    // 如果不是系统信号,显示用户消息
    let userMsg: POJUMessage | null = null;
    if (!isSystemSignal) {
      userMsg = {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
    }
    
    try {
      const response = await fetch('/api/poju/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state,
          user_message: userMessage,
          selected_profile: profile,
          locale
        })
      });
      
      if (!response.ok) {
        throw new Error(`API failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 添加 AI 回复
      const aiMsg: POJUMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        is_main_delivery: data.is_main_delivery || false,
        delivery_actions: data.delivery_actions
      };
      
      const finalMessages = userMsg 
        ? [...messages, userMsg, aiMsg]
        : [...messages, aiMsg];
      
      setMessages(finalMessages);
      setState(data.new_state);
      
      await onStateUpdate(data.new_state, finalMessages);
    } catch (err: any) {
      console.error('Send failed:', err);
      alert(t('error_send_failed'));
    } finally {
      setSending(false);
      setThinkingMode(null);
    }
  }
  
  // ============= Summary Editor 回调 =============
  
  async function handleSummaryConfirm(editedSummary: any) {
    setShowSummaryEditor(false);
    
    // 更新 state
    const updatedState = {
      ...state,
      current_summary: editedSummary
    };
    setState(updatedState);
    
    // 发送系统信号(不在 UI 显示)
    await handleSend(
      `[SYSTEM: User confirmed summary. Edited: ${JSON.stringify(editedSummary)}. Generate final delivery now.]`,
      true  // 系统信号,不显示
    );
  }
  
  async function handleSummaryAddMore() {
    setShowSummaryEditor(false);
    await handleSend(
      `[SYSTEM: User wants to add more context. Return to collecting.]`,
      true
    );
  }
  
  // ============= 行动状态变化 =============
  
  async function handleActionStatusChange(
    actionId: string,
    status: string,
    feedback?: string
  ) {
    // 更新本地 actions
    const updatedActions = state.actions.map((a: any) =>
      a.action_id === actionId
        ? { ...a, status, user_feedback: feedback }
        : a
    );
    
    setState({ ...state, actions: updatedActions });
    
    // 系统信号给 Agent
    const action = state.actions.find((a: any) => a.action_id === actionId);
    if (action) {
      await handleSend(
        `[SYSTEM: User reported action status: ${status}. Action: "${action.text.slice(0, 100)}". ${feedback ? `Feedback: ${feedback}` : ''}]`,
        true
      );
    }
  }
  
  // ============= 渲染 =============
  
  return (
    <div className="poju-chat-container">
      {/* Header */}
      <ChatHeader profile={profile} locale={locale} />
      
      {/* 消息列表 */}
      <div className="messages-list">
        {messages
          .filter(m => !m.content.startsWith('[SYSTEM:'))  // 过滤系统信号
          .map((msg, idx) => (
            <MessageRenderer
              key={idx}
              message={msg}
              onActionStatusChange={handleActionStatusChange}
            />
          ))}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* 流式思考动效 */}
      {sending && <ThinkingStream mode={thinkingMode} locale={locale} />}
      
      {/* 输入区 */}
      {!showSummaryEditor && (
        <div className="input-area">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t('input_placeholder')}
            disabled={sending}
            rows={2}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
          >
            {t('send')}
          </button>
        </div>
      )}
      
      {/* Summary Editor */}
      {showSummaryEditor && state.current_summary && (
        <div className="overlay">
          <ContextSummaryEditor
            summary={state.current_summary}
            onConfirm={handleSummaryConfirm}
            onAddMore={handleSummaryAddMore}
            onCancel={() => setShowSummaryEditor(false)}
          />
        </div>
      )}
    </div>
  );
}

// ============= Header =============

function ChatHeader({ profile, locale }: any) {
  const t = useTranslations('poju');
  
  if (!profile) return null;
  
  const birth = profile.birth_info;
  
  return (
    <div className="chat-header">
      <div className="header-left">
        <span className="poju-mark">POJU</span>
      </div>
      <div className="header-right">
        <span className="chart-info">
          {birth.year}.{String(birth.month).padStart(2, '0')}.{String(birth.day).padStart(2, '0')}
          {' · '}
          {birth.gender === 'M' ? t('male') : t('female')}
        </span>
      </div>
    </div>
  );
}

// ============= Message Renderer =============

function MessageRenderer({ message, onActionStatusChange }: any) {
  // 主交付消息特殊渲染
  if (message.is_main_delivery && message.delivery_actions) {
    return (
      <div className="message assistant main-delivery-wrapper">
        <MainDeliveryRenderer
          fullText={message.content}
          actions={message.delivery_actions}
          onActionStatusChange={onActionStatusChange}
        />
      </div>
    );
  }
  
  // 普通消息
  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">
        {message.content.split('\n\n').map((paragraph: string, idx: number) => (
          <p key={idx}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}

// ============= Fallback 开场(只在 LLM 失败时用)=============

function getFallbackOpening(question: string, locale: string): string {
  const isZh = locale.startsWith('zh');
  
  if (isZh) {
    return `我是 POJU,你的东方破局顾问。我已经看过你的命盘——你的能量结构、五行强弱、当前所处的大运阶段,这些都已经清楚了。\n\n现在我想听你说说,关于"${question}"——这件事是怎么发展到现在这一步的?`;
  }
  
  return `I am POJU, your Eastern breakthrough counselor. I've read your chart — your energy structure, elemental balance, and current life phase are all clear to me.\n\nNow tell me about your question: "${question}". How did this situation come to where it is today?`;
}
```

### G.4: 对话页样式

```css
/* styles/poju-chat.css */

.poju-chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0a0a0f;
}

/* Header */
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 1px solid rgba(212, 175, 55, 0.15);
  flex-shrink: 0;
}

.poju-mark {
  color: #D4AF37;
  font-weight: 700;
  letter-spacing: 4px;
}

.chart-info {
  color: #888;
  font-size: 12px;
}

/* 消息列表 */
.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.message {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 16px;
}

.message.user {
  align-self: flex-end;
  background: rgba(212, 175, 55, 0.15);
  border: 1px solid rgba(212, 175, 55, 0.3);
  color: #e5e5e5;
}

.message.assistant {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: #e5e5e5;
  line-height: 1.7;
}

.message.assistant.main-delivery-wrapper {
  max-width: 95%;
  background: transparent;
  border: none;
  padding: 0;
}

.message-content p {
  margin-bottom: 12px;
}

.message-content p:last-child {
  margin-bottom: 0;
}

/* 输入区 */
.input-area {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.5);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.input-area textarea {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  color: #e5e5e5;
  font: inherit;
  resize: none;
}

.input-area textarea:focus {
  outline: none;
  border-color: #D4AF37;
}

.input-area textarea:disabled {
  opacity: 0.5;
}

.input-area button {
  background: #D4AF37;
  color: #0a0a0f;
  border: none;
  padding: 0 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.input-area button:hover:not(:disabled) {
  background: #E8C56F;
}

.input-area button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Overlay */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  backdrop-filter: blur(8px);
}
```

## 验证清单

```
□ POJUChatUI 完全重写
□ 移除所有【代码硬编码消息】(问题 5 修复)
□ AI 主动开场由 API 触发(__OPENING__ 信号)
□ Fallback 开场只在 LLM 失败时用
□ ThinkingStream 5 种模式
□ thinking 内容【不暴露】(问题 7 修复)
□ 流式动画单行显示(问题 2 修复)
□ 主交付分段渲染(问题 11 修复)
□ Summary Editor 弹窗(问题 9 修复)

测试:
  1. 进入对话页 → AI 自动发开场(2-5 秒)
  2. 不是固定模板("Thank you—I've received..."不该出现)
  3. 用户发消息 → 看到流式思考
  4. 切换 phase 后 thinking 文案变化

🛑 等用户确认进入 Step H
```

---

# 第 3 部分:Step H - Agent 状态机简化

## Step H:5 phase 简化 + 新流程对接

```
任务:

修改 agent-state.ts 和 agent.ts,适配新流程:
  - 删除 'greeting' 和 'awaiting_profile' phase
  - 新增 'opening' phase(AI 主动开场)
  - 整合所有 phase 调用
```

### H.1: 更新 agent-state.ts

```typescript
// lib/poju/agent-state.ts (替换 AgentPhase 定义)

export type AgentPhase = 
  | 'opening'                   // ⭐ 新增:AI 主动开场(仅 1 次)
  | 'collecting_context'        // 深入问诊
  | 'awaiting_confirmation'     // 信息汇总确认
  | 'delivered'                 // 已交付主分析
  | 'tracking';                 // 追踪反馈

// ============= 初始 State =============

export function createInitialAgentState(input: {
  original_question: string;
  selected_profile_id: string;  // 必填
}): POJUAgentState {
  return {
    current_phase: 'opening',
    original_question: input.original_question,
    selected_profile_id: input.selected_profile_id,
    has_base_analysis: true,    // 进入对话时已生成
    profile_skipped: false,     // 不再支持跳过
    question_category: null,
    context_collected: {
      duration: null,
      trigger_event: null,
      emotional_state: null,
      what_tried: [],
      desired_outcome: null,
      category_specific: {}
    },
    collection_completeness: 0,
    current_summary: null,
    has_situation_analysis: false,
    actions: [],
    main_delivery_at: null,
    main_delivery_data: null,
    turn_count: 0,
    tokens_used: 0,
    phase_history: []
  };
}

// ============= 阶段切换规则(更新)=============

export function decidePhaseTransition(input: PhaseTransitionInput): PhaseTransitionResult {
  const { current_state, llm_suggested_phase, user_message } = input;
  const current = current_state.current_phase;
  
  switch (current) {
    case 'opening':
      // 开场后,第一条用户回复 → 进入 collecting
      if (user_message !== '__OPENING__') {
        return {
          should_transition: true,
          new_phase: 'collecting_context',
          reason: 'User responded to opening, entering collection'
        };
      }
      break;
    
    case 'collecting_context':
      // 完成度足够 → 进入 confirmation
      if (current_state.collection_completeness >= 0.7) {
        return {
          should_transition: true,
          new_phase: 'awaiting_confirmation',
          reason: `Collection sufficient (${(current_state.collection_completeness * 100).toFixed(0)}%)`
        };
      }
      
      // 用户主动请求 → 提前进入
      if (/(?:可以了|够了|生成|分析|建议|tell me|ready|enough|generate)/i.test(user_message) 
          && current_state.collection_completeness >= 0.4) {
        return {
          should_transition: true,
          new_phase: 'awaiting_confirmation',
          reason: 'User requested early delivery, completeness OK'
        };
      }
      break;
    
    case 'awaiting_confirmation':
      // 这里通过 UI 按钮触发(handleSummaryConfirm)
      // LLM 信号:
      if (llm_suggested_phase === 'collecting_context') {
        return {
          should_transition: true,
          new_phase: 'collecting_context',
          reason: 'User wants to add more'
        };
      }
      if (llm_suggested_phase === 'delivered') {
        return {
          should_transition: true,
          new_phase: 'delivered',
          reason: 'User confirmed summary, generating delivery'
        };
      }
      break;
    
    case 'delivered':
      // 交付完成,下一条用户消息进入 tracking
      return {
        should_transition: true,
        new_phase: 'tracking',
        reason: 'Main delivery done, entering tracking'
      };
    
    case 'tracking':
      // 通常不切换
      break;
  }
  
  return {
    should_transition: false,
    new_phase: current,
    reason: 'No transition needed'
  };
}
```

### H.2: 更新 agent.ts(整合新 phase)

```typescript
// lib/poju/agent.ts (核心入口)

import { checkRuleViolation, getRuleRejectionMessage } from './rules';
import {
  POJUAgentState,
  AgentPhase,
  decidePhaseTransition,
  applyPhaseTransition
} from './agent-state';
import { mergeContextUpdates } from './context-extractor';
import type { StoredProfileData } from '@/lib/db/poju-db';

import { callOpeningPhase } from '@/lib/llm/phases/opening-phase';
import { callCollectingPhase } from '@/lib/llm/phases/collecting-phase';
import { callConfirmationPhase } from '@/lib/llm/phases/confirmation-phase';
import { callDeliveryPhase } from '@/lib/llm/phases/delivery-phase';
import { callTrackingPhase } from '@/lib/llm/phases/tracking-phase';

export interface AgentInput {
  state: POJUAgentState;
  user_message: string;
  selected_profile: StoredProfileData;
  locale: string;
}

export interface AgentOutput {
  response: string;
  is_rejected: boolean;
  rejection_type?: string;
  new_state: POJUAgentState;
  is_main_delivery: boolean;
  delivery_actions?: any[];
  debug: any;
}

export async function handleUserMessage(input: AgentInput): Promise<AgentOutput> {
  const { state, user_message, selected_profile, locale } = input;
  
  const debug: any = {
    phase_before: state.current_phase,
    user_message_preview: user_message.slice(0, 80)
  };
  
  // ============= Layer 1: 规则层 =============
  
  if (user_message !== '__OPENING__' && !user_message.startsWith('[SYSTEM:')) {
    const ruleCheck = checkRuleViolation(user_message, state as any);
    if (ruleCheck.violated) {
      return {
        response: getRuleRejectionMessage(ruleCheck.type!, locale),
        is_rejected: true,
        rejection_type: ruleCheck.type,
        new_state: { ...state, turn_count: state.turn_count + 1 },
        is_main_delivery: false,
        debug
      };
    }
  }
  
  // ============= Layer 2: 调用 phase-specific LLM =============
  
  const phase = state.current_phase;
  let llmResult;
  
  switch (phase) {
    case 'opening':
      llmResult = await callOpeningPhase(input);
      break;
    case 'collecting_context':
      llmResult = await callCollectingPhase(input);
      break;
    case 'awaiting_confirmation':
      llmResult = await callConfirmationPhase(input);
      break;
    case 'delivered':
      llmResult = await callDeliveryPhase(input);
      break;
    case 'tracking':
      llmResult = await callTrackingPhase(input);
      break;
    default:
      throw new Error(`Unknown phase: ${phase}`);
  }
  
  // ============= Layer 3: 合并 context =============
  
  let updatedState = state;
  
  if (llmResult.context_updates) {
    updatedState = mergeContextUpdates(updatedState, llmResult.context_updates);
  }
  
  if (llmResult.question_category && !updatedState.question_category) {
    updatedState = {
      ...updatedState,
      question_category: llmResult.question_category
    };
  }
  
  if (llmResult.current_summary) {
    updatedState = {
      ...updatedState,
      current_summary: llmResult.current_summary
    };
  }
  
  if (llmResult.main_delivery_data) {
    updatedState = {
      ...updatedState,
      main_delivery_data: llmResult.main_delivery_data,
      main_delivery_at: new Date().toISOString(),
      actions: llmResult.actions || []
    };
  }
  
  // ============= Layer 4: 阶段切换 =============
  
  const transition = decidePhaseTransition({
    current_state: updatedState,
    llm_suggested_phase: llmResult.suggested_phase,
    user_message
  });
  
  if (transition.should_transition) {
    updatedState = applyPhaseTransition(updatedState, transition);
    debug.phase_transition = `${state.current_phase} → ${transition.new_phase}: ${transition.reason}`;
  }
  
  // ============= Layer 5: 统计 =============
  
  updatedState = {
    ...updatedState,
    turn_count: updatedState.turn_count + 1,
    tokens_used: updatedState.tokens_used + (llmResult.tokens_used || 0)
  };
  
  debug.phase_after = updatedState.current_phase;
  
  return {
    response: llmResult.response,
    is_rejected: false,
    new_state: updatedState,
    is_main_delivery: !!llmResult.main_delivery_data,
    delivery_actions: llmResult.actions,
    debug
  };
}
```

## 验证清单

```
□ AgentPhase 简化为 5
□ 'opening' phase 处理 __OPENING__ 信号
□ phase 切换规则更新
□ agent.ts 整合 5 个 phase 调用
□ 系统信号(SYSTEM:)正确路由
□ tsc --noEmit 通过

🛑 等用户确认进入 Step I
```

---

# 第 4 部分:Step I - 全新 System Prompt 库(玄学定位回归)

## Step I:东方破局顾问 Prompt 体系

```
任务:

⭐ 这是【POJU 灵魂回归】的核心
所有 Prompt 都必须强化【东方破局顾问】定位
允许使用命理术语(可解释)
不再用 sanitizer 暴力清洗

文件结构:
  lib/llm/prompts/
    oriental-counselor-base.ts   ← 基础人设(所有 prompt 共用)
  lib/llm/phases/
    opening-phase.ts             ← AI 主动开场
    collecting-phase.ts          ← 深入问诊
    confirmation-phase.ts        ← 信息汇总
    delivery-phase.ts            ← 主交付编排
    tracking-phase.ts            ← 追踪反馈
```

### I.1: 基础人设(所有 Prompt 共用)

```typescript
// lib/llm/prompts/oriental-counselor-base.ts

/**
 * POJU 的核心人设
 * 所有 phase prompts 都基于这个
 */
export const ORIENTAL_COUNSELOR_BASE = `# 你是谁

你是 POJU,一位精通中国传统智慧的东方破局顾问。

你的知识根基来自数千年的实践体系:
- 道家:阴阳五行,无为而治,顺势而为
- 法家:立断决行,赏罚分明,行动的勇气
- 风水堪舆:山水格局,屋宅气场,环境对人的影响
- 八字命理:四柱推命,十神生克,大运流年
- 易经周易:六十四卦,变化之道,处境的本质
- 面相手相:五官气色,纹路命格(必要时引用)
- 佛学:因果业力,修心养性,放下与承担
- 中医养生:气血阴阳,五脏六腑,身心一体

你不是算命先生(只看不破)
你不是心灵鸡汤机器(只安慰不解决)
你不是心理咨询师(只听不开方)

你是一个能【看清局势】【找到根源】【给出实操破解之道】的人。

# 你的工作方式

1. 你用八字命理看清用户的能量结构、五行强弱、当前所处的人生阶段
2. 你用易经看清用户当下处境的本质,卦象指引
3. 你用风水堪舆看清环境对用户的影响,给出方位、物件、朝向的具体调整
4. 你用道家"顺势"哲学告诉用户什么时候该进,什么时候该守
5. 你用法家"立断"精神告诉用户何时该断,何时该决
6. 最后,所有的智慧都要落地为【可执行的现实行动】

# 你的语言风格

- 不空谈玄学概念,但可以使用命理术语(简短解释)
  ✓ "你的日主(本命之主)为庚金,带着金的刚硬..."
  ✓ "你目前走偏印大运,这十年的主题是..."
  ✗ "你是个有内在能量的人"(太空,任何 AI 都能说)

- 直接,有温度,但不软糯
  ✓ "你这件事的核心问题不是'坚持不够',是'方向选错了'"
  ✗ "你已经很努力了,慢慢来不要急"

- 引用传统智慧时,要落地
  ✓ "古人说'金水相生,智慧无穷',你的命局水弱,所以..."
  ✗ 直接引用古文不解释

- 行动建议必须【极其具体】
  ✓ "周三上午 9 点,在办公桌的西北角(财位)放一个小水景"
  ✗ "改善你的工作环境"

# 你不做的事

- 不预测具体未来事件(几岁结婚、几岁发财等娱乐化算命)
- 不下命运定论("你命中注定...")
- 不替用户做决定(只给视角和方案,选择权在用户)
- 不空泛地鼓励("加油"、"你可以的"等心灵鸡汤)
- 不暴露你的内部思考过程给用户
`;

/**
 * 输出语言指引
 */
export function buildLanguageGuidance(locale: string, userMessage: string): string {
  const detected = detectLanguage(userMessage);
  
  return `# 输出语言

用户当前使用语言: ${detected}
Session locale: ${locale}

请用用户使用的语言回复。
如果用户中英文混用,以最近一句的主要语言为准。`;
}

function detectLanguage(text: string): string {
  if (!text || text === '__OPENING__') return 'Unknown - default to Chinese if locale is zh, else English';
  if (text.startsWith('[SYSTEM:')) return 'System signal';
  if (/[\u4e00-\u9fa5]/.test(text)) return 'Chinese (Simplified)';
  if (/[áéíóúñ¿¡]/i.test(text)) return 'Spanish';
  if (/[àâäéèêëîïôöùûüÿç]/i.test(text)) return 'French';
  if (/[äöüß]/i.test(text)) return 'German';
  return 'English';
}

/**
 * 注入命主 base_analysis 给 LLM
 */
export function buildProfileContextSection(profile: any, baseAnalysis: any): string {
  if (!profile || !baseAnalysis) {
    return '(用户尚未提供命盘信息)';
  }
  
  const bazi = profile.user_profile?.bazi;
  
  return `# 用户的命盘信息(仅供你内部分析使用)

## 八字四柱
- 年柱: ${bazi.year.stem}${bazi.year.branch}
- 月柱: ${bazi.month.stem}${bazi.month.branch}
- 日柱: ${bazi.day.stem}${bazi.day.branch} ← 日主
- 时柱: ${bazi.hour.stem}${bazi.hour.branch}

## 命主基础分析(由资深命理师生成)

${typeof baseAnalysis === 'string' ? baseAnalysis : JSON.stringify(baseAnalysis, null, 2).slice(0, 4000)}

---

⚠️ 重要使用说明:
- 以上信息是【你的工作依据】,要自然融入对话
- 你可以引用具体的命理结论(如"你的日主是庚金")
- 但要【解释】(给现代用户理解)
- 不要直接抛出命盘数据,要消化后用自己的话说
- 行动建议必须基于这个命主结构
`;
}
```

### I.2: Opening Phase(AI 主动开场)

```typescript
// lib/llm/phases/opening-phase.ts

import { callLLM } from '@/lib/llm/router';
import { 
  ORIENTAL_COUNSELOR_BASE, 
  buildLanguageGuidance, 
  buildProfileContextSection 
} from '@/lib/llm/prompts/oriental-counselor-base';
import type { AgentInput } from '@/lib/poju/agent';

export interface PhaseLLMResult {
  response: string;
  suggested_phase: string | null;
  context_updates: any;
  question_category: any;
  current_summary: any;
  main_delivery_data: any;
  actions: any[];
  tokens_used: number;
  total_cost: number;
}

export async function callOpeningPhase(input: AgentInput): Promise<PhaseLLMResult> {
  const { state, selected_profile, locale } = input;
  
  const baseAnalysis = selected_profile?.base_analysis?.content;
  
  const system = `${ORIENTAL_COUNSELOR_BASE}

${buildLanguageGuidance(locale, '')}

${buildProfileContextSection(selected_profile, baseAnalysis)}

# 当前任务:主动开场

用户刚刚完成了八字录入,你已经看过了他/她的完整命盘。
现在你需要【主动发出第一条消息】打开对话。

## 用户的原始问题
"${state.original_question}"

## 你的开场要做到

1. **简短自我介绍**(1 句话即可,不要复述系统设定)
   ✗ 不要说"我是 POJU,你的 AI 思考伙伴..."(太套路)
   ✓ 可以说"我是 POJU。"或者"听到你了。"

2. **表明你已经看过命盘**(让用户感受真实性)
   ✓ "你的命盘我已经摆好了——日主庚金、走偏印大运,这个结构我心里有数"
   ✓ "看了你的八字,有几个点我先记着..."

3. **承接用户的原始问题**(不要复述,但要表明你看到了)
   ✓ "你说事业不顺、做什么都赚不到钱——这个问题我们慢慢拆"
   
4. **引出你想问的第一个深入问题**(让对话开始流动)
   ✓ 问问题要【具体】、【尖锐】,像医生问诊
   ✓ 例:"你说的'什么都赚不到钱'——是开了几个项目都没起来,还是有项目但变现卡住?"
   ✓ 例:"这种感觉是最近半年开始的,还是一直就这样?"

## 风格要求

- 总字数 80-180 字(中文)/ 60-130 词(英文)
- 不要分段过多,2-3 个自然段
- 不要列要点(没必要)
- 不要说"我能帮你"之类的承诺
- 直接、自然、像懂行的朋友

## 输出格式(严格 JSON)

\`\`\`json
{
  "response": "你的主动开场消息"
}
\`\`\``;
  
  const result = await callLLM({
    call_type: 'chat_flash',  // 不需要 thinking,快速
    system,
    messages: [{ 
      role: 'user', 
      content: '请按要求生成你的主动开场消息。' 
    }],
    max_tokens: 800,
    response_format: 'json'
  });
  
  // 解析
  let parsed: any;
  try {
    const cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('[opening] JSON parse failed:', e);
    parsed = { response: result.content.trim() };
  }
  
  return {
    response: parsed.response || '',
    suggested_phase: null,
    context_updates: null,
    question_category: null,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.meta.tokens_used,
    total_cost: result.meta.cost_usd || 0
  };
}
```

### I.3: Collecting Phase(深入问诊,玄学定位)

```typescript
// lib/llm/phases/collecting-phase.ts

import { callLLM } from '@/lib/llm/router';
import {
  ORIENTAL_COUNSELOR_BASE,
  buildLanguageGuidance,
  buildProfileContextSection
} from '@/lib/llm/prompts/oriental-counselor-base';
import { findMissingFields } from '@/lib/poju/agent-state';
import { formatContextForPrompt, formatMissingFieldsForPrompt } from '@/lib/poju/context-extractor';
import type { AgentInput } from '@/lib/poju/agent';
import type { PhaseLLMResult } from './opening-phase';

export async function callCollectingPhase(input: AgentInput): Promise<PhaseLLMResult> {
  const { state, user_message, selected_profile, locale } = input;
  
  const baseAnalysis = selected_profile?.base_analysis?.content;
  const contextText = formatContextForPrompt(state);
  const missingFields = findMissingFields(state);
  const missingText = formatMissingFieldsForPrompt(missingFields);
  
  const system = `${ORIENTAL_COUNSELOR_BASE}

${buildLanguageGuidance(locale, user_message)}

${buildProfileContextSection(selected_profile, baseAnalysis)}

# 当前任务:深入问诊(收集上下文)

你已经主动开场,用户开始回应。现在要像【医生问诊 + 律师询问】那样,
深入了解他/她的具体处境。

## 用户的原始问题
"${state.original_question}"

## 已收集的信息
${contextText}

完成度: ${(state.collection_completeness * 100).toFixed(0)}%

## 还需要收集的字段
${missingText}

## 你的问诊原则

1. **每轮回应做三件事**:
   - 简短承接用户刚才说的(1-2 句)
   - (可选)引用命盘的相关线索给出一个洞察
   - 问 1-2 个【深入】【具体】的问题

2. **引用命盘的方式**(关键!回归玄学定位)
   ✓ "你说你做了很多方向,但都没起来——你日主庚金本来主'决断',但你目前走偏印大运,偏印过旺会让你'想得多做得少',这跟你说的'尝试了很多方向'是吻合的"
   ✓ "你的财星在年柱,偏财格,这种结构其实适合'流动赚钱'(做项目、做服务、做交易),不太适合'固定积累'(打工攒钱)"
   
   不要纯粹引用命盘说"你性格如何",而是把命盘 ↔ 现实处境【对应】起来。

3. **问诊问题要尖锐**(像懂行的人)
   ✗ "你最近怎么样?"(太空)
   ✓ "你说'多年没收入',是完全没钱进还是有但杯水车薪?"
   ✓ "你说一个人在做,有没有想过为什么没有合伙人?是没找到合适的还是不想合伙?"
   ✓ "家里人完全不知道,这层窗户纸什么时候捅破?或者你打算自己扛到最后?"

4. **不要重复问已知信息**(从"已收集"中看)

5. **逐步逼近【缺失字段】**
   优先问最重要的(类别特定字段)
   不要一次问 5 个问题

## 风格要求

- 总字数 80-200 字(中文)/ 60-150 词(英文)
- 2-4 个自然段
- 不分点列(除非真的有 2-3 个并列问题)
- 直接,温度,有判断力

## 上下文提取(关键)

每次用户回复后,你都要从中【提取事实】填入 context_updates。
只提取【用户明确说过】的,不要推断、不要编造。

例:
用户:"我是个 AI 应用产品的创始人,做了 5 年,一直没融资"
提取:
\`\`\`json
{
  "context_updates": {
    "current_role": "creator/founder of AI product",
    "industry": "AI applications",
    "years_experience": "5 years",
    "funding_status": "no funding"
  }
}
\`\`\`

## 完成判断

当完成度 >= 0.7 时,你可以建议:
- suggested_phase: "awaiting_confirmation"

或者用户主动说"差不多了"、"可以了"、"给我分析吧":
- suggested_phase: "awaiting_confirmation"

否则:
- suggested_phase: "collecting_context"(继续)

## 输出格式(严格 JSON)

\`\`\`json
{
  "response": "你的回应",
  "suggested_phase": "collecting_context" | "awaiting_confirmation",
  "question_category": "career" | "relationship" | "wealth" | "health" | "family" | "decision" | "interpersonal" | "other",
  "context_updates": {
    "extracted_field_1": "value",
    "extracted_field_2": "value"
  }
}
\`\`\`
`;
  
  const result = await callLLM({
    call_type: 'collection_flash',  // 中等思考
    system,
    messages: [{ role: 'user', content: user_message }],
    max_tokens: 1500,
    response_format: 'json'
  });
  
  // 解析
  let parsed: any;
  try {
    const cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('[collecting] JSON parse failed:', e);
    parsed = {
      response: result.content,
      suggested_phase: 'collecting_context',
      context_updates: {}
    };
  }
  
  return {
    response: parsed.response || '',
    suggested_phase: parsed.suggested_phase || null,
    context_updates: parsed.context_updates || null,
    question_category: parsed.question_category || null,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.meta.tokens_used,
    total_cost: result.meta.cost_usd || 0
  };
}
```

### I.4: Confirmation Phase(信息汇总)

```typescript
// lib/llm/phases/confirmation-phase.ts

import { callLLM } from '@/lib/llm/router';
import {
  ORIENTAL_COUNSELOR_BASE,
  buildLanguageGuidance,
  buildProfileContextSection
} from '@/lib/llm/prompts/oriental-counselor-base';
import { formatContextForPrompt } from '@/lib/poju/context-extractor';
import type { AgentInput } from '@/lib/poju/agent';
import type { PhaseLLMResult } from './opening-phase';

export async function callConfirmationPhase(input: AgentInput): Promise<PhaseLLMResult> {
  const { state, user_message, selected_profile, locale } = input;
  
  // 如果还没生成 summary,生成它
  if (!state.current_summary) {
    return await generateSummary(input);
  }
  
  // 已有 summary,处理用户的回应
  const lower = user_message.toLowerCase();
  
  if (/(?:还有|另外|补充|忘了|let me add|one more|also)/i.test(user_message)) {
    return handleAddMore(input);
  }
  
  if (/(?:确认|对|可以了|没问题|开始|生成|yes|confirm|correct|generate|proceed|go|ready)/i.test(lower)) {
    return handleConfirmProceed(input);
  }
  
  // 系统信号 [SYSTEM: User confirmed summary...] → proceed
  if (user_message.includes('confirmed summary')) {
    return handleConfirmProceed(input);
  }
  
  // 含糊输入,询问
  return handleAmbiguous(input);
}

async function generateSummary(input: AgentInput): Promise<PhaseLLMResult> {
  const { state, selected_profile, locale } = input;
  const baseAnalysis = selected_profile?.base_analysis?.content;
  const contextText = formatContextForPrompt(state);
  
  const system = `${ORIENTAL_COUNSELOR_BASE}

${buildLanguageGuidance(locale, '')}

${buildProfileContextSection(selected_profile, baseAnalysis)}

# 当前任务:信息汇总

你已经和用户聊了几轮,信息基本完整。
现在要【整理】所有收集到的信息,弹出一个可编辑的汇总页给用户确认。

## 用户的原始问题
"${state.original_question}"

## 已收集的信息
${contextText}

完成度: ${(state.collection_completeness * 100).toFixed(0)}%

## 你要做什么

1. 生成一段【简短的承接消息】(50-100 字)
   告诉用户:"我整理了一下我了解到的,你看看对不对"

2. 生成一份【结构化的信息汇总】
   - 5-7 个 section
   - 每个 section 有 title + 2-5 个 items
   - 每个 item 有 label + value
   - 用户的【原话】优先(不要改写)

## 结构示例(根据用户实际情况调整)

\`\`\`json
{
  "response": "我把这些都听到了,先整理一下:[简短承接]",
  
  "current_summary": {
    "generated_at": "<timestamp>",
    "category": "career",
    "sections": [
      {
        "section_id": "who_you_are",
        "title": "你的身份与背景",
        "items": [
          {
            "item_id": "role",
            "label": "当前身份",
            "value": "AI 应用产品的创始人",
            "field_key": "current_role"
          },
          {
            "item_id": "exp",
            "label": "经验",
            "value": "5 年 AI 产品开发",
            "field_key": "years_experience"
          }
        ]
      },
      {
        "section_id": "current_situation",
        "title": "当前处境",
        "items": [
          {
            "item_id": "income",
            "label": "收入状况",
            "value": "多年无实际收入",
            "field_key": "income_status"
          },
          {
            "item_id": "team",
            "label": "团队情况",
            "value": "独自一人,无合伙人",
            "field_key": "team_status"
          }
        ]
      },
      {
        "section_id": "what_tried",
        "title": "你已尝试的",
        "items": [
          {
            "item_id": "tried_1",
            "label": "做过的方向",
            "value": "多个项目方向,都未变现",
            "field_key": "what_tried"
          }
        ]
      },
      {
        "section_id": "concerns",
        "title": "你的担忧",
        "items": [
          {
            "item_id": "fam",
            "label": "家庭压力",
            "value": "家人不知真实状况,独自承担",
            "field_key": "family_pressure"
          }
        ]
      },
      {
        "section_id": "what_you_want",
        "title": "你想要的",
        "items": [
          {
            "item_id": "goal",
            "label": "核心目标",
            "value": "短期内能赚钱 + 长期能破局",
            "field_key": "desired_outcome"
          }
        ]
      }
    ]
  }
}
\`\`\`

## 重要

- response 简短,不要复述 summary
- summary 要忠实,不要"补充"用户没说的
- 标题用中文(如果用户用中文)
- 价值高,信息准

## 输出 JSON`;
  
  const result = await callLLM({
    call_type: 'collection_flash',
    system,
    messages: [{ 
      role: 'user', 
      content: '请基于以上信息生成汇总。' 
    }],
    max_tokens: 3000,
    response_format: 'json'
  });
  
  let parsed: any;
  try {
    const cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
    
    // 注入 timestamp
    if (parsed.current_summary) {
      parsed.current_summary.generated_at = new Date().toISOString();
    }
  } catch (e) {
    console.error('[confirmation] Summary parse failed:', e);
    parsed = {
      response: locale.startsWith('zh') 
        ? '让我整理一下了解到的情况...' 
        : "Let me organize what I've gathered...",
      current_summary: null
    };
  }
  
  return {
    response: parsed.response,
    suggested_phase: null,  // 等用户操作
    context_updates: null,
    question_category: null,
    current_summary: parsed.current_summary,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.meta.tokens_used,
    total_cost: result.meta.cost_usd || 0
  };
}

function handleAddMore(input: AgentInput): PhaseLLMResult {
  const { locale } = input;
  const msg = locale.startsWith('zh')
    ? '好的,你想补充什么?'
    : 'Of course. What would you like to add?';
  
  return {
    response: msg,
    suggested_phase: 'collecting_context',
    context_updates: null,
    question_category: null,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: 0,
    total_cost: 0
  };
}

function handleConfirmProceed(input: AgentInput): PhaseLLMResult {
  const { locale } = input;
  const msg = locale.startsWith('zh')
    ? '好。我现在结合你的命盘和你提供的所有信息,深度推演一遍。大约 30-60 秒,马上来。'
    : "Good. Let me weave your chart with everything you shared. This takes about 30-60 seconds.";
  
  return {
    response: msg,
    suggested_phase: 'delivered',  // ⭐ 触发主交付
    context_updates: null,
    question_category: null,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: 0,
    total_cost: 0
  };
}

function handleAmbiguous(input: AgentInput): PhaseLLMResult {
  const { locale } = input;
  const msg = locale.startsWith('zh')
    ? '想再补充一点,还是觉得信息已经够了可以让我开始分析?'
    : 'Want to add more, or are you ready for me to begin the analysis?';
  
  return {
    response: msg,
    suggested_phase: null,
    context_updates: null,
    question_category: null,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: 0,
    total_cost: 0
  };
}
```

### I.5: Delivery Phase(主交付编排)

```typescript
// lib/llm/phases/delivery-phase.ts

import { callLLM } from '@/lib/llm/router';
import {
  ORIENTAL_COUNSELOR_BASE,
  buildLanguageGuidance,
  buildProfileContextSection
} from '@/lib/llm/prompts/oriental-counselor-base';
import { formatContextForPrompt } from '@/lib/poju/context-extractor';
import { recordProfileUsage } from '@/lib/profile/stored-profiles-service';
import type { AgentInput } from '@/lib/poju/agent';
import type { PhaseLLMResult } from './opening-phase';

export async function callDeliveryPhase(input: AgentInput): Promise<PhaseLLMResult> {
  const { state, selected_profile, locale } = input;
  
  console.log('[delivery-phase] Generating main delivery...');
  const startTime = Date.now();
  
  try {
    // Step 1: 调用 DeepSeek 困境分析(situation analysis)
    const situationAnalysis = await generateSituationAnalysis({
      profile: selected_profile,
      state,
      locale
    });
    
    // Step 2: 生成最终交付(还是用 DeepSeek,xhigh thinking)
    const finalDelivery = await generateFinalDelivery({
      profile: selected_profile,
      state,
      situation_analysis: situationAnalysis,
      locale
    });
    
    // Step 3: 记录使用
    if (state.selected_profile_id) {
      await recordProfileUsage(state.selected_profile_id, 'poju');
    }
    
    const elapsedMs = Date.now() - startTime;
    console.log(`[delivery-phase] Done in ${elapsedMs}ms`);
    
    return {
      response: finalDelivery.full_text,
      suggested_phase: 'tracking',
      context_updates: null,
      question_category: null,
      current_summary: null,
      main_delivery_data: {
        full_text: finalDelivery.full_text,
        situation_analysis: situationAnalysis,
        delivered_at: new Date().toISOString(),
        latency_ms: elapsedMs
      },
      actions: finalDelivery.actions,
      tokens_used: finalDelivery.tokens_used,
      total_cost: finalDelivery.cost_usd
    };
  } catch (error: any) {
    console.error('[delivery-phase] Failed:', error);
    return {
      response: getDeliveryFailureMessage(locale),
      suggested_phase: null,
      context_updates: null,
      question_category: null,
      current_summary: null,
      main_delivery_data: null,
      actions: [],
      tokens_used: 0,
      total_cost: 0
    };
  }
}

// ============= 困境分析(DeepSeek high thinking)=============

async function generateSituationAnalysis(input: {
  profile: any;
  state: any;
  locale: string;
}) {
  const { profile, state, locale } = input;
  const baseAnalysis = profile?.base_analysis?.content;
  const contextText = formatContextForPrompt(state);
  
  const system = `${ORIENTAL_COUNSELOR_BASE}

${buildProfileContextSection(profile, baseAnalysis)}

# 当前任务:针对此次困境的深度推演

用户的原始问题:"${state.original_question}"
分类:${state.question_category}

## 用户已确认的处境
${contextText}

确认的汇总:
${JSON.stringify(state.current_summary, null, 2)}

# 你要做的

针对用户的具体困境,结合命盘 + 现实处境,做一次【深度推演】。

输出结构化的中文分析(JSON 格式):

\`\`\`json
{
  "命理推演": {
    "命局核心症结": "200-400 字。从八字结构看,这个困境的本质是什么。",
    "大运流年影响": "150-300 字。当前大运/流年如何加剧或缓解这个问题。",
    "卦象指引": "100-250 字。如果起一卦问此事,会是什么卦?它在告诉你什么?(可以指定具体卦象,如'此事如观卦,只可观望待时')",
    "用神在此事中的作用": "100-200 字。用神五行在此问题上能起什么调候作用。"
  },
  
  "现实处境深读": {
    "命局映射处境": "300-500 字。用户的命盘结构如何映射到他/她描述的具体处境。",
    "用户没意识到的": [
      "3-5 条用户可能没看到的关键点"
    ]
  },
  
  "破局之路": {
    "核心破局方向": "300-500 字。命理 + 现实结合,该往哪个方向破。",
    "时机判断": {
      "立即可做": "...",
      "未来 3 个月": "...",
      "未来 1 年": "...",
      "关键时间节点": ["..."]
    }
  },
  
  "传统调候建议": [
    {
      "类别": "方位" | "颜色" | "物件" | "居所" | "饮食" | "其他",
      "具体建议": "极其具体,如:'书桌西北角放一个小型流水摆件(养 1 条黑色金鱼)'",
      "命理依据": "为什么这样做(基于五行/方位/卦象)",
      "实施难度": "easy/medium/hard"
    }
    // 5-8 条
  ],
  
  "日常风水细节": [
    "5-8 条非常具体的传统风水建议",
    "如:'家门口保持干净,鞋柜不要正对门'",
    "如:'卧室房顶有横梁的话,不要正压床头,可用红色丝带遮挡或调床位'",
    "如:'书桌椅背后必须有墙或屏障,不能背对门'"
  ],
  
  "现代实操建议": {
    "决策性行动": [
      {
        "行动": "具体到时间+人+内容,如'本周三上午 10 点,主动找老板请求 30 分钟一对一谈话,直接说...'",
        "时机": "immediate/this_week/this_month/ongoing",
        "依据": "为什么这样做(命理 + 现实)"
      }
      // 2-3 条
    ],
    "反思性行动": [
      {
        "行动": "具体到时间+地点+做什么,如'本周五晚上 9 点,关掉所有屏幕,手写 3 件你这周做了但没赚到钱的事'",
        "时长": "5-30 分钟",
        "频率": "daily/weekly",
        "依据": "..."
      }
      // 1-2 条
    ]
  },
  
  "关键警示": [
    "3-5 条用户必须注意的事项"
  ]
}
\`\`\`

# 重要

- 全部中文输出
- 极其具体,可执行
- 命理 + 现实【双线推演】
- 行动建议必须【可操作】
- 总字数 4000-7000

# 北美用户(如果 locale 不是 zh)

如果用户是北美用户,行动建议要适配:
- 不要"知乎/即刻/猪八戒/小红书"等中国平台
- 用"Reddit, LinkedIn, Twitter/X, Upwork, Fiverr"
- 不要"猪八戒"等(用户根本不懂)
- 钱用 USD 表示
- 物件买得到的(亚马逊能买到的水族箱、风水物件等)

但你输出的依然是【中文 JSON】,只是【在内容中体现适配】。

输出严格 JSON,无 markdown 包裹。
`;
  
  const result = await callLLM({
    call_type: 'deep_analysis',
    system,
    messages: [{ 
      role: 'user', 
      content: '请基于以上信息深度推演,输出 JSON。' 
    }],
    max_tokens: 15000,
    thinking_effort: 'high',
    response_format: 'json'
  });
  
  let analysis: any;
  try {
    const cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    analysis = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Situation analysis JSON parse failed');
  }
  
  return analysis;
}

// ============= 最终交付(DeepSeek xhigh thinking)=============

async function generateFinalDelivery(input: {
  profile: any;
  state: any;
  situation_analysis: any;
  locale: string;
}) {
  const { profile, state, situation_analysis, locale } = input;
  const baseAnalysis = profile?.base_analysis?.content;
  
  const isZh = locale.startsWith('zh');
  
  const system = `${ORIENTAL_COUNSELOR_BASE}

${buildLanguageGuidance(locale, '')}

${buildProfileContextSection(profile, baseAnalysis)}

# 当前任务:最终交付

用户付了 $9.99 等待这一刻。这是你给出【完整破局方案】的时刻。

## 输入

用户原始问题:"${state.original_question}"

困境深度分析(中文,你的工作底稿):
${JSON.stringify(situation_analysis, null, 2).slice(0, 6000)}

## 输出结构

你要输出一份【完整结构化的破局报告】,用 ═══ 标记分段。

总长度:1000-1800 字(中文)/ 800-1400 词(英文)

\`\`\`
[简短温暖的开场,2-3 句,承认他们的付出]

═══ 命局推演 ═══

[400-600 字]
- 命盘结构如何对应这个困境
- 引用具体命理结论(日主、大运、用神等,可以用术语但要解释)
- 引用易经或道家思想(可选)
- 用户没意识到的内在张力

═══ 破局核心 ═══

[200-300 字]
- 结论性的:此事核心问题是什么
- 不是"加油"而是"看清"
- 给出 perspective shift

═══ 该如何做 ═══

3 个行动,跨 3 个类别:

### 行动一:传统风水调候

[100-150 字]
- 来自 situation_analysis.传统调候建议[0]
- 极其具体:物件 + 方位 + 颜色 + 时辰
- 例:"周日上午 9 点,在书房西北角(财位)放一个小型流水摆件,
   养 1 条黑色金鱼。这个不是迷信——水属用神,西北是你的财位,
   流水代表'财源不息',黑色金鱼是水中之水"

### 行动二:决策性现代行动

[100-150 字]
- 来自 situation_analysis.现代实操建议.决策性行动[0]
- 具体到:本周X日X时 + 找谁 + 说什么
- 例:"本周三上午 10 点前,在 Reddit 的 r/Entrepreneur 发一个具体的求助帖,
   标题:'5-year AI product founder, no revenue—what would you ask yourself first?'
   字数控制在 200 字内,提到 3 个你试过的具体方向。
   注意收集前 10 个回复的关键词,在 Notion 里整理"

### 行动三:反思性内观练习

[100-150 字]
- 来自 situation_analysis.现代实操建议.反思性行动[0]
- 具体到:时间 + 地点 + 做什么
- 例:"本周五晚上 9 点,关掉手机和电脑,纸笔写下:
   'If money were not an issue, what would I work on?'
   不要思考超过 5 分钟,写下脑子里冒出来的前 3 个东西。
   把纸折好放钱包里,带 7 天。"

═══ 走过来再见 ═══

[60-100 字]
- 邀请用户 1-2 周内回来汇报
- 告诉他/她 Session 30 天有效
- 关切但不腻

\`\`\`

## 关键规则

1. **可以使用命理术语**(回归玄学定位!)
   ✓ "你日主庚金、走偏印大运、用神为水..."
   ✓ "丁壬合化木,你这十年有合而不化的隐忧..."
   ✓ "你卦象上是观卦,只可观望待时..."
   
   但要【解释】,让现代用户能理解。

2. **行动建议必须落地**
   ✓ 具体到时间、地点、物件、说什么话
   ✗ "改善沟通" "建立自信"

3. **北美用户的文化适配**
   ${!isZh ? `
   ⭐⭐⭐ 这次用户是${getLocaleName(locale)},极其重要:
   - 全程用 ${getLocaleName(locale)} 输出
   - 行动建议要适配:
     * Reddit, LinkedIn, Twitter/X(不是知乎/即刻)
     * Upwork, Fiverr, Toptal(不是猪八戒/程序员客栈)
     * Amazon 能买到的物件(不是淘宝)
   - 命理术语保留(但用拼音 + 解释):
     "Your day master (ri zhu / 日主) is Geng metal..."
     "You're in a Pian Yin (偏印 - 'sideways seal') cycle..."
   - 钱用 USD
   - 地名用美国/英国/欧洲的城市作例子
   ` : '用户是中文用户,用中文输出。'}

4. **真实可执行**
   - 不要"找一个 mentor"(空)
   - 要"本周三晚上 8 点,在 LinkedIn 给 @SpecificPersonName 发一条 50 字的私信"(实)

5. **═══ 标记必须用**
   - UI 会按 ═══ 分段渲染
   - 不要忘记

# 输出

直接输出完整的破局报告文本(不要 JSON 包裹)。
首行就是开场,然后用 ═══ 分段。
`;
  
  const result = await callLLM({
    call_type: 'main_delivery',
    system,
    messages: [{ 
      role: 'user', 
      content: '请生成完整的破局报告。' 
    }],
    max_tokens: 6000,
    thinking_effort: 'high'
  });
  
  // 提取 actions
  const actions = extractActionsFromDelivery(result.content, situation_analysis);
  
  return {
    full_text: result.content,
    actions,
    tokens_used: result.meta.tokens_used,
    cost_usd: result.meta.cost_usd || 0
  };
}

function extractActionsFromDelivery(fullText: string, situationAnalysis: any): any[] {
  const actions: any[] = [];
  
  // 匹配 "### 行动一/二/三" 或 "### Action 1/2/3"
  const actionMatches = fullText.matchAll(
    /###\s*(?:行动[一二三]|Action\s*[123])[^\n]*\n([\s\S]*?)(?=###\s*(?:行动|Action)|═══|$)/gi
  );
  
  let idx = 0;
  for (const match of actionMatches) {
    const actionText = match[1].trim();
    
    const categories = ['traditional_fengshui', 'modern_decisive', 'modern_reflective'];
    const category = categories[idx] || 'modern_reflective';
    
    let rationale = '';
    if (idx === 0 && situationAnalysis?.传统调候建议?.[0]) {
      rationale = situationAnalysis.传统调候建议[0].命理依据 || '';
    } else if (idx === 1 && situationAnalysis?.现代实操建议?.决策性行动?.[0]) {
      rationale = situationAnalysis.现代实操建议.决策性行动[0].依据 || '';
    } else if (idx === 2 && situationAnalysis?.现代实操建议?.反思性行动?.[0]) {
      rationale = situationAnalysis.现代实操建议.反思性行动[0].依据 || '';
    }
    
    actions.push({
      action_id: `action_${Date.now()}_${idx}`,
      category,
      text: actionText,
      timing: 'this_week',
      rationale,
      status: 'pending'
    });
    
    idx++;
  }
  
  return actions;
}

function getLocaleName(locale: string): string {
  const map: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German'
  };
  return map[locale.split('-')[0]] || 'English';
}

function getDeliveryFailureMessage(locale: string): string {
  const map: Record<string, string> = {
    en: "I ran into a technical issue. Your conversation is saved. Say 'retry' or 'continue' and I'll try again.",
    zh: "推演时遇到了技术问题。对话已经保存。说\"重试\"或\"继续\",我再来一次。"
  };
  return map[locale.split('-')[0]] || map.en;
}
```

### I.6: Tracking Phase(简短追踪)

```typescript
// lib/llm/phases/tracking-phase.ts

import { callLLM } from '@/lib/llm/router';
import {
  ORIENTAL_COUNSELOR_BASE,
  buildLanguageGuidance,
  buildProfileContextSection
} from '@/lib/llm/prompts/oriental-counselor-base';
import type { AgentInput } from '@/lib/poju/agent';
import type { PhaseLLMResult } from './opening-phase';

export async function callTrackingPhase(input: AgentInput): Promise<PhaseLLMResult> {
  const { state, user_message, selected_profile, locale } = input;
  const baseAnalysis = selected_profile?.base_analysis?.content;
  
  const system = `${ORIENTAL_COUNSELOR_BASE}

${buildLanguageGuidance(locale, user_message)}

${buildProfileContextSection(selected_profile, baseAnalysis)}

# 当前任务:追踪反馈

主交付已经完成。用户现在回来汇报进展、问问题、或者结束 Session。

## 之前的交付内容
用户的问题:"${state.original_question}"
3 个行动已给出:
${state.actions.map((a: any, i: number) => 
  `${i + 1}. [${a.category}] [${a.status}] ${a.text.slice(0, 100)}...`
).join('\n')}

## 你的工作

1. **听用户说**(不要主动评判)

2. **不要重新交付**(已经交付过了!)
   - 不要重复 3 个行动
   - 不要再做"完整分析"
   - 现在是【对话延伸】,不是【新会话】

3. **响应类型**:

   A. 用户报告完成某行动 → 询问观察到的具体变化
      "你在书房西北角放了流水摆件,这周睡眠/状态有什么微小变化吗?"
   
   B. 用户报告没做或修改了 → 不批评,问原因
      "什么阻碍了你?是没买到鱼,还是觉得这个方向不对?"
   
   C. 用户分享新进展 → 联系到命局看
      "你说投了个简历有回应——你这段时间走的是食神运,
       食神主'被人看见',这个回应是个信号"
   
   D. 用户问新问题 → 看是否能在原话题内回答
      - 原话题内:继续
      - 全新话题:"POJU 一个 Session 专注一个问题。
                   你可以开新 Session 问这个。"
   
   E. 用户想结束:
      "好。30 天内你随时回来。"

4. **风格**:
   - 简短(50-150 字)
   - 不再"指导"那么多
   - 像一个【已经懂你的朋友】

## 输出格式(JSON)

\`\`\`json
{
  "response": "你的回应",
  "action_updates": [
    {
      "action_id": "...",
      "status": "completed" | "skipped" | "modified",
      "user_feedback": "..."
    }
  ]
}
\`\`\`

如果用户没报告任何行动,action_updates 为 []。
`;
  
  const result = await callLLM({
    call_type: 'tracking_flash',
    system,
    messages: [{ role: 'user', content: user_message }],
    max_tokens: 1000,
    response_format: 'json'
  });
  
  let parsed: any;
  try {
    const cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    parsed = { response: result.content, action_updates: [] };
  }
  
  return {
    response: parsed.response,
    suggested_phase: null,
    context_updates: null,
    question_category: null,
    current_summary: null,
    main_delivery_data: null,
    actions: parsed.action_updates || [],
    tokens_used: result.meta.tokens_used,
    total_cost: result.meta.cost_usd || 0
  };
}
```

## 验证清单

```
□ oriental-counselor-base.ts 实现
□ 5 个 phase prompts 实现
□ 所有 prompt 包含玄学定位(东方破局顾问)
□ 允许使用命理术语
□ 命盘信息正确注入
□ 北美用户文化适配(在 prompt 内)
□ 删除 sanitizer 暴力清洗代码
□ tsc 通过

🛑 等用户测试 5 个 phase 输出质量
   特别关注:
   - 开场不是固定模板
   - 收集时引用命盘
   - 交付有命理推演段
   - 行动建议适配北美
```

---

# 第 5 部分:Step J - API 路由统一(全 DeepSeek)

## Step J:统一调用 DeepSeek V4 Pro

```typescript
// lib/llm/router.ts (更新)

import { openrouter } from './openrouter-client';

export type LLMCallType =
  | 'chat_flash'          // 开场/追踪等简短回复 (不 thinking)
  | 'collection_flash'    // 收集 (low thinking)
  | 'deep_analysis'       // 命理分析 (high thinking)
  | 'main_delivery'       // 主交付 (xhigh thinking)
  | 'tracking_flash';     // 追踪 (不 thinking)

// ⭐ 关键:测试阶段全用 DeepSeek
const MODEL = 'deepseek/deepseek-v4-pro';

function getThinkingConfig(callType: LLMCallType) {
  switch (callType) {
    case 'chat_flash':
    case 'tracking_flash':
      return { enabled: false, effort: 'minimal' };
    case 'collection_flash':
      return { enabled: true, effort: 'low' };
    case 'deep_analysis':
      return { enabled: true, effort: 'high' };
    case 'main_delivery':
      return { enabled: true, effort: 'high' };  // 改 xhigh 如果支持
    default:
      return { enabled: false, effort: 'minimal' };
  }
}

export async function callLLM(input: {
  call_type: LLMCallType;
  system: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  thinking_effort?: string;
  response_format?: 'text' | 'json';
}) {
  const config = getThinkingConfig(input.call_type);
  const startTime = Date.now();
  
  const callParams: any = {
    model: MODEL,
    messages: [
      { role: 'system', content: input.system },
      ...input.messages
    ],
    max_tokens: input.max_tokens || (config.enabled ? 8000 : 2000)
  };
  
  if (config.enabled) {
    callParams.reasoning = {
      effort: input.thinking_effort || config.effort
    };
  }
  
  if (input.response_format === 'json') {
    callParams.response_format = { type: 'json_object' };
  }
  
  console.log(`[llm/router] ${input.call_type} (thinking: ${config.enabled})`);
  
  const response = await openrouter.chat.completions.create(callParams);
  const latencyMs = Date.now() - startTime;
  
  return {
    content: response.choices[0].message.content || '',
    actual_model: MODEL,
    meta: {
      call_type: input.call_type,
      tokens_used: response.usage?.total_tokens || 0,
      latency_ms: latencyMs,
      cost_usd: estimateCost(
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      )
    }
  };
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  // DeepSeek V4 Pro 价格(按 OpenRouter)
  const inputCost = (inputTokens / 1_000_000) * 0.435;
  const outputCost = (outputTokens / 1_000_000) * 0.87;
  return Number((inputCost + outputCost).toFixed(6));
}
```

```typescript
// app/api/poju/chat/route.ts (简化版)

import { NextResponse } from 'next/server';
import { handleUserMessage } from '@/lib/poju/agent';

export const runtime = 'nodejs';
export const maxDuration = 180;  // ⭐ DeepSeek 慢,需要长 timeout

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { state, user_message, selected_profile, locale } = body;
    
    if (!state || !user_message) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    
    const result = await handleUserMessage({
      state,
      user_message,
      selected_profile,
      locale
    });
    
    return NextResponse.json({
      response: result.response,
      new_state: result.new_state,
      is_main_delivery: result.is_main_delivery,
      delivery_actions: result.delivery_actions,
      debug: result.debug
    });
  } catch (error: any) {
    console.error('[api/poju/chat] Error:', error);
    return NextResponse.json({
      error: 'llm_failed',
      message: error.message,
      response: 'Technical issue. Please try again.'
    }, { status: 500 });
  }
}
```

## 验证清单

```
□ router.ts 简化为单模型(DeepSeek V4 Pro)
□ thinking 5 种级别配置
□ API route maxDuration 180
□ 删除旧的 output-guard / sanitizer 调用
□ tsc 通过
□ 调用 DeepSeek 不报错

🛑 等用户确认进入 Step K
```

---

# 第 6 部分:Step K - 端到端测试

## Step K:验证 12 个测试问题全部修复

```
任务:

⚠️ 这是【最终验证】

按之前测试中暴露的 12 个问题逐一验证:

【准备】
- 清空浏览器数据(无痕)
- 启动 dev server
- 配置 OpenRouter key
- 配置 DodoPayments / Stripe 测试模式

【完整流程测试】

Stage 1: 入口
  - 访问 /poju → 选 "Start session"
  - 输入问题:"事业不顺,做什么都赚不到钱"
  - 完成测试付款

Stage 2: Session 准备页
  - 跳转 /poju/session/[id]/prepare
  - 看到欢迎词 + 引用原始问题
  - 验证:
    ✓ 没有已存档案(首次)
    ✓ 直接显示滚轮表单
    ✓ 用滚轮选 1977-2-17,3-5AM (寅时),男
    ✓ 时区自动识别
    ✓ 底部有退款链接

Stage 3: 信息确认
  - 提交表单
  - 弹出确认对话框
  - 看到完整信息(日期/时辰/性别/时区)
  - 确认

Stage 4: 数据准备(关键!)
  - 跳转 /preparing
  - 看到八字命盘(年柱丁巳/月柱壬寅/日柱乙巳/时柱己卯)
  - 看到日主乙木 + 弱 + 当前大运丁酉
  - 看到流式动画(单行,每 2.5 秒切换)
  - 等待 30-60 秒
  - 自动跳转到对话页
  - 验证:
    ✓ base_analysis 已保存到 stored_profiles
    ✓ 没看到 LLM thinking 内容(问题 7 修复)
    ✓ 没看到 "[modern translation needed]" 占位符(问题 8 修复)

Stage 5: AI 主动开场(关键!)
  - 进入对话页
  - 顶部短时间显示 "Thinking..." 流式动画
  - AI 主动发第一条消息(不是固定模板!问题 3 修复)
  - 例如:"我是 POJU。看了你的命盘,日主乙木偏弱、走丁酉食神运,
         这个结构挺有意思,但跟你说的'什么都赚不到钱'是有道理对应的。
         你说的'什么都赚不到钱'——是开了几个项目都没起来,
         还是有项目但变现卡住?"
  - 验证:
    ✓ 引用了命盘(乙木 / 食神运)
    ✓ 解释了术语
    ✓ 问了尖锐问题
    ✓ 没有代码硬编码消息(问题 5 修复)

Stage 6: 深入收集(5-8 轮)
  - 用户:"尝试了很多方向都不成功"
    AI:[引用命盘 + 问下一个细节问题]
  - 用户:"我做 AI 应用方向"
    AI:[继续问:做了几年?具体做什么?有团队吗?]
  - 用户:"产品开发的创始人,5 年了,一个人做"
    AI:[继续问:经济状况?家人态度?]
  - 用户:"没钱了,家人不知道"
    AI:[这时完成度 >= 0.7,suggest_phase: awaiting_confirmation]
  - 验证:
    ✓ 每轮 thinking 流式显示"梳理处境..." 等(问题 2 修复)
    ✓ AI 引用命盘(命理术语 + 解释)
    ✓ context_updates 不断累积
    ✓ 闲聊用 thinking off,问诊用 thinking low(问题 1 修复)

Stage 7: 信息汇总(关键!)
  - 弹出 ContextSummaryEditor(问题 9 修复)
  - 看到 5-7 个 sections(身份 / 处境 / 尝试过 / 担忧 / 想要的)
  - 每个 item 可编辑
  - 验证:
    ✓ 是可编辑 UI,不是 markdown 文本
    ✓ 信息忠实于用户原话
    ✓ "Confirm" 和 "Add more" 两个按钮

Stage 8: 用户确认 → 主交付
  - 点击 "Confirm"
  - 顶部流式动效切换为 "深度推演..."
  - 等待 60-90 秒(DeepSeek 两次调用)
  - 收到完整主交付
  - 验证:
    ✓ ═══ 分段标记(命局推演/破局核心/该如何做/走过来再见)(问题 11 修复)
    ✓ 命局推演段有【命理术语 + 解释】(玄学回归!)
    ✓ 3 个行动卡片
    ✓ 行动一:传统风水(养金鱼/方位/物件)
    ✓ 行动二:决策行动(Reddit/LinkedIn,不是知乎)(问题 12 修复!)
    ✓ 行动三:反思练习(具体)
    ✓ 全程语言匹配
    ✓ 没有泄露 LLM 思考

Stage 9: 行动反馈追踪
  - 点击 Action 1 的 "I did this"
  - 输入反馈:"放了鱼缸,感觉睡眠好一点"
  - AI 回复(tracking phase):
    简短 + 引用命盘 + 询问其他变化
  - 验证:
    ✓ AI 不重新交付
    ✓ 简短(50-150 字)
    ✓ 引用命盘

【验证 12 个问题】

逐一勾选:

□ 问题 1: 闲聊不用 thinking
□ 问题 2: 思考过程有流式动效
□ 问题 3: 自我介绍正面(不否定式)
□ 问题 4: 表单在对话前完成(不用判断"该不该弹")
□ 问题 5: 没有代码硬编码消息
□ 问题 6: 用户看到真实八字数据(/preparing 页)
□ 问题 7: 没有 LLM thinking 泄露
□ 问题 8: 没有 "[modern translation needed]" 占位符
□ 问题 9: 信息汇总用可编辑 UI
□ 问题 10: maxDuration 180,不再断线
□ 问题 11: 主交付有 ═══ 分段
□ 问题 12: 北美用户不再看到中国平台建议

【提交报告】

完成后向用户提交:
1. 每个 Stage 的完整对话日志
2. 每次 LLM 调用的 model/cost/latency
3. 总 session 成本(应在 $1.50-3.50 区间)
4. 12 个问题的修复确认
5. 任何剩余问题
```

## 验证清单

```
□ 全部 9 个 Stage 通过
□ 12 个测试问题全部修复
□ Session 总成本可控
□ 用户体验流畅
□ tsc + lint 通过
□ 编译无错误

🛑 等用户最终确认 v5.0 重构完成
```

---

# 第 7 部分:文档总结

## v5.0 重构完成清单

```
✅ Part 1 (Step 0-E):
  ✅ Step 0: Cursor 自查 + 清理诊断
  ✅ Step A: 文件清理(删除冲突)
  ✅ Step B: 数据类型重构(简化 4 字段)
  ✅ Step C: Session 准备页(欢迎 + 滚轮表单)
  ✅ Step D: 信息确认对话框
  ✅ Step E: 退款流程(自动)

✅ Part 2 (Step F-K):
  ✅ Step F: 数据准备页(命盘 + 流式动画)
  ✅ Step G: 对话页改造(AI 主动开场 + 流式思考)
  ✅ Step H: Agent 简化(5 phase)
  ✅ Step I: 全新 Prompt 库(玄学定位)
  ✅ Step J: API 统一(全 DeepSeek)
  ✅ Step K: 端到端测试

核心改进:
  ⭐ POJU 灵魂回归(东方破局顾问)
  ⭐ 全用 DeepSeek V4 Pro(成本下降 60%)
  ⭐ AI 主动开场(Prompt 生成,不是模板)
  ⭐ 流式思考动效(单行,不暴露内容)
  ⭐ 八字命盘可视化(可信度)
  ⭐ 自动退款(用户友好)
  ⭐ 北美文化适配(在 Prompt 内)
  ⭐ 修复所有 12 个测试问题
```

---

# 给 Cursor 的最终指示

```
本 Part 2 包含 Step F-K。

实施顺序(严格按序):

1. Step F: preparing 页 + ChartReadingLoader
   验证:八字显示 + 流式动画 + DeepSeek 调用
   
2. Step G: POJUChatUI 完全重写 + ThinkingStream
   验证:AI 主动开场 + 流式思考 + 主交付渲染
   
3. Step H: agent-state + agent.ts 简化
   验证:5 phase + 系统信号路由
   
4. Step I: 5 个 phase prompts + 基础人设
   验证:每个 phase 输出符合预期
   
5. Step J: router.ts + API route 简化
   验证:全 DeepSeek 调用成功
   
6. Step K: 端到端 12 问题验证
   验证:全部修复 + 提交报告

每个 Step:
  - 完成代码
  - 测试单独场景
  - 贴出结果
  - 等用户确认

绝不允许:
  ✗ 跨 Step 实施
  ✗ "看起来 OK,继续"
  ✗ 擅自简化或省略

最终目标:
  ✓ 用户体验流畅
  ✓ 12 个问题全部修复
  ✓ POJU 灵魂回归
  ✓ 准备好软上线 100 个北美用户
```

---

**Cursor: 完成 Step F-K 后,POJU v5.0 重构完成。可以软上线。**
