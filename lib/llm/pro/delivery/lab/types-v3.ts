/**
 * Delivery Lab v3 — greenfield step table (three-step pipeline).
 * Do not mix with legacy LAB_STEP_DEFS step keys.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

export type LabV3StepKind =
  | "bootstrap"
  | "thesis"
  | "prealloc"
  | "content_judgment"
  | "content_body"
  | "gate"
  | "body_polish"
  | "evidence_soft"
  | "assemble";

export type LabV3StepDef = {
  step_key: string;
  label: string;
  page?: DeliverySegmentKey;
  kind: LabV3StepKind;
  uses_llm: boolean;
  accept: string;
};

function pageTriad(page: DeliverySegmentKey, short: string): LabV3StepDef[] {
  /** P1 also writes internal judgment (主辅真算根)；UI 仍不挂依据折层 → 无 evidence_soft. */
  const hangEvidenceSoft = page !== "direct_answer";
  const out: LabV3StepDef[] = [
    {
      step_key: `${page}.content.judgment`,
      label:
        page === "direct_answer"
          ? `${short} 内容① · 原始批断（主辅根）`
          : `${short} 内容① · 原始批断`,
      page,
      kind: "content_judgment",
      uses_llm: true,
      accept:
        page === "direct_answer"
          ? "3 条机制批断：core_judgment / primary / backup 真算根（八字用忌/岁运）。可含闭集真词；禁手段处方；禁奇门承重（知局归 P4）。已升闸类别机检；其余人审。UI 不挂依据折层。"
          : page === "foundation"
            ? "恰好 4 轴机制批断（用忌岁运/宫位/财官/食伤印比）。禁奇门轴；禁话语权·股权·兼职回写。已升闸类别机检；其余人审。"
            : "产出本页原始依据批断（可含闭集真词）。已升闸类别机检；其余质量靠提示词与人审。",
    },
    {
      step_key: `${page}.content.body`,
      label:
        page === "foundation"
          ? `${short} 内容① · 正文（译批断）`
          : page === "direct_answer"
            ? `${short} 内容① · 正文（直答·主辅）`
            : `${short} 内容① · 正文（可执行）`,
      page,
      kind: "content_body",
      uses_llm: true,
      accept:
        page === "foundation"
          ? "白话正文=批断翻译；零命理专名。已升闸类别机检（可见专名/essence 怎么办收束）；其余人审。尺：交付v3-分步职责与合格尺-SSOT。"
          : page === "direct_answer"
            ? "须先有批断冻结。core_judgment + primary + backup；零命理专名（含 leverage_chip）。已升闸 `gate_p1_body_visible_jargon`；事实同向等人审。"
            : page === "science_action"
              ? "真·准·可执行·贴收集即可，不加厚。正文步只硬闸事实/门槛；读感加厚+专名/引号/X% 留给润色。人审看真准价值。尺：分步职责 SSOT。"
              : "白话可执行正文；批断只扎根；零命理专名。表面专名硬闸在本步（无 polish）。人审在下一步闸门。",
    },
    {
      step_key: `${page}.gate`,
      label: `${short} 闸门② · 验收（只判不改）`,
      page,
      kind: "gate",
      uses_llm: false,
      accept:
        page === "science_action"
          ? "人审真·准·可执行·定位（不要求读感加厚）。表面专名留给下一步润色清。不过 → 回改正文枪。尺：分步职责 SSOT。"
          : "对冻结稿只量尺、不改稿。Phase A：形状可预览 + 人审（pivot/P1–P6/P4 规格）。不过 → 回改提示词重跑内容步，禁止剥句装合格。",
    },
  ];
  /** 试点：仅 P3 在闸后人审通过后挂可见层润色（加厚读感 + 表面机闸）。 */
  if (page === "science_action") {
    out.push({
      step_key: `${page}.body_polish`,
      label: `${short} 润色 · 可见层读感`,
      page,
      kind: "body_polish",
      uses_llm: true,
      accept:
        "闸门人审通过后。加厚完整可读句 + 清表面类（专名/引号/X%）；禁改事实与门槛；chart_anchors 代码盖回。润色后 full 闸。SSOT：分步职责 · 润色规格。",
    });
  }
  if (hangEvidenceSoft) {
    out.push({
      step_key: `${page}.evidence_soft`,
      label: `${short} 依据③ · 合规软译`,
      page,
      kind: "evidence_soft",
      uses_llm: false,
      accept:
        "仅闸门通过后。依据大白话连接 + 自造术语（当前 Phase A 可先冻结原批断；术语编码后续打开）。不改正文。",
    });
  }
  return out;
}

/** Fixed unlock order for v3 labs. */
export const LAB_STEP_DEFS_V3: readonly LabV3StepDef[] = [
  {
    step_key: "bootstrap",
    label: "Bootstrap · 校验盘/问题",
    kind: "bootstrap",
    uses_llm: false,
    accept: "盘和问题能解析。",
  },
  {
    step_key: "thesis.gen",
    label: "Thesis · 命盘总纲",
    kind: "thesis",
    uses_llm: false,
    accept: "总纲维与 structured 对齐（本地真算）。",
  },
  {
    step_key: "prealloc",
    label: "Prealloc · 本盘可引用词",
    kind: "prealloc",
    uses_llm: false,
    accept: "本盘闭集词可引用。",
  },
  ...pageTriad("foundation", "P2"),
  ...pageTriad("direct_answer", "P1"),
  ...pageTriad("science_action", "P3"),
  ...pageTriad("metaphysics_action", "P4"),
  ...pageTriad("risk_guard", "P5"),
  ...pageTriad("signals_close", "P6"),
  {
    step_key: "book.assemble",
    label: "Assemble · 预览拼书",
    kind: "assemble",
    uses_llm: false,
    accept: "六页通读；依据折叠为批断（或已软译）。",
  },
] as const;

export function labV3StepDef(step_key: string): LabV3StepDef | undefined {
  return LAB_STEP_DEFS_V3.find((s) => s.step_key === step_key);
}

export function initLabStepsV3(): Record<
  string,
  { step_key: string; status: "idle"; attempts: [] }
> {
  const out: Record<string, { step_key: string; status: "idle"; attempts: [] }> = {};
  for (const d of LAB_STEP_DEFS_V3) {
    out[d.step_key] = { step_key: d.step_key, status: "idle", attempts: [] };
  }
  return out;
}
