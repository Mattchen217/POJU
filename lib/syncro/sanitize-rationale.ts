const INTERNAL_KEYS_BLACKLIST = [
  "qimen",
  "yong_shen_direction",
  "yongShen",
  "yong_shen",
  "hour_yong_shen",
  "day_master_direction",
  "dayMaster",
  "day_master",
  "hour_pillar",
  "birth_chart",
  "four_pillars",
  "tianGan",
  "diZhi",
  "task_direction",
  "key_factors",
  "total_score",
  "current_level",
  "_internal",
];

/** Strip internal scoring keys from user-visible Syncro rationale copy. */
export function sanitizeSyncroRationale(text: string, locale: string): string {
  let result = text;
  const isZh = locale.startsWith("zh");
  const replacement = isZh ? "能量" : "energy";

  result = result.replace(/^主要因素[：:]\s*[^\n]+\n?/gm, "");
  result = result.replace(/^Key factors[：:]\s*[^\n]+\n?/gim, "");
  result = result.replace(/（主要因素[：:][^）]+）/g, "");
  result = result.replace(/\(key factors[：:][^)]+\)/gi, "");

  for (const key of INTERNAL_KEYS_BLACKLIST) {
    const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    result = result.replace(regex, replacement);
  }

  return result.replace(/\s{2,}/g, " ").trim();
}
