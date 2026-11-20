const fs = require("fs");
const path = "D:/POJU/pojulife/app/api/poju/final-delivery/route.ts";
let s = fs.readFileSync(path, "utf8");

if (!s.includes("let m22_handed_off")) {
  s = s.replace(
    "let m22_created_job_id: string | null = null;",
    "let m22_created_job_id: string | null = null;\n  let m22_handed_off = false;"
  );
}

// After scheduleFinalDeliveryJob call, set handed_off
const sched = "await scheduleFinalDeliveryJob(job.job_id, sessionIdRaw);";
const sidx = s.indexOf(sched);
if (sidx < 0) {
  console.error("schedule call missing");
  process.exit(1);
}
if (!s.slice(sidx, sidx + 120).includes("m22_handed_off")) {
  s = s.replace(sched, sched + "\n    m22_handed_off = true;");
  console.log("set handed_off after schedule");
}

// Wrap catch cleanup to only run when !m22_handed_off
const marker = "M2.2-R3: if we acquired a claim but never handed off to a running job, CAS-release.";
const midx = s.indexOf(marker);
if (midx < 0) {
  console.error("marker missing");
  process.exit(1);
}
// Replace the whole try cleanup block with guarded version
const tryStart = s.indexOf("try {", midx);
const ignoreEnd = s.indexOf("/* ignore cleanup errors */", tryStart);
const blockEnd = s.indexOf("}", s.indexOf("} catch {", ignoreEnd)) + 1;
// Actually find the catch { /* ignore */ } closing
const catchIgnore = s.indexOf("} catch {", tryStart);
const afterCatchIgnore = s.indexOf("}", s.indexOf("/* ignore cleanup errors */", catchIgnore)) + 1;
// from tryStart to afterCatchIgnore
const oldBlock = s.slice(tryStart, afterCatchIgnore);
console.log("old cleanup block len", oldBlock.length);

const newBlock = `if (!m22_handed_off) {
      try {
        if (m22_created_job_id) {
          await failXhighJob(
            m22_created_job_id,
            e instanceof Error ? e.message : "final-delivery failed before handoff",
            { retryable: true, failure_reason: "interrupted" },
          ).catch(() => undefined);
        }
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
    }`;

// Find from "if (m22_created_job_id)" or "try {" after marker through ignore catch end
const afterMarkerNL = s.indexOf("\n", midx) + 1;
// Find the end of the ignore catch - look for pattern
const endPat = "/* ignore cleanup errors */";
const endPatIdx = s.indexOf(endPat, afterMarkerNL);
const endBrace = s.indexOf("}", endPatIdx);
// Include closing brace of catch and possibly outer - the structure is try { ... } catch { /* ignore */ }
// After endBrace of catch body, there's }
const catchClose = s.indexOf("}", endBrace + 1); // closes catch
// Actually: } catch {\n      /* ignore */\n    }
// endBrace is the first } after comment which closes catch block
s = s.slice(0, afterMarkerNL) + newBlock + "\n    " + s.slice(endBrace + 1);
fs.writeFileSync(path, s, "utf8");
console.log("rewrote catch cleanup with handed_off guard");
