const fs=require("fs");
{
  const p="docs/phase3/PHASE3-S5-P3-TEST-INDEX.md";
  let s=fs.readFileSync(p,"utf8");
  const i=s.indexOf("| P3-91 |");
  const end=s.indexOf("\n", i);
  const neu="| P3-91 | Real Path A staged Registry write then fail before Binding — full abort; retry OK | §18.3 | test-decision-context-phase3-idb.ts | stage1 afterWrite throws; DC/reg/bind/task/keys/revs unchanged; retry Path A commits |";
  s=s.slice(0,i)+neu+s.slice(end);
  fs.writeFileSync(p,s);
  console.log("index ok");
}
{
  const p="docs/phase3/PHASE3-S5-WRITEUP.md";
  let s=fs.readFileSync(p,"utf8");
  if (s.includes("P3-71 remediated") && !s.includes("P3-91 remediated")) {
    s=s.replace(
      "- P3-71 remediated: real Dexie mid-txn abort after session update + cycle-index clear (no manual restore)",
      "- P3-71 remediated: real Dexie mid-txn abort after session update + cycle-index clear (no manual restore)\\n- P3-91 remediated: real Path A staged Registry write then fail before Binding (Dexie abort; retry OK)"
    );
    // fix double escape if any
    s=s.replace("\\\\n- P3-91","\\n- P3-91");
    fs.writeFileSync(p,s);
    console.log("writeup ok");
  } else console.log("writeup skip", s.includes("P3-91 remediated"));
}
