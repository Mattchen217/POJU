# 13 · 支付取消回跳 `/?cancelled=true`

## 页面身份

| 项 | 值 |
|---|---|
| 路由 | `/?cancelled=true` |
| 文件位置 | 复用 `app/(marketing)/page.tsx`（落地页） + 额外的 Toast 逻辑 |
| 页面标题 | `POJU — Ancient Wisdom, AI-Powered. Made for You.`（同落地页） |
| 目标用户 | 在 Stripe Checkout 中**取消支付**后回来的用户 |
| 核心目标 | 告知用户支付已取消（**未扣款**），让用户知道可以随时回来 |
| 优先级 | 中（Task 5） |
| 所属 Task | Task 5 |

---

## 访问条件

- 从 Stripe Checkout "返回" 或"取消"按钮触发
- URL 带 `cancelled=true` 参数
- 所有人可访问（但通常只有刚取消支付的用户到达）

---

## 页面结构清单

本页面 = **落地页内容 + 顶部短暂 Toast 提示**

1. Toast 通知（页面顶部，约 100px）
2. 正常落地页内容（同 `01-landing.md`）

---

## 区块详细内容

### 1. Toast 通知

**位置**：页面顶部，固定定位

**样式**：
- 毛玻璃背景
- 紫色边框
- 约 100px 高
- 从顶部滑入（300ms）
- 5 秒后自动淡出（或用户手动关闭）

**内容**：

```
┌──────────────────────────────────────────┐
│                                          │
│   ✦ Payment cancelled. No charge         │
│     was made.                            │
│                                          │
│   [ Try again ]  [ Dismiss ]             │
│                                          │
└──────────────────────────────────────────┘
```

**关键文字**：
- 主信息：`Payment cancelled. No charge was made.`
- **强调"没扣款"**，消除用户担忧

**按钮**：

#### `Try again`
- 样式：Primary 紫色 pill（小尺寸）
- 点击行为：重新触发 Stripe Checkout
- 使用之前点击 CTA 的来源 metadata（从 URL 的 `from` 参数读，如 `?cancelled=true&from=landing_hero`）

#### `Dismiss`
- 样式：Tertiary 文字按钮
- 点击行为：关闭 Toast，保留在落地页

### 2. 落地页主体

完全同 `@docs/pages/01-landing.md` 的 9 屏内容。

Toast 不影响页面正常浏览。

---

## 功能与交互

### Toast 触发

```typescript
useEffect(() => {
  const url = new URL(window.location.href);
  const cancelled = url.searchParams.get('cancelled');
  
  if (cancelled === 'true') {
    showCancelToast();
    
    // 清除 URL 参数（防止刷新重复显示）
    url.searchParams.delete('cancelled');
    // 保留 from 参数以便 retry
    const fromParam = url.searchParams.get('from');
    window.history.replaceState({}, '', url.pathname + (fromParam ? `?from=${fromParam}` : ''));
  }
}, []);
```

### Retry 逻辑

```typescript
async function handleRetry() {
  const url = new URL(window.location.href);
  const source = url.searchParams.get('from') || 'landing_retry';
  
  const response = await fetch('/api/payment/checkout', {
    method: 'POST',
    body: JSON.stringify({ source }),
  });
  
  const { url: checkoutUrl } = await response.json();
  window.location.href = checkoutUrl;
}
```

### Dismiss 逻辑

- Toast 淡出动画（300ms）
- 移除 Toast 组件

### 自动消失

- 5 秒后自动淡出（如果用户没交互）
- 可配置时长

---

## 数据依赖

### 需要读写的存储

- **无持久化存储**

### 需要调用的 API

- `POST /api/payment/checkout`（Retry 时）

---

## 响应式行为

### Desktop

- Toast 顶部居中，最大宽度 480px
- 距顶部 24px

### Mobile

- Toast 全宽（左右留 16px 边距）
- 距顶部 16px
- 按钮排列调整为纵向（如果横向放不下）

---

## 空状态与错误状态

### Stripe Checkout 再次失败

点击 `Try again` 后若 Stripe 调用失败：
- Toast 替换为错误提示：`Something went wrong. Try again or contact support@pojulife.com.`

### URL 参数丢失

用户如果直接访问 `/` 根路径（无 `cancelled=true`）：
- **不显示 Toast**
- 正常显示落地页

---

## 验收标准

- [ ] Stripe Checkout 取消按钮 → 跳 `/?cancelled=true&from=xxx`
- [ ] 页面顶部 Toast 短暂显示
- [ ] Toast 内容明确说"No charge was made"
- [ ] `Try again` 按钮重新触发 Checkout
- [ ] `Dismiss` 按钮关闭 Toast
- [ ] 5 秒后 Toast 自动淡出
- [ ] URL 参数在 Toast 显示后清除（不影响分享或刷新）
- [ ] 落地页主体正常显示，用户可自由浏览
- [ ] Mobile 下 Toast 响应式良好
- [ ] 从不同 CTA 来的取消都能正确 retry（metadata 保留）

---

## 关联资源

### 相关文档

- `@docs/pages/01-landing.md` — 落地页主体
- `@docs/pages/12-payment-callback.md` — 支付成功回跳
- `@docs/POJU_Development_Document_v3.0.1_Final.md` — 第 08.1 支付

### 关键约束

- **必须告知用户"没扣款"**（降低焦虑）
- **不挽留**（违反 Never Manipulative）——Dismiss 按钮要明显
- **Retry 保留 metadata**（保持数据追踪连续性）
- Toast **短暂**（5 秒），不要阻塞用户阅读

---

✦
