/**
 * Page06 UI section SSOT — Strategy Execution & Validation.
 * A 第一步 · B 执行动作 · C 验证实验 · D 个人执行调整 · E 阶段节奏 · F 资源边界 · G 依据边界
 */

export const PAGE06_SECTION_IDS = [
  "first_step",
  "execution_actions",
  "validation_experiments",
  "personal_execution_adjustments",
  "phase_rhythm",
  "resource_boundaries",
  "evidence_boundary",
] as const;

export type Page06SectionId = (typeof PAGE06_SECTION_IDS)[number];

export type Page06SegmentLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type Page06SectionDefinition = {
  section_id: Page06SectionId;
  segment_letter: Page06SegmentLetter;
  title_zh: string;
  title_en: string;
  purpose_zh: string;
  purpose_en: string;
  display_content: string;
  reading_rank: number;
  information_level: "primary" | "supporting" | "boundary";
  required: boolean;
  empty_display_zh: string;
  empty_display_en: string;
};

export const PAGE06_SECTION_DEFINITIONS: readonly Page06SectionDefinition[] = [
  {
    section_id: "first_step",
    segment_letter: "A",
    title_zh: "第一步",
    title_en: "First step",
    purpose_zh: "沿首选路径写出此刻可观察的第一步：做什么、为何现在、需要什么、做成什么样。",
    purpose_en:
      "The observable first step on the primary path: what, why now, resources, and the result you can see.",
    display_content: "first_step",
    reading_rank: 1,
    information_level: "primary",
    required: true,
    empty_display_zh: "（尚无可用的第一步）",
    empty_display_en: "(No first step available)",
  },
  {
    section_id: "execution_actions",
    segment_letter: "B",
    title_zh: "执行动作",
    title_en: "Execution actions",
    purpose_zh: "按顺序展开可执行动作、依赖、护栏与可观察结果；必须挂在已有路径上。",
    purpose_en:
      "Ordered executable actions with dependencies, guardrails, and observable results on known paths.",
    display_content: "execution_actions",
    reading_rank: 2,
    information_level: "primary",
    required: true,
    empty_display_zh: "（尚无可用的执行动作）",
    empty_display_en: "(No execution actions available)",
  },
  {
    section_id: "validation_experiments",
    segment_letter: "C",
    title_zh: "验证实验",
    title_en: "Validation experiments",
    purpose_zh: "用有窗口的小实验检验假设；没有实验时必须写明缺席说明，禁止凑数。",
    purpose_en:
      "Bounded experiments that test a hypothesis — or an explicit absent note. Never invent one to fill space.",
    display_content: "validation_experiments OR experiments_absent_note",
    reading_rank: 3,
    information_level: "primary",
    required: true,
    empty_display_zh: "（当前无验证实验；见缺席说明）",
    empty_display_en: "(No validation experiment; see absent note)",
  },
  {
    section_id: "personal_execution_adjustments",
    segment_letter: "D",
    title_zh: "个人执行调整",
    title_en: "Personal execution adjustments",
    purpose_zh: "只根据已有个人单元或现实事实调整执行方式；没有依据就不写。",
    purpose_en:
      "Adjust how this person executes, citing personal units and/or reality facts that already exist.",
    display_content: "personal_execution_adjustments",
    reading_rank: 4,
    information_level: "supporting",
    required: true,
    empty_display_zh: "（当前无额外的个人执行调整）",
    empty_display_en: "(No extra personal execution adjustment)",
  },
  {
    section_id: "phase_rhythm",
    segment_letter: "E",
    title_zh: "阶段节奏",
    title_en: "Phase rhythm",
    purpose_zh: "进入与退出条件划分阶段，不写四周甘特。",
    purpose_en: "Phases with enter/exit triggers. Not a multi-week gantt.",
    display_content: "phase_rhythm",
    reading_rank: 5,
    information_level: "supporting",
    required: true,
    empty_display_zh: "（尚无可用的阶段节奏）",
    empty_display_en: "(No phase rhythm available)",
  },
  {
    section_id: "resource_boundaries",
    segment_letter: "F",
    title_zh: "资源边界",
    title_en: "Resource boundaries",
    purpose_zh: "时间、金钱、人、精力以及未知缺口；未知保持未知。",
    purpose_en:
      "Time, money, people, energy, and what is still unknown. Do not fill unknowns.",
    display_content: "resource_boundaries",
    reading_rank: 6,
    information_level: "boundary",
    required: true,
    empty_display_zh: "（尚无可用的资源边界）",
    empty_display_en: "(No resource boundaries available)",
  },
  {
    section_id: "evidence_boundary",
    segment_letter: "G",
    title_zh: "依据与监测边界",
    title_en: "Evidence and monitoring boundary",
    purpose_zh: "已确认事实、假设、不确定，以及监测契约（继续/调整/停止/重跑）。",
    purpose_en:
      "Confirmed facts, hypotheses, uncertainty, and the monitoring contract (continue/adjust/stop/rerun).",
    display_content: "evidence_boundary + monitoring_contract",
    reading_rank: 7,
    information_level: "boundary",
    required: true,
    empty_display_zh: "（尚无可用的依据边界）",
    empty_display_en: "(No evidence boundary available)",
  },
] as const;

export function page06SectionById(
  sectionId: string,
): Page06SectionDefinition | null {
  return (
    PAGE06_SECTION_DEFINITIONS.find((s) => s.section_id === sectionId) ?? null
  );
}

export function page06DefaultReadingOrder(): Page06SectionId[] {
  return [...PAGE06_SECTION_IDS];
}

export function page06RequiredSectionIds(): Page06SectionId[] {
  return PAGE06_SECTION_DEFINITIONS.filter((s) => s.required).map(
    (s) => s.section_id,
  );
}

export function isPage06SectionId(id: string): id is Page06SectionId {
  return PAGE06_SECTION_DEFINITIONS.some((s) => s.section_id === id);
}

export function normalizePage06ReadingOrder(
  order: readonly string[] | null | undefined,
): Page06SectionId[] {
  const seen = new Set<Page06SectionId>();
  const out: Page06SectionId[] = [];
  if (Array.isArray(order)) {
    for (const raw of order) {
      if (!isPage06SectionId(raw)) continue;
      if (seen.has(raw)) continue;
      seen.add(raw);
      out.push(raw);
    }
  }
  for (const id of PAGE06_SECTION_IDS) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
