const fs=require("fs");
const s=fs.readFileSync("temp/en-head.json","utf8");
try {
  const j=JSON.parse(s);
  console.log("ok keys", Object.keys(j).filter(k=>/auth/i.test(k)));
  console.log(JSON.stringify(j.auth,null,2));
} catch(e) {
  console.log("parse err", e.message);
  const i=s.indexOf('"auth"');
  console.log("auth idx", i);
  if(i>=0) console.log(s.slice(i, i+2500));
}
