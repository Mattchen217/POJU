# Namespace collision report

Git: `53fd647fdda4f8f0ef501c15fc920f1204eeeeee` · branch `main`

## Cross-namespace same traditional in SSOT

Count: **3**

### 流年
- **bazi** `year` → 岁环
- **ziwei** `zw_yearly_cycle` → 年度周期

### 六合
- **bazi** `liuhe` → 双契
- **qimen** `qm_liu_he` → 纽带

### 驿马
- **bazi** `yi_ma` → 迁徙
- **qimen** `qm_mobility_marker` → 移动标记

## Notable dual-ns (product-critical)

| traditional | bazi | qimen | ziwei |
|---|---|---|---|
| 空亡 | forbidden/redline | legal soft (覆盖缺口) | — |
| 白虎 | forbidden/redline | legal soft (冲击) | — |
| 七杀 | qi_sha 淬炼 | — | zw_star_breach_force (Phase11 branch) or missing on main |
| 文昌 | wen_chang 慧思 | — | zw_star_script_clarity (Phase11) / also CLOSED_SHEN_SHA |
| 流年 | year 岁环 | — | zw_yearly_cycle 年度周期 |

## Resolver risks

- `pojuTermByTraditional` without namespace still exists (deprecated) — cross-ns first-match risk.
- `resolvePojuTerm(input, { namespace })` is the required API.
- P1 ns-aware sanitize: dual-ns bare tokens fail-closed unless segment-scoped confirmedTerms.
