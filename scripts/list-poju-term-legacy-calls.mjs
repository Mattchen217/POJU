/**
 * Quantify remaining pojuTermByTraditional call sites (Phase 1 migration inventory).
 *
 *   node scripts/list-poju-term-legacy-calls.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOTS = ["lib", "app", "components", "scripts"];
const RE = /pojuTermByTraditional\s*\(/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "legacy") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

const rows = [];
for (const root of ROOTS) {
  for (const file of walk(path.join(ROOT, root))) {
    const text = fs.readFileSync(file, "utf8");
    const matches = [...text.matchAll(RE)];
    if (!matches.length) continue;
    // Heuristic: calls with a second arg likely pass namespace.
    const withNs = [...text.matchAll(/pojuTermByTraditional\s*\(\s*[^,]+,\s*[^)]+\)/g)].length;
    const total = matches.length;
    rows.push({
      file: path.relative(ROOT, file).replace(/\\/g, "/"),
      total,
      approxWithNs: withNs,
      approxWithoutNs: Math.max(0, total - withNs),
    });
  }
}

rows.sort((a, b) => b.approxWithoutNs - a.approxWithoutNs || b.total - a.total);
const sumTotal = rows.reduce((s, r) => s + r.total, 0);
const sumNoNs = rows.reduce((s, r) => s + r.approxWithoutNs, 0);

console.log("\n========== pojuTermByTraditional migration inventory ==========\n");
console.log(`files: ${rows.length}  call-sites≈${sumTotal}  approx-without-ns≈${sumNoNs}\n`);
for (const r of rows) {
  console.log(
    `${r.approxWithoutNs}\t${r.total}\t${r.file}${r.approxWithoutNs ? "  ← migrate" : ""}`,
  );
}
console.log(
  "\nPrefer resolvePojuTerm(input, { namespace }). Do not use findPojuTerms for rendering.\n",
);
