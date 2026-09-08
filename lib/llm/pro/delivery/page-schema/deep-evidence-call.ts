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
import { PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS } from "@/lib/llm/pro/delivery/delivery-tasks";
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
import { pageSchemaToArgumentBodies } from "./render";
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
  | DeepEvidenceNeedsRewrite;

/** Pages that use assign + parallel write (avoid monolithic xhigh timeout). */
const CHUNKED_DEEP_EVIDENCE_KEYS = new Set<DeliverySegmentKey>([
  "foundation", // 4–5 why_cards — avoid mono xhigh starve
  "metaphysics_action",
  "risk_guard",
  "science_action",
  "signals_close", // identity + tonight + day7×4
]);

const WRITE_CHUNK_SIZE = 2;

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
 * Parallel write (+ optional quality rewrite) from a locked assignment.
 * When `defer_rewrite` and first merge fails quality, returns `needs_rewrite`
 * so the segment chain can soft-wall instead of stacking another ≤100s write.
 */
export async function runDeepEvidenceWritesFromAssignment(
  input: DeepEvidenceCallInput,
  assignment: DeepEvidenceAssignment,
  opts?: {
    rewrite_reason?: string | null;
    defer_rewrite?: boolean;
  },
): Promise<DeepEvidenceWriteResult> {
  const promptOpts = buildPromptOpts(input);
  let tokens_used = 0;
  let attempts = 1;
  const writeTimeout = Math.min(input.timeout_ms ?? 100_000, 100_000);
  const chunks = chunkPaths(assignment.units, WRITE_CHUNK_SIZE);
  const rewriteReason = opts?.rewrite_reason?.trim() || null;

  async function writeAll(
    writeOpts: DeepEvidencePromptOpts,
  ): Promise<
    | { ok: true; units: DeepEvidenceUnit[]; tokens: number; attempts: number }
    | { ok: false; reason: string; tokens: number; attempts: number }
  > {
    console.info("[delivery/deep-evidence] parallel write", {
      key: input.key,
      units: assignment.units.length,
      chunks: chunks.length,
      rewrite: Boolean(rewriteReason),
    });
    const chunkResults = await Promise.all(
      chunks.map((chunk) =>
        runDeepEvidenceWriteChunk({
          key: input.key,
          opts: writeOpts,
          chunk,
          session_id: input.session_id,
          signal: input.signal,
          timeout_ms: writeTimeout,
        }),
      ),
    );
    const units: DeepEvidenceUnit[] = [];
    let att = 1;
    let tok = 0;
    for (let i = 0; i < chunkResults.length; i++) {
      const r = chunkResults[i]!;
      tok += r.tokens_used;
      att = Math.max(att, r.attempts);
      if (!r.ok) {
        const retry = await runDeepEvidenceWriteChunk({
          key: input.key,
          opts: writeOpts,
          chunk: chunks[i]!,
          session_id: input.session_id,
          signal: input.signal,
          timeout_ms: writeTimeout,
        });
        tok += retry.tokens_used;
        att = Math.max(att, retry.attempts + r.attempts);
        if (!retry.ok) {
          return {
            ok: false,
            reason: `deep_evidence:${retry.reason}:chunk${i}`,
            tokens: tok,
            attempts: att,
          };
        }
        units.push(...retry.units);
        continue;
      }
      units.push(...r.units);
    }
    return { ok: true, units, tokens: tok, attempts: att };
  }

  if (rewriteReason) {
    const rewriteOpts: DeepEvidencePromptOpts = {
      ...promptOpts,
      core_conclusion: `${promptOpts.core_conclusion}\n\n【纠错】上一合并稿未过闸（${rewriteReason}）。本 chunk 重写：机制更深；禁止跨单元雷同；P4 须落实锁定的 moat_class。`,
    };
    const rewritten = await writeAll(rewriteOpts);
    tokens_used += rewritten.tokens;
    attempts = Math.max(attempts, rewritten.attempts);
    if (!rewritten.ok) {
      return {
        ok: false,
        reason: rewritten.reason,
        tokens_used,
        attempts,
      };
    }
    const plan: DeepEvidencePlan = { page: input.key, units: rewritten.units };
    const quality = assessDeepEvidenceQuality(input.key, plan, {
      eastern_calc_slice: input.eastern_calc_slice,
      core_conclusion: input.core_conclusion,
      prior_chart_anchors: input.prior_chart_anchors,
      category_token_sets: input.category_token_sets,
    });
    if (!quality.ok) {
      return {
        ok: false,
        reason: `deep_evidence:${quality.reason}`,
        tokens_used,
        attempts,
      };
    }
    console.info("[delivery/deep-evidence] chunked ok after rewrite hop", {
      key: input.key,
      units: plan.units.length,
      quality_notes: quality.notes,
    });
    return { ok: true, plan, tokens_used, attempts, assignment };
  }

  const first = await writeAll(promptOpts);
  tokens_used += first.tokens;
  attempts = Math.max(attempts, first.attempts);
  if (!first.ok) {
    return { ok: false, reason: first.reason, tokens_used, attempts };
  }

  const plan: DeepEvidencePlan = { page: input.key, units: first.units };
  const quality = assessDeepEvidenceQuality(input.key, plan, {
    eastern_calc_slice: input.eastern_calc_slice,
    core_conclusion: input.core_conclusion,
    prior_chart_anchors: input.prior_chart_anchors,
    category_token_sets: input.category_token_sets,
  });
  if (!quality.ok) {
    if (opts?.defer_rewrite) {
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
        tokens_used,
        attempts,
      };
    }
    console.warn("[delivery/deep-evidence] merge quality fail — rewrite all chunks once", {
      key: input.key,
      reason: quality.reason,
      notes: quality.notes,
    });
    const rewriteOpts: DeepEvidencePromptOpts = {
      ...promptOpts,
      core_conclusion: `${promptOpts.core_conclusion}\n\n【纠错】上一合并稿未过闸（${quality.reason}）。本 chunk 重写：机制更深；禁止跨单元雷同；P4 须落实锁定的 moat_class。`,
    };
    const rewritten = await writeAll(rewriteOpts);
    tokens_used += rewritten.tokens;
    attempts += rewritten.attempts;
    if (!rewritten.ok) {
      return {
        ok: false,
        reason: `deep_evidence:${quality.reason}|rewrite:${rewritten.reason}`,
        tokens_used,
        attempts,
      };
    }
    const plan2: DeepEvidencePlan = { page: input.key, units: rewritten.units };
    const quality2 = assessDeepEvidenceQuality(input.key, plan2, {
      eastern_calc_slice: input.eastern_calc_slice,
      core_conclusion: input.core_conclusion,
      prior_chart_anchors: input.prior_chart_anchors,
      category_token_sets: input.category_token_sets,
    });
    if (!quality2.ok) {
      return {
        ok: false,
        reason: `deep_evidence:${quality2.reason}`,
        tokens_used,
        attempts,
      };
    }
    console.info("[delivery/deep-evidence] chunked ok after rewrite", {
      key: input.key,
      units: plan2.units.length,
      quality_notes: quality2.notes,
    });
    return { ok: true, plan: plan2, tokens_used, attempts, assignment };
  }

  console.info("[delivery/deep-evidence] chunked ok", {
    key: input.key,
    units: plan.units.length,
    quality_notes: quality.notes,
  });
  return { ok: true, plan, tokens_used, attempts, assignment };
}

/**
 * Assign (Call0) → parallel write chunks (Call1) → merge quality.
 * Inline rewrite when quality fails (legacy single-shot callers).
 */
export async function runDeepEvidenceCallChunked(
  input: DeepEvidenceCallInput,
): Promise<DeepEvidenceResult> {
  const promptOpts = buildPromptOpts(input);
  let tokens_used = 0;
  const assignTimeout = Math.min(input.timeout_ms ?? 60_000, 60_000);

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

  const written = await runDeepEvidenceWritesFromAssignment(
    input,
    assigned.assignment,
    { defer_rewrite: false },
  );
  return {
    ...written,
    tokens_used: tokens_used + written.tokens_used,
    attempts: "attempts" in written ? written.attempts : 1,
  } as DeepEvidenceResult;
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
  const timeoutUsed = input.timeout_ms ?? 200_000;

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
    'means 至少 1 条 type="timing"；白话须含「转折/窗口/切换/多久」之一（禁空喊纪元）',
  polarity:
    'means 至少 1 条 type="polarity"；白话须含「补给/消耗/靠近/远离/虚旺/补泻」之一（禁裸报用神忌神）',
  archetype:
    'means 至少 1 条 type="archetype"；白话须含「借势/开创/角色定位/格局/官杀气质」之一（禁裸报十神专名如正印）',
};

/** Format locked plan for narrative-compress fill user message. */
export function formatDeepEvidencePlanForCompress(plan: DeepEvidencePlan): string {
  const lines = [
    "【已锁定深度依据 · 正文压缩专用 · 禁止改锚/禁止另起盘外故事】",
    `page=${plan.page} · units=${plan.units.length}`,
  ];
  const moatLocks = plan.units.filter((u) => u.moat_class);
  if (plan.page === "metaphysics_action" && moatLocks.length > 0) {
    lines.push(
      "【护城河 means 锁（硬·整页必须兑现）】",
      "每个标了 moat_class 的 dimensions[i]：strategy+means 必须写出该类机制；means 用 JSON `{text,type}`，type 与 moat_class 一致。",
      "禁止整页只写 polarity；禁止用邮件/话术/日历等 P3 科学执行腔顶替东方机制。",
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
    lines.push(
      `### 单元 ${i + 1} · ${u.path}${moat}\nchart_anchors: ${u.chart_anchors.join("、")}\nprofessional_evidence:\n${u.evidence}`,
    );
  });
  lines.push(
    "压缩任务：把上述专业依据改写成大白话页内字段；各内容单元的 chart_anchors 必须原样复制上列；禁止引入新真词主承重。",
    plan.page === "metaphysics_action"
      ? "P4：锁定的 moat_class 必须落到对应维的 means.type + 机制白话；缺一类=废稿。"
      : plan.page === "foundation"
        ? "P2：按锁定 path 写 why_cards；surface 回溯【P2 表象候选菜单】；末卡收束「因此主辅成立」。"
        : plan.page === "science_action"
          ? "P3：按锁定 path 写 3+3 angles；strategy+means 回溯【P3 科学手段候选菜单】；禁合同剧本/东方色向清单。"
          : plan.page === "metaphysics_action"
            ? "P4：锁定 moat_class 须落到 means.type；strategy+means 回溯【P4 护城河手段候选菜单】；禁 P3 执行腔/物化补泻。"
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
      ? new Set<number>([1, Math.max(0, evidenceByBodyIndex.length - 1)])
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
