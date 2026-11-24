/**
 * Pipeline v3 · Step1-B body — generate only.
 * Quality lives in prompt/feed; no sanitize / soft-strip / legacy fill gates.
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliveryComputed, DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  DELIVERY_SINGLE_CALL_TIMEOUT_MS,
  PAGE_SCHEMA_FILL_MAX_TOKENS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import { deliveryLabTransportMaxAttempts } from "@/lib/llm/pro/delivery/lab/provider-call-budget";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import type { DeliveryPageData, P5ActionBrief } from "@/lib/llm/pro/delivery/page-schema/types";
import {
  buildV3BodyPrompt,
  formatJudgmentLockForBody,
} from "@/lib/llm/pro/delivery/pipeline-v3/body-prompt";
import {
  buildLabCallTrace,
  type LabCallTrace,
} from "@/lib/llm/pro/delivery/lab/call-trace";
import { scrubJudgmentFeedPrescriptions, scrubP4BodyFeedPriming, stripQimenBlocksUnlessPageAllows } from "@/lib/llm/pro/delivery/pipeline-v3/scrub-judgment-feed";
import { pageFeedFlags } from "@/lib/llm/pro/delivery/pipeline-v3/page-feed-policy";
import { formatPageSliceFeed } from "@/lib/llm/pro/delivery/page-slice-feed";
import { scareRedlineSnippet } from "@/lib/llm/compliance/audit-output";
import { isFaceDeliveryKey } from "@/lib/llm/pro/delivery/pipeline-v3/gate-face-format";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import {
  buildFace01ProductionContext,
  buildFace01RepairUserMessage,
  face01SliceSummary,
  parseFace01JsonStrict,
  validateFace01ProductionOutput,
  type Face01ProductionContext,
} from "@/lib/llm/pro/delivery/decision-report-v2/page01/production";
import {
  buildFace02ProductionContext,
  buildFace02RepairUserMessage,
  face02SliceSummary,
  parseFace02JsonStrict,
  validateFace02ProductionOutput,
  type Face02ProductionContext,
} from "@/lib/llm/pro/delivery/decision-report-v2/page02/production";
import {
  buildFace04ProductionContext,
  buildFace04RepairUserMessage,
  face04SliceSummary,
  parseFace04JsonStrict,
  validateFace04ProductionOutput,
  type Face04ProductionContext,
} from "@/lib/llm/pro/delivery/decision-report-v2/page04/production";
import {
  buildFace05ProductionContext,
  buildFace05RepairUserMessage,
  face05SliceSummary,
  parseFace05JsonStrict,
  validateFace05ProductionOutput,
  type Face05ProductionContext,
} from "@/lib/llm/pro/delivery/decision-report-v2/page05/production";
import {
  buildFace06ProductionContext,
  buildFace06RepairUserMessage,
  face06SliceSummary,
  parseFace06JsonStrict,
  validateFace06ProductionOutput,
  type Face06ProductionContext,
} from "@/lib/llm/pro/delivery/decision-report-v2/page06/production";
import {
  buildFace07ProductionContext,
  buildFace07RepairUserMessage,
  face07SliceSummary,
  parseFace07JsonStrict,
  synthesizeFace07StatusPage,
  validateFace07ProductionOutput,
  type Face07ProductionContext,
} from "@/lib/llm/pro/delivery/decision-report-v2/page07/production";
import type {
  Face01V2,
  Face02V2,
  Face04V2,
  Face05V2,
  Face06V2,
  Face07V2,
} from "@/lib/llm/pro/delivery/decision-report-v2/schemas";
import type { CallLLMResult } from "@/lib/llm/router";

/**
 * Test-only LLM invoke override for runContentBodyGenerate.
 * When set, skips OpenRouter and returns the stubbed CallLLMResult.
 */
export type ContentBodyTestInvoke = (
  system: string,
  user: string,
) => Promise<CallLLMResult>;

let contentBodyTestInvoke: ContentBodyTestInvoke | null = null;

/** Register / clear stub for production-path tests (never use in production). */
export function setContentBodyTestInvokeForTests(
  fn: ContentBodyTestInvoke | null,
): void {
  contentBodyTestInvoke = fn;
}

export type ContentBodyOk = {
  ok: true;
  page: DeliveryPageData;
  tokens_used: number;
  last_raw_text?: string;
  call_trace: LabCallTrace;
  /** Face01 V2 production metadata (absent for other faces). */
  face01_meta?: {
    prompt_version: string;
    schema_version: string;
    slice_summary: Record<string, unknown>;
    validation: "passed" | "passed_after_repair";
    cited_term_ids?: string[];
  };
  /** Face02 V2 production metadata. */
  face02_meta?: {
    prompt_version: string;
    schema_version: string;
    slice_summary: Record<string, unknown>;
    validation: "passed" | "passed_after_repair";
    cited_term_ids?: string[];
    realized_evidence_ids?: string[];
  };
  face04_meta?: {
    prompt_version: string;
    schema_version: string;
    slice_summary: Record<string, unknown>;
    validation: "passed" | "passed_after_repair";
  };
  face05_meta?: {
    prompt_version: string;
    schema_version: string;
    slice_summary: Record<string, unknown>;
    validation: "passed" | "passed_after_repair";
  };
  face06_meta?: {
    prompt_version: string;
    schema_version: string;
    slice_summary: Record<string, unknown>;
    validation: "passed" | "passed_after_repair";
  };
  face07_meta?: {
    prompt_version: string;
    schema_version: string;
    slice_summary: Record<string, unknown>;
    validation: "passed" | "passed_after_repair" | "skipped_not_applicable";
  };
};

export type ContentBodyFail = {
  ok: false;
  reason: string;
  tokens_used: number;
  last_raw_text?: string;
  call_trace?: LabCallTrace;
  face01_meta?: {
    prompt_version?: string;
    slice_summary?: Record<string, unknown>;
    validation_issues?: unknown[];
  };
  face02_meta?: {
    prompt_version?: string;
    slice_summary?: Record<string, unknown>;
    validation_issues?: unknown[];
  };
  face04_meta?: {
    prompt_version?: string;
    slice_summary?: Record<string, unknown>;
    validation_issues?: unknown[];
  };
  face05_meta?: {
    prompt_version?: string;
    slice_summary?: Record<string, unknown>;
    validation_issues?: unknown[];
  };
  face06_meta?: {
    prompt_version?: string;
    slice_summary?: Record<string, unknown>;
    validation_issues?: unknown[];
  };
  face07_meta?: {
    prompt_version?: string;
    slice_summary?: Record<string, unknown>;
    validation_issues?: unknown[];
    structured_status?: unknown;
  };
};

type DimLevel = "high" | "mid" | "low" | "unknown";

function asDim(v: unknown): DimLevel {
  return v === "high" || v === "mid" || v === "low" || v === "unknown"
    ? v
    : "unknown";
}

function coerceTrack(
  raw: unknown,
  role: "primary" | "backup",
): {
  role: "primary" | "backup";
  name: string;
  core_logic: string;
  why: string;
  when: string;
  chart_anchors: string[];
  strategic_goal?: string;
  leverage_chip?: string;
  dims: { body: DimLevel; mind: DimLevel; field: DimLevel };
} | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? "").trim();
  const core_logic = String(o.core_logic ?? o.body ?? "").trim();
  const why = String(o.why ?? "").trim();
  const when = String(o.when ?? "").trim();
  if (!name || !core_logic) return null;
  const dimsRaw =
    o.dims && typeof o.dims === "object" && !Array.isArray(o.dims)
      ? (o.dims as Record<string, unknown>)
      : {};
  return {
    role: o.role === "backup" || o.role === "primary" ? o.role : role,
    name,
    core_logic,
    why: why || (role === "primary" ? "本案结构下的首选节奏" : "主路受阻时的备选节奏"),
    when: when || (role === "primary" ? "当前可推进时" : "主路难落地时"),
    chart_anchors: Array.isArray(o.chart_anchors)
      ? o.chart_anchors.map((a) => String(a)).filter(Boolean)
      : [],
    strategic_goal: String(o.strategic_goal ?? "").trim() || undefined,
    leverage_chip: String(o.leverage_chip ?? "").trim() || undefined,
    dims: {
      body: asDim(dimsRaw.body),
      mind: asDim(dimsRaw.mind),
      field: asDim(dimsRaw.field),
    },
  };
}

function coerceFaceLoose(
  key: string,
  root: Record<string, unknown>,
  page_title: string,
  page_subtitle: string,
): DeliveryPageData | null {
  const faceKeys = new Set(["01", "02", "03", "04", "05", "06", "07", "08"]);
  if (!faceKeys.has(key)) return null;
  const str = (v: unknown) => String(v ?? "").trim();
  const strList = (v: unknown) =>
    Array.isArray(v)
      ? v.map((x) => str(x)).filter(Boolean)
      : str(v)
        ? [str(v)]
        : [];
  const base = {
    page: key,
    face: key,
    page_title,
    page_subtitle,
  };
  switch (key) {
    case "01": {
      // Face01 v2 structured shape (Batch 0). Legacy four-field rejected for new books.
      const core = root.core_judgment;
      if (!core || typeof core !== "object") return null;
      const coreObj = core as Record<string, unknown>;
      const coreText = str(coreObj.text);
      const claimIds = strList(coreObj.claim_ids);
      const why = Array.isArray(root.why_this_path) ? root.why_this_path : [];
      const conds = Array.isArray(root.recommendation_conditions)
        ? root.recommendation_conditions
        : [];
      const notRec = Array.isArray(root.not_recommended) ? root.not_recommended : [];
      const boundary = root.applicability_boundary;
      if (
        !coreText ||
        !claimIds.length ||
        !why.length ||
        conds.length < 2 ||
        !notRec.length ||
        !boundary ||
        typeof boundary !== "object"
      ) {
        return null;
      }
      return {
        ...base,
        page: "01",
        face: "01",
        schema_version: "face01-v2",
        core_judgment: { text: coreText, claim_ids: claimIds },
        why_this_path: why,
        recommendation_conditions: conds,
        not_recommended: notRec,
        applicability_boundary: boundary,
      } as DeliveryPageData;
    }
    case "02": {
      // Face02 v2 content_units authority. Free-text page_summary rejected for new books.
      const units = root.content_units;
      const summaryIds = root.page_summary_unit_ids;
      const whyIds = root.why_judgment_fits_unit_ids;
      const boundary = root.explanation_boundary;
      if (
        !Array.isArray(units) ||
        units.length < 1 ||
        !Array.isArray(summaryIds) ||
        summaryIds.length < 1 ||
        !Array.isArray(whyIds) ||
        whyIds.length < 1 ||
        !boundary ||
        typeof boundary !== "object"
      ) {
        return null;
      }
      return {
        ...base,
        page: "02",
        face: "02",
        schema_version: "face02-v2",
        content_units: units,
        page_summary_unit_ids: summaryIds,
        relevant_personal_factor_unit_ids: Array.isArray(
          root.relevant_personal_factor_unit_ids,
        )
          ? root.relevant_personal_factor_unit_ids
          : [],
        personal_reality_interplay_unit_ids: Array.isArray(
          root.personal_reality_interplay_unit_ids,
        )
          ? root.personal_reality_interplay_unit_ids
          : [],
        why_judgment_fits_unit_ids: whyIds,
        page01_judgment_ref: str(root.page01_judgment_ref),
        explanation_boundary: boundary,
        reading_order: Array.isArray(root.reading_order)
          ? root.reading_order
          : [
              "page_summary",
              "relevant_personal_factors",
              "personal_reality_interplay",
              "why_judgment_fits",
              "explanation_boundary",
            ],
      } as unknown as DeliveryPageData;
    }
    case "04": {
      const bottleneck_name = str(root.bottleneck_name);
      const manifestation = str(root.manifestation);
      const evidence_fold = str(root.evidence_fold);
      if (!bottleneck_name || !manifestation || !evidence_fold) return null;
      return {
        ...base,
        page: "04",
        face: "04",
        bottleneck_name,
        manifestation,
        if_force_through: str(root.if_force_through),
        evidence_fold,
      } as DeliveryPageData;
    }
    case "05": {
      const first_choice = str(root.first_choice);
      const second_choice = str(root.second_choice);
      const caution_choice = str(root.caution_choice);
      const switch_or_stop = str(root.switch_or_stop);
      if (!first_choice || !second_choice || !caution_choice || !switch_or_stop) {
        return null;
      }
      return {
        ...base,
        page: "05",
        face: "05",
        first_choice,
        second_choice,
        caution_choice,
        switch_or_stop,
        contrast: str(root.contrast),
      } as DeliveryPageData;
    }
    case "06": {
      const near_step_principle = str(root.near_step_principle);
      const stage_climate = str(root.stage_climate);
      const self_retune = str(root.self_retune);
      const rhythm_note = str(root.rhythm_note);
      if (!near_step_principle || !stage_climate || !self_retune || !rhythm_note) {
        return null;
      }
      return {
        ...base,
        page: "06",
        face: "06",
        near_step_principle,
        stage_climate,
        self_retune,
        rhythm_note,
      } as DeliveryPageData;
    }
    case "07": {
      const field_judgment = str(root.field_judgment);
      const relation_interaction = str(root.relation_interaction);
      const evidence_fold = str(root.evidence_fold);
      if (!field_judgment || !relation_interaction || !evidence_fold) return null;
      return {
        ...base,
        page: "07",
        face: "07",
        field_judgment,
        relation_interaction,
        evidence_fold,
        align_with_01_05: str(root.align_with_01_05),
      } as DeliveryPageData;
    }
    case "08": {
      const red_lights = strList(root.red_lights);
      const review_questions = strList(root.review_questions);
      const when_to_rerun = str(root.when_to_rerun);
      if (!red_lights.length || !review_questions.length || !when_to_rerun) return null;
      return {
        ...base,
        page: "08",
        face: "08",
        red_lights,
        review_questions,
        when_to_rerun,
      } as DeliveryPageData;
    }
    case "03": {
      // Glossary appendix (Batch 0). Chart dump (bazi_slice) is no longer a valid new-book shape.
      if (str(root.kind) !== "glossary_appendix") return null;
      const reading_note = str(root.reading_note);
      const term_ids = strList(root.term_ids);
      if (!reading_note) return null;
      return {
        ...base,
        page: "03",
        face: "03",
        kind: "glossary_appendix",
        reading_note,
        term_ids,
      } as DeliveryPageData;
    }
    default:
      return null;
  }
}

/** Minimal coerce so Lab/UI can preview — never quality-rewrite. */
export function coercePageSchemaLoose(
  key: DeliverySegmentKey,
  raw: unknown,
): DeliveryPageData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  let root = raw as Record<string, unknown>;
  if (key in root && !("page" in root)) {
    const inner = root[key];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      root = inner as Record<string, unknown>;
    }
  }
  const page_title = String(root.page_title ?? "").trim();
  const page_subtitle = String(root.page_subtitle ?? "").trim();

  const faceCoerced = coerceFaceLoose(key, root, page_title, page_subtitle);
  if (faceCoerced) return faceCoerced;

  if (key === "decision_brief") {
    const primary = coerceTrack(root.primary, "primary");
    const backup = coerceTrack(root.backup, "backup");
    const core_judgment = String(
      root.core_judgment ?? root.core ?? "",
    ).trim();
    // Wrong shape (dimensions prose) → fail coerce so Lab sees transport-level miss.
    if (!primary || !backup || !core_judgment) return null;
    return {
      page: "decision_brief",
      page_title,
      page_subtitle,
      core_judgment,
      primary,
      backup,
      evidence: [],
    } as unknown as DeliveryPageData;
  }

  if (key === "situation_analysis") {
    const cardsRaw = Array.isArray(root.why_cards)
      ? root.why_cards
      : Array.isArray(root.dimensions)
        ? root.dimensions
        : [];
    const why_cards = cardsRaw
      .map((c) => {
        if (!c || typeof c !== "object") return null;
        const row = c as Record<string, unknown>;
        const title = String(row.title ?? row.name ?? "").trim();
        const surface = String(row.surface ?? "").trim();
        const essence = String(row.essence ?? row.body ?? "").trim();
        if (!title || !essence) return null;
        return {
          title,
          surface: surface || essence.slice(0, 120),
          essence,
          chart_anchors: Array.isArray(row.chart_anchors)
            ? row.chart_anchors.map((a) => String(a)).filter(Boolean)
            : [],
        };
      })
      .filter(Boolean);
    if (why_cards.length < 1) return null;
    return {
      page: "situation_analysis",
      page_title,
      page_subtitle,
      why_cards,
      evidence: [],
    } as unknown as DeliveryPageData;
  }

  if (key === "validation_close") {
    const identity_before = String(
      root.identity_before ?? root.before ?? "",
    ).trim();
    const identity_after = String(root.identity_after ?? root.after ?? "").trim();
    const identity_shift = String(
      root.identity_shift ?? root.shift_reason ?? root.why_shift ?? "",
    ).trim();
    const quote = String(root.quote ?? root.verse ?? root.gold ?? "").trim();
    const quote_use = String(
      root.quote_use ?? root.quote_how ?? root.when_wobble ?? "",
    ).trim();
    const immediate_action = String(
      root.immediate_action ?? root.tonight ?? root.one_thing ?? "",
    ).trim();
    const tonight_done_looks_like = String(
      root.tonight_done_looks_like ?? root.done_looks_like ?? root.tonight_done ?? "",
    ).trim();
    const tonight_why = String(
      root.tonight_why ?? root.why_tonight ?? "",
    ).trim();
    const day7Raw = Array.isArray(root.day7_micro_actions)
      ? root.day7_micro_actions
      : Array.isArray(root.day7_checklist)
        ? root.day7_checklist
        : Array.isArray(root.near_term)
          ? root.near_term
          : Array.isArray(root.micro_actions)
            ? root.micro_actions
            : [];
    const day7_micro_actions = day7Raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const action = String(row.action ?? "").trim();
        const why = String(row.why ?? "").trim();
        const done_when = String(row.done_when ?? row.done ?? "").trim();
        if (!action || !why || !done_when) return null;
        return {
          action,
          why,
          done_when,
          chart_anchors: Array.isArray(row.chart_anchors)
            ? row.chart_anchors.map((a) => String(a)).filter(Boolean)
            : [],
        };
      })
      .filter(Boolean);
    const takeawaysRaw = Array.isArray(root.takeaways)
      ? root.takeaways
      : Array.isArray(root.carry_seal)
        ? root.carry_seal
        : Array.isArray(root.seal)
          ? root.seal
          : [];
    const takeaways = takeawaysRaw
      .map((t) => String(t ?? "").trim())
      .filter(Boolean)
      .slice(0, 3);
    const watchRaw = Array.isArray(root.watch_signals)
      ? root.watch_signals
      : Array.isArray(root.self_check_signals)
        ? root.self_check_signals
        : Array.isArray(root.positive_signals)
          ? root.positive_signals
          : [];
    const watch_signals = watchRaw
      .map((t) => String(t ?? "").trim())
      .filter(Boolean)
      .slice(0, 5);
    // Thin three-prose shape (tonight/next_7_days/close) = transport miss for product P6.
    // watch_signals 可在落库后由正向自检种子盖回；此处不因缺信号拒收整页。
    if (
      !identity_before ||
      !identity_after ||
      !identity_shift ||
      !quote ||
      !quote_use ||
      !immediate_action ||
      !tonight_done_looks_like ||
      !tonight_why ||
      day7_micro_actions.length < 4 ||
      takeaways.length < 3
    ) {
      return null;
    }
    return {
      page: "validation_close",
      page_title,
      page_subtitle,
      identity_before,
      identity_after,
      identity_shift,
      identity_shift_anchors: Array.isArray(root.identity_shift_anchors)
        ? root.identity_shift_anchors.map((a) => String(a)).filter(Boolean)
        : [],
      quote,
      quote_use,
      immediate_action,
      tonight_done_looks_like,
      tonight_why,
      tonight_anchors: Array.isArray(root.tonight_anchors)
        ? root.tonight_anchors.map((a) => String(a)).filter(Boolean)
        : [],
      day7_micro_actions,
      watch_signals,
      takeaways: [takeaways[0]!, takeaways[1]!, takeaways[2]!],
      evidence: Array.isArray(root.evidence) ? root.evidence : [],
    } as unknown as DeliveryPageData;
  }

  const pageField = String(root.page ?? key);
  const dimensions = Array.isArray(root.dimensions)
    ? root.dimensions
    : Array.isArray(root.angles)
      ? root.angles
      : Array.isArray(root.why_cards)
        ? root.why_cards
        : [];
  return {
    ...root,
    page: pageField,
    page_title,
    page_subtitle,
    dimensions,
  } as DeliveryPageData;
}

export async function runContentBodyGenerate(input: {
  key: DeliverySegmentKey;
  finalize: DeliveryComputed;
  locale: string;
  session_id?: string;
  signal?: AbortSignal;
  timeout_ms?: number;
  thinking_effort?: "off" | "low" | "medium" | "high" | "xhigh";
  deep_evidence_plan?: DeepEvidencePlan | null;
  /** BookJudgmentPack face slice block (禁再发明批断). */
  book_judgment_pack_block?: string | null;
  action_brief?: P5ActionBrief | null;
  primary_backup_hint?: string;
  question_expectation?: string;
  /** Stage-1 dyad relation structure (optional; gated by pageFeedFlags). */
  dyad_relation_structure?: string;
  eastern_calc_slice?: string;
  reality_constraints?: string;
  foundation_surface_feed?: string;
  science_means_feed?: string;
  metaphysics_moat_feed?: string;
  risk_fuse_feed?: string;
  close_ritual_feed?: string;
  structured_inventory?: string;
  p3_body_excerpt?: string;
  /** Thesis / fact-pack — required grounding for P1 dual-track (UI hides 依据). */
  chart_thesis_block?: string;
  chart_fact_pack?: string;
  /** Optional. Omitted from the page slice when absent. */
  ziwei_fact_pack?: ZiweiFactPack | null;
  topic?: string | null;
  /** ≥2 after Lab transport stall → provider escape. */
  dispatch_attempt?: number;
  /** Attempt-2 acceptance corrective (category rule/detail). */
  acceptance_corrective?: string | null;
  pivot_chart_path?: import("@/lib/poju/pivot-chart-path").PivotChartPath | null;
  partner_bazi?: "absent" | "present" | null;
  /** Product Stage 4 — preformatted frozen DC feed (faces 01/02/04/05/06/08). */
  decision_context_feed?: string | null;
  /** Face 01/02 V2 — frozen DC snapshot (required for production paths). */
  decision_context_snapshot?: DecisionContext | null;
  /** Face 01/02 V2 — book judgment pack for registry seeding. */
  book_judgment_pack?: BookJudgmentPack | null;
  /** Stable report/job id for Face01/02 slice. */
  report_id?: string | null;
  /** Optional Page01 schema — alignment context for Face02/Face04/Face05. */
  page01_schema?: unknown;
  /** Optional Page02 schema — foundation grounding for Face04/Face05. */
  page02_schema?: unknown;
  /** Optional Page04 schema — bottleneck grounding for Face05/Face06. */
  page04_schema?: unknown;
  /** Optional Page05 schema — path binding for Face06 / Face07. */
  page05_schema?: unknown;
  /** Optional Page06 schema — execution binding for Face07. */
  page06_schema?: unknown;
}): Promise<ContentBodyOk | ContentBodyFail> {
  const seg = input.finalize[input.key];
  const feed = pageFeedFlags(input.key, "body", {
    pivot_chart_path: input.pivot_chart_path,
    partner_bazi: input.partner_bazi,
  });
  const faceNative = isFaceDeliveryKey(input.key);

  let face01Ctx: Face01ProductionContext | null = null;
  let face02Ctx: Face02ProductionContext | null = null;
  let face04Ctx: Face04ProductionContext | null = null;
  let face05Ctx: Face05ProductionContext | null = null;
  let face06Ctx: Face06ProductionContext | null = null;
  let face07Ctx: Face07ProductionContext | null = null;
  if (input.key === "01") {
    const built = buildFace01ProductionContext({
      report_id: input.report_id?.trim() || input.session_id || "report_face01",
      locale: input.locale,
      dc: input.decision_context_snapshot ?? null,
      pack: input.book_judgment_pack ?? null,
      chart_fact_pack: input.chart_fact_pack ?? null,
      ziwei_fact_pack: input.ziwei_fact_pack ?? null,
    });
    if (!built.ok) {
      return {
        ok: false,
        reason: built.reason,
        tokens_used: 0,
        face01_meta: { validation_issues: [{ detail: built.detail ?? built.reason }] },
      };
    }
    face01Ctx = built.ctx;
  }
  if (input.key === "02") {
    const built = buildFace02ProductionContext({
      report_id: input.report_id?.trim() || input.session_id || "report_face02",
      locale: input.locale,
      dc: input.decision_context_snapshot ?? null,
      pack: input.book_judgment_pack ?? null,
      chart_fact_pack: input.chart_fact_pack ?? null,
      ziwei_fact_pack: input.ziwei_fact_pack ?? null,
      page01: input.page01_schema ?? null,
    });
    if (!built.ok) {
      return {
        ok: false,
        reason: built.reason,
        tokens_used: 0,
        face02_meta: { validation_issues: [{ detail: built.detail ?? built.reason }] },
      };
    }
    // Architecture gate: required inputs missing → do NOT call the model.
    if (!built.ctx.may_invoke_llm) {
      const blocking = built.ctx.architecture.missing_inputs.filter(
        (g) => g.handling === "defer_generation",
      );
      return {
        ok: false,
        reason: "face02_blocked_on_required_inputs",
        tokens_used: 0,
        face02_meta: {
          prompt_version: built.ctx.prompt_version,
          slice_summary: {
            ...face02SliceSummary(built.ctx),
            blocked: true,
            blocking_gaps: blocking.map((g) => g.gap_id),
          },
          validation_issues: [
            {
              detail: `may_invoke_llm=false; generation_status=${built.ctx.architecture.generation_status}; gaps=${blocking.map((g) => g.field_id).join(",")}`,
            },
          ],
        },
      };
    }
    face02Ctx = built.ctx;
  }
  if (input.key === "04") {
    const built = buildFace04ProductionContext({
      report_id: input.report_id?.trim() || input.session_id || "report_face04",
      locale: input.locale,
      dc: input.decision_context_snapshot ?? null,
      pack: input.book_judgment_pack ?? null,
      chart_fact_pack: input.chart_fact_pack ?? null,
      page01: input.page01_schema ?? null,
      page02: input.page02_schema ?? null,
    });
    if (!built.ok) {
      return {
        ok: false,
        reason: built.reason,
        tokens_used: 0,
        face04_meta: {
          validation_issues: [{ detail: built.detail ?? built.reason }],
        },
      };
    }
    if (!built.ctx.may_invoke_llm) {
      const blocking = built.ctx.architecture.missing_inputs.filter(
        (g) => g.handling === "defer_generation",
      );
      return {
        ok: false,
        reason: "face04_blocked_on_required_inputs",
        tokens_used: 0,
        face04_meta: {
          prompt_version: built.ctx.prompt_version,
          slice_summary: {
            ...face04SliceSummary(built.ctx),
            blocked: true,
            blocking_gaps: blocking.map((g) => g.gap_id),
          },
          validation_issues: [
            {
              detail: `may_invoke_llm=false; generation_status=${built.ctx.architecture.generation_status}; gaps=${blocking.map((g) => g.field_id).join(",")}`,
            },
          ],
        },
      };
    }
    face04Ctx = built.ctx;
  }
  if (input.key === "05") {
    const built = buildFace05ProductionContext({
      report_id: input.report_id?.trim() || input.session_id || "report_face05",
      locale: input.locale,
      dc: input.decision_context_snapshot ?? null,
      pack: input.book_judgment_pack ?? null,
      chart_fact_pack: input.chart_fact_pack ?? null,
      page01: input.page01_schema ?? null,
      page02: input.page02_schema ?? null,
      page04: input.page04_schema ?? null,
    });
    if (!built.ok) {
      return {
        ok: false,
        reason: built.reason,
        tokens_used: 0,
        face05_meta: {
          validation_issues: [{ detail: built.detail ?? built.reason }],
        },
      };
    }
    if (!built.ctx.may_invoke_llm) {
      const blocking = built.ctx.architecture.missing_inputs.filter(
        (g) => g.handling === "defer_generation",
      );
      return {
        ok: false,
        reason: "face05_blocked_on_required_inputs",
        tokens_used: 0,
        face05_meta: {
          prompt_version: built.ctx.prompt_version,
          slice_summary: {
            ...face05SliceSummary(built.ctx),
            blocked: true,
            blocking_gaps: blocking.map((g) => g.gap_id),
          },
          validation_issues: [
            {
              detail: `may_invoke_llm=false; generation_status=${built.ctx.architecture.generation_status}; gaps=${blocking.map((g) => g.field_id).join(",")}`,
            },
          ],
        },
      };
    }
    face05Ctx = built.ctx;
  }
  if (input.key === "06") {
    const built = buildFace06ProductionContext({
      report_id: input.report_id?.trim() || input.session_id || "report_face06",
      locale: input.locale,
      dc: input.decision_context_snapshot ?? null,
      pack: input.book_judgment_pack ?? null,
      chart_fact_pack: input.chart_fact_pack ?? null,
      page01: input.page01_schema ?? null,
      page02: input.page02_schema ?? null,
      page04: input.page04_schema ?? null,
      page05: input.page05_schema ?? null,
    });
    if (!built.ok) {
      return {
        ok: false,
        reason: built.reason,
        tokens_used: 0,
        face06_meta: {
          validation_issues: [{ detail: built.detail ?? built.reason }],
        },
      };
    }
    if (!built.ctx.may_invoke_llm) {
      const blocking = built.ctx.architecture.missing_inputs.filter(
        (g) => g.handling === "defer_generation",
      );
      return {
        ok: false,
        reason: "face06_blocked_on_required_inputs",
        tokens_used: 0,
        face06_meta: {
          prompt_version: built.ctx.prompt_version,
          slice_summary: {
            ...face06SliceSummary(built.ctx),
            blocked: true,
            blocking_gaps: blocking.map((g) => g.gap_id),
          },
          validation_issues: [
            {
              detail: `may_invoke_llm=false; generation_status=${built.ctx.architecture.generation_status}; gaps=${blocking.map((g) => g.field_id).join(",")}`,
            },
          ],
        },
      };
    }
    face06Ctx = built.ctx;
  }
  if (input.key === "07") {
    const built = buildFace07ProductionContext({
      report_id: input.report_id?.trim() || input.session_id || "report_face07",
      locale: input.locale,
      dc: input.decision_context_snapshot ?? null,
      pack: input.book_judgment_pack ?? null,
      chart_fact_pack: input.chart_fact_pack ?? null,
      page01: input.page01_schema ?? null,
      page02: input.page02_schema ?? null,
      page04: input.page04_schema ?? null,
      page05: input.page05_schema ?? null,
      page06: input.page06_schema ?? null,
      authorized_partner_profile: input.partner_bazi === "present",
    });
    if (!built.ok) {
      return {
        ok: false,
        reason: built.reason,
        tokens_used: 0,
        face07_meta: {
          validation_issues: [{ detail: built.detail ?? built.reason }],
        },
      };
    }
    if (built.ctx.applicability.status === "not_applicable") {
      const skip = synthesizeFace07StatusPage({
        locale: input.locale,
        applicability: built.ctx.applicability,
        architecture: built.ctx.architecture,
      });
      const validated = validateFace07ProductionOutput({
        raw: skip,
        locale: input.locale,
        ctx: built.ctx,
      });
      if (!validated.ok) {
        return {
          ok: false,
          reason: validated.reason,
          tokens_used: 0,
          face07_meta: {
            prompt_version: built.ctx.prompt_version,
            slice_summary: face07SliceSummary(built.ctx),
            validation_issues: validated.issues,
          },
        };
      }
      const page = validated.page as unknown as DeliveryPageData;
      return {
        ok: true,
        page,
        tokens_used: 0,
        call_trace: {
          phase: "content_body_v3_face07_skip",
          system: built.ctx.system,
          user: built.ctx.user,
          reasoning: null,
          raw_text: null,
          parsed: page,
          meta: {
            actual_model: "none",
            tokens_used: 0,
            prompt_tokens: 0,
            completion_tokens: 0,
            finish_reason: "skipped_not_applicable",
            usage_written: true,
          },
        },
        face07_meta: {
          prompt_version: built.ctx.prompt_version,
          schema_version: built.ctx.schema_version,
          slice_summary: face07SliceSummary(built.ctx),
          validation: "skipped_not_applicable",
        },
      };
    }
    if (built.ctx.applicability.status === "insufficient_information") {
      const structured = synthesizeFace07StatusPage({
        locale: input.locale,
        applicability: built.ctx.applicability,
        architecture: built.ctx.architecture,
      });
      return {
        ok: false,
        reason: "face07_insufficient_information",
        tokens_used: 0,
        face07_meta: {
          prompt_version: built.ctx.prompt_version,
          slice_summary: {
            ...face07SliceSummary(built.ctx),
            blocked: true,
          },
          structured_status: structured,
          validation_issues: [
            { detail: built.ctx.applicability.reason },
          ],
        },
      };
    }
    if (!built.ctx.may_invoke_llm) {
      const blocking = built.ctx.architecture.missing_inputs.filter(
        (g) => g.handling === "defer_generation",
      );
      return {
        ok: false,
        reason: "face07_blocked_on_required_inputs",
        tokens_used: 0,
        face07_meta: {
          prompt_version: built.ctx.prompt_version,
          slice_summary: {
            ...face07SliceSummary(built.ctx),
            blocked: true,
            blocking_gaps: blocking.map((g) => g.gap_id),
          },
          validation_issues: [
            {
              detail: `may_invoke_llm=false; generation_status=${built.ctx.architecture.generation_status}; gaps=${blocking.map((g) => g.field_id).join(",")}`,
            },
          ],
        },
      };
    }
    face07Ctx = built.ctx;
  }
  const pageSlice = formatPageSliceFeed({
    key: input.key,
    chartText: feed.thesis_factpack ? input.chart_fact_pack : null,
    ziwei: feed.thesis_factpack ? input.ziwei_fact_pack : null,
    question: input.question_expectation,
    topic: input.topic,
    withAllowlistHeader: true,
  });
  /** Pack slice into USER_FEED so Lab call-trace ↔ prompt stay aligned (not chart-only). */
  const packFeed = input.book_judgment_pack_block?.trim() || "";
  /** Face-native: user_feed = pack (if any) + slice (+ optional corrective). No legacy paper mash. */
  let feedParts = faceNative
    ? [packFeed, pageSlice ?? ""].filter((s) => s?.trim()).join("\n\n")
    : [
        feed.thesis_factpack && input.chart_thesis_block?.trim()
          ? `## 命盘总纲（主辅必须从此可推；删掉后主张应垮）\n${input.chart_thesis_block.trim()}`
          : "",
        pageSlice ?? "",
        feed.primary_backup_hint && input.primary_backup_hint?.trim()
          ? input.primary_backup_hint.trim()
          : "",
        feed.question_expectation ? input.question_expectation : "",
        feed.dyad_relation_structure && input.dyad_relation_structure?.trim()
          ? input.dyad_relation_structure.trim()
          : "",
        // P4 正文：奇门已在 Fact-pack + moat；禁再灌 eastern_calc（fill 派工全文含 Q·E/多维「用兼职节奏」等 priming）
        feed.qimen && input.key !== "self_regulation"
          ? input.eastern_calc_slice
          : "",
        feed.reality ? input.reality_constraints : "",
        feed.foundation_surface ? input.foundation_surface_feed : "",
        feed.science_means ? input.science_means_feed : "",
        feed.metaphysics_moat ? input.metaphysics_moat_feed : "",
        feed.risk_fuse ? input.risk_fuse_feed : "",
        feed.close_ritual ? input.close_ritual_feed : "",
        feed.structured_inventory && !pageSlice
          ? input.structured_inventory?.slice(0, 6_000)
          : "",
        feed.upstream_action_excerpt && input.action_brief
          ? `## action_brief\n${JSON.stringify(input.action_brief).slice(0, 2_000)}`
          : "",
        feed.upstream_action_excerpt && input.p3_body_excerpt?.trim()
          ? `## P3 正文摘录（下游对齐用）\n${input.p3_body_excerpt.trim().slice(0, 2_000)}`
          : "",
      ]
        .filter((s) => s?.trim())
        .join("\n\n");

  // 共享包剥未授权块。P4 正文禁跑 judgment 处方 scrub：会把允许轴「宜守」改成「承压偏高」，并污染取向锚。
  if (!faceNative && input.key !== "self_regulation") {
    feedParts = scrubJudgmentFeedPrescriptions(feedParts);
  }
  if (!faceNative && !feed.qimen) {
    feedParts = stripQimenBlocksUnlessPageAllows(feedParts);
  }
  // P4 正文：组装后再剥试水/权责 priming（duty 不枚举这些词教模型写否定句）
  if (!faceNative && input.key === "self_regulation") {
    feedParts = scrubP4BodyFeedPriming(feedParts);
  }
  // S1: include Formal DC in user_feed so Lab call_trace ① matches model prompt.
  const dcBlock = input.decision_context_feed?.trim() || "";
  const userFeed = [
    dcBlock,
    feedParts,
    input.acceptance_corrective?.trim() || "",
  ]
    .filter((s) => s?.trim())
    .join("\n\n");

  const zfpOmitted =
    !input.ziwei_fact_pack ||
    !(input.ziwei_fact_pack.patternHits?.length > 0);
  // Face01/02/04/05/06 V2: prompt is the production slice pair; do not mash DC/legacy feed into user.
  const faceV2Ctx =
    face01Ctx || face02Ctx || face04Ctx || face05Ctx || face06Ctx || face07Ctx;
  const effectiveUserFeed = faceV2Ctx ? "" : userFeed;
  const { system, user } = buildV3BodyPrompt({
    key: input.key,
    locale: input.locale,
    core_conclusion: faceV2Ctx ? "" : (seg?.core_conclusion ?? ""),
    judgment_lock: faceV2Ctx
      ? ""
      : formatJudgmentLockForBody(input.deep_evidence_plan, input.key),
    book_judgment_pack_block: faceV2Ctx
      ? null
      : input.book_judgment_pack_block,
    user_feed: effectiveUserFeed,
    zfpOmitted,
    decision_context_feed: faceV2Ctx ? null : input.decision_context_feed,
    face01_production: face01Ctx
      ? { system: face01Ctx.system, user: face01Ctx.user }
      : null,
    face02_production: face02Ctx
      ? { system: face02Ctx.system, user: face02Ctx.user }
      : null,
    face04_production: face04Ctx
      ? { system: face04Ctx.system, user: face04Ctx.user }
      : null,
    face05_production: face05Ctx
      ? { system: face05Ctx.system, user: face05Ctx.user }
      : null,
    face06_production: face06Ctx
      ? { system: face06Ctx.system, user: face06Ctx.user }
      : null,
    face07_production: face07Ctx
      ? { system: face07Ctx.system, user: face07Ctx.user }
      : null,
  });

  let tokens_used = 0;
  try {
    const { deliveryDispatchProviderBody } = await import(
      "@/lib/llm/pro/delivery/dispatch/provider-escape"
    );
    const provider = deliveryDispatchProviderBody(
      Math.max(1, input.dispatch_attempt ?? 1),
    );

    const phaseName = face01Ctx
      ? "content_body_v3_face01"
      : face02Ctx
        ? "content_body_v3_face02"
        : face04Ctx
          ? "content_body_v3_face04"
          : face05Ctx
            ? "content_body_v3_face05"
            : face06Ctx
              ? "content_body_v3_face06"
              : face07Ctx
                ? "content_body_v3_face07"
                : "content_body_v3";

    const invoke = async (sys: string, usr: string) => {
      if (contentBodyTestInvoke) {
        return contentBodyTestInvoke(sys, usr);
      }
      return callLLM({
        call_type: "main_delivery",
        system: sys,
        messages: [{ role: "user", content: usr }],
        max_tokens: PAGE_SCHEMA_FILL_MAX_TOKENS,
        thinking_effort: input.thinking_effort ?? "high",
        timeout_ms: input.timeout_ms ?? DELIVERY_SINGLE_CALL_TIMEOUT_MS,
        response_format: "json",
        session_id: input.session_id,
        temperature: 0.4,
        max_attempts: deliveryLabTransportMaxAttempts(),
        signal: input.signal,
        provider,
        phase_name: phaseName,
      });
    };

    const result = await invoke(system, user);
    tokens_used += result.meta.tokens_used;
    const finish = result.meta.finish_reason ?? null;
    const text = result.content?.trim() ?? "";
    const scare = scareRedlineSnippet(text);
    if (scare) {
      return {
        ok: false,
        reason: "scare_redline",
        tokens_used,
        last_raw_text: text.slice(0, 12_000),
        call_trace: buildLabCallTrace({
          phase: phaseName,
          system,
          user,
          user_feed:
            effectiveUserFeed ||
            face01Ctx?.user ||
            face02Ctx?.user ||
            face04Ctx?.user ||
            face05Ctx?.user ||
            face06Ctx?.user ||
            face07Ctx?.user ||
            "",
          raw_text: text,
          result,
        }),
        face01_meta: face01Ctx
          ? { prompt_version: face01Ctx.prompt_version, slice_summary: face01SliceSummary(face01Ctx) }
          : undefined,
        face02_meta: face02Ctx
          ? { prompt_version: face02Ctx.prompt_version, slice_summary: face02SliceSummary(face02Ctx) }
          : undefined,
        face04_meta: face04Ctx
          ? { prompt_version: face04Ctx.prompt_version, slice_summary: face04SliceSummary(face04Ctx) }
          : undefined,
        face05_meta: face05Ctx
          ? { prompt_version: face05Ctx.prompt_version, slice_summary: face05SliceSummary(face05Ctx) }
          : undefined,
        face06_meta: face06Ctx
          ? { prompt_version: face06Ctx.prompt_version, slice_summary: face06SliceSummary(face06Ctx) }
          : undefined,
        face07_meta: face07Ctx
          ? { prompt_version: face07Ctx.prompt_version, slice_summary: face07SliceSummary(face07Ctx) }
          : undefined,
      };
    }
    const baseTrace = {
      phase: phaseName,
      system,
      user,
      user_feed:
        effectiveUserFeed ||
        face01Ctx?.user ||
        face02Ctx?.user ||
        face04Ctx?.user ||
        face05Ctx?.user ||
        face06Ctx?.user ||
        face07Ctx?.user ||
        "",
      result,
    };
    const { v3FailReasonAfterUnusableJson } = await import(
      "@/lib/llm/pro/delivery/dispatch/provider-escape"
    );
    if (!text) {
      return {
        ok: false,
        reason: v3FailReasonAfterUnusableJson({
          finish,
          text,
          empty: true,
        }),
        tokens_used,
        last_raw_text: text,
        call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
      };
    }

    // --- Face 01 V2: strict JSON → schema → evidence → body compliance ---
    if (face01Ctx) {
      const finalizeFace01 = async (
        rawText: string,
        parsedIn: unknown,
        validationTag: "passed" | "passed_after_repair",
        repairTrace?: LabCallTrace,
      ): Promise<ContentBodyOk | ContentBodyFail> => {
        const validated = validateFace01ProductionOutput({
          raw: parsedIn,
          locale: input.locale,
          ctx: face01Ctx!,
        });
        if (!validated.ok) {
          return {
            ok: false,
            reason: validated.reason,
            tokens_used,
            last_raw_text: rawText.slice(0, 12_000),
            call_trace: repairTrace ??
              buildLabCallTrace({
                ...baseTrace,
                raw_text: rawText,
                parsed: parsedIn,
              }),
            face01_meta: {
              prompt_version: face01Ctx!.prompt_version,
              slice_summary: face01SliceSummary(face01Ctx!),
              validation_issues: validated.issues,
            },
          };
        }
        const page = validated.page as unknown as DeliveryPageData;
        return {
          ok: true,
          page,
          tokens_used,
          last_raw_text: rawText.slice(0, 12_000),
          call_trace: repairTrace ??
            buildLabCallTrace({
              ...baseTrace,
              raw_text: rawText,
              parsed: page,
            }),
          face01_meta: {
            prompt_version: face01Ctx!.prompt_version,
            schema_version: face01Ctx!.schema_version,
            slice_summary: face01SliceSummary(face01Ctx!),
            validation: validationTag,
            cited_term_ids: validated.cited_term_ids,
          },
        };
      };

      let parsed01 = parseFace01JsonStrict(text);
      if (parsed01 == null) {
        // One chance: strip markdown fence then re-parse; still must re-validate fully.
        try {
          parsed01 = extractJson(text);
        } catch {
          parsed01 = null;
        }
      }
      if (parsed01 == null) {
        return {
          ok: false,
          reason: "face01_json_not_strict",
          tokens_used,
          last_raw_text: text.slice(0, 12_000),
          call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
          face01_meta: {
            prompt_version: face01Ctx.prompt_version,
            slice_summary: face01SliceSummary(face01Ctx),
          },
        };
      }

      const first = await finalizeFace01(text, parsed01, "passed");
      if (first.ok) return first;

      // One targeted repair invoke — then full re-validation; no legacy fallback.
      const repairUser = buildFace01RepairUserMessage({
        previousUser: user,
        previousRaw: text,
        issues:
          (first.face01_meta?.validation_issues as
            | import("@/lib/llm/pro/delivery/decision-report-v2/page01/validate").Face01Issue[]
            | undefined) ?? [
            { code: "face01_validation_failed", detail: first.reason },
          ],
      });
      const repairResult = await invoke(system, repairUser);
      tokens_used += repairResult.meta.tokens_used;
      const repairText = repairResult.content?.trim() ?? "";
      if (scareRedlineSnippet(repairText)) {
        return {
          ok: false,
          reason: "scare_redline",
          tokens_used,
          last_raw_text: repairText.slice(0, 12_000),
          call_trace: buildLabCallTrace({
            ...baseTrace,
            raw_text: repairText,
            result: repairResult,
          }),
          face01_meta: {
            prompt_version: face01Ctx.prompt_version,
            slice_summary: face01SliceSummary(face01Ctx),
          },
        };
      }
      let repairParsed = parseFace01JsonStrict(repairText);
      if (repairParsed == null) {
        try {
          repairParsed = extractJson(repairText);
        } catch {
          repairParsed = null;
        }
      }
      if (repairParsed == null) {
        return {
          ok: false,
          reason: "face01_repair_json_not_strict",
          tokens_used,
          last_raw_text: repairText.slice(0, 12_000),
          call_trace: buildLabCallTrace({
            ...baseTrace,
            raw_text: repairText,
            result: repairResult,
          }),
          face01_meta: {
            prompt_version: face01Ctx.prompt_version,
            slice_summary: face01SliceSummary(face01Ctx),
            validation_issues: first.face01_meta?.validation_issues,
          },
        };
      }
      return finalizeFace01(
        repairText,
        repairParsed,
        "passed_after_repair",
        buildLabCallTrace({
          ...baseTrace,
          raw_text: repairText,
          result: repairResult,
          parsed: repairParsed,
        }),
      );
    }

    // --- Face 02 V2: strict JSON → schema → evidence → body compliance ---
    if (face02Ctx) {
      const finalizeFace02 = async (
        rawText: string,
        parsedIn: unknown,
        validationTag: "passed" | "passed_after_repair",
        repairTrace?: LabCallTrace,
      ): Promise<ContentBodyOk | ContentBodyFail> => {
        const validated = validateFace02ProductionOutput({
          raw: parsedIn,
          locale: input.locale,
          ctx: face02Ctx!,
        });
        if (!validated.ok) {
          return {
            ok: false,
            reason: validated.reason,
            tokens_used,
            last_raw_text: rawText.slice(0, 12_000),
            call_trace: repairTrace ??
              buildLabCallTrace({
                ...baseTrace,
                raw_text: rawText,
                parsed: parsedIn,
              }),
            face02_meta: {
              prompt_version: face02Ctx!.prompt_version,
              slice_summary: face02SliceSummary(face02Ctx!),
              validation_issues: validated.issues,
            },
          };
        }
        const page = validated.page as unknown as DeliveryPageData;
        return {
          ok: true,
          page,
          tokens_used,
          last_raw_text: rawText.slice(0, 12_000),
          call_trace: repairTrace ??
            buildLabCallTrace({
              ...baseTrace,
              raw_text: rawText,
              parsed: page,
            }),
          face02_meta: {
            prompt_version: face02Ctx!.prompt_version,
            schema_version: face02Ctx!.schema_version,
            slice_summary: face02SliceSummary(face02Ctx!),
            validation: validationTag,
            cited_term_ids: validated.cited_term_ids,
            realized_evidence_ids: validated.realized_evidence_ids,
          },
        };
      };

      let parsed02 = parseFace02JsonStrict(text);
      if (parsed02 == null) {
        try {
          parsed02 = extractJson(text);
        } catch {
          parsed02 = null;
        }
      }
      if (parsed02 == null) {
        return {
          ok: false,
          reason: "face02_json_not_strict",
          tokens_used,
          last_raw_text: text.slice(0, 12_000),
          call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
          face02_meta: {
            prompt_version: face02Ctx.prompt_version,
            slice_summary: face02SliceSummary(face02Ctx),
          },
        };
      }

      const first02 = await finalizeFace02(text, parsed02, "passed");
      if (first02.ok) return first02;

      const repairUser02 = buildFace02RepairUserMessage({
        previousUser: user,
        previousRaw: text,
        issues:
          (first02.face02_meta?.validation_issues as
            | import("@/lib/llm/pro/delivery/decision-report-v2/page02/validate").Face02Issue[]
            | undefined) ?? [
            { code: "face02_validation_failed", detail: first02.reason },
          ],
      });
      const repairResult02 = await invoke(system, repairUser02);
      tokens_used += repairResult02.meta.tokens_used;
      const repairText02 = repairResult02.content?.trim() ?? "";
      if (scareRedlineSnippet(repairText02)) {
        return {
          ok: false,
          reason: "scare_redline",
          tokens_used,
          last_raw_text: repairText02.slice(0, 12_000),
          call_trace: buildLabCallTrace({
            ...baseTrace,
            raw_text: repairText02,
            result: repairResult02,
          }),
          face02_meta: {
            prompt_version: face02Ctx.prompt_version,
            slice_summary: face02SliceSummary(face02Ctx),
          },
        };
      }
      let repairParsed02 = parseFace02JsonStrict(repairText02);
      if (repairParsed02 == null) {
        try {
          repairParsed02 = extractJson(repairText02);
        } catch {
          repairParsed02 = null;
        }
      }
      if (repairParsed02 == null) {
        return {
          ok: false,
          reason: "face02_repair_json_not_strict",
          tokens_used,
          last_raw_text: repairText02.slice(0, 12_000),
          call_trace: buildLabCallTrace({
            ...baseTrace,
            raw_text: repairText02,
            result: repairResult02,
          }),
          face02_meta: {
            prompt_version: face02Ctx.prompt_version,
            slice_summary: face02SliceSummary(face02Ctx),
            validation_issues: first02.face02_meta?.validation_issues,
          },
        };
      }
      return finalizeFace02(
        repairText02,
        repairParsed02,
        "passed_after_repair",
        buildLabCallTrace({
          ...baseTrace,
          raw_text: repairText02,
          result: repairResult02,
          parsed: repairParsed02,
        }),
      );
    }

    // --- Face 04 V2: strict JSON → schema → claim/evidence/fact → attach ---
    if (face04Ctx) {
      const finalizeFace04 = async (
        rawText: string,
        parsedIn: unknown,
        validationTag: "passed" | "passed_after_repair",
        repairTrace?: LabCallTrace,
      ): Promise<ContentBodyOk | ContentBodyFail> => {
        const validated = validateFace04ProductionOutput({
          raw: parsedIn,
          locale: input.locale,
          ctx: face04Ctx!,
        });
        if (!validated.ok) {
          return {
            ok: false,
            reason: validated.reason,
            tokens_used,
            last_raw_text: rawText.slice(0, 12_000),
            call_trace: repairTrace ??
              buildLabCallTrace({
                ...baseTrace,
                raw_text: rawText,
                parsed: parsedIn,
              }),
            face04_meta: {
              prompt_version: face04Ctx!.prompt_version,
              slice_summary: face04SliceSummary(face04Ctx!),
              validation_issues: validated.issues,
            },
          };
        }
        const page = validated.page as unknown as DeliveryPageData;
        return {
          ok: true,
          page,
          tokens_used,
          last_raw_text: rawText.slice(0, 12_000),
          call_trace: repairTrace ??
            buildLabCallTrace({
              ...baseTrace,
              raw_text: rawText,
              parsed: page,
            }),
          face04_meta: {
            prompt_version: face04Ctx!.prompt_version,
            schema_version: face04Ctx!.schema_version,
            slice_summary: face04SliceSummary(face04Ctx!),
            validation: validationTag,
          },
        };
      };

      // Strict parse only — never fall through to legacy flat coerce.
      const parsed04 = parseFace04JsonStrict(text);
      if (parsed04 == null) {
        return {
          ok: false,
          reason: "face04_json_not_strict",
          tokens_used,
          last_raw_text: text.slice(0, 12_000),
          call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
          face04_meta: {
            prompt_version: face04Ctx.prompt_version,
            slice_summary: face04SliceSummary(face04Ctx),
          },
        };
      }

      const first04 = await finalizeFace04(text, parsed04, "passed");
      if (first04.ok) return first04;

      const repairUser04 = buildFace04RepairUserMessage({
        previousUser: user,
        previousRaw: text,
        issues:
          (first04.face04_meta?.validation_issues as
            | import("@/lib/llm/pro/delivery/decision-report-v2/page04/validate").Face04Issue[]
            | undefined) ?? [
            { code: "face04_validation_failed", detail: first04.reason },
          ],
      });
      const repairResult04 = await invoke(system, repairUser04);
      tokens_used += repairResult04.meta.tokens_used;
      const repairText04 = repairResult04.content?.trim() ?? "";
      if (scareRedlineSnippet(repairText04)) {
        return {
          ok: false,
          reason: "scare_redline",
          tokens_used,
          last_raw_text: repairText04.slice(0, 12_000),
          call_trace: buildLabCallTrace({
            ...baseTrace,
            raw_text: repairText04,
            result: repairResult04,
          }),
          face04_meta: {
            prompt_version: face04Ctx.prompt_version,
            slice_summary: face04SliceSummary(face04Ctx),
          },
        };
      }
      const repairParsed04 = parseFace04JsonStrict(repairText04);
      if (repairParsed04 == null) {
        return {
          ok: false,
          reason: "face04_repair_json_not_strict",
          tokens_used,
          last_raw_text: repairText04.slice(0, 12_000),
          call_trace: buildLabCallTrace({
            ...baseTrace,
            raw_text: repairText04,
            result: repairResult04,
          }),
          face04_meta: {
            prompt_version: face04Ctx.prompt_version,
            slice_summary: face04SliceSummary(face04Ctx),
            validation_issues: first04.face04_meta?.validation_issues,
          },
        };
      }
      return finalizeFace04(
        repairText04,
        repairParsed04,
        "passed_after_repair",
        buildLabCallTrace({
          ...baseTrace,
          raw_text: repairText04,
          result: repairResult04,
          parsed: repairParsed04,
        }),
      );
    }

    // --- Face 05 V2: strict JSON → schema → paths/refs/facts → attach ---
    if (face05Ctx) {
      const finalizeFace05 = async (
        rawText: string,
        parsedIn: unknown,
        validationTag: "passed" | "passed_after_repair",
        repairTrace?: LabCallTrace,
      ): Promise<ContentBodyOk | ContentBodyFail> => {
        const validated = validateFace05ProductionOutput({
          raw: parsedIn,
          locale: input.locale,
          ctx: face05Ctx!,
        });
        if (!validated.ok) {
          return {
            ok: false,
            reason: validated.reason,
            tokens_used,
            last_raw_text: rawText.slice(0, 12_000),
            call_trace: repairTrace ??
              buildLabCallTrace({
                ...baseTrace,
                raw_text: rawText,
                parsed: parsedIn,
              }),
            face05_meta: {
              prompt_version: face05Ctx!.prompt_version,
              slice_summary: face05SliceSummary(face05Ctx!),
              validation_issues: validated.issues,
            },
          };
        }
        const page = validated.page as unknown as DeliveryPageData;
        return {
          ok: true,
          page,
          tokens_used,
          last_raw_text: rawText.slice(0, 12_000),
          call_trace: repairTrace ??
            buildLabCallTrace({
              ...baseTrace,
              raw_text: rawText,
              parsed: page,
            }),
          face05_meta: {
            prompt_version: face05Ctx!.prompt_version,
            schema_version: face05Ctx!.schema_version,
            slice_summary: face05SliceSummary(face05Ctx!),
            validation: validationTag,
          },
        };
      };

      const parsed05 = parseFace05JsonStrict(text);
      if (parsed05 == null) {
        return {
          ok: false,
          reason: "face05_json_not_strict",
          tokens_used,
          last_raw_text: text.slice(0, 12_000),
          call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
          face05_meta: {
            prompt_version: face05Ctx.prompt_version,
            slice_summary: face05SliceSummary(face05Ctx),
          },
        };
      }

      const first05 = await finalizeFace05(text, parsed05, "passed");
      if (first05.ok) return first05;

      const repairUser05 = buildFace05RepairUserMessage({
        previousUser: user,
        previousRaw: text,
        issues:
          (first05.face05_meta?.validation_issues as
            | import("@/lib/llm/pro/delivery/decision-report-v2/page05/validate").Face05Issue[]
            | undefined) ?? [
            { code: "face05_validation_failed", detail: first05.reason },
          ],
      });
      const repairResult05 = await invoke(system, repairUser05);
      tokens_used += repairResult05.meta.tokens_used;
      const repairText05 = repairResult05.content?.trim() ?? "";
      if (scareRedlineSnippet(repairText05)) {
        return {
          ok: false,
          reason: "scare_redline",
          tokens_used,
          last_raw_text: repairText05.slice(0, 12_000),
          call_trace: buildLabCallTrace({
            ...baseTrace,
            raw_text: repairText05,
            result: repairResult05,
          }),
          face05_meta: {
            prompt_version: face05Ctx.prompt_version,
            slice_summary: face05SliceSummary(face05Ctx),
          },
        };
      }
      const repairParsed05 = parseFace05JsonStrict(repairText05);
      if (repairParsed05 == null) {
        return {
          ok: false,
          reason: "face05_repair_json_not_strict",
          tokens_used,
          last_raw_text: repairText05.slice(0, 12_000),
          call_trace: buildLabCallTrace({
            ...baseTrace,
            raw_text: repairText05,
            result: repairResult05,
          }),
          face05_meta: {
            prompt_version: face05Ctx.prompt_version,
            slice_summary: face05SliceSummary(face05Ctx),
            validation_issues: first05.face05_meta?.validation_issues,
          },
        };
      }
      return finalizeFace05(
        repairText05,
        repairParsed05,
        "passed_after_repair",
        buildLabCallTrace({
          ...baseTrace,
          raw_text: repairText05,
          result: repairResult05,
          parsed: repairParsed05,
        }),
      );
    }

    // --- Face 06 V2: strict JSON → schema → paths/refs/facts → attach ---
    if (face06Ctx) {
      const finalizeFace06 = async (
        rawText: string,
        parsedIn: unknown,
        validationTag: "passed" | "passed_after_repair",
        repairTrace?: LabCallTrace,
      ): Promise<ContentBodyOk | ContentBodyFail> => {
        const validated = validateFace06ProductionOutput({
          raw: parsedIn,
          locale: input.locale,
          ctx: face06Ctx!,
        });
        if (!validated.ok) {
          return {
            ok: false,
            reason: validated.reason,
            tokens_used,
            last_raw_text: rawText.slice(0, 12_000),
            call_trace: repairTrace ??
              buildLabCallTrace({
                ...baseTrace,
                raw_text: rawText,
                parsed: parsedIn,
              }),
            face06_meta: {
              prompt_version: face06Ctx!.prompt_version,
              slice_summary: face06SliceSummary(face06Ctx!),
              validation_issues: validated.issues,
            },
          };
        }
        const page = validated.page as unknown as DeliveryPageData;
        return {
          ok: true,
          page,
          tokens_used,
          last_raw_text: rawText.slice(0, 12_000),
          call_trace: repairTrace ??
            buildLabCallTrace({
              ...baseTrace,
              raw_text: rawText,
              parsed: page,
            }),
          face06_meta: {
            prompt_version: face06Ctx!.prompt_version,
            schema_version: face06Ctx!.schema_version,
            slice_summary: face06SliceSummary(face06Ctx!),
            validation: validationTag,
          },
        };
      };

      const parsed06 = parseFace06JsonStrict(text);
      if (parsed06 == null) {
        return {
          ok: false,
          reason: "face06_json_not_strict",
          tokens_used,
          last_raw_text: text.slice(0, 12_000),
          call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
          face06_meta: {
            prompt_version: face06Ctx.prompt_version,
            slice_summary: face06SliceSummary(face06Ctx),
          },
        };
      }

      const first06 = await finalizeFace06(text, parsed06, "passed");
      if (first06.ok) return first06;

      const repairUser06 = buildFace06RepairUserMessage({
        previousUser: user,
        previousRaw: text,
        issues:
          (first06.face06_meta?.validation_issues as
            | import("@/lib/llm/pro/delivery/decision-report-v2/page06/validate").Face06Issue[]
            | undefined) ?? [
            { code: "face06_validation_failed", detail: first06.reason },
          ],
      });
      const repairResult06 = await invoke(system, repairUser06);
      tokens_used += repairResult06.meta.tokens_used;
      const repairText06 = repairResult06.content?.trim() ?? "";
      if (scareRedlineSnippet(repairText06)) {
        return {
          ok: false,
          reason: "scare_redline",
          tokens_used,
          last_raw_text: repairText06.slice(0, 12_000),
          call_trace: buildLabCallTrace({
            ...baseTrace,
            raw_text: repairText06,
            result: repairResult06,
          }),
          face06_meta: {
            prompt_version: face06Ctx.prompt_version,
            slice_summary: face06SliceSummary(face06Ctx),
          },
        };
      }
      const repairParsed06 = parseFace06JsonStrict(repairText06);
      if (repairParsed06 == null) {
        return {
          ok: false,
          reason: "face06_repair_json_not_strict",
          tokens_used,
          last_raw_text: repairText06.slice(0, 12_000),
          call_trace: buildLabCallTrace({
            ...baseTrace,
            raw_text: repairText06,
            result: repairResult06,
          }),
          face06_meta: {
            prompt_version: face06Ctx.prompt_version,
            slice_summary: face06SliceSummary(face06Ctx),
            validation_issues: first06.face06_meta?.validation_issues,
          },
        };
      }
      return finalizeFace06(
        repairText06,
        repairParsed06,
        "passed_after_repair",
        buildLabCallTrace({
          ...baseTrace,
          raw_text: repairText06,
          result: repairResult06,
          parsed: repairParsed06,
        }),
      );
    }

    // --- Face 07 V2: strict JSON → schema → participants/refs → attach ---
    if (face07Ctx) {
      const finalizeFace07 = async (
        rawText: string,
        parsedIn: unknown,
        validationTag: "passed" | "passed_after_repair",
        repairTrace?: LabCallTrace,
      ): Promise<ContentBodyOk | ContentBodyFail> => {
        const validated = validateFace07ProductionOutput({
          raw: parsedIn,
          locale: input.locale,
          ctx: face07Ctx!,
        });
        if (!validated.ok) {
          return {
            ok: false,
            reason: validated.reason,
            tokens_used,
            last_raw_text: rawText.slice(0, 12_000),
            call_trace: repairTrace ??
              buildLabCallTrace({
                ...baseTrace,
                raw_text: rawText,
                parsed: parsedIn,
              }),
            face07_meta: {
              prompt_version: face07Ctx!.prompt_version,
              slice_summary: face07SliceSummary(face07Ctx!),
              validation_issues: validated.issues,
            },
          };
        }
        const page = validated.page as unknown as DeliveryPageData;
        return {
          ok: true,
          page,
          tokens_used,
          last_raw_text: rawText.slice(0, 12_000),
          call_trace: repairTrace ??
            buildLabCallTrace({
              ...baseTrace,
              raw_text: rawText,
              parsed: page,
            }),
          face07_meta: {
            prompt_version: face07Ctx!.prompt_version,
            schema_version: face07Ctx!.schema_version,
            slice_summary: face07SliceSummary(face07Ctx!),
            validation: validationTag,
          },
        };
      };

      const parsed07 = parseFace07JsonStrict(text);
      if (parsed07 == null) {
        return {
          ok: false,
          reason: "face07_json_not_strict",
          tokens_used,
          last_raw_text: text.slice(0, 12_000),
          call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
          face07_meta: {
            prompt_version: face07Ctx.prompt_version,
            slice_summary: face07SliceSummary(face07Ctx),
          },
        };
      }
      const first07 = await finalizeFace07(text, parsed07, "passed");
      if (first07.ok) return first07;
      const repairUser07 = buildFace07RepairUserMessage({
        previousUser: user,
        previousRaw: text,
        issues:
          (first07.face07_meta?.validation_issues as
            | import("@/lib/llm/pro/delivery/decision-report-v2/page07/validate").Face07Issue[]
            | undefined) ?? [
            { code: "face07_validation_failed", detail: first07.reason },
          ],
      });
      const repairResult07 = await invoke(system, repairUser07);
      tokens_used += repairResult07.meta.tokens_used;
      const repairText07 = repairResult07.content?.trim() ?? "";
      if (scareRedlineSnippet(repairText07)) {
        return {
          ok: false,
          reason: "scare_redline",
          tokens_used,
          last_raw_text: repairText07.slice(0, 12_000),
          call_trace: buildLabCallTrace({
            ...baseTrace,
            raw_text: repairText07,
            result: repairResult07,
          }),
          face07_meta: {
            prompt_version: face07Ctx.prompt_version,
            slice_summary: face07SliceSummary(face07Ctx),
          },
        };
      }
      const repairParsed07 = parseFace07JsonStrict(repairText07);
      if (repairParsed07 == null) {
        return {
          ok: false,
          reason: "face07_repair_json_not_strict",
          tokens_used,
          last_raw_text: repairText07.slice(0, 12_000),
          call_trace: buildLabCallTrace({
            ...baseTrace,
            raw_text: repairText07,
            result: repairResult07,
          }),
          face07_meta: {
            prompt_version: face07Ctx.prompt_version,
            slice_summary: face07SliceSummary(face07Ctx),
            validation_issues: first07.face07_meta?.validation_issues,
          },
        };
      }
      return finalizeFace07(
        repairText07,
        repairParsed07,
        "passed_after_repair",
        buildLabCallTrace({
          ...baseTrace,
          raw_text: repairText07,
          result: repairResult07,
          parsed: repairParsed07,
        }),
      );
    }

    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch {
      return {
        ok: false,
        reason: v3FailReasonAfterUnusableJson({
          finish,
          text,
          empty: false,
        }),
        tokens_used,
        last_raw_text: text.slice(0, 12_000),
        call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
      };
    }
    const page = coercePageSchemaLoose(input.key, parsed);
    if (!page) {
      return {
        ok: false,
        reason: "coerce_failed",
        tokens_used,
        last_raw_text: text.slice(0, 12_000),
        call_trace: buildLabCallTrace({
          ...baseTrace,
          raw_text: text,
          parsed,
        }),
      };
    }
    return {
      ok: true,
      page,
      tokens_used,
      last_raw_text: text.slice(0, 12_000),
      call_trace: buildLabCallTrace({
        ...baseTrace,
        raw_text: text,
        parsed: page,
      }),
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "llm_error",
      tokens_used,
      call_trace: buildLabCallTrace({
        phase: face01Ctx
          ? "content_body_v3_face01"
          : face02Ctx
            ? "content_body_v3_face02"
            : face04Ctx
              ? "content_body_v3_face04"
              : face05Ctx
                ? "content_body_v3_face05"
                : face06Ctx
                  ? "content_body_v3_face06"
                  : face07Ctx
                    ? "content_body_v3_face07"
                    : "content_body_v3",
        system,
        user,
        user_feed:
          effectiveUserFeed ||
          face01Ctx?.user ||
          face02Ctx?.user ||
          face04Ctx?.user ||
          face05Ctx?.user ||
          face06Ctx?.user ||
          face07Ctx?.user ||
          "",
        raw_text: null,
      }),
    };
  }
}

/** Type-only re-export for callers. */
export type { Face01V2, Face02V2, Face04V2, Face05V2, Face06V2, Face07V2 };
