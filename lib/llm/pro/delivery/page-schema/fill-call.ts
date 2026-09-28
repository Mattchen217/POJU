/**
 * Structured JSON page fill — sanitize + structural-only LLM retry (≤2).
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliveryComputed, DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  DELIVERY_SINGLE_CALL_TIMEOUT_MS,
  PAGE_SCHEMA_FILL_MAX_TOKENS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import { sanitizePageJson, isStructuralSanitizeFailure, parseAllowedDashboardScoresFromHints } from "./sanitize";
import { buildPageSchemaFillPrompt, type PageSchemaFillPromptOpts } from "./fill-prompt";
import {
  pageSchemaFillMaxAttempts,
  resolveDeliveryFillShapeMode,
} from "./fill-shape-mode";
import type { DeliveryPageData, P5ActionBrief, P5WeekSummary } from "./types";
import type { CategoryTokenSets } from "./anchor-category-tally";
import { allowEmptyChartAnchorsOnFill } from "./anchor-quality";
import { tallyAnchorCategoryUsage } from "./anchor-category-tally";
import { mergeInventoryTokens } from "./layer-b-inventory-menu";
import {
  formatDeepEvidencePlanForCompress,
  type DeepEvidencePlan,
} from "./deep-evidence-call";
import {
  buildP4FillChunks,
  formatP4FillChunkUserHint,
  shouldChunkP4CompressFill,
  sliceDeepEvidencePlanForFillChunk,
} from "./fill-p4-chunk";

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
  /** Present on chunk-collect partials (internal). */
  last_raw_text?: string;
};

export type PageSchemaFillFail = {
  ok: false;
  reason: string;
  tokens_used: number;
  attempts: number;
  /** Last model text (Lab debug) when structure/sanitize failed. */
  last_raw_text?: string;
  sanitize_notes?: string[];
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
  /**
   * Internal: skip auto P4 fill chunking (used by chunked driver for full-page fallback).
   */
  _skip_p4_fill_chunk?: boolean;
}): Promise<PageSchemaFillResult> {
  const fill_mode = input.fill_mode ?? "full";
  if (
    !input._skip_p4_fill_chunk &&
    shouldChunkP4CompressFill(input.key, fill_mode, input.deep_evidence_plan)
  ) {
    return runP4CompressFillChunked(input);
  }
  return runPageSchemaFillOnce(input);
}

async function runP4CompressFillChunked(
  input: Parameters<typeof runPageSchemaFill>[0],
): Promise<PageSchemaFillResult> {
  const plan = input.deep_evidence_plan!;
  const chunks = buildP4FillChunks(plan);
  let tokens_used = 0;
  let attempts = 0;
  let lastRawText = "";
  const dimByPath = new Map<string, Record<string, unknown>>();
  let chrome: {
    page_title?: string;
    page_subtitle?: string;
    question_anchor?: string;
    desired_outcome?: string;
  } = {};

  console.info("[delivery/page-schema-fill] P4 compress chunked", {
    units: plan.units.length,
    chunks: chunks.length,
    chunk_size: chunks[0]?.length ?? 0,
  });

  for (let i = 0; i < chunks.length; i++) {
    const chunkUnits = chunks[i]!;
    const paths = chunkUnits.map((u) => u.path);
    const subPlan = sliceDeepEvidencePlanForFillChunk(plan, chunkUnits);
    const chunkHint = formatP4FillChunkUserHint({
      index: i,
      total: chunks.length,
      include_page_chrome: i === 0,
      parent_unit_count: plan.units.length,
      paths,
    });
    const partial = await runPageSchemaFillOnce({
      ...input,
      deep_evidence_plan: subPlan,
      _skip_p4_fill_chunk: true,
      _p4_chunk_collect: {
        index: i,
        total: chunks.length,
        include_page_chrome: i === 0,
        expected_paths: paths,
        user_hint: chunkHint,
      },
    });
    tokens_used += partial.tokens_used;
    attempts += partial.attempts;
    if (!partial.ok) {
      return {
        ...partial,
        tokens_used,
        attempts,
        reason: `page_schema_fill:p4_chunk_${i}:${partial.reason.replace(/^page_schema_fill:/, "")}`,
      };
    }
    lastRawText = partial.last_raw_text ?? lastRawText;
    const page = partial.page as Record<string, unknown>;
    if (i === 0) {
      chrome = {
        page_title: String(page.page_title ?? ""),
        page_subtitle: String(page.page_subtitle ?? ""),
        question_anchor: String(page.question_anchor ?? ""),
        desired_outcome: String(page.desired_outcome ?? ""),
      };
    }
    const dims = Array.isArray(page.dimensions) ? page.dimensions : [];
    for (let di = 0; di < dims.length; di++) {
      const d = dims[di];
      if (!d || typeof d !== "object") continue;
      const path = paths[di] ?? `dimensions[${di}]`;
      dimByPath.set(path, d as Record<string, unknown>);
    }
  }

  const orderedDims = plan.units.map((u, i) => {
    const d = dimByPath.get(u.path);
    if (d) return d;
    return {
      name: `维${i + 1}`,
      strategy: "（分枪缺维）",
      means: ["（分枪缺维）", "（分枪缺维）"],
      chart_anchors: [],
    };
  });
  if (orderedDims.some((d) => String(d.strategy ?? "").includes("分枪缺维"))) {
    console.warn("[delivery/page-schema-fill] P4 chunk missing dims — fallback full fill");
    return runPageSchemaFillOnce({ ...input, _skip_p4_fill_chunk: true });
  }

  const mergedRoot = {
    page: "metaphysics_action",
    page_title: chrome.page_title,
    page_subtitle: chrome.page_subtitle,
    question_anchor: chrome.question_anchor,
    desired_outcome: chrome.desired_outcome,
    dimensions: orderedDims,
    leverage: [],
    avoid: [],
    field_matrix: [],
    evidence: [],
  };

  const mergeSanitize = await sanitizeMergedP4Fill(input, mergedRoot);
  tokens_used += 0;
  if (mergeSanitize.ok) {
    console.info("[delivery/page-schema-fill] P4 chunked merge ok", {
      chunks: chunks.length,
      attempts,
      notes: mergeSanitize.notes.slice(0, 12),
    });
    return {
      ok: true,
      page: mergeSanitize.page,
      tokens_used,
      attempts: Math.max(1, attempts),
      truncated: mergeSanitize.truncated,
    };
  }

  // Chunked draft failed page gates — one full-page corrective (same 1+1 budget class).
  console.warn("[delivery/page-schema-fill] P4 chunked merge fail → full fallback", {
    reason: mergeSanitize.reason,
  });
  const fallback = await runPageSchemaFillOnce({
    ...input,
    _skip_p4_fill_chunk: true,
    _p4_chunk_merge_fail_hint: mergeSanitize.reason,
  });
  return {
    ...fallback,
    tokens_used: tokens_used + fallback.tokens_used,
    attempts: attempts + fallback.attempts,
  };
}

async function sanitizeMergedP4Fill(
  input: Parameters<typeof runPageSchemaFill>[0],
  root: unknown,
): Promise<
  | { ok: true; page: DeliveryPageData; truncated: boolean; notes: string[] }
  | { ok: false; reason: string; notes: string[] }
> {
  const anchorTally = tallyAnchorCategoryUsage(
    input.prior_chart_anchors ?? [],
    input.category_token_sets,
  );
  const inventoryTokens = mergeInventoryTokens(
    input.category_token_sets,
    input.structured_inventory,
  );
  const sanitized = sanitizePageJson(input.key, root, {
    eastern_calc_slice: input.eastern_calc_slice,
    p3_body_excerpt: input.p3_body_excerpt ?? null,
    priorAnchors: anchorTally.priorAnchors,
    categoryTokenSets: input.category_token_sets ?? undefined,
    inventoryTokens:
      inventoryTokens.length > 0 ? inventoryTokens : anchorTally.inventoryTokens,
    fillMode: "compress",
    deepEvidencePlan: input.deep_evidence_plan ?? null,
  });
  if (!sanitized.ok) {
    return { ok: false, reason: sanitized.reason, notes: sanitized.notes };
  }
  return {
    ok: true,
    page: sanitized.page,
    truncated: sanitized.truncated,
    notes: sanitized.notes,
  };
}

async function runPageSchemaFillOnce(input: {
  key: DeliverySegmentKey;
  finalize: DeliveryComputed;
  locale: string;
  session_id?: string;
  signal?: AbortSignal;
  timeout_ms?: number;
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
  foundation_surface_feed?: string;
  science_means_feed?: string;
  metaphysics_moat_feed?: string;
  risk_fuse_feed?: string;
  close_ritual_feed?: string;
  prior_chart_anchors?: readonly string[];
  category_token_sets?: CategoryTokenSets | null;
  structured_inventory?: string;
  fill_mode?: "full" | "compress";
  deep_evidence_plan?: DeepEvidencePlan | null;
  p3_body_excerpt?: string;
  _skip_p4_fill_chunk?: boolean;
  _p4_chunk_collect?: {
    index: number;
    total: number;
    include_page_chrome: boolean;
    expected_paths: readonly string[];
    user_hint: string;
  };
  _p4_chunk_merge_fail_hint?: string;
}): Promise<PageSchemaFillResult & { last_raw_text?: string }> {
  const seg = input.finalize[input.key];
  const shapeMode = resolveDeliveryFillShapeMode();
  const maxAttempts = pageSchemaFillMaxAttempts(shapeMode);
  const fill_mode = input.fill_mode ?? "full";
  const deepPlan = input.deep_evidence_plan;
  const deepLock =
    fill_mode === "compress" && deepPlan
      ? formatDeepEvidencePlanForCompress(deepPlan)
      : undefined;
  const plainJudgment =
    fill_mode === "compress" && allowEmptyChartAnchorsOnFill(input.key, deepPlan);
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
    plain_judgment: plainJudgment,
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
  const { system, user: userBase0 } = buildPageSchemaFillPrompt(input.key, promptOpts);
  let userBase = userBase0;
  if (input._p4_chunk_collect?.user_hint) {
    userBase = `${userBase0}\n\n${input._p4_chunk_collect.user_hint}`;
  }
  if (input._p4_chunk_merge_fail_hint) {
    userBase = `${userBase0}\n\n【纠错·P4 分枪合并未过闸】${input._p4_chunk_merge_fail_hint}。请一次写满整页锁定维数：局势看透（敌虚实+攻守+近窗/节奏差）；意象/仪轨/站位维名分工；动作整页不复读；按本维批断自写 means；禁 P3 交付物。`;
  }

  let tokens_used = 0;
  let lastReason = "unknown";
  let user = userBase;
  let attemptBudget = input._p4_chunk_collect ? 1 : maxAttempts;
  let lastRawText = "";
  let lastSanitizeNotes: string[] = [];
  const fillStartedAt = Date.now();
  const timeoutCeiling = input.timeout_ms ?? DELIVERY_SINGLE_CALL_TIMEOUT_MS;
  const FILL_RETRY_MIN_REMAINING_MS = 90_000;

  for (let attempt = 1; attempt <= attemptBudget; attempt++) {
    if (input.signal?.aborted) {
      return {
        ok: false,
        reason: "aborted",
        tokens_used,
        attempts: attempt,
        last_raw_text: lastRawText || undefined,
        sanitize_notes: lastSanitizeNotes.length ? lastSanitizeNotes : undefined,
      };
    }
    const remainingMs = Math.max(0, timeoutCeiling - (Date.now() - fillStartedAt));
    if (attempt >= 2 && remainingMs < FILL_RETRY_MIN_REMAINING_MS) {
      console.warn("[delivery/page-schema-fill] skip retry — budget too thin", {
        key: input.key,
        lastReason,
        remaining_ms: remainingMs,
        min_remaining_ms: FILL_RETRY_MIN_REMAINING_MS,
      });
      break;
    }
    const callTimeoutMs = Math.min(
      timeoutCeiling,
      Math.max(30_000, remainingMs > 0 ? remainingMs - 12_000 : timeoutCeiling),
    );
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
        timeout_ms: callTimeoutMs,
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
      lastRawText = text;
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
          timeout_ms_used: callTimeoutMs,
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

      // P4 fill chunk collect: skip page-level moat gates (partial dims).
      if (input._p4_chunk_collect) {
        const o =
          root && typeof root === "object" && !Array.isArray(root)
            ? (root as Record<string, unknown>)
            : {};
        const dimsRaw = Array.isArray(o.dimensions) ? o.dimensions : [];
        const expected = input._p4_chunk_collect.expected_paths;
        if (dimsRaw.length < expected.length) {
          lastReason = `p4_chunk_dims_lt_${expected.length}`;
          continue;
        }
        const page = {
          page: "metaphysics_action",
          page_title: String(o.page_title ?? ""),
          page_subtitle: String(o.page_subtitle ?? ""),
          question_anchor: String(o.question_anchor ?? ""),
          desired_outcome: String(o.desired_outcome ?? ""),
          dimensions: dimsRaw.slice(0, expected.length),
          leverage: [],
          avoid: [],
          field_matrix: [],
          evidence: [],
        };
        console.info("[delivery/page-schema-fill] P4 chunk collect ok", {
          chunk: `${input._p4_chunk_collect.index + 1}/${input._p4_chunk_collect.total}`,
          dims: expected.length,
        });
        return {
          ok: true,
          page: page as DeliveryPageData,
          tokens_used,
          attempts: attempt,
          truncated: hitLength,
          last_raw_text: lastRawText,
        };
      }

      const foundationAgendaMaterial =
        input.key === "foundation"
          ? [
              input.foundation_surface_feed,
              input.question_expectation,
              input.reality_constraints,
              seg?.core_conclusion,
            ]
              .filter((s) => s?.trim())
              .join("\n")
          : "";
      const sanitized = sanitizePageJson(input.key, root, {
        allowedDashboardScores:
          input.key === "foundation"
            ? parseAllowedDashboardScoresFromHints(input.dashboard_score_hints)
            : undefined,
        eastern_calc_slice:
          input.key === "metaphysics_action" ? input.eastern_calc_slice : undefined,
        p3_body_excerpt:
          input.key === "metaphysics_action" ? input.p3_body_excerpt ?? null : undefined,
        // Layer C · unit echo soft; hard gate = write Jaccard SSOT
        priorAnchors: anchorTally.priorAnchors,
        categoryTokenSets: input.category_token_sets ?? undefined,
        inventoryTokens:
          inventoryTokens.length > 0 ? inventoryTokens : anchorTally.inventoryTokens,
        fillMode: fill_mode,
        // Always pass plan when present — moat type stamp is code SSOT (not compress-only).
        deepEvidencePlan: input.deep_evidence_plan ?? null,
        situationMaterial:
          input.key === "foundation"
            ? plainJudgment
              ? foundationAgendaMaterial
              : input.foundation_surface_feed
            : undefined,
        plainJudgmentFill: input.key === "foundation" && plainJudgment,
        closeRitualFeed:
          input.key === "signals_close" ? input.close_ritual_feed ?? null : undefined,
      });
      if (!sanitized.ok) {
        lastReason = sanitized.reason;
        lastSanitizeNotes = sanitized.notes;
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
          timeout_ms_used: callTimeoutMs,
          sanitize_reason: sanitized.reason,
        });
        if (
          fill_mode === "compress" &&
          (sanitized.reason.startsWith("compress_body_jargon:") ||
            sanitized.reason.startsWith("compress_body_mingli:") ||
            sanitized.reason.startsWith("compress_body_off_lock:"))
        ) {
          user = plainJudgment
            ? `${userBase}\n\n【纠错·正文零专名】上一稿白话正文出现了命理专名（${sanitized.reason}）。用户可见字段必须零专名；chart_anchors 留空；只翻译已锁定批断，按白话改写，禁止打标。`
            : `${userBase}\n\n【纠错·正文零专名】上一稿白话正文出现了命理专名（${sanitized.reason}）。用户可见字段必须零专名（锁定允许表里的词也不许进 strategy/means）；只把真词写在 chart_anchors；按「正文平替提示」改写。`;
        }
        if (!isStructuralSanitizeFailure(sanitized)) {
          break;
        }
        // Type-coverage failures are repaired in sanitize (stamp + vernacular enrich).
        // A second identical LLM call is gate-theater — stop the fill loop.
        if (
          input.key === "metaphysics_action" &&
          sanitized.reason.includes("p4_missing_moat")
        ) {
          break;
        }
        // Cross-page Jaccard already decided at write; fill compress cannot invent
        // new primaries — LLM retry won't clear it (rule 11).
        if (sanitized.reason.startsWith("cross_page_primary_anchor")) {
          break;
        }
        // Single corrective regen for content-shape fails (P3 echo / coach PM / literal).
        // Type-coverage (p4_missing_moat) is fixed by stamp + vernacular enrich in sanitize —
        // do not burn another LLM round for keyword theater (see rule 11).
        if (
          input.key === "metaphysics_action" &&
          (sanitized.reason.includes("p4_literal") ||
            sanitized.reason.includes("p4_means") ||
            sanitized.reason.includes("p4_strategy_moat") ||
            sanitized.reason.includes("p4_body_echo_p3") ||
            sanitized.reason.includes("p4_science_exec_means") ||
            sanitized.reason.includes("p4_coach_pm_means") ||
            sanitized.reason.includes("p4_p3_tool_word_family") ||
            sanitized.reason.includes("p4_qimen_lock_missing") ||
            sanitized.reason.includes("p4_generic_means") ||
            sanitized.reason.includes("p4_means_thin") ||
            sanitized.reason.includes("p4_density")) &&
          !sanitized.reason.includes("p4_missing_moat")
        ) {
          const lockHint =
            fill_mode === "compress" && input.deep_evidence_plan
              ? `\n【代码已锁定 moat_class】type 由后端按锁定表回填，勿空喊。你只需写对机制白话：${input.deep_evidence_plan.units
                  .filter((u) => u.moat_class)
                  .map((u) => `${u.path}=${u.moat_class}`)
                  .join("；") || "(无)"}——timing 写局势/窗口/攻守；polarity 写意象/静润/立界；archetype 写借势站位/仪轨。`
              : "";
          user = `${userBase}\n\n【纠错·P4 东方谋略·兜底】上一稿未过硬闸（${sanitized.reason}）。P4 只写暗锦囊「局势/意象/仪轨」：按本维批断 +【P4 东方谋略约束帧】**自写** means（禁抄跨案套话）。禁止合同/条款/股权/律师/Excel/OKR/谈判剧本（P3 工具词族）。**禁止**试水期/验证期/技术交付换筹码/不可替代性证明/每周固定工时清单；主辅兼职全职最多开篇锚一句，means 改写为气口/结界/攻守/藏隐/静润。仪轨禁倒水窗边深呼吸默认模板。须有奇门锁盘真算进依据。每维 means≥2 且剥掉职场壳后仍≥2。dimensions=锁定表条数。删掉奇门/用忌/站位后若仍像职场建议=废稿。每条 means 须能被本维批断证明。${lockHint}`;
        }
        if (
          sanitized.reason === "missing_page_title" ||
          sanitized.reason === "missing_page_subtitle"
        ) {
          user = `${userBase}\n\n【纠错·页眉】上一稿缺真实 page_title / page_subtitle（不可空、不可把固定标签「东方谋略/破局策略…」原样当标题）。请写贴本案问题的主标题+副标题，目录才与其它页对齐。`;
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
            sanitized.reason === "page_title_situation_paste" ||
            sanitized.reason.startsWith("surface_situation_paste:") ||
            sanitized.reason.startsWith("fill_action_prescription:") ||
            sanitized.reason.startsWith("fill_soft_frame:") ||
            sanitized.reason.startsWith("all_content_units_missing") ||
            sanitized.reason.startsWith("cross_page_primary_anchor"))
        ) {
          user = plainJudgment
            ? `${userBase}\n\n【纠错·P2 质量】上一稿未过硬闸（${sanitized.reason}）。why_cards[i] 只译第 i 条 professional_evidence；surface/essence 零命理词；禁止处境/问题/决策句；禁止软框架与行动处方；page_title 不复述用户问题。chart_anchors 留空。卡数=批断条数。`
            : `${userBase}\n\n【纠错·P2 质量·兜底】上一稿未过硬闸（${sanitized.reason}）。请重写 why_cards：≥4 张不同 surface，都从该条批断译出，禁止把处境原句当 surface；每卡 essence≥约80字；chart_anchors≥1；末卡收束「因此主辅成立」。禁止编造剧情、禁止空壳降级出货。`;
        }
        if (
          input.key === "science_action" &&
          (sanitized.reason.includes("toolkit") ||
            sanitized.reason.includes("angles") ||
            sanitized.reason === "missing_primary_or_backup_toolkit" ||
            sanitized.reason.startsWith("missing_primary_or_backup_toolkit:") ||
            sanitized.reason === "page_title_situation_paste" ||
            sanitized.reason.startsWith("strategy_situation_paste:") ||
            sanitized.reason.startsWith("fill_action_prescription:") ||
            sanitized.reason.startsWith("fill_soft_frame:") ||
            sanitized.reason.startsWith("fill_empty_shell:") ||
            sanitized.reason.startsWith("fill_wellness_script:") ||
            sanitized.reason.startsWith("fill_parallel_life_story:") ||
            sanitized.reason.startsWith("compress_body_mingli:") ||
            sanitized.reason.startsWith("all_content_units_missing") ||
            sanitized.reason.startsWith("cross_page_primary_anchor"))
        ) {
          user = `${userBase}\n\n【纠错·P3 质量】上一稿未过硬闸（${sanitized.reason}）。顶层必须含 primary_toolkit + backup_toolkit，每轨 angles 恰好 3 条；每条 name+strategy+means(≥1)。正文=可执行策略/行动（非批断机制译）；strategy+means 回溯菜单与主辅；每维一句只对本案成立的结构由头；零命理词。对方只作现实约束/议题框（资源在对方侧、若对方拒绝则切辅 OK）；禁止替对方写心理/台词；禁止空壳冷却/疗愈清单。`;
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
    last_raw_text: lastRawText || undefined,
    sanitize_notes: lastSanitizeNotes.length ? lastSanitizeNotes : undefined,
  };
}
