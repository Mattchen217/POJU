/**
 * Page04 UI section SSOT — Core Bottleneck (正式规格 SoT「真正卡住你的是什么」).
 * A 卡点命名 · B 现实表现 · C 若硬顶 · D 撬动点 · E 依据边界
 */

export const PAGE04_SECTION_IDS = [
  "bottleneck_naming",
  "manifestation",
  "force_through_cost",
  "leverage_point",
  "evidence_boundary",
] as const;

export type Page04SectionId = (typeof PAGE04_SECTION_IDS)[number];

export type Page04SectionDefinition = {
  section_id: Page04SectionId;
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
  unit_ids_field:
    | "bottleneck_naming_unit_ids"
    | "manifestation_unit_ids"
    | "force_through_cost_unit_ids"
    | "leverage_point_unit_ids"
    | "evidence_boundary";
};

export const PAGE04_SECTION_DEFINITIONS: readonly Page04SectionDefinition[] = [
  {
    section_id: "bottleneck_naming",
    segment_letter: "A",
    title_zh: "卡点是什么",
    title_en: "What the bottleneck is",
    purpose_zh: "用一句通俗具体的话命名本题核心障碍；1–3 个有证据卡点，不为凑数。",
    purpose_en:
      "Name 1–3 evidenced core bottlenecks in plain language — never pad for count.",
    display_content: "bottleneck_label units (short vernacular names).",
    reading_rank: 1,
    information_level: "primary",
    required: true,
    empty_display_zh: "（尚无可用的卡点命名）",
    empty_display_en: "(No bottleneck name available)",
    unit_ids_field: "bottleneck_naming_unit_ids",
  },
  {
    section_id: "manifestation",
    segment_letter: "B",
    title_zh: "它在现实中怎样表现",
    title_en: "How it shows up in reality",
    purpose_zh: "引用真实经历与场景，说明卡点如何影响本题决策；区分已确认与推断。",
    purpose_en:
      "Ground the bottleneck in real scenes/results; separate confirmed vs inferred.",
    display_content: "manifestation units linked to DC facts when present.",
    reading_rank: 2,
    information_level: "primary",
    required: true,
    empty_display_zh: "（尚无可用的现实表现说明）",
    empty_display_en: "(No manifestation available)",
    unit_ids_field: "manifestation_unit_ids",
  },
  {
    section_id: "force_through_cost",
    segment_letter: "C",
    title_zh: "如果继续按原方式推进",
    title_en: "If you keep forcing through",
    purpose_zh: "以条件性风险说明时间/资金/机会/关系/精力成本；禁恐吓与必然灾祸。",
    purpose_en:
      "Conditional cost/risk if the old pattern continues — never scare-fate claims.",
    display_content: "force_through_cost units (conditional risk language).",
    reading_rank: 3,
    information_level: "supporting",
    required: true,
    empty_display_zh: "（尚无可用的硬顶成本说明）",
    empty_display_en: "(No force-through cost note available)",
    unit_ids_field: "force_through_cost_unit_ids",
  },
  {
    section_id: "leverage_point",
    segment_letter: "D",
    title_zh: "最值得撬动的地方",
    title_en: "Highest-leverage place to pry",
    purpose_zh: "指出优先改变的一个条件或机制；区分可控与暂不可控；非路径排序非行动表。",
    purpose_en:
      "One priority lever (controllable vs not) — not path ranking or action plans.",
    display_content: "leverage_point units.",
    reading_rank: 4,
    information_level: "primary",
    required: true,
    empty_display_zh: "（尚无可用的撬动点说明）",
    empty_display_en: "(No leverage point available)",
    unit_ids_field: "leverage_point_unit_ids",
  },
  {
    section_id: "evidence_boundary",
    segment_letter: "E",
    title_zh: "依据与边界",
    title_en: "Evidence and boundary",
    purpose_zh: "折叠展示个人结构依据与现实关联；标明缺口与不确定性；非正文专名报幕。",
    purpose_en:
      "Folded evidence / gap boundary — not a second body dump of jargon.",
    display_content: "evidence_note units + missing_inputs summaries.",
    reading_rank: 5,
    information_level: "boundary",
    required: true,
    empty_display_zh: "（依据边界未就绪）",
    empty_display_en: "(Evidence boundary not ready)",
    unit_ids_field: "evidence_boundary",
  },
] as const;

export function page04SectionById(
  sectionId: string,
): Page04SectionDefinition | null {
  return (
    PAGE04_SECTION_DEFINITIONS.find((s) => s.section_id === sectionId) ?? null
  );
}

export function page04DefaultReadingOrder(): Page04SectionId[] {
  return [...PAGE04_SECTION_IDS];
}

export function page04RequiredSectionIds(): Page04SectionId[] {
  return PAGE04_SECTION_DEFINITIONS.filter((s) => s.required).map(
    (s) => s.section_id,
  );
}

export function isPage04SectionId(id: string): id is Page04SectionId {
  return PAGE04_SECTION_DEFINITIONS.some((s) => s.section_id === id);
}

/**
 * Canonical reading-order normalize (Reader + PDF + persist stamp).
 * Drops unknown, dedupes, never omits a defined section.
 */
export function normalizePage04ReadingOrder(
  order: readonly string[] | null | undefined,
): Page04SectionId[] {
  const seen = new Set<Page04SectionId>();
  const out: Page04SectionId[] = [];
  if (Array.isArray(order)) {
    for (const raw of order) {
      if (!isPage04SectionId(raw)) continue;
      if (seen.has(raw)) continue;
      seen.add(raw);
      out.push(raw);
    }
  }
  for (const id of PAGE04_SECTION_IDS) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
