import type {
  DeliveryComputed,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_SECTION_HEADINGS } from "@/lib/llm/pro/delivery/delivery-schema";
import { BANNED_TERMS_ZH } from "@/lib/llm/compliance/banned-terms";
import { buildUserFacingExpressionContractBlock } from "@/lib/llm/prompts/user-facing-expression-contract";

/**
 * Expand core_conclusion → independent plain-language arguments + page scan
 * (+ thirty_day_table when the segment is thirty_day).
 *
 * P3/P4 Rx pages use { title, strategy, methods } per argument (composed to labeled body).
 */
export function buildDeliveryNarrativePrompt(
  conclusions: Record<string, string>,
  locale: string,
  opts?: { thirtyDayTableFacts?: string },
): { system: string; user: string } {
  const bannedList = [...BANNED_TERMS_ZH]
    .filter((w) => w.length >= 2)
    .sort((a, b) => b.length - a.length)
    .join(" / ");
  const expressionContract = buildUserFacingExpressionContractBlock({
    locale,
    preset: "delivery",
  });

  const keys = Object.keys(conclusions);
  const primaryKey = keys[0] ?? "direct_answer";
  const heading = DELIVERY_SECTION_HEADINGS[primaryKey as DeliverySegmentKey]?.zh ?? primaryKey;
  const isThirtyDay = primaryKey === "thirty_day";
  const isRxPage =
    primaryKey === "science_action" || primaryKey === "metaphysics_action";

  const thirtyDayJsonHint = isThirtyDay
    ? `,"thirty_day_table":{"weeks":[{"week":1,"phase_label":"第一周：…","science":["具体可做的一步"],"alignment":["推荐方位：正北 / 正西 / 西北"]},{"week":2,"phase_label":"第二周：…","science":["…"],"alignment":["高频时段：夜间 21:00–01:00"]},{"week":3,"phase_label":"第三周：…","science":["…"],"alignment":["开运色彩/视觉锚点：深蓝、黑色"]},{"week":4,"phase_label":"第四周：…","science":["…"],"alignment":["协同人群：具备平静与适应力的伙伴"]}]}`
    : "";

  const argJsonExample = isRxPage
    ? `{"arguments":[{"title":"短标题","strategy":"本维决策策略(40–120字)…","methods":"本维可对照手段(40–120字)…"},{"title":"另一维","strategy":"…","methods":"…"}],"scan":{"items":[{"label":"短标题","value":"完整白话一句。"},{"label":"另一标题","value":"另一句完整白话。"}]}`
    : `{"arguments":[{"body":"### 子标题\\n\\n该独立论点正文……"},{"body":"### 另一标题\\n\\n……"}],"scan":{"items":[{"label":"短标题","value":"完整白话一句。"},{"label":"另一标题","value":"另一句完整白话。"}]}${thirtyDayJsonHint}}`;

  const fieldRule = isRxPage
    ? `- 【字段·药方页】arguments 每项必须有 "title" + "strategy" + "methods"(三字段齐全);不要 "body"、不要 "evidence"。strategy=决策策略;methods=可对照手段/杠杆。禁止只写一段散文。`
    : `- 【字段】arguments 每项只要 "body";不要 "evidence"(依据另一步写)。`;

  const rxPageRules =
    primaryKey === "science_action"
      ? `
# 本页专规 · 科学药方(每项=策略+手段)
- 整份报告只有**一条主路径+一条辅路径**;本页只写「怎样用科学杠杆走主路 / 何时切辅」——【禁止】再推销一遍主路径口号(换皮复读)。
- 通常 **3–4 项**,每项对应一个科学维(例:角色边界、沟通原则、资源精力配比、易栽与退路切换)。每项 **title + strategy + methods 都必须有**。
- strategy:该维「该怎么决策/守什么」;methods:该维「用什么杠杆动手」(节奏、授权边界、试点机制、健康红线等)——手段≠合同/话术剧本。
- 每项 strategy/methods 各约 40–120 字;两项信息不得互相抄成同一段。
`
      : primaryKey === "metaphysics_action"
        ? `
# 本页专规 · 东方行动方案(每项=策略+行动 · 先真算后包装 · 禁复读 P3)
- 锚定用户【问题+期望】;从 metaphysics_pack + 多维**先长出**状态层补泻(节奏/气质优先),色/向仅次要,再合规包装措辞。
- 「视觉心理/空间心理/生物节律…」只是显示标签,不是选题菜单;有关真算维尽量写全(通常 3–5 项),无关不硬凑。
- 每项 title+strategy+methods;策略须说清「因本盘哪条结构对本案成立」;行动须具体且**反物化**(禁水边/绿植/晒太阳/泥土食物/金属饰品当补泻定义)。
- 禁吉凶/属相/风水/用神/八字/五行字面报幕;禁无盘锚通用养生;禁只有行动没有策略;禁邮件/授权/日历等科学手段(归 P3)。
`
        : "";

  const thirtyDayShapeRule = isThirtyDay
    ? `- 【形状】顶层键是 "arguments" + "scan" + **必填** "thirty_day_table"。禁止段键包裹。`
    : `- 【形状】顶层键是 "arguments"(数组) + "scan"(对象)。禁止 \`{"${primaryKey}":{...}}\` 段键包裹;禁止把 body 直接做成字符串值。`;

  const thirtyDaySection = isThirtyDay
    ? `
# 30天双轨表 thirty_day_table（写完 arguments 后必填 · 不是代码提取）
系统**不会**再用代码从盘面拼表。你必须在 JSON 里给出完整 4 周表。
- weeks **恰好 4 项**, week=1..4;每项含 phase_label / science(1–3条) / alignment(1–3条)。
- **先写 arguments 正文**,再根据本页结论 + 下方「事实锚点」填表;表与正文同方向,勿互相打架。
- 列语义(合规用词 · 禁止旧硬词「玄学适配/朝向适配/精力高频/互补协同」及子/亥等地支):
  1) 推荐方位：正北 / 正西 / 西北（英: Optimal Directions: N / W / NW）
  2) 高频时段：夜间 21:00–01:00（英: Peak Focus Hours: 21:00–01:00）— 用钟点,禁地支
  3) 开运色彩/视觉锚点：深蓝、黑色（英: Visual Anchors: Navy / Black）
  4) 协同人群：具备「水/木」类平静·适应特质的伙伴（英: Synergistic Traits: Calming & Adaptive）— 禁只写 N
- 四周 alignment **优先覆盖上述四类各一**(顺序可按叙事调整);science 写可执行动作,四周勿雷同。
- phase_label 四周互不相同;禁「待补」;禁 ⟦t:⟧ / 干支 / 禁词表字面。
- 表内只写白话完整短语;不要 ASCII 甘特,也不要在 body 里重画表格。
- arguments 只写「四周节奏怎么松紧、为何这样排」——【禁止】再写一遍主路径推销文。
`
    : "";

  const nonRxDutyRules = `- **每个独立论点单独一项**——一段里有几个判断就拆几项(通常 2–4 项)。**一个论点项 = 一个 ### 子标题块;严禁把多个 ### 塞进同一项的 body**。
- 每项 body **必须以 \`### 子标题\` 开头**(标题与正文之间用 \`\\n\\n\`);可用 > 金句 与 - 列表。
- **正文要写充分**:每个论点 body(不含 \`###\` 标题)目标 **120–220 字**。
- **只交本页「${heading}」信息维**;禁止把其他页任务(出门仪式/近7日清单/红灯熔断墙/科学手段表)写进本段。
- 「养根 / 小森林 / 宜守 / 向内积累」类主隐喻全报告≤1次(只许 foundation 页出现)。**禁止各页反复推销同一主路径口号**。`;

  const rxDutyRules = `- **每个独立论点单独一项**= title + strategy + methods;严禁把多维塞进同一项。
- **只交本页「${heading}」信息维**;禁止换皮复读主路径推销句;禁止把其他页职责写进本段。
- 详见上方「本页专规」。`;

  const system = `# 你是谁
你是破局交付书写作者。有人已定稿每段的白话结论(core_conclusion)。
你的工作:把结论扩写成「专业咨询报告一章」——拆成**若干独立论点**,每个论点自成一块;写完后为本页提炼「核心速览」扫读点${isThirtyDay ? ";并为本页产出「未来30天双轨节奏」四列表格内容" : ""}。

# 输出:严格 JSON（整段回复只能是一个 JSON 对象 — 先读完再写内容）
本调用只写 **1 段**;顶层**直接**输出(不要段键包裹):
${argJsonExample}

硬约束:
- 【只输出 JSON】前后零废话、零思维链、无 markdown 围栏(\`\`\`)、无注释。
${thirtyDayShapeRule}
- 【转义】字符串内真实换行必须写成 \`\\n\`;正文里的双引号必须写成 \`\\"\`。禁止在 JSON 字符串里直接敲回车。
${fieldRule}
- arguments 通常 2–4 项${isRxPage ? "(药方页 3–5 项)" : ""}。
${rxPageRules}
# 核心速览 scan（本页写完后必填）
- scan.items 必须有 **2–4** 项;每项 \`{ "label", "value" }\`。
- **label**: 短标题(约 2–8 字),按**本页「${heading}」正在讲的方向**自拟——禁止七页都用同一套固定名。
- **value**: 完整大白话一句;禁止 ⟦t:⟧ / 干支 / 禁词表字面。
- 职责:帮读者 3 秒抓住本页独有信息,勿复读其他页。
${thirtyDaySection}
# 双层职责(Folded Technical Drawer)
- main_body = ${isRxPage ? "title/strategy/methods" : "body"} / scan${isThirtyDay ? " / thirty_day_table" : ""}:严格遵守下方【用户可见表达契约】。
- technical_spine = 另一步「依据与推理」/ evidence——本步【不要】写 evidence。

# 铁律(正文 / scan${isThirtyDay ? " / table" : ""})
- 正文【纯大白话】【零 ⟦t: 标记】【零干支】。
- 【禁词表】(SSOT 全表):
  ${bannedList}
- 【表外也不行】命理黑话、十神、格局/神煞、干支、支月、用忌短语——禁止进正文/scan;改写为大白话。
- 禁软译黑话进正文:锚元/助元/供源/需养/岁环/流展/本元 等。
- 【命运红线】禁止:命运 / 命定 / 宿命 / 天注定。
- 【禁止】正文写 \`⟦t:…⟧\`。
${isRxPage ? rxDutyRules : nonRxDutyRules}
- 不做心理诊断标签。
- 禁字面「玄学/迷信/风水」(含否定式);改用不带这些词的白话。

${expressionContract}
`;

  const lines = keys.map((k) => {
    const h = DELIVERY_SECTION_HEADINGS[k as DeliverySegmentKey]?.zh ?? k;
    return `【段键 ${k} · ${h}】(职责参考;JSON 顶层不要写段键)\n${conclusions[k] ?? ""}`;
  });
  const facts =
    isThirtyDay && opts?.thirtyDayTableFacts?.trim()
      ? `\n\n${opts.thirtyDayTableFacts.trim()}\n`
      : "";
  const user = isThirtyDay
    ? `把下列 core_conclusion 扩写成独立论点列表;每个论点正文写充分(约120–220字)。
写完 arguments 后必须输出本页 scan.items(2–4 项),再输出 thirty_day_table.weeks(恰好4周)。
只输出一个 JSON 对象,形状必须是 {"arguments":[...],"scan":{"items":[...]},"thirty_day_table":{"weeks":[...]}} — 合法 JSON、字符串内换行用 \\n。
${facts}
${lines.join("\n\n")}`
    : isRxPage
      ? `把下列 core_conclusion 扩成药方论点列表;每项必须含 title + strategy + methods(策略与手段成套),禁止单段散文。
写完 arguments 后必须输出本页 scan.items(2–4 项,label 按本页方向自拟)。
只输出一个 JSON 对象,形状必须是 {"arguments":[{"title":"...","strategy":"...","methods":"..."},...],"scan":{"items":[{"label":"...","value":"..."},...]}} — 合法 JSON、字符串内换行用 \\n。

${lines.join("\n\n")}`
      : `把下列 core_conclusion 扩写成独立论点列表;每个论点正文写充分(约120–220字),职责仍按该段原目标。
写完 arguments 后必须输出本页 scan.items(2–4 项,label 按本页方向自拟)。
只输出一个 JSON 对象,形状必须是 {"arguments":[{"body":"..."},...],"scan":{"items":[{"label":"...","value":"..."},...]}} — 合法 JSON、字符串内换行用 \\n。

${lines.join("\n\n")}`;
  return { system, user };
}

export function pickDeliveryConclusions(
  dc: DeliveryComputed,
  paths: readonly DeliverySegmentKey[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of paths) {
    out[k] = dc[k]?.core_conclusion ?? "";
  }
  return out;
}

export function describeDeliveryPaths(paths: readonly DeliverySegmentKey[]): string {
  return paths.map((k) => DELIVERY_SECTION_HEADINGS[k].zh).join("、");
}
