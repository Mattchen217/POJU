/**
 * Namespace-aware final-surface handling for dual-meaning Han tokens.
 *
 * Example: 空亡 / 白虎 are bazi redline but legal qimen structure terms.
 * Final export must soft-map to qimen coined labels — never hard-delete
 * (which would erase legitimate qimen meaning from reports/HTML/reminders).
 *
 * Fail-closed: if qimen soft is missing, leave token for audit (do not invent).
 */

import {
  termOf,
  toTermLocale,
} from "@/lib/glossary/pojulife-terms";
import { forbiddenTokensForNamespace } from "@/lib/glossary/term-forbidden-registry";
import { resolvePojuTerm } from "@/lib/glossary/term-resolve";
import { termHanVariants } from "@/lib/glossary/term-han-normalize";

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

/**
 * Soft-map dual-ns traditional surfaces → qimen coined soft labels.
 * Returns { text, replacements } for audit.
 */
export function softMapCrossNsForbiddenHans(
  text: string,
  locale: string,
): { text: string; replacements: Array<{ han: string; soft: string; slug: string }> } {
  if (!text) return { text: text ?? "", replacements: [] };
  const loc = toTermLocale(locale);
  let out = text;
  const replacements: Array<{ han: string; soft: string; slug: string }> = [];

  for (const han of crossNsSoftPreserveHans()) {
    if (!out.includes(han)) continue;
    const q = resolvePojuTerm(han, { namespace: "qimen" });
    if (q.status !== "resolved") continue;
    const soft = (termOf(q.term.slug, loc) || q.term.term[loc] || "").trim();
    if (!soft) continue; // fail-closed: no invented label; leave for residual audit
    const before = out;
    out = out.split(han).join(soft);
    if (out !== before) {
      replacements.push({ han, soft, slug: q.term.slug });
    }
  }
  return { text: out, replacements };
}
