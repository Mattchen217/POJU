# Delivery Lab · 30 步分步验收标准（参考尺）

**用途**：对照 Lab 里 30 个可点跑步骤，**每一步**判断「这一刀的中间产物能不能放行」，不等拼书才发现问题。  
**角色**：重测 / 日常点跑时的**步骤参考尺**（合格线 ≈ 当场该过的底线；减分项 ≈ 可记后修）。  
**不是**：踩坑流水账、签字登记表——那些仍写在活文档 [`delivery-lab-分步验收标准.md`](./delivery-lab-分步验收标准.md)（用途不变）。  
**内容值不值钱**：步骤过了之后，再用 [`六页交付内容质量验收标准.md`](./六页交付内容质量验收标准.md) + Canonical [`pivot-八页交付验收标准.md`](./pivot-八页交付验收标准.md)。

**结构**：assign / write / write_merge / fill / mark 在 P2–P6 各重复一次 → 先写通用 A–E，再写页专属；Bootstrap / Thesis / Prealloc / P1 fill / Assemble 单独列。文末有 30 步编号 ↔ `step_key` 对照。

---

## 0. 怎么用（与活文档对齐）

| 本尺用语 | 活文档 | 动作 |
|----------|--------|------|
| **合格线** | **F**（事实/结构会进下游） | 不过不点「本步通过」；修种子/闸/软修，**禁止**为碰运气 LLM 空转重试（规则 11） |
| **减分项** | **P**（呈现/同模/偏薄） | **可放行**；写入活文档「已登记问题」+ 方案 A 排队 |
| **加分项** | 超出底线的好表现 | 不强制；可记作正向样本 |
| 运维 504 / cancelled / 超时设计债 | **O** | 不当事质；架构债另记（规则 12） |

**闸门绿 ≠ 内容合格。** Gate PASS 只说明结构过；签字前仍过本尺合格线 + 内容尺。

**Lab 会话**：进度在 KV，**滑动 TTL 48h**（每次保存刷新）。停测超约 2 天未保存 → 须重开；创建页无历史列表，请自留 `lab_id` URL。见查验台说明。

**分发（点跑时）**：write / mark 一 chunk = 一次独立 invoke（约 270s）；禁止同 invoke 多 LLM。细节见规则 12 / `delivery-dispatch-并行分发备忘.md`。

---

## 第1步 · Bootstrap（校验盘/问题）

`step_key`: `bootstrap`

**这一步在做什么**：校验本命 `structured` 与议题数据是否完整可用。

**合格线**
- `structured` 基础字段齐全（四柱、日主、十神、藏干、大运序列等），fingerprint 正确
- 议题：`question_category` 应有值（除非确实无法分类），`as_of` 正确，agenda 相关字段可用
- 稀疏/异常盘被识别，不是直接报错或静默跳过

**加分项**
- 校验报告显式列出「有 / 缺」字段，而非笼统 pass/fail

**减分项**
- 通过了，但 fingerprint / as_of / category 未在本步输出里显式展示，排障困难

---

## 第2步 · Thesis（命盘总纲）

`step_key`: `thesis.gen`

**这一步在做什么**：生成六维命盘总纲——全书「这盘结构性是什么」的权威来源。

**合格线**
- 六维齐全；`day_master_strength` 最先；`favor_avoid_tuning` / `interpersonal_pattern` 显式引用其 `strength_verdict`
- present/absent 如实反映真算；藏干覆盖「透干 / 藏而不显 / 皆无」，禁止把「未透干」当成「完全没有」
- 同盘换议题 → 六维事实一致，仅 depth 可变；同盘换 `as_of` → `cycle_rhythm` 随大运/流年步进，缓存 key 区分日期
- 神煞/十二长生未扩维前 **不进** 承重 present（防影子池）

**加分项**
- `conclusion_zh` 是连贯批断，不是 checklist 拼接
- 强弱前提真正写进下游维度结论文字

**减分项**
- stub（如 `climate_balance`）未标注「引擎未实现」
- 六维定义重叠且互相矛盾

---

## 第3步 · Prealloc（全书 primary 预分配）

`step_key`: `prealloc`

**这一步在做什么**：把总纲 present 事实分配成全书可引用的信号候选池。

**合格线**
- **唯一取词源** = D1 `buildThesisAssignMenu`（总纲六维 present）；`pool_source=thesis_menu`
- 每个 primary 能在总纲 present **精确**核实；关系 kind 一致（禁 `相害` 冒充 `相刑`）
- 不含神煞 / 十二长生 / 未展示历史大运 / 槽位占位词（元男/元女）
- 全局复用上限生效；触顶或不够 → sparse / **减槽**，禁止退回大 inventory 凑数
- Lab gate：`allocated>0` 且 grounded 断言过

**加分项**
- 六维引用分布相对均衡

**减分项**
- 触顶无补位导致某页信号数意外减少（sparse 预期内除外）
- 菜单薄词入槽（裸六合/格局壳/裸五行/裸柱）— **不挡 unlock**；活文档 §2.2 P + 方案 A #7；P2 锁成主承重则升级

---

## 通用标准 A：assign（P2–P6 各 1，共 5 步）

**这一步在做什么**：每卡锁定总纲哪维哪信号，并写出支撑该卡的推论。

**合格线**
- **closed-menu（深页硬要求）**：`slug` + `dimension_id` 来自菜单/总纲锁定组合，不是 free-select 现编；条数 = 锁定数
- 每条 `necessary_signals` 能在总纲 present 核实
- **无第三方施事**：本盘信号不解释另一具体人物的心理/行为（已知第三方可作话题/背景，不作动作主语）
- `removal_test.passed` 须为真判断；同单元多信号 role/inference 不得高度可互相替代
- 270s 内正常 STOP；`llm_timeout` / 未 STOP 长喷 = **结构失败**，改菜单/token 上限，不靠质量空转重试

**加分项**
- 推论含藏干「兼藏根气」等深度细节
- 同信号复用时每次针对本卡写**新**推论

**减分项（可放行 · 记活文档 P）**
- 防第三方句模导致多卡雷同（已知权衡）
- `why_needed` / `unit_claim` 明显单薄或粘贴 cite
- **辅轨/多角 `unit_claim` 同模**（只换 slug 外套、药方同一句）——方案 A claim 去同模
- 比肩等关系类 inference 软修腔过短

---

## 通用标准 B：write（P2–P6 各 1，共 5 步）

**这一步在做什么**：把 assign 锁定的信号与推论展开成完整依据文本（可分 chunk 多次 invoke）。

**合格线**
- 五行关系链：单句最多 2 元素 + 1 关系，超过拆句
- 无裸露 `【】`、无未闭合 `⟦w:`、无连接模板词同段重复插入
- 命理真词/关系链主要在依据层；用户主读正文以行为/精力白话为主（最终展示层再看内容尺）
- **句读深度（与 merge 同尺）**：evidence 用 `。！？；` ≥2 段；仅逗号串一句 = 不合格（write 步即应红，不等 merge）
- **展开 unit_claim**：禁止 soft inference / 「就你侧…」套话当全文
- **删依据自检（抽卡）**：去掉命理锚后，该卡策略/药方应垮；照样成立 = 未扎盘
- 一 chunk 一 invoke；齐套后再 merge（见分发铁律）

**加分项**
- 语言具体，看得出从本信号推出，非套话

**减分项**
- 语言单薄 = 信号名 + 推论机械罗列
- 继承 assign 的 claim 孪生 / 比肩软短——**根在 assign，勿为此 LLM 重试 write**

---

## 通用标准 C：write_merge（P2–P6 各 1，共 5 步）

`kind`: `write_merge`（UI 常标 write.merge）

**这一步在做什么**：多份 write 草稿质检、跨卡去重、合并为本页定稿。

**合格线**
- 跨卡相似度检测生效；同页内同一核心诊断不得换说法讲两遍
- 合并/剥离/替换有痕迹可查，禁止静默改写
- **禁止**软修凭空编造填空卡；剥完不够 → 显式 fail 或减卡，不凑数（规则 11）

**加分项**
- 清楚记录「为何替换/剥离」

**减分项**
- 有合并动作但无说明，只见结果变了

---

## 通用标准 D：fill（P1 单独 + P2–P6 各 1，共 6 步）

**这一步在做什么**：把定稿组织成用户可读结构（卡片/小标题等）。

**合格线**
- 只做呈现组织，**不引入** write 没有的新判断
- 重要限定语（如「藏而不显」）不得在结构化中丢失
- 不替用户执行（「我们会帮你…」）

**加分项**
- 层次清晰，一眼看出本页几件事

**减分项**
- 结构化后比 write 原文更单薄

---

## 通用标准 E：mark（+ polish / locale）（P2–P6 各 1，共 5 步）

`step_key`: `*.mark`（Lab 内含打标与品牌词/locale 转换）

**这一步在做什么**：依据层打标 + 合规转换——**唯一**应发生品牌词替换的步骤。

**合格线**
- 禁用清单词（大运、流年等）→ 品牌词（纪元、岁环等）；五行单字点缀可保留
- 英文 token（water/fire/favor 等）命中为 0
- 未解析词槽不得裸露 `【】`；reinject 或干净跳过，禁止半成品残骸下流
- 连续术语堆叠有上限，禁止一句话挤爆语法
- 闭集打标；空树 / 空垫同 slug 重复 = 不合格或记 P 后修（见活文档）

**加分项**
- 替换后仍通顺，看不出生硬替换感

**减分项**
- 「锚元大运」类新旧混杂
- 同卡重复 `⟦t:同slug⟧` / 错配 cite（呈现债）

---

## P1 fill（独立 · 无 assign/write）

`step_key`: `direct_answer.fill`  
**Lab 顺序**：Wave A（P2/P3/P4）整页走完 → **本步** → Wave B（P5/P6）→ Assemble。

**这一步在做什么**：从题向收敛 + 已定判断生成开篇正面直答。

**合格线**
- 主张可追溯到题向收敛 / 后续页已定主路径，不自创与全书矛盾的新判断
- 明确主路径，不是「两条路各有利弊」和稀泥

**加分项**
- 一句话给出方向感

**减分项**
- 读起来像独立成文，与 P2–P6 对不上

---

## Assemble · 预览拼书

`step_key`: `book.assemble`

**这一步在做什么**：拼六页；查**页间**一致性，不是重做单页内容。

**合格线**
- P1 主路径与 P2–P6 展开一致、无互斥
- 全书无「流展」：同一核心诊断多页换汤不换药
- 全书 locale 纯净（英文 token、裸括号、未闭合标记）= 0

**加分项**
- 六页从不同角度支撑同一套判断

**减分项**
- 多页重复用力、另一些论点缺席 → 信号分配不均

---

## 各页在通用 A–E 之上的专属补充

| 页面 | `page` key | 专属高风险（额外盯） |
|------|------------|----------------------|
| **P2** | `foundation` | 第三方施事历史高发；关系摩擦句模雷同 → 减分可放行 |
| **P3** | `science_action` | 可执行 + 有现实细节；删依据应垮；禁替执行；主/辅轨 3+3；辅轨 claim 同模 → P |
| **P4** | `metaphysics_action` | 东方谋略三柱；双核锁盘；禁复读 P3 工具；关系链复杂度；禁降级半套 |
| **P5** | `risk_guard` | 红灯可自检；禁脏腑/疾病名；挂钩 P3/P4 行动 |
| **P6** | `signals_close` | 可观察信号，禁「某月某日会怎样」事件预言 |

内容层细则见 [`六页交付内容质量验收标准.md`](./六页交付内容质量验收标准.md)。

---

## 30 步编号对照（按编号 / `step_key` 查）

| # | `step_key` | 标准 |
|---|------------|------|
| 1 | `bootstrap` | 第1步 |
| 2 | `thesis.gen` | 第2步 |
| 3 | `prealloc` | 第3步 |
| 4 | `foundation.assign` | A + P2 |
| 5 | `foundation.write` | B + P2 |
| 6 | `foundation.write_merge` | C |
| 7 | `foundation.fill` | D |
| 8 | `foundation.mark` | E |
| 9 | `science_action.assign` | A + P3 |
| 10 | `science_action.write` | B + P3 |
| 11 | `science_action.write_merge` | C |
| 12 | `science_action.fill` | D |
| 13 | `science_action.mark` | E |
| 14 | `metaphysics_action.assign` | A + P4 |
| 15 | `metaphysics_action.write` | B + P4（重点） |
| 16 | `metaphysics_action.write_merge` | C |
| 17 | `metaphysics_action.fill` | D |
| 18 | `metaphysics_action.mark` | E + P4 |
| 19 | `direct_answer.fill` | P1 fill |
| 20 | `risk_guard.assign` | A + P5 |
| 21 | `risk_guard.write` | B + P5 |
| 22 | `risk_guard.write_merge` | C |
| 23 | `risk_guard.fill` | D + P5 |
| 24 | `risk_guard.mark` | E |
| 25 | `signals_close.assign` | A + P6 |
| 26 | `signals_close.write` | B + P6（重点） |
| 27 | `signals_close.write_merge` | C |
| 28 | `signals_close.fill` | D |
| 29 | `signals_close.mark` | E |
| 30 | `book.assemble` | Assemble |

---

## 使用建议

1. 点跑一步：先过本步通用标准（若属 A–E）→ 再过页专属 → Gate PASS 后再扫内容尺关键条。
2. 减分项不挡 unlock，但**当日写入**活文档「已登记问题」；同类减分跨页反复出现 → 升级为步骤级改进（方案 A），不是再赌新盘。
3. 历史坑（第三方、藏干漏算、关系链崩溃、closed-menu 超时、辅轨 claim 孪生）进回归集；改逻辑先跑脚本/fixture，再 Lab 肉眼。
4. 发现新页专属风险：补进上表 + 内容尺对应节；**踩坑签字只写活文档**，不要把流水账堆进本参考尺。
