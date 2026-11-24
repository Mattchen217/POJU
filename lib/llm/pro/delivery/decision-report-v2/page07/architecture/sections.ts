/**
 * Page07 UI section SSOT — Field & Relationship (conditionally enabled).
 * A 场域判断 · B 关系与互动 · C 依据与边界 · D 与主决策对齐
 */

export const PAGE07_SECTION_IDS = [
  "field_judgment",
  "relationship_interaction",
  "evidence_boundary",
  "alignment_with_main",
] as const;

export type Page07SectionId = (typeof PAGE07_SECTION_IDS)[number];

export type Page07SegmentLetter = "A" | "B" | "C" | "D";

export type Page07SectionDefinition = {
  section_id: Page07SectionId;
  segment_letter: Page07SegmentLetter;
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

export const PAGE07_SECTION_DEFINITIONS: readonly Page07SectionDefinition[] = [
  {
    section_id: "field_judgment",
    segment_letter: "A",
    title_zh: "场域判断",
    title_en: "Field judgment",
    purpose_zh: "当前或目标环境是否提供资源、有哪些限制、进入或离开的条件。",
    purpose_en:
      "Whether the current or target setting supplies resources, what limits it, and the conditions for entering, staying, or leaving.",
    display_content: "field_units",
    reading_rank: 1,
    information_level: "primary",
    required: true,
    empty_display_zh: "（本题与场域无关，本段省略）",
    empty_display_en: "(This decision is not about a field; section omitted)",
  },
  {
    section_id: "relationship_interaction",
    segment_letter: "B",
    title_zh: "关系与互动",
    title_en: "Relationship and interaction",
    purpose_zh: "只分析用户已经提供的权责、利益、沟通、承诺、冲突与协作事实。",
    purpose_en:
      "Only the power, interest, communication, commitment, conflict, and collaboration facts the user already gave.",
    display_content: "relationship_units",
    reading_rank: 2,
    information_level: "primary",
    required: true,
    empty_display_zh: "（本题没有需要分析的关系互动）",
    empty_display_en: "(No relationship interaction to analyze for this decision)",
  },
  {
    section_id: "evidence_boundary",
    segment_letter: "C",
    title_zh: "依据与边界",
    title_en: "Evidence and boundary",
    purpose_zh: "已确认事实、假设、不确定，以及第三方资料限制。",
    purpose_en:
      "Confirmed facts, hypotheses, uncertainty, and the limits of third-party data.",
    display_content: "evidence_boundary",
    reading_rank: 3,
    information_level: "boundary",
    required: true,
    empty_display_zh: "（尚无可用的依据边界）",
    empty_display_en: "(No evidence boundary available)",
  },
  {
    section_id: "alignment_with_main",
    segment_letter: "D",
    title_zh: "与主决策对齐",
    title_en: "Alignment with the main decision",
    purpose_zh: "说明本页是否改变 01 的推荐或 05 的路径排序，以及对 06 执行的影响。",
    purpose_en:
      "Whether this page changes the Page01 recommendation or Page05 path order, and how it affects Page06 execution.",
    display_content: "alignment_with_main",
    reading_rank: 4,
    information_level: "boundary",
    required: true,
    empty_display_zh: "（本页不另造独立主决策）",
    empty_display_en: "(This page does not create a separate main decision)",
  },
] as const;

export function page07SectionById(
  sectionId: string,
): Page07SectionDefinition | null {
  return (
    PAGE07_SECTION_DEFINITIONS.find((s) => s.section_id === sectionId) ?? null
  );
}

export function page07DefaultReadingOrder(): Page07SectionId[] {
  return [...PAGE07_SECTION_IDS];
}

export function page07RequiredSectionIds(): Page07SectionId[] {
  return PAGE07_SECTION_DEFINITIONS.filter((s) => s.required).map(
    (s) => s.section_id,
  );
}

export function isPage07SectionId(id: string): id is Page07SectionId {
  return PAGE07_SECTION_DEFINITIONS.some((s) => s.section_id === id);
}

export function normalizePage07ReadingOrder(
  order: readonly string[] | null | undefined,
): Page07SectionId[] {
  const seen = new Set<Page07SectionId>();
  const out: Page07SectionId[] = [];
  if (Array.isArray(order)) {
    for (const raw of order) {
      if (!isPage07SectionId(raw)) continue;
      if (seen.has(raw)) continue;
      seen.add(raw);
      out.push(raw);
    }
  }
  for (const id of PAGE07_SECTION_IDS) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
