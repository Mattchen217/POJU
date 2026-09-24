# Delivery Lab · P4 批断 / 正文 deferred

**状态**：Bug #3 + P4 护城河闸已修（待 Lab **准备重跑** fill）  
**盘**：己土合伙续跑

## 已修

- **Bug #3**：`allowEmptyChartAnchorsOnFill` SSOT（仅 foundation）；sanitize 不再因 write 空锚放行六页全空 body 锚。
- **stamp**：fill 前从 `unit_claim`/`calc_cite`/`evidence` 抽闭集结构真词填 body `chart_anchors`。
- **假绿种子**：停用「按借势角色定位…」「转折前不硬冲」软章拼接；`P3_COACH_PM` 扩律师/试水期限/文档化等类别。
- **提示词**：P3/P4 禁「可留空」；P4 钉 timing/polarity/archetype + 删计算结果自检。

## Lab attempt #2 · `p4_missing_moat_means`

**非「没调 LLM」**：日志 `finish=stop`、reasoning≈6k、墙钟≈258s。瞬间看到的是 sanitize notes。

**根因**：
1. `对方施压…` 被第三方软修当成施事 → means 清空 → timing 覆盖丢光  
2. stamp 在软修**前**跑，types 随 string 化丢失  

**已改**：合伙施压场景进 topic frame；sanitize 后 stamp 全 means type；提示词钉 dimensions↔派工序。

**请准备重跑** P4 正文。
