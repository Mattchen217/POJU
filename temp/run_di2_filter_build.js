
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const root = "D:\\POJU\\pojulife";
const logPath = path.join(root, "temp", "di2-already-understood-filter-logs", "build.log");
const metaPath = path.join(root, "temp", "di2-already-understood-filter-logs", "build-meta.txt");
const swPath = path.join(root, "public", "sw.js");
const backup = path.join(root, "temp", "_fu1_sw_js_backup.bin");
const expected = "38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980";
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const before = sha(swPath);
const started = Date.now();
const result = spawnSync("cmd.exe", ["/c", "C:\\Users\\13306\\AppData\\Roaming\\npm\\pnpm.cmd build"], {
  cwd: root,
  encoding: "utf8",
  timeout: 700000,
  maxBuffer: 20 * 1024 * 1024,
  windowsHide: true,
});
const elapsed = (Date.now() - started) / 1000;
const out = `${result.stdout || ""}${result.stderr || ""}`;
fs.writeFileSync(logPath, out, "utf8");
const after = sha(swPath);
let restored = after;
if (after !== expected) {
  const bak = sha(backup);
  if (bak !== expected) throw new Error("backup hash mismatch " + bak);
  fs.copyFileSync(backup, swPath);
  restored = sha(swPath);
}
const meta = [
  `exit=${result.status}`,
  `elapsed=${elapsed.toFixed(1)}`,
  `before=${before}`,
  `after_build=${after}`,
  `restored=${restored}`,
  `signal=${result.signal || ""}`,
  `error=${result.error ? result.error.message : ""}`,
].join("\n") + "\n";
fs.writeFileSync(metaPath, meta, "utf8");
process.stdout.write(meta);
process.exit(result.status === 0 ? 0 : 1);
