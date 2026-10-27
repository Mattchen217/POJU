# 决策报告 · 2026-10-27 锁版

页结构以这里为准。运行时出稿 key 仍是 v1 十段，直到后续波次改 schema / UI。

| 文档 | 内容 |
|------|------|
| [内容规格-SoT-2026-10-27.md](./内容规格-SoT-2026-10-27.md) | 页序、段规格、双轨三层、附录 03、恐吓红线 |
| [PageFeedMatrix-2026-10-27.md](./PageFeedMatrix-2026-10-27.md) | 字段代号与每页 allowlist |
| [旧键映射-2026-10-27.md](./旧键映射-2026-10-27.md) | 九模块 / P1–P6 / duty / schema → pageId |
| [ZiweiFactPack-2026-10-27.md](./ZiweiFactPack-2026-10-27.md) | 紫微结构包 · iztro MIT · 不接批断 |
| [切片与八页桥-2026-10-27.md](./切片与八页桥-2026-10-27.md) | `sliceForPage` 省略规则 · 01–08 职责表 · 书架脸已是 01–08 |
| [案例矩阵-2026-10-27.md](./案例矩阵-2026-10-27.md) | 五案固定出生与问题 · 活闸 · 人审顺序 |
| [batches/2026-10-27/README.md](./batches/2026-10-27/README.md) | 批跑判定。模型 fill 未调用 |

代码：`lib/llm/pro/delivery/page-feed-matrix.ts` · `slice-for-page.ts` · `page-schema/decision-pages.ts` · `decision-page-bridge.ts` · `page-id-remap.ts` · `rule-card.ts` · `lib/ziwei/`。

`DELIVERY_PIPELINE` 默认保持关闭。页级模型调用读 `formatPageSliceFeed`。主张硬度与恐吓闸已接上。应用内书架脸是 01–08；生成 JSON 仍用 v1 内部键折进这些脸。§3.5 双轨删段自检等人审，本波不签。
