# Pivot · 交付页 Schema 与 UI 槽位（page_schema_v1）

SSOT 代码：`lib/llm/pro/delivery/page-schema/`  
UI：`components/poju/delivery-pages/` + `DeliveryBookStage`  
质量尺子：仍以《pivot-八页交付验收标准》为准（正文现为 **6 页** + 附录）；本稿只钉**槽位形状**与波次。

## 1. 一句话

报告先长什么样（槽位），模型再 JSON 填槽；散文 markdown 仅作旧会话兜底。

## 1.1 页眉三层 + 双层人设

| 层 | 来源 |
|---|---|
| **固定标签** | 前端 `DELIVERY_PAGE_TAGS`（核心直答 / 归因剖析 / 破局策略 / 自我调频 / 风险预警 / 行动建议） |
| **动态主标题** `page_title` | 模型按本案生成 |
| **动态副标题** `page_subtitle` | 模型按本案生成 |

TOC：`01` + 固定标签。右侧页眉：标签 + 主标题 + 副标题。

**人设**：L1=**东方破局顾问** + 命理知识根基（不可换）；L2=本页任务焦点（只加任务，不换主身份）。fill 禁止写成「JSON 填槽器」当主身份。

## 2. 页 → Schema（活跃 6 页）

| 页 | key | 必填槽 |
|---|---|---|
| P1 | `direct_answer` | **page_title / page_subtitle** + `core_judgment` + `primary`/`backup`（name / **core_logic** / why / when / dims；`leverage_chip` / `strategic_goal` 可选） |
| P2 | `foundation` | **page_title / page_subtitle** + `dashboard[]` + `why_cards`≥4（fill 目标；schema 底 2 兼容旧会话；**每卡不同表象 surface + 本质 essence**；末卡桥到主辅） |
| P3 | `science_action` | **page_title / page_subtitle** + **1主1辅**两轨；每轨 `angles[]`≥3；每维 strategy+means；`exact_script` / `hard_metrics` 可选 |
| P4 | `metaphysics_action` | **page_title / page_subtitle** + **锚定问题+期望**；`dimensions[]`≥2 合规策略维；**禁复读 P3** |
| P5 | `risk_guard` | **page_title / page_subtitle** + red_lights / traps / switch / protection；`boundary_script` 可选 |
| P6 | `signals_close` | **page_title / page_subtitle** + before/after + **identity_shift** + quote + **quote_use** + tonight 三件套 + **day7 条目卡≥4** `{action,why,done_when}` + **takeaways[3]** |

**已退役（legacy only）**：`thirty_day`（四周表）——旧会话仍可 sanitize/渲染；**新交付不调度**；近阶价值并入 P6 `day7_micro_actions`。

### P1 UI 闭环

- **核心判定** = 金边判决句；**不**挂展开依据（结论自洽即可）
- **主辅对比** = 并排两张轻卡（目标 / 身体消耗条 / 风险 / 触发点），禁止表格
- **主/辅详卡** = 少套框：打法 / 筹码（行内钥匙）/ 条件 / **执行消耗**三格能量条；**P1 不挂依据层**（正文与命理推演留给 P2–P4）
- `dims` 语义 = 走该方案时身体·心理·现实的**消耗档**（非能力评级）
- 深度白话**方案叙事**进 `core_logic`（约380–560字）：路是什么 / 为何对本案成立 / 成功样貌与筹码 / 边界；P3/P4 不复述方案本身
- 可执行科学/东方杠杆与依据在 P3–P4

### P2–P4 内容闭环

- **P2 可信桥**：收集到的**多个真实表象**分卡对症（fill **≥4** 张；每卡 surface+essence）+ 仪表盘 → 末卡收束「因此主辅成立」；挂依据；**不写执行步骤/路线图**；禁压成单一表象空讲；仪表盘 label 用人话（禁 Body load 英文壳）
- **P3 科学**：对齐 P1 **1主1辅**；每轨多维策略（angles）；每维写厚 strategy + 对应可实操行动（JSON 字段仍为 `means`，UI 标签「行动」）；**禁止独立「开口」槽**——可复述口径写入 strategy/means；硬指标按需
- **P4 场域调频（支付网关合规包装）**：锚定用户**问题+期望**；内容可保留色/朝向/时段/避耗逻辑，但用户可见维名走合规菜单（视觉心理 / 空间心理 / 生物节律 / 战略周期 / 精力管理 / 组织杠杆）；**已退役**借力/避坑/场域矩阵（避坑归 P5）；**硬禁**复读 P3 邮件/授权/日历/谈判话术；折叠依据层仍走闭集真算（护城河）
- **切页轴**：按域（破局策略 vs 自我调频），不按「策略页/行动页」；每页内策略+行动成套

仪表盘 `score` **只**来自 `metaphysics_pack`；禁止模型编造。

### P4 用户可见合规包装

Stripe/PayPal/微信支付宝审核主要扫默认 DOM 与截图。本页默认可见层（维标签、gloss、展开按钮、维名、strategy/means）**禁止**玄学/命理/八字/五行/用神/风水/运势/东方维/色向时字面清单。

| 层 | 口径 |
|---|---|
| 固定标签 | 仍用「自我调频」（`DELIVERY_PAGE_TAGS.metaphysics_action`） |
| UI chrome | 「策略维」+ gloss「视觉/空间/节律/资源」；**仅 P4** 依据展开「你为什么能这么做」；其余页仍用「底层依据」 |
| `dimensions[].name` | 推荐菜单或同构高管咨询命名 |
| 折叠证据 | 闭集 `⟦t:⟧` 真算保留——删依据应垮；不改成纯心理学空话 |

内部 segment key 仍为 `metaphysics_action`；pack 字段映射不变。

### 算料注入矩阵 + 依据层口径

| 页 | finalize/fill 主要真算 | 说明 |
|---|---|---|
| P2 | multi_dim + 整包 pack + dashboard 真分 | 论证用 |
| P3 | multi_dim + 主辅 + action_plan + **pack 结构极性** | pack 禁写成 P4 场域清单 |
| P4 | multi_dim + retune + 整包 pack + 问题/期望 | 用户可见合规包装；依据仍闭集 |
| P5 | 风险极性维（无匹配则弱相关兜底）+ ji + brief | 熔断 |
| P6 | Action Brief | 近阶出门 |

**依据层（evidence → mark）**

- 目标：**最短且完整的承重证据链**讲清正文为何成立；**不限死** `⟦w:⟧` 个数（dual-layer 文里的「≤3」**不**升格为本链路硬闸）
- 简洁：短于正文；禁长篇、禁复述行动清单
- 硬闸：≥1 真词锚；相邻槽缝须有 **≥4 个汉字**的实质连接白话（禁虚字糊弄贴死）

### P5–P6 闭环

- **P5 熔断**：结构特有红灯/坑/切辅/防护；每条先规划四点再由模型写成 **narrative** 温暖段落（UI 只展示 narrative，禁止代码拼接四点）
- **P6 出门仪式**：身份对照 + 为何切换 + 金句用法 + 今晚闭环（做什么/做成什么样/为何今晚）+ **近7日条目卡≥4** + **带走三样**（吃 Action Brief；**不是**四周甘特；禁第三次药方总结）

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
5. [ ] P3 主辅各 angles≥3；P4 dimensions 为合规策略维（视觉/空间/节律/周期/精力/组织…），非 P3 软科学复读、非空模板灌满、无用户可见玄学报幕字面
6. [ ] 新交付无 `thirty_day` 调度；P6 有 `day7_micro_actions`≥4（含 why/done_when）+ takeaways[3]
