/**
 * Single Page06 section assembly SSOT for Reader + PDF.
 */

import type { Face06V2 } from "../../schemas";
import {
  normalizePage06ReadingOrder,
  page06SectionById,
  type Page06SectionId,
} from "./sections";

export type Page06AssembledSection = {
  section_id: Page06SectionId;
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

export function page06SectionTitle(
  sectionId: Page06SectionId,
  locale: string,
): string {
  const def = page06SectionById(sectionId);
  if (!def) return sectionId;
  return localeBucket(locale) === "zh" ? def.title_zh : def.title_en;
}

export function resolvePage06ReadingOrder(
  page: Pick<Face06V2, "reading_order"> | null | undefined,
): Page06SectionId[] {
  return normalizePage06ReadingOrder(page?.reading_order);
}

function joinOrDash(items: readonly string[]): string {
  return items.length ? items.join("; ") : "—";
}

export function resolvePage06SectionUnitTexts(
  page: Face06V2,
  sectionId: Page06SectionId,
): string[] {
  const zh = localeBucket(page.locale ?? "en") === "zh";
  if (sectionId === "first_step") {
    const s = page.first_step;
    return [
      [
        `**${s.what}** (${s.action_id} · ${s.path_id})`,
        `${zh ? "为何现在" : "Why now"}: ${s.why_now}`,
        `${zh ? "需要" : "Resources"}: ${joinOrDash(s.required_resources)}`,
        `${zh ? "可观察结果" : "Observable result"}: ${s.expected_observable_result}`,
      ].join("\n"),
    ];
  }
  if (sectionId === "execution_actions") {
    return [...page.execution_actions]
      .sort((a, b) => a.sequence - b.sequence)
      .map((a) =>
        [
          `**${a.sequence}. ${a.action}** (${a.action_id} · ${a.path_id})`,
          `${zh ? "理由" : "Why"}: ${a.rationale}`,
          `${zh ? "资源" : "Resources"}: ${joinOrDash(a.resources)}`,
          `${zh ? "依赖" : "Dependencies"}: ${joinOrDash(a.dependencies)}`,
          `${zh ? "可观察结果" : "Observable result"}: ${a.observable_result}`,
          `${zh ? "护栏" : "Guardrails"}: ${joinOrDash(a.guardrails)}`,
        ].join("\n"),
      );
  }
  if (sectionId === "validation_experiments") {
    if (page.validation_experiments.length) {
      return page.validation_experiments.map((e) =>
        [
          `**${e.hypothesis}** (${e.experiment_id} · ${e.path_id})`,
          `${zh ? "动作" : "Action"}: ${e.action}`,
          `${zh ? "观察" : "Observe"}: ${e.observe}`,
          `${zh ? "窗口" : "Window"}: ${e.window}`,
          `${zh ? "成功标准" : "Success"}: ${e.success_criteria}`,
          `${zh ? "若不成立" : "If fail"}: ${e.if_fail}`,
          `${zh ? "延后成本" : "Defer costs"}: ${e.defer_costs}`,
        ].join("\n"),
      );
    }
    const note =
      page.experiments_absent_note?.trim() ||
      page.evidence_boundary.experiments_absent_note?.trim() ||
      "";
    return note ? [note] : [];
  }
  if (sectionId === "personal_execution_adjustments") {
    return page.personal_execution_adjustments.map((a) =>
      [
        `**${a.adjustment}** (${a.adjustment_id} · ${a.path_id})`,
        `${zh ? "个人依据" : "Personal refs"}: ${joinOrDash(a.supporting_personal_unit_refs)}`,
        `${zh ? "现实事实" : "Reality facts"}: ${joinOrDash(a.supporting_reality_fact_ids)}`,
      ].join("\n"),
    );
  }
  if (sectionId === "phase_rhythm") {
    const phases = page.phase_rhythm.phases.map((p) =>
      [
        `**${p.goal}** (${p.phase_id})`,
        `${zh ? "进入" : "Enter"}: ${joinOrDash(p.enter_triggers)}`,
        `${zh ? "退出" : "Exit"}: ${joinOrDash(p.exit_triggers)}`,
      ].join("\n"),
    );
    const notes = page.phase_rhythm.notes?.trim();
    return notes ? [...phases, notes] : phases;
  }
  if (sectionId === "resource_boundaries") {
    const b = page.resource_boundaries;
    return [
      [
        `${zh ? "时间" : "Time"}: ${b.time}`,
        `${zh ? "金钱" : "Money"}: ${b.money}`,
        `${zh ? "人" : "People"}: ${b.people}`,
        `${zh ? "精力" : "Energy"}: ${b.energy}`,
        `${zh ? "其他" : "Other"}: ${joinOrDash(b.other)}`,
        `${zh ? "未知或缺失" : "Unknown or missing"}: ${joinOrDash(b.unknown_or_missing)}`,
      ].join("\n"),
    ];
  }
  const boundary = page.evidence_boundary;
  const monitor = page.monitoring_contract;
  const lines = [
    `${zh ? "不确定" : "Uncertainty"}: ${boundary.uncertainty_notes.join("; ")}`,
  ];
  if (boundary.hypothesis_notes.length) {
    lines.push(
      `${zh ? "假设" : "Hypotheses"}: ${boundary.hypothesis_notes.join("; ")}`,
    );
  }
  if (boundary.experiments_absent_note?.trim()) {
    lines.push(boundary.experiments_absent_note.trim());
  }
  lines.push(
    [
      `${zh ? "监测" : "Monitoring"} (${monitor.path_id})`,
      `${zh ? "动作" : "Actions"}: ${joinOrDash(monitor.action_ids)}`,
      `${zh ? "实验" : "Experiments"}: ${joinOrDash(monitor.experiment_ids)}`,
      `${zh ? "观察信号" : "Observe"}: ${joinOrDash(monitor.observe_signals)}`,
      `${zh ? "红灯" : "Red flags"}: ${joinOrDash(monitor.red_flags)}`,
      `${zh ? "复盘问句" : "Review questions"}: ${joinOrDash(monitor.review_questions)}`,
      `${zh ? "继续" : "Continue"}: ${joinOrDash(monitor.continue_triggers)}`,
      `${zh ? "调整" : "Adjust"}: ${joinOrDash(monitor.adjust_triggers)}`,
      `${zh ? "停止" : "Stop"}: ${joinOrDash(monitor.stop_triggers)}`,
      `${zh ? "重跑" : "Rerun"}: ${joinOrDash(monitor.rerun_triggers)}`,
      `${zh ? "资源护栏" : "Resource guardrails"}: ${joinOrDash(monitor.resource_guardrails)}`,
      `${zh ? "延后成本" : "Defer costs"}: ${joinOrDash(monitor.defer_costs)}`,
    ].join("\n"),
  );
  return lines;
}

export function resolvePage06SectionGapLines(
  page: Face06V2,
  sectionId: Page06SectionId,
): string[] {
  return (page.missing_inputs ?? [])
    .filter((g) => g.section_id === sectionId)
    .map((g) => `[${g.status}] ${g.field_id}: ${g.affects_content}`);
}

export function assemblePage06SectionsForDisplay(
  page: Face06V2,
  locale: string,
): Page06AssembledSection[] {
  const zh = localeBucket(locale) === "zh";
  const stamped = { ...page, locale: (page.locale ?? locale) as Face06V2["locale"] };
  return resolvePage06ReadingOrder(page).map((sectionId) => {
    const def = page06SectionById(sectionId)!;
    const texts = resolvePage06SectionUnitTexts(stamped, sectionId);
    const gap_lines = resolvePage06SectionGapLines(page, sectionId);
    return {
      section_id: sectionId,
      title: page06SectionTitle(sectionId, locale),
      reading_rank: def.reading_rank,
      required: def.required,
      texts,
      empty_display: zh ? def.empty_display_zh : def.empty_display_en,
      gap_lines,
    };
  });
}

export function assemblePage06PdfArgumentBodies(
  page: Face06V2,
  locale = "zh",
): Array<{ body: string }> {
  const sections = assemblePage06SectionsForDisplay(page, locale);
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
