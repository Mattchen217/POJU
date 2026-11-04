const fs = require("fs");
const p = "D:/POJU/pojulife/scripts/test-generation-s2.ts";
let t = fs.readFileSync(p, "utf8");
const old = 'control_plane: { current_phase: "test" },';
if (!t.includes(old)) {
  console.log("anchor missing or already patched");
} else {
  t = t.replace(old, "control_plane: undefined,");
  fs.writeFileSync(p, t);
  console.log("patched S2 persist guard CP fixture");
}
for (const f of [
  "scripts/test-decision-context.ts",
  "scripts/test-decision-context-phase2.ts",
  "scripts/test-decision-context-phase2-idb.ts",
  "scripts/test-decision-context-phase1.ts",
]) {
  const body = fs.readFileSync("D:/POJU/pojulife/" + f, "utf8");
  const hits = [...body.matchAll(/control_plane:\s*\{[^}]+\}/g)].map((m) => m[0]);
  console.log(f, JSON.stringify(hits));
}
