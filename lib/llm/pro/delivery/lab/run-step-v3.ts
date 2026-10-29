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
  labStepDefsV3,
  labV3StepDef,
  isBodyPolishLocale,
  ensureLabStepsV3,
  type LabV3StepDef,
  type BodyPolishLocale,
} from "@/lib/llm/pro/delivery/lab/types-v3";
import {
  BOOK_ASSEMBLE_STEP_KEY,
  isAssemblePassed,
} from "@/lib/llm/pro/delivery/lab/companion-entry-lock";
import { isBookJudgmentPackEnabled } from "@/lib/llm/pro/delivery/book-judgment/flag";
import { runBookJudgmentPackGenerate } from "@/lib/llm/pro/delivery/book-judgment/generate";
import {
  bookJudgmentTraceSummary,
  deepEvidencePlanFromBookPack,
  formatBookJudgmentPackBlock,
} from "@/lib/llm/pro/delivery/book-judgment/slice";
import {
  validateBookJudgmentPack,
  type BookJudgmentPack,
} from "@/lib/llm/pro/delivery/book-judgment/schema";
import { buildBookJudgmentQuotaFromBlueprint } from "@/lib/llm/pro/delivery/book-judgment/quota-from-blueprint";
import { runContentJudgmentGenerate } from "@/lib/llm/pro/delivery/pipeline-v3/content-judgment";
import { runContentBodyGenerate } from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import { scrubJudgmentFeedPrescriptions, stripQimenBlocksUnlessPageAllows } from "@/lib/llm/pro/delivery/pipeline-v3/scrub-judgment-feed";
import { pageFeedFlags } from "@/lib/llm/pro/delivery/pipeline-v3/page-feed-policy";
import { formatPageSliceFeed } from "@/lib/llm/pro/delivery/page-slice-feed";
import { labUsesV3Executor } from "@/lib/llm/pro/delivery/lab/pipeline-stamp";
import {
  buildLabFaceSliceFeed,
  collectAssembleFacePages,
  companionFaceBriefReady,
  evaluateTopicGate,
  topicGateUnlocks07,
} from "@/lib/llm/pro/delivery/lab/lab-face-qc";
import {
  gateFaceFormat,
  isFaceDeliveryKey,
} from "@/lib/llm/pro/delivery/pipeline-v3/gate-face-format";
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
  BODY_ACCEPTANCE_CONTINUE_RULE,
  bodySubstanceMayRetryOnce,
  buildAcceptanceCorrectiveBlock,
  POLISH_ACCEPTANCE_CONTINUE_RULE,
  polishQuotedScriptMayRetryOnce,
  polishThicknessMayRetryOnce,
  reportDeliveryAcceptanceExhausted,
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

/**
 * Collecting / reality allowlist shared by the body substance gate and the
 * phase-A recheck. Dropping it makes a grounded quantity look invented.
 */
function v3BodyRealityBlob(opts: {
  reality_constraints?: string | null;
  question_expectation?: string | null;
  science_means_feed?: string | null;
  metaphysics_moat_feed?: string | null;
  eastern_calc_slice?: string | null;
}): string {
  return [
    opts.reality_constraints,
    opts.question_expectation,
    opts.science_means_feed,
    opts.metaphysics_moat_feed,
    opts.eastern_calc_slice,
  ]
    .filter((s) => s?.trim())
    .join("\n");
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
  /** Face 03 附录：跳过可选对照句正文（切片检视已够）。 */
  skip_body?: boolean;
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
  if (companionFaceBriefReady(lab)) return true;
  /** Legacy labs: P1+P3 paper keys. */
  const p1 = lab.artifacts.by_page.direct_answer?.page_schema;
  const p3 = lab.artifacts.by_page.science_action?.page_schema;
  return Boolean(p1 && p3);
}

/** Companion entry SSOT: Assemble must pass before seal/daily/batch. */
function companionAssemblePassed(lab: DeliveryLabSession): boolean {
  const assembleIdx = labStepDefsV3().findIndex(
    (s) => s.step_key === BOOK_ASSEMBLE_STEP_KEY,
  );
  return isAssemblePassed({
    assemble_status: lab.steps[BOOK_ASSEMBLE_STEP_KEY]?.status ?? null,
    assemble_in_approved_order: lab.approved_order.includes(
      BOOK_ASSEMBLE_STEP_KEY,
    ),
    cursor_index: lab.cursor_index,
    assemble_step_index: assembleIdx >= 0 ? assembleIdx : undefined,
  });
}

function projectBookPackOntoFaces(lab: DeliveryLabSession, pack: BookJudgmentPack): void {
  for (const face of Object.keys(pack.by_face)) {
    const plan = deepEvidencePlanFromBookPack(pack, face as DeliverySegmentKey);
    if (!plan?.units.length) continue;
    const art = ensurePage(lab, face as DeliverySegmentKey);
    art.plan = plan;
  }
}

/**
 * 新包写入后：清掉旧 book.gate_judgment approved + 下游脸链，游标拨回 book.judgment，
 * 避免 cursor 停在 02.evidence_soft 时对不上当前包、闸门 not_current_cursor。
 */
function rewindLabAfterBookPackWrite(lab: DeliveryLabSession): void {
  const defs = labStepDefsV3();
  const bookIdx = defs.findIndex((s) => s.kind === "book_judgment");
  const gateIdx = defs.findIndex((s) => s.kind === "gate_book_judgment");
  if (bookIdx < 0) return;
  const from = gateIdx >= 0 ? gateIdx : bookIdx + 1;
  for (let i = from; i < defs.length; i++) {
    const key = defs[i]!.step_key;
    const rec = lab.steps[key];
    if (!rec) continue;
    rec.status = i === from ? "idle" : "stale";
    rec.approved_attempt = undefined;
    lab.steps[key] = rec;
  }
  const bookKey = defs[bookIdx]!.step_key;
  const bookRec = lab.steps[bookKey];
  if (bookRec && bookRec.status === "approved") {
    bookRec.status = "done";
    bookRec.approved_attempt = undefined;
    lab.steps[bookKey] = bookRec;
  }
  lab.approved_order = lab.approved_order.filter((k) => {
    const i = defs.findIndex((s) => s.step_key === k);
    return i >= 0 && i < bookIdx;
  });
  lab.cursor_index = bookIdx;
}

function canRunV3(lab: DeliveryLabSession, step_key: string): string | null {
  const defs = labStepDefsV3();
  const idx = defs.findIndex((s) => s.step_key === step_key);
  if (idx < 0) return "unknown_step";
  const def = defs[idx]!;
  /** Companion 侧轨：须 Assemble 通过；01+05（或旧 P1+P3）有正文才可跑；不挡交付主链 cursor。 */
  if (isCompanionSideKind(def.kind)) {
    if (!companionAssemblePassed(lab)) return "companion_needs_assemble";
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
  if (def.topic_gated && !topicGateUnlocks07(lab)) {
    return "topic_gate_07_skipped";
  }
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
    const { fingerprintThesisStructured } = await import(
      "@/lib/llm/pro/delivery/thesis/fingerprint"
    );
    const { hashChartFactPackText, hashStableJson } = await import(
      "@/lib/llm/pro/delivery/book-judgment/hash"
    );
    const structured_fp = structured
      ? fingerprintThesisStructured(structured)
      : null;
    const chart_fp = structured
      ? hashStableJson({
          day_master: structured.day_master,
          four_pillars: structured.four_pillars,
          strength: structured.strength,
          pattern: structured.pattern,
        })
      : null;
    const passed = Boolean(structured) && q.length >= 2;
    return {
      input_payload: {
        pipeline: "v3_three_step",
        question_summary: q.slice(0, 240),
        question_len: q.length,
        structured_present: Boolean(structured),
        structured_fp,
        chart_fp,
        /** peek 勿把全书包挂在本步；包属 lab-global */
        peek_scope: "bootstrap_local",
      },
      raw_model_output: {
        structured_present: Boolean(structured),
        structured_fp,
        chart_fp,
        cfp_hash_preview: structured
          ? hashChartFactPackText(
              [
                structured.day_master,
                structured.four_pillars?.year,
                structured.four_pillars?.month,
                structured.four_pillars?.day,
                structured.four_pillars?.hour,
              ]
                .filter(Boolean)
                .join("|"),
            )
          : null,
      },
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
    const { buildChartFactPack } = await import(
      "@/lib/llm/pro/delivery/page-schema/chart-fact-pack"
    );
    const { hashChartFactPackText, hashZiweiFactPack } = await import(
      "@/lib/llm/pro/delivery/book-judgment/hash"
    );
    const { ensureLabZiweiFactPack } = await import("@/lib/ziwei/lab-ziwei");
    const cfp = buildChartFactPack(structured, { as_of: new Date() });
    const ziwei = ensureLabZiweiFactPack(lab);
    const patternHits = (ziwei?.patternHits ?? []).map((h) => h.name).filter(Boolean);
    const climateAbsent = thesis.dimensions.some((d) =>
      (Array.isArray(d.classical_basis) ? d.classical_basis : []).some(
        (it) =>
          it &&
          typeof it === "object" &&
          (it as { key?: string; present?: boolean }).key === "climate_balance" &&
          (it as { present?: boolean }).present === false,
      ),
    );
    const dimsOk = thesis.dimensions.length >= 1;
    const passed = dimsOk && !climateAbsent;
    return {
      input_payload: {
        pipeline: "v3",
        dims: thesis.dimensions.length,
        structured_fp: thesis.structured_fingerprint,
        cfp_hash: hashChartFactPackText(cfp.text),
        zfp_hash: hashZiweiFactPack(ziwei),
        patternHits,
        patternHits_n: patternHits.length,
      },
      raw_model_output: thesis,
      processing_actions: [{ action: "buildChartThesisFromStructured" }],
      gate_verdict: {
        passed,
        failed_rule: climateAbsent
          ? "thesis:climate_balance_missing"
          : dimsOk
            ? undefined
            : "thesis:empty",
        detail: climateAbsent
          ? "climate_balance 显式缺项 FAIL · 需月令可算调候"
          : `dims=${thesis.dimensions.length} · 六维总纲`,
      },
      output_to_next_stage: thesis,
    };
  }

  if (def.kind === "prealloc") {
    const thesis = (lab.artifacts.thesis as ChartThesis | null | undefined) ?? null;
    const structured = tryStructuredFromBaseAnalysis(lab.source.base_analysis);
    try {
      const priorPrealloc = lab.artifacts.prealloc as
        | {
            qimen?: import("@/lib/llm/pro/delivery/page-schema/qimen-fact-pack").DeliveryQimenFactPack;
            qimen_cast_at?: string;
          }
        | null
        | undefined;
      const map = preallocateChartPrimaries({
        thesis,
        structured,
        eastern_calc_slice_by_key: { metaphysics_action: null },
        existing_qimen: priorPrealloc?.qimen ?? null,
        qimen_cast_at: priorPrealloc?.qimen_cast_at
          ? new Date(priorPrealloc.qimen_cast_at)
          : undefined,
      });
      const grounded = assertPreallocPrimariesGroundedInThesis(map, thesis);
      lab.artifacts.prealloc = map;
      const pack = map.chart_fact_pack?.trim() ?? "";
      const hasQimen = Boolean(map.qimen_cast_at && map.qimen?.text);
      const { hashChartFactPackText, hashZiweiFactPack } = await import(
        "@/lib/llm/pro/delivery/book-judgment/hash"
      );
      const { ensureLabZiweiFactPack } = await import("@/lib/ziwei/lab-ziwei");
      const ziwei = ensureLabZiweiFactPack(lab);
      const cfp_hash = hashChartFactPackText(pack);
      const zfp_hash = hashZiweiFactPack(ziwei);
      /** pack+奇门有了仍须对照蓝图缺锚（日主/四柱干支须落在闭集货架）。 */
      const missingAnchors: string[] = [];
      if (pack && structured) {
        const dm = String(structured.day_master ?? "").trim();
        if (dm && !pack.includes(dm.charAt(0))) {
          missingAnchors.push(`day_master:${dm}`);
        }
        for (const [label, g] of [
          ["year", structured.four_pillars?.year],
          ["month", structured.four_pillars?.month],
          ["day", structured.four_pillars?.day],
          ["hour", structured.four_pillars?.hour],
        ] as const) {
          const gz = String(g ?? "").trim();
          if (gz && !pack.includes(gz)) missingAnchors.push(`pillar_${label}:${gz}`);
        }
      }
      const anchorsOk = missingAnchors.length === 0;
      const gateOk =
        Boolean(pack) && hasQimen && grounded.ok && anchorsOk;
      let failed_rule: string | undefined;
      if (!gateOk) {
        if (!pack) failed_rule = "prealloc:incomplete";
        else if (!hasQimen) failed_rule = "prealloc:qimen_missing";
        else if (!grounded.ok) failed_rule = grounded.reason;
        else failed_rule = `prealloc:blueprint_missing_anchor:${missingAnchors[0]}`;
      }
      return {
        input_payload: {
          pack_chars: pack.length,
          qimen: map.qimen?.ju_name,
          qimen_reused: Boolean(priorPrealloc?.qimen),
          cfp_hash,
          zfp_hash,
          patternHits: (ziwei?.patternHits ?? []).map((h) => h.name),
          missing_blueprint_anchors: missingAnchors,
        },
        raw_model_output: map,
        processing_actions: [
          { action: "preallocateChartPrimaries" },
          ...(priorPrealloc?.qimen
            ? [{ action: "reuse_existing_qimen", detail: "same Lab 不重铸" }]
            : [{ action: "cast_qimen_lock_pan" }]),
        ],
        gate_verdict: {
          passed: gateOk,
          failed_rule,
          detail: `pack=${pack.length} qimen=${map.qimen?.ju_name ?? "?"} · cfp=${cfp_hash.slice(0, 8)} zfp=${(zfp_hash ?? "∅").toString().slice(0, 8)}`,
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

  if (def.kind === "topic_gate") {
    const gate = evaluateTopicGate(lab);
    lab.artifacts.topic_gate_07 = gate;
    return {
      input_payload: {
        question: lab.source.original_question,
        pipeline: "decision_shelf",
        phase: "07.gate_topic",
      },
      raw_model_output: gate,
      processing_actions: [{ action: "page07Applies", detail: gate.reason }],
      gate_verdict: {
        passed: true,
        detail: gate.reason,
      },
      output_to_next_stage: gate,
    };
  }

  if (def.kind === "face_slice") {
    const faceKey = def.page ?? "03";
    const sliceFeed = buildLabFaceSliceFeed(lab, faceKey);
    if (!sliceFeed) {
      return {
        input_payload: { key: faceKey },
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: { passed: false, failed_rule: "face_slice_unavailable" },
        output_to_next_stage: null,
        error: "face_slice_unavailable",
      };
    }
    const art = ensurePage(lab, faceKey as DeliverySegmentKey);
    (art as { face_slice?: unknown }).face_slice = sliceFeed.sliced;
    return {
      input_payload: {
        key: faceKey,
        pipeline: "decision_shelf",
        phase: "face_slice",
        allowlist_ok: sliceFeed.allowlist_ok,
        zfpOmitted: sliceFeed.zfpOmitted,
      },
      raw_model_output: {
        slice: sliceFeed.sliced.slice,
        segments: sliceFeed.sliced.segments,
        zfpOmitted: sliceFeed.zfpOmitted,
        allowlist_ok: sliceFeed.allowlist_ok,
      },
      processing_actions: [
        {
          action: "sliceForPage",
          detail: `face=${sliceFeed.faceId} · zfpOmitted=${sliceFeed.zfpOmitted} · allowlist=${sliceFeed.allowlist_ok ? "ok" : "FAIL"}`,
        },
      ],
      gate_verdict: {
        passed: sliceFeed.allowlist_ok,
        failed_rule: sliceFeed.allowlist_ok ? undefined : "slice_allowlist_fail",
        detail: sliceFeed.allowlist_ok
          ? `03 切片检视 ok · zfpOmitted=${sliceFeed.zfpOmitted}`
          : "切片越权键",
      },
      output_to_next_stage: {
        faceId: sliceFeed.faceId,
        zfpOmitted: sliceFeed.zfpOmitted,
        user_feed: sliceFeed.user_feed,
      },
    };
  }

  if (def.kind === "assemble") {
    const assembled = collectAssembleFacePages(lab);
    const previewLines = [
      "# Delivery Lab · Face shelf preview",
      `topic=${assembled.topic ?? "(none → no face 07)"}`,
      `order=${assembled.order.join(" → ")}`,
      "",
      ...assembled.pages.map((p) => {
        const filled = p.page_schema ? "filled" : "empty";
        return `## ${p.faceId} ${p.title} · dual=${p.dualTrack} · ${filled}`;
      }),
    ];
    const preview = previewLines.join("\n");
    lab.artifacts.assemble_preview = preview;
    lab.artifacts.assemble_faces = assembled.pages;
    return {
      input_payload: {
        pipeline: lab.pipeline ?? "decision_shelf",
        shelf_order: assembled.order,
        topic: assembled.topic,
      },
      raw_model_output: {
        shelf_order: assembled.order,
        faces: assembled.pages,
        preview_chars: preview.length,
      },
      processing_actions: [{ action: "assemble_face_slots" }],
      gate_verdict: {
        passed: true,
        detail: `Face shelf · ${assembled.order.join("→")}`,
      },
      output_to_next_stage: {
        preview,
        faces: assembled.pages,
        shelf_order: assembled.order,
      },
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
    const face01 = lab.artifacts.by_page["01" as DeliverySegmentKey]
      ?.page_schema as DeliveryPageData | undefined;
    const face05 = lab.artifacts.by_page["05" as DeliverySegmentKey]
      ?.page_schema as DeliveryPageData | undefined;
    const legacyP1 = lab.artifacts.by_page.direct_answer?.page_schema as
      | DeliveryPageData
      | undefined;
    const legacyP3 = lab.artifacts.by_page.science_action?.page_schema as
      | DeliveryPageData
      | undefined;
    const useFace = Boolean(face01 && face05);
    if (!useFace && (!legacyP1 || !legacyP3)) {
      return {
        input_payload: {
          has_01: Boolean(face01),
          has_05: Boolean(face05),
          has_p1: Boolean(legacyP1),
          has_p3: Boolean(legacyP3),
        },
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: {
          passed: false,
          failed_rule: "companion_needs_01_05_body",
          detail: "需先跑出 Face 01 + 05 正文（或旧 Lab 的 P1+P3）",
        },
        output_to_next_stage: null,
        error: "companion_needs_01_05_body",
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
        pageSchemas: useFace
          ? { "01": face01!, "05": face05! }
          : {
              decision_brief: legacyP1!,
              execution_guidance: legacyP3!,
              /** Keep alias slots for older callers that still key by six-page ids. */
              direct_answer: legacyP1!,
              science_action: legacyP3!,
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
          detail: "Brief 抽取失败：检查 Face 01 main_recommendation + 05 路径字段",
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
    const { ensureLabZiweiFactPack, ziweiCompanionTriggerAnchors } = await import(
      "@/lib/ziwei/lab-ziwei"
    );
    const ziweiTriggers = ziweiCompanionTriggerAnchors(ensureLabZiweiFactPack(lab));
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
      ...(ziweiTriggers.length
        ? { ziwei_trigger_anchors: ziweiTriggers }
        : {}),
    };
    return {
      input_payload: {
        pipeline: "v3",
        phase: "companion_seal",
        delivery_day_key: deliveryDayKey,
        timezone,
        output_locale: companionLocale,
        brief_source: useFace ? "face_01_05" : "legacy_p1_p3",
        primary_means: brief.primary.means_excerpts.length,
        backup_means: brief.backup.means_excerpts.length,
        liuri_days: liuri_pack.length,
        ziwei_trigger_anchors: ziweiTriggers,
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
        closedHints:
          (sealed as { anchor_closed_hints?: import("@/lib/companion/pregen-daily-anchors").DailyAnchorClosedHints })
            .anchor_closed_hints ?? null,
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
        closedHints:
          (sealed as { anchor_closed_hints?: import("@/lib/companion/pregen-daily-anchors").DailyAnchorClosedHints })
            .anchor_closed_hints ?? null,
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

  if (def.kind === "book_judgment") {
    if (!isBookJudgmentPackEnabled()) {
      return {
        input_payload: { flag: "BOOK_JUDGMENT_PACK=0" },
        raw_model_output: null,
        processing_actions: [{ action: "book_judgment_disabled" }],
        gate_verdict: {
          passed: false,
          failed_rule: "book_judgment_pack_disabled",
          detail: "flag off — 步表应切回 per-page judgment",
        },
        output_to_next_stage: null,
        error: "book_judgment_pack_disabled",
      };
    }
    const { opts } = await buildLabPromptOpts(lab, "02");
    const preallocArt = lab.artifacts.prealloc as
      | { chart_fact_pack?: string }
      | undefined;
    const chartText = preallocArt?.chart_fact_pack?.trim() ?? "";
    if (!chartText) {
      return {
        input_payload: {},
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: {
          passed: false,
          failed_rule: "missing_chart_fact_pack",
          detail: "先跑 prealloc",
        },
        output_to_next_stage: null,
        error: "missing_chart_fact_pack",
      };
    }
    let science_feed = "";
    try {
      const { buildScienceMeansFeedBlock } = await import(
        "@/lib/llm/pro/delivery/science-means-feed"
      );
      /** 批断包枪禁 primary_toolkit/backup_toolkit 路径；只用 forJudgment 结构轴 feed。 */
      science_feed =
        opts.science_means_judgment_feed?.trim() ||
        buildScienceMeansFeedBlock(
          (lab.source.breakthrough_core as import("@/lib/poju/agent-state").BreakthroughCore | null) ??
            null,
          null,
          { forJudgment: true },
        );
    } catch {
      science_feed = "";
    }
    science_feed = science_feed
      .split("\n")
      .filter(
        (line) =>
          !/primary_toolkit|backup_toolkit/i.test(line) &&
          !/path=primary_toolkit|path=backup_toolkit/i.test(line),
      )
      .join("\n");
    const agenda = [
      lab.source.original_question,
      ...(lab.source.covered_agenda ?? []).map(
        (a) => `${a.label}${a.answer ? `：${a.answer}` : ""}`,
      ),
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 1200);
    const generated = await runBookJudgmentPackGenerate({
      locale: lab.source.locale || "zh",
      session_id,
      timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      chart_fact_pack: chartText,
      ziwei_fact_pack: opts.ziwei_fact_pack ?? null,
      thesis_block: opts.chart_thesis_block,
      question: lab.source.original_question,
      agenda,
      science_feed,
      thesis_ref:
        typeof (lab.artifacts.thesis as { version?: string } | undefined)?.version ===
        "string"
          ? String((lab.artifacts.thesis as { version?: string }).version)
          : "thesis",
    });
    if (!generated.ok) {
      const quotaFail = buildBookJudgmentQuotaFromBlueprint();
      const zfpFail =
        (opts.ziwei_fact_pack?.patternHits ?? []).map((h) => h.name) ?? [];
      const failDetail =
        generated.detail?.trim() ||
        generated.reason ||
        "book_judgment_generate_fail";
      /** 本枪已解析草案：写入 artifacts 刷新 face_matrix，避免 sidebar 仍显示上一枪。 */
      let failTrace: ReturnType<typeof bookJudgmentTraceSummary> | null = null;
      if (generated.draft_pack) {
        lab.artifacts.book_judgment_pack = generated.draft_pack;
        failTrace = bookJudgmentTraceSummary(generated.draft_pack, {
          quota: quotaFail,
          pattern_hits_available: zfpFail,
        });
      }
      return {
        input_payload: {
          pipeline: "book_judgment_pack",
          phase: "generate",
          shot_mode: generated.shot_mode ?? "one",
          validate_ok: false,
          validate_reason: generated.reason,
          validate_detail: failDetail,
          matrix_from: generated.draft_pack ? "this_shot_fail" : "stale_prior",
          matrix_stale: !generated.draft_pack,
          ...(failTrace ?? {}),
        },
        raw_model_output: generated.draft_pack
          ? { pack: generated.draft_pack, _validate: failDetail }
          : generated.last_raw_text
            ? { _raw_text: generated.last_raw_text }
            : null,
        processing_actions: [
          {
            action: "runBookJudgmentPackGenerate",
            detail: failDetail,
          },
          ...(generated.draft_pack
            ? [
                {
                  action: "refresh_face_matrix_on_fail",
                  detail: `n=${generated.draft_pack.units.length}`,
                },
              ]
            : [{ action: "matrix_stale", detail: "无本枪草案可刷" }]),
        ],
        gate_verdict: {
          passed: false,
          failed_rule: generated.reason,
          detail: failDetail,
        },
        output_to_next_stage: null,
        tokens_used: generated.tokens_used,
        error: generated.reason,
        call_trace: generated.call_trace,
      };
    }
    lab.artifacts.book_judgment_pack = generated.pack;
    projectBookPackOntoFaces(lab, generated.pack);
    /** 新包 SoT：旧闸门/下游作废，cursor 拨回 book.judgment 以便重审闸门。 */
    rewindLabAfterBookPackWrite(lab);
    const quotaGen = buildBookJudgmentQuotaFromBlueprint();
    const zfpAvail =
      (opts.ziwei_fact_pack?.patternHits ?? []).map((h) => h.name) ?? [];
    const trace = bookJudgmentTraceSummary(generated.pack, {
      quota: quotaGen,
      pattern_hits_available: zfpAvail,
    });
    return {
      input_payload: {
        pipeline: "book_judgment_pack",
        phase: "generate",
        ...trace,
        shot_mode: generated.shot_mode,
        degraded_from_one: generated.degraded_from_one ?? false,
        degrade_reason: generated.degrade_reason,
        zfp_pattern_hits_in_pack: trace.pattern_hits_used.length > 0,
        cursor_rewound_to: "book.judgment",
        gate_invalidated: true,
      },
      raw_model_output: generated.pack,
      processing_actions: [
        {
          action: "runBookJudgmentPackGenerate",
          detail: `shot_mode=${generated.shot_mode}${generated.degraded_from_one ? `·degraded:${generated.degrade_reason}` : ""}`,
        },
        {
          action: "projectBookPackOntoFaces",
          detail: `faces=${Object.keys(trace.by_face_coverage).length}`,
        },
      ],
      gate_verdict: {
        passed: true,
        detail: `shot_mode=${trace.shot_mode} · destiny=${trace.unit_counts.destiny} science=${trace.unit_counts.science} convergence=${trace.unit_counts.convergence} · zfpOmitted=${trace.zfpOmitted} · patternHits=${trace.pattern_hits_used.length}`,
      },
      output_to_next_stage: generated.pack,
      tokens_used: generated.tokens_used,
      call_trace: generated.call_trace,
    };
  }

  if (def.kind === "gate_book_judgment") {
    const rawPack = lab.artifacts.book_judgment_pack as
      | BookJudgmentPack
      | null
      | undefined;
    if (!rawPack) {
      return {
        input_payload: { pipeline: "book_judgment_pack", phase: "gate" },
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: {
          passed: false,
          failed_rule: "missing_book_judgment_pack",
          detail: "先跑 book.judgment",
        },
        output_to_next_stage: null,
        error: "missing_book_judgment_pack",
      };
    }
    const quota = buildBookJudgmentQuotaFromBlueprint();
    /** No softRepair — 缺配额 = FAIL，正文冻结。 */
    const validated = validateBookJudgmentPack(rawPack, quota);
    if (!validated.ok) {
      const zfpGateFail =
        (lab.artifacts.ziwei_fact_pack as { patternHits?: { name: string }[] } | null)
          ?.patternHits?.map((h) => h.name) ?? [];
      const failTrace = bookJudgmentTraceSummary(rawPack, {
        quota,
        pattern_hits_available: zfpGateFail,
      });
      const failDetail =
        validated.detail?.trim() ||
        validated.reason ||
        "book_judgment_gate_fail";
      return {
        input_payload: {
          pipeline: "book_judgment_pack",
          phase: "gate",
          reason: validated.reason,
          detail: failDetail,
          body_frozen: true,
          validate_ok: false,
          matrix_from: "this_shot_fail",
          matrix_stale: false,
          ...failTrace,
        },
        raw_model_output: { pack: rawPack, trace: failTrace, _validate: failDetail },
        processing_actions: [
          { action: "validateBookJudgmentPack", detail: failDetail },
          { action: "body_frozen", detail: "pack quota FAIL" },
          {
            action: "refresh_face_matrix_on_fail",
            detail: `n=${failTrace.unit_counts.total}`,
          },
        ],
        gate_verdict: {
          passed: false,
          failed_rule: validated.reason,
          detail: `${failDetail} · 正文冻结 · 回改包枪`,
        },
        output_to_next_stage: null,
        error: validated.reason,
      };
    }
    lab.artifacts.book_judgment_pack = validated.pack;
    projectBookPackOntoFaces(lab, validated.pack);
    const zfpNames =
      (lab.artifacts.ziwei_fact_pack as { patternHits?: { name: string }[] } | null)
        ?.patternHits?.map((h) => h.name) ?? [];
    const trace = bookJudgmentTraceSummary(validated.pack, {
      quota,
      pattern_hits_available: zfpNames,
    });
    return {
      input_payload: {
        pipeline: "book_judgment_pack",
        phase: "gate",
        quality_checklist:
          "机检过即可点「本步通过」解锁正文；可选勾选双轨/删切片后垮",
        ...trace,
        zfp_pattern_hits_in_pack: trace.pattern_hits_used.length > 0,
      },
      raw_model_output: {
        pack: validated.pack,
        trace,
      },
      processing_actions: [
        { action: "validateBookJudgmentPack", detail: "quota_pass" },
        { action: "projectBookPackOntoFaces", detail: "ok" },
      ],
      gate_verdict: {
        passed: true,
        detail: `配额机检过 · units=${trace.unit_counts.total}≥${quota.total_min_units} · shot_mode=${trace.shot_mode}`,
      },
      output_to_next_stage: {
        pack: validated.pack,
        trace,
        needs_quality_checklist: false,
        auto_approve_eligible: true,
      },
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
    if (isBookJudgmentPackEnabled()) {
      return {
        input_payload: {
          key: page,
          pipeline: "book_judgment_pack",
          phase: "content_judgment_bypassed",
        },
        raw_model_output: null,
        processing_actions: [
          {
            action: "bypassPerPageJudgment",
            detail: "BOOK_JUDGMENT_PACK on — use book.judgment",
          },
        ],
        gate_verdict: {
          passed: false,
          failed_rule: "per_page_judgment_bypassed",
          detail: "批断已上移到 BookJudgmentPack；本步已旁路。设 BOOK_JUDGMENT_PACK=0 可回退。",
        },
        output_to_next_stage: null,
        error: "per_page_judgment_bypassed",
      };
    }
    const preallocArt = lab.artifacts.prealloc as
      | { chart_fact_pack?: string }
      | undefined;
    const rawFactPack = preallocArt?.chart_fact_pack?.trim() ?? "";
    const pathFeedOpts = {
      pivot_chart_path: lab.source.pivot_chart_path ?? null,
      partner_bazi: lab.source.partner_bazi ?? null,
    };
    const feed = pageFeedFlags(page, "judgment", pathFeedOpts);
    /** Face-native Lab: user_feed = sliceForPage only (QC contract). */
    if (isFaceDeliveryKey(page)) {
      const sliceFeed = buildLabFaceSliceFeed(lab, page);
      const feedParts = sliceFeed?.user_feed?.trim() || "(无切片 — 检查 prealloc chart_fact_pack)";
      const escapeArmed = v3EscapeArmed(art, "judgment");
      const acceptanceArmed = v3AcceptanceArmed(art, "judgment");
      const judged = await runContentJudgmentGenerate({
        key: page,
        locale: lab.source.locale || "zh",
        session_id,
        timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
        dispatch_attempt: escapeArmed ? 2 : 1,
        user_feed: feedParts,
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
            pipeline: "decision_shelf",
            phase: "judgment",
            face_slice: true,
            allowlist_ok: sliceFeed?.allowlist_ok ?? false,
            user_feed_chars: feedParts.length,
            has_call_trace: Boolean(judged.call_trace),
          },
          raw_model_output: judged.last_raw_text
            ? { _raw_text: judged.last_raw_text }
            : null,
          processing_actions: [
            { action: "runContentJudgmentGenerate", detail: judged.reason },
            { action: "labFaceSliceFeed", detail: sliceFeed ? "ok" : "empty" },
          ],
          gate_verdict: {
            passed: false,
            failed_rule: judged.reason,
            detail: judged.reason,
          },
          output_to_next_stage: null,
          tokens_used: judged.tokens_used,
          error: judged.reason,
          call_trace: judged.call_trace,
        };
      }
      if (escapeArmed) setV3Escape(art, "judgment", false);
      if (acceptanceArmed) clearV3Acceptance(art, "judgment");
      art.plan = judged.plan;
      art.assignment = undefined;
      return {
        input_payload: {
          key: page,
          pipeline: "decision_shelf",
          phase: "judgment",
          face_slice: true,
          allowlist_ok: sliceFeed?.allowlist_ok ?? false,
          units: judged.plan.units.length,
          user_feed_chars: feedParts.length,
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
          { action: "labFaceSliceFeed", detail: "forced_slice" },
        ],
        gate_verdict: {
          passed: true,
          detail: `face ${page} judgment · units=${judged.plan.units.length} · slice feed`,
        },
        output_to_next_stage: judged.plan,
        tokens_used: judged.tokens_used,
        call_trace: judged.call_trace,
      };
    }
    let scienceMeansJudgment = "";
    if (feed.science_means && page === "execution_guidance") {
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
      page === "execution_guidance" &&
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
    if (feed.metaphysics_moat && page === "self_regulation") {
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
    const pageSlice = formatPageSliceFeed({
      key: page,
      chartText: feed.thesis_factpack ? rawFactPack : null,
      ziwei: feed.thesis_factpack ? (opts.ziwei_fact_pack ?? null) : null,
      question: opts.question_expectation,
      withAllowlistHeader: true,
    });
    let feedParts = scrubJudgmentFeedPrescriptions(
      [
        feed.thesis_factpack ? opts.chart_thesis_block : "",
        pageSlice ?? "",
        // 批断不灌 fill 派工全文；锁盘已在 Fact-pack。正文步仍用 eastern_calc_slice。
        page === "self_regulation" && def.kind === "content_judgment"
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
        feed.structured_inventory && !pageSlice
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
          detail:
            judged.reason === "scare_redline"
              ? "恐吓红线命中。改成带条件的明确主推后重跑本步。"
              : escapeArmed
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
    if (runOpts?.skip_body && page === "03") {
      const sliceFeed = buildLabFaceSliceFeed(lab, "03");
      const pre = lab.artifacts.prealloc as
        | { chart_fact_pack?: string }
        | undefined;
      const bazi =
        (typeof (sliceFeed?.sliced.slice as { cfp?: { dayMaster?: string } } | undefined)
          ?.cfp?.dayMaster === "string"
          ? `日主 ${(sliceFeed!.sliced.slice as { cfp: { dayMaster: string } }).cfp.dayMaster}`
          : "") ||
        (pre?.chart_fact_pack?.trim().slice(0, 400) ?? "（切片检视 · 未写对照句）");
      const stub = {
        page: "03",
        face: "03",
        page_title: "命理附录",
        page_subtitle: "",
        bazi_slice: bazi,
        ziwei_slice: sliceFeed?.zfpOmitted
          ? ""
          : "（见切片 zfp；未写对照句）",
        contrast: "Lab Skip 对照句 · 以 slice 检视为准",
      };
      art.page_schema = stub as unknown as DeliveryPageData;
      art.page_schema_pre_polish = structuredClone(stub);
      return {
        input_payload: {
          key: page,
          pipeline: "decision_shelf",
          phase: "content_body",
          skip_body: true,
        },
        raw_model_output: {
          skipped: true,
          page_schema: stub,
          zfpOmitted: sliceFeed?.zfpOmitted,
        },
        processing_actions: [{ action: "skipFace03Body", detail: "slice_inspect_enough" }],
        gate_verdict: {
          passed: true,
          detail: "已 Skip 03 对照句 · 附录切片种子已落库供闸门",
        },
        output_to_next_stage: { skipped: true, page_schema: stub },
      };
    }
    const packOn = isBookJudgmentPackEnabled();
    let bookPack = packOn
      ? ((lab.artifacts.book_judgment_pack as BookJudgmentPack | null | undefined) ??
        null)
      : null;
    if (bookPack && packOn) {
      const quotaBody = buildBookJudgmentQuotaFromBlueprint();
      const packGate = validateBookJudgmentPack(bookPack, quotaBody);
      if (!packGate.ok) {
        return {
          input_payload: {
            key: page,
            pipeline: "book_judgment_pack",
            phase: "content_body",
            body_frozen: true,
            pack_fail: packGate.reason,
            pack_detail: packGate.detail,
          },
          raw_model_output: null,
          processing_actions: [
            {
              action: "body_frozen",
              detail: `${packGate.reason}:${packGate.detail ?? ""}`,
            },
          ],
          gate_verdict: {
            passed: false,
            failed_rule: "book_judgment_pack_not_ready",
            detail: `包未达标（${packGate.reason}）· 正文冻结 · 回改 book.judgment`,
          },
          output_to_next_stage: null,
          error: "book_judgment_pack_not_ready",
        };
      }
      bookPack = packGate.pack;
    }
    const packPlan =
      bookPack && isFaceDeliveryKey(page)
        ? deepEvidencePlanFromBookPack(bookPack, page)
        : null;
    const plan =
      (packPlan as DeepEvidencePlan | null) ??
      ((art.plan as DeepEvidencePlan | undefined) ?? null);
    if (packPlan) art.plan = packPlan;
    const packBlock =
      bookPack && isFaceDeliveryKey(page)
        ? formatBookJudgmentPackBlock(bookPack, page)
        : null;
    const faceBody = isFaceDeliveryKey(page);
    /** Face 03 has no judgment; other faces still prefer a plan when present. */
    if (!faceBody && !plan?.units?.length) {
      return {
        input_payload: { key: page },
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: { passed: false, failed_rule: "missing_judgment_plan" },
        output_to_next_stage: null,
        error: "missing_judgment_plan",
      };
    }
    if (faceBody && page !== "03" && !plan?.units?.length) {
      return {
        input_payload: { key: page },
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: {
          passed: false,
          failed_rule: bookPack
            ? "missing_book_judgment_slice"
            : "missing_judgment_plan",
        },
        output_to_next_stage: null,
        error: bookPack ? "missing_book_judgment_slice" : "missing_judgment_plan",
      };
    }
    const finalize = labSyntheticFinalize(lab);
    const preallocArt = lab.artifacts.prealloc as
      | { chart_fact_pack?: string }
      | undefined;
    const escapeArmedBody = v3EscapeArmed(art, "body");
    const acceptanceArmedBody = v3AcceptanceArmed(art, "body");
    const topic = lab.artifacts.topic_gate_07?.topic ?? null;
    const body = await runContentBodyGenerate({
      key: page,
      finalize,
      locale: lab.source.locale || "zh",
      session_id,
      timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      thinking_effort: "high",
      dispatch_attempt: escapeArmedBody ? 2 : 1,
      deep_evidence_plan: plan,
      book_judgment_pack_block: packBlock,
      action_brief: action_brief ?? null,
      chart_thesis_block: opts.chart_thesis_block,
      chart_fact_pack: preallocArt?.chart_fact_pack,
      /** Same ZFP as judgment face_slice — body 02-D / 03 / 04 must project patternHits. */
      ziwei_fact_pack: opts.ziwei_fact_pack ?? null,
      primary_backup_hint: faceBody ? undefined : opts.primary_backup_hint,
      question_expectation: opts.question_expectation,
      dyad_relation_structure: faceBody ? undefined : opts.dyad_relation_structure,
      eastern_calc_slice: faceBody ? undefined : opts.eastern_calc_slice,
      reality_constraints: faceBody ? undefined : opts.reality_constraints,
      foundation_surface_feed: faceBody ? undefined : opts.foundation_surface_feed,
      science_means_feed: faceBody ? undefined : opts.science_means_feed,
      metaphysics_moat_feed: faceBody ? undefined : opts.metaphysics_moat_feed,
      risk_fuse_feed: faceBody ? undefined : opts.risk_fuse_feed,
      close_ritual_feed: faceBody ? undefined : opts.close_ritual_feed,
      structured_inventory: faceBody ? undefined : opts.structured_inventory,
      p3_body_excerpt: faceBody ? undefined : p3_body_excerpt,
      topic,
      pivot_chart_path: lab.source.pivot_chart_path ?? null,
      partner_bazi: lab.source.partner_bazi ?? null,
      acceptance_corrective: v3AcceptanceCorrective(art, "body"),
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
          detail:
            body.reason === "scare_redline"
              ? "恐吓红线命中。改成带条件的明确主推后重跑本步。"
              : escapeArmedBody
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
    if (page === "validation_close") {
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
    const realityBlob = v3BodyRealityBlob(opts);
    /** 六页均有润色步：正文只硬拦事实/门槛；表面类 defer 到 polish（Skip 时回退 full）。 */
    const deferSurfaceToPolish = true;
    const bodyGate = gateBodyCategoryB({
      key: page,
      page_schema: bodyPage,
      reality_blob: realityBlob,
      surface: deferSurfaceToPolish ? "substance_only" : "full",
      partner_bazi: lab.source.partner_bazi ?? null,
      pivot_chart_path: lab.source.pivot_chart_path ?? null,
    });
    const surfacePreview = deferSurfaceToPolish
      ? gateBodyCategoryB({
          key: page,
          page_schema: bodyPage,
          reality_blob: realityBlob,
          surface: "full",
          partner_bazi: lab.source.partner_bazi ?? null,
          pivot_chart_path: lab.source.pivot_chart_path ?? null,
        })
      : null;
    const bodyFail = bodyGate && !bodyGate.passed;
    if (bodyFail) {
      const bodyDetail = bodyGate.detail ?? "";
      if (
        bodySubstanceMayRetryOnce({
          ops_user: lab.ops_user,
          acceptance_armed: acceptanceArmedBody,
          failed_rule: bodyGate.failed_rule,
        })
      ) {
        setV3AcceptanceArmed(art, "body", true);
        setV3AcceptancePrior(art, "body", {
          failed_rule: bodyGate.failed_rule,
          detail: bodyDetail,
        });
        return {
          input_payload: {
            key: page,
            pipeline: "v3",
            quality_gates: "category_b_substance",
            acceptance_retry_scheduled: true,
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
            {
              action: "v3_acceptance_retry_schedule",
              detail: "body_substance_1plus1",
            },
          ],
          gate_verdict: {
            passed: false,
            failed_rule: BODY_ACCEPTANCE_CONTINUE_RULE,
            detail: `正文事实/门槛未过（${bodyGate.failed_rule ?? "gate"}）。生产验收再跑一枪（封顶 1+1）；仍不过则硬停。${bodyDetail}`,
          },
          output_to_next_stage: {
            continue: true,
            quality_retry: true,
            next_chunk: 0,
            chunks_total: 1,
          },
          tokens_used: body.tokens_used,
          call_trace: body.call_trace,
        };
      }
      const productionExhausted =
        acceptanceArmedBody && lab.ops_user === "production";
      if (productionExhausted) {
        reportDeliveryAcceptanceExhausted({
          phase: "content_body",
          key: page,
          failed_rule: bodyGate.failed_rule,
          detail: bodyDetail,
        });
      }
      // Lab: 质量闸不过硬停 dump — 禁止验收自动续跑。
      // Production: the single substance continue already ran.
      clearV3Acceptance(art, "body");
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          quality_gates: "category_b_substance",
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
            detail: bodyGate.failed_rule ?? "fail",
          },
        ],
        gate_verdict: {
          passed: false,
          failed_rule: bodyGate.failed_rule,
          detail: `${bodyDetail}（${
            productionExhausted
              ? "生产验收 1+1 已用尽 · 改生成侧后再跑"
              : "Lab 质量闸不过 · 已 dump · 不自动重试 · 请改生成侧后手点重跑"
          }）`,
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
        pipeline: packBlock ? "book_judgment_pack" : "v3",
        phase: "content_body",
        book_judgment_slice: Boolean(packBlock),
        per_page_judgment: false,
        pack_unit_ids: packPlan?.units.map((u) => u.calc_cite ?? u.path) ?? [],
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
        ...(packBlock
          ? [
              {
                action: "sliceBookJudgmentForFace",
                detail: `serves_face=${page} · no per-page judgment`,
              },
            ]
          : []),
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
    if (isFaceDeliveryKey(page)) {
      const format = gateFaceFormat({
        key: page,
        page_schema: art.page_schema,
      });
      return {
        input_payload: {
          key: page,
          pipeline: "decision_shelf",
          phase: "gate_face_format",
          quality_checklist:
            "人审勾选见 UI（dual_track / 01→02 / 05 options / 06 done-look / slice collapse / 07 scare）",
        },
        raw_model_output: {
          format,
          page_schema: art.page_schema,
          dualTrack: undefined,
        },
        processing_actions: [
          {
            action: "gateFaceFormat",
            detail: format.passed ? "pass" : format.failed_rule,
          },
        ],
        gate_verdict: {
          passed: format.passed,
          failed_rule: format.failed_rule,
          detail: format.detail ?? format.notes.slice(0, 6).join(" · "),
        },
        output_to_next_stage: {
          frozen_page: art.page_schema,
          frozen_plan: art.plan,
          format_notes: format.notes,
          needs_quality_checklist: true,
        },
      };
    }
    const verdict = gateContentPhaseA({
      key: page,
      page_schema: art.page_schema as DeliveryPageData | undefined,
      deep_evidence_plan: art.plan as DeepEvidencePlan | undefined,
      reality_blob: v3BodyRealityBlob(opts),
      partner_bazi: lab.source.partner_bazi ?? null,
      pivot_chart_path: lab.source.pivot_chart_path ?? null,
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
      if (page !== undefined && page.page !== "validation_close") return false;
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
      page === "validation_close" &&
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
    if (page === "validation_close") {
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
      if (liveForWatch?.page === "validation_close") {
        art.page_schema = stampP6WatchSignals(
          liveForWatch,
          positiveSelfCheckSeed(core),
        );
      }
    }
    if (!art.page_schema_pre_polish) {
      art.page_schema_pre_polish = structuredClone(draft);
    }
    const realityBlobPolish = v3BodyRealityBlob(opts);

    /** Skip：不对 LLM；对冻结正文跑 full 表面闸。 */
    if (runOpts?.skip_polish) {
      const skipGate = gateBodyCategoryB({
        key: page,
        page_schema: art.page_schema_pre_polish as DeliveryPageData,
        reality_blob: realityBlobPolish,
        surface: "full",
        partner_bazi: lab.source.partner_bazi ?? null,
        pivot_chart_path: lab.source.pivot_chart_path ?? null,
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
    const polishPrior = acceptanceArmedPolish
      ? (art.v3_acceptance_prior?.polish ?? prior_gate_fail)
      : prior_gate_fail;
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
    if (page === "validation_close") {
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
      partner_bazi: lab.source.partner_bazi ?? null,
      pivot_chart_path: lab.source.pivot_chart_path ?? null,
    });
    const bodyFail = bodyGate && !bodyGate.passed;
    if (bodyFail) {
      const quoteDetail = bodyGate.detail ?? "";
      if (
        polishQuotedScriptMayRetryOnce({
          ops_user: lab.ops_user,
          acceptance_armed: acceptanceArmedPolish,
          failed_rule: bodyGate.failed_rule,
        })
      ) {
        setV3AcceptanceArmed(art, "polish", true);
        setV3AcceptancePrior(art, "polish", {
          failed_rule: bodyGate.failed_rule,
          detail: quoteDetail,
        });
        return {
          input_payload: {
            key: page,
            pipeline: "v3",
            phase: "body_polish",
            polish_locale: polishLocale,
            quality_gates: "category_b_after_polish",
            acceptance_retry_scheduled: true,
          },
          raw_model_output: polishedPage,
          processing_actions: [
            { action: "runBodyPolishGenerate", detail: "ok" },
            {
              action: "gateBodyCategoryB",
              detail: bodyGate.failed_rule ?? "fail",
            },
            {
              action: "v3_acceptance_retry_schedule",
              detail: "p4_quoted_script_1plus1",
            },
          ],
          gate_verdict: {
            passed: false,
            failed_rule: POLISH_ACCEPTANCE_CONTINUE_RULE,
            detail: `润色后仍含 P4 开口稿/引号。生产验收再跑一枪（封顶 1+1）；仍不过则硬停。已过闸正文未覆盖。${quoteDetail}`,
          },
          output_to_next_stage: {
            continue: true,
            quality_retry: true,
            next_chunk: 0,
            chunks_total: 1,
          },
          tokens_used: polished.tokens_used,
          call_trace: polished.call_trace,
        };
      }
      const quoteExhausted =
        acceptanceArmedPolish &&
        lab.ops_user === "production" &&
        bodyGate.failed_rule === "gate_p4_body_quoted_script";
      if (quoteExhausted) {
        reportDeliveryAcceptanceExhausted({
          phase: "body_polish",
          key: page,
          failed_rule: bodyGate.failed_rule,
          detail: quoteDetail,
        });
      }
      // Lab: 质量闸不过硬停 dump — 禁止验收自动续跑。
      // Production: quoted-script 1+1 already ran, or this is another category.
      clearV3Acceptance(art, "polish");
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "body_polish",
          polish_locale: polishLocale,
          quality_gates: "category_b_after_polish",
          acceptance_retry_used: acceptanceArmedPolish,
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
          detail: `${quoteDetail}（${
            quoteExhausted
              ? "生产验收 1+1 已用尽 · 不覆盖已过闸正文 · 改生成侧后再跑"
              : "Lab 质量闸不过 · 已 dump · 不自动重试 · 请改生成侧后手点重跑"
          }）`,
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
      const thickDetail = [
        `${thickGate.detail ?? ""}`,
        ...(thickGate.notes?.length
          ? [`hits:${thickGate.notes.slice(0, 4).join(" · ")}`]
          : []),
      ].join(" ");
      if (
        polishThicknessMayRetryOnce({
          ops_user: lab.ops_user,
          acceptance_armed: acceptanceArmedPolish,
          failed_rule: thickGate.failed_rule,
        })
      ) {
        setV3AcceptanceArmed(art, "polish", true);
        setV3AcceptancePrior(art, "polish", {
          failed_rule: thickGate.failed_rule,
          detail: thickDetail,
        });
        return {
          input_payload: {
            key: page,
            pipeline: "v3",
            phase: "body_polish",
            polish_locale: polishLocale,
            quality_gates: "thickness_after_polish",
            acceptance_retry_scheduled: true,
          },
          raw_model_output: polishedPage,
          processing_actions: [
            { action: "runBodyPolishGenerate", detail: "ok" },
            { action: "gateBodyCategoryB", detail: "pass" },
            {
              action: "gateBodyPolishThickness",
              detail: thickGate.failed_rule ?? "fail",
            },
            {
              action: "v3_acceptance_retry_schedule",
              detail: "polish_thickness_1plus1",
            },
          ],
          gate_verdict: {
            passed: false,
            failed_rule: POLISH_ACCEPTANCE_CONTINUE_RULE,
            detail: `润色厚度未过。生产验收再跑一枪（封顶 1+1）；仍不过则硬停。已过闸正文未覆盖。${thickDetail}`,
          },
          output_to_next_stage: {
            continue: true,
            quality_retry: true,
            next_chunk: 0,
            chunks_total: 1,
          },
          tokens_used: polished.tokens_used,
          call_trace: polished.call_trace,
        };
      }
      const productionExhausted =
        acceptanceArmedPolish && lab.ops_user === "production";
      if (productionExhausted) {
        reportDeliveryAcceptanceExhausted({
          phase: "body_polish",
          key: page,
          failed_rule: thickGate.failed_rule,
          detail: thickDetail,
        });
      }
      // Lab: 质量闸不过硬停 dump — 禁止验收自动续跑。
      // Production: the single acceptance continue already ran.
      clearV3Acceptance(art, "polish");
      return {
        input_payload: {
          key: page,
          pipeline: "v3",
          phase: "body_polish",
          polish_locale: polishLocale,
          quality_gates: "thickness_after_polish",
          acceptance_retry_used: acceptanceArmedPolish,
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
            `${thickGate.detail ?? ""}（${
              productionExhausted
                ? "生产验收 1+1 已用尽 · 不覆盖已过闸正文 · 改生成侧后再跑"
                : "Lab 质量闸不过 · 已 dump · 不自动重试 · 请改生成侧后手点重跑"
            }）`,
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
    /** Ops QC: keep more attempt bodies on decision_shelf (default was 2). */
    stripStaleAttemptCallTraces(
      rec.attempts,
      lab.pipeline === "decision_shelf" ? 8 : 2,
    );
    const dispatchContinue =
      result.gate_verdict.failed_rule === "write_dispatch_continue" ||
      result.gate_verdict.failed_rule === POLISH_ACCEPTANCE_CONTINUE_RULE ||
      result.gate_verdict.failed_rule === BODY_ACCEPTANCE_CONTINUE_RULE;
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
    /**
     * BookJudgment pack gate: machine PASS unlocks the body chain.
     * Optional human checklist remains in UI; do not block cursor on 勾选.
     */
    if (
      def.kind === "gate_book_judgment" &&
      (result.output_to_next_stage as { auto_approve_eligible?: boolean } | null)
        ?.auto_approve_eligible
    ) {
      rec.status = "approved";
      rec.approved_attempt = attempt.attempt_number;
      lab.steps[step_key] = rec;
      if (!lab.approved_order.includes(step_key)) {
        lab.approved_order.push(step_key);
      }
      const defs = labStepDefsV3();
      const idx = defs.findIndex((s) => s.step_key === step_key);
      if (idx >= 0 && idx === lab.cursor_index && idx < defs.length - 1) {
        lab.cursor_index += 1;
      }
      await saveDeliveryLab(lab);
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
  return labUsesV3Executor(lab.pipeline);
}

export async function saveLabQualityReviewV3(
  lab: DeliveryLabSession,
  step_key: string,
  review: {
    checks: Partial<Record<string, boolean>>;
    notes?: string;
  },
): Promise<{ ok: true; lab: DeliveryLabSession } | { ok: false; reason: string; lab: DeliveryLabSession }> {
  ensureLabStepsV3(lab);
  const rec = lab.steps[step_key];
  if (!rec || rec.attempts.length === 0) {
    return { ok: false, reason: "run_step_first", lab };
  }
  const last = rec.attempts[rec.attempts.length - 1]!;
  last.quality_review = {
    checks: review.checks as import("@/lib/llm/pro/delivery/lab/lab-face-qc").FaceQualityReview["checks"],
    notes: review.notes?.trim() ?? "",
    updated_at: new Date().toISOString(),
  };
  lab.steps[step_key] = rec;
  await saveDeliveryLab(lab);
  return { ok: true, lab };
}

export async function approveLabStepV3(
  lab: DeliveryLabSession,
  step_key: string,
  opts?: {
    quality_review?: {
      checks: Partial<Record<string, boolean>>;
      notes?: string;
    };
  },
): Promise<{ ok: true; lab: DeliveryLabSession } | { ok: false; reason: string; lab: DeliveryLabSession }> {
  ensureLabStepsV3(lab);
  const defs = labStepDefsV3();
  const idx = defs.findIndex((s) => s.step_key === step_key);
  if (idx < 0) return { ok: false, reason: "unknown_step", lab };
  const def = defs[idx]!;
  const companionSide = isCompanionSideKind(def.kind);
  /**
   * Companion 侧轨：不绑 cursor。
   * 包枪/包闸：允许在 cursor 已往下游（如 02.evidence_soft）时回审；
   * 回审时把 cursor 拨回本步并 stale 下游，避免旧闸门对不上新包。
   */
  const packStepFree =
    def.kind === "book_judgment" || def.kind === "gate_book_judgment";
  if (!companionSide && idx !== lab.cursor_index) {
    if (!(packStepFree && idx <= lab.cursor_index)) {
      return { ok: false, reason: "not_current_cursor", lab };
    }
    for (let i = idx + 1; i < defs.length; i++) {
      const key = defs[i]!.step_key;
      const downstream = lab.steps[key];
      if (!downstream) continue;
      if (
        downstream.status === "approved" ||
        downstream.status === "done" ||
        downstream.status === "running" ||
        downstream.status === "failed"
      ) {
        downstream.status = "stale";
        downstream.approved_attempt = undefined;
        lab.steps[key] = downstream;
      }
    }
    lab.approved_order = lab.approved_order.filter((k) => {
      const i = defs.findIndex((s) => s.step_key === k);
      return i >= 0 && i <= idx;
    });
    lab.cursor_index = idx;
  }

  const rec = lab.steps[step_key];
  if (!rec || rec.attempts.length === 0) {
    return { ok: false, reason: "run_step_first", lab };
  }
  const last = rec.attempts[rec.attempts.length - 1]!;
  if (!last.gate_verdict.passed || last.error) {
    return { ok: false, reason: "gate_not_passed", lab };
  }
  if (opts?.quality_review) {
    last.quality_review = {
      checks: opts.quality_review.checks as import("@/lib/llm/pro/delivery/lab/lab-face-qc").FaceQualityReview["checks"],
      notes: opts.quality_review.notes?.trim() ?? "",
      updated_at: new Date().toISOString(),
    };
  }
  rec.status = "approved";
  rec.approved_attempt = last.attempt_number;
  lab.steps[step_key] = rec;
  if (!lab.approved_order.includes(step_key)) lab.approved_order.push(step_key);

  /** 07 topic miss: auto-skip topic_gated 07 chain → land on next non-gated step (03.slice). */
  if (
    !companionSide &&
    def.kind === "topic_gate" &&
    !(last.output_to_next_stage as { applies?: boolean } | null)?.applies
  ) {
    let next = idx + 1;
    while (next < defs.length && defs[next]?.topic_gated) {
      const skipKey = defs[next]!.step_key;
      const skipRec = lab.steps[skipKey] ?? {
        step_key: skipKey,
        status: "idle" as const,
        attempts: [] as LabAttempt[],
      };
      skipRec.status = "approved";
      skipRec.approved_attempt = 0;
      lab.steps[skipKey] = skipRec;
      if (!lab.approved_order.includes(skipKey)) lab.approved_order.push(skipKey);
      next += 1;
    }
    lab.cursor_index = Math.min(next, defs.length - 1);
    await saveDeliveryLab(lab);
    return { ok: true, lab };
  }

  if (!companionSide && lab.cursor_index < defs.length - 1) {
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
  const defs = labStepDefsV3();
  const idx = defs.findIndex((s) => s.step_key === step_key);
  if (idx < 0) return { ok: false, reason: "unknown_step", lab };
  const rerunDef = defs[idx];
  /** Companion 侧轨：P1+P3 就绪即可准备重跑，不要求 cursor。 */
  const companionSide = rerunDef ? isCompanionSideKind(rerunDef.kind) : false;
  if (!companionSide && idx > lab.cursor_index) {
    return { ok: false, reason: "step_locked", lab };
  }
  if (companionSide && !companionAssemblePassed(lab)) {
    return { ok: false, reason: "companion_needs_assemble", lab };
  }
  if (companionSide && !companionP1P3Ready(lab)) {
    return { ok: false, reason: "companion_needs_p1_p3_body", lab };
  }

  if (!companionSide) {
    lab.cursor_index = idx;
  }
  if (rerunDef?.kind === "book_judgment") {
    /** 重跑包枪：清包 + 脏脸链。 */
    lab.artifacts.book_judgment_pack = null;
    for (const art of Object.values(lab.artifacts.by_page)) {
      if (!art) continue;
      art.plan = undefined;
      art.page_schema = undefined;
      art.page_schema_pre_polish = undefined;
      art.page_schema_by_locale = undefined;
      art.polish_skipped = undefined;
      art.polish_locale = undefined;
      art.evidence = undefined;
      art.marked = undefined;
    }
  }
  if (rerunDef?.kind === "gate_book_judgment") {
    /**
     * 重跑包闸：保留当前包，只脏脸链计划/正文，便于对 #N 包重审闸门。
     * （勿 null pack — 否则对不上刚 PASS 的包枪。）
     */
    for (const art of Object.values(lab.artifacts.by_page)) {
      if (!art) continue;
      art.plan = undefined;
      art.page_schema = undefined;
      art.page_schema_pre_polish = undefined;
      art.page_schema_by_locale = undefined;
      art.polish_skipped = undefined;
      art.polish_locale = undefined;
      art.evidence = undefined;
      art.marked = undefined;
    }
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
  for (let i = idx; i < defs.length; i++) {
    const key = defs[i]!.step_key;
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
    const i = defs.findIndex((s) => s.step_key === k);
    return i >= 0 && i < idx;
  });
  await saveDeliveryLab(lab);
  return { ok: true, lab };
}
