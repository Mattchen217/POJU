const fs = require("fs");
let s = fs.readFileSync("scripts/test-dyad-skip-collect-understanding-e2e.ts", "utf8");
const old = "/handleDyadSkip[\\s\\S]{0,500}?dyadSkipPatch\\(\\)[\\s\\S]{0,400}?continueAfterDyadGate/";
const neu = "/handleDyadSkip[\\s\\S]{0,500}?clearDyadGateUi[\\s\\S]{0,200}?dyadSkipPatch\\(\\)[\\s\\S]{0,400}?continueAfterDyadGate/";
if (s.includes(old)) {
  s = s.replace(old, neu);
  console.log("regex replaced");
} else {
  console.log("old regex not found");
  const m = s.match(/\/handleDyadSkip[^\n]+/);
  console.log(m && m[0]);
}
// also update collect assert to require clearDyadGateUi
const oldC = "/dyadCollectedPatch\\([\\s\\S]{0,500}?continueAfterDyadGate/";
const neuC = "/clearDyadGateUi[\\s\\S]{0,200}?dyadCollectedPatch\\([\\s\\S]{0,500}?continueAfterDyadGate/";
if (s.includes(oldC)) {
  s = s.replace(oldC, neuC);
  console.log("collect regex replaced");
} else {
  const m = s.match(/\/dyadCollectedPatch[^\n]+/);
  console.log("collect", m && m[0]);
}
fs.writeFileSync("scripts/test-dyad-skip-collect-understanding-e2e.ts", s);