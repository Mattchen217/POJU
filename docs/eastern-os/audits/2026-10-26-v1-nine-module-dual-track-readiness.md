# Eastern OS v1 · 九模块双轨决策报告 · 就绪审计

**Audit date:** 2026-10-26（workspace clock 2026-10-27）  
**Branch audited:** `main` @ `b3d7c4da`（`一次对齐`），与 `origin/main` 一致  
**Mode:** read-only product readiness。本文不改运行时、feature flag、闸门或导出代码。  
**SSOT:** `.cursor/docs/v1-决策交付-产品边界.md`（与本次附件 Eastern OS v1 decision-delivery SSOT 同文）  
**工程桥:** `.cursor/docs/v1-九模块与现网六页-迁移映射.md` · `lib/poju/report-blueprint.ts`

中英对照用语：模块 = content module；出稿 key = delivery segment key；双轨依据 = dual-track evidence（`metaphysics_evidence` + `science_evidence`）；现实对齐门 = reality-alignment gate；真算 = local metaphysics true-calc；Daily Anchor = 预生成 30 日决策锚定。

---

## 1. Executive verdict / 总判

**Overall: Partial（不能按新定位直接出合格九模块双轨报告）。**

钥匙、目录标签、蓝图、DAG 已经按 9 内容模块 + 附录切到 **10 个 prose key**（module 09 = `validation_risk` + `validation_close`）。本地八字真算、奇门锁盘、议程 5–6 问、交付前确认、以及「整窗预生成再按日滴灌」的 Companion 骨架都在。  
缺的是能让 **02–09 各自长成 SSOT 规定形状、并且每条挂依据主张同时交出命理段 A 与科学段 B** 的生产链路。四张新页在生产 `sanitizePageJson` 里会直接 `unknown_key_*` 失败。正文提示词仍把多模块别名到旧 P1–P6 duty。双轨字段是可选字符串，折叠 UI 只认文内 `【命理】/【科学】` 标记，删段自检没有按 §3.5 落地。

| Layer | Verdict | 一句话 |
|-------|---------|--------|
| Schema | **Partial** | 10 key + 部分页形状已有；`science_evidence` 可选、无 `mechanisms[]`；四页 sanitize 未接 |
| Prompts | **Not ready** | 生产 fill 复用旧六页 duty；v3 正文有分模块草稿但默认关闭，且批断把 02/03/04 合成同一份 P2 |
| UI | **Partial** | 书架/槽位能画 10 页；双小节标题存在，但不读结构化双字段 |
| Gates | **Partial** | 深度依据有长度+本案词闸；删 A「谁都适用」、删 B 注水、反冒充、删现实事实均未成尺 |
| Dialogue | **Partial** | 5–6 问与确认门在；真算在议程覆盖前就启动；硬推可在 60% 覆盖时进入汇总 |
| Bazi feed | **OK**（科学选科 **Partial**） | `buildChartFactPack` + 奇门锁盘真实喂料；蓝图 `science_disciplines` 未注入提示词 |
| 30-day Daily Anchor | **Partial** | 同一次 PASS 预生成整窗再滴灌，不是回访教练；卡片仍是流日能量四段，不是决策锚五槽 |

**给 Max 的直接回答：** 现网代码 **撑得起「九个模块 id + 本地真算 + 一次购买」的架子**，**撑不起**「现实先行、命理与现代多科学同时承重、02–09 每模块折叠双轨依据」的新产品。第一刀应打在 **生产 fill/sanitize 与四张新页形状对齐**，第二刀打在 **把双轨从可选注脚变成必填依据层**。不要再加禁词表。

---

## 2. 文档与代码互相打架（先读，避免把清单当完成）

| 文件 | 它怎么说 | 代码事实 |
|------|----------|----------|
| `v1-决策交付-产品边界.md` 文首 | 「出稿过渡期仍为六页 key」 | `V1_DELIVERY_SEGMENT_KEYS` 已是 10 个 v1 key |
| `v1-九模块与现网六页-迁移映射.md` §5 | PR1–PR6 全勾（schema/duty/双轨/喂料/TOC/Daily Anchor） | 钥匙和 DAG 切了；duty、sanitize、双轨闸、锚点卡片未完成 |
| `v1-Phase2-交付内容对齐.md` | 「出稿仍六 key」；「不做九 key 书架」；科学段先嵌进 evidence 字符串 | 与迁移映射、与 `delivery-schema.ts` 头注释冲突 |
| `.cursor/docs/README.md` | 「现网交付运维（出稿仍六 key）」 | 过期。本审计在 `docs/eastern-os/audits/` |

近期 `main` 提交（与本次问题直接相关）：

- `a678bf80` / `df433ffc` / `c00334db` — `P1-P9全新决策报告+共同决策落地关联订阅`
- `e5403fa0` 及同题多笔 — `共同决策从订阅到全部用户`
- `b3d7c4da` / `88a3d836` — `一次对齐`

共同决策是 **另一条产品线**（见 §8），不是九模块报告本身。

---

## 3. Module-by-module matrix / 01–09

图例：**OK** = 字段与职责大体能对上 SSOT；**PARTIAL** = 有钥匙或近似槽，缺必写项或仍是旧页换皮；**GAP** = 生产路径写不出或校验会拒。

SSOT 依据规则：01 不挂折叠依据；02–09 必须 A+B。下表「依据」列单说这一条。

| # | Module id | 出稿 key | Schema vs SSOT 必写 | 生产提示词 | 依据 | 总评 |
|---|-----------|----------|---------------------|------------|------|------|
| 01 | `decision_brief` | `decision_brief` | `P1PageSchema`：`core_judgment` + primary/backup（`core_logic`/`why`/`when`）。能覆盖「一句问题、方向、成立条件、切辅」。比简报厚（每轨 core_logic 约 380–560 字），不是「替代后文」的短简报 | `page-prompts/p1-direct-answer.ts` · `FINALIZE_DUTY` 仍写 `bazi_basis≥1`、论证归 foundation | DAG 跳过 deep/mark（`DELIVERY_TRANSITION_KEYS`）。UI 不挂折层 | **PARTIAL** |
| 02 | `situation_analysis` | `situation_analysis` | `P2PageSchema`：dashboard 分数 + `why_cards`（surface/essence）。**没有**事实 / 假设 / 信息缺口 / 资源时间资金槽 | 生产 fill = P2「只译批断」。v3 批断与 03/04 **共用**「恰好 4 条八字轴」 | 深度依据提示词要求双字段；正文不产双轨；sanitize 有 case | **PARTIAL** |
| 03 | `personal_decision_patterns` | 同 id | `PatternsPageSchema`：1–3 `why_cards`。无「事实 / 行为证据 / 假设 / 命理解释」分标 | 生产 fill **别名到 p2**（4–5 卡、`page="foundation"`）。v3 批断与 02 同一段 | 同上，且 **sanitize 无 case** | **GAP** |
| 04 | `bottleneck_analysis` | 同 id | `BottleneckPageSchema`：1–3 卡。无「可控 / 可影响 / 暂不可控」、无「解除哪一个」槽 | 同 03，别名 p2。v3 批断仍是四轴归因，不是 1–3 障碍 | 同上 | **GAP** |
| 05 | `strategic_options` | 同 id | `StrategicOptionSchema`：2–4 项 `summary/upside/cost/risk/reversibility`。缺时间、成立前提、失效条件、验证缺口字段 | 生产 fill **别名到 p3**（`primary_toolkit` 各 3 angle，`page="execution_guidance"`）。v3 批断落到 `default` 一句「纯机制批断」 | sanitize **无 case** → `unknown_key_strategic_options` | **GAP** |
| 06 | `recommended_strategy` | 同 id | `RecommendedStrategyPageSchema`：`core_judgment` + primary/backup `why`，`when`/`exit` **可选**。护城河页应写厚的前提、放弃项、停止触发没有必填槽 | 生产 fill **别名到 p1**（厚 `core_logic`，`page="decision_brief"`）。v3 批断同样走 default | sanitize **无 case** | **GAP** |
| 07 | `execution_guidance` | 同 id | `P3PageSchema`：主辅 toolkit，各 ≥3 angles（strategy+means）。可执行，但是「科学杠杆套件」，不是 SSOT 的阶段原则 + 示例动作 + 推进/调整/停止。v3 正文 duty 已写「禁 30 天表」 | 生产 = `p3-science-action.ts`（职场科学手段菜单）。v3 批断钉 6 条 angle | 科学轨应最重；现网依据仍以命理 `⟦w:⟧` 承重，科学是附加句 | **PARTIAL** |
| 08 | `self_regulation` | 同 id | `P4PageSchema`：`dimensions[]` 策略+手段（奇门/调候）。不是「压力反应 / 暂停机制 / 继续 vs 先停」字段。与 07 的差别靠提示词，不靠槽 | 生产 = `p4-metaphysics-action.ts`（东方谋略护城河）。v3 正文开始写对己调频，形状仍是 dimensions | 命理轨强；科学轨（情绪/习惯）未成独立依据段 | **PARTIAL** |
| 09 | `validation_review` | `validation_risk` + `validation_close` | 风险页：红灯×2、坑×1、切辅×1、防护×2（`RiskItem`）。收束页：身份对照、金句、今晚、**恰好 4** 条 day7、watch_signals、takeaways。信号/退出有；「哪些模块需重评」没有槽。day7 固定清单靠近 SSOT 禁止的任务表边缘（不是四周甘特，但是出门勾选） | 生产 = p5 + p6。v3 批断分开，仍是旧 P5/P6 口气 | 两页都走深度依据双字段提示；无模块级 A/B | **PARTIAL** |
| — | `appendix` | merge-time | 蓝图 `hangs_dual_evidence: false`。SSOT 附录不要求科学依据 | 不单独 LLM 页 | **OK**（相对 SSOT） |

生产 DAG 调度（`buildInitialDeliveryDispatchDag`）：

- Bootstrap：`decision_brief` fill→ready，无 evidence。
- Wave A deep：02–08 七个 key（含 03/04/05/06）。
- Wave B gate：等 `decision_brief` + `execution_guidance` + `self_regulation` ready，**不等** 03/04/05/06。
- Wave B：`validation_risk` + `validation_close`。

所以即使 03–06 在 DAG 里被排上，fill 之后 `sanitizePageJson` 的 `default` 返回 `unknown_key_${key}`（`lib/llm/pro/delivery/page-schema/sanitize.ts` 约 1733 行）。Zod 形状在 `page-schema/types.ts` 的 `DeliveryPageSchemaByKey` 里是有的，生产宽入严出没接上。

形状锚同样断档：`DELIVERY_FILL_SHAPE_SKELETON` 的键仍是 `direct_answer` / `foundation` / `science_action` / `metaphysics_action` / `risk_guard` / `signals_close`。`fillShapeSkeletonForKey("decision_brief")` 等 v1 key 得到 `null`，骨架模式不注入 JSON 形状。

---

## 4. Dual-track evidence / 双轨依据

SSOT §3 要求：挂依据模块打开折叠层时看到两段独立内容；schema 建议 `metaphysics_evidence` + `science_evidence`（B 含 `mechanisms[]` + `tied_to_case`）；缺 A 或缺 B 失败；删 A 后谁都适用失败；B 无本案绑定失败；A/B 互相冒充失败。

### 4.1 现在有哪些字段

| 位置 | 符号 | 实际 |
|------|------|------|
| 段级双钥匙 | `DeliverySegmentComputed` in `delivery-schema.ts` | 仍必填 `bazi_basis` + `chart_anchors` + `core_conclusion`。`metaphysics_evidence?` 与 `science_evidence?`（`string` 或 `ScienceEvidenceUnit[]`）**可选** |
| `ScienceEvidenceUnit` | 同文件 | `mechanism?` / `tied_to_case?` / `prose?` 全可选。**没有任何调用方按这个结构写入**（全库只出现在类型定义） |
| 页槽 | `EvidenceSlotSchema` | 两个字符串 **optional**，max 1200 |
| 深度依据 unit | `deep-evidence-call.ts` 解析 | 读字符串字段；无 `⟦w:⟧` 则整条 unit 丢弃 |
| 正文页 JSON | P1–P7 schemas | `evidence: EvidenceSlot[]` 默认 `[]`。可见正文槽没有 A/B |

### 4.2 提示词要不要双轨

- **生产深度依据** `buildDeepEvidencePrompt`（`deep-evidence-prompt.ts`）：除 `decision_brief` 外，要求每 unit 写 `metaphysics_evidence`（≥两句 + `⟦w:⟧`）和 `science_evidence`（≥一句、落到用户事实或本 unit 行动），并另写合并字段 `evidence`。禁止「科学验证了八字」。这是现网最接近 §3 的一段。
- **生产正文 fill** `fill-prompt.ts` + `page-prompts/*`：**不出现** `science_evidence` / `metaphysics_evidence`。身份仍是「东方破局顾问」；先锁 `chart_anchors`，删锚后谁都适用则废稿。科学是 P3 手段菜单，不是每模块依据段。
- **Pipeline v3**（`DELIVERY_PIPELINE` 默认 `legacy`，只在 `lab/store.ts` 读 flag；**dispatch 不调用 v3**）：`pipeline-v3/` 内 **零次** 出现 `science_evidence`。`evidence-soft.ts` 只把传统批断包成 `⟦w:⟧` / `⟦t:⟧`。
- 蓝图 `science_disciplines`（每模块 1–3 科）**只定义在** `report-blueprint.ts`。全库没有第二处读取。选科闭集没有进提示词。

### 4.3 UI 折叠面板

`components/poju/delivery-pages/DeliveryPageSlots.tsx` · `DualEvidenceBody`：

- 标题：中文「命理依据 / 科学依据」（`dualEvidenceSectionTitles`）。
- 输入是 **一条字符串** `slotEvidence[i]`，再 `splitDualEvidence`。
- `splitDualEvidence`：有 `【命理】` / `【科学】` 才拆开；**没有标记时整段算命理，科学为空**（`dual-evidence.ts`）。
- 科学小节仅在拆出非空时渲染。缺 B 时用户只看到命理一段，UI 不报错。
- 组件 **不读** slot 上的 `metaphysics_evidence` / `science_evidence` 字段。

深度依据提示词要求新稿用双字段、合并 `evidence` 时用换行而不是标记。按这个契约写出的稿，折叠层会把 A+B **整段显示成命理依据**。

各页正文渲染（同文件 `PageSlotsInner`）：01 无依据；02/03/04 共用 why_cards；05 options 四列；06 primary/backup；07 toolkit；08 dimensions；09 风险四桶 + 收束仪式。正文不是双栏，这一点符合 SSOT。依据挂在 `SlotCard` 的字符串上。

### 4.4 闸门 vs §3.5 删段自检

`gateDualEvidenceParts`（`dual-evidence.ts`）在 `assessDeepEvidenceUnitDepth` 里、且 **`chart_anchors` 非空** 时调用（`requireScience: true`）：

| SSOT 尺 | 代码 | 覆盖 |
|---------|------|------|
| 缺 A | `metaphysics_evidence.length < 24` → `dual_missing_metaphysics` | 仅深度依据、且非 plain judgment |
| 缺 B | length < 12 → `dual_missing_science` | 同上 |
| B 无本案绑定 | `CASE_BIND_RE`（你/本案/工作/决策/风险…）→ `dual_science_unbound` | 命中「你」或「决策」即可过，不要求 `mechanisms[]` |
| 删 A 后谁都适用 | `dual_metaphysics_generic` | 条件几乎不可达：要先没有用神/十神字，再要求剥槽后的字符串与去空白原文全等。有 `⟦w:⟧` 就直接放过 |
| 删 B 后主张不变 = 注水 | 无 | **GAP** |
| 删用户现实事实后执行建议仍通用 | 无 | **GAP** |
| A↔B 冒充 / 「科学验证了八字」 | 只写在深度依据提示词 | **GAP**（无闸） |
| 01 不要求 B | `decision_brief` 不跑 deep；plain judgment（空锚）跳过双轨闸 | 01 OK；空锚页会放行单轨 |

v3 `gate-phase-a.ts` 不查双轨。生产质量哲学仍是「删 chart_anchors / 批断后谁都适用 = 废稿」，那是 **单轨命理承重**，不是双底层。

---

## 5. Dialogue / 现实对齐门

SSOT：先聊透主问题、处境、期望、资源约束；用户确认理解之前，不进入双框架深交付。议程 **5–6 项，上限 6**，禁止一模块一问。

| 机制 | 符号 | 与 SSOT |
|------|------|---------|
| 条数 | `parseInvestigationAgenda`：&lt;3 拒，&gt;6 `slice(0,6)`。Call B 文案默认 5、上限 6（`AGENDA_BRIDGE_TASK`） | **OK** |
| serves_page 闭集 | `V1_AGENDA_SERVES_PAGE_IDS` 八个模块（不含 brief/appendix）。`normalizeServesPage` 把旧六页映射过去 | **OK** |
| 覆盖才进确认 | `AGENDA_COVERED_GATE = 1`；`isAgendaFullyCovered` 后 `state-machine` → `awaiting_confirmation` | **OK**（全覆盖，比「聊透」更机械） |
| 理解确认 | `awaiting_understanding_confirm`：按钮确认后才 `collecting_context`，并 `triggerCore = true` | 确认的是开场理解，**不是**交付前的现实对齐 |
| 交付前确认 | `awaiting_confirmation`：`confirmation_signal === "confirmed"` 或 `user_confirms_delivery` 才 `triggerSynthesis`；汇总成功后才开交付 | **PARTIAL**：有门，但是第二道确认，且可被硬推绕过 |
| 硬推 | `PUSH_MIN_TURNS = 2`，`PUSH_GATE = 0.6`，`userHardPushed` → `canTransitionToConfirmation` 放行 | **GAP vs「无聊透不深交付」**：两轮 + 60% 覆盖 + 催结果即可进汇总 |
| 最少轮次 | `MIN_COLLECTING_USER_TURNS = 3`（硬推路径用 2） | 偏松 |
| 真算时机 | 理解确认进入 collecting 时 `triggerCore`。多维真算与调查 **并行**，不是「对齐完成后再双框架推理」 | **GAP**（顺序） |
| 脊柱补丁 | `validateAgendaSpineCoverage` 仍报 `missing_serves_page_science_action` 等旧名；补丁 `serves_page` 多用 `validation_risk` / `execution_guidance`，且可能把条数往 6 以上推（随后解析器再裁） | **PARTIAL** |

现实料进报告：`page-feed-policy.ts` 按页开关 `reality`。P1/P3 批断阶段 **关掉** collecting 原文（防处境词回写）。这和「现实事实优先级最高、方案必须被对话约束」是张力：正文步可以灌 reality，批断步故意不灌。对护城河「删掉现实对话后执行建议仍可套任何人」没有机闸。

---

## 6. Local true-calc feed / 本地真算喂料

**命理轨：OK，这是现成杠杆。**

- `buildChartFactPack`（`page-schema/chart-fact-pack.ts`）：从 `ProfileStructured` 写日主、格局、用喜忌、四柱、岁运、合冲、神煞。只列算出来的实例。
- 深度依据 opts.`chart_fact_pack`：有真算包时 assign 不锁死 slug 菜单。
- 奇门：`qimen-fact-pack.ts` 首次成功起局写入 `qimen_cast_at`，之后只读；失败不降级半套。喂料白名单里 **只有 `self_regulation` 开 `qimen`**（`pageFeedFlags`）。符合旧 P4 护城河，不等于 02–09 都要奇门——SSOT 也只要求命理结构承重，奇门不是每模块必喂。
- `SEGMENT_COMPUTED_INPUTS` 与蓝图 `chart_inputs` 按页列了 energy / 十神 / 主辅 / modern_action_frames 等切片名。

**科学轨：Partial。**

- 没有假测评引擎（符合 §3.4「科学侧不需假测评引擎」）。
- 科学输入是 P3 `science-means-feed` 候选菜单 + 现代行动帧，主要服务 `execution_guidance`（以及 v3 里 options/strategy 的 body feed 旗标）。
- 学科闭集（心理、行为、决策、认知、经济、概率、社会、系统）写在蓝图，**未作为选科输入进入 duty**。
- 因此科学容易变成「P3 工具词」或深度依据里一句带「你/决策」的附注，而不是每模块 1–3 个本案机制。

---

## 7. 30-day Daily Anchor

SSOT：同一次分析预生成最多约 30 条；之后冻结；按日解锁；策略一致、视角轮换；不是当日重算，不是回访，不是催办任务。单条宜有：主题句、适合关注、今天可以做、今天需要避免、今日锚点。

| SSOT | 代码 | 判 |
|------|------|----|
| 与报告同批预生成 | `lib/inngest/functions/companion-batch-fill.ts`：`poju/companion.fill` 最多 15 步 × 每步 1–2 天，凑满窗再 `gateCompanionBatch({ require_full_window: true })`。注释写明 Never 30 days in one shot = **不要一次 invoke 写 30 天**，不是「等到当天再写」 | **OK**（预生成，分枪） |
| 写完冻结 | `batch_status === "ready"` 后 `fillCompanionJobPair` 直接 return。滴灌 `deliverDueCompanionDay` 只发送已生成日，然后 purge 当日正文（Never Stored），不按回访改写 | **OK** |
| 无回访 / 无完成率 | 提示词禁「布置作业、验收作业」；无案情更新入口 | **OK** |
| 可关推送 | `mail_opt_in` | **OK** |
| 五槽决策锚 | `CompanionDayCardsSchema`：`today_is` / `suitable` / `unsuitable` / `suggestion` / `evidence`。evidence 是流日批断，不是科学+命理决策依据 | **PARTIAL** |
| 视角轮换（验证/风险/行动/节奏/边界） | `buildDailyAnchorSeeds` 镜头只有 `execute \| regulate \| validate`。`companion-daily-prompt.ts` 调用时 **不传 `pageSchemas`**，hints 退回 brief 主辅 claim 一句 | **PARTIAL** |
| 流日在预生成时算进第 n 日 | `liuri_pack` 按 `day_index` 快照喂 `buildCompanionEnergyDigest`。传统时间框架在用，且驱动 `today_is` 差分 | **OK**（但产品读感仍是能量日签，不是决策锚定） |
| 闭集来自 07/08/09 | `DAILY_ANCHOR_SOURCE_PAGES` 列了这些 key；生产 prompt 路径没用 pageSchemas，闭集大多空转 | **GAP**（接线） |
| 禁止否定主策略 | 种子 `track_role` 每 5 日切一次 backup；无「仅边界镜头且有依据才可偏离」的闸 | **PARTIAL** |

`page-prompts/thirty-day-legacy.ts` 与 `P5PageSchema`（`page: "thirty_day"` 四周表）仍留在类型里，DAG 不调度。报告内 30 天甘特已退役，这点对齐 SSOT。Companion 是另一条预生成管道，还没改成决策锚文案结构。

---

## 8. Joint decision / 共同决策（main 上有，但不是本报告）

规格文档 `.cursor/docs/v1-共同决策-产品规格.md`（2026-10-25）仍写 Flex $19.99、Duo $59.99/月、共同决策扣 2 PASS。  
代码已改口径：`lib/passes/joint-decision.ts` 头注释 — *Open to all users; charge 1 PASS per side via consumePassSmart*。

落地面（规格表仍大致对得上路径）：

- SQL：`supabase/migrations/20261025_duo_household_joint.sql`（`consume_household_pass`）
- API：`/api/household/*`、`/api/joint/*`
- UI：`components/poju/JointDecisionPanel.tsx`、`JointSessionOpenHost.tsx`、账户 `DuoHouseholdCard`
- 会话：`hydrateJointSessionFromSeed`，`joint_decision=true`，跳过对方盘芯片
- 测试：`scripts/test-joint-decision-unit.ts`、`scripts/test-joint-decision-acceptance.ts`

它复用现网 **dyad 单人决策 × 2**（共同问题 + 对方授权出生信息，聊天/报告互不可见）。**不产生第九模块，也不产生 `science_evidence`。** 共同决策报告若走同一 delivery DAG，会继承本文所有缺口。

---

## 9. What already supports the new positioning / 已经能用的杠杆

这些不要推倒重做：

1. **模块身份 SSOT** — `REPORT_BLUEPRINT` 九模块 + 附录：`hangs_dual_evidence`、`science_disciplines`、`reality_needs`、`delivery_segments`。`getBlueprintPage` / `toDeliverySegmentKey` / `LEGACY_SIX_TO_V1`。
2. **出稿钥匙已切换** — `V1_DELIVERY_SEGMENT_KEYS` 十段；`DELIVERY_PAGE_TAGS` 中英标签（决策简报…行动收束 9a/9b）；UI `PageSlotsInner` 已为 options / strategy / patterns 写了分支。
3. **01 不挂依据** — `DELIVERY_TRANSITION_KEYS` + DAG 只 fill→ready。和 SSOT「Decision Brief = transition」一致。
4. **深度依据双字段契约（半成品）** — prompt + `normalizeUnitDualEvidence` + `gateDualEvidenceParts` 的缺段/短科学句。改闸时扩尺，不要另起第三套字段名。
5. **折叠标题组件** — `DualEvidenceBody` 已有两小节 DOM。接上结构化字段即可，不必新做书架。
6. **本地真算** — `buildChartFactPack`、岁运关系、奇门锁盘幂等。命理不是营销标签，喂料是算出来的。
7. **议程 5–6** — 解析器硬顶、Call B 明示「九模块 ≠ 九问」、`BLUEPRINT_AGENDA_FORBIDDEN_PAGES` 禁 brief。
8. **交付前有确认态** — 汇总（主辅收敛）在交付 job 之前。一次 PASS 的商业顺序还在。
9. **30 日是预生成分发** — Inngest 填满窗 → 日滴灌 → 发送后擦当日。不是「今天过得怎么样再改策略」。
10. **v3 正文 duty 草稿** — `pipeline-v3/body-prompt.ts` 已为 03/04/05/06 写了独立目标与 JSON 形状（1–3 模式卡、1–3 障碍、2–4 选项、主辅+exit）。生产没走这条，但不必从零写产品句子。批断枪（`content-judgment.ts`）还没跟上：02/03/04 仍是同一段四轴 P2。
11. **旧六页读路径** — `canonicalizeDeliverySegmentKey`、`LEGACY_SEGMENT_TO_CURRENT`。换钥匙不必丢历史 session。

---

## 10. Prioritized gaps / 优先缺口（只建议工作流，不在本 PR 实现）

### P0 · 不补则新定位不能出货

1. **生产四页不可 sanitize**  
   工作流：给 `personal_decision_patterns`、`bottleneck_analysis`、`strategic_options`、`recommended_strategy` 补 `sanitizePageJson` case，并与 Zod 必填槽对齐。同步 `DELIVERY_FILL_SHAPE_SKELETON` 的 **v1 key**（现在只登记旧六页 key）。  
   文件：`page-schema/sanitize.ts`、`fill-shape-skeleton.ts`、`fill-call.ts`。

2. **生产 fill duty 与页形状拧着**  
   `page-prompts/index.ts` 把 03/04 → p2、05 → p3、06 → p1。模型被要求输出 foundation / toolkit / decision_brief，sanitize 却要另一套槽。  
   工作流：每模块一份 duty（角色、本页目标、禁忌类别、数据来源、先依据后正文）。可从 `pipeline-v3/body-prompt.ts` 的 03–06 段起步，**不要**把 v3 里 02/03/04 批断的四轴合并原样搬进生产。生产 dispatch 今天不读 `DELIVERY_PIPELINE`。

3. **双轨依据未成为 02–09 的验收尺**  
   工作流：依据层必填 A+B（01 除外）；UI 读结构化字段，无标记也要两小节；闸门至少：缺段 fail、B 须点到本案事实或本 unit 行动、A 与 B 禁止「科学验证了命理 / 命理口吻写科学定论」。删 A「谁都适用」保持类别尺（现有 `dual_metaphysics_generic` 不够）。不要用 Lab 原句当正则。

### P1 · 定位会滑回单轨命理或通用咨询

4. **科学选科未接线** — 把 `REPORT_BLUEPRINT.science_disciplines` 注入该模块 duty（每页 1–3 科，禁止八科全开）。`ScienceEvidenceUnit.mechanism` + `tied_to_case` 从可选类型变成依据 B 的实际 JSON。  
5. **02 的现实地图没有槽** — 事实 / 待验证假设 / 信息缺口 / 硬约束。现在是归因 why_card。  
6. **06 护城河页过薄且生产写不出** — `exit` 改为必填；前提、放弃项、停止条件进形状；删 A 必须打在主路径理由上。  
7. **08 仍是 P4 仪轨页** — 与 07 的分界要在槽上可见（对己状态 vs 对事动作），科学段写调节机制，命理段标明传统属性。  
8. **现实门顺序** — 真算可以先算（本地引擎不依赖聊透），但 **双框架成文交付** 应等议程覆盖 + 明确确认。收紧或去掉 `PUSH_GATE = 0.6` 绕过，避免「催一下就深交付」。  
9. **Daily Anchor 闭集** — `buildDailyAnchorSeeds` 传入已封印的 06/07/08/09 页摘录；卡片改成决策锚五槽（或明确映射到现有四段 + 锚点），镜头对齐 SSOT 视角而不是只吃流日气候。保持预生成，不要改成当日回访。  
10. **文档三处互相否定** — 更新迁移映射 §5、Phase2、`.cursor/docs/README.md` 的「仍为六 key」表述，避免下一位实现者按过期清单打补丁。

### P2 · 稍后

11. 09 是否继续拆成两屏（风险 / 收束）——SSOT 不锁页数，可以留，但收束页的身份金句/恰好 4 条 day7 要对照「验证仪表盘」决定去留。  
12. Wave B 解锁是否应等 05/06 ready（现在只等 brief + 07 + 08）。  
13. `thirty_day` 遗留 schema 与叙事甘特提示词（`narrative-prompt.ts`）确认生产不可达即可，不必急删。  
14. 共同决策规格文档与 `joint-decision.ts`「全用户、每边 1 PASS」对齐；报告内容仍走同一缺口，不要单独做第二套九模块。  
15. v3 批断 `content-judgment.ts` 为 03/04/05/06 写独立 duty 后，再考虑是否把生产切到 `v3_three_step`。在 fill/sanitize 修完之前切 flag 不会自动变合格。

---

## 11. 建议工作流顺序（仍不实现）

1. **形状接通（P0.1–P0.2）** — sanitize + skeleton + 分模块 fill duty，使 03–06 能落库。用一张代表性困境（离职创业类）看 JSON，不看页数。  
2. **依据层接通（P0.3 + P1.4）** — 深度依据已有双字段；补 UI 与缺段闸；正文仍单叙事。  
3. **选科与 02/06/08 槽（P1.5–P1.7）** — 让双底层在模块职责上分开，而不是全报告复读一份八字归因。  
4. **门与 30 日（P1.8–P1.9）** — 确认门收紧；Companion 改锚点文案与闭集，生成时机保持「填满窗再滴灌」。  
5. **人审删段三问（§3.5）** 过了再谈把 v3 设为默认。Lab 质量失败继续硬停，不要自动重试凑绿。

---

## 12. 关键符号索引

| 主题 | 路径 · 符号 |
|------|-------------|
| 蓝图 | `lib/poju/report-blueprint.ts` · `REPORT_BLUEPRINT` · `hangs_dual_evidence` · `science_disciplines` |
| 出稿 key | `lib/llm/pro/delivery/segment-key-alias.ts` · `V1_DELIVERY_SEGMENT_KEYS` · `LEGACY_SIX_TO_V1` |
| 段 schema | `lib/llm/pro/delivery/delivery-schema.ts` · `DeliverySegmentComputed` · `ScienceEvidenceUnit` · `DELIVERY_TRANSITION_KEYS` |
| 页 schema | `lib/llm/pro/delivery/page-schema/types.ts` · `DeliveryPageSchemaByKey` |
| 生产 sanitize 缺口 | `page-schema/sanitize.ts` · `sanitizePageJson` default `unknown_key_` |
| 形状锚缺口 | `page-schema/fill-shape-skeleton.ts` · `DELIVERY_FILL_SHAPE_SKELETON` |
| 生产 duty 别名 | `page-prompts/index.ts` · `BY_KEY` |
| 旧单轨 duty | `page-prompts/p1-direct-answer.ts` … `p6-signals-close.ts` · `shared.ts` `DELIVERY_FINALIZE_SHARED` |
| v3 正文（默认关） | `pipeline-v3/body-prompt.ts` · `buildV3BodyPrompt` · `pipeline-v3/flag.ts` `resolveDeliveryPipeline` |
| v3 批断合并 | `pipeline-v3/content-judgment.ts` · `pageDutyBlock`（02/03/04 同一 return） |
| 双轨拆分/闸 | `page-schema/dual-evidence.ts` · `splitDualEvidence` · `gateDualEvidenceParts` |
| 双轨调用点 | `page-schema/deep-evidence-quality.ts` · `assessDeepEvidenceUnitDepth` |
| 双轨提示 | `page-schema/deep-evidence-prompt.ts` · `dualEvidenceDuty` |
| 喂料白名单 | `pipeline-v3/page-feed-policy.ts` · `pageFeedFlags` |
| DAG | `dispatch/task-dag.ts` · `buildInitialDeliveryDispatchDag` · `WAVE_A_DEEP` |
| UI | `components/poju/delivery-pages/DeliveryPageSlots.tsx` · `DualEvidenceBody` · `PageSlotsInner` |
| 真算 | `page-schema/chart-fact-pack.ts` · `buildChartFactPack`；`qimen-fact-pack.ts` |
| 议程 | `lib/poju/investigation-agenda.ts` · `parseInvestigationAgenda` · `canTransitionToConfirmation` |
| 状态机 | `lib/poju/state-machine.ts` · `awaiting_understanding_confirm` · `awaiting_confirmation` |
| 阈值 | `lib/poju/agent-state.ts` · `MIN_COLLECTING_USER_TURNS` · `PUSH_GATE` · `AGENDA_COVERED_GATE` |
| 30 日 | `lib/companion/pregen-daily-anchors.ts` · `buildDailyAnchorSeeds`；`companion-daily-prompt.ts`；`inngest/functions/companion-batch-fill.ts`；`companion/types.ts` · `CompanionDayCardsSchema` |
| 共同决策 | `lib/passes/joint-decision.ts`；`.cursor/docs/v1-共同决策-产品规格.md`（定价口径已落后于代码注释） |
