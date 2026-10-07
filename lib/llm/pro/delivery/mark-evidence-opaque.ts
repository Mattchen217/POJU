/**
 * Foreign mark structural helpers — stop whack-a-mole on EN slot drops.
 *
 * 1) Strip parenthetical five-element cycle glosses `(⟦w:土⟧生⟦w:金⟧)` before mark.
 *    Those chips are not load-bearing gold; they inflate density and invite cycle-gloss fails.
 * 2) Opaque numbered slots `⟦#1⟧…⟦#N⟧` for non-zh mark so the model cannot absorb a
 *    duplicate 真词 into vernacular anaphora ("pump it back up" dropping the 2nd 用神火).
 */

/** Local shape — mirrors MarkEvidenceArgInput without importing the prompt module (cycle-safe). */
type MarkArgIn = { body: string; evidence: string };

const ELEMENT_ATOM = "[木火土金水]";

/** `（⟦w:土⟧生⟦w:金⟧）` / `(⟦w:土⟧生⟦w:金⟧)` — drop; keep the surrounding claim slots. */
const ELEMENT_CYCLE_PAREN_RE = new RegExp(
  `[（(]\\s*⟦(?:w|词):(${ELEMENT_ATOM}+)⟧\\s*生\\s*⟦(?:w|词):(${ELEMENT_ATOM}+)⟧\\s*[）)]`,
  "g",
);

/**
 * Remove parenthetical element-cycle gloss slots. Idempotent.
 * Does not touch load-bearing slots outside the parentheses.
 */
export function stripElementCycleParentheticalSlots(text: string): string {
  const src = text ?? "";
  if (!src.includes("⟧")) return src;
  return src
    .replace(ELEMENT_CYCLE_PAREN_RE, "")
    .replace(/[，,]{2,}/g, "，")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const OPAQUE_SLOT_RE = /⟦#(\d+)⟧/g;
const WORD_SLOT_RE = /⟦(?:w|词):([^⟧]+)⟧/g;

export function toOpaqueWordSlots(evidence: string): {
  text: string;
  interiors: string[];
  legend: string;
} {
  const interiors: string[] = [];
  const text = (evidence ?? "").replace(WORD_SLOT_RE, (_m, inner: string) => {
    interiors.push(String(inner ?? "").trim());
    return `⟦#${interiors.length}⟧`;
  });
  const legend =
    interiors.length === 0
      ? ""
      : interiors.map((t, i) => `#${i + 1}=${t}`).join(" · ");
  return { text, interiors, legend };
}

/**
 * Restore `⟦#N⟧` → `⟦w:真词⟧`. Requires sequential #1…#N with exact count.
 * If output already has `⟦w:⟧` and no opaque markers, pass through (legacy / zh).
 */
export function fromOpaqueWordSlots(
  output: string,
  interiors: string[],
): { ok: true; text: string } | { ok: false; reason: string } {
  const raw = output ?? "";
  if (interiors.length === 0) {
    return { ok: true, text: raw };
  }
  const opaqueHits = [...raw.matchAll(OPAQUE_SLOT_RE)];
  if (opaqueHits.length === 0) {
    // Model ignored opaque protocol and kept/wrote w-slots — accept for validate.
    return { ok: true, text: raw };
  }
  if (opaqueHits.length !== interiors.length) {
    return {
      ok: false,
      reason: `mark_opaque_count:${opaqueHits.length}/${interiors.length}`,
    };
  }
  for (let i = 0; i < opaqueHits.length; i++) {
    const n = Number(opaqueHits[i]![1]);
    if (n !== i + 1) {
      return { ok: false, reason: `mark_opaque_order:expected_${i + 1}_got_${n}` };
    }
  }
  let i = 0;
  const text = raw.replace(OPAQUE_SLOT_RE, () => `⟦w:${interiors[i++]}⟧`);
  return { ok: true, text };
}

export type ShapedMarkEvidence = {
  /** Segments for duty / thin-seam listing (still `⟦w:⟧`). */
  dutySegments: Record<string, { arguments: MarkArgIn[] }>;
  /** Segments put in the LLM JSON payload (opaque for foreign). */
  promptSegments: Record<string, { arguments: MarkArgIn[] }>;
  /** Validate gate against these evidences (shaped `⟦w:⟧`). */
  validateSegments: Record<string, { arguments: MarkArgIn[] }>;
  /** path → per-arg interiors; null when zh (no opaque). */
  opaqueInteriors: Record<string, string[][]> | null;
  /** Read-only legend block for the user prompt (foreign only). */
  legendBlock: string;
};

function mapEvidence(
  segments: Record<string, { arguments: MarkArgIn[] }>,
  mapEv: (evidence: string) => string,
): Record<string, { arguments: MarkArgIn[] }> {
  const out: Record<string, { arguments: MarkArgIn[] }> = {};
  for (const [k, pack] of Object.entries(segments)) {
    out[k] = {
      arguments: (pack.arguments ?? []).map((a) => ({
        body: a.body,
        evidence: mapEv(a.evidence ?? ""),
      })),
    };
  }
  return out;
}

/**
 * Shape mark input once for prompt + validate + restore.
 * Foreign: strip cycle parens → opaque numbered slots + legend.
 * Zh: strip cycle parens only.
 */
export function shapeMarkEvidenceForLocale(
  segments: Record<string, { arguments: MarkArgIn[] }>,
  locale: string,
): ShapedMarkEvidence {
  const stripped = mapEvidence(segments, stripElementCycleParentheticalSlots);
  const zh = locale.trim().toLowerCase().startsWith("zh");
  if (zh) {
    return {
      dutySegments: stripped,
      promptSegments: stripped,
      validateSegments: stripped,
      opaqueInteriors: null,
      legendBlock: "",
    };
  }

  const opaqueInteriors: Record<string, string[][]> = {};
  const promptSegments: Record<string, { arguments: MarkArgIn[] }> = {};
  const legendParts: string[] = [];

  for (const [k, pack] of Object.entries(stripped)) {
    const argInteriors: string[][] = [];
    promptSegments[k] = {
      arguments: (pack.arguments ?? []).map((a, i) => {
        const { text, interiors, legend } = toOpaqueWordSlots(a.evidence ?? "");
        argInteriors.push(interiors);
        if (legend) {
          legendParts.push(`${k}[${i}]: ${legend}`);
        }
        return { body: a.body, evidence: text };
      }),
    };
    opaqueInteriors[k] = argInteriors;
  }

  const legendBlock =
    legendParts.length === 0
      ? ""
      : `\n\n# Slot legend (READ ONLY — understand causality; do NOT paste 真词 into connective)\n${legendParts.join("\n")}\n`;

  return {
    dutySegments: stripped,
    promptSegments,
    validateSegments: stripped,
    opaqueInteriors,
    legendBlock,
  };
}
