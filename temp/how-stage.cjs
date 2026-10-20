const fs=require("fs");
// Find HOWGET FR stage4 body structure in landing
const html=fs.readFileSync("public/v2-landing.html","utf8");
const idx=html.indexOf("HOWGET_COPY")>=0?html.indexOf("HOWGET_COPY"):html.indexOf("HOW_COPY");
console.log("idx", idx);
const m=html.match(/const HOW[A-Z_]*COPY[\s\S]{0,200}/);
console.log(m&&m[0]);
// Find fr stage4 full
const re=/"stage4\.[^"]+"\s*:\s*"[^"]*"/g;
let x; const hits=[];
while((x=re.exec(html))) hits.push(x[0].slice(0,180));
console.log(hits.filter(h=>h.includes("stage4")).join("\n"));
