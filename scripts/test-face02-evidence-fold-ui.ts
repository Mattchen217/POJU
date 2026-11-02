/**
 * Face02 reader evidence fold: dual/triple split + UI wiring smoke.
 * Ensures destiny + science + convergence evidence can all surface.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  composeTripleEvidence,
  splitDualEvidence,
} from "../lib/llm/pro/delivery/page-schema/dual-evidence";

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
assert.ok(composed.evidence.includes("meta-a"));
assert.ok(composed.evidence.includes("sci-b"));
assert.ok(composed.evidence.includes("conv-c"));

const faceSlots = fs.readFileSync(
  "components/poju/delivery-pages/faces/FacePageSlots.tsx",
  "utf8",
);
assert.ok(
  faceSlots.includes("slotEvidence"),
  "FacePageSlots must accept slotEvidence",
);
assert.ok(
  faceSlots.includes("DualEvidenceBody"),
  "FacePageSlots must render DualEvidenceBody",
);
assert.ok(
  faceSlots.includes('faceId === "02" && segmentId === "D"'),
  "Face02 D anchors must fold",
);
assert.ok(
  faceSlots.includes("evAt(slotEvidence, index)"),
  "FacePageSlots must map evidence 1:1 by field index",
);
assert.ok(
  faceSlots.includes("tagFace02Evidence"),
  "FacePageSlots must retag Face02 soft evidence by segment",
);

const dps = fs.readFileSync(
  "components/poju/delivery-pages/DeliveryPageSlots.tsx",
  "utf8",
);
assert.ok(
  dps.includes("slotEvidence={slotEvidence}"),
  "DeliveryPageSlots must pass slotEvidence into FacePageSlots",
);
assert.ok(
  dps.includes('from "@/components/poju/delivery-pages/DualEvidenceBody"'),
  "DeliveryPageSlots must use shared DualEvidenceBody",
);
assert.equal(
  dps.includes("function DualEvidenceBody"),
  false,
  "local DualEvidenceBody should be removed",
);

const shared = fs.readFileSync(
  "components/poju/delivery-pages/DualEvidenceBody.tsx",
  "utf8",
);
assert.ok(shared.includes("交汇依据"));
assert.ok(shared.includes("convergence"));

console.log("test-face02-evidence-fold-ui: ok");
