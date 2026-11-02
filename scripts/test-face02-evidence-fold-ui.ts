/**
 * Reader evidence soft-exit (all EvidenceBlock / DualEvidenceBody folds):
 * one vernacular prose, no track labels / multi-section chrome.
 * Face02 still consolidates A/B/C into one shared fold.
 * Lab multi-track helpers (split/compose) stay intact.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  composeTripleEvidence,
  splitDualEvidence,
} from "../lib/llm/pro/delivery/page-schema/dual-evidence";
import {
  mergeReaderEvidenceProse,
  readerEvidenceHasTrackChrome,
  stripEvidenceTrackLabels,
} from "../lib/llm/pro/delivery/page-schema/reader-evidence-prose";

const destinyOnly = splitDualEvidence("【命理】日主偏弱，印星牵制本案窗口。");
assert.equal(destinyOnly.metaphysics_evidence.includes("日主偏弱"), true);
assert.equal(destinyOnly.science_evidence, "");
assert.equal(destinyOnly.convergence_evidence || "", "");

const scienceOnly = splitDualEvidence(
  "【科学】工作记忆负荷过高时，你会推迟收集事实。",
);
assert.equal(scienceOnly.science_evidence.includes("工作记忆"), true);
assert.equal(scienceOnly.metaphysics_evidence, "");

const convOnly = splitDualEvidence(
  "【交汇】命盘窗口与认知负荷同向：先缩小决策面再验证。",
);
assert.equal((convOnly.convergence_evidence || "").includes("同向"), true);
assert.equal(convOnly.metaphysics_evidence, "");
assert.equal(convOnly.science_evidence, "");

const allThree = splitDualEvidence(
  "【命理】印星牵制。\n【科学】认知负荷抬升。\n【交汇】两边同向：先收窄选项。",
);
assert.ok(allThree.metaphysics_evidence.includes("印星"));
assert.ok(allThree.science_evidence.includes("认知负荷"));
assert.ok((allThree.convergence_evidence || "").includes("收窄"));

const composed = composeTripleEvidence("meta-a", "sci-b", "conv-c");
assert.equal(composed.metaphysics_evidence, "meta-a");
assert.equal(composed.science_evidence, "sci-b");
assert.equal(composed.convergence_evidence, "conv-c");

// --- Reader one-prose soft-exit (all folds) ---
const stripped = stripEvidenceTrackLabels(
  "【能量配置】日主偏弱。【科学】负荷过高。【交汇】两边同向。",
);
assert.equal(stripped.includes("【能量配置】"), false);
assert.equal(stripped.includes("【科学】"), false);
assert.equal(stripped.includes("【交汇】"), false);

const prose = mergeReaderEvidenceProse({
  metaphysics: "【命理】八字上印星牵制窗口，贴题紫微同向加压。",
  science: "【科学】工作记忆负荷抬升时你更容易推迟核对。",
  convergence: "【交汇】两边同向：先收窄选项再验证。",
  locale: "zh",
});
assert.ok(prose.includes("印星") || prose.includes("八字"), "destiny coverage");
assert.ok(prose.includes("工作记忆") || prose.includes("负荷"), "science coverage");
assert.ok(prose.includes("同向") || prose.includes("收窄"), "convergence coverage");
assert.equal(readerEvidenceHasTrackChrome(prose), false);
assert.equal(prose.includes("【命理】"), false);
assert.equal(prose.includes("【科学】"), false);
assert.equal(prose.includes("【交汇】"), false);
assert.equal(prose.includes("【能量配置】"), false);
assert.equal(prose.includes("命理依据"), false);
assert.equal(prose.includes("科学依据"), false);
assert.equal(prose.includes("交汇依据"), false);

const fromLegacy = mergeReaderEvidenceProse({
  text: "【能量配置】日主偏弱。\n【科学】负荷过高。\n【交汇】两边同向。",
  locale: "zh",
});
assert.equal(readerEvidenceHasTrackChrome(fromLegacy), false);
assert.ok(fromLegacy.includes("日主偏弱"));
assert.ok(fromLegacy.includes("负荷"));

const faceSlots = fs.readFileSync(
  "components/poju/delivery-pages/faces/FacePageSlots.tsx",
  "utf8",
);
assert.ok(faceSlots.includes("slotEvidence"));
assert.ok(faceSlots.includes("DualEvidenceBody"));
assert.ok(faceSlots.includes('faceId === "02" && segmentId === "D"'));
assert.ok(
  faceSlots.includes("Face02ReaderEvidenceFold") ||
    faceSlots.includes("mergeReaderEvidenceProse"),
);
assert.equal(faceSlots.includes("tagFace02Evidence"), false);
assert.ok(faceSlots.includes('data-evidence-presentation="prose"'));
assert.equal(faceSlots.includes('isFace02 ? "prose" : "tracks"'), false);
assert.ok(
  fs.readFileSync("components/poju/delivery-pages/DualEvidenceBody.tsx", "utf8")
    .includes('presentation = "prose"'),
);
assert.ok(
  fs.readFileSync("components/poju/DeliveryBookStage.tsx", "utf8")
    .includes("mergeReaderEvidenceProse"),
);
assert.ok(
  fs.readFileSync("components/poju/MainDeliveryView.tsx", "utf8")
    .includes("mergeReaderEvidenceProse"),
);
assert.ok(
  fs.readFileSync("components/cross-product/RichReadingText.tsx", "utf8")
    .includes("mergeReaderEvidenceProse"),
);

assert.ok(
  faceSlots.includes("dps-face02-reader-evidence") ||
    faceSlots.includes("Face02ReaderEvidenceFold"),
);

const dps = fs.readFileSync(
  "components/poju/delivery-pages/DeliveryPageSlots.tsx",
  "utf8",
);
assert.ok(dps.includes("slotEvidence={slotEvidence}"));
assert.ok(
  dps.includes('from "@/components/poju/delivery-pages/DualEvidenceBody"'),
);
assert.equal(dps.includes("function DualEvidenceBody"), false);

const shared = fs.readFileSync(
  "components/poju/delivery-pages/DualEvidenceBody.tsx",
  "utf8",
);
assert.ok(shared.includes('presentation = "prose"'), "reader default must be prose");
assert.ok(shared.includes("mergeReaderEvidenceProse"));
assert.ok(shared.includes("dualEvidenceSectionTitles"), "tracks mode retained for Lab");

const book = fs.readFileSync("components/poju/DeliveryBookStage.tsx", "utf8");
assert.ok(
  book.includes("mergeReaderEvidenceProse"),
  "DeliveryBookStage evidence must prose-normalize",
);

const report = fs.readFileSync("components/poju/DeliveryReportV2.tsx", "utf8");
assert.ok(
  report.includes("mergeReaderEvidenceProse"),
  "DeliveryReportV2 evidence must prose-normalize",
);

const rich = fs.readFileSync(
  "components/cross-product/RichReadingText.tsx",
  "utf8",
);
assert.ok(
  rich.includes("mergeReaderEvidenceProse"),
  "RichReadingText evidence folds must prose-normalize",
);

const main = fs.readFileSync("components/poju/MainDeliveryView.tsx", "utf8");
assert.ok(
  main.includes("mergeReaderEvidenceProse"),
  "MainDeliveryView rationale fold must prose-normalize",
);

console.log("test-face02-evidence-fold-ui: ok");
