/**
 * P4 gate_p4_relation_blur_banhe: bare「午午半合」fails; closed-set full
 * names like「午午半合火局」must pass (no substring false-positive).
 * Run: pnpm test:p4-relation-blur-banhe  (also via pnpm test:gates)
 */
import assert from "node:assert/strict";
import { gateJudgmentCategoryB } from "../lib/llm/pro/delivery/pipeline-v3/gate-judgment-category";
import type { DeepEvidencePlan } from "../lib/llm/pro/delivery/page-schema/deep-evidence-call";

function p4Plan(evidence: string, claim = "岁运张力承重"): DeepEvidencePlan {
  return {
    page: "metaphysics_action",
    units: [
      {
        path: "dimensions[3]",
        chart_anchors: ["木"],
        evidence,
        unit_claim: claim,
        calc_cite: "年支午；流年午",
        means_candidate_ref: "时机候选1",
      },
    ],
  };
}

function run(evidence: string) {
  return gateJudgmentCategoryB({
    key: "metaphysics_action",
    deep_evidence_plan: p4Plan(evidence),
  });
}

{
  const v = run("流年丙午引动午午半合火局加剧忌神张力");
  assert.equal(v, null, "午午半合火局 (closed-set full name) must PASS");
}

{
  const v = run("运岁午与年支午见午与午半合火局，火局承重偏高");
  assert.equal(v, null, "午与午半合火局 full name must PASS");
}

{
  const v = run("运岁午与年支午写成午午半合，半合名不完整");
  assert.ok(v && v.passed === false, "bare 午午半合 must FAIL");
  assert.equal(v!.failed_rule, "gate_p4_relation_blur_banhe");
}

{
  const v = run("午与午半合不足以承重，须闭集全称");
  assert.ok(v && v.passed === false, "bare 午与午半合 must FAIL");
  assert.equal(v!.failed_rule, "gate_p4_relation_blur_banhe");
}

{
  const v = run("年支午与运岁午形成半合与六合，糊墙不点全称");
  assert.ok(v && v.passed === false, "半合与六合 blur must FAIL");
  assert.equal(v!.failed_rule, "gate_p4_relation_blur_banhe");
}

{
  const v = run("流年引动午午相刑，刑名闭集全称承重");
  assert.equal(v, null, "午午相刑 alone must not trip banhe blur gate");
}

console.log("ok: gate_p4_relation_blur_banhe full-name vs bare");
