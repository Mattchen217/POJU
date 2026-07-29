/**
 * POJU Phase 4 delivery · dual-key SSOT for 6 report sections (A–F).
 * Finalize produces this; narrative/evidence expand it; merge → markdown.
 */

export type DeliverySegmentKey = "A" | "B" | "C" | "D" | "E" | "F";

export const DELIVERY_SEGMENT_KEYS: readonly DeliverySegmentKey[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
] as const;

/** Dual-key for one delivery section. */
export interface DeliverySegmentComputed {
  core_conclusion: string;
  bazi_basis: readonly string[];
}

export type DeliveryComputed = Record<DeliverySegmentKey, DeliverySegmentComputed>;

export const DELIVERY_SECTION_HEADINGS: Record<
  DeliverySegmentKey,
  { zh: string; en: string }
> = {
  A: { zh: "A · 回答问题与处境洞察", en: "A · Answer & Situation Insight" },
  B: { zh: "B · 关键抉择与决策特质", en: "B · Key Crossroads & Decision Traits" },
  C: { zh: "C · 现代行动方案", en: "C · Modern Action Plan" },
  D: { zh: "D · 能量调频方案", en: "D · Energy Retune Plan" },
  E: { zh: "E · 提醒与30天节奏", en: "E · Reminders & 30-Day Rhythm" },
  F: { zh: "F · 独立锦囊", en: "F · Independent Toolkit" },
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

export function validateDeliveryComputed(raw: unknown): ValidateDeliveryComputedResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, severity: "fatal", reason: "not_object" };
  }
  const o = raw as Record<string, unknown>;
  const out = {} as DeliveryComputed;
  const missing: string[] = [];
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (!isSegment(o[k])) {
      missing.push(k);
      continue;
    }
    out[k] = {
      core_conclusion: o[k].core_conclusion.trim(),
      bazi_basis: o[k].bazi_basis.map((b) => String(b).trim()).filter(Boolean),
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

/** Fill missing A–F from partial / empty object. */
export function fillMissingDeliverySegments(raw: unknown): DeliveryComputed {
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out = {} as DeliveryComputed;
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (isSegment(base[k])) {
      out[k] = {
        core_conclusion: base[k].core_conclusion.trim(),
        bazi_basis: base[k].bazi_basis.map((b) => String(b).trim()).filter(Boolean),
      };
    } else {
      out[k] = { ...PLACEHOLDER };
    }
  }
  return out;
}

/** Flat text trees from narrative/evidence tasks: { A: string, B: string, ... }. */
export type DeliveryTextTree = Partial<Record<DeliverySegmentKey, string>>;

export function mergeDeliveryTextTrees(
  trees: readonly Record<string, unknown>[],
): DeliveryTextTree {
  const out: DeliveryTextTree = {};
  for (const tree of trees) {
    for (const k of DELIVERY_SEGMENT_KEYS) {
      const v = tree[k];
      if (typeof v === "string" && v.trim()) {
        out[k] = v.trim();
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        const nested = v as Record<string, unknown>;
        const text =
          (typeof nested.text === "string" && nested.text.trim()) ||
          (typeof nested.body === "string" && nested.body.trim()) ||
          (typeof nested["依据与推理"] === "string" && nested["依据与推理"].trim()) ||
          "";
        if (text) out[k] = text;
      }
    }
  }
  return out;
}
