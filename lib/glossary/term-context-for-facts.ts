/**
 * Phase 5 — fact-scoped term context for prompts.
 * Inject only terms present in this run's facts (soft + definition + boundary).
 * Never dump the full POJU_TERMS table into a prompt.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  glossOf,
  pojuTermBySlug,
  termOf,
  toTermLocale,
  type PojuTerm,
  type TermLocale,
  type TermNs,
} from "@/lib/glossary/pojulife-terms";
import { getShenshaRow } from "@/lib/glossary/shensha-semantic-ssot";
import { resolvePojuTerm } from "@/lib/glossary/term-resolve";
import { resolveShenshaDisposition } from "@/lib/glossary/shensha-disposition";

/** Stable fact → term pointer. namespace is required. */
export type TermFactRef = {
  namespace: TermNs;
  /** Preferred: SSOT slug when already known. */
  termId?: string;
  /** Internal traditional / alias for resolve (never echoed to users). */
  traditional?: string;
  /** Provenance for audit (e.g. structured.pillars_detail.year.shen_sha). */
  source: string;
};

export type TermContextEntry = {
  namespace: TermNs;
  slug: string;
  soft: string;
  definition: string;
  /** One-line cost / edge / non-certainty note. */
  boundary: string;
  source: string;
};

export type TermContextSkipped = {
  input: string;
  namespace: TermNs;
  source: string;
  reason: "unknown" | "ambiguous" | "forbidden" | "redline" | "missing_soft";
};

export type BuildTermContextOptions = {
  namespaces?: readonly TermNs[];
  /** Hard cap — prompts stay lean (default 40). */
  maxEntries?: number;
  includeDefinition?: boolean;
  includeBoundary?: boolean;
};

export type TermContextResult = {
  locale: TermLocale;
  entries: TermContextEntry[];
  skipped: TermContextSkipped[];
};

const BOUNDARY_BY_POLARITY: Record<
  "favorable" | "caution" | "neutral",
  Record<TermLocale, string>
> = {
  favorable: {
    zh: "倾向支持，非必然兑现；勿写成必发/必贵。",
    en: "Supportive lean — not a guarantee of outcomes.",
    es: "Tendencia de apoyo — no garantiza resultados.",
    de: "Unterstützende Neigung — kein Erfolgsversprechen.",
    fr: "Tendance favorable — pas une garantie de résultat.",
  },
  caution: {
    zh: "提示张力与代价，非灾祸预言；勿恐吓。",
    en: "Flags tension/cost — not a disaster prophecy.",
    es: "Señala tensión/coste — no es profecía de desastre.",
    de: "Zeigt Spannung/Kosten — keine Unheilsprophezeiung.",
    fr: "Signale tension/coût — pas une prophétie de catastrophe.",
  },
  neutral: {
    zh: "描述结构倾向；勿作命运定论或未来事件预测。",
    en: "Describes structural lean — not fate or event prediction.",
    es: "Describe tendencia estructural — no destino ni predicción.",
    de: "Beschreibt strukturelle Neigung — kein Schicksal/Ereignis.",
    fr: "Décrit une tendance structurelle — pas un destin.",
  },
};

function boundaryFor(
  traditional: string,
  polarity: "favorable" | "caution" | "neutral",
  locale: TermLocale,
): string {
  const row = getShenshaRow(traditional);
  if (row?.load_or_edge?.trim()) return row.load_or_edge.trim();
  return BOUNDARY_BY_POLARITY[polarity][locale];
}

/**
 * Collect term refs from this chart's structured inventory (bazi instance closed-set).
 * Redline shensha are omitted here — strip path already removes them from prompt structured.
 */
export function collectTermFactsFromStructured(
  structured: ProfileStructured | null | undefined,
): TermFactRef[] {
  if (!structured?.pillars_detail) return [];
  const out: TermFactRef[] = [];
  const seen = new Set<string>();

  const push = (ref: TermFactRef) => {
    const key = `${ref.namespace}:${(ref.termId || ref.traditional || "").trim()}`;
    if (!key.endsWith(":") && !seen.has(key)) {
      seen.add(key);
      out.push(ref);
    }
  };

  for (const pillar of ["year", "month", "day", "hour"] as const) {
    const p = structured.pillars_detail[pillar];
    if (!p) continue;
    const tg = String(p.ten_god ?? "").trim();
    if (tg) {
      push({
        namespace: "bazi",
        traditional: tg,
        source: `structured.pillars_detail.${pillar}.ten_god`,
      });
    }
    const ls = String(p.life_stage_han ?? "").trim();
    if (ls) {
      push({
        namespace: "bazi",
        traditional: ls,
        source: `structured.pillars_detail.${pillar}.life_stage_han`,
      });
    }
    for (const raw of p.shen_sha ?? []) {
      const han = String(raw ?? "").trim();
      if (!han) continue;
      const disp = resolveShenshaDisposition(han);
      if (disp.status === "internal_redline" || disp.status === "unknown_blocked") {
        continue;
      }
      push({
        namespace: "bazi",
        traditional: han,
        source: `structured.pillars_detail.${pillar}.shen_sha`,
      });
    }
  }

  const dm = String(structured.day_master ?? "").trim();
  if (dm) {
    push({
      namespace: "bazi",
      traditional: "日主",
      source: "structured.day_master",
    });
  }
  const yong = String(structured.yong_shen ?? "").trim();
  if (yong) {
    push({
      namespace: "bazi",
      traditional: "用神",
      source: "structured.yong_shen",
    });
  }

  return out;
}

/**
 * Resolve fact refs → user-visible prompt rows (soft / definition / boundary only).
 */
export function buildTermContextForFacts(
  facts: readonly TermFactRef[],
  locale: string,
  opts?: BuildTermContextOptions,
): TermContextResult {
  const loc = toTermLocale(locale);
  const nsFilter = opts?.namespaces?.length
    ? new Set(opts.namespaces)
    : null;
  const max = Math.max(1, opts?.maxEntries ?? 40);
  const includeDefinition = opts?.includeDefinition !== false;
  const includeBoundary = opts?.includeBoundary !== false;

  const entries: TermContextEntry[] = [];
  const skipped: TermContextSkipped[] = [];
  const seenSlug = new Set<string>();

  for (const fact of facts) {
    if (entries.length >= max) break;
    if (nsFilter && !nsFilter.has(fact.namespace)) continue;

    const input = (fact.traditional || fact.termId || "").trim();
    if (!input) continue;

    let term: PojuTerm | null = null;
    let skipReason: TermContextSkipped["reason"] | null = null;

    if (fact.termId) {
      const bySlug = pojuTermBySlug(fact.termId);
      if (bySlug && bySlug.ns === fact.namespace) {
        term = bySlug;
      }
    }

    if (!term && fact.traditional) {
      const resolved = resolvePojuTerm(fact.traditional, {
        namespace: fact.namespace,
      });
      if (resolved.status === "resolved") {
        term = resolved.term;
      } else if (resolved.status === "forbidden") {
        skipReason = "forbidden";
      } else if (resolved.status === "ambiguous") {
        skipReason = "ambiguous";
      } else {
        skipReason = "unknown";
      }
    } else if (!term) {
      skipReason = "unknown";
    }

    if (!term) {
      skipped.push({
        input,
        namespace: fact.namespace,
        source: fact.source,
        reason: skipReason ?? "unknown",
      });
      continue;
    }

    if (seenSlug.has(`${term.ns}:${term.slug}`)) continue;
    seenSlug.add(`${term.ns}:${term.slug}`);

    const soft = (termOf(term.slug, loc) || term.term[loc] || "").trim();
    if (!soft) {
      skipped.push({
        input,
        namespace: fact.namespace,
        source: fact.source,
        reason: "missing_soft",
      });
      continue;
    }

    entries.push({
      namespace: term.ns,
      slug: term.slug,
      soft,
      definition: includeDefinition
        ? (glossOf(term.slug, loc) || term.definition[loc] || "").trim()
        : "",
      boundary: includeBoundary
        ? boundaryFor(term.traditional, term.polarity, loc)
        : "",
      source: fact.source,
    });
  }

  return { locale: loc, entries, skipped };
}

export type FormatTermContextOptions = {
  /** Prompt task tag for provenance line. */
  task?: string;
  /** When false, omit definition column (name+boundary only). */
  includeDefinition?: boolean;
};

/**
 * Compact markdown block for LLM system/user prompts.
 * Includes namespace + source provenance; never dumps traditional Han.
 */
export function formatTermContextForPrompt(
  ctx: TermContextResult,
  opts?: FormatTermContextOptions,
): string {
  if (!ctx.entries.length) return "";
  const zh = ctx.locale === "zh";
  const withDef = opts?.includeDefinition !== false;
  const task = opts?.task?.trim() || "facts";
  const header = zh
    ? `# 本次事实术语上下文（仅下列可引用 · 任务=${task}）
只许用 slug 或自造软译名；禁止把内部传统原名写进用户可见正文。
| slug | ns | 软译 | ${withDef ? "定义 | " : ""}边界 | 来源 |`
    : `# Fact-scoped term context (cite only these · task=${task})
Use slug or soft label only; never emit traditional jargon in user-visible prose.
| slug | ns | soft | ${withDef ? "definition | " : ""}boundary | source |`;
  const sep = withDef
    ? `|---|---|---|---|---|---|`
    : `|---|---|---|---|---|`;
  const rows = ctx.entries.map((e) => {
    const def = withDef ? ` ${escapeCell(e.definition)} |` : "";
    return `| \`${e.slug}\` | ${e.namespace} | **${escapeCell(e.soft)}** |${def} ${escapeCell(e.boundary)} | \`${escapeCell(e.source)}\` |`;
  });
  return [header, sep, ...rows].join("\n");
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "/").replace(/\n/g, " ").trim();
}

/** Convenience: structured → prompt block in one call. */
export function buildTermContextPromptFromStructured(
  structured: ProfileStructured | null | undefined,
  locale: string,
  opts?: BuildTermContextOptions & FormatTermContextOptions,
): string {
  const facts = collectTermFactsFromStructured(structured);
  const ctx = buildTermContextForFacts(facts, locale, opts);
  return formatTermContextForPrompt(ctx, opts);
}
