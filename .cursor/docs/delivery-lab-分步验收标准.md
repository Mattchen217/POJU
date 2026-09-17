# Delivery Lab · 分步验收标准（活文档）

> **用途**：Lab 30 步每步「什么叫够格可放行 / 什么必须当场拦 / 踩过什么坑 / 以后怎么优化」。  
> **原则**：一步步收紧，不追求单层文案完美；**往下游传的事实必须站得住**；呈现层可记后修。  
> **维护纪律**：每步肉眼签或穿闸后，**同日**追加「问题 / 解法 / 回归 / 后续」；禁止只口头记。  
> **相关**：`delivery-lab-逐步生成查验台.md` · **参考尺** `Delivery-Lab-30步分步验收标准.md`（逐步过程）· `六页交付内容质量验收标准.md`（内容）· Canonical `pivot-八页交付验收标准.md` · `D1-closed-menu-assign-复盘与换链路方案.md` · 规则 `11`  
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

## 1. 步骤索引（30 步）

| # | step_key | 状态 | F 底线摘要 | 回归 |
|---|----------|------|------------|------|
| 1 | `bootstrap` | 骨架 | 盘/问题可解析 | — |
| 2 | `thesis.gen` | **有尺** | 六维 present 可验；藏干不漏 | 总纲双议题 / 藏干正反例 |
| 3 | `prealloc` | **有尺·已修根** | 只从总纲 menu 取词；grounded 闸 | `test-prealloc-thesis-menu` |
| 4 | `foundation.assign` | **已签（第三方）** | closed-menu + 无第三方施事 | `test-third-party-agency-gate` |
| 5 | `foundation.write` | **闸已接** | evidence 不得把本盘写成第三者心理/施事；软修+分层句模 | `test-third-party-agency-gate`（含 write 负例） |
| 6 | `foundation.write_merge` | 待填 | 合并不丢锁词 | — |
| 7 | `foundation.fill` | **有尺** | 只压缩不新判；末卡主辅收束；不丢 write 限定 | 八页尺 |

| 8 | `foundation.mark` | **有尺** | 闭集打标；无空树；P 已登记不挡 unlock | 相邻金字 / 双盘肉眼 |
| 9–13 | P3 `science_action.*` | **assign closed-menu** | 深页闭集锁锚；禁 free-select 拖满 270s | `test-closed-menu-assign` |
| 14–18 | P4 `metaphysics_action.*` | 待填 | 五行关系链 / 勿模板元素句 | — |
| 19 | `direct_answer.fill` | 待填 | 答案清晰 | — |
| 20–24 | P5 `risk_guard.*` | 待填 | — | — |
| 25–29 | P6 `signals_close.*` | 待填 | 近阶勿写成宿命预言 | — |
| 30 | `book.assemble` | 待填 | 六页齐；预览可通读 | 八页尺 |

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
- [ ] 表象候选 label/answer 错配（菜单绑歪）— **若错配导致 F 事实错误则升级为 F**

**签字记录**

| 日期 | Lab | 结果 | 备注 |
|------|-----|------|------|
| 2026-09-10 | `lab_mtvapkdl_…` 盘1 乙木/创业 | **第三方维签字** | #12；合作句模雷同记 P |
| 2026-09-10 | 盘2 焦虑/男友 | **第三方维签字** | 卡3 子未相害不再推男友施事；cite 标题错配记 P |
| 2026-09-16 | 乙木·career 重开（制造业/新能源邀约） | **闸过 · 质量有条件** | closed-menu+无第三方施事；卡3 六合 inference 空壳孪生；卡0 soft 腔 — 见下行 P |

**已登记问题**

| 日期 | 问题 | 类 | 解法 | 回归 | 后续 |
|------|------|----|------|------|------|
| 2026-09 | 开放选词漏桶 | F | D1 closed-menu | `test-closed-menu-assign` | 选词层**闭合停投** |
| 2026-09 | 伙伴期望 / 男友反对 | F | 施事者闸 + 关系/合作分层句模 | `scripts/fixtures/third-party-attr/` + `test-third-party-agency-gate` | 新穿闸→入库 |
| 2026-09-10 | 「你让男友…抵触」主语绕写 | F | 使役结构也算施事 | fixture `03-querent-subject-bypass` | — |
| 2026-09-10 | 亲密句模焊到创业伙伴 | P→修 | 亲密/合作 surface 分流 | agency 测内断言 | — |
| 2026-09-10 | 比肩/六合 inference 逐字同模 | **P** | 已知权衡；不挡签 | — | **方案 A claim_seed** 优先消 |
| 2026-09-10 | unit_claim 薄粘贴 | P | softPolish 未打干净 | — | 确定性重写 claim |
| 2026-09-10 | 盘2 表象 label/answer 错配 | P | 未修 | — | foundation surface 配对 |
| 2026-09-10 | 盘2 write 卡3 子未相害 | **F** | assign 已过；write 又写「伴侣…价值否定」「男友的反对…是子未相害」 | **write 接施事软修+句模焊**；fixture `04-write-boyfriend-value-negation` | Lab **准备重跑** write 再签 |
| 2026-09-16 | 卡3 锁裸 **`六合`**：claim 已写「辰酉六合」，但 `inference_zh` 沦为卡0同款 soft「绑定与投入压力」，与人脉/硬功夫 claim **不对题** | **P**（逼近 F） | 不挡 unlock；不 LLM 重试 | — | **方案 A #7**；write 盯是否放大空壳；若删依据仍垮不了 → 升 F 修菜单+句模 |
| 2026-09-16 | 卡0 干合：claim 较满，inference/why 偏 soft 配合位句模 | **P** | 不挡 | — | 方案 A #1/#2 |
| 2026-09-16 | 卡1 比肩、卡2 正财、卡4 巳寅相刑：承重与表象配对可用 | — | 正向样本 | — | 可作 fixture |
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

**已登记问题（本步）**

| 日期 | 问题 | 类 | 解法 | 回归 | 后续 |
|------|------|----|------|------|------|
| 2026-09-16 | 卡3 `六合`：claim=辰酉六合→人脉硬功夫，evidence 仅 soft「绑定与投入压力」 | **P→逼近 F** | write 提示强制展 claim | `test-deep-write-depth-gate` | **#10 已改善**（人脉/六合化金入 evidence）；残「绑定压力」句可后修 |
| 2026-09-16 | 卡0 干合：evidence≈配合位 soft，未展开 claim 的邀约/官杀绑定/降薪 | **P** | 提示已禁套话；#10 **仍复发** | 同上 | 方案 A #1/#2；不挡 unlock；fill/成书抽检盯卡0 |
| 2026-09-16 | 卡1 单句逗号串 → merge shallow | **F** | 句读尺+chunk/Lab 闸 | 同上 | **#10 已过** |
| 2026-09-16 | 卡1 比肩、卡2 正财、卡4 巳寅相刑（#10） | — | 正向 | — | — |

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

**已登记**

| 日期 | 问题 | 类 | 后续 |
|------|------|----|------|
| 2026-09-16 | 卡0 essence「配合位置」软腔，未点干合/官杀绑定（用户层） | **P** | 同 write 卡0；mark 依据层仍有锚 |
| 2026-09-16 | 卡3/4 essence 偏「能量结构」概括，六合化金/寅巳刑细节略丢 | **P** | 不挡；mark 用 plan evidence 补 |

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

**已登记问题**

| 日期 | 问题 | 类 | 解法 | 回归 | 后续 |
|------|------|----|------|------|------|
| 2026-09-16 | 卡0 六金连挂 +「同时对应/以及这里/与此相关/并在此处」薄垫 | **P** | 确定性去重/垫词；或限每卡金密度 | 邻金测 | soft-repair；不挡 |
| 2026-09-16 | 卡4 si∥yin∥xing 仍「同时对应/以及这里」 | **P** | 同上 | — | soft-repair |
| 2026-09-16 | 卡0 evidence「配合的位置」vs body 官杀绑定（双层不一致） | **P** | 同 write/fill 卡0；body 已够承重 | — | 方案 A #1 |
| 2026-09-10 | mark 同卡重复 slug 金字 | **P** | 确定性去重 / 禁「同时对应」空垫同词 | 邻金测可扩 | soft-repair 层 |
| 2026-09-10 | mark 仍吃 write cite 错配 | **P** | 不修 mark；修 foundation 表象配对 + write | — | 方案 A #3 |
| 2026-09-10 | 末卡 `shi_shen`/metal 承重弱 | **P** | 末卡种子绑主辅锚 | — | fill/末卡 prompt |
| 2026-09-10 | 盘1 卡2∥4 配合句模孪生 | **P** | 同 assign 比肩/六合同模债 | — | 方案 A #1 claim_seed |

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



---

**签字记录**

| 日期 | Lab | 结果 | 备注 |
|------|-----|------|------|
| 2026-09-16 | 乙木·career 重开 | **闸过 · 质量有条件** | closed-menu units=6；主轨三角 claim 分化 OK（试水/内部再平衡/能量优先）；辅轨三角 unit_claim+calc_cite 逐字同模「以守为进…」→ P=#5；写盯辅轨同模放大 |
| 2026-09-16 | 同上 · assign #3（跨页修后） | **闸过 · 质量有条件** | 主锚食神/劫财/正官/正印/伤官/丙午 · **与 P2 无撞**；无裸纳音柱；辅轨三同模仍 P=#5；主1 金舆天德旁注 P；可 unlock write |
| 2026-09-16 | 同上 · write 齐套（修前） | **闸不过** | 旧稿 cross_page jaccard=0.83；已被 #12 取代 |
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

**已登记**

| 日期 | 问题 | 类 | 后续 |
|------|------|----|------|
| 2026-09-16 | 辅轨三角策略仍共小生态/跳槽/新能源观察 | **P** | 方案 A #5 |
| 2026-09-16 | 多角「今晚」手段偏密（示意过满） | **P** | fill 手段密度；不挡 |

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

**已登记**

| 日期 | 问题 | 类 | 后续 |
|------|------|----|------|
| 2026-09-16 | 卡0 `shi_shen` 同卡三挂；卡1 `jie_cai` 双挂 | **P** | soft-repair 去重 |
| 2026-09-16 | 辅轨三角 body 仍逐字同模「以守为进…」 | **P** | 方案 A #5 |
| 2026-09-16 | 主1 body 残留金舆/天德旁注（未打标） | **P** | 成书抽检 |

---


### 2.3e `metaphysics_action.assign` · P4 派工

**F 必须过**

- [ ] closed-menu + moat×anchors：timing 可用岁运干支（丁酉）；archetype 须十神；polarity 须身弱/用忌**或裸五行（土/水等忌用元素）**  
- [ ] 闭集按 `moat_class` 优先派词；restamp 后再验 moat；失败先 slot-swap 软修（禁把本页全部主词塞进 avoid）  

**签字**

| 日期 | Lab | 结果 | 备注 |
|------|-----|------|------|
| 2026-09-16 | 乙木·career | **闸不过→已修** | `moat_anchor_mismatch:dimensions[1]:timing` 裸丁酉被拒；已认岁运干支为 timing；P4 闭集 moat 优先派词 + restamp 后软修 |
| 2026-09-17 | 乙木·career #2 | **闸不过→已修** | `dimensions[0]:polarity` 裸「土」；polarity 认裸五行；moat 派词禁 generic fallthrough；`softRepairPlannedMoatLocks` slot-swap；勿 avoid 本页全主词 |

---

### 2.4 下游页（模板 · 开跑该页时复制填）

**`{page}.{stage}`**

**F 必须过**：（开跑前先写 3～5 条页特有风险）

**P 可后修**：

**签字记录**：

**已登记问题**：空表待填。

---

## 3. 方案 A 排队（呈现→事实边界上的债）

来自 P2 assign 签字时的 P 项，**下刀优先级**：

1. **claim_seed**：总纲每条 present 独立种子句 → 消比肩/六合同模（含 mark 孪生）。  
2. **unit_claim 确定性重写**：禁「此表象说明结构上：」+ 全文粘贴 cite。  
3. **foundation 表象候选配对**：label 与 answer 对齐后再进 assign（消 mark 卡3/4 错配）。  
4. **mark 同卡 slug 去重**：encode 前剥重复 `⟦t:同slug⟧` / 禁空垫「同时对应」再打同词。  
5. **P3 辅轨 unit_claim 去同模**：backup 各角独立 claim 种子（禁三卡同一段「暂守原职…」）。  
6. 再议 P3+ 是否 closed-menu（一页一轮；**deep assign 已闭集**）。  
7. **总纲菜单抽词质量**：禁叙述壳（`格局`）；关系取最长完整句（禁裸 `六合`）；裸五行/裸柱降权，优先十神·刑冲·干合·用神具体词。触发：P2+ 若薄词锁成主承重 → 升 F 先修菜单。

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
