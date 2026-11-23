/**
 * Face05 validation — schema + path integrity + registry + fact status + cross-refs.
 * Fail-closed. No legacy_ bypass for new generation.
 */

import { Face05V2Schema, type Face05V2 } from "../schemas";
import { normalizePage05ReadingOrder } from "./architecture/sections";
import { assertFace05PathIdIntegrity } from "./path-units";
import type { EvidenceRegistry } from "../types";

export type Face05Issue = {
  code: string;
  detail: string;
  path?: string;
};

export type Face05ValidationResult =
  | { ok: true; page: Face05V2 }
  | { ok: false; issues: Face05Issue[] };

const SCORE_OR_PROBABILITY =
  /\b\d{1,3}\s*分\b|\b\d{1,3}\s*%\b|success\s*rate|成功概率|胜率|评分\s*\d/i;

const CONFIRMED_PROSE =
  /已确认|确认为|confirmed\s+fact|is\s+confirmed|definitely\s+true/i;

export function validateFace05Output(input: {
  raw: unknown;
  locale: string;
  registry: EvidenceRegistry;
  knownFactIds?: ReadonlySet<string>;
  factStatusById?: ReadonlyMap<string, string>;
  knownPage01Refs?: ReadonlySet<string>;
  knownPage02Refs?: ReadonlySet<string>;
  knownPage04Refs?: ReadonlySet<string>;
  reject_legacy_ids?: boolean;
}): Face05ValidationResult {
  const rejectLegacy = input.reject_legacy_ids !== false;
  const issues: Face05Issue[] = [];
  const patched =
    input.raw && typeof input.raw === "object"
      ? {
          ...(input.raw as Record<string, unknown>),
          reading_order: normalizePage05ReadingOrder(
            (input.raw as { reading_order?: readonly string[] }).reading_order,
          ),
        }
      : input.raw;
  const parsed = Face05V2Schema.safeParse(patched);
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
  for (const msg of assertFace05PathIdIntegrity(page)) {
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
  const checkRef = (
    code: string,
    ref: string,
    known: ReadonlySet<string> | undefined,
    path: string,
  ) => {
    if (!known) return;
    if (!known.has(ref)) {
      issues.push({
        code,
        detail: `${path} cites unknown ref=${ref}`,
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

  for (const unit of page.path_units) {
    for (const cid of unit.claim_ids) checkClaim(cid, unit.path_id);
    for (const eid of unit.evidence_ids ?? []) checkEvidence(eid, unit.path_id);
    for (const fid of unit.related_reality_fact_ids ?? []) {
      checkFact(
        fid,
        unit.path_id,
        [
          unit.description,
          unit.recommendation_reason,
          ...unit.prerequisites,
          ...unit.expected_benefits,
        ].join(" "),
      );
    }
    for (const r of unit.supporting_page01_refs ?? []) {
      checkRef("unknown_page01_ref", r, input.knownPage01Refs, unit.path_id);
    }
    for (const r of unit.supporting_page02_refs ?? []) {
      checkRef("unknown_page02_ref", r, input.knownPage02Refs, unit.path_id);
    }
    for (const r of unit.supporting_page04_refs ?? []) {
      checkRef("unknown_page04_ref", r, input.knownPage04Refs, unit.path_id);
    }
    scanText(unit.path_id, `${unit.description} ${unit.recommendation_reason}`);
  }

  for (const rule of page.switching_rules) {
    for (const cid of rule.claim_ids) checkClaim(cid, rule.rule_id);
    for (const eid of rule.evidence_ids ?? []) checkEvidence(eid, rule.rule_id);
    for (const fid of rule.related_reality_fact_ids ?? []) {
      checkFact(
        fid,
        rule.rule_id,
        `${rule.trigger_condition} ${rule.rationale}`,
      );
    }
    scanText(rule.rule_id, `${rule.trigger_condition} ${rule.rationale}`);
  }

  for (const row of page.path_comparison.rows) {
    scanText(
      `comparison:${row.path_id}`,
      `${row.benefit} ${row.cost} ${row.risk} ${row.resource_requirement}`,
    );
  }

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

  // Preferred vs alternative must not be identical titles/descriptions.
  const preferred = page.path_units.filter((u) =>
    page.preferred_path_ids.includes(u.path_id),
  );
  const alternatives = page.path_units.filter((u) =>
    page.alternative_path_ids.includes(u.path_id),
  );
  for (const p of preferred) {
    for (const a of alternatives) {
      if (
        p.title.trim() === a.title.trim() ||
        p.description.trim() === a.description.trim()
      ) {
        issues.push({
          code: "path_not_differentiated",
          detail: `alternative ${a.path_id} is not substantively different from preferred ${p.path_id}`,
        });
      }
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, page };
}
