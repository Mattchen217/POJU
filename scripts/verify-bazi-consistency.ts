/**
 * Temporary: compare shunshi-bazi-core vs lunar-typescript 四柱 (same true solar time).
 * Run: pnpm tsx scripts/verify-bazi-consistency.ts
 */
import { getBaziChart } from "shunshi-bazi-core";
import { Solar } from "lunar-typescript";

type CaseInput = {
  name: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  gender: 0 | 1;
  longitude: number;
  latitude: number;
  standardMeridian: number;
};

const CASES: CaseInput[] = [
  {
    name: "立春前(年柱)",
    year: 2024,
    month: 2,
    day: 3,
    hour: 12,
    minute: 0,
    gender: 1,
    longitude: 116.4,
    latitude: 39.9,
    standardMeridian: 120,
  },
  {
    name: "立春后(年柱)",
    year: 2024,
    month: 2,
    day: 5,
    hour: 12,
    minute: 0,
    gender: 1,
    longitude: 116.4,
    latitude: 39.9,
    standardMeridian: 120,
  },
  {
    name: "惊蛰前(月柱)",
    year: 2024,
    month: 3,
    day: 4,
    hour: 10,
    minute: 0,
    gender: 0,
    longitude: 116.4,
    latitude: 39.9,
    standardMeridian: 120,
  },
  {
    name: "惊蛰后(月柱)",
    year: 2024,
    month: 3,
    day: 6,
    hour: 10,
    minute: 0,
    gender: 0,
    longitude: 116.4,
    latitude: 39.9,
    standardMeridian: 120,
  },
  {
    name: "子时23:30(跨日)",
    year: 2024,
    month: 6,
    day: 15,
    hour: 23,
    minute: 30,
    gender: 1,
    longitude: 116.4,
    latitude: 39.9,
    standardMeridian: 120,
  },
  {
    name: "子时00:30",
    year: 2024,
    month: 6,
    day: 16,
    hour: 0,
    minute: 30,
    gender: 1,
    longitude: 116.4,
    latitude: 39.9,
    standardMeridian: 120,
  },
  {
    name: "闰二月2023",
    year: 2023,
    month: 4,
    day: 10,
    hour: 9,
    minute: 15,
    gender: 0,
    longitude: 116.4,
    latitude: 39.9,
    standardMeridian: 120,
  },
  {
    name: "1960s普通",
    year: 1968,
    month: 7,
    day: 15,
    hour: 14,
    minute: 30,
    gender: 1,
    longitude: 116.4,
    latitude: 39.9,
    standardMeridian: 120,
  },
  {
    name: "1990s广州",
    year: 1990,
    month: 3,
    day: 24,
    hour: 10,
    minute: 28,
    gender: 1,
    longitude: 113.2644,
    latitude: 23.1291,
    standardMeridian: 120,
  },
  {
    name: "2010s乌鲁木齐TST",
    year: 2015,
    month: 8,
    day: 20,
    hour: 12,
    minute: 0,
    gender: 1,
    longitude: 87.6,
    latitude: 43.8,
    standardMeridian: 120,
  },
];

function shunshiPillars(chart: ReturnType<typeof getBaziChart>): string {
  const d = chart.八字?.柱位详细;
  if (d) {
    return `${d.年柱?.干支} ${d.月柱?.干支} ${d.日柱?.干支} ${d.时柱?.干支}`;
  }
  return chart.八字?.四柱 ?? "? ? ? ?";
}

function parseTrueSolar(chart: ReturnType<typeof getBaziChart>): {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  source: string;
} {
  const tst = chart.真太阳时?.真太阳时;
  if (tst) {
    const [datePart, timePart] = tst.split(" ");
    const [y, m, d] = datePart.split("-").map(Number);
    const [h, min] = timePart.split(":").map(Number);
    return { y, m, d, h, min, source: tst };
  }
  const clock = chart.真太阳时?.钟表时间 ?? chart.输入?.公历 ?? "";
  const normalized = clock.replace(" ", "T");
  const [datePart, timePart = "00:00"] = normalized.includes("T")
    ? normalized.split("T")
    : clock.split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  return { y, m, d, h, min: min ?? 0, source: `${y}-${m}-${d} ${h}:${min} (clock, no TST block)` };
}

function lunarPillarsFromTst(tst: { y: number; m: number; d: number; h: number; min: number }): string {
  const solar = Solar.fromYmdHms(tst.y, tst.m, tst.d, tst.h, tst.min, 0);
  const ec = solar.getLunar().getEightChar();
  ec.setSect(1); // shunshi-bazi-core default: 23:00 → 次日日柱
  return `${ec.getYear()} ${ec.getMonth()} ${ec.getDay()} ${ec.getTime()}`;
}

function diffPillars(a: string, b: string): string {
  if (a === b) return "—";
  const pa = a.split(" ");
  const pb = b.split(" ");
  const labels = ["年", "月", "日", "时"];
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    if (pa[i] !== pb[i]) parts.push(`${labels[i]}:${pa[i]}→${pb[i]}`);
  }
  return parts.join("; ") || "format?";
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function main() {
  console.log("shunshi-bazi-core vs lunar-typescript — 四柱一致性验证");
  console.log("shunshi: 钟表时间 + useTrueSolarTime + longitude/standardMeridian");
  console.log("lunar:   shunshi 输出的真太阳时 + EightChar sect=1\n");

  const header = `| ${pad("case", 14)} | ${pad("shunshi 四柱", 22)} | ${pad("lunar 四柱", 22)} | ${pad("一致?", 5)} | 差异 |`;
  console.log(header);
  console.log("|" + "-".repeat(header.length - 2) + "|");

  let matchCount = 0;

  for (const c of CASES) {
    const chart = getBaziChart({
      year: c.year,
      month: c.month,
      day: c.day,
      hour: c.hour,
      minute: c.minute,
      gender: c.gender,
      longitude: c.longitude,
      latitude: c.latitude,
      standardMeridian: c.standardMeridian,
      useTrueSolarTime: true,
      sect: 1,
    });

    const shunshi = shunshiPillars(chart);
    const tst = parseTrueSolar(chart);
    const lunar = lunarPillarsFromTst(tst);
    const ok = shunshi === lunar;
    if (ok) matchCount++;

    const clock = `${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")} ${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`;
    const tstNote = chart.真太阳时
      ? `TST=${tst.source} (Δ${chart.真太阳时.修正分钟}min)`
      : "no TST block";

    console.log(
      `| ${pad(c.name, 14)} | ${pad(shunshi, 22)} | ${pad(lunar, 22)} | ${pad(ok ? "✓" : "✗", 5)} | ${diffPillars(shunshi, lunar)} |`,
    );
    console.log(`| ${"".padEnd(14)} | clock: ${clock} | ${tstNote}`);
  }

  console.log(`\nSummary: ${matchCount}/${CASES.length} cases match`);
}

main();
