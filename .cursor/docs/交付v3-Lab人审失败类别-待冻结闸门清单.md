# 交付 v3 · Lab 人审失败类别 → 待冻结闸门清单

> **地位**：Step①「无质量闸」阶段的退出账本。人审发现的是**类别**；提示词先钉死；达标后冻结提示词 → 类别进 Phase B 机闸（只验不改）。  
> **操作流程**：`交付v3-Lab人审与升闸操作手册.md`（跨会话必遵；本文件只记账本与门槛）。  
> **对齐**：`交付报告-三步链路-架构.md`（Phase A 形状 / Phase B 类别硬尺）· `01-delivery-iron`（闸门定尺 · 禁案例补丁 · 禁追句 strip）。

## 0. 退出标准（硬 · 防无限拖）

| 项 | 默认值 | 说明 |
|----|--------|------|
| **N** | 连续 **3** 次人审通过 | 同页同步（如 P1 批断、P1 正文）在提示词冻结候选后，不再因同类别翻车 |
| **M** | **3** 种差异盘 | 议题/格局/岁运姿态明显不同（禁同一合伙案反复凑数） |
| **冻结动作** | 达标当日 | ① 标注 prompt 文件 commit/指纹为冻结候选 ② 把下表「待 Phase B」行升为机闸规则 ID ③ Lab 该步人审降为抽检 |

未达 N×M：**禁止**争论「要不要加闸门」——继续人审攒类别，或改生成侧；不把主观感觉当退出条件。

达 N×M 后：**必须**冻结 + 转闸；禁止「再看几案再说」无限延期。

### 提前升闸（硬 · 防「通过了再跑又废」）

下列任一成立 → **立刻**把该类升成机闸（不必等满 N×M），否则 Lab「本步通过」无回归意义：

1. 类别已写入 duty，且**同盘同题重跑**再次命中；或  
2. 同一类别在 ≥2 个 Lab attempt 上重复出现。

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
| `p1j_situational_subject` | claim/evidence 主语禁投入形态与处境词（含话语权/名分）；官杀藏停在「制衡位/约束位不显」 | #1 兼职试水；#2 稳定收入；#3–4 话语权 | `content-judgment.ts` duty | **已升** `gate_judgment_situational_path_words` |
| `p1j_match_close` | 禁「结构匹配 / 更合结构 / 可保…」半祈使收束；停在张力词 | #5 守补给为结构匹配 | 同上 | **已升** `gate_judgment_match_close` |
| `p1j_yong_stance` | 大运扶用时禁「用神弱」字面；只写岁运冲突下承压/窗口收窄 | #5 calc_cite 用神水弱 | 同上 | 待 |
| `p1j_future_qimen` | backup 禁未来门象现编；切辅只写岁运/用忌松动 | #2 生门/开门 | 同上 | 待 |
| `p1j_path_shape` | 恰好 3 path：core_judgment / primary / backup；主轴勿同骨架 | 形状（Phase A 已部分覆盖） | gate-phase-a + duty | 部分已有形状 |

**P1 批断冻结进度**：同案已人审通过 1 次（#6）；**差 N−1 与 M 异盘**。

### 2.2 P1 正文 `content.body` · `direct_answer`

| ID | 类别（尺） | Lab 露出（仅溯源） | 生成侧落点 | Phase B |
|----|------------|-------------------|------------|---------|
| `p1b_visible_jargon` | 可见字段禁十神/干支/用喜忌；禁大运·流年·**流月**字面（含流月窗口/金水） | #1 流月喜神金 | `body-prompt.ts` duty | 待 |
| `p1b_invented_number` | 缓冲月数等须来自喂料；禁自造「X个月内」 | #1 三个月内 | 同上 | 待 |
| `p1b_fact_conflict` | when/路须与 collecting 已给事实同向（已拒≠尚未拒绝） | #2 when 尚未拒绝兼职 | 同上 | 待 |
| `p1b_backup_axis` | backup 须从批断 backup 长出（近窗可切）；禁另编更保守第三撤退轨 | #2 暂缓绑定拧轴 | 同上 | 待 |
| `p1b_no_p3p4` | 禁塞 P3 法务里程碑 / P4 谋略段；禁三块 prose dimensions | duty 已有 | 同上 | 待 |

**P1 正文冻结进度**：尚未连续通过；本清单写入时仍在人审循环。

### 2.3 P2（摘要 · 更早轮次已过）

| ID | 类别（尺） | 生成侧落点 | Phase B |
|----|------------|------------|---------|
| `p2_visible_jargon` | surface/essence 零专名（含宫位/合冲/岁运/十神用忌） | `body-prompt.ts` foundation duty | **已升** `gate_p2_body_visible_jargon` |
| `p2_no_imperative_close` | 禁祈使/条件式怎么办收尾；停在结构张力 | 同上 | **已升** `gate_p2_body_essence_imperative` |
| `p2_thickness` | essence 厚度；非目录壳 | 同上 | 待 |
| `p2_no_qimen_axis` | P2 归因不喂奇门、不作门宫主轴（知局归 P4） | duty + `stripQimenBlocksForFoundationAttribution` | **已升** `gate_p2_qimen_axis` |

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
| `lib/llm/pro/delivery/pipeline-v3/scrub-judgment-feed.ts` | 批断喂料 scrub |
| `lib/llm/pro/delivery/lab/run-step-v3.ts` | Lab 执行；内容步挂 early 闸 |

## 6. 下一步（Lab 测稳后 · 已立案）

生产失败信号落地 → **闸门运维收集台**：见 `交付v3-闸门运维收集台-待建.md`（字段完整、形态薄、按周聚类修 prompt；禁自动抽奖重试）。

---

最后更新：2026-09-29 · 覆盖至 P2 正文专名/怎么办升闸；操作手册已立；收集台待 Lab 测稳后开工。
