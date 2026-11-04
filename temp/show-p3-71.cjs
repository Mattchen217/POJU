const fs = require("fs");
const s = fs.readFileSync("scripts/test-decision-context-phase3-idb.ts", "utf8");
const a = s.indexOf('await p3("P3-71"');
const b = s.indexOf('await p3("P3-91"');
console.log(s.slice(a, b));
