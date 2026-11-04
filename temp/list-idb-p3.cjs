const fs=require("fs");
const s=fs.readFileSync("scripts/test-decision-context-phase3-idb.ts","utf8");
const re=/await p3\("P3-\d+"/g; let m; while((m=re.exec(s))) console.log(m[0], s.slice(m.index, m.index+80).split("\n")[0]);
