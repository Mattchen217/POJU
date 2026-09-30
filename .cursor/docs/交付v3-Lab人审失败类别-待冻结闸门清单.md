# 交付 v3 · Lab 人审失败类别 → 待冻结闸门清单

> **地位**：Step①「无质量闸」阶段的退出账本。人审发现的是**类别**；提示词先钉死；达标后冻结提示词 → 类别进 Phase B 机闸（只验不改）。  
> **操作流程**：`交付v3-Lab人审与升闸操作手册.md`（跨会话必遵；本文件只记账本与门槛）。  
> **对齐**：`交付报告-三步链路-架构.md` · `交付v3-分步职责与合格尺-SSOT.md`（**翻车归哪步 · 改前必查**）· `01-delivery-iron`（闸门定尺 · 禁案例补丁 · 禁追句 strip）。

## 0. 退出标准与建闸节奏（硬）

> **流程 SSOT**：`交付v3-Lab人审与升闸操作手册.md` §4。本文件记门槛与账本行。

**定调**：起步可几乎无质量闸；Lab **发现问题 ↔ 建/升闸同拍**；全流程一遍后基础闸应已立；测稳后靠收集台加厚。

| 项 | 默认值 | 说明 |
|----|--------|------|
| **N** | 连续 **3** 次人审通过 | 同页同步（如 P1 批断、P1 正文）在提示词冻结候选后，不再因同类别翻车 |
| **M** | **3** 种差异盘 | 议题/格局/岁运姿态明显不同（禁同一合伙案反复凑数） |
| **冻结动作** | 达标当日 | ① 标注 prompt 文件 commit/指纹为冻结候选 ② 把下表「待 Phase B」行升为机闸规则 ID ③ Lab 该步人审降为抽检 |

未达 N×M：**禁止**争论「要不要加闸门」——继续人审攒类别，或改生成侧；**可机检类别应按手册提前升**，不把「等 N×M」当拖延借口。

达 N×M 后：**必须**冻结 + 转闸；禁止「再看几案再说」无限延期。

### 提前升闸（硬 · 防「通过了再跑又废」）

下列任一成立 → **立刻**把该类升成机闸（不必等满 N×M），否则 Lab「本步通过」无回归意义：

1. 类别已写入 duty，且**同盘同题重跑**再次命中；或  
2. 同一类别在 ≥2 个 Lab attempt 上重复出现。

另：人审首次钉出**可机检**类别时，优先本轮或下一轮挂闸（与修 duty 同拍），见操作手册 §4.1。

升闸后：机闸只验不改；人审只扫尚未机检的软项。  
「本步通过」在升闸前 = **样本批准**；升闸后 = **样本 + 机闸双过**，才有生产可迁移性。

## 1. 记什么 / 不记什么

| 记（进本清单 → 将来机闸） | 不记（禁进闸 / 禁 strip） |
|---------------------------|---------------------------|
| 换人换盘换题仍成立的**类别** | 本案原句、个别干支、Lab 当次二字 |
| 已写入 duty/system 的类别禁区 | 「见什么补什么」的正例反写清单 |
| 可机检的结构冲突（path 钉死、事实同向） | 靠 peels 洗成合格的 soft-strip |

**主修永远是 prompt / 菜单 / 喂料**；闸门只复现已冻结类别尺。

## 2. 本轮已钉类别（截至 P1 Lab）

### 2.1 P1 批断 `content.judgment` · `direct_answer`

| ID | 类别（尺） | Lab 露出（仅溯源 · 勿当禁表） | 生成侧落点 | Phase B |
|----|------------|------------------------------|------------|---------|
| `p1j_situational_subject` | claim/evidence 主语禁投入形态与处境词（含话语权/名分/**权责**）；官杀藏停在「制衡位/约束位不显」 | #1–4；本案 primary「权责框架」 | duty + **批断不灌 collecting** | **已升** `gate_judgment_situational_path_words` |
| `p1j_match_close` | 禁「结构匹配 / 更合结构 / 可保…」半祈使收束；停在张力词 | #5 守补给为结构匹配 | 同上 | **已升** `gate_judgment_match_close` |
| `p1j_yong_stance` | 大运扶用时禁「用神弱」字面；只写岁运冲突下承压/窗口收窄 | #5 calc_cite 用神水弱 | 同上 | 待 |
| `p1j_future_qimen` | backup 禁未来门象现编；切辅只写岁运/用忌松动 | #2 生门/开门 | 同上 | 待（P1 已不喂锁盘，防自编） |
| `p1j_qimen_dangzhi` | 「当值」=值使门（**迁 P4**；P1 根因=串页灌锁盘） | 本案：值使休门却写死门当值 | 页级喂料白名单 + P4 duty | **根修：P1 不喂奇门** |
| `p1j_no_qimen_axis` | P1 主辅根禁奇门门宫承重 | 同上串页 | duty + `page-feed-policy` | **已升** `gate_p1_qimen_axis` |
| `p1j_path_shape` | 恰好 3 path：core_judgment / primary / backup；主轴勿同骨架 | 形状（Phase A 已部分覆盖） | gate-phase-a + duty | 部分已有形状 |

**P1 批断冻结进度**：同案曾人审通过 1 次（#6）；本轮因串页奇门回退；**喂料矩阵已对齐后请重跑**；差 N 与 M 异盘。

**页级喂料（2026-09-29）**：见 `page-feed-policy.ts` + 操作手册 §2.1——每页白名单，无关数据不进；奇门仅 P4。

### 2.2 P1 正文 `content.body` · `direct_answer`

| ID | 类别（尺） | Lab 露出（仅溯源） | 生成侧落点 | Phase B |
|----|------------|-------------------|------------|---------|
| `p1b_visible_jargon` | 可见字段禁十神/干支/用喜忌（含 leverage_chip）；禁大运·流年·流月字面 | #1 流月喜神；本案 chip「食伤」 | `body-prompt.ts` + gate | **已升** `gate_p1_body_visible_jargon` |
| `p1b_invented_number` | 缓冲月数等须来自喂料；禁自造「X个月内」 | #1 三个月内 | 同上 | 待 |
| `p1b_fact_conflict` | when/路须与 collecting 已给事实同向（已拒≠尚未拒绝；**已拒门槛禁再当主轨适用前提**） | #2 尚未拒绝；本案 when「协商阶段性非全职」vs 已拒兼职 | 同上 | 待（语义尺） |
| `p1b_backup_axis` | backup 须从批断 backup 长出（近窗可切）；禁另编更保守第三撤退轨 | #2 暂缓绑定拧轴 | 同上 | 待 |
| `p1b_no_p3p4` | 禁塞 P3 法务里程碑 / P4 谋略段；禁三块 prose dimensions | 本案「里程碑结算」偏 P3 | 同上 | 待 |

**P1 正文冻结进度**：本轮人审不过（`p1b_fact_conflict`）；duty 已加硬；重跑后再计 N。

### 2.3 P2（摘要）

| ID | 类别（尺） | 生成侧落点 | Phase B |
|----|------------|------------|---------|
| `p2_visible_jargon` | surface/essence 零专名（含宫位/合冲/岁运/十神用忌） | `body-prompt.ts` foundation duty | **已升** `gate_p2_body_visible_jargon` |
| `p2_no_imperative_close` | 禁祈使/条件式怎么办收尾；停在结构张力 | 同上 | **已升** `gate_p2_body_essence_imperative` |
| `p2_thickness` | essence 厚度；非目录壳 | 同上 | 待（本案正文已厚，异盘再抽） |
| `p2_no_qimen_axis` | P2 归因不喂奇门、不作门宫主轴（知局归 P4） | duty + `stripQimenBlocksForFoundationAttribution` | **已升** `gate_p2_qimen_axis` |

**P2 本案进度（2026-09-29）**：批断已过 → 正文人审过 → gate 人审过 → evidence_soft 原批断冻结可过。同案正文 **1/N**；异盘 M 仍差。

### 2.4 P3 批断 `content.judgment` · `science_action`

| ID | 类别（尺） | Lab 露出（仅溯源 · 勿当禁表） | 生成侧落点 | Phase B |
|----|------------|------------------------------|------------|---------|
| `p3j_situational_subject` | claim/evidence 禁投入形态/处境词族（试水·全职·兼职·股权·话语权·稳定收入等） | 本案「全职跳入/稳定收入/股权兑现/话语权」 | duty + **批断不灌 collecting/Q·E** + 结构派工菜单 | **已升** `gate_judgment_situational_path_words` |
| `p3j_means_ref_from_menu` | means_candidate_ref 须精确派工闭集六轴；代码按 path 钉死；禁现编后缀 | 本案「科学维1/资源链路评估」等 | `forJudgment` 菜单 + coerce stamp | **已升** `gate_p3_means_ref_*`（闭集精确匹配） |
| `p3j_no_lab_question_core` | P3 批断 core_conclusion 禁灌 Lab 议题原文（处境词诱回写） | attempt#2 core 灌兼职/股权/话语权 →「权责」 | `content-judgment` 改结构向 brief | 生成侧已修 |
| `p3j_six_axes` | 六维结构轴互异（格局十神/宫位/财官/印比/用忌/岁运） | 人审软项 | duty + 派工 claim 种子 | 待（形状部分已钉 path） |

**P3 批断**：本案人审已过（六轴互异 · 闭集 ref）；差 N 与 M 异盘。

### 2.5 P3 正文 `content.body` · `science_action`

| ID | 类别（尺） | Lab 露出（仅溯源 · 勿当禁表） | 生成侧落点 | Phase B |
|----|------------|------------------------------|------------|---------|
| `p3b_rejected_path_as_primary` | 已拒兼职：主轨禁试水；辅轨禁「项目制/半职+保留现职」换皮；辅轨**允许**按次/按小时顾问（可保住现职） | #5 半投入换皮；#8 闸误杀「外部顾问+保留现有」→ 已收窄 | duty 路径闭集表 | **已升**（#8 收窄误杀） |
| `p3b_invented_schedule` | 试水月数/前N月/周工时/冷静小时/两周内/明天内/每半月/列出N位等须出自收集；禁自造 | 本案「每周15小时」「前三个月试水」「48小时」「下月中旬」；#5「两周/三天」；#7「前三个月/明天内/每半个月/列出三位」 | duty + 时长闭集 | **已升** `gate_p3_body_invented_schedule`（#7 扩类） |
| `p3b_invented_contract_term` | 成熟期/cliff/行权年数须出自收集；未给则「按书面约定节点」 | #6「四年成熟、一年 cliff」 | duty + 硬对齐 | **已升** `gate_p3_body_invented_contract_term` |
| `p3b_visible_jargon` | strategy/means/title 零十神合冲用忌岁运报幕（含半白话） | #3/#4 可见层专名 | **归属 polish full 闸**（body defer）；duty 尽量 | **已升** `gate_p3_body_visible_jargon`（polish 后验） |
| `p3b_invented_percent` | 禁 X%/Y% 等未收集比例占位 | #3 means「获得X%股权期权」 | **归属 polish**（body defer） | **已升** `gate_p3_body_invented_percent` |
| `p3b_quoted_script` | 可见层禁引号可照念台词 | #3/#5 引号句 | **归属 polish**（body defer） | **已升** `gate_p3_body_quoted_script` |
| `p3b_vernacular_thicken` | 大白话完整句加厚 | 人审读感 | **归属 polish**；body 不加厚 | 润色合同（非 body duty） |

**P3 正文**：#8 机闸误杀（按次顾问+保住现职本属辅轨允许）→ 已收窄半投入换皮尺，duty/硬对齐改为路径闭集表。请重跑；人审仍看真准。

**止追漏**：已拒路径 / 时长节律 / 条款年数 三类事实尺已类别化；再翻车先查是否误杀，勿再加本案二字正则。

**润色试点**：`science_action.body_polish`；规格 `交付v3-正文润色-body_polish-规格.md`。

### 2.6 P4 批断 `content.judgment` · `metaphysics_action`

| ID | 类别（尺） | Lab 露出（仅溯源 · 勿当禁表） | 生成侧落点 | Phase B |
|----|------------|------------------------------|------------|---------|
| `p4j_situational_subject` | claim/evidence 禁处境议题尾巴作机制主语（权力分配/话语权/模糊条款/名分/权益整类） | #1 权力分配易被动；话语权模糊；模糊条款 | duty + 批断不灌 Q/E/收集 + moat `forJudgment` + 不灌 fill `eastern_calc` | **已升** `gate_judgment_situational_path_words`（含 metaphysics_action） |
| `p4j_half_imperative` | 禁半祈使收束（站位需…/需涵养/不急于表态/试水·全职跳入处方） | #1 站位需涵养；raw 兼职试水/全职跳入 | duty + scrub 扩类 | **已升** `gate_p4_judgment_half_imperative` |
| `p4j_feed_thin` | 批断只收总纲+Fact-pack 锁盘+moat 结构候选；禁 fill 派工多维处方墙 | #1 喂料含 multi_dim「以静制动/兼职试水」+收集事实 | `page-feed-policy` judgment 薄喂 + `metaphysics_moat_judgment_feed` | 喂料根修（非正则） |
| `p4j_means_ref_invented` | means_candidate_ref 必须抄派工闭集「时机/极性/角色候选N」；禁自造人设/张力标签 | #2 泄秀节律者/运岁近窗未熟/用神力量不足… | duty + coerce 钉死 + 闸 | **已升** `gate_p4_means_ref_invented` |
| `p4j_cite_prescription` | calc_cite 禁「需抑制/宜等待」类处方尾巴 | #2 dim3 cite「忌神火土需抑制」 | duty + 闸 | **已升** `gate_p4_cite_prescription` |
| `p4j_pillar_misanchor` | 透干禁写成藏支等柱位错锚（人审尺；机检难） | #2「偏印藏于年支」实为年干丁透 | duty | 待（语义） |

**P4 批断**：#1 处境/半祈使不过；#2 ref/cite/柱位不过；**#3 人审通过**（机闸+样本双过）。差 N 与 M 异盘。

### 2.7 P4 正文 `content.body` · `metaphysics_action`

| ID | 类别（尺） | Lab 露出（仅溯源） | 生成侧落点 | Phase B |
|----|------------|-------------------|------------|---------|
| `p4b_rejected_path_as_primary` | 收集已拒兼职/必须全职 → 禁「兼职试水」进任何维 means；改硬门槛下藏隐/结界 | #1 dim0「以兼职试水作为试探气口」 | duty | **已升** `gate_p4_body_rejected_path_as_primary` |
| `p4b_p3_deliverable` | 站位/可见层禁交付成果·谈判筹码等 P3 交付物词族 | #1 dim2「技术交付成果…谈判筹码」 | duty | **已升** `gate_p4_body_p3_deliverable` |
| `p4b_quoted_script` | 可见层禁引号可照念台词 | #1 「核心位置」「稳态产出者」 | duty | **已升** `gate_p4_body_quoted_script` |
| `p4b_visible_jargon` | name/strategy/means 零用忌十神岁运门星报幕 | （本轮 chart_anchors 有真词·可见层尚可） | duty | **已升** `gate_p4_body_visible_jargon` |
| `p4b_vernacular_moat` | 正文须大白话完整句可译；禁半文言四字电报；须与 P3 可区分（局/气/气口 vs 协议清单）；局势维须有奇门虚实感（零专名） | #1「结界护核/内守涵养」电报体；站位像职场壁垒；奇门感弱 | duty + moat 文风 | 待（人审尺；勿用本案二字正则） |

**P4 正文**：#1 不过（已拒兼职+交付物+引号）；duty 已加「大白话/P3对照/奇门局势感」→ **请重跑 P4 正文**。

## 3. Phase B 转闸原则（将来实现时）

1. **一条类别 → 一个 `failed_rule` ID**（上表 ID），detail 指路「回改 prompt/喂料」，禁止闸内改稿。  
2. **可机检优先**：字面报幕族、path 集合、发明数字启发式、when 与 collecting 布尔冲突（若有结构化字段）。  
3. **语义拧轴**（backup 是否从批断长出）：能结构化比对 path 主张轴向则闸；否则保持人审抽检，**禁止**用本案关键词正则冒充。  
4. **禁**把 Lab 原句写进正则/禁表当唯一拦法（铁律：案例补丁）。

## 4. 追加规则（后人审）

每发现新翻车：

1. 用**类别名**追加一表格行（勿只贴原句）。  
2. 先改 duty/system（主修）并重跑该步。  
3. 若触 §0「提前升闸」→ **立刻**挂机闸并把本行 Phase B 标「已升」；否则保持「待」，等该页达 N×M 再批量升闸。  
4. 操作细节见操作手册 §3–§4。

## 5. 相关代码

| 路径 | 角色 |
|------|------|
| `lib/llm/pro/delivery/pipeline-v3/content-judgment.ts` | 批断枪 + 页 duty |
| `lib/llm/pro/delivery/pipeline-v3/body-prompt.ts` | 正文枪 + 页 duty |
| `lib/llm/pro/delivery/pipeline-v3/gate-phase-a.ts` | Phase A 形状闸 + early 类别汇总（不改稿） |
| `lib/llm/pro/delivery/pipeline-v3/gate-judgment-category.ts` | 批断已升闸类别机检 |
| `lib/llm/pro/delivery/pipeline-v3/gate-body-category.ts` | 正文已升闸类别机检 |
| `lib/llm/pro/delivery/pipeline-v3/page-feed-policy.ts` | **页级喂料白名单**（judgment/body 共用） |
| `lib/llm/pro/delivery/pipeline-v3/scrub-judgment-feed.ts` | 处方 scrub；未授权页剥奇门块 |
| `lib/llm/pro/delivery/lab/run-step-v3.ts` | Lab 执行；内容步挂 early 闸 |

## 6. 下一步（Lab 测稳后 · 已立案）

生产失败信号落地 → **闸门运维收集台**：见 `交付v3-闸门运维收集台-待建.md`（字段完整、形态薄、按周聚类修 prompt；禁自动抽奖重试）。

---

最后更新：2026-09-30 · P4正文#1人审不过：已拒兼职/交付物/引号升闸。




