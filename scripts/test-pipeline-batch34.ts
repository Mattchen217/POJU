/**
 * Batch 3/4 — deep evidence, Layer B, phase order, Layer C soft wiring.
 * Run: pnpm exec tsx scripts/test-pipeline-batch34.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  deepEvidenceUnitSpec,
  buildDeepEvidencePrompt,
} from "../lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import {
  parseDeepEvidencePlan,
  alignDeepEvidenceToPage,
  evidenceTreeFromAligned,
  formatDeepEvidencePlanForCompress,
} from "../lib/llm/pro/delivery/page-schema/deep-evidence-call";
import {
  assessDeepEvidenceQuality,
  summarizeDeepEvidenceQuality,
} from "../lib/llm/pro/delivery/page-schema/deep-evidence-quality";
import {
  formatLayerBInventoryMenu,
  mergeInventoryTokens,
} from "../lib/llm/pro/delivery/page-schema/layer-b-inventory-menu";
import {
  buildCategoryTokenSetsFromStructured,
  tallyAnchorCategoryUsage,
} from "../lib/llm/pro/delivery/page-schema/anchor-category-tally";
import { assessUnitAnchorQuality } from "../lib/llm/pro/delivery/page-schema/anchor-quality";
import { buildPageSchemaFillPrompt } from "../lib/llm/pro/delivery/page-schema/fill-prompt";
import { pageSchemaToArgumentTree } from "../lib/llm/pro/delivery/page-schema/render";
import type { ProfileStructured } from "../lib/calculations/build-profile-structured";
import type { P2Page } from "../lib/llm/pro/delivery/page-schema/types";

const structured: ProfileStructured = {
  day_master: "甲木",
  pattern: "test",
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
      life_stage_han: "帝旺",
    },
    month: {
      ganzhi: "丙寅",
      stem: "丙",
      branch: "寅",
      ten_god: "食神",
      hidden_stems: ["甲", "丙", "戊"],
      shen_sha: ["驿马"],
      life_stage_han: "冠带",
    },
    day: {
      ganzhi: "戊午",
      stem: "戊",
      branch: "午",
      ten_god: "日主",
      hidden_stems: ["丁", "己"],
      shen_sha: [],
      life_stage_han: "衰",
    },
    hour: {
      ganzhi: "癸亥",
      stem: "癸",
      branch: "亥",
      ten_god: "正财",
      hidden_stems: ["壬", "甲"],
      shen_sha: [],
      life_stage_han: "沐浴",
    },
  },
  da_yun: [{ ganzhi: "丁卯", start_age: 32, start_year: 2026 }],
  data_availability: { pillars_detail: true, da_yun: true, bazi_enrichment: false },
};

// --- Layer B menu ---
{
  const sets = buildCategoryTokenSetsFromStructured(structured);
  const menu = formatLayerBInventoryMenu(sets);
  assert.ok(menu.includes("十神类"));
  assert.ok(menu.includes("神煞类"));
  assert.ok(menu.includes("食神") || menu.includes("比肩"));
  assert.ok(menu.includes("驿马"));
  const tokens = mergeInventoryTokens(sets, "神煞: 天乙贵人、将星\n十神: 正官");
  assert.ok(tokens.includes("驿马"));
  assert.ok(tokens.includes("天乙贵人") || tokens.includes("正官"));
  console.log("ok Layer B menu + inventory tokens");
}

// --- Deep evidence prompt has Layer A/B, not static-only ---
{
  const sets = buildCategoryTokenSetsFromStructured(structured);
  const { system, user } = buildDeepEvidencePrompt("foundation", {
    locale: "zh",
    core_conclusion: "测试结论",
    structured_inventory: "## 闭集\n- 十神: 食神",
    prior_chart_anchors: ["正官", "七杀"],
    category_token_sets: sets,
  });
  assert.ok(system.includes("深度依据推理"));
  assert.ok(system.includes("两句机制") || system.includes("扎实"));
  assert.ok(!system.includes("本报告已用锚点类目分布")); // Layer A must be user-side
  assert.ok(user.includes("本报告已用锚点类目分布"));
  assert.ok(user.includes("闭集分类菜单"));
  assert.ok(user.includes("完整原始命盘闭集"));
  console.log("ok deep-evidence prompt Layer A/B user-side");
}

{
  const { system } = buildDeepEvidencePrompt("metaphysics_action", {
    locale: "zh",
    core_conclusion: "测试结论",
  });
  assert.ok(system.includes("护城河") || system.includes("timing") || system.includes("用忌"));
  console.log("ok deep-evidence P4 moat prompt");
}

// --- Parse + align ---
{
  const spec = deepEvidenceUnitSpec("foundation");
  assert.equal(spec.min, 4);
  const raw = {
    page: "foundation",
    units: Array.from({ length: 4 }, (_, i) => ({
      path: `why_cards[${i}]`,
      chart_anchors: i === 0 ? ["食神", "身弱"] : [["正官", "正印", "七杀", "偏财"][i - 1]!],
      evidence:
        i === 0
          ? `⟦w:食神⟧ 泄秀承重说明本案输出通道受阻，推进成本抬升。⟦w:身弱⟧ 叠加后更需先稳住补给。`
          : `⟦w:${["正官", "正印", "七杀", "偏财"][i - 1]}⟧ 对本案形成结构压力，直接影响决策节奏。恢复窗口被占时需分开承重说明，避免硬扛空转。`,
    })),
  };
  const plan = parseDeepEvidencePlan("foundation", raw);
  assert.ok(plan);
  assert.equal(plan!.units.length, 4);
  const lock = formatDeepEvidencePlanForCompress(plan!);
  assert.ok(lock.includes("已锁定深度依据"));

  const q = assessDeepEvidenceQuality("foundation", plan!);
  assert.equal(q.ok, true, q.ok ? "" : q.reason);
  const summary = summarizeDeepEvidenceQuality(plan!);
  assert.ok(summary.avg_clauses >= 2);

  const shallow = assessDeepEvidenceQuality("foundation", {
    page: "foundation",
    units: [
      {
        path: "why_cards[0]",
        chart_anchors: ["食神"],
        evidence: "⟦w:食神⟧ 短。",
      },
      {
        path: "why_cards[1]",
        chart_anchors: ["食神"],
        evidence: "⟦w:食神⟧ 还是短。",
      },
      {
        path: "why_cards[2]",
        chart_anchors: ["食神"],
        evidence: "⟦w:食神⟧ 依旧短。",
      },
      {
        path: "why_cards[3]",
        chart_anchors: ["食神"],
        evidence: "⟦w:食神⟧ 太短了。",
      },
    ],
  });
  assert.equal(shallow.ok, false);
  console.log("ok deep-evidence quality gates");

  const page: P2Page = {
    page: "foundation",
    page_title: "测",
    page_subtitle: "",
    dashboard: [{ key: "body", label: "身", score: 50 }],
    why_cards: [
      { title: "a", surface: "s1", essence: "e1", chart_anchors: [] },
      { title: "b", surface: "s2", essence: "e2", chart_anchors: [] },
      { title: "c", surface: "s3", essence: "e3", chart_anchors: [] },
      { title: "d", surface: "s4", essence: "e4", chart_anchors: [] },
    ],
    evidence: [],
  };
  const aligned = alignDeepEvidenceToPage("foundation", page, plan!);
  assert.ok(aligned.page.page === "foundation");
  if (aligned.page.page === "foundation") {
    assert.deepEqual(aligned.page.why_cards[0]!.chart_anchors, ["食神", "身弱"]);
  }
  const tree = evidenceTreeFromAligned("foundation", aligned.evidenceByBodyIndex);
  assert.equal(tree.foundation?.length, 4);
  assert.ok(tree.foundation?.[0]?.evidence?.includes("⟦w:食神⟧"));
  const narr = pageSchemaToArgumentTree("foundation", aligned.page);
  assert.equal(narr.foundation?.length, 4);
  console.log("ok deep-evidence parse + align");
}

// --- Compress fill prompt ---
{
  const { system, user } = buildPageSchemaFillPrompt("foundation", {
    locale: "zh",
    core_conclusion: "x",
    fill_mode: "compress",
    deep_evidence_lock: "【已锁定深度依据】\nchart_anchors: 食神",
    structured_inventory: "【完整原始命盘闭集】\n十神: 官杀",
    bazi_basis: ["官杀", "大运"],
    page_plan_slice: "## must_use\n- 官杀",
  });
  assert.ok(system.includes("正文压缩模式"));
  assert.ok(system.includes("不得引入锁外专名"));
  assert.ok(user.includes("已锁定深度依据"));
  assert.ok(user.includes("core_conclusion"));
  assert.ok(!user.includes("完整原始命盘闭集"));
  assert.ok(!user.includes("可以直接从这里取"));
  assert.ok(!user.includes("bazi_basis"));
  assert.ok(!user.includes("本页派工料"));
  console.log("ok compress fill prompt");
}

{
  const { user } = buildPageSchemaFillPrompt("metaphysics_action", {
    locale: "zh",
    core_conclusion: "x",
    fill_mode: "compress",
    deep_evidence_lock: "【已锁定深度依据】\nchart_anchors: 用神",
    eastern_calc_slice: "## 本地真算料\npreferred_dirs: 西北",
    structured_inventory: "闭集 dump",
  });
  assert.ok(!user.includes("本地真算料"));
  assert.ok(!user.includes("闭集 dump"));
  assert.ok(user.includes("已锁定深度依据"));
  console.log("ok compress P4 strips eastern/inventory");
}

// --- Batch 4: priorAnchors / inventoryTokens trigger soft warn ---
{
  const sets = buildCategoryTokenSetsFromStructured(structured);
  const tally = tallyAnchorCategoryUsage(["正官", "七杀"], sets);
  const inv = mergeInventoryTokens(sets);
  assert.ok(tally.priorAnchors.length >= 2);
  assert.ok(inv.length > 0);
  const aq = assessUnitAnchorQuality({
    pageKey: "science_action",
    units: [{ path: "angles[0]", anchors: ["正官", "七杀"] }],
    priorAnchors: tally.priorAnchors,
    inventoryTokens: inv,
  });
  assert.ok(aq.notes.some((n) => n.includes("cross_page_echo")));
  assert.equal(aq.structuralFail, false);
  console.log("ok Batch4 soft Layer C wiring");
}

// --- Phase order in source ---
{
  const chainSrc = readFileSync(
    resolve(__dirname, "../lib/llm/pro/delivery/run-segment-chain.ts"),
    "utf8",
  );
  assert.ok(chainSrc.includes("Batch 3: start → deep evidence → evidence_done"));
  assert.ok(chainSrc.includes("runDeepEvidenceCall"));
  assert.ok(chainSrc.includes('fill_mode: hasPlan ? "compress" : "full"'));
  const deepCall = chainSrc.indexOf("const deep = await runDeepEvidenceCall");
  const fillCall = chainSrc.indexOf("const filled = await runPageSchemaFill");
  const markCall = chainSrc.indexOf("const mark = await runMarkDeliveryTask");
  assert.ok(deepCall > 0 && fillCall > deepCall && markCall > fillCall);
  console.log("ok phase order deep → fill → mark");
}

console.log("\nAll pipeline batch 3/4 checks passed.\n");
