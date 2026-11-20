const fs = require("fs");
const path = "app/api/poju/final-delivery/route.ts";
let s = fs.readFileSync(path, "utf8");

// Remove the dangerous force-release before lock (would wipe freshly acquired claim)
const badStart = s.indexOf("// M2.2-R2: regenerate must not be blocked by a stale generation claim.");
const lockIdx = s.indexOf('const locked = await acquireXhighSessionLock("final_delivery", sessionIdRaw);');
if (badStart >= 0 && lockIdx > badStart) {
  s = s.slice(0, badStart) + s.slice(lockIdx);
  console.log("removed misplaced regenerate force-release");
} else {
  console.log("no misplaced block (or already removed)", { badStart, lockIdx });
}

// Insert force-release at start of Freeze prepare path, before prepareFreezeBoundFinalDeliveryServer
const prepMarker = 'const { prepareFreezeBoundFinalDeliveryServer } = await import(\n        "@/lib/poju/decision-intake/freeze-bound-report-server"\n      );';
const prepMarkerCR = prepMarker.replace(/\n/g, "\r\n");
let prepIdx = s.indexOf(prepMarkerCR);
let usedCR = true;
if (prepIdx < 0) {
  prepIdx = s.indexOf(prepMarker);
  usedCR = false;
}
if (prepIdx < 0) {
  // try single-line import form from our replacement
  prepIdx = s.indexOf('prepareFreezeBoundFinalDeliveryServer');
  console.log("fallback prep idx", prepIdx);
}

if (s.includes("m22 claim force-release before prepare")) {
  console.log("before-prepare force-release already present");
} else {
  // Find a stable anchor: right before "const prepared = await prepareFreezeBoundFinalDeliveryServer"
  const preparedCall = s.indexOf("const prepared = await prepareFreezeBoundFinalDeliveryServer");
  if (preparedCall < 0) throw new Error("prepared call not found");
  const insert = `// M2.2-R2: on regenerate, drop prior generation claim before acquiring a new one.
        // Comment marker: m22 claim force-release before prepare
        if (regenerate) {
          try {
            const { freezeReportClaimKey, defaultFreezeReportClaimOps } = await import(
              "@/lib/poju/decision-intake/freeze-report-claim"
            );
            const { M22_REPORT_SCHEMA_VERSION } = await import(
              "@/lib/poju/decision-intake/freeze-bound-report"
            );
            const key = freezeReportClaimKey({
              sessionId: sessionIdRaw,
              freezeId: frozenSnap.freezeId,
              reportSchemaVersion: M22_REPORT_SCHEMA_VERSION,
            });
            await defaultFreezeReportClaimOps.forceRelease(key);
          } catch (e) {
            console.warn("[final-delivery] m22 claim force-release before prepare skipped", e);
          }
        }

        `;
  s = s.slice(0, preparedCall) + insert + s.slice(preparedCall);
  console.log("inserted before-prepare force-release");
}

fs.writeFileSync(path, s);
console.log("regen order fixed");
