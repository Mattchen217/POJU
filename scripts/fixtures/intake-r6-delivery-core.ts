/**
 * Delivery-entry prerequisites for Intake R6 tests — scripts/** only.
 * Must never be imported from lib/ or app/ production modules.
 *
 * runFinalDeliveryForSession refuses sessions without agent_v2.breakthrough_core;
 * this writes a minimal one (full delivery mode, no stall) through
 * mutatePOJUSession without touching the Decision Context.
 */

import type { BreakthroughCore } from "@/lib/poju/agent-state";

export function sampleBreakthroughCore(now: string): BreakthroughCore {
  return {
    situation_conclusion: "Income risk vs optionality",
    key_crossroads: {
      real_fork: "Stay vs leave",
      path_costs: "Stability vs growth",
      decision_traits: "Risk tolerance",
      structural_basis: "basis",
      needs_validation: "runway",
    },
    modern_action_frames: [
      {
        direction: "Negotiate a bridge",
        why_fits: "Keeps optionality",
        structural_basis: "basis",
        needs_validation: "manager flexibility",
      },
    ],
    energy_retune_frame: {
      direction_fit: "fit",
      timing_ripeness: "next quarter",
      daily_retune: "sleep",
      complementary: "mentor",
      structural_basis: "basis",
      needs_validation: "stress",
    },
    rhythm_frame: {
      phase1_observe: "watch cash",
      phase2_adjust: "talk terms",
      phase3_consolidate: "decide",
    },
    self_check_signals: ["anxiety spike"],
    generated_at: now,
  };
}

export async function seedBreakthroughCoreForDelivery(
  sid: string,
  now: string,
  tag: string,
): Promise<void> {
  const { mutatePOJUSession } = await import("@/lib/poju/session-mutation");
  const { createInitialAgentState } = await import("@/lib/poju/agent-state");
  await mutatePOJUSession(sid, {
    operation_id: `op_s8_core_${tag}`,
    kind: "session_patch",
    bump_dc: false,
    apply: (latest) => {
      const agent = createInitialAgentState({ original_question: latest.original_question });
      agent.delivery_mode = "full";
      agent.stall_offer_pending = false;
      agent.breakthrough_core = sampleBreakthroughCore(now);
      return { ...latest, agent_v2: agent };
    },
  });
}
