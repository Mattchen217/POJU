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
import {
  allParticipantBehaviorSentencesSupported,
  isConfirmedDcStatus,
  maxParticipantVerificationForFact,
  nonConfirmedCitationTextOk,
  roleIsNeutral,
  roleSupportedByFactBlob,
  textHasAssertiveClaim,
  verificationIsWithinMax,
  weakestMaxVerification,
  type Page07ParticipantVerificationStatus,
  type Page07RealityCitationStance,
} from "./fact-integrity";
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

/** Auxiliary multilingual ban — not a substitute for participant provenance. */
const THIRD_PARTY_PERSONALITY =
  /性格|人格|命盘|对方天生|personality|character\s+traits?|innate\s+nature|their\s+true\s+nature|natal\s+chart|partner'?s?\s+personality/i;

export function validateFace07Output(input: {
  raw: unknown;
  locale: string;
  registry: EvidenceRegistry;
  knownFactIds?: ReadonlySet<string>;
  factStatusById?: ReadonlyMap<string, string>;
  factContentById?: ReadonlyMap<string, string>;
  /** DC verification_level by fact_id — used for participant verification caps. */
  factVerificationLevelById?: ReadonlyMap<string, string>;
  /** DC fact_roles by fact_id — used for behavior-evidence allowlist. */
  factRolesById?: ReadonlyMap<string, readonly string[]>;
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

  const resolveFactStatus = (fid: string): string | undefined =>
    input.factStatusById?.get(fid);

  /**
   * Structured reality-fact cite check (per fact, fail-closed on missing status).
   * reality_fact_ids ↔ reality_fact_stances must be strict 1:1 (no dupes / orphans).
   * Stance table is required; CONFIRMED keywords alone are not the gate.
   */
  const checkRealityFactCites = (
    factIds: readonly string[],
    stances: readonly { fact_id: string; stance: Page07RealityCitationStance }[],
    path: string,
    citingText: string,
  ) => {
    const seenFactIds = new Set<string>();
    for (const fid of factIds) {
      if (seenFactIds.has(fid)) {
        issues.push({
          code: "duplicate_reality_fact_id",
          detail: `${path} lists reality_fact_id=${fid} more than once`,
          path,
        });
      }
      seenFactIds.add(fid);
    }

    const seenStanceIds = new Set<string>();
    let hasDuplicateStance = false;
    for (const s of stances) {
      if (seenStanceIds.has(s.fact_id)) {
        hasDuplicateStance = true;
        issues.push({
          code: "duplicate_reality_fact_stance",
          detail: `${path} has duplicate reality_fact_stances entry for ${s.fact_id}`,
          path,
        });
      }
      seenStanceIds.add(s.fact_id);
      if (!factIds.includes(s.fact_id)) {
        issues.push({
          code: "orphan_reality_fact_stance",
          detail: `${path} has stance for ${s.fact_id} not in reality_fact_ids`,
          path,
        });
      }
    }

    // Do not let Map last-write-wins change validation when duplicates exist.
    if (hasDuplicateStance) {
      for (const fid of factIds) {
        if (!seenStanceIds.has(fid)) {
          issues.push({
            code: "missing_reality_fact_stance",
            detail: `${path} cites fact_id=${fid} without reality_fact_stances entry`,
            path,
          });
        }
      }
      return;
    }

    const stanceById = new Map(stances.map((s) => [s.fact_id, s.stance] as const));
    for (const fid of factIds) {
      if (input.knownFactIds && !input.knownFactIds.has(fid)) {
        issues.push({
          code: "unknown_fact_id",
          detail: `${path} cites unknown fact_id=${fid}`,
          path,
        });
        continue;
      }
      const status = resolveFactStatus(fid);
      if (!status) {
        issues.push({
          code: "fact_status_missing",
          detail: `${path} cites fact_id=${fid} with no DC status (fail-closed)`,
          path,
        });
        continue;
      }
      const stance = stanceById.get(fid);
      if (!stance) {
        issues.push({
          code: "missing_reality_fact_stance",
          detail: `${path} cites fact_id=${fid} without reality_fact_stances entry`,
          path,
        });
        continue;
      }
      if (isConfirmedDcStatus(status)) {
        // Confirmed facts may use any stance; no upgrade path.
        continue;
      }
      // Non-confirmed: stance must keep uncertainty; text must not assert as settled.
      if (stance === "as_confirmed") {
        issues.push({
          code: "fact_status_upgrade",
          detail: `${path} marks fact ${fid} (${status}) as_confirmed`,
          path,
        });
        continue;
      }
      const factStatement = input.factContentById?.get(fid) ?? "";
      const textOk = nonConfirmedCitationTextOk({
        stance,
        text: citingText,
        factStatement,
        unitFactIds: factIds,
      });
      if (!textOk.ok) {
        issues.push({
          code: "fact_status_upgrade",
          detail: `${path} treats fact ${fid} (${status}) as settled (${textOk.reason})`,
          path,
        });
      }
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
    const status = resolveFactStatus(fid);
    if (!status) {
      issues.push({
        code: "fact_status_missing",
        detail: `${path} cites fact_id=${fid} with no DC status (fail-closed)`,
        path,
      });
      return;
    }
    if (status !== "confirmed") {
      issues.push({
        code: "confirmed_fact_status_mismatch",
        detail: `${path} includes ${fid} with status=${status} (must be confirmed)`,
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
      if (input.knownFactIds && !input.knownFactIds.has(fid)) {
        issues.push({
          code: "unknown_fact_id",
          detail: `${pid}.related_fact_ids cites unknown fact_id=${fid}`,
          path: pid,
        });
      } else if (!resolveFactStatus(fid)) {
        issues.push({
          code: "fact_status_missing",
          detail: `${pid}.related_fact_ids cites fact_id=${fid} with no DC status`,
          path: pid,
        });
      }
    }

    if (!isSelf) {
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

        const role = participant.role.trim().toLowerCase();
        if (!roleIsNeutral(role) && !roleSupportedByFactBlob(role, blob)) {
          issues.push({
            code: "third_party_role_ungrounded",
            detail: `${pid} role=${participant.role} is not supported by cited fact statements`,
            path: pid,
          });
        }

        // verification_status must be within the weakest max of bound facts.
        const maxes: Page07ParticipantVerificationStatus[] = [];
        let failClosed = false;
        for (const fid of relatedFacts) {
          const status = resolveFactStatus(fid);
          const level = input.factVerificationLevelById?.get(fid);
          const max = maxParticipantVerificationForFact({
            status,
            verification_level: level,
          });
          if (max === "fail_closed") {
            failClosed = true;
            issues.push({
              code: "participant_verification_unresolvable",
              detail: `${pid} related fact ${fid} has unusable status=${status ?? "missing"}`,
              path: pid,
            });
            break;
          }
          maxes.push(max);
        }
        if (!failClosed && maxes.length) {
          const weakest = weakestMaxVerification(maxes);
          const declared =
            participant.verification_status as Page07ParticipantVerificationStatus;
          if (!verificationIsWithinMax(declared, weakest)) {
            issues.push({
              code: "participant_verification_status_mismatch",
              detail: `${pid} verification_status=${declared} exceeds fact-supported max=${weakest}`,
              path: pid,
            });
          }
        }
      }

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

  /**
   * Units that treat a participant's behavior as settled.
   * Identity never proves behavior. Every assertive behavior sentence about a
   * participant must be independently matched to a confirmed DC behavior-evidence
   * fact on this unit (allowlisted fact_roles + content overlap). One supported
   * sentence must not launder another. Fail-closed — no model-reported
   * supporting_fact_id.
   */
  const scanParticipantProse = (
    participantIds: readonly string[],
    text: string,
    path: string,
    realityFactIds: readonly string[],
  ) => {
    if (!textHasAssertiveClaim(text)) return;

    const isUsableBehaviorCandidate = (
      fid: string,
      participantId: string,
      identityFactIds: ReadonlySet<string>,
    ): boolean => {
      if (identityFactIds.has(fid)) return false;
      if (!isConfirmedDcStatus(resolveFactStatus(fid))) return false;
      for (const otherId of participantIds) {
        if (otherId === participantId) continue;
        if (isSelfParticipantId(otherId)) continue;
        const other = participantById.get(otherId);
        if (!other) continue;
        if ((other.related_fact_ids ?? []).includes(fid)) return false;
      }
      return true;
    };

    for (const id of participantIds) {
      const participant = participantById.get(id);
      if (!participant) continue;
      if (isSelfParticipantId(id)) continue;
      if (participant.verification_status !== "confirmed") {
        issues.push({
          code: "unverified_participant_treated_as_confirmed",
          detail: `${path} asserts settled behavior for participant ${id} (${participant.verification_status})`,
          path,
        });
        continue;
      }

      const identityFactIds = new Set(participant.related_fact_ids ?? []);
      const candidateFacts = realityFactIds
        .filter((fid) => isUsableBehaviorCandidate(fid, id, identityFactIds))
        .map((fid) => ({
          statement: input.factContentById?.get(fid) ?? "",
          roles: input.factRolesById?.get(fid) ?? [],
        }));

      if (
        !allParticipantBehaviorSentencesSupported({
          displayLabel: participant.display_label,
          unitText: text,
          candidateFacts,
        })
      ) {
        issues.push({
          code: "unconfirmed_participant_behavior",
          detail: `${path} asserts settled behavior for participant ${id} without per-sentence confirmed behavior-fact support`,
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
    checkRealityFactCites(
      unit.reality_fact_ids ?? [],
      unit.reality_fact_stances ?? [],
      unit.unit_id,
      unit.text,
    );
    for (const did of unit.dir_ids ?? []) checkDir(did, unit.unit_id);
    checkPersonalRefs(
      unit.supporting_personal_unit_refs ?? [],
      unit.participant_ids,
      unit.unit_id,
    );
    scanScore(unit.unit_id, unit.text);
    scanParticipantProse(
      unit.participant_ids,
      unit.text,
      unit.unit_id,
      unit.reality_fact_ids ?? [],
    );
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
    checkRealityFactCites(
      unit.reality_fact_ids ?? [],
      unit.reality_fact_stances ?? [],
      unit.unit_id,
      // uncertainty_notes alone must not launder assertive unit.text.
      unit.text,
    );
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
      unit.reality_fact_ids ?? [],
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
