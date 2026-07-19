/**
 * Local fact cards for the matrix lifecycle right column.
 * Replaces prose templates (RESONANCE / TENSION / READING / annual narrative).
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { getCurrentLiunian } from "@/lib/calculations/liunian";
import {
  computeLiunianRelations,
  computeNatalChartRelations,
  detectTenGodTensions,
  type Palace,
  type RelationKind,
  type RelationLabel,
} from "@/lib/calculations/relation-engine";
import {
  calculateTenGod,
  type HeavenlyStem,
} from "@/lib/match/data/stems-branches";
import {
  getBranchInfo,
  getStemInfo,
  zodiacAnimalHanFromBranch,
} from "@/lib/poju/bazi-matrix-mappings";
import {
  elementToSlug,
  matrixElementSoft,
  matrixSoftTerm,
  matrixTermSlug,
  strengthToSlug,
  zodiacHanToSlug,
} from "@/lib/poju/matrix-term-labels";
import { normalizeShenshaLocale, resolveShenshaList } from "@/lib/poju/shensha";
import { pojuTermByTraditional, termOf } from "@/lib/glossary/pojulife-terms";
import { normalizeMatrixLocale } from "@/lib/poju/poju-matrix-i18n";

export type MatrixFactChip = {
  soft: string;
  /** SSOT slug for SoftTermHover gloss (kind / element / ten-god…). */
  slug: string | null;
  polarity: "green" | "red" | "gold" | "neutral";
};

export type MatrixFactPanel = {
  era: {
    theme: string;
    age_range: string;
    start_year: number;
    start_age: number | null;
    progress_pct: number;
    ten_god_soft: string | null;
    ten_god_slug: string | null;
    stem_element_soft: string | null;
    stem_element_slug: string | null;
  };
  year_pulse: {
    year: number;
    stem_element_soft: string;
    stem_element_slug: string | null;
    progress_pct: number;
    links: MatrixFactChip[];
  };
  structure: {
    bonds: MatrixFactChip[];
    tensions: MatrixFactChip[];
  };
  balance: {
    strength_soft: string;
    strength_slug: string;
    yong_soft: string | null;
    yong_slug: string | null;
    /** Soft line from yongshen_analysis.status_strength (façade-safe). */
    status_soft: string | null;
    xi: MatrixFactChip[];
    ji: MatrixFactChip[];
  };
  /** Current 流年 branch → zodiac + element soft (岁君). */
  year_sign: {
    year: number;
    zodiac_han: string;
    zodiac_slug: string | null;
    zodiac_soft: string;
    branch_element_soft: string;
    branch_element_slug: string | null;
    links: MatrixFactChip[];
  };
  /** Chart-wide shensha highlights (plain labels, no SoftTermHover). */
  shensha_highlights: Array<{ id: string; label: string }>;
  /** Luck-cycle onset (起运) — no 干支 on façade. */
  luck_onset: {
    start_age: number | null;
    start_year: number | null;
    start_date: string | null;
    raw_onset: string | null;
  };
};

const KIND_SLUG: Record<RelationKind, string> = {
  chong: "chong",
  xing: "xing",
  hai: "hai",
  liuhe: "liuhe",
  sanhe: "sanhe",
  banhe: "banhe",
  stem_he: "stemhe",
  ten_god_tension: "stemhe",
};

const PALACE_TRAD: Record<Palace, string> = {
  spouse: "配偶宫",
  career: "月柱",
  self: "日主",
  result: "时柱",
  root: "年柱",
};

function relationSoft(r: RelationLabel, locale: string): string {
  if (r.kind === "ten_god_tension") {
    const zh = normalizeMatrixLocale(locale) === "zh";
    if (zh) {
      return r.han.replace(/[（(](?:流年|大运)引动[）)]/g, "").trim();
    }
    if (r.id.startsWith("shangguan")) {
      return "Expression vs structure pull";
    }
    return "Inner focus vs expression pull";
  }
  const kindSoft =
    termOf(KIND_SLUG[r.kind], locale) ?? matrixSoftTerm(r.kind, locale);
  const palace = r.palaces[0];
  const palaceSoft = palace
    ? matrixSoftTerm(PALACE_TRAD[palace], locale)
    : "";
  if (palaceSoft && palaceSoft !== PALACE_TRAD[palace]) {
    return `${kindSoft} · ${palaceSoft}`;
  }
  return kindSoft;
}

function toChip(r: RelationLabel, locale: string): MatrixFactChip {
  return {
    soft: relationSoft(r, locale),
    slug: r.kind === "ten_god_tension" ? null : (KIND_SLUG[r.kind] ?? null),
    polarity: r.polarity,
  };
}

function pickDistinct(
  rels: RelationLabel[],
  locale: string,
  limit: number,
  polarity?: RelationLabel["polarity"],
): MatrixFactChip[] {
  const filtered = polarity ? rels.filter((r) => r.polarity === polarity) : rels;
  const out: MatrixFactChip[] = [];
  const seen = new Set<string>();
  for (const r of filtered) {
    const chip = toChip(r, locale);
    if (!chip.soft || seen.has(chip.soft)) continue;
    seen.add(chip.soft);
    out.push(chip);
    if (out.length >= limit) break;
  }
  return out;
}

function strengthSoft(
  strength: ProfileStructured["strength"],
  locale: string,
): string {
  if (strength === "strong") {
    return matrixSoftTerm("身强", locale);
  }
  if (strength === "weak") {
    return matrixSoftTerm("身弱", locale);
  }
  return matrixSoftTerm("中和", locale);
}

function elementListChips(
  items: string[],
  locale: string,
  limit: number,
  polarity: MatrixFactChip["polarity"],
): MatrixFactChip[] {
  const out: MatrixFactChip[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const soft = matrixSoftTerm(raw, locale) || matrixElementSoft(raw, locale);
    if (!soft || seen.has(soft)) continue;
    if (soft === raw && /[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥格]/.test(raw)) {
      continue;
    }
    seen.add(soft);
    out.push({
      soft,
      slug: elementToSlug(raw) ?? matrixTermSlug(raw),
      polarity,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Parse shunshi 起运 strings like "3岁" / "3年2个月" → approximate age years. */
function parseOnsetAge(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+)\s*岁/) ?? raw.match(/^(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function stripGanzhiNoise(s: string): string {
  return s
    .replace(/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function collectShenshaHighlights(
  structured: ProfileStructured,
  locale: string,
  limit: number,
): Array<{ id: string; label: string }> {
  const tokens: string[] = [];
  const pd = structured.pillars_detail;
  if (pd) {
    for (const key of ["year", "month", "day", "hour"] as const) {
      const stars = pd[key]?.shen_sha ?? [];
      tokens.push(...stars);
    }
  }
  const views = resolveShenshaList(tokens, normalizeShenshaLocale(locale));
  return views.slice(0, limit).map((v) => ({ id: v.id, label: v.label }));
}

export function buildMatrixFactPanel(input: {
  structured: ProfileStructured;
  dayunIndex: number;
  dayunTheme: string;
  dayunAgeRange: string;
  dayunStartYear: number;
  currentAge: number;
  transitYear: number;
  transitProgressPct: number;
  transitStemElement: string;
  /** Raw 起运 from shunshi chart (may include units). */
  luckOnsetRaw?: string | null;
  /** Raw 起运日期 from shunshi chart. */
  luckOnsetDate?: string | null;
  locale: string;
}): MatrixFactPanel {
  const {
    structured,
    dayunIndex,
    dayunTheme,
    dayunAgeRange,
    dayunStartYear,
    currentAge,
    transitYear,
    transitProgressPct,
    transitStemElement,
    luckOnsetRaw,
    luckOnsetDate,
    locale,
  } = input;

  const currentDy = structured.da_yun[dayunIndex];
  let ten_god_soft: string | null = null;
  let ten_god_slug: string | null = null;
  let stem_element_soft: string | null = null;
  let stem_element_slug: string | null = null;
  if (currentDy?.ganzhi) {
    const dyStem = currentDy.ganzhi.charAt(0) as HeavenlyStem;
    const dmStem = (structured.day_master.charAt(0) ||
      structured.pillars_detail?.day.stem ||
      "") as HeavenlyStem;
    const stemInfo = getStemInfo(dyStem);
    stem_element_slug = stemInfo?.element
      ? elementToSlug(stemInfo.element)
      : null;
    stem_element_soft = stemInfo?.element
      ? matrixElementSoft(stemInfo.element, locale)
      : null;
    if (dmStem && dyStem) {
      try {
        const tg = calculateTenGod(dmStem, dyStem);
        if (tg) {
          ten_god_soft = matrixSoftTerm(tg, locale);
          ten_god_slug = pojuTermByTraditional(tg)?.slug ?? null;
        }
      } catch {
        ten_god_soft = null;
      }
    }
  }

  const startAge = currentDy?.start_age ?? null;
  let eraProgress = 50;
  if (startAge != null) {
    eraProgress = Math.min(
      100,
      Math.max(0, Math.round(((currentAge - startAge) / 10) * 100)),
    );
  }

  const natal = computeNatalChartRelations(structured);
  const liunian = getCurrentLiunian();
  const liunianRels = computeLiunianRelations(structured, liunian);
  const tenGodTensions = detectTenGodTensions(
    structured,
    liunian,
    dayunIndex,
  );

  const yearLinks = [
    ...pickDistinct(tenGodTensions, locale, 2),
    ...pickDistinct(liunianRels, locale, 4),
  ].slice(0, 5);

  const branchInfo = getBranchInfo(liunian.branch);
  const zodiacHan = zodiacAnimalHanFromBranch(liunian.branch);
  const zodiacSlug = zodiacHanToSlug(zodiacHan);
  const zodiacSoft =
    (zodiacSlug ? termOf(zodiacSlug, locale) : null) ??
    (normalizeMatrixLocale(locale) === "zh" ? zodiacHan : branchInfo?.zodiac_en ?? zodiacHan);
  const branchEl = branchInfo?.element ?? "";
  const branchElSlug = branchEl ? elementToSlug(branchEl) : null;
  const branchElSoft = branchEl ? matrixElementSoft(branchEl, locale) : "";

  /** When no 流年冲合刑害 hits, still show temperament signals (never a blank "not detected"). */
  const yearSignLinksFromRels = pickDistinct(liunianRels, locale, 2);
  const yearSignLinks: MatrixFactChip[] = [...yearSignLinksFromRels];
  if (yearSignLinks.length === 0) {
    const dmStem = (structured.day_master.charAt(0) ||
      structured.pillars_detail?.day.stem ||
      "") as HeavenlyStem;
    if (dmStem && liunian.stem) {
      try {
        const tg = calculateTenGod(dmStem, liunian.stem);
        if (tg) {
          const soft = matrixSoftTerm(tg, locale);
          if (soft) {
            yearSignLinks.push({
              soft,
              slug: pojuTermByTraditional(tg)?.slug ?? null,
              polarity: "green",
            });
          }
        }
      } catch {
        /* ignore */
      }
    }
    const natalBranch =
      structured.pillars_detail?.year.branch ||
      structured.four_pillars.year.trim().charAt(1) ||
      "";
    if (natalBranch) {
      const natalHan = zodiacAnimalHanFromBranch(natalBranch);
      const natalSlug = zodiacHanToSlug(natalHan);
      const natalSoft =
        (natalSlug ? termOf(natalSlug, locale) : null) ??
        (normalizeMatrixLocale(locale) === "zh"
          ? natalHan
          : getBranchInfo(natalBranch)?.zodiac_en ?? natalHan);
      // Prefer natal sign when it differs from the transit year animal (temperament contrast).
      if (
        natalSoft &&
        natalHan !== zodiacHan &&
        !yearSignLinks.some((c) => c.soft === natalSoft)
      ) {
        yearSignLinks.push({
          soft: natalSoft,
          slug: natalSlug,
          polarity: "gold",
        });
      }
    }
    if (yearSignLinks.length < 2 && transitStemElement) {
      const stemSoft = matrixElementSoft(transitStemElement, locale);
      if (stemSoft && !yearSignLinks.some((c) => c.soft === stemSoft)) {
        yearSignLinks.push({
          soft: stemSoft,
          slug: elementToSlug(transitStemElement),
          polarity: "neutral",
        });
      }
    }
    if (yearSignLinks.length < 2 && branchElSoft) {
      if (!yearSignLinks.some((c) => c.soft === branchElSoft)) {
        yearSignLinks.push({
          soft: branchElSoft,
          slug: branchElSlug,
          polarity: "neutral",
        });
      }
    }
  }

  const yongRaw = (structured.yong_shen || "").trim();
  const yongSoft = yongRaw ? matrixElementSoft(yongRaw, locale) || matrixSoftTerm(yongRaw, locale) : "";
  const yong_soft =
    yongSoft && !/[甲乙丙丁戊己庚辛壬癸格柱]/.test(yongSoft) ? yongSoft : null;
  const yong_slug = yongRaw
    ? elementToSlug(yongRaw) ?? matrixTermSlug(yongRaw) ?? "yong_shen"
    : null;

  const ya = structured.bazi_enrichment?.yongshen_analysis;
  const status_soft = ya
    ? strengthSoft(ya.status_strength, locale)
    : null;

  const firstDy = structured.da_yun[0];
  const onsetFromChart = parseOnsetAge(luckOnsetRaw ?? null);
  const onsetAge = onsetFromChart ?? firstDy?.start_age ?? null;
  const onsetDateRaw = luckOnsetDate ? stripGanzhiNoise(luckOnsetDate) : null;
  const onsetRawClean = luckOnsetRaw ? stripGanzhiNoise(luckOnsetRaw) : null;

  return {
    era: {
      theme: dayunTheme,
      age_range: dayunAgeRange,
      start_year: dayunStartYear,
      start_age: startAge,
      progress_pct: eraProgress,
      ten_god_soft,
      ten_god_slug,
      stem_element_soft,
      stem_element_slug,
    },
    year_pulse: {
      year: transitYear,
      stem_element_soft: matrixElementSoft(transitStemElement, locale),
      stem_element_slug: elementToSlug(transitStemElement),
      progress_pct: transitProgressPct,
      links: yearLinks,
    },
    structure: {
      bonds: [
        ...pickDistinct(natal, locale, 4, "green"),
        ...pickDistinct(natal, locale, 3, "gold"),
      ].slice(0, 5),
      tensions: pickDistinct(natal, locale, 5, "red"),
    },
    balance: {
      strength_soft: strengthSoft(structured.strength, locale),
      strength_slug: strengthToSlug(structured.strength),
      yong_soft,
      yong_slug: yong_soft ? yong_slug : null,
      status_soft,
      xi: elementListChips(structured.xi_shen ?? [], locale, 3, "green"),
      ji: elementListChips(structured.ji_shen ?? [], locale, 2, "red"),
    },
    year_sign: {
      year: transitYear,
      zodiac_han: zodiacHan,
      zodiac_slug: zodiacSlug,
      zodiac_soft: zodiacSoft,
      branch_element_soft: branchElSoft,
      branch_element_slug: branchElSlug,
      links: yearSignLinks.slice(0, 2),
    },
    shensha_highlights: collectShenshaHighlights(structured, locale, 6),
    luck_onset: {
      start_age: onsetAge,
      start_year: firstDy?.start_year ?? null,
      start_date: onsetDateRaw || null,
      raw_onset: onsetRawClean || null,
    },
  };
}
