/**
 * Atmos engine snapshot — deterministic local compute
 *
 *   pnpm exec tsx scripts/test-atmos-engine.ts
 */
import { activateLiuriShenSha } from "@/lib/calculations/atmos-liuri-shensha";
import { assessAtmosEnergy } from "@/lib/calculations/atmos-energy-weighting";
import type { ProfileStructured, ProfileStrength } from "@/lib/calculations/build-profile-structured";
import type { DaYunEntry } from "@/lib/calculations/lunar-dayun";
import {
  computeLiuriRelations,
  type RelationLabel,
} from "@/lib/calculations/relation-engine";
import {
  buildAtmosEngineSnapshot,
  serializeAtmosSnapshot,
} from "@/lib/atmos/build-atmos-engine-snapshot";
import { zonedLocalToUtc } from "@/lib/syncro/true-solar-time";

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function makeProfile(
  four: { year: string; month: string; day: string; hour: string },
  opts?: {
    strength?: ProfileStrength;
    yong?: string;
    xi?: string[];
    ji?: string[];
    daYun?: DaYunEntry[];
  },
): ProfileStructured {
  const pillar = (gz: string) => ({
    ganzhi: gz,
    stem: gz.charAt(0),
    branch: gz.charAt(1),
    ten_god: "",
    hidden_stems: [] as string[],
    shen_sha: [] as string[],
  });
  return {
    day_master: four.day.charAt(0),
    pattern: "",
    yong_shen: opts?.yong ?? "水",
    xi_shen: opts?.xi ?? ["水", "金"],
    ji_shen: opts?.ji ?? ["火"],
    strength: opts?.strength ?? "weak",
    four_pillars: four,
    pillars_detail: {
      year: pillar(four.year),
      month: pillar(four.month),
      day: pillar(four.day),
      hour: pillar(four.hour),
    },
    da_yun: opts?.daYun ?? [
      { start_age: 1, start_year: 2010, ganzhi: "甲午" },
      { start_age: 11, start_year: 2020, ganzhi: "乙未" },
    ],
    data_availability: {
      pillars_detail: true,
      da_yun: true,
      bazi_enrichment: false,
    },
  };
}

console.log("\n=== atmos engine snapshot ===\n");

const profile = makeProfile(
  { year: "甲子", month: "丙寅", day: "戊午", hour: "壬子" },
  { yong: "水", xi: ["水", "金"], ji: ["火"], strength: "weak" },
);

const asOf = zonedLocalToUtc(
  { year: 2026, month: 7, day: 24, hour: 10, minute: 0, second: 0 },
  "UTC",
);

const snap1 = buildAtmosEngineSnapshot({
  structured: profile,
  date: asOf,
  timezone: "UTC",
});
const snap2 = buildAtmosEngineSnapshot({
  structured: profile,
  date: asOf,
  timezone: "UTC",
});

assert(
  "snapshot stable across two builds",
  serializeAtmosSnapshot(snap1) === serializeAtmosSnapshot(snap2),
);
assert("schemaVersion", snap1.schemaVersion === 1);
assert("dayBoundaryPolicy", snap1.asOf.dayBoundaryPolicy === "zi_2300_local");
assert("dayunIndex current (2020+)", snap1.cycles.dayunIndex === 1);
assert("dayun ganzhi", snap1.cycles.dayun?.ganzhi === "乙未");
assert("yongshenSource tag", snap1.yongshenSource === "heuristic_wuxing_scores");

// 子时边界 → 不同 baziDayDate / liuri
const beforeZi = buildAtmosEngineSnapshot({
  structured: profile,
  date: zonedLocalToUtc(
    { year: 2026, month: 7, day: 24, hour: 22, minute: 59, second: 0 },
    "UTC",
  ),
  timezone: "UTC",
});
const afterZi = buildAtmosEngineSnapshot({
  structured: profile,
  date: zonedLocalToUtc(
    { year: 2026, month: 7, day: 24, hour: 23, minute: 0, second: 0 },
    "UTC",
  ),
  timezone: "UTC",
});
assert(
  "zi boundary changes baziDayDate",
  beforeZi.asOf.baziDayDate !== afterZi.asOf.baziDayDate,
  `${beforeZi.asOf.baziDayDate} vs ${afterZi.asOf.baziDayDate}`,
);
assert(
  "zi boundary changes liuri",
  beforeZi.cycles.liuri.ganzhi !== afterZi.cycles.liuri.ganzhi,
  `${beforeZi.cycles.liuri.ganzhi} vs ${afterZi.cycles.liuri.ganzhi}`,
);

// 流日冲日支 → focusSignals 含 DayBranch_Clash
// 日支午 → 流日子 冲
const clashProfile = makeProfile({
  year: "甲寅",
  month: "乙卯",
  day: "丙午",
  hour: "丁巳",
});
const liuriChong = { stem: "甲" as const, branch: "子" as const, ganzhi: "甲子" };
const clashRels = computeLiuriRelations(clashProfile, liuriChong);
assert(
  "liuri chong day branch present",
  clashRels.some((r) => r.kind === "chong" && r.positions.includes("day")),
);
const energyClash = assessAtmosEnergy(clashRels, "neutral");
assert(
  "focusSignals includes DayBranch_Clash",
  energyClash.focusSignals.some((s) => s.cueCode === "DayBranch_Clash"),
);

// 权重压制：伪造高压 climate（大运+流年大量 red）
const pressured: RelationLabel[] = [
  {
    id: "dayun_chong_x",
    han: "test",
    kind: "chong",
    source: "dayun",
    positions: ["dayun", "day"],
    palaces: ["spouse"],
    polarity: "red",
  },
  {
    id: "liunian_chong_y",
    han: "test",
    kind: "chong",
    source: "liunian",
    positions: ["liunian", "month"],
    palaces: ["career"],
    polarity: "red",
  },
  {
    id: "liuri_liuhe_z",
    han: "test",
    kind: "liuhe",
    source: "liuri",
    positions: ["liuri", "year"],
    palaces: ["root"],
    polarity: "green",
  },
];
const weighted = assessAtmosEnergy(pressured, "helps");
assert("climate pressured under heavy red", weighted.climateTone === "pressured");
assert(
  "override blocks sprint even if day helps",
  weighted.overrideRule.blockSprintNarrative === true &&
    weighted.overrideRule.reasonCode === "climate_pressured",
);

// 神煞：甲日主 → 天乙在丑/未；文昌在巳；驿马看年支子 → 寅
const shenProfile = makeProfile({
  year: "甲子",
  month: "丙寅",
  day: "甲辰",
  hour: "戊辰",
});
const tianYi = activateLiuriShenSha(shenProfile, {
  stem: "乙",
  branch: "丑",
  ganzhi: "乙丑",
});
assert(
  "天乙贵人 on 丑",
  tianYi.some((s) => s.han === "天乙贵人" && s.cueCode === "ask_help"),
);
const wenChang = activateLiuriShenSha(shenProfile, {
  stem: "丙",
  branch: "巳",
  ganzhi: "丙巳",
});
assert(
  "文昌 on 巳",
  wenChang.some((s) => s.han === "文昌" && s.cueCode === "deep_work"),
);
const yiMa = activateLiuriShenSha(shenProfile, {
  stem: "丁",
  branch: "寅",
  ganzhi: "丁寅",
});
assert(
  "驿马 on 寅 (year 子)",
  yiMa.some((s) => s.han === "驿马" && s.cueCode === "movement"),
);

console.log("\nSample snapshot cycles:", JSON.stringify(snap1.cycles, null, 2));
console.log("Energy:", JSON.stringify(snap1.energy, null, 2));
console.log("");
