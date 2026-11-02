/**
 * Lab soft-stage → decision-report reader exit.
 * Soft four-stage dump stays Lab-only; mergeReaderEvidenceProse is the report UI surface
 * (no 【能量配置】/【科学】/【交汇】 chrome).
 */
import assert from "node:assert/strict";
import { mergeLabSoftStageReaderProse } from "../lib/llm/pro/delivery/lab/lab-reader-evidence-preview";
import {
  mergeReaderEvidenceProse,
  readerEvidenceHasTrackChrome,
} from "../lib/llm/pro/delivery/page-schema/reader-evidence-prose";
import { toSoftTranslatedPlainText } from "../lib/llm/sanitize/compliance-terms";
import { encodeTermMarker } from "../lib/llm/sanitize/term-marking";

const softStages = {
  "02": [
    { title: "destiny_reason", evidence: "【能量配置】日主偏弱，印星牵制本案窗口。" },
    { title: "science_mechanism", evidence: "【科学】工作记忆负荷过高时，你会推迟收集事实。" },
    { title: "convergence", evidence: "【交汇】命盘窗口与认知负荷同向：先缩小决策面再验证。" },
    { title: "verifiable_anchors", evidence: "【能量配置】本周可核对：是否仍把核对拖到会后。" },
  ],
};

const prose = mergeLabSoftStageReaderProse(softStages, "zh");
assert.ok(prose.length > 0, "merged prose non-empty");
assert.equal(readerEvidenceHasTrackChrome(prose), false, "no track chrome helper");
assert.equal(prose.includes("【能量配置】"), false, "no 能量配置 chrome");
assert.equal(prose.includes("【科学】"), false, "no 科学 chrome");
assert.equal(prose.includes("【交汇】"), false, "no 交汇 chrome");
assert.ok(prose.includes("日主偏弱") || prose.includes("印星"), "destiny kept");
assert.ok(prose.includes("工作记忆") || prose.includes("负荷"), "science kept");
assert.ok(prose.includes("同向") || prose.includes("决策"), "convergence kept");
assert.ok(prose.includes("可核对") || prose.includes("会后"), "D anchors kept");

// Same SoT as report: direct merge must also strip chrome.
const direct = mergeReaderEvidenceProse({
  metaphysics: softStages["02"][0]!.evidence,
  science: softStages["02"][1]!.evidence,
  convergence: softStages["02"][2]!.evidence,
  locale: "zh",
});
assert.equal(readerEvidenceHasTrackChrome(direct), false);
assert.equal(direct.includes("【能量配置】"), false);
assert.equal(direct.includes("【科学】"), false);
assert.equal(direct.includes("【交汇】"), false);


// --- Bug A: hard-paste after marker strip (adjacent softs need connective) ---
{
  const mJi = encodeTermMarker("unfavorable_element", "耗元");
  const mYong = encodeTermMarker("yong_shen", "锚元");
  const adjacentMarked = `金土${mJi}${mYong}再看窗口`;
  const softAdjacent = toSoftTranslatedPlainText(adjacentMarked, "zh");
  assert.ok(softAdjacent.includes("耗元"), `soft has 耗元: ${softAdjacent}`);
  assert.ok(softAdjacent.includes("锚元"), `soft has 锚元: ${softAdjacent}`);
  assert.equal(softAdjacent.includes("耗元锚元"), false, `no hard-paste 耗元锚元: ${softAdjacent}`);

  const alreadyPasted = "金土耗元锚元再看窗口";
  const repaired = mergeReaderEvidenceProse({ text: alreadyPasted, locale: "zh" });
  assert.equal(repaired.includes("耗元锚元"), false, `merge repairs hard-paste: ${repaired}`);
  assert.ok(repaired.includes("耗元") && repaired.includes("锚元"), `merge keeps softs: ${repaired}`);
}

// --- Bug B: traditional+soft stack 命宫核心定位域 must not leak to reader ---
{
  const stack = "本案关键看命宫核心定位域的落点。";
  const softStack = toSoftTranslatedPlainText(stack, "zh");
  assert.equal(softStack.includes("命宫核心定位域"), false, `no trad+soft stack: ${softStack}`);
  assert.equal(softStack.includes("命宫"), false, `no bare 命宫: ${softStack}`);
  assert.ok(softStack.includes("核心定位域"), `soft-only 核心定位域: ${softStack}`);

  const bareMing = "本案关键看命宫的落点。";
  const softMing = toSoftTranslatedPlainText(bareMing, "zh");
  assert.equal(softMing.includes("命宫"), false, `bare 命宫 soft-translated: ${softMing}`);
  assert.ok(softMing.includes("核心定位域"), `bare 命宫 → 核心定位域: ${softMing}`);
}


// --- Max 2026-11-02 production fragments: must not survive soft/reader exit ---
{
  const mash = "把这些合在一起看，金土耗元截伐锚元与损失厌恶同向";
  const softMash = toSoftTranslatedPlainText(mash, "zh");
  // Soft labels may remain; traditional+own-soft STACKS and EN/ZH mixed stacks must not.
  assert.equal(softMash.includes("命宫核心定位域"), false);

  const stackZh = "核心定位域与流动切换域对拱令显隐冲突放大";
  // Coined soft-only is OK; trad+soft stack is not.
  const softOnly = toSoftTranslatedPlainText("命宫核心定位域与流动切换域", "zh");
  assert.equal(softOnly.includes("命宫核心定位域"), false, `no trad+soft: ${softOnly}`);
  assert.equal(softOnly.includes("命宫"), false, `no bare 命宫: ${softOnly}`);
  assert.ok(softOnly.includes("核心定位域"), `keeps soft 核心定位域: ${softOnly}`);

  const softEnStack = toSoftTranslatedPlainText("命宫核心定位域", "en");
  assert.equal(
    softEnStack.includes("CoreIdentityField核心定位域"),
    false,
    `no EN+ZH soft stack: ${softEnStack}`,
  );
  assert.equal(softEnStack.includes("核心定位域"), false, `EN soft drops zh soft: ${softEnStack}`);
  assert.equal(softEnStack.includes("命宫"), false, `EN soft drops 命宫: ${softEnStack}`);
  assert.ok(
    softEnStack.includes("CoreIdentityField") || softEnStack.includes("Core Identity"),
    `EN soft identity field: ${softEnStack}`,
  );

  // Exact Max mash with markers → soft must not hard-paste 耗元锚元; EN must not be zh-connective-only table swap proof via polish elsewhere.
  const mJi = encodeTermMarker("unfavorable_element", "耗元");
  const mYong = encodeTermMarker("yong_shen", "锚元");
  const markedMash = `金土${mJi}截伐${mYong}`;
  const softMarkedZh = toSoftTranslatedPlainText(markedMash, "zh");
  assert.ok(softMarkedZh.includes("耗元") && softMarkedZh.includes("锚元"), softMarkedZh);
  assert.equal(softMarkedZh.includes("耗元锚元"), false, `no abut hard-paste: ${softMarkedZh}`);
  const softMarkedEn = toSoftTranslatedPlainText(markedMash, "en");
  assert.equal(
    softMarkedEn.includes("CoreIdentityField核心定位域"),
    false,
    softMarkedEn,
  );
}

console.log("test-lab-reader-evidence-preview: ok");
