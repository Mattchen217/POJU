const fs = require("fs");
let s = fs.readFileSync("scripts/test-poju-block88-gate-summary-deterministic.ts", "utf8");
if (!s.includes('read("lib/poju/phases/opening/display.ts")')) {
  s = s.replace(
    'const opening = read("lib/llm/phases/opening-phase-v6.ts");',
    'const opening = read("lib/llm/phases/opening-phase-v6.ts");\n  const openingDisplay = read("lib/poju/phases/opening/display.ts");'
  );
}
s = s.replace(
  'assert("agent gate on awaiting_understanding_confirm phase", agent.includes(\'phaseAfter === "awaiting_understanding_confirm"\'));',
  'assert("opening display gates on awaiting_understanding_confirm phase", openingDisplay.includes(\'phaseAfter === "awaiting_understanding_confirm"\'));'
);
fs.writeFileSync("scripts/test-poju-block88-gate-summary-deterministic.ts", s);
console.log("updated");