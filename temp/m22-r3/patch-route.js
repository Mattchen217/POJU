const fs = require("fs");
const path = "D:/POJU/pojulife/app/api/poju/final-delivery/route.ts";
let s = fs.readFileSync(path, "utf8");

// --- 1) Replace regenerate forceRelease block ---
const forceStart = s.indexOf("// Persist Freeze-bound job + acquire shared KV claim BEFORE xhigh create/start.");
const prepareCall = s.indexOf("const prepared = await prepareFreezeBoundFinalDeliveryServer({", forceStart);
if (forceStart < 0 || prepareCall < 0) {
  console.error("forceRelease section markers missing", forceStart, prepareCall);
  process.exit(1);
}

const newPreparePreamble = `// Persist Freeze-bound job + acquire shared KV claim BEFORE xhigh create/start.
        // M2.2-R3: Regenerate must NOT forceRelease another context's claim.
        // Stop/resolve prior job elsewhere; release only with original owner token (CAS).
        // If ownership cannot be proven while a claim is held → fail closed.
        if (regenerate) {
          try {
            const {
              freezeReportClaimKey,
              defaultFreezeReportClaimOps,
              tryReleaseClaimForRegenerate,
            } = await import("@/lib/poju/decision-intake/freeze-report-claim");
            const { M22_REPORT_SCHEMA_VERSION } = await import(
              "@/lib/poju/decision-intake/freeze-bound-report"
            );
            const key = freezeReportClaimKey({
              sessionId: sessionIdRaw,
              freezeId: frozenSnap.freezeId,
              reportSchemaVersion: M22_REPORT_SCHEMA_VERSION,
            });

            let ownerToken: string | null = null;
            const prior = await findLatestXhighJobForSession(
              "final_delivery",
              sessionIdRaw,
            ).catch(() => null);
            if (prior && isFinalDeliveryJobInput(prior.input)) {
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
              }
              if (
                typeof prior.input.m22_claim_token === "string" &&
                prior.input.m22_claim_token &&
                prior.input.m22_claim_key === key
              ) {
                ownerToken = prior.input.m22_claim_token;
              }
            }

            const releaseResult = await tryReleaseClaimForRegenerate({
              claimOps: defaultFreezeReportClaimOps,
              claimKey: key,
              ownerToken,
            });
            if (!releaseResult.ok) {
              return NextResponse.json(
                {
                  ok: false,
                  error: releaseResult.error,
                  code: releaseResult.code,
                  retryable: true,
                  status: "running",
                  message:
                    "An active generation claim is held by another execution context. Wait for lease expiry or the owner to finish.",
                },
                { status: 409 },
              );
            }
          } catch (e) {
            console.warn("[final-delivery] m22 regenerate claim release failed closed", e);
            return NextResponse.json(
              {
                ok: false,
                error:
                  e instanceof Error
                    ? e.message
                    : "Regenerate claim release failed closed",
                code: "CLAIM_OWNED_BY_OTHER",
                retryable: true,
              },
              { status: 409 },
            );
          }
        }

        `;

s = s.slice(0, forceStart) + newPreparePreamble + s.slice(prepareCall);

// --- 2) Add helper right after m22 vars are declared for pre-handoff release ---
// We'll inline release calls at early-return sites instead of a nested function
// (route already has complex structure).

// Helper snippet used at early returns:
const releaseSnippet = async function findAndPatchEarlyReturns() {
  // After claim held, early returns that must release:
  // a) !regenerate + running/completed latest return jobStatusResponse
  // b) session lock !locked
  // c) catch at end
  // job create fail and pass fail already release
};

// Patch: when !regenerate returns existing job — release claim first
const resumeBlockMarker = `    // Resume in-flight job for this session (unless explicit regenerate forces a new one).
    if (!regenerate) {`;

if (!s.includes(resumeBlockMarker)) {
  console.error("resume block marker missing");
  process.exit(1);
}

// Replace the early returns inside !regenerate block to release claim.
// Find: return await jobStatusResponse(latest);  (stale check running)
// and: return await jobStatusResponse(latest); (completed)

const releaseBeforeReturn = `if (m22_claim_token && m22_claim_key) {
            const { releaseClaimBeforePreHandoffReturn } = await import(
              "@/lib/poju/decision-intake/freeze-bound-report"
            );
            await releaseClaimBeforePreHandoffReturn({
              claimKey: m22_claim_key,
              claimToken: m22_claim_token,
            }).catch(() => undefined);
            m22_claim_token = null;
            m22_claim_key = null;
          }
          `;

// More surgical: replace specific returns after claim acquisition.
// Pattern 1: non-stale running return
const p1 = `        if (!stale && (latest.status === "pending" || latest.status === "running")) {
          // Do not re-fire work — client keeps polling; status STOPs if truly dead.
          return await jobStatusResponse(latest);
        }
        if (latest.status === "completed" && isFinalDeliveryJobResult(latest.result)) {
          return await jobStatusResponse(latest);
        }`;

const p1new = `        if (!stale && (latest.status === "pending" || latest.status === "running")) {
          // Do not re-fire work — client keeps polling; status STOPs if truly dead.
          // M2.2-R3: pre-handoff early return — release owned claim (token CAS).
          if (m22_claim_token && m22_claim_key) {
            const { releaseClaimBeforePreHandoffReturn } = await import(
              "@/lib/poju/decision-intake/freeze-bound-report"
            );
            await releaseClaimBeforePreHandoffReturn({
              claimKey: m22_claim_key,
              claimToken: m22_claim_token,
            }).catch(() => undefined);
            m22_claim_token = null;
            m22_claim_key = null;
          }
          return await jobStatusResponse(latest);
        }
        if (latest.status === "completed" && isFinalDeliveryJobResult(latest.result)) {
          if (m22_claim_token && m22_claim_key) {
            const { releaseClaimBeforePreHandoffReturn } = await import(
              "@/lib/poju/decision-intake/freeze-bound-report"
            );
            await releaseClaimBeforePreHandoffReturn({
              claimKey: m22_claim_key,
              claimToken: m22_claim_token,
            }).catch(() => undefined);
            m22_claim_token = null;
            m22_claim_key = null;
          }
          return await jobStatusResponse(latest);
        }`;

if (!s.includes(p1)) {
  // try with weird dash encoding
  const idx = s.indexOf("Do not re-fire work");
  console.error("p1 not found, nearby idx", idx);
  if (idx >= 0) console.error(JSON.stringify(s.slice(idx - 80, idx + 280)));
  process.exit(1);
}
s = s.replace(p1, p1new);

// Session lock contention
const lockFail = `    const locked = await acquireXhighSessionLock("final_delivery", sessionIdRaw);
    if (!locked) {
      // Never return an old job as if regenerate succeeded.
      return NextResponse.json(
        { ok: false, error: "delivery_job_busy", retryable: false },
        { status: 409 },
      );
    }`;

const lockFailNew = `    const locked = await acquireXhighSessionLock("final_delivery", sessionIdRaw);
    if (!locked) {
      // M2.2-R3: pre-handoff — release owned claim before returning.
      if (m22_claim_token && m22_claim_key) {
        const { releaseClaimBeforePreHandoffReturn } = await import(
          "@/lib/poju/decision-intake/freeze-bound-report"
        );
        await releaseClaimBeforePreHandoffReturn({
          claimKey: m22_claim_key,
          claimToken: m22_claim_token,
        }).catch(() => undefined);
        m22_claim_token = null;
        m22_claim_key = null;
      }
      // Never return an old job as if regenerate succeeded.
      return NextResponse.json(
        { ok: false, error: "delivery_job_busy", retryable: false },
        { status: 409 },
      );
    }`;

if (!s.includes(lockFail)) {
  console.error("lock fail block not found");
  process.exit(1);
}
s = s.replace(lockFail, lockFailNew);

// Catch block at end — release if claim held and no handoff
const catchBlock = `  } catch (e) {
    if (inlineCall && isUpstashPlanLimitError(e)) {
      return inlineCall();
    }
    console.error("[final-delivery]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "final-delivery failed" },
      { status: 500 },
    );
  }
}`;

const catchBlockNew = `  } catch (e) {
    if (inlineCall && isUpstashPlanLimitError(e)) {
      return inlineCall();
    }
    // M2.2-R3: if we acquired a claim but never handed off to a running job, CAS-release.
    try {
      if (typeof m22_claim_token === "string" && m22_claim_token && typeof m22_claim_key === "string" && m22_claim_key) {
        const { releaseClaimBeforePreHandoffReturn } = await import(
          "@/lib/poju/decision-intake/freeze-bound-report"
        );
        await releaseClaimBeforePreHandoffReturn({
          claimKey: m22_claim_key,
          claimToken: m22_claim_token,
        }).catch(() => undefined);
      }
    } catch {
      /* ignore cleanup errors */
    }
    console.error("[final-delivery]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "final-delivery failed" },
      { status: 500 },
    );
  }
}`;

if (!s.includes(catchBlock)) {
  console.error("catch block not found");
  process.exit(1);
}
s = s.replace(catchBlock, catchBlockNew);

// Also: regenerate later block already stops jobs — may duplicate with our earlier stop.
// That's OK (idempotent fail). Keep it for non-DC regenerate paths that skip the prepare block.

// Also release on superseded_by_deploy early return inside !regenerate after claim
const supersedeReturn = `          // Fall through — only regenerate should create a new chain after redeploy.
          return NextResponse.json({
            ok: false,
            error: "superseded_by_deploy",
            retryable: false,
            reason: "superseded_by_deploy",
            message: "Prior deploy delivery stopped. Tap Regenerate to start a new report.",
          }, { status: 409 });`;

// There may be two similar blocks — patch the one after resume (create probe)
// Use a unique nearby comment
const createProbe = s.indexOf("supersede prior-deploy job on create probe");
if (createProbe >= 0) {
  const retIdx = s.indexOf('error: "superseded_by_deploy"', createProbe);
  // find return NextResponse before it
  const retStart = s.lastIndexOf("return NextResponse.json({", retIdx);
  const retEnd = s.indexOf("}, { status: 409 });", retIdx) + "}, { status: 409 });".length;
  if (retStart > createProbe && retEnd > retStart) {
    const oldRet = s.slice(retStart, retEnd);
    const newRet = `if (m22_claim_token && m22_claim_key) {
            const { releaseClaimBeforePreHandoffReturn } = await import(
              "@/lib/poju/decision-intake/freeze-bound-report"
            );
            await releaseClaimBeforePreHandoffReturn({
              claimKey: m22_claim_key,
              claimToken: m22_claim_token,
            }).catch(() => undefined);
            m22_claim_token = null;
            m22_claim_key = null;
          }
          ` + oldRet;
    s = s.slice(0, retStart) + newRet + s.slice(retEnd);
  }
}

fs.writeFileSync(path, s, "utf8");
console.log("patched route.ts, len", s.length);

// Verify forceRelease of m22 claim is gone from regenerate prepare path
if (s.includes("m22 claim force-release before prepare") || s.includes("forceRelease(key)")) {
  // forceRelease(key) specifically for m22
  const m = s.match(/forceRelease\(key\)/g);
  console.log("forceRelease(key) remaining:", m);
} else {
  console.log("no forceRelease(key) — good");
}
