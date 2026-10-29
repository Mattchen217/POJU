/**
 * Stage2 face agenda contract — blueprint + normalizeServesPage + Call B hint.
 *   node node_modules/tsx/dist/cli.mjs scripts/test-face-agenda-stage2.ts
 */
import assert from "node:assert/strict";
import {
  FACE_AGENDA_BLUEPRINT,
  FACE_AGENDA_NEEDS_REALITY,
  FACE_AGENDA_SERVES_PAGE_IDS,
} from "../lib/poju/report-blueprint";
import {
  normalizeServesPage,
  resolveAgendaPageAnchors,
} from "../lib/poju/investigation-agenda";
import { buildAgendaBridgePrompt } from "../lib/llm/deepseek/breakthrough-core";
import { buildSynthesisPrompt, SYNTHESIS_TASK } from "../lib/llm/deepseek/synthesis-task";
import { fillDutyForKey } from "../lib/llm/pro/delivery/page-prompts";
import { fillShapeSkeletonForKey } from "../lib/llm/pro/delivery/page-schema/fill-shape-skeleton";
import { faceJsonHasLegacyPrimaryBackup } from "../lib/llm/pro/delivery/page-schema/face-types";
import { page07Applies, deliveryTopicFromSignals } from "../lib/llm/pro/delivery/slice-for-page";
import type { BreakthroughCore } from "../lib/poju/agent-state";

assert.ok(FACE_AGENDA_BLUEPRINT.some((r) => r.faceId === "07" && r.topic_gated));
assert.ok(FACE_AGENDA_NEEDS_REALITY.every((r) => !r.topic_gated));
assert.ok(FACE_AGENDA_NEEDS_REALITY.some((r) => r.faceId === "01"));
assert.ok(FACE_AGENDA_NEEDS_REALITY.some((r) => r.faceId === "05"));
assert.ok(!FACE_AGENDA_NEEDS_REALITY.some((r) => r.faceId === "07"));

assert.equal(normalizeServesPage("06"), "06");
assert.equal(normalizeServesPage("execution_guidance"), "06");
assert.equal(normalizeServesPage("recommended_strategy"), "05");
assert.equal(normalizeServesPage("decision_brief"), undefined);
assert.equal(normalizeServesPage("02"), undefined);
assert.equal(normalizeServesPage("03"), undefined);

const anchors = resolveAgendaPageAnchors({}, "modern_action");
assert.equal(anchors.serves_page, "06");
assert.equal(
  (anchors as { serves_path?: string }).serves_path,
  undefined,
  "new agenda must not write serves_path",
);

const p7q =
  "我在考虑要不要从现在的城市迁移到另一个城市换工作（事业换场）。一面是更高的岗位和收入，一面是离开已有团队和家人支持。";
const topic = deliveryTopicFromSignals({ question: p7q });
assert.ok(topic && page07Applies(topic), `P7 topic should apply, got ${topic}`);

const stubCore = {
  response: "分析占位",
  situation_conclusion: "占位",
  key_crossroads: {
    real_fork: "动还是不动",
    path_costs: "离开支持",
    decision_traits: "",
    structural_basis: "",
    needs_validation: "目标城机会是否真实",
  },
  multi_dimension_reckoning: [],
  modern_action_frames: [],
  energy_retune_frame: {
    direction_fit: "",
    timing_ripeness: "",
    daily_retune: "",
    complementary: "",
    structural_basis: "",
    needs_validation: "",
    status: "hypothesis",
  },
  rhythm_frame: {
    phase1_observe: "",
    phase2_adjust: "",
    phase3_consolidate: "",
  },
  self_check_signals: [],
} as unknown as BreakthroughCore;

const { system, user } = buildAgendaBridgePrompt({
  breakthrough_core: stubCore,
  original_question: p7q,
  locale: "zh",
  segment1_understanding: "问题：是否迁移换场。期望：条件清楚再动。",
});

assert.match(system, /face id|face-native|01 \| 04 \| 05/);
assert.doesNotMatch(system, /serves_path："primary"/);
assert.doesNotMatch(system, /撑得起交付是汇总段/);
assert.match(user, /face 07|face 01|face 05/);
assert.match(user, /禁止 serves_path|禁止主辅/);
assert.doesNotMatch(user, /serves_page=九模块/);

for (const id of FACE_AGENDA_SERVES_PAGE_IDS) {
  assert.ok(typeof id === "string" && id.length === 2);
}


assert.doesNotMatch(SYNTHESIS_TASK, /主路径要能撑起交付|撑得起报告·自检/);
assert.match(SYNTHESIS_TASK, /face 现实槽自检/);

const syn = buildSynthesisPrompt({
  job_input: {
    kind: "synthesis",
    multi_dimension_reckoning: [],
    desired_outcome: "条件清楚再动",
    original_question: p7q,
    question_category: "career",
    covered_agenda: [],
    structured_inventory: "",
    report_pages: FACE_AGENDA_BLUEPRINT.filter((p) => p.input_role === "needs_reality").map((p) => ({
      id: p.faceId,
      title: p.title,
      purpose: p.reality_needs.join("；"),
    })),
  },
  locale: "zh",
});
assert.doesNotMatch(syn.system + syn.user, /主路径要能撑起交付|撑得起报告自检/);
assert.match(syn.user, /face 现实槽/);
assert.ok(syn.user.includes("01") && syn.user.includes("05"));

assert.throws(() => fillDutyForKey("01" as never, "脸"), /refused face/);
const sk = fillShapeSkeletonForKey("01");
assert.ok(sk && !faceJsonHasLegacyPrimaryBackup(sk));
assert.equal(sk?.main_recommendation, "");

console.log("ok · face agenda stage2", {
  topic,
  needs_reality_faces: FACE_AGENDA_NEEDS_REALITY.map((r) => r.faceId),
  call_b_mentions_07: /face 07/.test(user),
});
