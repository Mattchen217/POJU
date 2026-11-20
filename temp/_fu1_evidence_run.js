const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const pnpm = "C:\\Users\\13306\\AppData\\Roaming\\npm\\pnpm.cmd";
const evDir = path.join("docs", "evidence", "m9-r1-fu1-redis-lua-integrity-parity-2026-11-18");
const implSha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", shell: true }).stdout.trim();
const parentSha = spawnSync("git", ["rev-parse", "HEAD^"], { encoding: "utf8", shell: true }).stdout.trim();
fs.mkdirSync(evDir, { recursive: true });

function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

const swPath = "public/sw.js";
const swBackup = "temp/_fu1_sw_js_backup.bin";
const preSha = sha256File(swPath);
const preBytes = fs.statSync(swPath).size;

const commands = [
  { id: "01", command: "pnpm test:m9-server-authoritative-session", args: ["test:m9-server-authoritative-session"], log: "01-test-m9-server-authoritative-session.log" },
  { id: "02", command: "pnpm test:m9-r1-session-authority-remediation", args: ["test:m9-r1-session-authority-remediation"], log: "02-test-m9-r1-session-authority-remediation.log" },
  { id: "03", command: "pnpm test:m9-r1-fu1-redis-lua-integrity-parity", args: ["test:m9-r1-fu1-redis-lua-integrity-parity"], log: "03-test-m9-r1-fu1-redis-lua-integrity-parity.log" },
  { id: "04", command: "pnpm test:m8-r1-internal-turn-trust-boundary", args: ["test:m8-r1-internal-turn-trust-boundary"], log: "04-test-m8-r1-internal-turn-trust-boundary.log" },
  { id: "05", command: "pnpm test:m6-di2-full-lifecycle", args: ["test:m6-di2-full-lifecycle"], log: "05-test-m6-di2-full-lifecycle.log" },
  { id: "06", command: "pnpm test:m5-r1-authorization", args: ["test:m5-r1-authorization"], log: "06-test-m5-r1-authorization.log" },
  { id: "07", command: "pnpm test:m1-production-adaptive-question-loop", args: ["test:m1-production-adaptive-question-loop"], log: "07-test-m1-production-adaptive-question-loop.log" },
  { id: "08", command: "pnpm test:m2-1-readiness-confirm-freeze", args: ["test:m2-1-readiness-confirm-freeze"], log: "08-test-m2-1-readiness-confirm-freeze.log" },
  { id: "09", command: "pnpm test:m2-2-freeze-report-binding", args: ["test:m2-2-freeze-report-binding"], log: "09-test-m2-2-freeze-report-binding.log" },
  { id: "10", command: "pnpm test:m3-decision-report", args: ["test:m3-decision-report"], log: "10-test-m3-decision-report.log" },
  { id: "11", command: "pnpm test:m4-decision-authority", args: ["test:m4-decision-authority"], log: "11-test-m4-decision-authority.log" },
  { id: "12", command: "pnpm test:m4-1-freeze-recovery", args: ["test:m4-1-freeze-recovery"], log: "12-test-m4-1-freeze-recovery.log" },
  { id: "13", command: "pnpm test:m5-di2-main-path", args: ["test:m5-di2-main-path"], log: "13-test-m5-di2-main-path.log" },
  { id: "14", command: "pnpm test:m8-di2-non-model-closure", args: ["test:m8-di2-non-model-closure"], log: "14-test-m8-di2-non-model-closure.log" },
  { id: "15", command: "pnpm exec tsc --noEmit --pretty false", args: ["exec", "tsc", "--noEmit", "--pretty", "false"], log: "15-tsc-noemit.log" },
  { id: "16", command: "pnpm build", args: ["build"], log: "16-pnpm-build.log" },
];

function countPass(text) {
  const matches = text.match(/^PASS .+$/gm);
  return matches ? matches.length : 0;
}

const results = [];
let failed = 0;
for (const cmd of commands) {
  console.log("===== START " + cmd.command + " =====");
  const started = Date.now();
  const r = spawnSync(pnpm, cmd.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const elapsed = (Date.now() - started) / 1000;
  const code = r.status == null ? 1 : r.status;
  const raw = `${r.stdout || ""}${r.stderr || ""}`;
  const logPath = path.join(evDir, cmd.log);
  fs.writeFileSync(logPath, raw, { encoding: "utf8" });
  const pass = countPass(raw);
  const entry = {
    command: cmd.command,
    log: cmd.log,
    exit_code: code,
    elapsed_s: Math.round(elapsed * 100) / 100,
    log_bytes: Buffer.byteLength(raw),
    implementation_sha: implSha,
    result: pass ? `${pass} PASS lines` : (raw.trim() ? "completed" : "empty stdout/stderr"),
  };
  results.push(entry);
  console.log("===== END " + cmd.command + " exit=" + code + " s=" + entry.elapsed_s + " =====");
  if (code !== 0) failed += 1;
}

let postSha = sha256File(swPath);
let postBytes = fs.statSync(swPath).size;
let restored = false;
if (postSha !== preSha) {
  fs.copyFileSync(swBackup, swPath);
  const restoredSha = sha256File(swPath);
  if (restoredSha !== preSha) {
    throw new Error("failed to restore public/sw.js to pre-build bytes");
  }
  restored = true;
  console.log("Restored public/sw.js to pre-build bytes " + preSha);
} else {
  console.log("public/sw.js unchanged by build");
}

fs.writeFileSync(
  path.join(evDir, "_run_meta.json"),
  JSON.stringify({
    implSha,
    parentSha,
    preSha,
    preBytes,
    postSha,
    postBytes,
    restored,
    failed,
    results,
  }, null, 2),
  "utf8",
);
console.log("EVIDENCE_FAILED=" + failed);
process.exit(failed === 0 ? 0 : 1);