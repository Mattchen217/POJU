/**
 * Local fact cards for the matrix lifecycle right column.
 * Replaces prose templates (RESONANCE / TENSION / READING / annual narrative).
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { getCurrentLiunian } from "@/lib/calculations/liunian";
import {
  computeLiunianRelations,
  computeNatalChartRelations,
  type Palace,
  type RelationKind,
  type RelationLabel,
} from "@/lib/calculations/relation-engine";
import {
  calculateTenGod,
  type HeavenlyStem,
} from "@/lib/match/data/stems-branches";
import { getStemInfo } from "@/lib/poju/bazi-matrix-mappings";
import {
  matrixElementSoft,
  matrixSoftTerm,
} from "@/lib/poju/matrix-term-labels";
import { termOf } from "@/lib/glossary/pojulife-terms";

export type MatrixFactChip = {
  soft: string;
  polarity: "green" | "red" | "gold" | "neutral";
};

export type MatrixFactPanel = {
  era: {
    theme: string;
    age_range: string;
    start_year: number;
    ten_god_soft: string | null;
    stem_element_soft: string | null;
  };
  year_pulse: {
    year: number;
    stem_element_soft: string;
    progress_pct: number;
    links: MatrixFactChip[];
  };
  structure: {
    bonds: MatrixFactChip[];
    tensions: MatrixFactChip[];
  };
  balance: {
    strength_soft: string;
    yong_soft: string | null;
    xi_softs: string[];
    ji_softs: string[];
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

function elementListSoft(items: string[], locale: string, limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const soft = matrixSoftTerm(raw, locale) || matrixElementSoft(raw, locale);
    if (!soft || seen.has(soft)) continue;
    // Skip if still looks like bare traditional stem/element jargon without soft map
    if (soft === raw && /[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥格]/.test(raw)) {
      continue;
    }
    seen.add(soft);
    out.push(soft);
    if (out.length >= limit) break;
  }
  return out;
}

export function buildMatrixFactPanel(input: {
  structured: ProfileStructured;
  dayunIndex: number;
  dayunTheme: string;
  dayunAgeRange: string;
  dayunStartYear: number;
  transitYear: number;
  transitProgressPct: number;
  transitStemElement: string;
  locale: string;
}): MatrixFactPanel {
  const {
    structured,
    dayunIndex,
    dayunTheme,
    dayunAgeRange,
    dayunStartYear,
    transitYear,
    transitProgressPct,
    transitStemElement,
    locale,
  } = input;

  const currentDy = structured.da_yun[dayunIndex];
  let ten_god_soft: string | null = null;
  let stem_element_soft: string | null = null;
  if (currentDy?.ganzhi) {
    const dyStem = currentDy.ganzhi.charAt(0) as HeavenlyStem;
    const dmStem = (structured.day_master.charAt(0) ||
      structured.pillars_detail?.day.stem ||
      "") as HeavenlyStem;
    const stemInfo = getStemInfo(dyStem);
    stem_element_soft = stemInfo?.element
      ? matrixElementSoft(stemInfo.element, locale)
      : null;
    if (dmStem && dyStem) {
      try {
        const tg = calculateTenGod(dmStem, dyStem);
        ten_god_soft = tg ? matrixSoftTerm(tg, locale) : null;
      } catch {
        ten_god_soft = null;
      }
    }
  }

  const natal = computeNatalChartRelations(structured);
  const liunian = getCurrentLiunian();
  const liunianRels = computeLiunianRelations(structured, liunian);

  const yongRaw = (structured.yong_shen || "").trim();
  const yongSoft = yongRaw ? matrixElementSoft(yongRaw, locale) || matrixSoftTerm(yongRaw, locale) : "";
  const yong_soft =
    yongSoft && !/[甲乙丙丁戊己庚辛壬癸格柱]/.test(yongSoft) ? yongSoft : null;

  return {
    era: {
      theme: dayunTheme,
      age_range: dayunAgeRange,
      start_year: dayunStartYear,
      ten_god_soft,
      stem_element_soft,
    },
    year_pulse: {
      year: transitYear,
      stem_element_soft: matrixElementSoft(transitStemElement, locale),
      progress_pct: transitProgressPct,
      links: pickDistinct(liunianRels, locale, 3),
    },
    structure: {
      bonds: [
        ...pickDistinct(natal, locale, 3, "green"),
        ...pickDistinct(natal, locale, 2, "gold"),
      ].slice(0, 3),
      tensions: pickDistinct(natal, locale, 3, "red"),
    },
    balance: {
      strength_soft: strengthSoft(structured.strength, locale),
      yong_soft,
      xi_softs: elementListSoft(structured.xi_shen ?? [], locale, 3),
      ji_softs: elementListSoft(structured.ji_shen ?? [], locale, 2),
    },
  };
}
