# Workspace「个人能量列表」全链路备忘

> **用途**：git 回到「页面尺寸正常」的基线后，按本文把个人能量图（右栏）整条链路写回去。  
> **生成时点**：当前工作区已实现态（含 `pcm--rail` / prepare → openRight）。  
> **保存建议**：`git reset` 前先把本文件拷到仓库外，或单独 commit 留在另一分支。

文案 key：`workspace.pojuRail.matrixTitle` → 中文「个人能量图」/ 英文「Personal energy chart」。

---

## 1. 产品行为（用户看到什么）

```
确认出生信息
  → 中心动效（Preparing Spline）
  → 本地算 / 复用 matrix_list
  → 右侧栏打开，内嵌可折叠个人能量图（PojuEnergyMatrix）
  → 动效淡出 → 中心换成欢迎词 + 输入框（chat）
  → （可选）解锁后：右栏能量图收起，下方挂 base analysis 报告
```

**硬约束：**

- 能量图**只在右栏**渲染，**不**再往聊天消息里塞 `energy_matrix` bubble。
- 列表文案走 **template / 本地 SSOT**，`ensureProfileMatrixList` **零 LLM**。
- 右栏宽度：展开 = `3 × --ws-sidebar-width`（220 → 660）；收起 = 64px。

---

## 2. 文件清单（按层）

| 层 | 路径 | 职责 |
|---|---|---|
| Shell 挂载 | `components/workspace/WorkspaceShell.tsx` | `openRight` / `PojuRightRailGate` / 右栏 children |
| 右栏壳 | `components/workspace/WorkspaceRightDrawer.tsx` | 展开/收起、ScrollArea、dock 按钮 |
| 右栏内容 | `components/workspace/WorkspaceRightMatrixPanel.tsx` | 挂 `PojuEnergyMatrix` + 可选报告 |
| 状态机 | `components/workspace/WorkspacePojuPrepareContext.tsx` | phase / matrixPayload / expanded / unlock |
| 动效阶段 | `components/workspace/WorkspacePojuPreparingStage.tsx` | finalize + openRight + 切 chat |
| 中心面板 | `components/workspace/panels/EnginePanels.tsx` → `PojuPanel` | idle / handoff / preparing / chat |
| 计算落库 | `lib/poju/finalize-workspace-prepare.ts` | session + matrix，**过滤** energy_matrix 消息 |
| 矩阵数据 | `lib/poju/resolve-matrix-preview.ts` | `ensureProfileMatrixList` / `resolveProfileMatrixPayload` |
| 载荷构建 | `lib/poju/build-matrix-payload.ts` | `buildMatrixPayloadFromProfile` / `refreshMatrixPayload` |
| 档案读写 | `lib/profile/stored-profiles-service.ts` | `getStoredProfile` / `saveMatrixList` / `recordProfileUsage` |
| UI 组件 | `components/poju/PojuEnergyMatrix.tsx` | `compact` + `hideChrome` → `pcm--rail` |
| 矩阵样式 | `styles/poju-celestial-matrix.css` | `.pcm--rail` / `.pcm--compact` / `.pcm--embedded` |
| Workspace 样式 | `styles/workspace.css` | `.workspace-right-matrix*`、右栏玻璃、`.pcm--rail` 透明底 |
| i18n | `messages/zh.json` / `en.json` → `workspace.pojuRail` | 标题等 |

相关但非必须重写：`WorkspaceScrollArea.tsx`、`WorkspaceSidebarDockToggle.tsx`、`BaseAnalysisDeliveryView`（解锁报告）。

---

## 3. 时序 / 状态机

### 3.1 Phase（`WorkspacePojuPreparePhase`）

| phase | 含义 |
|---|---|
| `idle` | 出生表 / 旧档案；**强制关右栏** |
| `handoff` | 确认后淡出出生层；右栏仍关 |
| `preparing` | 中心 Spline + 算矩阵 |
| `exiting` | flash 淡出；**此时 `openRight()`** |
| `chat` | 中心欢迎+输入；右栏保持开（有 payload） |

### 3.2 触发链

1. `WorkspacePojuBirthHost` 确认 → `onPrepareStart(profileId)`  
2. `PojuPanel` / context：`startPrepare(profileId)` → `phase = "handoff"`  
3. handoff 计时结束 → `phase = "preparing"`，挂载 `WorkspacePojuPreparingStage`  
4. Stage 内：
   - `getStoredProfile`
   - `finalizeWorkspacePrepare(profileId, locale)`
   - 与 `waitRemainingMinSpline(...)` 并行
   - `setMatrixPayload` / `setSession`
   - `setPhase("exiting")` + `openRight()`
   - ~700ms 后 `setPhase("chat")`
5. `WorkspaceShell` 右栏：`tab === "poju"` → `<WorkspaceRightMatrixPanel />`  
6. Panel：有 `matrixPayload` 才渲染矩阵；否则 placeholder

### 3.3 右栏开关策略（`PojuRightRailGate`）

- POJU + (`idle` | `handoff`) → `setRightOpen(false)`
- 离开 POJU tab → `resetPrepare()`，右栏恢复 localStorage
- `openRight` 写 `localStorage["poju.workspaceRightDrawerOpen"] = "1"`

---

## 4. 数据链路（算什么、存哪里）

```
profileId
  → getStoredProfile (Dexie 加密档案)
  → createPOJUSession + bindPreviewProfileToSession
  → resolveProfileMatrixPayload
       → buildMatrixPayloadFromProfile + refreshMatrixPayload
       → ensureProfileMatrixList
            · 已有 matrix_list → 复用 (fromStorage)
            · 否则 template 生成 → saveMatrixList
       → applyStoredMatrixPreview
  → session.matrix_payload = payload
  → 删掉 messages 里 meta.kind === "energy_matrix"
  → seedMatrixWelcomeMessage（只欢迎词，不塞图）
  → savePOJUSession
  → Context.matrixPayload 供右栏读
```

**不要**在 workspace 路径再 `upsert` 聊天里的能量矩阵消息。

---

## 5. 样式实现方式（重点）

### 5.1 组件 props 组合（右栏专用）

```tsx
<PojuEnergyMatrix
  payload={matrixPayload}
  locale={locale}
  compact           // → pcm--compact pcm--embedded
  suppressNarrative // 不在图内再铺欢迎叙事
  hideChrome        // → pcm--rail（藏 logo/大页头气质，给侧栏用）
  expanded={matrixExpanded}
  onExpandedChange={setMatrixExpanded}
/>
```

`PojuEnergyMatrix` 根 class 逻辑：

```tsx
className={`pcm pcm--tabbed${compact ? " pcm--compact pcm--embedded" : ""}${
  hideChrome ? " pcm--rail" : ""
}`}
```

### 5.2 CSS 分层

**A. 组件本体** — `styles/poju-celestial-matrix.css`

- `.pcm--compact`：缩小 padding / header / title
- `.pcm--embedded`：透明底、关星空层
- `.pcm--rail`：侧栏表面色、导航/面板尺寸微调（如 `.pcm--rail .pcm-shell`、tabs active、shell panel）

**B. Workspace 壳** — `styles/workspace.css`（关键片段）

```css
/* 右栏个人能量图容器 */
.workspace-right-matrix {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 8px 4px 20px;
  box-sizing: border-box;
  overflow: visible; /* 滚动交给外层 WorkspaceScrollArea */
}

.workspace-right-matrix__body { min-width: 0; padding: 0; }

.workspace-right-matrix__report {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(212, 175, 55, 0.22);
}

.workspace-right-matrix__body .poju-matrix-bubble,
.workspace-right-matrix__body .pem,
.workspace-right-matrix__body .pcm {
  max-width: 100%;
}

/* 右栏玻璃 vs 矩阵面板：栏更透，面板更实；rail 自身背景透明以免叠色 */
.workspace-shell__right-drawer {
  background: rgba(18, 14, 28, 0.52);
}
.workspace-shell__right-drawer .workspace-right-matrix__body .pcm--rail {
  background: transparent;
}
```

**C. 右栏宽度 token** — 同文件 shell 顶部

```css
--ws-sidebar-width: 220px;
--ws-sidebar-collapsed: 64px;
--ws-right-drawer-width: calc(var(--ws-sidebar-width) * 3); /* 660 */
```

`.workspace-shell__right-drawer.is-open { width: var(--ws-right-drawer-width); }`

**D. 滚动**

- 右栏 body 用 `WorkspaceScrollArea`（自定义灰条，`fixedThumbPx={52}`）
- `.workspace-right-matrix` 自身 **不要** `overflow-y: auto`，避免双滚动条

### 5.3 展开/收起

- Context：`matrixExpanded` 默认 `true`（刚算完全开）
- 解锁仪式完成：`completeUnlockRitual` → `matrixExpanded: false`，腾出下方报告区
- 受控：`expanded` / `onExpandedChange` 传给矩阵 tabs 面板开合

---

## 6. 关键组件伪代码（重写时对照）

### `WorkspaceRightMatrixPanel.tsx`

```tsx
export function WorkspaceRightMatrixPanel() {
  const prepare = useWorkspacePojuPrepareOptional();
  if (!prepare?.matrixPayload) return <div className="workspace-right-drawer-placeholder" />;

  const { matrixPayload, matrixExpanded, setMatrixExpanded, baseReportText, baseReportStatus } = prepare;

  return (
    <section className="workspace-right-matrix">
      <div className="workspace-right-matrix__body">
        <PojuEnergyMatrix
          payload={matrixPayload}
          locale={locale}
          compact
          suppressNarrative
          hideChrome
          expanded={matrixExpanded}
          onExpandedChange={setMatrixExpanded}
        />
      </div>
      {baseReportStatus === "ready" && baseReportText ? (
        <div className="workspace-right-matrix__report">
          <BaseAnalysisDeliveryView ... variant="modal" showPageHeader={false} />
        </div>
      ) : null}
    </section>
  );
}
```

### `WorkspaceShell` 挂载点

```tsx
<WorkspacePojuPrepareProvider openRight={openRight}>
  ...
  <WorkspaceRightDrawer open={rightOpen} onOpen={openRight} onClose={closeRight}>
    <RightDrawerContext tab={tab} ... />  {/* poju → WorkspaceRightMatrixPanel */}
  </WorkspaceRightDrawer>
</WorkspacePojuPrepareProvider>
```

### `finalizeWorkspacePrepare` 关键一句

```ts
messages: session.messages.filter((m) => m.meta?.kind !== "energy_matrix"),
// Do not upsert energy_matrix message — chart renders in the workspace right rail.
```

---

## 7. 重写检查清单

- [ ] Confirm → preparing → **exiting 时才 openRight**（避免 Spline 画布中途被挤窄）
- [ ] idle/handoff 强制关右栏
- [ ] `compact` + `hideChrome` + `suppressNarrative`
- [ ] session **不**含 energy_matrix 消息；欢迎词单独 seed
- [ ] `matrix_list` 可复用；无则 template 落库
- [ ] 右栏 ScrollArea 单层滚动；`.pcm--rail` 背景透明
- [ ] 解锁后矩阵收起 + 报告挂在 `__report`
- [ ] 左栏仍 `--ws-sidebar-width: 220px`；右栏展开 660

---

## 附录 A：中心「旧档案列表」（不是能量图，但同阶段做过）

若回退后还要恢复「有档案时：左文案 + 右列表 + 置底输入新信息」：

| 文件 | 说明 |
|---|---|
| `WorkspacePojuBirthHost.tsx` | list / new 切换；确认对话框 |
| `WorkspacePojuProfileRecords.tsx` | 卡片行 + 置底 `输入新信息` |
| `WorkspacePojuBirthSideCopy.tsx` | 左栏隐私文案 |
| `EnginePanels.tsx` `PojuPanel` idle | 现用 `.ws-idle` / `.ws-idle__row` / `.ws-idle__panel` |
| `styles/workspace.css` | `.ws-idle*`、`.ws-idle-records*`、`.ws-idle-card*` |

**布局坑（已踩过）：**

- 外框有 `padding` 时，子元素再写 `height: 100%` + `overflow: hidden` → **底部按钮被裁**
- 正确：`flex` 列；列表 `flex: 1 1 0%; min-height: 0; overflow-y: auto`；按钮 `flex: 0 0 auto`
- 不要复用 `session-prep.css` 的 `.add-new-card-button { padding: 32px }`（会撑爆框）

当前结构示意：

```
.ws-idle
  .ws-idle__row (grid: 文案 | 面板)
    .ws-idle__copy
    .ws-idle__panel
      .ws-idle-records
        .ws-idle-records__list   ← 只这里滚
        .ws-idle-records__add    ← 钉底，永不裁
```

---

## 附录 B：建议回退策略

1. **先**把本文件复制到桌面 / 另一分支。  
2. `git checkout` / `reset` 到「中心尺寸正常」的 commit（例如曾对照的 `1d3cb9d` 或你认定正常的点）。  
3. **只**按第 2–7 节把「右栏个人能量」接回去；中心 idle 布局尽量用基线原样，附录 A 再单独加。  
4. 避免再把 marketing hero / compose-w / 聊天窄岛规则混进右栏链路。

---

*文档结束。*
