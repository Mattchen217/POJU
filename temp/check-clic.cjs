const fs=require("fs");
const landing=fs.readFileSync("public/v2-landing.html","utf8");
const re=/un clic|en un clic|one-click|一键/gi;
let m;
while((m=re.exec(landing))){
  console.log("---", m[0], "at", m.index);
  console.log(landing.slice(Math.max(0,m.index-80), m.index+80).replace(/\n/g," "));
}
