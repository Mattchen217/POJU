# Phase 10 · 测试运行记录

Date: 2026-10-30（本地 agent 跑通）

## Commands

```bash
pnpm test:ziwei-delivery-isolation
pnpm test:ziwei-fact-pack
pnpm test:ziwei-term-completeness
node ./node_modules/tsx/dist/cli.mjs scripts/test-lab-ziwei-feed.ts
pnpm test:ns-aware-export-exits   # P1 regression on same branch tip
pnpm test:shensha-phase4          # P1 adjacent
```

## Results（摘要）

```
========== test-ziwei-delivery-isolation-phase10 ==========
ok: 12 births × 5 locales slice isolation
ok: raw FactPack preserved
ok: judgment pattern refs are hit_id only
ok: formatPageSliceFeed clean
All Phase 10 delivery isolation tests passed.

ziwei-fact-pack W1+doushu+display ok
ziwei-term-completeness phase9 ok { births: 10, staticPool: 41, patternNamesObserved: 22 }
lab-ziwei-feed ok { anchors include 核心定位域; triggers soft }
All P1 ns-aware export exit tests passed.
All Phase 4 shensha tests passed.
```

## Notes

- Slice assertions target `sliceForPage().slice.zfp` JSON, not only anchors.
- Raw `buildZiweiFactPack` still contains traditional 命宫/星/格局 for computation & Lab dumps.
