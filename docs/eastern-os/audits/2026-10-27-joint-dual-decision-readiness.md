# Eastern OS · 双人决策（joint / dual-person decision）就绪审计

> **Verdict: Partial（未就绪，可跑协调层）**  
> 审计日：2026-10-27 · 基线：`main` @ `a0a8e009`（「一次对齐」）  
> 范围：只读。对照 Max Chen 2026-10-26 锁定的产品模型。未改运行时、生产提示词、旗标、闸门或导出代码。  
> 产品模型来源：本任务说明（共同问题、两侧各一份独立决策、各方同时持有自己与对方的命盘、报告站在阅读者角度写「二元关系在这道题上的内容」）。  
> 先前 solo 九模块审计只作假设，下列结论均从当前源码重核。

---

## 总判

双人决策**已经是一条能跑的产品壳**：注册用户之间邀请、锁定同一道共同问题、双方各交出生信息、各扣 1 PASS、各开一条本地会话、各出一份报告，聊天与报告不合并。它**不是**一套完整的新提示词 + 数据契约 + 交付标准。推理与交付是现网 **solo dyad（单人收对方盘）** 的薄包装：多一句 `joint_decision=true` 微文案，路径锁成 `pivot_chart_path=dyad`，对方盘被压成 Match 兼容矩阵。模型被反复要求「主锚是你的盘、药方落你侧、禁止写成合盘专章、合不合去看 Match」。这和 Max 要的「两盘都算进这道共同问题、从该用户角度写二元关系内容」只重叠了「两份独立报告 + 你侧立场」，没有把二元关系内容做成交付主轴。

相对 Max 的模型：**协调与计费骨架在，分析契约不在。** 不能按「完整新栈」发货。

---

## 对六个审计问题的直接回答

### 1. 是完整新栈，还是 solo 上的薄包装？

**薄包装，带一块真实的协调层。**

协调层是新的：表 `joint_decision_sessions`、`lib/passes/joint-decision.ts`、`/api/joint/*`、本地 `hydrateJointSessionFromSeed`。  
分析层不是新的：hydrate 之后会话就是普通 POJU session，`joint_decision=true` 且 `dyadCollectedPatch`（`pivot_chart_path=dyad`，`partner_bazi=present`）。Opening / Call A / Call B / Synthesis / 九模块交付全部走既有 dyad 或 solo 提示词。没有 joint 专属页、专属 schema、专属 fill duty、专属闸门或 Lab 合格尺。

代码自己的产品句写在 `.cursor/docs/v1-共同决策-产品规格.md`（2026-10-25）：「共同决策 = 现网 dyad 单人决策 × 2」。这与源码一致，与 Max 2026-10-26 的分析要求不一致。

### 2. 今天能否同时计算两个人的盘，并注入两侧推理？

**能算两盘；注入不对称，且后段会变薄。**

每一侧 hydrate 时（`lib/poju/hydrate-joint-session.ts`）：

- 自己的出生 → `createStoredProfile` → `calculateProfile`（完整本地八字）。
- 对方的出生（seed 里的 `partner_birth`）→ 再 `createStoredProfile` → 对方也有完整 `user_profile`。
- 矩阵以 **A = 阅读者、B = 对方** 计算：`buildDyadCompatSummary` + `buildDyadMatrixPack`（`lib/compatibility/calculate-compatibility.ts` 的 `ResonanceMatrix`：日主互动、用神匹配、地支、配偶星、神煞共鸣、岁运同步、共振指数）。方向是对的：换边则 A/B 对调。

注入进模型时：

| 料 | 谁的盘 | 进到哪 |
|----|--------|--------|
| `base_analysis` / `ChartFactPack`（日主、四柱、用喜忌、岁运、合冲） | **只有阅读者** | Call A；交付 `chart_fact_pack` |
| `ResonanceMatrix` 全文 JSON（≤12k） | 两人压缩关系 | **仅 Call A**（`formatDyadMatrixPackForPrompt(..., { mode: "full" })`） |
| 同矩阵 compact 头（无 `matrix_json`） | 关系标签 +「校准用户侧边界」 | Call B、Synthesis、交付喂料 |
| 奇门锁盘 | **只有阅读者**出生时刻 | 交付 P4（`self_regulation`） |
| 对方的第二份 ChartFactPack | 不存在 | 任何阶段都没有 |

对方盘不是第二份事实档。交付页看到的是短摘要（`A=` / `B=` 日主+日支+用神一行、`synergy_type`、`resonance_index`、若干 strength/challenge key）。`page-feed-policy.ts` 里 `self_regulation` 的**正文**步把 `dyad_relation_structure` 设为 `false`，东方谋略正文不吃这包关系料。

服务端 `joint_decision_sessions.birth_snapshot_a/b` 存的是双方出生 JSON，供种子下发；真算发生在各自浏览器的 `createStoredProfile`，不是服务端双盘引擎。

### 3. 同一共同问题下，提示词是否强制「站在用户侧分析二元关系在这道题上的内容」？

**立场有一半，分析任务没有。** 模型更常被推向 solo 式「你侧药方」或「关系只是边界锚」，而不是「就这道共同问题写二元关系内容」。也没有第三份合并报告的数据路径（见第 4 点），但提示词也没有禁止「第三人称合盘墙」以外的正面任务去填上 Max 要的那一块。

已锁定的共同问题：

- 创建时 `shared_question` 写入行；hydrate 写入 `original_question` 与 `pending_question`。
- 聊天顶栏只读展示该题，并写「可澄清你本人的期望」（`POJUChatUI`）。
- Opening 任务块有一句：共同问题已锁定；可澄清本侧期望与边界；禁复述对方出生原文与对方私聊；对方盘仅作联合依据（`opening-phase-v6.ts` `buildOpeningDyadFeedBlockV6`）。
- 交付喂料在 `joint_decision===true` 时前置一句：报告以本侧立场与期望为主；期望不同则结论可不同（`dyad-compat.ts` `resolveDyadRelationStructureFeed`）。

这句**没有**进入 Call A / Call B / Synthesis。`Segment2JobInput` 与 `SynthesisJobInput`（`lib/poju/xhigh-job-types.ts`）没有 `joint_decision` 字段。`buildBreakthroughCorePrompt` / `buildAgendaBridgePrompt` / `buildSynthesisPrompt` 只按 `pivot_chart_path===dyad` 拼 dyad 包。

Dyad 包的任务方向与 Max 相反的几处（类别，不是个案原句）：

- `PIVOT_DUAL_PARTY_POLICY`：主锚始终是用户主盘；对方盘只作关系结构锚；「我们合不合」指向 Match；Pivot 仍只写你侧怎么走。
- `DYAD_PATH_SYSTEM_PREFIX`：喂料与 solo 同构，只多一盘与合盘矩阵；总纲是「你怎么破」。
- `DYAD_JUDGMENT_EXTRA`：每页先写二元关系批断（机制/张力/适配），再锁用户侧主辅；正文药方仍落你侧。这是现网里**最接近** Max 的一句，但是 solo-dyad 的页批断附加，不是共同问题的交付标准，且正文层把它收掉了。
- `DELIVERY_FILL_L1_IDENTITY`（`page-prompts/shared.ts`）：主锚=用户主盘；禁止把交付写成合盘报告翻版（合盘归 Match）。
- 各页 `【二元】` 行（p1/p3/p5/p6）：手段与收尾必须用户可执行；对方是约束或可观察行为；禁合盘翻版。
- `formatDyadMatrixPackForPrompt` compact 用法句：校准用户侧边界；禁止翻版合盘专章墙。

结果：两侧**可以**因本侧期望不同而结论不同（微文案允许，对话也分开收集期望），但没有强制「这道题上的二元关系内容」成为每页承重。缺对方盘时的禁臆造闸（`invented-partner-chart.ts` #13）在 `path=dyad` 上**关闭**，所以有盘时写对方命理不会被这条闸拦住，也不会被要求写够。

### 4. 交付：两份还是一份？有没有 joint 专用 SoT / 闸门 / Lab？

**两份独立报告，模块与 solo 相同。没有 joint 交付 SoT，也没有 joint 闸门或 Lab 合格尺。与 Max「两份、各站该用户角度」在形态上对齐，在内容标准上不对齐。**

- 服务端一行 joint 挂两个 id：`pivot_session_id_a` / `pivot_session_id_b`。会话与报告在各自设备 IndexedDB，列表 API 不回传对方会话正文。
- 交付 job（`app/api/poju/final-delivery/route.ts`）只多 `joint_decision` 与 `joint_pass_ref`。`joint_pass_ref` 的作用是**幂等复用已扣的 PASS**，不改变报告形状。
- 页模块 = 现网 v1 九模块 / 十个出稿 key（`report-blueprint.ts`、`delivery-schema`）。蓝图里二元只出现在若干 `reality_needs` 可选条（对方角色、可观察行为、你的底线），没有「二元关系 × 本题」模块。
- 陪伴日锚定仍是单人流日。`formatCompanionRelationBoundary` 不读 `joint_decision`，文案仍是「日提醒仍单人流日，只用锚校准你侧边界」。
- Lab：`lab/types.ts` 与 `lab/build-context.ts` 会把 `source.joint_decision` 传进同一条 `resolveDyadRelationStructureFeed`。没有 joint 步骤、没有双人夹具、没有「站在阅读者 / 禁止合并稿」的闸。Lab 手册里的路径 B 仍是**同一个人**在二元门里手填对方生辰，不是邀请流。
- 状态 `sealed` 在 CHECK 约束里，仓库内没有写入方把它设成 `sealed`。

### 5. 与 v1 九模块双轨（命理 + 现代多科学）的交点

**Joint 整段复用 solo 交付管线，因此继承 solo 缺口，另外再缺一层「关系内容」契约。** 本审计不重审整座九模块栈，只记录 joint 路径实际碰到的分叉与继承。

继承（joint 不另起 schema）：

- Fill duty 别名仍指向旧页文件：`personal_decision_patterns` 与 `bottleneck_analysis` → `p2-foundation`；`strategic_options` → `p3-science-action`；`recommended_strategy` → `p1-direct-answer`（`page-prompts/index.ts` `BY_KEY`）。
- `sanitizePageJson` 有分支的 key：`decision_brief`、`situation_analysis`、`execution_guidance`、`self_regulation`、`thirty_day`、`validation_risk`、`validation_close`。`personal_decision_patterns`、`bottleneck_analysis`、`strategic_options`、`recommended_strategy` 落入 `default` → `unknown_key_*` 结构失败。Joint 出这些模块会撞上同一堵墙。
- 双轨依据：Zod 上 `science_evidence` 可选；`assessDeepEvidenceUnitDepth` 在非 plain、锚非空时 `gateDualEvidenceParts(..., { requireScience: true })`。这是 solo 的命理+科学轨，不是「双人」轨。Joint 没有关系证据槽。
- `.cursor/docs/v1-决策交付-产品边界.md` 不提共同决策。九模块映射文档也不提 joint。

Joint 自己多出来的缺口（solo 单人路径没有）：

- 对方不是第二份 Fact-pack，奇门不排对方盘。
- P4 正文喂料关掉二元结构。
- 交付标准仍把「合盘」让给 Match，而不是写进本题。

### 6. 挡住 Max 产品意图的东西（建议顺序，不实施）

见文末「第一工作流」。P0 是契约与喂料，不是再包一层邀请 UI。

---

## 分层矩阵

| 层 | 判定 | 现在实际是什么 | 相对 Max |
|----|------|----------------|----------|
| 产品流：邀请 / 同意 / 共同问题 | **Partial** | 工作台入口对所有登录用户开放：邮箱须已注册、共同问题 ≥4 字、双方各交出生、邀请 7 天。同意后 `partner_ready`，两侧各自 `startJointSide`。聊天顶栏锁定共同问题，本侧可另澄清期望。 | 形态符合「一个共同问题、两次独立决策」。账户页面板仍写「仅双人订阅且满席」。 |
| PASS / 计费 | **Partial** | 每侧 1 PASS，ref `joint:{id}:a` 与 `joint:{id}:b`，`consumePassSmart`：有家庭池先扣共享，否则个人 flex。交付再用同一 ref 幂等，不二次扣。 | 与「各一份决策、各付一份」一致。与 10-25 规格「Duo 才可、共扣 2、Flex 不能」以及定价文案冲突。 |
| 盘喂料：自己 + 对方 | **Partial** | 两盘都在本机算完。阅读者 Fact-pack + 奇门完整。对方只进兼容矩阵；全文 JSON 只在 Call A；其后 compact。P4 正文不喂关系块。 | 「同时计算」成立。「都注入本题推理」只在 Call A 成立一半。 |
| 对话提示词 | **Partial** | Opening 有一句 joint。Call A/B/Synthesis 走 dyad 前缀，任务是你侧破局 + 关系锚，并把契合度推向 Match。不收集对方私聊。 | 有「你侧」，没有「本题上的二元关系内容」作为必写对象。 |
| 报告提示词 / fill / sanitize / schema | **薄包装** | 与 solo 同一套九模块。无 joint 字段。Fill 别名旧 P 页。Sanitize 缺 03–06 对应 key。 | 两份报告的壳在；内容标准仍是单人 dyad。 |
| UI 交付 | **Partial** | 侧栏双人历史与单人历史分开图标；进入聊天后邀请条隐藏。每侧一份报告架。无「对方的报告」、无合并稿、无双人模块目录。 | 两份独立交付符合。用户看不到「这是站在我角度的关系分析」的结构。 |
| 闸门 / Lab 标准 | **缺** | 仅有 solo 路径「臆造对方盘」闸，dyad 时放行。Lab 只透传 `joint_decision` 布尔。无双人合格尺。 | Max 的内容标准无法机检，也无法在 Lab 里当一条路径验收。 |
| 文档 vs 代码 | **漂移** | 见下节。 | 10-25 规格把产品定义成「dyad × 2」；10-26 开闸代码把准入改成全员，分析提示词没跟着 Max 改。 |

---

## 证据（按层）

### 协调、会话、计费

- `lib/passes/joint-decision.ts` 文件头：「Open to all users; charge 1 PASS per side via consumePassSmart」。`createJointInvite` 不检查套餐、不检查 `can_joint`。`startJointSide` 在双方出生都在之后扣 `joint:{id}:a|b`。`buildSeed` 把**对方**出生放进 `partner_birth`。
- `toPublicView`：默认不带对方出生；`includePartnerBirth` 时带。`listJointsForUser` 传 `includePartnerBirth: false`。`getJointForUser` 在两份快照都在时把对方出生与自己的出生都放进视图，供本机算盘。类型注释仍写 “never includes the other user's birth snapshot”，与可选字段不符。
- `lib/passes/consume-pass-smart.ts`：`refId` 以 `joint:` 开头时若用户在家庭里先走 `consumeHouseholdPass`，池空则落到个人 `assertAndConsumePass`。注释「Joint refs always go through household」过时。
- `supabase/migrations/20261025_duo_household_joint.sql`：`household_id NOT NULL`，状态无 `partner_ready`。  
  `supabase/migrations/20261026_joint_open_access.sql`（及 `_reload`）：`household_id` 可空，补 `partner_ready` / `unread_*` / `invitee_email`。
- `app/api/household/me/route.ts`：`can_joint = householdIsFull && shared_sub_balance >= 2`。工作台创建**不读**这个标志。
- `components/workspace/WorkspacePojuBirthHost.tsx` `handleConfirmJoint`：查重邮箱 → `POST /api/joint/create`（问题、自己的出生、`partner_email`）。不检查 Duo。
- `components/poju/JointDecisionPanel.tsx`：文案「仅双人订阅且已绑定第二账号可用」；`canJoint` 为假时按钮禁用。账户页 `DuoHouseholdCard` 把这块面板嵌进来。这是第二条、更旧的入口。
- `components/poju/JointSessionOpenHost.tsx`：对方就绪后准备 → 扣 PASS → `hydrateJointSessionFromSeed`。`main` @ `a0a8e009` 在进入聊天时 `markJointEnteredChat`，侧栏邀请条让位给历史。
- `lib/poju/hydrate-joint-session.ts`：`dyadCollectedPatch` + `joint_decision: true` + `dyad_offer_status: "collected"`。跳过「收对方盘」芯片（`shouldOfferDyadGateForSession` / `shouldPresentDyadGate` 在 joint 上直接 false）。
- 文案 `messages/zh.json` `joint_flow.cta_joint_hint_body`：对方须注册；各方 1 PASS（先订阅后购买）；各自独立对话、报告与提醒。同文件 `passPurchase.personalTitle` = 「双人共同决策订阅」，`flexFeatures` 含「共同决策需开通双人订阅」。`birth_confirm.joint_need_bind` / `joint_need_balance` 仍在五语文案里，仓库 `.ts/.tsx` 无引用。
- `components/account/PassPurchaseModal.tsx`：`TEAM_CHECKOUT_ENABLED = false`。
- 验收脚本 `scripts/test-joint-decision-acceptance.ts` 仍断言 `en.json` 含 “Duo joint-decision plan”、`zh.json` 含「双人共同决策订阅」、以及 Duo 家庭迁移存在。它锁的是**旧定价文案还在**，不是 Max 的分析契约。

### 双盘计算与注入

- `lib/profile/stored-profiles-service.ts` `createStoredProfile` → `calculateProfile`。Hydrate 对自己和对方各调用一次。
- `lib/poju/dyad-matrix-pack.ts`：`mode: "full"` 才附 `matrix_json`；`compact` 明确不附全文，并写「校准用户侧边界」。
- `lib/llm/deepseek/breakthrough-core.ts`：Call A 用 full；Call B 用 compact。系统前缀是 `DYAD_PATH_SYSTEM_PREFIX`，不读 joint 旗标。
- `lib/llm/deepseek/synthesis-task.ts`：同样 compact，无 joint 旗标。
- `lib/llm/pro/delivery/page-schema/chart-fact-pack.ts` `buildChartFactPack`：单份 `ProfileStructured`。
- `lib/llm/pro/delivery/pipeline-v3/page-feed-policy.ts`：`self_regulation` 正文 `dyad_relation_structure: false`。批断步在 dyad 上由 `withDyadJudgment` 打开。
- `lib/llm/pro/delivery/dispatch/task-context.ts` `resolveDyadRelationStructure`：这里才把 `joint_decision` 传进喂料。只影响交付枪，不影响第 2 段。

### 提示词立场

- `lib/llm/prompts/pivot-path-dyad/index.ts`：`DYAD_CALL_A_EXTRA`、`DYAD_CALL_B_EXTRA`、`DYAD_JUDGMENT_EXTRA`。
- `lib/llm/prompts/pivot-dual-party-policy.ts`：`PIVOT_DUAL_PARTY_POLICY`。
- `lib/llm/prompts/eastern-os-persona.ts`：双人二元 = 当事人盘 × 对方盘 × 关系机制 × 期望；药方仍落用户可执行侧。这是人设边界，不是共同问题的写作任务。
- `lib/llm/phases/opening-phase-v6.ts`：唯一在对话阶段点名「共同决策」的任务句。
- `lib/poju/dyad-compat.ts` 约 441–442 行：交付用的那一句 joint 微文案。
- `lib/llm/pro/delivery/page-prompts/shared.ts`：Fill / Finalize 的二元纪律仍是「合盘归 Match」。

### 交付、闸门、文档

- `lib/poju/report-blueprint.ts`：九模块；二元仅若干 reality need。无 joint。
- `lib/llm/pro/delivery/page-prompts/index.ts`：`fillDutyForKey` 别名表。
- `lib/llm/pro/delivery/page-schema/sanitize.ts`：`switch` 无 03–06 新 key，`default` 返回 `unknown_key_${key}`。
- `lib/llm/pro/delivery/page-schema/dual-evidence.ts` + `deep-evidence-quality.ts` `assessDeepEvidenceUnitDepth`：科学轨在深度闸上是硬的，schema 上是 optional。与「双人」无关。
- `lib/llm/pro/delivery/pipeline-v3/invented-partner-chart.ts`：只拦 solo / `partner_bazi=absent`。
- `.cursor/docs/v1-共同决策-产品规格.md`：Flex 仅个人；Duo $59.99/月共享 5 PASS；共同决策扣 2；验收含「Flex 不能 joint」。与 `joint-decision.ts` 和 20261026 迁移相反。
- `.cursor/docs/v1-决策交付-产品边界.md`、`.cursor/docs/v1-九模块与现网六页-迁移映射.md`：不定义 joint。
- `.cursor/docs/LAB全流程测试-首次操作手册.md` 路径 B：同会话手填对方八字，不是双人邀请。

---

## 相对 Max 模型的缺口

| Max 锁定 | 现在 | 缺口 |
|----------|------|------|
| 一个共同问题 | 有，两侧只读同一句，本侧另收期望 | 无 |
| 两次独立决策，不是一份合并稿 | 两 session、两 PASS、两份本地报告；无合并 API | 形态已有。内容标准没有「禁止第三人称合并分析」的专闸，只是没有合并管线 |
| 每侧都拿到对方命盘 | 对方出生下发到本机并 `calculateProfile`；列表 API 不泄露 | 算了，但没有第二份 ChartFactPack；后段模型看不到对方四柱全文。营销句「对方看不到你的出生信息原文」与「种子把对方出生交给本机」并存——原文不进对方 UI 表单，但进对方加密本机档案以便算盘 |
| 报告站在该用户角度 | Opening + 交付微文案 + 全链路「你侧」 | 「你侧」被实现成「少写关系、多写你的药方」 |
| 就共同问题写二元关系内容 | 关系矩阵 + 一句「先批断再锁你侧主辅」；正文禁止合盘专章；契合度让给 Match | **主缺口。** 没有写作任务、没有喂料厚度、没有合格尺 |
| 与九模块双轨相交但不重做 solo | 直接复用，含 sanitize 缺 key 与 fill 别名 | Joint 会吃到 solo 未完成的 03–06；另外 P4 正文主动丢掉关系喂料 |

准入漂移（会让「能不能发」和「卖给谁」各说各话）：

1. 服务端与工作台：任何注册用户可邀任何注册用户，各 1 PASS。  
2. 账户面板 + `can_joint`：Duo 满席且家庭池 ≥2。  
3. 定价文案：共同决策属于双人订阅；Flex 特性写「需开通双人订阅」。  
4. 规格文档 2026-10-25：Flex 不能 joint。  
5. 验收测试把 (3) 的字符串钉死。

---

## Max 点头实现时的第一工作流（只建议）

**先写共同决策内容契约，再改喂料，最后才动闸。** 不要从禁词表或邀请 UI 开工。

1. **产品口径收成一份。** 用 Max 2026-10-26 替换 `.cursor/docs/v1-共同决策-产品规格.md` 里「dyad × 2」那句，并选定准入：全员 1 PASS/侧，或收回 Duo。同一轮改掉账户面板、`can_joint`、定价 `personalTitle` / `flexFeatures`、以及仍断言 Duo 文案的验收脚本。分析工作不要在两套卖法上开工。
2. **喂料契约（P0，换人换盘仍成立）。** 每一侧、每一枪需要三块，而不是「你的 Fact-pack + 一行合盘分」：阅读者 ChartFactPack、对方 ChartFactPack（同一引擎、标明谁是阅读者）、已有 `ResonanceMatrix` 作为关系闭集。Call B、Synthesis、各页批断与正文都要能看见对方盘要点；取消 `self_regulation` 正文对 `dyad_relation_structure` 的一刀切关闭。奇门仍只排阅读者，除非产品另要双局。Compact 模式不可以把对方盘丢成「无 JSON，只校准你侧边界」。
3. **提示词契约（P0，类别不是词表）。** Joint 专用任务，从 solo-dyad 的「结构锚 / 合盘归 Match」拆开：共同问题已锁定；用两盘与关系闭集写**这道题上两人之间的结构如何约束阅读者的决定**；立场是阅读者及其本侧期望；禁止写成给第三人看的合并报告；禁止只写阅读者单盘、对方盘不承重；禁止把本题回答成「去 Match 看合不合」。Opening 那一句微文案不够，必须进 Call A、Call B、Synthesis 和页 duty。`Segment2JobInput` / `SynthesisJobInput` 要带上 `joint_decision`，否则第 2 段永远看不见这句。
4. **交付标准与 Lab（P0 尺，不在闸里改稿）。** 加一条 joint 路径：两份出生、同一问题、两侧各跑。合格尺只验类别：两盘都被引用、结论绑在本题、阅读者立场、不是合并稿、不是无对方盘的 solo。不要新造「必现动词」。Solo 九模块的 sanitize 缺 key（03–06）与 fill 别名会同时挡住 joint；修的时候当共享管线缺陷修，不要在 joint 上再抄一套页。
5. **明确不做。** 不把 Match 长报告嵌进决策页；不合并两侧聊天；不在提示词里追加 Lab 原句禁表。

做完 1–3，现有邀请流和 1 PASS/侧可以留着。在那之前加闸或改 UI 文案，都还是薄包装。

---

## 本审计没有做的事

- 未改 `lib/`、`components/`、`messages/`、迁移、旗标、闸门。  
- 未重跑 Lab，未打开浏览器走邀请。结论来自源码与规格对照。  
- 未复审 solo 九模块的全部提示词与闸门，只确认 joint 复用点与分叉点。
