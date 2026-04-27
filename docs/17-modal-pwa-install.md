# 17 · PWA 添加到主屏幕引导弹窗（全局）

## 组件身份

| 项 | 值 |
|---|---|
| 类型 | 全局弹窗（iOS Safari 专用） |
| 文件位置 | `components/global/PWAInstallModal.tsx` |
| 触发位置 | 首次访问 `/syncro` 或首次付费进入 `/chat` 时 |
| 目标用户 | 使用 iOS Safari 且未将 POJU 添加到主屏幕的用户 |
| 核心目标 | 引导用户将 PWA 添加到主屏幕，获得全屏体验 + 离线能力 |
| 优先级 | 中（Task 3 / Task 5） |
| 所属 Task | Task 3（Syncro 触发）+ Task 5（Chat 触发） |

---

## 触发条件

### 必须同时满足（用 AND）

1. 用户代理是 **iOS Safari**（不是 Chrome / Firefox on iOS，它们不支持"添加到主屏幕"）
2. **不是** standalone 模式（`window.matchMedia('(display-mode: standalone)').matches === false`）
3. localStorage 无 `pojulife_pwa_prompt_seen`
4. 当前路径为 `/syncro`（Task 3）或付费完成后首次进入 `/chat`（Task 5）

### 不在其他页面触发

**不触发**的页面：
- 落地页 `/`
- POJU / Syncro / Oracle 产品介绍页（首次浏览不打扰）
- 法律页面
- The Archive

**只在**最能体会到 PWA 好处的地方触发：
- Syncro：全屏罗盘 + AR 体验在 PWA 中最佳
- Chat：没有浏览器地址栏干扰，更沉浸

### Android Chrome 处理

**Android Chrome 不需要这个自定义弹窗**，因为：
- Chrome 会自动触发 `beforeinstallprompt` 事件
- 使用浏览器原生的 install banner（更好的 UX）
- 我们只需监听事件，在适当时机 `prompt()`

```typescript
// Android: 使用原生事件
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showCustomInstallButton();  // 显示"Install app"按钮
});
```

---

## 场景 A · iOS Safari（自定义弹窗）

### 视觉布局

**底部弹出 sheet**（不是居中 Modal，因为 iOS 用户更熟悉 bottom sheet）：

```
┌──────────────────────────────────────────┐
│                                          │
│            ✦ POJU                        │
│                                          │
│      Add POJU to your home screen        │
│                                          │
│   Full-screen experience.                │
│   No browser bars.                       │
│   Works offline.                         │
│                                          │
│   How to:                                │
│                                          │
│   1. Tap the Share icon    [图: ↗]       │
│   2. Scroll and tap                      │
│      "Add to Home Screen"   [图: ➕]     │
│                                          │
│   ──────                                 │
│                                          │
│   [ Got it ]                             │
│   [ Later ]                              │
│                                          │
└──────────────────────────────────────────┘
```

### 内容细节

#### 顶部

- POJU Logo
- 标题：`Add POJU to your home screen`

#### 价值主张

```
Full-screen experience.
No browser bars.
Works offline.
```

简短三行，每行一个价值。

#### 操作引导

**步骤 1**：
```
1. Tap the Share icon
   [图标：iOS Share symbol ↗]
```

显示 iOS Safari 底部的 Share 图标（方形带箭头）。

**步骤 2**：
```
2. Scroll and tap "Add to Home Screen"
   [图标：加号 ➕]
```

动画：可选地展示一个 GIF 或动画演示操作过程。

#### 按钮

**`Got it`**：
- 样式：Primary 紫色 pill
- 点击：
  - 关闭弹窗
  - 写入 localStorage：`pojulife_pwa_prompt_seen = { at: Date.now(), version: 1 }`
  - **不会再弹出**（除非用户清除 localStorage）

**`Later`**：
- 样式：Tertiary 文字按钮
- 点击：
  - 关闭弹窗
  - **不写 localStorage**（下次进入 Syncro/Chat 还会再弹）
  - 但加一个 24 小时冷却（localStorage `pojulife_pwa_prompt_later_at`），24 小时内不重复弹

### 视觉氛围

- 底部 sheet 从屏幕底部滑入（500ms）
- 背景有半透明模糊遮罩
- ESC 键 / 点击遮罩 = 等同于 "Later"

---

## 场景 B · Android Chrome（原生 banner）

**不使用自定义弹窗**。

**实现方式**：

1. 监听 `beforeinstallprompt` 事件
2. 在首次进入 Syncro 或 Chat 时调用 `deferredPrompt.prompt()`
3. Chrome 显示原生的 install banner
4. 用户点击 "Install" 或 "Not now"
5. 记录结果到 localStorage

```typescript
useEffect(() => {
  if (isAndroidChrome && deferredPrompt && !hasPrompted) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        localStorage.setItem('pojulife_pwa_installed', 'true');
      } else {
        localStorage.setItem('pojulife_pwa_prompt_later_at', Date.now().toString());
      }
    });
  }
}, []);
```

---

## 场景 C · 其他浏览器（降级）

- **Chrome / Firefox on iOS**：**不显示弹窗**（无法添加到主屏幕）
- **Desktop 浏览器**：**不显示弹窗**（Syncro 本来就是 PC fallback 页面）
- 其他未知浏览器：**不显示弹窗**

---

## 功能与交互

### localStorage 键

```typescript
pojulife_pwa_prompt_seen: {
  at: number,     // 用户点 "Got it" 的时间戳
  version: 1,     // 当前提示版本（方便未来升级）
}

pojulife_pwa_prompt_later_at: number
// 用户点 "Later" 的时间戳，24 小时冷却

pojulife_pwa_installed: 'true'
// Android Chrome 原生 banner 用户接受后记录
```

### 设备检测

```typescript
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const notChromeOrFirefox = !/CriOS|FxiOS/.test(ua);
  return iOS && webkit && notChromeOrFirefox;
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
}
```

### 冷却逻辑

```typescript
function shouldShowPrompt(): boolean {
  if (!isIOSSafari() || isStandalone()) return false;
  
  // 已永久拒绝（点过 Got it）
  const seen = localStorage.getItem('pojulife_pwa_prompt_seen');
  if (seen) return false;
  
  // 24 小时冷却（点过 Later）
  const laterAt = localStorage.getItem('pojulife_pwa_prompt_later_at');
  if (laterAt) {
    const elapsed = Date.now() - parseInt(laterAt);
    if (elapsed < 24 * 3600 * 1000) return false;
  }
  
  return true;
}
```

### PWA Manifest 要求

`public/manifest.json` 必须包含：

```json
{
  "name": "POJU",
  "short_name": "POJU",
  "description": "Ancient Wisdom, AI-Powered. Made for You.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0B0815",
  "theme_color": "#0B0815",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

iOS 特别需要：

```html
<link rel="apple-touch-icon" href="/icons/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="POJU">
```

---

## 数据依赖

### 需要读写的存储

- localStorage: 三个键（见上方）

### 需要调用的 API

- 无

### 浏览器 API

- `navigator.userAgent`
- `window.matchMedia('(display-mode: standalone)')`
- `beforeinstallprompt` 事件（仅 Android Chrome）

---

## 响应式行为

### iOS Safari

- 所有屏幕尺寸都是底部 sheet 弹出

### Android Chrome

- 使用原生 banner（不需要自定义 UI）

### Desktop

- 不弹出任何内容

---

## 空状态与错误状态

- 无空状态
- 错误状态：即使 localStorage 写入失败也不阻塞用户使用 Syncro / Chat

---

## 验收标准

### iOS Safari

- [ ] iOS Safari 首次访问 `/syncro` → 显示底部 sheet 弹窗
- [ ] 弹窗显示完整操作引导（Share 图标 + Add to Home Screen 图标）
- [ ] 点击 `Got it` → 关闭 + 写 localStorage + 不再弹
- [ ] 点击 `Later` → 关闭 + 不写永久 flag + 24 小时冷却
- [ ] 24 小时后再次访问 `/syncro` → 再次弹出（因为没点 Got it）
- [ ] 点击遮罩或 ESC → 等同于 Later
- [ ] 用户按指引添加到主屏幕后 → 下次从主屏幕打开是 standalone 模式 → 不再弹
- [ ] 首次付费进入 `/chat` 也触发（如果还没点过 Got it）

### Android Chrome

- [ ] 访问 `/syncro` 时（如果浏览器支持）→ 触发原生 install banner
- [ ] 用户 Install 后 → 下次自动 standalone 打开

### 其他浏览器

- [ ] Chrome on iOS → 不弹
- [ ] Firefox on iOS → 不弹
- [ ] Desktop 浏览器 → 不弹

### 特殊场景

- [ ] 已添加到主屏幕（standalone 模式）→ 不弹
- [ ] 已点过 `Got it` → 永久不弹
- [ ] 清除 localStorage → 重新弹

---

## 关联资源

### 相关文档

- `@docs/pages/03-syncro.md` — Syncro 移动端（主触发点）
- `@docs/pages/05-chat.md` — Chat 付费首次（次触发点）
- `@.cursor/rules/02-tech-stack.mdc` — Serwist PWA 配置

### 关键约束

- **只在用户最能感受 PWA 价值的页面触发**
- **不打扰浏览模式的用户**（落地页不弹）
- **24 小时冷却**（点 Later 后短时间不重复）
- **iOS Safari 专属自定义**（Android Chrome 用原生）
- **可以完全跳过**（用户主动选择，不强制）

---

✦
