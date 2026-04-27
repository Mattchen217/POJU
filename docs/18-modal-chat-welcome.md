# 18 · 付款后首次进入 Chat 的提示 Toast（全局）

## 组件身份

| 项 | 值 |
|---|---|
| 类型 | 非阻塞式 Toast 提示 |
| 文件位置 | `components/chat/ChatWelcomeToast.tsx` |
| 触发位置 | `/chat` 页面首次加载（首次付费用户） |
| 目标用户 | 刚完成 Stripe 支付、首次进入 Chat 的用户 |
| 核心目标 | 温和提醒"对话只存本设备"这一品牌核心承诺 |
| 优先级 | 必须（Task 2） |
| 所属 Task | Task 2 |

---

## 触发条件

### 必须同时满足（用 AND）

1. 用户在 `/chat` 页面
2. 有有效 Session Token（已付费）
3. 当前 Session 的 localStorage 中没有 `pojulife_chat_welcome_seen_[sessionId]`

### 何时不触发

- Session 内已看过此 Toast（已记录 flag）
- 用户从 Archive Resume 一个旧 Session（不是首次付费）

---

## 触发时机

Chat 页面加载完成后 **500ms 延迟**显示：
- 太快 → 页面还在渲染，视觉混乱
- 延迟 500ms → Chat 界面已稳定显示，Toast 平滑出现

---

## 视觉布局

**顶部 Toast**（不是 Modal，是轻量提示）：

**位置**：主 Chat 区域顶部，距离顶部元数据条 16px

**样式**：
- 毛玻璃背景（`rgba(139, 92, 246, 0.1) + backdrop-blur(24px)`）
- 紫色边框（`rgba(167, 139, 250, 0.3)`）
- 圆角 lg（16px）
- 内边距合适

**内容**：

```
┌──────────────────────────────────────────┐
│                                          │
│ 🔒 This conversation lives only on       │
│    this device. Close to delete.         │
│                                          │
│    [ I understand ]                      │
│                                          │
└──────────────────────────────────────────┘
```

### 元素细节

**左侧图标**：🔒（或自定义锁形 SVG，紫色）

**主文本**：`This conversation lives only on this device. Close to delete.`

**按钮**：`I understand`
- 样式：Secondary 紫色 pill（小尺寸）
- 单一按钮，**没有"Learn more"或其他选项**（保持简洁）

### 布局

- 全宽显示（主区域宽度）
- 左图标 + 中间文字 + 右按钮的水平排列
- 移动端垂直堆叠（图标 + 文字一行 + 按钮换行）

---

## 动画

### 出现动画

- 延迟 500ms 后触发
- 从顶部滑入 + 淡入（`translateY(-20px) → 0, opacity 0 → 1`）
- 持续 400ms
- 缓动：`ease-smooth`

### 关闭动画

- 点击 `I understand` 后
- 淡出 + 向上滑出（300ms）
- 完成后从 DOM 移除

### 自动消失

- **不自动消失**（与 Landing 页的 Toast 不同）
- 必须用户点击 `I understand` 才关闭
- 原因：这是重要的品牌承诺告知，不能一晃而过

---

## 功能与交互

### 显示逻辑

```typescript
useEffect(() => {
  const sessionId = currentSessionId;
  if (!sessionId) return;
  
  const seenKey = `pojulife_chat_welcome_seen_${sessionId}`;
  const hasSeen = localStorage.getItem(seenKey);
  
  if (!hasSeen) {
    // 延迟 500ms 显示
    const timer = setTimeout(() => {
      setShowToast(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }
}, [currentSessionId]);
```

### 点击 `I understand`

```typescript
function handleUnderstand() {
  localStorage.setItem(
    `pojulife_chat_welcome_seen_${currentSessionId}`, 
    'true'
  );
  setShowToast(false);
}
```

### 键盘支持

- Tab 键可以聚焦到按钮
- Enter 键激活按钮
- ESC 键 = 等同于点击 `I understand`（快捷关闭）

### 关闭后不再显示

- 同一 Session 内：刷新页面不会重弹
- 切换到其他 Session：如果是新付费 Session，会再次显示（因为 sessionId 不同）
- 从 Archive Resume 旧 Session：不显示（因为有旧的 flag）

---

## 为什么不用 Modal

考虑过用阻塞式 Modal，但决定用**非阻塞 Toast**，原因：

1. **用户刚付费完进入** —— 情绪上是"迫不及待想开始"，不应该再塞一个阻塞弹窗
2. **信息不复杂** —— 一句话就能理解，不需要 Modal 的重量感
3. **允许用户同时看 Chat 界面** —— Toast 不遮挡欢迎引导区

---

## 数据依赖

### 需要读写的存储

**localStorage**:
- 读写 `pojulife_chat_welcome_seen_${sessionId}`

### 需要调用的 API

- 无

### 依赖

- 当前 Session ID（从 Chat store / IndexedDB 读取）

---

## 响应式行为

### Desktop

- Toast 宽度 = 主区域宽度 减去 32px 左右边距
- 水平排列：图标 + 文字 + 按钮
- 最大宽度 720px（过宽不好看）

### Tablet

- 同 Desktop，宽度自适应

### Mobile

- 全宽（左右 16px 边距）
- 垂直排列：图标 + 文字共行 + 按钮换行居右

```
┌────────────────────────────────┐
│ 🔒 This conversation lives     │
│    only on this device.        │
│    Close to delete.            │
│                                │
│              [ I understand ]  │
└────────────────────────────────┘
```

---

## 空状态与错误状态

### localStorage 不可用

- 每次 Chat 页面加载都弹出 Toast
- 用户点击 `I understand` 后这次加载不再显示，但刷新会再弹
- 不影响核心功能

### Session ID 获取失败

- 不显示 Toast（等待 Session 加载好）
- 超时 5 秒仍未获取 → 不显示（错误由其他机制处理）

---

## 验收标准

- [ ] 首次付费进入 `/chat` → 500ms 后顶部出现 Toast
- [ ] Toast 含 🔒 图标 + 文字 + `I understand` 按钮
- [ ] 文案与规格完全一致：`This conversation lives only on this device. Close to delete.`
- [ ] 点击 `I understand` → Toast 淡出 + 上滑动画
- [ ] Session 内刷新页面 → Toast 不再显示
- [ ] 用同一 Session Token 刷新 → Toast 不再显示
- [ ] 购买新 Session → Toast 再次显示（不同 sessionId）
- [ ] 从 Archive Resume 旧 Session（有 flag）→ 不显示
- [ ] ESC 键关闭等同于点击按钮
- [ ] Tab 聚焦按钮，Enter 激活
- [ ] Mobile 下垂直堆叠布局
- [ ] Toast 不遮挡欢迎引导区或对话内容
- [ ] 动画流畅（500ms 延迟 + 400ms 淡入）

---

## 关联资源

### 相关文档

- `@docs/pages/05-chat.md` — Chat 页面主体
- `@docs/pages/12-payment-callback.md` — 支付成功回跳（上游触发点）
- `@.cursor/rules/01-never-stored.mdc` — 品牌承诺 Never Stored

### 关键约束

- **非阻塞**（不影响用户交互）
- **单次 Session 一次**（不重复打扰）
- **克制美学**（只一句话 + 一个按钮）
- **延迟 500ms 出现**（避免页面加载时的视觉混乱）
- **必须用户点击才关闭**（不自动消失，因为是重要承诺）

---

✦
