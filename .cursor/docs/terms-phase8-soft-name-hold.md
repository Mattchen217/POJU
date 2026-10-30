# P3 — Phase 8 soft 名称暂缓覆盖

**状态：HOLD — 不要自行改 SSOT `term` 字段。**

## 事实

- A+B 共 20 条（奇门 6 + 紫微结构 14）**已在正式 SSOT**（Phase 2/3）。
- 五语 `definition` 已与草案一致。
- 五语 `term` 与草案差在**写法**：live 多为 CamelCase（`CycleAnchor`），草案为自然语言空格（`Cycle Anchor`）。

## 政策

| 允许 | 禁止 |
|---|---|
| 产品确认后改对应 slug 的五语 `term` | 开发自行覆盖 live 名称 |
| 改完跑 `pnpm terms:check` + `pnpm test:terms-export-locales-phase6` | 为对齐草案而动 `definition` / slug / ns |

确认台：`pnpm test:phase8-draft-diff` → `lib/glossary/phase8-draft-review.json`  
签字清单：`.cursor/docs/terms-phase8-draft-product-review.md`

产品勾选「用草案覆盖 live term」并给出 slug 列表后，再开独立 PR 改 SSOT。
