# Phase 2 · 交付内容对齐九模块（出稿仍六 key）

> 在不大改 DAG/UI 书架的前提下，把**用户可见职责与依据口径**先对齐 v1。  
> 状态：**已落地** · 2026-10-25（标签 / body-prompt / deep-evidence 双段）

## 本阶段做

| 现网 key | 对齐的 v1 模块职责 | 改动面 |
|----------|-------------------|--------|
| `direct_answer` | `decision_brief` | 标签 + duty 措辞 |
| `foundation` | `situation_analysis` + `personal_decision_patterns` + `bottleneck_analysis` | 标签 + duty：处境·模式·障碍 |
| `science_action` | `strategic_options` + `recommended_strategy` + `execution_guidance` | 标签 + duty：选项比较感 + 主辅策略 + **执行原则（禁 30 天表）** |
| `metaphysics_action` | `self_regulation` | 标签 + duty：对己调频为主；奇门锁盘规则仍沿用 |
| `risk_guard` + `signals_close` | `validation_review` | duty：验证/退出/自检；一次性收束 |
| 深度依据 | 双轨 | evidence 文内分【命理】【科学】两段（同 unit，减改 schema） |

## 本阶段不做

- 九 key 书架 / task-dag 拆页  
- Companion 30 日预生成重写  
- 独立 `science_evidence` LLM 枪（先嵌进现有 evidence 字符串）
