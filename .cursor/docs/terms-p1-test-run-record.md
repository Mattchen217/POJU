# P1 · 真实测试运行记录（修正版）

Date: 2026-10-30  
Branch: `fix/p1-ns-aware-export-sanitize-v2`

## Commands

```bash
pnpm test:ns-aware-export-exits
pnpm test:shensha-phase4
```

## Captured stdout（本机 agent 实跑）

```
========== test-ns-aware-export-exits (P1 fix) ==========

ok: resolver ns split intact
ok: cross-ns registry includes 空亡/白虎
ok: maySoftMap gates on confirmed ns
ok: bazi 空亡/白虎 hard-strip (no qimen soft)
ok: qimen 空亡→覆盖缺口 / 白虎→冲击
ok: bare 空亡/白虎 fail-closed (strip, no soft)
ok: mixed ns confirmed → bare fail-closed
ok: 童子煞 hard-strip; confirmed qimen soft kept
ok: stripForbiddenShenSha with qimen confirmed
ok: sanitizePaymentAuditLeaks fail-closed without confirmed
ok: all export surfaces with qimen confirmed
ok: all surfaces bare fail-closed
ok: zh/en/es/de/fr all paths
ok: html attr/text nodes
ok: companion day-html qimen confirmed
ok: companion day-html bare fail-closed on dual-ns
ok: mixed report: per-section ns handling
ok: sourceId-scoped confirmedTerms (no whole-doc grant)
ok: bazi/non-qm markers hard-strip dual-ns
ok: marker slug-level: qm soft / bazi strip
ok: reminder day offline HTML confirmedTerms path
ok: reminder 30-day pack offline HTML confirmedTerms path
ok: reminder pack without confirmed fail-closed on dual-ns

All P1 ns-aware export exit tests passed.

All Phase 4 shensha tests passed.
```

## CI / Vercel

- GitHub Actions：仓库未配置对应 `test:ns-aware-export-exits` workflow run（本机脚本验收）。
- `gh` 未登录；`npx vercel ls` 在本环境卡住/需交互登录，**未能拉取到 P1 预览部署失败原因**。
- 请在 GitHub PR Checks / Vercel Dashboard 对 `fix/p1-ns-aware-export-sanitize-v2` 查看 deployment status；若失败，把 build log 贴回再查。

## 本轮相对 v1 的补齐

1. `⟦t:⟧` marker：非 `qm_*` 携带空亡/白虎 → 硬剥离；`qm_*` → 软标。
2. `confirmedTerms.sourceId` + sanitize `sourceId`：段落级授权，禁止整文 qimen 确认放行所有同名词。
3. `buildReminderDayOfflineHtml` / `buildReminderPackOfflineHtml` 传递 `confirmedTerms` + `termSourceId`。
