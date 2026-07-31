/**
 * POJU Phase 4 delivery book · dual-key SSOT for 9 prose sections
 * (preface + 7 parts + epilogue). Cover / TOC / appendix are merge-time.
 */

export type DeliverySegmentKey =
  | "preface"
  | "energy"
  | "situation"
  | "crossroads"
  | "action"
  | "retune"
  | "rhythm"
  | "awareness"
  | "epilogue";

export const DELIVERY_SEGMENT_KEYS: readonly DeliverySegmentKey[] = [
  "preface",
  "energy",
  "situation",
  "crossroads",
  "action",
  "retune",
  "rhythm",
  "awareness",
  "epilogue",
] as const;

/** Transition sections: plain narrative only — no per-argument evidence. */
export const DELIVERY_TRANSITION_KEYS = new Set<DeliverySegmentKey>([
  "preface",
  "epilogue",
]);

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
  { zh: string; en: string; partNo: string }
> = {
  preface: {
    zh: "序言 · 关于这份报告",
    en: "Preface · About This Report",
    partNo: "0",
  },
  energy: {
    zh: "第一部分 · 你的能量结构",
    en: "Part I · Your Energy Structure",
    partNo: "1",
  },
  situation: {
    zh: "第二部分 · 处境深度剖析",
    en: "Part II · Situation Diagnosis",
    partNo: "2",
  },
  crossroads: {
    zh: "第三部分 · 关键抉择分析",
    en: "Part III · Key Crossroads",
    partNo: "3",
  },
  action: {
    zh: "第四部分 · 破局方案·现代行动",
    en: "Part IV · Modern Action Plan",
    partNo: "4",
  },
  retune: {
    zh: "第五部分 · 破局方案·能量调频",
    en: "Part V · Energy Retune Plan",
    partNo: "5",
  },
  rhythm: {
    zh: "第六部分 · 执行路径·30天节奏",
    en: "Part VI · 30-Day Rhythm",
    partNo: "6",
  },
  awareness: {
    zh: "第七部分 · 自我觉察指南",
    en: "Part VII · Self-Awareness Guide",
    partNo: "7",
  },
  epilogue: {
    zh: "结语 · 独立走下去",
    en: "Epilogue · Walk On Your Own",
    partNo: "8",
  },
};

/** Legacy A–F → book keys (old sessions / tests). */
export const LEGACY_LETTER_TO_SEGMENT: Record<string, DeliverySegmentKey> = {
  A: "situation",
  B: "crossroads",
  C: "action",
  D: "retune",
  E: "rhythm",
  F: "awareness",
};

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

/** Accept book keys or legacy A–F keys. */
export function validateDeliveryComputed(raw: unknown): ValidateDeliveryComputedResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, severity: "fatal", reason: "not_object" };
  }
  const o = raw as Record<string, unknown>;
  const out = {} as DeliveryComputed;
  const missing: string[] = [];

  for (const k of DELIVERY_SEGMENT_KEYS) {
    const legacyLetter = Object.entries(LEGACY_LETTER_TO_SEGMENT).find(([, v]) => v === k)?.[0];
    const candidate = o[k] ?? (legacyLetter ? o[legacyLetter] : undefined);
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
    const legacyLetter = Object.entries(LEGACY_LETTER_TO_SEGMENT).find(([, v]) => v === k)?.[0];
    const candidate = base[k] ?? (legacyLetter ? base[legacyLetter] : undefined);
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
    for (const k of DELIVERY_SEGMENT_KEYS) {
      const legacyLetter = Object.entries(LEGACY_LETTER_TO_SEGMENT).find(([, v]) => v === k)?.[0];
      const v = tree[k] ?? (legacyLetter ? tree[legacyLetter] : undefined);
      const args = coerceDeliveryArguments(v);
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
