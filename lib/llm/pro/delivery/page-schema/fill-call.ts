/**
 * Structured JSON page fill — sanitize + structural-only LLM retry (≤2).
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliveryComputed, DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_WRITE_MAX_TOKENS } from "@/lib/llm/pro/delivery/delivery-tasks";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import { sanitizePageJson, isStructuralSanitizeFailure, parseAllowedDashboardScoresFromHints } from "./sanitize";
import { buildPageSchemaFillPrompt, type PageSchemaFillPromptOpts } from "./fill-prompt";
import {
  pageSchemaFillMaxAttempts,
  resolveDeliveryFillShapeMode,
} from "./fill-shape-mode";
import type { DeliveryPageData, P5ActionBrief, P5WeekSummary } from "./types";

/**
 * Structural fill retries only (not length).
 * Gate 0 grayscale: skeleton mode uses 3; mock stays 2. Restore skeleton→2 when stable.
 * @deprecated Prefer pageSchemaFillMaxAttempts() — kept for tests/import compat.
 */
export const PAGE_SCHEMA_FILL_MAX_ATTEMPTS = 3;

export type PageSchemaFillOk = {
  ok: true;
  page: DeliveryPageData;
  tokens_used: number;
  attempts: number;
  truncated: boolean;
};

export type PageSchemaFillFail = {
  ok: false;
  reason: string;
  tokens_used: number;
  attempts: number;
};

export type PageSchemaFillResult = PageSchemaFillOk | PageSchemaFillFail;

export async function runPageSchemaFill(input: {
  key: DeliverySegmentKey;
  finalize: DeliveryComputed;
  locale: string;
  session_id?: string;
  signal?: AbortSignal;
  timeout_ms?: number;
  action_brief?: P5ActionBrief | null;
  week_summary?: P5WeekSummary | null;
  dashboard_score_hints?: string;
  primary_backup_hint?: string;
  question_expectation?: string;
  eastern_calc_slice?: string;
  risk_calc_slice?: string;
  page_plan_slice?: string;
  reality_constraints?: string;
}): Promise<PageSchemaFillResult> {
  const seg = input.finalize[input.key];
  const shapeMode = resolveDeliveryFillShapeMode();
  const maxAttempts = pageSchemaFillMaxAttempts(shapeMode);
  const promptOpts: PageSchemaFillPromptOpts = {
    locale: input.locale,
    core_conclusion: seg?.core_conclusion ?? "",
    bazi_basis: seg?.bazi_basis,
    action_brief: input.action_brief,
    week_summary: input.week_summary,
    dashboard_score_hints: input.dashboard_score_hints,
    primary_backup_hint: input.primary_backup_hint,
    question_expectation: input.question_expectation,
    eastern_calc_slice: input.eastern_calc_slice,
    risk_calc_slice: input.risk_calc_slice,
    page_plan_slice: input.page_plan_slice,
    reality_constraints: input.reality_constraints,
    shape_mode: shapeMode,
  };
  const { system, user: userBase } = buildPageSchemaFillPrompt(input.key, promptOpts);

  let tokens_used = 0;
  let lastReason = "unknown";
  let user = userBase;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (input.signal?.aborted) {
      return { ok: false, reason: "aborted", tokens_used, attempts: attempt };
    }
    try {
      const result = await callLLM({
        call_type: "main_delivery",
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: DELIVERY_WRITE_MAX_TOKENS,
        thinking_effort: "high",
        timeout_ms: input.timeout_ms ?? 120_000,
        response_format: "json",
        session_id: input.session_id,
        temperature: 0.4,
        max_attempts: deliveryTransportMaxAttempts(),
        signal: input.signal,
      });
      tokens_used += result.meta.tokens_used;
      const text = result.content?.trim() ?? "";
      if (!text) {
        lastReason = "empty_response";
        continue;
      }
      let parsed: unknown;
      try {
        parsed = extractJson(text);
      } catch {
        lastReason = "json_parse_failed";
        console.warn("[delivery/page-schema-fill] json_parse_failed", {
          key: input.key,
          attempt,
          head: text.slice(0, 200),
        });
        continue;
      }
      // Unwrap accidental { foundation: {...} } wrappers
      const root =
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        input.key in (parsed as object) &&
        !("page" in (parsed as object))
          ? (parsed as Record<string, unknown>)[input.key]
          : parsed;

      const sanitized = sanitizePageJson(input.key, root, {
        allowedDashboardScores:
          input.key === "foundation"
            ? parseAllowedDashboardScoresFromHints(input.dashboard_score_hints)
            : undefined,
        eastern_calc_slice:
          input.key === "metaphysics_action" ? input.eastern_calc_slice : undefined,
      });
      if (!sanitized.ok) {
        lastReason = sanitized.reason;
        console.warn("[delivery/page-schema-fill] structural sanitize fail", {
          key: input.key,
          reason: sanitized.reason,
          notes: sanitized.notes,
          attempt,
        });
        if (!isStructuralSanitizeFailure(sanitized)) {
          break;
        }
        // Single corrective regen for literal wuxing / means-order (P4).
        if (
          input.key === "metaphysics_action" &&
          (sanitized.reason.includes("p4_literal") ||
            sanitized.reason.includes("p4_means"))
        ) {
          user = `${userBase}\n\n【纠错·反物化】上一稿把五行补泻写成了物件/水景/绿植/晒太阳或缺少节奏/气质类行动。请重写 dimensions[].means：每条可为 { "text": "...", "type": "rhythm"|"mindset"|"symbol"|"field" }；前两条必须是 rhythm/mindset（状态/节奏/决策气质）；symbol/field 最多各一条且置后；禁止流水摆件、水边、绿植、多晒太阳等物化主手段。`;
        }
        continue;
      }
      console.info("[delivery/page-schema-fill] ok", {
        key: input.key,
        attempt,
        truncated: sanitized.truncated,
        notes: sanitized.notes,
      });
      return {
        ok: true,
        page: sanitized.page,
        tokens_used,
        attempts: attempt,
        truncated: sanitized.truncated,
      };
    } catch (e) {
      lastReason = e instanceof Error ? e.message : "llm_error";
      console.warn("[delivery/page-schema-fill] call error", {
        key: input.key,
        attempt,
        reason: lastReason,
      });
    }
  }

  return {
    ok: false,
    reason: `page_schema_fill:${lastReason}`,
    tokens_used,
    attempts: maxAttempts,
  };
}
