const fs = require("fs");
const p = "docs/phase3/PHASE3-S5-WRITEUP.md";
let s = fs.readFileSync(p, "utf8");
const i = s.indexOf("P3-70 uses apply-throw");
if (i < 0) {
  console.log("gap line not found; skipping writeup");
  process.exit(0);
}
const lineStart = s.lastIndexOf("\n", i) + 1;
const lineEnd = s.indexOf("\n", i);
const oldLine = s.slice(lineStart, lineEnd);
const newLine =
  "- P3-70 remediated: real encrypt inject on casWritePOJUSession path (cipher throw before Dexie commit)";
s = s.slice(0, lineStart) + newLine + s.slice(lineEnd);
fs.writeFileSync(p, s);
console.log("replaced:", oldLine);
console.log("with:", newLine);
