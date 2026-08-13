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
 * JSON contract (single-segment task):
 *   {
 *     "arguments": [ { "body": "..." }, ... ],
 *     "scan": { "items": [ { "label": "...", "value": "..." }, ... ] },
 *     "thirty_day_table"?: { "weeks": [ { week, phase_label, science[], alignment[] }, ×4 ] }
 *   }
 */
export function buildDeliveryNarrativePrompt(
  conclusions: Record<string, string>,
  locale: string,
  opts?: { thirtyDayTableFacts?: string },
): { system: string; user: string } {
  // Full SSOT ban list (not a short excerpt) — model must not invent around gaps.
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

  const thirtyDayJsonHint = isThirtyDay
    ? `,"thirty_day_table":{"weeks":[{"week":1,"phase_label":"第一周：…","science":["具体可做的一步"],"alignment":["推荐方位：正北 / 正西 / 西北"]},{"week":2,"phase_label":"第二周：…","science":["…"],"alignment":["高频时段：夜间 21:00–01:00"]},{"week":3,"phase_label":"第三周：…","science":["…"],"alignment":["开运色彩/视觉锚点：深蓝、黑色"]},{"week":4,"phase_label":"第四周：…","science":["…"],"alignment":["协同人群：具备平静与适应力的伙伴"]}]}`
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
`
    : "";

  const system = `# 你是谁
你是破局交付书写作者。有人已定稿每段的白话结论(core_conclusion)。
你的工作:把结论扩写成「专业咨询报告一章」——拆成**若干独立论点**,每个论点自成一块;写完后为本页提炼「核心速览」扫读点${isThirtyDay ? ";并为本页产出「未来30天双轨节奏」四列表格内容" : ""}。

# 输出:严格 JSON（整段回复只能是一个 JSON 对象 — 先读完再写内容）
本调用只写 **1 段**;顶层**直接**输出(不要段键包裹):
{"arguments":[{"body":"### 子标题\\n\\n该独立论点正文……"},{"body":"### 另一标题\\n\\n……"}],"scan":{"items":[{"label":"短标题","value":"完整白话一句。"},{"label":"另一标题","value":"另一句完整白话。"}]}${thirtyDayJsonHint}}

硬约束:
- 【只输出 JSON】前后零废话、零思维链、无 markdown 围栏(\`\`\`)、无注释。
${thirtyDayShapeRule}
- 【转义】body / value / phase_label / science / alignment 内真实换行必须写成 \`\\n\`;正文里的双引号必须写成 \`\\"\`。禁止在 JSON 字符串里直接敲回车。
- 【字段】arguments 每项只要 "body";不要 "evidence"(依据另一步写)。
- arguments 通常 2–4 项。

# 核心速览 scan（本页写完后必填）
- scan.items 必须有 **2–4** 项;每项 \`{ "label", "value" }\`。
- **label**: 短标题(约 2–8 字),按**本页「${heading}」正在讲的方向**自拟——禁止七页都用同一套固定名(如每页都写「当前策略/核心功课/破局钥匙」)。
- **value**: 完整大白话一句(可稍长),扫读即懂;禁止半截逗号开头;禁止 ⟦t:⟧ / 干支 / 禁词表字面。
- 职责:帮读者 3 秒抓住本页独有信息(结论/动作/边界/节奏/环境等——随页选),勿复读仪表盘标题、甘特周表、依据层术语。
- 示例方向(仅参考,非强制字段名):能量页可写「一眼结论」「近月节奏」;行动页可写「第一步」「常见坑」;环境页可写「空间」「时段」;风险页可写「红灯」「边界」。
${thirtyDaySection}
# 双层职责(Folded Technical Drawer)
- main_body = body / scan${isThirtyDay ? " / thirty_day_table" : ""}:严格遵守下方【用户可见表达契约】;纯白话+受控映射。
- technical_spine = 另一步「依据与推理」/ evidence:允许闭集专业词与打标——本步【不要】写 evidence,也【不要】把真词清单糊进 body。
- 质感目标:正文通俗可落地;折叠展开后有硬核系统依据。

# 铁律(写进 body / scan.value${isThirtyDay ? " / thirty_day_table" : ""} 的内容)
- 正文【纯大白话】【零 ⟦t: 标记】【零干支】——给不懂命理的用户看。
- 【禁词表 · 下列字面禁止出现在 body / scan${isThirtyDay ? " / table" : ""}】(SSOT/合规禁裸词，全表):
  ${bannedList}
- 【表外也不行】凡命理黑话、十神简称、格局/神煞名、干支、支月(寅月等)、用忌短语——即使不在上表,也【禁止】进 body/scan${isThirtyDay ? "/table" : ""};一律改写成感受/行为/处境大白话。
- 禁软译黑话进 body:锚元/助元/供源/需养/岁环/流展/本元 等——那些只属于「依据与推理」层。
- 【命运红线】禁止字面:命运 / 命定 / 宿命 / 天注定(含否定式诱词)。「判决」可作普通白话;禁「命运判决书」。
- 【禁止自造术语标记】body / scan${isThirtyDay ? " / table" : ""} 里【绝不】写 \`⟦t:…⟧\`(依据层才打标)。
- **body / evidence 职责分离**:body 只写白话论证;结构依据另一步写。【禁止】把依据段、术语清单糊进 body。
- 以盘面结构为依据、科学背书:你写落地表达,不另起炉灶唱反调。
- **每个独立论点单独一项**——一段里有几个判断就拆几项(通常 2–4 项)。**一个论点项 = 一个 ### 子标题块;严禁把多个 ### 塞进同一项的 body**(否则依据挂不到每块,会出现"几段共用一个依据")。
- 每项 body **必须以 \`### 子标题\` 开头**(标题与正文之间用 \`\\n\\n\`);可用 > 金句 与 - 列表。
- **正文要写充分**:每个论点 body(不含 \`###\` 标题)目标 **120–220 字**(中文)或同等信息量的英文段落——把结论说透、说具体,避免一两句就收束。可拆 2–4 个短段,但【不要】凑字灌水,也不要套固定三段论。
- **定位不变**:各段仍只完成该段原有任务(见下)。禁止给所有论点强加统一模板(如「处境→机制→今日动作」);扩写深度服务该段目标,不改职责边界。
- **禁同框架开场**:不要每段/每块都用同一句框架起手(如「你能量不足…」「别再单打独斗…」「先停下来…」「先养根…」「小森林…」)。每块从【本论点自己的独有内容/结论】切入。
- **跨页去重铁律**:「养根 / 小森林 / 宜守 / 向内积累 / 冬天养根」类主隐喻**【全报告最多出现一次】**——只允许落在 foundation。其他页必须给**新维度**(论证支点/科学动作/环境调频/红线/信号),禁止换皮复读同一劝导。
- science_action:把 core_conclusion 那套【基于你命理的决策策略】写透——决策边界/发力点/你这类结构的易栽点/主辅切换条件;可落一个「第一步怎么起」的场景示意(用用户说过的现实料锚一下),但【重心是策略,不是替他写执行剧本/话术脚本/专业流程】。禁「谁都适用」的通用步骤(删掉命理依据还成立=重写)。metaphysics_action:推荐方位/高频时段/视觉锚点/协同人群——每条要能说清「为什么对【你】有用」(根在用神喜忌/五行),不是通用风水;禁吉凶/属相/风水/玄学字面。
- direct_answer:正面直答 + 一句主路径 + 一句为什么;只给结论头,不铺论证;【禁止】重画仪表盘数字表。
- foundation:论证「为什么卡」——按论证需要放底座料(能量/十神/神煞长生/周期),内部小标题分块,收敛到「所以你卡在这」;仪表盘真分解读;禁逐月预测;「养根」类隐喻只此页一次。
- thirty_day:按周解读双轨动作;节奏松紧对应当前大运/阶段(宜守蓄力 vs 可推进),勿把方案平均切4周;表内容只放在 thirty_day_table;【禁止】在 body 吐 ASCII 甘特或 markdown 周表。
- signals_close:正向信号 + 一次性闭环;【禁止】邀请回来追踪/订阅。
- risk_guard:写他这类结构【特有】的坑(忌神/性情盲区导致他反复栽的),不是通用注意事项;只完成该段职责;禁止用「养根」填满。
- 不做心理诊断标签。
- 禁字面「玄学/迷信/风水」(含否定式「这不是玄学」);改用不带这些词的白话。

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
