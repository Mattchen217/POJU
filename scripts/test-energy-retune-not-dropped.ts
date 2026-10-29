/**
 * Call B · energy_retune must survive 6-cap parse + dual-party patch.
 * Repro of Lab lab_mvt4dzhh Trace: RAW had e1 energy_retune but job failed
 * missing_energy_retune_agenda (blind slice(0,6) / push+trim drop).
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/test-energy-retune-not-dropped.ts
 */
import assert from "node:assert/strict";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";
import { parseInvestigationAgenda } from "@/lib/poju/investigation-agenda";
import {
  ensureAgendaSpineCoverage,
  isDualPartyPivotCase,
  validateAgendaSpineCoverage,
} from "@/lib/llm/deepseek/agenda-spine-coverage";
import { parseSanitizeAgendaBridge } from "@/lib/llm/deepseek/breakthrough-core";

const P7_Q =
  "我在考虑要不要从现在的城市迁移到另一个城市换工作（事业换场）。一面是更高的岗位和收入，一面是离开已有团队和家人支持。请帮我判断该不该动、什么条件下能动。";

const core = makeTestBreakthroughCore({
  situation_conclusion: "事业换场：高岗 vs 离开家人支持。",
  response: "分析占位",
  key_crossroads: {
    real_fork: "动还是不动",
    path_costs: "离开团队与家人支持",
    decision_traits: "",
    structural_basis: "官禄迁移",
    needs_validation: "目标城机会是否真实？家人支持断档如何补？储蓄能撑多久？",
  },
  modern_action_frames: [
    {
      direction: "先远程试岗",
      why_fits: "",
      structural_basis: "",
      needs_validation: "对方是否接受远程试用？",
      status: "hypothesis",
    },
    {
      direction: "本地升档再议迁移",
      why_fits: "",
      structural_basis: "",
      needs_validation: "本地升档窗口多久？",
      status: "hypothesis",
    },
    {
      direction: "分阶段搬家",
      why_fits: "",
      structural_basis: "",
      needs_validation: "分阶段成本与周期？",
      status: "hypothesis",
    },
  ],
  energy_retune_frame: {
    direction_fit: "先稳情绪再决策",
    timing_ripeness: "条件齐再动",
    daily_retune: "降温与边界练习",
    complementary: "避开硬对抗家人",
    structural_basis: "用神水",
    needs_validation: "你现在有没有即时降温/回应家人的空间？",
    status: "hypothesis",
  },
});

const ctx = {
  original_question: P7_Q,
  question_category: "career" as const,
  pivot_chart_path: "solo" as const,
};

assert.equal(isDualPartyPivotCase(core, ctx), true, "家人支持 → dual heuristic");

/** Case A: 7-row RAW with e1 last — old slice(0,6) dropped e1. */
const sevenRaw = [
  {
    id: "a1",
    label: "远程试岗可行性",
    critical: true,
    status: "unexplored",
    frame_kind: "modern_action",
    frame_index: 1,
    supports: "先远程试岗",
    serves_page: "05",
  },
  {
    id: "a2",
    label: "本地升档窗口",
    critical: true,
    status: "unexplored",
    frame_kind: "modern_action",
    frame_index: 2,
    supports: "本地升档再议迁移",
    serves_page: "05",
  },
  {
    id: "a3",
    label: "分阶段搬家成本",
    critical: true,
    status: "unexplored",
    frame_kind: "modern_action",
    frame_index: 3,
    supports: "分阶段搬家",
    serves_page: "06",
  },
  {
    id: "k1",
    label: "对方角色与权力位",
    critical: true,
    status: "unexplored",
    frame_kind: "key_crossroads",
    supports: "家人支持",
    serves_page: "08",
  },
  {
    id: "k2",
    label: "对方可观察行为态度",
    critical: true,
    status: "unexplored",
    frame_kind: "key_crossroads",
    supports: "家人态度",
    serves_page: "08",
  },
  {
    id: "k3",
    label: "你的硬底线或不可逆成本",
    critical: true,
    status: "unexplored",
    frame_kind: "key_crossroads",
    supports: "储蓄能撑多久",
    serves_page: "08",
  },
  {
    id: "e1",
    label: "即时回应与降温空间",
    critical: true,
    status: "unexplored",
    frame_kind: "energy_retune",
    supports: "先稳情绪再决策",
    serves_page: "08",
  },
];

const parsed7 = parseInvestigationAgenda(sevenRaw);
assert.ok(parsed7, "parse 7-row agenda");
assert.ok(
  parsed7!.some((a) => a.frame_kind === "energy_retune" || a.id === "e1"),
  "cap must keep energy_retune when RAW has e1 last",
);
const ensuredA = ensureAgendaSpineCoverage(parsed7!, core, ctx);
assert.ok(ensuredA.some((a) => a.frame_kind === "energy_retune"));
assert.equal(validateAgendaSpineCoverage(ensuredA, core, ctx).ok, true);

/** Case B: 6-cap already full dual themes, no energy_retune — must stamp, not throw. */
const noRetune: AgendaItem[] = [
  {
    id: "a1",
    label: "远程试岗可行性",
    critical: true,
    status: "unexplored",
    frame_kind: "modern_action",
    frame_index: 1,
    supports: "先远程试岗",
    serves_page: "05",
    role: "fill",
  },
  {
    id: "a2",
    label: "本地升档窗口",
    critical: true,
    status: "unexplored",
    frame_kind: "modern_action",
    frame_index: 2,
    supports: "本地升档再议迁移",
    serves_page: "05",
    role: "fill",
  },
  {
    id: "a3",
    label: "分阶段搬家成本",
    critical: true,
    status: "unexplored",
    frame_kind: "modern_action",
    frame_index: 3,
    supports: "分阶段搬家",
    serves_page: "06",
    role: "fill",
  },
  {
    id: "k1",
    label: "对方角色与权力位",
    critical: true,
    status: "unexplored",
    frame_kind: "key_crossroads",
    supports: "家人支持",
    serves_page: "08",
    role: "fill",
  },
  {
    id: "k2",
    label: "对方可观察行为态度",
    critical: true,
    status: "unexplored",
    frame_kind: "key_crossroads",
    supports: "态度",
    serves_page: "08",
    role: "calibrate",
  },
  {
    id: "k3",
    label: "你的硬底线或不可逆成本",
    critical: true,
    status: "unexplored",
    frame_kind: "key_crossroads",
    supports: "储蓄能撑多久",
    serves_page: "08",
    role: "fill",
  },
];

assert.ok(
  validateAgendaSpineCoverage(noRetune, core, ctx).ok === false &&
    (validateAgendaSpineCoverage(noRetune, core, ctx) as { gaps: string[] }).gaps.includes(
      "missing_energy_retune_agenda",
    ),
);
const ensuredB = ensureAgendaSpineCoverage(noRetune, core, ctx);
assert.ok(ensuredB.some((a) => a.frame_kind === "energy_retune"), "stamp energy_retune at 6-cap");
assert.equal(validateAgendaSpineCoverage(ensuredB, core, ctx).ok, true);

/** Full Call B parse with 7-row JSON (e1 last). */
const rawJson = JSON.stringify({
  investigation_agenda: sevenRaw,
  first_question: "刚才分析里，哪一点最不像你现在的处境？",
  options: ["机会不够真", "家人支持断了补不上", "其实情绪先顶不住"],
});
const bridged = parseSanitizeAgendaBridge(rawJson, "zh", core, ctx);
assert.ok(
  bridged.investigation_agenda.some((a) => a.frame_kind === "energy_retune"),
  "parseSanitizeAgendaBridge must not throw missing_energy_retune_agenda",
);
assert.ok(bridged.options && bridged.options.length >= 2);

console.log("ok · energy_retune not dropped", {
  dual: true,
  caseA_ids: ensuredA.map((a) => `${a.id}:${a.frame_kind}`),
  caseB_ids: ensuredB.map((a) => `${a.id}:${a.frame_kind}`),
});
