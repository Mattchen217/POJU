/**
 * Client-safe echo checks. No server imports — sanitize runs in the
 * delivery preview bundle, which cannot pull node:crypto.
 */

/** True when evidence echoes a long stretch of the interview cite (any topic). */
export function citeEchoedInEvidence(
  evidence: string,
  calcCite: string | null | undefined,
): boolean {
  const cite = (calcCite ?? "").trim();
  if (cite.length < 14) return false;
  const body = cite.replace(/^[^：:]{1,48}[：:]\s*/, "").trim();
  const source = body.length >= 12 ? body : cite;
  const norm = (s: string) => s.replace(/[，。、“”「」'"\s／/、]/g, "");
  const evN = norm(evidence);
  const srcN = norm(source);
  if (srcN.length < 12 || evN.length < 12) return false;
  for (let i = 0; i <= srcN.length - 12; i++) {
    const win = srcN.slice(i, i + 12);
    if (/^[0-9A-Za-z]+$/.test(win)) continue;
    if (evN.includes(win)) return true;
  }
  return false;
}

/** True when prose repeats a long stretch of collected situation material. */
export function proseEchoesSituation(
  prose: string,
  material: string | null | undefined,
): boolean {
  const blob = (material ?? "").trim();
  if (!blob || !prose.trim()) return false;
  const lines = blob
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length >= 14 &&
        !s.startsWith("【") &&
        !s.startsWith("禁止") &&
        !s.startsWith("这些是"),
    );
  if (lines.some((line) => citeEchoedInEvidence(prose, line))) return true;
  return citeEchoedInEvidence(prose, blob);
}
