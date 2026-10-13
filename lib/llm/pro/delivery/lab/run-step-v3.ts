/**
 * Lab executor for pipeline v3 — greenfield. Does not call legacy executeKind.
 */

import { pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import {
  DELIVERY_SINGLE_CALL_TIMEOUT_MS,
  DELIVERY_SOFT_ARGS_PER_CALL,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import type {
  DeliveryArgumentTree,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { tryStructuredFromBaseAnalysis } from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";
import { buildChartThesisFromStructured } from "@/lib/llm/pro/delivery/thesis";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import { inferQuestionCategoryFromText } from "@/lib/llm/prompts/relation-closed-set-context";
import {
  assertPreallocPrimariesGroundedInThesis,
  preallocateChartPrimaries,
} from "@/lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";
import { buildLabPromptOpts, labSyntheticFinalize } from "@/lib/llm/pro/delivery/lab/build-context";
import {
  slimLabCallTrace,
  stripStaleAttemptCallTraces,
} from "@/lib/llm/pro/delivery/lab/call-trace";
import { saveDeliveryLab } from "@/lib/llm/pro/delivery/lab/store";
import type {
  DeliveryLabSession,
  LabAttempt,
  LabGateVerdict,
} from "@/lib/llm/pro/delivery/lab/types";
import {
  LAB_STEP_DEFS_V3,
  labV3StepDef,
  isBodyPolishLocale,
  ensureLabStepsV3,
  type LabV3StepDef,
  type BodyPolishLocale,
} from "@/lib/llm/pro/delivery/lab/types-v3";
import { runContentJudgmentGenerate } from "@/lib/llm/pro/delivery/pipeline-v3/content-judgment";
import { runContentBodyGenerate } from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import { scrubJudgmentFeedPrescriptions, stripQimenBlocksUnlessPageAllows } from "@/lib/llm/pro/delivery/pipeline-v3/scrub-judgment-feed";
import { pageFeedFlags } from "@/lib/llm/pro/delivery/pipeline-v3/page-feed-policy";
import { gateContentPhaseA } from "@/lib/llm/pro/delivery/pipeline-v3/gate-phase-a";
import { gateJudgmentCategoryB } from "@/lib/llm/pro/delivery/pipeline-v3/gate-judgment-category";
import { gateBodyCategoryB } from "@/lib/llm/pro/delivery/pipeline-v3/gate-body-category";
import { runEvidenceSoftGenerate } from "@/lib/llm/pro/delivery/pipeline-v3/evidence-soft";
import {
  gateBodyPolishThickness,
  runBodyPolishGenerate,
} from "@/lib/llm/pro/delivery/pipeline-v3/body-polish";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import { isV3LabTransportSupplyFail } from "@/lib/llm/pro/delivery/dispatch/provider-escape";
import {
  buildAcceptanceCorrectiveBlock,
} from "@/lib/llm/pro/delivery/pipeline-v3/acceptance-retry";
import { resolveBaziDayContext } from "@/lib/calculations/liuri";
import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";
import { gateCompanionBatch } from "@/lib/companion/batch-gate";
import {
  generateCompanionDayPair,
  labPairDayIndexes,
  nextPendingDayIndexes,
  priorFingerprintsFromDays,
} from "@/lib/companion/batch-generate";
import { buildLiuriPack } from "@/lib/companion/build-liuri-pack";
import { addDaysKey, formatDateKey } from "@/lib/companion/date-keys";
import { extractCompanionBrief } from "@/lib/companion/extract-companion-brief";
import { normalizeCompanionLocale } from "@/lib/companion/locale-voice";
import { resolveCompanionBriefForLabLocale } from "@/lib/companion/resolve-brief-for-locale";
import {
  COMPANION_WINDOW_DAYS,
  CompanionBriefSchema,
  type CompanionBrief,
  type CompanionDayCards,
} from "@/lib/companion/types";

function ensurePage(
  lab: DeliveryLabSession,
  page: DeliverySegmentKey,
): NonNullable<DeliveryLabSession["artifacts"]["by_page"][DeliverySegmentKey]> {
  if (!lab.artifacts.by_page[page]) {
    lab.artifacts.by_page[page] = {};
  }
  return lab.artifacts.by_page[page]!;
}

type V3EscapeKind = "judgment" | "body" | "polish" | "soft";
type V3AcceptanceKind = "judgment" | "body" | "polish" | "soft";

function v3EscapeArmed(
  art: NonNullable<DeliveryLabSession["artifacts"]["by_page"][DeliverySegmentKey]>,
  kind: V3EscapeKind,
): boolean {
  return art.v3_transport_escape?.[kind] === true;
}

function setV3Escape(
  art: NonNullable<DeliveryLabSession["artifacts"]["by_page"][DeliverySegmentKey]>,
  kind: V3EscapeKind,
  on: boolean,
): void {
  art.v3_transport_escape = {
    ...(art.v3_transport_escape ?? {}),
    [kind]: on,
  };
}

function v3AcceptanceArmed(
  art: NonNullable<DeliveryLabSession["artifacts"]["by_page"][DeliverySegmentKey]>,
  kind: V3AcceptanceKind,
): boolean {
  return art.v3_acceptance_retry?.[kind] === true;
}

function setV3AcceptanceArmed(
  art: NonNullable<DeliveryLabSession["artifacts"]["by_page"][DeliverySegmentKey]>,
  kind: V3AcceptanceKind,
  on: boolean,
): void {
  art.v3_acceptance_retry = {
    ...(art.v3_acceptance_retry ?? {}),
    [kind]: on,
  };
}

function setV3AcceptancePrior(
  art: NonNullable<DeliveryLabSession["artifacts"]["by_page"][DeliverySegmentKey]>,
  kind: V3AcceptanceKind,
  fail: { failed_rule?: string; detail?: string } | null,
): void {
  art.v3_acceptance_prior = {
    ...(art.v3_acceptance_prior ?? {}),
    [kind]: fail ?? undefined,
  };
}

function v3AcceptanceCorrective(
  art: NonNullable<DeliveryLabSession["artifacts"]["by_page"][DeliverySegmentKey]>,
  kind: V3AcceptanceKind,
): string {
  if (!v3AcceptanceArmed(art, kind)) return "";
  return buildAcceptanceCorrectiveBlock(art.v3_acceptance_prior?.[kind]);
}

function clearV3Acceptance(
  art: NonNullable<DeliveryLabSession["artifacts"]["by_page"][DeliverySegmentKey]>,
  kind: V3AcceptanceKind,
): void {
  setV3AcceptanceArmed(art, kind, false);
  setV3AcceptancePrior(art, kind, null);
}

/** 供应侧失败：新 invoke + DigitalOcean；不写 error（客户端靠 ok+continue 自动续跑）。 */
function v3TransportEscapeContinue(input: {
  key: DeliverySegmentKey;
  phase: string;
  reason: string;
  tokens_used?: number;
  call_trace?: ExecOut["call_trace"];
  last_raw_text?: string;
}): ExecOut {
  return {
    input_payload: {
      key: input.key,
      pipeline: "v3",
      phase: input.phase,
      provider_escape_pending: true,
      failed_reason: input.reason,
    },
    raw_model_output: input.last_raw_text
      ? { _raw_text: input.last_raw_text }
      : null,
    processing_actions: [
      {
        action: "v3_transport_escape_schedule",
        detail: `${input.reason} · schedule provider escape`,
      },
    ],
    gate_verdict: {
      passed: false,
      failed_rule: "write_dispatch_continue",
      detail: `供应侧超时/断流/截断（${input.reason}）。客户端将自动用备用供应商重试本枪（新 invoke · DigitalOcean）。`,
    },
    output_to_next_stage: {
      continue: true,
      next_chunk: 0,
      chunks_total: 1,
      write_units_so_far: [],
      provider_escape: true,
    },
    tokens_used: input.tokens_used,
    call_trace: input.call_trace,
  };
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

export type LabV3RunOpts = {
  /** 润色目标语言（一次一语）。 */
  polish_locale?: string;
  /** 跳过润色：对正文跑 full 表面闸，通过则可 unlock soft。 */
  skip_polish?: boolean;
  /** Companion 单日提醒 day_index（0–29）。 */
  day_index?: number;
};

export type LabV3RerunOpts = {
  /** Companion daily：清空当前选中的 N/+1 日稿（人审准备重跑）；504 解锁勿传。 */
  clear_companion_pair_day_index?: number;
};

function isCompanionSideKind(kind: LabV3StepDef["kind"]): boolean {
  return (
    kind === "companion_seal" ||
    kind === "companion_daily" ||
    kind === "companion_batch_pair" ||
    kind === "companion_batch_gate"
  );
}

function resolveCompanionLocale(
  lab: DeliveryLabSession,
  runOpts?: LabV3RunOpts,
): string {
  if (isBodyPolishLocale(runOpts?.polish_locale ?? "")) {
    return runOpts!.polish_locale as BodyPolishLocale;
  }
  if (isBodyPolishLocale(lab.artifacts.companion?.output_locale ?? "")) {
    return lab.artifacts.companion!.output_locale as BodyPolishLocale;
  }
  return normalizeCompanionLocale(lab.source.locale || "zh");
}

function companionP1P3Ready(lab: DeliveryLabSession): boolean {
  const p1 = lab.artifacts.by_page.direct_answer?.page_schema;
  const p3 = lab.artifacts.by_page.science_action?.page_schema;
  return Boolean(p1 && p3);
}

function canRunV3(lab: DeliveryLabSession, step_key: string): string | null {
  const idx = LAB_STEP_DEFS_V3.findIndex((s) => s.step_key === step_key);
  if (idx < 0) return "unknown_step";
  const def = LAB_STEP_DEFS_V3[idx]!;
  /** Companion 侧轨：P1+P3 有正文即可测，不挡交付主链 cursor。 */
  if (isCompanionSideKind(def.kind)) {
    if (!companionP1P3Ready(lab)) return "companion_needs_p1_p3_body";
    if (
      (def.kind === "companion_daily" ||
        def.kind === "companion_batch_pair" ||
        def.kind === "companion_batch_gate") &&
      !lab.artifacts.companion?.brief
    ) {
      return "companion_needs_seal";
    }
    const rec = lab.steps[step_key];
    if (rec?.status === "running") return "step_busy";
    return null;
  }
  if (idx > lab.cursor_index) return "step_locked_approve_prior";
  const rec = lab.steps[step_key];
  if (rec?.status === "running") return "step_busy";
  return null;
}

async function executeV3(
  lab: DeliveryLabSession,
  def: LabV3StepDef,
  runOpts?: LabV3RunOpts,
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

  if (def.kind === "companion_seal") {
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
    const p1 = lab.artifacts.by_page.direct_answer?.page_schema as
      | DeliveryPageData
      | undefined;
    const p3 = lab.artifacts.by_page.science_action?.page_schema as
      | DeliveryPageData
      | undefined;
    if (!p1 || !p3) {
      return {
        input_payload: { has_p1: Boolean(p1), has_p3: Boolean(p3) },
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: {
          passed: false,
          failed_rule: "companion_needs_p1_p3_body",
          detail: "需先跑出 P1 + P3 正文 page_schema",
        },
        output_to_next_stage: null,
        error: "companion_needs_p1_p3_body",
      };
    }
    const timezone =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        : "UTC";
    const deliveryDayKey = formatDateKey(
      resolveBaziDayContext(new Date(), timezone).baziDay,
    );
    const companionLocale = resolveCompanionLocale(lab, runOpts);
    let brief: CompanionBrief;
    try {
      brief = extractCompanionBrief({
        fullText: "",
        locale: companionLocale,
        originalQuestion: lab.source.original_question,
        pageSchemas: {
          direct_answer: p1,
          science_action: p3,
        },
      });
      brief = { ...brief, locale: companionLocale };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        input_payload: { delivery_day_key: deliveryDayKey, timezone },
        raw_model_output: null,
        processing_actions: [{ action: "extractCompanionBrief", detail: msg }],
        gate_verdict: {
          passed: false,
          failed_rule: msg,
          detail: "Brief 抽取失败：检查 P1 主辅轨与 P3 toolkit",
        },
        output_to_next_stage: null,
        error: msg,
      };
    }
    const liuri_pack = buildLiuriPack({
      structured,
      deliveryDayKey,
      timezone,
    });
    const days = Array.from({ length: COMPANION_WINDOW_DAYS }, (_, i) => ({
      day_index: i,
      date_key: addDaysKey(deliveryDayKey, i),
      cards: null as CompanionDayCards | null,
      generated_at: null as string | null,
    }));
    const sealed_at = new Date().toISOString();
    lab.artifacts.companion = {
      brief,
      delivery_day_key: deliveryDayKey,
      timezone,
      liuri_pack,
      days,
      sealed_at,
      batch_status: "pending",
      batch_gate: null,
      output_locale: companionLocale,
    };
    return {
      input_payload: {
        pipeline: "v3",
        phase: "companion_seal",
        delivery_day_key: deliveryDayKey,
        timezone,
        output_locale: companionLocale,
        p1_page: "direct_answer",
        p3_page: "science_action",
        primary_means: brief.primary.means_excerpts.length,
        backup_means: brief.backup.means_excerpts.length,
        liuri_days: liuri_pack.length,
      },
      raw_model_output: {
        brief,
        delivery_day_key: deliveryDayKey,
        timezone,
        output_locale: companionLocale,
        liuri_pack_summary: liuri_pack.map((s, i) => ({
          day_index: i,
          date_key: s.asOf.baziDayDate,
          liuri: s.cycles.liuri.ganzhi,
          climateTone: s.energy.climateTone,
        })),
      },
      processing_actions: [
        { action: "extractCompanionBrief" },
        { action: "buildLiuriPack", detail: `${liuri_pack.length} days` },
        { action: "output_locale", detail: companionLocale },
      ],
      gate_verdict: {
        passed: true,
        detail: `Brief+流日包就绪 · ${deliveryDayKey}起 30 日 · locale=${companionLocale} · 可跑 daily / batch_pair`,
      },
      output_to_next_stage: {
        brief,
        delivery_day_key: deliveryDayKey,
        timezone,
        sealed_at,
        output_locale: companionLocale,
      },
    };
  }

  if (def.kind === "companion_daily") {
    const sealed = lab.artifacts.companion;
    if (!sealed?.brief || !Array.isArray(sealed.liuri_pack) || !sealed.liuri_pack.length) {
      return {
        input_payload: {},
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: {
          passed: false,
          failed_rule: "companion_needs_seal",
          detail: "先跑 companion.seal",
        },
        output_to_next_stage: null,
        error: "companion_needs_seal",
      };
    }
    const briefParse = CompanionBriefSchema.safeParse(sealed.brief);
    if (!briefParse.success) {
      return {
        input_payload: {},
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: {
          passed: false,
          failed_rule: "companion_brief_invalid",
          detail: briefParse.error.message,
        },
        output_to_next_stage: null,
        error: "companion_brief_invalid",
      };
    }
    const dayIndexRaw = runOpts?.day_index;
    const dayIndex =
      typeof dayIndexRaw === "number" && Number.isFinite(dayIndexRaw)
        ? Math.max(0, Math.min(COMPANION_WINDOW_DAYS - 1, Math.floor(dayIndexRaw)))
        : 0;
    const indexes = labPairDayIndexes(dayIndex);
    for (const idx of indexes) {
      if (!(sealed.liuri_pack[idx] as AtmosEngineSnapshot | undefined)) {
        return {
          input_payload: { day_index: dayIndex, day_indexes: indexes },
          raw_model_output: null,
          processing_actions: [],
          gate_verdict: {
            passed: false,
            failed_rule: "companion_missing_liuri_day",
            detail: `liuri_pack[${idx}] 缺失`,
          },
          output_to_next_stage: null,
          error: "companion_missing_liuri_day",
        };
      }
    }
    const companionLocale = resolveCompanionLocale(lab, runOpts);
    const briefResolved = resolveCompanionBriefForLabLocale(
      lab,
      companionLocale,
      briefParse.data,
    );
    if (!briefResolved.ok) {
      return {
        input_payload: { output_locale: companionLocale },
        raw_model_output: null,
        processing_actions: [
          { action: "resolveCompanionBriefForLabLocale", detail: briefResolved.detail },
        ],
        gate_verdict: {
          passed: false,
          failed_rule: briefResolved.reason,
          detail: briefResolved.detail,
        },
        output_to_next_stage: null,
        error: briefResolved.reason,
      };
    }
    const briefForGen = briefResolved.brief;
    try {
      const daysWorking = Array.isArray(sealed.days) ? [...sealed.days] : [];
      while (daysWorking.length < COMPANION_WINDOW_DAYS) {
        daysWorking.push({
          day_index: daysWorking.length,
          date_key: addDaysKey(sealed.delivery_day_key, daysWorking.length),
          cards: null,
          generated_at: null,
        });
      }
      const priors = priorFingerprintsFromDays(
        daysWorking.map((d) => ({
          day_index: d.day_index,
          cards: d.cards as CompanionDayCards | null,
        })),
        dayIndex,
      );
      const pair = await generateCompanionDayPair({
        brief: briefForGen,
        liuri_pack: sealed.liuri_pack as AtmosEngineSnapshot[],
        days: daysWorking.map((d) => ({
          day_index: d.day_index,
          date_key: d.date_key,
          cards: d.cards as CompanionDayCards | null,
          generated_at: d.generated_at,
          meta: d.meta,
        })),
        day_indexes: indexes,
        locale: companionLocale,
        sessionId: session_id,
        /** Lab 用人审看推理链：high；质量不过硬停 dump，不自动续跑。 */
        thinking_effort: "high",
      });
      for (const slot of pair.generated) {
        // Lab keeps draft cards even when pair_gate fails (for dump / 人审).
        daysWorking[slot.day_index] = {
          day_index: slot.day_index,
          date_key: slot.date_key,
          cards: slot.cards,
          generated_at: slot.generated_at,
          meta: slot.meta,
        };
      }
      lab.artifacts.companion = {
        ...sealed,
        days: daysWorking,
        batch_status: "filling",
        output_locale: companionLocale,
        brief: briefForGen,
      };
      // Persist day cards before building attempt/call_trace — survives later kill/OOM.
      await saveDeliveryLab(lab);
      const gatePassed = pair.pair_gate_passed === true;
      const primarySnap = sealed.liuri_pack[dayIndex] as AtmosEngineSnapshot;
      const dayLabels = indexes.map((i) => i + 1).join("·");
      return {
        input_payload: {
          pipeline: "v3",
          phase: "companion_daily",
          day_index: dayIndex,
          day_indexes: indexes,
          output_locale: companionLocale,
          brief_locale: briefForGen.locale,
          brief_primary_name: briefForGen.primary.name,
          delivery_day_key: sealed.delivery_day_key,
          timezone: sealed.timezone,
          prior_fingerprints: priors,
          pair_gate_passed: gatePassed,
          brief_tracks: {
            primary: briefForGen.primary.name,
            backup: briefForGen.backup.name,
          },
          snapshot_lean: {
            asOf: primarySnap.asOf,
            liuri: primarySnap.cycles.liuri.ganzhi,
            climateTone: primarySnap.energy.climateTone,
          },
        },
        raw_model_output: {
          days: pair.generated.map((g) => ({
            day_index: g.day_index,
            date_key: g.date_key,
            cards: g.cards,
            error: g.error ?? null,
          })),
        },
        processing_actions: [
          { action: "buildCompanionPairPrompt" },
          {
            action: "generateCompanionDayPair",
            detail: `1枪 · Day ${dayLabels}`,
          },
          { action: "output_locale", detail: companionLocale },
          {
            action: "brief_locale_resolved",
            detail: `${briefResolved.source} · ${briefForGen.locale} · ${briefForGen.primary.name.slice(0, 48)}`,
          },
          ...(gatePassed
            ? []
            : [
                {
                  action: "pair_gate",
                  detail: pair.generated
                    .map((g) => g.error)
                    .filter(Boolean)
                    .join("; "),
                },
              ]),
          ...(pair.call_trace?.meta.thinking_effort
            ? [
                {
                  action: "thinking_effort",
                  detail: String(pair.call_trace.meta.thinking_effort),
                },
              ]
            : []),
        ],
        gate_verdict: gatePassed
          ? {
              passed: true,
              detail: `Day ${dayLabels}/30 · locale=${companionLocale} · brief=${briefForGen.locale} · 1枪双日 · 可换 day/locale 再跑`,
            }
          : {
              passed: false,
              failed_rule:
                pair.generated.find((g) => g.error)?.error?.replace(/^day_gate:/, "") ??
                "companion_pair_gate",
              detail: pair.generated
                .map((g) => g.error)
                .filter(Boolean)
                .join("; "),
            },
        output_to_next_stage: {
          day_indexes: indexes,
          days: pair.generated,
        },
        tokens_used: pair.tokens_used,
        call_trace: pair.call_trace
          ? slimLabCallTrace(pair.call_trace)
          : undefined,
        error: gatePassed ? undefined : "companion_pair_gate",
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        input_payload: {
          day_index: dayIndex,
          day_indexes: indexes,
          output_locale: companionLocale,
        },
        raw_model_output: null,
        processing_actions: [{ action: "generateCompanionDayPair", detail: msg }],
        gate_verdict: {
          passed: false,
          failed_rule: "companion_daily_failed",
          detail: msg,
        },
        output_to_next_stage: null,
        error: msg,
      };
    }
  }

  if (def.kind === "companion_batch_pair") {
    const sealed = lab.artifacts.companion;
    if (!sealed?.brief || !Array.isArray(sealed.liuri_pack) || !sealed.liuri_pack.length) {
      return {
        input_payload: {},
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: {
          passed: false,
          failed_rule: "companion_needs_seal",
          detail: "先跑 companion.seal",
        },
        output_to_next_stage: null,
        error: "companion_needs_seal",
      };
    }
    const briefParse = CompanionBriefSchema.safeParse(sealed.brief);
    if (!briefParse.success) {
      return {
        input_payload: {},
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: {
          passed: false,
          failed_rule: "companion_brief_invalid",
          detail: briefParse.error.message,
        },
        output_to_next_stage: null,
        error: "companion_brief_invalid",
      };
    }
    const companionLocale = resolveCompanionLocale(lab, runOpts);
    const briefResolved = resolveCompanionBriefForLabLocale(
      lab,
      companionLocale,
      briefParse.data,
    );
    if (!briefResolved.ok) {
      return {
        input_payload: { output_locale: companionLocale },
        raw_model_output: null,
        processing_actions: [
          { action: "resolveCompanionBriefForLabLocale", detail: briefResolved.detail },
        ],
        gate_verdict: {
          passed: false,
          failed_rule: briefResolved.reason,
          detail: briefResolved.detail,
        },
        output_to_next_stage: null,
        error: briefResolved.reason,
      };
    }
    const briefForGen = briefResolved.brief;
    const daysWorking = Array.isArray(sealed.days) ? [...sealed.days] : [];
    while (daysWorking.length < COMPANION_WINDOW_DAYS) {
      daysWorking.push({
        day_index: daysWorking.length,
        date_key: addDaysKey(sealed.delivery_day_key, daysWorking.length),
        cards: null,
        generated_at: null,
      });
    }
    const startFrom =
      typeof runOpts?.day_index === "number" && Number.isFinite(runOpts.day_index)
        ? Math.max(0, Math.min(COMPANION_WINDOW_DAYS - 1, Math.floor(runOpts.day_index)))
        : 0;
    const indexes = nextPendingDayIndexes(
      daysWorking.map((d) => ({
        day_index: d.day_index,
        cards: d.cards as CompanionDayCards | null,
      })),
      2,
      startFrom,
    );
    if (!indexes.length) {
      return {
        input_payload: { output_locale: companionLocale, pending: 0 },
        raw_model_output: { message: "all_days_filled" },
        processing_actions: [{ action: "nextPendingDayIndexes", detail: "0 pending" }],
        gate_verdict: {
          passed: true,
          detail: "30/30 已有稿 · 请跑 companion.batch_gate",
        },
        output_to_next_stage: { pending: 0 },
      };
    }
    try {
      const pair = await generateCompanionDayPair({
        brief: briefForGen,
        liuri_pack: sealed.liuri_pack as AtmosEngineSnapshot[],
        days: daysWorking.map((d) => ({
          day_index: d.day_index,
          date_key: d.date_key,
          cards: d.cards as CompanionDayCards | null,
          generated_at: d.generated_at,
          meta: d.meta,
        })),
        day_indexes: indexes,
        locale: companionLocale,
        sessionId: session_id,
        thinking_effort: "high",
      });
      for (const slot of pair.generated) {
        // Only count as filled when gate passed; still keep draft for dump when failed.
        daysWorking[slot.day_index] = {
          day_index: slot.day_index,
          date_key: slot.date_key,
          cards: slot.cards,
          generated_at:
            pair.pair_gate_passed && !slot.error ? slot.generated_at : null,
          meta: slot.meta,
        };
      }
      const filled = daysWorking.filter(
        (d) => d.cards && d.generated_at,
      ).length;
      lab.artifacts.companion = {
        ...sealed,
        days: daysWorking,
        batch_status: "filling",
        output_locale: companionLocale,
        brief: briefForGen,
      };
      await saveDeliveryLab(lab);
      return {
        input_payload: {
          pipeline: "v3",
          phase: "companion_batch_pair",
          day_indexes: indexes,
          output_locale: companionLocale,
          filled_after: filled,
          pair_gate_passed: pair.pair_gate_passed === true,
        },
        raw_model_output: {
          generated: pair.generated.map((g) => ({
            day_index: g.day_index,
            date_key: g.date_key,
            cards: g.cards,
            error: g.error ?? null,
          })),
          fingerprints: pair.fingerprints,
        },
        processing_actions: [
          {
            action: "generateCompanionDayPair",
            detail: `1枪 · days ${indexes.map((i) => i + 1).join("+")} · ${filled}/30`,
          },
          { action: "output_locale", detail: companionLocale },
        ],
        gate_verdict: {
          passed: pair.pair_gate_passed === true,
          detail:
            pair.pair_gate_passed === true
              ? `1枪生成 Day ${indexes.map((i) => i + 1).join("·")} · locale=${companionLocale} · 进度 ${filled}/30`
              : pair.generated
                  .map((g) => g.error)
                  .filter(Boolean)
                  .join("; ") || "一对生成失败",
          failed_rule:
            pair.pair_gate_passed === true
              ? undefined
              : "companion_batch_pair_partial_fail",
        },
        output_to_next_stage: {
          day_indexes: indexes,
          filled,
          locale: companionLocale,
        },
        tokens_used: pair.tokens_used,
        call_trace: pair.call_trace
          ? slimLabCallTrace(pair.call_trace)
          : undefined,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        input_payload: { day_indexes: indexes, output_locale: companionLocale },
        raw_model_output: null,
        processing_actions: [{ action: "generateCompanionDayPair", detail: msg }],
        gate_verdict: {
          passed: false,
          failed_rule: "companion_batch_pair_failed",
          detail: msg,
        },
        output_to_next_stage: null,
        error: msg,
      };
    }
  }

  if (def.kind === "companion_batch_gate") {
    const sealed = lab.artifacts.companion;
    if (!sealed?.brief) {
      return {
        input_payload: {},
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: {
          passed: false,
          failed_rule: "companion_needs_seal",
          detail: "先跑 companion.seal",
        },
        output_to_next_stage: null,
        error: "companion_needs_seal",
      };
    }
    const gate = gateCompanionBatch(
      (sealed.days ?? []).map((d) => ({
        day_index: d.day_index,
        cards: d.cards as CompanionDayCards | null,
      })),
      { require_full_window: true },
    );
    lab.artifacts.companion = {
      ...sealed,
      batch_status: gate.passed ? "ready" : "failed",
      batch_gate: {
        passed: gate.passed,
        failed_rule: gate.failed_rule,
        detail: gate.detail,
        checked_at: gate.checked_at,
        generated_count: gate.generated_count,
      },
    };
    return {
      input_payload: {
        pipeline: "v3",
        phase: "companion_batch_gate",
        generated_count: gate.generated_count,
      },
      raw_model_output: gate,
      processing_actions: [
        { action: "gateCompanionBatch", detail: gate.detail },
      ],
      gate_verdict: {
        passed: gate.passed,
        failed_rule: gate.failed_rule,
        detail: gate.detail,
      },
      output_to_next_stage: gate,
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
    const pathFeedOpts = {
      pivot_chart_path: lab.source.pivot_chart_path ?? null,
      partner_bazi: lab.source.partner_bazi ?? null,
    };
    const feed = pageFeedFlags(page, "judgment", pathFeedOpts);
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
        feed.dyad_relation_structure && opts.dyad_relation_structure?.trim()
          ? opts.dyad_relation_structure.trim()
          : "",
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
    const escapeArmed = v3EscapeArmed(art, "judgment");
    const acceptanceArmed = v3AcceptanceArmed(art, "judgment");
    const judged = await runContentJudgmentGenerate({
      key: page,
      locale: lab.source.locale || "zh",
      session_id,
      timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      dispatch_attempt: escapeArmed ? 2 : 1,
      user_feed: feedParts || "(无额外喂料 — 仅靠 key/core)",
      core_conclusion: opts.core_conclusion,
      pivot_chart_path: lab.source.pivot_chart_path ?? null,
      partner_bazi: lab.source.partner_bazi ?? null,
    });
    if (!judged.ok) {
      if (isV3LabTransportSupplyFail(judged.reason) && !escapeArmed) {
        setV3Escape(art, "judgment", true);
        return v3TransportEscapeContinue({
          key: page,
          phase: "judgment",
          reason: judged.reason,
          tokens_used: judged.tokens_used,
          call_trace: judged.call_trace,
          last_raw_text: judged.last_raw_text,
        });
      }
      if (escapeArmed) setV3Escape(art, "judgment", false);
      if (acceptanceArmed) clearV3Acceptance(art, "judgment");
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "judgment",
          user_feed_chars: (feedParts || "").length,
          has_call_trace: Boolean(judged.call_trace),
          provider_escape_used: escapeArmed,
          acceptance_retry_used: acceptanceArmed,
        },
        raw_model_output: judged.last_raw_text
          ? { _raw_text: judged.last_raw_text }
          : null,
        processing_actions: [{ action: "runContentJudgmentGenerate", detail: judged.reason }],
        gate_verdict: {
          passed: false,
          failed_rule: judged.reason,
          detail: escapeArmed
            ? "供应侧重试已用尽（备用供应商仍失败）。可再点运行或稍后再试。"
            : "运输/JSON 失败 — 非质量闸。可重跑本枪。",
        },
        output_to_next_stage: null,
        tokens_used: judged.tokens_used,
        error: judged.reason,
        call_trace: judged.call_trace,
      };
    }
    if (escapeArmed) setV3Escape(art, "judgment", false);
    art.plan = judged.plan;
    art.assignment = undefined;
    const catGate = gateJudgmentCategoryB({
      key: page,
      deep_evidence_plan: judged.plan,
      day_master_stem: tryStructuredFromBaseAnalysis(lab.source.base_analysis)
        ?.day_master,
    });
    const catFail = catGate && !catGate.passed;
    if (catFail) {
      // Lab: 质量闸不过硬停 dump — 禁止验收自动续跑（生产 DAG 另走 1+1）。
      clearV3Acceptance(art, "judgment");
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          units: judged.plan.units.length,
          quality_gates: "category_b_early",
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
          { action: "gateJudgmentCategoryB", detail: catGate.failed_rule ?? "fail" },
        ],
        gate_verdict: {
          passed: false,
          failed_rule: catGate.failed_rule,
          detail: `${catGate.detail ?? ""}（Lab 质量闸不过 · 已 dump · 不自动重试 · 请改生成侧后手点重跑）`,
        },
        output_to_next_stage: null,
        tokens_used: judged.tokens_used,
        call_trace: judged.call_trace,
        error: catGate.failed_rule,
      };
    }
    if (acceptanceArmed) clearV3Acceptance(art, "judgment");
    return {
      input_payload: {
        key: page,
        pipeline: "v3",
        units: judged.plan.units.length,
        quality_gates: "shape_only_human",
        acceptance_retry_used: acceptanceArmed,
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
        ...(acceptanceArmed
          ? [{ action: "v3_acceptance_retry_pass", detail: "category_b_pass_on_2nd" }]
          : []),
      ],
      gate_verdict: {
        passed: true,
        detail: acceptanceArmed
          ? `units=${judged.plan.units.length} · 验收第2枪过 · 其余人审在 gate 步 · 完整调用见 Call trace`
          : `units=${judged.plan.units.length} · 已升闸类别可过 · 其余人审在 gate 步 · 完整调用见 Call trace`,
      },
      output_to_next_stage: judged.plan,
      tokens_used: judged.tokens_used,
      call_trace: judged.call_trace,
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
    const escapeArmedBody = v3EscapeArmed(art, "body");
    const acceptanceArmedBody = v3AcceptanceArmed(art, "body");
    const body = await runContentBodyGenerate({
      key: page,
      finalize,
      locale: lab.source.locale || "zh",
      session_id,
      timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      thinking_effort: "high",
      dispatch_attempt: escapeArmedBody ? 2 : 1,
      deep_evidence_plan: plan,
      action_brief: action_brief ?? null,
      chart_thesis_block: opts.chart_thesis_block,
      chart_fact_pack: preallocArt?.chart_fact_pack,
      primary_backup_hint: opts.primary_backup_hint,
      question_expectation: opts.question_expectation,
      dyad_relation_structure: opts.dyad_relation_structure,
      eastern_calc_slice: opts.eastern_calc_slice,
      reality_constraints: opts.reality_constraints,
      foundation_surface_feed: opts.foundation_surface_feed,
      science_means_feed: opts.science_means_feed,
      metaphysics_moat_feed: opts.metaphysics_moat_feed,
      risk_fuse_feed: opts.risk_fuse_feed,
      close_ritual_feed: opts.close_ritual_feed,
      structured_inventory: opts.structured_inventory,
      p3_body_excerpt,
      pivot_chart_path: lab.source.pivot_chart_path ?? null,
      partner_bazi: lab.source.partner_bazi ?? null,
    });
    if (!body.ok) {
      if (isV3LabTransportSupplyFail(body.reason) && !escapeArmedBody) {
        setV3Escape(art, "body", true);
        return v3TransportEscapeContinue({
          key: page,
          phase: "body",
          reason: body.reason,
          tokens_used: body.tokens_used,
          call_trace: body.call_trace,
          last_raw_text: body.last_raw_text,
        });
      }
      if (escapeArmedBody) setV3Escape(art, "body", false);
      if (acceptanceArmedBody) clearV3Acceptance(art, "body");
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "body",
          has_call_trace: Boolean(body.call_trace),
          provider_escape_used: escapeArmedBody,
          acceptance_retry_used: acceptanceArmedBody,
        },
        raw_model_output: body.last_raw_text
          ? { _raw_text: body.last_raw_text }
          : null,
        processing_actions: [{ action: "runContentBodyGenerate", detail: body.reason }],
        gate_verdict: {
          passed: false,
          failed_rule: body.reason,
          detail: escapeArmedBody
            ? "供应侧重试已用尽（备用供应商仍失败）。可再点运行或稍后再试。"
            : "运输/JSON 失败 — 非质量闸。",
        },
        output_to_next_stage: null,
        tokens_used: body.tokens_used,
        error: body.reason,
        call_trace: body.call_trace,
      };
    }
    if (escapeArmedBody) setV3Escape(art, "body", false);
    let bodyPage = body.page;
    if (page === "signals_close") {
      const { stampP6WatchSignals, positiveSelfCheckSeed } = await import(
        "@/lib/llm/pro/delivery/p6-watch-signals"
      );
      const core =
        (lab.source.breakthrough_core as
          | import("@/lib/poju/agent-state").BreakthroughCore
          | null
          | undefined) ?? null;
      bodyPage = stampP6WatchSignals(bodyPage, positiveSelfCheckSeed(core));
    }
    art.page_schema = bodyPage;
    // 润色只读 pre_polish：正文新稿必须盖掉旧薄草稿，否则会一直润 #1 三散文槽。
    art.page_schema_pre_polish = structuredClone(bodyPage);
    art.page_schema_by_locale = undefined;
    art.polish_skipped = undefined;
    const realityBlob = [
      opts.reality_constraints,
      opts.question_expectation,
      opts.science_means_feed,
      opts.metaphysics_moat_feed,
      opts.eastern_calc_slice,
    ]
      .filter((s) => s?.trim())
      .join("\n");
    /** 六页均有润色步：正文只硬拦事实/门槛；表面类 defer 到 polish（Skip 时回退 full）。 */
    const deferSurfaceToPolish = true;
    const bodyGate = gateBodyCategoryB({
      key: page,
      page_schema: bodyPage,
      reality_blob: realityBlob,
      surface: deferSurfaceToPolish ? "substance_only" : "full",
    });
    const surfacePreview = deferSurfaceToPolish
      ? gateBodyCategoryB({
          key: page,
          page_schema: bodyPage,
          reality_blob: realityBlob,
          surface: "full",
        })
      : null;
    const bodyFail = bodyGate && !bodyGate.passed;
    if (bodyFail) {
      // Lab: 质量闸不过硬停 dump — 禁止验收自动续跑。
      clearV3Acceptance(art, "body");
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          quality_gates: "category_b_substance",
          prompt_chars: {
            system: body.call_trace.system.length,
            user: body.call_trace.user.length,
          },
          reasoning_chars: body.call_trace.reasoning?.length ?? 0,
          meta: body.call_trace.meta,
        },
        raw_model_output: bodyPage,
        processing_actions: [
          { action: "runContentBodyGenerate", detail: "parse_only" },
          {
            action: "gateBodyCategoryB",
            detail: bodyGate.failed_rule ?? "fail",
          },
        ],
        gate_verdict: {
          passed: false,
          failed_rule: bodyGate.failed_rule,
          detail: `${bodyGate.detail ?? ""}（Lab 质量闸不过 · 已 dump · 不自动重试 · 请改生成侧后手点重跑）`,
        },
        output_to_next_stage: null,
        tokens_used: body.tokens_used,
        call_trace: body.call_trace,
        error: bodyGate.failed_rule,
      };
    }
    if (acceptanceArmedBody) clearV3Acceptance(art, "body");
    const surfaceDeferred =
      surfacePreview &&
      !surfacePreview.passed &&
      surfacePreview.failed_rule
        ? surfacePreview.failed_rule
        : null;
    return {
      input_payload: {
        key: page,
        pipeline: "v3",
        quality_gates: deferSurfaceToPolish
          ? "substance_only_surface_at_polish"
          : "shape_only_human",
        surface_deferred: surfaceDeferred,
        acceptance_retry_used: acceptanceArmedBody,
        prompt_chars: {
          system: body.call_trace.system.length,
          user: body.call_trace.user.length,
        },
        reasoning_chars: body.call_trace.reasoning?.length ?? 0,
        meta: body.call_trace.meta,
      },
      raw_model_output: bodyPage,
      processing_actions: [
        { action: "runContentBodyGenerate", detail: "parse_only" },
        {
          action: "gateBodyCategoryB",
          detail: deferSurfaceToPolish
            ? surfaceDeferred
              ? `substance_pass·surface_deferred:${surfaceDeferred}`
              : "substance_pass·surface_clean"
            : "pass",
        },
        ...(acceptanceArmedBody
          ? [{ action: "v3_acceptance_retry_pass", detail: "substance_pass_on_2nd" }]
          : []),
      ],
      gate_verdict: {
        passed: true,
        detail: deferSurfaceToPolish
          ? surfaceDeferred
            ? `正文已落库 · 事实/门槛过 · 表面类（${surfaceDeferred}）留给润色步清 · 请 gate 人审真准价值`
            : acceptanceArmedBody
              ? "正文已落库 · 验收第2枪过 · 表面已干净 · 请 gate 人审真准价值后进润色"
              : "正文已落库 · 事实/门槛过 · 表面已干净 · 请 gate 人审真准价值后进润色"
          : "正文已落库 · 已升闸类别可过 · 请到 gate 步人审 · 完整调用见 Call trace",
      },
      output_to_next_stage: bodyPage,
      tokens_used: body.tokens_used,
      call_trace: body.call_trace,
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
    const isThinP6Prose = (page: DeliveryPageData | undefined): boolean => {
      if (page !== undefined && page.page !== "signals_close") return false;
      const p = page as
        | {
            identity_before?: string;
            tonight?: string;
            next_7_days?: string;
            close?: string;
          }
        | undefined;
      if (!p) return false;
      return (
        Boolean(String(p.tonight ?? "").trim()) &&
        Boolean(String(p.next_7_days ?? "").trim()) &&
        Boolean(String(p.close ?? "").trim()) &&
        !String(p.identity_before ?? "").trim()
      );
    };
    let draft =
      (art.page_schema_pre_polish as DeliveryPageData | undefined) ??
      (art.page_schema as DeliveryPageData | undefined);
    const liveBody = art.page_schema as DeliveryPageData | undefined;
    // 从 judgment 重跑后正文已换骨架，但旧润色快照可能仍是 tonight/next_7_days/close。
    if (
      page === "signals_close" &&
      isThinP6Prose(draft) &&
      liveBody &&
      !isThinP6Prose(liveBody)
    ) {
      draft = liveBody;
      art.page_schema_pre_polish = structuredClone(liveBody);
    }
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
    if (page === "signals_close") {
      const { stampP6WatchSignals, positiveSelfCheckSeed } = await import(
        "@/lib/llm/pro/delivery/p6-watch-signals"
      );
      const core =
        (lab.source.breakthrough_core as
          | import("@/lib/poju/agent-state").BreakthroughCore
          | null
          | undefined) ?? null;
      draft = stampP6WatchSignals(draft, positiveSelfCheckSeed(core));
      art.page_schema_pre_polish = structuredClone(draft);
      const liveForWatch = art.page_schema as DeliveryPageData | undefined;
      if (liveForWatch?.page === "signals_close") {
        art.page_schema = stampP6WatchSignals(
          liveForWatch,
          positiveSelfCheckSeed(core),
        );
      }
    }
    if (!art.page_schema_pre_polish) {
      art.page_schema_pre_polish = structuredClone(draft);
    }
    const realityBlobPolish = [
      opts.reality_constraints,
      opts.question_expectation,
      opts.science_means_feed,
      opts.metaphysics_moat_feed,
      opts.eastern_calc_slice,
    ]
      .filter((s) => s?.trim())
      .join("\n");

    /** Skip：不对 LLM；对冻结正文跑 full 表面闸。 */
    if (runOpts?.skip_polish) {
      const skipGate = gateBodyCategoryB({
        key: page,
        page_schema: art.page_schema_pre_polish as DeliveryPageData,
        reality_blob: realityBlobPolish,
        surface: "full",
      });
      const skipFail = skipGate && !skipGate.passed;
      if (skipFail) {
        return {
          input_payload: {
            key: page,
            pipeline: "v3",
            phase: "body_polish",
            skip_polish: true,
            quality_gates: "full_surface_on_skip",
          },
          raw_model_output: art.page_schema_pre_polish,
          processing_actions: [
            { action: "skipBodyPolish", detail: "full_gate" },
            {
              action: "gateBodyCategoryB",
              detail: skipGate.failed_rule ?? "fail",
            },
          ],
          gate_verdict: {
            passed: false,
            failed_rule: skipGate.failed_rule,
            detail: `${skipGate.detail ?? ""}（Skip 要求正文已过 full 表面闸；否则请改 body 或跑润色清表面）`,
          },
          output_to_next_stage: null,
          error: skipGate.failed_rule,
        };
      }
      art.polish_skipped = true;
      art.page_schema = structuredClone(art.page_schema_pre_polish);
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "body_polish",
          skip_polish: true,
          quality_gates: "skipped_full_surface_pass",
        },
        raw_model_output: art.page_schema,
        processing_actions: [
          { action: "skipBodyPolish", detail: "ok" },
          { action: "gateBodyCategoryB", detail: "pass" },
        ],
        gate_verdict: {
          passed: true,
          detail:
            "已跳过润色 · 正文 full 表面闸通过 · 可解锁下一步（未做目标语言出稿）",
        },
        output_to_next_stage: art.page_schema,
      };
    }

    const rawLocale = (
      runOpts?.polish_locale ||
      art.polish_locale ||
      lab.source.locale ||
      "zh"
    )
      .toLowerCase()
      .slice(0, 2);
    const polishLocale: BodyPolishLocale = isBodyPolishLocale(rawLocale)
      ? rawLocale
      : "zh";
    art.polish_locale = polishLocale;

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
    const escapeArmedPolish = v3EscapeArmed(art, "polish");
    const acceptanceArmedPolish = v3AcceptanceArmed(art, "polish");
    const polishPrior =
      prior_gate_fail ??
      (acceptanceArmedPolish ? art.v3_acceptance_prior?.polish ?? null : null);
    const polished = await runBodyPolishGenerate({
      key: page,
      locale: polishLocale,
      draft: art.page_schema_pre_polish as DeliveryPageData,
      session_id,
      timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      dispatch_attempt: escapeArmedPolish ? 2 : 1,
      prior_gate_fail: polishPrior,
    });
    if (!polished.ok) {
      if (isV3LabTransportSupplyFail(polished.reason) && !escapeArmedPolish) {
        setV3Escape(art, "polish", true);
        return v3TransportEscapeContinue({
          key: page,
          phase: "body_polish",
          reason: polished.reason,
          tokens_used: polished.tokens_used,
          call_trace: polished.call_trace,
          last_raw_text: polished.last_raw_text,
        });
      }
      if (escapeArmedPolish) setV3Escape(art, "polish", false);
      if (acceptanceArmedPolish) clearV3Acceptance(art, "polish");
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "body_polish",
          polish_locale: polishLocale,
          has_call_trace: Boolean(polished.call_trace),
          provider_escape_used: escapeArmedPolish,
          acceptance_retry_used: acceptanceArmedPolish,
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
          detail: escapeArmedPolish
            ? "润色供应侧重试已用尽。已过闸正文未覆盖。"
            : polished.reason === "coerce_failed"
              ? "润色 JSON 形状与产品骨架不符（P6 禁 tonight/next_7_days/close 三散文槽）。已过闸正文未覆盖。"
              : "润色运输/JSON 失败 — 已过闸正文未覆盖。",
        },
        output_to_next_stage: null,
        tokens_used: polished.tokens_used,
        error: polished.reason,
        call_trace: polished.call_trace,
      };
    }
    if (escapeArmedPolish) setV3Escape(art, "polish", false);
    let polishedPage = polished.page;
    if (page === "signals_close") {
      const { stampP6WatchSignals, positiveSelfCheckSeed } = await import(
        "@/lib/llm/pro/delivery/p6-watch-signals"
      );
      const core =
        (lab.source.breakthrough_core as
          | import("@/lib/poju/agent-state").BreakthroughCore
          | null
          | undefined) ?? null;
      const draftWatch =
        (
          art.page_schema_pre_polish as
            | { watch_signals?: string[] }
            | undefined
        )?.watch_signals ?? [];
      polishedPage = stampP6WatchSignals(polishedPage, [
        ...draftWatch,
        ...positiveSelfCheckSeed(core),
      ]);
    }
    const bodyGate = gateBodyCategoryB({
      key: page,
      page_schema: polishedPage,
      reality_blob: realityBlobPolish,
      surface: "full",
    });
    const bodyFail = bodyGate && !bodyGate.passed;
    if (bodyFail) {
      // Lab: 质量闸不过硬停 dump — 禁止验收自动续跑。
      clearV3Acceptance(art, "polish");
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "body_polish",
          polish_locale: polishLocale,
          quality_gates: "category_b_after_polish",
        },
        raw_model_output: polishedPage,
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
          detail: `${bodyGate.detail ?? ""}（Lab 质量闸不过 · 已 dump · 不自动重试 · 请改生成侧后手点重跑）`,
        },
        output_to_next_stage: null,
        tokens_used: polished.tokens_used,
        call_trace: polished.call_trace,
        error: bodyGate.failed_rule,
      };
    }
    const thickGate = gateBodyPolishThickness({
      key: page,
      draft: art.page_schema_pre_polish as DeliveryPageData,
      polished: polishedPage,
    });
    if (thickGate && !thickGate.passed) {
      // Lab: 质量闸不过硬停 dump — 禁止验收自动续跑。
      clearV3Acceptance(art, "polish");
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "body_polish",
          polish_locale: polishLocale,
          quality_gates: "thickness_after_polish",
        },
        raw_model_output: polishedPage,
        processing_actions: [
          { action: "runBodyPolishGenerate", detail: "ok" },
          { action: "gateBodyCategoryB", detail: "pass" },
          {
            action: "gateBodyPolishThickness",
            detail: thickGate.failed_rule ?? "fail",
          },
        ],
        gate_verdict: {
          passed: false,
          failed_rule: thickGate.failed_rule,
          detail: [
            `${thickGate.detail ?? ""}（Lab 质量闸不过 · 已 dump · 不自动重试 · 请改生成侧后手点重跑）`,
            ...(thickGate.notes?.length
              ? [`hits:${thickGate.notes.slice(0, 4).join(" · ")}`]
              : []),
          ].join(" "),
        },
        output_to_next_stage: null,
        tokens_used: polished.tokens_used,
        call_trace: polished.call_trace,
        error: thickGate.failed_rule,
      };
    }
    if (acceptanceArmedPolish) clearV3Acceptance(art, "polish");
    art.polish_skipped = false;
    art.page_schema = polishedPage;
    art.page_schema_by_locale = {
      ...(art.page_schema_by_locale ?? {}),
      [polishLocale]: structuredClone(polishedPage),
    };
    return {
      input_payload: {
        key: page,
        pipeline: "v3",
        phase: "body_polish",
        polish_locale: polishLocale,
        quality_gates: "category_b_and_thickness_after_polish",
        acceptance_retry_used: acceptanceArmedPolish,
        prompt_chars: {
          system: polished.call_trace.system.length,
          user: polished.call_trace.user.length,
        },
        meta: polished.call_trace.meta,
      },
      raw_model_output: polishedPage,
      processing_actions: [
        { action: "runBodyPolishGenerate", detail: `polish_ok:${polishLocale}` },
        { action: "gateBodyCategoryB", detail: "pass" },
        { action: "gateBodyPolishThickness", detail: "pass" },
        ...(acceptanceArmedPolish
          ? [{ action: "v3_acceptance_retry_pass", detail: "polish_pass_on_2nd" }]
          : []),
      ],
      gate_verdict: {
        passed: true,
        detail: acceptanceArmedPolish
          ? `可见层润色完成（${polishLocale}）· 验收第2枪过 · 可人审后解锁下一步`
          : `可见层润色完成（${polishLocale}）· 表面闸+厚度闸通过 · 可人审后解锁下一步`,
      },
      output_to_next_stage: polishedPage,
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
    const softLocale = isBodyPolishLocale(runOpts?.polish_locale ?? "")
      ? (runOpts!.polish_locale as BodyPolishLocale)
      : isBodyPolishLocale(art.polish_locale ?? "")
        ? (art.polish_locale as BodyPolishLocale)
        : "zh";
    const escapeArmedSoft = v3EscapeArmed(art, "soft");
    const softChunkIdx = art.soft_chunk_index ?? 0;
    const soft = await runEvidenceSoftGenerate({
      key: page,
      plan,
      locale: softLocale,
      session_id,
      timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      soft_chunk_index: softChunkIdx,
      soft_partial: (art.soft_partial as DeliveryArgumentTree | undefined) ?? null,
    });
    if ("needs_more_soft_chunks" in soft && soft.needs_more_soft_chunks) {
      art.soft_partial = soft.soft_partial;
      art.soft_chunk_index = soft.next_chunk_index;
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "evidence_soft",
          locale: softLocale,
          soft_chunk: softChunkIdx,
          dispatch: "one_soft_chunk_per_invoke",
        },
        raw_model_output: soft.slotted,
        processing_actions: soft.notes.map((n) => ({ action: n })),
        gate_verdict: {
          passed: false,
          failed_rule: "soft_dispatch_continue",
          detail: `依据软译已分发 ${soft.next_chunk_index}/${soft.chunks_total} 块（每块≤${DELIVERY_SOFT_ARGS_PER_CALL}条·独立 ~${DELIVERY_SINGLE_CALL_TIMEOUT_MS / 1000}s）。客户端将自动续跑下一块。`,
        },
        output_to_next_stage: {
          continue: true,
          next_chunk: soft.next_chunk_index,
          chunks_total: soft.chunks_total,
        },
        tokens_used: soft.tokens_used,
        call_trace: soft.call_trace,
      };
    }
    if (!soft.ok) {
      if (isV3LabTransportSupplyFail(soft.reason) && !escapeArmedSoft) {
        setV3Escape(art, "soft", true);
        return v3TransportEscapeContinue({
          key: page,
          phase: "evidence_soft",
          reason: soft.reason,
          tokens_used: soft.tokens_used,
          call_trace: soft.call_trace,
          last_raw_text: soft.last_raw_text,
        });
      }
      if (escapeArmedSoft) setV3Escape(art, "soft", false);
      clearV3Acceptance(art, "soft");
      const supplyFail = isV3LabTransportSupplyFail(soft.reason);
      // 供应失败 ≠ 质量闸：无完整 JSON 时闸门根本没验槽缝；勿把 timeout/499 写成「质量不过」。
      const detail = supplyFail
        ? escapeArmedSoft
          ? `依据软译供应失败：${soft.reason}（主枪+供应重试均未正常完稿 · 常见：推理过长撞 ~${DELIVERY_SINGLE_CALL_TIMEOUT_MS / 1000}s 墙 → OpenRouter cancelled/499 · 无合格 JSON 可验闸）`
          : `依据软译供应失败：${soft.reason}（模型未正常 stop/完稿 · 非质量闸 · 将尝试供应侧重试）`
        : `依据软译未过：${soft.reason}（模型已完稿且 JSON 可解析，但槽/连接闸不过 · Lab 已 dump · 不自动重试 · 请改生成侧后手点重跑）`;
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "evidence_soft",
          locale: softLocale,
          fail_class: supplyFail ? "supply" : "quality",
          provider_escape_used: escapeArmedSoft,
          soft_chunk: softChunkIdx,
        },
        raw_model_output: soft.last_raw_text
          ? { _raw_text: soft.last_raw_text }
          : (soft.slotted ?? null),
        processing_actions: soft.notes.map((n) => ({ action: n })),
        gate_verdict: {
          passed: false,
          failed_rule: soft.reason,
          detail,
        },
        output_to_next_stage: null,
        error: soft.reason,
        tokens_used: soft.tokens_used,
        call_trace: soft.call_trace,
      };
    }
    if (escapeArmedSoft) setV3Escape(art, "soft", false);
    clearV3Acceptance(art, "soft");
    art.soft_partial = undefined;
    art.soft_chunk_index = undefined;
    art.evidence = soft.evidence;
    art.marked = soft.marked;
    return {
      input_payload: {
        key: page,
        pipeline: "v3",
        phase: "evidence_soft",
        locale: softLocale,
      },
      raw_model_output: soft.slotted,
      processing_actions: soft.notes.map((n) => ({ action: n })),
      gate_verdict: {
        passed: true,
        detail: `依据软译完成（${softLocale}）· 金字+白话连接 · 可人审`,
      },
      output_to_next_stage: soft.marked,
      tokens_used: soft.tokens_used,
      call_trace: soft.call_trace,
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
  runOpts?: LabV3RunOpts,
): Promise<LabV3RunResult> {
  ensureLabStepsV3(lab);
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
    const result = await executeV3(lab, def, runOpts);
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
    stripStaleAttemptCallTraces(rec.attempts);
    const dispatchContinue =
      result.gate_verdict.failed_rule === "write_dispatch_continue";
    if (result.gate_verdict.passed && !result.error) {
      rec.status = "done";
    } else if (dispatchContinue) {
      // 供应侧 escape 续跑 — 非 fail，允许客户端立刻再 invoke。
      rec.status = "done";
    } else {
      rec.status = "failed";
    }
    lab.steps[step_key] = rec;
    await saveDeliveryLab(lab);
    if (dispatchContinue) {
      return { ok: true, lab, attempt };
    }
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
  ensureLabStepsV3(lab);
  const idx = LAB_STEP_DEFS_V3.findIndex((s) => s.step_key === step_key);
  if (idx < 0) return { ok: false, reason: "unknown_step", lab };
  const def = LAB_STEP_DEFS_V3[idx]!;
  const companionSide = isCompanionSideKind(def.kind);
  /** Companion 侧轨：gate 过即可人审通过，不绑交付主链 cursor、不推进 cursor。 */
  if (!companionSide && idx !== lab.cursor_index) {
    return { ok: false, reason: "not_current_cursor", lab };
  }

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
  if (!companionSide && lab.cursor_index < LAB_STEP_DEFS_V3.length - 1) {
    lab.cursor_index += 1;
  }
  await saveDeliveryLab(lab);
  return { ok: true, lab };
}

export async function prepareLabRerunV3(
  lab: DeliveryLabSession,
  step_key: string,
  rerunOpts?: LabV3RerunOpts,
): Promise<{ ok: true; lab: DeliveryLabSession } | { ok: false; reason: string; lab: DeliveryLabSession }> {
  ensureLabStepsV3(lab);
  const idx = LAB_STEP_DEFS_V3.findIndex((s) => s.step_key === step_key);
  if (idx < 0) return { ok: false, reason: "unknown_step", lab };
  const rerunDef = LAB_STEP_DEFS_V3[idx];
  /** Companion 侧轨：P1+P3 就绪即可准备重跑，不要求 cursor。 */
  const companionSide = rerunDef ? isCompanionSideKind(rerunDef.kind) : false;
  if (!companionSide && idx > lab.cursor_index) {
    return { ok: false, reason: "step_locked", lab };
  }
  if (companionSide && !companionP1P3Ready(lab)) {
    return { ok: false, reason: "companion_needs_p1_p3_body", lab };
  }

  if (!companionSide) {
    lab.cursor_index = idx;
  }
  if (rerunDef?.kind === "companion_seal") {
    lab.artifacts.companion = undefined;
  }
  if (
    (rerunDef?.kind === "companion_daily" ||
      rerunDef?.kind === "companion_batch_pair") &&
    lab.artifacts.companion?.days
  ) {
    /**
     * 默认：保留 seal + 其它日稿（504 自动解锁走这条）。
     * 人手「准备重跑」可传 clear_companion_pair_day_index：只清空当前选中的 N/+1，
     * 其它日格不动。
     */
    const days = [...lab.artifacts.companion.days];
    const clearIdx = rerunOpts?.clear_companion_pair_day_index;
    if (
      typeof clearIdx === "number" &&
      Number.isFinite(clearIdx) &&
      clearIdx >= 0 &&
      clearIdx <= 29
    ) {
      const pair = labPairDayIndexes(Math.floor(clearIdx));
      for (const di of pair) {
        const prev = days[di];
        if (!prev) continue;
        days[di] = {
          day_index: di,
          date_key: prev.date_key,
          cards: null,
          generated_at: null,
          meta: undefined,
        };
      }
    }
    const filled = days.filter((d) => d.cards).length;
    lab.artifacts.companion = {
      ...lab.artifacts.companion,
      days,
      batch_status: filled > 0 ? "filling" : "pending",
      batch_gate: null,
    };
  }
  if (rerunDef?.kind === "companion_batch_gate" && lab.artifacts.companion) {
    lab.artifacts.companion = {
      ...lab.artifacts.companion,
      batch_status: "filling",
      batch_gate: null,
    };
  }
  if (rerunDef?.page) {
    const art = ensurePage(lab, rerunDef.page);
    art.v3_transport_escape = undefined;
    art.v3_acceptance_retry = undefined;
    art.v3_acceptance_prior = undefined;
    if (rerunDef.kind === "content_judgment") {
      art.plan = undefined;
      art.page_schema = undefined;
      art.page_schema_pre_polish = undefined;
      art.page_schema_by_locale = undefined;
      art.polish_skipped = undefined;
      art.polish_locale = undefined;
      art.evidence = undefined;
      art.marked = undefined;
      art.soft_partial = undefined;
      art.soft_chunk_index = undefined;
    }
    if (rerunDef.kind === "content_body") {
      art.page_schema = undefined;
      art.page_schema_pre_polish = undefined;
      art.page_schema_by_locale = undefined;
      art.polish_skipped = undefined;
      art.polish_locale = undefined;
    }
    if (rerunDef.kind === "body_polish") {
      if (art.page_schema_pre_polish) {
        art.page_schema = structuredClone(art.page_schema_pre_polish);
      }
      art.polish_skipped = undefined;
    }
    if (rerunDef.kind === "evidence_soft") {
      art.evidence = undefined;
      art.marked = undefined;
      art.soft_partial = undefined;
      art.soft_chunk_index = undefined;
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
