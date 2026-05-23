# Syncro v5.0 · Step 11 报告

## 完成项

### 11.1 Archive 服务 (`lib/archive/archive-service.ts`)

- `SyncroTaskArchiveData` — 存 `syncro_session_id`、任务、窗口时间、`best_combination`（不存完整 96 matrix）
- `saveSyncroToArchive()` — 按 `CURRENT_LEVELS.score` 选最佳组合，写入 `type: syncro_task`、`product: syncro`
- `loadSyncroArchive()` — 解密读取

### 11.2 Computing 页自动存档

`SyncroComputingPage` 在 `createSyncroSession` 成功后调用 `saveSyncroToArchive`（失败仅 `console.error`，不阻断进入罗盘）。

### 11.3 Archive UI

- `components/archive/syncro-archive-detail.tsx` — 任务原文、最佳峰值、打开 `/syncro/result/[id]` 或过期后回 `/syncro`
- `archive-detail-client.tsx` — 优先加载 Syncro，再 Glyph / POJU
- `ArchiveActionPlansList` 已支持 `product: syncro` 筛选（🧭 图标）

### 11.4 i18n

`archiveDetail.syncro_*` + `archiveVault.empty_message` 更新（5 语种）。

## 验证

```bash
pnpm exec tsc --noEmit
pnpm exec tsx scripts/test-syncro-v5-step11.ts
```

## 手动 E2E 清单（需实机）

| 场景 | 要点 |
|------|------|
| A 桌面 | `/syncro` 仅引导，无开始按钮 |
| B 手机首次 | 免费 CTA → task → prepare → location → computing → result |
| C 已用免费 | 显示 $4.99（payment 占位） |
| D 24h 过期 | `/syncro/result/[id]` 过期页；Archive 详情显示过期 +「开始新的 Syncro」 |
| E Archive | `/archive` 见 Syncro 条目；点进见 `best_combination`；未过期可「打开实时罗盘」 |

## 说明

- 完整 matrix 仍在 IndexedDB `syncro_sessions`（加密）；Archive 仅存摘要，控制体积。
- Step 11 不要求 live DeepSeek 复测；若需贴 latency/tokens，在 Step 8 `--live` 脚本中查看。

🛑 用户确认后：**Syncro v5.0 重构 Steps 1–11 完成。**
