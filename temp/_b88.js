const fs = require("fs");
const agent = fs.readFileSync("lib/poju/agent.ts", "utf8");
const display = fs.readFileSync("lib/poju/phases/opening/display.ts", "utf8");
console.log("agent has phaseAfter === awaiting", agent.includes('phaseAfter === "awaiting_understanding_confirm"'));
console.log("display has it", display.includes('phaseAfter === "awaiting_understanding_confirm"'));
console.log("agent has awaiting_understanding_confirm", agent.includes("awaiting_understanding_confirm"));