/**
 * Unit F-R2 Repair — DI2 page set is the sole authority for standalone HTML export.
 * Does not invent Page 07 from topic signals; does not omit Page 03 when the
 * verified report includes glossary content.
 */

import { createHash } from "node:crypto";

import { isFace07InsufficientInformation } from "@/lib/llm/pro/delivery/decision-report-v2/page07/report-inclusion";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { fillDecisionReportHtml } from "@/lib/deliverables/fill-delivery";
import { di2ReadingOrder } from "@/lib/poju/decision-intake/decision-report-render";
import type { DecisionReportPageRecord } from "@/lib/poju/decision-intake/decision-report-types";
import type { BuildDeliveryInteractiveHtmlOptions } from "@/lib/poju/delivery-interactive-html";

/** Bumped when the standalone HTML template / fill contract changes. */
export const DI2_HTML_TEMPLATE_VERSION = "di2-standalone-html-v1" as const;

export class Di2HtmlExportError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "Di2HtmlExportError";
    this.code = code;
  }
}

export type Di2HtmlPageAuthority = Pick<
  DecisionReportPageRecord,
  "page_id" | "applicability" | "content_markdown" | "status" | "error"
> & {
  structured?: Record<string, unknown> | null;
};

/** Content fingerprint for HTML cache / bag identity (not a second fact identity). */
export function di2HtmlContentIdentity(fullText: string): string {
  return createHash("sha256").update(fullText, "utf8").digest("hex").slice(0, 32);
}

/**
 * Refuse Page07 insufficient_information (production block) before any HTML emit.
 * Do not map it to not_applicable or applies.
 */
export function assertDi2PagesSafeForHtmlExport(
  pages: readonly Di2HtmlPageAuthority[],
): void {
  for (const p of pages) {
    if (p.page_id !== "07") continue;
    if (p.error === "insufficient_information") {
      throw new Di2HtmlExportError(
        "page07_insufficient_information",
        "Page 07 insufficient_information — refuse HTML export (production block)",
      );
    }
    if (isFace07InsufficientInformation(p.structured ?? null)) {
      throw new Di2HtmlExportError(
        "page07_insufficient_information",
        "Page 07 Face07 insufficient_information — refuse HTML export (production block)",
      );
    }
  }
}

/**
 * Prose page ids for HTML / shelf, from DI2 verified pages only.
 * - not_applicable pages omitted (incl. empty Page 03)
 * - Page 03 included only when completed with non-empty content
 * - never topic-inferred
 */
export function resolveDi2HtmlProseOrder(
  pages: readonly Di2HtmlPageAuthority[],
): DecisionPageId[] {
  assertDi2PagesSafeForHtmlExport(pages);
  const byId = new Map(pages.map((p) => [p.page_id, p]));
  return di2ReadingOrder(pages).filter((id) => {
    const p = byId.get(id);
    if (!p || p.status !== "completed") return false;
    if (id === "03") return Boolean(p.content_markdown?.trim());
    // not_applicable already removed by di2ReadingOrder; remaining must have body
    // except Page07 may carry the not_applicable note when applicability was applies —
    // for not_applicable 07, di2ReadingOrder already dropped it.
    return true;
  });
}

/** HTML pane ids: cover + DI2 prose order (no toc pane in the offline template). */
export function resolveDi2HtmlSlotIds(
  pages: readonly Di2HtmlPageAuthority[],
): readonly string[] {
  return ["cover", ...resolveDi2HtmlProseOrder(pages)];
}

export type Di2HtmlPackIdentity = {
  report_job_id: string;
  execution_generation: number;
  content_identity: string;
  locale: string;
  template_version: string;
};

export function di2HtmlPackIdentityKey(id: Di2HtmlPackIdentity): string {
  return [
    id.report_job_id,
    String(id.execution_generation),
    id.content_identity,
    id.locale.trim().toLowerCase().slice(0, 8),
    id.template_version,
  ].join("|");
}

export function sameDi2HtmlPackIdentity(
  a: Di2HtmlPackIdentity | null | undefined,
  b: Di2HtmlPackIdentity | null | undefined,
): boolean {
  if (!a || !b) return false;
  return di2HtmlPackIdentityKey(a) === di2HtmlPackIdentityKey(b);
}

export type Di2HtmlPackCacheEntry = {
  identity: Di2HtmlPackIdentity;
  html: string;
};

/** Return cached HTML only when every identity field matches. */
export function readDi2HtmlPackCache(
  cache: Di2HtmlPackCacheEntry | null | undefined,
  identity: Di2HtmlPackIdentity,
): string | null {
  if (!cache?.html) return null;
  if (!sameDi2HtmlPackIdentity(cache.identity, identity)) return null;
  return cache.html;
}

export function writeDi2HtmlPackCache(
  identity: Di2HtmlPackIdentity,
  html: string,
): Di2HtmlPackCacheEntry {
  return { identity, html };
}

export function fillDi2AuthorityHtml(
  fullText: string,
  locale: string,
  pages: readonly Di2HtmlPageAuthority[],
  opts?: Omit<BuildDeliveryInteractiveHtmlOptions, "pageOrder" | "topic">,
): string {
  const pageOrder = resolveDi2HtmlSlotIds(pages);
  return fillDecisionReportHtml(fullText, locale, {
    ...opts,
    pageOrder,
    // Explicit pageOrder is the authority — do not re-open topic 07 gate.
    topic: null,
  });
}
