/**
 * Structured JSON page fill — sanitize + structural-only LLM retry (≤2).
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliveryComputed, DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { PAGE_SCHEMA_FILL_MAX_TOKENS } from "@/lib/llm/pro/delivery/delivery-tasks";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import { sanitizePageJson, isStructuralSanitizeFailure, parseAllowedDashboardScoresFromHints } from "./sanitize";
import { buildPageSchemaFillPrompt, type PageSchemaFillPromptOpts } from "./fill-prompt";
import {
  pageSchemaFillMaxAttempts,
  resolveDeliveryFillShapeMode,
} from "./fill-shape-mode";
import type { DeliveryPageData, P5ActionBrief, P5WeekSummary } from "./types";
import type { CategoryTokenSets } from "./anchor-category-tally";
import { tallyAnchorCategoryUsage } from "./anchor-category-tally";
import { mergeInventoryTokens } from "./layer-b-inventory-menu";
import {
  formatDeepEvidencePlanForCompress,
  type DeepEvidencePlan,
} from "./deep-evidence-call";

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
  /** Override thinking — heavy pages use medium to cut wall clock. */
  thinking_effort?: "off" | "low" | "medium" | "high" | "xhigh";
  action_brief?: P5ActionBrief | null;
  week_summary?: P5WeekSummary | null;
  dashboard_score_hints?: string;
  primary_backup_hint?: string;
  question_expectation?: string;
  eastern_calc_slice?: string;
  risk_calc_slice?: string;
  page_plan_slice?: string;
  reality_constraints?: string;
  /** Layer A/C: anchors already used on ready upstream pages. */
  prior_chart_anchors?: readonly string[];
  category_token_sets?: CategoryTokenSets | null;
  /** Full chart closed-set (buildStructuredInstanceInventory text). */
  structured_inventory?: string;
  /** Batch 3 compress mode + locked deep evidence. */
  fill_mode?: "full" | "compress";
  deep_evidence_plan?: DeepEvidencePlan | null;
}): Promise<PageSchemaFillResult> {
  const seg = input.finalize[input.key];
  const shapeMode = resolveDeliveryFillShapeMode();
  const maxAttempts = pageSchemaFillMaxAttempts(shapeMode);
  const fill_mode = input.fill_mode ?? "full";
  const deepLock =
    fill_mode === "compress" && input.deep_evidence_plan
      ? formatDeepEvidencePlanForCompress(input.deep_evidence_plan)
      : undefined;
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
    prior_chart_anchors: input.prior_chart_anchors,
    category_token_sets: input.category_token_sets,
    structured_inventory: input.structured_inventory,
    fill_mode,
    deep_evidence_lock: deepLock,
    shape_mode: shapeMode,
  };
  const anchorTally = tallyAnchorCategoryUsage(
    input.prior_chart_anchors ?? [],
    input.category_token_sets,
  );
  const inventoryTokens = mergeInventoryTokens(
    input.category_token_sets,
    input.structured_inventory,
  );
  const { system, user: userBase } = buildPageSchemaFillPrompt(input.key, promptOpts);

  let tokens_used = 0;
  let lastReason = "unknown";
  let user = userBase;
  let attemptBudget = maxAttempts;

  for (let attempt = 1; attempt <= attemptBudget; attempt++) {
    if (input.signal?.aborted) {
      return { ok: false, reason: "aborted", tokens_used, attempts: attempt };
    }
    try {
      const result = await callLLM({
        call_type: "main_delivery",
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: PAGE_SCHEMA_FILL_MAX_TOKENS,
        thinking_effort: input.thinking_effort ?? "high",
        timeout_ms: input.timeout_ms ?? 120_000,
        response_format: "json",
        session_id: input.session_id,
        temperature: 0.4,
        max_attempts: deliveryTransportMaxAttempts(),
        signal: input.signal,
      });
      tokens_used += result.meta.tokens_used;
      const text = result.content?.trim() ?? "";
      const hitLength = result.meta.finish_reason === "length";
      const grantLengthBonus =
        hitLength && attempt === attemptBudget && attemptBudget === maxAttempts;
      if (!text) {
        lastReason = "empty_response";
        if (grantLengthBonus) {
          attemptBudget = maxAttempts + 1;
          console.warn("[delivery/page-schema-fill] finish_reason=length + empty — one bonus retry", {
            key: input.key,
            attempt,
          });
        }
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
          finish_reason: result.meta.finish_reason ?? null,
          head: text.slice(0, 200),
        });
        if (grantLengthBonus) {
          attemptBudget = maxAttempts + 1;
          console.warn("[delivery/page-schema-fill] finish_reason=length + bad JSON — one bonus retry", {
            key: input.key,
            attempt,
            completion_tokens: result.meta.completion_tokens ?? null,
          });
        }
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
        // Layer C · soft only (notes/warn) — no hard retry loop
        priorAnchors: anchorTally.priorAnchors,
        inventoryTokens:
          inventoryTokens.length > 0 ? inventoryTokens : anchorTally.inventoryTokens,
        fillMode: fill_mode,
      });
      if (!sanitized.ok) {
        lastReason = sanitized.reason;
        console.warn("[delivery/page-schema-fill] structural sanitize fail", {
          key: input.key,
          reason: sanitized.reason,
          notes: sanitized.notes,
          attempt,
        });
        if (
          fill_mode === "compress" &&
          sanitized.reason.startsWith("compress_body_jargon:")
        ) {
          user = `${userBase}\n\n【纠错·正文禁词】上一稿白话正文仍有未映射命理残词（${sanitized.reason}）。请重写页内可见字段：零命理原词；chart_anchors 必须原样保留锁定清单。`;
        }
        if (!isStructuralSanitizeFailure(sanitized)) {
          break;
        }
        if (grantLengthBonus) {
          attemptBudget = maxAttempts + 1;
          console.warn("[delivery/page-schema-fill] finish_reason=length + structural fail — one bonus retry", {
            key: input.key,
            attempt,
            reason: sanitized.reason,
          });
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
        fill_mode,
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
