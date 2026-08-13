/**
 * POJU Phase 4 delivery book · dual-key SSOT for 7 prose pages
 * (P1–P7). Cover / TOC / appendix are merge-time.
 *
 * Layer2-A · 9→7：direct_answer + foundation(合并旧4分析段) + 5 行动/收尾段。
 * Aligns with lib/poju/report-blueprint.ts (P1–P7 content; P8 appendix separate).
 */

export type DeliverySegmentKey =
  | "direct_answer"
  | "foundation"
  | "science_action"
  | "metaphysics_action"
  | "thirty_day"
  | "risk_guard"
  | "signals_close";

export const DELIVERY_SEGMENT_KEYS: readonly DeliverySegmentKey[] = [
  "direct_answer",
  "foundation",
  "science_action",
  "metaphysics_action",
  "thirty_day",
  "risk_guard",
  "signals_close",
] as const;

/**
 * Transition sections: plain narrative only — no per-argument evidence.
 * 7-page book: all pages carry dual-key evidence (close is not a hook transition).
 */
export const DELIVERY_TRANSITION_KEYS = new Set<DeliverySegmentKey>([]);

/** Dual-key for one delivery section. */
export interface DeliverySegmentComputed {
  /** Plain-language conclusion — no 命理 terms. */
  core_conclusion: string;
  /** 命理真词清单 — only for evidence layer. */
  bazi_basis: readonly string[];
}

export type DeliveryComputed = Record<DeliverySegmentKey, DeliverySegmentComputed>;

/**
 * Per-segment chart/spine inputs (field-name checklist for finalize / Layer2-B).
 * Aligns with report-blueprint chart_inputs; foundation is “按论证需要放,不硬凑”.
 */
export const SEGMENT_COMPUTED_INPUTS: Record<DeliverySegmentKey, readonly string[]> = {
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
  metaphysics_action: ["metaphysics_pack", "energy_retune_frame", "primary_path"],
  thirty_day: ["rhythm_frame", "primary_path", "backup_path", "action_plan", "current_da_yun_cycle"],
  risk_guard: ["self_check_signals", "ji_shen", "blind_spots"],
  signals_close: ["self_check_signals"],
};

export const DELIVERY_SECTION_HEADINGS: Record<
  DeliverySegmentKey,
  { zh: string; en: string; es: string; de: string; fr: string; partNo: string }
> = {
  direct_answer: {
    zh: "对你问题的回答",
    en: "Your Answer",
    es: "Tu Respuesta",
    de: "Deine Antwort",
    fr: "Ta Réponse",
    partNo: "1",
  },
  foundation: {
    zh: "你的底座与为什么卡在这",
    en: "Your Foundation & Why You're Stuck",
    es: "Tu Base y Por Qué Estás Atascado",
    de: "Deine Basis & Warum du feststeckst",
    fr: "Ta Base et Pourquoi Tu Bloques",
    partNo: "2",
  },
  science_action: {
    zh: "科学药方：策略与手段",
    en: "Scientific Path: Strategy & Methods",
    es: "Vía Científica: Estrategia y Métodos",
    de: "Scientific Path: Strategy & Methods",
    fr: "Voie Scientifique : Stratégie et Méthodes",
    partNo: "3",
  },
  metaphysics_action: {
    zh: "东方药方：策略与手段",
    en: "Eastern Path: Strategy & Methods",
    es: "Vía Oriental: Estrategia y Métodos",
    de: "Eastern Path: Strategy & Methods",
    fr: "Voie Orientale : Stratégie et Méthodes",
    partNo: "4",
  },
  thirty_day: {
    zh: "30天能量推进计划",
    en: "30-Day Action Roadmap",
    es: "Hoja de Ruta de Acción de 30 Días",
    de: "30-Day Action Roadmap",
    fr: "Feuille de Route d'Action sur 30 Jours",
    partNo: "5",
  },
  risk_guard: {
    zh: "风险预警与边界建立",
    en: "Risk Assessment & Boundary Setup",
    es: "Evaluación de Riesgos y Definición de Límites",
    de: "Risk Assessment & Boundary Setup",
    fr: "Évaluation des Risques & Établissement des Limites",
    partNo: "6",
  },
  signals_close: {
    zh: "突破信号与总结",
    en: "Breakthrough Signals & Summary",
    es: "Señales de Avance y Resumen",
    de: "Breakthrough Signals & Summary",
    fr: "Signaux de Déclic & Résumé",
    partNo: "7",
  },
};

/**
 * Legacy A–F letter keys + old 9-segment book keys → current page keys.
 * Used when reading old sessions / LLM aliases.
 */
export const LEGACY_SEGMENT_TO_CURRENT: Record<string, DeliverySegmentKey> = {
  // 9→7 merge: 旧4段分析页 → foundation(P2)
  energy_base: "foundation",
  talent_map: "foundation",
  spirit_gifts: "foundation",
  macro_cycle: "foundation",
  // Old Phase-4 book keys → 合并后落点
  preface: "direct_answer",
  energy: "foundation",
  situation: "foundation",
  crossroads: "foundation",
  action: "science_action",
  retune: "metaphysics_action",
  rhythm: "thirty_day",
  awareness: "risk_guard",
  epilogue: "signals_close",
  // Legacy A–F
  A: "foundation",
  B: "foundation",
  C: "science_action",
  D: "metaphysics_action",
  E: "thirty_day",
  F: "risk_guard",
};

/** @deprecated Prefer LEGACY_SEGMENT_TO_CURRENT — kept for letter-only callers. */
export const LEGACY_LETTER_TO_SEGMENT: Record<string, DeliverySegmentKey> = {
  A: "foundation",
  B: "foundation",
  C: "science_action",
  D: "metaphysics_action",
  E: "thirty_day",
  F: "risk_guard",
};

/** First prose page — unlocks streamed book chrome (replaces old preface gate). */
export const DELIVERY_BOOTSTRAP_SEGMENT: DeliverySegmentKey = "direct_answer";

/** Last prose page — stream-complete marker (replaces old epilogue). */
export const DELIVERY_CLOSING_SEGMENT: DeliverySegmentKey = "signals_close";

export function resolveDeliverySegmentKey(raw: string): DeliverySegmentKey | null {
  const k = raw.trim();
  if ((DELIVERY_SEGMENT_KEYS as readonly string[]).includes(k)) {
    return k as DeliverySegmentKey;
  }
  return LEGACY_SEGMENT_TO_CURRENT[k] ?? LEGACY_SEGMENT_TO_CURRENT[k.toUpperCase()] ?? null;
}

function isSegment(x: unknown): x is DeliverySegmentComputed {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.core_conclusion !== "string" || !o.core_conclusion.trim()) return false;
  if (!Array.isArray(o.bazi_basis)) return false;
  return o.bazi_basis.every((b) => typeof b === "string");
}

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
export function validateDeliveryComputed(raw: unknown): ValidateDeliveryComputedResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, severity: "fatal", reason: "not_object" };
  }
  const o = raw as Record<string, unknown>;
  const out = {} as DeliveryComputed;
  const missing: string[] = [];

  for (const k of DELIVERY_SEGMENT_KEYS) {
    const candidate = candidateForKey(o, k);
    if (!isSegment(candidate)) {
      missing.push(k);
      continue;
    }
    out[k] = {
      core_conclusion: candidate.core_conclusion.trim(),
      bazi_basis: candidate.bazi_basis.map((b) => String(b).trim()).filter(Boolean),
    };
  }

  if (missing.length === DELIVERY_SEGMENT_KEYS.length) {
    return { ok: false, severity: "fatal", reason: `missing_all:${missing.join(",")}` };
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
};

/** Fill missing sections from partial / empty object. */
export function fillMissingDeliverySegments(raw: unknown): DeliveryComputed {
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out = {} as DeliveryComputed;
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const candidate = candidateForKey(base, k);
    if (isSegment(candidate)) {
      out[k] = {
        core_conclusion: candidate.core_conclusion.trim(),
        bazi_basis: candidate.bazi_basis.map((b) => String(b).trim()).filter(Boolean),
      };
    } else {
      out[k] = { ...PLACEHOLDER };
    }
  }
  return out;
}

/**
 * One independent argument = plain body + its own evidence.
 * Evidence is raw 命理 until the mark step; then marked ⟦t:…⟧.
 */
export interface DeliveryArgument {
  body: string;
  evidence?: string;
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
      const body =
        (typeof item.body === "string" && item.body.trim()) ||
        (typeof item.text === "string" && item.text.trim()) ||
        (typeof item.正文 === "string" && item.正文.trim()) ||
        "";
      const evidence =
        (typeof item.evidence === "string" && item.evidence.trim()) ||
        (typeof item.依据 === "string" && item.依据.trim()) ||
        (typeof item["依据与推理"] === "string" && item["依据与推理"].trim()) ||
        undefined;
      if (body || evidence) {
        out.push({ body: body || "", evidence });
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
    }));
  }
  return out;
}

export function mergeDeliveryTextTrees(
  trees: readonly Record<string, unknown>[],
): DeliveryTextTree {
  return argumentTreeToTextTree(mergeDeliveryArgumentTrees(trees));
}
