/**
 * Shared per-page context for dispatch workers (feeds + finalize spine).
 */

import { buildDeliveryPagePlan } from "@/lib/llm/pro/delivery/page-plan/build-page-plan";
import type { DeliveryComputed } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { loadDeliveryStageCheckpoint } from "@/lib/llm/pro/delivery/delivery-stage-store";
import {
  loadP3BodyExcerptForP4Moat,
  loadPriorChartAnchors,
  loadPriorSignalRoles,
  loadPrimaryBackupHint,
  loadUpstreamActionBrief,
  loadUpstreamWeekSummary,
} from "@/lib/llm/pro/delivery/page-schema/upstream";
import {
  buildCategoryTokenSetsFromStructured,
  tryStructuredFromBaseAnalysis,
} from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";
import type { DeepEvidencePromptOpts } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import type { FinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";
import type { CategoryTokenSets } from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";
import { loadChartPrimaryPrealloc } from "@/lib/llm/pro/delivery/dispatch/task-store";
import {
  preallocPreferByPath,
  reservedPrimariesForPage,
} from "@/lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";

export type SegmentDispatchContext = {
  finalize: DeliveryComputed;
  promptOpts: DeepEvidencePromptOpts;
  category_token_sets: CategoryTokenSets | null;
  prior_chart_anchors: string[];
  action_brief: unknown;
  week_summary: unknown;
  primary_backup_hint: string;
  p3_body_excerpt: string;
};

function resolveQuestionExpectation(input: FinalDeliveryJobInput): string {
  const q = input.agent_v2.original_question?.trim() || "";
  const want = input.agent_v2.context_collected?.desired_outcome?.trim() || "";
  return [q ? `问题: ${q}` : "", want ? `期望: ${want}` : ""].filter(Boolean).join("\n");
}

export async function loadSegmentDispatchContext(
  job_id: string,
  key: DeliverySegmentKey,
  input: FinalDeliveryJobInput,
): Promise<SegmentDispatchContext | null> {
  const fin = await loadDeliveryStageCheckpoint(job_id, "finalize");
  if (!fin || fin.stage !== "finalize") return null;

  const page_plan = input.breakthrough_core
    ? buildDeliveryPagePlan({
        core: input.breakthrough_core,
        agent_v2: input.agent_v2,
      })
    : null;

  const question_expectation = resolveQuestionExpectation(input);
  const action_brief = await loadUpstreamActionBrief(job_id);
  const week_summary = await loadUpstreamWeekSummary(job_id);
  let primary_backup_hint = await loadPrimaryBackupHint(job_id);
  if (!primary_backup_hint.trim() && input.breakthrough_core) {
    const { buildPrimaryBackupHintFromBreakthroughCore } = await import(
      "@/lib/llm/pro/delivery/page-schema/upstream"
    );
    primary_backup_hint = buildPrimaryBackupHintFromBreakthroughCore(input.breakthrough_core);
  }
  const p3_body_excerpt =
    key === "metaphysics_action" ? await loadP3BodyExcerptForP4Moat(job_id) : "";

  let foundation_surface_feed = "";
  if (key === "foundation") {
    const { buildFoundationSurfaceFeedBlock } = await import(
      "@/lib/llm/pro/delivery/foundation-surface-feed"
    );
    const xc = input.breakthrough_core?.key_crossroads;
    foundation_surface_feed = buildFoundationSurfaceFeedBlock(input.covered_agenda, {
      original_question: input.agent_v2.original_question,
      desired_outcome: input.agent_v2.context_collected?.desired_outcome,
      situation_conclusion: input.breakthrough_core?.situation_conclusion,
      decision_traits: xc?.decision_traits,
      real_fork: xc?.real_fork,
      path_costs: xc?.path_costs,
      energy_structure: input.breakthrough_core?.energy_structure,
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
        original_question: input.agent_v2.original_question,
        desired_outcome: input.agent_v2.context_collected?.desired_outcome,
        primary_backup_hint,
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
        original_question: input.agent_v2.original_question,
        desired_outcome: input.agent_v2.context_collected?.desired_outcome,
      },
    ).block;
  }

  let risk_fuse_feed = "";
  if (key === "risk_guard") {
    const { buildRiskFuseFeedBlock } = await import(
      "@/lib/llm/pro/delivery/risk-fuse-feed"
    );
    risk_fuse_feed = buildRiskFuseFeedBlock(
      input.breakthrough_core,
      action_brief,
      input.covered_agenda,
      {
        original_question: input.agent_v2.original_question,
        desired_outcome: input.agent_v2.context_collected?.desired_outcome,
        primary_backup_hint,
      },
    );
  }

  let close_ritual_feed = "";
  if (key === "signals_close") {
    const { buildCloseRitualFeedBlock } = await import(
      "@/lib/llm/pro/delivery/close-ritual-feed"
    );
    close_ritual_feed = buildCloseRitualFeedBlock(
      input.breakthrough_core,
      action_brief,
      input.covered_agenda,
      {
        original_question: input.agent_v2.original_question,
        desired_outcome: input.agent_v2.context_collected?.desired_outcome,
        primary_backup_hint,
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
    original_question: input.agent_v2.original_question,
    desired_outcome: input.agent_v2.context_collected?.desired_outcome,
  });

  const prior_chart_anchors = await loadPriorChartAnchors(job_id, key);
  const prior_signal_roles = await loadPriorSignalRoles(job_id, key);
  const structuredForFill = tryStructuredFromBaseAnalysis(input.base_analysis);
  const category_token_sets = buildCategoryTokenSetsFromStructured(structuredForFill);
  const prealloc = await loadChartPrimaryPrealloc(job_id);
  const reserved_chart_primaries = prealloc
    ? reservedPrimariesForPage(prealloc, key)
    : [];
  const prealloc_prefer_by_path = prealloc
    ? preallocPreferByPath(prealloc, key)
    : undefined;
  const prealloc_max_units = prealloc?.slot_count_by_page?.[key];
  const primary_reuse_cap = prealloc?.reuse_cap;
  let structured_inventory = "";
  if (structuredForFill) {
    const { buildStructuredInstanceInventory } = await import(
      "@/lib/base-analysis/build-structured-instance-inventory"
    );
    structured_inventory = buildStructuredInstanceInventory(structuredForFill, {
      questionCategory: input.agent_v2.question_category ?? null,
    });
  }

  const seg = fin.value[key];
  let action_brief_block: string | undefined;
  if (key === "risk_guard" && action_brief) {
    const { formatP5ActionBriefForPrompt } = await import(
      "@/lib/llm/pro/delivery/page-schema/action-extractor"
    );
    action_brief_block = formatP5ActionBriefForPrompt(
      action_brief as Parameters<typeof formatP5ActionBriefForPrompt>[0],
    );
  }

  const promptOpts: DeepEvidencePromptOpts = {
    locale: input.locale,
    core_conclusion: seg?.core_conclusion ?? "",
    bazi_basis: seg?.bazi_basis ? [...seg.bazi_basis] : undefined,
    page_plan_slice: page_plan_slice || undefined,
    eastern_calc_slice: eastern_calc_slice || undefined,
    risk_calc_slice: risk_calc_slice || undefined,
    question_expectation: question_expectation || undefined,
    primary_backup_hint: primary_backup_hint || undefined,
    reality_constraints: reality_constraints || undefined,
    foundation_surface_feed: foundation_surface_feed || undefined,
    science_means_feed: science_means_feed || undefined,
    metaphysics_moat_feed: metaphysics_moat_feed || undefined,
    risk_fuse_feed: risk_fuse_feed || undefined,
    close_ritual_feed: close_ritual_feed || undefined,
    structured_inventory: structured_inventory || undefined,
    prior_chart_anchors,
    prior_signal_roles:
      prior_signal_roles.length > 0 ? prior_signal_roles : undefined,
    reserved_chart_primaries:
      reserved_chart_primaries.length > 0 ? reserved_chart_primaries : undefined,
    prealloc_prefer_by_path,
    prealloc_max_units,
    primary_reuse_cap,
    category_token_sets: category_token_sets ?? undefined,
    action_brief_block,
  };

  return {
    finalize: fin.value,
    promptOpts,
    category_token_sets,
    prior_chart_anchors,
    action_brief,
    week_summary,
    primary_backup_hint,
    p3_body_excerpt,
  };
}
