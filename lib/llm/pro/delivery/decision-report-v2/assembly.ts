/**
 * Final report assembly gates for Face01 → Page02 refs and glossary inclusion.
 * Does not invent Page 02 content.
 */

import type { Face01V2 } from "./schemas";
import { assertPage02EvidenceTargetsExist } from "./evidence-registry";
import type { EvidenceRegistry } from "./types";
import {
  buildGlossaryAppendix,
  collectUsedTermIdsFromEvidence,
} from "./glossary-appendix";
import type { Face03Glossary } from "./schemas";
import { decisionReportV2InternalOrder } from "./reading-order";
import { includePage07InUserFacingOrder } from "./page07/report-inclusion";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";

export type Face01Page02AssemblyResult =
  | { status: "ok" }
  | { status: "deferred_page02"; pending_ids: string[] }
  | {
      status: "fail";
      reason: "orphan_page02_refs";
      missing_ids: string[];
    };

/**
 * Collect Page 01 pointers that must eventually resolve on Page 02.
 */
export function collectFace01Page02TargetIds(page: Face01V2): string[] {
  return [
    ...page.why_this_path.flatMap((w) => w.target_evidence_ids),
    ...page.applicability_boundary.page02_evidence_ids,
  ];
}

/**
 * Final assembly check for Face01 → Page02 references.
 *
 * - page02RealizedEvidenceIds === null → Page 02 not produced yet → deferred
 * - otherwise every target id must be in the realized set (or still in registry
 *   only when explicitly allowed as planned — default: realized set only)
 */
export function assembleFace01Page02References(input: {
  page01: Face01V2;
  /** null = page 02 not generated yet */
  page02RealizedEvidenceIds: ReadonlySet<string> | null;
  registry?: EvidenceRegistry;
}): Face01Page02AssemblyResult {
  const targets = [...new Set(collectFace01Page02TargetIds(input.page01))];
  if (!targets.length) return { status: "ok" };

  if (input.page02RealizedEvidenceIds === null) {
    return { status: "deferred_page02", pending_ids: targets };
  }

  const missing = targets.filter(
    (id) => !input.page02RealizedEvidenceIds!.has(id),
  );
  if (missing.length) {
    return {
      status: "fail",
      reason: "orphan_page02_refs",
      missing_ids: missing,
    };
  }
  return { status: "ok" };
}

/**
 * Registry-level check used during Face01 generate (planned ids must exist).
 */
export function assertFace01TargetsInRegistry(
  page: Face01V2,
  registry: EvidenceRegistry,
): string[] {
  const ids = collectFace01Page02TargetIds(page);
  return assertPage02EvidenceTargetsExist(registry, ids).map((e) => e.detail);
}

export type GlossaryAssemblyResult =
  | { include: false; page: null; term_ids: [] }
  | { include: true; page: Face03Glossary; term_ids: string[] };

/**
 * Glossary appendix only when evidence layer actually used term_ids.
 * Never from allowlist / full glossary / model plans.
 */
export function assembleGlossaryAppendixFromEvidence(input: {
  locale: string;
  evidenceTermIdLists: readonly (readonly string[])[];
}): GlossaryAssemblyResult {
  const term_ids = collectUsedTermIdsFromEvidence(input.evidenceTermIdLists);
  if (!term_ids.length) {
    return { include: false, page: null, term_ids: [] };
  }
  const page = buildGlossaryAppendix({
    locale: input.locale,
    usedTermIds: term_ids,
  });
  if (!page) {
    return { include: false, page: null, term_ids: [] };
  }
  return { include: true, page, term_ids };
}

/** Reading order driven by realized glossary inclusion (default: no empty appendix). */
export function readingOrderAfterAssembly(input: {
  includePage07?: boolean;
  /** When provided, overrides includePage07 via Face07 applicability (not_applicable → omit). */
  page07Schema?: unknown | null;
  glossary: GlossaryAssemblyResult;
}): DecisionPageId[] {
  const include07 =
    input.page07Schema !== undefined
      ? includePage07InUserFacingOrder(input.page07Schema)
      : input.includePage07 === true;
  return decisionReportV2InternalOrder({
    includePage07: include07,
    includeGlossaryAppendix: input.glossary.include,
  });
}
