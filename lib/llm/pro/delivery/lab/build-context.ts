/**
 * Build DeepEvidencePromptOpts / fill inputs from lab artifacts (no job KV).
 */

import type { BreakthroughCore } from "@/lib/poju/agent-state";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import type { DeliveryComputed, DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_SEGMENT_KEYS } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePromptOpts } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";
import {
  buildCategoryTokenSetsFromStructured,
  tryStructuredFromBaseAnalysis,
} from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";
import {
  preallocPreferByPath,
  reservedPrimariesForPage,
  type ChartPrimaryPreallocMap,
} from "@/lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";
import { formatChartThesisForPrompt } from "@/lib/llm/pro/delivery/thesis/format-for-prompt";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import { filterPreferMapToThesis } from "@/lib/llm/pro/delivery/thesis/validate-assignment-coverage";
import { buildDeliveryPagePlan } from "@/lib/llm/pro/delivery/page-plan/build-page-plan";

function syntheticAgent(source: DeliveryLabSession["source"]) {
  const agent = createInitialAgentState({
    original_question: source.original_question,
  });
  return {
    ...agent,
    has_base_analysis: true,
    context_collected: {
      ...agent.context_collected,
      desired_outcome: source.desired_outcome ?? agent.context_collected?.desired_outcome ?? "",
    },
  };
}

export function labAsJobInput(lab: DeliveryLabSession) {
  const agent_v2 = syntheticAgent(lab.source);
  return {
    kind: "final_delivery" as const,
    session_id: lab.source.session_id ?? lab.lab_id,
    locale: lab.source.locale || "zh",
    agent_v2,
    breakthrough_core: (lab.source.breakthrough_core as BreakthroughCore | null) ?? null,
    covered_agenda: lab.source.covered_agenda ?? [],
    base_analysis: lab.source.base_analysis,
    delivery_mode: "full" as const,
  };
}

export function labSyntheticFinalize(lab: DeliveryLabSession): DeliveryComputed {
  const q = lab.source.original_question.slice(0, 200);
  const out = {} as DeliveryComputed;
  for (const key of DELIVERY_SEGMENT_KEYS) {
    const page = lab.artifacts.by_page[key];
    const core =
      (typeof page?.core_conclusion === "string" && page.core_conclusion.trim()) ||
      `【Lab】围绕「${q}」展开本页论证骨架。`;
    out[key] = {
      core_conclusion: core,
      bazi_basis: [],
      chart_anchors: [],
    };
  }
  return out;
}

function priorAnchorsFromLab(
  lab: DeliveryLabSession,
  key: DeliverySegmentKey,
): string[] {
  const priorPages: DeliverySegmentKey[] = [
    "foundation",
    "science_action",
    "metaphysics_action",
    "direct_answer",
    "risk_guard",
    "signals_close",
  ];
  const out: string[] = [];
  for (const p of priorPages) {
    if (p === key) break;
    const assignment = lab.artifacts.by_page[p]?.assignment as
      | { units?: Array<{ chart_anchors?: string[] }> }
      | undefined;
    for (const u of assignment?.units ?? []) {
      for (const a of u.chart_anchors ?? []) {
        if (a?.trim()) out.push(a.trim());
      }
    }
  }
  return out;
}

export async function buildLabPromptOpts(
  lab: DeliveryLabSession,
  key: DeliverySegmentKey,
): Promise<{ opts: DeepEvidencePromptOpts; p3_body_excerpt?: string }> {
  const input = labAsJobInput(lab);
  const question_expectation = [
    lab.source.original_question ? `问题: ${lab.source.original_question}` : "",
    lab.source.desired_outcome ? `期望: ${lab.source.desired_outcome}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const page_plan =
    input.breakthrough_core != null
      ? buildDeliveryPagePlan({
          core: input.breakthrough_core,
          agent_v2: input.agent_v2,
        })
      : null;

  let foundation_surface_feed = "";
  if (key === "foundation") {
    const { buildFoundationSurfaceFeedBlock } = await import(
      "@/lib/llm/pro/delivery/foundation-surface-feed"
    );
    foundation_surface_feed = buildFoundationSurfaceFeedBlock(input.covered_agenda, {
      original_question: lab.source.original_question,
      desired_outcome: lab.source.desired_outcome,
    });
  }

  let science_means_feed = "";
  if (key === "science_action") {
    const { buildScienceMeansFeedBlock } = await import(
      "@/lib/llm/pro/delivery/science-means-feed"
    );
    science_means_feed = buildScienceMeansFeedBlock(
      input.breakthrough_core,
      input.covered_agenda,
      {
        original_question: lab.source.original_question,
        desired_outcome: lab.source.desired_outcome,
      },
    );
  }

  let metaphysics_moat_feed = "";
  if (key === "metaphysics_action") {
    const { buildMetaphysicsMoatFeedBlock } = await import(
      "@/lib/llm/pro/delivery/metaphysics-moat-feed"
    );
    metaphysics_moat_feed = buildMetaphysicsMoatFeedBlock(
      input.breakthrough_core,
      input.covered_agenda,
      {
        original_question: lab.source.original_question,
        desired_outcome: lab.source.desired_outcome,
      },
    ).block;
  }

  let risk_fuse_feed = "";
  if (key === "risk_guard" && input.breakthrough_core) {
    const { buildRiskFuseFeedBlock } = await import(
      "@/lib/llm/pro/delivery/risk-fuse-feed"
    );
    risk_fuse_feed = buildRiskFuseFeedBlock(
      input.breakthrough_core,
      null,
      input.covered_agenda,
      {
        original_question: lab.source.original_question,
        desired_outcome: lab.source.desired_outcome,
      },
    );
  }

  let close_ritual_feed = "";
  if (key === "signals_close" && input.breakthrough_core) {
    const { buildCloseRitualFeedBlock } = await import(
      "@/lib/llm/pro/delivery/close-ritual-feed"
    );
    close_ritual_feed = buildCloseRitualFeedBlock(
      input.breakthrough_core,
      null,
      input.covered_agenda,
      {
        original_question: lab.source.original_question,
        desired_outcome: lab.source.desired_outcome,
      },
    );
  }

  let page_plan_slice = "";
  let eastern_calc_slice = "";
  let risk_calc_slice = "";
  if (page_plan && input.breakthrough_core) {
    const { formatPagePlanSliceForPrompt } = await import(
      "@/lib/llm/pro/delivery/page-plan/format-page-plan-for-prompt"
    );
    if (key !== "metaphysics_action" && key !== "risk_guard") {
      page_plan_slice = formatPagePlanSliceForPrompt(
        key,
        page_plan,
        input.breakthrough_core,
        question_expectation,
      );
    }
  }
  if (key === "metaphysics_action" && input.breakthrough_core) {
    const { buildEasternCalcSliceForFill } = await import(
      "@/lib/llm/pro/delivery/format-spine-for-finalize"
    );
    eastern_calc_slice = buildEasternCalcSliceForFill(
      input.breakthrough_core,
      page_plan,
      question_expectation,
    );
  }
  if (key === "risk_guard" && input.breakthrough_core) {
    const { buildRiskCalcSliceForFill } = await import(
      "@/lib/llm/pro/delivery/format-spine-for-finalize"
    );
    risk_calc_slice = buildRiskCalcSliceForFill(
      input.breakthrough_core,
      page_plan,
      question_expectation,
    );
  }

  const { buildRealityConstraintsBlock } = await import(
    "@/lib/llm/pro/delivery/reality-constraints"
  );
  const reality_constraints = buildRealityConstraintsBlock(input.covered_agenda, {
    original_question: lab.source.original_question,
    desired_outcome: lab.source.desired_outcome,
  });

  const structured = tryStructuredFromBaseAnalysis(lab.source.base_analysis);
  const category_token_sets = buildCategoryTokenSetsFromStructured(structured);
  const prealloc = lab.artifacts.prealloc as ChartPrimaryPreallocMap | undefined;
  const thesis = lab.artifacts.thesis as ChartThesis | null | undefined;
  const chart_thesis_block = formatChartThesisForPrompt(thesis ?? null) || undefined;
  const rawPrefer = prealloc ? preallocPreferByPath(prealloc, key) : undefined;
  const prealloc_prefer_by_path = filterPreferMapToThesis(rawPrefer, thesis);

  let structured_inventory = "";
  if (structured) {
    const { buildStructuredInstanceInventory } = await import(
      "@/lib/base-analysis/build-structured-instance-inventory"
    );
    structured_inventory = buildStructuredInstanceInventory(structured, {
      questionCategory: null,
    });
  }

  const fin = labSyntheticFinalize(lab);
  const seg = fin[key];

  const p3_body_excerpt =
    key === "metaphysics_action"
      ? String(
          (lab.artifacts.by_page.science_action?.page_schema as { opening?: string } | undefined)
            ?.opening ?? "",
        ).slice(0, 1200) || undefined
      : undefined;

  const opts: DeepEvidencePromptOpts = {
    locale: lab.source.locale || "zh",
    core_conclusion: seg.core_conclusion,
    bazi_basis: seg.bazi_basis ? [...seg.bazi_basis] : undefined,
    page_plan_slice: page_plan_slice || undefined,
    eastern_calc_slice: eastern_calc_slice || undefined,
    risk_calc_slice: risk_calc_slice || undefined,
    reality_constraints: reality_constraints || undefined,
    foundation_surface_feed: foundation_surface_feed || undefined,
    science_means_feed: science_means_feed || undefined,
    metaphysics_moat_feed: metaphysics_moat_feed || undefined,
    risk_fuse_feed: risk_fuse_feed || undefined,
    close_ritual_feed: close_ritual_feed || undefined,
    question_expectation: question_expectation || undefined,
    prior_chart_anchors: priorAnchorsFromLab(lab, key),
    category_token_sets,
    structured_inventory: structured_inventory || undefined,
    chart_thesis_block,
    chart_thesis: thesis ?? null,
    reserved_chart_primaries: prealloc ? reservedPrimariesForPage(prealloc, key) : [],
    prealloc_prefer_by_path,
    prealloc_max_units: prealloc?.slot_count_by_page?.[key],
    primary_reuse_cap: prealloc?.reuse_cap,
    thesis_structured: structured,
  };

  return { opts, p3_body_excerpt };
}
