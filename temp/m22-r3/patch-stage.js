const fs = require("fs");
const path = "D:/POJU/pojulife/lib/poju/final-delivery-stage-runner.ts";
let s = fs.readFileSync(path, "utf8");

const oldBlock = `      const result: FinalDeliveryJobResult = {
        kind: "final_delivery",
        full_text,
        actions: actions as unknown as Array<Record<string, unknown>>,
        model,
        tokens_used,
        llm_debug,
        timings,
      };

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

      // M2.2-R2: write eight validated pages into the original Freeze-bound report job.
      try {
        await writeBackFreezeBoundReportOnDeliverySuccess({
          job_id,
          input,
          allReady,
        });
      } catch (wbErr) {
        console.warn("[final-delivery-stage] m22 freeze-bound write-back failed", wbErr);
        // Delivery xhigh job already completed; M2.2 job stays failed/retryable (never silently completed).
      }

      // Release shared KV claim (token-checked CAS) after success.
      await releaseM22ClaimFromJobInput(input).catch(() => undefined);

      await releaseXhighSessionLock("final_delivery", input.session_id);`;

const newBlock = `      const result: FinalDeliveryJobResult = {
        kind: "final_delivery",
        full_text,
        actions: actions as unknown as Array<Record<string, unknown>>,
        model,
        tokens_used,
        llm_debug,
        timings,
      };

      // M2.2-R3: write-back is part of the real success contract.
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

if (!s.includes(oldBlock)) {
  console.error("assemble success block not found");
  // debug: find nearby
  const idx = s.indexOf("M2.2-R2: write eight validated pages");
  console.error("marker idx", idx);
  process.exit(1);
}
s = s.replace(oldBlock, newBlock);
fs.writeFileSync(path, s, "utf8");
console.log("patched final-delivery-stage-runner.ts");
