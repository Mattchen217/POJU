/**
 * Front-of-paywall matrix labels — resolve via POJU_TERMS SSOT for closed-set terms.
 * Five elements on the façade use classic 金木水火土 / Wood (木) (not soft Growth/Radiance…).
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

const ZODIAC_HAN_TO_SLUG: Record<string, string> = {
  鼠: "zd_rat",
  牛: "zd_ox",
  虎: "zd_tiger",
  兔: "zd_rabbit",
  龙: "zd_dragon",
  龍: "zd_dragon",
  蛇: "zd_snake",
  马: "zd_horse",
  馬: "zd_horse",
  羊: "zd_goat",
  猴: "zd_monkey",
  鸡: "zd_rooster",
  雞: "zd_rooster",
  狗: "zd_dog",
  猪: "zd_pig",
  豬: "zd_pig",
};

/** Year-animal han (鼠/龙…) → zodiac SSOT slug. */
export function zodiacHanToSlug(han: string): string | null {
  const t = han.trim();
  if (!t) return null;
  return ZODIAC_HAN_TO_SLUG[t] ?? ZODIAC_HAN_TO_SLUG[t.charAt(0)] ?? null;
}

/** Soft façade labels that already went through SSOT (本元 / Core…). */
const SOFT_LABEL_TO_SLUG: Record<string, string> = {
  本元: "day_master",
  Core: "day_master",
  Núcleo: "day_master",
  Kern: "day_master",
  Noyau: "day_master",
  日元: "day_master",
  元男: "day_master",
  元女: "day_master",
};

/** Traditional / soft surface → SSOT slug when known. */
export function matrixTermSlug(traditionalOrSoft: string): string | null {
  const raw = traditionalOrSoft.trim();
  if (!raw) return null;
  const el = elementToSlug(raw);
  if (el) return el;
  const zd = zodiacHanToSlug(raw);
  if (zd) return zd;
  const softHit = SOFT_LABEL_TO_SLUG[raw];
  if (softHit) return softHit;
  const byTrad = pojuTermByTraditional(raw);
  if (byTrad) return byTrad.slug;
  const closed = CLOSED_SET_SLUG[raw] ?? LIFE_STAGE_HAN_TO_SLUG[raw];
  return closed ?? null;
}

const PILLAR_SLOT_SLUG = {
  year: "pl_year",
  month: "pl_month",
  day: "pl_day",
  hour: "pl_hour",
} as const;

export function pillarSlotSlug(
  slot: "year" | "month" | "day" | "hour",
): string {
  return PILLAR_SLOT_SLUG[slot];
}

export function strengthToSlug(
  strength: "strong" | "weak" | "balanced",
): string {
  if (strength === "strong") return "strong_self";
  if (strength === "weak") return "weak_self";
  return "balanced_self";
}

const ELEMENT_HAN: Record<string, string> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
};

const ELEMENT_PRIMARY: Record<string, Record<string, string>> = {
  zh: { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" },
  en: { wood: "Wood", fire: "Fire", earth: "Earth", metal: "Metal", water: "Water" },
  es: { wood: "Madera", fire: "Fuego", earth: "Tierra", metal: "Metal", water: "Agua" },
  de: { wood: "Holz", fire: "Feuer", earth: "Erde", metal: "Metall", water: "Wasser" },
  fr: { wood: "Bois", fire: "Feu", earth: "Terre", metal: "Métal", water: "Eau" },
};

/** Han glyph for a five-element key (木/火/土/金/水). */
export function matrixElementHan(element: string): string | null {
  const slug = elementToSlug(element);
  if (!slug) return null;
  return ELEMENT_HAN[slug] ?? null;
}

/**
 * Locale primary for five elements — zh「木」; en「Wood」; es/de/fr localized.
 * No parenthetical Han (use matrixElementSoft / MatrixElementLabel for that).
 */
export function matrixElementPrimary(element: string, locale: string): string {
  const slug = elementToSlug(element);
  if (!slug) return element.trim();
  const lang = locale.toLowerCase().slice(0, 2);
  const table = ELEMENT_PRIMARY[lang] ?? ELEMENT_PRIMARY.en;
  return table?.[slug] ?? ELEMENT_PRIMARY.en[slug] ?? element.trim();
}

/**
 * Five-element façade label: zh「木」; en/es/de/fr「Wood (木)」.
 * Falls back to input only when unknown.
 */
export function matrixElementSoft(element: string, locale: string): string {
  const primary = matrixElementPrimary(element, locale);
  if (!elementToSlug(element)) return primary;
  if (locale.toLowerCase().startsWith("zh")) return primary;
  const han = matrixElementHan(element);
  return han ? `${primary} (${han})` : primary;
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

/** Element-only annual transit headline — classic element name (no parenthetical). */
export function annualTransitHeadline(
  stemElement: string,
  locale: string,
): { title: string; subtitle: string } {
  const primary = matrixElementPrimary(stemElement, locale) || stemElement;
  if (locale.startsWith("zh")) {
    return { title: `${primary}势`, subtitle: "本年动能背景" };
  }
  return { title: `${primary} tide`, subtitle: "This year's momentum field" };
}
