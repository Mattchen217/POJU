/**
 * P6 day7 must trace to P3/P4 / close-ritual menu (category gate).
 * No chart-specific blacklist — overlap against the feed blob only.
 */

function hanOnly(text: string): string {
  return (text ?? "").replace(/[^\u4e00-\u9fff]/g, "");
}

function hanBigrams(text: string): string[] {
  const n = hanOnly(text);
  if (n.length < 2) return n ? [n] : [];
  const out: string[] = [];
  for (let i = 0; i < n.length - 1; i++) out.push(n.slice(i, i + 2));
  return out;
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Min bigram Jaccard of day7 action(+why) vs source feed. */
export const DAY7_TRACE_MIN_JACCARD = 0.06;

export type Day7TraceItem = {
  action: string;
  why?: string;
};

/**
 * True when every day7 row shares enough structure with the growth-source blob
 * (close ritual menu + means_candidate_ref lines). Empty/short source → skip (no false red).
 */
export function assessDay7Traceability(
  items: readonly Day7TraceItem[],
  sourceBlob: string,
): { ok: true } | { ok: false; reason: string; index: number } {
  const src = hanOnly(sourceBlob);
  if (src.length < 24) return { ok: true };
  const srcBig = hanBigrams(src);
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const prose = `${item.action ?? ""}\n${item.why ?? ""}`;
    const han = hanOnly(prose);
    if (han.length < 6) continue;
    // 4-char window hit in source = strong trace.
    let windowHit = false;
    for (let j = 0; j <= han.length - 4; j++) {
      if (src.includes(han.slice(j, j + 4))) {
        windowHit = true;
        break;
      }
    }
    if (windowHit) continue;
    const jv = jaccard(hanBigrams(han), srcBig);
    if (jv < DAY7_TRACE_MIN_JACCARD) {
      return { ok: false, reason: `day7_untraced:${i}`, index: i };
    }
  }
  return { ok: true };
}

/** Join close menu + plan means_candidate_ref for the gate. */
export function buildDay7TraceSourceBlob(
  closeRitualFeed: string | null | undefined,
  meansCandidateRefs: readonly string[] | null | undefined,
): string {
  const parts: string[] = [];
  if (closeRitualFeed?.trim()) parts.push(closeRitualFeed.trim());
  for (const r of meansCandidateRefs ?? []) {
    if (r?.trim()) parts.push(r.trim());
  }
  return parts.join("\n");
}
