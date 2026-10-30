# Phase 10 · 测试运行记录（含 Judgment Prompt 泄漏）

Date: 2026-10-30  
Branch: `feat/phase10-ziwei-delivery-isolation`（已 rebase 含最新 P1 `7fd03c82`）

## Commands（本机 agent 实跑）

```bash
pnpm test:ziwei-delivery-isolation
pnpm test:ziwei-fact-pack
pnpm test:ns-aware-export-exits
```

## Captured stdout（摘要）

```
========== test-ziwei-delivery-isolation-phase10 ==========
ok: 12 births × 5 locales slice isolation
ok: raw FactPack preserved
ok: judgment pattern refs are hit_id only
ok: formatPageSliceFeed clean
ok: judgment user Prompt one-shot + two-shot no traditional ziwei leaks
All Phase 10 delivery isolation tests passed.

ziwei-fact-pack W1+doushu+display ok
All P1 ns-aware export exit tests passed.
```

## Phase 10 本轮追加

- `thesis_block` → `sanitizeZiweiLeaksInPromptText`（软标 / `hit:id` / 隐藏）
- `buildBookJudgmentFeedBlock` 导出；一枪 `mode=all` + 两枪 destiny/science 泄漏断言
- `projectOther` 显式 allowlist（`relation` / `role` / `link_id`）
