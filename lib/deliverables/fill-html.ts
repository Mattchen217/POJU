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
 * Assert fill did not change the chrome/tag skeleton outside slot bodies.
 * Slot containers (`.deliverable-slot`) and {{SLOT_*}} tokens are blanked first
 * so filled HTML fragments inside slots do not count as structure drift.
 */
export function assertSkeletonUnchanged(before: string, after: string): void {
  const tagSkeleton = (html: string): string =>
    html
      // Ignore filled bodies inside dedicated slot wrappers.
      .replace(
        /<div class="deliverable-slot"[^>]*>[\s\S]*?<\/div>/gi,
        '<div class="deliverable-slot"></div>',
      )
      .replace(/\{\{[A-Z][A-Z0-9_]*\}\}/g, "")
      .replace(/<p class="slot-empty">—<\/p>/g, "")
      // Drop script payloads (glossary JSON, etc.) — content-only.
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "<script></script>")
      // Slot values often land in attributes (lang, title, aria-label).
      .replace(/(\s[\w-:]+=")[^"]*(")/g, "$1$2")
      .replace(/>[^<]*</g, "><")
      .replace(/\s+/g, "");

  if (tagSkeleton(before) !== tagSkeleton(after)) {
    throw new Error(
      "Deliverable HTML tag skeleton changed during fill (chrome/structure drift)",
    );
  }
}
