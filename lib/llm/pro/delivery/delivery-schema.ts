/**
 * POJU Phase 4 delivery book · dual-key SSOT for 9 prose pages
 * (P1–P9). Cover / TOC / appendix are merge-time.
 *
 * Pivot 第4段 · 新 9 页：P3/P4/P6 独立；P9 无回来钩子。
 */

export type DeliverySegmentKey =
  | "energy_base"
  | "talent_map"
  | "spirit_gifts"
  | "macro_cycle"
  | "science_action"
  | "metaphysics_action"
  | "thirty_day"
  | "risk_guard"
  | "signals_close";

export const DELIVERY_SEGMENT_KEYS: readonly DeliverySegmentKey[] = [
  "energy_base",
  "talent_map",
  "spirit_gifts",
  "macro_cycle",
  "science_action",
  "metaphysics_action",
  "thirty_day",
  "risk_guard",
  "signals_close",
] as const;

/**
 * Transition sections: plain narrative only — no per-argument evidence.
 * New 9-page book: all pages carry dual-key evidence (P9 close is not a hook transition).
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

export const DELIVERY_SECTION_HEADINGS: Record<
  DeliverySegmentKey,
  { zh: string; en: string; es: string; de: string; fr: string; partNo: string }
> = {
  energy_base: {
    zh: "能量底座与核心洞察",
    en: "Core Energy & Key Insights",
    es: "Energía Base e Insights Clave",
    de: "Core Energy & Key Insights",
    fr: "Énergie de Base & Aperçus Clés",
    partNo: "1",
  },
  talent_map: {
    zh: "天赋潜能与行为驱动力",
    en: "Talent Blueprint & Behavioral Drivers",
    es: "Plan de Talento e Impulsores de Conducta",
    de: "Talent Blueprint & Behavioral Drivers",
    fr: "Schéma des Talents & Moteurs Comportementaux",
    partNo: "2",
  },
  spirit_gifts: {
    zh: "核心优势与状态调频",
    en: "Core Strengths & Energy Alignment",
    es: "Fortalezas Clave y Alineación Energética",
    de: "Core Strengths & Energy Alignment",
    fr: "Forces Clés & Alignement Énergétique",
    partNo: "3",
  },
  macro_cycle: {
    zh: "个人周期与战略窗口",
    en: "Life Cycles & Strategic Windows",
    es: "Ciclos Personales y Ventanas Estratégicas",
    de: "Life Cycles & Strategic Windows",
    fr: "Cycles Personnels & Fenêtres Stratégiques",
    partNo: "4",
  },
  science_action: {
    zh: "行为策略：行动指南",
    en: "Behavioral Strategy: Action Plan",
    es: "Estrategia Conductual: Plan de Acción",
    de: "Behavioral Strategy: Action Plan",
    fr: "Stratégie Comportementale : Plan d'Action",
    partNo: "5",
  },
  metaphysics_action: {
    zh: "环境调频：空间·色彩·高频时段·协同人群",
    en: "Environmental Tuning: Space, Color, Peak Hours & Synergy",
    es: "Ajuste Ambiental: Espacio, Color, Horas Pico y Sinergia",
    de: "Environmental Tuning: Space, Color, Peak Hours & Synergy",
    fr: "Harmonie Environnementale : Espace, Couleur, Heures de Pointe & Synergie",
    partNo: "6",
  },
  thirty_day: {
    zh: "30天能量推进计划",
    en: "30-Day Action Roadmap",
    es: "Hoja de Ruta de Acción de 30 Días",
    de: "30-Day Action Roadmap",
    fr: "Feuille de Route d'Action sur 30 Jours",
    partNo: "7",
  },
  risk_guard: {
    zh: "风险预警与边界建立",
    en: "Risk Assessment & Boundary Setup",
    es: "Evaluación de Riesgos y Definición de Límites",
    de: "Risk Assessment & Boundary Setup",
    fr: "Évaluation des Risques & Établissement des Limites",
    partNo: "8",
  },
  signals_close: {
    zh: "突破信号与总结",
    en: "Breakthrough Signals & Summary",
    es: "Señales de Avance y Resumen",
    de: "Breakthrough Signals & Summary",
    fr: "Signaux de Déclic & Résumé",
    partNo: "9",
  },
};

/**
 * Legacy A–F letter keys + old 9-segment book keys → current page keys.
 * Used when reading old sessions / LLM aliases.
 */
export const LEGACY_SEGMENT_TO_CURRENT: Record<string, DeliverySegmentKey> = {
  // Old Phase-4 book keys
  preface: "energy_base",
  energy: "energy_base",
  situation: "talent_map",
  crossroads: "spirit_gifts",
  action: "science_action",
  retune: "metaphysics_action",
  rhythm: "thirty_day",
  awareness: "risk_guard",
  epilogue: "signals_close",
  // Legacy A–F
  A: "talent_map",
  B: "spirit_gifts",
  C: "science_action",
  D: "metaphysics_action",
  E: "thirty_day",
  F: "risk_guard",
};

/** @deprecated Prefer LEGACY_SEGMENT_TO_CURRENT — kept for letter-only callers. */
export const LEGACY_LETTER_TO_SEGMENT: Record<string, DeliverySegmentKey> = {
  A: "talent_map",
  B: "spirit_gifts",
  C: "science_action",
  D: "metaphysics_action",
  E: "thirty_day",
  F: "risk_guard",
};

/** First prose page — unlocks streamed book chrome (replaces old preface gate). */
export const DELIVERY_BOOTSTRAP_SEGMENT: DeliverySegmentKey = "energy_base";

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
