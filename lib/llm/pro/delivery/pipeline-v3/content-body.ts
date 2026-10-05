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

  if (key === "direct_answer") {
    const primary = coerceTrack(root.primary, "primary");
    const backup = coerceTrack(root.backup, "backup");
    const core_judgment = String(
      root.core_judgment ?? root.core ?? "",
    ).trim();
    // Wrong shape (dimensions prose) → fail coerce so Lab sees transport-level miss.
    if (!primary || !backup || !core_judgment) return null;
    return {
      page: "direct_answer",
      page_title,
      page_subtitle,
      core_judgment,
      primary,
      backup,
      evidence: [],
    } as unknown as DeliveryPageData;
  }

  if (key === "foundation") {
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
      page: "foundation",
      page_title,
      page_subtitle,
      why_cards,
      evidence: [],
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
  action_brief?: P5ActionBrief | null;
  primary_backup_hint?: string;
  question_expectation?: string;
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
  /** ≥2 after Lab transport stall → provider escape. */
  dispatch_attempt?: number;
}): Promise<ContentBodyOk | ContentBodyFail> {
  const seg = input.finalize[input.key];
  const feed = pageFeedFlags(input.key, "body");
  let feedParts = [
    feed.thesis_factpack && input.chart_thesis_block?.trim()
      ? `## 命盘总纲（主辅必须从此可推；删掉后主张应垮）\n${input.chart_thesis_block.trim()}`
      : "",
    feed.thesis_factpack && input.chart_fact_pack?.trim()
      ? `## 本盘 Fact-pack（闭集真算）\n${input.chart_fact_pack.trim().slice(0, 4_000)}`
      : "",
    feed.primary_backup_hint && input.primary_backup_hint?.trim()
      ? input.primary_backup_hint.trim()
      : "",
    feed.question_expectation ? input.question_expectation : "",
    // P4 正文：奇门已在 Fact-pack + moat；禁再灌 eastern_calc（fill 派工全文含 Q·E/多维「用兼职节奏」等 priming）
    feed.qimen && input.key !== "metaphysics_action"
      ? input.eastern_calc_slice
      : "",
    feed.reality ? input.reality_constraints : "",
    feed.foundation_surface ? input.foundation_surface_feed : "",
    feed.science_means ? input.science_means_feed : "",
    feed.metaphysics_moat ? input.metaphysics_moat_feed : "",
    feed.risk_fuse ? input.risk_fuse_feed : "",
    feed.close_ritual ? input.close_ritual_feed : "",
    feed.structured_inventory
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
  if (input.key !== "metaphysics_action") {
    feedParts = scrubJudgmentFeedPrescriptions(feedParts);
  }
  if (!feed.qimen) {
    feedParts = stripQimenBlocksUnlessPageAllows(feedParts);
  }
  // P4 正文：组装后再剥试水/权责 priming（duty 不枚举这些词教模型写否定句）
  if (input.key === "metaphysics_action") {
    feedParts = scrubP4BodyFeedPriming(feedParts);
  }
  const userFeed = feedParts;

  const { system, user } = buildV3BodyPrompt({
    key: input.key,
    locale: input.locale,
    core_conclusion: seg?.core_conclusion ?? "",
    judgment_lock: formatJudgmentLockForBody(
      input.deep_evidence_plan,
      input.key,
    ),
    user_feed: userFeed,
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
    const text = result.content?.trim() ?? "";
    const baseTrace = {
      phase: "content_body_v3",
      system,
      user,
      user_feed: userFeed,
      result,
    };
    if (!text) {
      return {
        ok: false,
        reason: "empty_response",
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
        reason: "json_parse_failed",
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
