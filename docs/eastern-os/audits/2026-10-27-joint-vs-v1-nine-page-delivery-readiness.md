# Eastern OS · 共同决策 × v1 九模块双轨交付 · 就绪审计

**Audit date:** 2026-10-27  
**Branch audited:** `main` @ `b480fd8a`（`一次对齐`），与当时 `origin/main` 一致  
**Mode:** read-only。本文不改运行时、提示词、旗标、闸门或导出代码。  
**Question:** 对照新的 9 页双轨 SSOT，共同决策今天（或只补上与单人共享的九页缺口之后）能否按侧交出一份合格报告：双方命盘都是依据输入，建议站在阅读者一侧？

**SSOT（本审计清单）：** 任务附件 `eastern-os-v1-decision-delivery-ssot.md`（与 `.cursor/docs/v1-决策交付-产品边界.md` 同文，2026-10-25）。工程桥：`.cursor/docs/v1-九模块与现网六页-迁移映射.md` · `lib/poju/report-blueprint.ts`。

**先前审计（只作上下文，下列结论均在本 SHA 重核，不照抄）：**

- 单人九模块：Partial — `docs/eastern-os/audits/2026-10-26-v1-nine-module-dual-track-readiness.md`（PR #1）。那次基线提交不在当前历史上（历史已压成「一次对齐」）；缺口在本 SHA 仍在。
- 共同决策协调壳：Partial — `docs/eastern-os/audits/2026-10-27-joint-dual-decision-readiness.md`（PR #2）。该文评的是邀请 / 双会话 / 喂料不对称，**没有**按 SSOT 01–09 逐条打分。本文补这一层。

中英对照：模块 = content module；出稿 key = delivery segment key；双轨依据 = `metaphysics_evidence`（A）+ `science_evidence`（B）；共同决策 = joint / dual-person decision；阅读者 = 本侧 session 的用户。

---

## 1. Executive verdict / 总判

**Overall: Not ready（不能按 v1 九模块双轨 SSOT，按侧交出合格的「双盘为据、阅读者立场」报告）。**

协调层能跑：邀请、锁定同一道共同问题、两侧各交出生、各扣 1 PASS、各开一条本地会话、各走同一套十个 prose key。这符合 Max 的「不是另一份报告产品」和「一侧一份、站在阅读者」。  
分析与出稿不符合：对方盘没有第二份 `ChartFactPack`；关系料是 Match 兼容矩阵，Call A 之后被压成一行摘要；`joint_decision` 进不了 Call A / Call B / Synthesis；生产 fill 仍把 03–06 别名到旧 P 页，且 03–06 在 `sanitizePageJson` 里 `unknown_key_*`；02–04 与 08 的正文喂料关掉关系块；提示词把主锚钉在阅读者盘，并把「合不合」推向 Match。科学轨与单人相同，仍未接线。

**只补共享九页缺口不够。** 即便 03–06 能落库、每模块有独立 duty、02–09 强制 A+B，共同决策仍缺「两盘都进入同一套 A 槽、建议仍落阅读者」的内容契约。没有第三条「关系依据」产品槽——也不该有；缺口是两盘没有一起喂进现有 A。

| 层 | 本审计判 | 相对「joint = 同一份九页交付」 |
|----|----------|--------------------------------|
| 产品身份（同一九页，不是第二产品） | **OK（壳）** | DAG / 蓝图 / schema 无 joint 分支 |
| 两侧各一份、共同问题、阅读者立场微文案 | **OK（形态）** | 两 session、顶栏锁题、Opening + 交付喂料各一句 |
| 01–09 形状与双轨 A+B | **Not ready** | 整段继承单人缺口 |
| 双盘作为 A 的输入 | **Not ready** | 阅读者 FactPack + 奇门；对方只在矩阵 |
| 提示词强制「两盘 + 关系进依据，建议留本侧」 | **Not ready** | 有「建议留本侧」，没有「两盘都承重」 |
| 30 日锚定 | **Not ready** | 仍是阅读者流日能量四段；不吃封印九页；不读 `joint_decision` |
| Lab / 闸「九页质量 + 双盘 + 本侧建议」 | **Not ready** | 只透传布尔；dyad 路径关闭「臆造对方盘」闸 |

---

## 2. Max 锁定（产品句）

共同决策的交付就是这一份新的九模块双轨决策报告（v1 SSOT），不是另一套报告产品；九页在 main 上尚未做完，本审计仍按九页要求打共同决策；差别只是双方命盘都作为依据输入，成稿仍是站在阅读用户角度的建议，一侧一份。

---

## 3. 直接回答

**不能。** 今天不能。只修与单人共享的九页缺口之后，仍然不能。

共享缺口会同时挡住单人与共同决策（03–06 写不出、双轨可空、科学选科未注入、30 日不是决策锚）。共同决策在此之上还有自己的内容契约缺口：第二盘不是 FactPack、关系喂料在关键页正文被丢掉、`joint_decision` 不到达第 2 段与汇总、提示词把关系让给 Match。两侧各一份报告的壳已经对齐 Max；合格九页内容没有对齐。

图例（每一行相对单人路径）：

| 标记 | 含义 |
|------|------|
| **继承** | 与单人同一缺口；joint 不另起 schema / DAG |
| **共同决策多出来的缺口** | 单人路径没有；换边仍成立 |
| **已对齐 Max** | 形态或微文案已经是「两份、共同题、本侧立场」；不等于该模块九页合格 |

---

## 4. 横切：同一套九页，还是第三套依据

### 4.1 模块、十个 prose key、交付 DAG

**继承，且与单人同一条 DAG。** `buildInitialDeliveryDispatchDag` 不读 `joint_decision`。

| 项 | 代码 | 共同决策 |
|----|------|----------|
| 九模块 id | `REPORT_BLUEPRINT`（`lib/poju/report-blueprint.ts`） | 无 joint 字段。二元只出现在若干 `reality_needs` 可选条（对方角色、可观察行为、底线） |
| 十个出稿 key | `V1_DELIVERY_SEGMENT_KEYS`（`segment-key-alias.ts`） | 模块 09 = `validation_risk` + `validation_close`。与单人相同 |
| 01 不挂依据 | `DELIVERY_TRANSITION_KEYS = { decision_brief }`；DAG 只 fill→ready | **继承** SSOT「简报是 transition」 |
| Wave A | 02–08 七个 key | 同左 |
| Wave B 门 | 只等 `decision_brief` + `execution_guidance` + `self_regulation` ready | 同左。不等 03–06 |
| 生产管线 | `dispatch/` 不读 `DELIVERY_PIPELINE`。`resolveDeliveryPipeline` 默认 `legacy`（`pipeline-v3/flag.ts`） | v3 正文 duty 草稿不进入生产 fill |

交付 job 多出来的只有计费与一句微文案：`FinalDeliveryJobInput.joint_decision` / `joint_pass_ref`（`xhigh-job-types.ts`）。`joint_pass_ref` 用于幂等复用已扣 PASS，不改变页形状。

### 4.2 双轨 A+B：共同决策有没有第三条「关系依据」

**没有第三条，也不该有。** SSOT §3 挂依据模块只有两段：A 命理、B 科学。共同决策应把**两个人的盘**都当作 A 的输入（外加关系闭集），建议正文仍是阅读者的。科学 B 仍是现代机制，不是「关系学第三栏」。

现在的实现：

| 料 | 谁 | 进哪 | 是不是 A/B 槽 |
|----|----|------|----------------|
| `buildChartFactPack`（日主、格局、用喜忌、四柱、岁运、合冲、神煞） | **只有阅读者**。`resolveBaseAnalysisForBreakthrough` 读 `selected_stored_profile_id`；`ensureJobChartPrimaryPrealloc` 把这一份 `structured` 交给 `preallocateChartPrimaries` | Call A 的 `base_analysis`；交付 `chart_fact_pack` | 这是 A 的真算包 |
| 奇门锁盘 | **只有阅读者**出生时刻。`pageFeedFlags` 只在 `self_regulation` 开 `qimen` | 08 | A 的知局切片，不是对方局 |
| 对方 `user_profile` | hydrate 时 `createStoredProfile(seed.partner_birth)` 会完整 `calculateProfile` | 只进入 `buildDyadCompatSummary` + `buildDyadMatrixPack` | **不是**第二份 FactPack。`partner_profile_id` 存在 session 上，交付预分配不读它 |
| `ResonanceMatrix` | A=阅读者、B=对方（换边则对调）。`_meta.a_summary` / `b_summary` 各是「日主+日支+用神」一行 | Call A：`formatDyadMatrixPackForPrompt(..., { mode: "full" })` 带 ≤12k JSON。Call B、Synthesis、交付：`compact`，明确「无 matrix_json」且「用法：校准用户侧边界」 | 关系闭集，被写成边界锚，不是 A 的第二结构档 |
| `science_evidence` | 与单人相同 | 类型可选；`ScienceEvidenceUnit.mechanism` / `tied_to_case` 无写入方；`science_disciplines` 只定义在蓝图 | B 未成必填依据 |
| `relation_evidence` 或第三槽 | 全库无此交付字段 | — | **没有第三轨** |

因此：共同决策**没有**增加第三种依据产品；它也**没有**把两盘送进现有 A+B。A 实际承重的是阅读者一盘；对方盘在 compact 头里缩成标签。

### 4.3 提示词是否强制「每模块吃两盘 + 关系，建议留在阅读者」

**建议留在阅读者：有。两盘都进每个挂依据模块：没有。** 而且多处把关系从承重改成「去 Match」。

`joint_decision` 真正写进提示词的只有两处：

- Opening：`opening-phase-v6.ts` `buildOpeningDyadFeedBlockV6` — 共同问题已锁定；可澄清本侧期望；禁复述对方出生与私聊；对方盘仅作联合依据。
- 交付喂料：`dyad-compat.ts` `resolveDyadRelationStructureFeed` — 报告以本侧立场与期望为主；期望不同则结论可不同。

Call A / Call B / Synthesis 的输入类型（`Segment2JobInput`、`Segment2AgendaJobInput`、`SynthesisJobInput`）**没有** `joint_decision`。它们只在 `pivot_chart_path === "dyad"` 时拼 dyad 包，系统前缀是 `DYAD_PATH_SYSTEM_PREFIX`，不读共同决策旗标。

与 Max 相反的任务方向（类别，不是个案原句）：

| 位置 | 它要求什么 |
|------|------------|
| `PIVOT_DUAL_PARTY_POLICY` | 主锚始终是用户主盘；对方盘只作关系结构锚；「我们合不合」指向 Match；Pivot 仍只写你侧 |
| `DYAD_PATH_SYSTEM_PREFIX` | 喂料与 solo 同构，只多一盘与合盘矩阵；总纲是「你怎么破」 |
| `DYAD_CALL_A_EXTRA` | 先做合婚/合作向测算，再收敛用户侧；禁止合盘报告翻版 |
| `DYAD_JUDGMENT_EXTRA` | 每页先写二元关系批断，再锁用户侧主辅；正文药方落你侧。这是最接近「关系要进批断」的一句，但是 solo-dyad 附加，且正文层会把关系喂料丢掉（见下） |
| `DELIVERY_FILL_L1_IDENTITY` | 主锚=用户主盘；禁止把交付写成合盘翻版（合盘归 Match）；问题本质是合不合则正文点明去 Match |
| p1 / p3 / p5 / p6 的 `【二元】` 行 | 手段与收尾必须用户可执行；对方是约束或可观察行为 |

生产 fill 是否把关系块灌进该页，由 `pageFeedFlags(key, "body")` 决定（`fill-prompt.ts` 约 304 行）。`path=dyad` 时 **judgment** 会强制打开 `dyad_relation_structure`（`withDyadJudgment`），**body** 不会。结果：

| 出稿 key | 深度依据（judgment 喂料） | 正文 fill（body 喂料） |
|----------|---------------------------|------------------------|
| 01 `decision_brief` | 开（dyad） | **开**（`BASE`） |
| 02–04 处境 / 模式 / 障碍 | 开 | **关**（显式 `false`，正文阶段不翻回） |
| 05–06 选项 / 主策略 | 开 | **开** |
| 07 `execution_guidance` | 开 | **开** |
| 08 `self_regulation` | 开 | **关**（正文显式 `false`；奇门仍只排阅读者） |
| 09 两 key | 开 | **开** |

即便「开」，灌进去的仍是 compact 矩阵 + 那句 joint 微文案，不是对方 FactPack。02–04 与 08 的正文连这句微文案都看不到。`DYAD_JUDGMENT_EXTRA` 只在 v3 批断枪（`content-judgment.ts`）拼接；生产深度依据走 `deep-evidence-prompt.ts`，不拼这句，只在喂料开关打开时附上 compact 块。

### 4.4 Sanitize / fill duty / schema · 03–06（共同决策路径）

**继承，无 joint 分支。** `sanitize.ts` 的 `switch` 只有：`decision_brief`、`situation_analysis`、`execution_guidance`、`self_regulation`、`thirty_day`、`validation_risk`、`validation_close`。落到 `default` 的 key 返回 `unknown_key_${key}`（约 1734 行）。

| key | Zod 形状（`page-schema/types.ts`） | 生产 fill duty（`page-prompts/index.ts` `BY_KEY`） | sanitize |
|-----|-----------------------------------|-----------------------------------------------------|----------|
| `personal_decision_patterns` | `PatternsPageSchema`：1–3 `why_cards` | **别名 `p2-foundation`** | **无 case** |
| `bottleneck_analysis` | `BottleneckPageSchema`：1–3 `why_cards` | **别名 p2** | **无 case** |
| `strategic_options` | 2–4 项 `summary/upside/cost/risk/reversibility` | **别名 `p3-science-action`**（toolkit，`page` 心智是执行页） | **无 case** |
| `recommended_strategy` | `core_judgment` + primary/backup；`when`/`exit` **可选** | **别名 `p1-direct-answer`** | **无 case** |

`DELIVERY_FILL_SHAPE_SKELETON` 的键仍是旧六页：`direct_answer` / `foundation` / `science_action` / `metaphysics_action` / `risk_guard` / `signals_close`。v1 key `fillShapeSkeletonForKey("strategic_options")` 等得到 `null`。

v3 `body-prompt.ts` 已为 03–06 写了独立目标，但生产 dispatch 不走 v3。v3 批断 `pageDutyBlock` 把 02/03/04 **合成同一段**「恰好 4 条八字轴」；05/06 落到 `default` 一句「纯机制批断」。所以即便打开 v3，批断枪也还没按 SSOT 把模式、障碍、选项、主策略拆开，更没有「两盘」duty。

### 4.5 双轨闸门（共同决策不另加尺）

深度依据在非 plain、`chart_anchors` 非空时调用 `gateDualEvidenceParts(..., { requireScience: true })`（`deep-evidence-quality.ts` `assessDeepEvidenceUnitDepth`）。这是单人的 A+B 长度尺，不是「双人」尺：

| SSOT §3.5 | 代码 | 共同决策 |
|-----------|------|----------|
| 02–09 缺 A 或缺 B | 短 A &lt; 24 / 短 B &lt; 12 | **继承**。只覆盖深度依据 unit，且空锚 plain 判断跳过 |
| B 须绑定本案 | `CASE_BIND_RE` 命中「你/决策/…」即可 | **继承**。不要求 `mechanisms[]`，不要求点到对方盘 |
| 删 A 后谁都适用 | `dual_metaphysics_generic` 条件几乎不可达（有 `⟦w:⟧` 即过） | **继承** |
| 删 B 后主张不变 = 注水 | 无 | **继承** |
| 删现实事实后建议仍通用 | 无 | **继承** |
| A/B 互相冒充 | 只写在深度依据提示词 | **继承** |
| 两盘都被 A 引用、建议仍在阅读者、不是第三人称合并稿 | 无 | **共同决策多出来的缺口** |
| 01 不挂 B | `decision_brief` 不跑这段双轨 duty | **继承**，与 SSOT 一致 |

UI：`DualEvidenceBody` 只 `splitDualEvidence` 一条字符串。没有 `【命理】/【科学】` 标记时整段算命理、科学为空。不读 slot 上的结构化字段。共同决策没有单独的折叠栏。

`science_disciplines`（每模块 1–3 科）只出现在 `report-blueprint.ts`。全库无第二处读取。共同决策没有自己的选科表。

### 4.6 现实先行（对话门）

SSOT：先聊透主问题、处境、期望、资源约束；用户确认之前不进入双框架深交付。议程 5–6 问，不是一模块一问。

| 机制 | 共同决策 |
|------|----------|
| 共同问题 | **已对齐 Max**。创建时写入 `shared_question`；hydrate 写入 `original_question` 与 `pending_question`。聊天顶栏只读该题 |
| 本侧期望 | **已对齐 Max**。Opening 允许澄清本侧期望与边界；两侧会话分开，结论可以不同 |
| 对方盘芯片 | **已对齐**。`shouldOfferDyadGateForSession` 在 `joint_decision` 上直接 false。出生在邀请流里收齐，不在对话里再要 |
| 议程 5–6、覆盖门、`PUSH_GATE = 0.6` 硬推 | **继承**。两轮 + 60% 覆盖 + 催结果仍可进汇总。共同决策没有更严的「无聊透不交付」 |
| 真算时机 | **共同决策更早**。hydrate 在对话之前就算完两盘并锁 `pivot_chart_path=dyad`。本地真算早于聊透，SSOT 允许引擎先算；双框架**成文**仍应等确认。成文门与单人相同，没有 joint 专属对齐门 |
| 现实料进正文 | **继承**。`pageFeedFlags` 对 P1/P3 批断关掉 collecting 原文。共同决策没有额外的「对方私聊」进喂料（这点符合「不把对方对话当本侧事实」），但也没有把本侧已确认约束提升为比命理更高的执行优先级闸 |

### 4.7 30 日 Daily Anchor（共同决策）

SSOT §5：同一次分析预生成、之后冻结、按日分发；策略一致、视角轮换；单条宜有主题句 / 适合关注 / 今天可以做 / 今天需要避免 / 今日锚点；回溯决策主题 + 至少一条策略或边界。变了 = 新 PASS，不是改旧锚。

| SSOT | 共同决策今天 | 判 |
|------|----------------|----|
| 与报告同批预生成、写完冻结、无回访、可关推送 | 与单人同一条 Inngest 填窗再滴灌 | **继承**（时机 OK） |
| 从封印的九页（尤其 06/07/08/09）取闭集 | `DAILY_ANCHOR_SOURCE_PAGES` 列了这些 key，但 `companion-daily-prompt.ts` 调用 `buildDailyAnchorSeeds` **不传 `pageSchemas`**。hints 退回 brief 主辅 claim 一句 | **继承** |
| 五槽决策锚，而不是流日能量四段 | `CompanionDayCardsSchema`：`today_is` / `suitable` / `unsuitable` / `suggestion` / `evidence`。evidence 是流日批断。日块主体是 `buildCompanionEnergyDigest`（阅读者流日） | **继承** |
| 共同决策：仍是单人能量日签，还是从本侧封印九页长出？ | `formatCompanionRelationBoundary` **不读** `joint_decision`。文案写明「日提醒仍单人流日，只用锚校准你侧边界，不开合盘专章」。镜头只有 `execute \| regulate \| validate`，没有 SSOT 的验证/风险/行动/节奏/边界五视角 | **共同决策多出来的缺口**：不是第二人的日签（这点符合「一侧一份」），但也不是「本侧九页 + 双盘依据」的决策锚。关系边界把对方盘继续当成栏杆，而不是依据 |
| 禁止无边界否定主策略 | 每 5 日 `track_role` 切一次 backup，无「仅边界镜头且有依据才可偏离」 | **继承** |

一侧一份提醒、不合并对方日签：**已对齐 Max 的形态**。内容还不是九页 SSOT 的 Daily Anchor。

### 4.8 Lab / 闸：九页质量 + 双盘 + 本侧建议

| 有的 | 没有的 |
|------|--------|
| `lab/types.ts` `source.joint_decision` 透传到 `resolveDyadRelationStructureFeed`（`lab/build-context.ts`） | joint 步骤、双人夹具、两侧各跑一遍的合格尺 |
| solo / `partner_bazi=absent` 的臆造对方盘闸（`invented-partner-chart.ts`） | 该闸在 `path=dyad` **关闭**。有盘时写对方命理不会被要求写够，也不会被这条闸拦住 |
| 深度依据的缺段/短科学句（单人尺） | 「A 同时引用两盘」「建议主语是阅读者」「不是第三人称合并稿」「共同问题被每模块承重」「B 仍是科学而不是关系栏」 |

Lab 手册路径 B 仍是同一个人在二元门里手填对方生辰，不是邀请流。共同决策不能在 Lab 里当一条九页路径验收。

---

## 5. 模块矩阵 01–09

列「SSOT 必写 / 依据」只摘该模块的合格条件。列「单人缺口」是共同决策原样继承的。列「共同决策差」只写与单人不同的部分。

| # | 模块 | SSOT 必写与依据 | 单人缺口（继承） | 共同决策差 | 行判 |
|---|------|-----------------|------------------|------------|------|
| 01 | `decision_brief` | 一句真问题、关键矛盾、推荐方向及成立条件、最近一步。**不挂**折叠双轨。禁用简报替代后文；禁命运定论 | `P1PageSchema` 比简报厚（双轨 `core_logic`）。生产 duty 仍写 `bazi_basis≥1`。DAG 跳过 deep，UI 不挂折层——这点和 SSOT 一致。形状不是「短简报」 | **已对齐：** 正文 fill 会吃到 joint 微文案 + compact 矩阵（body 开关开）。**多出来的缺口：** 上游 Call A 看不见 `joint_decision`；A 侧真算仍是阅读者 FactPack；`【二元】` 把合不合推向 Match。不是第三依据栏 | **Partial**（壳对齐；简报内容仍是单人 dyad） |
| 02 | `situation_analysis` | 现状/期望差；资源、责任、时间、资金、外部限制；事实 / 假设 / 缺口；表层与深层。A：与本题相关的结构张力。B：事实 vs 假设、可控 vs 不可控 | `P2PageSchema` 是 dashboard + `why_cards`，无事实/假设/缺口槽。生产 fill = 只译批断。v3 批断与 03/04 共用四条八字轴。sanitize **有** case。科学选科未注入 | **多出来的缺口：** 正文喂料关掉 `dyad_relation_structure`，本页正文看不到对方盘，也看不到 joint 立场句。深度依据能看到 compact 矩阵，不是对方 FactPack。关系不是第三槽 | **Partial** + 正文丢双盘 |
| 03 | `personal_decision_patterns` | 本题的价值排序、风险承受、冲突应对；压力下偏差（须有陈述或行为线索）；传统命理解释标明体系内；区分事实 / 行为证据 / 假设 / 命理解释。A/B 都写满且互不冒充（示范页） | Zod 只有 1–3 why_cards，无分标槽。生产 fill **别名 p2**。sanitize **无 case** → `unknown_key_personal_decision_patterns`。v3 正文 duty 有草稿，生产不走 | 同 02：正文丢关系喂料。没有「两个人的决策模式」槽，也没有要求 A 同时挂阅读者盘与对方盘。示范页的双轨仍是可选科学句 | **GAP** |
| 04 | `bottleneck_analysis` | 1–3 个障碍；成因、维持、相互影响；可控 / 可影响 / 暂不可控；解除哪一个最可能改局面。A 删掉后排序应垮。B 须本案绑定（拖延、损失厌恶等） | 同 03 的别名与 `unknown_key_`。无可控性槽。v3 批断仍是四轴归因 | 蓝图 `reality_needs` 有一条可选「对方近期可观察行为」，这是现实收集，不是对方盘。正文同样丢掉关系喂料 | **GAP** |
| 05 | `strategic_options` | 2–4 个可行选项；收益、成本、风险、时间、可逆性；成立前提与失效条件；用小行动验证的缺口。A：各选项与结构的契合/张力。B：权衡、机会成本、可逆性 | Zod 有 summary/upside/cost/risk/reversibility，**缺**时间、前提、失效、验证缺口。生产 fill **别名 p3 toolkit**。sanitize **无 case**。v3 批断走 default 一句 | 正文 **会**灌 compact 矩阵（body 开关开），所以不是「整页看不见对方」。看见的仍是 `A=`/`B=` 一行 + synergy，用法句是「校准用户侧边界」。不构成两盘比较。无第三槽 | **GAP** |
| 06 | `recommended_strategy` | 主路径 + 为何是你、为何是现在；备选与何时切换；前提、依赖、资源；应放弃什么；停止/退出触发。A 是主路径承重轨，删 A 必须垮。B 解释排序。护城河页，应写厚 | `exit`/`when` 可选。生产 fill **别名 p1**。sanitize **无 case**。删 A 闸不可达。无「放弃项」必填槽 | **已对齐的只有立场：** 微文案允许两侧期望不同则结论不同。**多出来的缺口：** 「为何是你」只挂阅读者盘；对方盘不进入主路径理由。fill 身份仍写合盘归 Match | **GAP** |
| 07 | `execution_guidance` | 本阶段优先验证什么；示例级动作及理由（非日历）；先验证/暂缓；推进/调整/停止；防偏差原则。**禁**按日任务表。A：原则从结构长出。B：本模块科学轨最重 | 生产是 P3 科学杠杆套件（各 ≥3 angles），不是阶段原则槽。sanitize 有 case。依据仍以命理 `⟦w:⟧` 承重。禁 30 天表写在 v3 duty，生产 p3 文件是科学手段菜单 | 正文灌 compact 关系块。`【二元】` 要求手段用户可执行、对方只作约束——**建议留本侧已对齐**；两盘不进 A。科学 B 没有因为共同决策而选「社会学/关系」科（蓝图 06 才写社会学，且未注入） | **Partial** |
| 08 | `self_regulation` | 压力反应与行为风险；识别冲动/拖延/犹豫/过度投入；暂停机制；调节方法若用东方框架须标明传统属性；何种状态推进、何种状态先停。禁复读 07；禁把气场写成科学结论。A 调候来源；B 情绪与习惯机制 | 形状是 P4 `dimensions`（奇门/调候），不是「继续 vs 先停」槽。科学调节机制未成独立段 | **多出来的缺口最明确：** 正文 `dyad_relation_structure: false`，东方谋略正文不吃关系块，也不吃 joint 句。奇门只排阅读者。批断步在 dyad 上会打开关系喂料，正文再丢掉。对己页可以不写对方仪轨，但 SSOT 的 A 仍须能解释「为何此调频只对此人此局」；共同决策的「此局」含对方盘，这里被主动拿掉 | **Partial** + 正文丢双盘 |
| 09 | `validation_review` → `validation_risk` + `validation_close` | 奏效信号、判断可能错的信号、风险与退出、复盘问题、重大变化时哪些模块需重评。产品口径是新购 PASS，不是回访改旧报告。A：结构特有坑。B：信号可观察。Daily Anchor 只复用本模块写死的边界，不另开实时接口 | 风险页：红灯×2、坑×1、切辅×1、防护×2。收束页：身份对照、金句、今晚、**恰好 4** 条 day7。无「哪些模块重评」槽。两页都走深度依据双字段提示，无模块级必填 A/B。day7 靠近出门勾选 | 正文会灌 compact 矩阵。没有「两侧前提同时变化 → 本侧哪些结论失效」的槽。Companion **不**从这两页摘闭集（见 §4.7）。形态上仍是一侧一份，不是合并复盘 | **Partial** |
| — | `appendix` | 命盘摘要、术语、计算细节。不要求科学依据 | 蓝图 `hangs_dual_evidence: false`。不单独 LLM 页 | 不归档对方 FactPack。对方结构只活在矩阵里 | **OK** 相对「附录不要求 B」；**不是**双盘附录 |

---

## 6. SSOT 验收清单（§0–§6）打分

只列与「共同决策是否等于合格九页」有关的条。勾不上的，括号里写继承还是多出来的。

| 清单条 | 判 | 为何 |
|--------|----|------|
| 护城河三环：了解此人（真算 + 多轮现实）→ 双框架分析本题 → 针对此人的方案 | 不过 | 真算有阅读者盘；对方盘未进方案依据。现实对话有本侧收集，但不是每模块约束。方案页 03–06 生产写不出 |
| 不是只看命理，也不是丢掉命理的通用咨询 | 不过 | **继承** 科学轨未承重；命理轨又只有一盘 |
| 现实先行；无对齐不深交付 | 部分 | 共同问题锁定 **已对齐**。硬推 60% 与真算早于确认 **继承** |
| 命理非装饰 | 部分 | 阅读者 FactPack 是真算。对方盘算了但没进依据承重 = 共同决策的命理环缺一半 |
| 对话非摆设 | 部分 | 本侧议程能进报告喂料（受 page-feed 开关限制）。对方私聊正确地不进。共同问题本身是锁定句，不是聊出来的结构重组 |
| 依据透明：事实 / 推断 / 假设 / 命理解读 / 方法建议 | 不过 | **继承**。03 没有分标槽 |
| 02–09 均有 A+B；01 不挂 | 不过 | 01 不挂 **已对齐**。02–09 字段可选；UI 无标记则科学为空；03–06 页本身落不了库 |
| 双轨不冒充 | 无闸 | **继承**。提示词禁止「科学验证了八字」，无机器尺 |
| 删 A / 删 B / 删现实事实三问 | 不过 | **继承** 尺不够。共同决策另缺「删掉对方盘后主路径理由是否仍像单人报告」 |
| 方案有差异、行动可执行、风险有退出 | 不过 | 07/09 有近似槽但体裁是旧 P3/P5/P6。06 写不出 |
| 一次性边界；30 日是预生成分发 | 部分 | 无回访 **继承 OK**。30 日内容不是决策锚，共同决策不从封印九页播种 |
| 连续多条提醒策略一致且视角有变化；抹掉套话仍属同一决策；传统视角有标注 | 不过 | 镜头三种，主体是阅读者流日；关系句明确「仍单人流日」 |

---

## 7. 已对齐 Max、不要推倒的部分

1. **不是第二套报告产品。** 同一 `REPORT_BLUEPRINT`、同一 `V1_DELIVERY_SEGMENT_KEYS`、同一 `buildInitialDeliveryDispatchDag`。不要为共同决策再抄一套 01–09。
2. **一侧一份。** `pivot_session_id_a` / `pivot_session_id_b`；报告在各自设备；无合并稿 API。
3. **一道共同问题。** `shared_question` → `original_question`。顶栏只读；本侧另澄清期望。
4. **各付各的。** `lib/passes/joint-decision.ts` 头注释：全员可用，每侧 1 PASS（`joint:{id}:a|b`）。`joint_pass_ref` 避免交付再扣一次。
5. **阅读者立场的微文案已经有一句**（Opening + 交付喂料）。要加厚的是任务，不是再写一句口号。
6. **两盘都在本机真算。** hydrate 对阅读者与对方各 `createStoredProfile`。方向 A=阅读者、B=对方，换边对调。缺的是把对方算盘送进 FactPack，不是再算一遍。
7. **跳过「再收对方生辰」芯片。** 邀请流已经收齐。
8. **单人九页的杠杆共同决策也用得上**（修的时候当共享管线修）：十 key、01 不跑 deep、深度依据双字段草稿、`DualEvidenceBody` 两小节 DOM、`buildChartFactPack`、议程 5–6。

规格文档 `.cursor/docs/v1-共同决策-产品规格.md`（2026-10-25）仍写「共同决策 = dyad × 2」以及 Duo 扣费。代码准入已是全员、每侧 1 PASS。该漂移不改变本审计的内容结论，但实现时不要按那份旧规格把共同决策做成 Match 合盘页。

---

## 8. Max 点头实现时的顺序（只建议，本 PR 不实现）

先做**共享九页**（否则共同决策没有页可写），再叠**共同决策内容契约**。不要从禁词表、邀请 UI 或第三条依据字段开工。

### 共享前提（单人审计 P0，共同决策原样吃到）

1. `sanitizePageJson` 接上 03–06，并与 Zod 必填槽对齐；`DELIVERY_FILL_SHAPE_SKELETON` 登记 v1 key。  
   文件：`page-schema/sanitize.ts`、`fill-shape-skeleton.ts`。
2. 生产 `fillDutyForKey` 停止把 03/04→p2、05→p3、06→p1。每模块一份 duty（角色、目标、禁忌类别、数据来源、先依据后正文）。不要把 v3 里 02/03/04 共用的四轴批断搬进生产。
3. 02–09 依据层必填 A+B（01 除外）。UI 读结构化字段。闸门：缺段 fail；B 须点到本案事实或本 unit 行动；禁止科学口吻写命理定论、命理口吻写科学证明。删 A「谁都适用」保持类别尺。`science_disciplines` 注入该模块 duty（每页 1–3 科）。

### 共同决策内容契约（叠在上面，P0）

4. **喂料：两盘进同一套 A，不新开第三槽。** 每一侧、每一枪三块：阅读者 `ChartFactPack`、对方 `ChartFactPack`（同一 `buildChartFactPack`，标明谁是阅读者）、现有 `ResonanceMatrix` 作为关系闭集。对方盘已经在本机 `partner_profile_id` 上，缺的是预分配去读它。Compact 模式不可以把对方盘丢成「无 JSON，只校准你侧边界」。奇门仍只排阅读者，除非产品另要双局。  
   取消共同决策路径上 02–04 与 08 **正文**对 `dyad_relation_structure` 的一刀切关闭；至少改为两份 FactPack 进挂依据模块的批断与正文。科学 B 仍走共享科学轨，用本案事实（含本侧已确认的关系约束）选科，不要造 `relation_evidence`。
5. **提示词：从「主锚只你盘 / 合盘归 Match」拆开共同决策任务。** 共同问题已锁定；用两盘与关系闭集写这道题上的结构如何约束**阅读者**的决定；立场与可执行建议留在阅读者及其本侧期望；禁止写成给第三人看的合并报告；禁止对方盘在场却只写阅读者单盘；禁止把本题回答成「去 Match 看合不合」。这句必须进 Call A、Call B、Synthesis 和页 duty。`Segment2JobInput` / `Segment2AgendaJobInput` / `SynthesisJobInput` 要带 `joint_decision`，否则第 2 段永远只有 dyad 前缀。
6. **Lab 与验收尺（不在闸里改稿）。** 一条 joint 路径：两份出生、同一问题、两侧各跑。合格只验类别：两盘都被 A 引用、结论绑共同问题、建议主语是阅读者、不是合并稿、02–09 仍有科学 B、01 不挂依据。不要新造必现动词。不要用本案原句当正则。

### P1（共享九页修完、共同决策喂料接上之后）

7. 30 日仍是**本侧**预生成日签，不合并对方日签。播种改为该侧已封印的 06/07/08/09 摘录（`buildDailyAnchorSeeds` 传入 `pageSchemas`）。卡片对齐决策锚五槽或明确映射；流日只作标明传统属性的视角，不单独当内容。`formatCompanionRelationBoundary` 在 `joint_decision` 时改成「用两盘闭集校准你侧边界」，而不是「日提醒仍单人流日、合盘专章让给别人」。保持冻结与按日滴灌。
8. 02 的事实/假设/缺口槽、06 的退出与放弃项改为必填、08 与 07 的对己/对事分界——共享形状，共同决策不要单独做一套页。
9. 现实门：双框架成文仍等议程覆盖 + 明确确认。共同决策的提前算盘可以留。收紧 `PUSH_GATE = 0.6`，避免催一下就深交付。
10. 文档：用 Max 2026-10-26 替换 `v1-共同决策-产品规格.md` 里「dyad × 2」；九页 SSOT 加一句「共同决策 = 同一九页 × 两侧，双盘为据」。准入文案（账户面板 Duo vs 全员 1 PASS）与分析契约分开改，不要混进提示词禁表。

### 明确不做

- 不把 Match 长报告嵌进决策页，也不新做第三种依据栏。  
- 不合并两侧聊天或两侧报告。  
- 不在共同决策上复制一套 01–09 schema。  
- 不把质量不过当成再跑一枪。

---

## 9. 证据索引

| 主题 | 路径 · 符号 |
|------|-------------|
| 九模块蓝图 | `lib/poju/report-blueprint.ts` · `REPORT_BLUEPRINT` · `hangs_dual_evidence` · `science_disciplines`（仅此文件） |
| 十 key | `lib/llm/pro/delivery/segment-key-alias.ts` · `V1_DELIVERY_SEGMENT_KEYS` |
| DAG 无 joint 分支 | `dispatch/task-dag.ts` · `buildInitialDeliveryDispatchDag` · `WAVE_A_DEEP` · `WAVE_B_GATE_ID` |
| 生产不走 v3 | `pipeline-v3/flag.ts` · `resolveDeliveryPipeline`；`dispatch/` 无 `isDeliveryPipelineV3` |
| 段级双轨可选 | `delivery-schema.ts` · `DeliverySegmentComputed` · `ScienceEvidenceUnit` |
| 页槽双字段可选 | `page-schema/types.ts` · `EvidenceSlotSchema` · `PatternsPageSchema` · `BottleneckPageSchema` · `StrategicOptionsPageSchema` · `RecommendedStrategyPageSchema` |
| sanitize 缺 03–06 | `page-schema/sanitize.ts` · `default` → `unknown_key_${key}` |
| 形状锚仍是旧 key | `page-schema/fill-shape-skeleton.ts` · `DELIVERY_FILL_SHAPE_SKELETON` |
| fill 别名 | `page-prompts/index.ts` · `BY_KEY` · `fillDutyForKey` |
| fill 身份把合盘让给 Match | `page-prompts/shared.ts` · `DELIVERY_FILL_L1_IDENTITY` |
| 页内二元行 | `p1-direct-answer.ts` · `p3-science-action.ts` · `p5-risk-guard.ts` · `p6-signals-close.ts` |
| 喂料开关 | `pipeline-v3/page-feed-policy.ts` · `pageFeedFlags` · `withDyadJudgment`；08 与 02–04 正文 `dyad_relation_structure: false` |
| 生产 fill 按 body 开关灌关系块 | `page-schema/fill-prompt.ts` · `buildPageSchemaFillPrompt` |
| 生产深度依据按 judgment 开关灌关系块 | `page-schema/deep-evidence-prompt.ts` · `dualEvidenceDuty` |
| 双轨拆分与闸 | `page-schema/dual-evidence.ts` · `splitDualEvidence` · `gateDualEvidenceParts` |
| 双轨调用点 | `page-schema/deep-evidence-quality.ts` · `assessDeepEvidenceUnitDepth` |
| UI 不读结构化双字段 | `components/poju/delivery-pages/DeliveryPageSlots.tsx` · `DualEvidenceBody` |
| 阅读者 FactPack | `page-schema/chart-fact-pack.ts` · `buildChartFactPack`；`ensure-job-chart-primary-prealloc.ts`；`breakthrough-core.ts` · `resolveBaseAnalysisForBreakthrough` |
| 对方只进矩阵 | `hydrate-joint-session.ts`；`dyad-matrix-pack.ts` · `formatDyadMatrixPackForPrompt`；`calculate-compatibility.ts` · `_meta.a_summary` / `b_summary` |
| joint 微文案仅交付喂料 | `dyad-compat.ts` · `resolveDyadRelationStructureFeed` |
| Call A/B/Synthesis 无 joint 字段 | `xhigh-job-types.ts` · `Segment2JobInput` · `Segment2AgendaJobInput` · `SynthesisJobInput`；`FinalDeliveryJobInput` 才有 `joint_decision` |
| dyad 任务方向 | `prompts/pivot-dual-party-policy.ts` · `PIVOT_DUAL_PARTY_POLICY`；`prompts/pivot-path-dyad/index.ts` · `DYAD_*_EXTRA` |
| Opening 是对话里唯一点名共同决策的任务句 | `phases/opening-phase-v6.ts` · `buildOpeningDyadFeedBlockV6` |
| v3 批断 02/03/04 合并 | `pipeline-v3/content-judgment.ts` · `pageDutyBlock` |
| v3 正文 03–06 草稿（生产未用） | `pipeline-v3/body-prompt.ts` |
| 臆造闸在 dyad 关闭 | `pipeline-v3/invented-partner-chart.ts` · `isPartnerChartAbsentPath` |
| Lab 只透传布尔 | `lab/types.ts` · `lab/build-context.ts` |
| 30 日 | `companion/pregen-daily-anchors.ts` · `buildDailyAnchorSeeds`；`companion-daily-prompt.ts`（调用时不传 `pageSchemas`）；`companion/types.ts` · `CompanionDayCardsSchema`；`extract-companion-brief.ts` · `formatCompanionRelationBoundary`（无 `joint_decision`） |
| 协调与计费（形态已对齐，非本审计主缺口） | `lib/passes/joint-decision.ts`；`lib/poju/hydrate-joint-session.ts` |
| 旧规格与 Max 不一致 | `.cursor/docs/v1-共同决策-产品规格.md` |

---

## 10. 本审计没有做的事

- 未改 `lib/`、`components/`、`messages/`、提示词、旗标、闸门、迁移或导出。  
- 未重跑 Lab，未在浏览器走邀请。结论来自当前 `main` 源码与 v1 SSOT 对照。  
- 未把 PR #1 / PR #2 的句子当结论；两文提到的 sanitize、fill 别名、FactPack、Call A/B 无 `joint_decision`、P4 正文关关系喂料、Companion 不读 joint，均在 `b480fd8a` 重新打开对应符号核对过。
