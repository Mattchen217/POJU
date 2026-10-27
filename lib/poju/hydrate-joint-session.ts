/**
 * Client: turn joint seed into a local POJU session (dyad, partner present).
 * Call only after PASS charge succeeds — sets unlocked + pending shared question.
 */

import {
  dedupeWelcomeMessages,
  seedMatrixWelcomeMessage,
} from "@/lib/poju/chat-bootstrap";
import { createPOJUSession, loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import {
  buildDyadCompatSummary,
  dyadCollectedPatch,
} from "@/lib/poju/dyad-compat";
import { buildDyadMatrixPack } from "@/lib/poju/dyad-matrix-pack";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import type { POJUSessionState } from "@/lib/poju/types";
import type { JointSessionSeed } from "@/lib/passes/joint-decision";
import type { BirthInfo } from "@/lib/profile/types";
import { hasDialogueReplyForPendingQuestion } from "@/lib/poju/finalize-unlock-bazi-session";
import {
  createStoredProfile,
  getStoredProfile,
} from "@/lib/profile/stored-profiles-service";

/**
 * Create local pivot session from joint seed.
 * `selfBirth` = this user's authorized birth (same as submitted on create/accept).
 *
 * Prefer `reuseSessionId` (preview chat from the 10s prepare) so stage1 upgrades
 * in place — avoids resumeSession wiping chat (looks like a full page refresh).
 */
export async function hydrateJointSessionFromSeed(
  seed: JointSessionSeed,
  selfBirth: BirthInfo,
  opts?: {
    matrixPayload?: PojuMatrixPayload | null;
    locale?: string;
    /** Upgrade this preview session instead of creating a second id. */
    reuseSessionId?: string | null;
    /** Profile already created during prepare — skip a second create. */
    selfProfileId?: string | null;
  },
): Promise<{ session_id: string }> {
  const reuseId = opts?.reuseSessionId?.trim() || "";
  const targetSessionId = reuseId || seed.pivot_session_id;

  let selfProfileId = opts?.selfProfileId?.trim() || "";
  if (!selfProfileId) {
    const selfCreated = await createStoredProfile({ birth_info: selfBirth });
    selfProfileId = selfCreated.profile_id;
  }

  const existing = await loadPOJUSession(targetSessionId);
  if (
    existing?.joint_decision &&
    existing.joint_decision_id === seed.joint_id &&
    existing.unlock_status === "unlocked" &&
    existing.joint_pass_ref
  ) {
    // Re-arm shared question when charge already ok but tip/auto-send never ran
    // (initiator + invitee). Skip if model already replied to that question.
    const q = seed.shared_question.trim();
    if (q && !hasDialogueReplyForPendingQuestion(existing, q)) {
      const patched: POJUSessionState = {
        ...existing,
        original_question: existing.original_question?.trim() || q,
        pending_question: existing.pending_question?.trim() || q,
      };
      await savePOJUSession(patched);
    }
    return { session_id: existing.session_id };
  }

  let state = existing;
  if (!state) {
    const sessionId = await createPOJUSession({
      payment_id: seed.pass_ref,
      original_question: seed.shared_question,
      selected_stored_profile_id: selfProfileId,
      session_id: targetSessionId,
    });
    state = await loadPOJUSession(sessionId);
  }
  if (!state) throw new Error("joint_hydrate_failed");

  const partnerCreated = await createStoredProfile({ birth_info: seed.partner_birth });
  const self = await getStoredProfile(selfProfileId);
  const partner = await getStoredProfile(partnerCreated.profile_id);
  if (!self?.user_profile || !partner?.user_profile) {
    throw new Error("joint_profiles_missing");
  }

  const profileA = { user_profile: self.user_profile, base_analysis: self.base_analysis };
  const profileB = {
    user_profile: partner.user_profile,
    base_analysis: partner.base_analysis,
  };

  const matrixPayload = opts?.matrixPayload ?? state.matrix_payload ?? null;
  let next: POJUSessionState = {
    ...state,
    ...dyadCollectedPatch({
      partner_profile_id: partnerCreated.profile_id,
      summary: buildDyadCompatSummary({ profileA, profileB }),
      matrix_pack: buildDyadMatrixPack({ profileA, profileB }),
    }),
    selected_stored_profile_id: selfProfileId,
    has_profile: true,
    birth_submitted_in_session: true,
    original_question: seed.shared_question,
    pending_question: seed.shared_question,
    joint_decision_id: seed.joint_id,
    joint_decision: true,
    joint_pass_ref: seed.pass_ref,
    unlock_status: "unlocked",
    unlock_via: "payment",
    dyad_offer_status: "collected",
    matrix_payload: matrixPayload ?? state.matrix_payload,
    // Strip any pre-charge gate tip; stage1 starts from welcome + pending question.
    messages: state.messages.filter((m) => m.meta?.kind !== "joint_pass_gate"),
  };

  if (matrixPayload && opts?.locale) {
    next = { ...next, matrix_payload: matrixPayload };
    next = seedMatrixWelcomeMessage(next, opts.locale);
    next = dedupeWelcomeMessages(next);
  }

  await savePOJUSession(next);
  return { session_id: next.session_id };
}
