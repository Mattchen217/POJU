const fs=require("fs");
const s=fs.readFileSync("lib/poju/session-mutation.ts","utf8");
const i=s.indexOf("stagedPayload");
console.log(s.slice(i-200, i+1200));
console.log("----");
const j=s.indexOf("testStagedPreBinding stage1");
console.log(s.slice(j-100, j+900));
