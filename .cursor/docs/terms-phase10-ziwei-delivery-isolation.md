# Phase 10 · 紫微用户交付输入隔离

**分支**：`feat/phase10-ziwei-delivery-isolation`（基于 P1 修正 `fix/p1-ns-aware-export-sanitize-v2`）  
**约束**：不改 iztro 计算、不改正式 ziwei SSOT 词条、不放宽 fail-closed。  
**测试**：`pnpm test:ziwei-delivery-isolation`（运行记录见 `terms-phase10-test-run-record.md`）

---

## B1 · 全链路审计

| # | 节点 | 进模型？ | 进用户出口？ | 传统原名？ | Phase 10 后 |
|---|---|---|---|---|---|
| 1 | `buildZiweiFactPack` | 否（计算真源） | 否 | **保留** 宫/星/四化/格局名 | **不变**（内部完整） |
| 2 | `buildZiweiDisplayFactPack` | 间接（闭集/镜片） | Baseline / companion | 仅 `_traditional` 内镜；展示用软标或空 | 已 fail-closed |
| 3 | `sliceForPage` / `buildZfp` | **是**（`formatPageSliceFeed` JSON） | 间接（模型→正文） | **曾泄漏** 宫星格原名 | **软投影**：SSOT 软标或隐藏；`patternHits`→`hit_id` |
| 4 | `pageSliceAnchorLines` | fill 锚 | 间接 | Phase 9 已软标 | 保持软标 / `结构格局×N` |
| 5 | Judgment Prompt | **是** | 否 | **曾灌** `patternHits[].name` + 原样 `thesis_block` | `hit:<id>:<level>`；`thesis_block` 经 `sanitizeZiweiLeaksInPromptText` |
| 6 | 页面正文 Prompt | **是**（page slice feed） | 否 | 随 slice | 随软 ZFP |
| 7 | Body Polish / Evidence Soft | 是 | 依据折层 | 走既有 `⟦t:⟧` / sanitize | 无新增传统 ZFP |
| 8 | PDF / HTML / 报告导出 | — | **是** | 出口 sanitize | P1 ns-aware + 既有 scrub |
| 9 | 30 天提醒 | — | **是** | companion sanitize | 默认可传 `confirmedTerms`；裸词 fail-closed |

### 字段级（切片出口）

| 字段 | 模型 | 用户 | 传统名处理 |
|---|---|---|---|
| `topicPalace.palace` | 软标（如核心定位域）或 `""` | 经模型 | 无传统回退 |
| `topicPalace.majorStars` | 仅已 SSOT 星；现多为 `[]` | 经模型 | 未映射隐藏 |
| `sihua[].mutagen` | 禄权科忌→四向软标 | 经模型 | 已映射 |
| `sihua[].star/palace` | 未映射→`""` | 经模型 | 隐藏 |
| `daxian` / `liunian` | 宫/星软或空；干支/年龄保留 | 经模型 | 同左 |
| `mingShen` | 星/局值软或空；支保留 | 经模型 | 同左 |
| `patternHits` | `{ hit_id, level, palaces[] }` | 禁古典名 | **无 `name`** |
| raw `ZiweiFactPack` | Lab/hash/指纹可读 | 不直出 | 完整传统 |

---

## B2 · 已修正

1. `buildZfp` 全字段经 `soft-zfp-labels` 投影后再进 `PageSlice.zfp`。  
2. `SlicedPatternHit` 改为 `hit_id`（SHA12），不再复制古典格名 / required 星名。  
3. Judgment `patternHitsFromZiwei` → `patternHitRefsForPrompt`。  
4. `formatPageSliceFeed` 传入 `locale`，切片 JSON 不含未批准传统名。  
5. 未知/internal_only：值为空字符串或从数组省略 —— **禁止** traditional fallback。

---

## B3 · 测试

- `pnpm test:ziwei-delivery-isolation` — 12 盘 × 5 语种；断言 slice.zfp / feed / hit refs  
- `pnpm test:ziwei-fact-pack` — 更新期望为软切片  
- `pnpm test:ziwei-term-completeness` — Phase 9 回归  
- `scripts/test-lab-ziwei-feed.ts` — 软锚回归  

---

## B4 · 修改文件清单与风险

| 文件 | 变更 |
|---|---|
| `lib/ziwei/soft-zfp-labels.ts` | **新建** 软标 / hit_id |
| `lib/ziwei/index.ts` | 导出 |
| `lib/llm/pro/delivery/slice-for-page.ts` | ZFP 软投影 + `locale` |
| `lib/llm/pro/delivery/page-slice-feed.ts` | 传 locale |
| `lib/llm/pro/delivery/book-judgment/generate.ts` | 格局 hit_id 喂料 |
| `scripts/test-ziwei-delivery-isolation-phase10.ts` | **新建** |
| `scripts/test-ziwei-fact-pack.ts` | 期望对齐 |
| `package.json` | `test:ziwei-delivery-isolation` |
| `.cursor/docs/terms-phase10-*.md` | 审计 + 运行记录 |

### 风险

| 风险 | 缓解 |
|---|---|
| 模型看不到古典格名，主张变薄 | 用 `hit_id:level` + 八字 CFP；产品确认后再上 A2 星曜 SSOT |
| `pattern_hits_used` 旧样本含格名 | 闸门仍接受 string；新枪写 hit_id；旧 Lab 样本可能需重跑 |
| Lab 人审 dump 仍读 raw pack 名 | **故意**：调试可看原名；用户/生成链路已隔离 |
| 未映射宫星切片大量空串 | 与 Phase 9 A1/A2 草案衔接；上 SSOT 前保持隐藏 |

---

## 非本阶段

- 不合并 A1/A2 自造词进 `POJU_TERMS`  
- 不改 iztro / doushu 规则  
- 不把 P1 与 Phase 10 混成同一 PR（P1 已在独立 commit/分支）

---

## Dual-layer addendum (Phase 11 soft/pack wire)

- Soft delivery (`sliceForPage` / `formatPageSliceFeed` / body visible): still **zero** unmapped traditional Ziwei.
- Evidence / BookJudgment destiny+all feeds: may include labeled `## 紫微传统闭集（依据层…）` + `formatGlobalSegmentFeedDuties` when `zfpOmitted=false`.
- Science judgment mode: no traditional closed-set.
- On-topic: CFP+ZFP per-segment duties; never dump whole chart into every section.
