/**
 * Single Page08 section assembly SSOT for Reader + PDF.
 */

import type { Face08V2 } from "../../schemas";
import {
  normalizePage08ReadingOrder,
  page08SectionById,
  type Page08SectionId,
} from "./sections";

export type Page08AssembledSection = {
  section_id: Page08SectionId;
  title: string;
  reading_rank: number;
  required: boolean;
  texts: string[];
  empty_display: string;
  gap_lines: string[];
};

function localeBucket(locale: string): "zh" | "en" {
  const l = (locale || "en").toLowerCase();
  return l.startsWith("zh") ? "zh" : "en";
}

export function page08SectionTitle(
  sectionId: Page08SectionId,
  locale: string,
): string {
  const def = page08SectionById(sectionId);
  if (!def) return sectionId;
  return localeBucket(locale) === "zh" ? def.title_zh : def.title_en;
}

export function resolvePage08ReadingOrder(
  page: Pick<Face08V2, "reading_order"> | null | undefined,
): Page08SectionId[] {
  return normalizePage08ReadingOrder(page?.reading_order);
}

function joinOrDash(items: readonly string[] | undefined): string {
  return items && items.length ? items.join("; ") : "—";
}

export function resolvePage08SectionUnitTexts(
  page: Face08V2,
  sectionId: Page08SectionId,
): string[] {
  const zh = localeBucket(page.locale ?? "en") === "zh";
  if (sectionId === "risks") {
    return page.risks.map((r) =>
      [
        `**${r.risk_title}** (${r.risk_id} · ${r.risk_category} · ${r.current_status})`,
        r.risk_description,
        `${zh ? "路径" : "Paths"}: ${joinOrDash(r.related_path_ids)}`,
        `${zh ? "动作" : "Actions"}: ${joinOrDash(r.related_action_ids)}`,
      ].join("\n"),
    );
  }
  if (sectionId === "observation_signals") {
    return page.observation_signals.map((s) =>
      [
        `**${s.signal_name}** (${s.signal_id})`,
        s.what_to_observe,
        `${zh ? "来源" : "Source"}: ${s.observation_source}`,
        `${zh ? "方法" : "Method"}: ${s.observation_method}`,
        `${zh ? "窗口" : "Window"}: ${s.observation_window}`,
        `${zh ? "基线" : "Baseline"}: ${s.baseline_status}`,
        `${zh ? "阈值" : "Threshold"}: ${s.threshold_status}`,
        `${zh ? "风险" : "Risks"}: ${joinOrDash(s.related_risk_ids)}`,
      ].join("\n"),
    );
  }
  if (sectionId === "triggers") {
    return page.triggers.map((t) =>
      [
        `**${t.decision_response}** (${t.trigger_id} · ${t.trigger_status})`,
        t.trigger_condition,
        `${zh ? "风险" : "Risks"}: ${joinOrDash(t.related_risk_ids)}`,
        `${zh ? "信号" : "Signals"}: ${joinOrDash(t.related_signal_ids)}`,
      ].join("\n"),
    );
  }
  if (sectionId === "reassessment_conditions") {
    return page.reassessment_conditions.map((r) =>
      [
        `**${r.change_type}** (${r.reassessment_id})`,
        r.condition,
        `${zh ? "复盘范围" : "Review scope"}: ${r.expected_review_scope}`,
        `${zh ? "路径" : "Paths"}: ${joinOrDash(r.affected_path_ids)}`,
      ].join("\n"),
    );
  }
  const b = page.evidence_boundary;
  return [
    [
      `${zh ? "已确认事实" : "Confirmed facts"}: ${joinOrDash(b.confirmed_fact_ids)}`,
      `${zh ? "未核实事实" : "Unverified facts"}: ${joinOrDash(b.unverified_fact_ids)}`,
      `${zh ? "未解问题" : "Unresolved questions"}: ${joinOrDash(b.unresolved_questions)}`,
      `${zh ? "监测限制" : "Monitoring limits"}: ${joinOrDash(b.monitoring_limitations)}`,
      `${zh ? "复盘限制" : "Reassessment limits"}: ${joinOrDash(b.reassessment_limitations)}`,
    ].join("\n"),
  ];
}

export function resolvePage08SectionGapLines(
  page: Face08V2,
  sectionId: Page08SectionId,
): string[] {
  const gaps = page.missing_inputs ?? [];
  return gaps
    .filter((g) => g.section_id === sectionId)
    .map((g) => `${g.field_id}: ${g.affects_content}`);
}

export function assemblePage08SectionsForDisplay(
  page: Face08V2,
  locale?: string,
): Page08AssembledSection[] {
  const displayLocale = locale || page.locale || "en";
  const zh = localeBucket(displayLocale) === "zh";
  const order = resolvePage08ReadingOrder(page);
  return order.map((sectionId) => {
    const def = page08SectionById(sectionId)!;
    return {
      section_id: sectionId,
      title: page08SectionTitle(sectionId, displayLocale),
      reading_rank: def.reading_rank,
      required: def.required,
      texts: resolvePage08SectionUnitTexts(
        { ...page, locale: (page.locale ?? displayLocale) as Face08V2["locale"] },
        sectionId,
      ),
      empty_display: zh ? def.empty_display_zh : def.empty_display_en,
      gap_lines: resolvePage08SectionGapLines(page, sectionId),
    };
  });
}

export function assemblePage08PdfArgumentBodies(
  page: Face08V2,
  locale = "zh",
): Array<{ body: string }> {
  const sections = assemblePage08SectionsForDisplay(page, locale);
  const out: Array<{ body: string }> = [];
  for (const s of sections) {
    const chunks: string[] = [];
    if (s.texts.length) chunks.push(...s.texts);
    if (s.gap_lines.length) {
      const gapHeader =
        localeBucket(locale) === "zh"
          ? "数据缺口（不可当作已确认事实）："
          : "Data gaps (not confirmed facts):";
      chunks.push(`${gapHeader}\n${s.gap_lines.join("\n")}`);
    }
    if (!chunks.length) chunks.push(s.empty_display);
    out.push({ body: `### ${s.title}\n\n${chunks.join("\n\n")}` });
  }
  return out;
}
