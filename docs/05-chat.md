# 05 · POJU Chat `/chat`

## 页面身份

| 项 | 值 |
|---|---|
| 路由 | `/chat` |
| 文件位置 | `app/(product)/chat/page.tsx` |
| 页面标题 | `POJU Session` |
| 目标用户 | **仅付费用户**（已完成 Stripe 支付，有有效 Session Token） |
| 核心目标 | 提供完整 AI Agent 对话体验，Phase 5 后导出 PDF，支持 Summon Syncro/Glyph |
| 优先级 | **最高**（Task 2 核心 + Task 5 AI 真实对接） |
| 所属 Task | Task 2（Mock AI + UI 完整）+ **Task 5（Claude API 接入 + PDF + 邮件）** |

---

## 访问条件

- **需要有效 Session Token**
- Token 来源：
  - Stripe 支付成功后，通过 `/chat?token=xxx` 回跳 `/api/payment/exchange-token` 换取 Session ID
  - 或 IndexedDB 中存在已存活的 Session（用户之前付过费，未 End & Wipe）
- **无 Session** → 跳转回 `/poju`

---

## 页面结构清单

**三栏式布局**（Desktop）/ 全屏对话 + 侧滑抽屉（Mobile）：

1. 顶部元数据条
2. 左侧栏（Session 管理 + 历史对话 + 工具入口）
3. 主区域（对话流）
4. 底部输入栏
5. 右上角菜单（隐藏，点击展开）

---

## 区块详细内容

### Desktop 三栏布局

```
┌──────────┬──────────────────────────────────────┐
│ POJU     │  [元数据条]                     [≡] │
│  Logo    │  ──────────────────────────────────  │
│          │                                      │
│ ✦ New    │       【对话主区域】                 │
│   POJU   │                                      │
│   $9.99  │                                      │
│          │                                      │
│ ─────    │                                      │
│ Today    │                                      │
│ Apr 19   │                                      │
│ "Dad..." │                                      │
│          │                                      │
│ This Week│                                      │
│ Apr 15   │                                      │
│ "Move..."│                                      │
│          │                                      │
│ Apr 10   │                                      │
│ [Hidden] │                                      │
│          │                                      │
│ ─────    │                                      │
│ Archive  │                                      │
│          │                                      │
│ Syncro → │  ──────────────────────────────────  │
│ Glyph →  │  [📎] [🎤] Type your reply...  [→]  │
└──────────┴──────────────────────────────────────┘
```

---

### 1. 顶部元数据条

**位置**：主区域顶部

**内容**（左到右）：

- **Session 标识**：`POJU Session · Started Apr 19`
- **Session 状态**（小标签）：`12 messages · Active` 或 `Archived`
- **右侧**：菜单按钮 `≡`

**背景**：毛玻璃模糊，紫色边框下细线

---

### 2. 左侧栏

#### 顶部区

- **POJU Logo**（点击返回 `/`）
- 下方 Session 计数（如 `3 active sessions`）

#### `New POJU $9.99` 按钮

- 样式：Primary 紫色 pill
- 点击：触发 Stripe Checkout
- Stripe metadata: `source: "chat_new_poju"`
- 支付成功后 → 当前 Session 保持活跃，新 Session 添加到列表顶部

#### 分隔线

#### 历史 Session 列表

按时间分组：
- **Today**
- **This Week**
- **Earlier**

**每个 Session 条目**：
```
Apr 19 · "Dad and I..."
```
- 日期 + 首问题前 6 字脱敏
- 左侧紫色小圆点指示当前激活的 Session
- **Hover**：显示操作按钮
  - ✎ Rename
  - 👁 Hide
  - 🗑 Wipe
- **长按**（移动端）/ 右键（桌面）：展开操作菜单

#### 隐藏的条目

显示为：
```
Apr 15 · [Hidden by you]
[Reveal]
```

#### 分隔线

#### The Archive 入口

- 图标 + `The Archive`
- 点击 → 跳转 `/archive`

#### 分隔线

#### 工具链接

- `Syncro →`
- `Glyph →`
- 点击**不跳转**，而是在当前页面打开**底部抽屉**内嵌面板
- 完成后数据回传当前对话

---

### 3. 主区域 · 对话流

#### 3.1 欢迎引导区（仅首次进入 Chat 可见）

**居中静态文字**（不是 AI 消息，是页面占位）：

```
Tell me what's holding you back — career, family, love, 
money, health, any crossroads.

The more specific, the better. Places, timing, people, 
what you've tried, what you fear.

Two thousand years of Eastern wisdom can answer you, 
but it needs to see the real you first.

──

Once you finish, I'll begin the reading.
Everything you say stays on this device only. 
Close the page and it's gone.
```

**底部小字**：`Type below to begin, or tap the microphone to speak.`

**行为**：用户发送第一条消息后，引导区**平滑上移消失**（fadeOut + translateY(-20px)，500ms）。

---

#### 3.2 付款后首次 Toast 提示

**首次付费进入 Chat 的用户** 在 Chat 页顶部 100px 看到一个非阻塞式 Toast：

```
┌──────────────────────────────────────┐
│ 🔒 This conversation lives only on   │
│    this device. Close to delete.     │
│    [ I understand ]                  │
└──────────────────────────────────────┘
```

- 点击 `I understand` → Toast 消失
- Session 内不再显示（localStorage 记录 `pojulife_chat_welcome_seen_[sessionId]`）

---

#### 3.3 用户消息气泡

**右对齐**

**内容**：
- 文字（用户输入）
- 或图片附件（缩略图预览）
- 或语音转录后的文字 + 麦克风图标小

**样式**：
- 紫色实色背景
- 圆角 lg
- 白色文字

---

#### 3.4 AI 思考气泡（临时）

**左对齐**

**样式**：
- 半透明毛玻璃背景
- 紫色发光细边框
- 浅紫色文字（`--text-accent`）

**内容**：中文主体 + 英文任务点缀的流式输出

**示例**：
```
✦ 道家云："天下大事必作于细"...
✦ checking: your timing vs. career cycles
✦ 流年癸卯，正是换木的时候...
✦ matching: Daoist Wu Wei framework
✦ 这个局其实藏在另一件事里...
```

**动画**：
- 每 1-2 秒追加一行
- 打字机效果（字符一个一个出现）
- 完成后**淡出消失**（fadeOut + scale 0.95, 500ms）
- **不保留在对话记录**中

**时长分级**：
- 首次提问：20-30 秒
- 深度追问：15-20 秒
- 澄清 / 短问题：5-8 秒
- **最低 5 秒**（绝不秒回）

---

#### 3.5 AI 正式气泡（永久）

**左对齐**

**样式**：
- 毛玻璃背景
- 紫色边框（比用户气泡细）
- 正文颜色 `--text-body`

**内容规范**（System Prompt 约束）：

每一次正式回复必须包含：
1. **回应**（对用户当前输入的直接回应）
2. **分析**（从命理 / 事理 / 心理至少一个层面的推演）
3. **动作**（至少一个今天或本周可以启动的具体动作）

**语言**：
- 用户说中文 → 回中文
- 用户说英文 → 回英文
- 保留 Pinyin 术语（QI / BAZI / WUXING）

**典故处理**：
- **禁止**中文专名（苏武、关公等）
- 改为叙事化：`Two thousand years ago in the East, a loyal envoy was stranded...`

**气泡底部工具栏**：

```
[📋 Copy]  [🔊 Read Aloud]
```

#### `Copy`

- 复制正式回复文字到剪贴板
- 点击后按钮变为 `✓ Copied`（2 秒后恢复）

#### `Read Aloud`

- Task 2 阶段：Web Speech API 占位
- Task 5 阶段：ElevenLabs Turbo v2.5 API
- 播放时按钮变为 `⏹ Stop`，再点停止
- 播放结束自动恢复

---

#### 3.6 Phase 5 特殊气泡（PDF 导出触发点）

当 AI 完成 Phase 5（行动方案生成）后，该消息气泡**底部额外一行**：

```
─────
This is your reading so far.

[ ✦ Save this as PDF ]
```

**按钮样式**：低调但显眼，紫色文字 + 紫色下划线

**点击行为**：弹出邮箱输入面板（见下方"PDF 导出流程"）

---

#### 3.7 Summon Syncro / Glyph 按钮（AI 主动召唤）

当 AI 判断需要辅助工具时，在 AI 回复末尾生成按钮：

```
─────
I need to see your space first.

[ ✦ Summon Syncro ]
```

或

```
─────
Let me show you a sign about this.

[ ✦ Summon Glyph ]
```

**点击行为**：
- **不跳转页面**
- 底部抽屉（约 90% 屏幕高度）从屏幕底部滑出
- 抽屉内嵌 Syncro 或 Glyph 完整面板
- 用户完成交互后数据自动回传当前对话
- 抽屉关闭，AI 基于新数据生成下一条回复

---

### 4. 底部输入栏

**位置**：主区域底部固定

**布局**（左到右）：

```
[📎]  [🎤]  Type your reply...              [→ Send]
```

#### 📎 图片上传

- 点击 → 系统文件选择器（移动端调用相册/相机，桌面端文件选择）
- 支持：JPG / PNG / HEIC（iOS）/ WEBP
- 上传后在输入框上方显示缩略图预览
- 点击缩略图 `×` 删除

**技术实现**：
- 图片压缩到最长边 1920px
- Base64 编码后存入 IndexedDB（加密）
- 发送时传给 Claude Vision API

#### 🎤 语音输入

- 按住说话，松开停止
- 实时转文字（Web Speech API）
- 转换后的文字自动填入输入框
- 支持中英文自动检测

**技术实现**：
```javascript
const recognition = new SpeechRecognition();
recognition.lang = navigator.language; // or 'zh-CN'/'en-US'
recognition.interimResults = true;
```

#### 输入框

- 多行自适应（最多 6 行，超出滚动）
- 占位符：`Type your reply...`
- Enter 键桌面发送，Shift+Enter 换行
- 移动端 Enter 换行，按按钮发送

#### → Send 按钮

- 输入为空时灰色禁用
- 点击发送当前消息 + 触发 AI 响应流程

---

### 5. 右上角菜单（≡）

点击展开下拉菜单：

```
✦ Save this reading as PDF       (仅 Phase 5 完成后激活)
✦ Summon Syncro                  (底部抽屉)
✦ Summon Glyph                   (底部抽屉)
✦ Rename this session            
✦ Archive this session           (折叠，可恢复)
✦ End & Wipe this session        (彻底销毁，二次确认)
─────
Settings                         (音效开关 / 语言等)
```

---

### Rename this session

- 弹出输入框（当前 Session 标题）
- 默认值：AI 自动生成的议题标题
- 字符限制：40 字符
- 确认保存

### Archive this session

- 直接将 Session 状态改为 `archived`
- 不删除数据
- 侧栏列表中标记为 `Archived`
- 用户可在 The Archive 中 Resume

### End & Wipe this session

**二次确认弹窗**：

```
┌──────────────────────────────────────┐
│                                      │
│      End and wipe this session?      │
│                                      │
│   Everything in this conversation    │
│   will be gone forever.              │
│   This cannot be undone.             │
│                                      │
│   💨 Before you close: want your     │
│      reading as a keepsake PDF?      │
│                                      │
│     [ Save PDF first → ]             │
│     [ Wipe without saving ]          │
│     [ Cancel ]                       │
│                                      │
└──────────────────────────────────────┘
```

**按钮行为**：
- `Save PDF first →` → 先走 PDF 导出流程，完成后再执行 Wipe
- `Wipe without saving` → 立即 `db.sessions.delete(sessionId)` + 所有相关消息删除 → 跳回 `/`
- `Cancel` → 关闭弹窗继续对话

---

## PDF 导出流程（Phase 5 后可触发）

### Step 1 · 点击 `Save this as PDF`（气泡内按钮或菜单项）

### Step 2 · 邮箱输入面板弹出

```
┌──────────────────────────────────────┐
│                                      │
│      Where should we send it?        │
│                                      │
│  [ your.email@example.com        ]   │
│                                      │
│  Your reading will arrive in minutes.│
│                                      │
│  ┌──────────────────────────────┐   │
│  │  Also, this:                 │   │
│  │                              │   │
│  │  Your actions need time to   │   │
│  │  settle. I'd like to send    │   │
│  │  you ONE check-in email      │   │
│  │  on [Apr 30].                │   │
│  │                              │   │
│  │  That's it. No marketing.    │   │
│  │  Deleted after sending.      │   │
│  └──────────────────────────────┘   │
│                                      │
│  [ Send me both ]                    │
│  [ Just the PDF, no check-in ]       │
│  [ Cancel ]                          │
│                                      │
└──────────────────────────────────────┘
```

### Step 3 · 邮箱验证

- 前端验证邮箱格式（Zod schema）
- 错误提示：`Please enter a valid email address.`

### Step 4 · 后端 API 调用

调用 `POST /api/email/send-pdf`：
- 生成 PDF（Puppeteer 服务端渲染 Chat 内容）
- 发送邮件（Resend API）
- 如果勾选 check-in → 调用 `/api/email/schedule-checkin` 预约（Resend Scheduled Send）
- **邮箱存服务端 24 小时后物理删除**

### Step 5 · 确认提示

```
┌──────────────────────────────────────┐
│   ✓ Sent to [emaiI partially hidden] │
│                                      │
│   Check your inbox in a few minutes. │
│   (Check Spam too, just in case.)    │
│                                      │
│   [ Close ]                          │
└──────────────────────────────────────┘
```

### PDF 导出次数限制

- 同一 Session **最多 5 次**
- 超过后 `Save this as PDF` 按钮变灰，tooltip：`You've saved this 5 times. Ready to close this chapter?`

---

## Summon Syncro / Glyph 底部抽屉

### 打开动画

- 从屏幕底部滑入
- 高度：90% 屏幕
- 背景：深色遮罩
- 顶部有关闭按钮 `×`

### 抽屉内容

- **Syncro 抽屉**：完整 Syncro 流程（但简化为"快速模式"，跳过教学区）
- **Glyph 抽屉**：完整 Glyph 7 Stage 流程

### 数据回传

- 用户完成交互 → `postMessage` 或回调
- 数据结构：
  - Syncro: 8 方位 + 当前朝向
  - Glyph: 抽到的签 + 问题
- 抽屉自动关闭
- POJU Chat 中 AI 根据回传数据生成下一条回复

---

## 双阶段 AI 响应技术实现

### Stage 1 · 思考气泡（Extended Thinking Stream）

**API 调用**（Task 5 阶段）：

```typescript
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-5',
  thinking: { type: 'enabled', budget_tokens: 10000 },
  messages: [...conversationHistory, userMessage],
  system: POJU_SYSTEM_PROMPT,
});

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    if (event.delta.type === 'thinking_delta') {
      // 渲染到思考气泡
      appendToThinkingBubble(event.delta.thinking);
    } else if (event.delta.type === 'text_delta') {
      // 渲染到正式气泡
      appendToAnswerBubble(event.delta.text);
    }
  }
}
```

### Stage 2 · 正式气泡

- 思考结束后 Claude 切换到 text_delta
- 思考气泡淡出
- 正式气泡流式显示（打字机效果）

### Task 2 阶段（Mock 实现）

```typescript
async function mockPOJUResponse(userMessage: string) {
  // 模拟思考
  yield { type: 'thinking', text: '✦ 道家云："天下大事必作于细"...' };
  await sleep(2000);
  yield { type: 'thinking', text: '✦ checking: your timing vs. career cycles' };
  await sleep(2000);
  // ... 更多思考
  
  // 切换到正式回复
  yield { type: 'answer_start' };
  yield { type: 'answer', text: 'Based on what you shared...' };
  // ... 流式输出
}
```

---

## 数据依赖

### 需要读写的存储

**IndexedDB** (encrypted):
- `sessions` 表：Session metadata
- `messages` 表：每条消息（用户 + AI）
- `attachments` 表：图片附件

**localStorage**:
- `pojulife_chat_welcome_seen_[sessionId]`
- `pojulife_tts_muted`

### 需要调用的 API

- `POST /api/ai/poju`（Task 5：真实 Claude API 代理）
- `POST /api/ai/poju/mock`（Task 2：Mock 数据）
- `POST /api/email/send-pdf`（Task 5）
- `POST /api/email/schedule-checkin`（Task 5）
- `POST /api/tts/stream`（Task 5：ElevenLabs 代理）
- `POST /api/ai/oracle`（Summon Glyph 时）
- `POST /api/ai/syncro`（Summon Syncro 时）

### 需要的客户端能力

- Web Speech API（语音输入）
- Media Capture（图片上传）

---

## 响应式行为

### Desktop (≥1024px)

- 完整三栏布局
- 左侧栏 300px 固定
- 主区域自适应

### Tablet (768px – 1023px)

- 左侧栏默认收起为汉堡按钮
- 主区域全宽

### Mobile (<768px)

- 左侧栏全屏侧滑抽屉
- 输入栏固定底部
- 安全区域 padding（iOS 刘海）

---

## 空状态与错误状态

### 空状态

- 首次进入（无消息）→ 显示欢迎引导区
- 左侧栏无历史 → 不显示 Today/This Week 分组，只显示当前 Session

### 错误状态

- 无有效 Session Token → 跳回 `/poju`
- AI 调用失败 → Toast：`Something in the signal is unclear. Try again?` + 重试按钮
- 网络断开 → Toast：`Connection lost. Your conversation is safe — it lives here.`
- 图片上传失败 → Toast：`Couldn't upload. Try a smaller image.`

---

## 验收标准

完成后测试：

### Task 2 阶段（Mock AI）

- [ ] 首次进入 Chat 显示欢迎引导区
- [ ] 发送第一条消息 → 引导区上移消失
- [ ] 付款后首次 Toast 显示，点击 `I understand` 消失
- [ ] 用户消息气泡右对齐，紫色背景
- [ ] AI 思考气泡左对齐，流式输出 5-30 秒
- [ ] 思考气泡完成后淡出
- [ ] AI 正式气泡含 Copy 和 Read Aloud 按钮
- [ ] Phase 5 完成后消息底部出现 `Save this as PDF` 按钮
- [ ] 左侧栏历史 Session 可 Rename / Hide / Reveal / Wipe
- [ ] End & Wipe 二次确认 → 确认后本地数据真的清除
- [ ] 图片上传工作，缩略图预览正确
- [ ] 语音输入工作，实时转文字
- [ ] Summon Syncro / Glyph 底部抽屉正确弹出
- [ ] 菜单所有项点击响应
- [ ] Mobile 侧滑抽屉工作

### Task 5 阶段（真实 AI + PDF + 邮件）

- [ ] 真实 Claude API 调用成功，思考 + 回复都符合规范
- [ ] ElevenLabs Turbo v2.5 朗读质量好
- [ ] PDF 生成含完整 Chat 内容
- [ ] 邮件发送成功，邮箱 24 小时后从数据库物理删除
- [ ] 回访邮件按 AI 计算的日期准时发送
- [ ] 退订链接工作
- [ ] 话题漂移时 AI 温柔拉回
- [ ] Claude Haiku 轻量检测在后台运行

---

## 关联资源

### 视觉参考

- `@docs/visual-reference/poju-visual-style-master.png`（参考 03 区块 POJU 核心流程）

### 相关文档

- `@.cursor/rules/05-visual-language.mdc` — 对话气泡视觉
- `@docs/POJU_Development_Document_v3.0.1_Final.md` — 第 02 章 POJU + 附录 A System Prompt
- `@docs/pages/03-syncro.md` — Summon Syncro 抽屉集成
- `@docs/pages/04-glyph.md` — Summon Glyph 抽屉集成
- `@docs/pages/06-archive.md` — Session 列表展示
- `@docs/pages/12-payment-callback.md` — 支付成功回跳

### 关键约束

- **零 mock placeholder**：所有功能真实可运行（Task 2 阶段 Mock AI 有真实伪造数据，Task 5 替换为真实）
- **思考气泡不保留**：用户刷新后看不到思考内容
- **对话数据加密**：IndexedDB 存储前 AES-256-GCM 加密
- **PDF 次数限制**：Session 内最多 5 次导出
- **朗读必须用 ElevenLabs**（Task 5）：浏览器 TTS 质量配不上 $9.99

---

✦
