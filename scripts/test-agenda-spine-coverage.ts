/**
 * Call B 备料全覆盖 — validate + patch smoke tests.
 * Run: pnpm exec tsx scripts/test-agenda-spine-coverage.ts
 */

import assert from "node:assert/strict";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";
import {
  ensureAgendaSpineCoverage,
  isDualPartyPivotCase,
  patchAgendaSpineCoverage,
  validateAgendaSpineCoverage,
} from "@/lib/llm/deepseek/agenda-spine-coverage";

const careerDualCore = makeTestBreakthroughCore({
  situation_conclusion: "大厂中层内耗，男友与家人反对离职创业。",
  key_crossroads: {
    real_fork: "继续忍受 / 完全离职 / 中间路线",
    path_costs: "维持消耗健康；离职经济与家人压力",
    decision_traits: "身弱谨慎但才华欲表达",
    structural_basis: "官杀重压",
    needs_validation: "咨询是否已有市场验证？储蓄能撑多久？反对的核心点是什么？",
  },
  modern_action_frames: [
    {
      direction: "在职影子咨询试水",
      why_fits: "偏印化杀",
      structural_basis: "子水用神",
      needs_validation: "是否已有潜在客户？每周能抽出多少精力？",
      status: "hypothesis",
    },
    {
      direction: "协商灵活工作安排",
      why_fits: "月德回旋",
      structural_basis: "月德贵人",
      needs_validation: "公司文化是否允许灵活安排？",
      status: "hypothesis",
    },
    {
      direction: "建立个人品牌基础",
      why_fits: "德秀才华",
      structural_basis: "德秀贵人",
      needs_validation: "是否愿意公开分享专业见解？",
      status: "hypothesis",
    },
  ],
  energy_retune_frame: {
    direction_fit: "向水调频",
    timing_ripeness: "宜缓不宜急",
    daily_retune: "每日独处充电",
    complementary: "非对抗沟通",
    structural_basis: "用神水",
    needs_validation: "她与男友的沟通模式是怎样的？",
    status: "hypothesis",
  },
});

/** Sample-like thin agenda (all science_action, missing binary + retune). */
const thinAgenda: AgendaItem[] = [
  {
    id: "ag1",
    label: "你的咨询试水经历",
    critical: true,
    status: "unexplored",
    frame_kind: "modern_action",
    frame_index: 1,
    supports: "影子咨询",
    serves_page: "science_action",
    serves_path: "primary",
    role: "fill",
  },
  {
    id: "ag2",
    label: "每周可腾出的精力",
    critical: true,
    status: "unexplored",
    frame_kind: "modern_action",
    frame_index: 1,
    supports: "影子咨询",
    serves_page: "science_action",
    serves_path: "primary",
    role: "fill",
  },
  {
    id: "ag3",
    label: "你的经济安全垫",
    critical: true,
    status: "unexplored",
    frame_kind: "key_crossroads",
    supports: "分岔",
    serves_page: "science_action",
    serves_path: "both",
    role: "fill",
  },
  {
    id: "ag4",
    label: "家人反对的真正焦点",
    critical: true,
    status: "unexplored",
    frame_kind: "key_crossroads",
    supports: "关系成本",
    serves_page: "science_action",
    serves_path: "both",
    role: "calibrate",
  },
];

const ctx = {
  original_question: "大厂8年想离职做独立咨询，男友和家人反对",
  question_category: "career" as const,
};

{
  assert.equal(isDualPartyPivotCase(careerDualCore, ctx), true);
  const before = validateAgendaSpineCoverage(thinAgenda, careerDualCore, ctx);
  assert.equal(before.ok, false);
  assert.ok(before.ok === false && before.gaps.includes("serves_page_all_science_action"));
  console.log("ok thin agenda fails coverage");
}

{
  const patched = patchAgendaSpineCoverage(thinAgenda, careerDualCore, ctx);
  assert.ok(patched.length >= 3 && patched.length <= 6);
  assert.ok(patched.some((a) => a.frame_kind === "energy_retune"));
  assert.ok(patched.some((a) => a.frame_index === 2));
  assert.ok(patched.some((a) => a.frame_index === 3));
  const pages = new Set(patched.map((a) => a.serves_page).filter(Boolean));
  assert.ok(pages.has("science_action"));
  assert.ok(pages.has("risk_guard") || pages.has("metaphysics_action"));
  const after = validateAgendaSpineCoverage(patched, careerDualCore, ctx);
  assert.equal(after.ok, true);
  console.log("ok patch fixes sample-like thin agenda");
}

{
  const ensured = ensureAgendaSpineCoverage(thinAgenda, careerDualCore, ctx);
  assert.equal(ensured.filter((a) => a.critical).length >= 3, true);
  console.log("ok ensureAgendaSpineCoverage end-to-end");
}

console.log("\nAll agenda spine coverage tests passed.");
