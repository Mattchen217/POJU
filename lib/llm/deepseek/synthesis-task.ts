/**
 * 汇总段(第4段) · SYNTHESIS_TASK + prompt/parse
 * 读第2段多维真算 + 第3段收集现实 → 收敛 primary_path / backup_path + 行动方案。
 */

import type { ModernActionFrame } from "@/lib/poju/agent-state";
import type { SynthesisJobInput } from "@/lib/poju/xhigh-job-types";
import { buildOutputPolicyForPoju } from "@/lib/llm/compliance/output-policy";
import { POJU_IDENTITY } from "@/lib/llm/prompts/poju-base";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { buildUserFacingExpressionContractBlock } from "@/lib/llm/prompts/user-facing-expression-contract";
import { extractJson, tolerantJsonRepair, tryParseJsonObject } from "@/lib/llm/phases/phase-transport";
import { PIVOT_DUAL_PARTY_POLICY } from "@/lib/llm/prompts/pivot-dual-party-policy";

export const SYNTHESIS_TASK = `# 角色：破局总设计师（汇总 · 只收敛）
你手上有两份东西：①第2段的【多维真算】(每个命理维度的判断)；②第3段【收集到的现实料】。
你的唯一任务：把它们汇总，**收敛出一主一辅的破局方向 + 行动方案**，直面用户目标(desired_outcome)。
你【不再真算命理】(第2段已算全)、【不写报告】(那是交付段)——你只做"汇总→收敛→定方案"这一件事。

${PIVOT_DUAL_PARTY_POLICY}

# 输入
- multi_dimension_reckoning：各维度命理判断(你收敛的命理依据全在这，别另算)。
- covered_agenda：用户的现实情况(资源/时间/执行力/约束…；二元案含对方角色/行为/你的底线)。
- desired_outcome / original_question：靶心。
- （可选）Match 合盘摘要：仅作关系机制锚，禁止据此重写合盘报告。

# 任务
1. primary_path(主路径,【只1条】)：综合【多维命理 + 现实收集】，判出通向 desired_outcome 最适配的【路径类型】——明说"我最建议你走这条"。
   - 方向 = 路径类型(如"这阶段适合依托稳定结构先求收入""适合独立产出变现")，【不是】"把用户当前那个项目怎么搞"；
   - why_fits 要【同时引用多维能量结构判断 + 用户现实】(如"你的容量/压力带判断 + 你说的现实Z → 所以这条最适配")；【禁止】「十神格局X + 大运Y」裸词模板写进 why_fits/direction。
   - 用户当前手段放在这个方向下评估匹配度，不预设它是答案。
   - 二元案：主路径必须是【用户可执行】的边界/节奏/投入策略；对方只作型人+现实约束，不作第二主盘。
2. backup_path(辅路径,【只1条】)：通向【同一 desired_outcome】的另一条适配路径(主路径落不了地时的退路)，不是放弃目标去做别的。
3. action_plan：主/辅各自的可执行行动骨架(白话可执行)。
4. 若靶心本质是「我们合不合」：在 why_fits/needs_validation 点明完整双人契合须看 Match；此处仍收敛【你侧】走法。

# 承重锚（先算后写 · 硬 · 选项×结构双绑）
- chart_anchors: 字符串数组，【每条路径≥2】。必须从 multi_dimension_reckoning[].chart_basis（及可选 inventory）里**选出**承重真词，禁止空、禁止编造盘外词。
- 优先点选 inventory「题型真算锚」「大运攻守松紧」token，再落十神/关系/用神。
- reality_anchors: 字符串数组。当 covered_agenda 非空时【每条路径≥1】，必须来自 covered_agenda 的 label/answer 原文要点，禁止发明用户没确认的事实。二元案优先挂对方角色/行为/你的底线。
- 【双绑铁律】主辅各自 = chart_anchors(结构) × reality_anchors(现实);只绑一头 = 废稿。无现实料可收集时 reality_anchors 可空数组。
- 生长顺序：先定 chart_anchors（+有料则 reality_anchors）→ 再写 direction/why_fits；删掉任一侧锚后若 why_fits 仍「谁都适用」→ 重写。

# 可见句 vs 内部锚
- direction / why_fits / action_plan：用户可见(进交付)→遵守用户可见表达契约。
- structural_basis / chart_anchors / needs_validation：内部收敛锚，可短引擎词供下游；勿当成聊天口吻整段甩给用户。

# 铁律
- 【多维收敛,不是单点】：收敛必须综合 multi_dimension_reckoning 的【多个维度】，不许只抓一个维度定方向(那就退回单锚点了)。
- 【命理只解释机制、不发明事实】：现实以 covered_agenda 为准，命理只解释"为什么"、指方向，不反推用户没说的事实。
- 【合规表达】：用"适配度最高/阻力最小 + 明确推荐"；【严禁】"你不适合X/你运势不好"这类命运断言。
- 【撑得起报告·自检】：主路径要能撑起交付6页、每页直面 desired_outcome、不空洞不离题；某页会因主方向写不出实质→重新收敛。
- 【禁合盘翻版】：禁止输出对方八字断言、双人契合分数墙、合盘专章。

# 输出(严格 JSON · 无围栏)
键名英文小写 ASCII 双引号。
{
  "primary_path": {
    "chart_anchors": ["真词1", "真词2"],
    "reality_anchors": ["议程要点可选"],
    "direction": "...",
    "why_fits": "...",
    "structural_basis": "...",
    "needs_validation": "...",
    "status": "selected"
  },
  "backup_path": {
    "chart_anchors": ["真词1", "真词2"],
    "reality_anchors": [],
    "direction": "...",
    "why_fits": "...",
    "structural_basis": "...",
    "needs_validation": "...",
    "status": "hypothesis"
  },
  "action_plan": {
    "primary": "...",
    "backup": "..."
  }
}
【骨架字段一律中文写】；primary_path / backup_path 必产；chart_anchors 每条路径≥2。
`;

export type SynthesisActionPlan = {
  primary?: string;
  backup?: string;
};

export type SynthesisParsed = {
  primary_path: ModernActionFrame;
  backup_path: ModernActionFrame;
  action_plan: SynthesisActionPlan;
};

export class SynthesisParseError extends Error {
  constructor(message = "synthesis_parse_failed") {
    super(message);
    this.name = "SynthesisParseError";
  }
}

export function buildSynthesisPrompt(input: {
  job_input: SynthesisJobInput;
  locale: string;
}): { system: string; user: string } {
  const { job_input, locale } = input;

  const system = stitchPromptSections(
    POJU_IDENTITY,
    buildOutputPolicyForPoju(),
    SYNTHESIS_TASK,
    // Visible fields only; do not put mapping table into POJU_IDENTITY.
    buildUserFacingExpressionContractBlock({ locale, preset: "synthesis" }),
  );

  const reportPages =
    Array.isArray(job_input.report_pages) && job_input.report_pages.length > 0
      ? job_input.report_pages
          .map((p) => `- ${p.id}（${p.title}）：${p.purpose}`)
          .join("\n")
      : "（未附报告页清单；仍按撑得起交付全貌自检。）";

  const user = `【locale】${locale}

【desired_outcome】
${job_input.desired_outcome || "（未写明，扣住 original_question）"}

【original_question】
"${job_input.original_question}"

【question_category】
${job_input.question_category || "other"}

【multi_dimension_reckoning · 第2段多维真算(唯一命理依据 · 勿另算)】
${JSON.stringify(job_input.multi_dimension_reckoning, null, 2)}

【covered_agenda · 第3段收集现实】
${JSON.stringify(job_input.covered_agenda, null, 2)}

【structured_inventory · 命盘锚点(可选复核,不以它重算)】
${job_input.structured_inventory || "（无）"}

【报告页(撑得起报告自检)】
${reportPages}

【任务 · 汇总段】
综合多维 + 现实，收敛出 primary_path + backup_path + action_plan。
每条路径必须含 chart_anchors≥2（选自多维 chart_basis）。
若 covered_agenda 非空：每条路径还必须含 reality_anchors≥1（选自议程 label/answer）。结构×现实双绑。仅 JSON，无 markdown 围栏。`;

  return { system, user };
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function coveredAgendaHasSubstance(
  agenda: ReadonlyArray<{ label?: string; answer?: string }> | undefined,
): boolean {
  if (!Array.isArray(agenda) || agenda.length === 0) return false;
  return agenda.some((a) => {
    const label = typeof a?.label === "string" ? a.label.trim() : "";
    const answer = typeof a?.answer === "string" ? a.answer.trim() : "";
    return Boolean(label || answer);
  });
}

function mapSynthesisPath(
  raw: unknown,
  label: string,
  requireRealityAnchors: boolean,
): ModernActionFrame {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SynthesisParseError(`${label} invalid`);
  }
  const row = raw as Record<string, unknown>;
  const direction = typeof row.direction === "string" ? row.direction.trim() : "";
  const structural_basis =
    typeof row.structural_basis === "string" ? row.structural_basis.trim() : "";
  const why_fits = typeof row.why_fits === "string" ? row.why_fits.trim() : "";
  const needs_validation =
    (typeof row.needs_validation === "string" ? row.needs_validation.trim() : "") ||
    "汇总已收敛,交付展开时补现实细节";
  const chart_anchors = parseStringArray(row.chart_anchors);
  const reality_anchors = parseStringArray(row.reality_anchors);
  if (!direction || !structural_basis) {
    throw new SynthesisParseError(`${label} missing direction/structural_basis`);
  }
  if (chart_anchors.length < 2) {
    throw new SynthesisParseError(`${label} missing chart_anchors (≥2 required)`);
  }
  if (requireRealityAnchors && reality_anchors.length < 1) {
    throw new SynthesisParseError(
      `${label} missing reality_anchors (≥1 required when covered_agenda present)`,
    );
  }
  const statusRaw = typeof row.status === "string" ? row.status.trim() : "";
  const status =
    statusRaw === "hypothesis" ||
    statusRaw === "reinforced" ||
    statusRaw === "selected" ||
    statusRaw === "weakened"
      ? statusRaw
      : label === "primary_path"
        ? ("selected" as const)
        : ("hypothesis" as const);
  return {
    direction,
    why_fits: why_fits || "综合多维命理与现实收集后适配",
    structural_basis,
    needs_validation,
    status,
    chart_anchors,
    ...(reality_anchors.length ? { reality_anchors } : {}),
  };
}

function mapActionPlan(raw: unknown): SynthesisActionPlan {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    if (typeof raw === "string" && raw.trim()) {
      return { primary: raw.trim() };
    }
    return {};
  }
  const row = raw as Record<string, unknown>;
  const primary =
    typeof row.primary === "string"
      ? row.primary.trim()
      : typeof row.primary_path === "string"
        ? row.primary_path.trim()
        : undefined;
  const backup =
    typeof row.backup === "string"
      ? row.backup.trim()
      : typeof row.backup_path === "string"
        ? row.backup_path.trim()
        : undefined;
  return {
    ...(primary ? { primary } : {}),
    ...(backup ? { backup } : {}),
  };
}

/** Parse synthesis LLM JSON → primary/backup + action_plan. */
export function parseSynthesisResponse(
  raw: string,
  opts?: { covered_agenda?: ReadonlyArray<{ label?: string; answer?: string }> },
): SynthesisParsed {
  const cleaned = extractJson(raw) || raw;
  const repaired = tolerantJsonRepair(cleaned);
  const parsed = tryParseJsonObject(repaired) ?? tryParseJsonObject(cleaned);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SynthesisParseError("synthesis response is not a JSON object");
  }
  const o = parsed as Record<string, unknown>;
  const requireReality = coveredAgendaHasSubstance(opts?.covered_agenda);
  return {
    primary_path: mapSynthesisPath(o.primary_path, "primary_path", requireReality),
    backup_path: mapSynthesisPath(o.backup_path, "backup_path", requireReality),
    action_plan: mapActionPlan(o.action_plan),
  };
}
