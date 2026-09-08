/**
 * Deep-evidence Call 0 — assign path → moat_class (P4) + chart_anchors only.
 * No long evidence. Delivery-phase only.
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_PAGE_TAGS } from "@/lib/llm/pro/delivery/delivery-schema";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import { PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS } from "@/lib/llm/pro/delivery/delivery-tasks";
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
  /** Short quote from 真算料 / risk calc (≤80 chars) — Write must open from this. */
  calc_cite: string;
  /** Menu line id or short label (e.g. 时机候选1 / 科学维2) for Fill means growth. */
  means_candidate_ref: string;
  /** One-line structural claim this unit must prove. */
  unit_claim: string;
};

export type DeepEvidenceAssignment = {
  page: DeliverySegmentKey;
  units: DeepEvidenceAssignmentUnit[];
};

/** Assign-time: anchors must already carry the moat class (before write). */
const MOAT_ASSIGN_ANCHOR_HINT: Record<P4MoatMeansType, string> = {
  timing: "≥1 词须匹配 /大运|流年|岁运|气候交织|交运|起运|运程/（可另加辅锚）",
  polarity: "≥1 词须匹配 /用神|忌神|喜神|身弱|身强|补泄|五行/（可另加辅锚）",
  archetype: "≥1 词须为十神/格局角色（比肩劫财食伤财官杀印等）",
};

/**
 * True when locked chart_anchors already serve the unit's moat_class.
 * Timing must cite a phase token at assign — write cannot invent 大运 from 食神 alone.
 */
export function anchorsServeMoatClass(
  anchors: readonly string[],
  moat: P4MoatMeansType,
): boolean {
  const blob = anchors.join(" ");
  if (moat === "timing") {
    return /大运|流年|岁运|气候交织|交运|起运|运程|岁环|纪元/.test(blob);
  }
  if (moat === "polarity") {
    return /用神|忌神|喜神|身弱|身强|补泄|五行/.test(blob);
  }
  return /(比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印|十神|官杀|格局)/.test(
    blob,
  );
}

/** Returns first failing path reason, or null if all moat slots ok. */
export function validateAssignmentMoatAnchors(
  assignment: DeepEvidenceAssignment,
): string | null {
  for (const u of assignment.units) {
    const moat = u.moat_class;
    if (!moat) continue;
    if (!anchorsServeMoatClass(u.chart_anchors, moat)) {
      return `moat_anchor_mismatch:${u.path}:${moat}`;
    }
  }
  return null;
}

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
你是交付页【深度依据·派工】专员。为每个 path 锁路由绑定（锚 + 真算摘录 + 主张 + 菜单回溯），不写长 evidence。

# 边界（硬）
- 【不写】长 evidence / 白话正文 / means 正文。
- 【每条 unit 必填】chart_anchors(1–4) + calc_cite + means_candidate_ref + unit_claim。
- calc_cite：从真算料/熔断料/候选菜单**整份**摘 ≤80 字短句（可跨段；禁止空泛）。
- means_candidate_ref：回溯菜单短标签（如「时机候选1」「极性候选2」「表象候选3」「科学维1」「熔断候选1」）。
- unit_claim：一句「本单元要证的结构主张」（给 Write/Fill 当靶心）。
- 若给定 moat_class：锚点必须服务该类——**至少 1 个主承重词对上类**（可再加 0–3 个辅锚）：
  - timing → ${MOAT_ASSIGN_ANCHOR_HINT.timing}
  - polarity → ${MOAT_ASSIGN_ANCHOR_HINT.polarity}
  - archetype → ${MOAT_ASSIGN_ANCHOR_HINT.archetype}
- 【扫料范围】moat/绑定可从**整份**真算料点词，禁止「dimensions[i] 只能用第 i 条段落」。
- 真词来自闭集菜单；禁止编造；跨 path 锚点勿整页雷同。
- 【推理纪律】禁止逐维长篇推演。点完立刻输出 JSON。
- 输出严格 JSON，无 markdown 围栏。

# 输出形状
{
  "page": "${key}",
  "units": [
    {
      "path": "${planned[0]?.path ?? "unit[0]"}",
      "chart_anchors": ["真词"],
      "calc_cite": "真算短摘录",
      "means_candidate_ref": "菜单短标签",
      "unit_claim": "本单元要证的一句结构主张"
    }
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
    `## 输出\n只输出 JSON：page="${key}", units 长度 ${planned.length}，每条 path+chart_anchors+calc_cite+means_candidate_ref+unit_claim。`,
  );

  return { system, user: userParts.join("\n\n") };
}

function trimAssignField(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, max);
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

  type ParsedBind = {
    chart_anchors: string[];
    calc_cite: string;
    means_candidate_ref: string;
    unit_claim: string;
  };
  const byPath = new Map<string, ParsedBind>();
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const u = item as Record<string, unknown>;
    const path = typeof u.path === "string" ? u.path.trim() : "";
    const anchors = Array.isArray(u.chart_anchors)
      ? u.chart_anchors.map((x) => String(x).trim()).filter(Boolean).slice(0, 4)
      : [];
    const calc_cite = trimAssignField(u.calc_cite ?? u.cite, 80);
    const means_candidate_ref = trimAssignField(
      u.means_candidate_ref ?? u.candidate_ref ?? u.menu_ref,
      48,
    );
    const unit_claim = trimAssignField(u.unit_claim ?? u.claim, 120);
    if (
      path &&
      anchors.length >= 1 &&
      calc_cite.length >= 4 &&
      means_candidate_ref.length >= 2 &&
      unit_claim.length >= 6
    ) {
      byPath.set(path, { chart_anchors: anchors, calc_cite, means_candidate_ref, unit_claim });
    }
  }

  const units: DeepEvidenceAssignmentUnit[] = [];
  for (const p of planned) {
    const bind = byPath.get(p.path);
    if (!bind) return null;
    units.push({
      path: p.path,
      chart_anchors: bind.chart_anchors,
      moat_class: p.moat_class ?? null,
      calc_cite: bind.calc_cite,
      means_candidate_ref: bind.means_candidate_ref,
      unit_claim: bind.unit_claim,
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
  /** Dispatch task attempt (1-based) — enables provider escape on attempt ≥2. */
  dispatch_attempt?: number;
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
  const timeoutUsed = input.timeout_ms ?? PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS;
  /** Ceiling shared with reasoning+JSON — never lower thinking_effort on retry (no degrade). */
  const ASSIGN_MAX_TOKENS = 20_000;
  const { deliveryDispatchProviderBody } = await import(
    "@/lib/llm/pro/delivery/dispatch/provider-escape"
  );

  for (let attempt = 1; attempt <= 2; attempt++) {
    if (input.signal?.aborted) {
      return { ok: false, reason: "aborted", tokens_used };
    }
    // Attempt 2 always opens DigitalOcean escape after any soft fail (incl. finish=`-` empty).
    const escapeAttempt =
      attempt >= 2 ? Math.max(2, input.dispatch_attempt ?? 2) : input.dispatch_attempt ?? 1;
    const provider = deliveryDispatchProviderBody(escapeAttempt);
    try {
      const result = await callLLM({
        call_type: "main_delivery",
        phase_name: "deep_evidence_assign",
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: ASSIGN_MAX_TOKENS,
        thinking_effort: "high",
        timeout_ms: timeoutUsed,
        response_format: "json",
        session_id: input.session_id,
        temperature: 0.25,
        max_attempts: deliveryTransportMaxAttempts(),
        signal: input.signal,
        provider,
      });
      tokens_used += result.meta.tokens_used;
      const finish = result.meta.finish_reason ?? null;
      const text = result.content?.trim() ?? "";
      if (!text) {
        lastReason =
          finish === "length" || finish == null
            ? `empty_after_${finish ?? "null_finish"}`
            : "empty_response";
        console.warn("[delivery/deep-evidence] assign empty/truncated — will retry if budget", {
          key: input.key,
          attempt,
          finish_reason: finish,
          completion_tokens: result.meta.completion_tokens ?? null,
          next_escape: attempt < 2,
        });
        user = `${userBase}\n\n【纠错】上一稿无可见 JSON（finish=${finish ?? "null"}）。点完锚点后立刻输出完整 units JSON。`;
        continue;
      }
      if (finish === "length") {
        console.warn("[delivery/deep-evidence] assign finish_reason=length", {
          key: input.key,
          attempt,
          content_len: text.length,
          completion_tokens: result.meta.completion_tokens ?? null,
        });
      }
      let parsed: unknown;
      try {
        parsed = extractJson(text);
      } catch {
        lastReason = finish === "length" ? "parse_fail_length" : "parse_fail";
        user = `${userBase}\n\n【纠错】上一稿 JSON 不完整。点完锚点后立刻输出完整 units 数组。`;
        continue;
      }
      const assignment = parseDeepEvidenceAssignment(input.key, parsed, planned);
      if (!assignment) {
        lastReason = "shape_fail";
        user = `${userBase}\n\n【纠错】units 须覆盖全部派工 path；每条须含 chart_anchors(≥1)+calc_cite+means_candidate_ref+unit_claim。`;
        continue;
      }
      const moatFail = validateAssignmentMoatAnchors(assignment);
      if (moatFail) {
        lastReason = moatFail;
        console.warn("[delivery/deep-evidence] assign moat-anchor mismatch", {
          key: input.key,
          attempt,
          reason: moatFail,
        });
        user = `${userBase}\n\n【纠错·moat】${moatFail}。timing 槽须含大运/流年/岁运/气候交织等；polarity 须含用神/忌神/身弱等；archetype 须含十神角色。从整份真算料重点，立刻输出完整 JSON。`;
        continue;
      }
      console.info("[delivery/deep-evidence] assign ok", {
        key: input.key,
        units: assignment.units.length,
        moats: assignment.units.map((u) => u.moat_class).filter(Boolean),
        attempt,
        finish_reason: finish,
        provider_escape: escapeAttempt >= 2,
      });
      return { ok: true, assignment, tokens_used };
    } catch (e) {
      lastReason = e instanceof Error ? e.message : "llm_error";
      const aborted =
        input.signal?.aborted ||
        lastReason === "AbortError" ||
        /aborterror|this operation was aborted/i.test(lastReason);
      console.warn("[delivery/deep-evidence] assign error", {
        key: input.key,
        attempt,
        reason: lastReason,
        provider_escape: escapeAttempt >= 2,
        will_retry: attempt < 2 && !aborted,
      });
      // Only user/job cancel stops the 1+1 loop. Transport abort midstream → retry + escape.
      if (aborted && input.signal?.aborted) break;
      if (lastReason === "llm_timeout") {
        // Timeout already burned most of the 300s invoke — retry via DAG/QStash, not in-process.
        break;
      }
    }
  }
  return { ok: false, reason: `assign:${lastReason}`, tokens_used };
}
