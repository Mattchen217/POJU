# 08 新增自造术语五语草案 — 产品确认台

来源：`Desktop/POJU-terms-implementation-handoff/08-新增自造术语五语草案.md`  
机器 diff：`pnpm test:phase8-draft-diff` → `lib/glossary/phase8-draft-review.json`

## 政策（硬）

- 本文件是**产品候选**，不是自动升 SSOT 的许可。
- 正式改写五语 `term` / `definition` 前：产品确认中英主名 → 母语审校西/德/法。
- **禁止**本阶段臆造紫微 14 主星 / 十二宫具体名（§C）。
- 六十甲子、伤官见官类组合词、神煞红线：不新建公开自造词。

## A+B 状态（相对当前 SSOT）

| 区块 | 条数 | 状态 |
|---|---|---|
| A 奇门字段 | 6 | 已在 SSOT（Phase 3 落地） |
| B 紫微结构 | 14 | 已在 SSOT（Phase 2 落地） |

运行 diff 后：

- `landed_exact_match` → 无需动作
- `landed_with_copy_delta` → **仅当产品勾选「用草案覆盖 live」**才改 SSOT
- `missing_from_ssot` → 确认命名后按 §D 合并格式写入

## §C 明确不做

1. 六十甲子 60 条 glossary  
2. 「伤官见官」「枭神夺食」平行造词  
3. 紫微主星/十二宫具体名（先 iztro 运行时闭集）  
4. 神煞红线项公开自造词（Phase 4 disposition 已处理）

## 合并清单（产品签字后）

每条正式词：`ns` + 稳定 `slug` + 内部 `traditional` + `aliases?` + `polarity` + 五语 `term` + 五语 `definition`；审核状态放独立 metadata，不污染运行时 `PojuTerm` 类型。

签字栏（产品）：

- [ ] 中英主名确认  
- [ ] 西/德/法母语审校  
- [ ] 允许覆盖 live 的 delta 列表（附 slug）  
- [ ] 仍 deferred 的 iztro 星曜/宫位命名排期  
