const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = "D:\\POJU\\pojulife";
const ev = path.join(root, "docs/evidence/di2-main-path-integration-audit-2026-11-19");
const logDir = path.join(ev, "logs");
fs.mkdirSync(logDir, { recursive: true });
const pnpm = "C:\\Users\\13306\\AppData\\Roaming\\npm\\pnpm.cmd";

const commands = [
  { id: "test-di2-understanding-composer-flow", args: ["test:di2-understanding-composer-flow"] },
  { id: "test-di2-feature-landing-main-path", args: ["test:di2-feature-landing-main-path"] },
  { id: "test-m1-r-fresh-session-main-loop", args: ["test:m1-r-fresh-session-main-loop"] },
  { id: "test-m1-production-adaptive-question-loop", args: ["test:m1-production-adaptive-question-loop"] },
  { id: "test-m2-1-readiness-confirm-freeze", args: ["test:m2-1-readiness-confirm-freeze"] },
  { id: "test-m2-2-freeze-report-binding", args: ["test:m2-2-freeze-report-binding"] },
  { id: "test-m2-3-decision-blueprint", args: ["test:m2-3-decision-blueprint"] },
  { id: "test-m3-decision-report", args: ["test:m3-decision-report"] },
  { id: "test-m4-decision-authority", args: ["test:m4-decision-authority"] },
  { id: "test-m4-1-freeze-recovery", args: ["test:m4-1-freeze-recovery"] },
  { id: "test-m5-di2-main-path", args: ["test:m5-di2-main-path"] },
  { id: "test-m6-di2-full-lifecycle", args: ["test:m6-di2-full-lifecycle"] },
  { id: "test-m8-di2-non-model-closure", args: ["test:m8-di2-non-model-closure"] },
  { id: "test-m8-r1-internal-turn-trust-boundary", args: ["test:m8-r1-internal-turn-trust-boundary"] },
  { id: "test-m9-server-authoritative-session", args: ["test:m9-server-authoritative-session"] },
  { id: "test-m9-r1-session-authority-remediation", args: ["test:m9-r1-session-authority-remediation"] },
  { id: "test-m5-r1-authorization", args: ["test:m5-r1-authorization"] },
  { id: "test-m2-4-r2-production-closure", args: ["test:m2-4-r2-production-closure"] },
  { id: "tsc-noEmit", args: ["exec", "tsc", "--noEmit", "--pretty", "false"] },
  { id: "pnpm-build", args: ["build"] },
];

function runOne(cmd) {
  return new Promise((resolve) => {
    const started = Date.now();
    const logPath = path.join(logDir, cmd.id + ".log");
    const header = "COMMAND: pnpm " + cmd.args.join(" ") + "\nSTARTED: " + new Date().toISOString() + "\n\n";
    fs.writeFileSync(logPath, header, "utf8");
    let child;
    try {
      child = spawn(pnpm, cmd.args, {
        cwd: root,
        env: process.env,
        windowsHide: true,
        shell: true,
      });
    } catch (err) {
      const msg = "SPAWN_THROW: " + err.message + "\n";
      fs.appendFileSync(logPath, msg, "utf8");
      resolve({
        id: cmd.id,
        args: cmd.args,
        exitCode: 1,
        spawnError: err.message,
        ms: Date.now() - started,
        logPath,
        compiledSuccessfully: false,
      });
      return;
    }
    const chunks = [];
    const onData = (buf) => {
      chunks.push(buf);
      fs.appendFileSync(logPath, buf);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (err) => {
      const msg = "SPAWN_ERROR: " + err.message + "\n";
      fs.appendFileSync(logPath, msg, "utf8");
      resolve({
        id: cmd.id,
        args: cmd.args,
        exitCode: 1,
        spawnError: err.message,
        ms: Date.now() - started,
        logPath,
        compiledSuccessfully: false,
      });
    });
    child.on("close", (code, signal) => {
      const exitCode = code == null ? 1 : code;
      const body = Buffer.concat(chunks).toString("utf8");
      const compiledSuccessfully = /Compiled successfully/.test(body);
      const footer =
        "\n\nEXIT_CODE=" +
        exitCode +
        "\nSIGNAL=" +
        String(signal) +
        "\nELAPSED_MS=" +
        (Date.now() - started) +
        "\nCOMPILED_SUCCESSFULLY=" +
        compiledSuccessfully +
        "\nFINISHED: " +
        new Date().toISOString() +
        "\n";
      fs.appendFileSync(logPath, footer, "utf8");
      resolve({
        id: cmd.id,
        args: cmd.args,
        exitCode,
        signal,
        ms: Date.now() - started,
        logPath,
        compiledSuccessfully,
      });
    });
  });
}

function writeCodes(results) {
  fs.writeFileSync(path.join(ev, "EXIT-CODES.json"), JSON.stringify(results, null, 2), "utf8");
  const md = [
    "# EXIT-CODES",
    "",
    "Generated: " + new Date().toISOString(),
    "",
    "| id | command | exit_code | elapsed_ms | compiled_successfully | log |",
    "| --- | --- | --- | --- | --- | --- |",
  ]
    .concat(
      results.map((x) => {
        const compiled = x.id === "pnpm-build" ? String(x.compiledSuccessfully) : "n/a";
        return (
          "| " +
          x.id +
          " | pnpm " +
          x.args.join(" ") +
          " | " +
          x.exitCode +
          " | " +
          x.ms +
          " | " +
          compiled +
          " | logs/" +
          x.id +
          ".log |"
        );
      }),
    )
    .join("\n") + "\n";
  fs.writeFileSync(path.join(ev, "EXIT-CODES.md"), md, "utf8");
}

(async () => {
  const results = [];
  for (const cmd of commands) {
    process.stdout.write("START " + cmd.id + "\n");
    const r = await runOne(cmd);
    results.push(r);
    process.stdout.write(
      "DONE " + cmd.id + " exit=" + r.exitCode + " ms=" + r.ms + " compiled=" + r.compiledSuccessfully + "\n",
    );
    writeCodes(results);
  }
  const fail = results.filter((r) => r.exitCode !== 0);
  fs.writeFileSync(
    path.join(ev, "RUN-COMPLETE.txt"),
    "complete " + new Date().toISOString() + " failed=" + fail.length + "\n",
    "utf8",
  );
  process.exit(0);
})();
