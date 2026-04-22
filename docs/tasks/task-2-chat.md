# 📦 Task 2 · POJU Chat 完整实现

> 预计耗时：AI 输出 2-3 次，你验证 2-3 天

## 目标

实现 POJU 破局问答的完整前端，包括 Agent 对话、思考双阶段动画、The Archive 左侧栏、消息输入栏、结束与销毁流程。**AI 调用暂时 mock（用假数据演示流程）**，真正对接 Claude API 放到 Task 5。

## 交付范围

### 1. Chat 页面骨架（`/chat`）

Gemini 风格三栏式布局：

```
┌──────────┬──────────────────────────────────────┐
│ POJU     │  POJU                           [≡]  │
│  Logo    │  ──────────────────────────────────  │
│          │                                      │
│ ✦ New    │     【欢迎引导区 - 首次可见】        │
│   POJU   │                                      │
│   $9.99  │                                      │
│ ─────    │                                      │
│ [Archive]│                                      │
│ Apr 19   │                                      │
│ "Dad..." │                                      │
│ Apr 15   │                                      │
│ [hidden] │                                      │
│ ─────    │                                      │
│ Syncro → │  ──────────────────────────────────  │
│ Oracle → │  [📎] [🎤] Type your reply...  [→]  │
└──────────┴──────────────────────────────────────┘
```

移动端：左侧栏默认收起为 ≡ 汉堡按钮。

### 2. 欢迎引导区

首次进入 Chat 时居中显示欢迎文字（中英文版文案见主文档 02.4.3 节）。用户发送第一条消息后，引导区平滑上移消失。

AI **不主动发送首条**，引导区是静态的。

### 3. 付费后首次提示（非勾选）

```
┌──────────────────────────────────────┐
│ 🔒 This conversation lives only on   │
│    this device. Close to delete.     │
│    [ I understand ]                  │
└──────────────────────────────────────┘
```

点击"I understand"消失，Session 期内不再显示。

### 4. AI 回复双阶段动画

**阶段一 · 思考气泡**（临时）：
- 样式：半透明、细边框、浅金色文字
- 内容：中文诗意 + 英文任务点缀（例如"✦ 道家云：天下大事必作于细... ✦ checking: your timing vs. career cycles ✦ 流年癸卯，正是换木的时候..."）
- 流式输出效果，每 1-2 秒追加一行
- 时长 5-30 秒动态（**最低 5 秒**，绝不秒回）
- 完成后淡出 / 折叠消失，**不留在对话记录**

**阶段二 · 正式回复气泡**（永久）：
- 位置紧接思考气泡消失位置
- 语言跟随用户（用户说中文 → 中文；用户说英文 → 英文）
- 气泡底部工具栏：`[📋 Copy] [🔊 Read Aloud]`
- 朗读 API 先用浏览器 Web Speech API 占位，Task 5 换成 ElevenLabs

### 5. 消息输入栏

```
[📎 Image]  [🎤 Voice]  Type your reply...             [→ Send]
```

- 📎 图片上传：支持相册 + 相机，预览后加入消息
- 🎤 语音输入：Web Speech API 实时转文字，用户可编辑后发送
- Enter 键桌面端发送（移动端换行）
- 发送后触发 mock AI 回复流程

### 6. 左侧 Archive 栏

- 顶部 Logo
- ✦ New POJU $9.99 按钮（Task 5 接入 Stripe）
- 历史 Session 列表：`Apr 19 · "Dad and I keep..."` 格式
- 每项右键/长按：Rename / Hide / Wipe 三个操作
- 隐藏的条目显示 `[Hidden by you] [Reveal]`
- 底部：Syncro → / Oracle → 链接（点击弹出底部抽屉面板，Task 3/4 实装，本 Task 占位）

### 7. 菜单（≡）

右上角菜单包含（初版先做静态，部分动作 Task 5 完善）：
```
✦ Save this as PDF           (仅 Phase 5 完成后激活)
✦ Summon Syncro              (Task 3 实装)
✦ Summon Oracle              (Task 4 实装)
✦ Archive this session       
✦ End & Wipe this session    (二次确认)
```

### 8. End & Wipe 二次确认弹窗

见主文档 02.5.3 的 UI：

```
End and wipe this session?

Everything in this conversation will be gone forever.
This cannot be undone.

💨 Before you close: want your reading as a keepsake PDF?

[ Save PDF first → ]
[ Wipe without saving ]
[ Cancel ]
```

点击 `Wipe without saving` → 彻底清除当前 Session 所有本地数据 → 跳转 `/`

`Save PDF first` 流程交给 Task 5 实装。

### 9. 本地存储层

用 Dexie.js 实现 IndexedDB + AES-256-GCM 加密：

```typescript
interface PojuSession { /* 见主文档 05.4.1 */ }
interface PojuMessage { /* 见主文档 05.4.1 */ }
```

加密密钥用 Web Crypto API 生成并存 localStorage。每条消息存入前加密，读取时解密。

### 10. Zustand Store

创建 `lib/store/chat-store.ts`（参考主文档 06.7.1）。

### 11. Mock AI 调用

创建 `lib/ai/mock-poju.ts` 模拟 AI 回复流程：
- 接受用户消息 → 等待 5-30 秒（按问题长度动态） → 流式返回思考文字片段 → 思考结束返回正式回复
- 返回的正式回复必须包含：**回应 + 分析 + 行动**三段式（用主文档 02.4.4 的硬规则生成假数据）
- Phase 5 标记：mock 数据可以在第 3-4 轮对话后返回"这是你本周的三件事..."触发 PDF 按钮出现

### 12. PWA Service Worker

用 Serwist 配置，缓存字体、音效、基础资源。

## 验证标准

- [ ] 进入 `/chat` 看到欢迎引导区居中显示
- [ ] 发送第一条消息 → 引导区平滑上移消失 → 思考气泡出现并流式输出 → 5-30 秒后思考气泡淡出 → 正式回复滑入
- [ ] 正式回复气泡含 Copy 和 Read Aloud 按钮且都可用
- [ ] 第 3-4 轮对话后，消息底部出现 `Save this reading as PDF` 按钮（视觉占位）
- [ ] 左侧栏历史对话可 Rename / Hide / 恢复
- [ ] End & Wipe → 二次确认 → 确认后所有本地数据真的清除（用 DevTools Application > IndexedDB 验证）
- [ ] 图片上传 + 语音输入都能工作
- [ ] 刷新页面后对话历史还在（IndexedDB 持久化）
- [ ] 关闭浏览器再打开 → 历史还在
- [ ] DevTools 中搜索 IndexedDB 里的内容 → **应该看到的是加密字符串，不是明文对话**

---
