const fs = require("fs");
const s = fs.readFileSync("lib/poju/dyad-compat.ts", "utf8");
const checks = [
  "shouldAnnotateUnderstandingWithSkipPath",
  "dyadSkipPathUnderstandingNote",
  "dyadGateChipsLocked",
  "path=solo · partner_bazi=absent",
  "do not re-ask birth details",
];
for (const c of checks) console.log(c, s.includes(c));
// show helper region
const i = s.indexOf("shouldAnnotateUnderstandingWithSkipPath");
console.log("---helpers snippet---");
console.log(s.slice(i - 80, i + 1200));
console.log("---continue cue skip---");
const j = s.indexOf("User skipped partner chart");
console.log(s.slice(j, j + 280));
// ensure not before deliveryLocaleBucket import usage is fine
console.log("import deliveryLocaleBucket", s.includes("deliveryLocaleBucket"));
console.log("count shouldAnnotate", (s.match(/shouldAnnotateUnderstandingWithSkipPath/g)||[]).length);
