/**
 * P3/P4 Rx argument shape: each module = strategy + methods (not a single prose blob).
 * Persisted in body as labeled markdown; UI parses back for dual-part layout.
 */

const STRATEGY_HEAD =
  /(?:^|\n)\s*(?:\*\*)?(?:策略|Strategy)(?:\*\*)?\s*[:：]\s*/i;
const METHODS_HEAD =
  /(?:^|\n)\s*(?:\*\*)?(?:手段|Methods|Means)(?:\*\*)?\s*[:：]\s*/i;

export type RxArgumentParts = {
  title?: string;
  strategy: string;
  methods: string;
};

/** Compose ### title + **策略:** + **手段:** for persistence / mark pipeline. */
export function composeRxArgumentBody(parts: RxArgumentParts): string {
  const title = (parts.title ?? "").replace(/^#+\s*/, "").trim() || "药方要点";
  const strategy = parts.strategy.trim();
  const methods = parts.methods.trim();
  return (
    `### ${title}\n\n` +
    `**策略:**\n${strategy}\n\n` +
    `**手段:**\n${methods}`
  ).trim();
}

export type ParsedRxBody = {
  /** Body with strategy/methods blocks removed (usually empty when fully structured). */
  remainder: string;
  strategy?: string;
  methods?: string;
};

/**
 * Split a module body into strategy / methods when labeled.
 * Tolerates missing one side (returns whatever is present).
 */
export function parseRxStrategyMethods(body: string): ParsedRxBody {
  const text = (body ?? "").trim();
  if (!text) return { remainder: "" };

  const stratMatch = STRATEGY_HEAD.exec(text);
  const methMatch = METHODS_HEAD.exec(text);
  if (!stratMatch && !methMatch) {
    return { remainder: text };
  }

  let strategy: string | undefined;
  let methods: string | undefined;
  let remainder = text;

  if (stratMatch && methMatch) {
    const stratIdx = stratMatch.index + (stratMatch[0].startsWith("\n") ? 1 : 0);
    const methIdx = methMatch.index + (methMatch[0].startsWith("\n") ? 1 : 0);
    if (stratIdx < methIdx) {
      strategy = text.slice(stratMatch.index + stratMatch[0].length, methMatch.index).trim();
      methods = text.slice(methMatch.index + methMatch[0].length).trim();
      remainder = text.slice(0, stratMatch.index).trim();
    } else {
      methods = text.slice(methMatch.index + methMatch[0].length, stratMatch.index).trim();
      strategy = text.slice(stratMatch.index + stratMatch[0].length).trim();
      remainder = text.slice(0, methMatch.index).trim();
    }
  } else if (stratMatch) {
    strategy = text.slice(stratMatch.index + stratMatch[0].length).trim();
    remainder = text.slice(0, stratMatch.index).trim();
  } else if (methMatch) {
    methods = text.slice(methMatch.index + methMatch[0].length).trim();
    remainder = text.slice(0, methMatch.index).trim();
  }

  // Drop a lone ### title left in remainder (title already on module).
  remainder = remainder.replace(/^###\s+[^\n]+\n*/u, "").trim();

  return {
    remainder,
    strategy: strategy || undefined,
    methods: methods || undefined,
  };
}

/** True when body (or structured fields) has both strategy and methods material. */
export function rxArgumentHasStrategyAndMethods(input: {
  body?: string;
  strategy?: string;
  methods?: string;
}): boolean {
  const s = (input.strategy ?? "").trim();
  const m = (input.methods ?? "").trim();
  if (s.length >= 8 && m.length >= 8) return true;
  const parsed = parseRxStrategyMethods(input.body ?? "");
  return (
    (parsed.strategy?.trim().length ?? 0) >= 8 &&
    (parsed.methods?.trim().length ?? 0) >= 8
  );
}
