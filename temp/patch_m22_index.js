const fs = require("fs");
const path = "lib/poju/decision-intake/index.ts";
let s = fs.readFileSync(path, "utf8");
if (s.includes("freeze-bound-report")) {
  console.log("export already");
  process.exit(0);
}
s =
  s.trimEnd() +
  `
export {
  M22_REPORT_SCHEMA_VERSION,
  M22_SNAPSHOT_SCHEMA_VERSION,
  freezeIdFromBinding,
  buildReportIdempotencyKey,
  loadAuthoritativeFreeze,
  verifyFrozenSnapshot,
  createFrozenReportSnapshot,
  reportBindingFromSnapshot,
  defaultGeneratePage,
  assertCompleteEightPageReport,
  generateEightPageReport,
  createOrGetReportJob,
  requestFreezeBoundEightPageReport,
  retryFreezeBoundEightPageReport,
  getCompletedFreezeBoundReport,
  __resetFreezeBoundReportInFlightForTests,
  FreezeBoundReportError,
} from "./freeze-bound-report";
export type {
  FreezeBoundReportJobStatus,
  ReportBinding,
  FrozenReportSnapshot,
  FreezeBoundReportPage,
  FreezeBoundReportJob,
  EightPageReport,
  FreezeBoundReportDeps,
  FreezeBoundReportResult,
} from "./freeze-bound-report";
`;
fs.writeFileSync(path, s);
console.log("index patched");
