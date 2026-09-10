# PLAN · 走到 Delivery Lab 可测总纲

> **目标**：你能在 https://www.easternos.com/ops/delivery-lab 上单独点跑并肉眼核对「命盘总纲」。  
> **顺序判断**：你提的三步顺序 **正确**；本 PLAN 只补状态事实与可执行切分。  
> **最后更新**：2026-09-09

---

## 0. 对你推荐进度的裁决

| 你的步骤 | 裁决 | 说明 |
|----------|------|------|
| ① Wave 0 硬伤先确认 | ✅ 必须最前 | 用户可见破损、成本低；不该被总纲工程拖死 |
| ② 总纲生成本体 | ✅ 主线 | 数据供给已通；缺口在「写出可举证批断」的质量与可独立验收 |
| ③ assign / write 后置 | ✅ 正确 | 总纲未验稳就接下游 = 又回黑盒 |

**需要写 PLAN 再推进吗？**  
需要。下面这份就是执行契约；按 Phase 推进，每 Phase 有退出条件，直到 Lab 可测。

---

## 1. 现状快照（2026-09-09 核过）

### 已通

- 本命 Layer1 → `TopicCalcSupplement`（二算）→ `buildThesisCalcFeed`（按维映射，非整包 dump）
- 方案 B：无 `near_term_bias`；流日不进二算 v1；relations↔rhythm 1:1
- Lab 已有步骤 `thesis.gen`（`run-step.ts`），UI 链路存在

### Wave 0（硬伤）— 关闭记录（Phase A）

| 项 | 冒烟 | 状态 |
|----|------|------|
| Locale 胶连 `锚元water` / `耗元fire` | `test-delivery-zh-evidence-no-en-tokens` | ✅ 2026-09-09 复跑绿 |
| 未解析 `【气候交织】` | 同上 + soft encode | ✅ 复跑绿 |
| 岁环 / 气候交织 reuse 双计 | `test-glossary-suilhuan-qihou-boundary` | ✅ 复跑绿 |
| 依据残骸 `【火】【水:水】` 闸 | `test-evidence-remnant-gate` | ✅ 复跑绿 |

**Wave0: closed（冒烟层）** — 若线上旧样本仍见残影，按个案开票，不挡 Phase B。

---

### 总纲生成本体 — 半成品

| 件 | 状态 |
|----|------|
| `buildThesisCalcFeed` | ✅ 已吃二算（按映射） |
| `buildJudgmentCoreFromFeed` | ⚠️ 有：`classical_basis`=checklist；`conclusion_zh`=条目拼接（偏薄，未达规范「通顺批断段」深度） |
| `ensureJobChartThesis` | ⚠️ 有壳：调 `buildChartThesisFromStructured`，**未显式传** `question_category` / `as_of` / 预建 supplement（feed 会默认自建二算，但 Lab/job 接线不完整） |
| Lab `thesis.gen` | ⚠️ 能跑，但同样未传题类；无「议题不污染」对照验收门 |
| 独立 inspect（类比二算） | ❌ 缺 `inspect-chart-thesis.ts` |
| assign / write 契约 | ⏸ 按你说的：总纲验绿后再动 |

---

## 2. Phase 划分与退出条件

### Phase A — Wave 0 关闭（插队）

**做：**

1. 对照计划清单勾：locale 泄漏、【气候交织】裸括号、岁环双定义、残骸闸。  
2. 缺哪项补哪项 + 冒烟；全绿则在本 PLAN 标记 `Wave0: closed`。

**退出：** 清单全部 ✅ 或明确「已知残留 + 不挡 Lab」的书面例外。

### Phase B — 总纲生成本体（主线）

**做：**

1. 按《命盘总纲与依据渲染规范》：核对清单驱动；空项写「未见相关特征」；禁止示例套句。  
2. 生成顺序：`day_master_strength` 最先；favor / interpersonal 显式挂强弱前提（已有雏形则加固）。  
3. `buildChartThesisFromStructured` / `ensureJobChartThesis` / Lab：显式传入 `as_of`、`question_category`，二算与 feed 同源。  
4. 加厚 `conclusion_zh`（仍确定性、非 LLM 编造）：在 checklist 真句上做通顺连接，**不**发明清单外事实。  
5. 回归：同一 `structured` + 同一二算输入，两个不同 agenda → `classical_basis` 与判断性 `conclusion` 事实一致，仅 depth/篇幅可变。  
6. **`scripts/inspect-chart-thesis.ts`**：三盘 + 双议题打印，供肉眼核「空项是否老实」。

**退出：** inspect 人工可过；双议题回归单测绿；Lab 本地能点跑 thesis 并看到六维内容。

### Phase C — Delivery Lab 可测（你的验收面）

**做：**

1. Lab `thesis.gen` 展示：各维 classical_basis / conclusion / depth；标记 absent。  
2. 可选：Lab 增加「双议题对照」或文档说明如何用同一 source 换 question 重跑。  
3. 部署后你在 `easternos.com/ops/delivery-lab` 点跑验收。

**退出：** 你确认能在线上 Lab 独立验收总纲，再开 Phase D。

### Phase D — assign / write（总纲合格后）

**入口纪律（你方签字要求）：** 延续总纲验收习惯——**真实案例肉眼核对**优先于「格式对、字段全、单测绿」。assign 抽 `necessary_signals` / `inference_zh` 时，至少用本会话乙木弱盘（或同类）核对：引用的维是否真有该结论、推论是否贴盘、删依据是否会垮。

**做：**

1. assign：`necessary_signals` + `removal_test`；thesis cite（`dimension_id` + `inference_zh`）须贴合总纲 checklist，禁粘贴 `conclusion_zh`。  
2. Lab：跑 `foundation.assign`（及后续页）并展示 signals / removal_test，便于人工对照总纲六维。  
3. write/mark：关系链通顺句、禁括号拼接（在 assign 准头稳后再加深）。  

**已知并行债（不挡 D 开跑闸门改造，但勿当新链终态）：** 正式交付 / Lab 下游仍可能吃旧 `breakthrough_core` 脊柱；题向收敛未独立成步。D 阶段优先把 **总纲→assign 引用准头** 做实，再拆 Call A 喂养。

**D0 闸门（2026-09-10 · 真实乙木 P2 assign 打回后）：**  
有总纲时每条 `necessary_signal` **必须** `dimension_id`+`inference_zh`，且 **slug 必须出现在该维 present 事实原文**；否则 `thesis_gap`。prealloc prefer 若不在总纲事实中则丢弃（防神煞/长生影子池硬塞）。

**硬闸（非仅提示词 · 换人换盘仍须成立）：**
- `thesis_gap:third_party_attr` — 解释层（inference/role/why）出现「第三者主语×意愿/要求」；不扫描表象 unit_claim/calc_cite  
- `slug_changsheng_parked` / `slug_too_generic`（含藏干等）/ `slug_bare_ganzhi` — 十二长生与空壳/单干支不得承重；须落到总纲具体词核  
- `signal_count_mismatch` — rationale「N个」须等于实际 signals 条数  
- `cycle_ganzhi_not_in_thesis`；slug 跨本页复用 cap；prefer/anchors 不得注入总纲未验证影子池  
- 提示词同口径；验收以硬闸为准。**禁止**只对某一盘某一词加 if。  

**D1 closed-menu（2026-09-10 · foundation）：**  
开放选词 + 后置剥错已判定为漏桶。P2 `foundation` 在有 `chart_thesis` 时改为：

1. `buildThesisAssignMenu` — 仅总纲 present 可验词核（无神煞/长生/空壳/裸干支）  
2. `preallocateFoundationSignals` — 每卡恰好 1 个 `locked_signals`（slug+dimension_id），页内主词唯一  
3. 模型只写 role / why_needed / inference_zh；parse **强制覆盖** slug/维/条数  
4. 无总纲或菜单空 → `assign:menu_empty*` 显式 fail（**不**回退自由选词）  
5. 合法性类闸由菜单承担；保留 `third_party_attr` / 跨页 role·inference 复读等推理闸  

其它 deep 页暂走旧路径；Lab 与正式 DAG 共用同一 assign。两盘肉眼绿后再推 P3+。

**供应商限流（413/429）**：属运营常态，非交付闸门 bug。正式交付走 DAG 队列 + admit + attempt≥2 provider escape（StreamLake→DigitalOcean）；Lab 双开易撞 StreamLake token rate — 错开或等重试即可。

**前提：** Phase B+C 绿（已满足）。

---

## 3. 明确不做（本阶段）

- 用 LLM 填真算判断 / classical_basis  
- 二算再引入流日或 near_term_bias  
- 未经验总纲就大改 assign/write  
- 整包 TopicCalcSupplement dump 进总纲 prompt  
- **现在**把神煞/十二长生扩进总纲六维（见下方 backlog，禁止影子池旁路）

---

## 3b. Backlog · 神煞 / 十二长生扩总纲（正式条目 · 非口头）

| 字段 | 内容 |
|------|------|
| **ID** | `THESIS-EXPAND-SHENSHA-CHANGSHENG` |
| **目标** | 将神煞、十二长生纳入总纲可验证范围后，才允许 assign 引用；与六维同等 checklist + 去掉测试 + 人工肉眼核实 |
| **不做捷径** | 禁止未扩维前用影子池 / prefer 硬塞进 assign |
| **入口条件** | Phase D assign 硬闸稳定（slug 接地 + third_party + cycle_ganzhi）+ 至少 2 盘真实案例 assign 肉眼签字 |
| **工作包** | (1) 定流派闭集与本盘取用规则 (2) 新维或挂靠现有维 + judgment checklist (3) inspect/Lab 可读 (4) 扩 `validateAssignmentThesisCoverage` 白名单 (5) 乙木+至少一异盘肉眼签 |
| **负责人** | 产品验收：你；实现跟进：Cursor 会话 / 交付链 owner（开跑时指定） |
| **建议开跑窗口** | Phase D assign 准头绿之后、Phase write 加深之前（约 D→E）；**不**与 D0 止血并行 |
| **状态** | `parked` · 2026-09-10 记入；未开跑 |

---

## 4. 执行节奏

1. ~~Phase A Wave 0~~ — **closed（冒烟层）** 2026-09-09  
2. ~~Phase B~~ — **closed（人工 inspect 签字）** 2026-09-10  
3. ~~Phase C~~ — **closed（真实乙木案例 Lab 签字）** 2026-09-10：透干/藏干/兼藏根气、as_of、category、议题 depth 均经肉眼核对  
4. **Phase D 开跑**：assign `necessary_signals` + Lab 可验；**D1 foundation closed-menu 已落地**；write 次之；其它 deep 页待 P2 两盘签字后推  
5. **Phase E（parked）**：`THESIS-EXPAND-SHENSHA-CHANGSHENG` — 见 §3b  

本地先自检：

```bash
pnpm test:thesis-calc-feed
pnpm exec tsx scripts/inspect-chart-thesis.ts
```

Lab：https://www.easternos.com/ops/delivery-lab → Thesis 通过后 → `foundation.assign` 对照本盘总纲。
