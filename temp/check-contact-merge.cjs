const fs=require("fs");
for (const loc of ["en","zh","es","fr"]) {
  const j=JSON.parse(fs.readFileSync("messages/"+loc+".json","utf8"));
  console.log(loc, "contact stub:", JSON.stringify(j.contact));
  const p="messages/"+loc+"/contact.json";
  const c=JSON.parse(fs.readFileSync(p,"utf8"));
  console.log(loc, "file billing.title:", c.billing?.title, "| Token?", /Token|Monthly Pass/.test(JSON.stringify(c)));
}
