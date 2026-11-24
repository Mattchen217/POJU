/**
 * Face07 legacy flat ↔ V2 display projection.
 * Historical open only — never used for new production certification.
 */

import {
  Face07LegacySchema,
  type Face07Legacy,
  type Face07V2,
} from "../schemas";
import { PAGE07_SECTION_IDS } from "./architecture/sections";

export function isFace07V2(data: unknown): data is Face07V2 {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.page === "07" &&
    o.face === "07" &&
    (o.schema_version === "face07-v2" ||
      (typeof o.applicability_status === "string" &&
        Array.isArray(o.field_units)))
  );
}

export function isFace07Legacy(data: unknown): data is Face07Legacy {
  if (!data || typeof data !== "object") return false;
  if (isFace07V2(data)) return false;
  return Face07LegacySchema.safeParse(data).success;
}

/**
 * Project legacy Face07 into Face07V2 for display only.
 * Does not invent new people or a new main decision.
 */
export function projectLegacyFace07ForDisplay(data: unknown): Face07V2 | null {
  if (isFace07V2(data) && (data as Face07V2).applicability_status) {
    return data as Face07V2;
  }
  const parsed = Face07LegacySchema.safeParse(data);
  if (!parsed.success) return null;
  const leg = parsed.data;
  const align = (leg.align_with_01_05 || "").trim();
  return {
    page: "07",
    face: "07",
    schema_version: "face07-v2",
    page_title: leg.page_title,
    page_subtitle: leg.page_subtitle,
    applicability_status: "applicable",
    applicability_reason: "历史 flat Page07 投影，仅供阅读，不得当作新稿认证。",
    skip_note: "",
    participants: [
      {
        participant_id: "self",
        display_label: "用户",
        role: "self",
        source: "legacy_projection",
        verification_status: "user_stated",
        related_fact_ids: [],
        notes: "历史稿未拆参与者。",
      },
    ],
    field_units: [
      {
        unit_id: "legacy_field",
        kind: "field_constraint",
        text: leg.field_judgment.slice(0, 960),
        claim_ids: ["legacy_claim_07"],
        evidence_ids: ["legacy_ev_07"],
        reality_fact_ids: [],
        reality_fact_stances: [],
        participant_ids: ["self"],
        dir_ids: [],
        supporting_personal_unit_refs: [],
      },
    ],
    relationship_units: [
      {
        unit_id: "legacy_relation",
        kind: "collaboration",
        text: leg.relation_interaction.slice(0, 960),
        claim_ids: ["legacy_claim_07"],
        evidence_ids: ["legacy_ev_07"],
        reality_fact_ids: [],
        reality_fact_stances: [],
        participant_ids: ["self"],
        uncertainty_notes: ["历史稿未拆关系事实。"],
        supporting_personal_unit_refs: [],
      },
    ],
    evidence_boundary: {
      claim_ids: ["legacy_claim_07"],
      confirmed_fact_ids: [],
      hypothesis_notes: [],
      uncertainty_notes: [
        leg.evidence_fold.slice(0, 240) || "历史稿依据未结构化。",
      ],
      third_party_data_limits: ["历史稿未授权第三方资料。"],
      supporting_personal_unit_refs: [],
    },
    alignment_with_main: {
      changes_page01_recommendation: false,
      changes_page05_path_order: false,
      effect_on_page06_execution: align || "历史稿未说明对执行的影响。",
      summary: align || "历史稿与主决策对齐句未结构化。",
      claim_ids: ["legacy_claim_07"],
      evidence_ids: ["legacy_ev_07"],
      related_page05_path_ids: [],
      related_page06_action_ids: [],
    },
    reading_order: [...PAGE07_SECTION_IDS],
    authorized_partner_profile: false,
  };
}
