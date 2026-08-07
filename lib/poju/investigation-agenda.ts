import type { POJUAgentState } from "@/lib/poju/agent-state";
import {
  AGENDA_COVERED_GATE,
  MIN_COLLECTING_USER_TURNS,
  PUSH_GATE,
  PUSH_MIN_TURNS,
} from "@/lib/poju/agent-state";

export type AgendaItemStatus = "unexplored" | "partial" | "covered";

export type AgendaFrameKind = "key_crossroads" | "modern_action" | "energy_retune";

export interface AgendaItem {
  id: string;
  label: string;
  critical: boolean;
  status: AgendaItemStatus;
  /**
   * Call B: which scheme-skeleton frame this agenda item validates.
   * Prefer this over text-matching `supports`.
   */
  frame_kind?: AgendaFrameKind;
  /** 1-based index into modern_action_frames when frame_kind === "modern_action". */
  frame_index?: number;
  /** Which breakthrough hypothesis this item validates (hidden from user response). */
  supports?: string;
  /** Collecting turns on this item without reaching covered (control-plane stale detection). */
  stale_turns?: number;
}

/** Pending turns before control plane injects a catch-up directive. */
export const STALE_AGENDA_TURN_THRESHOLD = 2;

const AGENDA_STATUSES: AgendaItemStatus[] = ["unexplored", "partial", "covered"];

const FRAME_KINDS: AgendaFrameKind[] = ["key_crossroads", "modern_action", "energy_retune"];

/** Parse frame_kind from LLM JSON (or legacy aliases). */
export function parseAgendaFrameKind(raw: unknown): AgendaFrameKind | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (FRAME_KINDS.includes(t as AgendaFrameKind)) return t as AgendaFrameKind;
  if (t === "crossroads" || t === "key_crossroad" || t === "spirit_gifts" || t.includes("crossroad") || t.includes("抉择") || t.includes("神煞")) {
    return "key_crossroads";
  }
  if (t === "action" || t === "modern_action_frame" || t.includes("action") || t.includes("行动")) {
    return "modern_action";
  }
  if (t === "retune" || t === "energy" || t === "metaphysics_action" || t === "energy_base" || t.includes("retune") || t.includes("调频") || t.includes("能量") || t.includes("玄学")) {
    return "energy_retune";
  }
  return undefined;
}

/** Parse 1-based frame_index from LLM JSON (number or numeric string). */
export function parseAgendaFrameIndex(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 9) {
    return raw;
  }
  if (typeof raw === "string") {
    const m = raw.trim().match(/^([1-9])(?:\s*[.．、)]?)?$/);
    if (m) return Number(m[1]);
    const loose = raw.trim().match(/(?:方向|action|frame|direction)\s*([1-9一二三])/i);
    if (loose) {
      const map: Record<string, number> = { "1": 1, "2": 2, "3": 3, 一: 1, 二: 2, 三: 3 };
      return map[loose[1]!] ?? undefined;
    }
  }
  return undefined;
}

/** @deprecated Use parseAgendaFrameIndex — kept for transitional callers. */
export function parseAgendaDirectionIndex(raw: unknown): number | undefined {
  return parseAgendaFrameIndex(raw);
}

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

/** Covered agenda items for final-delivery spine evidence block. */
export function buildCoveredAgendaEvidence(
  agent: POJUAgentState | null | undefined,
): Array<{ label: string; answer?: string }> {
  const agenda = agent?.investigation_agenda ?? [];
  return agenda
    .filter((a) => a.status === "covered")
    .map((a) => ({ label: a.label }));
}

export function isAgendaSatisfied(agenda: AgendaItem[]): boolean {
  if (agenda.length === 0) return false;
  const { criticalLeft, coveredRatio } = evaluateAgendaCoverage(agenda);
  return criticalLeft === 0 && coveredRatio >= AGENDA_COVERED_GATE;
}

export function parseInvestigationAgenda(raw: unknown): AgendaItem[] | null {
  if (!Array.isArray(raw) || raw.length < 3) return null;
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
    const frame_kind =
      parseAgendaFrameKind(o.frame_kind) ??
      parseAgendaFrameKind(o.skeleton_type) ??
      (o.direction_index != null || o.frame_index != null ? "modern_action" : undefined);
    const frame_index =
      parseAgendaFrameIndex(o.frame_index) ?? parseAgendaFrameIndex(o.direction_index);
    items.push({
      id,
      label,
      critical: Boolean(o.critical),
      status,
      ...(frame_kind != null ? { frame_kind } : {}),
      ...(frame_index != null ? { frame_index } : {}),
      supports: typeof o.supports === "string" ? o.supports.trim() : "",
    });
  }
  if (items.length < 3 || items.length > 6) return null;
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

/** Every agenda item must be covered before confirmation — no skipped angles. */
export function isAgendaFullyCovered(agenda: AgendaItem[]): boolean {
  if (agenda.length === 0) return false;
  return agenda.every((a) => a.status === "covered");
}

/** User-side catch-up when an angle has been pending too long. */
export function buildStaleAgendaCatchupBlock(
  agent: POJUAgentState | null | undefined,
  locale: string,
): string {
  const agenda = agent?.investigation_agenda ?? [];
  const stale = agenda
    .filter((a) => a.status !== "covered" && (a.stale_turns ?? 0) >= STALE_AGENDA_TURN_THRESHOLD)
    .sort((a, b) => (b.stale_turns ?? 0) - (a.stale_turns ?? 0));
  if (stale.length === 0) return "";
  const label = stale[0]!.label;
  if (locale.startsWith("zh")) {
    return `【控制面指令】议程中「${label}」尚未真正聊到，本轮请聚焦补上它，不要跳过。`;
  }
  return `[Control plane] Agenda item "${label}" has not been substantively covered — focus on it this turn; do not skip.`;
}

/** Single agenda focus: longest-stale pending first, then critical, then agenda order. */
export function selectCurrentAgendaFocus(agenda: AgendaItem[]): AgendaItem | null {
  const pendingItems = agenda.filter((a) => a.status !== "covered");
  if (pendingItems.length === 0) return null;
  const ranked = [...pendingItems].sort((a, b) => {
    const staleDiff = (b.stale_turns ?? 0) - (a.stale_turns ?? 0);
    if (staleDiff !== 0) return staleDiff;
    const critDiff = (b.critical ? 1 : 0) - (a.critical ? 1 : 0);
    if (critDiff !== 0) return critDiff;
    return agenda.indexOf(a) - agenda.indexOf(b);
  });
  return ranked[0] ?? null;
}

export function getNextAgendaFocus(agenda: AgendaItem[]): AgendaItem[] {
  const open = agenda.filter((a) => a.status !== "covered");
  const critical = open.filter((a) => a.critical);
  const pool = critical.length > 0 ? critical : open;

  const frameKey = (item: AgendaItem): string | undefined => {
    if (item.frame_kind === "modern_action" && item.frame_index != null) {
      return `frame:modern_action:${item.frame_index}`;
    }
    if (item.frame_kind) return `frame:${item.frame_kind}`;
    return item.supports?.trim() || undefined;
  };

  const uncoveredByHypothesis = new Map<string, number>();
  for (const item of agenda) {
    if (!item.critical) continue;
    const key = frameKey(item);
    if (!key || item.status === "covered") continue;
    uncoveredByHypothesis.set(key, (uncoveredByHypothesis.get(key) ?? 0) + 1);
  }

  if (uncoveredByHypothesis.size > 0) {
    const rankedHypotheses = [...uncoveredByHypothesis.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([k]) => k);
    const prioritized: AgendaItem[] = [];
    for (const hyp of rankedHypotheses) {
      for (const item of pool) {
        if (frameKey(item) === hyp) prioritized.push(item);
      }
    }
    if (prioritized.length > 0) return prioritized.slice(0, 2);
  }

  return pool.slice(0, 2);
}

export function formatAgendaForPrompt(agenda: AgendaItem[]): string {
  if (agenda.length === 0) return "(议程尚未生成)";
  return agenda
    .map((a) => {
      const tag = a.critical ? "必查" : "补充";
      const status =
        a.status === "covered" ? "已覆盖" : a.status === "partial" ? "部分" : "未探";
      const supportNote =
        a.frame_kind === "modern_action" && a.frame_index != null
          ? ` · 行动骨架#${a.frame_index}`
          : a.frame_kind
            ? ` · ${a.frame_kind}`
            : a.supports?.trim()
              ? ` · 支撑「${a.supports}」`
              : "";
      return `- [${tag}] ${a.label} (${a.id}) — ${status}${supportNote}`;
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
