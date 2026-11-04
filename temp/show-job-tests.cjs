const fs=require("fs");
const s=fs.readFileSync("scripts/test-decision-context-phase3-e2e.ts","utf8");
for (const id of ["P3-93","P3-94","P3-95","P3-96","P3-97"]) {
  const i=s.indexOf(`await p3("${id}"`);
  console.log("\n==== "+id+" ====");
  console.log(i<0?"MISSING":s.slice(i, i+700));
}
