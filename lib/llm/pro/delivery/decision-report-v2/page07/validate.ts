/**
 * Face07 validation — schema + applicability + participants + refs + page boundary.
 * Fail-closed. No legacy_ bypass for new generation.
 */

import { Face07V2Schema, type Face07V2 } from "../schemas";
import { normalizePage07ReadingOrder } from "./architecture/sections";
import {
  assertFace07PathIntegrity,
  CANONICAL_SELF_PARTICIPANT_ID,
  isSelfParticipantId,
  type Face07UpstreamRefs,
} from "./path-integrity";
import type { EvidenceRegistry } from "../types";

export type Face07Issue = {
  code: string;
  detail: string;
  path?: string;
};

export type Face07ValidationResult =
  | { ok: true; page: Face07V2 }
  | { ok: false; issues: Face07Issue[] };

const SCORE_OR_PROBABILITY =
  /\b\d{1,3}\s*分\b|\b\d{1,3}\s*%\b|success\s*rate|成功概率|胜率|评分\s*\d|合婚\s*\d/i;

const CONFIRMED_PROSE =
  /已确认|确认为|confirmed\s+fact|is\s+confirmed|definitely\s+true|already\s+confirmed/i;

/** Auxiliary multilingual ban — not a substitute for participant provenance. */
const THIRD_PARTY_PERSONALITY =
  /性格|人格|命盘|对方天生|personality|character\s+traits?|innate\s+nature|their\s+true\s+nature|natal\s+chart|partner'?s?\s+personality/i;

const NON_CONFIRMED_FACT_STATUSES = new Set([
  "unknown",
  "unverified",
  "declined",
  "not_applicable",
  "conflict",
  "user_estimate",
  "user_asserted",
  "hypothesis",
]);

export function validateFace07Output(input: {
  raw: unknown;
  locale: string;
  registry: EvidenceRegistry;
  knownFactIds?: ReadonlySet<string>;
  factStatusById?: ReadonlyMap<string, string>;
  factContentById?: ReadonlyMap<string, string>;
  upstream: Face07UpstreamRefs;
  knownDirIds?: ReadonlySet<string>;
  knownPersonalInterpretationUnitRefs?: ReadonlySet<string>;
  /** True only when an authorized partner profile was supplied by the program. */
  authorizedPartnerProfile?: boolean;
  reject_legacy_ids?: boolean;
}): Face07ValidationResult {
  const rejectLegacy = input.reject_legacy_ids !== false;
  const issues: Face07Issue[] = [];
  const patched =
    input.raw && typeof input.raw === "object"
      ? {
          ...(input.raw as Record<string, unknown>),
          reading_order: normalizePage07ReadingOrder(
            (input.raw as { reading_order?: readonly string[] }).reading_order,
          ),
        }
      : input.raw;
  const parsed = Face07V2Schema.safeParse(patched);
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
  for (const msg of assertFace07PathIntegrity(page, input.upstream)) {
    issues.push({ code: "path_integrity", detail: msg });
  }

  if (
    page.authorized_partner_profile === true &&
    input.authorizedPartnerProfile !== true
  ) {
    issues.push({
      code: "unauthorized_partner_profile_flag",
      detail:
        "authorized_partner_profile was set without an authorized partner profile in the payload",
      path: "authorized_partner_profile",
    });
  }
  const partnerAuthorized = input.authorizedPartnerProfile === true;

  const claimSet = new Set(Object.keys(input.registry.claims));
  const evidenceSet = new Set(Object.keys(input.registry.evidence));
  const participantById = new Map(
    page.participants.map((p) => [p.participant_id, p] as const),
  );

  const checkClaim = (cid: string, path: string) => {
    if (!cid) return;
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

  /**
   * Reality-fact cite check: ID must exist in DC, and non-confirmed facts
   * must not be upgraded to confirmed prose via the citing unit text.
   */
  const checkRealityFactCite = (
    fid: string,
    path: string,
    citingText?: string,
  ) => {
    if (input.knownFactIds && !input.knownFactIds.has(fid)) {
      issues.push({
        code: "unknown_fact_id",
        detail: `${path} cites unknown fact_id=${fid}`,
        path,
      });
      return;
    }
    const status = input.factStatusById?.get(fid);
    if (!status) return;
    if (status === "confirmed") return;
    if (
      citingText &&
      (NON_CONFIRMED_FACT_STATUSES.has(status) || status !== "confirmed") &&
      CONFIRMED_PROSE.test(citingText)
    ) {
      issues.push({
        code: "fact_status_upgrade",
        detail: `${path} treats fact ${fid} (${status}) as confirmed`,
        path,
      });
    }
  };

  const checkConfirmedFactId = (fid: string, path: string) => {
    if (input.knownFactIds && !input.knownFactIds.has(fid)) {
      issues.push({
        code: "unknown_confirmed_fact_id",
        detail: `${path} cites unknown fact_id=${fid}`,
        path,
      });
      return;
    }
    const status = input.factStatusById?.get(fid);
    if (status !== "confirmed") {
      issues.push({
        code: "confirmed_fact_status_mismatch",
        detail: `${path} includes ${fid} with status=${status ?? "missing"} (must be confirmed)`,
        path,
      });
    }
  };

  const checkDir = (dirId: string, path: string) => {
    if (input.knownDirIds && !input.knownDirIds.has(dirId)) {
      issues.push({
        code: "unknown_dir_id",
        detail: `${path} cites unknown dir_id=${dirId}`,
        path,
      });
    }
  };

  const scanScore = (label: string, text: string) => {
    if (SCORE_OR_PROBABILITY.test(text)) {
      issues.push({
        code: "invented_score_or_probability",
        detail: `${label} contains unsourced score/probability language`,
        path: label,
      });
    }
    if (!partnerAuthorized && THIRD_PARTY_PERSONALITY.test(text)) {
      issues.push({
        code: "third_party_personality_without_profile",
        detail: `${label} uses third-party personality language without an authorized partner profile`,
        path: label,
      });
    }
  };

  for (const participant of page.participants) {
    const pid = participant.participant_id;
    const isSelf = isSelfParticipantId(pid);
    const roleClaimsSelf = participant.role.trim().toLowerCase() === "self";

    // role:"self" cannot launder a non-canonical participant_id.
    if (!isSelf && roleClaimsSelf) {
      issues.push({
        code: "forged_self_participant",
        detail: `${pid} claims role=self but participant_id is not canonical ${CANONICAL_SELF_PARTICIPANT_ID}`,
        path: pid,
      });
    }
    if (isSelf && !roleClaimsSelf) {
      issues.push({
        code: "canonical_self_role_mismatch",
        detail: `${CANONICAL_SELF_PARTICIPANT_ID} must use role=self`,
        path: pid,
      });
    }

    const relatedFacts = participant.related_fact_ids ?? [];
    for (const fid of relatedFacts) {
      // Participants may cite non-confirmed facts for identity grounding, but
      // must not upgrade them via confirmed_fact_ids (checked separately).
      checkRealityFactCite(fid, `${pid}.related_fact_ids`);
    }

    if (!isSelf) {
      // Non-self must bind ≥1 real DC fact — model-only source/status is not provenance.
      if (relatedFacts.length < 1) {
        issues.push({
          code: "third_party_missing_fact_binding",
          detail: `${pid} (non-self) must bind at least one real DC fact_id`,
          path: pid,
        });
      } else {
        const blob = relatedFacts
          .map((id) => input.factContentById?.get(id) ?? "")
          .join(" ");
        const label = participant.display_label.trim();
        if (!label || !blob.toLowerCase().includes(label.toLowerCase())) {
          issues.push({
            code: "invented_third_party",
            detail: `${pid} display_label is not present in a cited fact statement`,
            path: pid,
          });
        }
        // Role label (partner/spouse/boss/…) should also be grounded when non-generic.
        const role = participant.role.trim().toLowerCase();
        if (
          role &&
          role !== "other" &&
          role !== "party" &&
          role !== "third_party" &&
          !blob.toLowerCase().includes(role) &&
          // Allow common English role synonyms when statement uses a related noun.
          !(
            (role === "partner" && /partner|partnership|co-?signer/i.test(blob)) ||
            (role === "spouse" && /spouse|husband|wife|married/i.test(blob)) ||
            (role === "boss" && /boss|manager|supervisor|employer/i.test(blob))
          )
        ) {
          // Soft: only flag when role is a concrete identity claim with no support.
          // Keep as invented_third_party_role so tests can assert.
          if (!/partner|spouse|boss|colleague|family|advisor|investor/i.test(blob)) {
            issues.push({
              code: "third_party_role_ungrounded",
              detail: `${pid} role=${participant.role} is not supported by cited fact statements`,
              path: pid,
            });
          }
        }
      }

      // Model-filled source / verification_status alone never count as provenance.
      if (
        relatedFacts.length < 1 &&
        (participant.source.trim().length > 0 ||
          participant.verification_status === "user_stated" ||
          participant.verification_status === "confirmed")
      ) {
        issues.push({
          code: "forged_participant_provenance",
          detail: `${pid} relies on model-filled source/verification_status without real fact binding`,
          path: pid,
        });
      }
    }
  }

  const checkPersonalRefs = (
    refs: readonly string[],
    participantIds: readonly string[],
    path: string,
  ) => {
    if (input.knownPersonalInterpretationUnitRefs) {
      for (const ref of refs) {
        if (!input.knownPersonalInterpretationUnitRefs.has(ref)) {
          issues.push({
            code: "unknown_personal_interpretation_unit_ref",
            detail: `${path} cites non-personal_interpretation unit ref=${ref}`,
            path,
          });
        }
      }
    }
    const appliedToOther = participantIds.some((id) => !isSelfParticipantId(id));
    if (refs.length > 0 && appliedToOther) {
      issues.push({
        code: "personal_interpretation_applied_to_third_party",
        detail: `${path} cites a user personal_interpretation unit while naming a non-self participant`,
        path,
      });
    }
  };

  const scanParticipantProse = (
    participantIds: readonly string[],
    text: string,
    path: string,
  ) => {
    if (!CONFIRMED_PROSE.test(text)) return;
    for (const id of participantIds) {
      const participant = participantById.get(id);
      if (!participant) continue;
      if (participant.verification_status !== "confirmed") {
        issues.push({
          code: "unverified_participant_treated_as_confirmed",
          detail: `${path} treats participant ${id} (${participant.verification_status}) as confirmed`,
          path,
        });
      }
    }
  };

  const applicable = page.applicability_status === "applicable";

  for (const unit of page.field_units) {
    if (applicable && unit.claim_ids.length < 1) {
      issues.push({
        code: "unit_missing_claim_ids",
        detail: `${unit.unit_id} requires at least one claim_id`,
        path: unit.unit_id,
      });
    }
    for (const cid of unit.claim_ids) checkClaim(cid, unit.unit_id);
    for (const eid of unit.evidence_ids ?? []) checkEvidence(eid, unit.unit_id);
    for (const fid of unit.reality_fact_ids ?? []) {
      checkRealityFactCite(fid, unit.unit_id, unit.text);
    }
    for (const did of unit.dir_ids ?? []) checkDir(did, unit.unit_id);
    checkPersonalRefs(
      unit.supporting_personal_unit_refs ?? [],
      unit.participant_ids,
      unit.unit_id,
    );
    scanScore(unit.unit_id, unit.text);
    scanParticipantProse(unit.participant_ids, unit.text, unit.unit_id);
  }

  for (const unit of page.relationship_units) {
    if (applicable && unit.claim_ids.length < 1) {
      issues.push({
        code: "unit_missing_claim_ids",
        detail: `${unit.unit_id} requires at least one claim_id`,
        path: unit.unit_id,
      });
    }
    for (const cid of unit.claim_ids) checkClaim(cid, unit.unit_id);
    for (const eid of unit.evidence_ids ?? []) checkEvidence(eid, unit.unit_id);
    const unitText = `${unit.text} ${(unit.uncertainty_notes ?? []).join(" ")}`;
    for (const fid of unit.reality_fact_ids ?? []) {
      checkRealityFactCite(fid, unit.unit_id, unit.text);
    }
    checkPersonalRefs(
      unit.supporting_personal_unit_refs ?? [],
      unit.participant_ids,
      unit.unit_id,
    );
    scanScore(unit.unit_id, unitText);
    scanParticipantProse(
      unit.participant_ids,
      unit.text,
      unit.unit_id,
    );
  }

  const boundary = page.evidence_boundary;
  if (applicable && boundary.claim_ids.length < 1) {
    issues.push({
      code: "evidence_boundary_missing_claim_ids",
      detail: "applicable evidence_boundary.claim_ids must be non-empty",
      path: "evidence_boundary.claim_ids",
    });
  }
  if (applicable && (boundary.uncertainty_notes ?? []).length < 1) {
    issues.push({
      code: "evidence_boundary_missing_uncertainty",
      detail: "applicable evidence_boundary.uncertainty_notes must be non-empty",
      path: "evidence_boundary.uncertainty_notes",
    });
  }
  for (const cid of boundary.claim_ids) checkClaim(cid, "evidence_boundary.claim_ids");
  checkPersonalRefs(
    boundary.supporting_personal_unit_refs ?? [],
    [CANONICAL_SELF_PARTICIPANT_ID],
    "evidence_boundary",
  );
  for (const fid of boundary.confirmed_fact_ids) {
    checkConfirmedFactId(fid, "evidence_boundary.confirmed_fact_ids");
  }
  scanScore(
    "evidence_boundary",
    [
      ...(boundary.hypothesis_notes ?? []),
      ...(boundary.uncertainty_notes ?? []),
      ...(boundary.third_party_data_limits ?? []),
    ].join(" "),
  );

  const align = page.alignment_with_main;
  if (applicable) {
    if (!align.summary.trim()) {
      issues.push({
        code: "alignment_missing_summary",
        detail: "applicable alignment_with_main.summary is required",
        path: "alignment_with_main.summary",
      });
    }
    if (!align.effect_on_page06_execution.trim()) {
      issues.push({
        code: "alignment_missing_page06_effect",
        detail: "applicable alignment_with_main.effect_on_page06_execution is required",
        path: "alignment_with_main.effect_on_page06_execution",
      });
    }
    if (align.claim_ids.length < 1) {
      issues.push({
        code: "alignment_missing_claim_ids",
        detail: "applicable alignment_with_main.claim_ids must be non-empty",
        path: "alignment_with_main.claim_ids",
      });
    }
  } else if (
    align.changes_page01_recommendation ||
    align.changes_page05_path_order
  ) {
    issues.push({
      code: "skipped_page_claims_main_change",
      detail: `${page.applicability_status} must not change Page01 or Page05`,
      path: "alignment_with_main",
    });
  }
  for (const cid of align.claim_ids) checkClaim(cid, "alignment_with_main.claim_ids");
  for (const eid of align.evidence_ids ?? []) {
    checkEvidence(eid, "alignment_with_main.evidence_ids");
  }
  scanScore(
    "alignment_with_main",
    `${align.summary} ${align.effect_on_page06_execution}`,
  );

  if (!(page.applicability_reason ?? "").trim()) {
    issues.push({
      code: "missing_applicability_reason",
      detail: "applicability_reason is required",
      path: "applicability_reason",
    });
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, page };
}
