/**
 * P4 means gate — classify / strip literal wuxing / enforce rhythm|mindset first.
 * Uses wuxing-semantic-ssot (same table as prompt injection).
 */

import {
  classifyMeansActionType,
  inferWuxingElementsFromText,
  textHitsBlacklist,
  textHitsWhitelist,
  type MeansActionType,
  type WuxingElement,
} from "@/lib/glossary/wuxing-semantic-ssot";

export type RawMeansItem =
  | string
  | {
      text?: unknown;
      type?: unknown;
      body?: unknown;
      action?: unknown;
    };

function asMeansText(raw: RawMeansItem): { text: string; declared: MeansActionType | null } {
  if (typeof raw === "string") {
    return { text: raw.trim(), declared: null };
  }
  if (raw && typeof raw === "object") {
    const text = String(raw.text ?? raw.body ?? raw.action ?? "").trim();
    const ty = String(raw.type ?? "").trim().toLowerCase();
    const declared =
      ty === "rhythm" || ty === "mindset" || ty === "symbol" || ty === "field"
        ? (ty as MeansActionType)
        : null;
    return { text, declared };
  }
  return { text: "", declared: null };
}

export type P4MeansGateResult = {
  means: string[];
  notes: string[];
  /** True when fill should retry (literal primary / no state-layer means). */
  structural: boolean;
  structural_reason?: string;
};

/**
 * Normalize P4 dimension means: drop literal-object lines, reorder,
 * require ≥1 whitelist-backed rhythm|mindset up front.
 */
export function gateP4DimensionMeans(input: {
  meansRaw: unknown;
  chart_anchors: readonly string[];
  strategy: string;
  notes: string[];
}): P4MeansGateResult {
  const notes = [...input.notes];
  const elements: WuxingElement[] = inferWuxingElementsFromText(
    [...input.chart_anchors, input.strategy].join(" "),
  );

  const rawList = Array.isArray(input.meansRaw) ? input.meansRaw : [];
  const classified: Array<{ text: string; type: MeansActionType | "literal_object" }> = [];

  for (const item of rawList.slice(0, 8)) {
    const { text, declared } = asMeansText(item as RawMeansItem);
    if (!text) continue;
    const hit = textHitsBlacklist(text, elements);
    if (hit) {
      notes.push(`p4_literal_wuxing:${hit}`);
      classified.push({ text, type: "literal_object" });
      continue;
    }
    const type = classifyMeansActionType(text, declared, elements);
    if (type === "literal_object") {
      notes.push("p4_literal_wuxing:classified");
      classified.push({ text, type });
      continue;
    }
    // Prefer classifier over model when they disagree on field/symbol primacy
    if (declared && declared !== type && (declared === "field" || declared === "symbol")) {
      notes.push(`p4_means_type_override:${declared}->${type}`);
    }
    classified.push({ text: text.slice(0, 240), type });
  }

  const kept = classified.filter((c) => c.type !== "literal_object");
  const droppedLiteral = classified.length - kept.length;
  if (droppedLiteral > 0) {
    notes.push(`p4_literal_means_dropped:${droppedLiteral}`);
  }

  const primary = kept.filter((c) => c.type === "rhythm" || c.type === "mindset");
  const secondary = kept.filter((c) => c.type === "symbol" || c.type === "field");

  // At most one symbol and one field
  const symbols = secondary.filter((c) => c.type === "symbol").slice(0, 1);
  const fields = secondary.filter((c) => c.type === "field").slice(0, 1);

  // Whitelist: prefer primary lines that hit anchors
  const primaryGood = primary.filter((c) => textHitsWhitelist(c.text, elements));
  const primaryUse = (primaryGood.length > 0 ? primaryGood : primary).slice(0, 4);

  if (primaryUse.length === 0) {
    return {
      means: [],
      notes,
      structural: true,
      structural_reason:
        droppedLiteral > 0 ? "p4_literal_wuxing_means" : "p4_means_missing_rhythm_mindset",
    };
  }

  // If all primary miss whitelist and we have elements, soft note (not always structural)
  if (primaryGood.length === 0 && elements.length > 0) {
    notes.push("p4_means_whitelist_miss");
    // Still structural when only field/symbol survived after drops
    if (primary.length === 0) {
      return {
        means: [],
        notes,
        structural: true,
        structural_reason: "p4_means_missing_rhythm_mindset",
      };
    }
  }

  const ordered = [...primaryUse, ...symbols, ...fields].slice(0, 6);
  // Ensure first is rhythm|mindset
  if (ordered[0] && ordered[0].type !== "rhythm" && ordered[0].type !== "mindset") {
    return {
      means: [],
      notes: [...notes, "p4_means_order_invalid"],
      structural: true,
      structural_reason: "p4_means_order_invalid",
    };
  }

  return {
    means: ordered.map((c) => c.text),
    notes,
    structural: false,
  };
}
