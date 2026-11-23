/**
 * Face02 legacy adapter — historical destiny_reason/science_mechanism shape.
 * New generation must use Face02V2Schema; never write legacy back.
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
      Array.isArray(o.relevant_personal_factors) ||
      (typeof o.why_judgment_fits === "object" && o.why_judgment_fits != null))
  );
}

export function isFace02Legacy(data: unknown): data is Face02Legacy {
  if (!data || typeof data !== "object") return false;
  if (isFace02V2(data)) return false;
  const parsed = Face02LegacySchema.safeParse(data);
  return parsed.success;
}

/**
 * Project legacy Face02 into a displayable Face02V2-shaped object.
 * Historical open only — never persist as new production output.
 */
export function projectLegacyFace02ForDisplay(data: unknown): Face02V2 | null {
  if (isFace02V2(data)) return data as Face02V2;
  const parsed = Face02LegacySchema.safeParse(data);
  if (!parsed.success) return null;
  const leg = parsed.data;
  return {
    page: "02",
    face: "02",
    schema_version: "face02-v2",
    page_title: leg.page_title,
    page_subtitle: leg.page_subtitle,
    page_summary: leg.convergence.slice(0, 360),
    relevant_personal_factors: [
      {
        factor_id: "legacy_destiny",
        title: "个人结构（历史稿）",
        text: leg.destiny_reason.slice(0, 720),
        claim_ids: ["legacy_claim"],
        evidence_ids: ["legacy_ev"],
        source_domain: "convergence",
      },
    ],
    personal_reality_interplay: [
      {
        text: leg.science_mechanism.slice(0, 720),
        personal_evidence_ids: ["legacy_ev"],
        reality_fact_ids: ["legacy_fact"],
        mechanism_evidence_ids: [],
        claim_ids: ["legacy_claim"],
        conditionality: "历史报告投影；非新生产认证依据。",
      },
    ],
    why_judgment_fits: {
      text: leg.convergence.slice(0, 960),
      claim_ids: ["legacy_claim"],
      evidence_ids: ["legacy_ev"],
      page01_judgment_ref: "",
    },
    explanation_boundary: {
      personal_analysis_basis: ["历史稿个人层投影"],
      confirmed_fact_basis: ["历史稿未拆分事实状态"],
      hypothesis_notes: ["历史稿未区分假设与事实"],
      uncertainty_notes: ["此为历史报告兼容投影，非 v2 认证产出"],
      personal_analysis_evidence_ids: [],
      confirmed_fact_ids: [],
      hypothesis_fact_ids: [],
    },
    reading_order: [
      "page_summary",
      "relevant_personal_factors",
      "personal_reality_interplay",
      "why_judgment_fits",
      "explanation_boundary",
    ],
    // Preserve anchors as boundary notes for display if needed via subtitle.
  };
}
