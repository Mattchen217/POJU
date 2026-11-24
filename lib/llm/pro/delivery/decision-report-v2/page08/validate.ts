/**
 * Face08 validation — schema + unique ids + signal/trigger links +
 * path/action subsets + registry + fact status + score/date bans.
 * Fail-closed. No legacy_ bypass for new generation.
 */

import { Face08V2Schema, type Face08V2 } from "../schemas";
import { normalizePage08ReadingOrder } from "./architecture/sections";
import {
  assertFace08PathIntegrity,
  type Face08UpstreamRefs,
} from "./path-integrity";
import {
  issuesForCitedFactsInProse,
  issuesForConfirmedFactIds,
  issuesForUnverifiedFactIds,
  type Page08FactIssue,
} from "./fact-integrity";
import type { EvidenceRegistry } from "../types";

export type Face08Issue = {
  code: string;
  detail: string;
  path?: string;
};

export type Face08ValidationResult =
  | { ok: true; page: Face08V2 }
  | { ok: false; issues: Face08Issue[] };

export function validateFace08Output(input: {
  raw: unknown;
  locale: string;
  registry: EvidenceRegistry;
  knownFactIds?: ReadonlySet<string>;
  factStatusById?: ReadonlyMap<string, string>;
  upstream: Face08UpstreamRefs;
  dateCorpus?: string;
  reject_legacy_ids?: boolean;
}): Face08ValidationResult {
  const rejectLegacy = input.reject_legacy_ids !== false;
  const issues: Face08Issue[] = [];
  const patched =
    input.raw && typeof input.raw === "object"
      ? {
          ...(input.raw as Record<string, unknown>),
          reading_order: normalizePage08ReadingOrder(
            (input.raw as { reading_order?: readonly string[] }).reading_order,
          ),
        }
      : input.raw;
  const parsed = Face08V2Schema.safeParse(patched);
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
  for (const msg of assertFace08PathIntegrity(page, input.upstream)) {
    issues.push({ code: "path_integrity", detail: msg });
  }

  const claimSet = new Set(Object.keys(input.registry.claims));
  const evidenceSet = new Set(Object.keys(input.registry.evidence));
  const corpus = input.dateCorpus ?? "";

  const checkIdToken = (id: string, path: string, kind: "claim" | "evidence" | "other") => {
    if (rejectLegacy && id.startsWith("legacy_")) {
      issues.push({
        code: "legacy_id_forbidden",
        detail: `${path} cites legacy id=${id}`,
        path,
      });
      return;
    }
    if (kind === "claim" && !claimSet.has(id)) {
      issues.push({
        code: "unknown_claim_id",
        detail: `${path} cites unknown claim_id=${id}`,
        path,
      });
    }
    if (kind === "evidence" && !evidenceSet.has(id)) {
      issues.push({
        code: "unknown_evidence_id",
        detail: `${path} cites unknown evidence_id=${id}`,
        path,
      });
    }
  };

  const pushFact = (found: Page08FactIssue[]) => {
    for (const item of found) issues.push(item);
  };

  const scan = (path: string, text: string, factIds: readonly string[]) => {
    pushFact(
      issuesForCitedFactsInProse({
        path,
        text,
        factIds,
        factStatusById: input.factStatusById,
        knownFactIds: input.knownFactIds,
        dateCorpus: corpus,
      }),
    );
  };

  for (const risk of page.risks) {
    checkIdToken(risk.risk_id, risk.risk_id, "other");
    for (const cid of risk.claim_ids) checkIdToken(cid, risk.risk_id, "claim");
    for (const eid of risk.evidence_ids ?? []) {
      checkIdToken(eid, risk.risk_id, "evidence");
    }
    scan(
      risk.risk_id,
      `${risk.risk_title} ${risk.risk_description}`,
      risk.reality_fact_ids ?? [],
    );
  }

  for (const signal of page.observation_signals) {
    checkIdToken(signal.signal_id, signal.signal_id, "other");
    scan(
      signal.signal_id,
      [
        signal.signal_name,
        signal.what_to_observe,
        signal.observation_source,
        signal.observation_method,
        signal.observation_window,
      ].join(" "),
      signal.related_fact_ids ?? [],
    );
  }

  for (const trigger of page.triggers) {
    checkIdToken(trigger.trigger_id, trigger.trigger_id, "other");
    for (const eid of trigger.required_evidence_ids ?? []) {
      checkIdToken(eid, trigger.trigger_id, "evidence");
    }
    if (
      trigger.trigger_status === "defined" &&
      (trigger.required_evidence_ids ?? []).length < 1
    ) {
      issues.push({
        code: "trigger_evidence_missing",
        detail: `${trigger.trigger_id} trigger_status=defined requires required_evidence_ids`,
        path: trigger.trigger_id,
      });
    }
    scan(trigger.trigger_id, trigger.trigger_condition, []);
  }

  for (const item of page.reassessment_conditions) {
    checkIdToken(item.reassessment_id, item.reassessment_id, "other");
    for (const cid of item.related_claim_ids ?? []) {
      checkIdToken(cid, item.reassessment_id, "claim");
    }
    scan(
      item.reassessment_id,
      `${item.condition} ${item.change_type} ${item.expected_review_scope}`,
      item.related_fact_ids ?? [],
    );
  }

  const boundary = page.evidence_boundary;
  for (const cid of boundary.related_claim_ids) {
    checkIdToken(cid, "evidence_boundary", "claim");
  }
  for (const eid of boundary.related_evidence_ids ?? []) {
    checkIdToken(eid, "evidence_boundary", "evidence");
  }
  pushFact(
    issuesForConfirmedFactIds({
      ids: boundary.confirmed_fact_ids ?? [],
      path: "evidence_boundary",
      knownFactIds: input.knownFactIds,
      factStatusById: input.factStatusById,
    }),
  );
  pushFact(
    issuesForUnverifiedFactIds({
      ids: boundary.unverified_fact_ids ?? [],
      path: "evidence_boundary",
      knownFactIds: input.knownFactIds,
      factStatusById: input.factStatusById,
    }),
  );
  const confirmed = new Set(boundary.confirmed_fact_ids ?? []);
  for (const fid of boundary.unverified_fact_ids ?? []) {
    if (confirmed.has(fid)) {
      issues.push({
        code: "fact_status_conflict",
        detail: `evidence_boundary lists ${fid} as both confirmed and unverified`,
        path: "evidence_boundary",
      });
    }
  }
  scan(
    "evidence_boundary",
    [
      ...(boundary.unresolved_questions ?? []),
      ...(boundary.monitoring_limitations ?? []),
      ...(boundary.reassessment_limitations ?? []),
    ].join(" "),
    [],
  );

  if (issues.length) return { ok: false, issues };
  return { ok: true, page };
}
