# Delivery Lab · 分步验收标准（活文档）

> **用途**：Lab 30 步每步「什么叫够格可放行 / 什么必须当场拦 / 踩过什么坑 / 以后怎么优化」。  
> **原则**：一步步收紧，不追求单层文案完美；**往下游传的事实必须站得住**；呈现层可记后修。  
> **维护纪律**：每步肉眼签或穿闸后，**同日**追加「问题 / 解法 / 回归 / 后续」；禁止只口头记。  
> **相关**：`delivery-lab-逐步生成查验台.md` · `pivot-八页交付验收标准.md`（成书尺子）· `D1-closed-menu-assign-复盘与换链路方案.md` · 规则 `11`

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
| 3 | `prealloc` | 骨架 | 全书 primary 不撞硬约束 | — |
| 4 | `foundation.assign` | **已签（第三方）** | closed-menu + 无第三方施事 | `test-third-party-agency-gate` |
| 5 | `foundation.write` | **闸已接** | evidence 不得把本盘写成第三者心理/施事；软修+分层句模 | `test-third-party-agency-gate`（含 write 负例） |
| 6 | `foundation.write_merge` | 待填 | 合并不丢锁词 | — |
| 7 | `foundation.fill` | 待填 | 正文不泄漏禁词；药从盘长 | 八页尺 |
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
- [ ] prefer 若不在总纲事实中则丢弃（防影子池）  

**P**：稀疏页少卡可接受。

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
- [ ] 须展开 locked `inference_zh`，禁止写成「男友反对是因为子未相害」  
- [ ] 代码：`polishWriteChunkUnits` / `softRepairWriteEvidenceProse`；仍脏则 `write:third_party_attr` **显式 fail**（不 LLM 重试）

**签字记录**

| 日期 | Lab | 结果 | 备注 |
|------|-----|------|------|
| 2026-09-10 | 盘1 乙木/创业 | 有条件过 | 卡3 踩线复述伙伴要求，机制仍落你侧 |
| 2026-09-10 | 盘2 焦虑/男友 | **不过→已修闸** | 卡3 回潮；请重跑 write 再签 |

**命令**：同 §2.3（含 write 负例）。

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
| 2026-09-10 | 盘1 乙木/创业 | **闸过 · 质量不签** | 卡2∥4 句模孪生；末卡承重弱 → P |
| 2026-09-10 | 盘2 焦虑/男友 | **闸过 · 质量不签** | 双酉/双比肩重复金字；卡3/4 cite 错配；末卡软 → P |

**已登记问题**

| 日期 | 问题 | 类 | 解法 | 回归 | 后续 |
|------|------|----|------|------|------|
| 2026-09-10 | mark 同卡重复 slug 金字 | **P** | 确定性去重 / 禁「同时对应」空垫同词 | 邻金测可扩 | soft-repair 层 |
| 2026-09-10 | mark 仍吃 write cite 错配 | **P** | 不修 mark；修 foundation 表象配对 + claim | — | 方案 A #3 |
| 2026-09-10 | 末卡 `shi_shen`/metal 承重弱 | **P** | 末卡种子绑主辅锚 | — | fill/末卡 prompt |
| 2026-09-10 | 盘1 卡2∥4 配合句模孪生 | **P** | 同 assign 比肩/六合同模债 | — | 方案 A #1 claim_seed |

---

### 2.3d `science_action.assign` · P3 派工

**F 必须过**

- [ ] D1 **closed-menu**（slug/dim 代码锁死；禁 free-select）  
- [ ] 270s 内正常 STOP；`llm_timeout` = 结构失败（不 LLM 空转重试）  
- [ ] closed-menu `max_tokens` ≤ 8k；超时仍 `PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS`（270s）

**已登记问题**

| 日期 | 问题 | 类 | 解法 | 回归 | 后续 |
|------|------|----|------|------|------|
| 2026-09-11 | free-select + 20k 吐 13k 未 STOP → `assign:llm_timeout` | **F** | deep 页一律 closed-menu + 8k 上限 | `test-closed-menu-assign` | Lab 准备重跑 assign |

**命令**

```bash
pnpm exec tsx scripts/test-closed-menu-assign.ts
pnpm exec tsx scripts/test-thesis-gap-coverage.ts
```

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
5. 再议 P3+ 是否 closed-menu（一页一轮，不假设照搬）。

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
