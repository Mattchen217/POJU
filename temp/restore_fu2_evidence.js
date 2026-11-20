const { execSync } = require("child_process");
const fs = require("fs");
const raw = execSync(
  "git show a56043ae:docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2-FU2.md",
  { encoding: "buffer" }
);
let text = raw.toString("utf8");
// strip BOM if any
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const impl = "a56043aecd9d28003573521fe0062e518e0e5637";
text = text.split("PLACEHOLDER_IMPL_SHA").join(impl);
text = text.split("PLACEHOLDER_TIP_SHA").join("PLACEHOLDER_TIP_SHA");
fs.writeFileSync(
  "docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2-FU2.md",
  text,
  "utf8"
);
console.log("lines", text.split(/\n/).length);
console.log(text.split(/\n/).filter((l) => l.includes("Impl") || l.includes("HEAD / tip") || l.includes("Problem")).join("\n"));
