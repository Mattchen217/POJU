const fs=require("fs");
{
  const p="docs/phase3/PHASE3-S5-P3-TEST-INDEX.md";
  let s=fs.readFileSync(p,"utf8");
  const i=s.indexOf("| P3-112 |");
  const e=s.indexOf("\n", i);
  s=s.slice(0,i)+"| P3-112 | Confirmation source provenance — real user message on Session | §18.6 / §11.3 / §16.6 | test-decision-context-phase3-e2e.ts | missing/forged/cross-session/non-user/target mismatch/action reuse hard-fail; happy path OK |"+s.slice(e);
  fs.writeFileSync(p,s);
  console.log("index ok");
}
{
  const p="docs/phase3/PHASE3-S5-WRITEUP.md";
  let s=fs.readFileSync(p,"utf8");
  if (!s.includes("P3-112 remediated")) {
    if (s.includes("P3-99/P3-100 remediated")) {
      s=s.replace(
        "- P3-99/P3-100 remediated: runtime Generation consistency validator hard-fails case A/B at reload/PathB/PathC/formal read-commit",
        "- P3-99/P3-100 remediated: runtime Generation consistency validator hard-fails case A/B at reload/PathB/PathC/formal read-commit\n- P3-112 remediated: confirmFact/Constraint require real user-message provenance on current Session",
      );
      fs.writeFileSync(p,s);
      console.log("writeup ok");
    } else console.log("writeup anchor missing");
  }
}
