/**
 * Face04 legacy adapter — historical bottleneck_name/manifestation/… shape.
 * Display projection only — never persist as new production certification.
 */

import {
  Face04LegacySchema,
  type Face04Legacy,
  type Face04V2,
} from "../schemas";

export function isFace04V2(data: unknown): data is Face04V2 {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.page === "04" &&
    o.face === "04" &&
    (o.schema_version === "face04-v2" ||
      (Array.isArray(o.content_units) && o.content_units.length > 0))
  );
}

export function isFace04ContentUnits(data: unknown): boolean {
  if (!isFace04V2(data)) return false;
  const o = data as Face04V2;
  return Array.isArray(o.content_units) && o.content_units.length > 0;
}

export function isFace04Legacy(data: unknown): data is Face04Legacy {
  if (!data || typeof data !== "object") return false;
  if (isFace04V2(data)) return false;
  const parsed = Face04LegacySchema.safeParse(data);
  return parsed.success;
}

/**
 * Project legacy Face04 into content-unit Face04V2 for display only.
 * Never persist as new production output.
 */
export function projectLegacyFace04ForDisplay(data: unknown): Face04V2 | null {
  if (isFace04ContentUnits(data)) return data as Face04V2;
  const parsed = Face04LegacySchema.safeParse(data);
  if (!parsed.success) return null;
  const leg = parsed.data;
  const force = (leg.if_force_through ?? "").trim();
  return {
    page: "04",
    face: "04",
    schema_version: "face04-v2",
    page_title: leg.page_title,
    page_subtitle: leg.page_subtitle,
    content_units: [
      {
        unit_id: "legacy_name",
        kind: "bottleneck_label",
        text: leg.bottleneck_name.slice(0, 240),
        title: "",
        claim_ids: ["legacy_claim_04"],
        evidence_ids: ["legacy_ev_04"],
        related_reality_fact_ids: [],
      },
      {
        unit_id: "legacy_manifest",
        kind: "manifestation",
        text: leg.manifestation.slice(0, 960),
        claim_ids: ["legacy_claim_04"],
        evidence_ids: ["legacy_ev_04"],
        related_reality_fact_ids: [],
      },
      {
        unit_id: "legacy_force",
        kind: "force_through_cost",
        text: (force || "（历史稿未提供硬顶成本说明）").slice(0, 720),
        claim_ids: ["legacy_claim_04"],
        evidence_ids: [],
        related_reality_fact_ids: [],
      },
      {
        unit_id: "legacy_leverage",
        kind: "leverage_point",
        text: "（历史稿无独立撬动点字段；请结合依据折叠阅读）",
        claim_ids: ["legacy_claim_04"],
        evidence_ids: [],
        related_reality_fact_ids: [],
      },
      {
        unit_id: "legacy_evidence",
        kind: "evidence_note",
        text: leg.evidence_fold.slice(0, 1200),
        claim_ids: ["legacy_claim_04"],
        evidence_ids: ["legacy_ev_04"],
        related_reality_fact_ids: [],
      },
    ],
    bottleneck_naming_unit_ids: ["legacy_name"],
    manifestation_unit_ids: ["legacy_manifest"],
    force_through_cost_unit_ids: ["legacy_force"],
    leverage_point_unit_ids: ["legacy_leverage"],
    page01_judgment_ref: "",
    evidence_boundary: {
      claim_ids: ["legacy_claim_04"],
      evidence_note_unit_ids: ["legacy_evidence"],
      confirmed_fact_ids: [],
      hypothesis_notes: [],
      uncertainty_notes: [
        "此为历史报告兼容投影，非 v2 认证产出",
        force ? "" : "历史稿 if_force_through 为空",
      ]
        .filter(Boolean)
        .slice(0, 8),
    },
    reading_order: [
      "bottleneck_naming",
      "manifestation",
      "force_through_cost",
      "leverage_point",
      "evidence_boundary",
    ],
  };
}
