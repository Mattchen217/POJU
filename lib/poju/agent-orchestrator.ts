/**
 * Client-side post-turn orchestration: profile → Step 7 → Step 8 on confirm gate → Step 9.
 */

import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
import { getCachedSituationAnalysis, requestSituationAnalysis } from "@/lib/llm/deepseek/situation-analysis";
import { runFinalDeliveryForSession } from "@/lib/llm/pro/final-delivery";
import type { POJUAgentState } from "@/lib/poju/agent-state";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { buildFallbackContextSummary } from "@/lib/poju/context-summary-builder";
import { computeSituationContextFingerprint } from "@/lib/poju/situation-context-fingerprint";
import {
  resolveSessionHasProfile,
  shouldForceBirthForm,
  withSessionProfileFlags,
} from "@/lib/poju/session-profile";
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

export async function runPostTurnOrchestration(
  session: POJUSessionState,
  opts: { locale: string; lastUserMessage?: string; autoPipeline?: boolean },
): Promise<PostTurnOrchestrationResult> {
  const locale = opts.locale;
  const lastUser = opts.lastUserMessage?.trim() ?? "";
  const auto = opts.autoPipeline !== false;

  let s = withSessionProfileFlags(ensureContextSummary(session));
  const phase = s.agent_v2?.current_phase;

  const ui: AgentOrchestratorUi = {
    showBirthForm: shouldForceBirthForm(s, lastUser),
    showProfilePicker:
      phase === "awaiting_profile" && !resolveSessionHasProfile(s) && !s.profile_skipped && !shouldForceBirthForm(s, lastUser),
    showContextSummary: phase === "awaiting_confirmation" && !s.main_delivery_done,
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

  if (auto && phase === "awaiting_confirmation" && s.agent_v2 && !s.agent_v2.has_situation_analysis) {
    try {
      ui.pipelineBusy = true;
      const out = await requestSituationAnalysis(s, locale, { force: false });
      s = out.session;
      ui.pipelineNotice = out.cache_hit
        ? locale.startsWith("zh")
          ? "已加载困境分析缓存。"
          : "Loaded cached situation analysis."
        : locale.startsWith("zh")
          ? "困境分析已生成。"
          : "Situation analysis generated.";
    } catch (e) {
      ui.pipelineError = e instanceof Error ? e.message : String(e);
    } finally {
      ui.pipelineBusy = false;
    }
  }

  return { session: s, ui };
}

/** After user confirms the context summary: Step 8 (if needed) → Step 9. */
export async function runConfirmationPipeline(session: POJUSessionState, locale: string): Promise<POJUSessionState> {
  let s = withSessionProfileFlags(session);
  if (!s.agent_v2) throw new Error("agent_v2 required");

  s = await ensureBaseAnalysis(s);

  const fp = await computeSituationContextFingerprint({
    session_id: s.session_id,
    original_question: s.original_question,
    agent_v2: s.agent_v2,
    context_collected: s.context_collected,
  });

  if (!getCachedSituationAnalysis(s, fp)?.content) {
    const out = await requestSituationAnalysis(s, locale, { force: false });
    s = out.session;
  }

  const delivered = await runFinalDeliveryForSession(s, locale);
  return patchAgent(delivered, {
    current_phase: "delivered",
    main_delivery_at: new Date().toISOString(),
  });
}
