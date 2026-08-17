/**
 * Delivery book appendix (P7) — merge-time markdown.
 * Chart archive + timing window + P1 path snapshot; gold glossary stays UI/HTML.
 */

import {
  buildClimateNowFromStructured,
  buildCoreJudgmentsRefsFromStructured,
  resolveCurrentDaYunStep,
} from "@/lib/base-analysis/core-judgments";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  deliveryAppendixCopy,
  deliveryLocaleBucket,
  type DeliveryAppendixCopy,
} from "@/lib/llm/pro/delivery/delivery-locale";
import type { DeliveryPageData, P1Page } from "@/lib/llm/pro/delivery/page-schema/types";

/** Minimal meta for appendix — avoids circular runtime import with merge. */
export type DeliveryAppendixMeta = {
  locale: string;
  base_analysis?: unknown | null;
  page_schemas?: Partial<Record<DeliverySegmentKey, DeliveryPageData>>;
};

function clipLine(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

/** Decade window years for current da_yun step — archive only, no ganzhi in the line. */
export function formatAppendixTimingYears(structured: ProfileStructured): string {
  const step = resolveCurrentDaYunStep(structured.da_yun);
  if (step == null) return "";
  const cur = structured.da_yun[step];
  if (!cur?.start_year) return "";
  const next = structured.da_yun[step + 1];
  const endYear = next?.start_year ? next.start_year - 1 : cur.start_year + 9;
  return `${cur.start_year}–${endYear}`;
}

export function formatAppendixTimingBlock(
  structured: ProfileStructured,
  locale: string,
  a: DeliveryAppendixCopy,
): string {
  const climate = buildClimateNowFromStructured(structured, locale).trim();
  const years = formatAppendixTimingYears(structured);
  const line = years ? `${climate} · ${a.approxYears} ${years}` : climate;
  return `### ${a.timingWindow}\n\n- ${line}`;
}

function asP1Page(page: unknown): P1Page | null {
  if (!page || typeof page !== "object") return null;
  const p = page as { page?: string };
  if (p.page !== "direct_answer") return null;
  return page as P1Page;
}

export function formatAppendixPathBlock(
  meta: DeliveryAppendixMeta,
  a: DeliveryAppendixCopy,
): string | null {
  const p1 = asP1Page(meta.page_schemas?.direct_answer);
  if (!p1) return null;
  const verdict = clipLine(p1.core_judgment ?? "", 160);
  const primary = clipLine(p1.primary?.name ?? "", 80);
  const backup = clipLine(p1.backup?.name ?? "", 80);
  if (!verdict && !primary && !backup) return null;
  const lines: string[] = [`### ${a.pathSnapshot}`];
  if (verdict) lines.push(`- ${a.verdict}: ${verdict}`);
  if (primary) lines.push(`- ${a.primaryPath}: ${primary}`);
  if (backup) lines.push(`- ${a.backupPath}: ${backup}`);
  return lines.join("\n");
}

export function buildDeliveryAppendixMarkdown(meta: DeliveryAppendixMeta): string {
  const a = deliveryAppendixCopy(meta.locale);
  const bucket = deliveryLocaleBucket(meta.locale);
  const listJoin = bucket === "zh" ? "、" : ", ";
  const structured =
    normalizeBaseAnalysisInput(meta.base_analysis ?? null).structured ?? null;

  if (!structured) {
    const pathOnly = formatAppendixPathBlock(meta, a);
    // Gold glossary is UI/HTML-only (from evidence folds); do not stub a second terms H3 here.
    if (pathOnly) {
      return `## ${a.heading}\n\n${pathOnly}`;
    }
    return `## ${a.heading}\n\n${a.emptyBody}`;
  }

  const refs = buildCoreJudgmentsRefsFromStructured(structured);
  const inventory = buildStructuredInstanceInventory(structured);
  const pillars = structured.four_pillars;
  const pillarLine = pillars
    ? [pillars.year, pillars.month, pillars.day, pillars.hour].filter(Boolean).join(" · ")
    : "";

  const shensha = (refs.shensha_instances ?? []).join(listJoin) || a.none;
  const xi = (refs.xi_shen ?? []).join(listJoin) || "—";
  const ji = (refs.ji_shen ?? []).join(listJoin) || "—";

  const sections: string[] = [
    `## ${a.heading}`,
    formatAppendixTimingBlock(structured, meta.locale, a),
  ];

  const pathBlock = formatAppendixPathBlock(meta, a);
  if (pathBlock) sections.push(pathBlock);

  sections.push(`### ${a.chartSummary}
- ${a.pillars}: ${pillarLine || a.notProvided}
- ${a.dayMaster}: ${refs.day_master} · ${a.strength}: ${refs.strength}
- ${a.favorable}: ${refs.yong_shen} · ${a.support}: ${xi} · ${a.caution}: ${ji}
- ${a.pattern}: ${refs.pattern}
- ${a.shenSha}: ${shensha}`);

  sections.push(`### ${a.engineInventory}
${inventory || a.empty}`);

  // 「本报告金字表」由书页/离线 HTML 从依据层收词渲染，不在 merge markdown 再写空壳章节。

  return sections.join("\n\n");
}
