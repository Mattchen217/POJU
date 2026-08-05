const fs = require("fs");
const t = fs.readFileSync("d:/POJU/模型输出1", "utf8");

// Extract final JSON object (last complete-looking JSON)
function extractJson(raw) {
  const start = raw.lastIndexOf("{\n");
  // find first { that has "energy_structure" or "situation_conclusion"
  const keys = ['"situation_conclusion"', '"energy_structure"', '"response"'];
  let best = -1;
  for (const k of keys) {
    const i = raw.lastIndexOf(k);
    if (i > best) best = i;
  }
  // walk back to {
  let brace = raw.lastIndexOf("{", best);
  // try parse from various starts
  const starts = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "{" && raw.slice(i, i + 40).includes('"')) starts.push(i);
  }
  // prefer the one that contains situation_conclusion and response as JSON fields
  for (let i = starts.length - 1; i >= 0; i--) {
    const slice = raw.slice(starts[i]);
    try {
      // find matching end - greedy truncate at last }
      const end = slice.lastIndexOf("}");
      const candidate = slice.slice(0, end + 1);
      const obj = JSON.parse(candidate);
      if (obj && (obj.response || obj.situation_conclusion)) return obj;
    } catch {}
  }
  return null;
}

const obj = extractJson(t);
if (!obj) {
  console.log("parse failed, dumping response snippets");
  const m = t.match(/"response"\s*:\s*"((?:\\.|[^"\\])*)"/g);
  console.log(m && m.slice(-2));
  process.exit(1);
}
console.log("KEYS", Object.keys(obj));
console.log("\n=== RESPONSE ===\n");
console.log(obj.response);
console.log("\n=== SITUATION_CONCLUSION ===\n");
console.log(obj.situation_conclusion);
fs.writeFileSync(
  "d:/POJU/pojulife/tmp-model-parsed.json",
  JSON.stringify(
    {
      response: obj.response,
      situation_conclusion: obj.situation_conclusion,
    },
    null,
    2,
  ),
  "utf8",
);
