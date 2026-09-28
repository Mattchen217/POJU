/**
 * Structured JSON page fill — one LLM call per invoke (dispatch).
 * Quality sanitize fail → hard stop (fix prompt/feed). Never stack a second
 * quality regen inside the same 270s/300s window.
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliveryComputed, DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  DELIVERY_SINGLE_CALL_TIMEOUT_MS,
  PAGE_SCHEMA_FILL_MAX_TOKENS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import { sanitizePageJson, parseAllowedDashboardScoresFromHints } from "./sanitize";
import { buildPageSchemaFillPrompt, type PageSchemaFillPromptOpts } from "./fill-prompt";
import {
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
 * @deprecated Prefer pageSchemaFillMaxAttempts() — kept for tests/import compat.
 */
export const PAGE_SCHEMA_FILL_MAX_ATTEMPTS = 1;

export type P4FillPartialState = {
  chrome: {
    page_title?: string;
    page_subtitle?: string;
    question_anchor?: string;
    desired_outcome?: string;
  };
  /** path → dimension object collected so far */
  dims_by_path: Record<string, Record<string, unknown>>;
  next_chunk: number;
  chunks_total: number;
};

export type PageSchemaFillOk = {
  ok: true;
  page: DeliveryPageData;
  tokens_used: number;
  attempts: number;
  truncated: boolean;
  /** Present on chunk-collect partials (internal). */
  last_raw_text?: string;
};

/** Soft-wall: more P4 fill chunks remain — caller must open a fresh 270s invoke. */
export type PageSchemaFillContinue = {
  ok: true;
  needs_more_fill_chunks: true;
  fill_partial: P4FillPartialState;
  tokens_used: number;
  attempts: number;
  truncated: boolean;
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

export type PageSchemaFillResult =
  | PageSchemaFillOk
  | PageSchemaFillContinue
  | PageSchemaFillFail;

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
   * Internal: skip auto P4 fill chunking (used by single-chunk driver).
   */
  _skip_p4_fill_chunk?: boolean;
  /**
   * P4 compress dispatch: units already written in prior invokes + next chunk index.
   * One chunk per call — never packs N chunks into one 300s window.
   */
  fill_partial?: P4FillPartialState | null;
}): Promise<PageSchemaFillResult> {
  const fill_mode = input.fill_mode ?? "full";
  if (
    !input._skip_p4_fill_chunk &&
    shouldChunkP4CompressFill(input.key, fill_mode, input.deep_evidence_plan)
  ) {
    return runP4CompressFillOneChunk(input);
  }
  return runPageSchemaFillOnce(input);
}

/**
 * One P4 fill chunk per invoke (dispatch SSOT).
 * Prior chunks via `fill_partial`; when more remain → `needs_more_fill_chunks`.
 * Merge sanitize only on the last chunk. Quality fail → hard stop (no full-page lottery).
 */
async function runP4CompressFillOneChunk(
  input: Parameters<typeof runPageSchemaFill>[0],
): Promise<PageSchemaFillResult> {
  const plan = input.deep_evidence_plan!;
  const chunks = buildP4FillChunks(plan);
  const prior = input.fill_partial ?? null;
  const nextIdx = prior?.next_chunk ?? 0;
  if (nextIdx < 0 || nextIdx >= chunks.length) {
    return {
      ok: false,
      reason: "page_schema_fill:p4_chunk_index_oob",
      tokens_used: 0,
      attempts: 0,
    };
  }

  const chunkUnits = chunks[nextIdx]!;
  const paths = chunkUnits.map((u) => u.path);
  const subPlan = sliceDeepEvidencePlanForFillChunk(plan, chunkUnits);
  const chunkHint = formatP4FillChunkUserHint({
    index: nextIdx,
    total: chunks.length,
    include_page_chrome: nextIdx === 0,
    parent_unit_count: plan.units.length,
    paths,
  });

  console.info("[delivery/page-schema-fill] P4 compress one-chunk dispatch", {
    units: plan.units.length,
    chunk: `${nextIdx + 1}/${chunks.length}`,
    paths,
  });

  const partial = await runPageSchemaFillOnce({
    ...input,
    deep_evidence_plan: subPlan,
    _skip_p4_fill_chunk: true,
    _p4_chunk_collect: {
      index: nextIdx,
      total: chunks.length,
      include_page_chrome: nextIdx === 0,
      expected_paths: paths,
      user_hint: chunkHint,
    },
  });

  if (!partial.ok) {
    return {
      ...partial,
      reason: `page_schema_fill:p4_chunk_${nextIdx}:${partial.reason.replace(/^page_schema_fill:/, "")}`,
    };
  }

  const page = partial.page as Record<string, unknown>;
  const chrome =
    nextIdx === 0
      ? {
          page_title: String(page.page_title ?? ""),
          page_subtitle: String(page.page_subtitle ?? ""),
          question_anchor: String(page.question_anchor ?? ""),
          desired_outcome: String(page.desired_outcome ?? ""),
        }
      : prior?.chrome ?? {};
  const dims_by_path: Record<string, Record<string, unknown>> = {
    ...(prior?.dims_by_path ?? {}),
  };
  const dims = Array.isArray(page.dimensions) ? page.dimensions : [];
  for (let di = 0; di < dims.length; di++) {
    const d = dims[di];
    if (!d || typeof d !== "object") continue;
    const path = paths[di] ?? `dimensions[${di}]`;
    dims_by_path[path] = d as Record<string, unknown>;
  }

  const doneCount = nextIdx + 1;
  if (doneCount < chunks.length) {
    return {
      ok: true,
      needs_more_fill_chunks: true,
      fill_partial: {
        chrome,
        dims_by_path,
        next_chunk: doneCount,
        chunks_total: chunks.length,
      },
      tokens_used: partial.tokens_used,
      attempts: partial.attempts,
      truncated: partial.truncated,
      last_raw_text: partial.last_raw_text,
    };
  }

  const orderedDims = plan.units.map((u, i) => {
    const d = dims_by_path[u.path];
    if (d) return d;
    return {
      name: `维${i + 1}`,
      strategy: "（分枪缺维）",
      means: ["（分枪缺维）", "（分枪缺维）"],
      chart_anchors: [],
    };
  });
  if (orderedDims.some((d) => String(d.strategy ?? "").includes("分枪缺维"))) {
    return {
      ok: false,
      reason: "page_schema_fill:p4_chunk_missing_dims",
      tokens_used: partial.tokens_used,
      attempts: partial.attempts,
      last_raw_text: partial.last_raw_text,
    };
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
  if (mergeSanitize.ok) {
    console.info("[delivery/page-schema-fill] P4 chunked merge ok", {
      chunks: chunks.length,
      notes: mergeSanitize.notes.slice(0, 12),
    });
    return {
      ok: true,
      page: mergeSanitize.page,
      tokens_used: partial.tokens_used,
      attempts: partial.attempts,
      truncated: mergeSanitize.truncated,
    };
  }

  // Quality fail after all chunks — hard stop. Fix gen side; do NOT full-page lottery
  // inside this invoke (would stack into Vercel 300s).
  console.warn("[delivery/page-schema-fill] P4 chunked merge fail — hard stop", {
    reason: mergeSanitize.reason,
  });
  return {
    ok: false,
    reason: `page_schema_fill:${mergeSanitize.reason}`,
    tokens_used: partial.tokens_used,
    attempts: partial.attempts,
    sanitize_notes: mergeSanitize.notes,
    last_raw_text: partial.last_raw_text,
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
}): Promise<PageSchemaFillResult & { last_raw_text?: string }> {
  const seg = input.finalize[input.key];
  const shapeMode = resolveDeliveryFillShapeMode();
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

  let tokens_used = 0;
  let lastReason = "unknown";
  let user = userBase;
  /** One LLM per invoke — quality fail hard-stops; transport → fresh dispatch. */
  const attemptBudget = 1;
  let lastRawText = "";
  let lastSanitizeNotes: string[] = [];
  const fillStartedAt = Date.now();
  const timeoutCeiling = input.timeout_ms ?? DELIVERY_SINGLE_CALL_TIMEOUT_MS;

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
    const callTimeoutMs = Math.min(
      timeoutCeiling,
      Math.max(30_000, remainingMs > 0 ? remainingMs - 12_000 : timeoutCeiling),
    );
    const { deliveryDispatchProviderBody } = await import(
      "@/lib/llm/pro/delivery/dispatch/provider-escape"
    );
    // Provider escape only on a *fresh* Lab/DAG dispatch_attempt≥2, not stacked here.
    const provider = deliveryDispatchProviderBody(1);
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
        // Quality / structural fail → hard stop this invoke.
        // Fix prompt/feed for once-pass; never stack a second quality LLM here
        // (would race Vercel 300s). Transport → fresh dispatch outside.
        break;
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
    attempts: 1,
    last_raw_text: lastRawText || undefined,
    sanitize_notes: lastSanitizeNotes.length ? lastSanitizeNotes : undefined,
  };
}
