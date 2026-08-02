import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_SECTION_HEADINGS,
  type DeliveryArgumentTree,
  type DeliverySegmentKey,
  type DeliveryTextTree,
  argumentTreeToTextTree,
  coerceDeliveryArguments,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_TRANSITION_KEYS } from "@/lib/llm/pro/delivery/delivery-schema";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { buildCoreJudgmentsRefsFromStructured } from "@/lib/base-analysis/core-judgments";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";

function evidenceLeadLabel(locale: string): string {
  return locale.startsWith("zh") ? "**依据与推理:**" : "**Evidence & reasoning:**";
}

export type DeliveryBookMeta = {
  original_question: string;
  locale: string;
  report_id?: string;
  generated_at?: string;
  base_analysis?: unknown | null;
};

/** Deterministic cover + TOC shell (also used for progressive stream before full merge). */
export function buildCoverAndToc(meta: DeliveryBookMeta): string {
  const zh = meta.locale.startsWith("zh");
  const q = meta.original_question.trim().slice(0, 80) || (zh ? "你的问题" : "Your question");
  const title = zh ? `关于「${q}」的能量决策报告` : `Energy Decision Report · ${q}`;
  const subtitle = zh
    ? "为你的人生关键决策，提供一份基于能量结构的深度分析"
    : "A structured energy analysis for a decision that matters";
  const date = (meta.generated_at ?? new Date().toISOString()).slice(0, 10);
  const id = meta.report_id?.trim() || `POJU-${date.replace(/-/g, "")}`;

  const toc = DELIVERY_SEGMENT_KEYS.map((k, i) => {
    const h = zh ? DELIVERY_SECTION_HEADINGS[k].zh : DELIVERY_SECTION_HEADINGS[k].en;
    return `${i + 1}. ${h}`;
  }).join("\n");

  if (zh) {
    return `# ${title}

> ${subtitle}

报告编号：${id} · 生成日期：${date}

## 目录

${toc}

---`;
  }

  return `# ${title}

> ${subtitle}

Report ID: ${id} · Date: ${date}

## Contents

${toc}

---`;
}

function buildAppendix(meta: DeliveryBookMeta): string {
  const zh = meta.locale.startsWith("zh");
  const structured = normalizeBaseAnalysisInput(meta.base_analysis ?? null).structured ?? null;
  if (!structured) {
    return zh
      ? `## 附录 · 命盘数据与术语

(本次未附硬数据表。正文依据层已含关键金字解释。)`
      : `## Appendix · Chart Data & Terms

(No structured chart attached. Evidence layers include key term glosses.)`;
  }

  const refs = buildCoreJudgmentsRefsFromStructured(structured);
  const inventory = buildStructuredInstanceInventory(structured);
  const pillars = structured.four_pillars;
  const pillarLine = pillars
    ? [pillars.year, pillars.month, pillars.day, pillars.hour].filter(Boolean).join(" · ")
    : "";

  const shensha = (refs.shensha_instances ?? []).join(zh ? "、" : ", ") || (zh ? "(无)" : "(none)");
  const termsNote = zh
    ? "术语解释见正文各论点「依据与推理」中的金字气泡；闭集术语以引擎真算为准。"
    : "Term glosses appear in each argument’s Evidence & reasoning gold marks.";

  if (zh) {
    return `## 附录 · 命盘数据与术语

### 排盘摘要
- 四柱：${pillarLine || "(未提供)"}
- 日主：${refs.day_master} · 强弱：${refs.strength}
- 用神：${refs.yong_shen} · 喜：${(refs.xi_shen ?? []).join("、") || "—"} · 忌：${(refs.ji_shen ?? []).join("、") || "—"}
- 格局：${refs.pattern}
- 神煞实例：${shensha}

### 实例清单(引擎)
${inventory || "(空)"}

### 术语说明
${termsNote}`;
  }

  return `## Appendix · Chart Data & Terms

### Chart summary
- Pillars: ${pillarLine || "(n/a)"}
- Day master: ${refs.day_master} · Strength: ${refs.strength}
- Favorable: ${refs.yong_shen} · Support: ${(refs.xi_shen ?? []).join(", ") || "—"} · Caution: ${(refs.ji_shen ?? []).join(", ") || "—"}
- Pattern: ${refs.pattern}
- Shen Sha: ${shensha}

### Engine inventory
${inventory || "(empty)"}

### Terms
${termsNote}`;
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
 * Each independent argument is followed by its own **依据与推理** block.
 */
export function mergeDeliveryToMarkdown(
  narrative: DeliveryArgumentTree | DeliveryTextTree | Record<string, unknown>,
  evidence: DeliveryArgumentTree | DeliveryTextTree | Record<string, unknown>,
  locale: string,
  meta?: DeliveryBookMeta,
): string {
  const zh = locale.startsWith("zh");
  const lead = evidenceLeadLabel(locale);
  const narrTree = coerceTree(narrative);
  const evTree = coerceTree(evidence);
  const parts: string[] = [];

  if (meta) {
    parts.push(buildCoverAndToc({ ...meta, locale }));
  }

  for (const k of DELIVERY_SEGMENT_KEYS) {
    const heading = zh
      ? `## ${DELIVERY_SECTION_HEADINGS[k].zh}`
      : `## ${DELIVERY_SECTION_HEADINGS[k].en}`;
    parts.push(heading);

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
      if (ev && !/^本段依据待补|^Evidence (for this section )?pending/i.test(ev)) {
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
