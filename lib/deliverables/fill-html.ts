/**
 * Fill deliverable HTML templates by replacing {{SLOT_*}} tokens only.
 */

const SLOT_TOKEN_RE = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;

const EMPTY_BODY = '<p class="slot-empty">—</p>';

function defaultForSlot(key: string): string {
  if (/^SLOT_BODY_/.test(key) || /^SLOT_DAY_/.test(key)) return EMPTY_BODY;
  if (key === "SLOT_GLOSSARY_JSON") return "[]";
  if (key === "SLOT_AUDIO_HTML") return "";
  return "—";
}

/**
 * Replace every {{KEY}} with slots[KEY] when provided.
 * Missing keys → "—" (body/day slots → `<p class="slot-empty">—</p>`).
 * Escape is the caller's responsibility for HTML-valued slots.
 */
export function fillDeliverableHtml(
  template: string,
  slots: Record<string, string>,
): string {
  return template.replace(SLOT_TOKEN_RE, (_match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(slots, key)) {
      return slots[key] ?? defaultForSlot(key);
    }
    return defaultForSlot(key);
  });
}

/** Unique slot keys in document order of first appearance. */
export function listTemplateSlots(template: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const re = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    const key = m[1];
    if (!seen.has(key)) {
      seen.add(key);
      found.push(key);
    }
  }
  return found;
}

/**
 * Blank the content of each deliverable slot while retaining its wrapper.
 * Slot bodies are generated HTML and may contain nested divs, so a non-greedy
 * `.*?</div>` matcher would stop at the first child rather than the slot end.
 */
function blankDeliverableSlotBodies(html: string): string {
  const openingDiv = /<div\b[^>]*>/gi;
  const divTags = /<\/?div\b[^>]*>/gi;
  let cursor = 0;
  let output = "";
  let match: RegExpExecArray | null;

  while ((match = openingDiv.exec(html)) !== null) {
    const openTag = match[0];
    const classMatch = openTag.match(/\bclass\s*=\s*(["'])(.*?)\1/i);
    if (!classMatch || !classMatch[2].split(/\s+/).includes("deliverable-slot")) continue;

    divTags.lastIndex = openingDiv.lastIndex;
    let depth = 1;
    let closingStart = -1;
    let closingEnd = -1;
    let tag: RegExpExecArray | null;
    while ((tag = divTags.exec(html)) !== null) {
      if (/^<\s*\//.test(tag[0])) depth--;
      else if (!/\/\s*>$/.test(tag[0])) depth++;
      if (depth === 0) {
        closingStart = tag.index;
        closingEnd = divTags.lastIndex;
        break;
      }
    }
    if (closingStart < 0) continue;

    output += html.slice(cursor, openingDiv.lastIndex) + html.slice(closingStart, closingEnd);
    cursor = closingEnd;
    openingDiv.lastIndex = closingEnd;
  }
  return output + html.slice(cursor);
}

/**
 * Assert fill did not change the chrome/tag skeleton outside slot bodies.
 * Slot containers (`.deliverable-slot`) and {{SLOT_*}} tokens are blanked first
 * so filled HTML fragments inside slots do not count as structure drift.
 */
export function assertSkeletonUnchanged(before: string, after: string): void {
  const normalized = (html: string): string =>
    blankDeliverableSlotBodies(html)
      .replace(/\{\{[A-Z][A-Z0-9_]*\}\}/g, "")
      .replace(/<p class="slot-empty">—<\/p>/g, "")
      // Drop script payloads (glossary JSON, etc.) — content-only.
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "<script></script>")
      // Slot values often land in attributes (lang, title, aria-label).
      .replace(/(\s[\w-:]+=")[^"]*(")/g, "$1$2")
      .replace(/>[^<]*</g, "><")
      .replace(/\s+/g, "");

  if (normalized(before) !== normalized(after)) {
    throw new Error(
      "Deliverable HTML tag skeleton changed during fill (chrome/structure drift)",
    );
  }
}
