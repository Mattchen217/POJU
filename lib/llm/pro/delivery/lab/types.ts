/**
 * Delivery Lab — step-through generation for ops quality inspection.
 * Click-to-run each stage; human approve unlocks the next. Same generators as production.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

export const LAB_TTL_SEC = 60 * 60 * 48;

export type LabStepStatus = "idle" | "running" | "done" | "failed" | "approved" | "stale";

export type LabGateVerdict = {
  passed: boolean;
  failed_rule?: string;
  detail?: string;
};

export type LabAttempt = {
  attempt_number: number;
  timestamp: string;
  duration_ms: number;
  generation_id?: string | null;
  tokens_used?: number;
  input_payload: unknown;
  raw_model_output: unknown;
  processing_actions: Array<{ action: string; detail?: string }>;
  gate_verdict: LabGateVerdict;
  output_to_next_stage: unknown;
  error?: string;
};

export type LabStepRecord = {
  step_key: string;
  status: LabStepStatus;
  attempts: LabAttempt[];
  approved_attempt?: number;
};

export type LabSource = {
  locale: string;
  original_question: string;
  desired_outcome?: string;
  /** Full base_analysis row (must include structured for thesis). */
  base_analysis: unknown;
  breakthrough_core?: unknown | null;
  covered_agenda?: Array<{ label: string; answer?: string }>;
  session_id?: string;
  /** Optional — drives topic_slice hints in thesis feed only. */
  question_category?: string | null;
};

export type LabArtifacts = {
  thesis?: unknown;
  prealloc?: unknown;
  /** page → assignment / plan / page_schema / marked */
  by_page: Partial<
    Record<
      DeliverySegmentKey,
      {
        assignment?: unknown;
        plan?: unknown;
        write_units?: unknown[];
        /**
         * Chunk indexes that timed out / stalled once and should retry with
         * provider escape (DigitalOcean) on the next Lab invoke.
         */
        write_escape_chunks?: number[];
        /** Mark arg-chunk progress (connective partials). */
        mark_partial?: unknown;
        mark_chunk_index?: number;
        page_schema?: unknown;
        evidence?: unknown;
        marked?: unknown;
        core_conclusion?: string;
      }
    >
  >;
  assemble_preview?: string;
};

export type DeliveryLabSession = {
  version: 1;
  lab_id: string;
  created_at: number;
  updated_at: number;
  ops_user: string;
  source: LabSource;
  /** Index into LAB_STEP_DEFS */
  cursor_index: number;
  steps: Record<string, LabStepRecord>;
  artifacts: LabArtifacts;
  approved_order: string[];
};

export type LabStepDef = {
  step_key: string;
  label: string;
  /** Segment page when step is page-scoped */
  page?: DeliverySegmentKey;
  kind:
    | "bootstrap"
    | "thesis"
    | "prealloc"
    | "assign"
    | "write"
    | "write_merge"
    | "fill"
    | "mark"
    | "assemble";
  /** Needs LLM ( forewarn long wait ) */
  uses_llm: boolean;
  /** What must be true before this step is approved. Shown on the Lab step. */
  accept: string;
};

/** Fixed order — unlock only after prior approve. Step keys stay stable for saved labs. */
function deepInspect(page: DeliverySegmentKey, short: string): LabStepDef[] {
  return [
    {
      step_key: `${page}.assign`,
      label: `${short} 派工 · 结构主张`,
      page,
      kind: "assign",
      uses_llm: true,
      accept:
        page === "foundation"
          ? "五张卡各一句本盘结构主张 + 事实档短摘录，不锁词。主张须含日主/柱干支/用喜忌/十神/合冲刑害/大运流年等结构记号；五卡切入互不相同。生活决策白话（兼职/股权/开口谈）属 fill，不进派工。摘录宜与主张同柱同层（主张写支本气则勿只贴天干行）。用户原句、盘外生克，不放行。"
          : "每张卡一句本盘结构主张 + 事实档/真算短摘录，不锁词。生活手段白话与处境/议题结论白话属后续 fill，不进派工主张。执行处方、白话结论摘录、或六张同一句，不放行。",
    },
    {
      step_key: `${page}.write`,
      label: `${short} 批断 · 先写命理`,
      page,
      kind: "write",
      uses_llm: true,
      accept: "依据是无标记的多词命理批断，只展开本卡已锁主张。生克方向落在五行/十神闭集表；地支十神用本气；无感受/职业白话；无主张外合冲。钉在这张盘上。不要 ⟦w:⟧ / ⟦t:⟧。",
    },
    {
      step_key: `${page}.write_merge`,
      label: `${short} 批断合并 · 没有被砍薄`,
      page,
      kind: "write_merge",
      uses_llm: false,
      accept: "合并后每条仍是完整批断，没有掉成真词、没有并成同一段。",
    },
    {
      step_key: `${page}.fill`,
      label:
        page === "foundation"
          ? `${short} 正文 · 只翻译批断`
          : `${short} 正文 · 可执行（批断扎根）`,
      page,
      kind: "fill",
      uses_llm: true,
      accept:
        page === "foundation"
          ? "表象和本质都是上一步批断的白话翻译，零命理词。表象不是问答原句。删掉批断后正文不能独自成立。"
          : "正文体裁=可执行策略/行动/调频/熔断/出门（非批断机制译）；零命理词；须对齐主辅与候选菜单；批断只扎根。删批断后不得变成谁都适用的鸡汤。",
    },
    {
      step_key: `${page}.mark`,
      label: `${short} 依据原样 · 先不打标`,
      page,
      kind: "mark",
      uses_llm: false,
      accept: "第一步：依据折叠仍是原样批断，不做自造术语替换，不改成大白话。软标是质量过了之后的第二步。",
    },
  ];
}

export const LAB_STEP_DEFS: readonly LabStepDef[] = [
  {
    step_key: "bootstrap",
    label: "Bootstrap · 校验盘/问题",
    kind: "bootstrap",
    uses_llm: false,
    accept: "盘和问题能解析。后面所有词都必须落在这张主盘上。",
  },
  {
    step_key: "thesis.gen",
    label: "Thesis · 命盘总纲",
    kind: "thesis",
    uses_llm: false,
    accept: "六维 present 与 structured 对得上。这里是本盘词的来源，不是再限词数。",
  },
  {
    step_key: "prealloc",
    label: "Prealloc · 本盘可引用词",
    kind: "prealloc",
    uses_llm: false,
    accept: "合格是本盘事实档：日主天干、四柱、用喜忌、藏干、合冲都在。滤完的词表复本不算通过。",
  },
  ...deepInspect("foundation", "P2"),
  {
    step_key: "direct_answer.fill",
    label: "P1 正文 · 直答",
    page: "direct_answer",
    kind: "fill",
    uses_llm: true,
    accept: "正面回答问题。若没有先写的批断，不要挂依据。正文零命理词。须在 P3/P4 deep 之前 ready（主辅锚定）。",
  },
  ...deepInspect("science_action", "P3"),
  ...deepInspect("metaphysics_action", "P4"),
  ...deepInspect("risk_guard", "P5"),
  ...deepInspect("signals_close", "P6"),
  {
    step_key: "book.assemble",
    label: "Assemble · 预览拼书",
    kind: "assemble",
    uses_llm: false,
    accept: "六页能通读。有依据的卡片：折叠里是批断。P2 正文=批断白话；P3+ 正文=可执行内容且被依据支撑（禁止用「正文必须是翻译」卡死合格策略稿）。无批断的卡片没有依据折。",
  },
] as const;

export function labStepDef(step_key: string): LabStepDef | undefined {
  return LAB_STEP_DEFS.find((s) => s.step_key === step_key);
}

export function emptyStepRecord(step_key: string): LabStepRecord {
  return { step_key, status: "idle", attempts: [] };
}

export function initLabSteps(): Record<string, LabStepRecord> {
  const out: Record<string, LabStepRecord> = {};
  for (const d of LAB_STEP_DEFS) out[d.step_key] = emptyStepRecord(d.step_key);
  return out;
}
