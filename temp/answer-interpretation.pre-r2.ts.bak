/**
 * M1 Answer Interpretation — structured classify before DC write / next ask.
 * M2.4-R1: context-aware classification; last_sent_question is the only answer target.
 * M2.4-R1-FU1: fact_role_codes from actually-sent Plan; never expand to DIR.required_fact_roles.
 * Never auto-confirm; never chart-as-fact.
 */

/** Phase 4: context-aware deterministic classifier (not full model interpretation). */
export const ANSWER_INTERPRETATION_VERSION = "deterministic_m2_4_r1" as const;

import type { POJUSessionState } from "@/lib/poju/types";
import type {
  AnswerClass,
  AnswerEvent,
  IntakeControlItem,
  ModelAnswerDraft,
  ProposedWrite,
  SourceQuoteRejection,
  SourceQuoteRejectionReason,
  UnresolvedAnswerItem,
  UnresolvedAnswerReason,
  UnresolvedModelAspect,
} from "./types";

export const MODEL_ANSWER_INTERPRETER_VERSION = "model_m2_4_r2" as const;

const UNKNOWN_RE =
  /^(i\s*don'?t\s*know|不知道|不清楚|不了解|没印象|不确定|unsure|no\s*idea)(\b|$|[!。！?\s])/i;
const DECLINED_RE =
  /^(不想说|不愿回答|不想回答|跳过|skip(\b|$)|decline(\b|$)|prefer\s*not|no\s*comment)/i;
const ESTIMATE_RE =
  /(大概|估计|大约|maybe|perhaps|about\s+\d|roughly|i\s*think|我觉得可能|可能是|左右)/i;
const CONSTRAINT_RE =
  /(预算|deadline|截止|必须|不能超过|hard\s*limit|budget|只能|不可逆|退出成本|责任上限|最晚|不得低于|不能低于)/i;
const CORRECTION_RE =
  /(更正|纠正|之前说错了|说错了|correction|actually\s+i\s+meant)/i;
const CONTRADICTION_RE =
  /(与之前不一致|与之前说法矛盾|之前记录错了|之前说的不是事实|实际情况与之前相反|跟之前(说的|记录)?不一致|与之前不符|互相矛盾|矛盾了|冲突了|之前说的不准确|说的不准确|actually\s+that'?s\s+wrong|that\s+conflicts)/i;
const OFF_TOPIC_RE =
  /^(今天天气|讲个笑话|tell\s+me\s+a\s+joke|无关)/i;

const ROLE_CODE_RE = /^v1\/dir\/([^/]+)\/role\/([^/]+)$/;

/** Stable pending item identity: source_turn_id + extracted-item index. Never text alone. */
export function unresolvedItemId(sourceTurnId: string, extractedIndex: number): string {
  return `${sourceTurnId}#${extractedIndex}`;
}

export function unresolvedAspectId(sourceTurnId: string, aspectIndex: number): string {
  return `${sourceTurnId}#aspect#${aspectIndex}`;
}

export function intakeControlItemId(
  sourceTurnId: string,
  kind: IntakeControlItem["kind"],
  index = 0,
): string {
  return `${sourceTurnId}#control#${kind}#${index}`;
}

const MAX_SOURCE_QUOTE_LENGTH = 2000;

/**
 * Character folding for deterministic source-quote grounding:
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
 * Conservative normalization for deterministic source-quote grounding.
 * Unicode + whitespace + safe punctuation only. No semantic similarity.
 */
export function normalizeAnswerGroundingText(text: string): string {
  return foldGroundingChars(text).replace(/\s+/gu, " ").trim();
}

// ---------------------------------------------------------------------------
// Clause-boundary grounding (M2.4-R2-FU10)
//
// A model-derived extraction may only cite complete clauses of the user's
// original statement. Boundaries are computed on the ORIGINAL characters,
// never on the normalized text, and normalization is used only to locate a
// candidate match that must start and end on original character clusters.
// A quote cut from inside a clause, or one that drops a dependent clause
// attached to it, is rejected; there is no fallback to substring matching.
// ---------------------------------------------------------------------------

type GroundableItem = {
  text: string;
  source_quote: string;
  source_start?: number | null;
  source_end?: number | null;
};

export type GroundedClauseSpan = {
  /** UTF-16 offsets into the trimmed user statement, end exclusive. */
  start: number;
  end: number;
  /** Original, unnormalized user-authored text of [start, end). */
  text: string;
};

export type ClauseSpanResult =
  | ({ ok: true } & GroundedClauseSpan)
  | { ok: false; reason: SourceQuoteRejectionReason };

export type SourceQuoteGroundingResult =
  | { ok: true; span: GroundedClauseSpan }
  | { ok: false; reason: SourceQuoteRejectionReason };

const HARD_BOUNDARY_CHARS = new Set(["。", "｡", "！", "？", "!", "?", "；", ";", "\n", "\r"]);
const SOFT_BOUNDARY_CHARS = new Set(["，", ",", "﹐"]);
const BRACKET_PAIRS: Record<string, string> = {
  "（": "）",
  "(": ")",
  "「": "」",
  "『": "』",
  "“": "”",
  "《": "》",
  "【": "】",
  "[": "]",
  "{": "}",
  "〈": "〉",
};
const BRACKET_CLOSERS = new Set(Object.values(BRACKET_PAIRS));
const ASCII_ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "st", "vs", "etc", "eg", "ie", "jr", "sr", "prof", "inc", "ltd", "co", "no", "approx",
]);
const CJK_OR_FULLWIDTH_RE = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;
/** Separator characters that may be omitted at either edge of a quote. */
const EDGE_SEPARATOR_RE = /[\s。｡！？!?；;，,﹐.]/;
const LEADING_OPENERS_RE = /^[\s"“「『《【（(\[{〈]+/;
const CLUSTER_EXTEND_RE = /[\p{M}\u200C\u200D\uFE00-\uFE0F]/u;

/**
 * Closed-class clause-structure markers. A clause headed by a conjunction,
 * subordinator, or predicate-initial adverb / modal (shared elided subject)
 * is not independent of the clause before it. Over-merging is fail-closed:
 * the model must then quote the larger complete span.
 */
const ZH_DEPENDENT_HEAD_RE =
  /^(?:[但却而并且就才也还又再都便仍亦则即乃故或及与和跟同不没未别莫勿无非只仅光唯最至更已将要想能会可应该须必需得愿肯敢是等以因从如若倘除虽尽否然况甚那]|正在|直到|到时|由于|于是|自从|假如|假设|万一|一旦|即使|哪怕|就算|只要|只有|大概|大约|估计|或许|也许|差不多|基本|几乎|顶多|起码|左右|打算|希望|计划|决定|准备)/;
const EN_DEPENDENT_HEAD_RE =
  /^(?:but|yet|however|though|although|unless|if|because|since|so|and|or|nor|except|otherwise|while|whereas|until|before|after|when|whenever|once|provided|as|even|only|not|never|no|without|which|who|whom|whose|where|that|then|still|maybe|probably|perhaps|possibly|likely|at|up|about|around|roughly|approximately|just|already|to|too|also|plus|unlike|instead|rather)\b/i;
/** A clause opened by a subordinator binds to the clause that follows it. */
const ZH_SUBORDINATOR_RE =
  /^(?:如果|假如|假设|要是|若|倘若|万一|虽然|虽说|尽管|即使|即便|哪怕|就算|因为|由于|只要|只有|除非|一旦|既然|无论|不管|不论|等到|直到|自从|当(?![前下地然时初年天月日中今场面]))/;
const EN_SUBORDINATOR_RE =
  /^(?:if|unless|although|though|because|since|when|whenever|while|once|even if|even though|as long as|provided|whether|before|after|until|given)\b/i;
/** A clause ending in a connective or clause-taking verb continues into the next clause. */
const ZH_DANGLING_END_RE =
  /(?:但是|但|可是|不过|而且|并且|所以|因此|因为|如果|虽然|或者|还是|然后|以及|和|跟|与|及|或|的|地|是|就是|在于|包括|叫|说|讲|想|觉得|认为|以为|知道|确定|决定|打算|希望|担心|害怕|怕|承认|否认|表示|发现|记得|忘|相信|怀疑|考虑|计划|准备|同意|反对|要求|建议|听说|问|时|时候|之前|之后|以前|以后|的话)(?:过|了|着)?$/;
const EN_DANGLING_END_RE =
  /(?:^|\s)(?:but|and|or|so|because|if|although|though|unless|yet|then|that|said|say|says|think|thought|know|knew|believe|mean|meant|decided|plan|hope|want|is|was|are|were|be|to|of|the)$/i;
/**
 * Meaning-neutral discourse / correction framing that explicitly opens a new,
 * independent statement. A clause may begin either at the marker or right
 * after it; a marker-only piece is not a clause.
 */
const DISCOURSE_ONLY_RE =
  /^(?:另外|此外|还有|补充一下|补充|更正一下|更正|纠正一下|纠正|之前说错了|说错了|之前说的不准确|also|additionally|besides|plus|by the way|btw|correction|actually i meant)$/i;
const DISCOURSE_PREFIX_RE =
  /^(?:(?:另外|此外|补充一下|补充|更正一下|更正|纠正一下|纠正|之前说错了|说错了|之前说的不准确)(?:\s*[:：]\s*|\s+)|另外|此外|(?:also|additionally|besides|by the way|btw|correction)\s*:\s*|actually\s+i\s+meant(?:\s*:\s*|\s+))/i;

function isAsciiSentencePeriod(s: string, i: number): boolean {
  const prev = s[i - 1] ?? "";
  const next = s[i + 1] ?? "";
  if (prev === "." || next === ".") return false;
  if (/\d/.test(prev) && /\d/.test(next)) return false;
  if (
    next &&
    !/\s/.test(next) &&
    !CJK_OR_FULLWIDTH_RE.test(next) &&
    next !== '"' &&
    !BRACKET_CLOSERS.has(next)
  ) {
    return false;
  }
  const word = /([A-Za-z]+)$/.exec(s.slice(Math.max(0, i - 16), i))?.[1] ?? "";
  if (word.length === 1) return false;
  if (ASCII_ABBREVIATIONS.has(word.toLowerCase())) return false;
  return true;
}

function isBoundaryAt(s: string, i: number): boolean {
  const c = s[i]!;
  if (HARD_BOUNDARY_CHARS.has(c)) return true;
  if (c === ".") return isAsciiSentencePeriod(s, i);
  if (SOFT_BOUNDARY_CHARS.has(c)) {
    return !(c === "," && /\d/.test(s[i - 1] ?? "") && /\d/.test(s[i + 1] ?? ""));
  }
  return false;
}

function trimEdges(s: string, start: number, end: number): [number, number] {
  let a = start;
  let b = end;
  while (a < b && EDGE_SEPARATOR_RE.test(s[a]!)) a++;
  while (b > a && EDGE_SEPARATOR_RE.test(s[b - 1]!)) b--;
  return [a, b];
}

function trimWhitespace(s: string, start: number, end: number): [number, number] {
  let a = start;
  let b = end;
  while (a < b && /\s/.test(s[a]!)) a++;
  while (b > a && /\s/.test(s[b - 1]!)) b--;
  return [a, b];
}

function startsWithDependentHead(head: string): boolean {
  return ZH_DEPENDENT_HEAD_RE.test(head) || EN_DEPENDENT_HEAD_RE.test(head);
}

function startsWithSubordinator(head: string): boolean {
  return ZH_SUBORDINATOR_RE.test(head) || EN_SUBORDINATOR_RE.test(head);
}

function endsWithDanglingHead(text: string): boolean {
  return ZH_DANGLING_END_RE.test(text) || EN_DANGLING_END_RE.test(text);
}

/** Very short trailing pieces are appended qualifiers, not independent clauses. */
function isShortTrailingPiece(head: string): boolean {
  const t = head.trim();
  if (/^[\x00-\x7f]+$/.test(t)) return t.split(/\s+/).length <= 2;
  return [...t].length <= 3;
}

type ClauseUnit = { starts: number[]; end: number };
type ClauseStructure =
  | { ok: true; units: ClauseUnit[] }
  | { ok: false; start: number; end: number };

/**
 * Deterministic clause structure of the original (trimmed) statement.
 * Units are maximal runs of pieces that cannot be proven independent.
 * Unbalanced brackets / quotes make the structure undeterminable.
 */
function analyzeClauseStructure(s: string): ClauseStructure {
  type RawPiece = { start: number; end: number; boundaryBefore: string };
  const raw: RawPiece[] = [];
  const stack: string[] = [];
  let broken = false;
  let unitStart = 0;
  let boundaryBefore = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === '"') {
      if (stack[stack.length - 1] === '"') stack.pop();
      else stack.push('"');
      i++;
      continue;
    }
    if (BRACKET_PAIRS[c]) {
      stack.push(c);
      i++;
      continue;
    }
    if (BRACKET_CLOSERS.has(c)) {
      const top = stack.pop();
      if (top === undefined || BRACKET_PAIRS[top] !== c) broken = true;
      i++;
      continue;
    }
    if (stack.length > 0 || !isBoundaryAt(s, i)) {
      i++;
      continue;
    }
    let j = i;
    while (j < s.length && (isBoundaryAt(s, j) || /\s/.test(s[j]!))) j++;
    raw.push({ start: unitStart, end: i, boundaryBefore });
    boundaryBefore = c;
    unitStart = j;
    i = j;
  }
  raw.push({ start: unitStart, end: s.length, boundaryBefore });

  const [wholeStart, wholeEnd] = trimEdges(s, 0, s.length);
  if (broken || stack.length > 0) return { ok: false, start: wholeStart, end: wholeEnd };

  type Piece = {
    start: number;
    end: number;
    altStart: number | null;
    head: string;
    markerOnly: boolean;
    boundaryBefore: string;
  };
  const pieces: Piece[] = [];
  for (const r of raw) {
    const [a, b] = trimEdges(s, r.start, r.end);
    if (a >= b) continue;
    const text = s.slice(a, b);
    const prefix = DISCOURSE_PREFIX_RE.exec(text);
    let altStart: number | null = null;
    if (prefix && prefix[0].length < text.length) {
      const [alt] = trimEdges(s, a + prefix[0].length, b);
      if (alt < b) altStart = alt;
    }
    pieces.push({
      start: a,
      end: b,
      altStart,
      head: s.slice(altStart ?? a, b).replace(LEADING_OPENERS_RE, ""),
      markerOnly: DISCOURSE_ONLY_RE.test(text),
      boundaryBefore: r.boundaryBefore,
    });
  }

  type Group = { starts: number[]; end: number; text: string; subordinatorPending: boolean };
  const groups: Group[] = [];
  let pendingMarker: { start: number; end: number } | null = null;
  for (const p of pieces) {
    if (p.markerOnly) {
      if (!pendingMarker) pendingMarker = { start: p.start, end: p.end };
      else pendingMarker.end = p.end;
      continue;
    }
    const prev = groups[groups.length - 1];
    // An explicit discourse marker proves the piece opens a new statement;
    // a dangling or subordinate previous clause still absorbs it.
    const explicitlyIndependent = p.altStart !== null || pendingMarker !== null;
    const merge =
      prev !== undefined &&
      (prev.subordinatorPending ||
        endsWithDanglingHead(prev.text) ||
        (!explicitlyIndependent &&
          (startsWithDependentHead(p.head) ||
            isShortTrailingPiece(p.head) ||
            (p.boundaryBefore === "." && /^[a-z]/.test(p.head)))));
    if (merge) {
      prev.end = p.end;
      prev.text = s.slice(Math.min(...prev.starts), p.end);
      prev.subordinatorPending = false;
    } else {
      const starts = [p.start];
      if (p.altStart !== null) starts.push(p.altStart);
      if (pendingMarker) starts.push(pendingMarker.start);
      groups.push({
        starts,
        end: p.end,
        text: p.head,
        subordinatorPending: startsWithSubordinator(p.head),
      });
    }
    pendingMarker = null;
  }
  if (groups.length === 0) return { ok: false, start: wholeStart, end: wholeEnd };
  if (pendingMarker) groups[groups.length - 1]!.end = pendingMarker.end;
  return {
    ok: true,
    units: groups.map((g) => ({ starts: [...new Set(g.starts)], end: g.end })),
  };
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
 * exact original cluster it came from. Same folding as
 * normalizeAnswerGroundingText, applied cluster by cluster.
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

function checkClauseRegion(
  s: string,
  structure: ClauseStructure,
  start: number,
  end: number,
): ClauseSpanResult {
  const [wa, wb] = trimWhitespace(s, start, end);
  const [ta, tb] = trimEdges(s, wa, wb);
  if (ta >= tb) return { ok: false, reason: "source_quote_not_clause_span" };
  const accepted: ClauseSpanResult = { ok: true, start: wa, end: wb, text: s.slice(wa, wb) };
  if (!structure.ok) {
    return ta === structure.start && tb === structure.end
      ? accepted
      : { ok: false, reason: "clause_boundary_undeterminable" };
  }
  const units = structure.units;
  for (let i = 0; i < units.length; i++) {
    if (!units[i]!.starts.includes(ta)) continue;
    for (let j = i; j < units.length; j++) {
      if (units[j]!.end === tb) return accepted;
    }
  }
  return { ok: false, reason: "source_quote_not_clause_span" };
}

/**
 * Resolve source_quote to complete clause(s) of the original statement.
 *
 * - Boundaries are computed on the original characters (sentence enders,
 *   semicolons, newlines, and commas only where the adjacent clauses are
 *   provably independent).
 * - Normalization only locates candidates; a match must start and end on
 *   original character clusters.
 * - Model offsets, when present, are a locating hint that must verify
 *   exactly; any mismatch rejects without falling back to search.
 * - Unbalanced brackets / quotes: only the whole statement may be quoted.
 */
export function resolveGroundedClauseSpan(
  sourceQuote: string,
  statement: string,
  offsets?: { source_start?: number | null; source_end?: number | null },
): ClauseSpanResult {
  const s = statement.trim();
  const quoteNorm = buildNormalizedMap(sourceQuote.trim()).text;
  if (!quoteNorm) return { ok: false, reason: "source_quote_empty" };
  const map = buildNormalizedMap(s);
  const structure = analyzeClauseStructure(s);

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
    return checkClauseRegion(s, structure, start, end);
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
    const region = checkClauseRegion(
      s,
      structure,
      map.clusters[startCluster]!.start,
      map.clusters[endCluster]!.end,
    );
    if (region.ok) return region;
    failure = region.reason;
  }
  return { ok: false, reason: failure ?? "source_quote_not_grounded" };
}

/**
 * Single grounding entry for every model-derived DC write and goal-change
 * target. item.text must be source-equivalent to source_quote, and
 * source_quote must resolve to complete clause(s) of the original statement.
 * On success, persist span.text (original user text), never a model paraphrase.
 */
export function groundExtractedItem(
  item: GroundableItem,
  statement: string,
): SourceQuoteGroundingResult {
  if (item.source_quote.length > MAX_SOURCE_QUOTE_LENGTH) {
    return { ok: false, reason: "source_quote_too_long" };
  }
  const normalizedQuote = normalizeAnswerGroundingText(item.source_quote);
  if (!normalizedQuote) return { ok: false, reason: "source_quote_empty" };
  const normalizedText = normalizeAnswerGroundingText(item.text);
  if (!normalizedText || normalizedText !== normalizedQuote) {
    return { ok: false, reason: "extraction_text_not_source_equivalent" };
  }
  const span = resolveGroundedClauseSpan(item.source_quote, statement, {
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

export function persistedSourceStatement(groundedText: string): string {
  return groundedText.slice(0, 2000);
}

/**
 * Closed introducer grammar for a goal-change clause ("(我)(想)(把)(决策目标)改成…").
 * Only when the grounded clause itself begins with this grammar is the
 * introducer dropped; any other wording keeps the whole grounded clause.
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
 * For goal_change only: the first definition_patch whose source_quote
 * resolves to complete clause(s) supplies the proposed target, derived from
 * the grounded original text. Never the whole statement by default and never
 * a phrase cut from inside a clause.
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
      if (target) proposed_decision_target = persistedSourceStatement(target);
    }
  }
  return { proposed_decision_target, rejections };
}


/**
 * Validate a complete authorization set. Fail closed on malformed, empty,
 * duplicate, or last-sent DIR-mismatched codes. Do not filter bad items
 * and continue with the remainder.
 */
function validateAuthorizedRoleCodes(
  codes: string[],
  lastSentDirIds: string[],
): { ok: true; codes: string[]; roles: string[] } | { ok: false } {
  if (codes.length === 0) return { ok: false };
  const seen = new Set<string>();
  const out: string[] = [];
  const roles: string[] = [];
  for (const code of codes) {
    const match = ROLE_CODE_RE.exec(code);
    if (!match) return { ok: false };
    const dirId = match[1]!;
    const role = match[2]!;
    if (!role) return { ok: false };
    if (!lastSentDirIds.includes(dirId)) return { ok: false };
    if (seen.has(code)) return { ok: false };
    seen.add(code);
    out.push(code);
    roles.push(role);
  }
  if (out.length === 0 || roles.length === 0) return { ok: false };
  return { ok: true, codes: out, roles };
}

/**
 * Current question is the ONLY answer-target authority.
 * last_sent_question is the sole authorization source.
 * Never use next_question_plan or adaptive_ask_plan as a substitute
 * when last_sent_question is missing. Never derive from Blueprint.required_fact_roles.
 */
export function activeTargets(session: POJUSessionState): {
  dir_ids: string[];
  ddr_ids: string[];
  direction_id?: string;
  fact_roles: string[];
  /** Full actually-sent Plan role codes; never expanded from Blueprint.required_fact_roles. */
  fact_role_codes: string[];
  auth_error?: "missing_authorized_fact_roles" | "missing_authorized_answer_target";
} {
  const understanding = session.decision_understanding;
  const lastSent = understanding?.last_sent_question;
  const missingRoles = {
    dir_ids: [] as string[],
    ddr_ids: [] as string[],
    fact_roles: [] as string[],
    fact_role_codes: [] as string[],
    auth_error: "missing_authorized_fact_roles" as const,
  };
  const missingTarget = {
    dir_ids: [] as string[],
    ddr_ids: [] as string[],
    fact_roles: [] as string[],
    fact_role_codes: [] as string[],
    auth_error: "missing_authorized_answer_target" as const,
  };

  if (lastSent && (lastSent.dir_ids.length > 0 || lastSent.ddr_ids.length > 0)) {
    let codes = lastSent.fact_role_codes ? [...lastSent.fact_role_codes] : [];
    if (codes.length === 0) {
      // Historical session: restore ONLY when next_question_plan.plan_id matches exactly.
      const nqp = understanding?.next_question_plan ?? null;
      if (
        nqp &&
        nqp.plan_id === lastSent.plan_id &&
        Array.isArray(nqp.fact_role_codes) &&
        nqp.fact_role_codes.length > 0
      ) {
        codes = [...nqp.fact_role_codes];
      }
    }
    const validated = validateAuthorizedRoleCodes(codes, lastSent.dir_ids);
    if (!validated.ok) return missingRoles;
    return {
      dir_ids: [...lastSent.dir_ids],
      ddr_ids: [...lastSent.ddr_ids],
      direction_id: lastSent.direction_id,
      fact_roles: validated.roles,
      fact_role_codes: validated.codes,
    };
  }

  return missingTarget;
}

export function classifyAnswer(input: {
  session: POJUSessionState;
  statement: string;
  target: ReturnType<typeof activeTargets>;
}): {
  cls: AnswerClass;
  notes: string[];
} {
  const t = input.statement.trim();
  const notes: string[] = [];

  // empty / invalid — keep CJK single-ack as invalid so they do not write DC
  if (!t || t.length < 2) return { cls: "invalid_input", notes: ["empty"] };

  // missing authorized target / roles — never guess DIR or expand roles
  if (input.target.auth_error === "missing_authorized_fact_roles") {
    return { cls: "invalid_input", notes: ["missing_authorized_fact_roles"] };
  }
  if (
    input.target.auth_error === "missing_authorized_answer_target" ||
    (input.target.dir_ids.length === 0 && input.target.ddr_ids.length === 0)
  ) {
    return { cls: "invalid_input", notes: ["missing_authorized_answer_target"] };
  }
  if (input.target.fact_roles.length === 0) {
    return { cls: "invalid_input", notes: ["missing_authorized_fact_roles"] };
  }

  // off_topic
  if (OFF_TOPIC_RE.test(t)) return { cls: "off_topic", notes: ["off_topic"] };

  // unknown (exact CJK tokens first; \b unreliable for CJK)
  if (
    t === "不知道" ||
    t === "不清楚" ||
    t === "不了解" ||
    t === "没印象" ||
    t === "不确定"
  ) {
    return { cls: "unknown", notes: ["user_unknown"] };
  }
  if (UNKNOWN_RE.test(t)) return { cls: "unknown", notes: ["user_unknown"] };

  // declined
  if (t === "不想说" || t === "不愿回答" || t === "不想回答" || t === "跳过") {
    return { cls: "declined", notes: ["user_declined"] };
  }
  if (DECLINED_RE.test(t)) return { cls: "declined", notes: ["user_declined"] };

  // explicit correction (before contradiction markers that may co-occur)
  if (CORRECTION_RE.test(t) && !CONTRADICTION_RE.test(t)) {
    return { cls: "correction", notes: ["correction"] };
  }

  // explicit contradiction
  if (CONTRADICTION_RE.test(t) || (CORRECTION_RE.test(t) && CONTRADICTION_RE.test(t))) {
    return { cls: "contradiction", notes: ["contradiction"] };
  }
  // "不是…而是" often contradiction with prior
  if (/不是.+而是/.test(t)) {
    return { cls: "contradiction", notes: ["contradiction_reframing"] };
  }

  // estimate / uncertain
  if (ESTIMATE_RE.test(t)) return { cls: "estimate", notes: ["estimate"] };

  // constraint language — clear_answer class; ProposedWrite becomes constraint
  if (CONSTRAINT_RE.test(t)) {
    notes.push("constraint_signal");
    return { cls: "clear_answer", notes };
  }

  // clear vs partial — content-based, not length-alone
  const hasConcrete =
    /\d/.test(t) ||
    /(方案|选项|公司|城市|家庭|责任|风险|期限|成本|收入|离职|留下)/.test(t);
  if (hasConcrete && t.length >= 6) {
    return { cls: "clear_answer", notes: ["clear"] };
  }
  if (t.length >= 4) {
    return { cls: "partial_answer", notes: ["partial"] };
  }
  // Too thin to be a fact write
  return { cls: "invalid_input", notes: ["too_thin"] };
}

/** Split one user turn into independent factual clauses (same source_turn_id). */
function splitIndependentFacts(statement: string): string[] {
  const cleaned = statement.trim();
  if (!cleaned) return [];
  // Soft split on clause separators / "另外/还有/以及"
  const parts = cleaned
    .split(/(?:[。；;！!？?\n]+|(?:另外|还有|以及|并且|同时)[,，\s]*)/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  if (parts.length >= 2) return parts;
  return [cleaned];
}

function stripMetaPrefix(text: string): string {
  return text
    .replace(
      /^(更正一下|更正|纠正|之前说错了|说错了|之前说的不准确|actually\s+i\s+meant)[:：,\s]*/i,
      "",
    )
    .trim();
}

export function writesFor(
  cls: AnswerClass,
  statement: string,
  targets: ReturnType<typeof activeTargets>,
  notes: string[],
): ProposedWrite[] {
  const roles =
    targets.fact_roles.length > 0 ? targets.fact_roles : [];
  const dirs = targets.dir_ids;

  if (cls === "off_topic" || cls === "invalid_input") return [];
  if (roles.length === 0) return [];

  if (cls === "unknown") {
    return [
      {
        kind: "reality_fact",
        statement: statement.slice(0, 500),
        status: "unknown",
        verification_level: "none",
        fact_roles: roles,
        related_dir_ids: dirs,
      },
    ];
  }
  if (cls === "declined") {
    return [
      {
        kind: "reality_fact",
        statement: statement.slice(0, 500),
        status: "declined",
        verification_level: "none",
        fact_roles: roles,
        related_dir_ids: dirs,
      },
    ];
  }

  const wantsConstraint =
    notes.includes("constraint_signal") || CONSTRAINT_RE.test(statement);

  if (wantsConstraint && cls !== "estimate") {
    const constraintRoles = roles.includes("hard_constraint")
      ? roles
      : [...roles, "hard_constraint"];
    return [
      {
        kind: "constraint",
        statement: statement.slice(0, 500),
        status: "unverified",
        verification_level: "user_asserted",
        fact_roles: constraintRoles,
        related_dir_ids: dirs,
        constraint_category: /预算|budget|钱|salary|cost|财务/i.test(statement)
          ? "financial"
          : /deadline|截止|时间|timing|最晚/i.test(statement)
            ? "time"
            : /不可逆|退出成本|exit/i.test(statement)
              ? "exit_cost"
              : "responsibility",
        rigidity: "hard",
      },
      // Companion fact so Intake role evidence can progress before E1 confirm.
      {
        kind: "reality_fact",
        statement: statement.slice(0, 500),
        status: "unverified",
        verification_level: "user_asserted",
        fact_roles: constraintRoles,
        related_dir_ids: dirs,
      },
    ];
  }

  if (cls === "estimate") {
    return [
      {
        kind: "reality_fact",
        statement: statement.slice(0, 500),
        status: "unverified",
        verification_level: "user_estimate",
        fact_roles: roles,
        related_dir_ids: dirs,
      },
    ];
  }

  // correction / contradiction / clear / partial — never confirmed without E1.
  // Multi-fact: one ProposedWrite per independent clause; same DIR/DDR/roles only.
  const clauses =
    cls === "correction" || cls === "contradiction"
      ? [stripMetaPrefix(statement) || statement]
      : splitIndependentFacts(statement);

  const uniqueClauses = Array.from(new Set(clauses.map((c) => c.slice(0, 500))));
  return uniqueClauses.map((clause) => ({
    kind: "reality_fact" as const,
    statement: clause,
    status: "unverified" as const,
    verification_level: "user_asserted" as const,
    fact_roles: roles,
    related_dir_ids: dirs,
  }));
}

/**
 * applyAnswerEventToSessionDc currently persists Constraint.verification_level
 * as hardcoded "user_asserted" and is intentionally not modified in FU1.
 * Therefore an estimated Constraint cannot be persisted without being
 * disguised as user_asserted; it must stay unresolved.
 */
function constraintEstimateIsPersistable(): boolean {
  return false;
}

/**
 * Convert a validated ModelAnswerDraft into a formal AnswerEvent.
 * Targets always come from activeTargets(); model fields never authorize
 * DIR/DDR/roles or confirmation. explanation is never written as a fact.
 * role_hint is ignored for authorization; only role_code_hint is used.
 */
export function answerEventFromModelDraft(input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  draft: ModelAnswerDraft;
}): AnswerEvent {
  const statement = input.statement.trim();
  const targets = activeTargets(input.session);
  const notes: string[] = [];
  const unresolved: string[] = [];
  const unresolvedItems: UnresolvedAnswerItem[] = [];
  const groundingRejections: SourceQuoteRejection[] = [];
  const authorizedRoleCodes = targets.fact_role_codes;
  const authorizedDirIds = [...targets.dir_ids];
  let cls: AnswerClass = input.draft.classification;
  const sentQuestionId =
    input.session.decision_understanding?.last_sent_question?.plan_id ?? "";

  const structuredAspects: UnresolvedModelAspect[] = input.draft.unresolved_aspects
    .map((aspectText, aspectIndex) => ({
      aspect_id: unresolvedAspectId(input.source_turn_id, aspectIndex),
      source_turn_id: input.source_turn_id,
      text: aspectText.slice(0, 200),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
    }))
    .filter((aspect) => aspect.text.trim().length > 0);

  const controlItems: IntakeControlItem[] = [];
  let goalChangeTarget: string | undefined;
  if (cls === "goal_change") {
    const extractedTarget = extractGroundedProposedDecisionTarget(input.draft, statement);
    groundingRejections.push(...extractedTarget.rejections);
    goalChangeTarget = extractedTarget.proposed_decision_target;
    for (const r of extractedTarget.rejections) {
      notes.push(`rejected_${r.reason}`);
    }
    if (!goalChangeTarget) {
      notes.push("goal_change_target_unresolved");
    }
    controlItems.push({
      item_id: intakeControlItemId(input.source_turn_id, "goal_change"),
      kind: "goal_change",
      source_turn_id: input.source_turn_id,
      text: statement.slice(0, 2000),
      ...(goalChangeTarget ? { proposed_decision_target: goalChangeTarget } : {}),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
      status: "pending",
    });
  } else if (cls === "insight_mismatch") {
    controlItems.push({
      item_id: intakeControlItemId(input.source_turn_id, "insight_mismatch"),
      kind: "insight_mismatch",
      source_turn_id: input.source_turn_id,
      text: statement.slice(0, 2000),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
      status: "pending",
    });
  } else {
    for (const aspect of structuredAspects) {
      controlItems.push({
        item_id: aspect.aspect_id,
        kind: "unresolved_aspect",
        source_turn_id: aspect.source_turn_id,
        text: aspect.text,
        sent_question_id: aspect.sent_question_id,
        authorized_role_codes: [...aspect.authorized_role_codes],
        authorized_dir_ids: [...aspect.authorized_dir_ids],
        status: "pending",
      });
    }
  }

  const pushUnresolvedItem = (item: {
    extracted_index: number;
    text: string;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    certainty: "explicit" | "estimated" | "unclear";
    role_code_hint?: string | null;
    reason: UnresolvedAnswerReason;
    note: string;
  }) => {
    unresolvedItems.push({
      item_id: unresolvedItemId(input.source_turn_id, item.extracted_index),
      source_turn_id: input.source_turn_id,
      text: item.text.slice(0, 500),
      semantic_kind: item.semantic_kind,
      certainty: item.certainty,
      reason: item.reason,
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      raw_role_code_hint: item.role_code_hint ?? null,
    });
    unresolved.push(item.note);
  };

  const eventShell = (writes: ProposedWrite[], classification: AnswerClass): AnswerEvent => ({
    event_id: `ae_${input.source_turn_id}`.slice(0, 80),
    session_id: input.session.session_id,
    client_turn_id: input.source_turn_id,
    raw_text: statement.slice(0, 2000),
    classification,
    targets: {
      dir_ids: [...targets.dir_ids],
      ddr_ids: [...targets.ddr_ids],
      direction_id: targets.direction_id,
    },
    proposed_writes: writes,
    notes: [
      ...notes,
      ...unresolved.map((u) => `unresolved:${u}`),
      ...groundingRejections.map(
        (r) =>
          `grounding_rejected:${r.reason}:${r.extracted_index}:${r.source_quote.slice(0, 80)}`,
      ),
    ].slice(0, 40),
    unresolved_items: unresolvedItems,
    unresolved_aspects: structuredAspects,
    grounding_rejections: groundingRejections,
    control_items: controlItems,
    interpreter: MODEL_ANSWER_INTERPRETER_VERSION,
  });

  if (targets.auth_error === "missing_authorized_fact_roles") {
    notes.push("missing_authorized_fact_roles");
    return eventShell([], "invalid_input");
  }
  if (
    targets.auth_error === "missing_authorized_answer_target" ||
    (targets.dir_ids.length === 0 && targets.ddr_ids.length === 0)
  ) {
    notes.push("missing_authorized_answer_target");
    return eventShell([], "invalid_input");
  }
  if (authorizedRoleCodes.length === 0 || targets.fact_roles.length === 0) {
    notes.push("missing_authorized_fact_roles");
    return eventShell([], "invalid_input");
  }

  if (cls === "off_topic" || cls === "invalid_input") {
    notes.push(`${cls}_no_dc_write`);
    return eventShell([], cls);
  }
  if (cls === "goal_change" || cls === "insight_mismatch") {
    // Never write DC from these control-plane classifications.
    // goal_change target extraction already recorded its rejections.
    if (cls === "insight_mismatch") {
      for (let extractedIndex = 0; extractedIndex < input.draft.extracted_items.length; extractedIndex++) {
        const item = input.draft.extracted_items[extractedIndex]!;
        const grounding = groundExtractedItem(item, statement);
        if (!grounding.ok) {
          groundingRejections.push(groundingRejection(extractedIndex, item, grounding.reason));
          notes.push(`rejected_${grounding.reason}`);
        }
      }
    }
    notes.push(`${cls}_no_dc_write`);
    return eventShell([], cls);
  }

  type AcceptedItem = {
    extracted_index: number;
    text: string;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    authorizedDirId: string;
    authorizedRole: string;
    bound_role_code: string;
    certainty: "explicit" | "estimated" | "unclear";
  };

  const acceptedItems: AcceptedItem[] = [];

  for (let extractedIndex = 0; extractedIndex < input.draft.extracted_items.length; extractedIndex++) {
    const item = input.draft.extracted_items[extractedIndex]!;
    const grounding = groundExtractedItem(item, statement);
    if (!grounding.ok) {
      groundingRejections.push(groundingRejection(extractedIndex, item, grounding.reason));
      notes.push(`rejected_${grounding.reason}`);
      // Do not create a ProposedWrite or assign user_asserted / user_estimate.
      continue;
    }
    const persistedText = persistedSourceStatement(grounding.span.text);
    // Production authorization uses role_code_hint only. Legacy role_hint is ignored.
    const code = item.role_code_hint ?? null;

    if (code && !authorizedRoleCodes.includes(code)) {
      pushUnresolvedItem({
        extracted_index: extractedIndex,
        text: persistedText,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: code,
        reason: "unauthorized_role_code",
        note: `unauthorized_role_code:${code}:${item.text.slice(0, 40)}`,
      });
      notes.push("rejected_unauthorized_role_code");
      continue;
    }

    if (!code && authorizedRoleCodes.length !== 1) {
      pushUnresolvedItem({
        extracted_index: extractedIndex,
        text: persistedText,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: code,
        reason: "unlocated_role_code",
        note: `unlocated_role_code:${item.text.slice(0, 100)}`,
      });
      notes.push("rejected_null_role_code_multi_auth");
      continue;
    }

    const acceptedCode = code ?? authorizedRoleCodes[0]!;
    const match = ROLE_CODE_RE.exec(acceptedCode);
    if (!match) {
      pushUnresolvedItem({
        extracted_index: extractedIndex,
        text: persistedText,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: acceptedCode,
        reason: "illegal_role_code",
        note: `illegal_role_code:${acceptedCode}:${item.text.slice(0, 40)}`,
      });
      notes.push("rejected_illegal_role_code");
      continue;
    }

    acceptedItems.push({
      extracted_index: extractedIndex,
      text: persistedText,
      semantic_kind: item.semantic_kind,
      authorizedDirId: match[1]!,
      authorizedRole: match[2]!,
      bound_role_code: acceptedCode,
      certainty: item.certainty,
    });
  }

  const writes: ProposedWrite[] = [];

  const constraintCategory = (text: string): ProposedWrite["constraint_category"] =>
    /预算|budget|钱|salary|cost|财务/i.test(text)
      ? "financial"
      : /deadline|截止|时间|timing|最晚/i.test(text)
        ? "time"
        : /不可逆|退出成本|exit/i.test(text)
          ? "exit_cost"
          : "responsibility";

  const pushConstraintAndCompanion = (
    text: string,
    authorizedDirId: string,
    authorizedRole: string,
    verification_level: "user_asserted" | "user_estimate",
  ) => {
    const fact_roles = [authorizedRole];
    const related_dir_ids = [authorizedDirId];
    writes.push({
      kind: "constraint",
      statement: text,
      status: "unverified",
      verification_level,
      fact_roles,
      related_dir_ids,
      constraint_category: constraintCategory(text),
      rigidity: "hard",
    });
    const alreadyCompanion = writes.some(
      (w) => w.kind === "reality_fact" && w.statement === text,
    );
    if (!alreadyCompanion) {
      writes.push({
        kind: "reality_fact",
        statement: text,
        status: "unverified",
        verification_level,
        fact_roles,
        related_dir_ids,
      });
    }
  };

  if (cls === "unknown" || cls === "declined") {
    // Existing unknown/declined DC state rules: status + verification_level none.
    // Role authorization still uses role_code_hint; null does not expand to all roles.
    for (const item of acceptedItems) {
      writes.push({
        kind: "reality_fact",
        statement: item.text,
        status: cls,
        verification_level: "none",
        fact_roles: [item.authorizedRole],
        related_dir_ids: [item.authorizedDirId],
      });
    }
    return eventShell(writes, cls);
  }

  for (const item of acceptedItems) {
    if (item.certainty === "unclear") {
      pushUnresolvedItem({
        extracted_index: item.extracted_index,
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: item.bound_role_code,
        reason: "unclear_certainty",
        note: `unclear_certainty:${item.text.slice(0, 100)}`,
      });
      continue;
    }

    const verification_level: "user_asserted" | "user_estimate" =
      item.certainty === "estimated" ? "user_estimate" : "user_asserted";

    if (item.semantic_kind === "constraint") {
      if (item.certainty === "estimated" && !constraintEstimateIsPersistable()) {
        pushUnresolvedItem({
          extracted_index: item.extracted_index,
          text: item.text,
          semantic_kind: item.semantic_kind,
          certainty: item.certainty,
          role_code_hint: item.bound_role_code,
          reason: "estimated_constraint_not_persistable",
          note: `estimated_constraint_not_persistable:${item.text.slice(0, 100)}`,
        });
        notes.push("estimated_constraint_unresolved");
        continue;
      }
      pushConstraintAndCompanion(
        item.text,
        item.authorizedDirId,
        item.authorizedRole,
        verification_level,
      );
      continue;
    }
    if (item.semantic_kind === "definition_patch") {
      // Current apply-answer-to-dc does not persist definition_patch.
      // Do not leave this only in notes / proposed_writes — keep it pending.
      pushUnresolvedItem({
        extracted_index: item.extracted_index,
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: item.bound_role_code,
        reason: "definition_patch_not_persistable",
        note: `definition_patch_not_persistable:${item.text.slice(0, 100)}`,
      });
      notes.push("definition_patch_not_mapped_by_apply");
      continue;
    }

    writes.push({
      kind: "reality_fact",
      statement: item.text,
      status: "unverified",
      verification_level,
      fact_roles: [item.authorizedRole],
      related_dir_ids: [item.authorizedDirId],
    });
  }

  return eventShell(writes, cls);
}

/**
 * Interpret one user turn into an AnswerEvent (proposes writes; does not mutate DC).
 */
export function interpretUserAnswer(input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now?: string;
}): AnswerEvent {
  const statement = input.statement.trim();
  const targets = activeTargets(input.session);
  const { cls, notes } = classifyAnswer({
    session: input.session,
    statement,
    target: targets,
  });
  const proposed_writes = writesFor(cls, statement, targets, notes);
  return {
    event_id: `ae_${input.source_turn_id}`.slice(0, 80),
    session_id: input.session.session_id,
    client_turn_id: input.source_turn_id,
    raw_text: statement.slice(0, 2000),
    classification: cls,
    targets: {
      dir_ids: targets.dir_ids,
      ddr_ids: targets.ddr_ids,
      direction_id: targets.direction_id,
    },
    proposed_writes,
    notes,
    unresolved_items: [],
    unresolved_aspects: [],
    grounding_rejections: [],
    control_items: [],
    interpreter: ANSWER_INTERPRETATION_VERSION,
  };
}
