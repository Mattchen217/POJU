const fs = require("fs");
const { execSync } = require("child_process");
const p = "docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2-FU2.md";
const tip = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
let t = fs.readFileSync(p, "utf8");
const before = t.length;
const replaced = t.replace(/\| HEAD \/ tip \| `[^`]+` \|/, "| HEAD / tip | `" + tip + "` |");
if (replaced === t) { console.error("no replace"); process.exit(1); }
if (replaced.length < before - 20) { console.error("shrink"); process.exit(1); }
fs.writeFileSync(p, replaced);
execSync("git add " + p, { stdio: "inherit" });
execSync('git commit -m "M2.3-R2-FU2: align evidence tip to branch HEAD"', { stdio: "inherit" });
const tip2 = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
// tip2 != tip; leave documented tip as previous HEAD (7e9480f5) which is accurate for the tip-alignment intent of that commit's parent. Report actual tip2.
console.log("documented_in_commit_parent_tip", tip);
console.log("actual_HEAD", tip2);
