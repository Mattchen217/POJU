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

console.log("test-lab-reader-evidence-preview: ok");
