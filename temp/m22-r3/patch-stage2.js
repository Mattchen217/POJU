const fs = require("fs");
const path = "D:/POJU/pojulife/lib/poju/final-delivery-stage-runner.ts";
let s = fs.readFileSync(path, "utf8");
const startMarker = "await completeXhighJob(job_id, {";
const endMarker = 'await releaseXhighSessionLock("final_delivery", input.session_id);';
const i = s.indexOf("// M2.2-R2: write eight validated pages");
if (i < 0) {
  console.error("no marker");
  process.exit(1);
}
const start = s.lastIndexOf(startMarker, i);
const end = s.indexOf(endMarker, i);
if (start < 0 || end < 0) {
  console.error("bounds", start, end);
  process.exit(1);
}
const afterEnd = end + endMarker.length;
const replacement = `// M2.2-R3: write-back is part of the real success contract.
      // Do NOT mark the formal Final Delivery job completed before successful
      // M2.2 eight-page write-back (when a Freeze-bound report job is bound).
      if (input.m22_report_job_id) {
        try {
          await writeBackFreezeBoundReportOnDeliverySuccess({
            job_id,
            input,
            allReady,
          });
        } catch (wbErr) {
          console.warn(
            "[final-delivery-stage] m22 freeze-bound write-back failed — formal job not completed",
            wbErr,
          );
          const msg =
            wbErr instanceof Error ? wbErr.message : String(wbErr);
          await failXhighJob(job_id, \`m22_writeback_failed:\${msg}\`, {
            retryable: true,
            failure_reason: "interrupted",
            current_stage: "assemble",
            accumulated_content: "failed:m22_writeback",
          }).catch(() => undefined);
          await releaseM22ClaimFromJobInput(input).catch(() => undefined);
          await releaseXhighSessionLock("final_delivery", input.session_id).catch(
            () => undefined,
          );
          return;
        }
      }

      await completeXhighJob(job_id, {
        result,
        model,
        tokens_used,
        llm_debug,
        accumulated_content: \`delivery_done:\${full_text.length}\`,
      });
      await updateXhighJobStatus(job_id, "completed", {
        current_stage: "completed",
      });

      // Release shared KV claim (token-checked CAS) after success.
      await releaseM22ClaimFromJobInput(input).catch(() => undefined);

      await releaseXhighSessionLock("final_delivery", input.session_id);`;
s = s.slice(0, start) + replacement + s.slice(afterEnd);
fs.writeFileSync(path, s, "utf8");
console.log("patched stage-runner, replaced", afterEnd - start, "chars");
