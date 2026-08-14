# Pivot · 交付页 Schema 与 UI 槽位（page_schema_v1）

SSOT 代码：`lib/llm/pro/delivery/page-schema/`  
UI：`components/poju/delivery-pages/` + `DeliveryBookStage`  
质量尺子：仍以《pivot-八页交付验收标准》为准（正文现为 **6 页** + 附录）；本稿只钉**槽位形状**与波次。

## 1. 一句话

报告先长什么样（槽位），模型再 JSON 填槽；散文 markdown 仅作旧会话兜底。

## 2. 页 → Schema（活跃 6 页）

| 页 | key | 必填槽 |
|---|---|---|
| P1 | `direct_answer` | `core_judgment` + `primary`/`backup`（name / **core_logic** / why / when / dims；`leverage_chip` / `strategic_goal` 可选） |
| P2 | `foundation` | `surface_vs_essence` + `dashboard[]` + `why_cards`≥2（收束桥到主辅） |
| P3 | `science_action` | 每轨 `angles[]`≥3；沿用 name / strategy / exact_script / means / hard_metrics；**加厚**：`exact_script` 必填≤160、`means`≥3、`hard_metrics`≥1 |
| P4 | `metaphysics_action` | 主/辅 `dimensions[]`≥2（相关真算维：name / strategy / means）+ `leverage`/`avoid`；`field_matrix`≤4 |
| P5 | `risk_guard` | red_lights / traps / switch_to_backup / protection_rules；`boundary_script`≤120 可选 |
| P6 | `signals_close` | before/after + quote + **单一** `immediate_action` + **`day7_micro_actions`≥3≤5** |

**已退役（legacy only）**：`thirty_day`（四周表）——旧会话仍可 sanitize/渲染；**新交付不调度**；近阶价值并入 P6 `day7_micro_actions`。

### P1 UI 闭环

- **核心判定** = 金边判决句；**不**挂展开依据（结论自洽即可）
- **主辅对比** = 并排两张轻卡（目标 / 身体消耗条 / 风险 / 触发点），禁止表格
- **主/辅详卡** = 少套框：打法 / 筹码（行内钥匙）/ 条件 / **执行消耗**三格能量条；**P1 不挂依据层**（正文与命理推演留给 P2–P4）
- `dims` 语义 = 走该方案时身体·心理·现实的**消耗档**（非能力评级）
- 深度白话**方案叙事**进 `core_logic`（约280–450字）：路是什么 / 怎么运作 / 保留与交出 / 成功样貌；P3/P4 不复述方案本身
- 可执行科学/东方杠杆与依据在 P3–P4

### P2–P4 内容闭环

- **P2 可信桥**：表象/本质 + 仪表盘 + why 多维 → 收束「因此主辅成立」；挂依据；**不写执行步骤/路线图**
- **P3 科学**：对齐 P1 主辅两轨；每轨 **≥3 互补策略维**；每维沿用原槽位（策略 / 开口 / 手段 / 硬指标），**加厚**为可复制话术 + ≥3 手段 + ≥1 硬指标；禁另立新目标、禁平级互斥菜单、禁律师/HR 长剧本
- **P4 东方**：对齐 P1；**相关真算维尽给**（无关不硬凑）；每维 = 策略 + 手段 + 依据；页级 leverage/avoid；护城河主落点
- **切页轴**：按域（科学 vs 东方），不按「策略页/手段页」；每页内策略+手段成套

仪表盘 `score` **只**来自 `metaphysics_pack`；禁止模型编造。

### P5–P6 闭环

- **P5 熔断**：结构特有红灯/坑/切辅/防护；可选边界短句
- **P6 定心+近阶**：身份对照 + 金句 + 今晚一件事 + **近7日微清单**（吃 Action Brief；**不是**四周甘特）

## 3. 宽入严出

流水线：`parse JSON → sanitizePageJson → Zod safeParse`  
- 超长截断、枚举模糊映射、可选缺省  
- 旧单 `strategy`+`steps`/`methods` **升格**为 `angles[0]` / `dimensions[0]`；条数不足 → 结构失败可 retry  
- **仅**结构破坏（缺主辅轨、缺必填块、angles&lt;3、`day7_micro_actions`&lt;3）→ LLM 重试，每页 fill ≤2  
- 字数差 **不**重试  

## 4. 波次 DAG

```
A: P1 → B: P2∥P3∥P4 → ActionExtractor(code) → C: P5风险∥P6收束
```

- Wave C **只**吃 `P5ActionBrief`（非 P2–P4 全文）；Brief 从 angles/dimensions **扁平提取** means  
- Soft-wall：波次边界优先 `/continue` hop（Vercel 300s）

## 5. UI 渐进解锁

| 完成波次 | 亮起 |
|---|---|
| A | P1 |
| B | P2–P4 |
| C | P5–P6 |

未解锁：槽位 Skeleton，禁止整页空白 Spinner。

## 6. Mock

- `DELIVERY_PAGE_SCHEMA_MOCK_V1` — 单测 / Few-shot 形状（英）
- `DELIVERY_PAGE_SCHEMA_MOCK_ZH` + 依据样例 — **本地 UI 预览**（中）

### 本地预览（不跑四阶段）

```bash
pnpm dev
# 打开 http://localhost:3000/zh/dev/delivery-slots
```

左侧切活跃 6 页，右侧看槽位 + 卡内依据。生产环境 `notFound`。改 UI / mock 文案即可热更新。

## 7. 自检

1. [ ] 新槽只改 `page-schema/types.ts` + sanitize + UI 组件  
2. [ ] 未把交付规则灌进 `POJU_IDENTITY*`  
3. [ ] Wave C prompt 日志可见 `P5ActionBrief` 而非整页 P3 JSON  
4. [ ] 结构失败才 retry；截断不 retry  
5. [ ] P3 主辅各 angles≥3；P4 dimensions 为相关维（非空模板灌满）  
6. [ ] 新交付无 `thirty_day` 调度；P6 有 `day7_micro_actions`≥3
