import type { StoredProfileData } from "@/lib/db/poju-db";
import type { BirthInfo } from "@/lib/profile/types";

export function splitPillar(ganzhi: string): { stem: string; branch: string } {
  const t = ganzhi.trim();
  if (t.length >= 2) return { stem: t[0]!, branch: t[1]! };
  return { stem: t || "?", branch: "" };
}

export function profileBirthInfo(profile: StoredProfileData): BirthInfo {
  return profile.user_profile.birth;
}

export function strengthFromBaseAnalysis(
  profile: StoredProfileData,
  locale: string,
): string | null {
  const content = profile.base_analysis?.content;
  if (!content || typeof content !== "object") return null;
  const base = (content as Record<string, unknown>)["命主基础"];
  if (!base || typeof base !== "object") return null;
  const raw = (base as Record<string, unknown>)["强弱定性"];
  if (typeof raw !== "string") return null;
  return getStrengthLabel(raw, locale);
}

export function currentPhaseFromBaseAnalysis(profile: StoredProfileData): string | null {
  const content = profile.base_analysis?.content;
  if (!content || typeof content !== "object") return null;
  const cur = (content as Record<string, unknown>)["当前大运详解"];
  if (!cur || typeof cur !== "object") return null;
  const row = cur as Record<string, unknown>;
  const stemBranch = typeof row["干支"] === "string" ? row["干支"] : "";
  const period = typeof row["时段"] === "string" ? row["时段"] : "";
  const parts = [stemBranch, period].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function getElementLabel(element: string, locale: string): string {
  const isZh = locale.startsWith("zh");
  const map: Record<string, Record<string, string>> = {
    zh: { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" },
    en: { wood: "Wood", fire: "Fire", earth: "Earth", metal: "Metal", water: "Water" },
  };
  const table = isZh ? map.zh : map.en;
  return table[element.toLowerCase()] ?? element;
}

export function getStrengthLabel(strength: string, locale: string): string {
  const isZh = locale.startsWith("zh");
  const map: Record<string, Record<string, string>> = {
    zh: { strong: "偏强", balanced: "中和", weak: "偏弱" },
    en: { strong: "Strong", balanced: "Balanced", weak: "Weak" },
  };
  const table = isZh ? map.zh : map.en;
  return table[strength.toLowerCase()] ?? strength;
}
