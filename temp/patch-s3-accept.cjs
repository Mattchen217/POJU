const fs = require("fs");
const p = "docs/phase3/PHASE3-S3-WRITEUP.md";
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  "- S2 acceptance carry-forwards (flag only): C1 extend two-phase, C5 vault rename plaintext, J4 shared xhigh store",
  "- S2 acceptance carry-forwards (historical at S3): C1/C5/J4 — later **CLOSED** in rem package (see PHASE3-FINAL-ACCEPTANCE.md)",
);
s = s.replace(
  `- C1 extend two-phase
- C5 vault rename plaintext
- J4 shared xhigh store`,
  `- C1 extend two-phase — rem CLOSED (FINAL-ACCEPTANCE)
- C5 vault rename plaintext — rem CLOSED
- J4 shared xhigh store — rem CLOSED`,
);
fs.writeFileSync(p, s);
console.log("S3 updated");
