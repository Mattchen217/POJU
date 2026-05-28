/**
 * Run Tool_Linking_Final automated tests (Steps 1–7).
 * Run: pnpm exec tsx scripts/run-tool-linking-all.ts
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

const scripts = [
  "test-tool-linking-step1.ts",
  "test-tool-linking-step2.ts",
  "test-tool-linking-step3.ts",
  "test-tool-linking-step4.ts",
  "test-tool-linking-step5.ts",
  "test-tool-linking-step6.ts",
  "test-tool-linking-step7-e2e.ts",
];

const root = path.join(process.cwd(), "scripts");

let failed = 0;
for (const file of scripts) {
  const label = file.replace(/^test-/, "").replace(/\.ts$/, "");
  process.stdout.write(`\n▶ ${label}\n`);
  const r = spawnSync("pnpm", ["exec", "tsx", path.join(root, file)], {
    cwd: path.resolve(root, ".."),
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) failed += 1;
}

if (failed > 0) {
  console.error(`\nrun-tool-linking-all: ${failed} suite(s) failed`);
  process.exit(1);
}

console.log("\nrun-tool-linking-all: all suites passed");
