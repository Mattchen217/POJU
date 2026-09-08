/**
 * Deep-evidence Call 0 — assign path → moat_class (P4) + chart_anchors only.
 * No long evidence. Delivery-phase only.
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_PAGE_TAGS } from "@/lib/llm/pro/delivery/delivery-schema";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import type { P4MoatMeansType } from "@/lib/glossary/wuxing-semantic-ssot";
import { inferP4MoatEligibleTypes } from "./p4-means-gate";
import {
  deepEvidenceUnitSpec,
  type DeepEvidencePromptOpts,
} from "./deep-evidence-prompt";
import {
  formatAnchorCategoryUsageForPrompt,
  tallyAnchorCategoryUsage,
} from "./anchor-category-tally";
import { formatLayerBInventoryMenu } from "./layer-b-inventory-menu";

export type DeepEvidenceAssignmentUnit = {
  path: string;
  chart_anchors: string[];
  /** P4 only — locked before write so archetype cannot be squeezed out. */
  moat_class?: P4MoatMeansType | null;
};

export type DeepEvidenceAssignment = {
  page: DeliverySegmentKey;
  units: DeepEvidenceAssignmentUnit[];
};

/** Deterministic round-robin so every eligible moat class gets ≥1 unit. */
export function distributeP4MoatTargets(
  eligible: ReadonlySet<P4MoatMeansType>,
  unitCount: number,
): Array<P4MoatMeansType | null> {
  const n = Math.max(1, unitCount);
  const list = [...eligible];
  if (list.length === 0) return Array.from({ length: n }, () => null);
  const out: Array<P4MoatMeansType | null> = Array.from({ length: n }, () => null);
  // First pass: one slot per eligible class
  for (let i = 0; i < list.length && i < n; i++) {
    out[i] = list[i]!;
  }
  // Remainder: continue round-robin
  for (let i = list.length; i < n; i++) {
    out[i] = list[i % list.length]!;
  }
  return out;
}

/** P4 default unit count: enough to cover eligible classes without monolithic 6. */
export function resolveDeepEvidenceUnitCount(
  key: DeliverySegmentKey,
  eligibleSize: number,
): number {
  const spec = deepEvidenceUnitSpec(key);
  if (key === "metaphysics_action") {
    const target = Math.max(spec.min, Math.min(spec.max, Math.max(3, eligibleSize * 2)));
    return target;
  }
  return Math.min(spec.max, Math.max(spec.min, spec.paths.length));
}

export function chunkPaths<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, size);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) {
    out.push([...items.slice(i, i + n)]);
  }
  return out;
}

export function buildDeepEvidenceAssignPrompt(
  key: DeliverySegmentKey,
  opts: DeepEvidencePromptOpts,
  planned: readonly { path: string; moat_class?: P4MoatMeansType | null }[],
): { system: string; user: string } {
  const tag = DELIVERY_PAGE_TAGS[key]?.zh ?? key;
  const tally = tallyAnchorCategoryUsage(
    opts.prior_chart_anchors ?? [],
    opts.category_token_sets,
  );
  const layerA = formatAnchorCategoryUsageForPrompt(tally);
  const layerB = formatLayerBInventoryMenu(opts.category_token_sets);

  const planLines = planned
    .map((p, i) => {
      const moat = p.moat_class ? ` moat_class=${p.moat_class}` : "";
      return `${i + 1}. path=${p.path}${moat}`;
    })
    .join("\n");

  const system = `# 你是谁
你是交付页【深度依据·派工】专员。只做一件事：为每个 path 选闭集 chart_anchors。

# 边界（硬）
- 【不写】evidence / 白话正文 / means。
- 【只写】每个 path 的 chart_anchors（1–4 个真词）。
- 若给定 moat_class：锚点必须服务该类（timing=大运/岁运窗；polarity=用神忌神补泄；archetype=十神/格局角色）。
- 真词来自闭集菜单；禁止编造；跨 path 锚点勿整页雷同。
- 输出严格 JSON，无 markdown 围栏。

# 输出形状
{
  "page": "${key}",
  "units": [
    { "path": "${planned[0]?.path ?? "unit[0]"}", "chart_anchors": ["真词"] }
  ]
}
- units 条数必须 = ${planned.length}；path 必须与派工表一致。`;

  const userParts: string[] = [
    `## 本页\n固定标签【${tag}】 · key=${key}`,
    `## 本页 core_conclusion\n${opts.core_conclusion.trim() || "(空)"}`,
    `## 派工表（锁死 path / moat；你只填锚）\n${planLines}`,
  ];
  if (opts.eastern_calc_slice?.trim()) {
    userParts.push(`## 本地真算料\n${opts.eastern_calc_slice.trim()}`);
  }
  if (opts.risk_calc_slice?.trim()) {
    userParts.push(`## 熔断算料\n${opts.risk_calc_slice.trim()}`);
  }
  if (opts.question_expectation?.trim()) {
    userParts.push(`## 问题与期望\n${opts.question_expectation.trim()}`);
  }
  if (key === "foundation" && opts.foundation_surface_feed?.trim()) {
    userParts.push(opts.foundation_surface_feed.trim());
  }
  if (key === "science_action" && opts.science_means_feed?.trim()) {
    userParts.push(opts.science_means_feed.trim());
  }
  if (key === "metaphysics_action" && opts.metaphysics_moat_feed?.trim()) {
    userParts.push(opts.metaphysics_moat_feed.trim());
  }
  if (key === "risk_guard" && opts.risk_fuse_feed?.trim()) {
    userParts.push(opts.risk_fuse_feed.trim());
  }
  if (key === "signals_close" && opts.close_ritual_feed?.trim()) {
    userParts.push(opts.close_ritual_feed.trim());
  }
  if (
    (key === "risk_guard" || key === "signals_close") &&
    opts.action_brief_block?.trim()
  ) {
    userParts.push(opts.action_brief_block.trim());
  }
  if (opts.structured_inventory?.trim()) {
    userParts.push(`【闭集】\n${opts.structured_inventory.trim()}`);
  }
  userParts.push(layerA, layerB);
  userParts.push(
    `## 输出\n只输出 JSON：page="${key}", units 长度 ${planned.length}，每条 path+chart_anchors。`,
  );

  return { system, user: userParts.join("\n\n") };
}

export function parseDeepEvidenceAssignment(
  key: DeliverySegmentKey,
  raw: unknown,
  planned: readonly { path: string; moat_class?: P4MoatMeansType | null }[],
): DeepEvidenceAssignment | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const list = Array.isArray(o.units) ? o.units : null;
  if (!list || list.length < planned.length) return null;

  const byPath = new Map<string, string[]>();
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const u = item as Record<string, unknown>;
    const path = typeof u.path === "string" ? u.path.trim() : "";
    const anchors = Array.isArray(u.chart_anchors)
      ? u.chart_anchors.map((x) => String(x).trim()).filter(Boolean).slice(0, 4)
      : [];
    if (path && anchors.length >= 1) byPath.set(path, anchors);
  }

  const units: DeepEvidenceAssignmentUnit[] = [];
  for (const p of planned) {
    const anchors = byPath.get(p.path);
    if (!anchors?.length) return null;
    units.push({
      path: p.path,
      chart_anchors: anchors,
      moat_class: p.moat_class ?? null,
    });
  }
  return { page: key, units };
}

/** Build planned paths (+ P4 moat targets) before assign LLM. */
export function planDeepEvidenceSlots(
  key: DeliverySegmentKey,
  eastern_calc_slice?: string | null,
): Array<{ path: string; moat_class?: P4MoatMeansType | null }> {
  const spec = deepEvidenceUnitSpec(key);
  if (key === "metaphysics_action") {
    const eligible = inferP4MoatEligibleTypes(eastern_calc_slice);
    const count = resolveDeepEvidenceUnitCount(key, eligible.size);
    const targets = distributeP4MoatTargets(eligible, count);
    return Array.from({ length: count }, (_, i) => ({
      path: spec.paths[i] ?? `dimensions[${i}]`,
      moat_class: targets[i] ?? null,
    }));
  }
  const count = resolveDeepEvidenceUnitCount(key, 0);
  return Array.from({ length: count }, (_, i) => ({
    path: spec.paths[i] ?? `unit[${i}]`,
    moat_class: null,
  }));
}

export async function runDeepEvidenceAssignCall(input: {
  key: DeliverySegmentKey;
  opts: DeepEvidencePromptOpts;
  session_id?: string;
  signal?: AbortSignal;
  timeout_ms?: number;
}): Promise<
  | { ok: true; assignment: DeepEvidenceAssignment; tokens_used: number }
  | { ok: false; reason: string; tokens_used: number }
> {
  const planned = planDeepEvidenceSlots(input.key, input.opts.eastern_calc_slice);
  const { system, user: userBase } = buildDeepEvidenceAssignPrompt(
    input.key,
    input.opts,
    planned,
  );
  let tokens_used = 0;
  let lastReason = "unknown";
  let user = userBase;
  const timeoutUsed = input.timeout_ms ?? 60_000;

  for (let attempt = 1; attempt <= 2; attempt++) {
    if (input.signal?.aborted) {
      return { ok: false, reason: "aborted", tokens_used };
    }
    try {
      const result = await callLLM({
        call_type: "main_delivery",
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: 4_000,
        thinking_effort: "high",
        timeout_ms: timeoutUsed,
        response_format: "json",
        session_id: input.session_id,
        temperature: 0.25,
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
      const assignment = parseDeepEvidenceAssignment(input.key, parsed, planned);
      if (!assignment) {
        lastReason = "shape_fail";
        user = `${userBase}\n\n【纠错】units 须覆盖全部派工 path，且每条 ≥1 chart_anchors。`;
        continue;
      }
      console.info("[delivery/deep-evidence] assign ok", {
        key: input.key,
        units: assignment.units.length,
        moats: assignment.units.map((u) => u.moat_class).filter(Boolean),
      });
      return { ok: true, assignment, tokens_used };
    } catch (e) {
      lastReason = e instanceof Error ? e.message : "llm_error";
    }
  }
  return { ok: false, reason: `assign:${lastReason}`, tokens_used };
}
