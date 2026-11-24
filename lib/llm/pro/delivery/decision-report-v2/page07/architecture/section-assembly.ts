/**
 * Single Page07 section assembly SSOT for Reader + PDF.
 */

import type { Face07V2 } from "../../schemas";
import { isFace07NotApplicableOmit } from "../report-inclusion";
import {
  normalizePage07ReadingOrder,
  page07SectionById,
  type Page07SectionId,
} from "./sections";

export type Page07AssembledSection = {
  section_id: Page07SectionId;
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

export function page07SectionTitle(
  sectionId: Page07SectionId,
  locale: string,
): string {
  const def = page07SectionById(sectionId);
  if (!def) return sectionId;
  return localeBucket(locale) === "zh" ? def.title_zh : def.title_en;
}

export function resolvePage07ReadingOrder(
  page: Pick<Face07V2, "reading_order"> | null | undefined,
): Page07SectionId[] {
  return normalizePage07ReadingOrder(page?.reading_order);
}

function joinOrDash(items: readonly string[] | undefined): string {
  return items && items.length ? items.join("; ") : "—";
}

export function resolvePage07SectionUnitTexts(
  page: Face07V2,
  sectionId: Page07SectionId,
): string[] {
  const zh = localeBucket(page.locale ?? "en") === "zh";
  const skipped =
    page.applicability_status === "not_applicable" ||
    page.applicability_status === "insufficient_information";

  if (sectionId === "field_judgment") {
    if (skipped || page.field_units.length === 0) {
      const note = (page.skip_note || page.applicability_reason || "").trim();
      return note ? [note] : [];
    }
    return page.field_units.map((u) =>
      [
        `**${u.text}** (${u.unit_id} · ${u.kind})`,
        `${zh ? "参与者" : "Participants"}: ${joinOrDash(u.participant_ids)}`,
      ].join("\n"),
    );
  }
  if (sectionId === "relationship_interaction") {
    if (skipped || page.relationship_units.length === 0) return [];
    return page.relationship_units.map((u) =>
      [
        `**${u.text}** (${u.unit_id} · ${u.kind})`,
        `${zh ? "参与者" : "Participants"}: ${joinOrDash(u.participant_ids)}`,
        `${zh ? "不确定" : "Uncertainty"}: ${joinOrDash(u.uncertainty_notes)}`,
      ].join("\n"),
    );
  }
  if (sectionId === "evidence_boundary") {
    const b = page.evidence_boundary;
    const lines = [
      `${zh ? "已确认事实" : "Confirmed facts"}: ${joinOrDash(b.confirmed_fact_ids)}`,
      `${zh ? "假设" : "Hypotheses"}: ${joinOrDash(b.hypothesis_notes)}`,
      `${zh ? "不确定" : "Uncertainty"}: ${joinOrDash(b.uncertainty_notes)}`,
      `${zh ? "第三方资料限制" : "Third-party data limits"}: ${joinOrDash(b.third_party_data_limits)}`,
    ];
    if (skipped && lines.every((l) => l.endsWith("—"))) return [];
    return [lines.join("\n")];
  }
  const a = page.alignment_with_main;
  const summary = (a.summary || "").trim();
  const effect = (a.effect_on_page06_execution || "").trim();
  if (!summary && !effect) return [];
  return [
    [
      summary,
      `${zh ? "是否改变本题推荐" : "Changes the main recommendation"}: ${a.changes_page01_recommendation ? (zh ? "是" : "yes") : zh ? "否" : "no"}`,
      `${zh ? "是否改变路径排序" : "Changes path order"}: ${a.changes_page05_path_order ? (zh ? "是" : "yes") : zh ? "否" : "no"}`,
      effect ? `${zh ? "对执行的影响" : "Effect on execution"}: ${effect}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  ];
}

export function resolvePage07SectionGapLines(
  page: Face07V2,
  sectionId: Page07SectionId,
): string[] {
  const gaps = page.missing_inputs ?? [];
  return gaps
    .filter((g) => g.section_id === sectionId)
    .map((g) => `${g.field_id}: ${g.affects_content}`);
}

export function assemblePage07SectionsForDisplay(
  page: Face07V2,
  locale?: string,
): Page07AssembledSection[] {
  // not_applicable is omitted at report orchestration; keep assembly empty if called.
  if (isFace07NotApplicableOmit(page)) return [];

  const displayLocale = locale || page.locale || "en";
  const zh = localeBucket(displayLocale) === "zh";
  const order = resolvePage07ReadingOrder(page);
  return order.map((sectionId) => {
    const def = page07SectionById(sectionId)!;
    return {
      section_id: sectionId,
      title: page07SectionTitle(sectionId, displayLocale),
      reading_rank: def.reading_rank,
      required: def.required,
      texts: resolvePage07SectionUnitTexts(
        { ...page, locale: (page.locale ?? displayLocale) as Face07V2["locale"] },
        sectionId,
      ),
      empty_display: zh ? def.empty_display_zh : def.empty_display_en,
      gap_lines: resolvePage07SectionGapLines(page, sectionId),
    };
  });
}

export function assemblePage07PdfArgumentBodies(
  page: Face07V2,
  locale = "zh",
): Array<{ body: string }> {
  // SoT 2.1: not_applicable → no PDF content blocks (no blank page).
  if (isFace07NotApplicableOmit(page)) return [];

  const sections = assemblePage07SectionsForDisplay(page, locale);
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
