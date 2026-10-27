# 决策报告 · 2026-10-27 锁版

页结构以这里为准。运行时出稿 key 仍是 v1 十段，直到后续波次改 schema / UI。

| 文档 | 内容 |
|------|------|
| [内容规格-SoT-2026-10-27.md](./内容规格-SoT-2026-10-27.md) | 页序、段规格、双轨三层、附录 03、恐吓红线 |
| [PageFeedMatrix-2026-10-27.md](./PageFeedMatrix-2026-10-27.md) | 字段代号与每页 allowlist |
| [旧键映射-2026-10-27.md](./旧键映射-2026-10-27.md) | 九模块 / P1–P6 / duty / schema → pageId |

代码：`lib/llm/pro/delivery/page-feed-matrix.ts` · `page-id-remap.ts` · `rule-card.ts`。

`DELIVERY_PIPELINE` 默认保持关闭。紫微 FactPack、完整切片器、弹层 UI、提示词硬度大改不在本锁的实现范围。
