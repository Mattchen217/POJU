/**
 * Page05 UI section SSOT — Feasible Paths & Strategy Comparison.
 * A 首选 · B 次选 · C 慎选 · D 切轨/停止/退出 · E 路径对照
 */

export const PAGE05_SECTION_IDS = [
  "preferred_path",
  "alternative_path",
  "cautious_path",
  "switching_exit",
  "path_comparison",
] as const;

export type Page05SectionId = (typeof PAGE05_SECTION_IDS)[number];

export type Page05SectionDefinition = {
  section_id: Page05SectionId;
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
};

export const PAGE05_SECTION_DEFINITIONS: readonly Page05SectionDefinition[] = [
  {
    section_id: "preferred_path",
    segment_letter: "A",
    title_zh: "首选路径",
    title_en: "Preferred path",
    purpose_zh:
      "说明首选路径是什么、为何优先、前提/资源/成本风险/可逆性与继续信号。",
    purpose_en:
      "Name the preferred path: why first, prerequisites, resources, costs/risks, reversibility, continue signals.",
    display_content: "path_units with path_role=preferred",
    reading_rank: 1,
    information_level: "primary",
    required: true,
    empty_display_zh: "（尚无可用的首选路径）",
    empty_display_en: "(No preferred path available)",
  },
  {
    section_id: "alternative_path",
    segment_letter: "B",
    title_zh: "次选路径",
    title_en: "Alternative path",
    purpose_zh: "真实可执行替代；适用条件；与首选的实质差别；为何暂非第一。",
    purpose_en:
      "Real alternative(s): when they fit, how they differ, why not first now.",
    display_content: "path_units with path_role=alternative",
    reading_rank: 2,
    information_level: "primary",
    required: true,
    empty_display_zh: "（尚无可用的次选路径）",
    empty_display_en: "(No alternative path available)",
  },
  {
    section_id: "cautious_path",
    segment_letter: "C",
    title_zh: "慎选路径",
    title_en: "Cautious path",
    purpose_zh:
      "当前过高承诺/冲突风险路径；不建议原因；可重新考虑的条件。无则明示，禁虚构凑数。",
    purpose_en:
      "High-commitment or constraint-conflicting paths — or an explicit absent note; never invent.",
    display_content: "path_units with path_role=cautious OR cautious_absent_note",
    reading_rank: 3,
    information_level: "supporting",
    required: true,
    empty_display_zh: "（当前无独立慎选路径；见边界说明）",
    empty_display_en: "(No separate cautious path; see boundary note)",
  },
  {
    section_id: "switching_exit",
    segment_letter: "D",
    title_zh: "切轨、停止与退出",
    title_en: "Switch, stop, and exit",
    purpose_zh:
      "可观察的切换/停止/重定义条件；必须指向具体路径，禁空泛调整口号。",
    purpose_en:
      "Observable switch/stop/redefine rules pointing at concrete path_ids.",
    display_content: "switching_rules",
    reading_rank: 4,
    information_level: "primary",
    required: true,
    empty_display_zh: "（尚无可用的切轨/停止规则）",
    empty_display_en: "(No switching/stop rules available)",
  },
  {
    section_id: "path_comparison",
    segment_letter: "E",
    title_zh: "路径对照",
    title_en: "Path comparison",
    purpose_zh:
      "收益/成本/风险/资源/可逆性/成立条件对照；禁无来源评分与虚构成功概率。",
    purpose_en:
      "Compare benefit/cost/risk/resources/reversibility/prerequisites — no invented scores.",
    display_content: "path_comparison.rows",
    reading_rank: 5,
    information_level: "boundary",
    required: true,
    empty_display_zh: "（尚无可用的路径对照）",
    empty_display_en: "(No path comparison available)",
  },
] as const;

export function page05SectionById(
  sectionId: string,
): Page05SectionDefinition | null {
  return (
    PAGE05_SECTION_DEFINITIONS.find((s) => s.section_id === sectionId) ?? null
  );
}

export function page05DefaultReadingOrder(): Page05SectionId[] {
  return [...PAGE05_SECTION_IDS];
}

export function page05RequiredSectionIds(): Page05SectionId[] {
  return PAGE05_SECTION_DEFINITIONS.filter((s) => s.required).map(
    (s) => s.section_id,
  );
}

export function isPage05SectionId(id: string): id is Page05SectionId {
  return PAGE05_SECTION_DEFINITIONS.some((s) => s.section_id === id);
}

export function normalizePage05ReadingOrder(
  order: readonly string[] | null | undefined,
): Page05SectionId[] {
  const seen = new Set<Page05SectionId>();
  const out: Page05SectionId[] = [];
  if (Array.isArray(order)) {
    for (const raw of order) {
      if (!isPage05SectionId(raw)) continue;
      if (seen.has(raw)) continue;
      seen.add(raw);
      out.push(raw);
    }
  }
  for (const id of PAGE05_SECTION_IDS) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
