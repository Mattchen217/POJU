const fs=require("fs");
const html=fs.readFileSync("public/v2-landing.html","utf8");
const lines=html.split(/\r?\n/);
// hero carousel CSS around images
for(let i=2380;i<2450;i++) console.log((i+1)+": "+lines[i]);
console.log("--- FR stage4 ---");
lines.forEach((l,i)=>{ if(l.includes("stage4.youGet")||l.includes("pas un chat")||l.includes("session complete")||l.includes("une course")) console.log((i+1)+": "+l.trim().slice(0,200)); });
console.log("--- privacy FR chat ---");
let inFr=false;
for(let i=0;i<lines.length;i++){
  if(/PRIVACY_COPY|privacyCopy|\"fr\"\s*:/.test(lines[i]) && i>3700) {}
  if(i>3700 && i<3900 && /\bchat\b|course/.test(lines[i])) console.log((i+1)+": "+lines[i].trim().slice(0,220));
}
