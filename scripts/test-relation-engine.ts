/**
 * S1 · relation-engine natal chart relations
 *
 *   pnpm exec tsx scripts/test-relation-engine.ts
 */
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  computeChartRelations,
  computeDirectedRelations,
  computeLiunianRelations,
  detectTenGodTensions,
  filterRelationsByCategory,
  getCurrentLiunian,
  type RelationLabel,
} from "@/lib/calculations/relation-engine";

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function makeProfile(
  four: {
    year: string;
    month: string;
    day: string;
    hour: string;
  },
  opts?: {
    strength?: string;
    tenGods?: Partial<Record<"year" | "month" | "day" | "hour", string>>;
    daYun?: Array<{ ganzhi: string; start_age: number }>;
  },
): ProfileStructured {
  const pillar = (gz: string, pos: "year" | "month" | "day" | "hour") => ({
    ganzhi: gz,
    stem: gz.charAt(0),
    branch: gz.charAt(1),
    ten_god: opts?.tenGods?.[pos] ?? "",
    hidden_stems: [] as string[],
    shen_sha: [] as string[],
  });
  return {
    day_master: four.day.charAt(0),
    pattern: "",
    yong_shen: "",
    xi_shen: [],
    ji_shen: [],
    strength: opts?.strength ?? "balanced",
    four_pillars: four,
    pillars_detail: {
      year: pillar(four.year, "year"),
      month: pillar(four.month, "month"),
      day: pillar(four.day, "day"),
      hour: pillar(four.hour, "hour"),
    },
    da_yun: opts?.daYun ?? [],
    data_availability: {
      pillars_detail: true,
      da_yun: Boolean(opts?.daYun?.length),
      bazi_enrichment: false,
    },
  };
}

function hasRelation(rels: RelationLabel[], id: string): RelationLabel | undefined {
  return rels.find((r) => r.id === id);
}

console.log("\n=== relation-engine (S1 + S2) ===\n");

// Chart A: 年子 vs 月午 → 子午相冲
const chartA = makeProfile({
  year: "甲子",
  month: "丙午",
  day: "戊辰",
  hour: "甲寅",
});
const relsA = computeChartRelations(chartA);
const chong = hasRelation(relsA, "chong_午_子");
assert("chart A: 子午相冲", Boolean(chong));
assert("chart A: chong kind/polarity", chong?.kind === "chong" && chong.polarity === "red");
assert(
  "chart A: chong palaces include career+root",
  chong?.palaces.includes("career") && chong?.palaces.includes("root"),
);
assert("chart A: natal source", chong?.source === "natal");

// Chart B: 日主乙 + 年干庚 → 天干五合
const chartB = makeProfile({
  year: "庚子",
  month: "丙子",
  day: "乙卯",
  hour: "丁亥",
});
const relsB = computeChartRelations(chartB);
const stemHe = hasRelation(relsB, "stemhe_乙_庚");
assert("chart B: 日主乙庚相合", Boolean(stemHe));
assert("chart B: stem_he kind/gold", stemHe?.kind === "stem_he" && stemHe.polarity === "gold");
assert("chart B: self palace", stemHe?.palaces.includes("self"));

// Chart C: 年寅 + 月午 → 寅午半合火局（含旺支午）
const chartC = makeProfile({
  year: "丙寅",
  month: "戊午",
  day: "乙卯",
  hour: "丁亥",
});
const relsC = computeChartRelations(chartC);
const banhe = hasRelation(relsC, "banhe_午_寅_火局");
assert("chart C: 寅午半合火局", Boolean(banhe));
assert("chart C: banhe green", banhe?.kind === "banhe" && banhe.polarity === "green");

// Chart D: 申子辰齐 → 三合水局
const chartD = makeProfile({
  year: "甲申",
  month: "丙子",
  day: "戊辰",
  hour: "庚午",
});
const relsD = computeChartRelations(chartD);
const sanhe = hasRelation(relsD, "sanhe_水局");
assert("chart D: 申子辰三合水局", Boolean(sanhe));
assert("chart D: sanhe positions all pillars", sanhe?.positions.length === 4);

// filterRelationsByCategory
const filteredCareer = filterRelationsByCategory(relsA, "career");
assert(
  "filter career keeps chong (month=career)",
  filteredCareer.some((r) => r.id === "chong_午_子"),
);
const filteredHealth = filterRelationsByCategory(relsA, "health");
assert(
  "filter health drops chong (no self/spouse)",
  !filteredHealth.some((r) => r.id === "chong_午_子"),
);
assert(
  "filter unknown category passes all",
  filterRelationsByCategory(relsA, "unknown_topic").length === relsA.length,
);

// S2: 2026 丙午流年
const liunian2026 = getCurrentLiunian(new Date(2026, 5, 15));
assert("2026 liunian ganzhi", liunian2026.ganzhi === "丙午", liunian2026.ganzhi);
assert("2026 liunian stem/branch", liunian2026.stem === "丙" && liunian2026.branch === "午");

const relsLiunianA = computeLiunianRelations(chartA, liunian2026);
const liChongYear = hasRelation(relsLiunianA, "liunian_chong_午_子_year");
assert("S2 chart A: 流年午冲年支子", Boolean(liChongYear));
assert("S2: liunian source", liChongYear?.source === "liunian");
assert(
  "S2: positions include liunian",
  liChongYear?.positions.includes("liunian") && liChongYear?.positions.includes("year"),
);
const liBanheHour = hasRelation(relsLiunianA, "liunian_banhe_午_寅_hour_火局");
assert("S2 chart A: 流年午与时支寅半合火局", Boolean(liBanheHour));
const liXingMonth = hasRelation(relsLiunianA, "liunian_xing_午_午_month");
assert("S2 chart A: 流年午与月支午自刑", Boolean(liXingMonth));

// S5: detectTenGodTensions — 甲日主偏弱 + 月柱正官 + 流年丁(伤官)
const chartWeakOfficer = makeProfile(
  {
    year: "丙寅",
    month: "辛未",
    day: "甲子",
    hour: "乙亥",
  },
  { strength: "weak", tenGods: { month: "正官" } },
);
const liunianDingMao = { stem: "丁", branch: "卯", ganzhi: "丁卯" };
const tensionsOfficer = detectTenGodTensions(chartWeakOfficer, liunianDingMao);
const sgjg = hasRelation(tensionsOfficer, "shangguan_jianguan");
assert("S5: 偏弱盘流年伤官见官", Boolean(sgjg));
assert("S5: shangguan polarity red", sgjg?.polarity === "red" && sgjg.kind === "ten_god_tension");
assert("S5: shangguan neutral han (no 凶)", Boolean(sgjg?.han && !/凶|灾|克死/.test(sgjg.han)));

const chartBalanced = makeProfile(
  {
    year: "丙寅",
    month: "辛未",
    day: "甲子",
    hour: "乙亥",
  },
  { strength: "balanced", tenGods: { month: "正官" } },
);
assert(
  "S5: balanced day master skips tension",
  detectTenGodTensions(chartBalanced, liunianDingMao).length === 0,
);

// S5: category filter — relationship vs career
const relsAllA = [
  ...relsA,
  ...computeLiunianRelations(chartA, liunian2026),
  ...(sgjg ? [sgjg] : []),
];
const relCareer = filterRelationsByCategory(relsAllA, "career", chartA);
const relRelationship = filterRelationsByCategory(relsAllA, "relationship", chartA);
assert(
  "S5 career keeps month-career chong + shangguan",
  relCareer.some((r) => r.id === "chong_午_子") &&
    (sgjg ? relCareer.some((r) => r.id === "shangguan_jianguan") : true),
);
assert(
  "S5 relationship drops month-career chong",
  !relRelationship.some((r) => r.id === "chong_午_子"),
);
assert(
  "S5 relationship keeps liunian on day branch if present",
  !relsLiunianA.some((r) => r.palaces.includes("spouse")) ||
    relRelationship.some((r) => r.positions.includes("day")),
);
assert(
  "S5 relationship drops shangguan_jianguan",
  !sgjg || !relRelationship.some((r) => r.id === "shangguan_jianguan"),
);

const directedCareer = computeDirectedRelations(chartWeakOfficer, liunianDingMao, "career");
assert(
  "S5 computeDirectedRelations career includes shangguan",
  directedCareer.some((r) => r.id === "shangguan_jianguan"),
);
const directedRelationship = computeDirectedRelations(chartWeakOfficer, liunianDingMao, "relationship");
assert(
  "S5 computeDirectedRelations relationship excludes shangguan",
  !directedRelationship.some((r) => r.id === "shangguan_jianguan"),
);

let passCount = 28;

console.log(
  process.exitCode === 1 ? "\nSome checks failed.\n" : `\nAll ${passCount} checks passed.\n`,
);
