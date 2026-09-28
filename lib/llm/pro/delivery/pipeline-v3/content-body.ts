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

export type ContentBodyOk = {
  ok: true;
  page: DeliveryPageData;
  tokens_used: number;
  last_raw_text?: string;
};

export type ContentBodyFail = {
  ok: false;
  reason: string;
  tokens_used: number;
  last_raw_text?: string;
};

/** Minimal coerce so Lab/UI can preview — never quality-fail. */
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
    page_title: String(root.page_title ?? ""),
    page_subtitle: String(root.page_subtitle ?? ""),
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
}): Promise<ContentBodyOk | ContentBodyFail> {
  const seg = input.finalize[input.key];
  const feedParts = [
    input.primary_backup_hint,
    input.question_expectation,
    input.eastern_calc_slice,
    input.reality_constraints,
    input.foundation_surface_feed,
    input.science_means_feed,
    input.metaphysics_moat_feed,
    input.risk_fuse_feed,
    input.close_ritual_feed,
    input.structured_inventory?.slice(0, 6_000),
    input.action_brief
      ? `## action_brief\n${JSON.stringify(input.action_brief).slice(0, 2_000)}`
      : "",
    input.p3_body_excerpt?.trim()
      ? `## P3 正文摘录（P4/P5 对齐用）\n${input.p3_body_excerpt.trim().slice(0, 2_000)}`
      : "",
  ]
    .filter((s) => s?.trim())
    .join("\n\n");

  const { system, user } = buildV3BodyPrompt({
    key: input.key,
    locale: input.locale,
    core_conclusion: seg?.core_conclusion ?? "",
    judgment_lock: formatJudgmentLockForBody(input.deep_evidence_plan),
    user_feed: feedParts,
  });

  let tokens_used = 0;
  try {
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
      phase_name: "content_body_v3",
    });
    tokens_used += result.meta.tokens_used;
    const text = result.content?.trim() ?? "";
    if (!text) {
      return { ok: false, reason: "empty_response", tokens_used, last_raw_text: text };
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
      };
    }
    const page = coercePageSchemaLoose(input.key, parsed);
    if (!page) {
      return {
        ok: false,
        reason: "coerce_failed",
        tokens_used,
        last_raw_text: text.slice(0, 12_000),
      };
    }
    return { ok: true, page, tokens_used, last_raw_text: text.slice(0, 12_000) };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "llm_error",
      tokens_used,
    };
  }
}
