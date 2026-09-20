/**
 * Foundation assign: remap path prefer_primary from calc_cite keywords
 * when thesis menu has a better-fitting slug (agenda-aware, chart-agnostic).
 *
 * Does not invent slugs — only picks from closed thesis menu.
 */

import {
  isLegalAdvisorSurface,
  isPartnershipRejectionSurface,
  isTechOutputSurface,
} from "@/lib/llm/pro/delivery/thesis/third-party-agency";
import type { ThesisAssignMenuItem } from "@/lib/llm/pro/delivery/thesis/build-assign-menu";
import { normalizePrimaryReuseKey } from "./preallocate-chart-primaries";

function pickFromMenu(
  menu: readonly ThesisAssignMenuItem[],
  usedKeys: ReadonlySet<string>,
  pred: (m: ThesisAssignMenuItem) => boolean,
  preferSlugs: readonly string[] = [],
): string | undefined {
  const pool = menu.filter((m) => {
    const k = normalizePrimaryReuseKey(m.slug);
    return k && !usedKeys.has(k) && pred(m);
  });
  if (pool.length === 0) return undefined;
  for (const want of preferSlugs) {
    const hit = pool.find(
      (m) => m.slug === want || m.slug.includes(want),
    );
    if (hit) return hit.slug;
  }
  return pool[0]?.slug;
}

/**
 * Suggest a menu slug for a foundation why_card cite/claim surface.
 * Returns undefined when no strong keyword rematch — keep prealloc.
 */
export function suggestFoundationPrimaryForSurface(
  surfaceText: string,
  menu: readonly ThesisAssignMenuItem[],
  usedKeys: ReadonlySet<string> = new Set(),
): string | undefined {
  const t = surfaceText.trim();
  if (!t || menu.length === 0) return undefined;

  // Tech replaceability → 食神 before 伤官 (expression_creativity).
  if (isTechOutputSurface(t)) {
    return pickFromMenu(
      menu,
      usedKeys,
      (m) =>
        m.dimension_id === "expression_creativity" ||
        /食神|伤官/.test(m.slug),
      ["食神", "伤官"],
    );
  }

  // Legal/advisor → 印星 (support/plan), never force 比肩.
  if (isLegalAdvisorSurface(t)) {
    return (
      pickFromMenu(
        menu,
        usedKeys,
        (m) => /正印|偏印/.test(m.slug),
        ["正印", "偏印"],
      ) ??
      pickFromMenu(
        menu,
        usedKeys,
        (m) =>
          m.dimension_id === "interpersonal_pattern" &&
          !/比肩|劫财/.test(m.slug),
      )
    );
  }

  // Partner already rejected part-time → cycle friction (害/冲/刑).
  if (isPartnershipRejectionSurface(t)) {
    return pickFromMenu(
      menu,
      usedKeys,
      (m) =>
        m.dimension_id === "cycle_rhythm" ||
        /相害|相冲|相刑/.test(m.slug),
      ["午丑相害", "丑未相冲", "午午相刑"],
    );
  }

  return undefined;
}
