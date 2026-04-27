# 16 · 免责协议首次确认弹窗（全局）

## 组件身份

| 项 | 值 |
|---|---|
| 类型 | 全局弹窗（不对应路由） |
| 文件位置 | `components/global/DisclaimerModal.tsx` |
| 触发位置 | 所有页面（layout 级别，首次访问或条款版本升级时弹） |
| 目标用户 | 首次访问 POJU 的所有访问者 |
| 核心目标 | 法律合规 + 让用户确认已知悉 POJU 的性质和限制 |
| 优先级 | **必须**（Task 1） |
| 所属 Task | Task 1 |

---

## 触发条件

### 首次访问

- localStorage 中无 `pojulife_disclaimer_v1` 键 → 弹出
- 用户勾选 + 确认后：
  ```
  localStorage.setItem('pojulife_disclaimer_v1', JSON.stringify({
    agreed: true,
    at: Date.now(),
    version: '1.0'
  }));
  ```

### 版本升级后

- localStorage 中存在 `pojulife_disclaimer_v1` 但 `version` 低于当前最新版
- 显示**简版升级弹窗**（见下方"场景 B"）

### 不触发条件

- 已同意当前版本 → 不弹
- 单次 Session 内 → 不重复弹（即使刷新页面）

---

## 场景 A · 首次访问（完整版）

### 视觉布局

**Modal 居中**，背景有遮罩（半透明黑色 + 模糊）：

```
┌──────────────────────────────────────────┐
│                                          │
│         ✦ POJU                           │
│                                          │
│      Before you enter POJU               │
│                                          │
│  POJU delivers insights based on 2,000   │
│  years of Eastern wisdom, reinforced by  │
│  modern science, and interpreted by an   │
│  AI Agent.                               │
│                                          │
│  This is not a substitute for:           │
│  · Medical advice                        │
│  · Legal advice                          │
│  · Financial advice                      │
│  · Mental health care                    │
│                                          │
│  If you're in crisis, please contact     │
│  a licensed professional immediately.    │
│                                          │
│  Your data never leaves this device      │
│  unless you explicitly choose to share.  │
│                                          │
│  [ Read the full Disclaimer → ]          │
│                                          │
│  ──────                                  │
│                                          │
│  ☐ I have read and agree to the          │
│    Disclaimer, Privacy Policy, and       │
│    Terms of Service.                     │
│                                          │
│  [ Enter POJU ]  (勾选后激活)            │
│                                          │
└──────────────────────────────────────────┘
```

### 内容细节

#### 顶部

- POJU Logo
- 标题：`Before you enter POJU`

#### 主要说明段

```
POJU delivers insights based on 2,000 years of Eastern 
wisdom, reinforced by modern science, and interpreted 
by an AI Agent.
```

#### 4 条限制清单

```
This is not a substitute for:
· Medical advice
· Legal advice
· Financial advice
· Mental health care
```

#### 危机提示

```
If you're in crisis, please contact a licensed 
professional immediately.
```

**视觉强调**：紫色边框 + 警示图标

#### 隐私承诺

```
Your data never leaves this device unless you 
explicitly choose to share.
```

#### 展开链接

`[ Read the full Disclaimer → ]`
- 点击：在新窗口打开 `/disclaimer`
- 或：在 Modal 内展开全文（手风琴）

#### 分隔线

#### 勾选框

```
☐ I have read and agree to the Disclaimer, 
   Privacy Policy, and Terms of Service.
```

- **默认不勾**
- 三个链接都可点击（打开对应页面）：
  - Disclaimer → `/disclaimer`
  - Privacy Policy → `/privacy`
  - Terms of Service → `/terms`

#### 确认按钮

`[ Enter POJU ]`
- **未勾选时禁用**（灰色，不可点击）
- **勾选后激活**（紫色 Primary pill）

### 交互限制

- **ESC 键不关闭 Modal**（必须勾选 + 确认）
- **点击遮罩不关闭 Modal**
- 没有 `×` 关闭按钮
- 用户必须做出选择才能继续浏览

---

## 场景 B · 版本升级（简版）

**触发**：用户之前同意过 `version: '1.0'`，现在条款升级到 `version: '1.1'`。

### 视觉布局

简短版本：

```
┌──────────────────────────────────────────┐
│                                          │
│   We've updated our Disclaimer.          │
│                                          │
│   [ View changes → ]                     │
│                                          │
│   ☐ I have read and agree to the         │
│     updated terms.                       │
│                                          │
│   [ Continue ]  (勾选后激活)              │
│                                          │
└──────────────────────────────────────────┘
```

### 内容细节

#### 标题

`We've updated our Disclaimer.`

#### 变更链接

`[ View changes → ]`
- 打开 `/disclaurer?compare=1.0-1.1`（展示变更对比）
- 或直接跳 `/disclaimer`

#### 勾选框

```
☐ I have read and agree to the updated terms.
```

#### 确认按钮

`[ Continue ]`

---

## 功能与交互

### 弹出时机

在 `app/layout.tsx` 的 Provider 中检测：

```typescript
'use client';

useEffect(() => {
  const agreed = localStorage.getItem('pojulife_disclaimer_v1');
  const currentVersion = '1.0';
  
  if (!agreed) {
    // 首次访问
    setShowModal('first');
  } else {
    const parsed = JSON.parse(agreed);
    if (parsed.version !== currentVersion) {
      // 版本升级
      setShowModal('upgrade');
    }
  }
}, []);
```

### 特殊路径不触发

以下路径访问时**不触发弹窗**（因为用户可能就是来看这些页面的）：

- `/disclaimer`
- `/privacy`
- `/terms`
- `/contact`

这样用户从弹窗里点 `Read the full Disclaimer →` 能正常阅读，不会陷入死循环。

### 点击确认后

1. 写入 localStorage
2. 淡出 Modal（300ms）
3. 用户继续正常浏览当前页面

---

## 数据依赖

### 需要读写的存储

**localStorage**:
- 读写 `pojulife_disclaimer_v1`

### 需要调用的 API

- 无

---

## 响应式行为

### Desktop

- Modal 居中
- 最大宽度 540px
- 最大高度 80vh，内容过长时内部滚动

### Mobile

- Modal 底部弹出（bottom sheet 风格）
- 宽度占满屏幕
- 高度可拖拽（最多 90vh）
- 无遮罩点击关闭

---

## 空状态与错误状态

### localStorage 不可用

- 若浏览器禁用 localStorage（隐私浏览模式）：
  - 每次访问都弹出 Modal
  - Modal 顶部额外小字：`Enable cookies/storage to save your preference.`

### 用户拒绝同意

- 无"Decline"按钮（符合 POJU 品牌：要么同意要么离开）
- 用户可以关闭浏览器（隐性"不同意"）
- **不支持以"降级模式"继续浏览**

---

## 验收标准

### 首次访问（场景 A）

- [ ] 清除浏览器数据后首次访问任意页面 → 弹窗出现
- [ ] Modal 包含所有 8 个内容区块
- [ ] 4 条限制清单显示完整
- [ ] 危机提示有视觉强调
- [ ] `Read the full Disclaimer →` 链接有效
- [ ] 勾选框默认不勾
- [ ] 三个合规链接都可点击
- [ ] `Enter POJU` 按钮未勾选时禁用
- [ ] 勾选后按钮激活
- [ ] 点击确认后写入 localStorage
- [ ] 刷新页面不再弹
- [ ] ESC 键不关闭 Modal
- [ ] 点击遮罩不关闭 Modal
- [ ] 无 `×` 关闭按钮

### 版本升级（场景 B）

- [ ] 修改 localStorage 的 version 为 `0.9`（模拟旧版本）
- [ ] 刷新页面 → 简版 Modal 出现
- [ ] 显示"updated"文案
- [ ] 勾选 + 确认后更新 localStorage version 到当前值

### 路径例外

- [ ] 首次访问 `/disclaimer` → 不弹 Modal
- [ ] 首次访问 `/privacy` → 不弹 Modal
- [ ] 首次访问 `/terms` → 不弹 Modal
- [ ] 首次访问 `/contact` → 不弹 Modal

### 响应式

- [ ] Desktop 居中 Modal
- [ ] Mobile 底部 bottom sheet
- [ ] 内容过长时 Mobile 可滚动

---

## 关联资源

### 相关文档

- `@docs/pages/07-disclaimer.md` — 免责声明完整版
- `@docs/pages/08-privacy.md` — 隐私政策
- `@docs/pages/09-terms.md` — 服务条款
- `@docs/POJU_Development_Document_v3.0.1_Final.md` — 第 09 章合规

### 关键约束

- **首次访问必须弹**（法律合规）
- **默认不勾选**（GDPR 要求用户主动同意）
- **三个法律文档链接必须可点击**
- **版本升级时重新确认**
- **特殊路径不触发**（避免死循环）
- **不能跳过**（必须同意才能继续）

---

✦
