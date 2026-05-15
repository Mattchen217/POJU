# POJU v4.0 · Agent 完整重构实施文档 · Part 1

> **背景**: 当前 POJU 实现存在 3 个核心问题(详见 Step 0)。本文档是完整重构,目标是让 POJU 成为真正的 Agent。
>
> **前置依赖**:
> - Foundation 已完成(shunshi + 加密 + IndexedDB)
> - LLM Architecture Part 1 已完成(OpenRouter + 三层调用)
>
> **本部分覆盖**:
> - Step 0: 当前问题深度分析
> - Step 1-3: 数据层重构(stored_profiles 跨产品共享)
> - Step 4-6: Agent 状态机 + 信息收集框架
> - Step 7-9: DeepSeek 多次调用层
> - Step 10: Pre-profile Prompt 完全重写
>
> **下一部分(Part 2)**: Step 11-21
>
> **执行原则**: 每个 Step 都是【完整代码可直接复制】

---

# ⚠️ Cursor 必读:重构哲学

## 当前问题(必须先理解)

```
3 个核心问题(来自实际对话测试 + Cursor 排查):

问题 1: LLM 在没有 profile 时输出"你的个人特质..."
  → 幻觉,假装有数据

问题 2: 用户聊了 4 轮事业困境,表单从未弹出
  → 触发条件依赖正则匹配最后一条消息,
    用户换措辞就丢

问题 3: LLM 说"已经为你写好完整分析",但实际没交付
  → 文案承诺 vs 实际交付门控不同步

根本原因(我的诊断):

A. 阶段感知缺失
   - LLM 不知道自己在哪个阶段
   - 每次响应都是"从头思考"
   - 缺少线性推进力

B. 信息收集无框架
   - LLM 看见什么回什么(被动)
   - 不知道还要收集什么
   - 不会主动问"你的具体工作内容?"

C. 状态管理不闭环
   - context_collected 提取了但没用
   - 已知信息不在 prompt 中
   - 重复提问

D. 护栏正则化(脆弱)
   - 用正则拦"个人特质"等
   - 但 LLM 措辞千变万化
   - 必须从源头消除幻觉
```

## 重构 5 大原则

```
1. 阶段是【硬性状态】+ LLM 建议
   代码维护当前 Phase(明确状态)
   LLM 输出建议下一 Phase
   切换由代码决策(基于规则 + LLM 输出)

2. 信息收集有【字段框架】
   每种问题类型有【必需字段清单】
   LLM 每轮提取字段
   代码检查完成度
   未完成时,LLM【必须】继续问

3. 已收集信息每轮【注入 Prompt】
   LLM 永远看到"已知 X、不知 Y"
   不会重复问已知
   主动问未知

4. 幻觉【源头消除】
   无 profile 时,Prompt 严禁"个人特质/天性"等
   严禁未来时态("你会...")
   严禁主观判断("你其实...")
   只允许中性问诊问题

5. 文案 = 交付【强制一致】
   服务端检查:
   - 提到"我为你整理了..."但 contains_delivery=false → 改写
   - 提到具体五行/方位/物件但 no profile → 改写
```

---

# 第 1 部分:Step 0 - 当前问题深度分析

## Step 0:Cursor 自查 + 报告

```
任务:

⚠️ 这是【诊断】Step,不修代码。先理解清楚再改。

请检查并报告以下文件的当前状态:

1. 列出文件是否存在 + 贴出当前实现:
   - lib/poju/agent.ts
   - lib/poju/output-policy.ts (排查日志中提到)
   - lib/poju/context-readiness.ts (排查日志中提到)
   - lib/poju/rules.ts
   - lib/llm/prompts/flash-chat.ts (或 poju-prompts.ts)
   - lib/llm/poju-llm.ts 或类似
   - app/api/poju/chat/route.ts
   - components/poju/POJUChatUI.tsx

2. 关键正则提取:
   - FORBIDDEN_PRE_PROFILE_TRAIT_RE 当前内容
   - DEEP_LIFE_TOPIC_RE 当前内容
   - 任何其他相关正则

3. 关键函数提取:
   - forceBirthForm 函数体
   - getLastUserMessageContent 函数体
   - applyPojuOutputPolicies 函数体

4. Session 类型当前定义:
   - POJUSessionState
   - context_collected 字段当前结构
   - phase / state 字段当前结构

5. 报告:
   - 哪些文件需要重构
   - 哪些可以保留
   - 任何阻塞问题

6. ⚠️ 不要立即改代码
   先完成自查报告
   用户审视后决定改哪些
```

## 验证清单

```
□ 列出所有相关文件 + 当前实现
□ 提取关键正则 + 函数
□ 报告 Session 类型当前结构
□ 用户审视后确认进入 Step 1

🛑 等用户确认
```

---

# 第 2 部分:Step 1 - stored_profiles 表设计

## Step 1:扩展 IndexedDB - 跨产品八字管理

```
任务:

新增 stored_profiles 表,用于:
1. 一台设备保存多个人的八字(本人、家人、朋友)
2. POJU/Glyph/Syncro 跨产品复用
3. 缓存 deepseek_base_analysis(命主基础分析,只调一次)

修改 lib/db/poju-db.ts:
```

```typescript
// lib/db/poju-db.ts

import Dexie, { Table } from 'dexie';

// ============= 新增:stored_profiles 表 =============

export interface StoredProfileRecord {
  // 主键
  profile_id: string;  // UUID
  device_id: string;
  
  // 用户起的名字
  display_name: string;  // "我自己" / "妻子" / "孩子"
  
  // 防重复(同样的出生信息 = 同一个人)
  birth_info_hash: string;  // SHA256(year+month+day+hour+minute+gender)
  
  // 关系标签(可选,用于 UI 分类)
  relationship: 'self' | 'spouse' | 'child' | 'parent' | 'sibling' | 'friend' | 'other';
  
  // 加密的完整数据
  encrypted_data: string;
  iv: string;
  
  // 时间戳
  created_at: Date;
  last_used_at: Date;
  
  // 使用记录(明文,便于 UI 显示统计)
  used_in_products: {
    poju: number;    // 在 POJU 中使用次数
    glyph: number;
    syncro: number;
  };
  
  // 是否已生成 base_analysis(查询用)
  has_base_analysis: boolean;
  base_analysis_at?: Date;
}

// 解密后的完整数据结构
export interface StoredProfileData {
  // 出生信息(原始)
  birth_info: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    gender: 'M' | 'F';
    timezone: string;
    longitude: number;
    latitude: number;
    location_name?: string;  // 用户填写的地名(便于 UI 显示)
  };
  
  // shunshi 计算的 user_profile
  user_profile: any;  // 从 lib/profile/types.ts 来
  
  // DeepSeek 命主基础分析(永久缓存,只生成一次)
  base_analysis?: {
    generated_at: string;
    model: string;
    content: any;  // DeepSeek 输出的命主分析 JSON
    tokens_used: number;
  };
}

// ============= 修改 PojulifeDB 类 =============

class PojulifeDB extends Dexie {
  user_profiles!: Table<UserProfileRecord, string>;
  device_info!: Table<DeviceInfoRecord, string>;
  poju_sessions!: Table<POJUSessionRecord, string>;
  poju_archive!: Table<POJUArchiveRecord, string>;
  glyph_history!: Table<GlyphHistoryRecord, string>;
  glyph_usage!: Table<GlyphUsageRecord, string>;
  syncro_tasks!: Table<SyncroTaskRecord, string>;
  syncro_cache!: Table<SyncroCacheRecord, string>;
  app_settings!: Table<AppSettingRecord, string>;
  
  // ⭐ 新增
  stored_profiles!: Table<StoredProfileRecord, string>;
  
  constructor() {
    super('pojulife_v4');
    
    // version 1:已存在的表
    this.version(1).stores({
      user_profiles: 'device_id, computed_at, updated_at',
      device_info: 'device_id, created_at',
      poju_sessions: 'session_id, device_id, status, created_at, last_interaction_at',
      poju_archive: 'session_id, archived_at',
      glyph_history: 'id, device_id, drawn_at',
      glyph_usage: 'device_id, date',
      syncro_tasks: 'task_id, device_id, valid_until',
      syncro_cache: 'cache_key, hour, expires_at',
      app_settings: 'key, updated_at'
    });
    
    // version 2:新增 stored_profiles
    this.version(2).stores({
      stored_profiles: 'profile_id, device_id, birth_info_hash, last_used_at, has_base_analysis'
    });
  }
}

export const db = new PojulifeDB();
```

```
2. 测试 schema 升级:

scripts/test-stored-profiles-schema.ts:
```

```typescript
// scripts/test-stored-profiles-schema.ts (在浏览器 dev 页面运行)

import { db } from '@/lib/db/poju-db';

async function test() {
  // 1. 检查表存在
  const tables = db.tables.map(t => t.name);
  console.log('All tables:', tables);
  console.log('Has stored_profiles:', tables.includes('stored_profiles'));
  
  // 2. 写入测试记录
  await db.stored_profiles.put({
    profile_id: 'test-id-1',
    device_id: 'test-device',
    display_name: '测试用户',
    birth_info_hash: 'test-hash',
    relationship: 'self',
    encrypted_data: 'test-encrypted',
    iv: 'test-iv',
    created_at: new Date(),
    last_used_at: new Date(),
    used_in_products: { poju: 0, glyph: 0, syncro: 0 },
    has_base_analysis: false
  });
  
  // 3. 读取
  const record = await db.stored_profiles.get('test-id-1');
  console.log('Record read:', record);
  
  // 4. 清理
  await db.stored_profiles.delete('test-id-1');
  
  console.log('✅ stored_profiles schema works');
}
```

## 验证清单

```
□ stored_profiles 表添加成功
□ version 升级到 2
□ 测试写入/读取/删除通过
□ F12 IndexedDB 中能看到 stored_profiles 表

🛑 等用户确认
```

---

# 第 3 部分:Step 2 - 八字管理服务

## Step 2:lib/profile/stored-profiles-service.ts

```
任务:

实现完整的八字管理 API。

完整代码:
```

```typescript
// lib/profile/stored-profiles-service.ts

import { v4 as uuidv4 } from 'uuid';
import { db, StoredProfileRecord, StoredProfileData } from '@/lib/db/poju-db';
import { encrypt, decrypt } from '@/lib/crypto';
import { getDeviceId } from '@/lib/init';
import { buildUserProfile } from '@/lib/calculations/build-profile';

// ============= Hash 函数 =============

async function hashBirthInfo(birth: StoredProfileData['birth_info']): Promise<string> {
  const canonical = `${birth.year}-${birth.month}-${birth.day}-${birth.hour}-${birth.minute}-${birth.gender}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============= 列表 =============

export interface StoredProfileSummary {
  profile_id: string;
  display_name: string;
  relationship: string;
  birth_date: string;        // "1990-05-15"
  birth_time: string;        // "14:30"
  gender: 'M' | 'F';
  location_name: string;
  has_base_analysis: boolean;
  used_in_products: { poju: number; glyph: number; syncro: number };
  last_used_at: string;
  created_at: string;
}

export async function listStoredProfiles(): Promise<StoredProfileSummary[]> {
  const deviceId = getDeviceId();
  if (!deviceId) return [];
  
  const records = await db.stored_profiles
    .where('device_id').equals(deviceId)
    .reverse()
    .sortBy('last_used_at');
  
  const summaries: StoredProfileSummary[] = [];
  
  for (const record of records) {
    try {
      const data: StoredProfileData = await decrypt(record.encrypted_data, record.iv);
      summaries.push({
        profile_id: record.profile_id,
        display_name: record.display_name,
        relationship: record.relationship,
        birth_date: `${data.birth_info.year}-${String(data.birth_info.month).padStart(2, '0')}-${String(data.birth_info.day).padStart(2, '0')}`,
        birth_time: `${String(data.birth_info.hour).padStart(2, '0')}:${String(data.birth_info.minute).padStart(2, '0')}`,
        gender: data.birth_info.gender,
        location_name: data.birth_info.location_name || 'Unknown',
        has_base_analysis: record.has_base_analysis,
        used_in_products: record.used_in_products,
        last_used_at: record.last_used_at.toISOString(),
        created_at: record.created_at.toISOString()
      });
    } catch (e) {
      console.warn('[stored-profiles] Failed to decrypt:', record.profile_id);
    }
  }
  
  return summaries;
}

// ============= 创建 =============

export async function createStoredProfile(input: {
  birth_info: StoredProfileData['birth_info'];
  display_name: string;
  relationship: StoredProfileRecord['relationship'];
}): Promise<{ profile_id: string; is_duplicate: boolean }> {
  
  const deviceId = getDeviceId();
  if (!deviceId) throw new Error('App not initialized');
  
  // 检查是否重复(同样出生信息)
  const hash = await hashBirthInfo(input.birth_info);
  const existing = await db.stored_profiles
    .where('birth_info_hash').equals(hash)
    .and(r => r.device_id === deviceId)
    .first();
  
  if (existing) {
    // 已存在,更新 last_used_at
    await db.stored_profiles.update(existing.profile_id, {
      last_used_at: new Date()
    });
    return { profile_id: existing.profile_id, is_duplicate: true };
  }
  
  // 计算 user_profile(本地 shunshi)
  console.log('[stored-profiles] Computing user_profile via shunshi...');
  const userProfile = await buildUserProfile({
    year: input.birth_info.year,
    month: input.birth_info.month,
    day: input.birth_info.day,
    hour: input.birth_info.hour,
    minute: input.birth_info.minute,
    gender: input.birth_info.gender,
    timezone: input.birth_info.timezone,
    longitude: input.birth_info.longitude,
    latitude: input.birth_info.latitude
  });
  
  // 准备数据
  const data: StoredProfileData = {
    birth_info: input.birth_info,
    user_profile: userProfile
    // base_analysis 暂不生成,等 Step 7 服务调用时生成
  };
  
  // 加密保存
  const { ciphertext, iv } = await encrypt(data);
  
  const profileId = uuidv4();
  await db.stored_profiles.put({
    profile_id: profileId,
    device_id: deviceId,
    display_name: input.display_name,
    birth_info_hash: hash,
    relationship: input.relationship,
    encrypted_data: ciphertext,
    iv,
    created_at: new Date(),
    last_used_at: new Date(),
    used_in_products: { poju: 0, glyph: 0, syncro: 0 },
    has_base_analysis: false
  });
  
  return { profile_id: profileId, is_duplicate: false };
}

// ============= 读取(完整数据)=============

export async function getStoredProfile(profileId: string): Promise<StoredProfileData | null> {
  const record = await db.stored_profiles.get(profileId);
  if (!record) return null;
  
  try {
    const data: StoredProfileData = await decrypt(record.encrypted_data, record.iv);
    return data;
  } catch (e) {
    console.error('[stored-profiles] Decrypt failed:', e);
    return null;
  }
}

export async function getStoredProfileRecord(profileId: string): Promise<StoredProfileRecord | null> {
  const record = await db.stored_profiles.get(profileId);
  return record || null;
}

// ============= 更新(用于保存 base_analysis)=============

export async function saveBaseAnalysis(
  profileId: string,
  baseAnalysis: any,
  meta: { model: string; tokens_used: number }
): Promise<void> {
  const record = await db.stored_profiles.get(profileId);
  if (!record) throw new Error('Profile not found');
  
  // 解密 + 加入 base_analysis + 重新加密
  const data: StoredProfileData = await decrypt(record.encrypted_data, record.iv);
  data.base_analysis = {
    generated_at: new Date().toISOString(),
    model: meta.model,
    tokens_used: meta.tokens_used,
    content: baseAnalysis
  };
  
  const { ciphertext, iv } = await encrypt(data);
  
  await db.stored_profiles.update(profileId, {
    encrypted_data: ciphertext,
    iv,
    has_base_analysis: true,
    base_analysis_at: new Date(),
    last_used_at: new Date()
  });
}

// ============= 使用记录 =============

export async function recordProfileUsage(
  profileId: string,
  product: 'poju' | 'glyph' | 'syncro'
): Promise<void> {
  const record = await db.stored_profiles.get(profileId);
  if (!record) return;
  
  const updated = { ...record.used_in_products };
  updated[product] = (updated[product] || 0) + 1;
  
  await db.stored_profiles.update(profileId, {
    used_in_products: updated,
    last_used_at: new Date()
  });
}

// ============= 删除 =============

export async function deleteStoredProfile(profileId: string): Promise<void> {
  await db.stored_profiles.delete(profileId);
}

// ============= 更新 display_name 或 relationship =============

export async function updateStoredProfileMeta(
  profileId: string,
  updates: { display_name?: string; relationship?: StoredProfileRecord['relationship'] }
): Promise<void> {
  const record = await db.stored_profiles.get(profileId);
  if (!record) return;
  
  await db.stored_profiles.update(profileId, {
    ...updates,
    last_used_at: new Date()
  });
}
```

```
2. 测试服务:

scripts/test-stored-profiles-service.ts(浏览器 dev 页面):
```

```typescript
import {
  listStoredProfiles,
  createStoredProfile,
  getStoredProfile,
  recordProfileUsage,
  deleteStoredProfile
} from '@/lib/profile/stored-profiles-service';

async function test() {
  console.log('=== Test 1: Create profile ===');
  const result1 = await createStoredProfile({
    birth_info: {
      year: 1977,
      month: 2,
      day: 17,
      hour: 3,
      minute: 0,
      gender: 'M',
      timezone: 'Asia/Shanghai',
      longitude: 121.4737,
      latitude: 31.2304,
      location_name: '上海'
    },
    display_name: '我自己',
    relationship: 'self'
  });
  console.log('Created:', result1.profile_id);
  console.log('Is duplicate:', result1.is_duplicate);  // false
  
  console.log('\n=== Test 2: Create same again (should be duplicate) ===');
  const result2 = await createStoredProfile({
    birth_info: {
      year: 1977,
      month: 2,
      day: 17,
      hour: 3,
      minute: 0,
      gender: 'M',
      timezone: 'Asia/Shanghai',
      longitude: 121.4737,
      latitude: 31.2304,
      location_name: '上海'
    },
    display_name: '我自己',
    relationship: 'self'
  });
  console.log('Returned:', result2.profile_id);
  console.log('Is duplicate:', result2.is_duplicate);  // true
  console.log('Same ID:', result1.profile_id === result2.profile_id);  // true
  
  console.log('\n=== Test 3: Create another person ===');
  const result3 = await createStoredProfile({
    birth_info: {
      year: 1985,
      month: 8,
      day: 20,
      hour: 14,
      minute: 30,
      gender: 'F',
      timezone: 'Asia/Shanghai',
      longitude: 121.4737,
      latitude: 31.2304,
      location_name: '上海'
    },
    display_name: '妻子',
    relationship: 'spouse'
  });
  console.log('Created:', result3.profile_id);
  
  console.log('\n=== Test 4: List profiles ===');
  const list = await listStoredProfiles();
  console.log('Count:', list.length);
  for (const p of list) {
    console.log(`  - ${p.display_name} (${p.relationship}): ${p.birth_date} ${p.birth_time}`);
    console.log(`    Used: POJU ${p.used_in_products.poju} times`);
  }
  
  console.log('\n=== Test 5: Get full data ===');
  const full = await getStoredProfile(result1.profile_id);
  console.log('Day master:', full?.user_profile.bazi.day_master);
  console.log('Has base analysis:', !!full?.base_analysis);
  
  console.log('\n=== Test 6: Record usage ===');
  await recordProfileUsage(result1.profile_id, 'poju');
  const updatedList = await listStoredProfiles();
  const updated = updatedList.find(p => p.profile_id === result1.profile_id);
  console.log('POJU usage count:', updated?.used_in_products.poju);  // 1
  
  console.log('\n=== Test 7: Cleanup ===');
  await deleteStoredProfile(result3.profile_id);
  const afterDelete = await listStoredProfiles();
  console.log('Count after delete:', afterDelete.length);
}
```

## 验证清单

```
□ stored-profiles-service.ts 完整实现
□ createStoredProfile 测试通过
□ 重复检测(birth_info_hash)工作
□ listStoredProfiles 按使用时间倒序
□ recordProfileUsage 计数正确
□ 多人记录管理工作
□ 贴出测试输出

🛑 等用户确认
```

---

# 第 4 部分:Step 3 - 八字选择/确认 UI 组件

## Step 3:components/profile/ProfileSelector.tsx

```
任务:

跨产品共用组件:
- 列出已保存的八字
- 让用户选择 / 添加新的 / 编辑已有
- 选已有 → 弹出【确认信息】框 → 确认后回调

完整代码:
```

```typescript
// components/profile/ProfileSelector.tsx

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  listStoredProfiles,
  createStoredProfile,
  getStoredProfile,
  recordProfileUsage,
  deleteStoredProfile,
  StoredProfileSummary
} from '@/lib/profile/stored-profiles-service';
import { BirthInfoForm } from '@/components/forms/BirthInfoForm';

interface Props {
  product: 'poju' | 'glyph' | 'syncro';
  onSelected: (profileId: string) => void;
  onCancel?: () => void;
  allowSkip?: boolean;
  onSkip?: () => void;
}

type Step = 'list' | 'confirm' | 'create' | 'edit';

export function ProfileSelector({ 
  product, 
  onSelected, 
  onCancel,
  allowSkip,
  onSkip 
}: Props) {
  const t = useTranslations('profile_selector');
  
  const [step, setStep] = useState<Step>('list');
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadProfiles();
  }, []);
  
  async function loadProfiles() {
    setLoading(true);
    try {
      const list = await listStoredProfiles();
      setProfiles(list);
      
      // 如果没有已保存的,直接进入创建
      if (list.length === 0) {
        setStep('create');
      } else {
        setStep('list');
      }
    } catch (e) {
      console.error('Failed to load profiles:', e);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleSelectExisting(profileId: string) {
    setSelectedProfileId(profileId);
    setStep('confirm');
  }
  
  async function handleConfirmAndContinue() {
    if (!selectedProfileId) return;
    
    // 记录使用
    await recordProfileUsage(selectedProfileId, product);
    
    // 通知父组件
    onSelected(selectedProfileId);
  }
  
  function handleAddNew() {
    setStep('create');
  }
  
  function handleEdit(profileId: string) {
    setEditingProfileId(profileId);
    setStep('edit');
  }
  
  async function handleDelete(profileId: string) {
    if (!confirm(t('confirm_delete'))) return;
    await deleteStoredProfile(profileId);
    await loadProfiles();
  }
  
  async function handleCreateComplete(profileId: string) {
    // 创建完成,记录使用
    await recordProfileUsage(profileId, product);
    onSelected(profileId);
  }
  
  if (loading) {
    return <div className="profile-selector loading">{t('loading')}</div>;
  }
  
  // ============= UI 渲染 =============
  
  return (
    <div className="profile-selector">
      {step === 'list' && (
        <ProfileListView
          profiles={profiles}
          onSelect={handleSelectExisting}
          onAddNew={handleAddNew}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCancel={onCancel}
          allowSkip={allowSkip}
          onSkip={onSkip}
        />
      )}
      
      {step === 'confirm' && selectedProfileId && (
        <ProfileConfirmView
          profileId={selectedProfileId}
          onConfirm={handleConfirmAndContinue}
          onBack={() => setStep('list')}
          onEdit={() => {
            setEditingProfileId(selectedProfileId);
            setStep('edit');
          }}
        />
      )}
      
      {step === 'create' && (
        <ProfileCreateView
          onComplete={handleCreateComplete}
          onCancel={() => {
            if (profiles.length > 0) {
              setStep('list');
            } else if (onCancel) {
              onCancel();
            }
          }}
          allowSkip={allowSkip}
          onSkip={onSkip}
        />
      )}
      
      {step === 'edit' && editingProfileId && (
        <ProfileEditView
          profileId={editingProfileId}
          onSaved={() => {
            setEditingProfileId(null);
            loadProfiles();
            setStep('list');
          }}
          onCancel={() => {
            setEditingProfileId(null);
            setStep('list');
          }}
        />
      )}
    </div>
  );
}

// ============= 子视图:列表 =============

function ProfileListView({ 
  profiles, 
  onSelect, 
  onAddNew, 
  onEdit, 
  onDelete,
  onCancel,
  allowSkip,
  onSkip
}: {
  profiles: StoredProfileSummary[];
  onSelect: (id: string) => void;
  onAddNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onCancel?: () => void;
  allowSkip?: boolean;
  onSkip?: () => void;
}) {
  const t = useTranslations('profile_selector');
  
  return (
    <div className="profile-list-view">
      <h2 className="title">{t('list_title')}</h2>
      <p className="description">{t('list_description')}</p>
      
      <div className="profiles-list">
        {profiles.map(p => (
          <ProfileCard
            key={p.profile_id}
            profile={p}
            onSelect={() => onSelect(p.profile_id)}
            onEdit={() => onEdit(p.profile_id)}
            onDelete={() => onDelete(p.profile_id)}
          />
        ))}
        
        <button className="add-new-card" onClick={onAddNew}>
          <span className="plus">+</span>
          <span>{t('add_new')}</span>
        </button>
      </div>
      
      <div className="footer-actions">
        {allowSkip && onSkip && (
          <button className="skip-button" onClick={onSkip}>
            {t('skip_for_now')}
          </button>
        )}
        {onCancel && (
          <button className="cancel-button" onClick={onCancel}>
            {t('cancel')}
          </button>
        )}
      </div>
    </div>
  );
}

// ============= 子视图:卡片 =============

function ProfileCard({ 
  profile, 
  onSelect, 
  onEdit, 
  onDelete 
}: {
  profile: StoredProfileSummary;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('profile_selector');
  
  const relationshipLabels: Record<string, string> = {
    self: t('rel_self'),
    spouse: t('rel_spouse'),
    child: t('rel_child'),
    parent: t('rel_parent'),
    sibling: t('rel_sibling'),
    friend: t('rel_friend'),
    other: t('rel_other')
  };
  
  return (
    <div className="profile-card">
      <div className="card-main" onClick={onSelect}>
        <div className="card-name">
          {profile.display_name}
          <span className="relationship">({relationshipLabels[profile.relationship] || profile.relationship})</span>
        </div>
        <div className="card-birth">
          {profile.birth_date} · {profile.birth_time} · {profile.gender === 'M' ? t('male') : t('female')}
        </div>
        <div className="card-meta">
          {profile.location_name}
          {profile.has_base_analysis && (
            <span className="badge analyzed">{t('analyzed')}</span>
          )}
        </div>
        <div className="card-usage">
          {profile.used_in_products.poju > 0 && <span>POJU: {profile.used_in_products.poju}</span>}
          {profile.used_in_products.glyph > 0 && <span>Glyph: {profile.used_in_products.glyph}</span>}
          {profile.used_in_products.syncro > 0 && <span>Syncro: {profile.used_in_products.syncro}</span>}
        </div>
      </div>
      <div className="card-actions">
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }}>{t('edit')}</button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="danger">{t('delete')}</button>
      </div>
    </div>
  );
}

// ============= 子视图:确认 =============

function ProfileConfirmView({ 
  profileId, 
  onConfirm, 
  onBack,
  onEdit
}: {
  profileId: string;
  onConfirm: () => void;
  onBack: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations('profile_selector');
  const [data, setData] = useState<any>(null);
  
  useEffect(() => {
    getStoredProfile(profileId).then(setData);
  }, [profileId]);
  
  if (!data) return <div>Loading...</div>;
  
  const birth = data.birth_info;
  
  return (
    <div className="profile-confirm-view">
      <h2>{t('confirm_title')}</h2>
      <p>{t('confirm_description')}</p>
      
      <div className="confirm-info-card">
        <div className="info-row">
          <span className="label">{t('birth_date_label')}:</span>
          <span className="value">{birth.year} - {birth.month} - {birth.day}</span>
        </div>
        <div className="info-row">
          <span className="label">{t('birth_time_label')}:</span>
          <span className="value">{birth.hour} : {String(birth.minute).padStart(2, '0')}</span>
        </div>
        <div className="info-row">
          <span className="label">{t('birth_location_label')}:</span>
          <span className="value">{birth.location_name || `${birth.longitude}, ${birth.latitude}`}</span>
        </div>
        <div className="info-row">
          <span className="label">{t('gender_label')}:</span>
          <span className="value">{birth.gender === 'M' ? t('male') : t('female')}</span>
        </div>
      </div>
      
      <p className="reassure">{t('confirm_reassure')}</p>
      
      <div className="confirm-actions">
        <button onClick={onBack} className="secondary">{t('back_to_list')}</button>
        <button onClick={onEdit} className="secondary">{t('edit_this')}</button>
        <button onClick={onConfirm} className="primary">{t('confirm_and_continue')}</button>
      </div>
    </div>
  );
}

// ============= 子视图:创建 =============

function ProfileCreateView({ 
  onComplete, 
  onCancel,
  allowSkip,
  onSkip 
}: {
  onComplete: (profileId: string) => void;
  onCancel?: () => void;
  allowSkip?: boolean;
  onSkip?: () => void;
}) {
  const t = useTranslations('profile_selector');
  const [displayName, setDisplayName] = useState('我自己');
  const [relationship, setRelationship] = useState<any>('self');
  const [showBirthForm, setShowBirthForm] = useState(false);
  
  async function handleBirthSubmit(birthInput: any) {
    const result = await createStoredProfile({
      birth_info: {
        ...birthInput,
        location_name: birthInput.location_name || ''
      },
      display_name: displayName,
      relationship
    });
    
    onComplete(result.profile_id);
  }
  
  if (!showBirthForm) {
    return (
      <div className="profile-create-view-step1">
        <h2>{t('create_title')}</h2>
        <p>{t('create_description')}</p>
        
        <div className="form-group">
          <label>{t('display_name_label')}</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={t('display_name_placeholder')}
          />
        </div>
        
        <div className="form-group">
          <label>{t('relationship_label')}</label>
          <select value={relationship} onChange={e => setRelationship(e.target.value)}>
            <option value="self">{t('rel_self')}</option>
            <option value="spouse">{t('rel_spouse')}</option>
            <option value="child">{t('rel_child')}</option>
            <option value="parent">{t('rel_parent')}</option>
            <option value="sibling">{t('rel_sibling')}</option>
            <option value="friend">{t('rel_friend')}</option>
            <option value="other">{t('rel_other')}</option>
          </select>
        </div>
        
        <div className="actions">
          {onCancel && <button onClick={onCancel} className="secondary">{t('cancel')}</button>}
          {allowSkip && onSkip && (
            <button onClick={onSkip} className="secondary">{t('skip_for_now')}</button>
          )}
          <button onClick={() => setShowBirthForm(true)} className="primary">
            {t('next_enter_birth')}
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="profile-create-view-step2">
      <BirthInfoForm
        onComplete={(birthInput: any) => handleBirthSubmit(birthInput)}
        onSkip={onSkip}
        allowSkip={allowSkip}
        context="in_poju"
      />
    </div>
  );
}

// ============= 子视图:编辑(同 create,但预填)=============

function ProfileEditView({ 
  profileId, 
  onSaved, 
  onCancel 
}: {
  profileId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  // 简化:实际可以复用 ProfileCreateView,
  // 但 BirthInfoForm 需要支持 defaultValues
  // 这里给出最简版本
  
  const t = useTranslations('profile_selector');
  
  return (
    <div className="profile-edit-view">
      <h2>{t('edit_title')}</h2>
      <p>Edit feature coming soon. For now, delete and recreate.</p>
      <button onClick={onCancel}>{t('back')}</button>
    </div>
  );
}
```

```
2. 翻译文件 messages/{locale}/profile_selector.json:

en:
{
  "loading": "Loading...",
  "list_title": "Choose whose birth info to use",
  "list_description": "Select a saved profile, or add a new one.",
  "add_new": "Add new person",
  "skip_for_now": "Skip for now",
  "cancel": "Cancel",
  
  "confirm_title": "Confirm this profile",
  "confirm_description": "Please review the information below before continuing.",
  "birth_date_label": "Birth Date",
  "birth_time_label": "Birth Time",
  "birth_location_label": "Location",
  "gender_label": "Gender",
  "male": "Male",
  "female": "Female",
  "confirm_reassure": "Your data stays on this device and is encrypted.",
  "back_to_list": "Back",
  "edit_this": "Edit",
  "confirm_and_continue": "Yes, this is correct",
  
  "create_title": "Add a new person",
  "create_description": "Save their birth info so you can use it across all products.",
  "display_name_label": "Display Name",
  "display_name_placeholder": "e.g., Myself, My spouse",
  "relationship_label": "Relationship",
  "rel_self": "Myself",
  "rel_spouse": "Spouse",
  "rel_child": "Child",
  "rel_parent": "Parent",
  "rel_sibling": "Sibling",
  "rel_friend": "Friend",
  "rel_other": "Other",
  "next_enter_birth": "Next: Birth Info",
  
  "edit_title": "Edit profile",
  "back": "Back",
  
  "edit": "Edit",
  "delete": "Delete",
  "confirm_delete": "Permanently delete this profile? This cannot be undone.",
  "analyzed": "Analyzed"
}

zh:
{
  "loading": "加载中...",
  "list_title": "选择要使用的八字信息",
  "list_description": "选择一个已保存的人物,或添加新人。",
  "add_new": "添加新人",
  "skip_for_now": "暂时跳过",
  "cancel": "取消",
  
  "confirm_title": "确认信息",
  "confirm_description": "请确认下面的信息后继续。",
  "birth_date_label": "出生日期",
  "birth_time_label": "出生时辰",
  "birth_location_label": "出生地",
  "gender_label": "性别",
  "male": "男",
  "female": "女",
  "confirm_reassure": "你的数据只保存在本地设备,已加密。",
  "back_to_list": "返回列表",
  "edit_this": "编辑",
  "confirm_and_continue": "信息正确,继续",
  
  "create_title": "添加新人",
  "create_description": "保存此人的八字信息,在所有产品中复用。",
  "display_name_label": "显示名称",
  "display_name_placeholder": "如:我自己、配偶",
  "relationship_label": "关系",
  "rel_self": "我自己",
  "rel_spouse": "配偶",
  "rel_child": "孩子",
  "rel_parent": "父母",
  "rel_sibling": "兄弟姐妹",
  "rel_friend": "朋友",
  "rel_other": "其他",
  "next_enter_birth": "下一步:填写八字",
  
  "edit_title": "编辑",
  "back": "返回",
  
  "edit": "编辑",
  "delete": "删除",
  "confirm_delete": "确定永久删除此档案吗?",
  "analyzed": "已分析"
}

(es / fr / de 同样结构,Cursor 翻译)
```

```
3. 样式 styles/profile-selector.css:
```

```css
/* 不在文档中赘述完整 CSS,Cursor 参考已有样式扩展 */
/* 关键类名:
.profile-selector
.profile-list-view
.profile-card
.profile-card.selected
.add-new-card
.profile-confirm-view
.confirm-info-card
.info-row
*/
```

```
4. 测试:
   - 在 /dev/test-profile-selector 临时页面
   - 验证 4 个 step 切换正确
   - 创建 2-3 个人物
   - 选择 → 确认 → 回调
   - 编辑 → 显示占位(P1 完善)
   - 删除 → 列表更新
```

## 验证清单

```
□ ProfileSelector 组件完整
□ 4 个子视图(list/confirm/create/edit)
□ 5 语言翻译
□ 选择 → 确认 → 回调流畅
□ 添加新人 → 创建流程
□ 已有列表显示使用次数
□ 删除有二次确认

🛑 等用户确认
```

---

# 第 5 部分:Step 4 - Agent 状态机重写

## Step 4:lib/poju/agent-state.ts

```
任务:

定义 Agent 真正的状态机。
这是 Agent ≠ Chatbot 的关键。

完整代码:
```

```typescript
// lib/poju/agent-state.ts

/**
 * POJU Agent 真正的状态机
 * 
 * 关键设计:
 * 1. 状态是【硬性】的(代码管控)
 * 2. LLM 在每轮输出【建议下一状态】
 * 3. 代码根据 LLM 输出 + 规则决定是否切换
 */

// ============= 6 个核心阶段 =============

export type AgentPhase = 
  | 'greeting'                  // 阶段 A: 闲聊 + 引导
  | 'awaiting_profile'          // 阶段 B: 等待八字
  | 'collecting_context'        // 阶段 C: 深入问诊
  | 'awaiting_confirmation'     // 阶段 D: 信息总结确认
  | 'delivered'                 // 阶段 E: 已交付,等待用户反馈
  | 'tracking';                 // 阶段 F: 追踪 + 反馈

// ============= Agent 完整状态 =============

export interface POJUAgentState {
  // 当前阶段
  current_phase: AgentPhase;
  
  // 用户原始问题(付款时填的)
  original_question: string;
  
  // 选择的 stored_profile ID(填表后)
  selected_profile_id: string | null;
  
  // 是否已生成 base_analysis(命主基础分析)
  has_base_analysis: boolean;
  
  // 用户是否选择跳过 profile
  profile_skipped: boolean;
  
  // 问题分类(LLM 第一轮判断)
  question_category: 
    | 'career'
    | 'relationship'
    | 'wealth'
    | 'health'
    | 'family'
    | 'decision'
    | 'interpersonal'
    | 'other'
    | null;
  
  // 已收集的上下文(结构化)
  context_collected: ContextCollection;
  
  // 收集完成度(0-1)
  collection_completeness: number;
  
  // 用户在 awaiting_confirmation 阶段的最新汇总
  current_summary: ContextSummary | null;
  
  // 是否已生成深度困境分析(每次问题调一次)
  has_situation_analysis: boolean;
  
  // 行动建议
  actions: POJUAction[];
  
  // 主交付信息
  main_delivery_at: string | null;
  main_delivery_data: any | null;
  
  // 监控
  turn_count: number;
  tokens_used: number;
  
  // 阶段切换历史(用于调试)
  phase_history: Array<{
    from_phase: AgentPhase;
    to_phase: AgentPhase;
    triggered_at: string;
    reason: string;
  }>;
}

// ============= 上下文收集(结构化字段)=============

export interface ContextCollection {
  // 通用字段(所有问题类型都收集)
  duration: string | null;           // 问题持续多久
  trigger_event: string | null;      // 触发事件
  emotional_state: string | null;    // 当前情绪状态
  what_tried: string[];              // 尝试过什么
  desired_outcome: string | null;    // 期望结果
  
  // 问题类型特定字段(按 question_category 填充)
  category_specific: Record<string, any>;
}

// ============= 问题类型必需字段 =============

export const REQUIRED_FIELDS_BY_CATEGORY: Record<string, string[]> = {
  career: [
    'current_role',           // 当前角色/职位
    'years_experience',       // 经验年数
    'industry',               // 行业
    'specific_issue',         // 具体困境
    'duration_of_issue',      // 困境持续时间
    'workplace_relationships', // 职场关系
    'financial_situation',    // 财务状况
    'family_support',         // 家庭支持
    'desired_outcome'         // 期望结果
  ],
  
  relationship: [
    'relationship_type',      // 关系类型
    'relationship_duration',  // 关系持续时间
    'specific_issue',
    'frequency',              // 问题频率
    'key_incidents',          // 关键事件
    'tried_to_resolve',
    'other_party_perspective', // 对方视角
    'commitment_level',       // 投入程度
    'desired_outcome'
  ],
  
  wealth: [
    'current_situation',
    'specific_concern',
    'income_source',
    'debts',
    'investments',
    'risk_tolerance',
    'time_horizon',
    'family_obligations',
    'desired_outcome'
  ],
  
  health: [
    'health_concern',
    'duration',
    'severity',
    'lifestyle_factors',
    'tried_treatments',
    'stress_level',
    'family_history',
    'desired_outcome'
  ],
  
  family: [
    'family_member',
    'specific_issue',
    'duration',
    'tried_approaches',
    'other_members_involved',
    'cultural_context',
    'desired_outcome'
  ],
  
  decision: [
    'decision_topic',
    'options',
    'deadline',
    'stakes',
    'who_else_affected',
    'gut_feeling',
    'fears',
    'desired_outcome'
  ],
  
  interpersonal: [
    'situation',
    'people_involved',
    'duration',
    'specific_incidents',
    'tried',
    'desired_outcome'
  ],
  
  other: [
    'situation_description',
    'duration',
    'context',
    'tried',
    'desired_outcome'
  ]
};

// ============= 信息总结 =============

export interface ContextSummary {
  generated_at: string;
  category: string;
  
  // 结构化汇总,每个字段都可编辑
  sections: Array<{
    section_id: string;
    title: string;       // 比如 "你的处境"
    items: Array<{
      item_id: string;
      label: string;     // 比如 "当前角色"
      value: string;     // 比如 "后端工程师"
      field_key: string; // 对应 context_collected 中的字段
    }>;
  }>;
}

// ============= 行动 =============

export interface POJUAction {
  action_id: string;
  category: 'traditional_fengshui' | 'traditional_lifestyle' | 'modern_decisive' | 'modern_reflective';
  text: string;
  timing: 'immediate' | 'this_week' | 'this_month' | 'ongoing';
  rationale: string;
  
  // 对应命理依据(可选,用于内部跟踪)
  fengshui_basis?: string;
  
  // 用户反馈
  status: 'pending' | 'in_progress' | 'completed' | 'modified' | 'skipped';
  user_feedback?: string;
  updated_at?: string;
}

// ============= 创建初始状态 =============

export function createInitialAgentState(input: {
  original_question: string;
}): POJUAgentState {
  return {
    current_phase: 'greeting',
    original_question: input.original_question,
    selected_profile_id: null,
    has_base_analysis: false,
    profile_skipped: false,
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

// ============= 计算完成度 =============

export function calculateCompleteness(state: POJUAgentState): number {
  if (!state.question_category) return 0;
  
  const required = REQUIRED_FIELDS_BY_CATEGORY[state.question_category] || [];
  if (required.length === 0) return 0;
  
  // 通用字段权重 30%
  const generalFields = ['duration', 'trigger_event', 'emotional_state', 'desired_outcome'];
  let generalFilled = 0;
  for (const field of generalFields) {
    if (state.context_collected[field as keyof ContextCollection]) {
      generalFilled++;
    }
  }
  const generalScore = (generalFilled / generalFields.length) * 0.3;
  
  // what_tried 权重 10%
  const triedScore = state.context_collected.what_tried.length > 0 ? 0.1 : 0;
  
  // 类型特定字段权重 60%
  let categoryFilled = 0;
  for (const field of required) {
    if (state.context_collected.category_specific[field]) {
      categoryFilled++;
    }
  }
  const categoryScore = (categoryFilled / required.length) * 0.6;
  
  return Math.min(1, generalScore + triedScore + categoryScore);
}

// ============= 找出缺失字段(用于 Prompt 注入)=============

export function findMissingFields(state: POJUAgentState): {
  general: string[];
  category_specific: string[];
} {
  const missing = {
    general: [] as string[],
    category_specific: [] as string[]
  };
  
  // 通用字段
  const generalFields = ['duration', 'trigger_event', 'emotional_state', 'desired_outcome'];
  for (const field of generalFields) {
    if (!state.context_collected[field as keyof ContextCollection]) {
      missing.general.push(field);
    }
  }
  if (state.context_collected.what_tried.length === 0) {
    missing.general.push('what_tried');
  }
  
  // 类型特定
  if (state.question_category) {
    const required = REQUIRED_FIELDS_BY_CATEGORY[state.question_category] || [];
    for (const field of required) {
      if (!state.context_collected.category_specific[field]) {
        missing.category_specific.push(field);
      }
    }
  }
  
  return missing;
}

// ============= 阶段切换决策 =============

export interface PhaseTransitionInput {
  current_state: POJUAgentState;
  llm_suggested_phase: AgentPhase | null;
  user_message: string;
}

export interface PhaseTransitionResult {
  should_transition: boolean;
  new_phase: AgentPhase;
  reason: string;
}

export function decidePhaseTransition(input: PhaseTransitionInput): PhaseTransitionResult {
  const { current_state, llm_suggested_phase, user_message } = input;
  const current = current_state.current_phase;
  
  // 规则 1: 用户明确请求特定操作(强制覆盖)
  
  // "I want to add my birth info" / "我想填出生信息" 之类
  if (/(?:want|like|let me|i'll).{0,30}(?:provide|add|fill|enter).{0,20}(?:birth|profile|info)|想.{0,5}(?:填|提供|输入).{0,5}(?:出生|八字|信息)/i.test(user_message)) {
    if (!current_state.selected_profile_id) {
      return {
        should_transition: true,
        new_phase: 'awaiting_profile',
        reason: 'User explicitly requested to provide birth info'
      };
    }
  }
  
  // "Give me the analysis now" / "现在给我分析" 之类
  if (/(?:give|tell|show).{0,20}(?:analysis|reading|advice|recommendation)|现在.{0,5}(?:给我|告诉我).{0,5}(?:分析|建议|结论)/i.test(user_message)) {
    if (current === 'collecting_context' && current_state.collection_completeness >= 0.5) {
      return {
        should_transition: true,
        new_phase: 'awaiting_confirmation',
        reason: 'User explicitly requested delivery'
      };
    }
  }
  
  // 规则 2: 阶段切换条件
  
  switch (current) {
    case 'greeting':
      // 进入 awaiting_profile 的条件:
      // - 用户表达了实质困境(LLM 判断)
      // - 或 LLM 建议
      if (
        llm_suggested_phase === 'awaiting_profile' ||
        llm_suggested_phase === 'collecting_context'
      ) {
        // 如果用户没填 profile 也没跳过 → awaiting_profile
        if (!current_state.selected_profile_id && !current_state.profile_skipped) {
          return {
            should_transition: true,
            new_phase: 'awaiting_profile',
            reason: 'LLM detected substantive concern, requesting profile'
          };
        }
        // 已有 profile → 直接进入 collecting_context
        return {
          should_transition: true,
          new_phase: 'collecting_context',
          reason: 'Profile already exists, starting context collection'
        };
      }
      break;
    
    case 'awaiting_profile':
      // 进入 collecting_context 的条件:
      // - 用户完成了 profile 选择
      if (current_state.selected_profile_id || current_state.profile_skipped) {
        return {
          should_transition: true,
          new_phase: 'collecting_context',
          reason: 'Profile selected or skipped, starting context collection'
        };
      }
      break;
    
    case 'collecting_context':
      // 进入 awaiting_confirmation 的条件:
      // - 完成度 >= 0.7 (LLM 也可以建议)
      // - 或 LLM 建议
      if (
        current_state.collection_completeness >= 0.7 ||
        llm_suggested_phase === 'awaiting_confirmation'
      ) {
        return {
          should_transition: true,
          new_phase: 'awaiting_confirmation',
          reason: `Collection sufficient (${(current_state.collection_completeness * 100).toFixed(0)}%)`
        };
      }
      break;
    
    case 'awaiting_confirmation':
      // 用户点"补充" → 回 collecting_context
      // 用户点"确认" → delivered
      // 这些通过 UI 按钮触发,不在 LLM 判断范围
      if (llm_suggested_phase === 'collecting_context') {
        return {
          should_transition: true,
          new_phase: 'collecting_context',
          reason: 'User wants to add more context'
        };
      }
      if (llm_suggested_phase === 'delivered') {
        return {
          should_transition: true,
          new_phase: 'delivered',
          reason: 'User confirmed, generating delivery'
        };
      }
      break;
    
    case 'delivered':
      // 用户后续消息 → tracking
      return {
        should_transition: true,
        new_phase: 'tracking',
        reason: 'Main delivery done, entering tracking mode'
      };
    
    case 'tracking':
      // 一般不切换
      break;
  }
  
  // 默认:不切换
  return {
    should_transition: false,
    new_phase: current,
    reason: 'No transition condition met'
  };
}

// ============= 应用阶段切换 =============

export function applyPhaseTransition(
  state: POJUAgentState,
  transition: PhaseTransitionResult
): POJUAgentState {
  if (!transition.should_transition) return state;
  
  return {
    ...state,
    current_phase: transition.new_phase,
    phase_history: [
      ...state.phase_history,
      {
        from_phase: state.current_phase,
        to_phase: transition.new_phase,
        triggered_at: new Date().toISOString(),
        reason: transition.reason
      }
    ]
  };
}
```

## 验证清单

```
□ agent-state.ts 完整实现
□ 6 个 phase 定义清晰
□ REQUIRED_FIELDS_BY_CATEGORY 框架完整
□ calculateCompleteness 公式合理
□ findMissingFields 工作
□ decidePhaseTransition 覆盖所有阶段
□ 强制切换规则(用户明确请求)工作

🛑 等用户确认
```

---

# 第 6 部分:Step 5 - 上下文提取器

## Step 5:lib/poju/context-extractor.ts

```
任务:

LLM 每轮提取的 context_updates 需要正确合并到 state。
这是 Agent 记忆的核心。

完整代码:
```

```typescript
// lib/poju/context-extractor.ts

import type { POJUAgentState, ContextCollection } from './agent-state';
import { calculateCompleteness } from './agent-state';

/**
 * LLM 每轮输出的 context_updates 结构
 */
export interface LLMContextUpdates {
  // 通用字段
  duration?: string;
  trigger_event?: string;
  emotional_state?: string;
  what_tried?: string | string[];  // 可能是新增的尝试
  desired_outcome?: string;
  
  // 类型特定字段(LLM 自由填充)
  [key: string]: any;
}

/**
 * 合并 LLM 提取的 context 到 state
 */
export function mergeContextUpdates(
  state: POJUAgentState,
  updates: LLMContextUpdates
): POJUAgentState {
  if (!updates || typeof updates !== 'object') return state;
  
  const newCollected: ContextCollection = {
    ...state.context_collected,
    category_specific: { ...state.context_collected.category_specific }
  };
  
  // 通用字段
  if (updates.duration && typeof updates.duration === 'string') {
    newCollected.duration = updates.duration;
  }
  if (updates.trigger_event && typeof updates.trigger_event === 'string') {
    newCollected.trigger_event = updates.trigger_event;
  }
  if (updates.emotional_state && typeof updates.emotional_state === 'string') {
    newCollected.emotional_state = updates.emotional_state;
  }
  if (updates.desired_outcome && typeof updates.desired_outcome === 'string') {
    newCollected.desired_outcome = updates.desired_outcome;
  }
  
  // what_tried (数组累加)
  if (updates.what_tried) {
    const newTried = Array.isArray(updates.what_tried) 
      ? updates.what_tried 
      : [updates.what_tried];
    
    for (const item of newTried) {
      if (typeof item === 'string' && item.trim() && !newCollected.what_tried.includes(item)) {
        newCollected.what_tried = [...newCollected.what_tried, item];
      }
    }
  }
  
  // 类型特定字段
  const generalKeys = new Set([
    'duration', 'trigger_event', 'emotional_state', 'what_tried', 'desired_outcome'
  ]);
  
  for (const [key, value] of Object.entries(updates)) {
    if (generalKeys.has(key)) continue;
    
    // 字符串类型直接覆盖
    if (typeof value === 'string' && value.trim()) {
      newCollected.category_specific[key] = value;
    }
    // 数组类型累加
    else if (Array.isArray(value)) {
      const existing = newCollected.category_specific[key];
      if (Array.isArray(existing)) {
        const merged = [...existing];
        for (const item of value) {
          if (!merged.includes(item)) merged.push(item);
        }
        newCollected.category_specific[key] = merged;
      } else {
        newCollected.category_specific[key] = value;
      }
    }
    // 数字 / 布尔
    else if (typeof value === 'number' || typeof value === 'boolean') {
      newCollected.category_specific[key] = value;
    }
  }
  
  const newState = {
    ...state,
    context_collected: newCollected
  };
  
  // 重新计算完成度
  newState.collection_completeness = calculateCompleteness(newState);
  
  return newState;
}

/**
 * 把 context_collected 格式化为 prompt 注入文本
 */
export function formatContextForPrompt(state: POJUAgentState): string {
  const c = state.context_collected;
  const sections: string[] = [];
  
  // 通用部分
  if (c.duration) sections.push(`Duration: ${c.duration}`);
  if (c.trigger_event) sections.push(`Trigger event: ${c.trigger_event}`);
  if (c.emotional_state) sections.push(`Emotional state: ${c.emotional_state}`);
  if (c.what_tried.length > 0) {
    sections.push(`What's been tried:\n${c.what_tried.map(t => `  - ${t}`).join('\n')}`);
  }
  if (c.desired_outcome) sections.push(`Desired outcome: ${c.desired_outcome}`);
  
  // 类型特定
  const specificEntries = Object.entries(c.category_specific);
  if (specificEntries.length > 0) {
    sections.push(`\nSpecific context:`);
    for (const [key, value] of specificEntries) {
      const valueStr = Array.isArray(value) ? value.join('; ') : String(value);
      sections.push(`  ${formatFieldName(key)}: ${valueStr}`);
    }
  }
  
  if (sections.length === 0) {
    return '(no context collected yet)';
  }
  
  return sections.join('\n');
}

/**
 * 把缺失字段格式化为 prompt 注入文本
 */
export function formatMissingFieldsForPrompt(missingFields: {
  general: string[];
  category_specific: string[];
}): string {
  const lines: string[] = [];
  
  if (missingFields.general.length > 0) {
    lines.push(`General fields still needed:`);
    for (const f of missingFields.general) {
      lines.push(`  - ${formatFieldName(f)}`);
    }
  }
  
  if (missingFields.category_specific.length > 0) {
    lines.push(`Category-specific fields still needed:`);
    for (const f of missingFields.category_specific) {
      lines.push(`  - ${formatFieldName(f)}`);
    }
  }
  
  if (lines.length === 0) return '(all fields collected!)';
  
  return lines.join('\n');
}

function formatFieldName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
```

## 验证清单

```
□ mergeContextUpdates 正确合并
□ what_tried 数组去重累加
□ formatContextForPrompt 输出可读
□ 完成度自动重算
□ 缺失字段输出清晰

🛑 等用户确认
```

---

# 第 7 部分:Step 6 - Agent 主入口重写

## Step 6:lib/poju/agent.ts(完全重写)

```
任务:

⚠️ 这一步完全重写 agent.ts
先 git commit 当前版本备份

新 agent.ts 整合:
- AgentState 状态机
- ContextExtractor
- 阶段切换
- LLM 调用

完整代码:
```

```typescript
// lib/poju/agent.ts (完全重写)

import { checkRuleViolation, getRuleRejectionMessage } from './rules';
import { 
  POJUAgentState,
  decidePhaseTransition,
  applyPhaseTransition,
  findMissingFields,
  AgentPhase
} from './agent-state';
import { mergeContextUpdates, LLMContextUpdates } from './context-extractor';
import type { StoredProfileData } from '@/lib/db/poju-db';

// ============= 输入输出类型 =============

export interface AgentInput {
  state: POJUAgentState;
  user_message: string;
  selected_profile: StoredProfileData | null;
  locale: string;
}

export interface AgentOutput {
  // 给用户的回复
  response: string;
  
  // 是否拒绝(规则层)
  is_rejected: boolean;
  rejection_type?: string;
  
  // 新状态
  new_state: POJUAgentState;
  
  // UI 触发信号
  ui_signals: {
    show_profile_selector: boolean;
    show_confirmation_ui: boolean;
    show_main_delivery: boolean;
  };
  
  // 调试信息
  debug: {
    phase_before: AgentPhase;
    phase_after: AgentPhase;
    phase_transition_reason?: string;
    completeness_before: number;
    completeness_after: number;
    llm_call_count: number;
    total_cost_usd: number;
  };
}

// ============= 主入口 =============

export async function handleUserMessage(input: AgentInput): Promise<AgentOutput> {
  const { state, user_message, selected_profile, locale } = input;
  
  const debug = {
    phase_before: state.current_phase,
    phase_after: state.current_phase,
    phase_transition_reason: undefined as string | undefined,
    completeness_before: state.collection_completeness,
    completeness_after: state.collection_completeness,
    llm_call_count: 0,
    total_cost_usd: 0
  };
  
  // ============= Layer 1: 规则层 =============
  
  const ruleCheck = checkRuleViolation(user_message, state as any);
  if (ruleCheck.violated) {
    return {
      response: getRuleRejectionMessage(ruleCheck.type!, locale),
      is_rejected: true,
      rejection_type: ruleCheck.type,
      new_state: {
        ...state,
        turn_count: state.turn_count + 1
      },
      ui_signals: {
        show_profile_selector: false,
        show_confirmation_ui: false,
        show_main_delivery: false
      },
      debug
    };
  }
  
  // ============= Layer 2: 调用 LLM(根据当前阶段)=============
  
  const llmResult = await callPhaseSpecificLLM({
    state,
    user_message,
    selected_profile,
    locale
  });
  
  debug.llm_call_count = llmResult.call_count;
  debug.total_cost_usd = llmResult.total_cost;
  
  // ============= Layer 3: 合并 context 更新 =============
  
  let updatedState = state;
  
  if (llmResult.context_updates) {
    updatedState = mergeContextUpdates(updatedState, llmResult.context_updates);
  }
  
  // 如果 LLM 提供了 question_category 且当前还未确定
  if (llmResult.question_category && !updatedState.question_category) {
    updatedState = {
      ...updatedState,
      question_category: llmResult.question_category
    };
  }
  
  // 如果 LLM 提供了 current_summary(在 awaiting_confirmation 阶段)
  if (llmResult.current_summary) {
    updatedState = {
      ...updatedState,
      current_summary: llmResult.current_summary
    };
  }
  
  // 如果 LLM 输出了主交付(在 delivered 阶段)
  if (llmResult.main_delivery_data) {
    updatedState = {
      ...updatedState,
      main_delivery_data: llmResult.main_delivery_data,
      main_delivery_at: new Date().toISOString(),
      actions: llmResult.actions || []
    };
  }
  
  debug.completeness_after = updatedState.collection_completeness;
  
  // ============= Layer 4: 阶段切换决策 =============
  
  const transition = decidePhaseTransition({
    current_state: updatedState,
    llm_suggested_phase: llmResult.suggested_phase,
    user_message
  });
  
  if (transition.should_transition) {
    updatedState = applyPhaseTransition(updatedState, transition);
    debug.phase_after = transition.new_phase;
    debug.phase_transition_reason = transition.reason;
  }
  
  // ============= Layer 5: 增加 turn_count + tokens =============
  
  updatedState = {
    ...updatedState,
    turn_count: updatedState.turn_count + 1,
    tokens_used: updatedState.tokens_used + llmResult.tokens_used
  };
  
  // ============= Layer 6: UI 触发信号 =============
  
  const uiSignals = {
    show_profile_selector: 
      updatedState.current_phase === 'awaiting_profile' &&
      !updatedState.selected_profile_id &&
      !updatedState.profile_skipped,
    
    show_confirmation_ui:
      updatedState.current_phase === 'awaiting_confirmation' &&
      !!updatedState.current_summary,
    
    show_main_delivery:
      updatedState.current_phase === 'delivered' &&
      !!updatedState.main_delivery_data
  };
  
  return {
    response: llmResult.response,
    is_rejected: false,
    new_state: updatedState,
    ui_signals: uiSignals,
    debug
  };
}

// ============= 根据阶段调用对应 LLM =============

import { callGreetingPhase } from '@/lib/llm/phases/greeting-phase';
import { callCollectingPhase } from '@/lib/llm/phases/collecting-phase';
import { callConfirmationPhase } from '@/lib/llm/phases/confirmation-phase';
import { callDeliveryPhase } from '@/lib/llm/phases/delivery-phase';
import { callTrackingPhase } from '@/lib/llm/phases/tracking-phase';

interface PhaseLLMResult {
  response: string;
  suggested_phase: AgentPhase | null;
  context_updates: LLMContextUpdates | null;
  question_category: any;
  current_summary: any;
  main_delivery_data: any;
  actions: any[];
  tokens_used: number;
  total_cost: number;
  call_count: number;
}

async function callPhaseSpecificLLM(input: AgentInput): Promise<PhaseLLMResult> {
  const phase = input.state.current_phase;
  
  switch (phase) {
    case 'greeting':
      return await callGreetingPhase(input);
    
    case 'awaiting_profile':
      // 等待用户操作 UI(选 profile),不调 LLM
      // 如果用户在这阶段发消息,用 greeting prompt 应对
      return await callGreetingPhase(input);
    
    case 'collecting_context':
      return await callCollectingPhase(input);
    
    case 'awaiting_confirmation':
      return await callConfirmationPhase(input);
    
    case 'delivered':
      return await callDeliveryPhase(input);
    
    case 'tracking':
      return await callTrackingPhase(input);
    
    default:
      return await callGreetingPhase(input);
  }
}
```

## 验证清单

```
□ agent.ts 完全重写
□ 5 个 phase-specific LLM 调用入口
□ context 合并 + 完成度更新
□ 阶段切换决策应用
□ UI 信号正确输出
□ 不破坏现有 API(暂时)

🛑 等用户确认进入 Step 7(具体 phase prompts)
```

---

# 第 8 部分:Step 7 - DeepSeek 基础分析(只调一次)

## Step 7:lib/llm/deepseek/base-analysis.ts

```
任务:

⭐ 这是 DeepSeek 第 1 次调用
仅在选择八字后立即生成
保存到 stored_profiles.base_analysis(永久缓存)

完整代码:
```

```typescript
// lib/llm/deepseek/base-analysis.ts

import { callLLM } from '@/lib/llm/router';
import { saveBaseAnalysis, getStoredProfile } from '@/lib/profile/stored-profiles-service';
import type { StoredProfileData } from '@/lib/db/poju-db';

// ============= System Prompt =============

function buildBaseAnalysisPrompt(profile: any): { system: string; user: string } {
  const system = `# 角色

你是一位拥有 30 年经验的资深中国传统命理学专家,精通《渊海子平》《滴天髓》《三命通会》《穷通宝鉴》。
你的任务是根据用户的八字排盘,生成一份【命主基础分析】。

# 重要说明

这是【命主基础分析】,不针对任何具体问题。
后续遇到具体问题时,会调用另一份"困境分析"。
你这次的输出会被【永久缓存】,所以要:
- 输出完整
- 覆盖命主的核心维度
- 不留遗漏

# 输出格式(严格 JSON,无 markdown)

{
  "命主基础": {
    "日主分析": "300-500 字。日主天干及其五行特征。结合月令、地支藏干、刑冲合害,深度分析。",
    
    "格局判断": {
      "主格": "如:正官格、食神格、伤官格、偏财格 等",
      "格局成败": "成格 / 破格 / 半成格",
      "格局解读": "200-400 字。这个格局对人生大方向的影响。",
      "辅格": "如有,描述辅格"
    },
    
    "用神忌神": {
      "用神": "用神五行(wood/fire/earth/metal/water)",
      "忌神": "忌神五行",
      "喜神": "喜神(可选)",
      "用神解释": "300-400 字。为什么是这个用神。如何扶持用神、制忌神。"
    },
    
    "强弱定性": "strong | balanced | weak",
    
    "命局亮点": [
      "5-8 条。比如:'年柱天德贵人,出生时家族能量强'",
      "'食神透干,创造力旺盛'",
      "等。每条 50-80 字。"
    ],
    
    "命局隐忧": [
      "3-5 条。比如:'日主弱、官杀重,易在权威面前过度妥协'",
      "每条 50-80 字。"
    ]
  },
  
  "性格画像": {
    "天性特征": [
      "5-8 条具体特征。",
      "不是'乐观/开朗'这种泛话。",
      "应该是'在压力下倾向于隐忍,但内心累积的不满会以冷淡方式表达'这种深度。"
    ],
    "天赋能力": [
      "3-5 条天赋能力,基于命理结构。"
    ],
    "性格盲点": [
      "3-5 条容易忽视的性格盲点。"
    ]
  },
  
  "人生主题": {
    "事业方向": "200-400 字。命局支持的事业方向。",
    "财富特征": "150-300 字。财星结构对财富的影响。",
    "婚恋特征": "150-300 字。配偶宫和夫妻星的影响。",
    "健康注意": "150-300 字。命局中需要注意的健康方向。",
    "贵人方位": "100-200 字。基于神煞和方位。"
  },
  
  "大运全程": {
    "起运说明": "起运年龄 + 起运时间含义",
    "大运按时序解读": [
      {
        "时段": "如 5-14 岁 / 1981-1990",
        "干支": "如 癸卯",
        "十神": "如 偏印",
        "主题": "100-200 字。这十年的主题。"
      }
      // 重复 8-10 个大运
    ]
  },
  
  "当前大运详解": {
    "时段": "...",
    "干支": "...",
    "十神": "...",
    "主题": "300-500 字。当前所处大运的深度解读。",
    "三大变化": [
      "本期的 3 个核心变化"
    ],
    "关键时间窗": [
      "本大运中需要特别关注的流年(2-3 个)"
    ]
  },
  
  "传统调候建议": {
    "推荐方位": [
      "基于用神的方位。如:用神为水,推荐 N(北)、E(东)。"
    ],
    "推荐颜色": [
      "基于用神的颜色"
    ],
    "推荐物件": [
      "5-8 个具体物件。如:'书桌北侧放置流水摆件',养鱼 1/6 条等。"
    ],
    "推荐居住朝向": "...",
    "推荐生活方位": "如'生活在水边、河边、海边对你最有利'",
    "需要规避的": "..."
  },
  
  "_meta": {
    "model": "deepseek-v4-pro",
    "version": "v1.0"
  }
}

# 写作要求

- 全部中文输出
- 总字数 5000-8000 字
- 极其具体,不空话
- 严格 JSON,无 markdown 包裹`;

  const userPrompt = `
【八字排盘数据】

四柱:
  年柱: ${profile.bazi.year.stem}${profile.bazi.year.branch}
  月柱: ${profile.bazi.month.stem}${profile.bazi.month.branch}
  日柱: ${profile.bazi.day.stem}${profile.bazi.day.branch}(日主)
  时柱: ${profile.bazi.hour.stem}${profile.bazi.hour.branch}

日主: ${profile.bazi.day_master}(${profile.bazi.day_master_element})

五行分布:
  金: ${profile.five_elements.metal.score} (${(profile.five_elements.metal.ratio * 100).toFixed(0)}%)
  木: ${profile.five_elements.wood.score} (${(profile.five_elements.wood.ratio * 100).toFixed(0)}%)
  水: ${profile.five_elements.water.score} (${(profile.five_elements.water.ratio * 100).toFixed(0)}%)
  火: ${profile.five_elements.fire.score} (${(profile.five_elements.fire.ratio * 100).toFixed(0)}%)
  土: ${profile.five_elements.earth.score} (${(profile.five_elements.earth.ratio * 100).toFixed(0)}%)

日主强弱: ${profile.five_elements.day_master_strength}
主导五行: ${profile.five_elements.dominant}

简化用神: ${profile.yong_shen?.primary} (忌神: ${profile.yong_shen?.ji_shen})

大运列表:
${profile.da_yun.list.map((d: any, i: number) => 
  `  ${i + 1}. ${d.stem}${d.branch} (${d.year_range[0]}-${d.year_range[1]}, 年龄 ${d.age_range[0]}-${d.age_range[1]}, 主星 ${d.ten_god})${d.is_current ? ' ← 当前' : ''}`
).join('\n')}

起运: ${profile.da_yun.start_age_text}

神煞:
${profile.spirits?.by_pillar?.year ? `  年柱: ${profile.spirits.by_pillar.year.join(', ')}` : ''}
${profile.spirits?.by_pillar?.month ? `  月柱: ${profile.spirits.by_pillar.month.join(', ')}` : ''}
${profile.spirits?.by_pillar?.day ? `  日柱: ${profile.spirits.by_pillar.day.join(', ')}` : ''}
${profile.spirits?.by_pillar?.hour ? `  时柱: ${profile.spirits.by_pillar.hour.join(', ')}` : ''}

刑冲合害:
  天干: ${profile.relations?.stems?.join(', ') || '(无)'}
  地支: ${profile.relations?.branches?.join(', ') || '(无)'}

【任务】
基于以上八字,生成命主基础分析(JSON 格式,中文)。

记住:
- 你只被调用这一次
- 输出要完整、深度、具体
- 这份分析后续会被永久缓存使用`;

  return { system, user: userPrompt };
}

// ============= 主函数 =============

export async function generateBaseAnalysis(profileId: string): Promise<any> {
  // 1. 加载 profile
  const data = await getStoredProfile(profileId);
  if (!data) throw new Error('Profile not found');
  
  // 2. 如果已有 base_analysis,直接返回
  if (data.base_analysis?.content) {
    console.log('[base-analysis] Using cached base analysis');
    return data.base_analysis.content;
  }
  
  // 3. 构建 prompt
  const { system, user } = buildBaseAnalysisPrompt(data.user_profile);
  
  // 4. 调用 DeepSeek
  console.log('[base-analysis] Generating fresh base analysis via DeepSeek...');
  const result = await callLLM({
    call_type: 'deep_analysis',
    system,
    messages: [{ role: 'user', content: user }],
    max_tokens: 15000,
    thinking_effort: 'high',
    response_format: 'json'
  });
  
  // 5. 解析 JSON
  let analysis: any;
  try {
    const cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    analysis = JSON.parse(cleaned);
  } catch (e: any) {
    console.error('[base-analysis] JSON parse failed:', e.message);
    console.error('Raw content (first 500):', result.content.slice(0, 500));
    throw new Error('Base analysis output is not valid JSON');
  }
  
  // 6. 保存到 stored_profiles
  await saveBaseAnalysis(profileId, analysis, {
    model: result.actual_model,
    tokens_used: result.meta.tokens_used
  });
  
  console.log('[base-analysis] Saved to stored_profiles');
  
  return analysis;
}

export async function getBaseAnalysisOrGenerate(profileId: string): Promise<any> {
  const data = await getStoredProfile(profileId);
  if (!data) throw new Error('Profile not found');
  
  if (data.base_analysis?.content) {
    return data.base_analysis.content;
  }
  
  return await generateBaseAnalysis(profileId);
}
```

## 验证清单

```
□ base-analysis.ts 完整实现
□ Prompt 覆盖命主所有维度
□ 输出 5000-8000 字
□ 严格 JSON 格式
□ 永久缓存到 stored_profiles
□ 二次调用直接用缓存
□ 测试输出质量【极高】

🛑 等用户审视基础分析的【完整性 + 深度】
   这是命理一切的基础
```

---

# 第 9 部分:Step 8 - DeepSeek 困境分析(每次问题调一次)

## Step 8:lib/llm/deepseek/situation-analysis.ts

```
任务:

⭐ DeepSeek 第 2 类调用
当用户的问题信息收集完整时调用
针对【具体困境】生成深度分析

完整代码:
```

```typescript
// lib/llm/deepseek/situation-analysis.ts

import { callLLM } from '@/lib/llm/router';
import type { POJUAgentState } from '@/lib/poju/agent-state';
import { formatContextForPrompt } from '@/lib/poju/context-extractor';

function buildSituationAnalysisPrompt(input: {
  base_analysis: any;
  state: POJUAgentState;
}): { system: string; user: string } {
  
  const { base_analysis, state } = input;
  const contextText = formatContextForPrompt(state);
  
  const system = `# 角色

你是中国传统命理学 + 风水学 + 易经的资深专家。
你已经看过【命主基础分析】,现在需要针对【具体困境】生成深度分析。

# 你的任务

结合命主基础 + 用户具体处境,做一次【针对性深度分析】。
输出将作为后续【最终交付】的输入。

# 输出格式(严格 JSON,中文,无 markdown)

{
  "困境本质": {
    "用户描述的问题": "用一句话复述用户的核心问题",
    "命理视角的本质": "200-400 字。从命理角度,这个问题的本质是什么。",
    "为什么会发生": "200-400 字。基于命主结构 + 当前大运 + 流年,为什么会出现这个困境。"
  },
  
  "用户处境深度解读": {
    "命局如何映射处境": "300-500 字。用户提供的具体处境(职位、关系、事件等)如何对应命理结构。",
    "命主优势在此事中": [
      "3-5 条。命主在此问题上有的天然优势。"
    ],
    "命主挑战在此事中": [
      "3-5 条。命主在此问题上的天然挑战。"
    ],
    "用户没意识到的动力": [
      "3-5 条。用户可能没意识到的内在/外在动力。"
    ]
  },
  
  "破局之路": {
    "核心破局方向": "300-500 字。基于命理 + 用户实际处境,破局的核心方向。",
    
    "时机判断": {
      "当前时机": "现在适合做什么 / 不适合做什么",
      "未来 3 个月": "...",
      "未来 1 年": "...",
      "关键转折时间点": ["具体时间点"]
    },
    
    "需要的内在转变": "300-500 字。用户自己需要先转变什么。",
    
    "需要的外在调整": "200-400 字。环境、关系、行动等的调整。"
  },
  
  "传统行动建议": {
    "调候建议": [
      {
        "类别": "方位 / 颜色 / 物件 / 居所 / 名字",
        "具体建议": "极其具体。比如:'在书房西北角放置一个水族箱,养 1 条黑色金鱼。书桌朝向北方'",
        "命理依据": "为什么这样做",
        "实施难度": "easy / medium / hard"
      }
      // 5-8 条
    ],
    
    "日常风水细节": [
      "比如:'家门口保持干净,不要堆杂物'",
      "比如:'房顶的横梁不要压床,可用红丝带遮挡或换床位'",
      "比如:'办公桌椅背后要有墙,避免无依靠'",
      "5-8 条非常具体的传统风水建议"
    ],
    
    "搬迁/装修方向": "如果适合搬家或装修,具体方向",
    
    "改名建议": "如果命局需要,改名或起字号的方向"
  },
  
  "现代实操建议": {
    "决策性行动": [
      {
        "行动": "比如:'本周三上午 9-11 点,主动联系老板请求一对一谈话'",
        "具体内容": "具体说什么 / 做什么",
        "时机": "immediate / this_week / this_month / ongoing",
        "依据": "为什么这样做(命理 + 现实)"
      }
      // 3-5 条
    ],
    
    "反思性行动": [
      {
        "行动": "比如:'每天晚上 9 点,5 分钟书写练习,写下今天哪一刻让你感到真实'",
        "时长": "每次 5-30 分钟",
        "频率": "每天 / 每周",
        "依据": "..."
      }
      // 2-3 条
    ]
  },
  
  "关键警示": [
    "3-5 条最关键的警示,用户必须注意的事项"
  ],
  
  "_meta": {
    "model": "deepseek-v4-pro",
    "version": "v1.0",
    "question_category": "${state.question_category}"
  }
}

# 写作要求

- 全部中文
- 极其具体,可执行
- "行动"必须有【时间 + 内容 + 依据】三要素
- 总字数 5000-8000
- 严格 JSON`;

  const userPrompt = `
【命主基础分析(已有)】

${JSON.stringify(base_analysis, null, 2).slice(0, 4000)}
...(截断,完整版本已在内存中)

【用户原始问题】
"${state.original_question}"

【问题类别】
${state.question_category || 'other'}

【收集到的具体上下文】
${contextText}

【任务】
基于以上,生成【针对此次困境的深度分析】。
重点是:
1. 真正具体到用户的处境
2. 行动建议必须实操(养鱼/朝向/物件/搬家方向等)
3. 包括传统风水 + 现代心理 + 行为
4. 严格 JSON`;

  return { system, user: userPrompt };
}

// ============= 主函数 =============

export async function generateSituationAnalysis(input: {
  base_analysis: any;
  state: POJUAgentState;
}): Promise<any> {
  
  const { system, user } = buildSituationAnalysisPrompt(input);
  
  console.log('[situation-analysis] Generating via DeepSeek...');
  const result = await callLLM({
    call_type: 'deep_analysis',
    system,
    messages: [{ role: 'user', content: user }],
    max_tokens: 15000,
    thinking_effort: 'high',
    response_format: 'json'
  });
  
  // 解析
  let analysis: any;
  try {
    const cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    analysis = JSON.parse(cleaned);
  } catch (e: any) {
    console.error('[situation-analysis] JSON parse failed:', e.message);
    throw new Error('Situation analysis output is not valid JSON');
  }
  
  return analysis;
}
```

## 验证清单

```
□ situation-analysis.ts 完整实现
□ 输入 base_analysis + context
□ 输出包含传统建议 + 现代实操
□ 传统建议覆盖方位/物件/居所/改名
□ 现代实操包含具体时间/内容
□ 测试质量

🛑 等用户审视
```

---

# 第 10 部分:Step 9 - 最终交付(Pro 翻译)

## Step 9:lib/llm/pro/final-delivery.ts

```
任务:

⭐ Gemini Pro 调用,只在最终交付时
输入:base_analysis + situation_analysis + 完整 context
输出:用户语言的【最终交付】

完整代码:
```

```typescript
// lib/llm/pro/final-delivery.ts

import { callLLM } from '@/lib/llm/router';
import type { POJUAgentState } from '@/lib/poju/agent-state';
import { formatContextForPrompt } from '@/lib/poju/context-extractor';

function buildFinalDeliveryPrompt(input: {
  base_analysis: any;
  situation_analysis: any;
  state: POJUAgentState;
  locale: string;
}): { system: string; user: string } {
  
  const { base_analysis, situation_analysis, state, locale } = input;
  
  const system = `# YOU ARE POJU (Final Delivery Mode)

This is the most important moment. The user paid $9.99 for this analysis. 
After many rounds of conversation, they have confirmed their situation summary.
Now you deliver the complete analysis + actionable recommendations.

# YOU HAVE TWO EXPERT ANALYSES (in Chinese)

## 1. Base Analysis (the user's astrological foundation)
${JSON.stringify(base_analysis, null, 2).slice(0, 3000)}
...

## 2. Situation Analysis (specific to their current question)
${JSON.stringify(situation_analysis, null, 2).slice(0, 3000)}
...

# YOUR JOB

TRANSLATE + INTEGRATE these into a complete, structured delivery in the user's language.

You are NOT generating new astrological insights. The Chinese experts already did that.
You are:
1. Organizing the insights for the user
2. Translating cultural context
3. Making actions feel natural and doable
4. Delivering in their language with warmth

# OUTPUT STRUCTURE

Use ═══ markers between sections (UI will render).
Total length: 1000-1500 words.

[Warm 2-3 sentence opening, acknowledging their journey through the conversation]

═══ ANALYSIS ═══

[400-600 words]
- Connect their pattern to their situation (from situation_analysis)
- Surface dynamics they may not see
- Honor what they shared in conversation
- Reference SPECIFIC things they told you

═══ CONCLUSION ═══

[150-250 words]
- What's really happening (plain language)
- A perspective shift
- Acknowledge their agency

═══ WHAT TO DO ═══

You provide 3 actions across 3 categories.

### Action 1: Traditional Fengshui Remedy
Based on the situation_analysis 传统行动建议.

The user paid for traditional Chinese wisdom. Give them SPECIFIC fengshui/element advice:
- Place [specific object] in [specific direction] in [specific room]
- Wear [specific color] when [specific situation]
- Sit [specific direction] when [specific activity]
- Keep [specific area] clean / free of obstructions
- Consider moving to [specific direction] city
- Beam over your bed? → put red ribbon / move bed

[80-120 words]
Be CONCRETE. Reference real items, real directions, real rooms.

Example (water yong shen):
"Place a small aquarium with 1 black fish in the north corner of your bedroom. 
Choose Sunday at 9am to set it up. The fish doesn't need to be fancy — a 
single goldfish in a glass bowl works. Why: water energy supports your natural 
flow when you're in this 10-year phase. Notice if you sleep better."

### Action 2: Modern Decisive Action
Based on situation_analysis 现代实操建议.决策性行动.

[80-120 words]
Specific time + specific person + specific words + specific outcome to notice.

Example:
"Tomorrow before 11am, send your manager this exact message on Slack:
'Could we schedule a 30-minute conversation this week? I'd like to discuss 
my growth path. What time works for you?'
Send exactly this. Don't add explanations. Notice their response time."

### Action 3: Modern Reflective Practice
Based on situation_analysis 现代实操建议.反思性行动.

[80-120 words]
Specific duration + specific prompt + when + where.

Example:
"This Friday at 6pm, set a 30-minute timer. With pen and paper (not screen), 
write down 3 things you would do if money weren't an issue. Don't filter. 
Don't share. Fold the paper and put it in your wallet. Carry it for a week."

═══ COMING BACK ═══

[60-100 words]
Invite them back. Set expectation: "Come back in 1-2 weeks. Tell me what 
happened — what worked, what didn't, what surprised you. I'll be here."

# CRITICAL RULES

1. USER'S LANGUAGE
   Detect from conversation. Respond in that language. 
   If they spoke Chinese, use Chinese. If English, English.

2. NO TECHNICAL TERMS
   ❌ Bazi, 八字, eight characters
   ❌ Five Elements, 五行
   ❌ Day Master, 日主
   ❌ Yong shen, 用神
   ❌ Da yun, 大运
   ❌ Hexagram, 卦
   ❌ 十神
   
   ✓ "Your natural pattern is..."
   ✓ "There's a tension in your makeup..."
   ✓ "Your current life chapter..."
   ✓ "Your strength shows in..."

3. ACTIONS MUST BE SPECIFIC
   ❌ "Communicate better with your boss"
   ❌ "Trust your intuition"
   ❌ "Take care of yourself"
   
   ✓ Time + Action + Content + Outcome
   ✓ Reference real-world items, places, words

4. INTEGRATE TRADITIONAL + MODERN
   Action 1 = traditional fengshui (water tank, beams, doorway)
   Action 2 = modern decisive (specific conversation)
   Action 3 = modern reflective (specific solo practice)

5. NO PREDICTION
   ❌ "You will succeed"
   ❌ "This will work out"
   ✓ "What you've shared suggests possibilities..."
   ✓ "If you take this path, watch for..."

# OUTPUT

Generate the complete delivery now. Use the user's language.
Use ═══ markers between sections (will be parsed by UI).`;

  const conversationLog = formatContextForPrompt(state);
  
  const userPrompt = `User's original question: "${state.original_question}"

User's confirmed situation summary:
${JSON.stringify(state.current_summary, null, 2)}

User's full context collected:
${conversationLog}

Detected user language: (auto-detect from their messages)
Session locale: ${locale}

Generate the complete delivery now. Use ═══ markers.`;

  return { system, user: userPrompt };
}

// ============= 主函数 =============

export interface FinalDeliveryResult {
  full_text: string;        // 完整文本(含 ═══ 标记)
  actions: any[];           // 解析出的 3 个 actions
  model: string;
  tokens_used: number;
  cost_usd: number;
  latency_ms: number;
}

export async function generateFinalDelivery(input: {
  base_analysis: any;
  situation_analysis: any;
  state: POJUAgentState;
  locale: string;
}): Promise<FinalDeliveryResult> {
  
  const { system, user } = buildFinalDeliveryPrompt(input);
  
  console.log('[final-delivery] Generating via Gemini Pro thinking...');
  const result = await callLLM({
    call_type: 'main_delivery',
    system,
    messages: [{ role: 'user', content: user }],
    max_tokens: 8000,
    thinking_effort: 'high'
  });
  
  // 提取 actions(从 situation_analysis 的 传统行动建议 + 现代实操建议)
  const actions = extractActionsFromDelivery(
    result.content,
    input.situation_analysis
  );
  
  return {
    full_text: result.content,
    actions,
    model: result.actual_model,
    tokens_used: result.meta.tokens_used,
    cost_usd: result.meta.cost_usd || 0,
    latency_ms: result.meta.latency_ms
  };
}

// ============= 行动提取 =============

function extractActionsFromDelivery(
  fullText: string,
  situationAnalysis: any
): any[] {
  const actions: any[] = [];
  
  // 从 fullText 中查找 Action 1/2/3 段落
  const actionMatches = fullText.matchAll(/###\s*Action\s*(\d+)[\s\S]*?(?=###\s*Action|\n═══|$)/gi);
  
  let idx = 0;
  for (const match of actionMatches) {
    const actionText = match[0];
    
    // 根据顺序判断 category
    let category: string;
    if (idx === 0) category = 'traditional_fengshui';
    else if (idx === 1) category = 'modern_decisive';
    else category = 'modern_reflective';
    
    // 从 situation_analysis 中找对应的 rationale
    let rationale = '';
    if (category === 'traditional_fengshui' && situationAnalysis.传统行动建议?.调候建议?.[0]) {
      rationale = situationAnalysis.传统行动建议.调候建议[0].命理依据 || '';
    } else if (category === 'modern_decisive' && situationAnalysis.现代实操建议?.决策性行动?.[0]) {
      rationale = situationAnalysis.现代实操建议.决策性行动[0].依据 || '';
    } else if (category === 'modern_reflective' && situationAnalysis.现代实操建议?.反思性行动?.[0]) {
      rationale = situationAnalysis.现代实操建议.反思性行动[0].依据 || '';
    }
    
    actions.push({
      action_id: `action_${Date.now()}_${idx}`,
      category,
      text: actionText.replace(/^###\s*Action\s*\d+[:：]?\s*/i, '').trim(),
      timing: 'this_week',
      rationale,
      status: 'pending'
    });
    
    idx++;
  }
  
  return actions;
}
```

## 验证清单

```
□ final-delivery.ts 实现
□ Pro thinking 调用配置正确
□ Action 1 是传统风水(具体物件/方位)
□ Action 2 是现代决策(具体对话)
□ Action 3 是现代反思(具体练习)
□ 用户语言匹配
□ 无技术术语
□ 5 段结构清晰

🛑 等用户审视最终交付质量
   质量 = $9.99 价值感
```

---

# 第 11 部分:Step 10 - Greeting 阶段 Prompt(护栏完整)

## Step 10:lib/llm/phases/greeting-phase.ts

```
任务:

⚠️ 这一步要彻底解决幻觉问题。

要点:
1. 严禁主观判断("你其实...")
2. 严禁未来时态("你会...")
3. 严禁个人特质("你的天性...")
4. 只允许中性问诊

完整代码:
```

```typescript
// lib/llm/phases/greeting-phase.ts

import { callLLM } from '@/lib/llm/router';
import type { AgentInput } from '@/lib/poju/agent';
import type { AgentPhase } from '@/lib/poju/agent-state';

export interface PhaseLLMResult {
  response: string;
  suggested_phase: AgentPhase | null;
  context_updates: any;
  question_category: any;
  current_summary: any;
  main_delivery_data: any;
  actions: any[];
  tokens_used: number;
  total_cost: number;
  call_count: number;
}

export async function callGreetingPhase(input: AgentInput): Promise<PhaseLLMResult> {
  const { state, user_message, locale } = input;
  
  const system = buildGreetingSystemPrompt({ state, locale });
  
  // 准备消息历史
  const messages = formatMessageHistory(input);
  
  // 调用 Flash
  const result = await callLLM({
    call_type: 'chat_flash',
    system,
    messages,
    max_tokens: 1500,
    response_format: 'json'
  });
  
  // 解析 JSON
  let parsed: any;
  try {
    const cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('[greeting-phase] JSON parse failed:', e);
    parsed = {
      response: result.content,
      suggested_phase: null,
      context_updates: {},
      question_category: null
    };
  }
  
  // 应用 hallucination guard(双层保护)
  parsed.response = sanitizeResponse(parsed.response, state);
  
  return {
    response: parsed.response,
    suggested_phase: parsed.suggested_phase || null,
    context_updates: parsed.context_updates || null,
    question_category: parsed.question_category || null,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.meta.tokens_used,
    total_cost: result.meta.cost_usd || 0,
    call_count: 1
  };
}

// ============= System Prompt =============

function buildGreetingSystemPrompt(input: { state: any; locale: string }): string {
  const { state, locale } = input;
  
  return `# YOU ARE POJU (Greeting & Engagement Phase)

You are POJU, an AI thinking partner on the pojulife platform.
The user has paid $9.99 to start this session with this question:
"${state.original_question}"

You are at the EARLY STAGE of conversation. You do NOT have:
- Their astrological profile (no birth info yet)
- Any deep analysis
- Detailed knowledge of their situation

# YOUR GOAL IN THIS PHASE

1. Greet warmly if they say hello
2. Listen attentively if they share concern
3. Ask thoughtful, NEUTRAL questions to understand the situation
4. When they've shared substantive concern → suggest moving to "awaiting_profile"

# 🚨 ABSOLUTE FORBIDDEN BEHAVIORS

You DO NOT have their profile. You CANNOT make these statements:

❌ "Your natural pattern is..." (no profile data!)
❌ "Your personality tends to..."
❌ "In your makeup, there's..."
❌ "You're typically..."
❌ "Your strength is..."
❌ "Your nature/天性/天然..."
❌ "From what I see in you..."
❌ "You're not lacking action ability..."
❌ "你其实是一个生命力很强、很有主见的人"  ← THIS IS HALLUCINATION
❌ "从你的个人特质来看"  ← HALLUCINATION  
❌ "你的能量分布"  ← HALLUCINATION
❌ Future predictions ("You will succeed")
❌ Cosmic claims ("The energy is right for...")
❌ Personality claims about a person you've never met

# ✅ WHAT YOU CAN DO

✓ Acknowledge what they said
✓ Ask neutral questions
✓ Mirror back their words
✓ Identify topics neutrally ("You mentioned career...")
✓ Express empathy ("That sounds frustrating")

# 💬 RESPONSE LANGUAGE

Detect from user's input. Respond in same language.
Their original_question was: "${state.original_question}"
${detectInitialLanguage(state.original_question)}

# 🔄 PHASE PROGRESSION

When user has shared substantive concern (not just "hi"), suggest "awaiting_profile".
Substantive concern means:
- A specific area of life is mentioned (career, relationship, money, health, family, decision)
- AND they express some level of difficulty or question
- AND it's beyond a 1-word greeting

Examples of substantive (suggest awaiting_profile):
✓ "I've been feeling stuck in my career"
✓ "我和我老婆最近总是吵架"
✓ "I'm thinking of quitting my job"
✓ "我感觉很迷茫,不知道该往哪走"

Examples of NOT substantive (stay in greeting):
✗ "Hi"
✗ "你好"
✗ "How are you"
✗ "今天天气真好"
✗ "Are you smart?"

# 🎯 CONTEXT EXTRACTION

If user shares anything substantive, extract initial context.
Be conservative — only extract what's EXPLICITLY stated.

Example:
User: "I've been feeling stuck in my career for 6 months"
Extract:
  question_category: "career"
  context_updates: {
    duration: "6 months",
    emotional_state: "feeling stuck"
  }

# OUTPUT FORMAT (strict JSON)

\`\`\`json
{
  "response": "Your reply to the user. In their language. 50-150 words. Natural, warm, NEUTRAL. No personality claims.",
  
  "suggested_phase": "greeting" | "awaiting_profile" | null,
  
  "question_category": "career" | "relationship" | "wealth" | "health" | "family" | "decision" | "interpersonal" | "other" | null,
  
  "context_updates": {
    // Only extract EXPLICITLY stated facts
    // Don't infer or imagine
  }
}
\`\`\`

# EXAMPLES

## Example 1: User says "你好"
\`\`\`json
{
  "response": "你好。我是 POJU。你之前提到想问\\"${state.original_question}\\"——我已经记下来了。\\n\\n我们可以慢慢聊。你能多说说现在的情况吗?发生了什么让你想来问这个问题?",
  "suggested_phase": "greeting",
  "question_category": null,
  "context_updates": {}
}
\`\`\`

## Example 2: User shares concern (NO personality claims!)
User: "我事业上感觉很迷茫,好几年了都没赚到钱"

WRONG (HALLUCINATION):
\`\`\`json
{
  "response": "在你的模式中,你其实是一个生命力很强、很有主见的人..."
}
\`\`\`

RIGHT (NEUTRAL):
\`\`\`json
{
  "response": "几年的事业迷茫是相当沉重的事。我想了解更多——\\n\\n你说的'没赚到钱',能再具体一点吗?是收入不稳定、入不敷出、还是积累不起来?\\n\\n这几年你具体在做什么类型的工作?",
  "suggested_phase": "awaiting_profile",
  "question_category": "career",
  "context_updates": {
    "duration": "几年",
    "emotional_state": "迷茫"
  }
}
\`\`\`

## Example 3: User off-topic
User: "What's the weather today?"

\`\`\`json
{
  "response": "I focus on your original question — about \\"${state.original_question}\\". Want to come back to that?",
  "suggested_phase": "greeting",
  "question_category": null,
  "context_updates": {}
}
\`\`\`

# 🔒 FINAL CHECK BEFORE OUTPUT

Before writing your response, ask yourself:
1. Did I claim anything about their personality/nature/天性? → If yes, REWRITE
2. Did I make any future prediction? → If yes, REMOVE
3. Did I say "I see in you that..."? → If yes, REPHRASE as questions
4. Am I making cosmic/energetic claims? → If yes, REMOVE

If unsure: ASK A QUESTION instead of making a claim.`;
}

// ============= 双层保护:Response Sanitizer =============

const HALLUCINATION_PATTERNS = [
  // 中文模式
  /(?:你|您).{0,5}(?:其实|本质上|天性|内在|实际上).{0,10}(?:是|有|具有|表现|展现)/,
  /(?:你|您)(?:的|本)(?:个人特质|天性|天然|本性|本质|内在|能量|气质|气场)/,
  /从你(?:的)?(?:个人|内在|表现|状态).{0,5}(?:看|来看)/,
  /(?:你|您)(?:不缺|不缺乏|有|具有).{0,10}(?:力|能力|天赋|特质)/,
  /在你(?:的)?(?:模式|气场|内核|本质|结构)中/,
  /(?:你|您).{0,5}(?:擅长|不擅长|天生)/,
  
  // 英文模式
  /Your\s+(?:natural|true|inner|essential|fundamental)\s+(?:nature|pattern|self|essence|tendency)/i,
  /You\s+(?:are\s+typically|tend\s+to\s+be|naturally|inherently)/i,
  /In\s+your\s+(?:makeup|nature|essence|pattern|energy)/i,
  /From\s+what\s+I\s+see\s+in\s+you/i,
  /Your\s+(?:strength|gift|talent)\s+(?:is|lies)/i,
  
  // 未来时
  /You\s+will\s+(?:succeed|fail|achieve|find|encounter)/i,
  /(?:你|您)?(?:将会|必将|肯定会|会).{0,10}(?:成功|失败|遇到|获得)/,
  
  // 命理术语暴露
  /(?:八字|五行|日主|大运|十神|卦|爻|用神|忌神)/,
  /(?:bazi|wu\s*xing|day\s*master|da\s*yun|ten\s*gods|hexagram|yong\s*shen)/i
];

function sanitizeResponse(response: string, state: any): string {
  if (!response) return response;
  
  // 如果用户【未】提供 profile,且【未】跳过 profile,严格检查
  const hasProfile = !!state.selected_profile_id;
  const skipped = state.profile_skipped;
  
  if (hasProfile || skipped) {
    // 在有 profile 后,稍微宽松(但仍然不能暴露命理术语)
    let cleaned = response;
    for (const pattern of HALLUCINATION_PATTERNS.slice(-2)) {  // 只检查命理术语
      cleaned = cleaned.replace(pattern, '[modern translation needed]');
    }
    return cleaned;
  }
  
  // 无 profile 阶段:严格替换
  let issues = 0;
  for (const pattern of HALLUCINATION_PATTERNS) {
    if (pattern.test(response)) {
      issues++;
    }
  }
  
  // 如果有 2+ 处幻觉,整段替换为安全回复
  if (issues >= 2) {
    console.warn('[sanitizer] Too many hallucination patterns detected, replacing response');
    return getSafeFallbackResponse(state);
  }
  
  // 1 处幻觉:尝试替换那一句
  let cleaned = response;
  for (const pattern of HALLUCINATION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // 清理多余空格、连字符
  cleaned = cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/[—。,]{2,}/g, '。')
    .trim();
  
  return cleaned || getSafeFallbackResponse(state);
}

function getSafeFallbackResponse(state: any): string {
  const safe = {
    en: `I hear you. Tell me more — what specifically is happening, and how long has it been like this?`,
    zh: `我听到了。能多告诉我一些吗——具体发生了什么?这种情况持续多久了?`,
    es: `Te escucho. Cuéntame más — ¿qué está pasando específicamente, y desde hace cuánto?`,
    fr: `Je vous entends. Dites-m'en plus — qu'est-ce qui se passe spécifiquement, et depuis combien de temps?`,
    de: `Ich höre Sie. Erzählen Sie mehr — was passiert genau, und wie lange schon?`
  };
  
  // 简单语言检测(基于 original_question)
  const q = state.original_question || '';
  if (/[\u4e00-\u9fa5]/.test(q)) return safe.zh;
  if (/[áéíóúñ]/.test(q)) return safe.es;
  if (/[àâäéèê]/.test(q)) return safe.fr;
  if (/[äöüß]/.test(q)) return safe.de;
  return safe.en;
}

// ============= 辅助:语言提示 =============

function detectInitialLanguage(text: string): string {
  if (!text) return 'Likely English.';
  
  if (/[\u4e00-\u9fa5]/.test(text)) return 'User wrote in Chinese — respond in Chinese.';
  if (/[áéíóúñ¿¡]/i.test(text)) return 'User wrote in Spanish — respond in Spanish.';
  if (/[àâäéèêëîïôöùûüÿç]/i.test(text)) return 'User wrote in French — respond in French.';
  if (/[äöüß]/i.test(text)) return 'User wrote in German — respond in German.';
  return 'User wrote in English — respond in English.';
}

// ============= 辅助:格式化消息历史 =============

function formatMessageHistory(input: AgentInput): any[] {
  const messages: any[] = [];
  
  // 我们没有完整 messages 数组(在 state 中),
  // 这里假设 state 中有 conversation history
  // 实际实现时,从 session messages 取
  
  messages.push({
    role: 'user',
    content: input.user_message
  });
  
  return messages;
}
```

## 验证清单

```
□ greeting-phase.ts 完整实现
□ Prompt 包含完整禁止行为示例
□ Response sanitizer 双层保护
□ HALLUCINATION_PATTERNS 覆盖中英文
□ 2+ 幻觉自动替换为 safe fallback
□ 测试:
   * 用户说"我事业上感觉迷茫"
   * LLM 不再输出"你其实有生命力"
   * 而是问尖锐问题

🛑 等用户测试 Greeting 阶段质量
   关键:与原对话日志对比,幻觉消除
```

---

# 第 12 部分:Part 1 完成

```
本 Part 1 完成内容:

✅ Step 0: 问题分析 + 自查
✅ Step 1: stored_profiles 表
✅ Step 2: 八字管理服务(跨产品)
✅ Step 3: ProfileSelector UI
✅ Step 4: Agent 状态机(6 phase + 强制切换)
✅ Step 5: ContextExtractor(完成度计算)
✅ Step 6: Agent 主入口重写
✅ Step 7: DeepSeek 基础分析(永久缓存)
✅ Step 8: DeepSeek 困境分析(每次问题)
✅ Step 9: Gemini Pro 最终交付
✅ Step 10: Greeting Phase + 幻觉双层保护

下一部分(Part 2)将覆盖:
- Step 11: Collecting Phase Prompt
- Step 12: Confirmation Phase Prompt
- Step 13: Delivery Phase 流程
- Step 14: Tracking Phase Prompt
- Step 15: ContextSummary Editor UI
- Step 16: Main Delivery 渲染
- Step 17: POJUChatUI 完整改造
- Step 18: 服务端门控强化(响应改写)
- Step 19: API 路由完整改造
- Step 20: 端到端 14 Stage 完整测试
- Step 21: 上线检查
```

---

**Cursor: 完成 Step 0-10 后,通知用户审视。重点关注:**
1. **stored_profiles 跨产品工作流是否流畅**
2. **Greeting Phase 是否消除了幻觉**
3. **DeepSeek 基础分析的质量(永久缓存的根基)**

**用户审视后,发出 Part 2。**
