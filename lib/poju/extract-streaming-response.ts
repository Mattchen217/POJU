function unwrapMarkdownJson(raw: string): string {
  return raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
}

function extractFromCompleteJson(trimmed: string): string | null {
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof parsed.response === "string") return parsed.response;
    if (typeof parsed.reply === "string") return parsed.reply;
    return null;
  } catch {
    return null;
  }
}

function extractJsonStringField(trimmed: string, field: "response" | "reply"): string {
  const keyIdx = trimmed.indexOf(`"${field}"`);
  if (keyIdx < 0) return "";

  const colonIdx = trimmed.indexOf(":", keyIdx);
  if (colonIdx < 0) return "";

  let i = colonIdx + 1;
  while (i < trimmed.length && /\s/.test(trimmed[i]!)) i++;
  if (trimmed[i] !== '"') return "";

  i += 1;
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
    if (ch === '"') break;
    out += ch;
  }
  return out;
}

/** Best-effort extract of the `response` field while JSON is still streaming. */
export function extractStreamingResponseText(raw: string): string {
  const trimmed = unwrapMarkdownJson(raw);
  if (!trimmed) return "";

  const complete = extractFromCompleteJson(trimmed);
  if (complete !== null) return complete;

  const response = extractJsonStringField(trimmed, "response");
  if (response) return response;

  return extractJsonStringField(trimmed, "reply");
}
