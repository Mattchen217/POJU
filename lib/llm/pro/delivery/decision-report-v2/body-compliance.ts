/**
 * Fail-closed body / evidence compliance for Decision Report V2.
 *
 * Body: no traditional jargon, no SSOT soft labels, no term ids / slugs / markers.
 * Evidence: term_ids must exist in SSOT; no traditional jargon leakage.
 * Glossary appendix: only term ids that actually appeared in evidence.
 */

import {
  POJU_TERMS,
  glossOf,
  pojuTermBySlug,
  termOf,
  toTermLocale,
  type TermLocale,
} from "@/lib/glossary/pojulife-terms";
import type { DecisionReportLocale } from "./types";

export type BodyComplianceIssue = {
  code:
    | "body_traditional_jargon"
    | "body_soft_label"
    | "body_internal_marker"
    | "evidence_invalid_term_id"
    | "evidence_traditional_jargon"
    | "glossary_unseen_term"
    | "layer_cross_contamination";
  detail: string;
  path?: string;
};

export type BodyComplianceResult = {
  ok: boolean;
  issues: BodyComplianceIssue[];
};

const INTERNAL_MARKER_RE =
  /⟦t:|⟦w:|\?t:|⟦ns:|term_id\s*[:=]|namespace\s*[:=]|poju-page-schema|bazi:|qimen:|ziwei:/i;

/** Extra traditional / system names that must not appear in body (locale-agnostic stems). */
const TRADITIONAL_SYSTEM_NAMES = [
  "八字",
  "紫微",
  "斗数",
  "奇门",
  "十神",
  "用神",
  "喜神",
  "忌神",
  "日主",
  "大运",
  "流年",
  "流月",
  "合冲刑害",
  "命盘",
  "盘面",
  "神煞",
  "四化",
  "命宫",
  "本命",
  "bazi",
  "ziwei",
  "qimen",
  "natal chart",
  "day master",
  "shishen",
] as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectSoftLabels(locale: TermLocale): string[] {
  const out: string[] = [];
  for (const t of POJU_TERMS) {
    const label = (t.term[locale] || "").trim();
    if (!label) continue;
    // Latin soft labels: only multi-word / long coined forms.
    // Single common English words ("Core", "Venture") collide with vernacular.
    if (/^[a-zA-Z]/.test(label)) {
      if (!/\s|-/.test(label) && label.length < 12) continue;
    } else if (label.length < 2) {
      continue;
    }
    out.push(label);
  }
  // Longer first to avoid short false substrings where possible.
  return [...new Set(out)].sort((a, b) => b.length - a.length);
}

function collectTraditionalForms(): string[] {
  const out: string[] = [];
  for (const t of POJU_TERMS) {
    out.push(t.traditional);
    for (const a of t.aliases ?? []) {
      if (a.trim()) out.push(a.trim());
    }
  }
  for (const name of TRADITIONAL_SYSTEM_NAMES) out.push(name);
  return [...new Set(out.filter((x) => x.length >= 2))].sort(
    (a, b) => b.length - a.length,
  );
}

function findHit(text: string, needles: readonly string[]): string | null {
  const hay = text;
  for (const n of needles) {
    if (!n) continue;
    // Latin: word-ish boundary; CJK: plain includes.
    if (/^[a-zA-Z][a-zA-Z\s'-]*$/.test(n)) {
      const re = new RegExp(`(?:^|[^a-zA-Z])${escapeRegExp(n)}(?:$|[^a-zA-Z])`, "i");
      if (re.test(hay)) return n;
    } else if (hay.includes(n)) {
      return n;
    }
  }
  return null;
}

export function normalizeReportLocale(locale: string): DecisionReportLocale {
  const loc = toTermLocale(locale);
  if (loc === "zh" || loc === "en" || loc === "es" || loc === "fr" || loc === "de") {
    return loc;
  }
  return "en";
}

export function scanBodyTextCompliance(
  text: string,
  localeInput: string,
  path = "body",
): BodyComplianceIssue[] {
  const locale = normalizeReportLocale(localeInput);
  const issues: BodyComplianceIssue[] = [];
  const trimmed = text.trim();
  if (!trimmed) return issues;

  if (INTERNAL_MARKER_RE.test(trimmed)) {
    issues.push({
      code: "body_internal_marker",
      detail: `正文含内部标记/slug/namespace`,
      path,
    });
  }

  const traditionalHit = findHit(trimmed, collectTraditionalForms());
  if (traditionalHit) {
    issues.push({
      code: "body_traditional_jargon",
      detail: `正文命中专业命理词汇「${traditionalHit}」`,
      path,
    });
  }

  const softHit = findHit(trimmed, collectSoftLabels(locale));
  if (softHit) {
    issues.push({
      code: "body_soft_label",
      detail: `正文命中 SSOT 软译术语「${softHit}」`,
      path,
    });
  }

  return issues;
}

export function scanEvidenceTermIds(
  termIds: readonly string[],
  path = "evidence.term_ids",
): BodyComplianceIssue[] {
  const issues: BodyComplianceIssue[] = [];
  for (const id of termIds) {
    const term = pojuTermBySlug(id);
    if (!term) {
      issues.push({
        code: "evidence_invalid_term_id",
        detail: `依据层 term_id「${id}」不在 SSOT`,
        path,
      });
    }
  }
  return issues;
}

export function scanEvidenceExplanationCompliance(
  explanation: string,
  path = "evidence.explanation",
): BodyComplianceIssue[] {
  const issues: BodyComplianceIssue[] = [];
  const traditionalHit = findHit(explanation, collectTraditionalForms());
  if (traditionalHit) {
    issues.push({
      code: "evidence_traditional_jargon",
      detail: `依据层泄漏原始专业词汇「${traditionalHit}」`,
      path,
    });
  }
  return issues;
}

export function scanGlossaryAppendixCompliance(
  appendixTermIds: readonly string[],
  usedTermIds: ReadonlySet<string>,
): BodyComplianceIssue[] {
  const issues: BodyComplianceIssue[] = [];
  for (const id of appendixTermIds) {
    if (!usedTermIds.has(id)) {
      issues.push({
        code: "glossary_unseen_term",
        detail: `术语附录含未在依据层出现的 term_id「${id}」`,
        path: "glossary.term_ids",
      });
    }
    if (!pojuTermBySlug(id)) {
      issues.push({
        code: "evidence_invalid_term_id",
        detail: `术语附录 term_id「${id}」不在 SSOT`,
        path: "glossary.term_ids",
      });
    }
  }
  return issues;
}

export function resolveTermForLocale(
  termId: string,
  localeInput: string,
): { soft_label: string; definition: string } | null {
  const locale = normalizeReportLocale(localeInput);
  const soft = termOf(termId, locale);
  const def = glossOf(termId, locale);
  if (!soft || !def) return null;
  return { soft_label: soft, definition: def };
}

/**
 * Validate Face01 body-visible fields (no soft labels / jargon / markers).
 */
export function validateFace01BodyCompliance(
  page: {
    core_judgment?: { text?: string };
    why_this_path?: Array<{ text?: string }>;
    recommendation_conditions?: Array<{ condition?: string }>;
    not_recommended?: Array<{
      option?: string;
      reason?: string;
      cost_or_conflict?: string;
    }>;
    applicability_boundary?: {
      current_basis?: string[];
      invalidation_conditions?: string[];
    };
    page_title?: string;
    page_subtitle?: string;
  },
  localeInput: string,
): BodyComplianceResult {
  const issues: BodyComplianceIssue[] = [];
  const check = (text: string | undefined, path: string) => {
    if (!text) return;
    issues.push(...scanBodyTextCompliance(text, localeInput, path));
  };

  check(page.page_title, "page_title");
  check(page.page_subtitle, "page_subtitle");
  check(page.core_judgment?.text, "core_judgment.text");
  page.why_this_path?.forEach((row, i) => check(row.text, `why_this_path[${i}].text`));
  page.recommendation_conditions?.forEach((row, i) =>
    check(row.condition, `recommendation_conditions[${i}].condition`),
  );
  page.not_recommended?.forEach((row, i) => {
    check(row.option, `not_recommended[${i}].option`);
    check(row.reason, `not_recommended[${i}].reason`);
    check(row.cost_or_conflict, `not_recommended[${i}].cost_or_conflict`);
  });
  page.applicability_boundary?.current_basis?.forEach((t, i) =>
    check(t, `applicability_boundary.current_basis[${i}]`),
  );
  page.applicability_boundary?.invalidation_conditions?.forEach((t, i) =>
    check(t, `applicability_boundary.invalidation_conditions[${i}]`),
  );

  return { ok: issues.length === 0, issues };
}
