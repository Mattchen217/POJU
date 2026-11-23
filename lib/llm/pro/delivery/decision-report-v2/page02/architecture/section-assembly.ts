/**
 * Single Page02 section assembly SSOT for Reader + PDF.
 * Authority:
 * - PAGE02_SECTION_DEFINITIONS = section metadata + unit_ids_field mapping
 * - Face02V2 *_unit_ids / explanation_boundary = content association
 * - This module = only consumer mapping (no third title/order table)
 */

import type { Face02V2 } from "../../schemas";
import {
  PAGE02_SECTION_DEFINITIONS,
  page02DefaultReadingOrder,
  page02SectionById,
  type Page02SectionId,
} from "./sections";
import {
  face02UnitDisplayText,
  resolveFace02Units,
} from "../content-units";

export type Page02AssembledSection = {
  section_id: Page02SectionId;
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

export function page02SectionTitle(
  sectionId: Page02SectionId,
  locale: string,
): string {
  const def = page02SectionById(sectionId);
  if (!def) return sectionId;
  return localeBucket(locale) === "zh" ? def.title_zh : def.title_en;
}

export function resolvePage02ReadingOrder(
  page: Pick<Face02V2, "reading_order"> | null | undefined,
): Page02SectionId[] {
  const order = page?.reading_order;
  if (Array.isArray(order) && order.length) {
    return order.filter((id): id is Page02SectionId =>
      PAGE02_SECTION_DEFINITIONS.some((s) => s.section_id === id),
    );
  }
  return page02DefaultReadingOrder();
}

/** Resolve unit texts for a section from Face02V2 unit_id lists (sole content map). */
export function resolvePage02SectionUnitTexts(
  page: Face02V2,
  sectionId: Page02SectionId,
): string[] {
  const def = page02SectionById(sectionId);
  if (!def) return [];

  if (def.unit_ids_field === "explanation_boundary") {
    const b = page.explanation_boundary;
    const parts: string[] = [];
    const personal = resolveFace02Units(page, b.personal_unit_ids).map(
      face02UnitDisplayText,
    );
    if (personal.length) {
      parts.push(`PERSONAL_BASIS:\n${personal.join("\n")}`);
    }
    const confirmed = resolveFace02Units(page, b.confirmed_fact_unit_ids).map(
      face02UnitDisplayText,
    );
    if (confirmed.length) {
      parts.push(`CONFIRMED_FACTS:\n${confirmed.join("\n")}`);
    }
    const hyp = resolveFace02Units(page, b.hypothesis_unit_ids).map(
      face02UnitDisplayText,
    );
    if (hyp.length) {
      parts.push(`HYPOTHESES:\n${hyp.join("\n")}`);
    }
    if (b.uncertainty_notes.length) {
      parts.push(`UNCERTAINTY:\n${b.uncertainty_notes.join("\n")}`);
    }
    return parts;
  }

  const ids =
    sectionId === "page_summary"
      ? page.page_summary_unit_ids
      : sectionId === "relevant_personal_factors"
        ? page.relevant_personal_factor_unit_ids
        : sectionId === "personal_reality_interplay"
          ? page.personal_reality_interplay_unit_ids
          : page.why_judgment_fits_unit_ids;
  return resolveFace02Units(page, ids).map(face02UnitDisplayText);
}

function localizeBoundaryParts(parts: string[], locale: string): string[] {
  const zh = localeBucket(locale) === "zh";
  return parts.map((p) => {
    if (p.startsWith("PERSONAL_BASIS:")) {
      return p.replace(
        "PERSONAL_BASIS:",
        zh ? "个人分析依据：" : "Personal analysis basis:",
      );
    }
    if (p.startsWith("CONFIRMED_FACTS:")) {
      return p.replace(
        "CONFIRMED_FACTS:",
        zh ? "已确认事实：" : "Confirmed fact basis:",
      );
    }
    if (p.startsWith("HYPOTHESES:")) {
      return p.replace(
        "HYPOTHESES:",
        zh ? "解释性假设（非已确认事实）：" : "Explanatory hypotheses (not confirmed facts):",
      );
    }
    if (p.startsWith("UNCERTAINTY:")) {
      return p.replace("UNCERTAINTY:", zh ? "不确定性：" : "Uncertainty:");
    }
    return p;
  });
}

export function resolvePage02SectionGapLines(
  page: Face02V2,
  sectionId: Page02SectionId,
): string[] {
  return (page.missing_inputs ?? [])
    .filter((g) => g.section_id === sectionId)
    .map((g) => `[${g.status}] ${g.field_id}: ${g.affects_content}`);
}

/**
 * Assemble all sections in reading order — shared by Reader preview helpers and PDF.
 */
export function assemblePage02SectionsForDisplay(
  page: Face02V2,
  locale: string,
): Page02AssembledSection[] {
  const zh = localeBucket(locale) === "zh";
  return resolvePage02ReadingOrder(page).map((sectionId) => {
    const def = page02SectionById(sectionId)!;
    let texts = resolvePage02SectionUnitTexts(page, sectionId);
    if (sectionId === "explanation_boundary") {
      texts = localizeBoundaryParts(texts, locale);
    }
    const gap_lines = resolvePage02SectionGapLines(page, sectionId);
    return {
      section_id: sectionId,
      title: page02SectionTitle(sectionId, locale),
      reading_rank: def.reading_rank,
      required: def.required,
      texts,
      empty_display: zh ? def.empty_display_zh : def.empty_display_en,
      gap_lines,
    };
  });
}

/** PDF argument bodies from the same assembly SSOT. */
export function assemblePage02PdfArgumentBodies(
  page: Face02V2,
  locale = "zh",
): Array<{ body: string }> {
  const sections = assemblePage02SectionsForDisplay(page, locale);
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
    // Always emit every reading-order section (same as Reader), including empty optional.
    if (!chunks.length) {
      chunks.push(s.empty_display);
    }
    out.push({ body: `### ${s.title}\n\n${chunks.join("\n\n")}` });
  }
  return out;
}
