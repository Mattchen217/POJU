/**
 * Build an in-memory POJU session for Delivery Lab full_pipeline.
 * Isolated from browser IndexedDB — never written to local Dexie.
 */

import { createInitialAgentState } from "@/lib/poju/agent-state";
import { createNewCycle } from "@/lib/poju/cycle-manager";
import type { POJUSessionState } from "@/lib/poju/types";

export function createLabChatSession(input: {
  lab_id: string;
  original_question?: string;
  locale?: string;
  selected_stored_profile_id?: string | null;
}): POJUSessionState {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const question = (input.original_question ?? "").trim() || "(lab pipeline)";
  const session_id = `lab-chat-${input.lab_id}`;
  const firstCycle = createNewCycle({
    original_question: question,
    cycle_index: 1,
  });
  const profileId =
    typeof input.selected_stored_profile_id === "string" &&
    input.selected_stored_profile_id.trim()
      ? input.selected_stored_profile_id.trim()
      : null;
  const locRaw = (input.locale ?? "zh").trim().toLowerCase();
  const locked_output_locale =
    locRaw.startsWith("en")
      ? "en"
      : locRaw.startsWith("fr")
        ? "fr"
        : locRaw.startsWith("es")
          ? "es"
          : "zh";

  const session: POJUSessionState = {
    session_id,
    device_id: `ops-lab-${input.lab_id}`,
    original_question: question,
    cycles: [firstCycle],
    active_cycle_id: firstCycle.cycle_id,
    shared_context: {},
    messages: [],
    context_collected: {},
    has_profile: Boolean(profileId) || true, // lab always has base_analysis on LabSource
    birth_submitted_in_session: true,
    profile_skipped: false,
    selected_stored_profile_id: profileId,
    dyad_offer_status: "none",
    partner_profile_id: null,
    partner_bazi: undefined,
    dyad_compat_summary: null,
    pivot_chart_path: null,
    charts_locked_at: null,
    dyad_matrix_pack: null,
    actions: [],
    main_delivery_done: false,
    main_delivery: null,
    tokens_used: 0,
    abuse_metrics: {
      long_input_count: 0,
      jailbreak_attempts: 0,
      duplicate_attempts: 0,
    },
    created_at: now.toISOString(),
    last_interaction_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    unlock_status: "preview",
    locked_output_locale,
    agent_v2: createInitialAgentState({
      original_question: question,
      selected_profile_id: profileId,
    }),
  };

  return session;
}
