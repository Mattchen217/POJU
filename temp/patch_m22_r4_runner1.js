const fs = require("fs");
const p = "lib/poju/final-delivery-stage-runner.ts";
let s = fs.readFileSync(p, "utf8");

if (!s.includes("final-delivery-execution-authority")) {
  // Add imports after xhigh-job-store import block
  const importAnchor = `} from "@/lib/poju/xhigh-job-store";`;
  if (!s.includes(importAnchor)) throw new Error("import anchor missing");
  s = s.replace(
    importAnchor,
    importAnchor +
      `\nimport {\n  DeliveryExecutionRevokedError,\n  assertDeliveryExecutionAuthority,\n  isDeliveryExecutionRevoked,\n  tryCommitUnderDeliveryAuthority,\n} from "@/lib/poju/final-delivery-execution-authority";`
  );
  console.log("imports added");
} else {
  console.log("imports already present");
}

// Fix silent skip in writeBack — fail closed when m22_report_job_id present
{
  const old = `async function writeBackFreezeBoundReportOnDeliverySuccess(args: {
  job_id: string;
  input: FinalDeliveryJobInput;
  allReady: Array<{
    key: string;
    body_markdown: string;
    interleaved_markdown?: string;
  }>;
}): Promise<void> {
  const { job_id, input, allReady } = args;
  if (!input.decision_context_binding || !input.decision_context_snapshot) return;
  const reportJobId = input.m22_report_job_id;
  if (!reportJobId) return;`;

  const neu = `/** Exported for M2.2-R4 production-path tests (Stage Runner write-back contract). */
export async function writeBackFreezeBoundReportOnDeliverySuccess(args: {
  job_id: string;
  input: FinalDeliveryJobInput;
  allReady: Array<{
    key: string;
    body_markdown: string;
    interleaved_markdown?: string;
  }>;
}): Promise<void> {
  const { job_id, input, allReady } = args;
  const reportJobId = input.m22_report_job_id;
  if (!reportJobId) return;
  // M2.2-R4: when m22_report_job_id is bound, binding+snapshot+hash MUST hold — fail closed.
  if (!input.decision_context_binding || !input.decision_context_snapshot) {
    throw new Error("m22_writeback_missing_binding_or_snapshot");
  }
  // Refuse write-back if this formal job no longer holds execution authority.
  await assertDeliveryExecutionAuthority(job_id);`;

  // Normalize CRLF for match by working on \n-normalized copy for replacement of this block
  const sN = s.replace(/\r\n/g, "\n");
  const oldN = old.replace(/\r\n/g, "\n");
  if (!sN.includes(oldN)) {
    if (sN.includes("m22_writeback_missing_binding_or_snapshot")) {
      console.log("writeback already fail-closed");
    } else {
      // Try looser match
      const idx = sN.indexOf("async function writeBackFreezeBoundReportOnDeliverySuccess");
      console.log("writeback idx", idx);
      console.log(JSON.stringify(sN.slice(idx, idx + 350)));
      throw new Error("writeback block not found");
    }
  } else {
    const out = sN.replace(oldN, neu);
    s = out.includes("\r\n") ? out : out.replace(/\n/g, "\r\n");
    // Preserve original line endings
    const origHadCrlf = fs.readFileSync(p, "utf8").includes("\r\n");
    s = origHadCrlf ? out.replace(/\n/g, "\r\n") : out;
    console.log("writeback fail-closed patched");
  }
}

fs.writeFileSync(p, s);
