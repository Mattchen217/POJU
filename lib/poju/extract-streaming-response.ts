import { parsePhaseResult } from "@/lib/llm/phases/phase-transport";

/** Best-effort extract of the `response` field while JSON is still streaming. */
export function extractStreamingResponseText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const { response } = parsePhaseResult(trimmed);
    if (response) return response;
  } catch {
    // partial JSON — fall through
  }

  const keyIdx = trimmed.indexOf('"response"');
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
