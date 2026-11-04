const fs=require("fs");
const p="docs/phase3/PHASE3-S5-WRITEUP.md";
let s=fs.readFileSync(p,"utf8");
if (s.includes("\\n- P3-91 remediated")) {
  s=s.replace("\\n- P3-91 remediated", "\n- P3-91 remediated");
  fs.writeFileSync(p,s);
  console.log("fixed literal newline");
} else {
  const i=s.indexOf("P3-91 remediated");
  console.log("nearby", JSON.stringify(s.slice(i-80, i+100)));
}
