const fs = require("fs");
const p = "lib/poju/xhigh-job-store.ts";
let s = fs.readFileSync(p, "utf8");
if (s.includes("superseded_by_regenerate")) {
  console.log("store already patched");
  process.exit(0);
}
const re = /const allowInterruptedRevive =\r?\n    job\.status === "failed" &&\r?\n    status === "running" &&\r?\n    \(job\.failure_reason === "interrupted" \|\| job\.retryable === true\);/;
if (!re.test(s)) throw new Error("revive pattern missing");
s = s.replace(
  re,
  `const nonRevivable =
    job.failure_reason === "superseded_by_regenerate" ||
    job.failure_reason === "superseded_by_deploy" ||
    job.failure_reason === "user_cancelled";
  const allowInterruptedRevive =
    job.status === "failed" &&
    status === "running" &&
    !nonRevivable &&
    (job.failure_reason === "interrupted" || job.retryable === true);`
);
fs.writeFileSync(p, s);
console.log("store patched", s.includes("nonRevivable"));
