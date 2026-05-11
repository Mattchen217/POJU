# POJU Development Document v4.0 · 批次 3

> **批次范围**: 第 7-13 章 + 附录
> - 第 7 章: 数据存储升级
> - 第 8 章: API 设计
> - 第 9 章: UI/UX 流程
> - 第 10 章: 错误处理 + 边界
> - 第 11 章: 实施分模块路径(给 Cursor)
> - 第 12 章: 数据文件需求
> - 第 13 章: 合规与风险更新
> - 附录 A: Prompts 完整版
> - 附录 B: 数据格式 schema 全集
> - 附录 C: 与 v3.0.1 详细对比
>
> **基于**: POJU_v4.0_Batch1.md + Batch2.md + Batch2_Patch.md

---

# 第 7 章 · 数据存储升级

## 7.1 数据存储总览

```
v4.0 数据存储原则:

1. 客户端为主
   - 99% 数据在用户设备(IndexedDB)
   - 加密 AES-256-GCM
   - Key 派生自设备指纹

2. 服务器最小化
   - 仅订单凭证
   - 仅设备 ID 绑定
   - 不存对话/Profile

3. LLM API 透明
   - Anthropic ZDR(零保留)
   - 备选 LLM 同样配置

4. 用户控制权
   - 随时清除
   - 随时导出
   - 30 天自动归档
```

## 7.2 IndexedDB 完整结构

### 数据库设计

```typescript
// 使用 Dexie.js 封装

import Dexie, { Table } from 'dexie';

class PojulifeDB extends Dexie {
  // 共享数据
  user_profiles!: Table<UserProfileRecord, string>;
  device_info!: Table<DeviceInfoRecord, string>;
  
  // POJU
  poju_sessions!: Table<POJUSessionRecord, string>;
  poju_archive!: Table<POJUArchiveRecord, string>;
  
  // Glyph
  glyph_history!: Table<GlyphHistoryRecord, string>;
  glyph_usage!: Table<GlyphUsageRecord, string>;
  
  // Syncro
  syncro_tasks!: Table<SyncroTaskRecord, string>;
  syncro_cache!: Table<SyncroCacheRecord, string>;
  
  // 全局
  app_settings!: Table<AppSettingRecord, string>;
  
  constructor() {
    super('pojulife_v4');
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
  }
}

export const db = new PojulifeDB();
```

### 表结构详细

```typescript
// user_profiles 表 - 共享数据

interface UserProfileRecord {
  device_id: string;              // 主键
  
  // 加密的 Profile 数据
  encrypted_profile: string;      // Base64 加密
  iv: string;                     // 初始化向量
  
  // 元数据(明文)
  computed_at: Date;
  updated_at: Date;
  birth_info_hash: string;        // 用于检测变化
  computation_version: string;    // 引擎版本
  language: string;
  
  // 时效部分(每小时刷新)
  time_sensitive_cache?: {
    hour: string;                 // ISO timestamp
    encrypted_da_yun: string;
    encrypted_current_year: string;
    encrypted_current_month: string;
  };
}

// device_info 表 - 设备指纹

interface DeviceInfoRecord {
  device_id: string;              // 主键(指纹 hash)
  fingerprint_components: string; // 加密的指纹组件
  user_agent_hash: string;
  screen_signature: string;
  timezone: string;
  language: string;
  created_at: Date;
  last_seen_at: Date;
  
  // 用于加密的派生 key 信息(不存 key 本身)
  key_derivation: {
    salt: string;
    iterations: number;
    algorithm: 'PBKDF2';
  };
}

// poju_sessions 表

interface POJUSessionRecord {
  session_id: string;             // 主键
  device_id: string;              // 设备绑定
  
  // 加密的会话数据
  encrypted_data: string;         // SessionState 加密后
  iv: string;
  
  // 元数据(查询用)
  status: 'active' | 'suspended' | 'resolved' | 'archived';
  current_phase: number;
  
  // 时间
  created_at: Date;
  last_interaction_at: Date;
  expires_at: Date;               // 30 天计数
  
  // 支付
  payment_id: string;
  payment_processor: 'dodopayments' | 'stripe';
  
  // 续期
  renewals: {
    extended_at: Date;
    reason: 'user_request' | 'auto_active';
  }[];
  
  // Token 监控
  tokens_used: number;
  
  // 多 Session(同一付款不允许)
  is_locked: boolean;             // 防止并发
}

// poju_archive 表(归档)

interface POJUArchiveRecord {
  session_id: string;             // 主键
  device_id: string;
  
  encrypted_data: string;         // 完整 session 历史
  iv: string;
  
  archived_at: Date;
  original_created_at: Date;
  
  user_marked_resolved: boolean;
  satisfaction_rating?: number;   // 1-5
}

// glyph_history 表

interface GlyphHistoryRecord {
  id: string;                     // 主键 UUID
  device_id: string;
  drawn_at: Date;
  
  encrypted_data: string;         // 完整 GlyphReport + 输入
  iv: string;
  
  is_paid: boolean;
  payment_id?: string;
  language: string;
  glyph_number: number;
  wind_category: string;
}

// glyph_usage 表(每日额度)

interface GlyphUsageRecord {
  device_id: string;              // 主键
  date: string;                   // YYYY-MM-DD
  free_used: boolean;
  paid_count: number;
  timestamps: string[];           // 使用时间列表
}

// syncro_tasks 表

interface SyncroTaskRecord {
  task_id: string;                // 主键
  device_id: string;
  
  encrypted_data: string;         // 任务 + 40 个解读
  iv: string;
  
  task_description: string;       // 明文(便于查询)
  created_at: Date;
  valid_until: Date;              // 5 时辰后
  
  payment_id: string;
  
  hour_windows: {                 // 5 时辰列表(明文,便于切换)
    branch: string;
    start: Date;
    end: Date;
  }[];
}

// syncro_cache 表(浏览模式短期缓存)

interface SyncroCacheRecord {
  cache_key: string;              // 主键 (device_id + hour)
  hour: string;                   // 当前时辰
  encrypted_ratings: string;      // 8 方位评级
  iv: string;
  expires_at: Date;               // 时辰结束时间
}

// app_settings 表

interface AppSettingRecord {
  key: string;                    // 主键
  value: string;                  // 加密 JSON
  iv: string;
  updated_at: Date;
}

// 常见 settings keys:
// - 'language' (用户偏好语言)
// - 'theme' (light/dark)
// - 'notifications_enabled'
// - 'reduce_motion'
```

## 7.3 加密策略(AES-256-GCM)

### 加密实现

```typescript
// /lib/crypto.ts

class EncryptionService {
  private key: CryptoKey | null = null;
  
  // 从设备指纹派生密钥
  async deriveKey(deviceFingerprint: string, salt: string): Promise<void> {
    const encoder = new TextEncoder();
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(deviceFingerprint),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    this.key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  // 加密
  async encrypt(data: any): Promise<{ ciphertext: string; iv: string }> {
    if (!this.key) throw new Error('Key not derived');
    
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(data));
    
    // 生成 96-bit IV(GCM 推荐)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      plaintext
    );
    
    return {
      ciphertext: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv)
    };
  }
  
  // 解密
  async decrypt(ciphertext: string, iv: string): Promise<any> {
    if (!this.key) throw new Error('Key not derived');
    
    const ciphertextBuffer = base64ToArrayBuffer(ciphertext);
    const ivBuffer = base64ToArrayBuffer(iv);
    
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      this.key,
      ciphertextBuffer
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(plaintext));
  }
}

export const cryptoService = new EncryptionService();
```

### 设备指纹生成

```typescript
// /lib/fingerprint.ts

import FingerprintJS from '@fingerprintjs/fingerprintjs';

async function getDeviceFingerprint(): Promise<string> {
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  
  return result.visitorId;
}

// 初始化加密服务
async function initEncryption() {
  const fingerprint = await getDeviceFingerprint();
  
  // 检查是否已有 device_info
  let deviceInfo = await db.device_info.get(fingerprint);
  
  let salt: string;
  if (deviceInfo) {
    salt = deviceInfo.key_derivation.salt;
  } else {
    // 首次访问,生成 salt
    salt = arrayBufferToBase64(crypto.getRandomValues(new Uint8Array(16)));
    
    await db.device_info.add({
      device_id: fingerprint,
      fingerprint_components: '', // 不存敏感组件
      user_agent_hash: hashString(navigator.userAgent),
      screen_signature: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      created_at: new Date(),
      last_seen_at: new Date(),
      key_derivation: {
        salt,
        iterations: 100000,
        algorithm: 'PBKDF2'
      }
    });
  }
  
  await cryptoService.deriveKey(fingerprint, salt);
}
```

### 数据写入示例

```typescript
// 保存 POJU Session

async function saveSession(session: SessionState): Promise<void> {
  // 1. 加密敏感数据
  const { ciphertext, iv } = await cryptoService.encrypt(session);
  
  // 2. 写入 IndexedDB
  await db.poju_sessions.put({
    session_id: session.session_id,
    device_id: session.device_id,
    
    encrypted_data: ciphertext,
    iv: iv,
    
    // 元数据(明文,便于查询)
    status: session.status,
    current_phase: session.current_phase,
    
    created_at: session.created_at,
    last_interaction_at: session.last_interaction_at,
    expires_at: session.expires_at,
    
    payment_id: session.payment_id,
    payment_processor: 'dodopayments',
    
    renewals: session.renewals || [],
    tokens_used: session.abuse_metrics.total_tokens_used,
    is_locked: false
  });
}

// 读取 POJU Session

async function loadSession(sessionId: string): Promise<SessionState | null> {
  const record = await db.poju_sessions.get(sessionId);
  if (!record) return null;
  
  // 解密
  const session = await cryptoService.decrypt(
    record.encrypted_data,
    record.iv
  );
  
  return session;
}
```

## 7.4 Session 30 天 + 续期机制

### 完整生命周期

```
[创建]
用户付款 → 创建 session
expires_at = now + 30 days
status = 'active'

[使用中 - 30 天内]
每次互动:
  last_interaction_at = now
  expires_at = now + 30 days
  (滚动 30 天)

[即将过期 - 第 23 天]
后台检测:
  if (expires_at - now < 7 days && status === 'active') {
    在用户下次访问时显示提示:
    "Your session is active for 7 more days. 
     Need to extend? It's free."
    [Extend 30 more days] [Let it archive]
  }

[过期 - 30 天]
自动归档:
  status = 'archived'
  从主页隐藏
  移到 Archive 页

[手动操作]
用户随时可以:
  - End session (mark resolved) → status = 'resolved'
  - Pause session → status = 'suspended', expires_at += 90 days
  - Permanently delete → 真正删除

[从 Archive 恢复]
点击 "Restore session"
  status = 'active'
  expires_at = now + 30 days
  重新可用
```

### 自动归档逻辑

```typescript
// /lib/session-lifecycle.ts

async function checkAndArchiveSessions(): Promise<void> {
  const now = new Date();
  
  // 找出所有过期但仍 active 的 sessions
  const expired = await db.poju_sessions
    .where('status').equals('active')
    .and(s => s.expires_at < now)
    .toArray();
  
  for (const session of expired) {
    await archiveSession(session.session_id);
  }
}

async function archiveSession(sessionId: string): Promise<void> {
  const session = await db.poju_sessions.get(sessionId);
  if (!session) return;
  
  // 复制到 archive 表
  await db.poju_archive.put({
    session_id: sessionId,
    device_id: session.device_id,
    encrypted_data: session.encrypted_data,
    iv: session.iv,
    archived_at: new Date(),
    original_created_at: session.created_at,
    user_marked_resolved: false
  });
  
  // 更新原表状态(不删除,保留索引)
  await db.poju_sessions.update(sessionId, {
    status: 'archived'
  });
}

// 在 app 启动时调用
async function onAppStartup() {
  await initEncryption();
  await checkAndArchiveSessions();
}
```

### 续期机制

```typescript
async function extendSession(sessionId: string): Promise<void> {
  const session = await loadSession(sessionId);
  if (!session) throw new Error('Session not found');
  
  if (session.status !== 'active') {
    throw new Error('Cannot extend non-active session');
  }
  
  const now = new Date();
  
  session.expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  session.renewals.push({
    extended_at: now,
    reason: 'user_request'
  });
  
  await saveSession(session);
}

async function restoreArchivedSession(sessionId: string): Promise<void> {
  const archived = await db.poju_archive.get(sessionId);
  if (!archived) throw new Error('Archived session not found');
  
  const session = await cryptoService.decrypt(
    archived.encrypted_data,
    archived.iv
  );
  
  // 重置状态
  session.status = 'active';
  session.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  session.last_interaction_at = new Date();
  session.renewals.push({
    extended_at: new Date(),
    reason: 'restoration'
  });
  
  await saveSession(session);
  
  // 从 archive 表移除
  await db.poju_archive.delete(sessionId);
}
```

## 7.5 服务器端最小化存储

### 服务器只存什么

```
Supabase / 服务器数据库:

【orders 表】(订单凭证,法律必需)
  - order_id (UUID)
  - device_id_hash (设备指纹)
  - product: 'poju' | 'glyph' | 'syncro_ar'
  - amount: 9.99 | 1.99
  - currency: 'usd'
  - payment_processor: 'dodopayments'
  - external_payment_id (Dodo 的 ID)
  - status: 'completed' | 'refunded' | 'failed'
  - created_at
  - refunded_at?
  
  保留期: 7 年(税务合规)

【device_bindings 表】(防滥用)
  - device_id_hash
  - last_glyph_free_at (防薅羊毛)
  - total_purchases
  - blocked: false (滥用标记)
  - created_at
  - last_seen_at
  
  保留期: 滚动 12 个月

【NO conversation_data 表】
【NO user_profile 表】
【NO session_content 表】
  → 这些都在客户端
```

### 服务器表结构

```sql
-- orders 表
CREATE TABLE orders (
  order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id_hash TEXT NOT NULL,
  product TEXT NOT NULL CHECK (product IN ('poju', 'glyph', 'syncro_ar')),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  payment_processor TEXT NOT NULL,
  external_payment_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  created_at TIMESTAMP DEFAULT NOW(),
  refunded_at TIMESTAMP,
  
  CONSTRAINT order_amount_check CHECK (
    (product = 'poju' AND amount = 9.99) OR
    (product = 'glyph' AND amount = 1.99) OR
    (product = 'syncro_ar' AND amount = 1.99)
  )
);

CREATE INDEX idx_orders_device ON orders(device_id_hash);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(status);

-- device_bindings 表
CREATE TABLE device_bindings (
  device_id_hash TEXT PRIMARY KEY,
  last_glyph_free_at TIMESTAMP,
  total_purchases INT DEFAULT 0,
  blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bindings_blocked ON device_bindings(blocked);
```

## 7.6 多 Session 管理

### POJU 多 Session

```
用户可以有多个 POJU sessions(每个 $9.99):

Archive 页面显示:
┌─────────────────────────────────────────┐
│ Your POJU sessions                      │
│                                         │
│ Active                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     │
│                                         │
│ ▶ "Should I take this job offer?"       │
│   Started Oct 15 · 12 turns · Phase 4   │
│   Expires in 18 days                    │
│   [Continue]                            │
│                                         │
│ Archived                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     │
│                                         │
│ ▷ "Why does this keep happening?"       │
│   Started Sep 20 · Resolved             │
│   [View] [Restore] [Delete forever]     │
│                                         │
│ Glyphs                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     │
│                                         │
│ ☀ Glyph #17 · Oct 28                    │
│ ⚡ Glyph #51 · Oct 12                    │
│                                         │
│ Syncro tasks                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     │
│                                         │
│ 📍 Negotiation · Oct 28 · Expired      │
│                                         │
└─────────────────────────────────────────┘

并发限制:
  - 同一时间只有 1 个 POJU session 是 "active"
  - 想开新 session = 旧 session 自动 suspend
  - 防止用户混淆
```

### 同设备多用户

```
默认: 一台设备 = 一个用户
但有特殊情况:
  - 共用电脑/手机的家庭
  - 测试设备

不做账号系统(违反"无账号"承诺)
但提供:
  - "Switch profile" 按钮(高级设置)
  - 输入新的"identifier"(用户自定义短字符串)
  - 重新计算 device_id_hash(identifier + 原 fingerprint)
  - 独立的 Profile / Sessions

实现:
  hash = SHA256(fingerprint + identifier)
  
默认 identifier = 'default'
用户可改为 'mom', 'dad' 等
切换不删除数据,只是用不同 hash
```

## 7.7 数据导出 + 跨设备

### 用户主动导出

```typescript
// /lib/data-export.ts

async function exportAllData(): Promise<string> {
  const deviceId = await getDeviceFingerprint();
  
  // 收集所有数据
  const data = {
    version: 'v4.0',
    exported_at: new Date().toISOString(),
    device_id: deviceId,
    
    profile: await db.user_profiles.get(deviceId),
    sessions: await db.poju_sessions.where('device_id').equals(deviceId).toArray(),
    archive: await db.poju_archive.where('device_id').equals(deviceId).toArray(),
    glyph_history: await db.glyph_history.where('device_id').equals(deviceId).toArray(),
    syncro_tasks: await db.syncro_tasks.where('device_id').equals(deviceId).toArray(),
    settings: await db.app_settings.toArray()
  };
  
  // 整体再加密(独立 password)
  const password = await promptUserPassword();
  const encrypted = await encryptWithPassword(JSON.stringify(data), password);
  
  return encrypted;
}

async function importData(encryptedData: string, password: string): Promise<void> {
  const json = await decryptWithPassword(encryptedData, password);
  const data = JSON.parse(json);
  
  if (data.version !== 'v4.0') {
    throw new Error('Incompatible version');
  }
  
  // 警告用户:这会覆盖当前设备数据?
  // 或追加?
  
  // 写入(覆盖模式)
  await db.user_profiles.put(data.profile);
  for (const session of data.sessions) {
    await db.poju_sessions.put(session);
  }
  // ...
}
```

### 跨设备体验

```
方案 A: 用户主动导出/导入(MVP)
  用户在设备 A 导出 → 加密 JSON 文件
  传到设备 B(邮件/云盘/U盘)
  设备 B 导入 → 输入密码 → 恢复

方案 B: 邮箱 + 设备指纹(P1)
  用户提供邮箱
  服务器存储 encrypted_backup(完全加密,服务器无法解密)
  其他设备用邮箱 + 设备指纹 + 密码 = 取回备份

方案 C: 真正的账号系统(P2)
  传统注册登录
  违反"无账号"承诺
  最后再考虑

MVP 选 A
```

---

# 第 8 章 · API 设计

## 8.1 API 总览

```
所有 API 路由(Next.js App Router):

【POJU】
  POST /api/poju/create        创建 session
  POST /api/poju/chat          对话(主入口)
  POST /api/poju/extend        续期
  POST /api/poju/resolve       标记已解决
  POST /api/poju/refund        申请退款
  POST /api/poju/restore       从 Archive 恢复

【Glyph】
  GET  /api/glyph/quota        检查免费额度
  POST /api/glyph/draw         抽签 + 生成报告
  POST /api/glyph/pay          付费创建订单

【Syncro】
  POST /api/syncro/browse      浏览模式(免费)
  POST /api/syncro/task        AR 任务(付费)
  GET  /api/syncro/task/:id    获取已生成的任务数据

【计算引擎】
  POST /api/calculate/profile  生成完整 Profile
  POST /api/calculate/refresh  刷新时间敏感部分

【支付】
  POST /api/payments/create    创建支付意向
  POST /api/payments/webhook   DodoPayments 回调
  POST /api/payments/verify    验证支付状态

【辅助】
  POST /api/contact            联系表单
  POST /api/syncro/send-link   桌面端发送移动链接
  GET  /api/health             健康检查
```

## 8.2 POJU API 详细

### POST /api/poju/create

```typescript
// 创建新 POJU session

interface CreatePOJUSessionRequest {
  device_id: string;
  payment_id: string;            // 已支付的订单 ID
  language: string;              // 用户偏好语言
}

interface CreatePOJUSessionResponse {
  session_id: string;
  redirect_url: string;          // /poju/session/[session_id]
  expires_at: string;
}

// 实现
export async function POST(req: Request) {
  const body = await req.json();
  
  // 1. 验证支付
  const payment = await verifyPayment(body.payment_id);
  if (!payment.valid || payment.product !== 'poju') {
    return NextResponse.json({
      error: 'invalid_payment'
    }, { status: 402 });
  }
  
  // 2. 检查是否已用于其他 session
  if (payment.used) {
    return NextResponse.json({
      error: 'payment_already_used'
    }, { status: 409 });
  }
  
  // 3. 检查并发(同设备只能 1 个 active)
  const existing = await getActivePOJUSession(body.device_id);
  if (existing) {
    return NextResponse.json({
      error: 'existing_active_session',
      existing_session_id: existing.session_id,
      message: 'You already have an active POJU session. End it first.'
    }, { status: 409 });
  }
  
  // 4. 标记支付已使用
  await markPaymentUsed(body.payment_id);
  
  // 5. 创建 session(在客户端)
  const sessionId = generateUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  return NextResponse.json({
    session_id: sessionId,
    redirect_url: `/poju/session/${sessionId}`,
    expires_at: expiresAt.toISOString()
  });
}
```

### POST /api/poju/chat ⭐ 核心

```typescript
interface POJUChatRequest {
  session_id: string;
  device_id: string;
  user_input: string;
  language: string;
}

interface POJUChatResponse {
  response: string;
  phase: number;
  is_rejected: boolean;
  rejection_reason?: string;
  
  actions?: Action[];            // Phase 4 才有
  
  suggestions?: {
    try_glyph: boolean;
    try_syncro: boolean;
  };
  
  meta: {
    tokens_used: number;
    total_tokens: number;
    soft_limit_reached: boolean;
    hard_limit_reached: boolean;
  };
}

// 实现
export async function POST(req: Request) {
  const body = await req.json();
  
  // 1. 加载 session(客户端做,不通过 API)
  // 注:由于 session 加密在客户端
  //    服务器无法直接读
  //    所以 API 实际接收 session state 作为参数
  
  const session = body.session_state;  // 客户端解密后传来
  
  // 2. 验证 session 合法性
  if (session.status !== 'active') {
    return NextResponse.json({
      error: 'session_not_active'
    }, { status: 400 });
  }
  
  // 3. 规则层检查
  const ruleCheck = runRuleChecks(session, body.user_input);
  if (ruleCheck.is_rejected) {
    return NextResponse.json({
      response: ruleCheck.rejection_message,
      phase: session.current_phase,
      is_rejected: true,
      rejection_reason: ruleCheck.reason,
      meta: { tokens_used: 0, total_tokens: session.tokens_used,
              soft_limit_reached: false, hard_limit_reached: false }
    });
  }
  
  // 4. Token 检查
  if (session.tokens_used > 100000) {
    return NextResponse.json({
      response: forceResolutionMessage(session),
      phase: 'RESOLVED',
      is_rejected: false,
      meta: { tokens_used: 0, total_tokens: session.tokens_used,
              soft_limit_reached: true, hard_limit_reached: true }
    });
  }
  
  // 5. 调用 LLM
  const llmResult = await callPOJULLM({
    session,
    user_input: body.user_input,
    language: body.language
  });
  
  // 6. 返回结果(客户端负责存储更新后的 session)
  return NextResponse.json({
    response: llmResult.response,
    phase: llmResult.next_phase || session.current_phase,
    is_rejected: false,
    actions: llmResult.action_items,
    suggestions: {
      try_glyph: llmResult.suggest_glyph,
      try_syncro: llmResult.suggest_syncro
    },
    meta: {
      tokens_used: llmResult.tokens_used,
      total_tokens: session.tokens_used + llmResult.tokens_used,
      soft_limit_reached: (session.tokens_used + llmResult.tokens_used) > 80000,
      hard_limit_reached: (session.tokens_used + llmResult.tokens_used) > 100000
    },
    
    // 给客户端的更新指令
    state_updates: {
      new_information_slots: llmResult.new_information_slots,
      add_actions: llmResult.action_items,
      advance_phase: llmResult.phase_should_advance
    }
  });
}
```

### POST /api/poju/extend

```typescript
interface ExtendSessionRequest {
  session_id: string;
  device_id: string;
}

interface ExtendSessionResponse {
  new_expires_at: string;
  message: string;
}

export async function POST(req: Request) {
  const body = await req.json();
  
  // 续期是客户端操作
  // API 只做日志记录
  
  await logEvent({
    type: 'session_extended',
    session_id: body.session_id,
    device_id: body.device_id,
    timestamp: new Date()
  });
  
  const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  return NextResponse.json({
    new_expires_at: newExpiresAt.toISOString(),
    message: 'Session extended for 30 more days'
  });
}
```

### POST /api/poju/refund

```typescript
interface RefundRequest {
  session_id: string;
  device_id: string;
  payment_id: string;
  reason: 'within_5_minutes' | 'technical_failure' | 'unstarted' | 'duplicate' | 'other';
  description?: string;
}

export async function POST(req: Request) {
  const body = await req.json();
  
  // 1. 验证退款资格
  const order = await getOrder(body.payment_id);
  if (!order || order.status !== 'completed') {
    return NextResponse.json({ error: 'invalid_order' }, { status: 400 });
  }
  
  // 2. 检查退款条件
  const eligibility = checkRefundEligibility(order, body.reason);
  if (!eligibility.eligible) {
    return NextResponse.json({
      error: 'not_eligible',
      reason: eligibility.reason
    }, { status: 403 });
  }
  
  // 3. 调用 DodoPayments 退款 API
  const refundResult = await dodoPayments.refunds.create({
    payment_id: order.external_payment_id,
    amount: order.amount,
    reason: body.reason
  });
  
  // 4. 更新订单状态
  await updateOrder(order.order_id, {
    status: 'refunded',
    refunded_at: new Date()
  });
  
  // 5. 标记 session 为 refunded
  // (客户端负责更新 session 状态)
  
  return NextResponse.json({
    success: true,
    refund_id: refundResult.id,
    estimated_arrival: '3-7 business days'
  });
}

function checkRefundEligibility(order: Order, reason: string) {
  const now = new Date();
  const orderAge = now.getTime() - order.created_at.getTime();
  const minutes = orderAge / (1000 * 60);
  
  if (reason === 'within_5_minutes' && minutes <= 5) {
    return { eligible: true };
  }
  
  if (reason === 'technical_failure' && minutes <= 7 * 24 * 60) {
    return { eligible: true };
  }
  
  if (reason === 'unstarted' && minutes <= 24 * 60) {
    // 检查 session 是否真的未开始(对话 0 轮)
    return { eligible: true };  // 实际需查询
  }
  
  if (reason === 'duplicate') {
    return { eligible: true };
  }
  
  return { 
    eligible: false, 
    reason: 'Conditions not met. See Terms of Service.' 
  };
}
```

## 8.3 Glyph API

### GET /api/glyph/quota

```typescript
interface GlyphQuotaResponse {
  can_use_free: boolean;
  next_free_at?: string;          // 下次免费可用时间
  today_paid_count: number;
}

export async function GET(req: Request) {
  const deviceId = req.headers.get('x-device-id');
  if (!deviceId) {
    return NextResponse.json({ error: 'device_required' }, { status: 400 });
  }
  
  const today = new Date().toISOString().split('T')[0];
  
  // 检查 device_bindings 表(服务器端,防薅羊毛)
  const binding = await db.device_bindings.get(deviceId);
  
  if (!binding) {
    // 新设备,可免费
    return NextResponse.json({
      can_use_free: true,
      today_paid_count: 0
    });
  }
  
  // 检查上次免费使用时间
  const lastFree = binding.last_glyph_free_at;
  if (!lastFree) {
    return NextResponse.json({
      can_use_free: true,
      today_paid_count: 0
    });
  }
  
  const lastFreeDate = new Date(lastFree).toISOString().split('T')[0];
  const canUseFree = lastFreeDate !== today;
  
  let nextFreeAt: string | undefined;
  if (!canUseFree) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    nextFreeAt = tomorrow.toISOString();
  }
  
  return NextResponse.json({
    can_use_free: canUseFree,
    next_free_at: nextFreeAt,
    today_paid_count: 0  // 实际查询
  });
}
```

### POST /api/glyph/draw

```typescript
interface GlyphDrawRequest {
  device_id: string;
  user_profile: any;             // 从客户端来的 profile
  user_question: string;
  glyph_number: number;          // 客户端随机抽的 1-100
  language: string;
  is_paid: boolean;
  payment_id?: string;
}

interface GlyphDrawResponse {
  report: GlyphReport;
  glyph_data: {
    id: number;
    name: string;
    wind_category: string;
    classical_text: string;
  };
  meta: {
    tokens_used: number;
    language: string;
  };
}

export async function POST(req: Request) {
  const body = await req.json();
  
  // 1. 验证免费/付费
  if (body.is_paid) {
    const payment = await verifyPayment(body.payment_id);
    if (!payment.valid || payment.product !== 'glyph') {
      return NextResponse.json({ error: 'invalid_payment' }, { status: 402 });
    }
  } else {
    // 检查免费额度
    const quota = await checkGlyphQuota(body.device_id);
    if (!quota.can_use_free) {
      return NextResponse.json({ error: 'free_quota_exhausted' }, { status: 429 });
    }
  }
  
  // 2. 加载签文数据
  const glyph = await loadGlyphData(body.glyph_number);
  
  // 3. 调用 LLM
  const report = await callGlyphLLM({
    profile: body.user_profile,
    glyph,
    question: body.user_question,
    language: body.language
  });
  
  // 4. 记录使用(防薅羊毛)
  if (!body.is_paid) {
    await db.device_bindings.update(body.device_id, {
      last_glyph_free_at: new Date()
    });
  }
  
  return NextResponse.json({
    report,
    glyph_data: glyph,
    meta: {
      tokens_used: report._tokens_used,
      language: body.language
    }
  });
}
```

## 8.4 Syncro API

### POST /api/syncro/browse(免费,无 LLM 调用)

```typescript
interface SyncroBrowseRequest {
  device_id: string;
  user_profile: any;
  current_time: string;
  facing?: number;               // 0-360 度
}

interface SyncroBrowseResponse {
  current_hour: {
    branch: string;
    element: string;
    period: string;
  };
  ratings: Record<string, DirectionRating>;
  current_facing?: string;
  valid_until: string;
}

export async function POST(req: Request) {
  const body = await req.json();
  
  // 完全本机计算,但 API 这里也提供给桌面端
  // 移动端直接客户端 JS 调用计算引擎
  
  const directions = await calculateDirections({
    yong_shen: body.user_profile.yong_shen,
    current_time: body.current_time,
    device_orientation: body.facing
  });
  
  return NextResponse.json(directions);
}
```

### POST /api/syncro/task ⭐ AR 模式

```typescript
interface SyncroTaskRequest {
  device_id: string;
  user_profile: any;
  task: string;
  payment_id: string;
  current_time: string;
  language: string;
}

interface SyncroTaskResponse {
  task_id: string;
  task: string;
  interpretations: Record<string, Record<string, string>>;
  basic_ratings: Record<string, Record<string, DirectionRating>>;
  bonus_directions: BonusDirection[];
  valid_until: string;
  hour_windows: HourWindow[];
}

export async function POST(req: Request) {
  const body = await req.json();
  
  // 1. 验证支付
  const payment = await verifyPayment(body.payment_id);
  if (!payment.valid || payment.product !== 'syncro_ar') {
    return NextResponse.json({ error: 'invalid_payment' }, { status: 402 });
  }
  
  // 2. 计算 5 时辰窗口
  const windows = calculateFiveHourWindows(body.current_time);
  
  // 3. 对每个时辰计算 8 方位评级
  const allRatings = [];
  for (const window of windows) {
    const ratings = await calculateDirections({
      yong_shen: body.user_profile.yong_shen,
      current_time: window.start,
      task: body.task
    });
    allRatings.push({ window, ratings: ratings.ratings });
  }
  
  // 4. 调用 LLM 生成 40 个解读
  const llmResult = await callSyncroLLM({
    profile: body.user_profile,
    task: body.task,
    allRatings,
    language: body.language
  });
  
  // 5. 标记支付已使用
  await markPaymentUsed(body.payment_id);
  
  // 6. 返回完整数据(客户端缓存)
  const taskId = generateUUID();
  
  return NextResponse.json({
    task_id: taskId,
    task: body.task,
    interpretations: llmResult.interpretations,
    basic_ratings: allRatings.reduce((acc, { window, ratings }) => {
      acc[window.branch] = ratings;
      return acc;
    }, {}),
    bonus_directions: llmResult.bonus_directions,
    valid_until: windows[windows.length - 1].end.toISOString(),
    hour_windows: windows
  });
}
```

## 8.5 计算引擎 API

### POST /api/calculate/profile

```typescript
interface CalculateProfileRequest {
  birth: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    timezone: string;
    longitude: number;
    latitude: number;
  };
  gender: 'M' | 'F';
  current: {
    timestamp: string;
    location?: { lat: number; lng: number };
  };
  user_question?: string;
  question_type?: string;
  language: string;
}

interface CalculateProfileResponse {
  profile: {
    bazi: BaziOutput;
    ten_gods: TenGodsOutput;
    yong_shen: YongShenOutput;
    pattern: PatternOutput;
    da_yun: DaYunOutput;
    spirits: SpiritsOutput;
    relations: RelationsOutput;
    diagnosis: DiagnosisOutput;      // 给 LLM 用的核心
  };
  meta: {
    computation_version: string;
    confidence: 'high' | 'medium' | 'low';
    warnings: string[];
  };
}

export async function POST(req: Request) {
  const body = await req.json();
  
  // 注:实际计算可以在客户端做(更快、更私密)
  // API 这里作为后备 / 桌面端
  
  try {
    const profile = await calculateProfile(body);
    
    return NextResponse.json({
      profile,
      meta: {
        computation_version: 'v1.0',
        confidence: profile.diagnosis.meta.confidence,
        warnings: profile.diagnosis.meta.simplification_notes
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'calculation_failed',
      message: error.message
    }, { status: 500 });
  }
}
```

## 8.6 支付 API

### POST /api/payments/create

```typescript
interface CreatePaymentRequest {
  device_id: string;
  product: 'poju' | 'glyph' | 'syncro_ar';
  email: string;                 // 支付必填
  return_url: string;            // 用户付款后返回的 URL
  metadata?: Record<string, any>;
}

interface CreatePaymentResponse {
  payment_url: string;            // DodoPayments checkout URL
  order_id: string;
}

export async function POST(req: Request) {
  const body = await req.json();
  
  // 1. 创建本地 order 记录
  const orderId = generateUUID();
  const amount = body.product === 'poju' ? 9.99 : 1.99;
  
  await db.orders.insert({
    order_id: orderId,
    device_id_hash: body.device_id,
    product: body.product,
    amount,
    currency: 'usd',
    payment_processor: 'dodopayments',
    status: 'pending'
  });
  
  // 2. 调用 DodoPayments 创建 checkout
  const dodoCheckout = await dodoPayments.checkouts.create({
    amount: amount * 100,        // 分为单位
    currency: 'usd',
    customer_email: body.email,
    success_url: `${body.return_url}?order_id=${orderId}&status=success`,
    cancel_url: `${body.return_url}?order_id=${orderId}&status=cancelled`,
    metadata: {
      order_id: orderId,
      product: body.product,
      device_id: body.device_id
    }
  });
  
  // 3. 更新订单 external_id
  await db.orders.update(orderId, {
    external_payment_id: dodoCheckout.id
  });
  
  return NextResponse.json({
    payment_url: dodoCheckout.url,
    order_id: orderId
  });
}
```

### POST /api/payments/webhook

```typescript
// DodoPayments 回调

export async function POST(req: Request) {
  // 1. 验证 webhook 签名
  const signature = req.headers.get('dodo-signature');
  const body = await req.text();
  
  if (!verifyDodoSignature(body, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }
  
  const event = JSON.parse(body);
  
  // 2. 处理事件
  switch (event.type) {
    case 'payment.succeeded':
      await handlePaymentSuccess(event.data);
      break;
    case 'payment.failed':
      await handlePaymentFailed(event.data);
      break;
    case 'refund.created':
      await handleRefundCreated(event.data);
      break;
  }
  
  return NextResponse.json({ received: true });
}

async function handlePaymentSuccess(data: any) {
  const orderId = data.metadata.order_id;
  
  await db.orders.update(orderId, {
    status: 'completed',
    external_payment_id: data.payment_id
  });
  
  // 更新 device_bindings
  await db.device_bindings.upsert({
    device_id_hash: data.metadata.device_id,
    total_purchases: { increment: 1 },
    last_seen_at: new Date()
  });
}
```

## 8.7 错误代码

```
统一错误响应格式:

{
  "error": "error_code",
  "message": "Human readable message",
  "details": {...}  // 可选,额外细节
}

错误代码列表:

【认证 / 授权】
  device_required          400 - 设备 ID 缺失
  invalid_signature        401 - Webhook 签名无效
  
【支付】
  invalid_payment          402 - 支付无效
  payment_already_used     409 - 支付已使用
  not_eligible_for_refund  403 - 退款不符合条件
  
【数据】
  profile_required         400 - 缺少 user_profile
  calculation_failed       500 - 计算引擎错误
  
【Session】
  session_not_found        404 - Session 不存在
  session_not_active       400 - Session 非 active
  existing_active_session  409 - 已有活跃 session
  token_limit_exceeded     429 - Token 超限
  
【内容】
  free_quota_exhausted     429 - 每日免费已用完
  topic_drift_detected     400 - 话题漂移(Agent 处理)
  abuse_detected           403 - 滥用检测
  
【LLM】
  llm_unavailable          503 - LLM 服务不可用
  llm_timeout              504 - LLM 超时
  
【一般】
  invalid_request          400 - 请求格式错误
  internal_error           500 - 服务器错误
```

## 8.8 速率限制

```
按 IP + 设备 ID 限流:

【宽松限流】(浏览类)
  /api/glyph/quota         100/min
  /api/syncro/browse       60/min
  /api/calculate/profile   30/min

【中等限流】(创建类)
  /api/poju/create         10/min
  /api/payments/create     20/min

【严格限流】(高成本)
  /api/poju/chat           20/min  per session
  /api/glyph/draw          5/min   per device
  /api/syncro/task         3/min   per device

【关键限流】(防滥用)
  /api/poju/refund         3/hour  per device
  /api/contact             5/hour  per IP

实现:
  - Upstash Redis(serverless 友好)
  - 或 Vercel KV
  - 用 token bucket 算法
```

---

# 第 9 章 · UI/UX 流程

## 9.1 页面结构总览

```
/                          首页(品牌 + 三件套介绍)
/poju                      POJU 介绍 + 付费入口
/poju/session/[id]         POJU 对话界面
/poju/archive              POJU 历史 + Archive

/glyph                     Glyph 主界面(抽签)
/glyph/history             Glyph 历史

/syncro                    Syncro(自动检测,移动 vs 桌面)
/syncro/desktop            桌面端引导页

/account                   设备数据管理(无账号系统)
/about                     关于 pojulife
/privacy                   隐私政策
/terms                     服务条款
/disclaimer                免责声明
/contact                   联系
```

## 9.2 用户旅程地图

### 新用户首次进入

```
[首次访问 pojulife.com]
       ↓
看到首页(品牌 + 三件套)
  - "Three ways in. One way through."
  - 三件套卡片
       ↓
   ┌───┴───┬───────┐
   ↓       ↓       ↓
 POJU    Glyph   Syncro
       ↓
[最可能路径: 用户选 Glyph 试用]
  - 因为免费 + 快速
  - 体验产品深度
       ↓
进入 /glyph
       ↓
首次需要输入出生信息
  - 6 项硬性数据
  - 解释为什么需要
       ↓
计算 user_profile(本机)
缓存到 IndexedDB
       ↓
抽签 + 生成报告
  - 用户看到深度个性化输出
  - "How does it know this about me?"
       ↓
[转化路径 1: 用户被打动,升级到 POJU]
       ↓
进入 /poju
       ↓
看到 POJU 介绍
点击 "Start your session — $9.99"
       ↓
[支付流程]
DodoPayments checkout
  - 输入邮箱
  - 选择支付方式
  - 完成付款
       ↓
返回 pojulife.com
       ↓
跳转到 /poju/session/[id]
       ↓
[POJU Session 开始]
Phase 1 → 2 → 3 → 4 → 5
       ↓
最终:用户标记 resolved
或 30 天后归档
```

### 回访用户

```
[再次访问 pojulife.com]
       ↓
首页显示个性化卡片:
  "Continue your POJU session"
  "Today's Glyph is ready"
  "Open Syncro on your phone"
       ↓
用户选择某产品继续
       ↓
基于 device_id 自动恢复:
  - user_profile(已计算,直接用)
  - Sessions / History
  - 设置偏好
```

## 9.3 关键页面设计

### 首页(/)

```
┌─────────────────────────────────────────────┐
│ [Logo: pojulife]    [Lang]  [Account]      │ ← Header
│                                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                             │
│           Three ways in.                    │
│           One way through.                  │
│                                             │
│   pojulife is three tools for the moments   │
│   when something needs to clarify.          │
│                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌────────┐│
│  │   GLYPH     │ │    POJU     │ │ SYNCRO ││
│  │             │ │             │ │        ││
│  │ 60 seconds  │ │ Deep talk   │ │ Live   ││
│  │ reflection  │ │ Until break-│ │ compass││
│  │             │ │ through     │ │        ││
│  │ ☀ Free 1/day│ │ $9.99/session│ │ Free   ││
│  │ $1.99 more  │ │             │ │+$1.99  ││
│  │             │ │             │ │ AR mode││
│  │ [Try →]     │ │ [Begin →]   │ │ [Open] ││
│  └─────────────┘ └─────────────┘ └────────┘│
│                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                             │
│  [品牌内核 + 介绍区块]                      │
│                                             │
│  Three Non-Negotiables:                     │
│  Never Stored · Never Required · Never     │
│  Manipulative                               │
│                                             │
└─────────────────────────────────────────────┘
[Footer: pojulife · Links · © 2026]
```

### POJU Session 页面

```
桌面端 (/poju/session/[id]):

┌─────────────────────────────────────────────────────┐
│ Header                                              │
├──────────────┬──────────────────────────────────────┤
│ Side Panel   │ Main Chat                            │
│              │                                      │
│ Your         │ ┌────────────────────────────────┐  │
│ question:    │ │ Welcome to POJU.               │  │
│ "Should I    │ │ ...                            │  │
│  take this   │ │                                │  │
│  offer?"     │ │ [User Message]                 │  │
│              │ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━   │  │
│ Phase:       │ │ [Assistant Response]           │  │
│ Analysis     │ │                                │  │
│              │ │ [Action Items if Phase 4]      │  │
│ Insights:    │ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━   │  │
│ • You realize│ │ ...                            │  │
│   X          │ └────────────────────────────────┘  │
│ • Y matters  │                                      │
│   more than  │ ┌────────────────────────────────┐  │
│   you said   │ │ [Input field]                  │  │
│              │ │ [Send]                         │  │
│ Actions:     │ └────────────────────────────────┘  │
│ ☐ Talk to    │                                      │
│   boss       │ Tokens used: 12.5K / 100K           │
│              │                                      │
│ [End Session]│                                      │
│ [Refund]     │                                      │
└──────────────┴──────────────────────────────────────┘

移动端:
单列布局,Insights/Actions 可折叠
```

### Glyph 主界面

```
[保留现有定稿 UI]
本文档不涉及 UI 修改
仅描述功能层结构:

1. 入口页 → 显示是否可免费用
2. 数据收集表单(首次)
3. 问题输入(60 字符限制)
4. 抽签动画
5. 报告展示(5 段结构)
6. 末尾操作(保存/下载/关闭)
```

### Syncro 移动端

```
[详见批次 2 补丁文档]
- 浏览模式:平放手机,显示罗盘
- AR 模式:11 步仪式流程
- 圆形摄像头视窗 UI
- 时辰自动切换
```

### Syncro 桌面端

```
[详见批次 2 补丁文档 5.7]
- 引导页
- QR 码
- 视频演示
- 邮件/短信发送链接
```

## 9.4 移动端 + PWA

```
PWA 配置(/public/manifest.json):

{
  "name": "pojulife",
  "short_name": "pojulife",
  "description": "Three ways in. One way through.",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0a0a0f",
  "theme_color": "#0a0a0f",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}

Service Worker(/public/sw.js):
- 离线支持(已访问页面)
- 摄像头权限缓存
- 罗盘 API 检测

注: Syncro AR 必须 PWA
  - 摄像头权限
  - 罗盘 API
  - 全屏体验
```

## 9.5 三件套间跳转

### 从 POJU 到 Glyph

```
POJU Phase 3 中,LLM 建议:
  "Sometimes a fresh angle helps..."
  [Try Glyph for fresh perspective →]

点击 → 新标签打开 /glyph?from=poju&session_id=xxx
  - 复用同一 device_id
  - 自动用现有 user_profile(无需重输)
  - 不计入每日免费额度(算 POJU 内)?
    或仍正常计入(简化逻辑)
  
完成后:
  Glyph 结尾显示:
  "Continue your POJU session with this insight?
   [Return to POJU →]"
```

### 从 POJU 到 Syncro

```
LLM 建议:
  "For timing of [action], try Syncro AR..."
  [Open Syncro for this task →]

点击 → 跳转到 /syncro
  - 桌面用户:看到引导页
  - 移动用户:进入 Syncro
  - 任务字段预填(从 POJU 抽取)
```

### 从首页直接进

```
首页三个卡片
点击对应产品
  → 进入对应主页
```

## 9.6 多语言切换

```
位置:Header 右上角

UI:
  [EN ▼]
  ├─ English
  ├─ 中文
  ├─ Español
  ├─ Français
  └─ Deutsch

切换行为:
  1. 即时切换 UI 语言(next-intl)
  2. 路由不变(同一 URL,不同语言)
  3. 进行中的对话:不立即切换(避免突兀)
     - 下次对话用新语言
  4. 已生成的报告/历史:保留原语言

存储:
  - 用户偏好存到 app_settings 表
  - 下次访问自动应用
```

---

# 第 10 章 · 错误处理 + 边界

## 10.1 错误处理总策略

```
分级处理:

Level 1: 用户错误(400-499)
  - 输入不合法
  - 权限缺失
  - 数据缺失
  → 友好提示,引导修正

Level 2: 服务错误(500-599)
  - LLM 失败
  - 计算引擎失败
  - 数据库错误
  → 自动重试 + 降级

Level 3: 致命错误
  - 数据损坏
  - 加密失败
  - 设备指纹冲突
  → 提示用户 + 客服

策略:
  1. 永不让用户看到原始错误堆栈
  2. 永远给用户【下一步行动】
  3. 关键错误自动上报
  4. 客户端实现重试逻辑
```

## 10.2 LLM API 错误处理

### 主备切换

```typescript
async function callLLMWithFallback(prompt: PromptPayload): Promise<LLMResponse> {
  const providers = ['anthropic', 'openai', 'google'];
  let lastError;
  
  for (const provider of providers) {
    try {
      const result = await callProvider(provider, prompt);
      return result;
    } catch (error) {
      lastError = error;
      
      // 日志
      await logEvent({
        type: 'llm_failure',
        provider,
        error: error.message,
        prompt_type: prompt.type
      });
      
      // 如果是 rate limit,稍微等一下
      if (error.code === 'rate_limit') {
        await sleep(1000);
      }
      
      // 继续下一个
      continue;
    }
  }
  
  // 所有 provider 都失败
  throw new LLMUnavailableError(lastError);
}
```

### 用户感知错误

```typescript
// POJU 对话中 LLM 失败

try {
  const response = await callPOJULLM(...);
  return successResponse(response);
} catch (error) {
  if (error instanceof LLMUnavailableError) {
    return NextResponse.json({
      response: "I'm having trouble connecting right now. " +
                "Could you try again in a moment? Your session " +
                "is saved.",
      phase: session.current_phase,
      is_rejected: false,
      meta: { llm_error: true }
    });
  }
  
  throw error;  // 其他错误上抛
}
```

### Syncro AR 失败

```typescript
// AR 任务生成失败
try {
  const result = await callSyncroLLM(...);
  return result;
} catch (error) {
  if (error instanceof LLMUnavailableError) {
    // 退款 + 通知
    await refundPayment(payment_id);
    
    return NextResponse.json({
      error: 'llm_unavailable',
      message: 'Our AI partners are temporarily unavailable. ' +
               'Your $1.99 has been refunded automatically. ' +
               'You can also use the free Browse mode now.',
      refund_initiated: true
    });
  }
}
```

## 10.3 计算引擎错误

```typescript
async function calculateWithFallback(input: any) {
  try {
    return await calculateProfile(input);
  } catch (error) {
    // 严重错误(无法继续)
    if (error.severity === 'fatal') {
      throw error;
    }
    
    // 警告级别(可降级)
    if (error.severity === 'warning') {
      // 尝试部分计算
      const partial = await calculatePartialProfile(input);
      partial.diagnosis.meta.confidence = 'low';
      partial.diagnosis.meta.warnings = [error.message];
      return partial;
    }
  }
}
```

## 10.4 网络问题

### 离线支持

```typescript
// /public/sw.js (Service Worker)

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    // API 请求:在线时直连
    event.respondWith(
      fetch(event.request).catch(() => {
        // 离线时返回友好错误
        return new Response(JSON.stringify({
          error: 'offline',
          message: 'You appear to be offline. Your data is safe locally.'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
  } else {
    // 静态资源:Cache First
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});
```

### 重试逻辑

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        // Rate limit, 指数退避
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      
      if (response.status >= 500 && i < maxRetries - 1) {
        // 服务器错误,重试
        await sleep(1000);
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

## 10.5 摄像头/罗盘问题

```typescript
// Syncro AR 完整错误处理

async function setupARSession() {
  // Step 1: 检测设备类型
  const device = detectDevice();
  if (device.type === 'desktop') {
    return redirect('/syncro/desktop');
  }
  
  // Step 2: 检测罗盘
  if (!device.hasCompass) {
    return showError({
      title: 'Compass unavailable',
      message: 'Syncro AR requires a compass-equipped device. ' +
               'You can still use Browse Mode without AR.',
      actions: [
        { label: 'Use Browse Mode', action: 'redirect_browse' },
        { label: 'Request refund', action: 'refund' }
      ]
    });
  }
  
  // Step 3: iOS 13+ 罗盘权限
  if (device.os === 'ios' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const state = await DeviceOrientationEvent.requestPermission();
      if (state !== 'granted') {
        return showError({
          title: 'Compass permission required',
          message: 'Without compass access, Syncro AR cannot function.',
          actions: [
            { label: 'Try again', action: 'retry' },
            { label: 'Use Browse Mode', action: 'browse_mode' },
            { label: 'Refund', action: 'refund' }
          ]
        });
      }
    } catch (error) {
      // 处理失败
    }
  }
  
  // Step 4: 摄像头权限(可降级)
  let cameraStream = null;
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
  } catch (error) {
    // 摄像头被拒,继续但用降级 UI
    showInfo({
      message: 'Camera access denied. AR overlay disabled but Syncro still works.',
      dismissible: true
    });
  }
  
  // 进入 AR
  return startARView({ cameraStream });
}
```

## 10.6 Token 超限

```typescript
// 软提示(80K tokens)

function softTokenWarning(session: SessionState) {
  return {
    response: `We've explored many angles in this conversation. 
               Based on what you've shared, you have most of 
               what you need for this decision.
               
               Would you like to:
               - Continue exploring (we can go deeper)
               - Receive a summary of insights so far
               - End and reflect on your own`,
    options: [
      { label: 'Continue', action: 'continue' },
      { label: 'Summarize', action: 'summarize' },
      { label: 'End session', action: 'resolve' }
    ]
  };
}

// 硬上限(100K tokens)

function forceResolution(session: SessionState) {
  return {
    response: `This conversation has reached its natural endpoint.
               Here are the key insights we've uncovered:
               
               ${generateAutoSummary(session)}
               
               And your active actions:
               
               ${formatActions(session.actions)}
               
               Take time to sit with these. The decision is yours.`,
    phase: 'RESOLVED',
    actions: session.actions
  };
}
```

## 10.7 支付失败 + 退款

```typescript
// 退款流程

async function processRefund(refundRequest: RefundRequest) {
  try {
    // 1. 调用 DodoPayments
    const result = await dodoPayments.refunds.create({
      payment_id: refundRequest.payment_id,
      amount: refundRequest.amount
    });
    
    // 2. 更新本地订单
    await updateOrder(refundRequest.order_id, {
      status: 'refunded',
      refunded_at: new Date()
    });
    
    // 3. 标记 session(如有)为 refunded
    // (客户端处理)
    
    // 4. 发邮件确认
    await sendRefundEmail(refundRequest.email, result);
    
    return { success: true, refund_id: result.id };
    
  } catch (error) {
    // 退款失败 - 紧急情况
    await alertOwner({
      type: 'refund_failed',
      order_id: refundRequest.order_id,
      error: error.message
    });
    
    return { 
      success: false, 
      message: 'Refund initiated but encountered an issue. ' +
               'Our team will resolve within 24 hours.'
    };
  }
}
```

## 10.8 数据损坏

```typescript
// 加密数据无法解密

async function loadSessionSafely(sessionId: string) {
  try {
    return await loadSession(sessionId);
  } catch (error) {
    if (error.message.includes('decrypt')) {
      // 加密失败 - 可能设备指纹变了
      return {
        error: 'decryption_failed',
        recovery_options: [
          'Re-derive key from current device fingerprint',
          'Import backup from another device',
          'Start fresh (data loss)'
        ]
      };
    }
    
    throw error;
  }
}

// 数据完整性检查

async function validateSessionIntegrity(session: SessionState) {
  const issues = [];
  
  if (!session.original_question) {
    issues.push('Missing original question');
  }
  
  if (session.current_phase < 1 || session.current_phase > 5) {
    issues.push('Invalid phase number');
  }
  
  if (session.tokens_used > 100000) {
    issues.push('Token count exceeds maximum');
  }
  
  if (issues.length > 0) {
    return { valid: false, issues };
  }
  
  return { valid: true };
}
```

---

# 第 11 章 · 实施分模块路径(给 Cursor)

## 11.1 总体路径(6 Track 14 周)

```
Track 1: 计算引擎(独立工程)        Week 1-8
Track 2: 网站重构(并行)             Week 1-8
Track 3: POJU Agent(关键)           Week 5-10
Track 4: 支付 + 邮件                Week 4-10
Track 5: LLM 多语言                  Week 8-10
Track 6: 测试 + 上线                Week 11-14

并行最大化:
  - Track 1 完全独立
  - Track 2 早期独立,后期集成
  - Track 3 依赖 Track 1
  - Track 4 部分独立
  - Track 5 末期集成
  - Track 6 整合
```

## 11.2 详细时间表

### Week 1-2(启动)

```
Track 1: 计算引擎
  - 模块 1: 真太阳时校正
  - 模块 2: 八字排盘
  - 模块 3: 十神分析
  - 准备 solar_terms.json 等数据文件

Track 2: 网站重构(由 Cursor 执行)
  - Fix 05 法律页面修复(P0)
  - 全站品牌升级(POJU → pojulife)
  - AI 技术叙事更新
  - DodoPayments 准备
```

### Week 3-4

```
Track 1: 计算引擎
  - 模块 4: 大运 + 流年
  - 模块 5: 用神判断(MVP 简化版)
  - 模块 6: 风水方位(Syncro 用)

Track 2: 网站
  - Glyph 优化(对接计算引擎)
  - 5 段输出 + Exploration

Track 4: 支付
  - DodoPayments 申请提交
  - LLC 注册启动(同步)
```

### Week 5-6

```
Track 1: 计算引擎
  - 模块 7: 格局识别(需 patterns.json)
  - 模块 8: 神煞标记(需 spirits.json)
  - 模块 9: 刑冲合害判断

Track 3: POJU Agent
  - 5 Phase 状态机
  - 数据收集流程
  - 话题漂移检测
  - 滥用检测

Track 2: 网站
  - Syncro 浏览模式(本机计算)
  - 桌面端引导页
```

### Week 7-8

```
Track 1: 计算引擎
  - 模块 10: 综合诊断(关键!)
  - 模块 11: 时机判断
  - 完整测试 + 数据文件最终化

Track 3: POJU Agent
  - LLM 决策逻辑
  - 行动建议生成
  - Session 30 天 + 续期

Track 2: 网站
  - Syncro AR 模式
  - 11 步仪式流程
  - 圆形摄像头视窗
```

### Week 9-10

```
Track 3: POJU Agent
  - Phase 5 追踪
  - 与 Glyph/Syncro 协作
  - 完整测试

Track 4: 支付 + 邮件
  - DodoPayments 集成
  - 11 个邮件模板
  - Resend 集成

Track 5: LLM 多语言
  - 3 级语言判断
  - 5 语言机械拒绝词库
  - Prompt 多语言注入
```

### Week 11-12(测试)

```
Track 6: 整合测试
  - 三件套整体流程测试
  - 跨设备测试
  - 错误恢复测试
  - 支付 + 退款完整流程
  - 性能优化
```

### Week 13(软上线)

```
- 内测发布(100 用户)
- 监控关键指标
- 紧急修复
- 反馈收集
```

### Week 14(正式上线)

```
- 全面发布
- 监控
- 持续优化
```

## 11.3 MVP 模块优先级

```
P0(必需,上线前完成):
  ✓ 计算引擎模块 1, 2, 3, 4, 6, 10
  ✓ POJU 5 Phase Agent 核心
  ✓ Glyph(对接计算引擎)
  ✓ Syncro 浏览模式
  ✓ DodoPayments 集成
  ✓ 法律页面 + 合规
  ✓ 多语言(en + zh)

P1(上线后 1 个月):
  ✓ 计算引擎模块 5, 7
  ✓ Syncro AR 模式
  ✓ 多语言完整(es/fr/de)
  ✓ 邮件系统

P2(上线后 3 个月):
  ✓ 计算引擎模块 8, 9, 11
  ✓ 数据导出/导入
  ✓ Stripe(替代或补充 DodoPayments)
  ✓ 高级功能
```

## 11.4 依赖关系图

```
┌────────────────────────────────────────────────┐
│ 计算引擎 (Track 1)                            │
│   ↓ 提供 API                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         │
│ POJU Agent (Track 3) ← 依赖                    │
│ Glyph (Track 2) ← 依赖                        │
│ Syncro (Track 2) ← 依赖                       │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ 支付系统 (Track 4)                            │
│   ↓ 提供支付凭证                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         │
│ POJU $9.99 ← 依赖                             │
│ Glyph $1.99 ← 依赖                            │
│ Syncro AR $1.99 ← 依赖                        │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ 多语言系统 (Track 5)                          │
│   ↓ 提供翻译                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         │
│ 所有 UI ← 依赖                                │
│ LLM Prompts ← 依赖                            │
│ 机械拒绝词库 ← 依赖                           │
└────────────────────────────────────────────────┘
```

## 11.5 Cursor 实施清单

### Cursor 实施分批次

```
批次 A: 法律 + 品牌(P0,Week 1-2)
  - Fix 05 法律页面修复
  - 全站 "POJU" → "pojulife"
  - AI 技术叙事更新
  - Footer / Header 升级

批次 B: 支付(P0,Week 3-4)
  - DodoPayments 集成
  - /api/payments/* 路由
  - 订单管理
  - 5-minute refund window

批次 C: Glyph 优化(P0,Week 4-5)
  - 对接计算引擎
  - 5 段输出
  - 每日免费机制
  - $1.99 付费流程

批次 D: Syncro 浏览(P0,Week 5-6)
  - 浏览模式实现
  - 罗盘 UI
  - 桌面端引导页
  - 设备检测路由

批次 E: POJU Agent(P0,Week 6-9)
  - 5 Phase 状态机
  - 数据收集表单
  - LLM 集成
  - 话题约束 + 拒绝
  - 行动建议
  - 30 天 + 续期

批次 F: Syncro AR(P1,Week 9-10)
  - 11 步仪式流程
  - 摄像头 + 罗盘
  - 圆形视窗 UI
  - LLM 一次生成 40 解读

批次 G: 多语言(P1,Week 10)
  - 5 语言完整翻译
  - LLM Prompt 注入
  - 机械拒绝词库

批次 H: 邮件(P1,Week 10)
  - Resend 集成
  - 11 个模板
```

### Cursor 实施约定

```
原则 1: 模块化
  每个批次独立实施
  完成后测试 + 演示给用户审核

原则 2: 不破坏现有
  改动前备份
  渐进式发布
  保留旧版回退选项

原则 3: 严格按文档
  本文档为唯一权威
  有歧义先问,不擅自决定
  关键改动需用户确认

原则 4: 完整提交
  每批次完成后 git commit
  代码 + 测试 + 文档
  README 更新
```

---

# 第 12 章 · 数据文件需求

## 12.1 计算引擎所需数据文件

```
📁 /data/calculations/

不需要命理师创作的(纯计算):

├── solar_terms.json
│   节气精确时间表 1900-2100
│   每年 24 节气,精确到秒
│   工作量: 数据导入(开源)
│   
├── lunar_calendar.json
│   阴阳历对照表
│   工作量: 数据导入(开源)
│   
├── sexagenary_cycle.json
│   60 甲子表
│   工作量: 手写定义(1 小时)
│   
├── stem_branch_relations.json
│   - 天干地支基础属性
│   - 五行生克
│   工作量: 手写定义(2 小时)
│   
├── hidden_stems_table.json
│   地支藏干表(主气/中气/余气)
│   工作量: 手写定义(2 小时)
│   
├── ten_gods_rules.json
│   十神判断规则表
│   工作量: 手写定义(4 小时)
│   
├── zhi_relations.json
│   刑冲合害规则
│   工作量: 手写定义(3 小时)
│   
├── directions_base_elements.json
│   8 方位基础五行
│   工作量: 手写定义(1 小时)
│   
└── hour_branch_elements.json
    时辰对应五行
    工作量: 手写定义(1 小时)


需要命理师创作的:

├── patterns.json ⚠️ 命理师
│   30-60 种格局解读
│   工作量: 30-60 小时
│   
├── spirits.json ⚠️ 命理师
│   20-30 种神煞规则 + 解读
│   工作量: 20-30 小时
│   
├── yong_shen_rules.json ⚠️ 命理师审核
│   用神判断规则(MVP 简化版)
│   工作量: 命理师审核 + 优化 5 小时
│   
└── terminology_translations.json ⚠️ 关键!
    命理术语 → 现代描述映射
    用于综合诊断输出
    工作量: 命理师 50-100 小时
            翻译师 50-100 小时
            总计 100-200 小时
```

## 12.2 三件套各自所需

```
Glyph:
  /data/glyph/
  └── signs.json (现有,100 签)
      ⚠️ 已存在,保留现有定稿
      可能需要补充: wind_category 映射

Syncro:
  /data/syncro/
  └── tasks_presets.json (预设任务)
      工作量: 1-2 小时

POJU:
  无独立数据文件
  完全依赖计算引擎 + LLM
```

## 12.3 多语言翻译需求

```
需要翻译的内容:

【UI 文本】(next-intl)
  - en/common.json (基准)
  - zh/common.json
  - es/common.json
  - fr/common.json
  - de/common.json
  
  内容: 按钮、标题、提示等
  工作量: 每语言 5-10 小时

【法律文档】
  - Privacy Policy
  - Terms of Service
  - Disclaimer
  
  工作量: 每语言 10-15 小时(需法律审核)

【LLM Prompt 指令】
  - 多语言指令注入
  - 工作量: 每语言 2-3 小时

【机械拒绝词库】
  已在批次 2 完成
  
【Glyph 签文翻译】
  100 签 × 5 语言 = 500 条
  工作量: 每语言 20-30 小时(需文学功底)

【命理术语翻译】
  terminology_translations.json
  在该文件内部分语言版本
  工作量: 每语言 50-100 小时(需命理 + 文学)
```

## 12.4 数据文件创作的优先级

```
P0(MVP 上线前必需):
  ✓ 所有"纯计算"文件
  ✓ patterns.json(简化版,30 种格局)
  ✓ terminology_translations.json(en + zh)
  ✓ signs.json wind_category 映射
  ✓ UI 文本 en + zh

P1(上线后 1 个月):
  ✓ spirits.json
  ✓ patterns.json 完整版(60 种)
  ✓ terminology_translations.json (es/fr/de)
  ✓ UI 文本(es/fr/de)
  ✓ 法律文档翻译

P2(上线后 3 个月):
  ✓ Glyph 签文完整多语言
  ✓ 高级功能数据
```

## 12.5 数据创作的渠道建议

```
开源数据(免费):
  - solar_terms: 中科院紫金山天文台
  - lunar_calendar: 多个开源库
  - 60 甲子等基础: lunar-javascript 库

命理师合作(付费):
  - 渠道 1: 在豆瓣/小红书招募
    成本: 中国市场 ¥10万-30万
    周期: 3-6 个月
    质量: 高(实战派)
  
  - 渠道 2: 命理培训机构合作
    成本: 类似
    质量: 体系完整
  
  - 渠道 3: 个人命理师
    成本: 较低
    风险: 个人风格强烈

翻译师合作:
  - Fiverr / Upwork: 中等成本
  - 专业翻译公司: 高成本高质量
  - AI 辅助 + 人工审校: 性价比最高

AI 辅助创作:
  - Claude / GPT-4 生成初稿
  - 命理师 / 翻译师审校
  - 适合大批量但需把关
```

---

# 第 13 章 · 合规与风险更新

## 13.1 v4.0 合规调整

```
相比 v3.0.1 / Fix 05,v4.0 需要更新:

【主体称呼】
  ✓ pojulife (小写) - 公司主体
  ✓ POJU / Glyph / Syncro - 产品名
  (已在 Fix 05 中处理)

【支付】
  ✓ DodoPayments (主)
  ✓ Stripe (规划中)
  ✓ 不绑定单一处理器

【数据架构】
  ✓ 11 模块计算结果存本地
  ✓ User Profile 加密在 IndexedDB
  ✓ 服务器仅订单凭证

【LLM 调用】
  ✓ 多 LLM 备选(Claude / GPT / Gemini)
  ✓ ZDR 强调
  ✓ Transformer 架构叙事

【新产品功能】
  ✓ Syncro AR 摄像头权限
  ✓ Syncro AR 位置使用
  ✓ Glyph 每日 1 次免费

需要更新的法律文档:
  - Terms 第 3 节:加入 Glyph/Syncro 定价说明
  - Privacy 第 X 节:摄像头使用条款
  - Privacy 第 X 节:位置数据使用
  - Disclaimer:维持现状(Fix 05 已处理)
```

## 13.2 LLM 输出边界

```
绝对禁止(任何产品):
  ✗ 预测具体事件
  ✗ 给医疗建议
  ✗ 给法律建议
  ✗ 给具体投资建议
  ✗ 暴露命理术语
  ✗ 替用户做决定
  ✗ 评论政治人物
  ✗ 涉及成人内容

允许(在合规框架内):
  ✓ 描述命理"模式"(用现代语言)
  ✓ 给出"视角"(不是答案)
  ✓ 建议反思方向
  ✓ 建议小行动(POJU Phase 4)
  ✓ 描述"时机倾向"(不是预测)

边界示例:

✗ 错误:
  "Your hexagram shows you will succeed in this venture"
  
✓ 正确:
  "The patterns suggest this venture aligns with your 
   natural strengths. The current period favors action 
   over deliberation."

✗ 错误:
  "You should leave this relationship"
  
✓ 正确:
  "Based on what you've shared, there's a tension between 
   what you value (X) and what this relationship offers (Y). 
   How you weigh these is yours to decide."

✗ 错误:
  "Take this medication for your anxiety"
  
✓ 正确:
  "If anxiety is affecting your daily life, please consult 
   a healthcare professional. POJU is not designed to 
   diagnose or treat mental health conditions."
```

## 13.3 退款机制实现

```
完整退款条件(写在 Terms):

POJU ($9.99):
  ✓ 5-minute window: 自动全额退款(无需理由)
  ✓ Technical failure: 7 天内全额(需举证)
  ✓ Duplicate charge: 全额(立即)
  ✓ Unstarted session: 24 小时内 + 0 轮对话

Glyph 付费 ($1.99):
  ✓ Technical failure: 7 天内
  ✓ Duplicate charge: 全额
  - 一旦使用,不退(LLM 已调用)

Syncro AR ($1.99):
  ✓ Technical failure: 7 天内
  ✓ 摄像头/罗盘无法工作: 全额
  ✓ Duplicate charge: 全额
  - 一旦 LLM 生成,不退

不退款情形:
  ✗ "不满意" - 无客观标准
  ✗ "改变主意" - 数字商品已交付
  ✗ 滥用导致 session 终止
```

## 13.4 用户主权保障

```
合规清单:

✓ 完全不需要账号
✓ 数据全本地,用户可清除
✓ 支付后才需邮箱(发票)
✓ 不发营销邮件
✓ 不卖数据(没有数据可卖)
✓ 不追踪用户行为(无 Google Analytics 等)
✓ 用户可随时退款(明确规则)

GDPR 合规:
  ✓ 数据最小化:服务器仅存订单
  ✓ 用户权利:导出 + 删除 + 修改
  ✓ 透明度:明确告知 LLM 处理
  ✓ 合法基础:合同履行(支付凭证)+ 用户同意(LLM 调用)

CCPA 合规:
  ✓ 不卖数据
  ✓ 用户可知数据使用情况
  ✓ 用户可删除
```

## 13.5 关键风险评估

```
【商业风险】

风险 1: DodoPayments 拒绝申请
  概率: 中等
  影响: 高(无法上线收款)
  缓解:
  ✓ 提前申请 Stripe + Atlas LLC
  ✓ 准备完整文档
  ✓ 包装"AI decision tool"避免被识别为占卜

风险 2: 用户留存低
  概率: 中等
  影响: 高
  缓解:
  ✓ Glyph 每日免费养习惯
  ✓ Archive 提醒回访
  ✓ POJU 30 天 + 续期

风险 3: 命理准确性受质疑
  概率: 中等
  影响: 中
  缓解:
  ✓ 强调"perspective not prediction"
  ✓ 计算层精确(减少错误)
  ✓ 多 LLM 备选(避免单一偏见)

【技术风险】

风险 4: LLM 输出不稳定
  概率: 中等
  影响: 高
  缓解:
  ✓ 结构化输出 + 验证
  ✓ 多 LLM 备选
  ✓ Prompt 持续优化

风险 5: 计算引擎错误
  概率: 中等
  影响: 高
  缓解:
  ✓ MVP 简化版,标注 confidence
  ✓ 推荐开源库(已验证)
  ✓ 持续测试

风险 6: 数据加密失败
  概率: 低
  影响: 高(用户数据丢失)
  缓解:
  ✓ 提供导出功能
  ✓ 提示用户定期备份
  ✓ 服务器仅订单(可恢复支付)

【合规风险】

风险 7: 占卜定位被识别
  概率: 中等
  影响: 极高(支付被拒)
  缓解:
  ✓ 严格的 Prompt 边界
  ✓ 法律文档强调"decision tool"
  ✓ AI 技术叙事(Transformer + 多 LLM)
  ✓ 不在网站任何地方提"算命""易经""八字"

风险 8: GDPR 投诉
  概率: 低
  影响: 中
  缓解:
  ✓ 数据最小化设计
  ✓ 透明度政策
  ✓ 用户控制权完整
```

## 13.6 上线前合规检查清单

```
法律文档:
  □ Disclaimer 完整(Fix 05)
  □ Privacy Policy 主体升级 + AI 章节
  □ Terms 主体升级 + 退款条款
  □ Contact 升级为 pojulife
  □ 中文占位符全部清除
  □ 5 语言版本(en + zh 必需,其他可后)

支付:
  □ DodoPayments 申请通过
  □ 5-minute refund 机制实现
  □ 退款 API 测试
  □ 订单存储 7 年

数据:
  □ IndexedDB 加密验证
  □ 设备指纹生成正常
  □ 数据导出功能
  □ 30 天归档自动化

LLM:
  □ ZDR 在 Anthropic 启用
  □ 多 LLM 备选切换测试
  □ Token 监控正常
  □ Prompt 边界严格

UI/UX:
  □ Cookie 提示(EU)
  □ 多语言切换正常
  □ 移动端 + PWA
  □ 摄像头权限引导(Syncro)

监控:
  □ 错误日志正常
  □ 支付成功率监控
  □ 退款率监控
  □ LLM 调用成功率
```

---

# 附录 A · Prompts 完整版

## A.1 POJU System Prompts

```
所有 5 个 Phase 的完整 Prompts 在批次 2 第 6.2 节
本附录引用,不重复
```

## A.2 Glyph System Prompt

```
完整 Prompt 在批次 2 补丁文档第 4.7 节
更新版本(包含 Exploration)
```

## A.3 Syncro System Prompts

```
- 浏览模式:无 LLM 调用,不需要 Prompt
- AR 任务模式:批次 2 第 6.4 节
```

## A.4 多语言指令模板

```
完整模板在批次 2 第 6.5 节
```

## A.5 机械拒绝词库(5 语言)

```
完整词库在批次 2 第 6.6 节
```

---

# 附录 B · 数据格式 Schema 全集

```
所有 TypeScript 接口定义:

【计算引擎】
- BaziInput / BaziOutput (第 2.2 节)
- TenGodsInput / TenGodsOutput
- DaYunInput / DaYunOutput
- YongShenInput / YongShenOutput
- DirectionsInput / DirectionsOutput
- PatternInput / PatternOutput
- SpiritsInput / SpiritsOutput
- RelationsInput / RelationsOutput
- DiagnosisInput / DiagnosisOutput ⭐
- TimingInput / TimingOutput

【Agent】
- SessionState (第 3.2 节)
- LLMResponse
- Action
- Message
- DataCollectionState

【数据库】
- UserProfileRecord (第 7.2 节)
- DeviceInfoRecord
- POJUSessionRecord
- POJUArchiveRecord
- GlyphHistoryRecord
- GlyphUsageRecord
- SyncroTaskRecord
- SyncroCacheRecord

【API】
- 所有 Request / Response 接口(第 8 章)

【Glyph】
- GlyphReport (5 段结构,补丁文档)

完整定义保留在各章节相应位置
```

---

# 附录 C · 与 v3.0.1 详细对比

```
v3.0.1 → v4.0 主要变化:

【架构】
v3.0.1: 三件套独立
v4.0: 三件套共享 11 个计算模块 + User Profile

【POJU】
v3.0.1: 单纯 LLM 对话
v4.0: 5 Phase 动态 Agent + 数据收集硬性 + 行动建议追踪

【Glyph】
v3.0.1: 出生日期 → LLM(70% 5 风 + 30% 签文)
v4.0: 11 模块计算 + 签文 → LLM(5% 5 风 + 60% 签文 + Exploration)

【Syncro】
v3.0.1: 单一浏览模式
v4.0: 双模式(浏览免费 + AR 付费 $1.99)

【商业模型】
v3.0.1: POJU $9.99 / Glyph 免费 / Syncro 免费
v4.0: POJU $9.99 / Glyph 1 次免费/$1.99 / Syncro 浏览免费/AR $1.99

【品牌】
v3.0.1: POJU (兼公司主体 + 产品名)
v4.0: pojulife (公司) + POJU/Glyph/Syncro (产品)

【支付】
v3.0.1: Stripe
v4.0: DodoPayments(早期) + Stripe(后期)

【LLM 策略】
v3.0.1: 单一厂商(Claude)
v4.0: 多厂商备选(Claude 主 / GPT / Gemini)

【法律 / 合规】
v3.0.1: 较粗
v4.0: 详细(Fix 05 + AI 技术叙事 + 30 天 + 5-minute refund)

【数据架构】
v3.0.1: 本地为主
v4.0: 本地为主 + 加密 + 共享 Profile + Archive 机制

【多语言】
v3.0.1: 计划但未详细
v4.0: 5 语言 + 3 级判断 + 机械拒绝词库

【新功能】
v4.0 全新:
  + 11 个本地计算模块
  + Syncro AR 任务模式
  + Glyph Exploration 段落
  + 设备指纹防薅羊毛
  + Session 30 天 + 续期 + Archive
  + 5-minute refund window
```

---

# 文档总结

```
POJU Development Document v4.0 完整文档:

📄 POJU_v4.0_Batch1.md (80KB)
   - 序章
   - 第 1 章: 架构总览
   - 第 2 章: 11 个计算模块
   - 第 3 章: POJU 动态 Agent

📄 POJU_v4.0_Batch2.md (74KB)
   - 第 4 章: Glyph 重新设计
   - 第 5 章: Syncro 双模式
   - 第 6 章: System Prompt 设计

📄 POJU_v4.0_Batch2_Patch.md (35KB)
   - Glyph 5 段(加 Exploration)
   - Syncro 完整仪式流程
   - 桌面端引导页
   - Glyph UI 保留现有定稿

📄 POJU_v4.0_Batch3.md (本文档,~80KB)
   - 第 7 章: 数据存储升级
   - 第 8 章: API 设计
   - 第 9 章: UI/UX 流程
   - 第 10 章: 错误处理 + 边界
   - 第 11 章: 实施分模块路径
   - 第 12 章: 数据文件需求
   - 第 13 章: 合规与风险更新
   - 附录 A/B/C

总计: ~270KB / 9000+ 行
完整覆盖 pojulife v4.0 的所有设计

下一步:
  1. 阅读所有 4 份文档(总览 v4.0)
  2. Cursor 按批次实施(P0 → P1 → P2)
  3. 持续迭代
```

---

**v4.0 设计文档全部完成。请审视后告诉我后续步骤。**
