# Delivery Lab · 分步验收标准（活文档）

> **现行尺（2026-09-23 起 · 题材分工）**：因果仍是「先批断，再正文」。**P2 正文=批断白话**；**P3/P4/P5/P6 正文=可执行内容**（策略/行动/调频/熔断/出门），批断只作依据扎根——**禁止**再用「六页正文都是批断翻译」验收 P3+。旧的「一卡一词、mark 打标润色、金字 ≤3」**仍不作为放行条件**。放行与 `.cursor/docs/交付报告-先批断后正文-开发文档.md`、规则 `01-delivery-iron`、Canonical `pivot-八页交付验收标准.md` 一致。闸门定尺后主调模型输出，见同规则「闸门定尺」节。

## 现行验收（第一步）

本地算只做一件事：把推算钉在**这张主盘**上。围绕本盘的推算合格。不靠限制词条数防乱造。

有承重的卡片，顺序固定，不能反：

1. **先写命理批断**（依据折叠里的原文：多词、句读、钉本盘）。
2. **再写用户可见正文**（白话，零命理词）：
   - **P2**：正文 = 该条批断的白话翻译（表象/本质）。删掉批断后不得独自成立。
   - **P3+**：正文 = 可执行策略/行动/调频/熔断/出门；须对齐 P1 主辅与候选菜单；批断只扎根。禁止把互耗/生克链译成 strategy。删批断后不得变成谁都适用的鸡汤；删「合力/调节力/过载」类结构隐喻后若只剩空话 → 不合格。
3. **第一步不做**自造术语替换，也不把批断改成大白话连接。那是质量达标后的第二步。
4. **没有批断、或不适用批断的段落：不要依据折**，只给正文。

| 步 | 合格才放行 | 不合格就停 |
|----|------------|------------|
| Bootstrap / Thesis | 盘能解析；总纲与 structured 对得上 | 词不是这张盘的 |
| Prealloc / assign | 喂给模型的是本盘实算词，且够写一段批断 | 只有 1 个锁词还放行 |
| write / write.merge | 无标记多词批断；只证本卡主张；合冲须带地支对（禁裸「半合」）；生克落闭集表；地支十神用本气；无白话尾巴 | 半合无地支对；主张外合冲/相刑；生克写反；处境/职业白话 |
| fill · P2 | 表象/本质是该条批断的翻译，零命理词 | 正文与批断无关，或出现命理词 |
| fill · P3+ | 可执行正文 + 零命理词；能回溯菜单/主辅；删批断不变鸡汤 | 机制译顶替策略；空鸡汤；与 P1 主辅脱节 |
| mark | 依据仍是原样批断 | 被打成软标或改写成白话 |
| P1 fill | 直答问题；没有先写的批断就不挂依据；须在 P3 deep 之前 ready | 空挂一段依据；P3/P4 用旧 breakthrough 顶替 |
| assemble | 六页通读；有依据的卡片：折里是批断；P2 正文=译，其余页正文可执行且被依据支撑 | 依据只是多一段正文；或拿「正文必须是翻译」卡死合格 P3 |

Lab 页每一步标题下会显示同一句「本步合格」。用旧盘逐步跑，看输出，**不合格就改提示词/喂词后再跑这一步，不要跳到下一步碰运气**（铁律「因果链 · 达标推进」：交付是上下因果链，本步不达标则下游质量无法保证；闸过但人眼见类别瑕疵亦禁点「本步通过」）。

旧流水账（F/P 签字、一卡一词、mark 金字密度）**不再生效**。

---



> **用途**：Lab 30 步每步「什么叫够格可放行 / 什么必须当场拦 / 踩过什么坑 / 以后怎么优化」。  

> **原则**：一步步收紧，不追求单层文案完美；**往下游传的事实必须站得住**；呈现层可记后修。  

> **维护纪律**：每步肉眼签或穿闸后，**同日**追加「问题 / 解法 / 回归 / 后续」；禁止只口头记。  

> **相关**：`delivery-lab-逐步生成查验台.md` · **参考尺** `Delivery-Lab-30步分步验收标准.md`（逐步过程）· `六页交付内容质量验收标准.md`（内容）· Canonical `pivot-八页交付验收标准.md` · **设盘手册** `delivery-lab-全面挖掘案例矩阵.md`（多用户×困境触发维）· `D1-closed-menu-assign-复盘与换链路方案.md` · 规则 `11`  

> **本文用途不变**：活文档——F/P 签字、踩坑、回归登记；参考尺不管流水账。



---



## 0. 怎么用（放行 vs 当场拦）



| 类型 | 定义 | 动作 |

|------|------|------|

| **F 事实层** | 会进入下游当作真的东西：总纲 present、slug/维、菜单锁定、施事关系、错维引用 | **不过不放行**；修到可回归再过 |

| **P 呈现层** | 只影响本层读感：句模雷同、unit_claim 薄、why 偏短、文风板 | **可放行**；写入「后续优化」，不阻塞游标 |

| **O 运维噪声** | OpenRouter `retryable`、413、cancelled（预算） | 不当事质；另记 ops — **但「设计上必撞超时」不算噪声，必须改架构** |



**已修 O（不可靠设计）**



| 日期 | 问题 | 解法 |

|------|------|------|

| 2026-09-10 | Lab P2 write 5 卡塞进一个 300s → 504 | **分发**：每次 run 只 1 chunk×270s；客户端自动续跑下一块（多次独立 invoke） |

| 2026-09-10 | 全链路仍有「一 invoke 多 LLM」遗漏 | 规则 **12**；write/mark 分发；禁止 packed finalize/mark-all-pages；禁 finalize 后同 invoke 塞 P1 |

| 2026-09-10 | 无因果 chunk 应齐飞（间隔 ~1s） | 备忘 `.cursor/docs/delivery-dispatch-并行分发备忘.md`；DAG write+mark.cN+scheduler ✅；finalize 每 group 一 invoke ✅；Lab 仍串行续跑 |



### 分发审计表（2026-09-10 · 修订）



| 路径 | 状态 |

|------|------|

| DAG `write_chunk` + scheduler stagger 1s | ✅ 真并行（独立 invoke） |

| DAG `mark_chunk` + `mark.merge`（fill 后 expand） | ✅ 与 write 同构齐飞 |

| Lab write 多 POST | ⚠ 独立 invoke + **串行** auto-continue |

| Lab mark | ✅ 一点 → plan → stagger 齐飞 cN → merge |

| segment-chain write/mark soft-wall | ⚠ 遗留串行；正式走 DAG |

| packed finalize / mark-all-pages | ✅ fail-closed |

| finalize stage | ✅ **每 group 一 invoke**（`waveSize=1` + handoff） |

| finalize→同窗 pack P1 | ✅ 已删 |

| legacy evidence 多 chunk | ✅ >1 chunk fail-closed |



详见：`delivery-dispatch-并行分发备忘.md` · 规则 `12`。



**闸门绿 ≠ 签字。** 签字 = 本节 F 项全过 + 回归集绿（若有）+ 本步 P 项已登记（若有）。



**回归优先于新盘赌运气**：改检测/菜单/总纲后，先跑该步挂名的 fixture/脚本，再 Lab 肉眼。



---



## 1. 步骤索引（30 步 · 旧表，仅档案）

> 放行不要看这张表的「F 底线」。看文首「现行验收」。step_key 没变，Lab 上的标题和合格句已换成新尺。



| # | step_key | 状态 | F 底线摘要 | 回归 |

|---|----------|------|------------|------|

| 1 | `bootstrap` | 骨架 | 盘/问题可解析 | — |

| 2 | `thesis.gen` | **有尺** | 六维 present 可验；藏干不漏 | 总纲双议题 / 藏干正反例 |

| 3 | `prealloc` | **有尺·已修根** | 只从总纲 menu 取词；grounded 闸 | `test-prealloc-thesis-menu` |

| 4 | `foundation.assign` | **已签（第三方）** | closed-menu + 无第三方施事 | `test-third-party-agency-gate` |

| 5 | `foundation.write` | **闸已接** | evidence 不得把本盘写成第三者心理/施事；软修+分层句模 | `test-third-party-agency-gate`（含 write 负例） |

| 6 | `foundation.write_merge` | **有尺·已签有条件** | 合并不丢锁词；P 继承 write | — |

| 7 | `foundation.fill` | **有尺** | 只压缩不新判；末卡主辅收束；不丢 write 限定 | 八页尺 |



| 8 | `foundation.mark` | **有尺** | 闭集打标；无空树；P 已登记不挡 unlock | 相邻金字 / 双盘肉眼 |

| 9–13 | P3 `science_action.*` | **assign closed-menu** | 深页闭集锁锚；禁 free-select 拖满 270s | `test-closed-menu-assign` |

| 14–18 | P4 `metaphysics_action.*` | **整页已签·有条件** | assign→mark；格局壳/#7；means 密度 P；mark body 派工腔 | `test-closed-menu-assign` |

| 19 | `direct_answer.fill` | **有尺·已签有条件** | 正面直答+主辅；贴题；不代做合同 | 八页尺 P1 |

| 20–24 | P5 `risk_guard.*` | **整页已签·有条件** | assign→mark；金字叠挂/FALLBACK 起句 P | `test-deep-evidence-assign` |

| 25–29 | P6 `signals_close.*` | **整页已签·有条件** | assign→mark；近7日月表腔 P；跨页 fill 闸已修 | `test-deep-evidence-assign` / `test-cross-page-primary-reuse` |

| 30 | `book.assemble` | **已签·有条件** | 六页齐；预览可通读；Lab 仅 dump fill JSON | 八页尺 |



状态词：**骨架** = 仅有最小 F；**有尺** = 已写清；**已签** = 至少一维缺陷已双盘签字；**待填** = 尚未走完漏桶轮。



---



## 2. 分步卡片（有内容的先写满）



### 2.1 `thesis.gen` · 命盘总纲



**F 必须过**



- [ ] 六维齐全；absent 才写「不明显」，禁止有料装无料  

- [ ] 藏干兼藏根气进对应维（尤其 `resource_pattern`）  

- [ ] 神煞/长生未扩维前不进承重 present  

- [ ] 与 `structured` 对照：不是只读最终通顺句  



**P 可后修**：结论句文风、hints 密度。



**已登记问题**



| 日期 | 问题 | 类 | 解法 | 回归 | 后续 |

|------|------|----|------|------|------|

| （既有） | resource 漏藏干正财 | F | 总纲兼藏根气修复 | 藏干正反例 | 保持 |

| （既有） | 金舆语义/影子池 | F | 未扩维不进菜单；禁影子 prefer | 菜单/thesis 测 | Phase E 另议 |



---



### 2.2 `prealloc` · 全书 primary



**F 必须过**



- [ ] 跨页 primary 复用不超过 cap  

- [ ] **池 SSOT = `buildThesisAssignMenu`（总纲 present）**；禁止 inventory/神煞/十二长生/历史大运入 `all_primaries`  

- [ ] 每项 primary 能在六维 present **精确**核实（关系 kind 一致：`相刑`≠`相害`）  

- [ ] 候选不足 → `sparse_mode` / 减槽，**禁止**退回大 inventory 凑数  



**P**：稀疏页少卡可接受；菜单薄词（见下表）不挡 unlock，P2 assign 若锁成主承重则升级。



**签字 / 已登记**



| 日期 | Lab/盘 | 结果 | 备注 |

|------|--------|------|------|

| 2026-09-16 | 乙木·career 重测（fp `03919c2d…`） | **闸过 · 人工质量不及格（影子池）→ 已修根** | 旧输出见下行 F |

| 2026-09-16 | 同盘重开 Lab · Thesis+Prealloc | **闸过 · 质量有条件** | `pool_source=thesis_menu` unique=23 grounded；无金舆/相害/元男；薄词 → 下行 P |

| 2026-09-17 | 乙木·relationship（fp `1d592e5c…`）男友/离职 | **闸过 · 质量有条件 · unlock P** | thesis_menu unique=25 grounded；reuse 乙庚合×2=cap；无格局/裸六合/元女；**P**：risk 木火土水 + meta 金 裸五行；→ foundation.assign |



| 日期 | 问题 | 类 | 解法 | 回归 | 后续 |

|------|------|----|------|------|------|

| 2026-09-16 | Prealloc 从 104 词 inventory 灌槽：金舆/长生/辛丑/巳寅相害/元男等影子；下游 `filterPreferMapToThesis` 只是后挪闸 | **F** | `preallocateChartPrimaries` **只读** `buildThesisAssignMenu`；Lab gate 校验 grounded；生产 `ensureJobChartPrimaryPrealloc` 读 job thesis | `test-prealloc-thesis-menu` | 已验：重开 Lab `thesis_menu` |

| 2026-09-16 | `巳寅相害`≠总纲`巳寅相刑`（关系 kind 抄错） | **F** | 同上：只引用总纲原文关系句 | 同上 | — |

| 2026-09-16 | `辛丑` 历史大运未进 cycle present 却入池 | **F** | 菜单只暴露 cycle present → 天然无历史步 | 同上 | — |

| 2026-09-16 | `元男` = 日柱十神槽占位，非承重信号 | **F** | `isAssignMenuEligibleSlug` 禁 元男/元女/日元 | 同上 | — |

| 2026-09-16 | `日主乙庚相合合化金` 真算有、总纲缺干合项 | **F→已补** | `day_master_strength.stem_he` 检查项（natal `stem_he`） | `test-prealloc-thesis-menu` live 盘 | 勿当影子永久丢弃 |

| 2026-09-16 | 菜单抽词偏薄：裸 **`六合`**（岁运酉辰六合截短；natal 合局为未见）入 foundation prefer | **P** | 不挡；优先最长完整关系句 | — | **方案 A #7**；P2 若锁成主承重 → 升 F |

| 2026-09-16 | 菜单抽词偏薄：叙述壳 **`格局`** 入 risk prefer | **P** | 不挡；禁叙述壳入 menu / 或 refine 掉 | — | **方案 A #7** |

| 2026-09-16 | 菜单抽词偏薄：裸五行 **金/木/火/土/水** 占 risk/signals 槽 | **P** | 不挡；用神维保留具体「用神水」类，禁孤立单字五行优先占槽 | — | **方案 A #7** |

| 2026-09-16 | 菜单抽词偏薄：裸柱 **乙巳/丁巳/庚辰/壬寅** 占科学辅轨/东方维 | **P→已修** | 不挡；优先十神/刑冲/干合再柱干支 | — | **方案 A #7**：菜单禁非 cycle 裸柱；cycle_ganzhi 不再误伤日柱 |



---





### 2.3 `foundation.assign` · P2 派工（D1 + 第三方）



**F 必须过**



- [ ] closed-menu：slug+`dimension_id` 来自总纲菜单；页内主词唯一；条数=锁定数  

- [ ] **无第三方施事**：解释层（inference/role/why）中，agenda 已知第三方不作动作主体；允许话题/宾语框（与男友的关系议题、加入旧部的盘子）  

- [ ] 禁意愿词表打地鼠；改检测对象 = 施事/话题框（见 `third-party-agency.ts`）  

- [ ] slug 维归属与总纲一致（如 巳寅相刑 → `day_master_strength`）  

- [ ] 删依据：该卡推论应对**本 slug** 专属（见下 P 项例外）  



**P 可放行（已登记）**



- [ ] 关系/合作句模导致多卡 inference 雷同  

- [ ] `unit_claim` 薄粘贴（「此表象说明结构上：」+ cite）  

- [ ] why_needed 偏短  

- [ ] 表象候选 label/answer 错配（菜单绑歪）— **若错配导致 F 事实错误则升级为 F** · **方案 A #3 已修**（`prefer_cite_must_match` + 禁 wrap-reuse；待新 Lab 验）



**签字记录**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-10 | `lab_mtvapkdl_…` 盘1 乙木/创业 | **第三方维签字** | #12；合作句模雷同记 P |

| 2026-09-10 | 盘2 焦虑/男友 | **第三方维签字** | 卡3 子未相害不再推男友施事；cite 标题错配记 P |

| 2026-09-16 | 乙木·career 重开（制造业/新能源邀约） | **闸过 · 质量有条件** | closed-menu+无第三方施事；卡3 六合 inference 空壳孪生；卡0 soft 腔 — 见下行 P |

| 2026-09-17 | 乙木·relationship（fp `1d592e5c…`） | **闸过 · 质量有条件 · unlock P** | closed-menu 5=锁；inference/role/why **无男友施事**；**P**：卡2/3 cite label↔answer 仍错配（#3 菜单源）；卡3 claim「男友反对…在于子未相害」write 禁放大；→ write |

| 2026-09-20 | 合伙·session `3cf20b08…` assign #3 | **闸过 · 质量有条件 · unlock → write** | 主锚食神/正印/午丑相害/正财/寅午半合对齐技术/律师/拒绝全职/安家/收入；拒绝卡走合作宫非「难开口」；**P**：食神/正印 `dimension_id` 仍可错标 `day_master_strength`；claim「本卡须证明」壳交 write/fill |



**已登记问题**



| 日期 | 问题 | 类 | 解法 | 回归 | 后续 |

|------|------|----|------|------|------|

| 2026-09 | 开放选词漏桶 | F | D1 closed-menu | `test-closed-menu-assign` | 选词层**闭合停投** |

| 2026-09 | 伙伴期望 / 男友反对 | F | 施事者闸 + 关系/合作分层句模 | `scripts/fixtures/third-party-attr/` + `test-third-party-agency-gate` | 新穿闸→入库 |

| 2026-09-10 | 「你让男友…抵触」主语绕写 | F | 使役结构也算施事 | fixture `03-querent-subject-bypass` | — |

| 2026-09-10 | 亲密句模焊到创业伙伴 | P→修 | 亲密/合作 surface 分流 | agency 测内断言 | — |

| 2026-09-10 | 比肩/六合 inference 逐字同模 | **P** | 已知权衡；不挡签 | — | **方案 A claim_seed** 优先消 |

| 2026-09-10 | unit_claim 薄粘贴 | P | softPolish 未打干净 | — | 确定性重写 claim |

| 2026-09-10 | 盘2 表象 label/answer 错配 | P→**已修** | `prefer_cite_must_match` + 表象禁 wrap-reuse | `test-deep-evidence-assign` | 方案 A #3；新 Lab 再签 |

| 2026-09-10 | 盘2 write 卡3 子未相害 | **F** | assign 已过；write 又写「伴侣…价值否定」「男友的反对…是子未相害」 | **write 接施事软修+句模焊**；fixture `04-write-boyfriend-value-negation` | Lab **准备重跑** write 再签 |

| 2026-09-16 | 卡3 锁裸 **`六合`**：claim 已写「辰酉六合」，但 `inference_zh` 沦为卡0同款 soft「绑定与投入压力」，与人脉/硬功夫 claim **不对题** | **P**（逼近 F） | 不挡 unlock；不 LLM 重试 | — | **方案 A #7**；write 盯是否放大空壳；若删依据仍垮不了 → 升 F 修菜单+句模 |

| 2026-09-16 | 卡0 干合：claim 较满，inference/why 偏 soft 配合位句模 | **P** | 不挡 | — | 方案 A #1/#2 |

| 2026-09-16 | 卡1 比肩、卡2 正财、卡4 巳寅相刑：承重与表象配对可用 | — | 正向样本 | — | 可作 fixture |

| 2026-09-20 | 合伙盘：食神/正印 slug 对、**`dimension_id` 仍错落 `day_master_strength`**（应为 expression / resource 等总纲维） | **P** | 不挡 unlock；slug 承重可用 | `test-foundation-surface-primary` | **方案 A #8**：restamp/维归属按菜单维，勿默认 day_master |

| 2026-09-20 | 合伙盘：`unit_claim` 仍可残留「本卡须证明：…」派工壳 | **P** | write softRepair 已扩识别；assign 侧未 scrub | agency gate | **方案 A #9**：assign polish 同步 scrub 派工壳 claim |

**本步命令**



```bash

pnpm exec tsx scripts/test-third-party-agency-gate.ts

pnpm exec tsx scripts/test-closed-menu-assign.ts

pnpm exec tsx scripts/test-thesis-gap-coverage.ts

```



---



### 2.3b `foundation.write` · P2 专写



**F 必须过**



- [ ] evidence 解释层：**不得**用本盘信号断言第三者心理/施事（与 assign 同尺）  

- [ ] 可复述收集事实作背景，但机制句主语须落在「你」  

- [ ] 须展开 locked `inference_zh` / **unit_claim**，禁止写成「男友反对是因为子未相害」  

- [ ] **句读深度（与 merge 同尺）**：evidence 用 `。！？；` 分成 ≥2 段；仅逗号串一句 = `deep_evidence_shallow` → **本步 fail**（chunk 内允许 1 次 LLM 纠错，禁止软修凑句）  

- [ ] Lab write 齐套后跑 `assessDeepEvidenceQuality`；不过则 write gate 红，不得假绿进 merge  

- [ ] 代码：`polishWriteChunkUnits` / third_party 软修；深度不过走纠错 prompt；仍脏则显式 fail（不无限重试）



**签字记录**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-10 | 盘1 乙木/创业 | 有条件过 | 卡3 踩线复述伙伴要求，机制仍落你侧 |

| 2026-09-10 | 盘2 焦虑/男友 | **不过→已修闸** | 卡3 回潮；请重跑 write 再签 |

| 2026-09-16 | 乙木·career 重开 | **闸曾假绿 · 质量有条件** | 旧 write 卡1/卡3 单句 → merge shallow；已修深度闸 |

| 2026-09-16 | 同上 attempt#10 | **闸过 · 质量有条件** | quality ok；卡1/2/3/4 承重可用；**卡0 仍 soft 配合位套话**未展 claim → P；可 unlock→merge |

| 2026-09-17 | 乙木·relationship #5 | **闸过 · 质量有条件 · unlock P** | quality ok；卡0/4 展 claim；evidence **无第三方施事**；**P→逼近F**：卡3 全文≈「就你侧…」软模（任意亲密摩擦卡会复发）；unit_claim 仍「第三方反对…在于信号」未软修；cite 错配继承；→ merge |

| 2026-09-20 | 合伙·`3cf20b08…` write #10 | **闸过 · 质量有条件 · unlock → merge** | quality ok；卡2 已展路径句（非空壳+「本卡须证明」）；**P**：卡0/2 evidence 末仍粘贴 `label: answer` 整行 cite（expand `pushUnique(cite)`） |



**已登记问题（本步）**



| 日期 | 问题 | 类 | 解法 | 回归 | 后续 |

|------|------|----|------|------|------|

| 2026-09-16 | 卡3 `六合`：claim=辰酉六合→人脉硬功夫，evidence 仅 soft「绑定与投入压力」 | **P→逼近 F** | write 提示强制展 claim | `test-deep-write-depth-gate` | **#10 已改善**（人脉/六合化金入 evidence）；残「绑定压力」句可后修 |

| 2026-09-16 | 卡0 干合：evidence≈配合位 soft，未展开 claim 的邀约/官杀绑定/降薪 | **P** | 提示已禁套话；#10 **仍复发** | 同上 | 方案 A #1/#2；不挡 unlock；fill/成书抽检盯卡0 |

| 2026-09-16 | 卡1 单句逗号串 → merge shallow | **F** | 句读尺+chunk/Lab 闸 | 同上 | **#10 已过** |

| 2026-09-16 | 卡1 比肩、卡2 正财、卡4 巳寅相刑（#10） | — | 正向 | — | — |

| 2026-09-17 | **全局** softRepair 后 evidence 可整段落成「就你侧的结构感受而言…」摩擦模，未再扣 calc_cite/claim | **F→已修** | 扩写 claim/cite；壳=`still_dirty`+`deep_evidence_friction_shell` | agency + depth gate | P5 relationship write#6 触发 |

| 2026-09-17 | **全局** `unit_claim` 仍可留「第三方反对/要求…在于本盘信号」；只修了 evidence | **P** | assign/write polish 对 unit_claim 同步 `softRepairThirdPartyAgencyProse` | agency gate 扩测 claim 字段 | 换盘换第三方都要过 |

| 2026-09-17 | **全局** 表象 label↔answer 错配进 write（菜单源） | **P** | 候选生成时校验 label/answer 语义重叠；错配不进 prefer_cite | foundation surface 测 | #3 未闭环 |

| 2026-09-20 | **全局** `expandWriteEvidencePastFrictionShell` 把 `calc_cite` **整段** `pushUnique(cite)` 推进 evidence → 卡末出现「对方对兼职的反应: …」「技术输出是本命: …」等 **label: answer 粘贴** | **P** | 不挡 unlock；#10 已过闸 | `test-third-party-agency-gate` 扩负例 | **方案 A #10**：expand 只抽机制/关键词，禁整行 cite；或先拆 `label`/`answer` 再拼白话 |

| 2026-09-20 | 合伙 write#5：摩擦壳+「本卡须证明」黏贴 → #10 已扩 `isWriteFrictionShellEvidence` + scrub | **F→已修** | 壳识别 + expand 路径句 | agency gate | 盯 #10 残 cite dump（上条） |



**命令**：同 §2.3（含 write 负例）+ `pnpm exec tsx scripts/test-deep-write-depth-gate.ts`。



---



### 2.3b2 `foundation.write_merge` · P2 合质



**F 必须过**



- [ ] `assessDeepEvidenceQuality` 过（浅度/锚点/回声/复用 cap）  

- [ ] 合并不静默丢锁词；无凭空软修编造  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-16 | 乙木·career 重开 #2 | **闸过** | 与 write#10 同稿；sim=0.04 无回声；卡0 soft 仍 P（不挡） |

| 2026-09-17 | 乙木·relationship | **闸过 · unlock P** | 与 write#5 同稿；sim=0.07；卡3 软模/claim 施事/cite 错配继承 → fill |

| 2026-09-20 | 合伙·`3cf20b08…` | **闸过 · unlock → fill** | 与 write#10 同稿；sim=0.08@卡2↔4；anchor=0；reuse_cap=2；5 锁词齐、无静默丢锚；**P 继承**：卡0/2 cite 整行粘贴、claim「本卡须证明」壳（方案 A #9/#10） |



---



### 2.3b3 `foundation.fill` · P2 压缩



**F 必须过**



- [ ] 只做呈现压缩，不引入 write 没有的新判断  

- [ ] why_cards ≥4；末卡收束主辅成立  

- [ ] 无第三方施事；无替执行 / 月路线图  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-16 | 乙木·career 重开 | **闸过 · 质量有条件** | 5 卡 surface/essence 齐；末卡主辅收束；`evidence=[]` 常态（mark 挂）；卡0 soft 继承 write；卡3/4 essence 略稀释 → P |

| 2026-09-17 | 乙木·relationship | **质量 F 不及格 · 勿 unlock** | 卡3 essence「导致男友/家人反对」穿闸；**全局已修**：sanitize soft-repair essence + residual fail；assign 同步修 unit_claim；**准备重跑 fill** |

| 2026-09-17 | 同上 fill#2 | **闸过 · 质量有条件 · unlock P** | essence **无**第三方施事；surface 可复述反对事实；5 卡+末卡主辅；卡3 偏软模句；cite 错配债仍在 → mark |

| 2026-09-20 | 合伙·`3cf20b08…` fill | **闸过 · 质量有条件 · unlock → mark** | attempts=2（#1 `why_card_essence_too_thin` 黄警→纠错过闸，属 1+1 允许）；5 卡+末卡兼职试水收束；essence **无**第三方施事；surface 可复述拒绝事实；**P**：卡2 essence 仍最短/配合位软模；用户层少点十神专名（靠 mark 锚） |



**已登记**



| 日期 | 问题 | 类 | 后续 |

|------|------|----|------|

| 2026-09-16 | 卡0 essence「配合位置」软腔，未点干合/官杀绑定（用户层） | **P** | 同 write 卡0；mark 依据层仍有锚 |

| 2026-09-16 | 卡3/4 essence 偏「能量结构」概括，六合化金/寅巳刑细节略丢 | **P** | 不挡；mark 用 plan evidence 补 |

| 2026-09-17 | **全局** fill essence 可写「导致第三方反对/要求」；gate 曾假绿 | **F→已修** | `sanitize` soft-repair + `third_party_agency_in_essence`；回归 `test-third-party-agency-gate`；部署后重跑 fill |

| 2026-09-20 | 合伙 fill#1 卡2 essence `<60` → 黄警 `why_card_essence_too_thin`；#2 过闸 | **O/P** | 设计内 1+1 纠错，非空转；最终稿卡2 仍偏短软模 | 不挡 unlock；fill 提示可点名午丑相害机制（勿只写配合位） |



---



### 2.3c `foundation.mark` · P2 打标+polish



**F 必须过**



- [ ] 每卡非空 evidence；闭集 `⟦t:slug|软译|语境⟧`；无空 `{}` 假过  

- [ ] 无相邻贴金硬挂 / 槽外命理短词墙（闸门级）  

- [ ] Lab gate PASSED（含 fanout merge 齐套）



**P 可后修（不挡 unlock · 不 LLM 重试）**



- [ ] 同一卡内 **重复同 slug 金字**（双酉、双比肩空挂）  

- [ ] 连接垫词过薄（「同时对应 / 以及这里」）  

- [ ] **cite/题面错配**从 write 流入（卡标题≠收集表象）  

- [ ] 末卡删依据后仍偏普适心理（承重弱）  

- [ ] 多卡句模孪生（与 assign/write 同债）



**签字记录**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-16 | 乙木·career 重开 #2 | **闸过 · 质量有条件** | 5 卡 evidence 非空闭集；merge 2 chunks；卡1–3 单锚干净；卡0 六金串+薄垫；卡4 三金+「同时对应」→ P；body 卡0/4 承重够 |

| 2026-09-10 | 盘1 乙木/创业 | **闸过 · 质量不签** | 卡2∥4 句模孪生；末卡承重弱 → P |

| 2026-09-10 | 盘2 焦虑/男友 | **闸过 · 质量不签** | 双酉/双比肩重复金字；卡3/4 cite 错配；末卡软 → P |

| 2026-09-17 | 乙木·relationship | **闸红 · 勿 unlock** | `mark_adjacent_soft_gold:foundation:0`×2；**全局根**：垫语「并落到/再对照」仅 3 汉字 < MIN=4，soft-gloss 去回声后软修仍假红；已加长垫语；回归邻金测；**准备重跑 mark** |

| 2026-09-17 | 同上 mark#3 | **闸过 · 质量有条件 · unlock P** | merge 2 chunks；闭集齐；**P**：卡0 六金+软修垫语墙；卡1 双 bi_jian；卡3 body 仍「男友反对…在于」/evidence 你侧干净；卡2/4 正向 → science |

| 2026-09-20 | 合伙·`3cf20b08…` mark#2 | **闸过 · 质量有条件 · unlock → P3** | merge 2 chunks；5 卡闭集齐（食神/正印/害/正财/半合）；无邻金/空树；**P**：body 全卡「本卡须证明」派工壳（#9）；卡2 `hai` 软译「潜耗」墙偏长；末卡 `banhe` 配合位句模继承 |



**已登记问题**



| 日期 | 问题 | 类 | 解法 | 回归 | 后续 |

|------|------|----|------|------|------|

| 2026-09-16 | 卡0 六金连挂 +「同时对应/以及这里/与此相关/并在此处」薄垫 | **P→已修** | `dedupeSameCardWordSlots` + 禁垫表 | `test-delivery-mark-adjacent-gold` | soft-repair；新 Lab 再签 |

| 2026-09-16 | 卡4 si∥yin∥xing 仍「同时对应/以及这里」 | **P→已修** | 同上 | 同上 | soft-repair |

| 2026-09-16 | 卡0 evidence「配合的位置」vs body 官杀绑定（双层不一致） | **P** | 同 write/fill 卡0；body 已够承重 | — | 方案 A #1 |

| 2026-09-10 | mark 同卡重复 slug 金字 | **P→已修** | encode 前同卡去重 | `test-delivery-mark-adjacent-gold` | 方案 A #4 |

| 2026-09-10 | mark 仍吃 write cite 错配 | **P** | 不修 mark；修 foundation 表象配对 + write | `test-deep-evidence-assign` | **方案 A #3 已修**；新 Lab 再签 |

| 2026-09-10 | 末卡 `shi_shen`/metal 承重弱 | **P** | 末卡种子绑主辅锚 | — | fill/末卡 prompt |

| 2026-09-10 | 盘1 卡2∥4 配合句模孪生 | **P** | 同 assign 比肩/六合同模债 | — | 方案 A #1 claim_seed |

| 2026-09-17 | **全局** `mark_adjacent_soft_gold`：soft-gloss 去回声后 `⟧⟦`，垫语池含 3 字「并落到/再对照」< MIN=4 → 软修假红、LLM 空转 1+1 | **F→已修** | 垫语加长 ≥4 汉字；邻金测覆盖 | `test-delivery-mark-adjacent-gold` | 部署后重跑 mark |

| 2026-09-20 | 合伙 mark：body 仍整段「本卡须证明：…」派工腔（未 scrub claim 壳） | **P** | 不挡；polish body 应 scrub 派工壳或改用 fill title | — | **方案 A #9** 扩到 mark body |

| 2026-09-20 | 卡2 午丑相害→闭集 `hai` OK；软译「潜耗…慢性内耗」百科墙偏长 | **P** | 不挡 | — | 软译截短 / 同卡去百科尾 |

| 2026-09-17 | 卡0 复合锚拆成 6×`⟦t:⟧` + 轮换软修垫语墙（闸过邻金但仍难读） | **P→逼近 F→部分已修** | `resolveRelationCompoundSlug`：午未六合/子辰半合/乙庚合等 → 单金字；日主辛金类仍可 peel | `test-delivery-code-mark-completeness` | 叠金软修垫仍可后盯 |

| 2026-09-17 | 卡1 双 `bi_jian`；卡3 mark **body** 仍第三方因果句（evidence 已你侧） | **P** | body 同步 agency soft-repair；#4 去重尾挂 | agency + mark 测 | 全局 |



---



### 2.3d `science_action.assign` · P3 派工



**F 必须过**



- [ ] D1 **closed-menu**（slug/dim 代码锁死；禁 free-select）  

- [ ] 270s 内正常 STOP；`llm_timeout` = 结构失败（不 LLM 空转重试）  

- [ ] closed-menu `max_tokens` ≤ 8k；超时仍 `PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS`（270s）



**P 可后修（不挡 unlock · 不 LLM 重试）**



- [ ] 辅轨多角 **unit_claim 同模**（三卡同一段「暂守原职…」）  

- [ ] 比肩/合作句模软修腔（与 P2 同债）



### 2.3d2 `science_action.write` · P3 专写



**F 必须过**



- [ ] 6 角 = 6 次独立 invoke（一 chunk 一枪）；齐套后再 `assessDeepEvidenceQuality`  

- [ ] 跨页 primary Jaccard < 0.72 **或** 出现 prior 未有的 anchor category  

- [ ] 页内 evidence 回声 / anchor Jaccard 过闸  



**说明**：Lab「已分发 N/6」是续跑中间态；OpenRouter 出现 6 次调用 = 正常。合质失败时 progress 应为 6/6 + `quality_fail`，不是少调一枪。



**签字 / 问题**：见上表 §2.3d（同页登记）。



**签字（本步）**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-16 | 乙木·career 重开 #12 | **闸过 · 质量有条件** | 6/6；cross_page jaccard=**0.00**（修根验过）；页内 sim=0.34；主轨三机制可删垮；辅轨同药方继承 assign #5 → P；不挡 unlock merge |

| 2026-09-16 | 同上 · write_merge | **闸过** | 与 write#12 同稿；sim=0.34；cross_page jaccard=0.00；无静默丢锁；辅轨 #5 P 不挡 → unlock fill |

| 2026-09-17 | 乙木·relationship #6 | **闸过 · 质量有条件 · unlock P** | 6/6；cross=0.00；sim=0.17；主0/2+辅2 展 claim；**P→逼近F**：主1 全文=「就本案表象…」摩擦模（与 claim 沟通/软化相反）；辅0/1 仍吃三同《易经》cite → merge |

| 2026-09-17 | 同上 · write_merge | **闸过 · unlock P** | 与 write#6 同稿；cross=0.00；主1/辅 cite 债继承 → fill |

| 2026-09-20 | 合伙·`3cf20b08…` write#6 | **闸过 · 质量有条件 · unlock → merge** | 6/6；sim=0.07；anchor=0；cross=0.00；主0 **已按伤官展**（assign #11 错位未放大）；主1/2+辅2 可删垮。**P→逼近F**：辅0 evidence≈一句摩擦壳+神煞名单；主0/2 仍 cite/「本维须证明」粘贴；辅1 多金字墙 |

| 2026-09-20 | 同上 · write_merge | **闸过 · unlock → fill** | 与 write#6 同稿；sim=0.07；cross=0；`cross_page_new_category`；无静默丢锁；辅0 #12 P 继承 |










---



**签字记录**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-16 | 乙木·career 重开 | **闸过 · 质量有条件** | closed-menu units=6；主轨三角 claim 分化 OK（试水/内部再平衡/能量优先）；辅轨三角 unit_claim+calc_cite 逐字同模「以守为进…」→ P=#5；写盯辅轨同模放大 |

| 2026-09-16 | 同上 · assign #3（跨页修后） | **闸过 · 质量有条件** | 主锚食神/劫财/正官/正印/伤官/丙午 · **与 P2 无撞**；无裸纳音柱；辅轨三同模仍 P=#5；主1 金舆天德旁注 P；可 unlock write |

| 2026-09-17 | 乙木·relationship | **闸过 · 质量有条件 · unlock P** | closed-menu=prealloc；与 P2 主锚无撞；**#5 claim 已分化**（守位/旁路/换轨）；**P**：辅轨 calc_cite 三同《易经》段；主1 酉辰六合 inference 被亲密摩擦模盖掉（与 claim「软化对立」相反）→ write 盯 |

| 2026-09-20 | 合伙·`3cf20b08…` | **闸过 · 质量有条件 · unlock → write** | closed-menu 6=锁；主锚伤官/午未六合/丑未相冲/丑未相刑/火/偏印 · **与 P2 无撞**；主轨 claim 分化（试水/不可替代/书面协议）。**P→逼近F**：主0 锁**伤官**但 inference/role/why 全文讲**食神**（删伤官不垮）；主1 六合 inference 软空壳；辅0 claim 神煞堆+句重复；辅1 裸「火」；辅2 偏印 vs 财星不显叙事偏题 → write 禁放大主0 错位 |



**已登记问题**

| 2026-09-11 | `lab_mtvapkdl_3ddc3f89` 盘1 乙木/创业 | **闸过 · 质量有条件** | closed-menu STOP≈3k；辅轨 claim 孪生 → P |

| 2026-09-11 | `lab_mtvi83gf_143bb385` 盘2 assign | **闸过 · 质量有条件** | closed-menu attempt#1；主轨分化 OK；辅轨「果断暂停…」三同模 → P；比肩 inference 过短 |

| 2026-09-11 | 同上 write attempt#6 | **闸过 · 质量有条件** | 主0/2+辅可删垮；比肩 evidence 仍软短；辅轨药方同模继承 assign；不 LLM 重试 write |



**已登记问题**



| 日期 | 问题 | 类 | 解法 | 回归 | 后续 |

|------|------|----|------|------|------|

| 2026-09-16 | assign `thesis_gap:cycle_ganzhi_not_in_thesis:乙巳` （跨页避让后锁到纳音裸柱） | **F→已修** | 菜单禁非 cycle 裸柱；`detectUngroundedCycleGanzhi` 仅岁运关键词触发；closed-menu thesis_gap 软换锁 | `test-thesis-gap-coverage` / prealloc-menu | 部署后重跑 P3 assign |

| 2026-09-16 | write 合质 `cross_page_anchor_reuse`：P3 primary≈P2（乙庚/比肩/正财/六合/巳寅刑）+仅伤官；jaccard 0.83≥0.72 且无新 category | **F→已修** | closed-menu 派词吃 `prior`+job prefer；assign 齐套同尺闸+软修；禁盲重写 | `test-cross-page-primary-reuse` / `test-closed-menu-assign` | **部署后重跑 P3 assign→write** |

| 2026-09-16 | write #12 辅轨 evidence 仍同「以守为进/小生态/跳槽/新能源观察」药方（sim=0.34 未触闸） | **P** | 根在 assign #5；不挡 | — | 方案 A #5 |

| 2026-09-16 | 辅轨三角 unit_claim 逐字同模「以守为进…小生态…跳槽…新能源长期观察」；calc_cite 亦三同截断 | **P** | 不挡；按角分化 claim 种子 | — | **方案 A #5**；write 已放大同模 → 随 F 回修 |

| 2026-09-16 | 主1 claim 夹「金舆/天德」未入本角 necessary_signals（白话括注） | **P** | 写时勿升成假锚；或 claim 去神煞专名 | — | write/成书抽检 |

| 2026-09-11 | free-select + 20k 吐 13k 未 STOP → `assign:llm_timeout` | **F** | deep 页一律 closed-menu + 8k 上限 | `test-closed-menu-assign` | 已验：attempt#3 stop≈3k |

| 2026-09-11 | P3 辅轨 3 角 unit_claim 逐字同模（暂守原职…） | **P** | 不挡过；按角分化 claim 种子 | — | **方案 A #5 claim 去同模** |

| 2026-09-11 | 盘2 辅轨三角 claim 同起「果断暂停，利用经济缓冲期彻底休整」 | **P** | 同 #5；slug 不同但药方同模 | — | 方案 A #5 |

| 2026-09-11 | 盘2 主轨比肩 inference/why 过短、偏软修腔 | **P** | 与比肩句模债同族 | — | 方案 A #1/#2 |

| 2026-09-11 | 盘2 write 比肩 evidence≈软修一句；claim（沟通/观察期）承重不足 | **P** | 根在 assign；write 放大可见 | — | 方案 A #1/#2 |

| 2026-09-17 | relationship · 辅轨 **claim 已按角分化**（#5 生效）；**calc_cite 仍三同**《易经》枯竭段 | **P** | cite 种子也按角分化；write 禁三同 cite 放大 | — | #5 未闭环到 cite |

| 2026-09-17 | **全局** science 角 cite 含「关系」→ softPolish 焊亲密摩擦模，盖掉合局「软化/合力」向 inference（与 claim 相反） | **F→已修** | weld 仅 foundation；write allow_friction_weld=false on science/P4/P5/P6；scrubAssignClaimBanSeed；P5 FALLBACK cite 按槽分化 | test-third-party-agency-gate | 下一盘 C-合伙盘子 |

| 2026-09-20 | 合伙 P3 主0：**slug=伤官** 但 inference/role/why **只讲食神**；删依据自检不成立 | **P→逼近 F** | 不挡 unlock；write 须按伤官展或 restamp 对齐 | closed-menu / softPolish 校验 slug∈inference | **方案 A #11** |

| 2026-09-20 | 合伙 P3 主1 午未六合：inference≈「可替换执行位」软壳，未点合局 | **P** | write 盯 | — | 同 #1/#2 |

| 2026-09-20 | 合伙 P3 辅0 claim 堆月德/将星且句重复；辅1 裸「火」；辅2 偏印锁 vs 财星叙事 | **P** | 不挡 | — | #7/#5；write 禁放大神煞旁注为假锚 |

| 2026-09-20 | 合伙 P3 write#6：辅0 evidence 仅「更难推动…」+「神煞太极贵人、月德贵人、将星」名单；删依据几乎不垮 | **P→逼近 F** | 不挡 unlock（闸过）；fill/成书抽检；expand 禁神煞名单粘贴 | depth/agency 扩负例 | **方案 A #12** |

| 2026-09-20 | 合伙 P3 write 主0/2：evidence 仍粘贴 calc_cite /「本维须证明」整句 | **P** | 同 #9/#10 | — | expand/scrub 扩 science |



**命令**



```bash

pnpm exec tsx scripts/test-closed-menu-assign.ts

pnpm exec tsx scripts/test-thesis-gap-coverage.ts

```



---





### 2.3d3 `science_action.fill` · P3 压缩



**F 必须过**



- [ ] 主辅各 ≥3 角；每角策略+手段成套（半套即失败）  

- [ ] 无合同/完整话术剧本/专业代做；手段止于一层第一步示意  

- [ ] 只压缩 write，不另立新目标  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-16 | 乙木·career 重开 | **闸过 · 质量有条件** | 3+3 策略+手段齐；主轨分化 OK；辅轨标题已拆、策略仍共「以守为进」→ P=#5；手段「今晚」偏密但不构成合同代做；evidence 空壳待 mark |

| 2026-09-17 | 乙木·relationship | **质量 F · 勿 unlock** | 主1 strategy/means「说服男友 / 他怕 / 逐字开口稿」；闸曾假绿。**全局已修**：sanitize soft-repair agency + 话术剧本坍缩；**部署后准备重跑 fill** |

| 2026-09-17 | 同上 fill#2 | **质量 F · 勿 unlock** | soft-repair 过度：六角 strategy 全被盖成同一句关系开口壳 + means 壳。**已修**：禁 stamp 壳；空壳策略 fail→纠错；角间策略须分化 |

| 2026-09-17 | 同上 fill#3 | **质量 F · 勿 unlock** | 三角已分化、无逐字稿；仍有：①换轨 means 漏软修壳（尾`。`穿匹配）；②关系角`他担心/让他`施事；③`月支出`被误替换成`【时令根基】`。**已修**后重跑 |

| 2026-09-17 | 同上 fill#4 | **质量 F · 勿 unlock** | 试水/睡眠/辅轨可用；关系角软修壳起句+`邀请他`+残句`变成。`/`框架：`。**已修**：剥嵌壳句、截断 fail、intimacy force 回指 |

| 2026-09-17 | 同上 fill#5 | **闸过 · 质量有条件 · unlock → mark** | 3+3 分化；无逐字稿/无壳页/无时令根基误替换；关系角已你侧观察期口径。P：关系 strategy 两句软修套语并列；手段「今晚」偏密；strategy 内夹手段句 |

| 2026-09-20 | 合伙·`3cf20b08…` fill | **闸过 · 质量有条件 · unlock → mark** | attempts=1；3+3 策略+手段齐；主轨试水/不可替代/书面协议分化；辅0 从 write 神煞空壳**压缩补全**回旋口径；无逐字开口稿/无替写合同正文。**P**：六角 `hard_metrics=[]`；手段偏密（里程碑提案/备忘录示意）；strategy 起句「利用这一点/这意味着」指代悬空 |



**已登记**



| 日期 | 问题 | 类 | 后续 |

|------|------|----|------|

| 2026-09-16 | 辅轨三角策略仍共小生态/跳槽/新能源观察 | **P** | 方案 A #5 |

| 2026-09-16 | 多角「今晚」手段偏密（示意过满） | **P** | fill 手段密度；不挡 |

| 2026-09-17 | **全局** P3 fill 用户层可写第三方施事 + 完整话术剧本；gate 假绿 | **F→已修** | `softRepairScienceAngleUserProse`（strategy/means）+ residual fail；回归 `test-third-party-agency-gate`；部署后重跑 fill |

| 2026-09-17 | **全局** soft-repair 把各角 strategy 盖成同一关系开口壳 → 假绿空壳页 | **F→已修** | 禁 stamp `SCIENCE_QUERENT_OPENING_HINT`；壳策略/空 means → drop angle；回归含 hollow fail |

| 2026-09-17 | 软修壳尾`。`漏检；亲密角`他`回指施事；`月支出`⊃`月支`误替换 | **F→已修** | shell 去标点匹配；intimacy anaphora soft-repair；`月支(?!出)` |

| 2026-09-17 | 关系角 soft-repair 两句套语并列（观察期/边界） | **P** | 软修去重；不挡 unlock |

| 2026-09-20 | 合伙 P3 fill：六角 `hard_metrics=[]`；手段示意偏满（提案/备忘录）；strategy「这一点/这意味着」悬空指代 | **P** | 不挡；fill 提示硬指标≥1 + 禁止悬空起句 | — |



---





### 2.3d4 `science_action.mark` · P3 打标+polish



**F 必须过**



- [ ] 每角非空 evidence；闭集 `⟦t:slug|软译|语境⟧`；无空 `{}`  

- [ ] Lab gate PASSED（fanout merge 齐套）  



**P 可后修**



- [ ] 同卡重复 slug 金字  

- [ ] body 仍「本维须证明」派工腔 / 辅轨三同模 claim  

- [ ] 金舆天德旁注未进闭集锚  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-16 | 乙木·career 重开 #2 | **闸过 · 质量有条件** | 6 角闭集齐；merge 2 chunks；卡0 食神×3、卡1 劫财×2 重复金字 → P；辅轨 body 三同模 #5；丙午→bare_ganzhi 岁环 OK；可 unlock P4 |

| 2026-09-17 | 乙木·relationship #2 | **闸过 · 质量有条件 · unlock → P4** | 6 角闭集齐；merge 2 chunks；卡0/2 `branch_you` 同卡双挂+长软译墙 → P；卡1 evidence「对方总在给你施压」轻施事腔 → P；辅4/5 《易经》枯竭 cite 壳 → P（#5）；body 仍 claim/专名腔 → P |

| 2026-09-20 | 合伙·`3cf20b08…` mark#2 | **闸过 · 质量有条件 · unlock → P4** | merge 2 chunks；6 角闭集齐（伤官/六合/冲/刑/火簇/偏印）；辅0 evidence **已展**回旋路径（非 write 神煞名单）。**P**：body「本维须证明」壳；辅1 同卡 5 金字墙（偏印∥正印∥食神∥身强∥火）；软译百科偏长 |



**已登记**



| 日期 | 问题 | 类 | 后续 |

|------|------|----|------|

| 2026-09-16 | 卡0 `shi_shen` 同卡三挂；卡1 `jie_cai` 双挂 | **P** | soft-repair 去重 |

| 2026-09-16 | 辅轨三角 body 仍逐字同模「以守为进…」 | **P** | 方案 A #5 |

| 2026-09-16 | 主1 body 残留金舆/天德旁注（未打标） | **P** | 成书抽检 |

| 2026-09-17 | 卡0/2 `branch_you` 同卡双挂 + 软译百科墙 | **P** | 同卡 slug 去重 / 软译截短 |

| 2026-09-17 | 卡1 evidence「对方总在给你施压」 | **P** | mark 依据层也走你侧张力句；不挡 |

| 2026-09-17 | 辅轨正官/偏印 evidence 仍《易经》枯竭段 | **P** | #5 cite 按角分化 |

| 2026-09-20 | 合伙 P3 mark：body 派工壳；辅1（锁火）同卡 5 金字+长软译；辅0 相对 write#12 已改善 | **P** | #9 body scrub；同卡锚上限 / 软译截短 |



---





### 2.3e `metaphysics_action.assign` · P4 派工



**F 必须过**



- [x] closed-menu + moat×anchors：timing 可用岁运干支（丁酉）；archetype 须十神；polarity 须身弱/用忌**或裸五行（土/水等忌用元素）**  

- [x] 闭集按 `moat_class` 优先派词；restamp 后再验 moat；失败先 slot-swap 软修（禁把本页全部主词塞进 avoid）  



**P 可后修（不挡 unlock）**



- ~~unit_claim 仍像禁令种子句（「禁物件补泻…」「勿写财务 KPI」）~~ → **2026-09-17 根修** `scrubAssignClaimBanSeed`（feed + softPolish）  

- `[1]`/`[2]` inference 同模（「合作推进…配合位…压力落在你侧」）——timing/archetype 可被 partnership 焊模盖掉；**science/P4 页已禁 friction weld**（foundation 仍允许）  

- `dimensions[2]` 锁「格局」——壳词（方案 A #7）；**relationship 盘已派伤官，部分兑现**  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-16 | 乙木·career | **闸不过→已修** | `moat_anchor_mismatch:dimensions[1]:timing` 裸丁酉被拒；已认岁运干支为 timing；P4 闭集 moat 优先派词 + restamp 后软修 |

| 2026-09-17 | 乙木·career #2 | **闸不过→已修** | `dimensions[0]:polarity` 裸「土」；polarity 认裸五行；moat 派词禁 generic fallthrough；`softRepairPlannedMoatLocks` slot-swap；勿 avoid 本页全主词 |

| 2026-09-17 | 乙木·career #3 | **闸过 · 质量有条件 · unlock P** | moat 齐：身弱/丁酉/格局?/金/丙午/食神；P：格局壳、双 inference 同模、claim 禁令腔；写可继续 |

| 2026-09-17 | 乙木·relationship | **闸过 · 质量有条件 · unlock → write** | moat 齐：身弱/甲子/伤官/金/丙午/食神（**无格局壳**）；P：`[1]`/`[2]` inference 同「合作推进·配合位」焊模（伤官被盖）；`[3]` claim 禁令尾「勿写财务 KPI」；写可继续 |

| 2026-09-20 | 合伙·`3cf20b08…` | **闸过 · 质量有条件 · unlock → write** | moat 齐：身强(pol)/丙午(tim)/比肩(arch)/水(pol)/丁酉(tim)/七杀(arch)；**无格局壳、无配合位焊模**。**P**：`[1]`/`[2]`/`[4]` claim 仍带禁令尾（勿写兼职工时/禁签约…）；`[3]`/`[5]` claim≈菜单指令原文粘贴；`[2]` cite「食神偏印正印」vs 锁比肩偏题 → write 盯 |

| 2026-09-24 | 己土·合伙续跑 #3 | **闸过 · 质量有条件 · unlock → write** | 结构主张过闸；软截手段尾巴生效。**P**：dim1/3 claim 半截（已加未完句闸）；cite 仍白话处境 → write 盯 |



---



### 2.3e2 `metaphysics_action.write` · P4 专写



**F 必须过**



- [x] 6 角 = 6 次独立 invoke；齐套后再 `assessDeepEvidenceQuality`  

- [x] 跨页 primary Jaccard / 页内 evidence 回声 / anchor Jaccard 过闸  

- [x] 每角保留 assign 的 `moat_class` + 主锚；evidence 能删垮（极性/窗口/角色各有机制）  



**P 可后修（不挡 unlock）**



- unit_claim 仍 assign 禁令种子（未独立成 claim；含「勿写财务 KPI」）  

- `[2]` 主锚「格局」壳（career）；relationship 已派伤官，正文承重更实  

- `[1]` evidence 仍夹「配合位·压力落在你侧」焊模（assign 继承）  

- `[3]` 金→水 略偏元素直译；`[2]`/`[5]` 同「输出者」席位（角不同可接受）  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-17 | 乙木·career #6 | **闸过 · 质量有条件 · unlock P** | 6/6；sim=0.08；anchor jaccard=0；cross_page=0.13；moat 三角齐；P：格局壳、claim 禁令腔、[3] 元素直译；→ merge |

| 2026-09-17 | 同上 · write_merge | **闸过 · unlock P** | 与 write#6 同稿；无静默丢锁；moat covered polarity+timing+archetype；→ fill |

| 2026-09-17 | 乙木·relationship #6 | **闸过 · 质量有条件 · unlock → merge** | 6/6；sim=0.04；anchor=0；cross=0；moat 三角齐（身弱/甲子/伤官/金/丙午/食神）；P：`[3]` claim 禁令尾、`[1]` 配合位焊模继承、`[2]`/`[5]` 双输出者席 |

| 2026-09-17 | 乙木·relationship · write_merge | **闸过 · unlock → fill** | 与 write#6 同稿；moat covered polarity+timing+archetype；无静默丢锁 |

| 2026-09-20 | 合伙·`3cf20b08…` write#6 | **闸过 · 质量有条件 · unlock → merge** | 6/6；sim=0.17@[1]↔[4]；anchor=0；cross=0；moat 三角齐；无配合位焊模。**P**：`[0]` 尾粘 `water/fire/earth` 英文字母 cite；`[5]` evidence 尾粘「开创 vs 守成」指令；`[1]`/`[4]` 同「水旺窗口/勿全职」近义；claim 禁令尾继承 #13 |

| 2026-09-20 | 同上 · write_merge | **闸过 · unlock → fill** | 与 write#6 同稿；moat covered polarity+timing+archetype；无静默丢锁；P 继承 #13 |



---



### 2.3e3 `metaphysics_action.fill` · P4 压缩

> **产品口径（2026-09-25）**：本步正文 = **东方谋略**三柱（局势·意象·仪轨），双核八字+奇门；不是「自我调频包装的 P3」。闸绿 ≠ 产品过。全文见 `P4-东方谋略-规格锁.md`。
>
> **Phase B（2026-09-26）**：正文合格战役——菜单加辣 + 敌我时空微剧本 + 兵法意象白名单；人审三问见规格锁 §4.5。A/B 底线（不恐吓/不预测/不承诺；禁物化神棍；禁 P3 工具）不松。

**F 必须过**

- [ ] 双核：`eastern_calc_slice` / Fact-pack 含【奇门锁盘·交付起局】；缺奇门 → `p4_qimen_lock_missing`（不降级）
- [ ] 三柱可读：局势/意象/仪轨（内部 type 可仍 timing|polarity|archetype）；means≥2、strategy 够厚
- [ ] **人审三问（硬 · 闸绿不够）**：
  1. 局势：删奇门主客/值使/stance/微剧本后论述垮；有敌·我·时·空张力
  2. 意象：删用忌锚后论述垮；非性格鸡汤
  3. 仪轨：可指认白名单动作（静默/时空差/背靠实墙等），非整页静坐温水，非合同话术
- [ ] **P3 工具词族零命中**：合同/条款/股权/律师/Excel/OKR/邮件模板/交接文档/补充协议 → `p4_p3_tool_word_family`
- [ ] 读感非 CBT/OKR/HR 沟通周报、非第二份 P3；非恐吓/预测时点/承诺结果
- [ ] 同议题对照：P3 出合同数字工具，P4 出攻守/气场/仪轨——感官拉开（人审）
- [ ] 闸绿 ≠ 产品过：薄页 / 像 P3 / 删算通 / 无谋略味 → **质量 F · 勿 unlock**

**P 可后修（不挡 unlock）**

- 维名略偏旧「自我调频」腔但 means 已是谋略三柱
- `evidence: []` 待 mark
- 兵法意象词密度略高/略低（有合格稿后 Step B7 再收）

**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-17 | 乙木·career | **闸过 · 质量有条件 · unlock P** | attempts=1；6 维齐；贴题第三条路；P：顾问工时/财务线/软章尾；→ mark |

| 2026-09-17 | 乙木·relationship | **质量 F · 勿 unlock** | 金维 means 逐字开口稿 +「男友/家人施压」施事；闸假绿（P4 未接 agency）。**全局已修**：`sanitizeAngle` P4 支路接 `softRepairScienceAngleUserProse`；回归 `test-third-party-agency-gate`；**准备重跑 fill** |

| 2026-09-17 | 乙木·relationship fill#2 | **闸过 · 质量有条件 · unlock → mark** | 6 维齐；无开口稿/无男友施事；贴 write 主锚。P：丙午维 means[1] 纯软章「转折前不硬冲」；时机维 6 月/复购/覆盖开支偏密；感情线手段薄 |

| 2026-09-20 | 合伙·`3cf20b08…` fill | **闸过 · 质量有条件 · unlock → mark** | attempts=1；6 维齐；贴兼职试水/窗口/输出者/侧翼；无逐字稿/无施事；用户层已 scrub 英文用忌与菜单指令。**P**：丁酉维 means 叠「转折前不硬冲」软章（重复）；六维 `hard_metrics=[]`；手段偏行为教练 |

| 2026-09-24 | 己土合伙 fill#4 | **闸过 · 产品 F · 勿 unlock** | attempts=1；means 常 1 条；平静再谈/鸡蛋篮/模块交付——删算仍通。**已定深**：密度+反通用杠杆+de-calc+anchors 卫生；leverage 三槽保持退役。**准备重跑 fill** |

| 2026-09-26 | 己土合伙 fill#17 | **闸过 · 产品 F · 勿 unlock** | **基线类别（B1）**：①四维/菜单模板腔无三柱看透感 ②虚仪轨（静坐温水重复）③无敌我时空博弈 ④偶发裸锚/专名报幕。→ Phase B：菜单加辣+微剧本+duty；**准备重跑 fill**（勿 unlock） |



**已登记**



| 日期 | 问题 | 类 | 后续 |

|------|------|----|------|

| 2026-09-17 | **全局** P4 fill 用户层可写第三方施事 + 完整话术；gate 假绿 | **F→已修** | 与 P3 共用 soft-repair；禁 stamp 壳；回归含 P4 dirty mean |

| 2026-09-20 | 合伙 P4 fill：丁酉 means 叠「转折前不硬冲」软章；hard_metrics 全空 | **P** | soft章去重；硬指标≥1；不挡 |

| 2026-09-26 | **全局** P4 write 丢 polarity：派工重跑后 write_units 未清，同 path 复用旧批断 | **F→已修** | `prepareLabRerun(assign)` 清 write_units；`writeUnitsStaleVsAssignment`；质量闸 `p4_moat_mismatch` / `missing_class:polarity`；回归 `test-p4-write-moat-lock` |



---



### 2.3e4 `metaphysics_action.mark` · P4 打标+polish



**F 必须过**



- [x] 6 角非空 evidence；闭集 `⟦t:…⟧`；无空 `{}`  

- [x] Lab gate PASSED（fanout 2 chunks → merge）  



**P 可后修（不挡 unlock）**



- body 仍 assign 禁令/派工腔（「禁物件补泻…」「勿写财务 KPI」）  

- 卡2 `pattern`←「格局」壳（career）；relationship 已 `shang_guan`  

- 卡1 evidence 仍「配合位·压力落在你侧」焊模  

- 卡1/4 同挂 `bare_ganzhi`（跨卡可接受；同卡未叠金）  

- 卡2 evidence 双挂同 slug `shang_guan`（密度偏高）  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-17 | 乙木·career #2 | **闸过 · 质量有条件 · unlock P** | merge 2 chunks；weak_self/bare_ganzhi/pattern/metal/bare_ganzhi/shi_shen；P：body 派工腔、格局→pattern、双配合位；→ 下一步（direct_answer / P5） |

| 2026-09-17 | 乙木·relationship #2 | **闸过 · 质量有条件 · unlock → 下一步** | merge 2 chunks；weak_self/bare_ganzhi/shang_guan/metal/bare_ganzhi/shi_shen（**无格局壳**）；P：body[3] 禁令尾、卡1 配合位焊模、卡1/4 双 bare_ganzhi、卡2 双 shang_guan |

| 2026-09-20 | 合伙·`3cf20b08…` mark#2 | **闸过 · 质量有条件 · unlock → P1** | merge 2 chunks；strong_self/bare_ganzhi/bi_jian(+shi_shen)/water/bare_ganzhi/qi_sha；无格局壳、无配合位焊模。**P**：body 仍禁令/菜单指令腔（#13）；卡1/4 双 `bare_ganzhi`；软译偏长 |



---



### 2.3f `direct_answer.fill` · P1 直答



**F 必须过**



- [x] 正面直答 + 主辅对照；`core_judgment` 一句可带走  

- [x] 贴本案议程；与 P3/P4「守中选点/侧翼」不打架  

- [x] 不写完整合同/话术剧本；手段止于方向层  



**P 可后修（不挡 unlock）**



- `evidence.markers` 空（本页无 mark 步则成书抽检）  

- 主轨「股权比例 / 2-3万硬支出」或「6-12 月缓冲 / N 个付费案例」偏具体数字与条款示意  

- 辅轨锚「fire、earth」中英混写；`core_logic` 偏长但仍可读  

- relationship：成功样貌/goal 写「让男友从反对者变观察者」「他最终会看到…」——第三方心理预测（逼近 agency；P1 未接软修）  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-17 | 乙木·career | **闸过 · 质量有条件 · unlock P** | attempts=1；主=兼职验证·辅=内优/跳槽；judgment 渐进过渡；P：空 markers、财务数字、股权句；→ P5 |

| 2026-09-17 | 乙木·relationship | **闸过 · 质量有条件 · unlock → P5** | 主=渐进破茧·辅=安全着陆；贴大厂+感情；与 P3/P4 守中侧翼齐。P：空 markers、fire/earth 混写、缓冲/案例数字、「让男友…变观察者」第三方心理预测 |

| 2026-09-20 | 合伙·`3cf20b08…` | **闸过 · 质量有条件 · unlock → P5** | attempts=1；主=兼职试水·辅=全职硬条件；judgment 可带走；与 P3/P4 守中/窗口/侧翼齐。**P**：空 markers；辅锚 `fire、earth` 中英混写；主/辅各夹一句示意开口引语；「对方想绑定…」轻意图归因 |

| 2026-09-24 | 合伙·同盘续跑 | **闸过 · 质量有条件 · unlock → P3** | attempts=1；主=兼职试水·辅=全职硬法律网；judgment 可带走；**顺序已改** P1 在 P3 前。**P**：正文夹「火土/合作宫」（见 `delivery-lab-P1直答-deferred-瑕疵.md`）；空 markers；辅锚 fire/earth 混写 |



---



### 2.3g `risk_guard.assign` · P5 派工



**F 必须过**



- [x] closed-menu 6 槽；`calc_cite` 不得 hollow「主手段」等占位（≥12 或软填 claim/inference）  

- [x] 指回 P3/P4 执行面；禁另立第三套药方  



**P 可后修（不挡 unlock）**



- ~~Brief 执行面空时 4 槽共用 FALLBACK cite~~ → **2026-09-17 根修** 6 槽 FALLBACK cite 按槽分化；unit_claim 已分化  

- 主锚 木/火/土/水 偏裸五行（极性可接受；写盯执行面点名）  



**已登记问题**



| 日期 | 问题 | 类 | 解法 | 回归 |

|------|------|----|------|------|

| 2026-09-17 | `bind_fields_short:red_lights[0]` · calc_cite=「主手段」(3 字) 且 prefer 同壳 | **F→已修** | `resolveAssignCalcCite` 认 hollow→填 claim/inference；risk feed 禁裸「主手段」cite | `test-deep-evidence-assign` |



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-17 | 乙木·career #2 | **闸过 · 质量有条件 · unlock P** | hollow 已消；6 槽齐；P：FALLBACK cite 同模×4、裸五行；→ write |

| 2026-09-17 | 乙木·relationship | **闸过 · 质量有条件 · unlock → write** | 6 槽齐；无 hollow「主手段」；锚 木/火/土/水/子辰半合/午未六合。P：FALLBACK cite×3、裸五行、`[0]`/`[3]` inference 同亲密摩擦焊模（水被盖）、`[0]` cite 偏开口示意非算据 |

| 2026-09-20 | 合伙·`3cf20b08…` | **闸过 · 质量有条件 · unlock → write** | 6 槽齐（2红+1坑+切辅+2护）；无 hollow。锚：卯未半合/土/金/午午相刑/偏财/午午半合。**P→逼近F**：①切辅 claim「转向兼职辅轨」与 P1 **主=兼职、辅=全职硬条件** 颠倒；②`traps` cite「他倾向于…」第三方主语；③红灯0 锁卯未半合但 role 讲七杀、inference 一句软壳 → write 须按 P1 轨校正切辅方向 |



---



### 2.3g2 `risk_guard.write` · P5 专写



**F 必须过**



- [x] 6 角 = 6 次独立 invoke；齐套后 quality  

- [x] 跨页/页内 Jaccard·sim 过闸；每条能指回熔断/坑/切辅/护栏  



**P 可后修（不挡 unlock）**



- 多卡仍以 FALLBACK cite 起句；未点名 P3「兼职验证」等具体执行面  

- 机制几乎全 `fuse`（切辅为 window_switch）；evidence 偏元素直译  



**已登记问题**



| 日期 | 问题 | 类 | 解法 | 回归 |

|------|------|----|------|------|

| 2026-09-17 | softRepair 整段焊成「就你侧…」摩擦壳；双卡 sim≈0.92 假绿 | **F→已修** | `expandWriteEvidencePastFrictionShell`；壳→still_dirty + depth `friction_shell` | `test-third-party-agency-gate` |

| 2026-09-20 | 合伙 P5 write#6：切辅仍「转向兼职辅轨」；#14 未在 write 兑现 | **P→逼近 F** | fill 正名：主=兼职试水失败→切辅=全职硬条件/停 | — |



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-17 | 乙木·career #6 | **闸过 · 质量有条件 · unlock P** | 6/6；sim=0.16；jaccard=0；cross_page=0.11；P：cite 同模起句、未钉 Brief 手段名；→ merge |

| 2026-09-17 | 同上 · write_merge | **闸过 · unlock P** | 与 write#6 同稿；无丢锁；→ fill |

| 2026-09-17 | 乙木·relationship #6 | **质量 F · 勿 unlock** | `[0]`/`[3]` 同「就你侧…」摩擦壳；sim=0.92 贴阈值假绿；切辅未承水枯竭。**全局已修**：soft-repair 扩写 claim/cite；壳→`still_dirty`/`deep_evidence_friction_shell`；**准备重跑 write** |

| 2026-09-17 | 同上 #12 | **闸过 · 质量有条件 · unlock → merge** | 6/6；sim=0.35；壳已扩写带熔断句；切辅=`window_switch`。P：FALLBACK cite 起句、`[0]`/`[3]` 仍亲密模打头、`[5]` 发明 `⟦w:日支未土土⟧`/`⟦w:忌神⟧` |

| 2026-09-17 | 同上 · write_merge | **闸过 · unlock → fill** | 与 write#12 同稿；sim=0.35；无静默丢锁 |

| 2026-09-20 | 合伙·`3cf20b08…` write#6 | **闸过 · 质量有条件 · unlock → merge** | 6/6；sim=0.11；anchor=0；cross=0。坑卡已 scrub「他」→你侧。**P→逼近F**：切辅仍写「转向兼职辅轨」（#14 未修）；红0 仍软壳+cite 粘贴；护栏谈全职过耗与 P1 主=兼职略拧 → fill 须正名主辅 |

| 2026-09-20 | 同上 · write_merge | **闸过 · unlock → fill** | 与 write#6 同稿；无静默丢锁；#14 切辅颠倒继承 → fill 正名 |



---



### 2.3g3 `risk_guard.fill` · P5 压缩



**F 必须过**



- [x] 2 红灯 + 1 坑 + 切辅 + 2 护栏；每条 situation→then_do→watch→forbid  

- [x] 盯住本案主路径执行面（渐进转型/睡眠/关系边界）；禁另立第三套药方  

- [x] 锚继承 write  



**P 可后修（不挡 unlock）**



- 切辅「月净流出 1.5 万×3 月」偏编造财务 KPI（议程未确认；career）  

- `evidence.markers` 空待 mark；then_do 偏密  

- relationship：红灯0「对方一反对」第三方作触发；短句「我需要点时间想想」示意开口（非逐字说服稿）  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-17 | 乙木·career | **闸过 · 质量有条件 · unlock P** | attempts=1；处置链贴题；P：1.5万阈值、空 markers；→ mark |

| 2026-09-17 | 乙木·relationship | **闸过 · 质量有条件 · unlock → mark** | 2+1+切辅+2 齐；贴渐进转型/睡眠/关系；无说服剧本。P：空 markers、红灯0 对方反对触发、短停顿语 |

| 2026-09-20 | 合伙·`3cf20b08…` fill | **闸过 · 质量有条件 · unlock → mark** | attempts=1；2+1+切辅+2 齐；贴兼职谈判/全职施压执行面。**P→逼近F**：切辅仍把「兼职/顾问现金」叫辅路（P1 主=兼职、辅=全职硬条件，#14）；红1 锚土但叙事偏技术硬碰（金坑串味）；护栏夹「【护持感】符」软译腔 |



---



### 2.3g4 `risk_guard.mark` · P5 打标+polish



**F 必须过**



- [x] 6 角非空 evidence；闭集 `⟦t:…⟧`；fanout merge 齐  



**P 可后修（不挡 unlock）**



- 卡0/2 同 slug 双挂（wood/earth；career）；relationship 卡5 金字过密（午未六合拆多槽 + 双 `branch_wei`）+「在机制上衔接/由此引动」垫语  

- 多卡 body 仍 FALLBACK/派工腔；卡0/3 evidence 仍亲密摩擦模打头  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-17 | 乙木·career #2 | **闸过 · 质量有条件 · unlock P** | merge 2 chunks；wood/fire/earth/water/合化堆/巳寅刑；P：叠金字、垫语；→ P6 / signals_close |

| 2026-09-17 | 乙木·relationship #2 | **闸过 · 质量有条件 · unlock → P6** | merge 2 chunks；wood/fire/earth/water/子辰半合堆/午未六合堆；P：卡5 多金+双 wei、卡0/3 亲密模、body 派工腔 |

| 2026-09-20 | 合伙·`3cf20b08…` mark#2 | **闸过 · 质量有条件 · unlock → P6** | merge 2 chunks；banhe/earth/metal/xing/pian_cai/banhe；闭集齐。**P**：切辅 body 仍「兼职辅轨」（#14）；卡0/5 同 `banhe`；忌土软译「承托」偏褒；软译百科偏长 |



---



### 2.3h `signals_close.assign` · P6 派工



**F 必须过**



- [x] closed-menu 6 槽：identity + tonight + day7×4  

- [x] 锚可承重；禁另立第三套药方  



**P 可后修（不挡 unlock · 写/fill 必压）**



- day7 cite/claim 写成「第1-10/11-20/21-30天」→ 近7日扩成月表（违八页禁四周/三十天）  

- `[2]`/`[3]` 同段 21-30 巩固 cite；tonight claim=cite 薄壳  

- identity claim 仍派工种子腔  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-17 | 乙木·career | **闸过 · 质量有条件 · unlock P** | 6 槽齐；土/水/劫财/乙庚合/巳寅刑/食神；写须压回近7日、消月表；→ write |

| 2026-09-17 | 乙木·relationship | **闸不过 · 准备重跑** | `assign:parse_fail`：JSON 截断于 day7[0] why_needed；日志 `skip in-process retry`（remaining≈33s < min 90s）。非质量闸——换新 invoke 重跑；未齐套不评 F/P |

| 2026-09-17 | 同上 #2 | **闸过 · 质量有条件 · unlock → write** | 6 槽：丁酉/正财/丙午/乙庚合/酉酉半合/酉辰六合；近7日非月表。P：identity cite 错挂睡眠 KPI；day7 cite 截断尾；`[2]`/`[3]` 巩固 cite 近同；tonight 薄壳 |

| 2026-09-20 | 合伙·`3cf20b08…` | **闸过 · 质量有条件 · unlock → write** | 6 槽齐：木/酉卯相冲/酉丑半合/壬寅/卯未半合/午未六合；**近7日非月表**（观察→调整→巩固→切辅）。**P**：identity claim 派工种子；tonight claim=cite 薄壳；day7[0] 摩擦壳起句；`[2]`/`[3]` 巩固 cite 近同；切辅未钉 P1 辅=全职硬条件 |



**已登记问题**



| 日期 | 问题 | 类 | 解法 | 回归 |

|------|------|----|------|------|

| 2026-09-17 | write `primary_reuse_cap` 乙庚合/巳寅刑/食神 3>2（跨页累计；闭集 restamp 盖掉 assign 软修） | **F→已修** | write/merge `softRepairDeepEvidencePlanPrimaryReuse`；派词 last-resort 先避 prior；restamp 后再 enforce 并同步 lockPlan | `test-deep-evidence-assign` |

| 2026-09-17 | day7 cite/claim 月表腔（第1-10/11-20/21-30天） | **P→已修** | `normalizeNear7DayStem` / `stripMonthBandDayPrefix` 进 close hints + assign lock | `test-deep-evidence-assign` |



---



### 2.3h2 `signals_close.write` · P6 专写



**F 必须过**



- [x] 齐套后 `assessDeepEvidenceQuality`；不过不得假绿  

- [x] chart_anchors 每条须在 evidence / ⟦w:⟧ 出现（禁 invent unmatched aux）  

- [x] primary_reuse_cap 跨页 ≤2（软修 diversify + restamp，不 LLM 空转）  



**P 可后修（不挡 unlock）**



- day7 月表腔（1–10/11–20/21–30）继承 assign；八页禁四周/三十天表 → fill 压回近7日  

- tonight claim=cite 薄壳；identity 尚可  

- `[2]`/`[3]` 同段 21–30 巩固 cite；mechanism_tag `window_switch` 过密  

- `[1]` evidence 夹合化/金气，主锚是比肩；`[2]` 正文点巳寅相刑而锁锚正财（旁注可后修）  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-17 | 乙木·career write#12 | **闸不过→已修** | `deep_evidence_anchor_mismatch:日主乙庚相合合化金@identity_shift`；forceDiversify 发明 aux 无 ⟦w:⟧ → 禁 invent + softStrip |

| 2026-09-17 | 乙木·career write#18 | **闸过 · 质量有条件 · unlock P** | 6 槽齐；锚↔⟦w:⟧一致；sim=0.06 jaccard=0.00 cross=0.32；月表腔/tonight 薄/双 21–30 → P 不挡；→ write_merge |

| 2026-09-17 | 乙木·relationship #6 | **闸过 · 质量有条件 · unlock → merge** | 6/6；锚↔⟦w:⟧齐；sim=0.09 jaccard=0 cross=0.16；近7日非月表。P：identity 睡眠 KPI 起句、tonight 薄、`[2]`/`[3]` cite 近同巩固段 |

| 2026-09-20 | 合伙·3cf20b08… write#6 | **闸过 · 质量有条件 · unlock → merge** | 6/6；sim=0.21@[2]↔[3]；cross=0.07；近7日非月表。tonight 已展备忘录。**P→逼近F**：观察槽 evidence≈配合位熔断壳（未展观察 claim）；巩固双粘 claim/cite；切辅仍把兼职当弹性辅路（#14） |

| 2026-09-20 | 同上 · write_merge | **闸过 · unlock → fill** | 与 write#6 同稿；sim=0.21；无静默丢锁；观察熔断壳/#14 继承 → fill |





**已登记问题**



| 日期 | 问题 | 类 | 解法 | 回归 |

|------|------|----|------|------|

| 2026-09-17 | reuse 软修后每槽挂「日主乙庚相合合化金」aux，evidence 仅 ⟦w:土/水/…⟧ → mismatch | **F→已修** | `forceDiversify` 只保留已有且≠primary 的 aux；齐套前 `softStripUnmatchedDeepEvidenceAnchors` | `test-deep-evidence-assign` |

| 2026-09-17 | day7 cite/claim 仍 1–10/11–20/21–30 月表（违八页近7日） | **P→已修** | assign/close 种子压近阶；不 LLM 重写 write | `test-deep-evidence-assign` |

| 2026-09-17 | tonight claim=cite；`[2]`/`[3]` 同巩固段；比肩卡夹合化金气 | **P** | 不挡 unlock | — |



### 2.3h3 `signals_close.write_merge` · P6 合质



**F 必须过**



- [x] 合并不丢锁词 / path；与 write 同尺 `assessDeepEvidenceQuality`  

- [x] 无静默丢锚；cross_page jaccard 过闸  



**P 可后修**



- 同 write：月表腔、tonight 薄、`[2]`/`[3]` 同巩固段（不挡）  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-17 | 乙木·career write_merge | **闸过 · 质量有条件 · unlock P** | 与 write#18 同稿；sim=0.06 jaccard=0.00 cross=0.32；无丢锁；→ fill |

| 2026-09-17 | 乙木·relationship write_merge | **闸过 · unlock → fill** | 与 write#6 同稿；sim=0.09；无静默丢锁 |



**已登记问题**：继承 write P 项，不另立 F。



### 2.3h4 `signals_close.fill` · P6 压缩



**F 必须过**



- [x] 只压缩不新判；跨页硬闸与 write 同尺（Jaccard≥0.72 且无新类目）  

- [x] 禁「整页单元皆 ⊆ prior」假硬闸空转 LLM  

- [x] identity + 今晚闭环 + day7×4 + takeaways×3；锚齐  



**P 可后修（不挡 unlock）**



- `evidence` 空 markers 常态（mark 挂）  

- identity_shift 白话略软；day7[3] 双轨答复偏长  

- write 月表腔已压回近7日/本周（本步改善，不挡）  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-17 | 乙木·career fill | **闸不过→已修** | `cross_page_primary_anchor_reuse`：fill 旧尺严于 write；已对齐 Jaccard SSOT |

| 2026-09-17 | 乙木·career fill#2 | **闸过 · 质量有条件 · unlock P** | 结构齐；跨页过；day7 压回近阶；空 evidence 交 mark；→ mark |

| 2026-09-17 | 乙木·relationship | **闸过 · 质量有条件 · unlock → mark** | identity+今晚+day7×4+takeaways×3；锚齐；近7日。P：空 evidence；day7[1] action 截断「不要求他…」；identity 仍睡眠 KPI 起句 |

| 2026-09-20 | 合伙·3cf20b08… fill | **闸过 · 质量有条件 · unlock → mark** | attempts=1；identity+今晚备忘录+day7×4+takeaways×3；观察槽已补全（相对 write 熔断壳）。**P**：day7[3] 仍写「启动辅轨切换·兼职试水」（#14）；空 evidence |




**已登记问题**



| 日期 | 问题 | 类 | 解法 | 回归 |

|------|------|----|------|------|

| 2026-09-17 | fill structural `cross_page_primary_anchor_reuse`（write 已过 cross=0.32） | **F→已修** | `assessUnitAnchorQuality` 改调 `assessCrossPagePrimaryAnchorReuse`；fill 对该 reason break 不重试 | `test-cross-page-primary-reuse` |

| 2026-09-17 | evidence 三路空 markers | **P** | mark 挂依据；不挡 | — |



### 2.3h5 `signals_close.mark` · P6 打标+polish



**F 必须过**



- [x] 6 角非空 evidence；闭集 `⟦t:…⟧`；fanout merge 齐  

- [x] 锁锚落地：earth/water/jie_cai/bi_jian/zheng_cai/liuhe  



**P 可后修（不挡 unlock）**



- body 仍带 assign 月表截断腔（career）或 claim 种子腔；fill 用户层已压近阶  

- 卡3/4/5 金字过密 +「在机制上衔接/由此引动」垫语；卡0/2 同 `bare_ganzhi`  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-17 | 乙木·career mark#2 | **闸过 · 质量有条件 · unlock P** | merge 2 chunks；6 闭集齐；P：月表 body；→ book.assemble |

| 2026-09-17 | 乙木·relationship #2 | **闸过 · 质量有条件 · unlock → assemble** | merge 2 chunks；bare_ganzhi/zheng_cai/bare_ganzhi/乙庚合堆/酉酉半合堆/酉辰六合堆；P：叠金+垫语、identity 睡眠 KPI 起句、body≈claim |

| 2026-09-20 | 合伙·3cf20b08… mark#2 | **闸过 · 质量有条件 · unlock → assemble** | merge 2 chunks；wood/chong/banhe/bare_ganzhi/banhe/liuhe；闭集齐。**P**：切辅 body 误贴巩固文（与[4]同稿）+ evidence 仍「辅路=兼职试水」（#14）；[0] evidence 末回声 body；观察槽 evidence 掺熔断退回腔；[2]/[4] 同 `banhe` |




**已登记问题**



| 日期 | 问题 | 类 | 解法 | 回归 |

|------|------|----|------|------|

| 2026-09-17 | mark body 仍 1–10/11–20/21–30 截断（fill 已近7日） | **P→根已修** | assign 种子已压近阶；旧 Lab body 债不重跑；新 Lab 验 | `test-deep-evidence-assign` |



### 2.4 `book.assemble` · 预览拼书



**F 必须过**



- [x] 六页齐全：foundation / science / metaphysics / direct_answer / risk_guard / signals_close  

- [x] 预览可通读：主辅双轨一贯、P6 今晚+近7日+带走三样  



**P 可后修（不挡 · 整盘债汇总）**



- Lab assemble 只 dump `page_schema`（fill），`evidence: []` / 空 markers 常态——mark 在 arg tree，不进本预览  

- P2 essence 软腔 / P3 辅轨同模·关系角软修套语 / P4 软章尾·禁令腔 / P5 金字叠挂·摩擦模债 / P1「让男友变观察者」：见各步登记  

- **合伙盘**：#14 切辅颠倒（P5 switch / P6 day7[3] 仍把兼职叫辅）；P4 丁酉「转折前不硬冲」叠句；护栏「【护持感】符」软译腔

- dashboard score null（Lab 可后补）  



**签字**



| 日期 | Lab | 结果 | 备注 |

|------|-----|------|------|

| 2026-09-17 | 乙木·career assemble | **闸过 · 质量有条件 · unlock P** | 六页齐；渐进双轨主线通读成立；空 evidence=预览口径；本盘 Lab 30 步走完 |

| 2026-09-17 | 乙木·relationship assemble | **闸过 · 质量有条件 · unlock P** | 六页齐；渐进试水+休整双轨通读；P6 今晚+近7日+三带走；空 evidence=预览口径；**intimacy Lab（fp `1d592e5c…`）验收轮次结束（有条件）** |
| 2026-09-20 | 合伙·`3cf20b08…` assemble | **闸过 · 质量有条件 · 本盘 Lab 收口** | 六页齐；主=兼职试水·辅=全职硬条件（P1）通读成立；P6 今晚备忘录+近7日+三带走。空 evidence / dashboard null=Lab 预览口径。**整盘债**：#14 切辅颠倒贯穿 P5–P6 进预览；P4 丁酉 means 软章叠句；P5 护栏「【护持感】符」；science 手段偏密 |




**已登记问题**：继承各页 P；不另立 F。career + relationship + **合伙（C-合伙盘子 · `3cf20b08`）** 三盘 Lab 均有条件收口；后续矩阵 labs 4–5（岁运挤峰 / 资源表达薄）。硬债优先：**#14** 主辅切辅正名。



### 2.4 下游页（模板 · 开跑该页时复制填）



**`{page}.{stage}`**



**F 必须过**：（开跑前先写 3～5 条页特有风险）



**P 可后修**：



**签字记录**：



**已登记问题**：空表待填。



---



## 3. 方案 A 排队（呈现→事实边界上的债）



来自 P2 assign 签字时的 P 项，**下刀优先级**：



1. **claim_seed**：总纲每条 present 独立种子句 → 消比肩/六合同模（含 mark 孪生）。**部分已修**：foundation 禁「此表象说明结构上：」种子。  

2. **unit_claim 确定性重写**：禁「此表象说明结构上：」+ 全文粘贴 cite。**种子已修**；softPolish 仍挡模型粘贴。  

3. **foundation 表象候选配对**：**已修**（2026-09-17）`prefer_cite_must_match` + 禁 wrap-reuse/子面扩。回归 `test-deep-evidence-assign`。新 Lab 再签。  

4. **mark 同卡 slug 去重**：**已修**（2026-09-17）`dedupeSameCardWordSlots` + 禁「同时对应」等空垫。回归 `test-delivery-mark-adjacent-gold`。  

5. **P3 辅轨 unit_claim 去同模**：**已修**（2026-09-17）辅角·守位/旁路/换轨分化。回归 `test-deep-evidence-assign`。  

6. 再议 P3+ 是否 closed-menu（一页一轮；**deep assign 已闭集**）。  

7. **总纲菜单抽词质量**：**已修**（2026-09-17）`格局`∈hollow；裸六合禁菜单；长句六合；裸五行降权；archetype 不认格局。回归 `test-prealloc-thesis-menu` / `test-closed-menu-assign`。

8. **foundation `dimension_id` 维归属**：合伙盘（2026-09-20）食神/正印仍可错标 `day_master_strength`。修：restamp / softPolish 按 `buildThesisAssignMenu` 维，勿默认 day_master。回归 `test-foundation-surface-primary` + closed-menu。

9. **assign `unit_claim` 派工壳**：「本卡须证明：…」应在 assign polish 即 scrub（勿只靠 write 识别）。**合伙 mark 证实**：body 仍整段派工壳流入用户可见层 → polish body 同步 scrub。回归 agency gate 扩 claim/body 字段。

10. **write expand 禁 cite 整行粘贴**：`expandWriteEvidencePastFrictionShell` 勿 `pushUnique(calc_cite)` 原文（尤其 `label: answer` / `表象: 答句`）。只抽机制词或拆 label/answer 后拼白话。触发：合伙 write#10 卡0/2。回归 `test-third-party-agency-gate` 负例。

11. **assign slug↔inference 对齐**：锁 `chart_anchors[0]` / `necessary_signals[].slug` 后，inference/role/why **必须讲该 slug**（禁锁伤官写食神）。softPolish 或 seed 校验：slug 汉字/别名须出现在 inference，否则 restamp 或重写 inference。触发：合伙 P3 assign 主0。**write#6 已按伤官展，未放大错位**。回归 `test-deep-evidence-assign` / closed-menu。

12. **science write 禁神煞名单空壳**：辅角 evidence 不得停在「⟦w:slug⟧+一句软壳+太极贵人/月德/将星枚举」。须展 claim 路径句（回旋/修复/勿独扛）。触发：合伙 P3 write#6 辅0。回归 depth gate 负例。

13. **P4 claim 禁令尾/菜单指令粘贴**：`scrubAssignClaimBanSeed` 未清干净「勿写兼职工时协议 / 禁签约兼职顾问 / 禁财务安全垫 KPI」；`[3]`/`[5]` 可整段粘贴 feed 指令当 claim。扩 scrub 表 + 拒纯指令 claim。触发：合伙 P4 assign。回归 `test-deep-evidence-assign` / P4 claim 测。

14. **P5 切辅须对齐 P1 主辅**：**已修**（2026-09-20）种子钉 `backup_name`（非 `backup_when`）；P6 day7[3] 强制辅轨茎；`alignPrimaryBackupTrackProse` softPolish；feed `切辅钉名`。回归 `test-deep-evidence-assign` #14 块。**待新 Lab 验**（C-岁运挤峰盯 P5 switch / P6 day7[3]）。



**附 · P6 近7日禁月表**：已修 `normalizeNear7DayStem`（close hints + assign lock）。回归同上 assign 测。

**附 · 合伙盘（2026-09-20 · session `3cf20b08`）已修不入排队**：covered_agenda pivot 配对；rejection≠难开口焊模；`reserved_chart_primaries` 不饿死 foundation rematch；write 摩擦壳+「本卡须证明」识别扩写。



---



## 4. 更新检查清单（每次改交付相关代码）



1. [ ] 动的是 F 还是 P？F → 补/跑回归。  

2. [ ] 新穿闸真实句 → 写入对应步「已登记问题」+ fixture（只增不扔）。  

3. [ ] Lab 签字 → 填「签字记录」行（lab id + 日期 + 签的是哪一维）。  

4. [ ] 不把 P 项升级误判成「整步未过」而空转重试 LLM（规则 11）。



---



## 5. 一句话



**够格 = 事实可回归确认；好看 = 呈现可登记后修。**  

第三方施事在 P2 assign 已双盘签字；句模雷同是已知 P 债，交给方案 A，不推翻本轮通过。

