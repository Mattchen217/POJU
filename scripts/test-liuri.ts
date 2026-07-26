/**
 * liuri / liuyue + 子时换日边界
 *
 *   pnpm exec tsx scripts/test-liuri.ts
 */
import {
  addOneCalendarDay,
  getLiuriAndLiuyue,
  getLiuriGanzhi,
  resolveBaziDayYmd,
} from "@/lib/calculations/liuri";
import { zonedLocalToUtc } from "@/lib/syncro/true-solar-time";

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

console.log("\n=== liuri / zi day boundary ===\n");

assert(
  "addOneCalendarDay month roll",
  addOneCalendarDay({ year: 2026, month: 1, day: 31 }).day === 1 &&
    addOneCalendarDay({ year: 2026, month: 1, day: 31 }).month === 2,
);

assert(
  "22:xx keeps civil day",
  resolveBaziDayYmd({ year: 2026, month: 7, day: 24 }, 22).day === 24,
);

assert(
  "23:00 rolls to next civil day",
  resolveBaziDayYmd({ year: 2026, month: 7, day: 24 }, 23).day === 25 &&
    resolveBaziDayYmd({ year: 2026, month: 7, day: 24 }, 23).month === 7,
);

assert(
  "23:30 rolls to next civil day",
  resolveBaziDayYmd({ year: 2026, month: 7, day: 24 }, 23).day === 25,
);

const before = resolveBaziDayYmd({ year: 2026, month: 7, day: 24 }, 22);
const after = resolveBaziDayYmd({ year: 2026, month: 7, day: 24 }, 23);
const solarBefore = getLiuriGanzhi(
  zonedLocalToUtc(
    {
      year: before.year,
      month: before.month,
      day: before.day,
      hour: 22,
      minute: 59,
      second: 0,
    },
    "UTC",
  ),
  "UTC",
);
const solarAfter = getLiuriGanzhi(
  zonedLocalToUtc(
    {
      year: 2026,
      month: 7,
      day: 24,
      hour: 23,
      minute: 0,
      second: 0,
    },
    "UTC",
  ),
  "UTC",
);

assert(
  "22:59 vs 23:00 → different 流日干支",
  solarBefore.ganzhi !== solarAfter.ganzhi,
  `${solarBefore.ganzhi} vs ${solarAfter.ganzhi}`,
);

const both = getLiuriAndLiuyue(
  zonedLocalToUtc(
    { year: 2026, month: 7, day: 24, hour: 10, minute: 0, second: 0 },
    "America/New_York",
  ),
  "America/New_York",
);
assert("liuri shape", Boolean(both.liuri.stem && both.liuri.branch && both.liuri.ganzhi.length === 2));
assert("liuyue shape", Boolean(both.liuyue.stem && both.liuyue.branch && both.liuyue.ganzhi.length === 2));
assert("policy tag", both.context.dayBoundaryPolicy === "zi_2300_local");

console.log("");
