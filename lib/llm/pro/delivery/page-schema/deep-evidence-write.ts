/**
 * Deep-evidence Call 1 chunk — write professional evidence for locked assignments.
 * One chunk = 1–3 units; chunks run in parallel. Delivery-phase only.
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_PAGE_TAGS } from "@/lib/llm/pro/delivery/delivery-schema";
import { PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS } from "@/lib/llm/pro/delivery/delivery-tasks";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import { POJU_KNOWLEDGE_ROOTS } from "@/lib/llm/prompts/poju-base";
import type { DeepEvidenceAssignmentUnit } from "./deep-evidence-assign";
import type { DeepEvidencePromptOpts, DeepEvidenceUnit } from "./deep-evidence-prompt";

export function buildDeepEvidenceWriteChunkPrompt(
  key: DeliverySegmentKey,
  opts: DeepEvidencePromptOpts,
  chunk: readonly DeepEvidenceAssignmentUnit[],
): { system: string; user: string } {
  const tag = DELIVERY_PAGE_TAGS[key]?.zh ?? key;
  const lockLines = chunk
    .map((u, i) => {
      const moat = u.moat_class ? `\nmoat_class(硬): ${u.moat_class}` : "";
      return `### 单元 ${i + 1}\npath: ${u.path}\nchart_anchors(已锁·须全部出现在 evidence): ${u.chart_anchors.join("、")}${moat}`;
    })
    .join("\n\n");

  const moatHint =
    key === "metaphysics_action"
      ? `- 若单元标了 moat_class：evidence 必须写满该类机制（timing=转折/窗口/切换；polarity=用忌补泄；archetype=十神角色定位）。禁止空喊「纪元」无机制。
- 本 chunk 只写给定单元；不必协调其他维度覆盖率。`
      : `- 本 chunk 只写给定风险/护栏单元；依据须支撑该条处置链。`;

  const system = [
    `# 你是谁\n你是交付页【深度依据·专写】专员。只为**已锁定**的单元写专业命理依据。`,
    POJU_KNOWLEDGE_ROOTS,
    `# 本步边界（硬）
- 【不是】用户可见白话；【是】带 ⟦w:真词⟧ 的专业依据。
- chart_anchors 已锁——必须原样出现在 evidence 的 ⟦w:⟧ / 正文；禁止换锚、禁止另起盘外故事。
- 每条 evidence ≥两句机制链；禁止单句标签；禁止与其他单元逐字雷同（你只看见本 chunk）。
${moatHint}
- 输出严格 JSON，无 markdown 围栏。`,
    `# 输出形状
{
  "page": "${key}",
  "units": [
    { "path": "${chunk[0]?.path ?? "unit"}", "chart_anchors": ["真词"], "evidence": "⟦w:真词⟧ …" }
  ]
}
- units 条数必须 = ${chunk.length}；path / chart_anchors 必须与锁定表一致（anchors 原样回传）。`,
  ].join("\n\n");

  const userParts: string[] = [
    `## 本页\n固定标签【${tag}】 · key=${key}`,
    `## 本页 core_conclusion\n${opts.core_conclusion.trim() || "(空)"}`,
    `## 本 chunk 锁定表\n${lockLines}`,
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
  if (opts.action_brief_block?.trim()) {
    userParts.push(opts.action_brief_block.trim());
  }
  if (opts.reality_constraints?.trim()) {
    userParts.push(opts.reality_constraints.trim());
  }
  userParts.push(
    `## 输出\n只输出 JSON：page="${key}", units 长度 ${chunk.length}。`,
  );

  return { system, user: userParts.join("\n\n") };
}

function parseWriteChunk(
  chunk: readonly DeepEvidenceAssignmentUnit[],
  raw: unknown,
): DeepEvidenceUnit[] | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const list = Array.isArray(o.units) ? o.units : null;
  if (!list) return null;

  const byPath = new Map<string, { evidence: string; anchors: string[] }>();
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const u = item as Record<string, unknown>;
    const path = typeof u.path === "string" ? u.path.trim() : "";
    const evidence =
      typeof u.evidence === "string"
        ? u.evidence.trim()
        : typeof u.professional_evidence === "string"
          ? u.professional_evidence.trim()
          : "";
    const anchors = Array.isArray(u.chart_anchors)
      ? u.chart_anchors.map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (path && evidence && /⟦w:/.test(evidence)) {
      byPath.set(path, { evidence, anchors });
    }
  }

  const out: DeepEvidenceUnit[] = [];
  for (const locked of chunk) {
    const got = byPath.get(locked.path);
    if (!got) return null;
    // Prefer locked anchors (assignment SSOT); model may echo them.
    // moat_class is Call0 SSOT — writers never invent/drop it.
    out.push({
      path: locked.path,
      chart_anchors: locked.chart_anchors,
      evidence: got.evidence,
      moat_class: locked.moat_class ?? null,
    });
  }
  return out;
}

export async function runDeepEvidenceWriteChunk(input: {
  key: DeliverySegmentKey;
  opts: DeepEvidencePromptOpts;
  chunk: readonly DeepEvidenceAssignmentUnit[];
  session_id?: string;
  signal?: AbortSignal;
  timeout_ms?: number;
}): Promise<
  | { ok: true; units: DeepEvidenceUnit[]; tokens_used: number; attempts: number }
  | { ok: false; reason: string; tokens_used: number; attempts: number }
> {
  const { system, user: userBase } = buildDeepEvidenceWriteChunkPrompt(
    input.key,
    input.opts,
    input.chunk,
  );
  let tokens_used = 0;
  let lastReason = "unknown";
  let user = userBase;
  const timeoutUsed = input.timeout_ms ?? 100_000;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (input.signal?.aborted) {
      return { ok: false, reason: "aborted", tokens_used, attempts: attempt };
    }
    try {
      const result = await callLLM({
        call_type: "main_delivery",
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: Math.min(PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS, 8_000),
        // Stay xhigh — quality path; parallelism replaces effort downgrade.
        thinking_effort: "xhigh",
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
      const units = parseWriteChunk(input.chunk, parsed);
      if (!units) {
        lastReason = "shape_fail";
        user = `${userBase}\n\n【纠错】必须覆盖本 chunk 全部 path；evidence 带 ⟦w:⟧；chart_anchors 与锁定表一致。`;
        continue;
      }
      return { ok: true, units, tokens_used, attempts: attempt };
    } catch (e) {
      lastReason = e instanceof Error ? e.message : "llm_error";
      console.warn("[delivery/deep-evidence] write-chunk error", {
        key: input.key,
        paths: input.chunk.map((c) => c.path),
        attempt,
        reason: lastReason,
      });
    }
  }
  return {
    ok: false,
    reason: `write_chunk:${lastReason}`,
    tokens_used,
    attempts: maxAttempts,
  };
}
