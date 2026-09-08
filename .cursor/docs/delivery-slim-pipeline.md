# Delivery Slim Pipeline · 故障账本与编排定稿

SSOT 实现：`lib/llm/pro/delivery/run-segment-chain.ts` + `page-schema/*`  
**第四阶段分发编排**：`lib/llm/pro/delivery/dispatch/*` + `POST /api/poju/final-delivery/task`（原子任务 ≈300s；segments 不再同 invoke `Promise.all` 多页）  
产品验收：`.cursor/docs/pivot-八页交付验收标准.md`（六页活跃）

## Slim 硬规则（已定稿）

1. **不上架无 `page_schema`**
2. **禁止 narrative 降级出货**（fill 失败 → soft-wall 续跑或显式失败；永不 `runNarrativeTask` 交差）
3. **每页目标 ≤3 主 LLM**：deep（可跳过 P1）+ fill + mark；**每 phase 仅 1 次主调用 + 1 次重试**，再失败 → interrupt + Continue（禁无限 soft-wall）；内层格式纠错与外层不叠满额
4. **Heavy fill 超时对齐 admit**（`SEGMENT_HEAVY_MIN_INVOKE_MS`，不再用 120s 饿死 high thinking）
5. **代码预分配** moat_class / P5 六槽 / mark 跳过空依据 seal
6. **失败三分可观测**：`generation_id` + `finish_reason` + `content_len` + `sanitize_reason`
7. **优先首枪合格**：候选菜单 + 页提示词生长源；闸门/重试只兜底一次，禁止靠重试碰运气出货
8. **Job 全局熔断**：`created_at` 墙 40m 或 `/continue` hops≤18 → `failXhighJob`（与业务计数器无关）
9. **Vercel 步骤脊柱**：`[FD]` 一步一行（`delivery-step-log.ts`）；`/status` running 轮询默认静默 — Live 日志过滤 Messages=`[FD]`

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
| F22 | P6 卡死近 2h：soft-wall/心跳/fail 重置无限调模型 | [x] phase 1+1 LLM、transport≤2、soft_hop≤8、绝对墙钟停、fail 不再 reset+handoff、客户端预算原因禁 auto-resume；停因+Continue |
| F23 | 多套独立重试上限嵌套 + 无 job 总量熔断 | [x] `DELIVERY_GEN_ATTEMPTS_MAX=2` 统一；质量失败不 soft-yield 再叠内层；job 墙 40m + continue hops≤18 全局熔断；fuse→Regenerate |
| F24 | P4 `moat_class→means.type` 靠模型自觉 → `p4_missing_moat_means` 重试赌 | [x] sanitize 前 `stampP4MeansTypesFromDeepPlan` 按 deep plan 强制回填 type；闸门只验机制内容 |
| F25 | P3 `compress_body_off_lock:年支/大运` 烧尽 1+1 → `phase_budget_exhausted`（Continue 81ms 再炸）→ waveAbort 连带 P4 AbortError + `full_fill_fallback` 降级 | [x] **根因**：compress 提示说 ⊆lock 却不注入允许表；professional_evidence / science_means_feed 裸灌 年支·大运。**首枪**：允许表+平替提示；dump/菜单/hint/tally scrub；正文零专名（P2–P6 L2 对齐）；deep 禁槽外裸专名；dayun 标题/契约/类目标签去「大运」示范。**闸门同构**：`compress_body_mingli`（零专名，非 ⊆lock）。**兜底**：plain-repair + Continue 重置 phase + 质量失败不杀兄弟页；禁 full_fill 降级 |
| F26 | deep write 硬封顶 100s → xhigh+慢 TTFT 客户端 `llm_timeout`（OpenRouter finish=`-`）→ 同 invoke 连重试 → 260s pre-kill Abort | [x] write 超时对齐 **200s**（= mark/xhigh finalize；非整段 300s）；timeout/abort 不在同 invoke 二次硬刚；预算不足不启写；timeout 优先 soft-wall 换新 invoke |

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
