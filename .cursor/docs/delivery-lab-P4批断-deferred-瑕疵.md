# Delivery Lab · P4 批断 deferred 瑕疵

**状态**：write 续跑 3/4 后 chunk3 撞 Vercel 300s → 504；前三卡已落库  
**来源**：metaphysics_action.write · 2026-09-24 · 己土合伙

## 504 / finish=`-`（时钟 · 非质量）

**现象**：已分发 3/4；OpenRouter 两次 finish=`-`（235 out 早断 + 5166 out 长吐被掐）；Vercel `Task timed out after 300 seconds`。depth gate attempt1 后同 invoke 再开满预算 attempt2 → 墙钟顶穿 300s。

**说明**：finish=`-` = 客户端/平台 abort，不是「模型不会 STOP」。

**已改**：write chunk 与 fill/assign 同尺——剩余墙 <90s 跳过同 invoke 纠错；`callTimeoutMs = remaining−12s`，先 Abort 再 Vercel 杀。

**操作**：等部署后 **准备重跑 → 运行本步**（应从 next_chunk=3 续最后一卡；前三卡勿丢）。

## attempt #7 · `deep_evidence_p4_moat_thin`（尺误杀）

**现象**：四卡齐；dim0/2 已写大运流年+刑害半合；闸只认 archetype，因 timing 仍要求「转折/窗口/等待」手段腔。

**已改**：`unitMentionsMoatClass(timing)` 对无锚批断认「大运/流年 + 合冲刑害/用忌」；纪元空话仍不认。Lab 齐套后重跑只复评 quality、不清库重写。

**操作**：部署后直接 **运行本步**（勿「准备重跑」，免四卡重烧）。若仍红再准备重跑。
