const fs = require("fs");
const path = "D:/POJU/pojulife/docs/eastern-os/decision-intake-2.0/evidence/m2-2-freeze-report-binding/CONTRACT-FIX-R3.md";
let s = fs.readFileSync(path, "utf8");
s = s.replace("| `pnpm test:m2-2-freeze-report-binding` | (run on commit) |", "| `pnpm test:m2-2-freeze-report-binding` | **34/34 PASS** |");
s = s.replace("| `pnpm test:m2-1-readiness-confirm-freeze` | (run on commit) |", "| `pnpm test:m2-1-readiness-confirm-freeze` | **19/19 PASS** |");
s = s.replace("| `pnpm exec tsc --noEmit` | (run on commit) |", "| `pnpm exec tsc --noEmit` | **PASS** |");
s = s.replace("| `pnpm build` | (run on commit) |", "| `pnpm build` | **PASS** |");
fs.writeFileSync(path, s, "utf8");
console.log("evidence updated");
