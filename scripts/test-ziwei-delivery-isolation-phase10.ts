/**
 * Phase 10 — Ziwei user-delivery input isolation (dual-layer aware).
 * Soft: sliceForPage().slice.zfp + formatPageSliceFeed never carry unmapped traditional names.
 * Evidence/judgment: destiny/all feeds MAY include a labeled Ziwei traditional closed-set;
 * free-text thesis/science/agenda/question stay scrubbed; science mode omits the closed-set.
 * Raw FactPack stays complete.
 *
 * Run: pnpm test:ziwei-delivery-isolation
 */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BirthInfo } from "../lib/profile/types";
import { buildBookJudgmentFeedBlock } from "../lib/llm/pro/delivery/book-judgment/generate";
import { formatPageSliceFeed } from "../lib/llm/pro/delivery/page-slice-feed";
import { sliceForPage } from "../lib/llm/pro/delivery/slice-for-page";
import {
  buildZiweiFactPack,
  collectZiweiTraditionalSuspects,
  patternHitRefsForPrompt,
  softZiweiLabel,
  ziweiPatternHitId,
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
  { year: 1972, month: 7, day: 4, hour: 14, minute: 15, hour_period: "wei", gender: "M", timezone: "America/Sao_Paulo" },
  { year: 1999, month: 10, day: 31, hour: 3, minute: 0, hour_period: "chou", gender: "F", timezone: "Asia/Shanghai" },
];

const STRUCTURE_SOFT_OK = new Set([
  "核心定位域",
  "对照定位域",
  "生活领域图谱",
  "四向转化",
  "资源转化",
  "主动权转化",
  "认可转化",
  "摩擦转化",
  "长周期段",
  "年度周期",
  "核心驱动",
  "行动驱动",
  "行动落点域",
  "元素配置型",
  // Phase 11 soft labels (also stripped via softZiweiLabel in leak scan)
  "同辈联结域",
  "伙伴关系域",
  "延续创造域",
  "资源流转域",
  "承压调适域",
  "流动切换域",
  "协作网络域",
  "职分事功域",
  "安顿根基域",
  "内在蓄养域",
  "来源支撑域",
]);

function traditionalLeaksInJson(json: string, suspects: string[]): string[] {
  // Soft labels may legally contain traditional substrings (e.g. 左辅星轨); strip them first.
  let scrubbed = json;
  for (const soft of STRUCTURE_SOFT_OK) {
    if (soft.length >= 2) scrubbed = scrubbed.split(soft).join("");
  }
  for (const token of suspects) {
    const soft = softZiweiLabel(token, "zh");
    if (soft.length >= 2) scrubbed = scrubbed.split(soft).join("");
  }
  const hits: string[] = [];
  for (const token of suspects) {
    if (token.length < 2) continue;
    if (!/[\u4e00-\u9fff]/.test(token)) continue;
    if (STRUCTURE_SOFT_OK.has(token)) continue;
    if (/^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]+$/.test(token)) continue;
    if (scrubbed.includes(token)) hits.push(token);
  }
  return [...new Set(hits)];
}


/** Strip labeled evidence closed-set + segment-duty meta (may mention 紫微 as instruction). */
function stripLabeledTraditionalClosedSet(feed: string): string {
  const markers = [
    "## 紫微传统闭集（依据层 · 自由传统词 · 禁止打标）",
    "## Ziwei traditional closed-set (evidence layer · free traditional · no markers)",
    "## 全书段级喂料职责（CFP+ZFP · 相关才用 · 禁整盘灌段）",
    "## Global segment feed duties (CFP+ZFP · on-topic)",
  ];
  let out = feed;
  for (const m of markers) {
    const start = out.indexOf(m);
    if (start < 0) continue;
    // Block runs until next top-level ## heading or end
    const after = out.slice(start + m.length);
    const next = after.search(/\n## /);
    const end = next < 0 ? out.length : start + m.length + next;
    out = out.slice(0, start) + out.slice(end);
  }
  return out;
}

const runLog: string[] = [];
function log(line: string) {
  runLog.push(line);
  console.log(line);
}

log("========== test-ziwei-delivery-isolation-phase10 ==========\n");

assert.equal(softZiweiLabel("紫微", "zh"), "枢轴星轨", "Phase 11 紫微 soft");
assert.equal(softZiweiLabel("命宫", "zh"), "核心定位域", "命宫 soft");
assert.equal(softZiweiLabel("杀破狼", "zh"), "", "unregistered pattern still fail-closed empty");

for (const birth of BIRTHS) {
  const pack = buildZiweiFactPack(birth, { asOf: AS_OF });
  const suspects = collectZiweiTraditionalSuspects(pack);

  // Raw FactPack intact (traditional tokens remain on the computation pack)
  assert.ok(pack.palaces.length === 12, `raw palaces ${birth.year}`);
  assert.ok(
    pack.palaces.some((p) => p.majorStars.some((s) => /[\u4e00-\u9fff]/.test(s))) ||
      pack.sihua.some((h) => /[\u4e00-\u9fff]/.test(h.star)),
    `raw FactPack keeps traditional star tokens ${birth.year}`,
  );
  assert.equal(pack.topicPalace.palace, "命宫", `raw topic palace traditional ${birth.year}`);

  for (const loc of LOCALES) {
    const sliced = sliceForPage("02", { zfp: pack, ziwei: pack, locale: loc });
    const zfp = sliced.slice.zfp;
    assert.ok(zfp, `zfp present ${birth.year}/${loc}`);
    const json = JSON.stringify(zfp);

    if (zfp.topicPalace && typeof zfp.topicPalace === "object") {
      assert.ok(
        !suspects.includes(zfp.topicPalace.palace) || zfp.topicPalace.palace === "",
        // palace should be soft or empty — never raw traditional from suspects unless soft equals (won't)
        `topicPalace.palace soft ${birth.year}/${loc}`,
      );
      for (const star of zfp.topicPalace.majorStars) {
        assert.ok(!pack.topicPalace.majorStars.includes(star), `no raw majorStar ${star}`);
      }
    }

    if (Array.isArray(zfp.sihua)) {
      for (const hit of zfp.sihua) {
        assert.ok(!pack.sihua.some((h) => h.star === hit.star && hit.star.length > 0), "sihua.star not traditional");
        assert.ok(
          !pack.sihua.some((h) => h.palace === hit.palace && hit.palace.length > 0),
          "sihua.palace not traditional",
        );
      }
    }

    if (zfp.daxian && typeof zfp.daxian === "object") {
      assert.ok(
        !pack.palaces.some((p) => p.name === zfp.daxian!.palace && zfp.daxian!.palace.length > 0),
        "daxian.palace not traditional",
      );
      for (const star of zfp.daxian.majorStars ?? []) {
        assert.ok(!pack.daxian.majorStars.includes(star), `daxian star soft ${star}`);
      }
      if (zfp.daxian.liunian) {
        assert.ok(
          !pack.palaces.some(
            (p) => p.name === zfp.daxian!.liunian!.palace && zfp.daxian!.liunian!.palace.length > 0,
          ),
          "liunian.palace not traditional",
        );
      }
    }

    if (zfp.patternHits?.length) {
      for (const hit of zfp.patternHits) {
        assert.ok(hit.hit_id && hit.hit_id.length >= 8, "hit_id present");
        assert.ok(!hit.name, "no classical name field on slice");
        for (const n of pack.patternHits.map((h) => h.name)) {
          assert.ok(!json.includes(n), `pattern name leak ${n}`);
        }
      }
    }

    const leaks = traditionalLeaksInJson(json, suspects);
    assert.equal(leaks.length, 0, `slice.zfp leaks ${birth.year}/${loc}: ${leaks.join(",")}`);
  }

  // Judgment-style prompt refs
  const refs = patternHitRefsForPrompt(pack.patternHits);
  for (const name of pack.patternHits.map((h) => h.name)) {
    assert.ok(!refs.some((r) => r.includes(name)), `prompt ref must not include ${name}`);
  }
  assert.ok(refs.every((r) => r.startsWith("hit:")), "refs are hit:id:level");

  // formatPageSliceFeed must not dump traditional pattern names
  const feed = formatPageSliceFeed({
    key: "02",
    chartText: "日主：甲木\n用神：木\n喜神：水\n忌神：土\n当前大运：甲辰",
    ziwei: pack,
    locale: "zh",
  });
  assert.ok(feed, "feed present");
  for (const name of pack.patternHits.map((h) => h.name)) {
    assert.ok(!feed!.includes(name), `page slice feed no pattern ${name}`);
  }
  assert.ok(!feed!.includes("紫微"), "feed no 紫微");
  assert.ok(!feed!.includes("天同"), "feed no 天同");
}

// Page 03 mingShen soft
{
  const pack = buildZiweiFactPack(BIRTHS[0]!, { asOf: AS_OF });
  const s03 = sliceForPage("03", { zfp: pack, locale: "zh" });
  const ms = s03.slice.zfp?.mingShen;
  assert.ok(ms && typeof ms === "object");
  if (ms && typeof ms === "object") {
    assert.ok(ms.soul !== pack.mingShen.soul || ms.soul === "", "soul soft/hidden");
    assert.ok(ms.body !== pack.mingShen.body || ms.body === "", "body soft/hidden");
    assert.ok(
      ms.fiveElementsClass !== pack.mingShen.fiveElementsClass || ms.fiveElementsClass === "",
      "fiveElements soft/hidden",
    );
  }
}

log(`ok: ${BIRTHS.length} births × ${LOCALES.length} locales slice isolation`);
log("ok: raw FactPack preserved");
log("ok: judgment pattern refs are hit_id (+ optional classical in labeled closed-set)");
log("ok: formatPageSliceFeed clean");

// --- Judgment user Prompt leak tests (one-shot + two-shot feeds) ---
{
  const pack = buildZiweiFactPack(BIRTHS[0]!, { asOf: AS_OF });
  const dirtyThesis = [
    "## 命盘总纲",
    `紫微在命宫，对宫贪狼；四化忌天同；格局${pack.patternHits[0]?.name ?? "杀破狼"}`,
    "木三局 · 身宫官禄",
  ].join("\n");
  const dirtyScience =
    "睡眠负荷高；紫微/天同叙事勿入科学轨；对照贪狼冲动";
  const dirtyAgenda = `议题：官禄宫压力与木三局节奏；勿写${pack.patternHits[0]?.name ?? "杀破狼"}`;
  const dirtyQuestion = "紫微命宫要不要换工作？七杀透干怎么处理？流年节奏？";
  const chartText =
    "日主：甲木\n用神：木\n喜神：水\n忌神：土\n七杀透干\n当前大运：甲辰\n流年：乙巳";

  const oneShot = buildBookJudgmentFeedBlock({
    chartText,
    ziwei: pack,
    thesis_block: dirtyThesis,
    science_feed: dirtyScience,
    agenda: dirtyAgenda,
    question: dirtyQuestion,
    mode: "all",
    locale: "zh",
  });
  const destiny = buildBookJudgmentFeedBlock({
    chartText,
    ziwei: pack,
    thesis_block: dirtyThesis,
    agenda: dirtyAgenda,
    question: dirtyQuestion,
    mode: "destiny",
    locale: "zh",
  });
  const science = buildBookJudgmentFeedBlock({
    chartText,
    ziwei: pack,
    science_feed: dirtyScience,
    agenda: dirtyAgenda,
    question: dirtyQuestion,
    mode: "science",
    locale: "zh",
  });

  // Dual-layer: destiny/all may carry labeled traditional closed-set; science must not.
  assert.ok(
    oneShot.includes("## 紫微传统闭集（依据层 · 自由传统词 · 禁止打标）"),
    "one-shot: evidence-layer traditional closed-set present",
  );
  assert.ok(
    destiny.includes("## 紫微传统闭集（依据层 · 自由传统词 · 禁止打标）"),
    "destiny: evidence-layer traditional closed-set present",
  );
  assert.ok(
    !science.includes("## 紫微传统闭集（依据层 · 自由传统词 · 禁止打标）"),
    "science: no traditional closed-set block",
  );
  assert.ok(
    oneShot.includes("全书段级喂料职责") || oneShot.includes("段级喂料职责"),
    "one-shot: global segment feed duties present",
  );
  assert.ok(
    destiny.includes("全书段级喂料职责") || destiny.includes("段级喂料职责"),
    "destiny: global segment feed duties present",
  );

  for (const [label, feed] of [
    ["one-shot", oneShot],
    ["two-shot-destiny", destiny],
    ["two-shot-science", science],
  ] as const) {
    const free = stripLabeledTraditionalClosedSet(feed);
    // Free-text / scrubbed surfaces: no uncontrolled traditional ziwei
    assert.ok(!free.includes("紫微"), `${label}: free-text no 紫微`);
    assert.ok(!free.includes("贪狼"), `${label}: free-text no 贪狼`);
    assert.ok(!free.includes("天同"), `${label}: free-text no 天同`);
    assert.ok(!free.includes("木三局"), `${label}: free-text no 木三局`);
    assert.ok(!free.includes("官禄"), `${label}: free-text no 官禄`);
    for (const name of pack.patternHits.map((h) => h.name)) {
      assert.ok(!free.includes(name), `${label}: free-text no pattern ${name}`);
    }
    // CFP / free-text may keep bazi-legal 七杀 · 流年 (homonym preserve on free fields + raw CFP)
    assert.ok(feed.includes("七杀"), `${label}: bazi 七杀 preserved`);
    assert.ok(feed.includes("流年"), `${label}: bazi 流年 preserved`);
    if (pack.patternHits[0]?.name) {
      const id = ziweiPatternHitId(pack.patternHits[0].name);
      assert.ok(
        oneShot.includes(`hit:${id}`) || destiny.includes(`hit:${id}`),
        "pattern classical name remapped to hit:id in thesis path",
      );
    }
    assert.ok(feed.includes("命盘总纲") || label === "two-shot-science", `${label} structure`);
  }

  // Field-specific: dirty science/agenda/question surfaces scrubbed of ziwei-only terms
  assert.ok(oneShot.includes("## 科学 / 现代证据 feed"));
  assert.ok(oneShot.includes("## agenda"));
  assert.ok(oneShot.includes("## 原问"));
  {
    const freeOne = stripLabeledTraditionalClosedSet(oneShot);
    assert.ok(
      !freeOne.includes("命宫") || freeOne.includes("核心定位域"),
      "命宫 soft or gone in free text (outside labeled closed-set)",
    );
  }
  log("ok: judgment dual-layer; closed-set on destiny/all; free-text scrubbed; science clean; bazi homonyms kept");
}

log("");

const recordPath = join(
  process.cwd(),
  ".cursor",
  "docs",
  "terms-phase10-test-run-record.md",
);
writeFileSync(
  recordPath,
  [
    "# Phase 10 · 测试运行记录",
    "",
    `Date: ${new Date().toISOString()}`,
    `Command: \`pnpm test:ziwei-delivery-isolation\``,
    "",
    "```",
    ...runLog,
    "```",
    "",
    "Also run:",
    "- `pnpm test:ziwei-fact-pack`",
    "- `pnpm test:ziwei-term-completeness`",
    "- `pnpm test:lab-ziwei-feed` (if present)",
    "",
  ].join("\n"),
  "utf8",
);
log(`wrote ${recordPath}`);
log("\nAll Phase 10 delivery isolation tests passed.\n");
