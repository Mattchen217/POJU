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
  AnswerSourceRecord,
  IntakeControlItem,
  ModelAnswerDraft,
  ProposedWrite,
  ProposedWriteProvenance,
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
 * applyAnswerEventToSessionDc persists Constraint.verification_level as
 * "user_asserted". An estimated Constraint therefore cannot be persisted
 * without being disguised as asserted; it stays pending.
 */
function constraintEstimateIsPersistable(): boolean {
  return false;
}

function constraintCategoryFor(text: string): ProposedWrite["constraint_category"] {
  return /预算|budget|钱|salary|cost|财务/i.test(text)
    ? "financial"
    : /deadline|截止|时间|timing|最晚/i.test(text)
      ? "time"
      : /不可逆|退出成本|exit/i.test(text)
        ? "exit_cost"
        : "responsibility";
}

/**
 * Earlier propositional facts (other turns) on the same DIR + role.
 * Used to link a correction to what it corrects; never deletes them.
 */
export function correctableFactIds(
  session: POJUSessionState,
  sourceTurnId: string,
  dirId: string,
  role: string,
): string[] {
  const facts = session.decision_context?.reality_facts ?? [];
  return facts
    .filter(
      (f) =>
        f.source_turn_id !== sourceTurnId &&
        (f.status === "unverified" || f.status === "confirmed") &&
        (f.related_dir_ids ?? []).includes(dirId) &&
        (f.fact_roles ?? []).includes(role),
    )
    .map((f) => f.fact_id);
}

export type CorrectablePriorAnswer = {
  role_code: string;
  fact_ids: string[];
  statement: string;
};

/**
 * Role codes the user already answered in an earlier turn under that turn's
 * own sent question. A correction may re-bind to these and nothing else: the
 * earlier question authorized the role, so correcting it is not new scope.
 */
export function correctablePriorAnswers(
  session: POJUSessionState,
  sourceTurnId: string,
): CorrectablePriorAnswer[] {
  const sources = new Map(
    (session.intake_answer_sources ?? []).map((r) => [r.source_turn_id, r] as const),
  );
  const out = new Map<string, CorrectablePriorAnswer>();
  for (const f of session.decision_context?.reality_facts ?? []) {
    if (f.source_turn_id === sourceTurnId) continue;
    if (f.status !== "unverified" && f.status !== "confirmed") continue;
    const record = f.source_turn_id ? sources.get(f.source_turn_id) : undefined;
    if (!record) continue;
    for (const dirId of f.related_dir_ids ?? []) {
      for (const role of f.fact_roles ?? []) {
        const code = `v1/dir/${dirId}/role/${role}`;
        if (!record.authorized_role_codes.includes(code)) continue;
        const entry = out.get(code) ?? { role_code: code, fact_ids: [], statement: "" };
        entry.fact_ids.push(f.fact_id);
        entry.statement = f.statement.slice(0, 300);
        out.set(code, entry);
      }
    }
  }
  return [...out.values()];
}

/**
 * Convert a validated ModelAnswerDraft into a formal AnswerEvent.
 *
 * Source authority: every persistable write carries the raw user statement
 * of source_turn_id verbatim. Model text is never the statement; an item is
 * persistable only when its source_quote is located in that raw statement
 * and its role code is authorized by the actually-sent question.
 * Targets always come from activeTargets(); model fields never authorize
 * DIR/DDR/roles or confirmation. explanation is never written as a fact.
 */
export function answerEventFromModelDraft(input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  draft: ModelAnswerDraft;
  source_record?: AnswerSourceRecord | null;
  model_call?: { provider: string | null; model: string | null } | null;
}): AnswerEvent {
  const statement = input.statement.trim();
  const statementTooLong = statement.length > FACT_STATEMENT_MAX_CHARS;
  const statementFitsFact = statement.length > 0 && !statementTooLong;
  const targets = activeTargets(input.session);
  const notes: string[] = [];
  const unresolved: string[] = [];
  const unresolvedItems: UnresolvedAnswerItem[] = [];
  const groundingRejections: SourceQuoteRejection[] = [];
  const authorizedRoleCodes = targets.fact_role_codes;
  const authorizedDirIds = [...targets.dir_ids];
  const authorizedDdrIds = [...targets.ddr_ids];
  let cls: AnswerClass = input.draft.classification;
  const sentQuestionId =
    input.session.decision_understanding?.last_sent_question?.plan_id ?? "";

  const aspectTexts = input.draft.unresolved_aspects
    .map((text) => text.slice(0, 200))
    .filter((text) => text.trim().length > 0);
  const persistableClass =
    cls !== "off_topic" &&
    cls !== "invalid_input" &&
    cls !== "goal_change" &&
    cls !== "insight_mismatch";
  const hasPersistableContent =
    input.draft.extracted_items.length > 0 || cls === "unknown" || cls === "declined";
  if (statementTooLong && persistableClass && hasPersistableContent) {
    aspectTexts.push(LONG_ANSWER_ASPECT_TEXT);
    notes.push("source_statement_exceeds_fact_limit");
  }
  const structuredAspects: UnresolvedModelAspect[] = aspectTexts.map((text, aspectIndex) => ({
    aspect_id: unresolvedAspectId(input.source_turn_id, aspectIndex),
    source_turn_id: input.source_turn_id,
    text,
    sent_question_id: sentQuestionId,
    authorized_role_codes: [...authorizedRoleCodes],
    authorized_dir_ids: [...authorizedDirIds],
  }));

  const controlItems: IntakeControlItem[] = [];
  if (cls === "goal_change") {
    const extractedTarget = extractGroundedProposedDecisionTarget(input.draft, statement);
    groundingRejections.push(...extractedTarget.rejections);
    const goalChangeTarget = extractedTarget.proposed_decision_target;
    for (const r of extractedTarget.rejections) notes.push(`rejected_${r.reason}`);
    if (!goalChangeTarget) notes.push("goal_change_target_unresolved");
    controlItems.push({
      item_id: intakeControlItemId(input.source_turn_id, "goal_change"),
      kind: "goal_change",
      source_turn_id: input.source_turn_id,
      text: statement.slice(0, 2000),
      ...(goalChangeTarget
        ? {
            proposed_decision_target: goalChangeTarget,
            target_source_turn_id: input.source_turn_id,
            target_source_statement: statement,
          }
        : {}),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
      status: "pending",
      source_statement: statement,
      attempts: 0,
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
      source_statement: statement,
      attempts: 0,
    });
  }
  // Unresolved aspects are never dropped, whatever the classification.
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
      source_statement: statement,
      attempts: 0,
    });
  }

  const pushUnresolvedItem = (item: {
    extracted_index: number;
    span: LocatedSourceSpan;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    certainty: "explicit" | "estimated" | "unclear";
    role_code_hint?: string | null;
    reason: UnresolvedAnswerReason;
    note: string;
  }) => {
    unresolvedItems.push({
      item_id: unresolvedItemId(input.source_turn_id, item.extracted_index),
      source_turn_id: input.source_turn_id,
      text: item.span.text.slice(0, 500),
      semantic_kind: item.semantic_kind,
      certainty: item.certainty,
      reason: item.reason,
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      raw_role_code_hint: item.role_code_hint ?? null,
      source_statement: statement,
      source_quote: item.span.text,
      located_start: item.span.start,
      located_end: item.span.end,
      authorized_dir_ids: [...authorizedDirIds],
      authorized_ddr_ids: [...authorizedDdrIds],
      status: "pending",
      attempts: 0,
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
    source_record: input.source_record ?? null,
    model_call: input.model_call ?? null,
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
    span: LocatedSourceSpan;
    item: ModelAnswerDraft["extracted_items"][number];
    authorizedDirId: string;
    authorizedRole: string;
    bound_role_code: string;
  };
  const acceptedItems: AcceptedItem[] = [];
  const priorCorrectionCodes =
    cls === "correction"
      ? correctablePriorAnswers(input.session, input.source_turn_id)
          .map((p) => p.role_code)
          .filter((c) => !authorizedRoleCodes.includes(c))
      : [];

  for (let extractedIndex = 0; extractedIndex < input.draft.extracted_items.length; extractedIndex++) {
    const item = input.draft.extracted_items[extractedIndex]!;
    const grounding = groundExtractedItem(item, statement);
    if (!grounding.ok) {
      groundingRejections.push(groundingRejection(extractedIndex, item, grounding.reason));
      notes.push(`rejected_${grounding.reason}`);
      continue;
    }
    if (!statementFitsFact) {
      groundingRejections.push(
        groundingRejection(extractedIndex, item, "source_statement_exceeds_fact_limit"),
      );
      continue;
    }
    const span = grounding.span;
    // Production authorization uses role_code_hint only. Legacy role_hint is ignored.
    const code = item.role_code_hint ?? null;
    if (code && priorCorrectionCodes.includes(code)) {
      notes.push(`correction_prior_role_code:${code}`.slice(0, 200));
    } else if (code && !authorizedRoleCodes.includes(code)) {
      pushUnresolvedItem({
        extracted_index: extractedIndex,
        span,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: code,
        reason: "unauthorized_role_code",
        note: `unauthorized_role_code:${code}:${span.text.slice(0, 40)}`,
      });
      notes.push("rejected_unauthorized_role_code");
      continue;
    }
    if (!code && authorizedRoleCodes.length !== 1) {
      pushUnresolvedItem({
        extracted_index: extractedIndex,
        span,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: code,
        reason: "unlocated_role_code",
        note: `unlocated_role_code:${span.text.slice(0, 100)}`,
      });
      notes.push("rejected_null_role_code_multi_auth");
      continue;
    }
    const acceptedCode = code ?? authorizedRoleCodes[0]!;
    const match = ROLE_CODE_RE.exec(acceptedCode);
    if (!match) {
      pushUnresolvedItem({
        extracted_index: extractedIndex,
        span,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: acceptedCode,
        reason: "illegal_role_code",
        note: `illegal_role_code:${acceptedCode}:${span.text.slice(0, 40)}`,
      });
      notes.push("rejected_illegal_role_code");
      continue;
    }
    acceptedItems.push({
      extracted_index: extractedIndex,
      span,
      item,
      authorizedDirId: match[1]!,
      authorizedRole: match[2]!,
      bound_role_code: acceptedCode,
    });
  }

  const provenanceOf = (accepted: AcceptedItem | null): ProposedWriteProvenance => ({
    source_turn_id: input.source_turn_id,
    statement_basis: "raw_user_statement",
    extracted_index: accepted?.extracted_index ?? null,
    extracted_text: accepted ? accepted.item.text.slice(0, 500) : null,
    source_quote: accepted ? accepted.span.text : null,
    located_start: accepted?.span.start ?? null,
    located_end: accepted?.span.end ?? null,
    model_source_start: accepted?.item.source_start ?? null,
    model_source_end: accepted?.item.source_end ?? null,
  });

  // One write per (kind, DIR, role): several quotes of the same answer that
  // bind to the same role are one fact whose statement is the raw answer.
  const writes: ProposedWrite[] = [];
  const upsertWrite = (write: ProposedWrite) => {
    const existing = writes.find(
      (w) =>
        w.kind === write.kind &&
        w.related_dir_ids[0] === write.related_dir_ids[0] &&
        w.fact_roles[0] === write.fact_roles[0],
    );
    if (!existing) {
      writes.push(write);
      return;
    }
    existing.provenance = [...(existing.provenance ?? []), ...(write.provenance ?? [])];
    if (write.verification_level === "user_estimate") existing.verification_level = "user_estimate";
  };

  if (cls === "unknown" || cls === "declined") {
    if (!statementFitsFact) return eventShell([], cls);
    if (input.draft.extracted_items.length === 0) {
      // The user answered the sent question as a whole with unknown / declined.
      for (const code of authorizedRoleCodes) {
        const match = ROLE_CODE_RE.exec(code);
        if (!match) continue;
        upsertWrite({
          kind: "reality_fact",
          statement,
          status: cls,
          verification_level: "none",
          fact_roles: [match[2]!],
          related_dir_ids: [match[1]!],
          provenance: [provenanceOf(null)],
        });
      }
      notes.push(`${cls}_applies_to_sent_question`);
      return eventShell(writes, cls);
    }
    for (const accepted of acceptedItems) {
      upsertWrite({
        kind: "reality_fact",
        statement,
        status: cls,
        verification_level: "none",
        fact_roles: [accepted.authorizedRole],
        related_dir_ids: [accepted.authorizedDirId],
        provenance: [provenanceOf(accepted)],
      });
    }
    return eventShell(writes, cls);
  }

  for (const accepted of acceptedItems) {
    const { item } = accepted;
    if (item.certainty === "unclear") {
      pushUnresolvedItem({
        extracted_index: accepted.extracted_index,
        span: accepted.span,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: accepted.bound_role_code,
        reason: "unclear_certainty",
        note: `unclear_certainty:${accepted.span.text.slice(0, 100)}`,
      });
      continue;
    }
    const verification_level: "user_asserted" | "user_estimate" =
      item.certainty === "estimated" || cls === "estimate" ? "user_estimate" : "user_asserted";
    const fact_roles = [accepted.authorizedRole];
    const related_dir_ids = [accepted.authorizedDirId];
    const provenance = [provenanceOf(accepted)];

    if (item.semantic_kind === "definition_patch") {
      pushUnresolvedItem({
        extracted_index: accepted.extracted_index,
        span: accepted.span,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: accepted.bound_role_code,
        reason: "definition_patch_not_persistable",
        note: `definition_patch_not_persistable:${accepted.span.text.slice(0, 100)}`,
      });
      notes.push("definition_patch_not_mapped_by_apply");
      continue;
    }
    if (item.semantic_kind === "constraint") {
      if (verification_level === "user_estimate" && !constraintEstimateIsPersistable()) {
        pushUnresolvedItem({
          extracted_index: accepted.extracted_index,
          span: accepted.span,
          semantic_kind: item.semantic_kind,
          certainty: "estimated",
          role_code_hint: accepted.bound_role_code,
          reason: "estimated_constraint_not_persistable",
          note: `estimated_constraint_not_persistable:${accepted.span.text.slice(0, 100)}`,
        });
        notes.push("estimated_constraint_unresolved");
        continue;
      }
      upsertWrite({
        kind: "constraint",
        statement,
        status: "unverified",
        verification_level,
        fact_roles,
        related_dir_ids,
        constraint_category: constraintCategoryFor(statement),
        rigidity: "hard",
        provenance,
      });
    }
    // Constraints also carry a companion fact so role evidence can progress.
    upsertWrite({
      kind: "reality_fact",
      statement,
      status: "unverified",
      verification_level,
      fact_roles,
      related_dir_ids,
      provenance,
    });
  }

  if (cls === "correction") {
    for (const write of writes) {
      if (write.kind !== "reality_fact") continue;
      const corrected = correctableFactIds(
        input.session,
        input.source_turn_id,
        write.related_dir_ids[0]!,
        write.fact_roles[0]!,
      );
      if (corrected.length > 0) {
        write.corrects_fact_ids = corrected;
        notes.push(`correction_links:${corrected.join(",")}`.slice(0, 200));
      }
    }
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
