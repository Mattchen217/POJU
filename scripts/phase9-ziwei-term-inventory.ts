/**
 * Phase 9 · Ziwei term completeness inventory (read-only).
 * Engine: iztro@package.json + buildZiweiFactPack surface.
 * Does NOT mutate POJU_TERMS.
 *
 * Run: node ./node_modules/tsx/dist/cli.mjs scripts/phase9-ziwei-term-inventory.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { astro } from "iztro";
import { version as iztroVersion } from "iztro/package.json";
import type { BirthInfo } from "../lib/profile/types";
import { birthInfoToIztroArgs } from "../lib/ziwei/birth-clock";
import { buildZiweiFactPack } from "../lib/ziwei/fact-pack";
import {
  ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS,
  ZIWEI_RUNTIME_PALACES,
  ZIWEI_RUNTIME_STARS,
  ziweiTokenDisposition,
} from "../lib/ziwei/token-disposition";
import { resolvePojuTerm } from "../lib/glossary/term-resolve";
import { POJU_TERMS } from "../lib/glossary/pojulife-terms";

const AS_OF = "2026-10-30";

const BIRTHS: BirthInfo[] = [
  { year: 2000, month: 8, day: 16, hour: 4, minute: 30, hour_period: "yin", gender: "F", timezone: "Asia/Shanghai" },
  { year: 1990, month: 1, day: 1, hour: 0, minute: 0, hour_period: "zi_early", gender: "M", timezone: "America/New_York" },
  { year: 1985, month: 6, day: 15, hour: 12, minute: 0, hour_period: "wu", gender: "F", timezone: "America/Los_Angeles" },
  { year: 1975, month: 12, day: 31, hour: 23, minute: 50, hour_period: "zi_late", gender: "M", timezone: "America/Chicago" },
  { year: 2005, month: 3, day: 8, hour: 8, minute: 0, hour_period: "chen", gender: "F", timezone: "Europe/London" },
  { year: 1968, month: 9, day: 22, hour: 18, minute: 20, hour_period: "you", gender: "M", timezone: "Asia/Tokyo" },
  { year: 1995, month: 2, day: 14, hour: 6, minute: 45, hour_period: "mao", gender: "F", timezone: "America/Toronto" },
  { year: 1988, month: 11, day: 11, hour: 22, minute: 10, hour_period: "hai", gender: "M", timezone: "Asia/Hong_Kong" },
  { year: 1955, month: 4, day: 20, hour: 10, minute: 5, hour_period: "si", gender: "M", timezone: "Europe/Paris" },
  { year: 2001, month: 5, day: 5, hour: 16, minute: 40, hour_period: "shen", gender: "F", timezone: "America/Denver" },
  { year: 1972, month: 7, day: 4, hour: 14, minute: 15, hour_period: "wei", gender: "M", timezone: "America/Sao_Paulo" },
  { year: 1999, month: 10, day: 31, hour: 3, minute: 0, hour_period: "chou", gender: "F", timezone: "Asia/Shanghai" },
];

type Bucket = Set<string>;
const sorted = (s: Set<string>) => [...s].filter(Boolean).sort((a, b) => a.localeCompare(b, "zh"));

const factPack = {
  palaces: new Set<string>() as Bucket,
  majorStars: new Set<string>() as Bucket,
  soulBody: new Set<string>() as Bucket,
  sihuaStars: new Set<string>() as Bucket,
  mutagens: new Set<string>() as Bucket,
  fiveElements: new Set<string>() as Bucket,
  patternNames: new Set<string>() as Bucket,
  stems: new Set<string>() as Bucket,
  branches: new Set<string>() as Bucket,
  shenPalace: new Set<string>() as Bucket,
  daxianPalace: new Set<string>() as Bucket,
  liunianPalace: new Set<string>() as Bucket,
};

const engineOnly = {
  minorStars: new Set<string>() as Bucket,
  adjectiveStars: new Set<string>() as Bucket,
  boshi12: new Set<string>() as Bucket,
  changsheng12: new Set<string>() as Bucket,
  jiangqian12: new Set<string>() as Bucket,
  suiqian12: new Set<string>() as Bucket,
};

for (const birth of BIRTHS) {
  const pack = buildZiweiFactPack(birth, { asOf: AS_OF });
  for (const p of pack.palaces) {
    factPack.palaces.add(p.name);
    for (const s of p.majorStars) factPack.majorStars.add(s);
    factPack.stems.add(p.heavenlyStem);
    factPack.branches.add(p.earthlyBranch);
  }
  factPack.soulBody.add(pack.mingShen.soul);
  factPack.soulBody.add(pack.mingShen.body);
  factPack.fiveElements.add(pack.mingShen.fiveElementsClass);
  factPack.shenPalace.add(pack.mingShen.shenPalace);
  factPack.branches.add(pack.mingShen.mingBranch);
  factPack.branches.add(pack.mingShen.shenBranch);
  factPack.daxianPalace.add(pack.daxian.palace);
  factPack.liunianPalace.add(pack.daxian.liunian.palace);
  for (const s of [
    ...pack.topicPalace.majorStars,
    ...pack.topicPalace.oppositeMajorStars,
    ...pack.daxian.majorStars,
  ]) {
    factPack.majorStars.add(s);
  }
  for (const h of [...pack.sihua, ...pack.daxian.sihua, ...pack.daxian.liunian.sihua]) {
    factPack.mutagens.add(h.mutagen);
    factPack.sihuaStars.add(h.star);
    factPack.palaces.add(h.palace);
  }
  for (const h of pack.patternHits) factPack.patternNames.add(h.name);

  const args = birthInfoToIztroArgs(birth);
  const chart = astro.bySolar(args.solarDate, args.timeIndex, args.gender, true, "zh-CN");
  for (const p of chart.palaces as Array<{
    minorStars?: { name?: string }[];
    adjectiveStars?: { name?: string }[];
    boshi12?: string;
    changsheng12?: string;
    jiangqian12?: string;
    suiqian12?: string;
  }>) {
    for (const s of p.minorStars ?? []) if (s.name) engineOnly.minorStars.add(s.name);
    for (const s of p.adjectiveStars ?? []) if (s.name) engineOnly.adjectiveStars.add(s.name);
    if (p.boshi12) engineOnly.boshi12.add(p.boshi12);
    if (p.changsheng12) engineOnly.changsheng12.add(p.changsheng12);
    if (p.jiangqian12) engineOnly.jiangqian12.add(p.jiangqian12);
    if (p.suiqian12) engineOnly.suiqian12.add(p.suiqian12);
  }
}

const ziweiSsot = POJU_TERMS.filter((t) => t.ns === "ziwei").map((t) => ({
  slug: t.slug,
  traditional: t.traditional,
  aliases: t.aliases ?? [],
}));

const ssotTraditional = new Set(
  ziweiSsot.flatMap((t) => [t.traditional, ...(t.aliases ?? [])]),
);

type RowStatus = {
  traditional: string;
  category: string;
  inFactPack: boolean;
  disposition: string;
  ssotMapped: boolean;
  resolveStatus: string;
};

function row(traditional: string, category: string, inFactPack: boolean): RowStatus {
  const disp = ziweiTokenDisposition(traditional);
  const resolved = resolvePojuTerm(traditional, { namespace: "ziwei" });
  return {
    traditional,
    category,
    inFactPack,
    disposition:
      disp.status === "internal_only"
        ? `internal_only:${disp.reasonCode}`
        : disp.status === "public_glossary"
          ? "public_glossary"
          : `unknown_blocked:${disp.reasonCode}`,
    ssotMapped: ssotTraditional.has(traditional) || resolved.status === "resolved",
    resolveStatus: resolved.status,
  };
}

const matrix: RowStatus[] = [
  ...sorted(factPack.palaces).map((t) => row(t, "palace", true)),
  ...sorted(factPack.majorStars).map((t) => row(t, "major_star", true)),
  ...sorted(factPack.soulBody).map((t) => row(t, "soul_body_star", true)),
  ...sorted(factPack.sihuaStars).map((t) => row(t, "sihua_star", true)),
  ...sorted(factPack.mutagens).map((t) => row(t, "mutagen", true)),
  ...["化禄", "化权", "化科", "化忌", "四化", "大限", "流年", "命主", "身主", "身宫", "对宫", "十二宫", "五行局", "命宫"].map(
    (t) => row(t, "structure_label", true),
  ),
  ...sorted(factPack.fiveElements).map((t) => row(t, "five_elements_class_value", true)),
  ...sorted(factPack.patternNames).map((t) => row(t, "pattern_hit", true)),
  ...sorted(engineOnly.minorStars).map((t) =>
    row(t, "engine_minor_star", factPack.sihuaStars.has(t) || factPack.soulBody.has(t)),
  ),
  ...sorted(engineOnly.adjectiveStars).map((t) => row(t, "engine_adjective_star", false)),
];

const sihuaOnlyNotMajor = sorted(factPack.sihuaStars).filter((s) => !factPack.majorStars.has(s));

const out = {
  meta: {
    phase: 9,
    iztroVersion,
    births: BIRTHS.length,
    asOf: AS_OF,
    ziweiSsotCount: ziweiSsot.length,
    note: "Inventory only — do not merge into POJU_TERMS",
  },
  factPackTokens: {
    palaces: sorted(factPack.palaces),
    majorStars: sorted(factPack.majorStars),
    soulBodyStars: sorted(factPack.soulBody),
    sihuaStars: sorted(factPack.sihuaStars),
    sihuaStarsNotInMajorStarsList: sihuaOnlyNotMajor,
    mutagens: sorted(factPack.mutagens),
    fiveElementsClass: sorted(factPack.fiveElements),
    shenPalace: sorted(factPack.shenPalace),
    daxianPalace: sorted(factPack.daxianPalace),
    liunianPalace: sorted(factPack.liunianPalace),
    patternHitCount: factPack.patternNames.size,
    patternHits: sorted(factPack.patternNames),
    stems: sorted(factPack.stems),
    branches: sorted(factPack.branches),
  },
  dispositionTables: {
    ZIWEI_RUNTIME_PALACES,
    ZIWEI_RUNTIME_STARS,
    ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS,
  },
  engineExtrasNotInPalaceMajorProjection: {
    minorStars: sorted(engineOnly.minorStars),
    adjectiveStars: sorted(engineOnly.adjectiveStars),
    boshi12: sorted(engineOnly.boshi12),
    changsheng12: sorted(engineOnly.changsheng12),
    jiangqian12: sorted(engineOnly.jiangqian12),
    suiqian12: sorted(engineOnly.suiqian12),
  },
  ziweiSsot,
  matrix,
};

const jsonPath = join(process.cwd(), ".cursor", "docs", "terms-phase9-ziwei-inventory.json");
writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
console.log("wrote", jsonPath);
console.log(
  JSON.stringify(
    {
      iztro: iztroVersion,
      palaces: out.factPackTokens.palaces.length,
      majorStars: out.factPackTokens.majorStars.length,
      sihuaStars: out.factPackTokens.sihuaStars.length,
      sihuaOnlyAux: sihuaOnlyNotMajor,
      fiveElements: out.factPackTokens.fiveElementsClass,
      patternHits: out.factPackTokens.patternHitCount,
      minorEngine: out.engineExtrasNotInPalaceMajorProjection.minorStars.length,
      adjectiveEngine: out.engineExtrasNotInPalaceMajorProjection.adjectiveStars.length,
      ssotZiwei: ziweiSsot.length,
    },
    null,
    2,
  ),
);
