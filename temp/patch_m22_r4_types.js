const fs = require("fs");

// 1) xhigh-job-types: add superseded_by_regenerate
{
  const p = "lib/poju/xhigh-job-types.ts";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("superseded_by_regenerate")) {
    s = s.replace(
      `| "superseded_by_deploy"
  /** User Stop in the workspace right rail — do not auto-resume. */
  | "user_cancelled"`,
      `| "superseded_by_deploy"
  /** Regenerate takeover — in-flight worker must stop; do not revive. */
  | "superseded_by_regenerate"
  /** User Stop in the workspace right rail — do not auto-resume. */
  | "user_cancelled"`
    );
    if (!s.includes("superseded_by_regenerate")) {
      // fallback: encoding-normalized match
      s = s.replace(
        '| "superseded_by_deploy"',
        '| "superseded_by_deploy"\n  | "superseded_by_regenerate"'
      );
    }
    fs.writeFileSync(p, s);
    console.log("types:", s.includes("superseded_by_regenerate"));
  } else console.log("types: already present");
}

// 2) xhigh-job-store: never revive superseded/cancelled
{
  const p = "lib/poju/xhigh-job-store.ts";
  let s = fs.readFileSync(p, "utf8");
  const needle = `const allowInterruptedRevive =
    job.status === "failed" &&
    status === "running" &&
    (job.failure_reason === "interrupted" || job.retryable === true);`;
  const repl = `const nonRevivable =
    job.failure_reason === "superseded_by_regenerate" ||
    job.failure_reason === "superseded_by_deploy" ||
    job.failure_reason === "user_cancelled";
  const allowInterruptedRevive =
    job.status === "failed" &&
    status === "running" &&
    !nonRevivable &&
    (job.failure_reason === "interrupted" || job.retryable === true);`;
  if (!s.includes("superseded_by_regenerate")) {
    if (!s.includes(needle)) throw new Error("revive needle missing");
    s = s.replace(needle, repl);
    fs.writeFileSync(p, s);
    console.log("store: revive guard patched");
  } else console.log("store: already patched");
}
