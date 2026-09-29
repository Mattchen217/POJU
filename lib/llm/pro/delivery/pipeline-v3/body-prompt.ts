/**
 * Pipeline v3 · body prompt — short, greenfield.
 * No legacy fill-prompt ban lists / soft-strip priming.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";

const BODY_SYSTEM = `你是交付报告「白话正文」写手（Pipeline v3 · 内容步①正文）。
只输出 JSON，不要 markdown。

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
8. **宫位报幕**（配偶宫/合伙宫位等）——可见层改写为合作关系/关系结构白话；真词只留 chart_anchors

自检：删掉一切专名后，结论是否仍可读且仍锚本案？若只剩空壳或必须靠专名才能懂 → 用精力/节奏白话重写。

## 其它铁律
- 批断只扎根论证，不是把批断译成正文（P2 例外：正文≈批断白话，但仍零专名）。
- **P1 = 核心直答 · 一主一辅**。禁止三块散文；禁止把 P3 手段清单或 P4 谋略段塞进 P1。
- P3 = 科学可执行（合同/里程碑/清单）；**P4 = 东方谋略暗锦囊（奇门知局+八字知己 · 局势/意象/仪轨）——主语是局/气/身心场域，不是协议/交付物**；禁 P3 工具词族换皮进 P4。
- 禁止 ⟦w:⟧/⟦t:⟧ 进正文；禁止恐吓预测。
- **禁正例照抄（整类）**：跨案可抄的固定身心配方（「深呼吸三轮」「温凉饮一口」「背靠实墙十分钟」等）勿当默认稿。P4 仪轨只许在节奏/场域/身心**类别上限**内按本案真算自生长，且整页不可只剩同一套养生模板。
- **禁逐字开口稿（整类 · 硬）**：strategy / means 禁止引号可照念台词与多拍分镜；需要意图时只用间接叙述（写边界/节奏，不写可照念句子）。
质量只靠本提示与 user 真算/批断料——一次写合格，不要自我审查成空壳。`;

function pageDutyBlock(key: DeliverySegmentKey): string {
  switch (key) {
    case "direct_answer":
      return [
        `## 本页 duty · direct_answer（P1 核心直答）`,
        `- 整报告只有 **一主一辅**：primary = 最建议走的攻坚轨；backup = 主路受阻/难落地时的第二方案。`,
        `- 结构必须是：core_judgment + primary + backup（**不要** dimensions[] 散文块）。`,
        `- **必须先吃冻结批断（硬）**：user 里「本页原始批断」含 path=core_judgment/primary/backup。正文主辅从这三条机制长出，禁止另编与批断无关的第三套故事。`,
        `- **主辅必须真算可推（硬）**：批断 + 总纲 / Fact-pack →「此刻宜守什么、忌冒进什么、主路为何、辅路何时切」。自检：删掉批断后主辅若仍处处成立 = 废稿。`,
        `- 本页 UI **不挂**依据折层；批断只供生成与 Lab 人审。`,
        `- **core_logic 必须写厚（硬）**：primary / backup 各用空行分成 **4 短段**（合计约 380–560 字，禁一两段电报）：`,
        `  ①路是什么（角色/投入边界——叙事，不是步骤表）`,
        `  ②为何对本案成立（能量画像白话扎根；删掉后应垮）`,
        `  ③成功样貌（对方/收入/话语权上可见的变化，写具体）`,
        `  ④切辅/止损边界（何种信号下不能硬走、何时切到另一轨——写清触发条件）`,
        `- why / when 必填实质句；name 贴本案（禁 Primary path 英文占位）。`,
        `- **标题贴本案（硬）**：page_title / page_subtitle 必须含本案具体取舍（如兼职试水 vs 暂守）。**禁止**模板副题：「点明攻坚轨 vs 止损轨」「攻坚轨：…；止损轨：…」这类元说明。`,
        `- **能量画像用语（硬）**：扎根用「基于你的能量画像…」；禁「盘面/命盘/八字」报幕。`,
        `- **可见正文零专名（硬 · 类别）**：title/core_logic/why/when 等可见字段遵守 system 七类禁区；真词只留 chart_anchors 与上游批断。自检：可见字段是否仍依赖十神/用忌/岁运干支/合冲专名才能读懂？→ 是则改成精力/节奏白话。`,
        `- chart_anchors 可放闭集短标签（内部承重）；**禁止**把 anchors 原文粘进 core_logic。`,
        `- **辅路 = 决策备选轨，不是法律 SOP**：可写「降维为顾问/收费试水、先锁边界再谈合伙」等节奏选择；禁律师起草、合同条款表、股权比例模板、融资确权步骤（那是 P3）。`,
        `- 禁区：冥想调候清单；禁「东方谋略看…」另起一段（P4）；禁把「对方该怎么改」写成主路径；角色称呼须与上游一致（勿把对方的型人标签安到用户头上）。`,
      ].join("\n");
    case "foundation":
      return [
        `## 本页 duty · foundation（P2）`,
        `- 正文≈批断白话翻译；多卡表象+本质；末卡收敛到主辅为何成立。`,
        `- 用 why_cards[{title,surface,essence}]，不要随便改成 dimensions。`,
      ].join("\n");
    case "science_action":
      return [
        `## 本页 duty · science_action（P3 科学策略+手段）`,
        `- 落实 P1 一主一辅：primary_toolkit / backup_toolkit 各 **3** 个 angle；键名钉死，勿改成 primary/backup/tracks。`,
        `- 每角 = name + strategy（2–3 短段，空行分隔）+ means（1–6 条可动手）+ chart_anchors。`,
        `- **批断只扎根（硬）**：strategy 须有一句只对本案成立的结构由头（删依据应垮）；**禁止**把批断机制链译成 strategy/means。`,
        `- **means 源**：回溯【P3 科学手段候选菜单】/ means_candidate_ref / 收集事实；主轨 ≥1 条含「今晚可出示交付物」且细节贴本案。`,
        `- **可见字段零专名（硬）**：page_title/subtitle/toolkit.title/angle.name/strategy/means 遵守 system 八类禁区（含宫位报幕）；扎根用「能量画像」；合作摩擦写「合作关系结构」，禁写「宫位」。`,
        `- **chart_anchors（内部承重）**：只放闭集短标签（如「食伤偏显〔中性〕」）；**禁止**把专名长句粘进 strategy/means；**禁止**在 anchors 里写宜守/试水等处方。`,
        `- **禁正例动作进 means（整类）**：冥想、深呼吸、独处调候、温凉饮、背靠墙、仪式调频——一律禁止。焦虑/精力管理改写边界动作或复盘节点。`,
        `- **禁逐字开口稿（硬 · 类别）**：`,
        `  ✗ means/strategy 出现「」或 "" 包住的可照念句`,
        `  ✗ 「可以这样说 / 告诉对方 / 明确表示 / 自然引入 / 使用…作为缓冲」后接台词`,
        `  ✓ 间接叙述：向对方表明财务底线；请律师审阅意向书要点；若对方推脱书面化则降投入预期`,
        `  自检：全文搜索引号——可见字段若仍有可念台词 → 整角重写该 means。`,
        `- 律师/协议/权益书面化：允许作科学手段（贴菜单与收集事实）；禁编造未确认的股权比例模板与恐吓式必签。`,
        `- 辅轨三角须与主轨互补（守位/旁路/换轨条件），禁止换皮复读主轨试水手段。`,
        `- 对方只作现实约束；禁止替对方写心理/台词/改命剧本。`,
        `- 自检：①零专名含无宫位？②无冥想正例？③无引号台词？④批断删掉后是否垮？任一条否=重写。`,
      ].join("\n");
    case "metaphysics_action":
      return [
        `## 本页 duty · metaphysics_action（P4 东方谋略 · 暗锦囊）`,
        ``,
        `### 定位（硬 · 相对 P3）`,
        `- P4 ≠ 第二份科学执行页，≠「自我调频语言包装的 P3」。`,
        `- **主语**：局 / 气 / 我的身心与场域。**不是**对方协议、里程碑、交付物、律师。`,
        `- **双核真算**：八字知己 + 奇门锁盘知局；strategy 删掉奇门或用忌锚后必须垮。`,
        `- **条数钉死（硬）**：dimensions **恰好等于**「本页原始批断」units 条数（本案通常 6）；path 按序对齐 dimensions[0]…dimensions[n-1]。**禁止**把六条批断压成三柱三条。`,
        `- **三柱 = 维名覆盖，不是条数=3**：在全部 dimensions 里——`,
        `  ① ≥1 维名含「局势」`,
        `  ② ≥1 维名含「意象」`,
        `  ③ **恰好 1** 维名含「行为仪轨」`,
        `  其余维用「局势/意象/站位」展开批断对应轴；站位维用「站位」，勿挤占仪轨名额。`,
        `- 每一维必须吃对应 path 的冻结批断长出；禁另编与批断无关的第三套故事。`,
        ``,
        `### 可见正文零专名（硬）`,
        `- name/strategy/means/title/subtitle：遵守 system 八类禁区——**strategy 里写「用神/忌神/食神/大运干支」=废稿**。`,
        `- 允许兵法意象白话：伏击、静默、破局、借势、气口、锋芒、藏隐、守成、露锋、时空差。`,
        `- **禁止**可见层：十神原名、干支连写、用神/忌神/喜神报幕、大运流年+干支、合冲刑害、奇门门星宫原名、命盘/八字报幕。`,
        `- 映射改写（类别）：用神弱→「涵养/缓冲偏弱」；忌神旺→「耗损场偏重」；食神泄秀→「产出节律」；窗口收窄→「近窗承压/加码窗口未开」。真词只进 chart_anchors。`,
        `- 扎根用语：「能量画像 / 当前局势 / 气场」。`,
        ``,
        `### means 形态（硬隔离 P3）`,
        `- **局势 means**：藏隐/守成/观气口/不硬接催促场/信息静默拉时空差——有奇门局势由头。`,
        `- **意象 means**：靠近沉静迂回气质、不入对方火急节奏、独处降速——零专名。`,
        `- **站位 means**：借势不争锋、内守防封闭、产出节律——**禁止**技术模块交付换筹码、建议方案话术。`,
        `- **仪轨 means**：∈ 节奏差 / 空间切断 / 体态收势；跨维禁复读同一动作茎。`,
        `- **整类禁止作 means 主体**（出现即废）：`,
        `  合同/条款/股权/律师、书面权益/权益明确化、里程碑锁权益、`,
        `  技术模块/技术方案/架构文档/阶段性成果交付换筹码、`,
        `  兼职试水SOP/兼职观察期考核表、Excel/OKR、完整谈判话术。`,
        `- **禁逐字开口稿（硬）**：禁止「」或 ""；禁止「以"…"为由」「借口"…"」；时空差只写间接意图（拉开回应间隔、中断纠缠后离开现场），不写可照念句子。`,
        `- **禁正例照抄**：禁固定「静坐10分钟/深呼吸三轮/背靠实墙/温凉饮」跨案配方。`,
        ``,
        `### 其它`,
        `- 批断只扎根：可吸收机制，**禁止**把批断真词粘进 strategy。`,
        `- page_title/subtitle 贴本案气场博弈（禁空壳模板题）。`,
        `- chart_anchors：闭集短标签；勿粘进 strategy/means。`,
        `- 落笔前搜一遍：用神|忌神|食神|「 → 命中则整维重写。`,
        `- 自检：①条数=批断？②三柱维名？③strategy/means 零专名？④means 无 P3/交付物/权益/兼职SOP？⑤无引号？任一条否=重写。`,
      ].join("\n");
    case "risk_guard":
      return `## 本页 duty · P5\n执行坑+防法，指回上游动作。`;
    case "signals_close":
      return `## 本页 duty · P6\n今晚一事+近7日+收尾；禁四周甘特。`;
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
      return `输出：{ "page":"foundation", "page_title":"...", "page_subtitle":"...", "why_cards":[{ "title":"...", "surface":"用户可见表象", "essence":"结构本质白话（≈批断译）", "chart_anchors":[] }] }`;
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
        `硬自检：条数=批断；维名覆盖局势+意象+恰好一行为仪轨；strategy/means 搜「用神|忌神|食神|大运|」须为零；means 无技术模块/权益/兼职SOP/书面框架；全文无中英文引号台词；无背靠实墙等跨案正例。`,
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
): string {
  if (!plan?.units?.length) return "";
  const n = plan.units.length;
  const header = `（共 ${n} 条 · 正文 dimensions 必须恰好 ${n} 条，按 path 一一对齐，禁止压缩成三柱三条）\n`;
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
