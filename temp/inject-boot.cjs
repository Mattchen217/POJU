const fs = require("fs");
const p = "scripts/test-decision-context-phase3-idb.ts";
let s = fs.readFileSync(p, "utf8");
const needle = "async function main() {";
const i = s.indexOf(needle);
if (i < 0) throw new Error("no main");
if (s.includes("C5_BOOT_PROBE")) {
  console.log("already injected");
  process.exit(0);
}
const inject =
  needle +
  '\n  const __fs = await import("node:fs");\n  __fs.writeFileSync("temp/c5-boot.txt", "booted " + Date.now());\n  console.log("C5_BOOT_PROBE");';
s = s.slice(0, i) + inject + s.slice(i + needle.length);
fs.writeFileSync(p, s);
console.log("injected");
