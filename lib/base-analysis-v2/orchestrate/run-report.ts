import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { BaseAnalysisProgressStage } from "@/lib/base-analysis/progress-stages";
import { runCompute } from "@/lib/base-analysis-v2/compute/compute-call";
import { runNarrative } from "@/lib/base-analysis-v2/narrative/narrative-call";
import { runEvidence } from "@/lib/base-analysis-v2/evidence/evidence-call";
import type { ReportComputed } from "@/lib/base-analysis-v2/report-schema";
import { readPath, type ReportSegmentTextTree } from "@/lib/base-analysis-v2/segment-text";
import { forceSsotPlainInMarkers, demoteWuxingMarkers } from "@/lib/llm/sanitize/term-marking";

export type ReportV2Outcome =
  | { ok: true; markdown: string; timings: ReportV2Timings }
  | { ok: false; stage: "compute" | "narrative" | "evidence"; reason: string; timings: ReportV2Timings };

export type ReportV2Timings = {
  compute?: number;
  narrative?: number;
  evidence?: number;
  parallel?: number;
  total?: number;
};

export type RunReportV2Options = {
  session_id?: string;
  signal?: AbortSignal;
  onProgress?: (stage: BaseAnalysisProgressStage) => void | Promise<void>;
};

type SectionLayout = { headingZh: string; headingEn: string; paths: readonly string[] };

/** 报告的模块/段落 → 展示标题 + 分区归属。与 report-schema 的段落一一对应。 */
export const SECTION_LAYOUT: readonly SectionLayout[] = [
  {
    headingZh: "## 先天能量图谱与性格原型",
    headingEn: "## Innate Energy Map & Cognitive Archetype",
    paths: [
      "energy_map.day_master_nature",
      "energy_map.wuxing_distribution",
      "energy_map.cognitive_archetype",
      "energy_map.regulator",
    ],
  },
  {
    headingZh: "## 工作效能与决策风格",
    headingEn: "## Work Effectiveness & Decision Style",
    paths: ["work_style.value_creation", "work_style.decision_style", "work_style.focus_drain"],
  },
  {
    headingZh: "## 沟通原型与人际协同",
    headingEn: "## Communication Archetype & Collaboration",
    paths: [
      "interpersonal.comm_archetype",
      "interpersonal.friction_point",
      "interpersonal.synergy",
    ],
  },
  {
    headingZh: "## 阶段性状态演进",
    headingEn: "## Phase States",
    paths: [
      "phase_states.baseline",
      "phase_states.rest_phase",
      "phase_states.peak_phase",
      "phase_states.transition_phase",
    ],
  },
  {
    headingZh: "## 环境与日常行为调频",
    headingEn: "## Environment & Daily Retune",
    paths: ["retune.color", "retune.space", "retune.habits", "retune.awareness"],
  },
  {
    headingZh: "## 一页纸摘要",
    headingEn: "## One-Page Summary",
    paths: ["summary.card_basis"],
  },
] as const;

function evidenceLeadLabel(locale: string): string {
  return locale.startsWith("zh") ? "**依据与推理:**" : "**Evidence & reasoning:**";
}

/** 从 tree 按路径取一段文本。 */
export function seg(tree: ReportSegmentTextTree, path: string): string {
  const v = readPath(tree, path);
  return typeof v === "string" ? v : "";
}

/**
 * 一页纸卡片：keywords/dos/donts 来自第1次 rc.summary；
 * 统一折叠依据来自第3次 summary.card_basis。
 */
export function renderSummaryCard(
  rc: ReportComputed,
  evidenceCard: string,
  locale: string,
): string {
  const s = rc.summary;
  const zh = locale.startsWith("zh");
  const joinKw = zh ? "、" : ", ";
  return [
    zh
      ? `**关键词:** ${s.keywords.join(joinKw)}`
      : `**Keywords:** ${s.keywords.join(joinKw)}`,
    zh
      ? `**当下主旋律:** ${s.current_theme}`
      : `**Current theme:** ${s.current_theme}`,
    zh ? "**建议多做:**" : "**Do more:**",
    ...s.dos.map((d) => `- ${d}`),
    zh ? "**建议避免:**" : "**Avoid:**",
    ...s.donts.map((d) => `- ${d}`),
    // 依据紧跟标签，勿空行拆开（v1 dualLayer 契约）
    `${evidenceLeadLabel(locale)}\n${evidenceCard.trim()}`,
  ].join("\n\n");
}

/**
 * 合并:每段 = 正文(第2次) + 折叠依据(第3次)。
 * 卡片特例走 renderSummaryCard（用 rc.summary 短词 + 第3次依据）。
 * 末尾 forceSsotPlainInMarkers：把 ⟦t:slug|⟧ 空槽填成 SSOT 软译+释义（v1 同款；漏了会渲染崩 + gate 误伤）。
 */
export function mergeToMarkdown(
  rc: ReportComputed,
  narrative: ReportSegmentTextTree,
  evidence: ReportSegmentTextTree,
  locale: string,
): string {
  const zh = locale.startsWith("zh");
  const lead = evidenceLeadLabel(locale);
  const parts: string[] = [];

  for (const section of SECTION_LAYOUT) {
    parts.push(zh ? section.headingZh : section.headingEn);
    for (const path of section.paths) {
      if (path === "summary.card_basis") {
        parts.push(renderSummaryCard(rc, seg(evidence, path), locale));
        continue;
      }
      // 正文内多余空行压成单换行 → 整段是一个 block，不被 parseReadingBlocks 按 \n\n 切碎，
      // 与依据严格 1:1（不依赖模型段内是否碰巧写了空行）。
      const body = seg(narrative, path).trim().replace(/\n{2,}/g, "\n");
      // 依据本是一整句连贯话：去掉一切换行，避免被切成多块/多段渲染。
      const ev = seg(evidence, path).trim().replace(/\s*\n+\s*/g, "");
      // 正文与依据块之间用 \n\n 分段（parseReadingBlocks 按空行切块）；
      // 标签与依据正文之间只单换行，避免金字漏出折叠。
      // 每段 = 正文 + 该段依据（顺序 1:1；前端 dualLayer 同容器配对）。
      if (body) {
        parts.push(body);
        parts.push(`${lead}\n${ev}`);
      }
    }
  }

  const raw = parts.join("\n\n");
  // ★ 空槽填 SSOT 软译 + 五行标记还原成原字（火/水…，不软译成发散/润流）
  return demoteWuxingMarkers(forceSsotPlainInMarkers(raw, locale));
}

/**
 * 三次调用串联：
 *   第1次 runCompute (串行先行)
 *   → Promise.all([runNarrative, runEvidence]) (并行)
 *   → 按 SEGMENT_PATHS 合并成双层 Markdown
 * 总时长 ≈ 第1次 + max(第2次,第3次)。
 */
export async function runReportV2(
  structured: ProfileStructured,
  locale: string,
  session_idOrOpts?: string | RunReportV2Options,
): Promise<ReportV2Outcome> {
  const opts: RunReportV2Options =
    typeof session_idOrOpts === "string" || session_idOrOpts === undefined
      ? { session_id: session_idOrOpts }
      : session_idOrOpts;

  const timings: ReportV2Timings = {};
  const t0 = Date.now();

  await opts.onProgress?.("chart_ready");
  await opts.onProgress?.("v2_compute");

  const compute = await runCompute(structured, locale, {
    session_id: opts.session_id,
    signal: opts.signal,
  });
  timings.compute = Date.now() - t0;
  if (!compute.ok) {
    timings.total = Date.now() - t0;
    return { ok: false, stage: "compute", reason: compute.reason, timings };
  }
  const rc = compute.value;

  // 并行阶段：UI 用 v2_narrative 表示「写正文+依据进行中」
  await opts.onProgress?.("v2_narrative");
  const tPar = Date.now();
  const narStarted = Date.now();
  const evStarted = Date.now();
  const [narrative, evidence] = await Promise.all([
    runNarrative(rc, locale, { session_id: opts.session_id, signal: opts.signal }).then((r) => {
      timings.narrative = Date.now() - narStarted;
      return r;
    }),
    runEvidence(rc, locale, { session_id: opts.session_id, signal: opts.signal }).then((r) => {
      timings.evidence = Date.now() - evStarted;
      return r;
    }),
  ]);
  timings.parallel = Date.now() - tPar;

  if (!narrative.ok) {
    timings.total = Date.now() - t0;
    return { ok: false, stage: "narrative", reason: narrative.reason, timings };
  }
  if (!evidence.ok) {
    timings.total = Date.now() - t0;
    return { ok: false, stage: "evidence", reason: evidence.reason, timings };
  }

  await opts.onProgress?.("streaming");
  const markdown = mergeToMarkdown(rc, narrative.value, evidence.value, locale);
  timings.total = Date.now() - t0;

  console.log(
    `[v2/orchestrate] ✅ 报告就绪 compute=${timings.compute}ms parallel=${timings.parallel}ms` +
      ` (nar=${timings.narrative}ms ev=${timings.evidence}ms) total=${timings.total}ms`,
  );
  return { ok: true, markdown, timings };
}
