/**
 * Strict namespace-aware term resolver (Phase 1).
 *
 * Priority: normalize → ns forbidden → exact traditional/alias match → unknown|ambiguous.
 * No fuzzy match. ambiguous/unknown/forbidden never return an arbitrary term.
 */

import {
  POJU_TERMS,
  type PojuTerm,
} from "@/lib/glossary/pojulife-terms";
import { matchForbidden } from "@/lib/glossary/term-forbidden-registry";
import {
  normalizeTermSurface,
  termHanVariants,
} from "@/lib/glossary/term-han-normalize";
import {
  isTermNsAvailable,
  type TermNs,
} from "@/lib/glossary/term-ns";

export type TermResolveStatus = "resolved" | "unknown" | "ambiguous" | "forbidden";

export type TermResolveResult =
  | { status: "resolved"; term: PojuTerm; raw: string; normalized: string }
  | { status: "unknown"; input: string; namespace: TermNs; raw: string; normalized: string }
  | {
      status: "ambiguous";
      input: string;
      namespace: TermNs;
      candidates: readonly PojuTerm[];
      raw: string;
      normalized: string;
    }
  | {
      status: "forbidden";
      input: string;
      namespace: TermNs;
      reason: string;
      severity: string;
      source: string;
      raw: string;
      normalized: string;
    };

export type ResolvePojuTermOptions = {
  /** Required. Cross-ns lookup is findPojuTerms only. */
  namespace: TermNs;
};

function surfacesOf(term: PojuTerm): string[] {
  const out = [term.traditional, ...(term.aliases ?? [])];
  return out.flatMap((s) => termHanVariants(s));
}

/** Exact-match candidates within one namespace (traditional + aliases + Han variants). */
export function matchPojuTermsInNamespace(
  input: string,
  namespace: TermNs,
): PojuTerm[] {
  const normalized = normalizeTermSurface(input);
  if (!normalized) return [];
  const variants = new Set(termHanVariants(normalized));
  const hits: PojuTerm[] = [];
  for (const t of POJU_TERMS) {
    if (t.ns !== namespace) continue;
    const surfaces = surfacesOf(t);
    if (surfaces.some((s) => variants.has(s))) {
      hits.push(t);
    }
  }
  return hits;
}

/**
 * Strict resolve. Namespace is mandatory.
 * Forbidden is checked before alias hit so redline tokens cannot be bypassed by aliases.
 */
export function resolvePojuTerm(
  input: string,
  options: ResolvePojuTermOptions,
): TermResolveResult {
  const namespace = options.namespace;
  const raw = input;
  const normalized = normalizeTermSurface(input);
  const variants = termHanVariants(normalized);

  const forbidden = matchForbidden(namespace, normalized, variants);
  if (forbidden) {
    return {
      status: "forbidden",
      input: normalized,
      namespace,
      reason: forbidden.reason,
      severity: forbidden.severity,
      source: forbidden.source,
      raw,
      normalized,
    };
  }

  // Unavailable ns (ziwei Phase 1): no SSOT rows → always unknown after forbidden check.
  if (!isTermNsAvailable(namespace)) {
    return { status: "unknown", input: normalized, namespace, raw, normalized };
  }

  const hits = matchPojuTermsInNamespace(normalized, namespace);
  if (hits.length === 1) {
    return { status: "resolved", term: hits[0]!, raw, normalized };
  }
  if (hits.length > 1) {
    return {
      status: "ambiguous",
      input: normalized,
      namespace,
      candidates: hits,
      raw,
      normalized,
    };
  }
  return { status: "unknown", input: normalized, namespace, raw, normalized };
}

/**
 * Production helper: resolved term or undefined (never silent cross-ns first-match).
 * Prefer this over deprecated `pojuTermByTraditional`.
 */
export function resolvedPojuTerm(
  input: string,
  namespace: TermNs,
): PojuTerm | undefined {
  const r = resolvePojuTerm(input, { namespace });
  return r.status === "resolved" ? r.term : undefined;
}

/**
 * Try namespaces in explicit order; first resolved wins.
 * Use when a surface may legally exist in more than one system (e.g. 驿马).
 */
export function resolvedPojuTermIn(
  input: string,
  namespaces: readonly TermNs[],
): PojuTerm | undefined {
  for (const ns of namespaces) {
    const t = resolvedPojuTerm(input, ns);
    if (t) return t;
  }
  return undefined;
}

/**
 * Diagnostic / audit only — cross-namespace candidates. Never use for user rendering.
 */
export function findPojuTerms(input: string): readonly PojuTerm[] {
  const normalized = normalizeTermSurface(input);
  if (!normalized) return [];
  const variants = new Set(termHanVariants(normalized));
  const hits: PojuTerm[] = [];
  for (const t of POJU_TERMS) {
    if (surfacesOf(t).some((s) => variants.has(s))) {
      hits.push(t);
    }
  }
  return hits;
}
