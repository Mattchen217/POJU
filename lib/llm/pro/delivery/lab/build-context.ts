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
  preallocTermGroups,
  reservedPrimariesForPage,
  type ChartPrimaryPreallocMap,
} from "@/lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";
import { formatChartThesisForPrompt } from "@/lib/llm/pro/delivery/thesis/format-for-prompt";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import {
  filterPreferMapToThesis,
  filterTokensToThesis,
  thesisCycleGanzhiAllowlist,
} from "@/lib/llm/pro/delivery/thesis/validate-assignment-coverage";
import { buildDeliveryPagePlan } from "@/lib/llm/pro/delivery/page-plan/build-page-plan";
import { isFaceDeliveryKey } from "@/lib/llm/pro/delivery/pipeline-v3/gate-face-format";

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
    partner_bazi: lab.source.partner_bazi ?? null,
    dyad_compat_summary: lab.source.dyad_compat_summary ?? null,
    pivot_chart_path: lab.source.pivot_chart_path ?? null,
    dyad_matrix_pack: lab.source.dyad_matrix_pack ?? null,
    joint_decision: lab.source.joint_decision === true,
  };
}

export function labSyntheticFinalize(lab: DeliveryLabSession): DeliveryComputed {
  const q = lab.source.original_question.slice(0, 200);
  const out = {} as DeliveryComputed;
  const keys = new Set<string>([...DELIVERY_SEGMENT_KEYS, "07"]);
  for (const key of keys) {
    const page = lab.artifacts.by_page[key as keyof typeof lab.artifacts.by_page];
    const core =
      (typeof page?.core_conclusion === "string" && page.core_conclusion.trim()) ||
      `【Lab】围绕「${q}」展开本页论证骨架。`;
    out[key as keyof DeliveryComputed] = {
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
    "situation_analysis",
    "execution_guidance",
    "self_regulation",
    "decision_brief",
    "validation_risk",
    "validation_close",
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
): Promise<{
  opts: DeepEvidencePromptOpts;
  p3_body_excerpt?: string;
  action_brief?: import("@/lib/llm/pro/delivery/page-schema/types").P5ActionBrief | null;
}> {
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
  if (key === "situation_analysis") {
    const { buildFoundationSurfaceFeedBlock } = await import(
      "@/lib/llm/pro/delivery/foundation-surface-feed"
    );
    foundation_surface_feed = buildFoundationSurfaceFeedBlock(input.covered_agenda, {
      original_question: lab.source.original_question,
      desired_outcome: lab.source.desired_outcome,
    });
  }

  let science_means_feed = "";
  let science_means_judgment_feed = "";
  if (key === "execution_guidance") {
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
    science_means_judgment_feed = buildScienceMeansFeedBlock(
      input.breakthrough_core,
      null,
      { forJudgment: true },
    );
  }

  let metaphysics_moat_feed = "";
  let metaphysics_moat_judgment_feed = "";
  if (key === "self_regulation") {
    const { buildMetaphysicsMoatFeedBlock } = await import(
      "@/lib/llm/pro/delivery/metaphysics-moat-feed"
    );
    const preallocEarly = lab.artifacts.prealloc as
      | { qimen?: unknown; chart_fact_pack?: string }
      | undefined;
    const qimenOpt =
      (preallocEarly?.qimen as import("@/lib/llm/pro/delivery/page-schema/qimen-fact-pack").DeliveryQimenFactPack | undefined) ??
      null;
    const factPackOpt = preallocEarly?.chart_fact_pack ?? null;
    metaphysics_moat_feed = buildMetaphysicsMoatFeedBlock(
      input.breakthrough_core,
      input.covered_agenda,
      {
        original_question: lab.source.original_question,
        desired_outcome: lab.source.desired_outcome,
        qimen: qimenOpt,
        chart_fact_pack: factPackOpt,
      },
    ).block;
    metaphysics_moat_judgment_feed = buildMetaphysicsMoatFeedBlock(
      input.breakthrough_core,
      null,
      {
        qimen: qimenOpt,
        chart_fact_pack: factPackOpt,
        forJudgment: true,
      },
    ).block;
  }

  let risk_fuse_feed = "";
  if (key === "validation_risk" && input.breakthrough_core) {
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
  if (key === "validation_close" && input.breakthrough_core) {
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
  if (page_plan && input.breakthrough_core && !isFaceDeliveryKey(key)) {
    const { formatPagePlanSliceForPrompt } = await import(
      "@/lib/llm/pro/delivery/page-plan/format-page-plan-for-prompt"
    );
    if (key !== "self_regulation" && key !== "validation_risk") {
      page_plan_slice = formatPagePlanSliceForPrompt(
        key,
        page_plan,
        input.breakthrough_core,
        question_expectation,
      );
    }
  }
  if (key === "self_regulation" && input.breakthrough_core) {
    const { buildEasternCalcSliceForFill } = await import(
      "@/lib/llm/pro/delivery/format-spine-for-finalize"
    );
    eastern_calc_slice = buildEasternCalcSliceForFill(
      input.breakthrough_core,
      page_plan,
      question_expectation,
    );
    const preallocQ = lab.artifacts.prealloc as
      | { qimen?: { text?: string }; chart_fact_pack?: string }
      | undefined;
    const qimenText =
      preallocQ?.qimen?.text?.trim() ||
      (preallocQ?.chart_fact_pack?.includes("【奇门锁盘")
        ? preallocQ.chart_fact_pack
            .slice(preallocQ.chart_fact_pack.indexOf("【奇门锁盘"))
            .trim()
        : "");
    if (qimenText) {
      eastern_calc_slice = `${eastern_calc_slice}\n\n${qimenText}`;
    }
  }
  if (key === "validation_risk" && input.breakthrough_core) {
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
  const prealloc_term_groups = prealloc
    ? preallocTermGroups(prealloc, key)
    : undefined;

  let structured_inventory = "";
  if (structured) {
    const { buildStructuredInstanceInventory } = await import(
      "@/lib/base-analysis/build-structured-instance-inventory"
    );
    structured_inventory = buildStructuredInstanceInventory(structured, {
      questionCategory: null,
      ...(thesis?.dimensions?.length
        ? {
            forThesisAssign: true,
            thesisDayunAllowlist: thesisCycleGanzhiAllowlist(thesis),
          }
        : {}),
    });
  }

  const fin = labSyntheticFinalize(lab);
  const seg = fin[key] ?? {
    core_conclusion: "",
    bazi_basis: [] as string[],
    chart_anchors: [] as string[],
  };

  const p3_body_excerpt =
    key === "self_regulation"
      ? String(
          (lab.artifacts.by_page.execution_guidance?.page_schema as { opening?: string } | undefined)
            ?.opening ?? "",
        ).slice(0, 1200) || undefined
      : undefined;

  // P4 fill: same ActionBrief SSOT as production (P1+P3 means; no P4 self).
  let action_brief: import("@/lib/llm/pro/delivery/page-schema/types").P5ActionBrief | null =
    null;
  if (key === "self_regulation") {
    const { extractP5ActionBrief } = await import(
      "@/lib/llm/pro/delivery/page-schema/action-extractor"
    );
    const p1 = lab.artifacts.by_page.decision_brief?.page_schema;
    const p3 = lab.artifacts.by_page.execution_guidance?.page_schema;
    if (p1 || p3) {
      try {
        action_brief = extractP5ActionBrief({
          p1: (p1 ?? null) as never,
          p3: (p3 ?? null) as never,
          p4: null,
        });
      } catch {
        action_brief = null;
      }
    }
  }

  let primary_backup_hint: string | undefined;
  if (key === "execution_guidance" || key === "self_regulation") {
    const p1Schema = lab.artifacts.by_page.decision_brief?.page_schema as
      | import("@/lib/llm/pro/delivery/page-schema/types").P1Page
      | undefined;
    if (p1Schema?.primary?.name || p1Schema?.backup?.name) {
      const { formatPrimaryBackupHintFromP1 } = await import(
        "@/lib/llm/pro/delivery/page-schema/upstream"
      );
      primary_backup_hint = formatPrimaryBackupHintFromP1(p1Schema, key);
    } else if (input.breakthrough_core) {
      const { buildPrimaryBackupHintFromBreakthroughCore } = await import(
        "@/lib/llm/pro/delivery/page-schema/upstream"
      );
      primary_backup_hint =
        buildPrimaryBackupHintFromBreakthroughCore(input.breakthrough_core) ||
        undefined;
    }
  }

  const { resolveDyadRelationStructureFeed } = await import("@/lib/poju/dyad-compat");
  const dyad_relation_structure =
    resolveDyadRelationStructureFeed({
      partner_bazi: lab.source.partner_bazi,
      dyad_compat_summary: lab.source.dyad_compat_summary,
      pivot_chart_path: lab.source.pivot_chart_path,
      dyad_matrix_pack: lab.source.dyad_matrix_pack,
      joint_decision: lab.source.joint_decision === true,
    }) || undefined;

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
    science_means_judgment_feed: science_means_judgment_feed || undefined,
    metaphysics_moat_feed: metaphysics_moat_feed || undefined,
    metaphysics_moat_judgment_feed: metaphysics_moat_judgment_feed || undefined,
    risk_fuse_feed: risk_fuse_feed || undefined,
    close_ritual_feed: close_ritual_feed || undefined,
    question_expectation: question_expectation || undefined,
    dyad_relation_structure,
    primary_backup_hint,
    prior_chart_anchors: priorAnchorsFromLab(lab, key),
    category_token_sets,
    structured_inventory: structured_inventory || undefined,
    chart_thesis_block,
    chart_thesis: thesis ?? null,
    reserved_chart_primaries: filterTokensToThesis(
      prealloc ? reservedPrimariesForPage(prealloc, key) : [],
      thesis,
    ),
    prealloc_prefer_by_path,
    prealloc_term_groups,
    chart_fact_pack: prealloc?.chart_fact_pack,
    chart_fact_ganzhi: prealloc?.chart_fact_ganzhi,
    chart_fact_shen_sha: prealloc?.chart_fact_shen_sha,
    prealloc_max_units: prealloc?.slot_count_by_page?.[key],
    primary_reuse_cap: prealloc?.reuse_cap,
    thesis_structured: structured,
  };

  return { opts, p3_body_excerpt, action_brief };
}
