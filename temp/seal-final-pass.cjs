const fs = require("fs");

const finalPath = "docs/phase3/PHASE3-FINAL-ACCEPTANCE.md";
let s = fs.readFileSync(finalPath, "utf8");

const header = `# PHASE3-FINAL-ACCEPTANCE

> Phase 3 Final Acceptance package (Max §10.2).  
> Branch: \`feat/decision-context-phase1\` · PR #32  
> Local evidence date: 2026-11-03 (America/Chicago)  
> **Verdict: Phase 3 Engineering Final = PASS**  
> **Acceptance: Max independent acceptance (not self-report)**  
> HEAD: \`8addcc444f155c3b8d8bb4c1ff65386148aeb9b8\`

Product Stage 4 / P5 / P6 / P8 remains **held** pending explicit user authorization. No merge / no production deploy.

`;

s = s.replace(/^#[\s\S]*?(?=## 1\. Final HEAD SHA)/, header);

s = s.replace(
  /## 1\. Final HEAD SHA[\s\S]*?(?=## 2\. Full diff)/,
  `## 1. Final HEAD SHA

**\`8addcc444f155c3b8d8bb4c1ff65386148aeb9b8\`** on \`feat/decision-context-phase1\` (PR #32).

Suite evidence runtime tip (last rem commit before docs packaging): \`d3681bb91b808305b53cdd21cdf1991e125601c9\` (restore fail-closed).  
Commits after that through Final PASS tip include rem docs packaging + this seal (docs-only for the seal commit).

Pushed tip verified by Max independent acceptance + Actions success on the same SHA.

`
);

s = s.replace(
  /## 8\. GitHub Actions[\s\S]*?(?=## 9\. C1)/,
  `## 8. GitHub Actions

Same SHA \`8addcc444f155c3b8d8bb4c1ff65386148aeb9b8\`:

- Push: https://github.com/Mattchen217/POJU/actions/runs/41663817547 (success)
- PR: https://github.com/Mattchen217/POJU/actions/runs/41663828595 (success)

Workflow: \`.github/workflows/phase3-decision-context.yml\`.

`
);

s = s.replace(
  /5\. This package is \*\*READY_FOR_PASS_PENDING_CI\*\*, not Final PASS\./,
  "5. Product Stage 4 / P5 / P6 / P8 still **held** pending user authorization; no merge / no production deploy."
);

s = s.replace(
  /## Verdict[\s\S]*$/,
  `## Verdict

**Phase 3 Engineering Final = PASS**

- Independent acceptor: **Max** (not self-report)
- HEAD: \`8addcc444f155c3b8d8bb4c1ff65386148aeb9b8\`
- Core26 PASS; L1 35 / L2 21 / L3 23 / Job 10; typegen+tsc 0
- Actions success on same SHA: 41663817547 (push), 41663828595 (PR)
- Known limitations in §10 remain documented and do **not** constitute FAIL

**Product Stage 4 still held** pending user authorization. No merge / no production deploy.
`
);

fs.writeFileSync(finalPath, s, "utf8");
console.log("FINAL ok", fs.statSync(finalPath).size);

const s5Path = "docs/phase3/PHASE3-S5-WRITEUP.md";
let w = fs.readFileSync(s5Path, "utf8");

w = w.replace(
  /\*\*Acceptance HEAD \(local\):\*\*[^\n]*/,
  "**Acceptance HEAD:** `8addcc444f155c3b8d8bb4c1ff65386148aeb9b8` (Phase 3 Engineering Final PASS; Max independent acceptance)"
);

w = w.replace(
  /\*\*Max prior:\*\*[^\n]*/,
  "**Max prior:** S5 PASS_WITH_GAPS → remediations → Final Acceptance → **Max independent Final PASS**"
);

w = w.replace(
  /## CI[\s\S]*?(?=## Known limits)/,
  `## CI

Workflow: \`.github/workflows/phase3-decision-context.yml\`.  
**Remote Actions (same SHA \`8addcc444f155c3b8d8bb4c1ff65386148aeb9b8\`):**

- Push success: https://github.com/Mattchen217/POJU/actions/runs/41663817547
- PR success: https://github.com/Mattchen217/POJU/actions/runs/41663828595

`
);

w = w.replace(
  /## Ready[\s\S]*$/,
  `## Ready / Verdict

**Phase 3 Engineering Final = PASS** (Max independent acceptance, not self-report).  
HEAD \`8addcc444f155c3b8d8bb4c1ff65386148aeb9b8\`. Known limits above remain documented.  

**Product Stage 4 / P5 / P6 / P8 still held** pending user authorization. No merge / no production deploy.
`
);

fs.writeFileSync(s5Path, w, "utf8");
console.log("S5 ok", fs.statSync(s5Path).size);
