/**
 * Single Page05 section assembly SSOT for Reader + PDF.
 */

import type { Face05V2 } from "../../schemas";
import {
  normalizePage05ReadingOrder,
  page05SectionById,
  type Page05SectionId,
} from "./sections";

export type Page05AssembledSection = {
  section_id: Page05SectionId;
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

export function page05SectionTitle(
  sectionId: Page05SectionId,
  locale: string,
): string {
  const def = page05SectionById(sectionId);
  if (!def) return sectionId;
  return localeBucket(locale) === "zh" ? def.title_zh : def.title_en;
}

export function resolvePage05ReadingOrder(
  page: Pick<Face05V2, "reading_order"> | null | undefined,
): Page05SectionId[] {
  return normalizePage05ReadingOrder(page?.reading_order);
}

function formatPathUnit(
  u: Face05V2["path_units"][number],
  locale: string,
): string {
  const zh = localeBucket(locale) === "zh";
  const lines = [
    `**${u.title}** (${u.path_id} · ${u.path_role})`,
    u.description,
    `${zh ? "为何推荐" : "Why"}: ${u.recommendation_reason}`,
    `${zh ? "前提" : "Prerequisites"}: ${u.prerequisites.join("; ") || "—"}`,
    `${zh ? "资源" : "Resources"}: ${u.required_resources.join("; ") || "—"}`,
    `${zh ? "收益" : "Benefits"}: ${u.expected_benefits.join("; ") || "—"}`,
    `${zh ? "成本" : "Costs"}: ${u.costs.join("; ") || "—"}`,
    `${zh ? "风险" : "Risks"}: ${u.risks.join("; ") || "—"}`,
    `${zh ? "可逆性" : "Reversibility"}: ${u.reversibility}`,
    `${zh ? "继续信号" : "Success signals"}: ${u.success_signals.join("; ")}`,
  ];
  if (u.reconsideration_conditions.length) {
    lines.push(
      `${zh ? "可重新考虑条件" : "Reconsider when"}: ${u.reconsideration_conditions.join("; ")}`,
    );
  }
  return lines.join("\n");
}

export function resolvePage05SectionUnitTexts(
  page: Face05V2,
  sectionId: Page05SectionId,
): string[] {
  if (sectionId === "preferred_path") {
    return page.path_units
      .filter((u) => page.preferred_path_ids.includes(u.path_id))
      .map((u) => formatPathUnit(u, page.locale ?? "en"));
  }
  if (sectionId === "alternative_path") {
    return page.path_units
      .filter((u) => page.alternative_path_ids.includes(u.path_id))
      .map((u) => formatPathUnit(u, page.locale ?? "en"));
  }
  if (sectionId === "cautious_path") {
    const units = page.path_units
      .filter((u) => page.cautious_path_ids.includes(u.path_id))
      .map((u) => formatPathUnit(u, page.locale ?? "en"));
    if (units.length) return units;
    const note = page.evidence_boundary.cautious_absent_note?.trim();
    return note ? [note] : [];
  }
  if (sectionId === "switching_exit") {
    const zh = localeBucket(page.locale ?? "en") === "zh";
    return page.switching_rules.map((r) => {
      const target =
        r.target_path_id && r.target_path_id.trim()
          ? ` → ${r.target_path_id}`
          : "";
      return [
        `**${r.rule_id}** · ${r.action}${target}`,
        `${zh ? "来源路径" : "From"}: ${r.source_path_id}`,
        `${zh ? "触发" : "Trigger"}: ${r.trigger_condition}`,
        `${zh ? "理由" : "Why"}: ${r.rationale}`,
      ].join("\n");
    });
  }
  // path_comparison
  const zh = localeBucket(page.locale ?? "en") === "zh";
  return page.path_comparison.rows.map((row) =>
    [
      `**${row.path_id}**`,
      `${zh ? "收益" : "Benefit"}: ${row.benefit}`,
      `${zh ? "成本" : "Cost"}: ${row.cost}`,
      `${zh ? "风险" : "Risk"}: ${row.risk}`,
      `${zh ? "资源" : "Resources"}: ${row.resource_requirement}`,
      `${zh ? "可逆性" : "Reversibility"}: ${row.reversibility}`,
      `${zh ? "成立条件" : "Prerequisites"}: ${row.prerequisites}`,
    ].join("\n"),
  );
}

export function resolvePage05SectionGapLines(
  page: Face05V2,
  sectionId: Page05SectionId,
): string[] {
  return (page.missing_inputs ?? [])
    .filter((g) => g.section_id === sectionId)
    .map((g) => `[${g.status}] ${g.field_id}: ${g.affects_content}`);
}

export function assemblePage05SectionsForDisplay(
  page: Face05V2,
  locale: string,
): Page05AssembledSection[] {
  const zh = localeBucket(locale) === "zh";
  const stamped = { ...page, locale: (page.locale ?? locale) as Face05V2["locale"] };
  return resolvePage05ReadingOrder(page).map((sectionId) => {
    const def = page05SectionById(sectionId)!;
    const texts = resolvePage05SectionUnitTexts(stamped, sectionId);
    const gap_lines = resolvePage05SectionGapLines(page, sectionId);
    return {
      section_id: sectionId,
      title: page05SectionTitle(sectionId, locale),
      reading_rank: def.reading_rank,
      required: def.required,
      texts,
      empty_display: zh ? def.empty_display_zh : def.empty_display_en,
      gap_lines,
    };
  });
}

export function assemblePage05PdfArgumentBodies(
  page: Face05V2,
  locale = "zh",
): Array<{ body: string }> {
  const sections = assemblePage05SectionsForDisplay(page, locale);
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
