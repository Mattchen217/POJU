/**
 * One-line delivery progress for Vercel logs.
 * Filter Messages by `[FD]` to see the step spine without /status noise.
 *
 * Examples:
 *   [FD] fd_abc · ok · stage finalize → segments (8.2s)
 *   [FD] fd_abc · fail · P3 science_action · compress_body_mingli:年支 (185s)
 */

export type DeliveryStepLevel = "ok" | "hop" | "warn" | "fail" | "stop";

export type DeliveryStepLogInput = {
  job_id: string;
  /** Short human step, e.g. "wave A", "P3 science_action", "stage finalize" */
  step: string;
  level?: DeliveryStepLevel;
  /** One-line detail (reason / next / keys). Keep short. */
  detail?: string | null;
  ms?: number | null;
  /** Extra compact tags shown after detail, e.g. "attempts=2" */
  tags?: string | null;
};

function shortJobId(job_id: string): string {
  const t = job_id.trim();
  if (t.length <= 18) return t;
  return `${t.slice(0, 14)}…`;
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Emit a single readable spine line. Prefer this over dumping large objects
 * when you want operators to scan progress in Vercel Live logs.
 */
export function logDeliveryStep(input: DeliveryStepLogInput): void {
  const level = input.level ?? "ok";
  const parts = [
    "[FD]",
    shortJobId(input.job_id),
    "·",
    level,
    "·",
    input.step.trim() || "(step)",
  ];
  const detail = input.detail?.trim();
  if (detail) {
    parts.push("·", detail.replace(/\s+/g, " ").slice(0, 220));
  }
  const tags = input.tags?.trim();
  if (tags) {
    parts.push("·", tags.replace(/\s+/g, " ").slice(0, 80));
  }
  const ms = fmtMs(input.ms);
  if (ms) {
    parts.push(`(${ms})`);
  }
  const line = parts.join(" ");
  if (level === "fail" || level === "stop") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

/** Map segment key → P# label for spine logs. */
export function deliveryPageLabel(key: string | null | undefined): string {
  switch (key) {
    case "direct_answer":
      return "P1";
    case "foundation":
      return "P2";
    case "science_action":
      return "P3";
    case "metaphysics_action":
      return "P4";
    case "risk_guard":
      return "P5";
    case "signals_close":
      return "P6";
    default:
      return key?.trim() || "?";
  }
}
