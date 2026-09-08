/**
 * Shared Assign binding seeds (P2–P6).
 * Construction-first: feeds emit hint tables; assign locks thin LLM fields.
 */

export type AssignPathHint = {
  path: string;
  prefer_primary?: string;
  prefer_candidate_ref?: string;
  prefer_cite?: string;
  prefer_claim?: string;
};

export function clipAssignField(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/** Unified feed tail table — fields after path may be omitted. */
export function formatAssignBindingHintTable(
  hints: readonly AssignPathHint[],
  title = "【派工绑定建议表 · 代码按 path 种满】",
): string {
  if (hints.length === 0) return "";
  const lines = [
    title,
    "Assign：chart_anchors[0]←primary；means_candidate_ref←ref；calc_cite/unit_claim 空或过短时用 cite/claim（可润色勿空泛）。",
  ];
  hints.forEach((h, i) => {
    const parts = [`path=${h.path}`];
    if (h.prefer_primary?.trim()) parts.push(`primary=${h.prefer_primary.trim()}`);
    if (h.prefer_candidate_ref?.trim()) {
      parts.push(`ref=${h.prefer_candidate_ref.trim()}`);
    }
    if (h.prefer_cite?.trim()) parts.push(`cite=${clipAssignField(h.prefer_cite, 80)}`);
    if (h.prefer_claim?.trim()) {
      parts.push(`claim=${clipAssignField(h.prefer_claim, 120)}`);
    }
    lines.push(`${i + 1}. ${parts.join(" | ")}`);
  });
  return lines.join("\n");
}

/**
 * Parse `path=… | primary=… | ref=… | cite=… | claim=…` lines.
 * primary optional (P2 may seed ref/cite/claim only).
 */
export function parseAssignPathHintsFromFeed(
  feed: string | null | undefined,
): AssignPathHint[] {
  if (!feed?.trim()) return [];
  const out: AssignPathHint[] = [];
  for (const raw of feed.split("\n")) {
    const line = raw.trim().replace(/^\d+\.\s*/, "");
    if (!line.includes("path=")) continue;
    const fields = new Map<string, string>();
    for (const part of line.split("|")) {
      const m = part.trim().match(/^(path|primary|ref|cite|claim)=(.+)$/);
      if (!m) continue;
      fields.set(m[1]!, m[2]!.trim());
    }
    const path = fields.get("path");
    if (!path) continue;
    const prefer_primary = fields.get("primary");
    const prefer_candidate_ref = fields.get("ref");
    const prefer_cite = fields.get("cite");
    const prefer_claim = fields.get("claim");
    if (
      !prefer_primary &&
      !prefer_candidate_ref &&
      !prefer_cite &&
      !prefer_claim
    ) {
      continue;
    }
    out.push({
      path,
      prefer_primary: prefer_primary || undefined,
      prefer_candidate_ref: prefer_candidate_ref || undefined,
      prefer_cite: prefer_cite || undefined,
      prefer_claim: prefer_claim || undefined,
    });
  }
  return out;
}

export function feedForAssignKey(
  key: string,
  opts: {
    foundation_surface_feed?: string | null;
    science_means_feed?: string | null;
    metaphysics_moat_feed?: string | null;
    risk_fuse_feed?: string | null;
    close_ritual_feed?: string | null;
  },
): string | null {
  switch (key) {
    case "foundation":
      return opts.foundation_surface_feed ?? null;
    case "science_action":
      return opts.science_means_feed ?? null;
    case "metaphysics_action":
      return opts.metaphysics_moat_feed ?? null;
    case "risk_guard":
      return opts.risk_fuse_feed ?? null;
    case "signals_close":
      return opts.close_ritual_feed ?? null;
    default:
      return null;
  }
}
