const fs = require("fs");
for (const f of [
  "docs/eastern-os/decision-intake-2.0/evidence/m2-2-freeze-report-binding/CONTRACT-FIX-R4.md",
  "lib/poju/final-delivery-execution-authority.ts",
]) {
  const buf = fs.readFileSync(f);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    fs.writeFileSync(f, buf.slice(3));
    console.log("stripped bom", f);
  }
}
