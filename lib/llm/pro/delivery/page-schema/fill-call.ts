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
 * Structural fill retries: fixed 1+1 (=2). Do not nest with outer phase retries —
 * quality fails refuse immediately; only clock/abort soft-walls re-enter.
 * @deprecated Prefer pageSchemaFillMaxAttempts() — kept for tests/import compat.
 */
export const PAGE_SCHEMA_FILL_MAX_ATTEMPTS = 2;

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
  /** P2 surface menu. */
  foundation_surface_feed?: string;
  science_means_feed?: string;
  metaphysics_moat_feed?: string;
  /** P5 fuse / RiskItem candidate menu. */
  risk_fuse_feed?: string;
  /** P6 tonight/day7/identity candidate menu. */
  close_ritual_feed?: string;
  /** Layer A/C: anchors already used on ready upstream pages. */
  prior_chart_anchors?: readonly string[];
  category_token_sets?: CategoryTokenSets | null;
  /** Full chart closed-set (buildStructuredInstanceInventory text). */
  structured_inventory?: string;
  /** Batch 3 compress mode + locked deep evidence. */
  fill_mode?: "full" | "compress";
  deep_evidence_plan?: DeepEvidencePlan | null;
  /** P4 moat: excerpt of ready science_action body. */
  p3_body_excerpt?: string;
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
    foundation_surface_feed: input.foundation_surface_feed,
    science_means_feed: input.science_means_feed,
    metaphysics_moat_feed: input.metaphysics_moat_feed,
    risk_fuse_feed: input.risk_fuse_feed,
    close_ritual_feed: input.close_ritual_feed,
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
    const { deliveryDispatchProviderBody, isProviderEscapeFailClass } = await import(
      "@/lib/llm/pro/delivery/dispatch/provider-escape"
    );
    const escapeAttempt =
      attempt >= 2 && isProviderEscapeFailClass(lastReason) ? 2 : 1;
    const provider = deliveryDispatchProviderBody(escapeAttempt);
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
        provider,
        phase_name: "page_schema_fill",
      });
      tokens_used += result.meta.tokens_used;
      const text = result.content?.trim() ?? "";
      const hitLength = result.meta.finish_reason === "length";
      // No bonus beyond 1+1 phase budget — length truncate counts as a failed admit.
      if (!text) {
        lastReason = "empty_response";
        console.warn("[delivery/page-schema-fill] empty_response", {
          key: input.key,
          attempt,
          finish_reason: result.meta.finish_reason ?? null,
          content_len: 0,
          completion_tokens: result.meta.completion_tokens ?? null,
          reasoning_tokens: result.meta.reasoning_tokens ?? null,
          generation_id: result.meta.generation_id ?? null,
          timeout_ms_used: input.timeout_ms ?? 120_000,
          hit_length: hitLength,
        });
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
        p3_body_excerpt:
          input.key === "metaphysics_action" ? input.p3_body_excerpt ?? null : undefined,
        // Layer C · soft only (notes/warn) — no hard retry loop
        priorAnchors: anchorTally.priorAnchors,
        inventoryTokens:
          inventoryTokens.length > 0 ? inventoryTokens : anchorTally.inventoryTokens,
        fillMode: fill_mode,
        // Always pass plan when present — moat type stamp is code SSOT (not compress-only).
        deepEvidencePlan: input.deep_evidence_plan ?? null,
      });
      if (!sanitized.ok) {
        lastReason = sanitized.reason;
        console.warn("[delivery/page-schema-fill] structural sanitize fail", {
          key: input.key,
          reason: sanitized.reason,
          notes: sanitized.notes,
          attempt,
          finish_reason: result.meta.finish_reason ?? null,
          content_len: text.length,
          completion_tokens: result.meta.completion_tokens ?? null,
          reasoning_tokens: result.meta.reasoning_tokens ?? null,
          generation_id: result.meta.generation_id ?? null,
          timeout_ms_used: input.timeout_ms ?? 120_000,
          sanitize_reason: sanitized.reason,
        });
        if (
          fill_mode === "compress" &&
          (sanitized.reason.startsWith("compress_body_jargon:") ||
            sanitized.reason.startsWith("compress_body_mingli:") ||
            sanitized.reason.startsWith("compress_body_off_lock:"))
        ) {
          user = `${userBase}\n\n【纠错·正文零专名】上一稿白话正文出现了命理专名（${sanitized.reason}）。用户可见字段必须零专名（锁定允许表里的词也不许进 strategy/means）；只把真词写在 chart_anchors；按「正文平替提示」改写。`;
        }
        if (!isStructuralSanitizeFailure(sanitized)) {
          break;
        }
        // Single corrective regen for literal wuxing / moat coverage (P4).
        if (
          input.key === "metaphysics_action" &&
          (sanitized.reason.includes("p4_literal") ||
            sanitized.reason.includes("p4_means") ||
            sanitized.reason.includes("p4_missing_moat") ||
            sanitized.reason.includes("p4_strategy_moat") ||
            sanitized.reason.includes("p4_body_echo_p3") ||
            sanitized.reason.includes("p4_science_exec_means") ||
            sanitized.reason.includes("p4_coach_pm_means"))
        ) {
          const lockHint =
            fill_mode === "compress" && input.deep_evidence_plan
              ? `\n【代码已锁定 moat_class】type 由后端按锁定表回填，勿空喊。你只需写对机制白话：${input.deep_evidence_plan.units
                  .filter((u) => u.moat_class)
                  .map((u) => `${u.path}=${u.moat_class}`)
                  .join("；") || "(无)"}——timing 写转折/窗口/切换；polarity 写补给/远离；archetype 写借势/开创/角色定位。`
              : "";
          user = `${userBase}\n\n【纠错·P4 质量·兜底】上一稿未过硬闸（${sanitized.reason}）。请按【P4 护城河手段候选菜单】重写 dimensions：strategy+means 须像东方调频（窗口/补给远离/借势站位），禁职场教练腔（周独处复盘/兼职顾问协议/止损计划/财务 KPI）与 P3 邮件/话术/日历换皮；禁物件补泻；禁止空壳降级出货。${lockHint}`;
        }
        if (
          sanitized.reason === "missing_page_title" ||
          sanitized.reason === "missing_page_subtitle"
        ) {
          user = `${userBase}\n\n【纠错·页眉】上一稿缺真实 page_title / page_subtitle（不可空、不可把固定标签「自我调频/破局策略…」原样当标题）。请写贴本案问题的主标题+副标题，目录才与其它页对齐。`;
        }
        if (
          input.key === "direct_answer" &&
          (sanitized.reason.startsWith("p1_") ||
            sanitized.reason === "missing_primary_or_backup_track" ||
            sanitized.reason === "missing_core_judgment")
        ) {
          user = `${userBase}\n\n【纠错·P1 质量】上一稿未过硬闸（${sanitized.reason}）。请重写：primary/backup 的 core_logic 须≥约240字且空行分成≥2段（目标380–560字/3–4段）；why/when/name 禁「—」与 Primary path/Backup path 占位；每轨 chart_anchors≥1；page_title/page_subtitle 贴本案。禁止空壳降级出货。`;
        }
        if (
          input.key === "foundation" &&
          (sanitized.reason === "why_cards_lt_4" ||
            sanitized.reason === "why_card_essence_too_thin" ||
            sanitized.reason === "missing_surface_or_essence" ||
            sanitized.reason.startsWith("all_content_units_missing") ||
            sanitized.reason.startsWith("cross_page_primary_anchor"))
        ) {
          user = `${userBase}\n\n【纠错·P2 质量·兜底】上一稿未过硬闸（${sanitized.reason}）。请按【P2 表象候选菜单】重写 why_cards：≥4 张不同 surface（可回溯菜单）；每卡 essence≥约80字命理扎根；chart_anchors≥1；末卡收束「因此主辅成立」。禁止编造剧情、禁止空壳降级出货。`;
        }
        if (
          input.key === "science_action" &&
          (sanitized.reason.includes("toolkit") ||
            sanitized.reason.includes("angles") ||
            sanitized.reason === "missing_primary_or_backup_toolkit" ||
            sanitized.reason.startsWith("all_content_units_missing") ||
            sanitized.reason.startsWith("cross_page_primary_anchor"))
        ) {
          user = `${userBase}\n\n【纠错·P3 质量·兜底】上一稿未过硬闸（${sanitized.reason}）。请按【P3 科学手段候选菜单】重写：主辅各 3 个 angle；每维 strategy+means 可回溯菜单；主轨≥1 条今晚可出示交付物；chart_anchors≥1；禁合同剧本/东方色向/空壳降级出货。`;
        }
        if (
          input.key === "risk_guard" &&
          (sanitized.reason === "circuit_breakers_incomplete" ||
            sanitized.reason.startsWith("all_content_units_missing") ||
            sanitized.reason.startsWith("cross_page_primary_anchor") ||
            sanitized.reason.includes("risk_item") ||
            sanitized.reason.includes("narrative"))
        ) {
          user = `${userBase}\n\n【纠错·P5 质量·兜底】上一稿未过硬闸（${sanitized.reason}）。请按【P5 熔断候选菜单】重写 6 条钉死槽：red_lights[2]+traps[1]+switch_to_backup+protection_rules[2]；每条 narrative 须点名菜单「执行面」之一（做 X 时若出现 Y…）；chart_anchors≥1；禁另立行动课/P6 出门仪式/空壳降级出货。`;
        }
        if (
          input.key === "signals_close" &&
          (sanitized.reason === "identity_close_incomplete" ||
            sanitized.reason === "day7_micro_actions_lt_4" ||
            sanitized.reason === "day7_item_incomplete" ||
            sanitized.reason === "takeaways_incomplete" ||
            sanitized.reason.startsWith("all_content_units_missing") ||
            sanitized.reason.startsWith("cross_page_primary_anchor"))
        ) {
          user = `${userBase}\n\n【纠错·P6 质量·兜底】上一稿未过硬闸（${sanitized.reason}）。请按【P6 出门候选菜单】重写：identity_shift+quote_use+今晚闭环(immediate/done/why)+day7×4({action,why,done_when})+takeaways×3；今晚/day7 须回溯菜单近阶茎；chart_anchors≥1；禁第三套药方/四周表/空壳降级出货。`;
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
