# POJU v5.0 · 重构指令文档 · Part 1

> ⚠️ **核心战略转向**: 之前的设计【过度去除】了 POJU 的玄学定位,导致输出像 ChatGPT。
> 本文档是【清理 + 重构】指令,让 POJU 回归本质。
>
> **POJU 本质**: 计算命理 + 给出可执行行动建议的【东方破局顾问】
> - 对外营销:弱化"算命"(过支付审核)
> - 对内 Prompt:回归玄学(灵魂)
>
> **本部分覆盖**:
> - 战略转向声明
> - Cursor 当前代码诊断 + 清理清单
> - Step A: 文件清理(删除冲突)
> - Step B: 数据类型重构
> - Step C: Session 准备页(欢迎 + 八字滚轮表单)
> - Step D: 信息确认对话框
> - Step E: 退款流程
>
> **下一部分(Part 2)**: Step F-K
>
> **核心原则**: 每个 Step 完成后【贴出输出 + 等用户确认】才能下一步

---

# ⚠️ Cursor 必读:三大重构原则

## 原则 1: 完全清理旧实现

```
之前的实施已经【乱了】,继续叠加只会更乱。
本文档要求:
  - 先删除冲突/冗余的旧代码
  - 再按新设计实施
  - 不允许"叠加"或"修修补补"

具体清理清单在 Step A,严格执行。
```

## 原则 2: POJU 灵魂回归

```
之前过度去除:
  ✗ "不暴露八字/五行/十神等术语"
  ✗ "用中性现代语言"
  ✗ "不要说'算命'"

实际结果:
  ✗ AI 输出像 ChatGPT
  ✗ 没有东方智慧的深度
  ✗ 行动建议缺乏命理依据

现在调整为:
  ✓ AI 可以使用命理术语,但要简短解释
     例:"你的日主(本命)为庚金,这意味着..."
  ✓ AI 应该自然引用道家/易经/古籍
  ✓ 行动建议必须有【命理根 + 现实落地】
  ✓ 不再用 sanitizer 暴力清洗术语

修改具体在 Step I (Part 2)
```

## 原则 3: 全 DeepSeek V4 Pro (测试阶段)

```
之前用 Flash + DeepSeek + Pro 三层。

测试阶段简化:
  ✓ 所有 LLM 调用都用 deepseek/deepseek-v4-pro
  ✓ 区分:thinking on/off
  ✓ 大幅简化代码逻辑

具体:
  call_type      | thinking | 用途
  greeting       | off      | 闲聊/快速回复
  collecting     | low      | 问诊式提问
  deep_analysis  | high     | 命主基础分析(永久缓存)
  situation      | high     | 困境分析
  delivery       | xhigh    | 最终交付

成本下降 60%,代码量减半。
```

---

# 第 1 部分:Step 0 - Cursor 自查 + 清理诊断

## Step 0:盘点 + 报告

```
任务:

1. 列出以下文件【是否存在】+ 当前状态:

   核心文件:
   □ lib/calculations/shunshi-adapter.ts (是 fallback 还是真接入)
   □ lib/profile/types.ts
   □ lib/profile/storage.ts
   □ lib/profile/stored-profiles-service.ts
   □ lib/db/poju-db.ts
   □ lib/crypto.ts
   □ lib/init.ts
   □ app/providers.tsx
   
   POJU 文件:
   □ lib/poju/types.ts
   □ lib/poju/agent.ts
   □ lib/poju/agent-state.ts
   □ lib/poju/rules.ts
   □ lib/poju/output-policy.ts
   □ lib/poju/output-guard.ts
   □ lib/poju/context-readiness.ts
   □ lib/poju/context-extractor.ts
   □ lib/poju/session-manager.ts
   
   LLM 文件:
   □ lib/llm/poju-llm.ts
   □ lib/llm/openrouter-client.ts
   □ lib/llm/router.ts
   □ lib/llm/poju-prompts.ts
   □ lib/llm/prompts/* (所有)
   □ lib/llm/deepseek/* (所有)
   □ lib/llm/pro/* (所有)
   □ lib/llm/phases/* (所有)
   □ lib/llm/deep-analysis-service.ts
   □ lib/llm/main-delivery-service.ts
   □ lib/llm/output-validator.ts
   □ lib/llm/thinking-support.ts
   
   API 路由:
   □ app/api/poju/chat/route.ts
   □ app/api/profile/calculate/route.ts
   □ app/api/payments/create/route.ts
   □ app/api/payments/verify/route.ts
   □ app/api/payments/refund/route.ts (新)
   
   组件:
   □ components/poju/POJUChatUI.tsx
   □ components/poju/QuestionDialog.tsx
   □ components/poju/MessageBubble.tsx
   □ components/poju/MainDeliveryRenderer.tsx
   □ components/poju/ContextSummaryEditor.tsx
   □ components/forms/BirthInfoForm.tsx
   □ components/profile/ProfileSelector.tsx
   
   页面:
   □ app/[locale]/(marketing)/poju/page.tsx
   □ app/[locale]/(marketing)/poju/payment-success/page.tsx
   □ app/[locale]/(marketing)/poju/session/[id]/page.tsx
   □ app/[locale]/(marketing)/poju/session/[id]/prepare/page.tsx (新)

2. 对每个存在的文件,贴出【行数】+【核心导出函数列表】

3. 报告:
   - 哪些文件【完全过时】(将删除)
   - 哪些文件【部分有用】(将重构)
   - 哪些文件【保留】(已对齐新设计)

4. 检查 OpenRouter 配置:
   □ .env.local 中是否有 OPENROUTER_API_KEY
   □ key 长度是否正确(应该 ~60+ 字符 sk-or-v1-...)
   □ 是否能成功调用 deepseek/deepseek-v4-pro

5. 检查支付配置:
   □ .env.local 中 DODO_API_KEY 是否存在
   □ Stripe 测试密钥是否配置

6. 检查 IndexedDB schema:
   □ 当前 db version 是几?
   □ stored_profiles 表是否存在?
   □ poju_sessions 表是否存在?

完成后提交报告,等用户审视后再进入 Step A。
```

## 验证清单

```
□ 文件清单完整(每个文件 ✓ 或 ✗)
□ OpenRouter API 已配置(贴出测试调用结果)
□ 支付 API 已配置
□ DB schema 版本号正确

🛑 等用户审视报告后,确认进入 Step A
```

---

# 第 2 部分:Step A - 文件清理(删除冲突 + 重命名)

## Step A:统一清理冗余/冲突代码

```
任务:

⚠️ 这一步【只删除/重命名】,不写新代码

执行清单(按顺序):
```

### A.1: 删除冲突的【旧 POJU 实现】

```
要删除的文件(如果存在):

lib/poju/output-policy.ts        ← 旧的服务端门控
lib/poju/context-readiness.ts    ← 旧的就绪检测
lib/llm/poju-prompts.ts          ← 旧的 prompts(整合到新的 phase prompts)

理由:
  - output-policy 的正则不全(导致问题 1, 5, 8)
  - context-readiness 只看最后一条消息(导致问题 4)
  - 旧 prompts 跟新设计冲突

执行:
  git rm lib/poju/output-policy.ts
  git rm lib/poju/context-readiness.ts
  git rm lib/llm/poju-prompts.ts
  
  注意:删前 grep 一下,确认没有别处 import
```

### A.2: 保留但等待重构的文件

```
保留(将在 Step E-K 重构):

lib/poju/agent.ts               ← 重构入口
lib/poju/agent-state.ts         ← 简化(6 phase → 4 phase)
lib/poju/rules.ts               ← 微调(放宽)
lib/poju/types.ts               ← 增强
lib/poju/session-manager.ts     ← 微调
components/poju/POJUChatUI.tsx  ← 完全重写
components/poju/MessageBubble.tsx ← 保留
components/poju/MainDeliveryRenderer.tsx ← 保留
components/poju/ContextSummaryEditor.tsx ← 保留
```

### A.3: 新增的占位文件(创建空文件)

```
新建空文件(后续 Step 实施):

# Session 准备页相关
app/[locale]/(marketing)/poju/session/[id]/prepare/page.tsx
components/poju/SessionPreparation.tsx
components/poju/BirthInfoPicker.tsx
components/poju/BirthInfoConfirmDialog.tsx
components/poju/RefundDialog.tsx

# 数据准备(LLM 调用 loading)
components/poju/ChartReadingLoader.tsx

# 对话页流式思考动效
components/poju/ThinkingStream.tsx

# 退款 API
app/api/payments/refund/route.ts

# 新 prompt 库(玄学定位)
lib/llm/prompts/oriental-counselor-base.ts  ← 所有 prompt 的基础人设
lib/llm/phases/opening-phase.ts             ← AI 主动开场
```

### A.4: 重命名(避免歧义)

```
重命名(让命名更清晰):

旧名 → 新名:
  lib/profile/storage.ts (单一 profile)
    → lib/profile/active-profile.ts (重命名,功能不变)
  
  避免与 stored-profiles-service.ts 混淆
```

### A.5: 检查冲突依赖

```
执行:
  pnpm exec tsc --noEmit
  
应该出现【大量错误】(因为删除了文件,引用都断了)。
不要慌,这是正常的。
列出所有报错的 import 路径,准备在 Step B-K 修复。
```

## 验证清单

```
□ 删除的 3 个文件已删除
□ 创建的空文件已创建(7 个)
□ 重命名完成(active-profile.ts)
□ tsc 报错列表完整(待修复)
□ git status 清理后提交一次:
   git commit -m "chore: cleanup before POJU v5.0 refactor"

🛑 等用户确认进入 Step B
```

---

# 第 3 部分:Step B - 数据类型重构

## Step B:简化 + 调整类型定义

```
任务:

1. 简化出生信息(去掉经纬度)
2. 调整 AgentState(5 phase → 4 phase)
3. 调整 stored_profiles 命名规则
```

### B.1: 修改 lib/profile/types.ts

```typescript
// lib/profile/types.ts

// ============= 出生信息(简化版)=============

export interface BirthInfo {
  year: number;          // 1900-2030
  month: number;         // 1-12
  day: number;           // 1-31
  
  // 时辰段(2 小时一段)
  hour_period: HourPeriod;
  
  gender: 'M' | 'F';
  
  // 时区(用户的时区,用于算法默认经度)
  timezone: string;      // "America/New_York", "Asia/Shanghai" etc.
  
  // ⚠️ 不再需要 longitude/latitude/location_name
}

// 12 时辰段
export type HourPeriod = 
  | 'zi_early'   // 23:00-01:00 早子时
  | 'chou'       // 01:00-03:00 丑时
  | 'yin'        // 03:00-05:00 寅时
  | 'mao'        // 05:00-07:00 卯时
  | 'chen'       // 07:00-09:00 辰时
  | 'si'         // 09:00-11:00 巳时
  | 'wu'         // 11:00-13:00 午时
  | 'wei'        // 13:00-15:00 未时
  | 'shen'       // 15:00-17:00 申时
  | 'you'        // 17:00-19:00 酉时
  | 'xu'         // 19:00-21:00 戌时
  | 'hai';       // 21:00-23:00 亥时

// HourPeriod 元数据
export const HOUR_PERIOD_INFO: Record<HourPeriod, {
  range_start: number;  // 起始小时(0-23)
  range_end: number;    // 结束小时
  chinese_name: string;
  zh_label: string;
  en_label: string;
  // 用于 shunshi 计算时的代表小时
  representative_hour: number;
}> = {
  zi_early: { range_start: 23, range_end: 1, chinese_name: '早子时', zh_label: '23:00 - 01:00 (子时)', en_label: '11 PM - 1 AM (Zi)', representative_hour: 0 },
  chou:     { range_start: 1,  range_end: 3, chinese_name: '丑时',   zh_label: '01:00 - 03:00 (丑时)', en_label: '1 AM - 3 AM (Chou)', representative_hour: 2 },
  yin:      { range_start: 3,  range_end: 5, chinese_name: '寅时',   zh_label: '03:00 - 05:00 (寅时)', en_label: '3 AM - 5 AM (Yin)', representative_hour: 4 },
  mao:      { range_start: 5,  range_end: 7, chinese_name: '卯时',   zh_label: '05:00 - 07:00 (卯时)', en_label: '5 AM - 7 AM (Mao)', representative_hour: 6 },
  chen:     { range_start: 7,  range_end: 9, chinese_name: '辰时',   zh_label: '07:00 - 09:00 (辰时)', en_label: '7 AM - 9 AM (Chen)', representative_hour: 8 },
  si:       { range_start: 9,  range_end: 11, chinese_name: '巳时',  zh_label: '09:00 - 11:00 (巳时)', en_label: '9 AM - 11 AM (Si)', representative_hour: 10 },
  wu:       { range_start: 11, range_end: 13, chinese_name: '午时',  zh_label: '11:00 - 13:00 (午时)', en_label: '11 AM - 1 PM (Wu)', representative_hour: 12 },
  wei:      { range_start: 13, range_end: 15, chinese_name: '未时',  zh_label: '13:00 - 15:00 (未时)', en_label: '1 PM - 3 PM (Wei)', representative_hour: 14 },
  shen:     { range_start: 15, range_end: 17, chinese_name: '申时',  zh_label: '15:00 - 17:00 (申时)', en_label: '3 PM - 5 PM (Shen)', representative_hour: 16 },
  you:      { range_start: 17, range_end: 19, chinese_name: '酉时',  zh_label: '17:00 - 19:00 (酉时)', en_label: '5 PM - 7 PM (You)', representative_hour: 18 },
  xu:       { range_start: 19, range_end: 21, chinese_name: '戌时',  zh_label: '19:00 - 21:00 (戌时)', en_label: '7 PM - 9 PM (Xu)', representative_hour: 20 },
  hai:      { range_start: 21, range_end: 23, chinese_name: '亥时',  zh_label: '21:00 - 23:00 (亥时)', en_label: '9 PM - 11 PM (Hai)', representative_hour: 22 }
};

// ============= 八字结构(保留)=============

export interface UserProfile {
  birth_info: BirthInfo;
  
  bazi: BaziPillars;
  five_elements: FiveElements;
  yong_shen: YongShen;
  da_yun: DaYun;
  spirits?: any;
  relations?: any;
  
  diagnosis?: any;
  computed_at: string;
  deep_analysis?: DeepSeekAnalysis;
  deep_analysis_at?: string;
}

// (其他接口保持不变)

// ============= DeepSeek 分析(保留)=============

export interface DeepSeekAnalysis {
  命主基础?: any;
  性格画像?: any;
  人生主题?: any;
  大运全程?: any;
  当前大运详解?: any;
  传统调候建议?: any;
  深度洞察?: string[];
  
  _meta: {
    generated_at: string;
    model: string;
    tokens_used: number;
  };
}
```

### B.2: 修改 stored_profiles 命名规则

```typescript
// lib/profile/stored-profiles-service.ts (修改 createStoredProfile)

// 显示名生成规则:用出生日期数字
function generateDisplayName(birth: BirthInfo): string {
  const dateStr = `${birth.year}-${String(birth.month).padStart(2, '0')}-${String(birth.day).padStart(2, '0')}`;
  const periodInfo = HOUR_PERIOD_INFO[birth.hour_period];
  const periodShort = periodInfo.en_label.split(' ').slice(0, 3).join(' '); // "1 AM - 3 AM"
  const genderShort = birth.gender === 'M' ? 'M' : 'F';
  
  return `${dateStr} · ${periodShort} · ${genderShort}`;
  // 例: "1977-02-17 · 3 AM - 5 AM · M"
}

// 修改 createStoredProfile,自动生成 display_name
export async function createStoredProfile(input: {
  birth_info: BirthInfo;
}): Promise<{ profile_id: string; is_duplicate: boolean }> {
  
  const display_name = generateDisplayName(input.birth_info);
  
  // ... 其他逻辑不变,但不再需要传入 display_name 和 relationship
  
  // 移除 relationship 字段(用户不再选择关系)
}

// 注意:删除 updateStoredProfileMeta 函数
//      用户不能再修改 display_name(自动生成)
```

### B.3: 简化 AgentState(从 6 phase 减到 4)

```typescript
// lib/poju/agent-state.ts (修改)

// ⚠️ 删除 'awaiting_profile' 和 'greeting' phase
// 新流程:进入对话时已有 profile + base_analysis

export type AgentPhase = 
  | 'opening'                   // AI 主动开场(只 1 次)
  | 'collecting_context'        // 深入问诊
  | 'awaiting_confirmation'     // 信息汇总确认
  | 'delivered'                 // 已交付
  | 'tracking';                 // 追踪反馈

// 初始 state 改为 'opening'
export function createInitialAgentState(input: {
  original_question: string;
  selected_profile_id: string;  // ⚠️ 必填(进入对话时已选)
}): POJUAgentState {
  return {
    current_phase: 'opening',
    original_question: input.original_question,
    selected_profile_id: input.selected_profile_id,
    has_base_analysis: true,    // 进入对话已有
    profile_skipped: false,
    
    // ... 其他字段不变
  };
}
```

## 验证清单

```
□ BirthInfo 简化为 4 字段(去掉经纬度/地点)
□ HourPeriod 12 段定义完整
□ HOUR_PERIOD_INFO 元数据 5 语言可用
□ display_name 自动生成
□ AgentPhase 减为 5(其实是 5,我之前说错)
□ agent-state.ts 编译通过
□ tsc --noEmit 错误数减少

🛑 等用户确认进入 Step C
```

---

# 第 4 部分:Step C - Session 准备页(欢迎 + 八字滚轮表单)

## Step C:用户付款后进入的第一个页面

```
任务:

新路由:/poju/session/[id]/prepare

整体布局:
  顶部:固定欢迎词(5 语言)
  中部:
    - 如果有保存的八字 → 显示八字列表 + "添加新人"
    - 如果没有 → 直接显示填写表单
  底部:"我不想分享 → 退款" 链接(始终可见)
```

### C.1: 安装滚轮库

```
执行:
  pnpm add react-mobile-picker
  
确认 package.json 中加入了。
```

### C.2: 主页面 prepare/page.tsx

```typescript
// app/[locale]/(marketing)/poju/session/[id]/prepare/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { listStoredProfiles, type StoredProfileSummary } from '@/lib/profile/stored-profiles-service';
import { SessionPreparation } from '@/components/poju/SessionPreparation';
import { loadPOJUSession } from '@/lib/poju/session-manager';

export default function PreparePage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  
  const sessionId = params.id as string;
  
  const [session, setSession] = useState<any>(null);
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, [sessionId]);
  
  async function loadData() {
    try {
      const sessionData = await loadPOJUSession(sessionId);
      if (!sessionData) {
        router.push('/poju');
        return;
      }
      
      // 如果已经选了 profile,直接跳转到数据准备页
      if (sessionData.selected_profile_id) {
        router.replace(`/${locale}/poju/session/${sessionId}/preparing`);
        return;
      }
      
      const profileList = await listStoredProfiles();
      
      setSession(sessionData);
      setProfiles(profileList);
    } catch (err: any) {
      console.error('Load failed:', err);
      router.push('/poju');
    } finally {
      setLoading(false);
    }
  }
  
  function handleProfileSelected(profileId: string) {
    // 跳转到数据准备页(Step F 中创建)
    router.push(`/${locale}/poju/session/${sessionId}/preparing?profile=${profileId}`);
  }
  
  function handleRefund() {
    router.push(`/${locale}/poju/session/${sessionId}/refund`);
  }
  
  if (loading) {
    return <div className="loading-fullscreen">Loading...</div>;
  }
  
  if (!session) return null;
  
  return (
    <SessionPreparation
      sessionId={sessionId}
      originalQuestion={session.original_question}
      existingProfiles={profiles}
      onProfileSelected={handleProfileSelected}
      onRefund={handleRefund}
      locale={locale}
    />
  );
}
```

### C.3: SessionPreparation 主组件

```typescript
// components/poju/SessionPreparation.tsx

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BirthInfoPicker } from './BirthInfoPicker';
import { BirthInfoConfirmDialog } from './BirthInfoConfirmDialog';
import { createStoredProfile } from '@/lib/profile/stored-profiles-service';
import type { StoredProfileSummary } from '@/lib/profile/stored-profiles-service';
import type { BirthInfo } from '@/lib/profile/types';

interface Props {
  sessionId: string;
  originalQuestion: string;
  existingProfiles: StoredProfileSummary[];
  onProfileSelected: (profileId: string) => void;
  onRefund: () => void;
  locale: string;
}

export function SessionPreparation({
  sessionId,
  originalQuestion,
  existingProfiles,
  onProfileSelected,
  onRefund,
  locale
}: Props) {
  const t = useTranslations('session_prep');
  
  // 状态
  const [mode, setMode] = useState<'list' | 'new'>(
    existingProfiles.length > 0 ? 'list' : 'new'
  );
  
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [pendingBirthInfo, setPendingBirthInfo] = useState<BirthInfo | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // ============= 处理选择已有 =============
  
  function handleSelectExisting(profileId: string, summary: StoredProfileSummary) {
    setSelectedProfileId(profileId);
    setShowConfirm(true);
  }
  
  // ============= 处理填写新的 =============
  
  function handleBirthInfoSubmit(info: BirthInfo) {
    setPendingBirthInfo(info);
    setShowConfirm(true);
  }
  
  // ============= 确认对话框 confirm =============
  
  async function handleConfirmAndContinue() {
    setShowConfirm(false);
    
    // 已有 profile → 直接进入
    if (selectedProfileId) {
      onProfileSelected(selectedProfileId);
      return;
    }
    
    // 新填写 → 创建 profile
    if (pendingBirthInfo) {
      setCreating(true);
      try {
        const result = await createStoredProfile({
          birth_info: pendingBirthInfo
        });
        onProfileSelected(result.profile_id);
      } catch (err: any) {
        console.error('Create profile failed:', err);
        alert(t('error_create_profile'));
        setCreating(false);
      }
    }
  }
  
  function handleConfirmCancel() {
    setShowConfirm(false);
    setSelectedProfileId(null);
    setPendingBirthInfo(null);
  }
  
  return (
    <div className="session-prep-container">
      {/* 欢迎词区 */}
      <WelcomeSection locale={locale} originalQuestion={originalQuestion} />
      
      {/* 主区域 */}
      <div className="prep-main">
        {mode === 'list' && existingProfiles.length > 0 && (
          <ProfileListView
            profiles={existingProfiles}
            onSelect={handleSelectExisting}
            onAddNew={() => setMode('new')}
          />
        )}
        
        {mode === 'new' && (
          <BirthInfoPicker
            onSubmit={handleBirthInfoSubmit}
            onCancel={existingProfiles.length > 0 ? () => setMode('list') : undefined}
            locale={locale}
          />
        )}
      </div>
      
      {/* 底部退款链接 */}
      <div className="refund-link-section">
        <button onClick={onRefund} className="refund-link">
          {t('refund_link')}
        </button>
      </div>
      
      {/* 确认对话框 */}
      {showConfirm && (
        <BirthInfoConfirmDialog
          birthInfo={
            pendingBirthInfo
              ? pendingBirthInfo
              : null
          }
          existingProfile={
            selectedProfileId
              ? existingProfiles.find(p => p.profile_id === selectedProfileId) || null
              : null
          }
          onConfirm={handleConfirmAndContinue}
          onCancel={handleConfirmCancel}
          processing={creating}
        />
      )}
    </div>
  );
}

// ============= 欢迎词区(固定 5 语言)=============

function WelcomeSection({ locale, originalQuestion }: { locale: string; originalQuestion: string }) {
  const welcomeText = getWelcomeText(locale);
  
  return (
    <div className="welcome-section">
      <div className="poju-logo">POJU</div>
      <p className="welcome-text">{welcomeText}</p>
      
      <div className="your-question">
        <span className="label">{getQuestionLabel(locale)}</span>
        <p className="question-text">"{originalQuestion}"</p>
      </div>
    </div>
  );
}

function getWelcomeText(locale: string): string {
  const map: Record<string, string> = {
    en: `Welcome to POJU. POJU is your AI thinking partner for breaking through life's specific obstacles — with concrete, actionable wisdom from Eastern traditions of bazi, I-Ching, and feng shui. To prepare your reading, I need your foundational energy data below.`,
    zh: `欢迎来到 POJU。POJU 是你的 AI 破局顾问,基于八字命理、易经周易、风水堪舆等东方智慧,帮你针对具体困境给出可落地的行动方案。开始前,请提供你的基础能量数据。`,
    es: `Bienvenido a POJU. POJU es tu compañero de pensamiento AI para superar obstáculos específicos de la vida, con sabiduría concreta y accionable de las tradiciones orientales del bazi, I Ching y feng shui. Para preparar tu lectura, necesito tus datos energéticos fundamentales.`,
    fr: `Bienvenue chez POJU. POJU est votre partenaire de réflexion IA pour surmonter les obstacles spécifiques de la vie — avec une sagesse concrète et actionnable issue des traditions orientales du bazi, du I-Ching et du feng shui.`,
    de: `Willkommen bei POJU. POJU ist Ihr KI-Denkpartner zum Überwinden konkreter Lebenshindernisse — mit konkreter, umsetzbarer Weisheit aus östlichen Traditionen wie Bazi, I-Ging und Feng Shui.`
  };
  return map[locale.split('-')[0]] || map.en;
}

function getQuestionLabel(locale: string): string {
  const map: Record<string, string> = {
    en: 'Your question for this session:',
    zh: '你这次会话的问题:',
    es: 'Tu pregunta para esta sesión:',
    fr: 'Votre question pour cette session :',
    de: 'Ihre Frage für diese Sitzung:'
  };
  return map[locale.split('-')[0]] || map.en;
}

// ============= Profile 列表视图 =============

function ProfileListView({ 
  profiles, 
  onSelect, 
  onAddNew 
}: { 
  profiles: StoredProfileSummary[];
  onSelect: (id: string, summary: StoredProfileSummary) => void;
  onAddNew: () => void;
}) {
  const t = useTranslations('session_prep');
  
  return (
    <div className="profile-list-view">
      <h2>{t('list_title')}</h2>
      <p>{t('list_description')}</p>
      
      <div className="profiles-grid">
        {profiles.map(p => (
          <button 
            key={p.profile_id} 
            className="profile-card-button"
            onClick={() => onSelect(p.profile_id, p)}
          >
            <div className="display-name">{p.display_name}</div>
            <div className="card-meta">
              <span>{p.gender === 'M' ? t('male') : t('female')}</span>
              {p.has_base_analysis && <span className="ready-badge">{t('ready')}</span>}
            </div>
            <div className="usage-stats">
              {p.used_in_products.poju > 0 && <span>POJU {p.used_in_products.poju}×</span>}
              {p.used_in_products.glyph > 0 && <span>Glyph {p.used_in_products.glyph}×</span>}
              {p.used_in_products.syncro > 0 && <span>Syncro {p.used_in_products.syncro}×</span>}
            </div>
          </button>
        ))}
        
        <button className="add-new-card-button" onClick={onAddNew}>
          <span className="plus-icon">+</span>
          <span>{t('add_new_person')}</span>
        </button>
      </div>
    </div>
  );
}
```

### C.4: BirthInfoPicker 滚轮表单

```typescript
// components/poju/BirthInfoPicker.tsx

'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Picker from 'react-mobile-picker';
import { HOUR_PERIOD_INFO, type HourPeriod, type BirthInfo } from '@/lib/profile/types';

interface Props {
  onSubmit: (info: BirthInfo) => void;
  onCancel?: () => void;
  locale: string;
}

export function BirthInfoPicker({ onSubmit, onCancel, locale }: Props) {
  const t = useTranslations('birth_picker');
  
  // 滚轮值
  const [year, setYear] = useState(1990);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [hourPeriod, setHourPeriod] = useState<HourPeriod>('wu'); // 默认午时
  const [gender, setGender] = useState<'M' | 'F'>('M');
  
  // 滚轮选项
  const years = useMemo(() => {
    const arr = [];
    for (let y = 1920; y <= 2030; y++) arr.push(y);
    return arr;
  }, []);
  
  const months = useMemo(() => [1,2,3,4,5,6,7,8,9,10,11,12], []);
  
  const days = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const arr = [];
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [year, month]);
  
  // 当月份/年份变化,可能日期超出范围
  // 自动调整
  if (day > days.length) {
    setDay(days.length);
  }
  
  const hourPeriods: HourPeriod[] = [
    'zi_early', 'chou', 'yin', 'mao', 'chen', 'si',
    'wu', 'wei', 'shen', 'you', 'xu', 'hai'
  ];
  
  const localeKey = (locale.split('-')[0] === 'zh' ? 'zh' : 'en') as 'zh' | 'en';
  
  // 检测用户时区
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  
  function handleSubmit() {
    const periodInfo = HOUR_PERIOD_INFO[hourPeriod];
    
    onSubmit({
      year,
      month,
      day,
      hour_period: hourPeriod,
      gender,
      timezone: userTimezone
    });
  }
  
  return (
    <div className="birth-info-picker">
      <h2 className="picker-title">{t('title')}</h2>
      <p className="picker-description">{t('description')}</p>
      
      {/* 主滚轮组 */}
      <div className="picker-section">
        <label>{t('birth_date')}</label>
        <Picker
          value={{ year, month, day }}
          onChange={(value: any) => {
            setYear(value.year);
            setMonth(value.month);
            setDay(value.day);
          }}
          height={180}
          itemHeight={36}
        >
          <Picker.Column name="year">
            {years.map(y => (
              <Picker.Item key={y} value={y}>
                {({ selected }) => (
                  <div style={{ color: selected ? '#D4AF37' : '#888', fontSize: selected ? 18 : 16 }}>
                    {y}
                  </div>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>
          
          <Picker.Column name="month">
            {months.map(m => (
              <Picker.Item key={m} value={m}>
                {({ selected }) => (
                  <div style={{ color: selected ? '#D4AF37' : '#888', fontSize: selected ? 18 : 16 }}>
                    {localeKey === 'zh' ? `${m} 月` : monthEnglishName(m)}
                  </div>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>
          
          <Picker.Column name="day">
            {days.map(d => (
              <Picker.Item key={d} value={d}>
                {({ selected }) => (
                  <div style={{ color: selected ? '#D4AF37' : '#888', fontSize: selected ? 18 : 16 }}>
                    {localeKey === 'zh' ? `${d} 日` : d}
                  </div>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>
        </Picker>
      </div>
      
      {/* 时辰滚轮 */}
      <div className="picker-section">
        <label>{t('birth_hour')}</label>
        <Picker
          value={{ hour_period: hourPeriod }}
          onChange={(value: any) => setHourPeriod(value.hour_period)}
          height={180}
          itemHeight={36}
        >
          <Picker.Column name="hour_period">
            {hourPeriods.map(hp => {
              const info = HOUR_PERIOD_INFO[hp];
              return (
                <Picker.Item key={hp} value={hp}>
                  {({ selected }) => (
                    <div style={{ color: selected ? '#D4AF37' : '#888', fontSize: selected ? 16 : 14 }}>
                      {localeKey === 'zh' ? info.zh_label : info.en_label}
                    </div>
                  )}
                </Picker.Item>
              );
            })}
          </Picker.Column>
        </Picker>
        <p className="hint">{t('hour_hint')}</p>
      </div>
      
      {/* 性别 */}
      <div className="picker-section gender-section">
        <label>{t('gender')}</label>
        <div className="gender-buttons">
          <button
            className={`gender-btn ${gender === 'M' ? 'active' : ''}`}
            onClick={() => setGender('M')}
          >
            {t('male')}
          </button>
          <button
            className={`gender-btn ${gender === 'F' ? 'active' : ''}`}
            onClick={() => setGender('F')}
          >
            {t('female')}
          </button>
        </div>
      </div>
      
      {/* 时区显示(只读)*/}
      <div className="timezone-display">
        <span>{t('timezone_label')}:</span>
        <span className="tz-value">{userTimezone}</span>
        <p className="hint">{t('timezone_hint')}</p>
      </div>
      
      {/* 操作按钮 */}
      <div className="picker-actions">
        {onCancel && (
          <button onClick={onCancel} className="cancel-btn">
            {t('back_to_list')}
          </button>
        )}
        <button onClick={handleSubmit} className="submit-btn">
          {t('continue')}
        </button>
      </div>
    </div>
  );
}

function monthEnglishName(m: number): string {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
}
```

### C.5: 翻译文件

```json
// messages/en/session_prep.json
{
  "list_title": "Choose Your Foundation",
  "list_description": "Select a saved profile, or add new birth information.",
  "add_new_person": "Add new person",
  "male": "Male",
  "female": "Female",
  "ready": "Analyzed",
  "refund_link": "I don't want to share — refund my session",
  "error_create_profile": "Failed to save your information. Please try again."
}

// messages/en/birth_picker.json
{
  "title": "Your Birth Information",
  "description": "These details enable a precise reading tailored to your unique energy.",
  "birth_date": "Date of Birth",
  "birth_hour": "Time of Birth",
  "hour_hint": "Don't know the exact time? Choose your best estimate.",
  "gender": "Gender",
  "male": "Male",
  "female": "Female",
  "timezone_label": "Your timezone (auto-detected)",
  "timezone_hint": "Used internally for precise calculation.",
  "back_to_list": "Back to list",
  "continue": "Continue"
}
```

```json
// messages/zh/session_prep.json
{
  "list_title": "选择你的命主",
  "list_description": "选择已保存的命盘,或添加新的八字。",
  "add_new_person": "添加新命主",
  "male": "男",
  "female": "女",
  "ready": "已分析",
  "refund_link": "我不想分享 — 退款",
  "error_create_profile": "保存失败,请重试。"
}

// messages/zh/birth_picker.json
{
  "title": "你的出生信息",
  "description": "这些信息让 POJU 能基于你独特的能量做出精准解读。",
  "birth_date": "出生日期",
  "birth_hour": "出生时辰",
  "hour_hint": "不知道准确时辰? 选最接近的估计。",
  "gender": "性别",
  "male": "男",
  "female": "女",
  "timezone_label": "你的时区(自动识别)",
  "timezone_hint": "仅用于内部精确计算。",
  "back_to_list": "返回列表",
  "continue": "继续"
}
```

```
(es / fr / de 同样结构,Cursor 翻译)
```

### C.6: 样式(关键部分)

```css
/* styles/session-prep.css */

.session-prep-container {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0a0f 0%, #1a1a25 100%);
  color: #e5e5e5;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 欢迎词 */
.welcome-section {
  max-width: 600px;
  text-align: center;
  margin-bottom: 32px;
  margin-top: 32px;
}

.poju-logo {
  font-size: 32px;
  font-weight: 700;
  color: #D4AF37;
  letter-spacing: 8px;
  margin-bottom: 16px;
}

.welcome-text {
  color: #ccc;
  line-height: 1.7;
  margin-bottom: 24px;
}

.your-question {
  background: rgba(212, 175, 55, 0.05);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 8px;
  padding: 16px;
}

.your-question .label {
  color: #888;
  font-size: 13px;
  display: block;
  margin-bottom: 8px;
}

.your-question .question-text {
  color: #e5e5e5;
  font-style: italic;
}

/* 主区 */
.prep-main {
  width: 100%;
  max-width: 600px;
  margin-bottom: 32px;
}

/* Profile 卡片 */
.profiles-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
}

.profile-card-button {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  color: inherit;
  font: inherit;
}

.profile-card-button:hover {
  background: rgba(212, 175, 55, 0.05);
  border-color: rgba(212, 175, 55, 0.4);
}

.display-name {
  color: #e5e5e5;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
}

.card-meta {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: #888;
  margin-bottom: 8px;
}

.ready-badge {
  background: rgba(76, 175, 80, 0.15);
  color: #4caf50;
  padding: 2px 8px;
  border-radius: 4px;
}

.usage-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
}

.add-new-card-button {
  background: transparent;
  border: 2px dashed rgba(212, 175, 55, 0.3);
  border-radius: 12px;
  padding: 32px;
  cursor: pointer;
  color: #D4AF37;
  font-size: 16px;
  transition: all 0.15s;
}

.add-new-card-button:hover {
  background: rgba(212, 175, 55, 0.05);
  border-color: rgba(212, 175, 55, 0.5);
}

.plus-icon {
  display: block;
  font-size: 24px;
  margin-bottom: 8px;
}

/* 滚轮表单 */
.birth-info-picker {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(212, 175, 55, 0.15);
  border-radius: 16px;
  padding: 24px;
}

.picker-title {
  color: #D4AF37;
  margin-bottom: 8px;
}

.picker-description {
  color: #888;
  margin-bottom: 24px;
}

.picker-section {
  margin-bottom: 24px;
}

.picker-section label {
  display: block;
  color: #ccc;
  font-size: 14px;
  margin-bottom: 8px;
}

.picker-section .hint {
  color: #666;
  font-size: 12px;
  margin-top: 8px;
}

/* react-mobile-picker 样式覆盖 */
.picker-section :global(.picker-column) {
  background: rgba(0, 0, 0, 0.3) !important;
}

.picker-section :global(.picker-highlight) {
  border-top: 1px solid rgba(212, 175, 55, 0.3) !important;
  border-bottom: 1px solid rgba(212, 175, 55, 0.3) !important;
}

/* 性别按钮 */
.gender-section {
  display: flex;
  flex-direction: column;
}

.gender-buttons {
  display: flex;
  gap: 12px;
}

.gender-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ccc;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.gender-btn.active {
  background: rgba(212, 175, 55, 0.15);
  border-color: #D4AF37;
  color: #D4AF37;
}

/* 时区显示 */
.timezone-display {
  background: rgba(255, 255, 255, 0.02);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 24px;
  font-size: 13px;
}

.timezone-display .tz-value {
  color: #87CEEB;
  margin-left: 8px;
}

/* 操作按钮 */
.picker-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.picker-actions button {
  flex: 1;
  padding: 14px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}

.cancel-btn {
  background: transparent;
  color: #888;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

.submit-btn {
  background: #D4AF37;
  color: #0a0a0f;
}

.submit-btn:hover {
  background: #E8C56F;
}

/* 退款链接 */
.refund-link-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.refund-link {
  background: transparent;
  border: none;
  color: #666;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}

.refund-link:hover {
  color: #aaa;
}
```

## 验证清单

```
□ react-mobile-picker 已安装
□ prepare 路由可访问
□ SessionPreparation 组件渲染
□ 已有 profile 时显示列表
□ 无 profile 时直接显示滚轮表单
□ 滚轮工作流畅(年月日 + 时辰)
□ 性别按钮切换
□ 时区自动检测显示
□ 5 语言翻译完整
□ 移动端响应式良好
□ 退款链接显示

测试:
  1. /poju/session/test-1/prepare(假数据)
  2. 选择新建 → 滚轮选择
  3. 修改月份观察日期自动调整(2 月没有 31)
  4. 切换性别按钮
  5. 截图描述给用户审视

🛑 等用户确认进入 Step D
```

---

# 第 5 部分:Step D - 信息确认对话框

## Step D:BirthInfoConfirmDialog

```
任务:

用户递交表单 或 选择已有 profile 后,
弹出确认对话框,显示完整信息让用户确认。

确认后 → 进入数据准备页(Step F)
取消 → 返回上一步
```

### D.1: 组件代码

```typescript
// components/poju/BirthInfoConfirmDialog.tsx

'use client';

import { useTranslations } from 'next-intl';
import { HOUR_PERIOD_INFO, type BirthInfo } from '@/lib/profile/types';
import type { StoredProfileSummary } from '@/lib/profile/stored-profiles-service';

interface Props {
  // 二选一
  birthInfo?: BirthInfo | null;          // 新填写
  existingProfile?: StoredProfileSummary | null; // 已存在
  
  onConfirm: () => void;
  onCancel: () => void;
  processing?: boolean;
}

export function BirthInfoConfirmDialog({
  birthInfo,
  existingProfile,
  onConfirm,
  onCancel,
  processing
}: Props) {
  const t = useTranslations('birth_confirm');
  
  // 提取要显示的信息
  const displayData = birthInfo
    ? {
        year: birthInfo.year,
        month: birthInfo.month,
        day: birthInfo.day,
        hour_period: birthInfo.hour_period,
        gender: birthInfo.gender,
        timezone: birthInfo.timezone
      }
    : existingProfile
    ? parseExistingProfileForDisplay(existingProfile)
    : null;
  
  if (!displayData) return null;
  
  const periodInfo = HOUR_PERIOD_INFO[displayData.hour_period];
  
  return (
    <div className="confirm-dialog-overlay">
      <div className="confirm-dialog">
        <h2>{t('title')}</h2>
        <p className="description">{t('description')}</p>
        
        <div className="info-display">
          <div className="info-row">
            <span className="label">{t('date_label')}:</span>
            <span className="value">
              {displayData.year} / {String(displayData.month).padStart(2, '0')} / {String(displayData.day).padStart(2, '0')}
            </span>
          </div>
          
          <div className="info-row">
            <span className="label">{t('hour_label')}:</span>
            <span className="value">
              {periodInfo.zh_label} 
              <span className="value-sub"> ({periodInfo.chinese_name})</span>
            </span>
          </div>
          
          <div className="info-row">
            <span className="label">{t('gender_label')}:</span>
            <span className="value">
              {displayData.gender === 'M' ? t('male') : t('female')}
            </span>
          </div>
          
          <div className="info-row">
            <span className="label">{t('timezone_label')}:</span>
            <span className="value tz">{displayData.timezone}</span>
          </div>
        </div>
        
        <div className="reassure">
          <p>{t('reassure_1')}</p>
          <p>{t('reassure_2')}</p>
        </div>
        
        <div className="dialog-actions">
          <button onClick={onCancel} disabled={processing} className="secondary">
            {t('go_back')}
          </button>
          <button onClick={onConfirm} disabled={processing} className="primary">
            {processing ? t('processing') : t('confirm_and_proceed')}
          </button>
        </div>
      </div>
    </div>
  );
}

// 从 StoredProfileSummary 提取(已有 profile)
function parseExistingProfileForDisplay(p: StoredProfileSummary) {
  // 假设 p 中有 birth_date 等已展开字段
  // (需要在 StoredProfileSummary 中加上 birth_info 完整字段)
  return {
    year: parseInt(p.birth_date.split('-')[0]),
    month: parseInt(p.birth_date.split('-')[1]),
    day: parseInt(p.birth_date.split('-')[2]),
    hour_period: p.hour_period as any,
    gender: p.gender,
    timezone: p.timezone || 'Auto-detected'
  };
}
```

### D.2: 翻译

```json
// messages/en/birth_confirm.json
{
  "title": "Confirm Your Information",
  "description": "Please verify the information below. Once confirmed, POJU will cast your chart and prepare your reading.",
  "date_label": "Date of Birth",
  "hour_label": "Time of Birth",
  "gender_label": "Gender",
  "timezone_label": "Timezone",
  "male": "Male",
  "female": "Female",
  "reassure_1": "Your data stays only on this device, encrypted.",
  "reassure_2": "Once confirmed, this takes about 30-60 seconds to prepare.",
  "go_back": "Go back & edit",
  "confirm_and_proceed": "Confirm & Begin",
  "processing": "Preparing..."
}

// messages/zh/birth_confirm.json
{
  "title": "确认你的信息",
  "description": "请核对以下信息。确认后,POJU 会立即排盘并准备你的解读。",
  "date_label": "出生日期",
  "hour_label": "出生时辰",
  "gender_label": "性别",
  "timezone_label": "时区",
  "male": "男",
  "female": "女",
  "reassure_1": "你的数据只保存在本设备,已加密。",
  "reassure_2": "确认后,准备过程约 30-60 秒。",
  "go_back": "返回修改",
  "confirm_and_proceed": "确认并开始",
  "processing": "准备中..."
}
```

### D.3: 样式

```css
.confirm-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(10px);
  padding: 16px;
}

.confirm-dialog {
  background: #1a1a25;
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 16px;
  padding: 32px;
  max-width: 500px;
  width: 100%;
}

.confirm-dialog h2 {
  color: #D4AF37;
  margin-bottom: 12px;
}

.confirm-dialog .description {
  color: #ccc;
  margin-bottom: 24px;
  line-height: 1.6;
}

.info-display {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-row:last-child {
  border-bottom: none;
}

.info-row .label {
  color: #888;
  font-size: 13px;
}

.info-row .value {
  color: #e5e5e5;
  font-weight: 500;
}

.info-row .value-sub {
  color: #888;
  font-size: 13px;
  font-weight: normal;
}

.info-row .value.tz {
  color: #87CEEB;
  font-family: monospace;
  font-size: 13px;
}

.reassure {
  background: rgba(135, 206, 235, 0.05);
  border-left: 3px solid #87CEEB;
  padding: 12px 16px;
  margin-bottom: 24px;
}

.reassure p {
  color: #87CEEB;
  font-size: 13px;
  margin-bottom: 4px;
}

.dialog-actions {
  display: flex;
  gap: 12px;
}

.dialog-actions button {
  flex: 1;
  padding: 14px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}

.dialog-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dialog-actions .primary {
  background: #D4AF37;
  color: #0a0a0f;
}

.dialog-actions .secondary {
  background: transparent;
  color: #888;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}
```

## 验证清单

```
□ BirthInfoConfirmDialog 实现
□ 显示完整信息(日期/时辰/性别/时区)
□ 时辰显示英文 + 中文双语
□ 5 语言翻译
□ 隐私保证文案
□ Confirm 触发 onConfirm 回调
□ Cancel 关闭对话框
□ processing 状态禁用按钮

🛑 等用户确认进入 Step E
```

---

# 第 6 部分:Step E - 退款流程

## Step E:自动退款集成

```
任务:

新路由:/poju/session/[id]/refund

流程:
  1. 用户在 prepare 页点"我不想分享"
  2. 跳转到 refund 页
  3. 显示确认对话框
  4. 用户最终确认 → 调退款 API
  5. 显示成功 / 失败结果
  6. 删除 Session(因没用过)
```

### E.1: 退款 API 路由

```typescript
// app/api/payments/refund/route.ts

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface RefundRequest {
  session_id: string;
  payment_id: string;
  payment_processor: 'dodopayments' | 'stripe';
  reason: 'user_declined_profile' | 'unsatisfied' | 'other';
}

export async function POST(req: Request) {
  try {
    const body: RefundRequest = await req.json();
    
    let refundResult;
    
    if (body.payment_processor === 'dodopayments') {
      refundResult = await refundViaDodoPayments(body);
    } else if (body.payment_processor === 'stripe') {
      refundResult = await refundViaStripe(body);
    } else {
      throw new Error('Unsupported payment processor');
    }
    
    return NextResponse.json({
      success: true,
      refund_id: refundResult.refund_id,
      amount: refundResult.amount,
      eta_days: 3-5
    });
    
  } catch (error: any) {
    console.error('[refund] Failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      fallback: 'Please contact support@easternos.com'
    }, { status: 500 });
  }
}

async function refundViaDodoPayments(req: RefundRequest) {
  const apiKey = process.env.DODO_API_KEY;
  if (!apiKey) throw new Error('DodoPayments not configured');
  
  // DodoPayments refund API (具体 API 看其文档)
  const response = await fetch(`https://api.dodopayments.com/v1/refunds`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      payment_id: req.payment_id,
      reason: req.reason
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DodoPayments refund failed: ${error}`);
  }
  
  const data = await response.json();
  return {
    refund_id: data.id,
    amount: data.amount
  };
}

async function refundViaStripe(req: RefundRequest) {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error('Stripe not configured');
  
  const Stripe = require('stripe');
  const stripe = new Stripe(apiKey);
  
  // Stripe refund
  const refund = await stripe.refunds.create({
    payment_intent: req.payment_id,
    reason: 'requested_by_customer'
  });
  
  return {
    refund_id: refund.id,
    amount: refund.amount / 100
  };
}
```

### E.2: 退款页面

```typescript
// app/[locale]/(marketing)/poju/session/[id]/refund/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { loadPOJUSession, deletePOJUSession } from '@/lib/poju/session-manager';

export default function RefundPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('refund');
  
  const sessionId = params.id as string;
  
  const [stage, setStage] = useState<'confirm' | 'processing' | 'success' | 'error'>('confirm');
  const [session, setSession] = useState<any>(null);
  const [refundData, setRefundData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadSession();
  }, []);
  
  async function loadSession() {
    const s = await loadPOJUSession(sessionId);
    if (!s) {
      router.push('/poju');
      return;
    }
    setSession(s);
  }
  
  async function handleConfirmRefund() {
    if (!session) return;
    
    setStage('processing');
    
    try {
      const response = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          payment_id: session.payment_id,
          payment_processor: session.payment_processor || 'dodopayments',
          reason: 'user_declined_profile'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRefundData(data);
        setStage('success');
        
        // 删除 Session
        await deletePOJUSession(sessionId);
      } else {
        setError(data.error || data.fallback);
        setStage('error');
      }
    } catch (err: any) {
      setError(err.message);
      setStage('error');
    }
  }
  
  function handleCancel() {
    router.push(`/${locale}/poju/session/${sessionId}/prepare`);
  }
  
  if (!session) {
    return <div className="loading-fullscreen">Loading...</div>;
  }
  
  return (
    <div className="refund-page">
      <div className="refund-content">
        <h1 className="refund-title">{t('title')}</h1>
        
        {stage === 'confirm' && (
          <ConfirmStage 
            onConfirm={handleConfirmRefund}
            onCancel={handleCancel}
          />
        )}
        
        {stage === 'processing' && (
          <div className="refund-processing">
            <div className="spinner"></div>
            <p>{t('processing')}</p>
          </div>
        )}
        
        {stage === 'success' && refundData && (
          <SuccessStage refundData={refundData} />
        )}
        
        {stage === 'error' && (
          <ErrorStage error={error} onRetry={handleConfirmRefund} />
        )}
      </div>
    </div>
  );
}

function ConfirmStage({ onConfirm, onCancel }: any) {
  const t = useTranslations('refund');
  
  return (
    <div className="refund-confirm">
      <p className="confirm-text">{t('confirm_text')}</p>
      
      <div className="refund-info-box">
        <div>
          <span className="label">{t('amount_label')}</span>
          <span className="value">$9.99</span>
        </div>
        <div>
          <span className="label">{t('eta_label')}</span>
          <span className="value">{t('eta_value')}</span>
        </div>
      </div>
      
      <p className="reassure">{t('reassure')}</p>
      
      <div className="actions">
        <button onClick={onCancel} className="secondary">
          {t('go_back')}
        </button>
        <button onClick={onConfirm} className="primary">
          {t('confirm_refund')}
        </button>
      </div>
    </div>
  );
}

function SuccessStage({ refundData }: any) {
  const t = useTranslations('refund');
  const router = useRouter();
  const locale = useLocale();
  
  return (
    <div className="refund-success">
      <div className="success-icon">✓</div>
      <h2>{t('success_title')}</h2>
      <p>{t('success_message', { amount: `$${refundData.amount}`, days: '3-5' })}</p>
      
      <div className="refund-id-box">
        <span className="label">{t('refund_id_label')}</span>
        <span className="value">{refundData.refund_id}</span>
      </div>
      
      <button 
        onClick={() => router.push(`/${locale}/poju`)}
        className="primary"
      >
        {t('back_to_home')}
      </button>
    </div>
  );
}

function ErrorStage({ error, onRetry }: any) {
  const t = useTranslations('refund');
  
  return (
    <div className="refund-error">
      <div className="error-icon">✕</div>
      <h2>{t('error_title')}</h2>
      <p>{t('error_message')}</p>
      
      <div className="error-detail">
        {error}
      </div>
      
      <div className="actions">
        <button onClick={onRetry} className="primary">
          {t('retry')}
        </button>
        <a href="mailto:support@easternos.com" className="email-btn">
          {t('contact_support')}
        </a>
      </div>
    </div>
  );
}
```

### E.3: 翻译 + 样式

```json
// messages/en/refund.json
{
  "title": "Refund Your Session",
  "confirm_text": "We understand. Your session will be refunded and removed.",
  "amount_label": "Amount",
  "eta_label": "Refund timing",
  "eta_value": "3-5 business days",
  "reassure": "If you change your mind, you can always start a new session later.",
  "go_back": "Go back",
  "confirm_refund": "Yes, refund my session",
  "processing": "Processing your refund...",
  "success_title": "Refund Confirmed",
  "success_message": "{amount} has been refunded. It will appear in your account within {days} business days.",
  "refund_id_label": "Refund ID",
  "back_to_home": "Back to POJU",
  "error_title": "Refund Failed",
  "error_message": "We couldn't process your refund automatically. Please contact us.",
  "retry": "Retry",
  "contact_support": "Email support"
}

// messages/zh/refund.json
{
  "title": "退款",
  "confirm_text": "我们理解。你的会话将被退款并删除。",
  "amount_label": "金额",
  "eta_label": "退款到账",
  "eta_value": "3-5 个工作日",
  "reassure": "如果你改变主意,随时可以重新开始一个新会话。",
  "go_back": "返回",
  "confirm_refund": "是的,退款",
  "processing": "正在处理退款...",
  "success_title": "退款已确认",
  "success_message": "{amount} 已经退款。预计 {days} 个工作日内到账。",
  "refund_id_label": "退款 ID",
  "back_to_home": "返回 POJU",
  "error_title": "退款失败",
  "error_message": "无法自动处理退款,请联系客服。",
  "retry": "重试",
  "contact_support": "邮件联系"
}
```

```css
/* styles/refund.css(简化) */
.refund-page {
  min-height: 100vh;
  background: #0a0a0f;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.refund-content {
  max-width: 500px;
  width: 100%;
  background: #1a1a25;
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 16px;
  padding: 32px;
  text-align: center;
}

/* 成功 / 错误图标 */
.success-icon, .error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
.success-icon { color: #4caf50; }
.error-icon { color: #f44336; }

/* Spinner */
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(212, 175, 55, 0.2);
  border-top-color: #D4AF37;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### E.4: 添加 deletePOJUSession 辅助函数

```typescript
// lib/poju/session-manager.ts(增加)

export async function deletePOJUSession(sessionId: string): Promise<void> {
  await db.poju_sessions.delete(sessionId);
  console.log('[session-manager] Session deleted:', sessionId);
}
```

## 验证清单

```
□ /api/payments/refund 路由实现
□ Refund 页面 4 个状态(confirm/processing/success/error)
□ 自动调用 DodoPayments 或 Stripe API
□ 成功后 session 自动删除
□ 失败有 fallback(邮件客服)
□ 5 语言翻译
□ 测试 mock 退款流程

测试场景:
  1. mock DodoPayments(返回 fake_refund_id)
  2. 完整走一遍 confirm → processing → success
  3. mock 失败场景 → 显示 error 状态
  4. 检查 IndexedDB 中 session 是否被删除

🛑 等用户确认 Part 1 全部 Step 完成
```

---

# Part 1 完成总结

```
✅ Step 0: Cursor 自查 + 清理诊断
✅ Step A: 文件清理(删除冲突)
✅ Step B: 数据类型重构(简化 4 字段)
✅ Step C: Session 准备页(欢迎 + 八字滚轮表单)
✅ Step D: 信息确认对话框
✅ Step E: 退款流程

到这一步,用户已经能:
  - 付款进入
  - 看到欢迎词 + 表单
  - 用滚轮选择八字信息
  - 确认信息
  - (或者退款返回)

但还没有:
  ✗ 数据准备页(DeepSeek loading)
  ✗ 对话页(改造)
  ✗ AI 主动开场
  ✗ 系统提示词(玄学定位)
  ✗ Agent 状态简化

这些在 Part 2 中完成。
```

---

# 给 Cursor 的最终提醒

```
本 Part 1 包含 Step 0 + Step A-E。

实施顺序:
  1. Step 0 自查 → 贴报告 → 等用户确认
  2. Step A 清理 → 贴 git status → 等用户确认
  3. Step B 类型 → 贴 tsc 输出 → 等用户确认
  4. Step C 准备页 → 截图描述 → 等用户确认
  5. Step D 确认框 → 测试输出 → 等用户确认
  6. Step E 退款 → mock 测试 → 等用户确认

绝不允许:
  ✗ 跨 Step 实施
  ✗ "我觉得 D 和 E 类似就一起做了"
  ✗ 擅自决定设计变化

完成 Part 1 后,等用户给 Part 2 文档。
```

---

**Cursor: 完成 Step 0 自查,先把现状报告贴出来。不要急着做任何修改。**

**用户:Part 2 即将生成。Part 2 涵盖数据准备 + 对话页 + Agent + Prompt + API。**
