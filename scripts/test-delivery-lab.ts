/**
 * Delivery Lab smoke — cursor lock, bootstrap/thesis/prealloc, approve gate, rerun stale.
 * No OpenRouter. Run: pnpm exec tsx scripts/test-delivery-lab.ts
 */

import assert from "node:assert/strict";
import { createDeliveryLab, loadDeliveryLab } from "../lib/llm/pro/delivery/lab/store";
import {
  approveLabStep,
  prepareLabRerun,
  runLabStep,
} from "../lib/llm/pro/delivery/lab/run-step";
import { LAB_STEP_DEFS } from "../lib/llm/pro/delivery/lab/types";

/** Enough fields for buildChartThesisFromStructured (pillars year+da_yun). */
const minimalBase = {
  structured: {
    day_master: "甲木",
    pattern: "lab_smoke",
    yong_shen: "水",
    xi_shen: ["金"],
    ji_shen: ["火"],
    strength: "weak",
    four_pillars: { year: "甲子", month: "丙寅", day: "戊午", hour: "癸亥" },
    pillars_detail: {
      year: {
        ganzhi: "甲子",
        stem: "甲",
        branch: "子",
        ten_god: "比肩",
        hidden_stems: ["癸"],
        shen_sha: [],
      },
      month: {
        ganzhi: "丙寅",
        stem: "丙",
        branch: "寅",
        ten_god: "食神",
        hidden_stems: ["甲", "丙", "戊"],
        shen_sha: [],
      },
      day: {
        ganzhi: "戊午",
        stem: "戊",
        branch: "午",
        ten_god: "日主",
        hidden_stems: ["丁", "己"],
        shen_sha: [],
      },
      hour: {
        ganzhi: "癸亥",
        stem: "癸",
        branch: "亥",
        ten_god: "正财",
        hidden_stems: ["壬", "甲"],
        shen_sha: [],
      },
    },
    da_yun: [{ ganzhi: "丁卯", start_age: 32, start_year: 2026 }],
    data_availability: {
      pillars_detail: true,
      da_yun: true,
      bazi_enrichment: false,
    },
  },
  content: "lab smoke",
};

assert.ok(LAB_STEP_DEFS.length >= 20, "step defs present");
assert.equal(LAB_STEP_DEFS[0]!.step_key, "bootstrap");
assert.equal(LAB_STEP_DEFS[1]!.step_key, "thesis.gen");
assert.equal(LAB_STEP_DEFS[2]!.step_key, "prealloc");

async function main() {
  const lab = await createDeliveryLab({
    ops_user: "smoke",
    source: {
      locale: "zh",
      original_question: "我该不该换工作？",
      desired_outcome: "想更稳",
      base_analysis: minimalBase,
    },
  });
  assert.equal(lab.cursor_index, 0);
  assert.ok(lab.lab_id.startsWith("lab_"));

  // Locked: cannot run thesis before bootstrap approve
  const locked = await runLabStep(lab, "thesis.gen");
  assert.equal(locked.ok, false);
  assert.equal(locked.reason, "step_locked_approve_prior");

  // Bootstrap
  let cur = (await loadDeliveryLab(lab.lab_id))!;
  const boot = await runLabStep(cur, "bootstrap");
  assert.equal(boot.ok, true);
  assert.ok(boot.attempt?.gate_verdict.passed);

  cur = boot.lab;
  const apBoot = await approveLabStep(cur, "bootstrap");
  assert.equal(apBoot.ok, true);
  assert.equal(apBoot.lab.cursor_index, 1);

  // Thesis (deterministic, no LLM)
  cur = apBoot.lab;
  const thesis = await runLabStep(cur, "thesis.gen");
  assert.equal(thesis.ok, true, !thesis.ok ? thesis.reason : undefined);
  assert.ok(thesis.lab.artifacts.thesis);

  cur = thesis.lab;
  const apThesis = await approveLabStep(cur, "thesis.gen");
  assert.equal(apThesis.ok, true);
  assert.equal(apThesis.lab.cursor_index, 2);

  // Prealloc
  cur = apThesis.lab;
  const pre = await runLabStep(cur, "prealloc");
  assert.equal(pre.ok, true, !pre.ok ? pre.reason : undefined);
  cur = pre.lab;
  const apPre = await approveLabStep(cur, "prealloc");
  assert.equal(apPre.ok, true);

  // Gate fail → cannot approve: invalid lab
  const bad = await createDeliveryLab({
    ops_user: "smoke",
    source: {
      locale: "zh",
      original_question: "x",
      base_analysis: { content: "no structured" },
    },
  });
  const badBoot = await runLabStep(bad, "bootstrap");
  assert.equal(badBoot.ok, false);
  const deny = await approveLabStep(badBoot.lab, "bootstrap");
  assert.equal(deny.ok, false);
  assert.equal(deny.reason, "gate_not_passed");

  // Rerun marks downstream stale
  cur = apPre.lab;
  const rr = await prepareLabRerun(cur, "thesis.gen");
  assert.equal(rr.ok, true);
  assert.equal(rr.lab.cursor_index, 1);
  assert.equal(rr.lab.steps["prealloc"]?.status, "stale");
  assert.ok(!rr.lab.approved_order.includes("prealloc"));
  assert.ok(!rr.lab.approved_order.includes("thesis.gen"));

  console.log("ok delivery-lab smoke", {
    steps: LAB_STEP_DEFS.length,
    lab_id: lab.lab_id,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
