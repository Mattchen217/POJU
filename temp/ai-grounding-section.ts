const MAX_SOURCE_QUOTE_LENGTH = 2000;

/**
 * Longest raw answer that can be persisted verbatim as a fact statement
 * (DC writers cap statements at this length). A longer answer is never
 * truncated into a fact: its items fail closed and the user is asked to
 * restate in shorter parts.
 */
export const FACT_STATEMENT_MAX_CHARS = 500;

export const LONG_ANSWER_ASPECT_TEXT =
  "这段回答较长，无法原样保存为事实；请把关键信息分成几句更短的回答";

/**
 * Character folding for deterministic source-quote location:
 * Unicode NFKC + zero-width removal + safe punctuation only.
 * No whitespace collapse here and no semantic similarity.
 */
function foldGroundingChars(text: string): string {
  let s = text.normalize("NFKC").replace(/[​-‍﻿]/g, "");
  s = s
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[，]/g, ",")
    .replace(/[。]/g, ".")
    .replace(/[；]/g, ";")
    .replace(/[：]/g, ":")
    .replace(/[？]/g, "?")
    .replace(/[！]/g, "!")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[【]/g, "[")
    .replace(/[】]/g, "]")
    .replace(/[、]/g, ",");
  return s;
}

/**
 * Conservative normalization for deterministic source-quote location.
 * Unicode + whitespace + safe punctuation only. No semantic similarity.
 */
export function normalizeAnswerGroundingText(text: string): string {
  return foldGroundingChars(text).replace(/\s+/gu, " ").trim();
}

// ---------------------------------------------------------------------------
// Source location (M2.4-R2)
//
// The raw user answer is the only statement a fact may carry. A model
// extraction proves its relation to that answer by quoting it: the quote must
// be found in the original characters (cluster-aligned). Location and offsets
// are audit metadata; they never authorize a write and never become the
// persisted statement.
// ---------------------------------------------------------------------------

type GroundableItem = {
  text: string;
  source_quote: string;
  source_start?: number | null;
  source_end?: number | null;
};

export type LocatedSourceSpan = {
  /** UTF-16 offsets into the trimmed user statement, end exclusive. */
  start: number;
  end: number;
  /** Original, unnormalized user-authored text of [start, end). */
  text: string;
};

export type SourceQuoteLocateResult =
  | ({ ok: true } & LocatedSourceSpan)
  | { ok: false; reason: SourceQuoteRejectionReason };

export type SourceQuoteGroundingResult =
  | { ok: true; span: LocatedSourceSpan }
  | { ok: false; reason: SourceQuoteRejectionReason };

/** Separator characters that may be omitted at either edge of a quote. */
const EDGE_SEPARATOR_RE = /[\s。｡！？!?；;，,﹐.]/;
const CLUSTER_EXTEND_RE = /[\p{M}\u200C\u200D\uFE00-\uFE0F]/u;

function trimEdges(s: string, start: number, end: number): [number, number] {
  let a = start;
  let b = end;
  while (a < b && EDGE_SEPARATOR_RE.test(s[a]!)) a++;
  while (b > a && EDGE_SEPARATOR_RE.test(s[b - 1]!)) b--;
  return [a, b];
}

type NormalizedMap = {
  text: string;
  /** For each UTF-16 unit of `text`, the index of its source cluster. */
  clusterIndex: number[];
  clusters: Array<{ start: number; end: number }>;
  clusterStarts: Set<number>;
};

/** Base character plus following combining marks / joiners / variation selectors. */
function segmentClusters(s: string): Array<{ start: number; end: number }> {
  const clusters: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < s.length) {
    const cp = s.codePointAt(i)!;
    let end = i + (cp > 0xffff ? 2 : 1);
    while (end < s.length) {
      const next = s.codePointAt(end)!;
      const extends_ =
        CLUSTER_EXTEND_RE.test(String.fromCodePoint(next)) || (next >= 0xe0100 && next <= 0xe01ef);
      if (!extends_) break;
      end += next > 0xffff ? 2 : 1;
    }
    clusters.push({ start: i, end });
    i = end;
  }
  return clusters;
}

/**
 * Normalize per original cluster so every normalized unit maps back to the
 * exact original cluster it came from.
 */
function buildNormalizedMap(s: string): NormalizedMap {
  const clusters = segmentClusters(s);
  let text = "";
  const clusterIndex: number[] = [];
  clusters.forEach((cluster, ci) => {
    const folded = foldGroundingChars(s.slice(cluster.start, cluster.end));
    for (const ch of folded) {
      if (/\s/u.test(ch)) {
        if (text.length === 0 || text.endsWith(" ")) continue;
        text += " ";
        clusterIndex.push(ci);
        continue;
      }
      text += ch;
      for (let k = 0; k < ch.length; k++) clusterIndex.push(ci);
    }
  });
  while (text.endsWith(" ")) {
    text = text.slice(0, -1);
    clusterIndex.pop();
  }
  const clusterStarts = new Set(clusters.map((c) => c.start));
  clusterStarts.add(s.length);
  return { text, clusterIndex, clusters, clusterStarts };
}

/**
 * Locate source_quote inside the original (trimmed) statement.
 * - Normalization only finds candidates; a match must start and end on
 *   original character clusters.
 * - Model offsets, when present, must verify exactly; any mismatch rejects
 *   without falling back to search.
 */
export function locateSourceQuote(
  sourceQuote: string,
  statement: string,
  offsets?: { source_start?: number | null; source_end?: number | null },
): SourceQuoteLocateResult {
  const s = statement.trim();
  const quoteNorm = buildNormalizedMap(sourceQuote.trim()).text;
  if (!quoteNorm) return { ok: false, reason: "source_quote_empty" };
  const map = buildNormalizedMap(s);

  const hasStart = offsets?.source_start !== undefined && offsets?.source_start !== null;
  const hasEnd = offsets?.source_end !== undefined && offsets?.source_end !== null;
  if (hasStart || hasEnd) {
    if (!hasStart || !hasEnd) return { ok: false, reason: "source_offset_invalid" };
    const start = offsets!.source_start!;
    const end = offsets!.source_end!;
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      return { ok: false, reason: "source_offset_invalid" };
    }
    if (start < 0 || end > s.length) return { ok: false, reason: "source_offset_out_of_range" };
    if (start >= end) return { ok: false, reason: "source_offset_invalid" };
    if (!map.clusterStarts.has(start) || !map.clusterStarts.has(end)) {
      return { ok: false, reason: "source_quote_unicode_boundary_mismatch" };
    }
    if (buildNormalizedMap(s.slice(start, end)).text !== quoteNorm) {
      return { ok: false, reason: "source_offset_quote_mismatch" };
    }
    return { ok: true, start, end, text: s.slice(start, end) };
  }

  let failure: SourceQuoteRejectionReason | null = null;
  for (
    let idx = map.text.indexOf(quoteNorm);
    idx >= 0;
    idx = map.text.indexOf(quoteNorm, idx + 1)
  ) {
    const last = idx + quoteNorm.length - 1;
    const startCluster = map.clusterIndex[idx]!;
    const endCluster = map.clusterIndex[last]!;
    const startsOnCluster = idx === 0 || map.clusterIndex[idx - 1] !== startCluster;
    const endsOnCluster =
      last + 1 === map.text.length || map.clusterIndex[last + 1] !== endCluster;
    if (!startsOnCluster || !endsOnCluster) {
      failure ??= "source_quote_unicode_boundary_mismatch";
      continue;
    }
    const start = map.clusters[startCluster]!.start;
    const end = map.clusters[endCluster]!.end;
    return { ok: true, start, end, text: s.slice(start, end) };
  }
  return { ok: false, reason: failure ?? "source_quote_not_grounded" };
}

/**
 * Single grounding entry for every model-derived DC write, pending item and
 * goal-change target: the item's source_quote must be located in the raw
 * answer. The persisted statement is always the raw answer itself.
 */
export function groundExtractedItem(
  item: GroundableItem,
  statement: string,
): SourceQuoteGroundingResult {
  if (item.source_quote.length > MAX_SOURCE_QUOTE_LENGTH) {
    return { ok: false, reason: "source_quote_too_long" };
  }
  const span = locateSourceQuote(item.source_quote, statement, {
    source_start: item.source_start,
    source_end: item.source_end,
  });
  if (!span.ok) return span;
  return { ok: true, span: { start: span.start, end: span.end, text: span.text } };
}

export function groundingRejection(
  extractedIndex: number,
  item: GroundableItem,
  reason: SourceQuoteRejectionReason,
): SourceQuoteRejection {
  return {
    extracted_index: extractedIndex,
    text: item.text.slice(0, 500),
    source_quote: item.source_quote,
    reason,
    ...(item.source_start !== undefined && item.source_start !== null
      ? { source_start: item.source_start }
      : {}),
    ...(item.source_end !== undefined && item.source_end !== null
      ? { source_end: item.source_end }
      : {}),
  };
}

/**
 * Closed introducer grammar for a goal-change clause ("(我)(想)(把)(决策目标)改成…").
 * Only for presenting a candidate target; the user must confirm it explicitly.
 */
const GOAL_TARGET_INTRODUCER_RE =
  /^(?:我们|我)?(?:想要|想|要|希望|打算|准备)?(?:把)?(?:这个|我的)?(?:决策目标|决策问题|目标|问题|方向|议题)?(?:改成|换成|改为|换为|变成|变为|转成|转为|调整为|调整成|改到|换到)\s*[:：]?\s*/;

export function goalChangeTargetFromClause(clauseText: string): string {
  const [a, b] = trimEdges(clauseText, 0, clauseText.length);
  const clause = clauseText.slice(a, b);
  const intro = GOAL_TARGET_INTRODUCER_RE.exec(clause);
  if (intro && intro[0].length < clause.length) {
    const rest = clause.slice(intro[0].length);
    const [ra, rb] = trimEdges(rest, 0, rest.length);
    if (ra < rb) return rest.slice(ra, rb);
  }
  return clause;
}

/**
 * For goal_change only: the first definition_patch whose source_quote is
 * located in the raw answer supplies the candidate target, taken from the
 * user's original characters (never a model paraphrase).
 */
export function extractGroundedProposedDecisionTarget(
  draft: ModelAnswerDraft,
  statement: string,
): {
  proposed_decision_target: string | undefined;
  rejections: SourceQuoteRejection[];
} {
  const rejections: SourceQuoteRejection[] = [];
  let proposed_decision_target: string | undefined;
  for (let extractedIndex = 0; extractedIndex < draft.extracted_items.length; extractedIndex++) {
    const item = draft.extracted_items[extractedIndex]!;
    const grounding = groundExtractedItem(item, statement);
    if (!grounding.ok) {
      rejections.push(groundingRejection(extractedIndex, item, grounding.reason));
      continue;
    }
    if (item.semantic_kind === "definition_patch" && !proposed_decision_target) {
      const target = goalChangeTargetFromClause(grounding.span.text);
      if (target) proposed_decision_target = target.slice(0, FACT_STATEMENT_MAX_CHARS);
    }
  }
  return { proposed_decision_target, rejections };
}
