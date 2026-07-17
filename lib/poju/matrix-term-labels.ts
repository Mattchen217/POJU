/**
 * Front-of-paywall matrix labels — always resolve via POJU_TERMS SSOT.
 * Never surface 日主/用神/十神/长生/藏干/大运/流年/金木水火土 raw on the façade.
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

/** English / Han / slug → POJU element slug. */
const ELEMENT_TO_SLUG: Record<string, string> = {
  Wood: "wood",
  Fire: "fire",
  Earth: "earth",
  Metal: "metal",
  Water: "water",
  wood: "wood",
  fire: "fire",
  earth: "earth",
  metal: "metal",
  water: "water",
  木: "wood",
  火: "fire",
  土: "earth",
  金: "metal",
  水: "water",
};

export function elementToSlug(element: string): string | null {
  const t = element.trim();
  if (!t) return null;
  return ELEMENT_TO_SLUG[t] ?? ELEMENT_TO_SLUG[t.charAt(0)] ?? null;
}

/**
 * Five-element soft label from SSOT (舒展/发散/承托/精练/润流 · Growth/Radiance/…).
 * Falls back to input only when unknown.
 */
export function matrixElementSoft(element: string, locale: string): string {
  const slug = elementToSlug(element);
  if (!slug) return element.trim();
  return termOf(slug, locale) ?? element.trim();
}

/** Soft label for a traditional Han term (十神 / 日主 / 长生 / 五行…). */
export function matrixSoftTerm(traditionalOrSlug: string, locale: string): string {
  const raw = traditionalOrSlug.trim();
  if (!raw) return "";
  if (elementToSlug(raw)) return matrixElementSoft(raw, locale);
  const bySlug = termOf(raw, locale);
  if (bySlug) return bySlug;
  const byTrad = pojuTermByTraditional(raw);
  if (byTrad) return termOf(byTrad.slug, locale) ?? byTrad.term.zh;
  const slug = CLOSED_SET_SLUG[raw] ?? LIFE_STAGE_HAN_TO_SLUG[raw];
  if (slug) return termOf(slug, locale) ?? raw;
  if (/^(日元|元男|元女)$/.test(raw)) {
    return termOf("day_master", locale) ?? (locale.startsWith("zh") ? "本元" : "Core");
  }
  if (/^(身旺|身强)$/.test(raw)) {
    return termOf("strong_self", locale) ?? raw;
  }
  if (raw === "中和") {
    return termOf("balanced_self", locale) ?? raw;
  }
  return raw;
}

export function matrixSoftGloss(traditionalOrSlug: string, locale: string): string {
  const raw = traditionalOrSlug.trim();
  if (!raw) return "";
  const elSlug = elementToSlug(raw);
  if (elSlug) return glossOf(elSlug, locale) ?? "";
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
  s = s.replace(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]年/, "");
  s = s.replace(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g, "");
  s = s.replace(/\s{2,}/g, " ").replace(/^[·\s，,]+|[·\s，,]+$/g, "").trim();
  if (!s) return locale.startsWith("zh") ? "农历" : "Lunar";
  if (locale.startsWith("zh") && !s.startsWith("农历")) return `农历${s}`;
  return s;
}

/** Element-only annual transit headline — soft element via SSOT. */
export function annualTransitHeadline(
  stemElement: string,
  locale: string,
): { title: string; subtitle: string } {
  const soft = matrixElementSoft(stemElement, locale) || stemElement;
  if (locale.startsWith("zh")) {
    return { title: `${soft}势`, subtitle: "本年动能背景" };
  }
  return { title: `${soft} tide`, subtitle: "This year's momentum field" };
}
