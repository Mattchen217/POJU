import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_TRANSITION_KEYS,
  type DeliveryArgumentTree,
  type DeliverySegmentKey,
  type DeliveryTextTree,
  argumentTreeToTextTree,
  mergeDeliveryArgumentTrees,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  deliveryAppendixCopy,
  deliveryCoverCopy,
  deliveryEvidenceLeadLabel,
  deliveryEvidencePendingDetectRe,
  deliveryEvidencePendingPlaceholder,
  deliveryLocaleBucket,
  deliverySectionHeading,
} from "@/lib/llm/pro/delivery/delivery-locale";
import {
  buildSegmentStructureMarkdown,
  encodePageScanMarkdown,
  encodeThirtyDayGanttMarkdown,
  type PageScanCardStruct,
  type ThirtyDayGanttStruct,
} from "@/lib/llm/pro/delivery/poju-struct-blocks";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { buildCoreJudgmentsRefsFromStructured } from "@/lib/base-analysis/core-judgments";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import type { BreakthroughCore } from "@/lib/poju/agent-state";

export type DeliveryPageStructs = {
  scan?: PageScanCardStruct | null;
  gantt?: ThirtyDayGanttStruct | null;
};

export type DeliveryBookMeta = {
  original_question: string;
  locale: string;
  report_id?: string;
  generated_at?: string;
  base_analysis?: unknown | null;
  /** Layer-1 pack on spine — drives P1 dashboard / roadmap code structures */
  breakthrough_core?: BreakthroughCore | null;
  /** Model-authored per-page structs (scan + thirty_day gantt) */
  page_structs?: Partial<Record<DeliverySegmentKey, DeliveryPageStructs>>;
};

/** Deterministic cover + TOC shell (also used for progressive stream before full merge). */
export function buildCoverAndToc(meta: DeliveryBookMeta): string {
  const copy = deliveryCoverCopy(meta.locale);
  const q = meta.original_question.trim().slice(0, 80) || copy.fallbackQuestion;
  const title = copy.title(q);
  const date = (meta.generated_at ?? new Date().toISOString()).slice(0, 10);
  const id = meta.report_id?.trim() || `POJU-${date.replace(/-/g, "")}`;

  const toc = DELIVERY_SEGMENT_KEYS.map((k, i) => {
    return `${i + 1}. ${deliverySectionHeading(k, meta.locale)}`;
  }).join("\n");

  return `# ${title}

> ${copy.subtitle}

${copy.metaLine(id, date)}

## ${copy.tocTitle}

${toc}

---`;
}

function buildAppendix(meta: DeliveryBookMeta): string {
  const a = deliveryAppendixCopy(meta.locale);
  const bucket = deliveryLocaleBucket(meta.locale);
  const listJoin = bucket === "zh" ? "、" : ", ";
  const structured = normalizeBaseAnalysisInput(meta.base_analysis ?? null).structured ?? null;
  if (!structured) {
    return `## ${a.heading}

${a.emptyBody}`;
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

  return `## ${a.heading}

### ${a.chartSummary}
- ${a.pillars}: ${pillarLine || a.notProvided}
- ${a.dayMaster}: ${refs.day_master} · ${a.strength}: ${refs.strength}
- ${a.favorable}: ${refs.yong_shen} · ${a.support}: ${xi} · ${a.caution}: ${ji}
- ${a.pattern}: ${refs.pattern}
- ${a.shenSha}: ${shensha}

### ${a.engineInventory}
${inventory || a.empty}

### ${a.terms}
${a.termsNote}`;
}

function coerceTree(
  input: DeliveryArgumentTree | DeliveryTextTree | Record<string, unknown>,
): DeliveryArgumentTree {
  // Resolves legacy aliases (situation→foundation, energy_base→foundation, …).
  return mergeDeliveryArgumentTrees([input as Record<string, unknown>]);
}

/**
 * Merge narrative + evidence argument trees into book dual-layer markdown.
 * Each independent argument is followed by its own evidence lead block.
 */
export function mergeDeliveryToMarkdown(
  narrative: DeliveryArgumentTree | DeliveryTextTree | Record<string, unknown>,
  evidence: DeliveryArgumentTree | DeliveryTextTree | Record<string, unknown>,
  locale: string,
  meta?: DeliveryBookMeta,
): string {
  const lead = deliveryEvidenceLeadLabel(locale);
  const pendingRe = deliveryEvidencePendingDetectRe();
  const narrTree = coerceTree(narrative);
  const evTree = coerceTree(evidence);
  const parts: string[] = [];

  if (meta) {
    parts.push(buildCoverAndToc({ ...meta, locale }));
  }

  for (const k of DELIVERY_SEGMENT_KEYS) {
    parts.push(`## ${deliverySectionHeading(k, locale)}`);

    const pageStructs = meta?.page_structs?.[k];
    if (pageStructs?.scan && pageStructs.scan.items.length >= 2) {
      const scanMd = encodePageScanMarkdown(pageStructs.scan, locale);
      if (scanMd) parts.push(scanMd);
    }
    if (k === "thirty_day" && pageStructs?.gantt && pageStructs.gantt.weeks.length >= 4) {
      const ganttMd = encodeThirtyDayGanttMarkdown(pageStructs.gantt, locale);
      if (ganttMd) parts.push(ganttMd);
    }

    const structureMd = buildSegmentStructureMarkdown(
      k,
      locale,
      meta?.breakthrough_core ?? null,
    );
    if (structureMd) parts.push(structureMd);

    const bodyArgs = narrTree[k] ?? [];
    if (bodyArgs.length === 0) continue;

    const evArgs = evTree[k] ?? [];
    const isTransition = DELIVERY_TRANSITION_KEYS.has(k);

    const pendingPlaceholder = deliveryEvidencePendingPlaceholder(locale);
    for (let i = 0; i < bodyArgs.length; i++) {
      const body = (bodyArgs[i]?.body ?? "").trim().replace(/\n{2,}/g, "\n");
      if (!body) continue;
      parts.push(body);
      if (isTransition) continue;
      const evRaw = (
        evArgs[i]?.evidence ??
        evArgs[i]?.body ??
        bodyArgs[i]?.evidence ??
        ""
      )
        .trim()
        .replace(/\s*\n+\s*/g, " ");
      const pending = !evRaw || pendingRe.test(evRaw);
      if (pending) {
        console.error("[delivery/merge] content evidence missing", { key: k, index: i });
      }
      // Always emit an evidence slot per body so book modules stay 1:1 (no “only last has 依据”).
      parts.push(`${lead}\n${pending ? pendingPlaceholder : evRaw}`);
    }
  }

  if (meta) {
    parts.push(buildAppendix({ ...meta, locale }));
  }

  return parts.join("\n\n");
}

/** @deprecated Prefer argument trees — helper for tests. */
export function mergeDeliveryTextTreesAsMarkdown(
  narrative: DeliveryTextTree,
  evidence: DeliveryTextTree,
  locale: string,
  meta?: DeliveryBookMeta,
): string {
  return mergeDeliveryToMarkdown(narrative, evidence, locale, meta);
}

export function listDeliverySectionKeys(): readonly DeliverySegmentKey[] {
  return DELIVERY_SEGMENT_KEYS;
}

export { argumentTreeToTextTree };
