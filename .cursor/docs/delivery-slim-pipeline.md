# Delivery Slim Pipeline · 故障账本与编排定稿

SSOT 实现：`lib/llm/pro/delivery/run-segment-chain.ts` + `page-schema/*`  
产品验收：`.cursor/docs/pivot-八页交付验收标准.md`（六页活跃）

## Slim 硬规则（已定稿）

1. **不上架无 `page_schema`**
2. **禁止 narrative 降级出货**（fill 失败 → soft-wall 续跑或显式失败；永不 `runNarrativeTask` 交差）
3. **每页目标 ≤3 主 LLM**：deep（可跳过 P1）+ fill + mark
4. **Heavy fill 超时对齐 admit**（`SEGMENT_HEAVY_MIN_INVOKE_MS`，不再用 120s 饿死 high thinking）
5. **代码预分配** moat_class / P5 六槽 / mark 跳过空依据 seal
6. **失败三分可观测**：`generation_id` + `finish_reason` + `content_len` + `sanitize_reason`

## 故障账本（勾选 = 本轮已关）

| ID | 问题 | 状态 |
|----|------|------|
| F1 | P5/P3/P6 narrative 降级垃圾上架 | [x] refuse + missing_page_schema_refuse_ready |
| F2 | `compress_body_jargon:护身` | [x] plain-fallback 护身/护身符/印绶护身 |
| F3 | P6 `mark_incomplete:2/3`（seal 空槽） | [x] pickMark 过滤空 evidence + scatter 回贴 |
| F4 | P4 fill 120s 饿死推理 | [x] heavy fill ceiling = 180s admit |
| F5 | deep write `min(...,8k)` 误伤 | [x] 用满 `PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS` |
| F6 | P3→P4 echo 门禁未接线 | [x] `loadP3BodyExcerptForP4Moat` → sanitize |
| F7 | 科学执行误标 `p4_body_echo_p3` | [x] 改 `p4_science_exec_means` |
| F8 | full fill 跳过专名闸 | [x] full 也跑 jargon repair |
| F9 | P6 leftover 错贴 seal/复用 | [x] 只用未消费 unit |
| F10 | Finalize 灌 `POJU_IDENTITY` | [x] 交付薄身份 |
| F11 | `/v2/emaiicon` 404 | [x] next.config redirect |
| F12 | anchor-quality 刷黄 | [x] 降为 info |
| F13 | P4 moat_class 断链 | [x] 上轮 + compress dump（保持） |
| F14 | 门禁 vs 空响应日志混淆 | [x] fill 关联字段 |
| F15 | P1 空壳/薄稿/占位 why·when·name / 无锚仍上架 | [x] sanitize `p1_*` 硬闸 + fill 纠错 regen + heavy fill 180s + spine `desired_outcome` |
| F16 | P2 无表象菜单→硬闸打回碰运气；fill 120s 饿死；mono deep 超时 | [x] `foundation_surface_feed` + page-plan 加厚 + chunked deep + heavy fill 180s；闸门仅兜底 |
| F17 | P3 无手段菜单→编造鸡汤；fill 120s 饿死；question_expectation 未注入 | [x] `science_means_feed` + must_use Q期望 + heavy fill 180s；闸门仅兜底 |
| F18 | P4 无护城河手段菜单→编造/P3换皮；plan-path 资格标记错位 | [x] `metaphysics_moat_feed` + eligibility 对齐 + plan 加厚 dayun/十神；闸门仅兜底 |
| F19 | P5 无熔断菜单→通用提醒；Wave B 等 P4 饿死；plan 丢 path_costs | [x] `risk_fuse_feed` + ActionBrief 进 deep assign + Wave B=P1+P3（P4 可选）+ plan/risk_calc 加厚；heavy fill 180s；闸门仅兜底 |
| F20 | P6 无出门菜单→sanitize 软补稿；fill 120s 饿死；mono deep | [x] `close_ritual_feed` + 去软补 + chunked deep + heavy fill 180s + 锚闸；闸门仅兜底 |
| F21 | soft-wall hop 税 / deep rewrite 叠时钟触顶 | [x] `deep_assigned` checkpoint + defer rewrite hop；fill/mark/write 分层 admit（120/90/110） |

## 每页 hop（目标）

| 页 | deep | fill | mark |
|----|------|------|------|
| P1 | skip | full | skip |
| P2 | assign→write(∥)→rewrite hop | compress\|full | yes |
| P3 | assign→write(∥)→rewrite hop | compress\|full | yes |
| P4 | assign→write(∥)+moat→rewrite hop | compress\|full | yes |
| P5 | assign→write(∥)→rewrite hop | compress\|full | yes |
| P6 | assign→write(∥)→rewrite hop | compress\|full | yes（跳过空 seal） |

**Admit（ms）**：start/deep 180k · deep_assigned 110k · fill 120k · mark 90k · P1 bootstrap 40k（P1 fill 120k）

## Done 定义

见计划 Wave 出口：零 narrative 上架、半截 STOP 可关联、抽样过删依据尺。
