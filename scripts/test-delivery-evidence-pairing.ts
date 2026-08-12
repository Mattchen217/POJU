/**
 * Smoke: multi-### narrative expand + evidence hangs on first card of group (not last).
 */
import assert from "node:assert/strict";
import {
  countEvidenceCoverage,
  expandDeliveryArgumentByH3,
  expandDeliveryArgumentTreeByH3,
} from "@/lib/llm/pro/delivery/expand-arguments-by-h3";
import { buildDeliveryBookModules } from "@/lib/poju/build-delivery-book-modules";
import { deliveryEvidenceLeadLabel } from "@/lib/llm/pro/delivery/delivery-locale";

const lead = deliveryEvidenceLeadLabel("zh");

// --- expand ---
{
  const one = expandDeliveryArgumentByH3({
    body: "### 先试水\n\n试水正文。\n\n### 融入\n\n融入正文。\n\n### 边界\n\n边界正文。\n\n### 换赛道\n\n换赛道正文。",
  });
  assert.equal(one.length, 4, "4 ### → 4 arguments");
  assert.match(one[0]!.body, /^### 先试水/);
  assert.match(one[3]!.body, /^### 换赛道/);
  assert.equal(
    expandDeliveryArgumentByH3({ body: "### 单段\n\n只有一段。" }).length,
    1,
    "single ### stays 1",
  );
}

{
  const tree = expandDeliveryArgumentTreeByH3({
    science_action: [
      {
        body: "### A\n\na\n\n### B\n\nb",
      },
    ],
  });
  assert.equal(tree.science_action?.length, 2);
  const cov = countEvidenceCoverage(
    tree,
    { science_action: [{ evidence: "only-first" }] },
    "science_action",
  );
  assert.equal(cov.bodies, 2);
  assert.equal(cov.evidences, 1);
  assert.deepEqual(cov.missingIndexes, [1]);
}

// --- book modules: evidence after multi-### body → first card, not last ---
{
  const packed = `### 先试水

试水正文。

### 融入

融入正文。

### 换赛道

换赛道正文。

${lead}
试水相关的命理依据。`;

  const mods = buildDeliveryBookModules({
    pageTitle: "行为策略：行动指南",
    body: packed,
    dualLayer: true,
    pageIndex: 2,
  });
  assert.equal(mods.length, 3, "3 ### cards");
  assert.match(mods[0]!.evidence, /试水相关/);
  assert.equal(mods[1]!.evidence.trim(), "", "middle has no evidence");
  assert.equal(mods[2]!.evidence.trim(), "", "last must NOT steal evidence");
}

// --- interleaved 1:1 still works ---
{
  const interleaved = `### 先试水

试水正文。

${lead}
依据一。

### 融入

融入正文。

${lead}
依据二。`;

  const mods = buildDeliveryBookModules({
    pageTitle: "行为策略：行动指南",
    body: interleaved,
    dualLayer: true,
    pageIndex: 2,
  });
  assert.equal(mods.length, 2);
  assert.match(mods[0]!.evidence, /依据一/);
  assert.match(mods[1]!.evidence, /依据二/);
}

console.log("test-delivery-evidence-pairing: ok");
