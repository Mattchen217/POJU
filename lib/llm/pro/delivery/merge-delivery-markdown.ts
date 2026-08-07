import {
  DELIVERY_SEGMENT_KEYS,
  type DeliveryArgumentTree,
  type DeliverySegmentKey,
  type DeliveryTextTree,
  argumentTreeToTextTree,
  coerceDeliveryArguments,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_TRANSITION_KEYS } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  deliveryAppendixCopy,
  deliveryCoverCopy,
  deliveryEvidenceLeadLabel,
  deliveryEvidencePendingDetectRe,
  deliveryLocaleBucket,
  deliverySectionHeading,
} from "@/lib/llm/pro/delivery/delivery-locale";
import { buildSegmentStructureMarkdown } from "@/lib/llm/pro/delivery/poju-struct-blocks";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { buildCoreJudgmentsRefsFromStructured } from "@/lib/base-analysis/core-judgments";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import type { BreakthroughCore } from "@/lib/poju/agent-state";

export type DeliveryBookMeta = {
  original_question: string;
  locale: string;
  report_id?: string;
  generated_at?: string;
  base_analysis?: unknown | null;
  /** Layer-1 pack on spine — drives P1/P7 code structures */
  breakthrough_core?: BreakthroughCore | null;
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
  const out: DeliveryArgumentTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const v = input[k];
    if (v == null) continue;
    if (typeof v === "string") {
      const args = coerceDeliveryArguments(v);
      if (args.length) out[k] = args;
      continue;
    }
    if (Array.isArray(v)) {
      out[k] = coerceDeliveryArguments(v);
      continue;
    }
    const args = coerceDeliveryArguments(v);
    if (args.length) out[k] = args;
  }
  return out;
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

    for (let i = 0; i < bodyArgs.length; i++) {
      const body = (bodyArgs[i]?.body ?? "").trim().replace(/\n{2,}/g, "\n");
      if (!body) continue;
      parts.push(body);
      if (isTransition) continue;
      const ev = (
        evArgs[i]?.evidence ??
        evArgs[i]?.body ??
        bodyArgs[i]?.evidence ??
        ""
      )
        .trim()
        .replace(/\s*\n+\s*/g, " ");
      if (ev && !pendingRe.test(ev)) {
        parts.push(`${lead}\n${ev}`);
      }
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
