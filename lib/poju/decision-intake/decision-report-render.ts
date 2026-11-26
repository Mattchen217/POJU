/**
 * M3 — deterministic rendering of validated Decision Intake 2.0 pages into the
 * existing book markdown shape (`## face kicker` + body + evidence lead), so the
 * current shelf / HTML archive reads DI2 reports without a second display path.
 */

import { resolveGlossaryAppendixRows } from "@/lib/llm/pro/delivery/decision-report-v2/glossary-appendix";
import {
  deliveryCoverCopy,
  deliveryEvidenceLeadLabel,
  deliverySectionHeading,
} from "@/lib/llm/pro/delivery/delivery-locale";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import {
  encodeAndPolishDeliveryEvidence,
  stripMarkersForPrompt,
} from "@/lib/llm/sanitize/term-marking";
import type { DecisionContextBinding } from "@/lib/poju/decision-context/types";
import {
  DI2_READING_ORDER,
  type DecisionReportPageRecord,
  type EvidenceReference,
} from "./decision-report-types";

export type Di2PageBlock = {
  segment_id: string;
  heading: string;
  body: string;
  basis: string;
  evidence_refs: string[];
};

export type Di2PathOption = {
  path_id: string;
  rank: number;
  label: string;
  conditions: string;
  cost: string;
  risk: string;
  reversibility: string;
  exit_condition: string;
  ranking_basis: string;
  evidence_refs: string[];
};

export type Di2Experiment = {
  hypothesis: string;
  action: string;
  observe: string;
  window: string;
  success: string;
  if_fail: string;
  defer_costs: string;
  evidence_refs: string[];
};

export type Di2Review = {
  core_metrics: string[];
  continue_when: string;
  adjust_when: string;
  stop_when: string;
  rerun_when: string;
  evidence_refs: string[];
};

/** Code-built glossary appendix (Page 03). term_ids only — soft labels from SSOT at render. */
export type Di2GlossaryAppendix = {
  kind: "glossary_appendix";
  reading_note: string;
  term_ids: string[];
};

export type Di2PageStructured = {
  page_id: DecisionPageId;
  title: string;
  blocks: Di2PageBlock[];
  paths?: Di2PathOption[];
  experiment?: Di2Experiment;
  review?: Di2Review;
  appendix?: Di2GlossaryAppendix;
};

function isZh(locale: string): boolean {
  return (locale || "").toLowerCase().startsWith("zh");
}

export function DI2_PAGE07_NOT_APPLICABLE_NOTE(locale: string): string {
  return isZh(locale)
    ? "本题不涉及换场、迁移、合伙、亲密关系或共同决策，本页按规则不展开。"
    : "This decision does not involve a change of setting, relocation, partnership, intimate relationship or a joint decision, so this page is intentionally not expanded.";
}

const STATUS_LABEL_ZH: Record<EvidenceReference["status"], string> = {
  confirmed_fact: "你已确认",
  user_stated_unverified: "你提到、尚未核实",
  user_estimate: "你的估计",
  unknown_or_declined: "仍未知",
  constraint_confirmed: "已确认的约束",
  constraint_unverified: "尚未确认的约束",
  hypothesis: "待验证的假设",
  dir_known: "已了解的方面",
  dir_unknown: "仍未了解的方面",
  dir_conflict: "存在矛盾的方面",
  dir_not_applicable: "不适用",
  conflict_open: "尚未澄清的矛盾",
  conflict_clarified: "已澄清的矛盾",
  boundary: "信息边界",
  decision_definition: "决策目标",
  local_calculation: "本地排盘",
  personal_analysis: "个人分析",
};

const STATUS_LABEL_EN: Record<EvidenceReference["status"], string> = {
  confirmed_fact: "You confirmed",
  user_stated_unverified: "You mentioned (not verified)",
  user_estimate: "Your estimate",
  unknown_or_declined: "Still unknown",
  constraint_confirmed: "Confirmed constraint",
  constraint_unverified: "Unconfirmed constraint",
  hypothesis: "Hypothesis to test",
  dir_known: "Covered area",
  dir_unknown: "Open area",
  dir_conflict: "Contradicted area",
  dir_not_applicable: "Not applicable",
  conflict_open: "Unresolved contradiction",
  conflict_clarified: "Clarified contradiction",
  boundary: "Information boundary",
  decision_definition: "Decision target",
  local_calculation: "Local chart calculation",
  personal_analysis: "Personal analysis",
};

export function evidenceStatusLabel(
  status: EvidenceReference["status"],
  locale: string,
): string {
  return (isZh(locale) ? STATUS_LABEL_ZH : STATUS_LABEL_EN)[status];
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Final evidence-layer text (with term markers): polished model basis + polished
 * cited local/context excerpts. Used for appendix term collection and for render.
 */
export function di2EvidenceLayerText(
  basis: string,
  refs: string[],
  refIndex: ReadonlyMap<string, EvidenceReference>,
  locale: string,
): string {
  const lines: string[] = [];
  const b = encodeAndPolishDeliveryEvidence(basis.replace(/\s*\n+\s*/g, " ").trim(), locale);
  if (b) lines.push(b);
  const cited = refs
    .map((r) => refIndex.get(r))
    .filter((r): r is EvidenceReference => Boolean(r))
    .map((r) => {
      const excerpt = encodeAndPolishDeliveryEvidence(clip(r.excerpt, 80), locale);
      return `${evidenceStatusLabel(r.status, locale)}：${excerpt}`;
    });
  if (cited.length) lines.push(cited.join("；"));
  return lines.join(" ");
}

/** Reader-visible evidence fold: SSOT soft labels, no raw markers. */
function basisWithRefs(
  basis: string,
  refs: string[],
  refIndex: ReadonlyMap<string, EvidenceReference>,
  locale: string,
): string {
  return stripMarkersForPrompt(di2EvidenceLayerText(basis, refs, refIndex, locale), locale);
}

function pushArgument(
  parts: string[],
  body: string,
  basis: string,
  lead: string,
): void {
  const b = body.trim().replace(/\n{2,}/g, "\n");
  if (!b) return;
  parts.push(b);
  if (basis.trim()) parts.push(`${lead}\n${basis.trim()}`);
}

function fieldLabel(locale: string, zh: string, en: string): string {
  return isZh(locale) ? zh : en;
}

/** One validated page → markdown section (no heading). */
export function renderDi2PageBody(
  page: Di2PageStructured,
  refIndex: ReadonlyMap<string, EvidenceReference>,
  locale: string,
): string {
  const lead = deliveryEvidenceLeadLabel(locale);
  const parts: string[] = [];
  if (page.title.trim()) parts.push(`### ${page.title.trim()}`);

  for (const block of page.blocks) {
    const heading = block.heading.trim();
    const body = heading ? `**${heading}**\n${block.body.trim()}` : block.body.trim();
    pushArgument(parts, body, basisWithRefs(block.basis, block.evidence_refs, refIndex, locale), lead);
  }

  if (page.paths?.length) {
    const sorted = [...page.paths].sort((a, b) => a.rank - b.rank);
    for (const p of sorted) {
      const body = [
        `**${p.rank}. ${p.label.trim()}**`,
        `- ${fieldLabel(locale, "成立条件", "Holds when")}：${p.conditions.trim()}`,
        `- ${fieldLabel(locale, "代价", "Cost")}：${p.cost.trim()}`,
        `- ${fieldLabel(locale, "风险", "Risk")}：${p.risk.trim()}`,
        `- ${fieldLabel(locale, "可逆性", "Reversibility")}：${p.reversibility.trim()}`,
        `- ${fieldLabel(locale, "退出条件", "Exit")}：${p.exit_condition.trim()}`,
      ].join("\n");
      pushArgument(parts, body, basisWithRefs(p.ranking_basis, p.evidence_refs, refIndex, locale), lead);
    }
  }

  if (page.experiment) {
    const e = page.experiment;
    const body = [
      `**${fieldLabel(locale, "验证实验", "Verification experiment")}**`,
      `- ${fieldLabel(locale, "要验证的判断", "What it tests")}：${e.hypothesis.trim()}`,
      `- ${fieldLabel(locale, "做什么", "Action")}：${e.action.trim()}`,
      `- ${fieldLabel(locale, "观察什么", "Observe")}：${e.observe.trim()}`,
      `- ${fieldLabel(locale, "时间窗", "Window")}：${e.window.trim()}`,
      `- ${fieldLabel(locale, "算成功", "Counts as success")}：${e.success.trim()}`,
      `- ${fieldLabel(locale, "不成立时", "If it fails")}：${e.if_fail.trim()}`,
      `- ${fieldLabel(locale, "先不投入", "Hold back for now")}：${e.defer_costs.trim()}`,
    ].join("\n");
    pushArgument(parts, body, basisWithRefs("", e.evidence_refs, refIndex, locale), lead);
  }

  if (page.review) {
    const r = page.review;
    const body = [
      `**${fieldLabel(locale, "复盘标准", "Review criteria")}**`,
      `- ${fieldLabel(locale, "共享核心指标", "Shared core metrics")}：${r.core_metrics.map((m) => m.trim()).join("；")}`,
      `- ${fieldLabel(locale, "继续", "Continue")}：${r.continue_when.trim()}`,
      `- ${fieldLabel(locale, "调整", "Adjust")}：${r.adjust_when.trim()}`,
      `- ${fieldLabel(locale, "停止", "Stop")}：${r.stop_when.trim()}`,
      `- ${fieldLabel(locale, "重跑本题", "Rerun this decision")}：${r.rerun_when.trim()}`,
    ].join("\n");
    pushArgument(parts, body, basisWithRefs("", r.evidence_refs, refIndex, locale), lead);
  }

  if (page.appendix?.kind === "glossary_appendix") {
    const a = page.appendix;
    if (a.reading_note.trim()) parts.push(a.reading_note.trim());
    const rows = resolveGlossaryAppendixRows(
      {
        page: "03",
        face: "03",
        kind: "glossary_appendix",
        page_title: page.title,
        page_subtitle: "",
        reading_note: a.reading_note,
        term_ids: a.term_ids,
      },
      locale,
    );
    if (rows.length) {
      parts.push(
        [
          `**${fieldLabel(locale, "本报告使用的术语", "Terms used in this report")}**`,
          ...rows.map((r) => `- **${r.soft_label}**：${r.definition}`),
        ].join("\n"),
      );
    }
  }

  return parts.join("\n\n");
}

export function renderDi2NotApplicablePage(locale: string): string {
  return DI2_PAGE07_NOT_APPLICABLE_NOTE(locale);
}

/** Reading order with the topic gate applied (07 only when applicable). */
export function di2ReadingOrder(pages: ReadonlyArray<Pick<DecisionReportPageRecord, "page_id" | "applicability">>): DecisionPageId[] {
  const notApplicable = new Set(
    pages.filter((p) => p.applicability === "not_applicable").map((p) => p.page_id),
  );
  return DI2_READING_ORDER.filter((id) => !notApplicable.has(id));
}

/** Full book markdown: cover + TOC + pages in reading order. */
export function renderDi2BookMarkdown(input: {
  pages: ReadonlyArray<Pick<DecisionReportPageRecord, "page_id" | "applicability" | "content_markdown" | "status">>;
  locale: string;
  question: string;
  binding: DecisionContextBinding;
  report_id: string;
  generated_at: string;
}): string {
  const copy = deliveryCoverCopy(input.locale);
  const q = input.question.trim().slice(0, 80) || copy.fallbackQuestion;
  const date = input.generated_at.slice(0, 10);
  const order = di2ReadingOrder(input.pages);
  const byId = new Map(input.pages.map((p) => [p.page_id, p]));
  const toc = order
    .map((id, i) => `${i + 1}. ${deliverySectionHeading(id, input.locale)}`)
    .join("\n");
  const parts: string[] = [
    `# ${copy.title(q)}`,
    `> ${copy.subtitle}`,
    `${copy.metaLine(input.report_id, date)}\n\nDecision Context: \`${input.binding.context_id}@v${input.binding.context_version}\` · hash=\`${input.binding.context_hash.slice(0, 16)}…\``,
    `## ${copy.tocTitle}\n\n${toc}\n\n---`,
  ];
  for (const id of order) {
    const page = byId.get(id);
    if (!page || page.status !== "completed" || !page.content_markdown.trim()) continue;
    parts.push(`## ${deliverySectionHeading(id, input.locale)}`);
    parts.push(page.content_markdown.trim());
  }
  return parts.join("\n\n");
}
