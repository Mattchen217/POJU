const fs = require("fs");
const path = "D:/POJU/pojulife/app/api/poju/final-delivery/route.ts";
let s = fs.readFileSync(path, "utf8");

// Add outer createdJobId next to claim vars
if (!s.includes("let m22_created_job_id")) {
  s = s.replace(
    "let m22_claim_key: string | null = null;",
    "let m22_claim_key: string | null = null;\n  let m22_created_job_id: string | null = null;"
  );
}

// After createXhighJob success, set m22_created_job_id = job.job_id
const createAssign = "const job = await createXhighJob({";
const idx = s.indexOf(createAssign);
if (idx < 0) {
  console.error("createXhighJob missing");
  process.exit(1);
}
// Find end of createXhighJob call block — next line after `});` following create
const afterCreate = s.indexOf("});", idx);
// Look for isFinalDeliveryJobInput(job.input)
const checkIdx = s.indexOf("if (!isFinalDeliveryJobInput(job.input))", idx);
if (checkIdx < 0) {
  console.error("job input check missing");
  process.exit(1);
}
if (!s.slice(afterCreate, checkIdx + 80).includes("m22_created_job_id")) {
  // Insert after the createXhighJob statement. Find the closing of create call.
  // Pattern: createXhighJob({ ... });\n\n    if (!isFinalDeliveryJobInput
  const close = s.lastIndexOf("});", checkIdx);
  s = s.slice(0, close + 3) + "\n    m22_created_job_id = job.job_id;" + s.slice(close + 3);
  console.log("added m22_created_job_id assign");
}

// Enhance catch to fail created job before releasing claim
const catchCleanupMarker = "M2.2-R3: if we acquired a claim but never handed off";
const cidx = s.indexOf(catchCleanupMarker);
if (cidx < 0) {
  console.error("catch cleanup missing");
  process.exit(1);
}
if (!s.slice(cidx, cidx + 800).includes("m22_created_job_id")) {
  const insert = `if (m22_created_job_id) {
        await failXhighJob(
          m22_created_job_id,
          e instanceof Error ? e.message : "final-delivery failed before handoff",
          { retryable: true, failure_reason: "interrupted" },
        ).catch(() => undefined);
        await releaseXhighSessionLock("final_delivery", /* session may be unknown */ "").catch(() => undefined);
      }
      `;
  // Better: don't release lock with empty session. Just fail job.
  const better = `if (m22_created_job_id) {
        await failXhighJob(
          m22_created_job_id,
          e instanceof Error ? e.message : "final-delivery failed before handoff",
          { retryable: true, failure_reason: "interrupted" },
        ).catch(() => undefined);
      }
      `;
  // Insert right after the comment line
  const afterComment = s.indexOf("\n", cidx) + 1;
  s = s.slice(0, afterComment) + better + s.slice(afterComment);
  console.log("catch fails created job");
}

fs.writeFileSync(path, s, "utf8");
console.log("done");
