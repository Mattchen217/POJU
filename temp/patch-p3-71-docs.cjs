const fs = require("fs");

// index
{
  const p = "docs/phase3/PHASE3-S5-P3-TEST-INDEX.md";
  let s = fs.readFileSync(p, "utf8");
  const i = s.indexOf("| P3-71 |");
  if (i < 0) throw new Error("P3-71 index row missing");
  const end = s.indexOf("\n", i);
  const neu =
    "| P3-71 | Real Dexie mid-txn fail after session+cycle clear — full abort; retry OK | §18.1 | test-decision-context-phase3-idb.ts | hook after_clear; cipher+revs+cycle ids unchanged; retry commits new cycle |";
  s = s.slice(0, i) + neu + s.slice(end);
  fs.writeFileSync(p, s);
  console.log("index ok");
}

// writeup — append/update if gap mentions P3-71 apply-throw; else leave
{
  const p = "docs/phase3/PHASE3-S5-WRITEUP.md";
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("P3-71") && s.includes("apply")) {
    console.log("writeup has P3-71 mention; leave unless apply-throw");
  }
  // Ensure a remediation note near P3-70 line if present
  if (s.includes("P3-70 remediated") && !s.includes("P3-71 remediated")) {
    s = s.replace(
      "- P3-70 remediated: real encrypt inject on casWritePOJUSession path (cipher throw before Dexie commit)",
      "- P3-70 remediated: real encrypt inject on casWritePOJUSession path (cipher throw before Dexie commit)\n- P3-71 remediated: real Dexie mid-txn abort after session update + cycle-index clear (no manual restore)",
    );
    fs.writeFileSync(p, s);
    console.log("writeup note added");
  } else {
    console.log("writeup skip/already");
  }
}
