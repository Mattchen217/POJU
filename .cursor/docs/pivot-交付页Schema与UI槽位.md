# Pivot · 交付页 Schema 与 UI 槽位（page_schema_v1）

SSOT 代码：`lib/llm/pro/delivery/page-schema/`  
UI：`components/poju/delivery-pages/` + `DeliveryBookStage`  
质量尺子：仍以《pivot-八页交付验收标准》为准；本稿只钉**槽位形状**与波次。

## 1. 一句话

报告先长什么样（槽位），模型再 JSON 填槽；散文 markdown 仅作旧会话兜底。

## 2. 页 → Schema

| 页 | key | 必填槽 |
|---|---|---|
| P1 | `direct_answer` | `core_judgment` + `primary`/`backup`（name/why/when/dims） |
| P2 | `foundation` | `surface_vs_essence` + `dashboard[]` + `why_cards`≥2 |
| P3 | `science_action` | `primary_toolkit`/`backup_toolkit`（strategy + steps；`exact_script`≤120 可选） |
| P4 | `metaphysics_action` | 主/辅 strategy+methods；`leverage`/`avoid`；`field_matrix`≤4 |
| P5 | `thirty_day` | 四周 `weeks` + `day7_checklist`≥3；`source_refs` 可追溯 |
| P6 | `risk_guard` | red_lights / traps / switch_to_backup / protection_rules |
| P7 | `signals_close` | before/after + quote + **单一** `immediate_action` |

仪表盘 `score` **只**来自 `metaphysics_pack`；禁止模型编造。

## 3. 宽入严出

流水线：`parse JSON → sanitizePageJson → Zod safeParse`  
- 超长截断、枚举模糊映射、可选缺省  
- **仅**结构破坏（缺主辅轨、缺必填块）→ LLM 重试，每页 fill ≤2  
- 字数差 **不**重试  

## 4. 波次 DAG

```
A: P1 → B: P2∥P3∥P4 → ActionExtractor(code) → C: P5 → D: P6∥P7
```

- P5 **只**吃 `P5ActionBrief`（非 P2–P4 全文）  
- P6/P7 吃 brief + P5 周摘要  
- Soft-wall：波次边界优先 `/continue` hop（Vercel 300s）

## 5. UI 渐进解锁

| 完成波次 | 亮起 |
|---|---|
| A | P1 |
| B | P2–P4 |
| C | P5 |
| D | P6–P7 |

未解锁：槽位 Skeleton，禁止整页空白 Spinner。

## 6. Mock

`DELIVERY_PAGE_SCHEMA_MOCK_V1` — 本地槽位联调；真跑验收不得以 mock 代替。

## 7. 自检

1. [ ] 新槽只改 `page-schema/types.ts` + sanitize + UI 组件  
2. [ ] 未把交付规则灌进 `POJU_IDENTITY*`  
3. [ ] P5 prompt 日志可见 `P5ActionBrief` 而非整页 P3 JSON  
4. [ ] 结构失败才 retry；截断不 retry  
