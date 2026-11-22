/**
 * Face01 validation — schema + evidence refs + body compliance.
 * Fail-closed: do not strip and display.
 */

import { Face01V2Schema, type Face01V2 } from "../schemas";
import {
  validateFace01BodyCompliance,
  type BodyComplianceIssue,
} from "../body-compliance";
import {
  assertClaimIdsExist,
  assertEvidenceIdsExist,
  assertPage02EvidenceTargetsExist,
  type EvidenceRegistryError,
} from "../evidence-registry";
import type { EvidenceRegistry } from "../types";

export type Face01Issue =
  | BodyComplianceIssue
  | EvidenceRegistryError
  | { code: string; detail: string };

export type Face01ValidationResult =
  | { ok: true; page: Face01V2 }
  | { ok: false; issues: Face01Issue[] };

const INVENTED_NUMBER_RE =
  /\b(?:\d{1,3}\s*%|\d+\s*分|成功率|胜率|probability\s*(?:of|=)\s*\d)/i;

export function validateFace01Output(input: {
  raw: unknown;
  locale: string;
  registry: EvidenceRegistry;
  /**
   * When page 02 evidence is not yet assembled, set false to defer orphan checks
   * to final report assembly.
   */
  requirePage02Targets?: boolean;
  /** Known DC fact ids allowed as condition source_ids. */
  knownFactIds?: ReadonlySet<string>;
}): Face01ValidationResult {
  const parsed = Face01V2Schema.safeParse(input.raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: [
        {
          code: "gate_face_zod_fail",
          detail: parsed.error.issues
            .slice(0, 8)
            .map((i) => `${i.path.join(".")}:${i.message}`)
            .join("; "),
        },
      ],
    };
  }
  const page = parsed.data;
  const issues: Face01Issue[] = [];

  const body = validateFace01BodyCompliance(page, input.locale);
  issues.push(...body.issues);

  const bodyBlob = [
    page.core_judgment.text,
    ...page.why_this_path.map((w) => w.text),
    ...page.not_recommended.map(
      (n) => `${n.option} ${n.reason} ${n.cost_or_conflict}`,
    ),
    ...page.applicability_boundary.current_basis,
    ...page.applicability_boundary.invalidation_conditions,
  ].join("\n");
  if (INVENTED_NUMBER_RE.test(bodyBlob)) {
    issues.push({
      code: "invented_metric",
      detail: "正文疑似虚构概率/评分/量化阈值",
    });
  }

  const sentenceCount = coreJudgmentSentenceCount(page.core_judgment.text);
  if (sentenceCount < 1 || sentenceCount > 3) {
    issues.push({
      code: "core_judgment_length",
      detail: `核心判断应为 1–3 句，当前约 ${sentenceCount} 句`,
    });
  }

  issues.push(
    ...assertClaimIdsExist(input.registry, page.core_judgment.claim_ids),
  );
  for (const reason of page.why_this_path) {
    issues.push(...assertClaimIdsExist(input.registry, reason.claim_ids));
    issues.push(...assertEvidenceIdsExist(input.registry, reason.evidence_ids));
    if (input.requirePage02Targets !== false) {
      issues.push(
        ...assertPage02EvidenceTargetsExist(
          input.registry,
          reason.target_evidence_ids,
        ),
      );
    }
  }
  for (const row of page.not_recommended) {
    issues.push(...assertClaimIdsExist(input.registry, row.claim_ids));
    issues.push(...assertEvidenceIdsExist(input.registry, row.evidence_ids));
  }
  if (input.requirePage02Targets !== false) {
    issues.push(
      ...assertPage02EvidenceTargetsExist(
        input.registry,
        page.applicability_boundary.page02_evidence_ids,
      ),
    );
  }

  const knownSource = new Set<string>([
    ...Object.keys(input.registry.claims),
    ...Object.keys(input.registry.evidence),
    ...(input.knownFactIds ?? []),
  ]);
  for (const [i, cond] of page.recommendation_conditions.entries()) {
    for (const sid of cond.source_ids) {
      if (!knownSource.has(sid)) {
        issues.push({
          code: "missing_evidence_id",
          detail: `recommendation_conditions[${i}] source_id「${sid}」无法追溯`,
        });
      }
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, page };
}

/** Sentence count heuristic for core_judgment (1–3). */
export function coreJudgmentSentenceCount(text: string): number {
  const marks = text.match(/[。！？.!?]/g);
  if (marks && marks.length > 0) return marks.length;
  const parts = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return Math.max(1, parts.length);
}

/**
 * Final assembly check: all Face01 page02 pointers must resolve.
 */
export function assembleValidateFace01Page02Links(
  page: Face01V2,
  registry: EvidenceRegistry,
): Face01Issue[] {
  const ids = [
    ...page.why_this_path.flatMap((w) => w.target_evidence_ids),
    ...page.applicability_boundary.page02_evidence_ids,
  ];
  return assertPage02EvidenceTargetsExist(registry, ids);
}
