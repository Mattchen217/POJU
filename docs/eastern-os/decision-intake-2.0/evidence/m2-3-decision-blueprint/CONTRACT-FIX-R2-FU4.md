# M2.3-R2-FU4 — Understanding 异常经真实 Agent 链 fail-closed（不自宣 PASS）

**状态：** 实现已推送；等待 Max 独立复审。**不得自宣产品 PASS。**

## Git（提交后由报告填写；本文件不预填自指 tip）

| 字段 | 值 |
|------|-----|
| Branch | eat/m1-r-fresh-session-main-loop |
| Parent (开工基线) | 4a415bbfef31c1c633aab363966e307d91f0b4b |
| Implementation commit | abd9f5bba6c1a03521bf564ea244c604d253a07 |
| Evidence commit | *(evidence commit SHA; see report — not pre-filled)* |
| Final branch HEAD | *(report only — do not self-hash tip into this file)* |

Note on FU3 tip lag: FU3 evidence tables recorded tip 9f8001b8 while branch tip later became 4a415bb because evidence tried to name its own commit. FU4 avoids that by leaving tip out of the evidence body.

## 目标

让真实 Agent 调用链在 Understanding 构建异常时进入 planner_blocked，并证明不会调用普通 LLM：

handleUserMessage → runM1ProductionPreLlmTurn → runCollectingDcTurn → runAdaptiveQuestionTurn → Understanding build → catch rebuild → planner_blocked → Agent early return

## 实现摘要

### 1. lib/poju/decision-intake/adaptive-turn.ts
- 新增 AdaptiveTurnTestHooks（eforeUnderstandingBuild）。
- 
unAdaptiveQuestionTurn 接受可选 	est_hooks；内部统一 uildUnderstanding 包装全部 Understanding 构建入口（replay / !applied / main / catch rebuild）。
- catch 末尾：无有效 Understanding 时**不再**返回 
eady_no_question；!u && blueprint → planner_blocked + understanding_exception:；其余异常 → planner_blocked + planner_exception:。

### 2. lib/poju/collecting-dc-turn.ts
- 
unCollectingDcTurn / 
unM1ProductionPreLlmTurn 透传 	est_hooks。
- 未传 Hook 时行为与生产一致。

### 3. lib/poju/agent.ts
- HandleInput.__testOnlyM1Hooks 传到 
unM1ProductionPreLlmTurn。
- m1UnderstandingFailClosed 收紧为：无授权问句且（planner_blocked / understanding_exception / planner_exception / understanding==null+Blueprint）。
- 提前返回：collecting_context、daptive_ask_plan: null；不进普通 LLM / awaiting_confirmation / Freeze / 报告。

### 4. 测试 scripts/test-m2-3-decision-blueprint.ts
- Case E：**删除** question_budget.hard getter 注入；改经 __testOnlyM1Hooks 在 Understanding 入口连续抛两次；断言 attempts=2、m1_planner_blocked、understanding_exception、LLM fetch delta=0、无确认/Freeze/报告、P0 未自动 known/n_a、保持 collecting_context。
- Case B：保留 Orchestrator/collecting 的 controlled_planner_exception_fu2；**删除** Agent 层 persist_threw 冒充 Planner 异常通过的声明（尚无独立 Planner 入口 Hook）。
- global.fetch stub 增加 pojuLlmFetchCount。

## Case A–E（实测）

| Case | 结果 | 实际异常类型 |
|------|------|----------------|
| A (FU2) | PASS | N/A（idempotent + blocked 保留） |
| B (FU2) | PASS | **planner_exception** / controlled_planner_exception_fu2（仅 orchestrator/collecting；Agent Planner 注入延期） |
| C (FU2) | PASS | N/A（真·幂等重放） |
| D (FU2) | PASS | N/A（P0/P1 完成 Readiness 不变） |
| E (FU4) | PASS | **understanding_exception** / controlled_understanding_exception_fu4_1（真实 Agent 链；attempts=2；llmDelta=0） |

### Case E 实测输出（verbatim 摘录）

`
[agent] M1 planner_blocked (nonterminal; no confirm / no free-ask) understanding_exception:controlled_understanding_exception_fu4_1
    path=handleUserMessage→runM1ProductionPreLlmTurn→runCollectingDcTurn→runAdaptiveQuestionTurn→Understanding×2→planner_blocked→Agent early return
    understandingBuildAttempts=2; m1_outcome=planner_blocked; m1_ask_error=understanding_exception:controlled_understanding_exception_fu4_1; llmDelta=0; phase=collecting_context; exception_type=understanding_exception
  PASS  M2.3-R2-FU4 Case E: real Agent chain Understanding failure -> planner_blocked; no ordinary LLM

M2.3 results: 18 passed, 0 failed
`

## 回归（真实退出码）

| 命令 | exit |
|------|------|
| pnpm test:m2-3-decision-blueprint | 0 （18/18） |
| pnpm test:m1-r-fresh-session-main-loop | 0 （8/8） |
| pnpm test:m1-production-adaptive-question-loop | 0 （16/16） |
| pnpm test:m2-1-readiness-confirm-freeze | 0 （19/19） |
| pnpm test:m2-2-freeze-report-binding | 0 （43/43） |
| pnpm test:decision-context-phase2 | 0 （9） |
| pnpm exec next typegen | 0 |
| pnpm exec tsc --noEmit | 0 |
| pnpm build | 0 |

## UNTESTED / 诚实边界

- Case B **无** Agent 层精确 Planner 入口注入（仅有 Understanding eforeUnderstandingBuild Hook）；不得把 persist_threw 记为 Planner 异常 Agent 通过。
- Case E 注入点为测试 Hook，生产路径在未传 Hook 时与改前一致；非自然语言多轮真实 Understanding 崩溃 fixture。
- ask_error 外层携带首次 Understanding 抛错文案（..._fu4_1）；第二次重建失败被内层 catch 吞掉后仍使 u==null，attempts 计数证明两次均失败。
- 未开 PR / 未 merge / 未 deploy / 未 promote；不自宣 PASS。

## 明确未做

- 无 PR、无 merge、无 deploy、无 promote、无 tip 给 Max、无产品 PASS 宣告。
