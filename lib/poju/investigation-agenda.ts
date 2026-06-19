import type { POJUAgentState } from "@/lib/poju/agent-state";
import {
  AGENDA_COVERED_GATE,
  MIN_COLLECTING_USER_TURNS,
  PUSH_GATE,
  PUSH_MIN_TURNS,
} from "@/lib/poju/agent-state";

export type AgendaItemStatus = "unexplored" | "partial" | "covered";

export interface AgendaItem {
  id: string;
  label: string;
  critical: boolean;
  status: AgendaItemStatus;
}

const AGENDA_STATUSES: AgendaItemStatus[] = ["unexplored", "partial", "covered"];

/** User asks for delivery/report mid-collection (not hard skip-ahead). */
export function detectDeliveryRequest(userMessage: string): boolean {
  return /(?:看报告|给我分析|告诉我该怎么办|现在能给结论吗|可以出结果了吗|what should I do|show me the report|give me (?:the )?(?:analysis|report|answer)|tell me what to do|ready for (?:the )?(?:analysis|report))/i.test(
    userMessage,
  );
}

/** Strong skip-ahead — allows early confirmation path. */
export function userHardPushed(userMessage: string): boolean {
  return /(?:就现在给我结果|直接给结论|不用再问了|skip ahead|just give me (?:the )?(?:result|analysis)|don'?t need more questions)/i.test(
    userMessage,
  );
}

export function evaluateAgendaCoverage(agenda: AgendaItem[]): {
  criticalLeft: number;
  coveredRatio: number;
  coveredCount: number;
  total: number;
} {
  const total = agenda.length;
  if (total === 0) {
    return { criticalLeft: 0, coveredRatio: 0, coveredCount: 0, total: 0 };
  }
  const coveredCount = agenda.filter((a) => a.status === "covered").length;
  const criticalLeft = agenda.filter((a) => a.critical && a.status !== "covered").length;
  return {
    criticalLeft,
    coveredRatio: coveredCount / total,
    coveredCount,
    total,
  };
}

export function isAgendaSatisfied(agenda: AgendaItem[]): boolean {
  if (agenda.length === 0) return false;
  const { criticalLeft, coveredRatio } = evaluateAgendaCoverage(agenda);
  return criticalLeft === 0 && coveredRatio >= AGENDA_COVERED_GATE;
}

export function parseInvestigationAgenda(raw: unknown): AgendaItem[] | null {
  if (!Array.isArray(raw) || raw.length < 4) return null;
  const items: AgendaItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!id || !label) continue;
    const statusRaw = typeof o.status === "string" ? o.status : "unexplored";
    const status = AGENDA_STATUSES.includes(statusRaw as AgendaItemStatus)
      ? (statusRaw as AgendaItemStatus)
      : "unexplored";
    items.push({
      id,
      label,
      critical: Boolean(o.critical),
      status,
    });
  }
  if (items.length < 4 || items.length > 10) return null;
  if (!items.some((a) => a.critical)) {
    items[0] = { ...items[0], critical: true };
  }
  return items;
}

export function applyAgendaStatusUpdates(
  agenda: AgendaItem[],
  updates: Record<string, unknown> | null | undefined,
): AgendaItem[] {
  if (!updates || agenda.length === 0) return agenda;
  const next = agenda.map((item) => ({ ...item }));
  for (const [id, rawStatus] of Object.entries(updates)) {
    if (typeof rawStatus !== "string") continue;
    if (!AGENDA_STATUSES.includes(rawStatus as AgendaItemStatus)) continue;
    const idx = next.findIndex((a) => a.id === id);
    if (idx < 0) continue;
    const newStatus = rawStatus as AgendaItemStatus;
    const rank = (s: AgendaItemStatus) => (s === "covered" ? 2 : s === "partial" ? 1 : 0);
    if (rank(newStatus) >= rank(next[idx].status)) {
      next[idx] = { ...next[idx], status: newStatus };
    }
  }
  return next;
}

export function extractAgendaStatusUpdates(
  contextUpdates: Record<string, unknown>,
): Record<string, unknown> | null {
  const raw = contextUpdates.agenda_status_updates;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function stripAgendaFieldsFromContextUpdates(
  contextUpdates: Record<string, unknown>,
): Record<string, unknown> {
  const { agenda_status_updates: _a, ...rest } = contextUpdates;
  return rest;
}

export function getUncoveredCriticalLabels(agenda: AgendaItem[]): string[] {
  return agenda.filter((a) => a.critical && a.status !== "covered").map((a) => a.label);
}

export function getNextAgendaFocus(agenda: AgendaItem[]): AgendaItem[] {
  const open = agenda.filter((a) => a.status !== "covered");
  const critical = open.filter((a) => a.critical);
  const pool = critical.length > 0 ? critical : open;
  return pool.slice(0, 2);
}

export function formatAgendaForPrompt(agenda: AgendaItem[]): string {
  if (agenda.length === 0) return "(议程尚未生成)";
  return agenda
    .map((a) => {
      const tag = a.critical ? "必查" : "补充";
      const status =
        a.status === "covered" ? "已覆盖" : a.status === "partial" ? "部分" : "未探";
      return `- [${tag}] ${a.label} (${a.id}) — ${status}`;
    })
    .join("\n");
}

export function computeCollectingPullback(input: {
  userMessage: string;
  agent: POJUAgentState | null | undefined;
  userTurns: number;
}): boolean {
  const { userMessage, agent } = input;
  if (!agent || agent.current_phase !== "collecting_context") return false;
  if (!detectDeliveryRequest(userMessage)) return false;
  const agenda = agent.investigation_agenda ?? [];
  if (agenda.length === 0) return true;
  return !isAgendaSatisfied(agenda);
}

export function canTransitionToConfirmation(input: {
  agent: POJUAgentState;
  userTurns: number;
  userMessage: string;
}): { allowed: boolean; reason: string } {
  const { agent, userTurns, userMessage } = input;
  const agenda = agent.investigation_agenda ?? [];
  const { coveredRatio } = evaluateAgendaCoverage(agenda);

  if (userHardPushed(userMessage) && userTurns >= PUSH_MIN_TURNS && coveredRatio >= PUSH_GATE) {
    return { allowed: true, reason: "User explicitly skipped ahead" };
  }
  if (userTurns >= MIN_COLLECTING_USER_TURNS && isAgendaSatisfied(agenda)) {
    return {
      allowed: true,
      reason: `Agenda satisfied (${Math.round(coveredRatio * 100)}%, ${userTurns} turns)`,
    };
  }
  if (userTurns < MIN_COLLECTING_USER_TURNS) {
    return {
      allowed: false,
      reason: `Requires ≥${MIN_COLLECTING_USER_TURNS} user turns (have ${userTurns})`,
    };
  }
  if (agenda.length === 0) {
    return { allowed: false, reason: "Investigation agenda not yet generated" };
  }
  const { criticalLeft } = evaluateAgendaCoverage(agenda);
  if (criticalLeft > 0) {
    return { allowed: false, reason: `${criticalLeft} critical agenda items not covered` };
  }
  return {
    allowed: false,
    reason: `Agenda coverage ${Math.round(coveredRatio * 100)}% < ${AGENDA_COVERED_GATE * 100}%`,
  };
}
