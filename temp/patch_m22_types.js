const fs = require("fs");
const path = "lib/poju/types.ts";
let s = fs.readFileSync(path, "utf8");
const needle =
  '  last_delivery_context_binding?: import("./decision-context").DecisionContextBinding | null;';
if (!s.includes(needle)) {
  console.error("needle missing");
  process.exit(1);
}
if (s.includes("freeze_bound_report_jobs")) {
  console.log("already present");
  process.exit(0);
}
const insert =
  needle +
  `
  /**
   * M2.2 — Freeze-bound eight-page report jobs (binding pinned before LLM).
   * One job per sessionId+freezeId+reportSchemaVersion; never retargeted by draft DC.
   */
  freeze_bound_report_jobs?: import("./decision-intake/freeze-bound-report").FreezeBoundReportJob[];`;
s = s.replace(needle, insert);
fs.writeFileSync(path, s);
console.log("types.ts patched");
