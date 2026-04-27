# 06 · The Archive `/archive`

## 页面身份

| 项 | 值 |
|---|---|
| 路由 | `/archive` |
| 文件位置 | `app/(product)/archive/page.tsx` |
| 页面标题 | `The Archive — Your personal vault` |
| 目标用户 | 所有用户（付费和免费都用） |
| 核心目标 | 统一展示用户在三个产品中的历史数据，完全本地可控 |
| 优先级 | 中高（跨 Task 持续完善） |
| 所属 Task | Task 1（空状态）→ Task 2（POJU 条目）→ Task 3（Syncro）→ Task 4（Oracle）→ Task 5（Wipe Everything） |

---

## 访问条件

- 所有人可访问
- 无需登录
- 数据完全来自本地 IndexedDB
- **清除浏览器数据 = 所有 Archive 内容消失**（这是特性不是 bug）

---

## 页面结构清单

1. 顶部区（标题 + 隐私提示）
2. 筛选标签（All / POJU / Syncro / Oracle）
3. 搜索框（可选展开）
4. 历史条目列表（按时间分组倒序）
5. Wipe Everything 按钮
6. Footer

---

## 区块详细内容

### 1. 顶部区

**标题**：`✦ THE ARCHIVE`

**副标题**：`Everything here lives only on this device.`

**小字说明**（可选展开）：
```
Your readings, signs, and conversations are all here — 
stored encrypted on this device only. We never have a copy.

Clear your browser data, and all of this disappears forever.
```

**右上角**：进入 Archive 时显示一次性提醒 Toast（首次访问）：
```
Remember: all of this lives only here. 
Back up anything precious before clearing your browser.
```

---

### 2. 筛选标签

**四个标签横排**，水平对齐：

```
[ All ]  [ POJU ]  [ Syncro ]  [ Oracle ]
```

**默认选中**：`All`

**点击行为**：
- 切换显示对应类型的条目
- 选中标签高亮紫色
- 其他灰色
- 切换时条目列表有 fadeIn 动画（200ms）

**每个标签右侧小数字**（可选）：显示该类型条目总数，如 `POJU (12)`

---

### 3. 搜索框（可选展开）

**默认折叠**为搜索图标（右上角）。

**点击展开**：
- 展开为横向输入框
- 占位符：`Search your archive...`
- 实时搜索（输入即过滤）
- 搜索范围：条目标题 + 首问题脱敏片段
- 支持英文 + 中文

**清除按钮 `×`**：点击关闭搜索，恢复默认视图

---

### 4. 历史条目列表

**按时间分组**（倒序）：

- **Today**
- **Yesterday**
- **This Week**
- **This Month**
- **Earlier**

**分组标题样式**：
- 小字（Body-S 14px）
- 灰色（`--text-dim`）
- 左对齐
- 上方 16px 间距

---

### 4.1 POJU Session 条目

**格式**：
```
┌──────────────────────────────────────────┐
│ [图标] Apr 19 · POJU                     │
│ "Dad and I keep..."                      │
│ Still active · 12 messages               │
│                                          │
│ [ Resume ]  [ Archive ]  [ Wipe ]        │
└──────────────────────────────────────────┘
```

**字段**：
- 图标：POJU 紫色圆形
- 日期 + 产品类型
- 首问题前 6 字**脱敏**（如 `"Dad and I..."`）
- 状态：`Still active` / `Archived` + 消息数
- 三个操作按钮

**操作按钮**：

#### `Resume`
- **仅 Still active 状态的 Session 显示**
- 点击 → 跳转 `/chat?session=[id]` 并加载该 Session 上下文
- 加载后 AI 可能问：`It's been X days. What happened since we talked?`

#### `Archive`
- 将 Session 状态改为 `archived`
- 数据保留，但从 Chat 左侧栏顶部活跃列表中移除
- 用户可在 Archive 页重新 Resume

#### `Wipe`
- 弹出二次确认：
  ```
  Wipe "Dad and I..." forever?
  This cannot be undone.
  
  [ Wipe ]  [ Cancel ]
  ```
- 确认 → 从 IndexedDB 彻底删除该 Session 和所有消息

#### 长按 / 右键 展开更多
- ✎ Rename
- 👁 Hide（隐藏但不删除）

---

### 4.2 Oracle 条目

**格式**：
```
┌──────────────────────────────────────────┐
│ [图标] Apr 18 · Oracle                   │
│ "About my decision to move..."           │
│ ✦ Calm Current · Sign of Flow            │
│                                          │
│ [ View ]                                  │
└──────────────────────────────────────────┘
```

**字段**：
- 图标：Oracle 粉紫色菱形
- 日期 + 产品类型
- 问题摘要（60 字符以内）
- 签等级 + 副标题
- `View` 按钮

**操作**：

#### `View`
- 全屏显示该卡片（Oracle 卡片完整格式）
- 右上角 `×` 关闭
- 底部：
  - `Share as image`
  - `Ask POJU about this sign · $9.99`（metadata: `archive_oracle_reopen`）

#### 长按
- 🗑 Delete
- ✎ Rename question

---

### 4.3 Oracle 3 签联动组合条目

**格式**（特殊展示）：
```
┌──────────────────────────────────────────┐
│ [图标] Apr 18 · Oracle (3-Sign Reading)  │
│ "About my decision to move..."           │
│                                          │
│  ┌────┐ ┌────┐ ┌────┐                   │
│  │Past│ │Pres│ │Futr│   ← 三个小缩略图   │
│  └────┘ └────┘ └────┘                   │
│                                          │
│ Linked with POJU session Apr 18          │
│                                          │
│ [ View spread ]  [ Open POJU chat ]      │
└──────────────────────────────────────────┘
```

**操作**：

#### `View spread`
- 打开 3 签组合视图
- 可分别点击每张卡查看完整内容

#### `Open POJU chat`
- 跳转关联的 POJU Session
- 如果 POJU Session 已被 Wipe，显示提示：`The linked chat has been wiped. Only the signs remain.`

---

### 4.4 Syncro 条目

**格式**：
```
┌──────────────────────────────────────────┐
│ [图标] Apr 17 · Syncro                   │
│ "My desk" · Facing Northwest             │
│ Shen hour · 3:47 PM · Newark, DE         │
│                                          │
│ [ View ]  [ Re-read now ]                │
└──────────────────────────────────────────┘
```

**字段**：
- 图标：Syncro 青色罗盘
- 日期 + 产品类型
- 用户自定义名（如有） + 方位（自然语言）
- 时辰 + 时间 + 位置（城市）

**操作**：

#### `View`
- 显示当时的方位图快照（8 方位表格 + 粒子球静态图）

#### `Re-read now`
- 基于当前时辰重新调用 AI 分析该方位
- 显示旧报告和新报告的对比
- 常用场景：用户换到新地点或新时辰，想重新看这个方向

#### 长按
- 🗑 Delete
- ✎ Rename

---

### 4.5 隐藏的条目

**格式**：
```
┌──────────────────────────────────────────┐
│ [图标] Apr 15 · POJU                     │
│ [ Hidden by you ]                        │
│                                          │
│ [ Reveal ]  [ Wipe ]                     │
└──────────────────────────────────────────┘
```

- 问题内容不显示，仅占位
- `Reveal` → 恢复原样显示
- `Wipe` → 彻底删除

---

## 空状态

### 整个 Archive 为空

```
┌──────────────────────────────────────┐
│                                      │
│        ✦  THE ARCHIVE  ✦             │
│                                      │
│       Nothing here yet.              │
│                                      │
│   Your readings, signs, and          │
│   conversations will live here —     │
│   only on this device.               │
│                                      │
│   ──────                             │
│                                      │
│   [ Ask your question → ]            │
│   [ Receive a sign → ]               │
│   [ Read your energy → ]             │
│                                      │
└──────────────────────────────────────┘
```

**三个按钮**：
- `Ask your question →` → Stripe Checkout（metadata: `archive_new_question`）
- `Receive a sign →` → 跳转 `/oracle`
- `Read your energy →` → 跳转 `/syncro`

### 单个筛选类别为空

**只有 POJU 标签选中且无 POJU 数据时**：
```
No POJU sessions yet.

[ Start your first POJU session · $9.99 ]
```

其他类别空状态类似。

---

## Wipe Everything 流程

### 按钮位置

页面最底部，独立区域，与条目列表隔开：

**按钮**：
```
[ Wipe everything ]
```

样式：Tertiary 紫色文字（克制，不吓人），右下角对齐

### 点击触发确认弹窗

```
┌──────────────────────────────────────┐
│                                      │
│       Wipe everything?               │
│                                      │
│   All conversations.                 │
│   All signs.                         │
│   All readings.                      │
│   All of your data on this device.   │
│                                      │
│   This cannot be undone.             │
│                                      │
│   Type "WIPE" to confirm:            │
│   [  ____________  ]                 │
│                                      │
│   [ Wipe everything ]  (初始禁用)    │
│   [ Cancel ]                         │
│                                      │
└──────────────────────────────────────┘
```

**要求用户打字 "WIPE"**：
- 字母大写
- 完全匹配才激活按钮
- 输错 → 按钮保持禁用

**确认 Wipe 后**：
1. 清除所有 IndexedDB 表
2. 清除 localStorage（除了 `pojulife_disclaimer_v1`，保留避免再次弹免责）
3. 重载页面
4. 显示成功 Toast：`Everything wiped. You're starting fresh.`
5. 跳回 `/` 首页

---

## 数据依赖

### 需要读取的存储

**IndexedDB**：
- `sessions` 表（POJU Session）
- `messages` 表（消息数，计算用）
- `oracle_entries` 表（Oracle 抽签）
- `syncro_entries` 表（Syncro 方位 + 精准拍照）

**localStorage**：
- `pojulife_archive_toast_seen`（首次访问 Toast 是否显示过）

### 需要调用的 API

- **无**（完全离线）
- 例外：`Re-read now` 按钮触发 `POST /api/ai/syncro`

### 查询逻辑

```typescript
// 按类型 + 时间范围查询
const sessions = await db.sessions
  .orderBy('created_at')
  .reverse()
  .toArray();

const oracles = await db.oracle_entries
  .orderBy('question_timestamp')
  .reverse()
  .toArray();

const syncros = await db.syncro_entries
  .orderBy('timestamp')
  .reverse()
  .toArray();

// 按时间分组
const grouped = groupByTimeRange([
  ...sessions.map(s => ({ ...s, type: 'poju' })),
  ...oracles.map(o => ({ ...o, type: 'oracle' })),
  ...syncros.map(s => ({ ...s, type: 'syncro' })),
]);
```

---

## 响应式行为

### Desktop (≥1024px)

- 筛选标签横排
- 条目列表垂直单列，最大宽度 800px 居中
- 搜索框右上角

### Tablet (768px – 1023px)

- 筛选标签横排
- 条目列表单列
- 搜索框可能收起为图标

### Mobile (<768px)

- 筛选标签可横向滚动
- 条目全宽
- 操作按钮宽度加大便于触摸

---

## 空状态与错误状态

### 空状态

见上方"空状态"部分（整体空 + 单类别空）

### 错误状态

- IndexedDB 读取失败 → `We couldn't load your archive. Try refreshing the page.`
- `Re-read now` 失败 → Toast：`Something in the signal is unclear. Try again.`
- 浏览器不支持 IndexedDB → `Your browser doesn't support local storage. Try Safari, Chrome, or Firefox.`

---

## 验收标准

### Task 1 阶段（空状态）

- [ ] 访问 `/archive` 显示空状态
- [ ] 三个引流按钮正确跳转
- [ ] 筛选标签显示但无数据时切换无影响
- [ ] Footer 完整

### Task 2 阶段（POJU Session 条目）

- [ ] POJU Chat 创建的 Session 出现在 Archive
- [ ] Session 条目显示正确（日期 + 脱敏问题 + 消息数）
- [ ] Resume 按钮跳转到对应 Session
- [ ] Archive 按钮改状态
- [ ] Wipe 按钮二次确认后删除
- [ ] 长按展开 Rename / Hide 选项

### Task 3 阶段（Syncro 条目）

- [ ] Syncro 历史条目出现
- [ ] `View` 显示当时的方位快照
- [ ] `Re-read now` 调用 AI 重新分析

### Task 4 阶段（Oracle 条目）

- [ ] Oracle 抽签历史自动出现
- [ ] `View` 全屏显示卡片
- [ ] 3 签联动以组合条目形式展示
- [ ] `Open POJU chat` 跳转关联 Session

### Task 5 阶段（Wipe Everything）

- [ ] `Wipe everything` 按钮触发打字确认
- [ ] 必须正确打字 "WIPE" 才能激活
- [ ] 确认后所有 IndexedDB 表清空
- [ ] localStorage 保留免责确认 flag
- [ ] 跳回 `/` 显示成功 Toast

### 通用

- [ ] 筛选标签切换正确
- [ ] 搜索功能工作（英文 + 中文）
- [ ] 时间分组（Today / Yesterday / This Week）正确
- [ ] 空状态 / 单类别空状态显示正确
- [ ] 隐藏条目可恢复可彻底删除

---

## 关联资源

### 视觉参考

- `@docs/visual-reference/poju-visual-style-master.png`（参考 01 区块 The Archive 卡片样式）

### 相关文档

- `@.cursor/rules/05-visual-language.mdc`
- `@docs/POJU_Development_Document_v3.0.1_Final.md` — 第 07.7 节 The Archive
- `@docs/pages/05-chat.md` — POJU Session Resume 跳转目标
- `@docs/pages/04-oracle.md` — Oracle 卡片展示格式

### 关键约束

- 所有数据**绝对不上传服务器**
- Wipe 后数据真正消失（不要做"软删除"）
- 问题**必须脱敏**（首问题前 6 字 + `...`）
- 隐藏不等于删除（Hide 和 Wipe 是两个不同操作）

---

✦
