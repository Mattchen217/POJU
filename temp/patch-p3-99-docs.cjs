const fs=require("fs");
for (const p of [
  "docs/phase3/PHASE3-S5-P3-TEST-INDEX.md",
  "docs/phase3/PHASE3-S5-WRITEUP.md",
]) {
  let s=fs.readFileSync(p,"utf8");
  if (p.endsWith("INDEX.md")) {
    const i99=s.indexOf("| P3-99 |");
    const e99=s.indexOf("\n", i99);
    const i100=s.indexOf("| P3-100 |");
    const e100=s.indexOf("\n", i100);
    s = s.slice(0,i99) +
      "| P3-99 | TaskContext completed Registry missing — runtime hard fail | §18.4 / §9.5 | test-decision-context-phase3-e2e.ts | restore/jobReload/read/commit throw GENERATION_STATE_INCONSISTENT case A |" +
      s.slice(e99, i100) +
      "| P3-100 | Registry completed TaskContext running — runtime hard fail | §18.4 / §9.5 | test-decision-context-phase3-e2e.ts | restore/PathB/PathC throw GENERATION_STATE_INCONSISTENT case B |" +
      s.slice(e100);
    fs.writeFileSync(p,s);
    console.log("index updated");
  } else {
    if (s.includes("P3-99/P3-100: inconsistency is **detectable**")) {
      s = s.replace(
        /-[^\n]*P3-99\/P3-100:[^\n]*/,
        "- P3-99/P3-100 remediated: runtime Generation consistency validator hard-fails case A/B at reload/PathB/PathC/formal read-commit",
      );
      fs.writeFileSync(p,s);
      console.log("writeup gap replaced");
    } else if (s.includes("P3-91 remediated") && !s.includes("P3-99/P3-100 remediated")) {
      s = s.replace(
        "- P3-91 remediated: real Path A staged Registry write then fail before Binding (Dexie abort; retry OK)",
        "- P3-91 remediated: real Path A staged Registry write then fail before Binding (Dexie abort; retry OK)\n- P3-99/P3-100 remediated: runtime Generation consistency validator hard-fails case A/B at reload/PathB/PathC/formal read-commit",
      );
      fs.writeFileSync(p,s);
      console.log("writeup note added");
    } else console.log("writeup skip");
  }
}
