import {
  computeContextReadinessScore,
  countContextSignals,
  countUserTurns,
  getLastUserMessageContent,
} from "@/lib/poju/context-readiness";
import { resolveSessionHasProfile, shouldForceBirthForm } from "@/lib/poju/session-profile";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";
import { sanitizeResponse } from "@/lib/llm/phases/response-sanitizer";
import { sanitizerStateFromSession } from "@/lib/llm/phases/types";

const FORBIDDEN_PRE_PROFILE_TRAIT_RE =
  /(在我的感知中|天生|天赋|命盘|八字|五行|用神|木火|木的能量|命理|生命特质|草木|藤蔓|从你的生命|从.*特质来看|你其实是.{0,12}(极具|非常|很有)|(?:你|您).{0,5}(?:其实|本质上|天然).{0,15}(?:是|有|具有)|从你(?:的)?(?:个人|内在).{0,5}(?:看|来看)|Your\s+(?:natural|true|inner)\s+(?:nature|pattern|self))/i;

/** Block "I prepared your full analysis" before Step 9 delivery (Part2 Step 18 — preview only, no rewrite). */
const PREMATURE_DELIVERY_PROMISE_RE =
  /(?:已经|刚刚).{0,5}(?:为你|帮你).{0,5}(?:整理|准备|完成).{0,5}(?:一份|完整的?|详细的?)|I\s+have\s+(?:already\s+)?(?:prepared|completed|put\s+together).{0,30}(?:complete|full|detailed)/i;

const DELIVERY_SECTION_RE = /═══\s*ANALYSIS\s*═══|═══\s*CONCLUSION\s*═══|═══\s*WHAT\s+YOU\s+CAN\s+DO\s*═══/i;

export type PolicyContext = {
  session: POJUSessionState;
  profile: UserProfile | null;
  locale: string;
};

function traitGateResponse(locale: string, askBirth: boolean): string {
  const lang = locale.split("-")[0] || "en";
  if (lang === "zh") {
    const tail = askBirth
      ? "POJU 的精准分析依托八字与传统命理，需要出生年、月、日、时辰与性别（仅保存在你的设备）。请先填写，或继续用文字补充处境细节。"
      : "请先更具体地描述：当下最卡的一件事、涉及的人、你已经试过什么、你最担心什么。";
    return `在尚未具备可靠出生信息与足够事实材料之前，我不能输出「终审式」命理结论或整包行动方案——这是产品底线。\n\n${tail}`;
  }
  const tail = askBirth
    ? "POJU’s precise layer draws on BaZi and classical Chinese metaphysics; we need birth year, month, day, time of birth, and gender (stored only on your device). Please add them, or keep clarifying your situation in text."
    : "Please add more concrete facts first: what is most stuck, who is involved, what you have tried, and what you fear next.";
  return `Until birth data and enough verified context exist, I must not ship a “final verdict” style package—that is a product rule.\n\n${tail}`;
}

/**
 * 命理型主交付：必须有本地八字档案 + 足够语境；绝不按「轮数够了就交付」。
 * 跳过出生：仅允许「非个人八字」的通用主交付，且门槛更严。
 */
function mainDeliveryAllowed(
  hasProfile: boolean,
  profileSkipped: boolean,
  score: number,
  userTurns: number,
  contextSignals: number,
): boolean {
  if (!hasProfile && !profileSkipped) return false;
  if (hasProfile) {
    const structuredOk = contextSignals >= 2 || (score >= 8 && userTurns >= 6);
    return userTurns >= 5 && score >= 7 && structuredOk;
  }
  const structuredOk = contextSignals >= 3 || (score >= 8 && userTurns >= 7);
  return userTurns >= 6 && score >= 7 && structuredOk;
}

/**
 * Server-side agent policy: gates main delivery, blocks pre-profile trait hallucinations,
 * and forces birth form on deep topics when profile is missing.
 */
export function applyPojuOutputPolicies<T extends Record<string, unknown>>(parsed: T, ctx: PolicyContext): T {
  const { session, profile, locale } = ctx;
  const hasProfile = resolveSessionHasProfile(session) && Boolean(profile);
  const profileSkipped = session.profile_skipped;
  const userTurns = countUserTurns(session);
  const score = computeContextReadinessScore(session, hasProfile);
  const contextSignals = countContextSignals(session);
  const lastUser = getLastUserMessageContent(session);
  const phase = session.agent_v2?.current_phase;

  const out = { ...parsed } as Record<string, unknown>;
  let response = String(out.response ?? "");

  const forceBirthForm = shouldForceBirthForm(session, lastUser);

  if (forceBirthForm) {
    out.action_requested = "show_birth_form";
  }

  const deliveryAllowed = mainDeliveryAllowed(hasProfile, profileSkipped, score, userTurns, contextSignals);

  /** 无档案且未声明跳过：禁止任何主交付 / 命理终审块（不依赖轮数）。 */
  /** Step 9 owns full delivery; chat must not ship ANALYSIS blocks during collection. */
  if (
    phase === "collecting_context" ||
    phase === "awaiting_profile" ||
    phase === "awaiting_confirmation" ||
    phase === "greeting"
  ) {
    if (out.contains_delivery || DELIVERY_SECTION_RE.test(response)) {
      out.contains_delivery = false;
      out.main_delivery = null;
      out.new_actions = [];
      if (DELIVERY_SECTION_RE.test(response)) {
        response =
          phase === "awaiting_confirmation"
            ? traitGateResponse(locale, false)
            : traitGateResponse(locale, forceBirthForm || (!hasProfile && !profileSkipped));
      }
    }
    if (out.action_requested === "deliver_main") {
      out.action_requested = "continue_chat";
    }
  }

  if (!hasProfile && !profileSkipped) {
    if (out.contains_delivery || DELIVERY_SECTION_RE.test(response)) {
      out.contains_delivery = false;
      out.main_delivery = null;
      out.new_actions = [];
      out.action_requested = forceBirthForm ? "show_birth_form" : "continue_chat";
      if (DELIVERY_SECTION_RE.test(response)) {
        response = traitGateResponse(locale, true);
      }
    }
    if (
      FORBIDDEN_PRE_PROFILE_TRAIT_RE.test(response) ||
      (!session.main_delivery_done && PREMATURE_DELIVERY_PROMISE_RE.test(response))
    ) {
      response = traitGateResponse(locale, forceBirthForm || out.action_requested === "show_birth_form");
      out.contains_delivery = false;
      out.main_delivery = null;
      out.new_actions = [];
      out.current_state = "collecting_context";
      if (!forceBirthForm) out.action_requested = (out.action_requested as string) || "continue_chat";
    }
    response = sanitizeResponse(response, sanitizerStateFromSession(session));
  }

  if (!hasProfile && !profileSkipped && out.action_requested === "deliver_main") {
    out.action_requested = forceBirthForm ? "show_birth_form" : "continue_chat";
  }

  if (out.contains_delivery && !deliveryAllowed) {
    out.contains_delivery = false;
    out.main_delivery = null;
    out.new_actions = [];
    if (out.action_requested === "deliver_main") {
      out.action_requested = "continue_chat";
    }
    if (out.current_state === "delivered") {
      out.current_state = hasProfile ? "analyzing" : profileSkipped ? "analyzing" : "collecting_context";
    }
    if (typeof response === "string" && DELIVERY_SECTION_RE.test(response)) {
      response = traitGateResponse(locale, forceBirthForm || (!hasProfile && !profileSkipped));
    }
  }

  if (out.action_requested === "deliver_main" && !deliveryAllowed) {
    out.action_requested = "continue_chat";
  }

  out.response = response;

  const thought = out.thought as Record<string, unknown> | undefined;
  if (thought && typeof thought === "object") {
    thought.current_context_score = score;
    thought.missing_keys = Array.isArray(thought.missing_keys) ? thought.missing_keys : [];
    if (!hasProfile && !profileSkipped) {
      thought.missing_keys = Array.from(
        new Set([...(thought.missing_keys as string[]), "birth_year_month_day_hour_gender_required"]),
      );
    }
    const ar = out.action_requested;
    if (ar === "continue_chat" || ar === "show_birth_form" || ar === "deliver_main" || ar === "track_progress") {
      if (ar === "deliver_main" && !deliveryAllowed) {
        thought.next_best_action = "continue_chat";
      } else {
        thought.next_best_action = ar;
      }
    } else {
      thought.next_best_action = "continue_chat";
    }
  }

  return out as T;
}
