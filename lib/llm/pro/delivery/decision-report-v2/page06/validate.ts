/**
 * Face06 validation — schema + path integrity + registry + fact status + personal refs.
 * Fail-closed. No legacy_ bypass for new generation.
 */

import { Face06V2Schema, type Face06V2 } from "../schemas";
import { normalizePage06ReadingOrder } from "./architecture/sections";
import {
  assertFace06PathIntegrity,
  type Face06Page05PathSets,
} from "./path-integrity";
import type { EvidenceRegistry } from "../types";

export type Face06Issue = {
  code: string;
  detail: string;
  path?: string;
};

export type Face06ValidationResult =
  | { ok: true; page: Face06V2 }
  | { ok: false; issues: Face06Issue[] };

const SCORE_OR_PROBABILITY =
  /\b\d{1,3}\s*分\b|\b\d{1,3}\s*%\b|success\s*rate|成功概率|胜率|评分\s*\d/i;

const CONFIRMED_PROSE =
  /已确认|确认为|confirmed\s+fact|is\s+confirmed|definitely\s+true/i;

export function validateFace06Output(input: {
  raw: unknown;
  locale: string;
  registry: EvidenceRegistry;
  knownFactIds?: ReadonlySet<string>;
  factStatusById?: ReadonlyMap<string, string>;
  page05Paths: Face06Page05PathSets;
  /** Only Face02 kind=personal_interpretation unit_ids. */
  knownPersonalInterpretationUnitRefs?: ReadonlySet<string>;
  reject_legacy_ids?: boolean;
}): Face06ValidationResult {
  const rejectLegacy = input.reject_legacy_ids !== false;
  const issues: Face06Issue[] = [];
  const patched =
    input.raw && typeof input.raw === "object"
      ? {
          ...(input.raw as Record<string, unknown>),
          reading_order: normalizePage06ReadingOrder(
            (input.raw as { reading_order?: readonly string[] }).reading_order,
          ),
        }
      : input.raw;
  const parsed = Face06V2Schema.safeParse(patched);
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
  for (const msg of assertFace06PathIntegrity(page, input.page05Paths)) {
    issues.push({ code: "path_integrity", detail: msg });
  }

  const claimSet = new Set(Object.keys(input.registry.claims));
  const evidenceSet = new Set(Object.keys(input.registry.evidence));

  const checkClaim = (cid: string, path: string) => {
    if (rejectLegacy && cid.startsWith("legacy_")) {
      issues.push({
        code: "legacy_id_forbidden",
        detail: `${path} cites legacy claim_id=${cid}`,
        path,
      });
      return;
    }
    if (!claimSet.has(cid)) {
      issues.push({
        code: "unknown_claim_id",
        detail: `${path} cites unknown claim_id=${cid}`,
        path,
      });
    }
  };
  const checkEvidence = (eid: string, path: string) => {
    if (rejectLegacy && eid.startsWith("legacy_")) {
      issues.push({
        code: "legacy_id_forbidden",
        detail: `${path} cites legacy evidence_id=${eid}`,
        path,
      });
      return;
    }
    if (!evidenceSet.has(eid)) {
      issues.push({
        code: "unknown_evidence_id",
        detail: `${path} cites unknown evidence_id=${eid}`,
        path,
      });
    }
  };
  const checkFact = (fid: string, path: string, text?: string) => {
    if (input.knownFactIds && !input.knownFactIds.has(fid)) {
      issues.push({
        code: "unknown_fact_id",
        detail: `${path} cites unknown fact_id=${fid}`,
        path,
      });
      return;
    }
    const status = input.factStatusById?.get(fid);
    if (status && status !== "confirmed" && text && CONFIRMED_PROSE.test(text)) {
      issues.push({
        code: "fact_status_upgrade",
        detail: `${path} treats fact ${fid} (${status}) as confirmed`,
        path,
      });
    }
  };

  const scanText = (label: string, text: string) => {
    if (SCORE_OR_PROBABILITY.test(text)) {
      issues.push({
        code: "invented_score_or_probability",
        detail: `${label} contains unsourced score/probability language`,
        path: label,
      });
    }
  };

  const step = page.first_step;
  for (const cid of step.claim_ids) checkClaim(cid, step.action_id);
  for (const eid of step.evidence_ids ?? []) checkEvidence(eid, step.action_id);
  for (const fid of step.reality_fact_ids ?? []) {
    checkFact(fid, step.action_id, `${step.what} ${step.why_now}`);
  }
  scanText(step.action_id, `${step.what} ${step.why_now} ${step.expected_observable_result}`);

  for (const action of page.execution_actions) {
    for (const cid of action.claim_ids) checkClaim(cid, action.action_id);
    for (const eid of action.evidence_ids ?? []) checkEvidence(eid, action.action_id);
    for (const fid of action.reality_fact_ids ?? []) {
      checkFact(fid, action.action_id, `${action.action} ${action.rationale}`);
    }
    scanText(action.action_id, `${action.action} ${action.rationale} ${action.observable_result}`);
  }

  for (const exp of page.validation_experiments) {
    for (const cid of exp.claim_ids) checkClaim(cid, exp.experiment_id);
    for (const eid of exp.evidence_ids ?? []) checkEvidence(eid, exp.experiment_id);
    for (const fid of exp.reality_fact_ids ?? []) {
      checkFact(fid, exp.experiment_id, `${exp.hypothesis} ${exp.success_criteria}`);
    }
    scanText(
      exp.experiment_id,
      `${exp.hypothesis} ${exp.action} ${exp.success_criteria} ${exp.if_fail}`,
    );
  }

  for (const adj of page.personal_execution_adjustments) {
    for (const cid of adj.claim_ids) checkClaim(cid, adj.adjustment_id);
    for (const eid of adj.evidence_ids ?? []) checkEvidence(eid, adj.adjustment_id);
    const personal = adj.supporting_personal_unit_refs ?? [];
    const facts = adj.supporting_reality_fact_ids ?? [];
    if (personal.length === 0 && facts.length === 0) {
      issues.push({
        code: "personal_adjustment_ungrounded",
        detail: `${adj.adjustment_id} must cite supporting_personal_unit_refs and/or supporting_reality_fact_ids`,
        path: adj.adjustment_id,
      });
    }
    if (input.knownPersonalInterpretationUnitRefs) {
      for (const ref of personal) {
        if (!input.knownPersonalInterpretationUnitRefs.has(ref)) {
          issues.push({
            code: "unknown_personal_interpretation_unit_ref",
            detail: `${adj.adjustment_id} cites non-personal_interpretation unit ref=${ref}`,
            path: adj.adjustment_id,
          });
        }
      }
    }
    for (const fid of facts) {
      checkFact(fid, adj.adjustment_id, adj.adjustment);
    }
    scanText(adj.adjustment_id, adj.adjustment);
  }

  scanText(
    "resource_boundaries",
    [
      page.resource_boundaries.time,
      page.resource_boundaries.money,
      page.resource_boundaries.people,
      page.resource_boundaries.energy,
    ].join(" "),
  );
  scanText("phase_rhythm", page.phase_rhythm.notes ?? "");

  const monitor = page.monitoring_contract;
  for (const cid of monitor.claim_ids) checkClaim(cid, "monitoring_contract");
  for (const eid of monitor.evidence_ids ?? []) {
    checkEvidence(eid, "monitoring_contract");
  }
  for (const fid of monitor.reality_fact_ids ?? []) {
    checkFact(
      fid,
      "monitoring_contract",
      [...monitor.observe_signals, ...monitor.stop_triggers].join(" "),
    );
  }
  scanText(
    "monitoring_contract",
    [...monitor.observe_signals, ...monitor.stop_triggers].join(" "),
  );

  for (const cid of page.evidence_boundary.claim_ids) {
    checkClaim(cid, "evidence_boundary.claim_ids");
  }
  for (const fid of page.evidence_boundary.confirmed_fact_ids) {
    if (input.knownFactIds && !input.knownFactIds.has(fid)) {
      issues.push({
        code: "unknown_confirmed_fact_id",
        detail: `evidence_boundary.confirmed_fact_ids cites unknown fact_id=${fid}`,
        path: "evidence_boundary.confirmed_fact_ids",
      });
      continue;
    }
    const status = input.factStatusById?.get(fid);
    if (status !== "confirmed") {
      issues.push({
        code: "confirmed_fact_status_mismatch",
        detail: `evidence_boundary.confirmed_fact_ids includes ${fid} with status=${status ?? "missing"}`,
        path: "evidence_boundary.confirmed_fact_ids",
      });
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, page };
}
