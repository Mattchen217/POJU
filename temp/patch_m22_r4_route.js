const fs = require("fs");
const p = "app/api/poju/final-delivery/route.ts";
const crlf = fs.readFileSync(p, "utf8").includes("\r\n");
let s = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

if (!s.includes("supersedeFinalDeliveryJobForRegenerate")) {
  // Add import near failXhighJob import
  const anchor = `failXhighJob,`;
  if (!s.includes(anchor)) throw new Error("failXhighJob import missing");
  // Find the xhigh-job-store import block end and add authority import after it
  const storeEnd = s.indexOf('} from "@/lib/poju/xhigh-job-store";');
  if (storeEnd < 0) throw new Error("store import end missing");
  const insertAt = storeEnd + '} from "@/lib/poju/xhigh-job-store";'.length;
  s =
    s.slice(0, insertAt) +
    `\nimport { supersedeFinalDeliveryJobForRegenerate } from "@/lib/poju/final-delivery-execution-authority";` +
    s.slice(insertAt);
  console.log("route import added");
}

// Replace regenerate failXhighJob blocks that use stale_running with supersede helper
// Pattern 1: inside m22 prepare regenerate block
{
  const old1 = `            if (prior && isFinalDeliveryJobInput(prior.input)) {
              if (prior.status === "pending" || prior.status === "running") {
                await failXhighJob(prior.job_id, "STOP: superseded by regenerate", {
                  retryable: false,
                  failure_reason: "stale_running",
                  current_stage: prior.current_stage,
                  accumulated_content: "failed:superseded_by_regenerate",
                }).catch(() => undefined);
                await forceReleaseDeliveryContinueLease(prior.job_id).catch(() => undefined);
                await releaseXhighSessionLock("final_delivery", sessionIdRaw).catch(
                  () => undefined,
                );
              }`;
  const neu1 = `            if (prior && isFinalDeliveryJobInput(prior.input)) {
              if (prior.status === "pending" || prior.status === "running") {
                // M2.2-R4: real cancel/takeover — supersede strips authority so
                // in-flight workers stop before stage commits / completion.
                await supersedeFinalDeliveryJobForRegenerate(prior.job_id);
              }`;
  if (s.includes(old1)) {
    s = s.replace(old1, neu1);
    console.log("route regenerate block1 patched");
  } else if (s.includes("supersedeFinalDeliveryJobForRegenerate(prior.job_id)")) {
    console.log("route block1 already");
  } else {
    console.log("WARN block1 not found");
    const i = s.indexOf("STOP: superseded by regenerate");
    console.log(JSON.stringify(s.slice(i - 80, i + 350)));
  }
}

{
  const old2 = `      if (latest && (latest.status === "pending" || latest.status === "running")) {
        await failXhighJob(latest.job_id, "STOP: superseded by regenerate", {
          retryable: false,
          failure_reason: "stale_running",
          current_stage: latest.current_stage,
          accumulated_content: "failed:superseded_by_regenerate",
        }).catch(() => undefined);
        await forceReleaseDeliveryContinueLease(latest.job_id).catch(() => undefined);
        await releaseXhighSessionLock("final_delivery", sessionIdRaw).catch(() => undefined);
      }`;
  const neu2 = `      if (latest && (latest.status === "pending" || latest.status === "running")) {
        // M2.2-R4: supersede prior worker authority (not status-flip alone).
        await supersedeFinalDeliveryJobForRegenerate(latest.job_id);
      }`;
  if (s.includes(old2)) {
    s = s.replace(old2, neu2);
    console.log("route regenerate block2 patched");
  } else if (s.includes("supersedeFinalDeliveryJobForRegenerate(latest.job_id)")) {
    console.log("route block2 already");
  } else {
    console.log("WARN block2 not found");
  }
}

fs.writeFileSync(p, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("route done");
