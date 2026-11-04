const fs = require("fs");
const s = fs.readFileSync("scripts/test-decision-context-phase3-idb.ts", "utf8");
const a = s.indexOf('await p3("P3-91"');
const b = s.indexOf('await p3("', a + 10);
// find next p3 after 91 - may be end of file section
let next = s.indexOf("\n  await p3(", a + 1);
if (next < 0) next = s.indexOf("\n  summarize(", a);
console.log(s.slice(a, next > 0 ? next : a + 2500));
