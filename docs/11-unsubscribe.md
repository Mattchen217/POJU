# 11 · 取消邮件订阅 `/unsubscribe`

## 页面身份

| 项 | 值 |
|---|---|
| 路由 | `/unsubscribe?token=xxx` |
| 文件位置 | `app/(marketing)/unsubscribe/page.tsx` |
| 页面标题 | `Unsubscribe — POJU` |
| 目标用户 | 收到 PDF 邮件或 check-in 邮件后想取消的用户 |
| 核心目标 | 提供一键退订机制，**立即从数据库物理删除邮箱**，符合 CAN-SPAM 法 |
| 优先级 | **必须**（Task 5） |
| 所属 Task | Task 5 |

---

## 访问条件

- 所有人可访问
- URL 必须带 `token` 参数（从邮件内嵌链接获取）
- Token 是一次性且时效性的，服务端存储
- 无需登录

---

## 页面结构清单

1. 顶部区（POJU Logo）
2. 状态显示（三种情况之一）：
   - Token 有效：立即退订 + 确认信息
   - Token 无效 / 过期
   - Token 处理中（加载状态）
3. 返回按钮
4. Footer

---

## 区块详细内容

### 场景 A · Token 有效（正常退订）

#### 视觉

居中卡片（玻璃态），内容如下：

```
┌──────────────────────────────────┐
│                                  │
│           ✦ POJU                 │
│                                  │
│      You've been unsubscribed.   │
│                                  │
│   Your email has been deleted    │
│   from our servers.              │
│                                  │
│   This was the only email we     │
│   had about this topic.          │
│                                  │
│   ──────                         │
│                                  │
│   You can come back anytime      │
│   without leaving anything       │
│   behind.                        │
│                                  │
│   [ Return to POJU ]             │
│                                  │
└──────────────────────────────────┘
```

**关键元素**：
- 大号 ✓ 或 ✦ 图标（成功感）
- 标题：`You've been unsubscribed.`
- 强调文字：`Your email has been deleted from our servers.`
- 说明段：
  ```
  This was the only email we had about this topic.
  ```
- 分隔线
- 安抚段：
  ```
  You can come back anytime without leaving anything behind.
  ```
- 按钮：`Return to POJU` → 跳转 `/`

---

### 场景 B · Token 无效 / 过期

#### 视觉

居中卡片，内容如下：

```
┌──────────────────────────────────┐
│                                  │
│           ✦ POJU                 │
│                                  │
│   This unsubscribe link has      │
│   expired or is invalid.         │
│                                  │
│   If you're still receiving      │
│   emails, please contact         │
│   support@pojulife.com           │
│   and we'll remove you           │
│   immediately.                   │
│                                  │
│   [ Contact Support ]            │
│   [ Return to POJU ]             │
│                                  │
└──────────────────────────────────┘
```

**触发条件**：
- Token 在数据库中不存在（可能已被删除或从未存在）
- Token 已过期（创建超过 30 天）
- Token 已被使用过一次

**按钮行为**：
- `Contact Support` → `mailto:support@pojulife.com?subject=Unsubscribe%20request`
- `Return to POJU` → 跳转 `/`

---

### 场景 C · 处理中（加载状态）

首次加载页面时短暂出现：

```
┌──────────────────────────────────┐
│                                  │
│        ✦ POJU                    │
│                                  │
│   Processing your request...     │
│                                  │
│   [加载动画：紫色粒子旋转]        │
│                                  │
└──────────────────────────────────┘
```

一般 1-2 秒内切换到场景 A 或 B。

---

## 功能与交互

### 自动处理流程

页面加载时**自动执行**：

```typescript
useEffect(() => {
  const token = new URLSearchParams(window.location.search).get('token');
  
  if (!token) {
    setState('invalid');
    return;
  }
  
  fetch('/api/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setState('success');
      } else {
        setState('invalid');
      }
    })
    .catch(() => setState('invalid'));
}, []);
```

用户**不需要点击任何"确认退订"按钮**——访问链接即退订。这是 CAN-SPAM 法的最佳实践。

### 后端 API 行为

`POST /api/unsubscribe`：

1. 验证 token 在 `scheduled_emails` 表中存在
2. 查询关联的邮箱
3. 取消所有该邮箱对应的未来 scheduled emails（调 Resend API）
4. **立即删除数据库中该邮箱字段**（物理删除，不是软删除）
5. 返回成功

### 不需要的元素

- ❌ "Are you sure you want to unsubscribe?" 挽留弹窗（违反 Never Manipulative）
- ❌ "Why are you leaving?" 反馈调查（增加阻力）
- ❌ "Reduce emails instead" 替代选项（没有此逻辑）

**一键退订，立即生效，显示确认**。这是 POJU 品牌承诺的延伸。

---

## 数据依赖

### 需要调用的 API

- `POST /api/unsubscribe`（自动触发）

### 需要读写的存储

- **无本地存储**
- 服务端：
  - 查询 `scheduled_emails` 表
  - 删除对应行（或更新 status 为 `unsubscribed` 并 NULL 化 email 字段）

### Token 结构

- 格式：UUID v4 或类似（无可读信息）
- 服务端生成，与邮件 `scheduled_emails` 行一对一
- 有效期：30 天（超过则自动失效）

---

## 响应式行为

### Desktop / Tablet / Mobile

- 卡片居中
- 最大宽度 480px
- 完全响应式，所有设备一致

---

## 空状态与错误状态

### URL 无 token 参数

显示场景 B（无效链接）

### API 调用失败

- 显示：`Something went wrong. Try again or contact support@pojulife.com.`
- 重试按钮

### 网络断开

- 显示：`Connection error. Check your network and try again.`

---

## 验收标准

- [ ] 访问 `/unsubscribe?token=valid_token` → 自动退订成功
- [ ] 显示"You've been unsubscribed"确认页
- [ ] 数据库中对应 email 字段立即清空
- [ ] 访问 `/unsubscribe?token=invalid_token` → 显示无效链接页
- [ ] 访问 `/unsubscribe`（无 token）→ 显示无效链接页
- [ ] Contact Support 和 Return to POJU 按钮工作
- [ ] 加载状态 UI 短暂出现（1-2 秒内切换）
- [ ] **不显示任何挽留 / 反馈问卷**
- [ ] 退订后，Resend 中对应 scheduled emails 被取消
- [ ] 页面在所有设备响应式良好
- [ ] 页面可直接从邮件客户端打开（一些邮件客户端对 link 严格）

---

## 关联资源

### 相关文档

- `@docs/POJU_Development_Document_v3.0.1_Final.md` — 第 08.2 邮件系统
- `@docs/pages/08-privacy.md` — 隐私政策（邮箱处理说明）
- `@docs/pages/10-contact.md` — 联系方式（备选退订路径）

### 关键约束

- **一键退订**（无确认步骤）
- **立即生效**（不延迟）
- **邮箱物理删除**（不是软删除）
- 符合 CAN-SPAM 法和 GDPR 要求

---

✦
