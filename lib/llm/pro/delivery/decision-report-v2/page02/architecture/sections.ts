/**
 * Page02 UI section SSOT — stable section_id for Reader / PDF / persistence.
 * Reading order keys are the section_ids (already used by Face02V2.reading_order).
 */

export const PAGE02_SECTION_IDS = [
  "page_summary",
  "relevant_personal_factors",
  "personal_reality_interplay",
  "why_judgment_fits",
  "explanation_boundary",
] as const;

export type Page02SectionId = (typeof PAGE02_SECTION_IDS)[number];

export type Page02SectionDefinition = {
  section_id: Page02SectionId;
  /** Letter used by faceSegmentLabel / DECISION_PAGE_SCHEMAS. */
  segment_letter: "A" | "B" | "C" | "D" | "E";
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
  /** Face02V2 field that holds unit_id assembly for this section. */
  unit_ids_field:
    | "page_summary_unit_ids"
    | "relevant_personal_factor_unit_ids"
    | "personal_reality_interplay_unit_ids"
    | "why_judgment_fits_unit_ids"
    | "explanation_boundary";
};

export const PAGE02_SECTION_DEFINITIONS: readonly Page02SectionDefinition[] = [
  {
    section_id: "page_summary",
    segment_letter: "A",
    title_zh: "本页摘要",
    title_en: "Page summary",
    purpose_zh: "用短白话说明本题判断为何与此人有关，不复读 Page01 完整结论。",
    purpose_en:
      "Brief vernacular why this judgment relates to this person — not a Page01 restatement.",
    display_content: "1–3 short content units summarizing fit without re-issuing the decision.",
    reading_rank: 1,
    information_level: "primary",
    required: true,
    empty_display_zh: "（无摘要）",
    empty_display_en: "(No summary)",
    unit_ids_field: "page_summary_unit_ids",
  },
  {
    section_id: "relevant_personal_factors",
    segment_letter: "B",
    title_zh: "与本题相关的个人结构",
    title_en: "Relevant personal factors",
    purpose_zh: "仅展示与本题实质相关的已认证个人分析依据；无则明示空，禁伪造。",
    purpose_en:
      "Only certified personal-structure evidence relevant to this decision; empty if none.",
    display_content: "personal_interpretation units with certified evidence.",
    reading_rank: 2,
    information_level: "supporting",
    required: false,
    empty_display_zh: "本题暂无可用的个人结构依据。",
    empty_display_en: "No personal-structure evidence is available for this decision.",
    unit_ids_field: "relevant_personal_factor_unit_ids",
  },
  {
    section_id: "personal_reality_interplay",
    segment_letter: "C",
    title_zh: "个人与现实的交汇",
    title_en: "Personal–reality interplay",
    purpose_zh: "说明个人结构如何与已采集现实条件相互作用；标明条件与边界。",
    purpose_en:
      "How personal structure interacts with collected reality conditions; mark conditions.",
    display_content:
      "conditional_explanation / reality_mechanism / certified reality_fact units.",
    reading_rank: 3,
    information_level: "supporting",
    required: false,
    empty_display_zh: "本题暂无个人与现实交汇的可认证说明。",
    empty_display_en: "No certified personal–reality interplay is available.",
    unit_ids_field: "personal_reality_interplay_unit_ids",
  },
  {
    section_id: "why_judgment_fits",
    segment_letter: "D",
    title_zh: "为何适合本题判断",
    title_en: "Why the judgment fits",
    purpose_zh: "解释 Page01 判断为何匹配当前处境；非再发结论、非路径、非行动方案。",
    purpose_en:
      "Explain why Page01 judgment matches this situation — not a new verdict or plan.",
    display_content: "conditional_explanation and/or mechanism units tied to page01 ref.",
    reading_rank: 4,
    information_level: "primary",
    required: true,
    empty_display_zh: "（无解释）",
    empty_display_en: "(No explanation)",
    unit_ids_field: "why_judgment_fits_unit_ids",
  },
  {
    section_id: "explanation_boundary",
    segment_letter: "E",
    title_zh: "解释边界",
    title_en: "Explanation boundary",
    purpose_zh: "区分个人分析 / 已确认事实 / 假设 / 不确定性；禁恐吓与定命预测。",
    purpose_en:
      "Separate personal analysis, confirmed facts, hypotheses, and uncertainty.",
    display_content:
      "Boundary lists + uncertainty_notes; may surface missing_inputs summaries.",
    reading_rank: 5,
    information_level: "boundary",
    required: true,
    empty_display_zh: "（边界信息未就绪）",
    empty_display_en: "(Boundary not ready)",
    unit_ids_field: "explanation_boundary",
  },
] as const;

export function page02SectionById(
  sectionId: string,
): Page02SectionDefinition | null {
  return (
    PAGE02_SECTION_DEFINITIONS.find((s) => s.section_id === sectionId) ?? null
  );
}

export function page02DefaultReadingOrder(): Page02SectionId[] {
  return [...PAGE02_SECTION_IDS];
}
