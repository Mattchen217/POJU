/**
 * Canonical DC fact ID resolution for Page02.
 * Aliases like ev_fact_<fact_id> must resolve to the original DC fact_id
 * before any status/verification lookup.
 */

export type Page02FactIdContext = {
  /** Original DC fact ids present in the restricted Page02 slice. */
  rawFactIds: ReadonlySet<string>;
  /**
   * Optional explicit alias map (alias → raw).
   * When omitted, only the `ev_fact_` prefix convention is accepted.
   */
  aliasToRaw?: ReadonlyMap<string, string>;
};

export type ResolveFactIdResult =
  | { ok: true; fact_id: string }
  | { ok: false; reason: "unknown" | "ambiguous"; detail: string };

/**
 * Resolve an input ID to exactly one original DC fact_id.
 * Never treats an alias as a fact with missing status.
 */
export function resolveCanonicalPage02FactId(
  inputId: string,
  ctx: Page02FactIdContext,
): ResolveFactIdResult {
  const raw = inputId.trim();
  if (!raw) {
    return { ok: false, reason: "unknown", detail: "empty fact id" };
  }

  if (ctx.rawFactIds.has(raw)) {
    return { ok: true, fact_id: raw };
  }

  const fromMap = ctx.aliasToRaw?.get(raw);
  if (fromMap) {
    if (!ctx.rawFactIds.has(fromMap)) {
      return {
        ok: false,
        reason: "unknown",
        detail: `alias「${raw}」maps to missing fact「${fromMap}」`,
      };
    }
    return { ok: true, fact_id: fromMap };
  }

  if (raw.startsWith("ev_fact_")) {
    const candidate = raw.slice("ev_fact_".length);
    if (!candidate) {
      return {
        ok: false,
        reason: "unknown",
        detail: `malformed alias「${raw}」`,
      };
    }
    if (!ctx.rawFactIds.has(candidate)) {
      return {
        ok: false,
        reason: "unknown",
        detail: `alias「${raw}」has no slice fact「${candidate}」`,
      };
    }
    // Ambiguity: if both candidate and another raw somehow collide — not applicable
    // with unique fact ids; reject if alias map disagrees.
    if (fromMap && fromMap !== candidate) {
      return {
        ok: false,
        reason: "ambiguous",
        detail: `alias「${raw}」ambiguous`,
      };
    }
    return { ok: true, fact_id: candidate };
  }

  return {
    ok: false,
    reason: "unknown",
    detail: `fact id「${raw}」not in Page02 slice`,
  };
}

export function factEvidenceIdFor(factId: string): string {
  return `ev_fact_${factId}`;
}

export function buildPage02FactIdContext(input: {
  factIds: Iterable<string>;
}): Page02FactIdContext {
  const rawFactIds = new Set<string>();
  const aliasToRaw = new Map<string, string>();
  for (const id of input.factIds) {
    const fid = id.trim();
    if (!fid) continue;
    rawFactIds.add(fid);
    aliasToRaw.set(factEvidenceIdFor(fid), fid);
  }
  return { rawFactIds, aliasToRaw };
}
