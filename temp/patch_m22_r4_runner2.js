const fs = require("fs");
const p = "lib/poju/final-delivery-stage-runner.ts";
const origHadCrlf = fs.readFileSync(p, "utf8").includes("\r\n");
let s = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

// Heartbeat: abort on any revoked execution (not only user_cancelled)
{
  const old = `        const snap = await getXhighJob(job_id);
        if (
          snap?.status === "failed" &&
          (snap.failure_reason === "user_cancelled" ||
            String(snap.accumulated_content ?? "").includes("user_cancelled"))
        ) {
          userCancel.abort();
          return;
        }`;
  const neu = `        const snap = await getXhighJob(job_id);
        // M2.2-R4: abort in-flight LLM when Regenerate/deploy/stop revoked authority.
        if (snap && isDeliveryExecutionRevoked(snap)) {
          userCancel.abort();
          return;
        }`;
  if (!s.includes(old)) {
    if (s.includes("isDeliveryExecutionRevoked(snap)")) console.log("heartbeat already patched");
    else throw new Error("heartbeat block missing");
  } else {
    s = s.replace(old, neu);
    console.log("heartbeat patched");
  }
}

// After entry status check in runFinalDeliveryStage — also treat revoked content markers
// (status check already returns on failed/completed)

// Before updateXhighJobStatus to running at start of work — authority re-check is implicit via status
// Add explicit authority check right before assemble write-back / complete path — already in writeBack

// Patch assemble success path to re-check authority before write-back AND before complete,
// and to treat DeliveryExecutionRevokedError specially (do not overwrite / do not re-fail as writeback)
{
  const old = `      // M2.2-R3: write-back is part of the real success contract.
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
      });`;

  // Fix encoding of emdash in file - may be special char
  if (!s.includes("write-back is part of the real success contract")) {
    throw new Error("success contract comment missing");
  }

  // Use a more targeted replace around the write-back try/catch
  const startMarker = "      // M2.2-R3: write-back is part of the real success contract.";
  const endMarker = `      await updateXhighJobStatus(job_id, "completed", {
        current_stage: "completed",
      });`;

  const start = s.indexOf(startMarker);
  const end = s.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error("success block bounds missing " + start + " " + end);

  const neu = `      // M2.2-R4: success contract — authority check, then M2.2 write-back, then formal complete.
      // Superseded workers must not write-back or complete.
      try {
        await assertDeliveryExecutionAuthority(job_id);
      } catch (authErr) {
        if (authErr instanceof DeliveryExecutionRevokedError) {
          console.warn("[final-delivery-stage] assemble skip — execution revoked", {
            job_id,
            reason: authErr.failure_reason,
          });
          await releaseM22ClaimFromJobInput(input).catch(() => undefined);
          await releaseXhighSessionLock("final_delivery", input.session_id).catch(
            () => undefined,
          );
          return;
        }
        throw authErr;
      }

      if (input.m22_report_job_id) {
        try {
          await writeBackFreezeBoundReportOnDeliverySuccess({
            job_id,
            input,
            allReady,
          });
        } catch (wbErr) {
          if (wbErr instanceof DeliveryExecutionRevokedError) {
            console.warn("[final-delivery-stage] m22 write-back aborted — revoked", {
              job_id,
              reason: wbErr.failure_reason,
            });
            await releaseM22ClaimFromJobInput(input).catch(() => undefined);
            await releaseXhighSessionLock("final_delivery", input.session_id).catch(
              () => undefined,
            );
            return;
          }
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

      // Re-check before formal complete — Regenerate may have won during write-back.
      try {
        await assertDeliveryExecutionAuthority(job_id);
      } catch (authErr) {
        if (authErr instanceof DeliveryExecutionRevokedError) {
          console.warn("[final-delivery-stage] complete skipped — execution revoked", {
            job_id,
            reason: authErr.failure_reason,
          });
          await releaseM22ClaimFromJobInput(input).catch(() => undefined);
          await releaseXhighSessionLock("final_delivery", input.session_id).catch(
            () => undefined,
          );
          return;
        }
        throw authErr;
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
      });`;

  s = s.slice(0, start) + neu + s.slice(end + endMarker.length);
  console.log("assemble success contract patched");
}

// Export finalizeFormalDeliverySuccessForTests that mirrors production ordering
if (!s.includes("finalizeFormalDeliverySuccessForTests")) {
  const exportBlock = `

/**
 * M2.2-R4 test/production mirror: authority → optional M2.2 write-back → completeXhighJob.
 * Returns the persisted formal job status via getXhighJob (never a local variable).
 */
export async function finalizeFormalDeliverySuccessForTests(args: {
  job_id: string;
  input: FinalDeliveryJobInput;
  allReady: Array<{
    key: string;
    body_markdown: string;
    interleaved_markdown?: string;
  }>;
  result: FinalDeliveryJobResult;
}): Promise<{ formal: Awaited<ReturnType<typeof getXhighJob>>; revoked: boolean }> {
  const { job_id, input, allReady, result } = args;
  try {
    await assertDeliveryExecutionAuthority(job_id);
  } catch (e) {
    if (e instanceof DeliveryExecutionRevokedError) {
      return { formal: await getXhighJob(job_id), revoked: true };
    }
    throw e;
  }
  if (input.m22_report_job_id) {
    try {
      await writeBackFreezeBoundReportOnDeliverySuccess({ job_id, input, allReady });
    } catch (wbErr) {
      if (wbErr instanceof DeliveryExecutionRevokedError) {
        return { formal: await getXhighJob(job_id), revoked: true };
      }
      await failXhighJob(job_id, \`m22_writeback_failed:\${wbErr instanceof Error ? wbErr.message : String(wbErr)}\`, {
        retryable: true,
        failure_reason: "interrupted",
        current_stage: "assemble",
        accumulated_content: "failed:m22_writeback",
      }).catch(() => undefined);
      await releaseM22ClaimFromJobInput(input).catch(() => undefined);
      return { formal: await getXhighJob(job_id), revoked: false };
    }
  }
  try {
    await assertDeliveryExecutionAuthority(job_id);
  } catch (e) {
    if (e instanceof DeliveryExecutionRevokedError) {
      return { formal: await getXhighJob(job_id), revoked: true };
    }
    throw e;
  }
  await completeXhighJob(job_id, {
    result,
    model: result.model,
    tokens_used: result.tokens_used,
    llm_debug: result.llm_debug,
    accumulated_content: \`delivery_done:\${result.full_text.length}\`,
  });
  await updateXhighJobStatus(job_id, "completed", { current_stage: "completed" });
  await releaseM22ClaimFromJobInput(input).catch(() => undefined);
  return { formal: await getXhighJob(job_id), revoked: false };
}
`;
  // Insert before runFinalDeliveryJob export
  const marker = "/** Start or resume pipeline from the first incomplete stage. */";
  if (!s.includes(marker)) throw new Error("runFinalDeliveryJob marker missing");
  s = s.replace(marker, exportBlock + "\n" + marker);
  console.log("test finalize helper exported");
}

// Gate saveDeliveryStageCheckpoint calls via a local wrapper? 
// Instead patch save sites that happen after LLM — add authority check before schedule continue in runFinalDeliveryStage
{
  // After fanout merge / before schedule next — find a stable pattern
  // Wrap saveDeliveryStageCheckpoint in an authority-checked helper at top of file usage
  if (!s.includes("async function saveDeliveryStageCheckpointIfAuthorized")) {
    const insertAfter = `async function releaseM22ClaimFromJobInput(
  input: FinalDeliveryJobInput,
): Promise<void> {
  const token = input.m22_claim_token;
  const key = input.m22_claim_key;
  if (!token || !key) return;
  const { releaseFreezeBoundReportClaimServer } = await import(
    "@/lib/poju/decision-intake/freeze-bound-report-server"
  );
  await releaseFreezeBoundReportClaimServer({ claimKey: key, claimToken: token });
}`;
    if (!s.includes(insertAfter)) throw new Error("releaseM22 helper missing for insert");
    const helper = `
/** M2.2-R4: refuse stage commits after Regenerate/deploy/stop revoked authority. */
async function saveDeliveryStageCheckpointIfAuthorized(
  job_id: string,
  checkpoint: Parameters<typeof saveDeliveryStageCheckpoint>[1],
): Promise<boolean> {
  const ok = await tryCommitUnderDeliveryAuthority(job_id);
  if (!ok) {
    console.warn("[final-delivery-stage] skip checkpoint — execution revoked", {
      job_id,
      stage: (checkpoint as { stage?: string }).stage,
    });
    return false;
  }
  await saveDeliveryStageCheckpoint(job_id, checkpoint);
  return true;
}
`;
    s = s.replace(insertAfter, insertAfter + "\n" + helper);
    // Replace call sites saveDeliveryStageCheckpoint(job_id → saveDeliveryStageCheckpointIfAuthorized(job_id
    // But NOT the import or the helper definition itself
    s = s.replace(
      /await saveDeliveryStageCheckpoint\(/g,
      "await saveDeliveryStageCheckpointIfAuthorized("
    );
    // Fix the helper body which got rewritten
    s = s.replace(
      "await saveDeliveryStageCheckpointIfAuthorized(job_id, checkpoint);\n  return true;",
      "await saveDeliveryStageCheckpoint(job_id, checkpoint);\n  return true;"
    );
    console.log("checkpoint authority gate added");
  }
}

// Before scheduling next hop after stage ok — authority check
{
  const patterns = [
    // common schedule after stage
  ];
  // Add check at start of the "schedule next" blocks by patching scheduleDeliveryStageContinue wrapper
  if (!s.includes("async function scheduleDeliveryStageContinueIfAuthorized")) {
    // Find scheduleDeliveryStageContinue import usage — wrap calls
    // Safer: patch the local calls that look like await scheduleDeliveryStageContinue(
    // Actually scheduleDeliveryStageContinue is imported — add wrapper near save wrapper
    const anchor = "async function saveDeliveryStageCheckpointIfAuthorized(";
    if (!s.includes(anchor)) throw new Error("need save wrapper first");
    // Insert schedule wrapper after save wrapper function ends — find "return true;\n}" after save helper
    const wrap = `
async function scheduleDeliveryStageContinueIfAuthorized(
  job_id: string,
  stage: Parameters<typeof scheduleDeliveryStageContinue>[1],
  opts: Parameters<typeof scheduleDeliveryStageContinue>[2],
): Promise<Awaited<ReturnType<typeof scheduleDeliveryStageContinue>> | "revoked"> {
  const ok = await tryCommitUnderDeliveryAuthority(job_id);
  if (!ok) {
    console.warn("[final-delivery-stage] skip schedule continue — execution revoked", {
      job_id,
      stage,
    });
    return "revoked";
  }
  return scheduleDeliveryStageContinue(job_id, stage, opts);
}
`;
    // Insert after save helper's closing — locate unique end
    const endSave = s.indexOf(
      "await saveDeliveryStageCheckpoint(job_id, checkpoint);\n  return true;\n}"
    );
    if (endSave < 0) throw new Error("save helper end missing");
    const insertAt = endSave + "await saveDeliveryStageCheckpoint(job_id, checkpoint);\n  return true;\n}".length;
    s = s.slice(0, insertAt) + "\n" + wrap + s.slice(insertAt);
    s = s.replace(
      /await scheduleDeliveryStageContinue\(/g,
      "await scheduleDeliveryStageContinueIfAuthorized("
    );
    // Fix recursive call inside wrapper
    s = s.replace(
      "return scheduleDeliveryStageContinueIfAuthorized(job_id, stage, opts);",
      "return scheduleDeliveryStageContinue(job_id, stage, opts);"
    );
    console.log("schedule authority gate added");
  }
}

fs.writeFileSync(p, origHadCrlf ? s.replace(/\n/g, "\r\n") : s);
console.log("runner file written, len", s.length);
