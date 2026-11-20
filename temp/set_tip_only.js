const fs = require("fs");
const p = "docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2-FU2.md";
const tip = "c9de85c353bc438ae4720af9d06bad2aef563ab3";
let t = fs.readFileSync(p, "utf8");
const before = t.length;
const old = "| HEAD / tip | `a56043aecd9d28003573521fe0062e518e0e5637` |";
const neu = "| HEAD / tip | `" + tip + "` |";
if (!t.includes(old)) {
  console.error("old tip line missing");
  process.exit(1);
}
t = t.replace(old, neu);
if (t.length < before - 50) {
  console.error("unexpected shrink", before, t.length);
  process.exit(1);
}
fs.writeFileSync(p, t);
console.log("ok lines", t.split(/\n/).length, "bytes", t.length);
