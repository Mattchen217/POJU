/**
 * 喜用神 × 流日干支对照（读 profile 启发式用神，不改内核）。
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { LiuRiGanzhi } from "@/lib/calculations/liuri";
import {
  BRANCHES,
  STEMS,
  calculateTenGod,
  type HeavenlyStem,
  type TenGod,
  type WuXing,
} from "@/lib/match/data/stems-branches";

export type DayElementHelp = "helps" | "drains" | "mixed" | "neutral";

export type AtmosDayMasterRelation = {
  tenGod: TenGod;
  dayStemElement: WuXing;
  dayBranchElement: WuXing;
  dayElementHelp: DayElementHelp;
  matchedXi: WuXing[];
  matchedJi: WuXing[];
};

const WUXING_SET = new Set<string>(["木", "火", "土", "金", "水"]);

function asWuXing(raw: string): WuXing | null {
  const t = raw.trim();
  if (WUXING_SET.has(t)) return t as WuXing;
  // i18n keys like bazi.element.wood — map common suffixes
  const lower = t.toLowerCase();
  if (lower.includes("wood") || t.includes("木")) return "木";
  if (lower.includes("fire") || t.includes("火")) return "火";
  if (lower.includes("earth") || t.includes("土")) return "土";
  if (lower.includes("metal") || t.includes("金")) return "金";
  if (lower.includes("water") || t.includes("水")) return "水";
  return null;
}

function collectElements(values: string[]): WuXing[] {
  const out: WuXing[] = [];
  for (const v of values) {
    const wx = asWuXing(v);
    if (wx && !out.includes(wx)) out.push(wx);
  }
  return out;
}

/**
 * Compare 流日 stem/branch elements against xi/ji lists on the profile.
 */
export function relateLiuriToYongShen(
  structured: ProfileStructured,
  liuri: LiuRiGanzhi,
): AtmosDayMasterRelation {
  const dayMaster = (structured.day_master ||
    structured.pillars_detail?.day?.stem ||
    structured.four_pillars.day.charAt(0)) as HeavenlyStem;

  const tenGod = calculateTenGod(dayMaster, liuri.stem as HeavenlyStem);
  const dayStemElement = STEMS[liuri.stem as HeavenlyStem]?.wuxing ?? "土";
  const dayBranchElement = BRANCHES[liuri.branch]?.wuxing ?? "土";

  const xi = collectElements([
    structured.yong_shen,
    ...(structured.xi_shen ?? []),
  ]);
  const ji = collectElements(structured.ji_shen ?? []);

  const dayElements = [dayStemElement, dayBranchElement];
  const matchedXi = dayElements.filter((e) => xi.includes(e));
  const matchedJi = dayElements.filter((e) => ji.includes(e));

  let dayElementHelp: DayElementHelp = "neutral";
  const helps = matchedXi.length > 0;
  const drains = matchedJi.length > 0;
  if (helps && drains) dayElementHelp = "mixed";
  else if (helps) dayElementHelp = "helps";
  else if (drains) dayElementHelp = "drains";

  return {
    tenGod,
    dayStemElement,
    dayBranchElement,
    dayElementHelp,
    matchedXi: [...new Set(matchedXi)],
    matchedJi: [...new Set(matchedJi)],
  };
}
