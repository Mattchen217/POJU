/**
 * Lab executor for pipeline v3 — greenfield. Does not call legacy executeKind.
 */

import { pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import { DELIVERY_SINGLE_CALL_TIMEOUT_MS } from "@/lib/llm/pro/delivery/delivery-tasks";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { tryStructuredFromBaseAnalysis } from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";
import { buildChartThesisFromStructured } from "@/lib/llm/pro/delivery/thesis";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import { inferQuestionCategoryFromText } from "@/lib/llm/prompts/relation-closed-set-context";
import {
  assertPreallocPrimariesGroundedInThesis,
  preallocateChartPrimaries,
} from "@/lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";
import { buildLabPromptOpts, labSyntheticFinalize } from "@/lib/llm/pro/delivery/lab/build-context";
import { saveDeliveryLab } from "@/lib/llm/pro/delivery/lab/store";
import type {
  DeliveryLabSession,
  LabAttempt,
  LabGateVerdict,
} from "@/lib/llm/pro/delivery/lab/types";
import {
  LAB_STEP_DEFS_V3,
  labV3StepDef,
  type LabV3StepDef,
} from "@/lib/llm/pro/delivery/lab/types-v3";
import { runContentJudgmentGenerate } from "@/lib/llm/pro/delivery/pipeline-v3/content-judgment";
import { runContentBodyGenerate } from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import { scrubJudgmentFeedPrescriptions, stripQimenBlocksUnlessPageAllows } from "@/lib/llm/pro/delivery/pipeline-v3/scrub-judgment-feed";
import { pageFeedFlags } from "@/lib/llm/pro/delivery/pipeline-v3/page-feed-policy";
import { gateContentPhaseA } from "@/lib/llm/pro/delivery/pipeline-v3/gate-phase-a";
import { gateJudgmentCategoryB } from "@/lib/llm/pro/delivery/pipeline-v3/gate-judgment-category";
import { gateBodyCategoryB } from "@/lib/llm/pro/delivery/pipeline-v3/gate-body-category";
import { freezeRawJudgmentAsEvidence } from "@/lib/llm/pro/delivery/pipeline-v3/evidence-soft";
import { runBodyPolishGenerate } from "@/lib/llm/pro/delivery/pipeline-v3/body-polish";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";

function ensurePage(
  lab: DeliveryLabSession,
  page: DeliverySegmentKey,
): NonNullable<DeliveryLabSession["artifacts"]["by_page"][DeliverySegmentKey]> {
  if (!lab.artifacts.by_page[page]) {
    lab.artifacts.by_page[page] = {};
  }
  return lab.artifacts.by_page[page]!;
}

type ExecOut = {
  input_payload: unknown;
  raw_model_output: unknown;
  processing_actions: Array<{ action: string; detail?: string }>;
  gate_verdict: LabGateVerdict;
  output_to_next_stage: unknown;
  tokens_used?: number;
  error?: string;
  call_trace?: import("@/lib/llm/pro/delivery/lab/call-trace").LabCallTrace;
};

function canRunV3(lab: DeliveryLabSession, step_key: string): string | null {
  const idx = LAB_STEP_DEFS_V3.findIndex((s) => s.step_key === step_key);
  if (idx < 0) return "unknown_step";
  if (idx > lab.cursor_index) return "step_locked_approve_prior";
  const rec = lab.steps[step_key];
  if (rec?.status === "running") return "step_busy";
  return null;
}

async function executeV3(
  lab: DeliveryLabSession,
  def: LabV3StepDef,
): Promise<ExecOut> {
  const session_id = pojuCacheSessionId(lab.source.session_id ?? lab.lab_id);
  const page = def.page;

  if (def.kind === "bootstrap") {
    const structured = tryStructuredFromBaseAnalysis(lab.source.base_analysis);
    const q = lab.source.original_question?.trim() ?? "";
    const passed = Boolean(structured) && q.length >= 2;
    return {
      input_payload: { pipeline: "v3_three_step", question_len: q.length },
      raw_model_output: null,
      processing_actions: [{ action: "validate_structured" }],
      gate_verdict: {
        passed,
        failed_rule: passed ? undefined : "bootstrap_invalid",
        detail: passed ? "ok" : "need structured + question",
      },
      output_to_next_stage: { structured_present: Boolean(structured) },
    };
  }

  if (def.kind === "thesis") {
    const structured = tryStructuredFromBaseAnalysis(lab.source.base_analysis);
    if (!structured) {
      return {
        input_payload: {},
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: { passed: false, failed_rule: "no_structured" },
        output_to_next_stage: null,
        error: "no_structured",
      };
    }
    const agenda = [
      lab.source.original_question,
      ...(lab.source.covered_agenda ?? []).map(
        (a) => `${a.label}${a.answer ? `：${a.answer}` : ""}`,
      ),
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 1200);
    const question_category =
      (lab.source.question_category as import("@/lib/poju/agent-state").QuestionCategory) ??
      (inferQuestionCategoryFromText(
        [lab.source.original_question, agenda].filter(Boolean).join("\n"),
      ) as import("@/lib/poju/agent-state").QuestionCategory) ??
      null;
    const thesis = buildChartThesisFromStructured(structured, agenda || null, {
      question_category,
      as_of: new Date(),
    });
    lab.artifacts.thesis = thesis;
    return {
      input_payload: { dims: thesis.dimensions.length, pipeline: "v3" },
      raw_model_output: thesis,
      processing_actions: [{ action: "buildChartThesisFromStructured" }],
      gate_verdict: {
        passed: thesis.dimensions.length >= 1,
        detail: `dims=${thesis.dimensions.length}`,
      },
      output_to_next_stage: thesis,
    };
  }

  if (def.kind === "prealloc") {
    const thesis = (lab.artifacts.thesis as ChartThesis | null | undefined) ?? null;
    const structured = tryStructuredFromBaseAnalysis(lab.source.base_analysis);
    try {
      const map = preallocateChartPrimaries({
        thesis,
        structured,
        eastern_calc_slice_by_key: { metaphysics_action: null },
      });
      const grounded = assertPreallocPrimariesGroundedInThesis(map, thesis);
      lab.artifacts.prealloc = map;
      const pack = map.chart_fact_pack?.trim() ?? "";
      const hasQimen = Boolean(map.qimen_cast_at && map.qimen?.text);
      const gateOk = Boolean(pack) && hasQimen && grounded.ok;
      return {
        input_payload: { pack_chars: pack.length, qimen: map.qimen?.ju_name },
        raw_model_output: map,
        processing_actions: [{ action: "preallocateChartPrimaries" }],
        gate_verdict: {
          passed: gateOk,
          failed_rule: gateOk
            ? undefined
            : !hasQimen
              ? "prealloc:qimen_missing"
              : "prealloc:incomplete",
          detail: `pack=${pack.length} qimen=${map.qimen?.ju_name ?? "?"}`,
        },
        output_to_next_stage: map,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        input_payload: {},
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: { passed: false, failed_rule: "prealloc:qimen_cast_failed", detail: msg },
        output_to_next_stage: null,
        error: msg,
      };
    }
  }

  if (def.kind === "assemble") {
    const pages: DeliverySegmentKey[] = [
      "direct_answer",
      "foundation",
      "science_action",
      "metaphysics_action",
      "risk_guard",
      "signals_close",
    ];
    const lines: string[] = ["# Delivery Lab v3 preview", ""];
    for (const k of pages) {
      const p = lab.artifacts.by_page[k];
      const schema = p?.page_schema as DeliveryPageData | undefined;
      lines.push(`## ${k}`);
      lines.push(schema ? JSON.stringify(schema, null, 2).slice(0, 2_000) : "(empty)");
      lines.push("");
    }
    const preview = lines.join("\n");
    lab.artifacts.assemble_preview = preview;
    return {
      input_payload: { pipeline: "v3" },
      raw_model_output: { preview_chars: preview.length },
      processing_actions: [{ action: "assemble_preview_v3" }],
      gate_verdict: { passed: true, detail: "preview ok" },
      output_to_next_stage: { preview },
    };
  }

  if (!page) {
    return {
      input_payload: {},
      raw_model_output: null,
      processing_actions: [],
      gate_verdict: { passed: false, failed_rule: "missing_page" },
      output_to_next_stage: null,
      error: "missing_page",
    };
  }

  const { opts, p3_body_excerpt, action_brief } = await buildLabPromptOpts(lab, page);
  const art = ensurePage(lab, page);

  if (def.kind === "content_judgment") {
    const preallocArt = lab.artifacts.prealloc as
      | { chart_fact_pack?: string }
      | undefined;
    const rawFactPack = preallocArt?.chart_fact_pack?.trim() ?? "";
    const feed = pageFeedFlags(page, "judgment");
    let scienceMeansJudgment = "";
    if (feed.science_means && page === "science_action") {
      const { buildScienceMeansFeedBlock } = await import(
        "@/lib/llm/pro/delivery/science-means-feed"
      );
      scienceMeansJudgment =
        opts.science_means_judgment_feed?.trim() ||
        buildScienceMeansFeedBlock(
          (lab.source.breakthrough_core as import("@/lib/poju/agent-state").BreakthroughCore | null) ??
            null,
          null,
          { forJudgment: true },
        );
    } else if (feed.science_means) {
      scienceMeansJudgment = opts.science_means_feed?.trim() || "";
    }
    if (
      page === "science_action" &&
      feed.science_means &&
      !/【P3 科学手段候选菜单/.test(scienceMeansJudgment)
    ) {
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "judgment",
          error: "p3_science_means_menu_missing",
        },
        raw_model_output: null,
        processing_actions: [
          {
            action: "pageFeedFlags",
            detail: "science_means_judgment_feed_empty",
          },
        ],
        gate_verdict: {
          passed: false,
          failed_rule: "gate_p3_science_means_menu_missing",
          detail:
            "P3 批断缺科学手段派工菜单。回查 breakthrough_core / buildScienceMeansFeedBlock(forJudgment) 后重跑——禁止空菜单现编 means_candidate_ref。",
        },
        output_to_next_stage: null,
        error: "p3_science_means_menu_missing",
      };
    }
    // P4 批断：Fact-pack 已含锁盘；不灌 fill 向 eastern_calc（派工多维/Q·E/处方污染）。
    // moat 用 forJudgment 薄菜单（无收集事实）。
    let metaphysicsMoatJudgment = "";
    if (feed.metaphysics_moat && page === "metaphysics_action") {
      const { buildMetaphysicsMoatFeedBlock } = await import(
        "@/lib/llm/pro/delivery/metaphysics-moat-feed"
      );
      const preallocP4 = lab.artifacts.prealloc as
        | { qimen?: unknown; chart_fact_pack?: string }
        | undefined;
      metaphysicsMoatJudgment =
        opts.metaphysics_moat_judgment_feed?.trim() ||
        buildMetaphysicsMoatFeedBlock(
          (lab.source.breakthrough_core as import("@/lib/poju/agent-state").BreakthroughCore | null) ??
            null,
          null,
          {
            qimen:
              (preallocP4?.qimen as import("@/lib/llm/pro/delivery/page-schema/qimen-fact-pack").DeliveryQimenFactPack | undefined) ??
              null,
            chart_fact_pack: preallocP4?.chart_fact_pack ?? null,
            forJudgment: true,
          },
        ).block;
    } else if (feed.metaphysics_moat) {
      metaphysicsMoatJudgment = opts.metaphysics_moat_feed?.trim() || "";
    }
    let feedParts = scrubJudgmentFeedPrescriptions(
      [
        feed.thesis_factpack ? opts.chart_thesis_block : "",
        feed.thesis_factpack && rawFactPack
          ? `## 本盘 Fact-pack\n${rawFactPack.slice(0, 4_000)}`
          : "",
        // 批断不灌 fill 派工全文；锁盘已在 Fact-pack。正文步仍用 eastern_calc_slice。
        page === "metaphysics_action" && def.kind === "content_judgment"
          ? ""
          : feed.qimen
            ? opts.eastern_calc_slice
            : "",
        metaphysicsMoatJudgment,
        scienceMeansJudgment,
        feed.foundation_surface ? opts.foundation_surface_feed : "",
        feed.risk_fuse ? opts.risk_fuse_feed : "",
        feed.close_ritual ? opts.close_ritual_feed : "",
        feed.reality ? opts.reality_constraints : "",
        feed.question_expectation ? opts.question_expectation : "",
        feed.structured_inventory
          ? opts.structured_inventory?.slice(0, 6_000)
          : "",
      ]
        .filter((s) => s?.trim())
        .join("\n\n"),
    );
    // 共享 Fact-pack 含奇门块：本页未授权则剥净（页级白名单，非「去奇门」）
    if (!feed.qimen) {
      feedParts = stripQimenBlocksUnlessPageAllows(feedParts);
    }
    const judged = await runContentJudgmentGenerate({
      key: page,
      locale: lab.source.locale || "zh",
      session_id,
      timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      user_feed: feedParts || "(无额外喂料 — 仅靠 key/core)",
      core_conclusion: opts.core_conclusion,
    });
    if (!judged.ok) {
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "judgment",
          user_feed_chars: (feedParts || "").length,
          has_call_trace: Boolean(judged.call_trace),
        },
        raw_model_output: judged.last_raw_text
          ? { _raw_text: judged.last_raw_text }
          : null,
        processing_actions: [{ action: "runContentJudgmentGenerate", detail: judged.reason }],
        gate_verdict: {
          passed: false,
          failed_rule: judged.reason,
          detail: "运输/JSON 失败 — 非质量闸。可重跑本枪。",
        },
        output_to_next_stage: null,
        tokens_used: judged.tokens_used,
        error: judged.reason,
        call_trace: judged.call_trace,
      };
    }
    art.plan = judged.plan;
    art.assignment = undefined;
    const catGate = gateJudgmentCategoryB({
      key: page,
      deep_evidence_plan: judged.plan,
    });
    const catFail = catGate && !catGate.passed;
    return {
      input_payload: {
        key: page,
        pipeline: "v3",
        units: judged.plan.units.length,
        quality_gates: catFail ? "category_b_early" : "shape_only_human",
        user_feed_chars: (feedParts || "").length,
        prompt_chars: {
          system: judged.call_trace.system.length,
          user: judged.call_trace.user.length,
        },
        reasoning_chars: judged.call_trace.reasoning?.length ?? 0,
        meta: judged.call_trace.meta,
      },
      raw_model_output: judged.plan,
      processing_actions: [
        { action: "runContentJudgmentGenerate", detail: "parse_only" },
        ...(catFail
          ? [{ action: "gateJudgmentCategoryB", detail: catGate.failed_rule ?? "fail" }]
          : []),
      ],
      gate_verdict: catFail
        ? {
            passed: false,
            failed_rule: catGate.failed_rule,
            detail: catGate.detail,
          }
        : {
            passed: true,
            detail: `units=${judged.plan.units.length} · 已升闸类别可过 · 其余人审在 gate 步 · 完整调用见 Call trace`,
          },
      output_to_next_stage: judged.plan,
      tokens_used: judged.tokens_used,
      call_trace: judged.call_trace,
      ...(catFail ? { error: catGate.failed_rule } : {}),
    };
  }

  if (def.kind === "content_body") {
    const plan = (art.plan as DeepEvidencePlan | undefined) ?? null;
    if (!plan?.units?.length) {
      return {
        input_payload: { key: page },
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: { passed: false, failed_rule: "missing_judgment_plan" },
        output_to_next_stage: null,
        error: "missing_judgment_plan",
      };
    }
    const finalize = labSyntheticFinalize(lab);
    const preallocArt = lab.artifacts.prealloc as
      | { chart_fact_pack?: string }
      | undefined;
    const body = await runContentBodyGenerate({
      key: page,
      finalize,
      locale: lab.source.locale || "zh",
      session_id,
      timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      thinking_effort: "high",
      deep_evidence_plan: plan,
      action_brief: action_brief ?? null,
      chart_thesis_block: opts.chart_thesis_block,
      chart_fact_pack: preallocArt?.chart_fact_pack,
      primary_backup_hint: opts.primary_backup_hint,
      question_expectation: opts.question_expectation,
      eastern_calc_slice: opts.eastern_calc_slice,
      reality_constraints: opts.reality_constraints,
      foundation_surface_feed: opts.foundation_surface_feed,
      science_means_feed: opts.science_means_feed,
      metaphysics_moat_feed: opts.metaphysics_moat_feed,
      risk_fuse_feed: opts.risk_fuse_feed,
      close_ritual_feed: opts.close_ritual_feed,
      structured_inventory: opts.structured_inventory,
      p3_body_excerpt,
    });
    if (!body.ok) {
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "body",
          has_call_trace: Boolean(body.call_trace),
        },
        raw_model_output: body.last_raw_text
          ? { _raw_text: body.last_raw_text }
          : null,
        processing_actions: [{ action: "runContentBodyGenerate", detail: body.reason }],
        gate_verdict: {
          passed: false,
          failed_rule: body.reason,
          detail: "运输/JSON 失败 — 非质量闸。",
        },
        output_to_next_stage: null,
        tokens_used: body.tokens_used,
        error: body.reason,
        call_trace: body.call_trace,
      };
    }
    art.page_schema = body.page;
    const realityBlob = [
      opts.reality_constraints,
      opts.question_expectation,
      opts.science_means_feed,
      opts.metaphysics_moat_feed,
      opts.eastern_calc_slice,
    ]
      .filter((s) => s?.trim())
      .join("\n");
    /** P3 有润色步：正文只硬拦事实/门槛；专名/引号/X%  defer 到 polish 后 full 闸。 */
    const deferSurfaceToPolish = page === "science_action";
    const bodyGate = gateBodyCategoryB({
      key: page,
      page_schema: body.page,
      reality_blob: realityBlob,
      surface: deferSurfaceToPolish ? "substance_only" : "full",
    });
    const surfacePreview = deferSurfaceToPolish
      ? gateBodyCategoryB({
          key: page,
          page_schema: body.page,
          reality_blob: realityBlob,
          surface: "full",
        })
      : null;
    const bodyFail = bodyGate && !bodyGate.passed;
    const surfaceDeferred =
      !bodyFail &&
      surfacePreview &&
      !surfacePreview.passed &&
      surfacePreview.failed_rule
        ? surfacePreview.failed_rule
        : null;
    return {
      input_payload: {
        key: page,
        pipeline: "v3",
        quality_gates: bodyFail
          ? "category_b_substance"
          : deferSurfaceToPolish
            ? "substance_only_surface_at_polish"
            : "shape_only_human",
        surface_deferred: surfaceDeferred,
        prompt_chars: {
          system: body.call_trace.system.length,
          user: body.call_trace.user.length,
        },
        reasoning_chars: body.call_trace.reasoning?.length ?? 0,
        meta: body.call_trace.meta,
      },
      raw_model_output: body.page,
      processing_actions: [
        { action: "runContentBodyGenerate", detail: "parse_only" },
        ...(bodyFail
          ? [
              {
                action: "gateBodyCategoryB",
                detail: bodyGate.failed_rule ?? "fail",
              },
            ]
          : [
              {
                action: "gateBodyCategoryB",
                detail: deferSurfaceToPolish
                  ? surfaceDeferred
                    ? `substance_pass·surface_deferred:${surfaceDeferred}`
                    : "substance_pass·surface_clean"
                  : "pass",
              },
            ]),
      ],
      gate_verdict: bodyFail
        ? {
            passed: false,
            failed_rule: bodyGate.failed_rule,
            detail: bodyGate.detail,
          }
        : {
            passed: true,
            detail: deferSurfaceToPolish
              ? surfaceDeferred
                ? `正文已落库 · 事实/门槛过 · 表面类（${surfaceDeferred}）留给润色步清 · 请 gate 人审真准价值`
                : "正文已落库 · 事实/门槛过 · 表面已干净 · 请 gate 人审真准价值后进润色"
              : "正文已落库 · 已升闸类别可过 · 请到 gate 步人审 · 完整调用见 Call trace",
          },
      output_to_next_stage: body.page,
      tokens_used: body.tokens_used,
      call_trace: body.call_trace,
      ...(bodyFail ? { error: bodyGate.failed_rule } : {}),
    };
  }

  if (def.kind === "gate") {
    const verdict = gateContentPhaseA({
      key: page,
      page_schema: art.page_schema as DeliveryPageData | undefined,
      deep_evidence_plan: art.plan as DeepEvidencePlan | undefined,
    });
    return {
      input_payload: { key: page, pipeline: "v3", phase: "gate_a" },
      raw_model_output: { notes: verdict.notes },
      processing_actions: [{ action: "gateContentPhaseA" }],
      gate_verdict: {
        passed: verdict.passed,
        failed_rule: verdict.failed_rule,
        detail: verdict.detail,
      },
      output_to_next_stage: {
        frozen_page: art.page_schema,
        frozen_plan: art.plan,
        notes: verdict.notes,
      },
    };
  }

  if (def.kind === "body_polish") {
    const draft =
      (art.page_schema_pre_polish as DeliveryPageData | undefined) ??
      (art.page_schema as DeliveryPageData | undefined);
    if (!draft) {
      return {
        input_payload: { key: page, pipeline: "v3", phase: "body_polish" },
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: { passed: false, failed_rule: "missing_body_for_polish" },
        output_to_next_stage: null,
        error: "missing_body_for_polish",
      };
    }
    if (!art.page_schema_pre_polish) {
      art.page_schema_pre_polish = structuredClone(draft);
    }
    const polishStepKey = `${page}.body_polish`;
    const priorAttempts = lab.steps[polishStepKey]?.attempts ?? [];
    let prior_gate_fail: { failed_rule?: string; detail?: string } | null =
      null;
    for (let i = priorAttempts.length - 1; i >= 0; i--) {
      const gv = priorAttempts[i]?.gate_verdict;
      if (gv && !gv.passed && gv.failed_rule) {
        prior_gate_fail = {
          failed_rule: gv.failed_rule,
          detail: gv.detail,
        };
        break;
      }
    }
    if (!prior_gate_fail) {
      const bodyAttempts = lab.steps[`${page}.content.body`]?.attempts ?? [];
      for (let i = bodyAttempts.length - 1; i >= 0; i--) {
        const payload = bodyAttempts[i]?.input_payload as
          | { surface_deferred?: string }
          | undefined;
        const deferred = payload?.surface_deferred?.trim();
        if (deferred) {
          prior_gate_fail = {
            failed_rule: deferred,
            detail:
              "正文步已 defer 的表面类；润色时清掉（勿改事实/门槛/动作指向）。",
          };
          break;
        }
      }
    }
    const polished = await runBodyPolishGenerate({
      key: page,
      locale: lab.source.locale || "zh",
      draft: art.page_schema_pre_polish as DeliveryPageData,
      session_id,
      timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      prior_gate_fail,
    });
    if (!polished.ok) {
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "body_polish",
          has_call_trace: Boolean(polished.call_trace),
        },
        raw_model_output: polished.last_raw_text
          ? { _raw_text: polished.last_raw_text }
          : null,
        processing_actions: [
          { action: "runBodyPolishGenerate", detail: polished.reason },
        ],
        gate_verdict: {
          passed: false,
          failed_rule: polished.reason,
          detail: "润色运输/JSON 失败 — 已过闸正文未覆盖。",
        },
        output_to_next_stage: null,
        tokens_used: polished.tokens_used,
        error: polished.reason,
        call_trace: polished.call_trace,
      };
    }
    const bodyGate = gateBodyCategoryB({
      key: page,
      page_schema: polished.page,
      reality_blob: [
        opts.reality_constraints,
        opts.question_expectation,
        opts.science_means_feed,
        opts.metaphysics_moat_feed,
        opts.eastern_calc_slice,
      ]
        .filter((s) => s?.trim())
        .join("\n"),
      surface: "full",
    });
    const bodyFail = bodyGate && !bodyGate.passed;
    if (bodyFail) {
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "body_polish",
          quality_gates: "category_b_after_polish",
        },
        raw_model_output: polished.page,
        processing_actions: [
          { action: "runBodyPolishGenerate", detail: "ok" },
          {
            action: "gateBodyCategoryB",
            detail: bodyGate.failed_rule ?? "fail",
          },
        ],
        gate_verdict: {
          passed: false,
          failed_rule: bodyGate.failed_rule,
          detail: `${bodyGate.detail ?? ""}（润色未覆盖已过闸正文）`,
        },
        output_to_next_stage: null,
        tokens_used: polished.tokens_used,
        call_trace: polished.call_trace,
        error: bodyGate.failed_rule,
      };
    }
    art.page_schema = polished.page;
    return {
      input_payload: {
        key: page,
        pipeline: "v3",
        phase: "body_polish",
        quality_gates: "category_b_after_polish",
        prompt_chars: {
          system: polished.call_trace.system.length,
          user: polished.call_trace.user.length,
        },
        meta: polished.call_trace.meta,
      },
      raw_model_output: polished.page,
      processing_actions: [
        { action: "runBodyPolishGenerate", detail: "polish_ok" },
        { action: "gateBodyCategoryB", detail: "pass" },
      ],
      gate_verdict: {
        passed: true,
        detail: "可见层润色完成 · 专名闸通过 · 请人审读感后解锁依据软译",
      },
      output_to_next_stage: polished.page,
      tokens_used: polished.tokens_used,
      call_trace: polished.call_trace,
    };
  }

  if (def.kind === "evidence_soft") {
    const plan = art.plan as DeepEvidencePlan | undefined;
    if (!plan?.units?.length) {
      return {
        input_payload: { key: page },
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: { passed: false, failed_rule: "missing_judgment_for_soft" },
        output_to_next_stage: null,
        error: "missing_judgment_for_soft",
      };
    }
    const frozen = freezeRawJudgmentAsEvidence({ key: page, plan });
    art.evidence = frozen.evidence;
    art.marked = frozen.marked;
    return {
      input_payload: { key: page, pipeline: "v3", phase: "evidence_soft" },
      raw_model_output: frozen.marked,
      processing_actions: frozen.notes.map((n) => ({ action: n })),
      gate_verdict: {
        passed: true,
        detail: "Phase A：原批断冻结进折叠层；自造术语编码后续打开",
      },
      output_to_next_stage: frozen.marked,
    };
  }

  return {
    input_payload: {},
    raw_model_output: null,
    processing_actions: [],
    gate_verdict: { passed: false, failed_rule: "unknown_v3_kind" },
    output_to_next_stage: null,
    error: "unknown_v3_kind",
  };
}

export type LabV3RunResult =
  | { ok: true; lab: DeliveryLabSession; attempt: LabAttempt }
  | { ok: false; reason: string; lab: DeliveryLabSession; attempt?: LabAttempt };

export async function runLabStepV3(
  lab: DeliveryLabSession,
  step_key: string,
): Promise<LabV3RunResult> {
  const lock = canRunV3(lab, step_key);
  if (lock) {
    return { ok: false, reason: lock, lab };
  }
  const def = labV3StepDef(step_key);
  if (!def) return { ok: false, reason: "unknown_step", lab };

  const rec = lab.steps[step_key] ?? {
    step_key,
    status: "idle" as const,
    attempts: [] as LabAttempt[],
  };
  rec.status = "running";
  lab.steps[step_key] = rec;
  await saveDeliveryLab(lab);

  const t0 = Date.now();
  const attempt_number = rec.attempts.length + 1;
  try {
    const result = await executeV3(lab, def);
    const attempt: LabAttempt = {
      attempt_number,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - t0,
      tokens_used: result.tokens_used,
      generation_id: result.call_trace?.meta.generation_id ?? null,
      input_payload: result.input_payload,
      raw_model_output: result.raw_model_output,
      processing_actions: result.processing_actions,
      gate_verdict: result.gate_verdict,
      output_to_next_stage: result.output_to_next_stage,
      error: result.error,
      ...(result.call_trace ? { call_trace: result.call_trace } : {}),
    };
    rec.attempts.push(attempt);
    if (result.gate_verdict.passed && !result.error) {
      rec.status = "done";
    } else {
      rec.status = "failed";
    }
    lab.steps[step_key] = rec;
    await saveDeliveryLab(lab);
    if (result.error || !result.gate_verdict.passed) {
      return {
        ok: false,
        reason: result.error ?? result.gate_verdict.failed_rule ?? "step_failed",
        lab,
        attempt,
      };
    }
    return { ok: true, lab, attempt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const attempt: LabAttempt = {
      attempt_number,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - t0,
      input_payload: { step_key },
      raw_model_output: null,
      processing_actions: [],
      gate_verdict: { passed: false, failed_rule: "exception", detail: msg },
      output_to_next_stage: null,
      error: msg,
    };
    rec.attempts.push(attempt);
    rec.status = "failed";
    lab.steps[step_key] = rec;
    await saveDeliveryLab(lab);
    return { ok: false, reason: msg, lab, attempt };
  }
}

export function isLabPipelineV3(lab: DeliveryLabSession): boolean {
  return lab.pipeline === "v3_three_step";
}

export async function approveLabStepV3(
  lab: DeliveryLabSession,
  step_key: string,
): Promise<{ ok: true; lab: DeliveryLabSession } | { ok: false; reason: string; lab: DeliveryLabSession }> {
  const idx = LAB_STEP_DEFS_V3.findIndex((s) => s.step_key === step_key);
  if (idx < 0) return { ok: false, reason: "unknown_step", lab };
  if (idx !== lab.cursor_index) return { ok: false, reason: "not_current_cursor", lab };

  const rec = lab.steps[step_key];
  if (!rec || rec.attempts.length === 0) {
    return { ok: false, reason: "run_step_first", lab };
  }
  const last = rec.attempts[rec.attempts.length - 1]!;
  if (!last.gate_verdict.passed || last.error) {
    return { ok: false, reason: "gate_not_passed", lab };
  }
  rec.status = "approved";
  rec.approved_attempt = last.attempt_number;
  lab.steps[step_key] = rec;
  if (!lab.approved_order.includes(step_key)) lab.approved_order.push(step_key);
  if (lab.cursor_index < LAB_STEP_DEFS_V3.length - 1) {
    lab.cursor_index += 1;
  }
  await saveDeliveryLab(lab);
  return { ok: true, lab };
}

export async function prepareLabRerunV3(
  lab: DeliveryLabSession,
  step_key: string,
): Promise<{ ok: true; lab: DeliveryLabSession } | { ok: false; reason: string; lab: DeliveryLabSession }> {
  const idx = LAB_STEP_DEFS_V3.findIndex((s) => s.step_key === step_key);
  if (idx < 0) return { ok: false, reason: "unknown_step", lab };
  if (idx > lab.cursor_index) return { ok: false, reason: "step_locked", lab };

  lab.cursor_index = idx;
  const rerunDef = LAB_STEP_DEFS_V3[idx];
  if (rerunDef?.page) {
    const art = ensurePage(lab, rerunDef.page);
    if (rerunDef.kind === "content_judgment") {
      art.plan = undefined;
      art.page_schema = undefined;
      art.evidence = undefined;
      art.marked = undefined;
    }
    if (rerunDef.kind === "content_body") {
      art.page_schema = undefined;
      art.page_schema_pre_polish = undefined;
    }
    if (rerunDef.kind === "body_polish") {
      if (art.page_schema_pre_polish) {
        art.page_schema = structuredClone(art.page_schema_pre_polish);
      }
    }
    if (rerunDef.kind === "evidence_soft") {
      art.evidence = undefined;
      art.marked = undefined;
    }
  }
  for (let i = idx; i < LAB_STEP_DEFS_V3.length; i++) {
    const key = LAB_STEP_DEFS_V3[i]!.step_key;
    const rec = lab.steps[key];
    if (!rec) continue;
    if (i === idx) {
      rec.status = "idle";
      rec.approved_attempt = undefined;
      lab.steps[key] = rec;
      continue;
    }
    if (rec.status === "approved" || rec.status === "done" || rec.status === "running") {
      rec.status = "stale";
      rec.approved_attempt = undefined;
      lab.steps[key] = rec;
    }
  }
  lab.approved_order = lab.approved_order.filter((k) => {
    const i = LAB_STEP_DEFS_V3.findIndex((s) => s.step_key === k);
    return i >= 0 && i < idx;
  });
  await saveDeliveryLab(lab);
  return { ok: true, lab };
}
