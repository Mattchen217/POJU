const fs = require("fs");
const path = "lib/poju/xhigh-job-types.ts";
let s = fs.readFileSync(path, "utf8");
if (s.includes("m22_claim_token")) {
  console.log("already patched");
  process.exit(0);
}
const marker = "require_decision_context?: boolean;";
const idx = s.indexOf(marker);
if (idx < 0) throw new Error("marker not found");
const insertAt = idx + marker.length;
const insert = `
  /** M2.2-R2: shared KV claim ownership for Freeze-bound generation. */
  m22_claim_token?: string | null;
  m22_claim_key?: string | null;
  /** Original Freeze-bound report job id (session.freeze_bound_report_jobs). */
  m22_report_job_id?: string | null;`;
s = s.slice(0, insertAt) + insert + s.slice(insertAt);
fs.writeFileSync(path, s);
console.log("xhigh-job-types patched");

const idxPath = "lib/poju/decision-intake/index.ts";
let idxFile = fs.readFileSync(idxPath, "utf8");
if (!idxFile.includes("releaseFreezeBoundReportClaim")) {
  idxFile = idxFile.replace(
    "completeFreezeBoundReportFromDeliveryPages,\n",
    "completeFreezeBoundReportFromDeliveryPages,\n  releaseFreezeBoundReportClaim,\n  failFreezeBoundReportJob,\n",
  );
  fs.writeFileSync(idxPath, idxFile);
  console.log("index patched");
} else {
  console.log("index ok");
}
