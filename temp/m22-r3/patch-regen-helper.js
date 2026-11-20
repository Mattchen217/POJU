const fs = require("fs");

// Add tryReleaseClaimForRegenerate to freeze-bound-report.ts (client-safe)
const path = "D:/POJU/pojulife/lib/poju/decision-intake/freeze-bound-report.ts";
let s = fs.readFileSync(path, "utf8");
if (!s.includes("tryReleaseClaimForRegenerate")) {
  const anchor = "export async function releaseClaimBeforePreHandoffReturn";
  const idx = s.indexOf(anchor);
  if (idx < 0) {
    console.error("anchor missing");
    process.exit(1);
  }
  const helper = `
/**
 * M2.2-R3 Regenerate claim release: only the original owner's token may CAS-delete.
 * Never force-delete another execution context's claim.
 * If ownership cannot be proven while a claim is held → fail closed.
 */
export type RegenerateClaimReleaseResult =
  | { ok: true; released: boolean }
  | { ok: false; code: "CLAIM_OWNED_BY_OTHER"; error: string };

export async function tryReleaseClaimForRegenerate(input: {
  claimOps?: FreezeReportClaimOps;
  claimKey: string;
  ownerToken: string | null | undefined;
}): Promise<RegenerateClaimReleaseResult> {
  const claimOps = input.claimOps ?? defaultProcessLocalClaimOps;
  const held = claimOps.load ? await claimOps.load(input.claimKey) : null;
  if (!held) {
    return { ok: true, released: false };
  }
  if (!input.ownerToken) {
    return {
      ok: false,
      code: "CLAIM_OWNED_BY_OTHER",
      error:
        "Regenerate cannot prove claim ownership; fail closed until lease expiry",
    };
  }
  const released = await claimOps.release(input.claimKey, input.ownerToken);
  if (!released) {
    return {
      ok: false,
      code: "CLAIM_OWNED_BY_OTHER",
      error:
        "Regenerate token does not own the active claim; fail closed (will not steal)",
    };
  }
  return { ok: true, released: true };
}

`;
  s = s.slice(0, idx) + helper + s.slice(idx);
  fs.writeFileSync(path, s, "utf8");
  console.log("added tryReleaseClaimForRegenerate to freeze-bound-report");
} else {
  console.log("already present in freeze-bound-report");
}

// Update route to import tryReleaseClaimForRegenerate from freeze-bound-report
const route = "D:/POJU/pojulife/app/api/poju/final-delivery/route.ts";
let r = fs.readFileSync(route, "utf8");
if (r.includes("tryReleaseClaimForRegenerate")) {
  // Change import site
  r = r.replace(
    `const {
              freezeReportClaimKey,
              defaultFreezeReportClaimOps,
              tryReleaseClaimForRegenerate,
            } = await import("@/lib/poju/decision-intake/freeze-report-claim");
            const { M22_REPORT_SCHEMA_VERSION } = await import(
              "@/lib/poju/decision-intake/freeze-bound-report"
            );`,
    `const {
              freezeReportClaimKey,
              defaultFreezeReportClaimOps,
            } = await import("@/lib/poju/decision-intake/freeze-report-claim");
            const {
              M22_REPORT_SCHEMA_VERSION,
              tryReleaseClaimForRegenerate,
            } = await import("@/lib/poju/decision-intake/freeze-bound-report");`
  );
  fs.writeFileSync(route, r, "utf8");
  console.log("route imports regenerate helper from freeze-bound-report");
}
