import type {
  DeliveryArgument,
  DeliveryArgumentTree,
  DeliveryComputed,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_SECTION_HEADINGS } from "@/lib/llm/pro/delivery/delivery-schema";

export type EvidenceArgInput = {
  body: string;
  /** Unit ClaimPlan — evidence must explain these anchors. */
  chart_anchors?: readonly string[];
};

export type EvidenceSegmentInput = {
  bazi_basis: readonly string[];
  chart_anchors?: readonly string[];
  arguments: EvidenceArgInput[];
};

/**
 * Generate raw 命理 evidence per argument — NO ⟦t:⟧ marking, NO soft译.
 * True words must be wrapped in word slots `⟦w:真词⟧` for the code encoder (P1).
 *
 * Calc-first: each argument's chart_anchors (ClaimPlan) are the only chart story
 * this step may explain — do not invent a parallel basis.
 *
 * JSON contract (single-segment task): bare top-level
 *   `{ "arguments": [ { "evidence": "..." }, ... ] }`
 */
export function buildDeliveryEvidencePrompt(
  segments: Record<string, EvidenceSegmentInput>,
  _locale: string,
): { system: string; user: string } {
  const keys = Object.keys(segments);
  const primaryKey = keys[0] ?? "direct_answer";
  const expectedArgs = segments[primaryKey]?.arguments.length ?? 0;

  const system = `# 你是谁
你是命理依据写作者。正文论点与【已锁定的 chart_anchors】已写好;你只为**每一个独立论点**写一条针对性依据。

# 输出:严格 JSON（整段回复只能是一个 JSON 对象）
本调用只写 **1 段**;顶层**直接**输出(不要段键包裹):
{"arguments":[{"evidence":"该论点的命理依据全文"},{"evidence":"…"}]}

硬约束:
- 【只输出 JSON】前后零废话、无 markdown 围栏(\`\`\`)。
- 【形状】顶层唯一键 "arguments"。禁止 \`{"${primaryKey}":{...}}\` 段键包裹。
- 【长度】arguments 长度必须 = ${expectedArgs || "输入同段 arguments 条数"};一一对应下标。
- 【转义】evidence 内换行写成 \`\\n\`;双引号写成 \`\\"\`。
- 只填 evidence,可省略 body。

# 本步唯一目标 · technical_spine(非 main_body)
- 本步写的是折叠「依据与推理」层,【不是】用户可见正文。
- 【豁免】用户可见表达契约的「禁裸词」【不】约束本步;闭集真词必须保留,供展开硬核系统依据。
- **唯一写作目标**:用【该论点 chart_anchors】写出最短且完整的承重证据链——讲清「为何这条正文在命理上成立」。
- 【先算后写·硬】优先使用论点自带的 chart_anchors;若无,再用段级 bazi_basis/chart_anchors。**禁止**引入锚清单之外的新命理情节/新真词当主承重。
- **金字个数不限死**:1 个够就 1 个;锚有几个承重就保留几个。禁止为凑数堆词,也禁止因「怕多」砍掉必要锚。
- 【删凑数自检】删掉任一承重真词,该论点结论还站得住?站得住=凑数→删;站不住=承重→留(承重的一个都不能少)。
- 【简洁·硬】依据须【明显短于】它所解释的正文;禁长篇大论、禁啰嗦铺陈、禁复述行动建议/周计划/鸡汤;用最短白话机制串起锚点即可。
- 【连接白话】多个 \`⟦w:⟧\` 之间必须有扣住本案的大白话因果,禁止真词清单式并排或 \`⟧⟦\` 贴死。
- 【全用完整复合命理真词】:正印/偏印/七杀/正官/六合/三合/天乙贵人…——**禁止单字命理词**(禁:印/杀/合/官/财/冲/害/破 等单字)。
- 【类称禁令】禁止官星/财星/杀星/印星/比劫/食伤 等无唯一锚点的泛称;必须写成具体十神名(正官/七杀、正财/偏财…)。
- 【定界符】每个承重真词用 \`⟦w:真词⟧\` 包住(例:\`⟦w:天乙贵人⟧\`)。**禁止**写 \`⟦t:\` 标记。
- 【≥1真词锚·硬】每条依据至少 1 个 ⟦w:真词⟧;写成纯白话、零真词=判失败重写。
- 【禁止】把真词替换成软译词或纯白话;只解释「为什么这个论点在命理上成立」。
- 每个论点一条依据,一一对应 arguments 下标。
`;

  const blocks = keys.map((k) => {
    const pack = segments[k]!;
    const heading = DELIVERY_SECTION_HEADINGS[k as DeliverySegmentKey]?.zh ?? k;
    const pageAnchors = (pack.chart_anchors?.length ? pack.chart_anchors : pack.bazi_basis) ?? [];
    const basis = pageAnchors.length
      ? pageAnchors.map((b) => `- ${b}`).join("\n")
      : "(无段级 chart_anchors/bazi_basis — 必须用各论点自带 anchors)";
    const args = pack.arguments
      .map((a, i) => {
        const unit = a.chart_anchors?.length
          ? a.chart_anchors.map((x) => `- ${x}`).join("\n")
          : "(无单元 anchors — 回退段级清单;仍禁止另编盘外故事)";
        return `### 论点 ${i + 1}\n【本论点 chart_anchors】\n${unit}\n\n【正文】\n${a.body}`;
      })
      .join("\n\n");
    return `【段键 ${k} · ${heading}】(职责参考;JSON 顶层不要写段键)
【段级承重锚 bazi_basis/chart_anchors】
${basis}

【arguments · 共 ${pack.arguments.length} 条 · 请按同序写 evidence · 只证各论点 anchors】
${args}`;
  });

  const user = `为每个论点写一条命理依据:只解释该论点已锁定的 chart_anchors;最短承重链 + 简洁(短于正文);裸真词用 ⟦w:…⟧ 包住、不打 ⟦t:⟧。
只输出 {"arguments":[{"evidence":"..."},...]} — 长度=${expectedArgs || "与输入 arguments 相同"}、合法 JSON。

${blocks.join("\n\n")}`;
  return { system, user };
}

/** Build evidence-task input: narrative bodies + unit/page ClaimPlan anchors. */
export function pickDeliveryEvidenceInput(
  dc: DeliveryComputed,
  narrative: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
): Record<string, EvidenceSegmentInput> {
  const out: Record<string, EvidenceSegmentInput> = {};
  for (const k of paths) {
    const args = narrative[k] ?? [];
    const bodies: EvidenceArgInput[] =
      args.length > 0
        ? args.map((a) => ({
            body: a.body,
            ...(a.chart_anchors?.length ? { chart_anchors: a.chart_anchors } : {}),
          }))
        : [{ body: dc[k]?.core_conclusion ?? "" }];
    out[k] = {
      bazi_basis: dc[k]?.bazi_basis ?? [],
      chart_anchors: dc[k]?.chart_anchors ?? [],
      arguments: bodies,
    };
  }
  return out;
}

/** @deprecated Use pickDeliveryEvidenceInput — kept for scripts. */
export function pickDeliverySegments(
  dc: DeliveryComputed,
  paths: readonly DeliverySegmentKey[],
): Record<string, { core_conclusion: string; bazi_basis: readonly string[] }> {
  const out: Record<string, { core_conclusion: string; bazi_basis: readonly string[] }> = {};
  for (const k of paths) {
    out[k] = {
      core_conclusion: dc[k]?.core_conclusion ?? "",
      bazi_basis: dc[k]?.bazi_basis ?? [],
    };
  }
  return out;
}

export type { DeliveryArgument };
