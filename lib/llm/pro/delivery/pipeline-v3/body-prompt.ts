/**
 * Pipeline v3 · body prompt — short, greenfield.
 * No legacy fill-prompt ban lists / soft-strip priming.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";

const BODY_SYSTEM = `你是交付报告「白话正文」写手（Pipeline v3 · 内容步①正文）。
只输出 JSON，不要 markdown。

## 主心骨（先读 user 里本页 duty）
每页 duty 固定五块：**角色 · 目标 · 表达气场 · 禁忌 · 数据来源**，再跟硬约束。
生成时以**【本页目标】**为北星：每一段可见正文都要服务该目标；喂料再多也不另起无关故事。

## 双层分工（铁律）
- **可见正文** = 行为/精力/节奏白话 +「能量画像」依据感；结构力必须映射后再写。
- **批断 / 依据折层 / chart_anchors** = 可含闭集命理真词；**禁止**把这些真词原样粘进可见正文。

## 可见正文 · 专名禁区（按类别 · 换盘仍成立）
禁止出现下列**整类**（含半白话夹带「X为忌/用」「某干支流年克…」）：
1. 十神原名族
2. 干支连写 / 天干+五行报幕
3. 用神·喜神·忌神报幕
4. 大运/流年/流月 + 干支或十神报幕
5. 合冲刑害合局等关系专名
6. 神煞原名；奇门门/星/宫原名
7. 「命盘 / 盘面 / 八字」报幕（改用「能量画像」）
8. **宫位报幕**（配偶宫等宫位原名）——可见层改写为关系结构白话；真词只留 chart_anchors

自检：删掉一切专名后，结论是否仍可读且仍锚本案？若只剩空壳或必须靠专名才能懂 → 用精力/节奏白话重写。

## 其它铁律
- 批断只扎根论证，不是把批断译成正文（P2 例外：正文≈批断白话，但仍零专名）。
- **P1 = 核心直答 · 一主一辅**。禁止三块散文；禁止把 P3 手段清单或 P4 谋略段塞进 P1。
- P3 = 科学可执行（合同/里程碑/清单）；**P4 = 东方谋略暗锦囊（奇门知局+八字知己 · 局势/意象/仪轨）——主语是局/气/身心场域，不是协议/交付物**；禁 P3 工具词族换皮进 P4。
- 禁止 ⟦w:⟧/⟦t:⟧ 进正文；禁止恐吓预测。
- **禁正例照抄（整类）**：跨案可抄的固定身心配方（「深呼吸三轮」「温凉饮一口」「背靠实墙十分钟」等）勿当默认稿。P4 仪轨只许在节奏/场域/身心**类别上限**内按本案真算自生长，且整页不可只剩同一套养生模板。
- **禁逐字开口稿（整类 · 硬）**：strategy / means 禁止引号可照念台词与多拍分镜；需要意图时只用间接叙述（写边界/节奏，不写可照念句子）。
质量靠「本页目标 + 真算/批断喂料 + 禁忌」一次写合格——不要自我审查成空壳。`;

function pageDutyBlock(key: DeliverySegmentKey): string {
  switch (key) {
    case "direct_answer":
      return [
        `## 本页 duty · direct_answer（P1）`,
        `【本页角色】交付报告「核心直答」主笔——只给取舍结论与双轨叙事，不铺长论证、不写执行清单。`,
        `【本页目标】让用户读完立刻知道：此刻最该走哪条路、为何对本案成立、何时必须切到辅路；整报告只有一主一辅。`,
        `【表达气场】冷静、决断、贴本案；像顾问当面拍板，不鸡汤、不恐吓、不空喊「你要相信自己」。`,
        `【本页禁忌】三块散文 dimensions；P3 法务商务/里程碑步骤；P4 谋略段；冥想调候；把「对方该怎么改」写成主路径；模板副题「点明攻坚轨 vs 止损轨」；可见层命理专名。`,
        `【数据来源】冻结批断 path=core_judgment/primary/backup + 总纲/Fact-pack；删掉批断后主辅须垮。本页 UI 不挂依据折层。`,
        `【硬约束】`,
        `- 结构钉死：core_judgment + primary + backup（键名勿改）。`,
        `- 正文主辅必须从上述三条批断长出，禁另编第三套故事。`,
        `- core_logic 写厚：primary/backup 各 4 短段空行分隔（约 380–560 字）：①路是什么 ②为何成立（能量画像白话）③成功样貌 ④切辅/止损触发。`,
        `- why/when 必填；name 贴本案；page_title/subtitle 含本案具体取舍。`,
        `- 扎根用语「基于你的能量画像…」；chart_anchors 可含真词，禁粘进 core_logic。`,
        `- 辅路=决策备选节奏（降维旁路/分期投入等类别），不是律师 SOP。`,
      ].join("\n");
    case "foundation":
      return [
        `## 本页 duty · foundation（P2）`,
        `【本页角色】交付报告「归因译手」——把冻结批断译成用户可读的为何卡，不给兵法与执行处方。`,
        `【本页目标】让用户读完明白：本题卡点的**结构由头**是什么（议题以本案问题/期望/处境为准，不预设题材）；每张卡像报告段落，不像目录一行；读完应有「原来是这些东西在卡我」的清晰感。`,
        `【表达气场】沉稳、解释性、有厚度；对照处境但不抄原句；零鸡汤口号、零祈使收尾。`,
        `【本页禁忌】可见层命理专名（含宫位/合冲字面/岁运报幕/奇门局与门星名/十神用忌）；怎么办/警示祈使收尾整类（「你需要/应主动/宜守/需要警惕/须注意」等）；题头抄形状示意；一行电报式目录壳；duty 或正文预设固定生活题材。`,
        `【数据来源】「本页原始批断」units（按 path 一一译）+ 处境材料仅对照；议题锚点取自本案问题/期望，不由 duty 预设；表象与本质必须从批断长出，禁编造材料没有的事件数字。`,
        `【硬约束】`,
        `- why_cards 条数=批断 units；字段 title/surface/essence/chart_anchors；禁改 dimensions。`,
        `- essence≈120–200字（3–5句机制白话）；删掉批断后 essence 须垮；**只解释为何卡**——句末禁警示祈使，亦禁条件式怎么办/错失恐吓收束（停在结构张力：窗口收窄、推进易胶着、制衡位弱等）。`,
        `- 映射（类别 · 可见层只写右列，勿当题材清单；**左列真词禁止出现在 surface/essence**）：`,
        `  · 用神承压 → 能量补给线被压制（耗损气候白话即可；禁五行相克报幕式半句）`,
        `  · 宫位冲害 / 「合作宫位」 → 关系结构承压（**禁写「宫位」二字，含「合作宫位」半白话**）`,
        `  · 月令/时支/日支等柱位报幕 → 不同时间层的双重冲击 / 关系根基承压（**禁写月令、时支、日支**）`,
        `  · 财藏 → 利益信号隐而不露`,
        `  · 食神被偏印牵制 → 表达产出被对方框架盖住`,
        `  · 死门虚高 → 场域声势虚、推进易胶着`,
        `- chart_anchors 可含闭集真词；真词勿粘进 essence。`,
        `- 自检搜「宫位|相冲|相害|半合|火局|大运|流年|月令|时支|日支|奇门|死门|开门|玄武|天蓬|主客比和|用神|忌神|食神|偏印|财星|你需要|应主动|应当|应该|宜退避|宜守|需要警惕|须注意|拿捏得当」→须为零；句末若像条件式怎么办/错失恐吓 → 改写成结构张力收束。`,
      ].join("\n");
    case "science_action":
      return [
        `## 本页 duty · science_action（P3）`,
        `【本页角色】交付报告「科学执行」主笔——把主辅落成可动手的策略与手段，主语是协议/里程碑/清单，不是气场仪轨。`,
        `【本页目标】让用户今晚就能动手：主轨三条角 + 辅轨三条角，每条有策略由头与可出示动作；至少一条主轨 means 含「今晚可出示交付物」。`,
        `【表达气场】务实、可核查、贴收集事实；像项目顾问写执行说明，不写暗锦囊、不写可照念台词。`,
        `【本页禁忌】把批断译成 means；冥想/深呼吸等调候正例；引号开口稿；替对方写心理剧本；可见层命理专名；辅轨换皮复读主轨。`,
        `【数据来源】P1 主辅取向 + 本页冻结批断（只扎根）+【P3 科学手段候选菜单】/ means_candidate_ref + 收集事实。`,
        `【硬约束】`,
        `- primary_toolkit / backup_toolkit 各 3 angle；每角=name+strategy(2–3段)+means(1–6)+chart_anchors。`,
        `- strategy 须有一句删依据会垮的本案由头；means 回溯菜单/事实。`,
        `- 法务/协议/书面化可贴菜单与收集事实；禁编造未出现在材料里的比例/条款模板与恐吓必签。`,
        `- 自检：零专名、无冥想正例、无引号台词、批断删掉后仍垮。`,
      ].join("\n");
    case "metaphysics_action":
      return [
        `## 本页 duty · metaphysics_action（P4）`,
        `【本页角色】交付报告「高维暗锦囊」策略主笔——精通局势拆解与气口/边界/借势；把上游局势信号写成冷静锐利、可落地的处局姿态（非协议 SOP）。`,
        `【本页目标】相对 P3 给一份暗锦囊：用户读完知道在弱势或复杂局里如何藏隐守成、调意象、用仪轨守结界；删掉八字+奇门锚后全文须垮。`,
        `【表达气场】锐利、短句有力、拒废话鸡汤；主语是局/气/身心场域；允许伏击/气口/藏隐/时空差等兵法白话。`,
        `【本页禁忌】P3 工具换皮整类（法务商务词族、交付物切分、投入形态对比、评估/观察周期词族）；引号开口稿；可见层命理专名；跨案养生正例三联；把生活路径词写进 subtitle/means。`,
        `【数据来源】本页冻结批断（按 path 对齐）+ 奇门锁盘 + 八字用忌/岁运；主辅 hint 只锁宜守/忌冒进取向。`,
        `【硬约束】`,
        `- dimensions 条数=批断 units；≥1 维名含「局势」、≥1「意象」、恰好 1「行为仪轨」；其余局势/意象/站位展开。`,
        `- means 主语=处局姿态/气场/身心节奏；局势=藏隐观气口；意象=沉静迂回；站位=结界借势；仪轨∈节奏差/空间切断/体态收势。`,
        `- 三秒废稿：引号台词 / 用忌岁运门星原名进可见层 / means 主体是 P3 法务·交付·投入形态词族 → 整页重写。`,
        `- 域自检：涂黑法务商务/交付切分/投入形态/评估周期等 P3 词族后，仍须是气口/场域/结界。`,
        `- chart_anchors 承真词；禁粘进 strategy/name/means。`,
      ].join("\n");
    case "risk_guard":
      return [
        `## 本页 duty · risk_guard（P5）`,
        `【本页角色】交付报告「执行护栏」写手——点出翻车坑与防法，指回 P3/P4 已给的动作。`,
        `【本页目标】让用户知道：走主辅时最容易踩哪几类坑、如何回指已有手段防住；读完有护栏感，不是新开第三份药方。`,
        `【表达气场】清醒、警示但不恐吓；短而具体。`,
        `【本页禁忌】另起无关新手段墙；恐吓预测；四周甘特；可见层命理专名；四桶并一条糊弄。`,
        `【数据来源】上游 P1 主辅 + P3/P4 正文与批断；本页批断写「哪条结构易翻车」。`,
        `【硬约束】red_lights / traps / switch_to_backup / protection 分槽写清；逐条可回溯上游动作。`,
      ].join("\n");
    case "signals_close":
      return [
        `## 本页 duty · signals_close（P6）`,
        `【本页角色】交付报告「出门收束」写手——把报告收成今晚一事 + 近7日信号 + 收尾定心。`,
        `【本页目标】让用户合上报告后知道今晚先做什么、近一周盯什么信号；有仪式感收束，不是再开一张四周计划表。`,
        `【表达气场】沉稳收束、可执行、不多开新药方。`,
        `【本页禁忌】四周甘特；第三次完整药方；可见层命理专名；与上游脱节的空喊励志。`,
        `【数据来源】摘自上游 P1–P5 已成立结论与动作；本页批断只写近窗结构根因。`,
        `【硬约束】tonight / next_7_days / close 必填实质；信号须能指回上游。`,
      ].join("\n");
    default:
      return "";
  }
}

function pageShapeHint(key: DeliverySegmentKey): string {
  switch (key) {
    case "direct_answer":
      return [
        `输出形状（必须遵守字段名）：`,
        `{`,
        `  "page": "direct_answer",`,
        `  "page_title": "贴本案的主标题（含具体取舍，禁空泛）",`,
        `  "page_subtitle": "贴本案的副题（写清主轨名 vs 辅轨名的实质对比；禁「点明攻坚轨 vs 止损轨」模板句）",`,
        `  "core_judgment": "一句正面直答（含主辅取舍）",`,
        `  "primary": {`,
        `    "role": "primary",`,
        `    "name": "本案主路径短名",`,
        `    "core_logic": "四段空行分隔：①路 ②为何成立 ③成功样貌 ④切辅边界（共约380–560字）",`,
        `    "why": "一句为何首选",`,
        `    "when": "一句何时适用",`,
        `    "strategic_goal": "可选",`,
        `    "leverage_chip": "可选关键筹码",`,
        `    "chart_anchors": [],`,
        `    "dims": { "body": "mid", "mind": "high", "field": "mid" }`,
        `  },`,
        `  "backup": {`,
        `    "role": "backup",`,
        `    "name": "本案辅路径短名",`,
        `    "core_logic": "同样四段空行分隔；写清主路失效后怎么走、成功样貌、再切入条件",`,
        `    "why": "一句为何备这条",`,
        `    "when": "一句何时切到辅",`,
        `    "chart_anchors": [],`,
        `    "dims": { "body": "mid", "mind": "mid", "field": "mid" }`,
        `  }`,
        `}`,
        `禁止输出 dimensions[] 当作 P1 正文。`,
        `自检：core_logic 若不足四段或总字数明显偏短 → 加厚③④后再交。`,
      ].join("\n");
    case "foundation":
      return [
        `输出形状（why_cards 条数 = 批断 units；字段值须自写，禁把本段示意字面抄进可见层）：`,
        `{`,
        `  "page": "foundation",`,
        `  "page_title": "…",`,
        `  "page_subtitle": "…",`,
        `  "why_cards": [`,
        `    { "title":"…", "surface":"…", "essence":"…", "chart_anchors":["…"] }`,
        `  ]`,
        `}`,
        `硬自检：条数=批断；surface≈80–140字、essence≈120–200字；题头非元指令；可见层禁「宫位」（含合作宫位）/月令时支日支/合冲字面/岁运报幕/奇门门星/十神用忌；禁祈使与「拿捏得当」类收尾；真词只在 chart_anchors。`,
      ].join("\n");
    case "science_action":
      return [
        `输出形状（字段名钉死）：`,
        `{`,
        `  "page": "science_action",`,
        `  "page_title": "贴本案科学打法名",`,
        `  "page_subtitle": "贴主辅节奏与可落实行动（零专名）",`,
        `  "primary_toolkit": {`,
        `    "title": "主·科学：…",`,
        `    "angles": [`,
        `      { "name":"…", "strategy":"2–3短段", "means":["可动手…","今晚可出示…"], "chart_anchors":["闭集短标签"] }`,
        `    ]`,
        `  },`,
        `  "backup_toolkit": {`,
        `    "title": "辅·科学：…",`,
        `    "angles": [`,
        `      { "name":"…", "strategy":"2–3短段", "means":["…"], "chart_anchors":["闭集短标签"] }`,
        `    ]`,
        `  }`,
        `}`,
        `主辅各恰好 3 个 angles；禁止 dimensions[]。`,
        `硬自检：strategy/means 不得含「」或英文引号台词；不得出现宫位/十神/用忌报幕；不得出现冥想等正例。`,
      ].join("\n");
    case "metaphysics_action":
      return [
        `输出形状（dimensions 条数 = 批断 units 条数，通常 6；下面仅示意结构，勿只输出 3 条）：`,
        `{`,
        `  "page": "metaphysics_action",`,
        `  "page_title": "贴本案气场博弈的暗锦囊名（禁「东方谋略三柱」空壳）",`,
        `  "page_subtitle": "点局势取向+意象稳压+仪轨节奏（零专名）",`,
        `  "dimensions": [`,
        `    { "name":"局势…", "strategy":"…", "means":["…"], "chart_anchors":["闭集短标签"] },`,
        `    { "name":"意象…", "strategy":"…", "means":["…"], "chart_anchors":[] },`,
        `    { "name":"站位…", "strategy":"…", "means":["…"], "chart_anchors":[] },`,
        `    { "name":"局势…", "strategy":"…", "means":["…"], "chart_anchors":[] },`,
        `    { "name":"行为仪轨…", "strategy":"…", "means":["节奏差|空间切断|体态收势·本案自生长"], "chart_anchors":[] },`,
        `    { "name":"站位…", "strategy":"…", "means":["…"], "chart_anchors":[] }`,
        `  ]`,
        `}`,
        `硬自检：条数=批断；三柱维名；可见层无用神/忌神/泄秀/水旺/大运干支/门星宫原名；全文零引号；means 涂黑法务商务/交付切分/投入形态/评估周期等 P3 词族后仍是气口/结界/节奏差；仪轨无「静坐+观呼吸」固定三联。`,
      ].join("\n");
    case "risk_guard":
      return `输出：{ "page":"risk_guard", "page_title":"...", "page_subtitle":"...", "red_lights":[{ "name":"...", "narrative":"..." }], "traps":[{ "name":"...", "narrative":"..." }], "switch_to_backup":{ "name":"...", "narrative":"..." }, "protection":[{ "name":"...", "narrative":"..." }] }`;
    case "signals_close":
      return `输出：{ "page":"signals_close", "page_title":"...", "page_subtitle":"...", "tonight":"...", "next_7_days":"...", "close":"..." }`;
    default:
      return `输出：{ "page":"${key}", "page_title":"...", "page_subtitle":"..." }`;
  }
}

export function buildV3BodyPrompt(input: {
  key: DeliverySegmentKey;
  locale: string;
  core_conclusion?: string;
  judgment_lock?: string;
  user_feed: string;
}): { system: string; user: string } {
  const user = [
    `## 本页 key=${input.key} locale=${input.locale}`,
    pageDutyBlock(input.key),
    input.core_conclusion?.trim()
      ? `## core_conclusion\n${input.core_conclusion.trim()}`
      : "",
    input.judgment_lock?.trim()
      ? `## 本页原始批断（扎根用；P2 可译；P3+ 勿整段译文成手段）\n${input.judgment_lock.trim()}`
      : "",
    input.user_feed.trim() ? `## 本案真算/菜单喂料\n${input.user_feed.trim()}` : "",
    `## JSON 形状\n${pageShapeHint(input.key)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { system: BODY_SYSTEM, user };
}

export function formatJudgmentLockForBody(
  plan: DeepEvidencePlan | null | undefined,
  pageKey?: DeliverySegmentKey,
): string {
  if (!plan?.units?.length) return "";
  const n = plan.units.length;
  const cardName =
    pageKey === "foundation"
      ? "why_cards"
      : pageKey === "science_action"
        ? "angles（主辅 toolkit）"
        : "dimensions";
  const header = `（共 ${n} 条 · 正文 ${cardName} 必须恰好 ${n} 条，按 path 一一对齐，禁止压缩合并）\n`;
  return (
    header +
    plan.units
      .map((u, i) => {
        const claim = String(u.unit_claim ?? "").trim();
        const ev = String(u.evidence ?? "").trim();
        const moat = u.moat_class ? ` moat=${u.moat_class}` : "";
        return `[${i}] path=${u.path}${moat}\nclaim: ${claim}\nevidence: ${ev}`;
      })
      .join("\n\n")
  );
}
