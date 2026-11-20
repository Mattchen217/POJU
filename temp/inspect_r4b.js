const fs = require("fs");
const s = fs.readFileSync("lib/poju/final-delivery-stage-runner.ts", "utf8");
const lines = s.split(/\r?\n/);
for (let n = 0; n < lines.length; n++) {
  if (lines[n].includes("scheduleDeliveryStageContinueIfAuthorized")) {
    console.log((n+1) + ":" + lines[n].trim());
    for (let k = 1; k <= 8; k++) {
      if (lines[n+k]) console.log("  +" + k + ":" + lines[n+k].trim());
    }
    console.log("---");
  }
}
