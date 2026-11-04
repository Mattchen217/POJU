/**
 * Derive pipeline_cursor + next-step hint from ops chat_session.
 */

import { normalizeAgentPhase } from "@/lib/poju/agent-state";
import type { POJUSessionState } from "@/lib/poju/types";
import type { LabPipelineCursor } from "@/lib/llm/pro/delivery/lab/lab-pipeline-types";
import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";

export function derivePipelineCursor(lab: DeliveryLabSession): LabPipelineCursor {
  if (lab.pipeline_delivery_unlocked) return "ready_for_delivery";
  const pending = lab.pipeline_pending_job;
  if (pending?.stage === "synthesis") return "synthesis";
  if (pending?.stage === "segment2_a" || pending?.stage === "segment2_b") {
    return "segment2";
  }
  const session = lab.chat_session;
  if (!session) return lab.pipeline_cursor ?? "opening";
  const phase = normalizeAgentPhase(session.agent_v2?.current_phase) ?? "opening";
  switch (phase) {
    case "opening":
      return "opening";
    case "awaiting_understanding_confirm":
      return "awaiting_understanding";
    case "collecting_context": {
      if (!session.agent_v2?.breakthrough_core) return "segment2";
      // LAB split: analysis first; agenda+first Q only after ops clicks Next.
      if (!session.agent_v2.agenda_generated) return "awaiting_agenda";
      return "collecting";
    }
    case "awaiting_confirmation":
      return "awaiting_confirmation";
    case "delivered":
    case "tracking":
      return "ready_for_delivery";
    default:
      return "opening";
  }
}

export function pipelineNextHint(
  cursor: LabPipelineCursor,
  session: POJUSessionState | undefined,
): string {
  const path = session?.pivot_chart_path ?? "unset";
  switch (cursor) {
    case "opening":
      return `Opening · path=${path} · 继续对话或点芯片；够了会进理解确认门`;
    case "awaiting_understanding":
      return `理解门 · path=${path} · 点「确认」起 Call A，或补充说明`;
    case "segment2":
      return `Segment2 · path=${path} · 等 Call A 完成（可轮询 job）`;
    case "awaiting_agenda":
      return `分析已出 · path=${path} · 点「下一步」跑议程起草 + 首问（Call B）`;
    case "collecting":
      return `Collecting · path=${path} · 答议程 / 点芯片；够了进汇总确认`;
    case "awaiting_confirmation":
      return `汇总确认门 · path=${path} · 点确认起 Synthesis`;
    case "synthesis":
      return `Synthesis 运行中 · path=${path}`;
    case "ready_for_delivery":
      return `已解锁交付步骤 · path=${path} · 下方 Run / Approve`;
    default:
      return "";
  }
}

/**
 * Composer chips for the latest assistant turn only (parity with POJUChatUI).
 * Do NOT walk back to an older assistant bubble — that resurfaces stale Opening
 * chips after Call B / collecting when the new turn omitted options.
 */
export function lastAssistantOptions(session: POJUSessionState | undefined): string[] {
  if (!session?.messages?.length) return [];
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const m = session.messages[i];
    if (!m || m.role !== "assistant") continue;
    if (m.meta?.options_consumed) return [];
    if (!Array.isArray(m.options) || m.options.length === 0) return [];
    return m.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0);
  }
  return [];
}
