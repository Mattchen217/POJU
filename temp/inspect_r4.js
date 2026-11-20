const fs = require("fs");
const s = fs.readFileSync("lib/poju/final-delivery-stage-runner.ts", "utf8");
console.log("missing binding", s.includes("m22_writeback_missing_binding_or_snapshot"));
console.log("finalizeFormal", s.includes("finalizeFormalDeliverySuccessForTests"));
console.log("isDeliveryExecutionRevoked(snap)", s.includes("isDeliveryExecutionRevoked(snap)"));
const idxs = [];
let i = 0;
while ((i = s.indexOf("scheduleDeliveryStageContinue", i)) >= 0) {
  idxs.push(i);
  i += 1;
}
console.log("occurrences", idxs.length);
for (const idx of idxs.slice(0, 15)) {
  console.log("---", JSON.stringify(s.slice(Math.max(0, idx - 30), idx + 80)).slice(0, 140));
}
