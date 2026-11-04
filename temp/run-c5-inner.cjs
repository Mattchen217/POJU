process.env.PHASE3_ONLY_IDS = "P3-139,P3-140,P3-141,P3-142,P3-143";
const fs = require("fs");
const { spawn } = require("child_process");
const log = "temp/c5-inner.log";
fs.writeFileSync(log, "starting\n");
const child = spawn(
  process.execPath,
  ["./node_modules/tsx/dist/cli.mjs", "scripts/test-decision-context-phase3-idb.ts"],
  { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] },
);
child.stdout.on("data", (d) => {
  fs.appendFileSync(log, "OUT:" + d.toString());
});
child.stderr.on("data", (d) => {
  fs.appendFileSync(log, "ERR:" + d.toString());
});
child.on("error", (e) => fs.appendFileSync(log, "SPAWNERR:" + e.stack));
child.on("close", (code) => {
  fs.appendFileSync(log, "\nCLOSE:" + code + "\n");
  console.log(fs.readFileSync(log, "utf8").slice(-3000));
});
