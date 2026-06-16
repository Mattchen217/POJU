import { buildMatrixPayloadFromProfile, type PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { resolveSessionHasProfile, withSessionProfileFlags } from "@/lib/poju/session-profile";
import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

export function getUnlockStatus(session: POJUSessionState): "preview" | "unlocked" {
  if (session.unlock_status === "unlocked") return "unlocked";
  if (session.unlock_status === "preview") return "preview";
  if (session.agent_v2?.has_base_analysis) return "unlocked";
  if (resolveSessionHasProfile(session)) return "preview";
  return "unlocked";
}

export function isPreviewSession(session: POJUSessionState): boolean {
  return getUnlockStatus(session) === "preview";
}

export function hasPreviewMatrixMessage(session: POJUSessionState): boolean {
  return session.messages.some((m) => m.meta?.kind === "energy_matrix");
}

export function hasPaywallMessage(session: POJUSessionState): boolean {
  return session.messages.some((m) => m.meta?.kind === "paywall");
}

export function createEnergyMatrixMessage(payload: PojuMatrixPayload, _locale: string): POJUMessage {
  return {
    role: "assistant",
    content: "",
    timestamp: new Date().toISOString(),
    meta: {
      kind: "energy_matrix",
      matrix_payload: payload,
    },
  };
}

export function createPaywallMessage(): POJUMessage {
  return {
    role: "assistant",
    content: "",
    timestamp: new Date().toISOString(),
    meta: { kind: "paywall" },
  };
}

export function createReportMessage(input: {
  reportText: string;
  profileId: string;
}): POJUMessage {
  return {
    role: "assistant",
    content: input.reportText,
    timestamp: new Date().toISOString(),
    meta: {
      kind: "report",
      report_text: input.reportText,
      report_profile_id: input.profileId,
    },
  };
}

/** Bind profile + preview fields on session (prepare → chat path). */
export async function bindPreviewProfileToSession(
  session: POJUSessionState,
  profileId: string,
  locale = "en",
): Promise<POJUSessionState> {
  const stored = await getStoredProfile(profileId);
  if (!stored?.user_profile) {
    throw new Error("Profile not found");
  }

  const matrix_payload = buildMatrixPayloadFromProfile(profileId, stored.user_profile, {
    display_name: stored.user_profile.birth.birth_location?.name,
    locale,
  });

  const agentBase =
    session.agent_v2 ??
    createInitialAgentState({
      original_question: session.original_question,
      selected_profile_id: profileId,
    });

  return withSessionProfileFlags(
    {
      ...session,
      selected_stored_profile_id: profileId,
      profile_skipped: false,
      unlock_status: "preview",
      matrix_payload,
      agent_v2: {
        ...agentBase,
        selected_profile_id: profileId,
        profile_skipped: false,
        has_base_analysis: false,
        current_phase: "opening",
      },
    },
    { selected_stored_profile_id: profileId },
  );
}

export const POJU_PENDING_UNLOCK_SESSION_KEY = "poju_pending_unlock_session_id";
export const POJU_RUN_UNLOCK_FLAG = "poju_run_unlock";
