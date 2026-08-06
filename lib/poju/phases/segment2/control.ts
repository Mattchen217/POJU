/**
 * Segment 2 (analysis + directions + agenda) ??control flow.
 * Owns: gate-confirm ??create xhigh job ??apply job result into session display.
 * Polling UI owns Progress (Segment2AnalysisPreparing); this module does not await the job.
 *
 * Only imports shared/ + agent-state / session helpers. Never imports opening/ or other phases/.
 */
import { safeRandomUUID } from "@/lib/client/safe-crypto";
import {
  createInitialAgentState,
  normalizeAgentPhase,
  type BreakthroughCore,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
import { buildAgentStateSnapshot } from "@/lib/poju/agent-state-snapshot";
import { ensureSessionCycles } from "@/lib/poju/cycle-manager";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";
import { loadSessionProfileBundle, withSessionProfileFlags } from "@/lib/poju/session-profile";
import { resolvePivotSessionLang } from "@/lib/poju/session-lang";
import { advanceStateMachine, extractModelTurnSignals } from "@/lib/poju/state-machine";
import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";
import { sanitizeReplyOptions } from "@/lib/poju/reply-options";
import { understandingGateConfirmButtonLabel } from "@/lib/poju/understanding-gate-reply";
import type { Segment2JobPollResult } from "@/lib/poju/shared/xhigh-job";
import {
  buildSegment2AnalysisReply,
  segment2AgendaBridgeFailedMessage,
  segment2CoreGenerationFailedMessage,
  segment2RegenerateButtonLabel,
} from "@/lib/poju/phases/segment2/display";

function ensureAgentV2(session: POJUSessionState): POJUAgentState {
  const base = session.agent_v2;
  if (base) {
    const phase = normalizeAgentPhase(base.current_phase) ?? base.current_phase;
    return { ...base, current_phase: phase };
  }
  return createInitialAgentState({
    original_question: session.original_question,
    selected_profile_id: session.selected_stored_profile_id,
  });
}

function extractOpeningProblem(messages: POJUMessage[]): string {
  const users = messages.filter((m) => m.role === "user").map((m) => m.content.trim()).filter(Boolean);
  const last = users[users.length - 1] ?? "";
  if (last && last !== "__OPENING__") return last;
  return users.find((c) => c !== "__OPENING__") ?? "";
}

function markCorePending(agent: POJUAgentState, freshQuestion: string): POJUAgentState {
  return {
    ...agent,
    original_question: freshQuestion,
    current_phase: "collecting_context",
    breakthrough_core: null,
    investigation_agenda: [],
    agenda_generated: false,
    core_generation_failed: false,
    has_situation_analysis: false,
  };
}

function markCoreFailed(agent: POJUAgentState): POJUAgentState {
  return {
    ...agent,
    current_phase: "collecting_context",
    core_generation_failed: true,
    breakthrough_core: null,
    investigation_agenda: [],
    agenda_generated: false,
    has_situation_analysis: false,
  };
}

export type CreateSegment2JobResult =
  | { ok: true; job_id: string }
  | {
      ok: true;
      job_id: string;
      already_complete: true;
      breakthrough_core: BreakthroughCore;
      investigation_agenda: AgendaItem[];
      model?: string;
      tokens_used?: number;
      llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
    }
  | { ok: false; error: string; retryable?: boolean };

/** POST create (or resume) segment-2 xhigh job ??does not poll. */
export async function createSegment2XhighJob(input: {
  session: POJUSessionState;
  locale: string;
  agent_v2: POJUAgentState;
  original_question: string;
  base_analysis?: unknown | null;
}): Promise<CreateSegment2JobResult> {
  if (typeof window === "undefined") {
    throw new Error("createSegment2XhighJob is browser-only");
  }

  // SSOT: locked first-user language wins over website UI locale.
  const locale = resolvePivotSessionLang(input.session, input.locale);

  let base_analysis = input.base_analysis;
  if (base_analysis === undefined) {
    const bundle = await loadSessionProfileBundle(input.session);
    base_analysis = bundle.base_analysis ?? null;
  }
  if (base_analysis == null) {
    return {
      ok: false,
      error:
        "[segment2] ?????????????????selected_stored_profile_id=" +
        (input.session.selected_stored_profile_id ?? "null"),
    };
  }

  const profileId = input.session.selected_stored_profile_id?.trim() ?? "";
  const res = await fetch("/api/poju/breakthrough-core", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: input.session.session_id,
      original_question: input.original_question,
      agent_v2: input.agent_v2,
      base_analysis,
      locale,
      selected_stored_profile_id: profileId || null,
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    job_id?: string;
    status?: string;
    breakthrough_core?: BreakthroughCore;
    investigation_agenda?: AgendaItem[];
    model?: string;
    tokens_used?: number;
    llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
    error?: string;
    retryable?: boolean;
  };

  // Resume of a finished job: core is enough; agenda may be missing after JSON round-trip.
  if (payload.breakthrough_core && payload.job_id) {
    console.info("[segment2] job already complete on create", { job_id: payload.job_id });
    return {
      ok: true,
      job_id: payload.job_id,
      already_complete: true,
      breakthrough_core: payload.breakthrough_core,
      investigation_agenda: Array.isArray(payload.investigation_agenda)
        ? payload.investigation_agenda
        : [],
      model: payload.model,
      tokens_used: payload.tokens_used,
      llm_debug: payload.llm_debug,
    };
  }

  if (!payload.job_id) {
    return {
      ok: false,
      error: payload.error || `segment2 job create failed (${res.status})`,
      retryable: payload.retryable ?? true,
    };
  }

  console.info("[segment2] job created", { job_id: payload.job_id });
  return { ok: true, job_id: payload.job_id };
}

export type Segment2StartResult = {
  session: POJUSessionState;
  job_id: string | null;
  /** When API returned a completed job immediately (resume). */
  already_complete?: boolean;
};

/** Gate confirm ??advance SM ??create async xhigh job (UI mounts preparing + polls). */
export async function startSegment2AfterGateConfirm(input: {
  session: POJUSessionState;
  locale: string;
  userAlreadyAppended?: boolean;
}): Promise<Segment2StartResult> {
  const locale = resolvePivotSessionLang(input.session, input.locale);
  const session = ensureSessionCycles(input.session);
  const baseAgent = ensureAgentV2(session);
  const phase = normalizeAgentPhase(baseAgent.current_phase);
  if (phase !== "awaiting_understanding_confirm") {
    return { session, job_id: null };
  }

  const userLabel = understandingGateConfirmButtonLabel(locale);
  const userMessage: POJUMessage = {
    role: "user",
    content: userLabel,
    timestamp: new Date().toISOString(),
    client_id: safeRandomUUID(),
  };
  const messagesWithUser = input.userAlreadyAppended
    ? session.messages
    : [...session.messages, userMessage];

  const signals = extractModelTurnSignals({ confirmation_signal: "confirmed" });
  const advance = advanceStateMachine(baseAgent, signals, userLabel);
  const freshQuestion =
    advance.next_agent.original_question?.trim() ||
    extractOpeningProblem(messagesWithUser) ||
    session.original_question?.trim() ||
    userLabel;

  let agent_v2 = markCorePending(
    { ...advance.next_agent, original_question: freshQuestion },
    freshQuestion,
  );

  const sessionPending = withSessionProfileFlags({
    ...session,
    original_question: freshQuestion,
    messages: messagesWithUser,
    agent_v2,
    last_interaction_at: new Date().toISOString(),
  });

  if (!advance.trigger_breakthrough_core) {
    return { session: sessionPending, job_id: null };
  }

  const created = await createSegment2XhighJob({
    session: sessionPending,
    locale,
    agent_v2,
    original_question: freshQuestion,
  });

  if (!created.ok) {
    agent_v2 = markCoreFailed(agent_v2);
    const failedContent = segment2CoreGenerationFailedMessage(locale);
    const assistantMessage: POJUMessage = {
      role: "assistant",
      content: failedContent,
      timestamp: new Date().toISOString(),
      meta: {
        current_state: "collecting_context",
        user_intent: "sharing_situation",
        action_requested: "continue_chat",
        core_generation_failed: true,
        state_snapshot: buildAgentStateSnapshot(agent_v2, session.main_delivery_done),
      },
    };
    return {
      session: withSessionProfileFlags({
        ...sessionPending,
        messages: [...messagesWithUser, assistantMessage],
        agent_v2,
      }),
      job_id: null,
    };
  }

  if ("already_complete" in created && created.already_complete) {
    return {
      session: finalizeSegment2JobSuccess({
        session: sessionPending,
        locale,
        breakthrough_core: created.breakthrough_core,
        investigation_agenda: created.investigation_agenda,
        model: created.model,
        tokens_used: created.tokens_used,
        llm_debug: created.llm_debug,
      }),
      job_id: created.job_id,
      already_complete: true,
    };
  }

  return { session: sessionPending, job_id: created.job_id };
}

function isSegment2AssistantBubble(m: POJUMessage | undefined): boolean {
  if (!m || m.role !== "assistant") return false;
  return Boolean(
    m.meta?.core_generation_failed ||
      m.meta?.segment2_analysis ||
      m.meta?.segment2_bridge_question ||
      m.meta?.segment2_agenda_bridge_failed,
  );
}

/** Regenerate segment-2 without redoing opening understanding (also clears a prior successful core). */
export async function startSegment2Regenerate(input: {
  session: POJUSessionState;
  locale: string;
  userAlreadyAppended?: boolean;
}): Promise<Segment2StartResult> {
  const locale = resolvePivotSessionLang(input.session, input.locale);
  const session = ensureSessionCycles(input.session);
  const baseAgent = ensureAgentV2(session);
  const phase = normalizeAgentPhase(baseAgent.current_phase);
  if (phase !== "collecting_context") return { session, job_id: null };

  const userLabel = segment2RegenerateButtonLabel(locale);
  const userMessage: POJUMessage = {
    role: "user",
    content: userLabel,
    timestamp: new Date().toISOString(),
    client_id: safeRandomUUID(),
  };
  const messagesWithUser = input.userAlreadyAppended
    ? session.messages
    : [...session.messages, userMessage];

  // Drop previous segment-2 assistant bubble (failed or success) so the new run replaces it.
  let msgs = messagesWithUser;
  const last = msgs[msgs.length - 1];
  const prev = msgs[msgs.length - 2];
  if (last?.role === "user" && isSegment2AssistantBubble(prev)) {
    msgs = [...msgs.slice(0, -2), last];
  } else if (isSegment2AssistantBubble(last)) {
    msgs = msgs.slice(0, -1);
  }

  const freshQuestion =
    baseAgent.original_question?.trim() ||
    extractOpeningProblem(msgs) ||
    session.original_question?.trim() ||
    userLabel;

  const agent_v2 = markCorePending(
    { ...baseAgent, original_question: freshQuestion, current_phase: "collecting_context" },
    freshQuestion,
  );

  const sessionPending = withSessionProfileFlags({
    ...session,
    original_question: freshQuestion,
    messages: msgs,
    agent_v2,
    last_interaction_at: new Date().toISOString(),
  });

  const created = await createSegment2XhighJob({
    session: sessionPending,
    locale,
    agent_v2,
    original_question: freshQuestion,
  });

  if (!created.ok) {
    const failed = markCoreFailed(agent_v2);
    const assistantMessage: POJUMessage = {
      role: "assistant",
      content: segment2CoreGenerationFailedMessage(locale),
      timestamp: new Date().toISOString(),
      meta: {
        current_state: "collecting_context",
        user_intent: "sharing_situation",
        action_requested: "continue_chat",
        core_generation_failed: true,
        state_snapshot: buildAgentStateSnapshot(failed, session.main_delivery_done),
      },
    };
    return {
      session: withSessionProfileFlags({
        ...sessionPending,
        messages: [...msgs, assistantMessage],
        agent_v2: failed,
      }),
      job_id: null,
    };
  }

  if ("already_complete" in created && created.already_complete) {
    return {
      session: finalizeSegment2JobSuccess({
        session: sessionPending,
        locale,
        breakthrough_core: created.breakthrough_core,
        investigation_agenda: created.investigation_agenda,
        model: created.model,
        tokens_used: created.tokens_used,
        llm_debug: created.llm_debug,
      }),
      job_id: created.job_id,
      already_complete: true,
    };
  }

  return { session: sessionPending, job_id: created.job_id };
}

/** Apply successful poll result ??full segment-2 analysis bubble. */

/** Apply Call A poll success ? report bubble (no first_question yet). Input stays locked in UI. */
export function finalizeSegment2ReportSuccess(input: {
  session: POJUSessionState;
  locale: string;
  breakthrough_core: BreakthroughCore;
  model?: string;
  tokens_used?: number;
  llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
}): POJUSessionState {
  const locale = resolvePivotSessionLang(input.session, input.locale);
  const session = ensureSessionCycles(input.session);
  const base = ensureAgentV2(session);
  const coreWithoutQ: BreakthroughCore = {
    ...input.breakthrough_core,
    first_question: undefined,
  };
  const agent_v2: POJUAgentState = {
    ...base,
    current_phase: "collecting_context",
    breakthrough_core: coreWithoutQ,
    investigation_agenda: [],
    agenda_generated: false,
    has_situation_analysis: true,
    core_generation_failed: false,
  };

  const finalContent = buildSegment2AnalysisReply(agent_v2, locale, {
    includeFirstQuestion: false,
  });
  const assistantMessage: POJUMessage = {
    role: "assistant",
    content: finalContent,
    timestamp: new Date().toISOString(),
    client_id: safeRandomUUID(),
    meta: {
      current_state: "collecting_context",
      user_intent: "sharing_situation",
      action_requested: "continue_chat",
      segment2_analysis: true,
      llm_model: input.model,
      llm_debug: input.llm_debug,
      tokens_used: input.tokens_used,
      state_snapshot: buildAgentStateSnapshot(agent_v2, session.main_delivery_done),
    },
  };

  return withSessionProfileFlags({
    ...session,
    messages: [...session.messages, assistantMessage],
    agent_v2,
    tokens_used: session.tokens_used + (input.tokens_used ?? 0),
    last_interaction_at: new Date().toISOString(),
  });
}

/** @deprecated Prefer finalizeSegment2ReportSuccess + finalizeSegment2AgendaBridgeSuccess. */
export function finalizeSegment2JobSuccess(input: {
  session: POJUSessionState;
  locale: string;
  breakthrough_core: BreakthroughCore;
  investigation_agenda: AgendaItem[];
  model?: string;
  tokens_used?: number;
  llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
}): POJUSessionState {
  const locale = resolvePivotSessionLang(input.session, input.locale);
  const withReport = finalizeSegment2ReportSuccess({
    session: input.session,
    locale,
    breakthrough_core: input.breakthrough_core,
    model: input.model,
    tokens_used: input.tokens_used,
    llm_debug: input.llm_debug,
  });
  if (!input.investigation_agenda?.length && !input.breakthrough_core.first_question) {
    return withReport;
  }
  return finalizeSegment2AgendaBridgeSuccess({
    session: withReport,
    locale,
    investigation_agenda: input.investigation_agenda,
    first_question: input.breakthrough_core.first_question ?? "",
  });
}

export function finalizeSegment2JobFailure(input: {
  session: POJUSessionState;
  locale: string;
  error?: string;
  reason?: string;
}): POJUSessionState {
  const locale = resolvePivotSessionLang(input.session, input.locale);
  const session = ensureSessionCycles(input.session);
  const agent_v2 = markCoreFailed(ensureAgentV2(session));
  const assistantMessage: POJUMessage = {
    role: "assistant",
    content: segment2CoreGenerationFailedMessage(locale, input.reason),
    timestamp: new Date().toISOString(),
    meta: {
      current_state: "collecting_context",
      user_intent: "sharing_situation",
      action_requested: "continue_chat",
      core_generation_failed: true,
      state_snapshot: buildAgentStateSnapshot(agent_v2, session.main_delivery_done),
    },
  };
  return withSessionProfileFlags({
    ...session,
    messages: [...session.messages, assistantMessage],
    agent_v2,
    last_interaction_at: new Date().toISOString(),
  });
}

/** POST create Call B job ? does not poll. */
export async function createSegment2AgendaJob(input: {
  session: POJUSessionState;
  locale: string;
  breakthrough_core: BreakthroughCore;
}): Promise<{ ok: true; job_id: string } | { ok: false; error: string; retryable?: boolean }> {
  if (typeof window === "undefined") {
    throw new Error("createSegment2AgendaJob is browser-only");
  }
  const locale = resolvePivotSessionLang(input.session, input.locale);
  const original_question =
    input.session.agent_v2?.original_question?.trim() ||
    input.session.original_question?.trim() ||
    "";
  const res = await fetch("/api/poju/breakthrough-core/agenda", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: input.session.session_id,
      locale,
      original_question,
      breakthrough_core: input.breakthrough_core,
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    job_id?: string;
    error?: string;
    retryable?: boolean;
  };
  if (!payload.job_id) {
    return {
      ok: false,
      error: payload.error || `agenda job create failed (${res.status})`,
      retryable: payload.retryable ?? true,
    };
  }
  console.info("[segment2] agenda job created", { job_id: payload.job_id });
  return { ok: true, job_id: payload.job_id };
}

/** Call B success ? append bridge question + set agenda; UI unlocks. */
export function finalizeSegment2AgendaBridgeSuccess(input: {
  session: POJUSessionState;
  locale: string;
  investigation_agenda: AgendaItem[];
  first_question: string;
  options?: string[];
  model?: string;
  tokens_used?: number;
  llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
}): POJUSessionState {
  const locale = resolvePivotSessionLang(input.session, input.locale);
  const session = ensureSessionCycles(input.session);
  const base = ensureAgentV2(session);
  if (!base.breakthrough_core) {
    return session;
  }
  const first_question = input.first_question.trim();
  const breakthrough_core: BreakthroughCore = {
    ...base.breakthrough_core,
    ...(first_question ? { first_question } : {}),
  };
  const agent_v2: POJUAgentState = {
    ...base,
    breakthrough_core,
    investigation_agenda: input.investigation_agenda,
    agenda_generated: true,
    has_situation_analysis: true,
    core_generation_failed: false,
  };

  const bridgeContent =
    first_question ||
    (locale.startsWith("zh")
      ? "先消化上方分析。接下来我们一起澄清最关键的一点。"
      : "Take your time with the analysis above. Next we will clarify the most important point together.");

  const options = sanitizeReplyOptions(input.options);

  const assistantMessage: POJUMessage = {
    role: "assistant",
    content: bridgeContent,
    timestamp: new Date().toISOString(),
    client_id: safeRandomUUID(),
    options,
    meta: {
      current_state: "collecting_context",
      user_intent: "sharing_situation",
      action_requested: "continue_chat",
      segment2_bridge_question: true,
      investigation_agenda: agent_v2.investigation_agenda ?? undefined,
      llm_model: input.model,
      llm_debug: input.llm_debug,
      tokens_used: input.tokens_used,
      state_snapshot: buildAgentStateSnapshot(agent_v2, session.main_delivery_done),
    },
  };

  return withSessionProfileFlags({
    ...session,
    messages: [...session.messages, assistantMessage],
    agent_v2,
    tokens_used: session.tokens_used + (input.tokens_used ?? 0),
    last_interaction_at: new Date().toISOString(),
  });
}

/** Call B failed ? keep A report; show regenerate-question; unlock. */
export function finalizeSegment2AgendaBridgeFailure(input: {
  session: POJUSessionState;
  locale: string;
  error?: string;
}): POJUSessionState {
  const locale = resolvePivotSessionLang(input.session, input.locale);
  const session = ensureSessionCycles(input.session);
  const agent_v2 = ensureAgentV2(session);
  const assistantMessage: POJUMessage = {
    role: "assistant",
    content: segment2AgendaBridgeFailedMessage(locale),
    timestamp: new Date().toISOString(),
    meta: {
      current_state: "collecting_context",
      user_intent: "sharing_situation",
      action_requested: "continue_chat",
      segment2_agenda_bridge_failed: true,
      state_snapshot: buildAgentStateSnapshot(agent_v2, session.main_delivery_done),
    },
  };
  return withSessionProfileFlags({
    ...session,
    messages: [...session.messages, assistantMessage],
    agent_v2,
    last_interaction_at: new Date().toISOString(),
  });
}

/** Helper for Preparing onComplete ? Call A report. */
export function applySegment2PollSuccess(
  session: POJUSessionState,
  locale: string,
  result: Extract<Segment2JobPollResult, { ok: true }>,
): POJUSessionState {
  const lang = resolvePivotSessionLang(session, locale);
  return finalizeSegment2ReportSuccess({
    session,
    locale: lang,
    breakthrough_core: result.breakthrough_core!,
    model: result.model,
    tokens_used: result.tokens_used,
    llm_debug: result.llm_debug,
  });
}

export async function startSegment2AgendaRegenerate(input: {
  session: POJUSessionState;
  locale: string;
}): Promise<{ session: POJUSessionState; job_id: string | null }> {
  const locale = resolvePivotSessionLang(input.session, input.locale);
  const session = ensureSessionCycles(input.session);
  const core = ensureAgentV2(session).breakthrough_core;
  if (!core) {
    return { session, job_id: null };
  }
  const messages = session.messages.filter(
    (m) =>
      !(
        m.role === "assistant" &&
        (m.meta?.segment2_bridge_question || m.meta?.segment2_agenda_bridge_failed)
      ),
  );
  const cleaned = { ...session, messages };
  const created = await createSegment2AgendaJob({
    session: cleaned,
    locale,
    breakthrough_core: core,
  });
  if (!created.ok) {
    return {
      session: finalizeSegment2AgendaBridgeFailure({
        session: cleaned,
        locale,
        error: created.error,
      }),
      job_id: null,
    };
  }
  return { session: cleaned, job_id: created.job_id };
}
