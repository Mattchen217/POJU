const fs = require("fs");
const path = "app/api/poju/final-delivery/route.ts";
let s = fs.readFileSync(path, "utf8");

// Add m22 fields to jobInput object
const jobReq = "require_decision_context: requireDecisionContext,";
const jobIdx = s.indexOf(jobReq);
if (jobIdx < 0) throw new Error("jobInput require field missing");
// Only patch the jobInput occurrence (first after decision_context_snapshot assignment in jobInput)
const after = s.slice(jobIdx, jobIdx + 80);
if (!after.includes("m22_claim_token")) {
  s =
    s.slice(0, jobIdx) +
    "require_decision_context: requireDecisionContext,\n      m22_claim_token,\n      m22_claim_key,\n      m22_report_job_id," +
    s.slice(jobIdx + jobReq.length);
  console.log("jobInput fields inserted");
} else {
  console.log("jobInput fields present");
}

// Patch createXhighJob failure + bind
const failNeedle =
  'if (!isFinalDeliveryJobInput(job.input)) {\r\n      await releaseXhighSessionLock("final_delivery", sessionIdRaw);\r\n      return NextResponse.json({ ok: false, error: "job_create_failed" }, { status: 500 });\r\n    }';
const failNeedleLF =
  'if (!isFinalDeliveryJobInput(job.input)) {\n      await releaseXhighSessionLock("final_delivery", sessionIdRaw);\n      return NextResponse.json({ ok: false, error: "job_create_failed" }, { status: 500 });\n    }';

const failRepl = `if (!isFinalDeliveryJobInput(job.input)) {
      if (m22_claim_token && m22_claim_key) {
        const { releaseFreezeBoundReportClaimServer } = await import(
          "@/lib/poju/decision-intake/freeze-bound-report-server"
        );
        await releaseFreezeBoundReportClaimServer({
          claimKey: m22_claim_key,
          claimToken: m22_claim_token,
        }).catch(() => undefined);
      }
      await releaseXhighSessionLock("final_delivery", sessionIdRaw);
      return NextResponse.json({ ok: false, error: "job_create_failed" }, { status: 500 });
    }

    // Bind xhigh job id onto the owned M2.2 claim (token-checked).
    if (m22_claim_token && m22_claim_key) {
      try {
        const { defaultFreezeReportClaimOps } = await import(
          "@/lib/poju/decision-intake/freeze-report-claim"
        );
        await defaultFreezeReportClaimOps.bindJobId(
          m22_claim_key,
          m22_claim_token,
          job.job_id,
        );
      } catch (bindErr) {
        console.warn("[final-delivery] m22 claim bindJobId skipped", bindErr);
      }
    }`;

if (s.includes(failNeedle)) {
  s = s.replace(failNeedle, failRepl);
  console.log("create fail patched (CRLF)");
} else if (s.includes(failNeedleLF)) {
  s = s.replace(failNeedleLF, failRepl);
  console.log("create fail patched (LF)");
} else if (s.includes("m22 claim bindJobId")) {
  console.log("create fail already patched");
} else {
  throw new Error("create fail block not found");
}

// Pass charge failure release
const passNeedleCR =
  'if (!charged.ok) {\r\n        await failXhighJob(job.job_id, "pass_required", {\r\n          retryable: false,\r\n          failure_reason: "transport_error",\r\n        }).catch(() => undefined);\r\n        await releaseXhighSessionLock("final_delivery", sessionIdRaw).catch(() => undefined);\r\n        return charged.response;\r\n      }';
const passNeedleLF =
  'if (!charged.ok) {\n        await failXhighJob(job.job_id, "pass_required", {\n          retryable: false,\n          failure_reason: "transport_error",\n        }).catch(() => undefined);\n        await releaseXhighSessionLock("final_delivery", sessionIdRaw).catch(() => undefined);\n        return charged.response;\n      }';
const passRepl = `if (!charged.ok) {
        await failXhighJob(job.job_id, "pass_required", {
          retryable: false,
          failure_reason: "transport_error",
        }).catch(() => undefined);
        if (m22_claim_token && m22_claim_key) {
          const { releaseFreezeBoundReportClaimServer } = await import(
            "@/lib/poju/decision-intake/freeze-bound-report-server"
          );
          await releaseFreezeBoundReportClaimServer({
            claimKey: m22_claim_key,
            claimToken: m22_claim_token,
          }).catch(() => undefined);
        }
        await releaseXhighSessionLock("final_delivery", sessionIdRaw).catch(() => undefined);
        return charged.response;
      }`;

if (s.includes("pass_required") && s.includes("releaseFreezeBoundReportClaimServer") && s.indexOf("pass_required") > 0) {
  // check if pass path already has release
  const passIdx = s.indexOf('failXhighJob(job.job_id, "pass_required"');
  const window = s.slice(passIdx, passIdx + 500);
  if (window.includes("releaseFreezeBoundReportClaimServer")) {
    console.log("pass-fail already has claim release");
  } else if (s.includes(passNeedleCR)) {
    s = s.replace(passNeedleCR, passRepl);
    console.log("pass-fail patched CRLF");
  } else if (s.includes(passNeedleLF)) {
    s = s.replace(passNeedleLF, passRepl);
    console.log("pass-fail patched LF");
  } else {
    console.log("pass-fail needle missing; window=", JSON.stringify(window.slice(0, 200)));
  }
}

// Regenerate force-release before lock
const lockNeedleCR = '    const locked = await acquireXhighSessionLock("final_delivery", sessionIdRaw);';
const lockNeedleLF = '    const locked = await acquireXhighSessionLock("final_delivery", sessionIdRaw);';
if (!s.includes("m22 claim force-release on regenerate")) {
  const lockIdx = s.indexOf('const locked = await acquireXhighSessionLock("final_delivery", sessionIdRaw);');
  if (lockIdx < 0) throw new Error("lock acquire not found");
  const prefix = `    // M2.2-R2: regenerate must not be blocked by a stale generation claim.
    if (regenerate && decision_context_binding) {
      try {
        const { freezeReportClaimKey, defaultFreezeReportClaimOps } = await import(
          "@/lib/poju/decision-intake/freeze-report-claim"
        );
        const { M22_REPORT_SCHEMA_VERSION, freezeIdFromBinding } = await import(
          "@/lib/poju/decision-intake/freeze-bound-report"
        );
        const key = freezeReportClaimKey({
          sessionId: sessionIdRaw,
          freezeId: freezeIdFromBinding(decision_context_binding),
          reportSchemaVersion: M22_REPORT_SCHEMA_VERSION,
        });
        // Comment marker: m22 claim force-release on regenerate
        await defaultFreezeReportClaimOps.forceRelease(key);
      } catch (e) {
        console.warn("[final-delivery] m22 claim force-release on regenerate skipped", e);
      }
    }

    `;
  s = s.slice(0, lockIdx) + prefix + s.slice(lockIdx);
  console.log("regenerate force-release inserted");
} else {
  console.log("regenerate force-release present");
}

fs.writeFileSync(path, s);
console.log("route-2 done");
