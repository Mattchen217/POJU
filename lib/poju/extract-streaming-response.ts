function unwrapMarkdownJson(raw: string): string {
  return raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
}

/**
 * Read a JSON string starting at `startQuote` (`"`).
 * Tolerates unescaped `"` inside the value: a quote is the real end only when
 * the next non-whitespace char is `,` / `}` / `]` / EOF.
 * Properly escaped `\"` is still handled first via the escape path.
 */
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
    if (ch === '"') {
      let j = i + 1;
      while (j < trimmed.length && /\s/.test(trimmed[j]!)) j++;
      const next = trimmed[j];
      // Real JSON string end is followed by structural tokens — not `:` (that ends keys).
      if (next === undefined || next === "," || next === "}" || next === "]") {
        return { value: out, end: i + 1 };
      }
      // Content quote the model forgot to escape — keep reading.
      out += ch;
      continue;
    }
    out += ch;
  }
  return { value: out, end: i };
}

/** True when `quoteIdx` opens a JSON *value* string (after `:`), not a key. */
function isJsonStringValueStart(trimmed: string, quoteIdx: number): boolean {
  let k = quoteIdx - 1;
  while (k >= 0 && /\s/.test(trimmed[k]!)) k--;
  return k >= 0 && trimmed[k] === ":";
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

/** Known sibling keys after `response` in opening / collecting / bridge envelopes. */
const RESPONSE_FOLLOWER_KEYS =
  "options|understanding_sufficient|scope_signal|core_dilemma|desired_direction|agenda_updates|reply_quality|question_status|session_action|reply|message";

/**
 * Last-resort: grab response value until the next known sibling key,
 * even when the string contains unescaped ASCII double quotes.
 */
export function extractResponseGreedy(raw: string): string {
  const re = new RegExp(
    `"response"\\s*:\\s*"([\\s\\S]*?)"\\s*,\\s*"(?:${RESPONSE_FOLLOWER_KEYS})"`,
  );
  const m = raw.match(re);
  if (!m?.[1]) return "";
  return m[1]
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

const SALVAGE_FIELD_ORDER = ["response", "reply", "message", "content", "text", "answer"] as const;

function stripReasoningPrefix(raw: string): string {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  if (jsonStart <= 0) return trimmed;
  const prefix = trimmed.slice(0, jsonStart).trim();
  if (prefix.length < 16) return trimmed;
  if (/"response"\s*:/.test(prefix)) return trimmed;
  return trimmed.slice(jsonStart);
}

function looksLikeJsonStructure(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.startsWith("{") || t.startsWith("[")) return true;
  return /"response"\s*:/.test(t) || /"reply"\s*:/.test(t);
}

function salvageProseFallback(trimmed: string): string {
  if (looksLikeJsonStructure(trimmed)) return "";
  const prose = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  if (prose.length < 12) return "";
  if (prose.startsWith("[POJU]")) return "";
  return prose;
}

/** Longest string literal in JSON — last-resort salvage for mis-shaped provider output. */
function extractLongestJsonStringLiteral(trimmed: string, minLength = 24): string {
  let best = "";
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] !== '"') continue;
    if (!isJsonStringValueStart(trimmed, i)) continue;
    const { value } = readJsonStringAt(trimmed, i);
    if (value.length < minLength) continue;
    if (/^[a-z][a-z0-9_]*$/i.test(value)) continue;
    if (value.length > best.length) best = value;
  }
  return best;
}

/**
 * Best-effort salvage of user-visible reply text from phase JSON (complete or broken).
 * Order: parsed fields → partial field extract → greedy response → longest prose-like string.
 */
export function salvagePhaseResponseText(raw: string): string {
  let trimmed = unwrapMarkdownJson(raw);
  if (!trimmed) return "";

  trimmed = stripReasoningPrefix(trimmed);

  const complete = extractFromCompleteJson(trimmed);
  if (complete) return complete;

  for (const field of SALVAGE_FIELD_ORDER) {
    const partial = extractJsonStringField(trimmed, field).trim();
    if (partial) return partial;
  }

  const greedy = extractResponseGreedy(trimmed);
  if (greedy) return greedy;

  const longest = extractLongestJsonStringLiteral(trimmed);
  if (longest) return longest;

  return salvageProseFallback(trimmed);
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
