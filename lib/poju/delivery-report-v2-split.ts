/**
 * Phase-4 delivery v2 — pure split helpers (no React).
 * Body/evidence boundary = evidence label, never "has gold mark?".
 *
 * Merge format (per argument):
 *   bodyN
 *   **依据与推理:**
 *   evidenceN   ← usually one paragraph (merge flattens)
 *   bodyN+1
 *   **依据与推理:**
 *   …
 * So content between two labels is `evidence + following body`, not evidence alone.
 */

export const DELIVERY_V2_EVIDENCE_LABEL_RE =
  /\*\*(?:依据与推理|Evidence\s*&\s*reasoning)[:：]\*\*/;

export type DeliveryV2Block =
  | { kind: "body"; text: string }
  | { kind: "evidence"; text: string };

/**
 * After an evidence label: take evidence until the next body boundary.
 * Boundaries: blank paragraph (`\n\n`) or a markdown `###` heading (even single `\n`).
 */
export function splitEvidenceThenBody(chunk: string): { evidence: string; body: string } {
  const src = chunk.trim();
  if (!src) return { evidence: "", body: "" };

  const blankAt = src.search(/\n\n+/);
  const h3Match = src.match(/\n(?=###\s+)/);
  const h3At = h3Match && h3Match.index != null ? h3Match.index : -1;

  let breakAt = -1;
  if (blankAt >= 0 && h3At >= 0) breakAt = Math.min(blankAt, h3At);
  else if (blankAt >= 0) breakAt = blankAt;
  else if (h3At >= 0) breakAt = h3At;

  // Leading ### (no leading newline) — whole chunk is next body, empty evidence.
  if (/^###\s+/.test(src)) {
    return { evidence: "", body: src };
  }

  if (breakAt < 0) {
    return { evidence: src, body: "" };
  }
  return {
    evidence: src.slice(0, breakAt).trim(),
    body: src.slice(breakAt).trim(),
  };
}

/**
 * Split one section body into body / evidence blocks by evidence label.
 * After each label: first paragraph (or until ###) → evidence; remainder → next body.
 */
export function splitSectionBlocks(sectionBody: string): DeliveryV2Block[] {
  const blocks: DeliveryV2Block[] = [];
  const parts = sectionBody.split(DELIVERY_V2_EVIDENCE_LABEL_RE);

  const pushBody = (text: string) => {
    const t = text.trim();
    if (t) blocks.push({ kind: "body", text: t });
  };
  const pushEvidence = (text: string) => {
    const t = text.trim();
    if (t) blocks.push({ kind: "evidence", text: t });
  };

  pushBody(parts[0] ?? "");

  for (let i = 1; i < parts.length; i++) {
    const chunk = (parts[i] ?? "").trim();
    if (!chunk) continue;
    const { evidence, body } = splitEvidenceThenBody(chunk);
    pushEvidence(evidence);
    pushBody(body);
  }

  return blocks;
}

export type DeliveryV2ProsePart =
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string };

/**
 * Split a body/evidence prose blob on markdown `###` headings (own line or inline).
 * Used so v2 can render model `###` output as real headings.
 */
export function splitProseWithH3(text: string): DeliveryV2ProsePart[] {
  const src = text?.trim() ?? "";
  if (!src) return [];
  // Normalize inline `### Title` into line-based headings for split.
  const normalized = src
    .replace(/([^\n])\s*(###\s+)/g, "$1\n\n$2")
    .replace(/^(###\s+)/gm, "\n$1");
  const parts = normalized.split(/\n(?=###\s+)/);
  const out: DeliveryV2ProsePart[] = [];
  for (const part of parts) {
    const t = part.trim();
    if (!t) continue;
    if (/^###\s+/.test(t)) {
      const nl = t.indexOf("\n");
      const title = (nl >= 0 ? t.slice(0, nl) : t).replace(/^###\s+/, "").trim();
      const rest = nl >= 0 ? t.slice(nl + 1).trim() : "";
      if (title) out.push({ kind: "h3", text: title });
      if (rest) out.push({ kind: "p", text: rest });
    } else {
      out.push({ kind: "p", text: t });
    }
  }
  return out;
}

/** Split full_text on H2 (`## `). Leading cover / H1 blob becomes the first section. */
export function splitSections(fullText: string): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [];
  const parts = fullText.split(/^##\s+/m);
  for (const p of parts) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const nl = p.indexOf("\n");
    if (nl < 0) {
      out.push({ title: trimmed, body: "" });
      continue;
    }
    out.push({
      title: p.slice(0, nl).trim(),
      body: p.slice(nl + 1).trim(),
    });
  }
  return out;
}
