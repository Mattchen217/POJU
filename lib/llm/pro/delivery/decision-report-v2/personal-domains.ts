/**
 * Derive Page 01 available_domains from real chart/ziwei presence.
 * BookJudgmentPack alone must not imply both domains.
 */

import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";

export type PersonalDomainAvailability = {
  available_domains: string[];
  profile_version: string;
  bazi_available: boolean;
  ziwei_available: boolean;
};

/**
 * Resolve which traditional analysis domains are actually available.
 * - bazi: requires non-empty chart fact pack text (or explicit flag)
 * - ziwei: requires ziwei pack with patternHits, or pack.zfpOmitted===false + zfp_hash
 */
export function resolveAvailablePersonalDomains(input: {
  pack?: BookJudgmentPack | null;
  /** Prealloc / CFP chart text — empty means bazi not available. */
  chart_fact_pack?: string | null;
  ziwei_fact_pack?: ZiweiFactPack | null;
  /** Explicit overrides when caller already resolved presence. */
  bazi_available?: boolean;
  ziwei_available?: boolean;
}): PersonalDomainAvailability {
  const chartText = input.chart_fact_pack?.trim() ?? "";
  const ziwei = input.ziwei_fact_pack;
  const pack = input.pack ?? null;

  const bazi_available =
    input.bazi_available === true
      ? true
      : input.bazi_available === false
        ? false
        : chartText.length > 0;

  const ziweiFromPack =
    pack != null &&
    pack.zfpOmitted === false &&
    typeof pack.zfp_hash === "string" &&
    pack.zfp_hash.trim().length > 0;

  const ziweiFromZfp =
    ziwei != null &&
    Array.isArray(ziwei.patternHits) &&
    ziwei.patternHits.length > 0;

  const ziwei_available =
    input.ziwei_available === true
      ? true
      : input.ziwei_available === false
        ? false
        : ziweiFromZfp || ziweiFromPack;

  const available_domains: string[] = [];
  if (bazi_available) available_domains.push("bazi");
  if (ziwei_available) available_domains.push("ziwei");

  const profile_version =
    (bazi_available && pack?.cfp_hash?.trim()) ||
    (ziwei_available && pack?.zfp_hash?.trim()) ||
    (bazi_available ? "chart_present" : "") ||
    (ziwei_available ? "ziwei_present" : "") ||
    "unavailable";

  return {
    available_domains,
    profile_version,
    bazi_available,
    ziwei_available,
  };
}
