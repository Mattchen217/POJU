# v1 Wave 0–5 落地就绪复核

**Verdict: Partial。** 不能把 Wave 0–5 当成已经落地。  
**给 Max 的下一闸：** 先不要默认 `DELIVERY_PIPELINE=v3`。离职创业样例可以跑，但必须在「骨架模式 + 封印页 schema 真传进 Companion」的条件下做人审 §3.5；样例过了也不等于可以开 v3。

| 项 | 结论 |
|----|------|
| 代码在哪 | **已在 `origin/main`**。`f6cc1952` + `65fb9ae1`（`mattchen217`，2026-10-27，提交说明「9页决策报告落地」）。本复核对着 tip `65fb9ae1`。没有更新的未合并落地分支。 |
| 自测两支 | **都过**（见 §2）。覆盖面窄于 Wave 声称。 |
| 五条旧阻断 | 1 Closed · 2 Partial · 3 Partial · 4 Partial · 5 Partial |
| 共同决策双 FactPack | **仍未做，且应继续延后。** 本落地没有第二份 `ChartFactPack`。 |
| pipeline-v3 | **没有被打开。** `resolveDeliveryPipeline()` 空环境返回 `legacy`。`.env.example` 里 `DELIVERY_PIPELINE=v3_three_step` 仍是注释。 |

审计日：2026-10-27。只读对照 SSOT《Eastern OS v1 决策交付产品边界》与《v1 九模块落地计划》。本文不改运行时代码、不改 flag、不推 `main`。

---

## 1. 一页纸

Max 声称的形状刀大多已经进树：03–06 有 sanitize case、十段 skeleton 已登记、四份独立 duty、L1 改成双底层人设、`gateDualEvidenceParts` 加了反冒充、`RiskItemBlock` 改走 `DualEvidenceBody`、`PUSH_GATE = 0.85`、06 `exit` 在 Zod/sanitize 必填、人审清单文件在、v3 默认关。

承重还没接上。挂依据页的 `metaphysics_evidence` / `science_evidence` 在 `EvidenceSlotSchema` 里仍是 `optional()`，`sanitizePageJson` 不因缺 A/B 失败。默认 fill 形状模式仍是 `mock`，v1 key 没有 few-shot，十段 skeleton 只有 `DELIVERY_FILL_SHAPE_MODE=skeleton` 才会进 prompt。生产 `POST /api/companion/job` 不传 `pageSchemas`，封印的 `anchor_closed_hints` 是三支空数组，种子仍切 brief claim。07/08 仍是旧 P3 科学套件 / P4 东方谋略，只加了两句分界。

所以：架子比 10-26 Partial 审计前进了一大截，产品尺（02–09 折叠双轨必填、删段三问能被机闸与 UI 同时守住、Daily Anchor 吃 06–09 闭集）还没立住。

---

## 2. 自测

在 `65fb9ae1` 上执行：

```bash
pnpm exec tsx scripts/test-v1-nine-module-sanitize.ts
# test-v1-nine-module-sanitize: ok

pnpm exec tsx scripts/test-delivery-schema-layer2.ts
# delivery schema Layer2 smoke OK
# keys = V1 十段，bootstrap=decision_brief，closing=validation_close
```

两支 exit 0。

`test-v1-nine-module-sanitize.ts` 实际钉住的是：

- 03/04/05 一份厚稿 `sanitize` `ok: true`
- 06 无 `exit` → `strategy_missing_exit`
- 十个 `V1_DELIVERY_SEGMENT_KEYS` 的 skeleton 非 null
- `fillDutyForKey("personal_decision_patterns")` 含「个人决策模式」，bottleneck duty 不含「只译批断」
- `scienceDisciplinesForSegment("situation_analysis").length >= 1`（读蓝图，不读 fill prompt 字符串）
- `gateDualEvidenceParts`：有 A+B 且带本案词 → ok；缺 B → `dual_missing_science`；「科学验证了八字」→ `dual_pseudo_fusion`

它**没有**覆盖：缺 A、科学段无本案词、科学段冒充命理、命理段冒充科学、页 JSON 缺双轨仍 `sanitize` 成功、02 事实/假设/缺口为空仍成功、fill prompt 里是否出现选科句、`RiskItemBlock` / 书架是否把结构化双字段交给 UI、Companion 空 hints 回落 brief、`PUSH_GATE`、07/08 交叉复读。

`test-delivery-schema-layer2.ts` 钉的是十 key 顺序、legacy 别名、书架含十段、以及一份 metaphysics pack。它不验收双轨必填。

---

## 3. Wave 逐条

### Wave 0 · PASS

声称：产品边界 / blueprint / 书架注释改成「十段已切、承重接通中」；layer2 改为 10 key。

| 证据 | 位置 |
|------|------|
| 「出稿 key 已切十段……承重链路（sanitize / 独立 duty / 双轨必填）仍在接通中」 | `.cursor/docs/v1-决策交付-产品边界.md` 头注，修订行 2026-10-26 |
| 「出稿 `delivery_segments` 已切 v1 十段 key……承重链路……接通中」 | `lib/poju/report-blueprint.ts` 头注 |
| 「cover → toc → v1 十段 prose → appendix」 | `lib/poju/delivery-shelf-slots.ts` |
| `DELIVERY_SEGMENT_KEYS.length === 10` 且顺序等于 `V1_DELIVERY_SEGMENT_KEYS` | `scripts/test-delivery-schema-layer2.ts` |

迁移映射 `.cursor/docs/v1-九模块与现网六页-迁移映射.md` §5 把 Wave 1–4 全部勾成完成、只留 Wave 5 人审未勾。以本文 §3 的 PARTIAL 为准，这张勾选表超前于代码。头注本身的「接通中」比勾选表诚实。

### Wave 1 · PARTIAL

声称：03–06 sanitize；fill-shape-skeleton v1 十 key；独立 prompt（`p-patterns` / `p-bottleneck` / `p-options` / `p-strategy`）。

**在树上的：**

- `sanitize.ts` 有 `personal_decision_patterns`、`bottleneck_analysis`、`strategic_options`、`recommended_strategy` 四个 case。03/04 复用 why_cards（1–3），05 洗 `options` 且 `<2` → `options_lt_2`，06 缺 exit → `strategy_missing_exit`。
- `DELIVERY_FILL_SHAPE_SKELETON` 登记了十个 v1 key，外加六条 legacy 转发。`fillShapeSkeletonForKey` 先查 v1，再 `canonicalizeDeliverySegmentKey`。
- `page-prompts/index.ts` 的 `BY_KEY`：03→`p-patterns`，04→`p-bottleneck`，05→`p-options`，06→`p-strategy`。不再是 03/04→p2、05→p3、06→p1。
- 四份新 duty 写了本题模式 / 1–3 障碍 / 2–4 选项 / 主辅+exit，并点了删 A 应垮、禁伪融合。

**未接通的：**

- 生产默认形状模式仍是 mock。`fill-shape-mode.ts`：`DELIVERY_FILL_SHAPE_MODE` 未设置时返回 `"mock"`。`.env.example` 里 skeleton 是注释。
- `legacyFillFewShotForKey` 只登记旧六 key（`direct_answer` / `foundation` / `science_action` / …）。v1 key（含 03–06，也含 `decision_brief`）在 mock 模式下 `buildShapeAnchorBlock` 返回空串。十段 skeleton **只有**显式切到 skeleton 模式才会进 fill prompt。
- 03 duty 仍写「evidence 可后挂」，与 L1「挂依据页 A+B 必填」打架。03/04/05/06 的必填槽列表没有 `metaphysics_evidence` / `science_evidence`。
- 05 sanitize 不要求 `chart_anchors` 非空（过滤条件是 name/summary/upside/cost/risk/reversibility）。

形状 case 与独立 duty 已经在。默认生产 fill 还没用上那份十 key 骨架。

### Wave 2 · PARTIAL

声称：L1 双轨人设；`gateDualEvidenceParts` 扩了缺段 / 本案 / 反冒充；`RiskItemBlock` 走 `DualEvidenceBody`；fill 注入 `science_disciplines`。

**在树上的：**

- `DELIVERY_FILL_L1_IDENTITY`（`page-prompts/shared.ts`）已是「Eastern OS 现实决策咨询系统」，双底层、先现实后双框架、禁「科学验证了八字」、挂依据页先 A+B 再正文。01 明确不挂依据。
- `gateDualEvidenceParts`：缺命理（`<24`）→ `dual_missing_metaphysics`；`requireScience` 默认 true，缺科学（`<12`）→ `dual_missing_science`；无 `CASE_BIND_RE` → `dual_science_unbound`。本次新增反冒充：`dual_pseudo_fusion`、`dual_science_impersonates_meta`、`dual_meta_impersonates_science`。缺段与本案词在落地前就有；反冒充是这次加上的。
- 非 plain、`chart_anchors` 非空时，`assessDeepEvidenceUnitDepth`（`deep-evidence-quality.ts`）会调用该闸。调用点这次没改文件，扩尺会走到深度依据。
- `RiskItemBlock` 的依据折层从裸 `<p>` 改成 `<DualEvidenceBody text={ev} />`。
- `buildPageSchemaFillPrompt` 在非 plain、`hangsDualEvidenceForSegment(key)` 时写入「本页科学轨选科闭集」，学科来自 `scienceDisciplinesForSegment` → `REPORT_BLUEPRINT.science_disciplines`。

**未接通的（相对 SSOT §3.4 / 落地计划 2.1–2.3）：**

- `EvidenceSlotSchema.metaphysics_evidence` 与 `science_evidence` 仍是 `.optional()`。各页 `evidence` 数组 `.default([])`。`sanitizeEvidence` 只 `clipOpt`，缺段不 fail。页 JSON 可以零依据过 sanitize。
- `DualEvidenceBody` 增加了 `metaphysics` / `science` 形参，但 `DeliveryPageSlots.tsx` 的调用点（含 `RiskItemBlock`）只传 `text`。书架 `slotEvidence` 来自 `buildDeliveryBookModules` 的 `evidence: string`。
- `composeDualEvidence` 把两段用换行拼起来，**不写** `【命理】` / `【科学】`。`splitDualEvidence` 在没有标记时把整串当成命理、科学段为空。结构化 B 一旦被收成无标记串，UI 只显示「命理依据」。
- `segmentHangsDualEvidence` 已导出，全库无调用。fill 用的是蓝图上的 `hangsDualEvidenceForSegment`。
- 删 A「谁都适用」仍是软启发式：有 `⟦w:` 就放过。机闸不假装做完 §3.5，这一点与计划一致；但页级出站并没有「缺 A 或缺 B 即 fail」。
- 深度依据 prompt（真正写 `science_evidence` 的那一枪）不注入 `science_disciplines`。选科句只出现在之后的 fill。

### Wave 3 · PARTIAL

声称：02 事实/假设/缺口槽；06 exit 必填；07/08 分界；`PUSH_GATE=0.85` + 议程散文闸。

| 子项 | 判定 | 证据 |
|------|------|------|
| 02 三槽 | 槽在，不强制 | `P2PageSchema` 增加 `confirmed_facts` / `open_assumptions` / `info_gaps`，注释写「宽入；旧会话可空」，默认 `[]`。sanitize 只裁剪，空数组仍 `ok`。`p2-foundation.ts` 写「各≥1 为宜」。UI 在数组非空时渲染「事实 · 假设 · 缺口」（`DeliveryPageSlots.tsx`）。 |
| 06 exit | 必填成立 | `RecommendedStrategyPageSchema` primary/backup 的 `exit: NonEmpty`。sanitize 缺 exit 返回 `strategy_missing_exit`。`p-strategy.ts` 写 exit 必填。测试覆盖了失败路径。 |
| 07/08 分界 | 只有文案 | `p3-science-action.ts` 加了「07=对事；禁止气场/仪轨主体」。`p4-metaphysics-action.ts` 加了「08=对己调频；整章挪进 execution_guidance 应违和」。没有交叉复读 fail 闸。07 的 `FINALIZE_DUTY` 仍是「P3 破局策略 · 科学一套」，fill 仍要求主辅各 3 个 angle、手段回溯「P3 科学手段候选菜单」、主轨含「今晚可完成的可出示交付物」。08 的 `PAGE_LABEL` 仍是「P4 · 东方谋略」，手段尺仍是局势/意象/仪轨 + 奇门锁盘。这不是 SSOT §4.07 / §4.08 的执行原则页与自我调频页。 |
| `PUSH_GATE` | 成立 | `lib/poju/agent-state.ts`：`0.6` → `0.85`，注释写明是为了拦住低覆盖硬推。 |
| 议程散文 | 闸在，尺很松 | `coveredAgendaBindableCount`：`captured_answer` ≥ 12 字算有散文。`canTransitionToConfirmation` 要求 covered 项里至少一半（至少 1 条）达标，硬推与正常确认都走这道。6 条议程里 3 条各 12 字即可过。这不是「每条答案都留下可绑定散文」。 |

`science_disciplines` 注入 fill 写在 Wave 2 声称里，代码在 `fill-prompt.ts`，见上节。深度依据作者枪仍看不到闭集。

### Wave 4 · PARTIAL

声称：封印 `anchor_closed_hints`；决策锚五槽口径；种子不再只吃 brief。

**在树上的：**

- `CompanionJobSchema.anchor_closed_hints` 可选，三桶 `execute` / `regulate` / `validate`。
- `createCompanionJob` 调用 `buildDailyAnchorClosedHints(input.pageSchemas)` 写入 job。
- `buildDailyAnchorClosedHints` 会从 `recommended_strategy`（why/exit）、`execution_guidance` means、`self_regulation` strategy/means、`validation_risk` / `validation_close`、以及 `decision_brief` 抽短句。
- `drip-advance.ts` 与 Lab `run-step-v3.ts` 把 `job.anchor_closed_hints` 传进 `closedHints`。
- `companion-daily-prompt.ts` 把五字段改口径：`today_is`=今日主题，`suitable`=适合关注，`suggestion`=今天可以做，`unsuitable`=今天需要避免，`evidence`=今日锚点。并写「流日能量只作可选背景」「禁止写成流日能量四段主文」「不回访改旧报告」。字段名没换，是口径重映射。

**生产路径仍只吃 brief：**

- `app/api/companion/job/route.ts` 的 `createCompanionJob({...})` **不传** `pageSchemas`。
- 于是封印结果恒为 `{ execute: [], regulate: [], validate: [] }`。
- `buildDailyAnchorSeeds` 在三桶皆空时回落到 `brief.primary.claim` / `brief.backup.claim` 的前 160 字。空 hints 对象是 truthy，但长度检查失败后走的就是这条。本复核用空 hints 跑了 3 日种子，三天 hint 都是 `PRIMARY_CLAIM_ONLY`。
- `extractCompanionBrief` 能从 `fullText` 围栏解析页来做 brief；`buildDailyAnchorClosedHints` **不**读 `fullText`。有报告正文、没有 `pageSchemas` 参数时，闭集 hints 仍是空的。
- Lab companion 步只用 `direct_answer` + `science_action` 抽 brief（`run-step-v3.ts`），不把 06–09 schema 送进 `createCompanionJob`。Lab 若读 `sealed.anchor_closed_hints`，这份字段也不会在这条路径上被填满。
- `energy-digest.ts` 的日差分仍写「【今日差分·必须写入 today_is】…气候/心智侧重」。user 消息仍把能量摘要编号列出。系统提示说流日降为背景，喂料仍要求差分写入主题句。五槽口径与流日主导喂料同时存在。

「种子不再只吃 brief」在函数签名上成立，在现网 job 创建路径上不成立。

### Wave 5 · PASS（只针对 Max 点名的两件事）

声称：人审清单文件 `v1-九模块双轨-人审验收清单.md`；pipeline-v3 不是默认开。

- 文件在 `.cursor/docs/v1-九模块双轨-人审验收清单.md`。对照 SSOT §3.5 三问与 §6 的短清单，Daily Anchor 与「过关前禁止默认 v3」都写了。全部 checkbox 未勾。它是操作单，不是已完成的人审记录。
- `lib/llm/pro/delivery/pipeline-v3/flag.ts`：`DELIVERY_PIPELINE` 为空或非 `v3` / `v3_three_step` / `three_step` / `3` 时返回 `legacy`。这次 diff 没有改 flag，也没有把默认值改成 v3。

落地计划 Wave 5 本身是「跑样例 + 人审过关后再议默认 v3」。那一步没做。Max 把「文件已建、默认不开」说成 Wave 5 的交付，这两句与树一致。不要把文件存在读成 §3.5 已过。

---

## 4. 10-26 五条阻断重打分

出处：`cursor/v1-nine-module-readiness-audit-0b0b` 上的 `docs/eastern-os/audits/2026-10-26-v1-nine-module-dual-track-readiness.md`（该文不在 `main`；阻断列表以本次任务复述为准）。当时总判 Partial。

| # | 当时 | 现在 | 说明 |
|---|------|------|------|
| 1 | sanitize 缺 03–06 | **Closed** | 四 case 在 `sanitize.ts`，自测 happy path 与 06 缺 exit 都过。 |
| 2 | fill duty 仍别名旧 P1–P6 | **Partial** | 03–06 已拆开。01/02/07/08/09 仍绑 `p1`–`p6`。07/08 的产品身份仍是 P3 科学套件与 P4 东方谋略，分界只是加句。默认 mock 形状锚还不喂 v1 skeleton。 |
| 3 | 双轨字段可选，02–09 不要求 | **Partial** | 深度依据在有锚时会 `gateDualEvidenceParts(..., { requireScience: true })`，并新增反冒充。页槽 Zod、sanitize 出站、书架字符串路径仍允许缺 B，UI 无标记时把整段显示成命理。 |
| 4 | `science_disciplines` 未注入 fill | **Partial** | fill system 在挂依据页注入蓝图 1–3 科。深度依据作者枪、页级闸、`ScienceEvidenceUnit.mechanisms[]` 都还没吃这列。注入了，承重写作点没用上。 |
| 5 | prompts 对双轨 Not ready | **Partial** | L1 与 03–06 duty 已改成双轨口吻。03 仍「evidence 可后挂」。07/08/finalize 共用层仍大量旧 P3/P4/`bazi_basis` 口径。不能称为双轨提示词已就绪。 |

---

## 5. 默认 v3 之前还缺什么

人审清单 §0–§4 的 checkbox 全空。这是对的：现在没有一份离职创业样例可勾。

单人链路里，fill + prompts + gates **还不是**一套完整双轨栈：

1. **形状：** duty 指向 v1 槽，默认 fill 形状锚是空的（mock few-shot 没有 v1 key）。
2. **依据作者：** 深度依据要求 A+B 字符串，但不吃本页学科闭集。
3. **依据出站：** sanitize / Zod 不拒绝缺 A 或缺 B。
4. **依据展示：** 结构化形参没人传；无标记合成串在 UI 上丢掉科学段。
5. **07/08：** 分界句盖在旧页产品上。样例若「像 P3 工具页 + P4 暗锦囊」，机闸不会因此失败。
6. **现实门：** 硬推门槛到了 0.85，散文闸是「一半 covered 且 ≥12 字」。
7. **Daily Anchor：** 五槽口径在系统提示里；现网 job 不封印 06–09 闭集；日差分仍要求写入 `today_is`。

共同决策的双 FactPack **正确地仍在范围外**。落地计划写明：dyad 走同一 delivery DAG，不单开第九模块；本轮不做第二套依据字段名。`a0a8e009..65fb9ae1` 没有改 `buildChartFactPack` / 预分配去读 `partner_profile_id`。`joint-decision.ts` 与 `JointSessionOpenHost.tsx` 的 diff 只说明「对方同意并提交出生后，任一侧可独立扣 PASS 开聊」，不是把对方盘送进 FactPack。10-27 joint 审计里的「对方盘不是第二份 ChartFactPack」仍然成立，不应在这轮 solo 落地里被当成漏项补上。

`pipeline-v3` 保持默认关，符合计划「人审删段三问过关前不默认开」。现在开 v3 不会补上页级必填、UI 丢 B、Companion 空封印、07/08 旧产品形状。

---

## 6. 给 Max 的下一闸（修订他的 §3.5 → 再议 v3）

他的顺序（跑离职创业 → 清单 §3.5 删段三问 → 再决定是否默认 v3）方向对，**不能**按「样例三问过了就开 v3」执行。

建议改成：

1. **样例前先固定喂料条件，否则人审失真。** Lab/手工跑 fill 时设 `DELIVERY_FILL_SHAPE_MODE=skeleton`，让十段空骨架真的进 prompt。Companion 样例必须把 06/07/08/09 的 page schema 传进 `createCompanionJob`（或等价地在封印前解析 `fullText`）。现网 `POST /api/companion/job` 不传 `pageSchemas`，按它跑出来的 3–5 条锚测不到闭集，只会再测一遍 brief 切片。
2. **§3.5 三问仍是人审主尺，机闸不算过。** 对 02–09 每条关键主张做删 A / 删 B / 删现实事实。07 整章若仍是科学手段套件、08 整章若仍是奇门暗锦囊，直接记不合格，不要等 v3。
3. **三问过了，默认 v3 仍不打开。** 清单自己写了「全部勾选前禁止默认 v3」，而勾选不止三问，还包括 02 分层、06 exit 在样例里真出现、09 risk 双轨折层、Anchor 五槽来自闭集。另外页级 schema 仍允许无 B 出站，UI 仍可能把无标记串画成单段命理——这些不改，开 v3 只是换一条同样不强制出站的管道。
4. **共同决策双 FactPack 继续单列，不塞进这次「是否默认 v3」。** solo 样例过了也不代表对方盘已进依据。

在上述 1–3 做完之前，总判维持 **Partial**：Wave 0 与 Wave 5 的「文件 + flag」可以记完成；Wave 1–4 是进了树的半套，不是可生产承重。
