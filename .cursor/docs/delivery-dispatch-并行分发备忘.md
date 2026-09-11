# Delivery · 并行分发备忘（无因果则齐飞）

> **配套规则**：`.cursor/rules/12-delivery-dispatch-one-call.mdc`（alwaysApply）  
> **目的**：墙钟缩短；禁止同 300s 挤多枪；有因果仍串行。

## 原则（用户 2026-09-10 定调）

1. **一模型调用 = 一次独立 270s 请求**（invoke 壳 300s）。
2. **没有上下游因果的模型请求，尽量同时发出**（真并行），只设 **短间隔（默认 1s）** 以免供应商/网关拥挤。
3. **有因果的必须等**（deps / merge 屏障）。
4. **间隔齐飞 ≠ 同窗并行**：两次 POST/QStash task 交错 1s = ✅；一个 route 里 `Promise.all` 两枪 LLM = ❌。

## 因果 vs 可齐飞（速查）

| 可齐飞（无硬因果） | 必须串（有因果） |
|-------------------|------------------|
| 同页 write.c0 ∥ c1 ∥ c2… | assign → 任意 write |
| 同波多页 assign（deps 已满足） | write → write_merge → fill |
| 同页 mark arg-chunk.c0 ∥ c1… | fill → mark |
| 多页 finalize group（各自独立 task） | Wave A ready → wave_b.gate → Wave B |
| | 末卡 merge / assemble 等齐 |

## 实现锚点

- `DELIVERY_DISPATCH_STAGGER_MS = 1000`（`lib/llm/pro/delivery/dispatch/types.ts`）
- `runDeliveryDispatchSchedulerTick`：对 ready 任务 **claim → publish → sleep(stagger)** 再发下一个

## 审计表（2026-09-10 · 修订）

| 路径 | 形态 | 判定 |
|------|------|------|
| DAG scheduler publish | ready 任务 1s stagger 多 `/task` | ✅ 真并行 |
| DAG write chunks | 每 chunk 一 task；assign 后可同时 ready | ✅ |
| DAG write_merge / fill / ready | deps 串联 | ✅ 因果串 |
| DAG **mark** | fill 后 `expandDagAfterFill` → `p.{page}.mark.cN` ∥ + `mark.merge` → ready | ✅ 与 write 同构 |
| Lab write / mark | write：串行 auto-continue；**mark：一点齐飞** plan→cN∥→merge | ✅ mark / ⚠ write |
| segment-chain write/mark soft-wall | 无 DAG 时一块块 yield | ⚠ 遗留；正式走 DAG |
| finalize stage | **每 group 一 invoke**（`waveSize=1` + handoff）；禁同窗 `Promise.all` 多 LLM | ✅ |
| packed `runDeliveryFinalize` / `runMarkDeliveryEvidence` | fail-closed | ✅ 已拒 |
| finalize 后同窗 pack P1 | 已删 | ✅ |

## 下一步（按收益）

1. ~~DAG mark 拆 `mark.cN`~~ ✅  
2. ~~Finalize 禁止同 invoke 多 LLM~~ ✅  
3. Lab（可选）：一次点运行 → 前端 stagger 连发多 chunk POST，仅改善查验台墙钟。

## 自检

改调度 / Lab 续跑前：无因果是否误改成「等完成再发」？有因果是否误改成齐飞？
