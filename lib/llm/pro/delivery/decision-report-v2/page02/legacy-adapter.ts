/**
 * Face02 legacy adapter — historical destiny_reason/science_mechanism shape
 * and pre-unit Face02V2 free-text shape. New generation uses content_units.
 */

import {
  Face02LegacySchema,
  type Face02Legacy,
  type Face02V2,
} from "../schemas";

export function isFace02V2(data: unknown): data is Face02V2 {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.page === "02" &&
    o.face === "02" &&
    (o.schema_version === "face02-v2" ||
      Array.isArray(o.content_units) ||
      Array.isArray(o.relevant_personal_factors) ||
      (typeof o.why_judgment_fits === "object" && o.why_judgment_fits != null))
  );
}

/** True when Face02V2 uses content_units as body authority. */
export function isFace02ContentUnits(data: unknown): boolean {
  if (!isFace02V2(data)) return false;
  const o = data as Face02V2;
  return Array.isArray(o.content_units) && o.content_units.length > 0;
}

export function isFace02Legacy(data: unknown): data is Face02Legacy {
  if (!data || typeof data !== "object") return false;
  if (isFace02V2(data)) return false;
  const parsed = Face02LegacySchema.safeParse(data);
  return parsed.success;
}

/**
 * Project legacy Face02 into content-unit Face02V2 for display only.
 * Never persist as new production output.
 */
export function projectLegacyFace02ForDisplay(data: unknown): Face02V2 | null {
  if (isFace02ContentUnits(data)) return data as Face02V2;
  if (isFace02V2(data)) {
    // Pre-unit free-text Face02V2 → synthetic units for reader only.
    return projectFreeTextFace02ToUnits(data as Record<string, unknown>);
  }
  const parsed = Face02LegacySchema.safeParse(data);
  if (!parsed.success) return null;
  const leg = parsed.data;
  return {
    page: "02",
    face: "02",
    schema_version: "face02-v2",
    page_title: leg.page_title,
    page_subtitle: leg.page_subtitle,
    content_units: [
      {
        unit_id: "legacy_summary",
        kind: "conditional_explanation",
        text: leg.convergence.slice(0, 720),
        claim_ids: ["legacy_claim"],
        evidence_ids: ["legacy_ev"],
        related_reality_fact_unit_ids: [],
      },
      {
        unit_id: "legacy_personal",
        kind: "personal_interpretation",
        title: "个人结构（历史稿）",
        text: leg.destiny_reason.slice(0, 720),
        claim_ids: ["legacy_claim"],
        evidence_ids: ["legacy_ev"],
        source_domain: "convergence",
      },
      {
        unit_id: "legacy_mech",
        kind: "reality_mechanism",
        text: leg.science_mechanism.slice(0, 720),
        claim_ids: ["legacy_claim"],
        evidence_ids: ["legacy_ev"],
      },
    ],
    page_summary_unit_ids: ["legacy_summary"],
    relevant_personal_factor_unit_ids: ["legacy_personal"],
    personal_reality_interplay_unit_ids: ["legacy_mech"],
    why_judgment_fits_unit_ids: ["legacy_summary"],
    page01_judgment_ref: "",
    explanation_boundary: {
      claim_ids: ["legacy_claim"],
      personal_unit_ids: ["legacy_personal"],
      confirmed_fact_unit_ids: [],
      hypothesis_unit_ids: [],
      uncertainty_notes: ["此为历史报告兼容投影，非 v2 认证产出"],
    },
    reading_order: [
      "page_summary",
      "relevant_personal_factors",
      "personal_reality_interplay",
      "why_judgment_fits",
      "explanation_boundary",
    ],
  };
}

function projectFreeTextFace02ToUnits(
  o: Record<string, unknown>,
): Face02V2 | null {
  const summary = String(o.page_summary ?? "").trim();
  if (!summary) return null;
  const units: Face02V2["content_units"] = [
    {
      unit_id: "compat_summary",
      kind: "conditional_explanation",
      text: summary.slice(0, 720),
      claim_ids: ["compat_claim"],
      evidence_ids: [],
      related_reality_fact_unit_ids: [],
    },
  ];
  return {
    page: "02",
    face: "02",
    schema_version: "face02-v2",
    page_title: String(o.page_title ?? ""),
    page_subtitle: String(o.page_subtitle ?? ""),
    content_units: units,
    page_summary_unit_ids: ["compat_summary"],
    relevant_personal_factor_unit_ids: [],
    personal_reality_interplay_unit_ids: [],
    why_judgment_fits_unit_ids: ["compat_summary"],
    page01_judgment_ref: "",
    explanation_boundary: {
      claim_ids: ["compat_claim"],
      personal_unit_ids: [],
      confirmed_fact_unit_ids: [],
      hypothesis_unit_ids: [],
      uncertainty_notes: ["兼容投影：旧自由文本 Face02，非 content_units 认证稿"],
    },
    reading_order: [
      "page_summary",
      "relevant_personal_factors",
      "personal_reality_interplay",
      "why_judgment_fits",
      "explanation_boundary",
    ],
  };
}
