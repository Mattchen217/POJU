const fs = require("fs");
const p = "scripts/test-decision-context-phase3-idb.ts";
let s = fs.readFileSync(p, "utf8");
if (!s.includes("PHASE3_ONLY_IDS")) {
  s = s.replace(
    "function shouldRun(id: string): boolean {\n  return !CORE_ONLY || CORE_IDS.has(id);\n}",
    "function shouldRun(id: string): boolean {\n  const only = process.env.PHASE3_ONLY_IDS;\n  if (only && only.trim()) return only.split(/[,\\s]+/).filter(Boolean).includes(id);\n  return !CORE_ONLY || CORE_IDS.has(id);\n}"
  );
  fs.writeFileSync(p, s);
  console.log("added PHASE3_ONLY_IDS filter");
} else {
  console.log("PHASE3_ONLY_IDS already present");
}
