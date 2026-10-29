/**
 * S3 · create NEW full_pipeline Lab for P7 事业换场 (never reuse legacy ten-paper).
 * Smoke only — no LLM Trace. Quality Trace = open this lab_id in Ops UI after S1.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/s3-p7-new-lab.ts
 */
import assert from "node:assert/strict";
import { createDeliveryLab } from "../lib/llm/pro/delivery/lab/store";
import {
  LAB_STEP_DEFS_V3,
  labLooksLikeLegacyTenPaper,
} from "../lib/llm/pro/delivery/lab/types-v3";
import { page07Applies, deliveryTopicFromSignals } from "../lib/llm/pro/delivery/slice-for-page";
import { labPublicView } from "../lib/llm/pro/delivery/lab/public-view";

const P7_Q =
  "我在考虑要不要从现在的城市迁移到另一个城市换工作（事业换场）。一面是更高的岗位和收入，一面是离开已有团队和家人支持。请帮我判断该不该动、什么条件下能动。";

const minimalBase = {
  structured: {
    day_master: "甲木",
    pattern: "s3_p7_face_lab",
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
        ten_god: "偏财",
        hidden_stems: ["丁", "己"],
        shen_sha: [],
      },
      hour: {
        ganzhi: "癸亥",
        stem: "癸",
        branch: "亥",
        ten_god: "正印",
        hidden_stems: ["壬", "甲"],
        shen_sha: [],
      },
    },
    da_yun: [{ ganzhi: "己未", start_age: 8 }],
  },
};

const topic = deliveryTopicFromSignals({ question: P7_Q });
assert.ok(topic && page07Applies(topic), `P7 topic gate must hit, got ${topic}`);

assert.ok(LAB_STEP_DEFS_V3.some((d) => d.step_key === "07.gate_topic"));
assert.ok(
  !LAB_STEP_DEFS_V3.some((d) =>
    ["decision_brief", "foundation", "science_action"].includes(String(d.page ?? "")),
  ),
);

async function main() {
  const lab = await createDeliveryLab({
    ops_user: "s3-p7",
    mode: "full_pipeline",
    source: {
      locale: "zh",
      original_question: P7_Q,
      desired_outcome: "条件清楚再动；不该动时也说清边界",
      base_analysis: minimalBase,
      breakthrough_core: null,
      covered_agenda: [],
      question_category: "career",
    },
  });

  assert.equal(lab.mode, "full_pipeline");
  assert.ok(lab.lab_id.startsWith("lab_"));
  assert.notEqual(lab.lab_id, "lab_mvsvnquz");
  assert.equal(labLooksLikeLegacyTenPaper(lab), false);
  const stepKeys = Object.keys(lab.steps);
  assert.ok(stepKeys.includes("07.gate_topic"));
  assert.ok(stepKeys.some((k) => k.startsWith("01.")));
  assert.ok(stepKeys.includes("thesis.gen"), "v3 still has chart thesis step");
  assert.ok(
    !stepKeys.some(
      (k) =>
        k.startsWith("decision_brief.") ||
        k.startsWith("recommended_strategy.") ||
        k.startsWith("validation_risk."),
    ),
    "must not stamp ten-paper step keys",
  );

  const pub = labPublicView(lab) as { lab_id?: string; mode?: string };
  assert.equal(pub.mode, "full_pipeline");

  console.log("ok · S3 new P7 Lab", {
    lab_id: lab.lab_id,
    topic,
    page07: true,
    legacy_ten_paper: false,
    steps: stepKeys.length,
    open: `/ops/delivery-lab/${lab.lab_id}`,
    note: "in-memory KV if env unset — recreate via Ops UI on Preview for Trace SoT",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
