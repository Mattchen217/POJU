const fs = require("fs");
const path = "D:/POJU/pojulife/app/api/poju/final-delivery/route.ts";
let s = fs.readFileSync(path, "utf8");

function must(cond, msg) {
  if (!cond) {
    console.error(msg);
    process.exit(1);
  }
}

// ========== 1) Replace forceRelease regenerate block ==========
const forceMarker = "// Comment marker: m22 claim force-release before prepare";
const forceIdx = s.indexOf(forceMarker);
must(forceIdx >= 0, "force marker missing");
const blockStart = s.lastIndexOf("// Persist Freeze-bound job", forceIdx);
must(blockStart >= 0, "persist comment missing");
const prepareCall = s.indexOf("const prepared = await prepareFreezeBoundFinalDeliveryServer({", forceIdx);
must(prepareCall >= 0, "prepare call missing");

const newPreparePreamble = `// Persist Freeze-bound job + acquire shared KV claim BEFORE xhigh create/start.
        // M2.2-R3: Regenerate must NOT forceRelease another context's claim.
        // Stop/resolve prior job; release only with original owner token (CAS).
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
s = s.slice(0, blockStart) + newPreparePreamble + s.slice(prepareCall);
must(!s.includes("forceRelease(key)"), "forceRelease(key) still present after replace");
console.log("step1 forceRelease removed");

// ========== 2) Pre-handoff release on running/completed early returns ==========
const reFire = "Do not re-fire work";
const reFireIdx = s.indexOf(reFire);
must(reFireIdx >= 0, "re-fire comment missing");
// Find the if (!stale ...) block start
const staleIf = s.lastIndexOf("if (!stale &&", reFireIdx);
must(staleIf >= 0, "stale if missing");
const completedIf = s.indexOf('if (latest.status === "completed" && isFinalDeliveryJobResult(latest.result))', reFireIdx);
must(completedIf >= 0, "completed if missing");
// End of completed return
const completedReturnEnd = s.indexOf("return await jobStatusResponse(latest);", completedIf);
must(completedReturnEnd >= 0, "completed return missing");
const afterCompletedReturn = completedReturnEnd + "return await jobStatusResponse(latest);".length;

const releaseBlock = `if (m22_claim_token && m22_claim_key) {
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

const newEarlyReturns = `if (!stale && (latest.status === "pending" || latest.status === "running")) {
          // Do not re-fire work — client keeps polling; status STOPs if truly dead.
          // M2.2-R3: pre-handoff early return — release owned claim (token CAS).
          ${releaseBlock}return await jobStatusResponse(latest);
        }
        if (latest.status === "completed" && isFinalDeliveryJobResult(latest.result)) {
          ${releaseBlock}return await jobStatusResponse(latest);
        }`;

s = s.slice(0, staleIf) + newEarlyReturns + s.slice(afterCompletedReturn);
console.log("step2 early returns patched");

// ========== 3) Session lock contention ==========
const lockMarker = 'error: "delivery_job_busy"';
const lockErrIdx = s.indexOf(lockMarker);
must(lockErrIdx >= 0, "delivery_job_busy missing");
const lockedIf = s.lastIndexOf("if (!locked)", lockErrIdx);
must(lockedIf >= 0, "!locked missing");
const lockedBodyStart = s.indexOf("{", lockedIf);
// Insert release at start of body after {
const insertAt = lockedBodyStart + 1;
const lockRelease = `
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
`;
if (!s.slice(insertAt, insertAt + 200).includes("releaseClaimBeforePreHandoffReturn")) {
  s = s.slice(0, insertAt) + lockRelease + s.slice(insertAt);
}
console.log("step3 lock contention patched");

// ========== 4) superseded_by_deploy on create probe ==========
const probe = "supersede prior-deploy job on create probe";
const probeIdx = s.indexOf(probe);
if (probeIdx >= 0) {
  const errIdx = s.indexOf('error: "superseded_by_deploy"', probeIdx);
  const retStart = s.lastIndexOf("return NextResponse.json(", errIdx);
  if (retStart > probeIdx && !s.slice(retStart - 350, retStart).includes("releaseClaimBeforePreHandoffReturn")) {
    s =
      s.slice(0, retStart) +
      `if (m22_claim_token && m22_claim_key) {
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
          ` +
      s.slice(retStart);
  }
  console.log("step4 supersede patched");
}

// ========== 5) catch block cleanup ==========
const catchMarker = 'console.error("[final-delivery]", e);';
const catchIdx = s.lastIndexOf(catchMarker);
must(catchIdx >= 0, "catch log missing");
if (!s.slice(catchIdx - 500, catchIdx).includes("releaseClaimBeforePreHandoffReturn")) {
  const cleanup = `// M2.2-R3: if we acquired a claim but never handed off to a running job, CAS-release.
    try {
      if (
        typeof m22_claim_token === "string" &&
        m22_claim_token &&
        typeof m22_claim_key === "string" &&
        m22_claim_key
      ) {
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
    `;
  s = s.slice(0, catchIdx) + cleanup + s.slice(catchIdx);
}
console.log("step5 catch patched");

// Note: m22_claim_token/key are declared with let inside try of POST — catch may not see them if declared inside the outer try.
// Check scope!
fs.writeFileSync(path, s, "utf8");
console.log("wrote route.ts", s.length);
