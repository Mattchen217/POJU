/**
 * Face 01 body_polish: brief→report floors, synonym FAIL, pointer ids, locale blocks.
 * Run: node node_modules/tsx/dist/cli.mjs scripts/test-face01-polish-thickness.ts
 */
import assert from "node:assert/strict";
import {
  extractPolishUnitIds,
  gateBodyPolishThickness,
  gateFace01PolishThickness,
} from "../lib/llm/pro/delivery/pipeline-v3/body-polish";
import {
  FACE01_POLISH_FLOOR,
  POLISH_LOCALE_BLOCKS,
  SHARED_BRIEF_TO_REPORT_CONTRACT,
  assemblePolishLocaleSystem,
} from "../lib/llm/pro/delivery/pipeline-v3/polish-locale-blocks";
import type { DeliveryPageData } from "../lib/llm/pro/delivery/page-schema/types";

function face01(partial: {
  main: string;
  conditions: string;
  not_choosing: string;
  pointer: string;
}): DeliveryPageData {
  return {
    page: "01",
    face: "01",
    page_title: "断语",
    page_subtitle: "",
    main_recommendation: partial.main,
    conditions: partial.conditions,
    not_choosing: partial.not_choosing,
    evidence_pointer: partial.pointer,
  } as DeliveryPageData;
}

const skeleton = face01({
  main: "先守补给窗口，业余试点验证负荷是否回落。",
  conditions: "三个月内能量画像承压不恶化。",
  not_choosing: "立刻切断主收入。",
  pointer: "依据见 02（d01、d02、d03）",
});

/** Four locale blocks present and distinct. */
{
  for (const loc of ["en", "zh", "es", "fr"] as const) {
    const b = POLISH_LOCALE_BLOCKS[loc].block;
    assert.ok(b.length > 80, loc);
    const sys = assemblePolishLocaleSystem({ locale: loc, key: "01" });
    assert.match(sys, /Locale block|整块注入|inyectar|injecter/);
    assert.ok(sys.includes(SHARED_BRIEF_TO_REPORT_CONTRACT.slice(0, 12)));
    assert.match(sys, /简报/);
    assert.doesNotMatch(sys, /草稿已厚则保量/);
    assert.doesNotMatch(sys, /仅半句才补/);
  }
  assert.match(POLISH_LOCALE_BLOCKS.en.block, /American/);
  assert.match(POLISH_LOCALE_BLOCKS.zh.block, /中国人/);
  assert.match(POLISH_LOCALE_BLOCKS.es.block, /Latinoamérica|LatAm/i);
  assert.match(POLISH_LOCALE_BLOCKS.fr.block, /français/i);
}

assert.deepEqual(extractPolishUnitIds("依据见 02（d01、d02、d03）"), [
  "d01",
  "d02",
  "d03",
]);

/** Near-synonym / thin → FAIL (old 196→202 style). */
{
  const thin = face01({
    main: "先稳住补给窗口，用业余试点看看负荷会不会回落。",
    conditions: "三个月内能量画像的承压别再恶化。",
    not_choosing: "不要立刻切断主收入。",
    pointer: "依据见 02（d01、d02、d03）",
  });
  const g = gateFace01PolishThickness({
    draft: skeleton,
    polished: thin,
    locale: "zh",
  });
  assert.equal(g.passed, false);
  assert.equal(g.failed_rule, "gate_polish_thin_synonym");
}

/** Drop science id → FAIL */
{
  const drop = face01({
    main: "先稳住补给。".repeat(40),
    conditions: "三个月内承压不恶化，并核对负荷是否回落。".repeat(8),
    not_choosing: "立刻切断主收入会把补给一并抽空，先别走这条。".repeat(6),
    pointer: "依据见 02（d01、d03）",
  });
  const g = gateBodyPolishThickness({
    key: "01",
    draft: skeleton,
    polished: drop,
    locale: "zh",
  });
  assert.equal(g?.passed, false);
  assert.match(String(g?.detail ?? ""), /d02|unit id/);
}

/** Report-thick PASS */
{
  const thick = face01({
    main: [
      "此刻主推是先守住补给窗口，用业余试点验证负荷是否回落，而不是立刻切断主收入。",
      "骨架里的承压与现状偏差同向：先把日子过稳，再谈放大动作。",
      "三个月窗口里只验证一件事——你的节奏是否从透支改成可核对的回落。",
      "若试点期间补给仍在、决策更清楚，再评估是否加码；否则缩回守窗。",
      "读者层要能感到：命理承压偏高与认知负荷偏大是同一条路上的两面，所以先守窗再试点。",
    ].join(""),
    conditions: [
      "成立前提是三个月内能量画像承压不恶化，且业余试点能给出可核对反馈：",
      "睡眠、决策拖延、额外收入试单是否同向改善。",
      "科学侧看现状与目标偏差带来的认知负荷；命理侧承压偏高时，先守补给比裸辞更稳。",
      "任一反馈反向，条件即不成立，回到守窗而不是加码。",
      "把条件写成可观察清单，而不是口号：每周至少一次对照「补给还在不在、负荷有没有回落」。",
    ].join(""),
    not_choosing: [
      "此刻不选立刻切断主收入、也不把「必须马上放大」当成唯一正确答案。",
      "那条路会把补给与负荷同时抽空，把短期焦虑误写成长期方案。",
      "排除的是裸辞式一刀切，不是永远禁止换轨——先过完可核对的试点窗。",
      "也不要把「三个月业余试点」误读成可以无限期拖延主判断；窗口结束要收成可核对结论。",
    ].join(""),
    pointer: "依据见 02（d01、d02、d03）",
  });
  const blobLen = [
    thick.main_recommendation,
    thick.conditions,
    thick.not_choosing,
  ]
    .join("")
    .replace(/\s/g, "").length;
  assert.ok(blobLen >= FACE01_POLISH_FLOOR.zh_chars, `blob=${blobLen}`);
  const g = gateBodyPolishThickness({
    key: "01",
    draft: skeleton,
    polished: thick,
    locale: "zh",
  });
  assert.equal(g, null, g?.detail);
}

/** EN floor words */
{
  const shortEn = face01({
    main: "Hold your base pay and run a side pilot.",
    conditions: "Three months without worse strain.",
    not_choosing: "Do not quit cold.",
    pointer: "See 02 (d01, d02, d03)",
  });
  const g = gateFace01PolishThickness({
    draft: skeleton,
    polished: shortEn,
    locale: "en",
  });
  assert.equal(g.passed, false);
  assert.match(String(g.detail ?? ""), /words|report/i);
}

console.log("face01-polish-thickness ok", {
  zh_floor: FACE01_POLISH_FLOOR.zh_chars,
  locales: Object.keys(POLISH_LOCALE_BLOCKS),
});
