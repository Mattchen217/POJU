/**
 * Namespace-aware final-surface handling for dual-meaning Han tokens.
 *
 * 空亡 / 白虎 are bazi redline but legal qimen structure terms.
 * Never infer namespace from bare surface text.
 *
 * Policy:
 * - confirmed qimen for this **sourceId** only → soft-map bare surfaces in that segment
 * - confirmed bazi / wrong sourceId / no confirmation → hard-strip (caller)
 * - both ns confirmed for same traditional without source split → fail-closed
 * - `⟦t:slug|…⟧`: qm_* prefix alone is NOT enough — must `pojuTermBySlug(slug)?.ns === "qimen"`.
 *   Unknown qm_* + dual-ns traditional → hard-strip (no traditional-fallback resolve).
 *   Known qimen slug + mismatched traditional/soft slot → hard-strip (marker consistency).
 *   Non-qimen slug + dual-ns traditional → hard-strip.
 */

import type { TermNs } from "@/lib/glossary/term-ns";
import {
  pojuTermBySlug,
  termOf,
  toTermLocale,
  type PojuTerm,
  type TermLocale,
} from "@/lib/glossary/pojulife-terms";
import { forbiddenTokensForNamespace } from "@/lib/glossary/term-forbidden-registry";
import { resolvePojuTerm } from "@/lib/glossary/term-resolve";
import { termHanVariants } from "@/lib/glossary/term-han-normalize";

const TERM_MARKER_RE = /⟦t:([^|⟧]+)\|((?:\\.|[^|\\])*?)(?:\|((?:\\.|[^|\\])*?))?⟧/g;
const TERM_MARKER_SPLIT = /(⟦t:[^⟧]*⟧)/g;

export type ConfirmedTermRef = {
  traditional: string;
  namespace: TermNs;
  slug?: string;
  /**
   * Fact-source / paragraph id. Soft-map bare tokens only when sanitize
   * `opts.sourceId` equals this id. Global (no sourceId) confirmed rows
   * never authorize soft-map by themselves when any row carries a sourceId
   * for the same traditional — prevents whole-doc qimen grant.
   */
  sourceId?: string;
};

export type NsAwareSanitizeOpts = {
  /** Structured facts that already know namespace. Never inferred from bare text. */
  confirmed?: readonly ConfirmedTermRef[];
  /** Current text segment's fact-source id (must match ConfirmedTermRef.sourceId). */
  sourceId?: string;
};

let _cachedCrossNs: readonly string[] | null = null;

/**
 * Bazi-forbidden tokens that also resolve under qimen (legal structure terms).
 * Computed once from registries — do not hardcode a parallel ban list.
 */
export function crossNsSoftPreserveHans(): readonly string[] {
  if (_cachedCrossNs) return _cachedCrossNs;
  const out = new Set<string>();
  for (const tok of forbiddenTokensForNamespace("bazi")) {
    const q = resolvePojuTerm(tok, { namespace: "qimen" });
    if (q.status !== "resolved") continue;
    for (const v of termHanVariants(tok)) {
      if (v) out.add(v);
    }
  }
  _cachedCrossNs = [...out].sort((a, b) => b.length - a.length);
  return _cachedCrossNs;
}

export function isCrossNsSoftPreserveHan(han: string): boolean {
  const t = han.trim();
  if (!t) return false;
  const set = new Set(crossNsSoftPreserveHans());
  return termHanVariants(t).some((v) => set.has(v));
}

function matchingConfirmed(
  traditional: string,
  confirmed: readonly ConfirmedTermRef[] | undefined,
): ConfirmedTermRef[] {
  if (!confirmed?.length) return [];
  const variants = new Set(termHanVariants(traditional));
  return confirmed.filter((row) =>
    termHanVariants(row.traditional).some((v) => variants.has(v)),
  );
}

function namespacesConfirmingForSource(
  traditional: string,
  opts?: NsAwareSanitizeOpts,
): Set<TermNs> {
  const out = new Set<TermNs>();
  const rows = matchingConfirmed(traditional, opts?.confirmed);
  if (!rows.length) return out;

  const sourceId = opts?.sourceId?.trim() || "";
  const scoped = rows.filter((r) => r.sourceId?.trim());
  const unscoped = rows.filter((r) => !r.sourceId?.trim());

  // Prefer source-scoped rows when any exist for this traditional.
  if (scoped.length) {
    if (!sourceId) return out; // no segment id → cannot authorize soft-map
    for (const row of scoped) {
      if (row.sourceId!.trim() === sourceId) out.add(row.namespace);
    }
    return out;
  }

  // Legacy unscoped rows only: still require no competing dual grant from mixed lists
  for (const row of unscoped) out.add(row.namespace);
  return out;
}

/** True when qimen is confirmed for this segment and bazi is not. */
export function maySoftMapCrossNsToQimen(
  traditional: string,
  opts?: NsAwareSanitizeOpts,
): boolean {
  const ns = namespacesConfirmingForSource(traditional, opts);
  return ns.has("qimen") && !ns.has("bazi");
}

function mapOutsideMarkers(text: string, mapChunk: (chunk: string) => string): string {
  if (!text.includes("⟦t:")) return mapChunk(text);
  return text
    .split(TERM_MARKER_SPLIT)
    .map((part) => (part.startsWith("⟦t:") && part.endsWith("⟧") ? part : mapChunk(part)))
    .join("");
}

function markerBlobHasCrossNsHan(visible: string, plain: string): string | null {
  const blob = `${visible}\n${plain}`;
  for (const han of crossNsSoftPreserveHans()) {
    if (blob.includes(han)) return han;
  }
  return null;
}

function looksLikeQimenSlugPrefix(slug: string): boolean {
  return slug.trim().toLowerCase().startsWith("qm_");
}

/** Slots must match the slug's traditional / aliases / soft label — no cross-term smuggling. */
function markerSlotsConsistentWithTerm(
  term: PojuTerm,
  visible: string,
  plain: string,
  loc: TermLocale,
): boolean {
  const slots = [visible, plain].map((s) => s.trim()).filter(Boolean);
  if (!slots.length) return true;
  const soft = (termOf(term.slug, loc) || term.term[loc] || "").trim();
  const allowed = new Set<string>();
  for (const han of [term.traditional, ...(term.aliases ?? [])]) {
    for (const v of termHanVariants(han)) {
      if (v) allowed.add(v);
    }
  }
  if (soft) allowed.add(soft);
  return slots.every(
    (slot) => allowed.has(slot) || termHanVariants(slot).some((v) => allowed.has(v)),
  );
}

/**
 * Marker / slug pass before bare soft-map + hard-strip.
 * - Verified qimen slug (`pojuTermBySlug` + ns=qimen) + consistent slots → soft label
 * - Unknown qm_* / non-qimen / mismatched traditional → hard-delete when dual-ns present
 * - Never resolve qimen meaning from traditional alone when the slug is unverified
 */
export function sanitizeCrossNsMarkers(
  text: string,
  locale: string,
): { text: string; strippedMarkers: number; softMappedMarkers: number } {
  if (!text?.includes("⟦t:")) {
    return { text: text ?? "", strippedMarkers: 0, softMappedMarkers: 0 };
  }
  const loc = toTermLocale(locale);
  let strippedMarkers = 0;
  let softMappedMarkers = 0;

  const out = text.replace(TERM_MARKER_RE, (raw, slugRaw: string, visRaw: string, plainRaw?: string) => {
    const slug = String(slugRaw ?? "").trim();
    const visible = String(visRaw ?? "").replace(/\\\|/g, "|");
    const plain = String(plainRaw ?? "").replace(/\\\|/g, "|");
    const crossHan = markerBlobHasCrossNsHan(visible, plain) || markerBlobHasCrossNsHan(slug, "");
    const hasDualNs =
      Boolean(crossHan) ||
      isCrossNsSoftPreserveHan(visible) ||
      isCrossNsSoftPreserveHan(plain);

    if (looksLikeQimenSlugPrefix(slug)) {
      const term = pojuTermBySlug(slug);
      if (!term || term.ns !== "qimen") {
        // Unknown / wrong-ns qm_* — never fall back through traditional resolve.
        if (hasDualNs) {
          strippedMarkers += 1;
          return "";
        }
        return raw;
      }
      if (!markerSlotsConsistentWithTerm(term, visible, plain, loc)) {
        // e.g. ⟦t:qm_coverage_gap|白虎⟧ — verified slug but smuggled dual-ns / wrong trad
        strippedMarkers += 1;
        return "";
      }
      const soft = (termOf(term.slug, loc) || term.term[loc] || "").trim();
      if (soft) {
        softMappedMarkers += 1;
        return soft;
      }
      if (hasDualNs) {
        strippedMarkers += 1;
        return "";
      }
      return raw;
    }

    // Non-qimen (bazi / ss_ / invented): dual-ns traditional in marker → hard strip
    if (hasDualNs) {
      strippedMarkers += 1;
      return "";
    }
    // Forbidden bazi resolve by traditional in slots
    for (const han of [visible, plain]) {
      if (!han.trim()) continue;
      const b = resolvePojuTerm(han.trim(), { namespace: "bazi" });
      if (b.status === "forbidden") {
        strippedMarkers += 1;
        return "";
      }
    }
    return raw;
  });

  return { text: out, strippedMarkers, softMappedMarkers };
}

export type SoftMapCrossNsResult = {
  text: string;
  replacements: Array<{ han: string; soft: string; slug: string; namespace: "qimen"; sourceId?: string }>;
};

/**
 * Soft-map dual-ns bare surfaces → qimen soft labels only when segment-scoped
 * confirmation says qimen and does not also claim bazi for this sourceId.
 */
export function softMapConfirmedCrossNsHans(
  text: string,
  locale: string,
  opts?: NsAwareSanitizeOpts,
): SoftMapCrossNsResult {
  if (!text) return { text: text ?? "", replacements: [] };
  const loc = toTermLocale(locale);
  const replacements: SoftMapCrossNsResult["replacements"] = [];
  let out = text;

  for (const han of crossNsSoftPreserveHans()) {
    if (!out.includes(han)) continue;
    if (!maySoftMapCrossNsToQimen(han, opts)) continue;

    const q = resolvePojuTerm(han, { namespace: "qimen" });
    if (q.status !== "resolved") continue;
    const soft = (termOf(q.term.slug, loc) || q.term.term[loc] || "").trim();
    if (!soft) continue;

    const before = out;
    out = mapOutsideMarkers(out, (chunk) => chunk.split(han).join(soft));
    if (out !== before) {
      replacements.push({
        han,
        soft,
        slug: q.term.slug,
        namespace: "qimen",
        ...(opts?.sourceId ? { sourceId: opts.sourceId } : {}),
      });
    }
  }
  return { text: out, replacements };
}

/**
 * Full ns-aware pass: markers (slug) → segment soft-map → caller hard-strips leftovers.
 */
export function applyNsAwareSurfacePolicy(
  text: string,
  locale: string,
  opts?: NsAwareSanitizeOpts,
): SoftMapCrossNsResult & { strippedMarkers: number; softMappedMarkers: number } {
  const markers = sanitizeCrossNsMarkers(text ?? "", locale);
  const soft = softMapConfirmedCrossNsHans(markers.text, locale, opts);
  return {
    text: soft.text,
    replacements: soft.replacements,
    strippedMarkers: markers.strippedMarkers,
    softMappedMarkers: markers.softMappedMarkers,
  };
}

/**
 * @deprecated Prefer applyNsAwareSurfacePolicy / softMapConfirmedCrossNsHans with sourceId.
 */
export function softMapCrossNsForbiddenHans(
  text: string,
  locale: string,
  opts?: NsAwareSanitizeOpts,
): SoftMapCrossNsResult {
  return softMapConfirmedCrossNsHans(text, locale, opts);
}
