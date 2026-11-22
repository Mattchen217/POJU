/**
 * Historical Face01 open path — map legacy four-field shape for readers.
 * New generation must use Face01V2Schema; never write legacy back.
 */

import { Face01LegacySchema, type Face01Legacy, type Face01V2 } from "../schemas";

export function isFace01V2(data: unknown): data is Face01V2 {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.page === "01" &&
    typeof o.core_judgment === "object" &&
    o.core_judgment != null
  );
}

export function isFace01Legacy(data: unknown): data is Face01Legacy {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.page === "01" &&
    typeof o.main_recommendation === "string" &&
    !isFace01V2(data)
  );
}

/**
 * Best-effort display projection for legacy books.
 * Synthetic ids are display-only and must not be treated as registry truth.
 */
export function projectLegacyFace01ForDisplay(data: unknown): Face01V2 | null {
  const parsed = Face01LegacySchema.safeParse(data);
  if (!parsed.success) return null;
  const leg = parsed.data;
  return {
    page: "01",
    face: "01",
    schema_version: "face01-v2",
    page_title: leg.page_title,
    page_subtitle: leg.page_subtitle,
    core_judgment: {
      text: leg.main_recommendation,
      claim_ids: ["legacy_claim_core"],
    },
    why_this_path: [
      {
        text: leg.evidence_pointer,
        claim_ids: ["legacy_claim_why"],
        evidence_ids: ["legacy_ev_why"],
        target_page: "02",
        target_evidence_ids: ["legacy_ev_why"],
      },
    ],
    recommendation_conditions: [
      {
        condition: leg.conditions,
        status: "unconfirmed",
        source_ids: ["legacy_cond"],
      },
      {
        condition: "（历史报告未拆分条件状态）",
        status: "not_applicable",
        source_ids: ["legacy_cond_na"],
      },
    ],
    not_recommended: [
      {
        option: leg.not_choosing,
        reason: "（历史报告未拆分不建议理由）",
        cost_or_conflict: "（历史报告未记录代价）",
        claim_ids: ["legacy_claim_not"],
        evidence_ids: ["legacy_ev_not"],
      },
    ],
    applicability_boundary: {
      current_basis: [leg.conditions],
      invalidation_conditions: ["（历史报告未记录失效条件）"],
      page02_evidence_ids: ["legacy_ev_why"],
      page08_review_refs: [],
    },
  };
}
