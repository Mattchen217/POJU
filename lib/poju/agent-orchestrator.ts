/**
 * Client-side post-turn orchestration: profile → Step 7 → Step 8 on confirm gate → Step 9.
 */

import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
import { requestBreakthroughCore } from "@/lib/llm/deepseek/breakthrough-core";
import { runFinalDeliveryForSession } from "@/lib/llm/pro/final-delivery";
import type { POJUAgentState } from "@/lib/poju/agent-state";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  loadSessionProfileBundle,
  resolveSessionHasProfile,
  withSessionProfileFlags,
} from "@/lib/poju/session-profile";
import { isSubstantiveBreakthroughQuestion } from "@/lib/poju/breakthrough-question-gate";
import {
  patchLastAssistantOrchestrationMeta,
  syncSessionOriginalQuestion,
} from "@/lib/poju/agent-state-snapshot";
import type { POJUSessionState } from "@/lib/poju/types";

function resolveSessionOriginalQuestion(session: POJUSessionState): string {
  return session.agent_v2?.original_question?.trim() || session.original_question?.trim() || "";
}

export type AgentOrchestratorUi = {
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

async function ensureBaseAnalysis(session: POJUSessionState): Promise<POJUSessionState> {
  if (session.agent_v2?.has_base_analysis) return session;
  const profileId = session.selected_stored_profile_id;
  if (profileId) {
    try {
      await generateBaseAnalysis(profileId);
    } catch (e) {
      console.warn("[agent-orchestrator] base-analysis gen failed:", e);
    }
  }
  const { base_analysis } = await loadSessionProfileBundle(session);
  if (base_analysis == null) return session;
  return patchAgent(session, {
    has_base_analysis: true,
    selected_profile_id: profileId ?? session.agent_v2?.selected_profile_id ?? null,
  });
}

export async function ensureBreakthroughCore(
  session: POJUSessionState,
  locale: string,
  opts?: { onProgress?: (accumulated_chars: number) => void },
): Promise<{
  session: POJUSessionState;
  llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
  model?: string;
}> {
  const agent = session.agent_v2;
  console.log("[poju-diag] breakthrough-core trigger", {
    phase: agent?.current_phase,
    has_core: agent?.breakthrough_core != null,
    has_profile: resolveSessionHasProfile(session),
  });
  if (!agent) return { session };
  if (agent.current_phase !== "collecting_context") return { session };
  if (agent.breakthrough_core != null) return { session };
  if (!isSubstantiveBreakthroughQuestion(resolveSessionOriginalQuestion(session))) return { session };

  const { base_analysis } = await loadSessionProfileBundle(session);
  if (base_analysis == null) return { session };

  try {
    const out = await requestBreakthroughCore(session, locale, {
      base_analysis,
      onProgress: opts?.onProgress,
    });
    return { session: out.session, llm_debug: out.llm_debug, model: out.model };
  } catch (e) {
    console.warn("[agent-orchestrator] Breakthrough core failed:", e);
    return { session };
  }
}

/** Post-turn hooks for explicit pipelines only — not invoked on every user turn. */
export async function runPostTurnOrchestration(
  session: POJUSessionState,
  opts: { locale: string; lastUserMessage?: string; autoPipeline?: boolean },
): Promise<PostTurnOrchestrationResult> {
  const locale = opts.locale;
  const auto = opts.autoPipeline !== false;

  let s = withSessionProfileFlags(session);
  s = syncSessionOriginalQuestion(s);
  const beforeOrchestration = s;

  const ui: AgentOrchestratorUi = {
    showContextSummary: false,
    pipelineBusy: false,
    pipelineNotice: null,
    pipelineError: null,
  };

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

  s = syncSessionOriginalQuestion(s);
  s = patchLastAssistantOrchestrationMeta(s, beforeOrchestration);

  return { session: s, ui };
}

/** After user confirms the context summary: Step 9 (spine-fed delivery). */
export async function runConfirmationPipeline(session: POJUSessionState, locale: string): Promise<POJUSessionState> {
  let s = withSessionProfileFlags(session);
  if (!s.agent_v2) throw new Error("agent_v2 required");

  s = await ensureBaseAnalysis(s);
  const agent = s.agent_v2;
  if (!agent) throw new Error("agent_v2 required");

  if (!agent.breakthrough_core) {
    const { base_analysis } = await loadSessionProfileBundle(s);
    if (base_analysis != null) {
      const out = await requestBreakthroughCore(s, locale, { base_analysis });
      s = out.session;
    }
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
