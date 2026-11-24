/**
 * Page08 UI section SSOT — Risk Monitoring & Decision Review.
 * A 风险 · B 观察信号 · C 触发与决策回应 · D 复盘条件 · E 依据边界
 */

export const PAGE08_SECTION_IDS = [
  "risks",
  "observation_signals",
  "triggers",
  "reassessment_conditions",
  "evidence_boundary",
] as const;

export type Page08SectionId = (typeof PAGE08_SECTION_IDS)[number];

export type Page08SegmentLetter = "A" | "B" | "C" | "D" | "E";

export type Page08SectionDefinition = {
  section_id: Page08SectionId;
  segment_letter: Page08SegmentLetter;
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

export const PAGE08_SECTION_DEFINITIONS: readonly Page08SectionDefinition[] = [
  {
    section_id: "risks",
    segment_letter: "A",
    title_zh: "风险",
    title_en: "Risks",
    purpose_zh: "列出已经能指认的风险，并挂到已有路径、动作与事实，不新造主方案。",
    purpose_en:
      "Name risks that can already be pointed at, tied to existing paths, actions, and facts. Do not invent a new main plan.",
    display_content: "risks",
    reading_rank: 1,
    information_level: "primary",
    required: true,
    empty_display_zh: "（尚无可用的风险）",
    empty_display_en: "(No risks available)",
  },
  {
    section_id: "observation_signals",
    segment_letter: "B",
    title_zh: "观察信号",
    title_en: "Observation signals",
    purpose_zh: "说明要观察什么、从哪里观察、基线与阈值是否已经具备。",
    purpose_en:
      "What to observe, where it comes from, and whether a baseline or threshold already exists.",
    display_content: "observation_signals",
    reading_rank: 2,
    information_level: "primary",
    required: true,
    empty_display_zh: "（尚无可用的观察信号）",
    empty_display_en: "(No observation signals available)",
  },
  {
    section_id: "triggers",
    segment_letter: "C",
    title_zh: "触发与决策回应",
    title_en: "Triggers and decision response",
    purpose_zh: "信号到达条件时，回应只能是继续、调整、暂停、停止或重新评估。",
    purpose_en:
      "When a signal meets its condition, the response is continue, adjust, pause, stop, or reassess.",
    display_content: "triggers",
    reading_rank: 3,
    information_level: "primary",
    required: true,
    empty_display_zh: "（尚无可用的触发条件）",
    empty_display_en: "(No triggers available)",
  },
  {
    section_id: "reassessment_conditions",
    segment_letter: "D",
    title_zh: "复盘条件",
    title_en: "Reassessment conditions",
    purpose_zh: "什么变化会要求重看本题，以及重看的范围。不改写 01/05/06。",
    purpose_en:
      "Which changes require another look at this decision, and the review scope. Do not rewrite pages 01, 05, or 06.",
    display_content: "reassessment_conditions",
    reading_rank: 4,
    information_level: "supporting",
    required: true,
    empty_display_zh: "（当前无额外复盘条件）",
    empty_display_en: "(No extra reassessment condition)",
  },
  {
    section_id: "evidence_boundary",
    segment_letter: "E",
    title_zh: "依据边界",
    title_en: "Evidence boundary",
    purpose_zh: "已确认与未核实事实分开，并写明监测与复盘做不到什么。",
    purpose_en:
      "Keep confirmed facts apart from unverified ones, and state what monitoring and reassessment cannot do.",
    display_content: "evidence_boundary",
    reading_rank: 5,
    information_level: "boundary",
    required: true,
    empty_display_zh: "（尚无可用的依据边界）",
    empty_display_en: "(No evidence boundary available)",
  },
] as const;

export function page08SectionById(
  sectionId: string,
): Page08SectionDefinition | null {
  return (
    PAGE08_SECTION_DEFINITIONS.find((s) => s.section_id === sectionId) ?? null
  );
}

export function page08DefaultReadingOrder(): Page08SectionId[] {
  return [...PAGE08_SECTION_IDS];
}

export function page08RequiredSectionIds(): Page08SectionId[] {
  return PAGE08_SECTION_DEFINITIONS.filter((s) => s.required).map(
    (s) => s.section_id,
  );
}

export function isPage08SectionId(id: string): id is Page08SectionId {
  return PAGE08_SECTION_DEFINITIONS.some((s) => s.section_id === id);
}

export function normalizePage08ReadingOrder(
  order: readonly string[] | null | undefined,
): Page08SectionId[] {
  const seen = new Set<Page08SectionId>();
  const out: Page08SectionId[] = [];
  if (Array.isArray(order)) {
    for (const raw of order) {
      if (!isPage08SectionId(raw)) continue;
      if (seen.has(raw)) continue;
      seen.add(raw);
      out.push(raw);
    }
  }
  for (const id of PAGE08_SECTION_IDS) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
