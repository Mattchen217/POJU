const fs = require("fs");
let s = fs.readFileSync("scripts/test-dyad-skip-collect-understanding-e2e.ts", "utf8");
if (!s.includes("dyadGateChipsLocked")) {
  s = s.replace(
    "const gateRouteSrc = readFileSync(",
    "assert.ok(\n  chatUiSrc.includes(\"clearDyadGateUi\"),\n  \"ChatUI must use clearDyadGateUi after dyad resolve (#12)\",\n);\nassert.ok(\n  chatUiSrc.includes(\"dyadGateChipsLocked\"),\n  \"ChatUI must lock dyad chips after skip/collect (#12)\",\n);\n\nconst gateRouteSrc = readFileSync("
  );
}
if (s.includes("ChatUI skip must apply dyadSkipPatch then continueAfterDyadGate")) {
  s = s.replace(
    "ChatUI skip must apply dyadSkipPatch then continueAfterDyadGate",
    "ChatUI skip must clearDyadGateUi + dyadSkipPatch then continueAfterDyadGate"
  );
  s = s.replace(
    "/handleDyadSkip[\\s\\S]{0,500}?dyadSkipPatch()[\\s\\S]{0,400}?continueAfterDyadGate/",
    "/handleDyadSkip[\\s\\S]{0,500}?clearDyadGateUi[\\s\\S]{0,200}?dyadSkipPatch\\\\(\\\\)[\\s\\S]{0,400}?continueAfterDyadGate/"
  );
}
fs.writeFileSync("scripts/test-dyad-skip-collect-understanding-e2e.ts", s);
console.log("clear", s.includes("clearDyadGateUi"));
console.log("chips", s.includes("dyadGateChipsLocked"));