/**
 * Phase 9 · Ziwei term completeness on user-delivery exits.
 * Ensures FactPack tokens that can reach UI / closed-set / companion / fill anchors
 * have disposition or SSOT mapping — no traditional-name fallback.
 *
 * Run: pnpm test:ziwei-term-completeness
 * Does NOT mutate POJU_TERMS.
 */
import assert from "node:assert/strict";
import type { BirthInfo } from "../lib/profile/types";
import { pageSliceAnchorLines } from "../lib/llm/pro/delivery/slice-for-page";
import { resolvePojuTerm } from "../lib/glossary/term-resolve";
import {
  baselineZiweiLensLines,
  buildZiweiDisplayFactPack,
  buildZiweiFactPack,
  collectZiweiTraditionalSuspects,
  formatZiweiClosedSetForPrompt,
  ziweiCompanionTriggerAnchors,
  ziweiDisplayContainsTraditionalLeak,
  ziweiTokenDisposition,
  ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS,
  ZIWEI_RUNTIME_PALACES,
  ZIWEI_RUNTIME_STARS,
} from "../lib/ziwei";

const AS_OF = "2026-10-30";

const BIRTHS: BirthInfo[] = [
  { year: 2000, month: 8, day: 16, hour: 4, minute: 30, hour_period: "yin", gender: "F", timezone: "Asia/Shanghai" },
  { year: 1990, month: 1, day: 1, hour: 0, minute: 0, hour_period: "zi_early", gender: "M", timezone: "America/New_York" },
  { year: 1985, month: 6, day: 15, hour: 12, minute: 0, hour_period: "wu", gender: "F", timezone: "America/Los_Angeles" },
  { year: 1975, month: 12, day: 31, hour: 23, minute: 50, hour_period: "hai", gender: "M", timezone: "America/Chicago" },
  { year: 2005, month: 3, day: 8, hour: 8, minute: 0, hour_period: "chen", gender: "F", timezone: "Europe/London" },
  { year: 1968, month: 9, day: 22, hour: 18, minute: 20, hour_period: "you", gender: "M", timezone: "Asia/Tokyo" },
  { year: 1995, month: 2, day: 14, hour: 6, minute: 45, hour_period: "mao", gender: "F", timezone: "America/Toronto" },
  { year: 1988, month: 11, day: 11, hour: 22, minute: 10, hour_period: "hai", gender: "M", timezone: "Asia/Hong_Kong" },
  { year: 1955, month: 4, day: 20, hour: 10, minute: 5, hour_period: "si", gender: "M", timezone: "Europe/Paris" },
  { year: 2001, month: 5, day: 5, hour: 16, minute: 40, hour_period: "shen", gender: "F", timezone: "America/Denver" },
];

/** Static value tokens that must be registered (SSOT or disposition) — not dynamic pattern names. */
const STATIC_VALUE_POOL = new Set<string>([
  ...ZIWEI_RUNTIME_PALACES,
  ...ZIWEI_RUNTIME_STARS,
  ...ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS,
  "禄",
  "权",
  "科",
  "忌",
]);

const STRUCTURE_LABELS = [
  "命宫",
  "对宫",
  "十二宫",
  "四化",
  "化禄",
  "化权",
  "化科",
  "化忌",
  "大限",
  "流年",
  "命主",
  "身主",
  "身宫",
  "五行局",
] as const;

function assertMappedOrInternal(token: string, ctx: string): void {
  const resolved = resolvePojuTerm(token, { namespace: "ziwei" });
  if (resolved.status === "resolved") return;
  const disp = ziweiTokenDisposition(token);
  assert.notEqual(
    disp.status,
    "unknown_blocked",
    `${ctx}: token ${JSON.stringify(token)} unregistered (unknown_blocked) — add disposition or SSOT`,
  );
}

/** Traditional multi-char tokens that must not appear on user soft surfaces. */
function traditionalLeakInText(text: string, packTokens: string[]): string[] {
  const hits: string[] = [];
  for (const token of packTokens) {
    if (token.length < 2) continue;
    if (!/[\u4e00-\u9fff]/.test(token)) continue;
    if (text.includes(token)) hits.push(token);
  }
  return [...new Set(hits)];
}

for (const label of STRUCTURE_LABELS) {
  const r = resolvePojuTerm(label, { namespace: "ziwei" });
  assert.equal(r.status, "resolved", `structure SSOT missing: ${label}`);
}

for (const token of STATIC_VALUE_POOL) {
  assertMappedOrInternal(token, "static_pool");
}

const allPatternNames = new Set<string>();

for (const birth of BIRTHS) {
  const pack = buildZiweiFactPack(birth, { asOf: AS_OF });
  const suspects = collectZiweiTraditionalSuspects(pack);
  for (const hit of pack.patternHits) allPatternNames.add(hit.name);

  for (const token of suspects) {
    if (pack.patternHits.some((h) => h.name === token)) {
      // Dynamic pattern names: allowed unregistered in disposition; must stay off user exits.
      continue;
    }
    if (token.length === 1 && !"禄权科忌".includes(token)) {
      // Stems/branches handled outside ziwei disposition.
      continue;
    }
    if (/^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]+$/.test(token)) continue;
    assertMappedOrInternal(token, `birth_${birth.year}`);
  }

  const display = buildZiweiDisplayFactPack(pack, "zh");
  const leaks = ziweiDisplayContainsTraditionalLeak(display, pack);
  assert.equal(leaks.length, 0, `display leak ${birth.year}: ${leaks.join(",")}`);

  const closedBody = formatZiweiClosedSetForPrompt(pack, "zh")
    .split("\n")
    .filter((line) => !line.startsWith("【") && !line.startsWith("（"))
    .join("\n");
  const userSurfaces = [
    baselineZiweiLensLines(pack, "zh")
      .map((l) => `${l.label}|${l.value}`)
      .join("\n"),
    closedBody,
    ziweiCompanionTriggerAnchors(pack, "zh").join("|"),
    pageSliceAnchorLines("02", { zfp: pack, ziwei: pack }).join("|"),
    pageSliceAnchorLines("03", { zfp: pack, ziwei: pack }).join("|"),
  ].join("\n");

  const valueTokens = suspects.filter(
    (t) =>
      t.length >= 2 &&
      !STRUCTURE_LABELS.includes(t as (typeof STRUCTURE_LABELS)[number]) &&
      !/^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]+$/.test(t),
  );
  const surfaceLeaks = traditionalLeakInText(userSurfaces, valueTokens);
  assert.equal(
    surfaceLeaks.length,
    0,
    `user-delivery traditional fallback ${birth.year}: ${surfaceLeaks.join(",")}`,
  );

  // Soft surfaces may include mapped labels (核心定位域) but never raw 命宫 as fallback value.
  assert.ok(!userSurfaces.includes("命宫"), `must not show raw 命宫 (${birth.year})`);
}

assert.ok(allPatternNames.size > 0, "inventory saw pattern hits");

// Explicit: pattern traditional names must not appear in fill anchors
{
  const pack = buildZiweiFactPack(BIRTHS[0]!, { asOf: AS_OF });
  const anchors = pageSliceAnchorLines("02", { zfp: pack, ziwei: pack }).join("|");
  for (const name of pack.patternHits.map((h) => h.name)) {
    assert.ok(!anchors.includes(name), `anchor must not contain pattern name ${name}`);
  }
  assert.ok(
    /核心定位域|四向转化|长周期段|年度周期|结构格局×/.test(anchors) || anchors.length === 0,
    `expected soft ziwei anchors, got: ${anchors}`,
  );
}

console.log("ziwei-term-completeness phase9 ok", {
  births: BIRTHS.length,
  staticPool: STATIC_VALUE_POOL.size,
  patternNamesObserved: allPatternNames.size,
});
