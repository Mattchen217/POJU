const { spawnSync } = require("child_process");
const pnpm = "C:\\Users\\13306\\AppData\\Roaming\\npm\\pnpm.cmd";
const cmds = [
  "test:m8-r1-internal-turn-trust-boundary",
  "test:m6-di2-full-lifecycle",
  "test:m5-r1-authorization",
  "test:m1-production-adaptive-question-loop",
  "test:m2-1-readiness-confirm-freeze",
  "test:m2-2-freeze-report-binding",
  "test:m3-decision-report",
  "test:m4-decision-authority",
  "test:m4-1-freeze-recovery",
  "test:m5-di2-main-path",
  "test:m8-di2-non-model-closure",
];
let failed = 0;
for (const name of cmds) {
  console.log("===== START " + name + " =====");
  const started = Date.now();
  const r = spawnSync(pnpm, [name], { cwd: process.cwd(), encoding: "utf8", shell: true, stdio: "inherit" });
  const code = r.status == null ? 1 : r.status;
  console.log("===== END " + name + " exit=" + code + " ms=" + (Date.now() - started) + " =====");
  if (code !== 0) failed += 1;
}
console.log("PREFLIGHT_FAILED=" + failed);
process.exit(failed === 0 ? 0 : 1);