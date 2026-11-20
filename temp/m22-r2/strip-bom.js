const fs = require("fs");
const files = [
  "lib/kv/memory-kv.ts",
  "lib/poju/decision-intake/freeze-report-claim.ts",
  "lib/poju/decision-intake/freeze-bound-report.ts",
  "lib/poju/decision-intake/freeze-bound-report-server.ts",
  "lib/poju/xhigh-job-types.ts",
  "lib/poju/decision-intake/index.ts",
  "app/api/poju/final-delivery/route.ts",
  "lib/poju/final-delivery-stage-runner.ts",
  "scripts/test-m2-2-freeze-report-binding.ts",
];
for (const f of files) {
  let buf = fs.readFileSync(f);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    fs.writeFileSync(f, buf.slice(3));
    console.log("stripped BOM", f);
  } else {
    console.log("ok", f);
  }
}
