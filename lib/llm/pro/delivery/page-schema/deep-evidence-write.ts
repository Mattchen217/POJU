/**
 * Deep-evidence Call 1 chunk — write professional evidence for locked assignments.
 * One chunk = 1–3 units; chunks run in parallel. Delivery-phase only.
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_PAGE_TAGS } from "@/lib/llm/pro/delivery/delivery-schema";
import { PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS, PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS } from "@/lib/llm/pro/delivery/delivery-tasks";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import { POJU_KNOWLEDGE_ROOTS } from "@/lib/llm/prompts/poju-base";
import type { DeepEvidenceAssignmentUnit } from "./deep-evidence-assign";
import {
  isDeepEvidenceMechanismTag,
  type DeepEvidencePromptOpts,
  type DeepEvidenceUnit,
} from "./deep-evidence-prompt";

export function buildDeepEvidenceWriteChunkPrompt(
  key: DeliverySegmentKey,
  opts: DeepEvidencePromptOpts,
  chunk: readonly DeepEvidenceAssignmentUnit[],
): { system: string; user: string } {
  const tag = DELIVERY_PAGE_TAGS[key]?.zh ?? key;
  const lockLines = chunk
    .map((u, i) => {
      const moat = u.moat_class ? `\nmoat_class(硬): ${u.moat_class}` : "";
      return `### 单元 ${i + 1}
path: ${u.path}
chart_anchors(已锁·须全部出现在 evidence): ${u.chart_anchors.join("、")}
calc_cite(已锁·evidence 须扣此摘录起笔): ${u.calc_cite}
means_candidate_ref(已锁·机制须能回溯): ${u.means_candidate_ref}
unit_claim(已锁·本单元要证): ${u.unit_claim}${moat}`;
    })
    .join("\n\n");

  const moatHint =
    key === "metaphysics_action"
      ? `- 若单元标了 moat_class：evidence 必须写满该类机制（timing=转折/窗口/切换；polarity=用忌补泄；archetype=十神角色定位）。禁止空喊「纪元」无机制。
- 优先对齐【P4 护城河手段候选菜单】中同 type 且与 means_candidate_ref 对应的候选；本 chunk 只写给定单元。
- mechanism_tag：timing→window_switch；polarity→approach_avoid；archetype→role_stance。`
      : key === "foundation"
        ? `- why_cards 单元：evidence 须解释【P2 表象候选菜单】中与 means_candidate_ref 对齐的表象为何结构成立；贴题、可删依据自检。
- mechanism_tag 用 surface_why。本 chunk 只写给定 why_cards；禁止编造菜单外生活剧情。`
        : key === "science_action"
          ? `- angle 单元：evidence 须支撑【P3 科学手段候选菜单】中与 means_candidate_ref 对齐的策略维；机制链贴本案，删依据应垮。
- mechanism_tag 用 science_angle。本 chunk 只写给定 angles；禁止通用职场鸡汤。`
          : key === "risk_guard"
            ? `- 风险单元：依据须支撑熔断/切换处置链；mechanism_tag 用 fuse。`
            : `- 收束单元：依据须支撑仪式/身份落地；mechanism_tag 用 ritual。`;

  const system = [
    `# 你是谁\n你是交付页【深度依据·专写】专员。只为**已锁定**的单元写专业命理依据。`,
    POJU_KNOWLEDGE_ROOTS,
    `# 本步边界（硬）
- 【不是】用户可见白话；【是】带 ⟦w:真词⟧ 的专业依据。
- chart_anchors / calc_cite / unit_claim / means_candidate_ref 已锁——**先扣 calc_cite 与 unit_claim 起笔**，再写因→果→对本案题的机制链。
- chart_anchors 必须全部以 ⟦w:真词⟧ 出现在 evidence；**槽外连接语禁止再裸写其它命理专名**。
- 每条 evidence ≥两句机制链；禁止单句标签；本 chunk 内单元机制须不同质（禁止换皮同段）。
- 每条回传 mechanism_tag（闭集：window_switch|approach_avoid|role_stance|surface_why|science_angle|fuse|ritual）。
${moatHint}
- 输出严格 JSON，无 markdown 围栏。`,
    `# 输出形状
{
  "page": "${key}",
  "units": [
    {
      "path": "${chunk[0]?.path ?? "unit"}",
      "chart_anchors": ["真词"],
      "evidence": "⟦w:真词⟧ …（扣 cite · ≥两句机制）",
      "mechanism_tag": "window_switch"
    }
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
  userParts.push(
    `## 输出\n只输出 JSON：page="${key}", units 长度 ${chunk.length}；每条 path+chart_anchors+evidence+mechanism_tag。`,
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

  const byPath = new Map<
    string,
    { evidence: string; anchors: string[]; mechanism_tag: string | null }
  >();
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
    const tagRaw =
      typeof u.mechanism_tag === "string" ? u.mechanism_tag.trim() : "";
    if (path && evidence && /⟦w:/.test(evidence)) {
      byPath.set(path, {
        evidence,
        anchors,
        mechanism_tag: tagRaw || null,
      });
    }
  }

  const out: DeepEvidenceUnit[] = [];
  for (const locked of chunk) {
    const got = byPath.get(locked.path);
    if (!got) return null;
    const mechanism_tag =
      got.mechanism_tag && isDeepEvidenceMechanismTag(got.mechanism_tag)
        ? got.mechanism_tag
        : null;
    out.push({
      path: locked.path,
      chart_anchors: locked.chart_anchors,
      evidence: got.evidence,
      moat_class: locked.moat_class ?? null,
      calc_cite: locked.calc_cite,
      means_candidate_ref: locked.means_candidate_ref,
      unit_claim: locked.unit_claim,
      mechanism_tag,
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
  /**
   * Dispatch task attempt (1-based). Attempt ≥2 enables provider escape after
   * queue/midstream on the prior try within this call's loop.
   */
  dispatch_attempt?: number;
}): Promise<
  | { ok: true; units: DeepEvidenceUnit[]; tokens_used: number; attempts: number }
  | { ok: false; reason: string; tokens_used: number; attempts: number; fail_class?: string }
> {
  const { system, user: userBase } = buildDeepEvidenceWriteChunkPrompt(
    input.key,
    input.opts,
    input.chunk,
  );
  let tokens_used = 0;
  let lastReason = "unknown";
  let lastFailClass = "other";
  let user = userBase;
  const timeoutUsed = Math.min(
    input.timeout_ms ?? PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS,
    PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS,
  );
  // Shape/parse may retry once; transport timeout/abort must NOT — a second 180s
  // attempt in the same invoke races Vercel pre-kill and yields finish=`-`.
  const maxAttempts = 2;
  const { deliveryDispatchProviderBody } = await import(
    "@/lib/llm/pro/delivery/dispatch/provider-escape"
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (input.signal?.aborted) {
      return { ok: false, reason: "aborted", tokens_used, attempts: attempt };
    }
    const escapeAttempt =
      attempt >= 2 ? Math.max(2, input.dispatch_attempt ?? 2) : input.dispatch_attempt ?? 1;
    const provider = deliveryDispatchProviderBody(escapeAttempt);
    try {
      const result = await callLLM({
        call_type: "main_delivery",
        system,
        messages: [{ role: "user", content: user }],
        // Chunk writers share the full deep budget (8k previously starved xhigh reasoning).
        max_tokens: PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS,
        // Stay xhigh — quality path; parallelism replaces effort downgrade.
        thinking_effort: "xhigh",
        timeout_ms: timeoutUsed,
        response_format: "json",
        session_id: input.session_id,
        temperature: 0.35,
        max_attempts: deliveryTransportMaxAttempts(),
        signal: input.signal,
        provider,
        phase_name: "deep_evidence_write_chunk",
      });
      tokens_used += result.meta.tokens_used;
      const text = result.content?.trim() ?? "";
      if (!text) {
        lastReason = "empty_response";
        lastFailClass = "other";
        continue;
      }
      let parsed: unknown;
      try {
        parsed = extractJson(text);
      } catch {
        lastReason = "parse_fail";
        lastFailClass = "other";
        continue;
      }
      const units = parseWriteChunk(input.chunk, parsed);
      if (!units) {
        lastReason = "shape_fail";
        lastFailClass = "other";
        user = `${userBase}\n\n【纠错】必须覆盖本 chunk 全部 path；evidence 带 ⟦w:⟧；先扣 calc_cite/unit_claim；chart_anchors 与锁定表一致；回传 mechanism_tag。`;
        continue;
      }
      return { ok: true, units, tokens_used, attempts: attempt };
    } catch (e) {
      lastReason = e instanceof Error ? e.message : "llm_error";
      const cause =
        e instanceof Error && e.cause instanceof Error ? e.cause.message : null;
      const midstream =
        /socket hang up|other side closed|econnreset|und_err|network|fetch failed/i.test(
          `${lastReason} ${cause ?? ""}`,
        );
      lastFailClass = midstream
        ? "midstream_disconnect"
        : lastReason.includes("provider_queue")
          ? "provider_queue"
          : "other";
      console.warn("[delivery/deep-evidence] write-chunk error", {
        key: input.key,
        paths: input.chunk.map((c) => c.path),
        attempt,
        reason: lastReason,
        fail_class: lastFailClass,
        timeout_ms: timeoutUsed,
        provider_escape: escapeAttempt >= 2,
        will_retry: attempt < maxAttempts && !input.signal?.aborted && lastReason !== "llm_timeout",
      });
      // Hard timeout: don't stack another 200s in same invoke. User cancel: stop.
      if (lastReason === "llm_timeout" || input.signal?.aborted) {
        break;
      }
      // Midstream AbortError from provider → allow attempt 2 + DigitalOcean.
    }
  }
  return {
    ok: false,
    reason: `write_chunk:${lastReason}`,
    tokens_used,
    attempts: maxAttempts,
    fail_class: lastFailClass,
  };
}
