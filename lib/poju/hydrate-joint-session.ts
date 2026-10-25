/**
 * Client: turn joint seed into a local POJU session (dyad, partner present).
 */

import { createPOJUSession, loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import {
  buildDyadCompatSummary,
  dyadCollectedPatch,
} from "@/lib/poju/dyad-compat";
import { buildDyadMatrixPack } from "@/lib/poju/dyad-matrix-pack";
import type { JointSessionSeed } from "@/lib/passes/joint-decision";
import type { BirthInfo } from "@/lib/profile/types";
import {
  createStoredProfile,
  getStoredProfile,
} from "@/lib/profile/stored-profiles-service";

/**
 * Create local pivot session from joint seed.
 * `selfBirth` = this user's authorized birth (same as submitted on create/accept).
 */
export async function hydrateJointSessionFromSeed(
  seed: JointSessionSeed,
  selfBirth: BirthInfo,
): Promise<{ session_id: string }> {
  const selfCreated = await createStoredProfile({ birth_info: selfBirth });
  const existing = await loadPOJUSession(seed.pivot_session_id);
  if (existing?.joint_decision && existing.joint_decision_id === seed.joint_id) {
    return { session_id: existing.session_id };
  }
  const sessionId = await createPOJUSession({
    payment_id: seed.pass_ref,
    original_question: seed.shared_question,
    selected_stored_profile_id: selfCreated.profile_id,
    session_id: seed.pivot_session_id,
  });
  const state = await loadPOJUSession(sessionId);
  if (!state) throw new Error("joint_hydrate_failed");

  const partnerCreated = await createStoredProfile({ birth_info: seed.partner_birth });
  const self = await getStoredProfile(selfCreated.profile_id);
  const partner = await getStoredProfile(partnerCreated.profile_id);
  if (!self?.user_profile || !partner?.user_profile) {
    throw new Error("joint_profiles_missing");
  }

  const profileA = { user_profile: self.user_profile, base_analysis: self.base_analysis };
  const profileB = {
    user_profile: partner.user_profile,
    base_analysis: partner.base_analysis,
  };

  const next = {
    ...state,
    ...dyadCollectedPatch({
      partner_profile_id: partnerCreated.profile_id,
      summary: buildDyadCompatSummary({ profileA, profileB }),
      matrix_pack: buildDyadMatrixPack({ profileA, profileB }),
    }),
    selected_stored_profile_id: selfCreated.profile_id,
    has_profile: true,
    birth_submitted_in_session: true,
    original_question: seed.shared_question,
    pending_question: seed.shared_question,
    joint_decision_id: seed.joint_id,
    joint_decision: true as const,
    joint_pass_ref: seed.pass_ref,
    unlock_status: "unlocked" as const,
    unlock_via: "payment" as const,
    dyad_offer_status: "collected" as const,
  };

  await savePOJUSession(next);
  return { session_id: next.session_id };
}
