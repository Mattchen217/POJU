/**
 * P0-4 · 单元 chart_anchors 质量闸（Fill sanitize 侧）
 *
 * - 关键单元非空：P2–P5 内容单元缺锚 → note；若该页全部单元皆空 → structural fail
 * - 跨页万金油复读：同会话传入 priorAnchors 时先日志 note（硬闸后续波次）
 * - inventory 交集：可选 inventoryTokens；无交集只 note，不硬闸（宽入）
 */

export type AnchorUnitSample = {
  path: string;
  anchors: readonly string[];
};

export type AnchorQualityResult = {
  notes: string[];
  /** true → sanitize 应 structural fail */
  structuralFail: boolean;
  reason?: string;
};

function normalizeToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/** 从已 sanitize 的 page 对象抽取内容单元锚。 */
export function collectPageAnchorUnits(
  pageKey: string,
  page: Record<string, unknown>,
): AnchorUnitSample[] {
  const out: AnchorUnitSample[] = [];
  const push = (path: string, raw: unknown) => {
    const anchors = Array.isArray(raw)
      ? raw.map((x) => String(x).trim()).filter(Boolean)
      : [];
    out.push({ path, anchors });
  };

  switch (pageKey) {
    case "foundation": {
      const cards = Array.isArray(page.why_cards) ? page.why_cards : [];
      cards.forEach((c, i) => {
        const o = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
        push(`why_cards[${i}]`, o.chart_anchors);
      });
      break;
    }
    case "science_action": {
      for (const role of ["primary_toolkit", "backup_toolkit"] as const) {
        const tk = page[role];
        const o = tk && typeof tk === "object" ? (tk as Record<string, unknown>) : {};
        const angles = Array.isArray(o.angles) ? o.angles : [];
        angles.forEach((a, i) => {
          const ao = a && typeof a === "object" ? (a as Record<string, unknown>) : {};
          push(`${role}.angles[${i}]`, ao.chart_anchors);
        });
      }
      break;
    }
    case "metaphysics_action": {
      const dims = Array.isArray(page.dimensions) ? page.dimensions : [];
      dims.forEach((d, i) => {
        const o = d && typeof d === "object" ? (d as Record<string, unknown>) : {};
        push(`dimensions[${i}]`, o.chart_anchors);
      });
      break;
    }
    case "risk_guard": {
      const bags: Array<[string, unknown]> = [
        ["red_lights", page.red_lights],
        ["traps", page.traps],
        ["protection_rules", page.protection_rules],
      ];
      for (const [name, list] of bags) {
        if (!Array.isArray(list)) continue;
        list.forEach((item, i) => {
          const o =
            item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          push(`${name}[${i}]`, o.chart_anchors);
        });
      }
      if (page.switch_to_backup && typeof page.switch_to_backup === "object") {
        push(
          "switch_to_backup",
          (page.switch_to_backup as Record<string, unknown>).chart_anchors,
        );
      }
      break;
    }
    default:
      break;
  }
  return out;
}

export function assessUnitAnchorQuality(input: {
  pageKey: string;
  units: readonly AnchorUnitSample[];
  /** 可选：inventory / 题型锚 token 池 */
  inventoryTokens?: readonly string[];
  /** 可选：本报告已出现过的锚（跨页复读检测） */
  priorAnchors?: readonly string[];
}): AnchorQualityResult {
  const notes: string[] = [];
  const { pageKey, units } = input;

  if (
    pageKey !== "foundation" &&
    pageKey !== "science_action" &&
    pageKey !== "metaphysics_action" &&
    pageKey !== "risk_guard"
  ) {
    return { notes, structuralFail: false };
  }

  if (units.length === 0) {
    return { notes, structuralFail: false };
  }

  const empty = units.filter((u) => u.anchors.length < 1);
  for (const u of empty) {
    notes.push(`unit_missing_chart_anchors:${u.path}`);
  }

  if (empty.length === units.length) {
    return {
      notes,
      structuralFail: true,
      reason: "all_content_units_missing_chart_anchors",
    };
  }

  // inventory 交集（软）
  const inv = (input.inventoryTokens ?? [])
    .map(normalizeToken)
    .filter(Boolean);
  if (inv.length > 0) {
    for (const u of units) {
      if (u.anchors.length < 1) continue;
      const hit = u.anchors.some((a) => {
        const n = normalizeToken(a);
        return inv.some((t) => n.includes(t) || t.includes(n));
      });
      if (!hit) {
        notes.push(`unit_anchors_outside_inventory:${u.path}`);
      }
    }
  }

  // 跨页万金油复读（先日志）
  const prior = new Set(
    (input.priorAnchors ?? []).map(normalizeToken).filter(Boolean),
  );
  if (prior.size > 0) {
    for (const u of units) {
      if (u.anchors.length < 1) continue;
      const allPrior = u.anchors.every((a) => prior.has(normalizeToken(a)));
      if (allPrior) {
        notes.push(`unit_anchors_cross_page_echo:${u.path}`);
        console.warn(
          `[anchor-quality] cross-page echo on ${pageKey}/${u.path}: ${u.anchors.join("、")}`,
        );
      }
    }
  }

  return { notes, structuralFail: false };
}
