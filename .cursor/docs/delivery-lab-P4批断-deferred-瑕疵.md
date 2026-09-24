# Delivery Lab · P4 批断 deferred 瑕疵

**状态**：write 续跑 3/4 后 chunk3 撞 Vercel 300s → 504；前三卡已落库  
**来源**：metaphysics_action.write · 2026-09-24 · 己土合伙

## 504 / finish=`-`（时钟 · 非质量）

**现象**：已分发 3/4；OpenRouter 两次 finish=`-`（235 out 早断 + 5166 out 长吐被掐）；Vercel `Task timed out after 300 seconds`。depth gate attempt1 后同 invoke 再开满预算 attempt2 → 墙钟顶穿 300s。

**说明**：finish=`-` = 客户端/平台 abort，不是「模型不会 STOP」。

**已改**：write chunk 与 fill/assign 同尺——剩余墙 <90s 跳过同 invoke 纠错；`callTimeoutMs = remaining−12s`，先 Abort 再 Vercel 杀。

**操作**：等部署后 **准备重跑 → 运行本步**（应从 next_chunk=3 续最后一卡；前三卡勿丢）。

## 前三卡质量（续跑后再总评）

- dim0/2：运岁结构批断可删垮；cite 仍白话（继承派工）。
- dim1：claim 半截「透干为」；evidence 印克食神可写，write 盯扩写勿手段。
