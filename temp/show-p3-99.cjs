const fs=require("fs");
const s=fs.readFileSync("scripts/test-decision-context-phase3-e2e.ts","utf8");
const a=s.indexOf('await p3("P3-99"');
const b=s.indexOf('await p3("P3-101"');
console.log(s.slice(a, b>0?b:a+2500));
