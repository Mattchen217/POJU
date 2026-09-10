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

### Phase D — 后置（本 PLAN 不抢跑）

- assign：`necessary_signals` + removal_test  
- write/mark：关系链通顺句、禁括号拼接  

**前提：** Phase B+C 绿。

---

## 3. 明确不做（本阶段）

- 用 LLM 填真算判断 / classical_basis  
- 二算再引入流日或 near_term_bias  
- 未经验总纲就大改 assign/write  
- 整包 TopicCalcSupplement dump 进总纲 prompt  

---

## 4. 执行节奏

1. ~~Phase A Wave 0~~ — **closed（冒烟层）** 2026-09-09  
2. ~~Phase B~~ — **closed（人工 inspect 签字）** 2026-09-10：不编造 / 不污染 / 不过期（as_of 进 cache key）已验；conclusion 加厚与 premise 织入属后续  
3. **Phase C 进行中**：Lab `thesis.gen` 六维可读面板（classical_basis / absent·STUB / depth / conclusion）；部署后你在 delivery-lab 点验收  
4. **Phase D**：你点头后再做 assign/write  

附记（不挡 C）：深度分配是粗糙关键词（钱财/表达/家人…）；**空维强制 brief**（弱盘人际无官杀比劫 → 即使议题命中家人也 brief）。后续可加厚词表，勿用议题改写 classical_basis。

本地先自检：

```bash
pnpm test:thesis-calc-feed
pnpm exec tsx scripts/inspect-chart-thesis.ts
```
