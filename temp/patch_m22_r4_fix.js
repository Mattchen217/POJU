const fs = require("fs");

// Strip BOM from authority module
{
  let s = fs.readFileSync("lib/poju/final-delivery-execution-authority.ts", "utf8");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  fs.writeFileSync("lib/poju/final-delivery-execution-authority.ts", s);
  console.log("bom stripped");
}

// Fix createInitialAgentState calls in tests
{
  const p = "scripts/test-m2-2-freeze-report-binding.ts";
  let s = fs.readFileSync(p, "utf8");
  const before = (s.match(/mkAgent\(/g) || []).length;
  s = s.replace(/mkAgent\(([^)]+)\)/g, 'mkAgent({ original_question: "r4 test" })');
  // Fix the Object.assign issue on prepared - use let pattern by rewriting C3 loop more simply if needed
  fs.writeFileSync(p, s);
  console.log("mkAgent fixed", before);
}

// Also strip BOM from any patch-created files if present
for (const f of [
  "lib/poju/final-delivery-execution-authority.ts",
]) {
  const buf = fs.readFileSync(f);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    fs.writeFileSync(f, buf.slice(3));
    console.log("binary bom stripped", f);
  }
}
