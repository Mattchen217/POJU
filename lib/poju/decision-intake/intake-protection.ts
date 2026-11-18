/**
 * Decision Intake 2.0 input protection and session lockout.
 * Architecture part 8: server-authoritative streak / lockout / retention.
 * State lives on the existing Session snapshot and is committed through the
 * current Session CAS. This is not a second Session database.
 */

import type { POJUSessionState } from "@/lib/poju/types";

export const INTAKE_LOCKOUT_COOLDOWN_MS = 10 * 60 * 1000;
export const INTAKE_SESSION_RETENTION_MS = 24 * 60 * 60 * 1000;
export const INTAKE_LOCKOUT_LIMIT = 3;
export const INTAKE_CONTINUE_TOKEN = "__INTAKE_CONTINUE__";

export type IntakeProtectionStatus =
  | "active"
  | "warned"
  | "locked"
  | "terminated"
  | "expired";

export type IntakeProtectionTerminalReason = "third_lockout" | "session_expired";

export type IntakeProtectionState = {
  invalid_streak: number;
  lockout_count: number;
  lockout_started_at: string | null;
  lockout_until: string | null;
  session_expires_at: string | null;
  status: IntakeProtectionStatus;
  terminal_reason?: IntakeProtectionTerminalReason;
  last_processed_turn_id?: string | null;
  last_kind?: IntakeInputKind | null;
};

export type IntakeInputKind =
  | "invalid_off_topic"
  | "invalid_gibberish"
  | "invalid_empty"
  | "invalid_unusable"
  | "valid_unknown"
  | "valid_declined"
  | "valid_skip"
  | "valid_uncertain"
  | "valid_short_relevant"
  | "valid_correction"
  | "valid_answer"
  | "continue";

export type IntakeProtectionAction =
  | "allow"
  | "warn_and_reask"
  | "lock"
  | "reject_locked"
  | "reject_terminated"
  | "expire"
  | "resume"
  | "terminate";

export type IntakeProtectionDecision = {
  state: IntakeProtectionState;
  action: IntakeProtectionAction;
  kind: IntakeInputKind;
  block_model: boolean;
  block_dc_write: boolean;
  block_pass_charge: boolean;
  allow_continue: boolean;
  idempotent_replay: boolean;
  recoverable: boolean;
};

const UNKNOWN_RE =
  /^(i\s*don'?t\s*know|不知道|不清楚|不了解|没印象|不确定|unsure|no\s*idea|暂时无法判断|不好说|说不准)(\b|$|[!。！?？\s])/i;
const DECLINED_RE =
  /^(不想说|不愿回答|不想回答|拒绝透露|decline(\b|$)|prefer\s*not|no\s*comment)/i;
const SKIP_RE = /^(跳过|skip(\b|$)|先跳过|暂时跳过)/i;
const UNCERTAIN_RE =
  /^(不确定|不好说|说不准|maybe|perhaps|not\s*sure|我也不确定|还在想|\?|？)$/i;
const CORRECTION_RE =
  /(更正|纠正|之前说错了|说错了|correction|actually\s+i\s+meant)/i;
const OFF_TOPIC_RE =
  /^(今天天气|讲个笑话|tell\s+me\s+a\s+joke|无关|天气怎么样|唱首歌|写首诗)/i;

const DEFAULT_STATE: IntakeProtectionState = {
  invalid_streak: 0,
  lockout_count: 0,
  lockout_started_at: null,
  lockout_until: null,
  session_expires_at: null,
  status: "active",
  last_processed_turn_id: null,
  last_kind: null,
};

export function emptyIntakeProtectionState(): IntakeProtectionState {
  return { ...DEFAULT_STATE };
}

export function readIntakeProtection(session: POJUSessionState | null | undefined): IntakeProtectionState {
  const raw = session?.intake_protection;
  if (!raw || typeof raw !== "object") return emptyIntakeProtectionState();
  return {
    invalid_streak: finiteCount(raw.invalid_streak),
    lockout_count: finiteCount(raw.lockout_count),
    lockout_started_at: asIso(raw.lockout_started_at),
    lockout_until: asIso(raw.lockout_until),
    session_expires_at: asIso(raw.session_expires_at),
    status: normalizeStatus(raw.status),
    ...(raw.terminal_reason === "third_lockout" || raw.terminal_reason === "session_expired"
      ? { terminal_reason: raw.terminal_reason }
      : {}),
    last_processed_turn_id:
      typeof raw.last_processed_turn_id === "string" ? raw.last_processed_turn_id : null,
    last_kind: raw.last_kind ?? null,
  };
}

function finiteCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function asIso(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function normalizeStatus(value: unknown): IntakeProtectionStatus {
  if (
    value === "active" ||
    value === "warned" ||
    value === "locked" ||
    value === "terminated" ||
    value === "expired"
  ) {
    return value;
  }
  return "active";
}

export function isInvalidIntakeKind(kind: IntakeInputKind): boolean {
  return kind.startsWith("invalid_");
}

export function isIntakeContinueStatement(statement: string): boolean {
  return statement.trim() === INTAKE_CONTINUE_TOKEN;
}

export function classifyIntakeInput(statement: string): IntakeInputKind {
  const t = statement.trim();
  if (isIntakeContinueStatement(t)) return "continue";
  if (!t) return "invalid_empty";
  if (OFF_TOPIC_RE.test(t)) return "invalid_off_topic";
  if (isGibberish(t)) return "invalid_gibberish";
  if (SKIP_RE.test(t) || t === "跳过") return "valid_skip";
  if (DECLINED_RE.test(t) || t === "不想说" || t === "不愿回答" || t === "不想回答") {
    return "valid_declined";
  }
  if (
    t === "不知道" ||
    t === "不清楚" ||
    t === "不了解" ||
    t === "没印象" ||
    t === "不确定" ||
    UNKNOWN_RE.test(t)
  ) {
    return "valid_unknown";
  }
  if (UNCERTAIN_RE.test(t)) return "valid_uncertain";
  if (CORRECTION_RE.test(t)) return "valid_correction";
  if (isUnusableNoise(t)) return "invalid_unusable";
  if (t.length < 4) return "valid_short_relevant";
  return "valid_answer";
}

function isGibberish(t: string): boolean {
  if (/^(.)\1{5,}$/.test(t)) return true;
  const compact = t.replace(/\s+/g, "");
  if (!compact) return true;
  if (/^[^\p{L}\p{N}\p{Script=Han}]+$/u.test(compact) && compact.length >= 2) return true;
  const letters = compact.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 8) {
    const unique = new Set(letters.toLowerCase()).size;
    const vowels = (letters.match(/[aeiou]/gi) ?? []).length;
    if (unique <= 3 || (vowels === 0 && letters.length >= 10)) return true;
  }
  if (/^[asdfjkl;]+$/i.test(compact) && compact.length >= 6) return true;
  return false;
}

function isUnusableNoise(t: string): boolean {
  // Pure symbol runs that cannot form an answer, excluding a lone uncertainty mark.
  if (t === "?" || t === "？") return false;
  return /^[^\p{L}\p{N}\p{Script=Han}]+$/u.test(t) && t.length >= 2;
}

export function inspectIntakeProtectionGate(
  state: IntakeProtectionState,
  nowMs: number,
): {
  action: Extract<IntakeProtectionAction, "allow" | "reject_locked" | "reject_terminated" | "expire">;
  allow_continue: boolean;
  block_model: boolean;
  expired: boolean;
} {
  if (state.status === "terminated" || state.terminal_reason === "third_lockout") {
    return { action: "reject_terminated", allow_continue: false, block_model: true, expired: false };
  }
  const expiresAt = state.session_expires_at ? Date.parse(state.session_expires_at) : Number.NaN;
  if (Number.isFinite(expiresAt) && expiresAt <= nowMs) {
    return { action: "expire", allow_continue: false, block_model: true, expired: true };
  }
  if (state.status === "expired" || state.terminal_reason === "session_expired") {
    return { action: "expire", allow_continue: false, block_model: true, expired: true };
  }
  const until = state.lockout_until ? Date.parse(state.lockout_until) : Number.NaN;
  if (state.status === "locked" && Number.isFinite(until) && until > nowMs) {
    return { action: "reject_locked", allow_continue: false, block_model: true, expired: false };
  }
  const allowContinue = state.status === "locked" && Number.isFinite(until) && until <= nowMs;
  return { action: "allow", allow_continue: allowContinue, block_model: false, expired: false };
}

export function applyIntakeProtection(input: {
  state: IntakeProtectionState;
  kind: IntakeInputKind;
  nowIso: string;
  turnId: string;
}): IntakeProtectionDecision {
  const nowMs = Date.parse(input.nowIso);
  const base = { ...input.state };
  if (base.last_processed_turn_id && base.last_processed_turn_id === input.turnId) {
    const gate = inspectIntakeProtectionGate(base, nowMs);
    return {
      state: base,
      action:
        gate.action === "allow"
          ? base.status === "warned"
            ? "warn_and_reask"
            : "allow"
          : gate.action === "expire"
            ? "expire"
            : gate.action,
      kind: base.last_kind ?? input.kind,
      block_model: true,
      block_dc_write: true,
      block_pass_charge: true,
      allow_continue: gate.allow_continue,
      idempotent_replay: true,
      recoverable: gate.action !== "reject_terminated" && gate.action !== "expire",
    };
  }

  const gate = inspectIntakeProtectionGate(base, nowMs);
  if (gate.action === "reject_terminated") {
    return decision(base, "reject_terminated", input.kind, input.turnId, {
      block_model: true,
      recoverable: false,
    });
  }
  if (gate.action === "expire") {
    const expired: IntakeProtectionState = {
      ...base,
      status: "expired",
      terminal_reason: "session_expired",
      last_processed_turn_id: input.turnId,
      last_kind: input.kind,
    };
    return decision(expired, "expire", input.kind, input.turnId, {
      block_model: true,
      recoverable: false,
    });
  }
  if (gate.action === "reject_locked") {
    return decision(base, "reject_locked", input.kind, input.turnId, {
      block_model: true,
      recoverable: true,
    });
  }

  if (input.kind === "continue") {
    if (!gate.allow_continue && base.status === "locked") {
      return decision(base, "reject_locked", input.kind, input.turnId, {
        block_model: true,
        recoverable: true,
      });
    }
    const resumed: IntakeProtectionState = {
      ...base,
      invalid_streak: 0,
      status: "active",
      lockout_until: null,
      last_processed_turn_id: input.turnId,
      last_kind: input.kind,
    };
    delete resumed.terminal_reason;
    return decision(resumed, "resume", input.kind, input.turnId, {
      block_model: true,
      block_dc_write: true,
      recoverable: true,
    });
  }

  if (!isInvalidIntakeKind(input.kind)) {
    const reset: IntakeProtectionState = {
      ...base,
      invalid_streak: 0,
      status: "active",
      lockout_until: gate.allow_continue ? null : base.lockout_until,
      last_processed_turn_id: input.turnId,
      last_kind: input.kind,
    };
    if (gate.allow_continue) reset.lockout_until = null;
    return decision(reset, "allow", input.kind, input.turnId, {
      block_model: false,
      block_dc_write: false,
      recoverable: true,
    });
  }

  const streak = base.invalid_streak + 1;
  if (streak <= 1) {
    const warned: IntakeProtectionState = {
      ...base,
      invalid_streak: streak,
      status: "warned",
      last_processed_turn_id: input.turnId,
      last_kind: input.kind,
    };
    if (gate.allow_continue) warned.lockout_until = null;
    return decision(warned, "warn_and_reask", input.kind, input.turnId, {
      block_model: true,
      recoverable: true,
    });
  }

  const lockoutCount = base.lockout_count + 1;
  const until = new Date(nowMs + INTAKE_LOCKOUT_COOLDOWN_MS).toISOString();
  const retention = new Date(nowMs + INTAKE_SESSION_RETENTION_MS).toISOString();
  if (lockoutCount >= INTAKE_LOCKOUT_LIMIT) {
    const terminated: IntakeProtectionState = {
      ...base,
      invalid_streak: 0,
      lockout_count: lockoutCount,
      lockout_started_at: input.nowIso,
      lockout_until: until,
      session_expires_at: base.session_expires_at ?? retention,
      status: "terminated",
      terminal_reason: "third_lockout",
      last_processed_turn_id: input.turnId,
      last_kind: input.kind,
    };
    return decision(terminated, "terminate", input.kind, input.turnId, {
      block_model: true,
      recoverable: false,
    });
  }

  const locked: IntakeProtectionState = {
    ...base,
    invalid_streak: 0,
    lockout_count: lockoutCount,
    lockout_started_at: input.nowIso,
    lockout_until: until,
    session_expires_at: retention,
    status: "locked",
    last_processed_turn_id: input.turnId,
    last_kind: input.kind,
  };
  delete locked.terminal_reason;
  return decision(locked, "lock", input.kind, input.turnId, {
    block_model: true,
    recoverable: true,
  });
}

function decision(
  state: IntakeProtectionState,
  action: IntakeProtectionAction,
  kind: IntakeInputKind,
  turnId: string,
  flags: {
    block_model: boolean;
    block_dc_write?: boolean;
    recoverable: boolean;
  },
): IntakeProtectionDecision {
  return {
    state: { ...state, last_processed_turn_id: turnId, last_kind: kind },
    action,
    kind,
    block_model: flags.block_model,
    block_dc_write: flags.block_dc_write ?? true,
    block_pass_charge: true,
    allow_continue: action === "lock" ? false : action === "resume",
    idempotent_replay: false,
    recoverable: flags.recoverable,
  };
}

export function withIntakeProtection(
  session: POJUSessionState,
  state: IntakeProtectionState,
): POJUSessionState {
  return { ...session, intake_protection: state };
}

export function intakeProtectionUserMessage(
  decision: IntakeProtectionDecision,
  locale: string,
  originalQuestion?: string | null,
): string {
  const zh = locale.toLowerCase().startsWith("zh");
  const question = originalQuestion?.trim();
  switch (decision.action) {
    case "warn_and_reask":
      return zh
        ? ["刚才的输入与当前问题无关，或无法形成有效回答。请针对下面的问题重新回答。", question ? `当前问题：${question}` : ""]
            .filter(Boolean)
            .join("\n")
        : [
            "That input is off-topic or cannot form a valid answer. Please answer the original question.",
            question ? `Current question: ${question}` : "",
          ]
            .filter(Boolean)
            .join("\n");
    case "lock":
    case "reject_locked": {
      const until = decision.state.lockout_until
        ? new Date(decision.state.lockout_until).toISOString()
        : "";
      return zh
        ? `当前会话已暂时锁定。冷却 10 分钟后可以继续。会话将保留 24 小时。${until ? `锁定至 ${until}（服务器时间）。` : ""}`
        : `This session is temporarily locked. You can continue after a 10-minute cooldown. The session is kept for 24 hours.${until ? ` Locked until ${until} (server time).` : ""}`;
    }
    case "terminate":
    case "reject_terminated":
      return zh
        ? "当前会话因累计三次锁定事件已永久终止。这仅适用于已披露的滥用规则，不适用于平台故障、模型故障或服务未交付。"
        : "This session has been permanently terminated after three lockout events. This applies only under the disclosed abuse rules, not to platform, model, or undelivered-service failures.";
    case "expire":
      return zh
        ? "当前会话已过期，未计入第三次锁定。请开启新的会话继续。"
        : "This session has expired. Expiry does not count as a third lockout. Please start a new session.";
    case "resume":
      return zh
        ? ["会话已恢复。请继续回答原来的问题。", question ? `当前问题：${question}` : ""]
            .filter(Boolean)
            .join("\n")
        : [
            "The session has resumed. Please continue with the original question.",
            question ? `Current question: ${question}` : "",
          ]
            .filter(Boolean)
            .join("\n");
    default:
      return question ?? "";
  }
}

export function intakeProtectionBannerMessage(
  state: IntakeProtectionState,
  locale: string,
  input?: { allow_continue?: boolean; original_question?: string | null },
): string {
  const question = input?.original_question;
  if (state.status === "terminated" || state.terminal_reason === "third_lockout") {
    return intakeProtectionUserMessage(
      {
        state,
        action: "terminate",
        kind: "invalid_empty",
        block_model: true,
        block_dc_write: true,
        block_pass_charge: true,
        allow_continue: false,
        idempotent_replay: false,
        recoverable: false,
      },
      locale,
      question,
    );
  }
  if (state.status === "expired" || state.terminal_reason === "session_expired") {
    return intakeProtectionUserMessage(
      {
        state,
        action: "expire",
        kind: "invalid_empty",
        block_model: true,
        block_dc_write: true,
        block_pass_charge: true,
        allow_continue: false,
        idempotent_replay: false,
        recoverable: false,
      },
      locale,
      question,
    );
  }
  if (state.status === "locked" && input?.allow_continue) {
    return intakeProtectionUserMessage(
      {
        state,
        action: "resume",
        kind: "valid_correction",
        block_model: false,
        block_dc_write: false,
        block_pass_charge: false,
        allow_continue: true,
        idempotent_replay: false,
        recoverable: true,
      },
      locale,
      question,
    );
  }
  if (state.status === "locked") {
    return intakeProtectionUserMessage(
      {
        state,
        action: "lock",
        kind: "invalid_empty",
        block_model: true,
        block_dc_write: true,
        block_pass_charge: true,
        allow_continue: false,
        idempotent_replay: false,
        recoverable: true,
      },
      locale,
      question,
    );
  }
  return intakeProtectionUserMessage(
    {
      state,
      action: "warn_and_reask",
      kind: "invalid_off_topic",
      block_model: true,
      block_dc_write: true,
      block_pass_charge: true,
      allow_continue: false,
      idempotent_replay: false,
      recoverable: true,
    },
    locale,
    question,
  );
}

export function mapIntakeProtectionOutcome(
  action: IntakeProtectionAction,
):
  | "intake_warned"
  | "intake_locked"
  | "intake_terminated"
  | "intake_expired"
  | "intake_continued"
  | null {
  switch (action) {
    case "warn_and_reask":
      return "intake_warned";
    case "lock":
    case "reject_locked":
      return "intake_locked";
    case "terminate":
    case "reject_terminated":
      return "intake_terminated";
    case "expire":
      return "intake_expired";
    case "resume":
      return "intake_continued";
    default:
      return null;
  }
}
