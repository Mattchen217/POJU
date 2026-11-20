const fs = require("fs");
const p = "lib/poju/final-delivery-stage-runner.ts";
const crlf = fs.readFileSync(p, "utf8").includes("\r\n");
let s = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

// Change wrapper to return "failed" instead of "revoked" for type compatibility
const old = `): Promise<Awaited<ReturnType<typeof scheduleDeliveryStageContinue>> | "revoked"> {
  const ok = await tryCommitUnderDeliveryAuthority(job_id);
  if (!ok) {
    console.warn("[final-delivery-stage] skip schedule continue — execution revoked", {
      job_id,
      stage,
    });
    return "revoked";
  }
  return scheduleDeliveryStageContinue(job_id, stage, opts);
}`;

const neu = `): Promise<Awaited<ReturnType<typeof scheduleDeliveryStageContinue>>> {
  const ok = await tryCommitUnderDeliveryAuthority(job_id);
  if (!ok) {
    console.warn("[final-delivery-stage] skip schedule continue — execution revoked", {
      job_id,
      stage,
    });
    // Map revoked → failed so callers stop advancing without handing off the lease.
    return "failed";
  }
  return scheduleDeliveryStageContinue(job_id, stage, opts);
}`;

if (!s.includes(old)) {
  // fuzzy
  if (!s.includes('return "revoked"')) throw new Error("revoked return missing");
  s = s.replace('| "revoked"', "");
  s = s.replace('return "revoked";', 'return "failed";');
  console.log("fuzzy patched");
} else {
  s = s.replace(old, neu);
  console.log("exact patched");
}
fs.writeFileSync(p, crlf ? s.replace(/\n/g, "\r\n") : s);
