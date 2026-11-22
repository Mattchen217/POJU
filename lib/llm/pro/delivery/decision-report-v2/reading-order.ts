/**
 * User-facing continuous reading numbers vs internal page ids.
 *
 * Internal ids keep 01/02/04/05/06/07/08 + appendix id "03" (glossary).
 * Users never see skip gaps or a blank chart-appendix page on new reports.
 */

import {
  MAIN_NARRATIVE_PAGE_ORDER,
  APPENDIX_PAGE_ID,
  type DecisionPageId,
} from "@/lib/llm/pro/delivery/page-feed-matrix";

/** Appendix meta id — still "03" internally; product role = glossary. */
export const GLOSSARY_APPENDIX_PAGE_ID = APPENDIX_PAGE_ID;

export type ReadingOrderOptions = {
  includePage07?: boolean;
  /** When false, omit glossary appendix (no terms used). */
  includeGlossaryAppendix?: boolean;
};

/**
 * Internal generation / shelf order for new Decision Report V2 books.
 * Chart appendix is never included.
 */
export function decisionReportV2InternalOrder(
  opts: ReadingOrderOptions = {},
): DecisionPageId[] {
  const include07 = opts.includePage07 === true;
  const includeGlossary = opts.includeGlossaryAppendix !== false;
  const order = (MAIN_NARRATIVE_PAGE_ORDER as readonly DecisionPageId[]).filter(
    (id) => id !== "07" || include07,
  );
  if (includeGlossary) {
    return [...order, GLOSSARY_APPENDIX_PAGE_ID];
  }
  return [...order];
}

/** Continuous 1..N display number for an internal page id. */
export function userFacingPageNumber(
  internalPageId: DecisionPageId,
  order: readonly DecisionPageId[],
): number {
  const idx = order.indexOf(internalPageId);
  return idx >= 0 ? idx + 1 : 0;
}

export function formatUserFacingPageLabel(
  internalPageId: DecisionPageId,
  order: readonly DecisionPageId[],
  locale = "zh",
): string {
  const n = userFacingPageNumber(internalPageId, order);
  if (!n) return "";
  const padded = String(n).padStart(2, "0");
  if (internalPageId === GLOSSARY_APPENDIX_PAGE_ID) {
    if (locale.startsWith("zh")) return `${padded}｜本报告使用的术语`;
    if (locale.startsWith("es")) return `${padded}｜Términos usados`;
    if (locale.startsWith("fr")) return `${padded}｜Termes utilisés`;
    if (locale.startsWith("de")) return `${padded}｜Verwendete Begriffe`;
    return `${padded}｜Terms used in this report`;
  }
  return padded;
}

/** True when Face03 payload is the new glossary appendix (not chart dump). */
export function isGlossaryAppendixPage(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return o.page === "03" && o.kind === "glossary_appendix";
}

/** True when Face03 payload is legacy chart appendix. */
export function isLegacyChartAppendixPage(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.page === "03" &&
    o.kind !== "glossary_appendix" &&
    typeof o.bazi_slice === "string"
  );
}
