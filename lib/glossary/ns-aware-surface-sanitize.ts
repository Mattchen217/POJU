/**
 * Namespace-aware final-surface handling for dual-meaning Han tokens.
 *
 * 空亡 / 白虎 are bazi redline but legal qimen structure terms.
 * Never infer namespace from bare surface text.
 *
 * Policy:
 * - confirmed qimen-only → soft-map to qimen SSOT label
 * - confirmed bazi → hard-strip (caller)
 * - both ns confirmed for same traditional → fail-closed strip bare (use ⟦t:slug|⟧)
 * - unconfirmed bare → fail-closed strip (caller)
 */

import type { TermNs } from "@/lib/glossary/term-ns";
import {
  termOf,
  toTermLocale,
} from "@/lib/glossary/pojulife-terms";
import { forbiddenTokensForNamespace } from "@/lib/glossary/term-forbidden-registry";
import { resolvePojuTerm } from "@/lib/glossary/term-resolve";
import { termHanVariants } from "@/lib/glossary/term-han-normalize";

const TERM_MARKER_SPLIT = /(⟦t:[^⟧]*⟧)/g;

export type ConfirmedTermRef = {
  traditional: string;
  namespace: TermNs;
  slug?: string;
};

export type NsAwareSanitizeOpts = {
  /** Structured facts that already know namespace. Never inferred from bare text. */
  confirmed?: readonly ConfirmedTermRef[];
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

function namespacesConfirming(
  traditional: string,
  confirmed: readonly ConfirmedTermRef[] | undefined,
): Set<TermNs> {
  const out = new Set<TermNs>();
  if (!confirmed?.length) return out;
  const variants = new Set(termHanVariants(traditional));
  for (const row of confirmed) {
    const rowVars = termHanVariants(row.traditional);
    if (rowVars.some((v) => variants.has(v))) {
      out.add(row.namespace);
    }
  }
  return out;
}

/** True when qimen is confirmed and bazi is not — safe to soft-map bare surfaces. */
export function maySoftMapCrossNsToQimen(
  traditional: string,
  opts?: NsAwareSanitizeOpts,
): boolean {
  const ns = namespacesConfirming(traditional, opts?.confirmed);
  return ns.has("qimen") && !ns.has("bazi");
}

function mapOutsideMarkers(text: string, mapChunk: (chunk: string) => string): string {
  if (!text.includes("⟦t:")) return mapChunk(text);
  return text
    .split(TERM_MARKER_SPLIT)
    .map((part) => (part.startsWith("⟦t:") && part.endsWith("⟧") ? part : mapChunk(part)))
    .join("");
}

export type SoftMapCrossNsResult = {
  text: string;
  replacements: Array<{ han: string; soft: string; slug: string; namespace: "qimen" }>;
};

/**
 * Soft-map dual-ns traditional surfaces → qimen coined soft labels **only** when
 * structured confirmation says qimen and does not also claim bazi for the same token.
 * Bare / ambiguous / bazi-confirmed tokens are left unchanged for hard-strip (fail-closed).
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
    if (!soft) continue; // fail-closed: no invented label

    const before = out;
    out = mapOutsideMarkers(out, (chunk) => chunk.split(han).join(soft));
    if (out !== before) {
      replacements.push({ han, soft, slug: q.term.slug, namespace: "qimen" });
    }
  }
  return { text: out, replacements };
}

/**
 * @deprecated Name retained for call-site discovery — always pass opts.confirmed.
 * Without confirmation this is a no-op (fail-closed: do not invent qimen soft labels).
 */
export function softMapCrossNsForbiddenHans(
  text: string,
  locale: string,
  opts?: NsAwareSanitizeOpts,
): SoftMapCrossNsResult {
  return softMapConfirmedCrossNsHans(text, locale, opts);
}
