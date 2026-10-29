/**
 * Book Judgment Pack feature flag.
 * Unset / empty → ON (new default). Explicit `0` | `false` | `off` | `legacy` → per-page judgment.
 */

const OFF = new Set(["0", "false", "off", "no", "legacy"]);

export function isBookJudgmentPackEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = (env.BOOK_JUDGMENT_PACK ?? "").trim().toLowerCase();
  if (!raw) return true;
  if (OFF.has(raw)) return false;
  return true;
}
