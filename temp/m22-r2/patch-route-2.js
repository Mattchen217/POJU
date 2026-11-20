const fs = require("fs");
const path = "app/api/poju/final-delivery/route.ts";
let s = fs.readFileSync(path, "utf8");

// Insert m22 fields into jobInput
if (!s.includes("m22_claim_token")) {
  const marker = "require_decision_context: requireDecisionContext,";
  const idx = s.indexOf(marker);
  if (idx < 0) throw new Error("jobInput require_decision_context not found");
  const insert = `require_decision_context: requireDecisionContext,
      m22_claim_token,
      m22_claim_key,
      m22_report_job_id,`;
  s = s.slice(0, idx) + insert + s.slice(idx + marker.length);
  console.log("jobInput m22 fields added");
} else {
  console.log("jobInput already has m22 fields");
}

// After createXhighJob success, bind claim job id; on create failure release claim.
// Find: const job = await createXhighJob({
const createMarker = `    const job = await createXhighJob({
      phase: "final_delivery",
      session_id: sessionIdRaw,
      locale,
      job_input: jobInput,
      deploy_generation: currentDeliveryDeployGeneration(),
    });

    if (!isFinalDeliveryJobInput(job.input)) {
      await releaseXhighSessionLock("final_delivery", sessionIdRaw);
      return NextResponse.json({ ok: false, error: "job_create_failed" }, { status: 500 });
    }`;

if (!s.includes(createMarker)) {
  // try to locate loosely
  const i = s.indexOf('const job = await createXhighJob({');
  console.log("createXhighJob at", i);
  console.log(JSON.stringify(s.slice(i, i+450)));
  throw new Error("createXhighJob block not found exactly");
}

const createReplacement = `    const job = await createXhighJob({
      phase: "final_delivery",
      session_id: sessionIdRaw,
      locale,
      job_input: jobInput,
      deploy_generation: currentDeliveryDeployGeneration(),
    });

    if (!isFinalDeliveryJobInput(job.input)) {
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

s = s.replace(createMarker, createReplacement);

// On pass charge failure, release m22 claim too
const passFailMarker = `      if (!charged.ok) {
        await failXhighJob(job.job_id, "pass_required", {
          retryable: false,
          failure_reason: "transport_error",
        }).catch(() => undefined);
        await releaseXhighSessionLock("final_delivery", sessionIdRaw).catch(() => undefined);
        return charged.response;
      }`;

if (s.includes(passFailMarker) && !s.includes("releaseFreezeBoundReportClaimServer")) {
  // may already have from create failure path - check pass fail specifically
}
if (s.includes(passFailMarker)) {
  s = s.replace(
    passFailMarker,
    `      if (!charged.ok) {
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
      }`,
  );
  console.log("pass-fail claim release patched");
}

// On regenerate: force-release prior m22 claim so a new owner can acquire.
// Insert just before acquireXhighSessionLock when regenerate already cleaned latest job.
const regenLock = `    const locked = await acquireXhighSessionLock("final_delivery", sessionIdRaw);`;
if (s.includes(regenLock) && !s.includes("m22 claim force-release on regenerate")) {
  s = s.replace(
    regenLock,
    `    // M2.2-R2: regenerate must not be blocked by a stale generation claim.
    if (regenerate && decision_context_binding) {
      try {
        const { freezeReportClaimKey, defaultFreezeReportClaimOps, M22_REPORT_CLAIM_TTL_SEC: _ttl } = await import(
          "@/lib/poju/decision-intake/freeze-report-claim"
        );
        const { M22_REPORT_SCHEMA_VERSION, freezeIdFromBinding } = await import(
          "@/lib/poju/decision-intake/freeze-bound-report"
        );
        void _ttl;
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

    const locked = await acquireXhighSessionLock("final_delivery", sessionIdRaw);`,
  );
  console.log("regenerate force-release patched");
}

fs.writeFileSync(path, s);
console.log("route job/create/release patches done");
