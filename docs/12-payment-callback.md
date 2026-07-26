# 12 · 支付成功回跳 `/chat?token=xxx`

## 页面身份

| 项 | 值 |
|---|---|
| 路由 | `/chat?token=xxx` |
| 文件位置 | `app/(product)/chat/page.tsx`（复用 Chat 页面 + Token 处理逻辑） |
| 页面标题 | `POJU Session` |
| 目标用户 | 刚完成 Stripe 支付 `$9.99` 的用户 |
| 核心目标 | 换取 Session Token，存入 IndexedDB，加载 Chat 页面 |
| 优先级 | **最高**（Task 5） |
| 所属 Task | Task 5 |

---

## 访问条件

- 用户从 Stripe Checkout 成功完成支付后自动重定向到此 URL
- URL 必须带 `token` 参数（Stripe 传来）
- Token 是一次性的，首次进入后消费掉

---

## 页面结构清单

1. 过渡加载屏
2. 正常 Chat 页面（加载成功后）
3. 错误回跳（Token 验证失败）

---

## 区块详细内容

### 1. 过渡加载屏（Token 换取期间）

**首次进入 `/chat?token=xxx` 显示**。

**布局**：全屏居中

**内容**：

```
┌──────────────────────────────────┐
│                                  │
│         ✦ POJU                   │
│                                  │
│   Preparing your session...      │
│                                  │
│   [加载动画：粒子旋转]            │
│                                  │
│   Your payment is confirmed.     │
│                                  │
└──────────────────────────────────┘
```

**加载动画**：
- 紫色粒子缓慢旋转
- 3-5 秒内完成
- 避免"白屏感"

**动态文字**（可选，每 1 秒切换）：
```
Confirming your payment...
Generating your session token...
Loading the space...
```

---

### 2. Token 换取逻辑

**自动执行流程**：

```typescript
useEffect(() => {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('token');
  
  if (!token) {
    // 无 token，可能是直接访问 /chat
    // 检查 IndexedDB 是否有已有 Session
    checkExistingSession();
    return;
  }
  
  // 有 token，走支付回跳流程
  exchangeTokenForSession(token);
}, []);

async function exchangeTokenForSession(token: string) {
  try {
    const response = await fetch('/api/payment/exchange-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    
    if (!response.ok) {
      throw new Error('Token exchange failed');
    }
    
    const { session_id, metadata } = await response.json();
    
    // 1. 存入 IndexedDB
    await db.sessions.add({
      id: session_id,
      created_at: new Date(),
      status: 'active',
      source: metadata.source,  // e.g. "landing_hero"
      linked_oracle_signs: metadata.oracle_sign_id 
        ? [metadata.oracle_sign_id] 
        : [],
    });
    
    // 2. 清除 URL 上的 token 参数
    window.history.replaceState({}, '', '/chat');
    
    // 3. 加载正式 Chat 页面
    setState('ready');
    
    // 4. 显示付款后首次提示 Toast
    showWelcomeToast();
    
  } catch (error) {
    setState('error');
  }
}
```

### Metadata 传递

Stripe 支付时根据来源传递不同 metadata：

- `source: "landing_hero"` → 无特殊处理
- `source: "oracle_hook"` → 传入 `oracle_sign_id`，Chat 载入后 AI 第一句话引用该签
- `source: "syncro_hook"` → 传入 `syncro_entry_id`，Chat 载入后 AI 第一句话引用该方位

### AI 首次发言的个性化

根据 metadata 不同，AI 打开 Chat 的第一句话不同：

**从 Oracle 钩子来**：
```
I see you drew a Calm Current sign about "ending your 
relationship." Let's look at what's really underneath 
that question.

Tell me: when did this "ending" first cross your mind?
```

**从 Syncro 钩子来**：
```
So you stood at "My desk, facing northwest" at 3:47 PM 
— and something felt worth paying to dig into.

What were you trying to do there that didn't flow?
```

**直接付费（从落地页）**：
```
Before I can answer you, I need to see who you are.

Tell me:
· Your birth: year, month, day
· Rough time (morning/afternoon/etc — approximate is fine)
· What's happening that made you come here?
```

---

### 3. 错误处理

#### 3.1 Token 验证失败（罕见）

**可能原因**：
- Webhook 处理中还未完成
- Token 已过期（超过 10 分钟）
- Token 已被使用过

**UI**：

```
┌──────────────────────────────────┐
│                                  │
│        ✦ POJU                    │
│                                  │
│   We're confirming your          │
│   payment. This usually takes    │
│   a moment.                      │
│                                  │
│   [加载动画继续]                  │
│                                  │
│   Attempting retry 1/3...        │
│                                  │
└──────────────────────────────────┘
```

**自动重试 3 次**，每次间隔 5 秒。

#### 3.2 3 次重试后仍失败

```
┌──────────────────────────────────┐
│                                  │
│        ✦ POJU                    │
│                                  │
│   Something went wrong.          │
│                                  │
│   Don't worry — your payment     │
│   is safe. Please contact us:    │
│                                  │
│   support@easternos.com           │
│                                  │
│   Reference: [Stripe session ID] │
│                                  │
│   [ Contact Support ]            │
│   [ Try Again ]                  │
│                                  │
└──────────────────────────────────┘
```

**关键**：
- 明确告知用户**"你的钱没丢"**，降低恐慌
- 提供 Stripe session ID 作为查询凭证
- `Contact Support` → `mailto:support@easternos.com?subject=POJU%20Payment%20Recovery&body=My%20Stripe%20session%20ID:%20cs_xxx`
- `Try Again` → 重新加载页面

---

## 功能与交互

### 首次加载流程

1. 用户从 Stripe Checkout 完成支付
2. Stripe 重定向到 `/chat?token=cs_xxx`
3. 页面加载 → 显示"Preparing your session..."
4. 并行触发：
   - 调用 `/api/payment/exchange-token`
   - 加载 Chat 页面基础组件（布局 / 左侧栏等）
5. Token 换取成功 → 存入 IndexedDB → 清除 URL → 显示完整 Chat
6. Chat 顶部出现付款后首次 Toast（见 `18-modal-chat-welcome.md`）

### URL 清理

Token 换取成功后，**立即**清除 URL 上的 token 参数：

```typescript
window.history.replaceState({}, '', '/chat');
```

**原因**：
- Token 是一次性的，留在 URL 上无意义
- 用户分享 URL 时不能泄露
- 刷新页面不应该重新调 API

### Webhook 异步处理

Stripe webhook (`/api/payment/webhook`) 在支付成功时异步触发。

**竞态问题**：用户可能在 webhook 处理完成前就到达 `/chat?token=xxx`。

**解决方案**：
- Webhook 写入 `payment_records` 表
- `/api/payment/exchange-token` 查询此表
- 如未找到，返回 "pending" → 前端重试 3 次

---

## 数据依赖

### 需要读写的存储

**IndexedDB** (encrypted):
- 写入 `sessions` 表（创建新 Session）

**localStorage**:
- 写入 `pojulife_chat_welcome_seen_[sessionId] = false`（让 Toast 显示）

### 需要调用的 API

- `POST /api/payment/exchange-token`
  - Input: `{ token: string }`
  - Output: `{ session_id, metadata, success }`

### 服务端查询

后端收到 exchange 请求：
```sql
SELECT * FROM payment_records 
WHERE stripe_session_id = ? AND status = 'succeeded' AND token_consumed = false;
```

找到 → 生成 session_id → 标记 token_consumed = true → 返回 session_id

---

## 响应式行为

- 全屏居中，所有设备统一体验
- 加载动画 60fps

---

## 空状态与错误状态

### 特殊情况

**用户通过浏览器 Back 按钮回到支付前页面又回来**：
- URL 上的 token 仍在
- Token 已被使用（`token_consumed = true`）
- 后端返回"Token already consumed"
- 前端：检查 IndexedDB 是否已有对应 Session
  - 有 → 直接跳 Chat 页（不重复创建）
  - 无 → 显示错误（罕见）

---

## 验收标准

- [ ] Stripe 支付成功 → 自动跳 `/chat?token=xxx`
- [ ] 加载屏平滑出现，不白屏
- [ ] Token 换取成功后，URL 清除 token 参数
- [ ] IndexedDB 中新增 Session 条目
- [ ] Chat 页面正常加载，含付款后提示 Toast
- [ ] AI 首条消息根据 metadata 个性化（Oracle / Syncro / 直接付费）
- [ ] Token 换取失败 → 自动重试 3 次
- [ ] 3 次失败后显示"don't worry, payment safe"错误页
- [ ] 错误页的 `Contact Support` 链接预填 Stripe session ID
- [ ] 浏览器 Back 回到支付前 + 回来 → 不重复创建 Session
- [ ] 不同支付来源（hero / hook / final）都工作

---

## 关联资源

### 相关文档

- `@docs/POJU_Development_Document_v3.0.1_Final.md` — 第 08.1 支付
- `@docs/pages/05-chat.md` — Chat 页面主体
- `@docs/pages/18-modal-chat-welcome.md` — 付款后首次 Toast
- `@docs/pages/13-payment-cancel.md` — 取消支付的回跳

### 关键约束

- **支付安全 > 用户体验**：宁可重试 3 次也不能让用户丢钱
- **明确告知用户钱的去向**：任何错误都要说明 "your payment is safe"
- **幂等**：同一 token 多次消费不能重复创建 Session
- **Metadata 精确传递**：Oracle / Syncro 钩子来的用户要个性化欢迎

---

✦
