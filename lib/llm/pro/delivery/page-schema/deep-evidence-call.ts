/**
 * Batch 3 · Call 1 — deep evidence (anchors + professional ⟦w:⟧ evidence).
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliveryArgumentTree } from "@/lib/llm/pro/delivery/delivery-schema";
import { PAGE_SCHEMA_FILL_MAX_TOKENS } from "@/lib/llm/pro/delivery/delivery-tasks";
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
import { pageSchemaToArgumentBodies } from "./render";

export type { DeepEvidencePlan, DeepEvidenceUnit } from "./deep-evidence-prompt";

export type DeepEvidenceOk = {
  ok: true;
  plan: DeepEvidencePlan;
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

export async function runDeepEvidenceCall(input: {
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
  structured_inventory?: string;
  prior_chart_anchors?: readonly string[];
  category_token_sets?: CategoryTokenSets | null;
  action_brief_block?: string;
}): Promise<DeepEvidenceResult> {
  const promptOpts: DeepEvidencePromptOpts = {
    locale: input.locale,
    core_conclusion: input.core_conclusion,
    bazi_basis: input.bazi_basis,
    page_plan_slice: input.page_plan_slice,
    eastern_calc_slice: input.eastern_calc_slice,
    risk_calc_slice: input.risk_calc_slice,
    question_expectation: input.question_expectation,
    primary_backup_hint: input.primary_backup_hint,
    reality_constraints: input.reality_constraints,
    structured_inventory: input.structured_inventory,
    prior_chart_anchors: input.prior_chart_anchors,
    category_token_sets: input.category_token_sets,
    action_brief_block: input.action_brief_block,
  };
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
        max_tokens: PAGE_SCHEMA_FILL_MAX_TOKENS,
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
      console.info("[delivery/deep-evidence] ok", {
        key: input.key,
        attempt,
        units: plan.units.length,
        thinking_effort: currentEffort,
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

/** Format locked plan for narrative-compress fill user message. */
export function formatDeepEvidencePlanForCompress(plan: DeepEvidencePlan): string {
  const lines = [
    "【已锁定深度依据 · 正文压缩专用 · 禁止改锚/禁止另起盘外故事】",
    `page=${plan.page} · units=${plan.units.length}`,
  ];
  plan.units.forEach((u, i) => {
    lines.push(
      `### 单元 ${i + 1} · ${u.path}\nchart_anchors: ${u.chart_anchors.join("、")}\nprofessional_evidence:\n${u.evidence}`,
    );
  });
  lines.push(
    "压缩任务：把上述专业依据改写成大白话页内字段；各内容单元的 chart_anchors 必须原样复制上列；禁止引入新真词主承重。",
  );
  return lines.join("\n\n");
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
      evidenceByBodyIndex[1] = id?.evidence ?? units[0]?.evidence ?? "";
      const tonight = takeUnit(["tonight"], 1);
      if (tonight) evidenceByBodyIndex[2] = tonight.evidence;
      for (let i = 0; i < page.day7_micro_actions.length; i++) {
        const u = takeUnit([`day7_micro_actions[${i}]`], 2 + i);
        evidenceByBodyIndex[3 + i] = u?.evidence ?? "";
      }
      const last = evidenceByBodyIndex.length - 1;
      if (last >= 0) {
        evidenceByBodyIndex[last] =
          tonight?.evidence ?? id?.evidence ?? units[0]?.evidence ?? "";
      }
      break;
    }
    default: {
      for (let i = 0; i < Math.min(bodies.length, units.length); i++) {
        evidenceByBodyIndex[i] = units[i]!.evidence;
      }
    }
  }

  let ui = 0;
  for (let i = 0; i < evidenceByBodyIndex.length; i++) {
    if (evidenceByBodyIndex[i]?.trim()) continue;
    if (ui >= units.length) break;
    evidenceByBodyIndex[i] = units[ui]!.evidence;
    ui += 1;
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
