function unwrapMarkdownJson(raw: string): string {
  return raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
}

function readJsonStringAt(trimmed: string, startQuote: number): { value: string; end: number } {
  let i = startQuote + 1;
  let out = "";
  let escaped = false;
  for (; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (escaped) {
      if (ch === "n") out += "\n";
      else if (ch === "t") out += "\t";
      else if (ch === "r") out += "\r";
      else out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') return { value: out, end: i + 1 };
    out += ch;
  }
  return { value: out, end: i };
}

function extractFromCompleteJson(trimmed: string): string | null {
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return pickResponseLikeField(parsed);
  } catch {
    return null;
  }
}

function pickResponseLikeField(parsed: Record<string, unknown>): string | null {
  const keys = ["response", "reply", "message", "content", "text", "answer"] as const;
  for (const key of keys) {
    const v = parsed[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const nested = v as Record<string, unknown>;
      if (typeof nested.content === "string" && nested.content.trim()) return nested.content.trim();
      if (typeof nested.text === "string" && nested.text.trim()) return nested.text.trim();
    }
  }
  return null;
}

export function extractJsonStringField(trimmed: string, field: string): string {
  const keyIdx = trimmed.indexOf(`"${field}"`);
  if (keyIdx < 0) return "";

  const colonIdx = trimmed.indexOf(":", keyIdx);
  if (colonIdx < 0) return "";

  let i = colonIdx + 1;
  while (i < trimmed.length && /\s/.test(trimmed[i]!)) i++;
  if (trimmed[i] !== '"') return "";

  return readJsonStringAt(trimmed, i).value;
}

const SALVAGE_FIELD_ORDER = ["response", "reply", "message", "content", "text", "answer"] as const;

/** Longest string literal in JSON — last-resort salvage for mis-shaped provider output. */
function extractLongestJsonStringLiteral(trimmed: string, minLength = 24): string {
  let best = "";
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] !== '"') continue;
    const { value } = readJsonStringAt(trimmed, i);
    if (value.length < minLength) continue;
    if (/^[a-z][a-z0-9_]*$/i.test(value)) continue;
    if (value.length > best.length) best = value;
  }
  return best;
}

/**
 * Best-effort salvage of user-visible reply text from phase JSON (complete or broken).
 * Order: parsed fields → partial field extract → longest prose-like string literal.
 */
export function salvagePhaseResponseText(raw: string): string {
  const trimmed = unwrapMarkdownJson(raw);
  if (!trimmed) return "";

  const complete = extractFromCompleteJson(trimmed);
  if (complete) return complete;

  for (const field of SALVAGE_FIELD_ORDER) {
    const partial = extractJsonStringField(trimmed, field).trim();
    if (partial) return partial;
  }

  return extractLongestJsonStringLiteral(trimmed);
}

/** Best-effort extract of the `response` field while JSON is still streaming. */
export function extractStreamingResponseText(raw: string): string {
  const trimmed = unwrapMarkdownJson(raw);
  if (!trimmed) return "";

  const complete = extractFromCompleteJson(trimmed);
  if (complete !== null) return complete;

  for (const field of ["response", "reply"] as const) {
    const partial = extractJsonStringField(trimmed, field);
    if (partial) return partial;
  }

  return "";
}
