/**
 * Batch 3 · Call 1 — deep evidence (anchors + professional ⟦w:⟧ evidence).
 *
 * Heavy pages (P4/P5): Call0 assign → parallel Call1 write chunks → merge quality.
 * Lighter pages: single monolithic call (legacy).
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliveryArgumentTree } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS,
  PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS,
  PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import {
  classifyEffortDowngradeReason,
  logEffortDowngrade,
} from "@/lib/llm/pro/delivery/effort-downgrade-log";
import type { CategoryTokenSets } from "./anchor-category-tally";
import type { DeliveryPageData } from "./types";
import {
  buildDeepEvidencePrompt,
  deepEvidenceUnitSpec,
  type DeepEvidencePlan,
  type DeepEvidenceUnit,
  type DeepEvidencePromptOpts,
} from "./deep-evidence-prompt";
import { assessDeepEvidenceQuality } from "./deep-evidence-quality";
import { pageSchemaToArgumentBodies, signalsCloseSealBodyIndexes } from "./render";
import {
  compressBodyPlainRewriteHints,
  lockedTermsFromDeepEvidencePlan,
  scrubMingliJargonOutsideSlots,
} from "./compress-jargon-repair";
import {
  chunkPaths,
  runDeepEvidenceAssignCall,
  type DeepEvidenceAssignment,
  type DeepEvidenceAssignmentUnit,
} from "./deep-evidence-assign";
import { runDeepEvidenceWriteChunk } from "./deep-evidence-write";

export type { DeepEvidencePlan, DeepEvidenceUnit } from "./deep-evidence-prompt";
export type { DeepEvidenceAssignment, DeepEvidenceAssignmentUnit } from "./deep-evidence-assign";

export type DeepEvidenceOk = {
  ok: true;
  plan: DeepEvidencePlan;
  tokens_used: number;
  attempts: number;
  assignment?: DeepEvidenceAssignment;
};

export type DeepEvidenceNeedsRewrite = {
  ok: true;
  needs_rewrite: true;
  assignment: DeepEvidenceAssignment;
  draft_plan: DeepEvidencePlan;
  rewrite_reason: string;
  tokens_used: number;
  attempts: number;
};

/** Soft-wall: more write chunks remain — caller must re-invoke (fresh 270s). */
export type DeepEvidenceNeedsMoreWrites = {
  ok: true;
  needs_more_writes: true;
  assignment: DeepEvidenceAssignment;
  units_so_far: DeepEvidenceUnit[];
  next_chunk: number;
  chunks_total: number;
  tokens_used: number;
  attempts: number;
};

export type DeepEvidenceFail = {
  ok: false;
  reason: string;
  tokens_used: number;
  attempts: number;
};

export type DeepEvidenceResult = DeepEvidenceOk | DeepEvidenceFail;
export type DeepEvidenceWriteResult =
  | DeepEvidenceOk
  | DeepEvidenceFail
  | DeepEvidenceNeedsRewrite
  | DeepEvidenceNeedsMoreWrites;

/** Pages that use assign + parallel write (avoid monolithic xhigh timeout). */
const CHUNKED_DEEP_EVIDENCE_KEYS = new Set<DeliverySegmentKey>([
  "foundation", // 4–5 why_cards — avoid mono xhigh starve
  "metaphysics_action",
  "risk_guard",
  "science_action",
  "signals_close", // identity + tonight + day7×4
]);

/** Keep in sync with DELIVERY_DISPATCH_WRITE_CHUNK_SIZE (1 unit / xhigh write). */
const WRITE_CHUNK_SIZE = 1;

function parseUnit(raw: unknown, fallbackPath: string): DeepEvidenceUnit | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const path =
    typeof o.path === "string" && o.path.trim()
      ? o.path.trim()
      : fallbackPath;
  const anchorsRaw = o.chart_anchors ?? o.anchors;
  const chart_anchors = Array.isArray(anchorsRaw)
    ? anchorsRaw.map((x) => String(x).trim()).filter(Boolean).slice(0, 8)
    : [];
  const evidence =
    typeof o.evidence === "string"
      ? o.evidence.trim()
      : typeof o.professional_evidence === "string"
        ? o.professional_evidence.trim()
        : "";
  if (!evidence || chart_anchors.length < 1) return null;
  if (!/⟦w:/.test(evidence)) return null;
  return { path, chart_anchors, evidence };
}

export function parseDeepEvidencePlan(
  key: DeliverySegmentKey,
  raw: unknown,
): DeepEvidencePlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const list = Array.isArray(o.units)
    ? o.units
    : Array.isArray(o.unit_plans)
      ? o.unit_plans
      : null;
  if (!list) return null;
  const spec = deepEvidenceUnitSpec(key);
  const units: DeepEvidenceUnit[] = [];
  for (let i = 0; i < list.length; i++) {
    const u = parseUnit(list[i], spec.paths[i] ?? `unit[${i}]`);
    if (u) units.push(u);
  }
  if (units.length < spec.min) return null;
  return { page: key, units: units.slice(0, spec.max) };
}

type DeepEvidenceCallInput = {
  key: DeliverySegmentKey;
  locale: string;
  core_conclusion: string;
  bazi_basis?: readonly string[];
  session_id?: string;
  signal?: AbortSignal;
  timeout_ms?: number;
  page_plan_slice?: string;
  eastern_calc_slice?: string;
  risk_calc_slice?: string;
  question_expectation?: string;
  primary_backup_hint?: string;
  reality_constraints?: string;
  foundation_surface_feed?: string;
  science_means_feed?: string;
  metaphysics_moat_feed?: string;
  risk_fuse_feed?: string;
  close_ritual_feed?: string;
  structured_inventory?: string;
  prior_chart_anchors?: readonly string[];
  category_token_sets?: CategoryTokenSets | null;
  primary_reuse_cap?: number;
  action_brief_block?: string;
};

function buildPromptOpts(input: DeepEvidenceCallInput): DeepEvidencePromptOpts {
  return {
    locale: input.locale,
    core_conclusion: input.core_conclusion,
    bazi_basis: input.bazi_basis,
    page_plan_slice: input.page_plan_slice,
    eastern_calc_slice: input.eastern_calc_slice,
    risk_calc_slice: input.risk_calc_slice,
    question_expectation: input.question_expectation,
    primary_backup_hint: input.primary_backup_hint,
    reality_constraints: input.reality_constraints,
    foundation_surface_feed: input.foundation_surface_feed,
    science_means_feed: input.science_means_feed,
    metaphysics_moat_feed: input.metaphysics_moat_feed,
    risk_fuse_feed: input.risk_fuse_feed,
    close_ritual_feed: input.close_ritual_feed,
    structured_inventory: input.structured_inventory,
    prior_chart_anchors: input.prior_chart_anchors,
    category_token_sets: input.category_token_sets,
    action_brief_block: input.action_brief_block,
  };
}

/**
 * One write chunk per invoke (dispatch). Pass `prior_units` from earlier hops.
 * When more chunks remain → `needs_more_writes` (soft-wall, fresh 270s).
 * When `defer_rewrite` and merge quality fails → `needs_rewrite` (next hop).
 * Never packs N× xhigh into one 300s window.
 */
export async function runDeepEvidenceWritesFromAssignment(
  input: DeepEvidenceCallInput,
  assignment: DeepEvidenceAssignment,
  opts?: {
    rewrite_reason?: string | null;
    defer_rewrite?: boolean;
    /** Units already written in prior invokes. */
    prior_units?: DeepEvidenceUnit[];
  },
): Promise<DeepEvidenceWriteResult> {
  const promptOpts = buildPromptOpts(input);
  // Cap by remaining invoke budget (input.timeout_ms) and deep-write ceiling.
  // Never hard-cap at 100s — that starved xhigh and produced finish=`-` / llm_timeout.
  const writeTimeout = Math.min(
    input.timeout_ms ?? PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS,
    PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS,
  );
  // Below ~90s a write almost always dies mid-stream (TTFT alone can be 8–18s).
  if (writeTimeout < 90_000) {
    return {
      ok: false,
      reason: "deep_evidence:insufficient_budget_for_write",
      tokens_used: 0,
      attempts: 0,
    };
  }
  const chunks = chunkPaths(assignment.units, WRITE_CHUNK_SIZE);
  const rewriteReason = opts?.rewrite_reason?.trim() || null;
  const prior = opts?.prior_units ?? [];
  const donePaths = new Set(prior.map((u) => u.path));
  const nextIdx = chunks.findIndex((c) => c.some((u) => !donePaths.has(u.path)));

  if (nextIdx < 0) {
    if (prior.length === 0) {
      return {
        ok: false,
        reason: "deep_evidence:no_write_units",
        tokens_used: 0,
        attempts: 0,
      };
    }
    const plan: DeepEvidencePlan = { page: input.key, units: prior };
    const quality = assessDeepEvidenceQuality(input.key, plan, {
      eastern_calc_slice: input.eastern_calc_slice,
      core_conclusion: input.core_conclusion,
      prior_chart_anchors: input.prior_chart_anchors,
      category_token_sets: input.category_token_sets,
      primary_reuse_cap: input.primary_reuse_cap,
    });
    if (!quality.ok) {
      if (opts?.defer_rewrite && !rewriteReason) {
        return {
          ok: true,
          needs_rewrite: true,
          assignment,
          draft_plan: plan,
          rewrite_reason: quality.reason,
          tokens_used: 0,
          attempts: 0,
        };
      }
      return {
        ok: false,
        reason: `deep_evidence:${quality.reason}`,
        tokens_used: 0,
        attempts: 0,
      };
    }
    return { ok: true, plan, tokens_used: 0, attempts: 0, assignment };
  }

  let writeOpts: DeepEvidencePromptOpts = promptOpts;
  if (rewriteReason) {
    writeOpts = {
      ...promptOpts,
      core_conclusion: `${promptOpts.core_conclusion}\n\n【纠错】上一合并稿未过闸（${rewriteReason}）。本 chunk 重写：机制更深；禁止跨单元雷同；P4 须落实锁定的 moat_class。`,
    };
  }

  const chunk = chunks[nextIdx]!;
  console.info("[delivery/deep-evidence] dispatch write one chunk", {
    key: input.key,
    chunk: nextIdx,
    chunks_total: chunks.length,
    units: chunk.length,
    rewrite: Boolean(rewriteReason),
    timeout_ms: writeTimeout,
  });

  const r = await runDeepEvidenceWriteChunk({
    key: input.key,
    opts: writeOpts,
    chunk,
    session_id: input.session_id,
    signal: input.signal,
    timeout_ms: writeTimeout,
  });
  if (!r.ok) {
    return {
      ok: false,
      reason: `deep_evidence:${r.reason}:chunk${nextIdx}`,
      tokens_used: r.tokens_used,
      attempts: r.attempts,
    };
  }

  const units_so_far = [...prior, ...r.units];
  const doneCount = nextIdx + 1;
  if (doneCount < chunks.length) {
    return {
      ok: true,
      needs_more_writes: true,
      assignment,
      units_so_far,
      next_chunk: doneCount,
      chunks_total: chunks.length,
      tokens_used: r.tokens_used,
      attempts: r.attempts,
    };
  }

  const plan: DeepEvidencePlan = { page: input.key, units: units_so_far };
  const quality = assessDeepEvidenceQuality(input.key, plan, {
    eastern_calc_slice: input.eastern_calc_slice,
    core_conclusion: input.core_conclusion,
    prior_chart_anchors: input.prior_chart_anchors,
    category_token_sets: input.category_token_sets,
    primary_reuse_cap: input.primary_reuse_cap,
  });
  if (!quality.ok) {
    if (opts?.defer_rewrite && !rewriteReason) {
      console.warn("[delivery/deep-evidence] merge quality fail — defer rewrite to next hop", {
        key: input.key,
        reason: quality.reason,
        notes: quality.notes,
      });
      return {
        ok: true,
        needs_rewrite: true,
        assignment,
        draft_plan: plan,
        rewrite_reason: quality.reason,
        tokens_used: r.tokens_used,
        attempts: r.attempts,
      };
    }
    console.warn("[delivery/deep-evidence] merge quality fail after dispatch writes", {
      key: input.key,
      reason: quality.reason,
      notes: quality.notes,
      rewrite_already: Boolean(rewriteReason),
    });
    return {
      ok: false,
      reason: `deep_evidence:${quality.reason}`,
      tokens_used: r.tokens_used,
      attempts: r.attempts,
    };
  }

  console.info("[delivery/deep-evidence] dispatch write complete", {
    key: input.key,
    units: plan.units.length,
    chunks: chunks.length,
    quality_notes: quality.notes,
    rewrite: Boolean(rewriteReason),
  });
  return {
    ok: true,
    plan,
    tokens_used: r.tokens_used,
    attempts: r.attempts,
    assignment,
  };
}

/**
 * Assign only → caller must dispatch writes (one chunk / invoke).
 * Kept for name compatibility; never packs assign + N writes into one 300s.
 */
export async function runDeepEvidenceCallChunked(
  input: DeepEvidenceCallInput,
): Promise<DeepEvidenceResult> {
  const promptOpts = buildPromptOpts(input);
  let tokens_used = 0;
  const assignTimeout = Math.min(
    input.timeout_ms ?? PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS,
    PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS,
  );

  const assigned = await runDeepEvidenceAssignCall({
    key: input.key,
    opts: promptOpts,
    session_id: input.session_id,
    signal: input.signal,
    timeout_ms: assignTimeout,
  });
  tokens_used += assigned.tokens_used;
  if (!assigned.ok) {
    return {
      ok: false,
      reason: `deep_evidence:${assigned.reason}`,
      tokens_used,
      attempts: 1,
    };
  }

  const chunks = chunkPaths(assigned.assignment.units, WRITE_CHUNK_SIZE);
  if (chunks.length > 1) {
    return {
      ok: false,
      reason: "deep_evidence:multi_chunk_requires_dispatch",
      tokens_used,
      attempts: 1,
    };
  }

  const written = await runDeepEvidenceWritesFromAssignment(
    input,
    assigned.assignment,
    { defer_rewrite: false },
  );
  if ("needs_more_writes" in written && written.needs_more_writes) {
    return {
      ok: false,
      reason: "deep_evidence:multi_chunk_requires_dispatch",
      tokens_used: tokens_used + written.tokens_used,
      attempts: written.attempts,
    };
  }
  if ("needs_rewrite" in written && written.needs_rewrite) {
    return {
      ok: false,
      reason: `deep_evidence:${written.rewrite_reason}`,
      tokens_used: tokens_used + written.tokens_used,
      attempts: written.attempts,
    };
  }
  if (!written.ok) {
    return {
      ok: false,
      reason: written.reason,
      tokens_used: tokens_used + written.tokens_used,
      attempts: written.attempts,
    };
  }
  if (!("plan" in written) || !written.plan) {
    return {
      ok: false,
      reason: "deep_evidence:missing_plan_after_write",
      tokens_used: tokens_used + written.tokens_used,
      attempts: written.attempts,
    };
  }
  return {
    ok: true,
    plan: written.plan,
    tokens_used: tokens_used + written.tokens_used,
    attempts: written.attempts,
    assignment: written.assignment,
  };
}

async function runDeepEvidenceCallMonolithic(
  input: DeepEvidenceCallInput,
): Promise<DeepEvidenceResult> {
  const promptOpts = buildPromptOpts(input);
  const { system, user: userBase } = buildDeepEvidencePrompt(input.key, promptOpts);
  const maxAttempts = 2;
  let tokens_used = 0;
  let lastReason = "unknown";
  let user = userBase;
  let currentEffort: "xhigh" | "high" = "xhigh";
  const timeoutUsed = input.timeout_ms ?? PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (input.signal?.aborted) {
      return { ok: false, reason: "aborted", tokens_used, attempts: attempt };
    }
    const attemptStartedAt = Date.now();
    try {
      const result = await callLLM({
        call_type: "main_delivery",
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS,
        thinking_effort: currentEffort,
        timeout_ms: timeoutUsed,
        response_format: "json",
        session_id: input.session_id,
        temperature: 0.35,
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
        lastReason = "parse_fail";
        continue;
      }
      const plan = parseDeepEvidencePlan(input.key, parsed);
      if (!plan) {
        lastReason = "shape_fail";
        user = `${userBase}\n\n【纠错】上一稿 units 不足或缺 chart_anchors/⟦w:⟧。请按 min–max 重写完整 units。`;
        continue;
      }
      const quality = assessDeepEvidenceQuality(input.key, plan, {
        eastern_calc_slice: input.eastern_calc_slice,
        core_conclusion: input.core_conclusion,
        prior_chart_anchors: input.prior_chart_anchors,
        category_token_sets: input.category_token_sets,
        primary_reuse_cap: input.primary_reuse_cap,
      });
      if (!quality.ok) {
        lastReason = quality.reason;
        console.warn("[delivery/deep-evidence] quality fail", {
          key: input.key,
          reason: quality.reason,
          notes: quality.notes,
          attempt,
        });
        user = `${userBase}\n\n【纠错·依据质量】上一稿未过质量闸（${quality.reason}）。请重写：每条 evidence ≥两句机制链且**单元之间禁止逐字/高度雷同**；chart_anchors 必须在 evidence 的 ⟦w:⟧/正文中出现；跨 unit 锚点勿高度复用；相对 prior 主承重须引入新类目锚；P4 运程须写转折/窗口机制（不可仅写「纪元」氛围词），并覆盖用忌/十神有料维。`;
        continue;
      }
      console.info("[delivery/deep-evidence] ok", {
        key: input.key,
        attempt,
        units: plan.units.length,
        thinking_effort: currentEffort,
        quality_notes: quality.notes,
      });
      return { ok: true, plan, tokens_used, attempts: attempt };
    } catch (e) {
      lastReason = e instanceof Error ? e.message : "llm_error";
      const degradeReason = classifyEffortDowngradeReason(e, "llm_error");
      if (
        (degradeReason === "timeout" || degradeReason === "abort") &&
        currentEffort === "xhigh" &&
        attempt < maxAttempts
      ) {
        logEffortDowngrade({
          session_id: input.session_id,
          call_site: "deep_evidence",
          key: input.key,
          from_effort: "xhigh",
          to_effort: "high",
          reason: degradeReason,
          attempt,
          elapsed_ms: Date.now() - attemptStartedAt,
          timeout_ms_used: timeoutUsed,
        });
        currentEffort = "high";
      }
      console.warn("[delivery/deep-evidence] call error", {
        key: input.key,
        attempt,
        reason: lastReason,
        thinking_effort: currentEffort,
      });
    }
  }

  return {
    ok: false,
    reason: `deep_evidence:${lastReason}`,
    tokens_used,
    attempts: maxAttempts,
  };
}

export async function runDeepEvidenceCall(
  input: DeepEvidenceCallInput,
): Promise<DeepEvidenceResult> {
  if (CHUNKED_DEEP_EVIDENCE_KEYS.has(input.key)) {
    return runDeepEvidenceCallChunked(input);
  }
  return runDeepEvidenceCallMonolithic(input);
}

const MOAT_COMPRESS_MEANS_HINT: Record<
  NonNullable<DeepEvidenceUnit["moat_class"]>,
  string
> = {
  timing:
    'means 至少 1 条 type="timing"；白话须含「转折/窗口/切换/多久」之一（禁空喊纪元；手段须像运程节律动作，不像项目管理里程碑）',
  polarity:
    'means 至少 1 条 type="polarity"；白话须含「补给/消耗/靠近/远离/虚旺/补泻」之一（禁裸报用神忌神；禁周独处复盘/财务 KPI 顶替）',
  archetype:
    'means 至少 1 条 type="archetype"；白话须含「借势/开创/角色定位/格局/官杀气质」之一（禁裸报十神专名；禁兼职顾问工时协议）',
};

/** Format locked plan for narrative-compress fill user message. */
export function formatDeepEvidencePlanForCompress(plan: DeepEvidencePlan): string {
  const allow = [...lockedTermsFromDeepEvidencePlan(plan)].sort((a, b) => b.length - a.length);
  const lines = [
    "【已锁定深度依据 · 正文压缩专用 · 禁止改锚/禁止另起盘外故事】",
    `page=${plan.page} · units=${plan.units.length}`,
    "【正文生成规则 · 硬 · 首枪】",
    "- strategy / means / surface / essence 等**用户可见白话：零命理专名**（锁定表里的词也不许进正文）。",
    "- 仅 JSON 字段 `chart_anchors` 原样复制下方「锁定允许表」。",
    "- strategy 必须从该单元 unit_claim + professional_evidence 长出；means 必须能回溯 means_candidate_ref（可压缩改写菜单候选）。",
    "- 专业依据若含阶段/柱支概念，正文用平替语，禁止照抄真词。",
    `【chart_anchors 锁定允许表】${allow.length > 0 ? allow.join("、") : "(空)"}`,
    `【正文平替提示】${compressBodyPlainRewriteHints()}`,
    "【绑定摘要 · 每单元】（禁止重算；只作 strategy/means 生长钉）",
  ];
  plan.units.forEach((u, i) => {
    lines.push(
      `${i + 1}. ${u.path}` +
        `${u.moat_class ? ` · moat=${u.moat_class}` : ""}` +
        `${u.mechanism_tag ? ` · tag=${u.mechanism_tag}` : ""}` +
        `\n   claim: ${u.unit_claim?.trim() || "(无)"}` +
        `\n   cite: ${u.calc_cite?.trim() || "(无)"}` +
        `\n   candidate: ${u.means_candidate_ref?.trim() || "(无)"}`,
    );
  });
  const moatLocks = plan.units.filter((u) => u.moat_class);
  if (plan.page === "metaphysics_action" && moatLocks.length > 0) {
    lines.push(
      "【护城河 means 锁（硬·整页必须兑现）】",
      "每个标了 moat_class 的 dimensions[i]：strategy+means 必须写出该类机制；means 用 JSON `{text,type}`，type 与 moat_class 一致。",
      "手段须像东方调频动作，不像项目管理/职场教练；禁止用邮件/话术/日历/周独处复盘/兼职顾问协议/止损计划/财务 KPI 顶替东方机制。",
      "禁止整页只写 polarity。",
      ...moatLocks.map(
        (u) =>
          `- ${u.path} → moat_class=${u.moat_class} → ${MOAT_COMPRESS_MEANS_HINT[u.moat_class!]}`,
      ),
    );
  }
  plan.units.forEach((u, i) => {
    const moat =
      u.moat_class != null && u.moat_class !== undefined
        ? `\nmoat_class(硬): ${u.moat_class}`
        : "";
    const bind =
      `\nunit_claim: ${u.unit_claim ?? ""}` +
      `\ncalc_cite: ${u.calc_cite ?? ""}` +
      `\nmeans_candidate_ref: ${u.means_candidate_ref ?? ""}` +
      (u.mechanism_tag ? `\nmechanism_tag: ${u.mechanism_tag}` : "");
    const evidenceForFill = scrubMingliJargonOutsideSlots(u.evidence).text;
    lines.push(
      `### 单元 ${i + 1} · ${u.path}${moat}${bind}\nchart_anchors: ${u.chart_anchors.join("、")}\nprofessional_evidence:\n${evidenceForFill}`,
    );
  });
  lines.push(
    "压缩任务：把上述专业依据改写成大白话页内字段；各内容单元的 chart_anchors 必须原样复制上列；正文零专名；禁止引入新真词主承重；strategy 对齐 unit_claim；means 回溯 means_candidate_ref。",
    plan.page === "metaphysics_action"
      ? "P4：锁定 moat_class 须落到 means.type + 机制白话；strategy+means 回溯【P4 护城河手段候选菜单】与 means_candidate_ref；禁 P3 执行腔/物化补泻；缺一类=废稿。"
      : plan.page === "foundation"
        ? "P2：按锁定 path 写 why_cards；surface 回溯 means_candidate_ref /【P2 表象候选菜单】；essence 从 unit_claim+evidence 长出；末卡收束「因此主辅成立」。"
        : plan.page === "science_action"
          ? "P3：按锁定 path 写 3+3 angles；strategy+means 回溯 means_candidate_ref /【P3 科学手段候选菜单】；禁合同剧本/东方色向清单。"
          : "",
  );
  return lines.filter(Boolean).join("\n\n");
}

/**
 * Overwrite page unit chart_anchors from deep plan (order-aligned content units).
 * Returns evidence strings aligned to pageSchemaToArgumentBodies order.
 */
export function alignDeepEvidenceToPage(
  _key: DeliverySegmentKey,
  page: DeliveryPageData,
  plan: DeepEvidencePlan,
): { page: DeliveryPageData; evidenceByBodyIndex: string[] } {
  const bodies = pageSchemaToArgumentBodies(page);
  const evidenceByBodyIndex: string[] = bodies.map(() => "");
  const units = plan.units;
  const pathIndex = new Map(units.map((u, i) => [u.path, i]));

  const takeUnit = (pathHints: string[], fallbackIdx: number): DeepEvidenceUnit | null => {
    for (const p of pathHints) {
      const i = pathIndex.get(p);
      if (i != null) return units[i]!;
    }
    return units[fallbackIdx] ?? null;
  };

  switch (page.page) {
    case "direct_answer": {
      const u0 = takeUnit(["core_judgment"], 0);
      const u1 = takeUnit(["primary"], 1);
      const u2 = takeUnit(["backup"], 2);
      if (u0) evidenceByBodyIndex[0] = u0.evidence;
      if (u1) evidenceByBodyIndex[1] = u1.evidence;
      else if (u0) evidenceByBodyIndex[1] = u0.evidence;
      if (u2) evidenceByBodyIndex[2] = u2.evidence;
      break;
    }
    case "foundation": {
      for (let i = 0; i < bodies.length; i++) {
        const u = takeUnit([`why_cards[${i}]`], i);
        if (u) evidenceByBodyIndex[i] = u.evidence;
      }
      break;
    }
    case "science_action": {
      let bi = 0;
      if (page.opening?.trim()) {
        const u = takeUnit(["primary_toolkit.angles[0]"], 0);
        evidenceByBodyIndex[bi++] = u?.evidence ?? units[0]?.evidence ?? "";
      }
      for (let i = 0; i < page.primary_toolkit.angles.length; i++) {
        const u = takeUnit([`primary_toolkit.angles[${i}]`], i);
        evidenceByBodyIndex[bi++] = u?.evidence ?? "";
      }
      for (let i = 0; i < page.backup_toolkit.angles.length; i++) {
        const u = takeUnit(
          [`backup_toolkit.angles[${i}]`],
          page.primary_toolkit.angles.length + i,
        );
        evidenceByBodyIndex[bi++] = u?.evidence ?? "";
      }
      break;
    }
    case "metaphysics_action": {
      for (let i = 0; i < bodies.length; i++) {
        const u = takeUnit([`dimensions[${i}]`], i);
        if (u) evidenceByBodyIndex[i] = u.evidence;
      }
      break;
    }
    case "risk_guard": {
      const paths = [
        ...page.red_lights.map((_, i) => `red_lights[${i}]`),
        ...page.traps.map((_, i) => `traps[${i}]`),
        "switch_to_backup",
        ...page.protection_rules.map((_, i) => `protection_rules[${i}]`),
      ];
      paths.forEach((p, i) => {
        const u = takeUnit([p], i);
        if (u) evidenceByBodyIndex[i] = u.evidence;
      });
      break;
    }
    case "signals_close": {
      const id = takeUnit(["identity_shift", "identity"], 0);
      if (id) evidenceByBodyIndex[0] = id.evidence;
      // Quote + takeaways are ritual seals — no dedicated deep unit; do NOT reuse identity/tonight.
      evidenceByBodyIndex[1] = "";
      const tonight = takeUnit(["tonight"], 1);
      if (tonight) evidenceByBodyIndex[2] = tonight.evidence;
      for (let i = 0; i < page.day7_micro_actions.length; i++) {
        const u = takeUnit([`day7_micro_actions[${i}]`], 2 + i);
        evidenceByBodyIndex[3 + i] = u?.evidence ?? "";
      }
      const last = evidenceByBodyIndex.length - 1;
      if (last > 1) evidenceByBodyIndex[last] = "";
      break;
    }
    default: {
      for (let i = 0; i < Math.min(bodies.length, units.length); i++) {
        evidenceByBodyIndex[i] = units[i]!.evidence;
      }
    }
  }

  // Fill gaps from leftover units — never reuse already-applied units; never backfill P6 seals.
  const sealSkip =
    page.page === "signals_close"
      ? signalsCloseSealBodyIndexes(evidenceByBodyIndex.length)
      : null;
  const consumedEvidence = new Set(
    evidenceByBodyIndex.map((e) => e.trim()).filter(Boolean),
  );
  const leftovers = units.filter((u) => !consumedEvidence.has(u.evidence.trim()));
  let li = 0;
  for (let i = 0; i < evidenceByBodyIndex.length; i++) {
    if (sealSkip?.has(i)) continue;
    if (evidenceByBodyIndex[i]?.trim()) continue;
    if (li >= leftovers.length) break;
    evidenceByBodyIndex[i] = leftovers[li]!.evidence;
    li += 1;
  }

  const anchorsForApply = bodies.map((_, i) => {
    const ev = evidenceByBodyIndex[i];
    const matched = units.find((u) => u.evidence === ev);
    return matched?.chart_anchors ?? bodies[i]?.chart_anchors ?? [];
  });

  return {
    page: applyAnchorsByPageType(page, anchorsForApply),
    evidenceByBodyIndex,
  };
}

function applyAnchorsByPageType(
  page: DeliveryPageData,
  anchorsPerBody: readonly (readonly string[])[],
): DeliveryPageData {
  const clone = structuredClone(page) as DeliveryPageData;
  const at = (i: number): string[] =>
    (anchorsPerBody[i] ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 8);

  switch (clone.page) {
    case "direct_answer": {
      const j = at(0);
      const p = at(1);
      const b = at(2);
      if (p.length) clone.primary.chart_anchors = p;
      else if (j.length) clone.primary.chart_anchors = j;
      if (b.length) clone.backup.chart_anchors = b;
      break;
    }
    case "foundation": {
      clone.why_cards.forEach((c, idx) => {
        const a = at(idx);
        if (a.length) c.chart_anchors = a;
      });
      break;
    }
    case "science_action": {
      let idx = 0;
      if (clone.opening?.trim()) idx += 1;
      for (const angle of clone.primary_toolkit.angles) {
        const a = at(idx);
        if (a.length) angle.chart_anchors = a;
        idx += 1;
      }
      for (const angle of clone.backup_toolkit.angles) {
        const a = at(idx);
        if (a.length) angle.chart_anchors = a;
        idx += 1;
      }
      break;
    }
    case "metaphysics_action": {
      clone.dimensions.forEach((d, idx) => {
        const a = at(idx);
        if (a.length) d.chart_anchors = a;
      });
      break;
    }
    case "risk_guard": {
      let idx = 0;
      for (const r of clone.red_lights) {
        const a = at(idx++);
        if (a.length) r.chart_anchors = a;
      }
      for (const r of clone.traps) {
        const a = at(idx++);
        if (a.length) r.chart_anchors = a;
      }
      {
        const a = at(idx++);
        if (a.length) clone.switch_to_backup.chart_anchors = a;
      }
      for (const r of clone.protection_rules) {
        const a = at(idx++);
        if (a.length) r.chart_anchors = a;
      }
      break;
    }
    case "signals_close": {
      const id = at(0);
      if (id.length) clone.identity_shift_anchors = id;
      const tonight = at(2);
      if (tonight.length) clone.tonight_anchors = tonight;
      clone.day7_micro_actions.forEach((d, di) => {
        const a = at(3 + di);
        if (a.length) d.chart_anchors = a;
      });
      break;
    }
    default:
      break;
  }
  return clone;
}

/** Build evidence argument tree from aligned evidence strings. */
export function evidenceTreeFromAligned(
  key: DeliverySegmentKey,
  evidenceByBodyIndex: readonly string[],
): DeliveryArgumentTree {
  return {
    [key]: evidenceByBodyIndex.map((evidence) => ({
      body: "",
      evidence,
    })),
  };
}
