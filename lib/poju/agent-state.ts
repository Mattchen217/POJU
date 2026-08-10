/**
 * POJU Agent state machine (v5 Step B: opening → collecting → confirmation → delivery → tracking).
 */

import { type CollectionProgress, type DeliveryMode } from "@/lib/poju/collection-progress";
import {
  canTransitionToConfirmation,
  computeCollectingPullback,
  type AgendaItem,
} from "@/lib/poju/investigation-agenda";
import { classifyStallOfferReply } from "@/lib/poju/stall-offer-routing";
import type { POJUAction } from "@/lib/poju/types";

export type { AgendaItem } from "@/lib/poju/investigation-agenda";
export type AgendaItemStatus = import("@/lib/poju/investigation-agenda").AgendaItemStatus;

export type AgentPhase =
  | "opening"
  | "awaiting_understanding_confirm"
  | "collecting_context"
  | "awaiting_confirmation"
  | "delivered"
  | "tracking";

/** Persisted v4 phase values normalized on read. */
export type LegacyAgentPhase = "greeting" | "awaiting_profile";

export function normalizeAgentPhase(phase: string | null | undefined): AgentPhase | null {
  if (!phase) return null;
  switch (phase) {
    case "greeting":
      return "opening";
    case "awaiting_profile":
      return "collecting_context";
    case "opening":
    case "awaiting_understanding_confirm":
    case "collecting_context":
    case "awaiting_confirmation":
    case "delivered":
    case "tracking":
      return phase;
    default:
      return null;
  }
}

export interface ContextCollection {
  duration: string | null;
  trigger_event: string | null;
  emotional_state: string | null;
  what_tried: string[];
  desired_outcome: string | null;
  category_specific: Record<string, unknown>;
}

/** Segment 1 output — concrete dilemma structure (no length cap; all sub-fields required to pass gate). */
export interface CoreDilemma {
  concrete_event: string | null;
  stakes: string | null;
  sticking_point: string | null;
}

/** Segment 1 output — what the user wants to move toward (actively elicited in opening). */
export interface DesiredDirection {
  wants: string | null;
  priority: string | null;
}

export type QuestionCategory =
  | "career"
  | "relationship"
  | "wealth"
  | "health"
  | "family"
  | "decision"
  | "interpersonal"
  | "other"
  | null;

export interface ContextSummary {
  generated_at: string;
  category: string;
  sections: Array<{
    section_id: string;
    title: string;
    items: Array<{
      item_id: string;
      label: string;
      value: string;
      field_key: string;
    }>;
  }>;
}

/** Hypothesis status for action / retune frames — evolves during collecting. */
export type FrameHypothesisStatus = "hypothesis" | "reinforced" | "selected" | "weakened";

export type SkeletonFrameKind = "key_crossroads" | "modern_action" | "energy_retune";

/** B段:关键抉择骨架 */
export interface KeyCrossroadsFrame {
  real_fork: string;
  path_costs: string;
  decision_traits: string;
  structural_basis: string;
  needs_validation: string;
}

/** C段:现代行动方案骨架 */
export interface ModernActionFrame {
  direction: string;
  why_fits: string;
  structural_basis: string;
  needs_validation: string;
  status?: FrameHypothesisStatus;
}

/** 一个命理维度的真算结果(发散层,L-a)。 */
export interface DimensionReckoning {
  /** 维度名,如 "十神格局" / "身强弱+用神" / "大运" / "财星" / "性情"。 */
  dimension: string;
  /** 命理依据(真词,内部用;输出软译由下游负责)。 */
  chart_basis: string;
  /** 这个维度针对用户问题得出的判断。 */
  judgment: string;
}

/** D段:能量调频方案骨架 */
export interface EnergyRetuneFrame {
  direction_fit: string;
  timing_ripeness: string;
  daily_retune: string;
  complementary: string;
  structural_basis: string;
  needs_validation: string;
  status?: FrameHypothesisStatus;
}

/** E段:30天节奏骨架 */
export interface RhythmFrame {
  phase1_observe: string;
  phase2_adjust: string;
  phase3_consolidate: string;
}

/**
 * 破局方案骨架：深测算一次产出、随收集演进、最后喂入交付。session 内持久。
 * 骨架 = 方向 + 命理为什么 + 需验证什么；不含具体行动步骤。
 */
export interface BreakthroughCore {
  /** 能量结构：本质/补给消耗/格局感/当前环境（交付 foundation 论证取此）。 */
  energy_structure?: string;
  situation_conclusion: string;
  /**
   * Call A user-facing dialogue (处境复盘 + 定调 + 引出收集).
   * Skeletons stay backend; Segment 2 shows this, not action-frame cards.
   */
  response?: string;
  key_crossroads: KeyCrossroadsFrame;
  modern_action_frames: ModernActionFrame[];
  /** L-a: 多维真算——按问题类型,从多个命理维度分别得出的判断(发散,不收敛)。 */
  multi_dimension_reckoning?: DimensionReckoning[];
  /** 收敛后的主路径(最建议走的那一条,直面 desired_outcome)。 */
  primary_path?: ModernActionFrame;
  /** 辅路径(主路径落不了地时的退路,同一目标的备选实现)。 */
  backup_path?: ModernActionFrame;
  energy_retune_frame: EnergyRetuneFrame;
  rhythm_frame: RhythmFrame;
  self_check_signals: string[];
  /**
   * Layer-1 玄学实操料（方位/择时/色彩/行业属性/贵人 + 五行归一）.
   * Deterministic — attached after Call A; consumed by P1/P6/P7 finalize.
   */
  metaphysics_pack?: import("@/lib/calculations/metaphysics-pack").MetaphysicsPack;
  /** Convenience mirror of metaphysics_pack.element_scores (0–100). */
  element_scores?: import("@/lib/calculations/metaphysics-pack").ElementScoreMap;
  /**
   * Model-written warm opening question for the first agenda item
   * (user-facing; not the internal agenda label).
   */
  first_question?: string;
  generated_at: string;
  evolved_at?: string;
}

function parseFrameStatus(raw: unknown): FrameHypothesisStatus | undefined {
  return raw === "hypothesis" ||
    raw === "reinforced" ||
    raw === "selected" ||
    raw === "weakened"
    ? raw
    : undefined;
}

function parseKeyCrossroadsPatch(raw: unknown): Partial<KeyCrossroadsFrame> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const out: Partial<KeyCrossroadsFrame> = {};
  for (const k of [
    "real_fork",
    "path_costs",
    "decision_traits",
    "structural_basis",
    "needs_validation",
  ] as const) {
    if (typeof row[k] === "string" && row[k].trim()) out[k] = row[k].trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}

function parseEnergyRetunePatch(raw: unknown): Partial<EnergyRetuneFrame> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const out: Partial<EnergyRetuneFrame> = {};
  for (const k of [
    "direction_fit",
    "timing_ripeness",
    "daily_retune",
    "complementary",
    "structural_basis",
    "needs_validation",
  ] as const) {
    if (typeof row[k] === "string" && row[k].trim()) out[k] = row[k].trim();
  }
  const status = parseFrameStatus(row.status);
  if (status) out.status = status;
  return Object.keys(out).length > 0 ? out : null;
}

function parseRhythmPatch(raw: unknown): Partial<RhythmFrame> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const out: Partial<RhythmFrame> = {};
  for (const k of ["phase1_observe", "phase2_adjust", "phase3_consolidate"] as const) {
    if (typeof row[k] === "string" && row[k].trim()) out[k] = row[k].trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Parse collecting-phase `breakthrough_core_updates`. */
export function parseBreakthroughCoreUpdatesFromLlm(raw: unknown): Partial<BreakthroughCore> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<BreakthroughCore> = {};

  const situation =
    (typeof o.situation_conclusion === "string" && o.situation_conclusion.trim()) ||
    (typeof o.relationship_conclusion === "string" && o.relationship_conclusion.trim()) ||
    "";
  if (situation) out.situation_conclusion = situation;

  if (typeof o.response === "string" && o.response.trim()) {
    out.response = o.response.trim();
  }

  if (typeof o.energy_structure === "string" && o.energy_structure.trim()) {
    out.energy_structure = o.energy_structure.trim();
  }

  if (typeof o.first_question === "string" && o.first_question.trim()) {
    out.first_question = o.first_question.trim();
  }

  const crossroads = parseKeyCrossroadsPatch(o.key_crossroads);
  if (crossroads) out.key_crossroads = crossroads as KeyCrossroadsFrame;

  const framesRaw = o.modern_action_frames ?? o.breakthrough_directions ?? o.revised_directions;
  if (Array.isArray(framesRaw) && framesRaw.length > 0) {
    const frames: ModernActionFrame[] = [];
    for (const entry of framesRaw) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const direction = typeof row.direction === "string" ? row.direction.trim() : "";
      if (!direction) continue;
      frames.push({
        direction,
        why_fits: typeof row.why_fits === "string" ? row.why_fits.trim() : "",
        structural_basis:
          typeof row.structural_basis === "string" ? row.structural_basis.trim() : "",
        needs_validation:
          typeof row.needs_validation === "string"
            ? row.needs_validation.trim()
            : typeof row.what_would_confirm === "string"
              ? row.what_would_confirm.trim()
              : "",
        status: parseFrameStatus(row.status),
      });
    }
    if (frames.length > 0) out.modern_action_frames = frames;
  }

  // 多维真算(L-a)
  if (Array.isArray(o.multi_dimension_reckoning)) {
    const dims: DimensionReckoning[] = [];
    for (const entry of o.multi_dimension_reckoning) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const dimension = typeof e.dimension === "string" ? e.dimension.trim() : "";
      const judgment = typeof e.judgment === "string" ? e.judgment.trim() : "";
      if (!dimension || !judgment) continue;
      dims.push({
        dimension,
        chart_basis: typeof e.chart_basis === "string" ? e.chart_basis.trim() : "",
        judgment,
      });
    }
    if (dims.length > 0) out.multi_dimension_reckoning = dims;
  }

  // 主/辅路径:收敛后的单条,复用 ModernActionFrame 结构。
  const pickFrame = (v: unknown): ModernActionFrame | undefined => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    const e = v as Record<string, unknown>;
    if (typeof e.direction !== "string" || !e.direction.trim()) return undefined;
    return {
      direction: e.direction.trim(),
      why_fits: typeof e.why_fits === "string" ? e.why_fits.trim() : "",
      structural_basis:
        typeof e.structural_basis === "string" ? e.structural_basis.trim() : "",
      needs_validation:
        typeof e.needs_validation === "string"
          ? e.needs_validation.trim()
          : typeof e.what_would_confirm === "string"
            ? e.what_would_confirm.trim()
            : "",
      status: parseFrameStatus(e.status),
    };
  };
  {
    const p = pickFrame(o.primary_path);
    const b = pickFrame(o.backup_path);
    if (p) out.primary_path = p;
    if (b) out.backup_path = b;
  }

  const retune = parseEnergyRetunePatch(o.energy_retune_frame);
  if (retune) out.energy_retune_frame = retune as EnergyRetuneFrame;

  const rhythm = parseRhythmPatch(o.rhythm_frame);
  if (rhythm) out.rhythm_frame = rhythm as RhythmFrame;

  if (Array.isArray(o.self_check_signals)) {
    const signals = o.self_check_signals
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim());
    if (signals.length > 0) out.self_check_signals = signals;
  }

  return Object.keys(out).length > 0 ? out : null;
}

/** Merge collecting-round spine updates; sets evolved_at. */
export function mergeBreakthroughCoreUpdates(
  base: BreakthroughCore,
  updates: Partial<BreakthroughCore>,
): BreakthroughCore {
  const now = new Date().toISOString();

  let modern_action_frames = [...base.modern_action_frames];
  if (Array.isArray(updates.modern_action_frames)) {
    for (const patch of updates.modern_action_frames) {
      const idx = modern_action_frames.findIndex((d) => d.direction === patch.direction);
      if (idx >= 0) {
        modern_action_frames[idx] = {
          ...modern_action_frames[idx],
          ...patch,
          direction: patch.direction || modern_action_frames[idx].direction,
        };
      }
    }
  }

  const key_crossroads: KeyCrossroadsFrame = updates.key_crossroads
    ? { ...base.key_crossroads, ...updates.key_crossroads }
    : base.key_crossroads;

  const energy_retune_frame: EnergyRetuneFrame = updates.energy_retune_frame
    ? { ...base.energy_retune_frame, ...updates.energy_retune_frame }
    : base.energy_retune_frame;

  const rhythm_frame: RhythmFrame = updates.rhythm_frame
    ? { ...base.rhythm_frame, ...updates.rhythm_frame }
    : base.rhythm_frame;

  const primary_path = updates.primary_path ?? base.primary_path;
  const backup_path = updates.backup_path ?? base.backup_path;
  const multi_dimension_reckoning =
    updates.multi_dimension_reckoning?.length
      ? updates.multi_dimension_reckoning
      : base.multi_dimension_reckoning;

  return {
    energy_structure: updates.energy_structure?.trim() || base.energy_structure,
    situation_conclusion: updates.situation_conclusion?.trim() || base.situation_conclusion,
    response: updates.response?.trim() || base.response,
    key_crossroads,
    modern_action_frames,
    ...(multi_dimension_reckoning?.length ? { multi_dimension_reckoning } : {}),
    primary_path,
    backup_path,
    energy_retune_frame,
    rhythm_frame,
    self_check_signals: updates.self_check_signals?.length
      ? updates.self_check_signals
      : base.self_check_signals,
    metaphysics_pack: updates.metaphysics_pack ?? base.metaphysics_pack,
    element_scores: updates.element_scores ?? base.element_scores,
    first_question: updates.first_question?.trim() || base.first_question,
    generated_at: base.generated_at,
    evolved_at: now,
  };
}

export interface POJUAgentState {
  current_phase: AgentPhase;
  original_question: string;
  selected_profile_id: string | null;
  has_base_analysis: boolean;
  profile_skipped: boolean;
  question_category: QuestionCategory;
  context_collected: ContextCollection;
  collection_completeness: number;
  current_summary: ContextSummary | null;
  has_situation_analysis: boolean;
  actions: POJUAction[];
  main_delivery_at: string | null;
  main_delivery_data: unknown | null;
  /** Total agent turns (legacy counter). */
  turn_count: number;
  /** Effective Q&A rounds while in collecting_context (code-maintained). */
  collecting_turn_count: number;
  /** Substantive user turns while in opening (control-plane threshold for entering collecting). */
  opening_substantive_turns?: number;
  /**
   * Consecutive vague / zero-help answers while in opening (1–4 escalation).
   * Reset on a clear reply that yields field gain.
   */
  opening_unqualified_streak?: number;
  /**
   * ISO timestamp when L4 unqualified escalation locked the composer.
   * Client starts a 5-minute wipe timer from this value.
   */
  escalation_locked_at?: string | null;
  /** Why the composer was locked (currently only unqualified L4). */
  escalation_lock_reason?: "unqualified_l4" | null;
  /** Consecutive stalled/resistant collecting rounds (resets on advancing). */
  stall_count: number;
  /** full = normal confirm path; degraded = stop-loss path (Step 3 delivery). */
  delivery_mode: import("@/lib/poju/collection-progress").DeliveryMode | null;
  /** Set when stop-loss hard rule fires; Step 3 reads this to run degraded delivery. */
  stop_loss_triggered: boolean;
  /** User sees stall-offer binary choice (no summary form). */
  stall_offer_pending: boolean;
  /** Next collecting turn uses low-barrier re-engagement prompt. */
  resume_collecting_low_barrier: boolean;
  tokens_used: number;
  phase_history: Array<{
    from_phase: AgentPhase;
    to_phase: AgentPhase;
    triggered_at: string;
    reason: string;
  }>;
  /** Custom investigation angles — generated once on first collecting turn. */
  investigation_agenda: AgendaItem[];
  /** When true, investigation_agenda must never be regenerated. */
  agenda_generated: boolean;
  /** 破局推理脊柱（深测算产出，收集演进，交付消费）。null = 尚未深测算。 */
  breakthrough_core: BreakthroughCore | null;
  /** Segment 1 — core dilemma (event + stakes + sticking point). Control-plane gate input. */
  core_dilemma: CoreDilemma | null;
  /** Segment 1 — desired direction (wants + priority). Control-plane gate input. */
  desired_direction: DesiredDirection | null;
  /** Segment 3 — per-agenda collected detail (reserved; not filled in segment 1). */
  agenda_collection_detail?: Record<string, string> | null;
  /** Segment 4 — delivery report artifact (reserved; populated by delivery pipeline). */
  delivery_report?: unknown | null;
  /** Term/relation ids already anchored in visible assistant replies this session. */
  anchored_fact_ids?: string[];
  /** Distinctive metaphor / imagery phrases already used this session. */
  used_metaphors?: string[];
  /** Segment 2 breakthrough-core failed after user confirmed understanding — retry without reopening. */
  core_generation_failed?: boolean;
  /** Composer attachments enabled after first non-out-of-scope opening turn. */
  attachments_unlocked?: boolean;
}

/** Minimum effective user turns before confirmation (agenda-driven gate). */
export const MIN_COLLECTING_USER_TURNS = 3;
/** Strong skip-ahead — minimum user turns. */
export const PUSH_MIN_TURNS = 2;
/** Strong skip-ahead — minimum agenda coverage ratio. */
export const PUSH_GATE = 0.6;
/** Overall agenda coverage required for normal confirmation. */
export const AGENDA_COVERED_GATE = 1;
/** @deprecated Display only — no longer used as delivery gate. */
export const COLLECTION_COMPLETE_GATE = 0.85;
/** @deprecated Use PUSH_MIN_TURNS. */
export const MIN_USER_PUSH_TURNS = PUSH_MIN_TURNS;
/** @deprecated Use PUSH_GATE. */
export const USER_PUSH_COMPLETE_GATE = PUSH_GATE;
/** Distinct category fields needed for full category slice of completeness score. */
export const MIN_CATEGORY_FIELDS_FOR_FULL = 6;

export { detectDeliveryRequest, userHardPushed } from "@/lib/poju/investigation-agenda";

/** @deprecated Use userHardPushed. */
export function userExplicitlySkippedAhead(userMessage: string): boolean {
  return /(?:就现在给我结果|直接给结论|不用再问了|skip ahead|just give me (?:the )?(?:result|analysis)|don'?t need more questions)/i.test(
    userMessage,
  );
}

export const REQUIRED_FIELDS_BY_CATEGORY: Record<string, string[]> = {
  career: [
    "current_role",
    "years_experience",
    "industry",
    "specific_issue",
    "duration_of_issue",
    "workplace_relationships",
    "financial_situation",
    "family_support",
    "desired_outcome",
  ],
  relationship: [
    "relationship_type",
    "relationship_duration",
    "specific_issue",
    "frequency",
    "key_incidents",
    "tried_to_resolve",
    "other_party_perspective",
    "commitment_level",
    "desired_outcome",
  ],
  wealth: [
    "current_situation",
    "specific_concern",
    "income_source",
    "debts",
    "investments",
    "risk_tolerance",
    "time_horizon",
    "family_obligations",
    "desired_outcome",
  ],
  health: [
    "health_concern",
    "duration",
    "severity",
    "lifestyle_factors",
    "tried_treatments",
    "stress_level",
    "family_history",
    "desired_outcome",
  ],
  family: [
    "family_member",
    "specific_issue",
    "duration",
    "tried_approaches",
    "other_members_involved",
    "cultural_context",
    "desired_outcome",
  ],
  decision: [
    "decision_topic",
    "options",
    "deadline",
    "stakes",
    "who_else_affected",
    "gut_feeling",
    "fears",
    "desired_outcome",
  ],
  interpersonal: ["situation", "people_involved", "duration", "specific_incidents", "tried", "desired_outcome"],
  other: ["situation_description", "duration", "context", "tried", "desired_outcome"],
};

function isFilled(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return !Number.isNaN(v);
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

/** Placeholder / unknown markers — treated as unfilled for the understanding gate. */
export const UNDERSTANDING_PLACEHOLDER_RE =
  /^(尚未明确|待追问|待确认|待补充|未明确|不明确|尚不清楚|暂无|暂未|未知|待定|n\/?a|tbd|unknown|unclear|to be determined)/i;

/** Substantive fill check for understanding-gate (rejects empty, placeholders, ultra-short). */
export function isUnderstandingFieldFilled(s?: string | null): boolean {
  const t = (s ?? "").trim();
  if (t.length === 0) return false;
  if (UNDERSTANDING_PLACEHOLDER_RE.test(t)) return false;
  if (t.length < 4) return false;
  return true;
}

/** Any non-empty draft from the model — may include placeholders; stored incrementally, not gate credit. */
function hasUnderstandingFieldDraft(s?: string | null): boolean {
  return Boolean(s && s.trim().length > 0);
}

function normalizePatchKey(k: string): string {
  return k
    .toLowerCase()
    .replace(/[\s"'""''`、]/g, "")
    .replace(/[^\w\u4e00-\u9fff]/g, "");
}

/** Fuzzy field pick — tolerates translated / corrupted JSON keys (e.g. w蚂蚁, 行动). */
export function pickUnderstandingPatchField(
  o: Record<string, unknown>,
  aliases: readonly string[],
  opts?: { keyPrefix?: string },
): string | undefined {
  for (const k of Object.keys(o)) {
    const norm = normalizePatchKey(k);
    for (const alias of aliases) {
      const want = normalizePatchKey(alias);
      if (!want) continue;
      if (norm === want || norm.includes(want) || want.includes(norm)) {
        const v = o[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    }
  }
  if (opts?.keyPrefix) {
    const prefix = normalizePatchKey(opts.keyPrefix);
    for (const k of Object.keys(o)) {
      const norm = normalizePatchKey(k);
      if (norm.startsWith(prefix)) {
        const v = o[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    }
  }
  return undefined;
}

const CONCRETE_EVENT_ALIASES = ["concrete_event", "concreteevent", "具体事件", "事件", "event", "发生了什么"];
const STAKES_ALIASES = ["stakes", "利害", "在乎", "害怕失去", "怕失去", "代价"];
const STICKING_POINT_ALIASES = ["sticking_point", "stickingpoint", "卡点", "过不去", "阻碍", "卡在哪"];
const WANTS_ALIASES = ["wants", "想要", "想要价值", "行动", "方向", "desired", "期望", "希望"];
const PRIORITY_ALIASES = ["priority", "priorities", "优先", "优先级", "最在意", "首要"];

const DILEMMA_CONTAINER_ALIASES = ["core_dilemma", "coredilemma", "dilemma", "困境", "核心困境"];
const DIRECTION_CONTAINER_ALIASES = ["desired_direction", "desireddirection", "direction", "期望方向", "行动", "目标方向"];

/** Locate core_dilemma object even when parent key was translated. */
export function resolveCoreDilemmaRaw(root: Record<string, unknown>): unknown {
  const direct = root.core_dilemma;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) return direct;
  for (const k of Object.keys(root)) {
    const norm = normalizePatchKey(k);
    if (
      DILEMMA_CONTAINER_ALIASES.some((a) => {
        const want = normalizePatchKey(a);
        return norm === want || norm.includes(want) || want.includes(norm);
      })
    ) {
      const v = root[k];
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
    }
  }
  if (parseCoreDilemmaPatch(root)) return root;
  return null;
}

/** Locate desired_direction object even when parent key was translated (e.g. "行动"). */
export function resolveDesiredDirectionRaw(root: Record<string, unknown>): unknown {
  const direct = root.desired_direction;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) return direct;
  for (const k of Object.keys(root)) {
    const norm = normalizePatchKey(k);
    if (
      DIRECTION_CONTAINER_ALIASES.some((a) => {
        const want = normalizePatchKey(a);
        return norm === want || norm.includes(want) || want.includes(norm);
      })
    ) {
      const v = root[k];
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
    }
  }
  if (parseDesiredDirectionPatch(root)) return root;
  return null;
}

export function parseCoreDilemmaPatch(raw: unknown): Partial<CoreDilemma> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<CoreDilemma> = {};
  const concrete_event = pickUnderstandingPatchField(o, CONCRETE_EVENT_ALIASES);
  const stakes = pickUnderstandingPatchField(o, STAKES_ALIASES);
  const sticking_point = pickUnderstandingPatchField(o, STICKING_POINT_ALIASES);
  if (concrete_event) out.concrete_event = concrete_event;
  if (stakes) out.stakes = stakes;
  if (sticking_point) out.sticking_point = sticking_point;
  return Object.keys(out).length > 0 ? out : null;
}

export function parseDesiredDirectionPatch(raw: unknown): Partial<DesiredDirection> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<DesiredDirection> = {};
  const wants = pickUnderstandingPatchField(o, WANTS_ALIASES, { keyPrefix: "w" });
  const priority = pickUnderstandingPatchField(o, PRIORITY_ALIASES, { keyPrefix: "p" });
  if (wants) out.wants = wants;
  if (priority) out.priority = priority;
  return Object.keys(out).length > 0 ? out : null;
}

export function mergeCoreDilemma(
  base: CoreDilemma | null,
  patch: Partial<CoreDilemma> | null | undefined,
): CoreDilemma | null {
  if (!patch) return base;
  const prev: CoreDilemma = base ?? {
    concrete_event: null,
    stakes: null,
    sticking_point: null,
  };
  return {
    concrete_event: hasUnderstandingFieldDraft(patch.concrete_event)
      ? patch.concrete_event!.trim()
      : prev.concrete_event,
    stakes: hasUnderstandingFieldDraft(patch.stakes) ? patch.stakes!.trim() : prev.stakes,
    sticking_point: hasUnderstandingFieldDraft(patch.sticking_point)
      ? patch.sticking_point!.trim()
      : prev.sticking_point,
  };
}

export function mergeDesiredDirection(
  base: DesiredDirection | null,
  patch: Partial<DesiredDirection> | null | undefined,
): DesiredDirection | null {
  if (!patch) return base;
  const prev: DesiredDirection = base ?? { wants: null, priority: null };
  return {
    wants: hasUnderstandingFieldDraft(patch.wants) ? patch.wants!.trim() : prev.wants,
    priority: hasUnderstandingFieldDraft(patch.priority) ? patch.priority!.trim() : prev.priority,
  };
}

/** Control-plane gate: segment 1 complete when 三必填 (问题/情况/期望) are filled. */
export function isUnderstandingComplete(
  state: Pick<POJUAgentState, "core_dilemma" | "desired_direction">,
): boolean {
  const d = state.core_dilemma;
  const dir = state.desired_direction;
  return Boolean(
    d &&
      isUnderstandingFieldFilled(d.concrete_event) &&
      isUnderstandingFieldFilled(d.stakes) &&
      dir &&
      isUnderstandingFieldFilled(dir.wants),
  );
}

export function getUnderstandingMissingFields(state: POJUAgentState): string[] {
  const missing: string[] = [];
  const d = state.core_dilemma;
  const dir = state.desired_direction;
  // 收口只看三必填：问题(concrete_event) + 情况(stakes) + 期望(wants)。
  // sticking_point / priority 降为【选填】——自然带出可填，但不追、不作为放行条件；
  // 尤其禁止为凑它们而下钻到用户当前手段(项目)的技术/执行细节。
  if (!d || !isUnderstandingFieldFilled(d.concrete_event)) missing.push("core_dilemma.concrete_event");
  if (!d || !isUnderstandingFieldFilled(d.stakes)) missing.push("core_dilemma.stakes");
  if (!dir || !isUnderstandingFieldFilled(dir.wants)) missing.push("desired_direction.wants");
  return missing;
}

/** Softer gate for opening ceiling — accumulated dilemma + direction have substance (not all 5 fields). */
export function hasSubstantiveDilemmaAndDirection(
  state: Pick<POJUAgentState, "core_dilemma" | "desired_direction">,
): boolean {
  const d = state.core_dilemma;
  const dir = state.desired_direction;
  const dilemmaCount = [d?.concrete_event, d?.stakes, d?.sticking_point].filter((v) =>
    isUnderstandingFieldFilled(v),
  ).length;
  const directionCount = [dir?.wants, dir?.priority].filter((v) => isUnderstandingFieldFilled(v)).length;
  return dilemmaCount >= 2 && directionCount >= 1;
}

export function formatSegment1UnderstandingForPrompt(state: POJUAgentState): string {
  const d = state.core_dilemma;
  const dir = state.desired_direction;
  if (!d && !dir) return "（第1段理解门字段尚未写入。）";
  const lines = ["## 第1段理解门产出（第2段推演靶心 · 必须显式扣住）"];
  if (d) {
    lines.push(`- concrete_event 问题: ${d.concrete_event ?? "—"}`);
    lines.push(`- stakes 情况: ${d.stakes ?? "—"}`);
    if (isUnderstandingFieldFilled(d.sticking_point)) {
      lines.push(`- sticking_point 卡点模式(选填): ${d.sticking_point}`);
    }
  }
  if (dir) {
    lines.push(`- wants 期望: ${dir.wants ?? "—"}`);
    if (isUnderstandingFieldFilled(dir.priority)) {
      lines.push(`- priority 优先(选填): ${dir.priority}`);
    }
  }
  return lines.join("\n");
}

/** Test / fixture helper — fully populated segment-1 understanding. */
export function withCompleteUnderstanding(agent: POJUAgentState): POJUAgentState {
  return {
    ...agent,
    core_dilemma: {
      concrete_event: "离婚8年，近期几乎没接触异性",
      stakes: "怕错过窗口，也怕再受伤",
      sticking_point: "不知道从哪里开始、自信不足",
    },
    desired_direction: {
      wants: "希望能在合适节奏下建立稳定亲密关系",
      priority: "先恢复社交能力与自我确认",
    },
  };
}

export function createInitialAgentState(input: {
  original_question: string;
  selected_profile_id?: string | null;
}): POJUAgentState {
  const selected_profile_id = input.selected_profile_id ?? null;
  return {
    current_phase: "opening",
    original_question: input.original_question,
    selected_profile_id,
    has_base_analysis: Boolean(selected_profile_id),
    profile_skipped: false,
    question_category: null,
    context_collected: {
      duration: null,
      trigger_event: null,
      emotional_state: null,
      what_tried: [],
      desired_outcome: null,
      category_specific: {},
    },
    collection_completeness: 0,
    current_summary: null,
    has_situation_analysis: false,
    actions: [],
    main_delivery_at: null,
    main_delivery_data: null,
    turn_count: 0,
    collecting_turn_count: 0,
    opening_substantive_turns: 0,
    opening_unqualified_streak: 0,
    escalation_locked_at: null,
    escalation_lock_reason: null,
    stall_count: 0,
    delivery_mode: null,
    stop_loss_triggered: false,
    stall_offer_pending: false,
    resume_collecting_low_barrier: false,
    tokens_used: 0,
    phase_history: [],
    investigation_agenda: [],
    agenda_generated: false,
    breakthrough_core: null,
    core_dilemma: null,
    desired_direction: null,
    attachments_unlocked: false,
    agenda_collection_detail: null,
    delivery_report: null,
    anchored_fact_ids: [],
    used_metaphors: [],
  };
}

export function calculateCompleteness(state: POJUAgentState): number {
  if (!state.question_category) return 0;

  const required = REQUIRED_FIELDS_BY_CATEGORY[state.question_category] ?? [];
  if (required.length === 0) return 0;

  const c = state.context_collected;
  const generalFields = ["duration", "trigger_event", "emotional_state", "desired_outcome"] as const;
  let generalFilled = 0;
  for (const field of generalFields) {
    const v = c[field];
    if (isFilled(v)) generalFilled += 1;
  }
  const generalScore = (generalFilled / generalFields.length) * 0.3;

  const triedScore = c.what_tried.length > 0 ? 0.1 : 0;

  let categoryFilled = 0;
  for (const field of required) {
    if (isFilled(c.category_specific[field])) categoryFilled += 1;
  }
  const categoryScore =
    Math.min(1, categoryFilled / Math.max(MIN_CATEGORY_FIELDS_FOR_FULL, required.length)) * 0.6;

  return Math.min(1, generalScore + triedScore + categoryScore);
}

export function findMissingFields(state: POJUAgentState): { general: string[]; category_specific: string[] } {
  const missing = { general: [] as string[], category_specific: [] as string[] };
  const c = state.context_collected;

  const generalFields = ["duration", "trigger_event", "emotional_state", "desired_outcome"] as const;
  for (const field of generalFields) {
    if (!isFilled(c[field])) missing.general.push(field);
  }
  if (c.what_tried.length === 0) missing.general.push("what_tried");

  if (state.question_category) {
    const required = REQUIRED_FIELDS_BY_CATEGORY[state.question_category] ?? [];
    for (const field of required) {
      if (!isFilled(c.category_specific[field])) missing.category_specific.push(field);
    }
  }

  return missing;
}

export interface PhaseTransitionInput {
  current_state: POJUAgentState;
  llm_suggested_phase: AgentPhase | LegacyAgentPhase | null;
  user_message: string;
  /** Effective user Q&A rounds — used for collecting → confirmation hard gate. */
  user_turn_count?: number;
  /** LLM signal from collecting phase (Step 1). */
  collection_progress?: CollectionProgress | null;
  /** Counters after this turn's update (Step 2). */
  stall_count?: number;
  collecting_turn_count?: number;
  /** Precomputed stop-loss evaluation for this turn. */
  stop_loss?: { triggered: boolean; reason: string | null };
  /** LLM stall-offer branch (Step 3). */
  stall_offer?: boolean;
  /** Opening Deep Judge — only true allows opening → collecting. */
  understanding_sufficient?: boolean;
}

export interface PhaseTransitionResult {
  should_transition: boolean;
  new_phase: AgentPhase;
  reason: string;
  delivery_mode?: DeliveryMode | null;
  stop_loss_triggered?: boolean;
  stall_offer_pending?: boolean;
  clear_stall_offer_pending?: boolean;
  reset_stall_count?: boolean;
  resume_collecting_low_barrier?: boolean;
  clear_resume_collecting_low_barrier?: boolean;
  /** User asked for delivery but agenda gate not met — inject pullback prompt next turn. */
  pullback?: boolean;
}

export function decidePhaseTransition(input: PhaseTransitionInput): PhaseTransitionResult {
  const { current_state, user_message } = input;
  const userTurns = input.user_turn_count ?? current_state.turn_count ?? 0;
  const llm_suggested_phase = normalizeAgentPhase(input.llm_suggested_phase ?? undefined);
  const current = normalizeAgentPhase(current_state.current_phase) ?? current_state.current_phase;

  switch (current) {
    case "opening":
      if (
        user_message !== "__OPENING__" &&
        user_message.trim() &&
        isUnderstandingComplete(current_state) &&
        input.understanding_sufficient === true
      ) {
        return {
          should_transition: true,
          new_phase: "awaiting_understanding_confirm",
          reason: "Understanding structure complete and model sufficient, awaiting user confirmation",
        };
      }
      break;

    case "collecting_context": {
      if (input.stall_offer) {
        return {
          should_transition: true,
          new_phase: "awaiting_confirmation",
          stop_loss_triggered: true,
          stall_offer_pending: true,
          reason: `Stop-loss stall offer: ${input.stop_loss?.reason ?? "triggered"}`,
        };
      }

      const confirm = canTransitionToConfirmation({
        agent: current_state,
        userTurns,
        userMessage: user_message,
      });
      if (confirm.allowed) {
        const reason =
          llm_suggested_phase === "awaiting_confirmation"
            ? confirm.reason
            : confirm.reason;
        return {
          should_transition: true,
          new_phase: "awaiting_confirmation",
          delivery_mode: "full",
          reason,
        };
      }

      const pullback = computeCollectingPullback({
        userMessage: user_message,
        agent: current_state,
        userTurns,
      });
      return {
        should_transition: false,
        new_phase: "collecting_context",
        reason: confirm.reason,
        pullback,
      };
    }

    case "awaiting_confirmation":
      if (current_state.stall_offer_pending) {
        const choice = classifyStallOfferReply(user_message);
        if (choice === "continue_collecting") {
          return {
            should_transition: true,
            new_phase: "collecting_context",
            reset_stall_count: true,
            clear_stall_offer_pending: true,
            resume_collecting_low_barrier: true,
            reason: "User chose to continue collecting after stall offer",
          };
        }
        return {
          should_transition: true,
          new_phase: "delivered",
          delivery_mode: "degraded",
          clear_stall_offer_pending: true,
          reason:
            choice === "degraded_delivery"
              ? "User chose degraded delivery after stall offer"
              : "Stall offer fallback to degraded delivery",
        };
      }
      if (llm_suggested_phase === "collecting_context") {
        return {
          should_transition: true,
          new_phase: "collecting_context",
          reason: "User wants to add more context",
        };
      }
      if (llm_suggested_phase === "delivered") {
        return {
          should_transition: true,
          new_phase: "delivered",
          delivery_mode: current_state.delivery_mode ?? "full",
          reason: "User confirmed, generating delivery",
        };
      }
      break;

    case "delivered":
      return {
        should_transition: true,
        new_phase: "tracking",
        reason: "Main delivery done, entering tracking mode",
      };

    case "tracking":
      break;

    default:
      break;
  }

  return {
    should_transition: false,
    new_phase: current,
    reason: "No transition condition met",
  };
}

export function applyPhaseTransition(state: POJUAgentState, transition: PhaseTransitionResult): POJUAgentState {
  const statePatch: Partial<POJUAgentState> = {};

  if (transition.delivery_mode != null) statePatch.delivery_mode = transition.delivery_mode;
  if (transition.stop_loss_triggered) statePatch.stop_loss_triggered = true;
  if (transition.stall_offer_pending) statePatch.stall_offer_pending = true;
  if (transition.clear_stall_offer_pending) statePatch.stall_offer_pending = false;
  if (transition.reset_stall_count) statePatch.stall_count = 0;
  if (transition.resume_collecting_low_barrier) statePatch.resume_collecting_low_barrier = true;
  if (transition.clear_resume_collecting_low_barrier) statePatch.resume_collecting_low_barrier = false;

  if (!transition.should_transition) {
    return Object.keys(statePatch).length > 0 ? { ...state, ...statePatch } : state;
  }

  const from = normalizeAgentPhase(state.current_phase) ?? state.current_phase;
  const to = transition.new_phase;

  return {
    ...state,
    ...statePatch,
    current_phase: to,
    phase_history: [
      ...state.phase_history,
      {
        from_phase: from,
        to_phase: to,
        triggered_at: new Date().toISOString(),
        reason: transition.reason,
      },
    ],
  };
}
