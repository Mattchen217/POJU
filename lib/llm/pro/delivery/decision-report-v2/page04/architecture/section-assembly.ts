/**
 * Single Page04 section assembly SSOT for Reader + PDF.
 */

import type { Face04V2 } from "../../schemas";
import {
  normalizePage04ReadingOrder,
  page04SectionById,
  type Page04SectionId,
} from "./sections";
import {
  face04UnitDisplayText,
  resolveFace04Units,
} from "../content-units";

export type Page04AssembledSection = {
  section_id: Page04SectionId;
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

export function page04SectionTitle(
  sectionId: Page04SectionId,
  locale: string,
): string {
  const def = page04SectionById(sectionId);
  if (!def) return sectionId;
  return localeBucket(locale) === "zh" ? def.title_zh : def.title_en;
}

export function resolvePage04ReadingOrder(
  page: Pick<Face04V2, "reading_order"> | null | undefined,
): Page04SectionId[] {
  return normalizePage04ReadingOrder(page?.reading_order);
}

function dedupeUnitIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function resolvePage04SectionUnitTexts(
  page: Face04V2,
  sectionId: Page04SectionId,
): string[] {
  const def = page04SectionById(sectionId);
  if (!def) return [];

  if (def.unit_ids_field === "evidence_boundary") {
    const b = page.evidence_boundary;
    const parts: string[] = [];
    const notes = resolveFace04Units(
      page,
      dedupeUnitIds(b.evidence_note_unit_ids),
    ).map(face04UnitDisplayText);
    if (notes.length) parts.push(...notes);
    if (b.hypothesis_notes.length) {
      parts.push(`HYPOTHESES:\n${b.hypothesis_notes.join("\n")}`);
    }
    if (b.uncertainty_notes.length) {
      parts.push(`UNCERTAINTY:\n${b.uncertainty_notes.join("\n")}`);
    }
    if (b.confirmed_fact_ids.length) {
      parts.push(`CONFIRMED_FACT_IDS:\n${b.confirmed_fact_ids.join(", ")}`);
    }
    return parts;
  }

  const ids =
    sectionId === "bottleneck_naming"
      ? page.bottleneck_naming_unit_ids
      : sectionId === "manifestation"
        ? page.manifestation_unit_ids
        : sectionId === "force_through_cost"
          ? page.force_through_cost_unit_ids
          : page.leverage_point_unit_ids;
  return resolveFace04Units(page, dedupeUnitIds(ids)).map(face04UnitDisplayText);
}

function localizeBoundaryParts(parts: string[], locale: string): string[] {
  const zh = localeBucket(locale) === "zh";
  return parts.map((p) => {
    if (p.startsWith("HYPOTHESES:")) {
      return p.replace(
        "HYPOTHESES:",
        zh ? "解释性假设（非已确认事实）：" : "Explanatory hypotheses (not confirmed facts):",
      );
    }
    if (p.startsWith("UNCERTAINTY:")) {
      return p.replace("UNCERTAINTY:", zh ? "不确定性：" : "Uncertainty:");
    }
    if (p.startsWith("CONFIRMED_FACT_IDS:")) {
      return p.replace(
        "CONFIRMED_FACT_IDS:",
        zh ? "已确认事实指针：" : "Confirmed fact pointers:",
      );
    }
    return p;
  });
}

export function resolvePage04SectionGapLines(
  page: Face04V2,
  sectionId: Page04SectionId,
): string[] {
  return (page.missing_inputs ?? [])
    .filter((g) => g.section_id === sectionId)
    .map((g) => `[${g.status}] ${g.field_id}: ${g.affects_content}`);
}

export function assemblePage04SectionsForDisplay(
  page: Face04V2,
  locale: string,
): Page04AssembledSection[] {
  const zh = localeBucket(locale) === "zh";
  return resolvePage04ReadingOrder(page).map((sectionId) => {
    const def = page04SectionById(sectionId)!;
    let texts = resolvePage04SectionUnitTexts(page, sectionId);
    if (sectionId === "evidence_boundary") {
      texts = localizeBoundaryParts(texts, locale);
    }
    const gap_lines = resolvePage04SectionGapLines(page, sectionId);
    return {
      section_id: sectionId,
      title: page04SectionTitle(sectionId, locale),
      reading_rank: def.reading_rank,
      required: def.required,
      texts,
      empty_display: zh ? def.empty_display_zh : def.empty_display_en,
      gap_lines,
    };
  });
}

export function assemblePage04PdfArgumentBodies(
  page: Face04V2,
  locale = "zh",
): Array<{ body: string }> {
  const sections = assemblePage04SectionsForDisplay(page, locale);
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
