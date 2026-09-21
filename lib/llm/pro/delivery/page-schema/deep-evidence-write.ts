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
import {
  extractKnownThirdParties,
  softRepairWriteEvidenceProse,
} from "@/lib/llm/pro/delivery/thesis/third-party-agency";
import { judgmentOffChartReason } from "@/lib/llm/pro/delivery/page-schema/chart-fact-pack";
import {
  assessDeepEvidenceUnitDepth,
  softStripUnmatchedDeepEvidenceAnchors,
  stripSoftPaddingEvidence,
} from "@/lib/llm/pro/delivery/page-schema/deep-evidence-quality";

export function buildDeepEvidenceWriteChunkPrompt(
  key: DeliverySegmentKey,
  opts: DeepEvidencePromptOpts,
  chunk: readonly DeepEvidenceAssignmentUnit[],
): { system: string; user: string } {
  const tag = DELIVERY_PAGE_TAGS[key]?.zh ?? key;
  const factPack = Boolean(opts.chart_fact_pack?.trim());
  const lockLines = chunk
    .map((u, i) => {
      const moat = u.moat_class ? `\nmoat_class(硬): ${u.moat_class}` : "";
      const signals =
        u.necessary_signals && u.necessary_signals.length > 0
          ? `\nnecessary_signals:\n${u.necessary_signals
              .map((s) => {
                const dim = s.dimension_id ? ` | dim=${s.dimension_id}` : "";
                const inf = s.inference_zh
                  ? ` | inference_zh=${s.inference_zh}`
                  : "";
                return `  - slug=${s.slug}${dim}${inf} | role=${s.role} | why_needed=${s.why_needed}`;
              })
              .join("\n")}`
          : "";
      const rationale = u.signal_count_rationale
        ? `\nsignal_count_rationale: ${u.signal_count_rationale}`
        : "";
      const anchorLine = factPack
        ? ""
        : `\nchart_anchors(已锁·须全部出现在 evidence): ${u.chart_anchors.join("、")}`;
      return `### 单元 ${i + 1}
path: ${u.path}${anchorLine}
calc_cite(已锁·evidence 须扣此摘录起笔): ${u.calc_cite}
means_candidate_ref(已锁·机制须能回溯): ${u.means_candidate_ref}
unit_claim(已锁·本单元要证): ${u.unit_claim}${moat}${signals}${rationale}`;
    })
    .join("\n\n");

  const moatHint =
    key === "metaphysics_action"
      ? `- 若单元标了 moat_class：evidence 必须写满该类机制（timing=转折/窗口/切换；polarity=用忌补泄；archetype=十神角色定位）。禁止空喊「纪元」无机制。
- 优先对齐【P4 护城河手段候选菜单】中同 type 且与 means_candidate_ref 对应的候选；本 chunk 只写给定单元。
- mechanism_tag：timing→window_switch；polarity→approach_avoid；archetype→role_stance。`
      : key === "foundation"
        ? `- why_cards：evidence **只展开本卡 unit_claim 这一条关系**。主张与摘录已由派工锁定，禁止另起一条合冲刑害半合，禁止另起一套十神故事。
- mechanism_tag 固定 surface_why。禁止把问题、期望、处境、职业、话语权写进 evidence。`
        : key === "science_action"
          ? `- angle 单元：evidence 须支撑【P3 科学手段候选菜单】中与 means_candidate_ref 对齐的策略维；机制链贴本案，删依据应垮。
- mechanism_tag 用 science_angle。本 chunk 只写给定 angles；禁止通用职场鸡汤。`
          : key === "risk_guard"
            ? `- 风险单元：依据须支撑熔断/切换处置链；mechanism_tag 用 fuse。`
            : `- 收束单元：依据须支撑仪式/身份落地；mechanism_tag 用 ritual。`;

  const JUDGMENT_CYCLE_BLOCK = `# 闭集表（写生克只能用表内方向 · 全表 · 禁止表外）
五行生：木生火、火生土、土生金、金生水、水生木。
五行克：木克土、土克水、水克火、火克金、金克木。
十神生：印生比、比生食、食生财、财生官、官生印。（印=正印|偏印；比=比肩|劫财；食=食神|伤官；财=正财|偏财；官=正官|七杀）
十神克：比克财、食克官、财克印、印克食、官克比。
写「克 / 生 / 受 / 被」时，双方都必须写明，且方向必须落在上表。禁止无主的「用神受克」「喜神被制」。禁止表外方向。`;

  const system = factPack
    ? [
        `# 你是谁\n你是交付页【深度依据·专写】专员。按【本盘事实档】为每张卡写完整命理批断。`,
        POJU_KNOWLEDGE_ROOTS,
        JUDGMENT_CYCLE_BLOCK,
        `# 本步边界（硬）
- 【不是】用户可见白话；【是】本盘命理批断原文。依据槽将原样展示这段批断。
- 只写本卡 unit_claim 所需要的命理展开。需要几个结构词写几个，不设上限，也禁止注水。事实档与本地真算料里与本卡有关的结构都要能进批断，禁止为省事只写一句空壳。
- 允许日主、用神、喜神、忌神、藏干、四柱、得令得地、大运流年，只要指的是【本盘事实档】或【本地真算料】。
- 直接写命理句子。禁止任何标记：不要 ⟦w:⟧、不要 ⟦t:⟧、不要 ⟦词:⟧、不要自造术语、不要软译。
- 禁止：档里没有的干支、没算过的神煞、永禁词。
- 先扣 calc_cite 与 unit_claim，再写因→果。不要为凑数把整份档抄一遍；也不要因为材料多就改写处境叙事。
- 【一句一结构】每句只写一个命理结构动作（合冲刑害 / 生克 / 透藏 / 用喜忌归属）。禁止感受腔、禁止职业与话语权白话、禁止「亦暗示 / 可借 / 润局」类尾巴。即便 user 侧误带了问题或处境，也不得写进 evidence。
- 【地支十神】地支上的具体十神只能是该支**本气**对日主的十神。柱干的十神写在天干上（如月柱天干为正印），禁止把柱干十神贴到地支上。
- 【大运】禁止「大运+干支+一个十神」整步粘贴。大运天干与大运地支本气分开写。
- 【本卡边界】evidence 不得出现 unit_claim 以外的另一对地支合冲刑害半合。
- 【句读深度】每条 evidence 用 \`。\` / \`！\` / \`？\` / \`；\` 分成 **≥2 句**（每句≥4字）。禁止逗号串成一句。
- 本 chunk 内各单元批断不得换皮同段。
- 每条回传 mechanism_tag（闭集：window_switch|approach_avoid|role_stance|surface_why|science_angle|fuse|ritual）。
${moatHint}
- 输出严格 JSON，无 markdown 围栏。`,
        `# 输出形状
{
  "page": "${key}",
  "units": [
    {
      "path": "${chunk[0]?.path ?? "unit"}",
      "chart_anchors": [],
      "evidence": "<命理批断：≥2句；无标记；只证本卡 unit_claim；生克方向必须落在闭集表>",
      "mechanism_tag": "surface_why"
    }
  ]
}
- units 条数必须 = ${chunk.length}；path 必须与派工表一致。chart_anchors 留空。evidence 里不得出现 ⟦。禁止在 evidence 里写示例说明文字。`,
      ].join("\n\n")
    : [
    `# 你是谁\n你是交付页【深度依据·专写】专员。只为**已锁定**的单元写专业命理依据。`,
    POJU_KNOWLEDGE_ROOTS,
    `# 本步边界（硬）
- 【不是】用户可见白话；【是】本盘命理批断原文。依据槽将原样展示这段批断。
- 批断形态：日主、月令、干透、合冲刑害、身强身弱、用忌等，凡【本地真算料】里与本单元有关的都要写进，用命理句读连成一段。禁止只有 1 个词再配大白话。
- 真词用 ⟦w:真词⟧ 包住（展示时会还原成真词）。槽外用命理连接语，允许再写本盘真算里出现的其他专名，同样打 ⟦w:⟧。禁止写本盘没有的神煞/干支。
- chart_anchors 必须全部出现。先扣 calc_cite 与 unit_claim，再写因→果。
- 若锁定表含 necessary_signals：各信号 role 都要在批断里有位置，不要只写第一个。
- 【thesis 引用】有 inference_zh 时据此展开；禁止把总纲 conclusion_zh 原样粘贴。
- **句读深度**：每条 evidence 用 \`。\` / \`！\` / \`？\` / \`；\` 分成 **≥2 句**（每句≥4字）。禁止逗号串成一句。
- 禁止套话壳「就你侧的结构感受而言 / 就本案表象在你侧的压力而言」当全文。
- 本 chunk 内各单元批断不得换皮同段。
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
      "evidence": "⟦w:日主⟧生于⟦w:月令⟧。干透⟦w:帮身⟧，地支⟦w:合局⟧，得令得地。局中偏枯处写⟦w:用忌⟧。以上真词必须换成【本盘真算料】里的词，禁止照抄本示例。",
      "mechanism_tag": "window_switch"
    }
  ]
}
- units 条数必须 = ${chunk.length}；path / chart_anchors 必须与锁定表一致（anchors 原样回传）。`,
  ].join("\n\n");

  const judgmentOnly = Boolean(factPack) && key === "foundation";
  const userParts: string[] = [
    `## 本页\n固定标签【${tag}】 · key=${key}`,
  ];
  if (!judgmentOnly) {
    userParts.push(`## 本页 core_conclusion\n${opts.core_conclusion.trim() || "(空)"}`);
  }
  userParts.push(factPack ? `## 本 chunk 主张\n${lockLines}` : `## 本 chunk 锁定表\n${lockLines}`);
  if (factPack && opts.chart_fact_pack?.trim()) {
    userParts.push(`## 本盘事实档\n${opts.chart_fact_pack.trim()}`);
  }
  // 铁律 15：承重真算不砍。处境/问答可拿掉（易粘成白话）；本地真算料保留以撑深度。
  if (opts.eastern_calc_slice?.trim()) {
    userParts.push(`## 本地真算料\n${opts.eastern_calc_slice.trim()}`);
  }
  if (opts.risk_calc_slice?.trim()) {
    userParts.push(`## 熔断算料\n${opts.risk_calc_slice.trim()}`);
  }
  if (!judgmentOnly && opts.question_expectation?.trim()) {
    userParts.push(`## 问题与期望\n${opts.question_expectation.trim()}`);
  }
  if (!judgmentOnly && opts.action_brief_block?.trim()) {
    userParts.push(opts.action_brief_block.trim());
  }
  if (!judgmentOnly && opts.reality_constraints?.trim()) {
    userParts.push(opts.reality_constraints.trim());
  }
  if (!judgmentOnly && key === "foundation" && opts.foundation_surface_feed?.trim()) {
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
    judgmentOnly
      ? `## 输出\n只输出 JSON：page="${key}", units 长度 ${chunk.length}；每条 path+chart_anchors=[]+evidence+mechanism_tag。evidence 只证上方 unit_claim，生克方向必须落在 system 闭集表。`
      : `## 输出\n只输出 JSON：page="${key}", units 长度 ${chunk.length}；每条 path+chart_anchors+evidence+mechanism_tag。`,
  );

  return { system, user: userParts.join("\n\n") };
}

/** Step 1 stores plain 批断. Unwrap leftover word slots; reject soft-label marks. */
function toPlainJudgment(evidence: string): string | null {
  if (/⟦t:/.test(evidence)) return null;
  const plain = evidence.replace(/⟦(?:w|词):([^⟧]*)⟧/g, "$1").trim();
  if (!plain || /⟦/.test(plain)) return null;
  return plain;
}

function parseWriteChunk(
  chunk: readonly DeepEvidenceAssignmentUnit[],
  raw: unknown,
  plainJudgment = false,
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
    const evidenceRaw =
      typeof u.evidence === "string"
        ? u.evidence.trim()
        : typeof u.professional_evidence === "string"
          ? u.professional_evidence.trim()
          : "";
    const evidence = plainJudgment ? (toPlainJudgment(evidenceRaw) ?? "") : evidenceRaw;
    const anchors = Array.isArray(u.chart_anchors)
      ? u.chart_anchors.map((x) => String(x).trim()).filter(Boolean)
      : [];
    const tagRaw =
      typeof u.mechanism_tag === "string" ? u.mechanism_tag.trim() : "";
    const markedOk = plainJudgment ? Boolean(evidence) : /⟦w:/.test(evidence);
    if (path && evidence && markedOk) {
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

/**
 * Deterministic post-parse polish for write evidence (agency gate).
 * Rule 11: soft-repair / weld; do not LLM-retry quality fails.
 */
export function polishWriteChunkUnits(
  chunk: readonly DeepEvidenceAssignmentUnit[],
  units: readonly DeepEvidenceUnit[],
  knownParties: readonly string[],
  opts?: { pageKey?: DeliverySegmentKey },
): {
  units: DeepEvidenceUnit[];
  repaired: boolean;
  fail_reason: string | null;
} {
  let repaired = false;
  const out: DeepEvidenceUnit[] = [];
  /** Intimacy/partnership friction weld only on foundation (Lab science/P5 cite「关系」盲焊债). */
  const allowFrictionWeld =
    opts?.pageKey == null || opts.pageKey === "foundation";
  for (let i = 0; i < units.length; i++) {
    const u = units[i]!;
    const locked = chunk[i]!;
    const slug =
      locked.chart_anchors[0]?.trim() ||
      locked.necessary_signals?.[0]?.slug?.trim() ||
      "";
    const inference =
      locked.necessary_signals?.[0]?.inference_zh?.trim() ?? "";
    const result = softRepairWriteEvidenceProse({
      evidence: u.evidence,
      slug,
      calc_cite: locked.calc_cite,
      unit_claim: locked.unit_claim,
      inference_zh: inference,
      known_parties: knownParties,
      allow_friction_weld: allowFrictionWeld,
    });
    if (result.repaired) repaired = true;
    if (result.still_dirty) {
      return {
        units: [...out],
        repaired,
        fail_reason: `write:third_party_attr:${locked.path}:${result.hit ?? "dirty"}`,
      };
    }
    out.push(
      result.repaired ? { ...u, evidence: result.evidence } : u,
    );
  }
  return { units: out, repaired, fail_reason: null };
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
  | { ok: false; reason: string; tokens_used: number; attempts: number; fail_class?: string; units?: DeepEvidenceUnit[] }
> {
  const knownThirdParties = extractKnownThirdParties({
    extra_blobs: [
      input.opts.question_expectation,
      input.opts.reality_constraints,
      input.opts.foundation_surface_feed,
      input.opts.science_means_feed,
      input.opts.metaphysics_moat_feed,
      input.opts.risk_fuse_feed,
      input.opts.close_ritual_feed,
    ],
  });
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
      const plainJudgment = Boolean(input.opts.chart_fact_pack?.trim());
      const units = parseWriteChunk(input.chunk, parsed, plainJudgment);
      if (!units) {
        lastReason = "shape_fail";
        lastFailClass = "other";
        user = plainJudgment
          ? `${userBase}\n\n【纠错】必须覆盖本 chunk 全部 path。evidence 是无标记命理批断：只证 unit_claim；生克方向落在闭集表；地支十神用本气；禁止白话尾巴与主张外合冲。禁止 ⟦w:⟧ / ⟦t:⟧ / ⟦词:⟧。chart_anchors 留空。回传 mechanism_tag。`
          : `${userBase}\n\n【纠错】必须覆盖本 chunk 全部 path；evidence 带 ⟦w:⟧；先扣 calc_cite/unit_claim；chart_anchors 与锁定表一致；回传 mechanism_tag。`;
        continue;
      }
      const polished = polishWriteChunkUnits(
        input.chunk,
        units,
        knownThirdParties,
        { pageKey: input.key },
      );
      if (polished.fail_reason) {
        // Rule 11: quality fail is explicit — do not burn another LLM attempt.
        console.warn("[delivery/deep-evidence] write third_party gate", {
          key: input.key,
          paths: input.chunk.map((c) => c.path),
          reason: polished.fail_reason,
          known_parties: knownThirdParties,
        });
        return {
          ok: false,
          reason: polished.fail_reason,
          tokens_used,
          attempts: attempt,
          fail_class: "third_party_attr",
        };
      }
      if (polished.repaired) {
        console.info("[delivery/deep-evidence] write third_party soft-repaired", {
          key: input.key,
          paths: input.chunk.map((c) => c.path),
          known_parties: knownThirdParties,
        });
      }
      const stripSoft = softStripUnmatchedDeepEvidenceAnchors(polished.units);
      let depthUnits = stripSoft.stripped ? stripSoft.units : polished.units;
      if (plainJudgment) {
        depthUnits = depthUnits.map((u) => ({
          ...u,
          evidence: stripSoftPaddingEvidence(
            u.evidence,
            input.opts.chart_fact_pack ?? "",
            u.unit_claim ?? "",
          ),
        }));
      }
      if (stripSoft.stripped) {
        console.info("[delivery/deep-evidence] write unmatched-anchor soft-stripped", {
          key: input.key,
          paths: input.chunk.map((c) => c.path),
          anchors: depthUnits.map((u) => u.chart_anchors),
        });
      }
      const depthFails = depthUnits
        .map((u) => assessDeepEvidenceUnitDepth(u))
        .filter((r): r is string => Boolean(r));
      if (depthFails.length > 0) {
        lastReason = depthFails[0]!;
        lastFailClass = "deep_evidence_depth";
        console.warn("[delivery/deep-evidence] write depth gate", {
          key: input.key,
          paths: input.chunk.map((c) => c.path),
          fails: depthFails,
          attempt,
        });
        return {
          ok: false,
          reason: `write_chunk:${lastReason}`,
          tokens_used,
          attempts: attempt,
          fail_class: lastFailClass,
          units: depthUnits,
        };
      }
      if (input.opts.chart_fact_pack?.trim()) {
        const packText = input.opts.chart_fact_pack;
        const listedGanzhi = input.opts.chart_fact_ganzhi ?? [];
        const listedStars = input.opts.chart_fact_shen_sha ?? [];
        const gate = {
          ganzhi:
            listedGanzhi.length > 0
              ? [...listedGanzhi]
              : [...new Set(packText.match(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g) ?? [])],
          shen_sha: [...listedStars],
        };
        const off = depthUnits
          .map((u) => judgmentOffChartReason(u.evidence, gate))
          .find((r): r is string => Boolean(r));
        if (off) {
          return {
            ok: false,
            reason: `write_chunk:${off}`,
            tokens_used,
            attempts: attempt,
            fail_class: "off_chart",
          };
        }
      }
      return { ok: true, units: depthUnits, tokens_used, attempts: attempt };
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
