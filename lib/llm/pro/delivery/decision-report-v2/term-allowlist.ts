/**
 * Build a page-scoped term allowlist from SSOT + approved readings.
 * Model only receives term_id / soft label / definition / related readings.
 */

import {
  glossOf,
  pojuTermBySlug,
  termOf,
} from "@/lib/glossary/pojulife-terms";
import type { ApprovedReading, TermAllowlistEntry } from "./types";
import { normalizeReportLocale } from "./body-compliance";

export function buildTermAllowlist(input: {
  locale: string;
  readings: readonly ApprovedReading[];
  /** Extra term ids already known relevant to this decision (optional). */
  extraTermIds?: readonly string[];
}): TermAllowlistEntry[] {
  const locale = normalizeReportLocale(input.locale);
  const byId = new Map<string, TermAllowlistEntry>();

  const add = (termId: string, readingId?: string) => {
    const term = pojuTermBySlug(termId);
    if (!term) return;
    const soft = termOf(termId, locale);
    const def = glossOf(termId, locale);
    if (!soft || !def) return;
    const existing = byId.get(termId);
    if (existing) {
      if (readingId && !existing.related_reading_ids.includes(readingId)) {
        existing.related_reading_ids.push(readingId);
      }
      return;
    }
    byId.set(termId, {
      term_id: termId,
      soft_label: soft,
      definition: def,
      related_reading_ids: readingId ? [readingId] : [],
    });
  };

  for (const reading of input.readings) {
    for (const termId of reading.term_ids) {
      add(termId, reading.reading_id);
    }
  }
  for (const termId of input.extraTermIds ?? []) {
    add(termId);
  }

  return [...byId.values()];
}

/** Format allowlist for model feed (no traditional forms). */
export function formatTermAllowlistForPrompt(
  entries: readonly TermAllowlistEntry[],
): string {
  if (!entries.length) {
    return "term_allowlist: []（本题无可用术语；依据层不要发明 term_id）";
  }
  const lines = entries.map((e) => {
    const related = e.related_reading_ids.length
      ? ` related_readings=[${e.related_reading_ids.join(",")}]`
      : "";
    return `- term_id=${e.term_id} soft="${e.soft_label}" def="${e.definition}"${related}`;
  });
  return ["term_allowlist:", ...lines].join("\n");
}
