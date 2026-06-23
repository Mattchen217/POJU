/**
 * Client-side post-turn orchestration: profile → Step 7 → Step 8 on confirm gate → Step 9.
 */

import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
import { requestBreakthroughCore } from "@/lib/llm/deepseek/breakthrough-core";
import { runFinalDeliveryForSession } from "@/lib/llm/pro/final-delivery";
import type { POJUAgentState } from "@/lib/poju/agent-state";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { buildFallbackContextSummary } from "@/lib/poju/context-summary-builder";
import {
  lastAssistantRequestsBirthForm,
  resolveSessionHasProfile,
  withSessionProfileFlags,
} from "@/lib/poju/session-profile";
import { downgradePrematureConfirmationPhase } from "@/lib/poju/summary-readiness";
import type { POJUSessionState } from "@/lib/poju/types";

export type AgentOrchestratorUi = {
  showBirthForm: boolean;
  showProfilePicker: boolean;
  showContextSummary: boolean;
  pipelineBusy: boolean;
  pipelineNotice: string | null;
  pipelineError: string | null;
};

export type PostTurnOrchestrationResult = {
  session: POJUSessionState;
  ui: AgentOrchestratorUi;
};

function patchAgent(session: POJUSessionState, patch: Partial<POJUAgentState>): POJUSessionState {
  const base =
    session.agent_v2 ?? createInitialAgentState({ original_question: session.original_question });
  return withSessionProfileFlags({
    ...session,
    agent_v2: { ...base, ...patch },
  });
}

function ensureContextSummary(session: POJUSessionState): POJUSessionState {
  const agent = session.agent_v2;
  if (!agent || agent.current_phase !== "awaiting_confirmation") return session;
  if (agent.stall_offer_pending) return session;
  if (agent.current_summary) return session;
  return patchAgent(session, { current_summary: buildFallbackContextSummary(agent) });
}

async function ensureBaseAnalysis(session: POJUSessionState): Promise<POJUSessionState> {
  const profileId = session.selected_stored_profile_id;
  if (!profileId || session.agent_v2?.has_base_analysis) return session;
  try {
    await generateBaseAnalysis(profileId);
    return patchAgent(session, {
      has_base_analysis: true,
      selected_profile_id: profileId,
    });
  } catch (e) {
    console.warn("[agent-orchestrator] Step 7 failed:", e);
    return session;
  }
}

async function ensureBreakthroughCore(
  session: POJUSessionState,
  locale: string,
): Promise<POJUSessionState> {
  const agent = session.agent_v2;
  if (!agent) return session;
  if (agent.current_phase !== "collecting_context") return session;
  if (agent.breakthrough_core != null) return session;
  if (!agent.has_base_analysis) return session;

  const out = await requestBreakthroughCore(session, locale);
  return out.session;
}

export async function runPostTurnOrchestration(
  session: POJUSessionState,
  opts: { locale: string; lastUserMessage?: string; autoPipeline?: boolean },
): Promise<PostTurnOrchestrationResult> {
  const locale = opts.locale;
  const auto = opts.autoPipeline !== false;

  let s = withSessionProfileFlags(ensureContextSummary(downgradePrematureConfirmationPhase(session)));
  const phase = s.agent_v2?.current_phase;
  const agentWantsBirthForm = lastAssistantRequestsBirthForm(s);

  const ui: AgentOrchestratorUi = {
    showBirthForm: agentWantsBirthForm,
    showProfilePicker:
      phase === "opening" &&
      !resolveSessionHasProfile(s) &&
      !agentWantsBirthForm &&
      (s.messages.filter((m) => m.role === "user" && !m.is_rejected).length === 0),
    showContextSummary: false,
    pipelineBusy: false,
    pipelineNotice: null,
    pipelineError: null,
  };

  if (resolveSessionHasProfile(s) && s.selected_stored_profile_id && !s.agent_v2?.has_base_analysis) {
    ui.pipelineBusy = true;
    s = await ensureBaseAnalysis(s);
    ui.pipelineBusy = false;
    if (s.agent_v2?.has_base_analysis) {
      ui.pipelineNotice = locale.startsWith("zh") ? "命主基础分析已就绪。" : "Base chart analysis is ready.";
    }
  }

  if (
    s.agent_v2?.current_phase === "collecting_context" &&
    s.agent_v2.breakthrough_core == null &&
    s.agent_v2.has_base_analysis
  ) {
    ui.pipelineBusy = true;
    try {
      s = await ensureBreakthroughCore(s, locale);
      ui.pipelineNotice = locale.startsWith("zh")
        ? "破局推理脊柱与调查议程已生成。"
        : "Breakthrough spine and investigation agenda are ready.";
    } catch (e) {
      console.warn("[agent-orchestrator] Breakthrough core failed:", e);
      ui.pipelineError = e instanceof Error ? e.message : String(e);
    }
    ui.pipelineBusy = false;
  }

  if (
    auto &&
    s.agent_v2?.delivery_mode === "degraded" &&
    s.agent_v2.current_phase === "delivered" &&
    !s.main_delivery_done
  ) {
    ui.pipelineBusy = true;
    try {
      s = await runDegradedDeliveryPipeline(s, locale);
      ui.pipelineNotice = locale.startsWith("zh") ? "方向性分析已生成。" : "Directional analysis is ready.";
    } catch (e) {
      console.warn("[agent-orchestrator] Degraded delivery failed:", e);
      ui.pipelineError = e instanceof Error ? e.message : String(e);
    }
    ui.pipelineBusy = false;
  }

  // Step 8/9 run only after user confirms the summary (runConfirmationPipeline), not while the form is open.

  return { session: s, ui };
}

/** After user confirms the context summary: Step 9 (spine-fed delivery). */
export async function runConfirmationPipeline(session: POJUSessionState, locale: string): Promise<POJUSessionState> {
  let s = withSessionProfileFlags(session);
  if (!s.agent_v2) throw new Error("agent_v2 required");

  s = await ensureBaseAnalysis(s);
  const agent = s.agent_v2;
  if (!agent) throw new Error("agent_v2 required");

  if (!agent.breakthrough_core && agent.has_base_analysis) {
    const out = await requestBreakthroughCore(s, locale);
    s = out.session;
  }

  const delivered = await runFinalDeliveryForSession(s, locale);
  const patched = patchAgent(delivered, {
    current_phase: "delivered",
    main_delivery_at: new Date().toISOString(),
  });
  const { trySaveDeliveryActionsToArchive } = await import("@/lib/archive/archive-service");
  return trySaveDeliveryActionsToArchive(patched, locale);
}

/** Degraded delivery after stall-offer choice or fallback (Step 3 → Step 4). */
export async function runDegradedDeliveryPipeline(
  session: POJUSessionState,
  locale: string,
): Promise<POJUSessionState> {
  let s = withSessionProfileFlags(session);
  if (!s.agent_v2) throw new Error("agent_v2 required");

  s = await ensureBaseAnalysis(s);

  const delivered = await runFinalDeliveryForSession(s, locale, { delivery_mode: "degraded" });
  const patched = patchAgent(delivered, {
    current_phase: "delivered",
    delivery_mode: "degraded",
    main_delivery_at: new Date().toISOString(),
    stall_offer_pending: false,
  });
  const { trySaveDeliveryActionsToArchive } = await import("@/lib/archive/archive-service");
  return trySaveDeliveryActionsToArchive(patched, locale);
}
