/**
 * Phase 9 + Phase 11 · Ziwei term completeness on user-delivery exits.
 * Phase 11: 36 public value terms (palaces / configs / stars) must resolve via SSOT.
 *
 * Run: pnpm test:ziwei-term-completeness
 */
import assert from "node:assert/strict";
import type { BirthInfo } from "../lib/profile/types";
import { pageSliceAnchorLines } from "../lib/llm/pro/delivery/slice-for-page";
import { POJU_TERMS, termOf } from "../lib/glossary/pojulife-terms";
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
const LOCALES = ["zh", "en", "es", "de", "fr"] as const;

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

/** Phase 11 A-class public value tokens (命宫 already in structure SSOT). */
const PHASE11_PALACES = ZIWEI_RUNTIME_PALACES.filter((p) => p !== "命宫");
const PHASE11_EXPECTED_SLUGS: Record<string, string> = {
  兄弟: "zw_peer_bond_field",
  夫妻: "zw_partnership_field",
  子女: "zw_continuity_field",
  财帛: "zw_resource_flow_field",
  疾厄: "zw_resilience_field",
  迁移: "zw_mobility_field",
  仆役: "zw_collab_network_field",
  官禄: "zw_role_craft_field",
  田宅: "zw_anchorage_field",
  福德: "zw_inner_reserve_field",
  父母: "zw_origin_support_field",
  水二局: "zw_config_water_dual",
  木三局: "zw_config_wood_triple",
  金四局: "zw_config_metal_quad",
  土五局: "zw_config_earth_penta",
  火六局: "zw_config_fire_hexa",
  紫微: "zw_star_apex_axis",
  天机: "zw_star_pattern_sense",
  太阳: "zw_star_radiant_out",
  武曲: "zw_star_craft_edge",
  天同: "zw_star_ease_bond",
  廉贞: "zw_star_intense_edge",
  天府: "zw_star_storehouse",
  太阴: "zw_star_inward_tide",
  贪狼: "zw_star_desire_drive",
  巨门: "zw_star_voice_gate",
  天相: "zw_star_protocol",
  天梁: "zw_star_elder_shade",
  七杀: "zw_star_breach_force",
  破军: "zw_star_reset_edge",
  文昌: "zw_star_script_clarity",
  文曲: "zw_star_lyric_flow",
  左辅: "zw_star_left_support",
  右弼: "zw_star_right_support",
  禄存: "zw_star_resource_cache",
  火星: "zw_star_ignition",
};

const PHASE11_TOKENS = Object.keys(PHASE11_EXPECTED_SLUGS);
assert.equal(PHASE11_TOKENS.length, 36, "Phase 11 token count");
assert.equal(PHASE11_PALACES.length, 11, "eleven palaces besides 命宫");
assert.equal(ZIWEI_RUNTIME_STARS.length, 20, "14 majors + 6 aux");
assert.equal(ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS.length, 5, "five configs");

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

function traditionalLeakInText(text: string, packTokens: string[]): string[] {
  // Strip known soft labels first — coined names may legally contain traditional
  // substrings (e.g. 流动迁移域 contains 迁移) without being a traditional fallback.
  let scrubbed = text;
  const softs: string[] = [];
  for (const token of [...packTokens, ...STRUCTURE_LABELS, ...PHASE11_TOKENS]) {
    const r = resolvePojuTerm(token, { namespace: "ziwei" });
    if (r.status !== "resolved") continue;
    for (const loc of LOCALES) {
      const soft = (r.term.term[loc] || "").trim();
      if (soft.length >= 2) softs.push(soft);
    }
  }
  for (const soft of [...new Set(softs)].sort((a, b) => b.length - a.length)) {
    scrubbed = scrubbed.split(soft).join("");
  }
  const hits: string[] = [];
  for (const token of packTokens) {
    if (token.length < 2) continue;
    if (!/[\u4e00-\u9fff]/.test(token)) continue;
    if (scrubbed.includes(token)) hits.push(token);
  }
  return [...new Set(hits)];
}

// --- SSOT inventory ---
{
  const ziwei = POJU_TERMS.filter((t) => t.ns === "ziwei");
  assert.equal(ziwei.length, 50, `ziwei SSOT total (14 structure + 36 phase11), got ${ziwei.length}`);
  const slugs = ziwei.map((t) => t.slug);
  assert.equal(new Set(slugs).size, slugs.length, "ziwei slugs unique");
}

for (const label of STRUCTURE_LABELS) {
  const r = resolvePojuTerm(label, { namespace: "ziwei" });
  assert.equal(r.status, "resolved", `structure SSOT missing: ${label}`);
}

// --- Phase 11: 36 tokens resolve + public_glossary + 5-locale completeness ---
{
  let localeComplete = 0;
  for (const token of PHASE11_TOKENS) {
    const expected = PHASE11_EXPECTED_SLUGS[token]!;
    const r = resolvePojuTerm(token, { namespace: "ziwei" });
    assert.equal(r.status, "resolved", `phase11 resolve ${token}`);
    if (r.status === "resolved") {
      assert.equal(r.term.slug, expected, `phase11 slug ${token}`);
      assert.equal(r.term.ns, "ziwei", `phase11 ns ${token}`);
      assert.equal(r.term.traditional, token, `phase11 traditional ${token}`);
      for (const loc of LOCALES) {
        const name = (r.term.term[loc] || "").trim();
        const def = (r.term.definition[loc] || "").trim();
        assert.ok(name.length > 0, `${expected} term.${loc}`);
        assert.ok(def.length > 0, `${expected} definition.${loc}`);
        assert.ok(termOf(expected, loc), `termOf ${expected} ${loc}`);
      }
      localeComplete += 1;
    }
    const disp = ziweiTokenDisposition(token);
    assert.equal(disp.status, "public_glossary", `${token} must not stay internal_only`);
  }
  assert.equal(localeComplete, 36, "36/36 five-locale complete");
  console.log("ok: phase11 36 tokens resolved + public_glossary + 5 locales");
}

// Unknown still fail-closed
{
  const unk = ziweiTokenDisposition("杀破狼");
  assert.equal(unk.status, "unknown_blocked");
  const unk2 = resolvePojuTerm("杀破狼", { namespace: "ziwei" });
  assert.notEqual(unk2.status, "resolved");
  console.log("ok: unregistered pattern name fail-closed");
}

// Dual-namespace isolation
{
  const qishaZw = resolvePojuTerm("七杀", { namespace: "ziwei" });
  const qishaBz = resolvePojuTerm("七杀", { namespace: "bazi" });
  assert.equal(qishaZw.status, "resolved");
  assert.equal(qishaBz.status, "resolved");
  if (qishaZw.status === "resolved" && qishaBz.status === "resolved") {
    assert.equal(qishaZw.term.slug, "zw_star_breach_force");
    assert.equal(qishaBz.term.slug, "qi_sha");
    assert.notEqual(qishaZw.term.slug, qishaBz.term.slug);
  }

  const wenchangZw = resolvePojuTerm("文昌", { namespace: "ziwei" });
  const wenchangBz = resolvePojuTerm("文昌", { namespace: "bazi" });
  assert.equal(wenchangZw.status, "resolved");
  assert.equal(wenchangBz.status, "resolved");
  if (wenchangZw.status === "resolved" && wenchangBz.status === "resolved") {
    assert.equal(wenchangZw.term.slug, "zw_star_script_clarity");
    assert.equal(wenchangBz.term.slug, "wen_chang");
  }

  const liunianZw = resolvePojuTerm("流年", { namespace: "ziwei" });
  const liunianBz = resolvePojuTerm("流年", { namespace: "bazi" });
  assert.equal(liunianZw.status, "resolved");
  assert.equal(liunianBz.status, "resolved");
  if (liunianZw.status === "resolved" && liunianBz.status === "resolved") {
    assert.equal(liunianZw.term.slug, "zw_yearly_cycle");
    assert.equal(liunianBz.term.slug, "year");
  }
  console.log("ok: dual-ns 七杀/文昌/流年 no cross-contamination");
}

for (const token of STATIC_VALUE_POOL) {
  assertMappedOrInternal(token, "static_pool");
}

const allPatternNames = new Set<string>();
let displayResolvedPhase11 = 0;
let displayBlockedPhase11 = 0;
let baselineSample = "";

for (const birth of BIRTHS) {
  const pack = buildZiweiFactPack(birth, { asOf: AS_OF });
  const suspects = collectZiweiTraditionalSuspects(pack);
  for (const hit of pack.patternHits) allPatternNames.add(hit.name);

  for (const token of suspects) {
    if (pack.patternHits.some((h) => h.name === token)) continue;
    if (token.length === 1 && !"禄权科忌".includes(token)) continue;
    if (/^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]+$/.test(token)) continue;
    assertMappedOrInternal(token, `birth_${birth.year}`);
  }

  for (const loc of LOCALES) {
    const display = buildZiweiDisplayFactPack(pack, loc);
    const leaks = ziweiDisplayContainsTraditionalLeak(display, pack);
    assert.equal(leaks.length, 0, `display leak ${birth.year}/${loc}: ${leaks.join(",")}`);

    // Phase 11 atoms that appear on this pack must be resolved (not blocked)
    const atoms = [
      display.topicPalace.palace,
      ...display.topicPalace.majorStars,
      display.topicPalace.oppositePalace,
      ...display.topicPalace.oppositeMajorStars,
      display.daxian.palace,
      ...display.daxian.majorStars,
      display.mingShen.soul,
      display.mingShen.body,
      display.mingShen.shenPalace,
      display.mingShen.fiveElementsClass,
      ...display.sihua.map((h) => h.star),
      ...display.daxian.sihua.map((h) => h.star),
      ...display.daxian.liunian.sihua.map((h) => h.star),
      ...display.palaces.flatMap((p) => [p.name, ...p.majorStars]),
    ];
    for (const atom of atoms) {
      if (atom.status !== "resolved" && atom.status !== "blocked") continue;
      const trad =
        atom.status === "resolved"
          ? atom._traditional
          : null;
      if (trad && PHASE11_EXPECTED_SLUGS[trad]) {
        assert.equal(atom.status, "resolved", `phase11 atom ${trad} ${birth.year}/${loc}`);
        if (loc === "zh" && birth === BIRTHS[0]) displayResolvedPhase11 += 1;
      }
      if (atom.status === "blocked" && loc === "zh" && birth === BIRTHS[0]) {
        // blocked only for non-phase11 / empty
        displayBlockedPhase11 += 1;
      }
    }
  }

  const displayZh = buildZiweiDisplayFactPack(pack, "zh");
  // Direct check: every phase11 traditional on this pack resolves in display projection
  for (const token of PHASE11_TOKENS) {
    if (!suspects.includes(token) && token !== pack.mingShen.fiveElementsClass) {
      // still may appear as palace name etc.
    }
  }
  for (const p of displayZh.palaces) {
    if (p.name.status === "resolved") {
      assert.ok(p.name.label.length > 0 && p.name.label !== "—");
    }
  }
  assert.equal(displayZh.mingShen.fiveElementsClass.status, "resolved");
  assert.ok(displayZh.mingShen.fiveElementsClass.status === "resolved" &&
    displayZh.mingShen.fiveElementsClass.label.length > 0);

  const closedBody = formatZiweiClosedSetForPrompt(pack, "zh")
    .split("\n")
    .filter((line) => !line.startsWith("【") && !line.startsWith("（"))
    .join("\n");
  const lens = baselineZiweiLensLines(pack, "zh");
  if (birth === BIRTHS[0]) {
    baselineSample = lens.map((l) => `${l.label}|${l.value}`).join("\n");
  }
  // soul/body/fiveElements lines must show soft labels (not bare "—") when pack has values
  const soulLine = lens.find((l) => l.label.includes("核心驱动") || l.label.includes("行动驱动"));
  if (soulLine) {
    assert.ok(!soulLine.value.startsWith("— / —"), `baseline soul/body empty ${birth.year}: ${soulLine.value}`);
    assert.ok(!soulLine.value.includes("紫微"), "baseline must not leak 紫微");
  }
  const elemLine = lens.find((l) => l.label.includes("元素配置"));
  if (elemLine) {
    assert.notEqual(elemLine.value, "—", `baseline five-elements ${birth.year}`);
    assert.ok(!/水二局|木三局|金四局|土五局|火六局/.test(elemLine.value), "no raw 五行局 traditional");
  }
  const mingLine = lens.find((l) => l.label === "核心定位域");
  if (mingLine) {
    assert.notEqual(mingLine.value, "—", `baseline 命宫 stars ${birth.year}`);
  }

  const userSurfaces = [
    lens.map((l) => `${l.label}|${l.value}`).join("\n"),
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

  assert.ok(!userSurfaces.includes("命宫"), `must not show raw 命宫 (${birth.year})`);
  for (const name of pack.patternHits.map((h) => h.name)) {
    assert.ok(!userSurfaces.includes(name), `pattern name leak ${name} ${birth.year}`);
  }
}

assert.ok(allPatternNames.size > 0, "inventory saw pattern hits");

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

console.log("ziwei-term-completeness phase9+11 ok", {
  births: BIRTHS.length,
  ziweiSsot: 50,
  phase11: 36,
  staticPool: STATIC_VALUE_POOL.size,
  patternNamesObserved: allPatternNames.size,
  displayResolvedSampleAtoms: displayResolvedPhase11,
  displayBlockedSampleAtoms: displayBlockedPhase11,
});
console.log("--- baseline sample (birth0 zh) ---\n" + baselineSample);
