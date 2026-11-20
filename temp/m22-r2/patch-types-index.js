const fs = require("fs");

// xhigh-job-types: add m22 claim fields
const path = "lib/poju/xhigh-job-types.ts";
let s = fs.readFileSync(path, "utf8");
if (!s.includes("m22_claim_token")) {
  const needle = `  /** Hard-gate Stage 4 path: refuse job without valid frozen DC. */
  require_decision_context?: boolean;
};`;
  const repl = `  /** Hard-gate Stage 4 path: refuse job without valid frozen DC. */
  require_decision_context?: boolean;
  /** M2.2-R2: shared KV claim ownership for Freeze-bound generation. */
  m22_claim_token?: string | null;
  m22_claim_key?: string | null;
  /** Original Freeze-bound report job id (session.freeze_bound_report_jobs). */
  m22_report_job_id?: string | null;
};`;
  if (!s.includes(needle)) throw new Error("FinalDeliveryJobInput tail not found");
  s = s.replace(needle, repl);
  fs.writeFileSync(path, s);
  console.log("xhigh-job-types patched");
} else {
  console.log("xhigh-job-types already has m22 fields");
}

// decision-intake index exports
const idxPath = "lib/poju/decision-intake/index.ts";
let idx = fs.readFileSync(idxPath, "utf8");
if (!idx.includes("releaseFreezeBoundReportClaim")) {
  // find the freeze-bound-report export block
  const old = `completeFreezeBoundReportFromDeliveryPages,`;
  if (!idx.includes(old)) throw new Error("completeFreeze export not found in index");
  idx = idx.replace(
    old,
    `completeFreezeBoundReportFromDeliveryPages,
  releaseFreezeBoundReportClaim,
  failFreezeBoundReportJob,`,
  );
  fs.writeFileSync(idxPath, idx);
  console.log("index exports patched");
} else {
  console.log("index already exports release helpers");
}
