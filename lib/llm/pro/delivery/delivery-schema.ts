/**
 * POJU Phase 4 delivery book · v1 **10** prose segment keys
 * (9 content modules; validation_review = validation_risk + validation_close).
 * Cover / TOC / appendix are merge-time. `thirty_day` + old 6 keys = legacy read aliases.
 *
 * Reader shelf faces are 01–08. Those face ids are the canonical page ids.
 * These ten keys stay paper aliases and the generator order.
 * `resolveCanonicalDeliveryPage` is the face. `resolveDeliverySegmentKey` is the primary paper alias.
 */

import { composeRxArgumentBody } from "@/lib/llm/pro/delivery/rx-argument-shape";
import {
  LEGACY_SIX_TO_V1,
  V1_DELIVERY_SEGMENT_KEYS,
  canonicalizeDeliverySegmentKey,
  type DeliverySegmentKey as AliasDeliverySegmentKey,
  type LegacyDeliverySegmentKey,
  type V1DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/segment-key-alias";

export type { V1DeliverySegmentKey, LegacyDeliverySegmentKey };
export type DeliverySegmentKey = AliasDeliverySegmentKey;

/** Generator / fill order (v1 ten segments). The reader shelf folds these onto 01–08. */
export const DELIVERY_SEGMENT_KEYS: readonly V1DeliverySegmentKey[] = [
  ...V1_DELIVERY_SEGMENT_KEYS,
];

/**
 * Transition sections: plain narrative only — no per-argument evidence / mark.
 * decision_brief: product hangs no 依据层 on UI; skip evidence+mark LLM.
 */
export const DELIVERY_TRANSITION_KEYS = new Set<DeliverySegmentKey>(["decision_brief"]);

/**
 * v1 双轨依据 · 科学段。
 * 见 `.cursor/docs/v1-决策交付-产品边界.md` §3。
 */
export interface ScienceEvidenceUnit {
  /** 机制短名（闭集选科，非空术语堆砌）。 */
  mechanism?: string;
  /** 对应本案哪条事实/行动。 */
  tied_to_case?: string;
  /** 可见说明文（折叠依据 B 段）。 */
  prose?: string;
}

/** Dual-key for one delivery section. */
export interface DeliverySegmentComputed {
  /** Plain-language conclusion — no 命理 terms. */
  core_conclusion: string;
  /** 命理真词清单 — only for evidence layer / ClaimPlan seed. */
  bazi_basis: readonly string[];
  /**
   * 本页承重闭集真词(先于正文锁定)。full 模式须非空；与 bazi_basis 对齐或为其超集。
   */
  chart_anchors: readonly string[];
  /**
   * v1 双轨 · A 命理依据说明。
   */
  metaphysics_evidence?: string;
  /**
   * v1 双轨 · B 科学依据。
   */
  science_evidence?: string | readonly ScienceEvidenceUnit[];
}

export type DeliveryComputed = Record<V1DeliverySegmentKey, DeliverySegmentComputed> &
  Partial<Record<LegacyDeliverySegmentKey, DeliverySegmentComputed>>;

/**
 * Per-segment chart/spine inputs (field-name checklist for finalize / Layer2-B).
 */
export const SEGMENT_COMPUTED_INPUTS: Record<DeliverySegmentKey, readonly string[]> = {
  decision_brief: [
    "situation_conclusion",
    "key_crossroads",
    "primary_path",
    "desired_outcome",
  ],
  situation_analysis: [
    "energy_structure",
    "element_scores",
    "four_pillars_ten_gods",
    "multi_dimension_reckoning",
    "original_question",
    "desired_outcome",
  ],
  personal_decision_patterns: [
    "energy_structure",
    "four_pillars_ten_gods",
    "shen_sha_life_stage",
    "multi_dimension_reckoning",
  ],
  bottleneck_analysis: [
    "energy_structure",
    "current_da_yun_cycle",
    "multi_dimension_reckoning",
    "key_crossroads",
    "blind_spots",
  ],
  strategic_options: [
    "primary_path",
    "backup_path",
    "multi_dimension_reckoning",
    "modern_action_frames",
    "key_crossroads",
  ],
  recommended_strategy: [
    "primary_path",
    "backup_path",
    "action_plan",
    "path_costs",
    "multi_dimension_reckoning",
  ],
  execution_guidance: [
    "primary_path",
    "backup_path",
    "action_plan",
    "multi_dimension_reckoning",
    "modern_action_frames",
  ],
  self_regulation: [
    "metaphysics_pack",
    "energy_retune_frame",
    "multi_dimension_reckoning",
    "desired_outcome",
  ],
  validation_risk: [
    "self_check_signals",
    "ji_shen",
    "blind_spots",
    "path_costs",
    "multi_dimension_reckoning",
    "desired_outcome",
    "action_brief_p3_p4",
  ],
  validation_close: [
    "self_check_signals",
    "action_plan",
    "rhythm_frame",
    "action_brief_p3_p4",
    "primary_path_chart_anchors",
    "backup_path_chart_anchors",
  ],
  direct_answer: [
    "situation_conclusion",
    "key_crossroads",
    "primary_path",
    "desired_outcome",
  ],
  foundation: [
    "energy_structure",
    "element_scores",
    "four_pillars_ten_gods",
    "shen_sha_life_stage",
    "current_da_yun_cycle",
    "multi_dimension_reckoning",
  ],
  science_action: [
    "primary_path",
    "backup_path",
    "action_plan",
    "multi_dimension_reckoning",
    "modern_action_frames",
  ],
  metaphysics_action: [
    "metaphysics_pack",
    "energy_retune_frame",
    "multi_dimension_reckoning",
    "desired_outcome",
  ],
  thirty_day: ["rhythm_frame", "primary_path", "backup_path", "action_plan", "current_da_yun_cycle"],
  risk_guard: [
    "self_check_signals",
    "ji_shen",
    "blind_spots",
    "path_costs",
    "multi_dimension_reckoning",
    "desired_outcome",
    "action_brief_p3_p4",
  ],
  signals_close: [
    "self_check_signals",
    "action_plan",
    "rhythm_frame",
    "action_brief_p3_p4",
    "primary_path_chart_anchors",
    "backup_path_chart_anchors",
  ],
};

type PageTag = { zh: string; en: string; es: string; de: string; fr: string; partNo: string };

const TAG_DECISION_BRIEF: PageTag = {
  zh: "决策简报",
  en: "Decision Brief",
  es: "Brief de decisión",
  de: "Decision Brief",
  fr: "Brief de décision",
  partNo: "1",
};
const TAG_SITUATION: PageTag = {
  zh: "处境诊断",
  en: "Situation Analysis",
  es: "Análisis de situación",
  de: "Situation Analysis",
  fr: "Analyse de situation",
  partNo: "2",
};
const TAG_PATTERNS: PageTag = {
  zh: "决策模式",
  en: "Decision Patterns",
  es: "Patrones de decisión",
  de: "Decision Patterns",
  fr: "Schémas de décision",
  partNo: "3",
};
const TAG_BOTTLENECK: PageTag = {
  zh: "核心障碍",
  en: "Bottleneck Analysis",
  es: "Análisis de cuellos",
  de: "Bottleneck Analysis",
  fr: "Goulots d'étranglement",
  partNo: "4",
};
const TAG_OPTIONS: PageTag = {
  zh: "战略选项",
  en: "Strategic Options",
  es: "Opciones estratégicas",
  de: "Strategic Options",
  fr: "Options stratégiques",
  partNo: "5",
};
const TAG_STRATEGY: PageTag = {
  zh: "主策略",
  en: "Recommended Strategy",
  es: "Estrategia recomendada",
  de: "Recommended Strategy",
  fr: "Stratégie recommandée",
  partNo: "6",
};
const TAG_EXECUTION: PageTag = {
  zh: "执行原则",
  en: "Execution Guidance",
  es: "Guía de ejecución",
  de: "Execution Guidance",
  fr: "Principes d'exécution",
  partNo: "7",
};
const TAG_SELF_REG: PageTag = {
  zh: "自我调频",
  en: "Self-Regulation",
  es: "Autorregulación",
  de: "Self-Regulation",
  fr: "Autorégulation",
  partNo: "8",
};
const TAG_RISK: PageTag = {
  zh: "风险与验证",
  en: "Risk & Validation",
  es: "Riesgo y validación",
  de: "Risk & Validation",
  fr: "Risque et validation",
  partNo: "9a",
};
const TAG_CLOSE: PageTag = {
  zh: "行动收束",
  en: "Signals & Close",
  es: "Señales y cierre",
  de: "Signals & Close",
  fr: "Signaux et clôture",
  partNo: "9b",
};

/**
 * Fixed UI tags (chrome) — never generated by the model.
 */
export const DELIVERY_PAGE_TAGS: Record<DeliverySegmentKey, PageTag> = {
  decision_brief: TAG_DECISION_BRIEF,
  situation_analysis: TAG_SITUATION,
  personal_decision_patterns: TAG_PATTERNS,
  bottleneck_analysis: TAG_BOTTLENECK,
  strategic_options: TAG_OPTIONS,
  recommended_strategy: TAG_STRATEGY,
  execution_guidance: TAG_EXECUTION,
  self_regulation: TAG_SELF_REG,
  validation_risk: TAG_RISK,
  validation_close: TAG_CLOSE,
  direct_answer: TAG_DECISION_BRIEF,
  foundation: { ...TAG_SITUATION, zh: "处境与障碍", en: "Situation & Bottlenecks", partNo: "2" },
  science_action: { ...TAG_EXECUTION, zh: "策略与执行", en: "Strategy & Execution", partNo: "3" },
  metaphysics_action: TAG_SELF_REG,
  thirty_day: {
    zh: "30日计划",
    en: "30-Day Plan",
    es: "Plan 30 Días",
    de: "30-Day Plan",
    fr: "Plan 30 Jours",
    partNo: "—",
  },
  risk_guard: TAG_RISK,
  signals_close: TAG_CLOSE,
};

/** True when title is empty or just repeats the fixed TOC tag (敷衍 → TOC collapses). */
export function isTagOnlyOrEmptyPageTitle(
  key: DeliverySegmentKey,
  title: string,
): boolean {
  const t = title.trim();
  if (!t) return true;
  const tags = DELIVERY_PAGE_TAGS[key];
  if (!tags) return false;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  const n = norm(t);
  const aliases: string[] = [
    tags.zh,
    tags.en,
    tags.es,
    tags.de,
    tags.fr,
    "自我调频",
    "Self Retune",
    "Self-Regulation",
    "东方谋略",
    "Eastern Stratagem",
    "核心直答",
    "Core Answer",
    "决策简报",
    "Decision Brief",
    "归因剖析",
    "Root Analysis",
    "处境与障碍",
    "破局策略",
    "Breakthrough Strategy",
    "策略与执行",
    "风险预警",
    "Risk Guard",
    "出门仪式",
    "Tonight & Close",
    "行动收束",
  ];
  return aliases.some((x) => norm(x) === n);
}

/**
 * Fallback section headings (markdown / legacy shelf).
 */
export const DELIVERY_SECTION_HEADINGS: Record<
  DeliverySegmentKey,
  { zh: string; en: string; es: string; de: string; fr: string; partNo: string }
> = {
  decision_brief: { ...DELIVERY_PAGE_TAGS.decision_brief },
  situation_analysis: { ...DELIVERY_PAGE_TAGS.situation_analysis },
  personal_decision_patterns: { ...DELIVERY_PAGE_TAGS.personal_decision_patterns },
  bottleneck_analysis: { ...DELIVERY_PAGE_TAGS.bottleneck_analysis },
  strategic_options: { ...DELIVERY_PAGE_TAGS.strategic_options },
  recommended_strategy: { ...DELIVERY_PAGE_TAGS.recommended_strategy },
  execution_guidance: { ...DELIVERY_PAGE_TAGS.execution_guidance },
  self_regulation: { ...DELIVERY_PAGE_TAGS.self_regulation },
  validation_risk: { ...DELIVERY_PAGE_TAGS.validation_risk },
  validation_close: { ...DELIVERY_PAGE_TAGS.validation_close },
  direct_answer: { ...DELIVERY_PAGE_TAGS.direct_answer },
  foundation: { ...DELIVERY_PAGE_TAGS.foundation },
  science_action: { ...DELIVERY_PAGE_TAGS.science_action },
  metaphysics_action: { ...DELIVERY_PAGE_TAGS.metaphysics_action },
  thirty_day: {
    zh: "30天能量推进计划（已退役）",
    en: "30-Day Action Roadmap (retired)",
    es: "Hoja de Ruta de Acción de 30 Días (retirada)",
    de: "30-Day Action Roadmap (retired)",
    fr: "Feuille de Route d'Action sur 30 Jours (retirée)",
    partNo: "—",
  },
  risk_guard: { ...DELIVERY_PAGE_TAGS.risk_guard },
  signals_close: { ...DELIVERY_PAGE_TAGS.signals_close },
};

/**
 * Legacy A–F letter keys + old 6/9-segment book keys → current v1 page keys.
 * Used when reading old sessions / LLM aliases.
 */
export const LEGACY_SEGMENT_TO_CURRENT: Record<string, DeliverySegmentKey> = {
  // v1 six→ten
  ...LEGACY_SIX_TO_V1,
  // 9→7 merge leftovers → situation_analysis
  energy_base: "situation_analysis",
  talent_map: "situation_analysis",
  spirit_gifts: "situation_analysis",
  macro_cycle: "situation_analysis",
  // Old Phase-4 book keys
  preface: "decision_brief",
  energy: "situation_analysis",
  situation: "situation_analysis",
  crossroads: "situation_analysis",
  action: "execution_guidance",
  retune: "self_regulation",
  rhythm: "thirty_day",
  awareness: "validation_risk",
  epilogue: "validation_close",
  // Legacy A–F
  A: "situation_analysis",
  B: "situation_analysis",
  C: "execution_guidance",
  D: "self_regulation",
  E: "thirty_day",
  F: "validation_risk",
};

/** @deprecated Prefer LEGACY_SEGMENT_TO_CURRENT — kept for letter-only callers. */
export const LEGACY_LETTER_TO_SEGMENT: Record<string, DeliverySegmentKey> = {
  A: "situation_analysis",
  B: "situation_analysis",
  C: "execution_guidance",
  D: "self_regulation",
  E: "thirty_day",
  F: "validation_risk",
};

/** First prose page — unlocks streamed book chrome (replaces old preface gate). */
export const DELIVERY_BOOTSTRAP_SEGMENT: DeliverySegmentKey = "decision_brief";

/** Last prose page — stream-complete marker (replaces old epilogue). */
export const DELIVERY_CLOSING_SEGMENT: DeliverySegmentKey = "validation_close";

/** Face id → primary paper alias. 07 and 03 have no paper. */
const CONTENT_PAGE_TO_SEGMENT: Record<string, V1DeliverySegmentKey> = {
  "01": "decision_brief",
  "02": "situation_analysis",
  "04": "bottleneck_analysis",
  "05": "strategic_options",
  "06": "execution_guidance",
  "08": "validation_risk",
};

export { resolveCanonicalDeliveryPage } from "@/lib/llm/pro/delivery/decision-page-bridge";

/** Paper alias for a face id, a v1 key, or an older alias. The face itself is `resolveCanonicalDeliveryPage`. */
export function resolveDeliverySegmentKey(raw: string): DeliverySegmentKey | null {
  const k = raw.trim();
  const fromPage = CONTENT_PAGE_TO_SEGMENT[k];
  if (fromPage) return fromPage;
  if ((DELIVERY_SEGMENT_KEYS as readonly string[]).includes(k)) {
    return k as V1DeliverySegmentKey;
  }
  if (k === "thirty_day") return "thirty_day";
  const mapped = LEGACY_SEGMENT_TO_CURRENT[k] ?? LEGACY_SEGMENT_TO_CURRENT[k.toUpperCase()];
  if (mapped) return mapped;
  return canonicalizeDeliverySegmentKey(k);
}

function isSegment(x: unknown): x is DeliverySegmentComputed {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.core_conclusion !== "string" || !o.core_conclusion.trim()) return false;
  if (!Array.isArray(o.bazi_basis)) return false;
  if (!o.bazi_basis.every((b) => typeof b === "string")) return false;
  // chart_anchors optional on legacy payloads — normalize fills [].
  if (o.chart_anchors !== undefined) {
    if (!Array.isArray(o.chart_anchors)) return false;
    if (!o.chart_anchors.every((b) => typeof b === "string")) return false;
  }
  return true;
}

function normalizeSegmentComputed(candidate: DeliverySegmentComputed): DeliverySegmentComputed {
  const bazi_basis = candidate.bazi_basis.map((b) => String(b).trim()).filter(Boolean);
  const rawAnchors = Array.isArray(candidate.chart_anchors)
    ? candidate.chart_anchors.map((b) => String(b).trim()).filter(Boolean)
    : [];
  // Prefer explicit chart_anchors; else seed from bazi_basis (legacy dual-key).
  const chart_anchors = rawAnchors.length > 0 ? rawAnchors : bazi_basis;
  return {
    core_conclusion: candidate.core_conclusion.trim(),
    bazi_basis,
    chart_anchors,
  };
}

export type ValidateDeliveryComputedOpts = {
  /** full = require non-empty anchors; degraded = allow empty for thin delivery */
  mode?: "full" | "degraded";
};

export type ValidateDeliveryComputedResult =
  | { ok: true; value: DeliveryComputed }
  | { ok: false; severity: "soft" | "fatal"; reason: string; partial?: Partial<DeliveryComputed> };

function candidateForKey(
  o: Record<string, unknown>,
  k: DeliverySegmentKey,
): unknown {
  if (isSegment(o[k])) return o[k];
  for (const [legacy, cur] of Object.entries(LEGACY_SEGMENT_TO_CURRENT)) {
    if (cur === k && isSegment(o[legacy])) return o[legacy];
  }
  return undefined;
}

/** Accept book keys or legacy aliases. */
export function validateDeliveryComputed(
  raw: unknown,
  opts?: ValidateDeliveryComputedOpts,
): ValidateDeliveryComputedResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, severity: "fatal", reason: "not_object" };
  }
  const mode = opts?.mode ?? "full";
  const o = raw as Record<string, unknown>;
  const out = {} as DeliveryComputed;
  const missing: string[] = [];
  const emptyAnchors: string[] = [];

  for (const k of DELIVERY_SEGMENT_KEYS) {
    const candidate = candidateForKey(o, k);
    if (!isSegment(candidate)) {
      missing.push(k);
      continue;
    }
    const normalized = normalizeSegmentComputed(candidate);
    if (mode === "full" && (normalized.bazi_basis.length < 1 || normalized.chart_anchors.length < 1)) {
      emptyAnchors.push(k);
      continue;
    }
    out[k] = normalized;
  }

  if (missing.length === DELIVERY_SEGMENT_KEYS.length) {
    return { ok: false, severity: "fatal", reason: `missing_all:${missing.join(",")}` };
  }
  if (emptyAnchors.length > 0) {
    return {
      ok: false,
      severity: "soft",
      reason: `empty_anchors:${emptyAnchors.join(",")}`,
      partial: out,
    };
  }
  if (missing.length > 0) {
    return {
      ok: false,
      severity: "soft",
      reason: `missing:${missing.join(",")}`,
      partial: out,
    };
  }
  return { ok: true, value: out };
}

const PLACEHOLDER: DeliverySegmentComputed = {
  core_conclusion: "本段待补结论。",
  bazi_basis: [],
  chart_anchors: [],
};

/** Fill missing sections from partial / empty object. */
export function fillMissingDeliverySegments(raw: unknown): DeliveryComputed {
  const baseObj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out = {} as DeliveryComputed;
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const candidate = candidateForKey(baseObj, k);
    if (isSegment(candidate)) {
      out[k] = normalizeSegmentComputed(candidate);
    } else {
      out[k] = { ...PLACEHOLDER };
    }
  }
  return out;
}

/**
 * One independent argument = plain body + its own evidence.
 * Evidence is raw 命理 until the mark step; then marked ⟦t:…⟧.
 * P3/P4 may also carry structured strategy/methods (composed into body on coerce).
 */
export interface DeliveryArgument {
  body: string;
  evidence?: string;
  /**
   * ClaimPlan anchors for this argument (calc-first).
   * Evidence step must explain these — not invent a new chart story.
   */
  chart_anchors?: readonly string[];
  /** Optional Rx title (without ###) — composed into body when strategy+methods present. */
  title?: string;
  /** Decision strategy prose (P3/P4). */
  strategy?: string;
  /** Actionable methods / levers (P3/P4). */
  methods?: string;
}

/** Per-segment argument lists (Phase 4 book write trees). */
export type DeliveryArgumentTree = Partial<Record<DeliverySegmentKey, DeliveryArgument[]>>;

/** @deprecated Prefer DeliveryArgumentTree — flat string per segment (legacy). */
export type DeliveryTextTree = Partial<Record<DeliverySegmentKey, string>>;

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

/** Coerce LLM / legacy shapes into argument pairs. */
export function coerceDeliveryArguments(raw: unknown): DeliveryArgument[] {
  if (typeof raw === "string" && raw.trim()) {
    return [{ body: raw.trim() }];
  }
  if (Array.isArray(raw)) {
    const out: DeliveryArgument[] = [];
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) {
        out.push({ body: item.trim() });
        continue;
      }
      if (!isRecord(item)) continue;
      const title =
        (typeof item.title === "string" && item.title.trim()) ||
        (typeof item.标题 === "string" && item.标题.trim()) ||
        undefined;
      const strategy =
        (typeof item.strategy === "string" && item.strategy.trim()) ||
        (typeof item.策略 === "string" && item.策略.trim()) ||
        undefined;
      const methods =
        (typeof item.methods === "string" && item.methods.trim()) ||
        (typeof item.method === "string" && item.method.trim()) ||
        (typeof item.手段 === "string" && item.手段.trim()) ||
        undefined;
      let body =
        (typeof item.body === "string" && item.body.trim()) ||
        (typeof item.text === "string" && item.text.trim()) ||
        (typeof item.正文 === "string" && item.正文.trim()) ||
        "";
      if (strategy && methods) {
        body = composeRxArgumentBody({
          title: title ?? stripH3Title(body),
          strategy,
          methods,
        });
      }
      const evidence =
        (typeof item.evidence === "string" && item.evidence.trim()) ||
        (typeof item.依据 === "string" && item.依据.trim()) ||
        (typeof item["依据与推理"] === "string" && item["依据与推理"].trim()) ||
        undefined;
      const chart_anchors = Array.isArray(item.chart_anchors)
        ? item.chart_anchors.map((x) => String(x).trim()).filter(Boolean)
        : Array.isArray(item.anchors)
          ? item.anchors.map((x) => String(x).trim()).filter(Boolean)
          : undefined;
      if (body || evidence) {
        out.push({
          body: body || "",
          evidence,
          ...(chart_anchors?.length ? { chart_anchors } : {}),
          title,
          strategy,
          methods,
        });
      }
    }
    return out;
  }
  if (isRecord(raw)) {
    if (Array.isArray(raw.arguments)) {
      return coerceDeliveryArguments(raw.arguments);
    }
    const body =
      (typeof raw.body === "string" && raw.body.trim()) ||
      (typeof raw.text === "string" && raw.text.trim()) ||
      "";
    const evidence =
      (typeof raw.evidence === "string" && raw.evidence.trim()) ||
      (typeof raw["依据与推理"] === "string" && raw["依据与推理"].trim()) ||
      undefined;
    if (body || evidence) return [{ body: body || "", evidence }];
  }
  return [];
}

function stripH3Title(body: string): string | undefined {
  const m = body.match(/^###\s+([^\n]+)/);
  return m?.[1]?.trim() || undefined;
}

/** Merge task results into an argument tree (later tasks overwrite same segment). */
export function mergeDeliveryArgumentTrees(
  trees: readonly Record<string, unknown>[],
): DeliveryArgumentTree {
  const out: DeliveryArgumentTree = {};
  for (const tree of trees) {
    for (const [rawKey, v] of Object.entries(tree)) {
      const k = resolveDeliverySegmentKey(rawKey);
      if (!k) continue;
      const args = coerceDeliveryArguments(v);
      if (args.length > 0) out[k] = args;
    }
    for (const k of DELIVERY_SEGMENT_KEYS) {
      if (out[k]?.length) continue;
      const candidate = candidateForKey(tree, k);
      const args = coerceDeliveryArguments(candidate);
      if (args.length > 0) out[k] = args;
    }
  }
  return out;
}

/** Flatten argument bodies for legacy callers / translate. */
export function argumentTreeToTextTree(tree: DeliveryArgumentTree): DeliveryTextTree {
  const out: DeliveryTextTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const args = tree[k];
    if (!args?.length) continue;
    out[k] = args
      .map((a) => a.body.trim())
      .filter(Boolean)
      .join("\n\n");
  }
  return out;
}

/** Zip narrative bodies with evidence strings by index (pad / truncate to body count). */
export function zipArgumentEvidence(
  bodies: DeliveryArgumentTree,
  evidenceBySegment: DeliveryArgumentTree,
): DeliveryArgumentTree {
  const out: DeliveryArgumentTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const bodyArgs = bodies[k] ?? [];
    if (bodyArgs.length === 0) continue;
    const evArgs = evidenceBySegment[k] ?? [];
    out[k] = bodyArgs.map((b, i) => ({
      body: b.body,
      evidence: (evArgs[i]?.evidence ?? evArgs[i]?.body ?? b.evidence ?? "").trim() || undefined,
      ...(b.chart_anchors?.length ? { chart_anchors: b.chart_anchors } : {}),
    }));
  }
  return out;
}

export function mergeDeliveryTextTrees(
  trees: readonly Record<string, unknown>[],
): DeliveryTextTree {
  return argumentTreeToTextTree(mergeDeliveryArgumentTrees(trees));
}
