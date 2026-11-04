const fs = require("fs");
for (const p of [
  "docs/phase3/PHASE3-FINAL-ACCEPTANCE.md",
  "docs/phase3/PHASE3-S5-WRITEUP.md",
  "docs/phase3/PHASE3-S5-P3-TEST-INDEX.md",
]) {
  let s = fs.readFileSync(p, "utf8");
  s = s.split("d3681bb91b808305b53cdd21cdf1991e125601c9").join("93f0bc0754b25f8c35c28f37ca7aaf4e7ef0e9ed");
  s = s.replace(
    "Ahead of `origin/feat/decision-context-phase1`: **10** commits (unpushed).",
    "Ahead of `origin/feat/decision-context-phase1`: **12** commits (unpushed). Runtime tip for suites was `d3681bb9…`; tip includes docs-only acceptance commits.",
  );
  s = s.replace(
    "| d3681bb9 | phase3 rem: restore fail-closed on blob load |",
    "| d3681bb9 | phase3 rem: restore fail-closed on blob load |\n| ffec91ed | phase3 rem: final acceptance package |\n| 93f0bc07 | phase3 rem: note S3 writeup C1/C5/J4 closed |",
  );
  fs.writeFileSync(p, s);
}
console.log("HEAD refs updated to tip");
