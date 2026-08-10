/**
 * 汇总段(第4段) · SYNTHESIS_TASK + prompt/parse
 * 读第2段多维真算 + 第3段收集现实 → 收敛 primary_path / backup_path + 行动方案。
 */

import type { ModernActionFrame } from "@/lib/poju/agent-state";
import type { SynthesisJobInput } from "@/lib/poju/xhigh-job-types";
import { buildOutputPolicyForPoju } from "@/lib/llm/compliance/output-policy";
import { POJU_IDENTITY } from "@/lib/llm/prompts/poju-base";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { extractJson, tolerantJsonRepair, tryParseJsonObject } from "@/lib/llm/phases/phase-transport";

export const SYNTHESIS_TASK = `# 角色：破局总设计师（汇总 · 只收敛）
你手上有两份东西：①第2段的【多维真算】(每个命理维度的判断)；②第3段【收集到的现实料】。
你的唯一任务：把它们汇总，**收敛出一主一辅的破局方向 + 行动方案**，直面用户目标(desired_outcome)。
你【不再真算命理】(第2段已算全)、【不写报告】(那是交付段)——你只做"汇总→收敛→定方案"这一件事。

# 输入
- multi_dimension_reckoning：各维度命理判断(你收敛的命理依据全在这，别另算)。
- covered_agenda：用户的现实情况(资源/时间/执行力/约束…)。
- desired_outcome / original_question：靶心。

# 任务
1. primary_path(主路径,【只1条】)：综合【多维命理 + 现实收集】，判出通向 desired_outcome 最适配的【路径类型】——明说"我最建议你走这条"。
   - 方向 = 路径类型(如"这阶段适合依托稳定结构先求收入""适合独立产出变现")，【不是】"把用户当前那个项目怎么搞"；
   - why_fits 要【同时引用多维命理判断 + 用户现实】(如"你的十神格局X + 大运Y + 你说的现实Z → 所以这条最适配")；
   - 用户当前手段放在这个方向下评估匹配度，不预设它是答案。
2. backup_path(辅路径,【只1条】)：通向【同一 desired_outcome】的另一条适配路径(主路径落不了地时的退路)，不是放弃目标去做别的。
3. action_plan：主/辅各自的可执行行动骨架。

# 铁律
- 【多维收敛,不是单点】：收敛必须综合 multi_dimension_reckoning 的【多个维度】，不许只抓一个维度定方向(那就退回单锚点了)。
- 【命理只解释机制、不发明事实】：现实以 covered_agenda 为准，命理只解释"为什么"、指方向，不反推用户没说的事实。
- 【合规表达】：用"适配度最高/阻力最小 + 明确推荐"；【严禁】"你不适合X/你运势不好"这类命运断言。
- 【撑得起报告·自检】：主路径要能撑起交付8页、每页直面 desired_outcome、不空洞不离题；某页会因主方向写不出实质→重新收敛。

# 输出(严格 JSON · 无围栏)
键名英文小写 ASCII 双引号。
{
  "primary_path": {
    "direction": "...",
    "why_fits": "...",
    "structural_basis": "...",
    "needs_validation": "...",
    "status": "selected"
  },
  "backup_path": {
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
【骨架字段一律中文写】；primary_path / backup_path 必产。
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
综合多维 + 现实，收敛出 primary_path + backup_path + action_plan。仅 JSON，无 markdown 围栏。`;

  return { system, user };
}

function mapSynthesisPath(raw: unknown, label: string): ModernActionFrame {
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
  if (!direction || !structural_basis) {
    throw new SynthesisParseError(`${label} missing direction/structural_basis`);
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
export function parseSynthesisResponse(raw: string): SynthesisParsed {
  const cleaned = extractJson(raw) || raw;
  const repaired = tolerantJsonRepair(cleaned);
  const parsed = tryParseJsonObject(repaired) ?? tryParseJsonObject(cleaned);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SynthesisParseError("synthesis response is not a JSON object");
  }
  const o = parsed as Record<string, unknown>;
  return {
    primary_path: mapSynthesisPath(o.primary_path, "primary_path"),
    backup_path: mapSynthesisPath(o.backup_path, "backup_path"),
    action_plan: mapActionPlan(o.action_plan),
  };
}
