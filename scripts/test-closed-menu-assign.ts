/**
 * D1 closed-menu assign smoke (no LLM).
 * Run: pnpm exec tsx scripts/test-closed-menu-assign.ts
 */
import assert from "node:assert/strict";
import type { ChartThesis } from "../lib/llm/pro/delivery/thesis/types";
import { THESIS_DIMENSION_NAME_ZH } from "../lib/llm/pro/delivery/thesis/types";
import {
  buildThesisAssignMenu,
  isAssignMenuEligibleSlug,
} from "../lib/llm/pro/delivery/thesis/build-assign-menu";
import { preallocateFoundationSignals } from "../lib/llm/pro/delivery/page-schema/preallocate-foundation-signals";
import {
  buildDeepEvidenceAssignPrompt,
  isClosedMenuAssign,
  parseDeepEvidenceAssignment,
  planDeepEvidenceSlots,
} from "../lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import { collapseQuerentPressureStutter } from "../lib/llm/pro/delivery/thesis/validate-assignment-coverage";

const thesis: ChartThesis = {
  version: 1,
  structured_fingerprint: "closed-menu-fixture",
  generated_at: "2026-09-10T00:00:00.000Z",
  judgment_core_frozen: true,
  as_of_day: "2026-09-10",
  question_category: "career",
  dimensions: [
    {
      dimension_id: "day_master_strength",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.day_master_strength,
      depth: "full",
      strength_verdict: "身弱",
      classical_basis: [
        {
          key: "day_master",
          present: true,
          summary_zh: "日主乙木身弱；巳寅相刑加重内耗",
        },
      ],
      usable_claims_hint: ["身弱放大对安全垫的敏感"],
      wuxing_relations: [],
      conclusion_zh: "身弱",
    },
    {
      dimension_id: "interpersonal_pattern",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.interpersonal_pattern,
      depth: "full",
      classical_basis: [
        {
          key: "ten_gods",
          present: true,
          summary_zh: "时柱正官；食神泄秀",
        },
      ],
      usable_claims_hint: ["正官执行惯性"],
      wuxing_relations: [],
      conclusion_zh: "正官",
    },
    {
      dimension_id: "cycle_rhythm",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.cycle_rhythm,
      depth: "full",
      classical_basis: [
        {
          key: "current_da_yun",
          present: true,
          summary_zh: "当前大运丁酉；流年丙午",
        },
      ],
      usable_claims_hint: ["丁酉大运"],
      wuxing_relations: [],
      conclusion_zh: "丁酉",
    },
    {
      dimension_id: "favor_avoid_tuning",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.favor_avoid_tuning,
      depth: "brief",
      classical_basis: [
        {
          key: "yong_shen",
          present: true,
          summary_zh: "用神：水",
        },
      ],
      usable_claims_hint: ["用神水"],
      wuxing_relations: [],
      conclusion_zh: "用神水",
    },
    {
      dimension_id: "resource_pattern",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.resource_pattern,
      depth: "brief",
      classical_basis: [
        {
          key: "wealth_gods",
          present: true,
          summary_zh: "财星藏而不显：日支辰中戊（正财）",
        },
      ],
      usable_claims_hint: ["ten_god_hidden:正财"],
      wuxing_relations: [],
      conclusion_zh: "正财",
    },
    {
      dimension_id: "expression_creativity",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.expression_creativity,
      depth: "full",
      classical_basis: [
        {
          key: "output_gods",
          present: true,
          summary_zh: "食神：时柱食神；日支藏丁（食神）",
        },
      ],
      usable_claims_hint: ["ten_god:食神"],
      wuxing_relations: [],
      conclusion_zh: "食神",
    },
  ],
};

{
  assert.equal(isAssignMenuEligibleSlug("金舆"), true); // eligible filter is hollow/changsheng/bare only
  assert.equal(isAssignMenuEligibleSlug("癸"), false);
  assert.equal(isAssignMenuEligibleSlug("大运"), false);
  assert.equal(isAssignMenuEligibleSlug("长生"), false);
  assert.equal(isAssignMenuEligibleSlug("食神"), true);
  assert.equal(isAssignMenuEligibleSlug("丁酉"), true);

  const menu = buildThesisAssignMenu(thesis);
  const slugs = menu.map((m) => m.slug);
  assert.ok(slugs.includes("身弱"), "menu has 身弱");
  assert.ok(slugs.includes("正官") || slugs.includes("食神"), "menu has ten gods");
  assert.ok(slugs.includes("丁酉"), "menu has 丁酉");
  assert.ok(!slugs.includes("金舆"), "menu excludes 金舆 (not in thesis)");
  assert.ok(!slugs.includes("癸"), "menu excludes bare stem");
  assert.ok(!slugs.includes("大运"), "menu excludes hollow");
  assert.ok(!menu.some((m) => m.slug === "长生"), "no changsheng");
}

{
  const paths = [
    "why_cards[0]",
    "why_cards[1]",
    "why_cards[2]",
    "why_cards[3]",
    "why_cards[4]",
  ];
  const alloc = preallocateFoundationSignals({ thesis, paths });
  if (!alloc.ok) {
    throw new Error(alloc.reason);
  }
  assert.equal(alloc.ok, true);
  const primaries = paths.map((p) => alloc.by_path[p]![0]!.slug);
  assert.equal(new Set(primaries).size, paths.length, "page-local unique primaries");
  for (const p of paths) {
    assert.equal(alloc.by_path[p]!.length, 1, "exactly one signal per card");
  }
}

{
  const planned = planDeepEvidenceSlots("foundation", {
    key: "foundation",
    chart_thesis: thesis,
    foundation_surface_feed: `表象候选1: a
表象候选2: b
表象候选3: c
表象候选4: d
表象候选5: e
【派工绑定建议表】
path=why_cards[0] cite=安全垫薄 claim=结构上安全垫偏薄
path=why_cards[1] cite=话语权弱 claim=从属加入
path=why_cards[2] cite=精力紧 claim=时间余量少
path=why_cards[3] cite=伙伴全职 claim=兼职难开口
path=why_cards[4] cite=期望面 claim=冲且守底线
`,
  });
  assert.ok(isClosedMenuAssign(planned), "foundation+thesis → closed menu");
  assert.ok(planned.every((p) => p.locked_signals?.[0]?.slug === p.prefer_primary));

  const { system, user } = buildDeepEvidenceAssignPrompt(
    "foundation",
    {
      locale: "zh",
      core_conclusion: "主辅可立",
      chart_thesis: thesis,
      chart_thesis_block: "## 命盘总纲\n身弱",
    },
    planned,
  );
  assert.ok(system.includes("禁止】改 slug") || system.includes("禁止改 slug") || system.includes("【禁止】改 slug"));
  assert.ok(system.includes("closed-menu") || system.includes("已由代码锁死"));
  assert.ok(user.includes("locked_signals="));
  assert.ok(
    user.includes("不得入 slug") || user.includes("禁止写入 necessary_signals.slug"),
  );
  assert.ok(!system.includes("真词来自闭集菜单且须总纲可证；禁止编造；跨 path 主承重词错开"), "open free-pick block not in closed system");

  // Model invents wrong slug — parse force-overwrites
  const raw = {
    page: "foundation",
    units: planned.map((p) => ({
      path: p.path,
      unit_claim: p.prefer_claim ?? "结构主张足够长",
      calc_cite: p.prefer_cite ?? "真算摘录足够",
      means_candidate_ref: p.prefer_candidate_ref ?? "表象候选1",
      chart_anchors: ["金舆"],
      necessary_signals: [
        {
          slug: "金舆",
          dimension_id: "resource_pattern",
          inference_zh: "从本维推出针对本主张的结构推论不得粘贴总纲",
          role: "解释本卡表象的结构原因",
          why_needed: "去掉此信号后无法解释本卡表象缺口",
        },
      ],
      removal_test: { passed: true, notes: "ok" },
      signal_count_rationale: "1个——派工表锁定",
    })),
  };
  const parsed = parseDeepEvidenceAssignment("foundation", raw, planned);
  assert.ok(parsed);
  for (let i = 0; i < planned.length; i++) {
    const lockedSlug = planned[i]!.locked_signals![0]!.slug;
    assert.equal(parsed!.units[i]!.necessary_signals![0]!.slug, lockedSlug);
    assert.equal(
      parsed!.units[i]!.necessary_signals![0]!.dimension_id,
      planned[i]!.locked_signals![0]!.dimension_id,
    );
    assert.ok(!parsed!.units[i]!.chart_anchors.includes("金舆"));
  }

  // Missing inference → fail
  const bad = {
    page: "foundation",
    units: [
      {
        path: planned[0]!.path,
        unit_claim: "结构主张足够长啊",
        calc_cite: "真算摘录足够了",
        means_candidate_ref: "表象候选1",
        chart_anchors: [planned[0]!.locked_signals![0]!.slug],
        necessary_signals: [
          {
            slug: planned[0]!.locked_signals![0]!.slug,
            dimension_id: planned[0]!.locked_signals![0]!.dimension_id,
            inference_zh: "",
            role: "解释",
            why_needed: "去掉此信号后无法解释缺口",
          },
        ],
        removal_test: { passed: true, notes: "ok" },
        signal_count_rationale: "1个——派工表锁定",
      },
    ],
  };
  const failOut = { reason: "" };
  // Need enough units for min — pad with good units
  const padded = {
    page: "foundation",
    units: planned.map((p, idx) =>
      idx === 0
        ? bad.units[0]!
        : {
            path: p.path,
            unit_claim: p.prefer_claim ?? "结构主张足够长啊",
            calc_cite: p.prefer_cite ?? "真算摘录足够了",
            means_candidate_ref: p.prefer_candidate_ref ?? "表象候选1",
            chart_anchors: [p.locked_signals![0]!.slug],
            necessary_signals: [
              {
                slug: p.locked_signals![0]!.slug,
                dimension_id: p.locked_signals![0]!.dimension_id,
                inference_zh: "针对本主张的结构推论足够长度",
                role: `解释${p.path}结构`,
                why_needed: "去掉此信号后无法解释本卡表象缺口",
              },
            ],
            removal_test: { passed: true, notes: "ok" },
            signal_count_rationale: "1个——派工表锁定",
          },
    ),
  };
  const missed = parseDeepEvidenceAssignment(
    "foundation",
    padded,
    planned,
    undefined,
    failOut,
  );
  assert.equal(missed, null);
  assert.ok(
    failOut.reason.includes("locked_inference_missing"),
    failOut.reason,
  );
}

{
  const stutter =
    "岁运半合金局形成外部合化力量，结构上你感到你在该结构下更易感到紧密绑定与投入压力。";
  const fixed = collapseQuerentPressureStutter(stutter);
  assert.equal(
    fixed,
    "岁运半合金局形成外部合化力量，结构上你更易感到紧密绑定与投入压力。",
  );
}

{
  const empty = preallocateFoundationSignals({ thesis: null, paths: ["why_cards[0]"] });
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.ok(empty.reason.includes("menu_empty"));
}

console.log("test-closed-menu-assign: ok");
