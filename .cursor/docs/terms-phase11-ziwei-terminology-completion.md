# Phase 11 · Ziwei Terminology Completion — 验收记录

**分支：** `feat/phase11-ziwei-terminology-completion`  
**依据：** Phase 9 inventory / coined draft；不公开格局名；不扩大杂曜。

## 增量

| 项 | 数量 |
|---|---|
| 新增 SSOT（ns=ziwei） | **36** |
| 紫微 SSOT 合计 | **50**（原 14 结构 + 36） |
| 十二宫 | 12/12 |
| 五行局配置值 | 5/5 |
| 主星 | 14/14 |
| 辅星（已观测） | 6/6 |
| 五语言 term+definition | 36/36 |

注：`迁移` 中文展示定为 **流动切换域**（避免软名内嵌传统「迁移」触发泄漏扫描）。slug 仍为 `zw_mobility_field`。

## 命令与结果（本机实跑）

```text
pnpm inventory:ziwei-terms-phase9   → ssotZiwei: 50
pnpm test:ziwei-term-completeness   → phase9+11 ok; dual-ns ok; displayBlockedSampleAtoms: 0
pnpm test:ziwei-fact-pack           → displayResolved: 82, displayBlocked: 0
pnpm test:term-resolve              → All Phase 1 resolver tests passed
pnpm test:ziwei-delivery-isolation  → All Phase 10 delivery isolation tests passed
pnpm test:ns-aware-export-exits     → All P1 ns-aware export exit tests passed
pnpm run build                      → (see CI / local log)
```

## 双 namespace

| 传统词 | ns | slug |
|---|---|---|
| 七杀 | ziwei | `zw_star_breach_force` |
| 七杀 | bazi | `qi_sha` |
| 文昌 | ziwei | `zw_star_script_clarity` |
| 文昌 | bazi | `wen_chang` |
| 流年 | ziwei | `zw_yearly_cycle` |
| 流年 | bazi | `year` |

## Baseline 样例（birth 2000-08-16 zh）

```text
核心定位域|枢轴星轨
对照定位域 · 流动切换域|欲求星轨
核心驱动 / 行动驱动|重整星轨 / 文晰星轨
行动落点域|职分事功域 · 戌
元素配置型|木三配置
长周期段|伙伴关系域 23–32 · 破局星轨
四向转化|…（软标 · 无传统宫星原名）
```

格局原名不进用户面；Prompt 仍走 Phase 10 `hit_id`。
