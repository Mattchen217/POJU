import type {
  DeliveryComputed,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_SECTION_HEADINGS } from "@/lib/llm/pro/delivery/delivery-schema";
import { BANNED_TERMS_ZH } from "@/lib/llm/compliance/banned-terms";

/**
 * Expand core_conclusion → independent plain-language arguments.
 * Zero term markers / zero 命理 words. Each argument later gets its own evidence.
 */
export function buildDeliveryNarrativePrompt(
  conclusions: Record<string, string>,
  _locale: string,
): { system: string; user: string } {
  // Full SSOT ban list (not a short excerpt) — model must not invent around gaps.
  const bannedList = [...BANNED_TERMS_ZH]
    .filter((w) => w.length >= 2)
    .sort((a, b) => b.length - a.length)
    .join(" / ");

  const system = `# 你是谁
你是破局交付书写作者。有人已定稿每段的白话结论(core_conclusion)。
你的工作:把结论扩写成「专业咨询报告一章」——拆成**若干独立论点**,每个论点自成一块。

# 铁律
- 正文【纯大白话】【零 ⟦t: 标记】【零干支】——给不懂命理的用户看。
- 【禁词表 · 下列字面禁止出现在 body】(SSOT/合规禁裸词，全表):
  ${bannedList}
- 【表外也不行】凡命理黑话、十神简称、格局/神煞名、干支、支月(寅月等)、用忌短语——即使不在上表,也【禁止】进 body;一律改写成感受/行为/处境大白话。
- 禁软译黑话进 body:锚元/助元/供源/需养/岁环/流展/本元 等——那些只属于「依据与推理」层。
- 【命运红线】禁止字面:命运 / 命定 / 宿命 / 天注定(含否定式诱词)。「判决」可作普通白话;禁「命运判决书」。
- 【禁止自造术语标记】body 里【绝不】写 \`⟦t:…⟧\`(依据层才打标)。
- **body / evidence 职责分离**:body 只写白话论证;结构依据另一步写。【禁止】把依据段、术语清单糊进 body。
- 以盘面结构为依据、科学背书:你写落地表达,不另起炉灶唱反调。
- **每个独立论点单独一项**——一段里有几个判断就拆几项(通常 2–4 项)。
- 每项 body **必须以独立行的 \`### 子标题\` 开头**(单独一行,后面换行再写正文);可用 > 金句 与 - 列表。
- **正文要写充分**:每个论点 body(不含 \`###\` 标题)目标 **120–220 字**(中文)或同等信息量的英文段落——把结论说透、说具体,避免一两句就收束。可拆 2–4 个短段,但【不要】凑字灌水,也不要套固定三段论。
- **定位不变**:各段仍只完成该段原有任务(见下)。禁止给所有论点强加统一模板(如「处境→机制→今日动作」);扩写深度服务该段目标,不改职责边界。
- action:具体步骤/第一步/可能的坑;retune:方向/条件成熟时机/日常习惯(不报日期)。
- energy:只写中立能量结构,不投射职业婚恋事件。
- 不做心理诊断标签。

# 输出 JSON(严格)
键与输入相同。每个键的值是对象:
\`{ "arguments": [ { "body": "### 标题\\n\\n该独立论点正文" }, ... ] }\`
不要输出 evidence 字段(依据另一步写)。
`;
  const payload = JSON.stringify(conclusions, null, 2);
  const user = `把下列各段 core_conclusion 扩写成独立论点列表;每个论点正文写充分(约120–220字),职责仍按各段原目标。输出 JSON 必须含全部 key。\n\`\`\`json\n${payload}\n\`\`\``;
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
