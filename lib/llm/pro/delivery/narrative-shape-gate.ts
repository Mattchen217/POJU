import { rxArgumentHasStrategyAndMethods } from "@/lib/llm/pro/delivery/rx-argument-shape";

/**
 * Narrative shape gates — prevent hollow delivery pages
 * (duplicate JSON "body" keys collapse to 1 arg; model returns a single blob).
 */

/** Detect object-literal with 2+ "body" keys (JSON.parse keeps only the last). */
export function rawNarrativeHasDuplicateBodyKeys(raw: string): boolean {
  const text = raw?.trim() ?? "";
  if (!text) return false;
  // Look inside arguments array elements for repeated "body" keys in one object.
  // Pattern: { ... "body": ... "body": ... } without a closing } between them.
  const argsMatch = text.match(/"arguments"\s*:\s*\[([\s\S]*?)\]/);
  const slice = argsMatch?.[1] ?? text;
  // Split on top-level object boundaries is hard; scan for `"body"` count between `{` and `}`.
  let depth = 0;
  let bodyCount = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < slice.length; i++) {
    const ch = slice[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      // Check if this starts "body"
      if (slice.slice(i, i + 6) === '"body"') {
        if (depth === 1) bodyCount += 1;
        if (bodyCount >= 2) return true;
      }
      continue;
    }
    if (ch === "{") {
      depth += 1;
      if (depth === 1) bodyCount = 0;
      continue;
    }
    if (ch === "}") {
      if (depth === 1 && bodyCount >= 2) return true;
      depth = Math.max(0, depth - 1);
      if (depth === 0) bodyCount = 0;
    }
  }
  return false;
}

/** After coerce: each content segment must have ≥2 argument bodies (non-transition). */
export function narrativeArgumentCountOk(
  count: number,
  opts?: { min?: number },
): boolean {
  const min = opts?.min ?? 2;
  return count >= min;
}

export type NarrativeShapeGateResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Gate narrative raw + coerced arg counts for the requested paths.
 */
export function validateNarrativeShape(input: {
  raw: string;
  argCounts: Readonly<Record<string, number>>;
  paths: readonly string[];
  minArgs?: number;
  /** Per-path argument bodies (after coerce) — used for P3/P4 Rx gate. */
  argBodies?: Readonly<Record<string, readonly { body?: string; strategy?: string; methods?: string }[]>>;
}): NarrativeShapeGateResult {
  if (rawNarrativeHasDuplicateBodyKeys(input.raw)) {
    return { ok: false, reason: "narrative_dup_body_keys" };
  }
  const min = input.minArgs ?? 2;
  for (const k of input.paths) {
    const n = input.argCounts[k] ?? 0;
    if (!narrativeArgumentCountOk(n, { min })) {
      return { ok: false, reason: `narrative_too_few_args:${k}:${n}` };
    }
    if (k === "science_action" || k === "metaphysics_action") {
      const args = input.argBodies?.[k] ?? [];
      for (let i = 0; i < args.length; i++) {
        if (!rxArgumentHasStrategyAndMethods(args[i]!)) {
          return { ok: false, reason: `narrative_rx_incomplete:${k}:${i}` };
        }
      }
    }
  }
  return { ok: true };
}
