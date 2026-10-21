/**
 * Build production assets for the iframe landing (public/v2-landing.html):
 * 1) Tailwind CSS (replaces cdn.tailwindcss.com)
 * 2) Full @splinetool/runtime build/ tree (v2 is multi-chunk + wasm)
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("[v2-landing] building Tailwind CSS…");
run("pnpm", [
  "exec",
  "tailwindcss",
  "-c",
  "tailwind.v2-landing.config.cjs",
  "-i",
  "./styles/v2-landing.css",
  "-o",
  "./public/v2/v2-landing.css",
  "--minify",
]);

const runtimeSrc = join(root, "node_modules/@splinetool/runtime/build");
const runtimeDest = join(root, "public/vendor/splinetool-runtime");
if (!existsSync(join(runtimeSrc, "runtime.js"))) {
  console.error("[v2-landing] missing", join(runtimeSrc, "runtime.js"));
  process.exit(1);
}
rmSync(runtimeDest, { recursive: true, force: true });
mkdirSync(dirname(runtimeDest), { recursive: true });
cpSync(runtimeSrc, runtimeDest, { recursive: true });
console.log("[v2-landing] wrote public/v2/v2-landing.css + public/vendor/splinetool-runtime/");
