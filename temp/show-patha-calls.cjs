const fs=require("fs");
const s=fs.readFileSync("scripts/test-decision-context-phase3-idb.ts","utf8");
const i=s.indexOf("commitGenerationGuarded");
console.log("first usages:");
let idx=0, n=0;
while(n<3) {
  const j=s.indexOf("commitGenerationGuarded(", idx);
  if(j<0) break;
  console.log("---\n"+s.slice(j, j+700));
  idx=j+1; n++;
}
