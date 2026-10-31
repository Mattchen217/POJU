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
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
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

export type ContentBodyOk = {
  ok: true;
  page: DeliveryPageData;
  tokens_used: number;
  last_raw_text?: string;
  call_trace: LabCallTrace;
};

export type ContentBodyFail = {
  ok: false;
  reason: string;
  tokens_used: number;
  last_raw_text?: string;
  call_trace?: LabCallTrace;
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
      const main_recommendation = str(root.main_recommendation);
      const conditions = str(root.conditions);
      const not_choosing = str(root.not_choosing);
      const evidence_pointer = str(root.evidence_pointer);
      if (!main_recommendation || !conditions || !not_choosing || !evidence_pointer) {
        return null;
      }
      return {
        ...base,
        page: "01",
        face: "01",
        main_recommendation,
        conditions,
        not_choosing,
        evidence_pointer,
      } as DeliveryPageData;
    }
    case "02": {
      const destiny_reason = str(root.destiny_reason);
      const science_mechanism = str(root.science_mechanism);
      const convergence = str(root.convergence);
      const verifiable_anchors = strList(root.verifiable_anchors);
      if (!destiny_reason || !science_mechanism || !convergence || !verifiable_anchors.length) {
        return null;
      }
      return {
        ...base,
        page: "02",
        face: "02",
        destiny_reason,
        science_mechanism,
        convergence,
        verifiable_anchors,
      } as DeliveryPageData;
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
      const bazi_slice = str(root.bazi_slice);
      if (!bazi_slice) return null;
      return {
        ...base,
        page: "03",
        face: "03",
        bazi_slice,
        ziwei_slice: str(root.ziwei_slice),
        contrast: str(root.contrast),
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
}): Promise<ContentBodyOk | ContentBodyFail> {
  const seg = input.finalize[input.key];
  const feed = pageFeedFlags(input.key, "body", {
    pivot_chart_path: input.pivot_chart_path,
    partner_bazi: input.partner_bazi,
  });
  const faceNative = isFaceDeliveryKey(input.key);
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
  const userFeed = [
    feedParts,
    input.acceptance_corrective?.trim() || "",
  ]
    .filter((s) => s?.trim())
    .join("\n\n");

  const zfpOmitted =
    !input.ziwei_fact_pack ||
    !(input.ziwei_fact_pack.patternHits?.length > 0);
  const { system, user } = buildV3BodyPrompt({
    key: input.key,
    locale: input.locale,
    core_conclusion: seg?.core_conclusion ?? "",
    judgment_lock: formatJudgmentLockForBody(
      input.deep_evidence_plan,
      input.key,
    ),
    book_judgment_pack_block: input.book_judgment_pack_block,
    user_feed: userFeed,
    zfpOmitted,
  });

  let tokens_used = 0;
  try {
    const { deliveryDispatchProviderBody } = await import(
      "@/lib/llm/pro/delivery/dispatch/provider-escape"
    );
    const provider = deliveryDispatchProviderBody(
      Math.max(1, input.dispatch_attempt ?? 1),
    );
    const result = await callLLM({
      call_type: "main_delivery",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: PAGE_SCHEMA_FILL_MAX_TOKENS,
      thinking_effort: input.thinking_effort ?? "high",
      timeout_ms: input.timeout_ms ?? DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      response_format: "json",
      session_id: input.session_id,
      temperature: 0.4,
      max_attempts: deliveryTransportMaxAttempts(),
      signal: input.signal,
      provider,
      phase_name: "content_body_v3",
    });
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
          phase: "content_body_v3",
          system,
          user,
          user_feed: userFeed,
          raw_text: text,
          result,
        }),
      };
    }
    const baseTrace = {
      phase: "content_body_v3",
      system,
      user,
      user_feed: userFeed,
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
        phase: "content_body_v3",
        system,
        user,
        user_feed: userFeed,
        raw_text: null,
      }),
    };
  }
}
