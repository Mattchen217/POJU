const fs=require("fs");
const html=fs.readFileSync("public/v2-landing.html","utf8");
const lines=html.split(/\r?\n/);
for(let i=30;i<60;i++) console.log((i+1)+": "+lines[i]);
console.log("--- FR privacy ---");
for(let i=3785;i<3850;i++) if(lines[i]) console.log((i+1)+": "+lines[i].trim().slice(0,220));
