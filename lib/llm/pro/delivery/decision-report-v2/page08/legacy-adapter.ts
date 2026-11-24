/**
 * Face08 legacy flat ↔ V2 display projection.
 * Historical open only — never used for new production certification.
 */

import type { Face08V2 } from "../schemas";
import { PAGE08_SECTION_IDS } from "./architecture/sections";

const LEGACY_DECISION = ["continue", "adjust", "stop", "rerun"] as const;

function isRecord(data: unknown): data is Record<string, unknown> {
  return Boolean(data) && typeof data === "object" && !Array.isArray(data);
}

export function isFace08V2(data: unknown): data is Face08V2 {
  if (!isRecord(data)) return false;
  return (
    data.page === "08" &&
    data.face === "08" &&
    (data.schema_version === "face08-v2" || Array.isArray(data.risks))
  );
}

export function isFace08Legacy(data: unknown): boolean {
  if (!isRecord(data)) return false;
  if (isFace08V2(data)) return false;
  return (
    data.page === "08" &&
    data.face === "08" &&
    Array.isArray(data.red_lights) &&
    Array.isArray(data.review_questions) &&
    typeof data.when_to_rerun === "string"
  );
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function mapDecision(value: unknown): Face08V2["triggers"][number]["decision_response"] {
  const raw = String(value ?? "").trim();
  if (raw === "continue" || raw === "adjust" || raw === "pause" || raw === "stop") {
    return raw;
  }
  if (raw === "rerun") return "reassess";
  if ((LEGACY_DECISION as readonly string[]).includes(raw)) {
    return raw === "rerun" ? "reassess" : (raw as "continue" | "adjust" | "stop");
  }
  return "reassess";
}

/**
 * Project legacy Face08 (red lights / review questions / when to rerun)
 * into Face08V2 for display only. legacy_ ids are display-only.
 */
export function projectLegacyFace08ForDisplay(data: unknown): Face08V2 | null {
  if (isFace08V2(data)) return data;
  if (!isFace08Legacy(data) || !isRecord(data)) return null;
  const lights = asStrings(data.red_lights);
  const questions = asStrings(data.review_questions);
  const when = String(data.when_to_rerun ?? "").trim();
  const metrics = asStrings(data.shared_core_metrics);
  if (!lights.length || !questions.length || !when) return null;
  const riskId = "legacy_risk_08";
  const signalId = "legacy_signal_08";
  return {
    page: "08",
    face: "08",
    schema_version: "face08-v2",
    page_title: String(data.page_title ?? ""),
    page_subtitle: String(data.page_subtitle ?? ""),
    risks: lights.slice(0, 8).map((text, index) => ({
      risk_id: index === 0 ? riskId : `legacy_risk_08_${index}`,
      risk_title: text.slice(0, 120),
      risk_description: text.slice(0, 960),
      risk_category: "information_risk" as const,
      current_status: "unverified" as const,
      related_path_ids: [],
      related_action_ids: [],
      reality_fact_ids: [],
      reality_fact_stances: [],
      claim_ids: ["legacy_claim_08"],
      evidence_ids: ["legacy_ev_08"],
    })),
    observation_signals: [
      ...questions.slice(0, 6).map((text, index) => ({
        signal_id: index === 0 ? signalId : `legacy_signal_08_${index}`,
        related_risk_ids: [riskId],
        signal_name: text.slice(0, 120),
        what_to_observe: text.slice(0, 480),
        observation_source: "历史稿复盘问句",
        observation_method: "沿用历史自检问句，不新增事实。",
        observation_window: "历史稿未给窗口。",
        baseline_status: "no_basis" as const,
        threshold_status: "not_defined" as const,
        related_fact_ids: [],
        reality_fact_stances: [],
      })),
      ...metrics.slice(0, 2).map((text, index) => ({
        signal_id: `legacy_metric_08_${index}`,
        related_risk_ids: [riskId],
        signal_name: text.slice(0, 120),
        what_to_observe: text.slice(0, 480),
        observation_source: "历史稿 shared_core_metrics",
        observation_method: "只展示历史指标原文。",
        observation_window: "历史稿未给窗口。",
        baseline_status: "no_basis" as const,
        threshold_status: "not_defined" as const,
        related_fact_ids: [],
        reality_fact_stances: [],
      })),
    ],
    triggers: [
      {
        trigger_id: "legacy_trigger_08",
        related_risk_ids: [riskId],
        related_signal_ids: [signalId],
        trigger_condition: when.slice(0, 480),
        trigger_status: "pending_confirmation" as const,
        decision_response: mapDecision(data.review_decision),
        required_evidence_ids: ["legacy_ev_08"],
        related_path_ids: [],
        related_action_ids: [],
        related_fact_ids: [],
        reality_fact_stances: [],
      },
    ],
    reassessment_conditions: [
      {
        reassessment_id: "legacy_reassess_08",
        condition: when.slice(0, 480),
        change_type: "legacy_review",
        related_fact_ids: [],
        reality_fact_stances: [],
        related_claim_ids: ["legacy_claim_08"],
        affected_path_ids: [],
        expected_review_scope:
          String(data.review_decision_rationale ?? "").trim().slice(0, 480) ||
          "历史稿未结构化复盘范围。",
      },
    ],
    evidence_boundary: {
      confirmed_fact_ids: [],
      unverified_fact_ids: [],
      related_claim_ids: ["legacy_claim_08"],
      related_evidence_ids: ["legacy_ev_08"],
      unresolved_questions: ["历史稿未拆已确认与未核实事实。"],
      monitoring_limitations: ["历史稿仅供阅读，不得当作新稿认证。"],
      reassessment_limitations: ["历史稿没有结构化监测契约。"],
    },
    reading_order: [...PAGE08_SECTION_IDS],
  };
}
