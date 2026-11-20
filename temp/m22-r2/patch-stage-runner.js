const fs = require("fs");
const path = "lib/poju/final-delivery-stage-runner.ts";
let s = fs.readFileSync(path, "utf8");

if (s.includes("completeFreezeBoundReportFromDeliveryPagesServer")) {
  console.log("stage-runner already has write-back");
} else {
  const successNeedleCR =
    'await completeXhighJob(job_id, {\r\n        result,\r\n        model,\r\n        tokens_used,\r\n        llm_debug,\r\n        accumulated_content: `delivery_done:${full_text.length}`,\r\n      });\r\n      await updateXhighJobStatus(job_id, "completed", {\r\n        current_stage: "completed",\r\n      });\r\n      await releaseXhighSessionLock("final_delivery", input.session_id);';
  const successNeedleLF = successNeedleCR.replace(/\r\n/g, "\n");

  const successRepl = `await completeXhighJob(job_id, {
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

  if (s.includes(successNeedleCR)) {
    s = s.replace(successNeedleCR, successRepl);
    console.log("success write-back patched CRLF");
  } else if (s.includes(successNeedleLF)) {
    s = s.replace(successNeedleLF, successRepl);
    console.log("success write-back patched LF");
  } else {
    const i = s.indexOf("await completeXhighJob(job_id");
    console.log("near complete:", JSON.stringify(s.slice(i, i + 350)));
    throw new Error("success needle not found");
  }
}

// Patch failStage to release claim + mark m22 failed
if (!s.includes("releaseM22ClaimFromJobInput")) {
  // helpers not yet added — will add below
}

// Add helper functions before failStage
if (!s.includes("async function releaseM22ClaimFromJobInput")) {
  const failStageIdx = s.indexOf("async function failStage(");
  if (failStageIdx < 0) throw new Error("failStage not found");
  const helpers = `
/** M2.2-R2: token-checked CAS release of Freeze-bound generation claim. */
async function releaseM22ClaimFromJobInput(
  input: FinalDeliveryJobInput,
): Promise<void> {
  const token = input.m22_claim_token;
  const key = input.m22_claim_key;
  if (!token || !key) return;
  const { releaseFreezeBoundReportClaimServer } = await import(
    "@/lib/poju/decision-intake/freeze-bound-report-server"
  );
  await releaseFreezeBoundReportClaimServer({ claimKey: key, claimToken: token });
}

/** M2.2-R2: persist exactly eight pages onto the original Freeze-bound report job. */
async function writeBackFreezeBoundReportOnDeliverySuccess(args: {
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
  if (!reportJobId) return;

  const { loadPOJUSession, savePOJUSession } = await import(
    "@/lib/poju/session-manager"
  );
  const {
    createFrozenReportSnapshot,
    completeFreezeBoundReportFromDeliveryPages,
    failFreezeBoundReportJob,
    DECISION_PAGE_IDS: _unused,
  } = await import("@/lib/poju/decision-intake/freeze-bound-report");
  void _unused;
  const { DECISION_PAGE_IDS } = await import(
    "@/lib/llm/pro/delivery/page-feed-matrix"
  );
  const { canonicalFaceId } = await import(
    "@/lib/llm/pro/delivery/decision-page-bridge"
  );

  const session = await loadPOJUSession(input.session_id);
  if (!session) {
    throw new Error("m22_writeback_session_missing");
  }

  const snapshot = createFrozenReportSnapshot({
    sessionId: input.session_id,
    frozen: input.decision_context_snapshot,
    binding: input.decision_context_binding,
  });

  // Verify original job id + Freeze binding + content hash + schema before completion.
  const existing = (session.freeze_bound_report_jobs ?? []).find(
    (j) => j.job_id === reportJobId,
  );
  if (!existing) {
    throw new Error("m22_writeback_job_missing:" + reportJobId);
  }
  if (
    existing.binding.contentHash !== snapshot.contentHash ||
    existing.binding.freezeId !== snapshot.freezeId ||
    existing.binding.decisionContextVersion !== snapshot.decisionContextVersion ||
    existing.binding.reportSchemaVersion !== snapshot.reportSchemaVersion
  ) {
    await failFreezeBoundReportJob({
      session,
      jobId: reportJobId,
      error: "BINDING_MISMATCH_ON_WRITEBACK",
      deps: { persistSession: savePOJUSession },
    });
    throw new Error("m22_writeback_binding_mismatch");
  }

  const byPage = new Map<string, string>();
  for (const ready of allReady) {
    const pageId = canonicalFaceId(ready.key) ?? ready.key;
    const content =
      (ready.interleaved_markdown && ready.interleaved_markdown.trim()) ||
      (ready.body_markdown && ready.body_markdown.trim()) ||
      "";
    if (content) byPage.set(pageId, content);
  }

  const pages = DECISION_PAGE_IDS.map((pageId) => ({
    pageId,
    content: byPage.get(pageId) ?? "",
  }));

  try {
    const completed = await completeFreezeBoundReportFromDeliveryPages({
      session,
      snapshot,
      jobId: reportJobId,
      pages,
      deps: { persistSession: savePOJUSession },
    });
    if (!completed.ok) {
      await failFreezeBoundReportJob({
        session,
        jobId: reportJobId,
        error: completed.error,
        deps: { persistSession: savePOJUSession },
      });
      throw new Error("m22_writeback_incomplete:" + completed.code);
    }
    console.info("[final-delivery-stage] m22 freeze-bound report completed", {
      job_id,
      m22_report_job_id: reportJobId,
      freezeId: snapshot.freezeId,
      pages: pages.length,
    });
  } catch (e) {
    // Failure must remain failed/retryable, never completed.
    await failFreezeBoundReportJob({
      session,
      jobId: reportJobId,
      error: e instanceof Error ? e.message : String(e),
      deps: { persistSession: savePOJUSession },
    }).catch(() => undefined);
    throw e;
  }
}

`;
  s = s.slice(0, failStageIdx) + helpers + s.slice(failStageIdx);
  console.log("helpers inserted");
}

// In failStage, after failXhighJob / before or after releaseXhighSessionLock — release m22 claim
if (!s.includes("releaseM22ClaimFromJobInput(input)") && !s.includes("m22 claim release on failStage")) {
  // soft - we'll patch failStage to load job input and release
}

// Patch failStage end to release claim
const failEndCR =
  'await failXhighJob(job_id, errorMsg, {\r\n    retryable: false,\r\n    failure_reason: "transport_error",';
// Better: after releaseXhighSessionLock in failStage
const failReleaseCR =
  'await releaseXhighSessionLock("final_delivery", session_id);\r\n  return "hard_failed";\r\n}';
const failReleaseLF =
  'await releaseXhighSessionLock("final_delivery", session_id);\n  return "hard_failed";\n}';

const failReleaseRepl = `await releaseXhighSessionLock("final_delivery", session_id);
  // M2.2-R2: release generation claim on hard fail (token CAS); mark report failed/retryable.
  try {
    const job = await getXhighJob(job_id);
    if (job && isFinalDeliveryJobInput(job.input)) {
      // Comment marker: m22 claim release on failStage
      if (job.input.m22_report_job_id) {
        const { loadPOJUSession, savePOJUSession } = await import(
          "@/lib/poju/session-manager"
        );
        const { failFreezeBoundReportJobServer } = await import(
          "@/lib/poju/decision-intake/freeze-bound-report-server"
        );
        const session = await loadPOJUSession(session_id);
        if (session) {
          await failFreezeBoundReportJobServer({
            session,
            jobId: job.input.m22_report_job_id,
            error: errorMsg,
            deps: { persistSession: savePOJUSession },
          });
        }
      }
      await releaseM22ClaimFromJobInput(job.input);
    }
  } catch (e) {
    console.warn("[final-delivery-stage] m22 fail-path cleanup skipped", e);
  }
  return "hard_failed";
}`;

if (s.includes("m22 claim release on failStage")) {
  console.log("failStage claim release present");
} else if (s.includes(failReleaseCR)) {
  s = s.replace(failReleaseCR, failReleaseRepl);
  console.log("failStage claim release patched CRLF");
} else if (s.includes(failReleaseLF)) {
  s = s.replace(failReleaseLF, failReleaseRepl);
  console.log("failStage claim release patched LF");
} else {
  console.log("WARNING: failStage release needle not found");
}

fs.writeFileSync(path, s);
console.log("stage-runner patched");
