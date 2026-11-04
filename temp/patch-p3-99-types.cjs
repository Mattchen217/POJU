const fs = require("fs");
const p = "lib/poju/generation/types.ts";
let s = fs.readFileSync(p, "utf8");
const needle = 'export const GENERATION_HARD_FAIL = "GENERATION_HARD_FAIL";';
const insert = needle + "\nexport const GENERATION_STATE_INCONSISTENT = \"GENERATION_STATE_INCONSISTENT\";";
if (!s.includes("GENERATION_STATE_INCONSISTENT")) {
  if (!s.includes(needle)) {
    console.error("needle missing");
    process.exit(1);
  }
  s = s.replace(needle, insert);
  fs.writeFileSync(p, s);
  console.log("types patched");
} else {
  console.log("types already patched");
}
