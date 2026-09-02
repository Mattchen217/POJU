/**
 * User sample Call B parse + coverage (2026-09-01).
 * Run: pnpm exec tsx scripts/test-user-sample-callb.ts
 */

import assert from "node:assert/strict";
import { parseSanitizeAgendaBridge } from "@/lib/llm/deepseek/breakthrough-core";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";

const core = makeTestBreakthroughCore({
  energy_structure: "乙木日主，如藤萝柔韧，生于秋金旺盛之时。",
  situation_conclusion:
    "困境根于「身弱见官杀」的结构性张力：大厂中层如官杀化身，规则、竞争、高压层层加身。",
  key_crossroads: {
    real_fork: "继续留在大厂熬着 vs. 离职做独立咨询",
    path_costs: "留：持续内耗；走：短期收入不稳",
    decision_traits: "身弱官杀重，遇抉择易犹豫",
    structural_basis: "官杀显，用神水可化杀",
    needs_validation:
      "用户实际财务状况（积蓄能否支撑过渡期）；独立咨询的市场需求与初步验证；男朋友和家人反对的具体担忧",
  },
  modern_action_frames: [
    {
      direction: "业余时间试水咨询业务，降低全面转型风险。",
      why_fits: "用神水主智慧谋划",
      structural_basis: "身弱用神水",
      needs_validation: "用户是否有业余时间和精力投入？",
      status: "hypothesis",
    },
    {
      direction: "与男友及家人进行结构化沟通",
      why_fits: "月德贵人提供人际回旋空间",
      structural_basis: "月德贵人、将星",
      needs_validation: "家人和男友的核心恐惧是什么？",
      status: "hypothesis",
    },
    {
      direction: "在现职中设置边界，减少无意义内耗",
      why_fits: "官杀重压可通过印化缓解",
      structural_basis: "官杀显",
      needs_validation: "用户在工作中是否有授权或拒绝的余地？",
      status: "hypothesis",
    },
  ],
  energy_retune_frame: {
    direction_fit: "向水调频",
    timing_ripeness: "宜守中选点",
    daily_retune: "每日安排水时间",
    complementary: "善用月德贵人",
    structural_basis: "用神水",
    needs_validation: "用户是否愿意尝试这些微调？",
    status: "hypothesis",
  },
  rhythm_frame: {
    phase1_observe: "第1-10天：观察能量消耗点",
    phase2_adjust: "第11-20天：尝试小边界",
    phase3_consolidate: "第21-30天：巩固调整",
  },
  self_check_signals: ["睡得好吗", "还想回大厂吗", "家庭是否支持"],
  multi_dimension_reckoning: [
    { dimension: "官杀重压", chart_basis: "乙木身弱", judgment: "大厂中层长期承压" },
    { dimension: "大运转机", chart_basis: "甲子大运", judgment: "气候交织宜守中选点" },
    { dimension: "感情镜像", chart_basis: "子未相害", judgment: "家人反对是外部扰动" },
  ],
  response: "### 你卡在哪里\n测试",
});

const callBRaw = JSON.stringify({
  investigation_agenda: [
    {
      id: "agenda_1",
      label: "你的经济安全垫",
      critical: true,
      status: "unexplored",
      frame_kind: "key_crossroads",
      supports: "验证业余试水假设的可行性",
      serves_page: "science_action",
      serves_path: "both",
      role: "fill",
      collection_goal: "确认积蓄可覆盖几个月基本生活",
    },
    {
      id: "agenda_2",
      label: "男友反对的具体担忧",
      critical: true,
      status: "unexplored",
      frame_kind: "key_crossroads",
      supports: "校准结构化沟通假设",
      serves_page: "risk_guard",
      serves_path: "primary",
      role: "calibrate",
      collection_goal: "拿到他反对的真实落点",
    },
    {
      id: "agenda_3",
      label: "你在现职能卸掉的担子",
      critical: false,
      status: "unexplored",
      frame_kind: "modern_action",
      frame_index: 2,
      supports: "验证设置边界减少内耗假设",
      serves_page: "science_action",
      serves_path: "backup",
      role: "fill",
      collection_goal: "确认至少1-2件可卸掉的非核心任务",
    },
    {
      id: "agenda_4",
      label: "你在这段关系里的硬底线",
      critical: true,
      status: "unexplored",
      frame_kind: "key_crossroads",
      supports: "判断主辅切换条件",
      serves_page: "risk_guard",
      serves_path: "primary",
      role: "calibrate",
      collection_goal: "拿到一条不可退让的底线",
    },
  ],
  first_question:
    "刚才那篇分析里，我提到你现在最稳妥的破局点是'业余试水'——不裸辞，用下班时间先验证咨询方向能不能跑通。但这个策略成立的前提，是你有足够的经济缓冲，不用在焦虑里仓促做决定。所以我想先确认一个很实际的问题：以你目前的积蓄和每月固定支出，如果完全不靠工资，大概能撑几个月？",
  options: [
    "能撑6个月以上，经济压力不是首要问题",
    "能撑3-6个月，有点紧但还能扛",
    "不到3个月，断收入会很焦虑",
  ],
});

const parsed = parseSanitizeAgendaBridge(callBRaw, "zh", core, {
  original_question: "大厂8年想离职做独立咨询，男友和家人反对",
  question_category: "career",
});

assert.ok(parsed.first_question.includes("积蓄"));
assert.ok(parsed.investigation_agenda.length >= 4);
console.log("ok user sample Call B parses + coverage passes");
console.log("  agenda items:", parsed.investigation_agenda.length);
console.log("  first_question preview:", parsed.first_question.slice(0, 60) + "…");
