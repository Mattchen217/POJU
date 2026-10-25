import type { MatchReport, MatchSessionPayload, SynergyType } from "./types";
import { SYNERGY_TYPES } from "./types";

const LEGACY_SYNERGY_TYPE_MAP: Record<string, SynergyType> = {
  highly_compatible: "full_resonance",
  compatible_with_effort: "complementary_flow",
  neutral: "adaptive_balance",
  challenging: "dynamic_tension",
  highly_challenging: "structural_undertow",
};

export function normalizeSynergyType(raw: unknown): SynergyType {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (key && key in SYNERGY_TYPES) return key as SynergyType;
  if (key && key in LEGACY_SYNERGY_TYPE_MAP) return LEGACY_SYNERGY_TYPE_MAP[key];
  return "adaptive_balance";
}

export function normalizeMatchReport(report: MatchReport): MatchReport {
  const conclusion = report.conclusion as MatchReport["conclusion"] & {
    compatibility_level?: unknown;
  };
  const synergy_type = normalizeSynergyType(conclusion.synergy_type ?? conclusion.compatibility_level);

  const meta = report._meta.computation_meta as
    | (NonNullable<MatchReport["_meta"]["computation_meta"]> & {
        overall_level?: unknown;
        weighted_total_score?: number;
      })
    | undefined;

  return {
    ...report,
    conclusion: {
      ...conclusion,
      synergy_type,
    },
    _meta: {
      ...report._meta,
      computation_meta: meta
        ? {
            resonance_index:
              typeof meta.resonance_index === "number"
                ? meta.resonance_index
                : meta.weighted_total_score ?? 0,
            synergy_type: normalizeSynergyType(meta.synergy_type ?? meta.overall_level),
            day_master_type: meta.day_master_type,
            day_branch_he: meta.day_branch_he,
            day_branch_chong: meta.day_branch_chong,
          }
        : meta,
    },
  };
}

export function normalizeMatchSessionPayload(payload: MatchSessionPayload): MatchSessionPayload {
  const legacyScore = (payload as MatchSessionPayload & { compatibility_score?: number })
    .compatibility_score;
  return {
    ...payload,
    report: normalizeMatchReport(payload.report),
    resonance_index:
      typeof payload.resonance_index === "number"
        ? payload.resonance_index
        : legacyScore,
  };
}

export function normalizeMatchArchiveSynergyType(raw: unknown): SynergyType {
  return normalizeSynergyType(raw);
}
