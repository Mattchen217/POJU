/**
 * Layer B — present closed-set inventory as a categorized menu for deep-evidence.
 * User-side only (never static system). Model scans category-by-category.
 */

import {
  ANCHOR_CATEGORY_LABEL_ZH,
  ANCHOR_DIVERSITY_CATEGORIES,
  type AnchorCategoryId,
  type CategoryTokenSets,
} from "./anchor-category-tally";

const LAYER_B_ORDER: readonly AnchorCategoryId[] = [
  ...ANCHOR_DIVERSITY_CATEGORIES,
  "core_structure",
];

/** Category menu for deep-evidence user message. */
export function formatLayerBInventoryMenu(sets: CategoryTokenSets | null | undefined): string {
  const lines: string[] = [
    "【闭集分类菜单 · Layer B · 选锚时逐类扫描,禁止编造清单外词】",
  ];
  if (!sets) {
    lines.push("（无 structured 类目集 — 回退上方完整闭集文本）");
    return lines.join("\n");
  }
  for (const cat of LAYER_B_ORDER) {
    const items = [...sets[cat]].filter(Boolean);
    const label = ANCHOR_CATEGORY_LABEL_ZH[cat];
    lines.push(
      `## ${label}\n${items.length ? items.join("、") : "（本盘此类无实例 — 勿编造）"}`,
    );
  }
  lines.push(
    "逐类扫完再锁 chart_anchors；宁缺毋滥，不凑数，不砍必要承重锚。",
  );
  return lines.join("\n");
}

/** Flatten category sets → inventory token list (Batch 4 soft gate). */
export function inventoryTokensFromCategorySets(
  sets: CategoryTokenSets | null | undefined,
): string[] {
  if (!sets) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const cat of LAYER_B_ORDER) {
    for (const t of sets[cat]) {
      const v = t.trim();
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * Pull additional traditional tokens from inventory prose (神煞/十神 lines).
 * Complements CategoryTokenSets when structured text has more surface forms.
 */
export function inventoryTokensFromInventoryText(text: string | null | undefined): string[] {
  const raw = text?.trim() ?? "";
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = s.trim();
    if (t.length < 2 || t.length > 24 || seen.has(t)) return;
    if (/^（|^\(|missing|无|禁止|仅可|data_availability/i.test(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const line of raw.split(/\n+/)) {
    const m = line.match(/:\s*(.+)$/);
    const payload = (m?.[1] ?? line).replace(/（[^）]*）/g, " ");
    for (const part of payload.split(/[、；;，,\s|/]+/)) {
      push(part);
    }
  }
  return out;
}

export function mergeInventoryTokens(
  sets: CategoryTokenSets | null | undefined,
  inventoryText?: string | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [
    ...inventoryTokensFromCategorySets(sets),
    ...inventoryTokensFromInventoryText(inventoryText),
  ]) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
