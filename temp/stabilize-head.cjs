const fs = require("fs");
const p = "docs/phase3/PHASE3-FINAL-ACCEPTANCE.md";
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  /## 1\. Final HEAD SHA \(local\)[\s\S]*?Ahead of[\s\S]*?\n\n## 2\./,
  `## 1. Final HEAD SHA (local)

Tip of \`feat/decision-context-phase1\`: **\`git rev-parse HEAD\`** at push time (docs-only commits may follow suite evidence).

**Suite evidence runtime tip:** \`d3681bb91b808305b53cdd21cdf1991e125601c9\` (restore fail-closed).  
All commits after that through branch tip are **docs-only** acceptance packaging (no runtime/test source changes).

Ahead of \`origin/feat/decision-context-phase1\`: **13** commits (unpushed) as of packaging.

## 2.`,
);
fs.writeFileSync(p, s);

const s5 = "docs/phase3/PHASE3-S5-WRITEUP.md";
let w = fs.readFileSync(s5, "utf8");
w = w.replace(
  /\*\*Acceptance HEAD \(local\):\*\* `[0-9a-f]+`/,
  "**Acceptance HEAD (local):** `d3681bb91b808305b53cdd21cdf1991e125601c9` (suite tip) + docs-only commits through branch tip",
);
fs.writeFileSync(s5, w);

const idx = "docs/phase3/PHASE3-S5-P3-TEST-INDEX.md";
let i = fs.readFileSync(idx, "utf8");
i = i.replace(
  /\*\*Acceptance HEAD \(local rem package\):\*\* `[0-9a-f]+`/,
  "**Acceptance HEAD (local rem package):** suite tip `d3681bb91b808305b53cdd21cdf1991e125601c9` (+ docs-only tip)",
);
fs.writeFileSync(idx, i);
console.log("stabilized HEAD wording");
