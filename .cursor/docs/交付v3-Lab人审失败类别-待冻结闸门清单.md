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
| `p2j_no_lab_question_core` | P2 批断 core_conclusion 禁灌 Lab 议题原文（收集现象句诱回写） | 庚金内耗盘 core 灌收集长文 | `content-judgment` 中性 brief | 生成侧已修 |
| `p2j_collecting_symptom_tail` | claim/evidence 禁把收集症状当句末；停在张力词 | 四轴「行动反复/反复横跳/原地打转」 | duty 类别 | 待升（先生成侧） |
| `p2_polish_thin` | P2 润色不套 P3 相对加长；已完整机制段只合规+出语 | 庚金盘 zh 被 `1.15×` 误杀近义换词 | `body-polish` keep-if-ready | **尺错已修**（闸改为保量/拦抽瘦） |

| `p2_quoted_script` | 可见层禁引号分镜/强调壳（短词举例也去引号；含弯引号） | 庚金盘润色留「差一口气」等引号 | polish 合同 + **已升** `gate_p2_body_quoted_script`（本盘 zh #3 已清） |
| `p2_polish_cjk_len_on_en` | 非中文润色不以汉字 compactLen / 中文句号量译文 | 庚金盘 en 误杀 essence[0–3] 抽瘦 | `countReadableSentences` 认西文句号 + 译出不对拍汉字 | **尺错已修** |
| `p2_quoted_en_apostrophe` | 词中撇号（It's/don't）不当引号分镜 | 庚金盘 en #5 card[2] It's…doesn't 误杀 | `stripInWordApostrophes` + 撇号环视 | **尺错已修** |
| `p2_evi_slot_identity` | 依据软译槽内真词须与输入逐字相同（禁加字/减字/拆干支；禁多造槽） | 庚金盘 #2 槽内加字类（如干支叠字） | mark duty + **已升** `validateConnectiveWordSlots` makeup fail | **已升** `mark_slot_mutated` / `mark_slots_invented` |
| `p2_evi_empty_link_pad` | 槽间须本案因果白话；禁空衔接垫片把槽硬拼（C makeup 不当合格） | 庚金盘 #2 填缝套话过闸 | duty 空衔接类别 + **已升** 禁 C 修 | **已升** `mark_empty_link_pad` |
| `p2_evi_adjacent_noun_stack` | 连续真词无白话缝应收成一条叠词槽（含顿号列举）；槽间谓词缝须≥4字白话 | 庚金盘 #3/#4 wrap 贴死 / `⟧、⟦` | wrap 空缝+顿号叠槽 + 薄缝机检写入 user | **已升** wrap collapse |
| `p2_evi_adjacent_latin_locale` | 非中文软译槽缝不以汉字量尺（对照润色：西文不对拍 compactLen）；en≥4 字母因果白话 | 庚金盘 en #6 英文缝被 `countHanChars` 判贴死 | `hasAdjacent`/`term_stack` 按 locale；duty 2b + 薄缝英文化 | **尺错已修**（勿把本案英文字当禁表） |
| `p2_evi_term_stack_latin` | 非中文堆叠闸不对齐中文「≤2 槽 + 破堆≥8 汉字」硬套字母；西文短介词缝允许一跳，破堆用 2×相邻字母（8） | 庚金盘 en #7 `mark_term_stack:foundation:2`（appears at / and since 被 12 字母破堆误杀） | `maxTermMarkers` latin=3；`MIN_STACK_BREAK_LATIN=8` | **尺错已修** |
| `p2_evi_en_localize_han` | 非中文 encode 后禁把连接里的 fire/wood 等改成裸汉字五行；`localizeChartTokenForZh` 仅 zh | 庚金盘 en #8 机过、人审见 `supportive 火` / `That 火` | `gateEncodedSoftEvidence({ locale })` | **尺错已修** |
| `p2_evi_foreign_calque` | 外语槽缝须母语者口头白话（同正文润色人设）；禁中文缝一词一译；禁英文盘面家具（pillars/in your chart）；五行槽间禁一字生克动词 | 庚金盘 en #9 直译；#10/#14 `pillars`/`produces` | mark foreign persona + **已升** `mark_chart_furniture` / `mark_cycle_gloss` | **已升** |

**P2 润色 zh**：人审过。en #6 机闸+人审过（surface 口语到位；essence 仍略偏报告腔，不挡过）。**可点本步通过**（单语或英中皆可进 soft）。

**P2 依据③ evidence_soft**：zh #5 人审过。en #19 人审不过（机制英译 / nourishes the）。`finish_reason=length` 截断 → mark 上限回 20k；**已升** `finish_length` 供应侧续跑（新 270s invoke + escape）。**勿点本步通过**；准备重跑 en。

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
| `p3b_quoted_script` | 可见层禁可照念对话/分镜长引号（≥8 字）；短词举例引号不拦 | #3/#5 引号句；润色#2 误杀「酌情」「适当」→ 已收窄 | **归属 polish**（body defer） | **已升**（#2 收窄） |
| `p3b_vernacular_thicken` | strategy 2–4 句且相对草稿明显加长；means 1–2 句；禁同义换词交差 | Lab 润色仅换近义词、字数几乎不变 | **归属 polish** | **已升** `gate_p3_polish_thin_synonym` |

**P3 正文**：#8 机闸误杀（按次顾问+保住现职本属辅轨允许）→ 已收窄半投入换皮尺，duty/硬对齐改为路径闭集表。请重跑；人审仍看真准。

**止追漏**：已拒路径 / 时长节律 / 条款年数 三类事实尺已类别化；再翻车先查是否误杀，勿再加本案二字正则。

**润色试点**：`science_action.body_polish`；规格已钉厚度闸 `gate_p3_polish_thin_synonym`（同义换词不过）。请重跑润色步。

### 2.6 P4 批断 `content.judgment` · `metaphysics_action`

| ID | 类别（尺） | Lab 露出（仅溯源 · 勿当禁表） | 生成侧落点 | Phase B |
|----|------------|------------------------------|------------|---------|
| `p4j_situational_subject` | claim/evidence 禁处境议题尾巴作机制主语（权力分配/话语权/模糊条款/名分/权益整类） | #1 权力分配易被动；话语权模糊；模糊条款 | duty + 批断不灌 Q/E/收集 + moat `forJudgment` + 不灌 fill `eastern_calc` | **已升** `gate_judgment_situational_path_words`（含 metaphysics_action） |
| `p4j_half_imperative` | 禁半祈使收束（站位需…/需涵养/借势不争主导/试水·全职跳入处方） | #1 站位需涵养；#9「借势不争主导」 | duty + scrub 扩类 | **已升** `gate_p4_judgment_half_imperative`（#9 扩约束帧取向收束） |
| `p4j_feed_thin` | 批断只收总纲+Fact-pack 锁盘+moat 结构候选；禁 fill 派工多维处方墙 | #1 喂料含 multi_dim「以静制动/兼职试水」+收集事实 | `page-feed-policy` judgment 薄喂 + `metaphysics_moat_judgment_feed` | 喂料根修（非正则） |
| `p4j_means_ref_invented` | means_candidate_ref 必须抄派工闭集「时机/极性/角色候选N」；禁自造人设/张力标签 | #2 泄秀节律者/运岁近窗未熟/用神力量不足… | duty + coerce 钉死 + 闸 | **已升** `gate_p4_means_ref_invented` |
| `p4j_cite_prescription` | calc_cite 禁「需抑制/宜等待/加大投入」类处方尾巴；派工 cite 同源禁灌 | #2 dim3；#5 照抄派工「忌神火土需抑制」 | duty + cite 过滤器 + scrub + 闸 | **已升** `gate_p4_cite_prescription`（#5 源头：派工 cite） |
| `p4j_pillar_misanchor` | 同条十神禁既「藏于支」又「透干」；禁天干十神假写「藏于支」；禁「透干/当令」并列 | #2/#4/#6「偏印藏于年支」实年干透；「食神透干当令」 | duty + 派工 cite 透干钉死 | **已升** `gate_p4_judgment_pillar_misanchor`（#6 扩假藏） · `gate_p4_judgment_tougan_dangling` |
| `p4j_input_prescription` | 岁运/局势批断禁「加大投入/跳步加码/若强行推进」条件处方 | #4 加大投入；#6「此时若强行推进」 | duty + scrub + 半祈使闸并入 | **已升**（并入 `gate_p4_judgment_half_imperative`） |
| `p4j_tengod_formula_ban` | 禁十神吉凶套话承重（枭印夺食/偏印主孤/食神制杀必贵等）；只写动力·负荷·柱位张力 | #7 dim2「枭印夺食的潜在张力」 | duty + 闸 | **已升** `gate_p4_tengod_formula_ban` |
| `p4j_relation_false_fire_he` | 合冲刑害只引闭集原词；禁把午未六合等改写成「合火」 | #8 dim3/4「午未合火」 | duty + 闸 | **已升** `gate_p4_relation_false_fire_he` |
| `p4j_tongguan_false_weitou` | 「通关未立」禁改写「喜神金未透/通关金未透」（金已透干时尤忌） | #10 dim4「通关金（喜神）未透」实辛金透干 | duty + 闸 | **已升** `gate_p4_tongguan_false_weitou` |
| `p4j_tengod_mislabel` | 写「干(+五行)+十神」或「十神+干」时须与日主真算一致；禁正偏印/正偏财等同干互串 | 预防类（#11 人审核对真算后本盘丁=偏印/丙=正印未中） | duty + 闸（day_master） | **已升** `gate_p4_tengod_mislabel` |

**P4 批断**：#11 人审过——#10 通关假未透已清；干+十神与 `calculateTenGod` 一致（己日主：丁=偏印、丙=正印）；六 ref/moat 齐；停在张力词。N 计 1；差异盘 M。

### 2.7 P4 正文 `content.body` · `metaphysics_action`

| ID | 类别（尺） | Lab 露出（仅溯源） | 生成侧落点 | Phase B |
|----|------------|-------------------|------------|---------|
| `p4b_rejected_path_as_primary` | 收集已拒兼职/必须全职 → 禁「兼职试水/以·用兼职方式」进 name/strategy/means；改硬门槛下藏隐/结界 | #1 dim0；#3 dim3「用兼职的方式先试探」 | duty + 闸扩 | **已升** `gate_p4_body_rejected_path_as_primary`（#3 扩「用兼职」） |
| `p4b_p3_deliverable` | 站位/可见层禁交付成果·技术方案·**技术细节/路径/难点**·技术实现·交付节点·**项目节点/落地框架**·谈判筹码·**权益**·股权·**话语权**·找律师·谈条件等 P3·权责词族 | #1 谈判筹码；#2 权益/律师；#3 技术交付；#6「技术方案」；#9 dim5「争话语权」；**#13**「不碰权益的线」；**#15** dim2「技术细节」、dim3「项目节点/落地问题」；**#18–#19**「不展开技术细节」半否定换壳 | duty 允许轴正写 + 喂料去禁句 priming + 正文跳过 judgment scrub | **已升** `gate_p4_body_p3_deliverable`（#19：半否定仍拦） |
| `p4b_visible_jargon` | name/strategy/means 零用忌十神岁运/运岁/门星；**禁两五行并写**（火土/水土…）与「X旺」；奇门门宫/主客原名同禁 | #2–#5；#7 dim4「火土燥热成势」；#11 维名用神/食神/偏印/运岁/客来生主；#15「午时火旺」「借金气」 | duty + 闸扩门宫主客 | **已升** `gate_p4_body_visible_jargon`（#11：休门/客生主等；表面 defer 润色） |
| `p4b_quoted_script` | 可见层禁**任何引号字符**（含强调标签壳）；亦禁无引号开口/心里稿（就说/告诉他/心里默念/**提醒自己：**） | #1–#12；**#13**「出活的人」「全职核心」；提醒自己：心里稿 | duty + 闸 | **已升 · 正文硬拦**（#13：任意引号 + 提醒自己：） |
| `p4b_ritual_boilerplate` | 仪轨禁跨案养生模板（**深呼吸**+温凉饮+**背靠实墙整类**，不绑「几分钟」）；**不**拦本案自生长体态/结界 | #2 背靠实墙；#10 深呼吸几次；#11 dim0「背靠实墙」无计时漏闸 | duty + 闸扩 | **已升** `gate_p4_body_ritual_boilerplate`（#11：背靠实墙整类） |
| `p4b_materialized_water` | 气场调候禁液态水道具/洗脸补水当 means 主体（桌面水杯/凉水/盯水面/冷水洗脸/加湿器/喷泉） | #9 凉水桌面；#10「冷水洗一把脸」 | duty + 闸扩 | **已升** `gate_p4_body_materialized_water`（#10 扩冷水洗） |
| `p4b_means_metaphysical_action` | means 整页须读成玄学行为（时方窗/气场调候/结界仪轨白话）；挪到 P3 应违和；禁第二份 HR/科学执行页 | #2 手段偏职场沉默/养生模板；#3 仍夹技术模块提问/擦手机象征；#15 dim3「项目节点」谈判术 | duty + moat 时方种子 | **待**（人审尺 `p4b_means_not_xuan`；语义慎上正则） |
| `p4b_vernacular_moat` | 正文须大白话完整句可译；禁半文言四字电报；须与 P3 可区分（局/气/气口 vs 协议清单）；局势维须有奇门虚实感（零专名） | #1「结界护核/内守涵养」电报体；站位像职场壁垒；奇门感弱 | duty + moat 文风 | 待（人审尺；勿用本案二字正则） |
| `p4b_invented_schedule` | 缓冲/观察月数须来自收集；禁自造「留出N月」「N月观察期」；未给则写气口未熟/近窗未开节奏差 | **#14** dim3「留出三个月的观察期」（收集仅半年） | duty + 时长闭集扩类 | **已升** `gate_p4_body_invented_schedule`（#14） |
| `p4b_coach_jargon` | 禁职场教练腔/壁垒换皮（信息·专业·知识壁垒、**知识领地**、独立学习、深度研判） | **#15** dim5「知识领地」「独立学习」 | duty + 闸 | **已升** `gate_p4_body_coach_jargon`（#15） |

**P4 正文人审三问（means 玄学加厚后 · Lab #2 起重跑）**

1. **局势**：有敌虚实+气口，且 means 有因局而做的玄学动作（非纯职场沉默术）  
2. **意象**：有气场调候手段（白话五行/颜色/收势），非性格鸡汤  
3. **仪轨**：有时或方或结界动作，且删真算锚后垮；整页不像第二份 P3  

**P4 正文**：#19 仍 FAILED `p3_deliverable`——站位 means「不主动展开技术细节」半否定换壳。根因=duty/moat **禁句 priming**（教模型写禁词否定句）+ judgment scrub 把「宜守」改成「承压偏高」污染取向锚 + 正文仍灌十神SSOT「技艺」/人生阶段「谈交换」/direction_fit 谈判课。**本轮**：①站位允许轴只写正例主语；②半否定不算合格；③正文停灌十神/阶段SSOT与 direction_fit；④P4 正文跳过 judgment scrub；⑤scrub 删泄漏权责词。**勿点通过**；准备重跑。

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




