/**
 * Face05 legacy flat ↔ V2 display projection.
 * Historical open only — never used for new production certification.
 */

import {
  Face05LegacySchema,
  type Face05Legacy,
  type Face05V2,
} from "../schemas";
import { PAGE05_SECTION_IDS } from "./architecture/sections";

export function isFace05V2(data: unknown): data is Face05V2 {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.page === "05" &&
    o.face === "05" &&
    (o.schema_version === "face05-v2" || Array.isArray(o.path_units))
  );
}

export function isFace05Legacy(data: unknown): data is Face05Legacy {
  if (!data || typeof data !== "object") return false;
  if (isFace05V2(data)) return false;
  return Face05LegacySchema.safeParse(data).success;
}

/**
 * Project legacy Face05 into path-unit Face05V2 for display only.
 * Missing structured fields stay explicit — never invent new paths.
 */
export function projectLegacyFace05ForDisplay(data: unknown): Face05V2 | null {
  if (isFace05V2(data) && Array.isArray((data as Face05V2).path_units)) {
    return data as Face05V2;
  }
  const parsed = Face05LegacySchema.safeParse(data);
  if (!parsed.success) return null;
  const leg = parsed.data;

  return {
    page: "05",
    face: "05",
    schema_version: "face05-v2",
    page_title: leg.page_title,
    page_subtitle: leg.page_subtitle,
    path_units: [
      {
        path_id: "legacy_preferred",
        path_role: "preferred",
        title: "首选（历史稿）",
        description: leg.first_choice.slice(0, 960),
        recommendation_reason: "（历史稿未拆分推荐理由）",
        prerequisites: [],
        required_resources: [],
        expected_benefits: [],
        costs: [],
        risks: [],
        reversibility: "（历史稿未提供可逆性）",
        success_signals: ["（历史稿未提供继续信号）"],
        reconsideration_conditions: [],
        claim_ids: ["legacy_claim_05"],
        evidence_ids: ["legacy_ev_05"],
        related_reality_fact_ids: [],
        supporting_page01_refs: [],
        supporting_page02_refs: [],
        supporting_page04_refs: [],
      },
      {
        path_id: "legacy_alternative",
        path_role: "alternative",
        title: "次选（历史稿）",
        description: leg.second_choice.slice(0, 960),
        recommendation_reason: "（历史稿未拆分与首选差别）",
        prerequisites: [],
        required_resources: [],
        expected_benefits: [],
        costs: [],
        risks: [],
        reversibility: "（历史稿未提供可逆性）",
        success_signals: ["（历史稿未提供继续信号）"],
        reconsideration_conditions: [],
        claim_ids: ["legacy_claim_05"],
        evidence_ids: ["legacy_ev_05"],
        related_reality_fact_ids: [],
        supporting_page01_refs: [],
        supporting_page02_refs: [],
        supporting_page04_refs: [],
      },
      {
        path_id: "legacy_cautious",
        path_role: "cautious",
        title: "慎选（历史稿）",
        description: leg.caution_choice.slice(0, 960),
        recommendation_reason: "（历史稿慎选说明）",
        prerequisites: [],
        required_resources: [],
        expected_benefits: [],
        costs: [],
        risks: [],
        reversibility: "（历史稿未提供可逆性）",
        success_signals: ["（历史稿未提供继续信号）"],
        reconsideration_conditions: ["（历史稿未提供重新考虑条件）"],
        claim_ids: ["legacy_claim_05"],
        evidence_ids: ["legacy_ev_05"],
        related_reality_fact_ids: [],
        supporting_page01_refs: [],
        supporting_page02_refs: [],
        supporting_page04_refs: [],
      },
    ],
    preferred_path_ids: ["legacy_preferred"],
    alternative_path_ids: ["legacy_alternative"],
    cautious_path_ids: ["legacy_cautious"],
    path_comparison: {
      rows: [
        {
          path_id: "legacy_preferred",
          benefit: "（历史稿无独立对照）",
          cost: "（缺失）",
          risk: "（缺失）",
          resource_requirement: "（缺失）",
          reversibility: "（缺失）",
          prerequisites: "（缺失）",
        },
        {
          path_id: "legacy_alternative",
          benefit: "（历史稿无独立对照）",
          cost: "（缺失）",
          risk: "（缺失）",
          resource_requirement: "（缺失）",
          reversibility: "（缺失）",
          prerequisites: "（缺失）",
        },
        {
          path_id: "legacy_cautious",
          benefit: "（历史稿无独立对照）",
          cost: "（缺失）",
          risk: "（缺失）",
          resource_requirement: "（缺失）",
          reversibility: "（缺失）",
          prerequisites: "（缺失）",
        },
      ],
    },
    switching_rules: [
      {
        rule_id: "legacy_switch_or_stop",
        source_path_id: "legacy_preferred",
        trigger_condition: leg.switch_or_stop.slice(0, 480),
        action: "stop",
        target_path_id: null,
        rationale: "（历史稿切轨/停止未结构化）",
        claim_ids: ["legacy_claim_05"],
        evidence_ids: ["legacy_ev_05"],
        related_reality_fact_ids: [],
      },
    ],
    evidence_boundary: {
      claim_ids: ["legacy_claim_05"],
      confirmed_fact_ids: [],
      hypothesis_notes: [],
      uncertainty_notes: [
        "历史 flat Page05 投影：结构化路径字段缺失，不得当作新稿认证结果。",
        leg.contrast?.trim()
          ? `历史对照原文：${leg.contrast.trim().slice(0, 200)}`
          : "历史稿无独立对照字段。",
      ],
      cautious_absent_note: "",
    },
    reading_order: [...PAGE05_SECTION_IDS],
  };
}
