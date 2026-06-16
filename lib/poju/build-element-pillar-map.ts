import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  getBranchInfo,
  getStemInfo,
  type BranchInfo,
  type StemInfo,
} from "@/lib/poju/bazi-matrix-mappings";

export type ElementKey = "Metal" | "Wood" | "Water" | "Fire" | "Earth";

export type PillarSlotKey =
  | "year_stem"
  | "year_branch"
  | "month_stem"
  | "month_branch"
  | "day_stem"
  | "day_branch"
  | "hour_stem"
  | "hour_branch";

export type ElementPillarAssignment = {
  slot: PillarSlotKey;
  han: string;
  display_glyph: string;
};

export type ElementPillarRow = {
  element: ElementKey;
  assignments: ElementPillarAssignment[];
};

const ELEMENT_DISPLAY_ORDER: ElementKey[] = ["Metal", "Wood", "Water", "Fire", "Earth"];

const SLOT_ORDER: PillarSlotKey[] = [
  "year_stem",
  "year_branch",
  "month_stem",
  "month_branch",
  "day_stem",
  "day_branch",
  "hour_stem",
  "hour_branch",
];

function capitalizePinyin(pinyin: string): string {
  const base = pinyin
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ü/g, "u");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function formatStemBranchGlyph(han: string, locale: string): string {
  if (locale.startsWith("zh")) return han;
  const stem = getStemInfo(han);
  if (stem) return capitalizePinyin(stem.pinyin);
  const branch = getBranchInfo(han);
  if (branch) return capitalizePinyin(branch.pinyin);
  return han;
}

function elementForStem(stem: string): ElementKey | null {
  return (getStemInfo(stem) as StemInfo | null)?.element ?? null;
}

function elementForBranch(branch: string): ElementKey | null {
  return (getBranchInfo(branch) as BranchInfo | null)?.element ?? null;
}

/** Group four-pillar stems/branches by five-element assignment (local chart data). */
export function buildElementPillarMap(
  pillars: ProfileStructured["pillars_detail"],
  locale: string,
): ElementPillarRow[] {
  if (!pillars) return [];

  const entries: Array<{ slot: PillarSlotKey; han: string; element: ElementKey }> = [
    { slot: "year_stem", han: pillars.year.stem, element: elementForStem(pillars.year.stem)! },
    { slot: "year_branch", han: pillars.year.branch, element: elementForBranch(pillars.year.branch)! },
    { slot: "month_stem", han: pillars.month.stem, element: elementForStem(pillars.month.stem)! },
    { slot: "month_branch", han: pillars.month.branch, element: elementForBranch(pillars.month.branch)! },
    { slot: "day_stem", han: pillars.day.stem, element: elementForStem(pillars.day.stem)! },
    { slot: "day_branch", han: pillars.day.branch, element: elementForBranch(pillars.day.branch)! },
    { slot: "hour_stem", han: pillars.hour.stem, element: elementForStem(pillars.hour.stem)! },
    { slot: "hour_branch", han: pillars.hour.branch, element: elementForBranch(pillars.hour.branch)! },
  ].filter(
    (e): e is { slot: PillarSlotKey; han: string; element: ElementKey } =>
      Boolean(e.element && e.han),
  );

  const grouped = new Map<ElementKey, ElementPillarAssignment[]>();

  for (const entry of entries) {
    const list = grouped.get(entry.element) ?? [];
    list.push({
      slot: entry.slot,
      han: entry.han,
      display_glyph: formatStemBranchGlyph(entry.han, locale),
    });
    grouped.set(entry.element, list);
  }

  for (const list of grouped.values()) {
    list.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  }

  return ELEMENT_DISPLAY_ORDER.filter((el) => grouped.has(el)).map((element) => ({
    element,
    assignments: grouped.get(element)!,
  }));
}
