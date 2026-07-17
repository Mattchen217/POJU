/**
 * Front-of-paywall matrix labels — always resolve via POJU_TERMS SSOT.
 * Never surface 日主/用神/十神/长生/藏干/大运/流年 raw Han on the façade.
 */

import { CLOSED_SET_SLUG } from "@/lib/glossary/term-closed-set";
import {
  glossOf,
  pojuTermByTraditional,
  termOf,
} from "@/lib/glossary/pojulife-terms";

/** Layer caps for the four-pillar personality readout (no 「柱」). */
export const MATRIX_LAYER_CAPS = {
  zh: {
    year: "根基层",
    month: "外场层",
    day: "本我层",
    hour: "远景层",
  },
  en: {
    year: "Root layer",
    month: "Outer field",
    day: "Core self",
    hour: "Horizon",
  },
} as const;

const LIFE_STAGE_HAN_TO_SLUG: Record<string, string> = {
  长生: "life_changsheng",
  沐浴: "life_muyu",
  冠带: "life_guandai",
  临官: "life_linguan",
  帝旺: "life_diwang",
  衰: "life_shuai",
  病: "life_bing",
  死: "life_si",
  墓: "life_mu",
  绝: "life_jue",
  胎: "life_tai",
  养: "life_yang",
};

/** Soft label for a traditional Han term (十神 / 日主 / 长生…). */
export function matrixSoftTerm(traditionalOrSlug: string, locale: string): string {
  const raw = traditionalOrSlug.trim();
  if (!raw) return "";
  // Already a slug?
  const bySlug = termOf(raw, locale);
  if (bySlug) return bySlug;
  const byTrad = pojuTermByTraditional(raw);
  if (byTrad) return termOf(byTrad.slug, locale) ?? byTrad.term.zh;
  const slug = CLOSED_SET_SLUG[raw] ?? LIFE_STAGE_HAN_TO_SLUG[raw];
  if (slug) return termOf(slug, locale) ?? raw;
  // 日元 / 元男 / 元女 → 本元
  if (/^(日元|元男|元女)$/.test(raw)) return termOf("day_master", locale) ?? (locale.startsWith("zh") ? "本元" : "Core");
  return raw;
}

export function matrixSoftGloss(traditionalOrSlug: string, locale: string): string {
  const raw = traditionalOrSlug.trim();
  if (!raw) return "";
  const byTrad = pojuTermByTraditional(raw);
  if (byTrad) return glossOf(byTrad.slug, locale) ?? "";
  const slug = CLOSED_SET_SLUG[raw] ?? LIFE_STAGE_HAN_TO_SLUG[raw] ?? raw;
  return glossOf(slug, locale) ?? "";
}

export function matrixLayerCap(
  slot: "year" | "month" | "day" | "hour",
  locale: string,
): string {
  return locale.startsWith("zh") ? MATRIX_LAYER_CAPS.zh[slot] : MATRIX_LAYER_CAPS.en[slot];
}

/** Strip ganzhi year from lunar strings like 「丁巳年正月三十」→「正月三十」. */
export function stripGanzhiFromLunar(lunar: string, locale: string): string {
  if (!lunar?.trim()) return "";
  let s = lunar.trim();
  // Drop leading 干支年
  s = s.replace(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]年/, "");
  // Drop any remaining stem-branch pairs
  s = s.replace(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g, "");
  s = s.replace(/\s{2,}/g, " ").replace(/^[·\s，,]+|[·\s，,]+$/g, "").trim();
  if (!s) return locale.startsWith("zh") ? "农历" : "Lunar";
  if (locale.startsWith("zh") && !s.startsWith("农历")) return `农历${s}`;
  return s;
}

/** Element-only annual transit headline (no 丙午 / bing wu). */
export function annualTransitHeadline(
  stemElement: string,
  locale: string,
): { title: string; subtitle: string } {
  const el = stemElement || (locale.startsWith("zh") ? "流势" : "Transit");
  if (locale.startsWith("zh")) {
    return { title: `${el}势`, subtitle: "本年动能背景" };
  }
  return { title: `${el} tide`, subtitle: "This year's momentum field" };
}
