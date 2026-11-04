const fs = require("fs");
const path = "scripts/test-decision-context-phase1.ts";
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
let turn = 0;
let i = 0;
const out = [];
while (i < lines.length) {
  const line = lines[i];
  // Detect start of an object that may need source_turn_id
  if (/^\s*\{\s*$/.test(line)) {
    const block = [line];
    let j = i + 1;
    let depth = 1;
    while (j < lines.length && depth > 0) {
      const L = lines[j];
      // crude brace depth ignoring strings is fine for these fixtures
      for (const ch of L) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }
      block.push(L);
      j++;
    }
    const text = block.join("\n");
    const needs =
      text.includes("statement:") &&
      (text.includes("verification_level:") || text.includes("category:")) &&
      !text.includes("source_turn_id") &&
      // avoid RealityFact / other builders outside opening seed
      !text.includes("fact_id:") &&
      !text.includes("buildRealityFact") &&
      !text.includes("constraint_id:");
    if (needs) {
      turn++;
      const id = "t_s4fix_" + turn;
      // insert before the last line of the block (the closing })
      const close = block.pop();
      const indent = (close.match(/^(\s*)/) || ["", "  "])[1] + "  ";
      block.push(indent + 'source_turn_id: "' + id + '",');
      block.push(close);
      out.push(...block);
      i = j;
      continue;
    }
  }
  out.push(line);
  i++;
}
fs.writeFileSync(path, out.join("\n"));
console.log("PATCHED inserts=" + turn);
